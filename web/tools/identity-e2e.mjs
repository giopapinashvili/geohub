// Real UI identity switching + local Firebase emulator writes, never production.
import assert from 'node:assert/strict';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const BASE = process.env.IDENTITY_TEST_URL || 'http://127.0.0.1:5177';
if (!['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname)) throw new Error('Local emulator URL required.');
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) if (!/^127\.0\.0\.1:\d+$/.test(process.env[key])) throw new Error('Local emulator required.');
const prefix = `identity_qa_${Date.now()}`;
const app = initializeApp({ projectId: 'demo-geohub' }, prefix); const db = getFirestore(app);
const pages = [{ id: `${prefix}_a`, name: `QA გვერდი A ${prefix.slice(-6)}`, logo: 'https://identity-qa.example/a.png' }, { id: `${prefix}_b`, name: `QA გვერდი B ${prefix.slice(-6)}`, logo: 'https://identity-qa.example/b.png' }];
for (const item of pages) await db.doc(`businesses/${item.id}`).set({ name: item.name, title: item.name, logoUrl: item.logo, ownerId: 'u_nino', status: 'active', category: 'cafe', city: 'tbilisi' });
await db.doc('users/u_nino').update({ avatar: 'https://identity-qa.example/personal.png' });
const postId = `${prefix}_post`;
await db.doc(`posts/${postId}`).set({ authorId: 'u_giorgi', userId: 'u_giorgi', authorName: 'QA Giorgi', authorType: 'user', text: 'QA identity comments', visibility: 'public', status: 'active', createdAt: Timestamp.now(), commentCount: 0 });
const artifactDir = fileURLToPath(new URL('../../.codex/artifacts/identity-e2e/', import.meta.url)); mkdirSync(artifactDir, { recursive: true });
const results = []; const errors = [];
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(existsSync), headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route('https://identity-qa.example/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${route.request().url().includes('/a.') ? '#1463ff' : route.request().url().includes('/b.') ? '#207a41' : '#8853c7'}"/></svg>` }));
const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', (error) => errors.push(error.message));
async function step(name, run) { await run(); results.push(name); console.log(`PASS ${name}`); }
async function ready() { await page.waitForFunction(() => window.__gh?.authUser.value?.uid === 'u_nino' && window.__gh?.profile.value); }
async function selectPage(item) {
  // Actual account-menu selection; navigation is part of the product behavior.
  await page.locator('.acct-trigger').click();
  await page.locator('.switcher-row').filter({ hasText: item ? item.name : 'ნინო' }).first().click();
  await page.waitForFunction(async (id) => (await window.__gh.api()).actor.actor.value?.id === id || (!id && !(await window.__gh.api()).actor.actor.value), item?.id || null);
}
async function publishingStory(item, suffix) {
  await page.goto(BASE); await ready();
  const expected = item?.logo || 'https://identity-qa.example/personal.png';
  await expect(page.locator('.story-create-top img')).toHaveAttribute('src', expected);
  await page.locator('.story-create').click();
  await expect(page.locator('.story-publishing-identity img')).toHaveAttribute('src', expected);
  if (item) await expect(page.locator('.story-publishing-identity')).toContainText(item.name);
  await page.locator('.story-new-choice.is-text').click();
  const caption = `${prefix} story ${suffix}`;
  await page.locator('.story-new-text').fill(caption);
  await page.getByRole('dialog').getByRole('button', { name: 'გაზიარება', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const story = (await db.collection('stories').where('text', '==', caption).get()).docs[0];
  assert.ok(story, 'story saved'); const data = story.data();
  assert.equal(data.authorId, 'u_nino'); assert.equal(data.userId, 'u_nino');
  assert.equal(data.authorType, item ? 'business' : 'user'); assert.equal(data.businessId, item?.id || null); assert.equal(data.authorAvatar, expected);
  const archive = item ? `businesses/${item.id}/storyArchive/${story.id}` : `users/u_nino/storyArchive/${story.id}`;
  await expect.poll(async () => (await db.doc(archive).get()).exists).toBe(true);
  return story.id;
}
async function comment(item, suffix) {
  await page.goto(`${BASE}/post/${postId}`); await ready();
  const expected = item?.logo || 'https://identity-qa.example/personal.png';
  await expect(page.locator('.cmt-input > .avatar img').first()).toHaveAttribute('src', expected);
  const text = `${prefix} comment ${suffix}`;
  await page.locator('.cmt-input textarea').first().fill(text); await page.locator('.cmt-input .cmt-send').first().click();
  await expect(page.locator('.cmt-text').filter({ hasText: text })).toHaveCount(1);
  const comment = (await db.collection(`posts/${postId}/comments`).where('text', '==', text).get()).docs[0].data();
  assert.equal(comment.authorId, 'u_nino'); assert.equal(comment.authorType, item ? 'business' : 'user'); assert.equal(comment.businessId, item?.id || null); assert.equal(comment.authorAvatar, expected);
}
try {
  await page.goto(`${BASE}/login`); await page.waitForFunction(() => window.__gh);
  assert.equal(await page.evaluate(() => window.__gh.emulator), true);
  await page.locator('input[type=email]').fill('nino@test.ge'); await page.locator('#login-pass').fill('geohub123'); await page.locator('.auth-form button[type=submit]').click(); await ready();
  await step('Personal comment composer and published comment use personal identity', () => comment(null, 'personal'));
  await step('Personal story create card, composer, saved story and archive use personal identity', () => publishingStory(null, 'personal'));
  await step('Real account switcher selects page A; comments show and save page A', async () => { await selectPage(pages[0]); await comment(pages[0], 'a'); });
  await step('Page A story uploads use its logo, business fields and business archive', () => publishingStory(pages[0], 'a'));
  await step('Page A to page B updates comment composer and published identity', async () => { await selectPage(pages[1]); await comment(pages[1], 'b'); });
  await step('Page B stories remain separate from personal and page A stories', async () => {
    await publishingStory(pages[1], 'b');
    await expect(page.locator('.story-card-avatar img[src="https://identity-qa.example/a.png"]')).toHaveCount(1);
    await expect(page.locator('.story-card-avatar img[src="https://identity-qa.example/b.png"]')).toHaveCount(1);
    await expect(page.locator('.story-card-avatar img[src="https://identity-qa.example/personal.png"]')).toHaveCount(1);
    await page.screenshot({ path: `${artifactDir}/page-b-stories.png`, fullPage: false });
  });
  await step('Business story viewer links to the business page', async () => {
    await page.locator('.story-card').filter({ has: page.locator('img[src="https://identity-qa.example/b.png"]') }).last().click();
    await expect(page.locator('.story-author')).toHaveAttribute('href', `/business/${pages[1].id}`);
    await page.keyboard.press('Escape');
  });
  await step('Return to personal account clears business composition identity', async () => { await selectPage(null); await comment(null, 'personal-again'); });
  await step('Stale validation of an invalid page cannot clear a newer valid page', async () => {
    await page.evaluate(async (next) => { const api = await window.__gh.api(); api.actor.setActor({ id: 'missing-qa-page', name: 'Missing' }); api.actor.setActor(next); }, pages[0]);
    await expect.poll(() => page.evaluate(async () => (await window.__gh.api()).actor.actor.value?.id)).toBe(pages[0].id);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(async () => (await window.__gh.api()).actor.actor.value?.id), pages[0].id);
  });
  assert.deepEqual(errors, []);
  writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, fixtures: { pages, postId } }, null, 2));
  console.log(`PASS ${results.length} identity UI scenarios`);
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/failure.png`, fullPage: true }).catch(() => {});
  writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, failure: error.message, fixtures: { pages, postId } }, null, 2)); throw error;
} finally { await browser.close(); await deleteApp(app); }
