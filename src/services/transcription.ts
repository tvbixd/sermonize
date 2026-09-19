import { transcribeAudio } from './whisper';
import { transcribeAudioDeepgram } from './deepgram';
import { getDeepgramKey } from '../storage/keys';

/**
 * Transcribe audio chunks. Uses Deepgram (Nova-3, better real-room accuracy +
 * Bible-name keyterm boosting) when a Deepgram key is available, otherwise falls
 * back to Groq's hosted Whisper. Outlines still use Groq's LLM either way.
 */
export async function transcribeChunks(uris: string[], groqKey: string): Promise<string> {
  const deepgramKey = await getDeepgramKey();
  if (deepgramKey) return transcribeAudioDeepgram(uris, deepgramKey);
  return transcribeAudio(uris, groqKey);
}
