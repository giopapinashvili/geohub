// Search without a search service: Firestore prefix queries on name fields
// (as typed, lower-case and capitalised), plus a recent-content scan for
// post text. Garbled demo documents are skipped.

import { collection, query, where, limit, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { normBiz, normPlace, normGroup, normEvent, normVideo, normItem, normPost, isCorruptSeed } from './normalize.js';
import { searchUsers } from './users.js';
import { uid as myUid, profile } from '../lib/auth.js';

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

export const searchPlaces = (t, n) => prefixSearch('places', ['name', 'title'], t, normPlace, n);
export const searchBusinesses = async (t, n) => (await prefixSearch('businesses', ['name', 'title'], t, normBiz, n)).filter((b) => !b.deleted);
export const searchGroups = (t, n) => prefixSearch('groups', ['name', 'title'], t, normGroup, n);
export const searchEvents = (t, n) => prefixSearch('events', ['title', 'name'], t, normEvent, n);
export const searchVideos = async (t, n) => (await prefixSearch('videos', ['title'], t, normVideo, n)).filter((v) => v.status === 'active');
export const searchItems = async (t, n) => (await prefixSearch('marketplace', ['title'], t, normItem, n)).filter((i) => i.status === 'active');

export async function searchPosts(term, n = 20) {
  const needle = term.trim().toLowerCase().replace(/^#/, '');
  if (!needle) return [];
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(300))).catch(() => ({ docs: [] }));
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
  if (t.length < 2) return { users: [], places: [], businesses: [], groups: [] };
  const [users, places, businesses, groups] = await Promise.all([
    searchUsers(t, 4), searchPlaces(t, 3), searchBusinesses(t, 3), searchGroups(t, 3),
  ]);
  return { users, places, businesses, groups };
}

export async function searchAll(term) {
  const t = term.trim();
  const [people, places, businesses, groups, events, videos, items, posts] = await Promise.all([
    searchUsers(t, 20), searchPlaces(t, 20), searchBusinesses(t, 20), searchGroups(t, 20),
    searchEvents(t, 20), searchVideos(t, 20), searchItems(t, 20), searchPosts(t, 20),
  ]);
  return { people, places, businesses, groups, events, videos, items, posts };
}

/* ── Recent searches (users.searchHistory, max 10 by rule) ─── */
const LOCAL_KEY = 'gh_recent_searches';

export function recentSearches() {
  const fromProfile = profile.value?.raw?.searchHistory;
  if (Array.isArray(fromProfile) && myUid.value) return fromProfile.filter((x) => typeof x === 'string').slice(0, 10);
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]').slice(0, 10); } catch { return []; }
}

export function rememberSearch(term) {
  const t = term.trim();
  if (!t) return;
  const next = [t, ...recentSearches().filter((x) => x !== t)].slice(0, 10);
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  if (myUid.value) updateDoc(doc(db, 'users', myUid.value), { searchHistory: next }).catch(() => {});
}

export function clearSearches() {
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
  if (myUid.value) updateDoc(doc(db, 'users', myUid.value), { searchHistory: [] }).catch(() => {});
}
