import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../ui/Icon.jsx';
import { Button } from '../ui/Button.jsx';
import { Card, Empty, Skeleton } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useInView, useTitle } from '../lib/hooks.js';
import { signedIn, authReady } from '../lib/auth.js';
import { openComposer, viewerCtx } from '../lib/store.js';
import { query } from '../lib/router.js';
import { fetchFeedPage, listenNewest, canSee } from '../data/posts.js';
import { isCorruptSeed } from '../data/normalize.js';
import { StoryTray } from '../features/story/StoryTray.jsx';
import { HubTop, useHubModules, initialHubCity, saveHubCity } from '../features/home/Hub.jsx';
import { PostCard } from '../features/post/PostCard.jsx';
import { ReelsStrip } from '../features/video/ReelsStrip.jsx';
import { PeopleStrip } from '../features/user/PeopleStrip.jsx';

function PostSkeleton() {
  return (
    <Card class="post-skel">
      <div class="row gap-12"><Skeleton w={40} h={40} r={20} /><div class="col gap-6 grow"><Skeleton w="40%" h={14} /><Skeleton w="22%" h={12} /></div></div>
      <Skeleton h={360} r={0} style={{ marginTop: 12 }} />
    </Card>
  );
}

/** Home: search hub and discovery sections, then community posts as a grid. */
export default function Home() {
  useTitle(t('nav.home'));
  const [posts, setPosts] = useState([]);
  const [state, setState] = useState({ loading: true, done: false, error: false });
  const [fresh, setFresh] = useState(null);
  const [city, setCityState] = useState(initialHubCity);
  const setCity = (c) => { setCityState(c); saveHubCity(c); };
  const modules = useHubModules(city);
  const cursor = useRef(null);
  const loadingRef = useRef(false);
  const ctx = viewerCtx.value;
  const ctxKey = `${ctx.uid}|${ctx.friends.size}|${ctx.following.size}|${ctx.blocked.size}|${ctx.hidden.size}|${ctx.muted.size}`;

  const load = useCallback(async (reset) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const page = await fetchFeedPage({ cursor: reset ? null : cursor.current, want: reset ? 10 : 8, ctx: viewerCtx.value });
      cursor.current = page.cursor;
      setPosts((prev) => {
        const base = reset ? [] : prev;
        const seen = new Set(base.map((p) => p.id));
        return [...base, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setState({ loading: false, done: page.done, error: false });
    } catch (e) {
      console.warn('[feed]', e);
      setState((s) => ({ ...s, loading: false, error: true }));
    }
    loadingRef.current = false;
  }, []);

  // Reload when the viewer's graph changes (sign-in, new friends, blocks).
  useEffect(() => { if (authReady.value) load(true); }, [ctxKey, authReady.value]);

  // Own new posts appear at the top immediately.
  useEffect(() => {
    const onCreated = (e) => { const p = e.detail; if (p && !p.groupId) setPosts((list) => [p, ...list.filter((x) => x.id !== p.id)]); };
    window.addEventListener('gh:post-created', onCreated);
    return () => window.removeEventListener('gh:post-created', onCreated);
  }, []);

  // "New posts" pill when someone else publishes.
  const topId = posts.length ? posts[0].id : '';
  useEffect(() => listenNewest((p) => {
    if (!p || !posts.length || isCorruptSeed(p.raw) || p.groupId || !canSee(p, viewerCtx.value)) return;
    if (p.authorId === ctx.uid || posts.some((x) => x.id === p.id) || p.createdAt <= (posts[0]?.createdAt || 0)) return;
    setFresh(p);
  }), [topId]);

  const sentinel = useInView(() => { if (!state.done && !state.loading) load(false); }, { enabled: !state.done && posts.length > 0 });

  const compose = query.value.get('compose') === '1';
  useEffect(() => {
    if (compose && signedIn.value) { openComposer({}); history.replaceState(history.state, '', '/'); }
  }, [compose, signedIn.value]);

  // City sections are placed between posts: after the 2nd, 5th, 8th…
  const items = [];
  posts.forEach((p, i) => {
    items.push(<PostCard key={p.id} post={p} onRemoved={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />);
    const slot = (i - 1) / 3;
    if (Number.isInteger(slot) && modules[slot]) items.push(modules[slot]);
    if (i === 6) items.push(<ReelsStrip key="reels" />);
    if (i === 12 && signedIn.value) items.push(<PeopleStrip key="people" />);
  });
  if (!state.loading && posts.length < 2) modules.slice(posts.length ? 1 : 0).forEach((m) => items.push(m));

  return (
    <div class="feed home-feed">
      <HubTop city={city} setCity={setCity} />
      <StoryTray />
      {fresh && (
        <button type="button" class="new-posts-pill" onClick={() => { setFresh(null); window.scrollTo({ top: 0, behavior: 'smooth' }); load(true); }}>
          <Icon name="arrow-up-right" size={16} style={{ transform: 'rotate(-45deg)' }} />{t('feed.newPosts')}
        </button>
      )}
      {items}
      {state.loading && (posts.length ? <PostSkeleton /> : <><PostSkeleton /><PostSkeleton /></>)}
      {state.error && <Card><Empty compact icon="warning" title={t('feed.errorTitle')} text={t('feed.errorText')} action={<Button variant="primary" onClick={() => load(!posts.length)}>{t('common.retry')}</Button>} /></Card>}
      {!state.loading && !state.error && !posts.length && (
        <Card><Empty icon="newspaper" title={t('feed.emptyTitle')} text={t('feed.emptyText')} action={<><Button variant="primary" onClick={() => openComposer({})}>{t('home.share')}</Button><Button variant="secondary" href="/explore">{t('nav.explore')}</Button></>} /></Card>
      )}
      <div ref={sentinel} class="feed-sentinel" aria-hidden="true" />
      {state.done && posts.length > 0 && <div class="feed-end"><span class="feed-end-icon"><Icon name="check-circle-fill" size={28} /></span><p>{t('feed.caughtUp')}</p></div>}
    </div>
  );
}
