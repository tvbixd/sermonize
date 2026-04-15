import * as FileSystem from 'expo-file-system';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * Transcribe one or more audio files via OpenAI Whisper (whisper-1) and
 * concatenate the results in order. Each file is uploaded as multipart/form-data
 * directly from its file URI — we never load the bytes into JS memory.
 *
 * The SermonRecorder rotates files at ~22 MB to stay safely under Whisper's
 * 25 MB per-file limit, so each individual upload here is just a single POST.
 */
export async function transcribeAudio(
  audioUris: string[],
  apiKey: string,
  opts: { language?: string; signal?: AbortSignal } = {},
): Promise<string> {
  if (!apiKey) throw new Error('OpenAI API key is not set. Add it in Settings.');
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

  // Use uploadAsync so the OS streams the file straight into the request body.
  const params: Record<string, string> = { model: 'whisper-1' };
  if (opts.language) params.language = opts.language;

  const result = await retryWithBackoff(async () => {
    const r = await FileSystem.uploadAsync(WHISPER_URL, uri, {
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
      throw new Error(`Whisper request failed (${r.status}): ${r.body}`);
    }
    return r.body;
  });

  try {
    const json = JSON.parse(result) as { text?: string };
    return json.text ?? '';
  } catch {
    throw new Error(`Whisper returned non-JSON response: ${result.slice(0, 200)}`);
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

async function retryWithBackoff<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}
