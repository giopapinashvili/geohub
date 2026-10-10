// GeoPoints rewards. Redeeming goes through the redeemReward Cloud Function:
// it charges the points, issues the coupon and refuses a second charge for
// the same request id. Clients can never mint coupons (rules: admin only).

import { collection, query, where, limit, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, app, EMULATOR } from '../lib/firebase.js';
import { uid as myUid } from '../lib/auth.js';
import { tsToMillis } from '../lib/format.js';

let functions = null;
async function callable(name) {
  const { getFunctions, httpsCallable, connectFunctionsEmulator } = await import('firebase/functions');
  if (!functions) {
    functions = getFunctions(app);
    if (EMULATOR) connectFunctionsEmulator(functions, location.hostname || '127.0.0.1', 5001);
  }
  return httpsCallable(functions, name);
}

/** Rewards created by different admin tools name these fields differently. */
export const rewardCost = (r) => Number(r.pointPrice ?? r.cost ?? r.pointsCost) || 0;
export const rewardStock = (r) => r.quantityRemaining ?? r.stock ?? null;

/** One id per redeem attempt; retrying the same attempt cannot charge twice. */
export function newRequestId() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`; }
}

/** → { code, couponId, rewardTitle, cost, newBalance, businessName } */
export async function redeemReward(rewardId, requestId) {
  const call = await callable('redeemReward');
  const res = await call({ rewardId, requestId });
  return res.data;
}

/** i18n key for a redeem failure. */
export function redeemErrorKey(e) {
  const code = String(e?.code || '').replace('functions/', '');
  const msg = String(e?.message || '');
  if (code === 'unauthenticated') return 'rewards.err.login';
  if (code === 'resource-exhausted') return 'rewards.err.soldOut';
  if (code === 'not-found') return 'rewards.err.gone';
  if (code === 'failed-precondition') {
    if (/balance/i.test(msg)) return 'rewards.err.points';
    if (/price/i.test(msg)) return 'rewards.err.noPrice';
    return 'rewards.err.gone';
  }
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'internal') return 'rewards.err.network';
  return 'rewards.err.generic';
}

export async function myCoupons(n = 50) {
  const u = myUid.value;
  if (!u) return [];
  const s = await getDocs(query(collection(db, 'rewardCoupons'), where('userId', '==', u), limit(n)));
  return s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToMillis(d.data().createdAt) }))
    .sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || b.createdAt - a.createdAt);
}

/** Business owner at the counter: look up a coupon issued for their rewards. */
export async function findCouponForMe(code) {
  const u = myUid.value;
  const c = String(code || '').trim().toUpperCase();
  if (!u || !c) return null;
  const s = await getDocs(query(collection(db, 'rewardCoupons'), where('businessOwnerId', '==', u), where('code', '==', c), limit(1)));
  return s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() };
}

/** active → used; only the business owner may do this (rules). */
export async function markCouponUsed(coupon) {
  await updateDoc(doc(db, 'rewardCoupons', coupon.id), {
    status: 'used', usedAt: serverTimestamp(), usedBy: myUid.value, updatedAt: serverTimestamp(),
  });
}
