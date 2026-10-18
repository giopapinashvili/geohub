import test from 'node:test';
import assert from 'node:assert/strict';
import { searchableCatalogItem, matchesCatalogFilters, catalogLocations, catalogResult, addressHref } from '../src/lib/catalogDiscovery.js';
import { rankRecords } from '../src/lib/discoverySearch.js';

const business = { id: 'business_1', name: 'რესტორანი', category: 'restaurant', address: 'მთავარი ქუჩა 1', raw: { lat: 41.7, lng: 44.8 } };
const dish = { id: 'dish_1', title: 'ხაჭაპური', type: 'dish', status: 'published', isDemo: false, available: true, businessId: business.id, allBranches: true, priceMinor: 1200, currency: 'GEL' };
const branch = { id: 'branch_1', title: 'ვაკის ფილიალი', businessId: business.id, status: 'published', isDemo: false, placeId: 'place_1', lat: null, lng: null, address: 'ჭავჭავაძის გამზირი 12' };

test('search excludes demonstrations, drafts, unavailable and unknown-marked records', () => {
  assert.equal(searchableCatalogItem(dish), true);
  for (const update of [{ isDemo: true }, { isDemo: undefined }, { available: false }, { status: 'draft' }, { status: 'archived' }]) assert.equal(searchableCatalogItem({ ...dish, ...update }), false);
});

test('branch restrictions cannot widen to headquarters or another business', () => {
  const restricted = { ...dish, allBranches: false, branchIds: [branch.id] };
  assert.deepEqual(catalogLocations(restricted, []), []);
  assert.deepEqual(catalogLocations(restricted, [{ ...branch, businessId: 'someone_else' }]), []);
  assert.deepEqual(catalogLocations(restricted, [{ ...branch, isDemo: true }]), []);
  assert.deepEqual(catalogLocations(restricted, [branch]), [branch]);
  assert.deepEqual(catalogLocations(dish, []), [null]);
  assert.equal(catalogResult(restricted, business, null), null);
});

test('location uses only the actual branch or explicit linked place and preserves zero', () => {
  const unlocated = catalogResult(dish, business, branch);
  assert.equal(unlocated.lat, null); assert.equal(unlocated.lng, null);
  const unrelated = catalogResult(dish, business, branch, { id: 'different_place', lat: 41.71, lng: 44.81 });
  assert.equal(unrelated.lat, null);
  const linked = catalogResult(dish, business, branch, { id: branch.placeId, name: 'ადგილი', lat: 41.71, lng: 44.81 });
  assert.equal(linked.id, branch.placeId); assert.equal(linked.lat, 41.71);
  const explicit = catalogResult(dish, business, { ...branch, lat: 0, lng: 0 }, { id: branch.placeId, lat: 41.7, lng: 44.8 });
  assert.equal(explicit.lat, 0); assert.equal(explicit.lng, 0);
});

test('canonical catalog links select item and branch while unknown price remains unknown', () => {
  const row = catalogResult({ ...dish, priceMinor: null, preparationMinutes: 15, dietaryTags: ['vegetarian'] }, business, branch);
  const url = new URL(row.pageHref, 'https://example.test');
  assert.equal(url.pathname, '/business/business_1');
  assert.equal(url.searchParams.get('tab'), 'menu'); assert.equal(url.searchParams.get('item'), dish.id);
  assert.equal(url.searchParams.get('branch'), branch.id); assert.equal(row.priceMinor, null);
  assert.deepEqual(row.facets.diets, ['vegetarian']);
  assert.equal(catalogResult(dish, { ...business, status: 'suspended' }, branch), null);
});

test('dish transliteration and typos match but product numbers and address numbers stay exact', () => {
  assert.equal(rankRecords([dish], 'khachapuri')[0].id, dish.id);
  assert.equal(rankRecords([dish], 'khachapru i'.replace(' ', ''))[0].searchMatch, 'fuzzy');
  const product = { id: 'ps5', title: 'PlayStation 5', model: 'PS5' };
  assert.equal(rankRecords([product], 'PS5')[0].id, 'ps5');
  assert.equal(rankRecords([product], 'PS4').length, 0);
  const href = new URL(addressHref({ name: 'ჭავჭავაძის გამზირი 12', lat: 41.7, lng: 44.8 }), 'https://example.test');
  assert.equal(href.searchParams.get('label'), 'ჭავჭავაძის გამზირი 12');
  assert.equal(href.searchParams.get('lat'), '41.7');
});

test('diet and preparation filters exclude unknown facts before selecting a branch item', () => {
  assert.equal(matchesCatalogFilters(dish, { diet: 'vegan' }), false);
  assert.equal(matchesCatalogFilters(dish, { preparationMax: 15 }), false);
  assert.equal(matchesCatalogFilters({ ...dish, dietaryTags: ['vegan'], preparationMinutes: 15 }, { diet: 'vegan', preparationMax: 15 }), true);
  assert.equal(matchesCatalogFilters({ ...dish, preparationMinutes: 16 }, { preparationMax: 15 }), false);
});
