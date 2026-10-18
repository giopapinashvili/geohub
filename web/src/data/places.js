import {
  doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, onSnapshot, documentId, startAfter,
  serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { cachedList, dropCached } from './cache.js';
import { me } from '../lib/auth.js';
import { normPlace, normPost, isCorruptSeed } from './normalize.js';
import { tsToMillis } from '../lib/format.js';
import { coordinatesForWrite } from '../lib/coordinates.js';
import { isImportedPlaceId, getImportedPlace } from './importedPlaces.js';
import { normalizeReviewTags } from '../lib/reviewTags.js';
import { isCatalogLocationId } from '../lib/placeLinks.js';
import { getCatalogMapPlace } from './catalogMapPlaces.js';

const cache = new Map();

/** Places for the map, explore and check-in, fetched once and shared. */
export function listPlaces(n = 250) {
  return cachedList('places', 250, 10 * 60000, async (k) => {
    const snap = await getDocs(query(collection(db, 'places'), limit(k)));
    return snap.docs.filter((d) => !isCorruptSeed(d.data())).map((d) => normPlace(d.id, d.data())).filter((p) => p.status !== 'inactive' && p.status !== 'deleted');
  }, n);
}

/** Map-only paginated catalogue. The cap is explicit, never silently complete. */
export async function listMapPlaces() {
  const [result] = await cachedList('places:map', 1, 10 * 60000, async () => {
    const places = [];
    const pageSize = 250;
    const cap = 5000;
    let cursor = null;
    let scannedCount = 0;
    let truncated = false;
    while (scannedCount < cap) {
      const take = Math.min(pageSize, cap - scannedCount);
      const constraints = [orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(take)];
      const page = await getDocs(query(collection(db, 'places'), ...constraints));
      scannedCount += page.size;
      for (const record of page.docs) {
        const data = record.data();
        if (isCorruptSeed(data)) continue;
        const place = normPlace(record.id, data);
        if (place.status !== 'inactive' && place.status !== 'deleted') places.push(place);
      }
      if (page.size < take) break;
      cursor = page.docs.at(-1);
      if (scannedCount === cap) {
        // One-document probe distinguishes exactly cap records from truncation.
        const next = await getDocs(query(collection(db, 'places'), orderBy(documentId()), startAfter(cursor), limit(1)));
        truncated = !next.empty;
      }
    }
    return [{ places, scannedCount, cap, truncated }];
  });
  return { ...result, places: [...result.places] };
}

export function getPlace(id) {
  if (isImportedPlaceId(id)) return getImportedPlace(id);
  if (isCatalogLocationId(id)) return getCatalogMapPlace(id);
  if (!cache.has(id)) cache.set(id, getDoc(doc(db, 'places', id)).then((s) => (s.exists() ? normPlace(s.id, s.data()) : null)).catch(() => null));
  return cache.get(id);
}

export function listenPlace(id, onData, onError) {
  if (isImportedPlaceId(id) || isCatalogLocationId(id)) {
    let active = true;
    getPlace(id).then((place) => { if (active) onData(place); }).catch((error) => { if (active) onError?.(error); });
    return () => { active = false; };
  }
  return onSnapshot(doc(db, 'places', id), (s) => onData(s.exists() ? normPlace(s.id, s.data()) : null), onError);
}

export async function placeCategories() {
  const snap = await getDocs(collection(db, 'placeCategories')).catch(() => ({ docs: [] }));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.active !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export async function createPlace({ name, description = '', category = 'other', address = '', city = '', lat = null, lng = null, photoUrl = '' }) {
  const coords = coordinatesForWrite({ lat, lng });
  const m = me();
  const ref = await addDoc(collection(db, 'places'), {
    name: name.trim(), title: name.trim(), description: description.trim(), category, categoryId: category, address, city,
    ...coords, photoUrl, imageUrl: photoUrl || null, tags: [], creatorId: m.uid, userId: m.uid, createdBy: m.uid, ownerId: m.uid,
    creatorName: m.name, rating: 0, reviewCount: 0, saveCount: 0, status: 'active', dataSource: 'manual', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  dropCached('places');
  return ref.id;
}

export function listenPlaceReviews(placeId, onData, onError) {
  return onSnapshot(query(collection(db, 'placeReviews'), where('placeId', '==', placeId), orderBy('createdAt', 'desc'), limit(60)), (s) => {
    onData(s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToMillis(d.data().createdAt) })).sort((a, b) => b.createdAt - a.createdAt));
  }, (error) => { if (onError) onError(error); else onData([]); });
}

export async function addPlaceReview(placeId, rating, comment, experienceTags = []) {
  const stars = Number(rating);
  const text = String(comment || '').trim();
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(placeId) || !Number.isInteger(stars) || stars < 1 || stars > 5 || text.length > 1000) throw new Error('შეამოწმე შეფასება და კომენტარი.');
  const tags = normalizeReviewTags(experienceTags);
  const m = me();
  await addDoc(collection(db, 'placeReviews'), {
    placeId, userId: m.uid, userName: m.name, userPhoto: m.avatar, rating: stars, comment: text, experienceTags: tags, createdAt: serverTimestamp(),
  });
  dropCached('review-tags:');
}

