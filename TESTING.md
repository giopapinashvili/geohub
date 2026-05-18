# GeoHub — Playwright Test Setup

## Overview

GeoHub uses [Playwright](https://playwright.dev/) for end-to-end smoke tests.
Tests run against a local `http-server` that serves the static files.

```
npm install            # install @playwright/test + http-server
npx playwright install chromium   # download Chromium (one-time)
npm run test:e2e       # run full suite
```

## Test suites

| File | What it tests |
|---|---|
| `smoke.spec.js` | Public pages (no auth required) + auth-gated redirect check |
| `mobile.spec.js` | Horizontal overflow + navbar presence at mobile viewports |
| `missing-routes.spec.js` | Graceful degradation for non-existent document IDs |
| `signed-in.spec.js` | Authenticated page loads — **skipped unless env vars are set** |

---

## Signed-in tests — setup

Signed-in tests require a dedicated **test-only** Firebase Auth account.
They are skipped automatically when `GEOHUB_TEST_EMAIL` and `GEOHUB_TEST_PASSWORD`
are not set, so the regular CI run is unaffected.

### 1. Create a dedicated test account

1. Open your GeoHub production URL (or localhost).
2. Go to `/auth.html` → **Sign Up** tab.
3. Create a new account using an email address dedicated to testing,
   for example `geohub-test@yourdomain.com`. Do **not** use a personal
   account or an admin account.
4. Complete signup (the account needs to exist in Firebase Auth).
5. Do **not** grant admin rights to this account.

### 2. Set credentials locally (PowerShell)

```powershell
$env:GEOHUB_TEST_EMAIL    = "geohub-test@yourdomain.com"
$env:GEOHUB_TEST_PASSWORD = "your-test-password"
npm run test:e2e
```

These env vars are only in-process for the current terminal session.
They are never written to disk.

### 2b. Set credentials locally (bash / Git Bash)

```bash
GEOHUB_TEST_EMAIL="geohub-test@yourdomain.com" \
GEOHUB_TEST_PASSWORD="your-test-password" \
npm run test:e2e
```

### 3. Add as GitHub Actions secrets

> This enables signed-in tests in CI on every push to master.

1. In your GitHub repository go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** and add:
   - Name: `GEOHUB_TEST_EMAIL` — Value: your test account email
   - Name: `GEOHUB_TEST_PASSWORD` — Value: your test account password
3. The CI workflow (`.github/workflows/e2e.yml`) already passes these secrets
   to the Playwright run via:
   ```yaml
   env:
     GEOHUB_TEST_EMAIL:    ${{ secrets.GEOHUB_TEST_EMAIL }}
     GEOHUB_TEST_PASSWORD: ${{ secrets.GEOHUB_TEST_PASSWORD }}
   ```
   Uncomment those two lines in the workflow file to activate them.

### 4. Update the workflow file (optional)

The lines are already in `.github/workflows/e2e.yml` but commented out:

```yaml
# Optional: add test credentials as GitHub Secrets for signed-in tests
# GEOHUB_TEST_EMAIL:    ${{ secrets.GEOHUB_TEST_EMAIL }}
# GEOHUB_TEST_PASSWORD: ${{ secrets.GEOHUB_TEST_PASSWORD }}
```

Remove the `#` from both `GEOHUB_TEST_EMAIL` and `GEOHUB_TEST_PASSWORD`
lines to enable signed-in tests in CI.

---

## CRITICAL — never commit credentials

- Do **not** hardcode email or password anywhere in the test files.
- Do **not** create a `.env` file and commit it.
- The `.gitignore` already ignores `*.local` files; store secrets in
  `secrets.local` if you need a local file (but prefer shell env vars).
- If credentials are accidentally committed, rotate the password immediately
  via Firebase Console → Authentication → the test user → change password.

---

## What the signed-in tests check

| Test | What is verified | Passes when |
|---|---|---|
| `can log in with email/password` | Login flow succeeds, redirects away from auth.html | Firebase auth responds and redirects |
| `feed loads after login` | Feed renders app shell or post list | `.gh-layout` or feed content is visible |
| `own profile page loads after login` | Profile renders name/avatar block | `.profile-name` or `.profile-cover` is visible |
| `search page loads after login` | Search shell renders | `#ghGlobalSearch` or `.gh-layout` is visible |
| `notifications page loads after login` | Notifications page renders | `.np-page` or `#npList` is visible (empty state is fine) |
| `rewards page loads without permission-denied` | Wallet reads succeed | No Firestore `permission-denied` errors (zero balance is OK) |

---

## Known limitations

- **Google Sign-In is not automated.** OAuth redirect flows cannot be driven
  headlessly without a real browser session and stored Google cookies.
  Email/password auth is used instead.
- **Signed-in tests run sequentially per test** (each test logs in independently
  rather than sharing a session). This is intentional for isolation.
- **No destructive writes.** Signed-in tests are read-only. They do not create
  posts, comments, reviews, or any Firestore documents.
- **Tests depend on Firebase CDN.** If `firebase.googleapis.com` is unreachable
  (CI outage, network block), all Firebase-dependent tests may flake.
- **The test account must exist.** If the account is deleted from Firebase
  Console, signed-in tests fail with "user not found". Re-create the account
  and update GitHub Secrets.

---

## Verification checklist

Before marking signed-in tests as configured:

- [ ] Test account created in Firebase (email/password, not Google)
- [ ] Account is **not** an admin
- [ ] `GEOHUB_TEST_EMAIL` and `GEOHUB_TEST_PASSWORD` set in local shell
- [ ] `npm run test:e2e` passes locally with credentials set
- [ ] `npm run test:e2e` passes without credentials (signed-in tests show as skipped)
- [ ] Credentials added to GitHub Actions Secrets
- [ ] Workflow `env:` lines uncommented in `.github/workflows/e2e.yml`
- [ ] No credentials present in any committed file (`git log` check)
- [ ] CI run succeeds after enabling secrets
