# Branding and published checks — 2026-10-05

Lovable revision: `ca270d421427b423447d444ed760be449ffab769`; public URL: https://lekari-ai-bulgaria.lovable.app/.

The built-in image generation tool created the square document/sound-wave logo and matching sharing card. A targeted edit corrected an unwanted dark defect in the first logo. Final artwork was visually inspected, then resized for delivery; see [exact prompts](BRANDING-PROMPTS.md). Lovable used those exact delivered PNGs, verified independently by matching SHA-256 hashes after downloading from the live deployment.

## Changes

- Enabled the native Project settings > Publishing > Hide Lovable badge switch. No CSS/JS badge hiding code was added.
- Logo on demo welcome, physician login and app sidebar. Favicon ICO includes 16/32/48/64 sizes, PNG favicon is 32px, Apple icon 180px; versioned icon URLs.
- Shared server-rendered metadata, canonical URL and absolute OG/Twitter image URL. Card is 1200x628 and explicitly says Medical Scribe Demo / Fictional data only.
- Clinical/demo/AI/recording/document logic unchanged in the reviewed source diff.

## Independent checks performed after publication

- Public HTML request without JavaScript: HTTP 200; one consistent title and OG/Twitter metadata; og:image and twitter:image point to `/og-lekar-ai-v2-20261005.png`; width/height 1200/628; canonical present; no Lovable author or @Lovable metadata. Badge absent from raw HTML and live DOM.
- All five published assets return HTTP 200 with image content types and decode successfully. Dimensions verified locally with Pillow; favicon ICO has all four sizes.
- Chrome live: welcome logo loads at naturalWidth 512. Physician login logo loads at 512. Entered a synthetic demo session; sidebar logo loads at 512 and renders at 28px. No live microphone or AI requests needed for this appearance check.
- Local TypeScript `node node_modules/typescript/bin/tsc --noEmit`: exit 0. Local production build: exit 0, repeated after exporting binary assets so they are included in output. Existing deprecation/bundle-size build warnings remain.
- Source export diff reviewed; no credentials or environment values added. Assets copied from live deployment; routeTree generator's whitespace-only change reverted.

## Limits

Actual Viber-app preview and its cache were not directly tested. The site's unauthenticated server response and sharing image are configured and verified; older already-sent messages may retain a previously cached preview. A fresh share URL with `?v=20261005` can be used when testing the updated preview.

Lovable's own pre-publication checks remain separately recorded in `BRANDING-QA.md`. This check did not rerun clinical or audio workflows because the change is limited to branding.
