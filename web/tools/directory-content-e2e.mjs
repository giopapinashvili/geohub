// Read-only UI checks against a local frozen emulator build. No content writes.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { DEMO_OFFERS, DEMO_MERCHANTS } from '../src/features/commerce/demo.js';

const base = process.env.GEOHUB_CONTENT_URL || 'http://127.0.0.1:5184';
if (new URL(base).hostname !== '127.0.0.1') throw new Error('Local content test only');
const dir = '.codex/artifacts/directory-content-e2e'; mkdirSync(dir, { recursive: true });
const results = [], errors = []; let commits = 0;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
context.on('request', request => { if (request.url().includes('firestore') && /\/Commit(?:\?|$)/.test(request.url())) commits++; });
const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
async function step(label, run) { await run(); results.push(label); console.log('PASS', label); }
const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
const imagesLoaded = async selector => { const imgs = page.locator(selector); assert.ok(await imgs.count()); for (const img of await imgs.all()) { await img.scrollIntoViewIfNeeded(); await expect.poll(() => img.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true); } };
try {
  await page.goto(`${base}/place/osm_way_548795814`); await page.waitForFunction(() => window.__gh?.emulator);
  await step('Imported page opens directly with real photos, source credits and a discoverable directory section', async () => {
    await expect(page.locator('.place-name')).toContainText('ფაბრიკა');
    await expect(page.locator('.place-gallery img').first()).toHaveAttribute('fetchpriority', 'high');
    await expect(page.locator('.place-photo-credits')).toBeVisible();
    await page.locator('.imported-directory-preview').click(); await expect(page).toHaveURL(/tab=posts/);
    await expect(page.locator('.imported-photo-post')).toBeVisible(); await imagesLoaded('.imported-source-photos img');
    await expect(page.locator('.imported-visitor-post')).toContainText('GeoHub-ის ცნობარი');
    await expect(page.locator('.imported-source-post-link')).toHaveAttribute('href', 'https://www.openstreetmap.org/way/548795814');
    assert.equal(await page.locator('.imported-directory-feed .post-actions,.imported-directory-feed .story-ring').count(), 0);
    await noOverflow(); await page.locator('.imported-photo-post').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/desktop-source-posts.png` });
  });
  await step('Source photo opens full-size and closes without leaving the canonical place page', async () => {
    await page.locator('.imported-source-photo-open').first().click(); await expect(page.locator('.lightbox')).toBeVisible();
    await imagesLoaded('.lightbox-media'); await page.keyboard.press('Escape'); await expect(page.locator('.lightbox')).toHaveCount(0);
    await expect(page).toHaveURL(/\/place\/osm_way_548795814\?tab=posts/);
  });
  await step('All six demo offers have photographs and open a populated fictional page with the correct catalog item', async () => {
    for (const offer of DEMO_OFFERS) {
      await page.goto(`${base}/discounts?mode=demo`); await expect(page.locator('.deals-grid .deal-card')).toHaveCount(6);
      const card = page.locator('.deal-card').filter({ has: page.getByRole('heading', { name: offer.title, exact: true }) });
      await card.scrollIntoViewIfNeeded(); await expect.poll(() => card.locator('.deal-art>img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      await expect(card.locator('.deal-photo-credit a').first()).toHaveAttribute('href', offer.photoCredit.licenseUrl);
      await card.locator('.deal-open').click(); const dialog = page.getByRole('dialog');
      await expect(dialog.locator('.deal-art>img')).toHaveAttribute('loading', 'eager');
      await dialog.getByRole('link', { name: 'დემო გვერდისა და კატალოგის ნახვა' }).click();
      await expect(page).toHaveURL(new RegExp(`/discounts/demo/${offer.demoMerchantId}\\?item=${offer.itemId}$`));
      await expect(page.locator('.demo-merchant-head h1')).toHaveText(offer.businessName);
      await expect(page.locator('.demo-catalog-item')).toHaveAttribute('data-item-id', offer.itemId);
      await expect(page.locator('.demo-catalog-item')).toHaveClass(/is-focused/);
      await expect(page.locator('.demo-merchant-page>.deals-notice')).toContainText('გამოგონილი ბიზნესი');
      await expect(page.locator('.demo-merchant-post')).toBeAttached(); await expect(page.locator('.demo-merchant-offer .deal-card')).toBeAttached();
      await imagesLoaded('.demo-catalog-image>img'); await noOverflow();
    }
  });
  await step('Demo destination survives direct reload and the real feed excludes demo offers', async () => {
    await page.goto(`${base}/discounts/demo/coffee`); await expect(page.locator('.demo-merchant-head h1')).toHaveText(DEMO_MERCHANTS[0].name);
    await page.reload(); await expect(page.locator('.demo-catalog-item')).toBeVisible();
    await page.goto(`${base}/discounts`); await expect(page.locator('.deals-mode .chip').first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.deals-grid .deal-demo-label')).toHaveCount(0);
    await page.goto(`${base}/discounts/demo/unknown`); await expect(page.getByText('დემო გვერდი ვერ მოიძებნა')).toBeVisible();
  });
  await step('Mobile imported source photos, facts and fictional merchant catalog fit without horizontal overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/place/osm_way_548795814?tab=posts`); await expect(page.locator('.imported-photo-post')).toBeVisible();
    await imagesLoaded('.imported-source-photos img'); await noOverflow();
    await page.locator('.imported-photo-post').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${dir}/mobile-source-posts.png` });
    await page.goto(`${base}/discounts/demo/coffee`); await expect(page.locator('.demo-merchant-head h1')).toBeVisible();
    await imagesLoaded('.demo-merchant-cover>img'); await page.evaluate(() => scrollTo(0, 0)); await noOverflow();
    await page.screenshot({ path: `${dir}/mobile-demo-page.png`, fullPage: true });
    await page.goto(`${base}/discounts?mode=demo`); await expect(page.locator('.deals-grid .deal-card')).toHaveCount(6); await noOverflow();
  });
  assert.deepEqual(errors, []); assert.equal(commits, 0);
  writeFileSync(`${dir}/results.json`, JSON.stringify({ passed: results.length, results, errors, firestoreCommits: commits, providerData: 'Local licensed media and real imported OSM records; no data writes' }, null, 2));
  console.log(JSON.stringify({ passed: results.length, errors, firestoreCommits: commits }));
} catch (error) { await page.screenshot({ path: `${dir}/failure.png`, fullPage: true }).catch(() => {}); writeFileSync(`${dir}/results.json`, JSON.stringify({ passed: results.length, results, errors, error: String(error) }, null, 2)); throw error; }
finally { await browser.close(); }
