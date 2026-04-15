export type Scripture = {
  reference: string; // canonical form, e.g. "John 3:16"
  text?: string; // verse text from bible-api
  translation?: string; // e.g. "WEB"
};

export type OutlinePoint = {
  heading: string;
  subPoints: string[];
  scriptures: string[]; // references; full text resolved separately
};

export type Outline = {
  title: string;
  theme: string;
  summary: string;
  points: OutlinePoint[];
};

export type Sermon = {
  id: string;
  createdAt: number; // epoch ms
  title: string; // mirrors outline.title for quick listing
  transcript: string;
  outline: Outline;
  scriptures: Scripture[];
  audioUris: string[]; // one or more files (size-rotated for very long sermons)
  durationMs: number;
};

export type RecordingStatus =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'done'
  | 'error';

export type ProcessingStep =
  | 'idle'
  | 'transcribing'
  | 'outlining'
  | 'scriptures'
  | 'saving'
  | 'done';
