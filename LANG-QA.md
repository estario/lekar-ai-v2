# Language QA — Bulgarian / English demo

Date: 2026-10-05, ~20:20–20:30 Sofia. Base revision before this change: e795d0d. Synthetic data only. Not published.

## What changed
- "Български / English" selector on the demo landing; the same shared language is used in the sidebar toggle and Settings.
- First visit: `navigator.languages[0] || navigator.language` starting with `bg` → Bulgarian; anything else → English. Server render starts in Bulgarian and switches after load (no IP/geolocation lookup). A manual choice is kept for the browser tab (sessionStorage) and survives entering/ending the demo.
- All public demo screens translated: warning, provider disclosure, acknowledgment, quota banner, new consultation fictional-scenario text, recording controls/errors, section headings, assistant, settings, notifications, export/print header, end-demo confirmation, accessibility labels. Known server error messages are shown in English for English visitors.
- English entry seeds English synthetic examples. Switching language later does not change or translate existing work.
- `demoReport`/`demoAssistant` accept an allowlisted `language: 'bg'|'en'`; same 4 JSON keys, caps, quotas and security. Model openai/gpt-6-luna, Soniox US, clinical auth/RLS and public host unchanged.

## Results
| Check | Result |
|---|---|
| Browser locale bg-BG → Bulgarian; en-US → English; de-DE → English (`<html lang>` follows) | PASS |
| Manual switch on landing (bg-BG browser → English) | PASS |
| Enter demo in English at 390 px: English banner, quotas, headings, Emily Carter sample | PASS, no horizontal overflow |
| Switch language in workspace: labels change, sample + newly entered line kept unchanged | PASS |
| Copy all: begins "DEMO — fictional data, not for medical use." with English headings | PASS |
| Real English Luna report (synthetic) | PASS — English text in History; other 3 sections empty because the prompt leaves unsupported sections empty |
| Real English Luna assistant answer | PASS — English list of missing information |
| New consultation (Fictional scenario) and Settings in English | PASS |
| End demo → landing still English | PASS |
| English error shown when daily session limit hit | PASS (observed: "The daily number of demo sessions for this network has been reached.") |
| Unit tests | PASS — 18/18 (new i18n tests: detection, dictionary parity, error mapping) |
| Typecheck (tsgo) | PASS |
| Production build (`npm run build`) | PASS — exit 0 |

## Notes / limitations
- QA had exhausted the daily demo-session counter for the test network; only that single counter row was reset to run the test. No other data touched.
- Not tested: English recording with a real microphone (headless browser has none); print dialog rendering (export header verified in code and via copy).
- Clinician sign-in screen and admin/authenticated-only messages remain Bulgarian (outside the public demo).
- Before hydration the page briefly renders Bulgarian for English browsers (behind the loading screen).

