// Business pages: directory, pages you manage, follow, reviews, services,
// gallery, offers, quote requests and daily analytics. Field shapes match
// what the old site wrote (gh-schema.js newBusiness / newBusinessReview).

import {
  doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, collection, query, where, limit, onSnapshot,
  serverTimestamp, increment, runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { cachedList, dropCached } from './cache.js';
import { me, uid as myUid, isAdmin, authUser } from '../lib/auth.js';
import { normBiz, isCorruptSeed } from './normalize.js';
import { tsToMillis } from '../lib/format.js';
import { notifyBusiness } from './notify.js';

const cache = new Map();
const live = (b) => b && b.status !== 'deleted' && b.status !== 'suspended' && !b.raw?.deleted;

export function getBusiness(id) {
  if (!id) return Promise.resolve(null);
  if (!cache.has(id)) {
    cache.set(id, getDoc(doc(db, 'businesses', id)).then((s) => (s.exists() ? normBiz(s.id, s.data()) : null)).catch(() => null));
  }
  return cache.get(id);
}

export function listenBusiness(id, onData, onError) {
  return onSnapshot(doc(db, 'businesses', id), (s) => {
    const b = s.exists() ? normBiz(s.id, s.data()) : null;
    if (b) cache.set(id, Promise.resolve(b));
    onData(b);
  }, onError);
}

/** Public pages. Shared by the hub, the business list and need matching. */
export function listBusinesses(n = 120) {
  return cachedList('businesses', 120, 10 * 60000, async (k) => {
    const snap = await getDocs(query(collection(db, 'businesses'), limit(k)));
    return snap.docs.filter((d) => !isCorruptSeed(d.data())).map((d) => normBiz(d.id, d.data())).filter(live);
  }, n);
}

/** Pages the signed-in user owns or administers. */
export async function myBusinesses() {
  const u = myUid.value;
  if (!u) return [];
  return cachedList(`businesses:mine:${u}`, 30, 5 * 60000, async (k) => {
    const [admins, owned] = await Promise.all([
      getDocs(query(collection(db, 'businessAdmins'), where('userId', '==', u), limit(k))).catch(() => ({ docs: [] })),
      getDocs(query(collection(db, 'businesses'), where('ownerId', '==', u), limit(k))).catch(() => ({ docs: [] })),
    ]);
    const ids = new Set([...admins.docs.map((d) => d.data().businessId), ...owned.docs.map((d) => d.id)].filter(Boolean));
    const list = await Promise.all([...ids].map(getBusiness));
    return list.filter(live);
  });
}

/** Whether the signed-in user may manage the page (same checks as the rules). */
export async function canManageBusiness(biz) {
  const u = myUid.value;
  if (!u || !biz) return false;
  if (isAdmin.value || biz.ownerId === u) return true;
  const [a, b] = await Promise.all([
    getDoc(doc(db, 'businessAdmins', `${biz.id}_${u}`)).catch(() => null),
    getDoc(doc(db, 'businesses', biz.id, 'admins', u)).catch(() => null),
  ]);
  return !!(a?.exists() || b?.exists());
}

/* ── Create / edit ─────────────────────────────────────────── */

export async function createBusiness(f) {
  const m = me();
  const online = f.businessType === 'online';
  const data = {
    title: f.title.trim(), name: f.title.trim(), description: (f.description || '').trim(), category: f.category || 'other',
    tags: (f.tags || []).slice(0, 8), plan: 'free', status: 'active', verified: false,
    ownerId: m.uid, ownerName: m.name, ownerEmail: authUser.value?.email || '',
    businessType: online ? 'online' : 'physical', isOnline: online,
    city: online ? '' : (f.city || ''), address: online ? '' : (f.address || '').trim(), mapsLink: online ? '' : (f.mapsLink || '').trim(),
    serviceArea: f.serviceArea || (online ? 'georgia' : ''), serviceAreaText: '',
    phone: (f.phone || '').trim(), email: (f.email || '').trim(), website: (f.website || '').trim(),
    socialLinks: { instagram: (f.instagram || '').trim(), facebook: (f.facebook || '').trim(), whatsapp: (f.whatsapp || '').trim() },
    coverUrl: f.coverUrl || '', logoUrl: f.logoUrl || '',
    priceRange: f.priceRange || '', startingPrice: '', workingHours: f.workingHours || null,
    lat: f.lat ?? null, lng: f.lng ?? null,
    followerCount: 0, postCount: 0, reviewCount: 0, viewCount: 0, ratingAverage: 0, ratingTotal: 0, ratingCount: 0,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'businesses'), data);
  dropCached('businesses');
  // The owner record lets rules (isBizOwner) recognise the creator.
  await setDoc(doc(db, 'businessAdmins', `${ref.id}_${m.uid}`), { businessId: ref.id, userId: m.uid, role: 'owner', createdAt: serverTimestamp() }).catch((e) => console.warn('[businessAdmins]', e.code));
  return ref.id;
}

