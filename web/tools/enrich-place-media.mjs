/** Exact-entity Commons photo enrichment. See ENRICHING-PLACE-MEDIA.md. */
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {jpegDimensions} from './place-media-utils.mjs';
const ROOT=process.cwd(), CACHE=resolve('.codex/artifacts/place-enrichment/cache'), OUT=resolve('web/public/place-media');
const UA='GeoHubPlaceImporter/1.1 (https://geohub-main.pages.dev; licensed OpenStreetMap-linked place photographs)';
const option=name=>{const i=process.argv.indexOf(name);return i<0?'':process.argv[i+1];};
const limit=Number(option('--limit'))||Infinity;
await mkdir(CACHE,{recursive:true});await mkdir(OUT,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=value=>createHash('sha256').update(value).digest('hex');
const text=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&(?:amp|quot|apos|nbsp|lt|gt);/g,e=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&nbsp;':' ','&lt;':'<','&gt;':'>'}[e])).replace(/\s+/g,' ').trim();
const cleanTitle=value=>String(value||'').replace(/^File:/i,'File:').replaceAll('_',' ').trim();
async function request(url){
 const host=new URL(url).hostname;if(!['commons.wikimedia.org','www.wikidata.org','upload.wikimedia.org','thumb.wikimedia.org'].includes(host))throw Error('Unapproved Wikimedia host');
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(url,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(30000)}).catch(error=>({ok:false,status:0,error}));
  if(response.ok)return response;
  if(![0,429,500,502,503,504].includes(response.status)||attempt===2)throw Error('HTTP '+response.status);
  await sleep(Math.min(10000,Number(response.headers?.get('retry-after'))*1000||1500*(attempt+1)));
 }
}
async function json(url){const file=resolve(CACHE,hash(url)+'.json');try{return JSON.parse(await readFile(file,'utf8'));}catch{}const data=await (await request(url)).json();if(data.error)throw Error(data.error.code+': '+data.error.info);await writeFile(file,JSON.stringify(data));return data;}
async function pool(values,concurrency,fn){let index=0;await Promise.all(Array.from({length:concurrency},async()=>{for(;;){const i=index++;if(i>=values.length)return;await fn(values[i],i);}}));}
function api(host,params){const url=new URL(`https://${host}/w/api.php`);url.search=new URLSearchParams({format:'json',formatversion:'2',...params});return url.href;}
function coordinate(element){return element.center?{lat:element.center.lat,lng:element.center.lon}:{lat:element.lat,lng:element.lon};}
function near(element,point){if(!point||!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude))return false;const [x,y]=[point.longitude,point.latitude];if(element.bounds){const b=element.bounds;if(x>=b[0]-.001&&x<=b[2]+.001&&y>=b[1]-.001&&y<=b[3]+.001)return true;}const p=coordinate(element);const meters=Math.hypot((p.lng-x)*Math.cos(y*Math.PI/180)*111320,(p.lat-y)*111320);return meters<=250;}
function captureDate(raw){const value=text(raw);if(!value)return '';const iso=value.match(/^(?:Taken on\s*)?(\d{4}-\d{2}-\d{2})(?:\D|$)/);if(iso)return iso[1];const named=value.match(/(?:Taken on\s*)?(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);if(named){const month=['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(named[2].toLowerCase())+1;return `${named[3]}-${String(month).padStart(2,'0')}-${named[1].padStart(2,'0')}`;}return /^\d{4}$/.test(value)?value:'';}
const input=JSON.parse(await readFile(option('--input')||'.codex/artifacts/place-import/osm-tbilisi.json','utf8'));
const manifest=JSON.parse(await readFile('web/public/place-data/manifest.json','utf8'));
const lookup=JSON.parse(await readFile('web/public/place-data/'+manifest.lookup.file,'utf8'));
const elements=input.elements.filter(e=>Object.hasOwn(lookup,`osm_${e.type}_${e.id}`)&&['wikidata','wikimedia_commons','image'].some(k=>e.tags?.[k]));
const skipped=[],targets=[],seenTargets=new Set();
function skip(element,reason,detail=''){skipped.push({placeId:`osm_${element.type}_${element.id}`,name:element.tags?.['name:ka']||element.tags?.name||'',reason,detail});}
function target(element,title,proof){title=cleanTitle(title);if(!/^File:.+\.(?:jpe?g|png|webp)$/i.test(title)){skip(element,'not-photo-file',title);return;}const placeId=`osm_${element.type}_${element.id}`,key=placeId+'|'+title;if(seenTargets.has(key))return;seenTargets.add(key);targets.push({placeId,title,caption:element.tags['name:ka']||element.tags.name||element.tags['name:en']||title.slice(5).replace(/\.[^.]+$/,''),element,proof});}
for(const element of elements){const t=element.tags; if(/^File:/i.test(t.wikimedia_commons||''))target(element,t.wikimedia_commons,{type:'osm-commons-file',tag:'wikimedia_commons',value:t.wikimedia_commons});if(t.image){try{const u=new URL(t.image);if(u.hostname==='commons.wikimedia.org'&&u.pathname.startsWith('/wiki/File:'))target(element,decodeURIComponent(u.pathname.slice(6)),{type:'osm-image-file',tag:'image',value:t.image});else skip(element,'external-image-license-unverified',t.image);}catch{skip(element,'external-image-license-unverified',t.image);}}}
console.log(JSON.stringify({stage:'direct-candidates',places:elements.length,links:targets.length}));
const qids=[...new Set(elements.map(e=>e.tags.wikidata).filter(q=>/^Q\d+$/.test(q||'')))];
const entities={};
for(let offset=0;offset<qids.length;offset+=40){const ids=qids.slice(offset,offset+40);try{const data=await json(api('www.wikidata.org',{action:'wbgetentities',ids:ids.join('|'),props:'claims|labels',languages:'en|ka'}));Object.assign(entities,data.entities);}catch(error){for(const element of elements.filter(e=>ids.includes(e.tags.wikidata)))skip(element,'wikidata-request-failed',error.message);}await sleep(80);}
for(const element of elements){const qid=element.tags.wikidata;if(!qid)continue;const entity=entities[qid];if(!entity||entity.missing){skip(element,'wikidata-entity-missing',qid);continue;}const claims=entity.claims||{};
 if((claims.P31||[]).some(c=>c.mainsnak?.datavalue?.value?.id==='Q5')){skip(element,'wikidata-person-not-place',qid);continue;}
 const points=(claims.P625||[]).filter(c=>c.rank!=='deprecated').map(c=>c.mainsnak?.datavalue?.value);
 if(!points.some(p=>near(element,p))){skip(element,'wikidata-coordinate-mismatch-or-missing',qid);continue;}
 const images=(claims.P18||[]).filter(c=>c.rank!=='deprecated'&&typeof c.mainsnak?.datavalue?.value==='string').sort((a,b)=>(b.rank==='preferred')-(a.rank==='preferred')).slice(0,2);
 if(!images.length)skip(element,'wikidata-no-image',qid);
 for(const image of images)target(element,'File:'+image.mainsnak.datavalue.value,{type:'osm-wikidata-image',tag:'wikidata',value:qid,entityUrl:'https://www.wikidata.org/wiki/'+qid,claimId:image.id,coordinateVerified:true,coordinate:points.find(p=>near(element,p)),spatialMatch:'within-footprint-or-250m'});
}
for(const element of elements.filter(e=>/^Category:/i.test(e.tags.wikimedia_commons||'')&&!targets.some(t=>t.placeId===`osm_${e.type}_${e.id}`)))skip(element,'category-only-no-verified-file',element.tags.wikimedia_commons);
const priority=target=>target.element.tags.historic==='memorial'?3:target.element.tags.tourism==='artwork'?2:0;
const selected=targets.sort((a,b)=>priority(a)-priority(b)).slice(0,limit),titles=[...new Set(selected.map(t=>t.title))],metadata=new Map();
const chunks=[];for(let i=0;i<titles.length;i+=5)chunks.push(titles.slice(i,i+5));
console.log(JSON.stringify({stage:'all-candidates',places:new Set(selected.map(t=>t.placeId)).size,links:selected.length,files:titles.length,wikidataEntities:Object.keys(entities).length}));
await pool(chunks,2,async(chunk,index)=>{try{
 const data=await json(api('commons.wikimedia.org',{action:'query',prop:'imageinfo',iiprop:'url|mime|size|timestamp|extmetadata',iiextmetadatafilter:'Artist|Attribution|LicenseShortName|LicenseUrl|DateTimeOriginal|ImageDescription|Restrictions|Copyrighted',iiurlwidth:'900',redirects:'1',titles:chunk.join('|')}));
 const pages=data.query?.pages||[];for(const title of chunk){let normalized=title;for(const entry of data.query?.normalized||[])if(cleanTitle(entry.from)===cleanTitle(normalized))normalized=entry.to;for(const entry of data.query?.redirects||[])if(cleanTitle(entry.from)===cleanTitle(normalized))normalized=entry.to;metadata.set(title,pages.find(p=>cleanTitle(p.title)===cleanTitle(normalized))||{missing:true,title});}
 }catch(error){for(const title of chunk)metadata.set(title,{error:error.message,title});}
 if(index%20===0)console.log(JSON.stringify({stage:'metadata',batch:index+1,total:chunks.length}));await sleep(200);
});
await writeFile('.codex/artifacts/place-enrichment/metadata.json',JSON.stringify(Object.fromEntries(metadata)));
const accepted=new Map(),fileSkips=new Map();let downloaded=0,bytesTotal=0;
await pool(titles,4,async(title,index)=>{
 const entry=metadata.get(title),image=entry?.imageinfo?.[0],meta=image?.extmetadata||{};
 const reject=reason=>fileSkips.set(title,reason);
 if(!image){reject(entry?.error?'metadata-request-failed':'commons-file-missing');return;}
 if(image.mime!=='image/jpeg'){reject('not-jpeg-photograph');return;}
 const license=text(meta.LicenseShortName?.value),licenseUrl=text(meta.LicenseUrl?.value).replace(/^http:/,'https:');
 if(!/^(CC BY(?:-SA)? [234]\.0|CC0)$/.test(license)||!/^https:\/\/creativecommons\.org\/(?:licenses\/(?:by|by-sa)\/|publicdomain\/zero\/)/.test(licenseUrl)){reject('unsupported-or-unverified-license');return;}
 const author=text(meta.Attribution?.value||meta.Artist?.value);if(!author||author.length>2000){reject('missing-or-unusable-author');return;}
 const artist=String(meta.Artist?.value||'');let authorUrl=text(artist.match(/href=["']([^"']+)["']/i)?.[1]);if(authorUrl.startsWith('//'))authorUrl='https:'+authorUrl;if(authorUrl.startsWith('/'))authorUrl='https://commons.wikimedia.org'+authorUrl;if(!/^https?:\/\//.test(authorUrl))authorUrl='';
 let downloadUrl=image.thumburl||image.url;const u=new URL(downloadUrl);u.search='';downloadUrl=u.href;
 const cachePath=resolve(CACHE,hash(downloadUrl)+'.jpg');let bytes;
 try{bytes=await readFile(cachePath);}catch{}
 try{
  if(!bytes){const response=await request(downloadUrl);if(!response.headers.get('content-type')?.startsWith('image/jpeg'))throw Error('Wrong image type');bytes=Buffer.from(await response.arrayBuffer());await writeFile(cachePath,bytes);await sleep(200);}
  if(bytes.length>260000){const smaller=new URL(downloadUrl);smaller.pathname=smaller.pathname.replace(/\/\d+px-([^/]+)$/,'/500px-$1');downloadUrl=smaller.href;const smallerPath=resolve(CACHE,hash(downloadUrl)+'.jpg');try{bytes=await readFile(smallerPath);}catch{const response=await request(downloadUrl);if(!response.headers.get('content-type')?.startsWith('image/jpeg'))throw Error('Wrong image type');bytes=Buffer.from(await response.arrayBuffer());await writeFile(smallerPath,bytes);}}
  if(bytes.length>400000||bytes.length<100||bytes[0]!==0xff||bytes[1]!==0xd8){reject('oversized-or-invalid-jpeg');return;}
  const sha256=hash(bytes),url='/place-media/commons-'+sha256.slice(0,12)+'.jpg';await writeFile(resolve(OUT,url.split('/').pop()),bytes);
  const rawDateTaken=text(meta.DateTimeOriginal?.value);accepted.set(title,{url,sourceTitle:entry.title,sourceUrl:image.descriptionurl,originalUrl:image.url.split('?')[0],author,authorUrl,license,licenseUrl,dateTaken:captureDate(rawDateTaken),rawDateTaken,uploadTimestamp:image.timestamp,downloadedAt:new Date().toISOString(),bytes:bytes.length,sha256,preview:jpegDimensions(bytes),changes:'Wikimedia thumbnail; displayed resized and cropped to fit.',downloadUrl});
  downloaded++;bytesTotal+=bytes.length;
 }catch(error){reject('download-failed:'+error.message);}
 if(index%40===0)console.log(JSON.stringify({stage:'download',processed:index+1,total:titles.length,downloaded,bytesTotal}));
});
const existing=JSON.parse(await readFile(resolve(OUT,'credits.json'),'utf8')).photos.filter(p=>!p.enrichmentVersion);
const photos=[...existing];
for(const row of selected){const file=accepted.get(row.title);if(!file){skip(row.element,fileSkips.get(row.title)||'file-unavailable',row.title);continue;}
 if(photos.some(p=>p.placeId===row.placeId&&(p.sourceTitle===file.sourceTitle||p.url===file.url)))continue;
 photos.push({...file,placeId:row.placeId,caption:row.caption,enrichmentVersion:1,sourceMapping:{...row.proof,osmUrl:`https://www.openstreetmap.org/${row.element.type}/${row.element.id}`,osmSnapshot:input.source.sourceDate}});
}
photos.sort((a,b)=>a.placeId.localeCompare(b.placeId)||a.url.localeCompare(b.url));
await writeFile(resolve(OUT,'credits.json'),JSON.stringify({version:2,generatedAt:new Date().toISOString(),photos},null,2)+'\n');
const authorTable=[],licenseTable=[],imageTable=[],placeRows={};const intern=(table,value)=>{const key=JSON.stringify(value);let i=table.findIndex(row=>JSON.stringify(row)===key);if(i<0){i=table.length;table.push(value);}return i;};
for(const p of photos.filter(p=>p.enrichmentVersion)){
 const ai=intern(authorTable,[p.author,p.authorUrl]),li=intern(licenseTable,[p.license,p.licenseUrl]);
 const pi=intern(imageTable,[p.url.split('/').pop().replace(/^commons-|\.jpg$/g,''),p.sourceTitle,ai,li,p.dateTaken]);
 (placeRows[p.placeId]||=[]).push([pi,p.caption]);
}
const generated=`// Generated by web/tools/enrich-place-media.mjs; exact OSM entity links only.\nexport const authors=${JSON.stringify(authorTable)};\nexport const licenses=${JSON.stringify(licenseTable)};\nexport const images=${JSON.stringify(imageTable)};\nexport const places=${JSON.stringify(placeRows)};\n`;
await writeFile('web/src/lib/curatedPlaceMedia.generated.js',generated);
const skipCounts={};for(const row of skipped)skipCounts[row.reason]=(skipCounts[row.reason]||0)+1;
const summary={sourceDate:input.source.sourceDate,candidatePlaces:elements.length,candidateLinks:selected.length,uniqueCandidates:titles.length,downloadedFiles:accepted.size,placesWithPhotos:new Set(photos.map(p=>p.placeId)).size,photoLinks:photos.length,totalBytes:[...new Map(photos.map(p=>[p.url,p.bytes])).values()].reduce((a,b)=>a+b,0),runtimeMetadataBytes:Buffer.byteLength(generated),missingCaptureDates:photos.filter(p=>!p.dateTaken).length,skips:skipCounts};
await writeFile('.codex/artifacts/place-enrichment/report.json',JSON.stringify({summary,skipped},null,2));
console.log(JSON.stringify({stage:'COMPLETE',...summary}));
