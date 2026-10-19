import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSourceCatalog, sourceHttpsUrl, readSourceCatalogFile, loadPlaceSourceCatalogs } from '../src/data/sourceCatalogs.js';
import { sourceCatalogPriceLabel } from '../src/lib/sourceCatalogPresentation.js';

test('variable-price products never advertise a zero base as free, and weighed goods specify units', () => {
  assert.equal(sourceCatalogPriceLabel({priceMinor:0,priceType:'base-with-required-options'}),'ფასი არჩევანზეა დამოკიდებული');
  assert.equal(sourceCatalogPriceLabel({priceMinor:0,currency:'GEL'}),'0 ₾');
  assert.equal(sourceCatalogPriceLabel({priceMinor:1500,sellByWeight:{pricePerKgMinor:3000},currency:'GEL'}),'30 ₾ / კგ');
  assert.equal(sourceCatalogPriceLabel({priceMinor:null,sellByWeight:{pricePerKgMinor:3000},currency:'GEL'}),'ფასი დასაზუსტებელია');
});

test('source catalogs reject a cross-branch payload and unsafe sources', () => {
  const catalog = {version:1,placeId:'osm_node_1',sourceUrl:'https://wolt.com/venue/example',items:[]};
  assert.throws(()=>normalizeSourceCatalog(catalog,'osm_node_2'));
  assert.throws(()=>normalizeSourceCatalog({...catalog,sourceUrl:'javascript:alert(1)'},'osm_node_1'));
  assert.equal(sourceHttpsUrl('https://user:secret@example.com/picture.jpg'),'');
});

test('missing, invalid and expired prices stay unknown, source photos stay safe', () => {
  const catalog={version:1,placeId:'osm_node_1',sourceUrl:'https://example.com',items:[
    {id:'a',name:'A',kind:'dish',priceMinor:null,imageUrl:'javascript:alert(1)'},
    {id:'b',name:'B',kind:'dish',priceMinor:850,imageUrl:'https://example.com/dish.jpg'},
    {id:'c',name:'C',kind:'dish',priceMinor:8.5},
    {id:'b',name:'Duplicate',kind:'dish',priceMinor:100},
  ]};
  const result=normalizeSourceCatalog(catalog,'osm_node_1');
  assert.equal(result.items.length,3);
  assert.deepEqual(result.items.map(item=>item.priceMinor),[null,850,null]);
  assert.equal(result.items[0].imageUrl,'');
  assert.equal(result.items[1].imageUrl,'https://example.com/dish.jpg');
  assert.ok(normalizeSourceCatalog({...catalog,freshnessUntilMs:1},'osm_node_1').items.every(item=>item.priceMinor===null));
});

test('catalog data cannot escape the public directory', async () => {
  for (const file of ['../private.json','https://evil.example/catalog.json','/private.json','a/../private.json']) {
    await assert.rejects(readSourceCatalogFile(file));
  }
});

test('one unavailable source does not hide another source, service items remain branch scoped', async () => {
  const original=global.fetch;
  const requests=[];
  global.fetch=async (url,options)=>{
    requests.push({url,options});
    if (url==='/catalog-data/index.json') throw new Error('temporary outage');
    const body=url.endsWith('services-index.json') ? {version:1,sourceCheckedAt:'2026-10-19',places:{osm_node_99:{files:['services-test-abcdef123456.json']}}}
      : {version:1,provider:{id:'test',name:'Source'},items:[
        {id:'same',title:'Confirmed service',placeIds:['osm_node_99'],sourceUrl:'https://example.com/services',sourceUrlsByPlace:{osm_node_99:'https://example.com/branches/99'},coverage:'partial',priceMinor:1500,categoryId:'repair'},
        {id:'other',title:'Different branch',placeIds:['osm_node_88'],sourceUrl:'https://example.com/services',priceMinor:2000},
      ]};
    return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
  };
  try {
    const result=await loadPlaceSourceCatalogs({id:'osm_node_99'});
    assert.equal(result.failed,true);
    assert.equal(result.catalogs.length,1);
    assert.deepEqual(result.catalogs[0].items.map(item=>item.name),['Confirmed service']);
    assert.equal(result.catalogs[0].status,'partial');
    assert.equal(result.catalogs[0].items[0].sourceUrl,'https://example.com/branches/99');
    assert.equal(result.catalogs[0].sourceUrl,'https://example.com/branches/99');
    assert.ok(requests.every(request=>request.options.credentials==='omit'));
  } finally {global.fetch=original;}
});
