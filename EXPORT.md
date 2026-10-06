# Lekar AI v2 — source export

Exported on 2026-10-06 from Lovable project `8edcb921-cddd-47da-b742-f78009807ab8` at revision `07469bbe3bc4452dc1f7388ef1119cd7f53b2fba`, after a copy-only update removing the USA/САЩ qualifier from ten visible Soniox mentions in BG/EN. Type checking and the Lovable production build passed. The branding update was at `ca270d421427b423447d444ed760be449ffab769`. The scribe demo extension and follow-up fixes were at `d05e07bd1c03054022ef4dd2739c1aa61ee0c95c`. The source-review fixes were at `90600e7e83d0e9b4d7ec6ce4ab30a7d8287cdd3f`; the original review refers to baseline `afa0d07b4cf87448283ace53a2886d26f9458cff`.

Live synthetic demo: https://lekari-ai-bulgaria.lovable.app/
Editor: https://lovable.dev/projects/8edcb921-cddd-47da-b742-f78009807ab8

This is a versioned source snapshot, not an automatic two-way GitHub connection. App source, migrations, tests, and lockfile are copied from the pinned Lovable revision. The environment file is excluded; `.env.example` lists names without values. The exported `.gitignore` additionally excludes environment files. No original lekar-ai repository history or patient data is included.

On 2026-10-06 this GitHub snapshot was prepared for public release under the MIT License. The root LICENSE, THIRD_PARTY_NOTICES.md, preserved shadcn/ui license, package license metadata and public-repository README wording are export-specific additions. They do not change the pinned application's behavior or provision Lovable Cloud credentials.

Export-specific exception: Lovable pinned `@lovable.dev/vite-tanstack-config` to 2.25.2 without updating its committed lockfile. `bun.lock` was reconciled locally with Bun 1.4.2 (`bun install --lockfile-only --ignore-scripts`), then a frozen install and all checks succeeded. The exported README and review notes document the actual published snapshot and verification separately from Lovable's historical QA claims.

The app uses Soniox US and `openai/gpt-6-luna` through Lovable AI. Use only fictional data in the public demo. Credentials and Cloud provisioning must be configured separately; this source export does not transfer them.

Branding assets were downloaded from the published URL after deployment and verified as image files. Logo and social-card SHA-256 hashes match the generated/resized originals supplied to Lovable. The native Hide Lovable badge setting is enabled in Lovable; it is a platform setting, not a source-code patch. See reviews/2026-10-05/BRANDING.md for independent checks and BRANDING-PROMPTS.md for artwork provenance.
