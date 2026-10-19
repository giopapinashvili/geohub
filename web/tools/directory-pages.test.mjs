import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importedPlaceEntries } from '../src/lib/importedPlacePosts.js';
import { DEMO_ENABLED, DEMO_MERCHANTS, DEMO_OFFERS, DEMO_BATCH_ID, getDemoMerchant } from '../src/features/commerce/demo.js';
import { ICONS } from '../src/ui/icons.js';

const place = { id: 'osm_node_42', name: 'წყარო', category: 'cafe', lat: 0, lng: 44.7, raw: { source: 'openstreetmap', sourceDate: '2026-10-18T00:00:00Z' } };
test('directory entries contain only present source facts, with canonical place links and no engagement', () => {
  const entry = importedPlaceEntries(place);
  assert.equal(entry.sourceUrl, 'https://www.openstreetmap.org/node/42');
  assert.equal(entry.mapHref, '/map?place=osm_node_42');
  assert.equal(entry.sourceDate, '18.10.2026');
  assert.equal(entry.facts.find(f => f.icon === 'crosshair').value, '0.000000, 44.700000');
  assert.equal(entry.photos.length, 0); assert.deepEqual(entry.amenities, []);
  for (const key of ['rating', 'likes', 'authorId', 'publishedAt', 'price', 'openingHours']) assert.equal(entry[key], undefined);
  assert.ok(entry.facts.every(fact => ICONS[fact.icon]));
  assert.equal(importedPlaceEntries({ ...place, id: 'real_merchant', raw: {} }).isImported, false);
  assert.equal(importedPlaceEntries({ ...place, id: 'real_merchant', raw: {} }).sourceUrl, '');
  assert.ok(importedPlaceEntries({ ...place, raw: { source: 'business' } }).guide.points.length >= 2);
});

test('source photos require matching place media and explicit license/author; unsafe/missing links never render', () => {
  const photo = { url: '/place-media/photo.jpg', caption: 'წყაროს ფოტო', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Photo.jpg', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', license: 'CC BY 4.0', author: 'Photographer', dateTaken: '2023-03-09' };
  const entry = importedPlaceEntries({ ...place, photos: [photo.url], raw: { ...place.raw, website: 'javascript:alert(1)', photoCredits: [photo, photo, { ...photo, url: '/place-media/other.jpg' }, { ...photo, url: 'javascript:alert(1)' }] } });
  assert.equal(entry.photos.length, 1); assert.equal(entry.photos[0].dateLabel, '09.03.2023');
  assert.ok(!entry.facts.some(fact => fact.href));
  assert.equal(importedPlaceEntries({ ...place, photos: [photo.url], raw: { ...place.raw, photoCredits: [{ ...photo, license: '' }] } }).photos.length, 0);
  assert.equal(importedPlaceEntries({ ...place, photos: [photo.url], raw: { ...place.raw, photoCredits: [{ ...photo, dateTaken: '' }] } }).photos[0].dateLabel, 'გადაღების თარიღი უცნობია');
  assert.equal(importedPlaceEntries({ ...place, photos: [photo.url], raw: { ...place.raw, photoCredits: [{ ...photo, dateTaken: '2012' }] } }).photos[0].dateLabel, '2012');
});

test('visitor facts do not infer dietary suitability or accessibility from free text', () => {
  const entry = importedPlaceEntries({ ...place, description: 'vegan halal quiet parking', facets: { diets: ['vegetarian', 'unknown'], wheelchair: 'limited', takeaway: true, outdoorSeating: false, access: 'private' }, raw: { ...place.raw, openingHours: 'Mo-Fr 09:00-18:00', website: 'https://example.com/' } });
  assert.deepEqual(entry.amenities, ['ვეგეტარიანული არჩევანი', 'ეტლით ნაწილობრივ მისაწვდომი', 'წასაღებად']);
  assert.equal(entry.facts.find(f => f.label === 'შესვლის პირობები').value, 'კერძო ტერიტორია');
  assert.equal(entry.facts.find(f => f.icon === 'clock').value, 'Mo-Fr 09:00-18:00');
});

