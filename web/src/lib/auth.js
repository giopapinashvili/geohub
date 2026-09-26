// Authentication and the signed-in user's profile.
// Mirrors the old firebase-auth.js contract (users/{uid}, usernames/{name},
// geoIds/{id}) so existing accounts keep working unchanged.

import { signal, computed } from '@preact/signals';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut as fbSignOut, updateProfile, sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, EMULATOR } from './firebase.js';
import { normUser } from '../data/normalize.js';

/** Firebase user object, `null` when signed out, `undefined` until known. */
export const authUser = signal(undefined);
/** Normalised users/{uid} document of the signed-in user. */
export const profile = signal(null);
export const isAdmin = signal(false);
export const authReady = computed(() => authUser.value !== undefined);
export const signedIn = computed(() => !!authUser.value);
export const uid = computed(() => authUser.value?.uid || null);

/** Identity stamped onto the user's own posts, comments and messages. */
export function me() {
  const u = authUser.value;
  if (!u) return null;
  const p = profile.value;
  return {
    uid: u.uid,
    name: p?.name || u.displayName || (u.email ? u.email.split('@')[0] : 'GeoHub'),
    avatar: p?.avatar || u.photoURL || '',
    username: p?.username || '',
    verified: !!p?.verified,
  };
}

/* ── Profile bootstrap ───────────────────────────────────────── */

function baseUsername(u) {
  return (u.email || u.uid).split('@')[0].replace(/[^a-z0-9_.]/gi, '.').toLowerCase().slice(0, 24);
}

// Fields a brand-new users/{uid} may carry. Rules forbid economy and role
// fields on create (userCreateFieldsSafe), so none of those appear here.
function newUserDoc(u, extra = {}) {
  const now = Date.now();
  return {
    id: u.uid,
    uid: u.uid,
    fullName: extra.fullName || u.displayName || (u.email ? u.email.split('@')[0] : 'GeoHub'),
    displayName: extra.fullName || u.displayName || '',
    username: extra.username || baseUsername(u),
    email: u.email || '',
    avatar: u.photoURL || '',
    coverImage: '',
    bio: '',
    city: extra.city || 'all_georgia',
    interests: extra.interests || [],
    accountType: extra.accountType || 'Explorer',
    explorerLevel: 'New Explorer',
    badges: [],
    followers: 0,
    following: 0,
    postsCount: 0,
    visitedPlaces: 0,
    isFirebaseUser: true,
    createdAt: now,
    updatedAt: now,
  };
}

async function claimGeoId(userId) {
  for (let i = 0; i < 12; i++) {
    const id = String(Math.floor(10000 + Math.random() * 90000));
    const ref = doc(db, 'geoIds', id);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) continue;
      await setDoc(ref, { uid: userId, assignedAt: Date.now() });
      return Number(id);
    } catch { /* taken in a race — try another */ }
  }
  return null;
}

export async function isUsernameAvailable(name) {
  if (!name) return false;
  try { return !(await getDoc(doc(db, 'usernames', name.toLowerCase()))).exists(); }
  catch { return false; }
}

async function reserveUsername(name, userId) {
  if (!name) return;
  try { await setDoc(doc(db, 'usernames', name.toLowerCase()), { uid: userId, createdAt: Date.now() }); }
  catch (e) { console.warn('[auth] username reservation failed', e.code); }
}

/** Make sure users/{uid} exists (first social sign-in) and has a GeoHub ID. */
async function ensureProfile(u) {
  const ref = doc(db, 'users', u.uid);
  let snap;
  try { snap = await getDoc(ref); } catch (e) { console.warn('[auth] profile read failed', e.code); return; }
  if (!snap.exists()) {
    const data = newUserDoc(u);
    const geoId = await claimGeoId(u.uid);
    if (geoId) data.geoId = geoId;
    try {
      await setDoc(ref, data, { merge: true });
      await reserveUsername(data.username, u.uid);
    } catch (e) { console.warn('[auth] profile create failed', e.code); }
    return;
  }
  const patch = { lastSeen: serverTimestamp(), online: true };
  if (!snap.data().geoId) {
    const geoId = await claimGeoId(u.uid);
    if (geoId) patch.geoId = geoId;
  }
  updateDoc(ref, patch).catch(() => {});
}

