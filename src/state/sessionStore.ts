import { create } from 'zustand';
import type { ProcessingStep, RecordingStatus } from '../types';

type SessionState = {
  status: RecordingStatus;
  step: ProcessingStep;
  elapsedMs: number;
  errorMessage: string | null;
  setStatus: (s: RecordingStatus) => void;
  setStep: (s: ProcessingStep) => void;
  setElapsed: (ms: number) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  status: 'idle',
  step: 'idle',
  elapsedMs: 0,
  errorMessage: null,
  setStatus: (status) => set({ status }),
  setStep: (step) => set({ step }),
  setElapsed: (elapsedMs) => set({ elapsedMs }),
  setError: (errorMessage) => set({ errorMessage }),
  reset: () =>
    set({
      status: 'idle',
      step: 'idle',
      elapsedMs: 0,
      errorMessage: null,
    }),
}));
