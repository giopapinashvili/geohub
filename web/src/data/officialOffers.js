let pending;
let fetchedAt = 0;
export function listOfficialOffers() {
  if (fetchedAt && Date.now() - fetchedAt > 5 * 60000) pending = null;
  if (!pending) pending = (async () => {
    for (const url of ['/api/public-offers', '/commerce-data/official-offers.json']) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) continue;
        const data = await response.json();
        if (data.version === 1 && Array.isArray(data.offers)) { fetchedAt = Date.now(); return data.offers; }
      } catch { /* Use the dated public snapshot when the source is unavailable. */ }
    }
    throw new Error('Official offers unavailable');
  })().catch(error => { pending = null; throw error; });
  return pending;
}
