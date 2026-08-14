# Android / Google Play Launch Checklist — Scribe

Status legend: ✅ done · 🟡 needs an action from you · 🔴 blocker (can't submit without it)

---

## 1. The build
- ✅ **AAB** — `eas build --profile production --platform android` (production profile = AAB, the format Play wants).
- ✅ **Package name** — `com.breakandbuild.scribe` (set in app.config.ts).
- ✅ **Version** — `versionCode` auto-increments via EAS (`appVersionSource: remote`).
- 🟡 **Play App Signing** — on your first upload, Play asks you to enroll. **Say yes** (Google manages your signing key = your recovery safety net).
- 🟡 **Target API level** — Google requires targeting a recent Android API. SDK 54 / RN 0.81 targets a current level, so you're fine; just don't ignore any Play warning about it.

## 2. Store listing assets
- ✅ **App icon (512×512)** — `assets/scribe-icon-512.png`. Upload this as the Play Store icon.
- 🔴 **Feature graphic (1024×500 PNG)** — **required**, not created yet. A simple branded banner (blue book mark + "Scribe" on white/blue). *Ask me — I can generate one.*
- 🔴 **Phone screenshots (min 2, up to 8)** — **required**. Must come from the real app: record screen, a sermon outline, the scriptures view, the sermons list. Take them on your iPhone/Android or an emulator (they don't have to be Android screenshots, but should show the app). 1080×1920 (9:16) is ideal.
- 🟡 **App name** — "Scribe" (≤30 chars).
- 🟡 **Short description** (≤80): "Record a sermon and get a clean outline with scripture references."
- 🟡 **Full description** (≤4000): draft is in `PLAY_CONSOLE_DECLARATIONS.md` → Store listing.
- 🟡 **App category** — Books & Reference (or Productivity).
- 🟡 **Contact email** — required (your support email).
- ⬜ Tablet screenshots / promo video — optional, skip for launch.

## 3. Privacy & legal
- 🔴 **Privacy policy URL** — **required** for Data Safety AND the privacy field. `public/privacy.html` exists but is **NOT hosted yet**. Host it at `https://scribehq.app/privacy` (+ `/terms`). This is the #1 blocker — see "Hosting" below.

## 4. App content declarations (Policy section)
All answers are pre-written in **`PLAY_CONSOLE_DECLARATIONS.md`**:
- 🟡 Privacy policy URL (once hosted)
- 🟡 App access → "Continue without an account" + **paste a working Groq key** for the reviewer (they need it to test transcription)
- 🟡 Ads → No
- 🟡 Content rating (IARC questionnaire) → Everyone
- 🟡 Target audience → 18+ / not for children
- 🟡 Data safety → the table in the doc (email/name/profile, audio→Groq, encrypted in transit, deletion available)
- 🟡 Government / Financial / Health / News / COVID → all No
- 🟡 Advertising ID → No
- ✅ Foreground-service permissions → **none declared** (recording is foreground-only; documented so Play won't flag it)

## 5. Internal testing release
- 🟡 Play Console → **Testing → Internal testing → Create release** → upload the `.aab`
- 🟡 **Testers** tab → add tester Gmail addresses → copy the opt-in link → send to testers
- Testers open the link → Accept → install via Play Store like a normal app (up to 100 testers, ready in minutes, no full review)

---

## The real blockers (do these first)
1. 🔴 **Host the privacy/terms pages** → get `https://scribehq.app/privacy` live.
2. 🔴 **Feature graphic** (1024×500) — ask me to generate it.
3. 🔴 **2+ screenshots** — capture from the running app.
4. 🟡 **Groq test key** in the reviewer instructions.

Everything else is either done or a 2-minute form entry.

---

## Hosting the privacy policy (5-min job)
`scribehq.app` needs to serve `public/privacy.html` and `public/terms.html`. Easiest free options:
- **Cloudflare Pages / Netlify** — drag the `public/` folder in, point `scribehq.app` DNS at it.
- If the domain already has hosting — just upload the two HTML files.
Tell me where `scribehq.app`'s DNS lives (Cloudflare, Namecheap, etc.) and I'll give exact steps.

## Note on Android recording (for your testers)
Recording is **foreground-only** on Android for v1 — keep the app open on screen while recording; backgrounding/locking stops capture (audio so far is saved). True background recording is a post-launch item (`FUTURE.md`).
