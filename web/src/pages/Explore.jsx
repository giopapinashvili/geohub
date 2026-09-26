import { useEffect, useMemo, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { SearchInput, Select } from '../ui/Field.jsx';
import { Empty, Skeleton } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle, useAsync } from '../lib/hooks.js';
import { query, setQuery, navigate } from '../lib/router.js';
import { requireLogin } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { cityOptions, cityLabel, getPosition, distanceKm } from '../lib/geo.js';
import { listPlaces } from '../data/places.js';
import { upcomingEvents } from '../data/events.js';
import { PlaceCard } from '../features/places/PlaceCard.jsx';
import { useCategories } from '../features/places/categories.js';
import { CheckinDialog } from '../features/places/CheckinDialog.jsx';
import { AddPlaceDialog } from '../features/places/AddPlaceDialog.jsx';
import { EventCard } from '../features/events/EventCard.jsx';

const PAGE = 12;

/** Discovery: places by category and city, nearby sorting, upcoming events. */
export default function Explore() {
  useTitle(t('nav.explore'));
  const cats = useCategories();
  const cat = query.value.get('cat') || 'all';
  const city = query.value.get('city') || '';
  const [q, setQ] = useState('');
  const [places, setPlaces] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const [me, setMe] = useState(null);
  const [locating, setLocating] = useState(false);
  const [checkin, setCheckin] = useState(false);
  const [adding, setAdding] = useState(false);
  const events = useAsync(() => upcomingEvents(6), []);

  useEffect(() => { listPlaces(500).then(setPlaces).catch(() => setPlaces([])); }, []);
  useEffect(() => { setShown(PAGE); }, [cat, city, me]);

  const list = useMemo(() => {
    if (!places) return [];
    const l = places.filter((p) => (cat === 'all' || p.category === cat) && (!city || cityLabel(p.city) === cityLabel(city)));
    return l.map((p) => ({ p, d: me ? distanceKm(me, p) : Infinity }))
      .sort((a, b) => (me ? a.d - b.d : (b.p.checkinCount + b.p.rating * 10) - (a.p.checkinCount + a.p.rating * 10)));
  }, [places, cat, city, me]);

  const cityChoices = useMemo(() => {
    const present = new Set((places || []).map((p) => cityLabel(p.city)).filter(Boolean));
    const known = cityOptions().filter((c) => present.has(c.label));
    const extra = [...present].filter((l) => !known.some((k) => k.label === l)).map((l) => ({ value: l, label: l }));
    return [{ value: '', label: t('explore.allCities') }, ...known, ...extra];
  }, [places]);

  const nearMe = async () => {
    if (me) { setMe(null); return; }
    setLocating(true);
    try { setMe(await getPosition()); } catch (e) { toast.error(t(e.message === 'denied' ? 'map.locationDenied' : 'map.locationFailed')); }
    setLocating(false);
  };

  return (
    <div class="page-pad explore">
      <section class="explore-hero">
        <div class="explore-hero-text">
          <h1 class="explore-title">{t('explore.title')}</h1>
          <p class="explore-sub">{t('explore.subtitle')}</p>
        </div>
        <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('explore.searchHint')} class="explore-search"
          onSubmit={(v) => { if (v.trim()) navigate(`/search?q=${encodeURIComponent(v.trim())}`); }} />
        <div class="explore-hero-actions">
          <Button variant="primary" icon="map-trifold" href="/map">{t('explore.openMap')}</Button>
          <Button variant="secondary" icon="map-pin" onClick={() => { if (requireLogin('checkin')) setCheckin(true); }}>{t('checkin.short')}</Button>
          <Button variant="secondary" icon="map-pin-plus" onClick={() => { if (requireLogin('place')) setAdding(true); }}>{t('place.add')}</Button>
        </div>
      </section>

      <div class="explore-filters">
        <div class="chip-row" role="toolbar" aria-label={t('place.category')}>
          <button type="button" class={`chip${cat === 'all' ? ' is-active' : ''}`} onClick={() => setQuery({ cat: null })}><Icon name="squares-four" size={16} />{t('common.all')}</button>
          {cats.map((c) => (
            <button key={c.id} type="button" class={`chip${cat === c.id ? ' is-active' : ''}`} onClick={() => setQuery({ cat: cat === c.id ? null : c.id })}>
              <Icon name={c.icon} size={16} style={cat === c.id ? undefined : { color: c.tone }} />{c.label}
            </button>
          ))}
        </div>
        <div class="explore-filter-row">
          <div class="explore-city"><Select label={t('place.city')} value={city} onChange={(e) => setQuery({ city: e.currentTarget.value || null })} options={cityChoices} /></div>
          <Button variant={me ? 'soft' : 'secondary'} icon="crosshair" loading={locating} onClick={nearMe}>{t(me ? 'explore.nearMeOn' : 'explore.nearMe')}</Button>
        </div>
      </div>

      <section class="explore-section">
        <h2 class="section-title">{me ? t('explore.nearest') : t('explore.popular')}</h2>
        {!places ? (
          <div class="place-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} class="card place-card"><Skeleton h="auto" style={{ aspectRatio: '4/3' }} r={0} /><div class="place-card-body"><Skeleton w="70%" h={16} /><Skeleton w="45%" h={12} /></div></div>)}</div>
        ) : list.length ? (
          <>
            <div class="place-grid">{list.slice(0, shown).map(({ p, d }) => <PlaceCard key={p.id} place={p} distance={d} />)}</div>
            {shown < list.length && <div class="center-pad"><Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>{t('common.loadMore')}</Button></div>}
          </>
        ) : <Empty icon="map-pin" title={t('place.noneFound')} text={t('explore.noneText')} action={<Button variant="secondary" icon="map-pin-plus" onClick={() => { if (requireLogin('place')) setAdding(true); }}>{t('place.add')}</Button>} />}
      </section>

      {events.data?.length > 0 && (
        <section class="explore-section">
          <div class="section-head"><h2 class="section-title">{t('events.upcoming')}</h2><a href="/events" class="link">{t('common.seeAll')}</a></div>
          <div class="h-scroll">{events.data.map((e) => <EventCard key={e.id} event={e} />)}</div>
        </section>
      )}

      {checkin && <CheckinDialog onClose={() => setCheckin(false)} onAddPlace={() => { setCheckin(false); setAdding(true); }} />}
      {adding && <AddPlaceDialog at={me} onClose={() => setAdding(false)} onCreated={(id) => navigate(`/place/${id}`)} />}
    </div>
  );
}
