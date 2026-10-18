import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dataUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const taxonomy = dataUrl(await readFile(new URL('../src/lib/placeTaxonomy.js', import.meta.url), 'utf8'));
const source = (await readFile(new URL('../src/lib/mapMarkerPolicy.js', import.meta.url), 'utf8')).replace("'./placeTaxonomy.js'", JSON.stringify(taxonomy));
const { markerBrand, markerPriority } = await import(dataUrl(source));

test('brand artwork requires explicit, exact brand identity rather than similar place names', () => {
  assert.equal(markerBrand({ name: 'SPAR', brand: '' }), '');
  assert.equal(markerBrand({ brand: 'SPAR' }), 'spar');
  assert.equal(markerBrand({ brand: 'სპარი' }), 'spar');
  assert.equal(markerBrand({ brand: 'SPARTAK' }), '');
  assert.equal(markerBrand({ brand: 'TBC Bank' }), 'tbc');
  assert.equal(markerBrand({ brand: 'ორი ნაბიჯი' }), '2nabiji');
});

test('five mapped branches activate distant brand marks; small independent stores do not', () => {
  const small = markerPriority({ category: 'supermarket', brand: 'SPAR', brandBranchCount: 4 });
  const chain = markerPriority({ category: 'supermarket', brand: 'SPAR', brandBranchCount: 5 });
  assert.equal(small.brandAlways, false);
  assert.equal(chain.brandAlways, true);
  assert.ok(chain.minZoom < small.minZoom);
  assert.equal(markerPriority({ category: 'supermarket', brand: 'Unverified logo', brandBranchCount: 20 }).brand, '');
});

test('stations precede entrances, ordinary places and street furniture as zoom increases', () => {
  const station = markerPriority({ category: 'metro' });
  const entrance = markerPriority({ category: 'metro-entrance' });
  const cafe = markerPriority({ category: 'cafe' });
  const signals = markerPriority({ category: 'traffic-signals' });
  assert.equal(station.brand, 'metro');
  assert.equal(entrance.brand, 'metro');
  assert.ok(station.minZoom < cafe.minZoom);
  assert.ok(station.minZoom < entrance.minZoom);
  assert.ok(cafe.minZoom < signals.minZoom);
  assert.ok(station.rank < cafe.rank);
});
