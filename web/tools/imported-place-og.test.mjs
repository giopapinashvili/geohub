import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const worker = await fs.readFile(new URL('../worker/og-worker.js', import.meta.url), 'utf8');
const { loadImportedPlaceMeta } = await import(`data:text/javascript;base64,${Buffer.from(worker).toString('base64')}`);
const root = path.resolve('web/public');

function assets(overrides = {}) {
  const paths = [];
  return { paths, ASSETS: { async fetch(request) {
    const pathname = new URL(request.url).pathname;
    paths.push(pathname);
    if (Object.hasOwn(overrides, pathname)) return Response.json(overrides[pathname]);
    try { return new Response(await fs.readFile(path.join(root, pathname)), { headers: { 'content-type': 'application/json' } }); }
    catch { return new Response('Missing', { status: 404 }); }
  } } };
}

test('shared imported places use their real directory identity and exact licensed photo', async () => {
  const env = assets();
  const meta = await loadImportedPlaceMeta('osm_way_548795814', env, 'https://geohub-main.pages.dev');
  assert.match(meta.title, /ფაბრიკა|Fabrika/i);
  assert.match(meta.image, /^https:\/\/geohub-main.pages.dev\/place-media\/fabrika-/);
  assert.equal(meta.type, 'place');
  assert.equal(meta.width, 1280);
  assert.equal(meta.height, 960);
  assert.equal(env.paths.filter(value => value.startsWith('/place-data/places-')).length, 1);
  assert.ok(env.paths.every(value => value.startsWith('/place-data/') || value === '/place-media/credits.json'));
});

test('unknown imported IDs and malformed manifest asset paths never become invented cards or fetches', async () => {
  const invalid = assets();
  assert.equal(await loadImportedPlaceMeta('../private', invalid, 'https://example.test'), null);
  assert.equal(invalid.paths.length, 0);
  const unknown = assets();
  assert.equal(await loadImportedPlaceMeta('osm_node_999999999999999', unknown, 'https://example.test'), null);
  assert.equal(unknown.paths.filter(value => value.startsWith('/place-data/places-')).length, 0);
  const malicious = assets({ '/place-data/manifest.json': { version: 1, lookup: '../secret.json', shards: [] } });
  assert.equal(await loadImportedPlaceMeta('osm_node_1', malicious, 'https://example.test'), null);
  assert.deepEqual(malicious.paths, ['/place-data/manifest.json']);
});

test('unavailable photo credits preserve the place title without borrowing another venue photo', async () => {
  const env = assets({ '/place-media/credits.json': { photos: [{ placeId: 'osm_node_1', url: '/place-media/unrelated-123.jpg' }] } });
  const meta = await loadImportedPlaceMeta('osm_way_548795814', env, 'https://example.test');
  assert.match(meta.title, /ფაბრიკა|Fabrika/i);
  assert.equal(meta.image, undefined);
});
