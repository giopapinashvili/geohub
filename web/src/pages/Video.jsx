import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Card, Empty, Skeleton, Spinner } from '../ui/misc.jsx';
import { t, tn } from '../lib/i18n.js';
import { useTitle, useInView, useAsync } from '../lib/hooks.js';
import { query, setQuery } from '../lib/router.js';
import { requireLogin } from '../lib/store.js';
import { uid } from '../lib/auth.js';
import { fetchVideos, listChannels, myChannels } from '../data/videos.js';
import { listenSaved } from '../data/posts.js';
import { getVideo } from '../data/videos.js';
import { VideoCard } from '../features/video/VideoCard.jsx';
import { VideoUploadDialog } from '../features/video/VideoUploadDialog.jsx';
import { CreateChannelDialog } from '../features/video/CreateChannelDialog.jsx';
import { ReelsStrip } from '../features/video/ReelsStrip.jsx';

function Latest() {
  const [videos, setVideos] = useState([]);
  const [state, setState] = useState({ loading: true, done: false });
  const cursor = useRef(null);
  const busy = useRef(false);
  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState((s) => ({ ...s, loading: true }));
    try {
      const page = await fetchVideos({ cursor: cursor.current, n: 24 });
      cursor.current = page.cursor;
      setVideos((v) => [...v, ...page.videos.filter((x) => !v.some((y) => y.id === x.id))]);
      setState({ loading: false, done: page.done });
    } catch { setState({ loading: false, done: false, error: true }); }
    busy.current = false;
  }, []);
  useEffect(() => { load(); }, []);
  const sentinel = useInView(() => { if (!state.done && !state.loading && !state.error) load(); }, { enabled: !state.done && !state.error && videos.length > 0 });
  return (
    <>
      <div class="video-grid">
        {videos.map((v) => <VideoCard key={v.id} video={v} />)}
        {state.loading && Array.from({ length: videos.length ? 3 : 9 }).map((_, i) => (
          <div key={`s${i}`} class="video-card"><Skeleton h="auto" r={12} style={{ aspectRatio: '16/9' }} /><Skeleton w="80%" h={14} style={{ marginTop: 10 }} /><Skeleton w="50%" h={12} style={{ marginTop: 6 }} /></div>
        ))}
      </div>
      {state.error && <Empty icon="warning" title={t('common.error')} action={<Button onClick={load}>{t('common.retry')}</Button>} />}
      {!state.loading && !state.error && !videos.length && <Empty icon="monitor-play" title={t('video.empty')} />}
      {!state.loading && !state.error && !state.done && <Button onClick={load}>{t('common.loadMore')}</Button>}
      <div ref={sentinel} class="feed-sentinel" />
    </>
  );
}

function Channels({ mine = false }) {
  const { data, error } = useAsync(() => mine ? myChannels() : listChannels(60), [mine, uid.value]);
  if (error) return <Empty icon="warning" title={t('common.error')} />;
  if (!data) return <div class="center-pad"><Spinner /></div>;
  if (!data.length) return <Empty icon="television-simple" title={t('video.noChannels')} />;
  return (
    <div class="channel-grid">
      {data.map((c) => (
        <a key={c.id} href={`/video/channel/${c.id}`} class="card channel-card">
          <Avatar src={c.avatar} name={c.name} size={88} />
          <strong>{c.name}</strong>
          <span class="muted small">{tn('video.subscribers', c.subscriberCount)} · {tn('video.videoCount', c.videoCount)}</span>
        </a>
      ))}
    </div>
  );
}

function SavedVideos() {
  const viewer = uid.value;
  const [state, setState] = useState({ owner: '', videos: null });
  useEffect(() => {
    let active = true; let revision = 0;
    setState({ owner: viewer, videos: null });
    const stop = listenSaved(list => {
      const current = ++revision;
      Promise.all(list.filter(x => x.type === 'video').map(x => getVideo(x.itemId)))
        .then(videos => { if (active && revision === current && uid.peek() === viewer) setState({ owner: viewer, videos: videos.filter(Boolean) }); })
        .catch(() => { if (active && revision === current) setState({ owner: viewer, videos: [], error: true }); });
    });
    return () => { active = false; stop(); };
  }, [viewer]);
  const videos = state.owner === viewer ? state.videos : null;
  if (state.owner === viewer && state.error) return <Empty icon="warning" title={t('common.error')} />;
  if (!videos) return <div class="center-pad"><Spinner /></div>;
  if (!videos.length) return <Empty icon="bookmark-simple" title={t('video.noSaved')} />;
  return <div class="video-grid">{videos.map((v) => <VideoCard key={v.id} video={v} />)}</div>;
}

/** Video hub: latest videos, channels, saved. */
export default function Video() {
  useTitle(t('nav.video'));
  const tab = query.value.get('tab') || 'latest';
  const [upload, setUpload] = useState(false);
  const [creating, setCreating] = useState(false);
  const uploadRequested = query.value.get('upload') === '1';
  useEffect(() => { setUpload(false); setCreating(false); }, [uid.value]);
  useEffect(() => {
    if (uploadRequested && uid.value) { setUpload(true); setQuery({ upload: null }); }
  }, [uploadRequested, uid.value]);
  return (
    <div class="page-pad video-page">
      <div class="page-head video-hub-head">
        <div><h1 class="page-title">{t('nav.video')}</h1><p class="muted small video-hub-intro">{t('video.hubIntro')}</p></div>
        <div class="video-hub-actions">
          <Button variant="secondary" icon="television-simple" onClick={() => { if (requireLogin('video')) setCreating(true); }}>{t('video.createChannel')}</Button>
          <Button variant="primary" icon="link" onClick={() => { if (requireLogin('video')) setUpload(true); }}>{t('video.add')}</Button>
        </div>
      </div>
      <Tabs variant="pill" value={tab} onChange={(v) => setQuery({ tab: v === 'latest' ? null : v })} label={t('nav.video')} items={[
        { value: 'latest', label: t('video.latest'), icon: 'play-circle' },
        { value: 'channels', label: t('video.channels'), icon: 'television-simple' },
        ...(uid.value ? [{ value: 'mine', label: t('video.myChannels'), icon: 'user-circle' }] : []),
        { value: 'saved', label: t('nav.saved'), icon: 'bookmark-simple' },
      ]} />
      <div class="video-body">
        {tab === 'latest' && <><ReelsStrip /><Latest /></>}
        {tab === 'channels' && <Channels />}
        {tab === 'mine' && <Channels mine />}
        {tab === 'saved' && <Card><SavedVideos /></Card>}
      </div>
      {upload && <VideoUploadDialog onClose={() => setUpload(false)} />}
      {creating && <CreateChannelDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
