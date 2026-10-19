import test from 'node:test';
import assert from 'node:assert/strict';
import { markerBrand, markerPriority } from '../src/lib/mapMarkerPolicy.js';

test('brand artwork accepts exact reviewed names and rejects merely similar names', () => {
  assert.equal(markerBrand({ name: 'SPAR', brand: '' }), 'spar');
  assert.equal(markerBrand({ brand: 'SPAR' }), 'spar');
  assert.equal(markerBrand({ brand: 'სპარი' }), 'spar');
  assert.equal(markerBrand({ brand: 'SPARTAK' }), '');
  assert.equal(markerBrand({ brand: 'TBC Bank' }), 'tbc');
  assert.equal(markerBrand({ brand: 'ორი ნაბიჯი' }), '2nabiji');
});

test('all reviewed logos appear from first visible zoom regardless of branch count', () => {
  const small = markerPriority({ category: 'supermarket', brand: 'SPAR', brandBranchCount: 4 });
  const chain = markerPriority({ category: 'supermarket', brand: 'SPAR', brandBranchCount: 5 });
  assert.equal(small.brandAlways, true);
  assert.equal(chain.brandAlways, true);
  assert.equal(chain.minZoom, small.minZoom);
  assert.equal(markerPriority({ category: 'mall', name: 'ქარვასლა', brandBranchCount: 1 }).brandAlways, true);
  assert.equal(markerPriority({ category: 'supermarket', brand: 'Unverified logo', brandBranchCount: 20 }).brand, '');
});

test('same names in unrelated categories and lookalike website domains cannot claim a logo', () => {
  assert.equal(markerBrand({ name: 'ქარვასლა', category: 'hotel' }), '');
  assert.equal(markerBrand({ name: 'გვირილა', category: 'florist' }), '');
  assert.equal(markerBrand({ name: 'Technical University', category: 'metro' }), 'metro');
  assert.equal(markerBrand({ category: 'bank', website: 'https://tbcbank.ge.evil.example/' }), '');
  assert.equal(markerBrand({ category: 'university', website: 'https://www.tsu.ge/ka' }), 'tsu');
  assert.equal(markerBrand({ category: 'university', website: 'https://www.kwiu.edu.ge/en' }), 'kwiu');
});

test('pharmacy and Georgian brand aliases share the same artwork across surfaces', () => {
  for (const [name, id] of [['პსპ','psp'],['PSP Pharmacy','psp'],['ჯპს','gpc'],['ფარმადეპო','pharmadepot'],['ავერსი','aversi'],['ორი ნაბიჯი','2nabiji'],['ნიკორა','nikora']]) {
    assert.equal(markerBrand({ name, category: 'pharmacy' }), id);
  }
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
