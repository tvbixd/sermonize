import { getTranscriptionMode } from '@/storage/keys';
import { transcribeLocal } from './localWhisper';
import { transcribeAudio as transcribeViaGroq } from './whisper';

/**
 * Transcribe audio chunks using whichever engine the user has selected.
 * `mode` can be passed to avoid re-reading the preference per chunk during a
 * recording session; otherwise it's looked up.
 */
export async function transcribeChunks(
  uris: string[],
  groqKey: string,
  mode?: 'groq' | 'local',
): Promise<string> {
  const m = mode ?? (await getTranscriptionMode());
  if (m === 'local') {
    const parts: string[] = [];
    for (const uri of uris) {
      const text = await transcribeLocal(uri);
      if (text) parts.push(text);
    }
    return parts.join('\n\n');
  }
  return transcribeViaGroq(uris, groqKey);
}
