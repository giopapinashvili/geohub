import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { PROFESSIONAL_PLACE_BRANDS as brands } from '../src/lib/professionalBrandRegistry.generated.js';
import { SOURCE_DIRECTORY_PROFESSIONAL as definitions } from './source-directory-professional.mjs';

const credits = JSON.parse(fs.readFileSync(new URL('../public/map-brands/professional-credits.json', import.meta.url)));
const published = new Map(definitions.map(row => [row.matchedPlaceId || row.id, row]));

function visibleInkRatio(png) {
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20), type = png[25];
  assert.equal(png[24], 8);
  assert.ok(type === 2 || type === 6);
  const channels = type === 6 ? 4 : 3, parts = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.subarray(offset + 4, offset + 8).toString() === 'IDAT') parts.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const packed = inflateSync(Buffer.concat(parts)), stride = width * channels, pixels = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = packed[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y ? pixels[(y - 1) * stride + x] : 0;
      const c = y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      pixels[y * stride + x] = (packed[y * (stride + 1) + 1 + x] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]) & 255;
    }
  }
  let ink = 0;
  for (let p = 0; p < pixels.length; p += channels) {
    const alpha = channels === 4 ? pixels[p + 3] / 255 : 1;
    if ([0, 1, 2].reduce((sum, channel) => sum + Math.abs((pixels[p + channel] - 255) * alpha), 0) > 60) ink++;
  }
  return ink / (width * height);
}

test('professional logos bind only to exact published providers, with explicit categories', () => {
  assert.equal(Object.keys(brands).length, 7);
  assert.equal(Object.values(brands).flatMap(brand => brand.placeIds).length, 8);
  const ids = new Set();
  for (const brand of Object.values(brands)) {
    assert.deepEqual(brand.aliases, [], 'no broad common-name matches');
    assert.deepEqual(brand.domains, [], 'no ambiguous directory or shared-domain matches');
    for (const id of brand.placeIds) {
      assert.ok(!ids.has(id)); ids.add(id);
      const place = published.get(id);
      assert.ok(place, id);
      assert.ok(brand.categories.includes(place.category), id);
    }
  }
});

test('official professional artwork is attributed, hash verified and visibly nonblank', () => {
  assert.equal(credits.brands.length, Object.keys(brands).length);
  for (const [id, brand] of Object.entries(brands)) {
    const credit = credits.brands.find(row => 'professional-' + row.id === id);
    assert.ok(credit, id);
    assert.equal(credit.file, brand.file);
    assert.equal(credit.rights, 'source-published');
    assert.ok(!credit.license, 'no invented open license');
    assert.ok(credit.publisher);
    assert.equal(new URL(credit.sourceUrl).protocol, 'https:');
    assert.equal(new URL(credit.url).protocol, 'https:');
    assert.deepEqual(credit.placeIds, brand.placeIds);
    assert.deepEqual(credit.identityEvidence.map(row => row.id), brand.placeIds);
    const bytes = fs.readFileSync(new URL('../public/map-brands/' + brand.file, import.meta.url));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), credit.sha256, id);
    assert.equal(bytes.readUInt32BE(16), credit.width);
    assert.equal(bytes.readUInt32BE(20), credit.height);
    assert.equal(brand.background, '#ffffff');
    assert.ok(visibleInkRatio(bytes) > 0.08, id + ' cannot render as a blank white marker');
  }
});
