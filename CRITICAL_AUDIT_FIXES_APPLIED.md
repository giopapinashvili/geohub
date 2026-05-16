# GeoHub Critical Audit Fixes Applied

Applied based on Claude deep QA report:

- Blocked client-created `earn` pointTransactions in Firestore rules.
- Added `pointEarnRequests` for pending earn requests until Cloud Functions/server-side awarding is added.
- Removed public `quantityRemaining` updates on rewards.
- Replaced hardcoded admin email rule with Firestore `admins/{uid}` lookup.
- Added Firestore `admins` collection rule.
- Removed `Promise.all` fallback from reward redemption; `runTransaction` is required.
- Disabled silent base64 image fallback into Firestore. Storage errors now fail visibly.
- Added send button double-click protection for GeoPoints transfers.
- Connected `rewards.html` to GeoHub styling/scripts and added a full app-shell style header/sidebar around Rewards.
- Changed new user default city from `Tbilisi` to `all_georgia`.
- Fixed account dropdown and mobile profile links to include `?id=UID`.
- Replaced fake Patriot leaderboard with real Firestore users query and an empty state.
- Added Coming Soon fallback for unmapped social shell pages.
- Replaced user-facing `Add in Admin` CTAs with Coming Soon text.
- Added `terms.html` and `privacy.html`. Firebase Storage rules are not needed because media uploads use Cloudinary.
- Added Firebase API key restriction reminder comment.

Manual required after upload:
1. Create `admins/{YOUR_UID}` in Firestore with `isAdmin: true` before publishing new rules.
2. Publish `firestore.rules`.
3. Restrict Firebase API key to production domains.
4. Add Cloud Functions for real GeoPoints earning before public launch.
- Tightened GeoPoints client transaction rules further: non-admin clients can only create outgoing `gift`, `spend`, or `redeem` transactions where `fromUserId == request.auth.uid`, preventing fake incoming gifts.
