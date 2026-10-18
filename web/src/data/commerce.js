import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where,
  orderBy, documentId, startAfter, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { uid } from '../lib/auth.js';
import { dropCached } from './cache.js';
import {
  commerceId, normalizeCommerceItem, normalizeCommerceOffer, commerceOfferState,
  discountPercent, COMMERCE_TYPES, normalizeBusinessBranch,
} from '../lib/commerce.js';

const row = (snapshot) => ({ ...snapshot.data(), id: snapshot.id });
const count = (value) => Math.max(1, Math.min(50, Math.floor(Number(value) || 24)));
const identity = (previous, userId) => previous
  ? { createdBy: previous.createdBy, createdAt: previous.createdAt }
  : { createdBy: userId, createdAt: serverTimestamp() };
function signedInUid() {
  if (!uid.value) throw new Error('გასაგრძელებლად შედი ანგარიშში.');
  return uid.value;
}

export async function getCommerceItem(id) {
  const snapshot = await getDoc(doc(db, 'commerceItems', commerceId(id)));
  return snapshot.exists() ? row(snapshot) : null;
}

/** A cursor is the last Firestore snapshot, not an offset. Filtering is done
 * before pagination; loading another page cannot repeat a boundary record. */
export async function listDiscounts({ cursor = null, pageSize = 24, type = '', categoryId = '', businessId = '', includeDemo = false, now = Date.now() } = {}) {
  const constraints = [where('status', '==', 'published')];
  if (!includeDemo) constraints.push(where('isDemo', '==', false));
  if (type) {
    if (!COMMERCE_TYPES.includes(type)) throw new Error('არასწორი შეთავაზების ტიპი.');
    constraints.push(where('type', '==', type));
  }
  if (categoryId) constraints.push(where('categoryId', '==', categoryId));
  if (businessId) constraints.push(where('businessId', '==', commerceId(businessId, 'businessId')));
  constraints.push(where('endsAtMs', '>', now), orderBy('endsAtMs', 'asc'), orderBy(documentId(), 'asc'));
  if (cursor) constraints.push(startAfter(cursor));
  const size = count(pageSize);
  constraints.push(limit(size + 1));
  const snapshot = await getDocs(query(collection(db, 'commerceOffers'), ...constraints));
  const page = snapshot.docs.slice(0, size);
  const businessCache = new Map();
  const itemCache = new Map();
  const read = (cache, collectionName, id) => {
    if (!cache.has(id)) cache.set(id, getDoc(doc(db, collectionName, id)));
    return cache.get(id);
  };
  const items = (await Promise.all(page.map(async (offerDoc) => {
    const offer = row(offerDoc);
    let itemSnapshot;
    // A merchant can archive an item after publishing an offer. The now-private
    // item must disappear from the feed; network/availability errors still surface.
    try { itemSnapshot = await read(itemCache, 'commerceItems', commerceId(offer.itemId)); }
    catch (error) { if (error.code === 'permission-denied') return null; throw error; }
    if (!itemSnapshot.exists()) return null;
    const item = row(itemSnapshot);
    if (item.status !== 'published' || item.available === false || item.businessId !== offer.businessId || !!item.isDemo !== !!offer.isDemo) return null;
    const businessSnapshot = await read(businessCache, 'businesses', commerceId(offer.businessId));
    if (!businessSnapshot.exists()) return null;
    const business = businessSnapshot.data();
    if (['deleted', 'suspended', 'inactive'].includes(business.status) || business.deleted === true) return null;
    return {
      ...offer, itemType: offer.type, itemTitle: item.title,
      businessName: business.name || business.title || '',
      businessImageUrl: business.logoUrl || business.logo || business.avatar || business.photoUrl || '',
      city: business.city || '', address: business.address || '', placeId: business.placeId || '',
      imageUrl: offer.imageUrl || item.imageUrl || '',
      dietaryTags: item.dietaryTags || [], preparationMinutes: item.preparationMinutes ?? null,
      discountPercent: discountPercent(offer.originalPriceMinor, offer.priceMinor),
      offerState: commerceOfferState(offer, now),
    };
  }))).filter(Boolean);
  return { items, cursor: page.at(-1) || cursor, hasMore: snapshot.docs.length > size };
}

export async function listBusinessCatalog(businessId, { cursor = null, pageSize = 24, type = '', management = false } = {}) {
  const constraints = [where('businessId', '==', commerceId(businessId, 'businessId'))];
  if (!management) constraints.push(where('status', '==', 'published'));
  if (type) constraints.push(where('type', '==', type));
  constraints.push(orderBy('title', 'asc'), orderBy(documentId(), 'asc'));
  if (cursor) constraints.push(startAfter(cursor));
  const size = count(pageSize);
  const snapshot = await getDocs(query(collection(db, 'commerceItems'), ...constraints, limit(size + 1)));
  const page = snapshot.docs.slice(0, size);
  return { items: page.map(row), cursor: page.at(-1) || cursor, hasMore: snapshot.docs.length > size };
}

