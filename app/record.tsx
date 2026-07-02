import { Stack, useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
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
import { deleteSermon, ensureAudioDir, saveSermon } from '@/storage/sermons';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import type { Sermon } from '@/types';
import { newId } from '@/util/id';
import { heavyTap, mediumTap } from '@/util/haptics';
import { BackChevronIcon, ChevronIcon } from '@/components/icons';
import { logEvent, logCrash } from '@/services/logger';
import { checkConnectivity } from '@/services/network';

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
  const navigation = useNavigation();
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
  const failedChunksRef = useRef(0);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioOnlyRef = useRef(false);
  const [audioOnlyMode, setAudioOnlyMode] = useState(false);
  // In-flight chunk transcriptions — onStop awaits these so the final chunk's
  // text makes it into the saved sermon.
  const pendingChunksRef = useRef<Set<Promise<void>>>(new Set());
  const rateLimitAlertActiveRef = useRef(false);
  const authAlertShownRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  // Set before intentional navigation so the beforeRemove guard lets us leave.
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    reset();
    return () => {
      stopTicker();
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      void recorderRef.current?.stop().catch(() => undefined);
    };
  }, []);

  useEffect(() => { transcriptRef.current = liveTranscript; }, [liveTranscript]);

  // When the app is backgrounded or the phone is locked mid-recording, the JS
  // thread freezes. The native recorder keeps capturing into the current
  // segment, but to guarantee zero data loss if the OS later kills us, we seal
  // the in-progress chunk to disk and save a draft right before suspension.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        const s = useSessionStore.getState().status;
        if (s === 'recording') {
          void logEvent('recording_backgrounded');
          void (async () => {
            await recorderRef.current?.flushCurrentChunk().catch(() => undefined);
            await autoSaveDraft();
          })();
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Guard the OS back gesture / hardware back button while recording — without
  // this, popping the screen stops the recorder and silently loses the session.
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      const s = useSessionStore.getState().status;
      if (allowLeaveRef.current || (s !== 'recording' && s !== 'paused')) return;
      e.preventDefault();
      Alert.alert('Recording in progress', 'Save it as a draft or discard it before leaving.', [
        { text: 'Keep Recording', style: 'cancel' },
        { text: 'Save as Draft', onPress: () => void saveDraftNow() },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await discardRecording();
            allowLeaveRef.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return sub;
  }, [navigation]);

  const startTicker = () => {
    stopTicker();
    tickerRef.current = setInterval(() => {
      if (recorderRef.current) setElapsed(recorderRef.current.getElapsedMs());
    }, 250);
  };

  const stopTicker = () => {
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
  };

  /** Wait (bounded) for in-flight chunk transcriptions so the final chunk's
   *  text is included in whatever we save next. */
  const waitForPendingChunks = async (timeoutMs = 20000) => {
    if (pendingChunksRef.current.size === 0) return;
    await Promise.race([
      Promise.allSettled([...pendingChunksRef.current]),
      new Promise((r) => setTimeout(r, timeoutMs)),
    ]);
  };

  const autoSaveDraft = async () => {
    if (!sermonIdRef.current) return;
    const uris = recorderRef.current?.getCurrentUris() ?? [];
    // Nothing worth saving yet
    if (!transcriptRef.current.trim() && uris.length === 0) return;
    const sermon: Sermon = {
      id: sermonIdRef.current,
      createdAt: recordingStartedAtRef.current || Date.now(),
      title: 'Draft — ' + new Date().toLocaleDateString(),
      transcript: transcriptRef.current,
      outline: useSessionStore.getState().liveOutline ?? { title: 'Draft', theme: '', summary: '', points: [] },
      scriptures: [],
      audioUris: uris,
      durationMs: recorderRef.current?.getElapsedMs() ?? 0,
      isDraft: true,
    };
    await saveSermon(sermon).catch(() => {});
  };

  const saveDraftNow = async () => {
    stopTicker();
    if (autoSaveRef.current) { clearInterval(autoSaveRef.current); autoSaveRef.current = null; }
    const result = await recorderRef.current?.stop().catch(() => undefined);
    await waitForPendingChunks(8000);
    const sermon: Sermon = {
      id: sermonIdRef.current,
      createdAt: recordingStartedAtRef.current || Date.now(),
      title: 'Draft — ' + new Date().toLocaleDateString(),
      transcript: transcriptRef.current,
      outline: useSessionStore.getState().liveOutline ?? { title: 'Draft', theme: '', summary: '', points: [] },
      scriptures: [],
      audioUris: result?.uris ?? [],
      durationMs: result?.durationMs ?? 0,
      isDraft: true,
    };
    await saveSermon(sermon);
    reset();
    allowLeaveRef.current = true;
    router.back();
  };

  /** Stop the recorder and remove everything written to disk for this session. */
  const discardRecording = async () => {
    stopTicker();
    if (autoSaveRef.current) { clearInterval(autoSaveRef.current); autoSaveRef.current = null; }
    await recorderRef.current?.stop().catch(() => undefined);
    // Without this the sealed chunks stay on disk and orphan recovery
    // resurrects the "discarded" recording as a draft on next launch.
    if (sermonIdRef.current) await deleteSermon(sermonIdRef.current).catch(() => {});
    reset();
  };

  const processChunk = async (chunkUri: string) => {
    if (audioOnlyRef.current) return;
    try {
      const text = await transcribeAudio([chunkUri], groqKeyRef.current);
      if (!text.trim()) return;
      transcriptRef.current = transcriptRef.current ? transcriptRef.current + ' ' + text : text;
      appendTranscript(text);
      chunkCountRef.current += 1;
      incrementChunk();
      failedChunksRef.current = 0;
      setChunkWarning(null);
      if (chunkCountRef.current % OUTLINE_EVERY_N_CHUNKS === 0) {
        const outline = await extractOutline(transcriptRef.current, groqKeyRef.current);
        setLiveOutline(outline);
      }
    } catch (e) {
      failedChunksRef.current += 1;
      const count = failedChunksRef.current;
      const isRateLimit = e instanceof RateLimitError;
      const isNetwork = e instanceof NetworkError;
      const msg = e instanceof Error ? e.message : String(e);
      const isAuth = !isRateLimit && !isNetwork && /\((401|403)\)/.test(msg);

      setChunkWarning(
        isRateLimit ? 'Transcription limit reached — audio is still being saved'
          : isNetwork ? msg
          : isAuth ? 'API key rejected — audio is still being saved'
          : 'Transcription error — audio is still being saved',
      );
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      // Rate-limit and auth warnings stay visible; transient errors auto-dismiss
      if (!isRateLimit && !isAuth) {
        warningTimerRef.current = setTimeout(() => setChunkWarning(null), 10000);
      }

      const pauseAndAlert = (title: string, message: string) => {
        if (rateLimitAlertActiveRef.current) return;
        rateLimitAlertActiveRef.current = true;
        heavyTap();
        void recorderRef.current?.pause().catch(() => undefined);
        stopTicker();
        setStatus('paused');
        const resume = () => {
          rateLimitAlertActiveRef.current = false;
          recorderRef.current?.resume().catch(() => undefined);
          setStatus('recording');
          startTicker();
        };
        Alert.alert(title, message, [
          { text: 'Stop & Save', style: 'default', onPress: () => { rateLimitAlertActiveRef.current = false; void saveDraftNow(); } },
          {
            text: 'Continue (Audio Only)',
            onPress: () => {
              audioOnlyRef.current = true;
              setAudioOnlyMode(true);
              setChunkWarning(null);
              resume();
            },
          },
          { text: 'Keep Trying', style: 'cancel', onPress: resume },
        ]);
      };

      if (isRateLimit) {
        void logEvent('rate_limit_alert', { consecutiveFailures: count });
        pauseAndAlert(
          'Transcription Limit Reached',
          'Your Groq API rate limit has been hit. Your audio is safe — you can save now and re-transcribe later, or keep recording audio without transcription.',
        );
      } else if (isAuth && !authAlertShownRef.current) {
        authAlertShownRef.current = true;
        void logEvent('auth_error_alert', {});
        pauseAndAlert(
          'API Key Problem',
          'Groq rejected your API key, so nothing is being transcribed. Your audio is safe — you can save now and fix the key in Settings, or keep recording audio only.',
        );
      } else if (isNetwork && count >= 3) {
        heavyTap();
        void logEvent('network_alert', { consecutiveFailures: count });
        pauseAndAlert(
          'Connection Lost',
          'Unable to reach the transcription server. Audio is still being saved.',
        );
      }
    }
  };

  // Sync wrapper handed to SermonRecorder: registers each chunk's async work
  // so onStop / saveDraftNow can await in-flight transcriptions.
  const onChunkReady = (chunkUri: string) => {
    const p = processChunk(chunkUri).finally(() => pendingChunksRef.current.delete(p));
    pendingChunksRef.current.add(p);
  };

  const onRecordPress = async () => {
    mediumTap();
    try {
      if (status === 'idle') {
        const key = await getGroqKey();
        if (!key) {
          Alert.alert('API Key Missing', 'Add your free Groq API key in Settings to enable transcription.', [
            { text: 'Open Settings', onPress: () => router.push('/settings') },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        groqKeyRef.current = key;

        const online = await checkConnectivity(key);
        const beginRecording = async (audioOnly: boolean) => {
          if (audioOnly) {
            audioOnlyRef.current = true;
            setAudioOnlyMode(true);
          }
          const id = newId();
          sermonIdRef.current = id;
          recordingStartedAtRef.current = Date.now();
          const dir = await ensureAudioDir(id);
          const recorder = new SermonRecorder(dir);
          await recorder.start(onChunkReady);
          recorderRef.current = recorder;
          setStatus('recording');
          startTicker();
          autoSaveRef.current = setInterval(() => void autoSaveDraft(), 5 * 60 * 1000);
          void logEvent('recording_started', { audioOnly });
        };

        if (!online) {
          Alert.alert(
            'No Internet Connection',
            'You can still record audio. Transcription will be available later via Re-transcribe.',
            [
              { text: 'Record Audio Only', onPress: () => void beginRecording(true).catch((e) => {
                setError(e instanceof Error ? e.message : String(e));
                setStatus('error');
              }) },
              { text: 'Cancel', style: 'cancel' },
            ],
          );
          return;
        }
        await beginRecording(false);
      } else if (status === 'recording') {
        await recorderRef.current?.pause();
        stopTicker();
        setStatus('paused');
        void logEvent('recording_paused');
      } else if (status === 'paused') {
        await recorderRef.current?.resume();
        setStatus('recording');
        startTicker();
        void logEvent('recording_resumed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      stopTicker();
    }
  };

  const onStop = async () => {
    if (status !== 'recording' && status !== 'paused') return;
    heavyTap();
    stopTicker();
    if (autoSaveRef.current) { clearInterval(autoSaveRef.current); autoSaveRef.current = null; }
    setStatus('processing');

    try {
      const result = await recorderRef.current?.stop();
      audioUrisRef.current = result?.uris ?? [];
      durationRef.current = result?.durationMs ?? 0;

      // The final sealed chunk's transcription is still in flight — wait for
      // it (bounded) so the sermon doesn't lose its last 30 seconds.
      setStep('transcribing');
      await waitForPendingChunks();

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
        createdAt: recordingStartedAtRef.current || Date.now(),
        title: outline.title,
        transcript,
        outline,
        scriptures,
        audioUris: audioUrisRef.current,
        durationMs: durationRef.current,
      };
      await saveSermon(sermon);
      setStatus('done');
      void logEvent('recording_completed', { durationMs: durationRef.current, chunks: chunkCountRef.current });
      allowLeaveRef.current = true;
      router.replace(`/sermon/${sermon.id}`);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err.message);
      setStatus('error');
      void logCrash(err, { phase: 'processing', step });
    }
  };

  const onDiscard = () => {
    Alert.alert('Discard recording?', 'You can save it as a draft to finish later.', [
      { text: 'Keep Recording', style: 'cancel' },
      { text: 'Save as Draft', onPress: () => void saveDraftNow() },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await discardRecording();
          allowLeaveRef.current = true;
          router.back();
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
                {'Recording will transcribe and outline\nyour sermon automatically.'}
              </Text>
              <Text style={[styles.limitHint, { color: t.textTertiary }]}>
                Free tier: ~2 hours of transcription per day
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
                  <Text style={styles.warningText}>Audio only mode — transcription paused</Text>
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
