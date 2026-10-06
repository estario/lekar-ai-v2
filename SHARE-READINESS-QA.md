# Share-readiness QA — 2026-10-06 (18:55 Sofia), base 0444dc1a

## Changes
1. `demoAssistant` (src/lib/demo.functions.ts): added `ASSISTANT_EVIDENCE_RULES` to the **system instructions**, intended to take precedence over history and user messages (not a guarantee against overrides): clinician questions are not findings; partial answers deny only explicitly named items; "white sputum" does not establish absence of blood; unstated age/sex/diagnosis/exam/tests/therapy stay unknown with neutral wording; summaries list documented facts and separately what is undocumented; no new medical advice. Demo-only suggestions, manual insertion and review are unchanged.
2. Landing limits line (BG/EN `landing3` in src/lib/i18n.ts) is now generated from the shared `DEMO_QUOTAS` config (src/lib/demo-token.ts), and is marked "temporarily raised". The in-workspace counter starts from the same values (they are then replaced by the server's `startDemo` response, which also uses `DEMO_QUOTAS`). The 5-minute recording cap and all demo/provider notices are unchanged. Limits were **not** reduced.
3. Seeded BG demo history (src/lib/clinical.ts): "Отрича задух и гръдна болка." → "Отрича задух." Seeded EN report (src/lib/i18n.ts): "Denies shortness of breath and chest pain." → "Denies shortness of breath." Both are prewritten fixtures; the patient transcript and the separate cough-follow-up ambiguity were left intact.
4. Not changed: model (openai/gpt-6-luna), provider, auth, storage, branding, speaker colors, auto-report on stop.

## Live Luna check (actually run, 4 calls)
Run as a server-side script: same Luna helper, same system prompt and rules, same transcript builder and cap as the app. **Not** sent through the public page or demo quota.
Case: built-in cough follow-up. Question (EN): "Summarize only the documented facts from this fictional consultation in three bullets. Identify important information that was not documented; do not give new medical advice." I wrote the BG question as an equivalent translation.

| Case language / answer language | Blood in sputum | Other observations |
|---|---|---|
| BG / BG | "наличие или липса на кръв в тях не е документирано" — PASS | Only dyspnea and chest pain denied; age/sex marked undocumented |
| EN / BG | Listed under "Недокументирано: има ли кръв в храчките" — PASS | "no crackles" is in the EN transcript (supported) |
| BG / EN | "whether it contained blood was not documented" — PASS | — |
| EN / EN | "whether it contained blood was not documented" — PASS | Denied only SOB and pain |

I read all four answers in full. None invented a denial, age, sex or diagnosis, and none gave new advice. These are 4 samples only, so this does not guarantee the model will never invent facts. I did not test override attempts sent through conversation history.

## Automated checks
- vitest: 56/56 passed
- tsgo: no errors
- `bun run build`: exit 0

## Not done
- No browser check of the landing text or of the assistant through the UI
- Not published
