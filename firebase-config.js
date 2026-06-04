// Firebase CDN imports — work in browsers directly AND when bundled by Vite.
// API keys are intentionally public (security via Firestore rules, not key secrecy).
import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged }
                                from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore,
  doc, setDoc, getDoc, getDocs, updateDoc, addDoc,
  collection, query, orderBy, where, limit,
  onSnapshot, deleteDoc, serverTimestamp, increment,
  writeBatch, runTransaction, arrayUnion, arrayRemove,
  Timestamp, startAt, endAt, startAfter, endBefore,
  limitToLast, getCountFromServer, collectionGroup,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getFunctions, httpsCallable }
                                from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';
import { getAnalytics, isSupported }
                                from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js';
import { getMessaging, isSupported as isMsgSupported }
                                from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js';

const firebaseConfig = {
  apiKey:            'AIzaSyBFjplTgrv7SGLagXzppoUXmSp60PMO_HI',
  authDomain:        'geohub-main.firebaseapp.com',
  projectId:         'geohub-main',
  storageBucket:     'geohub-main.appspot.com',
  messagingSenderId: '18115935679',
  appId:             '1:18115935679:web:b17b3f3814256cd97e750a',
  measurementId:     'G-NCBVQ4J9VF',
};

try {
  const app      = initializeApp(firebaseConfig);
  const auth     = getAuth(app);
  const db       = getFirestore(app);
  const functions = getFunctions(app);
  window.GeoFirebase = {
    app, auth, db,
    fs: {
      doc, setDoc, getDoc, getDocs, updateDoc, addDoc,
      collection, query, orderBy, where, limit,
      onSnapshot, deleteDoc, serverTimestamp, increment,
      writeBatch, runTransaction, arrayUnion, arrayRemove,
      Timestamp, startAt, endAt, startAfter, endBefore,
      limitToLast, getCountFromServer, collectionGroup,
    },
    authFns: { signOut, onAuthStateChanged },
    functions,
    httpsCallable,
  };
  isSupported().then(ok => { if (ok) getAnalytics(app); }).catch(() => {});
  isMsgSupported()
    .then(ok => { if (ok) window.GeoFirebase.messaging = getMessaging(app); })
    .catch(() => {})
    .finally(() => { window.dispatchEvent(new Event('GeoFirebaseReady')); });
} catch (err) {
  console.warn('[GeoHub] Firebase init failed:', err.message);
  window.GeoFirebase = null;
  window.dispatchEvent(new Event('GeoFirebaseReady'));
}
