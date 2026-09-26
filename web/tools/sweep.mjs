// Visits every main route at several widths (emulator build) and reports
// horizontal overflow, page errors and console errors.
//   node web/tools/sweep.mjs [--as=nino] [--theme=dark]
import { chromium } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const base = args.base || 'http://127.0.0.1:5173';
const widths = (args.w || '360,768,1024,1440').split(',').map(Number);
const routes = (args.routes || '/,/post/p1,/reels,/video,/watch/v1,/video/channel/ch_travel,/explore,/search?q=თბ,/map,/place/pl_gergeti,/u/u_nino,/messages,/notifications,/friends,/saved,/business,/business/new,/business/b_cafe,/business/b_cafe/manage,/events,/events/e_jazz,/groups,/groups/g_hikers,/marketplace,/marketplace/new,/marketplace/m1,/rewards,/premium,/settings/privacy,/menu,/admin,/about,/privacy,/terms,/nope,/login,/signup,/profile.html?id=u_nino').split(',');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let problems = 0;
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 860 }, colorScheme: args.theme || 'light' });
  const page = await ctx.newPage();
  let errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|youtube|ytimg|cartocdn|net::/i.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await page.addInitScript((th) => { try { localStorage.setItem('gh_theme', th); } catch {} }, args.theme || 'light');
  await page.goto(base + '/');
  if (args.as) {
    await page.waitForFunction(() => window.__gh, null, { timeout: 15000 });
    await page.evaluate((e) => window.__gh.signIn(`${e}@test.ge`, 'geohub123'), args.as);
    await page.waitForFunction(() => window.__gh.profile.value, null, { timeout: 15000 });
  }
  for (const r of routes) {
    errs = [];
    await page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, r);
    await page.waitForTimeout(1300);
    const info = await page.evaluate(() => {
      const over = document.documentElement.scrollWidth - innerWidth;
      const wide = [...document.querySelectorAll('main *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('[class*="scroll"],.chip-row,.tabs-scroll,.steps,.place-actions,.biz-actions,.watch-actions,.map-chips,.market-thumbs,.settings-nav,.h-scroll,.segmented'); }).slice(0, 3).map((el) => el.className && String(el.className).slice(0, 60));
      const missing = document.body.innerText.match(/\b[a-z]+\.[a-zA-Z]+(\.[a-zA-Z]+)?\b/g)?.filter((k) => /^(common|nav|biz|place|events|groups|market|rewards|premium|settings|admin|about|legal|video|reels|search|explore|map|checkin|profile|post|saved|friends|messages|notif)\./.test(k)).slice(0, 3) || [];
      return { over, wide, missing };
    });
    if (info.over > 0 || info.wide.length || errs.length || info.missing.length) {
      problems++;
      console.log(`${w} ${r}: overflow=${info.over} ${info.wide.join(' | ')} ${info.missing.length ? 'KEYS ' + info.missing.join(',') : ''} ${errs.slice(0, 2).join(' || ')}`);
    }
  }
  await ctx.close();
}
console.log(problems ? `${problems} problem(s)` : 'clean');
await browser.close();
