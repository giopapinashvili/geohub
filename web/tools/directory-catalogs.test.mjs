import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCatalogItem, normalizeOptionGroups, safeImageUrl, priceMinor, buildCanonicalVenueMap, flattenCategories, collectCategoryPages, catalogCategoryMembership, retryAfterMilliseconds } from './directory-catalog-policy.mjs';
import { createDirectoryCatalogSearch, rankDirectoryCatalogRows } from '../src/data/directoryCatalogSearch.js';

test('prices retain integer minor units and unknowns never become free items',()=>{
  for(const invalid of [true,false,'1',NaN,Infinity,-1,1.5,null,undefined])assert.equal(priceMinor(invalid),null);
  assert.equal(priceMinor(1899),1899);assert.equal(priceMinor(0),0);
  const item=normalizeCatalogItem({id:'a',name:'Actual unpriced item',price:true,original_price:1800},'products');
  assert.equal(item.priceMinor,null);assert.equal(item.originalPriceMinor,undefined);
  assert.equal(normalizeCatalogItem({id:'a',name:'Dish',price:2500,original_price:3000},'menu').originalPriceMinor,3000);
});
test('images are public Wolt HTTPS assets with no credentials or foreign hosts',()=>{
  assert.equal(safeImageUrl('https://imageproxy.wolt.com/assets/abc'),'https://imageproxy.wolt.com/assets/abc');
  for(const url of ['http://imageproxy.wolt.com/a','https://token@imageproxy.wolt.com/a','https://wolt.com.evil.test/a','data:image/png;base64,AA','javascript:alert(1)'])assert.equal(safeImageUrl(url),'');
});
test('option adjustments preserve source subtraction while unknown option prices remain unknown',()=>{
  const options=normalizeOptionGroups([{id:'protein',name:'Choose protein',values:[{id:'chicken',name:'Chicken instead of seafood',price:-1700},{id:'extra',name:'Extra seafood',price:500},{id:'unknown',name:'Ask for price',price:true}]}]);
  assert.deepEqual(options[0].values.map(value=>value.priceMinor),[-1700,500,null]);
  assert.equal(normalizeCatalogItem({id:'invalid',name:'No negative base price',price:-1700},'menu').priceMinor,null);
});
test('source retry-after respects both seconds and an HTTP date',()=>{
  const now=Date.parse('2026-10-19T12:00:00Z');
  assert.equal(retryAfterMilliseconds('300',now),300000);
  assert.equal(retryAfterMilliseconds('Mon, 19 Oct 2026 12:10:00 GMT',now),600000);
  for(const invalid of [null,'','nonsense','Mon, 19 Oct 2026 11:00:00 GMT'])assert.equal(retryAfterMilliseconds(invalid,now),0);
});
test('required options preserve source base-price meaning without inventing dietary or preparation claims',()=>{
  const item=normalizeCatalogItem({id:'b',name:'Combo',price:1500,fulfillment_lead_time:15,dietary_preferences:['vegan'],options:[{option_id:'size',name:'Choose size',multi_choice_config:{total_range:{min:1,max:1}}}]},'menu');
  assert.equal(item.priceType,'base-with-required-options');assert.equal(item.optionGroups[0].min,1);
  assert.equal(item.preparationMinutes,undefined);assert.deepEqual(item.dietaryTags,['vegan']);assert.equal(item.dietarySource,'publisher-declared');
  assert.equal(normalizeCatalogItem({id:'u',name:'Vegan-looking salad',price:1500},'menu').dietaryTags,undefined);
});
test('canonical identity uses final provenance and rejects conflicting branch mappings',()=>{
  const venue='0123456789abcdef01234567',ref={id:`directory_wolt_${venue}`};
  const places=[{id:'osm_node_20',raw:{officialDirectory:[ref]}}];
  assert.equal(buildCanonicalVenueMap(places).get(venue).id,'osm_node_20');
  assert.throws(()=>buildCanonicalVenueMap([...places,{id:'directory_other',raw:{officialDirectory:[ref]}}]),/Ambiguous/);
});
test('partial tree flattening visits real leaf categories and retains parent relationships',()=>{
  const categories=flattenCategories([{id:'p',name:'Parent',slug:'p',subcategories:[{id:'c',name:'Child',slug:'c',item_ids:['i']}]}]);
  assert.equal(categories[0].leaf,false);assert.equal(categories[1].parentId,'p');assert.deepEqual(categories[1].itemIds,['i']);
});
test('nested category filters include descendants through explicit source parent links',()=>{
  const categories=[{id:'food',itemIds:[]},{id:'bread',parentId:'food',itemIds:['loaf']},{id:'drinks',itemIds:['water']}];
  const membership=catalogCategoryMembership(categories);
  assert.deepEqual(membership.get('loaf'),['bread','food']);assert.deepEqual(membership.get('water'),['drinks']);
});
test('paginated catalogs merge all pages without replacing category item references',async()=>{
  const fetched=[],pages={
    '':{items:[{id:'a'}],options:[],categories:[{id:'c',item_ids:['a']}],metadata:{next_page_token:'next'}},
    next:{items:[{id:'b'}],options:[],categories:[{id:'c',item_ids:['b']}],metadata:{next_page_token:null}}
  };
  const result=await collectCategoryPages({id:'c',name:'Category'},async token=>{fetched.push(token);return pages[token];});
  assert.deepEqual(fetched,['','next']);assert.equal(result.issue,'');assert.equal(result.pageCount,2);assert.deepEqual(result.categories[0].itemIds,['a','b']);
});
test('failed and repeating pagination retain partial data with explicit failure evidence',async()=>{
  const page={items:[{id:'a'}],options:[],categories:[{id:'c',item_ids:['a']}],metadata:{next_page_token:'loop'}};
  const loop=await collectCategoryPages({id:'c'},async()=>page);assert.equal(loop.issue,'repeated-pagination-token');assert.equal(loop.pageCount,2);
  const failed=await collectCategoryPages({id:'c'},async token=>{if(token)throw new Error('http-503');return page;});
  assert.equal(failed.issue,'http-503');assert.equal(failed.items.length,1);
});
test('malformed continuation metadata never silently marks a catalog complete',async()=>{
  for(const next_page_token of [undefined,0,false,{}]){
    const result=await collectCategoryPages({id:'c'},async()=>({items:[{id:'a'}],categories:[{id:'c',item_ids:['a']}],metadata:{next_page_token}}));
    assert.equal(result.issue,'pagination-token-format');assert.equal(result.items.length,1);
  }
});

