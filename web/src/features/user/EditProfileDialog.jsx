import { useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Img, Spinner } from '../../ui/misc.jsx';
import { TextField, TextArea, Select } from '../../ui/Field.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { upload } from '../../lib/media.js';
import { cityOptions } from '../../lib/geo.js';
import { updateMyProfile, changeUsername } from '../../data/users.js';

/** Edit own profile: photos, name, bio and details. */
export function EditProfileDialog({ user, onClose }) {
  const r = user.raw;
  const [f, setF] = useState({
    fullName: user.name, username: user.username, bio: user.bio, city: r.city === 'all_georgia' ? '' : (r.city || ''),
    website: user.website, work: r.work || '', education: r.education || '',
    instagram: user.socialLinks?.instagram || '', facebook: user.socialLinks?.facebook || '', tiktok: user.socialLinks?.tiktok || '',
    avatar: user.avatar, coverImage: user.cover,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const pick = (field) => (e) => {
    const file = e.currentTarget.files[0];
    e.currentTarget.value = '';
    if (!file) return;
    setUploading(field);
    upload(file, { folder: field === 'avatar' ? 'avatars' : 'covers' })
      .then((url) => setF((x) => ({ ...x, [field]: url })))
      .catch((err) => toast.error(t(err.code === 'too-large' ? 'upload.tooLarge' : 'upload.failed')))
      .finally(() => setUploading(''));
  };
  const save = async () => {
    if (!f.fullName.trim()) { toast.error(t('auth.err.fillAll')); return; }
    setBusy(true);
    try {
      if ((f.username || '') !== (user.username || '') && f.username) await changeUsername(f.username, user.username);
      await updateMyProfile({
        fullName: f.fullName.trim(), bio: f.bio.trim().slice(0, 300), city: f.city, website: f.website.trim(),
        work: f.work.trim(), education: f.education.trim(), avatar: f.avatar || '', coverImage: f.coverImage || '',
        socialLinks: { ...(user.socialLinks || {}), instagram: f.instagram.trim(), facebook: f.facebook.trim(), tiktok: f.tiktok.trim() },
      });
      toast.success(t('common.saved'));
      onClose();
    } catch (e) {
      toast.error(t(e.code === 'username-taken' ? 'auth.err.usernameTaken' : e.code === 'username-invalid' ? 'auth.usernameHint' : 'common.error'));
    }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} title={t('profile.edit')} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} loading={busy} disabled={!!uploading}>{t('common.save')}</Button></>}>
      <div class="edit-profile">
        <section class="edit-section">
          <div class="edit-section-head"><h3>{t('profile.photo')}</h3><label class="link">{t('common.edit')}<input type="file" accept="image/*" hidden onChange={pick('avatar')} /></label></div>
          <div class="edit-avatar">{uploading === 'avatar' ? <Spinner size={32} /> : <Avatar src={f.avatar} name={f.fullName} size={128} />}</div>
        </section>
        <section class="edit-section">
          <div class="edit-section-head"><h3>{t('profile.cover')}</h3><label class="link">{t('common.edit')}<input type="file" accept="image/*" hidden onChange={pick('coverImage')} /></label></div>
          <div class="edit-cover">{uploading === 'coverImage' ? <Spinner size={32} /> : f.coverImage ? <Img src={f.coverImage} width={600} alt="" /> : <div class="profile-cover-empty" />}</div>
        </section>
        <section class="edit-section stack">
          <TextField label={t('auth.fullName')} value={f.fullName} onInput={set('fullName')} maxLength={60} />
          <TextField label={t('auth.username')} icon="at" value={f.username} onInput={(e) => setF({ ...f, username: e.currentTarget.value.toLowerCase().replace(/\s/g, '') })} maxLength={24} hint={t('auth.usernameHint')} />
          <TextArea label={t('profile.bio')} value={f.bio} onInput={set('bio')} maxLength={300} showCount minRows={3} />
          <Select label={t('common.city')} value={f.city} onChange={set('city')} options={cityOptions()} placeholder={t('auth.chooseCity')} />
          <TextField label={t('profile.work')} icon="briefcase" value={f.work} onInput={set('work')} maxLength={80} />
          <TextField label={t('profile.education')} icon="graduation-cap" value={f.education} onInput={set('education')} maxLength={80} />
          <TextField label={t('common.website')} icon="link" value={f.website} onInput={set('website')} maxLength={120} placeholder="example.ge" />
          <TextField label="Instagram" icon="instagram-logo" value={f.instagram} onInput={set('instagram')} maxLength={80} placeholder="@username" />
          <TextField label="Facebook" icon="facebook-logo" value={f.facebook} onInput={set('facebook')} maxLength={120} />
          <TextField label="TikTok" icon="tiktok-logo" value={f.tiktok} onInput={set('tiktok')} maxLength={80} placeholder="@username" />
        </section>
      </div>
    </Modal>
  );
}
