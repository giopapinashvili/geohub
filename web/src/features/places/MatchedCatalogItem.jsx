import { t } from '../../lib/i18n.js';
import { formatCommercePrice } from '../../lib/commerce.js';

export function MatchedCatalogItem({ place }) {
  if (!place.matchedItemTitle) return null;
  return <span class="map-matched-item"><strong>{place.matchedItemTitle}</strong><span>{formatCommercePrice(place.priceMinor, place.currency)}{Number.isFinite(place.preparationMinutes) && place.preparationMinutes >= 0 ? ` · ${t('map.preparationMinutes', { n: place.preparationMinutes })}` : ''}</span></span>;
}
