import test from 'node:test';
import assert from 'node:assert/strict';
import { addDiscountWatch, normalizeDiscountWatch, matchesDiscountWatch, readableDiscountWatches } from '../src/lib/discountWatchlist.js';
import { matchesPlaceFilters } from '../src/lib/discoveryFilters.js';
import { placePageHref, isCatalogLocationId } from '../src/lib/placeLinks.js';

test('watch query validation preserves exact GEL minor units and rejects empty or invalid constraints', () => {
  assert.deepEqual(normalizeDiscountWatch({ term: '  ტელეფონი ', type: 'product', maxPrice: '12.50' }), { term: 'ტელეფონი', type: 'product', maxPriceMinor: 1250 });
  for (const query of [{}, { maxPrice: '-1' }, { maxPrice: '1e4' }, { term: 'x', type: 'anything' }, { term: 'x'.repeat(121) }]) assert.throws(() => normalizeDiscountWatch(query));
  assert.equal(normalizeDiscountWatch({ type: 'service' }).maxPriceMinor, null);
});
test('watchlists deduplicate normalized searches and stop at20 without losing saved entries', () => {
  let entries = addDiscountWatch([], { term: 'Pizza', type: 'dish' }, { id: 'watch1', now: 10 });
  entries = addDiscountWatch(entries, { term: ' pizza ', type: 'dish' }, { id: 'watch2', now: 20 });
  assert.equal(entries.length, 1); assert.equal(entries[0].id, 'watch1');
  for (let i = 1; i < 20; i++) entries = addDiscountWatch(entries, { term: `item ${i}` }, { id: `w${i}` });
  assert.equal(entries.length, 20);
  assert.throws(() => addDiscountWatch(entries, { term: 'overflow' }, { id: 'no' }), /20/);
  assert.equal(readableDiscountWatches([{ id: '../bad', term: 'x', type: '', maxPriceMinor: null }, ...entries]).length, 20);
});
test('watch matches exclude demo/expired/scheduled offers and enforce type, GEL budget and fuzzy words', () => {
  const offer = { status: 'published', isDemo: false, startsAtMs: 10, endsAtMs: 100, type: 'product', itemTitle: 'Playstation 5', currency: 'GEL', priceMinor: 120000 };
  const watch = normalizeDiscountWatch({ term: 'Playsttion 5', type: 'product', maxPrice: '1200' });
  assert.equal(matchesDiscountWatch(offer, watch, 50), true);
  for (const patch of [{ isDemo: true }, { isDemo: undefined }, { status: 'draft' }, { currency: 'USD' }, { priceMinor: 120001 }, { endsAtMs: 49 }, { startsAtMs: 51 }, { type: 'service' }]) assert.equal(matchesDiscountWatch({ ...offer, ...patch }, watch, 50), false);
});
test('preparation filters exclude unknown times and merchant map links use canonical branch pages', () => {
  assert.equal(matchesPlaceFilters({ category: 'restaurant', preparationMinutes: 15, facets: { diets: ['vegan'] } }, { preparationMax: '15', diet: 'vegan' }, 'food'), true);
  for (const preparationMinutes of [null, undefined, 31, -1]) assert.equal(matchesPlaceFilters({ category: 'restaurant', preparationMinutes }, { preparationMax: '30' }), false);
  assert.equal(placePageHref({ id: 'branch_test', pageHref: '/business/b?branch=test&tab=menu' }), '/business/b?branch=test&tab=menu');
  assert.equal(placePageHref({ id: 'native', pageHref: 'javascript:bad' }), '/place/native');
  assert.equal(isCatalogLocationId('branch_test'), true);
  assert.equal(isCatalogLocationId('branch_../bad'), false);
});
