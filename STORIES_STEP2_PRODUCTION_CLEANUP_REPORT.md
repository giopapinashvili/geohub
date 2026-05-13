# GeoHub — Stories Step 2 Production Cleanup

## Scope
This pass focuses only on Stories, so the previous Messenger Step 1 changes remain intact.

## Fixed
- Rebuilt `geohub-social-redesign.js` stories renderer into one grouped system.
- Feed stories now group multiple stories by author/user instead of rendering many duplicate cards.
- Clicking a story opens one Facebook/Instagram-style overlay viewer.
- Viewer supports:
  - next / previous buttons
  - left/right keyboard navigation
  - Escape to close
  - click outside to close
  - mobile full-screen layout
  - caption overlay for image stories
  - text-only stories
- Removed the old single-story modal flow from `geohub-social-redesign.js` by replacing `openStoryViewer` with the new overlay logic.
- Added production CSS for story cards, author avatars, story counts, overlay, progress indicators and mobile safe layout.
- Improved `stories.html` so it shows real Firestore stories in a clickable grid instead of only plain cards.
- Removed the visible `Coming soon` badge from `stories.html` filters and replaced it with a real link to create stories from Feed.

## Verified by code check
- `geohub-social-redesign.js` syntax check passed.
- `firestore-social.js` syntax check passed.
- `stories.html` inline module syntax check passed.

## Notes
- Old `geohub-fixes.js` story code still exists in the project, but it is not attached to the main Feed page in this ZIP. The active Feed story system is now inside `geohub-social-redesign.js`.
- Live Firebase testing is still required after deployment to confirm Firestore data and user auth behavior.
