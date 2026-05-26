# Scribe — Launch Readiness Plan

## Phase 0: Recording Resilience (Critical — Do First)
The biggest user-facing risk: hitting the Groq rate limit mid-sermon and losing transcription.

### 0A. Detect rate limit and auto-save
- When `RateLimitError` fires, track consecutive failures (already partially done via `failedChunksRef`)
- After **3 consecutive** rate-limited chunks (~90 seconds of lost transcription), show a **persistent alert** (not a dismissible banner) asking the user:
  - "Stop & Save" — saves the sermon as a draft with whatever transcript exists + all audio files
  - "Keep Recording" — continues recording audio-only (user accepts gaps in transcript)
- Show a **persistent "Audio Only" indicator** if user chooses to keep going

### 0B. Re-transcribe from saved audio
- Audio chunks are already saved to disk (`sermons/{id}/audio/part-NNN.m4a`)
- Add a "Re-transcribe" button on sermon detail for drafts/incomplete sermons
- Reads the saved audio files and re-runs the full transcription + outline pipeline
- This turns a rate-limited recording from "lost" to "delayed"

### 0C. Show recording limits upfront
- Add a note on the recording screen (idle state): "Free tier: ~2 hours/day"
- Parse Groq 429 response body for actual `retry-after` value instead of hardcoding 60s
- Track daily usage locally (sum of chunk durations sent) and show remaining estimate in Settings

### 0D. Prevent total data loss
- Auto-save draft every 5 minutes during recording (transcript + audio URIs so far)
- If app crashes or is killed, the draft is recoverable from the sermons list
- On app reopen, detect orphaned audio directories without a matching sermon JSON and offer recovery

---

## Phase 1: Production Build & Real-Device Testing
Expo Go hides real-world issues. Must test on actual hardware before any public release.

### 1A. Switch to dev build
- `npx expo install expo-dev-client`
- Create EAS development build profile
- Test on physical iPhone and Android device

### 1B. Test critical paths on device
- [ ] Record a 30+ minute sermon — verify no memory pressure kills the app
- [ ] Background the app mid-recording — verify `UIBackgroundModes: audio` works
- [ ] Kill the app mid-recording — verify draft recovery (after 0D)
- [ ] Test with airplane mode toggled mid-recording
- [ ] Test microphone permissions (first launch, denied, then re-enabled)

### 1C. Enable Google & Apple Sign-In
- Requires dev build (not Expo Go)
- Configure Supabase Google OAuth provider
- Configure Apple Sign-In entitlement
- Test the full auth flow on both platforms

---

## Phase 2: Crash Reporting & Analytics

### 2A. Add Sentry (or Expo Updates error reporting)
- `npx expo install @sentry/react-native`
- Capture unhandled JS errors + native crashes
- Tag errors with: recording state, sermon length, chunk count

### 2B. Basic analytics
- Track: recordings started, completed, abandoned, rate-limited
- Track: average sermon length, most-used features
- Keep it minimal — Expo Application Analytics or a simple Supabase events table

---

## Phase 3: Offline & Edge Cases

### 3A. Offline recording mode
- If no internet at record start, allow recording anyway (audio-only)
- Queue transcription for when connectivity returns (re-transcribe from saved audio)
- Show clear "Offline — audio only" indicator

### 3B. Long recording stress test
- Test 1-hour, 2-hour, 3-hour recordings
- Monitor memory usage (audio chunks should be freed after transcription)
- Verify expo-av doesn't leak file handles on chunk rotation

### 3C. Storage management
- Show total storage used by audio files in Settings
- Option to delete audio files after transcription is confirmed complete
- Warn when device storage is low

---

## Phase 4: Polish & App Store Prep

### 4A. App Store assets
- App icon (1024x1024)
- Screenshots for iPhone 6.7", 6.1", iPad
- App description, keywords, privacy policy URL
- Terms of service

### 4B. Onboarding improvements
- First-launch walkthrough explaining: Groq key setup, recording limits, what Scribe does
- Make Groq key setup less technical (link to signup, explain what it is)

### 4C. Accessibility
- VoiceOver labels on all interactive elements
- Dynamic Type support
- Minimum tap targets (44x44pt)

### 4D. Android-specific
- Test on 3+ Android devices (different screen sizes)
- Handle Android back button correctly throughout
- Verify RECORD_AUDIO + FOREGROUND_SERVICE permissions flow

---

## Phase 5: Beta Testing

### 5A. TestFlight (iOS) + Internal Testing (Android)
- Build production profile: `eas build --profile production`
- Submit to TestFlight / Google Play internal testing
- Invite 5-10 real pastors/preachers for feedback

### 5B. Feedback loop
- In-app feedback button (simple email or form)
- Collect: sermon length, recording quality, pain points
- 2-week beta minimum before public launch

---

## Priority Order
1. **Phase 0** — Recording resilience (prevents data loss, #1 user complaint)
2. **Phase 1A-1B** — Real device testing (find showstopper bugs)
3. **Phase 2A** — Crash reporting (see what breaks in the wild)
4. **Phase 5A** — Ship to TestFlight immediately after the above
5. Phases 1C, 3, 4 — iterate during beta based on feedback

## Groq Free Tier Limits (Reference)
- ~7,000 audio-seconds/day (~116 minutes of recording)
- ~20 requests/minute for audio transcription
- 25 MB max file size per request
- With 30-second chunks: ~233 chunks/day before daily limit
- Rate limit resets daily (not rolling window)
- Consider: paid Groq tier ($0.04/audio-hour) removes these limits