let profileUnsub = null;
// While sign-up or a verification resend runs, Firebase briefly signs in an
// unverified user; the guard below must not race those flows.
let flowInProgress = false;
onAuthStateChanged(auth, async (u) => {
  if (profileUnsub) { profileUnsub(); profileUnsub = null; }
  if (!u) {
    authUser.value = null;
    profile.value = null;
    isAdmin.value = false;
    return;
  }
  // Email/password accounts must be verified, as on the old site.
  const isPassword = u.providerData.some((p) => p.providerId === 'password') && u.providerData.length === 1;
  if (isPassword && !u.emailVerified) {
    if (!flowInProgress) await fbSignOut(auth).catch(() => {});
    return;
  }
  authUser.value = u;
  profileUnsub = onSnapshot(doc(db, 'users', u.uid),
    (snap) => { profile.value = snap.exists() ? normUser(snap.id, snap.data()) : normUser(u.uid, newUserDoc(u)); },
    () => { profile.value = normUser(u.uid, newUserDoc(u)); });
  ensureProfile(u);
  getDoc(doc(db, 'admins', u.uid)).then((s) => { isAdmin.value = s.exists(); }).catch(() => { isAdmin.value = false; });
});

getRedirectResult(auth).catch((e) => console.warn('[auth] redirect result', e.code));

/* ── Actions ─────────────────────────────────────────────────── */

export class AuthError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  if (!cred.user.emailVerified) {
    await fbSignOut(auth);
    throw new AuthError('auth/email-not-verified');
  }
  return cred.user;
}

export async function signUp({ email, password, fullName, username, city, accountType, interests }) {
  const uname = (username || '').trim().toLowerCase();
  if (uname && !(await isUsernameAvailable(uname))) throw new AuthError('username-taken');
  flowInProgress = true;
  try {
    return await createAccount({ email, password, fullName, uname, city, accountType, interests });
  } finally {
    flowInProgress = false;
  }
}

async function createAccount({ email, password, fullName, uname, city, accountType, interests }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const u = cred.user;
  if (fullName) await updateProfile(u, { displayName: fullName });
  const data = newUserDoc(u, { fullName, username: uname || undefined, city, accountType, interests });
  if (city) data.cityScope = city;
  const geoId = await claimGeoId(u.uid);
  if (geoId) data.geoId = geoId;
  await setDoc(doc(db, 'users', u.uid), data, { merge: true });
  await reserveUsername(data.username, u.uid);
  try { await sendEmailVerification(u); } catch (e) { console.warn('[auth] verification mail', e.code); }
  await fbSignOut(auth);
  return { email: u.email };
}

async function socialLogin(provider) {
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw e;
  }
}

export function signInWithGoogle() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return socialLogin(p);
}

export function signInWithFacebook() {
  const p = new FacebookAuthProvider();
  p.addScope('email');
  p.addScope('public_profile');
  return socialLogin(p);
}

export async function resendVerification(email, password) {
  flowInProgress = true;
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    if (cred.user.emailVerified) return { alreadyVerified: true };
    await sendEmailVerification(cred.user);
    await fbSignOut(auth);
    return { sent: true };
  } finally {
    flowInProgress = false;
  }
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email.trim());
}

export async function signOut() {
  const u = authUser.value;
  if (u) await updateDoc(doc(db, 'users', u.uid), { online: false, lastSeen: serverTimestamp() }).catch(() => {});
  await fbSignOut(auth);
}

/** i18n key for a Firebase/Auth error code. */
export function authErrorKey(e) {
  const code = e?.code || '';
  const map = {
    'auth/invalid-credential': 'auth.err.credentials',
    'auth/wrong-password': 'auth.err.credentials',
    'auth/user-not-found': 'auth.err.credentials',
    'auth/invalid-login-credentials': 'auth.err.credentials',
    'auth/email-already-in-use': 'auth.err.emailInUse',
    'auth/weak-password': 'auth.err.weakPassword',
    'auth/invalid-email': 'auth.err.invalidEmail',
    'auth/too-many-requests': 'auth.err.tooMany',
    'auth/network-request-failed': 'auth.err.network',
    'auth/popup-closed-by-user': 'auth.err.cancelled',
    'auth/cancelled-popup-request': 'auth.err.cancelled',
    'auth/account-exists-with-different-credential': 'auth.err.otherProvider',
    'auth/email-not-verified': 'auth.err.notVerified',
    'username-taken': 'auth.err.usernameTaken',
  };
  return map[code] || 'auth.err.generic';
}

// Test hook for the local emulator build only (never in production).
if (EMULATOR) window.__gh = { signIn, signOut, authUser, profile };
