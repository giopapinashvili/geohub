// Front-end error log. Uncaught errors from signed-in sessions are written to
// analytics/errors/log (rules: signed-in, own uid), deduplicated and capped,
// so the admin panel shows what breaks in real browsers.

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, EMULATOR } from './firebase.js';
import { uid } from './auth.js';

const MAX_PER_SESSION = 8;
const seen = new Set();
let sent = 0;

// Browser and extension noise that is not ours to fix.
const IGNORE = /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Non-Error promise rejection captured|AbortError|The user aborted a request|Load failed|NetworkError when attempting to fetch|Failed to fetch dynamically imported module/i;

function report(message, stack = '') {
  const msg = String(message || '').slice(0, 500);
  if (!msg || IGNORE.test(msg) || IGNORE.test(stack)) return;
  const u = uid.value;
  if (!u || EMULATOR || sent >= MAX_PER_SESSION) return;
  const key = msg + location.pathname;
  if (seen.has(key)) return;
  seen.add(key);
  sent += 1;
  addDoc(collection(db, 'analytics', 'errors', 'log'), {
    message: msg,
    stack: String(stack || '').slice(0, 1500),
    page: location.pathname.slice(0, 200),
    uid: u,
    ua: navigator.userAgent.slice(0, 200),
    createdAt: serverTimestamp(),
  }).catch(() => {});
}

export function initErrorLog() {
  if (!import.meta.env.PROD) return;
  window.addEventListener('error', (e) => report(e.message, e.error?.stack));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    report(r?.message || String(r), r?.stack);
  });
}
