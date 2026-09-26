// Groups: directory, membership (groupMembers/{groupId}_{uid}), join
// requests for private groups, member roles, and group events.

import {
  doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, collection, query, where, limit, onSnapshot,
  serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { me, uid as myUid } from '../lib/auth.js';
import { normGroup, isCorruptSeed } from './normalize.js';
import { tsToMillis } from '../lib/format.js';
import { notify } from './notify.js';

const MANAGER_ROLES = ['owner', 'admin', 'moderator'];
export const isManagerRole = (role) => MANAGER_ROLES.includes(role);

export async function listGroups(n = 200) {
  const snap = await getDocs(query(collection(db, 'groups'), limit(n)));
  return snap.docs.filter((d) => !isCorruptSeed(d.data())).map((d) => normGroup(d.id, d.data()))
    .filter((g) => g.privacy !== 'secret' && g.raw.status !== 'deleted');
}

export function listenGroup(id, onData, onError) {
  return onSnapshot(doc(db, 'groups', id), (s) => onData(s.exists() ? normGroup(s.id, s.data()) : null), onError);
}

export async function getGroup(id) {
  const s = await getDoc(doc(db, 'groups', id)).catch(() => null);
  return s?.exists() ? normGroup(s.id, s.data()) : null;
}

/** My membership record for a group: { role, status } or null. */
export function listenMembership(groupId, onData) {
  const u = myUid.value;
  if (!u) { onData(null); return () => {}; }
  return onSnapshot(doc(db, 'groupMembers', `${groupId}_${u}`), (s) => onData(s.exists() ? s.data() : null), () => onData(null));
}

export async function myGroups() {
  const u = myUid.value;
  if (!u) return [];
  const snap = await getDocs(query(collection(db, 'groupMembers'), where('uid', '==', u), limit(60))).catch(() => ({ docs: [] }));
  const list = await Promise.all(snap.docs.map((d) => getGroup(d.data().groupId)));
  return list.filter(Boolean);
}

export async function joinGroup(group) {
  const m = me();
  await setDoc(doc(db, 'groupMembers', `${group.id}_${m.uid}`), {
    groupId: group.id, groupName: group.name, uid: m.uid, userId: m.uid, role: 'member', status: 'joined', joinedAt: serverTimestamp(), createdAt: serverTimestamp(),
  });
  updateDoc(doc(db, 'groups', group.id), { memberCount: increment(1) }).catch(() => {});
}

export async function leaveGroup(group) {
  const u = myUid.value;
  await deleteDoc(doc(db, 'groupMembers', `${group.id}_${u}`));
  updateDoc(doc(db, 'groups', group.id), { memberCount: increment(-1) }).catch(() => {});
}

/* ── Join requests (private groups) ────────────────────────── */

const reqId = (groupId, u) => `${groupId}__${u}`;

export function listenMyJoinRequest(groupId, onData) {
  const u = myUid.value;
  if (!u) { onData(null); return () => {}; }
  return onSnapshot(doc(db, 'groupJoinRequests', reqId(groupId, u)), (s) => onData(s.exists() ? { id: s.id, ...s.data() } : null), () => onData(null));
}

export async function requestToJoin(group, answers = []) {
  const m = me();
  await setDoc(doc(db, 'groupJoinRequests', reqId(group.id, m.uid)), {
    groupId: group.id, userId: m.uid, userName: m.name, userPhoto: m.avatar || '', answers, status: 'pending', createdAt: serverTimestamp(),
  });
  if (group.ownerId && group.ownerId !== m.uid) {
    notify(group.ownerId, { type: 'group_join_request', title: `${m.name} ითხოვს გაწევრიანებას`, body: group.name, href: `groups.html?id=${group.id}` });
  }
}

export async function cancelJoinRequest(groupId) {
  await deleteDoc(doc(db, 'groupJoinRequests', reqId(groupId, myUid.value)));
}

/**
 * Rules only let users write their own membership, so an approved request
 * becomes a membership the next time the requester opens the group.
 */
export async function claimApprovedMembership(group, request) {
  if (request?.status !== 'approved') return false;
  await joinGroup(group);
  await deleteDoc(doc(db, 'groupJoinRequests', request.id)).catch(() => {});
  return true;
}

export function listenJoinRequests(groupId, onData) {
  return onSnapshot(query(collection(db, 'groupJoinRequests'), where('groupId', '==', groupId), limit(100)), (s) => {
    onData(s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToMillis(d.data().createdAt) })).filter((r) => r.status === 'pending').sort((a, b) => a.createdAt - b.createdAt));
  }, () => onData([]));
}

