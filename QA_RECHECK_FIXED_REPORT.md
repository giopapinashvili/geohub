# GeoHub Recheck + Fix Report

Date: 2026-05-12

## Rechecked
- Direct `browser storage` / `browser session storage` references: PASS, 0 production matches.
- JavaScript syntax check on every `.js` file: PASS.
- HTML script/link/image local references: PASS, 0 missing files.
- Inline `onclick` function references: PASS after fixing `logClick`.
- Firestore collection references in JS vs `firestore.rules`: PASS for detected active collections.

## Problems found during recheck and fixed
1. `firestore.rules` had combined read/create/update/delete rules for `userUiState` and top-level `messages` that referenced `request.resource` inside read/delete paths. This can deny reads at runtime. Rules are now split by operation.
2. `add-business.html` contact fields had no IDs, so phone, WhatsApp, email, website, address, Instagram, Facebook, starting price, and price range were not saved correctly. IDs were added.
3. `add-business.js` now stores WhatsApp, Instagram, Facebook/socialLinks, startingPrice, and priceRange into the business Firestore document.
4. `geohub-social-redesign.js` was overriding the stronger `add-business.js` submit logic with a simpler fallback. It now only installs fallback submit logic if `add-business.js` failed to define `submitForm`.
5. `search.html` had `onclick="logClick(...)"` but no `logClick` function. Added safe `window.logClick`.
6. Search result links for groups/places/posts now pass IDs where possible.
7. Removed `picsum.photos` defaults from Firebase-created user profiles and documentation, so real profiles do not receive fake random photos.

## Important manual step
Publish the included `firestore.rules` in Firebase Console after deployment.

## Not fully testable locally here
Real Firebase end-to-end flows require the live Firebase project and Cloudflare deployment:
- login/signup against production Firebase Auth
- create post/business/group in live Firestore
- notification and message real-time behavior
- Firestore index prompts if Firebase requires composite indexes