function fixture({expired=false,declaredDiet=false}={}){
  const venue='v1',placeId='osm_node_20',itemId='i1';
  const data={
    'index.json':{version:1,venues:{v1:{placeId,file:'venues/v1.json'}},search:{manifest:'search/manifest.json'}},
    'search/manifest.json':{version:1,words:['khinkali','sakonlis'],buckets:{kh:[{file:'search/kh.json',count:1,bytes:200}],...(declaredDiet?{'diet:vegan':[{file:'search/kh.json',count:1,bytes:200}]}:{})}},
    'search/kh.json':{version:1,rows:[[declaredDiet?'ვეგანური ხინკალი':'საქონლის ხინკალი','dish',[[venue,itemId]],[],declaredDiet?['vegan']:[]]]},
    'venues/v1.json':{version:1,venueId:venue,placeId,sourceUrl:'https://wolt.com/ka/geo/tbilisi/restaurant/example',fetchedAt:'2026-10-19T00:00:00Z',freshnessUntilMs:expired?0:Date.now()+86400000,priceContext:'delivery-marketplace',items:[{id:itemId,name:declaredDiet?'ვეგანური ხინკალი':'საქონლის ხინკალი',kind:'dish',priceMinor:3000,currency:'GEL',imageUrl:'https://imageproxy.wolt.com/a',...(declaredDiet?{dietaryTags:['vegan'],dietarySource:'publisher-declared'}:{})}],categories:[]}
  };
  const fetched=[],loaded=[];
  return {fetched,loaded,search:createDirectoryCatalogSearch({readFile:async file=>{fetched.push(file);assert.ok(data[file],file);return data[file];},loadPlace:async id=>{loaded.push(id);return {id,name:'Exact branch',category:'restaurant',lat:41.7,lng:44.8,facets:{delivery:true}};}})};
}
test('Georgian, transliterated and misspelled dish search resolves the exact branch and item',async()=>{
  for(const term of ['ხინკალი','khinkali','xinkali','khinklai']){
    const {search,loaded}=fixture();const result=await search(term,10);
    assert.equal(result.length,1,term);assert.equal(result[0].id,'osm_node_20');assert.equal(result[0].priceMinor,3000);
    assert.match(result[0].pageHref,/\/place\/osm_node_20\?tab=catalog&item=i1/);assert.equal(result[0].canonicalBusinessHref,result[0].pageHref);
    assert.equal(result[0].priceContext,'delivery-marketplace');assert.deepEqual(loaded,['osm_node_20']);
  }
});
test('source search neither guesses diet/prep nor returns expired prices as current',async()=>{
  const {search,loaded}=fixture();assert.equal((await search('ხინკალი',10,{filters:{diet:'vegan'}})).length,0);assert.equal(loaded.length,0);
  assert.equal((await search('ხინკალი',10,{filters:{preparationMax:15}})).length,0);
  assert.equal((await fixture({expired:true}).search('ხინკალი',10))[0].priceMinor,null);
  assert.equal((await search('ხინკალი',10,{category:'pharmacy'})).length,0);
});
test('explicit item diet works without inventing place-wide dietary suitability',async()=>{
  const {search}=fixture({declaredDiet:true});
  const result=await search('',10,{filters:{diet:'vegan'}});
  assert.equal(result.length,1);assert.equal(result[0].dietarySource,'publisher-declared');assert.deepEqual(result[0].dietaryTags,['vegan']);
  assert.deepEqual(result[0].facets.diets,['vegan']);
});
test('numeric product models are never silently corrected and ranking stays source-specific',async()=>{
  const rows=[['iPhone 16','product',[['v1','i1']]],['iPhone 15','product',[['v2','i2']]]];
  const result=await rankDirectoryCatalogRows(rows,'iphone 16');assert.equal(result.length,1);assert.equal(result[0].row[2][0][0],'v1');
});
test('a typo ranks the plain dish above longer titles with the same fuzzy score',async()=>{
  const rows=[['შოკოლადის ხინკალი','dish',[['v1','i1']]],['ხინკალი','dish',[['v2','i2']]]];
  assert.equal((await rankDirectoryCatalogRows(rows,'ხინკლაი'))[0].row[0],'ხინკალი');
});
test('product category context is searchable without inventing a phone from a screen-protector title',async()=>{
  const rows=[['iphone 16','product',[['accessories','glass']],['ეკრანის დამცავი ბრონები']],['iphone 16','product',[['phones','phone']],['მობილური ტელეფონები']]];
  const result=await rankDirectoryCatalogRows(rows,'ეკრანის დამცავი');assert.equal(result.length,1);assert.equal(result[0].row[2][0][0],'accessories');
});
test('common Georgian product-brand spellings find English source names without changing model numbers',async()=>{
  const rows=[['Sony PlayStation 5','product',[['v1','ps5']]],['Sony PlayStation 4','product',[['v2','ps4']]],['iPhone 16','product',[['v3','iphone']]]];
  assert.equal((await rankDirectoryCatalogRows(rows,'ფლეისთეიშენი 5'))[0].row[2][0][1],'ps5');
  assert.equal((await rankDirectoryCatalogRows(rows,'PS5'))[0].row[2][0][1],'ps5');
  assert.equal((await rankDirectoryCatalogRows(rows,'აიფონი 16'))[0].row[2][0][1],'iphone');
});
test('category filtering happens before ranking caps and keeps valid pairs in mixed-category titles',async()=>{
  const rows=[...Array.from({length:100},(_,i)=>[`პური ${i}`,'dish',[['restaurant',`i${i}`]]]),['თეთრი პური','product',[['restaurant','white'],['bakery','white']]]];
  const files={
    'index.json':{version:1,venues:{restaurant:{placeId:'place-restaurant',category:'restaurant',file:'venues/restaurant.json'},bakery:{placeId:'place-bakery',category:'bakery',file:'venues/bakery.json'}},search:{manifest:'search/manifest.json'}},
    'search/manifest.json':{version:1,words:['puri'],buckets:{pu:[{file:'search/pu.json',count:rows.length,bytes:10000}]}},
    'search/pu.json':{version:1,rows},
    'venues/bakery.json':{version:1,venueId:'bakery',placeId:'place-bakery',sourceUrl:'https://wolt.com/ka/geo/tbilisi/venue/bakery',items:[{id:'white',name:'თეთრი პური',kind:'product',priceMinor:300,categoryIds:[]}],categories:[]},
  };
  const loaded=[];
  const search=createDirectoryCatalogSearch({readFile:async file=>{assert.ok(files[file],file);return files[file];},loadPlace:async id=>{loaded.push(id);return{id,name:'Bakery branch',category:'bakery',lat:41.7,lng:44.8};}});
  const result=await search('პური',20,{category:'bakery'});
  assert.equal(result.length,1);assert.equal(result[0].id,'place-bakery');assert.equal(result[0].itemTitle,'თეთრი პური');assert.deepEqual(loaded,['place-bakery']);assert.equal(result.coverage.truncated,false);
  assert.equal((await rankDirectoryCatalogRows(rows,'პური',80)).truncated,true,'a title cap must report truncation');
});
