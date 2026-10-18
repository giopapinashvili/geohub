import { collection, query, where, orderBy, documentId, startAfter, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { cachedList } from './cache.js';
import { isReviewExperienceTag, validCommunityReview, readableReviewTags } from '../lib/reviewTags.js';

const CAP = 2000;
/** Read only the selected community tag; never download every place's reviews. */
export async function loadCommunityTagPlaces(tag) {
  if (!tag) return { tag: '', placeIds: [], counts: {}, scannedCount: 0, cap: CAP, truncated: false };
  if (!isReviewExperienceTag(tag)) throw new Error('უცნობი შეფასების ნიშანი.');
  const [result] = await cachedList(`review-tags:${tag}`, 1, 5 * 60000, async () => {
    const rows = [];
    let cursor;
    while (rows.length <= CAP) {
      const size = Math.min(200, CAP + 1 - rows.length);
      const snapshot = await getDocs(query(collection(db, 'placeReviews'), where('experienceTags', 'array-contains', tag), orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(size)));
      rows.push(...snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })));
      if (snapshot.docs.length < size || rows.length > CAP) break;
      cursor = snapshot.docs.at(-1);
    }
    const places = new Map();
    for (const review of rows.slice(0, CAP)) {
      if (!validCommunityReview(review) || typeof review.placeId !== 'string' || !review.placeId || !readableReviewTags(review).includes(tag)) continue;
      if (!places.has(review.placeId)) places.set(review.placeId, new Set());
      places.get(review.placeId).add(review.userId);
    }
    return [{ tag, placeIds: [...places.keys()], counts: Object.fromEntries([...places].map(([id, people]) => [id, people.size])), scannedCount: Math.min(rows.length, CAP), cap: CAP, truncated: rows.length > CAP }];
  });
  return { ...result, placeIds: [...result.placeIds], counts: { ...result.counts } };
}
