// Reachable host used only to detect connectivity. An unauthenticated request
// returns 401/403 — which still proves we're online.
const PING_URL = 'https://api.deepgram.com/v1/projects';

export async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(PING_URL, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    return r.ok || r.status === 401 || r.status === 403;
  } catch {
    return false;
  }
}
