// MapLibre helpers: shared geometry, localized labels and places.
import { lang } from './i18n.js';
import { ICONS } from '../ui/icons.js';
import { isMapCoordinate, readCoordinates } from './coordinates.js';
import { markerPriority } from './mapMarkerPolicy.js';
import { markerBadgeId, preparePlaceImages } from './mapMarkerImages.js';

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
export const LABEL_FONT = ['Noto Sans Regular'];
const markerIcon = (name) => Object.hasOwn(ICONS, name) ? name : 'map-pin';

let loading = null;
/** MapLibre loads only when a map is needed. Regional tiles use ordinary HTTP. */
export function loadMapLibre() {
  if (!loading) {
    loading = Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(([m]) => m.default || m)
      .catch((e) => { loading = null; throw e; });
  }
  return loading;
}

export const styleUrl = () => BASEMAP_STYLE;

/** Preserve original Georgian spelling; CARTO's uppercase glyph stack is incomplete. */
export function localizeLabels(map) {
  const field = lang.value === 'ka'
    ? ['coalesce', ['get', 'name:ka'], ['get', 'name'], ['get', 'name_en']]
    : ['coalesce', ['get', 'name_en'], ['get', 'name']];
  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== 'symbol' || !layer.layout?.['text-field']) continue;
    map.setLayoutProperty(layer.id, 'text-font', LABEL_FONT);
    map.setLayoutProperty(layer.id, 'text-transform', 'none');
    if (/country|continent|housenumber|^gh-/.test(layer.id)) continue;
    if (JSON.stringify(layer.layout['text-field']).includes('name')) map.setLayoutProperty(layer.id, 'text-field', field);
  }
}

/** Single collision-managed symbol per place; no numbered cluster circles. */
export function addPlaceLayers(map, data) {
  if (!map.getSource('gh-places')) map.addSource('gh-places', {
    type: 'geojson', data, cluster: false, promoteId: 'id', maxzoom: 18,
    attribution: '<a href="/map-brands/ATTRIBUTION.md">Map symbols &amp; brands</a>',
  });
  preparePlaceImages(map, data);
  if (map.getLayer('gh-points')) return;
  map.addLayer({
    id: 'gh-points', type: 'symbol', source: 'gh-places', minzoom: 9,
    filter: ['>=', ['zoom'], ['get', 'minZoom']],
    layout: {
      'icon-image': ['step', ['zoom'],
        ['case', ['get', 'brandAlways'], ['get', 'brandBadge'], ['get', 'badge']],
        17, ['get', 'brandBadge']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 0.95, 19, 1.05],
      'icon-allow-overlap': false, 'icon-ignore-placement': false, 'icon-padding': 5,
      'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport',
      'symbol-sort-key': ['get', 'rank'],
      'text-field': ['step', ['zoom'], ['case', ['<=', ['get', 'minZoom'], 12], ['get', 'name'], ''], 14, ['get', 'name']],
      'text-font': LABEL_FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 17, 12],
      'text-offset': [0, 1.8], 'text-anchor': 'top', 'text-max-width': 9,
      'text-optional': true, 'text-padding': 4, 'text-transform': 'none',
      'text-pitch-alignment': 'viewport', 'text-rotation-alignment': 'viewport',
    },
    paint: {
      'icon-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0, 1],
      'text-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0, 1],
      'text-color': '#2c4438', 'text-halo-color': '#fffef9', 'text-halo-width': 1.8, 'text-halo-blur': 0.3,
    },
  });
}

/** Register new category/brand badges before the source uses them. */
export function setPlaceData(map, data) {
  const source = map.getSource('gh-places');
  if (!source) return;
  preparePlaceImages(map, data);
  source.setData(data);
}

export function applyPlaceTheme(map, mode = 'light') {
  if (!map.getLayer('gh-points')) return;
  const dark = mode === 'dark';
  map.setPaintProperty('gh-points', 'text-color', dark ? '#e5eee7' : '#2c4438');
  map.setPaintProperty('gh-points', 'text-halo-color', dark ? '#152126' : '#fffef9');
}

/** Invalid and unprojectable coordinates never reach the renderer. */
export function placesToGeoJSON(places, toneOf, iconOf = () => 'map-pin') {
  return {
    type: 'FeatureCollection',
    features: places.filter(place => isMapCoordinate(place) && place.category !== 'metro' && !place.raw?.mapHidden).map((place) => {
      const { lat, lng } = readCoordinates(place);
      const tone = toneOf(place);
      const icon = markerIcon(iconOf(place));
      const priority = markerPriority(place);
      const badge = markerBadgeId(icon, tone);
      return {
        type: 'Feature', id: place.id,
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          id: place.id, name: place.name || place.title || '', tone, icon, badge,
          ...priority, brandBadge: priority.brand ? `gh-brand-${priority.brand}` : badge,
        },
      };
    }),
  };
}
