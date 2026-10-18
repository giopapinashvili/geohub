import { matchesPlaceCategory } from './placeTaxonomy.js';

export const EMPTY_PLACE_FILTERS = Object.freeze({ diet: '', preparationMax: '', experienceTag: '', wheelchair: false, outdoor: false, takeaway: false, delivery: false, wifi: false, children: false, free: false, parking: false, indoor: false, gaming: false });
export const placeFilterCount = (filters) => Object.values(filters).filter(Boolean).length;
export function matchesPlaceFilters(place, filters = EMPTY_PLACE_FILTERS, category = 'all') {
  if (!matchesPlaceCategory(place, category)) return false;
  const f = { ...(place.raw?.facets || {}), ...(place.facets || {}) };
  const tags = place.raw?.tags || {};
  if (filters.diet && !f.diets?.includes(filters.diet)) return false;
  if (filters.preparationMax && (!Number.isFinite(place.preparationMinutes) || place.preparationMinutes < 0 || place.preparationMinutes > Number(filters.preparationMax))) return false;
  if (filters.wheelchair && f.wheelchair !== 'yes') return false;
  if (filters.outdoor && f.outdoorSeating !== true) return false;
  if (filters.indoor && f.indoor !== true) return false;
  if (filters.takeaway && f.takeaway !== true) return false;
  if (filters.delivery && f.delivery !== true) return false;
  if (filters.wifi && !['wlan', 'yes'].includes(f.internetAccess)) return false;
  if (filters.free && f.fee !== false) return false;
  if (filters.parking && f.parking !== true && !['yes', 'customers'].includes(tags.parking) && place.category !== 'parking') return false;
  if (filters.children && f.children !== true && !['playground', 'kids-centre', 'theme-park', 'amusement-arcade', 'zoo', 'aquarium'].includes(place.category)) return false;
  if (filters.gaming && !['gaming', 'gaming-centre', 'amusement-arcade', 'internet-cafe', 'vr', 'escape-room'].includes(place.category) && !f.gaming) return false;
  return true;
}
