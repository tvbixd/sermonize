import type { Outline } from '../types';

/**
 * Shared sermon-outline prompt + JSON parsing, used by the AI outline providers
 * (Claude). Kept provider-agnostic so any model can reuse the same schema.
 */

export const OUTLINE_SYSTEM_PROMPT = `You are an expert sermon-note assistant. You receive a raw transcript of a sermon (which may contain transcription errors and disfluencies) and produce a clean, structured outline.

Your output MUST be a single JSON object matching this exact schema — no prose, no markdown fences, no commentary outside the JSON:

{
  "title": string,           // 3-8 word title capturing the sermon's central message
  "theme": string,           // one short sentence stating the central theme
  "summary": string,         // 2-4 sentence summary of the whole sermon
  "points": [                // 2-7 main points in the order the preacher made them
    {
      "heading": string,                // the main point as a clear, complete sentence
      "subPoints": string[],            // 0-5 supporting bullets, each a complete thought
      "scriptures": string[]            // any Bible references cited under this point, e.g. "John 3:16", "1 Corinthians 13:4-7"
    }
  ]
}

Rules:
- Use the preacher's own emphasis and ordering — do not editorialize or invent material.
- Correct obvious transcription errors only when meaning is unambiguous.
- Normalize all scripture references to "Book Chapter:Verse" or "Book Chapter:Verse-Verse" (e.g. "John 3:16", "Romans 8:28", "1 Corinthians 13:4-7"). Use full book names. For numbered books use "1 ", "2 ", or "3 " prefix.
- Use ONLY the chapter and verse the preacher actually stated. If only a chapter was given (e.g. "Matthew 12"), write "Matthew 12" with NO verse — never invent or guess a verse number. Do not add scripture references the preacher did not cite.
- If the transcript is too short or unclear to outline, still return valid JSON with the best title/theme/summary you can and an empty points array.
- Output ONLY the JSON object. No code fences. No leading or trailing text.`;

export const EMPTY_OUTLINE: Outline = {
  title: 'Untitled Sermon',
  theme: '',
  summary: '',
  points: [],
};

// Long transcripts are trimmed to keep the request within model context limits.
// We keep the opening (intro/theme/early points) and the closing (conclusion) —
// the parts that carry the outline's shape.
const MAX_OUTLINE_CHARS = 24000;

export function trimForOutline(t: string): string {
  if (t.length <= MAX_OUTLINE_CHARS) return t;
  const head = Math.floor(MAX_OUTLINE_CHARS * 0.65);
  const tail = MAX_OUTLINE_CHARS - head;
  return (
    t.slice(0, head) +
    '\n\n[…middle portion omitted for length…]\n\n' +
    t.slice(t.length - tail)
  );
}

export function parseOutlineJson(raw: string): Outline {
  const cleaned = stripCodeFence(raw);
  try {
    return validateOutline(JSON.parse(cleaned));
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return validateOutline(JSON.parse(cleaned.slice(start, end + 1)));
      } catch {
        // fall through
      }
    }
    return { ...EMPTY_OUTLINE, summary: raw.slice(0, 500) };
  }
}

function stripCodeFence(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function validateOutline(obj: unknown): Outline {
  const o = obj as Partial<Outline> & Record<string, unknown>;
  return {
    title: typeof o.title === 'string' && o.title.trim() ? o.title.trim() : 'Untitled Sermon',
    theme: typeof o.theme === 'string' ? o.theme : '',
    summary: typeof o.summary === 'string' ? o.summary : '',
    points: Array.isArray(o.points)
      ? o.points.map((p) => {
          const pp = p as Record<string, unknown>;
          return {
            heading: typeof pp.heading === 'string' ? pp.heading : '',
            subPoints: Array.isArray(pp.subPoints)
              ? pp.subPoints.filter((x): x is string => typeof x === 'string')
              : [],
            scriptures: Array.isArray(pp.scriptures)
              ? pp.scriptures.filter((x): x is string => typeof x === 'string')
              : [],
          };
        })
      : [],
  };
}
