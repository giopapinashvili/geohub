// userNotifications writer. Rules require fromUserId == caller; readers
// match on userId / toUserId / targetActor*. `href` is written in the old
// site's format ("feed.html?post=…") so both generations can open it; the
// new app rewrites it through legacy.js.

import {
  addDoc, setDoc, doc, collection, serverTimestamp, onSnapshot, query, where, limit,
  updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { me } from '../lib/auth.js';
import { normNotification } from './normalize.js';
import { tsToMillis } from '../lib/format.js';
import { notificationSender, contentRecipient } from '../lib/contentIdentity.js';

export function notify(toUserId, { type, title, body = '', href = 'feed.html', extra = {}, dedupKey, sender = null } = {}) {
  const m = me();
  const identity = notificationSender(m, sender);
  if (!identity || !toUserId || (toUserId === m.uid && identity.fromActorType === 'user')) return Promise.resolve();
  const payload = {
    ...extra,
    userId: toUserId,
    toUserId,
    targetActorType: 'user',
    targetActorId: toUserId,
    ...identity,
    type: type || 'notification',
    title: title || 'GeoHub',
    body,
    message: body,
    href,
    read: false,
    seen: false,
    createdAt: serverTimestamp(),
  };
  const p = dedupKey ? setDoc(doc(db, 'userNotifications', dedupKey), payload) : addDoc(collection(db, 'userNotifications'), payload);
  return p.catch((e) => console.warn('[notify]', e.code));
}

/** Notification addressed to a business page (its admins read it). */
export function notifyBusiness(businessId, { type, title, body = '', href = 'feed.html', extra = {}, sender = null, dedupKey } = {}) {
  const m = me();
  const identity = notificationSender(m, sender);
  if (!identity || !businessId || (identity.fromActorType === 'business' && identity.fromActorId === businessId)) return Promise.resolve();
  const payload = {
    ...extra,
    userId: '',
    toUserId: '',
    businessId,
    targetActorType: 'business',
    targetActorId: businessId,
    ...identity,
    type, title, body, message: body, href,
    read: false, seen: false,
    createdAt: serverTimestamp(),
  };
  const operation = dedupKey ? setDoc(doc(db, 'userNotifications', dedupKey), payload) : addDoc(collection(db, 'userNotifications'), payload);
  return operation.catch((e) => console.warn('[notifyBusiness]', e.code));
}

/** Route public content activity to the publishing page, not its administrator. */
export function notifyAuthor(content, notification) {
  const target = contentRecipient(content);
  if (!target) return Promise.resolve();
  return target.type === 'business' ? notifyBusiness(target.id, notification) : notify(target.id, notification);
}

/** Own notifications, newest first (two queries: current and legacy shape). */
export function listenNotifications(userId, onData, n = 60) {
  const pools = { a: new Map(), b: new Map() };
  const ready = { a: false, b: false };
  let active = true;
  const emit = () => {
    if (!active || !ready.a || !ready.b) return;
    const byId = new Map([...pools.a, ...pools.b]);
    const list = [...byId.values()]
      .filter((x) => x.raw.targetActorType !== 'business')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, n);
    onData(list);
  };
  const handle = (slot) => (snap) => {
    if (!active) return;
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed') pools[slot].delete(ch.doc.id);
      else pools[slot].set(ch.doc.id, normNotification(ch.doc.id, ch.doc.data()));
    });
    ready[slot] = true;
    emit();
  };
  const fail = (slot) => (e) => { console.warn('[notifications]', e.code); ready[slot] = true; emit(); };
  const col = collection(db, 'userNotifications');
  const u1 = onSnapshot(query(col, where('userId', '==', userId), limit(n)), handle('a'), fail('a'));
  const u2 = onSnapshot(query(col, where('targetActorType', '==', 'user'), where('targetActorId', '==', userId), limit(n)), handle('b'), fail('b'));
  return () => { active = false; u1(); u2(); };
}

export function listenBusinessNotifications(businessId, onData) {
  return onSnapshot(
    query(collection(db, 'userNotifications'), where('targetActorType', '==', 'business'), where('targetActorId', '==', businessId), limit(50)),
    (snap) => onData(snap.docs.map((d) => normNotification(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)),
    () => onData([]),
  );
}

export function markRead(id) {
  return updateDoc(doc(db, 'userNotifications', id), { read: true, seen: true, openedAt: serverTimestamp(), updatedAt: serverTimestamp() })
    .catch((e) => console.warn('[markRead]', e.code));
}

export async function markAllRead(list) {
  const unread = list.filter((n) => !n.read).slice(0, 400);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, 'userNotifications', n.id), { read: true, seen: true, updatedAt: serverTimestamp() }));
  await batch.commit().catch((e) => console.warn('[markAllRead]', e.code));
}

export { tsToMillis };
