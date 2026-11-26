import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/**
 * On-device transcription via Apple's Speech framework (SFSpeechRecognizer),
 * wrapped by expo-speech-recognition. Audio is transcribed entirely on the
 * iPhone — free, offline, and private (nothing leaves the device).
 *
 * It transcribes one audio FILE at a time (the recorder already emits short
 * ~15s chunks, which sit under Apple's per-request limit), and returns plain
 * transcript text — the same shape as the Deepgram provider, so it drops in
 * behind `transcribeChunks`.
 *
 * Accuracy is lower than Deepgram in a noisy room and there's no custom Bible
 * vocabulary, so callers keep Deepgram as a fallback.
 */

/** True only on iOS with on-device recognition actually available. */
export function isOnDeviceSpeechSupported(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
  } catch {
    return false;
  }
}

// Request Speech Recognition permission once, lazily, and remember the result.
let permissionPromise: Promise<boolean> | null = null;
function ensurePermission(): Promise<boolean> {
  if (!permissionPromise) {
    permissionPromise = (async () => {
      try {
        const current = await ExpoSpeechRecognitionModule.getSpeechRecognizerPermissionsAsync();
        if (current.granted) return true;
        const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        return !!res.granted;
      } catch {
        return false;
      }
    })();
  }
  return permissionPromise;
}

const PER_FILE_TIMEOUT_MS = 30_000;

/** Transcribe a single audio file to its final text. Resolves with "" when the
 *  chunk had no recognizable speech; rejects only on a real engine error. */
function transcribeOneFile(uri: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let best = '';
    const subs: { remove(): void }[] = [];
    const cleanup = () => {
      for (const s of subs) { try { s.remove(); } catch { /* already gone */ } }
      clearTimeout(timer);
    };
    const finish = (text: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* not running */ }
      resolve(text.trim());
    };
    const fail = (e: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e instanceof Error ? e : new Error(String(e)));
    };

    const timer = setTimeout(() => finish(best), PER_FILE_TIMEOUT_MS);

    subs.push(
      ExpoSpeechRecognitionModule.addListener('result', (ev) => {
        const tx = ev?.results?.[0]?.transcript;
        if (typeof tx === 'string' && tx.trim()) best = tx;
      }),
    );
    subs.push(ExpoSpeechRecognitionModule.addListener('end', () => finish(best)));
    subs.push(
      ExpoSpeechRecognitionModule.addListener('error', (ev) => {
        // An empty/quiet chunk isn't a hard failure — keep whatever we have.
        if (ev?.error === 'no-speech') finish(best);
        else fail(new Error(ev?.message || ev?.error || 'speech recognition error'));
      }),
    );

    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        continuous: false,
        requiresOnDeviceRecognition: true,
        addsPunctuation: true,
        audioSource: { uri },
      });
    } catch (e) {
      fail(e);
    }
  });
}

/** Transcribe audio chunks on-device, in order, returning the joined text. */
export async function transcribeAudioApple(uris: string[]): Promise<string> {
  if (Platform.OS !== 'ios') throw new Error('On-device transcription is iOS-only');
  const granted = await ensurePermission();
  if (!granted) throw new Error('Speech Recognition permission denied');

  const parts: string[] = [];
  for (const uri of uris) {
    const text = await transcribeOneFile(uri);
    if (text) parts.push(text);
  }
  return parts.join(' ').trim();
}
