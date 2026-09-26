import { useEffect, useState } from 'preact/hooks';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Card, Empty, Img, Spinner } from '../ui/misc.jsx';
import { t, formatNumber } from '../lib/i18n.js';
import { useTitle, useAsync } from '../lib/hooks.js';
import { query as q, setQuery } from '../lib/router.js';
import { uid, profile } from '../lib/auth.js';
import { toast } from '../lib/toast.js';
import { codeFor } from '../data/referrals.js';
import { copyLink } from '../features/post/ShareDialog.jsx';

const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
const loadRewards = () => getDocs(query(collection(db, 'rewards'), where('active', '==', true), limit(60))).then((s) => rows(s).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))).catch(() => []);
const loadChallenges = () => getDocs(query(collection(db, 'challenges'), limit(50))).then((s) => rows(s).filter((c) => c.active !== false)).catch(() => []);
const loadCoupons = () => getDocs(query(collection(db, 'rewardCoupons'), where('userId', '==', uid.value), limit(50))).then(rows).catch(() => []);

/** GeoPoints: balance, partner rewards, challenges, coupons and invites. */
export default function Rewards() {
  useTitle(t('nav.rewards'));
  const tab = q.value.get('tab') || 'rewards';
  const rewards = useAsync(loadRewards, []);
  const challenges = useAsync(() => (tab === 'challenges' ? loadChallenges() : Promise.resolve(null)), [tab]);
  const coupons = useAsync(() => (tab === 'coupons' && uid.value ? loadCoupons() : Promise.resolve(null)), [tab, uid.value]);
  const [code, setCode] = useState('');
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
          const cost = Number(r.pointPrice ?? r.cost ?? r.pointsCost) || 0;
          const left = r.quantityRemaining ?? r.stock;
          return (
            <article key={r.id} class="card event-card">
              <span class="event-card-img"><Img src={r.imageUrl} width={560} alt="" fallback={<span class="event-card-ico"><Icon name="gift" size={40} /></span>} /></span>
              <span class="event-card-body">
                <strong class="event-card-title">{r.title || r.name}</strong>
                {r.businessName && <a href={r.businessId ? `/business/${r.businessId}` : '#'} class="muted small">{r.businessName}</a>}
                <span class="row gap-8 wrap small"><span class="tag tag-accent"><Icon name="coins" size={12} />{formatNumber(cost)}</span>{left != null && <span class="muted">{t('rewards.left', { n: left })}</span>}</span>
                <Button size="sm" variant={points >= cost ? 'primary' : 'secondary'} onClick={() => toast(t('rewards.redeemSoon'))}>{t(points >= cost ? 'rewards.redeem' : 'rewards.needMore')}</Button>
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
          <div key={c.id} class="service-row"><span class="offer-ico"><Icon name="ticket" size={24} /></span><div class="grow"><strong>{c.rewardTitle || c.title}</strong><p class="muted small">{c.businessName}</p></div><code class="coupon-code">{c.code}</code></div>
        ))}</div></Card>
      ) : <Card><Empty icon="ticket" title={t('rewards.noCoupons')} /></Card>)}
    </div>
  );
}
