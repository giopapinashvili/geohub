# GeoHub Step 6 — Responsive / Mobile Polish + Overlay Cleanup

Applied against the Step 4 project baseline available in this workspace.

## Added
- `responsive-polish.css`
- `responsive-polish.js`

## What changed
- Adds one final global responsive layer loaded on every HTML page.
- Prevents horizontal mobile overflow from cards, grids, fixed panels and media.
- Standardizes mobile one-column grid behavior for common page layouts.
- Moves the Messenger bubble above the mobile bottom nav and safe-area.
- Hides the Messenger floating bubble on `messages.html` so it does not cover the full chat page.
- Constrains chat images, message images, emoji pickers and reaction pickers on mobile.
- Normalizes notification panel width/position so it does not escape the screen.
- Normalizes modal/overlay max height and mobile bottom-sheet behavior.
- Adds Escape-to-close and click-outside overlay cleanup for common modal overlays.
- Adds body scroll locking while major overlays are open.
- Adds runtime viewport/page metadata (`body[data-page]`) for safer page-specific UI behavior.

## Verified by static checks
- Every HTML file includes `responsive-polish.css`.
- Every HTML file includes `responsive-polish.js`.
- Referenced local JS/CSS links were scanned for missing files.
- JavaScript syntax was checked with `node --check` for all `.js` files.

## Notes
This is a UI/layout stabilization pass. It does not add new product features. Live Firebase behavior still needs browser testing after deploy.
