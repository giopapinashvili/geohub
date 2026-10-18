import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { TextField, Select, SearchInput } from '../ui/Field.jsx';
import { Card, Empty, Spinner } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { listDiscounts } from '../data/commerce.js';
import { commerceOfferState, priceToMinor } from '../lib/commerce.js';
import { matchesDiscountFilters } from '../lib/discountWatchlist.js';
import { OfferCard, ITEM_ICONS } from '../features/commerce/OfferCard.jsx';
import { DEMO_ENABLED, DEMO_OFFERS } from '../features/commerce/demo.js';
import { DiscountWatchlist } from '../features/commerce/DiscountWatchlist.jsx';
import { query, setQuery } from '../lib/router.js';
import '../styles/commerce.css';

export default function Discounts() {
  useTitle(t('nav.discounts'));
  const [type, setType] = useState('');
  const mode = DEMO_ENABLED && query.value.get('mode') === 'demo' ? 'demo' : 'real';
  const setMode = value => setQuery({ mode: value === 'demo' ? 'demo' : null });
  const [q, setQ] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('new');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now);
  const epoch = useRef(0);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
  useEffect(() => {
    const id = ++epoch.current;
    setItems([]); setCursor(null); setError(false); setMore(false);
    if (mode === 'demo') { setBusy(false); return undefined; }
    setBusy(true);
    listDiscounts({ type }).then((r) => {
      if (epoch.current !== id) return;
      setItems(r.items); setCursor(r.cursor); setMore(r.hasMore);
    }).catch(() => { if (epoch.current === id) setError(true); })
      .finally(() => { if (epoch.current === id) setBusy(false); });
    return () => { if (epoch.current === id) epoch.current++; };
  }, [type, mode, refresh]);
  const loadMore = async () => {
    if (busy || !more) return;
    const id = epoch.current;
    setBusy(true); setError(false);
    try {
      const r = await listDiscounts({ type, cursor });
      if (id !== epoch.current) return;
      setItems((prev) => [...new Map([...prev, ...r.items].map((o) => [o.id, o])).values()]);
      setCursor(r.cursor); setMore(r.hasMore);
    } catch { if (id === epoch.current) setError(true); }
    finally { if (id === epoch.current) setBusy(false); }
  };
  const visible = useMemo(() => {
    let maxPriceMinor;
    try { maxPriceMinor = priceToMinor(maxPrice); } catch { maxPriceMinor = NaN; }
    const rows = (mode === 'demo' ? DEMO_OFFERS : items).filter((o) =>
      (o.isDemo || commerceOfferState(o, now) === 'active') && matchesDiscountFilters(o, { term: q, type, maxPriceMinor }));
    if (sort === 'price') rows.sort((a, b) => a.currency.localeCompare(b.currency) || a.priceMinor - b.priceMinor);
    if (sort === 'discount') rows.sort((a, b) => (b.originalPriceMinor - b.priceMinor) / b.originalPriceMinor - (a.originalPriceMinor - a.priceMinor) / a.originalPriceMinor);
    return rows;
  }, [mode, items, q, type, maxPrice, sort, now]);
  return <div class="page-pad deals-page">
    <header class="deals-hero">
      <div><span class="deals-eyebrow"><Icon name="seal-percent" size={18} /> GEOHUB</span><h1>{t('deals.heading')}</h1><p>{t('deals.subtitle')}</p></div>
      <a href="/business" class="deals-owner-link">{t('deals.forBusiness')}<Icon name="arrow-up-right" size={18} /></a>
    </header>
    <div class="deals-mode" role="group" aria-label={t('deals.mode')}>
      <button type="button" class={`chip${mode === 'real' ? ' is-active' : ''}`} aria-pressed={mode === 'real'} onClick={() => setMode('real')}>{t('deals.real')}</button>
      {DEMO_ENABLED && <button type="button" class={`chip${mode === 'demo' ? ' is-active' : ''}`} aria-pressed={mode === 'demo'} onClick={() => setMode('demo')}>{t('deals.demo')}</button>}
    </div>
    <section class="deals-filters" aria-label={t('deals.filters')}>
      <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('deals.search')} />
      <div class="deals-filter-fields"><TextField label={t('deals.maxPrice')} type="number" min="0" step="0.01" inputMode="decimal" value={maxPrice} onInput={(e) => setMaxPrice(e.currentTarget.value)} placeholder="₾" />
        <Select label={t('deals.sort')} value={sort} onChange={(e) => setSort(e.currentTarget.value)} options={['new', 'price', 'discount'].map((value) => ({ value, label: t(`deals.sort.${value}`) }))} />
      </div>
      <div class="chip-row" role="group" aria-label={t('commerce.type')}>
        {['', 'product', 'dish', 'service', 'bundle'].map((v) => <button key={v} type="button" class={`chip${v === type ? ' is-active' : ''}`} aria-pressed={v === type} onClick={() => setType(v)}>{v && <Icon name={ITEM_ICONS[v]} size={17} />}{v ? t(`commerce.type.${v}`) : t('common.all')}</button>)}
      </div>
    </section>
    {mode === 'real' && <DiscountWatchlist query={{ term: q, type, maxPrice }} offers={items} now={now} onSelect={entry => { setQ(entry.term); setType(entry.type); setMaxPrice(entry.maxPriceMinor === null ? '' : String(entry.maxPriceMinor / 100)); setMode('real'); }} />}
    {mode === 'demo' && <p class="deals-notice"><Icon name="info" size={20} />{t('deals.demoNotice')}</p>}
    {mode === 'real' && more && <p class="small muted">{t('deals.loadedScope', { n: items.length })}</p>}
    <p class="small muted" role="status" aria-live="polite">{t('deals.results', { n: visible.length })}</p>
    {visible.length > 0 && <div class="deals-grid">{visible.map((o) => <OfferCard key={o.id} offer={o} />)}</div>}
    {error && <Card><Empty icon="warning" title={t('deals.loadError')} action={<Button onClick={() => cursor ? loadMore() : setRefresh((n) => n + 1)}>{t('common.reload')}</Button>} /></Card>}
    {!busy && !error && !visible.length && <Card><Empty icon="seal-percent" title={t(q || type || maxPrice ? 'deals.noMatch' : 'deals.noOffers')} text={t('deals.noOffersText')} action={DEMO_ENABLED && mode === 'real' ? <Button variant="primary" onClick={() => setMode('demo')}>{t('deals.demo')}</Button> : <Button onClick={() => { setQ(''); setType(''); setMaxPrice(''); }}>{t('deals.reset')}</Button>} /></Card>}
    {busy && <div class="center-pad"><Spinner size={28} /></div>}
    {more && mode === 'real' && <div class="center-pad"><Button loading={busy} onClick={loadMore}>{t('common.loadMore')}</Button></div>}
  </div>;
}
