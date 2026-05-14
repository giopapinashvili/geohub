import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

function fbUserToGeoUser(fbUser) {
  var seed = (fbUser.displayName || fbUser.email || 'user').replace(/\W/g, '').toLowerCase() || 'fbuser';
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
    xp: 0,
    rank: 9999,
    badges: [],
    interests: [],
    followers: 0,
    following: 0,
    postsCount: 0,
    visitedPlaces: 0,
    trustScore: 0,
    accountType: 'Explorer',
    isFirebaseUser: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

async function saveUserToFirestore(geoUser) {
  var fb = window.GeoFirebase;
  if (!fb || !fb.db || !fb.fs || !geoUser || !geoUser.uid) return;
  await fb.fs.setDoc(fb.fs.doc(fb.db, 'users', geoUser.uid), Object.assign({}, geoUser, { updatedAt: Date.now() }), { merge: true });
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
  return geoUser;
}

async function fbSignUp(email, password, fullName) {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (!auth) throw new Error('Firebase not available');
  var cred = await createUserWithEmailAndPassword(auth, email, password);
  if (fullName) await updateProfile(cred.user, { displayName: fullName });
  var geoUser = fbUserToGeoUser(cred.user);
  if (fullName) geoUser.fullName = fullName;
  await saveUserToFirestore(geoUser);
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
  var cred = await signInWithPopup(auth, provider);
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

window.GeoFirebaseAuth = { signUp: fbSignUp, signIn: fbSignIn, googleLogin: fbGoogleLogin, logout: fbLogout, onAuthChange: onAuthChange, saveUserToFirestore: saveUserToFirestore, loadUserFromFirestore: loadUserFromFirestore, resetPassword: fbResetPassword, resendVerification: fbResendVerification };
