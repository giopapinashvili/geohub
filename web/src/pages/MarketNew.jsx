import { useState } from 'preact/hooks';
import { Button, IconButton } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { TextField, TextArea, Select, Segmented } from '../ui/Field.jsx';
import { Card, Img, Spinner } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { navigate, back } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { upload } from '../lib/media.js';
import { cityOptions } from '../lib/geo.js';
import { createItem, MARKET_CATS } from '../data/market.js';

/** New listing: photos, title, price, category, condition, city, description. */
export default function MarketNew() {
  useTitle(t('market.new'));
  const [f, setF] = useState({ title: '', description: '', price: '', category: 'item', condition: 'used', city: 'თბილისი' });
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const add = async (e) => {
    const files = [...e.currentTarget.files].slice(0, 8 - images.length);
    e.currentTarget.value = '';
    setUploading(true);
    try { for (const file of files) { const url = await upload(file, { folder: 'marketplace' }); setImages((l) => [...l, url]); } }
    catch (err) { toast.error(t(err.code === 'too-large' ? 'upload.tooLarge' : 'common.error')); }
    setUploading(false);
  };
  const submit = async () => {
    setBusy(true);
    try { const id = await createItem({ ...f, images }); toast.success(t('market.published')); navigate(`/marketplace/${id}`, { replace: true }); }
    catch { toast.error(t('common.error')); setBusy(false); }
  };
  return (
    <div class="page-pad biz-new">
      <div class="page-head"><h1 class="page-title">{t('market.new')}</h1></div>
      <Card>
        <div class="stack">
          <div class="market-photos">
            {images.map((src, i) => (
              <div key={src} class="manage-photo"><Img src={src} width={240} alt="" /><IconButton icon="x" label={t('common.remove')} size={30} variant="soft" onClick={() => setImages((l) => l.filter((_, j) => j !== i))} /></div>
            ))}
            {images.length < 8 && (
              <label class="market-add-photo">{uploading ? <Spinner /> : <Icon name="camera" size={26} />}<span class="small">{t('market.addPhotos')}</span>
                <input type="file" accept="image/*" multiple hidden onChange={add} /></label>
            )}
          </div>
          <Segmented value={f.category} onChange={(v) => set({ category: v })} label={t('place.category')} options={MARKET_CATS.map((c) => ({ value: c.id, label: t(`market.cat.${c.id}`), icon: c.icon }))} />
          <TextField label={t('market.title')} value={f.title} onInput={(e) => set({ title: e.currentTarget.value })} maxLength={100} />
          <div class="form-2">
            <TextField label={t(f.category === 'job' ? 'market.salary' : 'market.price')} type="number" min="0" value={f.price} onInput={(e) => set({ price: e.currentTarget.value })} hint={t('market.priceHint')} />
            <Select label={t('place.city')} value={f.city} onChange={(e) => set({ city: e.currentTarget.value })} options={cityOptions()} />
          </div>
          {f.category === 'item' && <Segmented value={f.condition} onChange={(v) => set({ condition: v })} label={t('market.condition')} options={[{ value: 'new', label: t('market.new_') }, { value: 'used', label: t('market.used') }]} />}
          <TextArea label={t('common.description')} value={f.description} onInput={(e) => set({ description: e.currentTarget.value })} maxLength={3000} minRows={4} />
          <div class="form-actions">
            <Button variant="secondary" onClick={() => back('/marketplace')}>{t('common.cancel')}</Button>
            <Button variant="primary" icon="check" loading={busy} disabled={f.title.trim().length < 3 || uploading} onClick={submit}>{t('common.publish')}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
