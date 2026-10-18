import { canonicalCategory } from './placeTaxonomy.js';

/** Locally hosted brand artwork. Only explicit brand identity matches a logo. */
export const MAP_BRANDS = {
  spar: { aliases: ['spar', 'სპარი', 'სპარ'], file: 'spar.svg', wide: true },
  '2nabiji': { aliases: ['ორი ნაბიჯი', '2 ნაბიჯი', '2nabiji', 'ori nabiji', 'orinabiji'], file: '2nabiji.png', crop: [150, 110, 330, 395] },
  nikora: { aliases: ['ნიკორა', 'ნიკორა სუპერმარკეტი', 'nikora', 'nikora supermarket'], file: 'nikora.svg', wide: true },
  tbc: { aliases: ['თიბისი', 'თიბისი ბანკი', 'tbc', 'tbc bank', 'tbcbank'], file: 'tbc.png' },
  metro: { aliases: [], file: 'metro.svg' },
};
const normalize = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const aliases = new Map(Object.entries(MAP_BRANDS).flatMap(([id, entry]) => entry.aliases.map(alias => [normalize(alias), id])));

export function markerBrand(place) {
  return aliases.get(normalize(place?.brand || place?.raw?.brand)) || '';
}

const REGION = new Set(['airport', 'nature', 'peak', 'attraction', 'history', 'monument']);
const IMPORTANT = new Set(['metro', 'rail-station', 'hospital', 'mall', 'university', 'park', 'museum', 'stadium', 'bus-station']);
const LOCAL = new Set(['office', 'warehouse', 'industrial', 'craft', 'school', 'kindergarten']);
const DETAIL = new Set(['atm', 'payment-terminal', 'crypto-atm', 'bus-stop', 'parking', 'bicycle-parking', 'drinking-water', 'water-point', 'toilets', 'post-box', 'parcel-locker']);
const TINY = new Set(['traffic-signals', 'bench', 'waste-basket', 'recycling', 'vending-machine']);

/** Zoom levels describe cartographic importance, never business quality. */
export function markerPriority(place) {
  const category = canonicalCategory(place?.category);
  const count = Math.max(0, Number(place?.brandBranchCount) || 0);
  const brand = markerBrand(place);
  if (category === 'metro') return { minZoom: 11, rank: 0, brand: 'metro', brandAlways: true };
  if (category === 'metro-entrance') return { minZoom: 15, rank: 2, brand: 'metro', brandAlways: true };
  if (REGION.has(category)) return { minZoom: 10, rank: 10, brand, brandAlways: count >= 5 };
  if (IMPORTANT.has(category)) return { minZoom: 12, rank: 20, brand, brandAlways: count >= 5 };
  if (TINY.has(category)) return { minZoom: 18, rank: 90, brand, brandAlways: false };
  if (DETAIL.has(category)) return { minZoom: 16, rank: 70, brand, brandAlways: count >= 5 };
  if (count >= 5 && brand) return { minZoom: 13, rank: 30, brand, brandAlways: true };
  if (LOCAL.has(category)) return { minZoom: 16, rank: 65, brand, brandAlways: false };
  return { minZoom: 14, rank: 50, brand, brandAlways: false };
}
