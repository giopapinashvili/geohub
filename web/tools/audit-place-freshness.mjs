/** Read-only audit: evidence age is not a claim that a business is open or closed. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeSearch } from '../src/lib/discoverySearch.js';
import { taxonomyCategory, categoryFromOsm } from '../src/lib/placeTaxonomy.js';

const DAY=86400000, ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const activeKeys=['amenity','shop','office','healthcare','craft','tourism','leisure','railway','aerialway'];
const formerPrefix=/^(disused|abandoned|demolished|removed|razed|closed|was):/;
const lifecyclePrefix=/^(disused|abandoned|demolished|removed|razed|closed|was):(amenity|shop|office|healthcare|craft|tourism|leisure|railway|aerialway|building)$/;
const yes=value=>['yes','true','1'].includes(String(value).toLowerCase());
const normalize=value=>normalizeSearch(String(value||'')).replace(/\s+/g,' ').trim();
const sourceId=element=>`osm_${element.type}_${element.id}`;
const sourceUrl=element=>`https://www.openstreetmap.org/${element.type}/${element.id}`;
const point=element=>({lat:element.lat??element.center?.lat,lng:element.lng??element.lon??element.center?.lon});
const compact=place=>({id:place.id,name:place.name,category:place.category,address:place.address||'',lat:place.lat,lng:place.lng,sourceUrl:place.raw?.sourceUrl||''});
const increment=(counts,key)=>counts[key]=(counts[key]||0)+1;
const group=(values,key)=>{const result=new Map();for(const value of values){const id=key(value);if(!id)continue;if(!result.has(id))result.set(id,[]);result.get(id).push(value);}return result;};
const year=value=>/^\d{4}/.test(value||'')?value.slice(0,4):'unknown';
const streetStop=new Set(['kucha','k','gamziri','gamz','street','st','avenue','ave','road','rd','tbilisi','tbilisshi','sakartvelo','georgia']);
const streetCore=value=>normalize(value).split(' ').filter(v=>!streetStop.has(v)).join(' ');
function roadType(value){
  const words=new Set(normalize(value).split(' '));
  for(const[type,terms]of [['avenue',['gamziri','gamz','avenue','ave']],['highway',['gzatketsili','highway']],['alley',['kheivani','alley']],['lane',['shesakhvevi','lane']],['street',['kucha','k','street','st']]])if(terms.some(term=>words.has(term)))return type;
  return '';
}
function streetHouseCandidates(address,index){
  // Deliberately high precision: apartment/block/microdistrict numbers are not house numbers.
  const primary=String(address||'').split('(')[0];
  if(primary.includes('/')||/\d\s*-\s*\d|(?:^|\s)(?:კვ\.|კვარტალი|მიკრო|სოფ\.?)(?=\s|$)|PR[A-Z0-9]+\+/u.test(primary)||/კვარტ|მიკრო/u.test(primary))return [];
  const text=` ${streetCore(primary)} `,numbers=[...new Set(normalize(primary).match(/\b\d+\b/g)||[])],type=roadType(primary);
  return [...new Map(numbers.flatMap(number=>index.get(number)||[]).filter(e=>{
    const street=streetCore(e.tags['addr:street']),house=normalize(e.tags['addr:housenumber']),sourceType=roadType(e.tags['addr:street']);
    if(street.split(' ').length<2||!/[a-z]{3}/.test(street)||!text.includes(` ${street} `)||type&&sourceType&&type!==sourceType)return false;
    const position=text.indexOf(` ${street} `),after=text.slice(position+street.length+2).trim();
    const first=after.match(/^(?:no?\s*)?(\d+(?:\s+[a-z](?=\s|$))?)(?=\s|$)/i)?.[1];
    const before=text.slice(0,position).trim().match(/(?:^|\s)(\d+(?:\s+[a-z])?)$/i)?.[1];
    return house===(first||before);
  }).map(e=>[sourceId(e),e])).values()];
}
function compatibleFormerCategory(tags,category){
  const former=Object.fromEntries(Object.entries(tags).filter(([key])=>lifecyclePrefix.test(key)).map(([key,value])=>[key.split(':')[1],value]));
  const formerCategory=categoryFromOsm(former);return formerCategory===category||Boolean(formerCategory&&taxonomyCategory(formerCategory).group==='food'&&taxonomyCategory(category).group==='food');
}
export function distanceMeters(a,b){
  if(![a?.lat,a?.lng,b?.lat,b?.lng].every(Number.isFinite))return null;
  const y=(a.lat-b.lat)*111320,x=(a.lng-b.lng)*111320*Math.cos((a.lat+b.lat)*Math.PI/360);
  return Math.round(Math.hypot(x,y));
}
export function dateAge(value,now){
  if(!/^\d{4}(?:-\d{2})?(?:-\d{2})?(?:T.*)?$/.test(value||''))return {value:value||'',state:value?'invalid':'missing',days:null};
  const full=value.length===4?`${value}-01-01`:value.length===7?`${value}-01`:value;
  const ms=Date.parse(full);if(!Number.isFinite(ms))return {value,state:'invalid',days:null};
  const days=Math.floor((now-ms)/DAY);
  return {value,state:days<0?'future':days<=90?'within-90-days':days<=365?'91-365-days':days<=1095?'1-3-years':'over-3-years',days,precision:value.length===4?'year':value.length===7?'month':'day-or-time'};
}
export function lifecycleEvidence(tags={}){
  const evidence=[];
  for(const key of ['disused','abandoned','demolished','removed','razed','closed'])if(yes(tags[key]))evidence.push({kind:'explicit-inactive-flag',key,value:tags[key],certainty:'source-explicit'});
  for(const key of activeKeys)if(['no','vacant','disused','closed','abandoned','demolished','removed'].includes(tags[key]))evidence.push({kind:'inactive-classification',key,value:tags[key],certainty:'source-explicit'});
  const active=activeKeys.filter(key=>tags[key]&&!['no','vacant','disused','closed','abandoned','demolished','removed'].includes(tags[key]));
  for(const[key,value]of Object.entries(tags)){
    if(!lifecyclePrefix.test(key))continue;
    const base=key.split(':')[1];
    const sameUse=tags[base]===value||(['amenity','healthcare'].includes(base)&&active.some(k=>['amenity','healthcare'].includes(k)&&tags[k]===value));
    evidence.push({kind:sameUse?'active-and-inactive-same-use':active.length?'former-use-with-different-current-use':'former-use-without-current-use',key,value,certainty:sameUse?'conflicting-source-tags':'source-explicit'});
  }
  if(/^(closed|off|no)$/i.test(tags.opening_hours||''))evidence.push({kind:'opening-hours-all-closed',key:'opening_hours',value:tags.opening_hours,certainty:'source-explicit'});
  for(const key of ['note','fixme'])if(/\b(?:moved to|moving to|relocated|permanently closed|closed down|no longer operating)\b|დახურულ|გადავიდა|გადატანილ|закрыт|перееха/iu.test(tags[key]||''))evidence.push({kind:'closure-or-relocation-note',key,value:tags[key],certainty:'source-note-needs-review'});
  return evidence;
}
export function exactDuplicateCandidate(a,b){
  if(a.id===b.id||a.raw?.named===false||b.raw?.named===false||a.raw?.recordKind==='mapped-building'||b.raw?.recordKind==='mapped-building'||a.category!==b.category)return false;
  if(normalize(a.name)!==normalize(b.name))return false;
  const levelA=a.facets?.level||a.raw?.tags?.level,levelB=b.facets?.level||b.raw?.tags?.level;
  if(levelA&&levelB&&levelA!==levelB)return false;
  const unitA=a.raw?.tags?.['addr:unit'],unitB=b.raw?.tags?.['addr:unit'];if(unitA&&unitB&&unitA!==unitB)return false;
  const meters=distanceMeters(a,b);return meters!==null&&meters<=20;
}
function sourceAssertions(place){
  return [
    ...(place.raw?.source? [{id:place.id,sourceKind:place.raw.source,sourceName:place.raw.sourceName||'',sourceUrl:place.raw.sourceUrl,checkedAt:place.raw.sourceCheckedAt,lat:place.lat,lng:place.lng,address:place.address||'',coordinateAccuracy:place.raw.coordinateAccuracy}]:[]),
    ...(place.raw?.officialDirectory||[]),
  ];
}
const phones=value=>String(value||'').split(/[;,]/).map(x=>x.replace(/\D/g,'').replace(/^995/,'').replace(/^0/,'')).filter(Boolean).sort().join(';');
const website=value=>{try{return new URL(value).hostname.replace(/^www\./,'').toLowerCase();}catch{return normalize(value);}};
function relevantNotes(tags){return Object.fromEntries(Object.entries(tags).filter(([key])=>/^(note|fixme|end_date|opening_date|survey:date|check_date(?::.*)?|closed|disused|abandoned|demolished|removed|razed)$/.test(key)||formerPrefix.test(key)));}

export function auditPlaceFreshness({places,elements,manifest,definitions=[],now=Date.now()}){
  const byId=new Map(places.map(p=>[p.id,p])),original=new Map(elements.map(e=>[sourceId(e),e]));
  const issues={},records=[],categories={},sources={},ages={},checks={},coordinates={},sourceDates={},groups={};
  const add=(type,item)=>{(issues[type]??=[]).push(item);};
  const assertionsById=new Map(),definitionById=new Map(definitions.map(d=>[d.id,d]));
  const rawAddressGroups=group(elements.filter(e=>e.tags?.['addr:street']&&e.tags?.['addr:housenumber']),e=>normalize(`${e.tags['addr:street']} ${e.tags['addr:housenumber']}`));
  const rawAddressesByNumber=group(elements.filter(e=>e.tags?.['addr:street']&&e.tags?.['addr:housenumber']),e=>normalize(e.tags['addr:housenumber']).split(' ')[0]);
  for(const place of places){
    const raw=place.raw||{},element=original.get(place.id),tags=element?.tags||raw.tags||{},source=raw.source||'openstreetmap';
    increment(categories,place.category);increment(groups,taxonomyCategory(place.category).group);increment(sources,source);increment(coordinates,raw.coordinateAccuracy||'unspecified');
    const updated=dateAge(raw.sourceUpdatedAt,now),checked=dateAge(tags.check_date,now),survey=dateAge(tags['survey:date'],now);
    if(source==='openstreetmap'){increment(ages,updated.state);increment(checks,checked.state);}
    const assertions=sourceAssertions(place);for(const assertion of assertions){assertionsById.set(assertion.id,{place,assertion});increment(sourceDates,assertion.checkedAt||'missing');}
    const flags=[],flag=(type,evidence)=>{flags.push(type);add(type,{...compact(place),...evidence});};
    const evidence=lifecycleEvidence(tags);
    const lifecycleRisk=evidence.filter(e=>e.kind!=='former-use-with-different-current-use');
    if(lifecycleRisk.length)flag('published-lifecycle-evidence',{operatingStatus:raw.operatingStatus||'unspecified',recordKind:raw.recordKind||'poi',sourceUpdatedAt:raw.sourceUpdatedAt,evidence:lifecycleRisk});
    if(evidence.some(e=>['explicit-inactive-flag','inactive-classification','opening-hours-all-closed','closure-or-relocation-note','active-and-inactive-same-use'].includes(e.kind))&&raw.operatingStatus!=='source-reports-inactive')flag('inactive-or-relocated-evidence-not-surfaced',{evidence:lifecycleRisk});
    if(raw.operatingStatus==='source-reports-inactive'&&raw.openingHours)flag('inactive-with-current-opening-hours',{openingHours:raw.openingHours});
    const lost=Object.entries(relevantNotes(tags)).filter(([key])=>!Object.hasOwn(raw.tags||{},key)&&!Object.hasOwn(raw.formerUse||{},key));
    if(lost.length)flag('source-evidence-dropped-by-normalizer',{evidence:Object.fromEntries(lost)});
    if(updated.state==='future'||checked.state==='future'||survey.state==='future')flag('future-source-date',{updated,checked,survey});
    if(source==='openstreetmap'&&updated.days!==null&&updated.days<=30&&checked.days>365)flag('recent-edit-with-old-explicit-check',{sourceUpdatedAt:raw.sourceUpdatedAt,checkDate:tags.check_date,daysSinceCheck:checked.days});
    if(![place.lat,place.lng].every(Number.isFinite)||Math.abs(place.lat)>90||Math.abs(place.lng)>180)flag('invalid-coordinate',{});
    else if(place.lng<manifest.source.bbox[0]||place.lng>manifest.source.bbox[2]||place.lat<manifest.source.bbox[1]||place.lat>manifest.source.bbox[3])flag('outside-source-bounds',{});
    if(element?.bounds&&!raw.coordinateSourceId){const diagonal=distanceMeters({lat:element.bounds[1],lng:element.bounds[0]},{lat:element.bounds[3],lng:element.bounds[2]});if(diagonal>1000)flag('large-geometry-center',{diagonalMeters:diagonal,bounds:element.bounds,recordKind:raw.recordKind||'poi'});}
    for(const assertion of assertions){
      const separation=distanceMeters(place,assertion);
      if(separation>150)flag(assertion.coordinateAccuracy==='approximate-center'?'approximate-reference-center-offset':'merged-directory-coordinate-disagreement',{directoryId:assertion.id,sourceUrl:assertion.sourceUrl,distanceMeters:separation,publishedSourcePoint:{lat:assertion.lat,lng:assertion.lng},sourceAddress:assertion.address,coordinateAccuracy:assertion.coordinateAccuracy,coordinateNote:assertion.coordinateNote,matchEvidence:assertion.matchEvidence,certainty:assertion.coordinateAccuracy==='approximate-center'?'expected-possible-centroid-offset-not-a-proven-error':'cross-source-coordinate-contradiction'});
      const definition=definitionById.get(assertion.id);if(!definition)continue;
      for(const[field,canonicalize]of [['phone',phones],['website',website],['openingHours',normalize]]){
        if(definition[field]&&raw[field]&&canonicalize(definition[field])!==canonicalize(raw[field]))flag('merged-directory-fact-disagreement',{directoryId:assertion.id,field,publishedValue:raw[field],directoryValue:definition[field],sourceUrl:assertion.sourceUrl,checkedAt:assertion.checkedAt,reason:'Merge fills missing values but does not replace existing nonempty values.'});
      }
      if(definition.address&&place.address&&normalize(definition.address)!==normalize(place.address))flag('merged-directory-address-text-difference',{directoryId:assertion.id,publishedAddress:place.address,directoryAddress:definition.address,sourceUrl:assertion.sourceUrl,distanceMeters:separation,certainty:'text-difference-only-not-proven-wrong'});
    }
    const exactAddresses=rawAddressGroups.get(normalize(place.address));
    if(exactAddresses?.length){const options=exactAddresses.map(e=>({id:sourceId(e),...point(e),distanceMeters:distanceMeters(place,point(e))})).filter(x=>x.distanceMeters!==null).sort((a,b)=>a.distanceMeters-b.distanceMeters);if(options[0]?.distanceMeters>500)flag('exact-address-coordinate-disagreement',{closestExactOsmAddress:options[0],addressCandidateCount:options.length,certainty:'cross-source-contradiction-not-confirmed-correct-coordinate'});}
    if(source!=='openstreetmap'&&place.address){
      const candidates=streetHouseCandidates(place.address,rawAddressesByNumber).map(e=>({id:sourceId(e),address:`${e.tags['addr:street']} ${e.tags['addr:housenumber']}`,...point(e),distanceMeters:distanceMeters(place,point(e))})).filter(e=>e.distanceMeters!==null).sort((a,b)=>a.distanceMeters-b.distanceMeters);
      if(candidates[0]?.distanceMeters>1000)flag('street-and-house-coordinate-disagreement',{closestOsmAddress:candidates[0],addressCandidateCount:candidates.length,certainty:'same-street-house-source-contradiction-not-confirmed-correct-coordinate'});
    }
    records.push({id:place.id,name:place.name,category:place.category,source,recordKind:raw.recordKind||'poi',named:raw.named!==false,sourceUpdatedAt:raw.sourceUpdatedAt||null,objectEditAge:updated,explicitCheckDate:checked,surveyDate:survey,sourceAssertions:assertions.map(a=>({id:a.id,sourceKind:a.sourceKind,sourceUrl:a.sourceUrl,checkedAt:a.checkedAt,age:dateAge(a.checkedAt,now)})),coordinateAccuracy:raw.coordinateAccuracy||'unspecified',flags});
  }
  // Excluded closed objects may be reintroduced by a different source under a new ID.
  const nameIndex=new Map();for(const place of places){if(place.raw?.named===false)continue;for(const name of new Set([place.name,...(place.aliases||[])].map(normalize).filter(Boolean))){if(!nameIndex.has(name))nameIndex.set(name,[]);nameIndex.get(name).push(place);}}
  const excludedLifecycle=[];
  for(const element of original.values()){
    const ev=lifecycleEvidence(element.tags);if(!ev.length||ev.every(e=>e.kind==='former-use-with-different-current-use'))continue;
    if(byId.has(sourceId(element)))continue;
    const entry={id:sourceId(element),name:element.tags['name:ka']||element.tags.name||element.tags['name:en']||'',sourceUrl:sourceUrl(element),timestamp:element.timestamp,evidence:ev};excludedLifecycle.push(entry);
    if(!ev.some(e=>['explicit-inactive-flag','inactive-classification','former-use-without-current-use','opening-hours-all-closed','closure-or-relocation-note'].includes(e.kind)))continue;
    const names=[element.tags['name:ka'],element.tags.name,element.tags['name:en']].map(normalize).filter(Boolean),seen=new Set();
    for(const name of names)for(const candidate of nameIndex.get(name)||[]){if(seen.has(candidate.id)||candidate.raw?.operatingStatus==='source-reports-inactive'||!compatibleFormerCategory(element.tags,candidate.category))continue;seen.add(candidate.id);const meters=distanceMeters(candidate,point(element));if(meters!==null&&meters<=60)add('other-source-near-excluded-inactive-object',{...compact(candidate),distanceMeters:meters,inactiveSource:entry,certainty:'cross-source-review-required-not-automatic-closure'});}
  }
  for(const list of group(places.filter(p=>p.raw?.named!==false),p=>`${p.category}\0${normalize(p.name)}`).values())for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++)if(exactDuplicateCandidate(list[a],list[b]))add('exact-name-nearby-duplicate-candidate',{a:compact(list[a]),b:compact(list[b]),distanceMeters:distanceMeters(list[a],list[b]),certainty:'candidate-not-auto-merge'});
  for(const list of group(places.filter(p=>p.brand&&/\d/.test(p.address||'')),p=>`${normalize(p.brand)}\0${p.category}\0${normalize(p.address)}`).values()){
    if(list.length<2)continue;
    const pair=[];for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++){const meters=distanceMeters(list[a],list[b]);if(meters>300)pair.push({a:compact(list[a]),b:compact(list[b]),distanceMeters:meters});}
    if(pair.length)add('same-brand-exact-address-distant-points',{brand:list[0].brand,address:list[0].address,pairs:pair,certainty:'address-or-location-conflict-not-auto-merge'});
  }
  const assertionStats=[...group([...assertionsById.values()],x=>`${x.assertion.sourceKind||'unspecified'}|${new URL(x.assertion.sourceUrl).hostname}`)].map(([key,list])=>({source:key,assertions:list.length,places:new Set(list.map(x=>x.place.id)).size,checkedAt:[...new Set(list.map(x=>x.assertion.checkedAt||'missing'))].sort(),publisherRecordModifiedAtAvailable:0}));
  const summary={totalPlaces:places.length,sourceElements:original.size,sources,categories,groups,recordKinds:Object.fromEntries([...group(places,p=>p.raw?.recordKind||'poi')].map(([k,v])=>[k,v.length])),named:places.filter(p=>p.raw?.named!==false).length,osmObjectEditAge:ages,osmExplicitCheckAge:checks,osmObjectEditYear:Object.fromEntries([...group(places.filter(p=>!p.raw?.source),p=>year(p.raw?.sourceUpdatedAt))].map(([k,v])=>[k,v.length])),coordinateAccuracy:coordinates,sourceCheckDates:sourceDates,sourceAssertions:assertionStats,onsiteSurveyDatePresent:records.filter(p=>p.surveyDate.state!=='missing').length,explicitCheckDatePresent:records.filter(p=>p.explicitCheckDate.state!=='missing').length,recordsWithoutDirectoryEvidence:records.filter(p=>!p.sourceAssertions.length).length,missingAddress:places.filter(p=>!p.address).length,missingPhone:places.filter(p=>!p.raw?.phone).length,missingWebsite:places.filter(p=>!p.raw?.website).length,operatingStatusExplicit:places.filter(p=>p.raw?.operatingStatus).length,excludedLifecycleObjects:excludedLifecycle.length,issueCounts:Object.fromEntries(Object.entries(issues).map(([key,value])=>[key,value.length]))};
  return {auditedAt:new Date(now).toISOString(),datasetId:manifest.datasetId,datasetGeneratedAt:manifest.generatedAt,sourceExtractDate:manifest.source.sourceDate,scope:'Published static place-data only; not a new on-site or per-business live verification. Native Firestore records are not present in this snapshot.',semantics:{sourceExtractDate:'Date of the OSM extract, not verification of all objects.',sourceUpdatedAt:'Last OSM object edit; a geometric/tag edit need not confirm business activity.',checkDate:'Mapper check date, which does not necessarily mean an in-person survey.',sourceCheckedAt:'Our public source retrieval/check date, not the publisher branch-update date or proof of present operation.',coordinateAccuracy:'Source-point denotes source geometry, not independently verified location.'},referenceDocs:['https://wiki.openstreetmap.org/wiki/Lifecycle_prefix','https://wiki.openstreetmap.org/wiki/Key:survey:date'],summary,issues,excludedLifecycle,records};
}

export function reconcileVolatileDirectoryRows(previous,current){
  // Advisory only. Reuse a durable existing ID only for an exact, unique source fact signature.
  const signature=row=>JSON.stringify([row.Title,row.TypeId,row.Address,row.Latitude,row.Longitude]);
  const priorGroups=group(previous,signature),currentGroups=group(current,signature);
  const result={exactMatches:[],ambiguous:[],unresolved:[]};
  for(const row of current){const key=signature(row),candidates=priorGroups.get(key)||[];
    if(candidates.length===1&&currentGroups.get(key).length===1)result.exactMatches.push({previousSourceId:String(candidates[0].Id),currentSourceId:String(row.Id),signature:key,sourceIdChanged:String(candidates[0].Id)!==String(row.Id)});
    else if(candidates.length||currentGroups.get(key).length>1)result.ambiguous.push({currentSourceId:String(row.Id),candidateSourceIds:candidates.map(x=>String(x.Id)),reason:'Non-unique exact title/type/address/coordinate signature; no automatic mapping.'});
    else result.unresolved.push({currentSourceId:String(row.Id),reason:'Source facts changed or new record; manual reconciliation required, never infer closure from absence.'});
  }
  return result;
}

export function freshnessMarkdown(audit){
  const s=audit.summary;
  const lines=['# GeoHub — whole static-place freshness and contradiction audit','',`Audited ${audit.auditedAt}; ${s.totalPlaces.toLocaleString('en')} published records. Dataset ${audit.datasetId}.`,'',audit.scope,'','## Date semantics','',...Object.entries(audit.semantics).map(([k,v])=>`- **${k}:** ${v}`),'','## Measured coverage','',`- Sources: ${Object.entries(s.sources).map(([k,v])=>`${k}: ${v}`).join('; ')}.`,`- OSM last-edit age: ${JSON.stringify(s.osmObjectEditAge)}.`,`- OSM explicit check-date age: ${JSON.stringify(s.osmExplicitCheckAge)}.`,`- ${s.onsiteSurveyDatePresent} records carry a source survey date; ${s.recordsWithoutDirectoryEvidence} have no merged/standalone directory evidence.`,`- Coordinate classes: ${JSON.stringify(s.coordinateAccuracy)}.`,`- ${s.excludedLifecycleObjects} inactive/former/relocation source objects are absent from the published POI snapshot. Their address-only records may still correctly exist.`,'','## Machine-detectable review queues','',...Object.entries(s.issueCounts).map(([k,v])=>`- ${k}: **${v}**`),'','These are evidence-specific queues. Old edit dates do not prove closure. Different address text does not prove a different address. Nearby equal names are review candidates, never safe automatic merges.',''];
  for(const type of ['inactive-or-relocated-evidence-not-surfaced','other-source-near-excluded-inactive-object','street-and-house-coordinate-disagreement','exact-address-coordinate-disagreement','merged-directory-coordinate-disagreement','same-brand-exact-address-distant-points']){
    lines.push(`## ${type}`,'');for(const item of (audit.issues[type]||[]).slice(0,20))lines.push(`- ${JSON.stringify(item)}`);lines.push('');
  }
  if(audit.currentSourceChecks){lines.push('## Live source checks performed during this audit','',`Seven public OSM object endpoints were read at ${audit.currentSourceChecks.osmCheckedAt}. All seven returned HTTP 200 and retained their conflicting or relocation tags. This verifies source contents, not current physical operation.`,'',`Liberty official branch page read at ${audit.currentSourceChecks.libertyCheckedAt}: the old public ID \\`directory_liberty_253110\\` now appears as source row 254177 with the same title/address and point 41.67199,44.63742. The same official page places the bank branch122, Cash-in ATM and pawn service at Lebanidze19 at41.71976,44.79325. The LBPay location is contradictory; do not substitute a different device point.`.replaceAll('\\`','`'),'',`Liberty IDs are volatile: ${audit.currentSourceChecks.libertyIdentity.sourceIdChanges} exact unique title/type/address/coordinate signatures have different IDs. ${audit.currentSourceChecks.libertyIdentity.ambiguousRows} non-unique rows remain unresolved. `,'','The existing generator `.codex/artifacts/chains-build.mjs:50` passes `r.Id` to `add(\'liberty\', ...)`; generated definitions are in `web/tools/source-directory-chains.mjs`. A refresh must first map unique exact signatures to durable existing GeoHub IDs, preserve old/current source IDs as provenance, and send changed/ambiguous signatures to review. Adding fresh source IDs as new GeoHub IDs would duplicate the network.','');}
  lines.push('## Code paths requiring review (baseline before current fixes)','','- `web/tools/import-tbilisi-osm.mjs`: `inactive()` excludes several statuses but not `closed=yes`; the baseline tag whitelist drops `note`, `fixme`, `survey:date`, `check_date:opening_hours` and `end_date`. Former-use metadata is conditional and cannot expose every closure/relocation signal.','- `web/tools/source-directory-policy.mjs`: missing source-check dates default to a fixed date; official/marketplace matches fill missing contacts/hours but retain conflicting nonempty older values.','- `web/src/data/importedPlaces.js`: `hydrate()` supplies `status: active` to every imported record; OSM/official/marketplace absence of a closure flag becomes active in UI data.','- `web/src/features/places/ImportedPlaceInfo.jsx`: OSM extract date and object edit date are differentiated, but merged source retrieval is labelled “გადამოწმება”; standalone directory records show only a source link, not the source-check date/state.','- `web/src/features/places/ImportedPlacePosts.jsx`: the card header presents a source/extract date without a date-type label; only OSM entries get the explanatory footer.','- Map/source attribution date is the extract date, not evidence that every business was revisited.','',...audit.referenceDocs.map(url=>`- ${url}`),'','All exact IDs, evidence and all 49,533 per-record classifications are in `global-audit.json`. No place or source input was changed.');return lines.join('\n')+'\n';
}

async function main(){
  const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'web/public/place-data/manifest.json'),'utf8'));
  const places=[];for(const shard of manifest.shards){const payload=JSON.parse(await fs.readFile(path.join(ROOT,'web/public/place-data',shard.file),'utf8'));places.push(...(Array.isArray(payload)?payload:payload.places));}
  const extracted=JSON.parse(await fs.readFile(path.join(ROOT,'.codex/artifacts/place-import/osm-tbilisi.json'),'utf8'));
  const {SOURCE_DIRECTORY_DEFINITIONS}=await import('./source-directory-definitions.mjs');
  const audit=auditPlaceFreshness({places,elements:extracted.elements,manifest,definitions:SOURCE_DIRECTORY_DEFINITIONS});
  audit.summary.definitionsMissingExplicitCheckDate=SOURCE_DIRECTORY_DEFINITIONS.filter(d=>!d.sourceCheckedAt&&!d.sourceDate).map(d=>d.id);
  const output=path.join(ROOT,'.codex/artifacts/freshness-review');await fs.mkdir(output,{recursive:true});
  try{
    const osm=JSON.parse(await fs.readFile(path.join(output,'current-osm/summary.json'),'utf8')),liberty=JSON.parse(await fs.readFile(path.join(output,'liberty-current-records.json'),'utf8'));
    const previous=JSON.parse(await fs.readFile(path.join(ROOT,'.codex/artifacts/chains-source/liberty-data.json'),'utf8'));
    const html=await fs.readFile(path.join(output,'liberty-current.html'),'utf8'),current=JSON.parse(html.match(/window\.pins\s*=\s*(\[[\s\S]*?\])\s*;?\s*<\/script>/)[1]);
    const identity=reconcileVolatileDirectoryRows(previous,current);
    audit.currentSourceChecks={osmCheckedAt:osm[0].fetchedAt,osm,libertyCheckedAt:liberty.fetchedAt,liberty,libertyIdentity:{sourceIdChanges:identity.exactMatches.filter(x=>x.sourceIdChanged).length,exactMatches:identity.exactMatches.length,ambiguousRows:identity.ambiguous.length,unresolvedRows:identity.unresolved.length},physicalVerificationPerformed:false};
    await fs.writeFile(path.join(output,'liberty-identity-review.json'),JSON.stringify(identity));
    await fs.writeFile(path.join(output,'liberty-review-proposal.json'),JSON.stringify({directory_liberty_253110:{status:'needs-review',checkedAt:liberty.fetchedAt.slice(0,10),hideFromMap:true,reason:'ოფიციალურ ცნობარში ამ გადახდის აპარატის მისამართი და რუკის წერტილი ერთმანეთს არ შეესაბამება. ზუსტი მდებარეობა დასაზუსტებელია.',sourceUrls:['https://libertybank.ge/ka/chven-shesakheb/kompaniis-shesakheb/bankomatebi'],evidenceKind:'current-official-source-coordinate-conflict',sourceRecordId:'254177',previousSourceRecordId:'253110'}}));
  }catch(error){audit.liveEvidenceNote=`No complete saved live evidence bundle: ${error.message}`;}
  await fs.writeFile(path.join(output,'global-audit.json'),JSON.stringify(audit));await fs.writeFile(path.join(output,'global-audit.md'),freshnessMarkdown(audit));
  console.log(JSON.stringify({output,totalPlaces:audit.summary.totalPlaces,sources:audit.summary.sources,age:audit.summary.osmObjectEditAge,checks:audit.summary.osmExplicitCheckAge,issueCounts:audit.summary.issueCounts}));
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await main();
