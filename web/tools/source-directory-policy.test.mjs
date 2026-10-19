import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectoryRecords, mergeDirectoryRecords } from './source-directory-policy.mjs';
import { assignMallTenants, createSearchRows, packSearchRows } from './import-tbilisi-osm.mjs';
import { importedPlaceEntries } from '../src/lib/importedPlacePosts.js';
import { applyCuratedPlaceMedia } from '../src/lib/curatedPlaceMedia.js';

const definition=(extra={})=>({id:'directory_test_branch',name:'ფილიალი',category:'supermarket',lat:41.71,lng:44.81,address:'ქუჩა 12',brand:'SPAR',description:'ოფიციალურ ცნობარში მითითებული ფილიალი.',sourceUrl:'https://example.org/branches/12',sourceCertainty:'publisher-map-point',coordinateAccuracy:'source-point',sourceCheckedAt:'2026-10-19',...extra});

test('verified source branch updates the existing page without changing its identity or coordinates',()=>{
  const existing={id:'osm_node_12',name:'SPAR',category:'supermarket',lat:41.7101,lng:44.8101,ownerId:'owner',image:'/owner.jpg',raw:{sourceUrl:'https://www.openstreetmap.org/node/12',phone:'owner-contact'}};
  const def=definition({matchedPlaceId:existing.id,matchEvidence:'Same branch number and exact street address on official locator.',phone:'official-contact'});
  const records=createDirectoryRecords([],[def]);
  const result=mergeDirectoryRecords([existing],records,[def]);
  assert.equal(result.additions.length,0);
  assert.equal(result.matchedRecords,1);
  assert.equal(result.resolvedIds[def.id],existing.id);
  assert.equal(existing.id,'osm_node_12');
  assert.equal(existing.lat,41.7101);
  assert.equal(existing.ownerId,'owner');
  assert.equal(existing.image,'/owner.jpg');
  assert.equal(existing.raw.phone,'owner-contact');
  assert.equal(existing.raw.officialDirectory[0].lat,41.71,'official point stays as evidence rather than overwriting an existing pin');
  assert.equal(existing.raw.sourceUrl,'https://www.openstreetmap.org/node/12');
  assert.ok(existing.aliases.includes('ფილიალი'));
  assert.equal(existing.raw.editorial.posts.length,2);
  assert.ok(existing.raw.editorial.posts.every(post=>post.authorType==='directory'));
});

test('nearby same-name branches are separate unless an explicitly reviewed exact match exists',()=>{
  const existing={id:'osm_node_12',name:'ფილიალი',category:'supermarket',lat:41.71,lng:44.81,raw:{}};
  const defs=[definition(),definition({id:'directory_test_branch_2',address:'ქუჩა 14',lng:44.8102})];
  assert.equal(mergeDirectoryRecords([existing],createDirectoryRecords([],defs),defs).additions.length,2);
  const unproven=definition({matchedPlaceId:existing.id});
  assert.throws(()=>mergeDirectoryRecords([existing],createDirectoryRecords([],[unproven]),[unproven]),/needs evidence/);
  const missing=definition({matchedPlaceId:'osm_node_999',matchEvidence:'reviewed'});
  assert.throws(()=>mergeDirectoryRecords([existing],createDirectoryRecords([],[missing]),[missing]),/Missing reviewed/);
});

test('invalid coordinates, unsupported categories, duplicate source IDs and unsafe URLs fail publication',()=>{
  assert.throws(()=>createDirectoryRecords([],[definition({lat:100})]),/coordinate evidence/);
  assert.throws(()=>createDirectoryRecords([],[definition({coordinateSourceId:'osm_way_missing'})]),/coordinate evidence/);
  assert.throws(()=>createDirectoryRecords([],[definition({category:'pretend-category'})]),/provenance/);
  assert.throws(()=>createDirectoryRecords([],[definition({sourceUrl:'javascript:alert(1)'})]),/provenance/);
  assert.throws(()=>createDirectoryRecords([],[definition({sourceUrl:'https://user:secret@example.org'})]),/provenance/);
  assert.throws(()=>createDirectoryRecords([],[definition(),definition()]),/repeated directory ID/);
});

