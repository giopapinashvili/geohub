// Social graph: follows, friendships, friend requests, blocks, mutes, hides.
// Document IDs and field names match the old site and firestore.rules.

import {
  doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query,
  where, limit, serverTimestamp, increment, getCountFromServer,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { me, uid as myUid } from '../lib/auth.js';
import { getUser, getUsers } from './users.js';
import { notify } from './notify.js';
import { tsToMillis } from '../lib/format.js';

export const pairId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

function requireUid() {
  const id = myUid.value;
  if (!id) throw Object.assign(new Error('auth'), { code: 'auth' });
  return id;
}

async function privacyOf(userId) {
  const u = await getUser(userId);
  return { followPref: 'everyone', friendRequestPref: 'everyone', messagingPref: 'everyone', ...(u?.privacy || {}) };
}

/* ── Follows ───────────────────────────────────────────────── */

export async function follow(target) {
  const id = requireUid();
  if (target === id) return;
  const pref = (await privacyOf(target)).followPref;
  if (pref === 'nobody') throw Object.assign(new Error('follow-disabled'), { code: 'follow-disabled' });
  await setDoc(doc(db, 'follows', `${id}_${target}`), { followerId: id, followingId: target, createdAt: serverTimestamp() });
  updateDoc(doc(db, 'users', id), { following: increment(1) }).catch(() => {});
  const m = me();
  notify(target, {
    type: 'follow', title: `${m.name} გამოგიწერა`, body: '', href: `profile.html?id=${id}`,
    extra: { followerId: id }, dedupKey: `follow_${id}_${target}`,
  });
}

export async function unfollow(target) {
  const id = requireUid();
  await deleteDoc(doc(db, 'follows', `${id}_${target}`));
  updateDoc(doc(db, 'users', id), { following: increment(-1) }).catch(() => {});
}

export function listenIsFollowing(target, onData) {
  const id = myUid.value;
  if (!id || id === target) { onData(false); return () => {}; }
  return onSnapshot(doc(db, 'follows', `${id}_${target}`), (s) => onData(s.exists()), () => onData(false));
}

export async function followCounts(userId) {
  const col = collection(db, 'follows');
  const [a, b] = await Promise.all([
    getCountFromServer(query(col, where('followingId', '==', userId))).then((s) => s.data().count).catch(() => null),
    getCountFromServer(query(col, where('followerId', '==', userId))).then((s) => s.data().count).catch(() => null),
  ]);
  return { followers: a, following: b };
}

export async function listFollowers(userId, n = 60) {
  const s = await getDocs(query(collection(db, 'follows'), where('followingId', '==', userId), limit(n)));
  return getUsers(s.docs.map((d) => d.data().followerId));
}

export async function listFollowing(userId, n = 60) {
  const s = await getDocs(query(collection(db, 'follows'), where('followerId', '==', userId), limit(n)));
  return getUsers(s.docs.map((d) => d.data().followingId));
}

/* ── Friendship ────────────────────────────────────────────── */

/**
 * Live friendship state with `target`:
 * { state: 'self'|'none'|'friends'|'outgoing'|'incoming', requestId? }
 * Friendships live in `friends` (current) and `friendships` (older docs).
 */
export function listenFriendship(target, onData) {
  const id = myUid.value;
  if (!id || !target) { onData({ state: 'none' }); return () => {}; }
  if (id === target) { onData({ state: 'self' }); return () => {}; }
  const fid = pairId(id, target);
  const s = { friendA: false, friendB: false, out: null, inc: null };
  let settled = 0;
  const emit = () => {
    if (settled < 4) return;
    if (s.friendA || s.friendB) onData({ state: 'friends', friendId: fid });
    else if (s.inc) onData({ state: 'incoming', requestId: s.inc });
    else if (s.out) onData({ state: 'outgoing', requestId: s.out });
    else onData({ state: 'none' });
  };
  const once = new Set();
  const mark = (k) => { if (!once.has(k)) { once.add(k); settled++; } };
  const unsubs = [
    onSnapshot(doc(db, 'friends', fid), (d) => { s.friendA = d.exists(); mark('a'); emit(); }, () => { mark('a'); emit(); }),
    onSnapshot(doc(db, 'friendships', fid), (d) => { s.friendB = d.exists(); mark('b'); emit(); }, () => { mark('b'); emit(); }),
    onSnapshot(doc(db, 'friendRequests', `${id}_${target}`), (d) => { s.out = d.exists() && d.data().status === 'pending' ? d.id : null; mark('c'); emit(); }, () => { mark('c'); emit(); }),
    onSnapshot(doc(db, 'friendRequests', `${target}_${id}`), (d) => { s.inc = d.exists() && d.data().status === 'pending' ? d.id : null; mark('d'); emit(); }, () => { mark('d'); emit(); }),
  ];
  return () => unsubs.forEach((u) => u());
}

export async function sendFriendRequest(target) {
  const id = requireUid();
  if (target === id) return;
  const [pref, friendsA, friendsB, reverse, other, mine] = await Promise.all([
    privacyOf(target),
    getDoc(doc(db, 'friends', pairId(id, target))).catch(() => null),
    getDoc(doc(db, 'friendships', pairId(id, target))).catch(() => null),
    getDoc(doc(db, 'friendRequests', `${target}_${id}`)).catch(() => null),
    getUser(target),
    getUser(id),
  ]);
  if (pref.friendRequestPref === 'nobody') throw Object.assign(new Error('requests-disabled'), { code: 'requests-disabled' });
  if (friendsA?.exists() || friendsB?.exists()) return 'friends';
  if (reverse?.exists() && reverse.data().status === 'pending') return 'incoming';
  const m = me();
  await setDoc(doc(db, 'friendRequests', `${id}_${target}`), {
    fromUid: id,
    toUid: target,
    fromUserId: id,
    toUserId: target,
    status: 'pending',
    fromName: mine?.name || m.name,
    fromAvatar: mine?.avatar || m.avatar || '',
    toName: other?.name || 'GeoHub',
    toAvatar: other?.avatar || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  notify(target, {
    type: 'friend_request', title: `${m.name} გიგზავნის მეგობრობის თხოვნას`, href: `profile.html?id=${id}`,
    extra: { fromUid: id }, dedupKey: `friend_req_${id}_${target}`,
  });
  return 'outgoing';
}

export async function cancelFriendRequest(target) {
  const id = requireUid();
  await deleteDoc(doc(db, 'friendRequests', `${id}_${target}`));
}

/**
 * Accept: mark the request accepted first — the rules only allow creating
 * a friendship document once an accepted request exists (friendRequestAccepted).
 */
export async function acceptFriendRequest(requestId) {
  const id = requireUid();
  const ref = doc(db, 'friendRequests', requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw Object.assign(new Error('not-found'), { code: 'not-found' });
  const r = snap.data();
  const from = r.fromUserId || r.fromUid || r.fromId;
  if ((r.toUserId || r.toUid || r.toId) !== id) throw Object.assign(new Error('not-yours'), { code: 'permission-denied' });
  await updateDoc(ref, { status: 'accepted', reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  const fid = pairId(from, id);
  // Friendship docs are immutable (update: false), so only create missing ones.
  const [fa, fb] = await Promise.all([
    getDoc(doc(db, 'friends', fid)).catch(() => null),
    getDoc(doc(db, 'friendships', fid)).catch(() => null),
  ]);
  if (!fa?.exists()) await setDoc(doc(db, 'friends', fid), { users: [from, id], userA: from, userB: id, createdAt: serverTimestamp() });
  const [u1, u2] = from < id ? [from, id] : [id, from];
  if (!fb?.exists()) setDoc(doc(db, 'friendships', fid), { users: [u1, u2], user1: u1, user2: u2, createdAt: serverTimestamp() }).catch(() => {});
  updateDoc(doc(db, 'users', id), { friendsCount: increment(1) }).catch(() => {});
  const m = me();
  notify(from, { type: 'friend_accept', title: `${m.name} დაგიდასტურა მეგობრობა`, href: `profile.html?id=${id}`, extra: { friendId: id } });
}

export async function declineFriendRequest(requestId) {
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'rejected', reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function unfriend(target) {
  const id = requireUid();
  const fid = pairId(id, target);
  await Promise.all([
    deleteDoc(doc(db, 'friends', fid)).catch(() => {}),
    deleteDoc(doc(db, 'friendships', fid)).catch(() => {}),
  ]);
  updateDoc(doc(db, 'users', id), { friendsCount: increment(-1) }).catch(() => {});
}

export function listenIncomingRequests(onData) {
  const id = myUid.value;
  if (!id) { onData([]); return () => {}; }
  return onSnapshot(query(collection(db, 'friendRequests'), where('toUserId', '==', id), limit(60)), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.status === 'pending')
      .map((r) => ({ id: r.id, fromId: r.fromUserId || r.fromUid, name: r.fromName || 'GeoHub', avatar: r.fromAvatar || '', createdAt: tsToMillis(r.createdAt) }))
      .sort((a, b) => b.createdAt - a.createdAt);
    onData(list);
  }, () => onData([]));
}

export function listenSentRequests(onData) {
  const id = myUid.value;
  if (!id) { onData([]); return () => {}; }
  return onSnapshot(query(collection(db, 'friendRequests'), where('fromUserId', '==', id), limit(60)), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.status === 'pending')
      .map((r) => ({ id: r.id, toId: r.toUserId || r.toUid, name: r.toName || 'GeoHub', avatar: r.toAvatar || '', createdAt: tsToMillis(r.createdAt) }))
      .sort((a, b) => b.createdAt - a.createdAt);
    onData(list);
  }, () => onData([]));
}

/** Friend ids of `userId` from both friendship collections. */
export function listenFriendIds(userId, onData) {
  const sets = { a: [], b: [] };
  const ready = { a: false, b: false };
  const emit = () => { if (ready.a && ready.b) onData([...new Set([...sets.a, ...sets.b])]); };
  const other = (snap) => snap.docs.map((d) => (d.data().users || []).find((x) => x !== userId)).filter(Boolean);
  const u1 = onSnapshot(query(collection(db, 'friends'), where('users', 'array-contains', userId), limit(200)),
    (s) => { sets.a = other(s); ready.a = true; emit(); }, () => { ready.a = true; emit(); });
  const u2 = onSnapshot(query(collection(db, 'friendships'), where('users', 'array-contains', userId), limit(200)),
    (s) => { sets.b = other(s); ready.b = true; emit(); }, () => { ready.b = true; emit(); });
  return () => { u1(); u2(); };
}

export function listenFriends(userId, onData) {
  let alive = true;
  const unsub = listenFriendIds(userId, (ids) => {
    getUsers(ids.slice(0, 200)).then((users) => alive && onData(users.sort((a, b) => a.name.localeCompare(b.name))));
  });
  return () => { alive = false; unsub(); };
}

/* ── Safety: block, mute, hide ─────────────────────────────── */

export async function blockUser(target) {
  const id = requireUid();
  if (target === id) return;
  await setDoc(doc(db, 'blockedUsers', `${id}_${target}`), { blockerId: id, blockedId: target, createdAt: serverTimestamp() });
}
export async function unblockUser(target) {
  const id = requireUid();
  await deleteDoc(doc(db, 'blockedUsers', `${id}_${target}`));
}
export async function muteUser(target) {
  const id = requireUid();
  if (target === id) return;
  await setDoc(doc(db, 'mutedUsers', `${id}_${target}`), { muterId: id, mutedId: target, createdAt: serverTimestamp() });
}
export async function unmuteUser(target) {
  const id = requireUid();
  await deleteDoc(doc(db, 'mutedUsers', `${id}_${target}`));
}
export async function hidePost(postId) {
  const id = requireUid();
  await setDoc(doc(db, 'hiddenPosts', `${id}_${postId}`), { userId: id, postId, createdAt: serverTimestamp() });
}
export async function isBlockedBy(target) {
  const id = myUid.value;
  if (!id) return false;
  try { return (await getDoc(doc(db, 'blockedUsers', `${target}_${id}`))).exists(); } catch { return false; }
}
export async function isBlocking(target) {
  const id = myUid.value;
  if (!id) return false;
  try { return (await getDoc(doc(db, 'blockedUsers', `${id}_${target}`))).exists(); } catch { return false; }
}

/** { hiddenPostIds, blockedUserIds, mutedUserIds } for filtering feeds. */
export function listenSafety(onData) {
  const id = myUid.value;
  const state = { hiddenPostIds: [], blockedUserIds: [], mutedUserIds: [] };
  if (!id) { onData(state); return () => {}; }
  const emit = () => onData({ ...state });
  const col = (name, field, pick, key) => onSnapshot(query(collection(db, name), where(field, '==', id), limit(200)),
    (s) => { state[key] = s.docs.map((d) => d.data()[pick]).filter(Boolean); emit(); }, () => emit());
  const u = [
    col('hiddenPosts', 'userId', 'postId', 'hiddenPostIds'),
    col('blockedUsers', 'blockerId', 'blockedId', 'blockedUserIds'),
    col('mutedUsers', 'muterId', 'mutedId', 'mutedUserIds'),
  ];
  return () => u.forEach((f) => f());
}

export async function report(targetType, targetId, reason, details = '') {
  const id = requireUid();
  await addDoc(collection(db, 'reports'), {
    reporterId: id, targetType, targetId, reason: reason || 'other', details, status: 'pending', createdAt: serverTimestamp(),
  });
}

export async function updatePrivacy(privacy) {
  const id = requireUid();
  await updateDoc(doc(db, 'users', id), { privacy, updatedAt: Date.now() });
}
