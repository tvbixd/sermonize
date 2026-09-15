import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
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

// ── Persistent verse cache ───────────────────────────────────────────────────
// Resolved verses are cached to disk keyed by `${translation}::${reference}`, so
// common verses resolve instantly across app launches (and offline). All disk
// access is best-effort and guarded — a cache failure never affects a lookup.
const VERSE_CACHE_FILE = (FileSystem.documentDirectory ?? '') + 'verse-cache.json';
let verseCacheLoaded = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

async function ensureVerseCacheLoaded(): Promise<void> {
  if (verseCacheLoaded) return;
  verseCacheLoaded = true; // set first so a failure doesn't retry every lookup
  if (!FileSystem.documentDirectory) return;
  try {
    const info = await FileSystem.getInfoAsync(VERSE_CACHE_FILE);
    if (!info.exists) return;
    const raw = await FileSystem.readAsStringAsync(VERSE_CACHE_FILE);
    const obj = JSON.parse(raw) as Record<string, Scripture>;
    for (const [k, v] of Object.entries(obj)) {
      if (memoryCache.size >= CACHE_MAX) break;
      if (v && typeof v.reference === 'string' && !memoryCache.has(k)) memoryCache.set(k, v);
    }
  } catch {
    /* corrupt or unreadable cache — ignore, we'll rebuild it */
  }
}

function scheduleVerseCachePersist(): void {
  if (persistTimer || !FileSystem.documentDirectory) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const obj: Record<string, Scripture> = {};
      for (const [k, v] of memoryCache) obj[k] = v;
      void FileSystem.writeAsStringAsync(VERSE_CACHE_FILE, JSON.stringify(obj)).catch(() => undefined);
    } catch {
      /* ignore persist failures */
    }
  }, 3000);
}

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

/**
 * Tidy verse text coming from the Bible APIs: drop leading/inline verse
 * numbers left behind after HTML stripping, and repair missing spaces after
 * punctuation (e.g. "you,before" → "you, before", "apart;I" → "apart; I").
 */
export function cleanVerseText(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    // strip a leading verse number (optionally after an opening quote), keeping
    // the quote: "5“Before" → "“Before", "5Before" → "Before"
    .replace(/^(\s*["“'']?\s*)\d+\s*(?=[\p{L}"“''])/u, '$1')
    // repair missing space after punctuation when a letter/quote follows:
    // "you,before" → "you, before", "apart;I" → "apart; I"
    .replace(/([,;:.!?])(?=[\p{L}"“''])/gu, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function lookupViaLegacy(reference: string, translationId: string): Promise<Scripture> {
  const url = `${LEGACY_BASE}/${encodeURIComponent(reference)}?translation=${encodeURIComponent(translationId)}`;
  const r = await fetch(url);
  if (!r.ok) return { reference, translation: translationId.toUpperCase() };
  const json = (await r.json()) as { text?: string; reference?: string; translation_name?: string };
  const text = json.text ? cleanVerseText(json.text) : undefined;
  return {
    reference: json.reference ?? reference,
    text: text || undefined,
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

  const rawContent = passage?.content
    // Drop verse-number labels (<span class="v">5</span>) BEFORE stripping tags,
    // otherwise the number glues to the next word ("5Before").
    ?.replace(/<span[^>]*class="[^"]*\bv\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');

  const rawText = verse?.text || rawContent;
  const text = rawText ? cleanVerseText(rawText) : undefined;
  const ref = verse?.reference || passage?.reference || reference;

  return { reference: ref, text: text || undefined };
}

export async function lookupVerse(
  reference: string,
  translationId?: string,
): Promise<Scripture> {
  const tid = translationId ?? await getTranslation();
  const cacheKey = `${tid}::${reference}`;
  await ensureVerseCacheLoaded();
  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  const fetchOne = async (ref: string): Promise<Scripture> => {
    const entry = findTranslation(tid);
    let r: Scripture;
    if (entry?.source === 'apibible' && entry.bibleId) {
      r = await lookupViaApiBible(ref, entry.bibleId, BUNDLED_BIBLE_KEY);
      r.translation = entry.abbr || entry.label;
    } else if (tid.startsWith('apib-')) {
      r = await lookupViaApiBible(ref, tid.replace('apib-', ''), BUNDLED_BIBLE_KEY);
    } else {
      r = await lookupViaLegacy(ref, tid);
    }
    return r;
  };

  try {
    let result = await fetchOne(reference);

    // Chapter-only references ("1 Corinthians 14") sometimes return no text.
    // Fall back to the chapter's first verse so we show something instead of
    // "Verse text unavailable", while keeping the chapter as the label.
    if (!result.text && !/:\d/.test(reference)) {
      const firstVerse = await fetchOne(`${reference}:1`);
      if (firstVerse.text) result = { ...firstVerse, reference };
    }

    // Only cache hits with text — caching an empty result would pin a
    // transient API failure for the whole session.
    if (result.text) {
      if (memoryCache.size >= CACHE_MAX) {
        const oldest = memoryCache.keys().next().value!;
        memoryCache.delete(oldest);
      }
      memoryCache.set(cacheKey, result);
      scheduleVerseCachePersist();
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
