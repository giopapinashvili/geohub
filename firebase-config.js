import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore,
  doc, setDoc, getDoc, getDocs, updateDoc, addDoc,
  collection, query, orderBy, where, limit,
  onSnapshot, deleteDoc, serverTimestamp, increment,
  writeBatch, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js';

const firebaseConfig = {
  apiKey: "AIzaSyBFjplTgrv7SGLagXzppoUXmSp60PMO_HI",
  authDomain: "geohub-main.firebaseapp.com",
  projectId: "geohub-main",
  storageBucket: "geohub-main.firebasestorage.app",
  messagingSenderId: "18115935679",
  appId: "1:18115935679:web:b17b3f3814256cd97e750a",
  measurementId: "G-NCBVQ4J9VF"
};

try {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  window.GeoFirebase = {
    app, auth, db,
    fs: { doc, setDoc, getDoc, getDocs, updateDoc, addDoc, collection, query, orderBy, where, limit, onSnapshot, deleteDoc, serverTimestamp, increment, writeBatch, runTransaction }
  };
  isSupported().then(ok => { if (ok) getAnalytics(app); }).catch(() => {});
  window.dispatchEvent(new Event('GeoFirebaseReady'));
} catch (err) {
  console.warn('[GeoHub] Firebase init failed — online features disabled.', err.message);
  window.GeoFirebase = null;
  window.dispatchEvent(new Event('GeoFirebaseReady'));
}
