import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Icon } from '../ui/Icon.jsx';
import { IconButton } from '../ui/Button.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { SearchInput } from '../ui/Field.jsx';
import { Card, Empty, Img, Spinner, Verified } from '../ui/misc.jsx';
import { t, tn, formatCount } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { formatPrice } from '../lib/format.js';
import { cityLabel } from '../lib/geo.js';
import { query, setQuery } from '../lib/router.js';
import { searchAll, recentSearches, rememberSearch, clearSearches } from '../data/search.js';
import { PostCard } from '../features/post/PostCard.jsx';
import { PlaceCard } from '../features/places/PlaceCard.jsx';
import { EventCard } from '../features/events/EventCard.jsx';
import { VideoCard } from '../features/video/VideoCard.jsx';

const KINDS = [
  { key: 'people', icon: 'users' },
  { key: 'posts', icon: 'note-pencil' },
  { key: 'places', icon: 'map-pin' },
  { key: 'businesses', icon: 'storefront' },
  { key: 'groups', icon: 'users-three' },
  { key: 'events', icon: 'calendar-blank' },
  { key: 'videos', icon: 'monitor-play' },
  { key: 'items', icon: 'tag' },
];

function Row({ href, img, name, sub, square, verified, icon }) {
  return (
    <a href={href} class="result-row">
      {icon ? <span class="result-row-ico"><Icon name={icon} size={22} /></span> : <Avatar src={img} name={name} size={48} square={square} />}
      <span class="result-row-text">
        <strong class="ellipsis">{name}{verified && <Verified />}</strong>
        {sub && <span class="muted small ellipsis">{sub}</span>}
      </span>
      <Icon name="caret-right" size={18} class="muted" />
    </a>
  );
}

function ItemRow({ item }) {
  return (
    <a href={`/marketplace/${item.id}`} class="result-row">
      <span class="result-row-thumb"><Img src={item.images[0]} width={120} alt="" fallback={<span class="result-row-ico"><Icon name="tag" size={22} /></span>} /></span>
      <span class="result-row-text">
        <strong class="ellipsis">{item.title}</strong>
        <span class="small"><b class="tone-brand">{item.price ? formatPrice(item.price, item.currency) : t('common.free')}</b>{item.city ? <span class="muted"> · {cityLabel(item.city)}</span> : null}</span>
      </span>
      <Icon name="caret-right" size={18} class="muted" />
    </a>
  );
}

function Results({ kind, list, limit }) {
  const l = limit ? list.slice(0, limit) : list;
  switch (kind) {
    case 'people': return <div class="result-list">{l.map((u) => <Row key={u.id} href={`/u/${u.username || u.id}`} img={u.avatar} name={u.name} verified={u.verified} sub={[u.username && `@${u.username}`, cityLabel(u.city)].filter(Boolean).join(' · ')} />)}</div>;
    case 'posts': return <div class="feed">{l.map((p) => <PostCard key={p.id} post={p} />)}</div>;
    case 'places': return <div class="place-grid">{l.map((p) => <PlaceCard key={p.id} place={p} />)}</div>;
    case 'businesses': return <div class="result-list">{l.map((b) => <Row key={b.id} href={`/business/${b.id}`} img={b.logo} square name={b.name} verified={b.verified} sub={[b.category, cityLabel(b.city)].filter(Boolean).join(' · ')} />)}</div>;
    case 'groups': return <div class="result-list">{l.map((g) => <Row key={g.id} href={`/groups/${g.id}`} img={g.avatar || g.cover} square name={g.name} sub={[t(g.privacy === 'private' ? 'groups.private' : 'groups.public'), tn('groups.members', g.memberCount)].join(' · ')} />)}</div>;
    case 'events': return <div class="place-grid">{l.map((e) => <EventCard key={e.id} event={e} />)}</div>;
    case 'videos': return <div class="video-grid">{l.map((v) => <VideoCard key={v.id} video={v} />)}</div>;
    case 'items': return <div class="result-list">{l.map((i) => <ItemRow key={i.id} item={i} />)}</div>;
    default: return null;
  }
}

