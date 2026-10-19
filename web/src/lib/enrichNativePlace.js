import { NATIVE_PLACE_SOURCE_LINKS } from './nativePlaceSourceLinks.js';
import { NATIVE_PLACE_SOURCE_RECORDS } from './nativePlaceSourceRecords.generated.js';
import { applyCuratedPlaceMedia } from './curatedPlaceMedia.js';

/** Retain page/owner/activity; only explicitly reviewed legacy station points are corrected. */
export function enrichNativePlace(place) {
  const linkedOsmId = NATIVE_PLACE_SOURCE_LINKS[place?.id];
  const source = NATIVE_PLACE_SOURCE_RECORDS[linkedOsmId];
  if (!source) return place;
  const raw = { ...source.raw, ...place.raw, source: place.raw?.source || 'geohub', linkedOsmId,
    linkedSourceUrl: source.raw.sourceUrl, linkedSourceDate: source.raw.sourceDate };
  const mergeBy = (key, first = [], second = []) => [...new Map([...first, ...second].map(value => [value[key], value])).values()];
  if (source.raw.photoCredits?.length) raw.photoCredits = mergeBy('url', source.raw.photoCredits, place.raw?.photoCredits);
  if (source.raw.officialDirectory?.length) raw.officialDirectory = mergeBy('id', source.raw.officialDirectory, place.raw?.officialDirectory);
  if (source.raw.editorial) raw.editorial = { ...source.raw.editorial, ...place.raw?.editorial,
    sources: mergeBy('url', source.raw.editorial.sources, place.raw?.editorial?.sources),
    posts: mergeBy('id', source.raw.editorial.posts, place.raw?.editorial?.posts) };
  for (const key of ['website', 'phone', 'openingHours', 'brand', 'operator', 'wikidata', 'tenantIds', 'mallId', 'mallName']) {
    if (raw[key] == null || raw[key] === '') raw[key] = source.raw[key];
  }
  const metro = source.category === 'metro' && source.raw.mapPlaceId;
  if (metro) {
    raw.originalNativeCoordinates ||= {lat:place.lat,lng:place.lng};
    raw.originalNativeName ||= place.name;
    for (const key of ['mapHidden','mapPlaceId','mapCoordinates','metroEntranceIds','coordinateNote','coordinateAccuracy','coordinateSourceUrl']) raw[key] = source.raw[key];
  }
  return applyCuratedPlaceMedia({ ...place,
    ...(metro ? {name:source.name,category:'metro',lat:source.lat,lng:source.lng} : {}),
    image: place.image || source.image || '',
    photos: [...new Set([...(place.photos || []), ...(source.photos || [])])],
    description: place.description || source.description || '',
    address: place.address || source.address || '', city: place.city || source.city || '',
    aliases: [...new Set([...(place.aliases || []), ...(source.aliases || []), ...(metro ? [raw.originalNativeName] : [])])],
    facets: { ...source.facets, ...place.facets }, raw,
  });
}
