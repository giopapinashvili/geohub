import { ICONS } from '../ui/icons.js';
import { MAP_BRANDS } from './mapMarkerPolicy.js';

const images = new Map();
const knownIcons = (name) => Object.hasOwn(ICONS, name) ? name : 'map-pin';
const knownTone = (tone) => /^#[a-f\d]{6}$/i.test(tone) ? tone.toLowerCase() : '#687d91';
export const markerBadgeId = (icon, tone) => `gh-badge-${knownIcons(icon)}-${knownTone(tone).slice(1)}`;

function badge(icon, tone, image, brand) {
  const canvas = document.createElement('canvas');
  canvas.width = brand?.wide ? 120 : 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const width = canvas.width;
  ctx.shadowColor = 'rgba(12, 30, 32, 0.22)';
  ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.roundRect(4, 4, width - 8, 54, brand?.wide ? 18 : 27);
  ctx.fillStyle = image ? '#ffffff' : knownTone(tone);
  ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  if (image) {
    const [sx, sy, sw, sh] = brand.crop || [0, 0, image.naturalWidth, image.naturalHeight];
    const scale = Math.min((width - 22) / sw, 40 / sh);
    ctx.drawImage(image, sx, sy, sw, sh, (width - sw * scale) / 2, (60 - sh * scale) / 2, sw * scale, sh * scale);
  } else {
    ctx.translate((width - 34) / 2, 14); ctx.scale(34 / 256, 34 / 256); ctx.fillStyle = '#ffffff';
    for (const [, path] of ICONS[knownIcons(icon)].matchAll(/<path\b[^>]*\bd="([^"]+)"/g)) ctx.fill(new Path2D(path));
  }
  return ctx.getImageData(0, 0, width, 64);
}

function brandImage(brand) {
  if (!images.has(brand.file)) {
    images.set(brand.file, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Brand artwork unavailable'));
      img.src = `/map-brands/${brand.file}`;
    }).catch(() => null));
  }
  return images.get(brand.file);
}

/** Register only the category/brand combinations present in this data batch. */
export function preparePlaceImages(map, data) {
  if (typeof document === 'undefined' || typeof Path2D === 'undefined') return;
  for (const { properties: p } of data.features || []) {
    if (!map.hasImage(p.badge)) {
      const pixels = badge(p.icon, p.tone);
      if (pixels) map.addImage(p.badge, pixels, { pixelRatio: 2 });
    }
    const brand = MAP_BRANDS[p.brand];
    if (!brand || map.hasImage(p.brandBadge)) continue;
    const placeholder = badge(p.icon, p.tone, null, brand);
    if (!placeholder) continue;
    map.addImage(p.brandBadge, placeholder, { pixelRatio: 2 });
    brandImage(brand).then((image) => {
      if (!image || !map.getStyle() || !map.hasImage(p.brandBadge)) return;
      const pixels = badge(p.icon, p.tone, image, brand);
      if (pixels) map.updateImage(p.brandBadge, pixels);
    }).catch(() => {}); // Keep the semantic category badge when an asset fails.
  }
}
