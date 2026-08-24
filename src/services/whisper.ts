import * as FileSystem from 'expo-file-system/legacy';

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
// whisper-large-v3-turbo is faster and still high quality on the free tier.
const MODEL = 'whisper-large-v3-turbo';

/**
 * Transcribe one or more audio files via Groq's free-tier Whisper endpoint
 * (OpenAI-compatible) and concatenate the results in order. Each file is
 * uploaded as multipart/form-data directly from its file URI — we never
 * load the bytes into JS memory.
 *
 * SermonRecorder rotates files at ~22 MB to stay safely under the 25 MB
 * per-file limit, so each individual upload here is a single POST.
 */
export async function transcribeAudio(
  audioUris: string[],
  apiKey: string,
  opts: { language?: string; signal?: AbortSignal } = {},
): Promise<string> {
  if (!apiKey) throw new Error('Groq API key is not set. Add it in Settings.');
  if (audioUris.length === 0) return '';

  const parts: string[] = [];
  for (const uri of audioUris) {
    const text = await transcribeOne(uri, apiKey, opts);
    if (text) parts.push(text.trim());
  }
  return parts.join('\n\n');
}

async function transcribeOne(
  uri: string,
  apiKey: string,
  opts: { language?: string; signal?: AbortSignal },
): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error(`Audio file missing: ${uri}`);

  const params: Record<string, string> = {
    model: MODEL,
    response_format: 'json',
  };
  if (opts.language) params.language = opts.language;

  const result = await retryWithBackoff(async () => {
    const r = await FileSystem.uploadAsync(GROQ_TRANSCRIPTION_URL, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: mimeTypeFor(uri),
      parameters: params,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (r.status < 200 || r.status >= 300) {
      throw new Error(`Groq transcription failed (${r.status}): ${r.body}`);
    }
    return r.body;
  });

  try {
    const json = JSON.parse(result) as { text?: string };
    return json.text ?? '';
  } catch {
    throw new Error(`Groq returned non-JSON response: ${result.slice(0, 200)}`);
  }
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

export class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(retryAfter: number) {
    super(`Rate limit reached. Try again in ${Math.ceil(retryAfter / 1000)} seconds.`);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfter;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('No internet connection. Check your network and try again.');
    this.name = 'NetworkError';
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
      // iOS/Android surface offline errors with varied wording — match broadly.
      if (/network|offline|connection (was )?lost|internet connection|timed out|fetch failed/i.test(msg)) {
        throw new NetworkError();
      }
      if (msg.includes('(429)')) {
        // Groq phrases the wait as "try again in 2m30s" or "…in 45s".
        const m = msg.match(/try again in (?:(\d+)m)?\s*(\d+(?:\.\d+)?)s/i);
        const mins = m?.[1] ? parseInt(m[1], 10) : 0;
        const secs = m?.[2] ? parseFloat(m[2]) : 60;
        throw new RateLimitError(Math.ceil((mins * 60 + secs) * 1000));
      }
      // Other 4xx errors (bad key, oversized file, malformed request) won't
      // heal on retry — fail fast so the caller can surface them.
      if (/\(4\d\d\)/.test(msg)) throw e;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}
