import { useEffect, useMemo, useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { TextArea, Switch, SearchInput } from '../../ui/Field.jsx';
import { Spinner, Empty } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { upload } from '../../lib/media.js';
import { getPosition, distanceKm, cityLabel } from '../../lib/geo.js';
import { listPlaces, checkIn } from '../../data/places.js';
import { PlaceCard } from './PlaceCard.jsx';
import { categoryOf } from './categories.js';

/** Location only counts as verified when the user is really near the place. */
const NEAR_KM = 2;

function PickPlace({ onPick, onAdd }) {
  const [places, setPlaces] = useState(null);
  const [pos, setPos] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { listPlaces(300).then(setPlaces).catch(() => setPlaces([])); getPosition({ timeout: 8000 }).then(setPos).catch(() => {}); }, []);
  const list = useMemo(() => {
    if (!places) return [];
    const needle = q.trim().toLowerCase();
    const withD = places.map((p) => ({ p, d: pos ? distanceKm(pos, p) : Infinity }));
    const filtered = needle ? withD.filter(({ p }) => `${p.name} ${p.city}`.toLowerCase().includes(needle)) : withD;
    return filtered.sort((a, b) => (a.d - b.d) || (b.p.checkinCount - a.p.checkinCount)).slice(0, 40);
  }, [places, pos, q]);
  return (
    <div class="stack">
      <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('checkin.searchPlace')} autoFocus />
      {pos && <p class="muted small row gap-6"><Icon name="navigation-arrow-fill" size={14} class="tone-brand" />{t('checkin.nearYou')}</p>}
      {!places ? <div class="center-pad"><Spinner /></div> : list.length ? (
        <div class="checkin-list">
          {list.map(({ p, d }) => <PlaceCard key={p.id} place={p} distance={d} compact href="#" onClick={(e) => { e.preventDefault(); onPick(p); }} />)}
        </div>
      ) : <Empty compact icon="map-pin" title={t('place.noneFound')} action={onAdd && <Button variant="secondary" icon="map-pin-plus" onClick={onAdd}>{t('place.add')}</Button>} />}
    </div>
  );
}

/** Check in at a place: optional photo and caption, optionally shared to the feed. */
export function CheckinDialog({ place: initial, onClose, onAddPlace, onDone }) {
  const [place, setPlace] = useState(initial || null);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [share, setShare] = useState(true);
  const [pos, setPos] = useState(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (place) getPosition({ timeout: 8000 }).then(setPos).catch(() => setPos(null)); }, [place?.id]);
  useEffect(() => { if (!file) { setPreview(''); return undefined; } const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u); }, [file]);
  const near = pos && place?.lat != null && distanceKm(pos, place) <= NEAR_KM;

  const submit = async () => {
    setBusy(true);
    try {
      const photoUrl = file ? await upload(file, { folder: 'checkins' }) : '';
      await checkIn(place, { caption: caption.trim(), photoUrl, share, lat: near ? pos.lat : null, lng: near ? pos.lng : null });
      toast.success(t('checkin.done', { place: place.name }));
      onDone?.(place);
      onClose();
    } catch (e) {
      toast.error(t(e.code === 'too-large' ? 'upload.tooLarge' : 'common.error'));
    }
    setBusy(false);
  };

  if (!place) {
    return (
      <Modal open onClose={onClose} title={t('checkin.title')} size="md">
        <PickPlace onPick={setPlace} onAdd={onAddPlace} />
      </Modal>
    );
  }
  const cat = categoryOf(place);
  return (
    <Modal open onClose={onClose} title={t('checkin.title')} size="md"
      footer={<>{!initial && <Button variant="secondary" onClick={() => setPlace(null)}>{t('common.back')}</Button>}<Button variant="primary" icon="map-pin" onClick={submit} loading={busy}>{t('checkin.submit')}</Button></>}>
      <div class="stack">
        <div class="checkin-place">
          <span class="checkin-place-ico" style={{ '--tone': cat.tone }}><Icon name={cat.icon} size={22} /></span>
          <div class="grow">
            <strong class="ellipsis" style={{ display: 'block' }}>{place.name}</strong>
            <span class="muted small">{[cat.label, cityLabel(place.city)].filter(Boolean).join(' · ')}</span>
          </div>
        </div>
        <p class={`checkin-verify small${near ? ' is-ok' : ''}`}>
          {pos === undefined ? <><Spinner size={14} /> {t('checkin.locating')}</>
            : near ? <><Icon name="seal-check-fill" size={16} /> {t('checkin.verified')}</>
            : <><Icon name="info" size={16} /> {t('checkin.notVerified')}</>}
        </p>
        <TextArea label={t('checkin.caption')} optional={t('common.optional')} value={caption} onInput={(e) => setCaption(e.currentTarget.value)} maxLength={500} minRows={2} placeholder={t('checkin.captionHint')} />
        {preview ? (
          <div class="checkin-photo">
            <img src={preview} alt="" />
            <Button variant="secondary" size="sm" icon="x" onClick={() => setFile(null)}>{t('common.remove')}</Button>
          </div>
        ) : (
          <label class="btn btn-secondary btn-md checkin-add-photo">
            <Icon name="camera" size={20} />{t('checkin.addPhoto')}
            <input type="file" accept="image/*" hidden onChange={(e) => setFile(e.currentTarget.files[0] || null)} />
          </label>
        )}
        <Switch checked={share} onChange={setShare} label={t('checkin.share')} description={t('checkin.shareHint')} />
      </div>
    </Modal>
  );
}
