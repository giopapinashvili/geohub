import test from 'node:test';
import assert from 'node:assert/strict';
import { readCoordinates, isMapCoordinate, formatCoordinates, coordinatesForWrite } from '../src/lib/coordinates.js';

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
