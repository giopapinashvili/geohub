import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Menu } from '../ui/Menu.jsx';
import { Confirm } from '../ui/Modal.jsx';
import { Card, Empty, Img, PageSpinner } from '../ui/misc.jsx';
import { t, tn } from '../lib/i18n.js';
import { useTitle, useLive, useAsync } from '../lib/hooks.js';
import { formatDate, formatTime, formatPrice } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { uid, isAdmin } from '../lib/auth.js';
import { requireLogin } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { cityLabel } from '../lib/geo.js';
import { listenEvent, myRsvp, setRsvp, eventAttendees, deleteEvent } from '../data/events.js';
import { DateBadge } from '../features/events/EventCard.jsx';
import { EventEditor } from '../features/events/EventEditor.jsx';
import { eventCategory } from '../features/events/categories.js';
import { copyLink } from '../features/post/ShareDialog.jsx';

function icsHref(e) {
  const f = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GeoHub//KA', 'BEGIN:VEVENT', `UID:${e.id}@geohub`, `DTSTART:${f(e.date)}`, `DTEND:${f(e.endDate || e.date + 2 * 3600000)}`,
    `SUMMARY:${e.title}`, `LOCATION:${[e.venue, e.city].filter(Boolean).join(', ')}`, `URL:${location.origin}/events/${e.id}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
}

/** Event page: RSVP (going / interested), calendar, map, attendees. */
export default function EventPage({ params }) {
  const { data: ev, loading } = useLive((ok, err) => listenEvent(params.id, ok, err), [params.id]);
  const people = useAsync(() => eventAttendees(params.id), [params.id]);
  const [rsvp, setRsvpState] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  useTitle(ev?.title || t('nav.events'));
  useEffect(() => { if (uid.value) myRsvp(params.id).then(setRsvpState); }, [params.id, uid.value]);
  if (loading) return <PageSpinner />;
  if (!ev || ev.status !== 'active') return <Card><Empty icon="calendar-blank" title={t('events.notFound')} action={<Button variant="primary" href="/events">{t('nav.events')}</Button>} /></Card>;

  const cat = eventCategory(ev.category);
  const past = (ev.endDate || ev.date) < Date.now() - 3 * 3600000;
  const going = people.data?.going || [];
  const choose = async (status) => {
    if (!requireLogin('rsvp')) return;
    const next = rsvp === status ? null : status;
    const prev = rsvp;
    setRsvpState(next);
    try { await setRsvp(ev, next); people.reload(); if (next) toast.success(t(next === 'going' ? 'events.goingToast' : 'events.interestedToast')); }
    catch { setRsvpState(prev); toast.error(t('common.error')); }
  };
  const where = [ev.venue, cityLabel(ev.city)].filter(Boolean).join(', ');
  const map = ev.lat ? `https://www.google.com/maps/search/?api=1&query=${ev.lat},${ev.lng}` : where && `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`;

  return (
    <div class="place-page">
      <Card class="place-hero" pad={false}>
        <div class="event-cover">{ev.image ? <Img src={ev.image} width={1400} alt="" eager /> : <span class="place-gallery-empty" style={{ '--tone': cat.tone }}><Icon name={cat.icon} size={56} /></span>}</div>
        <div class="place-head">
          <div class="row gap-12">
            <DateBadge date={ev.date} />
            <span class="place-cat-chip" style={{ '--tone': cat.tone }}><Icon name={cat.icon} size={14} />{cat.label}</span>
            {past && <span class="tag tag-neutral">{t('events.ended')}</span>}
          </div>
          <h1 class="place-name">{ev.title}</h1>
          <ul class="event-facts">
            <li><Icon name="clock" size={18} />{formatDate(ev.date, { weekday: true })} · {formatTime(ev.date)}{ev.endDate ? ` – ${formatTime(ev.endDate)}` : ''}</li>
            {where && <li><Icon name="map-pin" size={18} />{map ? <a href={map} target="_blank" rel="noopener" class="link">{where}</a> : where}</li>}
            <li><Icon name="ticket" size={18} />{ev.price ? `${formatPrice(ev.price)} · ${t('events.ticketsAtVenue')}` : t('events.freeEntry')}</li>
            {going.length > 0 && <li><Icon name="users" size={18} />{tn('events.going', going.length)}{ev.capacity ? ` / ${ev.capacity}` : ''}</li>}
          </ul>
          <div class="place-actions">
            {!past && <Button variant={rsvp === 'going' ? 'primary' : 'secondary'} icon={rsvp === 'going' ? 'check-circle-fill' : 'calendar-check'} onClick={() => choose('going')}>{t('events.imGoing')}</Button>}
            {!past && <Button variant={rsvp === 'interested' ? 'soft' : 'secondary'} icon="star" onClick={() => choose('interested')}>{t('events.interested')}</Button>}
            {!past && <Button variant="secondary" icon="calendar-plus" href={icsHref(ev)} download={`${ev.title}.ics`} data-native>{t('events.addCalendar')}</Button>}
            <Menu label={t('common.more')} width={220} items={[
              { icon: 'share-fat', label: t('common.copyLink'), onClick: () => copyLink(`${location.origin}/events/${ev.id}`) },
              { icon: 'pencil-simple', label: t('common.edit'), hidden: !isAdmin.value, onClick: () => setEditing(true) },
              { icon: 'trash', label: t('common.delete'), danger: true, hidden: !isAdmin.value, onClick: () => setConfirmDel(true) },
            ]} trigger={(p) => <IconButton {...p} icon="dots-three" label={t('common.more')} variant="soft" size={40} />} />
          </div>
        </div>
      </Card>
      <div class="place-body">
        <Card><h2 class="card-title">{t('events.about')}</h2><p class="place-desc">{ev.description || t('place.noDescription')}</p></Card>
        {going.length > 0 && (
          <Card>
            <h2 class="card-title">{tn('events.going', going.length)}</h2>
            <div class="attendees">{going.slice(0, 40).map((p) => <Avatar key={p.id} src={p.photoURL} name={p.displayName || ''} size={40} href={`/u/${p.userId || p.uid}`} />)}</div>
          </Card>
        )}
      </div>
      {editing && <EventEditor event={ev} onClose={() => setEditing(false)} />}
      <Confirm open={confirmDel} danger title={t('events.deleteTitle')} confirmLabel={t('common.delete')} onClose={() => setConfirmDel(false)}
        onConfirm={() => deleteEvent(ev.id).then(() => { toast(t('events.deleted')); navigate('/events'); }).catch(() => toast.error(t('common.error')))} />
    </div>
  );
}
