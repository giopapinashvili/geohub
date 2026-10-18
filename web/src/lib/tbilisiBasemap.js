// A versioned, self-hosted regional snapshot. Only visible vector tiles are fetched.
// Source coverage is OpenStreetMap, not a claim that every real building is mapped.
export const TBILISI_MAP_DATA = Object.freeze({
  source: 'OpenStreetMap / Protomaps',
  sourceUrl: 'https://docs.protomaps.com/basemaps/downloads',
  dataAsOf: '2026-10-18T04:00:00Z',
  url: '/map-tiles/tbilisi-20261018-v1/{z}/{x}/{y}.mvt',
  bounds: [44.60, 41.58, 45.05, 41.91],
  minzoom: 11,
  maxzoom: 15,
  schemaVersion: '4.15.2',
});

export const TBILISI_SOURCE = 'gh-tbilisi-current';
export const TBILISI_3D_LAYER = 'gh-tbilisi-buildings-3d';
const states = new WeakMap();
const region = {
  type: 'Polygon',
  coordinates: [[[44.60, 41.58], [45.05, 41.58], [45.05, 41.91], [44.60, 41.91], [44.60, 41.58]]],
};
const names = ['coalesce', ['get', 'name:ka'], ['get', 'name'], ['get', 'name:en']];
const shape = ['==', ['geometry-type'], 'Polygon'];

// CARTO still uses legacy property filters. They cannot be mixed directly with
// an expression filter such as `within`; preserve their meaning during masking.
export function expressionFilter(filter) {
  if (!Array.isArray(filter)) return filter;
  const [operator, property, ...values] = filter;
  if (['all', 'any', 'none'].includes(operator)) {
    const group = [operator === 'none' ? 'any' : operator, ...filter.slice(1).map(expressionFilter)];
    return operator === 'none' ? ['!', group] : group;
  }
  if (typeof property !== 'string') return filter;
  const get = property === '$type' ? ['geometry-type'] : property === '$id' ? ['id'] : ['get', property];
  if (['==', '!=', '>', '>=', '<', '<='].includes(operator)) return [operator, get, ...values];
  if (['in', '!in'].includes(operator)) {
    const inside = ['in', get, ['literal', values]];
    return operator === '!in' ? ['!', inside] : inside;
  }
  if (operator === '!has') return ['!', ['has', property]];
  return filter;
}

function maskPreviousData(map, state, active) {
  for (const layer of map.getStyle().layers || []) {
    if (layer.source !== 'carto') continue;
    if (!['building', 'housenumber'].includes(layer['source-layer']) && !/^roadname_/.test(layer.id)) continue;
    if (!state.originalFilters.has(layer.id)) state.originalFilters.set(layer.id, layer.filter ?? null);
    const original = state.originalFilters.get(layer.id);
    const outside = ['!', ['within', region]];
    map.setFilter(layer.id, active ? (original ? ['all', expressionFilter(original), outside] : outside) : original);
  }
}

/** Shared by the map's pitch handler; two constant-time visibility changes only. */
export function updateBuildingPerspective(map) {
  const tilted = map.getPitch() > 1;
  for (const id of ['gh-buildings-3d', TBILISI_3D_LAYER]) {
    if (!map.getLayer(id)) continue;
    const failed = id === TBILISI_3D_LAYER && states.get(map)?.status === 'fallback';
    const visibility = tilted && !failed ? 'visible' : 'none';
    if (map.getLayoutProperty(id, 'visibility') !== visibility) map.setLayoutProperty(id, 'visibility', visibility);
  }
}

export function getTbilisiMapDataStatus(map) {
  return states.get(map)?.status || 'loading';
}

