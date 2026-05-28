import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

function fbUserToGeoUser(fbUser) {
  return {
    id: fbUser.uid,
    uid: fbUser.uid,
    fullName: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'GeoHub User'),
    username: (fbUser.email || fbUser.uid).split('@')[0].replace(/[^a-z0-9_.]/gi, '.').toLowerCase(),
    email: fbUser.email || '',
    avatar: fbUser.photoURL || '',
    coverImage: '',
    bio: '',
    city: 'all_georgia',
    explorerLevel: 'New Explorer',
    badges: [],
    interests: [],
    followers: 0,
    following: 0,
    postsCount: 0,
    visitedPlaces: 0,
    accountType: 'Explorer',
    isFirebaseUser: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

/* ── USERNAME & GEOID HELPERS ──────────────────────────────── */

async function generateUniqueGeoId(uid) {
  var fb = window.GeoFirebase;
  if (!fb || !fb.db || !fb.fs) return Math.floor(10000 + Math.random() * 90000);
  for (var i = 0; i < 12; i++) {
    var id = String(Math.floor(10000 + Math.random() * 90000));
    var ref = fb.fs.doc(fb.db, 'geoIds', id);
    var snap = await fb.fs.getDoc(ref);
    if (!snap.exists()) {
      try {
        await fb.fs.setDoc(ref, { uid: uid, assignedAt: Date.now() });
        return Number(id);
      } catch(e) { /* race — retry */ }
    }
  }
  return Math.floor(10000 + Math.random() * 90000);
}

async function reserveUsername(username, uid) {
  var fb = window.GeoFirebase;
  if (!fb || !fb.db || !fb.fs || !username) return;
  try {
    await fb.fs.setDoc(fb.fs.doc(fb.db, 'usernames', username), { uid: uid, createdAt: Date.now() });
  } catch(e) { console.warn('[GeoAuth] reserveUsername failed:', e && e.message); }
}

async function releaseUsername(username) {
  var fb = window.GeoFirebase;
  if (!fb || !fb.db || !fb.fs || !username) return;
  try {
    await fb.fs.deleteDoc(fb.fs.doc(fb.db, 'usernames', username));
  } catch(e) {}
}

async function isUsernameAvailable(username) {
  var fb = window.GeoFirebase;
  if (!fb || !fb.db || !fb.fs || !username) return false;
  try {
    var snap = await fb.fs.getDoc(fb.fs.doc(fb.db, 'usernames', username));
    return !snap.exists();
  } catch(e) { return false; }
}

window.GeoAuthHelpers = { isUsernameAvailable, reserveUsername, releaseUsername };

async function saveUserToFirestore(geoUser) {
  var fb = window.GeoFirebase;
  if (!fb || !fb.db || !fb.fs || !geoUser || !geoUser.uid) return;
  try {
    await fb.fs.setDoc(fb.fs.doc(fb.db, 'users', geoUser.uid), Object.assign({}, geoUser, { updatedAt: Date.now() }), { merge: true });
  } catch (e) {
    console.warn('[GeoAuth] saveUserToFirestore failed (non-fatal):', e && e.code, e && e.message);
  }
}

async function loadUserFromFirestore(uid) {
  try {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs || !uid) return null;
    var snap = await fb.fs.getDoc(fb.fs.doc(fb.db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) { return null; }
}

async function mergeWithFirestore(geoUser) {
  var stored = await loadUserFromFirestore(geoUser.uid);
  if (stored) Object.assign(geoUser, stored, { uid: geoUser.uid, id: geoUser.uid, email: geoUser.email || stored.email, isFirebaseUser: true });
  // Assign geoId to users who don't have one yet (Google login, old accounts)
  if (!geoUser.geoId) {
    try {
      var geoId = await generateUniqueGeoId(geoUser.uid);
      geoUser.geoId = geoId;
      var fb = window.GeoFirebase;
      if (fb && fb.fs && fb.db) {
        await fb.fs.setDoc(fb.fs.doc(fb.db, 'users', geoUser.uid), { geoId: geoId }, { merge: true });
      }
    } catch(e) {}
  }
  // Reserve username if not reserved yet
  if (geoUser.username && !stored) {
    try { await reserveUsername(geoUser.username, geoUser.uid); } catch(e) {}
  }
  return geoUser;
}

async function fbSignUp(email, password, fullName, extraData) {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (!auth) throw new Error('Firebase not available');

  // Username uniqueness pre-check (best-effort before account creation)
  var username = (extraData && extraData.username) || '';
  if (username) {
    var available = await isUsernameAvailable(username);
    if (!available) {
      var err = new Error('Username @' + username + ' is already taken. Choose a different one.');
      err.code = 'username-taken';
      throw err;
    }
  }

  var cred = await createUserWithEmailAndPassword(auth, email, password);
  if (fullName) await updateProfile(cred.user, { displayName: fullName });
  var geoUser = fbUserToGeoUser(cred.user);
  if (fullName) geoUser.fullName = geoUser.displayName = fullName;

  // Generate unique 5-digit geoId
  var geoId = await generateUniqueGeoId(cred.user.uid);
  geoUser.geoId = geoId;

  // Apply extra signup data
  if (extraData) {
    if (extraData.username) geoUser.username = extraData.username;
    if (extraData.city)     { geoUser.city = extraData.city; geoUser.cityScope = extraData.city; }
    if (extraData.accountType) geoUser.accountType = extraData.accountType;
    if (extraData.interests)   geoUser.interests = extraData.interests;
  }

  await saveUserToFirestore(geoUser);

  // Reserve username in /usernames/{username} collection
  if (geoUser.username) await reserveUsername(geoUser.username, cred.user.uid);

  await sendEmailVerification(cred.user);
  await signOut(auth);
  window.GeoCurrentUser = null;
  return { emailVerificationSent: true, email: email };
}

async function fbSignIn(email, password) {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (!auth) throw new Error('Firebase not available');
  var cred = await signInWithEmailAndPassword(auth, email, password);
  if (!cred.user.emailVerified) {
    await signOut(auth);
    var err = new Error('Please verify your email before logging in. Check your inbox.');
    err.code = 'auth/email-not-verified';
    err.fbUser = cred.user;
    throw err;
  }
  var geoUser = await mergeWithFirestore(fbUserToGeoUser(cred.user));
  geoUser.lastSeen = Date.now();
  await saveUserToFirestore(geoUser);
  window.GeoCurrentUser = geoUser;
  window.dispatchEvent(new CustomEvent('GeoAuthReady', { detail: geoUser }));
  return geoUser;
}

async function fbGoogleLogin() {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (!auth) throw new Error('Firebase not available');
  var provider = new GoogleAuthProvider();
  var cred;
  try {
    cred = await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      throw Object.assign(new Error('Google sign-in was cancelled.'), { code: err.code });
    }
    throw err;
  }
  var geoUser = await mergeWithFirestore(fbUserToGeoUser(cred.user));
  geoUser.lastSeen = Date.now();
  await saveUserToFirestore(geoUser);
  window.GeoCurrentUser = geoUser;
  window.dispatchEvent(new CustomEvent('GeoAuthReady', { detail: geoUser }));
  return geoUser;
}

async function fbFacebookLogin() {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (!auth) throw new Error('Firebase not available');
  var provider = new FacebookAuthProvider();
  provider.addScope('email');
  provider.addScope('public_profile');
  var cred;
  try {
    cred = await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      throw Object.assign(new Error('Facebook sign-in was cancelled.'), { code: err.code });
    }
    throw err;
  }
  var geoUser = await mergeWithFirestore(fbUserToGeoUser(cred.user));
  geoUser.lastSeen = Date.now();
  await saveUserToFirestore(geoUser);
  window.GeoCurrentUser = geoUser;
  window.dispatchEvent(new CustomEvent('GeoAuthReady', { detail: geoUser }));
  return geoUser;
}

