import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {SOURCE_SERVICE_CATALOG as items} from './source-service-catalog.mjs';
import {validateSourceServiceCatalog,publishServiceCatalog} from './publish-service-catalog.mjs';

const known=new Set(items.flatMap(item=>item.placeIds));
const fixture=()=>structuredClone(items.find(item=>item.priceMinor!==null));
const sha=value=>createHash('sha256').update(value).digest('hex');

test('reviewed service catalog has complete provenance and explicit branch scope',()=>{
  assert.equal(validateSourceServiceCatalog(items,known),true);
  assert.ok(new Set(items.map(item=>item.providerId)).size>=10);
  for(const item of items){
    assert.equal(item.isDemo,false);
    assert.equal(new URL(item.sourceUrl).protocol,'https:');
    assert.equal(item.branchEvidence.length,item.placeIds.length);
    assert.deepEqual(new Set(item.branchEvidence.map(row=>row.placeId)),new Set(item.placeIds));
  }
});

test('every membership resolves in the published canonical lookup',async()=>{
  const manifest=JSON.parse(await readFile('web/public/place-data/manifest.json','utf8'));
  const lookup=JSON.parse(await readFile(join('web/public/place-data',manifest.lookup.file),'utf8'));
  assert.equal(validateSourceServiceCatalog(items,new Set(Object.keys(lookup))),true);
});

test('unknown prices remain null and observed prices have a finite validity interval',()=>{
  for(const item of items){
    if(item.priceKind==='unknown'){assert.equal(item.priceMinor,null);continue;}
    assert.ok(Number.isSafeInteger(item.priceMinor));
    assert.ok(item.freshnessUntilMs>item.observedAtMs);
    assert.ok(item.freshnessUntilMs-item.observedAtMs<=7*86400000);
  }
  const free=items.filter(item=>item.priceMinor===0);
  assert.deepEqual(free.map(item=>item.id),['service_british_council_placement']);
  assert.match(free[0].availabilityNote,/უფასო/);
  assert.ok(items.filter(item=>item.categoryId==='health').every(item=>item.priceMinor===null));
});

test('Tegeta tires and specialist hydraulic services do not leak between branches',()=>{
  const rows=items.filter(item=>item.providerId==='tegeta');
  assert.ok(rows.length>=16);
  assert.ok(!rows.some(item=>item.id==='service_tegeta_143'));
  assert.ok(rows.find(item=>item.id==='service_tegeta_107').placeIds.includes('osm_node_11854276156'));
  assert.ok(!rows.find(item=>item.id==='service_tegeta_124').placeIds.includes('osm_node_11854276156'));
  assert.ok(rows.find(item=>item.id==='service_tegeta_124').placeIds.includes('directory_tegeta_59'));
  assert.ok(!rows.some(item=>item.placeIds.includes('directory_tegeta_58')));
  assert.ok(rows.every(item=>item.scope==='branch'&&item.priceMinor===null));
});

test('EVEX branch relations are specific rather than copied to the entire chain',()=>{
  const rows=items.filter(item=>item.providerId==='evex');
  const clinics=new Set(rows.flatMap(item=>item.placeIds));
  assert.ok(clinics.size>=7);
  assert.ok(rows.some(item=>item.placeIds.length===1));
  assert.ok(rows.some(item=>item.placeIds.length>1&&item.placeIds.length<clinics.size));
  assert.ok(rows.every(item=>item.scope==='branch'&&item.branchEvidence.every(e=>/explicitly includes/.test(e.evidence))));
  assert.ok(rows.every(item=>item.coverage==='partial'));
  for(const item of rows)for(const evidence of item.branchEvidence)assert.equal(item.sourceUrlsByPlace[evidence.placeId],evidence.sourceUrl);
});

test('Amboli public selector services are explicitly passenger-car only',()=>{
  const rows=items.filter(item=>item.providerId==='amboli');
  assert.equal(rows.length,4);
  assert.ok(rows.every(item=>item.placeIds.length===10&&item.scope==='branch'&&item.priceMinor===null));
  assert.ok(rows.every(item=>item.branchEvidence.every(e=>e.evidence.includes('VehicleType=PassengerCar')&&e.evidence.includes('BranchIDHash='))));
  assert.ok(rows.every(item=>item.availabilityNote.includes('მსუბუქი ავტომობილისთვის')));
});

test('validator rejects missing evidence, unknown memberships and ambiguous money',()=>{
  const missing=fixture();missing.branchEvidence=[];
  assert.throws(()=>validateSourceServiceCatalog([missing],known),/Missing branch evidence/);
  const unknown=fixture();unknown.placeIds=['unrelated_place'];
  assert.throws(()=>validateSourceServiceCatalog([unknown],known),/Unknown canonical/);
  const money=fixture();money.priceMinor=null;money.priceKind='fixed';
  assert.throws(()=>validateSourceServiceCatalog([money],known),/Invalid service price/);
  const zero=fixture();zero.priceMinor=0;zero.priceKind='unknown';
  assert.throws(()=>validateSourceServiceCatalog([zero],known),/Invalid service price/);
  const stale=fixture();stale.freshnessUntilMs=stale.observedAtMs;
  assert.throws(()=>validateSourceServiceCatalog([stale],known),/Missing price freshness/);
  const unsafe=fixture();unsafe.sourceUrl='javascript:alert(1)';
  assert.throws(()=>validateSourceServiceCatalog([unsafe],known),/Invalid service provenance/);
  assert.throws(()=>validateSourceServiceCatalog([fixture(),fixture()],known),/Invalid\/repeated/);
});

test('publisher produces content-addressed shards and exact per-place membership counts',async(t)=>{
  const temporary=await mkdtemp(join(tmpdir(),'geohub-service-test-'));
  // This exact directory was created by this test, and must remain under the OS temp root.
  assert.equal(dirname(resolve(temporary)),resolve(tmpdir()));
  t.after(()=>rm(temporary,{recursive:true,force:true}));
  const placeData=join(temporary,'places'),output=join(temporary,'catalog');
  await mkdir(placeData);
  await writeFile(join(placeData,'manifest.json'),JSON.stringify({lookup:{file:'lookup.json'}}));
  await writeFile(join(placeData,'lookup.json'),JSON.stringify(Object.fromEntries([...known].map(id=>[id,'places.json']))));
  const index=await publishServiceCatalog({output,placeData,generatedAt:'2026-10-19T00:00:00.000Z'});
  assert.equal(index.totalItems,items.length);
  assert.equal(index.totalPlaces,known.size);
  const shards=new Map();
  for(const entry of index.files){
    const data=await readFile(join(output,entry.file));
    assert.equal(sha(data),entry.sha256);
    assert.equal(data.length,entry.bytes);
    assert.ok(entry.file.includes(entry.sha256.slice(0,12)));
    const shard=JSON.parse(data);
    assert.equal(shard.items.length,entry.count);
    assert.equal(shard.provider.id,entry.providerId);
    assert.ok(shard.items.every(item=>item.providerId===entry.providerId));
    shards.set(entry.file,shard);
  }
  for(const [placeId,entry]of Object.entries(index.places)){
    const visible=entry.files.flatMap(file=>shards.get(file).items.filter(item=>item.placeIds.includes(placeId)));
    assert.equal(visible.length,entry.count);
    assert.equal(new Set(visible.map(item=>item.id)).size,entry.count);
  }
});
