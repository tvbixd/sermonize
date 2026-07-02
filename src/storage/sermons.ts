import * as FileSystem from 'expo-file-system/legacy';
import type { Sermon } from '../types';

const SERMONS_DIR = `${FileSystem.documentDirectory ?? ''}sermons/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(SERMONS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SERMONS_DIR, { intermediates: true });
  }
}

/** IDs come from newId() but can also arrive via deep links — never let one
 *  containing path separators near the filesystem. */
function assertValidId(id: string) {
  if (!/^[A-Za-z0-9-]+$/.test(id)) throw new Error(`Invalid sermon id: ${id}`);
}

function jsonPath(id: string) {
  assertValidId(id);
  return `${SERMONS_DIR}${id}.json`;
}

export function audioDir(id: string) {
  assertValidId(id);
  return `${SERMONS_DIR}${id}/audio/`;
}

/**
 * Write JSON via a temp file + rename so the app dying mid-write can never
 * leave a truncated file at the real path.
 */
async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.tmp`;
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(data, null, 2));
  await FileSystem.deleteAsync(path, { idempotent: true });
  await FileSystem.moveAsync({ from: tmp, to: path });
}

export async function ensureAudioDir(id: string): Promise<string> {
  const dir = audioDir(id);
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function loadAll(): Promise<Sermon[]> {
  await ensureDir();
  const entries = await FileSystem.readDirectoryAsync(SERMONS_DIR);
  const jsonFiles = entries.filter((e) => e.endsWith('.json'));
  const sermons: Sermon[] = [];
  for (const name of jsonFiles) {
    try {
      const raw = await FileSystem.readAsStringAsync(`${SERMONS_DIR}${name}`);
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'string' && typeof parsed.createdAt === 'number') {
        sermons.push(parsed as Sermon);
      }
    } catch {
      // skip corrupt entries
    }
  }
  sermons.sort((a, b) => b.createdAt - a.createdAt);
  return sermons;
}

export async function listSermons(): Promise<Sermon[]> {
  const all = await loadAll();
  return all.filter((s) => !s.deletedAt && !s.isDraft);
}

/** Every sermon regardless of draft/deleted state — for maintenance tasks
 *  like clearing folder references. */
export async function listAllSermons(): Promise<Sermon[]> {
  return loadAll();
}

export async function listDraftSermons(): Promise<Sermon[]> {
  const all = await loadAll();
  return all.filter((s) => !!s.isDraft && !s.deletedAt);
}

export async function listDeletedSermons(): Promise<Sermon[]> {
  const all = await loadAll();
  return all.filter((s) => !!s.deletedAt);
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function purgeExpiredDeleted(): Promise<void> {
  const deleted = await listDeletedSermons();
  const now = Date.now();
  for (const s of deleted) {
    if (s.deletedAt && now - s.deletedAt > THIRTY_DAYS_MS) {
      await deleteSermon(s.id);
    }
  }
}

export async function getSermon(id: string): Promise<Sermon | null> {
  await ensureDir();
  const path = jsonPath(id);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  const raw = await FileSystem.readAsStringAsync(path);
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed.id !== 'string' || typeof parsed.createdAt !== 'number') return null;
  return parsed as Sermon;
}

export async function saveSermon(sermon: Sermon): Promise<void> {
  await ensureDir();
  // Store audio as bare filenames — absolute URIs go stale on iOS whenever
  // the app container path changes (every app update). Resolve with
  // resolveAudioUris() when full paths are needed.
  const normalized: Sermon = {
    ...sermon,
    audioUris: (sermon.audioUris ?? []).map((u) => u.split('/').filter(Boolean).pop() ?? u),
  };
  await writeJsonAtomic(jsonPath(sermon.id), normalized);
}

/** Full file URIs for a sermon's audio chunks, resolved against the current
 *  container path. Handles both legacy absolute URIs and bare filenames. */
