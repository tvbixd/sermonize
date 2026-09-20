import type { Outline } from '../types';
import { extractOutline } from './outline';
import { extractOutlineClaude } from './claudeOutline';
import { buildLocalOutline } from './localOutline';
import { getAnthropicKey, getGroqKey } from '../storage/keys';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Build a sermon outline using the best available engine:
 *   Claude (if an Anthropic key is set) → Groq Llama → on-device extractive.
 * `aiUsed` is false when it fell back to the on-device outline, so callers can
 * tell the user their AI outline didn't generate (and offer Regenerate).
 */
export async function generateOutline(
  transcript: string,
): Promise<{ outline: Outline; aiUsed: boolean }> {
  if (!transcript.trim()) return { outline: buildLocalOutline(transcript), aiUsed: false };

  const anthropicKey = await getAnthropicKey();
  if (anthropicKey) {
    try {
      return { outline: await extractOutlineClaude(transcript, anthropicKey), aiUsed: true };
    } catch {
      // fall through to Groq / local
    }
  }

  const groqKey = await getGroqKey();
  if (groqKey) {
    try {
      return { outline: await extractOutline(transcript, groqKey), aiUsed: true };
    } catch {
      // The Groq free tier often needs a moment after a busy session — retry once.
      try {
        await delay(2500);
        return { outline: await extractOutline(transcript, groqKey), aiUsed: true };
      } catch {
        // fall through to local
      }
    }
  }

  return { outline: buildLocalOutline(transcript), aiUsed: false };
}
