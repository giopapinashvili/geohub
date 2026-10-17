// Waits for the GitHub checks of one commit (public repo, no token needed).
// Exit 0 when the required checks passed, 1 when one failed, 2 on timeout.
//   node web/tools/wait-ci.mjs <commit-sha> ["--also=Check name" ...] [--minutes=25]
// Each --also adds one more required check (names may contain commas).
const args = process.argv.slice(2);
const sha = args.find((a) => !a.startsWith('--'));
if (!sha) { console.error('usage: wait-ci.mjs <sha> ["--also=Check name" ...] [--minutes=N]'); process.exit(2); }
const REQUIRED = ['Lint, translations and build', 'Security rules (emulator)',
  ...args.filter((a) => a.startsWith('--also=')).map((a) => a.slice('--also='.length).trim()).filter(Boolean)];
const minutes = Number((args.find((a) => a.startsWith('--minutes=')) || '').split('=')[1]) || 20;
const url = `https://api.github.com/repos/giopapinashvili/geohub/commits/${sha}/check-runs?per_page=50`;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const deadline = Date.now() + minutes * 60000;
console.log(`waiting for: ${REQUIRED.join(' | ')}`);
while (Date.now() < deadline) {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'geohub-deploy' } });
    if (r.status === 403 || r.status === 429) {
      // Unauthenticated API: 60 requests an hour. Wait for the reset instead of failing.
      const reset = Number(r.headers.get('x-ratelimit-reset')) * 1000;
      const pause = Math.min(Math.max((reset || 0) - Date.now(), 30000), 10 * 60000);
      console.log(`GitHub rate limit; waiting ${Math.round(pause / 1000)} s`);
      await sleep(pause);
      continue;
    }
    const runs = (await r.json()).check_runs || [];
    console.log(new Date().toISOString().slice(11, 19), runs.map((c) => `${c.name}: ${c.status}/${c.conclusion || '-'}`).join(' | ') || 'waiting for checks…');
    const req = REQUIRED.map((n) => runs.find((c) => c.name === n));
    const bad = req.find((c) => c && c.status === 'completed' && !['success', 'neutral', 'skipped'].includes(c.conclusion));
    if (bad) { console.log(`A REQUIRED CHECK FAILED: ${bad.name} (${bad.conclusion})`); process.exit(1); }
    if (req.every((c) => c && c.status === 'completed')) { console.log('REQUIRED CHECKS PASSED'); process.exit(0); }
  } catch (e) { console.log('check failed to load:', e.message); }
  await sleep(20000);
}
console.log('Timed out waiting for checks');
process.exit(2);
