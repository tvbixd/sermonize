import { Alert, AppState, type NativeEventSubscription } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { SermonRecorder } from '@/audio/SermonRecorder';

const KEEP_AWAKE_TAG = 'scribe-recording';
import { lookupVerses } from '@/services/bible';
import { findScriptureReferences } from '@/services/scriptureRegex';
import { NetworkError, RateLimitError } from '@/services/errors';
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

  private ticker: ReturnType<typeof setInterval> | null = null;
  private autoSave: ReturnType<typeof setInterval> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Set<Promise<void>>();
  private seenRefs = new Set<string>();
  private rateLimitAlertActive = false;
  private authAlertShown = false;
  private appStateSub: NativeEventSubscription | null = null;

  // ── Transcription queue ────────────────────────────────────────────────────
  // Chunks are transcribed through a small concurrency-limited queue and their
  // text is emitted STRICTLY in capture order, so raising MAX_CONCURRENT can
  // never scramble the transcript. With ~8s chunks a couple in flight keeps up
  // with the recorder without bursting the transcription rate limit.
  private static readonly MAX_CONCURRENT = 2;
  // Detection runs over the tail of the accumulated transcript (not the isolated
  // chunk) so references split across a chunk boundary are still caught.
  private static readonly DETECT_WINDOW = 260;
  // A rate-limited chunk is retried this many times (with backoff) before it's
  // skipped and the user is told — so a brief 429 doesn't drop audio text.
  private static readonly MAX_RATE_RETRIES = 3;
  private queue: { seq: number; uri: string; tries: number }[] = [];
  private enqueuedSeq = 0;
  private nextEmit = 0;
  private active = 0;
  private draining = false;
  private ready = new Map<number, string>();
  private backoffUntil = 0;
  private backoffTimer: ReturnType<typeof setTimeout> | null = null;

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

  async start(opts: { audioOnly: boolean }): Promise<void> {
    // Never clobber / leak a recorder: if a stale one is still around (e.g. a
    // prior crashed attempt), force-release its native recorder so it can't
    // block the new one with "recorder not prepared".
    if (this.recorder) {
      await this.recorder.dispose().catch(() => undefined);
      this.recorder = null;
    }
    this.audioOnly = opts.audioOnly;
    this.transcript = '';
    this.chunkCount = 0;
    this.failedChunks = 0;
    this.seenRefs = new Set();
    this.pending = new Set();
    this.queue = [];
    this.enqueuedSeq = 0;
    this.nextEmit = 0;
    this.active = 0;
    this.draining = false;
    this.ready = new Map();
    this.backoffUntil = 0;
    if (this.backoffTimer) { clearTimeout(this.backoffTimer); this.backoffTimer = null; }
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
    // Keep the screen awake while recording so it can't auto-dim/lock and
    // silently stop capture. (expo-av can't reliably record while locked.)
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
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
    try { deactivateKeepAwake(KEEP_AWAKE_TAG); } catch { /* not active */ }
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
    // If iOS tore down the audio session while we were backgrounded, the flush
    // above can't seal a live segment and capture is silently dead. When we're
    // meant to be recording, restart a fresh segment so recording actually
    // continues rather than the UI sitting on a frozen "recording" state.
    if (this.store.status === 'recording') {
      const ok = await this.recorder?.ensureCapturing().catch(() => false);
      if (ok === false) {
        this.store.setChunkWarning('Recording was interrupted — tap pause then record to resume');
      }
    }
    await this.autoSaveDraft();
  }

  getElapsedMs(): number {
    return this.recorder?.getElapsedMs() ?? 0;
  }

  /** Live input level 0..1 for the waveform (0 when unavailable). */
  getMeterLevel(): number {
    return this.recorder?.getMeterLevel() ?? 0;
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

  /** Wait for every queued/in-flight chunk to finish transcribing, emitting and
   *  resolving — including items still waiting their turn in the queue. */
  private async waitForPending(timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while ((this.active > 0 || this.queue.length > 0 || this.pending.size > 0) && Date.now() < deadline) {
      await Promise.race([
        Promise.allSettled([...this.pending]),
        new Promise((r) => setTimeout(r, 200)),
      ]);
    }
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
    if (this.audioOnly) return;
    this.queue.push({ seq: this.enqueuedSeq++, uri: chunkUri, tries: 0 });
    this.pump();
  };

  /** Start as many queued chunks as the concurrency limit allows, honouring an
   *  active rate-limit backoff. */
  private pump() {
    const now = Date.now();
    if (now < this.backoffUntil) {
      if (!this.backoffTimer) {
        this.backoffTimer = setTimeout(() => { this.backoffTimer = null; this.pump(); }, this.backoffUntil - now);
      }
      return;
    }
    while (this.active < RecordingEngine.MAX_CONCURRENT && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.active += 1;
      const p = this.transcribeItem(item).finally(() => {
        this.active -= 1;
        this.pending.delete(p);
        this.pump();
      });
      this.pending.add(p);
    }
  }

  /** Transcribe one chunk, then release its text into the in-order emitter. A
   *  rate-limited chunk backs off and retries (audio isn't lost); other failures
   *  still advance the sequence so they can't stall later chunks. */
  private async transcribeItem(item: { seq: number; uri: string; tries: number }) {
    let text = '';
    try {
      text = await transcribeChunks([item.uri]);
    } catch (e) {
      if (e instanceof RateLimitError && item.tries < RecordingEngine.MAX_RATE_RETRIES) {
        // Back off and retry this same chunk (keeps capture order via its seq).
        this.backoffUntil = Math.max(this.backoffUntil, Date.now() + Math.min(e.retryAfterMs || 5000, 30000));
        this.store.setChunkWarning('Catching up on transcription…');
        this.queue.unshift({ ...item, tries: item.tries + 1 });
        return; // don't set ready[seq]; the retry will
      }
      this.handleChunkError(e);
      text = '';
    }
    this.ready.set(item.seq, text);
    await this.drainReady();
  }

  /** Emit ready chunks in capture order (single-flight so ordering holds even
   *  when several transcriptions finish at once). */
  private async drainReady() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.ready.has(this.nextEmit)) {
        const text = this.ready.get(this.nextEmit)!;
        this.ready.delete(this.nextEmit);
        this.nextEmit += 1;
        if (text.trim()) await this.emitChunkText(text);
      }
    } finally {
      this.draining = false;
    }
  }

  /** Append a chunk's text, then detect + resolve scriptures for it. */
  private async emitChunkText(text: string) {
    this.transcript = this.transcript ? this.transcript + ' ' + text : text;
    this.store.appendTranscript(text);
    this.chunkCount += 1;
    this.store.incrementChunk();
    this.failedChunks = 0;
    this.store.setChunkWarning(null);

    // Detect over the tail of the whole transcript, not just this chunk, so a
    // reference split across the boundary ("…Matthew" | "chapter 12…") is caught.
    const windowText = this.transcript.slice(-RecordingEngine.DETECT_WINDOW);
    const refs = findScriptureReferences(windowText).filter((r) => !this.seenRefs.has(r));
    if (refs.length === 0) return;

    refs.forEach((r) => this.seenRefs.add(r));
    // Stage 1 — show the references immediately (local, instant).
    this.store.addDetectedRefs(refs);
    // Stage 2 — fill in verse text as each lookup returns.
    let translation: string | undefined;
    try { translation = await getTranslation(); } catch { translation = undefined; }
    await Promise.all(
      refs.map(async (reference) => {
        try {
          const [resolved] = await lookupVerses([reference], translation);
          this.store.resolveScripture(reference, resolved ?? { reference }, !!resolved?.text);
        } catch {
          this.store.resolveScripture(reference, { reference }, false);
        }
      }),
    );
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
        'The transcription rate limit was hit. Your audio is safe — save now and re-transcribe later, or keep recording audio without transcription.',
      );
    } else if (isAuth && !this.authAlertShown) {
      this.authAlertShown = true;
      void logEvent('auth_error_alert', {});
      this.pauseAndAlert(
        'API Key Problem',
        'The transcription key was rejected, so nothing is being transcribed. Your audio is safe — save now and fix the key in Settings, or keep recording audio only.',
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
