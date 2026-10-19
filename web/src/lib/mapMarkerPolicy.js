import { canonicalCategory } from './placeTaxonomy.js';
import { PLACE_BRANDS, placeBrandId } from './placeBrands.js';

/** Locally hosted brand artwork. Only explicit brand identity matches a logo. */
export const MAP_BRANDS = PLACE_BRANDS;

export function markerBrand(place) {
  return placeBrandId(place);
}

const REGION = new Set(['airport', 'nature', 'peak', 'attraction', 'history', 'monument']);
const IMPORTANT = new Set(['metro', 'rail-station', 'hospital', 'mall', 'university', 'park', 'museum', 'stadium', 'bus-station']);
const LOCAL = new Set(['office', 'warehouse', 'industrial', 'craft', 'school', 'kindergarten']);
const DETAIL = new Set(['atm', 'payment-terminal', 'crypto-atm', 'bus-stop', 'parking', 'bicycle-parking', 'drinking-water', 'water-point', 'toilets', 'post-box', 'parcel-locker']);
const TINY = new Set(['traffic-signals', 'bench', 'waste-basket', 'recycling', 'vending-machine']);

/** Zoom levels describe cartographic importance, never business quality. */
export function markerPriority(place) {
  const category = canonicalCategory(place?.category);
  const brand = markerBrand(place);
  if (category === 'metro') return { minZoom: 11, rank: 0, brand: 'metro', brandAlways: true };
  if (category === 'metro-entrance') return { minZoom: 15, rank: 2, brand: 'metro', brandAlways: true };
  const brandAlways = !!brand;
  if (REGION.has(category)) return { minZoom: 10, rank: 10, brand, brandAlways };
  if (IMPORTANT.has(category)) return { minZoom: 12, rank: 20, brand, brandAlways };
  if (TINY.has(category)) return { minZoom: 18, rank: 90, brand, brandAlways };
  if (DETAIL.has(category)) return { minZoom: 16, rank: 70, brand, brandAlways };
  if (LOCAL.has(category)) return { minZoom: 16, rank: 65, brand, brandAlways };
  if (brand) return { minZoom: 13, rank: 30, brand, brandAlways };
  return { minZoom: 14, rank: 50, brand, brandAlways };
}
