import { useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { TextField } from '../../ui/Field.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { coordinatesForWrite, readCoordinates } from '../../lib/coordinates.js';
import { updatePlace } from '../../data/places.js';
import { CoordinateFields } from './CoordinateFields.jsx';

/** Firestore still checks ownership/admin rights for every write. */
export function PlaceLocationDialog({ place, onClose }) {
  const [address, setAddress] = useState(place.address || '');
  const [city, setCity] = useState(place.city || '');
  const [coords, setCoords] = useState(() => readCoordinates(place) || { lat: '', lng: '' });
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    let pair;
    try { pair = coordinatesForWrite(coords); }
    catch { setInvalid(true); return; }
    setInvalid(false);
    setBusy(true);
    try {
      await updatePlace(place.id, { address, city, ...pair });
      toast.success(t('place.locationSaved'));
      onClose();
    } catch (error) {
      if (error.code === 'invalid-coordinates') setInvalid(true);
      else toast.error(t('common.error'));
    } finally { setBusy(false); }
  };

  return (
    <Modal open title={t('place.editLocation')} onClose={() => { if (!busy) onClose(); }} size="md"
      footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('common.save')}</Button></>}>
      <div class="stack">
        <TextField label={t('place.address')} value={address} maxLength={160} onInput={(event) => setAddress(event.currentTarget.value)} />
        <TextField label={t('place.city')} value={city} maxLength={80} onInput={(event) => setCity(event.currentTarget.value)} />
        <CoordinateFields value={coords} error={invalid} onChange={(value) => { setCoords(value); setInvalid(false); }} />
      </div>
    </Modal>
  );
}
