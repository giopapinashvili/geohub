// Real channel + linked-video flow against Firebase emulators only.
// The embedded provider response is stubbed; we verify the integration URL,
// not YouTube availability or playback permissions for a particular video.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const base = process.env.GEOHUB_VIDEO_URL || 'http://127.0.0.1:5177';
if (new URL(base).hostname !== '127.0.0.1') throw new Error('Local test site required');
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST)) throw new Error('Local emulator required');
const prefix = `qa_video_${Date.now()}`;
const app = initializeApp({ projectId: 'demo-geohub' }, prefix), db = getFirestore(app);
const businessId = `${prefix}_page`, name = `${prefix} channel`, secondName = `${prefix} second`;
await db.doc(`businesses/${businessId}`).set({ title: `${prefix} page`, name: `${prefix} page`, ownerId: 'u_nino', status: 'active' });
const cleanup = [`businesses/${businessId}`], results = [], errors = [];
const dir = '.codex/artifacts/video-link-e2e'; mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
let uploads = 0;
async function prepare(ctx) {
  await ctx.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>YouTube embed fixture</title><p>External player fixture</p>' }));
  await ctx.route(/https:\/\/(identity-qa|commerce-qa)\.example\//, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#326de6"/></svg>' }));
  ctx.on('request', request => { if (request.method() === 'POST' && request.url().includes('api.cloudinary.com')) uploads++; });
}
await prepare(context);
const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
async function step(label, run) { await run(); results.push(label); console.log('PASS', label); }
async function navigate(path) { await page.evaluate(async path => (await window.__gh.api()).router.navigate(path), path); }
async function videoRecord(title) {
  const docs = await db.collection('videos').where('title', '==', title).get();
  assert.equal(docs.size, 1); const doc = docs.docs[0]; cleanup.push(`videos/${doc.id}`); return { id: doc.id, ...doc.data() };
}
let channelId, video;
try {
  await page.goto(`${base}/login`); await page.waitForFunction(() => window.__gh);
  assert.equal(await page.evaluate(() => window.__gh.emulator), true);
  await page.locator('input[type=email]').fill('nino@test.ge'); await page.locator('#login-pass').fill('geohub123');
  await page.locator('.auth-form button[type=submit]').click();
  await page.waitForFunction(() => window.__gh.authUser.value?.uid === 'u_nino' && window.__gh.profile.value);
  await step('Desktop navigation opens the visible video feed', async () => {
    await page.locator('.leftnav a[href="/video"]').click(); await expect(page).toHaveURL(`${base}/video`);
    await expect(page.getByRole('heading', { name: 'ვიდეო', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'არხის შექმნა', exact: true })).toBeVisible();
  });
  await step('Creator establishes a channel before adding any video', async () => {
    await page.getByRole('button', { name: 'არხის შექმნა', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.getByLabel('არხის სახელი', { exact: true }).fill(name);
    await dialog.getByRole('button', { name: 'არხის შექმნა', exact: true }).click();
    await expect(page).toHaveURL(/\/video\/channel\//); channelId = new URL(page.url()).pathname.split('/').at(-1); cleanup.push(`channels/${channelId}`);
    assert.equal((await db.doc(`channels/${channelId}`).get()).data().ownerId, 'u_nino');
    await expect(page.locator('.channel-name')).toHaveText(name);
  });
  await step('Channel adds a valid YouTube link without uploading a media file', async () => {
    await page.getByRole('button', { name: 'ვიდეოს დამატება', exact: true }).first().click();
    const dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('არხი', { exact: true })).toHaveValue(channelId);
    await dialog.getByLabel('სათაური', { exact: true }).fill(`${prefix} linked video`);
    await dialog.getByLabel('YouTube-ის ბმული', { exact: true }).fill('https://youtube.com.evil.example/watch?v=aqz-KE-bpKQ');
    await expect(dialog.getByRole('button', { name: 'გამოქვეყნება', exact: true })).toBeDisabled();
    await dialog.getByLabel('YouTube-ის ბმული', { exact: true }).fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
    await expect(dialog.locator('.video-publishing-identity')).toContainText(name);
    await dialog.getByRole('button', { name: 'გამოქვეყნება', exact: true }).click();
    await expect(page).toHaveURL(/\/watch\//); video = await videoRecord(`${prefix} linked video`);
    assert.equal(video.channelId, channelId); assert.equal(video.authorId, 'u_nino'); assert.equal(video.youtubeId, 'aqz-KE-bpKQ'); assert.equal(video.videoUrl, null); assert.equal(uploads, 0);
    await expect(page.locator('.watch-player iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/aqz-KE-bpKQ\?/);
    await expect(page.locator('.watch-source a')).toHaveAttribute('href', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
    await page.screenshot({ path: `${dir}/desktop-watch.png` });
  });
  await step('Page-authored video comment keeps the authenticated UID and page display identity', async () => {
    await page.evaluate(async id => { const api = await window.__gh.api(); api.actor.setActor(await api.business.getBusiness(id)); }, businessId);
    const text = `${prefix} page comment`; await page.locator('.cmt-input textarea').fill(text); await page.locator('.cmt-input .cmt-send').click();
    await expect(page.locator('.cmt').filter({ hasText: text }).locator('.cmt-name')).toHaveAttribute('href', `/business/${businessId}`);
    const docs = await db.collection(`videos/${video.id}/comments`).where('text', '==', text).get(); assert.equal(docs.size, 1);
    const comment = docs.docs[0].data(); cleanup.push(`videos/${video.id}/comments/${docs.docs[0].id}`);
    assert.equal(comment.authorId, 'u_nino'); assert.equal(comment.authorType, 'business'); assert.equal(comment.businessId, businessId);
    await navigate('/menu'); await expect(page.locator('.menu-profile')).toHaveAttribute('href', `/business/${businessId}`);
    await expect(page.locator('.menu-profile')).toContainText(`${prefix} page`);
    await page.evaluate(async () => (await window.__gh.api()).actor.setActor(null));
    await expect(page.locator('.menu-profile')).toHaveAttribute('href', '/u/me');
  });
  await step('Existing channel owners can create another channel while linking a video', async () => {
    await navigate('/video'); await page.getByRole('button', { name: 'ვიდეოს დამატება', exact: true }).click();
    const dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('არხი', { exact: true })).toBeEnabled();
    await dialog.getByLabel('არხი', { exact: true }).selectOption('__new__'); await dialog.getByLabel('ახალი არხის სახელი', { exact: true }).fill(secondName);
    await dialog.getByLabel('სათაური', { exact: true }).fill(`${prefix} second video`); await dialog.getByLabel('YouTube-ის ბმული', { exact: true }).fill('https://youtu.be/aqz-KE-bpKQ');
    await dialog.getByRole('button', { name: 'გამოქვეყნება', exact: true }).click(); await expect(page).toHaveURL(/\/watch\//);
    const second = await videoRecord(`${prefix} second video`); cleanup.push(`channels/${second.channelId}`); assert.notEqual(second.channelId, channelId);
    assert.equal((await db.doc(`channels/${second.channelId}`).get()).data().name, secondName); assert.equal(uploads, 0);
    await navigate('/video?tab=mine'); await expect(page.locator('.channel-card').filter({ hasText: name })).toBeVisible();
  });
  await step('Create menu opens the link-first video editor', async () => {
    await page.getByRole('button', { name: 'შექმნა', exact: true }).first().click();
    await page.locator('.create-opt').filter({ hasText: 'ვიდეოს დამატება' }).click();
    await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByLabel('YouTube-ის ბმული', { exact: true })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'გაუქმება', exact: true }).click();
  });
  await step('Anonymous mobile users discover the video feed, watch it and open its channel', async () => {
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } }); await prepare(mobileContext);
    const mobile = await mobileContext.newPage(); mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(base); await mobile.locator('.bottomnav a[href="/video"]').click();
    await expect(mobile.locator(`.video-title[href="/watch/${video.id}"]`)).toBeVisible({ timeout: 15000 });
    await mobile.screenshot({ path: `${dir}/mobile-feed.png` });
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await mobile.locator(`.video-title[href="/watch/${video.id}"]`).click(); await expect(mobile.locator('.watch-title')).toHaveText(`${prefix} linked video`);
    await expect(mobile.locator('.watch-player iframe')).toBeVisible();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await mobile.locator('.watch-channel-text a').click(); await expect(mobile.locator('.channel-name')).toHaveText(name);
    await expect(mobile.getByRole('button', { name: 'ვიდეოს დამატება', exact: true })).toHaveCount(0); await mobileContext.close();
  });
  assert.deepEqual(errors, []); writeFileSync(`${dir}/results.json`, JSON.stringify({ results, errors, uploads, externalPlaybackStubbed: true }, null, 2));
} catch (error) { console.log('VIDEO_FAILURE', JSON.stringify({ errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '') })); await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {}); throw error; }
finally { await browser.close(); for (const path of cleanup.reverse()) await db.doc(path).delete(); await deleteApp(app); }
