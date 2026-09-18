# Scribe — Pre-Launch QA Checklist (Device Pass)

Run this on **real devices** before shipping v1. It targets the things that
can't be verified off-device: recording reliability, metering, the 8s cadence,
playback, background/locked behavior, and the SDK 57 upgrade.

**Build under test:** version `1.0.1`, Expo SDK 57.
**How to record results:** check the box, and for any ❌ note device + steps.

## Device matrix
Aim for at least two per platform (one older, one current).

| Platform | Device | OS version | Tester | Result |
|---|---|---|---|---|
| iOS | e.g. iPhone 13 | iOS __ | | |
| iOS | e.g. iPhone 15/16 | iOS __ | | |
| Android | e.g. Pixel (mid) | Android __ | | |
| Android | e.g. Samsung | Android __ | | |

---

## 0. Smoke test (do first on every device)
- [ ] App installs and cold-launches without a crash.
- [ ] Splash screen shows correctly (now via the `expo-splash-screen` plugin, not the old root `splash`).
- [ ] App icon renders right (iOS Liquid Glass `.icon`; Android adaptive icon — not a solid blue square).
- [ ] Onboarding / sign-in flow completes, including **"Continue without an account."**
- [ ] Mic permission prompt appears with the correct copy; photo permission prompt appears when setting a profile picture.
- [ ] No `expo-av` remnants: playback and the mic-permission step (migrated to `expo-audio`) work — see §5 and §9.

## 1. Recording — core reliability (highest risk)
- [ ] Tap record → recording starts immediately (no instant "recorder not prepared" failure).
- [ ] Pause and Resume work; timer stops/continues correctly.
- [ ] Stop & Save produces a sermon; Discard prompts (Keep / Save as Draft / Discard).
- [ ] **8s chunk cadence:** scriptures/transcript begin appearing within a few seconds, not ~30s.
- [ ] **Long sermon:** record a continuous **30–45 min** session — no crash, no silent stop, timer stays accurate end-to-end.
- [ ] **Chunk rotation:** frequent (~every 8s) segment rotation doesn't destabilize recording over a long run.
- [ ] **Screen locked:** lock the phone mid-recording for several minutes → audio keeps capturing; on unlock it catches up (transcript/verses fill in the gap).
- [ ] **Backgrounded:** switch to another app for a few minutes → recording continues; returning flushes the backgrounded segment.
- [ ] **Interruption:** incoming phone call / alarm during recording → app recovers gracefully (no corrupt session; audio safe).
- [ ] **Audio-only mode:** trigger it (deny/limit transcription) → recording continues, banner shown, audio saved for later re-transcribe.
- [ ] Force-quit mid-recording → reopening shows a **Draft** with audio intact (no lost recording).

## 2. Live "Spotlight" screen (Phase 2/3)
- [ ] **Waveform** moves in response to your voice (louder = taller bars); calm shimmer when quiet.
- [ ] **Transcript flows** as you speak and auto-scrolls; newest words brighter.
- [ ] Spoken references render **inline in canonical form** ("Romans 8:28", not "Romans chapter eight verse twenty-eight") and are highlighted.
- [ ] **Spotlight card**: newest verse shows **"Finding verse…" → verse text** (two-stage) with the translation chip.
- [ ] **"N found" pill** opens the full list sheet; Done closes it.
- [ ] **Haptic** fires softly when a new verse resolves.
- [ ] **Card animation** fades/slides in on a new verse; **REC dot pulses** while recording.
- [ ] **Reduce Motion** (enable in OS accessibility) → animations become instant, nothing janky.
- [ ] Paused state: waveform calms, controls read "Resume".
- [ ] Looks correct in **light and dark** themes.

## 3. Scripture detection & lookup
- [ ] Speak clear references (colon and spoken forms): "John 3:16", "Matthew chapter twelve verse twenty-four" → both detected correctly.
- [ ] **Regression:** "Matthew 12:24" does NOT come back as Matt 2:1 / 12:1.
- [ ] Chapter-only ("Romans 8") resolves without inventing ":1" incorrectly.
- [ ] **Boundary case:** a reference spoken right as a chunk rotates is still caught (rolling-window detection).
- [ ] Verse **text is clean** (no leading verse numbers, no glued words like "you,before").
- [ ] Duplicates don't stack (same verse cited twice appears once).
- [ ] **Translations:** change translation in Settings (try a few of the 200+, incl. a non-English one) → lookups return in that translation.
- [ ] **Verse cache:** re-citing a verse (or reopening) resolves instantly / works offline for previously seen verses.

