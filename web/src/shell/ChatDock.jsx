import { Avatar } from '../ui/Avatar.jsx';
import { IconButton } from '../ui/Button.jsx';
import { t } from '../lib/i18n.js';
import { chatPopups, closeChat, toggleChat, conversations } from '../lib/store.js';
import { Thread, PeerStatus } from '../features/messages/Thread.jsx';
import { useConversationPeer } from '../features/messages/ConversationRow.jsx';
import { navigate } from '../lib/router.js';

function Popup({ cid, minimized }) {
  const conv = conversations.value.find((c) => c.id === cid) || { id: cid, participants: [] };
  const peer = useConversationPeer(conv);
  const head = (
    <header class="chatpop-head">
      <button type="button" class="chatpop-peer" onClick={() => toggleChat(cid)} aria-expanded={minimized ? 'false' : 'true'}>
        <Avatar src={peer.avatar} name={peer.name} size={34} square={peer.square} status={peer.online ? 'online' : undefined} />
        <span class="thread-peer-text"><strong>{peer.name}</strong>{!minimized && <PeerStatus peer={peer} />}</span>
        {conv.unread && minimized && <span class="notif-dot" />}
      </button>
      <IconButton icon="arrow-square-out" label={t('messages.openFull')} size={32} onClick={() => { closeChat(cid); navigate(`/messages/${cid}`); }} />
      <IconButton icon="caret-down" label={t('messages.minimize')} size={32} onClick={() => toggleChat(cid)} style={minimized ? { transform: 'rotate(180deg)' } : undefined} />
      <IconButton icon="x" label={t('common.close')} size={32} onClick={() => closeChat(cid)} />
    </header>
  );
  return (
    <div class={`chatpop${minimized ? ' is-min' : ''}`} role="dialog" aria-label={peer.name}>
      {head}
      {!minimized && <div class="chatpop-body"><Thread cid={cid} compact /></div>}
    </div>
  );
}

/** Desktop chat popups docked bottom-right, Facebook style. */
export default function ChatDock() {
  return (
    <div class="chatdock">
      {chatPopups.value.map((c) => <Popup key={c.cid} cid={c.cid} minimized={c.minimized} />)}
    </div>
  );
}
