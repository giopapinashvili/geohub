/**
 * Shared helpers for GeoHub Playwright smoke tests.
 */

/**
 * Returns true if a browser console error / uncaught exception text represents
 * a real bug in GeoHub's own code that should fail the test.
 *
 * Ignored (expected when unauthenticated):
 *   - Firebase permission-denied / auth errors
 *   - Service Worker lifecycle messages
 *   - CDN / CORS / net:: network errors (transient in CI)
 *   - Google reCAPTCHA / analytics noise
 *
 * Failing:
 *   - ReferenceError / TypeError / SyntaxError from our JS
 *   - "is not a function" / "is not defined" / "Cannot read"
 */
function isFatalError(text) {
  if (!text) return false;

  // --- Ignore list -------------------------------------------------------
  const ignore = [
    // Firebase expected errors for unauthenticated sessions
    'permission-denied',
    'Missing or insufficient permissions',
    'FirebaseError',
    'auth/network-request-failed',
    'auth/too-many-requests',
    'auth/user-not-found',
    'PERMISSION_DENIED',
    // Stripe (not loaded in tests)
    'stripe',
    'Stripe',
    // Service worker lifecycle
    '[SW]',
    'serviceWorker',
    'service_worker',
    // Network / CDN (transient in CI)
    'net::ERR_',
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    // Third-party scripts
    'recaptcha',
    'gtag',
    'analytics',
    // FCM / push (not available without a real subscription)
    'messaging',
    'push',
    'Notification',
    // Content Security Policy
    'Content Security Policy',
    // ResizeObserver — browser quirk, not a real error
    'ResizeObserver loop',
  ];
  const lower = text.toLowerCase();
  if (ignore.some(s => lower.includes(s.toLowerCase()))) return false;

  // --- Fail list ---------------------------------------------------------
  const fatal = [
    'ReferenceError',
    'TypeError',
    'SyntaxError',
    'EvalError',
    'RangeError',
    'is not a function',
    'is not defined',
    'Cannot read propert',   // "Cannot read properties of …"
    'Cannot set propert',
    'undefined is not',
    'null is not',
    'Uncaught',
  ];
  return fatal.some(s => text.includes(s));
}

/**
 * Attaches console-error and pageerror collectors to a page.
 * Returns the shared errors array — inspect it after navigation.
 */
function attachErrorCollector(page) {
  const errors = [];
  page.on('pageerror', err => {
    if (isFatalError(err.message)) errors.push('[pageerror] ' + err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (isFatalError(text)) errors.push('[console.error] ' + text);
    }
  });
  return errors;
}

/**
 * Navigate to a URL and wait for DOM to be ready.
 * Allows navigation failures (e.g. redirect loops) without crashing the test.
 */
async function gotoSafe(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  } catch {
    // A navigation away (redirect to auth.html) triggers this — still OK.
  }
}

/**
 * Check that the page has no horizontal overflow.
 * Returns true if scrollWidth > clientWidth.
 */
async function hasHorizontalOverflow(page) {
  return page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth > el.clientWidth + 2; // +2px tolerance
  });
}

module.exports = { isFatalError, attachErrorCollector, gotoSafe, hasHorizontalOverflow };
