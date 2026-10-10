import { useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { TextField, TextArea, Select } from '../ui/Field.jsx';
import { Card } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { query } from '../lib/router.js';
import { signedIn, authUser, profile } from '../lib/auth.js';
import { sendTicket, TICKET_CATEGORIES } from '../data/support.js';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Help & support: a form that lands in the admin panel. Works signed out too. */
export default function Support() {
  useTitle(t('support.title'));
  const preset = query.value.get('topic');
  const [f, setF] = useState({
    category: TICKET_CATEGORIES.includes(preset) ? preset : 'help',
    name: profile.value?.name || '',
    email: authUser.value?.email || '',
    subject: '',
    message: '',
    website: '', // honeypot — people never see it, bots fill it
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.website) { setSent(true); return; }
    if (!signedIn.value && !EMAIL.test(f.email.trim())) { setErr(t('support.err.email')); return; }
    if (f.message.trim().length < 10) { setErr(t('support.err.message')); return; }
    setBusy(true);
    try {
      await sendTicket({ category: f.category, name: f.name, email: f.email, subject: f.subject, message: f.message });
      setSent(true);
    } catch {
      setErr(t('support.err.send'));
    }
    setBusy(false);
  };

  if (sent) {
    return (
      <div class="page-pad narrow">
        <Card class="center">
          <span class="auth-sent-icon"><Icon name="check-circle" size={40} /></span>
          <h1 class="page-title">{t('support.sentTitle')}</h1>
          <p class="muted">{t('support.sentText')}</p>
          <div class="row gap-8 wrap" style={{ justifyContent: 'center', marginTop: 16 }}>
            <Button variant="primary" href="/">{t('nav.home')}</Button>
            <Button variant="secondary" onClick={() => { setSent(false); setF({ ...f, subject: '', message: '' }); }}>{t('support.another')}</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div class="page-pad narrow">
      <Card>
        <h1 class="page-title">{t('support.title')}</h1>
        <p class="muted">{t('support.intro')}</p>
        <form class="stack" onSubmit={submit} noValidate style={{ marginTop: 16 }}>
          <Select label={t('support.category')} value={f.category} onChange={set('category')}
            options={TICKET_CATEGORIES.map((c) => ({ value: c, label: t(`support.cat.${c}`) }))} />
          {!signedIn.value && (
            <>
              <TextField label={t('support.name')} value={f.name} onInput={set('name')} maxLength={120} autoComplete="name" optional />
              <TextField label={t('auth.email')} type="email" value={f.email} onInput={set('email')} maxLength={200} autoComplete="email" hint={t('support.emailHint')} />
            </>
          )}
          <TextField label={t('support.subject')} value={f.subject} onInput={set('subject')} maxLength={200} optional />
          <TextArea label={t('support.message')} value={f.message} onInput={set('message')} maxLength={4000} showCount minRows={5} placeholder={t('support.messagePh')} />
          <input type="text" name="website" value={f.website} onInput={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" class="sr-only" />
          {err && <p class="auth-error" role="alert"><Icon name="warning" size={18} />{err}</p>}
          <Button type="submit" variant="primary" icon="paper-plane-tilt" loading={busy}>{t('support.send')}</Button>
          <p class="muted small">{t('support.reportHint')}</p>
        </form>
      </Card>
    </div>
  );
}
