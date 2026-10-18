// Public discovery combines the static city index, bounded Firestore lists,
// and real published catalogs. Legacy social search retains its privacy rules.

import { collection, query, where, limit, getDocs, orderBy, setDoc, documentId, startAfter } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { normBiz, normGroup, normEvent, normVideo, normItem, normPost, isCorruptSeed } from './normalize.js';
import { searchUsers } from './users.js';
import { uid as myUid, account, accountRef } from '../lib/auth.js';
import { cachedList } from './cache.js';
import { listMapPlaces } from './places.js';
import { mergeImportedPlaces } from './importedPlaces.js';
import { rankRecords } from '../lib/discoverySearch.js';
import { searchImported } from '../lib/discoveryClient.js';
import { publicCatalogBusiness } from '../lib/catalogDiscovery.js';
import { searchCatalog } from './catalogSearch.js';
export { searchCatalogPlaces } from './catalogSearch.js';

function variants(term) {
  const t = term.trim();
  const set = new Set([t, t.toLowerCase(), t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()]);
  return [...set].filter(Boolean);
}

async function prefixSearch(col, fields, term, norm, n = 10) {
  const jobs = [];
  for (const f of fields) {
    for (const v of variants(term)) {
      jobs.push(getDocs(query(collection(db, col), where(f, '>=', v), where(f, '<=', v + ''), limit(n))).then((s) => s.docs).catch(() => []));
    }
  }
  const docs = (await Promise.all(jobs)).flat();
  const seen = new Set();
  const out = [];
  for (const d of docs) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    const data = d.data();
    if (isCorruptSeed(data)) continue;
    out.push(norm(d.id, data));
  }
  return out.slice(0, n);
}

async function searchDiscovery(term, n = 20, channel = 'global') {
  const coverage = { unavailable: false, truncated: false };
  if (term.trim().length < 2) return { places: [], addresses: [], coverage };
  const [native, imported] = await Promise.allSettled([
    listMapPlaces(), searchImported(term, { channel, limit: Math.max(60, n * 3) }),
  ]);
  coverage.unavailable = native.status === 'rejected' || imported.status === 'rejected';
  coverage.truncated = native.status === 'fulfilled' && native.value.truncated;
  const rows = imported.status === 'fulfilled' ? imported.value : [];
  const places = mergeImportedPlaces(native.status === 'fulfilled' ? native.value.places : [], rows.filter((row) => row.kind === 'place'));
  return {
    places: rankRecords(places, term, { limit: n }),
    addresses: rows.filter((row) => row.kind === 'address').slice(0, n), coverage,
  };
}

// Composer uses its own cancellation channel and receives places, not addresses.
export const searchPlaces = async (term, n = 10) => (await searchDiscovery(term, n, 'composer')).places;

const businessIndex = () => cachedList('businesses:search', 1, 5 * 60000, async () => {
  const records = [];
  let cursor;
  while (records.length <= 1000) {
    const size = Math.min(200, 1001 - records.length);
    const snapshot = await getDocs(query(collection(db, 'businesses'), orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(size)));
    records.push(...snapshot.docs.map((entry) => normBiz(entry.id, entry.data())));
    if (snapshot.docs.length < size || records.length > 1000) break;
    cursor = snapshot.docs.at(-1);
  }
  return [{ records: records.slice(0, 1000).filter((record) => !isCorruptSeed(record.raw) && publicCatalogBusiness(record)), truncated: records.length > 1000 }];
}).then(([result]) => result);

export async function searchBusinesses(term, n = 20) {
  const index = await businessIndex();
  const rows = rankRecords(index.records, term, { limit: n });
  rows.coverage = { truncated: index.truncated };
  return rows;
}
export const searchGroups = (t, n) => prefixSearch('groups', ['name', 'title'], t, normGroup, n);
export const searchEvents = (t, n) => prefixSearch('events', ['title', 'name'], t, normEvent, n);
export const searchVideos = async (t, n) => (await prefixSearch('videos', ['title'], t, normVideo, n)).filter((v) => v.status === 'active');
export const searchItems = async (t, n) => (await prefixSearch('marketplace', ['title'], t, normItem, n)).filter((i) => i.status === 'active');

export async function searchPosts(term, n = 20) {
  const needle = term.trim().toLowerCase().replace(/^#/, '');
  if (!needle) return [];
  // Only public posts are searchable (and the rules only allow that query).
  const snap = await getDocs(query(collection(db, 'posts'), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), limit(100))).catch(() => ({ docs: [] }));
  const out = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (isCorruptSeed(data) || (data.status && data.status !== 'active')) continue;
    if (data.visibility && data.visibility !== 'public') continue;
    const hay = `${data.text || ''} ${(data.tags || []).join(' ')} ${data.authorName || ''}`.toLowerCase();
    if (hay.includes(needle)) out.push(normPost(d.id, data));
    if (out.length >= n) break;
  }
  return out;
}

/** Header typeahead: a few results of each kind. */
export async function quickSearch(term) {
  const t = term.trim();
  if (t.length < 2) return { users: [], places: [], addresses: [], catalog: [], businesses: [], groups: [] };
  const results = await Promise.allSettled([
    searchUsers(t, 3), searchDiscovery(t, 3, 'header'), searchBusinesses(t, 3), searchGroups(t, 2), searchCatalog(t, 3),
  ]);
  const [users, discovery, businesses, groups, catalog] = results.map((result, i) => result.status === 'fulfilled' ? result.value : i === 1 ? { places: [], addresses: [], coverage: { unavailable: true } } : []);
  return { users, ...discovery, businesses, groups, catalog,
    coverage: { unavailable: results.some((result) => result.status === 'rejected') || discovery.coverage.unavailable || catalog.coverage?.unavailable,
      truncated: discovery.coverage.truncated || businesses.coverage?.truncated || catalog.coverage?.truncated } };
}

export async function searchAll(term) {
  const t = term.trim();
  const results = await Promise.allSettled([
    searchUsers(t, 20), searchDiscovery(t, 20, 'global'), searchBusinesses(t, 20), searchGroups(t, 20),
    searchEvents(t, 20), searchVideos(t, 20), searchItems(t, 20), searchPosts(t, 20), searchCatalog(t, 20),
  ]);
  const [people, discovery, businesses, groups, events, videos, items, posts, catalog] = results.map((result, i) => result.status === 'fulfilled' ? result.value : i === 1 ? { places: [], addresses: [], coverage: { unavailable: true } } : []);
  return { people, ...discovery, businesses, groups, events, videos, items, posts, catalog,
    coverage: { unavailable: results.some((result) => result.status === 'rejected') || discovery.coverage.unavailable || catalog.coverage?.unavailable,
      truncated: discovery.coverage.truncated || businesses.coverage?.truncated || catalog.coverage?.truncated } };
}

/* ── Recent searches (users/{uid}/private/account.searchHistory) ─── */
const LOCAL_KEY = 'gh_recent_searches';

export function recentSearches() {
  const saved = account.value?.searchHistory;
  if (Array.isArray(saved) && myUid.value) return saved.filter((x) => typeof x === 'string').slice(0, 10);
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]').slice(0, 10); } catch { return []; }
}

export function rememberSearch(term) {
  const t = term.trim();
  if (!t) return;
  const next = [t, ...recentSearches().filter((x) => x !== t)].slice(0, 10);
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  if (myUid.value) setDoc(accountRef(myUid.value), { searchHistory: next }, { merge: true }).catch(() => {});
}

export function clearSearches() {
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
  if (myUid.value) setDoc(accountRef(myUid.value), { searchHistory: [] }, { merge: true }).catch(() => {});
}
