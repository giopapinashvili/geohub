import { PLACE_BRANDS as BASE_PLACE_BRANDS } from './placeBrandRegistry.js';
import { INSTITUTION_PLACE_BRANDS } from './institutionBrandRegistry.generated.js';
import { DIRECTORY_PLACE_BRANDS } from './directoryBrandRegistry.generated.js';
import { WOLT_PLACE_BRANDS } from './woltBrandRegistry.generated.js';
import { SERVICES_PLACE_BRANDS } from './servicesBrandRegistry.generated.js';
import { PROFESSIONAL_PLACE_BRANDS } from './professionalBrandRegistry.generated.js';
import { canonicalCategory } from './placeTaxonomy.js';

export const PLACE_BRANDS = { ...WOLT_PLACE_BRANDS, ...DIRECTORY_PLACE_BRANDS, ...BASE_PLACE_BRANDS, ...INSTITUTION_PLACE_BRANDS, ...SERVICES_PLACE_BRANDS, ...PROFESSIONAL_PLACE_BRANDS };
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const aliases = new Map(Object.entries(PLACE_BRANDS).flatMap(([id, entry]) => entry.aliases.map(alias => [normalize(alias), id])));
const domains = new Map(Object.entries(PLACE_BRANDS).flatMap(([id, entry]) => (entry.domains || []).map(domain => [domain, id])));
const exactPlaces = new Map(Object.entries(PLACE_BRANDS).flatMap(([id, entry]) => (entry.placeIds || []).map(placeId => [placeId, id])));
const allowedCategory = (id, place) => !PLACE_BRANDS[id].categories || PLACE_BRANDS[id].categories.includes(canonicalCategory(place?.category));

/** Only reviewed exact identities match. Never infer a logo from fuzzy search. */
export function placeBrandId(place) {
  if (!place) return '';
  const category = canonicalCategory(place.category);
  if (category === 'metro' || category === 'metro-entrance') return 'metro';
  const exact = exactPlaces.get(place.raw?.linkedOsmId || place.id);
  if (exact && allowedCategory(exact, place)) return exact;
  const tags = place.raw?.tags || {};
  for (const value of [place.brand, place.raw?.brand, tags.brand]) {
    const id = aliases.get(normalize(value));
    if (id && allowedCategory(id, place)) return id;
  }
  // A source may omit brand while still giving an unambiguous exact name.
  for (const value of [place.name, ...(Array.isArray(place.aliases) ? place.aliases : []), tags['name:ka'], tags['name:en'], tags.operator]) {
    const id = aliases.get(normalize(value));
    if (id && allowedCategory(id, place)) return id;
  }
  for (const value of [place.website, place.raw?.website, tags.website, tags['contact:website']]) {
    if (typeof value !== 'string' || !value.trim()) continue;
    try {
      const host = new URL(value).hostname.replace(/^www\./, '').toLowerCase();
      let suffix = host;
      let id = domains.get(suffix);
      while (!id && suffix.includes('.')) {
        suffix = suffix.slice(suffix.indexOf('.') + 1);
        id = domains.get(suffix);
      }
      if (id && allowedCategory(id, place)) return id;
    } catch { /* An invalid/unknown website cannot establish a brand identity. */ }
  }
  return '';
}

export function placeBrand(place) {
  const id = placeBrandId(place);
  return id ? { id, background: '#ffffff', ...PLACE_BRANDS[id], src: `/map-brands/${PLACE_BRANDS[id].file}` } : null;
}
