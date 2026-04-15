import { create } from 'zustand';
import type { Outline, ProcessingStep, RecordingStatus } from '../types';

type SessionState = {
  status: RecordingStatus;
  step: ProcessingStep;
  elapsedMs: number;
  errorMessage: string | null;

  // Live transcript built up as chunks arrive
  liveTranscript: string;
  // Live outline regenerated every ~2 chunks
  liveOutline: Outline | null;
  // Count of chunks transcribed so far
  chunkCount: number;

  setStatus: (s: RecordingStatus) => void;
  setStep: (s: ProcessingStep) => void;
  setElapsed: (ms: number) => void;
  setError: (msg: string | null) => void;
  appendTranscript: (text: string) => void;
  setLiveOutline: (o: Outline) => void;
  incrementChunk: () => void;
  reset: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  status: 'idle',
  step: 'idle',
  elapsedMs: 0,
  errorMessage: null,
  liveTranscript: '',
  liveOutline: null,
  chunkCount: 0,

  setStatus: (status) => set({ status }),
  setStep: (step) => set({ step }),
  setElapsed: (elapsedMs) => set({ elapsedMs }),
  setError: (errorMessage) => set({ errorMessage }),
  appendTranscript: (text) =>
    set((s) => ({
      liveTranscript: s.liveTranscript ? s.liveTranscript + ' ' + text : text,
    })),
  setLiveOutline: (liveOutline) => set({ liveOutline }),
  incrementChunk: () => set((s) => ({ chunkCount: s.chunkCount + 1 })),
  reset: () =>
    set({
      status: 'idle',
      step: 'idle',
      elapsedMs: 0,
      errorMessage: null,
      liveTranscript: '',
      liveOutline: null,
      chunkCount: 0,
    }),
}));
