# Lekar AI v2 — independent source review (revision `afa0d07`)

## Scope and limitations

**Reviewed in full:**
- Demo server path: `demo.functions.ts`, `demo-token.ts`, `ai/clinical.server.ts`, `ai/run-id.ts`
- Protected server path: `clinical.functions.ts`, `admin.functions.ts`
- Supabase auth middleware, auth attacher, `client.server.ts`, `start.ts`, `server.ts`, `error-capture.ts`
- All 5 migrations, read together as one schema, plus the journal
- `routes/index.tsx` (all of it), `reset-password.tsx`, `voice-phrases.ts`, `i18n.ts`, `clinical.ts`
- All tests, and the docs EXPORT, AGENTS, SETUP, DEMO-QA, QA-RESULTS and PHRASES-QA

**Limitations:**
- I only had Read/Glob/Grep. I did not run tests, the build, the app, or the SQL.
- I can't see the Lovable Cloud runtime config (auth signup settings, bucket existence, whether the edge sets `cf-connecting-ip`). Where a finding depends on it, I say so.
- I skipped the shadcn `components/ui/*`, the generated `types.ts` and the drizzle snapshots.
- Plan mode was active, but I had no tool for writing a plan file, so this report is the whole deliverable. No files were changed.

**No confirmed P0. One P1**, which is in the protected path reachable from the published demo, not in the demo token itself.

---

## Confirmed findings

### P1-1 — Anyone can sign up on the public host and use the clinical AI and transcription functions with no daily cap
- **Evidence:**
  - The landing page links to the clinical login (`src/routes/index.tsx:31`, `loginLink`).
  - `AuthScreen` offers `supabase.auth.signUp` and Google OAuth (`index.tsx:25-26`). SETUP.md:7 confirms both are enabled.
  - Any new account can create its own consultation and call `generateReport`, `askAssistant` and `getSonioxKey`.
  - The only limit is `reserve_clinical_request`: 8 requests per minute per user, with no daily ceiling (`drizzle/migrations/0001_…sql:4`, `clinical.functions.ts:6-9`).
  - `getSonioxKey` issues keys with `max_session_duration_seconds: 3600` (`clinical.functions.ts:59`). Dictation mode needs no consent (`:56`).
  - `generateReport` and `askAssistant` pass no `maxOutputTokens` (`:27`, `:47`).
- **How to reproduce:** Sign in with any Google account, create a dictation consultation, and call `getSonioxKey` 8 times a minute. That is up to 8 one-hour Soniox sessions started per minute, around the clock. Report calls allow about 11.5k uncapped Luna calls per day per account. A second account doubles it.
- **Consequence:** The demo's 3/5/10 quotas and per-IP counters are bypassed completely by switching to the clinical path on the same host. It also invites real patient data (the ЕГН field at `index.tsx:86`) into a workspace that is documented as not validated for real patient use.
- **Fix (pick one or combine):**
  - Disable public signup and Google auto-provisioning in Cloud auth, and gate the clinical functions on an allow-listed `clinician` role. `has_role` and the `app_role` enum already exist; `clinician` is defined but never checked.
  - Add per-user daily counters (you can reuse `demo_consume` with `user:<uid>:…` buckets).
  - Lower the Soniox duration and add `maxOutputTokens` on the clinical calls.
  - Hide the clinical login link on the published demo host.

### P2-1 — Microphone keeps recording after a `SIGNED_OUT` event, with no visible controls
- **Evidence:**
  - The `SIGNED_OUT` handler resets auth, sessions, role and chat, but does not cancel the recorder or the timer (`index.tsx:40`).
  - Because `ClinicalApp` stays mounted (it just renders the landing page at `:81`), the unmount cleanup at `:42` never runs.
  - The recorder lives in `recordingRef`. Pause and Finish are no longer rendered.
- **How to reproduce:** Start a clinical recording. Then either sign out in another tab (supabase-js broadcasts it across tabs) or let the refresh token fail. The UI switches to the landing page while the mic is still capturing and audio keeps streaming to Soniox for up to 3600 s.
  - Each flushed segment fails at `addSegment` (`:62`, no user), so text is lost.
  - The consultation stays at `status='recording'`.
