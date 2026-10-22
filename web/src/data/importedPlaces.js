import { readCoordinates } from '../lib/coordinates.js';
import { canonicalCategory } from '../lib/placeTaxonomy.js';
import { createPublicPlaceCache } from './publicPlaceCache.js';
import { applyCuratedPlaceMedia } from '../lib/curatedPlaceMedia.js';
import { applyReviewedPlaceStatus, isPlaceLocationHeld } from '../lib/reviewedPlaceStatus.js';

const downloads = createPublicPlaceCache();
const IMPORT_ID = /^(?:osm_(?:node|way|relation)_\d+|directory_[a-z0-9_]+)$/;
const json = (asset, options) => downloads.read(asset, options);

export const isImportedPlaceId = id => IMPORT_ID.test(String(id || ''));

export async function getImportedManifest() {
  const manifest=await json('manifest.json');
  if (manifest.version!==1 || !Array.isArray(manifest.shards)) {
    downloads.discard('manifest.json');
    throw new Error('Unsupported place dataset');
  }
  return manifest;
}

function hydrate(record, manifest) {
  record = applyReviewedPlaceStatus(record);
  if (!isImportedPlaceId(record?.id) || !readCoordinates(record)) return null;
  return applyCuratedPlaceMedia({
    description:'',address:'',city:'',image:'',photos:[],rating:0,reviewCount:0,checkinCount:0,saveCount:0,
    verified:false,creatorId:'',status:'active',createdAt:0,aliases:[], ...record,
    raw:{ dataSource:'openstreetmap',source:'openstreetmap',sourceDate:manifest.source.sourceDate,
      datasetId:manifest.datasetId,license:manifest.license,licenseUrl:manifest.licenseUrl,
      attribution:manifest.attribution,attributionUrl:manifest.attributionUrl,
      ...record.raw,
    },
  });
}

function flatBounds(bounds) {
  const values=Array.isArray(bounds) ? bounds : bounds ? [bounds.west,bounds.south,bounds.east,bounds.north] : null;
  return values?.length===4 && values.every(Number.isFinite) && values[0]<=values[2] && values[1]<=values[3] ? values : null;
}
const intersects=(a,b)=>a[0]<=b[2] && a[2]>=b[0] && a[1]<=b[3] && a[3]>=b[1];
const contains=(b,p)=>!b || (p.lng>=b[0] && p.lng<=b[2] && p.lat>=b[1] && p.lat<=b[3]);

/** At distant zoom use a small overview; detail objects load only by viewport. */
export async function loadImportedPlaces(bounds, { zoom=14 } = {}) {
  const manifest=await getImportedManifest();
  const box=flatBounds(bounds);
  const overview=!box || zoom<12.5;
  let records=[];
  let truncated=false;
  let loadedShards=0;
  if (overview) records=await json(manifest.overview);
  else {
    const center=[(box[0]+box[2])/2,(box[1]+box[3])/2];
    const candidates=manifest.shards.filter(shard=>intersects(shard.bounds,box)).sort((a,b)=>{
      const distance=entry=>Math.abs((entry.bounds[0]+entry.bounds[2])/2-center[0])+Math.abs((entry.bounds[1]+entry.bounds[3])/2-center[1]);
      return distance(a)-distance(b);
    });
    truncated=candidates.length>64;
    const selected=candidates.slice(0,64);
    for(let index=0;index<selected.length;index+=8) {
      const batch=await Promise.all(selected.slice(index,index+8).map(shard=>json(shard)));
      records.push(...batch.flat());
    }
    loadedShards=selected.length;
  }
  const places=records.map(record=>hydrate(record,manifest)).filter(record=>record && !record.raw?.mapHidden && contains(box,record));
  return {places,coverage:{source:'openstreetmap',sourceDate:manifest.source.sourceDate,datasetId:manifest.datasetId,totalPlaces:manifest.totalPlaces,
    loaded:places.length,loadedShards,mode:overview ? 'overview' : 'viewport',truncated,bounds:manifest.source.bbox,
    attribution:manifest.attribution,attributionUrl:manifest.attributionUrl,license:manifest.license}};
}

/** Direct page links fetch one spatial shard instead of the full city. */
export async function getImportedPlace(id) {
  if (!isImportedPlaceId(id)) return null;
  const manifest=await getImportedManifest();
  const lookup=await json(manifest.lookup);
  const key=Object.hasOwn(lookup,id) ? lookup[id] : null;
  if (!key) return null;
  const shard=manifest.shards.find(entry=>entry.key===key);
  if (!shard) return null;
  const records=await json(shard);
  const record=records.find(entry=>entry.id===id);
  return record ? hydrate(record,manifest) : null;
}

