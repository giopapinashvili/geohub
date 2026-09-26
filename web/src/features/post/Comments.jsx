import { useEffect, useRef, useState } from 'preact/hooks';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Menu } from '../../ui/Menu.jsx';
import { IconButton } from '../../ui/Button.jsx';
import { Spinner } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { timeAgo } from '../../lib/format.js';
import { profile, uid, isAdmin } from '../../lib/auth.js';
import { requireLogin } from '../../lib/store.js';
import { toast } from '../../lib/toast.js';
import {
  listenComments, addComment, editComment, removeComment, listenReplies, addReply, deleteReply,
  getMyCommentReaction, setCommentReaction, REACTION_EMOJI,
} from '../../data/posts.js';
import { report } from '../../data/social.js';
import { RichText } from './PostText.jsx';

/** Growing textarea with a send button. Enter sends, Shift+Enter breaks a line. */
export function CommentInput({ onSubmit, placeholder, autoFocus, initial = '', onCancel, compact }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const p = profile.value;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [text]);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    if (!requireLogin('comment')) return;
    setBusy(true);
    try { await onSubmit(v); setText(''); } catch (e) { toast.error(t(e?.code === 'blocked' ? 'comments.blocked' : 'common.error')); }
    setBusy(false);
  };
  return (
    <div class={`cmt-input${compact ? ' is-compact' : ''}`}>
      {!onCancel && <Avatar src={p?.avatar} name={p?.name || ''} size={compact ? 28 : 34} />}
      <div class="cmt-input-box">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={placeholder || t('comments.write')}
          aria-label={placeholder || t('comments.write')}
          maxLength={2000}
          onInput={(e) => setText(e.currentTarget.value)}
          onFocus={() => requireLogin('comment')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            if (e.key === 'Escape' && onCancel) onCancel();
          }}
        />
        <button type="button" class="cmt-send" disabled={!text.trim() || busy} onClick={send} aria-label={t('common.send')}>
          {busy ? <Spinner size={16} /> : <Icon name="paper-plane-right" size={18} />}
        </button>
      </div>
      {onCancel && <button type="button" class="link small" onClick={onCancel}>{t('common.cancel')}</button>}
    </div>
  );
}

function CommentReaction({ postId, comment, count }) {
  const [mine, setMine] = useState('');
  const [n, setN] = useState(count);
  useEffect(() => { setN(count); }, [count]);
  useEffect(() => { if (uid.value) getMyCommentReaction(postId, comment.id).then(setMine); }, [postId, comment.id, uid.value]);
  const toggle = async () => {
    if (!requireLogin('like')) return;
    const next = mine ? '' : 'like';
    const prev = mine;
    setMine(next);
    setN((x) => Math.max(0, x + (next ? 1 : -1)));
    try { await setCommentReaction(postId, comment, next, prev); } catch { setMine(prev); setN(count); toast.error(t('common.error')); }
  };
  return (
    <>
      <button type="button" class={`cmt-meta-btn${mine ? ' is-on' : ''}`} onClick={toggle} aria-pressed={mine ? 'true' : 'false'}>{t('react.like')}</button>
      {n > 0 && <span class="cmt-rx" aria-label={t('react.count', { n })}>{REACTION_EMOJI[mine] || '👍'} {n}</span>}
    </>
  );
}

function Replies({ post, comment, open, onReplyToggle, replying }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    return listenReplies(post.id, comment.id, setList);
  }, [open, post.id, comment.id]);
  if (!open) return null;
  return (
    <div class="cmt-replies">
      {list === null && <Spinner size={16} />}
      {list?.filter((r) => r.status !== 'deleted').map((r) => (
        <CommentItem key={r.id} post={post} comment={r} isReply parent={comment} />
      ))}
      {replying && <CommentInput compact autoFocus placeholder={t('comments.replyTo', { name: comment.authorName })} onCancel={onReplyToggle} onSubmit={(v) => addReply(post.id, comment, v)} />}
    </div>
  );
}

