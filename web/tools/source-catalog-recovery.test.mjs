import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectoryCatalogSearch } from '../src/data/directoryCatalogSearch.js';
import { readSourceCatalogFile, refreshSourceCatalogIndex, isOutdatedSourceCatalogError } from '../src/data/sourceCatalogs.js';

let sequence = 0;
const json = body => new Response(JSON.stringify(body), {headers: {'content-type': 'application/json'}});

async function withSnapshot({missingAt = 'manifest', missingResponse = () => new Response('Missing', {status:404}), freshAlsoMissing = false, abortAt = ''} = {}, action) {
  const suffix = (++sequence).toString(16).padStart(12, '0');
  const oldManifest = `search/old-manifest-${suffix}.json`, newManifest = `search/new-manifest-${suffix}.json`;
  const oldShard = `search/old-shard-${suffix}.json`, newShard = `search/new-shard-${suffix}.json`;
  const goodShard = `search/good-shard-${suffix}.json`, venueFile = `venues/recovery-${sequence}.json`;
  const venue = {placeId:`place_${sequence}`,category:'cafe',file:venueFile};
  const index = manifest => ({version:1,venues:{venue},search:{manifest}});
  const oldIndex = index(oldManifest), newIndex = index(newManifest);
  const rows = [['Coffee', 'dish', [['venue', 'coffee']], [], []]];
  const catalog = {version:1,placeId:venue.placeId,venueId:'venue',sourceUrl:'https://example.com/menu',categories:[],items:[{id:'coffee',name:'Coffee',kind:'dish',priceMinor:500,categoryIds:[]}]};
  const manifest = shard => ({version:1,words:['coffee'],buckets:{co:[...(missingAt==='partial-shard'?[{file:goodShard,count:1,bytes:100}]:[]),{file:shard,count:1,bytes:100}]}});
  const requests = [], controller = new AbortController();
  let currentIndex = oldIndex;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const file = String(url).replace('/catalog-data/', ''); requests.push({file,options});
    if(file==='index.json') { if(abortAt==='refresh' && currentIndex===newIndex)controller.abort(); return json(currentIndex); }
    if(file===oldManifest && missingAt==='manifest' || file===oldShard && missingAt!=='manifest' || freshAlsoMissing && file===newManifest) {
      if(abortAt==='missing')controller.abort();
      return missingResponse();
    }
    if(file===oldManifest)return json(manifest(oldShard));
    if(file===newManifest)return json(manifest(newShard));
    if([newShard,goodShard].includes(file))return json({version:1,rows});
    if(file===venueFile)return json(catalog);
    if(file==='services-index.json')return json({version:1,places:{}});
    if(file===`services/unrelated-${suffix}.json`)return json({version:1,items:[]});
    throw new Error(`Unexpected fixture request: ${file}`);
  };
  try {
    // Begin with an actually cached old index, as in an already-open deployment.
    const previouslyCached = await readSourceCatalogFile('index.json');
    await refreshSourceCatalogIndex(previouslyCached);
    requests.length=0; currentIndex=newIndex;
    const search=createDirectoryCatalogSearch({loadPlace:async id=>({id,name:'Test cafe',category:'cafe',facets:{}})});
    await action({search,requests,controller,oldManifest,newManifest,oldShard,newShard,oldIndex,newIndex,suffix});
  } finally {globalThis.fetch=previousFetch;}
}

test('a cached index recovers from a deleted immutable manifest with one fresh index request', async () => {
  await withSnapshot({}, async ({search,requests})=>{
    const result=await search('coffee');
    assert.equal(result.length,1);assert.equal(result[0].itemId,'coffee');
    assert.deepEqual(result.coverage,{source:'public-merchant-catalog',scannedCount:1,truncated:false,unavailable:false});
    assert.equal(requests.filter(row=>row.file==='index.json').length,1);
    assert.ok(requests.every(row=>row.options.credentials==='omit'));
    assert.equal(requests.find(row=>row.file==='index.json').options.cache,'no-cache');
  });
});

