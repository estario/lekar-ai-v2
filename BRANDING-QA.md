# Branding QA — Lekar AI v2 (2026-10-05)

## Assets (copied/resized from user-supplied PNGs, no new artwork)
| Path | Size | Source |
|---|---|---|
| public/lekar-ai-logo-20261005.png | 512x512 | square logo, exact copy |
| public/og-lekar-ai-v2-20261005.png | 1200x628 | social card, exact copy |
| public/favicon.ico | 16/32/48/64 | resized logo (ImageMagick) |
| public/favicon-32.png | 32x32 | resized logo |
| public/apple-touch-icon.png | 180x180 | resized logo |

## Code changes
- Shared `src/lib/brand-meta.ts` used by root and `/` head (same values, so no conflicting override; `/` no longer sets `twitter:card=summary`). Removed `author: Lovable` and `twitter:site @Lovable`.
- Canonical `https://lekari-ai-bulgaria.lovable.app/` on `/` only. Versioned icon links in root.
- Logo replaces the FileText brand tile on the demo welcome and physician login screens and sits beside the sidebar wordmark. FileText action icons unchanged. No badge-hiding CSS/JS.

## Executed checks
- `curl` of SSR HTML at localhost:8080/ (no client JS): exactly one `<title>Lekar AI — Demo</title>`; one each of description, og:site_name/type/url/title/description/image/image:secure_url/image:type/width 1200/height 628/image:alt, twitter:card summary_large_image/title/description/image/image:alt; canonical present; 0 matches of `author` / `@Lovable`.
- Static files return HTTP 200 with image content types: both PNGs, favicon-32 and apple-touch (`image/png`), favicon.ico (`image/x-icon`).
- Playwright: demo welcome renders the logo (naturalWidth 512, alt "Lekar AI").
- `tsgo --noEmit` exit 0; `npm run build` exit 0.

## Not tested
- Login screen and sidebar logo checked only by reading the code, not with screenshots.
- Live published URL, Viber app, and other link-preview debuggers were not tested, because the app is not published yet.