## 4. Transcription service (Groq)
- [ ] No API key set → clear prompt to add one in Settings (recording still allowed as audio-only where offered).
- [ ] Valid key → transcription works.
- [ ] **Rate limit (429):** under sustained recording, a 429 shows "Catching up…" and retries rather than dropping audio; only escalates to an alert if sustained.
- [ ] **Network loss** mid-recording → graceful message, audio kept, resumes when back online.
- [ ] Bad/expired key → clear "API key rejected" message, audio still saved.
- [ ] **Re-transcribe** a draft/sermon later works.

## 5. Outline & finalize
- [ ] On Stop, processing shows the steps and completes to the sermon detail screen.
- [ ] Outline has a sensible **title, theme, summary, and points**.
- [ ] **No key / offline:** the local extractive outline is produced (graceful fallback), not an error.
- [ ] Scriptures from the live session + any found in the transcript/outline are all present and de-duped.
- [ ] If finalize errors, the sermon is still **saved as a Draft** (nothing lost).

## 6. Playback (migrated to expo-audio — verify carefully)
- [ ] Play a saved sermon → audio plays through the **speaker** (not earpiece).
- [ ] Multi-chunk sermons play **back-to-back seamlessly** as one recording.
- [ ] Pause/resume works; progress bar + time labels are correct.
- [ ] Reaching the end resets to start; pressing play again replays from the beginning.
- [ ] Playing a sermon whose audio file is missing shows the friendly error, no crash.

## 7. Library, folders, drafts
- [ ] Folders screen: All Sermons count correct; create a folder; move a sermon into it.
- [ ] Drafts and Recently Deleted behave correctly (delete → restore / permanent).
- [ ] Search sermons returns expected results.
- [ ] Pin/unpin (if present) works.

## 8. Settings
- [ ] Bible translation: dropdown row opens the searchable popup; search filters; selection persists.
- [ ] Profile picture: pick from photos → uploads/crops and persists across relaunch.
- [ ] Groq key entry saves securely and persists.
- [ ] Done never blocks on a network call.

## 9. Export & share
- [ ] Export a sermon to **PDF** and **Markdown**; share sheet opens; output is well-formatted (outline + cited scriptures).
- [ ] Exported verses show the correct translation and clean text.

## 10. Accessibility
- [ ] VoiceOver (iOS) / TalkBack (Android): new verses are announced (live regions); controls have sensible labels.
- [ ] Dynamic Type / large font: key screens remain usable (no clipped controls).
- [ ] Contrast is adequate in both themes.

## 11. Performance & stability
- [ ] **40-minute recording**: note battery drain and whether the device gets hot (thermals).
- [ ] Memory stays stable over a long session (no growth-to-crash).
- [ ] Cold start is reasonably fast; navigating between screens is smooth.
- [ ] Leave the app idle mid-recording for 10+ min, come back → still recording, state intact.

## 12. Offline & edge cases
- [ ] Airplane mode: record audio-only, then re-transcribe when back online.
- [ ] Deny mic permission → clear guidance, no crash.
- [ ] Empty / silent / very short (<5s) recording handled gracefully.
- [ ] Rapidly tapping record/stop doesn't create a broken session.

## 13. Store-readiness
- [ ] Version shows **1.0.1**; build number increments on EAS.
- [ ] Privacy policy, terms, and **delete-account** URLs load (used by App Store / Play Console).
- [ ] Play Data Safety / App Privacy answers still match actual behavior (on-device storage, mic, photos, network to Groq/Bible APIs).
- [ ] No secrets in the build/config; no debug logging of the API key.

---

## Target metrics (note actuals during the pass)
- **Time-to-first-verse** (spoken → on screen): target **< ~6–8s p90**. Actual: ____
- **Detection recall** (verses cited vs verses caught) on a real sermon: ____ / ____
- **429 rate** over a 40-min session: ____
- **Battery drain** over 40 min: ____%  · **thermals:** ok / warm / hot

## Sign-off
- [ ] iOS pass complete — tester ______ date ______
- [ ] Android pass complete — tester ______ date ______
- [ ] All ❌ triaged (fixed, or accepted with a note) before submitting.
