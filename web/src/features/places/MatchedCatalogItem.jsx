import { t } from '../../lib/i18n.js';
import { sourceCatalogPriceLabel } from '../../lib/sourceCatalogPresentation.js';

export function MatchedCatalogItem({ place }) {
  if (!place.matchedItemTitle) return null;
  return <span class="map-matched-item"><strong>{place.matchedItemTitle}</strong>{place.itemCategoryNames?.length > 0 && <span>{place.itemCategoryNames.join(' · ')}</span>}<span>{sourceCatalogPriceLabel(place)}{place.priceContext === 'delivery-marketplace' ? ' · Wolt-ის ფასი' : ''}{Number.isFinite(place.preparationMinutes) && place.preparationMinutes >= 0 ? ` · ${t('map.preparationMinutes', { n: place.preparationMinutes })}` : ''}</span></span>;
}
