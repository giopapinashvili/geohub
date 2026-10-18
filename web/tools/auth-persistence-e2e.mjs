// Real Firebase Auth emulator sessions, in isolated browser profiles only.
// Start `npm run dev:emulator -- --port 5177`, emulators and seed-emulator first.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';

const BASE = process.env.AUTH_TEST_URL || 'http://127.0.0.1:5177';
if (!['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname)) throw new Error('Local emulator URL required.');
const artifactDir = fileURLToPath(new URL(`../../.codex/artifacts/auth-persistence-${Date.now()}/`, import.meta.url));
mkdirSync(artifactDir, { recursive: true });
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(existsSync);
const results = [];
const errors = [];
let context;
let page;
async function launch(name, blocked = '') {
  context = await chromium.launchPersistentContext(`${artifactDir}/${name}`, { executablePath, headless: true, viewport: { width: 1100, height: 800 } });
  if (blocked) await context.addInitScript((mode) => {
    Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('Blocked for emulator storage test', 'SecurityError'); } });
    if (mode === 'all') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked for emulator storage test', 'SecurityError'); } });
  }, blocked);
  page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
}
async function close() { await context.close(); context = null; }
async function open(path = '/login') {
  await page.goto(`${BASE}${path}`);
  await page.waitForFunction(() => window.__gh && window.__gh.authUser.value !== undefined);
  assert.equal(await page.evaluate(() => window.__gh.emulator), true);
}
async function mode() { return page.evaluate(() => window.__gh.authPersistence.value); }
async function signedIn() { await page.waitForFunction(() => window.__gh?.authUser.value?.uid === 'u_nino'); }
async function signIn() {
  await page.locator('input[type=email]').fill('nino@test.ge');
  await page.locator('#login-pass').fill('geohub123');
  await page.locator('.auth-form button[type=submit]').click();
  await signedIn();
}
async function step(name, run) { await run(); results.push(name); console.log(`PASS ${name}`); }
try {
  await step('Fresh profile logs in through form with durable IndexedDB storage', async () => {
    await launch('durable'); await open('/login?next=%2Fsettings');
    assert.equal(await mode(), 'indexeddb');
    await signIn(); await expect(page).toHaveURL(`${BASE}/settings`);
    await close();
  });
  await step('Closing the whole browser and reopening same profile restores protected route', async () => {
    await launch('durable'); await open('/settings'); await signedIn();
    await expect(page).toHaveURL(`${BASE}/settings`);
    await page.reload(); await signedIn(); await expect(page).toHaveURL(`${BASE}/settings`);
  });
  await step('Firestore profile requests failing do not remove Firebase authentication', async () => {
    await context.route('http://127.0.0.1:8085/**', (route) => route.abort('failed'));
    await page.reload(); await signedIn();
    await expect(page).toHaveURL(`${BASE}/settings`);
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => window.__gh.authUser.value?.uid), 'u_nino');
    await context.unroute('http://127.0.0.1:8085/**');
  });
  await step('Explicit logout finishes offline without waiting for a queued presence write', async () => {
    await context.setOffline(true);
    const elapsed = await page.evaluate(async () => {
      const start = performance.now();
      await Promise.race([window.__gh.signOut(), new Promise((_, reject) => setTimeout(() => reject(new Error('Logout blocked by offline Firestore')), 2500))]);
      return performance.now() - start;
    });
    assert.ok(elapsed < 2500);
    await page.waitForFunction(() => window.__gh.authUser.value === null);
    await close();
  });
  await step('Explicit logout stays logged out after reopening browser', async () => {
    await launch('durable'); await open('/settings');
    assert.equal(await page.evaluate(() => window.__gh.authUser.value), null);
    await expect(page).toHaveURL(new RegExp('/login\\?next=')); await close();
  });
  await step('Blocked IndexedDB falls back to durable localStorage across browser restart', async () => {
    await launch('local', 'indexeddb'); await open(); assert.equal(await mode(), 'local');
    await signIn(); await close();
    await launch('local', 'indexeddb'); await open('/settings'); await signedIn();
    assert.equal(await mode(), 'local'); await close();
  });
  await step('Blocked durable storage honestly uses temporary memory session', async () => {
    await launch('memory', 'all'); await open(); assert.equal(await mode(), 'memory');
    await expect(page.getByRole('status').filter({ hasText: 'ბრაუზერში მონაცემების შენახვა დაბლოკილია' })).toBeVisible();
    await signIn(); await page.reload();
    await page.waitForFunction(() => window.__gh && window.__gh.authUser.value === null);
    assert.equal(await mode(), 'memory'); await close();
  });
  assert.deepEqual(errors, [], 'Uncaught browser errors');
  writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(`PASS ${results.length} auth persistence scenarios; ${artifactDir}`);
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: `${artifactDir}/failure.png`, fullPage: true }).catch(() => {});
  writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, failure: error.message }, null, 2));
  throw error;
} finally { if (context) await close(); }
