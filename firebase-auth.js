import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const AUTH_KEY = 'geohub_auth_user';

function writeLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}
function readLS(key) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}

function fbUserToGeoUser(fbUser) {
  var seed = (fbUser.displayName || fbUser.email || 'user').replace(/\W/g, '').toLowerCase() || 'fbuser';
  return {
    id: fbUser.uid,
    uid: fbUser.uid,
    fullName: fbUser.displayName || fbUser.email.split('@')[0],
    username: fbUser.email.split('@')[0].replace(/[^a-z0-9_.]/gi, '.').toLowerCase(),
    email: fbUser.email,
    avatar: fbUser.photoURL || ('https://picsum.photos/seed/' + seed + '_fb/200/200'),
    coverImage: 'https://picsum.photos/seed/' + seed + '_fbcv/1200/500',
    bio: '',
    city: 'Tbilisi',
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
    createdAt: Date.now()
  };
}

/* Write user profile to Firestore users/{uid} */
async function saveUserToFirestore(geoUser) {
  try {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) return;
    await fb.fs.setDoc(fb.fs.doc(fb.db, 'users', geoUser.uid), geoUser, { merge: true });
  } catch (e) {
    console.warn('[GeoHub] Firestore write failed:', e.message);
  }
}

/* Read user profile from Firestore — returns null if not found */
async function loadUserFromFirestore(uid) {
  try {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) return null;
    var snap = await fb.fs.getDoc(fb.fs.doc(fb.db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    return null;
  }
}

/* Merge Firestore profile (authoritative) onto fresh fbUser data */
async function mergeWithFirestore(geoUser) {
  var stored = await loadUserFromFirestore(geoUser.uid);
  if (stored) {
    var keep = ['fullName', 'username', 'bio', 'city', 'accountType', 'interests',
                'coverImage', 'explorerLevel', 'xp', 'rank', 'badges',
                'followers', 'following', 'postsCount', 'visitedPlaces', 'trustScore'];
    keep.forEach(function (k) { if (stored[k] !== undefined) geoUser[k] = stored[k]; });
  }
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
  writeLS(AUTH_KEY, geoUser);
  return geoUser;
}

async function fbSignIn(email, password) {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (!auth) throw new Error('Firebase not available');
  var cred = await signInWithEmailAndPassword(auth, email, password);
  var geoUser = await mergeWithFirestore(fbUserToGeoUser(cred.user));
  // Update last-seen timestamp in Firestore
  geoUser.lastSeen = Date.now();
  await saveUserToFirestore(geoUser);
  writeLS(AUTH_KEY, geoUser);
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
  writeLS(AUTH_KEY, geoUser);
  return geoUser;
}

async function fbLogout() {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (auth) { try { await signOut(auth); } catch (e) {} }
  try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
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
      writeLS(AUTH_KEY, geoUser);
      callback(geoUser);
    } else {
      callback(null);
    }
  });
}

window.GeoFirebaseAuth = {
  signUp: fbSignUp,
  signIn: fbSignIn,
  googleLogin: fbGoogleLogin,
  logout: fbLogout,
  onAuthChange: onAuthChange,
  saveUserToFirestore: saveUserToFirestore,
  resetPassword: fbResetPassword
};
