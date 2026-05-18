// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * GeoHub Playwright configuration.
 * Static PWA — tests run against a local http-server.
 * Firebase calls go to real endpoints; unauthenticated permission-denied
 * errors are expected and filtered in the tests.
 */
module.exports = defineConfig({
  testDir: './tests/e2e',

  /* Each test file has at most one browser tab open at a time */
  fullyParallel: true,

  /* Retry once everywhere — handles flaky timing under parallel load */
  retries: 1,

  /* Single worker on CI; parallel locally */
  workers: process.env.CI ? 1 : undefined,

  /* Page-load timeout — generous because Firebase SDK loads from CDN */
  timeout: 30_000,

  /* Expect timeout for individual assertions */
  expect: { timeout: 8_000 },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: 'http://localhost:8080',
    /* Capture trace on the first retry so failures are diagnosable */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-390',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-360',
      use: {
        browserName: 'chromium',
        viewport: { width: 360, height: 740 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet-768',
      use: {
        browserName: 'chromium',
        viewport: { width: 768, height: 1024 },
        isMobile: false,
      },
    },
  ],

  /* Start a local static-file server before tests; reuse if already running locally */
  webServer: {
    command: 'npx http-server . --port 8080 -c-1 --cors -s',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
