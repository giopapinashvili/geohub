import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile
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
    xp: 250,
    rank: 9999,
    badges: [],
    interests: [],
    followers: 0,
    following: 0,
    postsCount: 0,
    visitedPlaces: 0,
    trustScore: 70,
    accountType: 'Explorer',
    isFirebaseUser: true,
    createdAt: Date.now()
  };
}

function mergeWithStored(geoUser) {
  var stored = readLS(AUTH_KEY);
  if (stored && stored.uid === geoUser.uid) {
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
  writeLS(AUTH_KEY, geoUser);
  return geoUser;
}

async function fbSignIn(email, password) {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (!auth) throw new Error('Firebase not available');
  var cred = await signInWithEmailAndPassword(auth, email, password);
  var geoUser = mergeWithStored(fbUserToGeoUser(cred.user));
  writeLS(AUTH_KEY, geoUser);
  return geoUser;
}

async function fbGoogleLogin() {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (!auth) throw new Error('Firebase not available');
  var provider = new GoogleAuthProvider();
  var cred = await signInWithPopup(auth, provider);
  var geoUser = mergeWithStored(fbUserToGeoUser(cred.user));
  writeLS(AUTH_KEY, geoUser);
  return geoUser;
}

async function fbLogout() {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (auth) { try { await signOut(auth); } catch (e) {} }
  try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
}

function onAuthChange(callback) {
  var auth = window.GeoFirebase && window.GeoFirebase.auth;
  if (!auth) return;
  onAuthStateChanged(auth, function (fbUser) {
    if (fbUser) {
      var geoUser = mergeWithStored(fbUserToGeoUser(fbUser));
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
  onAuthChange: onAuthChange
};
