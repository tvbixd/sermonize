import type { Scripture } from '../types';

const BASE = 'https://bible-api.com';

const memoryCache = new Map<string, Scripture>();

/**
 * Look up a scripture reference via bible-api.com (free, no key required).
 * Default translation: WEB (World English Bible).
 *
 * On any error, returns the reference with no text — callers should still
 * display the reference so the user isn't blocked by network issues.
 */
export async function lookupVerse(
  reference: string,
  translation = 'web',
): Promise<Scripture> {
  const cacheKey = `${translation}::${reference}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  const url = `${BASE}/${encodeURIComponent(reference)}?translation=${encodeURIComponent(translation)}`;
  try {
    const r = await fetch(url);
    if (!r.ok) {
      const fallback: Scripture = { reference, translation: translation.toUpperCase() };
      memoryCache.set(cacheKey, fallback);
      return fallback;
    }
    const json = (await r.json()) as { text?: string; reference?: string; translation_name?: string };
    const result: Scripture = {
      reference: json.reference ?? reference,
      text: json.text?.trim(),
      translation: json.translation_name ?? translation.toUpperCase(),
    };
    memoryCache.set(cacheKey, result);
    return result;
  } catch {
    const fallback: Scripture = { reference, translation: translation.toUpperCase() };
    memoryCache.set(cacheKey, fallback);
    return fallback;
  }
}

export async function lookupVerses(
  references: string[],
  translation = 'web',
): Promise<Scripture[]> {
  const unique = [...new Set(references)];
  return Promise.all(unique.map((r) => lookupVerse(r, translation)));
}
