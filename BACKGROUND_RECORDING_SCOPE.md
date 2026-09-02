# Background Recording — Technical Scope

**Goal:** record a full sermon (30–60 min) reliably while the phone is **locked**
or Scribe is in the **background**, on both iOS and Android.

**Current state:** works only with the app **open and screen awake**. `expo-av`
(the recording library, now deprecated) stops capturing when iOS locks. Android
stops capturing when backgrounded because there's no foreground service. The
morning test proved it: a 26-min locked recording transcribed only the first
~1–2 minutes (pre-lock).

---

## Why this is genuinely hard

Two separate platform problems:

### iOS
Background audio recording *is* possible — Voice Memos, Otter, etc. do it — but it
needs a correctly configured **AVAudioSession** that stays active in the
background, plus `UIBackgroundModes: audio` (we have that). `expo-av`'s
implementation doesn't hold the session reliably through a screen lock. So the
fix is a **recorder that keeps the session alive when locked**.

### Android
Background mic access **requires a foreground service** with
`foregroundServiceType="microphone"` and a persistent notification (enforced on
Android 14+). `expo-av` runs no such service, so the OS cuts the mic the moment
the app backgrounds. This *also* means re-adding the `FOREGROUND_SERVICE_MICROPHONE`
permission and completing Google Play's foreground-service **declaration form**.

### Chunking
Today, chunk rotation runs on a JS `setInterval`, which **freezes when
backgrounded**. So even if native capture continued, JS-driven rotation + live
transcription would stall. Two ways to handle it:
- **(A) One continuous file**, sealed and transcribed at Stop. Simplest, most
  robust. Live scriptures only update while foregrounded (fine — you glance when
  you want; the full sermon transcribes at the end).
- **(B) Native-driven rotation** — the native layer rotates chunk files on its
  own timer and emits events. Enables live processing in the background, but
  much more complex.
Recommendation: **(A)** for the rewrite.

---

## Options

### Option 1 — Migrate to `expo-audio` (lowest effort, try first)
`expo-audio` is Expo's modern replacement for `expo-av`'s audio. Same ecosystem,
has a config plugin, stays in the managed workflow.
- **Effort:** ~2–4 focused days + device testing.
- **Pros:** small footprint; no ejecting; actively maintained (expo-av is EOL).
- **Cons/unknowns:** its iOS background-recording reliability must be **verified
  on a device** — it may still have gaps. Does **not** solve Android background
  (still needs a foreground service).
- **Verdict:** worth a spike first. If it records through an iOS lock cleanly,
  it's the cheapest win for the platform you care most about.

### Option 2 — Custom native module (most reliable, most effort)
Write native recording: **iOS** (Swift, AVAudioSession + AVAudioRecorder/Engine
configured for background) and **Android** (Kotlin, a foreground service +
MediaRecorder/AudioRecord). Rotate/seal files natively, emit events to JS.
- **Effort:** ~1–2 weeks, plus several device build/test cycles.
- **Pros:** Voice-Memos-level reliability on both platforms; full control.
- **Cons:** significant native code; needs a config plugin (to stay in CNG) or a
  bare workflow; I **cannot verify any of it from here** — it's all on-device.
- **Verdict:** the real answer if Option 1's background proves unreliable, or
  once Android background is a must.

### Option 3 — Off-the-shelf recording libs
`react-native-audio-recorder-player`, `react-native-nitro-sound`,
`@fugood/react-native-audio-pcm-stream`, etc. Background support varies and is
often as flaky as expo-av for locked recording; most still need the Android
foreground service. Not clearly better than Option 1. Low priority.

---

## Recommended plan (phased)

**Phase 0 — Launch as-is (now).** Ship with "keep Scribe open while recording"
(screen stays awake, phone near the preacher). This is reliable today and is how
many recording apps ship v1. Set the expectation in onboarding/UX copy.

**Phase 1 — iOS background via `expo-audio` spike (post-launch, ~1 week incl.
testing).** Migrate the recorder to `expo-audio`; test locked recording on a real
device. If solid → iOS users can lock the phone.

**Phase 2 — Android foreground service (post-launch, ~1 week).** Add a mic
foreground service (config plugin + native service + notification), re-add the
permission, and complete Play's declaration. Then Android background works too.

**Phase 3 — (only if Phase 1 fails) full native module** for iOS as well.

---

## What it does NOT change
Transcription accuracy still depends on **mic placement** — phone close to the
preacher / near a speaker. Background recording captures more *audio*, but faint
room audio still transcribes poorly regardless of the recorder.

## Honest caveat
Every option here is native and **can't be validated in this environment** — each
needs real iOS/Android builds and on-device testing. Budget build cycles
accordingly. Phase 0 (launch on "keep it open") de-risks the launch while the
background work happens deliberately.
