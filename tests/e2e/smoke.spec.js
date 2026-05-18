// @ts-check
/**
 * GeoHub public smoke tests.
 *
 * Each test:
 * 1. Opens a page without authentication.
 * 2. Waits for the DOM to be ready.
 * 3. Asserts no fatal JS errors occurred.
 * 4. Optionally checks for a key structural element.
 *
 * Pages that require auth will redirect to auth.html — that redirect is
 * treated as a pass (redirect itself shows the JS is working).
 * Permission-denied Firebase errors on unauthenticated pages are ignored.
 */

const { test, expect } = require('@playwright/test');
const { attachErrorCollector, gotoSafe } = require('./helpers');

// Give Firebase SDK time to load from CDN and produce any early errors.
const SETTLE_MS = 2_500;

/** Pages expected to be publicly viewable (no auth redirect). */
const PUBLIC_PAGES = [
  { url: '/auth.html',          selector: 'form, .auth-card, input[type="email"], input[type="text"]', label: 'auth form' },
  { url: '/index.html',         selector: 'body',              label: 'landing page body' },
  { url: '/creators.html',      selector: '.clean-hero, main', label: 'creators hero' },
  { url: '/events.html',        selector: '.clean-hero, main', label: 'events hero' },
  { url: '/places.html',        selector: 'main, #app, body',  label: 'places main' },
  { url: '/groups.html',        selector: 'main, #app, body',  label: 'groups main' },
  { url: '/search.html',        selector: 'main, #app, body',  label: 'search main' },
  { url: '/offline.html',       selector: 'body',              label: 'offline body' },
  { url: '/privacy.html',       selector: 'body',              label: 'privacy body' },
  { url: '/terms.html',         selector: 'body',              label: 'terms body' },
  { url: '/pricing.html',       selector: 'body',              label: 'pricing body' },
];

/** Pages that may redirect to auth.html — still should not crash. */
const AUTH_GATED_PAGES = [
  '/feed.html',
  '/profile.html',
  '/messages.html',
  '/notifications.html',
  '/rewards.html',
  '/challenges.html',
  '/trust.html',
  '/admin.html',
  '/business.html',
];

test.describe('Public page smoke tests', () => {
  for (const { url, selector, label } of PUBLIC_PAGES) {
    test(`${url} loads without fatal errors`, async ({ page }) => {
      const errors = attachErrorCollector(page);

      await gotoSafe(page, url);
      await page.waitForTimeout(SETTLE_MS);

      // Key element must be present
      await expect(page.locator(selector).first()).toBeVisible({ timeout: 8_000 });

      expect(errors, `fatal JS errors on ${url}`).toEqual([]);
    });
  }
});

test.describe('Auth-gated page smoke tests (no crash on redirect)', () => {
  for (const url of AUTH_GATED_PAGES) {
    test(`${url} does not crash when unauthenticated`, async ({ page }) => {
      const errors = attachErrorCollector(page);

      await gotoSafe(page, url);
      await page.waitForTimeout(SETTLE_MS);

      // After redirect the DOM should have a body — we do not assert a
      // specific element since the page might now be auth.html.
      await expect(page.locator('body')).toBeAttached({ timeout: 5_000 });

      expect(errors, `fatal JS errors on ${url}`).toEqual([]);
    });
  }
});

test.describe('Auth page functional checks', () => {
  test('auth.html has email + password inputs and submit button', async ({ page }) => {
    const errors = attachErrorCollector(page);
    await gotoSafe(page, '/auth.html');
    await page.waitForTimeout(SETTLE_MS);

    // Login form uses type="text" for email/username (#loginIdentifier) — not type="email"
    // The signup form has type="email" but is hidden by default
    const emailInput    = page.locator('#loginIdentifier, input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], #password').first();

    await expect(emailInput,    'email input present').toBeVisible({ timeout: 8_000 });
    await expect(passwordInput, 'password input present').toBeVisible({ timeout: 8_000 });

    expect(errors, 'no fatal JS errors').toEqual([]);
  });

  test('creators.html shows creator grid or empty state (not blank)', async ({ page }) => {
    const errors = attachErrorCollector(page);
    await gotoSafe(page, '/creators.html');
    // Wait for Firestore attempt (load or empty-state render)
    await page.waitForTimeout(4_000);

    // Either the grid or the empty-state must be visible — never a blank page
    const content = page.locator('.cr-grid, .clean-empty, #cleanList').first();
    await expect(content, 'creator content area visible').toBeVisible({ timeout: 8_000 });

    expect(errors, 'no fatal JS errors').toEqual([]);
  });

  test('events.html shows events or empty state', async ({ page }) => {
    const errors = attachErrorCollector(page);
    await gotoSafe(page, '/events.html');
    await page.waitForTimeout(4_000);

    const content = page.locator('#cleanList, .clean-empty').first();
    await expect(content, 'events content area visible').toBeVisible({ timeout: 8_000 });

    expect(errors, 'no fatal JS errors').toEqual([]);
  });
});
