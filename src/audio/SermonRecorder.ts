import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * SermonRecorder — chunk-based recorder for real-time transcription.
 *
 * Every CHUNK_MS (default 30s) the current segment is sealed and
 * `onChunkReady` is called with its URI so callers can transcribe it
 * immediately. A new segment starts right away, giving seamless recording.
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
        bitRate: 32000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.LOW,
        sampleRate: 16000,
        numberOfChannels: 1,
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
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(SermonRecorder.recordingOptions());
    await rec.startAsync();
    this.current = rec;
    this.segmentStartedAt = Date.now();
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

  /** Seal the current segment, emit it, start a fresh one. */
  private async rotateChunk(): Promise<void> {
    if (!this.current || this.segmentStartedAt == null) return; // paused — skip

    let tempUri: string | null | undefined;
    try {
      await this.current.stopAndUnloadAsync();
      tempUri = this.current.getURI();
    } catch {
      // ignore — will try again next tick
    }
    this.current = null;

    if (this.segmentStartedAt != null) {
      this.accumulatedMs += Date.now() - this.segmentStartedAt;
      this.segmentStartedAt = null;
    }

    if (tempUri) {
      const saved = await this.persistSegment(tempUri);
      this.files.push(saved);
      try { this.onChunkReady?.(saved); } catch { /* caller error */ }
    }

    // Start the next segment immediately
    await this.beginNewSegment();
  }

  async pause(): Promise<void> {
    if (!this.current) return;
    this.stopChunkTimer();
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

    if (this.current) {
      let tempUri: string | null | undefined;
      try {
        await this.current.stopAndUnloadAsync();
        tempUri = this.current.getURI();
      } catch { /* ignore */ }

      if (this.segmentStartedAt != null) {
        this.accumulatedMs += Date.now() - this.segmentStartedAt;
        this.segmentStartedAt = null;
      }
      this.current = null;

      if (tempUri) {
        const saved = await this.persistSegment(tempUri);
        this.files.push(saved);
        // Emit final partial chunk for transcription too
        try { this.onChunkReady?.(saved); } catch { /* caller error */ }
      }
    }

    return { uris: [...this.files], durationMs: this.accumulatedMs };
  }

  getElapsedMs(): number {
    const live = this.segmentStartedAt != null ? Date.now() - this.segmentStartedAt : 0;
    return this.accumulatedMs + live;
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
