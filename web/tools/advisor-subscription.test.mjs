import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { existsSync } from 'node:fs';
import { createSubscriptionRunner, PLANNER_FLAGS } from './advisor-subscription.mjs';

function fakeProcess(args, close, reply, events, options) {
  const child = new EventEmitter();
  child.exitCode = null; child.pid = 12345;
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  const end = (code) => { child.exitCode = code; child.emit('close', code); };
  child.kill = () => end(1);
  if (args[0] === 'login') queueMicrotask(() => { child.stdout.write(close); end(0); });
  child.stdin = new Writable({ write(chunk, encoding, next) { next(); }, final(next) {
    queueMicrotask(() => {
      if (reply === 'hold') return;
      child.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: reply } }) + '\n');
      child.stdout.write(JSON.stringify({ type: 'turn.completed' }) + '\n');
      end(0);
    }); next();
  } });
  events.push({ args, options });
  return child;
}

test('only authenticated ChatGPT path is used; tools disabled, no API env, no stored conversation', async () => {
  const events = [];
  const runner = createSubscriptionRunner({ locate: async () => 'codex', spawnImpl: (exe, args, options) => fakeProcess(args, 'Logged in using ChatGPT', '{"reply":"გამარჯობა","placeIds":[]}', events, options), stop: (child) => child.kill() });
  assert.match(await runner.ask('მხოლოდ მოცემული მონაცემები გამოიყენე'), /გამარჯობა/);
  const exec = events.find((event) => event.args[0] === 'exec');
  assert(exec.args.includes('--ignore-user-config'));
  assert(exec.args.includes('--ignore-rules'));
  assert(exec.args.includes('--ephemeral'));
  assert(exec.args.includes('features.plugins=false'));
  assert(exec.args.includes('features.hooks=false'));
  assert(exec.args.includes('features.shell_tool=false'));
  assert.equal(exec.options.env.OPENAI_API_KEY, undefined);
  assert.equal(exec.options.env.CODEX_API_KEY, undefined);
  assert.equal(existsSync(exec.options.cwd), false);
  assert(!PLANNER_FLAGS.includes('--dangerously-bypass-hook-trust'));
});

test('API-key authentication cannot incur metered spend', async () => {
  const events = [];
  const runner = createSubscriptionRunner({ locate: async () => 'codex', spawnImpl: (exe, args, options) => fakeProcess(args, 'Logged in using API key', '', events, options), stop: (child) => child.kill() });
  await assert.rejects(runner.ask('hello'), /გამოწერის/);
  assert.equal(events.filter((event) => event.args[0] === 'exec').length, 0);
});

test('cancel stops an in-flight generation', async () => {
  const events = [];
  let stopped = 0;
  const controller = new AbortController();
  const runner = createSubscriptionRunner({ locate: async () => 'codex', spawnImpl: (exe, args, options) => {
    const child = fakeProcess(args, 'Logged in using ChatGPT', 'hold', events, options);
    if (args[0] === 'exec') queueMicrotask(() => controller.abort());
    return child;
  }, stop: (child) => { stopped++; child.kill(); } });
  await assert.rejects(runner.ask('hello', { signal: controller.signal }), /შეჩერებულია/);
  assert.equal(stopped, 1);
});
