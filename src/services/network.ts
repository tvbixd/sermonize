const GROQ_HEALTH_URL = 'https://api.groq.com/openai/v1/models';

/**
 * Check whether a Groq API key is accepted. 'offline' means we couldn't
 * reach Groq at all, so the key may still be fine.
 */
export async function validateGroqKey(apiKey: string): Promise<'valid' | 'invalid' | 'offline'> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(GROQ_HEALTH_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (r.status === 401 || r.status === 403) return 'invalid';
    return 'valid';
  } catch {
    return 'offline';
  }
}

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
