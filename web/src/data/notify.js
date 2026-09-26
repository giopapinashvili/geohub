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

export function notify(toUserId, { type, title, body = '', href = 'feed.html', extra = {}, dedupKey } = {}) {
  const m = me();
  if (!m || !toUserId || toUserId === m.uid) return Promise.resolve();
  const payload = {
    userId: toUserId,
    toUserId,
    targetActorType: 'user',
    targetActorId: toUserId,
    fromUserId: m.uid,
    fromName: m.name,
    fromAvatar: m.avatar || '',
    type: type || 'notification',
    title: title || 'GeoHub',
    body,
    message: body,
    href,
    read: false,
    seen: false,
    createdAt: serverTimestamp(),
    ...extra,
  };
  const p = dedupKey ? setDoc(doc(db, 'userNotifications', dedupKey), payload) : addDoc(collection(db, 'userNotifications'), payload);
  return p.catch((e) => console.warn('[notify]', e.code));
}

/** Notification addressed to a business page (its admins read it). */
export function notifyBusiness(businessId, { type, title, body = '', href = 'feed.html', extra = {} } = {}) {
  const m = me();
  if (!m || !businessId) return Promise.resolve();
  return addDoc(collection(db, 'userNotifications'), {
    userId: '',
    toUserId: '',
    businessId,
    targetActorType: 'business',
    targetActorId: businessId,
    fromUserId: m.uid,
    fromName: m.name,
    fromAvatar: m.avatar || '',
    type, title, body, message: body, href,
    read: false, seen: false,
    createdAt: serverTimestamp(),
    ...extra,
  }).catch((e) => console.warn('[notifyBusiness]', e.code));
}

/** Own notifications, newest first (two queries: current and legacy shape). */
export function listenNotifications(userId, onData, n = 60) {
  const byId = new Map();
  const ready = { a: false, b: false };
  const emit = () => {
    if (!ready.a || !ready.b) return;
    const list = [...byId.values()]
      .filter((x) => x.raw.targetActorType !== 'business')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, n);
    onData(list);
  };
  const handle = (slot) => (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed') byId.delete(ch.doc.id);
      else byId.set(ch.doc.id, normNotification(ch.doc.id, ch.doc.data()));
    });
    ready[slot] = true;
    emit();
  };
  const fail = (slot) => (e) => { console.warn('[notifications]', e.code); ready[slot] = true; emit(); };
  const col = collection(db, 'userNotifications');
  const u1 = onSnapshot(query(col, where('userId', '==', userId), limit(n)), handle('a'), fail('a'));
  const u2 = onSnapshot(query(col, where('targetActorType', '==', 'user'), where('targetActorId', '==', userId), limit(n)), handle('b'), fail('b'));
  return () => { u1(); u2(); };
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
