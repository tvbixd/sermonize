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
- Reason: the app requires signing in (email code, Google, or Apple) before you
  can record.
- Add **instructions for reviewers** so they can get in:
  - Name: `Email sign-in`
  - Instructions: "On the welcome screen tap **Continue with email**, enter any
    email you control, and enter the 6-digit code sent to it. No Groq API key is
    needed — in Settings → Transcription choose **On-device** to record without
    any key."
  - (For a fixed test login, create one account and put its email here; codes go
    to that inbox.)

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
| **Voice or sound recordings** (Audio) | Yes | Yes | App functionality | In Cloud mode, audio is sent to Groq for transcription. In On-device mode it never leaves the phone. Declare Yes because the app is *capable* of sending it. |
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

---

## Store listing minimums (for internal testing you can keep these short)
- **App name:** Scribe
- **Short description (≤80 chars):** "Record a sermon and get a clean outline with scripture references."
- **Full description:** see `docs/store-listing.md` if you want a longer one, or:
  "Scribe records sermons and turns them into a structured outline — title,
  theme, key points, and every scripture reference, looked up automatically.
  Transcribe on-device for free with no account needed, or use a free Groq key
  for the highest quality. Everything is stored privately on your device and
  exports to PDF or Markdown."
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
