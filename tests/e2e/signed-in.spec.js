// @ts-check
/**
 * GeoHub signed-in smoke tests.
 *
 * These tests only run when GEOHUB_TEST_EMAIL and GEOHUB_TEST_PASSWORD
 * environment variables are both set. If either is missing the entire
 * suite is skipped gracefully.
 *
 * Quick start (local):
 *   $env:GEOHUB_TEST_EMAIL="test@yourdomain.com"
 *   $env:GEOHUB_TEST_PASSWORD="yourpassword"
 *   npm run test:e2e
 *
 * The test account must be a real Firebase Auth (email/password) account
 * in the geohub-main project. See TESTING.md for full setup instructions.
 *
 * Rules:
 *   - Do NOT use an admin account.
 *   - Do NOT use a personal/production account.
 *   - These tests are read-only — no writes, no destructive operations.
 *   - Google Sign-In is NOT automated (OAuth redirect is not testable headlessly).
 */

const { test, expect } = require('@playwright/test');
const { attachErrorCollector, gotoSafe } = require('./helpers');

const TEST_EMAIL    = process.env.GEOHUB_TEST_EMAIL    || '';
const TEST_PASSWORD = process.env.GEOHUB_TEST_PASSWORD || '';
const HAS_CREDS     = Boolean(TEST_EMAIL && TEST_PASSWORD);

/**
 * Log in with test credentials. Call once per test before navigating to
 * the page under test. Throws (fails the test) if login doesn't redirect
 * away from auth.html within 15 s.
 */
async function loginWithCreds(page) {
  await page.goto('/auth.html', { waitUntil: 'domcontentloaded', timeout: 25_000 });
  const emailInput = page.locator('#loginIdentifier, input[type="email"]').first();
  const passInput  = page.locator('input[type="password"], #loginPassword').first();
  const submitBtn  = page.locator('#loginBtn, button[type="submit"], .auth-submit').first();

  await expect(emailInput).toBeVisible({ timeout: 8_000 });
  await emailInput.fill(TEST_EMAIL);
  await passInput.fill(TEST_PASSWORD);
  await submitBtn.click();

  // Successful login redirects away from auth.html (typically to feed or index)
  await page.waitForURL(url => !url.pathname.includes('auth.html'), { timeout: 15_000 });
}

// ── Suite ──────────────────────────────────────────────────────────────────────
test.describe('Signed-in smoke tests', () => {
  test.beforeAll(() => {
    if (!HAS_CREDS) {
      console.log(
        '[signed-in] GEOHUB_TEST_EMAIL / GEOHUB_TEST_PASSWORD not set — skipping signed-in tests.'
      );
    }
  });

  // ── Login ──────────────────────────────────────────────────────────────────
  test('can log in with email/password', async ({ page }) => {
    test.skip(!HAS_CREDS, 'No test credentials provided');

    const errors = attachErrorCollector(page);
    await loginWithCreds(page);

    // After redirect the DOM should show the app shell, not auth.html
    await expect(page.locator('body')).toBeAttached({ timeout: 5_000 });
    expect(errors, 'no fatal JS errors during login').toEqual([]);
  });

  // ── Feed ───────────────────────────────────────────────────────────────────
  test('feed loads after login', async ({ page }) => {
    test.skip(!HAS_CREDS, 'No test credentials provided');

    const errors = attachErrorCollector(page);
    await loginWithCreds(page);

    await gotoSafe(page, '/feed.html');
    await page.waitForTimeout(4_000);

    // Feed shows posts, empty state, or the app shell — never a blank page
    const feedContent = page.locator(
      '.gh-feed, .feed-container, .post-card, .gh-card, .gh-empty, #feedContainer, .gh-layout'
    ).first();
    await expect(feedContent, 'feed content visible').toBeVisible({ timeout: 10_000 });

    expect(errors, 'no fatal JS errors on feed').toEqual([]);
  });

  // ── Profile ────────────────────────────────────────────────────────────────
  test('own profile page loads after login', async ({ page }) => {
    test.skip(!HAS_CREDS, 'No test credentials provided');

    const errors = attachErrorCollector(page);
    await loginWithCreds(page);

    await gotoSafe(page, '/profile.html');
    await page.waitForTimeout(4_000);

    // Profile renders name block, layout, or avatar area
    const profile = page.locator(
      '.profile-name, .profile-identity-section, .profile-layout, .profile-cover'
    ).first();
    await expect(profile, 'profile loaded').toBeVisible({ timeout: 10_000 });

    expect(errors, 'no fatal JS errors on profile').toEqual([]);
  });

  // ── Search ─────────────────────────────────────────────────────────────────
  test('search page loads after login', async ({ page }) => {
    test.skip(!HAS_CREDS, 'No test credentials provided');

    const errors = attachErrorCollector(page);
    await loginWithCreds(page);

    await gotoSafe(page, '/search.html');
    await page.waitForTimeout(3_000);

    // Search page renders the app shell — at minimum the global search input
    // or the shell layout is present (search.html is a shell-only page)
    const searchEl = page.locator(
      '#ghGlobalSearch, .gh-search-bar, .gh-layout, .gh-topbar, body'
    ).first();
    await expect(searchEl, 'search page shell visible').toBeVisible({ timeout: 8_000 });

    expect(errors, 'no fatal JS errors on search').toEqual([]);
  });

  // ── Notifications ──────────────────────────────────────────────────────────
  test('notifications page loads after login', async ({ page }) => {
    test.skip(!HAS_CREDS, 'No test credentials provided');

    const errors = attachErrorCollector(page);
    await loginWithCreds(page);

    await gotoSafe(page, '/notifications.html');
    await page.waitForTimeout(4_000);

    // Notifications page renders .np-page regardless of whether there are notifications.
    // The empty state (".np-empty") or skeleton loaders are acceptable.
    const notifEl = page.locator('.np-page, .np-head, #npList').first();
    await expect(notifEl, 'notifications page rendered').toBeVisible({ timeout: 10_000 });

    expect(errors, 'no fatal JS errors on notifications').toEqual([]);
  });

  // ── Rewards / Wallet ───────────────────────────────────────────────────────
  test('rewards page loads without permission-denied spam', async ({ page }) => {
    test.skip(!HAS_CREDS, 'No test credentials provided');

    const errors = attachErrorCollector(page);

    // Collect permission-denied errors specifically
    const permErrors = [];
    page.on('console', msg => {
      if (
        msg.type() === 'error' &&
        (msg.text().includes('permission-denied') ||
          msg.text().includes('Missing or insufficient permissions'))
      ) {
        permErrors.push(msg.text());
      }
    });

    await loginWithCreds(page);

    await gotoSafe(page, '/rewards.html');
    await page.waitForTimeout(5_000);

    // A zero wallet balance is fine — we only assert no permission-denied errors
    expect(
      permErrors,
      'rewards page must not produce permission-denied for authenticated user'
    ).toEqual([]);

    expect(errors, 'no fatal JS errors on rewards').toEqual([]);
  });
});
