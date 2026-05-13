# GeoHub Step 7 — Architecture Cleanup Report

Applied fixes:

- Removed production `.bak` files.
- Cleaned Messenger conflict on `messages.html`: removed legacy `messages.js` and page-level `chat-popup.js`; `real-messages.js` is now the single messages-page controller.
- Kept `chat-popup.js` as the global popup controller only for non-messages pages.
- Removed message document reaction counters/emoji writes from `firestore-social.js`; reactions now live only in `messageReactions`.
- Aligned `firestore.rules` with the reaction schema by removing `reactionCount/reactionEmoji` from allowed message updates.
- Removed duplicate story renderer from `geohub-fixes.js`; stories are now handled by `geohub-social-redesign.js` / stories page only.
- Removed/renamed admin “Coming Soon” labels.
- Reworked `world.js` away from fake/static feed/predictions/random counters toward Firestore counts and live-data empty states.

Verified by script scan:

- No `.bak` files remain.
- No `Coming Soon` text remains in HTML/JS source except this report if searched broadly.
- JS syntax checked with Node for all `.js` files.
- HTML script references checked for missing files.
