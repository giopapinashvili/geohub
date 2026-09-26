// Web push through Firebase Cloud Messaging. Tokens are stored where the
// old site kept them (users/{uid}/fcmTokens/{token}) so the payments worker
// can keep sending call and message pushes.

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db, VAPID_KEY, EMULATOR } from '../lib/firebase.js';
import { uid } from '../lib/auth.js';

export function pushSupported() {
  return !EMULATOR && typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** 'default' | 'granted' | 'denied' | 'unsupported' */
export function pushState() {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function enablePush() {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return false;
    const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token || !uid.value) return false;
    await setDoc(doc(db, 'users', uid.value, 'fcmTokens', token), {
      token, platform: 'web', userAgent: navigator.userAgent.slice(0, 200), createdAt: serverTimestamp(), lastUsedAt: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn('[push]', e);
    return false;
  }
}
