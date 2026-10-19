import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PLACE_TAXONOMY, categoryFromOsm, facetsFromOsm, canonicalCategory, matchesPlaceCategory } from '../src/lib/placeTaxonomy.js';
import { normalizeOsmPlace, createSearchRows, packSearchRows, createVerifiedSupplement, applyVerifiedSiteAnchors } from './import-tbilisi-osm.mjs';
import { isRelevantOsmElement } from './place-extraction-policy.mjs';
import { VERIFIED_PLACE_SUPPLEMENT, VERIFIED_SITE_ANCHORS } from './verified-place-supplement.mjs';
import { ICONS } from '../src/ui/icons.js';
import { readCoordinates } from '../src/lib/coordinates.js';

test('taxonomy covers requested infrastructure and legacy parent filters without missing icons', () => {
  assert.equal(new Set(PLACE_TAXONOMY.map(c=>c.id)).size, PLACE_TAXONOMY.length);
  assert.deepEqual(PLACE_TAXONOMY.filter(c=>!ICONS[c.icon]),[]);
  for(const id of ['metro-entrance','crypto-atm','payment-terminal','warehouse','wallpaper','drinking-water','fountain','gaming','tutoring','car-repair','pharmacy','mall']) assert.ok(PLACE_TAXONOMY.some(c=>c.id===id));
  assert.equal(canonicalCategory('restaurants'),'restaurant');
  assert.equal(matchesPlaceCategory({category:'cafe'},'food'),true);
  assert.equal(matchesPlaceCategory({category:'bank'},'food'),false);
  assert.equal(categoryFromOsm({railway:'subway_entrance',amenity:'shelter'}),'metro-entrance');
  assert.equal(categoryFromOsm({amenity:'atm','currency:BTC':'yes'}),'crypto-atm');
  assert.equal(categoryFromOsm({amenity:'fountain'}),'fountain');
});

test('diet/access facets require explicit source facts and never invent prices or prep time', () => {
  const result=facetsFromOsm({'diet:vegan':'yes','diet:halal':'no','diet:vegetarian':'only',wheelchair:'limited',outdoor_seating:'yes'});
  assert.deepEqual(result.diets,['vegan','vegetarian']);
  assert.equal(result.wheelchair,'limited');
  assert.equal(result.outdoorSeating,true);
  assert.deepEqual(facetsFromOsm({}),{});
  assert.equal(result.price,undefined);
  assert.equal(result.preparationMinutes,undefined);
});

test('normalization preserves stable IDs and unknown facts, labels area centers and skips closed records', () => {
  const basic={type:'node',id:23,lat:41.7,lon:44.8,tags:{amenity:'drinking_water'}};
  const point=normalizeOsmPlace(basic);
  assert.equal(point.id,'osm_node_23');
  assert.equal(point.name,'სასმელი წყალი');
  assert.equal(point.raw.named,false);
  assert.equal(point.city,undefined);
  assert.equal(point.image,undefined);
  assert.equal(point.rating,undefined);
  assert.equal(point.raw.coordinateAccuracy,'source-point');
  const area=normalizeOsmPlace({type:'way',id:24,center:{lat:41.71,lon:44.81},tags:{shop:'mall',name:'მოლი'}});
  assert.equal(area.raw.coordinateAccuracy,'approximate-center');
  assert.equal(normalizeOsmPlace({...basic,tags:{shop:'vacant'}}),null);
  assert.equal(normalizeOsmPlace({...basic,lat:100}),null);
});

test('address search retains number and language aliases without inventing street names', () => {
  const element={type:'node',id:12,lat:41.7,lon:44.8,tags:{'addr:street':'რუსთაველის გამზირი','addr:street:en':'Rustaveli Avenue','addr:housenumber':'12ა'}};
  const result=createSearchRows([], [element,{...element,id:13,tags:{'addr:housenumber':'99'}}]);
  assert.equal(result.addressCount,1);
  assert.equal(result.rows[0][1],'რუსთაველის გამზირი 12ა');
  assert.deepEqual(result.rows[0][2],['Rustaveli Avenue 12ა']);
  assert.equal(result.rows[0][7],'address');
});