function CommentItem({ post, comment, isReply, parent, highlight }) {
  const [editing, setEditing] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replying, setReplying] = useState(false);
  const me = uid.value;
  const mine = me && (comment.userId === me || comment.authorId === me);
  const ownsPost = me && post.authorId === me;
  const ref = useRef(null);
  useEffect(() => { if (highlight) ref.current?.scrollIntoView({ block: 'center' }); }, [highlight]);

  if (comment.status === 'deleted') {
    return comment.replyCount ? <div class="cmt cmt-deleted"><span class="muted small">{t('comments.deleted')}</span></div> : null;
  }
  const remove = async () => {
    try {
      if (isReply) await deleteReply(post.id, parent.id, comment.id);
      else await removeComment(post.id, comment);
      toast(t('comments.removed'));
    } catch { toast.error(t('common.error')); }
  };
  return (
    <div ref={ref} class={`cmt${isReply ? ' is-reply' : ''}${highlight ? ' is-highlight' : ''}`} id={`comment-${comment.id}`}>
      <Avatar src={comment.authorAvatar} name={comment.authorName} size={isReply ? 28 : 34} href={comment.authorType === 'business' && comment.businessId ? `/business/${comment.businessId}` : `/u/${comment.authorId}`} />
      <div class="cmt-main">
        {editing ? (
          <CommentInput compact autoFocus initial={comment.text} onCancel={() => setEditing(false)} onSubmit={async (v) => { await editComment(post.id, comment.id, v); setEditing(false); }} />
        ) : (
          <div class="cmt-row">
            <div class="cmt-bubble">
              <a class="cmt-name" href={comment.authorType === 'business' && comment.businessId ? `/business/${comment.businessId}` : `/u/${comment.authorId}`}>{comment.authorName}</a>
              <div class="cmt-text"><RichText text={comment.text} /></div>
              {comment.voiceUrl && <audio class="cmt-audio" src={comment.voiceUrl} controls preload="none" />}
            </div>
            {(mine || ownsPost || isAdmin.value || me) && (
              <Menu label={t('common.more')} width={220} items={[
                { icon: 'pencil-simple', label: t('common.edit'), onClick: () => setEditing(true), hidden: !mine || isReply },
                { icon: 'trash', label: t('common.delete'), onClick: remove, danger: true, hidden: !(mine || ownsPost || isAdmin.value) },
                { icon: 'flag', label: t('common.report'), onClick: () => report('comment', `${post.id}/${comment.id}`, 'inappropriate').then(() => toast(t('report.sent'))).catch(() => toast.error(t('common.error'))), hidden: mine },
              ]} trigger={(p) => <IconButton {...p} icon="dots-three" label={t('common.more')} size={30} class="cmt-more" />} />
            )}
          </div>
        )}
        {!editing && (
          <div class="cmt-meta">
            <span class="muted">{timeAgo(comment.createdAt)}</span>
            {!isReply && <CommentReaction postId={post.id} comment={comment} count={comment.reactionCount} />}
            {!isReply && <button type="button" class="cmt-meta-btn" onClick={() => { if (!requireLogin('comment')) return; setShowReplies(true); setReplying((r) => !r); }}>{t('comments.reply')}</button>}
            {comment.edited && <span class="muted">{t('messages.edited')}</span>}
          </div>
        )}
        {!isReply && comment.replyCount > 0 && !showReplies && (
          <button type="button" class="cmt-view-replies" onClick={() => setShowReplies(true)}>
            <Icon name="arrow-bend-up-left" size={16} style={{ transform: 'scaleY(-1)' }} />{t('comments.viewReplies', { n: comment.replyCount })}
          </button>
        )}
        {!isReply && <Replies post={post} comment={comment} open={showReplies} replying={replying} onReplyToggle={() => setReplying(false)} />}
      </div>
    </div>
  );
}

/**
 * Comment thread under a post. Loads only when opened; `highlightId`
 * scrolls to a comment linked from a notification.
 */
export function Comments({ post, highlightId, focusInput, preview = 3 }) {
  const [list, setList] = useState(null);
  const [limit, setLimit] = useState(highlightId ? 200 : 50);
  const [expanded, setExpanded] = useState(!!highlightId);
  useEffect(() => listenComments(post.id, setList, limit), [post.id, limit]);
  const visible = (list || []).filter((c) => c.status !== 'deleted' || c.replyCount);
  const shown = expanded ? visible : visible.slice(-preview);
  const hidden = visible.length - shown.length;
  return (
    <div class="comments">
      {list === null && <div class="comments-loading"><Spinner size={18} /></div>}
      {hidden > 0 && <button type="button" class="comments-more" onClick={() => setExpanded(true)}>{t('comments.viewMore', { n: hidden })}</button>}
      {expanded && list && list.length >= limit && <button type="button" class="comments-more" onClick={() => setLimit((l) => l + 50)}>{t('comments.older')}</button>}
      {shown.map((c) => <CommentItem key={c.id} post={post} comment={c} highlight={c.id === highlightId} />)}
      {post.commentsDisabled
        ? <p class="muted small comments-off">{t('comments.disabled')}</p>
        : <CommentInput autoFocus={focusInput} onSubmit={(v) => addComment(post, v)} />}
    </div>
  );
}
