import { chromium } from 'playwright';
const base = 'https://claude-clever-brown-xovltc.geohub-main.pages.dev';
const routes = ['/', '/explore', '/needs', '/business', '/marketplace', '/events', '/groups', '/video', '/map', '/search?q=თბილისი', '/profile.html?id=x', '/feed.html'];
const proxy = { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy, args: ['--disable-http2'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
let errs = [];
page.on('console', (m) => { const x = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && /index|permission|insufficient|FirebaseError|failed-precondition|Uncaught|TypeError/i.test(x)) errs.push(x.slice(0, 220)); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 200)));
for (const r of routes) {
  errs = [];
  try { await page.goto(base + r, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch (e) { console.log(r, 'GOTO FAIL', e.message.slice(0, 80)); continue; }
  await page.waitForTimeout(7000);
  const info = await page.evaluate(() => ({ url: location.pathname + location.search, cards: document.querySelectorAll('.card, .post, .need-card, .place-card, .biz-card').length, empty: !!document.querySelector('.empty'), text: document.querySelector('main')?.innerText.slice(0, 60).replace(/\s+/g, ' ') }));
  console.log(r, '→', info.url, 'cards', info.cards, info.empty ? 'EMPTY' : '', '|', info.text, errs.length ? '\n   ' + [...new Set(errs)].slice(0, 3).join('\n   ') : '');
}
await browser.close();
