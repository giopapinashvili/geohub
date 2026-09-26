import { useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Select, Switch } from '../ui/Field.jsx';
import { Card, Empty } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { navigate } from '../lib/router.js';
import { profile, authUser, resetPassword, signOut } from '../lib/auth.js';
import { safety } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { updatePrivacy, unblockUser, unmuteUser } from '../data/social.js';
import { pushSupported, pushState, enablePush } from '../data/push.js';
import { useUser } from '../features/user/useUser.js';
import { EditProfileDialog } from '../features/user/EditProfileDialog.jsx';
import { ThemeLangControls } from '../shell/AccountMenu.jsx';

const SECTIONS = [
  { id: 'profile', icon: 'user-circle' }, { id: 'privacy', icon: 'lock' }, { id: 'blocked', icon: 'prohibit' },
  { id: 'notifications', icon: 'bell' }, { id: 'appearance', icon: 'palette' }, { id: 'account', icon: 'gear' },
];
const PREFS = [['messagingPref', ['everyone', 'friends', 'nobody']], ['friendRequestPref', ['everyone', 'friendsOfFriends', 'nobody']], ['followPref', ['everyone', 'friends', 'nobody']]];

function Person({ id, action }) {
  const u = useUser(id);
  return <div class="visitor"><Avatar src={u?.avatar} name={u?.name || ''} size={40} href={`/u/${id}`} /><span class="grow bold ellipsis">{u?.name || '…'}</span>{action}</div>;
}

function Privacy() {
  const [p, setP] = useState(() => ({ messagingPref: 'everyone', friendRequestPref: 'everyone', followPref: 'everyone', ...(profile.value?.privacy || {}) }));
  const save = async (k, v) => {
    const next = { ...p, [k]: v };
    setP(next);
    try { await updatePrivacy(next); toast.success(t('settings.saved')); } catch { toast.error(t('common.error')); }
  };
  return <Card><div class="stack">{PREFS.map(([k, opts]) => <Select key={k} label={t(`settings.${k}`)} value={p[k]} onChange={(e) => save(k, e.currentTarget.value)} options={opts.map((o) => ({ value: o, label: t(`settings.opt.${o}`) }))} />)}</div></Card>;
}

function Blocked() {
  const s = safety.value;
  const ids = [...[...s.blocked].map((id) => ['block', id]), ...[...s.muted].filter((id) => !s.blocked.has(id)).map((id) => ['mute', id])];
  if (!ids.length) return <Card><Empty compact icon="prohibit" title={t('settings.noBlocked')} /></Card>;
  return (
    <Card><div class="visitor-list">{ids.map(([kind, id]) => (
      <Person key={kind + id} id={id} action={<Button size="sm" variant="secondary" onClick={() => (kind === 'block' ? unblockUser(id) : unmuteUser(id)).then(() => toast(t('settings.undone'))).catch(() => toast.error(t('common.error')))}>{t(kind === 'block' ? 'settings.unblock' : 'settings.unmute')}</Button>} />
    ))}</div></Card>
  );
}

function Notifications() {
  const [state, setState] = useState(pushState());
  if (!pushSupported()) return <Card><Empty compact icon="bell-slash" title={t('settings.pushUnsupported')} /></Card>;
  return (
    <Card>
      <Switch checked={state === 'granted'} disabled={state === 'denied'} label={t('settings.push')} description={t(state === 'denied' ? 'settings.pushDenied' : 'settings.pushHint')}
        onChange={async (on) => { if (!on) { toast(t('settings.pushOffHint')); return; } const ok = await enablePush(); setState(pushState()); toast[ok ? 'success' : 'error'](t(ok ? 'settings.pushOn' : 'settings.pushFailed')); }} />
    </Card>
  );
}

function Account() {
  const email = authUser.value?.email;
  return (
    <Card><div class="stack">
      {email && <div><span class="field-label">{t('biz.email')}</span><p>{email}</p></div>}
      {email && <Button variant="secondary" icon="key" onClick={() => resetPassword(email).then(() => toast.success(t('settings.resetSent'))).catch(() => toast.error(t('common.error')))}>{t('settings.resetPassword')}</Button>}
      <Button variant="danger" icon="sign-out" onClick={() => signOut().then(() => navigate('/'))}>{t('settings.signOut')}</Button>
      <p class="muted small">{t('settings.deleteHint')}</p>
    </div></Card>
  );
}

/** Settings: profile, privacy, blocked people, notifications, appearance, account. */
export default function Settings({ params }) {
  const section = SECTIONS.some((s) => s.id === params.section) ? params.section : 'profile';
  const [editing, setEditing] = useState(false);
  useTitle(t('nav.settings'));
  const p = profile.value;
  return (
    <div class="page-pad settings">
      <h1 class="page-title">{t('nav.settings')}</h1>
      <div class="settings-grid">
        <nav class="settings-nav card" aria-label={t('nav.settings')}>
          {SECTIONS.map((s) => <a key={s.id} href={`/settings/${s.id}`} class={`side-item${s.id === section ? ' is-active' : ''}`}><Icon name={s.icon} size={20} />{t(`settings.${s.id}`)}</a>)}
        </nav>
        <div class="settings-body">
          <h2 class="section-title">{t(`settings.${section}`)}</h2>
          {section === 'profile' && (
            <Card><div class="visitor"><Avatar src={p?.avatar} name={p?.name || ''} size={56} /><span class="grow"><strong>{p?.name}</strong><span class="muted small" style={{ display: 'block' }}>{p?.username ? `@${p.username}` : ''}</span></span><Button variant="secondary" icon="pencil-simple" onClick={() => setEditing(true)}>{t('common.edit')}</Button></div></Card>
          )}
          {section === 'privacy' && <Privacy />}
          {section === 'blocked' && <Blocked />}
          {section === 'notifications' && <Notifications />}
          {section === 'appearance' && <Card><ThemeLangControls /></Card>}
          {section === 'account' && <Account />}
        </div>
      </div>
      {editing && p && <EditProfileDialog user={p} onClose={() => setEditing(false)} />}
    </div>
  );
}
