// MapLibre helpers: lazy loading, Carto basemaps that follow the theme,
// labels in the interface language, and a clustered places layer.

import { theme } from './theme.js';
import { lang } from './i18n.js';

const STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};
// Carto's glyph server only has Georgian letters in Noto Sans.
export const LABEL_FONT = ['Noto Sans Regular'];

let loading = null;
/** The maplibre-gl module and its stylesheet, loaded on first use. */
export function loadMapLibre() {
  if (!loading) {
    loading = Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(([m]) => m.default || m)
      .catch((e) => { loading = null; throw e; });
  }
  return loading;
}

export const styleUrl = () => STYLES[theme.value === 'dark' ? 'dark' : 'light'];

/**
 * Carto styles label cities in English below zoom 13. Show local (Georgian)
 * names for a Georgian interface and English names otherwise. Country
 * labels stay in English: their local names would be in several scripts.
 */
export function localizeLabels(map) {
  const local = lang.value === 'ka';
  const field = local ? ['coalesce', ['get', 'name'], ['get', 'name_en']] : ['coalesce', ['get', 'name_en'], ['get', 'name']];
  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== 'symbol' || !layer.layout?.['text-field']) continue;
    if (/country|continent|housenumber|^gh-/.test(layer.id)) continue;
    const tf = JSON.stringify(layer.layout['text-field']);
    if (!tf.includes('name')) continue;
    map.setLayoutProperty(layer.id, 'text-field', field);
  }
}

/** Adds (or re-adds after a style switch) the clustered places layers. */
export function addPlaceLayers(map, data, dark) {
  if (!map.getSource('gh-places')) {
    map.addSource('gh-places', { type: 'geojson', data, cluster: true, clusterRadius: 44, clusterMaxZoom: 13, promoteId: 'id' });
  }
  const brand = dark ? '#d62f60' : '#d42a58';
  const halo = dark ? '#1a1617' : '#ffffff';
  map.addLayer({
    id: 'gh-clusters', type: 'circle', source: 'gh-places', filter: ['has', 'point_count'],
    paint: {
      'circle-color': brand, 'circle-opacity': 0.92, 'circle-stroke-width': 4, 'circle-stroke-color': dark ? 'rgba(214,47,96,0.35)' : 'rgba(212,42,88,0.25)',
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
    },
  });
  map.addLayer({
    id: 'gh-cluster-count', type: 'symbol', source: 'gh-places', filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': LABEL_FONT, 'text-size': 13, 'text-allow-overlap': true },
    paint: { 'text-color': '#ffffff' },
  });
  map.addLayer({
    id: 'gh-points', type: 'circle', source: 'gh-places', filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['get', 'tone'],
      'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], 11, 8],
      'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 4, 2.5],
      'circle-stroke-color': halo,
    },
  });
  map.addLayer({
    id: 'gh-labels', type: 'symbol', source: 'gh-places', filter: ['!', ['has', 'point_count']], minzoom: 9,
    layout: {
      'text-field': ['get', 'name'], 'text-font': LABEL_FONT, 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top',
      'text-max-width': 9, 'text-optional': true,
    },
    paint: { 'text-color': dark ? '#f3ecea' : '#2a2224', 'text-halo-color': halo, 'text-halo-width': 1.6 },
  });
}

/** GeoJSON features for places that have coordinates. */
export function placesToGeoJSON(places, toneOf) {
  return {
    type: 'FeatureCollection',
    features: places.filter((p) => p.lat != null && p.lng != null).map((p) => ({
      type: 'Feature', id: p.id,
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, name: p.name, tone: toneOf(p) },
    })),
  };
}
