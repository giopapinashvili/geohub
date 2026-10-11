// Runs the whole end-to-end suite inside `firebase emulators:exec`
// (production firestore.rules on the Firestore + Auth emulators):
// seed → emulator build on :5173 → feature flows, page sweep, calls.
// Every suite runs even if an earlier one fails, so one CI run shows all.
//   npm run test:e2e:ci
import { spawn } from 'node:child_process';

const run = (cmd, args) => new Promise((resolve) => {
  const p = spawn(cmd, args, { stdio: 'inherit' });
  p.on('exit', (code) => resolve(code ?? 1));
});

if (await run('node', ['web/tools/seed-emulator.mjs'])) process.exit(1);

const vite = spawn('npx', ['vite', '--mode', 'emulator', '--port', '5173', '--strictPort', '--host', '127.0.0.1'], { stdio: 'inherit' });
let up = false;
for (let i = 0; i < 90 && !up; i++) {
  try { up = (await fetch('http://127.0.0.1:5173/')).ok; } catch { /* not yet */ }
  if (!up) await new Promise((r) => setTimeout(r, 1000));
}
if (!up) { console.error('dev server did not start'); vite.kill(); process.exit(1); }

const suites = [
  ['web/tools/e2e-flows.mjs', []],
  ['web/tools/sweep.mjs', ['--as=nino', '--w=360,1280']],
  ['web/tools/sweep.mjs', ['--w=360']],
  ['web/tools/e2e-call.mjs', []],
];
const failed = [];
for (const [script, args] of suites) {
  console.log(`\n===== ${script} ${args.join(' ')} =====`);
  if (await run('node', [script, ...args])) failed.push(`${script} ${args.join(' ')}`.trim());
}
vite.kill();
console.log(failed.length ? `\nFAILED: ${failed.join(' | ')}` : '\nALL E2E SUITES PASSED');
process.exit(failed.length ? 1 : 0);
