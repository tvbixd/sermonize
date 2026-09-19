/**
 * Scripture detection (spoken + written forms) and verse-text cleaning.
 */
jest.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

import { findScriptureReferences } from '@/services/scriptureRegex';
import { cleanVerseText } from '@/services/bible';

describe('findScriptureReferences', () => {
  it('detects the written colon form', () => {
    expect(findScriptureReferences('turn with me to Matthew 12:24')).toContain('Matthew 12:24');
  });

  it('detects the spoken "chapter X verse Y" form', () => {
    expect(findScriptureReferences('open to Matthew chapter 12 verse 24')).toContain('Matthew 12:24');
  });

  it('detects "chapter X verse Y" without the colon and with just "verse"', () => {
    expect(findScriptureReferences('look at Matthew 12 verse 24')).toContain('Matthew 12:24');
  });

  it('does NOT invent a verse for a chapter-only reference', () => {
    const refs = findScriptureReferences('as Paul writes in Romans 8');
    expect(refs).toContain('Romans 8');
    expect(refs).not.toContain('Romans 8:1');
  });

  it('handles verse ranges and abbreviations', () => {
    expect(findScriptureReferences('1 Cor 13:4-7')).toContain('1 Corinthians 13:4-7');
  });

  it('expands numbered-book aliases', () => {
    expect(findScriptureReferences('II Timothy 3:16')).toContain('2 Timothy 3:16');
  });

  it('detects "chapter" prefix alone', () => {
    expect(findScriptureReferences('Genesis chapter 1')).toContain('Genesis 1');
  });

  // Spoken number words + bare space-separated numbers (real church-test cases)
  it('parses spoken chapter+verse as a range: "Matthew three seven fifteen"', () => {
    expect(findScriptureReferences('open Matthew three seven fifteen')).toContain('Matthew 3:7-15');
  });

  it('parses bare space-separated numbers: "Matthew 3 7 15"', () => {
    expect(findScriptureReferences('Matthew 3 7 15')).toContain('Matthew 3:7-15');
  });

  it('resolves "first Peter two seven" to 1 Peter 2:7', () => {
    expect(findScriptureReferences('turn to first Peter two seven')).toContain('1 Peter 2:7');
  });

  it('parses "John three sixteen" as John 3:16', () => {
    expect(findScriptureReferences('John three sixteen')).toContain('John 3:16');
  });

  it('parses a spoken tens+ones number: "Genesis twenty one"', () => {
    expect(findScriptureReferences('Genesis twenty one')).toContain('Genesis 21');
  });

  it('still treats a bare chapter as chapter-only (no invented verse)', () => {
    const refs = findScriptureReferences('as Paul writes in Philippians 2 today');
    expect(refs).toContain('Philippians 2');
    expect(refs).not.toContain('Philippians 2:2');
  });

  // Comma / filler forms Whisper produces (from the John 4 test)
  it('parses a comma between chapter and verse: "John 4, 24"', () => {
    expect(findScriptureReferences('open your Bibles to John 4, 24')).toContain('John 4:24');
  });

  it('parses "Isaiah 45, 5"', () => {
    expect(findScriptureReferences('Isaiah 45, 5 says')).toContain('Isaiah 45:5');
  });

  it('parses a comma chapter + spoken range: "Matthew 3, 16 to 17"', () => {
    expect(findScriptureReferences('to Matthew 3, 16 to 17')).toContain('Matthew 3:16-17');
  });

  it('parses filler "from verse X to Y": "Philippians 2 from verse 5 to 8"', () => {
    expect(findScriptureReferences('Philippians 2 from verse 5 to 8')).toContain('Philippians 2:5-8');
  });
});

describe('cleanVerseText', () => {
  it('strips a leading verse number', () => {
    expect(cleanVerseText('5Before I formed you in the womb')).toBe('Before I formed you in the womb');
  });

  it('keeps an opening quote while dropping the number', () => {
    expect(cleanVerseText('5“Before I formed you')).toBe('“Before I formed you');
  });

  it('repairs missing spaces after punctuation', () => {
    expect(cleanVerseText('you,before you were born I set you apart;I appointed'))
      .toBe('you, before you were born I set you apart; I appointed');
  });

  it('does not split numbers like 1,000', () => {
    expect(cleanVerseText('there were 1,000 people')).toBe('there were 1,000 people');
  });

  it('leaves clean text unchanged', () => {
    expect(cleanVerseText('For God so loved the world.')).toBe('For God so loved the world.');
  });
});
