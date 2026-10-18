import { applyTbilisiBasemap } from './tbilisiBasemap.js';

// Both palettes share geometry and layers, so changing mode preserves the camera.
const DEM_SOURCE = 'gh-relief';
const HILLS = 'gh-hillshade';
const CANOPY = 'gh-canopy-grain';
const PALETTES = {
  light: {
    background: '#f0f0e5', wood: '#b4d799', grass: '#d6e9bd', recreation: '#c6dfaa',
    park: '#c1dda4', garden: '#c8dfac', cemetery: '#d0e2b6', stadium: '#dce6c7', landuse: '#e8e7da',
    water: '#8cc8c7', waterway: '#75b1b5', waterEdge: '#70aaad', boundary: '#9aa98f',
    roof: '#cfd6c6', buildingShadow: '#74836c', buildingOutline: '#b1bda7', extrusion: '#d4dac8',
    rail: '#a4ad9d', path: '#a7bb8b', mainRoadCasing: '#d5cba9', roadCasing: '#d0d4c5',
    mainRoad: '#fff2d3', secondaryRoad: '#fffdf3', street: '#ffffff',
    placeText: '#3f5047', text: '#596b5d', waterText: '#346d78', parkText: '#48653b', halo: '#f4f3e9',
    hillShadow: '#718852', hillHighlight: '#fffef4', hillAccent: '#839969',
    lightColor: '#fffbed', lightIntensity: 0.4, canopyOpacity: [0.65, 0.9],
  },
  dark: {
    background: '#18232b', wood: '#294537', grass: '#2c4238', recreation: '#304a3b',
    park: '#344f3f', garden: '#30483a', cemetery: '#35473c', stadium: '#3c4d42', landuse: '#202d32',
    water: '#183e4b', waterway: '#2e6773', waterEdge: '#39727c', boundary: '#5b6f72',
    roof: '#3d4b49', buildingShadow: '#0b141b', buildingOutline: '#5a6c62', extrusion: '#52655f',
    rail: '#566469', path: '#68866b', mainRoadCasing: '#282f34', roadCasing: '#182329',
    mainRoad: '#7b786b', secondaryRoad: '#586667', street: '#45575c',
    placeText: '#dce6de', text: '#b8c8c3', waterText: '#8fc1cc', parkText: '#aed0a7', halo: '#152129',
    hillShadow: '#111e19', hillHighlight: '#53694d', hillAccent: '#20372a',
    lightColor: '#dfebe4', lightIntensity: 0.35, canopyOpacity: [0.32, 0.46],
  },
};

function addCanopyPattern(map) {
  if (map.hasImage(CANOPY)) return true;
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return false;
  // Seamless, faint cartographic grain describes forest cover, not tree positions.
  let seed = 537;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 210; i++) {
    const x = random() * 64; const y = random() * 64;
    const radius = 0.4 + random() * 1.3;
    context.fillStyle = i % 3 ? 'rgba(67, 104, 47, 0.08)' : 'rgba(255, 255, 231, 0.22)';
    for (const dx of [-64, 0, 64]) for (const dy of [-64, 0, 64]) {
      context.beginPath(); context.arc(x + dx, y + dy, radius, 0, Math.PI * 2); context.fill();
    }
  }
  map.addImage(CANOPY, context.getImageData(0, 0, 64, 64), { pixelRatio: 2 });
  return true;
}

