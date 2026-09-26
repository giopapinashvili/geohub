// Direct and business conversations. Keeps the old document contract:
// conversations/{id} with participants + memberUids + inboxActorIds,
// messages in conversations/{id}/messages, per-user settings in
// userConversationSettings/{uid}_{cid}.

import {
  doc, getDoc, setDoc, addDoc, updateDoc, collection, query, where, orderBy, limit,
  limitToLast, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, deleteField, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { me, uid as myUid } from '../lib/auth.js';
import { tsToMillis } from '../lib/format.js';
import { notify, notifyBusiness } from './notify.js';
import { pairId } from './social.js';
import { getUser } from './users.js';

function requireMe() {
  const m = me();
  if (!m) throw Object.assign(new Error('auth'), { code: 'auth' });
  return m;
}

export const directId = (a, b) => [a, b].sort().join('_');

function normConv(id, d, viewer) {
  const participants = Array.isArray(d.participants) ? d.participants : [];
  const isBiz = !!(d.forBusiness && d.businessId);
  const actor = `user_${viewer}`;
  const unread = (Array.isArray(d.unreadActors) && (d.unreadActors.includes(actor) || d.unreadActors.includes(`user:${viewer}`)))
    || (Array.isArray(d.unreadFor) && d.unreadFor.includes(viewer));
  return {
    id,
    isBusiness: isBiz,
    businessId: d.businessId || '',
    ownerUid: d.ownerUid || '',
    customerUid: d.customerUid || '',
    participants,
    otherId: participants.find((p) => p !== viewer) || (d.memberUids || []).find((p) => p !== viewer) || '',
    lastMessage: d.lastMessage || '',
    lastSenderId: d.lastSenderId || '',
    updatedAt: tsToMillis(d.updatedAt || d.lastMessageAt || d.createdAt),
    unread: !!unread && d.lastSenderId !== viewer,
    typing: d.typingActors || {},
    readBy: d.readBy || {},
    nicknames: d.nicknames || {},
    theme: d.theme || '',
    inboxActorIds: Array.isArray(d.inboxActorIds) && d.inboxActorIds.length ? d.inboxActorIds
      : isBiz ? [`user_${d.customerUid || viewer}`, `business_${d.businessId}`] : participants.map((p) => `user_${p}`),
    hiddenForActors: d.hiddenForActors || [],
    deletedForActors: d.deletedForActors || [],
    raw: d,
  };
}

/**
 * The viewer's inbox for an actor: 'user_{uid}' (personal) or
 * 'business_{id}' (a page they manage). Queries by memberUids and the
 * legacy participants field, then separates actors client-side.
 */
export function listenConversations(onData, actorId) {
  const viewer = myUid.value;
  if (!viewer) { onData([]); return () => {}; }
  const actor = actorId || `user_${viewer}`;
  const legacyActor = actor.startsWith('business_') ? `business:${actor.slice(9)}` : `user:${actor.slice(5)}`;
  const pool = new Map();
  const flush = () => {
    const list = [...pool.values()]
      .map((d) => normConv(d.id, d, viewer))
      .filter((c) => c.inboxActorIds.includes(actor)
        && !c.hiddenForActors.includes(actor) && !c.hiddenForActors.includes(legacyActor)
        && !c.deletedForActors.includes(actor))
      .map((c) => (actor.startsWith('business_')
        ? { ...c, unread: (c.raw.unreadActors || []).includes(actor) && c.lastSenderId !== viewer, otherId: c.customerUid || c.otherId }
        : c))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    onData(list);
  };
  const handle = (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed') pool.delete(ch.doc.id);
      else pool.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() });
    });
    flush();
  };
  const col = collection(db, 'conversations');
  const u1 = onSnapshot(query(col, where('memberUids', 'array-contains', viewer), limit(80)), handle, (e) => console.warn('[conv]', e.code));
  const u2 = onSnapshot(query(col, where('participants', 'array-contains', viewer), limit(80)), handle, (e) => console.warn('[conv]', e.code));
  return () => { u1(); u2(); };
}

export function listenConversation(id, onData, onError) {
  return onSnapshot(doc(db, 'conversations', id), (s) => onData(s.exists() ? normConv(s.id, s.data(), myUid.value) : null), onError);
}

