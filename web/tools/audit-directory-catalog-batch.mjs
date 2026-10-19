// Read-only comparison with a committed release; never changes source or public data.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { SOURCE_DIRECTORY_FOOD } from './source-directory-food.mjs';
import { flattenCategories, categoryPageMatches, sameCatalogRoot } from './directory-catalog-policy.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const revision=process.argv.find(arg=>arg.startsWith('--baseline='))?.slice(11)||'HEAD';
const baseline=execFileSync('git',['rev-parse','--verify',`${revision}^{commit}`],{cwd:root,encoding:'utf8'}).trim();
const gitFile=file=>execFileSync('git',['show',`${baseline}:${file}`],{cwd:root,maxBuffer:32*1024*1024});
const baseIndex=JSON.parse(gitFile('web/public/catalog-data/index.json'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const cacheDir=path.join(root,'.codex/artifacts/directory-catalogs/responses');
const report={checkedAt:new Date().toISOString(),baseline,baselineGeneratedAt:baseIndex.generatedAt,catalogsCompared:0,changedCatalogs:0,itemsBefore:0,itemsNow:0,cachedCategoryPagesChecked:0,decreased:[],rootChanged:[],rootCacheMismatch:[],pageAssociationMismatch:[],olderPageCache:[],cachePagesMissing:0,sourceIssues:{}};
const definitions=new Map(SOURCE_DIRECTORY_FOOD.map(def=>[def.sourceRecordId,def]));
async function cached(url,snapshotKey=''){
  try{return JSON.parse(gunzipSync(await fs.readFile(path.join(cacheDir,`${hash(snapshotKey?`${snapshotKey}\0${url}`:url)}.json.gz`))));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
}
for(const [id,meta] of Object.entries(baseIndex.venues)){
  if(!meta.file)continue;
  const bytes=await fs.readFile(path.join(root,'web/public/catalog-data',meta.file)),current=JSON.parse(bytes);
  report.catalogsCompared++;report.itemsBefore+=meta.itemCount;report.itemsNow+=current.items.length;
  if(current.items.length<meta.itemCount)report.decreased.push({id,before:meta.itemCount,now:current.items.length});
  for(const issue of current.sourceIssues||[])report.sourceIssues[issue.issue]=(report.sourceIssues[issue.issue]||0)+1;
  if(hash(bytes)===meta.sha256)continue;
  report.changedCatalogs++;
  const prior=JSON.parse(gitFile(`web/public/catalog-data/${meta.file}`));
  if(!sameCatalogRoot(prior,current))report.rootChanged.push({id,priorRootFetchedAt:prior.sourceRootFetchedAt,currentRootFetchedAt:current.sourceRootFetchedAt});
  const definition=definitions.get(id),slug=new URL(definition.sourceUrl).pathname.split('/').filter(Boolean).at(-1);
  const api=`https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/${encodeURIComponent(slug)}/assortment`;
  const source=await cached(api);
  if(!source || source.fetchedAt!==current.sourceRootFetchedAt || hash(JSON.stringify(source.data))!==current.sourceResponseSha256){report.rootCacheMismatch.push({id});continue;}
  const snapshotKey=hash(JSON.stringify({sourceResponseSha256:current.sourceResponseSha256,sourceRootFetchedAt:current.sourceRootFetchedAt,assortmentId:source.data.assortment_id||''}));
  for(const category of flattenCategories(source.data.categories).filter(category=>category.leaf&&category.slug)){
    let token='';const seen=new Set();
    do{
      const url=new URL(`${api}/categories/slug/${encodeURIComponent(category.slug)}`);if(token)url.searchParams.set('page_token',token);
      const page=await cached(url.href,snapshotKey)||await cached(url.href);
      if(!page){report.cachePagesMissing++;break;}
      report.cachedCategoryPagesChecked++;
      if(!categoryPageMatches(page.data,category.id))report.pageAssociationMismatch.push({id,categoryId:category.id});
      if(page.fetchedAt<current.sourceRootFetchedAt)report.olderPageCache.push({id,categoryId:category.id,fetchedAt:page.fetchedAt});
      token=page.data.metadata?.next_page_token||'';
      if(typeof token!=='string'||seen.has(token))break;seen.add(token);
    }while(token);
  }
}
report.valid=![report.decreased,report.rootChanged,report.rootCacheMismatch,report.pageAssociationMismatch,report.olderPageCache].some(values=>values.length);
console.log(JSON.stringify(report));
if(!report.valid)process.exitCode=1;
