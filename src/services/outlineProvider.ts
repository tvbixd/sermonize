import type { Outline } from '../types';
import { extractOutlineClaude } from './claudeOutline';
import { buildLocalOutline } from './localOutline';
import { getAnthropicKey } from '../storage/keys';

/**
 * Build a sermon outline: Claude (Anthropic key from Settings or bundled
 * EXPO_PUBLIC_ANTHROPIC_KEY) → on-device extractive fallback.
 * `aiUsed` is false when it fell back, so callers can tell the user.
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
      // one retry — transient errors happen
      try {
        await new Promise((r) => setTimeout(r, 2000));
        return { outline: await extractOutlineClaude(transcript, anthropicKey), aiUsed: true };
      } catch {
        // fall through to on-device
      }
    }
  }

  return { outline: buildLocalOutline(transcript), aiUsed: false };
}
