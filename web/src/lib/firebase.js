// Firebase bootstrap. The web config is public by design — access is
// governed by firestore.rules, not by keeping these values secret.
//
// `vite --mode emulator` points everything at the local Firebase emulators
// (auth + firestore, loaded with the production firestore.rules) under a
// demo project, so tests never touch real data.

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache } from 'firebase/firestore';
import { prepareAuthPersistence } from './auth-persistence.js';

export const EMULATOR = import.meta.env.MODE === 'emulator';

const config = EMULATOR
  ? { apiKey: 'demo-key', authDomain: 'demo-geohub.firebaseapp.com', projectId: 'demo-geohub', appId: 'demo-app' }
  : {
      apiKey: 'AIzaSyBFjplTgrv7SGLagXzppoUXmSp60PMO_HI',
      authDomain: 'geohub-main.firebaseapp.com',
      projectId: 'geohub-main',
      storageBucket: 'geohub-main.appspot.com',
      messagingSenderId: '18115935679',
      appId: '1:18115935679:web:b17b3f3814256cd97e750a',
      measurementId: 'G-NCBVQ4J9VF',
    };

export const app = initializeApp(config);
// Vite may evaluate both a timestamped HMR module and its canonical URL in
// emulator tools. Keep one SDK bootstrap per hot-module context, just as a
// production page has one module instance. Do not mask initialization errors.
const previousBootstrap = import.meta.hot?.data.firebaseBootstrap;
export const auth = previousBootstrap?.auth || getAuth(app);
// The on-device cache lets live queries resume after a reload by fetching only
// what changed, which keeps Firestore's billed reads down.
function localCache() {
  try {
    // Multi-tab Firestore persistence needs both browser stores. Some privacy
    // modes throw when accessing them; construction alone does not detect that.
    if (!globalThis.indexedDB) return memoryLocalCache();
    localStorage.getItem('gh_firestore_storage_check');
    return persistentLocalCache({ tabManager: persistentMultipleTabManager() });
  } catch { return memoryLocalCache(); }
}
export const db = previousBootstrap?.db || initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: localCache() });

if (EMULATOR && !previousBootstrap) {
  const host = location.hostname || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8085);
}

// Connect emulators before starting any async auth work. All sign-in flows
// await this promise; Firebase itself owns token storage and renewal.
export const authPersistenceReady = previousBootstrap?.authPersistenceReady || prepareAuthPersistence(auth);
if (import.meta.hot) import.meta.hot.data.firebaseBootstrap = { auth, db, authPersistenceReady };

export const PROJECT_ID = config.projectId;
export const VAPID_KEY = 'BEOHtXTao7lj08Lkq6WMRzelk7GrGBCeYSO304UKw6bCd-NB1Y_kLe2U1MR2ArckX9IHI94wAULDZREoGBnudkQ';
export const WORKER_URL = 'https://geohub-payments.gio-papinashvili20-bd3.workers.dev';
export const CLOUDINARY = { cloudName: 'dw5dqk2w7', uploadPreset: 'geohub_unsigned', rootFolder: 'geohub' };
