// Short-lived memory cache for list reads that several pages share. Firestore
// bills every document a query returns, so a list is fetched once and reused
// while it is fresh instead of being read again on every page visit.

const store = new Map();

/**
 * Runs load(size) at most once per ttl for `key` and hands every caller the
 * first `want` entries. Callers get their own copy, so sorting it is safe.
 */
export function cachedList(key, size, ttlMs, load, want = size) {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || now - entry.at >= ttlMs) {
    entry = { at: now, promise: load(size) };
    store.set(key, entry);
    const mine = entry;
    entry.promise.catch(() => { if (store.get(key) === mine) store.delete(key); });
  }
  return entry.promise.then((list) => list.slice(0, want));
}

/** Forgets cached lists whose key starts with prefix (after a write). */
export function dropCached(prefix) {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}
