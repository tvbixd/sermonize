import { transcribeAudioDeepgram } from './deepgram';
import { getDeepgramKey } from '../storage/keys';

/**
 * Transcribe audio chunks with Deepgram (Nova-3 + Bible-name keyterm boosting).
 * The key comes from Settings or the bundled EXPO_PUBLIC_DEEPGRAM_KEY.
 */
export async function transcribeChunks(uris: string[]): Promise<string> {
  const key = await getDeepgramKey();
  if (!key) throw new Error('No transcription key configured. Add a Deepgram key in Settings.');
  return transcribeAudioDeepgram(uris, key);
}
