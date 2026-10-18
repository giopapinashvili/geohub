import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { normalizeCommerceItem, normalizeCommerceOffer, normalizeBusinessBranch } from '../src/lib/commerce.js';
const BASE=process.env.MAP_DISCOVERY_TEST_URL || 'http://127.0.0.1:5181';
if(new URL(BASE).hostname!=='127.0.0.1')throw Error('Local preview only');
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
if(![process.env.FIRESTORE_EMULATOR_HOST,process.env.FIREBASE_AUTH_EMULATOR_HOST].every(v=>/^127\.0\.0\.1:\d+$/.test(v)))throw Error('Local demo emulators only');
const admin=initializeApp({projectId:'demo-geohub'},'map-discovery-'+Date.now());const db=getFirestore(admin);
const prefix='MapQA'+Date.now().toString().slice(-7), businessId=prefix+'_biz', a=prefix+'_a', b=prefix+'_b';
const metadata={createdBy:'u_nino',createdAt:Timestamp.now(),updatedAt:Timestamp.now()};
await db.doc('businesses/'+businessId).set({name:prefix+' სამზარეულო',ownerId:'u_nino',category:'restaurant',status:'active',isDemo:false,description:'Local emulator fixture'});
for(const [id,title,lng] of [[a,prefix+' ფილიალი A',44.802],[b,prefix+' ფილიალი B',44.812]])await db.doc('businessBranches/'+id).set({...normalizeBusinessBranch({businessId,title,address:'ტესტის ქუჩა 12',lat:41.71,lng,status:'published'}),...metadata});
const dishes={slow:{id:prefix+'_01slow',title:prefix+' პიცა ნელი',branchIds:[a],preparationMinutes:45,dietaryTags:['vegetarian']},fast:{id:prefix+'_02fast',title:prefix+' პიცა ვეგანური',branchIds:[a],preparationMinutes:12,dietaryTags:['vegan']},other:{id:prefix+'_03other',title:prefix+' პიცა B',branchIds:[b],preparationMinutes:null,dietaryTags:['vegan']},all:{id:prefix+'_04all',title:prefix+' ყველგან',allBranches:true,branchIds:[],preparationMinutes:10}};
for(const item of Object.values(dishes))await db.doc('commerceItems/'+item.id).set({...normalizeCommerceItem({businessId,type:'dish',priceMinor:2000,currency:'GEL',status:'published',available:true,allBranches:false,...item}),...metadata});
const offer=normalizeCommerceOffer({businessId,itemId:dishes.fast.id,priceMinor:1500,originalPriceMinor:2000,allBranches:false,branchIds:[a],startsAtMs:Date.now()-1000,endsAtMs:Date.now()+600000,status:'published'},{...normalizeCommerceItem({businessId,type:'dish',priceMinor:2000,status:'published',title:dishes.fast.title,allBranches:false,branchIds:[a]}),id:dishes.fast.id});
await db.doc('commerceOffers/'+prefix+'_offer').set({...offer,...metadata});
for(const id of ['one','duplicate'])await db.doc('placeReviews/'+prefix+'_'+id).set({placeId:'branch_'+a,userId:'u_nino',userName:'ნინო',rating:5,comment:'ტესტი',experienceTags:['tasty'],status:'active',createdAt:Timestamp.now()});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1100,height:600},reducedMotion:'reduce'});const page=await context.newPage();page.setDefaultTimeout(20000);
const errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(()=>localStorage.setItem('gh_map_view_v1',JSON.stringify({lat:41.71,lng:44.802,zoom:15,pitch:0,bearing:0})));
async function step(name,run){await run();results.push(name);console.log('PASS '+name);}
async function filters(){await page.getByRole('button',{name:'ფილტრები',exact:true}).click();return page.getByRole('dialog');}
async function login(target){await target.goto(BASE+'/login?next=%2Fdiscounts');await target.waitForFunction(()=>window.__gh?.emulator);await target.locator('input[type=email]').fill('nino@test.ge');await target.locator('#login-pass').fill('geohub123');await target.locator('.auth-form button[type=submit]').click();await target.waitForFunction(()=>window.__gh?.authUser.value?.uid==='u_nino');await expect(target).toHaveURL(BASE+'/discounts');}
let second;
try{
 await step('Map search merges dish matches and filters diet/preparation before branch dedup',async()=>{
  await page.goto(BASE+'/map');await page.waitForFunction(()=>window.__gh?.emulator);
  await page.getByPlaceholder('მოძებნე რუკაზე').fill(prefix+' პიცა');
  await expect(page.locator('.map-list .place-row').filter({hasText:prefix+' ფილიალი A'})).toBeVisible({timeout:45000});
  await expect(page.locator('.map-list .place-row').filter({hasText:prefix+' ფილიალი B'})).toBeVisible();
  const dialog=await filters();await dialog.getByLabel('კვების მახასიათებლები',{exact:true}).selectOption('vegan');await dialog.getByLabel('კერძის მომზადების დრო',{exact:true}).selectOption('15');await dialog.getByRole('button',{name:'შედეგების ნახვა',exact:true}).click();
  const row=page.locator('.map-list .place-row').filter({hasText:prefix+' ფილიალი A'});await expect(row).toContainText(dishes.fast.title);await expect(row).toContainText('12 წთ');await expect(page.locator('.map-list .place-row').filter({hasText:prefix+' ფილიალი B'})).toHaveCount(0);
  await row.click();await expect(page.locator('.map-place-preview')).toContainText(dishes.fast.title);await expect(page.getByTestId('map-place-page')).toHaveAttribute('href',new RegExp('/business/'+businessId+'\\?.*branch='+a));
 });
 await step('Expanded map catalog respects branch scope, focuses matched dish and direct refresh resolves virtual IDs',async()=>{
  await page.getByTestId('map-place-expand').click();const drawer=page.locator('.map-place-details');await expect(drawer).toBeVisible();
  await expect(drawer.locator('#catalog-'+dishes.fast.id)).toHaveClass(/is-focused/);await expect(drawer.locator('#catalog-'+dishes.slow.id)).toHaveCount(1);await expect(drawer.locator('#catalog-'+dishes.all.id)).toHaveCount(1);await expect(drawer.locator('#catalog-'+dishes.other.id)).toHaveCount(0);
  await page.reload();await expect(page.locator('.map-place-details')).toContainText(prefix+' ფილიალი A', { timeout: 45000 });await expect(page.locator('.map-place-details a[href^="/business/"]').first()).toHaveAttribute('href',new RegExp('/business/'+businessId));
 });
 await step('Community-only filter resolves reviewed branches and counts distinct users',async()=>{
  await page.goto(BASE+'/map');const dialog=await filters();await dialog.getByLabel('მომხმარებლების გამოცდილებით',{exact:true}).selectOption('tasty');await dialog.getByRole('button',{name:'შედეგების ნახვა',exact:true}).click();
  await expect(page.locator('.map-list .place-row').filter({hasText:prefix+' ფილიალი A'})).toBeVisible({timeout:45000});await expect(page.locator('.map-list')).toContainText('1 მომხმარებელმა მონიშნა');await expect(page.locator('.map-list .place-row').filter({hasText:prefix+' ფილიალი B'})).toHaveCount(0);
 });
 await step('Saved discount query uses private document, real matches and restores across signed-in contexts',async()=>{
  await login(page);await page.getByPlaceholder('პროდუქტი, კერძი, მომსახურება ან ბიზნესი').fill(prefix);await page.getByLabel('ფასი მაქსიმუმ, ₾',{exact:true}).fill('18.50');await page.getByRole('button',{name:'კერძი',exact:true}).click();
  await page.getByRole('button',{name:'ძიების შენახვა',exact:true}).click();const row=page.locator('.discount-watchlist-entries li').filter({hasText:prefix});await expect(row).toBeVisible();await expect(row).toContainText('1 დამთხვევა');
  const stored=(await db.doc('users/u_nino/private/discountWatchlist').get()).data().entries.find(e=>e.term===prefix);assert.equal(stored.maxPriceMinor,1850);assert.equal(stored.type,'dish');
  second=await browser.newContext({viewport:{width:390,height:844}});const p2=await second.newPage();p2.on('pageerror',e=>errors.push(e.message));await login(p2);const restored=p2.locator('.discount-watchlist-entries li').filter({hasText:prefix});await expect(restored).toBeVisible();await restored.locator('.discount-watchlist-query').click();await expect(p2.getByPlaceholder('პროდუქტი, კერძი, მომსახურება ან ბიზნესი')).toHaveValue(prefix);await expect(p2.getByLabel('ფასი მაქსიმუმ, ₾',{exact:true})).toHaveValue('18.5');assert.equal(await p2.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await restored.getByRole('button',{name:'შენახული ძიების წაშლა: '+prefix,exact:true}).click();await expect(row).toHaveCount(0);await expect(restored).toHaveCount(0);await second.close();second=null;
 });
 assert.deepEqual(errors,[]);await writeFile('.codex/artifacts/map-refresh/discovery-results.json',JSON.stringify({prefix,results,errors,base:BASE,note:'Local emulator fixtures only; no production writes.'},null,2));
}catch(error){console.log('FAIL_STATE',JSON.stringify({url:page.url(),errors,text:(await page.locator('body').innerText()).slice(-5000)}));throw error;}finally{await second?.close();await browser.close();await deleteApp(admin);}