test('directory facts preserve every published contact and safely normalize Tbilisi landlines', () => {
  const entry = importedPlaceEntries({ ...place, city: 'თბილისი', raw: { ...place.raw, phone: '2193011; 2502021; 2193011 extension 42' } });
  const contacts = entry.facts.filter(fact => fact.icon === 'phone');
  assert.deepEqual(contacts.map(fact => fact.value), ['2193011', '2502021', '2193011 extension 42']);
  assert.deepEqual(contacts.map(fact => fact.href), ['tel:+995322193011', 'tel:+995322502021', undefined]);
  const unknownCity = importedPlaceEntries({ ...place, raw: { ...place.raw, phone: '2193011' } });
  assert.equal(unknownCity.facts.find(fact => fact.icon === 'phone').href, undefined);
});

test('every published imported ID resolves through the actual direct-page loader to its own canonical record', async () => {
  const folder = new URL('../public/place-data/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', folder), 'utf8'));
  const original = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => JSON.parse(await readFile(new URL(`../public${url}`, import.meta.url), 'utf8')) });
  let checked = 0;
  try {
    const { getImportedPlace } = await import('../src/data/importedPlaces.js');
    for (const shard of manifest.shards) {
      const records = JSON.parse(await readFile(new URL(shard.file, folder), 'utf8'));
      for (const source of records) {
        const loaded = await getImportedPlace(source.id);
        assert.equal(loaded?.id, source.id); assert.equal(loaded.name, source.name);
        const entry = importedPlaceEntries(loaded);
        assert.equal(entry.placeHref, `/place/${source.id}`); assert.ok(entry.facts.length >= 2);
        checked++;
      }
    }
    assert.equal(checked, manifest.totalPlaces);
    assert.equal(await getImportedPlace('osm_node_9999999999999999'), null);
  } finally { globalThis.fetch = original; }
});

test('all six demo offers resolve to populated fictional pages and catalog items, with local licensed photos', async () => {
  assert.equal(DEMO_MERCHANTS.length, 6); assert.equal(DEMO_OFFERS.length, 6);
  assert.equal(new Set(DEMO_MERCHANTS.map(merchant => merchant.id)).size, 6);
  for (const offer of DEMO_OFFERS) {
    const merchant = DEMO_MERCHANTS.find(value => value.id === offer.demoMerchantId);
    assert.equal(getDemoMerchant(offer.demoMerchantId), DEMO_ENABLED ? merchant : null);
    assert.ok(merchant); assert.equal(offer.demoPageHref, merchant.href);
    assert.equal(offer.itemId, merchant.item.id); assert.equal(offer.businessId, '');
    assert.equal(merchant.demoBatchId, DEMO_BATCH_ID); assert.equal(offer.demoBatchId, DEMO_BATCH_ID);
    assert.ok(merchant.name.startsWith('დემო ')); assert.ok(merchant.about.length > 90);
    assert.equal(merchant.itemDetails.length, 3); assert.ok(ICONS[merchant.icon]);
    assert.equal(merchant.media.illustrative, true); assert.equal(offer.imageUrl, merchant.media.url);
    assert.match(merchant.media.url, /^\/demo-media\/[\w.-]+\.jpg$/);
    assert.ok(merchant.media.author && merchant.media.license && merchant.media.sourceUrl && merchant.media.licenseUrl);
    assert.ok((await readFile(new URL(`../public${merchant.media.url}`, import.meta.url))).byteLength > 1000);
    for (const key of ['address', 'lat', 'lng', 'ownerId', 'rating', 'followers']) assert.equal(merchant[key], undefined);
  }
  assert.equal(getDemoMerchant('real-merchant'), null);
});
