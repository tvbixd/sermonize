import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
import type { Sermon } from '@/types';
import { formatElapsed } from '@/util/format';
import { newId } from '@/util/id';

// Regenerate outline after every N chunks
const OUTLINE_EVERY_N_CHUNKS = 2;

export default function RecordScreen() {
  const router = useRouter();

  const status      = useSessionStore((s) => s.status);
  const step        = useSessionStore((s) => s.step);
  const elapsedMs   = useSessionStore((s) => s.elapsedMs);
  const errorMessage = useSessionStore((s) => s.errorMessage);
  const liveTranscript = useSessionStore((s) => s.liveTranscript);
  const liveOutline = useSessionStore((s) => s.liveOutline);
  const chunkCount  = useSessionStore((s) => s.chunkCount);

  const setStatus   = useSessionStore((s) => s.setStatus);
  const setStep     = useSessionStore((s) => s.setStep);
  const setElapsed  = useSessionStore((s) => s.setElapsed);
  const setError    = useSessionStore((s) => s.setError);
  const appendTranscript = useSessionStore((s) => s.appendTranscript);
  const setLiveOutline   = useSessionStore((s) => s.setLiveOutline);
  const incrementChunk   = useSessionStore((s) => s.incrementChunk);
  const reset       = useSessionStore((s) => s.reset);

  const recorderRef   = useRef<SermonRecorder | null>(null);
  const sermonIdRef   = useRef<string>('');
  const audioUrisRef  = useRef<string[]>([]);
  const durationRef   = useRef<number>(0);
  const tickerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const groqKeyRef    = useRef<string>('');
  const transcriptRef = useRef<string>(''); // shadow of zustand for use in callbacks
  const chunkCountRef = useRef<number>(0);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [showOutline, setShowOutline] = useState(false);

  useEffect(() => {
    reset();
    return () => {
      stopTicker();
      void recorderRef.current?.stop().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep transcript shadow in sync
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

  /** Called each time a 30s chunk is ready — transcribe it immediately. */
  const onChunkReady = async (chunkUri: string) => {
    try {
      const text = await transcribeAudio([chunkUri], groqKeyRef.current);
      if (!text.trim()) return;
      appendTranscript(text);
      incrementChunk();
      const newCount = chunkCountRef.current + 1;
      // Regenerate outline every N chunks
      if (newCount % OUTLINE_EVERY_N_CHUNKS === 0) {
        const fullTranscript = transcriptRef.current + ' ' + text;
        const outline = await extractOutline(fullTranscript, groqKeyRef.current);
        setLiveOutline(outline);
      }
    } catch {
      // Silently skip failed chunk — transcript continues
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

      // Wait a moment for the final chunk transcription to land
      await new Promise((r) => setTimeout(r, 2000));

      // Final outline pass over the full transcript
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Timer */}
      <View style={styles.timerRow}>
        <Text style={styles.timer}>{formatElapsed(elapsedMs)}</Text>
        <Text style={styles.statusLabel}>
          {status === 'recording' ? '● Recording' :
           status === 'paused' ? '❚❚ Paused' :
           status === 'processing' ? stepLabel[step] ?? 'Processing…' :
           status === 'error' ? 'Error' : 'Ready'}
        </Text>
      </View>

      {/* Main content area */}
      {status === 'processing' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0369a1" />
          <Text style={styles.stepText}>{stepLabel[step] ?? 'Processing…'}</Text>
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
          {/* Record button */}
          <View style={styles.btnWrap}>
            <RecordButton
              status={status === 'recording' ? 'recording' : status === 'paused' ? 'paused' : 'idle'}
              onPress={onRecordPress}
            />
          </View>

          {status === 'idle' && (
            <Text style={styles.hint}>
              Tap to start. Transcript and outline update live every 30 seconds.
            </Text>
          )}

          {/* Live transcript */}
          {liveTranscript.length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Live Transcript</Text>
              <Text style={styles.transcriptText}>{liveTranscript}</Text>
            </View>
          )}

          {/* Live outline toggle */}
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

      {/* Controls */}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  timerRow: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  timer: { fontSize: 48, fontWeight: '300', color: '#0f172a', fontVariant: ['tabular-nums'] },
  statusLabel: { fontSize: 14, color: '#64748b', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  stepText: { marginTop: 16, fontSize: 16, color: '#334155', textAlign: 'center' },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#b91c1c', marginBottom: 8 },
  errorBody: { fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#0369a1', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  liveArea: { flex: 1 },
  liveContent: { padding: 16, paddingBottom: 8 },
  btnWrap: { alignItems: 'center', marginBottom: 24 },
  hint: { color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  panelTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  transcriptText: { fontSize: 15, color: '#1e293b', lineHeight: 22, marginTop: 8 },
  outlineToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chevron: { color: '#64748b', fontSize: 14 },
  controls: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  stopBtn: { flex: 2, backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  stopText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { flex: 1, backgroundColor: '#e2e8f0', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelText: { color: '#334155', fontWeight: '600', fontSize: 16 },
});
