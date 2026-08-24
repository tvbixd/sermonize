import { create } from 'zustand';
import type { Outline, ProcessingStep, RecordingStatus, Scripture } from '../types';

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
  liveScriptures: Scripture[];
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
  addLiveScriptures: (s: Scripture[]) => void;
  incrementChunk: () => void;
  setChunkWarning: (msg: string | null) => void;
  setAudioOnlyMode: (v: boolean) => void;
  reset: () => void;
};

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
  addLiveScriptures: (incoming) =>
    set((s) => {
      const seen = new Set(s.liveScriptures.map((x) => x.reference));
      const merged = [...s.liveScriptures];
      for (const sc of incoming) if (!seen.has(sc.reference)) { merged.push(sc); seen.add(sc.reference); }
      return { liveScriptures: merged };
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
