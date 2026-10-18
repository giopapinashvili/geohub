// Server-only retrieval for the private advisor. Published public assets and
// anonymous Firestore reads only: no admin SDK, auth tokens or user profiles.
import { readFile } from 'node:fs/promises';
import { loadPublicCatalog } from './advisor-data.mjs';
import { readCoordinates } from '../src/lib/coordinates.js';
import { taxonomyCategory } from '../src/lib/placeTaxonomy.js';
import { normalizeCommerceItem, normalizeCommerceOffer, commerceOfferState } from '../src/lib/commerce.js';

const ROOT = new URL('../public/place-data/', import.meta.url);
const BASE = 'https://firestore.googleapis.com/v1/projects/geohub-main/databases/(default)/documents';
const ID = /^[A-Za-z0-9_-]{1,150}$/;
const FIELDS = ['businessId', 'itemId', 'type', 'title', 'description', 'categoryId', 'imageUrl', 'sourceUrl',
  'priceMinor', 'originalPriceMinor', 'currency', 'status', 'available', 'allBranches', 'branchIds',
  'dietaryTags', 'preparationMinutes', 'bundleItemIds', 'isDemo', 'demoBatchId', 'conditions', 'startsAtMs', 'endsAtMs'];
const str = (value, max = 600) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const jsonFile = async file => JSON.parse(await readFile(new URL(file, ROOT), 'utf8'));

/** The city index contributes sparse facts only, never inferred prices/photos. */
export function importedAdvisorRecords(payload, sourceDate) {
  if (payload?.v !== 2 || !Array.isArray(payload.strings) || !Array.isArray(payload.rows)) throw new Error('Invalid city index');
  const strings = payload.strings;
  const prefixes = { n: 'node', w: 'way', r: 'relation' };
  return payload.rows.slice(0, 120000).flatMap(row => {
    if (!Array.isArray(row)) return [];
    const match = /^([nwr])(\d+)$/.exec(row[0]);
    const point = readCoordinates({ lat: row[5], lng: row[6] });
    const name = str(strings[row[1]], 180);
    if (!match || !point || !name) return [];
    const id = `osm_${prefixes[match[1]]}_${match[2]}`;
    const category = str(strings[row[4]], 100);
    return [{ key: `place:${id}`, id, kind: 'place', name, title: name, category,
      categoryLabel: taxonomyCategory(category)?.label || '',
      aliases: Array.isArray(row[2]) ? row[2].slice(0, 12).map(index => str(strings[index], 180)).filter(Boolean) : [],
      address: str(strings[row[3]], 400), description: '', city: '', image: '', ...point,
      source: 'OpenStreetMap', sourceDate: str(sourceDate, 40),
      coordinateAccuracy: row[9] === 1 ? 'approximate-center' : 'source-point',
      path: `/place/${id}`, mapPath: `/map?place=${id}` }];
  });
}

export async function loadAdvisorCity({ readJson = jsonFile } = {}) {
  const manifest = await readJson('manifest.json');
  if (manifest?.version !== 1 || !/^search-index-[a-f0-9]{12}\.json$/.test(manifest.search?.file)) throw new Error('Invalid city manifest');
  const records = importedAdvisorRecords(await readJson(manifest.search.file), manifest.source?.sourceDate);
  return { records, sourceDate: manifest.source?.sourceDate || '', datasetId: manifest.datasetId || '' };
}

function decode(value) {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).slice(0, 20).map(decode);
  return undefined;
}