const EDITABLE = ['title', 'description', 'category', 'tags', 'city', 'address', 'mapsLink', 'phone', 'email', 'website', 'coverUrl', 'logoUrl', 'priceRange', 'workingHours', 'businessType', 'lat', 'lng'];

export async function updateBusiness(id, patch) {
  const data = {};
  for (const k of EDITABLE) if (patch[k] !== undefined) data[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k];
  if (data.title) data.name = data.title;
  if (data.businessType) data.isOnline = data.businessType === 'online';
  if (patch.socialLinks) data.socialLinks = patch.socialLinks;
  data.updatedAt = serverTimestamp();
  await updateDoc(doc(db, 'businesses', id), data);
  cache.delete(id);
  dropCached('businesses');
}

export async function deleteBusiness(id) {
  await updateDoc(doc(db, 'businesses', id), { status: 'deleted', deleted: true, updatedAt: serverTimestamp() });
  cache.delete(id);
  dropCached('businesses');
}

/* ── Followers ─────────────────────────────────────────────── */

export async function isFollowingBusiness(bizId) {
  const u = myUid.value;
  if (!u) return false;
  const s = await getDoc(doc(db, 'businessFollowers', `${bizId}_${u}`)).catch(() => null);
  return !!s?.exists();
}

export async function setFollowBusiness(biz, on) {
  const m = me();
  const ref = doc(db, 'businessFollowers', `${biz.id}_${m.uid}`);
  if (on) {
    await setDoc(ref, { businessId: biz.id, userId: m.uid, createdAt: serverTimestamp() });
    notifyBusiness(biz.id, { type: 'business_follow', title: `${m.name} გამოიწერა შენი გვერდი`, href: `business.html?id=${biz.id}` });
  } else {
    await deleteDoc(ref);
  }
  updateDoc(doc(db, 'businesses', biz.id), { followerCount: increment(on ? 1 : -1) }).catch(() => {});
}

export async function followedBusinesses() {
  const u = myUid.value;
  if (!u) return [];
  const snap = await getDocs(query(collection(db, 'businessFollowers'), where('userId', '==', u), limit(50))).catch(() => ({ docs: [] }));
  const list = await Promise.all(snap.docs.map((d) => getBusiness(d.data().businessId)));
  return list.filter(live);
}

export async function businessFollowers(bizId, n = 50) {
  const snap = await getDocs(query(collection(db, 'businessFollowers'), where('businessId', '==', bizId), limit(n))).catch(() => ({ docs: [] }));
  return snap.docs.map((d) => ({ ...d.data(), createdAt: tsToMillis(d.data().createdAt) })).sort((a, b) => b.createdAt - a.createdAt);
}

/* ── Reviews ───────────────────────────────────────────────── */

