import { useState } from 'preact/hooks';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import { Icon } from '../../ui/Icon.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { t } from '../../lib/i18n.js';
import { useAsync } from '../../lib/hooks.js';
import { navigate } from '../../lib/router.js';
import { formatDate } from '../../lib/format.js';
import { getBusiness } from '../../data/business.js';
import { listItems } from '../../data/market.js';
import { ItemCard } from '../../pages/Marketplace.jsx';

// Everyday needs first: each tile opens the matching business or listing search.
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

async function todaysOffers() {
  const snap = await getDocs(query(collection(db, 'businessOffers'), where('status', '==', 'active'), limit(20))).catch(() => ({ docs: [] }));
  const today = new Date().toISOString().slice(0, 10);
  const offers = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((o) => !o.endsAt || o.endsAt >= today).slice(0, 10);
  const withBiz = await Promise.all(offers.map(async (o) => ({ ...o, biz: await getBusiness(o.businessId) })));
  return withBiz.filter((o) => o.biz);
}

/** Top of the home page: search, everyday categories, today's offers, new listings. */
export function Hub() {
  const [q, setQ] = useState('');
  const offers = useAsync(todaysOffers, []);
  const items = useAsync(() => listItems(40).then((l) => l.slice(0, 8)), []);
  return (
    <>
      <div class="hub-hero">
        <h1 class="hub-title">{t('hub.title')}</h1>
        <p class="hub-sub">{t('hub.sub')}</p>
        <form class="hub-search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`); }}>
          <Icon name="magnifying-glass" size={22} />
          <input type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('hub.searchPh')} aria-label={t('common.search')} enterKeyHint="search" />
          <button type="submit" class="hub-search-btn" aria-label={t('common.search')}><Icon name="arrow-right" size={20} /></button>
        </form>
        <div class="hub-tiles">
          {TILES.map((x) => (
            <a key={x.key} href={x.href} class="hub-tile" style={{ '--tone': x.tone }}>
              <span class="hub-tile-ico"><Icon name={x.icon} size={24} /></span>
              <span class="hub-tile-label">{t(`hub.tile.${x.key}`)}</span>
            </a>
          ))}
        </div>
      </div>
      {offers.data?.length > 0 && (
        <div class="hub-block">
          <div class="section-head"><h2 class="section-title"><Icon name="seal-percent" size={20} class="tone-brand" />{t('hub.offers')}</h2><a href="/business" class="link">{t('common.seeAll')}</a></div>
          <div class="hub-scroll">
            {offers.data.map((o) => (
              <a key={o.id} href={`/business/${o.businessId}`} class="offer-card">
                <span class="offer-card-top"><Avatar src={o.biz.logo} name={o.biz.name} size={32} square /><span class="ellipsis small bold">{o.biz.name}</span></span>
                <strong class="offer-card-title">{o.title}</strong>
                {o.endsAt && <span class="xs offer-card-until">{t('biz.validUntil', { date: formatDate(o.endsAt, { withYear: false }) })}</span>}
              </a>
            ))}
          </div>
        </div>
      )}
      {items.data?.length > 0 && (
        <div class="hub-block">
          <div class="section-head"><h2 class="section-title"><Icon name="tag" size={20} class="tone-brand" />{t('hub.newListings')}</h2><a href="/marketplace" class="link">{t('common.seeAll')}</a></div>
          <div class="hub-scroll hub-items">{items.data.map((i) => <ItemCard key={i.id} item={i} />)}</div>
        </div>
      )}
    </>
  );
}
