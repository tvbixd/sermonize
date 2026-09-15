import { create } from 'zustand';
import type { Outline, ProcessingStep, RecordingStatus, Scripture } from '../types';

/**
 * A scripture as it moves through the live pipeline. `status` drives the
 * two-stage UI: a reference is `resolving` the instant it's detected (local,
 * so it can appear immediately), then `resolved` once the verse text is looked
 * up, or `failed` if the lookup couldn't return text.
 */
export type LiveScripture = Scripture & { status: 'resolving' | 'resolved' | 'failed' };

type SessionState = {
  status: RecordingStatus;
  step: ProcessingStep;
  elapsedMs: number;
  errorMessage: string | null;

  // Transcript built up as chunks arrive — internal only, not shown/stored
  liveTranscript: string;
  // Live outline regenerated every ~2 chunks
  liveOutline: Outline | null;
  // Scriptures detected + resolved live as the sermon is preached
  liveScriptures: LiveScripture[];
  // Count of chunks transcribed so far
  chunkCount: number;
  // Transient transcription warning shown during recording
  chunkWarning: string | null;
  // True once the user chose to keep recording without transcription
  audioOnlyMode: boolean;

  setStatus: (s: RecordingStatus) => void;
  setStep: (s: ProcessingStep) => void;
  setElapsed: (ms: number) => void;
  setError: (msg: string | null) => void;
  appendTranscript: (text: string) => void;
  setLiveOutline: (o: Outline) => void;
  // Stage 1: register newly detected references as `resolving` placeholders.
  addDetectedRefs: (refs: string[]) => void;
  // Stage 2: fill a reference in with looked-up verse text (or mark it failed).
  resolveScripture: (reference: string, scripture: Scripture, ok: boolean) => void;
  incrementChunk: () => void;
  setChunkWarning: (msg: string | null) => void;
  setAudioOnlyMode: (v: boolean) => void;
  reset: () => void;
};

const refKey = (r: string) => r.trim().toLowerCase().replace(/\s+/g, ' ');

export const useSessionStore = create<SessionState>((set) => ({
  status: 'idle',
  step: 'idle',
  elapsedMs: 0,
  errorMessage: null,
  liveTranscript: '',
  liveOutline: null,
  liveScriptures: [],
  chunkCount: 0,
  chunkWarning: null,
  audioOnlyMode: false,

  setStatus: (status) => set({ status }),
  setStep: (step) => set({ step }),
  setElapsed: (elapsedMs) => set({ elapsedMs }),
  setError: (errorMessage) => set({ errorMessage }),
  setChunkWarning: (chunkWarning) => set({ chunkWarning }),
  setAudioOnlyMode: (audioOnlyMode) => set({ audioOnlyMode }),
  appendTranscript: (text) =>
    set((s) => ({
      liveTranscript: s.liveTranscript ? s.liveTranscript + ' ' + text : text,
    })),
  setLiveOutline: (liveOutline) => set({ liveOutline }),
  addDetectedRefs: (refs) =>
    set((s) => {
      const seen = new Set(s.liveScriptures.map((x) => refKey(x.reference)));
      const additions: LiveScripture[] = [];
      for (const r of refs) {
        const k = refKey(r);
        if (seen.has(k)) continue;
        seen.add(k);
        additions.push({ reference: r, status: 'resolving' });
      }
      return additions.length ? { liveScriptures: [...s.liveScriptures, ...additions] } : {};
    }),
  resolveScripture: (reference, scripture, ok) =>
    set((s) => {
      const k = refKey(reference);
      const status: LiveScripture['status'] = ok ? 'resolved' : 'failed';
      let found = false;
      const next = s.liveScriptures.map((x) => {
        if (refKey(x.reference) !== k) return x;
        found = true;
        // Keep the canonical reference we detected; layer in text/translation.
        return { ...x, text: scripture.text, translation: scripture.translation, status };
      });
      if (!found) next.push({ reference, text: scripture.text, translation: scripture.translation, status });
      return { liveScriptures: next };
    }),
  incrementChunk: () => set((s) => ({ chunkCount: s.chunkCount + 1 })),
  reset: () =>
    set({
      status: 'idle',
      step: 'idle',
      elapsedMs: 0,
      errorMessage: null,
      liveTranscript: '',
      liveOutline: null,
      liveScriptures: [],
      chunkCount: 0,
      chunkWarning: null,
      audioOnlyMode: false,
    }),
}));
