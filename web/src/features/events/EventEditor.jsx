import { useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { TextField, TextArea, Select } from '../../ui/Field.jsx';
import { Img, Spinner } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { upload } from '../../lib/media.js';
import { cityOptions, cityCoords } from '../../lib/geo.js';
import { saveEvent } from '../../data/events.js';
import { EVENT_CATEGORIES, eventCategory } from './categories.js';

const local = (ms) => (ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

/** Create or edit a top-level event (admins). */
export function EventEditor({ event, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    title: event?.title || '', description: event?.description || '', category: event?.category || 'music', city: event?.city || 'თბილისი',
    venue: event?.venue || '', date: local(event?.date) || '', endDate: local(event?.endDate) || '', price: event?.price || '', capacity: event?.capacity || '', image: event?.image || '',
  }));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const pick = async (e) => {
    const file = e.currentTarget.files[0];
    if (!file) return;
    setUploading(true);
    try { set({ image: await upload(file, { folder: 'events' }) }); } catch (err) { toast.error(t(err.code === 'too-large' ? 'upload.tooLarge' : 'common.error')); }
    setUploading(false);
  };
  const save = async () => {
    setBusy(true);
    try {
      const c = cityCoords(f.city);
      const id = await saveEvent({ ...f, id: event?.id, lat: event?.lat ?? c?.lat, lng: event?.lng ?? c?.lng });
      toast.success(t('events.saved'));
      onSaved?.(id);
      onClose();
    } catch { toast.error(t('common.error')); }
    setBusy(false);
  };
  const valid = f.title.trim().length >= 3 && f.date;
  return (
    <Modal open onClose={onClose} title={t(event ? 'events.edit' : 'events.create')} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} disabled={!valid} onClick={save}>{t(event ? 'common.save' : 'common.publish')}</Button></>}>
      <div class="stack">
        <label class="event-cover-pick">
          {f.image ? <Img src={f.image} width={800} alt="" /> : <span class="biz-pick-empty"><Icon name="image" size={28} />{t('events.cover')}</span>}
          <input type="file" accept="image/*" hidden onChange={pick} />
          {uploading && <span class="event-cover-busy"><Spinner /></span>}
        </label>
        <TextField label={t('events.title')} value={f.title} onInput={(e) => set({ title: e.currentTarget.value })} maxLength={100} />
        <div class="form-2">
          <Select label={t('place.category')} value={f.category} onChange={(e) => set({ category: e.currentTarget.value })} options={EVENT_CATEGORIES.map((c) => ({ value: c.id, label: eventCategory(c.id).label }))} />
          <Select label={t('place.city')} value={f.city} onChange={(e) => set({ city: e.currentTarget.value })} options={cityOptions()} />
        </div>
        <TextField label={t('events.venue')} value={f.venue} onInput={(e) => set({ venue: e.currentTarget.value })} maxLength={100} />
        <div class="form-2">
          <TextField label={t('events.starts')} type="datetime-local" value={f.date} onInput={(e) => set({ date: e.currentTarget.value })} />
          <TextField label={t('events.ends')} optional={t('common.optional')} type="datetime-local" value={f.endDate} onInput={(e) => set({ endDate: e.currentTarget.value })} />
        </div>
        <div class="form-2">
          <TextField label={t('events.price')} type="number" min="0" value={f.price} onInput={(e) => set({ price: e.currentTarget.value })} hint={t('events.priceHint')} />
          <TextField label={t('events.capacity')} optional={t('common.optional')} type="number" min="0" value={f.capacity} onInput={(e) => set({ capacity: e.currentTarget.value })} />
        </div>
        <TextArea label={t('common.description')} value={f.description} onInput={(e) => set({ description: e.currentTarget.value })} maxLength={3000} minRows={4} />
      </div>
    </Modal>
  );
}
