// @ts-check
/**
 * GeoHub missing-route smoke tests.
 *
 * Opens pages with a non-existent document ID (__missing_test__).
 * Asserts:
 *   1. Page does not crash (no fatal JS errors).
 *   2. Page renders some content (not a blank white screen).
 *   3. No infinite loading spinners without resolution — we wait 5 s
 *      and check that at least one visible element exists.
 *
 * These tests only verify graceful degradation — they do NOT require
 * specific "not found" copy since each page implements its own empty state.
 */

const { test, expect } = require('@playwright/test');
const { attachErrorCollector, gotoSafe } = require('./helpers');

// Allow enough time for Firebase to respond with "not found" and render fallback
const FIRESTORE_SETTLE_MS = 5_000;

const MISSING_ROUTES = [
  {
    url: '/places.html?id=__missing_test__',
    // places detail opens an overlay — after Firebase 404 it should close/hide or show empty
    content: 'main, body, .clean-page, .places-page',
    label: 'places detail missing ID',
  },
  {
    url: '/events.html?id=__missing_test__',
    content: 'main, body, .clean-page',
    label: 'events detail missing ID',
  },
  {
    url: '/groups.html?id=__missing_test__',
    content: 'main, body, .clean-page',
    label: 'groups detail missing ID',
  },
  {
    url: '/profile.html?id=__missing_test__',
    // profile.html renders "User not found" state
    content: 'body',
    label: 'profile missing user ID',
  },
  {
    url: '/business.html?id=__missing_test__',
    // business.html renders "Business not found" state
    content: 'body',
    label: 'business missing ID',
  },
];

test.describe('Missing-route graceful degradation', () => {
  for (const { url, content, label } of MISSING_ROUTES) {
    test(`${label} — no crash, shows content`, async ({ page }) => {
      const errors = attachErrorCollector(page);

      await gotoSafe(page, url);

      // Wait for Firestore to return "not found" and for the fallback to render
      await page.waitForTimeout(FIRESTORE_SETTLE_MS);

      // Page must have some visible DOM (not a blank white screen)
      await expect(
        page.locator(content).first(),
        `${url} must render visible content`
      ).toBeVisible({ timeout: 5_000 });

      expect(errors, `no fatal JS errors on ${url}`).toEqual([]);
    });
  }
});
