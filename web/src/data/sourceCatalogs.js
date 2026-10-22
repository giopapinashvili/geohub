import { NATIVE_PLACE_SOURCE_LINKS } from '../lib/nativePlaceSourceLinks.js';
import { getImportedPlace } from './importedPlaces.js';
import { isPlaceLocationHeld } from '../lib/reviewedPlaceStatus.js';
import { rankRecords } from '../lib/discoverySearch.js';
import { matchesPlaceFilters } from '../lib/discoveryFilters.js';

const files = new Map();
const pending = new Map();
const MAX_CACHE_BYTES = 12 * 1024 * 1024;
let retainedBytes = 0;
const safeFile = value => typeof value === 'string' && /^[a-zA-Z0-9_/-]+(?:\.[a-f0-9]+)?\.json$/.test(value) && !value.includes('..') && !value.startsWith('/');
const immutableFile = file => /-[a-f0-9]{12}\.json$/.test(file);
export class OutdatedSourceCatalogError extends Error {
  constructor(file, status) {
    super('The public catalog asset is no longer available');
    this.name = 'OutdatedSourceCatalogError';
    this.code = 'SOURCE_CATALOG_OUTDATED_ASSET';
    this.file = file;
    this.status = status;
  }
}
export const isOutdatedSourceCatalogError = error => error instanceof OutdatedSourceCatalogError;
export function sourceHttpsUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}

/** Public static catalogs only. No accounts, cookies or whole-city downloads. */
export async function readSourceCatalogFile(file) {
  if (!safeFile(file)) throw new Error('Invalid public catalog filename');
  const previous = files.get(file);
  if (previous && previous.until > Date.now()) { files.delete(file); files.set(file, previous); return previous.value; }
  if (pending.has(file)) return pending.get(file);
  const promise = (async () => {
    const response = await fetch(`/catalog-data/${file}`, { credentials: 'omit', cache: immutableFile(file) ? 'force-cache' : 'no-cache', signal: AbortSignal.timeout(20000) });
    if (response.status === 404 && immutableFile(file)) throw new OutdatedSourceCatalogError(file, response.status);
    if (!response.ok) throw new Error('Catalog unavailable');
    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    if (immutableFile(file) && /(?:text\/html|application\/xhtml\+xml)/.test(contentType)) throw new OutdatedSourceCatalogError(file, response.status);
    const content = await response.text();
    if (content.length > 24 * 1024 * 1024) throw new Error('Catalog too large');
    if (immutableFile(file) && /^\s*(?:<!doctype\s+html\b|<html\b)/i.test(content)) throw new OutdatedSourceCatalogError(file, response.status);
    if (!contentType.includes('application/json')) throw new Error('Catalog unavailable');
    const value = JSON.parse(content);
    if (content.length <= MAX_CACHE_BYTES) {
      if (files.has(file)) { retainedBytes -= files.get(file).bytes; files.delete(file); }
      files.set(file, { value, bytes: content.length, until: immutableFile(file) ? Infinity : Date.now() + 300000 });
      retainedBytes += content.length;
      while (retainedBytes > MAX_CACHE_BYTES || files.size > 12) {
        const key = files.keys().next().value; retainedBytes -= files.get(key).bytes; files.delete(key);
      }
    }
    return value;
  })();
  pending.set(file, promise);
  try { return await promise; } finally { pending.delete(file); }
}

/** Refresh only the public index; account caches and valid immutable assets are untouched. */
export function refreshSourceCatalogIndex(staleIndex) {
  const current = files.get('index.json');
  // Another search may already have recovered from the same old snapshot.
  if (current && current.value !== staleIndex && current.until > Date.now()) return Promise.resolve(current.value);
  if (current) { retainedBytes -= current.bytes; files.delete('index.json'); }
  return readSourceCatalogFile('index.json');
}

export function normalizeSourceCatalog(catalog, expectedPlaceId) {
  if (catalog?.version !== 1 || catalog.placeId !== expectedPlaceId || !sourceHttpsUrl(catalog.sourceUrl)) throw new Error('Invalid catalog association');
  const seen = new Set();
  const items = (catalog.items || []).filter(item => typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,180}$/.test(item.id) && !seen.has(item.id) && (seen.add(item.id), true))
    .map(item => ({ ...item, name: String(item.name || '').trim(),
      priceMinor: Number.isSafeInteger(item.priceMinor) && item.priceMinor >= 0 && (!catalog.freshnessUntilMs || catalog.freshnessUntilMs > Date.now()) ? item.priceMinor : null,
      imageUrl: sourceHttpsUrl(item.imageUrl), currency: 'GEL',
      categoryIds: Array.isArray(item.categoryIds) ? item.categoryIds : [],
    })).filter(item => item.name && ['dish', 'product', 'service'].includes(item.kind));
  return { ...catalog, items, categories: Array.isArray(catalog.categories) ? catalog.categories : [] };
}

async function marketplaceCatalogs(placeId) {
  const index = await readSourceCatalogFile('index.json');
  if (index.version !== 1 || !index.byPlaceId || !index.venues) throw new Error('Invalid catalog index');
  const ids = Object.hasOwn(index.byPlaceId, placeId) ? index.byPlaceId[placeId] : [];
  const results = await Promise.allSettled(ids.map(async id => {
    const entry = index.venues[id];
    if (!entry || entry.placeId !== placeId || !entry.file) return null;
    return normalizeSourceCatalog(await readSourceCatalogFile(entry.file), placeId);
  }));
  return { catalogs: results.filter(result => result.status === 'fulfilled' && result.value && (result.value.items.length || result.value.status === 'partial')).map(result => result.value),
    failed: results.some(result => result.status === 'rejected') };
}

