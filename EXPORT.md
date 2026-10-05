# Lekar AI v2 — source export

Exported on 2026-10-05 from Lovable project `8edcb921-cddd-47da-b742-f78009807ab8` at revision `d05e07bd1c03054022ef4dd2739c1aa61ee0c95c`, after the scribe demo extension and follow-up fixes. The source-review fixes were at `90600e7e83d0e9b4d7ec6ce4ab30a7d8287cdd3f`; the original review refers to baseline `afa0d07b4cf87448283ace53a2886d26f9458cff`.

Live synthetic demo: https://lekari-ai-bulgaria.lovable.app/
Editor: https://lovable.dev/projects/8edcb921-cddd-47da-b742-f78009807ab8

This is a versioned source snapshot, not an automatic two-way GitHub connection. App source, migrations, tests, and lockfile are copied from the pinned Lovable revision. The environment file is excluded; `.env.example` lists names without values. The exported `.gitignore` additionally excludes environment files. No original lekar-ai repository history or patient data is included.

Export-specific exception: Lovable pinned `@lovable.dev/vite-tanstack-config` to 2.25.2 without updating its committed lockfile. `bun.lock` was reconciled locally with Bun 1.4.2 (`bun install --lockfile-only --ignore-scripts`), then a frozen install and all checks succeeded. The exported README and review notes document the actual published snapshot and verification separately from Lovable's historical QA claims.

The app uses Soniox US and `openai/gpt-6-luna` through Lovable AI. Use only fictional data in the public demo. Credentials and Cloud provisioning must be configured separately; this source export does not transfer them.
