// MapLibre helpers: lazy loading, Carto basemaps that follow the theme,
// labels in the interface language, and a clustered places layer.

import { theme } from './theme.js';
import { lang } from './i18n.js';
import { ICONS } from '../ui/icons.js';

const STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};
// Carto's glyph server only has Georgian letters in Noto Sans.
export const LABEL_FONT = ['Noto Sans Regular'];

const MARKER_ICONS = ['map-pin', 'mountains', 'castle-turret', 'bank', 'fork-knife', 'coffee', 'wine', 'umbrella', 'buildings', 'bed', 'shopping-bag', 'martini', 'soccer-ball'];
const markerIcon = (name) => MARKER_ICONS.includes(name) && ICONS[name] ? name : 'map-pin';

/** Rasterize the bundled Phosphor paths synchronously: no font or image fetch. */
function addMarkerIcons(map) {
  if (typeof document === 'undefined' || typeof Path2D === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  for (const name of MARKER_ICONS) {
    if (!ICONS[name] || map.hasImage(`gh-icon-${name}`)) continue;
    ctx.clearRect(0, 0, 64, 64);
    ctx.save();
    ctx.translate(12, 12);
    ctx.scale(40 / 256, 40 / 256);
    ctx.fillStyle = '#ffffff';
    for (const [, path] of ICONS[name].matchAll(/<path\b[^>]*\bd="([^"]+)"/g)) ctx.fill(new Path2D(path));
    ctx.restore();
    map.addImage(`gh-icon-${name}`, ctx.getImageData(0, 0, 64, 64), { pixelRatio: 2 });
  }
  return true;
}

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
  const brand = dark ? '#3b82f6' : '#2563eb';
  const halo = dark ? '#0d0f13' : '#ffffff';
  const hasIcons = addMarkerIcons(map);
  map.addLayer({
    id: 'gh-clusters', type: 'circle', source: 'gh-places', filter: ['has', 'point_count'],
    paint: {
      'circle-color': brand, 'circle-opacity': 0.92, 'circle-stroke-width': 4, 'circle-stroke-color': dark ? 'rgba(59,130,246,0.35)' : 'rgba(37,99,235,0.25)',
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
    },
  });
  map.addLayer({
    id: 'gh-cluster-count', type: 'symbol', source: 'gh-places', filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': LABEL_FONT, 'text-size': 13, 'text-allow-overlap': true },
    paint: { 'text-color': '#ffffff' },
  });
  map.addLayer({
    id: 'gh-point-halos', type: 'circle', source: 'gh-places', filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['get', 'tone'],
      'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], hasIcons ? 26 : 17, hasIcons ? 21 : 12],
      'circle-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.24, 0.12],
      'circle-blur': 0.15,
    },
  });
  map.addLayer({
    id: 'gh-points', type: 'circle', source: 'gh-places', filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['get', 'tone'],
      'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], hasIcons ? 20 : 11, hasIcons ? 17 : 8],
      'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3.5, 2.5],
      'circle-stroke-color': halo,
    },
  });
  if (hasIcons) {
    map.addLayer({
      id: 'gh-point-icons', type: 'symbol', source: 'gh-places', filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': ['concat', 'gh-icon-', ['coalesce', ['get', 'icon'], 'map-pin']],
        'icon-size': 1, 'icon-allow-overlap': true, 'icon-ignore-placement': true,
      },
    });
  }
  map.addLayer({
    id: 'gh-labels', type: 'symbol', source: 'gh-places', filter: ['!', ['has', 'point_count']], minzoom: 9,
    layout: {
      'text-field': ['get', 'name'], 'text-font': LABEL_FONT, 'text-size': 12, 'text-offset': [0, hasIcons ? 1.85 : 1.1], 'text-anchor': 'top',
      'text-max-width': 9, 'text-optional': true, 'text-padding': 4,
    },
    paint: { 'text-color': dark ? '#f3ecea' : '#2a2224', 'text-halo-color': halo, 'text-halo-width': 1.6 },
  });
}

/** GeoJSON features for places that have coordinates. */
export function placesToGeoJSON(places, toneOf, iconOf = () => 'map-pin') {
  return {
    type: 'FeatureCollection',
    features: places.filter((p) => p.lat != null && p.lng != null).map((p) => ({
      type: 'Feature', id: p.id,
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, name: p.name, tone: toneOf(p), icon: markerIcon(iconOf(p)) },
    })),
  };
}