export async function deletePlaceReview(id) { await deleteDoc(doc(db, 'placeReviews', id)); dropCached('review-tags:'); }

/** Average and per-star counts from review documents. */
export function reviewStats(reviews, place) {
  const valid = reviews.filter((r) => Number(r.rating) >= 1 && Number(r.rating) <= 5);
  const dist = [0, 0, 0, 0, 0];
  for (const r of valid) dist[Math.round(r.rating) - 1]++;
  if (!valid.length) return { avg: place?.rating || 0, count: place?.reviewCount || 0, dist };
  return { avg: valid.reduce((a, r) => a + Number(r.rating), 0) / valid.length, count: valid.length, dist };
}

export async function deletePlace(id) { await deleteDoc(doc(db, 'places', id)); dropCached('places'); }

/** Owner/admin edits, including an explicit latitude/longitude pair. */
export async function updatePlace(id, patch) {
  const allowed = {};
  for (const k of ['name', 'description', 'category', 'address', 'city']) if (patch[k] !== undefined) allowed[k] = String(patch[k]).trim();
  if (allowed.name) allowed.title = allowed.name;
  if (allowed.category) allowed.categoryId = allowed.category;
  if (patch.photoUrl) { allowed.photoUrl = patch.photoUrl; allowed.imageUrl = patch.photoUrl; allowed.coverImage = patch.photoUrl; }
  if ('lat' in patch || 'lng' in patch) {
    if (!('lat' in patch) || !('lng' in patch)) throw Object.assign(new Error('Both coordinates are required'), { code: 'invalid-coordinates' });
    Object.assign(allowed, coordinatesForWrite(patch));
  }
  await updateDoc(doc(db, 'places', id), { ...allowed, updatedAt: serverTimestamp() });
  cache.delete(id);
  dropCached('places');
}

/** Check in: a checkins record, the place's aggregate counter and a feed post. */
export async function checkIn(place, { caption = '', photoUrl = '', lat = null, lng = null, share = true } = {}) {
  const m = me();
  const data = {
    userId: m.uid, authorId: m.uid, authorName: m.name, authorAvatar: m.avatar,
    placeId: place.id || '', placeName: place.name, businessId: null, eventId: null,
    city: place.city || '', country: 'Georgia', lat, lng, accuracy: null, checkinType: 'normal',
    photoUrl: photoUrl || null, caption, verified: lat != null, verificationMethod: lat != null ? 'gps' : 'none', xpAwarded: 50,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'checkins'), data);
  if (place.id) {
    const agg = doc(db, 'placeCheckins', place.id);
    getDoc(agg).then((s) => (s.exists()
      ? updateDoc(agg, { count: increment(1), lastCheckin: serverTimestamp() })
      : setDoc(agg, { count: 1, lastCheckin: serverTimestamp() }))).catch(() => {});
  }
  updateDoc(doc(db, 'users', m.uid), { visitedPlaces: increment(1), checkinCount: increment(1), updatedAt: serverTimestamp() }).catch(() => {});
  if (share) {
    await addDoc(collection(db, 'posts'), {
      type: 'checkin', authorId: m.uid, userId: m.uid, createdByUid: m.uid, authorName: m.name, authorAvatar: m.avatar, authorType: 'user',
      placeId: place.id || '', placeName: place.name, location: { name: place.name, placeId: place.id || '' }, businessId: null,
      lat, lng, city: place.city || '', checkinId: ref.id, mediaUrl: photoUrl || null, mediaUrls: photoUrl ? [photoUrl] : [],
      imageUrl: photoUrl || null, text: caption || `📍 ${place.name}`, visibility: 'public', status: 'active',
      targetType: 'user', targetId: m.uid, likeCount: 0, commentCount: 0, shareCount: 0, createdAt: serverTimestamp(),
    }).catch((e) => console.warn('[checkin post]', e.code));
  }
  return ref.id;
}

export async function userCheckins(userId, n = 50) {
  const snap = await getDocs(query(collection(db, 'checkins'), where('authorId', '==', userId), limit(n))).catch(() => ({ docs: [] }));
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToMillis(d.data().createdAt) })).sort((a, b) => b.createdAt - a.createdAt);
}

export async function placeCheckins(placeId, n = 30) {
  const snap = await getDocs(query(collection(db, 'checkins'), where('placeId', '==', placeId), limit(n))).catch(() => ({ docs: [] }));
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToMillis(d.data().createdAt) })).sort((a, b) => b.createdAt - a.createdAt);
}

export async function placePosts(placeId, n = 30) {
  const snap = await getDocs(query(collection(db, 'posts'), where('placeId', '==', placeId), where('visibility', '==', 'public'), limit(n))).catch(() => ({ docs: [] }));
  return snap.docs.map((d) => normPost(d.id, d.data())).filter((p) => p.status === 'active').sort((a, b) => b.createdAt - a.createdAt);
}

