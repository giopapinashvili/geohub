import test from 'node:test';
import assert from 'node:assert/strict';
import { readCoordinates, readDestinationCoordinates, isMapCoordinate, formatCoordinates, coordinatesForWrite } from '../src/lib/coordinates.js';

test('routing uses explicit metro entrances while ordinary places and invalid destination overrides retain their own coordinates',()=>{
  const station={category:'metro',lat:41.7334036,lng:44.7964257,raw:{mapHidden:true,mapPlaceId:'osm_node_1452387939',mapCoordinates:{lat:41.7326229,lng:44.7970003}}};
  assert.deepEqual(readDestinationCoordinates(station),station.raw.mapCoordinates);
  assert.deepEqual(readCoordinates(station),{lat:station.lat,lng:station.lng});
  assert.deepEqual(readDestinationCoordinates({...station,category:'cafe'}),{lat:station.lat,lng:station.lng});
  assert.deepEqual(readDestinationCoordinates({...station,raw:{...station.raw,mapCoordinates:{lat:999,lng:44.8}}}),{lat:station.lat,lng:station.lng});
  assert.equal(readDestinationCoordinates(null),null);
});

test('WGS84 preserves zero, negative coordinates and numeric decimal legacy values', () => {
  assert.deepEqual(readCoordinates({ lat: 0, lng: 0 }), { lat: 0, lng: 0 });
  assert.deepEqual(readCoordinates({ lat: ' 41.7097 ', lng: '44.8029' }), { lat: 41.7097, lng: 44.8029 });
  assert.deepEqual(readCoordinates({ lat: -90, lng: -180 }), { lat: -90, lng: -180 });
  assert.deepEqual(readCoordinates({ lat: 90, lng: 180 }), { lat: 90, lng: 180 });
});

test('missing, partial, nonfinite, coerced and out of range pairs never become map positions', () => {
  for (const lat of [null, undefined, '', ' ', NaN, Infinity, -Infinity, false, true, [], {}, '0x29', '4.1e1', '41,7', 90.01, -90.01]) {
    assert.equal(readCoordinates({ lat, lng: 44.8 }), null, `invalid latitude ${String(lat)}`);
  }
  for (const lng of ['', null, undefined, NaN, Infinity, 180.01, -180.01]) assert.equal(readCoordinates({ lat: 41.7, lng }), null);
  assert.equal(readCoordinates(undefined), null);
  assert.equal(readCoordinates({ lat: 120, lng: 41.7 }), null, 'an invalid pair is not silently swapped');
});

test('write validation allows intentional unknown position but rejects partial/corrupt pairs', () => {
  assert.deepEqual(coordinatesForWrite({ lat: '', lng: null }), { lat: null, lng: null });
  assert.deepEqual(coordinatesForWrite({ lat: 0, lng: '0' }), { lat: 0, lng: 0 });
  assert.throws(() => coordinatesForWrite({ lat: 41.7 }), { code: 'invalid-coordinates' });
  assert.throws(() => coordinatesForWrite({ lat: 91, lng: 44.8 }), { code: 'invalid-coordinates' });
});

test('display and map eligibility do not invent coordinates or reorder axes', () => {
  assert.equal(formatCoordinates({ lat: 41.7097, lng: 44.8029 }), '41.709700, 44.802900');
  assert.equal(formatCoordinates({ lat: 0, lng: 0 }), '0.000000, 0.000000');
  assert.equal(formatCoordinates({ lat: null, lng: null }), '');
  assert.equal(isMapCoordinate({ lat: 85.051129, lng: 180 }), true);
  assert.equal(isMapCoordinate({ lat: 90, lng: 44.8 }), false);
  assert.equal(isMapCoordinate({ lat: '', lng: 44.8 }), false);
});
