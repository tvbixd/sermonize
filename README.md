# Scribe

Voice-driven sermon note-taking — record a sermon and get a clean outline with
scripture references, transcripts, and exports.

## How it works
1. Tap record. Audio is captured in 30-second chunks, written to disk.
2. Each chunk is transcribed — **on-device** (whisper.rn, no key/limits) or via
   **Groq's Whisper** if a key is set. The transcript is internal plumbing; it is
   never shown or stored as a user-facing artifact.
3. Scripture references are detected in real time and shown as **live scripture
   cards** during the sermon, looked up against **API.Bible** (200+ translations)
   or **bible-api.com** (fallback).
4. When you stop, an **outline** is generated (title, theme, summary, points):
   the free on-device extractive outline by default, or **Groq's Llama 3.3 70B**
   for higher quality when a key is present.
5. Everything is stored locally. No backend required. Optional Supabase auth for
   cross-device sync (planned).

## Resilience
- Recording continues offline (audio-only mode) when there's no internet.
- If Groq is rate-limited, the user is offered Stop&Save / Continue audio-only / Keep Trying.
- Audio is always saved to disk, so any sermon can be re-transcribed later from the sermon detail screen.
- Drafts auto-save every 5 minutes during recording.
- On app launch, orphaned audio directories (from crashes) are converted to recoverable drafts.
- Backgrounding/locking the phone flushes the current chunk to disk before suspension.

## Stack
- Expo SDK 54 + React Native 0.81 + TypeScript
- expo-router (file-based navigation)
- expo-av (recording), expo-file-system, expo-secure-store, expo-sharing, expo-print
- Zustand for session state
- Groq REST API (OpenAI-compatible) for transcription + outlining
- Supabase for auth (email OTP, planned Google/Apple)

## Setup
```sh
cp .env.example .env   # fill in Supabase + optional API.Bible keys
npm install --legacy-peer-deps
npx expo start
```

Then in the app:
1. Sign in (or skip for a test session in dev mode).
2. Open Settings → Groq API Key. Tap the link to create a free key at console.groq.com, paste it.
3. Hit the record button.

## Docs
- `LAUNCH_PLAN.md` — phased plan with status of each item
- `LAUNCH_CHECKLIST.md` — what you need to do before publishing
- `BACKGROUND_RECORDING.md` — iOS/Android background recording status + test plan
- `LOCK_SCREEN_UI.md` — Live Activity / foreground-notification implementation plan (deferred)

## Project layout
```
app/                          # expo-router screens
  _layout.tsx                 # root + ErrorBoundary + orphan recovery on launch
  index.tsx                   # auth gate (folders if signed in, onboarding otherwise)
  onboarding.tsx              # first-run welcome carousel
  sign-in.tsx                 # OAuth + email OTP + post-auth setup steps
  sign-up.tsx                 # thin wrapper around sign-in
  folders.tsx                 # folders list (entry point post-auth)
  sermons.tsx                 # sermons in a folder (incl. Drafts, Recently Deleted)
  record.tsx                  # record / pause / resume / stop + offline + rate-limit handling
  sermon/[id].tsx             # outline / scriptures / transcript tabs + edit + export + re-transcribe
  settings.tsx                # profile, Groq key, translation, storage, FAQ, privacy, support
src/
  audio/SermonRecorder.ts     # chunked recorder with background-flush support
  audio/__tests__/            # ...
  context/auth.tsx            # Supabase session + test-user (dev only)
  services/
    whisper.ts                # Groq Whisper upload + rate-limit parsing
    outline.ts                # Groq Llama outline extraction (JSON-mode)
    scriptureRegex.ts         # detect Bible refs in transcripts
    bible.ts                  # API.Bible + bible-api.com lookup, capped cache
    network.ts                # pre-record connectivity check
    logger.ts                 # local crash + event log
  storage/
    sermons.ts                # JSON-on-disk sermon CRUD + orphan recovery + storage stats
    folders.ts                # folder CRUD
    keys.ts                   # SecureStore-backed Groq key + translation pref
  state/sessionStore.ts       # Zustand recording session state
  config/                     # FAQ content, legal copy, support URLs
  components/                 # ScriptureCard, Skeleton, icons
  util/                       # format, haptics, id
  types.ts                    # Sermon, Outline, Folder, Scripture, statuses
__tests__/                    # Jest tests for security gates, validation, cache bounds
```

## Tests
```sh
npm test
```

## Commands
- `npm start` — Metro dev server (Expo Go or dev client)
- `npm test` — Jest suite
- `npm run build:dev` / `:preview` / `:prod` — EAS builds
- `npm run submit:ios` / `:android` — store submissions

## Free tier limits
- ~2 hours of transcription per day on Groq's free tier
- Recording length itself is unlimited; only transcription is capped
- Paid Groq tier ($0.04/audio-hour) removes the cap
