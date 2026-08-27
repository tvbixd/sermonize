import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * SermonRecorder — chunk-based recorder for real-time transcription.
 *
 * Every CHUNK_MS (default 30s) the current segment is sealed and
 * `onChunkReady` is called with its URI so callers can transcribe it
 * immediately. A new segment starts right away, giving seamless recording.
 *
 * Background behaviour:
 *   When the app is backgrounded or the phone is locked, the JS thread is
 *   frozen, so the chunk timer stops firing.
 *   - iOS (UIBackgroundModes: audio): the native recorder keeps writing into
 *     the current segment, so no audio is lost — the segment grows until the
 *     app returns to the foreground.
 *   - Android: expo-av runs NO foreground service, so once backgrounded/locked
 *     capture stops. Recording is effectively foreground-only on Android until
 *     we migrate to expo-audio + a mic foreground service (see FUTURE.md /
 *     BACKGROUND_RECORDING.md).
 *
 *   Either way, callers invoke `flushCurrentChunk()` on the AppState
 *   'background' transition so audio captured up to that moment is sealed to
 *   disk before the OS can suspend/kill us.
 *
 * Pause / Resume suspend / restart both the audio and the chunk timer.
 * Stop seals the final partial segment and returns all URIs + duration.
 */
export class SermonRecorder {
  private current: Audio.Recording | null = null;
  private files: string[] = [];
  private targetDir: string;
  private onChunkReady: ((uri: string) => void) | null = null;

  private accumulatedMs = 0;
  private segmentStartedAt: number | null = null;

  private chunkTimer: ReturnType<typeof setInterval> | null = null;
  private rotating = false;
  static readonly CHUNK_MS = 30_000;

  constructor(targetDir: string) {
    this.targetDir = targetDir;
  }

  private static recordingOptions(): Audio.RecordingOptions {
    return {
      isMeteringEnabled: false,
      android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 16000,
        numberOfChannels: 1,
        // 32 kbps is the proven-safe ceiling for 16 kHz mono AAC — higher
        // values (e.g. 64k) make iOS reject prepare with "recorder not prepared".
        bitRate: 32000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.LOW,
        sampleRate: 16000,
        numberOfChannels: 1,
        // 32 kbps is the proven-safe ceiling for 16 kHz mono AAC — higher
        // values (e.g. 64k) make iOS reject prepare with "recorder not prepared".
        bitRate: 32000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
    };
  }

  async start(onChunkReady: (uri: string) => void): Promise<void> {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) throw new Error('Microphone permission denied');

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });

    this.onChunkReady = onChunkReady;
    await this.beginNewSegment();
    this.startChunkTimer();
  }

  private async beginNewSegment(): Promise<void> {
    const attempt = async () => {
      const rec = new Audio.Recording();
      try {
        await rec.prepareToRecordAsync(SermonRecorder.recordingOptions());
        await rec.startAsync();
      } catch (e) {
        // A half-prepared recorder must be unloaded, or expo-av (which allows
        // only ONE prepared recorder at a time) rejects every future prepare
        // with "recorder not prepared".
        try { await rec.stopAndUnloadAsync(); } catch { /* already unloaded */ }
        throw e;
      }
      this.current = rec;
      this.segmentStartedAt = Date.now();
    };

    try {
      await attempt();
    } catch {
      // Most often a stale recorder left by a prior crash. Reset the audio
      // session and retry once — this clears the "not prepared" state.
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      }).catch(() => undefined);
      await new Promise((r) => setTimeout(r, 400));
      await attempt();
    }
  }

  /** Force-release the native recorder without sealing/persisting — used to
   *  clear a stale recorder before starting a fresh session. */
  async dispose(): Promise<void> {
    this.stopChunkTimer();
    try { await this.current?.stopAndUnloadAsync(); } catch { /* already gone */ }
    this.current = null;
    this.segmentStartedAt = null;
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
      await this.current.stopAndUnloadAsync();
      tempUri = this.current.getURI();
    } catch {
      try { await this.current.stopAndUnloadAsync(); } catch { /* exhausted retries */ }
      tempUri = this.current.getURI();
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
   * Call this on the AppState 'background' transition so audio captured up to
   * this moment is safely on disk before the OS suspends the JS thread.
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

  /** Wait for an in-flight chunk rotation to finish (bounded). */
  private async waitForRotation(): Promise<void> {
    const deadline = Date.now() + 2000;
    while (this.rotating && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  async pause(): Promise<void> {
    // Stop the timer first so a rotation can't start after we pause, then
    // wait out any rotation already in flight — otherwise we'd "pause" while
    // the recorder is between segments and the new segment would keep going.
    this.stopChunkTimer();
    await this.waitForRotation();
    if (!this.current) return;
    try { await this.current.pauseAsync(); } catch { /* ignore */ }
    if (this.segmentStartedAt != null) {
      this.accumulatedMs += Date.now() - this.segmentStartedAt;
      this.segmentStartedAt = null;
    }
  }

  async resume(): Promise<void> {
    if (!this.current) return;
    try { await this.current.startAsync(); } catch { /* ignore */ }
    this.segmentStartedAt = Date.now();
    this.startChunkTimer();
  }

  async stop(): Promise<{ uris: string[]; durationMs: number }> {
    this.stopChunkTimer();
    await this.waitForRotation();
    await this.sealCurrentSegment();
    return { uris: [...this.files], durationMs: this.accumulatedMs };
  }

  getElapsedMs(): number {
    const live = this.segmentStartedAt != null ? Date.now() - this.segmentStartedAt : 0;
    return this.accumulatedMs + live;
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
