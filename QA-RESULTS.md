# QA results — Lekar AI v2

Date: 2026-10-05 (19:10–19:45 Sofia). Second pass after the approved switch to Soniox US. First-pass baseline (EU attempt, before the endpoint/region change): commit `0832aa5b9c5f3ad298a3c26fa57375b009ef339a`. Second-pass implementation revision actually tested: `60849f4ee4d6b457a4bbae38edf75ea39bb71402`. Only synthetic data was used. No secrets, tokens or temporary keys were printed. Nothing was published.

| Check | Result | Evidence / type |
|---|---|---|
| Server secrets present (SONIOX_API_KEY, LOVABLE_API_KEY, SUPABASE_URL) | PASS | Presence check only |
| Data location | INFO | Database: Lovable Cloud, Frankfurt (EU). Speech processing: Soniox **US** region, approved by the user for this demo because the existing Soniox project is registered in the US. |
| First pass: Soniox EU endpoint | FAIL → resolved by config | HTTP 401: the key belongs to the US project |
| Temporary key, US endpoint, same body as the app (60 s, max_session_duration_seconds 3600, single_use true) | PASS | HTTP 201; the key was not printed |
| Live streamed speech on the production model **stt-rt-v5** (real WebSocket, not a mock) | PASS | Synthetic Bulgarian speech (espeak-ng, 16 kHz PCM, about 5.6 s) streamed in real time with `bg` hints, diarization and endpoint detection. 1 endpoint (`<end>`) event and 1 final punctuation token were received. Graceful stop with an empty frame returned `finished:true` and close code 1000. Final text: "Пациентът има суха кашлица от 3 дни и леко повишена температура." This test used a direct WebSocket client with the app's settings, not the in-browser SDK. |
| Hardware microphone in browser | NOT TESTED | Headless test browser has no microphone |
| Luna report (`openai/gpt-6-luna`) | PASS | Same prompt; output passed the 4-field zod schema; no invented diagnosis |
| Luna assistant | PASS | 360-character Bulgarian answer listing missing information |
| Report upsert on (consultation_id, section) + reload + verification reset on edit | PASS | RLS transaction as user A: v1 verified → v2 saved with verified=null, 1 row |
| Profile / phrase persistence | PASS | Specialty and 1 phrase read back as user A |
| Isolation between two users (RLS) | PASS | User B: 0/0/0/0 rows visible; update/delete affected 0 rows; writing into A's consultation and spoofing clinician_id → 42501. Anonymous: 0 rows |
| Server function without login | PASS | HTTP 401 Unauthorized |
| Consent gate (new consultation) | PASS | Desktop 1280 and mobile 390: "Създай преглед" disabled until consent is ticked, then the consultation is created. The server-side consent check in getSonioxKey was reviewed in code, not executed. |
| Copy report (demo) | PASS | 387 characters copied, plus a warning about unverified sections |
| Mobile overflow / page errors | PASS | No horizontal overflow, 0 page errors |
| Unit tests / typecheck | PASS | vitest 2 files / 4 tests; tsgo clean |
| Production build (`vite build`, the package `build` script) | PASS | True exit status 0 at revision `e3a50049eb22139d1e42ca60e390bdf688cd1830` (2026-10-05); build completed in 1.70 s with no errors, Nitro output generated. |
| Real sign-in end-to-end in the browser (two real accounts) | NOT TESTED | The project has 0 accounts. Secure test tooling cannot create accounts without browser forms or admin keys, and both are excluded by the QA rules. Isolation was tested with simulated identities (JWT claims, `authenticated` role) inside the database. |

## Fixes (second pass)
- Server temporary-key endpoint changed to `api.soniox.com`, and the SDK uses `region:'us'` (changed together).
- Defect fixed: the app listened for `endpoint`, but `enable_endpoint_detection` was not turned on, so text was only written at stop. Endpoint detection is now enabled.
- Defect fixed: final tokens were filtered with `end_ms > lastEnd`. That filter could drop punctuation or tokens with equal timestamps. @soniox/client 2.3.0 (`handleMessage`) passes each server message through unchanged, and Soniox sends each final token only once. All final tokens are now kept.
- Rerun after the fixes, on revision `60849f4`: Luna report generation and Luna assistant re-executed server-side with synthetic text (rows above), report upsert on `(consultation_id, section)` with reload and verification reset re-executed under RLS as user A, and the isolation checks re-run as user B. All passed as recorded in the table. Typecheck (tsgo) clean; vitest 2 files / 4 tests passed. A production build (`vite build`, the package `build` script) was run at revision `e3a5004` and finished with true exit status 0, no errors.

## Cleanup
No accounts or rows were kept. Each database test ran in one transaction that ended by raising an error on purpose, so everything rolled back. Test IDs: users `…00a1`, `…00b2`; consultation `00000000-0000-4000-b000-0000000000c1`. Afterwards: consultations 0, profiles 0, phrases 0, QA consultation 0. Temporary audio files are only in /tmp.

## Blockers
1. In-app microphone recording (hardware, HTTPS, signed-in user) is not tested. Current actual regions: database in Lovable Cloud, Frankfurt (EU); speech processing in the Soniox US region with the existing key. If EU speech processing is chosen later, that requires an EU-specific Soniox key plus a paired change of the temporary-key endpoint and the SDK region — the two are changed together.
2. A confirmed account is needed for a real sign-in end-to-end test in the browser.

