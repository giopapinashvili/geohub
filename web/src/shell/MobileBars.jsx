import { useEffect, useState } from 'preact/hooks';
import { Logo } from './Logo.jsx';
import { MOBILE_TABS } from './nav.js';
import { Icon } from '../ui/Icon.jsx';
import { IconButton } from '../ui/Button.jsx';
import { actor } from '../lib/actor.js';
import { Avatar } from '../ui/Avatar.jsx';
import { t } from '../lib/i18n.js';
import { signedIn, profile, authReady } from '../lib/auth.js';
import { unreadMessages, unreadNotifications, createMenu, requireLogin } from '../lib/store.js';

/** Hides the top bar while scrolling down, shows it again on scroll up. */
function useAutoHide() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 80) setHidden(false);
        else if (y > last + 8) setHidden(true);
        else if (y < last - 8) setHidden(false);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return hidden;
}

export function TopBar({ active, hidden }) {
  const autoHidden = useAutoHide();
  if (hidden) return null;
  return (
    <header class={`topbar${autoHidden ? ' is-hidden' : ''}`}>
      <Logo size={32} />
      <div class="topbar-actions">
        <IconButton icon="magnifying-glass" label={t('nav.search')} href="/search" variant="soft" size={38} class="hdr-search" active={active === 'explore'} />
        {signedIn.value ? (
          <>
            <IconButton icon="bell" label={t('nav.notifications')} href="/notifications" variant="soft" size={38} class="hdr-bell" badge={unreadNotifications.value} active={active === 'notifications'} />
            <IconButton icon="chat-circle-dots" label={t('nav.messages')} href="/messages" variant="soft" size={38} class="hdr-msg" badge={unreadMessages.value} active={active === 'messages'} />
          </>
        ) : authReady.value && (
          <a href="/login" class="btn btn-primary btn-sm">{t('auth.signIn')}</a>
        )}
      </div>
    </header>
  );
}

export function BottomNav({ active, immersive }) {
  const p = profile.value;
  return (
    <nav class={`bottomnav${immersive ? ' is-immersive' : ''}`} aria-label={t('nav.primary')}>
      {MOBILE_TABS.map((it) => {
        if (it.key === 'create') {
          return (
            <button key="create" type="button" class="bottomnav-create" aria-label={t('nav.create')}
              onClick={() => { if (requireLogin('post')) createMenu.value = true; }}>
              <span class="bottomnav-create-btn"><Icon name="plus" size={24} /></span>
            </button>
          );
        }
        const on = active === it.key || (it.key === 'menu' && ['menu', 'profile', 'settings', 'friends', 'saved'].includes(active));
        return (
          <a key={it.key} href={it.href} class={`bottomnav-tab${on ? ' is-active' : ''}`} style={{ '--tone': it.tone }} aria-current={on ? 'page' : undefined}>
            {it.key === 'menu' && p
              ? <span class="bottomnav-avatar">{actor.value ? <Avatar src={actor.value.logo} name={actor.value.name} size={26} square /> : <Avatar src={p.avatar} name={p.name} size={26} />}</span>
              : <Icon name={on && it.iconActive ? it.iconActive : it.icon} size={26} />}
            <span class="bottomnav-label">{t(it.label)}</span>
          </a>
        );
      })}
    </nav>
  );
}