export async function listBusinessDiscounts(businessId, { cursor = null, pageSize = 24 } = {}) {
  const constraints = [where('businessId', '==', commerceId(businessId, 'businessId')), orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc')];
  if (cursor) constraints.push(startAfter(cursor));
  const size = count(pageSize);
  const snapshot = await getDocs(query(collection(db, 'commerceOffers'), ...constraints, limit(size + 1)));
  const page = snapshot.docs.slice(0, size);
  return { items: page.map((entry) => { const value = row(entry); return { ...value, offerState: commerceOfferState(value) }; }), cursor: page.at(-1) || cursor, hasMore: snapshot.docs.length > size };
}

export async function listBusinessBranches(businessId, { management = false } = {}) {
  const constraints = [where('businessId', '==', commerceId(businessId, 'businessId'))];
  if (!management) constraints.push(where('status', '==', 'published'));
  const snapshot = await getDocs(query(collection(db, 'businessBranches'), ...constraints, orderBy('title', 'asc'), limit(100)));
  return snapshot.docs.map(row);
}

export async function saveCommerceItem(businessId, input) {
  const userId = signedInUid();
  const reference = input.id ? doc(db, 'commerceItems', commerceId(input.id)) : doc(collection(db, 'commerceItems'));
  const previousSnapshot = input.id ? await getDoc(reference) : null;
  if (input.id && !previousSnapshot.exists()) throw new Error('კატალოგის ჩანაწერი ვეღარ მოიძებნა.');
  const previous = previousSnapshot?.exists() ? previousSnapshot.data() : null;
  if (previous && previous.businessId !== businessId) throw new Error('ეს ჩანაწერი სხვა ბიზნესს ეკუთვნის.');
  const normalized = normalizeCommerceItem({ ...previous, ...input, businessId });
  await setDoc(reference, { ...normalized, ...identity(previous, userId), updatedAt: serverTimestamp() });
  dropCached('commerce:');
  return { id: reference.id, ...normalized };
}

export async function saveBusinessBranch(businessId, input) {
  const userId = signedInUid();
  const reference = input.id ? doc(db, 'businessBranches', commerceId(input.id)) : doc(collection(db, 'businessBranches'));
  const previousSnapshot = input.id ? await getDoc(reference) : null;
  if (input.id && !previousSnapshot.exists()) throw new Error('ფილიალი ვეღარ მოიძებნა.');
  const previous = previousSnapshot?.exists() ? previousSnapshot.data() : null;
  if (previous && previous.businessId !== businessId) throw new Error('ეს ფილიალი სხვა ბიზნესს ეკუთვნის.');
  const normalized = normalizeBusinessBranch({ ...previous, ...input, businessId });
  await setDoc(reference, { ...normalized, ...identity(previous, userId), updatedAt: serverTimestamp() });
  dropCached('commerce:');
  return { id: reference.id, ...normalized };
}

export async function saveCommerceOffer(businessId, input) {
  const userId = signedInUid();
  const reference = input.id ? doc(db, 'commerceOffers', commerceId(input.id)) : doc(collection(db, 'commerceOffers'));
  const previousSnapshot = input.id ? await getDoc(reference) : null;
  if (input.id && !previousSnapshot.exists()) throw new Error('შეთავაზება ვეღარ მოიძებნა.');
  const previous = previousSnapshot?.exists() ? previousSnapshot.data() : null;
  if (previous && previous.businessId !== businessId) throw new Error('ეს შეთავაზება სხვა ბიზნესს ეკუთვნის.');
  const values = { ...previous, ...input, businessId };
  const itemSnapshot = await getDoc(doc(db, 'commerceItems', commerceId(values.itemId, 'itemId')));
  if (!itemSnapshot.exists()) throw new Error('ჯერ დაამატე კატალოგის ჩანაწერი.');
  const item = row(itemSnapshot);
  const normalized = normalizeCommerceOffer({ ...values, originalPriceMinor: values.originalPriceMinor ?? item.priceMinor }, item);
  await setDoc(reference, { ...normalized, ...identity(previous, userId), updatedAt: serverTimestamp() });
  return { id: reference.id, ...normalized };
}

/** Archive, rather than deleting records that other offers may reference. */
export async function archiveCommerceRecord(collectionName, id) {
  signedInUid();
  if (!['commerceItems', 'commerceOffers', 'businessBranches'].includes(collectionName)) throw new Error('არასწორი კოლექცია.');
  await updateDoc(doc(db, collectionName, commerceId(id)), { status: 'archived', updatedAt: serverTimestamp() });
  dropCached('commerce:');
}