test('published snapshot shards are complete, attributed and all directory links resolve', async () => {
  const folder=new URL('../public/place-data/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
  const lookup=JSON.parse(await readFile(new URL(manifest.lookup.file,folder),'utf8'));
  const records=(await Promise.all(manifest.shards.map(s=>readFile(new URL(s.file,folder),'utf8').then(JSON.parse)))).flat();
  const ids=new Set(records.map(p=>p.id));
  assert.equal(records.length,manifest.totalPlaces);
  assert.equal(ids.size,records.length);
  assert.equal(Object.keys(lookup).length,records.length);
  assert.ok(manifest.source.sourceDate && manifest.attribution.includes('OpenStreetMap'));
  assert.equal(manifest.license,'ODbL-1.0');
  assert.ok(records.every(p=>readCoordinates(p)));
  assert.ok(records.every(p=>p.id.startsWith('osm_') ? p.raw.sourceUrl.startsWith('https://www.openstreetmap.org/') : p.raw.source==='official-directory' && p.raw.sourceCertainty && manifest.officialSources.includes(p.raw.sourceUrl)));
  assert.equal(records.filter(p=>p.id.startsWith('directory_')).length,manifest.supplementalPlaceCount);
  assert.equal(records.filter(p=>p.raw.originalSourceCenter).length,manifest.coordinateCorrections);
  for(const place of records.filter(p=>p.raw.parentPlaceId)) assert.ok(ids.has(place.raw.parentPlaceId),`Missing indoor parent ${place.raw.parentPlaceId}`);
  assert.ok(records.every(p=>!p.photos && !p.rating && !p.price));
  for(const mall of records.filter(p=>p.raw.tenantIds)) for(const id of mall.raw.tenantIds) assert.ok(ids.has(id),`Missing mall tenant ${id}`);
  const sourceIds=new Set();
  for(const shard of manifest.shards) {
    assert.ok(shard.bytes<25*1024*1024);
    for(const record of JSON.parse(await readFile(new URL(shard.file,folder),'utf8'))) {assert.equal(lookup[record.id],shard.key);sourceIds.add(record.id);}
  }
  assert.equal(sourceIds.size,records.length);
});

test('coverage extraction includes useful structures without treating every house as a business', () => {
  for(const [tags,category] of [
    [{building:'office'},'office-building'],[{building:'retail'},'retail-building'],
    [{building:'commercial'},'commercial-building'],[{building:'college'},'college'],
    [{building:'library'},'library'],[{education:'language_school'},'language-school'],
    [{landuse:'education'},'education-campus'],[{building:'hotel'},'lodging-building'],
  ]) {
    assert.ok(isRelevantOsmElement(tags));
    assert.equal(categoryFromOsm(tags),category);
  }
  assert.equal(isRelevantOsmElement({building:'apartments'}),false);
  assert.equal(categoryFromOsm({building:'apartments'}),null);
  assert.equal(categoryFromOsm({building:'yes',name:'University apartments'}),null,'a university-like name does not prove education use');
  assert.equal(categoryFromOsm({building:'hotel',tourism:'hotel'}),'hotel','explicit current use wins over building form');
  const former=normalizeOsmPlace({type:'way',id:1,center:{lat:41.7,lon:44.8},tags:{building:'public','disused:amenity':'community_centre',note:'Not operating; under reconstruction',opening_hours:'24/7'}});
  assert.equal(former.raw.recordKind,'mapped-building');
  assert.equal(former.raw.operatingStatus,'source-reports-inactive');
  assert.equal(former.raw.openingHours,undefined);
  assert.equal(former.raw.tags.opening_hours,undefined);
  assert.equal(former.raw.formerOpeningHours,'24/7');
  assert.equal(categoryFromOsm({education:'school','disused:amenity':'school'}),'education-campus');
  assert.equal(former.raw.formerUse['disused:amenity'],'community_centre');
  assert.equal(former.raw.sourceNote,'Not operating; under reconstruction');
});

test('official directory coordinates retain evidence and campus anchors preserve original centers', () => {
  const elements=[{type:'way',id:123,center:{lat:41.71,lon:44.81},tags:{building:'university'}}];
  const definition={id:'directory_test_university',name:'Test University',category:'university',address:'Example 1',coordinateSourceId:'osm_way_123',sourceUrl:'https://university.example/contact',sourceCertainty:'official-address-matched-osm-building',coordinateAccuracy:'approximate-center',coordinateNote:'Building center'};
  const [record]=createVerifiedSupplement(elements,[definition]);
  assert.equal(record.lat,41.71);
  assert.equal(record.raw.coordinateSourceUrl,'https://www.openstreetmap.org/way/123');
  assert.equal(record.raw.source,'official-directory');
  assert.equal(record.rating,undefined);
  assert.equal(record.price,undefined);
  assert.equal(record.photos,undefined);
  assert.throws(()=>createVerifiedSupplement([],[definition]),/coordinate evidence/);
  const place={id:'osm_relation_1',lat:41.8,lng:44.9,raw:{}};
  assert.equal(applyVerifiedSiteAnchors([place],elements,[{id:place.id,anchorId:'osm_way_123',address:'Example 1',sourceUrl:definition.sourceUrl}]),1);
  assert.equal(place.id,'osm_relation_1');
  assert.equal(place.lat,41.71);
  assert.deepEqual(place.raw.originalSourceCenter,{lat:41.8,lng:44.9});
  assert.equal(place.raw.coordinateAccuracy,'approximate-center');
  const packed=packSearchRows(createSearchRows([record],[]).rows);
  assert.equal(packed.rows[0][0],record.id,'directory IDs survive the compact index');
});

test('all reviewed official additions and six corrected campuses are in the published data', async () => {
  const folder=new URL('../public/place-data/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
  const records=(await Promise.all(manifest.shards.map(s=>readFile(new URL(s.file,folder),'utf8').then(JSON.parse)))).flat();
  const byId=new Map(records.map(record=>[record.id,record]));
  for(const definition of VERIFIED_PLACE_SUPPLEMENT) {
    const record=byId.get(definition.id);
    assert.ok(record,definition.id);
    assert.equal(record.raw.sourceUrl,definition.sourceUrl);
    assert.equal(record.raw.sourceCertainty,definition.sourceCertainty);
    assert.equal(record.category,definition.category);
  }
  for(const anchor of VERIFIED_SITE_ANCHORS) {
    const record=byId.get(anchor.id);
    assert.equal(record.raw.coordinateSourceId,anchor.anchorId);
    assert.equal(record.raw.coordinateEvidenceUrl,anchor.sourceUrl);
    assert.notDeepEqual({lat:record.lat,lng:record.lng},record.raw.originalSourceCenter);
  }
});

test('loader fetches one shard for a page, keeps unknown IDs null, and deduplicates conservatively', async () => {
  const originalFetch=globalThis.fetch;
  const requested=[];
  globalThis.fetch=async url=>{
    requested.push(url);
    return {ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>JSON.parse(await readFile(join(process.cwd(),'web/public',url),'utf8'))};
  };
  try {
    const {getImportedPlace,loadImportedPlaces,loadImportedSearchIndex,mergeImportedPlaces}=await import('../src/data/importedPlaces.js');
    const place=await getImportedPlace('osm_way_38424053');
    assert.ok(place && place.category==='mall');
    assert.equal(place.raw.source,'openstreetmap');
    assert.equal(requested.filter(url=>/places-/.test(url)).length,1);
    assert.equal(await getImportedPlace('../../invalid'),null);
    const overview=await loadImportedPlaces(null,{zoom:10});
    assert.ok(overview.places.length<=500);
    assert.equal(overview.coverage.mode,'overview');
    const index=await loadImportedSearchIndex();
    assert.ok(index.some(row=>row.kind==='address' && row.address && row.name));
    assert.ok(index.some(row=>row.kind==='place' && row.facets.diets?.includes('vegan')));
    assert.ok(index.every(row=>row.id && row.name && readCoordinates(row)));
    const native={id:'native1',name:'კაფე',category:'cafe',address:'ტესტის ქუჩა 1',lat:41.7,lng:44.8};
    const imported={...native,id:'osm_node_1',raw:{named:true}};
    assert.deepEqual(mergeImportedPlaces([native],[imported]).map(p=>p.id),['native1']);
    assert.equal(mergeImportedPlaces([native],[{...imported,address:''}]).length,2,'missing address is not enough to merge');
    assert.equal(mergeImportedPlaces([native],[{...imported,raw:{named:false}}]).length,2,'anonymous category name is not a duplicate');
    assert.equal(mergeImportedPlaces([native],[{...imported,lat:41.8}]).length,2,'another branch stays separate');
  } finally {globalThis.fetch=originalFetch;}
});
