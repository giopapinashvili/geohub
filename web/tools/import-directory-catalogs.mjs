// Public, unauthenticated read-only catalog snapshot. Run from repository root.
// --phase=roots publishes full menus first; --phase=complete also paginates shops.
// --rebuild-only rebuilds indexes from saved snapshots without remote requests.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { SOURCE_DIRECTORY_FOOD } from './source-directory-food.mjs';
import { CATALOG_VERSION, PRICE_CONTEXT, flattenCategories, normalizeCatalogItem, normalizeOptionGroups, buildCanonicalVenueMap, catalogTokens, collectCategoryPages, catalogCategoryMembership, retryAfterMilliseconds, sameCatalogRoot, categoryPageMatches, retainPriorCatalogReason } from './directory-catalog-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = new Set(process.argv.slice(2));
function artifactOverride(flag,fallback){
  const value=process.argv.find(x=>x.startsWith(`${flag}=`))?.slice(flag.length+1);
  if(!value)return path.join(root,fallback);
  const resolved=path.resolve(root,value),allowed=path.join(root,'.codex/artifacts')+path.sep;
  if(!resolved.startsWith(allowed))throw new Error(`${flag} must be inside this workspace's .codex/artifacts`);
  return resolved;
}
const output = artifactOverride('--output-dir','web/public/catalog-data');
const cache = artifactOverride('--cache-dir','.codex/artifacts/directory-catalogs');
const phase = process.argv.find(x=>x.startsWith('--phase='))?.split('=')[1] || 'complete';
const concurrency = Math.max(1,Math.min(4,Number(process.argv.find(x=>x.startsWith('--concurrency='))?.split('=')[1]) || 2));
const intervalMs = Math.max(1200,Number(process.argv.find(x=>x.startsWith('--interval-ms='))?.split('=')[1]) || 1500);
const maxRequests = Math.max(1,Math.min(10000,Number(process.argv.find(x=>x.startsWith('--max-requests='))?.split('=')[1]) || 2000));
const sourceCacheMs = args.has('--refresh') ? 0 : 7*86400000;
const snapshotRevision = 3;
const limit = Number(process.argv.find(x=>x.startsWith('--limit='))?.split('=')[1]) || Infinity;
const hash = text => createHash('sha256').update(text).digest('hex');
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
const iso = ()=>new Date().toISOString();
await fs.mkdir(path.join(output,'venues'),{recursive:true});
await fs.mkdir(path.join(output,'search'),{recursive:true});
await fs.mkdir(path.join(cache,'responses'),{recursive:true});
async function save(file,data) {
  const text=typeof data==='string'?data:JSON.stringify(data),info={bytes:Buffer.byteLength(text),sha256:hash(text)};
  try{if(await fs.readFile(file,'utf8')===text)return info;}catch(error){if(error.code!=='ENOENT')throw error;}
  await fs.writeFile(`${file}.tmp`,text);
  // Windows scanners/build readers may briefly lock a destination. Preserve atomic replacement.
  for(let attempt=0;;attempt++){
    try{await fs.rename(`${file}.tmp`,file);break;}
    catch(error){if(!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt>=6)throw error;await sleep(100*2**attempt);}
  }
  return info;
}
async function read(file) {try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return null;}}

