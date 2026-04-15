import * as FileSystem from 'expo-file-system';
import type { Sermon } from '../types';

const SERMONS_DIR = `${FileSystem.documentDirectory}sermons/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(SERMONS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SERMONS_DIR, { intermediates: true });
  }
}

function jsonPath(id: string) {
  return `${SERMONS_DIR}${id}.json`;
}

export function audioDir(id: string) {
  return `${SERMONS_DIR}${id}/audio/`;
}

export async function ensureAudioDir(id: string): Promise<string> {
  const dir = audioDir(id);
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export async function listSermons(): Promise<Sermon[]> {
  await ensureDir();
  const entries = await FileSystem.readDirectoryAsync(SERMONS_DIR);
  const jsonFiles = entries.filter((e) => e.endsWith('.json'));
  const sermons: Sermon[] = [];
  for (const name of jsonFiles) {
    try {
      const raw = await FileSystem.readAsStringAsync(`${SERMONS_DIR}${name}`);
      sermons.push(JSON.parse(raw) as Sermon);
    } catch {
      // skip corrupt entries
    }
  }
  sermons.sort((a, b) => b.createdAt - a.createdAt);
  return sermons;
}

export async function getSermon(id: string): Promise<Sermon | null> {
  await ensureDir();
  const path = jsonPath(id);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  const raw = await FileSystem.readAsStringAsync(path);
  return JSON.parse(raw) as Sermon;
}

export async function saveSermon(sermon: Sermon): Promise<void> {
  await ensureDir();
  await FileSystem.writeAsStringAsync(jsonPath(sermon.id), JSON.stringify(sermon, null, 2));
}

export async function deleteSermon(id: string): Promise<void> {
  await ensureDir();
  const path = jsonPath(id);
  const dir = `${SERMONS_DIR}${id}/`;
  await FileSystem.deleteAsync(path, { idempotent: true });
  await FileSystem.deleteAsync(dir, { idempotent: true });
}
