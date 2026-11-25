# Scribe — Ship Checklist

Ordered top-to-bottom by what unblocks the most. **Phase 0 → Phase 1 must happen
first** — nothing on the device can be verified until a fresh build is installed.

Legend: 💻 = run on your Mac · 🤖 = Claude works in the code · 📱 = test on device

---

## 🚦 Phase 0 — Get a real build on your phone (💻, do this first)

The gate. OTA can't reach the current build (runtimeVersion is tied to app
version), so a fresh build + submit is required.

- [ ] `git pull origin claude/sermon-note-taker-voice-Pi0E7` (top commit matches GitHub)
- [ ] `npm install` (picks up `expo-application`)
- [ ] `eas env:list --environment production` → confirm `EXPO_PUBLIC_GEMINI_KEY` **and** `EXPO_PUBLIC_DEEPGRAM_KEY`
- [ ] If Gemini key missing: `eas env:create --environment production --name EXPO_PUBLIC_GEMINI_KEY --value "KEY" --visibility sensitive`
- [ ] `eas build --platform ios --profile production`
- [ ] `eas submit --platform ios --profile production --latest`
- [ ] Install the new build in TestFlight
- [ ] Verify: Settings shows `1.0.1 (N)` matching TestFlight's build number, and **no Groq section**

## ✅ Phase 1 — Confirm the fixes on device (📱)

- [ ] Cold-launch 3×: no blank screen after splash
- [ ] Record → switch apps 30s → return: still recording, words captured
- [ ] Record → pause 5 min → resume: keeps recording
- [ ] Record a short sermon: outline is real (not the "Basic outline" fallback)
- [ ] Verses detected and resolved live

→ Report pass/fail. Failures here are real bugs to chase.

## 🧠 Phase 2 — Outline reliability (🤖, if Phase 1 shows weak outlines)

- [ ] Decide whether a Claude key backup is worth it (Gemini free quota is shared across all users)
- [ ] Tune the outline prompt if quality is close-but-not-great
- [ ] Consider surfacing "Regenerate" (rebuild outline from transcript) even when audio exists, so fixing a weak outline doesn't force a full re-transcription

## 🎨 Phase 3 — Interface polish (🤖) — DONE

- [x] Tab `selected` state + role for screen readers (sermon detail)
- [x] Disabled-state styling on the "Add scripture" button
- [x] Blue non-interactive reference tags → chip style (stop looking like links)
- [x] Processing spinner honors Reduce Motion
- [x] Unify the uppercase-label styles onto `typography.sectionHeader`
- [x] (earlier) Accessible labels + hitSlop on the remove-point/sub-point buttons
- [x] (earlier) Contrast fix: darken `textSecondary`, move meaningful text off `textTertiary`

## 🏪 Phase 4 — Launch readiness

- [x] 🤖 Update hosted `public/privacy.html` + `public/terms.html` (Groq → Deepgram/Gemini/Anthropic)
- [x] 🤖 Update `docs/index.html` landing copy (Groq/Whisper/Llama → Deepgram/Gemini)
- [ ] 💻 Re-deploy the hosted site so the live privacy/terms/docs pages pick up the copy changes
- [ ] 💻 Play Data Safety: list Deepgram / Gemini / Anthropic as data recipients (Play Console)

## 🔧 Phase 5 — Nice-to-haves (🤖, optional)

- [ ] Tap-to-expand long sermon titles
- [ ] Any leftover LOW polish from the interface review
