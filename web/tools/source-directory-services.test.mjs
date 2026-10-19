import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {SOURCE_DIRECTORY_SERVICES as definitions} from './source-directory-services.mjs';
import {SERVICES_PLACE_BRANDS as brands} from '../src/lib/servicesBrandRegistry.generated.js';
import {placeBrandId} from '../src/lib/placeBrands.js';
import {createDirectoryRecords,mergeDirectoryRecords} from './source-directory-policy.mjs';
import {PLACE_TAXONOMY} from '../src/lib/placeTaxonomy.js';

const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const audit=read('./source-audits/directory-services.json');
const mediaCredits=read('../public/place-media/directory-services-credits.json');
const logoCredits=read('../public/map-brands/services-credits.json');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const definitionById=new Map(definitions.map(entry=>[entry.id,entry]));
const taxonomy=new Set(PLACE_TAXONOMY.map(entry=>entry.id));

test('service source reconciliation keeps unresolved points out of publication and preserves exact source IDs',()=>{
  assert.equal(definitions.length,106);
  assert.equal(audit.accepted,definitions.length);
  assert.equal(audit.new+audit.matched,definitions.length);
  assert.equal(audit.new,76);
  assert.equal(audit.matched,30);
  assert.equal(Object.values(audit.sourceCounts).reduce((sum,entry)=>sum+entry.listed,0),audit.sourceCandidates);
  const candidates=audit.events.filter(event=>event.id);
  assert.equal(candidates.length,audit.sourceCandidates);
  assert.equal(candidates.filter(event=>event.finalDisposition==='held').length,40);
  assert.equal(new Set(candidates.map(event=>event.id)).size,candidates.length);
  for(const event of candidates)assert.equal(definitionById.has(event.id),event.finalDisposition!=='held',event.id);
  for(const entry of definitions){
    assert.match(entry.id,/^directory_[a-z0-9_]+$/);
    assert.ok(entry.sourceRecordId&&entry.sourceCheckedAt&&entry.sourceName,entry.id);
    assert.ok(taxonomy.has(entry.category),entry.id);
    assert.ok(entry.posts.length>0&&entry.posts.every(post=>post.title&&post.body.length>40&&post.sourceUrl===entry.sourceUrl),entry.id);
    if(entry.matchedPlaceId)assert.ok(entry.matchEvidence?.length>80,entry.id);
    if(entry.correctCategory)assert.ok(entry.categoryEvidence,entry.id);
    for(const key of ['rating','reviewCount','ratingCount','price','discount','reviews'])assert.ok(!(key in entry),'Source must not invent '+key);
  }
  assert.equal(new Set(definitions.filter(entry=>entry.matchedPlaceId).map(entry=>entry.matchedPlaceId)).size,audit.matched);
  assert.ok(!definitionById.has('directory_tegeta_32'),'conflicting old University6 numbering is not guessed');
  assert.ok(!definitionById.has('directory_ardi_17'),'two conflicting addresses cannot silently reuse one official marker');
});

test('vehicle inspections, retail parts, couriers and mobile-only centers retain their distinct meanings',()=>{
  assert.equal(definitions.filter(entry=>entry.category==='vehicle-inspection').length,13);
  assert.equal(definitionById.get('directory_tegeta_58').category,'car-parts','construction-equipment products are not repair services');
  assert.equal(definitions.filter(entry=>entry.category==='parcel-locker').length,24);
  assert.equal(definitionById.get('directory_onex_1').category,'logistics');
  assert.equal(definitionById.get('directory_onex_33').category,'parcel-locker');
  const metro=definitionById.get('directory_silknet_2350');
  assert.equal(metro.sourceRecordId,'2350');
  assert.equal(metro.category,'telecom','Silknet inside a metro station is not another metro entrance');
  assert.equal(metro.editorial.sourceFacts.declaredServices.mobileOnly,true);
  assert.equal(metro.editorial.sourceFacts.declaredServices.porting,true);
  const socar=definitions.filter(entry=>entry.brand==='სოკარი');
  assert.equal(socar.length,5);
  assert.equal(socar.filter(entry=>entry.matchedPlaceId).length,4,'washing services enrich the corresponding existing fuel stations');
  assert.ok(socar.every(entry=>entry.category==='fuel'&&entry.description.includes('რეცხვის')));
  assert.equal(definitionById.get('directory_shangrila_tbilisi').matchedPlaceId,'osm_relation_18276377');
});

test('every service photograph is local, attributed, hash verified and not a generated/stock placeholder',()=>{
  const photos=definitions.flatMap(entry=>(entry.photoCredits||[]).map(photo=>({entry,photo})));
  assert.equal(photos.length,28);
  assert.equal(mediaCredits.photos.length,photos.length);
  assert.equal(new Set(photos.map(({photo})=>photo.url)).size,photos.length);
  for(const {entry,photo} of photos){
    const bytes=fs.readFileSync(new URL('../public'+photo.url,import.meta.url));
    assert.equal(hash(bytes),photo.sha256,photo.url);
    assert.equal(bytes[0],255);assert.equal(bytes[1],216);
    assert.ok(bytes.length>1000);
    assert.equal(photo.sourceUrl,entry.sourceUrl);
    assert.equal(photo.rights,'source-published');assert.equal(photo.dateTaken,'');
    assert.ok(!photo.license,'no invented open license');
    assert.ok(photo.author&&photo.caption&&new URL(photo.originalUrl).protocol==='https:');
    assert.ok(!/ChatGPT|shutterstock|unsplash|noimage/i.test(photo.originalUrl));
    assert.ok(photo.width>0&&photo.width<=1200&&photo.height>0&&photo.height<=1200);
    if(entry.id.includes('usa2locker'))assert.match(photo.caption,/განთავსების ადგილი/,'host-building photographs are labeled accurately');
  }
  assert.equal(audit.manualReview.filter(event=>event.disposition==='media-excluded-generated-image').length,2);
  assert.ok(audit.manualReview.some(event=>event.disposition==='media-excluded-promotional-or-unconfirmed-facility'));
});