- **Fix:** In the `SIGNED_OUT` branch, call the same teardown as `endDemo`: `recordingRef.current?.cancel()`, `tickStop()`, and reset `recordingSessionId`, `pendingSegments` and `finalBuffer`. The logout button already guards with `stopOnNavigation`; only these external triggers are unguarded.

### P2-2 — Long transcripts are silently truncated, and client and server cut from opposite ends
- **Evidence:**
  - Demo client sends only the **last** 120 segments: `aiSegments.slice(-120)` (`index.tsx:70`).
  - Demo server keeps only the **first** 12,000 characters: `transcriptOf(...).slice(0, max)` (`demo.functions.ts:34-35, 52`). The assistant keeps the first 8,000 (`:74`).
  - Clinical server keeps the first 24,000 characters (`clinical.functions.ts:23`) and the first 16,000 for the assistant (`:41`).
  - The user is never warned.
- **How to reproduce:** A demo transcript over 12k characters (three near-5-minute recordings can get there), or a long clinical consultation. The end of the conversation, which is typically where the plan and therapy are discussed, never reaches the model. The report comes back "valid" with an empty or incomplete `terapia`.
- **Fix:** Reject or warn when input exceeds the cap, or keep head and tail with a marker. Make client and server truncate the same way, and return a `truncated: true` flag that the UI shows.

### P2-3 — Regeneration silently overwrites physician edits and verified sections, and re-inserts template text the physician deleted
- **Evidence:**
  - The Generate button calls `makeReport` without any confirmation (`index.tsx:89`).
  - `makeReport` replaces all four sections, including verified ones and text added with "Add for review" (`:70`).
  - On the clinical path each section is persisted immediately (`:70`), so there is nothing to undo.
  - Any edit typed while generation is in flight is overwritten when the result arrives.
  - In the demo, `reapplyExpansions` re-appends every recorded expansion whose exact text is missing (`voice-phrases.ts:54-58`). It can't tell "the AI didn't produce it" apart from "the physician deleted it".
- **How to reproduce (demo):**
  1. Say "корем нормален", which inserts the normal-abdomen paragraph into Status.
  2. The physician deletes that paragraph by hand because the abdomen is actually tender.
  3. Click Generate. "Коремът е мек и неболезнен…" comes back.

  The section is marked unverified, but normal-findings text the physician explicitly removed has been reintroduced.
- **Fix:**
  - Confirm before regenerating whenever any section is verified or edited.
  - When a physician removes an expansion by hand, drop it from `expansions`. For example, in `editSection`, prune expansions whose `text` no longer appears in that section.
  - Alternatively, only reapply expansions created after the last generation.

### P2-4 — Per-IP demo quotas key on the full IP, and there is no global ceiling
- **Evidence:**
  - `ip = cf-connecting-ip || x-forwarded-for[0] || 'unknown'`, hashed in full (`demo.functions.ts:22-23`).
  - All network-level limits hang off that hash: sessions 20/day (`:39`), 20 requests/minute, and 6× per kind per day (`demo-token.ts:65-66`).
  - Nothing caps total demo spend across all IPs.
