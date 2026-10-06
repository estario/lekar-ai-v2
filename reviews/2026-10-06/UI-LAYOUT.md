# Independent workspace layout verification

Date: 2026-10-06. Lovable source: `2f476a1efc6cf0ee337c7faf0cadf4dac49794e3`.

The previous fixed-height shell and nested report scroll area squeezed the conversation to 40px at the original 1037×649 browser viewport. Large inline sample cases further consumed the workspace height.

The fix removes the fixed-height main shell, keeps the desktop sidebar sticky, gives the conversation a 320px minimum with a bounded long-transcript scroll area, and lets report cards/documents flow vertically. Sample cases now open in a Radix dialog and stay closed on entry. The only non-layout state change is the dialog's initial closed state; server/provider/auth/quota logic was not changed.

## Checks performed independently

- Exported source: TypeScript `tsc --noEmit` passed and all 56 existing tests passed.
- Reviewed source changes: `src/routes/index.tsx`, BG/EN dialog close text in `src/lib/i18n.ts`, QA and roadmap. No new dependency or backend change.
- Latest Cloud preview rejected one new session attempt because the daily network demo-session quota was exhausted. No production limit was changed or bypassed. Additional Cloud report-content checks could not be completed.
- For independent visual verification, rendered the exact exported route/component and styles in an untracked localhost-only Vite fixture. Only auth and server function imports were replaced by test stubs: signed out, local demo start returning fictional quotas, all external operations disabled. This validates UI rendering/interactions, not provider or Cloud functionality.
- Bulgarian initial demo had five conversation lines, four nonempty report sections and nonempty patient instructions. Report textarea heights were 105px, patient instructions 110px.
- At 1366×650: transcript height 403px, page height 1528px, document width 1351px (viewport minus vertical scrollbar), no horizontal overflow. No sample dialog on entry.
- Loaded the cough scenario through the dialog: all three choices present, a fresh session was added, previous work remained, dialog closed. Voice-phrase panel opened with its controls.
- With notice, scenario and voice-phrase panel open: 1024×650 had transcript 403px and document width 1009px; 390×650 had transcript 403px and document width 385px. No horizontal overflow.
- Mobile dialog measured 358×565px at 390×650 and contained all three choices plus the Bulgarian Close button. Closed it and focused patient instructions at the page end; the instructions were visible in the viewport.
- Desktop screenshot saved outside the repository as `ui-layout-after-1366.png` (final screenshot was at the normal 1440×675 viewport). Temporary browser viewport overrides were cleared.
- Lovable editor publication explicitly confirmed “Your website was updated”. The public landing was reloaded afterward.

Lovable's separate browser/build evidence is preserved in root `UI-LAYOUT-QA.md`. Its localhost measurements and claims are distinct from the checks above. No new microphone/provider/clinical workflow test was performed for this layout-only change.
