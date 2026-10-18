import { Fragment } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { IconButton } from '../../ui/Button.jsx';
import { Menu } from '../../ui/Menu.jsx';
import { Spinner, Empty } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { formatDate, formatTime, timeAgo } from '../../lib/format.js';
import { uid } from '../../lib/auth.js';
import { actor } from '../../lib/actor.js';
import { toast } from '../../lib/toast.js';
import { upload, img } from '../../lib/media.js';
import {
  listenMessages, listenConversation, sendMessage, markConversationRead, markMessagesSeen, setTyping,
  toggleMessageReaction, deleteMessage, editMessage,
} from '../../data/messages.js';
import { RichText } from '../post/PostText.jsx';
import { Lightbox } from '../post/Lightbox.jsx';
import { useConversationPeer } from './ConversationRow.jsx';
import { VoiceNote, useVoiceRecorder, canRecordVoice, clock, VOICE_MAX_SECONDS } from './voice.jsx';

const QUICK = ['❤️', '😂', '😮', '😢', '😡', '👍'];

function dayKey(ms) { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

/** What a reply quotes when the original has no text. */
function quoteText(m) {
  if (m.text) return m.text;
  if (m.audioUrl || m.attachments.some((a) => a.type === 'audio')) return '🎤';
  if (m.mediaUrl || m.attachments.some((a) => a.type === 'image')) return '📷';
  return '📎';
}

function Bubble({ m, mine, first, last, peer, onReply, onReact, onEdit, onDelete, actorId, onOpenImage }) {
  const reactions = Object.values(m.reactions || {});
  const counts = reactions.reduce((a, e) => ({ ...a, [e]: (a[e] || 0) + 1 }), {});
  const images = [m.mediaType === 'image' && m.mediaUrl, ...m.attachments.filter((a) => a.type === 'image').map((a) => a.url)].filter(Boolean);
  const uniqueImages = [...new Set(images)];
  const files = m.attachments.filter((a) => a.type !== 'image');
  if (m.audioUrl && !files.some((f) => f.url === m.audioUrl)) files.push({ type: 'audio', url: m.audioUrl, duration: m.audioDuration });
  return (
    <div class={`msg${mine ? ' is-mine' : ''}${first ? ' is-first' : ''}${last ? ' is-last' : ''}`}>
      {!mine && <span class="msg-avatar">{last ? <Avatar src={m.senderAvatar || peer.avatar} name={m.senderName || peer.name} size={28} /> : null}</span>}
      <div class="msg-col">
        {m.replyTo && (
          <div class="msg-quote"><Icon name="arrow-bend-up-left" size={14} /><span>{String(m.replyTo.text || '📎').slice(0, 80)}</span></div>
        )}
        <div class="msg-line">
          <div class={`msg-bubble${m.deletedForEveryone ? ' is-deleted' : ''}${uniqueImages.length && !m.text ? ' is-media' : ''}`} title={formatDate(m.createdAt, { withTime: true })}>
            {m.deletedForEveryone ? <em>{t('messages.deleted')}</em> : (
              <>
                {uniqueImages.map((u) => <button key={u} type="button" class="msg-img" onClick={() => onOpenImage(uniqueImages, uniqueImages.indexOf(u))}><img src={img(u, 480)} alt="" loading="lazy" referrerpolicy="no-referrer" /></button>)}
                {files.map((f) => f.type === 'audio'
                  ? <VoiceNote key={f.url} url={f.url} duration={f.duration} mine={mine} />
                  : <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" class="msg-file"><Icon name="download-simple" size={18} />{f.name || t('messages.attach')}</a>)}
                {m.storyContext && <span class="msg-story"><Icon name="plus-circle" size={14} />{t('messages.storyReply')}</span>}
                {m.text && <span class="msg-text"><RichText text={m.text} /></span>}
                {m.edited && <span class="msg-edited">{t('messages.edited')}</span>}
              </>
            )}
          </div>
          {!m.deletedForEveryone && (
            <div class="msg-actions">
              <Menu label={t('react.pick')} width={260} items={QUICK.map((e) => ({ label: e, onClick: () => onReact(m, e) }))}
                trigger={(p) => <IconButton {...p} icon="smiley" label={t('react.pick')} size={28} />} />
              <IconButton icon="arrow-bend-up-left" label={t('messages.reply')} size={28} onClick={() => onReply(m)} />
              <Menu label={t('common.more')} width={230} items={[
                { icon: 'copy', label: t('messages.copy'), onClick: () => navigator.clipboard?.writeText(m.text).then(() => toast(t('common.linkCopied'))), hidden: !m.text },
                { icon: 'pencil-simple', label: t('common.edit'), onClick: () => onEdit(m), hidden: !mine || !m.text },
                { icon: 'trash', label: t('messages.deleteForMe'), onClick: () => onDelete(m, false) },
                { icon: 'trash', label: t('messages.deleteForAll'), onClick: () => onDelete(m, true), danger: true, hidden: !mine },
              ]} trigger={(p) => <IconButton {...p} icon="dots-three-vertical" label={t('common.more')} size={28} />} />
            </div>
          )}
        </div>
        {Object.keys(counts).length > 0 && (
          <div class="msg-reactions">{Object.entries(counts).map(([e, n]) => <span key={e}>{e}{n > 1 ? ` ${n}` : ''}</span>)}</div>
        )}
      </div>
    </div>
  );
}

/**
 * A conversation: message list and composer. Used full-size on /messages
 * and compact in desktop chat popups. `actorId` = 'business_{id}' when a
 * page admin answers from the business inbox.
 */
export function Thread({ cid, actorId, compact, header }) {
  const [conv, setConv] = useState(undefined);
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState(null);
  const voice = useVoiceRecorder();
  const list = useRef(null);
  const input = useRef(null);
  const fileRef = useRef(null);
  const atBottom = useRef(true);
  const me = uid.value;
  const myActor = actorId || `user_${me}`;
  const asBusiness = actorId?.startsWith('business_') ? actorId.slice(9) : null;
  const peer = useConversationPeer(conv, actorId);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const currentIdentity = () => alive.current && uid.value === me && (actor.value?.id || null) === asBusiness;
  const allowed = !!conv && conv.inboxActorIds?.includes(myActor);

  useEffect(() => {
    let active = true; setConv(undefined);
    const stop = listenConversation(cid, (value) => { if (active) setConv(value); }, () => { if (active) setConv(null); });
    return () => { active = false; stop(); };
  }, [cid, myActor]);
  useEffect(() => {
    let active = true; setMsgs(null);
    if (!allowed) return;
    const stop = listenMessages(cid, (value) => { if (active) setMsgs(value); });
    return () => { active = false; stop(); };
  }, [cid, myActor, allowed]);

  // Read receipts for what is on screen.
  useEffect(() => {
    if (!msgs || !me || !allowed) return;
    markConversationRead(cid, myActor);
    const unseen = msgs.filter((m) => m.senderActorId !== myActor && !m.seenBy.includes(me)).map((m) => m.id);
    if (unseen.length) markMessagesSeen(cid, unseen, myActor);
  }, [msgs?.length, cid, myActor, allowed]);

  useLayoutEffect(() => {
    const el = list.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs, conv?.typing]);

  useEffect(() => { input.current?.focus(); setText(''); setReplyTo(null); setEditing(null); }, [cid]);
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [text]);

  const isNewest = (m) => !!m && msgs?.[msgs.length - 1]?.id === m.id;

  // The box clears as soon as the message is on its way (the bubble shows at
  // once); on failure the text, reply or edit comes back.
  const send = async (override) => {
    const value = (override ?? text).trim();
    if (!value || !allowed || !currentIdentity()) return;
    const wasEditing = editing;
    const wasReply = replyTo;
    if (override === undefined) setText('');
    setReplyTo(null);
    setEditing(null);
    atBottom.current = true;
    setSending(true);
    try {
      if (wasEditing) await editMessage(cid, wasEditing.id, value, { isLast: isNewest(wasEditing) });
      else await sendMessage(cid, { text: value, replyTo: wasReply ? { id: wasReply.id, text: quoteText(wasReply), senderId: wasReply.senderId } : null, asBusiness });
      setTyping(cid, false, myActor);
    } catch {
      toast.error(t('common.error'));
      if (override === undefined) setText((cur) => cur || value);
      if (wasEditing) setEditing(wasEditing); else setReplyTo(wasReply);
    }
    setSending(false);
  };

  const attach = async (files) => {
    const f = files?.[0];
    if (!f || !allowed || !currentIdentity()) return;
    setUploading(true);
    try {
      const url = await upload(f, { folder: 'messages' });
      if (!currentIdentity()) return;
      const type = f.type.startsWith('image') ? 'image' : f.type.startsWith('audio') ? 'audio' : 'file';
      await sendMessage(cid, { text: text.trim(), attachments: [{ type, url, name: f.name, size: f.size, mime: f.type }], asBusiness });
      setText('');
      atBottom.current = true;
    } catch (e) { toast.error(t(e.code === 'too-large' ? 'upload.tooLarge' : 'upload.failed')); }
    setUploading(false);
  };

  const startVoice = async () => {
    if (!allowed || !currentIdentity()) return;
    if (!canRecordVoice()) { toast.error(t('messages.micUnsupported')); return; }
    try { await voice.start(); setTyping(cid, false, myActor); }
    catch (e) { toast.error(t(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'messages.micDenied' : 'messages.micUnsupported')); }
  };
  const sendVoice = async () => {
    const res = await voice.stop();
    if (!res) return;
    if (res.duration < 1 || res.blob.size < 800) { toast(t('messages.voiceTooShort')); return; }
    setUploading(true);
    try {
      const mime = res.type.split(';')[0] || 'audio/webm';
      const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([res.blob], `voice-${Date.now()}.${ext}`, { type: mime });
      const url = await upload(file, { folder: 'messages', kind: 'video' });
      if (!currentIdentity()) return;
      await sendMessage(cid, {
        attachments: [{ type: 'audio', url, name: t('messages.voice'), size: file.size, mime, duration: Math.round(res.duration) }],
        replyTo: replyTo ? { id: replyTo.id, text: quoteText(replyTo), senderId: replyTo.senderId } : null,
        asBusiness,
      });
      setReplyTo(null);
      atBottom.current = true;
    } catch (e) { toast.error(t(e.code === 'too-large' ? 'upload.tooLarge' : 'upload.failed')); }
    setUploading(false);
  };
  // A recording stops and sends itself at the limit.
  useEffect(() => { if (voice.recording && voice.seconds >= VOICE_MAX_SECONDS) sendVoice(); }, [voice.seconds]);

  if (conv === null) return <Empty icon="chat-circle-dots" title={t('messages.notFound')} text={t('messages.notFoundText')} />;
  if (conv === undefined) return <div class="center-pad"><Spinner /></div>;
  if (!allowed) return <Empty icon="chat-circle-dots" title={t('messages.notForIdentity')} text={t('messages.switchIdentity')} />;
  const typingNames = Object.entries(conv?.typing || {}).filter(([k, v]) => k !== myActor && v && (!v.at || Date.now() - (v.at?.toMillis?.() || 0) < 15000)).map(([, v]) => v.name);
  const lastMine = msgs ? [...msgs].reverse().find((m) => m.senderActorId === myActor) : null;
  const seen = lastMine && lastMine.seenBy.some((x) => x !== me);

  return (
    <div class={`thread${compact ? ' is-compact' : ''}`}>
      {header}
      <div class="thread-list" ref={list} onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {msgs === null && <div class="center-pad"><Spinner /></div>}
        {msgs && !msgs.length && (
          <div class="thread-intro">
            <Avatar src={peer.avatar} name={peer.name} size={compact ? 64 : 88} square={peer.square} />
            <strong>{peer.name}</strong>
            {peer.href && <a href={peer.href} class="btn btn-secondary btn-sm">{t('messages.viewProfile')}</a>}
            <p class="muted small">{t('messages.sayHi')}</p>
          </div>
        )}
        {msgs?.map((m, i) => {
          const prev = msgs[i - 1];
          const next = msgs[i + 1];
          const mine = m.senderActorId === myActor || (!actorId && m.senderId === me && !m.senderActorId.startsWith('business_'));
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
          const gap = prev && m.createdAt - prev.createdAt > 10 * 60000;
          const first = newDay || gap || prev.senderActorId !== m.senderActorId;
          const last = !next || next.senderActorId !== m.senderActorId || next.createdAt - m.createdAt > 10 * 60000 || dayKey(next.createdAt) !== dayKey(m.createdAt);
          return (
            <Fragment key={m.id}>
              {(newDay || gap) && <div class="thread-day">{newDay ? formatDate(m.createdAt, { withYear: false, weekday: true }) : ''} {formatTime(m.createdAt)}</div>}
              <Bubble m={m} mine={mine} first={first} last={last} peer={peer} actorId={myActor}
                onReply={(x) => { setReplyTo(x); setEditing(null); input.current?.focus(); }}
                onReact={(x, e) => toggleMessageReaction(cid, x, e, myActor).catch(() => toast.error(t('common.error')))}
                onEdit={(x) => { setEditing(x); setReplyTo(null); setText(x.text); input.current?.focus(); }}
                onDelete={(x, all) => deleteMessage(cid, x.id, all, myActor, { isLast: isNewest(x) }).catch(() => toast.error(t('common.error')))}
                onOpenImage={(media, idx) => setViewer({ media, idx })} />
            </Fragment>
          );
        })}
        {lastMine && lastMine === msgs[msgs.length - 1] && (
          <div class="thread-status">{lastMine.pending ? t('messages.sending') : seen ? t('messages.seen') : t('messages.sent')}</div>
        )}
        {typingNames.length > 0 && <div class="thread-typing"><span class="typing-dots"><i /><i /><i /></span>{t('messages.typing')}</div>}
      </div>
      {(replyTo || editing) && (
        <div class="thread-context">
          <Icon name={editing ? 'pencil-simple' : 'arrow-bend-up-left'} size={16} />
          <span class="ellipsis">{editing ? t('messages.editing') : t('messages.replyingTo', { name: replyTo.senderId === me ? t('messages.you') : peer.name })}: {editing ? editing.text : quoteText(replyTo)}</span>
          <IconButton icon="x" label={t('common.cancel')} size={28} onClick={() => { setReplyTo(null); if (editing) { setEditing(null); setText(''); } }} />
        </div>
      )}
      {voice.recording ? (
        <div class="thread-composer voice-rec" role="status" aria-live="polite">
          <IconButton icon="trash" label={t('messages.voiceCancel')} size={36} class="tone-red" onClick={voice.cancel} />
          <div class="voice-rec-bar">
            <span class="voice-rec-dot" aria-hidden="true" />
            <span class="voice-rec-time">{clock(voice.seconds)}</span>
            <span class="voice-rec-label">{t('messages.recording')}</span>
          </div>
          <IconButton icon="paper-plane-right" label={t('messages.sendVoice')} size={36} class="tone-brand" onClick={sendVoice} />
        </div>
      ) : (
      <div class="thread-composer">
        <IconButton icon="image" label={t('messages.photo')} size={36} class="tone-brand" onClick={() => fileRef.current?.click()} disabled={uploading || !!editing} />
        {!text.trim() && !editing && <IconButton icon="microphone" label={t('messages.voice')} size={36} class="tone-brand" onClick={startVoice} disabled={uploading} />}
        <div class="thread-input">
          <textarea
            ref={input}
            rows={1}
            value={text}
            placeholder={t('messages.placeholder')}
            aria-label={t('messages.placeholder')}
            maxLength={4000}
            onInput={(e) => { setText(e.currentTarget.value); setTyping(cid, !!e.currentTarget.value.trim(), myActor); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } if (e.key === 'Escape') { setReplyTo(null); setEditing(null); } }}
          />
        </div>
        {uploading ? <Spinner size={20} class="tone-brand" /> : text.trim()
          ? <IconButton icon="paper-plane-right" label={t('common.send')} size={36} class="tone-brand" onClick={() => send()} />
          : <IconButton icon="thumbs-up" label="👍" size={36} class="tone-brand" onClick={() => send('👍')} disabled={sending} />}
        <input ref={fileRef} type="file" accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" hidden onChange={(e) => { attach(e.currentTarget.files); e.currentTarget.value = ''; }} />
      </div>
      )}
      {viewer && <Lightbox media={viewer.media} index={viewer.idx} onClose={() => setViewer(null)} />}
    </div>
  );
}

export function PeerStatus({ peer }) {
  if (!peer.user) return null;
  if (peer.online) return <span class="peer-status is-online">{t('messages.activeNow')}</span>;
  return peer.user.lastSeen ? <span class="peer-status">{t('messages.activeAgo', { t: timeAgo(peer.user.lastSeen) })}</span> : null;
}
