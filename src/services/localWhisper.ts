import * as FileSystem from 'expo-file-system/legacy';
import { initWhisper, type WhisperContext } from 'whisper.rn';

/**
 * On-device transcription via whisper.rn (whisper.cpp). No API key, no rate
 * limits, works offline. The model is downloaded once on first use and cached
 * on disk; everything after that is fully local.
 *
 * Requires a native build (dev/production) — this cannot run in Expo Go.
 */

// base.en: ~142MB, a good accuracy/speed balance for English sermons.
// To trade accuracy for speed/size, switch to ggml-tiny.en.bin (~75MB).
const MODEL_FILE = 'ggml-base.en.bin';
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_FILE}`;
const MODEL_DIR = `${FileSystem.documentDirectory ?? ''}models/`;
const MODEL_PATH = `${MODEL_DIR}${MODEL_FILE}`;
// Sanity floor — a partial download is much smaller than the real model.
const MIN_VALID_BYTES = 50 * 1024 * 1024;

let contextPromise: Promise<WhisperContext> | null = null;

export async function isModelDownloaded(): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  return info.exists && 'size' in info && (info as { size: number }).size >= MIN_VALID_BYTES;
}

export function getModelInfo() {
  return { file: MODEL_FILE, approxMb: 142, path: MODEL_PATH };
}

/**
 * Download the Whisper model to disk if it isn't already there.
 * `onProgress` receives 0..1. Safe to call repeatedly — it no-ops when present.
 */
export async function ensureModelDownloaded(
  onProgress?: (fraction: number) => void,
): Promise<void> {
  if (await isModelDownloaded()) {
    onProgress?.(1);
    return;
  }
  const dirInfo = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });

  // Download to a temp path, then move into place so an interrupted download
  // never looks like a valid model.
  const tmp = `${MODEL_PATH}.download`;
  await FileSystem.deleteAsync(tmp, { idempotent: true });

  const resumable = FileSystem.createDownloadResumable(
    MODEL_URL,
    tmp,
    {},
    (p) => {
      if (p.totalBytesExpectedToWrite > 0) {
        onProgress?.(p.totalBytesWritten / p.totalBytesExpectedToWrite);
      }
    },
  );

  const result = await resumable.downloadAsync();
  if (!result?.uri) throw new Error('Model download failed.');

  const info = await FileSystem.getInfoAsync(tmp);
  if (!info.exists || !('size' in info) || (info as { size: number }).size < MIN_VALID_BYTES) {
    await FileSystem.deleteAsync(tmp, { idempotent: true });
    throw new Error('Downloaded model is incomplete. Check your connection and try again.');
  }
  await FileSystem.moveAsync({ from: tmp, to: MODEL_PATH });
  onProgress?.(1);
}

async function getContext(): Promise<WhisperContext> {
  if (!contextPromise) {
    contextPromise = (async () => {
      if (!(await isModelDownloaded())) {
        throw new Error('Transcription model not downloaded yet.');
      }
      // Force the most compatible path: no CoreML (we don't ship the .mlmodelc
      // variant, and that path was aborting native-side on iOS) and CPU-only.
      // Slower but far more stable across devices.
      return initWhisper({
        filePath: MODEL_PATH,
        useCoreMLIos: false,
        useGpu: false,
        useFlashAttn: false,
      });
    })();
    // If init fails, clear the cached promise so a later call can retry.
    contextPromise.catch(() => { contextPromise = null; });
  }
  return contextPromise;
}

/** Free the native context (call when transcription is fully done). */
export async function releaseWhisper(): Promise<void> {
  if (!contextPromise) return;
  try {
    const ctx = await contextPromise;
    await ctx.release();
  } catch {
    // already gone
  } finally {
    contextPromise = null;
  }
}

/**
 * Transcribe one audio file on-device and return its text. The model is
 * loaded lazily and reused across calls within a recording session.
 */
export async function transcribeLocal(uri: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error(`Audio file missing: ${uri}`);
  const ctx = await getContext();
  const { promise } = ctx.transcribe(uri, { language: 'en' });
  const { result } = await promise;
  return (result ?? '').trim();
}
