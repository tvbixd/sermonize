# Sending auth emails through Resend

Scribe uses Supabase Auth for email one-time codes (OTP). By default Supabase
sends these through its own shared mail server, which is rate-limited to a
handful per hour and frequently lands in spam. Pointing Supabase at **Resend**
as its SMTP provider fixes both — with **zero app code changes**. Supabase still
generates and verifies the code; Resend only delivers the email.

## 1. Create a Resend account + verify a domain
1. Sign up at [resend.com](https://resend.com) (free tier: 3,000 emails/month,
   100/day).
2. **Domains → Add Domain** → enter a domain you own (e.g. `mail.yourdomain.com`).
3. Add the DNS records Resend shows you (SPF, DKIM, DMARC) at your domain
   registrar. Wait for them to verify (usually minutes).
   - No domain yet? You can test with Resend's `onboarding@resend.dev` sender,
     but it only delivers to your own Resend account email. Get a domain before
     real beta users.

## 2. Get SMTP credentials from Resend
1. **API Keys → Create API Key** (Full access). Copy it — this is your SMTP
   password.
2. Resend's SMTP settings are:
   - **Host:** `smtp.resend.com`
   - **Port:** `465` (SSL) or `587` (TLS)
   - **Username:** `resend`
   - **Password:** the API key from step 1

## 3. Point Supabase at Resend
1. Supabase dashboard → **Project Settings → Authentication → SMTP Settings**.
2. Toggle **Enable Custom SMTP** on and fill in:
   - **Sender email:** `noreply@yourdomain.com` (must be on the verified domain)
   - **Sender name:** `Scribe`
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** your Resend API key
3. Save. Supabase raises the auth email rate limit automatically once custom
   SMTP is on (tune it under **Authentication → Rate Limits** if needed).

## 4. Make the email send a CODE, not a magic link
The app reads a 6-digit code, so the template must expose `{{ .Token }}`.

1. Supabase → **Authentication → Email Templates → Magic Link**.
2. Replace the body with the branded template in
   `assets/email/otp-template.html` (paste the whole file).
3. Set the **Subject** to: `Your Scribe sign-in code`

## 5. Test
Send yourself a code from the app's email sign-in. It should arrive within
seconds from your domain, showing a 6-digit code. Check Resend's **Logs** tab
to confirm delivery and debug any bounces.

---

### Why not call the Resend API directly from the app?
You could replace Supabase OTP with your own code generation + a Resend API
call, but then you own secure code storage, expiry, and rate limiting. Supabase
already does all of that correctly — using Resend purely as the SMTP transport
gets you Resend's deliverability with none of that risk.
