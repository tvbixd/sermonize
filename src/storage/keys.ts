import * as SecureStore from 'expo-secure-store';

const GROQ_KEY = 'scribe.groqApiKey';
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
