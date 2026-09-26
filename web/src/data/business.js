import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { normBiz } from './normalize.js';

const cache = new Map();
export function getBusiness(id) {
  if (!id) return Promise.resolve(null);
  if (!cache.has(id)) {
    cache.set(id, getDoc(doc(db, 'businesses', id)).then((s) => (s.exists() ? normBiz(s.id, s.data()) : null)).catch(() => null));
  }
  return cache.get(id);
}
