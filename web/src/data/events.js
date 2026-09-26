import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { normEvent } from './normalize.js';

export async function upcomingEvents(n = 10) {
  const now = new Date().toISOString().slice(0, 16);
  const snap = await getDocs(query(collection(db, 'events'), where('date', '>=', now), orderBy('date', 'asc'), limit(n)));
  return snap.docs.map((d) => normEvent(d.id, d.data())).filter((e) => e.status === 'active');
}
