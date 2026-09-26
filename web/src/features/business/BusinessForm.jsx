import { useState } from 'preact/hooks';
import { TextField, TextArea, Select, Segmented, Switch } from '../../ui/Field.jsx';
import { Button } from '../../ui/Button.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Img, Spinner } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { upload } from '../../lib/media.js';
import { cityOptions, getPosition, cityCoords } from '../../lib/geo.js';
import { CategoryPicker } from './CategoryPicker.jsx';
import { HoursEditor } from './HoursEditor.jsx';
import { readHours, writeHours, defaultHours } from './hours.js';

export function emptyBusiness() {
  return {
    title: '', category: '', description: '', businessType: 'physical', city: 'თბილისი', address: '', mapsLink: '',
    phone: '', email: '', website: '', instagram: '', facebook: '', whatsapp: '', priceRange: '',
    logoUrl: '', coverUrl: '', hoursOn: false, hours: defaultHours(), lat: null, lng: null,
  };
}

export function fromBusiness(b) {
  const hours = readHours(b.workingHours);
  return {
    title: b.name, category: b.category, description: b.description, businessType: b.isOnline ? 'online' : 'physical', city: b.city, address: b.address,
    mapsLink: b.raw?.mapsLink || '', phone: b.phone, email: b.email, website: b.website, instagram: b.socialLinks.instagram, facebook: b.socialLinks.facebook,
    whatsapp: b.socialLinks.whatsapp, priceRange: b.priceRange, logoUrl: b.logo, coverUrl: b.cover, hoursOn: !!hours, hours: hours || defaultHours(), lat: b.lat, lng: b.lng,
  };
}

/** Form state → the fields createBusiness / updateBusiness accept. */
export function toPayload(f) {
  const c = f.lat != null ? { lat: f.lat, lng: f.lng } : (f.businessType === 'physical' ? cityCoords(f.city) : null);
  return {
    ...f, lat: c?.lat ?? null, lng: c?.lng ?? null, workingHours: f.hoursOn ? writeHours(f.hours) : null,
    socialLinks: { instagram: f.instagram.trim(), facebook: f.facebook.trim(), whatsapp: f.whatsapp.trim() },
  };
}

export const validBasics = (f) => f.title.trim().length >= 2 && !!f.category;

export function BasicsFields({ f, set }) {
  return (
    <div class="stack">
      <TextField label={t('biz.name')} value={f.title} onInput={(e) => set({ title: e.currentTarget.value })} maxLength={80} placeholder={t('biz.namePh')} />
      <CategoryPicker label={t('biz.category')} value={f.category} onChange={(v) => set({ category: v })} />
      <div class="field">
        <span class="field-label">{t('biz.type')}</span>
        <Segmented value={f.businessType} onChange={(v) => set({ businessType: v })} label={t('biz.type')} options={[
          { value: 'physical', label: t('biz.physical'), icon: 'storefront' },
          { value: 'online', label: t('biz.online'), icon: 'globe-simple' },
        ]} />
        <p class="field-hint">{t(f.businessType === 'online' ? 'biz.onlineHint' : 'biz.physicalHint')}</p>
      </div>
      <TextArea label={t('common.description')} value={f.description} onInput={(e) => set({ description: e.currentTarget.value })} maxLength={2000} minRows={3} placeholder={t('biz.descPh')} />
    </div>
  );
}

