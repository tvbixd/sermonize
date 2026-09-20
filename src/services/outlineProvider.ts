import type { Outline } from '../types';
import { extractOutlineGemini } from './geminiOutline';
import { extractOutlineClaude } from './claudeOutline';
import { buildLocalOutline } from './localOutline';
import { getAnthropicKey, getGeminiKey } from '../storage/keys';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Build a sermon outline using the best available engine:
 *   Gemini (free tier, default) → Claude (if an Anthropic key is set) →
 *   on-device extractive fallback.
 * `aiUsed` is false when it fell back, so callers can tell the user.
 */
export async function generateOutline(
  transcript: string,
): Promise<{ outline: Outline; aiUsed: boolean }> {
  if (!transcript.trim()) return { outline: buildLocalOutline(transcript), aiUsed: false };

  const geminiKey = await getGeminiKey();
  if (geminiKey) {
    try {
      return { outline: await extractOutlineGemini(transcript, geminiKey), aiUsed: true };
    } catch {
      try {
        await delay(2000);
        return { outline: await extractOutlineGemini(transcript, geminiKey), aiUsed: true };
      } catch {
        // fall through to Claude / on-device
      }
    }
  }

  const anthropicKey = await getAnthropicKey();
  if (anthropicKey) {
    try {
      return { outline: await extractOutlineClaude(transcript, anthropicKey), aiUsed: true };
    } catch {
      // fall through to on-device
    }
  }

  return { outline: buildLocalOutline(transcript), aiUsed: false };
}
