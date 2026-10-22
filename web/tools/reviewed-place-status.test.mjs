import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyReviewedPlaceStatus, isPlaceLocationHeld, REVIEWED_PLACE_STATUS } from '../src/lib/reviewedPlaceStatus.js';
import { readDestinationCoordinates } from '../src/lib/coordinates.js';
import { mergeImportedPlaces } from '../src/data/importedPlaces.js';
import { normalizeOsmPlace } from './import-tbilisi-osm.mjs';
import { createDirectoryRecords } from './source-directory-policy.mjs';
import { catalogResult } from '../src/lib/catalogDiscovery.js';

test('disputed source IDs remain accessible records but cannot supply directions or discovery points', () => {
  const old={id:'osm_node_11891519969',name:'Auto parts',lat:41.7336629,lng:44.7971219,creatorId:'owner',raw:{photoCredits:[{url:'photo'}]}};
  const held=applyReviewedPlaceStatus(old);
  assert.equal(held.id,old.id);assert.equal(held.creatorId,'owner');
  assert.deepEqual(held.raw.photoCredits,old.raw.photoCredits);
  assert.equal(held.raw.mapHidden,true);assert.equal(held.raw.locationReview.status,'needs-review');
  assert.equal(readDestinationCoordinates(old),null,'cached records are held by exact ID too');
  assert.equal(readDestinationCoordinates(held),null);
  assert.deepEqual(mergeImportedPlaces([old],[]),[]);
  assert.deepEqual(mergeImportedPlaces([], [old]),[]);
  assert.equal(old.raw.mapHidden,undefined,'input is never mutated');
  assert.equal(isPlaceLocationHeld({id:'native',raw:{linkedOsmId:old.id}}),true);
  assert.equal(isPlaceLocationHeld({id:'some-other-shop',name:old.name,lat:old.lat,lng:old.lng}),false,'same name/proximity does not quarantine another identity');
});

test('metro platform redirects remain valid and old timestamps never imply closure', () => {
  const metro={category:'metro',lat:41.7,lng:44.8,raw:{mapHidden:true,mapPlaceId:'entrance',mapCoordinates:{lat:41.71,lng:44.81}}};
  assert.deepEqual(readDestinationCoordinates(metro),metro.raw.mapCoordinates);
  const old={id:'osm_node_111',lat:41.7,lng:44.8,raw:{sourceUpdatedAt:'2010-01-01',tags:{check_date:'2010-01-01'}}};
  assert.equal(applyReviewedPlaceStatus(old),old);assert.equal(isPlaceLocationHeld(old),false);
});

test('exact address correction preserves original coordinates/contact and is idempotent', () => {
  const before={id:'osm_node_12518762942',name:'Auto Import Georgia',lat:41.7322303,lng:44.7979043,address:'ეროსი მანჯგალაძის ქუჩა 88',raw:{website:'https://aig.com.ge/',openingHours:'old'}};
  const after=applyReviewedPlaceStatus(before);
  assert.deepEqual({lat:after.lat,lng:after.lng},{lat:41.7254419,lng:44.7804421});
  assert.equal(after.raw.coordinateAccuracy,'approximate-center');
  assert.equal(after.raw.originalReviewedAddress,before.address);
  assert.deepEqual(after.raw.originalReviewedCoordinates,{lat:before.lat,lng:before.lng});
  assert.equal(after.raw.originalReviewedFields.website,before.raw.website);
  assert.deepEqual(applyReviewedPlaceStatus(after),after);
  assert.equal(after.raw.coordinateEvidenceUrl,'https://www.aigcars.ge/კონტაქტი');
});

test('normalization retains field-specific dates and relocation evidence separately from source edit time', () => {
  const p=normalizeOsmPlace({type:'node',id:123,lat:41.7,lon:44.8,timestamp:'2026-10-19',tags:{shop:'car_wash',check_date:'2024-01-01','check_date:opening_hours':'2025-03-04','survey:date':'2023-02-03',note:'They are moving to another address',fixme:'Check location'}});
  assert.equal(p.category,'car-wash');assert.equal(p.raw.sourceUpdatedAt,'2026-10-19');
  assert.equal(p.raw.tags['check_date:opening_hours'],'2025-03-04');assert.equal(p.raw.tags['survey:date'],'2023-02-03');
  assert.equal(p.raw.tags.fixme,'Check location');assert.equal(p.raw.tags.check_date,'2024-01-01');
  assert.equal(p.raw.sourceNote,'They are moving to another address');
});

test('an undated official source cannot acquire a fabricated review date', () => {
  const [p]=createDirectoryRecords([],[{id:'directory_fixture',name:'Fixture',category:'office',lat:41.7,lng:44.8,sourceUrl:'https://example.com',sourceCertainty:'official-directory',coordinateAccuracy:'source-point'}]);
  assert.equal(p.raw.sourceCheckedAt,null);assert.equal(p.raw.editorial.reviewedAt,null);
});

test('owner catalog results cannot revive explicitly held linked source locations', () => {
  const item={id:'i',title:'item',type:'product',status:'published',isDemo:false,available:true,businessId:'b',allBranches:true};
  const b={id:'b',name:'Business',raw:{placeId:'osm_node_11891519969',lat:41.7,lng:44.8}};
  assert.equal(catalogResult(item,b,null),null);
});

test('published data keeps every reviewed page while omitting held pins and search entries', async () => {
  const root=new URL('../public/place-data/',import.meta.url);
  const m=JSON.parse(await readFile(new URL('manifest.json',root)));
  const records=(await Promise.all(m.shards.map(s=>readFile(new URL(s.file,root)).then(JSON.parse)))).flat();
  const byId=new Map(records.map(p=>[p.id,p]));
  const overview=JSON.parse(await readFile(new URL(m.overview.file,root)));
  const search=JSON.parse(await readFile(new URL(m.search.file,root)));
  for(const [id,review] of Object.entries(REVIEWED_PLACE_STATUS)) {
    const place=byId.get(id);assert.ok(place,`page retained: ${id}`);
    assert.equal(place.raw.locationReview.status,review.status);
    if(!review.hideFromMap)continue;
    assert.equal(place.raw.mapHidden,true);assert.ok(!overview.some(p=>p.id===id));
    const compact=id.replace('osm_node_','n').replace('osm_way_','w').replace('osm_relation_','r');
    assert.ok(!search.rows.some(row=>row[0]===compact),`held search point ${id}`);
  }
});