/** Add current footprints, available heights, road labels and address numbers. */
export function applyTbilisiBasemap(map, colors) {
  if (!map.getSource('carto')) return;
  let state = states.get(map);
  if (!state) {
    state = { status: 'loading', originalFilters: new Map() };
    states.set(map, state);
    map.on('sourcedata', (event) => {
      if (event.sourceId !== TBILISI_SOURCE || event.sourceDataType !== 'content' || state.status !== 'loading') return;
      state.status = 'current';
      maskPreviousData(map, state, true);
      map.fire('geohub:mapdata', { status: state.status });
    });
    map.on('error', (event) => {
      if (event.sourceId !== TBILISI_SOURCE || state.status === 'fallback') return;
      // A failed regional asset must never leave holes in the working basemap.
      state.status = 'fallback';
      maskPreviousData(map, state, false);
      for (const layer of map.getStyle().layers || []) {
        if (layer.source === TBILISI_SOURCE) map.setLayoutProperty(layer.id, 'visibility', 'none');
      }
      map.fire('geohub:mapdata', { status: state.status });
    });
  }
  if (!map.getSource(TBILISI_SOURCE)) {
    // style replacement creates fresh layers; never reuse their old filter objects.
    state.originalFilters.clear();
    state.status = 'loading';
    map.addSource(TBILISI_SOURCE, {
      type: 'vector',
      tiles: [`${window.location.origin}${TBILISI_MAP_DATA.url}`],
      bounds: TBILISI_MAP_DATA.bounds,
      minzoom: TBILISI_MAP_DATA.minzoom,
      maxzoom: TBILISI_MAP_DATA.maxzoom,
      attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="/map-data/tbilisi-20261018.json">Tbilisi data 2026-10-18</a>',
    });
  }
  const before = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
  const add = (layer) => { if (!map.getLayer(layer.id)) map.addLayer({ source: TBILISI_SOURCE, ...layer }, before); };
  add({
    id: 'gh-tbilisi-buildings', type: 'fill', 'source-layer': 'buildings', minzoom: 11,
    filter: shape,
    paint: { 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 13, 0.6, 15, 0.96] },
  });
  // Unknown heights remain flat footprints. Do not invent measured dimensions.
  const height = ['max', 0, ['to-number', ['get', 'height'], 0]];
  const base = ['min', height, ['max', 0, ['to-number', ['get', 'min_height'], 0]]];
  add({
    id: TBILISI_3D_LAYER, type: 'fill-extrusion', 'source-layer': 'buildings', minzoom: 14,
    filter: ['all', shape, ['>', height, 0]],
    layout: { visibility: map.getPitch() > 1 ? 'visible' : 'none' },
    paint: {
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.2, height],
      'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.2, base],
      'fill-extrusion-opacity': 0.96,
      'fill-extrusion-vertical-gradient': true,
    },
  });
  add({
    id: 'gh-tbilisi-roadnames-major', type: 'symbol', 'source-layer': 'roads', minzoom: 12,
    filter: ['all', ['has', 'name'], ['in', ['get', 'kind'], ['literal', ['highway', 'major_road']]]],
    layout: {
      'symbol-placement': 'line', 'symbol-spacing': 350,
      'text-field': names, 'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10.5, 16, 13],
      'text-padding': 6, 'text-max-angle': 30,
    },
    paint: { 'text-halo-width': 1.5, 'text-halo-blur': 0.3 },
  });
  add({
    id: 'gh-tbilisi-roadnames-local', type: 'symbol', 'source-layer': 'roads', minzoom: 15,
    filter: ['all', ['has', 'name'], ['in', ['get', 'kind'], ['literal', ['minor_road', 'path']]]],
    layout: {
      'symbol-placement': 'line', 'symbol-spacing': 280,
      'text-field': names, 'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 15, 10.5, 18, 12],
      'text-padding': 5, 'text-max-angle': 30,
    },
    paint: { 'text-halo-width': 1.35, 'text-halo-blur': 0.3 },
  });
  add({
    id: 'gh-tbilisi-housenumbers', type: 'symbol', 'source-layer': 'buildings', minzoom: 17,
    filter: ['all', ['==', ['get', 'kind'], 'address'], ['has', 'addr_housenumber']],
    layout: {
      'text-field': ['get', 'addr_housenumber'], 'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 17, 10, 19, 12], 'text-padding': 3,
    },
    paint: { 'text-halo-width': 1.2 },
  });
  map.setPaintProperty('gh-tbilisi-buildings', 'fill-color', colors.roof);
  map.setPaintProperty('gh-tbilisi-buildings', 'fill-outline-color', colors.buildingOutline);
  map.setPaintProperty(TBILISI_3D_LAYER, 'fill-extrusion-color', colors.extrusion);
  for (const id of ['gh-tbilisi-roadnames-major', 'gh-tbilisi-roadnames-local', 'gh-tbilisi-housenumbers']) {
    map.setPaintProperty(id, 'text-color', colors.text);
    map.setPaintProperty(id, 'text-halo-color', colors.halo);
  }
  if (state.status === 'current') maskPreviousData(map, state, true);
  updateBuildingPerspective(map);
}
