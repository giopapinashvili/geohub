import { useMemo, useState } from 'preact/hooks';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import { cachedList } from '../../data/cache.js';
import { Icon } from '../../ui/Icon.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { t } from '../../lib/i18n.js';
import { useAsync } from '../../lib/hooks.js';
import { navigate } from '../../lib/router.js';
import { formatDate } from '../../lib/format.js';
import { CITIES, cityLabel } from '../../lib/geo.js';
import { profile } from '../../lib/auth.js';
import { requireLogin } from '../../lib/store.js';
import { listBusinesses } from '../../data/business.js';
import { listItems } from '../../data/market.js';
import { upcomingEvents } from '../../data/events.js';
import { listNeeds, needOf } from '../../data/needs.js';
import { ItemCard } from '../../pages/Marketplace.jsx';
import { EventCard } from '../events/EventCard.jsx';
import { NeedCard } from '../needs/NeedCard.jsx';
import { NeedDialog } from '../needs/NeedDialog.jsx';
import { openState } from '../business/hours.js';
import { bizCategoryLabel } from '../business/categories.js';

const TILES = [
  { key: 'food', icon: 'fork-knife', tone: '#f97316', href: '/business?group=food' },
  { key: 'beauty', icon: 'sparkle', tone: '#ec4899', href: '/business?group=beauty' },
  { key: 'auto', icon: 'car', tone: '#2563eb', href: '/business?group=auto' },
  { key: 'jobs', icon: 'briefcase', tone: '#0891b2', href: '/marketplace?cat=job' },
  { key: 'property', icon: 'house-line', tone: '#16a34a', href: '/marketplace?cat=property' },
  { key: 'items', icon: 'package', tone: '#7c3aed', href: '/marketplace?cat=item' },
  { key: 'services', icon: 'wrench', tone: '#ca8a04', href: '/marketplace?cat=service' },
  { key: 'travel', icon: 'mountains', tone: '#0d9488', href: '/business?group=travel' },
  { key: 'health', icon: 'first-aid-kit', tone: '#dc2626', href: '/business?group=health' },
  { key: 'fun', icon: 'confetti', tone: '#9333ea', href: '/business?group=fun' },
  { key: 'events', icon: 'calendar-blank', tone: '#db2777', href: '/events' },
  { key: 'map', icon: 'map-trifold', tone: '#059669', href: '/map' },
];
const CITY_KEY = 'gh_city';
const inCity = (c, city) => !city || cityLabel(c) === cityLabel(city);

function initialCity() {
  try { const v = localStorage.getItem(CITY_KEY); if (v !== null) return v; } catch { /* ignore */ }
  return profile.value?.city || 'თბილისი';
}

function loadOffers() {
  return cachedList('offers', 15, 10 * 60000, async (k) => {
    const snap = await getDocs(query(collection(db, 'businessOffers'), where('status', '==', 'active'), limit(k))).catch(() => ({ docs: [] }));
    const today = new Date().toISOString().slice(0, 10);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((o) => !o.endsAt || o.endsAt >= today);
  });
}

function Section({ icon, title, href, linkLabel, children }) {
  return (
    <section class="hub-block">
      <div class="section-head"><h2 class="section-title"><Icon name={icon} size={20} class="tone-brand" />{title}</h2>{href && <a href={href} class="link">{linkLabel || t('common.seeAll')}</a>}</div>
      {children}
    </section>
  );
}

export function initialHubCity() { return initialCity(); }
export function saveHubCity(c) { try { localStorage.setItem(CITY_KEY, c); } catch { /* ignore */ } }

/** Compact top of the home feed: live city switch, search, request button, services row. */
export function HubTop({ city, setCity }) {
  const [q, setQ] = useState('');
  const [need, setNeed] = useState(false);
  return (
    <div class="hub-top">
      <div class="hub-city">
        <span class="hub-live"><span class="hub-live-dot" />{t('hub.now')}</span>
        <div class="hub-city-chips">
          {CITIES.slice(0, 8).map((c) => <button key={c.ka} type="button" class={`hub-city-chip${cityLabel(city) === cityLabel(c.ka) ? ' is-active' : ''}`} onClick={() => setCity(c.ka)}>{cityLabel(c.ka)}</button>)}
          <button type="button" class={`hub-city-chip${!city ? ' is-active' : ''}`} onClick={() => setCity('')}>{t('hub.allGeorgia')}</button>
        </div>
      </div>
      <div class="hub-search-row">
        <form class="hub-search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`); }}>
          <Icon name="magnifying-glass" size={20} />
          <input type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('hub.searchPh')} aria-label={t('common.search')} enterKeyHint="search" />
        </form>
        <button type="button" class="hub-need-btn" onClick={() => { if (requireLogin('need')) setNeed(true); }}><Icon name="megaphone" size={18} />{t('nav.needs')}</button>
      </div>
      <div class="hub-tiles">
        {TILES.map((x) => (
          <a key={x.key} href={x.href} class="hub-tile" style={{ '--tone': x.tone }}>
            <span class="hub-tile-ico"><Icon name={x.icon} size={22} /></span>
            <span class="hub-tile-label">{t(`hub.tile.${x.key}`)}</span>
          </a>
        ))}
      </div>
      {need && <NeedDialog onClose={() => setNeed(false)} onCreated={(id) => navigate(`/post/${id}`)} />}
    </div>
  );
}

