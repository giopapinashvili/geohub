// "I need" requests: stored as posts with type 'need' (the posts rules
// already allow them), answered with comments or a direct message.
// Businesses in the matching category and city get a page notification.

import { collection, query, where, limit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { me } from '../lib/auth.js';
import { normPost, isCorruptSeed } from './normalize.js';
import { listBusinesses } from './business.js';
import { notifyBusiness } from './notify.js';
import { editPost } from './posts.js';
import { bizCategory } from '../features/business/categories.js';
import { cityLabel } from '../lib/geo.js';

export const NEED_CATS = [
  { id: 'repair', icon: 'wrench', tone: '#ca8a04', groups: ['services', 'auto'] },
  { id: 'beauty', icon: 'sparkle', tone: '#ec4899', groups: ['beauty'] },
  { id: 'food', icon: 'fork-knife', tone: '#f97316', groups: ['food'] },
  { id: 'events', icon: 'camera', tone: '#db2777', groups: ['events', 'fun'] },
  { id: 'transport', icon: 'car', tone: '#2563eb', groups: ['auto', 'travel'] },
  { id: 'education', icon: 'graduation-cap', tone: '#7c3aed', groups: ['education'] },
  { id: 'it', icon: 'laptop', tone: '#0891b2', groups: ['services'] },
  { id: 'cleaning', icon: 'sparkle', tone: '#0d9488', groups: ['services'] },
  { id: 'property', icon: 'house-line', tone: '#16a34a', groups: ['services'] },
  { id: 'health', icon: 'first-aid-kit', tone: '#dc2626', groups: ['health'] },
  { id: 'buy', icon: 'shopping-bag', tone: '#9333ea', groups: ['shopping'] },
  { id: 'other', icon: 'question', tone: '#64748b', groups: [] },
];
export const WHEN = ['asap', 'today', 'week', 'flexible'];

export const needOf = (p) => p.raw?.need || {};

export async function listNeeds(n = 150) {
  const snap = await getDocs(query(collection(db, 'posts'), where('type', '==', 'need'), limit(n))).catch(() => ({ docs: [] }));
  return snap.docs.filter((d) => !isCorruptSeed(d.data())).map((d) => normPost(d.id, d.data()))
    .filter((p) => p.status === 'active').sort((a, b) => b.createdAt - a.createdAt);
}

export async function createNeed({ text, category, city, budget, when }) {
  const m = me();
  const clean = text.trim();
  const ref = await addDoc(collection(db, 'posts'), {
    type: 'need', text: clean, need: { category, city, budget: Number(budget) || 0, when, status: 'open' },
    authorId: m.uid, userId: m.uid, createdByUid: m.uid, authorName: m.name, authorAvatar: m.avatar || '', authorType: 'user',
    authorVerified: !!m.verified, businessId: null, groupId: null, city, mediaUrl: null, mediaUrls: [], likeCount: 0, commentCount: 0, shareCount: 0,
    visibility: 'public', status: 'active', targetType: 'user', targetId: m.uid, createdAt: serverTimestamp(),
  });
  // Tell up to 15 matching businesses in the same city (or online ones).
  const groups = NEED_CATS.find((c) => c.id === category)?.groups || [];
  if (groups.length) {
    listBusinesses(300).then((list) => {
      const match = list.filter((b) => b.ownerId !== m.uid && groups.includes(bizCategory(b.category)?.group) && (b.isOnline || cityLabel(b.city) === cityLabel(city))).slice(0, 15);
      for (const b of match) notifyBusiness(b.id, { type: 'need', title: `ახალი მოთხოვნა: ${clean.slice(0, 60)}`, body: cityLabel(city), href: `feed.html?post=${ref.id}` });
    }).catch(() => {});
  }
  return ref.id;
}

export const closeNeed = (id) => editPost(id, { status: 'closed' });
