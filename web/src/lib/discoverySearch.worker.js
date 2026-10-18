import { loadImportedSearchIndex } from '../data/importedPlaces.js';
import { rankRecords } from './discoverySearch.js';
import { matchesPlaceFilters, placeFilterCount } from './discoveryFilters.js';

const newest = new Map();
self.onmessage = async ({ data }) => {
  const { id, query, category = 'all', filters = {}, limit = 60, channel = 'global', allowedPlaceIds, kinds } = data;
  newest.set(channel, id);
  try {
    const rows = await loadImportedSearchIndex();
    if (newest.get(channel) !== id) return;
    const allowed = Array.isArray(allowedPlaceIds) ? new Set(allowedPlaceIds) : null;
    const allowedKinds = Array.isArray(kinds) ? new Set(kinds.filter(kind => ['place', 'address'].includes(kind))) : null;
    const constrained = rows.filter((r) => (!allowedKinds || allowedKinds.has(r.kind)) && (r.kind === 'place' ? (!allowed || allowed.has(r.id)) && matchesPlaceFilters(r, filters, category) : !allowed && category === 'all' && !placeFilterCount(filters)));
    const result = rankRecords(constrained, query, { limit });
    if (newest.get(channel) === id) self.postMessage({ id, result });
  } catch { if (newest.get(channel) === id) self.postMessage({ id, error: true }); }
};
