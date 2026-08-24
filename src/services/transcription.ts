import { transcribeAudio } from './whisper';

/**
 * Transcribe audio chunks. Currently always uses Groq's hosted Whisper.
 * (On-device transcription was removed — see FUTURE.md for the revisit plan.)
 */
export async function transcribeChunks(uris: string[], groqKey: string): Promise<string> {
  return transcribeAudio(uris, groqKey);
}