/** Apply after style.load or a mode change. Geometry and names come from source data. */
export function applyMapAppearance(map, mode = 'light') {
  if (!map.getSource?.('carto')) return;
  const colors = PALETTES[mode] || PALETTES.light;
  const layers = map.getStyle().layers || [];
  const after = (id) => {
    const current = map.getStyle().layers;
    return current[current.findIndex((layer) => layer.id === id) + 1]?.id;
  };

  for (const layer of layers) {
    const id = layer.id;
    const source = layer['source-layer'];
    const paint = (property, value) => map.setPaintProperty(id, property, value);
    if (layer.type === 'background') paint('background-color', colors.background);
    if (layer.source !== 'carto') continue;
    if (id === 'gh-forest-texture') continue;

    if (layer.type === 'fill') {
      if (source === 'landcover') {
        paint('fill-color', ['match', ['get', 'class'],
          'wood', colors.wood, 'grass', colors.grass, 'recreation_ground', colors.recreation, colors.grass]);
        paint('fill-opacity', 1);
      } else if (source === 'park') {
        paint('fill-color', colors.park); paint('fill-opacity', 0.9);
      } else if (source === 'landuse') {
        paint('fill-color', ['match', ['get', 'class'],
          ['park', 'garden', 'recreation_ground'], colors.garden, 'cemetery', colors.cemetery,
          'stadium', colors.stadium, colors.landuse]);
        paint('fill-opacity', id === 'landuse_residential' ? 0.76 : 0.9);
      } else if (source === 'water') {
        paint('fill-color', colors.water); paint('fill-opacity', id === 'water_shadow' ? 0 : 1);
      } else if (source === 'building') {
        const roof = id === 'building-top';
        paint('fill-color', roof ? colors.roof : colors.buildingShadow);
        paint('fill-outline-color', roof ? colors.buildingOutline : 'rgba(0, 0, 0, 0)');
        paint('fill-translate', roof ? [0, 0] : [1, 1.5]);
        paint('fill-translate-anchor', 'viewport');
        paint('fill-opacity', roof
          ? ['interpolate', ['linear'], ['zoom'], 12, 0.5, 14, 0.96]
          : ['interpolate', ['linear'], ['zoom'], 12, 0.08, 14, 0.2, 17, 0.27]);
      }
    }

    if (layer.type === 'line' && source === 'waterway') {
      paint('line-color', colors.waterway); paint('line-opacity', 0.8);
    }
    if (layer.type === 'line' && source === 'boundary') {
      paint('line-color', colors.boundary); paint('line-opacity', 0.35);
    }
    if (layer.type === 'line' && source === 'transportation') {
      const casing = /case/.test(id);
      if (/rail/.test(id)) paint('line-color', colors.rail);
      else if (/path/.test(id)) paint('line-color', colors.path);
      else paint('line-color', casing ? ['match', ['get', 'class'],
        ['motorway', 'trunk', 'primary'], colors.mainRoadCasing, colors.roadCasing]
        : ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], colors.mainRoad,
          ['secondary', 'tertiary'], colors.secondaryRoad, colors.street]);
    }

    if (layer.type === 'symbol' && layer.layout?.['text-field']) {
      map.setLayoutProperty(id, 'text-font', ['Noto Sans Regular']);
      map.setLayoutProperty(id, 'text-transform', 'none');
      const water = source === 'water' || source === 'waterway';
      const park = id === 'poi_park';
      paint('text-color', water ? colors.waterText : park ? colors.parkText : source === 'place' ? colors.placeText : colors.text);
      paint('text-halo-color', colors.halo);
      paint('text-halo-width', source === 'place' ? 1.7 : 1.35);
      paint('text-halo-blur', 0.3);
      if (id === 'place_suburbs') {
        map.setLayoutProperty(id, 'text-size', ['interpolate', ['linear'], ['zoom'], 11, 12, 14, 16, 16, 18]);
        map.setLayoutProperty(id, 'text-letter-spacing', 0.035);
      }
      if (id === 'roadname_pri' || id === 'roadname_major') {
        map.setLayerZoomRange(id, 13, layer.maxzoom ?? 24);
        map.setLayoutProperty(id, 'text-size', ['interpolate', ['linear'], ['zoom'], 13, 11, 16, 13]);
        map.setLayoutProperty(id, 'symbol-spacing', 320);
      }
      if (id === 'roadname_sec') {
        map.setLayerZoomRange(id, 14, layer.maxzoom ?? 24);
        map.setLayoutProperty(id, 'text-size', ['interpolate', ['linear'], ['zoom'], 14, 10.5, 17, 12]);
        map.setLayoutProperty(id, 'symbol-spacing', 280);
      }
      if (id === 'roadname_minor') map.setLayoutProperty(id, 'text-size', 10.5);
      if (park) {
        map.setLayerZoomRange(id, 13.5, layer.maxzoom ?? 24);
        map.setLayoutProperty(id, 'text-size', ['interpolate', ['linear'], ['zoom'], 13.5, 11, 16, 13]);
      }
    }
  }

  if (map.getLayer('landcover') && !map.getLayer('gh-forest-texture') && addCanopyPattern(map)) {
    map.addLayer({
      id: 'gh-forest-texture', type: 'fill', source: 'carto', 'source-layer': 'landcover', minzoom: 12,
      filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-pattern': CANOPY },
    }, after('landcover'));
  }
  if (map.getLayer('gh-forest-texture')) map.setPaintProperty('gh-forest-texture', 'fill-opacity',
    ['interpolate', ['linear'], ['zoom'], 12, 0, 14, colors.canopyOpacity[0], 17, colors.canopyOpacity[1]]);

  // Real elevation: hillshade stays under water, streets and labels.
  if (!map.getSource(DEM_SOURCE)) map.addSource(DEM_SOURCE, {
    type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json',
    encoding: 'terrarium', tileSize: 512, maxzoom: 12,
    attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>',
  });
  if (!map.getLayer(HILLS)) map.addLayer({
    id: HILLS, type: 'hillshade', source: DEM_SOURCE, minzoom: 5, maxzoom: 17,
    paint: {
      'hillshade-method': 'standard',
      'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 5, 0.12, 12, 0.28, 15, 0.2, 17, 0.12],
      'hillshade-illumination-anchor': 'map', 'hillshade-illumination-direction': 335,
    },
  }, map.getLayer('waterway') ? 'waterway' : layers.find((layer) => layer.type === 'symbol')?.id);
  map.setPaintProperty(HILLS, 'hillshade-shadow-color', colors.hillShadow);
  map.setPaintProperty(HILLS, 'hillshade-highlight-color', colors.hillHighlight);
  map.setPaintProperty(HILLS, 'hillshade-accent-color', colors.hillAccent);

  if (map.getLayer('water') && !map.getLayer('gh-water-edge')) map.addLayer({
    id: 'gh-water-edge', type: 'line', source: 'carto', 'source-layer': 'water', minzoom: 10,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'line-opacity': 0.55,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.35, 14, 0.8, 18, 1.5] },
  }, after(map.getLayer('water_shadow') ? 'water_shadow' : 'water'));
  if (map.getLayer('gh-water-edge')) map.setPaintProperty('gh-water-edge', 'line-color', colors.waterEdge);

  // Use the building heights supplied by the basemap; keep labels above roofs.
  if (!map.getLayer('gh-buildings-3d')) {
    const height = ['max', 0, ['to-number', ['get', 'render_height'], 0]];
    const base = ['min', height, ['max', 0, ['to-number', ['get', 'render_min_height'], 0]]];
    map.addLayer({
      id: 'gh-buildings-3d', type: 'fill-extrusion', source: 'carto', 'source-layer': 'building', minzoom: 14,
      filter: ['!=', ['get', 'hide_3d'], true],
      layout: { visibility: map.getPitch() > 1 ? 'visible' : 'none' },
      paint: {
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.2, height],
        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.2, base],
        'fill-extrusion-opacity': 0.96,
        'fill-extrusion-vertical-gradient': true,
      },
    }, layers.find((layer) => layer.type === 'symbol')?.id);
  }
  map.setPaintProperty('gh-buildings-3d', 'fill-extrusion-color', colors.extrusion);
  map.setLayoutProperty('gh-buildings-3d', 'visibility', map.getPitch() > 1 ? 'visible' : 'none');
  applyTbilisiBasemap(map, colors);
  map.setLight({ anchor: 'viewport', color: colors.lightColor, intensity: colors.lightIntensity, position: [1.5, 210, 40] });
}
