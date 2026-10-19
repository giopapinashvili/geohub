import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {SOURCE_DIRECTORY_INSTITUTIONS as definitions} from './source-directory-institutions.mjs';
import {PLACE_TAXONOMY} from '../src/lib/placeTaxonomy.js';
import {createDirectoryRecords,mergeDirectoryRecords} from './source-directory-policy.mjs';
import {INSTITUTION_PLACE_BRANDS} from '../src/lib/institutionBrandRegistry.generated.js';

const webRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const audit=JSON.parse(fs.readFileSync(new URL('./source-directory-institutions.audit.json',import.meta.url)));
const sourcePath=path.resolve(webRoot,'../.codex/artifacts/place-import/osm-tbilisi.json');
const basePath=path.resolve(webRoot,'../.codex/artifacts/institution-directories/base-places.json');

test('official source wave accounts for every reviewed row without claiming unresolved institutions are mapped',()=>{
  assert.equal(audit.schools.rows.length,289);
  assert.equal(audit.schools.matched+audit.schools.new+audit.schools.unresolved,289);
  assert.equal(definitions.filter(e=>e.id.startsWith('directory_emis_school_')).length,audit.schools.matched+audit.schools.new);
  assert.equal(audit.higherEducation.length,66);
  assert.equal(audit.municipalLibraries.length,14);
  assert.equal(audit.museums.length,11);
  assert.equal(new Set(definitions.map(x=>x.id)).size,definitions.length);
  const matched=definitions.filter(x=>x.matchedPlaceId);
  assert.equal(new Set(matched.map(x=>x.matchedPlaceId)).size,matched.length,'two source institutions cannot silently merge to one existing entity');
  for(const e of matched)assert.ok(e.matchEvidence?.length>40,e.id);
  const categories=new Set(PLACE_TAXONOMY.map(x=>x.id));
  for(const e of definitions){
    assert.match(e.id,/^directory_[a-z0-9_]+$/);
    assert.ok(categories.has(e.category),e.id);
    assert.ok(e.coordinateSourceId||(Number.isFinite(e.lat)&&Number.isFinite(e.lng)),e.id);
    assert.ok(e.posts?.length,e.id+' has source-backed editorial posts');
    assert.ok(e.posts.every(p=>p.title&&p.body&&p.sourceUrl?.startsWith('https://')),e.id);
  }
});

test('school, campus and rename corrections remain explicit and preserve distinct entities',()=>{
  const school=definitions.find(x=>x.matchedPlaceId==='osm_way_80636201');
  assert.equal(school.category,'school');assert.equal(school.correctCategory,true);assert.match(school.categoryEvidence,/UG School/);
  const academy=definitions.find(x=>x.matchedPlaceId==='osm_node_12186281801');
  assert.equal(academy.correctName,true);assert.match(academy.nameEvidence,/2024-12-04/);
  const shared=definitions.filter(x=>x.matchedPlaceId==='osm_way_161757318');
  assert.equal(shared.length,1,'Free and Agricultural University share an existing named campus record');
  assert.ok(shared[0].aliases.includes('აგრარული უნივერსიტეტი'));
  const withheld=new Set(audit.schools.rows.filter(x=>x.status==='unresolved').map(x=>x.sourceRecordId));
  for(const id of ['45','92','94','107','2573']){
    assert.ok(withheld.has(id),'conflicting or former school site stays unresolved: '+id);
    assert.ok(!definitions.some(x=>x.id==='directory_emis_school_'+id));
  }
  const tma=definitions.find(x=>x.id==='directory_tbilisi_medical_academy');
  assert.equal(tma.lat,41.68676145939364);assert.equal(tma.lng,44.82733409229089);
  assert.equal(tma.sourceCertainty,'official-campus-map-point');
});