test('missing shards and SPA HTML fallbacks recover, including HTML mislabeled as JSON', async () => {
  for(const [contentType,body] of [['text/html','<!doctype html><html>GeoHub app</html>'],['application/json','<html>GeoHub app</html>']]) {
    await withSnapshot({missingAt:'shard',missingResponse:()=>new Response(body,{headers:{'content-type':contentType}})},async({search,requests})=>{
      const result=await search('coffee');assert.equal(result.length,1);assert.equal(result.coverage.unavailable,false);
      assert.equal(requests.filter(row=>row.file==='index.json').length,1);
    });
  }
});

test('a second missing snapshot stops, while refreshed indexes can be shared by parallel searches', async () => {
  await withSnapshot({freshAlsoMissing:true},async({search,requests})=>{
    const result=await search('coffee');assert.equal(result.length,0);assert.equal(result.coverage.unavailable,true);
    assert.equal(requests.filter(row=>row.file==='index.json').length,1);
    assert.equal(requests.length,3);
  });
  await withSnapshot({},async({search,requests})=>{
    const results=await Promise.all([search('coffee'),search('coffee')]);
    assert.ok(results.every(result=>result.length===1 && !result.coverage.unavailable));
    assert.equal(requests.filter(row=>row.file==='index.json').length,1);
  });
});

test('403, rate limits, server errors and network failures do not trigger stale-index recovery', async () => {
  for(const missingResponse of [()=>new Response('<html>Denied</html>',{status:403,headers:{'content-type':'text/html'}}),()=>new Response('',{status:429}),()=>new Response('',{status:503}),()=>{throw new TypeError('Network unavailable');}]) {
    await withSnapshot({missingResponse},async({search,requests})=>{
      const result=await search('coffee');assert.equal(result.length,0);assert.equal(result.coverage.unavailable,true);
      assert.equal(requests.filter(row=>row.file==='index.json').length,0);
    });
  }
});

test('cancellation prevents recovery and does not start another search after index refresh', async () => {
  for(const abortAt of ['missing','refresh'])await withSnapshot({abortAt},async({search,requests,controller,newManifest})=>{
    const result=await search('coffee',20,{signal:controller.signal});
    assert.equal(result.length,0);assert.equal(result.coverage.unavailable,true);
    assert.equal(requests.filter(row=>row.file==='index.json').length,abortAt==='refresh'?1:0);
    assert.ok(!requests.some(row=>row.file===newManifest));
  });
  await withSnapshot({},async({search,requests,controller})=>{
    controller.abort();const result=await search('coffee',20,{signal:controller.signal});
    assert.equal(result.length,0);assert.equal(result.coverage.unavailable,false);assert.equal(requests.length,0);
  });
});

test('failed index refresh preserves available partial rows and leaves unrelated public caches intact', async () => {
  await withSnapshot({missingAt:'partial-shard'},async({requests,suffix})=>{
    await readSourceCatalogFile('services-index.json');
    await readSourceCatalogFile(`services/unrelated-${suffix}.json`);
    const search=createDirectoryCatalogSearch({loadPlace:async id=>({id,name:'Test cafe',category:'cafe',facets:{}}),refreshIndex:async()=>{throw new TypeError('Offline');}});
    const result=await search('coffee');
    assert.equal(result.length,1);assert.equal(result.coverage.unavailable,true);
    await readSourceCatalogFile('services-index.json');
    await readSourceCatalogFile(`services/unrelated-${suffix}.json`);
    assert.equal(requests.filter(row=>row.file==='services-index.json').length,1);
    assert.equal(requests.filter(row=>row.file===`services/unrelated-${suffix}.json`).length,1);
  });
});

test('only missing immutable assets receive the identifiable recovery error', async () => {
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response('Missing',{status:404});
  try {
    await assert.rejects(readSourceCatalogFile('search/probe-aabbccddeeff.json'),error=>isOutdatedSourceCatalogError(error) && error.file==='search/probe-aabbccddeeff.json' && error.status===404);
    await assert.rejects(readSourceCatalogFile('venues/ordinary-missing.json'),error=>!isOutdatedSourceCatalogError(error));
  } finally {globalThis.fetch=original;}
});