let searchIndex;
let searchFile;
function searchRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload?.v!==2 || !Array.isArray(payload.strings) || !Array.isArray(payload.rows)) throw new Error('Unsupported place search index');
  const strings=payload.strings;
  const prefixes={n:'osm_node',w:'osm_way',r:'osm_relation',an:'address_node',aw:'address_way',ar:'address_relation',sn:'street_node',sw:'street_way',sr:'street_relation'};
  return payload.rows.map(row=>{
    const id=/^([a-z]+)(\d+)$/.exec(row[0]);
    const directoryId = /^directory_[a-z0-9_]+$/.test(row[0]) ? row[0] : null;
    if (!directoryId && (!id || !prefixes[id[1]])) return null;
    const name=strings[row[1]];
    return [directoryId || `${prefixes[id[1]]}_${id[2]}`,name,row[2].map(index=>strings[index]),strings[row[3]] || (row[7]===1 ? name : ''),strings[row[4]],row[5],row[6],row[7]===1 ? 'address' : 'place',strings[row[8]],row[9]===1 ? 'approximate-center' : 'source-point',row[10] || {}];
  }).filter(Boolean);
}
/** Load on first search only. Works in a worker and does not touch the DOM. */
export async function loadImportedSearchIndex() {
  const manifest=await getImportedManifest();
  if (!searchIndex || searchFile !== manifest.search.file) {
    searchFile=manifest.search.file;
    searchIndex=(async()=>{
      const rows=searchRows(await json(manifest.search, { retain: false }));
      return rows.filter(row=>Array.isArray(row) && readCoordinates({lat:row[5],lng:row[6]})).map(row=>({
        id:row[0],name:row[1],aliases:row[2],address:row[3],category:row[4],lat:row[5],lng:row[6],kind:row[7],shard:row[8],
        coordinateAccuracy:row[9] || undefined,
        facets:row[10] || {},
      })).map(applyReviewedPlaceStatus).filter(place=>!isPlaceLocationHeld(place));
    })();
    const pending=searchIndex;
    pending.catch(()=>{if(searchIndex===pending)searchIndex=null;});
  }
  return searchIndex;
}

/** Preserve existing IDs/activity. Name-only matches never merge anonymous POIs. */
export function mergeImportedPlaces(existing=[], imported=[]) {
  existing=existing.map(applyReviewedPlaceStatus).filter(place=>!place.raw?.mapHidden);
  imported=imported.map(applyReviewedPlaceStatus).filter(place=>!place.raw?.mapHidden);
  const result=existing.slice();
  const byId=new Map(result.map((place,index)=>[place.id,index]));
  const sourceIds=new Set(existing.flatMap(place=>{
    const raw=place.raw || {};
    return [raw.osmType && raw.osmId ? `osm_${raw.osmType}_${raw.osmId}` : '',raw.osmId && String(raw.osmId).startsWith('osm_') ? raw.osmId : ''].filter(Boolean);
  }));
  const nameKey=value=>String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const namedExisting=new Map();
  const recordKey=(category,name,address)=>`${canonicalCategory(category)}|${nameKey(name)}|${nameKey(address)}`;
  for(const place of existing) {
    if (!place.name || !place.address || !readCoordinates(place)) continue;
    const key=recordKey(place.category,place.name,place.address);
    if (!namedExisting.has(key)) namedExisting.set(key,[]);
    namedExisting.get(key).push(place);
  }
  for(const place of imported) {
    if (byId.has(place.id) || sourceIds.has(place.id)) continue;
    const candidates=place.raw?.named && place.address ? [place.name,...(place.aliases || [])].flatMap(name=>namedExisting.get(recordKey(place.category,name,place.address)) || []) : [];
    const same=candidates.some(original=>{
      if (original.facets?.level && place.facets?.level && original.facets.level!==place.facets.level) return false;
      const y=(place.lat-original.lat)*111320,x=(place.lng-original.lng)*111320*Math.cos(place.lat*Math.PI/180);
      // Proximity plus exact name+category is a display-only match. IDs are retained.
      return Math.hypot(x,y)<=20;
    });
    if (same) continue;
    byId.set(place.id,result.length); result.push(place);
  }
  return result;
}
