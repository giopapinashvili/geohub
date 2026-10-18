import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/tbilisiBasemap.js', import.meta.url), 'utf8');
const { expressionFilter, applyTbilisiBasemap, updateBuildingPerspective, getTbilisiMapDataStatus } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function mapFixture() {
  return {
    pitch: 55,
    layers: [
      { id: 'building-top', source: 'carto', 'source-layer': 'building', type: 'fill' },
      { id: 'gh-buildings-3d', source: 'carto', 'source-layer': 'building', type: 'fill-extrusion', filter: ['!=', ['get', 'hide_3d'], true] },
      { id: 'roadname_pri', source: 'carto', 'source-layer': 'transportation_name', type: 'symbol', filter: ['all', ['==', 'class', 'primary'], ['!has', 'ref']] },
    ],
    sources: { carto: {} }, handlers: {},
    getStyle() { return { layers: this.layers }; },
    getSource(id) { return this.sources[id]; },
    getLayer(id) { return this.layers.find((l) => l.id === id); },
    addSource(id, value) { this.sources[id] = value; },
    addLayer(value) { this.layers.push(value); },
    getPitch() { return this.pitch; },
    getLayoutProperty(id, key) { return this.getLayer(id).layout?.[key]; },
    setLayoutProperty(id, key, value) { (this.getLayer(id).layout ||= {})[key] = value; },
    setPaintProperty(id, key, value) { (this.getLayer(id).paint ||= {})[key] = value; },
    setFilter(id, value) { this.getLayer(id).filter = value; },
    on(event, callback) { (this.handlers[event] ||= []).push(callback); },
    fire(event, value) { for (const fn of this.handlers[event] || []) fn(value); },
  };
}

test('legacy CARTO filters retain their logic when combined with within expressions', () => {
  assert.deepEqual(expressionFilter(['all', ['==', 'class', 'primary'], ['in', 'brunnel', 'bridge', 'tunnel'], ['!has', 'ref']]),
    ['all', ['==', ['get', 'class'], 'primary'], ['in', ['get', 'brunnel'], ['literal', ['bridge', 'tunnel']]], ['!', ['has', 'ref']]]);
  assert.deepEqual(expressionFilter(['none', ['==', '$type', 'Point']]), ['!', ['any', ['==', ['geometry-type'], 'Point']]]);
  assert.deepEqual(expressionFilter(['!=', ['get', 'hide_3d'], true]), ['!=', ['get', 'hide_3d'], true]);
});

test('current geometry masks old geometry only after data and restores it on source failure', () => {
  const oldWindow = globalThis.window;
  globalThis.window = { location: { origin: 'https://geohub.example' } };
  try {
    const map = mapFixture();
    const originalRoad = structuredClone(map.getLayer('roadname_pri').filter);
    applyTbilisiBasemap(map, { roof: '#fff', buildingOutline: '#aaa', extrusion: '#ddd', text: '#222', halo: '#fff' });
    assert.equal(map.getLayer('building-top').filter, undefined);
    map.fire('sourcedata', { sourceId: 'gh-tbilisi-current', sourceDataType: 'content' });
    assert.equal(getTbilisiMapDataStatus(map), 'current');
    assert.equal(map.getLayer('building-top').filter[0], '!');
    assert.deepEqual(map.getLayer('roadname_pri').filter[1], expressionFilter(originalRoad));
    map.pitch = 0; updateBuildingPerspective(map);
    assert.equal(map.getLayoutProperty('gh-tbilisi-buildings-3d', 'visibility'), 'none');
    map.pitch = 55; updateBuildingPerspective(map);
    assert.equal(map.getLayoutProperty('gh-tbilisi-buildings-3d', 'visibility'), 'visible');
    map.fire('error', { sourceId: 'gh-tbilisi-current' });
    assert.equal(getTbilisiMapDataStatus(map), 'fallback');
    assert.equal(map.getLayer('building-top').filter, null);
    assert.deepEqual(map.getLayer('roadname_pri').filter, originalRoad);
    assert.equal(map.getLayoutProperty('gh-tbilisi-buildings', 'visibility'), 'none');
    updateBuildingPerspective(map);
    assert.equal(map.getLayoutProperty('gh-tbilisi-buildings-3d', 'visibility'), 'none');
    assert.equal(map.getLayoutProperty('gh-buildings-3d', 'visibility'), 'visible');
  } finally { globalThis.window = oldWindow; }
});
