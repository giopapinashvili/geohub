// GeoHub Full QA Test — Playwright
// გაშვება: node test-geohub.js

const { chromium } = require('playwright');

const BASE = 'https://geohub-main.pages.dev';

const results = [];

function log(name, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${status}] ${name}${detail ? ' — ' + detail : ''}`);
  results.push({ name, status, detail });
  return status === 'PASS';
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tryStep(name, fn) {
  try { await fn(); log(name, 'PASS'); return true; }
  catch (e) { log(name, 'FAIL', e.message.split('\n')[0].slice(0, 120)); return false; }
}

(async () => {
  console.log('\n🌱 GeoHub QA ტესტი იწყება...\n');

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const ctx     = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page    = await ctx.newPage();

  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));

  // ─── 1. შესვლა (ხელით) ─────────────────────────────────────────────────
  await tryStep('შეხვედი?', async () => {
    await page.goto(BASE + '/auth.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log('\n⏳ შედი შენი ექაუნთით — 90 წამი გაქვს...\n');
    await page.waitForFunction(() => {
      return window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser;
    }, { timeout: 90000 });
  });

  // Auth check
  await tryStep('Auth — currentUser', async () => {
    const uid = await page.evaluate(() => window.GeoFirebase.auth.currentUser.uid);
    log('  UID', 'PASS', uid.slice(0,16) + '...');
  });

  // ─── FEED ──────────────────────────────────────────────────────────────
  await tryStep('Feed — feed.html იტვირთება', async () => {
    await page.goto(BASE + '/feed.html', { waitUntil: 'domcontentloaded' });
    await wait(3000);
    await page.waitForSelector('#ghFeedList, #ghCenter', { timeout: 12000 });
  });

  await tryStep('Feed — Stories strip (#ghStories)', async () => {
    await page.waitForSelector('#ghStories', { timeout: 8000 });
  });

  await tryStep('Feed — Composer (.gh-composer)', async () => {
    await page.waitForSelector('.gh-composer', { timeout: 8000 });
  });

  // ─── POST შექმნა ───────────────────────────────────────────────────────
  await tryStep('პოსტი — composer-ზე კლიკი', async () => {
    await page.click('.gh-composer-fake, [data-create-post]');
    await wait(1000);
    await page.waitForSelector('#ghPostModal, .gh-modal-backdrop', { timeout: 8000 });
  });

  await tryStep('პოსტი — ტექსტის შეყვანა', async () => {
    const ta = page.locator('#ghPostModal textarea, .gh-modal textarea, .gh-modal [contenteditable]').first();
    await ta.waitFor({ timeout: 5000 });
    await ta.fill('🌱 QA ტესტი — ავტომატური პოსტი ' + new Date().toLocaleTimeString('ka'));
  });

  await tryStep('პოსტი — გამოქვეყნება', async () => {
    const btn = page.locator('#ghPostModal button:has-text("გამოქვეყნება"), .gh-modal button:has-text("Post"), .gh-modal-actions button.gh-btn:not(.ghost)').first();
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await wait(3000);
    // modal should close
    const gone = await page.locator('#ghPostModal').count() === 0;
    if (!gone) throw new Error('modal დარჩა გახსნილი — პოსტი ვერ გამოქვეყნდა');
  });

  // ─── LIKE ──────────────────────────────────────────────────────────────
  await tryStep('Like — პოსტზე ❤️ კლიკი', async () => {
    await wait(2000);
    const likeBtn = page.locator('[data-like]').first();
    await likeBtn.waitFor({ timeout: 8000 });
    const beforeCount = await page.locator('[data-like-count]').first().innerText().catch(() => '0');
    await likeBtn.click();
    await wait(1500);
    log('  Like before', 'PASS', 'count was: ' + beforeCount);
  });

  // ─── COMMENT ───────────────────────────────────────────────────────────
  await tryStep('Comment — კომენტარის ველი', async () => {
    const commentBtn = page.locator('[data-comment], .gh-act:has-text("Comment"), button:has-text("კომენტარი")').first();
    await commentBtn.waitFor({ timeout: 8000 });
    await commentBtn.click();
    await wait(1000);
    const commentInput = page.locator('.gh-comment-input, textarea[placeholder*="კომენტ"], textarea[placeholder*="Comment"]').first();
    await commentInput.waitFor({ timeout: 5000 });
    await commentInput.fill('QA ტესტ კომენტარი 🌱');
    await commentInput.press('Enter');
    await wait(1500);
  });

  // ─── STORY ─────────────────────────────────────────────────────────────
  await tryStep('Story — "+" ღილაკი', async () => {
    await page.goto(BASE + '/feed.html', { waitUntil: 'domcontentloaded' });
    await wait(3000);
    const addStory = page.locator('[data-create-story], .gh-story-add').first();
    await addStory.waitFor({ timeout: 8000 });
    await addStory.click();
    await wait(1000);
    const modal = page.locator('.gh-modal-backdrop, .gh-story-modal, [id*="story"]').first();
    await modal.waitFor({ timeout: 6000 });
    // close modal
    await page.keyboard.press('Escape');
    await wait(500);
  });

  // ─── PROFILE ───────────────────────────────────────────────────────────
  await tryStep('Profile — profile.html', async () => {
    await page.goto(BASE + '/profile.html', { waitUntil: 'domcontentloaded' });
    await wait(3000);
    await page.waitForSelector('.profile-avatar', { timeout: 12000 });
  });

  await tryStep('Profile — Edit Avatar ღილაკი ჩანს', async () => {
    await page.waitForSelector('.profile-avatar-wrap, .profile-avatar-edit', { timeout: 8000 });
  });

  // ─── NOTIFICATIONS ─────────────────────────────────────────────────────
  await tryStep('Notifications — notifications.html', async () => {
    await page.goto(BASE + '/notifications.html', { waitUntil: 'domcontentloaded' });
    await wait(2500);
    const txt = await page.locator('body').innerText();
    if (txt.trim().length < 30) throw new Error('Empty page');
  });

  // ─── ADD BUSINESS ──────────────────────────────────────────────────────
  await tryStep('Add Business — ფორმა ჩანს', async () => {
    await page.goto(BASE + '/add-business.html', { waitUntil: 'domcontentloaded' });
    await wait(2000);
    await page.waitForSelector('input, form, select', { timeout: 8000 });
    const nameInput = page.locator('input[name="name"], input[placeholder*="სახ"], input[placeholder*="Name"], #bizName').first();
    await nameInput.waitFor({ timeout: 5000 });
    log('  Form input ჩანს', 'PASS', '');
  });

  // ─── JOBS ──────────────────────────────────────────────────────────────
  await tryStep('Jobs — #jbList', async () => {
    await page.goto(BASE + '/jobs.html', { waitUntil: 'domcontentloaded' });
    await wait(2500);
    await page.waitForSelector('#jbList', { timeout: 8000 });
  });

  await tryStep('Jobs — საძიებო ველი მუშაობს', async () => {
    const search = page.locator('#jbSearchInput');
    await search.waitFor({ timeout: 5000 });
    await search.fill('test');
    await wait(600);
    await search.fill('');
    await wait(400);
  });

  // ─── REAL ESTATE ───────────────────────────────────────────────────────
  await tryStep('Real Estate — real-estate.html', async () => {
    await page.goto(BASE + '/real-estate.html', { waitUntil: 'domcontentloaded' });
    await wait(2000);
    const txt = await page.locator('body').innerText();
    if (txt.trim().length < 30) throw new Error('Empty page');
  });

  // ─── INVITE ────────────────────────────────────────────────────────────
  await tryStep('Invite — Dashboard ჩანს', async () => {
    await page.goto(BASE + '/invite.html', { waitUntil: 'domcontentloaded' });
    await wait(3000);
    await page.waitForSelector('#invDashboard', { timeout: 10000 });
    const visible = await page.locator('#invDashboard').isVisible();
    if (!visible) throw new Error('#invDashboard hidden');
  });

  await tryStep('Invite — Copy Link ღილაკი', async () => {
    const btn = page.locator('#invCopyBtn, button:has-text("კოპირება"), [data-copy]').first();
    await btn.waitFor({ timeout: 6000 });
  });

  // ─── EARLY ADOPTER ─────────────────────────────────────────────────────
  await tryStep('Early Adopter — გვერდი', async () => {
    await page.goto(BASE + '/early-adopter.html', { waitUntil: 'domcontentloaded' });
    await wait(3000);
    // eaMain (has biz) or eaNoBiz (no biz) or eaFull — all valid
    await page.waitForSelector('#eaMain, #eaNoBiz, #eaFull', { timeout: 10000 });
    const screen = await page.evaluate(() => {
      return ['eaMain','eaNoBiz','eaFull'].find(id => {
        var el = document.getElementById(id);
        return el && el.style.display !== 'none';
      }) || 'unknown';
    });
    log('  აქტიური ეკრანი', 'PASS', '#' + screen);
  });

  // ─── GAMIFICATION ──────────────────────────────────────────────────────
  await tryStep('Gamification — gamification.html', async () => {
    await page.goto(BASE + '/gamification.html', { waitUntil: 'domcontentloaded' });
    await wait(2000);
    const txt = await page.locator('body').innerText();
    if (txt.trim().length < 30) throw new Error('Empty page');
  });

  // ─── PREMIUM ───────────────────────────────────────────────────────────
  await tryStep('Premium — premium.html', async () => {
    await page.goto(BASE + '/premium.html', { waitUntil: 'domcontentloaded' });
    await wait(2000);
    const txt = await page.locator('body').innerText();
    if (txt.trim().length < 30) throw new Error('Empty page');
  });

  // ─── MESSAGES ──────────────────────────────────────────────────────────
  await tryStep('Messages — messages.html', async () => {
    await page.goto(BASE + '/messages.html', { waitUntil: 'domcontentloaded' });
    await wait(2000);
    const txt = await page.locator('body').innerText();
    if (txt.trim().length < 30) throw new Error('Empty page');
  });

  // ─── SETTINGS ──────────────────────────────────────────────────────────
  await tryStep('Settings — settings.html', async () => {
    await page.goto(BASE + '/settings.html', { waitUntil: 'domcontentloaded' });
    await wait(2000);
    const txt = await page.locator('body').innerText();
    if (txt.trim().length < 30) throw new Error('Empty page');
  });

  // ─── JS ERRORS ─────────────────────────────────────────────────────────
  const critical = jsErrors.filter(e =>
    !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('Non-Error')
  );
  if (critical.length === 0) {
    log('JS Errors — კრიტიკული', 'PASS', 'ნული');
  } else {
    log('JS Errors', 'FAIL', critical.slice(0, 3).join(' | '));
  }

  // ─── შედეგი ────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log('\n' + '─'.repeat(60));
  console.log(`📊 შედეგი: ${passed} PASS / ${failed} FAIL / ${results.length} სულ`);

  if (failed === 0) {
    console.log('🎉 ყველა ტესტი გაიარა!');
  } else {
    console.log('\n❌ ჩავარდნილი:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.name}: ${r.detail}`);
    });
  }

  console.log('\nბრაუზერი ღიაა — შეგიძლია ხელით გათვალიერება.');
  console.log('დახურვა: Enter...');
  await new Promise(r => process.stdin.once('data', r));
  await browser.close();
})();
