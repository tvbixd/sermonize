import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SermonRecorder } from '@/audio/SermonRecorder';
import { RecordButton } from '@/components/RecordButton';
import { OutlineView } from '@/components/OutlineView';
import { lookupVerses } from '@/services/bible';
import { extractOutline } from '@/services/outline';
import { findScriptureReferences } from '@/services/scriptureRegex';
import { transcribeAudio } from '@/services/whisper';
import { useSessionStore } from '@/state/sessionStore';
import { getGroqKey, getTranslation } from '@/storage/keys';
import { ensureAudioDir, saveSermon } from '@/storage/sermons';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import type { Sermon } from '@/types';
import { formatElapsed } from '@/util/format';
import { newId } from '@/util/id';

const OUTLINE_EVERY_N_CHUNKS = 2;

const IDLE_BAR_HEIGHTS = [14, 22, 10, 30, 18, 44, 24, 36, 20, 40, 16, 28, 12, 34, 20];

const STEP_INDEX: Record<string, number> = {
  outlining: 1,
  scriptures: 2,
  saving: 3,
};

const STEP_NEXT: Record<string, string> = {
  outlining: 'Scriptures',
  scriptures: 'Saving',
  saving: 'Done',
};

export default function RecordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t, isDark), [t, isDark]);

  useEffect(() => {
    reset();
    return () => {
      stopTicker();
      void recorderRef.current?.stop().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { transcriptRef.current = liveTranscript; }, [liveTranscript]);
  useEffect(() => { chunkCountRef.current = chunkCount; }, [chunkCount]);

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
      appendTranscript(text);
      incrementChunk();
      const newCount = chunkCountRef.current + 1;
      if (newCount % OUTLINE_EVERY_N_CHUNKS === 0) {
        const fullTranscript = transcriptRef.current + ' ' + text;
        const outline = await extractOutline(fullTranscript, groqKeyRef.current);
        setLiveOutline(outline);
      }
    } catch {
      // silently skip failed chunk
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
        setStatus('paused');
      } else if (status === 'paused') {
        await recorderRef.current?.resume();
        setStatus('recording');
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
    setStep('saving');

    try {
      const result = await recorderRef.current?.stop();
      audioUrisRef.current = result?.uris ?? [];
      durationRef.current = result?.durationMs ?? 0;

      await new Promise((r) => setTimeout(r, 2000));

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
      setStep('done');
      setStatus('done');
      router.replace(`/sermon/${sermon.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      setRetryAvailable(true);
    }
  };

  const onDiscard = () => {
    Alert.alert('Discard recording?', 'Everything captured so far will be deleted.', [
      { text: 'Keep', style: 'cancel' },
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

  const stepLabel: Record<string, string> = {
    outlining: 'Building outline…',
    scriptures: 'Looking up scriptures…',
    saving: 'Saving…',
    done: 'Done!',
  };

  const currentStepIndex = STEP_INDEX[step] ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar style="auto" />
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: t.bgSurface },
          headerTintColor: t.accentBlue,
          contentStyle: { backgroundColor: t.bgPrimary },
        }}
      />

      <View style={styles.timerRow}>
        <Text style={styles.timer}>{formatElapsed(elapsedMs)}</Text>
        <Text style={styles.statusLabel}>
          {status === 'recording' ? '● Recording' :
           status === 'paused' ? '❚❚ Paused' :
           status === 'processing' ? stepLabel[step] ?? 'Processing…' :
           status === 'error' ? 'Error' : 'Ready to Record'}
        </Text>
      </View>

      {status === 'processing' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.textPrimary} />
          <Text style={styles.stepText}>{stepLabel[step] ?? 'Processing…'}</Text>
          {currentStepIndex > 0 && (
            <>
              <Text style={styles.stepSubText}>
                Step {currentStepIndex} of 3 · {STEP_NEXT[step] ?? ''}
              </Text>
              <View style={styles.pipRow}>
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.pip,
                      { backgroundColor: i <= currentStepIndex ? t.accentBlue : t.stepPipInactive },
                    ]}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      ) : status === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          {retryAvailable && (
            <TouchableOpacity style={styles.retryBtn} onPress={() => setStatus('processing')}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={styles.liveArea} contentContainerStyle={styles.liveContent}>
          <View style={styles.btnWrap}>
            <RecordButton
              status={status === 'recording' ? 'recording' : status === 'paused' ? 'paused' : 'idle'}
              onPress={onRecordPress}
            />
          </View>

          {status === 'idle' && (
            <View style={styles.idleHintWrap}>
              <View style={styles.waveformRow}>
                {IDLE_BAR_HEIGHTS.map((h, i) => (
                  <View key={i} style={[styles.waveformBar, { height: h }]} />
                ))}
              </View>
              <Text style={styles.hint}>
                {'Recording will transcribe and outline\nyour sermon automatically.'}
              </Text>
            </View>
          )}

          {liveTranscript.length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Live Transcript</Text>
              <Text style={styles.transcriptText}>{liveTranscript}</Text>
            </View>
          )}

          {liveOutline && liveOutline.points.length > 0 && (
            <View style={styles.panel}>
              <TouchableOpacity
                style={styles.outlineToggle}
                onPress={() => setShowOutline((v) => !v)}
              >
                <Text style={styles.panelTitle}>Live Outline</Text>
                <Text style={styles.chevron}>{showOutline ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showOutline && <OutlineView outline={liveOutline} />}
            </View>
          )}
        </ScrollView>
      )}

      {isActive && (
        <View style={styles.controls}>
          <Pressable style={styles.stopBtn} onPress={onStop}>
            <Text style={styles.stopText}>Stop & Save</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onDiscard}>
            <Text style={styles.cancelText}>Discard</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(t: Colors, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },

    timerRow: { alignItems: 'center', marginTop: spacing.md, paddingBottom: spacing.xs },
    timer: {
      fontSize: 56,
      fontWeight: '200',
      color: t.textPrimary,
      fontVariant: ['tabular-nums'],
      letterSpacing: -1,
    },
    statusLabel: { ...typography.subhead, color: t.textSecondary, marginTop: spacing.xs },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    stepText: { marginTop: spacing.md, ...typography.body, color: t.textSecondary, textAlign: 'center' },
    stepSubText: { marginTop: spacing.xs, ...typography.footnote, color: t.textTertiary, textAlign: 'center' },

    pipRow: { flexDirection: 'row', gap: 6, marginTop: spacing.sm, alignItems: 'center' },
    pip: { width: 20, height: 3, borderRadius: 2 },

    errorTitle: { ...typography.headline, color: t.accentRed, marginBottom: spacing.sm },
    errorBody: { ...typography.subhead, color: t.textSecondary, textAlign: 'center', marginBottom: spacing.md },
    retryBtn: {
      backgroundColor: t.bgSurfaceRaised,
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      borderRadius: radius.small,
    },
    retryText: { ...typography.headline, color: t.accentBlue },

    liveArea: { flex: 1 },
    liveContent: { paddingVertical: spacing.md, paddingBottom: spacing.sm },
    btnWrap: { alignItems: 'center', marginBottom: spacing.lg },

    idleHintWrap: { alignItems: 'center', marginBottom: spacing.md },
    waveformRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: spacing.sm },
    waveformBar: { width: 3, borderRadius: 2, backgroundColor: t.textTertiary },
    hint: { ...typography.footnote, color: t.textSecondary, textAlign: 'center' },

    panel: {
      backgroundColor: t.bgSurface,
      borderRadius: radius.card,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    panelTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    transcriptText: { ...typography.subhead, color: t.textPrimary, lineHeight: 22, marginTop: spacing.sm },
    outlineToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chevron: { color: t.textSecondary, fontSize: 14 },

    controls: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    stopBtn: {
      flex: 2,
      height: 52,
      backgroundColor: isDark ? t.bgSurfaceRaised : '#000000',
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stopText: { ...typography.headline, color: '#FFFFFF' },
    cancelBtn: {
      flex: 1,
      height: 52,
      backgroundColor: t.bgSurface,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      ...(isDark ? {} : { borderWidth: 0.5, borderColor: t.separator }),
    },
    cancelText: { ...typography.headline, color: t.accentRed },
  });
}
