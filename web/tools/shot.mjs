// Screenshot helper for development against the emulator build.
//   node web/tools/shot.mjs /path [--w=390,1440] [--theme=light,dark] [--as=nino] [--full] [--wait=1500]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(3).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const path = process.argv[2] || '/';
const widths = (args.w || '390,1440').split(',').map(Number);
const themes = (args.theme || 'light').split(',');
const base = args.base || 'http://127.0.0.1:5173';
const out = args.out || '/tmp/claude-0/-home-user-geohub/2877b89a-9f7d-52ce-bf45-56e5a986c362/scratchpad/shots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
for (const theme of themes) {
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 768 ? 844 : 900 }, colorScheme: theme, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript((t) => { try { localStorage.setItem('gh_theme', t); } catch {} }, theme);
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    if (args.as) {
      await page.waitForFunction(() => window.__gh, null, { timeout: 15000 });
      await page.evaluate((e) => window.__gh.signIn(`${e}@test.ge`, 'geohub123'), args.as);
      await page.waitForFunction(() => window.__gh.profile.value, null, { timeout: 15000 });
    }
    await page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, path);
    await page.waitForTimeout(Number(args.wait || 2000));
    const name = `${out}/${path.replace(/[^a-z0-9]+/gi, '_') || 'root'}-${w}-${theme}.png`;
    await page.screenshot({ path: name, fullPage: !!args.full });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(name, overflow > 0 ? `OVERFLOW ${overflow}px` : '', errors.length ? `\n  ${errors.slice(0, 8).join('\n  ')}` : '');
    await ctx.close();
  }
}
await browser.close();