/** City sections (open now, offers, events, requests, listings) to place between posts. */
export function useHubModules(city) {
  const bizAll = useAsync(() => listBusinesses(), []);
  const offersAll = useAsync(loadOffers, []);
  const itemsAll = useAsync(() => listItems(30), []);
  const eventsAll = useAsync(() => upcomingEvents(12), []);
  const needsAll = useAsync(() => listNeeds(30), []);
  return useMemo(() => {
    const cityName = city ? cityLabel(city) : t('hub.allGeorgia');
    const biz = (bizAll.data || []).filter((b) => inCity(b.city, city));
    const open = biz.map((b) => ({ b, s: openState(b.workingHours) })).filter((x) => x.s?.open).slice(0, 12);
    const bizRow = open.length ? open : [...biz].sort((a, b) => b.followerCount - a.followerCount).slice(0, 12).map((b) => ({ b, s: openState(b.workingHours) }));
    const byId = Object.fromEntries((bizAll.data || []).map((b) => [b.id, b]));
    const offers = (offersAll.data || []).map((o) => ({ ...o, biz: byId[o.businessId] })).filter((o) => o.biz && inCity(o.biz.city, city)).slice(0, 10);
    const week = Date.now() + 7 * 86400000;
    const events = (eventsAll.data || []).filter((e) => inCity(e.city, city) && e.date <= week);
    const needs = (needsAll.data || []).filter((p) => inCity(needOf(p).city, city)).slice(0, 4);
    const itemsCity = (itemsAll.data || []).filter((i) => inCity(i.city, city));
    const items = (itemsCity.length ? itemsCity : itemsAll.data || []).slice(0, 10);
    const mods = [];
    if (bizRow.length) mods.push(
      <Section key="biz" icon={open.length ? 'storefront' : 'fire'} title={open.length ? t('hub.openNow', { city: cityName }) : t('hub.popularBiz', { city: cityName })} href="/business">
        <div class="hub-scroll">
          {bizRow.map(({ b, s }) => (
            <a key={b.id} href={`/business/${b.id}`} class="open-card">
              <Avatar src={b.logo} name={b.name} size={44} square />
              <span class="open-card-text">
                <strong class="ellipsis">{b.name}</strong>
                <span class="muted xs ellipsis">{bizCategoryLabel(b.category)}</span>
                {s && <span class={`open-card-state${s.open ? ' is-open' : ''}`}>{s.open ? (s.until ? t('hub.openUntil', { time: s.until }) : t('biz.openNow')) : t('biz.closedNow')}</span>}
              </span>
            </a>
          ))}
        </div>
      </Section>);
    if (needs.length) mods.push(
      <Section key="needs" icon="megaphone" title={t('hub.needs', { city: cityName })} href="/needs" linkLabel={t('hub.allNeeds')}>
        <div class="hub-scroll hub-needs-row">{needs.map((p) => <NeedCard key={p.id} post={p} compact />)}</div>
      </Section>);
    if (offers.length) mods.push(
      <Section key="offers" icon="seal-percent" title={t('hub.offers')} href="/business">
        <div class="hub-scroll">
          {offers.map((o) => (
            <a key={o.id} href={`/business/${o.businessId}`} class="offer-card">
              <span class="offer-card-top"><Avatar src={o.biz.logo} name={o.biz.name} size={32} square /><span class="ellipsis small bold">{o.biz.name}</span></span>
              <strong class="offer-card-title">{o.title}</strong>
              {o.endsAt && <span class="xs offer-card-until">{t('biz.validUntil', { date: formatDate(o.endsAt, { withYear: false }) })}</span>}
            </a>
          ))}
        </div>
      </Section>);
    if (items.length) mods.push(
      <Section key="items" icon="tag" title={t('hub.newListings')} href="/marketplace">
        <div class="hub-scroll hub-items">{items.map((i) => <ItemCard key={i.id} item={i} />)}</div>
      </Section>);
    if (events.length) mods.push(
      <Section key="events" icon="calendar-blank" title={t('hub.thisWeek')} href="/events">
        <div class="h-scroll">{events.map((e) => <EventCard key={e.id} event={e} />)}</div>
      </Section>);
    return mods;
  }, [bizAll.data, offersAll.data, itemsAll.data, eventsAll.data, needsAll.data, city]);
}
