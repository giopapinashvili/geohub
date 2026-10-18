import { Button, IconButton } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Img } from '../../ui/misc.jsx';
import { t, formatCount } from '../../lib/i18n.js';
import { cityLabel } from '../../lib/geo.js';
import { readCoordinates } from '../../lib/coordinates.js';
import { categoryOf } from './categories.js';
import { PlaceCoordinates } from './PlaceCoordinates.jsx';
import { placePageHref } from '../../lib/placeLinks.js';
import { MatchedCatalogItem } from './MatchedCatalogItem.jsx';
import '../../styles/map-preview.css';

/** A selected map pin opens this preview; expanding it keeps the map mounted. */
export function MapPlacePreview({ place, onExpand, onClose, onCheckin }) {
  const cat = categoryOf(place);
  const rating = Number(place.rating);
  const description = String(place.description || '').trim().replace(/\s+/g, ' ');
  const coords = readCoordinates(place);
  const pageHref = placePageHref(place);

  return (
    <section class="map-place-preview" aria-label={place.name}>
      <button type="button" data-testid="map-place-expand" class="map-place-preview-main" onClick={onExpand} aria-label={`${place.name} — ${t('map.details')}`}>
        <span class="map-place-preview-image">
          <Img
            key={`${place.id}-${place.image || ''}`}
            src={place.image}
            width={240}
            eager
            alt=""
            fallback={<span class="map-place-preview-fallback" style={{ '--tone': cat.tone }}><Icon name={cat.icon} size={34} /></span>}
          />
        </span>
        <span class="map-place-preview-text">
          <strong class="map-place-preview-name">{place.name}</strong>
          <span class="map-place-preview-meta">{[cat.label, cityLabel(place.city)].filter(Boolean).join(' · ')}</span>
          {Number.isFinite(rating) && rating > 0 && rating <= 5 && (
            <span class="map-place-preview-rating">
              <Icon name="star-fill" size={14} />
              <strong>{rating.toFixed(1).replace('.', ',')}</strong>
              {place.reviewCount > 0 && <span>({formatCount(place.reviewCount)})</span>}
            </span>
          )}
          <span class={`map-place-preview-description${description ? '' : ' is-empty'}`}>{description || t('map.shortDescriptionFallback')}</span>
          <MatchedCatalogItem place={place} />
        </span>
      </button>

      {place.address && <p class="map-place-preview-address"><Icon name="map-pin" size={14} /><span>{place.address}</span></p>}
      <PlaceCoordinates key={place.id} place={place} compact />

      <div class="map-place-preview-actions">
        <Button variant="primary" size="sm" iconRight="caret-up" class="map-place-preview-expand" onClick={onExpand}>{t('map.details')}</Button>
        {onCheckin && <IconButton icon="map-pin" label={t('checkin.short')} size={44} variant="soft" onClick={onCheckin} />}
        {coords && <IconButton icon="navigation-arrow" label={t('place.directions')} size={44} variant="soft" href={`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`} target="_blank" rel="noopener noreferrer" />}
        <a data-testid="map-place-page" class="map-place-preview-page" href={pageHref} target="_blank" rel="noopener noreferrer">{t('map.openPage')}<Icon name="arrow-up-right" size={14} /></a>
      </div>

      <IconButton icon="x" label={t('common.close')} size={40} class="map-place-preview-close" onClick={onClose} />
    </section>
  );
}
