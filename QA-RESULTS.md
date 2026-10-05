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

## Review-fix pass (базова ревизия afa0d07)

| Област | Резултат | Доказателство |
|---|---|---|
| Клиничен достъп само с одобрена роля clinician/admin | PASS (unit) | `review-fixes.test.ts`: отказ при false / грешка / изключение / липсващ отговор, без prepare и без доставчик |
| Дневни клинични лимити (отчет 40, асистент 120, запис 20), изходни лимити 3000/2000, Soniox 300 s | Внедрено | `reserve_clinical_budget`, `clinical-gate.ts`; изчерпан лимит → без доставчик (unit) |
| Пълна проверка на входа без изрязване | PASS (unit) | брой / реплика / общо → отказ преди лимит и AI |
| Атомарен демо лимит + общ дневен таван (100/200/400), IPv6 /64 | PASS (модел в паметта) | отхвърлена сесия не харчи мрежов/общ бюджет; 8 едновременни → 3; смяна на прозореца след 24 h. Самата SQL функция не е тествана с паралелни транзакции |
| SQL права | PASS (на живо) | anon/authenticated нямат EXECUTE за demo_reserve/demo_consume и нямат достъп до броячите; audit е само за четене от собственика |
| Undo/редакции/повторни шаблони/генериране по време на редакция | PASS (unit) | 6 теста за състоянието |
| Команди изключени от отчет и асистент | PASS (unit + браузър) | етикет „гласова команда“ видим |
| Спиране на записа при изход/край/грешка, стенен часовник с паузите | PASS (unit) | `RecordingLifecycle` |
| Чернова на ръчно въведения текст не се трие от диктовката | PASS (браузър) | след изпращане полето е празно; нов текст остава |
| Последните 30 съобщения в историята | PASS (unit) | |
| Typecheck / vitest 48/48 / production build | PASS (код 0) | |
| Реален вход с одобрен лекар, истински микрофон, паралелни SQL транзакции | НЕТЕСТИРАНО | няма профили (auth.users = 0) |

## Third pass — review of revision 8783 (base `a736a68a54f7a8182717859b7631ff7a1e1400ea`, fixes on top)

### Fixes
1. **Report save ordering** — `makeReport` enqueues every replaced section write synchronously when the draft is applied, then awaits `Promise.allSettled`. One failed section no longer skips the others; partial persistence is shown as a save error (listing sections), not a generation failure. Later manual edits/verification queue after generated content.
2. **Workspace/auth generation** — single `invalidateWorkspace()` (bumps generation, clears save timers/queues/versions, owner, busy) on SIGNED_OUT, auth identity switch, demo entry, End demo and unmount. `loadCloud`, `persistSection` queue callbacks and clinical `sendQuestion` capture generation + owner id and drop stale results; writes use the captured owner, never the current user.
3. **Quota SQL** — opportunistic stale-row deletes removed from BOTH `demo_reserve` and `demo_consume` (either could lock rows another call uses; a delete between `INSERT … DO NOTHING` and `SELECT … FOR UPDATE` in `demo_reserve` could also leave no row → NULL comparison → `ok:true` without debit); reservation locks only its requested buckets in sorted order. New service-only `demo_quota_cleanup()` (max 200 rows, SKIP LOCKED) runs as a separate best-effort transaction on ~5% of reservations (migration 0007).

### Executed (mocked network, synthetic data, no real accounts)
| Check | Result |
|---|---|
| Delayed first section save (3 s) + edit and Verify of a later section during it | PASS — storage and UI both end with the newer edit, verified |
| Delayed cloud load (3 s) + sign-out during it | PASS — old consultations not restored after logout |
| Delayed clinical assistant (3 s) + sign-out during it | PASS — no chat insert, no answer shown |
| First generated section save fails (HTTP 500) | PASS — other 3 sections still saved, draft shown, save error lists the failed section |
| vitest | PASS 48/48 |
| typecheck / production build | PASS / exit 0 |

### Not executed (honest)
- Actual concurrent SQL test of `demo_reserve`/`demo_consume`: NOT executed — DB tooling here allows only single queries, no parallel transactions. The in-memory quota fixture tests are not live SQL evidence. Fix is by code review only.
- Delayed cloud load + demo entry: guarded by the same generation (demo entry now invalidates), not separately browser-tested.
- Auth identity switch without sign-out (A→B in-place): code path added, not browser-tested (only sign-out was simulated).
- Correction to earlier note: waiting with a typed draft does **not** test a dictation callback. Fake-audio Soniox check that an unsent manual draft survives final speech/flush, BG+EN voice command, repeated Undo, generation during manual editing, whole-input error and reset were **not re-run** on this final code.
- Real sign-in and physical microphone: not tested.

### Follow-up (migration 0008, additive)
- `demo_reserve` now locks each requested bucket in sorted order with an atomic `INSERT … ON CONFLICT DO UPDATE SET bucket = c.bucket` (no gap where a separate cleanup could delete the row). If a row is missing, a field is NULL or remaining is incomplete, it fails closed (`ok:false` or an exception), never `ok:true`. The server wrapper also rejects an `ok:true` result whose remaining values are missing or invalid. Earlier migrations were not edited.
- Blur without a pending edit no longer saves `verified_at = null`: focusing and leaving an untouched verified section keeps its verification and sends no save.
- Auth user id is tracked as state; role lookup, cloud loading and integration status rerun on an in-place A→B switch, and a late integration status from the old generation is dropped.

| Check (executed this pass) | Result |
|---|---|
| Mocked T1–T4 (save order, sign-out during load/assistant, partial save) rerun | PASS |
| Focus/blur of an untouched verified section (mocked) | PASS — 0 saves, still "Проверено" |
| vitest / typecheck / production build | 48/48 / PASS / exit 0 |

Not executed: live concurrent SQL against `demo_reserve` (tooling has no parallel transactions; code review only); in-place A→B auth switch in a browser (code path only).