/** Open (or create) the direct conversation with `target`. Returns its id. */
export async function openDirect(target) {
  const m = requireMe();
  if (!target || target === m.uid) throw Object.assign(new Error('self'), { code: 'self' });
  const [b1, b2, other] = await Promise.all([
    getDoc(doc(db, 'blockedUsers', `${m.uid}_${target}`)).catch(() => null),
    getDoc(doc(db, 'blockedUsers', `${target}_${m.uid}`)).catch(() => null),
    getUser(target),
  ]);
  if (b1?.exists()) throw Object.assign(new Error('blocking'), { code: 'blocking' });
  if (b2?.exists()) throw Object.assign(new Error('blocked'), { code: 'blocked' });
  const pref = other?.privacy?.messagingPref || 'everyone';
  if (pref === 'nobody') throw Object.assign(new Error('messages-disabled'), { code: 'messages-disabled' });
  const cid = directId(m.uid, target);
  const existing = await getDoc(doc(db, 'conversations', cid)).catch(() => null);
  if (existing?.exists()) return cid;
  if (pref === 'friends') {
    const f = await getDoc(doc(db, 'friends', pairId(m.uid, target))).catch(() => null);
    if (!f?.exists()) throw Object.assign(new Error('friends-only'), { code: 'friends-only' });
  }
  await setDoc(doc(db, 'conversations', cid), {
    participants: [m.uid, target],
    inboxKeys: [`user:${m.uid}`, `user:${target}`],
    inboxActorIds: [`user_${m.uid}`, `user_${target}`],
    memberUids: [m.uid, target],
    type: 'personal',
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    lastMessage: '',
    unreadFor: [],
    readBy: {},
  }, { merge: true });
  return cid;
}

/** Open (or create) a customer ↔ business conversation. */
export async function openBusinessConversation(businessId, ownerUid) {
  const m = requireMe();
  if (!businessId || !ownerUid) throw new Error('missing');
  if (ownerUid === m.uid) throw Object.assign(new Error('own-business'), { code: 'own-business' });
  const cid = `biz_${businessId}_${m.uid}`;
  const existing = await getDoc(doc(db, 'conversations', cid)).catch(() => null);
  if (existing?.exists()) return cid;
  await setDoc(doc(db, 'conversations', cid), {
    participants: [m.uid, ownerUid],
    businessId,
    forBusiness: true,
    customerUid: m.uid,
    ownerUid,
    type: 'customer_business',
    customerActorId: `user_${m.uid}`,
    pageActorId: `business_${businessId}`,
    inboxActorIds: [`user_${m.uid}`, `business_${businessId}`],
    memberUids: [m.uid, ownerUid],
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    lastMessage: '',
    unreadFor: [],
    readBy: {},
  }, { merge: true });
  return cid;
}

export function listenMessages(cid, onData, n = 80) {
  return onSnapshot(query(collection(db, 'conversations', cid, 'messages'), orderBy('createdAt', 'asc'), limitToLast(n)), (s) => {
    const viewer = myUid.value;
    onData(s.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        senderId: x.senderId,
        senderActorId: x.senderActorId || `user_${x.senderId}`,
        senderName: x.senderName || x.senderDisplayName || '',
        senderAvatar: x.senderAvatar || '',
        text: x.text || x.body || x.message || '',
        mediaUrl: x.mediaUrl || x.imageUrl || '',
        mediaType: x.mediaType || '',
        attachments: Array.isArray(x.attachments) ? x.attachments : [],
        replyTo: x.replyTo || null,
        reactions: x.reactions && typeof x.reactions === 'object' && !Array.isArray(x.reactions) ? x.reactions : {},
        deletedForEveryone: !!(x.deletedForEveryone || x.deleted),
        hiddenForMe: (x.deletedFor || []).includes(viewer),
        edited: !!x.edited,
        seenBy: x.seenBy || [],
        storyContext: x.storyContext || null,
        pending: d.metadata.hasPendingWrites,
        createdAt: tsToMillis(x.createdAt) || Date.now(),
      };
    }).filter((x) => !x.hiddenForMe));
  }, () => onData([]));
}

/**
 * Send a message. `asBusiness` (a business id) sends as the page from its
 * inbox. Updates the conversation preview, unread markers and notifies.
 */
