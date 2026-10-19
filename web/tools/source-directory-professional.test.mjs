import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {SOURCE_DIRECTORY_PROFESSIONAL as records} from './source-directory-professional.mjs';
import {createDirectoryRecords, mergeDirectoryRecords} from './source-directory-policy.mjs';
import {PLACE_TAXONOMY} from '../src/lib/placeTaxonomy.js';
import {PROFESSIONAL_PLACE_MEDIA} from './source-directory-professional-media.mjs';

const audit=JSON.parse(fs.readFileSync(new URL('./source-audits/professional-2026-10-19.json',import.meta.url)));
const byId=new Map(records.map(record=>[record.id,record]));
const accepted=audit.records.filter(row=>row.status.startsWith('accepted-'));

test('every reviewed source row has one accepted or held outcome',()=>{
 assert.equal(audit.records.length,audit.counts.sourceRecords);
 assert.equal(new Set(audit.records.map(row=>row.sourceRecordId)).size,audit.records.length);
 assert.equal(accepted.length,records.length);
 assert.equal(records.length,audit.counts.acceptedRecords);
 assert.equal(records.filter(row=>!row.matchedPlaceId).length,audit.counts.newPlaces);
 assert.equal(records.filter(row=>row.matchedPlaceId).length,audit.counts.matchedPlaces);
 assert.equal(audit.records.filter(row=>row.status==='held').length,audit.counts.heldRecords);
 assert.equal(byId.size,records.length);
});

test('coordinates are exactly the captured source points, bounded and linked to the same public company',()=>{
 const categories=new Set(PLACE_TAXONOMY.map(category=>category.id));
 for(const row of accepted){
  const record=byId.get(row.recordId);
  assert.ok(record,row.recordId);
  assert.equal(record.id,`directory_yell_${record.sourceRecordId}`);
  if(row.verifiedCorrection){
   assert.equal(record.sourceUrl,row.verifiedCorrection.sourceUrl);
   assert.equal(record.lat,row.verifiedCorrection.lat);
   assert.equal(record.lng,row.verifiedCorrection.lng);
   assert.match(row.verifiedCorrection.htmlSha256,/^[a-f0-9]{64}$/);
  }else{
   assert.equal(new URL(record.sourceUrl).hostname,'www.yell.ge');
   assert.equal(new URL(record.sourceUrl).pathname,'/company.php');
   assert.equal(new URL(record.sourceUrl).searchParams.get('id'),record.sourceRecordId);
   assert.equal(record.lat,row.sourcePoint.lat,record.id);
   assert.equal(record.lng,row.sourcePoint.lng,record.id);
  }
  assert.ok(record.lat>=41.58&&record.lat<=41.91&&record.lng>=44.6&&record.lng<=45.05,record.id);
  assert.equal(record.city,'თბილისი');
  assert.ok(record.address.length>3,record.id);
  assert.ok(categories.has(record.category),record.category);
  assert.match(row.sourceHtmlSha256,/^[a-f0-9]{64}$/);
  assert.equal(row.factualFieldsSha256,createHash('sha256').update(JSON.stringify(row.factualFields)).digest('hex'));
 }
});

test('directory provenance stays third-party and does not invent prices, reviews, tax IDs or media',()=>{
 for(const record of records){
  const corrected=accepted.find(row=>row.recordId===record.id)?.verifiedCorrection;
  assert.equal(record.sourceKind,corrected?'official-directory':'merchant-directory');
  assert.equal(record.sourceCertainty,corrected?'official-office-location':'public-business-directory-point');
  assert.equal(record.coordinateAccuracy,'source-point');
  assert.match(record.sourceName,corrected?/ოფიციალური/:/Yell/);
  assert.equal(record.sourceCheckedAt,'2026-10-19');
  assert.match(record.coordinateNote,/ცალკე დადასტურებული არ არის/);
  for(const key of ['taxID','taxId','vatID','legalName','rating','reviews','price','priceMinor','photos','image','logo'])assert.equal(record[key],undefined,`${record.id}: ${key}`);
  assert.deepEqual(record.photoCredits,PROFESSIONAL_PLACE_MEDIA[record.id],record.id);
  if(record.website){const u=new URL(record.website);assert.ok(['https:','http:'].includes(u.protocol));assert.equal(u.username,'');assert.equal(u.password,'');}
  assert.equal(record.posts.length,2);
  for(const post of record.posts){assert.equal(post.sourceUrl,record.sourceUrl);assert.ok(post.title&&post.body);assert.doesNotMatch(post.body,/ჩვენი კომპანია|საუკეთესო|გარანტირებულ|ოფიციალურ ცნობარში/);}
 }
});

test('public notary offices use the dedicated category and no personal tax identifiers',()=>{
 const sourceIds=new Set(accepted.filter(row=>row.sourceCategories.some(category=>category.id===244)).map(row=>row.recordId));
 assert.ok(sourceIds.size>50);
 for(const id of sourceIds){const record=byId.get(id);assert.equal(record.category,'notary');assert.match(record.description,/სანოტარო მომსახურება/);}
 assert.ok(!JSON.stringify(records).includes('taxID'));
});

