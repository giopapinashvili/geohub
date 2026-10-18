import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { SearchInput, Select } from '../../ui/Field.jsx';
import { Card, Empty, Img, Spinner } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { listBusinessCatalog, listBusinessBranches, getCommerceItem } from '../../data/commerce.js';
import { query as routeQuery } from '../../lib/router.js';
import { formatCommercePrice, DIETARY_TAGS, DEMO_OFFER_LABEL } from '../../lib/commerce.js';
import { ITEM_ICONS } from './OfferCard.jsx';
import '../../styles/commerce.css';

export function BusinessCatalog({ biz, menu = false, branchId, itemId }) {
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');
  const [diet, setDiet] = useState('');
  const [prep, setPrep] = useState('');
  const [refresh, setRefresh] = useState(0);
  const requestedBranch = branchId ?? routeQuery.value.get('branch') ?? '';
  const selectedBranch = /^[A-Za-z0-9_-]{1,150}$/.test(requestedBranch) ? requestedBranch : '';
  const requestedItem = itemId || routeQuery.value.get('item') || '';
  const focusItem = /^[A-Za-z0-9_-]{1,150}$/.test(requestedItem) ? requestedItem : '';
  const epoch = useRef(0);
  useEffect(() => {
    const request = ++epoch.current;
    setBusy(true); setError(false); setItems([]); setCursor(null); setMore(false); setBranches([]);
    const focused = focusItem ? getCommerceItem(focusItem).catch((error) => { if (error.code === 'permission-denied') return null; throw error; }) : null;
    Promise.all([listBusinessCatalog(biz.id, { type: menu ? 'dish' : '' }), listBusinessBranches(biz.id), focused]).then(([r, b, target]) => {
      const belongs = target?.businessId === biz.id && target.status === 'published' && (!menu || target.type === 'dish')
        && (!selectedBranch || (b.some((branch) => branch.id === selectedBranch) && (target.allBranches || target.branchIds?.includes(selectedBranch))));
      const loaded = belongs && !r.items.some((item) => item.id === target.id) ? [target, ...r.items] : r.items;
      if (request === epoch.current) { setItems(loaded); setCursor(r.cursor); setMore(r.hasMore); setBranches(b); }
    }).catch(() => { if (request === epoch.current) setError(true); }).finally(() => { if (request === epoch.current) setBusy(false); });
    return () => { if (request === epoch.current) epoch.current++; };
  }, [biz.id, menu, refresh, focusItem, selectedBranch]);
  useEffect(() => { setQ(''); setDiet(''); setPrep(''); }, [biz.id, menu, selectedBranch]);
  useEffect(() => {
    if (!focusItem || !items.some((item) => item.id === focusItem)) return undefined;
    const frame = requestAnimationFrame(() => document.getElementById(`catalog-${focusItem}`)?.scrollIntoView({ block: 'center', behavior: 'auto' }));
    return () => cancelAnimationFrame(frame);
  }, [focusItem, items.some((item) => item.id === focusItem)]);
  const load = async () => {
    if (busy || !more) return;
    const request = epoch.current;
    setBusy(true); setError(false);
    try {
      const r = await listBusinessCatalog(biz.id, { type: menu ? 'dish' : '', cursor });
      if (request !== epoch.current) return;
      setItems((previous) => [...new Map([...previous, ...r.items].map((item) => [item.id, item])).values()]); setCursor(r.cursor); setMore(r.hasMore);
    } catch { if (request === epoch.current) setError(true); }
    finally { if (request === epoch.current) setBusy(false); }
  };
  const branch = branches.find((entry) => entry.id === selectedBranch);
  const filtered = useMemo(() => items.filter((i) => (!selectedBranch || (branch && (i.allBranches || i.branchIds?.includes(selectedBranch)))) &&
    (!q.trim() || `${i.title} ${i.description}`.toLocaleLowerCase('ka-GE').includes(q.trim().toLocaleLowerCase('ka-GE'))) &&
    (!diet || i.dietaryTags?.includes(diet)) && (!prep || (i.preparationMinutes > 0 && i.preparationMinutes <= Number(prep)))), [items, q, diet, prep, selectedBranch, branch]);
  const photos = menu && Array.isArray(biz.raw?.menuPhotos) ? biz.raw.menuPhotos.filter((p) => typeof p?.url === 'string' && /^https:\/\//i.test(p.url)).slice(0, 20) : [];
  return <Card class="commerce-section">
    {photos.length > 0 && <><h2>{t('commerce.menuPhotos')}</h2><div class="commerce-menu-photos">{photos.map((p) => <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"><Img src={p.url} width={500} alt={t('commerce.menu')} /></a>)}</div></>}
    <h2>{t(menu ? 'commerce.menuText' : 'commerce.catalog')}</h2>
    {branch && <p class="small muted commerce-branch-scope"><Icon name="map-pin" size={16} /> {branch.title}{branch.address ? ` · ${branch.address}` : ''}</p>}
    <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('commerce.search')} />
    {menu && <div class="commerce-form-grid">
      <Select label={t('commerce.diet')} value={diet} onChange={(e) => setDiet(e.currentTarget.value)} options={[{ value: '', label: t('common.all') }, ...DIETARY_TAGS.map((value) => ({ value, label: t(`commerce.diet.${value}`) }))]} />
      <Select label={t('commerce.prep')} value={prep} onChange={(e) => setPrep(e.currentTarget.value)} options={[{ value: '', label: t('common.all') }, ...[10, 20, 30, 60].map((n) => ({ value: String(n), label: t('commerce.prepMax', { n }) }))]} />
    </div>}
    {more && <p class="muted small">{t('commerce.loadedScope')}</p>}
    <div class="commerce-grid">{filtered.map((item) => <article class={`commerce-item${item.id === focusItem ? ' is-focused' : ''}`} key={item.id} id={`catalog-${item.id}`}>
      <div class="commerce-item-media">{item.imageUrl && /^https:\/\//i.test(item.imageUrl) ? <Img src={item.imageUrl} width={500} alt="" /> : <Icon name={ITEM_ICONS[item.type] || 'tag'} size={42} />}</div>
      {item.isDemo && <p class="deal-demo-label"><Icon name="info" size={15} />{DEMO_OFFER_LABEL}</p>}
      <div class="commerce-item-content"><span class="muted xs">{t(`commerce.type.${item.type}`)}</span><h3>{item.title}</h3>
        {item.description && <p class="small text-2">{item.description}</p>}
        <p class="deal-prices"><strong>{formatCommercePrice(item.priceMinor, item.currency)}</strong></p>
        {!item.available && <p class="tag tag-warning">{t('commerce.unavailable')}</p>}
        {item.preparationMinutes && <p class="small muted">{t('commerce.prepValue', { n: item.preparationMinutes })}</p>}
        <div class="commerce-tags">{(item.dietaryTags || []).map((tag) => <span class="tag tag-success" key={tag}>{t(`commerce.diet.${tag}`)}</span>)}</div>
        {!item.allBranches && <div class="commerce-branches">{branches.filter((b) => item.branchIds?.includes(b.id)).map((b) => b.placeId ? <a key={b.id} href={`/map?place=${encodeURIComponent(b.placeId)}`}>{b.title}</a> : <span key={b.id} class="small muted">{b.title} · {b.address}</span>)}</div>}
      </div>
    </article>)}</div>
    {busy && <div class="center-pad"><Spinner /></div>}
    {error && <Empty icon="warning" title={t('commerce.loadError')} action={<Button onClick={() => setRefresh((n) => n + 1)}>{t('common.reload')}</Button>} />}
    {!busy && !error && !filtered.length && <Empty compact icon={menu ? 'fork-knife' : 'shopping-bag'} title={t(q || diet || prep ? 'deals.noMatch' : 'commerce.empty')} text={t('commerce.emptyHint')} />}
    {more && <div class="center-pad"><Button loading={busy} onClick={load}>{t('common.loadMore')}</Button></div>}
  </Card>;
}
