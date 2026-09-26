import { Img } from '../../ui/misc.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { tn, formatCount } from '../../lib/i18n.js';
import { cityLabel, formatDistance } from '../../lib/geo.js';
import { categoryOf } from './categories.js';

function Rating({ place }) {
  if (!place.rating) return null;
  return (
    <span class="place-rating"><Icon name="star-fill" size={14} />{place.rating.toFixed(1).replace('.', ',')}
      {place.reviewCount > 0 && <span class="muted">({formatCount(place.reviewCount)})</span>}
    </span>
  );
}

/** Place tile: photo, category, name, city, rating. `compact` = list row. */
export function PlaceCard({ place, distance, compact, active, onClick, href = `/place/${place.id}` }) {
  const cat = categoryOf(place);
  const meta = [cityLabel(place.city), Number.isFinite(distance) ? formatDistance(distance) : ''].filter(Boolean).join(' · ');
  if (compact) {
    return (
      <a href={href} class={`place-row${active ? ' is-active' : ''}`} onClick={onClick}>
        <span class="place-row-img"><Img src={place.image} width={160} alt="" fallback={<span class="place-row-ico" style={{ '--tone': cat.tone }}><Icon name={cat.icon} size={24} /></span>} /></span>
        <span class="place-row-text">
          <strong class="ellipsis">{place.name}</strong>
          <span class="muted small ellipsis">{cat.label}{meta ? ` · ${meta}` : ''}</span>
          <span class="row gap-8 small"><Rating place={place} />{place.checkinCount > 0 && <span class="muted">{tn('place.checkins', place.checkinCount)}</span>}</span>
        </span>
      </a>
    );
  }
  return (
    <a href={href} class="card place-card" onClick={onClick}>
      <span class="place-card-img">
        <Img src={place.image} width={560} alt="" fallback={<span class="place-card-ico" style={{ '--tone': cat.tone }}><Icon name={cat.icon} size={40} /></span>} />
        <span class="place-card-cat"><Icon name={cat.icon} size={14} />{cat.label}</span>
      </span>
      <span class="place-card-body">
        <strong class="place-card-name">{place.name}</strong>
        {meta && <span class="muted small ellipsis"><Icon name="map-pin" size={13} /> {meta}</span>}
        <span class="row gap-8 small wrap"><Rating place={place} />{place.checkinCount > 0 && <span class="muted">{tn('place.checkins', place.checkinCount)}</span>}</span>
      </span>
    </a>
  );
}
