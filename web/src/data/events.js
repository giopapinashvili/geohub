// Events (top-level, created by admins) and RSVPs in eventParticipants
// ({eventId}_{uid}, the same id the old site used).

import {
  collection, query, where, orderBy, limit, getDocs, getDoc, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { me, uid as myUid } from '../lib/auth.js';
import { normEvent, isCorruptSeed } from './normalize.js';
import { tsToMillis } from '../lib/format.js';

const visible = (e) => e.status === 'active' && !isCorruptSeed(e.raw);

export async function upcomingEvents(n = 10) {
  const now = new Date().toISOString().slice(0, 16);
  const snap = await getDocs(query(collection(db, 'events'), where('date', '>=', now), orderBy('date', 'asc'), limit(n)));
  return snap.docs.map((d) => normEvent(d.id, d.data())).filter(visible);
}

/** All events, split client-side into upcoming (soonest first) and past. */
export async function listEvents(n = 300) {
  const snap = await getDocs(query(collection(db, 'events'), limit(n)));
  const all = snap.docs.map((d) => normEvent(d.id, d.data())).filter(visible);
  const now = Date.now() - 3 * 3600000;
  return {
    upcoming: all.filter((e) => (e.endDate || e.date) >= now).sort((a, b) => a.date - b.date),
    past: all.filter((e) => (e.endDate || e.date) < now).sort((a, b) => b.date - a.date),
  };
}

export function listenEvent(id, onData, onError) {
  return onSnapshot(doc(db, 'events', id), (s) => onData(s.exists() ? normEvent(s.id, s.data()) : null), onError);
}

export async function getEvent(id) {
  const s = await getDoc(doc(db, 'events', id)).catch(() => null);
  return s?.exists() ? normEvent(s.id, s.data()) : null;
}

/* ── RSVP ──────────────────────────────────────────────────── */

export async function myRsvp(eventId) {
  const u = myUid.value;
  if (!u) return null;
  const s = await getDoc(doc(db, 'eventParticipants', `${eventId}_${u}`)).catch(() => null);
  return s?.exists() ? (s.data().status || 'going') : null;
}

/** status: 'going' | 'interested' | null (remove). */
export async function setRsvp(event, status) {
  const m = me();
  const ref = doc(db, 'eventParticipants', `${event.id}_${m.uid}`);
  if (!status) { await deleteDoc(ref); return; }
  await setDoc(ref, {
    eventId: event.id, eventName: event.title, userId: m.uid, uid: m.uid, displayName: m.name, photoURL: m.avatar || '',
    status, joinedAt: serverTimestamp(), createdAt: serverTimestamp(),
  });
}

export async function eventAttendees(eventId, n = 200) {
  const snap = await getDocs(query(collection(db, 'eventParticipants'), where('eventId', '==', eventId), limit(n))).catch(() => ({ docs: [] }));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToMillis(d.data().createdAt) }));
  return { going: list.filter((x) => (x.status || 'going') === 'going'), interested: list.filter((x) => x.status === 'interested') };
}

export async function myEvents() {
  const u = myUid.value;
  if (!u) return [];
  const snap = await getDocs(query(collection(db, 'eventParticipants'), where('userId', '==', u), limit(100))).catch(() => ({ docs: [] }));
  const list = await Promise.all(snap.docs.map((d) => getEvent(d.data().eventId)));
  return list.filter(Boolean).sort((a, b) => a.date - b.date);
}

/* ── Admin: create / edit ──────────────────────────────────── */

export async function saveEvent(ev) {
  const m = me();
  const data = {
    title: ev.title.trim(), name: ev.title.trim(), description: (ev.description || '').trim(), category: ev.category || 'other',
    city: ev.city || '', venue: (ev.venue || '').trim(), date: ev.date, endDate: ev.endDate || '', ticketPrice: Number(ev.price) || 0,
    capacity: Number(ev.capacity) || 0, imageUrl: ev.image || '', lat: ev.lat ?? null, lng: ev.lng ?? null, status: 'active', updatedAt: serverTimestamp(),
  };
  if (ev.id) { await updateDoc(doc(db, 'events', ev.id), data); return ev.id; }
  const ref = await addDoc(collection(db, 'events'), { ...data, ownerId: m.uid, userId: m.uid, createdBy: m.uid, createdAt: serverTimestamp() });
  return ref.id;
}

export async function deleteEvent(id) { await deleteDoc(doc(db, 'events', id)); }
