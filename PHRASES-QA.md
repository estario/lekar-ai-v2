# Voice phrases QA — public demo

Date: 2026-10-05, ~20:40–21:15 Sofia. Revision tested: 60666da plus the review fixes below. Synthetic data only. Not published.

## Feature summary (demo only)
- Settings → "Гласови фрази / Voice phrases" (separate from "Phrase replacements"): trigger, section, language, enabled, multiline text; add/edit/delete; errors for empty trigger, empty text, duplicate normalized trigger in the same language. BG/EN defaults → Status, labelled as editable preset demo text that needs review (not AI, not patient speech).
- Workspace "Voice phrases" panel: active-language phrases with Insert, "Try phrase", "Undo latest insertion"; provenance line under the section; notice; section set unverified.
- Memory only; resets on enter/end/reload. Clinical flow, auth/RLS, Soniox US, openai/gpt-6-luna, quotas unchanged.

## Review fixes (second pass)
1. **Report merge uses latest state.** After the awaited demo report, sections are rebuilt inside a functional state update from the current session's expansions (captured session id), so insert/undo during generation is neither lost nor resurrected. Cue-only segments (segments that triggered an expansion) are removed from AI input; the raw cue stays in the transcript and the exact template is appended after generation. If only cue segments exist, no AI call is made.
2. **Original cue is matched.** Matching uses the original utterance before literal corrections; when it matches, the transcript keeps the original cue. A correction cannot create a trigger.
3. **Stable source identity.** Soniox finals go through `FinalUtteranceBuffer` (one per recording run): each flushed utterance gets key `rec:<runId>:<n>`. Flushing again (repeated endpoint/finish) returns nothing, a source key already seen is ignored, and `applyExpansionTo` is idempotent per key. No end_ms filtering, so equal-time punctuation is kept. A later genuine repetition is a new utterance with a new key, so it inserts again. Typed lines use `typed:<segmentId>`.
4. **Matcher tolerance.** Inner commas, semicolons and en/em dashes count as spaces, because real Soniox output was "Корем, нормален." "Не, корем нормален" still does not match.

## Executed checks
| Check | Result |
|---|---|
| Unit tests `voice-phrases.test.ts` (12): case/punctuation/BG Unicode/inner comma; negation/substring/longer/wrong language/disabled; validation; insert/undo preserves edits; regeneration no duplicates; template edit not retroactive; buffer keeps equal-time punctuation; repeated flush gives nothing; later repetition gets a new key; interim-only gives nothing; repeated same-key apply inserts once and marks unverified; cue segments excluded from AI input | PASS |
| All unit tests | PASS — 30/30 |
| Typecheck (tsgo) | PASS |
| Production build (`npm run build`) | PASS — exit 0 |
| Browser: correction "бели дробове ок"→"корем нормален" does not expand; original "Корем нормален." expands even with correction "нормален"→"в норма", and the transcript keeps the raw cue | PASS |
| Browser, demo report delayed 6 s (request held by test): undo during generation → no resurrection after real Luna result | PASS |
| Same request body: cue line absent, other conversation lines present | PASS |
| Browser, delayed report: Insert during generation → template present exactly once after real Luna result; section unverified; Luna History filled from conversation | PASS |
| Reload → demo landing (state gone) | PASS |
| Real Soniox US dictation (Chromium fake-audio from Gemini TTS synthetic clip, played twice, no physical mic), stt-rt-v5: transcript "Корем, нормален." ×2 as physician lines → 2 expansions in Status, 2 provenance lines (two genuine utterances, distinct keys); typed same text afterwards → 3rd | PASS |
| Earlier Soniox attempts: espeak clip → "Проблем нормален."; first Gemini clip → "Корен нормален."; no expansion (correctly strict) | observed |
| Mobile 390 px with panel open: no horizontal overflow, panel stacks | PASS (screenshot) |
| First-pass browser suite rerun (negation, insert, undo, manual insert, duplicate error, add, disable, patient not expanded, English) | PASS, no page errors |

## Not tested / limitations
- No physical microphone. Conversation (diarized) mode does not expand by design.
- The delayed-report browser suite was rerun on the final code (after the inner-comma change): all PASS.
- Duplicate Soniox final results were not injected live. They are covered only by unit tests of key/flush idempotence.
- About 6 demo sessions, 3 recordings and 4 Luna reports were used from quotas. No other data touched.

