import { useEffect, useMemo, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { SearchInput, Select } from '../ui/Field.jsx';
import { Card, Empty, Img, Skeleton } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle, useAsync } from '../lib/hooks.js';
import { formatPrice, timeAgo } from '../lib/format.js';
import { query, setQuery } from '../lib/router.js';
import { uid } from '../lib/auth.js';
import { cityOptions, cityLabel } from '../lib/geo.js';
import { listItems, myItems, MARKET_CATS } from '../data/market.js';

export function ItemCard({ item }) {
  return (
    <a href={`/marketplace/${item.id}`} class="card item-card">
      <span class="item-card-img">
        <Img src={item.images[0]} width={480} alt="" fallback={<span class="biz-card-cover-fallback"><Icon name={MARKET_CATS.find((c) => c.id === item.category)?.icon || 'tag'} size={40} /></span>} />
        {item.status === 'sold' && <span class="item-sold">{t('market.sold')}</span>}
      </span>
      <span class="item-card-body">
        <strong class="item-price">{item.price ? formatPrice(item.price, item.currency) : t(item.category === 'job' ? 'market.negotiable' : 'common.free')}{item.category === 'job' && item.price ? <span class="muted small"> / {t('market.month')}</span> : null}</strong>
        <span class="item-title">{item.title}</span>
        <span class="muted xs">{[cityLabel(item.city), timeAgo(item.createdAt)].filter(Boolean).join(' · ')}</span>
      </span>
    </a>
  );
}

/** Marketplace: listings by category, city and search; your listings. */
export default function Marketplace() {
  useTitle(t('nav.marketplace'));
  const cat = query.value.get('cat') || '';
  const tab = query.value.get('tab') || 'all';
  const [city, setCity] = useState('');
  const [q, setQ] = useState('');
  const [all, setAll] = useState(null);
  const mine = useAsync(() => (tab === 'mine' && uid.value ? myItems() : Promise.resolve(null)), [tab, uid.value]);
  useEffect(() => { listItems().then(setAll).catch(() => setAll([])); }, []);
  const list = useMemo(() => {
    const src = tab === 'mine' ? mine.data || [] : all || [];
    const n = q.trim().toLowerCase();
    return src.filter((i) => (!cat || i.category === cat) && (!city || cityLabel(i.city) === cityLabel(city)) && (!n || `${i.title} ${i.description}`.toLowerCase().includes(n)));
  }, [all, mine.data, tab, cat, city, q]);
  const loading = tab === 'mine' ? mine.loading : !all;
  return (
    <div class="page-pad biz-hub">
      <div class="page-head">
        <div><h1 class="page-title">{t('nav.marketplace')}</h1><p class="page-sub">{t('market.sub')}</p></div>
        <Button variant="primary" icon="plus" href="/marketplace/new">{t('market.new')}</Button>
      </div>
      <Tabs variant="pill" value={tab} onChange={(v) => setQuery({ tab: v === 'all' ? null : v })} label={t('nav.marketplace')} items={[
        { value: 'all', label: t('market.browse'), icon: 'storefront' },
        { value: 'mine', label: t('market.mine'), icon: 'tag', hidden: !uid.value },
      ]} />
      <div class="biz-filters">
        <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('market.search')} />
        <div class="biz-city"><Select label={t('place.city')} value={city} onChange={(e) => setCity(e.currentTarget.value)} options={[{ value: '', label: t('explore.allCities') }, ...cityOptions()]} /></div>
      </div>
      <div class="chip-row">
        <button type="button" class={`chip${!cat ? ' is-active' : ''}`} onClick={() => setQuery({ cat: null })}>{t('common.all')}</button>
        {MARKET_CATS.map((c) => <button key={c.id} type="button" class={`chip${cat === c.id ? ' is-active' : ''}`} onClick={() => setQuery({ cat: cat === c.id ? null : c.id })}><Icon name={c.icon} size={16} />{t(`market.cat.${c.id}`)}</button>)}
      </div>
      {loading ? <div class="item-grid"><Skeleton h={240} /><Skeleton h={240} /><Skeleton h={240} /></div>
        : list.length ? <div class="item-grid">{list.map((i) => <ItemCard key={i.id} item={i} />)}</div>
        : <Card><Empty icon="storefront" title={t('market.none')} text={t('market.noneText')} action={<Button variant="primary" icon="plus" href="/marketplace/new">{t('market.new')}</Button>} /></Card>}
    </div>
  );
}
