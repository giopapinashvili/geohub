/** WGS84 coordinates, always latitude first in forms and copied text. */
function coordinateNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isFinite(number) ? number : null;
}

export const isEmptyCoordinate = (value) => value == null || (typeof value === 'string' && !value.trim());

/** Return a valid pair or null; never infer, swap axes or use a city centre. */
export function readCoordinates(value) {
  const lat = coordinateNumber(value?.lat);
  const lng = coordinateNumber(value?.lng);
  return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Web Mercator cannot display the poles, even though they are valid WGS84. */
export function isMapCoordinate(value) {
  const coords = readCoordinates(value);
  return !!coords && Math.abs(coords.lat) <= 85.051129;
}

export function formatCoordinates(value, precision = 6) {
  const coords = readCoordinates(value);
  return coords ? `${coords.lat.toFixed(precision)}, ${coords.lng.toFixed(precision)}` : '';
}

/** Optional coordinates must be either two valid values or two empty fields. */
export function coordinatesForWrite(value) {
  if (isEmptyCoordinate(value?.lat) && isEmptyCoordinate(value?.lng)) return { lat: null, lng: null };
  const coords = readCoordinates(value);
  if (!coords) throw Object.assign(new Error('Invalid latitude/longitude pair'), { code: 'invalid-coordinates' });
  return coords;
}
