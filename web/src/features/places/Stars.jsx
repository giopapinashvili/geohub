import { useState } from 'preact/hooks';
import { Icon } from '../../ui/Icon.jsx';
import { t } from '../../lib/i18n.js';

/** Read-only star rating (supports halves). */
export function Stars({ value = 0, size = 16, class: cls = '' }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span class={`stars ${cls}`} role="img" aria-label={t('place.ratingOf', { n: v.toFixed(1).replace('.', ',') })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name={v >= i - 0.25 ? 'star-fill' : v >= i - 0.75 ? 'star-half-fill' : 'star'} size={size} />
      ))}
    </span>
  );
}

/** Star picker for reviews. */
export function StarInput({ value, onChange, size = 32 }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div class="star-input" role="radiogroup" aria-label={t('place.yourRating')} onPointerLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={t('place.stars', { n: i })}
          class={i <= shown ? 'is-on' : ''} onPointerEnter={() => setHover(i)} onClick={() => onChange(i)}>
          <Icon name={i <= shown ? 'star-fill' : 'star'} size={size} />
        </button>
      ))}
    </div>
  );
}
