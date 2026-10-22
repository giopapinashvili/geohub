/** Source assertions stay separate from geometry and existing community identity. */
import { readCoordinates } from '../src/lib/coordinates.js';
import { PLACE_TAXONOMY } from '../src/lib/placeTaxonomy.js';

const categories = new Set(PLACE_TAXONOMY.map(value => value.id));
const unique = values => [...new Set(values.filter(Boolean))];
const clean = value => typeof value === 'string' ? value.trim() : '';
const http = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
const coordinates = value => value && readCoordinates({lat:value.lat ?? value.center?.lat,lng:value.lng ?? value.lon ?? value.center?.lon});

export function directoryEditorial(definition) {
  const checkedAt = definition.sourceCheckedAt || definition.sourceDate || null;
  const sources = [{label:definition.sourceName || 'ოფიციალური ცნობარი',url:definition.sourceUrl}, ...(definition.editorial?.sources || [])];
  const explicit = definition.posts || definition.editorial?.posts;
  const posts = explicit || [
    ...(definition.description ? [{id:`${definition.id}_about`,title:`${definition.name} — შესახებ`,body:definition.description,sourceUrl:definition.sourceUrl}] : []),
    ...(definition.address ? [{id:`${definition.id}_visit`,title:`${definition.name} — მისვლა და კონტაქტი`,body:[`${definition.sourceKind==='merchant-directory' ? 'წყაროს ცნობარში' : 'ოფიციალურ ცნობარში'} მითითებული მისამართი: ${definition.address}.`,definition.openingHours && `სამუშაო საათები: ${definition.openingHours}.`,definition.phone && `საკონტაქტო ნომერი: ${definition.phone}.`,definition.coordinateNote].filter(Boolean).join(' '),sourceUrl:definition.sourceUrl}] : []),
  ];
  return {
    ...(definition.editorial || {}), description:definition.description || '', reviewedAt:checkedAt,
    sources:[...new Map(sources.filter(value=>http(value.url)).map(value=>[value.url,value])).values()],
    posts:posts.filter(value=>clean(value.title) && clean(value.body)).map((post,index)=>({
      ...post,id:`${definition.id}_${post.id || index}`,sourceUrl:http(post.sourceUrl || definition.sourceUrl),authorType:'directory',reviewedAt:checkedAt,
    })),
  };
}

export function createDirectoryRecords(elements, definitions, additionalPlaces = []) {
  const index = new Map([...elements.map(element=>[`osm_${element.type}_${element.id}`,element]),...additionalPlaces.map(place=>[place.id,place])]);
  const seen = new Set();
  return definitions.map(definition => {
    if (!/^directory_[a-z0-9_]+$/.test(definition.id || '') || seen.has(definition.id)) throw new Error(`Invalid or repeated directory ID: ${definition.id}`);
    seen.add(definition.id);
    if (!clean(definition.name) || !categories.has(definition.category) || !http(definition.sourceUrl) || !definition.sourceCertainty || !['approximate-center','source-point'].includes(definition.coordinateAccuracy)) throw new Error(`Invalid directory provenance/category: ${definition.id}`);
    const coordinateElement = definition.coordinateSourceId && index.get(definition.coordinateSourceId);
    const coords = definition.coordinateSourceId ? coordinates(coordinateElement) : coordinates(definition);
    if (!coords) throw new Error(`Verified directory record has no coordinate evidence: ${definition.id}`);
    const coordinateUrl = definition.coordinateSourceUrl || (coordinateElement?.type ? `https://www.openstreetmap.org/${coordinateElement.type}/${coordinateElement.id}` : coordinateElement?.raw?.sourceUrl) || definition.sourceUrl;
    const record = {
      id:definition.id,name:definition.name,category:definition.category,...coords,
      ...(definition.address ? {address:definition.address} : {}), city:definition.city ?? 'თბილისი',
      aliases:unique(definition.aliases || []), ...(definition.description ? {description:definition.description} : {}),
      ...(definition.brand ? {brand:definition.brand} : {}), ...(definition.brandWikidata ? {brandWikidata:definition.brandWikidata} : {}),
      ...((definition.facets || definition.indoor) ? {facets:{...definition.facets,...(definition.indoor ? {indoor:true} : {})}} : {}),
      raw:{source:definition.sourceKind==='merchant-directory' ? 'merchant-directory' : 'official-directory',sourceUrl:definition.sourceUrl,sourceCheckedAt:definition.sourceCheckedAt || definition.sourceDate || null,named:true,
        sourceCertainty:definition.sourceCertainty,coordinateAccuracy:definition.coordinateAccuracy,
        ...(definition.coordinateNote ? {coordinateNote:definition.coordinateNote} : {}),coordinateSourceUrl:coordinateUrl,
        ...(definition.coordinateSourceId ? {coordinateSourceId:definition.coordinateSourceId} : {}),
        ...(definition.sourceName ? {sourceName:definition.sourceName} : {}),
        ...(definition.sourceRecordId ? {sourceRecordId:String(definition.sourceRecordId)} : {}),
        ...(definition.venueAccess ? {venueAccess:definition.venueAccess} : {}),
        ...(http(definition.website) ? {website:http(definition.website)} : {}),
        ...(definition.phone ? {phone:definition.phone} : {}), ...(definition.openingHours ? {openingHours:definition.openingHours} : {}),
        ...(definition.parentPlaceId ? {parentPlaceId:definition.parentPlaceId} : {}),
        editorial:directoryEditorial(definition),
      },
    };
    const photos=(definition.photoCredits || []).map(photo=>{
      if (!/^\/place-media\/directory-[a-z0-9.-]+\.(jpg|jpeg|png|webp)$/.test(photo.url || '') || !http(photo.sourceUrl) || !http(photo.originalUrl) || !clean(photo.author) || !/^[a-f0-9]{64}$/.test(photo.sha256 || '') || !(photo.rights==='source-published' || (photo.license && http(photo.licenseUrl)))) throw new Error(`Invalid directory photograph provenance: ${definition.id}`);
      return {...photo,sourceCheckedAt:photo.sourceCheckedAt || record.raw.sourceCheckedAt};
    });
    if (photos.length) { record.image=photos[0].url; record.photos=photos.map(photo=>photo.url); record.raw.photoCredits=photos; }
    index.set(record.id,record);
    return record;
  });
}

