import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Card, Empty, Skeleton, Spinner } from '../ui/misc.jsx';
import { t, tn } from '../lib/i18n.js';
import { useTitle, useInView, useAsync } from '../lib/hooks.js';
import { query, setQuery } from '../lib/router.js';
import { requireLogin } from '../lib/store.js';
import { fetchVideos, listChannels } from '../data/videos.js';
import { listenSaved } from '../data/posts.js';
import { getVideo } from '../data/videos.js';
import { VideoCard } from '../features/video/VideoCard.jsx';
import { VideoUploadDialog } from '../features/video/VideoUploadDialog.jsx';
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
    } catch { setState({ loading: false, done: true }); }
    busy.current = false;
  }, []);
  useEffect(() => { load(); }, []);
  const sentinel = useInView(() => { if (!state.done && !state.loading) load(); }, { enabled: !state.done && videos.length > 0 });
  return (
    <>
      <div class="video-grid">
        {videos.map((v) => <VideoCard key={v.id} video={v} />)}
        {state.loading && Array.from({ length: videos.length ? 3 : 9 }).map((_, i) => (
          <div key={`s${i}`} class="video-card"><Skeleton h="auto" r={12} style={{ aspectRatio: '16/9' }} /><Skeleton w="80%" h={14} style={{ marginTop: 10 }} /><Skeleton w="50%" h={12} style={{ marginTop: 6 }} /></div>
        ))}
      </div>
      {!state.loading && !videos.length && <Empty icon="monitor-play" title={t('video.empty')} />}
      <div ref={sentinel} class="feed-sentinel" />
    </>
  );
}

function Channels() {
  const { data } = useAsync(() => listChannels(60), []);
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
  const [ids, setIds] = useState(null);
  const [videos, setVideos] = useState(null);
  useEffect(() => listenSaved((list) => setIds(list.filter((x) => x.type === 'video').map((x) => x.itemId))), []);
  useEffect(() => { if (ids) Promise.all(ids.map(getVideo)).then((v) => setVideos(v.filter(Boolean))); }, [ids]);
  if (!videos) return <div class="center-pad"><Spinner /></div>;
  if (!videos.length) return <Empty icon="bookmark-simple" title={t('video.noSaved')} />;
  return <div class="video-grid">{videos.map((v) => <VideoCard key={v.id} video={v} />)}</div>;
}

/** Video hub: latest videos, channels, saved. */
export default function Video() {
  useTitle(t('nav.video'));
  const tab = query.value.get('tab') || 'latest';
  const [upload, setUpload] = useState(false);
  return (
    <div class="page-pad video-page">
      <div class="page-head">
        <h1 class="page-title">{t('nav.video')}</h1>
        <Button variant="primary" icon="plus" onClick={() => { if (requireLogin('video')) setUpload(true); }}>{t('video.add')}</Button>
      </div>
      <Tabs variant="pill" value={tab} onChange={(v) => setQuery({ tab: v === 'latest' ? null : v })} label={t('nav.video')} items={[
        { value: 'latest', label: t('video.latest'), icon: 'play-circle' },
        { value: 'channels', label: t('video.channels'), icon: 'television-simple' },
        { value: 'saved', label: t('nav.saved'), icon: 'bookmark-simple' },
      ]} />
      <div class="video-body">
        {tab === 'latest' && <><ReelsStrip /><Latest /></>}
        {tab === 'channels' && <Channels />}
        {tab === 'saved' && <Card><SavedVideos /></Card>}
      </div>
      {upload && <VideoUploadDialog onClose={() => setUpload(false)} />}
    </div>
  );
}
