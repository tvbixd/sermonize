import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Modal,
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
import { LiveWaveform } from '@/components/LiveWaveform';
import { LiveTranscript } from '@/components/LiveTranscript';
import { useSessionStore } from '@/state/sessionStore';
import { getGroqKey, getTranslation } from '@/storage/keys';
import { saveSermon } from '@/storage/sermons';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import type { Sermon } from '@/types';
import { heavyTap, lightTap, mediumTap } from '@/util/haptics';
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
  const liveTranscript = useSessionStore((s) => s.liveTranscript);
  const chunkWarning   = useSessionStore((s) => s.chunkWarning);
  const audioOnlyMode  = useSessionStore((s) => s.audioOnlyMode);

  const setStatus = useSessionStore((s) => s.setStatus);
  const setStep   = useSessionStore((s) => s.setStep);
  const setError  = useSessionStore((s) => s.setError);
  const reset     = useSessionStore((s) => s.reset);

  // Verses with text (or a definitive "failed") — used for the count and the
  // "all found" list. The most recent detected reference (any status) is spotlit.
  const resolvedScriptures = useMemo(
    () => liveScriptures.filter((s) => s.status !== 'resolving'),
    [liveScriptures],
  );
  const latestScripture = liveScriptures.length ? liveScriptures[liveScriptures.length - 1] : undefined;

  const [showAll, setShowAll] = useState(false);
  const getMeterLevel = useCallback(() => recordingEngine.getMeterLevel(), []);
  const transcriptScrollRef = useRef<ScrollView>(null);

  // ── Phase 3 polish: reduced-motion, haptics, entrance + pulse animations ──
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (mounted) setReduceMotion(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(!!v));
    return () => { mounted = false; sub?.remove?.(); };
  }, []);

  // Soft haptic when a new verse resolves onto the screen.
  const prevFoundRef = useRef(0);
  useEffect(() => {
    if (resolvedScriptures.length > prevFoundRef.current) lightTap();
    prevFoundRef.current = resolvedScriptures.length;
  }, [resolvedScriptures.length]);

  // Spotlight card slides/fades in whenever the current verse changes.
  const spotAnim = useRef(new Animated.Value(1)).current;
  const lastSpotRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const ref = latestScripture?.reference;
    if (!ref || ref === lastSpotRef.current) return;
    lastSpotRef.current = ref;
    if (reduceMotion) { spotAnim.setValue(1); return; }
    spotAnim.setValue(0);
    Animated.timing(spotAnim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [latestScripture?.reference, reduceMotion, spotAnim]);

  // Gently pulse the REC dot while recording.
  const dotPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (status === 'recording' && !reduceMotion) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(dotPulse, { toValue: 0.3, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    dotPulse.setValue(1);
  }, [status, reduceMotion, dotPulse]);

  const finalizingRef = useRef(false);

  // Opening the record screen with nothing actively recording should always
  // start from a clean slate — clears a leftover error/paused state from a
  // previous failed attempt so the record button works again.
  useEffect(() => {
    if (!recordingEngine.isActive()) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      let outlineFellBack = false;
      if (transcript.trim() && key) {
        try {
          outline = await extractOutline(transcript, key);
        } catch {
          // The AI outline often fails right after a long recording that hit the
          // transcription rate limit — pause briefly and retry once.
          try {
            await new Promise((r) => setTimeout(r, 2500));
            outline = await extractOutline(transcript, key);
          } catch {
            outlineFellBack = true; // keep the basic on-device outline, tell the user
          }
        }
      }

      // Drop the live-only `status` field, and any reference still mid-lookup
      // with no text (it gets re-resolved below if it appears in the transcript).
      let scriptures: Awaited<ReturnType<typeof lookupVerses>> = useSessionStore
        .getState()
        .liveScriptures.filter((s) => s.status !== 'resolving' || s.text)
        .map((s) => ({ reference: s.reference, text: s.text, translation: s.translation }));
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
      void logEvent('recording_completed', { durationMs: captured.durationMs, outlineFellBack });
      reset();
      router.replace(`/sermon/${sermon.id}`);
      if (outlineFellBack) {
        Alert.alert(
          'Basic outline saved',
          "The AI couldn't build the full outline just now (often a temporary rate limit after a long recording). Your transcript and audio are safe — open the sermon and tap Regenerate to build the AI outline.",
        );
      }
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

  const ringColor = t.textTertiary;

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
          style={styles.cancelBtn}
        >
          <Text style={[styles.navText, isActive && { color: t.accentRed }]}>
            {isActive ? 'Discard' : 'Cancel'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Timer */}
      <View style={[styles.timerSection, { paddingTop: status === 'idle' ? 80 : 28 }]}>
        <Text style={[styles.timer, { color: t.textPrimary }]}>{formatTimer(elapsedMs)}</Text>
        <View style={styles.statusRow}>
          {status === 'recording' && <Animated.View style={[styles.recDot, { opacity: dotPulse }]} />}
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
      ) : status === 'idle' ? (
        <>
          {/* Record button */}
          <View style={styles.btnArea}>
            <TouchableOpacity
              onPress={onRecordPress}
              style={[styles.ring, { borderColor: ringColor }]}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Start recording"
            >
              <View style={[styles.innerShape, {
                width: 112, height: 112, borderRadius: 56, backgroundColor: t.accentRed,
              }]} />
            </TouchableOpacity>
            <Text style={[styles.btnLabel, { color: t.textSecondary }]}>Tap to Record</Text>
          </View>

          <View style={styles.idleHint}>
            <View style={styles.idleBars}>
              {IDLE_BARS.map((h, i) => (
                <View key={i} style={[styles.idleBar, { height: h, backgroundColor: t.textTertiary }]} />
              ))}
            </View>
            <Text style={[styles.hintText, { color: t.textSecondary }]}>
              {'Scriptures appear live as they\'re mentioned.\nYou get a full outline when you finish.'}
            </Text>
          </View>
        </>
      ) : (
        /* Recording / paused — the live "Spotlight" screen */
        <View style={styles.liveWrap}>
          {chunkWarning && (
            <View style={styles.warningBanner}><Text style={styles.warningText}>{chunkWarning}</Text></View>
          )}
          {audioOnlyMode && (
            <View style={[styles.warningBanner, { backgroundColor: t.accentBlue }]}>
              <Text style={styles.warningText}>Audio only — scripture detection paused</Text>
            </View>
          )}

          <LiveWaveform getLevel={getMeterLevel} active={status === 'recording'} color={t.accentRed} />

          <View style={styles.txWrap} accessibilityLiveRegion="polite">
            <Text style={[styles.eyebrow, { color: t.textTertiary }]}>Live transcript</Text>
            <ScrollView
              ref={transcriptScrollRef}
              style={styles.txScroll}
              onContentSizeChange={() => transcriptScrollRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
            >
              {liveTranscript.trim() ? (
                <LiveTranscript text={liveTranscript} />
              ) : (
                <Text style={[styles.txPlaceholder, { color: t.textTertiary }]}>
                  Listening… your words will appear here.
                </Text>
              )}
            </ScrollView>
          </View>

          <View style={styles.spotHeader}>
            <Text style={[styles.eyebrow, { color: t.textTertiary }]}>{audioOnlyMode ? 'Audio only' : 'Just now'}</Text>
            {resolvedScriptures.length > 0 && (
              <TouchableOpacity
                style={[styles.pill, { backgroundColor: t.bgSurface, borderColor: t.separator }]}
                onPress={() => setShowAll(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Show all ${resolvedScriptures.length} scriptures found`}
              >
                <Text style={[styles.pillText, { color: t.textSecondary }]}>{resolvedScriptures.length} found</Text>
                <Text style={[styles.pillChevron, { color: t.textTertiary }]}>›</Text>
              </TouchableOpacity>
            )}
          </View>

          <Animated.View
            style={[
              styles.spotCard,
              {
                backgroundColor: t.bgSurface,
                borderColor: t.separator,
                opacity: spotAnim,
                transform: [{ translateY: spotAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              },
            ]}
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={
              latestScripture
                ? `${latestScripture.reference}${
                    latestScripture.text
                      ? '. ' + latestScripture.text
                      : latestScripture.status === 'resolving'
                        ? ', finding verse'
                        : ', verse text unavailable'
                  }`
                : 'Scriptures appear here as they are spoken'
            }
          >
            {latestScripture ? (
              <>
                <View style={styles.spotRefRow}>
                  <Text style={[styles.spotRef, { color: t.accentBlue }]}>{latestScripture.reference}</Text>
                  {latestScripture.translation ? (
                    <View style={[styles.spotChip, { borderColor: t.accentGold }]}>
                      <Text style={[styles.spotChipText, { color: t.accentGold }]}>{latestScripture.translation}</Text>
                    </View>
                  ) : null}
                </View>
                {latestScripture.text ? (
                  <Text style={[styles.spotText, { color: t.textPrimary }]}>{'“' + latestScripture.text + '”'}</Text>
                ) : latestScripture.status === 'resolving' ? (
                  <Text style={[styles.spotFinding, { color: t.textSecondary }]}>Finding verse…</Text>
                ) : (
                  <Text style={[styles.spotFinding, { color: t.textSecondary }]}>Verse text unavailable.</Text>
                )}
              </>
            ) : (
              <Text style={[styles.spotFinding, { color: t.textSecondary }]}>
                Scriptures appear here the moment they're spoken.
              </Text>
            )}
          </Animated.View>
        </View>
      )}

      {/* Bottom bar */}
      {isActive && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.discardBtn, { backgroundColor: t.bgSurface, borderWidth: 0.5, borderColor: t.separator }]}
            onPress={onRecordPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={status === 'recording' ? 'Pause recording' : 'Resume recording'}
          >
            <Text style={[styles.discardText, { color: t.textPrimary }]}>
              {status === 'recording' ? 'Pause' : 'Resume'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.stopBtn, { backgroundColor: t.accentBlue }]}
            onPress={onStop}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Stop and save sermon"
          >
            <Text style={styles.stopText}>Stop & Save</Text>
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

      {/* All scriptures found so far (from the "N found" pill) */}
      <Modal visible={showAll} animationType="slide" transparent onRequestClose={() => setShowAll(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: t.dimOverlay }]}>
          <View style={[styles.modalSheet, { backgroundColor: t.bgPrimary }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>
                Scriptures found {resolvedScriptures.length > 0 ? `(${resolvedScriptures.length})` : ''}
              </Text>
              <TouchableOpacity onPress={() => setShowAll(false)} hitSlop={8}>
                <Text style={[styles.navText, { color: t.accentBlue }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, gap: 10 }}>
              {dedupeScriptures([...resolvedScriptures]).reverse().map((sc, i) => (
                <ScriptureCard key={`${sc.reference}-${i}`} scripture={sc} />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
      marginBottom: 8,
    },
    warningText: { ...typography.footnote, color: '#fff', fontWeight: '600', textAlign: 'center' },

    // ── Live "Spotlight" screen ──────────────────────────────────────────────
    liveWrap: { flex: 1, paddingHorizontal: spacing.md, paddingTop: 14 },
    eyebrow: {
      fontSize: 11, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase',
      marginBottom: 8,
    },
    txWrap: { flex: 1, minHeight: 0, marginTop: 20 },
    txScroll: { flex: 1 },
    txPlaceholder: { ...typography.body },
    spotHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 16, marginBottom: 8,
    },
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderWidth: 0.5, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5,
    },
    pillText: { ...typography.footnote, fontWeight: '600' },
    pillChevron: { fontSize: 16, fontWeight: '600', marginTop: -1 },
    spotCard: {
      borderRadius: radius.card, borderWidth: 0.5, padding: 16, marginBottom: 6,
    },
    spotRefRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    spotRef: { ...typography.title3, fontWeight: '700' },
    spotChip: {
      marginLeft: 'auto', borderWidth: 1, borderRadius: radius.pill,
      paddingHorizontal: 8, paddingVertical: 1.5,
    },
    spotChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    spotText: { ...typography.callout, lineHeight: 24, marginTop: 9, fontStyle: 'italic' },
    spotFinding: { ...typography.subhead, marginTop: 4 },

    // ── "All found" sheet ────────────────────────────────────────────────────
    modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
    modalSheet: {
      maxHeight: '78%', borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingBottom: 8,
    },
    modalHandle: {
      alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
      backgroundColor: t.textTertiary, marginTop: 8, marginBottom: 4,
    },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.md, paddingVertical: 8,
    },
    modalTitle: { ...typography.headline },
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
