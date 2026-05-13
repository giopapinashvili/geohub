# GeoHub Performance Optimization Report

## Applied changes

1. Added `defer` to local JavaScript files in HTML pages so rendering is not blocked by scripts.
2. Added `loading="lazy"` and `decoding="async"` to static and common dynamic images.
3. Reduced Firestore default list sizes from 50 to 20 in `api-client.js`.
4. Reduced heavy realtime listener limits in `firestore-social.js`:
   - Feed default: 30 → 12 posts
   - Stories: 50 queried / 20 rendered → 20 queried / 12 rendered
   - Comments: now limited to 20
   - Replies / groups / places / rewards / saved items / profile lists reduced
   - Notifications reduced to 20
5. Optimized GeoPoints wallet loading:
   - First reads `users/{uid}.pointsBalance` if available
   - Avoids constantly listening to many `pointTransactions`
   - Falls back to recent transactions only when balance fields do not exist
6. Reduced `geohub-social-redesign.js` page-level collection limits from 100/50 to 30/25.
7. Reduced unread message listener to 25 conversations.
8. Limited map Firestore collection loading to 100 records instead of loading full collections.
9. Added mobile/reduced-motion CSS performance hotfixes:
   - Disables expensive animations on mobile/reduced-motion
   - Disables heavy `backdrop-filter` on common cards/menus/modals
10. Rebuilt Cloudflare `_headers` with long cache for JS/CSS/icons and no-cache for HTML/admin pages.

## Important note

For the best GeoPoints speed, keep these fields updated on every user document:

- `pointsBalance`
- `pointsEarned`
- `pointsReceived`
- `pointsSent`
- `pointsSpent`

Without those fields, the app still works, but it falls back to reading recent transactions.

## Test checklist after deploy

1. Hard refresh the site with Ctrl+F5.
2. Open DevTools → Network → reload page.
3. Check that JS/CSS loads with cache headers after second refresh.
4. Test Feed, Stories, Notifications, Messages, Places, Groups, Admin.
5. In Firestore, confirm feed and story pages are no longer reading huge document counts.
