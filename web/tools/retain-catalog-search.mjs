import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CATALOG = 'web/public/catalog-data';
const INDEX = `${CATALOG}/index.json`;
const MANIFEST = /^search\/manifest-([a-f0-9]{12})\.json$/;
const SHARD = /^search\/((?:[a-f0-9]{2})+)-(0|[1-9]\d*)-([a-f0-9]{12})\.json$/;
const digest = value => createHash('sha256').update(value).digest('hex');
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const inside = (root, target) => { const relative = path.relative(root, target); return relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative); };
const generated = file => MANIFEST.test(file) || SHARD.test(file);
const json = (bytes, label) => { try { return JSON.parse(bytes.toString('utf8')); } catch { throw new Error(`Invalid JSON: ${label}`); } };

function git(root, args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) { throw new Error(`Git lookup failed (${args[0]}): ${error.message}`); }
}

async function checkedPath(root, relative, directory = false) {
  const target = path.resolve(root, relative);
  if (!inside(root, target)) throw new Error(`Path outside workspace: ${relative}`);
  let cursor = root;
  const segments = path.relative(root, target).split(path.sep);
  for (let i = 0; i < segments.length; i++) {
    cursor = path.join(cursor, segments[i]);
    const info = await fs.lstat(cursor);
    if (info.isSymbolicLink()) throw new Error(`Symlink/junction is not permitted: ${cursor}`);
    if (i < segments.length - 1 || directory) {
      if (!info.isDirectory()) throw new Error(`Expected directory: ${cursor}`);
    } else if (!info.isFile()) throw new Error(`Expected regular file: ${cursor}`);
  }
  if (!samePath(await fs.realpath(target), target)) throw new Error(`Path resolves elsewhere: ${target}`);
  return target;
}

function manifestFile(index, label) {
  if (index?.version !== 1 || !MANIFEST.test(index.search?.manifest || '')) throw new Error(`Unsupported search index: ${label}`);
  return index.search.manifest;
}

function manifestEntries(value, label) {
  if (value?.version !== 1 || !value.buckets || Array.isArray(value.buckets) || typeof value.buckets !== 'object') throw new Error(`Unsupported search manifest: ${label}`);
  const entries = [];
  for (const [prefix, bucket] of Object.entries(value.buckets)) {
    if (!Array.isArray(bucket)) throw new Error(`Invalid bucket: ${label}`);
    for (const entry of bucket) {
      const match = SHARD.exec(entry?.file || '');
      if (!match || match[1] !== Buffer.from(prefix).toString('hex') || !/^[a-f0-9]{64}$/.test(entry.sha256 || '') || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || !Number.isSafeInteger(entry.count) || entry.count < 0) throw new Error(`Invalid shard descriptor: ${label}`);
      entries.push(entry);
    }
  }
  return entries;
}

