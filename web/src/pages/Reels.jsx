import { useEffect, useRef, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Menu } from '../ui/Menu.jsx';
import { Modal, Confirm } from '../ui/Modal.jsx';
import { Empty, Img, Spinner } from '../ui/misc.jsx';
import { t, tn, formatCount } from '../lib/i18n.js';
import { useTitle, isDesktop } from '../lib/hooks.js';
import { query, navigate, back, path } from '../lib/router.js';
import { uid, isAdmin } from '../lib/auth.js';
import { requireLogin } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { fetchReels, getVideo, countVideoView, isVideoLiked, setVideoLiked, reportVideo, deleteVideo } from '../data/videos.js';
import { VideoPlayer } from '../features/video/VideoCard.jsx';
import { VideoComments } from '../features/video/VideoComments.jsx';
import { VideoUploadDialog } from '../features/video/VideoUploadDialog.jsx';
import { copyLink } from '../features/post/ShareDialog.jsx';

function Reel({ video, index, active, near, sound, onSound, onComments, onDeleted }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(video.likeCount);
  const [paused, setPaused] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const videoRef = useRef(null);
  useEffect(() => { if (uid.value) isVideoLiked(video.id).then(setLiked); }, [video.id, uid.value]);
  useEffect(() => {
    const el = videoRef.current?.base || videoRef.current;
    if (!(el instanceof HTMLVideoElement)) return;
    if (active && !paused) el.play().catch(() => {}); else el.pause();
  }, [active, paused]);
  useEffect(() => { if (!active) setPaused(false); }, [active]);

  const toggleLike = async () => {
    if (!requireLogin('like')) return;
    const next = !liked;
    setLiked(next); setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    try { await setVideoLiked(video.id, next); } catch { setLiked(!next); toast.error(t('common.error')); }
  };
  const own = video.authorId === uid.value;
  const authorHref = video.channelId ? `/video/channel/${video.channelId}` : `/u/${video.authorId}`;
  const authorName = video.channelName || video.authorName || 'GeoHub';

  return (
    <section class="reel" data-i={index} aria-label={video.title}>
      <div class="reel-stage">
        {active && video.youtubeId && <VideoPlayer video={video} autoplay muted={!sound} loop controls={false} />}
        {near && !video.youtubeId && (
          <video ref={videoRef} class="video-frame" src={video.videoUrl} poster={video.thumbnail || undefined} muted={!sound} loop playsInline preload={active ? 'auto' : 'metadata'} />
        )}
        {(video.youtubeId || !near) && <Img src={video.thumbnail} width={540} class="reel-poster" alt="" fallback={null} />}
        {!video.youtubeId && active && (
          <button type="button" class="reel-tap" aria-label={t(paused ? 'reels.play' : 'reels.pause')} onClick={() => setPaused((p) => !p)} />
        )}
        {paused && active && <span class="reel-muted"><Icon name="play-fill" size={30} /></span>}
        <span class="reel-shade" />
        <div class="reel-info">
          <a href={authorHref} class="reel-author">
            <Avatar src={video.channelAvatar || video.authorAvatar} name={authorName} size={36} />
            <span>{authorName}</span>
          </a>
          <p class="reel-title">{video.title}</p>
        </div>
      </div>
      <div class="reel-actions">
        <button type="button" class={`reel-act${liked ? ' is-on' : ''}`} onClick={toggleLike} aria-pressed={liked} aria-label={t('reels.like')}>
          <span class="reel-act-ico"><Icon name={liked ? 'heart-fill' : 'heart'} size={26} /></span>{formatCount(likes)}
        </button>
        <button type="button" class="reel-act" onClick={() => onComments(video)} aria-label={t('reels.comments')}>
          <span class="reel-act-ico"><Icon name="chat-circle-fill" size={26} /></span>{formatCount(video.commentCount)}
        </button>
        <button type="button" class="reel-act" onClick={() => copyLink(`${location.origin}/reels/${video.id}`)} aria-label={t('common.share')}>
          <span class="reel-act-ico"><Icon name="share-fat-fill" size={26} /></span>{t('common.share')}
        </button>
        <button type="button" class="reel-act" onClick={onSound} aria-pressed={sound} aria-label={t(sound ? 'reels.mute' : 'reels.unmute')}>
          <span class="reel-act-ico"><Icon name={sound ? 'speaker-high' : 'speaker-slash'} size={24} /></span>
        </button>
        <Menu label={t('common.more')} width={220} items={[
          { icon: 'flag', label: t('common.report'), hidden: own, onClick: () => { if (requireLogin('report')) reportVideo(video.id, 'inappropriate').finally(() => toast(t('report.sent'))); } },
          { icon: 'trash', label: t('common.delete'), danger: true, hidden: !own && !isAdmin.value, onClick: () => setConfirmDel(true) },
          { icon: 'eye', label: tn('video.views', video.viewCount), onClick: () => {} },
        ]} trigger={(p) => (
          <button type="button" {...p} class="reel-act" aria-label={t('common.more')}><span class="reel-act-ico"><Icon name="dots-three" size={26} /></span></button>
        )} />
      </div>
      <Confirm open={confirmDel} danger title={t('video.deleteTitle')} confirmLabel={t('common.delete')} onClose={() => setConfirmDel(false)}
        onConfirm={() => deleteVideo(video.id).then(() => { toast(t('video.deleted')); onDeleted(video.id); }).catch(() => toast.error(t('common.error')))} />
    </section>
  );
}

