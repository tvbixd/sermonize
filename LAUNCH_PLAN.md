# Scribe — Launch Readiness Plan

> **Status as of this commit:** All Phase 0, 2, 3 code is shipped; settings/UI
> polish, accessibility, orphan recovery, FAQ/legal pages, dev-build setup are
> shipped. Phases 1 and 5 are device-testing and store-submission work — see
> `LAUNCH_CHECKLIST.md`.

## Phase 0: Recording Resilience — ✅ Done
The biggest user-facing risk was hitting the Groq rate limit mid-sermon and
losing transcription.

### 0A. Detect rate limit and auto-save — ✅
- `RateLimitError` tracks **consecutive** failures
- After 3 consecutive rate-limited chunks, persistent `Alert.alert` with:
  Stop & Save / Continue (Audio Only) / Keep Trying
- Persistent blue banner shows when in audio-only mode

### 0B. Re-transcribe from saved audio — ✅
- Sermon detail shows **Re-transcribe** button for drafts and any sermon with
  saved audio. Reads chunks from disk, re-runs the full pipeline.

### 0C. Show recording limits upfront — ✅
- Idle recording screen shows "Free tier: ~2 hours of transcription per day"
- `whisper.ts` parses real `retry-after` from Groq's 429 response body

### 0D. Prevent total data loss — ✅
- Auto-save draft every 5 minutes during recording (transcript + audio so far)
- `AppState` listener flushes the in-progress chunk and saves a draft on
  background/lock transition
- `recoverOrphanedAudio()` runs on app launch — converts any audio directory
  without a matching sermon JSON into a recoverable draft

---

## Phase 1: Production Build & Real-Device Testing — 🟡 You

Code is ready; device testing is your work.

### 1A. Switch to dev build — ✅
- `expo-dev-client` is in dependencies; `app.config.ts` lists the plugin

### 1B. Test critical paths on device — 🟡 (you)
See `LAUNCH_CHECKLIST.md` for the full checklist.

### 1C. Enable Google & Apple Sign-In — 🟡 (you, Supabase)
- Buttons already wired in `app/sign-in.tsx`; will work once Supabase OAuth
  providers are configured. See `LAUNCH_CHECKLIST.md`.

### 1D. Background recording + lock-screen UI
- Background recording configured in `app.config.ts` + `SermonRecorder` —
  see `BACKGROUND_RECORDING.md`. iOS expected to work in a dev build; Android
  needs device verification (safety net guarantees no data loss either way).
- Lock-screen UI (iOS Live Activity / Android `MediaStyle` notification) —
  full plan in `LOCK_SCREEN_UI.md`. Deferred until background capture is
  verified on device.

---

## Phase 2: Crash Reporting & Analytics — ✅ Done

### 2A. Local crash + event logger — ✅
- `src/services/logger.ts` persists crashes (with stack + context) and events
  to `documentDirectory/logs/` (no network dependency, works offline)
- `ErrorBoundary` automatically logs crashes
- Settings → Storage → Error log with "Clear" action

### 2B. Basic analytics — ✅
Events tracked: `recording_started`, `recording_paused`, `recording_resumed`,
`recording_completed`, `recording_backgrounded`, `rate_limit_alert`,
`orphaned_audio_recovered`.

> **Sentry**: not added because the app runs primarily through Expo Go for
> development and Sentry needs a dev build to fully install. The local logger
> covers the same diagnostic need until you're on a dev build. Adding Sentry
> later is a one-file change.

---

## Phase 3: Offline & Edge Cases — ✅ Done

### 3A. Offline recording mode — ✅
- `checkConnectivity()` pings Groq with a 5-second timeout before recording
- If offline, prompt: "Record Audio Only" or "Cancel"
- Saved audio can be re-transcribed later via Re-transcribe

### 3B. Long recording stress test — 🟡 (you, device)
- Code-side ready: `SermonRecorder` rotates 30s chunks, frees memory after
  each chunk, retries on cleanup failure. Needs real-device verification.

### 3C. Storage management — ✅
- Settings → Storage shows audio recordings in MB and error log size
- `getAudioStorageBytes()` + `deleteAudioForSermon()` utilities ready for a
  per-sermon delete-audio button if you want one post-launch

---

## Phase 4: Polish & App Store Prep — ✅ Code, 🟡 Assets

### 4A. App Store assets — 🟡 (you)
- Icon exists (`assets/icon.png`)
- Screenshots/description/keywords: see `LAUNCH_CHECKLIST.md`

### 4B. Onboarding improvements — ✅
- Groq setup screen links to console.groq.com with explanatory copy
- Idle recording screen shows the free-tier limit
- Inline FAQ (Settings → Help & FAQ) explains every common question

### 4C. Accessibility — ✅
- `accessibilityLabel` + `accessibilityRole` on the record button, stop/discard
  buttons, sign-in provider buttons, sermon list rows, folder rows, settings
  rows, FAQ entries
- All button targets meet the 44pt minimum (existing styling)
- Dynamic Type: respected via `typography` constants from theme

### 4D. Android-specific — 🟡 (you, device)

---

## Phase 5: Beta Testing — 🟡 You

See `LAUNCH_CHECKLIST.md` for the EAS commands and submission steps.

---

## Groq Free Tier Limits (Reference)
- ~7,000 audio-seconds/day (~116 minutes of recording)
- ~20 requests/minute for audio transcription
- 25 MB max file size per request
- With 30-second chunks: ~233 chunks/day before the daily limit
- Rate limit resets daily (not a rolling window)
- Paid tier ($0.04/audio-hour) removes the cap
