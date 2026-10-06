# UI layout QA — 2026-10-06

## Scope
Frontend-only workspace layout correction. No backend, provider, security, branding, persistence, dependency, licence, metadata or publishing changes.

## Implemented
- Replaced the fixed `h-screen`/hidden-overflow workspace shell with natural document scrolling.
- Kept the desktop sidebar sticky at viewport height; its consultation list retains its own vertical scrolling.
- Kept the conversation header and recording/manual-entry footer outside the transcript scroll area.
- Set the transcript to a readable 320 px minimum and a viewport-bounded scroll area for long conversations.
- Removed the nested report-column scrollport so report sections, documents and patient instructions flow in the page.
- Moved the three bilingual fictional scenarios into a keyboard-accessible dialog with overlay, Escape/X and explicit BG/EN close control. It is closed on demo entry.
- Kept the existing scenario load path, voice phrase panel, recording controls, report controls and documents unchanged.

## Browser evidence
Executed with Playwright against `http://localhost:8080`, using the public synthetic demo only. Each run selected Bulgarian, entered the demo, opened voice phrases, opened the scenario dialog, confirmed all three Load buttons, loaded the cough follow-up as a fresh session, and scrolled through the report/documents area.

| Viewport | Result |
| --- | --- |
| 390×650 | PASS — document 390 px wide (no horizontal overflow), natural page height 3061 px; transcript 403 px high; voice phrases visible; dialog 341×539 px; 3 scenarios present; all four report section headings and Documents/Patient instructions reached. |
| 1024×650 | PASS — document 1024 px wide (no horizontal overflow), natural page height 2175 px; transcript 403 px high; sticky sidebar 650 px; all requested content reached. |
| 1366×650 | PASS — document 1366 px wide (no horizontal overflow), natural page height 1935 px; transcript 403 px high; sticky sidebar 650 px; all requested content reached. |
| 1366×900 | PASS — document 1366 px wide, natural page height 1935 px; transcript 558 px high; sticky sidebar 900 px. |
| 1366×700 at 125% CSS zoom | PASS — no document-width overflow (`scrollWidth` 1366); natural page scrolling retained; transcript measured 542.5 px after zoom; all requested content reached. |

Additional observations:
- Scenario dialog count on initial demo entry: 0 for every run.
- Scenario choices in opened dialog: 3 for every run.
- Voice phrase panel visible: yes for every run.
- Four section headings found once each after sample load: Anamnesis, Status, Investigations, Therapy.
- Five visible editable text areas were present after sample load: four report sections plus patient instructions.
- Browser console/page errors: none across the five runs.
- Screenshots were inspected for 390×650 and 1366×650 workspace/dialog states. The workspace screenshot was taken after scrolling to Documents, so the top patient/transcript area is intentionally outside that captured viewport.

## Automated checks
- Focused shared-workspace checks: 23/23 passed (`app-routing`, `demo-scribe`, `review-fixes`).
- Full existing suite: 56/56 passed, 0 failed.
- `tsgo`: exit 0.
- `bun run build`: exit 0 (client, SSR and Cloudflare/Nitro production bundles completed). Existing deprecation/chunk-size warnings remain and were not introduced or changed by this layout task.
- Preview observability build: `build OK` after the runtime edits.

## Not tested
- Physical microphone capture, authenticated clinical records and real provider calls were not exercised; this change did not touch those paths.
- No publication was performed.