function Recent({ onPick }) {
  const [list, setList] = useState(recentSearches());
  return (
    <div class="stack">
      {list.length > 0 && (
        <Card>
          <div class="card-head"><h2 class="card-title">{t('search.recent')}</h2><button type="button" class="link" onClick={() => { clearSearches(); setList([]); }}>{t('search.clear')}</button></div>
          <div class="result-list">
            {list.map((s) => (
              <div key={s} class="recent-row">
                <button type="button" class="recent-term" onClick={() => onPick(s)}><Icon name="clock-counter-clockwise" size={18} class="muted" /><span class="ellipsis">{s}</span></button>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <h2 class="card-title" style={{ marginBottom: 12 }}>{t('search.browse')}</h2>
        <div class="browse-grid">
          {[
            ['/explore', 'compass', 'nav.explore', '#2f9e5b'], ['/map', 'map-trifold', 'nav.map', '#1f8fbf'], ['/events', 'calendar-blank', 'nav.events', '#d4468a'],
            ['/groups', 'users-three', 'nav.groups', '#4b6bd6'], ['/marketplace', 'storefront', 'nav.marketplace', '#e0662b'], ['/business', 'briefcase', 'nav.business', '#9a6b2f'],
            ['/video', 'monitor-play', 'nav.video', '#e11d48'], ['/friends?tab=suggestions', 'user-plus', 'friends.suggestions', '#7a5bc4'],
          ].map(([href, icon, key, tone]) => (
            <a key={href} href={href} class="browse-tile" style={{ '--tone': tone }}><span class="browse-ico"><Icon name={icon} size={22} /></span>{t(key)}</a>
          ))}
        </div>
      </Card>
    </div>
  );
}

/** Search across people, posts, places, businesses, groups, events, videos, listings. */
export default function Search() {
  const q = (query.value.get('q') || '').trim();
  const tab = query.value.get('tab') || 'all';
  const [value, setValue] = useState(q);
  const [res, setRes] = useState(null);
  useTitle(q ? `${q} — ${t('common.search')}` : t('common.search'));
  useEffect(() => { setValue(q); }, [q]);
  useEffect(() => {
    if (!q) { setRes(null); return undefined; }
    let alive = true;
    setRes(null);
    searchAll(q).then((r) => alive && setRes(r)).catch(() => alive && setRes({}));
    return () => { alive = false; };
  }, [q]);

  const submit = (v) => {
    const term = String(v || '').trim();
    if (!term) return;
    rememberSearch(term);
    setQuery({ q: term, tab: null }, { push: true });
  };
  const total = res ? KINDS.reduce((a, k) => a + (res[k.key]?.length || 0), 0) : 0;

  return (
    <div class="page-pad search-page">
      <div class="search-top">
        <SearchInput value={value} onInput={(e) => setValue(e.currentTarget.value)} onSubmit={submit} placeholder={t('search.placeholder')} autoFocus={!q} class="search-big" />
        {value && <IconButton icon="x" label={t('search.clear')} variant="soft" onClick={() => { setValue(''); setQuery({ q: null, tab: null }); }} />}
      </div>
      {!q ? <Recent onPick={submit} /> : (
        <>
          <Tabs variant="pill" value={tab} onChange={(v) => setQuery({ tab: v === 'all' ? null : v })} label={t('common.search')} items={[
            { value: 'all', label: t('common.all') },
            ...KINDS.map((k) => ({ value: k.key, label: `${t(`search.${k.key}`)}${res?.[k.key]?.length ? ` · ${formatCount(res[k.key].length)}` : ''}`, icon: k.icon, hidden: res && !res[k.key]?.length && tab !== k.key })),
          ]} />
          <div class="search-body">
            {!res ? <div class="center-pad"><Spinner size={28} /></div>
              : !total ? <Card><Empty icon="magnifying-glass" title={t('search.nothingFor', { q })} text={t('search.nothingText')} /></Card>
              : tab === 'all' ? KINDS.filter((k) => res[k.key]?.length).map((k) => (
                <section key={k.key} class="search-section">
                  <div class="section-head">
                    <h2 class="section-title"><Icon name={k.icon} size={20} class="tone-brand" />{t(`search.${k.key}`)}</h2>
                    {res[k.key].length > (k.key === 'posts' ? 2 : 4) && <button type="button" class="link" onClick={() => setQuery({ tab: k.key })}>{t('common.seeAll')}</button>}
                  </div>
                  <Results kind={k.key} list={res[k.key]} limit={k.key === 'posts' ? 2 : k.key === 'people' || k.key === 'businesses' || k.key === 'groups' || k.key === 'items' ? 4 : 3} />
                </section>
              ))
              : res[tab]?.length ? <Results kind={tab} list={res[tab]} /> : <Card><Empty icon="magnifying-glass" title={t('search.nothingFor', { q })} /></Card>}
          </div>
        </>
      )}
    </div>
  );
}
