import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../ui/Icon.jsx';
import { Button } from '../ui/Button.jsx';
import { Card, Empty, Skeleton } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useInView, useTitle, useAsync } from '../lib/hooks.js';
import { signedIn, authReady } from '../lib/auth.js';
import { openComposer, viewerCtx } from '../lib/store.js';
import { query } from '../lib/router.js';
import { fetchFeedPage, listenNewest, canSee } from '../data/posts.js';
import { isCorruptSeed } from '../data/normalize.js';
import { StoryTray } from '../features/story/StoryTray.jsx';
import { Hub } from '../features/home/Hub.jsx';
import { PostTile } from '../features/post/PostTile.jsx';
import { EventCard } from '../features/events/EventCard.jsx';
import { upcomingEvents } from '../data/events.js';
import { ReelsStrip } from '../features/video/ReelsStrip.jsx';
import { PeopleStrip } from '../features/user/PeopleStrip.jsx';

function TileSkeleton({ h }) {
  return <div class="post-tile"><Skeleton h={h} r={14} /></div>;
}

/** Home: search hub and discovery sections, then community posts as a grid. */
export default function Home() {
  useTitle(t('nav.home'));
  const [posts, setPosts] = useState([]);
  const [state, setState] = useState({ loading: true, done: false, error: false });
  const [fresh, setFresh] = useState(null);
  const events = useAsync(() => upcomingEvents(8).catch(() => []), []);
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

  return (
    <div class="home">
      <Hub />
      <ReelsStrip />
      {events.data?.length > 0 && (
        <section class="hub-block">
          <div class="section-head"><h2 class="section-title"><Icon name="calendar-blank" size={20} class="tone-brand" />{t('events.upcoming')}</h2><a href="/events" class="link">{t('common.seeAll')}</a></div>
          <div class="h-scroll">{events.data.map((e) => <EventCard key={e.id} event={e} />)}</div>
        </section>
      )}
      <section class="community">
        <div class="section-head">
          <h2 class="section-title"><Icon name="users-three" size={20} class="tone-brand" />{t('home.community')}</h2>
          <Button variant="primary" size="sm" icon="plus" onClick={() => openComposer({})}>{t('home.share')}</Button>
        </div>
        <StoryTray />
        {fresh && (
          <button type="button" class="new-posts-pill" onClick={() => { setFresh(null); load(true); }}>
            <Icon name="arrow-up-right" size={16} style={{ transform: 'rotate(-45deg)' }} />{t('feed.newPosts')}
          </button>
        )}
        <div class="post-grid">
          {posts.map((p) => <PostTile key={p.id} post={p} />)}
          {state.loading && [220, 300, 180, 260].map((h, i) => <TileSkeleton key={i} h={h} />)}
        </div>
        {state.error && <Card><Empty compact icon="warning" title={t('feed.errorTitle')} text={t('feed.errorText')} action={<Button variant="primary" onClick={() => load(!posts.length)}>{t('common.retry')}</Button>} /></Card>}
        {!state.loading && !state.error && !posts.length && (
          <Card><Empty icon="newspaper" title={t('feed.emptyTitle')} text={t('feed.emptyText')} action={<><Button variant="primary" href="/friends">{t('feed.findFriends')}</Button><Button variant="secondary" href="/explore">{t('nav.explore')}</Button></>} /></Card>
        )}
        <div ref={sentinel} class="feed-sentinel" aria-hidden="true" />
        {state.done && posts.length > 0 && <div class="feed-end"><span class="feed-end-icon"><Icon name="check-circle-fill" size={28} /></span><p>{t('feed.caughtUp')}</p></div>}
      </section>
      {signedIn.value && <PeopleStrip />}
    </div>
  );
}
