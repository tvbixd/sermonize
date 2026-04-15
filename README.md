# sermonize

Voice-driven sermon note taker — record the preacher, get a clean outline with scriptures.

**Free to run.** Powered by [Groq](https://console.groq.com)'s free tier (Whisper for transcription + Llama 3.3 70B for outlining) and [bible-api.com](https://bible-api.com) for scripture lookup. No paid services required.

## How it works

1. **Record** the sermon as a single audio file with **Pause / Resume / Stop** controls.
2. On stop, the audio is uploaded to **Groq's Whisper Large v3 Turbo** for transcription.
3. The full transcript is sent to **Groq's Llama 3.3 70B**, which returns a structured outline: title, theme, summary, main points, sub-points, and cited scripture references.
4. Detected scripture references are looked up against [bible-api.com](https://bible-api.com) (default translation: WEB) so the verse text appears alongside each reference.
5. Everything is stored locally on the device — there is no backend. The Groq API key lives in `expo-secure-store`.

## Cost

$0. Groq's free tier covers personal sermon-taking comfortably (rate-limited, but generous). bible-api.com is free.

## Stack

- Expo (managed) + React Native + TypeScript
- expo-router (file-based navigation)
- expo-av (recording with pause/resume), expo-file-system, expo-secure-store, expo-sharing
- Zustand for session state
- Groq REST API (OpenAI-compatible) for both transcription and outlining

## Setup

```sh
npm install
npx expo start
```

Open the app, go to **Settings**, paste your Groq API key (get one free at <https://console.groq.com/keys>), then tap **+ New Sermon**.

## Layout

```
app/
  _layout.tsx            # navigation
  index.tsx              # home: list of saved sermons
  record.tsx             # record / pause / resume / stop + processing UI
  settings.tsx           # Groq API key & translation
  sermon/[id].tsx        # outline / scriptures / transcript tabs + export
src/
  audio/SermonRecorder.ts        # expo-av wrapper, pause/resume + size-based file rotation
  services/whisper.ts            # Groq Whisper upload via FileSystem.uploadAsync
  services/outline.ts            # Groq Llama outline extraction (JSON-mode)
  services/scriptureRegex.ts     # detect Bible refs in transcripts
  services/bible.ts              # bible-api.com lookup
  storage/sermons.ts             # JSON-on-disk sermon CRUD
  storage/keys.ts                # secure-store API key access
  state/sessionStore.ts          # Zustand recording session state
  components/                    # OutlineView, ScriptureCard, RecordButton
  util/format.ts                 # time/date formatting + Markdown export
  util/id.ts                     # local id helper
  types.ts                       # Sermon, Outline, Point, Scripture, statuses
```
