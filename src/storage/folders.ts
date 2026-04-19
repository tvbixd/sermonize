import * as FileSystem from 'expo-file-system/legacy';
import type { Folder } from '../types';

const FOLDERS_PATH = `${FileSystem.documentDirectory}folders.json`;

export async function listFolders(): Promise<Folder[]> {
  try {
    const info = await FileSystem.getInfoAsync(FOLDERS_PATH);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(FOLDERS_PATH);
    return JSON.parse(raw) as Folder[];
  } catch {
    return [];
  }
}

export async function saveFolder(folder: Folder): Promise<void> {
  const all = await listFolders();
  const idx = all.findIndex((f) => f.id === folder.id);
  if (idx >= 0) all[idx] = folder;
  else all.push(folder);
  await FileSystem.writeAsStringAsync(FOLDERS_PATH, JSON.stringify(all, null, 2));
}

export async function deleteFolder(id: string): Promise<void> {
  const all = await listFolders();
  await FileSystem.writeAsStringAsync(
    FOLDERS_PATH,
    JSON.stringify(all.filter((f) => f.id !== id), null, 2),
  );
}