export async function answerJoinRequest(group, request, approve) {
  const m = me();
  await updateDoc(doc(db, 'groupJoinRequests', request.id), { status: approve ? 'approved' : 'declined', approvedBy: m.uid, approvedAt: serverTimestamp() });
  if (approve) notify(request.userId, { type: 'group_approved', title: `მოთხოვნა დადასტურდა: ${group.name}`, body: 'შედი ჯგუფში და შემოგვიერთდი!', href: `groups.html?id=${group.id}` });
}

/* ── Create / manage ───────────────────────────────────────── */

export async function createGroup({ name, description = '', category = 'general', privacy = 'public', coverUrl = '', location = '', rules = [], postApproval = false }) {
  const m = me();
  const ref = await addDoc(collection(db, 'groups'), {
    name: name.trim(), description: description.trim(), category, coverUrl, privacy, location, tags: [], rules, joinQuestions: [], pinnedPostIds: [],
    postApproval, inviteToken: null, inviteEnabled: false, creatorId: m.uid, userId: m.uid, creatorName: m.name, creatorAvatar: m.avatar || '',
    memberCount: 1, postCount: 0, createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'groupMembers', `${ref.id}_${m.uid}`), {
    groupId: ref.id, groupName: name.trim(), uid: m.uid, userId: m.uid, role: 'admin', status: 'joined', joinedAt: serverTimestamp(), createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGroup(id, patch) {
  const data = {};
  for (const k of ['name', 'description', 'category', 'privacy', 'coverUrl', 'location', 'rules', 'postApproval']) if (patch[k] !== undefined) data[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k];
  data.updatedAt = serverTimestamp();
  await updateDoc(doc(db, 'groups', id), data);
}

export async function deleteGroup(id) { await deleteDoc(doc(db, 'groups', id)); }

export async function listMembers(groupId, n = 200) {
  const snap = await getDocs(query(collection(db, 'groupMembers'), where('groupId', '==', groupId), limit(n))).catch(() => ({ docs: [] }));
  const order = { owner: 0, admin: 1, moderator: 2, member: 3 };
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), userId: d.data().userId || d.data().uid, joinedAt: tsToMillis(d.data().joinedAt || d.data().createdAt) }))
    .sort((a, b) => (order[a.role] ?? 3) - (order[b.role] ?? 3) || a.joinedAt - b.joinedAt);
}

export async function setMemberRole(groupId, userId, role) {
  await updateDoc(doc(db, 'groupMembers', `${groupId}_${userId}`), { role, updatedAt: serverTimestamp() });
}

export async function removeMember(group, userId) {
  await deleteDoc(doc(db, 'groupMembers', `${group.id}_${userId}`));
  updateDoc(doc(db, 'groups', group.id), { memberCount: increment(-1) }).catch(() => {});
}

/* ── Group events (groups/{id}/events, RSVPs in rsvps/{uid}) ─ */

export async function listGroupEvents(groupId) {
  const snap = await getDocs(query(collection(db, 'groups', groupId, 'events'), limit(50))).catch(() => ({ docs: [] }));
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, title: x.title || x.name || '—', description: x.description || '', date: tsToMillis(x.date || x.startsAt), venue: x.venue || x.location || '', goingCount: Number(x.goingCount) || 0, createdBy: x.createdBy || '' };
  }).sort((a, b) => a.date - b.date);
}

export async function createGroupEvent(groupId, { title, description = '', date, venue = '' }) {
  await addDoc(collection(db, 'groups', groupId, 'events'), { title: title.trim(), description: description.trim(), date, venue: venue.trim(), goingCount: 0, createdBy: myUid.value, createdAt: serverTimestamp() });
}

export async function deleteGroupEvent(groupId, eventId) { await deleteDoc(doc(db, 'groups', groupId, 'events', eventId)); }

export async function myGroupRsvp(groupId, eventId) {
  const u = myUid.value;
  if (!u) return false;
  const s = await getDoc(doc(db, 'groups', groupId, 'events', eventId, 'rsvps', u)).catch(() => null);
  return !!s?.exists();
}

export async function setGroupRsvp(groupId, eventId, going) {
  const u = myUid.value;
  const ref = doc(db, 'groups', groupId, 'events', eventId, 'rsvps', u);
  if (going) await setDoc(ref, { userId: u, status: 'going', createdAt: serverTimestamp() });
  else await deleteDoc(ref);
}