async function fbLogout() {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (auth) await signOut(auth).catch(function(){});
  window.GeoCurrentUser = null;
  window.dispatchEvent(new CustomEvent('GeoAuthReady', { detail: null }));
}

async function fbResetPassword(email) {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (!auth) throw new Error('Firebase not available');
  if (!email) throw new Error('Email is required');
  await sendPasswordResetEmail(auth, email);
}

function onAuthChange(callback) {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (!auth) return;
  onAuthStateChanged(auth, async function (fbUser) {
    if (fbUser) {
      var geoUser = await mergeWithFirestore(fbUserToGeoUser(fbUser));
      window.GeoCurrentUser = geoUser;
      callback(geoUser);
      window.dispatchEvent(new CustomEvent('GeoAuthReady', { detail: geoUser }));
    } else {
      window.GeoCurrentUser = null;
      callback(null);
      window.dispatchEvent(new CustomEvent('GeoAuthReady', { detail: null }));
    }
  });
}

async function fbResendVerification(email, password) {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (!auth) throw new Error('Firebase not available');
  var cred = await signInWithEmailAndPassword(auth, email, password);
  if (cred.user.emailVerified) { await signOut(auth); return { alreadyVerified: true }; }
  await sendEmailVerification(cred.user);
  await signOut(auth);
  return { sent: true };
}

window.GeoFirebaseAuth = { signUp: fbSignUp, signIn: fbSignIn, googleLogin: fbGoogleLogin, facebookLogin: fbFacebookLogin, logout: fbLogout, onAuthChange: onAuthChange, saveUserToFirestore: saveUserToFirestore, loadUserFromFirestore: loadUserFromFirestore, resetPassword: fbResetPassword, resendVerification: fbResendVerification, isUsernameAvailable: isUsernameAvailable, reserveUsername: reserveUsername, releaseUsername: releaseUsername };
