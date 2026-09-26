import { useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Spinner } from '../ui/misc.jsx';
import { TextArea, Select } from '../ui/Field.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { navigate, query } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { upload } from '../lib/media.js';
import { cityOptions } from '../lib/geo.js';
import { profile } from '../lib/auth.js';
import { updateMyProfile } from '../data/users.js';
import { useSuggestions } from '../features/user/PeopleStrip.jsx';
import { FriendButton } from '../features/user/FriendButton.jsx';
import { Logo } from '../shell/Logo.jsx';

const INTERESTS = ['travel', 'food', 'nature', 'history', 'wine', 'music', 'sport', 'art', 'tech', 'nightlife', 'family', 'business', 'photo', 'books'];

/** First-run setup: photo and bio, interests, people to connect with. */
export default function Onboarding() {
  useTitle(t('onboarding.title'));
  const p = profile.value;
  const [step, setStep] = useState(0);
  const [avatar, setAvatar] = useState(p?.avatar || '');
  const [bio, setBio] = useState(p?.bio || '');
  const [city, setCity] = useState(p?.raw?.city && p.raw.city !== 'all_georgia' ? p.raw.city : '');
  const [interests, setInterests] = useState(Array.isArray(p?.raw?.interests) ? p.raw.interests.filter((x) => INTERESTS.includes(x)) : []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const people = useSuggestions(8);
  const next = query.value.get('next');

  const finish = async () => {
    setBusy(true);
    try { await updateMyProfile({ avatar, bio: bio.trim(), city, interests, onboardingDone: true }); }
    catch { toast.error(t('common.error')); }
    setBusy(false);
    navigate(next && next.startsWith('/') ? next : '/', { replace: true });
  };

  return (
    <div class="onboarding">
      <header class="onboarding-top"><Logo size={34} /><button type="button" class="link" onClick={finish}>{t('onboarding.skip')}</button></header>
      <div class="onboarding-card card">
        <div class="onboarding-steps" aria-label={t('onboarding.step', { n: step + 1, total: 3 })}>{[0, 1, 2].map((i) => <span key={i} class={i <= step ? 'is-on' : ''} />)}</div>
        {step === 0 && (
          <section class="stack">
            <h1 class="auth-title">{t('onboarding.welcome', { name: (p?.name || '').split(' ')[0] })}</h1>
            <p class="muted">{t('onboarding.profileText')}</p>
            <label class="onboarding-avatar">
              {uploading ? <Spinner size={32} /> : <Avatar src={avatar} name={p?.name || ''} size={120} />}
              <span class="onboarding-avatar-btn"><Icon name="camera" size={18} />{t('profile.changePhoto')}</span>
              <input type="file" accept="image/*" hidden onChange={(e) => {
                const f = e.currentTarget.files[0];
                if (!f) return;
                setUploading(true);
                upload(f, { folder: 'avatars' }).then(setAvatar).catch(() => toast.error(t('upload.failed'))).finally(() => setUploading(false));
              }} />
            </label>
            <TextArea label={t('profile.bio')} value={bio} onInput={(e) => setBio(e.currentTarget.value)} maxLength={300} minRows={2} placeholder={t('onboarding.bioPlaceholder')} />
            <Select label={t('common.city')} value={city} onChange={(e) => setCity(e.currentTarget.value)} options={cityOptions()} placeholder={t('auth.chooseCity')} />
            <Button variant="primary" size="lg" block onClick={() => setStep(1)} disabled={uploading}>{t('common.next')}</Button>
          </section>
        )}
        {step === 1 && (
          <section class="stack">
            <h1 class="auth-title">{t('onboarding.interestsTitle')}</h1>
            <p class="muted">{t('onboarding.interestsText')}</p>
            <div class="interest-grid">
              {INTERESTS.map((k) => {
                const on = interests.includes(k);
                return <button key={k} type="button" class={`interest${on ? ' is-on' : ''}`} aria-pressed={on ? 'true' : 'false'} onClick={() => setInterests(on ? interests.filter((x) => x !== k) : [...interests, k])}>{t(`interest.${k}`)}{on && <Icon name="check" size={16} />}</button>;
              })}
            </div>
            <div class="row gap-8"><Button variant="secondary" size="lg" onClick={() => setStep(0)}>{t('common.back')}</Button><Button variant="primary" size="lg" block onClick={() => setStep(2)}>{t('common.next')}</Button></div>
          </section>
        )}
        {step === 2 && (
          <section class="stack">
            <h1 class="auth-title">{t('onboarding.peopleTitle')}</h1>
            <p class="muted">{t('onboarding.peopleText')}</p>
            <div class="onboarding-people">
              {people === null && <Spinner />}
              {people?.map((u) => (
                <div key={u.id} class="picker-row">
                  <Avatar src={u.avatar} name={u.name} size={44} />
                  <span class="picker-text grow"><strong>{u.name}</strong>{u.city && <span class="muted small">{u.city}</span>}</span>
                  <FriendButton userId={u.id} size="sm" />
                </div>
              ))}
              {people && !people.length && <p class="muted small">{t('friends.noSuggestions')}</p>}
            </div>
            <div class="row gap-8"><Button variant="secondary" size="lg" onClick={() => setStep(1)}>{t('common.back')}</Button><Button variant="primary" size="lg" block loading={busy} onClick={finish}>{t('onboarding.finish')}</Button></div>
          </section>
        )}
      </div>
    </div>
  );
}
