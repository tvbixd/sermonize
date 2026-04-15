import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SermonRecorder } from '@/audio/SermonRecorder';
import { RecordButton } from '@/components/RecordButton';
import { lookupVerses } from '@/services/bible';
import { extractOutline } from '@/services/outline';
import { findScriptureReferences } from '@/services/scriptureRegex';
import { transcribeAudio } from '@/services/whisper';
import { useSessionStore } from '@/state/sessionStore';
import { getGroqKey, getTranslation } from '@/storage/keys';
import { ensureAudioDir, saveSermon } from '@/storage/sermons';
import type { ProcessingStep, Sermon } from '@/types';
import { formatElapsed } from '@/util/format';
import { newId } from '@/util/id';

const STEP_LABEL: Record<ProcessingStep, string> = {
  idle: '',
  transcribing: 'Transcribing audio…',
  outlining: 'Outlining sermon…',
  scriptures: 'Looking up scriptures…',
  saving: 'Saving sermon…',
  done: 'Done!',
};

export default function RecordScreen() {
  const router = useRouter();
  const status = useSessionStore((s) => s.status);
  const step = useSessionStore((s) => s.step);
  const elapsedMs = useSessionStore((s) => s.elapsedMs);
  const errorMessage = useSessionStore((s) => s.errorMessage);
  const setStatus = useSessionStore((s) => s.setStatus);
  const setStep = useSessionStore((s) => s.setStep);
  const setElapsed = useSessionStore((s) => s.setElapsed);
  const setError = useSessionStore((s) => s.setError);
  const reset = useSessionStore((s) => s.reset);

  const recorderRef = useRef<SermonRecorder | null>(null);
  const sermonIdRef = useRef<string>('');
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const audioUrisRef = useRef<string[]>([]);
  const durationRef = useRef<number>(0);

  useEffect(() => {
    reset();
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
      // best-effort cleanup if user leaves mid-recording
      void recorderRef.current?.stop().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTicker = () => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = setInterval(() => {
      const r = recorderRef.current;
      if (r) setElapsed(r.getElapsedMs());
    }, 250);
  };

  const stopTicker = () => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  };

  const onRecordPress = async () => {
    try {
      if (status === 'idle') {
        const id = newId();
        sermonIdRef.current = id;
        const dir = await ensureAudioDir(id);
        const recorder = new SermonRecorder(dir);
        await recorder.start();
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
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
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
      if (!result || result.uris.length === 0) {
        throw new Error('No audio was captured.');
      }
      audioUrisRef.current = result.uris;
      durationRef.current = result.durationMs;
      await processRecording();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus('error');
      setRetryAvailable(audioUrisRef.current.length > 0);
    }
  };

  const processRecording = async () => {
    setError(null);
    setRetryAvailable(false);

    const groqKey = await getGroqKey();
    if (!groqKey) {
      throw new Error('Groq API key is not set. Open Settings to add it.');
    }
    const translation = await getTranslation();

    setStep('transcribing');
    const transcript = await transcribeAudio(audioUrisRef.current, groqKey);

    setStep('outlining');
    const outline = await extractOutline(transcript, groqKey);

    setStep('scriptures');
    const allRefs = new Set<string>();
    for (const r of findScriptureReferences(transcript)) allRefs.add(r);
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
  };

  const onRetry = async () => {
    if (audioUrisRef.current.length === 0) return;
    setStatus('processing');
    try {
      await processRecording();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus('error');
      setRetryAvailable(true);
    }
  };

  const onCancel = () => {
    Alert.alert('Discard recording?', 'The audio captured so far will be deleted.', [
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

  const isRecordingOrPaused = status === 'recording' || status === 'paused';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.timerRow}>
        <Text style={styles.timer}>{formatElapsed(elapsedMs)}</Text>
        <Text style={styles.statusLabel}>
          {status === 'recording'
            ? '● Recording'
            : status === 'paused'
              ? '❚❚ Paused'
              : status === 'processing'
                ? 'Processing'
                : status === 'error'
                  ? 'Error'
                  : 'Ready'}
        </Text>
      </View>

      <View style={styles.center}>
        {status === 'processing' ? (
          <View style={styles.processing}>
            <ActivityIndicator size="large" color="#0369a1" />
            <Text style={styles.stepText}>{STEP_LABEL[step]}</Text>
          </View>
        ) : status === 'error' ? (
          <View style={styles.processing}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorBody}>{errorMessage}</Text>
            {retryAvailable ? (
              <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
                <Text style={styles.retryText}>Retry processing</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <RecordButton
            status={status === 'recording' ? 'recording' : status === 'paused' ? 'paused' : 'idle'}
            onPress={onRecordPress}
          />
        )}
      </View>

      {isRecordingOrPaused ? (
        <View style={styles.controls}>
          <Pressable style={styles.stopBtn} onPress={onStop}>
            <Text style={styles.stopText}>Stop & Outline</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Discard</Text>
          </Pressable>
        </View>
      ) : null}

      {status === 'idle' ? (
        <Text style={styles.hint}>
          Tap the button to start recording. You can pause and resume; tap “Stop & Outline” when the
          sermon ends.
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 20 },
  timerRow: { alignItems: 'center', marginTop: 8 },
  timer: { fontSize: 48, fontWeight: '300', color: '#0f172a', fontVariant: ['tabular-nums'] },
  statusLabel: { fontSize: 14, color: '#64748b', marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  processing: { alignItems: 'center', padding: 24 },
  stepText: { marginTop: 16, fontSize: 16, color: '#334155', textAlign: 'center' },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#b91c1c', marginBottom: 8 },
  errorBody: { fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#0369a1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  controls: { flexDirection: 'row', gap: 12 },
  stopBtn: {
    flex: 2,
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  stopText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: { color: '#334155', fontWeight: '600', fontSize: 16 },
  hint: { color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 12 },
});