export async function sendMessage(cid, { text = '', attachments = [], replyTo = null, asBusiness = null, storyContext = null }) {
  const m = requireMe();
  const clean = String(text || '').trim();
  const files = attachments.filter((a) => a && a.url);
  if (!clean && !files.length) return;
  const convRef = doc(db, 'conversations', cid);
  const snap = await getDoc(convRef);
  if (!snap.exists()) throw new Error('no-conversation');
  const conv = snap.data();
  const actorType = asBusiness ? 'business' : 'user';
  const rawActor = asBusiness || m.uid;
  const actorId = `${actorType}_${rawActor}`;
  const first = files[0];
  const preview = clean || (first?.type === 'image' ? '📷' : first?.type === 'audio' ? '🎤' : `📎 ${first?.name || ''}`);
  let senderName = m.name;
  let senderAvatar = m.avatar;
  if (asBusiness) {
    const b = await getDoc(doc(db, 'businesses', asBusiness)).catch(() => null);
    senderName = b?.data()?.title || b?.data()?.name || senderName;
    senderAvatar = b?.data()?.logoUrl || b?.data()?.logo || '';
  }
  await addDoc(collection(db, 'conversations', cid, 'messages'), {
    conversationId: cid,
    senderId: m.uid,
    authorId: m.uid,
    performedByUid: m.uid,
    senderActorType: actorType,
    senderActorId: actorId,
    senderActorKey: `${actorType}:${rawActor}`,
    senderDisplayName: senderName,
    senderName,
    senderAvatar,
    text: clean,
    mediaUrl: first?.type === 'image' ? first.url : '',
    mediaType: first?.type || '',
    fileName: first?.name || '',
    fileSize: first?.size || 0,
    attachments: files.map((a) => ({ type: a.type || 'file', url: a.url, name: a.name || '', size: a.size || 0, mime: a.mime || '', duration: a.duration || 0, createdAt: Date.now() })),
    replyTo,
    storyContext,
    likedBy: [],
    readBy: [m.uid],
    seenBy: [m.uid],
    readByActors: [actorId],
    seenByActors: [actorId],
    deletedFor: [],
    delivered: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const participants = conv.participants || [];
  const otherId = participants.find((p) => p !== m.uid) || '';
  const inboxActors = Array.isArray(conv.inboxActorIds) && conv.inboxActorIds.length ? conv.inboxActorIds : [actorId];
  const restoreKeys = inboxActors.flatMap((a) => [a, a.startsWith('business_') ? `business:${a.slice(9)}` : `user:${a.slice(5)}`]);
  const unreadActors = [...new Set([...(conv.unreadActors || []).filter((a) => a !== actorId), ...inboxActors.filter((a) => a !== actorId)])];
  const isBiz = conv.forBusiness && conv.businessId;
  const unreadTarget = isBiz ? (actorType === 'business' ? conv.customerUid : conv.ownerUid || otherId) : otherId;
  const patch = {
    lastMessage: preview.slice(0, 200),
    lastSenderId: m.uid,
    lastMessageSenderActorId: actorId,
    updatedAt: serverTimestamp(),
    [`readBy.${m.uid}`]: serverTimestamp(),
    [`readByActors.${actorId}`]: serverTimestamp(),
    [`typingActors.${actorId}`]: deleteField(),
    [`typingUsers.${m.uid}`]: deleteField(),
    archivedForActors: arrayRemove(...inboxActors),
    hiddenForActors: arrayRemove(...restoreKeys),
    deletedForActors: arrayRemove(...inboxActors),
    unreadActors,
  };
  if (unreadTarget && unreadTarget !== m.uid) patch.unreadFor = arrayUnion(unreadTarget);
  await updateDoc(convRef, patch).catch((e) => console.warn('[sendMessage] conversation patch', e.code));

  if (isBiz && actorType === 'user') {
    notifyBusiness(conv.businessId, { type: 'message', title: `${m.name} მისწერა შენს გვერდს`, body: preview.slice(0, 120), href: `messages.html?business=${conv.businessId}&cid=${cid}`, extra: { conversationId: cid, ownerUid: conv.ownerUid || '' } });
  } else if (unreadTarget && unreadTarget !== m.uid) {
    const href = isBiz ? `messages.html?withBusiness=${conv.businessId}&cid=${cid}` : `messages.html?with=${m.uid}`;
    notify(unreadTarget, { type: 'message', title: `${senderName} მოგწერა`, body: preview.slice(0, 120), href, extra: { conversationId: cid } });
  }
}

export function markConversationRead(cid, actorId) {
  const viewer = myUid.value;
  if (!viewer) return;
  const actor = actorId || `user_${viewer}`;
  const legacy = actor.startsWith('business_') ? `business:${actor.slice(9)}` : `user:${viewer}`;
  updateDoc(doc(db, 'conversations', cid), {
    unreadFor: arrayRemove(viewer),
    unreadActors: arrayRemove(actor, legacy),
    [`readBy.${viewer}`]: serverTimestamp(),
    [`readByActors.${actor}`]: serverTimestamp(),
  }).catch(() => {});
}

export function markMessagesSeen(cid, ids, actorId) {
  const viewer = myUid.value;
  if (!viewer || !ids.length) return;
  const actor = actorId || `user_${viewer}`;
  const batch = writeBatch(db);
  ids.slice(0, 100).forEach((mid) => batch.update(doc(db, 'conversations', cid, 'messages', mid), {
    seenBy: arrayUnion(viewer), readBy: arrayUnion(viewer), seenByActors: arrayUnion(actor), readByActors: arrayUnion(actor), updatedAt: serverTimestamp(),
  }));
  batch.commit().catch(() => {});
}

let typingTimer = null;
export function setTyping(cid, typing, actorId) {
  const m = me();
  if (!m) return;
  const actor = actorId || `user_${m.uid}`;
  clearTimeout(typingTimer);
  updateDoc(doc(db, 'conversations', cid), {
    [`typingActors.${actor}`]: typing ? { name: m.name, avatar: m.avatar, at: serverTimestamp() } : deleteField(),
    [`typingUsers.${m.uid}`]: typing ? serverTimestamp() : deleteField(),
  }).catch(() => {});
  if (typing) typingTimer = setTimeout(() => setTyping(cid, false, actorId), 6000);
}

export async function toggleMessageReaction(cid, msg, emoji, actorId) {
  const viewer = myUid.value;
  const actor = actorId || `user_${viewer}`;
  const current = msg.reactions[actor];
  await updateDoc(doc(db, 'conversations', cid, 'messages', msg.id), {
    [`reactions.${actor}`]: current === emoji ? deleteField() : emoji,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMessage(cid, msgId, forEveryone, actorId) {
  const viewer = myUid.value;
  const actor = actorId || `user_${viewer}`;
  const ref = doc(db, 'conversations', cid, 'messages', msgId);
  if (forEveryone) {
    await updateDoc(ref, { deletedForEveryone: true, deletedAt: serverTimestamp(), deletedByActorId: actor, text: '', deleted: true, deletedBy: viewer, updatedAt: serverTimestamp() });
  } else {
    await updateDoc(ref, { deletedForActors: arrayUnion(actor), deletedFor: arrayUnion(viewer), updatedAt: serverTimestamp() });
  }
}

export async function editMessage(cid, msgId, text) {
  await updateDoc(doc(db, 'conversations', cid, 'messages', msgId), { text: String(text).trim(), edited: true, editedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

/** Hide a conversation from the viewer's inbox until a new message arrives. */
export async function hideConversation(cid, actorId) {
  const viewer = myUid.value;
  const actor = actorId || `user_${viewer}`;
  await updateDoc(doc(db, 'conversations', cid), { hiddenForActors: arrayUnion(actor) });
}

export function listenConversationSettings(cid, onData) {
  const viewer = myUid.value;
  if (!viewer) { onData({}); return () => {}; }
  return onSnapshot(doc(db, 'userConversationSettings', `${viewer}_${cid}`), (s) => onData(s.exists() ? s.data() : {}), () => onData({}));
}

export async function setConversationSettings(cid, patch) {
  const viewer = myUid.value;
  const allowed = {};
  for (const k of ['archived', 'mutedUntil', 'theme', 'nickname']) if (k in patch) allowed[k] = patch[k];
  await setDoc(doc(db, 'userConversationSettings', `${viewer}_${cid}`), { userId: viewer, conversationId: cid, ...allowed, updatedAt: serverTimestamp() }, { merge: true });
}
