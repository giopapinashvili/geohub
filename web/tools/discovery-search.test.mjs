import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch, rankRecords, editDistance } from '../src/lib/discoverySearch.js';
const places = [
 {id:'fabrika',name:'ფაბრიკა',address:'ეგნატე ნინოშვილის ქუჩა 8',aliases:['Fabrika']},
 {id:'spar',name:'სპარი',address:'რუსთაველის გამზირი 12',aliases:['SPAR']},
 {id:'spar2',name:'სპარი',address:'რუსთაველის გამზირი 123',aliases:['SPAR']},
 {id:'stamba',name:'სტამბა',address:'მერაბ კოსტავას ქუჩა 14',aliases:['Stamba']},
];
test('Georgian and Latin Georgian resolve to same canonical key',()=>{assert.equal(normalizeSearch('ფაბრიკა'),'fabrika');assert.equal(rankRecords(places,'FABRIKA')[0].id,'fabrika');assert.equal(rankRecords(places,'ფაბრიკა')[0].id,'fabrika');});
test('typos and transposed letters return honest fuzzy matches',()=>{assert.equal(editDistance('fabrika','fabrkia'),1);const [r]=rankRecords(places,'fabirka');assert.equal(r.id,'fabrika');assert.equal(r.searchMatch,'fuzzy');});
test('street transliteration and house number work, never choose12for123',()=>{assert.deepEqual(rankRecords(places,'rustavelis12').map(r=>r.id),['spar']);assert.deepEqual(rankRecords(places,'rustavelis 12').map(r=>r.id),['spar']);assert.deepEqual(rankRecords(places,'რუსთაველის ქუჩა 123').map(r=>r.id),['spar2']);});
test('unknown queries do not fabricate a match; exact ranks first',()=>{assert.equal(rankRecords(places,'totallyunrelated').length,0);assert.equal(rankRecords(places,'stamba')[0].searchMatch,'exact');});
