import Constants from 'expo-constants';
import type { Scripture } from '../types';
import { getTranslation } from '../storage/keys';

const LEGACY_BASE = 'https://bible-api.com';
const APIBIBLE_ENDPOINTS = [
  'https://rest.api.bible/v1',
  'https://api.scripture.api.bible/v1',
];
const BUNDLED_BIBLE_KEY: string =
  (Constants.expoConfig?.extra?.apiBibleKey as string) || '';

const CACHE_MAX = 500;
const memoryCache = new Map<string, Scripture>();
let activeApiBibleBase: string | null = null;

export type TranslationEntry = {
  id: string;
  label: string;
  abbr: string;
  language: string;
  source: 'legacy' | 'apibible';
  bibleId?: string;
};

export const LEGACY_TRANSLATIONS: TranslationEntry[] = [
  { id: 'web', label: 'World English Bible', abbr: 'WEB', language: 'English', source: 'legacy' },
  { id: 'kjv', label: 'King James Version', abbr: 'KJV', language: 'English', source: 'legacy' },
  { id: 'bbe', label: 'Bible in Basic English', abbr: 'BBE', language: 'English', source: 'legacy' },
  { id: 'oeb-us', label: 'Open English Bible', abbr: 'OEB', language: 'English', source: 'legacy' },
  { id: 'almeida', label: 'Almeida (Portuguese)', abbr: 'Almeida', language: 'Portuguese', source: 'legacy' },
  { id: 'rccv', label: 'Romanian Cornilescu', abbr: 'RCCV', language: 'Romanian', source: 'legacy' },
  { id: 'cherokee', label: 'Cherokee New Testament', abbr: 'Cherokee', language: 'Cherokee', source: 'legacy' },
  { id: 'clementine', label: 'Clementine Vulgate', abbr: 'Clementine', language: 'Latin', source: 'legacy' },
];

export type ApiBibleVersion = {
  id: string;
  name: string;
  nameLocal: string;
  abbreviation: string;
  abbreviationLocal: string;
  description: string;
  language: {
    id: string;
    name: string;
    nameLocal: string;
  };
};

let cachedApiBibles: TranslationEntry[] | null = null;

export function getApiBibleKey(): string {
  return BUNDLED_BIBLE_KEY;
}

export async function fetchApiBibleTranslations(apiKey?: string): Promise<TranslationEntry[]> {
  if (cachedApiBibles) return cachedApiBibles;

  const key = apiKey || BUNDLED_BIBLE_KEY;
  let lastError = '';

  for (const base of APIBIBLE_ENDPOINTS) {
    try {
      const r = await fetch(`${base}/bibles`, {
        headers: { 'api-key': key },
      });

      if (r.status === 401 || r.status === 403) {
        lastError = `${base} rejected the key (${r.status})`;
        continue;
      }
      if (!r.ok) {
        lastError = `${base} returned error ${r.status}`;
        continue;
      }

      const json = await r.json() as { data?: ApiBibleVersion[] };
      const bibles = json.data ?? [];

      if (bibles.length === 0) {
        lastError = `${base} returned no translations`;
        continue;
      }

      activeApiBibleBase = base;

      cachedApiBibles = bibles.map((b) => ({
        id: `apib-${b.id}`,
        label: b.nameLocal || b.name,
        abbr: b.abbreviationLocal || b.abbreviation || '',
        language: b.language?.name || b.language?.nameLocal || 'Unknown',
        source: 'apibible' as const,
        bibleId: b.id,
      }));

      return cachedApiBibles;
    } catch {
      lastError = `Could not reach ${base}`;
      continue;
    }
  }

  throw new Error(lastError || 'Could not connect to API.Bible — check your internet connection.');
}

export function clearApiBibleCache(): void {
  cachedApiBibles = null;
  activeApiBibleBase = null;
}

/** Remove duplicate references, keeping the first (and preferring one that has
 *  resolved verse text over a bare reference). */
export function dedupeScriptures(list: Scripture[]): Scripture[] {
  const byRef = new Map<string, Scripture>();
  for (const s of list) {
    const key = s.reference.trim().toLowerCase().replace(/\s+/g, ' ');
    const existing = byRef.get(key);
    if (!existing) byRef.set(key, s);
    else if (!existing.text && s.text) byRef.set(key, s); // upgrade to one with text
  }
  return [...byRef.values()];
}

function findTranslation(id: string): TranslationEntry | undefined {
  return LEGACY_TRANSLATIONS.find((t) => t.id === id)
    ?? cachedApiBibles?.find((t) => t.id === id);
}

async function lookupViaLegacy(reference: string, translationId: string): Promise<Scripture> {
  const url = `${LEGACY_BASE}/${encodeURIComponent(reference)}?translation=${encodeURIComponent(translationId)}`;
  const r = await fetch(url);
  if (!r.ok) return { reference, translation: translationId.toUpperCase() };
  const json = (await r.json()) as { text?: string; reference?: string; translation_name?: string };
  return {
    reference: json.reference ?? reference,
    text: json.text?.trim(),
    translation: json.translation_name ?? translationId.toUpperCase(),
  };
}

async function lookupViaApiBible(reference: string, bibleId: string, apiKey: string): Promise<Scripture> {
  const base = activeApiBibleBase ?? APIBIBLE_ENDPOINTS[0];
  const searchUrl = `${base}/bibles/${bibleId}/search?query=${encodeURIComponent(reference)}&limit=1`;
  const r = await fetch(searchUrl, {
    headers: { 'api-key': apiKey },
  });
  if (!r.ok) return { reference };

  const json = await r.json() as {
    data?: {
      verses?: Array<{ reference?: string; text?: string }>;
      passages?: Array<{ reference?: string; content?: string }>;
    };
  };

  const verse = json.data?.verses?.[0];
  const passage = json.data?.passages?.[0];

  const text = verse?.text?.trim()
    || passage?.content?.replace(/<[^>]*>/g, '').trim();
  const ref = verse?.reference || passage?.reference || reference;

  return { reference: ref, text: text || undefined };
}

export async function lookupVerse(
  reference: string,
  translationId?: string,
): Promise<Scripture> {
  const tid = translationId ?? await getTranslation();
  const cacheKey = `${tid}::${reference}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  try {
    const entry = findTranslation(tid);
    let result: Scripture;

    if (entry?.source === 'apibible' && entry.bibleId) {
      result = await lookupViaApiBible(reference, entry.bibleId, BUNDLED_BIBLE_KEY);
      result.translation = entry.abbr || entry.label;
    } else if (tid.startsWith('apib-')) {
      const bibleId = tid.replace('apib-', '');
      result = await lookupViaApiBible(reference, bibleId, BUNDLED_BIBLE_KEY);
    } else {
      result = await lookupViaLegacy(reference, tid);
    }

    // Only cache hits with text — caching an empty result would pin a
    // transient API failure for the whole session.
    if (result.text) {
      if (memoryCache.size >= CACHE_MAX) {
        const oldest = memoryCache.keys().next().value!;
        memoryCache.delete(oldest);
      }
      memoryCache.set(cacheKey, result);
    }
    return result;
  } catch {
    return { reference, translation: tid.toUpperCase() };
  }
}

export async function lookupVerses(
  references: string[],
  translationId?: string,
): Promise<Scripture[]> {
  const unique = [...new Set(references)];
  return Promise.all(unique.map((r) => lookupVerse(r, translationId)));
}
