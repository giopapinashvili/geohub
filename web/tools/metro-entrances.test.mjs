import test from 'node:test';
import assert from 'node:assert/strict';
import { linkMetroEntrances } from './metro-entrances.mjs';
import { markerPriority } from '../src/lib/mapMarkerPolicy.js';
import { matchesPlaceCategory } from '../src/lib/placeTaxonomy.js';
import { readFile } from 'node:fs/promises';

test('metro names and links come from stop-area members, not the nearest station', () => {
  const places = [
    {id:'osm_node_1',name:'ნაძალადევი',category:'metro',lat:41.73,lng:44.79,aliases:['Nadzaladevi'],raw:{}},
    {id:'osm_node_2',name:'მეტროს შესასვლელი',category:'metro-entrance',lat:41.734,lng:44.792,raw:{}},
    {id:'osm_node_3',name:'Other',category:'metro',lat:41.734,lng:44.7921,raw:{}},
    {id:'osm_node_4',name:'Unnamed',category:'metro-entrance',lat:41.7341,lng:44.792,raw:{}},
  ];
  const elements = [{type:'relation',id:10,tags:{public_transport:'stop_area',name:'ნაძალადევი'},members:[{type:'node',id:1},{type:'node',id:2}]}];
  const result=linkMetroEntrances(places,elements);
  assert.equal(places[1].name,'ნაძალადევი');
  assert.equal(places[1].lat,41.734);
  assert.deepEqual(places[1].raw.metroStationIds,['osm_node_1']);
  assert.ok(places[1].aliases.includes('Nadzaladevi'));
  assert.equal(places[0].raw.mapHidden,true);
  assert.equal(places[0].lat,41.73);
  assert.equal(places[0].raw.mapPlaceId,'osm_node_2');
  assert.equal(places[3].name,'Unnamed');
  assert.deepEqual(result.unresolvedEntrances,['osm_node_4']);
  assert.equal(markerPriority(places[1]).minZoom,11);
  assert.equal(matchesPlaceCategory(places[1],'metro'),true);
});

test('shared entrances retain all linked stations and distinct entrance coordinates', () => {
  const places=[{id:'osm_node_1',name:'A',category:'metro',raw:{}},{id:'osm_node_2',name:'B',category:'metro',raw:{}},
    {id:'osm_node_3',name:'Entrance',category:'metro-entrance',lat:41.7,lng:44.8,raw:{}}];
  const elements=[1,2].map(id=>({type:'relation',id,tags:{public_transport:'stop_area'},members:[{type:'node',id},{type:'node',id:3}]}));
  linkMetroEntrances(places,elements);
  assert.equal(places[2].name,'A / B');
  assert.deepEqual(places[2].raw.metroStationIds,['osm_node_1','osm_node_2']);
  assert.equal(places[2].lng,44.8);
});

test('published metro points are all named entries, including Nadzaladevi', async () => {
  const folder=new URL('../public/place-data/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
  const places=(await Promise.all(manifest.shards.map(shard=>readFile(new URL(shard.file,folder),'utf8').then(JSON.parse)))).flat();
  const entries=places.filter(place=>place.category==='metro-entrance');
  const stations=places.filter(place=>place.category==='metro');
  assert.ok(entries.length>=48);
  assert.ok(entries.every(place=>place.name!=='მეტროს შესასვლელი' && place.raw.metroStationIds?.length && place.raw.metroNameSourceUrls?.length));
  assert.ok(stations.every(place=>place.raw.mapHidden && entries.some(entry=>entry.id===place.raw.mapPlaceId)));
  const target=entries.find(place=>place.id==='osm_node_1452387939');
  assert.equal(target.name,'ნაძალადევი');
  assert.equal(target.lat,41.7326229);
  assert.equal(target.lng,44.7970003);
  assert.deepEqual(stations.find(place=>place.id==='osm_node_289383777').raw.mapCoordinates,{lat:target.lat,lng:target.lng});
  const overview=JSON.parse(await readFile(new URL(manifest.overview.file,folder),'utf8'));
  assert.ok(!overview.some(place=>place.category==='metro'));
  assert.ok(entries.every(entry=>overview.some(place=>place.id===entry.id)));
});