/** Full-height vertical reels with snap scrolling; one plays at a time. */
export default function Reels({ params }) {
  useTitle(t('nav.reels'));
  const [reels, setReels] = useState(null);
  const [active, setActive] = useState(0);
  const [sound, setSound] = useState(false);
  const [comments, setComments] = useState(null);
  const [upload, setUpload] = useState(() => query.value.get('upload') === '1');
  const scroller = useRef(null);
  const target = useRef(params.id || null);

  const scrollTo = (i, smooth) => {
    const el = scroller.current?.children[i];
    if (el) scroller.current.scrollTo({ top: el.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      let list = await fetchReels(40).catch(() => []);
      const id = target.current;
      if (id && !list.some((r) => r.id === id)) {
        const v = await getVideo(id).catch(() => null);
        if (v && v.status === 'active') list = [v, ...list];
      }
      if (alive) setReels(list);
    })();
    return () => { alive = false; };
  }, []);

  // A reel published from this page (or a link to one) that isn't loaded yet.
  useEffect(() => {
    if (!reels || !params.id || reels.some((r) => r.id === params.id)) return;
    getVideo(params.id).then((v) => {
      if (!v || v.status !== 'active') return;
      target.current = v.id;
      setReels((list) => [v, ...list.filter((r) => r.id !== v.id)]);
    });
  }, [params.id, reels]);

  useEffect(() => {
    if (!reels?.length) return;
    const i = Math.max(0, reels.findIndex((r) => r.id === target.current));
    target.current = null;
    setActive(i);
    requestAnimationFrame(() => scrollTo(i));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number(e.target.dataset.i));
    }, { root: scroller.current, threshold: 0.6 });
    [...scroller.current.children].forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [reels]);

  useEffect(() => {
    const r = reels?.[active];
    if (!r) return;
    countVideoView(r.id);
    if (path.value !== `/reels/${r.id}`) navigate(`/reels/${r.id}`, { replace: true, keepScroll: true });
  }, [active, reels]);

  useEffect(() => {
    const onKey = (e) => {
      if (comments || upload || e.target.closest?.('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); scrollTo(Math.min(active + 1, (reels?.length || 1) - 1), true); }
      if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); scrollTo(Math.max(active - 1, 0), true); }
      if (e.key === 'm') setSound((s) => !s);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, reels, comments, upload]);

  const add = () => { if (requireLogin('video')) setUpload(true); };

  return (
    <div class="reels">
      <div class="reels-top">
        <div class="row gap-8">
          {!isDesktop() && <IconButton icon="arrow-left" label={t('common.back')} onClick={() => back('/')} size={40} />}
          <h1 class="reels-title">{t('nav.reels')}</h1>
        </div>
        <IconButton icon="plus" label={t('video.addReel')} onClick={add} size={40} />
      </div>
      {!reels && <div class="reels-empty"><Spinner /></div>}
      {reels && !reels.length && (
        <div class="reels-empty">
          <Empty icon="film-strip" title={t('reels.empty')} text={t('reels.emptyText')} action={<Button variant="primary" icon="plus" onClick={add}>{t('video.addReel')}</Button>} />
        </div>
      )}
      {reels?.length > 0 && (
        <div class="reels-scroller" ref={scroller}>
          {reels.map((v, i) => (
            <Reel key={v.id} video={v} index={i} active={i === active} near={Math.abs(i - active) <= 1}
              sound={sound} onSound={() => setSound((s) => !s)} onComments={setComments}
              onDeleted={(id) => setReels((list) => list.filter((r) => r.id !== id))} />
          ))}
        </div>
      )}
      {isDesktop() && reels?.length > 1 && (
        <div class="reels-nav">
          <IconButton icon="caret-up" label={t('reels.prev')} size={44} disabled={active === 0} onClick={() => scrollTo(active - 1, true)} />
          <IconButton icon="caret-down" label={t('reels.next')} size={44} disabled={active >= reels.length - 1} onClick={() => scrollTo(active + 1, true)} />
        </div>
      )}
      <Modal open={!!comments} onClose={() => setComments(null)} title={t('reels.comments')} size="md">
        {comments && <VideoComments video={comments} heading={false} />}
      </Modal>
      {upload && <VideoUploadDialog short onClose={() => setUpload(false)} />}
    </div>
  );
}
