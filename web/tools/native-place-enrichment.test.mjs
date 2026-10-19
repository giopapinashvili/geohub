import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {enrichNativePlace} from '../src/lib/enrichNativePlace.js';
import {importedPlaceEntries} from '../src/lib/importedPlacePosts.js';
import {NATIVE_PLACE_SOURCE_LINKS} from '../src/lib/nativePlaceSourceLinks.js';
import {NATIVE_PLACE_SOURCE_RECORDS} from '../src/lib/nativePlaceSourceRecords.generated.js';
import {VERIFIED_PLACE_SUPPLEMENT} from './verified-place-supplement.mjs';
import {SOURCE_DIRECTORY_DEFINITIONS} from './source-directory-definitions.mjs';
import {getImportedPlace,loadImportedSearchIndex,mergeImportedPlaces} from '../src/data/importedPlaces.js';

// normalize.js imports browser i18n; provide only its initial language attribute.
const previousDocument=globalThis.document;
globalThis.document=previousDocument || {documentElement:{setAttribute(){}}};
const {normPlace}=await import('../src/data/normalize.js');
if (previousDocument===undefined) delete globalThis.document;

const FABRIKA_NATIVE_ID='qVOkEvAR21xy1G1tXLUM';
const FABRIKA_OSM_ID='osm_way_548795814';
const FABRIKA_TENANT_ID='osm_node_9775079796';
function freezeDeep(value) {
  if (value && typeof value==='object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);Object.freeze(value);
  }
  return value;
}

test('native normalization fills missing sourced details without replacing owner data, coordinates or activity', () => {
  const owner=freezeDeep({
    name:'Owner-maintained Fabrika title',categoryId:'cafe',description:'The owner wrote this description.',
    address:'Owner-maintained address',city:'თბილისი',lat:41.7097,lng:44.8031,
    ownerId:'owner-user-123',creatorId:'original-creator',createdAt:{seconds:1700000000,nanoseconds:0},
    coverImage:'/owner-cover.jpg',photos:['/owner-photo.jpg'],aliases:['Owner alias'],
    facets:{wheelchair:'no',internetAccess:'no',outdoorSeating:false},
    website:'https://owner.example/',phone:'+995 555 00 00 00',openingHours:'Mo 12:00-13:00',
    rating:4.9,reviewCount:81,checkinCount:123,saveCount:45,isVerified:true,status:'hidden',
    customOwnerMetadata:{keep:true},source:'merchant',
  });
  const snapshot=JSON.stringify(owner);
  const place=normPlace(FABRIKA_NATIVE_ID,owner);
  assert.equal(place.id,FABRIKA_NATIVE_ID);
  for (const field of ['name','description','address','city','lat','lng','rating','reviewCount','checkinCount','saveCount','status']) assert.equal(place[field],owner[field],field);
  assert.equal(place.category,owner.categoryId);
  assert.equal(place.creatorId,'original-creator');
  assert.equal(place.raw.ownerId,'owner-user-123');
  assert.equal(place.raw.createdAt,owner.createdAt);
  assert.equal(place.createdAt,1700000000000);
  assert.equal(place.verified,true);
  assert.equal(place.image,'/owner-cover.jpg');
  assert.equal(place.photos[0],'/owner-photo.jpg');
  for (const field of ['website','phone','openingHours','source']) assert.equal(place.raw[field],owner[field],field);
  assert.deepEqual(place.facets,owner.facets);
  assert.equal(place.aliases[0],'Owner alias');
  assert.ok(place.aliases.includes('Fabrika'));
  assert.equal(place.raw.customOwnerMetadata,owner.customOwnerMetadata);
  assert.equal(place.raw.linkedOsmId,FABRIKA_OSM_ID);
  assert.equal(JSON.stringify(owner),snapshot,'normalization never mutates the Firestore document');
  assert.deepEqual(enrichNativePlace(place),place,'repeated enrichment does not duplicate photos, credits or aliases');
});

