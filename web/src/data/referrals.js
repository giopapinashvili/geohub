// Invites: every user has a code ('GH' + first 8 chars of the uid, as on the
// old site). A new account opened from an invite link records a referral
// (rules: referredId == caller, referrerId != caller).

import { collection, query, where, limit, getDocs, getDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { uid, profile } from '../lib/auth.js';
import { normUser } from './normalize.js';

const KEY = 'gh_ref_code';

export const codeFor = (id) => `GH${String(id).slice(0, 8).toUpperCase()}`;

/** Find the inviting user by referral code, username, GeoHub ID or uid. */
export async function findInviter(code) {
  const c = String(code || '').trim();
  if (!c) return null;
  try {
    const byCode = await getDocs(query(collection(db, 'users'), where('referralCode', '==', c.toUpperCase()), limit(1)));
    if (!byCode.empty) return normUser(byCode.docs[0].id, byCode.docs[0].data());
    const name = await getDoc(doc(db, 'usernames', c.toLowerCase()));
    const viaName = name.exists() ? name.data().uid : null;
    const geo = /^\d{5}$/.test(c) ? await getDoc(doc(db, 'geoIds', c)) : null;
    const id = viaName || (geo?.exists() ? geo.data().uid : null) || c;
    const u = await getDoc(doc(db, 'users', id));
    return u.exists() ? normUser(u.id, u.data()) : null;
  } catch { return null; }
}

export function rememberInvite(code) { try { localStorage.setItem(KEY, code); } catch { /* ignore */ } }

/** Make sure the signed-in user's own code is on their profile. */
export async function ensureMyCode() {
  const id = uid.value;
  if (!id) return null;
  const code = codeFor(id);
  if (profile.value?.raw?.referralCode !== code) updateDoc(doc(db, 'users', id), { referralCode: code }).catch(() => {});
  return code;
}

/** Record a pending invite once, after the invited person signs up. */
export async function claimPendingInvite() {
  let code;
  try { code = localStorage.getItem(KEY); } catch { return; }
  const id = uid.value;
  if (!code || !id) return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  if (profile.value?.raw?.referredBy) return;
  const inviter = await findInviter(code);
  if (!inviter || inviter.id === id) return;
  const createdAt = profile.value?.createdAt || 0;
  if (createdAt && Date.now() - createdAt > 3 * 86400000) return; // only new accounts
  await addDoc(collection(db, 'referrals'), { referrerId: inviter.id, referredId: id, referredUid: id, referrerCode: code, claimedAt: serverTimestamp() }).catch(() => {});
  await updateDoc(doc(db, 'users', id), { referredBy: inviter.id }).catch(() => {});
}
