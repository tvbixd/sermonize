export const PRIVACY_POLICY_TEXT = `Scribe is designed to keep your sermon content on your device.

WHAT WE STORE
- Sermons, drafts, folders, and audio recordings are saved to your device's local storage only.
- Your Bible translation preference (and any optional API keys you choose to add) are saved in your device's secure keychain.
- We do not operate a server that stores your sermons or audio.

ACCOUNT (OPTIONAL)
- If you sign in with email, your email address is stored by our authentication provider (Supabase) so we can identify you across devices. You may delete your account at any time from Settings.
- Profile fields (display name, role, church) are stored with your account if you sign in.

THIRD PARTIES
- Audio is sent to our transcription provider (Deepgram) for processing. Scribe does not store your audio on any server — the recordings stay on your device.
- Your sermon transcript text is sent to our AI provider (Google Gemini, or Anthropic) to generate the outline.
- Scripture text is fetched on demand from public Bible APIs (api.scripture.api.bible and bible-api.com).
- We do not use third-party analytics or advertising.

CRASH LOGS
- A local crash log is stored on your device to help you diagnose problems. It is not transmitted anywhere. You can clear it any time from Settings.

YOUR CONTROL
- All sermons can be exported as Markdown or PDF.
- Sermons can be permanently deleted from Recently Deleted.
- You can delete your account from Settings, which removes your authentication record.

This policy applies to the current version of Scribe. We will notify you in-app if it changes.`;

export const TERMS_TEXT = `By using Scribe, you agree to:

USE AT YOUR OWN RISK
- Scribe is provided "as is" without warranty. Transcription and outline quality depend on audio conditions and the underlying AI models.

YOUR CONTENT
- You retain all rights to the sermons you record. We do not claim any ownership over your content.
- You are responsible for any content you record, including obtaining consent from anyone whose voice may be captured.

THIRD-PARTY SERVICES
- Scribe depends on Deepgram (transcription), Google Gemini / Anthropic (outlines), Bible APIs, and Supabase. Service availability is subject to those providers' terms.

ACCEPTABLE USE
- Do not use Scribe to record people without their knowledge in jurisdictions where this is unlawful.
- Do not use Scribe to record content that infringes copyright.

CHANGES
- We may update these terms. Continued use after an update means you accept the changes.`;
