# GeoHub Launch Checklist

> **How to use this file**
> Work through sections top-to-bottom. Mark `[x]` when done.
> P0 items must be complete before any user touches production.
> P1 items must be complete before soft launch.
> P2 items are polish — fix before full public launch if time permits.

---

## Launch Blockers

### P0 — Hard blockers (production cannot open)

| # | Item | How to verify |
|---|---|---|
| 1 | Firestore security rules deployed | `firebase deploy --only firestore:rules` succeeds; unauthenticated write to `users/{uid}/pointsBalance` is denied |
| 2 | Firestore indexes deployed and **Enabled** | Firebase Console → Firestore → Indexes — all show status "Enabled", not "Building" |
| 3 | Firebase Auth → Authorized Domains includes production URL | Console → Authentication → Settings → Authorized domains |
| 4 | Google Sign-In OAuth credentials configured | Login with Google on production URL works end-to-end |
| 5 | Admin UID in `admins/{uid}` | Log in as admin account; `/admin.html` loads without redirect |
| 6 | No admin account UID hard-coded in public JS | `grep -r "admins/" *.js` — only Firestore reads, no hardcoded UIDs |
| 7 | Cloudinary upload preset `geohub_unsigned` is unsigned and active | Upload a real image on `/profile.html` → avatar; Cloudinary dashboard shows the upload |

### P1 — Soft-launch blockers (first real users)

| # | Item | How to verify |
|---|---|---|
| 1 | Privacy Policy and Terms of Service reviewed | `/privacy.html`, `/terms.html` load; content is legally reviewed |
| 2 | At least one real place, event, and business in Firestore | Feed/Places/Events show real content, not "empty" state |
| 3 | Email/password auth tested on mobile | Log in with email/password on real Android and iOS |
| 4 | New-user onboarding flow works | Sign up as a fresh user; profile prompts name, interests, avatar |
| 5 | Playwright smoke tests pass | `npm run test:e2e` → 160 passed, 0 failed |
| 6 | Custom domain SSL active | `https://yourdomain.com` loads without cert warning |

### P2 — Nice-to-have before public launch

| # | Item | How to verify |
|---|---|---|
| 1 | Lighthouse PWA score ≥ 90 | Chrome DevTools → Lighthouse → PWA |
| 2 | Push notification VAPID key verified | FCM subscription works on a real device |
| 3 | Signed-in Playwright tests configured | See TESTING.md; `GEOHUB_TEST_EMAIL` added to GitHub Secrets |
| 4 | `/patriot.html` and `/world.html` are `noindex` | Check `<meta name="robots">` on those pages |
| 5 | XP / trust-score pipeline reviewed | Acceptable to launch client-side; Cloud Functions upgrade deferred to Blaze plan |

---

## Infrastructure

- [ ] **Cloudflare Pages** — master branch deployed and reachable at production URL
- [ ] **Custom domain** — DNS records set, SSL certificate active, www redirect configured
- [ ] **Firebase project** — geohub-main is on the correct billing plan (Spark or Blaze as required)
- [ ] **Firebase Auth** — production domain added to Authorised Domains list
  - Firebase Console → Authentication → Settings → Authorised Domains → Add domain
- [ ] **Firebase Auth** — Google Sign-In enabled with correct OAuth client credentials
  - Console → Authentication → Sign-in method → Google → Web SDK config → copy clientId

## Firestore

- [ ] **Firestore rules deployed** — `firebase deploy --only firestore:rules`
  - Phase 18 changes: `suspended`/`suspendedAt`/`suspendedBy` added to `userAdminOnlyFields()`
  - Verify: attempt an unauthenticated write to `users/{uid}/pointsBalance` → denied
- [ ] **Firestore indexes deployed** — `firebase deploy --only firestore:indexes`
  - Indexes: `businessReviews`, `pointGifts`, `checkins`, `savedItems`, `eventParticipants`
- [ ] **Firestore indexes status "Enabled"** — Firebase Console → Firestore → Indexes
  - Wait for all indexes to leave "Building" state before opening to users

## PWA / Service Worker

