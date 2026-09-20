import type { Outline } from '../types';
import { RateLimitError } from './whisper';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Llama 3.3 70B is excellent for structured-JSON outlining and free on Groq.
const MODEL = 'llama-3.3-70b-versatile';

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

// Groq's free tier caps tokens-per-minute, so a very long sermon transcript
// sent whole can trip a 429. ~24k characters ≈ 6k tokens stays safely under it.
// For longer sermons we keep the opening (intro/theme/early points) and the
// closing (conclusion) — the parts that carry the outline's shape.
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

/**
 * Extract a structured sermon outline from a transcript using Groq's free-tier
 * Llama 3.3 70B endpoint (OpenAI-compatible chat-completions API).
 */
export async function extractOutline(
  transcript: string,
  apiKey: string,
): Promise<Outline> {
  if (!apiKey) throw new Error('Groq API key is not set. Add it in Settings.');
  if (!transcript.trim()) return EMPTY_OUTLINE;

  const body = {
    model: MODEL,
    temperature: 0.2,
    max_tokens: 2048,
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: OUTLINE_SYSTEM_PROMPT },
      {
        role: 'user' as const,
        content: `Here is the sermon transcript. Produce the outline JSON:\n\n<transcript>\n${trimForOutline(transcript)}\n</transcript>`,
      },
    ],
  };

  const r = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text();
    if (r.status === 429) {
      const retryMatch = errText.match(/try again in (?:(\d+)m)?(\d+(?:\.\d+)?)s/i);
      const mins = retryMatch?.[1] ? parseInt(retryMatch[1], 10) : 0;
      const secs = retryMatch?.[2] ? parseFloat(retryMatch[2]) : 60;
      throw new RateLimitError(Math.ceil((mins * 60 + secs) * 1000));
    }
    throw new Error(`Groq outline request failed (${r.status}): ${errText.slice(0, 300)}`);
  }

  const json = (await r.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? '';
  return parseOutlineJson(content);
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
