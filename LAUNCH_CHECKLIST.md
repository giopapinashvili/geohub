# GeoHub Launch Checklist

## Infrastructure

- [ ] **Cloudflare Pages** — master branch is deployed and reachable at production URL
- [ ] **Custom domain** — DNS records set, SSL certificate active, www redirect configured
- [ ] **Firebase project** — geohub-main is on the correct billing plan (Spark or Blaze as required)
- [ ] **Firebase Auth** — production domain added to Authorised Domains list (Firebase Console → Authentication → Settings)
- [ ] **Firebase Auth** — Google Sign-In enabled with correct OAuth client credentials

## Firestore

- [ ] **Firestore rules deployed** — run `firebase deploy --only firestore:rules`
  - Phase 18 changes: `suspended`/`suspendedAt`/`suspendedBy` added to `userAdminOnlyFields()`
- [ ] **Firestore indexes deployed** — run `firebase deploy --only firestore:indexes`
  - Indexes: `businessReviews`, `pointGifts`, `checkins`, `savedItems`, `eventParticipants`
- [ ] **Firestore indexes building** — confirm status is "Enabled" in Firebase Console before launch

## PWA / Service Worker

- [ ] **manifest.json** — valid, icons present, shortcuts correct
- [ ] **Service worker** (sw.js v4) — registered on all pages, caching strategy correct
- [ ] **offline.html** — offline fallback verified in DevTools → Network → Offline
- [ ] **Add-to-Home-Screen** — tested on Android Chrome and iOS Safari
- [ ] **Push notifications** — FCM VAPID key configured, permission prompt tested

## Admin Setup

- [ ] **Admin account** — UID manually added to `admins/{uid}` in Firestore Console
- [ ] **Admin panel access** — `/admin.html` verified to redirect non-admins to index.html
- [ ] **Moderation queue** — at least one test report created and resolved by admin
- [ ] **Content safety** — `userAdminOnlyFields()` blocks client-side writes to protected fields

## Content / Data

- [ ] **No fake/demo data** — no hard-coded placeholder content in any page
- [ ] **Cloudinary** — cloud name `dw5dqk2w7`, upload preset `geohub_unsigned` active
- [ ] **Images** — all Cloudinary upload/display paths tested with real image
- [ ] **Events** — at least one real event created via admin panel
- [ ] **Places** — at least one real place created via admin panel
- [ ] **Businesses** — business listing creation flow tested end-to-end

## User Flows (Manual QA)

- [ ] **Registration** — email/password sign-up creates user, profile page loads
- [ ] **Google Sign-In** — OAuth flow completes, user doc created
- [ ] **Profile edit** — name, bio, avatar (Cloudinary), interests save correctly
- [ ] **Creator mode** — "Activate Creator Mode" button sets `accountType: 'creator'`, user appears on creators page
- [ ] **Business quote** — visitor submits quote, owner receives notification, status update works
- [ ] **Wallet / GeoPoints** — points balance visible, sendPoints creates `pointGifts` doc, recipient claims
- [ ] **Support creator** — Support button triggers sendPoints, no `pointTransactions` writes
- [ ] **Report flow** — report button creates report, admin can resolve/dismiss
- [ ] **Block / mute** — block creates `blockedUsers` doc, blocked user no longer appears in feed
- [ ] **RSVP** — RSVP creates `eventParticipants` doc, "Going!" state persists on reload
- [ ] **Check-in** — check-in creates `checkins` doc, XP update visible
- [ ] **Search** — full-text search returns real results, creator links go to `profile.html?id=`
- [ ] **Notifications** — system notification appears in bell panel, click navigates correctly
- [ ] **Messages** — real-time message send/receive works between two accounts
- [ ] **Groups** — group create, join, post flow tested

## Security

- [ ] **Non-admin cannot access admin routes** — `/admin.html` redirects to index.html
- [ ] **Users cannot write admin fields** — `pointsBalance`, `xp`, `trustScore`, `isAdmin`, `suspended`, etc.
- [ ] **Firestore rules enforced** — test with a non-admin account that a direct Firestore write to a protected field is denied
- [ ] **No `javascript:` URLs** — social links, creator links, business website links validated
- [ ] **Content deletion whitelist** — `modRemoveContent` only operates on whitelisted collections

## PWA Automated Tests

- [ ] **npm install** — `npm install` completes without errors
- [ ] **Playwright installed** — `npx playwright install chromium` completes
- [ ] **Smoke tests pass** — `npm run test:e2e` passes with 0 failures
- [ ] **Mobile tests pass** — no horizontal overflow at 360px, 390px, 768px
- [ ] **Missing-route tests pass** — all `?id=__missing_test__` pages show safe fallback
- [ ] **GitHub Actions** — CI workflow runs on push to master, report uploaded on failure
- [ ] **Test account created** — dedicated email/password account in Firebase (see TESTING.md)
- [ ] **Signed-in tests pass** — set `GEOHUB_TEST_EMAIL` / `GEOHUB_TEST_PASSWORD`, run `npm run test:e2e`
- [ ] **GitHub Secrets set** — `GEOHUB_TEST_EMAIL` and `GEOHUB_TEST_PASSWORD` added to repo secrets
- [ ] **CI signed-in tests** — uncomment secret lines in `.github/workflows/e2e.yml` after secrets added

## Performance

- [ ] **Lighthouse PWA score** — run in Chrome DevTools → Lighthouse → Progressive Web App
- [ ] **First Contentful Paint** — under 3s on a 4G connection
- [ ] **No render-blocking scripts** — all `<script>` tags use `defer` or `type="module"`
- [ ] **Images lazy-loaded** — `loading="lazy"` injected by geohub-production-stabilization-v1.js

## Legal

- [ ] **Privacy Policy** — `/privacy.html` accessible and up to date
- [ ] **Terms of Service** — `/terms.html` accessible and up to date
- [ ] **Cookie consent** — any analytics/tracking has appropriate user consent
- [ ] **GDPR / data export** — user data deletion/export process documented (if applicable)

## Final Smoke

- [ ] Open production URL on real Android device — app shell loads, add-to-home-screen prompt appears
- [ ] Open production URL on real iOS device (Safari) — app shell loads correctly
- [ ] Sign in with Google on mobile — OAuth redirect works
- [ ] Sign in with email/password on mobile — login works
- [ ] Turn off network — offline.html appears
- [ ] Turn network back on — app reloads automatically

---

**Phases completed:**
- Phase 14: Places / Check-in / Reviews
- Phase 15: Events Pro / Event Management
- Phase 16: Business Leads / Quote Requests / Booking
- Phase 17: Creator / Influencer Mode
- Phase 17B: Creator Mode QA / Safety
- Phase 18: Admin / Moderation / Safety Center
- Phase 19: PWA / Mobile App Feel / Launch Polish
- Phase 20: Final QA / Playwright Smoke Tests / Launch Readiness
- Phase 21: Playwright Test Results Triage / All Tests Green
- Phase 22: Signed-in Smoke Tests Setup / TESTING.md
