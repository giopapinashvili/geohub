import { normalizeSearch, discoveryScore, editDistance } from '../lib/discoverySearch.js';
import { normalizeCatalogQuery } from '../lib/catalogSearchTerms.js';
import { matchesPlaceFilters } from '../lib/discoveryFilters.js';
import { matchesPlaceCategory } from '../lib/placeTaxonomy.js';
import { getImportedPlace } from './importedPlaces.js';
import { readSourceCatalogFile, normalizeSourceCatalog } from './sourceCatalogs.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const wordsFor = term => normalizeCatalogQuery(term).split(' ').filter(word => word.length >= 2 && !/^\d/.test(word) && !['da','and','with','the','for','of'].includes(word));

/** Ranking is shared by tests and the runtime; original source names stay intact. */
export async function rankDirectoryCatalogRows(rows, term, limit = 80, filters = {}, {venues, category='all'} = {}) {
  const query=normalizeCatalogQuery(term);
  const seen = new Set(), ranked = [];
  for (let offset = 0; offset < rows.length; offset += 500) {
    for (const sourceRow of rows.slice(offset, offset + 500)) {
      if (!Array.isArray(sourceRow) || typeof sourceRow[0] !== 'string' || !['dish','product'].includes(sourceRow[1]) || !Array.isArray(sourceRow[2])) continue;
      // Apply known branch categories before the title cap, including mixed-category groups.
      const pairs=venues?sourceRow[2].filter(pair=>{
        const venue=Array.isArray(pair) && pair.length===2 ? venues[pair[0]] : null;
        return venue?.file && venue.placeId && (!venue.category || matchesPlaceCategory(venue,category));
      }):sourceRow[2];
      if(!pairs.length)continue;
      const row=pairs===sourceRow[2]?sourceRow:[sourceRow[0],sourceRow[1],pairs,...sourceRow.slice(3)];
      if(filters.diet && !row[4]?.includes(filters.diet))continue;
      const key = `${row[1]}\0${row[0]}\0${JSON.stringify(row[3]||[])}\0${JSON.stringify(row[4]||[])}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const result = discoveryScore({name:row[0],aliases:[normalizeCatalogQuery(row[0])],categoryLabel:Array.isArray(row[3])?row[3].join(' '):''},query);
      if (result.score > 0) ranked.push({row,...result});
    }
    // Yield during larger product searches so typing and map interaction remain responsive.
    if (offset + 500 < rows.length) await pause();
  }
  const result=ranked.sort((a,b)=>b.score-a.score || normalizeSearch(a.row[0]).length-normalizeSearch(b.row[0]).length || a.row[0].localeCompare(b.row[0])).slice(0,limit);
  result.truncated=ranked.length>limit;
  return result;
}

export function createDirectoryCatalogSearch({readFile = readSourceCatalogFile, loadPlace = getImportedPlace} = {}) {
  return async function searchDirectoryCatalog(term, n = 20, {filters = {}, category = 'all', signal} = {}) {
    const output = [];
    const coverage = {source:'public-merchant-catalog',scannedCount:0,truncated:false,unavailable:false};
    output.coverage = coverage;
    const words = wordsFor(term), limit = Math.max(0,Math.min(60,Number(n) || 0));
    // Preparation is unknown; dietary filters require explicit publisher declarations.
    if ((!words.length && !filters.diet) || !limit || Number(filters.preparationMax) > 0) return output;
    const cancelled = () => signal?.aborted;
    try {
      const index = await readFile('index.json');
      if (index.version !== 1 || !index.venues || !index.search?.manifest) throw new Error('Invalid catalog index');
      const manifest = await readFile(index.search.manifest);
      if (manifest.version !== 1 || !manifest.buckets) throw new Error('Invalid catalog search index');
      const rows = [], loaded = new Set();let bytes = 0;
      async function readPrefixes(prefixes) {
        for (const prefix of prefixes) {
          for (const entry of manifest.buckets[prefix] || []) {
            if (cancelled()) return;
            if (loaded.has(entry.file)) continue;
            if (bytes + (entry.bytes || 400000) > 8 * 1024 * 1024) {coverage.truncated=true;continue;}
            loaded.add(entry.file);bytes+=entry.bytes || 400000;
            try {const payload=await readFile(entry.file);if(payload.version!==1 || !Array.isArray(payload.rows))throw new Error('Invalid catalog search shard');rows.push(...payload.rows);}
            catch {coverage.unavailable=true;}
          }
        }
      }
      const countFor = prefix => (manifest.buckets[prefix] || []).reduce((sum,entry)=>sum+entry.count,0) || Infinity;
      // A title must contain every query token. Start with the least common prefix.
      const primary=[...new Set([...words.map(word=>word.slice(0,2)),...(filters.diet?[`diet:${filters.diet}`]:[])])].filter(prefix=>manifest.buckets[prefix]).sort((a,b)=>countFor(a)-countFor(b));
      await readPrefixes(primary.slice(0,1));
      const rankingContext={venues:index.venues,category};
      let ranked = await rankDirectoryCatalogRows(rows,term,80,filters,rankingContext);
      if (!ranked.length && words.length && !cancelled()) {
        const corrections = new Map();
        const target=words.slice().sort((a,b)=>b.length-a.length)[0];
        const maxDistance=target.length>=7?2:1;
        const dictionary=Array.isArray(manifest.words)?manifest.words:[];
        for(let offset=0;offset<dictionary.length;offset+=1000){
          if(cancelled())return output;
          for(const candidate of dictionary.slice(offset,offset+1000)){
            if(typeof candidate!=='string' || Math.abs(candidate.length-target.length)>maxDistance)continue;
            const distance=editDistance(target,candidate,maxDistance);
            if(distance<=maxDistance){const prefix=candidate.slice(0,2);corrections.set(prefix,Math.min(corrections.get(prefix)??Infinity,distance));}
          }
          if(offset+1000<dictionary.length)await pause();
        }
        await readPrefixes([...new Set([...primary.slice(1,3),...[...corrections].sort((a,b)=>a[1]-b[1] || countFor(a[0])-countFor(b[0])).slice(0,4).map(([prefix])=>prefix)])]);
        ranked=await rankDirectoryCatalogRows(rows,term,80,filters,rankingContext);
      }
      coverage.scannedCount=rows.length;
      coverage.truncated ||= ranked.truncated;
      if(cancelled())return output;
      const candidates=[],seen=new Set();
      // Interleave titles/branches so a large chain does not fill the candidate budget.
      for(let offset=0;candidates.length<120 && ranked.some(match=>match.row[2].length>offset);offset++){
        for(const match of ranked){
          const pair=match.row[2][offset];if(!Array.isArray(pair)||pair.length!==2)continue;
          const [venueId,itemId]=pair;const venue=index.venues[venueId];
          if(!venue?.file || !venue.placeId || !itemId || venue.category && !matchesPlaceCategory(venue,category))continue;
          const key=venue.placeId;if(seen.has(key))continue;
          seen.add(key);candidates.push({venueId,itemId,venue,match});if(candidates.length>=120)break;
        }
      }
      if(candidates.length>=120)coverage.truncated=true;
      const placePromises=new Map(),catalogPromises=new Map();
      const getPlace=id=>{if(!placePromises.has(id))placePromises.set(id,loadPlace(id));return placePromises.get(id);};
      const getCatalog=(id,venue)=>{if(!catalogPromises.has(id))catalogPromises.set(id,readFile(venue.file).then(value=>normalizeSourceCatalog(value,venue.placeId)));return catalogPromises.get(id);};
      for(let offset=0;offset<candidates.length && output.length<limit;offset+=4){
        if(cancelled())return output;
        const batch=await Promise.all(candidates.slice(offset,offset+4).map(async({venueId,itemId,venue,match})=>{
          try{
            const place=await getPlace(venue.placeId);
            if(!place || !matchesPlaceFilters(place,{...filters,diet:''},category))return null;
            const catalog=await getCatalog(venueId,venue),item=catalog.items.find(entry=>entry.id===itemId);
            if(!item || item.sourceAvailability==='unavailable' || filters.diet && !item.dietaryTags?.includes(filters.diet))return null;
            const pageHref=`/place/${encodeURIComponent(place.id)}?${new URLSearchParams({tab:'catalog',item:item.id,venue:venueId})}`;
            const expired=Number.isFinite(catalog.freshnessUntilMs) && catalog.freshnessUntilMs<Date.now();
            const itemCategoryNames=catalog.categories.filter(entry=>item.categoryIds.includes(entry.id)).map(entry=>entry.name).filter(Boolean);
            return {...place,resultId:`source:${venueId}:${item.id}`,kind:'place',title:item.name,itemTitle:item.name,matchedItemTitle:item.name,matchedItemType:item.kind,itemId:item.id,itemCategoryNames,
              itemImage:item.imageUrl || '',priceMinor:expired?null:item.priceMinor,currency:'GEL',priceType:item.priceType || 'base',priceContext:catalog.priceContext || 'delivery-marketplace',unitInfo:item.unitInfo||'',sellByWeight:item.sellByWeight,minQuantity:item.minQuantity,
              fetchedAt:catalog.fetchedAt,sourceUrl:catalog.sourceUrl,sourceName:catalog.sourceName,sourceKind:'merchant-directory',
              canonicalBusinessHref:pageHref,pageHref,searchMatch:match.match,searchScore:match.score,preparationMinutes:null,dietaryTags:item.dietaryTags||[],dietarySource:item.dietarySource,
              facets:{...place.facets,diets:item.dietaryTags||[]},
            };
          }catch{coverage.unavailable=true;return null;}
        }));
        output.push(...batch.filter(Boolean));
      }
      output.splice(limit);return output;
    }catch{coverage.unavailable=true;return output;}
  };
}

export const searchDirectoryCatalog = createDirectoryCatalogSearch();
