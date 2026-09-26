import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Spinner } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle, useAsync } from '../lib/hooks.js';
import { uid, signedIn, authReady } from '../lib/auth.js';
import { findInviter, rememberInvite, ensureMyCode } from '../data/referrals.js';
import { AuthLayout } from '../features/auth/AuthLayout.jsx';
import { copyLink } from '../features/post/ShareDialog.jsx';

function MyInvite() {
  const [code, setCode] = useState('');
  useEffect(() => { ensureMyCode().then((c) => setCode(c || '')); }, [uid.value]);
  const link = code ? `${location.origin}/invite/${code}` : '';
  return (
    <div class="invite-own">
      <span class="auth-sent-icon"><Icon name="gift" size={40} /></span>
      <h1 class="auth-title">{t('invite.ownTitle')}</h1>
      <p class="muted">{t('invite.ownText')}</p>
      <div class="invite-link"><code>{link || '…'}</code></div>
      <Button variant="primary" size="lg" block icon="copy" disabled={!link} onClick={() => copyLink(link)}>{t('common.copyLink')}</Button>
      {typeof navigator.share === 'function' && link && (
        <Button variant="secondary" size="lg" block icon="share-network" onClick={() => navigator.share({ title: 'GeoHub', text: t('invite.shareText'), url: link }).catch(() => {})}>{t('common.share')}</Button>
      )}
      <a href="/" class="link">{t('nav.home')}</a>
    </div>
  );
}

export default function Invite({ params }) {
  useTitle(t('invite.title'));
  const code = params.code || '';
  const { data: inviter, loading } = useAsync(() => (code ? findInviter(code) : Promise.resolve(null)), [code]);
  useEffect(() => { if (code && inviter && inviter.id !== uid.value) rememberInvite(code); }, [code, inviter]);

  if (!authReady.value || loading) return <AuthLayout><div class="center-pad"><Spinner /></div></AuthLayout>;
  if (signedIn.value && (!code || inviter?.id === uid.value || !inviter)) return <AuthLayout><MyInvite /></AuthLayout>;
  return (
    <AuthLayout>
      <div class="invite-card">
        {inviter ? (
          <>
            <Avatar src={inviter.avatar} name={inviter.name} size={96} />
            <h1 class="auth-title">{t('invite.fromTitle', { name: inviter.name })}</h1>
          </>
        ) : <h1 class="auth-title">{t('invite.genericTitle')}</h1>}
        <p class="muted">{t('invite.text')}</p>
        {signedIn.value ? (
          <Button variant="primary" size="lg" block href={inviter ? `/u/${inviter.id}` : '/'}>{inviter ? t('invite.viewProfile') : t('nav.home')}</Button>
        ) : (
          <>
            <Button variant="primary" size="lg" block href="/signup">{t('auth.createAccount')}</Button>
            <Button variant="secondary" size="lg" block href="/login">{t('auth.signIn')}</Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