async function serviceCatalogs(placeId) {
  const index = await readSourceCatalogFile('services-index.json');
  if (index.version !== 1 || !index.places) throw new Error('Invalid services index');
  const files = Object.hasOwn(index.places, placeId) ? index.places[placeId].files : [];
  const results = await Promise.allSettled(files.map(async file => {
    const payload = await readSourceCatalogFile(file);
    if (payload.version !== 1 || !Array.isArray(payload.items)) throw new Error('Invalid service catalog');
    const items = payload.items.filter(item => item.placeIds?.includes(placeId));
    if (!items.length) return null;
    const normalized = items.map(item => ({ ...item, name:item.title, kind:'service', categoryIds:[item.categoryId],
      sourceUrl: sourceHttpsUrl(item.sourceUrlsByPlace?.[placeId]) || sourceHttpsUrl(item.sourceUrl),
      priceMinor: item.freshnessUntilMs && item.freshnessUntilMs < Date.now() ? null : item.priceMinor,
    }));
    return normalizeSourceCatalog({version:1,placeId,venueId:`service-${payload.provider.id}`,kind:'services',
      sourceName:payload.provider.name,sourceUrl:normalized[0].sourceUrl,sourceCheckedAt:index.sourceCheckedAt,
      status:items.some(item=>item.coverage==='partial') ? 'partial' : 'complete',
      note: items.some(item => item.scope === 'provider') ? 'მომწოდებლის მომსახურებები. კონკრეტულ ფილიალში მიღება, ჩაწერა და პირობები გადაამოწმე წყაროსთან.' : 'ამ ფილიალთან დაკავშირებული მომსახურებები. პირობები და მიღების დრო გადაამოწმე მომწოდებელთან.',
      items:normalized,categories:[]},placeId);
  }));
  return {catalogs:results.filter(result => result.status === 'fulfilled' && result.value).map(result => result.value),failed:results.some(result=>result.status === 'rejected')};
}

export async function loadPlaceSourceCatalogs(place) {
  const placeId = NATIVE_PLACE_SOURCE_LINKS[place.id] || place.id;
  const results = await Promise.allSettled([marketplaceCatalogs(placeId),serviceCatalogs(placeId)]);
  return {catalogs:results.flatMap(result => result.status === 'fulfilled' ? result.value.catalogs : []),
    failed:results.some(result => result.status === 'rejected' || result.value.failed)};
}

/** Service facts stay tied to explicit source branches, including provider scope. */
export async function searchSourceServices(term, n = 20, {filters = {}, category = 'all'} = {}) {
  const output = [];
  output.coverage = {unavailable:false,truncated:false};
  if (String(term).trim().length < 2 || filters.diet || Number(filters.preparationMax) > 0) return output;
  try {
    const index = await readSourceCatalogFile('services-index.json');
    const files = index.files || [];
    const results = await Promise.allSettled(files.slice(0,40).map(entry => readSourceCatalogFile(entry.file)));
    output.coverage.unavailable = results.some(result => result.status === 'rejected');
    output.coverage.truncated = files.length > 40;
    const items = results.flatMap(result => result.status === 'fulfilled' ? result.value.items || [] : []);
    const matches = rankRecords(items.map(item=>({...item,businessName:item.providerName})),term,{limit:40});
    const candidates = [];
    // Interleave providers/services to keep a large chain from filling the list.
    for (let branch = 0; matches.some(item => branch < item.placeIds.length) && candidates.length < 120; branch++) {
      for (const item of matches) if (item.placeIds[branch]) candidates.push({item,placeId:item.placeIds[branch]});
    }
    const seen = new Set();
    for (let offset = 0; offset < candidates.length && output.length < n; offset += 6) {
      const rows = await Promise.all(candidates.slice(offset,offset+6).map(async ({item,placeId}) => {
        const place = await getImportedPlace(placeId);
        if (!place || isPlaceLocationHeld(place) || !matchesPlaceFilters(place,filters,category)) return null;
        const href=`/place/${encodeURIComponent(place.id)}?${new URLSearchParams({tab:'catalog',item:item.id})}`;
        return {...place,kind:'place',resultId:`source:${item.id}:${place.id}`,title:item.title,itemTitle:item.title,
          matchedItemTitle:item.title,matchedItemType:'service',itemId:item.id,businessName:item.providerName,branchName:place.name,
          itemImage:sourceHttpsUrl(item.imageUrl),priceMinor:item.freshnessUntilMs && item.freshnessUntilMs < Date.now() ? null : item.priceMinor,
          currency:item.currency || 'GEL',priceKind:item.priceKind,priceUnit:item.priceUnit,sourceUrl:sourceHttpsUrl(item.sourceUrlsByPlace?.[placeId]) || sourceHttpsUrl(item.sourceUrl),priceContext:'official-source',
          canonicalBusinessHref:href,pageHref:href,searchMatch:item.searchMatch,searchScore:item.searchScore};
      }));
      for (const row of rows) if (row && !seen.has(row.id) && output.length < n) {seen.add(row.id);output.push(row);}
    }
    output.coverage.truncated ||= candidates.length >= 120;
  } catch { output.coverage.unavailable = true; }
  return output;
}
