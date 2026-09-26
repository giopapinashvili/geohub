import { Img } from '../../ui/misc.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { t, tn } from '../../lib/i18n.js';
import { formatDate, formatTime, formatPrice, monthShort } from '../../lib/format.js';
import { cityLabel } from '../../lib/geo.js';

export function DateBadge({ date, class: cls = '' }) {
  if (!date) return null;
  const d = new Date(date);
  return <span class={`date-badge ${cls}`}><strong>{d.getDate()}</strong><span>{monthShort(date)}</span></span>;
}

/** Event tile: cover with date badge, title, when, where and price. */
export function EventCard({ event, going, href = event.href || `/events/${event.id}` }) {
  const where = [event.venue, cityLabel(event.city)].filter(Boolean).join(' · ');
  return (
    <a href={href} class="card event-card">
      <span class="event-card-img">
        <Img src={event.image} width={560} alt="" fallback={<span class="event-card-ico"><Icon name="calendar-blank" size={40} /></span>} />
        <DateBadge date={event.date} class="event-card-date" />
      </span>
      <span class="event-card-body">
        <span class="event-card-when">{formatDate(event.date, { withYear: false, weekday: true })}{event.date ? ` · ${formatTime(event.date)}` : ''}</span>
        <strong class="event-card-title">{event.title}</strong>
        {where && <span class="muted small ellipsis"><Icon name="map-pin" size={13} /> {where}</span>}
        <span class="row gap-8 small wrap">
          <span class={`tag ${event.price ? 'tag-neutral' : 'tag-success'}`}>{event.price ? formatPrice(event.price) : t('common.free')}</span>
          {going > 0 && <span class="muted">{tn('events.going', going)}</span>}
        </span>
      </span>
    </a>
  );
}
