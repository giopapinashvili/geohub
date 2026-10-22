import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPlaceFreshness,dateAge,lifecycleEvidence,exactDuplicateCandidate} from './audit-place-freshness.mjs';

const now=Date.parse('2026-10-19T12:00:00Z');
const manifest={datasetId:'fixture',generatedAt:'2026-10-19T11:00:00Z',source:{sourceDate:'2026-10-17',bbox:[44.6,41.58,45.05,41.91]}};
const place=(id,name='Cafe',extra={})=>({id,name,category:'cafe',lat:41.7,lng:44.8,raw:{named:true,coordinateAccuracy:'source-point',sourceUpdatedAt:'2026-10-18T12:00:00Z',tags:{amenity:'cafe'}},...extra});

test('audit distinguishes old checks from recent edits and never treats retrieval as a survey',()=>{
  const p=place('osm_node_1');const result=auditPlaceFreshness({places:[p],elements:[{type:'node',id:1,lat:p.lat,lon:p.lng,timestamp:p.raw.sourceUpdatedAt,tags:{amenity:'cafe',check_date:'2021-02-01'}}],manifest,now});
  assert.equal(result.summary.osmObjectEditAge['within-90-days'],1);
  assert.equal(result.summary.osmExplicitCheckAge['over-3-years'],1);
  assert.equal(result.summary.onsiteSurveyDatePresent,0);
  assert.equal(result.issues['recent-edit-with-old-explicit-check'].length,1);
  assert.equal(dateAge('',now).state,'missing');assert.equal(dateAge('2027-01-01',now).state,'future');
});

test('closure markers and relocation notes survive the audit even when the normalizer dropped them',()=>{
  const result=auditPlaceFreshness({places:[place('osm_node_1')],elements:[{type:'node',id:1,lat:41.7,lon:44.8,tags:{amenity:'cafe',closed:'yes',note:'moved to another street', 'check_date:opening_hours':'2020-01-01'}}],manifest,now});
  const issue=result.issues['inactive-or-relocated-evidence-not-surfaced'][0];
  assert.ok(issue.evidence.some(e=>e.kind==='explicit-inactive-flag'));
  assert.ok(issue.evidence.some(e=>e.kind==='closure-or-relocation-note'));
  assert.equal(result.issues['source-evidence-dropped-by-normalizer'][0].evidence['check_date:opening_hours'],'2020-01-01');
  assert.equal(lifecycleEvidence({shop:'alcohol','disused:shop':'books'})[0].kind,'former-use-with-different-current-use');
  assert.equal(lifecycleEvidence({healthcare:'pharmacy','disused:amenity':'pharmacy'})[0].kind,'active-and-inactive-same-use');
  assert.equal(lifecycleEvidence({opening_hours:'Mo-Fr 09:00-18:00; PH closed'}).length,0,'a closed holiday is not permanent closure');
});

test('same-use expired source can conflict with a new directory ID without automatic closure',()=>{
  const current=place('directory_test_cafe','Test Cafe',{raw:{source:'merchant-directory',sourceUrl:'https://example.org/cafe',sourceCheckedAt:'2026-10-19',named:true,coordinateAccuracy:'source-point'}});
  const result=auditPlaceFreshness({places:[current],elements:[{type:'node',id:2,lat:41.70001,lon:44.8,tags:{name:'Test Cafe','disused:amenity':'cafe'}}],manifest,now});
  assert.equal(result.issues['other-source-near-excluded-inactive-object'].length,1);
  assert.equal(result.issues['other-source-near-excluded-inactive-object'][0].certainty,'cross-source-review-required-not-automatic-closure');
  assert.equal(result.records[0].surveyDate.state,'missing');
  assert.equal(current.raw.operatingStatus,undefined,'audit must not mutate operating state');
});

test('duplicate candidates require exact category/name and reject separate floors or unknown coordinates',()=>{
  const a=place('osm_node_1'),b=place('osm_node_2');assert.equal(exactDuplicateCandidate(a,b),true);
  assert.equal(exactDuplicateCandidate(a,{...b,category:'restaurant'}),false);
  assert.equal(exactDuplicateCandidate({...a,facets:{level:'1'}},{...b,facets:{level:'2'}}),false);
  assert.equal(exactDuplicateCandidate(a,{...b,lat:null}),false);
  assert.equal(exactDuplicateCandidate(a,{...b,raw:{named:false}}),false);
});

test('source coordinate and retained nonempty contact conflicts are reported without choosing a winner',()=>{
  const p=place('osm_node_1','Test',{raw:{named:true,phone:'+995 555 111 111',openingHours:'09:00-18:00',officialDirectory:[{id:'directory_test_1',sourceKind:'official-directory',sourceUrl:'https://example.org/branches',checkedAt:'2026-10-19',lat:41.71,lng:44.8,address:'Test street 2'}]}});
  const copy=structuredClone(p);
  const result=auditPlaceFreshness({places:[p],elements:[],definitions:[{id:'directory_test_1',phone:'+995555222222',openingHours:'10:00-17:00'}],manifest,now});
  assert.equal(result.issues['merged-directory-coordinate-disagreement'].length,1);
  assert.equal(result.issues['merged-directory-fact-disagreement'].length,2);
  assert.deepEqual(p,copy);
});
