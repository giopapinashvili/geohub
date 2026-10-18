// Local Firebase emulator only; exercises actual share UI and notification writes.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const BASE = process.env.ACTOR_AUDIT_URL || 'http://127.0.0.1:5177';
if (!['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname)) throw new Error('Local emulator URL required');
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) if (!/^127\.0\.0\.1:\d+$/.test(process.env[key])) throw new Error('Local emulator required');
const prefix = `actor_audit_${Date.now()}`;
const app = initializeApp({ projectId: 'demo-geohub' }, prefix), db = getFirestore(app);
const pages = ['a', 'b'].map(letter => ({ id: `${prefix}_${letter}`, name: `Audit page ${letter}`, logo: `https://actor-audit.example/${letter}.png` }));
for (const page of pages) await db.doc(`businesses/${page.id}`).set({ name: page.name, title: page.name, logoUrl: page.logo, ownerId: 'u_nino', status: 'active', category: 'cafe', verified: false });
await db.doc('users/u_nino').update({ avatar: 'https://actor-audit.example/personal.png', verified: true });
const sourceId = `${prefix}_personal`, pagePostId = `${prefix}_page`, commentId = `${prefix}_comment`, storyId = `${prefix}_story`;
const placeIds = [`${prefix}_place_a`, `${prefix}_place_b`];
for (const [index, id] of placeIds.entries()) await db.doc(`places/${id}`).set({ name: `Audit place ${index}`, category: 'cafe', status: 'active', lat: 41.7, lng: 44.8, image: '', photos: [] });
await db.doc(`savedItems/u_nino_place_${placeIds[0]}`).set({ uid: 'u_nino', userId: 'u_nino', type: 'place', itemId: placeIds[0], createdAt: Timestamp.now() });
const base = { authorId: 'u_nino', userId: 'u_nino', authorName: pages[1].name, authorAvatar: pages[1].logo, authorType: 'business', businessId: pages[1].id, status: 'active', visibility: 'public', createdAt: Timestamp.now() };
await db.doc(`posts/${sourceId}`).set({ ...base, authorId: 'u_giorgi', userId: 'u_giorgi', authorName: 'Personal source', authorType: 'user', businessId: null, text: prefix, commentCount: 0 });
await db.doc(`posts/${pagePostId}`).set({ ...base, text: 'Page B post', commentCount: 1 });
await db.doc(`posts/${pagePostId}/comments/${commentId}`).set({ ...base, text: 'Page B comment', replyCount: 0 });
await db.doc(`stories/${storyId}`).set({ ...base, text: 'Page B story', closeFriends: false });
const directory = fileURLToPath(new URL('../../.codex/artifacts/actor-audit/', import.meta.url)); mkdirSync(directory, { recursive: true });
const results = [], errors = [];
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(existsSync), headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route('https://actor-audit.example/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#3468e8"/></svg>' }));
const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
const api = async (fn, data) => page.evaluate(async ({ source, data }) => { const api = await window.__gh.api(); return new Function('api', 'data', `return (${source})(api, data)`)(api, data); }, { source: fn.toString(), data });
async function selectPage(target) { await api((api, target) => api.actor.setActor(target), target); await expect.poll(() => api(api => api.actor.actor.value?.id || null)).toBe(target?.id || null); }
async function step(name, fn) { await fn(); results.push(name); console.log(`PASS ${name}`); }
async function notificationsFor(type, field, value) { return (await db.collection('userNotifications').where('type', '==', type).where(field, '==', value).get()).docs.map(doc => doc.data()); }
try {
  await page.goto(`${BASE}/login`); await page.waitForFunction(() => window.__gh);
  assert.equal(await page.evaluate(() => window.__gh.emulator), true);
  await page.locator('input[type=email]').fill('nino@test.ge'); await page.locator('#login-pass').fill('geohub123'); await page.locator('.auth-form button[type=submit]').click();
  await page.waitForFunction(() => window.__gh.authUser.value?.uid === 'u_nino' && window.__gh.profile.value);
  await selectPage(pages[0]);
  await step('Quick share publishes with page A logo/name and does not inherit owner verification', async () => {
    await page.goto(`${BASE}/post/${sourceId}`); await page.waitForFunction(() => window.__gh?.authUser.value?.uid === 'u_nino');
    await expect.poll(() => api(api => api.actor.actor.value?.id)).toBe(pages[0].id);
    await page.locator('.post-icon-btn[aria-label="გაზიარება"]').first().click();
    await expect(page.locator('.share-menu')).toContainText(pages[0].name);
    await page.locator('.share-menu .menu-item').first().click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(async () => (await db.collection('posts').where('sharedPostId', '==', sourceId).get()).size).toBe(1);
    const shared = (await db.collection('posts').where('sharedPostId', '==', sourceId).get()).docs[0].data();
    assert.equal(shared.authorId, 'u_nino'); assert.equal(shared.authorType, 'business'); assert.equal(shared.businessId, pages[0].id); assert.equal(shared.authorAvatar, pages[0].logo); assert.equal(shared.authorVerified, false);
  });
  await step('Page A comment on page B routes notification to B with A display identity', async () => {
    await api(async (api, id) => api.posts.addComment(await api.posts.getPost(id), 'Audit page comment'), pagePostId);
    await expect.poll(async () => (await notificationsFor('comment', 'postId', pagePostId)).length).toBe(1);
    const notification = (await notificationsFor('comment', 'postId', pagePostId))[0];
    assert.equal(notification.targetActorType, 'business'); assert.equal(notification.targetActorId, pages[1].id);
    assert.equal(notification.fromUserId, 'u_nino'); assert.equal(notification.fromActorId, pages[0].id); assert.equal(notification.fromAvatar, pages[0].logo);
  });
  await step('Replies to page comments and stories target the publishing page rather than its owner', async () => {
    await api(async (api, data) => { await api.posts.addReply(data.postId, { id: data.commentId, authorId: 'u_nino', userId: 'u_nino', authorType: 'business', businessId: data.pageId }, 'Audit reply'); await api.stories.replyToStory({ id: data.storyId, authorId: 'u_nino', authorType: 'business', businessId: data.pageId }, 'Audit story reply'); }, { postId: pagePostId, commentId, storyId, pageId: pages[1].id });
    for (const [type, field, id] of [['reply', 'commentId', commentId], ['story_reply', 'storyId', storyId]]) {
      await expect.poll(async () => (await notificationsFor(type, field, id)).length).toBe(1);
      const notification = (await notificationsFor(type, field, id))[0];
      assert.equal(notification.targetActorId, pages[1].id); assert.equal(notification.fromName, pages[0].name); assert.equal(notification.fromAvatar, pages[0].logo);
    }
  });
  await step('Page and personal drafts do not cross identities and restore their own text', async () => {
    const open = async () => { await api(api => api.store.openComposer({})); await expect(page.locator('.composer-modal')).toBeVisible(); };
    const close = async () => { await page.locator('.composer-modal .modal-head button').click(); await expect(page.locator('.composer-modal')).toHaveCount(0); };
    await open(); await page.locator('.composer textarea').first().fill('Only page A draft'); await close();
    await selectPage(pages[1]); await open(); await expect(page.locator('.composer textarea').first()).toHaveValue(''); await page.locator('.composer textarea').first().fill('Only page B draft'); await close();
    await selectPage(null); await open(); await expect(page.locator('.composer textarea').first()).toHaveValue(''); await close();
    await selectPage(pages[0]); await open(); await expect(page.locator('.composer textarea').first()).toHaveValue('Only page A draft'); await close();
  });
  await step('Business-authored posts are absent from the administrator’s personal profile feed', async () => {
    const ids = await api(api => new Promise(resolve => { const stop = api.posts.listenUserPosts('u_nino', list => { stop(); resolve(list.map(post => post.id)); }); }));
    assert.equal(ids.includes(pagePostId), false);
  });
  await step('Personal-only marketplace publishing is explicitly labeled while acting as a page', async () => {
    await page.goto(`${BASE}/marketplace/new`); await expect(page.getByRole('note')).toContainText('პირადი პროფილით');
    await page.screenshot({ path: `${directory}/personal-action-notice.png`, fullPage: false });
  });
  await step('Place review and physical check-in explain the personal author while acting as a page', async () => {
    await page.goto(`${BASE}/place/${placeIds[0]}?tab=reviews`);
    await expect(page.locator('.review-form [role=note]')).toContainText('პირადი პროფილით');
    await page.locator('.place-actions button').first().click();
    await expect(page.locator('[role=dialog] [role=note]')).toContainText('ჩექინი');
    await page.locator('[role=dialog] .modal-head button').click();
  });
  await step('Place favorites reset on sign-out, another account and another selected place', async () => {
    const button = page.locator('.place-actions button').nth(1);
    await expect(button).toHaveText('შენახულია');
    await api(api => api.auth.signOut());
    await expect(button).toHaveText('შენახვა');
    await api(api => api.auth.signIn('giorgi@test.ge', 'geohub123'));
    await expect.poll(() => api(api => api.auth.uid.value)).toBe('u_giorgi');
    await expect(button).toBeEnabled();
    await expect(button).toHaveText('შენახვა');
    await button.click();
    await expect(button).toHaveText('შენახულია');
    assert.equal((await db.doc(`savedItems/u_giorgi_place_${placeIds[0]}`).get()).exists, true);
    await api((api, id) => api.router.navigate(`/place/${id}`), placeIds[1]);
    await expect(page.locator('.place-name')).toContainText('Audit place 1');
    await expect(page.locator('.place-actions button').nth(1)).toHaveText('შენახვა');
  });
  await step('Standalone check-in finds imported places with Georgian/Latin typos, excludes addresses and hydrates before selection', async () => {
    const publicRequests = [];
    const track = request => { if (new URL(request.url()).pathname.startsWith('/place-data/')) publicRequests.push(new URL(request.url()).pathname); };
    page.on('request', track);
    await api(api => api.router.navigate('/explore'));
    await page.locator('.explore-hero-actions button').first().click();
    await expect(page.locator('[role=dialog] .checkin-list')).toBeVisible();
    assert.equal(publicRequests.some(path => path.includes('search-')), false);
    const input = page.locator('[role=dialog] input[type=search]');
    await input.fill('დაფნა');
    const daphna = page.locator('.checkin-list a[href="/place/osm_node_8432033717"]');
    await expect(daphna).toBeVisible();
    await input.fill('daphnna');
    await expect(daphna).toBeVisible();
    await expect(page.getByText('მიახლოებული სახელებიც ნაჩვენებია.')).toBeVisible();
    assert.equal(await page.locator('.checkin-list a[href*="addr_"]').count(), 0);
    assert.equal(publicRequests.filter(path => path.startsWith('/place-data/places-')).length, 0);
    await daphna.click();
    await expect(page.locator('.checkin-place')).toContainText(/დაფნა|Daphna/i);
    assert.ok(publicRequests.some(path => path.startsWith('/place-data/places-')));
    await page.locator('[role=dialog] textarea').fill(`${prefix}_imported_checkin`);
    await page.locator('[role=dialog] [role=switch]').click();
    await page.getByRole('button', { name: 'ჩეკინის გაკეთება', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const records = (await db.collection('checkins').where('caption', '==', `${prefix}_imported_checkin`).get()).docs;
    assert.equal(records.length, 1);
    assert.equal(records[0].data().placeId, 'osm_node_8432033717');
    assert.equal(records[0].data().authorId, 'u_giorgi');
    page.off('request', track);
  });
  assert.deepEqual(errors, []);
  writeFileSync(`${directory}/results.json`, JSON.stringify({ results, errors }, null, 2));
} catch (error) { await page.screenshot({ path: `${directory}/failure.png`, fullPage: true }).catch(() => {}); writeFileSync(`${directory}/results.json`, JSON.stringify({ results, errors, failure: error.message }, null, 2)); throw error; }
finally { await browser.close(); await deleteApp(app); }
