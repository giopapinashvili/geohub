// Read-only final deployment smoke. Does not log in, publish, save or play videos.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';

const base = process.env.GEOHUB_PREVIEW_URL || 'https://7aa293c0.geohub-main.pages.dev';
if (!/^https:\/\/[a-f0-9]+\.geohub-main\.pages\.dev$/.test(base)) throw new Error('Explicit GeoHub preview deployment required');
const dir = '.codex/artifacts/preview-content-smoke'; mkdirSync(dir, { recursive: true });
const results = [], errors = [], failedAssets = []; let writes = 0, importedHref = '', importedName = '', videoCount = 0;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route(/firestore.*\/(?:Write|Commit)(?:\/|\?|$)/, route => { writes++; return route.abort(); });
const page = await context.newPage(); page.setDefaultTimeout(30000);
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) failedAssets.push({ url: response.url(), status: response.status() }); });
const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
const loaded = async locator => { await locator.scrollIntoViewIfNeeded(); await expect.poll(() => locator.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true); };
async function step(label, run) { await run(); results.push(label); console.log('PASS', label); }
try {
  await page.goto(`${base}/explore`);
  await step('Public Explore shows the new G logo/favicon and a new imported place card with a licensed photograph', async () => {
    await expect(page.locator('.header .logo-mark')).toHaveAttribute('src', '/icons/geohub-g-128.png');
    await loaded(page.locator('.header .logo-mark'));
    await expect(page.locator('head link[rel="icon"]').first()).toHaveAttribute('href', '/icons/geohub-g-32.png');
    await expect(page.locator('.explore .place-grid .place-card').first()).toBeVisible();
    await expect(page.locator('.explore-section').first()).toContainText('აქ ნაჩვენებია შერჩეული ადგილები');
    const cards = page.locator('.place-card[href^="/place/osm_"]:has(img[src^="/place-media/"]):not([href="/place/osm_way_548795814"]):not([href="/place/osm_relation_19640789"]):not([href="/place/osm_way_38424053"])');
    for (let pageNumber = 0; pageNumber < 8 && !await cards.count(); pageNumber++) {
      const more = page.getByRole('button', { name: 'მეტის ნახვა', exact: true });
      await expect(more).toBeVisible(); await more.click();
    }
    assert.ok(await cards.count(), 'Newly enriched imported photograph should appear in Explore');
    const card = cards.first(); importedHref = await card.getAttribute('href'); importedName = await card.locator('.place-card-name').innerText();
    await loaded(card.locator('.place-card-img>img')); await noOverflow();
    await page.screenshot({ path: `${dir}/desktop-explore.png` }); await card.click();
  });
  await step('Imported Explore card opens its own direct page and sourced photo/facts posts on the public deployment', async () => {
    await expect(page).toHaveURL(`${base}${importedHref}`); await expect(page.locator('.place-name')).toHaveText(importedName);
    await loaded(page.locator('.place-gallery img').first());
    await page.locator('.imported-directory-preview').click();
    await expect(page.locator('.imported-photo-post')).toBeVisible(); await loaded(page.locator('.imported-source-photos img').first());
    await expect(page.locator('.imported-visitor-post')).toContainText('GeoHub-ის ცნობარი');
    await expect(page.locator('.imported-source-post').first()).toHaveAttribute('data-place-id', importedHref.split('/').at(-1));
    await noOverflow(); await page.locator('.imported-photo-post').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${dir}/desktop-imported-post.png` });
    await page.reload(); await expect(page.locator('.place-name')).toHaveText(importedName);
  });
  await step('Desktop video navigation opens the public feed and visible channel/link creation actions', async () => {
    await page.locator('.leftnav a[href="/video"]').click(); await expect(page).toHaveURL(`${base}/video`);
    await expect(page.getByRole('heading', { name: 'ვიდეო', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'არხის შექმნა', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ვიდეოს დამატება', exact: true })).toBeVisible();
    await expect(page.locator('.video-grid .skeleton')).toHaveCount(0);
    await expect(page.getByText('რაღაც შეცდომა მოხდა. სცადე თავიდან.', { exact: true })).toHaveCount(0);
    videoCount = await page.locator('.video-grid a.video-thumb').count();
    if (!videoCount) await expect(page.getByText('ჯერ ვიდეოები არ არის', { exact: true })).toBeVisible();
    await noOverflow(); await page.screenshot({ path: `${dir}/desktop-video.png` });
  });
  await step('Public demo offer opens a populated fictional merchant catalog while the ordinary feed stays separate', async () => {
    await page.goto(`${base}/discounts?mode=demo`); await expect(page.locator('.deals-grid .deal-card')).toHaveCount(6);
    const card = page.locator('.deal-card').filter({ has: page.getByRole('heading', { name: 'ყავა და კრუასანი', exact: true }) });
    await loaded(card.locator('.deal-art>img')); await card.locator('.deal-open').click();
    await page.getByRole('dialog').getByRole('link', { name: 'დემო გვერდისა და კატალოგის ნახვა' }).click();
    await expect(page).toHaveURL(`${base}/discounts/demo/coffee?item=demo-item-coffee`);
    await expect(page.locator('.demo-merchant-head h1')).toHaveText('დემო კაფე');
    await expect(page.locator('.demo-catalog-item')).toHaveAttribute('data-item-id', 'demo-item-coffee');
    await expect(page.locator('.demo-merchant-page>.deals-notice')).toContainText('გამოგონილი ბიზნესი');
    await loaded(page.locator('.demo-catalog-image>img')); await noOverflow();
    await page.goto(`${base}/discounts`); await expect(page.locator('.deals-mode .chip').first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.deals-grid .deal-demo-label')).toHaveCount(0);
  });
  await step('Mobile Explore, imported page, video navigation and demo catalog fit the public site without overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/explore`); await expect(page.locator('.place-grid .place-card').first()).toBeVisible(); await noOverflow();
    await page.goto(`${base}${importedHref}?tab=posts`); await expect(page.locator('.imported-photo-post')).toBeVisible();
    await loaded(page.locator('.imported-source-photos img').first()); await noOverflow();
    const videoLink = page.locator('.bottomnav a[href="/video"],.bottom-nav a[href="/video"]');
    await expect(videoLink).toBeVisible(); await videoLink.click(); await expect(page).toHaveURL(`${base}/video`);
    await expect(page.getByRole('heading', { name: 'ვიდეო', exact: true })).toBeVisible(); await noOverflow();
    await page.goto(`${base}/discounts/demo/coffee`); await expect(page.locator('.demo-merchant-head h1')).toBeVisible();
    await loaded(page.locator('.demo-merchant-cover>img')); await noOverflow(); await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${dir}/mobile-demo.png` });
  });
  assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []); assert.equal(writes, 0);
  writeFileSync(`${dir}/results.json`, JSON.stringify({ origin: base, passed: results.length, results, importedHref, importedName, videoCount, errors, failedAssets, blockedWrites: writes }, null, 2));
  console.log(JSON.stringify({ passed: results.length, importedHref, importedName, videoCount, errors, failedAssets, writes }));
} catch (error) { await page.screenshot({ path: `${dir}/failure.png`, fullPage: true }).catch(() => {}); writeFileSync(`${dir}/results.json`, JSON.stringify({ origin: base, passed: results.length, results, importedHref, importedName, errors, failedAssets, error: String(error) }, null, 2)); throw error; }
finally { await browser.close(); }
