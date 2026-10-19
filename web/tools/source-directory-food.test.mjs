import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {SOURCE_DIRECTORY_FOOD as definitions} from './source-directory-food.mjs';
import {createDirectoryRecords,mergeDirectoryRecords} from './source-directory-policy.mjs';
import {PLACE_TAXONOMY} from '../src/lib/placeTaxonomy.js';
import {WOLT_PLACE_BRANDS} from '../src/lib/woltBrandRegistry.generated.js';

const webRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const audit=JSON.parse(fs.readFileSync(new URL('./source-directory-food.audit.json',import.meta.url)));
const bySource=new Map(definitions.map(x=>[x.sourceRecordId,x]));

test('public merchant source reconciliation accounts for all 4,009 rows and retains ambiguous/virtual rows outside the map',()=>{
 assert.equal(audit.summary.sourceRows,4009);
 assert.equal(audit.rows.length,4009);
 assert.equal(audit.summary.published,definitions.length);
 assert.equal(audit.summary.matched+audit.summary.added,definitions.length);
 assert.equal(audit.summary.published+audit.summary.withheld,4009);
 assert.equal(audit.areas.length,10);
 assert.ok(audit.areas.every(area=>Array.isArray(area.point)&&area.point.length===2));
 assert.equal(new Set(definitions.map(x=>x.id)).size,definitions.length);
 assert.ok(audit.withholdingReasons['existing-entity-match-unresolved']>300);
 assert.equal(audit.withholdingReasons['virtual-or-online-only-without-verified-visitor-address'],53);
 for(const row of audit.rows.filter(x=>x.status==='withheld'))assert.ok(!bySource.has(row.sourceRecordId),row.name);
 assert.ok(!definitions.some(x=>/ვირტუალ|virtual restaurant/i.test(x.address)));
 assert.ok(!definitions.some(x=>/^wendy.?s?\s+(chicken|pizza|cafe)\b/i.test(x.name)),'delivery menu variants cannot create or claim physical branches');
});

test('merchant data is factual, attributed, geographically bounded and cannot invent reviews, prices or dine-in access',()=>{
 const categories=new Set(PLACE_TAXONOMY.map(x=>x.id));
 for(const entry of definitions){
  assert.match(entry.id,/^directory_wolt_[a-f0-9]{24}$/);
  assert.equal(entry.sourceKind,'merchant-directory');
  assert.equal(entry.venueAccess,'delivery-directory');
  assert.ok(entry.sourceUrl.startsWith('https://wolt.com/ka/geo/tbilisi/'));
  assert.equal(entry.sourceCertainty,'public-merchant-directory-point');
  assert.equal(entry.coordinateAccuracy,'source-point');
  assert.ok(categories.has(entry.category),entry.id);
  assert.ok(entry.lat>=41.58&&entry.lat<=41.91&&entry.lng>=44.6&&entry.lng<=45.05);
  assert.ok(entry.description.includes('Wolt'));
  assert.equal(entry.posts.length,2);
  assert.ok(entry.posts.every(post=>post.sourceUrl===entry.sourceUrl&&post.body&&post.title));
  for(const key of ['rating','reviews','ratingCount','price','discount','openingHours','merchant','business_id','taxId','estimate','preparationMinutes'])assert.ok(!(key in entry),entry.id+' must not publish '+key);
  assert.ok(!entry.facets.diets,'marketplace search tags do not establish dietary certification');
  assert.ok(!entry.facets.takeaway&&!entry.facets.wheelchair&&!entry.facets.outdoorSeating,'missing physical-access facts stay unknown');
  if(entry.matchedPlaceId)assert.ok(entry.matchEvidence?.length>80);
 }
});

