import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {SOURCE_DIRECTORY_DEFINITIONS as definitions} from './source-directory-definitions.mjs';
import {PLACE_TAXONOMY} from '../src/lib/placeTaxonomy.js';

const folder=new URL('../public/place-data/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',folder)));
const records=manifest.shards.flatMap(s=>JSON.parse(fs.readFileSync(new URL(s.file,folder))));
const byId=new Map(records.map(p=>[p.id,p]));
const canonicalIds=new Map();
for(const p of records){canonicalIds.set(p.id,p.id);for(const row of p.raw.officialDirectory||[])canonicalIds.set(row.id,p.id);}

test('every accepted source row resolves to one canonical published place with its own provenance and posts',()=>{
 const categories=new Set(PLACE_TAXONOMY.map(c=>c.id));
 for(const d of definitions){
  const p=byId.get(canonicalIds.get(d.id));assert.ok(p,d.id);
  assert.ok(categories.has(p.category),p.id);
  assert.ok(p.raw.editorial?.sources.some(s=>s.url===d.sourceUrl),d.id);
  assert.ok(p.raw.editorial?.posts.some(s=>s.sourceUrl===new URL(d.sourceUrl).href),d.id);
  if(d.matchedPlaceId)assert.ok(p.raw.officialDirectory?.some(s=>s.id===d.id&&s.matchEvidence),d.id);
  else assert.equal(p.raw.source,d.sourceKind==='merchant-directory'?'merchant-directory':'official-directory',d.id);
  if(d.parentPlaceId)assert.ok(byId.has(p.raw.parentPlaceId),d.id);
  for(const photo of d.photoCredits||[])assert.ok(p.photos?.includes(photo.url),`${d.id} lost ${photo.url}`);
 }
 assert.equal(manifest.directoryRecordCount,definitions.length);
 assert.equal(byId.size,records.length);
});

test('all published directory photographs are local reviewed bytes with publisher provenance, never invented open licenses',()=>{
 const checked=new Map();
 for(const d of definitions)for(const photo of d.photoCredits||[]){
  assert.ok(photo.caption&&photo.author&&photo.sourceUrl&&photo.originalUrl,d.id);
  assert.equal(new URL(photo.sourceUrl).protocol,'https:',d.id);
  const expected=checked.get(photo.url);
  if(expected){assert.equal(photo.sha256,expected,photo.url);continue;}
  const data=fs.readFileSync(new URL(`../public${photo.url}`,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),photo.sha256,photo.url);
  if(photo.rights==='source-published')assert.ok(!photo.licenseUrl,`${d.id} publisher media has no asserted reuse license`);
  checked.set(photo.url,photo.sha256);
 }
 assert.ok(checked.size>300);
});

test('mall directory canonical links are reciprocal and unavailable quantities remain unknown',()=>{
 for(const p of records){
  for(const id of p.raw.tenantIds||[]){
   const tenant=byId.get(id);assert.ok(tenant,`${p.id} -> ${id}`);
   assert.equal(tenant.raw.mallId,p.id,`${p.id} -> ${id}`);
  }
  assert.ok(!p.rating&&!p.reviewCount&&!p.price,`${p.id}: no invented review or price`);
 }
});
