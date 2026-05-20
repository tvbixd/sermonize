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
import { SermonRecorder } from '@/audio/SermonRecorder';
import { lookupVerses } from '@/services/bible';
import { extractOutline } from '@/services/outline';
import { findScriptureReferences } from '@/services/scriptureRegex';
import { NetworkError, RateLimitError, transcribeAudio } from '@/services/whisper';
import { useSessionStore } from '@/state/sessionStore';
import { getGroqKey, getTranslation } from '@/storage/keys';
import { ensureAudioDir, saveSermon } from '@/storage/sermons';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import type { Sermon } from '@/types';
import { newId } from '@/util/id';
import { BackChevronIcon, ChevronIcon } from '@/components/icons';

const OUTLINE_EVERY_N_CHUNKS = 2;

const IDLE_BARS = [12, 22, 16, 32, 28, 44, 38, 24, 18, 30, 14, 26, 20, 36, 10];

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  const cs = String(Math.floor((ms % 1000) / 10)).padStart(2, '0');
  return `${mm}:${ss}.${cs}`;
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
  const liveTranscript = useSessionStore((s) => s.liveTranscript);
  const liveOutline    = useSessionStore((s) => s.liveOutline);
  const chunkCount     = useSessionStore((s) => s.chunkCount);

  const setStatus        = useSessionStore((s) => s.setStatus);
  const setStep          = useSessionStore((s) => s.setStep);
  const setElapsed       = useSessionStore((s) => s.setElapsed);
  const setError         = useSessionStore((s) => s.setError);
  const appendTranscript = useSessionStore((s) => s.appendTranscript);
  const setLiveOutline   = useSessionStore((s) => s.setLiveOutline);
  const incrementChunk   = useSessionStore((s) => s.incrementChunk);
  const reset            = useSessionStore((s) => s.reset);

  const recorderRef   = useRef<SermonRecorder | null>(null);
  const sermonIdRef   = useRef<string>('');
  const audioUrisRef  = useRef<string[]>([]);
  const durationRef   = useRef<number>(0);
  const tickerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const groqKeyRef    = useRef<string>('');
  const transcriptRef = useRef<string>('');
  const chunkCountRef = useRef<number>(0);
  const [showOutline, setShowOutline] = useState(false);
  const [chunkWarning, setChunkWarning] = useState<string | null>(null);

  useEffect(() => {
    reset();
    return () => {
      stopTicker();
      void recorderRef.current?.stop().catch(() => undefined);
    };
  }, []);

  useEffect(() => { transcriptRef.current = liveTranscript; }, [liveTranscript]);

  const startTicker = () => {
    stopTicker();
    tickerRef.current = setInterval(() => {
      if (recorderRef.current) setElapsed(recorderRef.current.getElapsedMs());
    }, 250);
  };

  const stopTicker = () => {
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
  };

  const onChunkReady = async (chunkUri: string) => {
    try {
      const text = await transcribeAudio([chunkUri], groqKeyRef.current);
      if (!text.trim()) return;
      transcriptRef.current = transcriptRef.current ? transcriptRef.current + ' ' + text : text;
      appendTranscript(text);
      chunkCountRef.current += 1;
      incrementChunk();
      if (chunkCountRef.current % OUTLINE_EVERY_N_CHUNKS === 0) {
        const outline = await extractOutline(transcriptRef.current, groqKeyRef.current);
        setLiveOutline(outline);
      }
    } catch (e) {
      if (e instanceof NetworkError || e instanceof RateLimitError) {
        setChunkWarning(e.message);
        setTimeout(() => setChunkWarning(null), 6000);
      }
    }
  };

  const onRecordPress = async () => {
    try {
      if (status === 'idle') {
        const key = await getGroqKey();
        if (!key) {
          Alert.alert('API Key Missing', 'Go to Settings and add your Groq API key first.');
          return;
        }
        groqKeyRef.current = key;
        const id = newId();
        sermonIdRef.current = id;
        const dir = await ensureAudioDir(id);
        const recorder = new SermonRecorder(dir);
        await recorder.start(onChunkReady);
        recorderRef.current = recorder;
        setStatus('recording');
        startTicker();
      } else if (status === 'recording') {
        await recorderRef.current?.pause();
        stopTicker();
        setStatus('paused');
      } else if (status === 'paused') {
        await recorderRef.current?.resume();
        setStatus('recording');
        startTicker();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      stopTicker();
    }
  };

  const onStop = async () => {
    if (status !== 'recording' && status !== 'paused') return;
    stopTicker();
    setStatus('processing');

    try {
      const result = await recorderRef.current?.stop();
      audioUrisRef.current = result?.uris ?? [];
      durationRef.current = result?.durationMs ?? 0;

      setStep('outlining');
      const transcript = transcriptRef.current;
      const outline = transcript.trim()
        ? await extractOutline(transcript, groqKeyRef.current)
        : liveOutline ?? { title: 'Untitled Sermon', theme: '', summary: '', points: [] };

      setStep('scriptures');
      const translation = await getTranslation();
      const allRefs = new Set<string>(findScriptureReferences(transcript));
      for (const p of outline.points) for (const r of p.scriptures) allRefs.add(r);
      const scriptures = await lookupVerses([...allRefs], translation);

      setStep('saving');
      const sermon: Sermon = {
        id: sermonIdRef.current,
        createdAt: Date.now(),
        title: outline.title,
        transcript,
        outline,
        scriptures,
        audioUris: audioUrisRef.current,
        durationMs: durationRef.current,
      };
      await saveSermon(sermon);
      setStatus('done');
      router.replace(`/sermon/${sermon.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  const onDiscard = () => {
    Alert.alert('Discard recording?', 'You can save it as a draft to finish later.', [
      { text: 'Keep Recording', style: 'cancel' },
      {
        text: 'Save as Draft',
        onPress: async () => {
          stopTicker();
          const result = await recorderRef.current?.stop().catch(() => undefined);
          const sermon: Sermon = {
            id: sermonIdRef.current,
            createdAt: Date.now(),
            title: 'Draft — ' + new Date().toLocaleDateString(),
            transcript: transcriptRef.current,
            outline: liveOutline ?? { title: 'Draft', theme: '', summary: '', points: [] },
            scriptures: [],
            audioUris: result?.uris ?? [],
            durationMs: result?.durationMs ?? 0,
            isDraft: true,
          };
          await saveSermon(sermon);
          reset();
          router.back();
        },
      },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          stopTicker();
          await recorderRef.current?.stop().catch(() => undefined);
          reset();
          router.back();
        },
      },
    ]);
  };

  const isActive = status === 'recording' || status === 'paused';
  const isProcessing = status === 'processing';

  const stepLabel: Record<string, string> = { outlining: 'Building outline…', scriptures: 'Looking up scriptures…', saving: 'Saving…' };
  const stepIndex: Record<string, number> = { outlining: 1, scriptures: 2, saving: 3 };
  const stepNext: Record<string, string> = { outlining: 'Looking up scriptures next', scriptures: 'Saving next', saving: '' };

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
              Step {stepIndex[step] ?? 1} of 3 · {stepNext[step] ?? ''}
            </Text>
          </View>
          <View style={styles.pips}>
            {[1, 2, 3].map((i) => (
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
                {'Recording will transcribe and outline\nyour sermon automatically.'}
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
              {liveTranscript.length > 0 && (
                <View style={[styles.panel, { backgroundColor: t.bgSurface }]}>
                  <Text style={[styles.panelLabel, { color: t.textSecondary }]}>LIVE TRANSCRIPT</Text>
                  <Text style={[styles.panelText, { color: t.textPrimary }]}>{liveTranscript}</Text>
                </View>
              )}
              {liveOutline && liveOutline.points.length > 0 && (
                <View style={[styles.panel, { backgroundColor: t.bgSurface }]}>
                  <TouchableOpacity
                    style={styles.panelHeader}
                    onPress={() => setShowOutline((v) => !v)}
                  >
                    <Text style={[styles.panelLabel, { color: t.textSecondary }]}>LIVE OUTLINE</Text>
                    <ChevronIcon dir={showOutline ? 'up' : 'down'} size={10} color={t.textTertiary} />
                  </TouchableOpacity>
                  {showOutline && liveOutline.points.map((p, i) => (
                    <Text key={i} style={[styles.panelText, { color: t.textPrimary, marginTop: 2 }]}>
                      {i + 1}. {p.heading}
                    </Text>
                  ))}
                </View>
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
          >
            <Text style={styles.stopText}>Stop & Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.discardBtn, { backgroundColor: t.bgSurface, borderWidth: 0.5, borderColor: t.separator }]}
            onPress={onDiscard}
            activeOpacity={0.8}
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
