import { useEffect, useMemo, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Select } from '../ui/Field.jsx';
import { Card, Empty, Skeleton } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle, useAsync } from '../lib/hooks.js';
import { query, setQuery, navigate } from '../lib/router.js';
import { uid, isAdmin } from '../lib/auth.js';
import { cityOptions, cityLabel } from '../lib/geo.js';
import { listEvents, myEvents } from '../data/events.js';
import { EventCard } from '../features/events/EventCard.jsx';
import { EventEditor } from '../features/events/EventEditor.jsx';
import { EVENT_CATEGORIES, eventCategory } from '../features/events/categories.js';

function Grid({ list, loading, empty }) {
  if (loading) return <div class="place-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} class="card event-card"><Skeleton h="auto" r={0} style={{ aspectRatio: '1.9/1' }} /><div class="event-card-body"><Skeleton w="50%" h={12} /><Skeleton w="80%" h={16} /></div></div>)}</div>;
  if (!list.length) return empty;
  return <div class="place-grid">{list.map((e) => <EventCard key={e.id} event={e} />)}</div>;
}

/** Events: upcoming, mine, past — with category and city filters. */
export default function Events() {
  useTitle(t('nav.events'));
  const tab = query.value.get('tab') || 'upcoming';
  const cat = query.value.get('cat') || '';
  const city = query.value.get('city') || '';
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const mine = useAsync(() => (tab === 'mine' && uid.value ? myEvents() : Promise.resolve(null)), [tab, uid.value]);
  const load = () => listEvents().then(setData).catch(() => setData({ upcoming: [], past: [] }));
  useEffect(() => { load(); }, []);

  const source = tab === 'mine' ? mine.data : tab === 'past' ? data?.past : data?.upcoming;
  const list = useMemo(() => (source || []).filter((e) => (!cat || e.category === cat) && (!city || cityLabel(e.city) === cityLabel(city))), [source, cat, city]);
  const loading = tab === 'mine' ? mine.loading : !data;

  return (
    <div class="page-pad events-page">
      <div class="page-head">
        <div>
          <h1 class="page-title">{t('nav.events')}</h1>
          <p class="page-sub">{t('events.sub')}</p>
        </div>
        {isAdmin.value && <Button variant="primary" icon="calendar-plus" onClick={() => setEditing(true)}>{t('events.create')}</Button>}
      </div>
      <Tabs variant="pill" value={tab} onChange={(v) => setQuery({ tab: v === 'upcoming' ? null : v })} label={t('nav.events')} items={[
        { value: 'upcoming', label: t('events.tabUpcoming'), icon: 'calendar-blank' },
        { value: 'mine', label: t('events.tabMine'), icon: 'calendar-check', hidden: !uid.value },
        { value: 'past', label: t('events.tabPast'), icon: 'clock-counter-clockwise' },
      ]} />
      <div class="events-filters">
        <div class="chip-row" role="toolbar" aria-label={t('place.category')}>
          <button type="button" class={`chip${!cat ? ' is-active' : ''}`} onClick={() => setQuery({ cat: null })}>{t('common.all')}</button>
          {EVENT_CATEGORIES.map((c) => (
            <button key={c.id} type="button" class={`chip${cat === c.id ? ' is-active' : ''}`} onClick={() => setQuery({ cat: cat === c.id ? null : c.id })}>
              <Icon name={c.icon} size={16} style={cat === c.id ? undefined : { color: c.tone }} />{eventCategory(c.id).label}
            </button>
          ))}
        </div>
        <div class="explore-city"><Select label={t('place.city')} value={city} onChange={(e) => setQuery({ city: e.currentTarget.value || null })} options={[{ value: '', label: t('explore.allCities') }, ...cityOptions()]} /></div>
      </div>
      <Grid list={list} loading={loading} empty={
        <Card><Empty icon="calendar-blank" title={t(tab === 'mine' ? 'events.noMine' : tab === 'past' ? 'events.noPast' : 'events.none')} text={tab === 'upcoming' ? t('events.noneText') : ''}
          action={tab === 'mine' ? <Button variant="secondary" onClick={() => setQuery({ tab: null })}>{t('events.tabUpcoming')}</Button> : null} /></Card>
      } />
      {!isAdmin.value && (
        <Card class="events-host">
          <span class="events-host-ico"><Icon name="megaphone" size={24} /></span>
          <div class="grow"><strong>{t('events.hostTitle')}</strong><p class="small text-2">{t('events.hostText')}</p></div>
          <Button variant="secondary" href="/groups">{t('nav.groups')}</Button>
        </Card>
      )}
      {editing && <EventEditor onClose={() => setEditing(false)} onSaved={(id) => navigate(`/events/${id}`)} />}
    </div>
  );
}
