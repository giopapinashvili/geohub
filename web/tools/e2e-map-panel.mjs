// Local-emulator browser coverage for the map's compact and expanded place cards.
// Run after starting Auth/Firestore and Vite in emulator mode:
//   node web/tools/e2e-map-panel.mjs
//   node web/tools/e2e-map-panel.mjs --auth-only
// It adds and deletes only its own uniquely named fixtures in demo-geohub.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const BASE = process.env.MAP_TEST_URL || 'http://127.0.0.1:5173';
const PROJECT = 'demo-geohub';
const AUTH_ONLY = process.argv.includes('--auth-only');
const local = (hostname) => ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname);
if (!local(new URL(BASE).hostname)) throw new Error('Map panel tests require a loopback Vite URL.');
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  if (!local(new URL(`http://${process.env[key]}`).hostname)) throw new Error(`Refusing non-local ${key}.`);
}
if (!(await fetch(`${BASE}/src/lib/firebase.js`).then((r) => r.text())).includes('demo-geohub')) {
  throw new Error('Expected the local Vite source server.');
}
await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/`).catch(() => { throw new Error('Start the local Firestore emulator first.'); });
await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/`).catch(() => { throw new Error('Start the local Auth emulator first.'); });

const CHROME = process.env.CHROME_PATH || [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
const app = initializeApp({ projectId: PROJECT }, `map-panel-${Date.now()}`);
const db = getFirestore(app);
const auth = getAuth(app);
const fixturePrefix = `qa_map_${Date.now()}`;
const ids = { place: `${fixturePrefix}_a`, empty: `${fixturePrefix}_b`, user: `${fixturePrefix}_user`, business: `${fixturePrefix}_business` };
const fixtureDocs = [];
const artifacts = fileURLToPath(new URL('../../.codex/artifacts/map-panel/', import.meta.url));
mkdirSync(artifacts, { recursive: true });
let browser;
let authFixture = false;
let passed = 0;
let failed = 0;
const errors = [];
const now = Date.now();
const ts = (delta) => Timestamp.fromMillis(now + delta);
const hour = 3600000;
const text = {
  name: 'QA რუკის კაფე', empty: 'QA მშვიდი ადგილი',
  description: 'მყუდრო სივრცე ყავისა და შეხვედრებისთვის. მეორე წინადადება ვრცელი აღწერის შესამოწმებლად.',
  review: 'QA რუკის შეფასება — ძალიან სასიამოვნო გარემოა.',
  recent: 'QA ახლანდელი სტუმარი', old: 'QA ძველი სტუმარი', story: 'QA ადგილის სთორი', expired: 'QA ვადაგასული სთორი',
};

async function seed() {
  const batch = db.batch();
  const put = (path, data) => { fixtureDocs.push(path); batch.set(db.doc(path), data); };
  put(`users/${ids.user}`, { fullName: 'QA რუკის ავტორი', displayName: 'QA რუკის ავტორი', avatar: '/fixtures/avatar-1.png', isFirebaseUser: true, geoId: 98765 });
  put(`businesses/${ids.business}`, { name: text.name, ownerId: ids.user, category: 'cafes', status: 'active', logo: '/fixtures/avatar-1.png' });
  for (const [id, name, populated] of [[ids.place, text.name, true], [ids.empty, text.empty, false]]) {
    put(`places/${id}`, {
      name, title: name, description: populated ? text.description : '', category: 'food', categoryId: 'food',
      city: 'თბილისი', address: 'QA მისამართი 12', lat: 41.705, lng: 44.79 + (populated ? 0 : 0.002),
      coverImage: populated ? '/fixtures/photo-1.png' : '', photos: populated ? ['/fixtures/photo-2.png', '/fixtures/photo-3.png'] : [],
      rating: populated ? 5 : 0, reviewCount: populated ? 1 : 0, checkinCount: populated ? 2 : 0,
      status: 'active', creatorId: ids.user, businessId: populated ? ids.business : '', createdAt: ts(-30 * hour),
      phone: populated ? '+995 555 123 456' : '', website: populated ? 'https://example.com' : '',
    });
  }
  put(`placeReviews/${fixturePrefix}_review`, { placeId: ids.place, userId: ids.user, userName: 'QA რუკის ავტორი', userPhoto: '/fixtures/avatar-1.png', rating: 5, comment: text.review, createdAt: ts(-hour) });
  for (const [key, ago, name] of [['recent', 10 * 60000, text.recent], ['old', 72 * hour, text.old]]) {
    put(`checkins/${fixturePrefix}_${key}`, {
      placeId: ids.place, placeName: text.name, userId: `${ids.user}_${key}`, authorId: `${ids.user}_${key}`,
      authorName: name, authorAvatar: '/fixtures/avatar-2.png', caption: `${name} — QA ჩექინი`,
      photoUrl: '/fixtures/photo-4.png', visibility: 'public', createdAt: ts(-ago),
    });
  }
  for (const [key, expiresAt, caption] of [['story', ts(hour), text.story], ['expired', ts(-hour), text.expired]]) {
    put(`stories/${fixturePrefix}_${key}`, {
      placeId: ids.place, businessId: ids.business, authorType: 'business', authorId: ids.user, userId: ids.user,
      authorName: text.name, authorAvatar: '/fixtures/avatar-1.png', mediaUrl: '/fixtures/tall-1.png', text: caption,
      closeFriends: false, viewedBy: [], viewCount: 0, createdAt: ts(-2 * hour), expiresAt,
    });
  }
  await batch.commit();
}

async function test(name, task) {
  try { await task(); passed++; console.log(`  ok   ${name}`); }
  catch (error) { failed++; errors.push({ name, error }); console.error(`  FAIL ${name}: ${error.message}`); }
}

async function open(width, { failReviews = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 1000 }, reducedMotion: 'reduce' });
  // All fixtures and Firebase data stay local. The basemap is deliberately
  // deterministic so a third-party tile/font outage cannot make this test flaky.
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'basemaps.cartocdn.com' && url.pathname.endsWith('style.json')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f1f4ee' } }] }) });
    }
    if (['http:', 'https:'].includes(url.protocol) && !local(url.hostname)) return route.abort();
    return route.continue();
  });
  if (failReviews) {
    // Inject a denied read at the data-layer boundary. Changing emulator rules
    // globally would interfere with other suites, and dropping network packets
    // makes Firestore retry instead of returning an authorization error.
    await context.route('**/src/data/places.js*', async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const signature = 'export function listenPlaceReviews(';
      assert.ok(source.includes(signature), 'Could not inject the review read failure.');
      const replacement = source.replace(signature, 'function originalListenPlaceReviews(')
        + '\nlet qaReviewFailure = true; export function listenPlaceReviews(placeId, onData, onError) { if (!qaReviewFailure) return originalListenPlaceReviews(placeId, onData, onError); qaReviewFailure = false; const e = new Error("QA permission denied"); e.code = "permission-denied"; queueMicrotask(() => onError?.(e)); return () => {}; }\n';
      await route.fulfill({ response, body: replacement });
    });
  }
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await page.goto(`${BASE}/login`);
  await page.waitForFunction(() => !!window.__gh, null, { timeout: 20000 });
  // Load MapLibre before the map route and keep the actual map instance in the
  // browser test, without adding a production-only testing hook to the app.
  await page.evaluate(async () => {
    const lib = await (await import('/src/lib/map.js')).loadMapLibre();
    const RealMap = lib.Map;
    lib.Map = class extends RealMap {
      constructor(options) { super(options); window.__mapPanelTestMap = this; }
    };
  });
  await page.evaluate(async (place) => (await import('/src/lib/router.js')).navigate(`/map?place=${place}`), ids.place);
  await expect(page.locator('.map-place-preview')).toContainText(text.name);
  await page.waitForFunction((place) => {
    const map = window.__mapPanelTestMap;
    return map?.isStyleLoaded() && map.getSource('gh-places') && map.getFeatureState({ source: 'gh-places', id: place }).selected;
  }, ids.place);
  await page.evaluate(() => {
    const map = window.__mapPanelTestMap;
    map.stop(); map.jumpTo({ center: [44.792, 41.706], zoom: 14.5 });
    window.__mapPanelCanvas = map.getCanvas();
    window.__mapPanelBefore = { center: map.getCenter().toArray(), zoom: map.getZoom() };
  });
  return { context, page };
}

