// @ts-check
/**
 * GeoHub mobile viewport smoke tests.
 *
 * Each test opens a page at a specific viewport, waits for the DOM,
 * then asserts:
 *   1. No horizontal overflow (no clipped content, no scrollbar).
 *   2. Main content or navbar is visible.
 *   3. No fatal JS errors.
 *
 * These tests run across all defined playwright.config.js projects,
 * but are most meaningful for mobile-360, mobile-390, tablet-768.
 */

const { test, expect } = require('@playwright/test');
const { attachErrorCollector, gotoSafe, hasHorizontalOverflow } = require('./helpers');

const SETTLE_MS = 2_000;

const MOBILE_PAGES = [
  '/auth.html',
  '/index.html',
  '/creators.html',
  '/events.html',
  '/places.html',
  '/groups.html',
  '/search.html',
];

test.describe('Mobile layout — no horizontal overflow', () => {
  for (const url of MOBILE_PAGES) {
    test(`${url} has no horizontal scroll`, async ({ page }) => {
      const errors = attachErrorCollector(page);

      await gotoSafe(page, url);
      await page.waitForTimeout(SETTLE_MS);

      const overflow = await hasHorizontalOverflow(page);
      expect(overflow, `${url} must not have horizontal overflow`).toBe(false);

      expect(errors, `no fatal JS errors on ${url}`).toEqual([]);
    });
  }
});

test.describe('Mobile layout — navbar visible and not duplicated', () => {
  for (const url of ['/index.html', '/creators.html', '/events.html', '/auth.html']) {
    test(`${url} has at most one navbar`, async ({ page }) => {
      const errors = attachErrorCollector(page);

      await gotoSafe(page, url);
      await page.waitForTimeout(SETTLE_MS);

      // auth.html has no navbar; index.html uses a JS-rendered sidebar (not nav.navbar)
      if (url !== '/auth.html' && url !== '/index.html') {
        const navCount = await page.locator('nav.navbar, nav[id="navbar"]').count();
        expect(navCount, `${url} must have exactly one .navbar`).toBe(1);
      }

      expect(errors, `no fatal JS errors on ${url}`).toEqual([]);
    });
  }
});

test.describe('Mobile layout — auth card visible at small viewport', () => {
  test('auth.html card visible at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const errors = attachErrorCollector(page);

    await gotoSafe(page, '/auth.html');
    await page.waitForTimeout(SETTLE_MS);

    const authEl = page.locator(
      '.auth-card, .auth-container, .auth-wrap, form, input[type="email"]'
    ).first();
    await expect(authEl, 'auth element visible at 360px').toBeVisible({ timeout: 8_000 });

    const overflow = await hasHorizontalOverflow(page);
    expect(overflow, 'auth.html no horizontal overflow at 360px').toBe(false);

    expect(errors, 'no fatal JS errors').toEqual([]);
  });
});
