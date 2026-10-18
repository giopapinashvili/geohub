import { useEffect, useRef, useState } from 'preact/hooks';
import { Button, IconButton } from '../../ui/Button.jsx';
import { TextField, TextArea, Select } from '../../ui/Field.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { Card, Empty, Img, Spinner } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { upload } from '../../lib/media.js';
import { updateBusiness } from '../../data/business.js';
import { listBusinessCatalog, listBusinessBranches, listBusinessDiscounts, saveCommerceItem, saveCommerceOffer, archiveCommerceRecord } from '../../data/commerce.js';
import { COMMERCE_TYPES, DIETARY_TAGS, formatCommercePrice, priceToMinor, commerceOfferState, DEMO_OFFER_LABEL } from '../../lib/commerce.js';
import '../../styles/commerce.css';

const localTime = (ms) => new Date(ms + 4 * 3600000).toISOString().slice(0, 16);
const tbilisiTime = (str) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str) ? Date.parse(`${str}:00+04:00`) : NaN;

function BranchScope({ value, set, branches }) {
  return <fieldset><legend>{t('commerce.branches')}</legend><div class="commerce-choices">
    <label><input type="checkbox" checked={value.allBranches !== false} onChange={(e) => set({ allBranches: e.currentTarget.checked, branchIds: [] })} />{t('commerce.allBranches')}</label>
    {value.allBranches === false && branches.map((b) => <label key={b.id}><input type="checkbox" checked={value.branchIds.includes(b.id)} onChange={(e) => set({ branchIds: e.currentTarget.checked ? [...value.branchIds, b.id] : value.branchIds.filter((id) => id !== b.id) })} />{b.title}</label>)}
    {value.allBranches === false && !branches.length && <p class="muted small">{t('commerce.noBranches')}</p>}
  </div></fieldset>;
}

function ItemEditor({ biz, item, items, branches, onClose, onSaved }) {
  const [f, setF] = useState({ type: 'product', title: '', description: '', categoryId: biz.category, imageUrl: '', imageAssetId: '', sourceUrl: '', currency: 'GEL', status: 'published', available: true, allBranches: true, branchIds: [], dietaryTags: [], preparationMinutes: '', bundleItemIds: [], ...item, price: item.priceMinor == null ? '' : String(item.priceMinor / 100) });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const set = (v) => { setF((p) => ({ ...p, ...v })); if (error) setError(''); };
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await saveCommerceItem(biz.id, { ...f, priceMinor: priceToMinor(f.price), preparationMinutes: f.type === 'dish' && f.preparationMinutes !== '' ? Number(f.preparationMinutes) : null,
        dietaryTags: f.type === 'dish' ? f.dietaryTags : [], bundleItemIds: f.type === 'bundle' ? f.bundleItemIds : [] });
      toast.success(t('commerce.saved')); onSaved();
    } catch (err) { setError(err.name === 'CommerceValidationError' ? err.message : t('commerce.saveError')); }
    finally { setBusy(false); }
  };
  const photo = async (e) => {
    const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (!file) return;
    setUploading(true);
    try { const r = await upload(file, { folder: 'catalog', returnMetadata: true }); set({ imageUrl: r.url, imageAssetId: r.publicId }); }
    catch { setError(t('upload.failed')); } finally { setUploading(false); }
  };
  return <Modal open onClose={busy || uploading ? undefined : onClose} title={t(item.id ? 'commerce.editItem' : 'commerce.addItem')} size="md">
    <form class="commerce-form" onSubmit={save}>
      <Select label={t('commerce.type')} value={f.type} onChange={(e) => set({ type: e.currentTarget.value })} options={COMMERCE_TYPES.map((value) => ({ value, label: t(`commerce.type.${value}`) }))} />
      <TextField label={t('common.name')} required value={f.title} onInput={(e) => set({ title: e.currentTarget.value })} maxLength={160} />
      <TextArea label={t('common.description')} value={f.description} onInput={(e) => set({ description: e.currentTarget.value })} maxLength={4000} />
      <div class="commerce-form-grid"><TextField label={t('commerce.price')} inputMode="decimal" value={f.price} onInput={(e) => set({ price: e.currentTarget.value })} placeholder="12.50" /><Select label={t('commerce.currency')} value={f.currency} onChange={(e) => set({ currency: e.currentTarget.value })} options={['GEL', 'USD', 'EUR'].map((value) => ({ value, label: value }))} /></div>
      <TextField label={t('commerce.category')} value={f.categoryId} onInput={(e) => set({ categoryId: e.currentTarget.value })} maxLength={100} />
      <label class="btn btn-secondary commerce-upload">{uploading ? <Spinner size={16} /> : null}{t('biz.addPhotos')}<input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" disabled={uploading || busy} onChange={photo} /></label>
      {f.imageUrl && <Img src={f.imageUrl} width={350} alt="" style={{ maxHeight: 160, objectFit: 'contain' }} />}
      <TextField label={t('commerce.image')} type="url" value={f.imageUrl} onInput={(e) => set({ imageUrl: e.currentTarget.value, imageAssetId: '' })} />
      <TextField label={t('commerce.source')} type="url" value={f.sourceUrl} onInput={(e) => set({ sourceUrl: e.currentTarget.value })} />
      {f.type === 'dish' && <><TextField label={t('commerce.prep')} type="number" min="1" max="1440" value={f.preparationMinutes ?? ''} onInput={(e) => set({ preparationMinutes: e.currentTarget.value })} /><fieldset><legend>{t('commerce.diet')}</legend><div class="commerce-choices">{DIETARY_TAGS.map((tag) => <label key={tag}><input type="checkbox" checked={f.dietaryTags.includes(tag)} onChange={(e) => set({ dietaryTags: e.currentTarget.checked ? [...f.dietaryTags, tag] : f.dietaryTags.filter((v) => v !== tag) })} />{t(`commerce.diet.${tag}`)}</label>)}</div></fieldset></>}
      {f.type === 'bundle' && <fieldset><legend>{t('commerce.bundleItems')}</legend><div class="commerce-choices">{items.filter((i) => i.id !== f.id && i.type !== 'bundle' && i.status === 'published').map((i) => <label key={i.id}><input type="checkbox" checked={f.bundleItemIds.includes(i.id)} onChange={(e) => set({ bundleItemIds: e.currentTarget.checked ? [...f.bundleItemIds, i.id] : f.bundleItemIds.filter((id) => id !== i.id) })} />{i.title}</label>)}</div></fieldset>}
      <BranchScope value={f} set={set} branches={branches} />
      <div class="commerce-choices"><label><input type="checkbox" checked={f.available} onChange={(e) => set({ available: e.currentTarget.checked })} />{t('commerce.available')}</label></div>
      <Select label={t('commerce.status')} value={f.status} onChange={(e) => set({ status: e.currentTarget.value })} options={['draft', 'published', 'archived'].map((value) => ({ value, label: t(`commerce.status.${value}`) }))} />
      {error && <p class="commerce-error" role="alert">{error}</p>}
      <div class="row gap-8"><Button type="submit" variant="primary" loading={busy} disabled={uploading}>{t('common.save')}</Button><Button onClick={onClose} disabled={busy || uploading}>{t('common.cancel')}</Button></div>
    </form>
  </Modal>;
}