async function assertMapRetained(page) {
  assert.deepEqual(await page.evaluate(() => {
    const map = window.__mapPanelTestMap;
    return {
      sameCanvas: map.getCanvas() === window.__mapPanelCanvas,
      sameCenter: map.getCenter().toArray().every((n, i) => Math.abs(n - window.__mapPanelBefore.center[i]) < 0.000001),
      sameZoom: Math.abs(map.getZoom() - window.__mapPanelBefore.zoom) < 0.000001,
      path: location.pathname,
    };
  }), { sameCanvas: true, sameCenter: true, sameZoom: true, path: '/map' });
  assert.equal(new URL(page.url()).searchParams.get('place'), ids.place);
}

async function expand(page) {
  const preview = page.locator('.map-place-preview');
  await preview.getByTestId('map-place-expand').click();
  await expect(page.locator('.map-place-details')).toBeVisible();
  assert.equal(new URL(page.url()).searchParams.get('details'), '1');
}

async function section(page, name) {
  await page.locator(`.map-place-details [data-section="${name}"]`).click();
  const target = page.locator(`.map-place-details [data-map-section="${name}"]`);
  await expect(target).toBeVisible();
  return target;
}

async function capture(page, width, state) {
  if (width === 320) return;
  if (state === 'expanded') {
    await expect(page.locator('.map-place-details .map-detail-loading')).toHaveCount(0);
    await page.locator('.map-detail-scroll').evaluate((el) => { el.scrollTop = 0; });
  }
  await page.screenshot({ path: join(artifacts, `map-place-${width}-${state}.png`) });
}