/** Only reviewed exact matches merge. Similar names/proximity never merge branches. */
export function mergeDirectoryRecords(places, records, definitions) {
  const index = new Map(places.map(place=>[place.id,place]));
  const definitionsById = new Map(definitions.map(definition=>[definition.id,definition]));
  const resolvedIds = new Map();
  const additions = [];
  let matchedRecords = 0;
  for (const record of records) {
    const definition = definitionsById.get(record.id);
    const matchedId = resolvedIds.get(definition?.matchedPlaceId) || definition?.matchedPlaceId;
    if (!matchedId) {
      if (index.has(record.id)) throw new Error(`Directory ID already exists: ${record.id}`);
      additions.push(record); index.set(record.id,record); resolvedIds.set(record.id,record.id); continue;
    }
    const existing = index.get(matchedId);
    if (!existing) throw new Error(`Missing reviewed directory match: ${record.id} -> ${matchedId}`);
    if (!definition.matchEvidence) throw new Error(`Directory match needs evidence: ${record.id}`);
    resolvedIds.set(record.id,matchedId); matchedRecords++;
    if (definition.correctName && !definition.nameEvidence) throw new Error(`Name correction needs evidence: ${record.id}`);
    if (existing.raw?.named===false || definition.correctName) {
      existing.raw ||= {};
      existing.raw.originalSourceName=existing.name;
      existing.aliases=unique([...(existing.aliases || []),existing.name]);
      existing.name=record.name;
      existing.raw.named=true;
      if (definition.correctName) { existing.raw.nameEvidence=definition.nameEvidence; existing.raw.nameEvidenceUrl=record.raw.sourceUrl; }
    }
    if (definition.correctCategory && existing.category!==record.category) {
      if (!definition.categoryEvidence) throw new Error(`Category correction needs evidence: ${record.id}`);
      existing.raw ||= {};
      existing.raw.originalSourceCategory=existing.category;
      existing.raw.categoryEvidence=definition.categoryEvidence;
      existing.raw.categoryEvidenceUrl=record.raw.sourceUrl;
      existing.category=record.category;
    }
    if (definition.correctAddress && record.address && existing.address!==record.address) {
      if (!definition.addressEvidence) throw new Error(`Address correction needs evidence: ${record.id}`);
      existing.raw ||= {};
      existing.raw.originalSourceAddress=existing.address || '';
      existing.raw.addressEvidence=definition.addressEvidence;
      existing.raw.addressEvidenceUrl=record.raw.sourceUrl;
      existing.address=record.address;
    }
    existing.aliases=unique([...(existing.aliases || []),record.name,...record.aliases]).filter(value=>value!==existing.name);
    for (const field of ['description','address','brand','brandWikidata']) if (!existing[field] && record[field]) existing[field]=record[field];
    existing.facets={...record.facets,...existing.facets};
    existing.raw ||= {};
    const raw=existing.raw;
    if (record.photos?.length) {
      existing.image ||= record.image;
      existing.photos=unique([...(existing.photos || []),...record.photos]);
      raw.photoCredits=[...new Map([...(raw.photoCredits || []),...record.raw.photoCredits].map(photo=>[photo.url,photo])).values()];
    }
    raw.officialDirectory ||= [];
    if (!raw.officialDirectory.some(entry=>entry.id===record.id)) raw.officialDirectory.push({
      id:record.id,sourceKind:record.raw.source,sourceUrl:record.raw.sourceUrl,sourceName:record.raw.sourceName || '',sourceRecordId:record.raw.sourceRecordId || '',checkedAt:record.raw.sourceCheckedAt,
      name:record.name,address:record.address || '',lat:record.lat,lng:record.lng,coordinateAccuracy:record.raw.coordinateAccuracy,
      coordinateSourceUrl:record.raw.coordinateSourceUrl,coordinateNote:record.raw.coordinateNote || '',matchEvidence:definition.matchEvidence,
    });
    for (const field of ['website','phone','openingHours','parentPlaceId']) if (!raw[field] && record.raw[field]) raw[field]=record.raw[field];
    const previous=raw.editorial || {};
    raw.editorial={...record.raw.editorial,...previous,
      sources:[...new Map([...(previous.sources || []),...record.raw.editorial.sources].map(value=>[value.url,value])).values()],
      posts:[...new Map([...(previous.posts || []),...record.raw.editorial.posts].map(value=>[value.id,value])).values()],
    };
  }
  // References point to canonical existing pages even when a source row was merged.
  for (const place of index.values()) if (place.raw?.parentPlaceId) place.raw.parentPlaceId=resolvedIds.get(place.raw.parentPlaceId) || place.raw.parentPlaceId;
  for (const place of index.values()) if (place.raw?.parentPlaceId && !index.has(place.raw.parentPlaceId)) throw new Error(`Missing directory parent: ${place.id} -> ${place.raw.parentPlaceId}`);
  return {additions,matchedRecords,resolvedIds:Object.fromEntries(resolvedIds)};
}
