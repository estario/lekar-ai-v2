# Scribe demo extension — independent checkpoint

Lovable final source: `d05e07bd1c03054022ef4dd2739c1aa61ee0c95c` (2026-10-05). Three Lovable turns cost 12.3 + 3.7 + 2.6 = 18.6 credits.

New demo-only features: 3 fictional cases creating new sessions, prior-context display, progress, server-allowlisted report presets/styles, patient summary/referral/SOAP from reviewed sections, separate document-language choice, editable documents with DEMO copy/print labels, source revision snapshots and sticky invalidation. Existing assistant budgets are shared, no clinical storage/access expansion or migration.

## Independently executed

- Exported and reviewed raw source. Found source-restore resurrection of document verification; Lovable corrected it with revision snapshots and sticky invalidation plus a regression test. Workspace invalidation now clears documents/busy; default output locale follows UI until explicitly selected.
- Local final suite: 56/56 across 7 files. `node node_modules/typescript/bin/tsc --noEmit` and `npm run build`: exit 0. Frozen Bun install succeeded after reconciling the build-package lockfile (see EXPORT.md).
- Preview: loaded BG cough scenario into a new session without replacing existing work; selected follow-up/detailed; real Luna report used the choices and report quota decreased 5 → 4. Document creation disabled before all filled sections were reviewed.
- That report falsely inferred denial of blood in sputum from a partial answer. Manually corrected it before review; real BG referral then preserved the missing answer and left destination/reason not documented. Real EN SOAP succeeded and left assessment not documented. Shared assistant/document quota decreased 10 → 9 → 8. Patient instructions remained separate.
- Screenshot of generated EN SOAP saved in the local workspace. Document copy/review clicks on that preview were interrupted by browser-control errors; they are not counted as successful independent checks.

## Lovable-executed checks and limits

SCRIBE-DEMO-QA.md distinguishes vendor-run browser checks from unit tests and source inspection. It reports real summaries BG/EN, copy watermarks, source staleness, reload reset, 390px layout, and print-media emulation. Referral and SOAP under the final uncertainty prompt were not rerun by Lovable. Full restoration/invalidation sequence is unit-tested, not independently browser-tested at this checkpoint. Physical microphone, authenticated clinician flow, actual print-dialog output, and concurrent live SQL were not retested for this demo-only extension.

## Known AI limitation

The final instructions explicitly disallow treating clinician questions or unanswered symptoms as facts, and preserve uncertainty in secondary documents. Lovable's three live checks found an unsupported negative in the first attempt; after further prompt tightening two runs omitted it. Gender-neutral grammar still varied. These small samples do not prove faithful output. All AI output remains a draft requiring manual source comparison; the demo is for fictional data and is not intended for medical practice.

## Publication and public smoke check

Lovable confirmed "Your website was updated"; final project SHA remains `d05e07bd1c03054022ef4dd2739c1aa61ee0c95c`. Public URL: https://lekari-ai-bulgaria.lovable.app/.

- Entered public EN guest demo with fictional-data acknowledgment. Three scenario cards and presets/documents were visible. Loaded the knee case into a new session, selected musculoskeletal + bullets; real Luna report contained supported history/examination/no-imaging/plan and carried the used preset label. Review gate blocked document creation.
- Reviewed all four sections, generated a real EN patient summary under the final uncertainty prompt; output matched the report. Shared assistant/document quota decreased 10 → 9. Document review via keyboard visibly became "Reviewed ✓".
- Edited report history: document became stale and review/copy/print were disabled, preserving its text. Restored the original history and reverified the source: document stayed stale/unreviewed and export stayed blocked. This independently covers the full restoration sequence on the published code, superseding the earlier unit-only limitation for that sequence.
- Clipboard export was not independently verified: the browser-controlled copy attempt did not produce the expected demo header in the clipboard. Lovable's separate browser clipboard checks passed; source adds the header explicitly. Actual print-dialog output remains untested.

All test data used here are fictional. Provider correctness is not guaranteed by successful function calls or by unit tests.
