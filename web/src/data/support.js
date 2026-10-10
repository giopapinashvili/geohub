// Support requests (tickets). People write from the in-app form — signed in
// or not — and admins answer from the admin panel. The rules accept only
// this exact shape, so keep the fields in sync with firestore.rules.

import { collection, query, where, limit, getDocs, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { uid as myUid, authUser, profile } from '../lib/auth.js';
import { lang } from '../lib/i18n.js';
import { tsToMillis } from '../lib/format.js';

export const TICKET_CATEGORIES = ['help', 'bug', 'account', 'business', 'report', 'other'];

const clip = (v, n) => String(v || '').trim().slice(0, n);

export async function sendTicket({ category = 'help', subject = '', message = '', email = '', name = '' }) {
  const u = myUid.value;
  const data = {
    userId: u || '',
    name: clip(name || profile.value?.name || '', 120),
    email: clip(email || authUser.value?.email || '', 200),
    category,
    subject: clip(subject, 200),
    message: clip(message, 4000),
    status: 'open',
    page: clip(location.pathname, 200),
    lang: lang.value || 'ka',
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'tickets'), data);
  return ref.id;
}

/** The signed-in user's pending account-deletion request, if any. */
export async function myDeletionRequest() {
  const u = myUid.value;
  if (!u) return null;
  const s = await getDocs(query(collection(db, 'tickets'), where('userId', '==', u), where('category', '==', 'account_deletion'), limit(5)));
  const open = s.docs.map((d) => ({ id: d.id, ...d.data() })).find((x) => x.status !== 'done');
  return open || null;
}

export function requestAccountDeletion(reason = '') {
  return sendTicket({
    category: 'account_deletion',
    subject: 'Account deletion request',
    message: `Please delete my GeoHub account and its data.${reason ? `\n\n${reason}` : ''}`,
  });
}

/* ── Admin ─────────────────────────────────────────────────── */

export async function listTickets(n = 200) {
  const s = await getDocs(query(collection(db, 'tickets'), limit(n)));
  return s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToMillis(d.data().createdAt) }))
    .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.createdAt - a.createdAt);
}

export function setTicketStatus(id, status) {
  return updateDoc(doc(db, 'tickets', id), { status, updatedAt: serverTimestamp() });
}
