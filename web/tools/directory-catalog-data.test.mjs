import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { SOURCE_DIRECTORY_FOOD } from './source-directory-food.mjs';
import { buildCanonicalVenueMap } from './directory-catalog-policy.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'web/public/catalog-data');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
test('published source catalog index and payloads preserve exact canonical branch identity',async()=>{
  const index=await read(path.join(output,'index.json'));
  const manifest=await read(path.join(root,'web/public/place-data/manifest.json'));
  const places=[];for(const shard of manifest.shards){const data=await read(path.join(root,'web/public/place-data',shard.file));places.push(...(Array.isArray(data)?data:data.places));}
  const canonical=buildCanonicalVenueMap(places),accepted=new Set(SOURCE_DIRECTORY_FOOD.map(d=>d.sourceRecordId));
  let items=0;
  for(const [id,venue]of Object.entries(index.venues)){
    assert.ok(accepted.has(id));assert.equal(venue.placeId,canonical.get(id)?.id,id);assert.ok(index.byPlaceId[venue.placeId].includes(id));
    if(!venue.file)continue;
    const raw=await fs.readFile(path.join(output,venue.file));
    assert.ok(raw.byteLength<24*1024*1024);
    assert.equal(createHash('sha256').update(raw).digest('hex'),venue.sha256);
    const catalog=JSON.parse(raw);assert.equal(catalog.venueId,id);assert.equal(catalog.placeId,venue.placeId);assert.equal(catalog.items.length,venue.itemCount);
    assert.equal(catalog.schemaRevision,3);assert.match(catalog.sourceResponseSha256,/^[a-f0-9]{64}$/);
    assert.equal(catalog.priceContext,'delivery-marketplace');assert.equal(catalog.currency,'GEL');
    const unique=new Set();for(const item of catalog.items){
      assert.ok(item.id && item.name);assert.ok(!unique.has(item.id));unique.add(item.id);
      assert.ok(item.priceMinor===null || Number.isSafeInteger(item.priceMinor) && item.priceMinor>=0);
      assert.equal(item.currency,'GEL');assert.equal(item.preparationMinutes,undefined);
      if(item.dietaryTags?.length){assert.equal(item.dietarySource,'publisher-declared');assert.ok(item.dietaryTags.every(tag=>['vegan','vegetarian','halal','kosher','gluten-free','lactose-free','dairy-free'].includes(tag)));}
      if(item.imageUrl){const url=new URL(item.imageUrl);assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');}
    }
    for(const category of catalog.categories)for(const itemId of category.itemIds)assert.ok(unique.has(itemId));
    for(const group of catalog.optionGroups||[])for(const value of group.values||[])assert.ok(value.priceMinor===null || Number.isSafeInteger(value.priceMinor));
    items+=catalog.items.length;
  }
  assert.equal(items,index.totalItems);
});
test('sharded search references only published exact branch items and matches hashes',async()=>{
  const index=await read(path.join(output,'index.json')),manifest=await read(path.join(output,index.search.manifest));
  const knownItems=new Map();let shards=0;
  for(const descriptors of Object.values(manifest.buckets))for(const descriptor of descriptors){
    const bytes=await fs.readFile(path.join(output,descriptor.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),descriptor.sha256);
    const payload=JSON.parse(bytes);assert.equal(payload.rows.length,descriptor.count);shards++;
    for(const row of payload.rows){assert.ok(row[0]);for(const[venueId,itemId]of row[2]){
      assert.ok(index.venues[venueId]?.file);
      if(!knownItems.has(venueId))knownItems.set(venueId,new Set((await read(path.join(output,index.venues[venueId].file))).items.map(i=>i.id)));
      assert.ok(knownItems.get(venueId).has(itemId));
    }}
  }
  assert.ok(shards>0);
});
