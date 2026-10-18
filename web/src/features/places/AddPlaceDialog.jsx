import { useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { TextField, TextArea, Select } from '../../ui/Field.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { upload } from '../../lib/media.js';
import { cityOptions, getPosition } from '../../lib/geo.js';
import { coordinatesForWrite, readCoordinates } from '../../lib/coordinates.js';
import { createPlace } from '../../data/places.js';
import { useCategories } from './categories.js';
import { CoordinateFields } from './CoordinateFields.jsx';

/** Unknown positions stay unknown; a city centre is never used as a place pin. */
export function AddPlaceDialog({ onClose, onCreated, at }) {
  const cats = useCategories();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('nature');
  const [city, setCity] = useState('თბილისი');
  const [address, setAddress] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState(null);
  const [coords, setCoords] = useState(() => readCoordinates(at) || { lat: '', lng: '' });
  const [invalidCoords, setInvalidCoords] = useState(false);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);

  const locate = async () => {
    setLocating(true);
    try { setCoords(await getPosition()); setInvalidCoords(false); } catch (e) { toast.error(t(e.message === 'denied' ? 'map.locationDenied' : 'map.locationFailed')); }
    setLocating(false);
  };
  const submit = async () => {
    if (busy) return;
    let c;
    try { c = coordinatesForWrite(coords); }
    catch { setInvalidCoords(true); return; }
    setInvalidCoords(false);
    setBusy(true);
    try {
      const photoUrl = file ? await upload(file, { folder: 'places' }) : '';
      const id = await createPlace({ name, description: desc, category, address: address.trim(), city, lat: c?.lat ?? null, lng: c?.lng ?? null, photoUrl });
      toast.success(t('place.created'));
      onCreated?.(id);
      onClose();
    } catch (e) {
      toast.error(t(e.code === 'too-large' ? 'upload.tooLarge' : 'common.error'));
    }
    setBusy(false);
  };

  return (
    <Modal open onClose={onClose} title={t('place.add')} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={submit} loading={busy} disabled={name.trim().length < 2}>{t('common.publish')}</Button></>}>
      <div class="stack">
        <TextField label={t('place.name')} value={name} onInput={(e) => setName(e.currentTarget.value)} maxLength={80} />
        <div class="form-2">
          <Select label={t('place.category')} value={category} onChange={(e) => setCategory(e.currentTarget.value)} options={cats.map((c) => ({ value: c.id, label: c.label }))} />
          <Select label={t('place.city')} value={city} onChange={(e) => setCity(e.currentTarget.value)} options={cityOptions()} />
        </div>
        <TextField label={t('place.address')} optional={t('common.optional')} value={address} onInput={(e) => setAddress(e.currentTarget.value)} maxLength={120} />
        <TextArea label={t('common.description')} optional={t('common.optional')} value={desc} onInput={(e) => setDesc(e.currentTarget.value)} maxLength={1000} minRows={2} />
        <div class="place-locate">
          <Icon name="map-pin" size={20} class="muted" />
          <span class="grow small">{t('place.coordinatesLocateHint')}</span>
          <Button variant="secondary" size="sm" icon="crosshair" loading={locating} onClick={locate}>{t('place.useMyLocation')}</Button>
        </div>
        <CoordinateFields value={coords} error={invalidCoords} onChange={(value) => { setCoords(value); setInvalidCoords(false); }} />
        <label class="upload-drop">
          <input type="file" accept="image/*" hidden onChange={(e) => setFile(e.currentTarget.files[0] || null)} />
          <Icon name="image" size={28} class="muted" />
          <strong>{file ? file.name : t('place.addPhoto')}</strong>
        </label>
      </div>
    </Modal>
  );
}
