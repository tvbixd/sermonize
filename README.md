# sermonize

Voice-driven sermon note taker — record the preacher, get a clean outline with scriptures.

## How it works

1. **Record** the sermon as a single audio file with **Pause / Resume / Stop** controls.
2. On stop, the audio is uploaded to **OpenAI Whisper** for transcription.
3. The full transcript is sent to **Claude** (`claude-sonnet-4-6`) with prompt caching, which returns a structured outline: title, theme, summary, main points, sub-points, and cited scripture references.
4. Detected scripture references are looked up against [bible-api.com](https://bible-api.com) (default translation: WEB) so the verse text appears alongside each reference.
5. Everything is stored locally on the device — there is no backend. API keys live in `expo-secure-store`.

## Stack

- Expo (managed) + React Native + TypeScript
- expo-router (file-based navigation)
- expo-av (recording with pause/resume), expo-file-system, expo-secure-store, expo-sharing
- Zustand for session state
- @anthropic-ai/sdk, OpenAI Whisper REST

## Setup

```sh
npm install
npx expo start
```

Open the app, go to **Settings**, paste your OpenAI and Anthropic API keys, then tap **+ New Sermon**.

## Layout

```
app/
  _layout.tsx            # navigation
  index.tsx              # home: list of saved sermons
  record.tsx             # record / pause / resume / stop + processing UI
  settings.tsx           # API keys & translation
  sermon/[id].tsx        # outline / scriptures / transcript tabs + export
src/
  audio/SermonRecorder.ts        # expo-av wrapper, pause/resume + size-based file rotation
  services/whisper.ts            # Whisper upload via FileSystem.uploadAsync
  services/claude.ts             # Claude outline extraction with prompt caching
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
