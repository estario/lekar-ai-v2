# Scribe workflow research — 2026-10-05

Public product documentation was reviewed; competitor accounts and paid applications were not tested. These are vendor-described capabilities, not independently verified performance or compliance claims.

| Product | Relevant documented workflow | Lekar AI demo adaptation |
|---|---|---|
| [Noteless](https://www.noteless.com/en/specialties/doctors) | Structured consultation notes, personal structure/language/detail settings, consultation-derived referrals and other documents | Workflow/style presets and reviewed-note document drafts. Voice-trigger text expansion from the user's supplied examples already exists. |
| [Heidi](https://support.heidihealth.com/en/articles/8885059-what-is-heidi) | Template-based notes, separate verbatim transcript, dictation, context, downstream documents based on the original note | Preserve transcript/report separation; require source review before creating a secondary document. |
| [Freed](https://www.getfreed.ai/features) | Visit preparation, templates, ambient scribe/dictation and saved phrases, plain-language patient instructions, clinical letters, EHR push | Fictional prior-context cards, patient summary and referral draft, clearly labelled copy/print export. |
| [Nabla](https://help.nabla.com/en/articles/781954) | Ambient conversation structuring across specialties and languages; synchronized clinical notes across web/mobile/extension | Guided bilingual conversation-to-note flow using existing Soniox recording and Luna report generation. |

## Focused implementation requested in Lovable

Three synthetic scenarios that create new in-memory consultations; server-validated report workflow/style presets; patient-summary, referral and SOAP drafts from reviewed report sections; source-change staleness, editable draft review and DEMO-watermarked copy/print. Document generation shares the existing assistant budget.

Keep the guest demo fictional and memory-only, existing role-gated clinical access separate, Luna unchanged, and BG/EN interface/default locale behavior. Do not add actual EHR integration, real patient file uploads, billing codes, automated diagnosis, or claims of medical-device certification/compliance.

Implemented through Lovable and published at https://lekari-ai-bulgaria.lovable.app/. Verification status and known AI limitations are recorded separately in SCRIBE-DEMO.md and the historical Lovable-run SCRIBE-DEMO-QA.md.
