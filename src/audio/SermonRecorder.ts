import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

/**
 * SermonRecorder wraps expo-av's Audio.Recording with start / pause / resume / stop.
 *
 * Recording goes to a single low-bitrate mono AAC file (32 kbps, 16 kHz mono),
 * which keeps a 60-minute sermon comfortably under Whisper's 25 MB limit.
 *
 * If the in-progress file approaches ~22 MB, we transparently rotate to a new
 * file so very long sermons stay under the per-file limit. The list of file
 * URIs is exposed via getAudioUris(); transcription concatenates them.
 *
 * Elapsed-time tracking excludes paused intervals.
 */
export class SermonRecorder {
  private current: Audio.Recording | null = null;
  private files: string[] = [];
  private targetDir: string;

  // elapsed-time bookkeeping (ms)
  private accumulatedMs = 0;
  private segmentStartedAt: number | null = null;

  // size-based rotation
  private static readonly MAX_BYTES = 22 * 1024 * 1024;
  private sizeCheckTimer: ReturnType<typeof setInterval> | null = null;

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
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 32000,
      },
    };
  }

  async start(): Promise<void> {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Microphone permission denied');
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
    await this.beginNewSegment();
    this.startSizeWatcher();
  }

  private async beginNewSegment(): Promise<void> {
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(SermonRecorder.recordingOptions());
    await recording.startAsync();
    this.current = recording;
    this.segmentStartedAt = Date.now();
  }

  async pause(): Promise<void> {
    if (!this.current) return;
    await this.current.pauseAsync();
    if (this.segmentStartedAt != null) {
      this.accumulatedMs += Date.now() - this.segmentStartedAt;
      this.segmentStartedAt = null;
    }
  }

  async resume(): Promise<void> {
    if (!this.current) return;
    await this.current.startAsync();
    this.segmentStartedAt = Date.now();
  }

  /** Stop and unload everything; returns full list of audio URIs and total ms. */
  async stop(): Promise<{ uris: string[]; durationMs: number }> {
    this.stopSizeWatcher();
    if (this.current) {
      try {
        await this.current.stopAndUnloadAsync();
      } catch {
        // already stopped
      }
      const uri = this.current.getURI();
      if (uri) {
        const finalUri = await this.persistSegment(uri);
        this.files.push(finalUri);
      }
      if (this.segmentStartedAt != null) {
        this.accumulatedMs += Date.now() - this.segmentStartedAt;
        this.segmentStartedAt = null;
      }
      this.current = null;
    }
    return { uris: [...this.files], durationMs: this.accumulatedMs };
  }

  /** Move the temp recording file into our target directory with a stable name. */
  private async persistSegment(tempUri: string): Promise<string> {
    const idx = this.files.length;
    const ext = tempUri.split('.').pop() || 'm4a';
    const dest = `${this.targetDir}part-${String(idx).padStart(3, '0')}.${ext}`;
    try {
      await FileSystem.moveAsync({ from: tempUri, to: dest });
    } catch {
      // Fall back to copy; on web the URI may be a blob URL
      await FileSystem.copyAsync({ from: tempUri, to: dest });
    }
    return dest;
  }

  /**
   * Current elapsed recording time (ms), excluding paused intervals.
   * Safe to call frequently from a UI timer.
   */
  getElapsedMs(): number {
    const live = this.segmentStartedAt != null ? Date.now() - this.segmentStartedAt : 0;
    return this.accumulatedMs + live;
  }

  getAudioUris(): string[] {
    return [...this.files];
  }

  // ---- size-based rotation -------------------------------------------------

  private startSizeWatcher() {
    this.sizeCheckTimer = setInterval(() => {
      void this.checkAndRotate();
    }, 15000);
  }

  private stopSizeWatcher() {
    if (this.sizeCheckTimer) {
      clearInterval(this.sizeCheckTimer);
      this.sizeCheckTimer = null;
    }
  }

  private async checkAndRotate(): Promise<void> {
    if (!this.current) return;
    const uri = this.current.getURI();
    if (!uri) return;
    try {
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      // size only present when exists is true
      const size = (info as { size?: number }).size ?? 0;
      if (size >= SermonRecorder.MAX_BYTES) {
        await this.rotate();
      }
    } catch {
      // ignore — we'll try again on the next tick
    }
  }

  private async rotate(): Promise<void> {
    if (!this.current) return;
    const wasPaused = this.segmentStartedAt == null;
    try {
      await this.current.stopAndUnloadAsync();
    } catch {
      // ignore
    }
    const tempUri = this.current.getURI();
    if (tempUri) {
      const finalUri = await this.persistSegment(tempUri);
      this.files.push(finalUri);
    }
    if (this.segmentStartedAt != null) {
      this.accumulatedMs += Date.now() - this.segmentStartedAt;
      this.segmentStartedAt = null;
    }
    this.current = null;
    if (!wasPaused) {
      await this.beginNewSegment();
    }
  }
}
