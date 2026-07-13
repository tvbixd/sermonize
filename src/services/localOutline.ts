import type { Outline } from '../types';
import { findScriptureReferences } from './scriptureRegex';

/**
 * Build a sermon outline from a transcript with NO AI / no API — purely on
 * device. It won't match an LLM's polish, but it produces a genuinely useful
 * structure: a theme, a short summary, and points anchored to the scriptures
 * the preacher actually cited.
 *
 * Strategy: split into sentences, find scripture references and their
 * positions, and turn each cited passage into a point whose heading is the
 * sentence around the citation.
 */

const FILLER_OPENERS =
  /^(and |so |but |now |well |you know |i mean |um |uh |okay |alright |right |see )/i;

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function cleanSentence(s: string): string {
  let out = s.trim();
  // Strip a couple of leading filler words for a tidier heading.
  for (let i = 0; i < 2; i++) out = out.replace(FILLER_OPENERS, '').trim();
  out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

function truncateWords(s: string, maxWords: number): string {
  const words = s.split(' ');
  if (words.length <= maxWords) return s;
  return words.slice(0, maxWords).join(' ') + '…';
}

export function buildLocalOutline(transcript: string): Outline {
  const text = transcript.trim();
  if (!text) {
    return { title: 'Untitled Sermon', theme: '', summary: '', points: [] };
  }

  const sentences = splitSentences(text);

  // Map each sentence to the scripture references it contains.
  const withRefs = sentences.map((s) => ({ sentence: s, refs: findScriptureReferences(s) }));

  // Summary: the first 2 substantial sentences.
  const substantial = sentences.filter((s) => s.split(' ').length >= 5);
  const summary = substantial.slice(0, 2).join(' ');

  // Theme: the most complete of the first few sentences.
  const theme = truncateWords(cleanSentence(substantial[0] ?? sentences[0] ?? ''), 20);

  // Points: one per sentence that cites scripture, in order, deduped by ref set.
  const points: Outline['points'] = [];
  const seenRefKeys = new Set<string>();
  for (const { sentence, refs } of withRefs) {
    if (refs.length === 0) continue;
    const key = refs.slice().sort().join('|');
    if (seenRefKeys.has(key)) continue;
    seenRefKeys.add(key);
    points.push({
      heading: truncateWords(cleanSentence(sentence), 16),
      subPoints: [],
      scriptures: refs,
    });
    if (points.length >= 8) break;
  }

  // If the preacher cited no scripture, fall back to evenly-sampled sentences
  // as rough section headings so there's still an outline.
  if (points.length === 0 && substantial.length > 0) {
    const count = Math.min(4, substantial.length);
    const stride = Math.max(1, Math.floor(substantial.length / count));
    for (let i = 0; i < count; i++) {
      const s = substantial[i * stride];
      if (s) points.push({ heading: truncateWords(cleanSentence(s), 16), subPoints: [], scriptures: [] });
    }
  }

  // Title: prefer the dominant scripture, else the theme, else a dated fallback.
  const allRefs = findScriptureReferences(text);
  const title = allRefs.length
    ? `Sermon on ${allRefs[0]}`
    : truncateWords(cleanSentence(substantial[0] ?? 'Sermon Notes'), 8);

  return { title, theme, summary, points };
}
