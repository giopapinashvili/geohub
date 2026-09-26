import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Menu } from '../ui/Menu.jsx';
import { Empty, PageSpinner, Card } from '../ui/misc.jsx';
import { Confirm } from '../ui/Modal.jsx';
import { t, tn, formatCount } from '../lib/i18n.js';
import { useTitle, useLive, useAsync } from '../lib/hooks.js';
import { formatDate } from '../lib/format.js';
import { uid, isAdmin } from '../lib/auth.js';
import { requireLogin } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { navigate } from '../lib/router.js';
import {
  listenVideo, relatedVideos, countVideoView, isVideoLiked, setVideoLiked, reportVideo, getChannel, isSubscribed,
  setSubscribed, deleteVideo,
} from '../data/videos.js';
import { isSaved, setSaved } from '../data/posts.js';
import { VideoCard, VideoPlayer } from '../features/video/VideoCard.jsx';
import { VideoComments } from '../features/video/VideoComments.jsx';
import { RichText } from '../features/post/PostText.jsx';
import { copyLink } from '../features/post/ShareDialog.jsx';

export function SubscribeButton({ channel, onChange }) {
  const [on, setOn] = useState(false);
  useEffect(() => { isSubscribed(channel.id).then(setOn); }, [channel.id, uid.value]);
  if (channel.ownerId === uid.value) return <Button variant="secondary" href={`/video/channel/${channel.id}`}>{t('video.yourChannel')}</Button>;
  return (
    <Button variant={on ? 'secondary' : 'primary'} icon={on ? 'bell-ringing' : 'bell'} onClick={async () => {
      if (!requireLogin('subscribe')) return;
      const next = !on;
      setOn(next); onChange?.(next ? 1 : -1);
      try { await setSubscribed(channel.id, next); } catch { setOn(!next); onChange?.(next ? -1 : 1); toast.error(t('common.error')); }
    }}>{t(on ? 'video.subscribed' : 'video.subscribe')}</Button>
  );
}

/** Watch page: player, actions, channel, description, comments, related. */
export default function Watch({ params }) {
  const { data: video, loading } = useLive((ok, err) => listenVideo(params.id, ok, err), [params.id]);
  const related = useAsync(() => (video ? relatedVideos(video, 14) : Promise.resolve([])), [video?.id]);
  const channel = useAsync(() => (video?.channelId ? getChannel(video.channelId) : Promise.resolve(null)), [video?.channelId]);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [saved, setSavedState] = useState(false);
  const [more, setMore] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  useTitle(video?.title || t('nav.video'));
  useEffect(() => { if (video) { countVideoView(video.id); setLikes(video.likeCount); } }, [video?.id]);
  useEffect(() => { if (video && uid.value) { isVideoLiked(video.id).then(setLiked); isSaved('video', video.id).then(setSavedState); } }, [video?.id, uid.value]);

  if (loading) return <PageSpinner />;
  if (!video || video.status !== 'active') return <Card><Empty icon="monitor-play" title={t('video.unavailable')} action={<Button variant="primary" href="/video">{t('nav.video')}</Button>} /></Card>;

  const toggleLike = async () => {
    if (!requireLogin('like')) return;
    const next = !liked;
    setLiked(next); setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    try { await setVideoLiked(video.id, next); } catch { setLiked(!next); toast.error(t('common.error')); }
  };
  const toggleSave = async () => {
    if (!requireLogin('save')) return;
    try { await setSaved('video', video.id, !saved, { title: video.title, image: video.thumbnail }); setSavedState(!saved); toast(t(saved ? 'saved.removed' : 'saved.added')); }
    catch { toast.error(t('common.error')); }
  };
  const own = video.authorId === uid.value;
  const ch = channel.data;
  const bumpSubs = (d) => channel.setData({ ...ch, subscriberCount: Math.max(0, ch.subscriberCount + d) });

  return (
    <div class="watch">
      <div class="watch-main">
        <div class="watch-player"><VideoPlayer video={video} autoplay /></div>
        <h1 class="watch-title">{video.title}</h1>
        <div class="watch-bar">
          <div class="watch-channel">
            <Avatar src={ch?.avatar || video.channelAvatar || video.authorAvatar} name={ch?.name || video.channelName || video.authorName} size={44}
              href={video.channelId ? `/video/channel/${video.channelId}` : `/u/${video.authorId}`} />
            <div class="watch-channel-text">
              <a href={video.channelId ? `/video/channel/${video.channelId}` : `/u/${video.authorId}`} class="bold">{ch?.name || video.channelName || video.authorName}</a>
              {ch && <span class="muted small">{tn('video.subscribers', ch.subscriberCount)}</span>}
            </div>
            {ch && <SubscribeButton channel={ch} onChange={bumpSubs} />}
          </div>
          <div class="watch-actions">
            <Button variant={liked ? 'soft' : 'secondary'} icon={liked ? 'thumbs-up-fill' : 'thumbs-up'} onClick={toggleLike}>{formatCount(likes)}</Button>
            <Button variant="secondary" icon="share-fat" onClick={() => copyLink(`${location.origin}/watch/${video.id}`)}>{t('common.share')}</Button>
            <Button variant={saved ? 'soft' : 'secondary'} icon={saved ? 'bookmark-simple-fill' : 'bookmark-simple'} onClick={toggleSave}>{t(saved ? 'common.saved' : 'post.save')}</Button>
            <Menu label={t('common.more')} width={240} items={[
              { icon: 'flag', label: t('common.report'), hidden: own, onClick: () => { if (requireLogin('report')) reportVideo(video.id, 'inappropriate').then(() => toast(t('report.sent'))).catch(() => toast(t('report.sent'))); } },
              { icon: 'trash', label: t('common.delete'), danger: true, hidden: !own && !isAdmin.value, onClick: () => setConfirmDel(true) },
            ]} trigger={(p) => <IconButton {...p} icon="dots-three" label={t('common.more')} variant="soft" size={40} />} />
          </div>
        </div>
        <div class={`watch-desc${more ? ' is-open' : ''}`}>
          <strong class="small">{tn('video.views', video.viewCount)} · {formatDate(video.createdAt)}</strong>
          {video.description && <p><RichText text={more ? video.description : video.description.slice(0, 240)} />{video.description.length > 240 && !more && '…'}</p>}
          {video.description.length > 240 && <button type="button" class="link small" onClick={() => setMore((m) => !m)}>{t(more ? 'common.seeLess' : 'common.seeMore')}</button>}
          {video.placeName && <a href={video.placeId ? `/place/${video.placeId}` : '#'} class="tag tag-success"><Icon name="map-pin" size={12} />{video.placeName}</a>}
        </div>
        <VideoComments video={video} />
      </div>
      <aside class="watch-side">
        <h2 class="card-title">{t('video.upNext')}</h2>
        <div class="watch-related">{related.data?.map((v) => <VideoCard key={v.id} video={v} compact />)}</div>
      </aside>
      <Confirm open={confirmDel} danger title={t('video.deleteTitle')} confirmLabel={t('common.delete')} onClose={() => setConfirmDel(false)}
        onConfirm={() => deleteVideo(video.id).then(() => { toast(t('video.deleted')); navigate('/video'); }).catch(() => toast.error(t('common.error')))} />
    </div>
  );
}
