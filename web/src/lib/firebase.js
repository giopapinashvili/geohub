// Firebase bootstrap. The web config is public by design — access is
// governed by firestore.rules, not by keeping these values secret.
//
// `vite --mode emulator` points everything at the local Firebase emulators
// (auth + firestore, loaded with the production firestore.rules) under a
// demo project, so tests never touch real data.

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';

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
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

if (EMULATOR) {
  const host = location.hostname || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8085);
}

export const PROJECT_ID = config.projectId;
export const VAPID_KEY = 'BEOHtXTao7lj08Lkq6WMRzelk7GrGBCeYSO304UKw6bCd-NB1Y_kLe2U1MR2ArckX9IHI94wAULDZREoGBnudkQ';
export const WORKER_URL = 'https://geohub-payments.gio-papinashvili20-bd3.workers.dev';
export const CLOUDINARY = { cloudName: 'dw5dqk2w7', uploadPreset: 'geohub_unsigned', rootFolder: 'geohub' };
