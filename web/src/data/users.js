import {
  doc, getDoc, getDocs, onSnapshot, collection, query, where, limit, documentId,
  updateDoc, setDoc, deleteDoc, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { cachedList } from './cache.js';
import { normUser, isCorruptSeed } from './normalize.js';
import { uid as myUid } from '../lib/auth.js';

/* ── Profile cache ─────────────────────────────────────────── */
// Many cards show the same authors; fetch each profile once per session.
const cache = new Map();

export function getUser(id) {
  if (!id) return Promise.resolve(null);
  if (cache.has(id)) return cache.get(id);
  const p = getDoc(doc(db, 'users', id))
    .then((s) => (s.exists() ? normUser(s.id, s.data()) : null))
    .catch(() => null);
  cache.set(id, p);
  return p;
}

/** Fetch many profiles with `in` queries of 10 (a Firestore limit). */
export async function getUsers(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const missing = unique.filter((id) => !cache.has(id));
  for (let i = 0; i < missing.length; i += 10) {
    const chunk = missing.slice(i, i + 10);
    const p = getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)))
      .then((snap) => {
        const map = new Map();
        snap.forEach((d) => map.set(d.id, normUser(d.id, d.data())));
        return map;
      })
      .catch(() => new Map());
    chunk.forEach((id) => cache.set(id, p.then((m) => m.get(id) || null)));
  }
  const users = await Promise.all(unique.map((id) => cache.get(id)));
  return users.filter(Boolean);
}

export function primeUser(user) { if (user?.id) cache.set(user.id, Promise.resolve(user)); }

export function listenUser(id, onData, onError) {
  return onSnapshot(doc(db, 'users', id), (s) => {
    const u = s.exists() ? normUser(s.id, s.data()) : null;
    if (u) primeUser(u);
    onData(u);
  }, onError);
}

/** Resolve "/u/:id" where id may be a uid, a username or a 5-digit GeoHub ID. */
export async function resolveUserKey(key) {
  if (!key) return null;
  const direct = await getUser(key);
  if (direct) return direct.id;
  try {
    const u = await getDoc(doc(db, 'usernames', key.toLowerCase()));
    if (u.exists() && u.data().uid) return u.data().uid;
    if (/^\d{5}$/.test(key)) {
      const g = await getDoc(doc(db, 'geoIds', key));
      if (g.exists() && g.data().uid) return g.data().uid;
    }
  } catch { /* fall through */ }
  return null;
}

/* ── Own profile edits ─────────────────────────────────────── */
// Only fields the owner may write (rules: userAdminOnlyFields).
const EDITABLE = ['fullName', 'displayName', 'bio', 'city', 'website', 'avatar', 'coverImage', 'socialLinks', 'interests', 'accountType', 'privacy', 'nameVisibility', 'birthday', 'work', 'education', 'relationship', 'hometown', 'gender', 'phone', 'cityScope', 'cities', 'notificationPrefs', 'onboardingDone', 'referredBy', 'language'];

export async function updateMyProfile(patch) {
  const id = myUid.value;
  if (!id) throw new Error('auth');
  const clean = {};
  for (const k of EDITABLE) if (k in patch) clean[k] = patch[k];
  if ('fullName' in clean) clean.displayName = clean.fullName;
  clean.updatedAt = Date.now();
  await updateDoc(doc(db, 'users', id), clean);
  cache.delete(id);
}

export async function changeUsername(next, previous) {
  const id = myUid.value;
  const name = String(next || '').trim().toLowerCase();
  if (!/^[a-z0-9_.]{3,24}$/.test(name)) throw Object.assign(new Error('invalid'), { code: 'username-invalid' });
  if (name === previous) return;
  const ref = doc(db, 'usernames', name);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().uid !== id) throw Object.assign(new Error('taken'), { code: 'username-taken' });
  if (!snap.exists()) await setDoc(ref, { uid: id, createdAt: Date.now() });
  await updateDoc(doc(db, 'users', id), { username: name, updatedAt: Date.now() });
  if (previous) deleteDoc(doc(db, 'usernames', previous)).catch(() => {});
  cache.delete(id);
}

/* ── Discovery ─────────────────────────────────────────────── */
function prefix(col, field, term, n = 12) {
  return getDocs(query(collection(db, col), where(field, '>=', term), where(field, '<=', term + ''), limit(n)))
    .then((s) => s.docs)
    .catch(() => []);
}

export async function searchUsers(term, n = 12) {
  const t = String(term || '').trim().replace(/^@/, '');
  if (!t) return [];
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  const lists = await Promise.all([
    prefix('users', 'username', t.toLowerCase(), n),
    prefix('users', 'fullName', t, n),
    cap !== t ? prefix('users', 'fullName', cap, n) : Promise.resolve([]),
    prefix('users', 'displayName', t, n),
  ]);
  const seen = new Set();
  const out = [];
  for (const d of lists.flat()) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    const data = d.data();
    if (isCorruptSeed(data)) continue;
    const u = normUser(d.id, data);
    primeUser(u);
    out.push(u);
  }
  return out.slice(0, n);
}

/** Recently active people, for "people you may know" when there is no graph yet. */
export function recentUsers(n = 20) {
  return cachedList('users:recent', 20, 5 * 60000, loadRecentUsers, n);
}
async function loadRecentUsers(n) {
  let docs = [];
  try {
    docs = (await getDocs(query(collection(db, 'users'), orderBy('lastSeen', 'desc'), limit(n)))).docs;
  } catch {
    docs = (await getDocs(query(collection(db, 'users'), limit(n))).catch(() => ({ docs: [] }))).docs;
  }
  return docs.map((d) => ({ id: d.id, data: d.data() }))
    .filter((x) => !isCorruptSeed(x.data) && !x.data.suspended)
    .map((x) => { const u = normUser(x.id, x.data); primeUser(u); return u; });
}

export function touchPresence(online) {
  const id = myUid.value;
  if (!id) return;
  updateDoc(doc(db, 'users', id), { online, lastSeen: serverTimestamp() }).catch(() => {});
}
