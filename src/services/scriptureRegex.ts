/**
 * Detect Bible scripture references in free text.
 *
 * Handles patterns like:
 *   "John 3:16", "John 3:16-17", "1 Corinthians 13:4-7",
 *   "1 Cor 13:4", "Psalm 23", "Rom 8:28", "II Timothy 3:16"
 *
 * Returns canonicalized references (book name expanded, single space, "1 " prefix
 * for numbered books) so duplicates dedupe properly.
 */

type BookEntry = { canonical: string; aliases: string[] };

// Order matters for the regex alternation: longer/more specific aliases first
// (handled below by sorting by length desc).
const BOOKS: BookEntry[] = [
  { canonical: 'Genesis', aliases: ['Genesis', 'Gen'] },
  { canonical: 'Exodus', aliases: ['Exodus', 'Exo', 'Ex'] },
  { canonical: 'Leviticus', aliases: ['Leviticus', 'Lev'] },
  { canonical: 'Numbers', aliases: ['Numbers', 'Num'] },
  { canonical: 'Deuteronomy', aliases: ['Deuteronomy', 'Deut', 'Deu'] },
  { canonical: 'Joshua', aliases: ['Joshua', 'Josh'] },
  { canonical: 'Judges', aliases: ['Judges', 'Judg'] },
  { canonical: 'Ruth', aliases: ['Ruth'] },
  { canonical: '1 Samuel', aliases: ['1 Samuel', '1 Sam', '1Samuel', '1Sam', 'I Samuel', 'First Samuel'] },
  { canonical: '2 Samuel', aliases: ['2 Samuel', '2 Sam', '2Samuel', '2Sam', 'II Samuel', 'Second Samuel'] },
  { canonical: '1 Kings', aliases: ['1 Kings', '1Kings', '1 Kgs', 'I Kings', 'First Kings'] },
  { canonical: '2 Kings', aliases: ['2 Kings', '2Kings', '2 Kgs', 'II Kings', 'Second Kings'] },
  { canonical: '1 Chronicles', aliases: ['1 Chronicles', '1 Chron', '1 Chr', 'I Chronicles'] },
  { canonical: '2 Chronicles', aliases: ['2 Chronicles', '2 Chron', '2 Chr', 'II Chronicles'] },
  { canonical: 'Ezra', aliases: ['Ezra'] },
  { canonical: 'Nehemiah', aliases: ['Nehemiah', 'Neh'] },
  { canonical: 'Esther', aliases: ['Esther', 'Est'] },
  { canonical: 'Job', aliases: ['Job'] },
  { canonical: 'Psalms', aliases: ['Psalms', 'Psalm', 'Psa', 'Ps'] },
  { canonical: 'Proverbs', aliases: ['Proverbs', 'Prov', 'Pro'] },
  { canonical: 'Ecclesiastes', aliases: ['Ecclesiastes', 'Eccl', 'Ecc'] },
  { canonical: 'Song of Solomon', aliases: ['Song of Solomon', 'Song of Songs', 'SOS', 'Song'] },
  { canonical: 'Isaiah', aliases: ['Isaiah', 'Isa'] },
  { canonical: 'Jeremiah', aliases: ['Jeremiah', 'Jer'] },
  { canonical: 'Lamentations', aliases: ['Lamentations', 'Lam'] },
  { canonical: 'Ezekiel', aliases: ['Ezekiel', 'Ezek', 'Eze'] },
  { canonical: 'Daniel', aliases: ['Daniel', 'Dan'] },
  { canonical: 'Hosea', aliases: ['Hosea', 'Hos'] },
  { canonical: 'Joel', aliases: ['Joel'] },
  { canonical: 'Amos', aliases: ['Amos'] },
  { canonical: 'Obadiah', aliases: ['Obadiah', 'Obad'] },
  { canonical: 'Jonah', aliases: ['Jonah'] },
  { canonical: 'Micah', aliases: ['Micah', 'Mic'] },
  { canonical: 'Nahum', aliases: ['Nahum', 'Nah'] },
  { canonical: 'Habakkuk', aliases: ['Habakkuk', 'Hab'] },
  { canonical: 'Zephaniah', aliases: ['Zephaniah', 'Zeph'] },
  { canonical: 'Haggai', aliases: ['Haggai', 'Hag'] },
  { canonical: 'Zechariah', aliases: ['Zechariah', 'Zech'] },
  { canonical: 'Malachi', aliases: ['Malachi', 'Mal'] },
  { canonical: 'Matthew', aliases: ['Matthew', 'Matt', 'Mat'] },
  { canonical: 'Mark', aliases: ['Mark'] },
  { canonical: 'Luke', aliases: ['Luke'] },
  { canonical: 'John', aliases: ['John', 'Jn'] },
  { canonical: 'Acts', aliases: ['Acts'] },
  { canonical: 'Romans', aliases: ['Romans', 'Rom'] },
  { canonical: '1 Corinthians', aliases: ['1 Corinthians', '1 Cor', '1Cor', 'I Corinthians', 'First Corinthians'] },
  { canonical: '2 Corinthians', aliases: ['2 Corinthians', '2 Cor', '2Cor', 'II Corinthians', 'Second Corinthians'] },
  { canonical: 'Galatians', aliases: ['Galatians', 'Gal'] },
  { canonical: 'Ephesians', aliases: ['Ephesians', 'Eph'] },
  { canonical: 'Philippians', aliases: ['Philippians', 'Phil'] },
  { canonical: 'Colossians', aliases: ['Colossians', 'Col'] },
  { canonical: '1 Thessalonians', aliases: ['1 Thessalonians', '1 Thess', '1 Thes', 'I Thessalonians'] },
  { canonical: '2 Thessalonians', aliases: ['2 Thessalonians', '2 Thess', '2 Thes', 'II Thessalonians'] },
  { canonical: '1 Timothy', aliases: ['1 Timothy', '1 Tim', '1Tim', 'I Timothy', 'First Timothy'] },
  { canonical: '2 Timothy', aliases: ['2 Timothy', '2 Tim', '2Tim', 'II Timothy', 'Second Timothy'] },
  { canonical: 'Titus', aliases: ['Titus'] },
  { canonical: 'Philemon', aliases: ['Philemon', 'Philem', 'Phlm'] },
  { canonical: 'Hebrews', aliases: ['Hebrews', 'Heb'] },
  { canonical: 'James', aliases: ['James', 'Jas'] },
  { canonical: '1 Peter', aliases: ['1 Peter', '1 Pet', '1Pet', 'I Peter', 'First Peter'] },
  { canonical: '2 Peter', aliases: ['2 Peter', '2 Pet', '2Pet', 'II Peter', 'Second Peter'] },
  { canonical: '1 John', aliases: ['1 John', '1Jn', 'I John', 'First John'] },
  { canonical: '2 John', aliases: ['2 John', '2Jn', 'II John', 'Second John'] },
  { canonical: '3 John', aliases: ['3 John', '3Jn', 'III John', 'Third John'] },
  { canonical: 'Jude', aliases: ['Jude'] },
  { canonical: 'Revelation', aliases: ['Revelation', 'Rev', 'Apocalypse'] },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ALIAS_TO_CANONICAL = new Map<string, string>();
for (const b of BOOKS) {
  for (const a of b.aliases) ALIAS_TO_CANONICAL.set(a.toLowerCase(), b.canonical);
}

const ALL_ALIASES = BOOKS.flatMap((b) => b.aliases).sort((a, b) => b.length - a.length);
const BOOK_PATTERN = ALL_ALIASES.map(escapeRegex).join('|');

// Spoken number words \u2192 digits, so references dictated aloud resolve \u2014
// "first Peter two seven" \u2192 1 Peter 2:7, "Matthew three seven fifteen" \u2192
// Matthew 3:7-15. These only ever match right after a book name + chapter, so
// ordinary words like "one"/"two" in normal speech never trigger a reference.
const ONES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const NUM_WORDS: Record<string, number> = { ...TENS, ...ONES };
const byLenDesc = (a: string, b: string) => b.length - a.length;
const ONES_P = Object.keys(ONES).sort(byLenDesc).join('|');
const TENS_P = Object.keys(TENS).sort(byLenDesc).join('|');
// A number: raw digits, OR tens (optionally + ones: "twenty one"), OR a single
// ones/teens word.
const NUM = `(?:\\d{1,3}|(?:${TENS_P})(?:[\\s-]+(?:${ONES_P}))?|(?:${ONES_P}))`;

function parseNum(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  let total = 0;
  for (const w of s.split(/[\s-]+/)) total += NUM_WORDS[w] ?? 0;
  return total > 0 ? total : null;
}

// Match a reference in written or spoken form. Preachers SAY "Matthew chapter 12
// verse 24" or "Matthew three seven fifteen", which Whisper transcribes
// literally, so besides "Matthew 12:24" we accept the "chapter"/"verse" words,
// spoken number words, and bare space-separated numbers (<book> <ch> <v> [<end>]).
const REF_REGEX = new RegExp(
  `\\b(${BOOK_PATTERN})\\.?\\s*(?:chapters?\\s+)?(${NUM})` +
    `(?:(?:\\s*[:.]\\s*|\\s+(?:verses?|vss?|vv?)\\.?\\s+|\\s+)(${NUM})` +
    `(?:\\s*(?:[-\u2013]|to|through|and|,)?\\s*(${NUM}))?)?`,
  'gi',
);

/** Build the canonical reference ("1 Peter 2:7") from a REF_REGEX match. */
function refFromMatch(m: RegExpMatchArray): string | null {
  const canonical = ALIAS_TO_CANONICAL.get(m[1].toLowerCase());
  if (!canonical) return null;
  const chapter = parseNum(m[2]);
  if (chapter == null) return null;
  const verse = parseNum(m[3]);
  const endVerse = parseNum(m[4]);
  let ref = `${canonical} ${chapter}`;
  if (verse != null) {
    ref += `:${verse}`;
    if (endVerse != null && endVerse > verse) ref += `-${endVerse}`;
  }
  return ref;
}

export function findScriptureReferences(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const m of text.matchAll(REF_REGEX)) {
    const ref = refFromMatch(m);
    if (ref) found.add(ref);
  }
  return [...found];
}

export function canonicalizeReference(input: string): string | null {
  const matches = findScriptureReferences(input);
  return matches[0] ?? null;
}

export type ScriptureMatch = {
  start: number; // index in the source text where the spoken reference begins
  end: number; // index just past the spoken reference
  raw: string; // the matched text as spoken ("Matthew chapter 12 verse 24")
  canonical: string; // normalized reference ("Matthew 12:24")
};

/**
 * Like `findScriptureReferences`, but returns each match's position and its raw
 * (spoken) span alongside the canonical form — so a live transcript can replace
 * the spoken words in place with the clean "Book 12:24" and highlight it.
 */
export function findScriptureMatches(text: string): ScriptureMatch[] {
  if (!text) return [];
  const out: ScriptureMatch[] = [];
  for (const m of text.matchAll(REF_REGEX)) {
    const canonical = refFromMatch(m);
    if (!canonical) continue;
    const start = m.index ?? 0;
    out.push({ start, end: start + m[0].length, raw: m[0], canonical });
  }
  return out;
}
