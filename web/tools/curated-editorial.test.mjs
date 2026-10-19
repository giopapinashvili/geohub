import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PLACE_EDITORIAL_IDS, PLACE_EDITORIAL_GROUP_COUNT, getPlaceEditorial } from '../src/lib/curatedPlaceEditorial.js';
import { institutionPhotos, getInstitutionPhotos } from '../src/lib/curatedInstitutionMedia.generated.js';
import { isExcludedCuratedPhoto } from '../src/lib/curatedPlaceMediaExclusions.js';
import { jpegDimensions } from './place-media-utils.mjs';

const publicDir = new URL('../public/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('place-data/manifest.json', publicDir), 'utf8'));
const lookup = JSON.parse(await readFile(new URL('place-data/' + manifest.lookup.file, publicDir), 'utf8'));
const credits = JSON.parse(await readFile(new URL('place-media/institutions-credits.json', publicDir), 'utf8')).photos;

test('curated directory entries resolve to live places and retain their publication provenance', () => {
  const groups = new Set();
  for (const id of PLACE_EDITORIAL_IDS) {
    assert.ok(lookup[id], `No published place for ${id}`);
    const entry = getPlaceEditorial(id);
    groups.add(entry.key);
    assert.ok(entry.description && entry.highlights.length && entry.sources.length, id);
    assert.equal(entry.posts.length, 2, id);
    for (const post of entry.posts) {
      assert.equal(post.authorType, 'directory');
      assert.ok(post.body && post.title && entry.sources.some(source => source.url === post.sourceUrl), `${id}: uncited post`);
    }
    for (const source of entry.sources) assert.equal(new URL(source.url).protocol, 'https:');
  }
  assert.equal(groups.size, PLACE_EDITORIAL_GROUP_COUNT);
});

test('unknown place names cannot inherit another institution or branch identity', () => {
  assert.equal(getPlaceEditorial({ id: 'unknown', name: 'ალტა' }), null);
  assert.equal(getPlaceEditorial({ id: 'unknown', name: 'თბილისის სახელმწიფო უნივერსიტეტი' }), null);
  assert.deepEqual(getInstitutionPhotos({ id: 'unknown', name: 'ქარვასლა' }), []);
});

test('licensed photo assets match verified hashes, attribution and published place IDs', async () => {
  const checked = new Set();
  for (const [id, rows] of Object.entries(institutionPhotos)) {
    assert.ok(lookup[id], `No published place for photo ${id}`);
    for (const row of rows) {
      const credit = credits.find(c => c.placeId === id && c.url === row.url);
      assert.ok(credit && credit.sourceMapping.proof && credit.changes, `${id}: missing provenance`);
      assert.ok(row.author && row.license && row.licenseUrl && row.sourceUrl && row.caption);
      assert.equal(new URL(row.sourceUrl).hostname, 'commons.wikimedia.org');
      assert.match(row.url, /^\/place-media\/institution-[a-f0-9]{12}\.jpg$/);
      if (checked.has(row.url)) continue;
      checked.add(row.url);
      const bytes = await readFile(fileURLToPath(new URL(row.url.slice(1), publicDir)));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), credit.sha256);
      const dimensions = jpegDimensions(bytes);
      assert.ok(dimensions.width >= 400 && dimensions.height >= 300, row.url);
      if (/upload date/i.test(credit.rawDateTaken)) assert.equal(row.dateTaken, '');
    }
  }
});

test('campus and library building photos stay attached to the reviewed location', () => {
  assert.ok(getInstitutionPhotos('osm_relation_16507696').every(p => p.sourceTitle.includes('administrative')));
  assert.equal(isExcludedCuratedPhoto('osm_relation_16507696', 'File:Georgische Technische Universität - 1. Korpus.jpg'), true);
  assert.deepEqual(getInstitutionPhotos('osm_relation_18087876'), []);
  assert.ok(getInstitutionPhotos('osm_way_156763778').some(p => p.caption.includes('A კორპუსი')));
  assert.ok(getInstitutionPhotos('osm_relation_1182326').every(p => p.sourceTitle.includes('Building №1')));
  assert.ok(getInstitutionPhotos('osm_node_11427406837').every(p => p.caption.includes('III კორპუს')));
  assert.ok(!getInstitutionPhotos('osm_relation_17405902')[0].caption.includes('საარქივო'));
  assert.ok(getInstitutionPhotos('osm_way_124320620').every(p => p.caption.includes('შორეულ')));
});