test('the reviewed native Fabrika page receives its own photos and sourced articles while retaining native links', () => {
  const place=normPlace(FABRIKA_NATIVE_ID,{name:'ფაბრიკა',categoryId:'cafe',lat:41.7097,lng:44.8031,ownerId:'owner-1'});
  assert.equal(place.raw.linkedOsmId,FABRIKA_OSM_ID);
  assert.ok(place.description.includes('კომპლექსი'));
  assert.equal(place.address,NATIVE_PLACE_SOURCE_RECORDS[FABRIKA_OSM_ID].address);
  assert.equal(place.raw.website,NATIVE_PLACE_SOURCE_RECORDS[FABRIKA_OSM_ID].raw.website);
  assert.ok(place.photos.some(photo=>photo.includes('fabrika-courtyard')));
  assert.ok(place.photos.some(photo=>photo.includes('fabrika-night')));
  assert.ok(place.raw.editorial.posts.length>=2);
  const entry=importedPlaceEntries(place);
  assert.equal(entry.placeHref,`/place/${FABRIKA_NATIVE_ID}`);
  assert.equal(entry.mapHref,`/map?place=${FABRIKA_NATIVE_ID}`);
  assert.equal(entry.sourceUrl,'https://www.openstreetmap.org/way/548795814');
  assert.ok(entry.photos.length>=2);
  assert.ok(entry.photos.every(photo=>photo.sourceUrl && photo.author && photo.licenseUrl));
  assert.ok(entry.editorialPosts.length>=2);
  assert.ok(entry.editorialPosts.every(post=>post.authorType==='directory' && post.sourceUrl.startsWith('https://')));
  assert.equal(place.creatorId,'owner-1');
  assert.equal(place.reviewCount,0,'editorial enrichment does not fabricate reviews');
});

test('source enrichment uses reviewed IDs, never tenant names or nearby coordinates', () => {
  assert.equal(NATIVE_PLACE_SOURCE_LINKS[FABRIKA_NATIVE_ID],FABRIKA_OSM_ID);
  assert.ok(!Object.values(NATIVE_PLACE_SOURCE_LINKS).includes(FABRIKA_TENANT_ID));
  const stranger={id:'another_fabrika',name:'Fabrika',address:'ეგნატე ნინოშვილის ქუჩა 8',lat:41.709521,lng:44.80271385,raw:{operator:'Fabrika'}};
  assert.equal(enrichNativePlace(stranger),stranger,'same name/location alone cannot acquire another place media');
  const tenant=normPlace('native_magnolia_tenant',{name:'Magnolia Film Lab',categoryId:'photography',lat:41.7092996,lng:44.8028994,operator:'Fabrika'});
  assert.equal(tenant.raw.linkedOsmId,undefined);
  assert.equal(tenant.raw.editorial,undefined);
  assert.deepEqual(tenant.photos,[]);
  assert.equal(tenant.description,'');
});

test('native photo credits and editorial metadata coexist with later source enrichment',()=>{
 const ownPhoto={url:'/owner-photo.jpg',author:'Owner',caption:'Owner caption'};
 const ownPost={id:'owner-editorial',title:'Owner title',body:'Owner information',sourceUrl:'https://example.org/owner'};
 const place={id:FABRIKA_NATIVE_ID,name:'Fabrika',image:ownPhoto.url,photos:[ownPhoto.url],raw:{photoCredits:[ownPhoto],editorial:{description:'Owner text',sources:[{url:ownPost.sourceUrl,label:'Owner'}],posts:[ownPost]}}};
 const result=enrichNativePlace(place);
 assert.equal(result.image,ownPhoto.url);
 assert.ok(result.raw.photoCredits.some(photo=>photo.url===ownPhoto.url&&photo.caption===ownPhoto.caption));
 assert.ok(result.raw.photoCredits.some(photo=>photo.url.includes('fabrika-courtyard')));
 assert.ok(result.raw.editorial.posts.some(post=>post.id===ownPost.id));
 assert.ok(result.raw.editorial.posts.length>1);
 assert.equal(result.raw.editorial.description,'Owner text');
 assert.deepEqual(enrichNativePlace(result),result);
});

