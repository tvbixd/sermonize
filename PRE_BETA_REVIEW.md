# Pre-Beta Product Review — Scribe (iOS + Android)

Full audit across security, recording pipeline correctness, data integrity,
platform config, and UX. Findings verified against the actual code.
Ordered by what blocks beta first.

---

## CRITICAL — fix before building for beta

### C1. Four packages are at SDK 55 versions in an SDK 54 app
`package.json:21,26,28,34` — `expo-auth-session ^55.0.16`, `expo-haptics ^55.0.14`,
`expo-print ^55.0.15`, `expo-web-browser ^55.0.16`. SDK 54's correct versions are
`~7.x` / `~15.x`. Expo Go tolerates this; a **native EAS build will fail to compile
or crash at runtime** when these native modules link against RN 0.81.

**Fix:** `npx expo install expo-auth-session expo-haptics expo-print expo-web-browser`,
then `npx expo-doctor`.

### C2. Android background recording doesn't actually work — no foreground service exists
`app.config.ts` declares `FOREGROUND_SERVICE_MICROPHONE`, but nothing in the app
creates or starts a microphone foreground service. `expo-av`'s
`staysActiveInBackground` does **not** create one. On Android 14/15, the OS revokes
mic access within seconds-to-minutes of backgrounding → a pastor locks their phone
mid-sermon and the rest records **silence**. This is the app's core use case.

**Fix options:** (a) a mic foreground-service module/config plugin
(e.g. `@supersami/rn-foreground-service` or a small custom plugin), or
(b) migrate to `expo-audio` (expo-av is deprecated in SDK 54 anyway).
Either way also add `POST_NOTIFICATIONS` permission (the FGS notification needs it
on API 33+). iOS is correctly configured (`UIBackgroundModes: audio`) and should work.

**Interim beta mitigation:** the flush-on-background + draft safety net means no
data is *lost*, but Android testers must keep the app foregrounded. If you ship
beta without the FGS, say so in the beta notes.

---

## HIGH — real bugs testers will hit

### H1. The last ≤30 seconds of every sermon is missing from the saved transcript
`app/record.tsx` `onStop` → `recorder.stop()` seals the final chunk and fires
`onChunkReady` **without awaiting it**. `onStop` then immediately reads
`transcriptRef.current` and saves — but the final chunk's transcription is still
in-flight (network call, ≥1s). The sermon's conclusion is transcribed *after* the
sermon was already saved without it. Every recording loses its ending.

**Fix:** track in-flight transcriptions in a pending set and have `onStop` await
them (or have `stop()` return the final URI and transcribe it explicitly before
building the transcript).

### H2. Invalid/revoked Groq key = silent total transcription failure
`app/record.tsx` `onChunkReady` catch block only handles `NetworkError | RateLimitError`.
A 401 (bad key), 413, or 400 is **silently swallowed** — no banner, no alert. A user
with a bad key records an entire sermon with an empty live transcript and no clue why.
Bonus waste: `whisper.ts retryWithBackoff` retries 401s four times (~7s per chunk).

**Fix:** add an else-branch that surfaces the error (banner + alert after first
failure for auth errors), and skip retries for 4xx (except 429) in `retryWithBackoff`.

### H3. Sermon JSON writes are not atomic — corruption is invisible AND blocks recovery
`src/storage/sermons.ts:88-91` writes directly to the final path. App death mid-write
leaves truncated JSON. `loadAll` silently skips it (sermon vanishes), and
`recoverOrphanedAudio` sees the `.json` file *exists* so it never recovers the audio
either. Sermon + audio become permanently invisible. Same non-atomic pattern in
`folders.ts` — worse there: one corrupt read of `folders.json` returns `[]`, and the
next `saveFolder` read-modify-writes, permanently destroying **all** folders.

**Fix:** write to `<id>.json.tmp` then `FileSystem.moveAsync` (atomic rename), and
treat "JSON exists but unparseable" as orphaned in `recoverOrphanedAudio`.

### H4. "Discard" doesn't discard — recordings resurrect as drafts
`app/record.tsx` Discard stops the recorder (sealing chunks to disk) but never
deletes `sermons/<id>/audio/`. No JSON is written, so next cold launch
`recoverOrphanedAudio` resurrects the "discarded" recording as a Recovered draft.
Confusing and a privacy surprise ("I deleted that").

**Fix:** on Discard, delete the audio directory (`deleteSermon(sermonIdRef.current)`).

### H5. Android back button / iOS swipe-back silently kills a live recording
No `BackHandler` or `beforeRemove` guard anywhere. The on-screen buttons are guarded,
but the OS back gesture pops the screen; unmount cleanup stops the recorder without
saving. The recording only reappears as a recovered draft after the next cold launch —
the immediate experience is "my sermon vanished."

**Fix:** `usePreventRemove` / `beforeRemove` listener while recording → show the
existing Save-as-Draft/Discard alert; or save a draft in unmount cleanup.

### H6. No audio playback anywhere in the app
Sermons store `audioUris`, Settings shows "Audio recordings: X MB", but there is no
play button anywhere — a user cannot listen to their own recording or share the audio
file. For a recording app this is the gap beta testers will file first.

**Fix:** simple play/pause/scrub on the sermon detail screen (or minimally a
"Share audio" action).

