import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseZoommerOffers, publicOffersResponse } from '../worker/public-offers.js';
import { commerceOfferState } from '../src/lib/commerce.js';
import { officialMerchant, OFFICIAL_MERCHANTS } from '../src/lib/officialMerchants.js';
const stamp = 1792396800000;
const product = { id: 10, name: 'Headphones', route: 'headphones-p10', price: 90, previousPrice: 100, imageUrl: 'https://s3.zoommer.ge/site/product.jpg' };
const html = products => `<script id="__NEXT_DATA__" type="application/json" nonce="random">${JSON.stringify({props:{pageProps:{dehydratedState:{queries:[{queryKey:'homePageData',state:{data:{section:[{products}]}}}]}}}})}</script>`;
test('source redirects stop at the official host using the supported Workers redirect mode', async () => {
  const original = globalThis.fetch; const requested = [];
  globalThis.fetch = async (url, options) => {
    requested.push(url); assert.equal(options.redirect, 'manual');
    return new Response(null, {status:302,headers:{Location:'https://elsewhere.example/'}});
  };
  try {
    const response = await publicOffersResponse(new Request('https://geohub-main.pages.dev/api/public-offers'), {ASSETS:{fetch:async()=>Response.json(parseZoommerOffers(html([product]),Date.now()))}}, {waitUntil(){}});
    const data = await response.json();
    assert.equal(data.fallback,true); assert.equal(data.sourceIssue,'http-302');
    assert.deepEqual(requested,['https://zoommer.ge/']);
  } finally {globalThis.fetch=original;}
});
test('official adapter keeps real old/new prices, original photos and source but never invents branch stock or promotion end date', () => {
  const data = parseZoommerOffers(html([product,product]), stamp);
  assert.equal(data.offers.length,1); const offer=data.offers[0];
  assert.equal(offer.priceMinor,9000); assert.equal(offer.originalPriceMinor,10000);
  assert.equal(offer.isDemo,false); assert.equal(offer.endsAtMs,undefined);
  assert.equal(offer.allBranches,false); assert.deepEqual(offer.branchIds,[]);
  assert.equal(offer.sourceUrl,'https://zoommer.ge/headphones-p10');
  assert.equal(commerceOfferState(offer,stamp+1),'active');
  assert.equal(commerceOfferState(offer,offer.freshnessUntilMs),'expired');
});
test('source schema drift, false discounts, sold-out items and untrusted URLs fail closed', () => {
  for(const patch of [{price:110},{price:NaN},{previousPrice:null},{disableBuyButton:true},{preOrder:true},{comingSoonText:'Coming soon'},{route:'https://evil.example/item'},{imageUrl:'javascript:alert(1)'},{imageUrl:'https://evil.example/image.jpg'}]) assert.deepEqual(parseZoommerOffers(html([{...product,...patch}]),stamp).offers,[]);
  assert.throws(()=>parseZoommerOffers('<html>not a product feed</html>'));
  assert.throws(()=>parseZoommerOffers('<script id="__NEXT_DATA__">{"props":{}}</script>'));
  assert.deepEqual(parseZoommerOffers(html([]),stamp).offers,[],'a valid empty source is not an outage');
});
test('official prices require real decimal values and source/media URLs cannot carry credentials', () => {
  for(const patch of [{price:true},{previousPrice:true},{price:[90]},{previousPrice:[100]},{price:{}},{price:'9e1'},{price:' '},{price:0.001,previousPrice:0.004},{price:99.999,previousPrice:100},{route:'https://user:pass@zoommer.ge/product'},{imageUrl:'https://user:pass@s3.zoommer.ge/product.jpg'}]) {
    assert.deepEqual(parseZoommerOffers(html([{...product,...patch}]),stamp).offers,[],JSON.stringify(patch));
  }
  const offer=parseZoommerOffers(html([{...product,price:'90.50',previousPrice:'100.00'}]),stamp).offers[0];
  assert.equal(offer.priceMinor,9050);assert.equal(offer.originalPriceMinor,10000);
});
test('published snapshot has actual linked merchants and valid photos/source prices; no fictional merchant appears in real data', () => {
  const data=JSON.parse(fs.readFileSync(new URL('../public/commerce-data/official-offers.json',import.meta.url),'utf8'));
  assert.ok(data.offers.length>=20);
  for(const offer of data.offers){ assert.ok(officialMerchant(offer.brandId));assert.ok(offer.originalPriceMinor>offer.priceMinor);assert.match(offer.imageUrl,/^https:\/\/s3\.zoommer\.ge\//);assert.equal(offer.isDemo,false); }
});
test('public offer endpoint is read-only and expired fallback never becomes current', async () => {
  assert.equal((await publicOffersResponse(new Request('https://geohub-main.pages.dev/api/public-offers',{method:'POST'}),{},{})).status,405);
  const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('upstream unavailable');};
  try{const response=await publicOffersResponse(new Request('https://geohub-main.pages.dev/api/public-offers?url=https://evil.example'),{ASSETS:{fetch:async()=>Response.json(parseZoommerOffers(html([product]),1))}},{waitUntil(){}});const data=await response.json();assert.deepEqual(data.offers,[]);assert.equal(data.fallback,true);}finally{globalThis.fetch=original;}
});

test('a successful source with no remaining discounts replaces old offers without using the fallback', async () => {
  const original=globalThis.fetch;
  let fallbackReads=0;
  globalThis.fetch=async()=>new Response(html([{...product,price:100,previousPrice:100}]),{headers:{'Content-Type':'text/html'}});
  try {
    const response=await publicOffersResponse(new Request('https://geohub-main.pages.dev/api/public-offers'),{ASSETS:{fetch:async()=>{fallbackReads++;return Response.json(parseZoommerOffers(html([product]),Date.now()-3600000));}}},{waitUntil(){}});
    const data=await response.json();
    assert.equal(response.status,200);assert.deepEqual(data.offers,[]);
    assert.equal(fallbackReads,0,'known-ended discounts must not reappear from an older snapshot');
    assert.notEqual(data.fallback,true);
  } finally {globalThis.fetch=original;}
});

test('public endpoint ignores caller URLs and credentials and HEAD has no body', async () => {
  const original=globalThis.fetch, calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(html([product]),{headers:{'Content-Type':'text/html'}});};
  try {
    const request=new Request('https://geohub-main.pages.dev/api/public-offers?url=https://private.example/data',{method:'HEAD',headers:{Authorization:'Bearer private-test-token',Cookie:'private-session=test'}});
    const response=await publicOffersResponse(request,{ASSETS:{fetch:async()=>{throw new Error('unexpected fallback');}}},{waitUntil(){}});
    assert.equal(response.status,200);assert.equal(await response.text(),'');
    assert.equal(calls.length,1);assert.equal(calls[0].url,'https://zoommer.ge/');
    const headers=new Headers(calls[0].options.headers);
    assert.equal(headers.get('Authorization'),null);assert.equal(headers.get('Cookie'),null);
    assert.equal(calls[0].options.body,undefined);
  } finally {globalThis.fetch=original;}
});

