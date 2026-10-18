// Real client -> local Firestore rules -> public UI. Start emulators and
// `npm run dev:emulator -- --port 5177`, then seed-emulator.mjs before this test.
import assert from 'node:assert/strict';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const BASE = process.env.COMMERCE_TEST_URL || 'http://127.0.0.1:5177';
if (!['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname)) throw new Error('Local emulator URL required.');
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
if (![process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_AUTH_EMULATOR_HOST].every((host) => /^127\.0\.0\.1:\d+$/.test(host))) throw new Error('Local emulators required.');
const app = initializeApp({ projectId: 'demo-geohub' }, `commerce-e2e-${Date.now()}`);
const db = getFirestore(app);
const prefix = `QA${Date.now().toString().slice(-6)}`;
const artifactDir = fileURLToPath(new URL('../../.codex/artifacts/commerce-e2e/', import.meta.url));
mkdirSync(artifactDir, { recursive: true });
const names = { product: `${prefix} ყავის ჭიქა`, dish: `${prefix} ხაჭაპური`, service: `${prefix} ყავის მასტერკლასი`, bundle: `${prefix} ყავა და მასტერკლასი`, unknown: `${prefix} ფასი დასაზუსტებელია` };
const errors = [];
const results = [];
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(existsSync), headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/New_York', reducedMotion: 'reduce' });
await context.route('https://commerce-qa.example/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="780"><rect width="600" height="780" fill="#eff4e8"/><text x="60" y="130" font-size="48" fill="#34513a">QA MENU</text><text x="60" y="230" font-size="30" fill="#34513a">Khachapuri - 20 GEL</text><text x="60" y="290" font-size="30" fill="#34513a">Coffee - 8 GEL</text></svg>' }));
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror', (error) => errors.push(error.message));
async function step(name, fn) { await fn(); results.push(name); console.log(`PASS ${name}`); }
async function overflow(target = page) {
  assert.equal(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'page horizontal overflow');
}
async function open(path) { await page.goto(`${BASE}${path}`); }
async function saveDialog() {
  await page.getByRole('dialog').getByRole('button', { name: 'შენახვა', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function addItem(type, title, price, extra) {
  await page.getByRole('button', { name: 'ჩანაწერის დამატება', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('ჩანაწერის ტიპი', { exact: true }).selectOption(type);
  await dialog.getByLabel('სახელი', { exact: true }).fill(title);
  await dialog.getByLabel('ფასი', { exact: true }).fill(price);
  if (extra) await extra(dialog);
  await saveDialog();
  await expect(page.locator('.commerce-list-row').filter({ hasText: title })).toHaveCount(1);
}
try {
  await step('Nino signs in through actual login form', async () => {
    await open('/login?next=%2Fbusiness%2Fb_cafe%2Fmanage%3Ftab%3Dcatalog');
    assert.equal(await page.evaluate(async () => (await import('/src/lib/firebase.js')).EMULATOR), true);
    await page.locator('input[type=email]').fill('nino@test.ge');
    await page.locator('#login-pass').fill('geohub123');
    await page.locator('.auth-form button[type=submit]').click();
    await expect(page.getByRole('button', { name: 'ჩანაწერის დამატება', exact: true })).toBeEnabled();
  });
  await step('Owner creates product, vegetarian dish with preparation time, service and mixed bundle', async () => {
    await addItem('product', names.product, '40');
    await addItem('dish', names.dish, '20', async (dialog) => {
      await dialog.getByLabel('მომზადების დრო, წუთი', { exact: true }).fill('15');
      await dialog.getByLabel('ვეგეტარიანული', { exact: true }).check();
    });
    await addItem('service', names.service, '80');
    await addItem('bundle', names.bundle, '100', async (dialog) => {
      await dialog.getByLabel(names.product, { exact: true }).check();
      await dialog.getByLabel(names.service, { exact: true }).check();
    });
    await addItem('product', names.unknown, '');
    const rows = await db.collection('commerceItems').where('businessId', '==', 'b_cafe').get();
    const dish = rows.docs.find((doc) => doc.data().title === names.dish).data();
    assert.equal(dish.priceMinor, 2000); assert.equal(dish.preparationMinutes, 15); assert.deepEqual(dish.dietaryTags, ['vegetarian']);
    const bundle = rows.docs.find((doc) => doc.data().title === names.bundle).data();
    assert.equal(bundle.bundleItemIds.length, 2); assert.equal(bundle.type, 'bundle');
    assert.equal(rows.docs.find((doc) => doc.data().title === names.unknown).data().priceMinor, null);
  });
  await step('Owner saves menu HTTPS image reference without external upload', async () => {
    await page.locator('.commerce-menu-url').getByLabel('ფოტოს HTTPS ბმული').fill(`https://commerce-qa.example/${prefix}-menu.png`);
    await page.locator('.commerce-menu-url button[type=submit]').click();
    await expect(page.locator('.commerce-menu-url').getByLabel('ფოტოს HTTPS ბმული')).toHaveValue('');
    await expect(page.locator(`.commerce-menu-photos img[src="https://commerce-qa.example/${prefix}-menu.png"]`)).toHaveCount(1);
    const saved = (await db.doc('businesses/b_cafe').get()).data().menuPhotos;
    assert.equal(saved.some((photo) => photo.url === `https://commerce-qa.example/${prefix}-menu.png`), true);
    await page.screenshot({ path: `${artifactDir}/manager-desktop.png`, fullPage: true });
  });
  await step('Owner publishes discount with Tbilisi times even from New York browser timezone', async () => {
    await open('/business/b_cafe/manage?tab=discounts');
    await page.getByRole('button', { name: 'ფასდაკლების დამატება', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const itemSnapshot = await db.collection('commerceItems').where('businessId', '==', 'b_cafe').get();
    const dish = itemSnapshot.docs.find((doc) => doc.data().title === names.dish);
    await dialog.getByLabel('აირჩიე კატალოგიდან', { exact: true }).selectOption(dish.id);
    await dialog.getByLabel('ახალი ფასი', { exact: true }).fill('15');
    const local = (ms) => new Date(ms + 4 * 3600000).toISOString().slice(0, 16);
    const starts = local(Date.now() - 3600000); const ends = local(Date.now() + 86400000);
    await dialog.getByLabel('დაწყება — თბილისის დრო', { exact: true }).fill(starts);
    await dialog.getByLabel('დასრულება — თბილისის დრო', { exact: true }).fill(ends);
    await dialog.getByLabel('პირობები', { exact: true }).fill('QA ადგილზე მიღებისას.');
    await dialog.getByRole('button', { name: 'გამოქვეყნება', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const offers = await db.collection('commerceOffers').where('businessId', '==', 'b_cafe').get();
    const created = offers.docs.find((doc) => doc.data().itemId === dish.id);
    assert.equal(created.data().startsAtMs, Date.parse(`${starts}:00+04:00`));
    assert.equal(created.data().endsAtMs, Date.parse(`${ends}:00+04:00`));
    assert.equal(created.data().originalPriceMinor, 2000); assert.equal(created.data().priceMinor, 1500);
    // Controlled edge fixtures: same real contract, only local demo database.
    await db.collection('commerceOffers').add({ ...created.data(), title: `${prefix} EXPIRED`, startsAtMs: Date.now() - 7200000, endsAtMs: Date.now() - 60000 });
    await db.collection('commerceOffers').add({ ...created.data(), title: `${prefix} SCHEDULED`, startsAtMs: Date.now() + 3600000, endsAtMs: Date.now() + 7200000 });
    await db.collection('commerceItems').add({ ...dish.data(), title: `${prefix} DEMO`, isDemo: true, demoBatchId: prefix, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await db.doc('businesses/b_cafe').update({ logoUrl: 'https://commerce-qa.example/logo.png', placeId: 'pl_fabrika' });
    await db.doc('places/pl_fabrika').update({ businessId: 'b_cafe', category: 'cafe', categoryId: 'cafe' });
  });
  await page.evaluate(() => window.__gh.signOut());
  await step('Public discount feed filters actual items and hides expired and future deals', async () => {
    await open('/discounts');
    await expect(page.locator('.deal-card').filter({ hasText: names.dish })).toHaveCount(1);
    await expect(page.locator('.deal-card').filter({ hasText: 'EXPIRED' })).toHaveCount(0);
    await expect(page.locator('.deal-card').filter({ hasText: 'SCHEDULED' })).toHaveCount(0);
    await page.getByRole('button', { name: 'სერვისი', exact: true }).click();
    await expect(page.locator('.deal-card')).toHaveCount(0);
    await page.getByRole('button', { name: 'კერძი', exact: true }).click();
    const card = page.locator('.deal-card').filter({ hasText: names.dish });
    await expect(card).toContainText('15 ₾');
    await expect(card.locator('.deal-brand-logo img')).toHaveAttribute('src', 'https://commerce-qa.example/logo.png');
    const logoBox = await card.locator('.deal-brand-logo').boundingBox();
    const badgeBox = await card.locator('.deal-percent').boundingBox();
    const artBox = await card.locator('.deal-art').boundingBox();
    assert.ok(logoBox.x > artBox.x + artBox.width / 2 && badgeBox.x > artBox.x + artBox.width / 2);
    assert.ok(badgeBox.y >= logoBox.y + logoBox.height);
    await card.getByRole('button').click();
    await expect(page.getByRole('dialog')).toContainText('25%');
    await expect(page.getByRole('dialog')).toContainText('QA ადგილზე მიღებისას.');
    await page.keyboard.press('Escape');
    await overflow(); await page.screenshot({ path: `${artifactDir}/discounts-desktop.png`, fullPage: true });
  });
  await step('Menu images precede structured dishes; dietary/time filters and demo labels work', async () => {
    await open('/business/b_cafe?tab=menu');
    const section = page.locator('.commerce-section');
    await expect(section.locator('.commerce-item').filter({ hasText: names.dish })).toHaveCount(1);
    await expect(section.locator('.commerce-item').filter({ hasText: `${prefix} DEMO` }).locator('.deal-demo-label')).toContainText('დემო — შეთავაზება არ მოქმედებს');
    const photo = await section.locator('.commerce-menu-photos').boundingBox();
    const items = await section.locator('.commerce-grid').boundingBox();
    assert.ok(photo.y < items.y);
    await section.getByLabel('კვების მახასიათებლები', { exact: true }).selectOption('vegan');
    await expect(section.locator('.commerce-item')).toHaveCount(0);
    await section.getByLabel('კვების მახასიათებლები', { exact: true }).selectOption('vegetarian');
    await section.getByLabel('მომზადების დრო, წუთი', { exact: true }).selectOption('10');
    await expect(section.locator('.commerce-item')).toHaveCount(0);
    await section.getByLabel('მომზადების დრო, წუთი', { exact: true }).selectOption('20');
    await expect(section.locator('.commerce-item').filter({ hasText: names.dish })).toHaveCount(1);
    await overflow(); await page.screenshot({ path: `${artifactDir}/menu-desktop.png`, fullPage: true });
    // Same component as the expanded map card, rendered at its narrow width.
    await section.evaluate((element) => { element.style.width = '400px'; element.style.maxWidth = '100%'; });
    assert.equal(await section.locator('.commerce-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length), 1);
    assert.equal(await section.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true);
    await section.screenshot({ path: `${artifactDir}/catalog-narrow.png` });
  });
  await step('Unknown prices stay unknown and mobile pages do not overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open('/business/b_cafe?tab=catalog');
    const unknown = page.locator('.commerce-item').filter({ hasText: names.unknown });
    await expect(unknown).toContainText('ფასი დასაზუსტებელია');
    await expect(unknown).not.toContainText('0 ₾');
    await overflow(); await page.screenshot({ path: `${artifactDir}/catalog-mobile.png`, fullPage: true });
    await open('/discounts');
    await expect(page.locator('.deal-card').filter({ hasText: names.dish })).toHaveCount(1);
    await overflow(); await page.screenshot({ path: `${artifactDir}/discounts-mobile.png`, fullPage: true });
  });
  await step('Direct offer item opens even beyond first catalog page', async () => {
    const records = await db.collection('commerceItems').where('businessId', '==', 'b_cafe').get();
    const source = records.docs.find((doc) => doc.data().title === names.product).data();
    const batch = db.batch();
    for (let index = 0; index < 25; index++) batch.set(db.collection('commerceItems').doc(), { ...source, title: `A ${prefix} ${index}` });
    const target = db.collection('commerceItems').doc();
    batch.set(target, { ...source, title: `ZZZ ${prefix} TARGET` });
    await batch.commit();
    await open(`/business/b_cafe?tab=catalog&item=${target.id}`);
    await expect(page.locator(`#catalog-${target.id}`)).toBeVisible();
    await expect(page.locator(`#catalog-${target.id}`)).toHaveClass(/is-focused/);
    await overflow();
  });
  await step('Actual expanded map catalog stays inside narrow panel', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await context.route('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e7eee5' } }] }) }));
    await open('/map?place=pl_fabrika');
    await page.getByRole('button', { name: 'ვრცლად რუკაზე', exact: true }).click();
    await page.getByRole('button', { name: 'მენიუ და კატალოგი', exact: true }).click();
    const panel = page.locator('.map-place-details');
    const catalog = panel.locator('.commerce-section');
    await expect(catalog.locator('.commerce-item').filter({ hasText: names.dish })).toHaveCount(1);
    assert.equal(await catalog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true);
    assert.equal(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true);
    await panel.screenshot({ path: `${artifactDir}/map-catalog.png` });
  });
  assert.deepEqual(errors, []);
  writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ prefix, results, errors, base: BASE, note: 'Actual Firebase emulator client writes; no production writes. Menu image is a controlled visual test fixture.' }, null, 2));
  console.log(`${results.length} commerce E2E scenarios passed; no JS errors.`);
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/failure.png`, fullPage: true }).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close(); await deleteApp(app);
}