function OfferEditor({ biz, items, branches, onClose, onSaved }) {
  const available = items.filter((i) => i.status === 'published' && i.available && Number.isSafeInteger(i.priceMinor) && i.priceMinor > 0);
  const first = available[0];
  const [f, setF] = useState({ itemId: first?.id || '', title: first?.title || '', description: '', conditions: '', price: '', starts: localTime(Date.now()), ends: localTime(Date.now() + 7 * 86400000), allBranches: first?.allBranches !== false, branchIds: first?.branchIds || [], status: 'published' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (v) => setF((p) => ({ ...p, ...v }));
  const item = available.find((i) => i.id === f.itemId);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await saveCommerceOffer(biz.id, { ...f, priceMinor: priceToMinor(f.price), originalPriceMinor: item.priceMinor, startsAtMs: tbilisiTime(f.starts), endsAtMs: tbilisiTime(f.ends), isDemo: !!item.isDemo, demoBatchId: item.demoBatchId || '' }); toast.success(t('commerce.saved')); onSaved(); }
    catch (err) { setError(err.name === 'CommerceValidationError' ? err.message : t('commerce.saveError')); }
    finally { setBusy(false); }
  };
  return <Modal open onClose={busy ? undefined : onClose} title={t('commerce.addOffer')} size="md">
    {!available.length ? <Empty title={t('commerce.noPricedItems')} /> : <form class="commerce-form" onSubmit={save}>
      <Select label={t('commerce.chooseItem')} value={f.itemId} onChange={(e) => { const i = available.find((v) => v.id === e.currentTarget.value); set({ itemId: i.id, title: i.title, allBranches: i.allBranches, branchIds: i.branchIds, price: '' }); }} options={available.map((i) => ({ value: i.id, label: `${i.title} · ${formatCommercePrice(i.priceMinor, i.currency)}` }))} />
      <TextField label={t('common.name')} required maxLength={160} value={f.title} onInput={(e) => set({ title: e.currentTarget.value })} />
      <p class="muted">{t('commerce.oldPrice')}: <strong>{formatCommercePrice(item?.priceMinor, item?.currency)}</strong></p>
      <TextField label={t('commerce.newPrice')} required inputMode="decimal" value={f.price} onInput={(e) => set({ price: e.currentTarget.value })} />
      <div class="commerce-form-grid"><TextField label={t('commerce.starts')} required type="datetime-local" value={f.starts} onInput={(e) => set({ starts: e.currentTarget.value })} /><TextField label={t('commerce.ends')} required type="datetime-local" min={f.starts} value={f.ends} onInput={(e) => set({ ends: e.currentTarget.value })} /></div>
      <TextArea label={t('common.description')} value={f.description} onInput={(e) => set({ description: e.currentTarget.value })} maxLength={4000} />
      <TextArea label={t('commerce.conditions')} value={f.conditions} onInput={(e) => set({ conditions: e.currentTarget.value })} maxLength={2000} />
      <BranchScope value={f} set={set} branches={branches} />
      {error && <p class="commerce-error" role="alert">{error}</p>}
      <div class="row gap-8"><Button type="submit" variant="primary" loading={busy}>{t('common.publish')}</Button><Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button></div>
    </form>}
  </Modal>;
}

