import { useState } from 'preact/hooks';
import { placeBrand } from '../../lib/placeBrands.js';
import '../../styles/place-brand.css';

/** The same reviewed artwork is used on the map, result rows and place headers. */
export function PlaceBrand({ place, size = 'badge', class: cls = '', fallback = null }) {
  const brand = placeBrand(place);
  const [failed, setFailed] = useState('');
  if (!brand || failed === brand.src) return fallback;
  return <span class={`place-brand place-brand--${size}${brand.wide ? ' is-wide' : ''} ${cls}`} data-brand={brand.id} style={{ '--brand-logo-bg': brand.background }} title={brand.name}>
    <img src={brand.src} alt={`${brand.name} — ლოგო`} loading="lazy" decoding="async" onError={() => setFailed(brand.src)} />
  </span>;
}
