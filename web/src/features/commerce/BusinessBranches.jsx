import { useEffect, useState } from 'preact/hooks';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { TextField } from '../../ui/Field.jsx';
import { Card, Empty, Spinner } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { coordinatesForWrite, readCoordinates } from '../../lib/coordinates.js';
import { listBusinessBranches, saveBusinessBranch, archiveCommerceRecord } from '../../data/commerce.js';
import { PlaceCoordinates } from '../places/PlaceCoordinates.jsx';

function BranchEditor({ biz, branch, onClose, onSaved }) {
  const [f, setF] = useState({ title: '', address: '', city: '', lat: '', lng: '', status: 'published', placeId: '', parentMallId: '', ...branch });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setF((p) => ({ ...p, [key]: e.currentTarget.value }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await saveBusinessBranch(biz.id, { ...f, ...coordinatesForWrite(f) }); toast.success(t('commerce.saved')); onSaved(); }
    catch (err) { setError(err.code === 'invalid-coordinates' ? t('place.coordinatesInvalid') : err.name === 'CommerceValidationError' ? err.message : t('commerce.saveError')); }
    finally { setBusy(false); }
  };
  return <Modal open onClose={busy ? undefined : onClose} title={t('commerce.branch')} size="md"><form class="commerce-form" onSubmit={save}>
    <TextField label={t('common.name')} required value={f.title} maxLength={160} onInput={set('title')} />
    <TextField label={t('place.address')} value={f.address} maxLength={300} onInput={set('address')} autoComplete="street-address" />
    <TextField label={t('common.city')} value={f.city} maxLength={100} onInput={set('city')} autoComplete="address-level2" />
    <div class="commerce-form-grid"><TextField label={t('place.latitude')} value={f.lat ?? ''} onInput={set('lat')} inputMode="decimal" /><TextField label={t('place.longitude')} value={f.lng ?? ''} onInput={set('lng')} inputMode="decimal" /></div>
    {error && <p role="alert" class="commerce-error">{error}</p>}
    <div class="row gap-8"><Button type="submit" loading={busy} variant="primary">{t('common.save')}</Button><Button disabled={busy} onClick={onClose}>{t('common.cancel')}</Button></div>
  </form></Modal>;
}
export function BusinessBranches({ biz, manage = false }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(null);
  const [revision, setRevision] = useState(0);
  const reload = () => { setEditing(null); setRevision((n) => n + 1); };
  useEffect(() => {
    let active = true; setItems(null); setError(false);
    listBusinessBranches(biz.id, { management: manage }).then((r) => { if (active) setItems(r); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [biz.id, manage, revision]);
  return <Card class="commerce-section"><div class="commerce-toolbar"><h2 class="card-title">{t('commerce.branches')}</h2>{manage && <Button variant="primary" icon="plus" onClick={() => setEditing({})}>{t('commerce.addBranch')}</Button>}</div>
    {error ? <Empty icon="warning" title={t('commerce.loadError')} action={<Button onClick={reload}>{t('common.reload')}</Button>} /> : !items ? <Spinner /> : !items.length ? <Empty compact icon="storefront" title={t('commerce.noBranches')} /> : items.map((b) => {
      const coords = readCoordinates(b);
      const href = b.placeId ? `/map?place=${encodeURIComponent(b.placeId)}` : coords ? `/map?lat=${coords.lat}&lng=${coords.lng}&label=${encodeURIComponent(b.title)}` : '';
      return <article key={b.id} class="commerce-list-row"><div><h3>{b.title}</h3><p class="small muted">{[b.address, b.city].filter(Boolean).join(', ')}</p><PlaceCoordinates place={b} />{href && <Button href={href} icon="map-pin" size="sm">{t('nav.map')}</Button>}</div>{manage && <div class="row gap-8"><IconButton icon="pencil-simple" label={t('common.edit')} onClick={() => setEditing(b)} /><IconButton icon="archive" label={t('commerce.archive')} onClick={async () => { try { await archiveCommerceRecord('businessBranches', b.id); reload(); } catch { toast.error(t('commerce.saveError')); } }} /></div>}</article>;
    })}
    {editing && <BranchEditor biz={biz} branch={editing} onClose={() => setEditing(null)} onSaved={reload} />}
  </Card>;
}
