import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicPlaceCache } from '../src/data/publicPlaceCache.js';
const response = (value, type = 'application/json') => new Response(JSON.stringify(value), { headers: { 'content-type': type } });
const shard = index => ({ file: `places-1_${index}-abcdef123456.json`, bytes: 100 });

test('only public versioned assets use persistent HTTP caching; manifest revalidates', async () => {
  let now = 0;
  const requests = [];
  const cache = createPublicPlaceCache({ now: () => now, fetcher: async (url, options) => {
    requests.push({ url, options }); return response({ version: requests.length });
  } });
  assert.equal((await cache.read('manifest.json')).version, 1);
  assert.equal((await cache.read('manifest.json')).version, 1);
  now = 5 * 60 * 1000;
  assert.equal((await cache.read('manifest.json')).version, 2);
  await cache.read(shard(1));
  assert.equal(requests[0].options.cache, 'no-cache');
  assert.equal(requests[2].options.cache, 'force-cache');
  assert.ok(requests.every(request => request.options.credentials === 'omit'));
  for (const file of ['../account.json', '/api/me', 'https://example.org/x', 'places-1_1.json', 'account-abcdef123456.json']) {
    await assert.rejects(cache.read(file), /Invalid public/);
  }
  assert.equal(requests.length, 3);
});

test('parsed shard cache is bounded and evicts least-recently-used entries', async () => {
  const requests = [];
  const cache = createPublicPlaceCache({ maxBytes: 200, maxEntries: 2, fetcher: async url => {
    requests.push(url); return response([]);
  } });
  await cache.read(shard(1)); await cache.read(shard(2)); await cache.read(shard(1));
  await cache.read(shard(3));
  assert.deepEqual(cache.stats(), { entries: 2, bytes: 200, pending: 0 });
  await cache.read(shard(1)); assert.equal(requests.length, 3);
  await cache.read(shard(2)); assert.equal(requests.length, 4);
  await cache.read({ file: 'search-index-abcdef123456.json', bytes: 1000 }, { retain: false });
  assert.equal(cache.stats().bytes, 200);
});

test('concurrent requests coalesce, failed/HTML responses are not retained, retry works', async () => {
  let release;
  let calls = 0;
  const cache = createPublicPlaceCache({ fetcher: async () => {
    calls++;
    if (calls === 1) return new Promise(resolve => { release = () => resolve(response({}, 'text/html')); });
    return response(['ok']);
  } });
  const first = cache.read(shard(1)); const second = cache.read(shard(1));
  assert.equal(first, second); release();
  await assert.rejects(first, /Invalid place data response/);
  assert.equal(cache.stats().entries, 0);
  assert.deepEqual(await cache.read(shard(1)), ['ok']);
  assert.equal(calls, 2);
});

test('enriched directory metadata, lookup and a dense city shard fit together without repeated parsing',async()=>{
 const calls=[];
 const cache=createPublicPlaceCache({fetcher:async url=>{calls.push(url);return response({ok:true});}});
 const assets=[{file:'manifest.json',bytes:4*1024*1024},{file:'lookup-abcdef123456.json',bytes:3*1024*1024},{file:'places-1_2-abcdef123456.json',bytes:8*1024*1024}];
 for(let visit=0;visit<5;visit++)for(const asset of assets)await cache.read(asset);
 assert.equal(calls.length,3);
 assert.equal(cache.stats().entries,3);
 assert.ok(cache.stats().bytes<=24*1024*1024);
});
