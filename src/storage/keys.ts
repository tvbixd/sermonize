import * as SecureStore from 'expo-secure-store';

const DEEPGRAM_KEY = 'scribe.deepgramApiKey';
const ANTHROPIC_KEY = 'scribe.anthropicApiKey';
const GEMINI_KEY = 'scribe.geminiApiKey';
const TRANSLATION_KEY = 'scribe.bibleTranslation';
const ONBOARDED_KEY = 'scribe.onboarded';
const AVATAR_KEY = 'scribe.avatarUri';

/** Local file path of the user's profile picture (stored on device). */
export async function getAvatarUri(): Promise<string | null> {
  return SecureStore.getItemAsync(AVATAR_KEY);
}

export async function setAvatarUri(uri: string | null): Promise<void> {
  if (uri) await SecureStore.setItemAsync(AVATAR_KEY, uri);
  else await SecureStore.deleteItemAsync(AVATAR_KEY);
}

/** True once the user has finished onboarding (with or without an account), so
 *  guests aren't forced back through onboarding on every launch. */
export async function getOnboarded(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ONBOARDED_KEY)) === '1';
}

export async function setOnboarded(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDED_KEY, '1');
}

/** Optional Deepgram key. When set, transcription uses Deepgram (higher
 *  real-room accuracy) instead of Groq Whisper. Groq is still used for outlines. */
export async function getDeepgramKey(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(DEEPGRAM_KEY);
  if (stored) return stored;
  // Convenience fallback for testing: an EXPO_PUBLIC_DEEPGRAM_KEY baked in via a
  // (gitignored) .env or an EAS env var. Settings takes precedence.
  const env = process.env.EXPO_PUBLIC_DEEPGRAM_KEY;
  return env && env.trim() ? env.trim() : null;
}

export async function setDeepgramKey(value: string): Promise<void> {
  const v = value.trim();
  if (v) await SecureStore.setItemAsync(DEEPGRAM_KEY, v);
  else await SecureStore.deleteItemAsync(DEEPGRAM_KEY);
}

/** Optional Anthropic (Claude) key. When set, outlines use Claude (higher
 *  quality, no free-tier daily cap) instead of Groq's Llama. */
export async function getAnthropicKey(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(ANTHROPIC_KEY);
  if (stored) return stored;
  const env = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
  return env && env.trim() ? env.trim() : null;
}

export async function setAnthropicKey(value: string): Promise<void> {
  const v = value.trim();
  if (v) await SecureStore.setItemAsync(ANTHROPIC_KEY, v);
  else await SecureStore.deleteItemAsync(ANTHROPIC_KEY);
}

/** Optional Google Gemini key (free tier). When set, outlines use Gemini —
 *  the default free outline engine. Falls back to the bundled key. */
export async function getGeminiKey(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(GEMINI_KEY);
  if (stored) return stored;
  const env = process.env.EXPO_PUBLIC_GEMINI_KEY;
  return env && env.trim() ? env.trim() : null;
}

export async function setGeminiKey(value: string): Promise<void> {
  const v = value.trim();
  if (v) await SecureStore.setItemAsync(GEMINI_KEY, v);
  else await SecureStore.deleteItemAsync(GEMINI_KEY);
}

export async function getTranslation(): Promise<string> {
  const v = await SecureStore.getItemAsync(TRANSLATION_KEY);
  return v ?? 'web';
}

export async function setTranslation(value: string): Promise<void> {
  await SecureStore.setItemAsync(TRANSLATION_KEY, value);
}
