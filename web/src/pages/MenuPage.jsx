import { Avatar } from '../ui/Avatar.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { profile, signedIn, isAdmin, signOut } from '../lib/auth.js';
import { navigate } from '../lib/router.js';
import { SECTIONS, FOOTER_LINKS } from '../shell/nav.js';
import { ThemeLangControls, Switcher } from '../shell/AccountMenu.jsx';

/** Mobile "Menu" tab: every section, account and preferences. */
export default function MenuPage() {
  useTitle(t('nav.menu'));
  const p = profile.value;
  const items = SECTIONS.filter((s) => !s.auth || signedIn.value);
  return (
    <div class="menu-page page-pad">
      <h1 class="page-title">{t('nav.menu')}</h1>
      {signedIn.value && p ? (
        <a href="/u/me" class="card menu-profile">
          <Avatar src={p.avatar} name={p.name} size={52} />
          <span class="menu-profile-text"><strong>{p.name}</strong><span class="muted small">{t('nav.viewProfile')}</span></span>
          <Icon name="caret-right" size={20} />
        </a>
      ) : (
        <Card class="menu-guest">
          <strong>{t('home.joinTitle')}</strong>
          <p class="muted small">{t('home.joinText')}</p>
          <div class="row gap-8"><Button variant="primary" href="/signup">{t('auth.signUp')}</Button><Button variant="secondary" href="/login">{t('auth.signIn')}</Button></div>
        </Card>
      )}
      {signedIn.value && <Card class="menu-switcher"><Switcher /></Card>}
      <div class="menu-grid">
        {items.map((s) => (
          <a key={s.key} href={s.href} class="card menu-tile">
            <span class="side-icon" style={{ '--tone': s.tone }}><Icon name={s.icon} size={20} /></span>
            <span>{t(s.label)}</span>
          </a>
        ))}
      </div>
      <Card class="menu-list">
        {signedIn.value && <a href="/settings" class="menu-item"><span class="menu-icon"><Icon name="gear" size={20} /></span><span class="menu-label">{t('nav.settings')}</span></a>}
        {signedIn.value && <a href="/notifications" class="menu-item"><span class="menu-icon"><Icon name="bell" size={20} /></span><span class="menu-label">{t('nav.notifications')}</span></a>}
        {isAdmin.value && <a href="/admin" class="menu-item"><span class="menu-icon"><Icon name="shield-check" size={20} /></span><span class="menu-label">{t('nav.admin')}</span></a>}
        <a href="/about?tab=help" class="menu-item"><span class="menu-icon"><Icon name="question" size={20} /></span><span class="menu-label">{t('nav.help')}</span></a>
      </Card>
      <Card><ThemeLangControls /></Card>
      {signedIn.value && <Button variant="secondary" block icon="sign-out" onClick={async () => { await signOut(); navigate('/'); }}>{t('auth.signOut')}</Button>}
      <footer class="side-footer center">
        {FOOTER_LINKS.map((l, i) => <span key={l.href}>{i > 0 && ' · '}<a href={l.href}>{t(l.label)}</a></span>)}
        <div>GeoHub © {new Date().getFullYear()}</div>
      </footer>
    </div>
  );
}