test('source-associated published media uses valid local previews, stable hashes and honest listing-illustration captions',()=>{
 const hashes=new Map();
 for(const entry of definitions){
  assert.equal(entry.photoCredits?.length,1,entry.id+' has its own publisher-associated listing image');
  const photo=entry.photoCredits[0];
  assert.equal(photo.sourceUrl,entry.sourceUrl);
  assert.match(photo.originalUrl,/^https:\/\/imageproxy\.wolt\.com\//);
  assert.equal(photo.rights,'source-published');
  assert.equal(photo.dateTaken,'');
  assert.ok(!photo.license);
  assert.match(photo.caption,/ილუსტრაცია/);
  assert.ok(photo.width>0&&photo.width<=800&&photo.height>0&&photo.height<=800);
  let hash=hashes.get(photo.url);
  if(!hash){const b=fs.readFileSync(path.join(webRoot,'public',photo.url));assert.ok(b.length>1000);hash=crypto.createHash('sha256').update(b).digest('hex');hashes.set(photo.url,hash);}
  assert.equal(hash,photo.sha256,photo.url);
 }
 assert.equal(audit.summary.photos,definitions.length);
});

const canonicalPath=path.resolve(webRoot,'../.codex/artifacts/directory-wave2/canonical-first-wave.json');
test('reviewed merchant logos bind only exact source identities, preserve provenance and exclude product avatars',()=>{
 const credits=JSON.parse(fs.readFileSync(path.join(webRoot,'public/map-brands/wolt-credits.json')));
 assert.equal(credits.review.uniqueSourceImagesInspected,1192);
 assert.equal(credits.review.rejected.length,18);
 assert.equal(Object.keys(WOLT_PLACE_BRANDS).length,credits.logos.length);
 assert.ok(credits.logos.length>1000);
 const identities=new Map(definitions.flatMap(d=>[[d.id,d],[d.matchedPlaceId||d.id,d]]));
 const seen=new Set();
 for(const [id,brand]of Object.entries(WOLT_PLACE_BRANDS)){
  assert.deepEqual(brand.aliases,[],'Wolt logos cannot infer new identity from similar words');
  const credit=credits.logos.find(x=>x.id===id);assert.ok(credit,id);
  const bytes=fs.readFileSync(path.join(webRoot,'public/map-brands',brand.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),credit.sha256);
  assert.equal(credit.rights,'source-published');assert.ok(!credit.license);
  assert.ok(credit.width<=256&&credit.height<=256);
  assert.ok(credit.sources.every(x=>x.sourceUrl.startsWith('https://wolt.com/ka/geo/tbilisi/')));
  for(const placeId of brand.placeIds){assert.ok(!seen.has(placeId),'ambiguous duplicate logo owner: '+placeId);seen.add(placeId);const d=identities.get(placeId);assert.ok(d,placeId);assert.ok(brand.categories.includes(d.category));}
 }
 assert.ok(credits.logos.reduce((n,x)=>n+x.bytes,0)<30*1024*1024,'small logos must remain suitable for mobile requests');
});

test('actual source policy preserves existing IDs/owner fields/coordinates and distinguishes neighbouring businesses', {skip:!fs.existsSync(canonicalPath)},()=>{
 const places=JSON.parse(fs.readFileSync(canonicalPath));
 const original=new Map(places.map(p=>[p.id,{lat:p.lat,lng:p.lng,name:p.name,address:p.address}]));
 const firstMatch=definitions.find(x=>x.matchedPlaceId);
 const target=places.find(x=>x.id===firstMatch.matchedPlaceId);
 target.ownerId='retained-owner';target.ratingCount=17;target.communityOnly='keep';
 const records=createDirectoryRecords([],definitions,places);
 const result=mergeDirectoryRecords(places,records,definitions);
 assert.equal(result.matchedRecords,audit.summary.matched);
 assert.equal(result.additions.length,audit.summary.added);
 assert.equal(target.ownerId,'retained-owner');assert.equal(target.ratingCount,17);assert.equal(target.communityOnly,'keep');
 for(const definition of definitions.filter(x=>x.matchedPlaceId)){
  const before=original.get(definition.matchedPlaceId),after=places.find(p=>p.id===definition.matchedPlaceId);
  assert.ok(before,definition.id);
  assert.equal(after.lat,before.lat);assert.equal(after.lng,before.lng);assert.equal(after.name,before.name);
  if(before.address)assert.equal(after.address,before.address);
  assert.ok(after.raw.officialDirectory.some(x=>x.id===definition.id&&x.sourceKind==='merchant-directory'));
 }
 const mc=definitions.find(x=>x.sourceRecordId==='6322ecc5a01009aea9692f66');
 assert.equal(mc.matchedPlaceId,'osm_node_289358475');
 const spar=definitions.find(x=>x.name==='SPAR Aghmashenebeli');
 assert.equal(spar.matchedPlaceId,'osm_node_11460194940');
 assert.notEqual(mc.matchedPlaceId,spar.matchedPlaceId);
 for(const addition of result.additions){assert.equal(addition.raw.source,'merchant-directory');assert.equal(addition.raw.venueAccess,'delivery-directory');assert.ok(addition.photos?.length&&addition.raw.editorial.posts.length===2);}
});
