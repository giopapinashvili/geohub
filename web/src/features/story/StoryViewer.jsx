import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { IconButton } from '../../ui/Button.jsx';
import { Menu } from '../../ui/Menu.jsx';
import { Confirm } from '../../ui/Modal.jsx';
import { t, tn } from '../../lib/i18n.js';
import { timeAgo } from '../../lib/format.js';
import { img } from '../../lib/media.js';
import { useBodyLock } from '../../lib/hooks.js';
import { uid } from '../../lib/auth.js';
import { requireLogin } from '../../lib/store.js';
import { toast } from '../../lib/toast.js';
import { markStoryViewed, reactToStory, replyToStory, deleteStory } from '../../data/stories.js';
import { getUsers } from '../../data/users.js';
import { report } from '../../data/social.js';
import { safeBackground } from '../post/backgrounds.js';

const IMAGE_MS = 6000;
const QUICK = ['❤️', '😂', '😮', '😢', '👏', '🔥'];

function Viewers({ story, onClose }) {
  const [users, setUsers] = useState(null);
  useEffect(() => { getUsers(story.viewedBy.slice(0, 100)).then(setUsers); }, [story.id]);
  return (
    <div class="story-viewers" role="dialog" aria-label={t('stories.viewers')}>
      <div class="story-viewers-head">
        <strong>{tn('stories.viewCount', story.viewedBy.length)}</strong>
        <IconButton icon="x" label={t('common.close')} size={32} onClick={onClose} />
      </div>
      <div class="story-viewers-list">
        {users?.map((u) => <a key={u.id} href={`/u/${u.id}`} class="picker-row"><Avatar src={u.avatar} name={u.name} size={36} /><span>{u.name}</span></a>)}
        {users && !users.length && <p class="muted small">{t('stories.noViewers')}</p>}
      </div>
    </div>
  );
}