async function queryCommerce(collection, fetchImpl, now) {
  const filters = [
    { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } } },
    { fieldFilter: { field: { fieldPath: 'isDemo' }, op: 'EQUAL', value: { booleanValue: false } } },
  ];
  if (collection === 'commerceOffers') filters.push(
    { fieldFilter: { field: { fieldPath: 'endsAtMs' }, op: 'GREATER_THAN', value: { integerValue: String(now) } } },
  );
  const signal = AbortSignal.timeout(8000);
  const response = await fetchImpl(`${BASE}:runQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'omit', redirect: 'error', signal,
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], select: { fields: FIELDS.map(fieldPath => ({ fieldPath })) },
      where: filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } }, limit: 201 } }) });
  if (!response.ok) throw new Error('Public commerce unavailable');
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error('Invalid commerce response');
  const documents = body.map(entry => entry.document).filter(Boolean);
  const prefix = `projects/geohub-main/databases/(default)/documents/${collection}/`;
  return { truncated: documents.length > 200, records: documents.slice(0, 200).flatMap(document => {
    const id = typeof document.name === 'string' && document.name.startsWith(prefix) ? document.name.slice(prefix.length) : '';
    if (!ID.test(id)) return [];
    return [{ id, ...Object.fromEntries(FIELDS.map(field => [field, decode(document.fields?.[field])])) }];
  }) };
}

/** Prices are merchant-published facts at fetch time, not stock guarantees.
 * Specific branch offers never acquire headquarters coordinates. */
export function commerceAdvisorRecords(items, offers, businesses, now = Date.now()) {
  const merchants = new Map(businesses.filter(record => record.kind === 'business').map(record => [record.id, record]));
  const validItems = new Map();
  const result = [];
  const recordFor = (data, id, kind, item) => {
    const business = merchants.get(data.businessId);
    if (!business || !ID.test(id) || data.isDemo !== false || data.status !== 'published') return null;
    const params = new URLSearchParams({ tab: item.type === 'dish' ? 'menu' : 'catalog', item: item.id });
    if (!data.allBranches && data.branchIds.length === 1) params.set('branch', data.branchIds[0]);
    return { key: `${kind}:${id}`, id, kind, name: data.title, title: data.title,
      category: item.categoryId, categoryLabel: taxonomyCategory(item.categoryId)?.label || '',
      itemType: item.type, businessName: business.name, description: str(data.description),
      image: data.imageUrl || item.imageUrl || business.image || '',
      priceMinor: data.priceMinor, currency: data.currency, dietaryTags: item.dietaryTags,
      preparationMinutes: item.preparationMinutes, branchScope: data.allBranches ? 'all' : 'specific',
      branchCount: data.allBranches ? null : data.branchIds.length,
      path: `/business/${data.businessId}?${params}`, address: '', city: '',
      ...(kind === 'offer' ? { originalPriceMinor: data.originalPriceMinor, startsAtMs: data.startsAtMs, endsAtMs: data.endsAtMs, conditions: str(data.conditions, 1000) } : {}),
    };
  };
  for (const source of items.slice(0, 200)) {
    if (source.isDemo !== false || source.status !== 'published' || source.available === false) continue;
    try {
      const item = { ...normalizeCommerceItem(source), id: source.id };
      const record = recordFor(item, source.id, 'item', item);
      if (record) { validItems.set(item.id, item); result.push(record); }
    } catch { /* Invalid source data cannot become a recommendation. */ }
  }
  for (const source of offers.slice(0, 200)) {
    if (source.isDemo !== false || commerceOfferState(source, now) !== 'active') continue;
    try {
      const item = validItems.get(source.itemId);
      if (!item || source.currency !== item.currency || source.type !== item.type) continue;
      const offer = normalizeCommerceOffer(source, item);
      const record = recordFor(offer, source.id, 'offer', item);
      if (record) result.push(record);
    } catch { /* Includes missing/archived items and changed base prices. */ }
  }
  return result;
}

export async function loadExpandedAdvisorCatalog({ fetchImpl = fetch, loadBase = loadPublicCatalog, loadCity = loadAdvisorCity, now = Date.now() } = {}) {
  const [base, city, items, offers] = await Promise.allSettled([
    loadBase({ fetchImpl }), loadCity(), queryCommerce('commerceItems', fetchImpl, now), queryCommerce('commerceOffers', fetchImpl, now),
  ]);
  const businessRecords = base.status === 'fulfilled' ? base.value.records : [];
  const cityRecords = city.status === 'fulfilled' ? city.value.records : [];
  const commerce = commerceAdvisorRecords(items.status === 'fulfilled' ? items.value.records : [], offers.status === 'fulfilled' ? offers.value.records : [], businessRecords, now);
  const records = [...new Map([...businessRecords, ...cityRecords, ...commerce].map(record => [record.key, record])).values()];
  if (!records.length) throw new Error('Public catalog unavailable');
  return { records, coverage: { partial: true, loaded: records.length, fetchedAt: new Date(now).toISOString(),
    citySourceDate: city.status === 'fulfilled' ? city.value.sourceDate : '', cityPlaces: cityRecords.length,
    commerceRecords: commerce.length, commerceCapPerCollection: 200,
    catalogTruncated: items.status === 'fulfilled' ? items.value.truncated : null,
    offersTruncated: offers.status === 'fulfilled' ? offers.value.truncated : null,
    unavailable: [base, city, items, offers].map((entry, index) => entry.status === 'rejected' ? ['publicPages', 'citySnapshot', 'catalogItems', 'offers'][index] : null).filter(Boolean),
  } };
}
