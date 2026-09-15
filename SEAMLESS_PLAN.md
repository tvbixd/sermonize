# Scribe — "Seamless Live" Plan

Making the recording experience feel alive and low-stress: **scriptures in
seconds**, a **live transcript that flows while preaching**, and a calm, premium
feel — without adding devotionals, streaks, or AI chat, and without regressing
recording reliability.

## Scope

**Keep:** record → transcribe → outline → cite (Scribe's core).
**Cut (from the Pewnote reference):** devotionals, streaks, AI chat/Q&A.
**Improve:** perceived speed + the moment-to-moment feel of recording.

## The one number that matters

Today a verse can take **~30s+** to appear because the recorder seals a 30s
segment before transcribing (`SermonRecorder.CHUNK_MS = 30_000`;
`recordingEngine.ts` `processChunk`). Target:

> **Time-to-first-verse (spoken → on screen) under ~6–8s (p90)**, plus a
> transcript that visibly flows while recording.

## Honest constraint

Groq Whisper is **request/response, not streaming** (`whisper.ts` is a multipart
POST). True socket-streamed captions aren't available with Groq, and on-device
Whisper was removed for crashing. So "real-time" here = **short chunks + smart
detection**, not a live socket. That ceiling is real.

## The four bottlenecks and their fixes

### 1. Cadence — the 30s chunk
Drop to an **adaptive ~8s** default. Groq bills *audio seconds*, and the sermon
is the same length either way, so this **doesn't increase the daily audio
budget**. It does raise **request count** (~80 → ~340 for a 40-min sermon),
pushing on requests-per-minute. Pair it with:
- a **concurrency-limited queue** (max 2–3 in-flight) so chunks don't burst, and
- **adaptive cadence**: on a 429, lengthen the chunk and back off, then recover.

Today each chunk fires independently (`onChunkReady` → `processChunk`), which
would burst under a short cadence.

### 2. Accuracy at short chunks — boundary references
Detection currently runs on each chunk **in isolation**
(`findScriptureReferences(text)` on one chunk). Short chunks split refs across
boundaries ("Matthew…" | "chapter 12") → **missed verses**. Fix: run detection
over a **rolling text window** (tail of the previous chunk + the new one),
deduped by normalized reference. This **decouples detection quality from chunk
length** and is cheap — worth doing even at 30s.

### 3. Perceived speed — two-stage verse cards
Reference detection is **local/instant** (regex); only the verse *text* needs the
network (`lookupVerses`). Split it:
- regex match → push card **immediately** as `{reference, status:'resolving'}`
  (shimmer),
- `lookupVerses` returns → update to `resolved` (text) or `failed` (tap to retry).

Requires a small store change: `liveScriptures` items carry a **status**, and
`addLiveScriptures` becomes an **upsert by reference** (`sessionStore.ts`).

### 4. Repeated/slow lookups — caching
`lookupVerses` hits the network every time. Add a cache keyed by
`translation:reference` (in-memory + persisted), and optionally **bundle the
~150 most-cited verses** for the default translation so common verses resolve
**instantly and offline**.

## Making it feel alive (design half)

### 5. Surface the live transcript
The store already holds `liveTranscript` (marked "not shown"); `record.tsx` never
renders it. Show it **during recording only**: an auto-scrolling column, newest
words brightest, older lines fading. Still **not stored** — the deliverable stays
the clean outline + scriptures.

### 6. A real waveform
`record.tsx` uses a static fake bar array (`IDLE_BARS`) and metering is disabled
(`SermonRecorder.ts` `isMeteringEnabled:false`). Turn metering on, poll the
level, drive a real amplitude waveform. Low cost, big "alive" payoff.

### 7. Motion & calm
Cards animate in (slide+fade), a soft **haptic tick** on each new detection,
count-up timer, generous spacing, one primary action, faithful light + dark.

## Reliability guardrail (don't regress what we won)

Shorter JS-timer cadence **freezes when backgrounded** — but the existing
`onBackground`/`onForeground` flush already seals the long backgrounded segment
and catches up (`recordingEngine.ts`). So the live cadence is a **foreground
affordance**; backgrounded/locked recording keeps its current, safer path
untouched. This also matters because **locked-phone background recording is still
unverified on-device** — sequence the cadence changes so they can't destabilize
that path.

## Phasing (each phase ships and is testable on its own)

- **Phase 0 — Prototype (no app risk).** Clickable HTML mock of the live screen
  in Scribe's style, to lock the feel before touching code. *~1 day.*
- **Phase 1 — Engine, invisible. ✅ Done.** Rolling-window detection + persistent
  verse cache + two-stage store model + order-preserving transcription queue.
  **Cadence stays 30s** and the queue runs serial (`MAX_CONCURRENT = 1`), so
  behaviour is identical today; Phase 2 raises the concurrency and surfaces the
  two-stage state. Zero visible change. Covered by `__tests__/live-pipeline.test.ts`.
- **Phase 2 — The visible win.** Adaptive ~8s cadence + live transcript +
  two-stage cards + real waveform. *~2–3 days + device testing.*
  **Chosen layout: "Spotlight"** (see `design/live-recording/`) — the transcript
  gets the room, only the current verse is shown in a rich card, and the rest tuck
  behind a quiet "N found" pill that opens the full list. No fake status bar, one
  primary action, serif verse text.
- **Phase 3 — Polish.** Motion, haptics, empty states, calm light/dark pass,
  accessibility. *~2 days.*

## How we prove it worked

Instrument and compare against the 30s baseline on the same recording:
- **time-to-first-verse** (p50/p90),
- **detection recall** (verses found vs. actually cited),
- **peak requests/min** and **429 rate**,
- **battery/thermals over a 40-min run**.

If Phase 2 doesn't beat ~8s p90 or 429s spike, adaptive cadence lengthens
automatically — we tune, not guess.

## Design tokens (from `src/theme.ts`, for the prototype)

Dark: bg `#0C0A09`, surface `#1C1917`, raised `#292524`, text `#F5F0EB`,
secondary `rgba(245,240,235,0.55)`, blue `#4DA3FF`, red `#FF5A67`, gold `#F0B95A`.
Light: bg `#F2F2F7`, surface `#FFFFFF`, text `#2B3031`, blue `#0A84FF`,
red `#FF3D4D`, gold `#E8A838`.