async function tabContained(page, selector) {
  await page.locator(selector).evaluate((root) => {
    const items = [...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter((el) => el.getClientRects().length);
    items.at(-1)?.focus();
  });
  await page.keyboard.press('Tab');
  assert.ok(await page.locator(selector).evaluate((el) => el.contains(document.activeElement)), 'Tab escaped the active viewer.');
}

try {
  browser = await chromium.launch({ headless: true, ...(CHROME ? { executablePath: CHROME } : {}) });
  // Validate the mode before creating any fixtures, even on a local source server.
  const probe = await browser.newPage();
  await probe.goto(`${BASE}/login`);
  await probe.waitForFunction(() => !!window.__gh, null, { timeout: 15000 });
  await probe.close();
  await seed();

  for (const width of AUTH_ONLY ? [] : [320, 390, 1440]) {
    const { page, context } = await open(width);
    await test(`${width}px: compact card has description and direct page link`, async () => {
      const preview = page.locator('.map-place-preview');
      await expect(preview).toContainText('მყუდრო სივრცე');
      const link = preview.getByTestId('map-place-page');
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('href', `/place/${ids.place}`);
      await expect(link).toHaveAttribute('target', '_blank');
      await capture(page, width, 'compact');
    });
    await test(`${width}px: expanding and closing preserve map and URL`, async () => {
      await expand(page);
      await assertMapRetained(page);
      const links = page.locator('.map-place-details').getByTestId('map-place-page');
      assert.ok(await links.count() >= 1, 'Expanded card has no direct page link.');
      for (const link of await links.all()) {
        await expect(link).toHaveAttribute('href', `/place/${ids.place}`);
        await expect(link).toHaveAttribute('target', '_blank');
      }
      await page.getByTestId('map-details-close').click();
      await expect(page.locator('.map-place-details')).toHaveCount(0);
      assert.equal(new URL(page.url()).searchParams.get('details'), null);
      await expect(page.locator('.map-place-preview')).toBeVisible();
      await assertMapRetained(page);
      const pin = page.locator('.map-selected-pin[role="button"]');
      await expect(pin).toBeVisible();
      await expect(pin).toHaveAttribute('aria-label', new RegExp(text.name));
      await pin.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.map-place-details')).toBeVisible();
      await assertMapRetained(page);
      await page.getByTestId('map-details-close').click();
    });
    await test(`${width}px: panel fits and preserves GeoHub navigation`, async () => {
      await expand(page);
      const geometry = await page.locator('.map-place-details').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth };
      });
      assert.ok(geometry.left >= -1 && geometry.right <= geometry.width + 1, JSON.stringify(geometry));
      assert.ok(geometry.top >= -1 && geometry.bottom <= geometry.height + 1, 'The panel extends beyond the viewport.');
      assert.ok(geometry.pageWidth <= geometry.width + 1, 'The document has horizontal overflow.');
      if (width < 800) {
        const nav = page.locator('.bottomnav');
        await expect(nav).toBeVisible();
        assert.deepEqual(await nav.locator('a').evaluateAll((nodes) => nodes.map((a) => a.getAttribute('href'))), ['/', '/explore', '/marketplace', '/menu']);
        await expect(nav.locator('button.bottomnav-create')).toHaveCount(1);
        const navTop = await nav.evaluate((el) => el.getBoundingClientRect().top);
        assert.ok(geometry.bottom <= navTop + 1, 'Expanded details cover the existing bottom navigation.');
      }
      await capture(page, width, 'expanded');
    });
    await test(`${width}px: actual public reviews, recent checkins and page stories are shown`, async () => {
      const panel = page.locator('.map-place-details');
      await section(page, 'reviews');
      await expect(panel).toContainText(text.review);
      await section(page, 'checkins');
      await expect(panel).toContainText(text.recent);
      const recent = panel.locator('[data-testid="map-recent-checkins"]');
      await expect(recent).toContainText(text.recent);
      await expect(recent).not.toContainText(text.old);
      await section(page, 'stories');
      await expect(panel.locator('[data-map-section="stories"] .map-detail-story-card')).toHaveCount(1);
      await expect(panel).not.toContainText(text.expired);
      await panel.locator('[data-map-section="stories"] .map-detail-story-card').first().click();
      await expect(page.locator('.story-viewer')).toBeVisible();
      await expect(page.locator('.story-viewer')).toContainText(text.story);
      await expect(page.locator('.story-viewer')).not.toContainText(text.expired);
      await expect(page.locator('.story-controls').getByRole('button', { name: 'დახურვა', exact: true })).toBeFocused();
      await tabContained(page, '.story-viewer');
      await page.keyboard.press('Escape');
      await expect(page.locator('.story-viewer')).toHaveCount(0);
      await expect(panel).toBeVisible();
    });
    await test(`${width}px: Escape closes a photo before collapsing place details`, async () => {
      const photos = await section(page, 'photos');
      await photos.locator('.map-detail-photo-grid button').first().click();
      await expect(page.locator('.lightbox')).toBeVisible();
      await expect(page.locator('.lightbox-close')).toBeFocused();
      await tabContained(page, '.lightbox');
      await page.keyboard.press('Escape');
      await expect(page.locator('.lightbox')).toHaveCount(0);
      await expect(page.locator('.map-place-details')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.map-place-details')).toHaveCount(0);
      await assertMapRetained(page);
    });
    await test(`${width}px: another place clears previous reviews, checkins and stories`, async () => {
      await page.evaluate(async (place) => (await import('/src/lib/router.js')).setQuery({ place }), ids.empty);
      await expect(page.locator('.map-place-preview')).toContainText(text.empty);
      await expand(page);
      const panel = page.locator('.map-place-details');
      await expect(panel).not.toContainText(text.review);
      await expect(panel).not.toContainText(text.recent);
      for (const name of ['reviews', 'checkins', 'stories']) {
        const content = await section(page, name);
        await expect(content.locator('.empty')).toBeVisible();
      }
      await expect(panel).not.toContainText(text.name);
    });
    await context.close();
  }
  if (!AUTH_ONLY) await test('a denied review read shows an error rather than a false empty state', async () => {
    const { page, context } = await open(390, { failReviews: true });
    try {
      await expand(page);
      const reviews = await section(page, 'reviews');
      await expect(reviews.getByTestId('map-section-error')).toBeVisible();
      await expect(reviews.locator('.empty')).toHaveCount(0);
      await expect(reviews).not.toContainText(text.review);
      await reviews.getByTestId('map-section-error').getByRole('button').click();
      await expect(reviews.getByTestId('map-section-error')).toHaveCount(0);
      await expect(reviews).toContainText(text.review);
    } finally { await context.close(); }
  });

  await auth.createUser({ uid: ids.user, email: `${fixturePrefix}@test.ge`, password: 'geohub123', displayName: 'QA რუკის ავტორი', emailVerified: true });
  authFixture = true;
  const signed = await open(390);
  try {
    await signed.page.evaluate(async (email) => { await window.__gh.signIn(email, 'geohub123'); }, `${fixturePrefix}@test.ge`);
    await signed.page.waitForFunction(() => !!window.__gh.profile.value);
    await signed.page.evaluate(async (place) => (await import('/src/lib/router.js')).setQuery({ place }), ids.empty);
    await expect(signed.page.locator('.map-place-preview')).toContainText(text.empty);
    await expand(signed.page);

    await test('signed-in visitor publishes a review from the map and sees it live', async () => {
      const reviews = await section(signed.page, 'reviews');
      await reviews.getByRole('button', { name: 'შეაფასე ეს ადგილი', exact: true }).click();
      const form = reviews.locator('.map-detail-review-form');
      await form.getByRole('radio').last().click();
      await form.locator('textarea').fill('QA ავტორიზებული რუკის შეფასება');
      await form.getByRole('button', { name: 'გამოქვეყნება', exact: true }).click();
      await expect(form).toHaveCount(0);
      await expect(reviews.locator('.map-detail-review-list')).toContainText('QA ავტორიზებული რუკის შეფასება');
      await expect.poll(async () => {
        const records = await db.collection('placeReviews').where('placeId', '==', ids.empty).get();
        return records.docs.some((doc) => doc.data().userId === ids.user && doc.data().comment === 'QA ავტორიზებული რუკის შეფასება');
      }).toBe(true);
      assert.equal(new URL(signed.page.url()).pathname, '/map');
    });

    await test('signed-in visitor checks in from the open panel and appears in recent visitors', async () => {
      const panel = signed.page.locator('.map-place-details');
      await panel.locator('.map-detail-actions').getByRole('button', { name: 'ჩეკინი', exact: true }).click();
      const modal = signed.page.locator('.modal-layer .modal');
      await modal.locator('textarea').fill('QA ჩექინი პირდაპირ რუკიდან');
      await modal.locator('.switch-row').click();
      await expect(modal.getByRole('switch')).not.toBeChecked();
      await modal.getByRole('button', { name: 'ჩეკინის გაკეთება', exact: true }).click();
      await expect(modal).toHaveCount(0);
      await section(signed.page, 'checkins');
      await expect(panel).toContainText('QA ჩექინი პირდაპირ რუკიდან');
      await expect(panel.getByTestId('map-recent-checkins')).toContainText('QA რუკის ავტორი');
      const records = await db.collection('checkins').where('placeId', '==', ids.empty).get();
      assert.ok(records.docs.some((doc) => doc.data().userId === ids.user && doc.data().caption === 'QA ჩექინი პირდაპირ რუკიდან'));
    });

    await test('map story composer saves the explicit place relation; nested confirmation owns Escape', async () => {
      const stories = await section(signed.page, 'stories');
      await stories.getByRole('button', { name: 'სთორის დამატება', exact: true }).click();
      const modal = signed.page.locator('.modal-layer .modal');
      await expect(modal).toContainText(text.empty);
      await modal.locator('.story-new-choice.is-text').click();
      await modal.locator('textarea').fill('QA ახალი სთორი რუკის ადგილიდან');
      await modal.getByRole('button', { name: 'გაზიარება', exact: true }).click();
      await expect(modal).toHaveCount(0);
      await expect(stories.locator('.map-detail-story-card')).toHaveCount(1);
      const records = await db.collection('stories').where('placeId', '==', ids.empty).get();
      assert.ok(records.docs.some((doc) => doc.data().authorId === ids.user && doc.data().text === 'QA ახალი სთორი რუკის ადგილიდან'));
      await stories.locator('.map-detail-story-card').click();
      await expect(signed.page.locator('.story-viewer')).toContainText('QA ახალი სთორი რუკის ადგილიდან');
      await signed.page.locator('.story-controls button[aria-haspopup="menu"]').click();
      await signed.page.getByRole('menuitem', { name: 'სთორის წაშლა', exact: true }).click();
      await expect(signed.page.getByRole('dialog', { name: 'წავშალოთ სთორი?', exact: true })).toBeVisible();
      await signed.page.keyboard.press('Escape');
      await expect(signed.page.locator('.modal-layer')).toHaveCount(0);
      await expect(signed.page.locator('.story-viewer')).toBeVisible();
      await expect(signed.page.locator('.map-place-details')).toBeVisible();
      await signed.page.keyboard.press('Escape');
      await expect(signed.page.locator('.story-viewer')).toHaveCount(0);
      await expect(signed.page.locator('.map-place-details')).toBeVisible();
      assert.equal(new URL(signed.page.url()).pathname, '/map');
    });
  } finally { await signed.context.close(); }
} finally {
  await browser?.close();
  // Include records created through the UI, without touching any other suite's
  // fixtures. Each query is limited to this run's unique place/user identity.
  for (const name of ['placeReviews', 'checkins', 'stories']) {
    for (const placeId of [ids.place, ids.empty]) {
      const records = await db.collection(name).where('placeId', '==', placeId).get();
      for (const doc of records.docs) if (!fixtureDocs.includes(doc.ref.path)) fixtureDocs.push(doc.ref.path);
    }
  }
  fixtureDocs.push(`placeCheckins/${ids.empty}`, `users/${ids.user}/private/account`);
  const archives = await db.collection(`users/${ids.user}/storyArchive`).get();
  for (const doc of archives.docs) fixtureDocs.push(doc.ref.path);
  if (fixtureDocs.length) {
    const cleanup = db.batch();
    for (const path of fixtureDocs) cleanup.delete(db.doc(path));
    await cleanup.commit();
  }
  if (authFixture) await auth.deleteUser(ids.user);
  await deleteApp(app);
}

console.log(`\nMap place panel: ${passed} passed, ${failed} failed.`);
for (const { name, error } of errors) console.error(`\n${name}\n${error.stack}`);
process.exitCode = failed ? 1 : 0;
