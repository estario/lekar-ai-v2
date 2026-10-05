# Addendum: reconciliation with Codex (still read-only)

I accept Codex's run results as reported: 30/30 Vitest, `tsc --noEmit` clean, `bun run build` OK on `5987902` / Lovable `afa0d07`. I didn't execute anything myself.

One reference mismatch: in my checkout, `withoutCueSegments` is at **`src/lib/voice-phrases.ts:69-72`**, not 72-75. Every other line Codex cited matches my copy.

## Item-by-item

**1. Signup leads to unrestricted clinical endpoints: agreed, with the qualification.**
- **Confirmed in code:**
  - The UI offers `signUp` and Google OAuth (`index.tsx:25-26`), linked from the landing page (`:31`).
  - Clinical functions only use `requireSupabaseAuth` (`clinical.functions.ts:15,36,52`), plus 8 requests per minute (`0001…sql:4`).
  - The `clinician` role in the `app_role` enum (`0000…sql:1`) is never checked.
- **Depends on deployment:** whether a stranger can actually create an account depends on the live Cloud auth settings (SETUP.md:7 says it's enabled, but neither of us has checked). I'm not claiming any abuse run or measured spend.
- Stays **P1**, labelled "code-level bypass; exploitability depends on auth settings."

**2. Undo puts the command back into AI input: new, confirmed, P2.**
- `undoExpansion` removes the entry (`index.tsx:64`).
- `withoutCueSegments` builds the exclusion set only from `expansions[].segmentId` (`voice-phrases.ts:69-72`).
- So after Undo, the cue segment "корем нормален" goes to `demoReport` on the next Generate as a doctor statement (`index.tsx:70`).
- This is a real command-versus-evidence defect. The physician rejected the template, but the trigger utterance, which itself asserts a normal finding, now reaches the model as clinical speech. I'm not predicting what the model will output.
- **Fix:** record "this segment was a command" on the segment itself (e.g. `seg.kind='command'`, set in `addSegment` at `:62` when there's a hit), independent of whether the expansion still exists. Or ask on Undo whether the utterance should count as evidence.
- `sendQuestion` (`index.tsx:71`) sends raw `selectedSession.segments` with no cue filtering, no sections and no provenance. The assistant sees command phrases as doctor speech. **P3**, because the output is advisory, but "Add for review" (`:92`) can carry it into a section.

**3. `lastIndexOf` can make Undo delete the wrong text: confirmed, P3, and it contradicts the stated behavior.**
- `removeExpansion` (`voice-phrases.ts:44-51`) searches for content, not identity.
- If the user edits the inserted paragraph ("…tender…") and pastes the original paragraph again later in the same section, Undo deletes the user's later copy, keeps the edited insertion, and shows `vpUndone`.
- That contradicts `vpUndoMissing` ("edited, cannot be undone", `i18n.ts:46/86`), which promises refusal once the insertion has been edited.
- **Fix:** store the insertion's `{section, start, end, revision}` and keep a per-section revision counter that `editSection` increments, adjusting stored ranges from the edit diff. Undo should only run if the range still contains exactly `text` and hasn't been touched since insertion; otherwise refuse. Pruning based on `includes` alone isn't enough.
- This is separate from #5.

**4. P2-3 (regeneration overwrite and resurrection): agreed, confirmed.**
- `editSection` (`index.tsx:58`) never prunes expansions, so `reapplyExpansions` (`voice-phrases.ts:54-58`) re-inserts the preset the physician corrected or deleted.
- The latest-state merge (`index.tsx:70`) protects only `expansions`. Section content typed while the request is in flight is replaced by `merged[k]`. On the clinical path it's also persisted per key.
- Resetting verification on regenerate is fine. What's missing is a version guard (e.g. a per-section edit counter captured at request start and compared on merge) and an overwrite confirmation.

**5. P3-1 (repeated cue, dedup, Undo stuck): agreed, unchanged and distinct from #3.**

**6. Quota hardening: partly agreed, and I'm correcting my first report.**
- **Disagreement with myself:** I wrote that `cf-connecting-ip` "can't be spoofed on Cloudflare." That was an assumption. The `vite.config.ts` comment only says nitro builds for Cloudflare by default; the actual ingress is unverified. Header spoofing (`demo.functions.ts:22`) is therefore **deployment-conditional**, not confirmed.
- Full-IP IPv6 bucketing and the missing global ceiling are **code-confirmed cost-hardening gaps**, not a demonstrated incident. I'm keeping them at **P2 (hardening)**. That's a mild disagreement: a public, billable endpoint with no global cap deserves P2 even without an incident.
- **Withdrawn:** my P3-3 suggestions to refund on provider failure or to use read-then-commit. Charging for an attempted billable call is legitimate.
- **Still confirmed:** the ordering issue (`demo-token.ts:65-68`). IP-minute and IP-daily buckets are incremented before the session check, so an exhausted session drains the shared-NAT daily budget. **Fix:** a single SQL function that checks all buckets and then increments all of them in one transaction (all or nothing), or check the session bucket first. Not a client-side read-then-commit.

**7. Recording lifecycle, ordering and history: agreed.**
- **Mic after `SIGNED_OUT`** (`index.tsx:40`; the cleanup at `:42` never runs because the component stays mounted at `:81`): confirmed in source, not reproduced in hardware or browser. Stays **P2**.
- **Segment ordering:** I'm promoting this from "probable" to **confirmed, depends on scheduling**.
  - Each `addSegment` awaits `getUser()` and then `insert` concurrently (`index.tsx:52-55,62`).
  - `created_at` reflects completion order, and both the server report query (`clinical.functions.ts:19`) and local state append in that order.
  - `seconds` is captured correctly but never used for ordering.
  - **Fix:** serialize inserts per consultation, or add a client sequence column and order by it. **P3.**
- **`askAssistant` history** (`clinical.functions.ts:42`): `ascending:true` plus `limit(30)` deterministically selects the *earliest* 30 messages, so recent context disappears after about 15 exchanges. **Fix:** order descending, limit 30, then reverse. **P3.**

## Final priorities

| P | Finding | Status |
|---|---|---|
| P1 | Public signup/OAuth reaches clinical AI and Soniox (8/min, no daily cap, 3600 s keys, no role check) | Confirmed in code; exploitability depends on live auth settings |
| P2 | Mic and recorder stay live after `SIGNED_OUT` (`index.tsx:40,42,81`) | Confirmed in source; not reproduced on hardware |
| P2 | Silent transcript truncation; client and server cut opposite ends (`index.tsx:70`, `demo.functions.ts:34,52`, `clinical.functions.ts:23,41`) | Confirmed |
| P2 | Regeneration overwrites in-flight and verified edits; preset resurrected after manual correction (`index.tsx:58,70,89`; `voice-phrases.ts:54-58`) | Confirmed |
| P2 | Undo returns the cue utterance to report input as clinical speech (`index.tsx:64,70`; `voice-phrases.ts:69-72`) | Confirmed (new) |
| P2 (hardening) | Full-IP IPv6 buckets and no global demo ceiling (`demo.functions.ts:22-23`, `demo-token.ts:64-69`) | Confirmed gap; header spoofing depends on ingress |
| P3 | Undo removes a later unrelated copy and reports success (`voice-phrases.ts:44-51`) | Confirmed (new) |
| P3 | Repeated cue + dedup leaves Undo stuck; provenance list doesn't match text (`index.tsx:64`, `voice-phrases.ts:56`) | Confirmed |
| P3 | Assistant receives unfiltered cue segments and no provenance (`index.tsx:71`) | Confirmed |
| P3 | IP buckets consumed before the session check; shared-NAT budget drained (`demo-token.ts:65-68`) | Confirmed |
| P3 | Clinical segment order depends on scheduling (`index.tsx:52-62`) | Confirmed |
| P3 | `askAssistant` uses the earliest 30 messages (`clinical.functions.ts:42`) | Confirmed (new) |
| P3 | Dictation recording clears typed manual input (`index.tsx:55,62`) | Confirmed |
| P3 | `has_role` callable with any user ID; client-writable consent and `verified_at` (`0000…sql:5-6,15`; `0002…sql:2`) | Confirmed; affects the clinical path only |
| — | Provider and internal error text may reach the client; pause vs. Soniox wall clock | Still probable |

## Test gaps
Even with 30/30 passing, none of the tests cover:
- Undo followed by regenerate (cue re-entry)
- the paste-a-duplicate Undo case
- regeneration with edits made in flight
- `SIGNED_OUT` while recording
- the assistant history window
- the clinical role gate

There are still no SQL or RLS tests and no handler-level tests for the demo server functions.

Verdict unchanged: no P0. One P1, which is confirmed in code and whose exploitability depends on the live auth settings.
