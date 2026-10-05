<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep demo consultation data in browser memory only; authenticated clinical records use owner-scoped Cloud tables so sample patients never reach production records.
- Keep protected AI and transcription requests in authenticated server functions; the browser receives only short-lived Soniox credentials so long-lived keys never reach users.
- Keep report verification per section and reset it after changes; physician approval must not survive an edit.

- Keep request-local AI gateway providers and correlation state in server-only helpers; worker requests must never share credential or run state.
- Queue report section writes per section so older saves cannot overwrite later verification or edits.
- Preserve provider speaker IDs separately from physician/patient roles; diarization identifies distinct voices, not clinical roles.
- Public demo uses separate demo-only server functions with an HMAC session token derived from an existing server secret plus server-side hashed quota counters; demo content stays in browser memory and never touches clinical tables or authenticated handlers.
- Demo UI text lives in src/lib/i18n.ts (bg/en dictionaries, one shared locale state); demo AI calls take an allowlisted language — keeps translations in one place and server input bounded.
- Demo voice phrases (src/lib/voice-phrases.ts) are deterministic, in-memory, doctor-only whole-utterance matches with expansion text snapshotted per session; keeps preset text out of AI input and clinical storage.