const normReview = (d) => {
  const x = d.data();
  return {
    id: d.id, businessId: x.businessId, userId: x.userId, userName: x.userName || '', avatar: x.userAvatarUrl || x.userAvatar || x.avatar || '',
    rating: Number(x.rating) || 0, text: x.text || x.comment || '', ownerReply: typeof x.ownerReply === 'string' ? x.ownerReply : (x.ownerReply?.text || ''),
    status: x.status || 'active', createdAt: tsToMillis(x.createdAt),
  };
};

export function listenBusinessReviews(bizId, onData) {
  return onSnapshot(query(collection(db, 'businessReviews'), where('businessId', '==', bizId), limit(100)), (s) => {
    onData(s.docs.map(normReview).filter((r) => r.status !== 'hidden' && r.status !== 'deleted').sort((a, b) => b.createdAt - a.createdAt));
  }, () => onData([]));
}

export async function addBusinessReview(biz, rating, text) {
  const m = me();
  await addDoc(collection(db, 'businessReviews'), {
    businessId: biz.id, userId: m.uid, userName: m.name, userAvatarUrl: m.avatar || '', rating: Number(rating), text: text.trim(),
    status: 'active', helpful: 0, reported: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'businesses', biz.id);
    const s = await tx.get(ref);
    if (!s.exists()) return;
    const d = s.data();
    const count = (Number(d.ratingCount) || 0) + 1;
    const total = (Number(d.ratingTotal) || 0) + Number(rating);
    tx.update(ref, { ratingCount: count, ratingTotal: total, ratingAverage: Math.round((total / count) * 10) / 10, reviewCount: (Number(d.reviewCount) || 0) + 1, updatedAt: serverTimestamp() });
  }).catch((e) => console.warn('[review counters]', e.code));
  notifyBusiness(biz.id, { type: 'business_review', title: `${m.name} შეაფასა შენი გვერდი ${'★'.repeat(rating)}`, body: text.slice(0, 120), href: `business.html?id=${biz.id}#reviews` });
}

export async function deleteBusinessReview(review) {
  await deleteDoc(doc(db, 'businessReviews', review.id));
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'businesses', review.businessId);
    const s = await tx.get(ref);
    if (!s.exists()) return;
    const d = s.data();
    const count = Math.max(0, (Number(d.ratingCount) || 0) - 1);
    const total = Math.max(0, (Number(d.ratingTotal) || 0) - review.rating);
    tx.update(ref, { ratingCount: count, ratingTotal: total, ratingAverage: count ? Math.round((total / count) * 10) / 10 : 0, reviewCount: Math.max(0, (Number(d.reviewCount) || 0) - 1), updatedAt: serverTimestamp() });
  }).catch(() => {});
}

export async function replyToReview(reviewId, text) {
  await updateDoc(doc(db, 'businessReviews', reviewId), { ownerReply: text.trim(), updatedAt: serverTimestamp() });
}

/* ── Services, gallery, offers ─────────────────────────────── */

const sub = (bizId, name) => collection(db, 'businesses', bizId, name);
const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToMillis(d.data().createdAt) }));

export async function listServices(bizId) {
  const s = await getDocs(query(sub(bizId, 'services'), limit(100))).catch(() => ({ docs: [] }));
  return rows(s).filter((x) => x.status !== 'inactive').map((x) => ({ ...x, title: x.title || x.name || '' })).sort((a, b) => (a.order || 0) - (b.order || 0));
}
export async function saveService(bizId, service) {
  const data = { title: service.title.trim(), name: service.title.trim(), description: (service.description || '').trim(), price: String(service.price || '').trim(), currency: 'GEL', status: 'active', order: Number(service.order) || 0, updatedAt: serverTimestamp() };
  if (service.id) await updateDoc(doc(db, 'businesses', bizId, 'services', service.id), data);
  else await addDoc(sub(bizId, 'services'), { ...data, category: '', createdBy: myUid.value, createdAt: serverTimestamp() });
}
export async function deleteService(bizId, id) { await deleteDoc(doc(db, 'businesses', bizId, 'services', id)); }

