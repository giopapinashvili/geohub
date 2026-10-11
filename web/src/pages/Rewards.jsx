import { useEffect, useRef, useState } from 'preact/hooks';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Card, Empty, Img, Spinner } from '../ui/misc.jsx';
import { Modal } from '../ui/Modal.jsx';
import { t, formatNumber } from '../lib/i18n.js';
import { useTitle, useAsync } from '../lib/hooks.js';
import { query as q, setQuery } from '../lib/router.js';
import { requireLogin } from '../lib/store.js';
import { rewardCost, rewardStock, newRequestId, redeemReward, redeemErrorKey, myCoupons, redeemEnabled } from '../data/rewards.js';
import { uid, profile } from '../lib/auth.js';
import { toast } from '../lib/toast.js';
import { codeFor } from '../data/referrals.js';
import { copyLink } from '../features/post/ShareDialog.jsx';

const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
const loadRewards = () => getDocs(query(collection(db, 'rewards'), where('active', '==', true), limit(60))).then((s) => rows(s).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))).catch(() => []);
const loadChallenges = () => getDocs(query(collection(db, 'challenges'), limit(50))).then((s) => rows(s).filter((c) => c.active !== false)).catch(() => []);
const loadCoupons = () => myCoupons().catch(() => []);

/** Confirm → the server charges the points and issues a coupon code. */
function RedeemDialog({ reward, onClose, onDone }) {
  const [st, setSt] = useState({ step: 'confirm' });
  const attempt = useRef(newRequestId());
  const cost = rewardCost(reward);
  const run = async () => {
    setSt({ step: 'busy' });
    try {
      const res = await redeemReward(reward.id, attempt.current);
      setSt({ step: 'done', res });
      onDone?.(res);
    } catch (e) {
      setSt({ step: 'error', key: redeemErrorKey(e) });
    }
  };
  const done = st.step === 'done';
  return (
    <Modal open onClose={st.step === 'busy' ? undefined : onClose} title={done ? t('rewards.doneTitle') : (reward.title || reward.name)} size="sm"
      footer={done
        ? <><Button variant="secondary" onClick={() => { onClose(); setQuery({ tab: 'coupons' }); }}>{t('rewards.tabCoupons')}</Button><Button variant="primary" onClick={onClose}>{t('common.close')}</Button></>
        : <><Button variant="secondary" onClick={onClose} disabled={st.step === 'busy'}>{t('common.cancel')}</Button>
            <Button variant="primary" icon="gift" loading={st.step === 'busy'} onClick={run}>{t(st.step === 'error' ? 'rewards.tryAgain' : 'rewards.confirmRedeem', { n: formatNumber(cost) })}</Button></>}>
      {done ? (
        <div class="stack center">
          <p>{t('rewards.doneText', { title: st.res.rewardTitle, business: st.res.businessName || t('rewards.partner') })}</p>
          {st.res.code ? <code class="coupon-code coupon-code-lg">{st.res.code}</code> : <p class="small">{t('rewards.doneToast')}</p>}
          {st.res.newBalance != null && <p class="muted small">{t('rewards.newBalance', { n: formatNumber(st.res.newBalance) })}</p>}
        </div>
      ) : (
        <div class="stack">
          <p>{t('rewards.confirmText', { n: formatNumber(cost), title: reward.title || reward.name })}</p>
          {st.step === 'error' && <p class="field-error" role="alert">{t(st.key)}</p>}
        </div>
      )}
    </Modal>
  );
}

