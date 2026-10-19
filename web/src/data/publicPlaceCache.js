// Browser HTTP caching persists public, content-addressed data across visits.
// This small LRU only avoids repeatedly parsing nearby shards in the same tab.
// It never stores accounts, Firestore responses, credentials or entire map archives.
const ASSET = /^(manifest|(?:overview|lookup|search-index|places--?\d+_-?\d+)-[a-f0-9]{12})\.json$/;
const MANIFEST_TTL = 5 * 60 * 1000;

export function createPublicPlaceCache({ fetcher = (...args) => fetch(...args), now = Date.now,
  maxBytes = 24 * 1024 * 1024, maxEntries = 40 } = {}) {
  const completed = new Map();
  const pending = new Map();
  let bytes = 0;
  function discard(file) {
    const entry = completed.get(file);
    if (entry) { bytes -= entry.bytes; completed.delete(file); }
  }
  function read(asset, { retain = true } = {}) {
    const { file, bytes: expectedBytes } = typeof asset === 'string' ? { file: asset } : asset || {};
    // The allowlist cannot be used to fetch arbitrary/private URLs, even if a
    // malformed manifest supplies one. No cookies are needed for these assets.
    if (!ASSET.test(file || '')) return Promise.reject(new Error('Invalid public place data filename'));
    const previous = completed.get(file);
    if (previous && previous.expires > now()) {
      completed.delete(file); completed.set(file, previous);
      return Promise.resolve(previous.value);
    }
    if (pending.has(file)) return pending.get(file);
    discard(file);
    const manifest = file === 'manifest.json';
    const promise = (async () => {
      const response = await fetcher(`/place-data/${file}`, {
        cache: manifest ? 'no-cache' : 'force-cache', credentials: 'omit',
      });
      if (!response.ok) throw new Error(`Place data unavailable (${response.status})`);
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Invalid place data response');
      const value = await response.json();
      // The budget fits the metadata/lookup and nearby enriched shards together.
      // Imported assets carry verified byte counts; the decoded search index
      // opts out so a second copy cannot displace the active viewport.
      const size = Number.isSafeInteger(expectedBytes) && expectedBytes > 0
        ? expectedBytes : JSON.stringify(value).length * 3;
      if (retain && size <= maxBytes) {
        completed.set(file, { value, bytes: size, expires: manifest ? now() + MANIFEST_TTL : Infinity });
        bytes += size;
        while (completed.size > maxEntries || bytes > maxBytes) discard(completed.keys().next().value);
      }
      return value;
    })();
    pending.set(file, promise);
    // Both outcomes clear the pending slot, so failed loads can be retried.
    promise.then(() => pending.delete(file), () => pending.delete(file));
    return promise;
  }
  return { read, discard, stats: () => ({ entries: completed.size, bytes, pending: pending.size }) };
}
