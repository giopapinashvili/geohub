// Marketplace listings: items, services, jobs, property (collection "marketplace").
import { doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, collection, query, limit, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { me, uid as myUid } from '../lib/auth.js';
import { normItem, isCorruptSeed } from './normalize.js';

export const MARKET_CATS = [
  { id: 'item', icon: 'package' }, { id: 'service', icon: 'wrench' }, { id: 'job', icon: 'briefcase' }, { id: 'property', icon: 'house-line' },
];

export async function listItems(n = 300) {
  const snap = await getDocs(query(collection(db, 'marketplace'), limit(n)));
  return snap.docs.filter((d) => !isCorruptSeed(d.data())).map((d) => normItem(d.id, d.data())).filter((i) => i.status === 'active').sort((a, b) => b.createdAt - a.createdAt);
}

export async function myItems() {
  const u = myUid.value;
  if (!u) return [];
  const snap = await getDocs(query(collection(db, 'marketplace'), where('sellerId', '==', u), limit(100))).catch(() => ({ docs: [] }));
  return snap.docs.map((d) => normItem(d.id, d.data())).filter((i) => i.status !== 'deleted').sort((a, b) => b.createdAt - a.createdAt);
}

export async function getItem(id) {
  const s = await getDoc(doc(db, 'marketplace', id)).catch(() => null);
  return s?.exists() ? normItem(s.id, s.data()) : null;
}

export async function createItem({ title, description, price, category, condition, city, images }) {
  const m = me();
  const ref = await addDoc(collection(db, 'marketplace'), {
    title: title.trim(), description: description.trim(), price: Number(price) || 0, currency: 'GEL', category, subcategory: '', condition: condition || '',
    city, images, imageUrl: images[0] || '', sellerId: m.uid, userId: m.uid, ownerId: m.uid, sellerName: m.name, sellerAvatar: m.avatar || '',
    status: 'active', viewCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function setItemStatus(id, status) { await updateDoc(doc(db, 'marketplace', id), { status, updatedAt: serverTimestamp() }); }
export async function deleteItem(id) { await deleteDoc(doc(db, 'marketplace', id)); }
