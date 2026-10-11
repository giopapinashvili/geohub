// Firestore indexes and security rules through the Admin SDK service account
// (no `firebase login` needed). Run from the repo root on a machine that can
// reach Google APIs:
//
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\serviceAccountKey.json
//   node web/tools/admin-deploy.mjs list-indexes    print the project's composite indexes and their state
//   node web/tools/admin-deploy.mjs check-rules     compile firestore.rules on Google's side, release nothing
//   node web/tools/admin-deploy.mjs indexes         create every index in firestore.indexes.json, wait until READY
//   node web/tools/admin-deploy.mjs backup-rules    save the live rules to firestore.rules.production-<time>
//   node web/tools/admin-deploy.mjs release-rules   save the live rules, then compile and release firestore.rules
//   node web/tools/admin-deploy.mjs rollback-rules <file>   release an earlier saved rules file
//   node web/tools/admin-deploy.mjs fix-reward-prices   copy pointPrice → cost on rewards (for the old function)

import { initializeApp, cert } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const cmd = process.argv[2];
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
if (!existsSync(keyPath)) { console.error(`Service account key not found: ${keyPath}`); process.exit(1); }
const key = JSON.parse(readFileSync(keyPath, 'utf8'));
const credential = cert(key);
const PROJECT = key.project_id;
initializeApp({ credential, projectId: PROJECT });

const API = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`;
async function api(path, init = {}) {
  const { access_token: token } = await credential.getAccessToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

const sameFields = (a, b) => a.length === b.length && a.every((f, i) => f.fieldPath === b[i].fieldPath
  && (f.order || null) === (b[i].order || null) && (f.arrayConfig || null) === (b[i].arrayConfig || null));

async function listIndexes() {
  const out = [];
  let page = '';
  do {
    // Listing across all collection groups ('-') accepts no page size.
    const r = await api(`/collectionGroups/-/indexes${page ? `?pageToken=${encodeURIComponent(page)}` : ''}`);
    if (r.status !== 200) throw new Error(`list indexes failed: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    for (const ix of r.body.indexes || []) {
      const cg = ix.name.split('/collectionGroups/')[1].split('/')[0];
      // Firestore appends __name__ to stored indexes; compare without it.
      const fields = (ix.fields || []).filter((f) => f.fieldPath !== '__name__');
      out.push({ cg, scope: ix.queryScope, fields, state: ix.state, name: ix.name });
    }
    page = r.body.nextPageToken || '';
  } while (page);
  return out;
}

async function indexes() {
  // Compare without __name__ on both sides (some entries in the file list it explicitly).
  const wanted = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')).indexes
    .map((w) => ({ ...w, fields: w.fields.filter((f) => f.fieldPath !== '__name__') }));
  let have = await listIndexes();
  const find = (w) => have.find((h) => h.cg === w.collectionGroup && h.scope === (w.queryScope || 'COLLECTION') && sameFields(h.fields, w.fields));
  let created = 0;
  for (const w of wanted) {
    if (find(w)) continue;
    const r = await api(`/collectionGroups/${w.collectionGroup}/indexes`, {
      method: 'POST',
      body: JSON.stringify({ queryScope: w.queryScope || 'COLLECTION', fields: w.fields }),
    });
    if (r.status === 200 || r.status === 409) { created++; console.log(`  + ${w.collectionGroup} (${w.fields.map((f) => f.fieldPath).join(', ')}) — ${r.status === 409 ? 'already exists' : 'creating'}`); }
    else { console.error(`  ! ${w.collectionGroup}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`); process.exitCode = 1; }
  }
  console.log(`${created} index(es) requested; waiting until all are READY…`);
  for (let i = 0; i < 120; i++) { // up to ~30 minutes
    have = await listIndexes();
    const pending = wanted.filter((w) => { const h = find(w); return !h || h.state !== 'READY'; });
    if (!pending.length) { console.log('ALL INDEXES READY'); return; }
    if (i % 4 === 0) console.log(`  still building: ${pending.map((w) => `${w.collectionGroup}(${w.fields.map((f) => f.fieldPath).join('+')})`).join(', ')}`);
    await new Promise((r) => setTimeout(r, 15000));
  }
  console.error('Timed out waiting for indexes — check the Firebase console.');
  process.exitCode = 1;
}

/* Save the rules that are live right now, so a release can be rolled back. */
async function backupRules() {
  const current = await getSecurityRules().getFirestoreRuleset();
  const file = `firestore.rules.production-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
  writeFileSync(file, current.source.map((f) => f.content).join('\n'));
  console.log(`Live rules saved to ${file} (ruleset ${current.name}, created ${current.createTime})`);
  return file;
}

async function compileRules(path = 'firestore.rules') {
  const source = readFileSync(path, 'utf8');
  const sr = getSecurityRules();
  const ruleset = await sr.createRuleset(sr.createRulesFileFromSource('firestore.rules', source));
  console.log(`Rules compiled OK on Google's side (ruleset ${ruleset.name}).`);
  return { sr, ruleset };
}

async function main() {
  if (cmd === 'list-indexes') {
    const have = await listIndexes();
    for (const h of have) console.log(`${h.state.padEnd(9)} ${h.cg} (${h.fields.map((f) => `${f.fieldPath} ${f.order || f.arrayConfig}`).join(', ')})`);
    console.log(`${have.length} composite index(es)`);
    return;
  }
  if (cmd === 'backup-rules') { await backupRules(); return; }
  if (cmd === 'check-rules') { await compileRules(); return; }
  if (cmd === 'release-rules' || cmd === 'rollback-rules') {
    const path = cmd === 'rollback-rules' ? process.argv[3] : 'firestore.rules';
    if (!path || !existsSync(path)) { console.error(`Rules file not found: ${path}`); process.exitCode = 2; return; }
    await backupRules();
    const { sr, ruleset } = await compileRules(path);
    await sr.releaseFirestoreRuleset(ruleset);
    console.log(`RULES RELEASED from ${path}`);
    return;
  }
  if (cmd === 'indexes') { await indexes(); return; }
  if (cmd === 'fix-reward-prices') {
    const db = getFirestore();
    const snap = await db.collection('rewards').get();
    let n = 0;
    for (const d of snap.docs) {
      const r = d.data();
      if (r.cost == null && r.pointPrice != null) { await d.ref.update({ cost: Number(r.pointPrice) || 0 }); n++; }
    }
    console.log(`rewards updated with cost: ${n}`);
    return;
  }
  console.error('Usage: node web/tools/admin-deploy.mjs list-indexes | backup-rules | check-rules | indexes | release-rules | rollback-rules <file> | fix-reward-prices');
  process.exitCode = 2;
}

main().catch((e) => {
  console.error('FAILED:', e.code || '', e.message);
  if (e.errorInfo) console.error(JSON.stringify(e.errorInfo).slice(0, 2000));
  process.exitCode = 1;
});