test('actual loaders retain all official directory IDs and deduplicate reviewed sources without dropping tenants or branches', async t => {
  const originalFetch=globalThis.fetch;
  const requests=[];
  globalThis.fetch=async (url,options)=>{
    requests.push({url,options});
    assert.match(url,/^\/place-data\/[\w.-]+\.json$/);
    return {ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>JSON.parse(await readFile(new URL(`../public${url}`,import.meta.url),'utf8'))};
  };
  try {
    const index=await loadImportedSearchIndex();
    const byId=new Map(index.map(row=>[row.id,row]));
    assert.equal(byId.size,index.length);
    const directoryIds=index.filter(row=>row.id.startsWith('directory_')).map(row=>row.id).sort();
    assert.deepEqual(directoryIds,SOURCE_DIRECTORY_DEFINITIONS.filter(definition=>!definition.matchedPlaceId).map(definition=>definition.id).sort());
    await t.test('each directory index result opens the same attributed place page',async()=>{
      for (const definition of VERIFIED_PLACE_SUPPLEMENT) {
        const row=byId.get(definition.id), place=await getImportedPlace(row.id);
        assert.equal(row.kind,'place');assert.equal(row.name,definition.name);assert.equal(row.category,definition.category);
        assert.equal(row.coordinateAccuracy,'approximate-center');
        assert.equal(place.id,definition.id);assert.equal(place.raw.source,'official-directory');
        assert.equal(place.raw.sourceUrl,definition.sourceUrl);assert.equal(place.raw.sourceCertainty,definition.sourceCertainty);
        assert.ok(Math.abs(row.lat-place.lat)<0.000001 && Math.abs(row.lng-place.lng)<0.000001,'index coordinate rounding must not move the place');
        assert.equal(importedPlaceEntries(place).placeHref,`/place/${definition.id}`);
      }
    });
    await t.test('native Fabrika suppresses only its linked OSM complex and keeps Magnolia Film Lab',async()=>{
      const native=normPlace(FABRIKA_NATIVE_ID,{name:'ფაბრიკა',categoryId:'cafe',lat:41.7097,lng:44.8031,reviewCount:13,ownerId:'fabrika-owner'});
      const imported=await getImportedPlace(FABRIKA_OSM_ID);
      const tenant=await getImportedPlace(FABRIKA_TENANT_ID);
      assert.ok(tenant.aliases.includes('Fabrika'),'the real source tenant shares the complex operator alias');
      const merged=mergeImportedPlaces([native],[imported,tenant]);
      assert.deepEqual(merged.map(place=>place.id),[FABRIKA_NATIVE_ID,FABRIKA_TENANT_ID]);
      assert.equal(merged[0],native);assert.equal(merged[0].reviewCount,13);assert.equal(merged[0].raw.ownerId,'fabrika-owner');
      assert.equal(merged[1].raw.linkedOsmId,undefined);
      assert.ok(!merged[1].photos.some(photo=>photo.includes('fabrika-courtyard')));
    });
    await t.test('an exact native/official address match deduplicates, a different branch or indoor collection stays separate',async()=>{
      const official=await getImportedPlace('directory_british_university_tbilisi');
      const native={...official,id:'native_british_university',raw:{source:'geohub'},reviewCount:7};
      assert.deepEqual(mergeImportedPlaces([native],[official]).map(place=>place.id),[native.id]);
      const otherBranch={...official,id:'directory_other_branch',lat:official.lat+0.01};
      assert.deepEqual(mergeImportedPlaces([native],[official,otherBranch]).map(place=>place.id),[native.id,otherBranch.id]);
      const library=await getImportedPlace('directory_nplg_italian_library');
      const adjacentCollection=await getImportedPlace('directory_nplg_ukrainian_library');
      assert.equal(library.lat,adjacentCollection.lat);assert.equal(library.lng,adjacentCollection.lng);
      assert.deepEqual(mergeImportedPlaces([library],[adjacentCollection]).map(place=>place.id),[library.id,adjacentCollection.id]);
    });
    assert.ok(requests.some(request=>request.url.includes('/search-index-')),'exercise the real compact-index payload');
    assert.ok(requests.every(request=>request.options.credentials==='omit'));
  } finally {globalThis.fetch=originalFetch;}
});
