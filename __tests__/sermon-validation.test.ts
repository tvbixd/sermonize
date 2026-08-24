/**
 * Tests that sermon JSON validation rejects corrupt data.
 */

describe('Sermon JSON validation', () => {
  function isValidSermon(parsed: unknown): boolean {
    return (
      parsed != null &&
      typeof parsed === 'object' &&
      typeof (parsed as Record<string, unknown>).id === 'string' &&
      typeof (parsed as Record<string, unknown>).createdAt === 'number'
    );
  }

  it('accepts a valid sermon', () => {
    const valid = { id: 'abc-123', createdAt: Date.now(), title: 'Test', transcript: '' };
    expect(isValidSermon(valid)).toBe(true);
  });

  it('rejects missing id', () => {
    const bad = { createdAt: Date.now(), title: 'Test' };
    expect(isValidSermon(bad)).toBe(false);
  });

  it('rejects missing createdAt', () => {
    const bad = { id: 'abc', title: 'Test' };
    expect(isValidSermon(bad)).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidSermon(null)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidSermon('not an object')).toBe(false);
  });

  it('rejects wrong types', () => {
    const bad = { id: 123, createdAt: 'not a number' };
    expect(isValidSermon(bad)).toBe(false);
  });
});
