import { Logo, LogoMark } from '../../shell/Logo.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { t, lang, setLang, LANGS } from '../../lib/i18n.js';

const FEATURES = [
  { icon: 'users-three', key: 'auth.feat.people' },
  { icon: 'map-trifold', key: 'auth.feat.places' },
  { icon: 'calendar-blank', key: 'auth.feat.events' },
  { icon: 'storefront', key: 'auth.feat.business' },
];

/** Split layout for sign-in, sign-up and invites. */
export function AuthLayout({ children }) {
  return (
    <div class="auth">
      <section class="auth-hero" aria-hidden="true">
        <div class="auth-hero-inner">
          <LogoMark size={64} />
          <h1 class="auth-hero-title">{t('auth.heroTitle')}</h1>
          <p class="auth-hero-text">{t('auth.heroText')}</p>
          <ul class="auth-feats">
            {FEATURES.map((f) => <li key={f.key}><span><Icon name={f.icon} size={22} /></span>{t(f.key)}</li>)}
          </ul>
        </div>
        <div class="auth-orbs"><i /><i /><i /></div>
      </section>
      <section class="auth-main">
        <div class="auth-top">
          <Logo size={36} />
          <div class="auth-langs" role="group" aria-label={t('settings.language')}>
            {LANGS.map((l) => <button key={l.code} type="button" class={lang.value === l.code ? 'is-active' : ''} onClick={() => setLang(l.code)}>{l.code.toUpperCase()}</button>)}
          </div>
        </div>
        <div class="auth-card">{children}</div>
        <footer class="auth-foot">
          <a href="/about">{t('nav.about')}</a> · <a href="/privacy">{t('nav.privacy')}</a> · <a href="/terms">{t('nav.terms')}</a> · <a href="/">{t('auth.browse')}</a>
        </footer>
      </section>
    </div>
  );
}

export function SocialButtons({ onGoogle, onFacebook, busy }) {
  return (
    <div class="auth-social">
      <button type="button" class="btn btn-outline btn-lg btn-block" onClick={onGoogle} disabled={!!busy}>
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        <span class="btn-label">{t('auth.withGoogle')}</span>
      </button>
      <button type="button" class="btn btn-outline btn-lg btn-block" onClick={onFacebook} disabled={!!busy}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>
        <span class="btn-label">{t('auth.withFacebook')}</span>
      </button>
    </div>
  );
}
