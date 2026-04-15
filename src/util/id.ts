/**
 * Lightweight unique id (collision-resistant for our local-only sermon list).
 * Avoids pulling in the `uuid` package at runtime — works without crypto.getRandomValues.
 */
export function newId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}`;
}
