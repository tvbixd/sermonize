import * as FileSystem from 'expo-file-system/legacy';
import { BOOK_NAMES } from './scriptureRegex';
import { NetworkError, RateLimitError } from './errors';

/**
 * Transcribe audio via Deepgram's pre-recorded API (Nova-3). Higher real-room
 * accuracy in a live room, and we pass every Bible book name as a
 * `keyterm` so hard names ("Habakkuk", "Philippians") are recognized — which
 * directly improves downstream scripture detection.
 *
 * Returns plain transcript text so it's a drop-in transcription provider.
 */
const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen';
const MODEL = 'nova-3';

function buildUrl(): string {
  const params = new URLSearchParams({
    model: MODEL,
    smart_format: 'true',
    punctuate: 'true',
  });
  for (const name of BOOK_NAMES) params.append('keyterm', name);
  return `${DEEPGRAM_URL}?${params.toString()}`;
}

function mimeTypeFor(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return 'audio/webm';
    case 'ogg':
      return 'audio/ogg';
    default:
      return 'application/octet-stream';
  }
}

export async function transcribeAudioDeepgram(audioUris: string[], apiKey: string): Promise<string> {
  if (!apiKey) throw new Error('Deepgram API key is not set. Add it in Settings.');
  if (audioUris.length === 0) return '';

  const url = buildUrl();
  const parts: string[] = [];
  for (const uri of audioUris) {
    const text = await transcribeOne(url, uri, apiKey);
    if (text) parts.push(text.trim());
  }
  return parts.join(' ');
}

async function transcribeOne(url: string, uri: string, apiKey: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error(`Audio file missing: ${uri}`);

  const result = await retryWithBackoff(async () => {
    const r = await FileSystem.uploadAsync(url, uri, {
      httpMethod: 'POST',
      // Deepgram takes the raw audio bytes as the body (not multipart).
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': mimeTypeFor(uri),
      },
    });
    if (r.status < 200 || r.status >= 300) {
      throw new Error(`Deepgram transcription failed (${r.status}): ${r.body}`);
    }
    return r.body;
  });

  try {
    const json = JSON.parse(result) as {
      results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
    };
    return json.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
  } catch {
    throw new Error(`Deepgram returned non-JSON response: ${result.slice(0, 200)}`);
  }
}

async function retryWithBackoff<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (/network|offline|connection (was )?lost|internet connection|timed out|fetch failed/i.test(msg)) {
        throw new NetworkError();
      }
      if (msg.includes('(429)')) {
        throw new RateLimitError(5000);
      }
      // Other 4xx (bad key, oversized, malformed) won't heal on retry.
      if (/\(4\d\d\)/.test(msg)) throw e;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}
