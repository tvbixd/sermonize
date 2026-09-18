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
The final Android manifest (after Expo's config plugins run) declares:

| Permission | Source | Why |
|---|---|---|
| `RECORD_AUDIO` | ours | Record sermons (microphone). |
| `WAKE_LOCK` | ours | Keep the CPU/screen awake while recording. |
| `MODIFY_AUDIO_SETTINGS` | expo-audio | Configure the audio session. |
| `FOREGROUND_SERVICE` | expo-audio | Umbrella permission for the media service. |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | expo-audio | Background **playback** of a recorded sermon (lock-screen / screen-off). |

- **There IS a foreground-service permission**, but it is for **media playback**,
  not recording. `expo-audio` injects `FOREGROUND_SERVICE` +
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK` so a saved sermon can keep playing when the
  app is backgrounded or the screen is off. It does **not** enable background
  *recording* (that would need `FOREGROUND_SERVICE_MICROPHONE`, which we do not
  declare — see the roadmap note).
- **You MUST complete Play's "Foreground service permissions" declaration** for
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK`. Copy-paste answers:
  - **Which foreground service type(s) do you use?** → **Media playback**
  - **What is the core functionality that uses it?**
    > "Scribe records sermons and lets the user play a saved recording back.
    > The media-playback foreground service lets that audio continue when the
    > screen is off or the app is in the background, with standard lock-screen
    > playback controls."
  - **Why can't this use a different API (e.g. WorkManager / JobScheduler)?**
    > "The user actively starts playback and expects continuous, uninterrupted
    > audio with lock-screen controls; deferrable background APIs cannot provide
    > real-time, user-initiated media playback."
  - **Video/demo link (if requested):** show recording a sermon, opening it,
    tapping play, then locking the phone — audio keeps playing with lock-screen
    controls. (The MP4 in `prototypes/` is the live-recording concept, not this
    flow; capture a short screen recording of playback for the reviewer.)
- **Recording itself is foreground-only** on Android for v1: if the user
  backgrounds the app or locks the phone **while recording**, capture stops
  (audio up to that moment is saved). So you do **not** need the "records audio
  in the background" disclosure, and the store listing must not claim
  record-with-screen-off on Android.

> Roadmap note: true background *recording* on Android (a **microphone**
> foreground service, `FOREGROUND_SERVICE_MICROPHONE`) is deferred post-launch
> (see `BACKGROUND_RECORDING_SCOPE.md` / `FUTURE.md`). When it ships you'll add
> that permission + service and extend this declaration to include the
> **Microphone** foreground-service type.

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