export async function listGallery(bizId) {
  const s = await getDocs(query(sub(bizId, 'gallery'), limit(60))).catch(() => ({ docs: [] }));
  return rows(s).filter((x) => x.url).sort((a, b) => (a.order || 0) - (b.order || 0) || b.createdAt - a.createdAt);
}
export async function addGalleryPhoto(bizId, url, caption = '') {
  await addDoc(sub(bizId, 'gallery'), { url, caption, order: Date.now(), uploadedBy: myUid.value, createdAt: serverTimestamp() });
}
export async function deleteGalleryPhoto(bizId, id) { await deleteDoc(doc(db, 'businesses', bizId, 'gallery', id)); }

export async function listOffers(bizId) {
  const s = await getDocs(query(collection(db, 'businessOffers'), where('businessId', '==', bizId), limit(50))).catch(() => ({ docs: [] }));
  const now = new Date().toISOString().slice(0, 10);
  return rows(s).filter((o) => o.status === 'active').map((o) => ({ ...o, expired: !!o.endsAt && o.endsAt < now })).sort((a, b) => b.createdAt - a.createdAt);
}
export async function createOffer(bizId, { title, description = '', startsAt = '', endsAt = '' }) {
  const u = myUid.value;
  await addDoc(collection(db, 'businessOffers'), {
    businessId: bizId, title: title.trim(), description: description.trim(), startsAt, endsAt, createdBy: u, ownerId: u,
    status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  dropCached('offers');
}
export async function deleteOffer(id) { await deleteDoc(doc(db, 'businessOffers', id)); dropCached('offers'); }

/* ── Quote requests ────────────────────────────────────────── */

export async function sendQuoteRequest(biz, { name, email, phone = '', message, service = '' }) {
  const m = me();
  const payload = { name: name.trim(), email: email.trim(), phone: phone.trim(), message: message.trim(), submittedBy: m.uid, businessId: biz.id, status: 'new', source: 'general', createdAt: serverTimestamp() };
  if (service) payload.service = service;
  await addDoc(sub(biz.id, 'quoteRequests'), payload);
  updateDoc(doc(db, 'businesses', biz.id), { quoteCount: increment(1) }).catch(() => {});
  notifyBusiness(biz.id, { type: 'quote_request', title: `${name} გამოგიგზავნა მოთხოვნა`, body: message.slice(0, 120), href: `business.html?id=${biz.id}#quotes`, extra: { submittedBy: m.uid } });
}

export async function listQuoteRequests(bizId) {
  const s = await getDocs(query(sub(bizId, 'quoteRequests'), limit(100))).catch(() => ({ docs: [] }));
  return rows(s).sort((a, b) => b.createdAt - a.createdAt);
}
export async function setQuoteStatus(bizId, id, status) {
  await updateDoc(doc(db, 'businesses', bizId, 'quoteRequests', id), { status, updatedAt: serverTimestamp() });
}

/* ── Analytics (one document per day) ──────────────────────── */

const viewed = new Set();
/** Counts a page view (views) or a tap on call / directions / website. */
export function trackBusiness(bizId, kind = 'views') {
  if (!myUid.value || !bizId) return;
  if (kind === 'views') {
    if (viewed.has(bizId)) return;
    viewed.add(bizId);
    updateDoc(doc(db, 'businesses', bizId), { viewCount: increment(1) }).catch(() => {});
  }
  const day = new Date().toISOString().slice(0, 10);
  setDoc(doc(db, 'businesses', bizId, 'analytics', day), { [kind]: increment(1), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
}

export async function businessAnalytics(bizId, days = 30) {
  const s = await getDocs(query(sub(bizId, 'analytics'), limit(400))).catch(() => ({ docs: [] }));
  const byDay = Object.fromEntries(s.docs.map((d) => [d.id, d.data()]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const d = byDay[day] || {};
    out.push({ day, views: Number(d.views) || 0, calls: Number(d.calls) || 0, directions: Number(d.directions) || 0, clicks: Number(d.clicks) || 0 });
  }
  return out;
}
