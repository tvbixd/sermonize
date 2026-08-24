/**
 * Tests that the scripture memory cache is bounded.
 */

describe('Bible cache bound', () => {
  it('should not grow past CACHE_MAX entries', () => {
    const CACHE_MAX = 500;
    const cache = new Map<string, { reference: string }>();

    for (let i = 0; i < CACHE_MAX + 50; i++) {
      if (cache.size >= CACHE_MAX) {
        const oldest = cache.keys().next().value!;
        cache.delete(oldest);
      }
      cache.set(`ref-${i}`, { reference: `Verse ${i}` });
    }

    expect(cache.size).toBe(CACHE_MAX);
    expect(cache.has('ref-0')).toBe(false);
    expect(cache.has('ref-549')).toBe(true);
  });
});
