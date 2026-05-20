import * as SecureStore from 'expo-secure-store';

const GROQ_KEY = 'sermonize.groqApiKey';
const BIBLE_API_KEY = 'sermonize.bibleApiKey';
const TRANSLATION_KEY = 'sermonize.bibleTranslation';

export async function getGroqKey(): Promise<string | null> {
  return SecureStore.getItemAsync(GROQ_KEY);
}

export async function setGroqKey(value: string): Promise<void> {
  await SecureStore.setItemAsync(GROQ_KEY, value);
}

export async function getBibleApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(BIBLE_API_KEY);
}

export async function setBibleApiKey(value: string): Promise<void> {
  await SecureStore.setItemAsync(BIBLE_API_KEY, value);
}

export async function getTranslation(): Promise<string> {
  const v = await SecureStore.getItemAsync(TRANSLATION_KEY);
  return v ?? 'web';
}

export async function setTranslation(value: string): Promise<void> {
  await SecureStore.setItemAsync(TRANSLATION_KEY, value);
}
