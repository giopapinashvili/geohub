import { NATIVE_PLACE_SOURCE_LINKS } from './nativePlaceSourceLinks.js';
import { NATIVE_PLACE_SOURCE_RECORDS } from './nativePlaceSourceRecords.generated.js';
import { applyCuratedPlaceMedia } from './curatedPlaceMedia.js';

/** Display enrichment only: retain the original page, owner, coordinates and activity. */
export function enrichNativePlace(place) {
  const linkedOsmId = NATIVE_PLACE_SOURCE_LINKS[place?.id];
  const source = NATIVE_PLACE_SOURCE_RECORDS[linkedOsmId];
  if (!source) return place;
  const raw = { ...source.raw, ...place.raw, source: place.raw?.source || 'geohub', linkedOsmId,
    linkedSourceUrl: source.raw.sourceUrl, linkedSourceDate: source.raw.sourceDate };
  for (const key of ['website', 'phone', 'openingHours', 'brand', 'operator', 'wikidata', 'tenantIds', 'mallId', 'mallName']) {
    if (raw[key] == null || raw[key] === '') raw[key] = source.raw[key];
  }
  return applyCuratedPlaceMedia({ ...place,
    description: place.description || source.description || '',
    address: place.address || source.address || '', city: place.city || source.city || '',
    aliases: [...new Set([...(place.aliases || []), ...(source.aliases || [])])],
    facets: { ...source.facets, ...place.facets }, raw,
  });
}
