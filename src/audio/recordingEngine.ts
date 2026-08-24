import { Alert, AppState, type NativeEventSubscription } from 'react-native';
import { SermonRecorder } from '@/audio/SermonRecorder';
import { lookupVerses } from '@/services/bible';
import { findScriptureReferences } from '@/services/scriptureRegex';
import { NetworkError, RateLimitError } from '@/services/whisper';
import { transcribeChunks } from '@/services/transcription';
import { useSessionStore } from '@/state/sessionStore';
import { getTranslation } from '@/storage/keys';
import { deleteSermon, ensureAudioDir, saveSermon } from '@/storage/sermons';
import type { Sermon } from '@/types';
import { newId } from '@/util/id';
import { heavyTap } from '@/util/haptics';
import { logEvent } from '@/services/logger';

/**
 * Recording lives here — in a module singleton — rather than inside the record
 * screen component, so recording keeps running when the user navigates away
 * (and a global "Recording…" bar can bring them back). The record screen and
 * the bar are thin views over this engine + the session store.
 *
 * The engine owns the recorder and the live loop (transcribe → detect
 * scriptures). The *finalization* on Stop (outline + scripture lookup + save)
 * stays in the record screen, which calls `stopForFinalize()` to get the data.
 */
class RecordingEngine {
  private recorder: SermonRecorder | null = null;
  private sermonId = '';
  private startedAt = 0;
  private transcript = '';
  private chunkCount = 0;
  private failedChunks = 0;
  private audioOnly = false;
  private groqKey = '';

  private ticker: ReturnType<typeof setInterval> | null = null;
  private autoSave: ReturnType<typeof setInterval> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Set<Promise<void>>();
  private seenRefs = new Set<string>();
  private rateLimitAlertActive = false;
  private authAlertShown = false;
  private appStateSub: NativeEventSubscription | null = null;

  private get store() {
    return useSessionStore.getState();
  }

  isActive(): boolean {
    const s = this.store.status;
    return s === 'recording' || s === 'paused';
  }

  getSermonId() {
    return this.sermonId;
  }

  getTranscript() {
    return this.transcript;
  }

