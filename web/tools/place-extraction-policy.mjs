import { OSM_BUILDING_CATEGORIES } from '../src/lib/placeTaxonomy.js';

/** Preserve POIs, address points, and useful structures before normalization.
 * Generic residential buildings remain basemap geometry, not extra places.
 */
export function isRelevantOsmElement(tags = {}) {
  return ['amenity','shop','tourism','leisure','office','craft','healthcare','public_transport','emergency','historic','addr:housenumber'].some(key=>tags[key])
    || (tags.education && !['no','yes','none'].includes(tags.education))
    || tags.landuse === 'education'
    || tags.aeroway === 'aerodrome' || tags.aerialway === 'station'
    || /^(station|subway_entrance|halt)$/.test(tags.railway || '')
    || /^(bus_stop|traffic_signals|services|rest_area)$/.test(tags.highway || '')
    || (tags.highway && (tags.name || tags['name:ka'] || tags['name:en']))
    || Object.hasOwn(OSM_BUILDING_CATEGORIES, tags.building || '')
    || /^(water_tap|water_well)$/.test(tags.man_made || '')
    || /^(spring|peak|beach)$/.test(tags.natural || '');
}
