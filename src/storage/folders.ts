import * as FileSystem from 'expo-file-system/legacy';
import type { Folder } from '../types';
import { listAllSermons, saveSermon } from './sermons';

const FOLDERS_PATH = `${FileSystem.documentDirectory ?? ''}folders.json`;

/**
 * Write via temp file + rename so the app dying mid-write can never leave a
 * truncated folders.json — with a single shared file, one truncated write
 * followed by a read-modify-write would otherwise destroy every folder.
 */
async function writeFoldersAtomic(folders: Folder[]): Promise<void> {
  const tmp = `${FOLDERS_PATH}.tmp`;
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(folders, null, 2));
  await FileSystem.deleteAsync(FOLDERS_PATH, { idempotent: true });
  await FileSystem.moveAsync({ from: tmp, to: FOLDERS_PATH });
}

export async function listFolders(): Promise<Folder[]> {
  const info = await FileSystem.getInfoAsync(FOLDERS_PATH).catch(() => ({ exists: false }));
  if (!info.exists) return [];
  try {
    const raw = await FileSystem.readAsStringAsync(FOLDERS_PATH);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Folder[]) : [];
  } catch {
    // The file exists but is unreadable/corrupt. Quarantine it instead of
    // returning [] in place — otherwise the next saveFolder would
    // read-modify-write an empty list over whatever might be salvageable.
    await FileSystem.moveAsync({
      from: FOLDERS_PATH,
      to: `${FOLDERS_PATH}.corrupt`,
    }).catch(() => {});
    return [];
  }
}

export async function saveFolder(folder: Folder): Promise<void> {
  const all = await listFolders();
  const idx = all.findIndex((f) => f.id === folder.id);
  if (idx >= 0) all[idx] = folder;
  else all.push(folder);
  await writeFoldersAtomic(all);
}

export async function togglePinFolder(id: string): Promise<void> {
  const all = await listFolders();
  const folder = all.find((f) => f.id === id);
  if (!folder) return;
  folder.pinned = !folder.pinned;
  await writeFoldersAtomic(all);
}

export async function deleteFolder(id: string): Promise<void> {
  const all = await listFolders();
  await writeFoldersAtomic(all.filter((f) => f.id !== id));
  // Clear the reference on every sermon — including drafts and trashed ones,
  // which would otherwise carry a dangling folderId forever.
  const sermons = await listAllSermons();
  for (const s of sermons) {
    if (s.folderId === id) {
      await saveSermon({ ...s, folderId: undefined });
    }
  }
}