test('all existing matches have reviewed evidence and preserve geometry, owned text and identity',()=>{
 const matches=records.filter(record=>record.matchedPlaceId);
 assert.equal(new Set(matches.map(record=>record.matchedPlaceId)).size,matches.length);
 const originals=matches.map(record=>({id:record.matchedPlaceId,name:`existing-${record.id}`,category:record.category,lat:record.lat+0.00001,lng:record.lng-0.00001,address:'Existing address',description:'Existing owner description',raw:{editorial:{description:'Owner text',posts:[{id:'owned',title:'Owner',body:'Owner text'}]}}}));
 const expected=structuredClone(originals);
 const created=createDirectoryRecords([],records);
 const result=mergeDirectoryRecords(originals,created,records);
 assert.equal(result.additions.length,audit.counts.newPlaces);
 assert.equal(result.matchedRecords,matches.length);
 for(let i=0;i<originals.length;i++){
  const record=originals[i];
  for(const field of ['id','name','lat','lng','address','description'])assert.equal(record[field],expected[i][field],`${record.id} ${field}`);
  assert.equal(record.raw.editorial.description,'Owner text');
  assert.equal(record.raw.editorial.posts[0].id,'owned');
  assert.equal(record.raw.officialDirectory[0].sourceKind,'merchant-directory');
  assert.ok(record.raw.officialDirectory[0].matchEvidence.length>35);
 }
});

test('known wrong coordinates, conflicting locations and already enriched casino remain held',()=>{
 for(const id of ['72064','71241','156759','75011','117519','106416','132528','141184','131384','119829','121703','142719']){
  const row=audit.records.find(row=>row.sourceRecordId===id);
  assert.equal(row?.status,'held',id);
  assert.ok(row.reason.length>20,id);
  assert.equal(byId.has(`directory_yell_${id}`),false,id);
 }
});

test('actual exterior photo preserves official provenance and shared-building scope',()=>{
 assert.deepEqual(Object.keys(PROFESSIONAL_PLACE_MEDIA).sort(),['directory_yell_109551','directory_yell_159143']);
 let assignments=0;
 for(const [id,photos] of Object.entries(PROFESSIONAL_PLACE_MEDIA)){
  const record=byId.get(id);
  assert.ok(record,id);
  assert.match(record.address,/61/);
  assert.deepEqual(record.photoCredits,photos);
  for(const photo of photos){
   assignments++;
   const bytes=fs.readFileSync(new URL(`../public${photo.url}`,import.meta.url));
   assert.equal(createHash('sha256').update(bytes).digest('hex'),photo.sha256);
   assert.equal(photo.rights,'source-published');
   assert.equal(photo.dateTaken,'');
   assert.equal(photo.associationScope,'shared-building-exterior');
   assert.match(photo.caption,/კონკრეტული ოფისის ინტერიერი ან შესასვლელი არ არის ნაჩვენები/);
   assert.match(photo.associationSourceUrl,/^https:\/\//);
   assert.ok(photo.associationEvidence.length>80);
   assert.equal(photo.sourceUrl,'https://fino.ge/kontaqti/');
  }
 }
 assert.equal(assignments,audit.counts.photos);
 const imported=createDirectoryRecords([],records);
 for(const id of Object.keys(PROFESSIONAL_PLACE_MEDIA)){
  const place=imported.find(record=>record.id===id);
  assert.equal(place.raw.photoCredits[0].associationScope,'shared-building-exterior');
  assert.equal(place.image,PROFESSIONAL_PLACE_MEDIA[id][0].url);
 }
});

test('official-site checks separate verified contacts, shared chamber sites and unresolved locations',()=>{
 const checks=JSON.parse(fs.readFileSync(new URL('./source-audits/professional-official-checks-2026-10-19.json',import.meta.url)));
 assert.equal(checks.records.length,195);
 assert.equal(checks.records.filter(record=>record.status==='official-exact-point-correction').length,4);
 assert.equal(checks.records.filter(record=>record.status==='conflicting-official-address-candidate-held').length,3);
 assert.equal(checks.records.filter(record=>record.status==='shared-chamber-website-not-office-verification').length,72);
 for(const record of checks.records){
  if(record.status==='conflicting-official-address-candidate-held')assert.equal(byId.has(record.placeId),false);
  assert.equal(record.snippets,undefined);
  assert.equal(record.taxId,undefined);
 }
 assert.equal(byId.get('directory_yell_142632').website,undefined);
});

test('no duplicate accepted official-domain and exact-address business entries at one site',()=>{
 const domain=website=>{try{return new URL(website).hostname.replace(/^www\./,'').toLowerCase()}catch{return''}};
 const normalize=value=>value.toLowerCase().replace(/\s+/g,'').trim();
 for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
  const a=records[i],b=records[j];
  if(a.category!==b.category||!domain(a.website)||domain(a.website)!==domain(b.website)||normalize(a.address)!==normalize(b.address))continue;
  const meters=Math.hypot((a.lat-b.lat)*111200,(a.lng-b.lng)*82950);
  assert.ok(meters>=100,`${a.id} duplicates ${b.id}`);
 }
});

test('casino entries are neutral place facts without offers or simulated catalog services',()=>{
 const casinos=records.filter(record=>record.category==='casino');
 assert.ok(casinos.length>0);
 for(const record of casinos){
  assert.match(record.posts[0].body,/საინფორმაციო აღრიცხვას/);
  assert.doesNotMatch(JSON.stringify(record),/ჯეკპოტ|ბონუს|უფასო სპინ|მოიგე|გარანტირებული მოგება/);
 }
});
