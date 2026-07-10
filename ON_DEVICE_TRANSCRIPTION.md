# On-device transcription (no API key, no limits)

Scribe can transcribe fully **on the phone** using `whisper.rn` (a React Native
binding for whisper.cpp), instead of sending audio to Groq. This removes the
API-key requirement and the daily rate limits — the core reasons a
non-technical user would get stuck.

## How it's wired

- **Setting:** Settings → **Transcription** → choose **Cloud (Groq)** or
  **On-device**. Default is Groq. Stored via `getTranscriptionMode()`.
- **Model:** on-device mode downloads `ggml-base.en.bin` (~142MB) once, cached
  in `documentDirectory/models/`. Managed in `src/services/localWhisper.ts`.
- **Router:** `src/services/transcription.ts` sends chunks to whisper.rn or
  Groq based on the mode. The record screen and Re-transcribe both use it.
- **Outlines:** still need a Groq key (the LLM step). Without one, you get the
  transcript only — the outline is skipped and the sermon still saves.

## This is opt-in on purpose

The default stays **Cloud (Groq)** so adding the native module doesn't change
behavior until you deliberately switch. If the native build has trouble, users
are unaffected until they flip the toggle.

## ⚠️ Must verify on a real dev build (cannot be tested in Expo Go or CI)

whisper.rn is a native module. Do these checks on-device before relying on it:

1. **It builds.** whisper.rn adds native code, so the first build after this
   change is the real test. Rebuild both platforms:
   ```bash
   eas build --profile preview --platform android
   eas build --profile production --platform ios
   ```
   If the build **fails to compile/link**, that's the native-module risk — see
   Rollback below; you lose nothing because Groq mode still works.

2. **Audio format.** The recorder writes `.m4a` (AAC). Confirm whisper.rn
   transcribes those chunks and returns text. If it returns empty or errors on
   format, we'll switch the recorder to 16kHz WAV for on-device mode (a small
   change in `SermonRecorder`), or add a decode step.

3. **Memory on iOS.** Large models can hit iOS memory limits during inference.
   If you see crashes mid-transcription on iOS, add these entitlements in
   `app.config.ts` under `ios.entitlements`:
   ```
   "com.apple.developer.kernel.increased-memory-limit": true,
   "com.apple.developer.kernel.extended-virtual-addressing": true
   ```

4. **Speed/battery on a real phone.** Record 20–30 min and confirm chunks keep
   up and battery use is acceptable. If it's too slow on older phones, switch
   the model constant in `localWhisper.ts` from `ggml-base.en.bin` to
   `ggml-tiny.en.bin` (~75MB, ~3× faster, slightly lower accuracy).

## Rollback (zero code revert)

Because it's a setting, the safety net is: leave the default on **Cloud
(Groq)**. If the native module misbehaves at runtime, users just don't switch.

If the native module breaks the **build** itself and you need to ship without
it, remove the dependency:
```bash
npm uninstall whisper.rn
```
and revert the imports in `src/services/transcription.ts`,
`src/services/localWhisper.ts` (delete it), `app/record.tsx`, and
`app/sermon/[id].tsx`. The commit that added this is self-contained for easy
reverting.

## Tuning

- **Model:** `MODEL_FILE` in `src/services/localWhisper.ts` — `base.en`
  (default, best balance) vs `tiny.en` (faster/smaller) vs `small.en`
  (slower/more accurate).
- **Language:** currently English-only models (`.en`). For other languages,
  use the multilingual `ggml-base.bin` and drop `language: 'en'` in
  `transcribeLocal`.
