import test from 'node:test';
import assert from 'node:assert/strict';
import {
  priceToMinor, discountPercent, normalizeCommerceItem, normalizeCommerceOffer,
  commerceOfferState, planDemoCleanup, formatCommercePrice, normalizeBusinessBranch,
} from '../src/lib/commerce.js';

const item = (extra = {}) => ({ id: 'item_1', ...normalizeCommerceItem({ businessId: 'business_1', type: 'dish', title: 'ხაჭაპური', priceMinor: 2000, status: 'published', ...extra }) });
const offer = (extra = {}, source = item()) => normalizeCommerceOffer({ businessId: 'business_1', itemId: source.id, originalPriceMinor: 2000, priceMinor: 1500, startsAtMs: 1000, endsAtMs: 10000, status: 'published', ...extra }, source);

test('money preserves unknown and zero and rejects malformed or fractional minor units', () => {
  assert.equal(priceToMinor(''), null);
  assert.equal(priceToMinor('0'), 0);
  assert.equal(priceToMinor('12,50'), 1250);
  assert.equal(priceToMinor('1.01'), 101);
  for (const invalid of ['1e2', '-2', '12 GEL', '1.111', 'Infinity', '1 200', '1000000.01']) assert.throws(() => priceToMinor(invalid));
  assert.equal(discountPercent(2000, 1500), 25);
  assert.equal(discountPercent(2000, 0), 100);
  assert.equal(discountPercent(0, 0), 0);
  assert.equal(formatCommercePrice(1200), '12 ₾');
  assert.equal(formatCommercePrice(1250).endsWith(' ₾'), true);
});
test('branch coordinates preserve zero, omit unknown pair and reject partial or fake values', () => {
  const branch = { businessId: 'biz_1', title: 'ფილიალი' };
  assert.equal(normalizeBusinessBranch(branch).lat, null);
  assert.equal(normalizeBusinessBranch({ ...branch, lat: 0, lng: 0 }).lng, 0);
  for (const extra of [{ lat: 41.7 }, { lat: NaN, lng: 44.8 }, { lat: '41.7', lng: '44.8' }, { lat: 91, lng: 44.8 }]) assert.throws(() => normalizeBusinessBranch({ ...branch, ...extra }));
});
test('catalog validates types, dietary/preparation data, branches and bundle budget', () => {
  assert.deepEqual(item({ dietaryTags: ['vegetarian'], preparationMinutes: 15 }).dietaryTags, ['vegetarian']);
  assert.equal(item({ priceMinor: null }).priceMinor, null);
  for (const invalid of [
    { businessId: '../bad' }, { priceMinor: 2.5 }, { imageUrl: 'javascript:alert(1)' },
    { dietaryTags: ['vegan', 'vegan'] }, { dietaryTags: ['unverified'] },
    { preparationMinutes: -1 }, { type: 'product', preparationMinutes: 2 },
    { allBranches: false, branchIds: [] }, { branchIds: ['branch1'] },
    { type: 'bundle', bundleItemIds: ['a', 'b', 'c', 'd'], allBranches: false, branchIds: ['a', 'b'] },
  ]) assert.throws(() => item(invalid));
});
test('offer cannot claim another business item, fake discount, mismatched currency or out-of-scope branch', () => {
  assert.equal(offer().priceMinor, 1500);
  for (const invalid of [
    { businessId: 'business_2' }, { itemId: 'missing' }, { originalPriceMinor: 9999 },
    { priceMinor: 2000 }, { priceMinor: -1 }, { endsAtMs: 1000 }, { startsAtMs: NaN },
    { isDemo: true, demoBatchId: 'demo_1' },
  ]) assert.throws(() => offer(invalid));
  assert.equal(offer({ currency: 'USD' }).currency, 'GEL'); // canonical item wins
  assert.throws(() => offer({}, item({ status: 'draft' })));
  assert.throws(() => offer({}, item({ available: false })));
  const branchItem = item({ allBranches: false, branchIds: ['branch_1'] });
  assert.throws(() => offer({}, branchItem));
  assert.throws(() => offer({ allBranches: false, branchIds: ['branch_2'] }, branchItem));
  assert.equal(offer({ allBranches: false, branchIds: ['branch_1'] }, branchItem).allBranches, false);
});
test('offer states honor exact start and exclusive end, with unavoidable demo state', () => {
  const value = offer();
  assert.equal(commerceOfferState(value, 999), 'scheduled');
  assert.equal(commerceOfferState(value, 1000), 'active');
  assert.equal(commerceOfferState(value, 10000), 'expired');
  const demo = item({ isDemo: true, demoBatchId: 'demo_1' });
  assert.equal(commerceOfferState(offer({ isDemo: true, demoBatchId: 'demo_1' }, demo), 2000), 'demo');
  assert.equal(commerceOfferState({ ...value, status: 'archived' }, 2000), 'archived');
});
test('demo cleanup never deletes real parents, another batch, or shared media', () => {
  const records = [
    { collection: 'commerceOffers', id: 'offer_1', isDemo: true, demoBatchId: 'batch_1' },
    { collection: 'commerceItems', id: 'item_1', isDemo: true, demoBatchId: 'batch_1', imageAssetId: 'geohub/demo/batch_1/image1' },
    { collection: 'businesses', id: 'real_biz', isDemo: true, demoBatchId: 'batch_1' },
    { collection: 'places', id: 'real_place', isDemo: true, demoBatchId: 'batch_1' },
    { collection: 'commerceItems', id: 'real_item', isDemo: false, demoBatchId: 'batch_1' },
    { collection: 'commerceItems', id: 'other', isDemo: true, demoBatchId: 'batch_2' },
    { collection: 'commerceItems', id: 'shared_photo', isDemo: true, demoBatchId: 'batch_1', imageAssetId: 'geohub/real/logo' },
  ];
  const plan = planDemoCleanup(records, 'batch_1');
  assert.deepEqual(plan.documents, ['commerceOffers/offer_1', 'commerceItems/item_1', 'commerceItems/shared_photo']);
  assert.deepEqual(plan.assets, ['geohub/demo/batch_1/image1']);
});
