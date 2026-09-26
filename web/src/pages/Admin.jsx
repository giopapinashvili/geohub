import { useState } from 'preact/hooks';
import { collection, query, getDocs, getCountFromServer, limit, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { Button } from '../ui/Button.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Switch, SearchInput } from '../ui/Field.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Card, Empty, Spinner, StatCard } from '../ui/misc.jsx';
import { t, formatCount } from '../lib/i18n.js';
import { useTitle, useAsync } from '../lib/hooks.js';
import { timeAgo } from '../lib/format.js';
import { isAdmin } from '../lib/auth.js';
import { navigate } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { searchUsers } from '../data/users.js';
import { tsToMillis } from '../lib/format.js';

const count = (name) => getCountFromServer(collection(db, name)).then((s) => s.data().count).catch(() => 0);
const TARGET = { post: 'posts', business: 'businesses', marketplace: 'marketplace', user: 'users', comment: null, place: 'places', video: 'videos', group: 'groups' };
const HREF = { post: '/post/', business: '/business/', marketplace: '/marketplace/', user: '/u/', place: '/place/', video: '/watch/', group: '/groups/' };

function Overview() {
  const { data } = useAsync(() => Promise.all(['users', 'posts', 'businesses', 'places', 'groups', 'reports'].map(count)), []);
  if (!data) return <Spinner />;
  const [u, p, b, pl, g, r] = data;
  return (
    <div class="stat-grid">
      <StatCard icon="users" label={t('admin.users')} value={formatCount(u)} tone="#4b6bd6" />
      <StatCard icon="note-pencil" label={t('search.posts')} value={formatCount(p)} tone="#2f9e5b" />
      <StatCard icon="storefront" label={t('search.businesses')} value={formatCount(b)} tone="#e0662b" />
      <StatCard icon="map-pin" label={t('search.places')} value={formatCount(pl)} tone="#1f8fbf" />
      <StatCard icon="users-three" label={t('search.groups')} value={formatCount(g)} tone="#7a5bc4" />
      <StatCard icon="flag" label={t('admin.reports')} value={formatCount(r)} tone="#e11d48" href="/admin/reports" />
    </div>
  );
}

function Reports() {
  const { data, reload } = useAsync(() => getDocs(query(collection(db, 'reports'), limit(200))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToMillis(d.data().createdAt) })).filter((r) => (r.status || 'pending') === 'pending').sort((a, b) => b.createdAt - a.createdAt)), []);
  const resolve = async (r, removeTarget) => {
    try {
      const col = TARGET[r.targetType];
      if (removeTarget && col && r.targetId) await deleteDoc(doc(db, col, r.targetId));
      await updateDoc(doc(db, 'reports', r.id), { status: removeTarget ? 'resolved' : 'dismissed', resolvedAt: Date.now() });
      reload();
    } catch { toast.error(t('common.error')); }
  };
  if (!data) return <Spinner />;
  if (!data.length) return <Card><Empty compact icon="shield-check" title={t('admin.noReports')} /></Card>;
  return (
    <Card><div class="quote-list">{data.map((r) => (
      <article key={r.id} class="quote is-new">
        <div class="row gap-8 wrap"><span class="tag tag-danger">{r.targetType || '—'}</span><strong>{r.reason}</strong><span class="muted xs">{timeAgo(r.createdAt)}</span></div>
        {r.details && <p class="small">{r.details}</p>}
        <div class="row gap-8 wrap">
          {HREF[r.targetType] && r.targetId && <Button size="sm" variant="ghost" href={HREF[r.targetType] + r.targetId}>{t('common.open')}</Button>}
          <Button size="sm" variant="danger" onClick={() => resolve(r, true)} disabled={!TARGET[r.targetType]}>{t('admin.remove')}</Button>
          <Button size="sm" variant="secondary" onClick={() => resolve(r, false)}>{t('admin.dismiss')}</Button>
        </div>
      </article>
    ))}</div></Card>
  );
}

function Users() {
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const run = (v) => searchUsers(v, 20).then(setList).catch(() => setList([]));
  const verify = (u) => updateDoc(doc(db, 'users', u.id), { verified: !u.verified, isVerified: !u.verified }).then(() => { setList((l) => l.map((x) => (x.id === u.id ? { ...x, verified: !u.verified } : x))); }).catch(() => toast.error(t('common.error')));
  return (
    <Card><div class="stack">
      <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} onSubmit={run} placeholder={t('admin.searchUsers')} />
      {list && (list.length ? <div class="visitor-list">{list.map((u) => (
        <div key={u.id} class="visitor"><Avatar src={u.avatar} name={u.name} size={40} href={`/u/${u.id}`} /><span class="grow bold ellipsis">{u.name}</span>
          <Button size="sm" variant={u.verified ? 'soft' : 'secondary'} icon="seal-check" onClick={() => verify(u)}>{t(u.verified ? 'admin.unverify' : 'admin.verify')}</Button></div>
      ))}</div> : <Empty compact icon="users" title={t('search.nothing')} />)}
    </div></Card>
  );
}

function Flags() {
  const { data, setData } = useAsync(() => getDoc(doc(db, 'adminFlags', 'maintenance')).then((s) => (s.exists() ? s.data() : { enabled: false })), []);
  if (!data) return <Spinner />;
  return (
    <Card>
      <Switch checked={!!data.enabled} label={t('admin.maintenance')} description={t('admin.maintenanceHint')}
        onChange={(v) => setDoc(doc(db, 'adminFlags', 'maintenance'), { enabled: v, feature: 'maintenance', updatedAt: Date.now() }, { merge: true }).then(() => setData({ ...data, enabled: v })).catch(() => toast.error(t('common.error')))} />
    </Card>
  );
}

/** Admin panel: overview, reports, users, flags. Rules enforce admin rights. */
export default function Admin({ params }) {
  useTitle(t('nav.admin'));
  const section = params.section || 'overview';
  if (!isAdmin.value) return <div class="page-pad"><Card><Empty icon="lock" title={t('admin.noAccess')} /></Card></div>;
  return (
    <div class="page-pad admin-page">
      <h1 class="page-title">{t('nav.admin')}</h1>
      <Tabs variant="pill" value={section} onChange={(v) => navigate(v === 'overview' ? '/admin' : `/admin/${v}`)} label={t('nav.admin')} items={[
        { value: 'overview', label: t('biz.overview'), icon: 'chart-bar' }, { value: 'reports', label: t('admin.reports'), icon: 'flag' },
        { value: 'users', label: t('admin.users'), icon: 'users' }, { value: 'flags', label: t('admin.flags'), icon: 'sliders-horizontal' },
      ]} />
      {section === 'overview' && <Overview />}
      {section === 'reports' && <Reports />}
      {section === 'users' && <Users />}
      {section === 'flags' && <Flags />}
    </div>
  );
}
