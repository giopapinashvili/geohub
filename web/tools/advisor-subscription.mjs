// Personal, local prototype: Codex's supported CLI with the existing ChatGPT
// login. Never copy tokens, use API keys, or expose this runner to public users.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, stat, mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export const PLANNER_FLAGS = [
  'exec', '--ignore-user-config', '--ignore-rules', '--ephemeral',
  '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', '--json',
  '-c', 'features.shell_tool=false', '-c', 'features.unified_exec=false',
  '-c', 'features.shell_snapshot=false', '-c', 'features.plugins=false',
  '-c', 'features.apps=false', '-c', 'features.skip_host_skill_discovery=true',
  '-c', 'features.hooks=false', '-c', 'features.multi_agent=false',
  '-c', 'features.browser_use=false', '-c', 'features.browser_use_external=false',
  '-c', 'features.computer_use=false', '-c', 'features.image_generation=false',
  '-c', 'features.view_image=false', '-c', 'features.goals=false',
  '-c', 'features.sleep_tool=false', '-c', 'features.code_mode_host=false',
  '-c', 'features.workspace_dependencies=false', '-c', 'features.memories=false',
  '-c', 'features.skill_search=false', '-c', 'web_search="disabled"',
  '-c', 'approval_policy="never"', '-c', 'model_reasoning_effort="low"',
];

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['reply', 'placeIds'],
  properties: { reply: { type: 'string' }, placeIds: { type: 'array', items: { type: 'string' } } },
};

function subscriptionEnvironment() {
  const env = { ...process.env };
  for (const key of ['OPENAI_API_KEY', 'CODEX_API_KEY', 'OPENAI_BASE_URL']) delete env[key];
  return env;
}

async function locateCodex() {
  const name = process.platform === 'win32' ? 'codex.exe' : 'codex';
  const onPath = (process.env.PATH || '').split(path.delimiter).map((dir) => path.join(dir, name)).find(existsSync);
  if (onPath) return onPath;
  const root = path.join(process.env.LOCALAPPDATA || '', 'OpenAI', 'Codex', 'bin');
  const candidates = [];
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, entry.name, name);
    if (existsSync(file)) candidates.push({ file, at: (await stat(file)).mtimeMs });
  }
  candidates.sort((a, b) => b.at - a.at);
  if (!candidates.length) throw new Error('Codex ვერ მოიძებნა. გახსენი Codex და შედი ChatGPT ანგარიშით.');
  return candidates[0].file;
}

function stopChild(child) {
  if (child.exitCode !== null || !child.pid) return Promise.resolve();
  const closed = new Promise((resolve) => {
    const done = () => { clearTimeout(timer); child.removeListener('close', done); resolve(); };
    const timer = setTimeout(done, 2500);
    child.once('close', done);
  });
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    killer.on('error', () => child.kill());
  } else child.kill('SIGTERM');
  return closed;
}

export function createSubscriptionRunner({ locate = locateCodex, spawnImpl = spawn, stop = stopChild } = {}) {
  async function status() {
    try {
      const executable = await locate();
      const ready = await new Promise((resolve) => {
        const child = spawnImpl(executable, ['login', 'status'], { env: subscriptionEnvironment(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '', settled = false;
        const finish = (value) => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
        const timer = setTimeout(() => { stop(child); finish(false); }, 8000);
        const collect = (chunk) => { output = (output + chunk).slice(-3000); };
        child.stdout.on('data', collect); child.stderr.on('data', collect);
        child.once('error', () => finish(false));
        child.once('close', (code) => finish(code === 0 && /logged in using chatgpt/i.test(output)));
      });
      return { ready, provider: 'ChatGPT', note: ready ? 'დაკავშირებულია შენს ChatGPT გამოწერასთან.' : 'Codex-ში ChatGPT ანგარიშით შესვლა სჭირდება.' };
    } catch (error) { return { ready: false, provider: 'ChatGPT', note: error.message }; }
  }

  async function ask(prompt, { signal, timeoutMs = 120000 } = {}) {
    if (signal?.aborted) throw new Error('მოთხოვნა შეჩერებულია.');
    // Check the auth mode before every call. No API-key or paid-provider fallback.
    if (!(await status()).ready) throw new Error('ChatGPT გამოწერის კავშირი მიუწვდომელია.');
    if (signal?.aborted) throw new Error('მოთხოვნა შეჩერებულია.');
    const executable = await locate();
    const dir = await mkdtemp(path.join(os.tmpdir(), 'geohub-advisor-'));
    const schemaFile = path.join(dir, 'answer.schema.json');
    await writeFile(schemaFile, JSON.stringify(SCHEMA));
    try {
      return await new Promise((resolve, reject) => {
        const child = spawnImpl(executable, [...PLANNER_FLAGS, '--output-schema', schemaFile, '-C', dir, '--', '-'], {
          cwd: dir, env: subscriptionEnvironment(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
        });
        let buffer = '', answer = '', settled = false, completed = false, outputBytes = 0;
        let timer;
        const abort = () => finish(new Error('მოთხოვნა შეჩერებულია.'));
        const finish = (error) => {
          if (settled) return;
          settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
          if (error) Promise.resolve(stop(child)).then(() => reject(error), () => reject(error));
          else resolve(answer);
        };
        timer = setTimeout(() => finish(new Error('პასუხი დაგვიანდა. სცადე უფრო მოკლე შეკითხვა.')), Math.min(120000, Math.max(1000, timeoutMs)));
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) { abort(); return; }
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
          outputBytes += Buffer.byteLength(chunk);
          if (outputBytes > 1024 * 1024) { finish(new Error('პასუხი ძალიან დიდია.')); return; }
          buffer += chunk;
          let newline;
          while ((newline = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
            let event;
            try { event = JSON.parse(line); } catch { continue; }
            if (event.type === 'item.completed' && event.item?.type === 'agent_message') answer = event.item.text || '';
            if (event.type === 'turn.completed') completed = true;
            if (event.type === 'turn.failed' || event.type === 'error') {
              finish(new Error('ChatGPT-მ მოთხოვნა ვერ დაასრულა. შეამოწმე გამოწერის დარჩენილი ლიმიტი და კავშირი.'));
            }
          }
        });
        // Drain diagnostics, but never forward raw process output to the browser.
        child.stderr.resume();
        child.once('error', () => finish(new Error('ChatGPT-ის დამხმარე პროცესი ვერ გაეშვა.')));
        child.once('close', (code) => finish(code === 0 && completed && answer ? null : new Error('ChatGPT-ის პასუხი ვერ დასრულდა.')));
        child.stdin.on('error', () => {});
        child.stdin.end(prompt);
      });
    } finally {
      // Only remove the exact generated schema and then the empty directory.
      await rm(schemaFile, { force: true }).catch(() => {});
      await rmdir(dir).catch(() => {});
    }
  }
  return { status, ask };
}
