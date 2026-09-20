import type { Outline } from '../types';
import { RateLimitError } from './errors';
import { EMPTY_OUTLINE, OUTLINE_SYSTEM_PROMPT, parseOutlineJson, trimForOutline } from './outline';

/**
 * Extract a sermon outline with Google Gemini (Generative Language API). Gemini
 * Flash has a generous free tier, so this is Scribe's default outline engine.
 * Same prompt/parser as the other providers so output is consistent.
 */
const MODEL = 'gemini-2.0-flash';
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

export async function extractOutlineGemini(transcript: string, apiKey: string): Promise<Outline> {
  if (!apiKey) throw new Error('Gemini API key is not set. Add it in Settings.');
  if (!transcript.trim()) return EMPTY_OUTLINE;

  const body = {
    systemInstruction: { parts: [{ text: OUTLINE_SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Here is the sermon transcript. Produce the outline JSON:\n\n<transcript>\n${trimForOutline(transcript)}\n</transcript>`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  };

  const r = await fetch(GEMINI_URL(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text();
    if (r.status === 429) throw new RateLimitError(30000);
    throw new Error(`Gemini outline request failed (${r.status}): ${errText.slice(0, 300)}`);
  }

  const json = (await r.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('');
  return parseOutlineJson(text);
}
