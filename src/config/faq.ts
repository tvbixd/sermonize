export type FaqEntry = { q: string; a: string };

export const FAQ: FaqEntry[] = [
  {
    q: 'What is Scribe?',
    a: 'Scribe records your sermon, transcribes it live, and turns the transcript into a clean outline with scripture references — all in one tap.',
  },
  {
    q: 'How do I get started?',
    a: 'Add a Groq API key in Settings (free at console.groq.com), tap the record button on the Sermons screen, and start preaching. Scribe will transcribe in the background.',
  },
  {
    q: 'Why do I need a Groq API key?',
    a: 'Groq runs the Whisper transcription and Llama outlining models on their servers. Their free tier is generous — usually enough for ~2 hours of sermon recording per day. Your key stays on your device.',
  },
  {
    q: 'Is my audio sent to a server?',
    a: 'Audio chunks are sent directly to Groq for transcription, then immediately discarded by Groq. Scribe itself does not store or upload your audio anywhere — the original recordings stay on your device.',
  },
  {
    q: 'What happens if I lose internet during recording?',
    a: 'Recording continues offline. The audio is saved to your device. When you reopen the sermon later, tap Re-transcribe to generate the transcript from the saved audio once you are back online.',
  },
  {
    q: 'I hit a rate limit mid-sermon. What now?',
    a: 'Scribe detects this and asks whether to stop and save, continue recording audio-only, or keep trying. The audio is always saved — you can re-transcribe from the sermon detail screen later.',
  },
  {
    q: 'Can I record when my phone is locked?',
    a: 'Yes — recording continues in the background and when the screen is locked. If the app is killed by the system, Scribe auto-saves a draft every five minutes so nothing is lost.',
  },
  {
    q: 'How long can I record?',
    a: 'There is no hard limit on recording length — the audio is rotated into 30-second chunks so memory stays low. The Groq free tier limits how much you can transcribe per day (~2 hours).',
  },
  {
    q: 'The transcription has errors. Can I fix it?',
    a: 'Yes. Open any sermon and tap Edit to revise the title, theme, summary, points, or sub-points. You can also add or remove scriptures by tapping the Scriptures tab.',
  },
  {
    q: 'Can I export my sermon?',
    a: 'Tap Export on the sermon detail screen to share as Markdown or PDF.',
  },
  {
    q: 'Where are my sermons stored?',
    a: 'On your device only. They are not currently synced or backed up to the cloud. Use Export regularly if you want a copy outside the app.',
  },
  {
    q: 'How do I permanently delete a sermon?',
    a: 'Swipe a sermon to delete — it goes to Recently Deleted for 30 days, then is purged automatically. You can restore it from Recently Deleted before then.',
  },
];
