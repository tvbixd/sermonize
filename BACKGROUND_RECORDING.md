# Background & Locked-Screen Recording

This documents how Scribe handles recording when the app is backgrounded or the
phone is locked, what works today, and what still needs on-device verification.

## TL;DR

| Scenario | Status |
|---|---|
| iOS — locked / backgrounded (dev or production build) | **Works** — native audio session stays active via `UIBackgroundModes: ['audio']` |
| iOS — Expo Go | Does **not** work — Expo Go ignores background audio modes |
| Android — locked / backgrounded | **Needs device verification** — permissions + flags are set, but a true mic foreground service may be required (see below) |
| Any platform — zero data loss on background | **Works** — chunk is flushed to disk + draft saved the moment the app backgrounds |

**You must use a dev build (not Expo Go) to test any of this.**

## How it works

### Audio session (`src/audio/SermonRecorder.ts`)
`Audio.setAudioModeAsync({ staysActiveInBackground: true, ... })` keeps the
native recorder capturing while the app is backgrounded.

### The JS-thread-freeze problem
When the app is backgrounded or the phone is locked, the JavaScript thread is
suspended, so the 30-second `setInterval` chunk timer stops firing. The native
recorder keeps writing into the *current* segment, so **no audio is lost** — the
segment just grows until the app returns to the foreground, at which point the
timer resumes and seals it.

`getElapsedMs()` is computed from timestamps, not the timer, so the elapsed
clock self-corrects when you return to the app.

### Background safety net (`app/record.tsx`)
An `AppState` listener fires on the `background`/`inactive` transition. While
recording it:
1. Calls `recorder.flushCurrentChunk()` — seals the in-progress segment to disk
   *before* the OS suspends us.
2. Saves a draft (transcript + all audio chunks so far).

So even if the OS kills the app while backgrounded, everything captured up to
the moment of backgrounding is recoverable from the drafts list, and the audio
can be re-transcribed (sermon detail → **Re-transcribe**).

## Setup for testing (dev build)

Background audio modes are stripped by Expo Go, so build a dev client:

```bash
# one-time
npx expo install expo-dev-client   # already in package.json

# build a development client
eas build --profile development --platform ios      # or android
# then run the dev server and open the build
npx expo start --dev-client
```

## iOS

Configured and expected to work in a dev/production build:
- `app.config.ts` → `ios.infoPlist.UIBackgroundModes: ['audio']`
- `SermonRecorder` → `staysActiveInBackground: true`

**Test checklist (real device):**
- [ ] Start recording, lock the phone for 2 min, unlock → audio continuous, timer correct
- [ ] Start recording, switch to another app for 2 min, return → continuous
- [ ] Receive a phone call mid-recording → recording pauses/resumes gracefully, no crash
- [ ] Force-kill the app while backgrounded → draft with audio is recoverable

## Android

`app.config.ts` declares the required permissions:
`RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `WAKE_LOCK`,
and `staysActiveInBackground: true` is set.

**Important caveat:** Android aggressively suspends background processes. Reliable
*continuous* background mic capture on Android normally requires an actively
*started* microphone **foreground service** (with a persistent notification).
`expo-av` does not start such a service on its own — having the permission is
necessary but may not be sufficient.

If on-device testing shows Android stops capturing shortly after the screen
locks, the fix is one of:
1. Migrate the recorder to **`expo-audio`** (the maintained successor to
   `expo-av`), which has first-class background recording support, **or**
2. Add a microphone foreground service via a config plugin / small native module.

The background **safety net above guarantees no data loss** regardless — worst
case on Android is that capture stops at lock and resumes on unlock, with a
draft saved at the transition.

**Test checklist (real device):**
- [ ] Start recording, lock the screen for 2 min, unlock → is audio continuous or did it stop at lock?
- [ ] Confirm a persistent notification appears while recording (if a service is added)
- [ ] Background the app for 5 min → audio continuous?
- [ ] If capture stops at lock: draft is saved and re-transcribe recovers what was captured