  getStartedAt() {
    return this.startedAt;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(opts: { groqKey: string; audioOnly: boolean }): Promise<void> {
    // Never clobber a live recording: if one is somehow still around, tear it
    // down first so we don't orphan a native recorder + its timers.
    if (this.recorder) {
      await this.discard().catch(() => undefined);
    }
    this.groqKey = opts.groqKey;
    this.audioOnly = opts.audioOnly;
    this.transcript = '';
    this.chunkCount = 0;
    this.failedChunks = 0;
    this.seenRefs = new Set();
    this.pending = new Set();
    this.rateLimitAlertActive = false;
    this.authAlertShown = false;

    this.store.reset();
    if (opts.audioOnly) this.store.setAudioOnlyMode(true);

    this.sermonId = newId();
    this.startedAt = Date.now();
    const dir = await ensureAudioDir(this.sermonId);
    const recorder = new SermonRecorder(dir);
    await recorder.start((uri) => this.onChunkReady(uri));
    this.recorder = recorder;

    this.store.setStatus('recording');
    this.startTicker();
    this.autoSave = setInterval(() => void this.autoSaveDraft(), 5 * 60 * 1000);
    // Background-flush must work regardless of which screen is showing, so the
    // engine (not the record screen) owns the AppState subscription.
    this.appStateSub?.remove();
    this.appStateSub = AppState.addEventListener('change', (next) => {
      // On background: do NOT stop/restart the recorder — that heavy native
      // work at the moment iOS is suspending us can leave the audio session
      // broken and crash the recording. iOS keeps capturing into the current
      // segment via background-audio mode; we just persist a cheap draft.
      if (next === 'background') void this.onBackground();
      // Back in the foreground (full JS time again): seal the long segment
      // recorded while backgrounded so it gets transcribed, and resume rotation.
      else if (next === 'active') void this.onForeground();
    });
    void logEvent('recording_started', { audioOnly: opts.audioOnly });
  }

  private teardown() {
    this.stopTicker();
    this.clearAutoSave();
    if (this.warningTimer) { clearTimeout(this.warningTimer); this.warningTimer = null; }
    this.appStateSub?.remove();
    this.appStateSub = null;
  }

  async pause(): Promise<void> {
    await this.recorder?.pause().catch(() => undefined);
    this.stopTicker();
    this.store.setStatus('paused');
    void logEvent('recording_paused');
  }

  async resume(): Promise<void> {
    await this.recorder?.resume().catch(() => undefined);
    this.store.setStatus('recording');
    this.startTicker();
    void logEvent('recording_resumed');
  }

  /** Stop the recorder and return the captured data for finalization. Leaves
   *  session state intact so the caller can build + save the sermon. */
  async stopForFinalize(): Promise<{ uris: string[]; durationMs: number; transcript: string }> {
    this.teardown();
    // Snapshot chunks already persisted to disk BEFORE stop(), so a failed
    // final-seal never drops the earlier chunks (which would orphan them).
    const persisted = this.recorder?.getCurrentUris() ?? [];
    const result = await this.recorder?.stop().catch(() => undefined);
    await this.waitForPending();
    this.recorder = null;
    const uris = result?.uris ?? [];
    return {
      uris: uris.length >= persisted.length ? uris : persisted,
      durationMs: result?.durationMs ?? 0,
      transcript: this.transcript,
    };
  }

  /** Stop and save the current session as a draft (transcript + audio so far). */
  async saveDraft(): Promise<void> {
    this.teardown();
    const result = await this.recorder?.stop().catch(() => undefined);
    await this.waitForPending(8000);
    this.recorder = null;
    await saveSermon(this.draftSermon(result?.uris ?? [], result?.durationMs ?? 0)).catch(() => {});
    this.store.reset();
  }

  /** Stop and delete everything on disk for this session. */
  async discard(): Promise<void> {
    this.teardown();
    await this.recorder?.stop().catch(() => undefined);
    this.recorder = null;
    if (this.sermonId) await deleteSermon(this.sermonId).catch(() => {});
    this.store.reset();
  }

  /** App went to background. Keep the recorder running (iOS background audio
   *  keeps capturing); just save a cheap draft of what's already sealed. We do
   *  NOT seal/restart here — doing native recorder work during the suspend
   *  transition is what was destabilizing long recordings. */
  private async onBackground(): Promise<void> {
    if (!this.isActive()) return;
    void logEvent('recording_backgrounded');
    await this.autoSaveDraft();
  }

  /** App returned to the foreground with full JS time. Seal the (possibly very
   *  long) segment captured while backgrounded so it gets transcribed, and let
   *  normal rotation resume. */
  private async onForeground(): Promise<void> {
    if (!this.isActive()) return;
    await this.recorder?.flushCurrentChunk().catch(() => undefined);
    await this.autoSaveDraft();
  }

  getElapsedMs(): number {
    return this.recorder?.getElapsedMs() ?? 0;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private startTicker() {
    this.stopTicker();
    this.ticker = setInterval(() => {
      if (this.recorder) this.store.setElapsed(this.recorder.getElapsedMs());
    }, 500);
  }

  private stopTicker() {
    if (this.ticker) { clearInterval(this.ticker); this.ticker = null; }
  }

  private clearAutoSave() {
    if (this.autoSave) { clearInterval(this.autoSave); this.autoSave = null; }
  }

  private async waitForPending(timeoutMs = 20000) {
    if (this.pending.size === 0) return;
    await Promise.race([
      Promise.allSettled([...this.pending]),
      new Promise((r) => setTimeout(r, timeoutMs)),
    ]);
  }

  private draftSermon(uris: string[], durationMs: number): Sermon {
    return {
      id: this.sermonId,
      createdAt: this.startedAt || Date.now(),
      title: 'Draft — ' + new Date().toLocaleDateString(),
      transcript: this.transcript,
      outline: this.store.liveOutline ?? { title: 'Draft', theme: '', summary: '', points: [] },
      scriptures: [],
      audioUris: uris,
      durationMs,
      isDraft: true,
    };
  }

  private async autoSaveDraft() {
    if (!this.sermonId) return;
    const uris = this.recorder?.getCurrentUris() ?? [];
    if (!this.transcript.trim() && uris.length === 0) return;
    await saveSermon(this.draftSermon(uris, this.recorder?.getElapsedMs() ?? 0)).catch(() => {});
  }

  private onChunkReady = (chunkUri: string) => {
    const p = this.processChunk(chunkUri).finally(() => this.pending.delete(p));
    this.pending.add(p);
  };

  private async processChunk(chunkUri: string) {
    if (this.audioOnly) return;
    try {
      const text = await transcribeChunks([chunkUri], this.groqKey);
      if (!text.trim()) return;
      this.transcript = this.transcript ? this.transcript + ' ' + text : text;
      this.store.appendTranscript(text);
      this.chunkCount += 1;
      this.store.incrementChunk();
      this.failedChunks = 0;
      this.store.setChunkWarning(null);

      const refs = findScriptureReferences(text).filter((r) => !this.seenRefs.has(r));
      if (refs.length > 0) {
        refs.forEach((r) => this.seenRefs.add(r));
        try {
          const translation = await getTranslation();
          this.store.addLiveScriptures(await lookupVerses(refs, translation));
        } catch {
          this.store.addLiveScriptures(refs.map((reference) => ({ reference })));
        }
      }
    } catch (e) {
      this.handleChunkError(e);
    }
  }

  private handleChunkError(e: unknown) {
    this.failedChunks += 1;
    const count = this.failedChunks;
    const isRateLimit = e instanceof RateLimitError;
    const isNetwork = e instanceof NetworkError;
    const msg = e instanceof Error ? e.message : String(e);
    const isAuth = !isRateLimit && !isNetwork && /\((401|403)\)/.test(msg);

    this.store.setChunkWarning(
      isRateLimit ? 'Transcription limit reached — audio is still being saved'
        : isNetwork ? msg
        : isAuth ? 'API key rejected — audio is still being saved'
        : 'Transcription error — audio is still being saved',
    );
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (!isRateLimit && !isAuth) {
      this.warningTimer = setTimeout(() => this.store.setChunkWarning(null), 10000);
    }

    if (isRateLimit) {
      void logEvent('rate_limit_alert', { consecutiveFailures: count });
      this.pauseAndAlert(
        'Transcription Limit Reached',
        'Your Groq API rate limit has been hit. Your audio is safe — you can save now and re-transcribe later, or keep recording audio without transcription.',
      );
    } else if (isAuth && !this.authAlertShown) {
      this.authAlertShown = true;
      void logEvent('auth_error_alert', {});
      this.pauseAndAlert(
        'API Key Problem',
        'Groq rejected your API key, so nothing is being transcribed. Your audio is safe — you can save now and fix the key in Settings, or keep recording audio only.',
      );
    } else if (isNetwork && count >= 3) {
      heavyTap();
      this.pauseAndAlert('Connection Lost', 'Unable to reach the transcription server. Audio is still being saved.');
    }
  }

  private pauseAndAlert(title: string, message: string) {
    if (this.rateLimitAlertActive) return;
    this.rateLimitAlertActive = true;
    heavyTap();
    void this.recorder?.pause().catch(() => undefined);
    this.stopTicker();
    this.store.setStatus('paused');
    const resume = () => {
      this.rateLimitAlertActive = false;
      this.recorder?.resume().catch(() => undefined);
      this.store.setStatus('recording');
      this.startTicker();
    };
    Alert.alert(title, message, [
      {
        text: 'Stop & Save',
        style: 'default',
        onPress: () => {
          this.rateLimitAlertActive = false;
          // saveDraft() resets to idle, so the bar disappears and the record
          // screen (if mounted) returns to its idle state. The draft is in the
          // sermons list — no forced navigation needed.
          void this.saveDraft();
        },
      },
      {
        text: 'Continue (Audio Only)',
        onPress: () => {
          this.audioOnly = true;
          this.store.setAudioOnlyMode(true);
          this.store.setChunkWarning(null);
          resume();
        },
      },
      { text: 'Keep Trying', style: 'cancel', onPress: resume },
    ]);
  }
}

export const recordingEngine = new RecordingEngine();