export function resolveAudioUris(sermon: Sermon): string[] {
  const dir = audioDir(sermon.id);
  return (sermon.audioUris ?? []).map((u) => `${dir}${u.split('/').filter(Boolean).pop() ?? u}`);
}

export async function softDeleteSermon(id: string): Promise<void> {
  const sermon = await getSermon(id);
  if (sermon) {
    sermon.deletedAt = Date.now();
    await saveSermon(sermon);
  }
}

export async function restoreSermon(id: string): Promise<void> {
  const sermon = await getSermon(id);
  if (sermon) {
    delete sermon.deletedAt;
    await saveSermon(sermon);
  }
}

export async function deleteSermon(id: string): Promise<void> {
  await ensureDir();
  const path = jsonPath(id);
  const dir = `${SERMONS_DIR}${id}/`;
  await FileSystem.deleteAsync(path, { idempotent: true });
  await FileSystem.deleteAsync(dir, { idempotent: true });
}

export async function getAudioStorageBytes(): Promise<number> {
  await ensureDir();
  const entries = await FileSystem.readDirectoryAsync(SERMONS_DIR);
  let total = 0;
  for (const entry of entries) {
    const dir = `${SERMONS_DIR}${entry}/audio/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists || !info.isDirectory) continue;
    const files = await FileSystem.readDirectoryAsync(dir);
    for (const file of files) {
      const fInfo = await FileSystem.getInfoAsync(`${dir}${file}`);
      if (fInfo.exists && 'size' in fInfo) total += (fInfo as { size: number }).size;
    }
  }
  return total;
}

export async function deleteAudioForSermon(id: string): Promise<void> {
  // Update the JSON first — if we die between the two steps the sermon
  // correctly shows "no audio" rather than pointing at deleted files.
  const sermon = await getSermon(id);
  if (sermon) {
    sermon.audioUris = [];
    await saveSermon(sermon);
  }
  const dir = audioDir(id);
  await FileSystem.deleteAsync(dir, { idempotent: true });
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

/**
 * Find audio directories with no matching sermon JSON (left behind by a
 * crash mid-recording) and convert each into a recoverable draft. Returns
 * the IDs that were recovered so the caller can surface a notice.
 */
export async function recoverOrphanedAudio(): Promise<string[]> {
  await ensureDir();
  const entries = await FileSystem.readDirectoryAsync(SERMONS_DIR);
  // Only JSON files that actually parse count as "has a sermon" — a file
  // truncated by a crash mid-write must not shield its audio from recovery.
  const jsonIds = new Set<string>();
  for (const e of entries) {
    if (!e.endsWith('.json')) continue;
    const id = e.replace(/\.json$/, '');
    try {
      const raw = await FileSystem.readAsStringAsync(`${SERMONS_DIR}${e}`);
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'string' && typeof parsed.createdAt === 'number') {
        jsonIds.add(id);
      }
    } catch {
      // unreadable/corrupt — treat as missing so the audio gets recovered
    }
  }
  const recovered: string[] = [];
  for (const entry of entries) {
    if (entry.endsWith('.json') || entry.endsWith('.tmp')) continue;
    if (jsonIds.has(entry)) continue;
    if (!/^[A-Za-z0-9-]+$/.test(entry)) continue;
    const dir = `${SERMONS_DIR}${entry}/audio/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists || !info.isDirectory) continue;
    const audioFiles = (await FileSystem.readDirectoryAsync(dir).catch(() => [] as string[])).sort();
    if (audioFiles.length === 0) continue;
    const uris = audioFiles.map((f) => `${dir}${f}`);
    const draft: Sermon = {
      id: entry,
      createdAt: Date.now(),
      title: 'Recovered — ' + new Date().toLocaleDateString(),
      transcript: '',
      outline: { title: 'Recovered', theme: '', summary: '', points: [] },
      scriptures: [],
      audioUris: uris,
      durationMs: 0,
      isDraft: true,
    };
    await saveSermon(draft).catch(() => {});
    recovered.push(entry);
  }
  return recovered;
}
