import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { applyCuratedPlaceMedia } from '../src/lib/curatedPlaceMedia.js';
import { jpegDimensions } from './place-media-utils.mjs';

const publicRoot = path.resolve('web/public');
const credits = JSON.parse(await fs.readFile(path.join(publicRoot, 'place-media/credits.json'), 'utf8')).photos;

test('all curated image files retain verifiable author, date, source, license and content hash', async () => {
  assert.ok(credits.length >= 4);
  for (const photo of credits) {
    assert.match(photo.url, /^\/place-media\/[a-z-]+-[a-f0-9]{12}\.jpg$/);
    assert.ok(photo.author && photo.sourceTitle);
    assert.equal(typeof photo.dateTaken, 'string');
    assert.ok(photo.dateTaken === '' || /^\d{4}(?:-\d{2}-\d{2})?$/.test(photo.dateTaken));
    assert.equal(new URL(photo.sourceUrl).hostname, 'commons.wikimedia.org');
    assert.equal(new URL(photo.licenseUrl).hostname, 'creativecommons.org');
    assert.match(photo.license, /^(CC BY(?:-SA)? [234]\.0|CC0)$/);
    const bytes = await fs.readFile(path.join(publicRoot, photo.url));
    assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8);
    assert.equal(bytes.length, photo.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), photo.sha256);
    assert.ok(photo.url.includes(photo.sha256.slice(0, 12)));
    assert.deepEqual(jpegDimensions(bytes), photo.preview);
    if (photo.enrichmentVersion) {
      assert.ok(photo.bytes <= 400000);
      assert.ok(photo.preview.width <= 960);
      assert.match(photo.sourceMapping.osmUrl, /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/);
      assert.ok(['osm-commons-file', 'osm-image-file', 'osm-wikidata-image'].includes(photo.sourceMapping.type));
      if (photo.sourceMapping.type === 'osm-wikidata-image') {
        assert.equal(photo.sourceMapping.coordinateVerified, true);
        assert.ok(Number.isFinite(photo.sourceMapping.coordinate.latitude));
        assert.ok(Number.isFinite(photo.sourceMapping.coordinate.longitude));
      }
    }
    const place = applyCuratedPlaceMedia({ id: photo.placeId, photos: [], raw: {} });
    assert.ok(place.photos.includes(photo.url));
    assert.ok(place.raw.photoCredits.some((credit) => credit.url === photo.url));
  }
});

test('photo matching uses exact IDs and does not overwrite existing owner media', () => {
  const unrelated = { id: 'another_fabrika', name: 'ფაბრიკა', lat: 41.709521, lng: 44.802714 };
  assert.equal(applyCuratedPlaceMedia(unrelated), unrelated);
  const owner = { id: 'osm_way_548795814', image: '/owner.jpg', photos: ['/owner.jpg'], raw: {} };
  const first = applyCuratedPlaceMedia(owner);
  const twice = applyCuratedPlaceMedia(first);
  assert.equal(first.image, '/owner.jpg');
  assert.ok(first.photos.length >= 3); assert.equal(twice.photos.length, first.photos.length);
  assert.equal(twice.raw.photoCredits.length, first.raw.photoCredits.length);
  assert.deepEqual(owner.photos, ['/owner.jpg']);
});
