// Read-only map sidebar tests against a local emulator build with baseline seed.
// No Auth/Firestore writes, seed, resets, or production access are performed.
//   node web/tools/e2e-map-resize.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';

const BASE = process.env.MAP_TEST_URL || 'http://127.0.0.1:5173';
const PLACE = 'pl_gergeti';
const KEY = 'gh.map.sidebar.v1';
const HANDLE = '[data-testid="map-sidebar-resizer"]';
const local = (hostname) => ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname);
if (!local(new URL(BASE).hostname)) throw new Error('Map resize tests require a loopback Vite URL.');
for (const [key, fallback] of [['FIRESTORE_EMULATOR_HOST', '127.0.0.1:8085'], ['FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099']]) {
  const host = process.env[key] || fallback;
  if (!local(new URL(`http://${host}`).hostname)) throw new Error(`Refusing non-local ${key}.`);
  await fetch(`http://${host}/`).catch(() => { throw new Error(`Start local ${key} before running this test.`); });
}
const CHROME = process.env.CHROME_PATH || [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
const artifacts = fileURLToPath(new URL('../../.codex/artifacts/map-resize/', import.meta.url));
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(CHROME ? { executablePath: CHROME } : {}) });
let passed = 0;
let failed = 0;
const errors = [];

async function test(name, task) {
  try { await task(); passed++; console.log(`  ok   ${name}`); }
  catch (error) { failed++; errors.push({ name, error }); console.error(`  FAIL ${name}: ${error.message}`); }
}

async function open({ details = false, width = 1440, pref, theme = 'light' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 1000 }, reducedMotion: 'reduce', colorScheme: theme });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'basemaps.cartocdn.com' && url.pathname.endsWith('style.json')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': theme === 'dark' ? '#171d24' : '#eef3ed' } }] }) });
    }
    if (['http:', 'https:'].includes(url.protocol) && !local(url.hostname)) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await page.goto(`${BASE}/login`);
  // __gh is only exported in emulator mode. Validate it before opening any data.
  await page.waitForFunction(() => !!window.__gh, null, { timeout: 20000 });
  await page.evaluate(async ({ pref, key, theme }) => {
    if (pref !== undefined) localStorage.setItem(key, typeof pref === 'string' ? pref : JSON.stringify(pref));
    else localStorage.removeItem(key);
    (await import('/src/lib/theme.js')).setTheme(theme);
    const lib = await (await import('/src/lib/map.js')).loadMapLibre();
    const RealMap = lib.Map;
    lib.Map = class extends RealMap {
      constructor(options) { super(options); window.__resizeTestMap = this; }
    };
  }, { pref, key: KEY, theme });
  await page.evaluate(async ({ place, details }) => (await import('/src/lib/router.js')).navigate(`/map?place=${place}${details ? '&details=1' : ''}`), { place: PLACE, details });
  await expect(page.locator(details ? '.map-place-details' : '.map-place-preview')).toBeVisible();
  await page.waitForFunction((place) => {
    const map = window.__resizeTestMap;
    return map?.isStyleLoaded() && map.getSource('gh-places') && map.getFeatureState({ source: 'gh-places', id: place }).selected;
  }, PLACE);
  await page.evaluate(() => {
    const map = window.__resizeTestMap;
    map.stop(); map.jumpTo({ center: [44.61, 42.66], zoom: 13.5 });
    window.__resizeTestBefore = { map, canvas: map.getCanvas(), center: map.getCenter().toArray(), zoom: map.getZoom(), url: location.pathname + location.search };
    window.__resizeShellBefore = document.querySelector('.map-sidebar-shell');
    window.__resizeDetailsBefore = document.querySelector('.map-place-details');
  });
  return { page, context };
}

async function widthOf(page) { return Number(await page.locator(HANDLE).getAttribute('aria-valuenow')); }
async function collapsed(page, value) {
  await expect(page.locator('.map-page')).toHaveClass(value ? /is-sidebar-collapsed/ : /^(?!.*is-sidebar-collapsed)/);
  if (value) await expect(page.locator(HANDLE)).toHaveAttribute('aria-valuenow', '0');
  else assert.ok(await widthOf(page) >= 320, 'Restored sidebar is narrower than its readable minimum.');
}

