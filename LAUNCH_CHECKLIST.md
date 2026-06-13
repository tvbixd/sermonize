# Pre-Launch Checklist

All the code is done. This is everything **you** need to do — accounts, keys,
device tests, store submissions — before tapping publish.

## 1. Update the support config (5 minutes)
File: `src/config/support.ts`

Replace the placeholders with real values:
- `SUPPORT_EMAIL` → the address you actually monitor (currently `support@scribe.app`)
- `PRIVACY_POLICY_URL` → real published URL (or leave; users can also read the inline copy in Settings → Privacy Policy)
- `TERMS_URL` → same
- `GROQ_CONSOLE_URL` → already correct (`https://console.groq.com/keys`)
- `GITHUB_ISSUES_URL` → only matters if you make the repo public

Optionally tweak the **legal copy** in `src/config/legal.ts` and the **FAQ** in
`src/config/faq.ts`. Both are read inline in Settings, so updates ship with
the app.

## 2. Set environment variables
Copy `.env.example` → `.env` and fill in:
- `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project
- `API_BIBLE_KEY` (optional; bundles a shared key so users don't need to bring their own for scripture lookup)
- `EAS_PROJECT_ID` is set automatically by `eas update:configure`

For EAS builds, add the same values as **EAS secrets**:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value 'https://...'
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value '...'
eas secret:create --scope project --name API_BIBLE_KEY --value '...'
```

## 3. Build dev clients & test on real devices
```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

Then on each device, run through `BACKGROUND_RECORDING.md`'s test checklist:
- Record 30+ minutes — no crash, no memory issues
- Background the app mid-recording — audio continues (iOS) or saved draft survives (Android)
- Lock the phone mid-recording — same as above
- Phone call mid-recording — graceful pause/resume
- Force-kill mid-recording — draft is recoverable on relaunch
- Airplane mode mid-recording — switches to audio-only, re-transcribe works on reconnect
- Mic permission flows (grant, deny, re-enable)
- Rate-limit scenario — alert appears, audio-only mode works, re-transcribe later works

## 4. Wire up OAuth in Supabase (only if you want Google/Apple sign-in)
- Supabase dashboard → Authentication → Providers
- **Google**: enable, paste your Google OAuth client ID + secret (Google Cloud Console → Credentials)
- **Apple**: enable, paste Services ID + key (Apple Developer → Identifiers, Keys)
- Add `scribe://auth-callback` to allowed redirect URLs

The buttons in the app already exist; they will start working in the dev build
once Supabase is configured.

## 5. App Store / Play Store assets
- App icon: 1024×1024 (`assets/icon.png` already exists)
- Screenshots: iPhone 6.7", 6.1", iPad Pro 12.9"
- App description + keywords
- Promotional text (optional)
- Privacy policy URL (publish the inline text in `src/config/legal.ts` to a real domain)

## 6. Build production & submit
```bash
eas build --profile production --platform ios
eas submit --profile production --platform ios

eas build --profile production --platform android
eas submit --profile production --platform android
```

Fill in `eas.json` `submit.production` with your Apple Team ID, ASC App ID, and
Google service account before `eas submit` will work.

## 7. After submission
- Apple review: 1–3 days typically
- Google review: a few hours to a day
- Set up TestFlight / Internal Testing tracks for the 5–10 trusted beta users
- Watch the in-app error log (Settings → Storage → Error log) on your devices for the first week

## Deferred to post-launch
- Lock-screen recording UI (see `LOCK_SCREEN_UI.md`) — not blocking launch
- True iCloud sync (currently sermons are device-local only — users can export)
- Push notification system
- Multi-device sermon sync via Supabase
