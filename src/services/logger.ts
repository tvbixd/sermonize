import * as FileSystem from 'expo-file-system/legacy';

const LOG_DIR = `${FileSystem.documentDirectory ?? ''}logs/`;
const CRASH_LOG = `${LOG_DIR}crashes.json`;
const EVENT_LOG = `${LOG_DIR}events.json`;
const MAX_ENTRIES = 200;

type CrashEntry = {
  timestamp: number;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
};

type EventEntry = {
  timestamp: number;
  event: string;
  data?: Record<string, unknown>;
};

async function ensureLogDir() {
  const info = await FileSystem.getInfoAsync(LOG_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
}

async function readLog<T>(path: string): Promise<T[]> {
  try {
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendLog<T>(path: string, entry: T) {
  await ensureLogDir();
  const entries = await readLog<T>(path);
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  await FileSystem.writeAsStringAsync(path, JSON.stringify(entries));
}

export async function logCrash(error: Error, context?: Record<string, unknown>) {
  const entry: CrashEntry = {
    timestamp: Date.now(),
    message: error.message,
    stack: error.stack?.slice(0, 1000),
    context,
  };
  await appendLog(CRASH_LOG, entry).catch(() => {});
}

export async function logEvent(event: string, data?: Record<string, unknown>) {
  const entry: EventEntry = { timestamp: Date.now(), event, data };
  await appendLog(EVENT_LOG, entry).catch(() => {});
}

export async function getCrashLog(): Promise<CrashEntry[]> {
  return readLog<CrashEntry>(CRASH_LOG);
}

export async function getEventLog(): Promise<EventEntry[]> {
  return readLog<EventEntry>(EVENT_LOG);
}

export async function clearLogs() {
  await FileSystem.deleteAsync(CRASH_LOG, { idempotent: true });
  await FileSystem.deleteAsync(EVENT_LOG, { idempotent: true });
}

export async function getLogSizeBytes(): Promise<number> {
  let total = 0;
  for (const path of [CRASH_LOG, EVENT_LOG]) {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists && 'size' in info) total += (info as { size: number }).size;
  }
  return total;
}
