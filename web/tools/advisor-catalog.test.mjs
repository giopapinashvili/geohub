import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { importedAdvisorRecords, loadAdvisorCity, commerceAdvisorRecords, loadExpandedAdvisorCatalog } from './advisor-catalog.mjs';
import { selectCandidates, makeAdvisorPrompt } from './advisor-data.mjs';

const cityIndex = { v: 2, strings: ['ფაბრიკა', 'Fabrika', 'ნინოშვილი8', 'cafe'], rows: [
  ['w123', 0, [1], 2, 3, 41.7, 44.8, 0, 0, 1],
  ['an456', 2, [], 2, 3, 41.7, 44.8, 1, 0, 0],
  ['w789', 0, [], 2, 3, null, null, 0, 0, 0],
] };
const merchant = { key: 'business:merchant', id: 'merchant', kind: 'business', name: 'Merchant', lat: 41.7, lng: 44.8, address: 'HQ', mapPath: '/map?place=hq', city: 'თბილისი' };
const item = { id: 'dish1', businessId: 'merchant', type: 'dish', title: 'ხინკალი', description: '', priceMinor: 250, currency: 'GEL', status: 'published', isDemo: false, available: true, allBranches: false, branchIds: ['branch1'], preparationMinutes: 20, dietaryTags: ['vegan'] };
const now = Date.now();
const offer = { id: 'offer1', businessId: 'merchant', itemId: 'dish1', type: 'dish', title: 'ხინკლის შეთავაზება', priceMinor: 200, originalPriceMinor: 250, currency: 'GEL', status: 'published', isDemo: false, allBranches: false, branchIds: ['branch1'], startsAtMs: now - 60000, endsAtMs: now + 60000 };

test('city records preserve exact identity, aliases, source date and coordinate uncertainty without address pseudo-places', () => {
  const rows = importedAdvisorRecords(cityIndex, '2026-10-17');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'osm_way_123');
  assert.equal(rows[0].coordinateAccuracy, 'approximate-center');
  assert.equal(rows[0].sourceDate, '2026-10-17');
  assert.equal(rows[0].categoryLabel, 'კაფე');
  assert.deepEqual(rows[0].aliases, ['Fabrika']);
  assert.equal('priceMinor' in rows[0], false);
  assert.equal('hours' in rows[0], false);
});

test('city manifest cannot request paths or network assets outside published content', async () => {
  for (const file of ['../secret.json', '/secret.json', 'https://evil.example/secret', 'search-index.json']) {
    const calls = [];
    await assert.rejects(loadAdvisorCity({ readJson: async path => { calls.push(path); return { version: 1, search: { file } }; } }), /Invalid city manifest/);
    assert.deepEqual(calls, ['manifest.json']);
  }
});

test('commerce uses real merchant facts and canonical item links without assigning branch headquarters coordinates', () => {
  const rows = commerceAdvisorRecords([item], [offer], [merchant], now);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].priceMinor, 250);
  assert.equal(rows[0].preparationMinutes, 20);
  assert.deepEqual(rows[0].dietaryTags, ['vegan']);
  assert.equal(rows[1].priceMinor, 200);
  assert.equal(rows[1].branchScope, 'specific');
  assert.equal(rows[1].branchCount, 1);
  assert.equal(rows[1].path, '/business/merchant?tab=menu&item=dish1&branch=branch1');
  for (const row of rows) { assert.equal('lat' in row, false); assert.equal('mapPath' in row, false); assert.equal(row.address, ''); assert.equal(row.city, ''); }
});

test('commerce rejects demos, missing merchants, expired or scheduled discounts and changed prices', () => {
  assert.deepEqual(commerceAdvisorRecords([{ ...item, isDemo: true, demoBatchId: 'demo' }], [offer], [merchant], now), []);
  assert.deepEqual(commerceAdvisorRecords([item], [offer], [], now), []);
  for (const patch of [{ endsAtMs: now }, { startsAtMs: now + 1 }, { businessId: 'other' }, { originalPriceMinor: 1000 }, { allBranches: true, branchIds: [] }]) {
    assert.equal(commerceAdvisorRecords([item], [{ ...offer, ...patch }], [merchant], now).length, 1);
  }
  const unknown = commerceAdvisorRecords([{ ...item, priceMinor: null }], [], [merchant], now)[0];
  assert.equal(unknown.priceMinor, null);
  assert.equal(commerceAdvisorRecords([{ ...item, currency: 'USD' }], [offer], [merchant], now).length, 1);
  assert.equal(commerceAdvisorRecords([item], [{ ...offer, type: 'product' }], [merchant], now).length, 1);
});

test('expanded source survives public API failure with honest coverage and anonymous constrained requests', async () => {
  const calls = [];
  const result = await loadExpandedAdvisorCatalog({
    loadBase: async () => { throw new Error('unavailable'); },
    loadCity: async () => ({ records: importedAdvisorRecords(cityIndex, '2026-10-17'), sourceDate: '2026-10-17' }),
    fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: false }; }, now,
  });
  assert.equal(result.records.length, 1);
  assert.deepEqual(result.coverage.unavailable, ['publicPages', 'catalogItems', 'offers']);
  assert.equal(result.coverage.partial, true);
  assert.equal(calls.length, 2);
  for (const { url, options } of calls) {
    assert.ok(url.endsWith('/documents:runQuery'));
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers.Authorization, undefined);
    const request = JSON.parse(options.body).structuredQuery;
    assert.equal(request.limit, 201);
    assert.ok(request.where.compositeFilter.filters.some(filter => filter.fieldFilter.field.fieldPath === 'isDemo' && filter.fieldFilter.value.booleanValue === false));
    assert.ok(request.select.fields.every(field => !['ownerId', 'userId', 'email', 'token'].includes(field.fieldPath)));
  }
});

test('new source retrieval supports typos and sends explicit price/branch facts only to a bounded prompt', () => {
  const city = importedAdvisorRecords(cityIndex, '2026-10-17');
  assert.equal(selectCandidates(city, 'fabirka')[0].id, 'osm_way_123');
  const rows = commerceAdvisorRecords([item], [offer], [merchant], now);
  assert.ok(selectCandidates(rows, 'ხინკალი').length > 0);
  assert.equal(selectCandidates([{ ...rows[1], endsAtMs: now - 1 }], 'ხინკალი').length, 0);
  const prompt = makeAdvisorPrompt('ხინკალი მინდა', [], rows, { loaded: 44000, citySourceDate: '2026-10-17' });
  assert.match(prompt, /"loaded":44000/);
  assert.match(prompt, /"priceMinor":250/);
  assert.match(prompt, /branchScope=specific never means every branch/);
  assert.match(prompt, /approximate-center coordinates are not a verified entrance/);
});

test('published city snapshot loads entirely inside the private server without making network requests', async () => {
  const result = await loadAdvisorCity();
  const manifest=JSON.parse(await readFile(new URL('../public/place-data/manifest.json',import.meta.url),'utf8'));
  assert.equal(result.records.length, manifest.osmPlaceCount);
  assert.ok(result.records.every(record => record.key.startsWith('place:osm_') && record.source === 'OpenStreetMap'));
});
