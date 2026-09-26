import { useState } from 'preact/hooks';
import { Popover } from '../ui/Menu.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Segmented } from '../ui/Field.jsx';
import { t, lang, setLang, LANGS } from '../lib/i18n.js';
import { themePref, setTheme } from '../lib/theme.js';
import { profile, authUser, isAdmin, signOut } from '../lib/auth.js';
import { navigate } from '../lib/router.js';

export function ThemeLangControls() {
  return (
    <div class="acct-prefs">
      <div class="acct-pref">
        <span class="acct-pref-label"><Icon name="moon" size={18} />{t('settings.theme')}</span>
        <Segmented size="sm" label={t('settings.theme')} value={themePref.value} onChange={setTheme} options={[
          { value: 'light', label: t('settings.themeLight'), icon: 'sun' },
          { value: 'dark', label: t('settings.themeDark'), icon: 'moon' },
          { value: 'system', label: t('settings.themeAuto'), icon: 'desktop' },
        ]} />
      </div>
      <div class="acct-pref">
        <span class="acct-pref-label"><Icon name="translate" size={18} />{t('settings.language')}</span>
        <Segmented size="sm" label={t('settings.language')} value={lang.value} onChange={setLang} options={LANGS.map((l) => ({ value: l.code, label: l.label }))} />
      </div>
    </div>
  );
}

export function AccountMenu() {
  const p = profile.value;
  const u = authUser.value;
  const [busy, setBusy] = useState(false);
  const name = p?.name || u?.displayName || '';
  return (
    <Popover width={340} label={t('nav.account')} trigger={(props, open) => (
      <button type="button" {...props} class={`acct-trigger${open ? ' is-open' : ''}`} aria-label={t('nav.account')}>
        <Avatar src={p?.avatar || u?.photoURL} name={name} size={40} />
      </button>
    )}>
      {(close) => (
        <div class="acct-menu">
          <a href="/u/me" class="acct-card" onClick={close}>
            <Avatar src={p?.avatar || u?.photoURL} name={name} size={48} />
            <span class="acct-card-text">
              <strong>{name}</strong>
              <span>{t('nav.viewProfile')}</span>
            </span>
          </a>
          <div class="menu">
            <a class="menu-item" href="/settings" onClick={close}><span class="menu-icon"><Icon name="gear" size={20} /></span><span class="menu-label">{t('nav.settings')}</span></a>
            <a class="menu-item" href="/business" onClick={close}><span class="menu-icon"><Icon name="briefcase" size={20} /></span><span class="menu-label">{t('nav.myPages')}</span></a>
            <a class="menu-item" href="/rewards" onClick={close}><span class="menu-icon"><Icon name="coins" size={20} /></span><span class="menu-text"><span class="menu-label">{t('nav.rewards')}</span><span class="menu-sub">{t('rewards.balanceShort', { n: p?.points || 0 })}</span></span></a>
            {isAdmin.value && <a class="menu-item" href="/admin" onClick={close}><span class="menu-icon"><Icon name="shield-check" size={20} /></span><span class="menu-label">{t('nav.admin')}</span></a>}
            <a class="menu-item" href="/about?tab=help" onClick={close}><span class="menu-icon"><Icon name="question" size={20} /></span><span class="menu-label">{t('nav.help')}</span></a>
          </div>
          <div class="menu-divider" />
          <ThemeLangControls />
          <div class="menu-divider" />
          <button type="button" class="menu-item" disabled={busy} onClick={async () => { setBusy(true); await signOut(); close(); setBusy(false); navigate('/'); }}>
            <span class="menu-icon"><Icon name="sign-out" size={20} /></span><span class="menu-label">{t('auth.signOut')}</span>
          </button>
        </div>
      )}
    </Popover>
  );
}
