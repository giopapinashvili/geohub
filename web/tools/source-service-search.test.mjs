import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSourceServices } from '../src/data/sourceCatalogs.js';
import { sourceCatalogPriceLabel } from '../src/lib/sourceCatalogPresentation.js';

test('service search applies place facets before its result limit and retains the quoted price unit', async () => {
  const originalFetch = global.fetch;
  const places = [
    { id: 'osm_node_99001', name: 'First branch', category: 'car-repair', lat: 41.7, lng: 44.8, facets: { parking: false } },
    { id: 'osm_node_99002', name: 'Parking branch', category: 'car-repair', lat: 41.71, lng: 44.81, facets: { parking: true } },
  ];
  const data = {
    '/catalog-data/services-index.json': { version: 1, files: [{ file: 'services-review-abcdef123456.json' }] },
    '/catalog-data/services-review-abcdef123456.json': {
      version: 1,
      items: [{
        id: 'review_tire_repair', title: 'საბურავის შეკეთება', placeIds: places.map(place => place.id),
        providerName: 'Reviewed provider', sourceUrl: 'https://example.com/services',
        sourceUrlsByPlace: { osm_node_99002: 'https://example.com/branches/2' },
        priceMinor: 1000, currency: 'GEL', priceKind: 'fixed', priceUnit: 'ბორბალი',
        freshnessUntilMs: Date.now() + 86400000,
      }],
    },
    '/place-data/manifest.json': {
      version: 1, source: { sourceDate: '2026-10-19' }, lookup: { file: 'lookup-abcdef123456.json' },
      shards: [{ key: 'review', file: 'places-1_1-abcdef123456.json' }],
    },
    '/place-data/lookup-abcdef123456.json': Object.fromEntries(places.map(place => [place.id, 'review'])),
    '/place-data/places-1_1-abcdef123456.json': places,
  };
  global.fetch = async url => {
    assert.ok(Object.hasOwn(data, url), `Unexpected request: ${url}`);
    return new Response(JSON.stringify(data[url]), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const results = await searchSourceServices('საბურავის შეკეთება', 1, { filters: { parking: true } });
    assert.deepEqual(results.map(place => place.id), ['osm_node_99002']);
    assert.equal(results[0].facets.parking, true);
    assert.equal(results[0].sourceUrl, 'https://example.com/branches/2');
    assert.equal(results[0].priceUnit, 'ბორბალი');
    assert.equal(sourceCatalogPriceLabel(results[0]), '10 ₾ / ბორბალი');
    assert.equal(results.coverage.unavailable, false);
  } finally {
    global.fetch = originalFetch;
  }
});