- [ ] **manifest.json** — valid JSON, icons present at all sizes, shortcuts correct
- [ ] **Service worker** (sw.js v4) — registered on all pages, caching strategy correct
- [ ] **offline.html** — DevTools → Network → Offline → navigate; offline.html appears
- [ ] **Add-to-Home-Screen** — tested on Android Chrome (banner) and iOS Safari (Share → Add)
- [ ] **Push notifications** — FCM VAPID key in `firebase-config.js` matches Console

## Admin Setup

- [ ] **Admin account** — UID manually added to `admins/{uid}` in Firestore Console
- [ ] **Admin panel access** — `/admin.html` redirects non-admins to index.html
- [ ] **Moderation queue** — at least one test report created and resolved by admin
- [ ] **Content safety** — `userAdminOnlyFields()` blocks client-side writes to protected fields

## Content / Data

- [ ] **No fake/demo data** — no hard-coded placeholder content in any page
- [ ] **Cloudinary** — cloud name `dw5dqk2w7`, upload preset `geohub_unsigned` active
- [ ] **Images** — Cloudinary upload and display tested with a real photo
- [ ] **Events** — at least one real event created via admin panel
- [ ] **Places** — at least one real place created via admin panel
- [ ] **Businesses** — business listing creation flow tested end-to-end

---

## Manual QA Flows

> These flows require a real browser with a logged-in account.
> Use two accounts (Account A = tester, Account B = secondary) where noted.

### 1 — Google Sign-In / Register

1. Open `/auth.html` in an incognito window.
2. Click **Continue with Google**.
3. Complete OAuth consent; confirm redirect to feed or index.
4. Check Firestore Console: a new doc exists at `users/{uid}`.
5. Reload `/profile.html` — name and avatar from Google are shown.

### 2 — Email/Password Registration

1. Open `/auth.html` → **Sign Up** tab.
2. Fill name, username, email, password, city, account type.
3. Submit — confirm redirect to feed.
4. Check `users/{uid}` doc created in Firestore Console.
5. Log out, log back in with the same credentials.

### 3 — Create Post

1. Log in as Account A; go to `/feed.html`.
2. Click the post composer; type text, optionally attach a photo.
3. Submit — post appears at top of feed.
4. Reload — post persists.
5. Log in as Account B; confirm post is visible in the feed.

### 4 — Comment / Reply / Reaction

1. As Account B, open a post by Account A.
2. Add a comment; confirm it appears immediately.
3. Reply to the comment (thread); confirm nesting.
4. Click a reaction (like/heart); confirm count increments.
5. Remove reaction; confirm count decrements.
6. As Account A, open the notification bell — new notification present.

### 5 — Business Quote Request

1. As Account B (visitor), open a business page.
2. Click **Request a Quote** / **Get Quote**; fill and submit the form.
3. A `quoteRequests` doc is created under `businesses/{bizId}/quoteRequests`.
4. Log in as Account A (business owner); open `/business.html?id=...`.
5. Find the quote in the inbox; change status to **Accepted** or **Declined**.
6. Confirm Account B sees the updated status.

### 6 — Cloudinary Image Upload

1. Log in; go to `/profile.html` → Edit Profile.
2. Click the avatar upload area; choose a real photo.
3. Confirm the Cloudinary upload spinner appears.
4. After upload, the new avatar is saved to `users/{uid}.avatarUrl`.
5. Reload the profile — avatar persists.

### 7 — Event RSVP / Un-RSVP

1. Open `/events.html`; click an event.
2. Click **RSVP** / **Going!** — confirm button state changes.
3. Reload the page — RSVP state persists.
4. Check Firestore: `eventParticipants/{eventId}_{uid}` exists.
5. Click again to cancel RSVP — confirm doc is removed or status changes.

### 8 — Place Review / Check-in

1. Open `/places.html`; click a place.
2. Click **Check In** — confirm XP update toast appears.
3. Check `checkins/{autoId}` created in Firestore.
4. Submit a star rating + comment as a review.
5. Check `businessReviews/{autoId}` (or `placeReviews`) created.
6. Reload the place detail — review and star rating visible.

### 9 — Group Join / Request / Leave

1. Open `/groups.html`; find a public group.
2. Click **Join** — confirm member count increments or request pending.
3. Open the group feed; create a post.
4. As admin of the group, approve a join request (if group is private).
5. Leave the group — confirm member count decrements.

