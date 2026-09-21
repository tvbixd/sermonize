import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  type AudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * SermonRecorder — chunk-based recorder for real-time transcription, built on
 * expo-audio (expo-av's maintained successor).
 *
 * Every CHUNK_MS (default 30s) the current segment is sealed and `onChunkReady`
 * is called with its URI so callers can transcribe it immediately. A new
 * segment starts right away, giving seamless recording.
 *
 * Background behaviour:
 *   `setAudioModeAsync({ shouldPlayInBackground: true })` + UIBackgroundModes
 *   'audio' keeps the iOS audio session alive when the app is backgrounded or
 *   the phone is locked, so the native recorder keeps writing into the current
 *   segment. The JS chunk timer freezes while backgrounded, so that segment
 *   simply grows until the app returns to the foreground, where the caller
 *   seals it via `flushCurrentChunk()`.
 *
 * Pause / Resume suspend / restart the audio and the chunk timer.
 * Stop seals the final partial segment and returns all URIs + duration.
 */
export class SermonRecorder {
  private current: AudioRecorder | null = null;
  private files: string[] = [];
  private targetDir: string;
  private onChunkReady: ((uri: string) => void) | null = null;

  private accumulatedMs = 0;
  private segmentStartedAt: number | null = null;

  private chunkTimer: ReturnType<typeof setInterval> | null = null;
  private rotating = false;
  // Chunk length trades transcription ACCURACY against how fast verses surface.
  // 8s was too aggressive — Whisper loses context and cuts words at boundaries,
  // producing a messier transcript. 15s keeps a live-ish feel while giving each
  // Whisper call enough context to transcribe cleanly. (Groq bills audio-seconds
  // regardless of chunk size.)
  static readonly CHUNK_MS = 15_000;

  constructor(targetDir: string) {
    this.targetDir = targetDir;
  }

  // 16 kHz mono, 32 kbps AAC — small files, and what Whisper transcribes from.
  // (32 kbps is the safe ceiling for 16 kHz mono AAC; higher fails to prepare.)
  private static recordingOptions(): RecordingOptions {
    return {
      // Metering drives the live waveform (getMeterLevel below).
      isMeteringEnabled: true,
      extension: '.m4a',
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 32000,
      android: {
        extension: '.m4a',
        outputFormat: 'mpeg4',
        audioEncoder: 'aac',
      },
      ios: {
        audioQuality: AudioQuality.MEDIUM,
        outputFormat: IOSOutputFormat.MPEG4AAC,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
    };
  }

  private static async configureSession(): Promise<void> {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      // The key to CAPTURING while backgrounded / screen-locked: iOS suspends a
      // recording the moment the app backgrounds unless the audio session is
      // told to keep recording alive. `shouldPlayInBackground` only covers
      // playback; `allowsBackgroundRecording` is what keeps the mic running (and
      // is what stops the app freezing on return, when it would otherwise come
      // back to an invalidated recorder). Both are set, paired with the 'audio'
      // UIBackgroundMode in app.config.ts.
      shouldPlayInBackground: true,
      allowsBackgroundRecording: true,
      interruptionMode: 'doNotMix',
    });
    await setIsAudioActiveAsync(true).catch(() => undefined);
  }

  async start(onChunkReady: (uri: string) => void): Promise<void> {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) throw new Error('Microphone permission denied');
    await SermonRecorder.configureSession();
    this.onChunkReady = onChunkReady;
    await this.beginNewSegment();
    this.startChunkTimer();
  }

  private async beginNewSegment(): Promise<void> {
    const attempt = async () => {
      const rec = new AudioModule.AudioRecorder(SermonRecorder.recordingOptions());
      await rec.prepareToRecordAsync();
      rec.record();
      this.current = rec;
      this.segmentStartedAt = Date.now();
    };
    try {
      await attempt();
    } catch {
      // Reset the session and retry once — clears a wedged audio session.
      await SermonRecorder.configureSession().catch(() => undefined);
      await new Promise((r) => setTimeout(r, 400));
      await attempt();
    }
  }

  private startChunkTimer(): void {
    this.chunkTimer = setInterval(() => void this.rotateChunk(), SermonRecorder.CHUNK_MS);
  }

  private stopChunkTimer(): void {
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }
  }

  /**
   * Seal the current segment, persist it, emit it. Does NOT start a new one.
   * Returns the saved URI, or null if there was nothing to seal.
   */
  private async sealCurrentSegment(): Promise<string | null> {
    if (!this.current) return null;

    let tempUri: string | null | undefined;
    try {
      await this.current.stop();
      tempUri = this.current.uri;
    } catch {
      tempUri = this.current.uri;
    }
    this.current = null;

    if (this.segmentStartedAt != null) {
      this.accumulatedMs += Date.now() - this.segmentStartedAt;
      this.segmentStartedAt = null;
    }

    if (!tempUri) return null;
    const saved = await this.persistSegment(tempUri);
    this.files.push(saved);
    try { this.onChunkReady?.(saved); } catch { /* caller error */ }
    return saved;
  }

  /** Seal the current segment, emit it, start a fresh one. */
  private async rotateChunk(): Promise<void> {
    if (this.rotating) return;
    if (!this.current || this.segmentStartedAt == null) return; // paused — skip
    this.rotating = true;
    try {
      await this.sealCurrentSegment();
      await this.beginNewSegment();
    } finally {
      this.rotating = false;
    }
  }

  /**
   * Force-seal the in-progress segment immediately and start a new one.
   * Called when returning to the foreground so audio captured while
   * backgrounded/locked is sealed and transcribed.
   */
  async flushCurrentChunk(): Promise<void> {
    if (this.rotating) return;
    if (!this.current || this.segmentStartedAt == null) return;
    this.rotating = true;
    try {
      await this.sealCurrentSegment();
      await this.beginNewSegment();
    } catch {
      // best-effort: prior segment is already persisted by sealCurrentSegment
    } finally {
      this.rotating = false;
    }
  }

  /** True when a native segment is actively capturing audio. */
  isCapturing(): boolean {
    return this.current != null && this.segmentStartedAt != null;
  }

  /**
   * Make sure a segment is actively capturing, restarting one if the recorder
   * was invalidated (e.g. iOS tore down the audio session during a background
   * suspension). Called on foreground return so a dropped session recovers
   * instead of leaving the UI stuck on a "recording" state that captures
   * nothing. Returns true if capturing after the call.
   */
  async ensureCapturing(): Promise<boolean> {
    if (this.rotating) await this.waitForRotation();
    if (this.isCapturing()) return true;
    try {
      await SermonRecorder.configureSession();
      await this.beginNewSegment();
      if (this.chunkTimer == null) this.startChunkTimer();
      return this.isCapturing();
    } catch {
      return false;
    }
  }

  /** Wait for an in-flight chunk rotation to finish (bounded). */
  private async waitForRotation(): Promise<void> {
    const deadline = Date.now() + 2000;
    while (this.rotating && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  async pause(): Promise<void> {
    this.stopChunkTimer();
    await this.waitForRotation();
    if (!this.current) return;
    try { this.current.pause(); } catch { /* ignore */ }
    if (this.segmentStartedAt != null) {
      this.accumulatedMs += Date.now() - this.segmentStartedAt;
      this.segmentStartedAt = null;
    }
  }

  async resume(): Promise<void> {
    if (!this.current) return;
    try { this.current.record(); } catch { /* ignore */ }
    this.segmentStartedAt = Date.now();
    this.startChunkTimer();
  }

  async stop(): Promise<{ uris: string[]; durationMs: number }> {
    this.stopChunkTimer();
    await this.waitForRotation();
    await this.sealCurrentSegment();
    await setIsAudioActiveAsync(false).catch(() => undefined);
    return { uris: [...this.files], durationMs: this.accumulatedMs };
  }

  /** Force-release the native recorder without sealing/persisting — used to
   *  clear a stale recorder before starting a fresh session. */
  async dispose(): Promise<void> {
    this.stopChunkTimer();
    try { await this.current?.stop(); } catch { /* already gone */ }
    this.current = null;
    this.segmentStartedAt = null;
    await setIsAudioActiveAsync(false).catch(() => undefined);
  }

  getElapsedMs(): number {
    const live = this.segmentStartedAt != null ? Date.now() - this.segmentStartedAt : 0;
    return this.accumulatedMs + live;
  }

  /**
   * Current input level as 0..1 for the live waveform, derived from the
   * recorder's metering (dBFS, roughly -60 quiet … 0 loud). Returns 0 when
   * metering isn't available (e.g. between segments), so the UI can fall back
   * to a gentle idle animation.
   */
  getMeterLevel(): number {
    try {
      const db = this.current?.getStatus?.().metering;
      if (typeof db !== 'number' || Number.isNaN(db)) return 0;
      const norm = (db + 60) / 60; // -60dB → 0, 0dB → 1
      return Math.max(0, Math.min(1, norm));
    } catch {
      return 0;
    }
  }

  /** Snapshot of all segments persisted so far (for mid-recording drafts). */
  getCurrentUris(): string[] {
    return [...this.files];
  }

  private async persistSegment(tempUri: string): Promise<string> {
    const idx = this.files.length;
    const ext = tempUri.split('.').pop() || 'm4a';
    const dest = `${this.targetDir}part-${String(idx).padStart(3, '0')}.${ext}`;
    try {
      await FileSystem.moveAsync({ from: tempUri, to: dest });
    } catch {
      await FileSystem.copyAsync({ from: tempUri, to: dest });
    }
    return dest;
  }
}
