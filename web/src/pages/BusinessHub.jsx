import { useEffect, useMemo, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { SearchInput, Select } from '../ui/Field.jsx';
import { Card, Empty, Skeleton } from '../ui/misc.jsx';
import { t, tn } from '../lib/i18n.js';
import { useTitle, useAsync } from '../lib/hooks.js';
import { query, setQuery } from '../lib/router.js';
import { uid } from '../lib/auth.js';
import { cityOptions, cityLabel } from '../lib/geo.js';
import { listBusinesses, myBusinesses, followedBusinesses } from '../data/business.js';
import { BizCard } from '../features/business/BizCard.jsx';
import { BIZ_GROUPS, bizCategory, bizGroupLabel, bizCategoryLabel } from '../features/business/categories.js';

const GROUP_ICON = { food: '🍽️', stay: '🏨', travel: '🗺️', health: '💪', beauty: '💄', fun: '🎬', shopping: '🛍️', education: '🎓', services: '💼', auto: '🚗', events: '🎪', family: '🐾', other: '🏪' };

function MyPages() {
  const { data } = useAsync(() => (uid.value ? myBusinesses() : Promise.resolve([])), [uid.value]);
  if (!data?.length) return null;
  return (
    <Card class="my-pages">
      <div class="card-head"><h2 class="card-title">{t('biz.myPages')}</h2><Button variant="ghost" size="sm" icon="plus" href="/business/new">{t('biz.create')}</Button></div>
      <div class="my-pages-list">
        {data.map((b) => (
          <div key={b.id} class="my-page-row">
            <Avatar src={b.logo} name={b.name} size={48} square href={`/business/${b.id}`} />
            <a href={`/business/${b.id}`} class="grow my-page-text">
              <strong class="ellipsis">{b.name}</strong>
              <span class="muted small ellipsis">{bizCategoryLabel(b.category)} · {tn('biz.followers', b.followerCount)}</span>
            </a>
            <Button variant="soft" size="sm" icon="gear" href={`/business/${b.id}/manage`}>{t('biz.manage')}</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Directory() {
  const [all, setAll] = useState(null);
  const [q, setQ] = useState('');
  const group = query.value.get('group') || '';
  const city = query.value.get('city') || '';
  useEffect(() => { listBusinesses(300).then(setAll).catch(() => setAll([])); }, []);
  const list = useMemo(() => {
    if (!all) return [];
    const needle = q.trim().toLowerCase();
    return all.filter((b) => (!group || bizCategory(b.category)?.group === group)
      && (!city || cityLabel(b.city) === cityLabel(city))
      && (!needle || `${b.name} ${b.description} ${bizCategoryLabel(b.category)} ${b.tags.join(' ')}`.toLowerCase().includes(needle)))
      .sort((a, b) => (b.verified - a.verified) || (b.rating * 20 + b.followerCount) - (a.rating * 20 + a.followerCount));
  }, [all, q, group, city]);
  return (
    <div class="stack">
      <div class="biz-filters">
        <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('biz.searchPh')} />
        <div class="biz-city"><Select label={t('place.city')} value={city} onChange={(e) => setQuery({ city: e.currentTarget.value || null })} options={[{ value: '', label: t('explore.allCities') }, ...cityOptions()]} /></div>
      </div>
      <div class="chip-row" role="toolbar" aria-label={t('biz.category')}>
        <button type="button" class={`chip${!group ? ' is-active' : ''}`} onClick={() => setQuery({ group: null })}>{t('common.all')}</button>
        {BIZ_GROUPS.map((g) => (
          <button key={g} type="button" class={`chip${group === g ? ' is-active' : ''}`} onClick={() => setQuery({ group: group === g ? null : g })}><span aria-hidden="true">{GROUP_ICON[g]}</span>{bizGroupLabel(g)}</button>
        ))}
      </div>
      {!all ? (
        <div class="biz-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} class="card biz-card"><Skeleton h={110} r={0} /><div class="biz-card-body"><Skeleton w="60%" h={16} /><Skeleton w="40%" h={12} /></div></div>)}</div>
      ) : list.length ? <div class="biz-grid">{list.map((b) => <BizCard key={b.id} biz={b} />)}</div>
        : <Card><Empty icon="storefront" title={t('biz.noneFound')} text={t('biz.noneFoundText')} action={<Button variant="primary" icon="plus" href="/business/new">{t('biz.create')}</Button>} /></Card>}
    </div>
  );
}

function Following() {
  const { data } = useAsync(() => followedBusinesses(), [uid.value]);
  if (!data) return <div class="biz-grid"><Skeleton h={220} /></div>;
  if (!data.length) return <Card><Empty icon="storefront" title={t('biz.noFollowing')} text={t('biz.noFollowingText')} /></Card>;
  return <div class="biz-grid">{data.map((b) => <BizCard key={b.id} biz={b} />)}</div>;
}

/** Business hub: your pages, the directory, and pages you follow. */
export default function BusinessHub() {
  useTitle(t('nav.business'));
  const tab = query.value.get('tab') || 'all';
  return (
    <div class="page-pad biz-hub">
      <section class="biz-hero">
        <div>
          <h1 class="page-title">{t('nav.business')}</h1>
          <p class="page-sub">{t('biz.hubSub')}</p>
        </div>
        <Button variant="primary" icon="plus" href="/business/new">{t('biz.create')}</Button>
      </section>
      <MyPages />
      <Tabs variant="pill" value={tab} onChange={(v) => setQuery({ tab: v === 'all' ? null : v })} label={t('nav.business')} items={[
        { value: 'all', label: t('biz.directory'), icon: 'storefront' },
        { value: 'following', label: t('biz.following'), icon: 'heart', hidden: !uid.value },
      ]} />
      {tab === 'following' && uid.value ? <Following /> : <Directory />}
    </div>
  );
}