### 10 — Creator Support with Points

1. Log in as Account B; go to a creator's profile (`accountType: 'creator'`).
2. Click **Support Creator** — enter an amount (e.g. 10).
3. A `pointGifts` doc is created: `{ from: B.uid, to: creator.uid, amount: 10 }`.
4. Log in as Account A (creator); go to `/rewards.html`.
5. Claim the gift — `pointsBalance` on Account A's user doc increments.
6. Account B's `pointsBalance` decrements accordingly.

### 11 — Wallet Send / Claim Gift

1. Log in as Account A; go to `/rewards.html` → Send Points.
2. Enter Account B's username and amount.
3. A `pointGifts` doc is created in Firestore.
4. Log in as Account B; go to `/rewards.html`.
5. Pending gift appears — click **Claim**.
6. Balance updates; no `pointTransactions` collection writes.

### 12 — Report / Mute / Block

1. As Account B, open Account A's profile or a post.
2. Click **Report** — fill reason; confirm `reports/{id}` doc created with `status: 'pending'`.
3. Click **Mute** — confirm Account A's content no longer appears in B's feed.
4. Click **Block** — confirm `blockedUsers/{uid}` doc created.
5. Log in as admin; open `/admin.html` → Moderation Queue.
6. Find the report; click **Resolve** or **Dismiss**.

### 13 — Notification Bell / Mark All Read

1. Log in as Account A.
2. As Account B, perform an action that triggers a notification (comment, like, follow).
3. As Account A, open the notification bell panel.
4. Notification appears; click it — navigates to the correct content.
5. Click **Mark all read** — badge clears.
6. Go to `/notifications.html` — full list loads; filter tabs work.

### 14 — Mobile 390 px Quick Check

1. Open Chrome DevTools → Device Toolbar → set 390 × 844.
2. Navigate: `/feed.html`, `/places.html`, `/events.html`, `/profile.html`.
3. Confirm: no horizontal scrollbar, no clipped buttons, touch targets ≥ 44 px.
4. Open the hamburger menu — mobile nav slides in correctly.
5. Rotate to landscape (844 × 390) — layout still usable.

---

## Security

- [ ] **Non-admin cannot access admin routes** — `/admin.html` redirects to index.html
- [ ] **Users cannot write admin fields** — `pointsBalance`, `xp`, `trustScore`, `isAdmin`, `suspended`
  - Test: attempt `updateDoc(userRef, { pointsBalance: 9999 })` in browser console → denied
- [ ] **Firestore rules enforced** — direct Firestore write to a protected field is denied in browser console
- [ ] **No `javascript:` URLs** — social links, creator links, business website links validated
- [ ] **Content deletion whitelist** — `modRemoveContent` only operates on whitelisted collections

---

## PWA Automated Tests

- [ ] **npm install** — `npm install` completes without errors
- [ ] **Playwright installed** — `npx playwright install chromium` completes
- [ ] **Smoke tests pass** — `npm run test:e2e` → 160 passed, 0 failed (see [TESTING.md](TESTING.md))
- [ ] **Mobile tests pass** — no horizontal overflow at 360 px, 390 px, 768 px
- [ ] **Missing-route tests pass** — all `?id=__missing_test__` pages show safe fallback
- [ ] **GitHub Actions** — CI workflow runs on push to master; report uploaded on failure
- [ ] **Test account created** — dedicated email/password account in Firebase (see TESTING.md)
- [ ] **Signed-in tests pass** — set `GEOHUB_TEST_EMAIL` / `GEOHUB_TEST_PASSWORD`, run `npm run test:e2e`
- [ ] **GitHub Secrets set** — `GEOHUB_TEST_EMAIL` and `GEOHUB_TEST_PASSWORD` added to repo secrets
- [ ] **CI signed-in tests** — uncomment secret lines in `.github/workflows/e2e.yml` after secrets added

---

## Deployment Commands

