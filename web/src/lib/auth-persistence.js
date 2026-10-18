import { indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence, setPersistence } from 'firebase/auth';

// Check browser storage without reading or copying any authentication tokens.
// A real write/read is needed: browsers can expose IndexedDB while denying it.
async function canUseIndexedDB() {
  return new Promise((resolve) => {
    let database;
    let settled = false;
    const name = `geohub-auth-storage-check-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const finish = (available) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      database?.close();
      try { globalThis.indexedDB.deleteDatabase(name); } catch { /* unavailable */ }
      resolve(available);
    };
    const timer = setTimeout(() => finish(false), 2000);
    try {
      const request = globalThis.indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('check');
      request.onerror = () => finish(false);
      request.onblocked = () => finish(false);
      request.onsuccess = () => {
        database = request.result;
        if (settled) { database.close(); globalThis.indexedDB.deleteDatabase(name); return; }
        const transaction = database.transaction('check', 'readwrite');
        const store = transaction.objectStore('check');
        store.put('available', 'check');
        const read = store.get('check');
        transaction.oncomplete = () => finish(read.result === 'available');
        transaction.onerror = transaction.onabort = () => finish(false);
      };
    } catch { finish(false); }
  });
}

function canUseLocalStorage() {
  const key = `geohub-auth-storage-check-${Date.now()}`;
  try {
    localStorage.setItem(key, key);
    const available = localStorage.getItem(key) === key;
    localStorage.removeItem(key);
    return available;
  } catch { return false; }
}

/** Restore legacy Firebase sessions, then explicitly use durable storage. */
export async function prepareAuthPersistence(auth) {
  await auth.authStateReady();
  if (await canUseIndexedDB()) {
    await setPersistence(auth, indexedDBLocalPersistence);
    return 'indexeddb';
  }
  if (canUseLocalStorage()) {
    await setPersistence(auth, browserLocalPersistence);
    return 'local';
  }
  // Still allow sign-in when storage is blocked, but the UI must not promise
  // that this temporary session will survive a refresh or browser close.
  await setPersistence(auth, inMemoryPersistence);
  return 'memory';
}
