import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {SOURCE_DIRECTORY_MALLS_HEALTH as places} from './source-directory-malls-health.mjs';
import {DIRECTORY_PLACE_BRANDS as brands} from '../src/lib/directoryBrandRegistry.generated.js';
import {placeBrand} from '../src/lib/placeBrands.js';
import {createDirectoryRecords} from './source-directory-policy.mjs';
const audit=JSON.parse(fs.readFileSync(new URL('./source-audits/malls-health-2026-10-19.json',import.meta.url)));
const credits=JSON.parse(fs.readFileSync(new URL('../public/map-brands/directory-credits.json',import.meta.url)));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');

test('public mall directories are deduplicated and every site retains source-backed posts',()=>{
  const tenants=places.filter(p=>p.parentPlaceId);
  assert.equal(tenants.length,720);assert.equal(places.length,audit.records);
  assert.equal(new Set(places.map(p=>p.id)).size,places.length);
  const matched=places.filter(p=>p.matchedPlaceId);
  assert.equal(new Set(matched.map(p=>p.matchedPlaceId)).size,matched.length);
  for(const p of places){
    assert.ok(p.editorial.posts.length>=2,p.id);
    for(const post of p.editorial.posts){assert.ok(post.title&&post.body.length>50,p.id);assert.equal(post.sourceUrl,p.sourceUrl);}
    if(p.matchedPlaceId)assert.ok(p.matchEvidence?.length>60,p.id);
  }
  for(const p of tenants){assert.equal(p.coordinateSourceId,p.parentPlaceId);assert.equal(p.coordinateAccuracy,'approximate-center');assert.match(p.coordinateNote,/ზუსტი/);}
  assert.equal(audit.crossSourceMatches.length,2,'named mall operator branches should be merged, while ATMs stay distinct');
});

test('full source definitions pass the production directory validator',()=>{
  const path=new URL('../../.codex/artifacts/place-import/osm-tbilisi.json',import.meta.url);
  if(!fs.existsSync(path))return;
  const elements=JSON.parse(fs.readFileSync(path)).elements;
  const records=createDirectoryRecords(elements,places);
  assert.equal(records.length,places.length);
  for(const p of records){assert.ok(p.lat>41.6&&p.lat<41.9,p.id);assert.ok(p.lng>44.6&&p.lng<45.1,p.id);}
});

test('every added logo has local artwork, verified hash, category and exact-place guards',()=>{
  assert.equal(Object.keys(brands).length,534);
  assert.equal(credits.failures.length,0);
  for(const [id,b] of Object.entries(brands)){
    const cr=credits.logos.find(c=>c.id===id);assert.ok(cr,id);assert.equal(cr.rights,'source-published');
    const file=new URL(`../public/map-brands/${b.file}`,import.meta.url);
    assert.equal(hash(fs.readFileSync(file)),cr.sha256,id);assert.ok(b.categories.length,id);assert.ok(b.placeIds.length,id);
    if(b.exactPlaceOnly)assert.equal(b.aliases.length,0,'generic tenant names must not brand unrelated businesses');
  }
});

test('real hospital photographs carry provenance; placeholders and invalid health points remain excluded',()=>{
  const media=places.flatMap(x=>x.photoCredits||[]);assert.equal(media.length,2);
  for(const p of media){assert.ok(p.caption&&p.sourceUrl&&p.originalUrl&&p.author);assert.equal(p.rights,'source-published');assert.equal(hash(fs.readFileSync(new URL(`../public${p.url}`,import.meta.url))),p.sha256);}
  assert.equal(audit.health.rejectedImages,12);assert.equal(audit.health.pending.length,5);
  const guramishvili=places.find(x=>x.id==='directory_health_evex_23');assert.equal(guramishvili.coordinateSourceId,'osm_node_10990135430');assert.match(guramishvili.matchEvidence,/rejected/);
  assert.ok(!places.some(x=>x.lat===1||x.lng===1));
});

test('reviewed bilingual mall tenants retain canonical branded pages and published floor facets',()=>{
  assert.equal(audit.reviewedBilingualTenantMatches.length,11);
  for(const match of audit.reviewedBilingualTenantMatches){
    const place=places.find(p=>p.id===match.directoryId);
    assert.equal(place.matchedPlaceId,match.canonicalId);
    const brand=Object.values(brands).find(b=>b.placeIds.includes(match.canonicalId));
    assert.ok(brand,match.canonicalId);
    assert.ok(match.aliases.some(alias=>brand.aliases.includes(alias)),match.canonicalId);
    assert.ok(placeBrand({id:match.canonicalId,name:match.aliases[0],category:place.category}),match.canonicalId);
  }
  assert.equal(places.filter(p=>p.facets?.level).length,491);
  assert.ok(!places.some(p=>p.facets && 'floor' in p.facets));
  const foodMarket=placeBrand({id:'osm_relation_17845192',name:'Food & Market',category:'restaurant'});
  assert.ok(foodMarket,'canonical restaurant category must retain its exact branded badge');
});
