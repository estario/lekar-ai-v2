# Recording finish + transcript scroll QA — 2026-10-06

## Root cause (Finish never generated notes)
`finishRecording` captured `lifecycle.gen`, then its `finally` called `teardownRecording()` (which bumps the generation) and returned `ok && current()` — always false after our own teardown, so `makeReport` was never called.

## Fix
- New `src/lib/finish-flow.ts` (`FinishFlow`): success is computed in `finally` **before** our own teardown. Current = same lifecycle generation + same workspace/demo epoch + same recording session id. Sequence: stop recorder (receives final tokens) → flush buffered finals once → await all tracked transcript writes → persist duration/status → teardown.
- `finishAndGenerate` is the single path for user Finish and the 5-minute wall-cap finish. It launches one report bound to the finished session id (`makeReport(id)`); a per-session in-flight set blocks duplicate/overlapping reports.
- No report on: stop failure, failed transcript write, failed persistence, provider error (`providerEnded`), end demo / sign-out (epoch change), unmount or replaced session (generation change).
- `makeReport` now takes the session id instead of the selected session. The protected-section overwrite confirmation, revision snapshots and guarded merge are unchanged.

## Transcript follow
- Auto-scrolls its own bounded box (`scrollTop`, never `scrollIntoView`) on new final segments and on interim text, while following.
- Scrolling up >48 px from the bottom pauses following and shows a "↓ Към последното / Jump to latest" button; clicking it or scrolling back to the bottom resumes following. Follow resets on session switch.
- Box has `overflow-x-hidden break-words`.

## Evidence
- `src/test/finish-flow.test.ts` (6 tests) drives the real `FinishFlow` with the real `RecordingLifecycle` and a fake recorder whose `stop()` delivers the last final token: success + teardown → exactly 1 report containing the final utterance once; end demo during stop → 0; unmount teardown during stop → 0; stop failure → 0 (error surfaced); failed transcript write → 0; 3 concurrent Finish → 1 report, 1 stop; timer-driven wall cap → 1; provider-ended → saves, 0 AI.
- Full suite 62/62, `tsgo` exit 0, `bun run build` exit 0.
- Browser (Playwright, 1366×700, demo seed session): transcript box opened at its bottom (scrollTop 13 = max), box scrollWidth = clientWidth (469), document width 1366, page `scrollY` stayed 0.

## Limitations
- The tests exercise the orchestration module, not a rendered React component with a fake Soniox recorder; the component wiring (`finishDeps`) was checked by type check and review.
- The seed transcript was only 13 px taller than the box, so the jump button and live follow during real speech were **not** observed in the browser. No physical mic or live Soniox/Luna run in this pass.
- Not published.