/** Full-screen story player with progress bars, tap zones and replies. */
export function StoryViewer({ groups, start, onClose }) {
  const [gi, setGi] = useState(start.group);
  const [si, setSi] = useState(start.story || 0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState('');
  const [viewers, setViewers] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef(null);
  const holdRef = useRef(0);
  useBodyLock(true);

  const group = groups[gi];
  const story = group?.stories[si];
  const own = story && story.authorId === uid.value;
  const isVideo = story && (story.mediaType?.startsWith('video') || /\/video\/upload\/|\.(mp4|webm|mov)(\?|$)/i.test(story.mediaUrl || ''));

  const next = () => {
    if (!group) return;
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); }
    else onClose();
  };
  const prev = () => {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { setGi(gi - 1); setSi(groups[gi - 1].stories.length - 1); }
  };

  useEffect(() => { setProgress(0); if (story) markStoryViewed(story); }, [story?.id]);

  // Image timer; videos drive progress from their own clock.
  useEffect(() => {
    if (!story || paused || viewers || isVideo) return undefined;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      setProgress((p) => {
        const n = p + (now - last) / IMAGE_MS;
        last = now;
        if (n >= 1) { next(); return 0; }
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story?.id, paused, viewers, isVideo]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused || viewers) v.pause(); else v.play().catch(() => {});
  }, [paused, viewers, story?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (document.activeElement?.tagName === 'INPUT') { if (e.key === 'Escape') document.activeElement.blur(); return; }
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!story) return null;
  const bg = safeBackground(story.bg) || safeBackground('pomegranate');

  const sendReply = async () => {
    if (!reply.trim() || !requireLogin('reply')) return;
    try { await replyToStory(story, reply); setReply(''); toast.success(t('stories.replySent')); } catch { toast.error(t('common.error')); }
    setPaused(false);
  };
  const react = async (emoji) => {
    if (!requireLogin('like')) return;
    try { await reactToStory(story, emoji); toast(`${emoji} ${t('stories.reacted')}`); } catch { toast.error(t('common.error')); }
  };

  return createPortal(
    <div class="story-viewer" role="dialog" aria-modal="true" aria-label={t('stories.of', { name: group.name })}>
      <div class="story-stage">
        {gi > 0 || si > 0 ? <IconButton icon="caret-left" label={t('common.back')} class="story-arrow is-left" variant="onmedia" size={44} onClick={prev} /> : null}
        <div class="story-frame"
          onPointerDown={() => { holdRef.current = setTimeout(() => setPaused(true), 180); }}
          onPointerUp={(e) => {
            clearTimeout(holdRef.current);
            if (paused && e.pointerType !== 'mouse') { setPaused(false); return; }
            const target = e.target;
            if (target.closest('button, input, a, .story-viewers')) return;
            const r = e.currentTarget.getBoundingClientRect();
            if (e.clientX - r.left < r.width * 0.3) prev(); else next();
          }}>
          {story.mediaUrl ? (
            isVideo
              ? <video ref={videoRef} class="story-media" src={story.mediaUrl} autoPlay muted={muted} playsInline
                  onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration); }} onEnded={next} />
              : <img class="story-media" src={img(story.mediaUrl, 720)} alt="" referrerpolicy="no-referrer" />
          ) : (
            <div class="story-textbg" style={{ background: bg.css }}><p>{story.text}</p></div>
          )}
          {story.mediaUrl && story.text && <p class="story-caption">{story.text}</p>}
          <div class="story-top">
            <div class="story-bars">
              {group.stories.map((s, i) => (
                <span key={s.id} class="story-bar"><span style={{ transform: `scaleX(${i < si ? 1 : i === si ? progress : 0})` }} /></span>
              ))}
            </div>
            <div class="story-head">
              <a href={`/u/${group.authorId}`} class="story-author" onClick={onClose}>
                <Avatar src={group.avatar} name={group.name} size={36} />
                <strong>{group.name}</strong>
                <span>{timeAgo(story.createdAt)}</span>
              </a>
              <div class="story-controls">
                {isVideo && <IconButton icon={muted ? 'speaker-slash' : 'speaker-high'} label={t(muted ? 'stories.unmute' : 'stories.mute')} variant="onmedia" size={36} onClick={() => setMuted((m) => !m)} />}
                <IconButton icon={paused ? 'play' : 'pause'} label={t(paused ? 'stories.play' : 'stories.pause')} variant="onmedia" size={36} onClick={() => setPaused((p) => !p)} />
                <Menu label={t('common.more')} width={240} items={[
                  { icon: 'trash', label: t('stories.delete'), danger: true, hidden: !own, onClick: () => { setPaused(true); setConfirmDel(true); } },
                  { icon: 'flag', label: t('common.report'), hidden: own, onClick: () => report('story', story.id, 'inappropriate').then(() => toast(t('report.sent'))).catch(() => toast.error(t('common.error'))) },
                ]} trigger={(p) => <IconButton {...p} icon="dots-three" label={t('common.more')} variant="onmedia" size={36} />} />
                <IconButton icon="x" label={t('common.close')} variant="onmedia" size={36} onClick={onClose} />
              </div>
            </div>
          </div>
          <div class="story-bottom">
            {own ? (
              <button type="button" class="story-seen" onClick={() => { setViewers(true); setPaused(true); }}>
                <Icon name="eye" size={18} />{tn('stories.viewCount', story.viewedBy.length)}
              </button>
            ) : (
              <>
                <div class="story-quick">{QUICK.map((e) => <button key={e} type="button" onClick={() => react(e)} aria-label={e}>{e}</button>)}</div>
                <form class="story-reply" onSubmit={(e) => { e.preventDefault(); sendReply(); }}>
                  <input value={reply} onInput={(e) => setReply(e.currentTarget.value)} onFocus={() => setPaused(true)} onBlur={() => !reply && setPaused(false)}
                    placeholder={t('stories.replyTo', { name: group.name.split(' ')[0] })} aria-label={t('stories.reply')} maxLength={500} />
                  <IconButton icon="paper-plane-right" label={t('common.send')} variant="onmedia" size={40} type="submit" disabled={!reply.trim()} />
                </form>
              </>
            )}
          </div>
          {viewers && <Viewers story={story} onClose={() => { setViewers(false); setPaused(false); }} />}
        </div>
        <IconButton icon="caret-right" label={t('common.next')} class="story-arrow is-right" variant="onmedia" size={44} onClick={next} />
      </div>
      <Confirm open={confirmDel} danger title={t('stories.deleteTitle')} confirmLabel={t('common.delete')}
        onClose={() => { setConfirmDel(false); setPaused(false); }}
        onConfirm={() => deleteStory(story.id).then(() => { setConfirmDel(false); toast(t('stories.deleted')); onClose(); }).catch(() => toast.error(t('common.error')))} />
    </div>,
    document.body,
  );
}
