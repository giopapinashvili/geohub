import { useEffect, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Card } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { query, setQuery } from '../lib/router.js';
import { authUser, profile } from '../lib/auth.js';
import { requireLogin } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { WORKER_URL } from '../lib/firebase.js';
import { formatDate } from '../lib/format.js';

const PERKS = ['verified', 'noAds', 'stats', 'themes', 'support'];
const ORDER_KEY = 'gh_bog_order';

/** Premium: monthly / yearly via Bank of Georgia checkout (Cloudflare worker). */
export default function Premium() {
  useTitle(t('nav.premium'));
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const p = profile.value;
  const payment = query.value.get('payment');
  useEffect(() => {
    if (payment !== 'success') { if (payment === 'cancel') toast(t('premium.cancelled')); return; }
    let order = '';
    try { order = sessionStorage.getItem(ORDER_KEY) || ''; } catch { /* ignore */ }
    if (!order) { setStatus('completed'); return; }
    setStatus('pending');
    fetch(`${WORKER_URL}/bog-payment-status/${encodeURIComponent(order)}`).then((r) => r.json()).then((d) => setStatus(d.status || 'pending')).catch(() => setStatus('pending'));
  }, [payment]);
  const buy = async (plan) => {
    if (!requireLogin('premium')) return;
    setBusy(plan);
    try {
      const idToken = await authUser.value.getIdToken();
      const res = await fetch(`${WORKER_URL}/create-bog-payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: authUser.value.uid, idToken, plan }) });
      const d = await res.json();
      if (!res.ok || !d.redirectUrl) throw new Error(d.error || 'failed');
      try { sessionStorage.setItem(ORDER_KEY, d.orderId || ''); } catch { /* ignore */ }
      location.href = d.redirectUrl;
    } catch { toast.error(t('premium.failed')); setBusy(''); }
  };
  return (
    <div class="page-pad biz-hub">
      <section class="premium-hero">
        <Icon name="crown-fill" size={44} />
        <h1 class="explore-title">{t('premium.title')}</h1>
        <p>{t('premium.sub')}</p>
        {p?.premium && <span class="tag tag-accent">{t('premium.active')}{p.raw?.premiumUntil ? ` · ${formatDate(p.raw.premiumUntil)}` : ''}</span>}
      </section>
      {status && (
        <Card class={`premium-status is-${status}`}>
          <Icon name={status === 'completed' ? 'check-circle-fill' : status === 'failed' ? 'warning' : 'hourglass'} size={24} />
          <span class="grow">{t(`premium.status.${status === 'completed' || status === 'failed' ? status : 'pending'}`)}</span>
          <Button size="sm" variant="ghost" onClick={() => { setStatus(''); setQuery({ payment: null }); }}>{t('common.close')}</Button>
        </Card>
      )}
      <div class="plan-grid">
        {['monthly', 'yearly'].map((plan) => (
          <Card key={plan} class={`plan${plan === 'yearly' ? ' is-best' : ''}`}>
            {plan === 'yearly' && <span class="plan-badge">{t('premium.save')}</span>}
            <h2 class="card-title">{t(`premium.${plan}`)}</h2>
            <p class="plan-price">{plan === 'yearly' ? '89,99' : '9,99'} ₾<span class="muted small"> / {t(plan === 'yearly' ? 'premium.year' : 'premium.month')}</span></p>
            <ul class="plan-perks">{PERKS.map((k) => <li key={k}><Icon name="check-circle-fill" size={18} />{t(`premium.perk.${k}`)}</li>)}</ul>
            <Button variant={plan === 'yearly' ? 'primary' : 'secondary'} block loading={busy === plan} disabled={!!busy} onClick={() => buy(plan)}>{t('premium.choose')}</Button>
          </Card>
        ))}
      </div>
      <p class="muted small center">{t('premium.note')}</p>
    </div>
  );
}
