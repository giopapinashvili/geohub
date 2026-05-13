# Message Reactions Real Fix

Fixed the runtime `Message reaction failed` issue by moving message reactions to a dedicated `messageReactions` collection instead of relying only on updates to nested message documents.

Changes:
- Added `messageReactions` Firestore rules.
- Rewrote `GeoSocial.toggleMessageReaction()` to create/delete reaction docs.
- Added realtime `listenMessageReactions()` helper.
- Updated `real-messages.js` and `chat-popup.js` to listen and render reactions from the new collection.
- Kept legacy message counters as best-effort only, so blocked counter updates no longer break reactions.
- Added image sizing CSS for message images.

After deploy: publish `firestore.rules` again.