/** Read-only. The fixture root argument is also checked against its own Git root. */
export async function planCatalogSearchRetention({ root = DEFAULT_ROOT } = {}) {
  if (!path.isAbsolute(root)) throw new Error('Workspace root must be absolute');
  root = path.normalize(root);
  if (!samePath(await fs.realpath(root), root)) throw new Error('Workspace root must be its resolved physical path');
  const gitRoot = path.resolve(git(root, ['rev-parse', '--show-toplevel']).trim());
  if (!samePath(gitRoot, root)) throw new Error('Workspace root must be the Git checkout root');
  if (git(root, ['rev-parse', '--is-shallow-repository']).trim() !== 'false') throw new Error('Complete Git history is required; shallow publication history cannot be pruned safely');
  const searchRoot = await checkedPath(root, `${CATALOG}/search`, true);
  const indexPath = await checkedPath(root, INDEX);
  const indexBytes = await fs.readFile(indexPath);
  const currentManifest = manifestFile(json(indexBytes, INDEX), INDEX);
  const previous = [];
  const seen = new Set([currentManifest]);
  // Index commits are conservatively treated as potentially published generations.
  const history = git(root, ['log', '--format=%H', '--', INDEX]).trim().split(/\r?\n/).filter(Boolean);
  if (!history.length) throw new Error('No committed catalog index history; publication history must be established first');
  for (const commit of history) {
    if (!/^[a-f0-9]{40,64}$/.test(commit)) throw new Error('Invalid Git revision');
    const historicalIndex = json(git(root, ['show', `${commit}:${INDEX}`]), `${commit}:${INDEX}`);
    const file = manifestFile(historicalIndex, `${commit}:${INDEX}`);
    if (seen.has(file)) continue;
    seen.add(file); previous.push({ manifest: file, commit });
    if (previous.length === 2) break;
  }
  const snapshots = new Map();
  async function readGenerated(file) {
    if (!generated(file)) throw new Error(`Unapproved generated filename: ${file}`);
    const target = await checkedPath(root, `${CATALOG}/${file}`);
    const bytes = await fs.readFile(target), sha256 = digest(bytes);
    if (!file.endsWith(`-${sha256.slice(0, 12)}.json`)) throw new Error(`Content hash mismatch: ${file}`);
    const parsed = json(bytes, file);
    if (MANIFEST.test(file)) manifestEntries(parsed, file);
    else if (parsed?.version !== 1 || !Array.isArray(parsed.rows)) throw new Error(`Unsupported search shard: ${file}`);
    const snapshot = { file, bytes: bytes.length, sha256 };
    const before = snapshots.get(file);
    if (before && before.sha256 !== sha256) throw new Error(`Asset changed during planning: ${file}`);
    snapshots.set(file, snapshot);
    return { bytes, parsed, snapshot };
  }
  const retained = new Set(), currentFiles = new Set();
  for (const generation of [{ manifest: currentManifest, commit: null }, ...previous]) {
    const { bytes, parsed } = await readGenerated(generation.manifest);
    if (generation.commit) {
      const original = git(root, ['show', `${generation.commit}:${CATALOG}/${generation.manifest}`]);
      if (digest(Buffer.from(original, 'utf8')) !== digest(bytes)) throw new Error(`Published manifest differs from local file: ${generation.manifest}`);
    }
    retained.add(generation.manifest);
    if (!generation.commit) currentFiles.add(generation.manifest);
    for (const entry of manifestEntries(parsed, generation.manifest)) {
      const { parsed: shard, snapshot } = await readGenerated(entry.file);
      if (entry.sha256 !== snapshot.sha256 || entry.bytes !== snapshot.bytes || entry.count !== shard.rows.length) throw new Error(`Shard integrity mismatch: ${entry.file}`);
      retained.add(entry.file);
      if (!generation.commit) currentFiles.add(entry.file);
    }
  }
  const candidates = [], unknown = [];
  for (const entry of (await fs.readdir(searchRoot, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = `search/${entry.name}`;
    if (!generated(file)) { unknown.push(file); continue; }
    // A generated-looking symlink/directory is a failure, never a deletion target.
    if (!entry.isFile()) throw new Error(`Generated asset is not a regular file: ${file}`);
    const { snapshot } = await readGenerated(file);
    if (!retained.has(file)) candidates.push(snapshot);
  }
  if (digest(await fs.readFile(indexPath)) !== digest(indexBytes)) throw new Error('Catalog index changed during planning; wait until the importer finishes');
  const plan = {
    version: 1, mode: 'dry-run', createdAt: new Date().toISOString(), workspaceRoot: root,
    currentManifest, previousGenerations: previous, currentIndexSha256: digest(indexBytes),
    historyHead: history[0], historyDepthInspected: previous.length < 2 ? history.length : history.indexOf(previous.at(-1).commit) + 1,
    retainedGenerationCount: previous.length + 1, currentFileCount: currentFiles.size, retainedFileCount: retained.size,
    deleteFileCount: candidates.length, deleteBytes: candidates.reduce((n, file) => n + file.bytes, 0),
    totalGeneratedFiles: snapshots.size, preservedUnknownFileCount: unknown.length,
    retainedFiles: [...retained].sort().map(file => snapshots.get(file)), deleteFiles: candidates,
    preservedUnknownFiles: unknown,
    notes: ['Only search hash JSON files are candidates. Place shards, services, venues and unknown files are outside deletion scope.', 'Git index commits are treated as potentially published. Current plus two distinct earlier generations are retained; unchanged manifest commits do not consume a generation.', 'Apply only with the importer and deployment stopped; runtime stale-parent recovery is a separate safeguard.'],
  };
  return plan;
}

const signature = plan => digest(JSON.stringify({ root: plan.workspaceRoot, index: plan.currentIndexSha256, current: plan.currentManifest, previous: plan.previousGenerations, historyHead: plan.historyHead, retained: plan.retainedFiles, remove: plan.deleteFiles, unknown: plan.preservedUnknownFiles }));

/** Re-plan and verify everything before the first unlink; never recursively delete. */
export async function applyCatalogSearchRetention(plan) {
  const current = await planCatalogSearchRetention({ root: plan.workspaceRoot });
  if (signature(current) !== signature(plan)) throw new Error('Retention plan changed; rerun the dry run after the importer finishes');
  for (const entry of current.deleteFiles) {
    const indexPath = await checkedPath(current.workspaceRoot, INDEX);
    if (digest(await fs.readFile(indexPath)) !== current.currentIndexSha256) throw new Error('Catalog index changed during apply; remaining deletions stopped');
    const target = await checkedPath(current.workspaceRoot, `${CATALOG}/${entry.file}`);
    if (!generated(entry.file) || digest(await fs.readFile(target)) !== entry.sha256) throw new Error(`Deletion target changed: ${entry.file}`);
    await fs.unlink(target);
  }
  return { ...current, mode: 'applied', deletedFileCount: current.deleteFiles.length };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply') || new Set(args).size !== args.length) throw new Error('Usage: node web/tools/retain-catalog-search.mjs [--apply]');
  let plan = await planCatalogSearchRetention();
  const artifactRelative = '.codex/artifacts/catalog-retention';
  // Audit reports live outside the published output. Validate each existing parent.
  for (const relative of ['.codex', '.codex/artifacts', artifactRelative]) {
    try { await fs.mkdir(path.join(DEFAULT_ROOT, relative)); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    await checkedPath(DEFAULT_ROOT, relative, true);
  }
  const report = path.join(DEFAULT_ROOT, artifactRelative, 'latest-plan.json');
  try { await checkedPath(DEFAULT_ROOT, `${artifactRelative}/latest-plan.json`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.writeFile(report, `${JSON.stringify(plan, null, 2)}\n`);
  if (args.includes('--apply')) { plan = await applyCatalogSearchRetention(plan); await fs.writeFile(report, `${JSON.stringify(plan, null, 2)}\n`); }
  console.log(JSON.stringify({ mode: plan.mode, currentManifest: plan.currentManifest, previousGenerations: plan.previousGenerations, currentFileCount: plan.currentFileCount, retainedFileCount: plan.retainedFileCount, deleteFileCount: plan.deleteFileCount, deletedFileCount: plan.deletedFileCount || 0, preservedUnknownFileCount: plan.preservedUnknownFileCount, report }, null, 2));
}

if (process.argv[1] && samePath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) main().catch(error => { console.error(error.message); process.exitCode = 1; });
