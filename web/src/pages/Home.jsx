import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Button } from '../ui/Button.jsx';
import { Card, Empty, Skeleton } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useInView, useTitle } from '../lib/hooks.js';
import { profile, signedIn, authReady } from '../lib/auth.js';
import { openComposer, viewerCtx, requireLogin, storyCreator } from '../lib/store.js';
import { query } from '../lib/router.js';
import { fetchFeedPage, listenNewest, canSee } from '../data/posts.js';
import { isCorruptSeed } from '../data/normalize.js';
import { StoryTray } from '../features/story/StoryTray.jsx';
import { Hub } from '../features/home/Hub.jsx';
import { PostCard } from '../features/post/PostCard.jsx';
import { ReelsStrip } from '../features/video/ReelsStrip.jsx';
import { PeopleStrip } from '../features/user/PeopleStrip.jsx';

function ComposerCard() {
  const p = profile.value;
  const first = (p?.name || '').split(' ')[0];
  return (
    <Card class="composer-card">
      <div class="composer-card-top">
        <Avatar src={p?.avatar} name={p?.name || ''} size={40} href={signedIn.value ? '/u/me' : undefined} />
        <button type="button" class="composer-card-input" onClick={() => openComposer({})}>
          {signedIn.value ? t('composer.placeholder', { name: first }) : t('composer.placeholderGuest')}
        </button>
      </div>
      <div class="composer-card-actions">
        <button type="button" class="composer-card-btn" onClick={() => openComposer({ pick: 'media' })}><Icon name="images" size={22} class="tone-green" /><span>{t('composer.photoShort')}</span></button>
        <button type="button" class="composer-card-btn" onClick={() => { if (requireLogin('story')) storyCreator.value = true; }}><Icon name="plus-circle" size={22} class="tone-brand" /><span>{t('create.story')}</span></button>
        <a href="/map?checkin=1" class="composer-card-btn"><Icon name="map-pin" size={22} class="tone-red" /><span>{t('create.checkin')}</span></a>
      </div>
    </Card>
  );
}

function PostSkeleton() {
  return (
    <Card class="post-skel">
      <div class="row gap-12"><Skeleton w={42} h={42} r={21} /><div class="col gap-6 grow"><Skeleton w="40%" h={14} /><Skeleton w="22%" h={12} /></div></div>
      <Skeleton w="92%" h={14} style={{ marginTop: 16 }} />
      <Skeleton w="70%" h={14} style={{ marginTop: 8 }} />
      <Skeleton h={260} r={12} style={{ marginTop: 16 }} />
    </Card>
  );
}

/** Home: stories, composer and the feed with inline discovery modules. */
export default function Home() {
  useTitle(t('nav.home'));
  const [posts, setPosts] = useState([]);
  const [state, setState] = useState({ loading: true, done: false, error: false });
  const [fresh, setFresh] = useState(null);
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

  const items = [];
  posts.forEach((p, i) => {
    items.push(<PostCard key={p.id} post={p} onRemoved={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />);
    if (i === 2) items.push(<ReelsStrip key="reels" />);
    if (i === 5 && signedIn.value) items.push(<PeopleStrip key="people" />);
  });

  return (
    <div class="feed">
      <Hub />
      <StoryTray />
      <ComposerCard />
      {fresh && (
        <button type="button" class="new-posts-pill" onClick={() => { setFresh(null); window.scrollTo({ top: 0, behavior: 'smooth' }); load(true); }}>
          <Icon name="arrow-up-right" size={16} style={{ transform: 'rotate(-45deg)' }} />{t('feed.newPosts')}
        </button>
      )}
      {items}
      {state.loading && (posts.length ? <PostSkeleton /> : <><PostSkeleton /><PostSkeleton /></>)}
      {state.error && (
        <Card><Empty compact icon="warning" title={t('feed.errorTitle')} text={t('feed.errorText')} action={<Button variant="primary" onClick={() => load(!posts.length)}>{t('common.retry')}</Button>} /></Card>
      )}
      {!state.loading && !state.error && !posts.length && (
        <Card><Empty icon="newspaper" title={t('feed.emptyTitle')} text={t('feed.emptyText')} action={<><Button variant="primary" href="/friends">{t('feed.findFriends')}</Button><Button variant="secondary" href="/explore">{t('nav.explore')}</Button></>} /></Card>
      )}
      <div ref={sentinel} class="feed-sentinel" aria-hidden="true" />
      {state.done && posts.length > 0 && (
        <div class="feed-end">
          <span class="feed-end-icon"><Icon name="check-circle-fill" size={28} /></span>
          <p>{t('feed.caughtUp')}</p>
        </div>
      )}
    </div>
  );
}
