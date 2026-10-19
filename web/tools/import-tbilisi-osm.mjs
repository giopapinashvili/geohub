/** Offline OSM snapshot → attributed spatial shards and a compact search index.
 * node web/tools/import-tbilisi-osm.mjs --input .codex/artifacts/place-import/osm-tbilisi.json
 * The input is produced by import-tbilisi-extract.mjs. No Firestore writes.
 */
import { readFile, writeFile, mkdir, stat, readdir, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { categoryFromOsm, facetsFromOsm, taxonomyCategory } from '../src/lib/placeTaxonomy.js';
import { readCoordinates } from '../src/lib/coordinates.js';
import { VERIFIED_PLACE_SUPPLEMENT, VERIFIED_SITE_ANCHORS } from './verified-place-supplement.mjs';
import { createDirectoryRecords, mergeDirectoryRecords } from './source-directory-policy.mjs';
import { SOURCE_DIRECTORY_DEFINITIONS } from './source-directory-definitions.mjs';
import { linkMetroEntrances } from './metro-entrances.mjs';

const TAGS = /^(name(:ka|:en|:ru)?|alt_name(:ka|:en)?|short_name(:ka|:en)?|brand(:wikidata)?|operator|amenity|shop|tourism|leisure|office|craft|healthcare(:speciality)?|public_transport|railway|station|subway|bus|train|highway|building|education|landuse|historic|natural|man_made|emergency|addr:(street|street:ka|street:en|housenumber|city|postcode|place|unit)|contact:(phone|mobile|website|email)|phone|mobile|website|url|email|opening_hours|cuisine|diet:[\w_]+|wheelchair|outdoor_seating|indoor|internet_access|takeaway|delivery|reservation|access|fee|level|description(:ka|:en)?|wikidata|wikipedia|check_date|source|entrance|ref|network|vending|drinking_water|sport|payment:[\w_]+)$/;
const text = (value, max = 300) => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
const unique = values => [...new Set(values.filter(Boolean))];
const inactive = tags => ['disused','abandoned','demolished','razed','removed'].some(key => tags[key] === 'yes') || ['no','vacant','disused','closed','abandoned'].includes(tags.shop) || ['no','disused','closed'].includes(tags.amenity);
const aliases = tags => unique(['name:ka','name:en','name:ru','name','alt_name','alt_name:ka','alt_name:en','short_name','short_name:ka','short_name:en','brand','operator'].flatMap(key => text(tags[key]).split(';').map(v=>v.trim())));
export const shardKey = (lat, lng) => `${Math.floor((lng - 44.6) / 0.025)}_${Math.floor((lat - 41.58) / 0.025)}`;
const sourceUrl = element => `https://www.openstreetmap.org/${element.type}/${element.id}`;

export function normalizeOsmPlace(element) {
  const original = element.tags || {};
  if (inactive(original)) return null;
  const category = categoryFromOsm(original);
  if (!category) return null;
  const coords = readCoordinates({ lat: element.lat ?? element.center?.lat, lng: element.lon ?? element.center?.lon });
  if (!coords) return null;
  const tags = Object.fromEntries(Object.entries(original).filter(([key]) => TAGS.test(key)).map(([key, value]) => [key, text(value, key.startsWith('description') ? 1000 : 400)]));
  const named = text(tags['name:ka'] || tags.name || tags['name:en'] || tags.brand || tags.operator);
  const street = text(tags['addr:street:ka'] || tags['addr:street'] || tags['addr:place']);
  const address = [street, text(tags['addr:housenumber'])].filter(Boolean).join(' ');
  const title = named || taxonomyCategory(category).label;
  const raw = {
    osmType: element.type, osmId: String(element.id), sourceUrl: sourceUrl(element),
    coordinateAccuracy: element.type === 'node' ? 'source-point' : 'approximate-center',
    named: !!named, tags,
  };
  const formerUse = Object.fromEntries(Object.entries(original).filter(([key]) => /^(disused|abandoned|was):/.test(key)));
  if (Object.keys(formerUse).length) {
    raw.formerUse = formerUse;
    if (!['amenity','shop','office','healthcare','craft','tourism','leisure'].some(key=>original[key])) {
      raw.operatingStatus = 'source-reports-inactive';
      if (tags.opening_hours) {raw.formerOpeningHours=tags.opening_hours;delete tags.opening_hours;}
    }
    if (original.note) raw.sourceNote = text(original.note, 1000);
  }
  if (tags.building && !['amenity','shop','office','healthcare','craft','tourism','leisure'].some(key=>tags[key])) {
    raw.recordKind = 'mapped-building';
    raw.buildingUse = tags.building;
  }
  if (element.timestamp) raw.sourceUpdatedAt = element.timestamp;
  const phone = text(tags['contact:phone'] || tags.phone || tags['contact:mobile'] || tags.mobile);
  const websiteValue = text(tags['contact:website'] || tags.website || tags.url).split(';')[0].trim();
  const website = /^www\.[^\s/]+\.[a-z]{2,}(\/|$)/i.test(websiteValue) ? `https://${websiteValue}` : websiteValue;
  if (phone) raw.phone = phone;
  if (/^https?:\/\//i.test(website)) raw.website = website;
  if (tags.opening_hours) raw.openingHours = tags.opening_hours;
  if (tags.operator) raw.operator = tags.operator;
  if (element.bounds && category === 'mall') raw.bounds = element.bounds;
  const facets = facetsFromOsm(tags);
  return {
    id: `osm_${element.type}_${element.id}`, name: title, category, ...coords,
    ...(address ? { address } : {}), ...(tags['addr:city'] ? { city: tags['addr:city'] } : {}),
    ...(aliases(tags).filter(v=>v!==title).length ? { aliases: aliases(tags).filter(v=>v!==title) } : {}),
    ...(text(tags['description:ka'] || tags.description) ? { description: text(tags['description:ka'] || tags.description, 1000) } : {}),
    ...(tags.brand ? {brand:tags.brand} : {}), ...(tags['brand:wikidata'] ? {brandWikidata:tags['brand:wikidata']} : {}),
    ...(Object.keys(facets).length ? { facets } : {}), raw,
  };
}

const elementId = element => `osm_${element.type}_${element.id}`;
const elementCoordinates = element => element && readCoordinates({lat:element.lat ?? element.center?.lat,lng:element.lon ?? element.center?.lon});

/** A directory assertion and its coordinate evidence are recorded separately. */
export function createVerifiedSupplement(elements, definitions = VERIFIED_PLACE_SUPPLEMENT) {
  return createDirectoryRecords(elements,definitions);
}

/** A campus relation's bounding rectangle is not a valid entrance/location. */
export function applyVerifiedSiteAnchors(places, elements, definitions = VERIFIED_SITE_ANCHORS) {
  const index = new Map(elements.map(element => [elementId(element),element]));
  const byId = new Map(places.map(place=>[place.id,place]));
  let corrected=0;
  for (const definition of definitions) {
    const place = byId.get(definition.id);
    if (!place) continue;
    const anchor = index.get(definition.anchorId), coords = elementCoordinates(anchor);
    if (!coords) throw new Error(`Verified campus anchor is missing: ${definition.anchorId}`);
    place.raw.originalSourceCenter = {lat:place.lat,lng:place.lng};
    place.raw.coordinateSourceId = definition.anchorId;
    place.raw.coordinateSourceUrl = sourceUrl(anchor);
    place.raw.coordinateEvidenceUrl = definition.sourceUrl;
    place.raw.sourceCertainty = 'official-address-matched-campus-building';
    place.raw.coordinateAccuracy = 'approximate-center';
    place.raw.coordinateNote = 'ოფიციალურ მისამართთან შეჯერებული ადმინისტრაციული შენობის ან კამპუსის სავარაუდო ცენტრი; უნივერსიტეტს სხვა კორპუსებიც აქვს.';
    if (place.address && place.address !== definition.address) place.raw.originalSourceAddress = place.address;
    Object.assign(place,coords,{address:definition.address});
    corrected++;
  }
  return corrected;
}

function insidePolygon(point, polygon) {
  let inside = false;
  for (let i=0, j=polygon.length-1; i<polygon.length; j=i++) {
    const a=polygon[i], b=polygon[j];
    if (((a.lat > point.lat) !== (b.lat > point.lat)) && point.lng < (b.lon-a.lon)*(point.lat-a.lat)/(b.lat-a.lat)+a.lon) inside=!inside;
  }
  return inside;
}
function pointDistance(a, b) {
  const y=(a.lat-b.lat)*111320, x=(a.lng-b.lng)*111320*Math.cos(a.lat*Math.PI/180);
  return Math.hypot(x,y);
}
function assignBrands(places) {
  const brands = new Map();
  for (const place of places) {
    const key = place.brandWikidata || place.brand?.toLowerCase().trim();
    if (!key) continue;
    if (!brands.has(key)) brands.set(key,[]);
    brands.get(key).push(place);
  }
  const summary = [];
  for (const [key, records] of brands) {
    const locations=[];
    for (const place of records) {
      if (!locations.some(other => pointDistance(other,place) < 20 && (other.facets?.level || '') === (place.facets?.level || ''))) locations.push(place);
    }
    const branches=locations.filter(place=>!['atm','crypto-atm','payment-terminal','vending-machine'].includes(place.category));
    for (const place of records) place.brandBranchCount=branches.length;
    summary.push({key,name:records.find(p=>p.brand)?.brand || key,mappedLocations:locations.length,mappedBranches:branches.length});
  }
  return summary.sort((a,b)=>b.mappedLocations-a.mappedLocations);
}
export function assignMallTenants(places, elements) {
  const malls = places.filter(place=>place.category==='mall');
  const geometry = new Map(elements.filter(e=>e.tags?.shop==='mall' && e.geometry?.length>3).map(e=>[`osm_${e.type}_${e.id}`,e.geometry]));
  const allowed = new Set(['shopping','food','services','finance','entertainment','health']);
  let linked=0;
  for (const mall of malls) {
    const polygon=geometry.get(mall.id);
    const bounds=mall.raw.bounds;
    const explicit=places.filter(place=>place.id!==mall.id && place.raw.parentPlaceId===mall.id);
    const mapped=polygon && bounds ? places.filter(place=>place.id!==mall.id && place.raw.osmType==='node' && allowed.has(taxonomyCategory(place.category).group)
      && place.lng>=bounds[0] && place.lng<=bounds[2] && place.lat>=bounds[1] && place.lat<=bounds[3] && insidePolygon(place,polygon)) : [];
    const tenants=[...new Map([...explicit,...mapped].map(place=>[place.id,place])).values()];
    if (!tenants.length) continue;
    mall.raw.tenantIds=tenants.map(place=>place.id);
    mall.raw.tenantCoverage=explicit.length ? 'official-directory-and-mapped-points' : 'mapped-points-in-building';
    if (explicit.length) mall.raw.tenantSources=unique(explicit.flatMap(place=>[place.raw.source==='official-directory' && place.raw.sourceUrl,...(place.raw.officialDirectory || []).map(entry=>entry.sourceUrl)]));
    for (const tenant of tenants) { tenant.raw.mallId=mall.id; tenant.raw.mallName=mall.name; }
    linked+=tenants.length;
  }
  return {malls:malls.length,mallsWithMappedTenants:malls.filter(p=>p.raw.tenantIds?.length).length,tenantLinks:linked};
}

const PRIORITY = {metro:100,'metro-entrance':98,mall:96,hospital:94,'rail-station':92,'bus-station':90,university:86,museum:84,park:82,police:80,'fire-station':80,supermarket:75,bank:72,pharmacy:70,'drinking-water':60};
function importance(place) { return (PRIORITY[place.category] || 30) + (place.brandBranchCount>=5 ? 12 : 0) + (place.raw.named ? 3 : 0); }

/** Search index row layout is shared with importedPlaces.js. */
export function createSearchRows(places, elements) {
  const rows = places.map(place => [place.id,place.name,place.aliases || [],place.address || '',place.category,place.lat,place.lng,'place',shardKey(place.lat,place.lng),place.raw.coordinateAccuracy,...(place.facets ? [place.facets] : [])]);
  const seenAddresses = new Set();
  const streets = new Map();
  let addressCount=0;
  for (const element of elements) {
    const tags=element.tags || {};
    if (inactive(tags)) continue;
    const coords=readCoordinates({lat:element.lat ?? element.center?.lat,lng:element.lon ?? element.center?.lon});
    if (!coords) continue;
    const street=text(tags['addr:street:ka'] || tags['addr:street'] || tags['addr:place']);
    const number=text(tags['addr:housenumber'],80);
    if (street && number) {
      const address=`${street} ${number}`;
      const key=`${address.toLowerCase()}|${coords.lat.toFixed(4)}|${coords.lng.toFixed(4)}`;
      if (!seenAddresses.has(key)) {
        seenAddresses.add(key);
        rows.push([`address_${element.type}_${element.id}`,address,unique([tags['addr:street:en'] && `${tags['addr:street:en']} ${number}`]),address,'address',coords.lat,coords.lng,'address','',element.type==='node' ? 'source-point' : 'approximate-center']);
        addressCount++;
      }
    }
    if (tags.highway && !['bus_stop','traffic_signals','services','rest_area','platform'].includes(tags.highway) && (tags.name || tags['name:ka'])) {
      const name=text(tags['name:ka'] || tags.name);
      const key=name.toLowerCase();
      if (!streets.has(key)) streets.set(key,{id:`street_${element.type}_${element.id}`,name,aliases:new Set(),lat:0,lng:0,n:0});
      const group=streets.get(key);
      aliases(tags).forEach(alias=>group.aliases.add(alias));
      group.lat+=coords.lat; group.lng+=coords.lng; group.n++;
    }
  }
  for (const street of streets.values()) rows.push([street.id,street.name,[...street.aliases],street.name,'street',street.lat/street.n,street.lng/street.n,'address','','approximate-center']);
  return {rows,addressCount,streetCount:streets.size};
}

/** Repeated Georgian names/addresses/categories are stored once on the wire. */
export function packSearchRows(rows) {
  const strings=[''];
  const ids=new Map([['',0]]);
  const intern=value=>{ if(!ids.has(value)){ids.set(value,strings.length);strings.push(value);}return ids.get(value); };
  const prefixes={osm_node:'n',osm_way:'w',osm_relation:'r',address_node:'an',address_way:'aw',address_relation:'ar',street_node:'sn',street_way:'sw',street_relation:'sr'};
  return {v:2,strings,rows:rows.map(row=>{
    const parts=row[0].split('_');
    const prefix=prefixes[`${parts[0]}_${parts[1]}`];
    const compactId=prefix ? `${prefix}${parts[2]}` : row[0];
    return [compactId,intern(row[1]),row[2].filter(value=>value!==row[1]).map(intern),intern(row[7]==='address' && row[3]===row[1] ? '' : row[3]),intern(row[4]),Number(row[5].toFixed(6)),Number(row[6].toFixed(6)),row[7]==='address' ? 1 : 0,intern(row[8]),row[9]==='approximate-center' ? 1 : 0,...(row[10] ? [row[10]] : [])];
  })};
}

export async function buildDataset(input, output, definitions = SOURCE_DIRECTORY_DEFINITIONS) {
  const snapshot=JSON.parse(await readFile(input,'utf8'));
  const source=snapshot.source;
  if (!source?.url || !source.sourceDate || !Array.isArray(source.bbox)) throw new Error('Input must include source URL, snapshot date and bbox');
  const uniqueElements=[...new Map(snapshot.elements.map(element=>[`${element.type}:${element.id}`,element])).values()];
  const osmPlaces=uniqueElements.map(normalizeOsmPlace).filter(Boolean);
  const coordinateCorrections=applyVerifiedSiteAnchors(osmPlaces,uniqueElements);
  const directoryRecords=createVerifiedSupplement(uniqueElements,definitions);
  for (const record of directoryRecords) if (record.lng<source.bbox[0] || record.lat<source.bbox[1] || record.lng>source.bbox[2] || record.lat>source.bbox[3]) throw new Error(`Official directory point outside snapshot coverage: ${record.id}`);
  const directoryMerge=mergeDirectoryRecords(osmPlaces,directoryRecords,definitions);
  const supplementalPlaces=directoryMerge.additions;
  const places=[...osmPlaces,...supplementalPlaces].sort((a,b)=>a.id.localeCompare(b.id));
  const metro=linkMetroEntrances(places,uniqueElements);
  const brands=assignBrands(places);
  const malls=assignMallTenants(places,uniqueElements);
  const {rows,addressCount,streetCount}=createSearchRows(places.filter(place=>!place.raw?.mapHidden),uniqueElements);
  const shards=new Map(), lookup={};
  for (const place of places) {
    const key=shardKey(place.lat,place.lng);
    if (!shards.has(key)) shards.set(key,[]);
    shards.get(key).push(place); lookup[place.id]=key;
  }
  await mkdir(output,{recursive:true});
  const writeJson=async (name,value) => {
    const serialized=JSON.stringify(value);
    if (Buffer.byteLength(serialized)>24*1024*1024) throw new Error(`${name} exceeds a safe Pages file size`);
    const sha256=createHash('sha256').update(serialized).digest('hex');
    const file=name==='manifest.json' ? name : name.replace(/\.json$/,`-${sha256.slice(0,12)}.json`);
    await writeFile(join(output,file),serialized);
    return {file,bytes:Buffer.byteLength(serialized),sha256};
  };
  const shardEntries=[];
  for (const [key,records] of shards) {
    const [x,y]=key.split('_').map(Number);
    const info=await writeJson(`places-${key}.json`,records);
    shardEntries.push({key,file:`places-${key}.json`,count:records.length,bounds:[44.6+x*0.025,41.58+y*0.025,44.6+(x+1)*0.025,41.58+(y+1)*0.025],...info});
  }
  const overview=places.filter(place=>!place.raw?.mapHidden).sort((a,b)=>importance(b)-importance(a)||a.id.localeCompare(b.id)).slice(0,500);
  const overviewInfo=await writeJson('overview.json',overview);
  const lookupInfo=await writeJson('lookup.json',lookup);
  const searchInfo=await writeJson('search-index.json',packSearchRows(rows));
  const categoryCounts={}; for(const place of places)categoryCounts[place.category]=(categoryCounts[place.category]||0)+1;
  const manifest={version:1,datasetId:`tbilisi-osm-${source.sourceDate}`,generatedAt:new Date().toISOString(),source,license:'ODbL-1.0',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',attribution:'© OpenStreetMap contributors',attributionUrl:'https://www.openstreetmap.org/copyright',coverageNote:'Bounding rectangle around Tbilisi and surroundings. OSM records plus individually attributed official directory facts; not a complete city directory. Building outlines and individual campus buildings are not counted as separate active institutions. Opening hours, contacts and names may be outdated.',totalPlaces:places.length,osmPlaceCount:osmPlaces.length,supplementalPlaceCount:supplementalPlaces.length,coordinateCorrections,officialSources:unique(supplementalPlaces.map(place=>place.raw.sourceUrl)),mappedBuildingCount:osmPlaces.filter(place=>place.raw.recordKind==='mapped-building').length,addressCount,streetCount,sourceElements:uniqueElements.length,categoryCounts,brands,malls,overview:{file:'overview.json',count:overview.length,...overviewInfo},lookup:{file:'lookup.json',...lookupInfo},search:{file:'search-index.json',count:rows.length,...searchInfo},shards:shardEntries.sort((a,b)=>a.key.localeCompare(b.key))};
  const sourceGroups=new Map();
  for (const definition of definitions) {
    const key=definition.sourceName || new URL(definition.sourceUrl).hostname;
    if (!sourceGroups.has(key)) sourceGroups.set(key,{name:key,sourceKind:definition.sourceKind || 'official-directory',reviewedRecords:0,addedPlaces:0,enrichedPlaces:0,sourceUrls:[]});
    const group=sourceGroups.get(key);
    group.reviewedRecords++;
    group[definition.matchedPlaceId ? 'enrichedPlaces' : 'addedPlaces']++;
    group.sourceUrls=unique([...group.sourceUrls,definition.sourceUrl]);
  }
  Object.assign(manifest,{
    metro,
    officialSources:unique(directoryRecords.filter(place=>place.raw.source==='official-directory').map(place=>place.raw.sourceUrl)),
    directorySources:unique(directoryRecords.map(place=>place.raw.sourceUrl)),
    directoryRecordCount:definitions.length,
    officialDirectoryRecordCount:definitions.filter(definition=>definition.sourceKind!=='merchant-directory').length,
    officialEnrichedPlaceCount:new Set(definitions.filter(definition=>definition.sourceKind!=='merchant-directory' && definition.matchedPlaceId).map(definition=>directoryMerge.resolvedIds[definition.id])).size,
    directoryEnrichedPlaceCount:new Set(definitions.filter(definition=>definition.matchedPlaceId).map(definition=>directoryMerge.resolvedIds[definition.id])).size,
    officialSourceGroups:[...sourceGroups.values()].filter(group=>group.sourceKind==='official-directory'),
    directorySourceGroups:[...sourceGroups.values()],
    coverageNote:'Bounding rectangle around Tbilisi and surroundings. OSM records plus individually attributed public directories. This is not a complete city census; structures, branches and equipment are separate mapped objects. Marketplace listings do not prove dine-in/public entry or current inventory. Source checks do not imply an on-site visit.',
    namedPlaceCount:places.filter(place=>place.raw.named && place.raw.recordKind!=='mapped-building').length,
  });
  await writeJson('manifest.json',manifest);
  // Only obsolete unhashed files generated by this importer are removed.
  // Hashed snapshots remain valid for already-open tabs across an update.
  for (const name of await readdir(output)) {
    if (/^(overview|lookup|search-index|places--?\d+_-?\d+)\.json$/.test(name)) await unlink(join(output,name));
  }
  const totalBytes=(await Promise.all(shardEntries.map(entry=>stat(join(output,entry.file))))).reduce((sum,entry)=>sum+entry.size,0)+overviewInfo.bytes+lookupInfo.bytes+searchInfo.bytes;
  return {places:places.length,osmPlaces:osmPlaces.length,supplementalPlaces:supplementalPlaces.length,officialEnrichedPlaceCount:manifest.officialEnrichedPlaceCount,officialSourceGroups:manifest.officialSourceGroups.map(({sourceUrls,...group})=>group),coordinateCorrections,addressCount,streetCount,shards:shards.size,totalBytes,largestShard:Math.max(...shardEntries.map(entry=>entry.bytes)),brands:brands.slice(0,12),malls,categoryCounts};
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const option=name=>{const index=process.argv.indexOf(name);return index<0 ? '' : process.argv[index+1];};
  const input=resolve(option('--input') || '.codex/artifacts/place-import/osm-tbilisi.json');
  const output=resolve(option('--output') || 'web/public/place-data');
  console.log(JSON.stringify(await buildDataset(input,output),null,2));
}
