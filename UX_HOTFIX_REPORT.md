# GeoHub UX Hotfix Report

## Fixed

1. Header auth state
- Added Firebase `onAuthStateChanged` listener in `geohub-social-redesign.js`.
- Header profile area now updates after Firebase finishes loading the signed-in user.
- This fixes the issue where the user is logged in but the header still displays `Sign in`.

2. Business Follow state
- Added `updateBusinessFollowButton(businessId)`.
- Business detail page now checks `businessFollowers/{businessId}_{uid}`.
- If the user already follows the business, the button displays `Following`.
- Hovering the Following button shows Unfollow behavior.
- Clicking toggles follow/unfollow and refreshes the button state.

3. Sidebar collapse
- Added a new sidebar collapse button in the top header.
- Clicking it hides the left sidebar and expands the main content area.
- This helps business/group/detail pages display wider content.
- Mobile keeps the sidebar hidden as before.

4. CSS polish
- Added collapsed-layout rules.
- Added Follow/Following/Unfollow visual states.
- No existing Firestore/Auth/social functions were removed.

## Changed files
- `geohub-social-redesign.js`
- `geohub-social-redesign.css`
- `UX_HOTFIX_REPORT.md`

## Static checks
- `geohub-social-redesign.js`: syntax PASS
- `firestore-social.js`: syntax PASS
- `add-business.js`: syntax PASS
- Local JS/CSS/image references in HTML: 0 missing

## Manual reminder
After deployment, hard refresh the browser:
- Windows: Ctrl + F5
- Or clear Cloudflare cache if old CSS/JS is still shown.
