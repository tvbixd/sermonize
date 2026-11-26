import { Platform } from 'react-native';
import { transcribeAudioDeepgram } from './deepgram';
import { transcribeAudioApple, isOnDeviceSpeechSupported } from './appleSpeech';
import { getDeepgramKey, getTranscriptionMode } from '../storage/keys';

async function transcribeDeepgram(uris: string[]): Promise<string> {
  const key = await getDeepgramKey();
  if (!key) throw new Error('No transcription key configured. Add a Deepgram key in Settings.');
  return transcribeAudioDeepgram(uris, key);
}

/**
 * Transcribe audio chunks using the best available engine.
 *
 * Default on iOS is Apple's on-device recognition (free, offline, private); the
 * user can force Deepgram (higher accuracy in a noisy room) in Settings. On
 * Android, and whenever on-device isn't available, Deepgram is used.
 *
 * On-device always falls back to Deepgram if it errors or returns nothing, so a
 * quiet/garbled chunk never silently drops text when a Deepgram key is present.
 */
export async function transcribeChunks(uris: string[]): Promise<string> {
  const mode = await getTranscriptionMode(); // null => platform default
  const preferOnDevice =
    isOnDeviceSpeechSupported() && (mode === 'on-device' || (mode === null && Platform.OS === 'ios'));

  if (preferOnDevice) {
    try {
      const text = await transcribeAudioApple(uris);
      if (text.trim()) return text;
      // Empty on-device result — fall back to Deepgram if we can.
      const key = await getDeepgramKey();
      if (key) return transcribeAudioDeepgram(uris, key);
      return text; // nothing recognized, and no cloud fallback available
    } catch (e) {
      const key = await getDeepgramKey();
      if (key) return transcribeAudioDeepgram(uris, key);
      throw e;
    }
  }

  return transcribeDeepgram(uris);
}
