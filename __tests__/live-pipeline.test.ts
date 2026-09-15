/**
 * Phase 1 live-pipeline groundwork:
 *  - two-stage scripture store (detect → resolve, upsert by reference)
 *  - rolling-window detection catching references split across chunk boundaries
 */
jest.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

import { useSessionStore } from '@/state/sessionStore';
import { findScriptureReferences } from '@/services/scriptureRegex';

describe('two-stage live scripture store', () => {
  beforeEach(() => useSessionStore.getState().reset());

  it('adds detected references as resolving placeholders', () => {
    useSessionStore.getState().addDetectedRefs(['Romans 8:28', 'Hebrews 11:1']);
    const live = useSessionStore.getState().liveScriptures;
    expect(live).toHaveLength(2);
    expect(live.every((s) => s.status === 'resolving')).toBe(true);
    expect(live.every((s) => s.text === undefined)).toBe(true);
  });

  it('does not duplicate a reference already present (case/space-insensitive)', () => {
    const s = useSessionStore.getState();
    s.addDetectedRefs(['Romans 8:28']);
    s.addDetectedRefs(['romans 8:28', 'Romans  8:28']);
    expect(useSessionStore.getState().liveScriptures).toHaveLength(1);
  });

  it('resolves a placeholder in place, keeping the canonical reference', () => {
    const s = useSessionStore.getState();
    s.addDetectedRefs(['Romans 8:28']);
    s.resolveScripture('Romans 8:28', { reference: 'Romans 8:28', text: 'And we know…', translation: 'KJV' }, true);
    const live = useSessionStore.getState().liveScriptures;
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ reference: 'Romans 8:28', text: 'And we know…', translation: 'KJV', status: 'resolved' });
  });

  it('marks a lookup that returned no text as failed', () => {
    const s = useSessionStore.getState();
    s.addDetectedRefs(['Obadiah 1:1']);
    s.resolveScripture('Obadiah 1:1', { reference: 'Obadiah 1:1' }, false);
    expect(useSessionStore.getState().liveScriptures[0].status).toBe('failed');
  });

  it('adds a resolved scripture even if it was never registered as resolving', () => {
    useSessionStore.getState().resolveScripture('John 3:16', { reference: 'John 3:16', text: 'For God…' }, true);
    const live = useSessionStore.getState().liveScriptures;
    expect(live).toHaveLength(1);
    expect(live[0].status).toBe('resolved');
  });
});

describe('rolling-window detection across chunk boundaries', () => {
  it('misses a spoken reference split between two isolated chunks', () => {
    // "Matthew" ends chunk N; "chapter 12 verse 24" begins chunk N+1.
    const chunkA = 'turn with me to the gospel of Matthew';
    const chunkB = 'chapter 12 verse 24 where it says';
    expect(findScriptureReferences(chunkA)).not.toContain('Matthew 12:24');
    expect(findScriptureReferences(chunkB)).not.toContain('Matthew 12:24');
  });

  it('catches it when detection runs over the joined transcript tail', () => {
    const transcript = 'turn with me to the gospel of Matthew chapter 12 verse 24 where it says';
    const tail = transcript.slice(-260);
    expect(findScriptureReferences(tail)).toContain('Matthew 12:24');
  });
});