async function retained(page, { details = false } = {}) {
  const state = await page.evaluate(() => {
    const before = window.__resizeTestBefore;
    const map = window.__resizeTestMap;
    return {
      map: map === before.map,
      canvas: map.getCanvas() === before.canvas && before.canvas.isConnected,
      center: map.getCenter().toArray().every((n, i) => Math.abs(n - before.center[i]) < 0.000001),
      zoom: Math.abs(map.getZoom() - before.zoom) < 0.000001,
      url: location.pathname + location.search === before.url,
      shell: document.querySelector('.map-sidebar-shell') === window.__resizeShellBefore,
      details: document.querySelector('.map-place-details') === window.__resizeDetailsBefore,
    };
  });
  assert.ok(state.map && state.canvas && state.center && state.zoom && state.url && state.shell, JSON.stringify(state));
  if (details) assert.ok(state.details, 'Collapsing unmounted the expanded place details.');
}

async function geometry(page) {
  return page.evaluate((selector) => {
    const shell = document.querySelector('.map-sidebar-shell').getBoundingClientRect();
    const grip = document.querySelector(selector).getBoundingClientRect();
    const mapPage = document.querySelector('.map-page').getBoundingClientRect();
    const stage = document.querySelector('.map-stage').getBoundingClientRect();
    return {
      shell: { x: shell.x, right: shell.right, y: shell.y, width: shell.width, height: shell.height },
      grip: { x: grip.x, y: grip.y, width: grip.width, height: grip.height },
      containerWidth: mapPage.width, mapWidth: stage.width, viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth,
    };
  }, HANDLE);
}

async function dragTo(page, clientX) {
  const grip = await page.locator(HANDLE).boundingBox();
  assert.ok(grip, 'Resize handle has no bounding box.');
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(clientX, grip.y + grip.height / 2, { steps: 18 });
  await page.mouse.up();
}

async function expanded(page) {
  if (await page.locator('.map-page.is-sidebar-collapsed').count()) await page.locator(HANDLE).click();
  await collapsed(page, false);
}

