# Claude Code — intermediate fix checkpoint

Reviewed source: Lovable revision 8783ca657efb63d53cd2c04f33d8fbe631a76484. Session: 8f97ee39-37c4-4006-9273-d8aa73856b24. Actual CLI metadata: claude-opus-5-5. Read-only tools: Read, Glob, Grep. No tests/browser/SQL were executed by Claude. The findings below were sent to Lovable and addressed in subsequent revisions; see FIXES.md for final status and verification limits.
I found 2 bugs that the source code confirms and 3 that depend on timing between concurrent requests. All of them are in the current working tree. None of them is already in `reviews/2026-10-05`.

I only read the current files. There was no shell tool here, so I couldn't run `git diff` against HEAD. I didn't re-run tests or build, and nothing was reproduced in a browser or against a database.

```json
{
  "scope": "current working tree, read-only (files read directly; git diff and tests not run)",
  "source_confirmed_bugs": [
    {
      "id": "C1",
      "severity": "P2",
      "location": "src/routes/index.tsx:79 (for(const k of m.replaced) await persistSection(...)); persistSection rethrows at :66",
      "defect": "The sequential save loop stops at the first failed section. The sections after it are already applied to local state (changeSession, just before the loop) but are never saved.",
      "trigger": "Clinical makeReport replaces 2-4 sections and the upsert or getUser for an early section fails (network error or token refresh). Later sections stay only in memory and are lost on reload.",
      "secondary": "The catch calls setError(err(e,t.genFail)). This overwrites the specific save error that persistSection already showed, and the draftReady notice is never set. The user is told generation failed while the generated draft is visible and only partly saved."
    },
    {
      "id": "C2",
      "severity": "P1 (wrong data in the database), but depends on timing",
      "location": "src/routes/index.tsx:79 (persists m.session.sections[k].content, a snapshot taken before the loop); edit/verify are still enabled while busy (:100: Textarea onChange/onBlur and the Verify button have no disabled)",
      "defect": "The loop saves the snapshot taken when the merge ran, not the latest state. A physician edit or verify made while an earlier section is saving is saved first. The loop then overwrites it with the stale generated content and verified_at=null.",
      "trigger": "During the loop (one getUser plus one upsert per section, run one after another): edit section k3 and blur it (commitSection at :68 queues the save immediately) or click Verify (:69) before the loop reaches k3. Both saves go through the same per-key queue, and the loop's save comes later and wins.",
      "result": "UI shows the edited or verified text and save='saved'. The database holds the generated text, unverified; the trigger at 0005:131-133 clears verified_at. The edit is lost on reload.",
      "note": "The code path is certain. It only needs normal user actions during a multi-roundtrip window, so I'm counting it as source-confirmed, not a hypothesis."
    }
  ],
  "concurrency_hypotheses": [
    {
      "id": "H1",
      "severity": "P1 if it happens (patient data leak)",
      "location": "src/routes/index.tsx:52-54 (loadCloud has no generation or abort guard); reset at :43; demo entry at :86",
      "defect": "A loadCloud that is still running after SIGNED_OUT writes setSessions(mapped), setSelected, setRole(admin), setInstructions and setLanguage, undoing the reset at :43. demoGen is not checked here, so enterDemo's demoGen+=1 does not cancel it.",
      "trigger": "A signed-in clinician signs out while loadCloud is still running, then enters the demo, and loadCloud finishes after enterDemo's setSessions(demoSessionsFor). Real patient sessions then appear with demo=true. setSelected moves to a real session, and makeReport/sendQuestion would send real transcripts through demoReport/demoAssistant. Variant: sign out and sign in as user B before A's loadCloud finishes, and A's data can replace B's.",
      "why_hypothesis": "It needs loadCloud's 7 parallel queries to take longer than sign-out, ticking the checkbox and the startDemo round trip."
    },
    {
      "id": "H2",
      "severity": "P2 (one unmetered provider call plus a wrong quota shown)",
      "location": "drizzle/migrations/0005_clinical_access_quota_audit.sql:60-62 together with :64-65, :69-72, :74-78",
      "defect": "Request A's cleanup can delete request B's stale bucket X while B is reserving X. B's PERFORM ... FOR UPDATE (:65) waits for A. After A commits, the READ COMMITTED re-check skips the deleted row, so B locks nothing. B's SELECT INTO r (:69) finds no row and returns NULLs. Then cur=NULL, `cur+1 > limit` is NULL, so no rejection; rem[i]=NULL; the UPDATE (:75-78) changes 0 rows; the function returns ok:true with remaining=[null,...].",
      "trigger": "Bucket X has window_start older than 2 days (for example a returning IP's ip:<hash>:day:<kind>). A's subquery locks X before B's INSERT ON CONFLICT DO NOTHING (:64); B finds the row still live and does nothing, then blocks at :65.",
      "result": "That bucket isn't charged. reserveQuota returns r.remaining[0] (demo-token.ts:89), which can be null; the client's Math.max(0,null)=0 then shows the quota as used up.",
      "fix_hint": "In the loop: INSERT ... ON CONFLICT DO UPDATE SET bucket=EXCLUDED.bucket RETURNING to always lock the row, or redo the insert when FOR UPDATE finds no row, or raise if r is NULL."
    },
    {
      "id": "H3",
      "severity": "P3 (request fails with the 'limit cannot be checked' error)",
      "location": "0005 SQL:60-62 (cleanup locks are held to transaction end) and :63-66 (locks taken in sorted order)",
      "defect": "Deadlock. A's cleanup holds a lock on stale ip:<B>:day:<kind> (not one of A's buckets), then waits for global:day:<kind>, which B holds. B already holds global:day:<kind> (it sorts before ip:...) and waits for ip:<B>:day:<kind>, which A is deleting. Postgres returns 40P01 for one of them. The sorted lock order doesn't prevent this because the cleanup locks fall outside that order.",
      "trigger": "Two demo_reserve calls of the same kind running at once while one visitor's ip bucket is stale (older than 2 days).",
      "note": "No active counter is ever deleted wrongly: every window is at most 86400s, less than the 2-day cleanup age."
    }
  ],
  "checked_no_defect": [
    "makeReport demoGen guard (:79): checked after demoReport and generateReport; after sign-out, `latest` is undefined so it returns; finally only clears busy for the current generation.",
    "sendQuestion (:80): demo branch checks the generation after demoAssistant. The clinical branch has no generation check, but after sign-out getUser() returns null and it throws; after End demo/Enter demo the error is suppressed by the generation check. Results are written to the captured sessionId, so switching sessions is safe.",
    "SIGNED_OUT (:43) calls teardownRef, which bumps lifecycle.gen (recording-lifecycle.ts:24), so startRecording's stale() covers it. Not bumping demoGen causes no observed defect apart from H1, where the real gap is loadCloud's missing guard.",
    "demo_consume (:89-97): a concurrent delete of its own bucket is impossible (bucket <> _bucket), and ON CONFLICT DO UPDATE retries correctly when the conflicting row is deleted."
  ],
  "minor_unverified": "SIGNED_OUT does not flush or clear saveTimers (:39, :67). An edit made under 700ms before an external sign-out fails its save. Clicking logout blurs the textarea first (commitSection), which mostly hides this. Low priority."
}
```



