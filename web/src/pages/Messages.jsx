import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { IconButton } from '../ui/Button.jsx';
import { Menu } from '../ui/Menu.jsx';
import { Modal } from '../ui/Modal.jsx';
import { SearchInput } from '../ui/Field.jsx';
import { Empty, Spinner } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle, useDebounced, bp } from '../lib/hooks.js';
import { navigate, query, back } from '../lib/router.js';
import { conversations } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { openDirect, openBusinessConversation, hideConversation, listenConversations } from '../data/messages.js';
import { actor, actorId } from '../lib/actor.js';
import { searchUsers } from '../data/users.js';
import { getBusiness } from '../data/business.js';
import { startCall } from '../data/calls.js';
import { blockUser } from '../data/social.js';
import { ConversationRow, useConversationPeer } from '../features/messages/ConversationRow.jsx';
import { Thread, PeerStatus } from '../features/messages/Thread.jsx';
import { messageError } from '../features/messages/errors.js';

function NewMessage({ onClose }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const term = useDebounced(q, 250);
  useEffect(() => {
    let alive = true;
    if (term.trim().length >= 2) searchUsers(term, 12).then((r) => alive && setList(r));
    else setList([]);
    return () => { alive = false; };
  }, [term]);
  const start = async (u) => {
    try { const cid = await openDirect(u.id); onClose(); navigate(`/messages/${cid}`); }
    catch (e) { toast.error(messageError(e)); }
  };
  return (
    <Modal open onClose={onClose} title={t('messages.new')} size="sm">
      <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('messages.findPeople')} autoFocus />
      <div class="picker-list" style={{ marginTop: 12 }}>
        {list.map((u) => (
          <button key={u.id} type="button" class="picker-row" onClick={() => start(u)}>
            <Avatar src={u.avatar} name={u.name} size={40} /><span class="picker-text"><strong>{u.name}</strong>{u.username && <span class="muted small">@{u.username}</span>}</span>
          </button>
        ))}
        {term.trim().length >= 2 && !list.length && <p class="muted small center">{t('search.nothing')}</p>}
      </div>
    </Modal>
  );
}

function ThreadHeader({ conv, onBack, actorId: asPage }) {
  const peer = useConversationPeer(conv, asPage);
  return (
    <header class="thread-head">
      {onBack && <IconButton icon="arrow-left" label={t('common.back')} onClick={onBack} size={40} />}
      <a href={peer.href || '#'} class="thread-peer">
        <Avatar src={peer.avatar} name={peer.name} size={40} square={peer.square} status={peer.online ? 'online' : undefined} />
        <span class="thread-peer-text"><strong>{peer.name}</strong><PeerStatus peer={peer} /></span>
      </a>
      {peer.user && !conv.isBusiness && !asPage && (
        <>
          <IconButton icon="phone" label={t('call.voice')} size={40} class="thread-call" onClick={() => startCall({ uid: peer.user.id, name: peer.user.name, avatar: peer.user.avatar }, 'audio').catch(() => toast.error(t('call.noDevice')))} />
          <IconButton icon="video-camera" label={t('call.video')} size={40} class="thread-call" onClick={() => startCall({ uid: peer.user.id, name: peer.user.name, avatar: peer.user.avatar }, 'video').catch(() => toast.error(t('call.noDevice')))} />
        </>
      )}
      <Menu label={t('common.more')} width={260} items={[
        { icon: 'user-circle', label: t('messages.viewProfile'), href: peer.href, hidden: !peer.href },
        { icon: 'archive', label: t('messages.hide'), onClick: () => hideConversation(conv.id).then(() => { toast(t('messages.hidden')); navigate('/messages'); }).catch(() => toast.error(t('common.error'))) },
        { icon: 'prohibit', label: t('messages.block'), danger: true, hidden: !peer.user,
          onClick: () => blockUser(peer.user.id).then(() => toast(t('safety.blocked'))).catch(() => toast.error(t('common.error'))) },
      ]} trigger={(p) => <IconButton {...p} icon="dots-three" label={t('common.more')} size={40} />} />
    </header>
  );
}

/** Messenger: conversation list + thread (split on desktop, stacked on phones). */
export default function Messages({ params }) {
  useTitle(t('messages.title'));
  const [q, setQ] = useState('');
  const [compose, setCompose] = useState(false);
  const [opening, setOpening] = useState(false);
  const cid = params.id;
  const withUser = query.value.get('with');
  const withBiz = query.value.get('business');
  const desktop = bp.value === 'lg' || bp.value === 'xl';

  // ?with=UID / ?business=ID open (or create) the conversation.
  useEffect(() => {
    if (!withUser && !withBiz) return;
    setOpening(true);
    const job = withUser ? openDirect(withUser) : getBusiness(withBiz).then((b) => openBusinessConversation(withBiz, b?.ownerId));
    job.then((id) => navigate(`/messages/${id}`, { replace: true }))
      .catch((e) => { toast.error(messageError(e)); navigate('/messages', { replace: true }); })
      .finally(() => setOpening(false));
  }, [withUser, withBiz]);

  const asPage = actorId();
  const [pageConvs, setPageConvs] = useState([]);
  useEffect(() => (asPage ? listenConversations(setPageConvs, asPage) : undefined), [asPage]);
  const list = asPage ? pageConvs : conversations.value;
  // Desktop opens the most recent conversation, like Messenger.
  useEffect(() => {
    if (desktop && !cid && !withUser && !withBiz && list.length) navigate(`/messages/${list[0].id}`, { replace: true });
  }, [desktop, cid, list.length]);
  const needle = q.trim().toLowerCase();
  const conv = list.find((c) => c.id === cid);
  const showList = desktop || !cid;
  const showThread = desktop || !!cid;

  return (
    <div class={`messenger${cid ? ' has-thread' : ''}`}>
      {showList && (
        <aside class="messenger-list">
          <div class="messenger-list-head">
            <h1>{asPage ? actor.value.name : t('messages.title')}</h1>
            <IconButton icon="note-pencil" label={t('messages.new')} variant="soft" size={38} onClick={() => setCompose(true)} />
          </div>
          <div class="messenger-search"><SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('messages.search')} /></div>
          <div class="messenger-rows">
            {list.length === 0 && <Empty compact icon="chat-circle-dots" title={t('messages.emptyTitle')} text={t('messages.emptyText')} />}
            {list.filter((c) => !needle || (c.lastMessage || '').toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle)).map((c) => (
              <ConversationRow key={c.id} conv={c} active={c.id === cid} actorId={asPage} />
            ))}
          </div>
        </aside>
      )}
      {showThread && (
        <section class={`messenger-thread${!desktop ? ' is-overlay' : ''}`}>
          {opening && <div class="center-pad"><Spinner /></div>}
          {!opening && cid && (
            <Thread key={cid} cid={cid} actorId={asPage} header={<ThreadHeader conv={conv || { id: cid, participants: [] }} actorId={asPage} onBack={desktop ? null : () => back('/messages')} />} />
          )}
          {!opening && !cid && <Empty icon="chat-circle-dots" title={t('messages.selectTitle')} text={t('messages.selectText')} />}
        </section>
      )}
      {compose && <NewMessage onClose={() => setCompose(false)} />}
    </div>
  );
}
