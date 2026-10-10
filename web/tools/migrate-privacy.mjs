// One-off data update that goes with the stricter firestore.rules.
// DRY RUN by default: prints what it would change. Add --apply to write.
// Never deletes posts, users or businesses — it only adds/moves fields.
//
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node web/tools/migrate-privacy.mjs
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node web/tools/migrate-privacy.mjs --apply
//
// What it does:
//   1. posts without `visibility`            → visibility: 'public'  (the feed query asks for it)
//   2. posts in private/secret groups marked 'public' → visibility: 'group' (members only)
//   3. friends-only posts without audienceIds → audienceIds: [author, ...friends]
//   4. unexpired stories without closeFriends → closeFriends: false
//   5. users with email/phone/birthday/searchHistory in the public document
//      → moved to users/{uid}/private/account and removed from users/{uid}

import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
if (!existsSync(keyPath)) {
  console.error(`Service account key not found at ${keyPath}. Set GOOGLE_APPLICATION_CREDENTIALS.`);
  process.exit(1);
}
const key = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: key.private_key ? cert(key) : applicationDefault(), projectId: key.project_id });
const db = getFirestore();
console.log(`${APPLY ? 'APPLYING changes to' : 'DRY RUN on'} project ${key.project_id}\n`);

const PRIVATE_FIELDS = ['email', 'phone', 'birthday', 'searchHistory'];
const pair = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

/* Batched writer: 400 operations per commit. */
let batch = db.batch();
let ops = 0;
let total = 0;
async function write(fn, n = 1) {
  total++;
  if (!APPLY) return;
  fn(batch);
  ops += n;
  if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
}
async function flush() { if (APPLY && ops) { await batch.commit(); batch = db.batch(); ops = 0; } }

/* Stream a whole collection in pages so big collections don't load at once. */
async function* each(col, pageSize = 500) {
  let last = null;
  for (;;) {
    let q = db.collection(col).orderBy('__name__').limit(pageSize);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) return;
    for (const d of snap.docs) yield d;
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) return;
  }
}

/* Friends of a user, from both collections the app has used. */
const friendCache = new Map();
async function friendsOf(uid) {
  if (friendCache.has(uid)) return friendCache.get(uid);
  const ids = new Set();
  for (const col of ['friendships', 'friends']) {
    const s = await db.collection(col).where('users', 'array-contains', uid).limit(2000).get();
    for (const d of s.docs) for (const u of d.data().users || []) if (u !== uid) ids.add(u);
  }
  const list = [...ids];
  friendCache.set(uid, list);
  return list;
}

const groupPrivacy = new Map();
async function privacyOf(groupId) {
  if (!groupPrivacy.has(groupId)) {
    const g = await db.doc(`groups/${groupId}`).get();
    groupPrivacy.set(groupId, g.exists ? (g.data().privacy || 'public') : 'public');
  }
  return groupPrivacy.get(groupId);
}

/* 1–3: posts */
const counts = { noVisibility: 0, privateGroup: 0, friendsAudience: 0, stories: 0, users: 0 };
for await (const d of each('posts')) {
  const p = d.data();
  const patch = {};
  if (!('visibility' in p)) { patch.visibility = 'public'; counts.noVisibility++; }
  const groupId = p.groupId || (p.targetType === 'group' ? p.targetId : null);
  const vis = patch.visibility || p.visibility;
  if (groupId && vis === 'public' && (await privacyOf(groupId)) !== 'public') { patch.visibility = 'group'; counts.privateGroup++; }
  if ((vis === 'friends' || vis === 'followers') && !Array.isArray(p.audienceIds)) {
    const author = p.authorId || p.userId;
    if (author) { patch.audienceIds = [author, ...(await friendsOf(author))].slice(0, 2000); counts.friendsAudience++; }
  }
  if (Object.keys(patch).length) {
    if (total < 15) console.log(`posts/${d.id}`, patch.visibility ? `visibility → ${patch.visibility}` : '', patch.audienceIds ? `audienceIds (${patch.audienceIds.length})` : '');
    await write((b) => b.update(d.ref, patch));
  }
}

/* 4: unexpired stories */
const now = Date.now();
for await (const d of each('stories')) {
  const s = d.data();
  const exp = s.expiresAt?.toMillis ? s.expiresAt.toMillis() : (typeof s.expiresAt === 'number' ? s.expiresAt : null);
  if (!('closeFriends' in s) && (!exp || exp > now)) { counts.stories++; await write((b) => b.update(d.ref, { closeFriends: false })); }
}

/* 5: users — move private fields */
for await (const d of each('users')) {
  const u = d.data();
  const present = PRIVATE_FIELDS.filter((k) => k in u);
  if (!present.length) continue;
  counts.users++;
  const priv = {};
  for (const k of present) priv[k] = u[k];
  await write((b) => {
    b.set(db.doc(`users/${d.id}/private/account`), { ...priv, migratedAt: FieldValue.serverTimestamp() }, { merge: true });
    b.update(d.ref, Object.fromEntries(present.map((k) => [k, FieldValue.delete()])));
  }, 2);
}

await flush();
console.log('\nSummary');
console.log(`  posts without visibility → public:        ${counts.noVisibility}`);
console.log(`  private-group posts → members only:       ${counts.privateGroup}`);
console.log(`  friends-only posts given an audience list: ${counts.friendsAudience}`);
console.log(`  live stories marked public explicitly:     ${counts.stories}`);
console.log(`  profiles with private fields moved:        ${counts.users}`);
console.log(APPLY ? '\nDone.' : '\nNothing was written. Run again with --apply to make these changes.');
process.exit(0);
