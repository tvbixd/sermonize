import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Circle, Path } from 'react-native-svg';
import { recordingEngine } from '@/audio/recordingEngine';
import { dedupeScriptures, lookupVerses } from '@/services/bible';
import { extractOutline } from '@/services/outline';
import { buildLocalOutline } from '@/services/localOutline';
import { findScriptureReferences } from '@/services/scriptureRegex';
import { ScriptureCard } from '@/components/ScriptureCard';
import { useSessionStore } from '@/state/sessionStore';
import { getGroqKey, getTranslation } from '@/storage/keys';
import { saveSermon } from '@/storage/sermons';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import type { Sermon } from '@/types';
import { heavyTap, mediumTap } from '@/util/haptics';
import { BackChevronIcon } from '@/components/icons';
import { logEvent, logCrash } from '@/services/logger';
import { checkConnectivity } from '@/services/network';

const IDLE_BARS = [12, 22, 16, 32, 28, 44, 38, 24, 18, 30, 14, 26, 20, 36, 10];

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${String(m).padStart(2, '0')}:${ss}`;
}

function SpinnerSvg({ trackColor, arcColor }: { trackColor: string; arcColor: string }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
    ).start();
    return () => rotation.stopAnimation();
  }, [rotation]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <Svg width={56} height={56} viewBox="0 0 56 56">
        <Circle cx="28" cy="28" r="22" stroke={trackColor} strokeWidth="3" fill="none" />
        <Path d="M28 6 A22 22 0 0 1 50 28" stroke={arcColor} strokeWidth="3" fill="none" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

export default function RecordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const status         = useSessionStore((s) => s.status);
  const step           = useSessionStore((s) => s.step);
  const elapsedMs      = useSessionStore((s) => s.elapsedMs);
  const errorMessage   = useSessionStore((s) => s.errorMessage);
  const liveScriptures = useSessionStore((s) => s.liveScriptures);
  const chunkWarning   = useSessionStore((s) => s.chunkWarning);
  const audioOnlyMode  = useSessionStore((s) => s.audioOnlyMode);

  const setStatus = useSessionStore((s) => s.setStatus);
  const setStep   = useSessionStore((s) => s.setStep);
  const setError  = useSessionStore((s) => s.setError);
  const reset     = useSessionStore((s) => s.reset);

  const finalizingRef = useRef(false);

  const onRecordPress = async () => {
    mediumTap();
    try {
      if (status === 'idle') {
        const key = (await getGroqKey()) ?? '';
        if (!key) {
          Alert.alert('API Key Missing', 'Add your free Groq API key in Settings to enable transcription.', [
            { text: 'Open Settings', onPress: () => router.push('/settings') },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }

        const online = await checkConnectivity(key);
        if (!online) {
          Alert.alert(
            'No Internet Connection',
            'You can still record audio. Transcription will be available later via Re-transcribe.',
            [
              { text: 'Record Audio Only', onPress: () => void recordingEngine.start({ groqKey: key, audioOnly: true }).catch((e) => {
                setError(e instanceof Error ? e.message : String(e));
                setStatus('error');
              }) },
              { text: 'Cancel', style: 'cancel' },
            ],
          );
          return;
        }
        await recordingEngine.start({ groqKey: key, audioOnly: false });
      } else if (status === 'recording') {
        await recordingEngine.pause();
      } else if (status === 'paused') {
        await recordingEngine.resume();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  const onStop = async () => {
    if ((status !== 'recording' && status !== 'paused') || finalizingRef.current) return;
    finalizingRef.current = true;
    heavyTap();
    setStatus('processing');

    const sermonId = recordingEngine.getSermonId();
    const startedAt = recordingEngine.getStartedAt() || Date.now();
    const fallbackOutline = () =>
      useSessionStore.getState().liveOutline ?? { title: 'Untitled Sermon', theme: '', summary: '', points: [] };

    let captured: { uris: string[]; durationMs: number; transcript: string } | undefined;
    try {
      setStep('transcribing');
      captured = await recordingEngine.stopForFinalize();
      const transcript = captured.transcript;

      // Outline: Groq's LLM when a key is present, otherwise the free on-device
      // extractive outline. The extractive path is a normal outcome.
      setStep('outlining');
      const key = (await getGroqKey()) ?? '';
      let outline = transcript.trim() ? buildLocalOutline(transcript) : fallbackOutline();
      if (transcript.trim() && key) {
        try {
          outline = await extractOutline(transcript, key);
        } catch {
          // keep the extractive outline
        }
      }

      let scriptures: Awaited<ReturnType<typeof lookupVerses>> =
        useSessionStore.getState().liveScriptures;
      try {
        setStep('scriptures');
        const have = new Set(scriptures.map((s) => s.reference));
        const extra = new Set<string>();
        for (const r of findScriptureReferences(transcript)) if (!have.has(r)) extra.add(r);
        for (const p of outline.points) for (const r of p.scriptures) if (!have.has(r)) extra.add(r);
        if (extra.size > 0) {
          const translation = await getTranslation();
          scriptures = [...scriptures, ...await lookupVerses([...extra], translation)];
        }
      } catch {
        // keep whatever we resolved live
      }
      scriptures = dedupeScriptures(scriptures);

      setStep('saving');
      const sermon: Sermon = {
        id: sermonId,
        createdAt: startedAt,
        title: outline.title,
        transcript,
        outline,
        scriptures,
        audioUris: captured.uris,
        durationMs: captured.durationMs,
      };
      await saveSermon(sermon);
      setStatus('done');
      void logEvent('recording_completed', { durationMs: captured.durationMs });
      reset();
      router.replace(`/sermon/${sermon.id}`);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      void logCrash(err, { phase: 'processing', step });
      try {
        await saveSermon({
          id: sermonId,
          createdAt: startedAt,
          title: 'Draft — ' + new Date().toLocaleDateString(),
          transcript: captured?.transcript ?? '',
          outline: fallbackOutline(),
          scriptures: [],
          audioUris: captured?.uris ?? [],
          durationMs: captured?.durationMs ?? 0,
          isDraft: true,
        });
        reset();
        Alert.alert(
          'Saved as Draft',
          'Something went wrong while finishing your sermon, but your recording is safe as a draft. You can re-transcribe it from the sermon list.',
          [{ text: 'OK', onPress: () => router.replace('/sermons') }],
        );
      } catch {
        setError(err.message);
        setStatus('error');
      }
    } finally {
      finalizingRef.current = false;
    }
  };

  const onDiscard = () => {
    Alert.alert('Discard recording?', 'You can save it as a draft to finish later.', [
      { text: 'Keep Recording', style: 'cancel' },
      { text: 'Save as Draft', onPress: async () => { await recordingEngine.saveDraft(); if (router.canGoBack()) router.back(); } },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await recordingEngine.discard();
          if (router.canGoBack()) router.back();
        },
      },
    ]);
  };

  const isActive = status === 'recording' || status === 'paused';
  const isProcessing = status === 'processing';

  const stepLabel: Record<string, string> = { transcribing: 'Finishing transcription…', outlining: 'Building outline…', scriptures: 'Looking up scriptures…', saving: 'Saving…' };
  const stepIndex: Record<string, number> = { transcribing: 1, outlining: 2, scriptures: 3, saving: 4 };
  const stepNext: Record<string, string> = { transcribing: 'Building outline next', outlining: 'Looking up scriptures next', scriptures: 'Saving next', saving: '' };

  const ringColor = isActive ? t.accentRed : t.textTertiary;

  // Record button inner shape
  const innerSize = status === 'recording' ? 64 : 112;
  const innerRadius = status === 'recording' ? 12 : status === 'paused' ? 22 : 56;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bgPrimary }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'auto'} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBack} hitSlop={8}>
          <BackChevronIcon color={t.accentBlue} size={20} />
          <Text style={[styles.navText, { color: t.accentBlue }]}>Sermons</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={isActive ? onDiscard : () => router.back()}
          hitSlop={8}
          style={[styles.cancelBtn, isActive && { opacity: 0.4 }]}
        >
          <Text style={styles.navText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Timer */}
      <View style={[styles.timerSection, { paddingTop: status === 'idle' ? 80 : 28 }]}>
        <Text style={[styles.timer, { color: t.textPrimary }]}>{formatTimer(elapsedMs)}</Text>
        <View style={styles.statusRow}>
          {status === 'recording' && <View style={styles.recDot} />}
          {status === 'paused' && (
            <View style={styles.pauseBars}>
              <View style={[styles.pauseBar, { backgroundColor: t.textSecondary }]} />
              <View style={[styles.pauseBar, { backgroundColor: t.textSecondary }]} />
            </View>
          )}
          <Text style={[styles.statusText, { color: t.textSecondary }]}>
            {status === 'idle' ? 'Ready to Record'
              : status === 'recording' ? 'Recording'
              : status === 'paused' ? 'Paused'
              : 'Processing'}
          </Text>
        </View>
      </View>

      {isProcessing ? (
        <View style={styles.processingArea}>
          <SpinnerSvg trackColor={t.spinnerTrack} arcColor={t.spinnerArc} />
          <View style={styles.processingText}>
            <Text style={[styles.processingTitle, { color: t.textPrimary }]}>
              {stepLabel[step] ?? 'Processing…'}
            </Text>
            <Text style={[styles.processingSubtitle, { color: t.textSecondary }]}>
              Step {stepIndex[step] ?? 1} of 4 · {stepNext[step] ?? ''}
            </Text>
          </View>
          <View style={styles.pips}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.pip,
                  { backgroundColor: i <= (stepIndex[step] ?? 0) ? t.accentBlue : t.stepPipInactive },
                ]}
              />
            ))}
          </View>
        </View>
      ) : (
        <>
          {/* Record button */}
          <View style={styles.btnArea}>
            <TouchableOpacity
              onPress={onRecordPress}
              style={[styles.ring, { borderColor: ringColor }]}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={
                status === 'idle' ? 'Start recording'
                  : status === 'recording' ? 'Pause recording'
                  : 'Resume recording'
              }
            >
              <View style={[styles.innerShape, {
                width: innerSize,
                height: innerSize,
                borderRadius: innerRadius,
                backgroundColor: t.accentRed,
              }]} />
            </TouchableOpacity>
            <Text style={[styles.btnLabel, { color: t.textSecondary }]}>
              {status === 'idle' ? 'Tap to Record'
                : status === 'recording' ? 'Tap to Pause'
                : 'Tap to Resume'}
            </Text>
          </View>

          {status === 'idle' && (
            <View style={styles.idleHint}>
              <View style={styles.idleBars}>
                {IDLE_BARS.map((h, i) => (
                  <View
                    key={i}
                    style={[styles.idleBar, {
                      height: h,
                      backgroundColor: t.textTertiary,
                    }]}
                  />
                ))}
              </View>
              <Text style={[styles.hintText, { color: t.textSecondary }]}>
                {'Scriptures appear live as they\'re mentioned.\nYou get a full outline when you finish.'}
              </Text>
            </View>
          )}

          {isActive && (
            <ScrollView style={styles.livePanels} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
              {chunkWarning && (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningText}>{chunkWarning}</Text>
                </View>
              )}
              {audioOnlyMode && (
                <View style={[styles.warningBanner, { backgroundColor: t.accentBlue }]}>
                  <Text style={styles.warningText}>Audio only mode — scripture detection paused</Text>
                </View>
              )}
              <Text style={[styles.panelLabel, { color: t.textSecondary, paddingHorizontal: 4 }]}>
                SCRIPTURES {liveScriptures.length > 0 ? `(${liveScriptures.length})` : ''}
              </Text>
              {liveScriptures.length === 0 ? (
                <View style={[styles.panel, { backgroundColor: t.bgSurface }]}>
                  <Text style={[styles.panelText, { color: t.textSecondary }]}>
                    Scriptures will appear here as they're mentioned.
                  </Text>
                </View>
              ) : (
                dedupeScriptures([...liveScriptures]).reverse().map((sc, i) => (
                  <ScriptureCard key={`${sc.reference}-${i}`} scripture={sc} />
                ))
              )}
            </ScrollView>
          )}
        </>
      )}

      {/* Bottom bar */}
      {isActive && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.stopBtn, { backgroundColor: t.accentBlue }]}
            onPress={onStop}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Stop and save sermon"
          >
            <Text style={styles.stopText}>Stop & Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.discardBtn, { backgroundColor: t.bgSurface, borderWidth: 0.5, borderColor: t.separator }]}
            onPress={onDiscard}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Discard recording"
          >
            <Text style={[styles.discardText, { color: t.accentRed }]}>Discard</Text>
          </TouchableOpacity>
        </View>
      )}

      {isProcessing && (
        <View style={styles.bottomBar}>
          <View style={[styles.stopBtn, { backgroundColor: t.bgSurface, opacity: 0.5 }]}>
            <Text style={[styles.stopText, { color: t.textSecondary }]}>Please wait…</Text>
          </View>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={[styles.errorBody, { color: t.textSecondary }]}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => reset()}>
            <Text style={{ color: t.accentBlue, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1 },

    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 4,
    },
    navBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    navText: { ...typography.body, color: t.accentBlue },
    cancelBtn: {},

    timerSection: { alignItems: 'center', paddingBottom: 8 },
    timer: { fontSize: 56, fontWeight: '200', letterSpacing: -1, lineHeight: 64, fontVariant: ['tabular-nums'] },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
    statusText: { ...typography.subhead },
    recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.accentRed },
    pauseBars: { flexDirection: 'row', gap: 2 },
    pauseBar: { width: 2.5, height: 10, borderRadius: 1 },

    btnArea: { alignItems: 'center', paddingTop: 32, paddingBottom: 8 },
    ring: {
      width: 164,
      height: 164,
      borderRadius: 82,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    innerShape: {},
    btnLabel: { ...typography.subhead, marginTop: 18 },

    idleHint: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 48 },
    idleBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 48, marginBottom: 20 },
    idleBar: { width: 3, borderRadius: 2 },
    hintText: { ...typography.footnote, textAlign: 'center', lineHeight: 20 },
    limitHint: { ...typography.caption, textAlign: 'center', marginTop: 8 },

    livePanels: { flex: 1, marginTop: 18, paddingHorizontal: spacing.md },
    warningBanner: {
      backgroundColor: t.accentOrange,
      borderRadius: radius.small,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    warningText: { ...typography.footnote, color: '#fff', fontWeight: '600', textAlign: 'center' },
    panel: { borderRadius: radius.card, padding: 12 },
    panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    panelLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    panelText: { ...typography.subhead, lineHeight: 21 },

    processingArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      gap: 24,
    },
    processingText: { alignItems: 'center', gap: 6 },
    processingTitle: { ...typography.headline },
    processingSubtitle: { ...typography.footnote },
    pips: { flexDirection: 'row', gap: 6 },
    pip: { width: 20, height: 3, borderRadius: 2 },

    bottomBar: { flexDirection: 'row', gap: 10, padding: 12, paddingBottom: 16 },
    stopBtn: {
      flex: 2,
      height: 52,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stopText: { ...typography.headline, color: '#FFFFFF' },
    discardBtn: {
      flex: 1,
      height: 52,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
    },
    discardText: { ...typography.headline },

    errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: 12 },
    errorTitle: { ...typography.headline, color: t.accentRed },
    errorBody: { ...typography.subhead, textAlign: 'center' },
    retryBtn: { padding: spacing.sm },
  });
}