### H7. Placeholder domain `scribe.app` is live in the app — and you don't own it
`src/config/support.ts` — support email, privacy URL, terms URL all point to
`scribe.app`. "Contact support" and "Delete account" mailtos (which include the
user's ID) go to a stranger's domain. Sign-in copy also promises the OTP comes
"from no-reply@scribe.app" (it comes from Supabase). App review requires working URLs.

**Fix:** replace with a domain/inbox you control before any build goes to testers.

---

## MEDIUM

- **M1. Absolute `audioUris` break after every iOS app update** — the iOS container
  UUID changes on update; stored `file:///...` URIs go stale. Re-transcribe survives
  (it re-derives paths from the sermon ID at runtime — good), but any future playback
  feature reading `audioUris` breaks. Store filenames/relative paths instead.
- **M2. Email-only account deletion fails Apple guideline 5.1.1(v)** — fine for
  TestFlight, blocks App Store release. Needs an in-app deletion (Supabase Edge
  Function calling `auth.admin.deleteUser`).
- **M3. Stacked rate-limit alerts** — chunks already in flight when the first 429
  fires can each throw and queue a second identical alert over the first. Guard with
  an `alertShowingRef`.
- **M4. Settings saves the Groq key without validation** — onboarding validates the
  key; Settings doesn't, and its `keyStatus` UI state is dead code (nothing sets it).
  Paste a truncated key → confusing failure mid-recording (compounded by H2).
- **M5. `API_BIBLE_KEY` embedded in the binary** via `extra` — anyone unzipping the
  APK gets your api.bible key. (The Supabase URL/anon key being embedded is normal
  and fine.) Acceptable for beta if conscious; proper fix is a proxy.
- **M6. `deleteFolder` misses drafts + trashed sermons** — they keep a dangling
  `folderId` forever. Clear `folderId` across all sermons, not just `listSermons()`.
- **M7. Settings screen lacks SafeAreaView** — SDK 54 Android is always edge-to-edge
  and `presentation: 'modal'` is full-screen there → header buttons under the status
  bar, content under gesture nav. Every other screen does this correctly.
- **M8. "API Key Missing" alert is a dead end** — only an OK button at the moment of
  highest first-run intent. Add an "Open Settings" button.
- **M9. `updates.url` uses `process.env.EAS_PROJECT_ID ?? ''`** while the project ID
  is hardcoded elsewhere in the same file — an EAS-Update-enabled build gets an
  invalid URL when the env var is unset. Use the hardcoded ID in both places.
- **M10. `.env.example` doesn't exist** — README and LAUNCH_CHECKLIST both instruct
  `cp .env.example .env`, which fails. Commit the file.
- **M11. Pause during chunk rotation race** — `SermonRecorder.pause()` returns early
  if `current` is null (the ~ms window mid-rotation) *before* stopping the chunk
  timer → UI says Paused but recording + timer continue. Same window affects the
  rate-limit auto-pause. Stop the timer first, or retry pause after rotation.

## LOW

- `purgeExpiredDeleted()` unguarded in the Folders focus effect — one throw blocks
  the list refresh (it's already run safely at launch; drop it or add `.catch`).
- Draft `createdAt` re-stamped on every auto-save → drafts jump around list ordering.
- `bible.ts` caches empty verses on transient HTTP errors for the session.
- Privacy copy overclaims: "Audio stays on your phone" (sign-in mic prompt) — it's
  sent to Groq 30s later; and "Groq does not retain audio" — soften to "per Groq's
  data policy". Review/complaint risk.
- `ITSAppUsesNonExemptEncryption: false` missing from `ios.infoPlist` — you'll answer
  the export-compliance question manually on every TestFlight upload.
- PDF/Markdown export has no spinner on long transcripts.
- Route param `id` is used unsanitized in file paths (deep-linkable). `newId()` output
  is safe; add an ID-format check before path use as defense-in-depth.
- `expo-av` is deprecated in SDK 54 — plan the `expo-audio` migration (also solves C2).

---

## Store-readiness declarations (paperwork, not code)

- **Google Play Data Safety form:** declare Audio collected + shared with Groq
  (app functionality, ephemeral), email/name (Supabase account), no ads/analytics
  (true — no analytics SDKs present). Once the mic FGS lands, Play also requires a
  declaration + short demo video for the microphone foreground-service type.
- **Apple privacy nutrition label:** Audio Data, Contact Info (email), User Content
  (name/church), Identifiers (user ID). "Data Not Collected" is not claimable.
- **versionCode/buildNumber:** correctly handled by EAS remote versions +
  `autoIncrement` — no action.

---

## What's genuinely solid

- **Data-loss engineering:** 30s chunking to disk, flush-on-background, 5-minute
  auto-save drafts, orphan recovery, rate-limit auto-pause with clear options,
  offline audio-only mode + re-transcribe. This is the app's backbone and it's good.
- **Security:** Groq key in SecureStore (not AsyncStorage); HTTPS hardcoded to the
  right hosts; the key is never logged; repo scan found no committed secrets; the
  `__DEV__` test-user path compiles out of release builds; crash/event logs contain
  no PII, transcripts, or keys.
- **iOS recording config:** mic usage description + background audio mode correct.
- **UX foundations:** distinct empty states, keyboard avoidance, skeletons/spinners
  on async paths, 3-step processing UI, accessibility labels/roles across screens,
  ErrorBoundary with local crash log.
- **Storage design:** per-sermon JSON files bound corruption blast radius; ID
  collisions effectively impossible; recently-deleted/restore flows correct;
  verse cache bounded in memory.

## Suggested fix order

1. C1 (build breaks otherwise) — 5 minutes
2. H1, H2, H4, H5, M3, M11 — recording-screen fixes, one focused pass
3. H3 (atomic writes + recovery blind spot) — storage pass
4. H7 + M10 (support domain, .env.example) — config pass
5. H6 (playback) — the one feature-sized item; strongly recommended before beta
6. C2 (Android FGS or expo-audio migration) — biggest lift; decide: ship Android
   beta with "keep app open" caveat, or hold Android until done
7. Everything else post-beta
