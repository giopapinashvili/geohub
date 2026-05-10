import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
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
  window.GeoFirebase = { app, auth, db };
  isSupported().then(ok => { if (ok) getAnalytics(app); }).catch(() => {});
} catch (err) {
  console.warn('[GeoHub] Firebase init failed — running in mock-only mode.', err.message);
  window.GeoFirebase = null;
}
