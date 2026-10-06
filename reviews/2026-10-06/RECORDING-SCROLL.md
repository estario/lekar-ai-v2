# Recording Finish and transcript follow — 2026-10-06

Lovable source: `42541e5b2e64a87091d3b49a106267bd74307149`.
Published site: https://lekari-ai-bulgaria.lovable.app/

## Defect and fix

The user reported that Finish did not generate notes. Source review confirmed a deterministic defect: the old function called lifecycle teardown (which increments generation) before returning `ok && current()`, making successful completion return false. The earlier share-readiness review's physical microphone result was a user confirmation, not an independent observation of that orchestration; it did not catch this bug.

Lovable added a shared FinishFlow used by user Finish and the wall cap. Success is captured before owned teardown, with workspace and recording generation guards, pending-write completion and duplicate suppression. Report generation is bound to the finished session. Provider errors, failed stops, failed writes and stale sessions do not trigger automatic AI. Protected section overwrite confirmation and guarded merges remain.

The transcript follows final and interim text using only its container scrollTop. Scrolling up pauses following; BG/EN Jump to latest resumes it. Session changes reset following. User-requested temporary high quotas remain unchanged.

## Independent validation

- Exported source: TypeScript exit 0; 62/62 tests passed across 8 files. Six new tests exercise the actual FinishFlow with RecordingLifecycle and a fake recorder. Lovable also recorded a successful production build in RECORDING-SCROLL-QA.md.
- Published through the editor and observed "Your website was updated"; reloaded an agent-created public test tab.
- Added a long fictional manual line: transcript scrollTop reached 569.5px (maximum approximately 569px); scrollLeft was 0 and scrollWidth equaled clientWidth, 480px.
- Scrolled up using browser input: transcript moved to 0 and the Bulgarian Jump to latest appeared. Adding another line kept it at 0 while the maximum increased to 645px, with page scrollY unchanged at 401px. Jump to latest moved the transcript to 645.5px. The automation's focus movement can itself scroll the outer page, so this is not a blanket claim about focus scrolling.
- Created a fresh fictional consultation with empty report sections. Temporarily replaced getUserMedia only in this test tab with a silent synthetic AudioContext stream; no ambient microphone audio was captured and no permissions/settings were changed.
- Used the actual public Start recording button: real Soniox connection reached active recording. Added a final fictional manual line while active, then pressed the actual Finish button. Observed waiting-for-final-text, then automatic "Генериране…", without pressing Generate from conversation.
- A real Luna response completed: "Черновата е готова. Проверете всеки раздел." Report quota decreased exactly once to 99999. History documented fictional cough; investigations and therapy reflected the last manual line. Examination stayed empty because no examination was documented. Read the complete resulting report fields.
- Removed the synthetic microphone override and closed its AudioContext, restoring the original microphone API. Reset temporary viewport metrics. Saved a screenshot of the actual published result.

## Limits

This public button test used silent synthetic audio and manually entered fictional text. It validates the actual UI-to-Soniox-stop-to-Luna orchestration, not spoken-word recognition or live interim speech scrolling. Final-token delivery during stop, stale/failed finishes, repeated Finish and the wall-cap path are covered by orchestration tests; no new physical microphone speech test was performed. No real patient data was used.
