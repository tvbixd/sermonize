import * as SecureStore from 'expo-secure-store';

const GROQ_KEY = 'scribe.groqApiKey';
const TRANSLATION_KEY = 'scribe.bibleTranslation';
const TRANSCRIPTION_MODE_KEY = 'scribe.transcriptionMode';

/**
 * 'groq'  — cloud transcription via the user's Groq key (best quality, has limits)
 * 'local' — on-device Whisper (no key, no limits, offline; needs model download)
 */
export type TranscriptionMode = 'groq' | 'local';

export async function getTranscriptionMode(): Promise<TranscriptionMode> {
  // On-device transcription is disabled for now — the app always uses the Groq
  // cloud API. (The local path is kept in the codebase but not user-selectable.)
  return 'groq';
}

export async function setTranscriptionMode(mode: TranscriptionMode): Promise<void> {
  await SecureStore.setItemAsync(TRANSCRIPTION_MODE_KEY, mode);
}

export async function getGroqKey(): Promise<string | null> {
  return SecureStore.getItemAsync(GROQ_KEY);
}

export async function setGroqKey(value: string): Promise<void> {
  await SecureStore.setItemAsync(GROQ_KEY, value);
}

export async function getTranslation(): Promise<string> {
  const v = await SecureStore.getItemAsync(TRANSLATION_KEY);
  return v ?? 'web';
}

export async function setTranslation(value: string): Promise<void> {
  await SecureStore.setItemAsync(TRANSLATION_KEY, value);
}