- **How to reproduce:** A client with an IPv6 /64, which is common on VPS and residential lines, sends each `startDemo` from a different address. Every address gets fresh session, minute and daily budgets, so total Luna and Soniox spend is unbounded. (On Cloudflare `cf-connecting-ip` can't be spoofed, so header spoofing is not the issue; address rotation is.)
- **Fix:**
  - Bucket IPv6 by /64 (or /56) before hashing.
  - Add a global daily bucket, e.g. `global:day:<kind>`, reserved in `reserveQuota`.
  - Optionally add a Turnstile challenge to `startDemo`.

### P3-1 — Undo can get permanently stuck, and the provenance list can disagree with the section text
- **Evidence:** When `removeExpansion` returns `null`, `undoExpansion` shows an error but leaves the entry in place (`index.tsx:64`). Every later Undo targets that same entry, so earlier insertions can never be undone with the button.
- **How to reproduce without any user edit:**
  1. Say the cue twice. Status now contains two copies, and `expansions` has 2 entries.
  2. Click Generate. `reapplyExpansions` deduplicates with `includes` (`voice-phrases.ts:56`), so Status has 1 copy but there are still 2 entries.
  3. Undo succeeds once. The second Undo shows "edited, cannot undo", and the button stays stuck.

  Meanwhile the provenance list (`index.tsx:89`) still shows two template insertions that are no longer in the text.
- **Fix:** When the text is missing, remove the stale entry (or mark it orphaned) instead of returning early. In `reapplyExpansions`, count occurrences per text rather than using `includes`.

### P3-2 — In dictation mode, each recorded utterance clears whatever the physician is typing
- **Evidence:** `flushTranscript` passes `speakerId = undefined` for dictation (`index.tsx:55`). `addSegment` then runs `if(!speakerId) setManual('')` (`:62`). That line was meant to clear the box after a typed entry.
- **How to reproduce:** Start a dictation recording, type into "Добавете реплика…", pause speaking long enough to trigger an endpoint. The typed draft disappears.
- **Fix:** Clear `manual` only for typed submissions. Pass an explicit flag, or clear it at the call sites on `:88`.

### P3-3 — Quota is consumed even when the action fails or was already refused
- **Evidence:**
  - `reserveQuota` increments the IP minute and IP daily buckets before checking the session bucket (`demo-token.ts:65-67`). An exhausted session that keeps clicking burns the whole network's daily budget, which matters for clinics behind shared NAT.
  - Recording quota is reserved before the Soniox temporary-key fetch (`demo.functions.ts:88-90`), and report quota before the model call (`:48`). Provider failures, `finishReason==='length'`, and invalid JSON are never refunded.
- **Fix:** Check the session bucket first, or use a read-then-commit pattern. Add a compensating decrement RPC for provider failures. (Charging on failure may be an acceptable choice for the demo; if so, write it down.)

### P3-4 — `has_role` lets any signed-in user check whether any user ID is an admin
- **Evidence:** `has_role(_user_id uuid, _role)` is `SECURITY DEFINER` and executable by `authenticated` with any `_user_id` (`0000…sql:5-6`, `0002…sql:2`).
- **Impact:** Low, since it requires knowing the UUID.
- **Fix:** Add a wrapper that only checks `auth.uid()`, and grant `has_role` to `service_role` only. The RLS policy and `requireAdmin` can use the wrapper.

### P3-5 — Clinical audit fields are writable by the client (clinical path only)
- **Evidence:**
  - `consent_at` and `consent_notice_version` can be updated at any time under the "own consultations" `FOR ALL` policy (`0000…sql:15`).
  - `verified_at` is a timestamp the client sets (`index.tsx:57,60`).
  - Transcript segments can be updated or deleted with no history.
- **Consequence:** The consent check in `getSonioxKey` (`clinical.functions.ts:56`) can be satisfied by back-dating. Verification and provenance can't be audited.
- **Fix (before any real use):** Set consent and `verified_at` server-side with `now()` in an RPC, deny `UPDATE` on those columns, and add append-only audit tables.

---

## Probable concerns (not fully confirmed)

1. **Pause doesn't stop the Soniox session clock.** The client's 5-minute auto-finish counts only active ticks (`index.tsx:53`; the pause button at `:88` calls `tickStop`). `max_session_duration_seconds: 300` (`demo.functions.ts:89`) is most likely wall-clock time on Soniox's side. If so, pausing for a while and then recording leads to a server-side cutoff before the client finishes: the `error` path fires, non-final tokens are lost, and `segsLost` is shown. Confirm against the Soniox docs. Fix by tracking wall-clock time since `connected`, or disabling pause in the demo.
2. **Clinical segment order isn't guaranteed.** Each flushed utterance runs `getUser()` and then `insert` concurrently (`index.tsx:52-55, 62`). Reports order by `created_at` (`clinical.functions.ts:19`), so adjacent utterances can be stored out of order. Fix by serializing inserts through a queue (as `persistSection` already does) or adding a client sequence number and ordering by it.
3. **Provider and internal error text may reach the browser.** `await result.text` (`demo.functions.ts:54,77`) and a missing-env exception thrown inside the `supabaseAdmin` proxy (`client.server.ts:41-43`) are re-thrown unchanged. TanStack server functions serialize the error message, and `localizeError` passes Latin-script messages through verbatim (`i18n.ts:120`). No secrets are involved, but gateway or env-variable details could leak. Fix by wrapping handler bodies and mapping to the curated messages.
4. **The demo assistant works as a general-purpose LLM proxy within quota.** Client-supplied `history` can impersonate `assistant` turns, and `specialty`/`instructions` are concatenated into the system prompt (`demo.functions.ts:51, 66, 75`). Output is bounded by caps and quotas, so this is mostly misuse, not cost.
5. **The origin check is not an abuse control.** `isAllowedOrigin` (`demo-token.ts:49-59`) plus `createCsrfMiddleware` (`start.ts:25`) correctly block cross-site browser calls. Non-browser clients can set `Origin` freely, so all abuse protection rests on quotas (see P2-4). This is expected, but the docs present it as "защита".
6. **Rapid double Enter in clinical manual entry inserts duplicate segments.** There's no `sourceKey` dedupe for typed text, and the input clears only after the awaited insert (`index.tsx:62, 88`).

## Documented limitations (not counted as bugs)
- Browser-memory demo state
- Soniox US region
- No automatic audio retention policy
- The `consultation-audio` bucket is referenced by policies but not created in migrations; there is no upload path
- Speaker IDs are not roles
- The "Try phrase" button adds a doctor line
- Voice-phrase triggers depend on the UI language

---

## Meaningful test gaps
- **Demo server handlers:** nothing tests `demo.functions.ts` itself — guard order, quota before provider, the `finishReason` path, schema caps, or the IP derivation. The tests cover only the pure helpers with an in-memory counter.
- **SQL:** no tests run `demo_consume` window rollover or concurrency, and none check the `REVOKE`/`GRANT` results. QA-RESULTS row 29 marks direct execution "not tested". RLS isolation was checked by hand in rolled-back transactions only, with no repeatable pgTAP or SQL test.
- **Clinical and admin server functions:** no tests for the auth middleware, `ownSession`, the consent gate, the rate limit, or `setAdminRole` self-demotion.
- **`index.tsx` lifecycle and race paths (none have component tests):**
  - sign-out during recording (P2-1)
  - regenerate over edits and verified sections (P2-3)
  - Undo after deduplication (P3-1)
  - dictation clearing manual input (P3-2)
  - auto-finish under pause
  - the `demoGen` stale guards
- **Truncation:** no test for oversized transcripts (P2-2).
- **Hardware microphone:** never tested (acknowledged in QA).

## What works well
- The demo token is sound: HMAC-SHA256 with a purpose-derived key, verification through `crypto.subtle.verify`, a length cap, strict 2-part format, expiry and version checks, and a random `sid`. Tests cover tampering, a foreign key and expiry.
- Quota is reserved server-side before any provider call. Counters are atomic `INSERT … ON CONFLICT`. Only hashed identifiers are stored. The function and table are revoked from `anon`/`authenticated` and granted only to `service_role`.
- Demo functions never touch clinical tables. Soniox keys are single-use and expire in 60 s; the long-lived key never reaches the browser.
- RLS is owner-scoped and double-checked against the parent consultation. `WITH CHECK` blocks `clinician_id` spoofing. `user_roles` has no write policy, so users can't promote themselves. Function grants were tightened in 0002.
- Per-section save queues prevent out-of-order overwrites, and verification resets on every edit.
- `demoGen` stale guards correctly drop late recorder, report and assistant results after End demo.
- Cue segments are excluded from AI input. Expansion is idempotent per `sourceKey`. The report merge uses the latest state. `ReactMarkdown` renders without raw HTML.
- Copy and print in the demo carry the "DEMO — fictional data" header.

## Verdict for the synthetic demo
The demo-specific paths (token, quotas, memory-only data, provider isolation) are well built, and I found **no P0 or P1 inside the demo flow itself**.

The **one P1 is that the published host also exposes self-service signup into the clinical workspace**, which skips every demo quota and invites real patient data into code that hasn't been validated for it. Close or role-gate that path before calling the public deployment safe.

After that, fix in this order:
1. The microphone-after-sign-out lifecycle bug (P2-1)
2. Silent transcript truncation (P2-2)
3. Regeneration overwrite and resurrection (P2-3)
4. IPv6 and global quota hardening (P2-4)

The P3 items are worth fixing but don't block a synthetic-data demo.
