// Waits for the GitHub checks of one commit (public repo, no token needed).
// Exit 0 when the required checks passed, 1 when one failed, 2 on timeout.
//   node web/tools/wait-ci.mjs <commit-sha>
const sha = process.argv[2];
if (!sha) { console.error('usage: wait-ci.mjs <sha>'); process.exit(2); }
const REQUIRED = ['Lint, translations and build', 'Security rules (emulator)'];
const url = `https://api.github.com/repos/giopapinashvili/geohub/commits/${sha}/check-runs?per_page=50`;
for (let i = 0; i < 80; i++) {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'geohub-deploy' } });
    const runs = (await r.json()).check_runs || [];
    console.log(new Date().toISOString().slice(11, 19), runs.map((c) => `${c.name}: ${c.status}/${c.conclusion || '-'}`).join(' | ') || 'waiting for checks…');
    const req = REQUIRED.map((n) => runs.find((c) => c.name === n));
    if (req.every((c) => c && c.status === 'completed')) {
      const ok = req.every((c) => c.conclusion === 'success');
      console.log(ok ? 'REQUIRED CHECKS PASSED' : 'A REQUIRED CHECK FAILED');
      process.exit(ok ? 0 : 1);
    }
  } catch (e) { console.log('check failed to load:', e.message); }
  await new Promise((res) => setTimeout(res, 15000));
}
console.log('Timed out waiting for checks');
process.exit(2);
