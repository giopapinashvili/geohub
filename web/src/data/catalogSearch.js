import { collection, doc, getDoc, query, where, getDocs, orderBy, documentId, startAfter, limit } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { cachedList } from './cache.js';
import { getPlace } from './places.js';
import { normBiz } from './normalize.js';
import { rankRecords } from '../lib/discoverySearch.js';
import { searchableCatalogItem, matchesCatalogFilters, publicCatalogBusiness, catalogLocations, catalogResult } from '../lib/catalogDiscovery.js';
import { matchesPlaceFilters } from '../lib/discoveryFilters.js';
import { searchDirectoryCatalog } from './directoryCatalogSearch.js';
import { searchSourceServices } from './sourceCatalogs.js';

const CATALOG_CAP = 2000;
const BRANCH_CAP = 500;
const TTL = 5 * 60 * 1000;

/** Bounded, cursor-paginated public scan. A cap is metadata, never completeness. */
async function scan(collectionName, constraints, cap, orderField = documentId()) {
  const records = [];
  let cursor;
  while (records.length <= cap) {
    const size = Math.min(200, cap + 1 - records.length);
    const snapshot = await getDocs(query(collection(db, collectionName), ...constraints,
      orderBy(orderField, 'asc'), ...(cursor ? [startAfter(cursor)] : []), limit(size)));
    records.push(...snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })));
    if (snapshot.docs.length < size || records.length > cap) break;
    cursor = snapshot.docs.at(-1);
  }
  return { records: records.slice(0, cap), scannedCount: Math.min(records.length, cap), cap, truncated: records.length > cap };
}

const catalog = () => cachedList('commerce:search:items', 1, TTL, async () => [
  await scan('commerceItems', [where('status', '==', 'published')], CATALOG_CAP),
]).then(([result]) => result);

const branchesFor = (businessId) => cachedList(`commerce:search:branches:${businessId}`, 1, TTL, async () => [
  await scan('businessBranches', [where('businessId', '==', businessId), where('status', '==', 'published')], BRANCH_CAP, 'title'),
]).then(([result]) => result);

const businessFor = (businessId) => cachedList(`businesses:search:catalog:${businessId}`, 1, TTL, async () => {
  const snapshot = await getDoc(doc(db, 'businesses', businessId));
  return [snapshot.exists() ? normBiz(snapshot.id, snapshot.data()) : null];
}).then(([result]) => result);

/** One row per matched item and known branch. Includes non-map businesses too. */
async function searchManagedCatalog(term, n = 20, { filters = {}, category = 'all' } = {}) {
  const output = [];
  const coverage = { scannedCount: 0, cap: CATALOG_CAP, truncated: false, unavailable: false };
  output.coverage = coverage;
  if (String(term).trim().length < 2 && !filters.diet && !(Number(filters.preparationMax) > 0)) return output;
  let source;
  try { source = await catalog(); }
  catch { coverage.unavailable = true; return output; }
  Object.assign(coverage, { scannedCount: source.scannedCount, truncated: source.truncated });
  const matches = rankRecords(source.records.filter((item) => searchableCatalogItem(item) && matchesCatalogFilters(item, filters)), term, { limit: Math.min(60, Math.max(20, n * 2)) });
  const businesses = new Map();
  const loadBusiness = (id) => {
    if (!businesses.has(id)) businesses.set(id, Promise.all([businessFor(id), branchesFor(id)]));
    return businesses.get(id);
  };
  const candidates = [];
  const candidateLimit = category === 'all' && !Object.values(filters).some(Boolean) ? n : Math.min(100, Math.max(40, n * 3));
  // Sequential batches bound Firestore fan-out even for a broad dish query.
  for (let offset = 0; offset < matches.length; offset += 5) {
    const batch = await Promise.all(matches.slice(offset, offset + 5).map(async (item) => {
      try {
        const [business, branches] = await loadBusiness(item.businessId);
        if (!publicCatalogBusiness(business)) return [];
        coverage.truncated ||= branches.truncated;
        return catalogLocations(item, branches.records).map((branch) => ({ item, business, branch }));
      } catch { coverage.unavailable = true; return []; }
    }));
    // Interleave businesses so a chain cannot occupy every top result.
    for (let index = 0; batch.some((rows) => index < rows.length) && candidates.length < candidateLimit; index++) {
      for (const rows of batch) if (rows[index] && candidates.length < candidateLimit) candidates.push(rows[index]);
    }
    if (candidates.length >= candidateLimit) {coverage.truncated = true;break;}
  }
  for (let offset = 0; offset < candidates.length; offset += 5) {
    const rows = await Promise.all(candidates.slice(offset, offset + 5).map(async ({ item, business, branch }) => {
      const placeId = branch ? branch.placeId : business.raw?.placeId;
      let place = null;
      if (placeId) {
        try { place = await getPlace(placeId); }
        catch { coverage.unavailable = true; }
      }
      return catalogResult(item, business, branch, place);
    }));
    output.push(...rows.filter((row) => row && matchesPlaceFilters(row, filters, category)));
    if (output.length >= n) { output.splice(n); break; }
  }
  return output;
}

/** Independent sources fail separately; a missing managed catalog cannot hide public menus. */
export async function searchCatalog(term, n = 20, options = {}) {
  const results = await Promise.allSettled([
    searchManagedCatalog(term,n,options), searchDirectoryCatalog(term,n,options), searchSourceServices(term,n,options),
  ]);
  const coverage = {unavailable:false,truncated:false,scannedCount:0};
  const seen = new Set();
  const rows = [];
  for (const result of results) {
    if (result.status === 'rejected') {coverage.unavailable=true;continue;}
    coverage.unavailable ||= result.value.coverage?.unavailable === true;
    coverage.truncated ||= result.value.coverage?.truncated === true;
    coverage.scannedCount += result.value.coverage?.scannedCount || 0;
    for (const row of result.value) if (!seen.has(row.resultId)) {seen.add(row.resultId);rows.push({...row,businessName:row.businessName || row.name,branchName:row.branchName || row.name});}
  }
  const output=rows.sort((a,b)=>(b.searchScore || 0)-(a.searchScore || 0)).slice(0,n);
  output.coverage=coverage;
  return output;
}

/** Map callers get only real coordinates and one best item per location. */
export async function searchCatalogPlaces(term, n = 20, options = {}) {
  const source = await searchCatalog(term, Math.min(60, n * 2), options);
  const seen = new Set();
  const output = source.filter((record) => {
    if (!Number.isFinite(record.lat) || !Number.isFinite(record.lng) || seen.has(record.id)) return false;
    seen.add(record.id); return true;
  }).slice(0, n);
  output.coverage = source.coverage;
  return output;
}