test('a later source referring to a reviewed earlier source keeps the final canonical place',()=>{
  const existing={id:'osm_node_12',name:'ფილიალი',category:'supermarket',lat:41.71,lng:44.81,raw:{}};
  const first=definition({matchedPlaceId:existing.id,matchEvidence:'Reviewed exact branch and address.'});
  const second=definition({id:'directory_second_source',matchedPlaceId:first.id,matchEvidence:'Same published branch identity, another independent source.'});
  const result=mergeDirectoryRecords([existing],createDirectoryRecords([],[first,second]),[first,second]);
  assert.equal(result.additions.length,0);
  assert.equal(result.resolvedIds[second.id],existing.id);
  assert.deepEqual(existing.raw.officialDirectory.map(x=>x.id),[first.id,second.id]);
});

test('official tenants work for relation malls, retain source floors, and link canonical parent pages',()=>{
  const mall={id:'osm_relation_99',name:'მოლი',category:'mall',lat:41.71,lng:44.81,raw:{}};
  const defs=[definition({id:'directory_mall',category:'mall',matchedPlaceId:mall.id,matchEvidence:'Official mall site and exact building.'}),definition({id:'directory_mall_tenant',parentPlaceId:'directory_mall',coordinateSourceId:'directory_mall',coordinateAccuracy:'approximate-center',coordinateNote:'მოლის შენობის ცენტრი; მაღაზიის შიდა პოზიცია უცნობია.',indoor:true,facets:{level:'0'}})];
  const result=mergeDirectoryRecords([mall],createDirectoryRecords([],defs),defs);
  const all=[mall,...result.additions];
  const stats=assignMallTenants(all,[]);
  assert.equal(stats.tenantLinks,1);
  assert.deepEqual(mall.raw.tenantIds,['directory_mall_tenant']);
  const tenant=result.additions[0];
  assert.equal(tenant.raw.parentPlaceId,mall.id);
  assert.equal(tenant.raw.mallId,mall.id);
  assert.equal(tenant.facets.level,'0');
  assert.match(tenant.raw.coordinateNote,/შიდა პოზიცია უცნობია/);
  assert.equal(packSearchRows(createSearchRows(all,[]).rows).rows[1][0],tenant.id);
  const broken=definition({parentPlaceId:'directory_missing_mall'});
  assert.throws(()=>mergeDirectoryRecords([],createDirectoryRecords([],[broken]),[broken]),/Missing directory parent/);
});

test('official photographs retain their own source and do not acquire an invented open license or capture date',()=>{
  const photo={url:'/place-media/directory-test.jpg',caption:'ფილიალი',sourceUrl:'https://example.org/branch',originalUrl:'https://example.org/branch.jpg',author:'ოფიციალური ცნობარი',rights:'source-published',sha256:'a'.repeat(64),dateTaken:''};
  const [record]=createDirectoryRecords([],[definition({photoCredits:[photo]})]);
  assert.equal(record.image,photo.url);
  const entry=importedPlaceEntries(record);
  assert.equal(entry.photos.length,1);
  assert.equal(entry.photos[0].dateLabel,'გადაღების თარიღი უცნობია');
  assert.equal(entry.photos[0].license,undefined);
  assert.equal(entry.sourceDate,'19.10.2026');
  assert.throws(()=>createDirectoryRecords([],[definition({photoCredits:[{...photo,originalUrl:''}]})]),/photograph provenance/);
});

test('curated media keeps new directory posts and source links after repeated hydration',()=>{
  const editorial={sources:[{url:'https://example.org/official',label:'Official source'}],posts:[{id:'new-verified-entry',title:'New source fact',body:'A sourced fact.',sourceUrl:'https://example.org/official',authorType:'directory'}]};
  const place={id:'osm_way_548795814',name:'Fabrika',raw:{editorial}};
  const result=applyCuratedPlaceMedia(applyCuratedPlaceMedia(place));
  assert.equal(result.raw.editorial.posts.filter(post=>post.id==='new-verified-entry').length,1);
  assert.ok(result.raw.editorial.sources.some(source=>source.url==='https://example.org/official'));
});
