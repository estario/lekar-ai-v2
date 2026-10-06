# Public demo sharing review — 2026-10-06

Public URL: https://lekari-ai-bulgaria.lovable.app/
Final Lovable source: `b289e68afa5fa7c7b25b9112e22c8cd78f979a03`.

## Outcome

No remaining observed blocker for sharing this fictional-data demo. Real AI generation and the public entry path were tested; the user separately confirmed a real microphone recording and automatic note generation on Finish. This is demo readiness, not a clinical validation or a guarantee that AI output is always factual.

## Independent public-site checks

Initial review used the already published `0444dc1a` update, including the user's temporary quota increase and automatic report on Finish.

- Anonymous public entry succeeded; the prior daily network session blocker no longer prevented entry.
- BG/EN controls worked. The initial sample dialog stayed closed. All three guided cases could be selected and a case loaded into a fresh session.
- A real Luna detailed Bulgarian cough-follow-up report populated all four sections without inventing a denial of blood in sputum. Unstated sex was not asserted; the history used "Приемал/а".
- Reviewed source sections unlocked document generation. Real Bulgarian patient summary and English SOAP note were generated through the public UI. SOAP Assessment was "Not documented" rather than an invented diagnosis.
- Copy showed its success notice. The automation clipboard API returned empty content, so the actual clipboard payload was not independently verified; the document's demo watermark was visible and included in the copy-format source code.
- Editing Examination marked the summary stale and disabled copying. Restoring the original text and reviewing it again did not resurrect the old document's export.
- English voice phrase "abdomen normal" expanded into Examination. Undo removed the expansion and restored the previous section text.
- At 390×650, transcript height was 403px and document width 375px. At 1366×650, transcript height was 403px and document width 1351px. No horizontal overflow; page scrolling reached the report/documents.
- The first English assistant response incorrectly denied blood in sputum when only dyspnea/chest pain were explicitly denied. This was a real observed defect, not a passed check.

## Fixes and public verification

- Added strict partial-answer/factual-evidence requirements to the demo assistant's system prompt; no model/provider change. Prompt rules reduce the observed error but do not guarantee immunity to hallucination or instruction override.
- Replaced the fixed 3/5/10 landing text with BG/EN text generated from shared quota configuration, explicitly marked temporarily raised.
- Removed unsupported chest-pain denial from the two prewritten initial demo histories; raw transcripts and cough-follow-up ambiguity remain intact.
- Reviewed the exact diff and published through Lovable. The editor confirmed "Your website was updated".
- Reloaded the public site: English landing showed 100,000/100,000/100,000 and the 5-minute recording cap. Bulgarian initial history now denied dyspnea alone.
- Repeated the exact originally failing question through the public assistant on the Bulgarian cough transcript. English output explicitly stated "whether it contains blood was not documented" and identified age/sex as unknown.
- Followed with the equivalent Bulgarian question in the same public session. Output stated "наличие на кръв не е уточнено" and listed age, sex and blood in sputum as undocumented. Both complete answers were read.
- Generated a fresh detailed Bulgarian report after publication; all four sections populated and the UI confirmed the draft was ready. Saved a screenshot of the published demo with its transcript and report.
- Public title and sharing-image metadata remained Lekar AI branding; no Edit with Lovable link/button was present. Viber cache refresh itself was not tested. Browser automation inserts its own favicon badge, so the mutated live favicon link was not treated as evidence of the application's original favicon; original source configuration and earlier branding checks are preserved.
- Exported final source: `tsc --noEmit` exit 0; 56/56 existing tests passed. The previous `0444dc1a` export built successfully; Lovable recorded a successful final assistant-update build separately in root `SHARE-READINESS-QA.md`.

## User-confirmed physical test

Asked the user to make a new fictional consultation, record 20–30 seconds, and press Finish. The user replied "Да, работят и двете", confirming transcript appearance and automatic note generation. This was performed by the user, not observed by the agent. Two-speaker live diarization/color assignment was not separately confirmed.

## Limits and untested paths

The user explicitly selected "Остави временно високите лимити". Raised per-session, network and global limits remain; the 5-minute recording cap remains. Email and SMS remain visibly not configured. Physical printing, the clipboard payload, all referral outputs, long-running microphone recovery and authenticated clinical workflows were not revalidated in this review. No real patient data was used.
