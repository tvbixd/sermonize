import type { Scripture } from '../types';
import { getBibleApiKey, getTranslation } from '../storage/keys';

const LEGACY_BASE = 'https://bible-api.com';
const APIBIBLE_BASE = 'https://api.scripture.api.bible/v1';

const memoryCache = new Map<string, Scripture>();

export type TranslationEntry = {
  id: string;
  label: string;
  abbr: string;
  source: 'legacy' | 'apibible';
  bibleId?: string;
};

export const LEGACY_TRANSLATIONS: TranslationEntry[] = [
  { id: 'web', label: 'World English Bible', abbr: 'WEB — modern, public domain', source: 'legacy' },
  { id: 'kjv', label: 'King James Version', abbr: 'KJV — classic English', source: 'legacy' },
  { id: 'bbe', label: 'Bible in Basic English', abbr: 'BBE — simplified vocabulary', source: 'legacy' },
  { id: 'oeb-us', label: 'Open English Bible', abbr: 'OEB — contemporary, open', source: 'legacy' },
  { id: 'almeida', label: 'Almeida (Portuguese)', abbr: 'Almeida — Português', source: 'legacy' },
  { id: 'rccv', label: 'Romanian Cornilescu', abbr: 'RCCV — Română', source: 'legacy' },
  { id: 'cherokee', label: 'Cherokee New Testament', abbr: 'Cherokee — ᏣᎳᎩ', source: 'legacy' },
  { id: 'clementine', label: 'Clementine Vulgate (Latin)', abbr: 'Latin — classic liturgical', source: 'legacy' },
];

export const APIBIBLE_TRANSLATIONS: TranslationEntry[] = [
  { id: 'apib-kjv', label: 'King James Version', abbr: 'KJV — classic English', source: 'apibible', bibleId: 'de4e12af7f28f599-02' },
  { id: 'apib-asv', label: 'American Standard Version', abbr: 'ASV — formal equivalent', source: 'apibible', bibleId: '06125adad2d5898a-01' },
  { id: 'apib-web', label: 'World English Bible', abbr: 'WEB — modern, public domain', source: 'apibible', bibleId: '9879dbb7cfe39e4d-04' },
  { id: 'apib-bsb', label: 'Berean Standard Bible', abbr: 'BSB — modern, accurate', source: 'apibible', bibleId: 'bba9f40183526463-01' },
  { id: 'apib-fbv', label: 'Free Bible Version', abbr: 'FBV — clear, contemporary', source: 'apibible', bibleId: '65eec8e0b60e656b-01' },
  { id: 'apib-rv09', label: 'Reina Valera 1909 (Spanish)', abbr: 'RV09 — Español clásico', source: 'apibible', bibleId: 'b32b9d1b64b4ef29-01' },
  { id: 'apib-lsg', label: 'Louis Segond 1910 (French)', abbr: 'LSG — Français', source: 'apibible', bibleId: 'f7e1a261921be049-01' },
  { id: 'apib-rvr60', label: 'Reina Valera 1960 (Spanish)', abbr: 'RVR60 — Español moderno', source: 'apibible', bibleId: '592420522e16049f-01' },
  { id: 'apib-tbov', label: 'Tagalog Bible', abbr: 'Tagalog — Filipino', source: 'apibible', bibleId: '684440f52fa2537a-01' },
  { id: 'apib-swahili', label: 'Swahili Union Version', abbr: 'SUV — Kiswahili', source: 'apibible', bibleId: '611f8eb23aec8f13-01' },
];

function findTranslation(id: string): TranslationEntry | undefined {
  return LEGACY_TRANSLATIONS.find((t) => t.id === id)
    ?? APIBIBLE_TRANSLATIONS.find((t) => t.id === id);
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
  const searchUrl = `${APIBIBLE_BASE}/bibles/${bibleId}/search?query=${encodeURIComponent(reference)}&limit=1`;
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
      const apiKey = await getBibleApiKey();
      if (apiKey) {
        result = await lookupViaApiBible(reference, entry.bibleId, apiKey);
        result.translation = entry.label;
      } else {
        result = await lookupViaLegacy(reference, 'web');
      }
    } else {
      result = await lookupViaLegacy(reference, tid);
    }

    memoryCache.set(cacheKey, result);
    return result;
  } catch {
    const fallback: Scripture = { reference, translation: tid.toUpperCase() };
    memoryCache.set(cacheKey, fallback);
    return fallback;
  }
}

export async function lookupVerses(
  references: string[],
  translationId?: string,
): Promise<Scripture[]> {
  const unique = [...new Set(references)];
  return Promise.all(unique.map((r) => lookupVerse(r, translationId)));
}
