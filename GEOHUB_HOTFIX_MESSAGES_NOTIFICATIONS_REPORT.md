# GeoHub Hotfix — Messages Reactions + Notifications

Fixed in this ZIP:

1. Messages reactions `permission-denied`
   - Updated `firestore.rules` for `messageReactions`.
   - The app was reading a deterministic reaction document before creating it. When the doc did not exist yet, the old participant-based read rule could block that lookup and cause `permission-denied`.
   - Signed-in users can now read reaction docs, while create/update/delete remain protected: only the logged-in user can create/update/delete their own reaction, and creation still requires conversation participation.

2. Emoji/reaction picker clipping
   - Updated `messages.css` so message rows, bubbles, and chat container allow the reaction picker to overflow visibly.
   - Added high z-index and better left/right positioning for sent/received messages and mobile screens.

3. Notification read state
   - Updated notification creation to include `seen:false`.
   - Updated `markNotificationRead()` to write both `read:true` and `seen:true` with `openedAt`/`updatedAt`.
   - Updated notification UI read logic so badges count only items that are not read and not seen.
   - Updated rules to allow notification read updates with `openedAt`.

Files changed:
- `firestore.rules`
- `firestore-social.js`
- `geohub-social-redesign.js`
- `messages.css`
- `real-messages.js`

Important after deploy:
- Publish the updated `firestore.rules` manually in Firebase Console → Firestore Database → Rules → Publish.
- Push the updated site files to GitHub so Cloudflare Pages redeploys.
