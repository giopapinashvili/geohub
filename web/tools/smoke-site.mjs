// Quick check that a deployed GeoHub site works for people and for link-preview
// bots (Facebook, Telegram…). Used by the deploy scripts before and after
// publishing.
//   node web/tools/smoke-site.mjs https://geohub-fixes.geohub-main.pages.dev [--expect-worker] [--wait=300]
// Exit 0 = all good, 1 = something is wrong (details are printed).
const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) || 'https://geohub-main.pages.dev').replace(/\/+$/, '');
const expectWorker = args.includes('--expect-worker');
const waitSec = Number((args.find((a) => a.startsWith('--wait=')) || '').split('=')[1]) || 0;

const HUMAN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const FACEBOOK = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const TELEGRAM = 'TelegramBot (like TwitterBot)';
// The owner's profile: public and permanent, so its card must show real data.
const PROFILE = '/u/qhcTCqM427PZGe0DPywS19wJ3zK2';

async function get(path, ua) {
  const r = await fetch(`${base}${path}${path.includes('?') ? '&' : '?'}smoke=${Date.now()}`, { headers: { 'User-Agent': ua }, redirect: 'manual' });
  const body = await r.text();
  return { status: r.status, h: (k) => r.headers.get(k) || '', body };
}

async function run() {
  const problems = [];
  const ok = (cond, what) => { if (!cond) problems.push(what); };

  const home = await get('/', HUMAN);
  ok(home.status === 200, `/ status ${home.status}`);
  ok(home.body.includes('<div id="app"></div>'), '/ has no app shell');
  const script = (home.body.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0];
  ok(!!script, '/ has no app script');
  ok(home.h('content-security-policy').includes("default-src 'self'"), '/ has no security policy header');

  const person = await get(PROFILE, HUMAN);
  ok(person.status === 200 && person.body.includes('<div id="app"></div>'), `${PROFILE} (person) status ${person.status} or no app shell`);
  ok(person.h('content-security-policy').includes("default-src 'self'"), `${PROFILE} (person) has no security policy header`);
  ok(person.h('x-frame-options') === 'SAMEORIGIN', `${PROFILE} (person) has no frame protection header`);
  if (expectWorker) ok(person.h('x-geohub-worker') === 'pass', `${PROFILE} (person) did not go through the preview worker`);
  if (script) ok(person.body.includes(script), `${PROFILE} (person) serves a different app version than /`);

  const fb = await get(PROFILE, FACEBOOK);
  ok(fb.status === 200 && fb.body.includes('<div id="app"></div>'), `${PROFILE} (Facebook) status ${fb.status} or no app shell`);
  if (expectWorker) {
    ok(['page', 'cached'].includes(fb.h('x-geohub-preview')), `${PROFILE} (Facebook) card is "${fb.h('x-geohub-preview') || 'none'}", expected the real profile`);
    ok(/<meta property="og:title" content="(?!GeoHub — )[^"]+"/.test(fb.body), `${PROFILE} (Facebook) og:title is the generic one`);
    ok(fb.h('content-security-policy').includes("default-src 'self'"), `${PROFILE} (Facebook) has no security policy header`);
  }

  const tg = await get('/post/does-not-exist-smoke', TELEGRAM);
  ok(tg.status === 200 && tg.body.includes('<div id="app"></div>'), `missing post (Telegram) status ${tg.status} or no app shell`);
  if (expectWorker) {
    ok(tg.h('x-geohub-preview') === 'default', `missing post (Telegram) card is "${tg.h('x-geohub-preview') || 'none'}", expected the generic one`);
    ok(tg.body.includes('<meta property="og:title" content="GeoHub — აღმოაჩინე საქართველო">'), 'missing post (Telegram) does not show the generic title');
  }

  if (script) {
    const js = await fetch(`${base}${script}`);
    ok(js.status === 200, `${script} status ${js.status}`);
    ok((js.headers.get('cache-control') || '').includes('immutable'), `${script} is not cached long-term`);
  }
  for (const p of ['/manifest.webmanifest', '/sw.js', '/icons/og-image.png']) {
    const r = await fetch(`${base}${p}`);
    ok(r.status === 200, `${p} status ${r.status}`);
  }
  const spa = await get('/some/unknown/page', HUMAN);
  ok(spa.status === 200 && spa.body.includes('<div id="app"></div>'), `unknown page status ${spa.status} (the app should open)`);

  return problems;
}

const until = Date.now() + waitSec * 1000;
for (;;) {
  let problems;
  try { problems = await run(); } catch (e) { problems = [`request failed: ${e.message}`]; }
  if (!problems.length) { console.log(`SMOKE OK ${base}${expectWorker ? ' (with share-preview worker)' : ''}`); process.exit(0); }
  if (Date.now() > until) {
    console.log(`SMOKE FAILED ${base}`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log(`not yet (${problems.length} problem(s): ${problems[0]}); retrying in 15 s`);
  await new Promise((r) => setTimeout(r, 15000));
}
