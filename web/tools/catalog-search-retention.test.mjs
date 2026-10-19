import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planCatalogSearchRetention, applyCatalogSearchRetention } from './retain-catalog-search.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ARTIFACTS = path.join(ROOT, '.codex/artifacts');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const catalogRelative = 'web/public/catalog-data';

async function fixture(callback) {
  await fs.mkdir(ARTIFACTS, { recursive: true });
  const root = await fs.mkdtemp(path.join(ARTIFACTS, 'catalog-retention-test-'));
  const catalog = path.join(root, catalogRelative), search = path.join(catalog, 'search');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  await fs.mkdir(search, { recursive: true });
  git('init', '-q'); git('config', 'user.name', 'Retention fixture'); git('config', 'user.email', 'retention-fixture@example.invalid'); git('config', 'core.autocrlf', 'false');
  async function shard(prefix, value) {
    const bytes = Buffer.from(JSON.stringify({ version: 1, rows: [[value, 'product', [], [], []]] }));
    const sha256 = hash(bytes), file = `search/${Buffer.from(prefix).toString('hex')}-0-${sha256.slice(0, 12)}.json`;
    await fs.writeFile(path.join(catalog, file), bytes);
    return { file, sha256, bytes: bytes.length, count: 1 };
  }
  async function publish(number, { commit = true, sameManifest, descriptorTransform } = {}) {
    let file = sameManifest;
    if (!file) {
      const shared = await shard('sh', 'shared item'), unique = await shard('zz', `generation ${number}`);
      const manifest = { version: 1, generatedAt: String(number), buckets: { sh: [shared], zz: [descriptorTransform ? descriptorTransform(unique) : unique] } };
      const bytes = Buffer.from(JSON.stringify(manifest)); file = `search/manifest-${hash(bytes).slice(0, 12)}.json`;
      await fs.writeFile(path.join(catalog, file), bytes);
    }
    await fs.writeFile(path.join(catalog, 'index.json'), JSON.stringify({ version: 1, generatedAt: String(number), venues: {}, search: { manifest: file } }));
    if (commit) { git('add', '--', 'web'); git('commit', '-qm', `Generation ${number}`); }
    return file;
  }
  async function history() {
    const first = await publish(1), second = await publish(2), third = await publish(3);
    await publish('3-unchanged', { sameManifest: third });
    const current = await publish(4, { commit: false });
    return { first, second, third, current };
  }
  try { await callback({ root, catalog, search, publish, history, git }); }
  finally {
    const resolved = await fs.realpath(root), allowed = await fs.realpath(ARTIFACTS);
    assert.ok(path.relative(allowed, resolved).startsWith('catalog-retention-test-') && path.dirname(resolved) === allowed);
    await fs.rm(resolved, { recursive: true, force: true });
  }
}

test('dry run keeps current plus two distinct prior generations, including different HEAD; preserves shared buckets', async () => fixture(async ({ root, search, history }) => {
  const generations = await history(), before = await fs.readdir(search);
  const plan = await planCatalogSearchRetention({ root });
  assert.equal(plan.mode, 'dry-run');
  assert.equal(plan.currentManifest, generations.current);
  assert.deepEqual(plan.previousGenerations.map(value => value.manifest), [generations.third, generations.second]);
  assert.equal(plan.retainedGenerationCount, 3);
  assert.equal(plan.currentFileCount, 3);
  assert.equal(plan.retainedFileCount, 7);
  assert.equal(plan.deleteFileCount, 2);
  assert.ok(plan.deleteFiles.some(entry => entry.file === generations.first));
  assert.ok(plan.retainedFiles.some(entry => entry.file.startsWith('search/7368-')));
  assert.deepEqual(await fs.readdir(search), before, 'planning must not change output');
}));

test('explicit apply deletes only old recognized search hashes, preserving unknown files and all other datasets', async () => fixture(async ({ root, catalog, search, history }) => {
  await history();
  const outsiders = [path.join(search, 'manifest.json'), path.join(search, 'user-note.txt'), path.join(catalog, 'audit.json'), path.join(catalog, 'services-example-123456789abc.json'), path.join(root, 'web/public/place-data/places-0_1-123456789abc.json')];
  for (const file of outsiders) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, 'Must remain'); }
  await fs.mkdir(path.join(search, 'user-folder'));
  const plan = await planCatalogSearchRetention({ root });
  const result = await applyCatalogSearchRetention(plan);
  assert.equal(result.mode, 'applied'); assert.equal(result.deletedFileCount, 2);
  for (const entry of result.deleteFiles) await assert.rejects(fs.access(path.join(catalog, entry.file)), { code: 'ENOENT' });
  for (const entry of result.retainedFiles) await fs.access(path.join(catalog, entry.file));
  for (const file of outsiders) assert.equal(await fs.readFile(file, 'utf8'), 'Must remain');
  assert.ok((await fs.stat(path.join(search, 'user-folder'))).isDirectory());
  assert.equal((await planCatalogSearchRetention({ root })).deleteFileCount, 0);
}));

test('a committed current generation does not consume one of the previous two slots', async () => fixture(async ({ root, history, git }) => {
  const generations = await history(); git('add', '--', 'web'); git('commit', '-qm', 'Current release');
  const plan = await planCatalogSearchRetention({ root });
  assert.deepEqual(plan.previousGenerations.map(value => value.manifest), [generations.third, generations.second]);
}));

