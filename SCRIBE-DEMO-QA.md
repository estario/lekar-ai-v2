# Scribe demo package — QA (base 90600e7)

Scope: demo only. No DB migration, no new clinical endpoint, no storage. Luna `openai/gpt-6-luna` unchanged.

## Implemented
- 3 fictional guided cases BG/EN (`src/lib/demo-scenarios.ts`), each loaded into a NEW session (fresh id, no identifier), with a prior-context card. No AI/quota/mic used for loading.
- 4-step progress derived from state (`demoProgress`).
- Report presets: template general/followup/msk, style concise/detailed/bullets; zod enums in `demoReport` (rejected before quota); used preset shown under the picker.
- `demoDocument` server function: kind/language allowlisted, 4 sections ≤3000 chars each, total ≤9000, validated in inputValidator before quota; shares `assistant` quota buckets; output cap 2500; returns remaining.
- Documents panel (patient summary, referral, SOAP): requires all non-empty sections reviewed; watermark "DEMO — fictional data — draft for review" + "Source: reviewed report" in UI, copy and print; edit resets document review; source change → stale, copy/print/review disabled; late results discarded on workspace generation change or slot edit; one generation at a time; cleared on End demo / reload. Patient instructions untouched.

## Executed
| Check | Result | Evidence |
|---|---|---|
| Unit tests (new `demo-scribe.test.ts`: allowlists, document budget, eligibility, staleness, edit reset, late-result discard, progress) | PASS 7/7 | vitest |
| Full suite | PASS 55/55 | vitest |
| Typecheck | PASS | tsgo |
| Production build | PASS exit 0 | `npm run build` |
| BG browser: load knee case, msk + bullets, real Luna report | PASS — bullet output, "Генериран с: Опорно-двигателен · Точки" | screenshot |
| Review gate before verification | PASS — message listing unreviewed sections | browser |
| Real Luna patient summary (BG and EN) | PASS — 541 / 495 chars, absent facts not invented in excerpt read | browser |
| Copy carries watermark | PASS BG + EN | clipboard read |
| Source edit → stale, copy disabled | PASS BG + EN | browser |
| Shared quota decremented (10 → 9) | PASS | banner |
| Reload clears documents | PASS | browser |
| 390px layout, no horizontal overflow | PASS | browser |
| Print CSS: report hidden when document print flag set | PASS (emulated print media) | browser |

## Not executed / mocked
- Real print dialog output of a document (only print-media emulation).
- Referral and SOAP kinds via live Luna (only patient summary was generated live; same code path).
- Late-result discard in browser (covered by unit test only).
- Server rejection of invalid preset sent over the wire (covered by zod schema + unit test, not a live request).
- Physical microphone; authenticated clinical flow (unchanged).

Historical result at the initial build: not published. Final deployment status and independent checks are in reviews/2026-10-05/SCRIBE-DEMO.md.

## Follow-up: sticky document invalidation
Fixes:
- `DemoDoc` now snapshots source section revisions (`sourceRevs`) as well as content; `isDocStale` checks content OR revision differences, plus a sticky `invalidated` flag.
- `invalidateDocs` runs whenever any session's report changes, for every session's documents (not just the visible tab/session). It sets `invalidated` and clears the document's `verified_at`, but keeps the draft text. Only regenerating clears staleness.
- `invalidateWorkspace` (auth switch, sign-out, end demo, unmount) now resets documents, their ref and busy state.
- The document language follows the UI language until the user picks a language manually.

Executed:
- New regression unit test (verified doc → source edit → restore original text → re-verify source → doc still stale and unverified, export blocked; regenerate → fresh): PASS.
- Full suite 56/56, typecheck and production build (exit 0): PASS.
- BG browser flow rerun (preset report, review gate, real Luna summary, copy watermark, stale and copy disabled after source edit, 390px, reload clear): PASS.

Not executed in the browser: the full restore-and-re-verify sequence (unit test only), the language-follow behaviour, and auth-switch reset (verified by code review only, no test).

## Follow-up: question-as-fact inference (live QA on 15cdd7b)

### Your live checks (independent QA, recorded as you reported them; I did not repeat them)
- Cough follow-up, style "detailed", real Luna report: it inferred "denies blood in sputum" from the doctor's multi-symptom question. The patient denied only dyspnea and chest pain. You corrected this by hand before review.
- Real BG referral: destination and reason were "Not documented"; the missing blood answer was preserved.
- Real EN SOAP: generation started (you did not report its outcome).

### Changes
- demoReport prompt: a clinician question is never a fact; record a denial only when the patient states it explicitly; a partial answer to a multi-symptom question denies only the symptoms it names, and unanswered items get no negative wording ("отрича", "не съобщава", "няма"); exam/tests/plan only as actually stated by the clinician; no inferred age, sex or diagnosis, with gender-neutral wording when sex is unknown.
- Document prompts: preserve uncertainty and missing answers; never turn unclear or unanswered items into denied or established ones.
- The sample transcript is unchanged; the ambiguous question stays in so this can still be tested.

### My browser checks (fresh cough session, style "detailed", real Luna, no overwrite dialog)
| Run | Prompt | Blood mentioned? | Other observation |
|---|---|---|---|
| 1 | first tightening | YES: "не съобщава храчки с кръв" (an unsupported negative) | masculine verb "Приемал" (sex not given) |
| 2 | added the no-negative-wording and neutral-gender rules | no | "Приемал(а)" (neutral) |
| 3 | same as run 2 | no | masculine "Приемал е" again: gender neutrality is not reliable |

I read all four sections in every run. Status, Investigations and Therapy contained only what the clinician actually said. Three samples do not guarantee there will be no hallucination; the physician review step remains required.
Not re-run after the change: documents (referral/SOAP) under the new document prompt.
Typecheck, tests 56/56 and production build (exit 0): PASS.
