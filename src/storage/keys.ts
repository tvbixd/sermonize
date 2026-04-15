import * as SecureStore from 'expo-secure-store';

const OPENAI_KEY = 'sermonize.openaiApiKey';
const ANTHROPIC_KEY = 'sermonize.anthropicApiKey';
const TRANSLATION_KEY = 'sermonize.bibleTranslation';

export async function getOpenAiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(OPENAI_KEY);
}

export async function setOpenAiKey(value: string): Promise<void> {
  await SecureStore.setItemAsync(OPENAI_KEY, value);
}

export async function getAnthropicKey(): Promise<string | null> {
  return SecureStore.getItemAsync(ANTHROPIC_KEY);
}

export async function setAnthropicKey(value: string): Promise<void> {
  await SecureStore.setItemAsync(ANTHROPIC_KEY, value);
}

export async function getTranslation(): Promise<string> {
  const v = await SecureStore.getItemAsync(TRANSLATION_KEY);
  return v ?? 'web';
}

export async function setTranslation(value: string): Promise<void> {
  await SecureStore.setItemAsync(TRANSLATION_KEY, value);
}