// Read the exact checked local PNG pixels without needing an external graphics runtime.
function visibleInkRatio(png,background){
  assert.equal(png.subarray(1,4).toString(),'PNG');
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20),bits=png[24],type=png[25];
  assert.equal(bits,8);assert.ok(type===2||type===6,'reviewed logos use direct RGB/RGBA');
  const channels=type===6?4:3,parts=[];
  for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset),tag=png.subarray(offset+4,offset+8).toString();if(tag==='IDAT')parts.push(png.subarray(offset+8,offset+8+length));offset+=length+12;}
  const packed=inflateSync(Buffer.concat(parts)),stride=width*channels,rows=Buffer.alloc(height*stride);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){const filter=packed[y*(stride+1)];assert.ok(filter<=4);for(let x=0;x<stride;x++){const a=x>=channels?rows[y*stride+x-channels]:0,b=y?rows[(y-1)*stride+x]:0,c=y&&x>=channels?rows[(y-1)*stride+x-channels]:0;const prediction=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];rows[y*stride+x]=(packed[y*(stride+1)+1+x]+prediction)&255;}}
  const bg=[1,3,5].map(i=>parseInt(background.slice(i,i+2),16));let ink=0;
  for(let p=0;p<rows.length;p+=channels){const alpha=channels===4?rows[p+3]/255:1;const difference=[0,1,2].reduce((sum,k)=>sum+Math.abs((rows[p+k]-bg[k])*alpha),0);if(difference>60)ink++;}
  return ink/(width*height);
}

test('all ten actual logo assets have provenance and remain visible on their approved marker background',()=>{
  assert.equal(Object.keys(brands).length,10);
  assert.equal(logoCredits.brands.length,10);
  for(const [id,brand] of Object.entries(brands)){
    const credit=logoCredits.brands.find(row=>'services-'+row.id===id);assert.ok(credit,id);
    const bytes=fs.readFileSync(new URL('../public/map-brands/'+brand.file,import.meta.url));
    assert.equal(hash(bytes),credit.sha256,id);
    assert.equal(credit.rights,'source-published');assert.ok(credit.sourceUrl&&credit.url&&credit.publisher);
    assert.ok(brand.categories.length&&brand.placeIds.length,id);
    assert.ok(visibleInkRatio(bytes,brand.background)>0.035,id+' cannot become an empty white/transparent marker');
    for(const placeId of brand.placeIds)assert.ok(definitions.some(entry=>(entry.matchedPlaceId||entry.id)===placeId),placeId);
  }
  assert.equal(brands['services-usa2georgia'].background,'#080a0b');
  assert.equal(brands['services-amboli'].background,'#ffffff');
});

test('service logos match reviewed names, websites and canonical IDs without claiming unrelated categories',()=>{
  for(const [id,brand] of Object.entries(brands)){
    assert.equal(placeBrandId({name:brand.aliases[0],category:brand.categories[0]}),id);
    assert.equal(placeBrandId({name:'ტესტი',website:'https://'+brand.domains[0],category:brand.categories[0]}),id);
    assert.notEqual(placeBrandId({name:brand.aliases[0],category:'school'}),id);
    assert.notEqual(placeBrandId({id:brand.placeIds[0],name:'ტესტი',category:'school'}),id);
    assert.notEqual(placeBrandId({name:'ტესტი',website:'https://'+brand.domains[0],category:'school'}),id);
  }
});

const rawPath=new URL('../../.codex/artifacts/place-import/osm-tbilisi.json',import.meta.url);
const basePath=new URL('../../.codex/artifacts/chains-source/services-baseline-places.json',import.meta.url);
test('the complete service wave passes the production importer and preserves every reviewed existing identity/coordinate',{
  skip:!fs.existsSync(rawPath)||!fs.existsSync(basePath),
},()=>{
  const elements=JSON.parse(fs.readFileSync(rawPath)).elements,places=JSON.parse(fs.readFileSync(basePath));
  const original=new Map(places.map(place=>[place.id,{name:place.name,lat:place.lat,lng:place.lng,named:place.raw?.named}]));
  const records=createDirectoryRecords(elements,definitions,places);
  const result=mergeDirectoryRecords(places,records,definitions);
  assert.equal(result.additions.length,audit.new);assert.equal(result.matchedRecords,audit.matched);
  assert.equal(records.length,audit.accepted);
  for(const record of records)assert.ok(record.lat>=41.58&&record.lat<=41.91&&record.lng>=44.6&&record.lng<=45.05,record.id);
  for(const entry of definitions.filter(row=>row.matchedPlaceId)){
    const current=places.find(place=>place.id===entry.matchedPlaceId),before=original.get(entry.matchedPlaceId);
    assert.equal(current.lat,before.lat,entry.id);assert.equal(current.lng,before.lng,entry.id);
    if(before.named!==false)assert.equal(current.name,before.name,entry.id);
    assert.ok(current.raw.officialDirectory.some(source=>source.sourceRecordId===entry.sourceRecordId),entry.id);
  }
});
