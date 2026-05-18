// @ts-check
/**
 * GeoHub signed-in smoke tests.
 *
 * These tests only run when GEOHUB_TEST_EMAIL and GEOHUB_TEST_PASSWORD
 * environment variables are both set. If either is missing the entire
 * suite is skipped gracefully.
 *
 * Set up:
 *   GEOHUB_TEST_EMAIL=test@example.com
 *   GEOHUB_TEST_PASSWORD=yourpassword
 *   npm run test:e2e
 *
 * The test account must be a real Firebase Auth account in the geohub-main
 * project. Do NOT use an admin account for automated tests.
 *
 * Tests avoid Google Sign-In (OAuth redirect is not automatable without
 * real browser sessions). Use email/password auth only.
 */

const { test, expect } = require('@playwright/test');
const { attachErrorCollector, gotoSafe } = require('./helpers');

const TEST_EMAIL    = process.env.GEOHUB_TEST_EMAIL    || '';
const TEST_PASSWORD = process.env.GEOHUB_TEST_PASSWORD || '';
const HAS_CREDS     = Boolean(TEST_EMAIL && TEST_PASSWORD);

// Skip entire describe block when credentials are not provided
test.describe('Signed-in smoke tests', () => {
  test.beforeAll(() => {
    if (!HAS_CREDS) {
      console.log(
        '[signed-in] GEOHUB_TEST_EMAIL / GEOHUB_TEST_PASSWORD not set — skipping signed-in tests.'
      );
    }
  });

  // ── Login ──────────────────────────────────────────────────────────────
  test('can log in with email/password', async ({ page }) => {
    test.skip(!HAS_CREDS, 'No test credentials provided');

    const errors = attachErrorCollector(page);
    await gotoSafe(page, '/auth.html');

    const emailInput    = page.locator('input[type="email"], #email').first();
    const passwordInput = page.locator('input[type="password"], #password').first();
    const submitBtn     = page.locator(
      'button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), .auth-submit'
    ).first();

    await expect(emailInput).toBeVisible({ timeout: 8_000 });
    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);
    await submitBtn.click();

    // After login, should navigate away from auth.html within 15 s
    await page.waitForURL(url => !url.includes('auth.html'), { timeout: 15_000 });

    expect(errors, 'no fatal JS errors during login').toEqual([]);
  });

  // ── Feed ───────────────────────────────────────────────────────────────
  test('feed loads after login', async ({ page }) => {
    test.skip(!HAS_CREDS, 'No test credentials provided');

    const errors = attachErrorCollector(page);
    await page.goto('/auth.html', { waitUntil: 'domcontentloaded' });

    // Login
    const emailInput = page.locator('input[type="email"], #email').first();
    const passInput  = page.locator('input[type="password"], #password').first();
    const submit     = page.locator('button[type="submit"], .auth-submit').first();
    await emailInput.fill(TEST_EMAIL);
    await passInput.fill(TEST_PASSWORD);
    await submit.click();
    await page.waitForURL(url => !url.includes('auth.html'), { timeout: 15_000 });

    // Navigate to feed
    await gotoSafe(page, '/feed.html');
    await page.waitForTimeout(4_000);

    // Feed should have posts or empty state — not just auth redirect
    const feedContent = page.locator(
      '.gh-feed, .feed-container, .post-card, .clean-empty, #feedContainer'
    ).first();
    await expect(feedContent, 'feed content visible').toBeVisible({ timeout: 10_000 });

    expect(errors, 'no fatal JS errors on feed').toEqual([]);
  });

  // ── Profile ────────────────────────────────────────────────────────────
  test('own profile page loads after login', async ({ page }) => {
    test.skip(!HAS_CREDS, 'No test credentials provided');

    const errors = attachErrorCollector(page);
    await page.goto('/auth.html', { waitUntil: 'domcontentloaded' });

    const emailInput = page.locator('input[type="email"], #email').first();
    const passInput  = page.locator('input[type="password"], #password').first();
    const submit     = page.locator('button[type="submit"], .auth-submit').first();
    await emailInput.fill(TEST_EMAIL);
    await passInput.fill(TEST_PASSWORD);
    await submit.click();
    await page.waitForURL(url => !url.includes('auth.html'), { timeout: 15_000 });

    await gotoSafe(page, '/profile.html');
    await page.waitForTimeout(4_000);

    // Profile name block should be visible
    const profile = page.locator('.profile-name, .profile-identity-section, .profile-layout').first();
    await expect(profile, 'profile loaded').toBeVisible({ timeout: 10_000 });

    expect(errors, 'no fatal JS errors on profile').toEqual([]);
  });

  // ── Rewards / Wallet ───────────────────────────────────────────────────
  test('rewards page loads without permission-denied spam', async ({ page }) => {
    test.skip(!HAS_CREDS, 'No test credentials provided');

    const errors = attachErrorCollector(page);

    // Attach a specific collector for permission-denied to assert it is absent
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

    await page.goto('/auth.html', { waitUntil: 'domcontentloaded' });
    const emailInput = page.locator('input[type="email"], #email').first();
    const passInput  = page.locator('input[type="password"], #password').first();
    const submit     = page.locator('button[type="submit"], .auth-submit').first();
    await emailInput.fill(TEST_EMAIL);
    await passInput.fill(TEST_PASSWORD);
    await submit.click();
    await page.waitForURL(url => !url.includes('auth.html'), { timeout: 15_000 });

    await gotoSafe(page, '/rewards.html');
    await page.waitForTimeout(5_000);

    // After login, signed-in wallet reads should not produce permission-denied
    expect(
      permErrors,
      'rewards page must not produce permission-denied for authenticated user'
    ).toEqual([]);

    expect(errors, 'no fatal JS errors on rewards').toEqual([]);
  });
});
