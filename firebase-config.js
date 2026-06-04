// Firebase npm package imports (bundled by Vite — replaces CDN gstatic.com URLs)
import { initializeApp } from 'firebase/app';
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  doc, setDoc, getDoc, getDocs, updateDoc, addDoc,
  collection, query, orderBy, where, limit,
  onSnapshot, deleteDoc, serverTimestamp, increment,
  writeBatch, runTransaction, arrayUnion, arrayRemove,
  Timestamp, startAt, endAt, startAfter, endBefore,
  limitToLast, getCountFromServer, collectionGroup
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getMessaging, isSupported as isMsgSupported } from 'firebase/messaging';

// Keys come from .env (local) or Cloudflare Pages environment variables (production).
// Vite replaces import.meta.env.VITE_* at build time — never exposed to Node.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

try {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
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
  console.warn('[GeoHub] Firebase init failed — online features disabled.', err.message);
  window.GeoFirebase = null;
  window.dispatchEvent(new Event('GeoFirebaseReady'));
}