test('every published institutional preview has verified bytes, original source hash and publisher attribution',()=>{
  const photos=definitions.flatMap(e=>e.photoCredits||[]);
  assert.equal(photos.length,audit.summaries.total.photos);
  assert.ok(photos.length>=116);
  for(const photo of photos){
    assert.match(photo.url,/^\/place-media\/directory-[a-z0-9.-]+\.(jpg|jpeg|png|webp)$/);
    const bytes=fs.readFileSync(path.join(webRoot,'public',photo.url));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),photo.sha256,photo.url);
    assert.ok(bytes.length>1000,photo.url);
    assert.ok(photo.author&&photo.originalUrl&&photo.sourceUrl);
    assert.equal(photo.rights,'source-published');
    assert.equal(photo.dateTaken,'','unknown capture dates are not invented');
    assert.ok(!photo.license,'publisher photo is not falsely assigned a Creative Commons license');
    assert.match(photo.sourceOriginalSHA,/^[a-f0-9]{64}$/);
    assert.ok(photo.width>0&&photo.width<=1280&&photo.height>0&&photo.height<=1280);
    assert.ok(photo.sourceWidth>0&&photo.sourceHeight>0);
    assert.ok(bytes[0]===255&&bytes[1]===216,'preview uses actual JPEG bytes');
  }
});

test('school logos identify exact verified schools and retain official artwork provenance',()=>{
  const credits=JSON.parse(fs.readFileSync(path.join(webRoot,'public/map-brands/institution-credits.json')));
  assert.equal(Object.keys(INSTITUTION_PLACE_BRANDS).length,20);
  for(const [key,brand]of Object.entries(INSTITUTION_PLACE_BRANDS)){
    assert.deepEqual(brand.categories,['school']);
    assert.ok(brand.placeIds.length>0);
    assert.ok(brand.aliases.every(alias=>alias.includes('სკოლა')));
    assert.ok(!brand.aliases.some(alias=>/^\d+$/.test(alias)),'school number alone cannot claim a brand');
    for(const placeId of brand.placeIds)assert.ok(definitions.some(d=>d.id===placeId||d.matchedPlaceId===placeId));
    const source=credits.logos.find(x=>x.id===key);
    assert.ok(source.sourceUrl.startsWith('https://skolebi.emis.ge/back/imagedownload?attachmentId='));
    const bytes=fs.readFileSync(path.join(webRoot,'public/map-brands',brand.file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),source.sha256);
    assert.match(source.sourceOriginalSHA,/^[a-f0-9]{64}$/);
  }
});

test('complete official wave imports against the reviewed extract and keeps native identity/coordinates',{
  skip:!fs.existsSync(sourcePath)||!fs.existsSync(basePath),
},()=>{
  const elements=JSON.parse(fs.readFileSync(sourcePath)).elements;
  const places=JSON.parse(fs.readFileSync(basePath));
  const original=new Map(places.map(p=>[p.id,{lat:p.lat,lng:p.lng,name:p.name}]));
  const records=createDirectoryRecords(elements,definitions,places);
  const result=mergeDirectoryRecords(places,records,definitions);
  assert.equal(result.matchedRecords,263);
  assert.equal(result.additions.length,33);
  for(const definition of definitions.filter(x=>x.matchedPlaceId)){
    const p=places.find(p=>p.id===definition.matchedPlaceId),before=original.get(p.id);
    assert.equal(p.lat,before.lat,p.id);assert.equal(p.lng,before.lng,p.id);
    if(!definition.correctName&&p.raw?.originalSourceName===undefined)assert.equal(p.name,before.name,p.id);
  }
  const tma=result.additions.find(x=>x.id==='directory_tbilisi_medical_academy');
  assert.ok(tma.raw.editorial.posts.length);
  const museum=result.additions.find(x=>x.id==='directory_museum_chabukianis_memorialuri_sakhl_muzeumi');
  assert.equal(museum.photos.length,2);
  const ug=places.find(x=>x.id==='osm_way_80636201');
  assert.equal(ug.category,'school');assert.equal(ug.raw.originalSourceCategory,'university');
});