test('every official merchant branch link resolves to its real published map record', () => {
  const folder=new URL('../public/place-data/',import.meta.url);
  const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',folder),'utf8'));
  const lookup=JSON.parse(fs.readFileSync(new URL(manifest.lookup.file,folder),'utf8'));
  for(const merchant of OFFICIAL_MERCHANTS) for(const branch of merchant.branches) {
    const shard=manifest.shards.find(shard=>shard.key===lookup[branch.id]);
    assert.ok(shard,`Branch link does not resolve: ${branch.id}`);
    const record=JSON.parse(fs.readFileSync(new URL(shard.file,folder),'utf8')).find(place=>place.id===branch.id);
    assert.equal(record.name,branch.name);assert.equal(record.category,branch.category);
    assert.ok(Math.abs(record.lat-branch.lat)<0.000001 && Math.abs(record.lng-branch.lng)<0.000001);
    assert.match(record.raw.sourceUrl,/^https:\/\/www\.openstreetmap\.org\//);
  }
});

test('official freshness does not fabricate a campaign end and invalid/future records stay out of active results', () => {
  const offer=parseZoommerOffers(html([product]),stamp).offers[0];
  assert.equal(commerceOfferState({...offer,isDemo:true},stamp),'invalid');
  assert.equal(commerceOfferState({...offer,observedAtMs:NaN},stamp),'invalid');
  assert.equal(commerceOfferState({...offer,freshnessUntilMs:stamp},stamp),'invalid');
  assert.equal(commerceOfferState(offer,stamp-1),'scheduled');
  assert.equal(commerceOfferState(offer,offer.freshnessUntilMs+1),'expired');
  assert.equal(offer.endsAtMs,undefined);
});

test('client respects a valid empty live response instead of loading an older local snapshot', async () => {
  const {listOfficialOffers}=await import('../src/data/officialOffers.js?review=empty-live');
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{calls.push(url);return Response.json({version:1,offers:[]});};
  try {
    assert.deepEqual(await listOfficialOffers(),[]);
    assert.deepEqual(calls,['/api/public-offers']);
  } finally {globalThis.fetch=original;}
});

test('client fallback retains its original observation and cannot make expired source prices active', async () => {
  const {listOfficialOffers}=await import('../src/data/officialOffers.js?review=dated-fallback');
  const original=globalThis.fetch,calls=[];
  const snapshot=parseZoommerOffers(html([product]),stamp);
  globalThis.fetch=async url=>{
    calls.push(url);
    return url==='/api/public-offers' ? new Response('Unavailable',{status:503}) : Response.json(snapshot);
  };
  try {
    const offers=await listOfficialOffers();
    assert.deepEqual(calls,['/api/public-offers','/commerce-data/official-offers.json']);
    assert.equal(offers[0].observedAtMs,stamp);
    assert.equal(offers[0].freshnessUntilMs,snapshot.offers[0].freshnessUntilMs);
    assert.equal(commerceOfferState(offers[0],snapshot.offers[0].freshnessUntilMs),'expired');
  } finally {globalThis.fetch=original;}
});