export function CommerceManage({ biz, offers = false }) {
  const [items, setItems] = useState([]);
  const [deals, setDeals] = useState([]);
  const [branches, setBranches] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(null);
  const [offering, setOffering] = useState(false);
  const [revision, setRevision] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [moreItems, setMoreItems] = useState(null);
  const [moreDeals, setMoreDeals] = useState(null);
  const [menuUrl, setMenuUrl] = useState('');
  const [menuError, setMenuError] = useState('');
  const [archiving, setArchiving] = useState('');
  const epoch = useRef(0);
  const reload = () => { setEditing(null); setOffering(false); setRevision((n) => n + 1); };
  useEffect(() => {
    const request = ++epoch.current;
    setBusy(true); setError(false); setItems([]); setDeals([]); setBranches([]); setMoreItems(null); setMoreDeals(null);
    Promise.all([listBusinessCatalog(biz.id, { management: true, pageSize: 50 }), listBusinessDiscounts(biz.id, { pageSize: 50 }), listBusinessBranches(biz.id, { management: true })]).then(([i, o, b]) => {
      if (request === epoch.current) { setItems(i.items); setDeals(o.items); setBranches(b); setMoreItems(i.hasMore ? i.cursor : null); setMoreDeals(o.hasMore ? o.cursor : null); }
    }).catch(() => { if (request === epoch.current) setError(true); }).finally(() => { if (request === epoch.current) setBusy(false); });
    return () => { if (request === epoch.current) epoch.current++; };
  }, [biz.id, revision]);
  useEffect(() => { setEditing(null); setOffering(false); setMenuUrl(''); setMenuError(''); }, [biz.id]);
  const archive = async (col, id) => {
    if (archiving) return;
    const request = epoch.current;
    setArchiving(id);
    try { await archiveCommerceRecord(col, id); if (request === epoch.current) reload(); }
    catch { if (request === epoch.current) toast.error(t('commerce.saveError')); }
    finally { setArchiving(''); }
  };
  const loadMore = async () => {
    if (busy || !(offers ? moreDeals : moreItems)) return;
    const request = epoch.current;
    setBusy(true); setError(false);
    try {
      const result = offers ? await listBusinessDiscounts(biz.id, { cursor: moreDeals, pageSize: 50 }) : await listBusinessCatalog(biz.id, { cursor: moreItems, management: true, pageSize: 50 });
      if (request !== epoch.current) return;
      const merge = (previous) => [...new Map([...previous, ...result.items].map((item) => [item.id, item])).values()];
      if (offers) { setDeals(merge); setMoreDeals(result.hasMore ? result.cursor : null); }
      else { setItems(merge); setMoreItems(result.hasMore ? result.cursor : null); }
    } catch { if (request === epoch.current) setError(true); }
    finally { if (request === epoch.current) setBusy(false); }
  };
  const menuPhotos = Array.isArray(biz.raw?.menuPhotos) ? biz.raw.menuPhotos : [];
  const addPhoto = async (e) => {
    const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (!file) return;
    if (menuPhotos.length >= 20 || uploading) return;
    setUploading(true); setMenuError('');
    try { const r = await upload(file, { folder: 'menus', returnMetadata: true }); await updateBusiness(biz.id, { menuPhotos: [...menuPhotos, { url: r.url, imageAssetId: r.publicId }].slice(0, 20) }); toast.success(t('commerce.saved')); }
    catch { toast.error(t('commerce.saveError')); } finally { setUploading(false); }
  };
  const addPhotoUrl = async (event) => {
    event.preventDefault();
    if (uploading || menuPhotos.length >= 20) return;
    try { if (new URL(menuUrl.trim()).protocol !== 'https:') throw new Error(); }
    catch { setMenuError(t('commerce.image')); return; }
    setUploading(true); setMenuError('');
    try { await updateBusiness(biz.id, { menuPhotos: [...menuPhotos, { url: menuUrl.trim(), imageAssetId: '' }] }); setMenuUrl(''); toast.success(t('commerce.saved')); }
    catch { setMenuError(t('commerce.saveError')); }
    finally { setUploading(false); }
  };
  return <div class="stack"><Card>
    <div class="commerce-toolbar"><h2 class="card-title">{t(offers ? 'nav.discounts' : 'commerce.catalog')}</h2><Button variant="primary" icon="plus" onClick={() => offers ? setOffering(true) : setEditing({})} disabled={busy || error}>{t(offers ? 'commerce.addOffer' : 'commerce.addItem')}</Button></div>
    <p class="muted small">{t('commerce.manageHint')}</p>
    {busy && <div class="center-pad"><Spinner /></div>}
    {error && <Empty icon="warning" title={t('commerce.loadError')} action={<Button onClick={reload}>{t('common.reload')}</Button>} />}
    {(offers ? deals : items).map((i) => <div key={i.id} class="commerce-list-row"><div><h3>{i.title}</h3><p class="small muted">{formatCommercePrice(i.priceMinor, i.currency)} · {t(`commerce.type.${i.type}`)} · {t(`commerce.status.${offers ? commerceOfferState(i) : i.status}`)}</p>{i.isDemo && <p class="deal-demo-label">{DEMO_OFFER_LABEL}</p>}</div><div class="row gap-8">
      {!offers && <IconButton icon="pencil-simple" label={t('common.edit')} onClick={() => setEditing(i)} />}
      {i.status !== 'archived' && <IconButton icon="archive" label={t('commerce.archive')} disabled={!!archiving} onClick={() => archive(offers ? 'commerceOffers' : 'commerceItems', i.id)} />}
    </div></div>)}
    {!busy && !error && !(offers ? deals : items).length && <Empty compact icon="shopping-bag" title={t('commerce.empty')} />}
    {(offers ? moreDeals : moreItems) && <Button loading={busy} onClick={loadMore}>{t('common.loadMore')}</Button>}
  </Card>
    {!offers && <Card><div class="commerce-toolbar"><h2 class="card-title">{t('commerce.menuPhotos')}</h2><label class="btn btn-secondary commerce-upload">{uploading && <Spinner size={16} />}{t('commerce.addMenuPhoto')}<input type="file" class="sr-only" accept="image/jpeg,image/png,image/webp" onChange={addPhoto} disabled={uploading || menuPhotos.length >= 20} /></label></div><p class="small muted">{t('commerce.menuPhotoHint')}</p>
      <form class="commerce-menu-url" onSubmit={addPhotoUrl}><TextField label={t('commerce.image')} type="url" required maxLength={2048} value={menuUrl} onInput={(event) => { setMenuUrl(event.currentTarget.value); setMenuError(''); }} /><Button type="submit" loading={uploading} disabled={menuPhotos.length >= 20}>{t('commerce.addMenuPhoto')}</Button></form>
      {menuError && <p class="commerce-error" role="alert">{menuError}</p>}
      <div class="commerce-menu-photos">{menuPhotos.map((photo, index) => ({ photo, index })).filter(({ photo }) => /^https:\/\//i.test(photo?.url || '')).map(({ photo, index }) => <div key={`${index}-${photo.url}`}><Img src={photo.url} width={240} alt={t('commerce.menu')} /><IconButton icon="trash" label={t('common.delete')} disabled={uploading} onClick={async () => { setUploading(true); try { await updateBusiness(biz.id, { menuPhotos: menuPhotos.filter((_, n) => n !== index) }); } catch { toast.error(t('commerce.saveError')); } finally { setUploading(false); } }} /></div>)}</div>
    </Card>}
    {editing && <ItemEditor biz={biz} item={editing} items={items} branches={branches} onClose={() => setEditing(null)} onSaved={reload} />}
    {offering && <OfferEditor biz={biz} items={items} branches={branches} onClose={() => setOffering(false)} onSaved={reload} />}
  </div>;
}
