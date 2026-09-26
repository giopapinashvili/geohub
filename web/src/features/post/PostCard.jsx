import { useEffect, useRef, useState } from 'preact/hooks';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { IconButton } from '../../ui/Button.jsx';
import { Menu } from '../../ui/Menu.jsx';
import { Verified } from '../../ui/misc.jsx';
import { Confirm, Modal } from '../../ui/Modal.jsx';
import { TextArea, Segmented } from '../../ui/Field.jsx';
import { t, tn, formatCount } from '../../lib/i18n.js';
import { timeAgo, formatDate } from '../../lib/format.js';
import { uid, isAdmin } from '../../lib/auth.js';
import { requireLogin } from '../../lib/store.js';
import { toast } from '../../lib/toast.js';
import {
  getMyReaction, setReaction, isSaved, setSaved, deletePost, editPost, getPost, trackView, REACTION_EMOJI,
} from '../../data/posts.js';
import { hidePost, report, unfollow, blockUser } from '../../data/social.js';
import { PostText } from './PostText.jsx';
import { MediaGrid } from './MediaGrid.jsx';
import { ReactionButton } from './ReactionButton.jsx';
import { Comments } from './Comments.jsx';
import { Poll } from './Poll.jsx';
import { ShareDialog, copyLink, postUrl } from './ShareDialog.jsx';
import { ReactionsDialog } from './ReactionsDialog.jsx';
import { safeBackground } from './backgrounds.js';

export const AUDIENCE = {
  public: { icon: 'globe-hemisphere-east', label: 'audience.public' },
  friends: { icon: 'users', label: 'audience.friends' },
  followers: { icon: 'user-check', label: 'audience.followers' },
  close_friends: { icon: 'star', label: 'audience.closeFriends' },
  onlyme: { icon: 'lock', label: 'audience.onlyMe' },
  only_me: { icon: 'lock', label: 'audience.onlyMe' },
  private: { icon: 'lock', label: 'audience.onlyMe' },
};

/** Compact preview of a shared (reposted) post. */
function SharedPost({ id }) {
  const [p, setP] = useState(undefined);
  useEffect(() => { getPost(id).then(setP).catch(() => setP(null)); }, [id]);
  if (p === undefined) return <div class="shared-post is-loading" />;
  if (!p || p.status !== 'active') {
    return <div class="shared-post is-gone"><Icon name="prohibit" size={20} /><span>{t('post.unavailable')}</span></div>;
  }
  return (
    <a href={`/post/${p.id}`} class="shared-post">
      {p.media.length > 0 && <MediaGrid media={p.media.slice(0, 1)} mediaType={p.mediaType} />}
      <div class="shared-post-body">
        <div class="post-author-line">
          <Avatar src={p.authorAvatar} name={p.authorName} size={28} />
          <strong>{p.authorName}</strong>
          <span class="muted small">· {timeAgo(p.createdAt)}</span>
        </div>
        {p.text && <p class="shared-post-text">{p.text.slice(0, 280)}{p.text.length > 280 ? '…' : ''}</p>}
      </div>
    </a>
  );
}

function EditDialog({ post, onClose }) {
  const [text, setText] = useState(post.text);
  const [aud, setAud] = useState(AUDIENCE[post.visibility] ? (post.visibility === 'only_me' ? 'onlyme' : post.visibility) : 'public');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await editPost(post.id, { text: text.trim(), visibility: aud }); toast.success(t('common.saved')); onClose(true, { text: text.trim(), visibility: aud }); }
    catch { toast.error(t('common.error')); }
    setBusy(false);
  };
  return (
    <Modal open onClose={() => onClose(false)} title={t('post.edit')} size="md"
      footer={<><button type="button" class="btn btn-secondary btn-md" onClick={() => onClose(false)}>{t('common.cancel')}</button><button type="button" class="btn btn-primary btn-md" disabled={busy || (!text.trim() && !post.media.length)} onClick={save}>{t('common.save')}</button></>}>
      <TextArea value={text} onInput={(e) => setText(e.currentTarget.value)} maxLength={5000} minRows={4} label={t('post.text')} />
      <div class="field">
        <span class="field-label">{t('audience.title')}</span>
        <Segmented value={aud} onChange={setAud} label={t('audience.title')} options={[
          { value: 'public', label: t('audience.public'), icon: 'globe-hemisphere-east' },
          { value: 'friends', label: t('audience.friends'), icon: 'users' },
          { value: 'onlyme', label: t('audience.onlyMe'), icon: 'lock' },
        ]} />
      </div>
    </Modal>
  );
}

/**
 * A post in any list (feed, profile, group, business, single post page).
 * Reactions and saves update optimistically; comments load on demand.
 */