try {
  for (const details of [false, true]) {
    const variant = details ? 'place details' : 'map results';
    const { page, context } = await open({ details });
    try {
      await test(`${variant}: accessible handle is centered on the panel edge`, async () => {
        const handle = page.locator(HANDLE);
        await expect(handle).toBeVisible();
        await expect(handle).toHaveAttribute('role', 'separator');
        await expect(handle).toHaveAttribute('aria-orientation', 'vertical');
        const g = await geometry(page);
        assert.ok(Math.abs(g.shell.y + g.shell.height / 2 - (g.grip.y + g.grip.height / 2)) < 3, 'Handle is not halfway down the panel.');
        assert.ok(Math.abs(g.shell.right - (g.grip.x + g.grip.width / 2)) < 28, 'Handle is not on the sidebar edge.');
        assert.ok(Math.abs(g.shell.width - await widthOf(page)) < 2, 'ARIA width does not match the rendered sidebar.');
      });

      await test(`${variant}: click collapse and restore retain map and content state`, async () => {
        if (details) {
          await page.locator('.map-place-details [data-section="photos"]').click();
          await expect(page.locator('.map-place-details [data-section="photos"]')).toHaveAttribute('aria-pressed', 'true');
          await page.locator('.map-detail-scroll').evaluate((el) => { window.__resizeScrollBefore = el.scrollTop; });
        }
        const before = await geometry(page);
        const oldWidth = await widthOf(page);
        await page.locator(HANDLE).click();
        await collapsed(page, true);
        const shell = page.locator('.map-sidebar-shell');
        assert.equal(await shell.count(), 1);
        assert.ok(await shell.evaluate((el) => el.inert), 'Collapsed sidebar is not inert.');
        await expect(page.locator(HANDLE)).toBeVisible();
        assert.ok((await geometry(page)).mapWidth > before.mapWidth + oldWidth - 5, 'Collapsing did not give the space back to the map.');
        await retained(page, { details });
        await page.locator(HANDLE).click();
        await collapsed(page, false);
        assert.ok(Math.abs(await widthOf(page) - oldWidth) < 2, 'Restore forgot the previous width.');
        if (details) {
          await expect(page.locator('.map-place-details [data-section="photos"]')).toHaveAttribute('aria-pressed', 'true');
          assert.ok(await page.locator('.map-detail-scroll').evaluate((el) => Math.abs(el.scrollTop - window.__resizeScrollBefore) < 2), 'Restore lost the previous detail scroll position.');
        }
        await retained(page, { details });
      });

      await test(`${variant}: drag widens and narrows without navigation`, async () => {
        await expanded(page);
        const before = await widthOf(page);
        const g = await geometry(page);
        await dragTo(page, g.shell.right + 170);
        await collapsed(page, false);
        const wider = await widthOf(page);
        assert.ok(wider >= before + 100, `Drag did not widen: ${before} → ${wider}`);
        await retained(page, { details });
        await dragTo(page, (await geometry(page)).shell.right - 120);
        assert.ok(await widthOf(page) <= wider - 80, 'Dragging left did not narrow the sidebar.');
        assert.ok(await widthOf(page) >= 320);
        await retained(page, { details });
      });

      await test(`${variant}: dragging fully left closes; dragging reopen handle restores`, async () => {
        await dragTo(page, 0);
        await collapsed(page, true);
        await retained(page, { details });
        await expect(page.locator(HANDLE)).toBeVisible();
        await dragTo(page, 510);
        await collapsed(page, false);
        assert.ok(await widthOf(page) >= 400, 'Dragging the reopen handle did not reveal a readable sidebar.');
        await retained(page, { details });
      });

      await test(`${variant}: maximum width and smaller viewport leave the map usable`, async () => {
        await dragTo(page, 1430);
        const g = await geometry(page);
        const expectedMax = Math.min(760, g.containerWidth - 360);
        assert.ok(Math.abs(await widthOf(page) - expectedMax) < 3, 'Drag exceeded or failed to reach the maximum width.');
        await page.setViewportSize({ width: 1100, height: 1000 });
        await expect.poll(() => widthOf(page)).toBeLessThanOrEqual(740);
        const small = await geometry(page);
        assert.ok(small.mapWidth >= 359, 'Resizing left less than 360 pixels for the map.');
        assert.ok(small.documentWidth <= small.viewportWidth + 1, 'Resizing caused horizontal document overflow.');
        await retained(page, { details });
        await page.setViewportSize({ width: 1440, height: 1000 });
      });

      await test(`${variant}: keyboard collapse, restore, arrows and maximum width`, async () => {
        const handle = page.locator(HANDLE);
        await handle.focus();
        await page.keyboard.press('Home');
        await collapsed(page, true);
        await expect(handle).toBeFocused();
        await page.keyboard.press('Enter');
        await collapsed(page, false);
        await page.keyboard.press('ArrowLeft');
        const narrower = await widthOf(page);
        await page.keyboard.press('ArrowRight');
        assert.ok(await widthOf(page) > narrower, 'ArrowRight did not increase the sidebar width.');
        await page.keyboard.press('End');
        assert.ok(Math.abs(await widthOf(page) - 760) < 2);
        await retained(page, { details });
        await page.screenshot({ path: join(artifacts, `map-resize-${details ? 'details' : 'results'}-wide.png`) });
      });

      await test(`${variant}: width and collapsed preference survive reload`, async () => {
        await dragTo(page, 610);
        const rememberedWidth = await widthOf(page);
        await page.locator(HANDLE).click();
        await collapsed(page, true);
        const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
        assert.equal(stored.collapsed, true);
        assert.ok(Math.abs(stored.width - rememberedWidth) < 2);
        const url = page.url();
        await page.reload();
        await page.waitForFunction(() => !!window.__gh);
        await expect(page.locator(HANDLE)).toBeVisible();
        await collapsed(page, true);
        assert.equal(page.url(), url);
        await page.locator(HANDLE).click();
        await collapsed(page, false);
        assert.ok(Math.abs(await widthOf(page) - rememberedWidth) < 2, 'Reload forgot the saved readable width.');
        if (details) await expect(page.locator('.map-place-details')).toBeVisible();
      });
    } finally { await context.close(); }
  }

  await test('mobile keeps its existing map layout and navigation without a resize handle', async () => {
    const { page, context } = await open({ details: true, width: 390, pref: { width: 700, collapsed: true } });
    try {
      await expect(page.locator(HANDLE)).toHaveCount(0);
      await expect(page.locator('.map-place-details')).toBeVisible();
      await expect(page.locator('.bottomnav')).toBeVisible();
      assert.deepEqual(await page.locator('.bottomnav a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))), ['/', '/explore', '/marketplace', '/menu']);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    } finally { await context.close(); }
  });

  await test('malformed saved preferences recover to a usable sidebar in dark mode', async () => {
    const { page, context } = await open({ pref: '{not-json', theme: 'dark' });
    try {
      await collapsed(page, false);
      assert.ok(await widthOf(page) <= 760);
      await expect(page.locator(HANDLE)).toBeVisible();
      await page.screenshot({ path: join(artifacts, 'map-resize-dark.png') });
    } finally { await context.close(); }
  });
} finally {
  await browser.close();
}

console.log(`\nMap sidebar resize: ${passed} passed, ${failed} failed.`);
for (const { name, error } of errors) console.error(`\n${name}\n${error.stack}`);
process.exitCode = failed ? 1 : 0;
