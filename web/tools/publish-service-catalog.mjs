import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {SOURCE_SERVICE_CATALOG} from './source-service-catalog.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const sourceUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}};
export function validateSourceServiceCatalog(items, knownPlaceIds) {
  const seen=new Set();
  for(const item of items){
    if(!/^service_[a-z0-9_]+$/.test(item.id)||seen.has(item.id))throw new Error(`Invalid/repeated service ID: ${item.id}`);seen.add(item.id);
    if(item.type!=='service'||!item.title?.trim()||!item.description?.trim()||!item.providerName?.trim()||!/^\w+$/.test(item.providerId)||!item.categoryId||!sourceUrl(item.sourceUrl)||!/^\d{4}-\d{2}-\d{2}$/.test(item.sourceCheckedAt))throw new Error(`Invalid service provenance: ${item.id}`);
    if(!['branch','provider'].includes(item.scope)||!['onsite','digital','hybrid'].includes(item.channel)||!item.availabilityNote?.trim())throw new Error(`Missing service availability scope: ${item.id}`);
    if(!['unknown','fixed','from'].includes(item.priceKind)||item.currency!=='GEL'||(item.priceMinor===null?item.priceKind!=='unknown':!Number.isSafeInteger(item.priceMinor)||item.priceMinor<0||item.priceKind==='unknown'))throw new Error(`Invalid service price: ${item.id}`);
    if(item.priceMinor!==null&&(!Number.isSafeInteger(item.observedAtMs)||!Number.isSafeInteger(item.freshnessUntilMs)||item.freshnessUntilMs<=item.observedAtMs))throw new Error(`Missing price freshness: ${item.id}`);
    if(!Array.isArray(item.placeIds)||!item.placeIds.length||new Set(item.placeIds).size!==item.placeIds.length)throw new Error(`Invalid branch membership: ${item.id}`);
    for(const id of item.placeIds){
      if(knownPlaceIds&&!knownPlaceIds.has(id))throw new Error(`Unknown canonical service place: ${item.id} -> ${id}`);
      const evidence=item.branchEvidence?.find(e=>e.placeId===id);
      if(!sourceUrl(evidence?.sourceUrl)||!evidence?.evidence?.trim())throw new Error(`Missing branch evidence: ${item.id} -> ${id}`);
    }
    if(item.sourceUrlsByPlace&&Object.entries(item.sourceUrlsByPlace).some(([id,url])=>!item.placeIds.includes(id)||!sourceUrl(url)))throw new Error(`Invalid branch source URL: ${item.id}`);
    if(item.imageUrl&&!item.imageCredit)throw new Error(`Missing service image credit: ${item.id}`);
  }
  return true;
}

export async function publishServiceCatalog({items=SOURCE_SERVICE_CATALOG,output='web/public/catalog-data',placeData='web/public/place-data',generatedAt=new Date().toISOString()}={}){
  const manifest=JSON.parse(await readFile(join(placeData,'manifest.json'),'utf8'));
  const lookup=JSON.parse(await readFile(join(placeData,manifest.lookup.file),'utf8'));
  validateSourceServiceCatalog(items,new Set(Object.keys(lookup)));
  await mkdir(output,{recursive:true});
  const index={version:1,generatedAt,sourceCheckedAt:[...new Set(items.map(x=>x.sourceCheckedAt))].sort().at(-1),totalItems:items.length,totalPlaces:0,files:[],places:{}};
  const groups=new Map();for(const item of items){if(!groups.has(item.providerId))groups.set(item.providerId,[]);groups.get(item.providerId).push(item);}
  for(const [providerId,records]of groups){
    const payload={version:1,provider:{id:providerId,name:records[0].providerName},items:records};
    const text=JSON.stringify(payload),sha256=hash(text),file=`services-${providerId}-${sha256.slice(0,12)}.json`,bytes=Buffer.byteLength(text);
    if(bytes>4*1024*1024)throw new Error(`Service shard exceeds 4MiB: ${providerId}`);
    await writeFile(join(output,file),text);
    index.files.push({file,sha256,bytes,count:records.length,providerId});
    for(const item of records)for(const placeId of item.placeIds){
      const entry=index.places[placeId]||={files:[],count:0};
      if(!entry.files.includes(file))entry.files.push(file);entry.count++;
    }
  }
  index.totalPlaces=Object.keys(index.places).length;
  await writeFile(join(output,'services-index.json'),JSON.stringify(index));
  return index;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const index=await publishServiceCatalog();
  console.log(JSON.stringify({items:index.totalItems,places:index.totalPlaces,providers:index.files.length,bytes:index.files.reduce((sum,x)=>sum+x.bytes,0)}));
}
