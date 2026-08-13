# Google Play Console — Declarations Answer Guide (Scribe)

Fill these in under **App content** (and the content-rating / data-safety
sections) in Play Console. Answers reflect what Scribe actually does. Where a
choice depends on you, it's marked **(your call)**.

> Prerequisite: publish the privacy policy. Host `public/privacy.html` (and
> `public/terms.html`) at **https://scribehq.app/privacy** and
> **https://scribehq.app/terms**, then use those URLs below.

---

## Privacy policy
- **Privacy policy URL:** `https://scribehq.app/privacy`

## App access
- Choose: **All or some functionality is restricted**
- Reason: no account is required (guests can use the whole app), but
  **transcription needs a free Groq API key**, so a reviewer needs one to see
  the core feature work.
- Add **instructions for reviewers**:
  - Name: `Guest + Groq key`
  - Instructions: "On the welcome screen tap **Continue without an account**.
    Then open **Settings**, paste the Groq API key below into the **Groq API
    Key** field, and go back. Tap the record button to transcribe.
    Groq key: `gsk_…` **(paste a working key here before submitting)**"
  - No email/login is needed — the account is optional and everything is stored
    on-device.

## Ads
- **No**, this app does not contain ads. (Confirmed — no ad SDKs.)

## Content ratings (IARC questionnaire)
- **Category:** Reference / Books & Reference (or Productivity)
- Violence: **No** · Sexual content: **No** · Profanity: **No**
- Controlled substances: **No** · Gambling: **No** · User-generated content
  shared publicly: **No** (sermons stay on-device / private)
- Expected result: **Everyone / PEGI 3**

## Target audience and content
- **Target age group:** 18+ (and optionally 13–17). **(your call)** — it's a
  tool for preachers/church members, not children.
- **Appeals to children:** **No**
- This keeps you out of the Families program and its extra requirements.

## Data safety
**Does your app collect or share any required user data types?** **Yes.**

Declare these data types:

| Data type | Collected | Shared | Purpose | Notes |
|---|---|---|---|---|
| **Email address** | Yes | No | Account management | Only if the user signs in; stored via Supabase (auth). |
| **Name** | Yes | No | Account management | Optional profile display name. |
| **Other personal info** (role, church) | Yes | No | Account management | Optional profile fields. |
| **Voice or sound recordings** (Audio) | Yes | Yes | App functionality | Audio is sent to Groq for transcription (over HTTPS, under the user's own key). Recordings are also stored on-device. |
| **App info & performance** (crash logs) | No | No | — | Crash/event logs are stored **only on device**, never transmitted — so per Google's definition this is not "collected." |

Everything else — location, financial info, health, contacts, calendar, SMS,
photos, browsing history, device/advertising IDs — **not collected**.

**Security section:**
- **Is all data encrypted in transit?** **Yes** (HTTPS to Groq, Supabase, Bible APIs).
- **Can users request data deletion?** **Yes** — Settings → Delete account, and
  sermons are deletable in-app.

**Per-data-type follow-ups (use these):**
- Collection is **required** for email (needed to sign in), **optional** for
  name/profile.
- Audio: purpose **App functionality**; **not** processed only ephemerally
  (Groq returns text; retention per Groq's policy) — mark ephemeral **No** to be safe.

> Note on Audio "shared": Groq acts as a processor that returns a transcript.
> Google lets you treat a pure service-provider transfer as **not** sharing, but
> declaring it **Yes/shared** is the conservative, safe choice and matches your
> privacy policy. Use Yes.

## Government apps
- **No**

## Financial features
- **No** — the app has no financial features.

## Health
- **No** — not a health app.

## News app
- **No**

## COVID-19 contact tracing/status
- **No**

## Advertising ID
- The app does **not** use an advertising ID. If Play asks (Android 13+ target),
  declare that you do **not** use it.

## Android permissions (and the foreground-service form)
- The app requests only **RECORD_AUDIO** (microphone, for recording sermons) and
  **WAKE_LOCK**. Both are standard and need no special declaration form.
- **There is NO foreground-service permission.** Recording on Android is
  **foreground-only** — it runs while the app is open on screen; if the user
  backgrounds the app or locks the phone, capture stops (audio up to that moment
  is saved). We intentionally do **not** declare `FOREGROUND_SERVICE` /
  `FOREGROUND_SERVICE_MICROPHONE`, because the app runs no such service and a
  declared-but-unused foreground-service permission triggers Play review
  rejection.
- **If Play's "Foreground service permissions" declaration form appears anyway:**
  it should not, since the manifest declares none. If it does, it means a
  dependency injected one — remove it before submitting rather than filling the
  form. As of this build the manifest is clean.
- **Microphone-in-background disclosure:** because the app does **not** record in
  the background, you do **not** need the "records audio in the background"
  disclosure. Keep the store listing/description free of any "records with the
  screen off / in your pocket" claims on Android to stay consistent.

> Roadmap note: true background recording on Android (via `expo-audio` + a mic
> foreground service) is planned post-launch (see `FUTURE.md`). When that ships,
> you WILL re-add `FOREGROUND_SERVICE_MICROPHONE` and must then complete Play's
> foreground-service declaration form justifying it.

---

## Store listing minimums (for internal testing you can keep these short)
- **App name:** Scribe
- **Short description (≤80 chars):** "Record a sermon and get a clean outline with scripture references."
- **Full description:** see `docs/store-listing.md` if you want a longer one, or:
  "Scribe records sermons and turns them into a structured outline — title,
  theme, key points, and every scripture reference, looked up automatically.
  Add a free Groq API key for fast, accurate transcription. No account
  required — everything is stored privately on your device and exports to PDF
  or Markdown."
- **App icon:** 512×512 (Play uses this; your `assets/icon.png` is 1024 — export a 512 too)
- **Feature graphic:** 1024×500 (required) — **(your call)**, simple branded banner
- **Screenshots:** at least 2 phone screenshots

---

## Order to complete in Play Console
1. Host privacy/terms pages → get the URLs
2. App content → Privacy policy (paste URL)
3. App access → add reviewer sign-in instructions
4. Ads → No
5. Content ratings → complete questionnaire
6. Target audience → 18+ / not for children
7. Data safety → fill the table above
8. Remaining declarations (all No)
9. Internal testing → upload AAB → add testers
