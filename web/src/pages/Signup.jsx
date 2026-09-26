import { useEffect, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { TextField, Select } from '../ui/Field.jsx';
import { Icon } from '../ui/Icon.jsx';
import { t } from '../lib/i18n.js';
import { useTitle, useDebounced } from '../lib/hooks.js';
import { navigate } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { cityOptions } from '../lib/geo.js';
import { signUp, signInWithGoogle, signInWithFacebook, isUsernameAvailable, authErrorKey, signedIn, profile } from '../lib/auth.js';
import { AuthLayout, SocialButtons } from '../features/auth/AuthLayout.jsx';
import { afterAuthTarget } from './Login.jsx';

const USERNAME = /^[a-z0-9_.]{3,24}$/;

export default function Signup() {
  useTitle(t('auth.signUp'));
  const [form, setForm] = useState({ fullName: '', email: '', username: '', password: '', city: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [avail, setAvail] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: k === 'username' ? e.currentTarget.value.toLowerCase().replace(/\s/g, '') : e.currentTarget.value });
  const uname = useDebounced(form.username, 400);

  useEffect(() => { if (signedIn.value && profile.value) navigate(afterAuthTarget(), { replace: true }); }, [signedIn.value, profile.value]);
  useEffect(() => {
    let alive = true;
    if (!USERNAME.test(uname)) { setAvail(null); return undefined; }
    setAvail('checking');
    isUsernameAvailable(uname).then((ok) => alive && setAvail(ok ? 'free' : 'taken'));
    return () => { alive = false; };
  }, [uname]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.fullName.trim() || !form.email.trim() || !form.password) { setError(t('auth.err.fillAll')); return; }
    if (form.password.length < 8) { setError(t('auth.err.weakPassword')); return; }
    if (form.username && !USERNAME.test(form.username)) { setError(t('auth.usernameHint')); return; }
    if (avail === 'taken') { setError(t('auth.err.usernameTaken')); return; }
    setBusy('email');
    try { const r = await signUp({ ...form, fullName: form.fullName.trim() }); setDone(r.email); }
    catch (err) { setError(t(authErrorKey(err))); }
    setBusy('');
  };
  const social = (fn, key) => async () => {
    setBusy(key); setError('');
    try { await fn(); } catch (err) { if (err.code !== 'auth/popup-closed-by-user') setError(t(authErrorKey(err))); }
    setBusy('');
  };

  if (done) {
    return (
      <AuthLayout>
        <div class="auth-sent">
          <span class="auth-sent-icon"><Icon name="envelope" size={40} /></span>
          <h1 class="auth-title">{t('auth.verifyTitle')}</h1>
          <p class="muted">{t('auth.verifyText', { email: done })}</p>
          <Button variant="primary" size="lg" block href="/login">{t('auth.signIn')}</Button>
          <button type="button" class="link" onClick={() => toast(t('auth.resendHint'))}>{t('auth.noEmail')}</button>
        </div>
      </AuthLayout>
    );
  }

  const unameHint = avail === 'free' ? <span class="ok-text">✓ {t('auth.usernameFree')}</span> : avail === 'taken' ? null : t('auth.usernameHint');
  return (
    <AuthLayout>
      <h1 class="auth-title">{t('auth.signUpTitle')}</h1>
      <p class="auth-sub">{t('auth.signUpSub')}</p>
      <SocialButtons busy={busy} onGoogle={social(signInWithGoogle, 'google')} onFacebook={social(signInWithFacebook, 'facebook')} />
      <div class="auth-divider"><span>{t('common.or')}</span></div>
      <form class="auth-form" onSubmit={submit} noValidate>
        <TextField label={t('auth.fullName')} autoComplete="name" value={form.fullName} onInput={set('fullName')} maxLength={60} required />
        <TextField label={t('auth.email')} type="email" autoComplete="email" value={form.email} onInput={set('email')} required />
        <TextField label={t('auth.username')} optional={t('common.optional')} icon="at" autoComplete="username" value={form.username} onInput={set('username')} maxLength={24}
          hint={unameHint} error={avail === 'taken' ? t('auth.err.usernameTaken') : ''} />
        <TextField label={t('auth.password')} type="password" autoComplete="new-password" value={form.password} onInput={set('password')} hint={t('auth.passwordHint')} required minLength={8} />
        <Select label={t('common.city')} optional={t('common.optional')} value={form.city} onChange={set('city')} options={cityOptions()} placeholder={t('auth.chooseCity')} />
        {error && <p class="auth-error" role="alert"><Icon name="warning" size={18} />{error}</p>}
        <p class="auth-legal">{t('auth.agreePrefix')} <a href="/terms" class="link">{t('auth.termsLink')}</a> {t('auth.and')} <a href="/privacy" class="link">{t('auth.privacyLink')}</a>.</p>
        <Button type="submit" variant="primary" size="lg" block loading={busy === 'email'}>{t('auth.signUp')}</Button>
      </form>
      <p class="auth-switch">{t('auth.haveAccount')} <a href={`/login${location.search}`} class="link">{t('auth.signIn')}</a></p>
    </AuthLayout>
  );
}