export function PostCard({ post: initial, openComments = false, highlightComment, onRemoved, context }) {
  const [post, setPost] = useState(initial);
  const [mine, setMine] = useState('');
  const [likes, setLikes] = useState(initial.likeCount);
  const [saved, setSavedState] = useState(false);
  const [showComments, setShowComments] = useState(openComments);
  const [focusComment, setFocusComment] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [gone, setGone] = useState(false);
  const ref = useRef(null);
  const me = uid.value;
  const own = me && post.authorId === me;

  useEffect(() => { setPost(initial); setLikes(initial.likeCount); }, [initial]);
  useEffect(() => {
    if (!me) { setMine(''); return; }
    getMyReaction(post.id).then(setMine);
  }, [post.id, me]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !me) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { trackView(post.id); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [post.id, me]);

  if (gone) return null;

  const react = async (type) => {
    if (!requireLogin('like')) return;
    const prev = mine;
    const delta = !prev && type ? 1 : prev && !type ? -1 : 0;
    setMine(type);
    setLikes((n) => Math.max(0, n + delta));
    try { await setReaction(post, type, prev); }
    catch { setMine(prev); setLikes((n) => Math.max(0, n - delta)); toast.error(t('common.error')); }
  };

  const toggleSave = async () => {
    if (!requireLogin('save')) return;
    const was = saved || (await isSaved('post', post.id));
    try { await setSaved('post', post.id, !was); setSavedState(!was); toast(t(was ? 'saved.removed' : 'saved.added')); }
    catch { toast.error(t('common.error')); }
  };

  const bg = !post.media.length && !post.poll && post.text.length <= 180 ? safeBackground(post.bgGradient) : null;
  const aud = AUDIENCE[post.visibility] || AUDIENCE.public;
  const authorHref = post.authorType === 'business' && post.businessId ? `/business/${post.businessId}` : `/u/${post.authorId}`;

  const menuItems = [
    { icon: 'bookmark-simple', label: t('post.save'), sub: t('post.saveSub'), onClick: toggleSave },
    { icon: 'link', label: t('common.copyLink'), onClick: () => copyLink(postUrl(post.id)) },
    { divider: true, hidden: !own && !isAdmin.value },
    { icon: 'pencil-simple', label: t('post.edit'), onClick: () => setDialog('edit'), hidden: !own },
    { icon: post.commentsDisabled ? 'chat-circle' : 'prohibit', label: t(post.commentsDisabled ? 'post.commentsOn' : 'post.commentsOff'), hidden: !own,
      onClick: () => editPost(post.id, { commentsDisabled: !post.commentsDisabled }).then(() => setPost({ ...post, commentsDisabled: !post.commentsDisabled })).catch(() => toast.error(t('common.error'))) },
    { icon: 'trash', label: t('post.delete'), danger: true, onClick: () => setDialog('delete'), hidden: !own && !isAdmin.value },
    { divider: true, hidden: own },
    { icon: 'eye-slash', label: t('post.hide'), sub: t('post.hideSub'), hidden: own || !me,
      onClick: () => hidePost(post.id).then(() => { setGone(true); toast(t('post.hidden')); onRemoved?.(post.id); }).catch(() => toast.error(t('common.error'))) },
    { icon: 'user-minus', label: t('post.unfollow', { name: post.authorName }), hidden: own || !me || post.authorType === 'business',
      onClick: () => unfollow(post.authorId).then(() => toast(t('follow.unfollowed'))).catch(() => {}) },
    { icon: 'flag', label: t('post.report'), hidden: own, onClick: () => { if (requireLogin('report')) setDialog('report'); } },
    { icon: 'prohibit', label: t('post.block', { name: post.authorName }), danger: true, hidden: own || !me || post.authorType === 'business',
      onClick: () => blockUser(post.authorId).then(() => { setGone(true); toast(t('safety.blocked')); }).catch(() => toast.error(t('common.error'))) },
  ];

  return (
    <article ref={ref} class="card post" aria-labelledby={`post-${post.id}-author`}>
      <header class="post-head">
        <Avatar src={post.authorAvatar} name={post.authorName} size={42} href={authorHref} square={post.authorType === 'business'} />
        <div class="post-head-text">
          <div class="post-author">
            <a id={`post-${post.id}-author`} href={authorHref} class="post-author-name">{post.authorName}</a>
            {(post.authorVerified) && <Verified />}
            {post.feeling && <span class="post-feeling"> — {t('post.feeling', { feeling: post.feeling })}</span>}
            {post.location?.name && (
              <span class="post-feeling"> — {t('post.at')} <a href={post.location.placeId ? `/place/${post.location.placeId}` : `/search?q=${encodeURIComponent(post.location.name)}`} class="post-author-name">{post.location.name}</a></span>
            )}
          </div>
          <div class="post-meta">
            <a href={`/post/${post.id}`} class="post-time" title={formatDate(post.createdAt, { withTime: true })}>{timeAgo(post.createdAt)}</a>
            <span aria-hidden="true">·</span>
            <span title={t(aud.label)}><Icon name={aud.icon} size={13} label={t(aud.label)} /></span>
            {post.status === 'pending' && <span class="tag tag-accent">{t('post.pending')}</span>}
          </div>
        </div>
        <Menu label={t('post.options')} items={menuItems} width={320}
          trigger={(p) => <IconButton {...p} icon="dots-three" label={t('post.options')} size={36} />} />
      </header>

      {bg ? (
        <div class={`post-bg${bg.dark ? ' is-dark' : ''}`} style={{ background: bg.css }}><PostText text={post.text} big /></div>
      ) : (
        <div class="post-body"><PostText text={post.poll && post.text === post.poll.question ? post.poll.question : post.text} /></div>
      )}
      {post.poll && <div class="post-body"><Poll post={post} /></div>}
      {post.media.length > 0 && <MediaGrid media={post.media} mediaType={post.mediaType} alt={post.text.slice(0, 80)} />}
      {post.sharedPostId && <div class="post-body"><SharedPost id={post.sharedPostId} /></div>}

      {(likes > 0 || post.commentCount > 0 || post.shareCount > 0) && (
        <div class="post-stats">
          {likes > 0 ? (
            <button type="button" class="post-stat-rx" onClick={() => setDialog('reactions')}>
              <span class="rx-stack" aria-hidden="true">
                {[...new Set([mine, 'like', 'love'].filter(Boolean))].slice(0, 3).map((k) => <span key={k} class="rx-stack-item">{REACTION_EMOJI[k]}</span>)}
              </span>
              <span>{formatCount(likes)}</span>
            </button>
          ) : <span />}
          <span class="post-stat-right">
            {post.commentCount > 0 && <button type="button" class="post-stat-link" onClick={() => setShowComments((s) => !s)}>{tn('post.comments', post.commentCount)}</button>}
            {post.shareCount > 0 && <span>{tn('post.shares', post.shareCount)}</span>}
          </span>
        </div>
      )}

      <div class="post-actions">
        <ReactionButton value={mine} onChange={react} />
        <button type="button" class="post-action" onClick={() => { setShowComments(true); setFocusComment(true); }} disabled={post.commentsDisabled && !showComments}>
          <Icon name="chat-circle" size={20} /><span>{t('post.comment')}</span>
        </button>
        <button type="button" class="post-action" onClick={() => { if (requireLogin('share')) setDialog('share'); }}>
          <Icon name="share-fat" size={20} /><span>{t('common.share')}</span>
        </button>
      </div>

      {showComments && <Comments post={post} highlightId={highlightComment} focusInput={focusComment} preview={openComments ? 20 : 3} />}

      {dialog === 'share' && <ShareDialog post={post} onClose={() => setDialog(null)} />}
      {dialog === 'reactions' && <ReactionsDialog postId={post.id} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <EditDialog post={post} onClose={(ok, patch) => { setDialog(null); if (ok) setPost({ ...post, ...patch }); }} />}
      {dialog === 'report' && <ReportDialog target={{ type: 'post', id: post.id }} onClose={() => setDialog(null)} />}
      <Confirm open={dialog === 'delete'} onClose={() => setDialog(null)} danger title={t('post.deleteTitle')} text={t('post.deleteText')} confirmLabel={t('common.delete')}
        onConfirm={() => deletePost(post.id).then(() => { setDialog(null); setGone(true); toast(t('post.deleted')); onRemoved?.(post.id); }).catch(() => toast.error(t('common.error')))} />
      {context}
    </article>
  );
}

const REASONS = ['spam', 'harassment', 'hate', 'violence', 'nudity', 'false', 'scam', 'other'];

export function ReportDialog({ target, onClose }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await report(target.type, target.id, reason, details.trim()); toast.success(t('report.sent')); onClose(); }
    catch { toast.error(t('common.error')); }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} title={t('report.title')} size="sm"
      footer={<><button type="button" class="btn btn-secondary btn-md" onClick={onClose}>{t('common.cancel')}</button><button type="button" class="btn btn-danger btn-md" disabled={!reason || busy} onClick={send}>{t('report.send')}</button></>}>
      <p class="muted">{t('report.why')}</p>
      <div class="report-reasons" role="radiogroup">
        {REASONS.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={reason === r ? 'true' : 'false'} class={`report-reason${reason === r ? ' is-active' : ''}`} onClick={() => setReason(r)}>
            {t(`report.r.${r}`)}{reason === r && <Icon name="check" size={18} />}
          </button>
        ))}
      </div>
      {reason && <TextArea label={t('report.details')} optional={t('common.optional')} value={details} onInput={(e) => setDetails(e.currentTarget.value)} maxLength={500} minRows={2} />}
    </Modal>
  );
}