test('first recorded generation retains everything when no earlier generations exist', async () => fixture(async ({ root, publish }) => {
  await publish(1); const plan = await planCatalogSearchRetention({ root });
  assert.equal(plan.retainedGenerationCount, 1); assert.equal(plan.deleteFileCount, 0);
}));

test('missing retained historical manifest fails closed before any deletion', async () => fixture(async ({ root, catalog, search, history }) => {
  const generations = await history(); await fs.unlink(path.join(catalog, generations.second));
  const before = await fs.readdir(search);
  await assert.rejects(planCatalogSearchRetention({ root }), { code: 'ENOENT' });
  assert.deepEqual(await fs.readdir(search), before);
}));

test('missing current shard fails closed', async () => fixture(async ({ root, catalog, history }) => {
  const { current } = await history(), manifest = JSON.parse(await fs.readFile(path.join(catalog, current)));
  await fs.unlink(path.join(catalog, manifest.buckets.zz[0].file));
  await assert.rejects(planCatalogSearchRetention({ root }), { code: 'ENOENT' });
}));

test('corrupted retained content hash and mismatched descriptor metadata fail closed', async () => fixture(async ({ root, catalog, history, publish }) => {
  const { current } = await history(), manifest = JSON.parse(await fs.readFile(path.join(catalog, current)));
  const shard = path.join(catalog, manifest.buckets.zz[0].file), original = await fs.readFile(shard);
  await fs.writeFile(shard, Buffer.concat([original, Buffer.from(' ')]));
  await assert.rejects(planCatalogSearchRetention({ root }), /Content hash mismatch/);
  await fs.writeFile(shard, original);
  await publish(5, { commit: false, descriptorTransform: entry => ({ ...entry, bytes: entry.bytes + 1 }) });
  await assert.rejects(planCatalogSearchRetention({ root }), /Shard integrity mismatch/);
}));

test('corrupt unreferenced generated-looking files are not silently deleted', async () => fixture(async ({ root, search, history }) => {
  await history(); await fs.writeFile(path.join(search, 'abcd-0-000000000000.json'), '{}');
  await assert.rejects(planCatalogSearchRetention({ root }), /Content hash mismatch/);
  await fs.access(path.join(search, 'abcd-0-000000000000.json'));
}));

test('unsupported or escaping current manifest paths are rejected', async () => fixture(async ({ root, catalog, history }) => {
  await history();
  for (const manifest of ['../place-data/manifest.json', 'search/manifest.json', '/search/manifest-000000000000.json']) {
    await fs.writeFile(path.join(catalog, 'index.json'), JSON.stringify({ version: 1, search: { manifest } }));
    await assert.rejects(planCatalogSearchRetention({ root }), /Unsupported search index/);
  }
  await assert.rejects(planCatalogSearchRetention({ root: '.' }), /must be absolute/);
  await assert.rejects(planCatalogSearchRetention({ root: catalog }), /Git checkout root/);
}));

test('generated-looking directory junction is rejected without following it', async () => fixture(async ({ root, search, history }) => {
  await history(); const destination = path.join(root, 'outside-search'); await fs.mkdir(destination);
  await fs.symlink(destination, path.join(search, 'abcd-0-000000000000.json'), 'junction');
  await assert.rejects(planCatalogSearchRetention({ root }), /not a regular file/);
  assert.ok((await fs.stat(destination)).isDirectory());
}));

test('Git historical manifest missing from its commit fails closed even when present locally', async () => fixture(async ({ root, catalog, publish, git }) => {
  const old = await publish(1);
  // Commit an index pointing at an uncommitted manifest, simulating broken publication history.
  const incomplete = await publish(2, { commit: false }); git('add', '--', `${catalogRelative}/index.json`); git('commit', '-qm', 'Incomplete release');
  await publish(3, { commit: false });
  await assert.rejects(planCatalogSearchRetention({ root }), /Git lookup failed/);
  await fs.access(path.join(catalog, old)); await fs.access(path.join(catalog, incomplete));
}));

test('apply rejects stale plans after an importer publishes another index', async () => fixture(async ({ root, catalog, history, publish }) => {
  await history(); const plan = await planCatalogSearchRetention({ root });
  await publish(5, { commit: false });
  await assert.rejects(applyCatalogSearchRetention(plan), /Retention plan changed/);
  for (const entry of plan.deleteFiles) await fs.access(path.join(catalog, entry.file));
}));

test('apply revalidates all retained files before unlinking the first candidate', async () => fixture(async ({ root, catalog, history }) => {
  await history(); const plan = await planCatalogSearchRetention({ root });
  await fs.writeFile(path.join(catalog, plan.retainedFiles.at(-1).file), '{}');
  await assert.rejects(applyCatalogSearchRetention(plan), /Content hash mismatch/);
  for (const entry of plan.deleteFiles) await fs.access(path.join(catalog, entry.file));
}));

test('shallow Git history fails closed instead of treating missing releases as first publication', async () => fixture(async ({ root, catalog, history, git }) => {
  const { first } = await history();
  await fs.writeFile(path.join(root, '.git/shallow'), `${git('rev-parse', 'HEAD').trim()}\n`);
  await assert.rejects(planCatalogSearchRetention({ root }), /Complete Git history is required/);
  await fs.access(path.join(catalog, first));
}));