export function ContactFields({ f, set }) {
  const [locating, setLocating] = useState(false);
  const locate = async () => {
    setLocating(true);
    try { const p = await getPosition(); set({ lat: p.lat, lng: p.lng }); toast.success(t('biz.locationSet')); }
    catch (e) { toast.error(t(e.message === 'denied' ? 'map.locationDenied' : 'map.locationFailed')); }
    setLocating(false);
  };
  return (
    <div class="stack">
      {f.businessType === 'physical' && (
        <>
          <div class="form-2">
            <Select label={t('place.city')} value={f.city} onChange={(e) => set({ city: e.currentTarget.value })} options={cityOptions()} />
            <TextField label={t('place.address')} value={f.address} onInput={(e) => set({ address: e.currentTarget.value })} maxLength={120} />
          </div>
          <div class="place-locate">
            <Icon name={f.lat != null ? 'map-pin-fill' : 'map-pin'} size={20} class={f.lat != null ? 'tone-brand' : 'muted'} />
            <span class="grow small">{f.lat != null ? t('biz.onMapExact') : t('biz.onMapCity')}</span>
            <Button variant="secondary" size="sm" icon="crosshair" loading={locating} onClick={locate}>{t('place.useMyLocation')}</Button>
          </div>
        </>
      )}
      <div class="form-2">
        <TextField label={t('biz.phone')} type="tel" icon="phone" value={f.phone} onInput={(e) => set({ phone: e.currentTarget.value })} maxLength={30} placeholder="+995 5__ __ __ __" />
        <TextField label={t('biz.email')} type="email" icon="envelope-simple" value={f.email} onInput={(e) => set({ email: e.currentTarget.value })} maxLength={80} />
      </div>
      <TextField label={t('biz.website')} optional={t('common.optional')} type="url" icon="globe-simple" value={f.website} onInput={(e) => set({ website: e.currentTarget.value })} maxLength={120} placeholder="https://" />
      <div class="form-2">
        <TextField label="Instagram" optional={t('common.optional')} icon="instagram-logo" value={f.instagram} onInput={(e) => set({ instagram: e.currentTarget.value })} maxLength={120} />
        <TextField label="Facebook" optional={t('common.optional')} icon="facebook-logo" value={f.facebook} onInput={(e) => set({ facebook: e.currentTarget.value })} maxLength={120} />
      </div>
      <div class="form-2">
        <TextField label="WhatsApp" optional={t('common.optional')} icon="whatsapp-logo" value={f.whatsapp} onInput={(e) => set({ whatsapp: e.currentTarget.value })} maxLength={30} />
        <Select label={t('biz.priceRange')} value={f.priceRange} onChange={(e) => set({ priceRange: e.currentTarget.value })} options={[
          { value: '', label: '—' }, { value: '$', label: t('biz.price1') }, { value: '$$', label: t('biz.price2') }, { value: '$$$', label: t('biz.price3') }, { value: '$$$$', label: t('biz.price4') },
        ]} />
      </div>
    </div>
  );
}

function ImagePick({ label, value, onChange, kind }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.currentTarget.files[0];
    e.currentTarget.value = '';
    if (!file) return;
    setBusy(true);
    try { onChange(await upload(file, { folder: 'businesses' })); } catch (err) { toast.error(t(err.code === 'too-large' ? 'upload.tooLarge' : 'common.error')); }
    setBusy(false);
  };
  return (
    <label class={`biz-pick biz-pick-${kind}`}>
      <input type="file" accept="image/*" hidden onChange={pick} />
      {kind === 'cover'
        ? (value ? <Img src={value} width={900} alt="" /> : <span class="biz-pick-empty"><Icon name="image" size={28} />{label}</span>)
        : <Avatar src={value} name="+" size={88} square />}
      <span class="biz-pick-btn">{busy ? <Spinner size={16} /> : <Icon name="camera" size={16} />}{kind === 'cover' ? '' : label}</span>
    </label>
  );
}

export function LookFields({ f, set }) {
  return (
    <div class="stack">
      <div class="biz-pick-wrap">
        <ImagePick kind="cover" label={t('biz.cover')} value={f.coverUrl} onChange={(v) => set({ coverUrl: v })} />
        <ImagePick kind="logo" label={t('biz.logo')} value={f.logoUrl} onChange={(v) => set({ logoUrl: v })} />
      </div>
      <Switch checked={f.hoursOn} onChange={(v) => set({ hoursOn: v })} label={t('biz.hours')} description={t('biz.hoursHint')} />
      {f.hoursOn && <HoursEditor rows={f.hours} onChange={(hours) => set({ hours })} />}
    </div>
  );
}
