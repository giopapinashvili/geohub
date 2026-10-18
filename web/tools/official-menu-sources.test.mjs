import test from 'node:test';
import assert from 'node:assert/strict';
import { officialMenuSources } from '../src/lib/officialMenuSources.js';

test('official menus are attached only to exact researched venues', () => {
  assert.equal(officialMenuSources({ id: 'osm_way_548795814' }).venue, 'ფაბრიკა');
  assert.equal(officialMenuSources({ id: 'osm_node_6404748085' }).venue, 'კაფე სტამბა');
  assert.equal(officialMenuSources({ id: 'osm_node_8432033717' }).venue, 'კაფე დაფნა — ათონელის 29');
  for (const id of ['osm_node_10848029877', 'osm_node_1601433947', 'osm_node_13790184755', 'another_fabrika']) assert.equal(officialMenuSources({ id, name: 'სტამბა' }), null);
});

test('link checks do not become current prices or pretend menu publication dates', () => {
  for (const id of ['osm_way_548795814', 'osm_node_6404748085', 'osm_node_8432033717']) {
    const source = officialMenuSources({ id });
    assert.equal(source.menuDate, null);
    assert.ok(source.checkedAt && source.dateNote && source.publisherUrl);
    assert.equal(source.items, undefined); assert.equal(source.prices, undefined);
    for (const link of source.links) assert.equal(new URL(link.url).protocol, 'https:');
  }
  const stamba = officialMenuSources({ id: 'osm_node_6404748085' });
  assert.equal(stamba.sourceUploadedAt, '2025-09-15');
  assert.ok(!JSON.stringify(stamba).includes('24.05.2024.pdf'));
});
