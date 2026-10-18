import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DEMO_MEDIA } from '../src/lib/demoMedia.js';
import { photoDateLabel } from '../src/lib/photoDate.js';

test('six fictional demo illustrations retain local JPEG integrity and exact attribution', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../public/demo-media/credits.json', import.meta.url), 'utf8'));
  assert.equal(manifest.illustrative, true);
  assert.equal(manifest.photos.length, 6);
  assert.deepEqual(Object.keys(DEMO_MEDIA).sort(), ['auto', 'coffee', 'console', 'flowers', 'lesson', 'meal']);
  for (const photo of manifest.photos) {
    assert.equal(photo.illustrative, true);
    assert.equal(DEMO_MEDIA[photo.key].url, photo.url);
    assert.equal(DEMO_MEDIA[photo.key].sourceUrl, photo.sourceUrl);
    assert.ok(photo.author && photo.license && photo.changes);
    assert.equal(new URL(photo.sourceUrl).hostname, 'commons.wikimedia.org');
    assert.equal(new URL(photo.licenseUrl).hostname, 'creativecommons.org');
    assert.match(photo.url, /^\/demo-media\/[a-z]+-[a-f0-9]{12}\.jpg$/);
    assert.equal(photo.placeId, undefined);
    assert.equal(photo.businessId, undefined);
    const bytes = await fs.readFile(new URL(`../public${photo.url}`, import.meta.url));
    assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8);
    assert.equal(bytes.length, photo.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), photo.sha256);
    assert.ok(photo.preview.width > 0 && photo.preview.height > 0);
  }
});

test('photo dates preserve partial/unknown provenance and never throw on malformed dates', () => {
  assert.equal(photoDateLabel('2023-08-19'), '19.08.2023');
  assert.equal(photoDateLabel('2012'), '2012');
  for (const value of ['', null, undefined, '2025-99-99', '2025-02-30', 'uploaded 2020', {}]) assert.equal(photoDateLabel(value), 'გადაღების თარიღი უცნობია');
});
