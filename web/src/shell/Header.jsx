import { Logo } from './Logo.jsx';
import { SearchBox } from './SearchBox.jsx';
import { PRIMARY } from './nav.js';
import { Icon } from '../ui/Icon.jsx';
import { IconButton, Button } from '../ui/Button.jsx';
import { t } from '../lib/i18n.js';
import { signedIn, authReady } from '../lib/auth.js';
import { unreadMessages, unreadNotifications, createMenu } from '../lib/store.js';
import { AccountMenu } from './AccountMenu.jsx';
import { NotificationsPopover, MessagesPopover } from './Popovers.jsx';

export function Header({ active }) {
  return (
    <header class="header">
      <div class="header-left">
        <Logo size={40} word={false} />
        <SearchBox />
      </div>
      <nav class="header-center" aria-label={t('nav.primary')}>
        {PRIMARY.map((it) => {
          const on = active === it.key;
          return (
            <a key={it.key} href={it.href} class={`header-tab${on ? ' is-active' : ''}`} aria-current={on ? 'page' : undefined} title={t(it.label)}>
              <Icon name={on ? it.iconActive : it.icon} size={26} />
              <span class="sr-only">{t(it.label)}</span>
            </a>
          );
        })}
      </nav>
      <div class="header-right">
        {authReady.value && !signedIn.value && (
          <>
            <Button variant="ghost" href="/login">{t('auth.signIn')}</Button>
            <Button variant="primary" href="/signup">{t('auth.signUp')}</Button>
          </>
        )}
        {signedIn.value && (
          <>
            <IconButton icon="plus" label={t('nav.create')} variant="soft" size={40} onClick={() => { createMenu.value = true; }} />
            <MessagesPopover trigger={(p, open) => (
              <IconButton {...p} icon="chat-circle-dots" label={t('nav.messages')} variant="soft" size={40} badge={unreadMessages.value} active={open || active === 'messages'} />
            )} />
            <NotificationsPopover trigger={(p, open) => (
              <IconButton {...p} icon="bell" label={t('nav.notifications')} variant="soft" size={40} badge={unreadNotifications.value} active={open || active === 'notifications'} />
            )} />
            <AccountMenu />
          </>
        )}
      </div>
    </header>
  );
}