/** GeoPoints: balance, partner rewards, challenges, coupons and invites. */
export default function Rewards() {
  useTitle(t('nav.rewards'));
  const tab = q.value.get('tab') || 'rewards';
  const rewards = useAsync(loadRewards, []);
  const challenges = useAsync(() => (tab === 'challenges' ? loadChallenges() : Promise.resolve(null)), [tab]);
  const coupons = useAsync(() => (tab === 'coupons' && uid.value ? loadCoupons() : Promise.resolve(null)), [tab, uid.value]);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(null);
  const live = useAsync(redeemEnabled, []);
  useEffect(() => { if (uid.value) setCode(codeFor(uid.value)); }, [uid.value]);
  const points = profile.value?.points || 0;
  return (
    <div class="page-pad biz-hub">
      <section class="points-hero">
        <div><span class="points-label">{t('rewards.balance')}</span><strong class="points-value"><Icon name="coins-fill" size={32} />{formatNumber(points)}</strong><p class="small">{t('rewards.balanceHint')}</p></div>
        {code && (
          <div class="invite-box">
            <strong>{t('rewards.inviteTitle')}</strong>
            <p class="small">{t('rewards.inviteText')}</p>
            <Button variant="secondary" icon="link" onClick={() => copyLink(`${location.origin}/invite/${code}`)}>{code}</Button>
          </div>
        )}
      </section>
      <Tabs variant="pill" value={tab} onChange={(v) => setQuery({ tab: v === 'rewards' ? null : v })} label={t('nav.rewards')} items={[
        { value: 'rewards', label: t('rewards.tabRewards'), icon: 'gift' },
        { value: 'challenges', label: t('rewards.tabChallenges'), icon: 'trophy' },
        { value: 'coupons', label: t('rewards.tabCoupons'), icon: 'ticket', hidden: !uid.value },
      ]} />
      {tab === 'rewards' && (!rewards.data ? <Spinner /> : rewards.data.length ? (
        <div class="place-grid">{rewards.data.map((r) => {
          const cost = rewardCost(r);
          const left = rewardStock(r);
          const soldOut = left != null && left <= 0;
          return (
            <article key={r.id} class="card event-card">
              <span class="event-card-img"><Img src={r.imageUrl} width={560} alt="" fallback={<span class="event-card-ico"><Icon name="gift" size={40} /></span>} /></span>
              <span class="event-card-body">
                <strong class="event-card-title">{r.title || r.name}</strong>
                {r.businessName && <a href={r.businessId ? `/business/${r.businessId}` : '#'} class="muted small">{r.businessName}</a>}
                <span class="row gap-8 wrap small"><span class="tag tag-accent"><Icon name="coins" size={12} />{formatNumber(cost)}</span>{left != null && <span class="muted">{t('rewards.left', { n: left })}</span>}</span>
                <Button size="sm" variant={points >= cost && !soldOut ? 'primary' : 'secondary'} disabled={soldOut || (uid.value && points < cost)}
                  onClick={() => { if (!requireLogin('rewards')) return; if (live.data) setRedeeming(r); else toast(t('rewards.redeemSoon')); }}>
                  {t(soldOut ? 'rewards.soldOut' : !uid.value || points >= cost ? 'rewards.redeem' : 'rewards.needMore')}
                </Button>
              </span>
            </article>
          );
        })}</div>
      ) : <Card><Empty icon="gift" title={t('rewards.none')} /></Card>)}
      {tab === 'challenges' && (!challenges.data ? <Spinner /> : challenges.data.length ? (
        <Card><div class="service-list">{challenges.data.map((c) => (
          <div key={c.id} class="service-row"><span class="offer-ico"><Icon name="trophy-fill" size={24} /></span><div class="grow"><strong>{c.title || c.name}</strong><p class="muted small">{c.description}</p></div><span class="tag tag-accent">+{c.reward || c.points || c.xp || 0}</span></div>
        ))}</div></Card>
      ) : <Card><Empty icon="trophy" title={t('rewards.noChallenges')} /></Card>)}
      {tab === 'coupons' && (!coupons.data ? <Spinner /> : coupons.data.length ? (
        <Card><div class="service-list">{coupons.data.map((c) => (
          <div key={c.id} class={`service-row${c.status === 'active' ? '' : ' is-used'}`}><span class="offer-ico"><Icon name="ticket" size={24} /></span><div class="grow"><strong>{c.rewardTitle || c.title}</strong><p class="muted small">{c.businessName}{c.status !== 'active' && <> · {t('rewards.used')}</>}</p></div><code class="coupon-code">{c.code}</code></div>
        ))}</div></Card>
      ) : <Card><Empty icon="ticket" title={t('rewards.noCoupons')} /></Card>)}
      {redeeming && <RedeemDialog reward={redeeming} onClose={() => setRedeeming(null)} onDone={() => { rewards.reload?.(); toast.success(t('rewards.doneToast')); }} />}
    </div>
  );
}
