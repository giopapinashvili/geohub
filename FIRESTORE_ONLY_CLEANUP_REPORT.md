# GeoHub Firestore-only cleanup report

## What changed

This pass removes every direct `browser local storage` and `browser session storage` reference from the project and moves app state to Firebase Auth / Firestore-backed flows.

## Main files changed

- `firebase-config.js`
  - Exposes Firebase Auth helpers for shared scripts.
- `firebase-auth.js`
  - Removed browser storage auth caching.
  - Firebase Auth is the only login/session source.
  - User profile is synced to `users/{uid}`.
- `auth.js`
  - Removed demo-account login/register persistence.
  - Login/signup/Google login now use Firebase Auth only.
- `account.js`
  - Navbar/profile/auth state now reads Firebase Auth + `users/{uid}`.
  - Logout uses Firebase sign out.
- `api-client.js`
  - Replaced placeholder browser-storage API with Firestore-backed API helpers.
- `main.js`
  - `safeStorage` is now a Firestore-backed UI state helper using `userUiState` documents.
- `add-business.js`
  - Removed session marker and browser-auth fallback.
  - Business creation stays Firestore-first.
- `admin.js`
  - Admin guard now checks Firebase Auth user email.
  - Removed user migration/fallback from browser storage.
  - Feature flags write to Firestore `adminFlags`.
- `dashboard.js`
  - Business profile save/load now uses Firestore `businesses`.
- `feed.js`, `social-layer.js`, `mobile-nav.js`, `mode.js`, `nav-cleanup.js`, `onboarding.js`, `pricing.js`, `patriot.js`, `trust.js`
  - Removed browser storage references and connected state to Firebase/Auth/safeStorage where needed.
- `firestore.rules`
  - Added `userUiState`, `adminFlags`, and API-client collections.

## Verification

- Searched entire project for `browser local storage` and `browser session storage`: zero matches.
- Ran JS syntax check for all `.js` files with `node --check`: passed.

## Required manual step

After deploying this ZIP, publish the included `firestore.rules` in Firebase Console:
Firestore Database → Rules → paste file contents → Publish.

Without publishing rules, new Firestore-backed state collections such as `userUiState`, `adminFlags`, `campaigns`, `tickets`, `serviceRequests`, etc. may be blocked.
