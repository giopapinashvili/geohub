import { useEffect, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { TextField } from '../ui/Field.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Icon } from '../ui/Icon.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { navigate, query } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { signIn, signInWithGoogle, signInWithFacebook, resetPassword, resendVerification, authErrorKey, signedIn, profile } from '../lib/auth.js';
import { AuthLayout, SocialButtons } from '../features/auth/AuthLayout.jsx';

/** Where to go after signing in: ?next=…, onboarding for fresh accounts, or home. */
export function afterAuthTarget() {
  const next = query.value.get('next');
  const p = profile.value;
  if (p && !p.raw.onboardingDone && p.createdAt && Date.now() - p.createdAt < 2 * 86400000) return `/onboarding${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function ResetDialog({ initial, onClose }) {
  const [email, setEmail] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await resetPassword(email); setSent(true); } catch (err) { toast.error(t(authErrorKey(err))); }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} title={t('auth.resetTitle')} size="sm">
      {sent ? (
        <div class="auth-sent"><Icon name="envelope" size={36} /><p>{t('auth.resetSent')}</p><Button variant="primary" block onClick={onClose}>{t('common.done')}</Button></div>
      ) : (
        <form onSubmit={submit} class="stack">
          <p class="muted">{t('auth.resetText')}</p>
          <TextField label={t('auth.email')} type="email" autoComplete="email" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
          <Button type="submit" variant="primary" block loading={busy}>{t('auth.resetSend')}</Button>
        </form>
      )}
    </Modal>
  );
}

export default function Login() {
  useTitle(t('auth.signIn'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [reset, setReset] = useState(false);

  // Already signed in (or just finished): leave the page.
  useEffect(() => { if (signedIn.value && profile.value) navigate(afterAuthTarget(), { replace: true }); }, [signedIn.value, profile.value]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError(t('auth.err.fillAll')); return; }
    setBusy('email'); setError(''); setUnverified(false);
    try { await signIn(email, password); }
    catch (err) {
      setError(t(authErrorKey(err)));
      if (err.code === 'auth/email-not-verified') setUnverified(true);
    }
    setBusy('');
  };
  const social = (fn, key) => async () => {
    setBusy(key); setError('');
    try { await fn(); } catch (err) { if (err.code !== 'auth/popup-closed-by-user') setError(t(authErrorKey(err))); }
    setBusy('');
  };
  const resend = async () => {
    try { const r = await resendVerification(email, password); toast.success(t(r.alreadyVerified ? 'auth.alreadyVerified' : 'auth.resent')); }
    catch (err) { toast.error(t(authErrorKey(err))); }
  };

  return (
    <AuthLayout>
      <h1 class="auth-title">{t('auth.welcomeBack')}</h1>
      <p class="auth-sub">{t('auth.signInSub')}</p>
      <form class="auth-form" onSubmit={submit} noValidate>
        <TextField label={t('auth.email')} type="email" autoComplete="email" icon="envelope" value={email} onInput={(e) => setEmail(e.currentTarget.value)} required autoFocus />
        <div class="field">
          <div class="field-label-row">
            <label class="field-label" for="login-pass">{t('auth.password')}</label>
            <button type="button" class="link small" onClick={() => setReset(true)}>{t('auth.forgot')}</button>
          </div>
          <div class="input-wrap has-icon">
            <Icon name="lock" size={18} class="input-icon" />
            <input id="login-pass" class="input input-pass" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onInput={(e) => setPassword(e.currentTarget.value)} required />
            <button type="button" class="pass-toggle" onClick={() => setShow((s) => !s)} aria-label={t(show ? 'auth.hidePassword' : 'auth.showPassword')}><Icon name={show ? 'eye-slash' : 'eye'} size={18} /></button>
          </div>
        </div>
        {error && <p class="auth-error" role="alert"><Icon name="warning" size={18} />{error}</p>}
        {unverified && <button type="button" class="link" onClick={resend}>{t('auth.resend')}</button>}
        <Button type="submit" variant="primary" size="lg" block loading={busy === 'email'}>{t('auth.signIn')}</Button>
      </form>
      <div class="auth-divider"><span>{t('common.or')}</span></div>
      <SocialButtons busy={busy} onGoogle={social(signInWithGoogle, 'google')} onFacebook={social(signInWithFacebook, 'facebook')} />
      <p class="auth-switch">{t('auth.noAccount')} <a href={`/signup${location.search}`} class="link">{t('auth.signUp')}</a></p>
      {reset && <ResetDialog initial={email} onClose={() => setReset(false)} />}
    </AuthLayout>
  );
}
