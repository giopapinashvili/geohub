import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { uid } from '../lib/auth.js';
import { readableDiscountWatches, addDiscountWatch } from '../lib/discountWatchlist.js';

const reference = userId => doc(db, 'users', userId, 'private', 'discountWatchlist');
function currentUser() {
  if (!uid.value) throw new Error('ძიების შესანახად შედი ანგარიშში.');
  return uid.value;
}
export function listenDiscountWatches(userId, onData, onError) {
  if (!userId) { onData([]); return () => {}; }
  return onSnapshot(reference(userId), snapshot => onData(readableDiscountWatches(snapshot.data()?.entries)), onError);
}
export async function saveDiscountWatch(query) {
  const ref = reference(currentUser());
  const id = crypto.randomUUID();
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    const entries = addDiscountWatch(snapshot.data()?.entries, query, { id });
    transaction.set(ref, { version: 1, entries, updatedAt: serverTimestamp() });
  });
}
export async function removeDiscountWatch(id) {
  const ref = reference(currentUser());
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    const entries = readableDiscountWatches(snapshot.data()?.entries).filter(entry => entry.id !== id);
    transaction.set(ref, { version: 1, entries, updatedAt: serverTimestamp() });
  });
}
