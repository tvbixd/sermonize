import type { Outline } from '../types';
import { RateLimitError } from './errors';
import { EMPTY_OUTLINE, OUTLINE_SYSTEM_PROMPT, parseOutlineJson, trimForOutline } from './outline';

/**
 * Extract a sermon outline with Anthropic's Claude (Messages API). Higher-quality
 * structured outlines than the free Groq Llama tier, and no restrictive free-tier
 * daily token cap. Same prompt/parser as the Groq path so output is consistent.
 */
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001'; // cheap + strong for structured JSON

export async function extractOutlineClaude(transcript: string, apiKey: string): Promise<Outline> {
  if (!apiKey) throw new Error('Anthropic API key is not set. Add it in Settings.');
  if (!transcript.trim()) return EMPTY_OUTLINE;

  const body = {
    model: MODEL,
    max_tokens: 2048,
    temperature: 0.2,
    system: OUTLINE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user' as const,
        content: `Here is the sermon transcript. Produce the outline JSON:\n\n<transcript>\n${trimForOutline(transcript)}\n</transcript>`,
      },
    ],
  };

  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      // Required for direct (non-server) client calls.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text();
    if (r.status === 429) throw new RateLimitError(30000);
    throw new Error(`Claude outline request failed (${r.status}): ${errText.slice(0, 300)}`);
  }

  const json = (await r.json()) as { content?: { type?: string; text?: string }[] };
  const text = json.content?.find((b) => b.type === 'text')?.text ?? json.content?.[0]?.text ?? '';
  return parseOutlineJson(text);
}
