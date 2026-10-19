import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { TextArea, Switch, SearchInput } from '../../ui/Field.jsx';
import { Spinner, Empty } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { upload } from '../../lib/media.js';
import { getPosition, distanceKm, cityLabel } from '../../lib/geo.js';
import { listMapPlaces, getPlace, checkIn } from '../../data/places.js';
import { mergeImportedPlaces, isImportedPlaceId, loadImportedPlaces } from '../../data/importedPlaces.js';
import { searchImported } from '../../lib/discoveryClient.js';
import { rankRecords } from '../../lib/discoverySearch.js';
import { readCoordinates, readDestinationCoordinates } from '../../lib/coordinates.js';
import { PlaceCard } from './PlaceCard.jsx';
import { categoryOf } from './categories.js';
import { PersonalActionNotice } from '../auth/PersonalActionNotice.jsx';

/** Location only counts as verified when the user is really near the place. */
const NEAR_KM = 2;

function PickPlace({ onPick, onAdd }) {
  const [places, setPlaces] = useState(null);
  const [pos, setPos] = useState(null);
  const [q, setQ] = useState('');
  const [localError, setLocalError] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [retry, setRetry] = useState(0);
  const [remote, setRemote] = useState({ query: '', rows: [], loading: false, error: false });
  const [picking, setPicking] = useState('');
  const [pickError, setPickError] = useState(false);
  const selection = useRef(0);
  const term = q.trim();
  const remoteState = remote.query === term ? remote : { rows: [], loading: term.length >= 2, error: false };
  useEffect(() => {
    let active = true;
    setLocalError(false);
    Promise.allSettled([listMapPlaces(),loadImportedPlaces()]).then(([native,overview])=>{
      if (!active) return;
      setPlaces(mergeImportedPlaces(native.status==='fulfilled' ? native.value.places : [],overview.status==='fulfilled' ? overview.value.places : []));
      setTruncated(native.status==='fulfilled' && native.value.truncated);
      setLocalError(native.status==='rejected' || overview.status==='rejected');
    });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    let active = true;
    getPosition({ timeout: 8000 }).then(value => { if (active) setPos(value); }).catch(() => {});
    return () => { active = false; selection.current++; };
  }, []);
  useEffect(() => {
    let active = true;
    if (term.length < 2) { setRemote({ query: term, rows: [], loading: false, error: false }); return undefined; }
    setRemote({ query: term, rows: [], loading: true, error: false });
    const timer = setTimeout(() => {
      searchImported(term, { channel: 'checkin', kinds: ['place'], limit: 40 }).then(rows => {
        if (active) setRemote({ query: term, rows: rows.filter(row => row.kind === 'place'), loading: false, error: false });
      }).catch(() => { if (active) setRemote({ query: term, rows: [], loading: false, error: true }); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [term, retry]);
  const list = useMemo(() => {
    const candidates=mergeImportedPlaces(places || [], remoteState.rows);
    const rows = term ? rankRecords(candidates, term, { limit: 40 }) : candidates;
    const withDistance = rows.map(p => ({ p, d: pos && readCoordinates(p) ? distanceKm(pos, p) : Infinity }));
    return term ? withDistance : withDistance.sort((a, b) => (a.d - b.d) || ((b.p.checkinCount || 0) - (a.p.checkinCount || 0))).slice(0, 40);
  }, [places, pos, term, remoteState.rows]);
  const pick = async place => {
    if (picking) return;
    const request = ++selection.current;
    setPicking(place.id); setPickError(false);
    try {
      const full = isImportedPlaceId(place.id) ? await getPlace(place.id) : place;
      if (request !== selection.current) return;
      if (!full || ['inactive', 'deleted'].includes(full.status)) throw new Error('Place unavailable');
      onPick(full);
    } catch { if (request === selection.current) setPickError(true); }
    finally { if (request === selection.current) setPicking(''); }
  };
  const searching = !places || remoteState.loading;
  return (
    <div class="stack">
      <SearchInput value={q} onInput={(e) => { selection.current++; setPicking(''); setPickError(false); setQ(e.currentTarget.value.slice(0, 200)); }} placeholder={t('checkin.searchPlace')} autoFocus />
      {pos && <p class="muted small row gap-6"><Icon name="navigation-arrow-fill" size={14} class="tone-brand" />{t('checkin.nearYou')}</p>}
      {!term && <p class="muted small">სხვა ადგილების მოსაძებნად ჩაწერე სახელი — ქართულად ან ლათინური ასოებით.</p>}
      {term.length === 1 && <p class="muted small">სრული ცნობარის ძიებისთვის ჩაწერე მინიმუმ 2 ასო.</p>}
      {(localError || remoteState.error) && <p class="small" role="alert">ადგილების ნაწილი ვერ ჩაიტვირთა. <Button size="sm" variant="ghost" onClick={() => setRetry(value => value + 1)}>{t('common.retry')}</Button></p>}
      {truncated && <p class="muted small">საიტის ადგილების სია შეზღუდულია; ღია ცნობარში ძიება ცალკეც მუშაობს.</p>}
      {searching && <p class="row gap-8 small" role="status"><Spinner size={16}/>ადგილებს ვეძებთ…</p>}
      {list.some(({ p }) => p.searchMatch === 'fuzzy') && <p class="muted small">მიახლოებული სახელებიც ნაჩვენებია.</p>}
      {picking && <p class="row gap-8 small" role="status"><Spinner size={16}/>ადგილის სრულ ინფორმაციას ვტვირთავთ…</p>}
      {pickError && <p class="small" role="alert">ადგილი ვერ ჩაიტვირთა. სცადე ხელახლა არჩევა.</p>}
      {list.length ? (
        <div class="checkin-list" aria-busy={picking ? 'true' : undefined}>
          {list.map(({ p, d }) => <PlaceCard key={p.id} place={p} distance={d} compact onClick={(e) => { e.preventDefault(); pick(p); }} />)}
        </div>
      ) : !searching && <Empty compact icon="map-pin" title={t('place.noneFound')} text="სცადე სახელის ნაწილი ან სხვა დაწერილობა." action={onAdd && <Button variant="secondary" icon="map-pin-plus" onClick={onAdd}>{t('place.add')}</Button>} />}
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
  const destination=readDestinationCoordinates(place);
  const near = pos && destination && distanceKm(pos, destination) <= NEAR_KM;

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
        <PersonalActionNotice>ჩექინი და მისი პოსტი შენს პირად პროფილს დაუკავშირდება.</PersonalActionNotice>
        <PickPlace onPick={setPlace} onAdd={onAddPlace} />
      </Modal>
    );
  }
  const cat = categoryOf(place);
  return (
    <Modal open onClose={onClose} title={t('checkin.title')} size="md"
      footer={<>{!initial && <Button variant="secondary" onClick={() => setPlace(null)}>{t('common.back')}</Button>}<Button variant="primary" icon="map-pin" onClick={submit} loading={busy}>{t('checkin.submit')}</Button></>}>
      <div class="stack">
        <PersonalActionNotice>ჩექინი და მისი პოსტი შენს პირად პროფილს დაუკავშირდება.</PersonalActionNotice>
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
