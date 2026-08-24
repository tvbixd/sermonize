# Lock-Screen Recording UI — Implementation Plan

Goal: show a live recording presence on the lock screen (and iOS Dynamic Island)
while a sermon is recording — similar to iPhone Voice Memos — with elapsed time,
recording/paused state, and quick controls.

> **Prerequisite:** background recording must be verified on a real device first
> (see `BACKGROUND_RECORDING.md`). This feature is meaningless if the underlying
> capture doesn't survive a screen lock. It is also **100% native + dev-build
> only** — none of it runs in Expo Go.

---

## Platform mechanisms

| Platform | Mechanism | Min OS | Gives controls? | Notes |
|---|---|---|---|---|
| iOS | **Live Activity** (ActivityKit) | iOS 16.1 | Buttons need iOS 17 (App Intents) | Lock screen + Dynamic Island |
| iOS | System red recording pill | any | No | **Free today** with `UIBackgroundModes: audio` |
| Android | **Foreground service notification** (`MediaStyle`) | all | Yes | Needed for background recording anyway |

---

## iOS — Live Activity (ActivityKit)

### What has to be built
1. **Widget Extension target** (Swift/SwiftUI) — Live Activities can only be
   rendered from a widget extension, not from React Native.
2. **`ActivityAttributes`** definition:
   ```swift
   struct RecordingAttributes: ActivityAttributes {
     struct ContentState: Codable, Hashable {
       var startedAt: Date      // for Text(timerInterval:) auto-counting
       var isPaused: Bool
       var title: String        // "Recording sermon" / draft title
     }
   }
   ```
3. **SwiftUI views**: lock-screen view + Dynamic Island (compact / minimal /
   expanded). Use `Text(timerInterval:pauseTime:)` so the timer counts **on the
   device** without us pushing an update every second (critical — see budget).
4. **`Info.plist`**: `NSSupportsLiveActivities = true`.
5. **JS ↔ native bridge**: a small Expo Module exposing
   `start(state)`, `update(state)`, `end()`. (Avoid depending on an immature
   third-party lib unless we vet it — see "Build vs library".)
6. **Expo config plugin** to add the widget extension target + Info.plist key at
   prebuild time (so it survives `expo prebuild` / EAS builds without manual
   Xcode steps).

### Update budget (important)
ActivityKit throttles frequent updates. **Do not** push an update on every 250 ms
tick. Instead:
- Drive the live clock with `Text(timerInterval:)` (device-side, free).
- Only call `activity.update()` on **state changes**: pause, resume, title change.
- End the activity on stop.

### Controls
- iOS 16: display-only (tapping opens the app).
- iOS 17+: real buttons via **App Intents** (`LiveActivityIntent`) for
  Pause / Stop, wired back into the recorder.

### Lifecycle wiring (into existing `SermonRecorder` / `record.tsx`)
| App event | ActivityKit call |
|---|---|
| `recorder.start()` | `LiveActivity.start({ startedAt, isPaused:false, title })` |
| `pause()` | `LiveActivity.update({ isPaused:true })` |
| `resume()` | `LiveActivity.update({ isPaused:false, startedAt: now-elapsed })` |
| `stop()` / discard | `LiveActivity.end()` |
| AppState → background | no-op (already counting on-device) |

### Interim (zero work)
The system **red recording indicator** already appears on the lock screen when
recording with `UIBackgroundModes: audio`. Ship that as the v1 "it shows
something" while the Live Activity is built.

---

## Android — Foreground service notification

This doubles as the mechanism that *makes* background recording work, so it
should be built together with the Android background-recording fix.

### What has to be built
1. **Microphone foreground service** (Kotlin) with
   `foregroundServiceType="microphone"`, started when recording begins.
2. **Persistent notification** (`NotificationCompat` / `MediaStyle`) showing:
   - Title ("Recording sermon"), live elapsed time (use a chronometer:
     `setUsesChronometer(true)` + `setWhen(startTime)` so it ticks for free),
     and **Pause / Stop** actions.
3. **Action routing**: notification buttons fire `PendingIntent`s → a
   `BroadcastReceiver` → bridge event into JS to pause/stop the recorder.
4. **Config plugin** to declare the `<service>` + `FOREGROUND_SERVICE_MICROPHONE`
   permission in `AndroidManifest.xml` (permission already added in
   `app.config.ts`; the service element still needs declaring).

### Option: `notifee`
[`@notifee/react-native`](https://notifee.app) provides rich notifications +
foreground-service helpers from JS, which could remove most of the Kotlin. Needs
vetting for SDK 54 / new-architecture compatibility before committing.

---

## Build vs library (decision to make at implementation time)

| Approach | Pros | Cons |
|---|---|---|
| **Custom Expo Module + config plugin** | Full control, no upstream risk, exactly our UI | Most work; native Swift + Kotlin |
| **Community libs** (`expo-live-activity`, `notifee`) | Much faster | Maturity / new-arch / SDK-54 risk; less control over visuals |

Recommendation: spike the community libraries first on a dev build (1–2 days);
fall back to a custom module only if they don't hold up.

---

## Suggested sequencing
1. ✅ Background recording verified on device (`BACKGROUND_RECORDING.md`).
2. Android: foreground service + notification (also fixes Android background capture).
3. iOS: Live Activity (start with red-pill interim, then ActivityKit).
4. iOS 17+ App Intent buttons (Pause/Stop) once display-only works.

## Effort estimate (rough, on a working dev build)
- iOS red-pill interim: **0** (already works)
- Android foreground service + notification: **2–4 days**
- iOS Live Activity (display-only): **2–4 days**
- iOS 17 interactive buttons: **+1–2 days**

## Test checklist
- [ ] iOS: lock during recording → Live Activity shows, timer counts correctly
- [ ] iOS: Dynamic Island compact + expanded render correctly
- [ ] iOS: pause/resume reflects on the lock screen
- [ ] iOS 17: Pause/Stop buttons control the recorder
- [ ] iOS: activity ends (disappears) on stop / discard / crash
- [ ] Android: persistent notification appears, chronometer ticks
- [ ] Android: Pause/Stop notification actions control the recorder
- [ ] Android: notification clears on stop; service stops (no battery drain)
- [ ] Both: state stays correct after a phone call interrupts recording
