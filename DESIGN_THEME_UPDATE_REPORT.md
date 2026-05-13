# GeoHub Design + Theme Update Report

## Changed files
- `geohub-social-redesign.css`
- `geohub-social-redesign.js`

## What changed
- Added a new map-first dashboard visual direction inspired by the selected mockup.
- Added a real visible light/dark mode toggle button in the top header.
- Kept existing Firestore/Auth/social functions intact.
- Did not change Firestore collection names or rules.
- Did not replace business/group/post/comment/message logic.

## New visual direction
- Light mode is warm/colored, not plain white.
- Dark mode is deep navy/emerald, not pure black.
- Feed homepage now starts with a `Live Around Georgia` hero map block.
- Added map markers, live activity stats, richer glass cards, softer shadows, rounded UI, and premium GeoHub style.
- Stories section changed to `Stories from Places`.
- Right rail now has `What’s happening`, Premium and quick actions styling.

## Theme switcher
- Added topbar button: `#ghThemeToggle`.
- It toggles `html[data-gh-theme="light"]` and `html[data-gh-theme="dark"]`.
- No browser storage was added.
- Current implementation changes theme during the session and respects browser preferred color scheme on first load.

## QA checks run
- JavaScript syntax check for every top-level `.js` file: PASS.
- `geohub-social-redesign.js`: PASS.
- Existing functionality was not intentionally changed; only shell/top visual layout and CSS theme variables were updated.

## Notes
- If you want the selected theme to persist after refresh, add Firestore-backed `userUiState.theme` or a non-storage cookie approach. Browser browser storage was intentionally not used because this project was cleaned to Firestore-only.
