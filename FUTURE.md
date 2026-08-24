# Future / Post-Launch Ideas

Parked deliberately so they don't delay launch. Scribe ships on **Groq
(hosted Whisper)** for transcription + **Groq Llama** for outlines — a working,
free, cross-platform setup. Revisit the below only after launch, and only if a
real user need pushes for it.

## On-device transcription (revisit)
Goal: remove the Groq key + daily-limit dependency entirely.

- **First attempt (`whisper.rn`)** — tried and **fully removed** (production
  review). On iOS it crashed in `hostInitWhisperContext` (native SIGABRT,
  uncatchable in JS), and it needs WAV input while our recorder produces
  `.m4a`. The dependency, `localWhisper.ts`, the transcription-mode toggle, and
  the tsconfig shim were all removed to shed Android AAB bloat + a native crash
  surface. `transcription.ts` now calls Groq directly. Re-adding on-device
  starts fresh.
- **Better candidate: WhisperKit (Argmax)** — native CoreML Whisper for
  iOS/macOS. Likely avoids the init crash + format issues. Surfaced via the
  `speaktype` macOS app (github.com/karansinghgit/speaktype), which uses it.
  - Caveat: **Apple-only.** Android still needs `whisper.rn`/whisper.cpp or
    another engine, so on-device stays a two-engine effort.
  - Integration is a native Swift module + Expo config plugin — needs device
    builds to verify.

## Gemini as a transcription/outline option (evaluate)
- A free **Google AI Studio** key could do **both** audio transcription and the
  outline in one model. Keys are free + easy (like Groq), unlike Google Cloud
  Speech (service-account JSON — too technical for end users).
- Worth a spike post-launch to compare accuracy/limits vs Groq. Not a
  pre-launch switch.

## Fine-tune Whisper for scripture terms (only if needed)
- If users report repeated errors on biblical names/places ("Melchizedek",
  "Habakkuk", book names), fine-tune Whisper on sermon audio.
- Modest project (small dataset + some GPU time). Only pursue if accuracy on
  proper nouns becomes a real, recurring complaint.

## Not worth pursuing
- **Building an STT model from scratch** — Whisper trained on 680k hours of
  audio at big-tech scale; a from-scratch model would cost a fortune to end up
  worse. Use Whisper.
- **Google Cloud Speech-to-Text** — better raw accuracy is marginal for miked
  sermons, and the service-account setup makes the key-onboarding problem worse,
  plus it's paid past 60 min/month.