```powershell
# Deploy Firestore rules (run after any firestore.rules change)
firebase deploy --only firestore:rules

# Deploy Firestore indexes (run after any firestore.indexes.json change)
firebase deploy --only firestore:indexes

# Run full Playwright test suite locally
npm run test:e2e

# Run with visible browser window (useful for debugging failures)
npm run test:e2e:headed

# Open the last HTML report in the browser
npm run test:e2e:report

# Run only the signed-in suite (requires env vars — see TESTING.md)
# PowerShell:
$env:GEOHUB_TEST_EMAIL = "test@yourdomain.com"
$env:GEOHUB_TEST_PASSWORD = "yourpassword"
npx playwright test tests/e2e/signed-in.spec.js

# Run a single project (e.g. only mobile-390)
npx playwright test --project=mobile-390

# Run a single spec file
npx playwright test tests/e2e/missing-routes.spec.js
```

---

## GitHub Actions / CI Reference

### How to read the Playwright report

1. Go to the repository on GitHub → **Actions** tab.
2. Click the failing workflow run.
3. Scroll to **Artifacts** — download `playwright-report-{run_id}`.
4. Unzip; open `index.html` in a browser to see full results with screenshots.

### What "skipped" means for signed-in tests

`16 skipped` (4 projects × 6 signed-in tests) means `GEOHUB_TEST_EMAIL` and
`GEOHUB_TEST_PASSWORD` are not set in CI. This is expected and safe — no
credentials are needed for the smoke suite. To enable signed-in tests in CI,
add the GitHub Secrets and uncomment the two `env:` lines in `e2e.yml`
(see TESTING.md for exact steps).

### What "flaky" (retry passed) means

A test marked `1 flaky` failed on the first attempt but passed on the
automatic retry. This usually indicates a timing issue: the Firebase CDN
or the local http-server was slow under load. The test result is still
**green** — no code change is needed. If the same test flakes every run,
investigate the root cause (see Phase 21B for the navbar assertion fix
as a reference).

### How to add GitHub Secrets

1. Repository → **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret**.
3. Add `GEOHUB_TEST_EMAIL` and `GEOHUB_TEST_PASSWORD`.
4. Edit `.github/workflows/e2e.yml` — uncomment the two secret lines.

---

## Performance

- [ ] **Lighthouse PWA score** — Chrome DevTools → Lighthouse → Progressive Web App
- [ ] **First Contentful Paint** — under 3 s on a simulated 4 G connection
- [ ] **No render-blocking scripts** — all `<script>` tags use `defer` or `type="module"`
- [ ] **Images lazy-loaded** — `loading="lazy"` injected by geohub-production-stabilization-v1.js

## Legal

- [ ] **Privacy Policy** — `/privacy.html` accessible and up to date with real data-handling info
- [ ] **Terms of Service** — `/terms.html` accessible and legally reviewed
- [ ] **Cookie consent** — any analytics/tracking has appropriate user consent mechanism
- [ ] **GDPR / data export** — user data deletion/export process documented

## Final Smoke (real devices)

- [ ] Open production URL on real Android — app shell loads, Add-to-Home-Screen prompt appears
- [ ] Open production URL on real iOS (Safari) — app shell loads correctly
- [ ] Sign in with Google on mobile — OAuth redirect completes, user doc created
- [ ] Sign in with email/password on mobile — login works, feed loads
- [ ] Turn off network — offline.html appears within 3 s
- [ ] Turn network back on — app reloads automatically

---

## Known Limitations

| Limitation | Status | Notes |
|---|---|---|
| Google Sign-In not automated in Playwright | By design | OAuth redirect cannot be driven headlessly. Manual QA covers this (flow #1 above). |
| XP / Trust scoring is client-side only | Deferred | Full scoring pipeline needs Cloud Functions (Blaze plan). Safe to launch — XP is cosmetic. |
| `/patriot.html` and `/world.html` are prototype pages | Intentional | These pages are `noindex` simulations. Not part of the core MVP. |
| Rewards redemption requires admin setup | Deferred | Admins must create reward items in Firestore before users can redeem. |
| Push notifications need real device | Manual only | FCM subscription flow cannot be automated in headless Chromium. |
| Messages real-time delivery | Manual only | Two-account real-time test cannot be automated without two concurrent browser sessions in the suite. |

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
- Phase 21B: Fix Flaky Navbar Assertion
- Phase 22: Signed-in Smoke Tests Setup / TESTING.md
- Phase 23: Launch Checklist Cleanup / Final Manual QA Plan