const manifest=await read(path.join(root,'web/public/place-data/manifest.json'));
const places=[];
for(const shard of manifest.shards){const payload=await read(path.join(root,'web/public/place-data',shard.file));places.push(...(Array.isArray(payload)?payload:payload.places));}
const canonical=buildCanonicalVenueMap(places);
// The accepted source directory is the allowlist. Held/virtual venues never enter this pipeline.
const definitions=SOURCE_DIRECTORY_FOOD.slice(0,limit);
const existing=await read(path.join(output,'index.json'));
// Complete small remaining catalogs first; every accepted venue remains queued.
if(phase==='complete')definitions.sort((a,b)=>{
  const weight=def=>{const previous=existing?.venues?.[def.sourceRecordId];return previous?.status==='complete'?-1:previous?.categoryCount??0;};
  return weight(a)-weight(b);
});
const index={version:CATALOG_VERSION,generatedAt:iso(),sourceName:'Wolt — საჯარო მენიუები და კატალოგები',sourceKind:'merchant-directory',priceContext:PRICE_CONTEXT,currency:'GEL',byPlaceId:{},venues:{},search:{manifest:'search/manifest.json'}};
// A bounded continuation must not hide earlier successful snapshots it did not revisit.
for(const def of definitions){const prior=existing?.venues?.[def.sourceRecordId];if(prior && canonical.get(def.sourceRecordId)?.id===prior.placeId && prior.sourceUrl===def.sourceUrl)index.venues[def.sourceRecordId]=prior;}
const audit={generatedAt:iso(),acceptedSourceVenues:definitions.length,placeDatasetId:manifest.datasetId,sourceApi:'https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/{slug}/assortment',maxRequests,requestCount:0,cacheHits:0,statusCounts:{},errors:[],rejectedItems:0,notes:['ფასები მიწოდების პლატფორმის დათარიღებული მონაცემებია; ადგილზე ფასები და ხელმისაწვდომობა შესაძლოა განსხვავდებოდეს.','მიწოდების დრო მომზადების დროდ არ გამოიყენება.','აღწერების სარეკლამო ტექსტი, შეფასებები და მომხმარებელთა ინფორმაცია არ იმპორტირდება.']};
const sourceCooldown=await read(path.join(cache,'source-cooldown.json'));
let nextRequestAt=0,rateLimitedUntil=Number.isFinite(sourceCooldown?.retryAfterUntilMs)?sourceCooldown.retryAfterUntilMs:0,consecutiveRateLimits=0,sourcePaused=false,completed=0,cooldownPromise=Promise.resolve();
const activeVenues=new Map();let lastCheckpointAt=Date.now(),lastCheckpointRequests=0,checkpointPromise=Promise.resolve();
async function checkpoint(force=false){
  if(!force && Date.now()-lastCheckpointAt<60000 && audit.requestCount-lastCheckpointRequests<50)return;
  lastCheckpointAt=Date.now();lastCheckpointRequests=audit.requestCount;
  const progress={updatedAt:iso(),phase,completed,total:definitions.length,remaining:Math.max(0,definitions.length-completed),requests:audit.requestCount,maxRequests,cacheHits:audit.cacheHits,errors:audit.errors.length,activeVenues:[...activeVenues.values()].map(value=>({...value})),...(audit.pausedReason?{pausedReason:audit.pausedReason}:{})};
  checkpointPromise=checkpointPromise.catch(()=>{}).then(async()=>{await save(path.join(cache,'progress.json'),progress);console.log(JSON.stringify(progress));});
  await checkpointPromise;
}
const progressTimer=setInterval(()=>{void checkpoint().catch(error=>console.warn(`Progress checkpoint unavailable: ${error.code||error.message}`));},60000);progressTimer.unref();
async function publicJson(url,{snapshotKey='',rootFetchedAt='',allowLegacyCache=false,validate=()=>true,validateCached=()=>true}={}){
  const file=path.join(cache,'responses',`${hash(snapshotKey?`${snapshotKey}\0${url}`:url)}.json.gz`);
  const candidates=[file,...(snapshotKey&&allowLegacyCache?[path.join(cache,'responses',`${hash(url)}.json.gz`)]:[])];
  for(const candidate of candidates)try {
    const value=JSON.parse(gunzipSync(await fs.readFile(candidate)));
    if(Date.now()-Date.parse(value.fetchedAt)<sourceCacheMs && (!rootFetchedAt||value.fetchedAt>=rootFetchedAt) && validate(value.data) && validateCached(value)){
      audit.cacheHits++;return value;
    }
  }catch{}
  for(let attempt=0;attempt<4;attempt++){
    if(sourcePaused)throw new Error(audit.pausedReason==='request-budget'?'request-budget-exhausted':'source-rate-limit-pause');
    if(audit.requestCount>=maxRequests){sourcePaused=true;audit.pausedReason='request-budget';throw new Error('request-budget-exhausted');}
    const wait=Math.max(0,nextRequestAt-Date.now(),rateLimitedUntil-Date.now());nextRequestAt=Math.max(Date.now(),nextRequestAt,rateLimitedUntil)+intervalMs;await sleep(wait);
    if(rateLimitedUntil>Date.now())await sleep(rateLimitedUntil-Date.now());
    if(sourcePaused)throw new Error(audit.pausedReason==='request-budget'?'request-budget-exhausted':'source-rate-limit-pause');
    if(audit.requestCount>=maxRequests){sourcePaused=true;audit.pausedReason='request-budget';throw new Error('request-budget-exhausted');}
    audit.requestCount++;
    await checkpoint();
    let response;
    try{response=await fetch(url,{headers:{'App-Language':'ka',Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});}catch(error){if(attempt<3){await sleep(1500*(attempt+1));continue;}throw new Error('network-unavailable');}
    if(response.status===429){consecutiveRateLimits++;rateLimitedUntil=Math.max(rateLimitedUntil,Date.now()+Math.max(120000,retryAfterMilliseconds(response.headers.get('retry-after'))));cooldownPromise=cooldownPromise.catch(()=>{}).then(()=>save(path.join(cache,'source-cooldown.json'),{source:'consumer-api.wolt.com',retryAfterUntilMs:rateLimitedUntil}));await cooldownPromise;console.log(JSON.stringify({sourceRateLimited:true,retryAfterSeconds:Math.round((rateLimitedUntil-Date.now())/1000)}));if(consecutiveRateLimits>=5){sourcePaused=true;audit.pausedReason='source-rate-limit';throw new Error('source-rate-limit-pause');}if(attempt<3)continue;}
    if(response.status>=500){if(attempt<3){await sleep(3000*(attempt+1));continue;}}
    if(!response.ok) throw new Error(`http-${response.status}`);
    consecutiveRateLimits=0;
    const value={fetchedAt:iso(),data:await response.json()};
    if(!validate(value.data))throw new Error('source-category-association');
    const compressed=gzipSync(JSON.stringify(value));await fs.writeFile(`${file}.tmp`,compressed);await fs.rename(`${file}.tmp`,file);
    return value;
  }
  throw new Error('retry-exhausted');
}
const foodCategories=new Set(['restaurant','cafe','bar','pub','fast-food','bakery','ice-cream','food-court','coffee-shop','pizzeria','confectionery']);
function metadata(def,place,kind,file,status,fetchedAt,items,categories,fileInfo={}){return {placeId:place.id,name:place.name,category:place.category,kind,status,file,sourceUrl:def.sourceUrl,fetchedAt,freshnessUntilMs:Date.parse(fetchedAt)+7*86400000,itemCount:items,categoryCount:categories,...fileInfo};}
function pendingRefreshMetadata(entry){
  if(!entry?.refreshPending)return {};
  return Object.fromEntries(['refreshPending','refreshIssue','lastRefreshAttemptAt','attemptedRoot'].filter(key=>entry[key]!==undefined).map(key=>[key,entry[key]]));
}
async function processVenue(def){
  const venueId=def.sourceRecordId;
  const place=canonical.get(venueId);
  if(!place){audit.errors.push({venueId,issue:'missing-canonical-place'});return;}
  activeVenues.set(venueId,{venueId,name:place.name,sourceUrl:def.sourceUrl,stage:'root'});
  const slug=new URL(def.sourceUrl).pathname.split('/').filter(Boolean).at(-1);
  const kind=foodCategories.has(def.category)?'menu':'products';
  const file=`venues/${venueId}.json`;
  const prior=await read(path.join(output,file));
  if(prior?.status==='complete' && !existing?.venues?.[venueId]?.refreshPending && prior.schemaRevision===snapshotRevision && Date.now()-Date.parse(prior.fetchedAt)<sourceCacheMs){
    prior.placeId=place.id;prior.freshnessUntilMs=Date.parse(prior.fetchedAt)+7*86400000;const info=await save(path.join(output,file),prior);index.venues[venueId]=metadata(def,place,prior.kind,file,prior.status,prior.fetchedAt,prior.items.length,prior.categories.length,info);completed++;activeVenues.delete(venueId);return;
  }
  try{
    const api=`https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/${encodeURIComponent(slug)}/assortment`;
    const needsNewRoot=prior?.status==='complete' && existing?.venues?.[venueId]?.refreshPending;
    const first=await publicJson(api,{validateCached:value=>!needsNewRoot || !sameCatalogRoot(prior,{sourceResponseSha256:hash(JSON.stringify(value.data)),sourceRootFetchedAt:value.fetchedAt})});const data=first.data;
    if(!['full','partial'].includes(data.loading_strategy) || !Array.isArray(data.items) || !Array.isArray(data.categories)) throw new Error('source-format');
    const categories=flattenCategories(data.categories);const byCategory=new Map(categories.map(c=>[c.id,c]));
    const sourceRoot={sourceResponseSha256:hash(JSON.stringify(data)),sourceRootFetchedAt:first.fetchedAt};
    const snapshotKey=hash(JSON.stringify({...sourceRoot,assortmentId:data.assortment_id||''}));
    const itemMap=new Map(data.items.map(i=>[i.id,i]));const optionMap=new Map((data.options||[]).map(o=>[o.id,o]));
    const issues=[];let pageCount=1,earliestFetchedAt=first.fetchedAt;
    if(data.loading_strategy==='partial' && phase==='complete'){
      if(!categories.some(c=>c.leaf && c.slug))issues.push({issue:'source-partial-without-category-pages'});
      for(const category of categories.filter(c=>c.leaf && !c.slug))issues.push({categoryId:category.id,issue:'source-category-without-slug'});
      for(const category of categories.filter(c=>c.leaf && c.slug)){
        Object.assign(activeVenues.get(venueId),{stage:'category',category:category.name,pageCount});
        const result=await collectCategoryPages(category,async token=>{const url=new URL(`${api}/categories/slug/${encodeURIComponent(category.slug)}`);if(token)url.searchParams.set('page_token',token);const response=await publicJson(url.href,{snapshotKey,rootFetchedAt:first.fetchedAt,allowLegacyCache:sameCatalogRoot(prior,sourceRoot),validate:page=>categoryPageMatches(page,category.id)});if(response.fetchedAt<earliestFetchedAt)earliestFetchedAt=response.fetchedAt;return response.data;});
        pageCount+=result.pageCount;
        for(const item of result.items)itemMap.set(item.id,item);
        for(const option of result.options)optionMap.set(option.id,option);
        for(const c of result.categories){if(!byCategory.has(c.id))byCategory.set(c.id,{id:c.id,name:c.name,itemIds:[]});const target=byCategory.get(c.id);target.itemIds=[...new Set([...target.itemIds,...c.itemIds])];}
        if(result.issue)issues.push({categoryId:category.id,issue:result.issue});
        if(sourcePaused)break;
      }
    }
    const idsByItem=catalogCategoryMembership([...byCategory.values()]);
    const items=[...itemMap.values()].map(item=>normalizeCatalogItem(item,kind,idsByItem.get(item.id)||[])).filter(Boolean);
    audit.rejectedItems+=itemMap.size-items.length;
    const categoryItems=new Map();for(const item of items)for(const id of item.categoryIds){if(!categoryItems.has(id))categoryItems.set(id,[]);categoryItems.get(id).push(item.id);}
    const cleanCategories=[...byCategory.values()].map(c=>({id:c.id,name:c.name,...(c.parentId?{parentId:c.parentId}:{}),itemIds:categoryItems.get(c.id)||[]}));
    const status=data.loading_strategy==='partial' && (phase!=='complete'||issues.length)?'partial':'complete';
    const catalog={version:CATALOG_VERSION,schemaRevision:snapshotRevision,venueId,placeId:place.id,kind,status,currency:'GEL',sourceName:index.sourceName,sourceKind:'merchant-directory',sourceUrl:def.sourceUrl,fetchedAt:earliestFetchedAt,...sourceRoot,sourceAssortmentId:data.assortment_id||'',freshnessUntilMs:Date.parse(earliestFetchedAt)+7*86400000,priceContext:PRICE_CONTEXT,categories:cleanCategories,items,optionGroups:normalizeOptionGroups([...optionMap.values()]),sourceLoadingStrategy:data.loading_strategy,pageCount,...(issues.length?{sourceIssues:issues}:{})};
    const retainedReason=retainPriorCatalogReason(prior,catalog,phase);
    if(retainedReason){
      prior.placeId=place.id;
      const info=await save(path.join(output,file),prior);
      index.venues[venueId]={...metadata(def,place,prior.kind,file,prior.status,prior.fetchedAt,prior.items.length,prior.categories.length,info),refreshPending:true,refreshIssue:retainedReason,lastRefreshAttemptAt:iso(),attemptedRoot:sourceRoot};
      audit.errors.push({venueId,issue:retainedReason,retainedSnapshot:true,issues});
    }else{
      const info=await save(path.join(output,file),catalog);index.venues[venueId]=metadata(def,place,kind,file,status,earliestFetchedAt,items.length,cleanCategories.length,info);
      if(issues.length)audit.errors.push({venueId,issues});
    }
  }catch(error){
    const retainedSnapshot=Array.isArray(prior?.items) && Array.isArray(prior?.categories);
    if(retainedSnapshot){
      // A refresh failure cannot erase existing evidence or renew its original price expiry.
      prior.placeId=place.id;prior.freshnessUntilMs=Date.parse(prior.fetchedAt)+7*86400000;
      const info=await save(path.join(output,file),prior);
      index.venues[venueId]={...metadata(def,place,prior.kind,file,prior.status,prior.fetchedAt,prior.items.length,prior.categories.length,info),...pendingRefreshMetadata(existing?.venues?.[venueId])};
      if(error.message!=='request-budget-exhausted')Object.assign(index.venues[venueId],{refreshPending:true,refreshIssue:error.message,lastRefreshAttemptAt:iso()});
    }else index.venues[venueId]=metadata(def,place,kind,'',error.message==='request-budget-exhausted'?'pending':'unavailable',iso(),0,0);
    if(error.message!=='request-budget-exhausted')audit.errors.push({venueId,issue:error.message,...(retainedSnapshot?{retainedSnapshot:true}:{})});
  }
  completed++;activeVenues.delete(venueId);await checkpoint();
}

if(!args.has('--rebuild-only')){
  let cursor=0;
  await Promise.all(Array.from({length:concurrency},async()=>{while(cursor<definitions.length && !sourcePaused)await processVenue(definitions[cursor++]);}));
}else{
  for(const def of definitions){const place=canonical.get(def.sourceRecordId);if(!place)continue;const file=`venues/${def.sourceRecordId}.json`;const catalog=await read(path.join(output,file));if(!catalog)continue;catalog.placeId=place.id;catalog.freshnessUntilMs=Date.parse(catalog.fetchedAt)+7*86400000;const info=await save(path.join(output,file),catalog);index.venues[def.sourceRecordId]={...metadata(def,place,catalog.kind,file,catalog.status,catalog.fetchedAt,catalog.items.length,catalog.categories.length,info),...pendingRefreshMetadata(existing?.venues?.[def.sourceRecordId])};}
}
for(const [id,venue]of Object.entries(index.venues)){
  (index.byPlaceId[venue.placeId]??=[]).push(id);audit.statusCounts[venue.status]=(audit.statusCounts[venue.status]||0)+1;
}
// Group repeated chain products once and point to exact branch/item IDs.
const grouped=new Map();let itemCount=0;
const itemCoverage={withImage:0,withPrice:0,unknownPrice:0,sourceUnavailable:0,weighed:0,minimumQuantity:0,requiredOptions:0,publisherDeclaredDiet:0};
for(const [venueId,venue]of Object.entries(index.venues)){
  if(!venue.file)continue;const catalog=await read(path.join(output,venue.file));
  const categoryNames=new Map(catalog.categories.map(c=>[c.id,c.name?.trim()||'']));
  for(const item of catalog.items){itemCount++;if(item.imageUrl)itemCoverage.withImage++;if(item.priceMinor===null)itemCoverage.unknownPrice++;else itemCoverage.withPrice++;if(item.sourceAvailability==='unavailable')itemCoverage.sourceUnavailable++;if(item.sellByWeight)itemCoverage.weighed++;if(item.minQuantity)itemCoverage.minimumQuantity++;if(item.priceType==='base-with-required-options')itemCoverage.requiredOptions++;if(item.dietaryTags?.length)itemCoverage.publisherDeclaredDiet++;if(item.sourceAvailability==='unavailable')continue;const names=[...new Set(item.categoryIds.map(id=>categoryNames.get(id)).filter(Boolean))],diets=item.dietaryTags||[];const key=`${item.kind}\0${item.name}\0${names.join('|')}\0${diets.join('|')}`;if(!grouped.has(key))grouped.set(key,[item.name,item.kind,[],names,diets]);grouped.get(key)[2].push([venueId,item.id]);}
}
const buckets=new Map(),words=new Set();
for(const row of grouped.values()){const tokens=catalogTokens([row[0],...row[3]].join(' '));tokens.forEach(t=>words.add(t));for(const prefix of new Set([...tokens.map(t=>t.slice(0,2)),...row[4].map(diet=>`diet:${diet}`)])){if(!buckets.has(prefix))buckets.set(prefix,[]);buckets.get(prefix).push(row);}}
const searchManifest={version:CATALOG_VERSION,generatedAt:iso(),rowFormat:['name','kind','venueItemPairs','categoryNames','dietaryTags'],words:[...words].sort(),buckets:{}};
for(const [prefix,rows]of [...buckets.entries()].sort()){
  let chunk=[],bytes=0,part=0;const descriptors=[];
  async function flush(){if(!chunk.length)return;const payload=JSON.stringify({version:CATALOG_VERSION,rows:chunk});const file=`search/${Buffer.from(prefix).toString('hex')}-${part++}-${hash(payload).slice(0,12)}.json`;const info=await save(path.join(output,file),payload);descriptors.push({file,count:chunk.length,...info});chunk=[];bytes=0;}
  for(const row of rows){const size=Buffer.byteLength(JSON.stringify(row));if(bytes+size>400000 && chunk.length)await flush();chunk.push(row);bytes+=size;}await flush();searchManifest.buckets[prefix]=descriptors;
}
const searchManifestText=JSON.stringify(searchManifest);
index.search.manifest=`search/manifest-${hash(searchManifestText).slice(0,12)}.json`;
await save(path.join(output,index.search.manifest),searchManifestText);
index.generatedAt=iso();index.totalItems=itemCount;index.search.uniqueTitles=grouped.size;
index.coverage={acceptedSourceVenues:definitions.length,processedVenues:Object.keys(index.venues).length,pendingVenues:definitions.length-Object.keys(index.venues).length+(audit.statusCounts.pending||0),statusCounts:audit.statusCounts,...(audit.pausedReason?{pausedReason:audit.pausedReason}:{})};
await save(path.join(output,'index.json'),index);
if(args.has('--prune-untracked-search')){
  // Retain tracked historical assets for existing released tabs and every current reference.
  const searchRoot=path.resolve(output,'search'),relativeSearch=path.relative(root,searchRoot).split(path.sep).join('/');
  let tracked;
  try{tracked=new Set(execFileSync('git',['ls-files','--',relativeSearch],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(Boolean));}
  catch{audit.pruneWarnings=['git-tracked-assets-unavailable'];}
  if(tracked){
    const referenced=new Set([index.search.manifest,...Object.values(searchManifest.buckets).flat().map(entry=>entry.file)]);
    audit.prunedUntrackedSearchFiles=0;
    for(const entry of await fs.readdir(searchRoot,{withFileTypes:true})){
      if(!entry.isFile() || !/^(?:manifest(?:-[a-f0-9]{12})?|[a-f0-9]+-\d+(?:-[a-f0-9]{12})?)\.json$/.test(entry.name))continue;
      const file=path.resolve(searchRoot,entry.name),relative=path.relative(root,file).split(path.sep).join('/');
      if(!file.startsWith(searchRoot+path.sep) || tracked.has(relative) || referenced.has(`search/${entry.name}`))continue;
      try{await fs.rm(file);audit.prunedUntrackedSearchFiles++;}
      catch(error){(audit.pruneWarnings??=[]).push(`${entry.name}:${error.code}`);}
    }
  }
}
audit.generatedAt=iso();audit.totalItems=itemCount;audit.itemCoverage=itemCoverage;audit.catalogVenues=Object.values(index.venues).filter(v=>v.itemCount).length;audit.emptyCatalogs=Object.values(index.venues).filter(v=>v.status==='complete'&&!v.itemCount).length;audit.uniquePlaces=Object.keys(index.byPlaceId).length;audit.searchTitles=grouped.size;audit.searchBuckets=buckets.size;audit.pendingVenues=index.coverage.pendingVenues;
await save(path.join(output,'audit.json'),audit);
console.log(JSON.stringify({...audit,errors:audit.errors.length}));
clearInterval(progressTimer);await checkpoint(true);
