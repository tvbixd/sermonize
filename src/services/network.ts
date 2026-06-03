const GROQ_HEALTH_URL = 'https://api.groq.com/openai/v1/models';

export async function checkConnectivity(apiKey: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(GROQ_HEALTH_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return r.ok || r.status === 401;
  } catch {
    return false;
  }
}
