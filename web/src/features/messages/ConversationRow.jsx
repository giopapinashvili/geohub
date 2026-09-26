import { Avatar } from '../../ui/Avatar.jsx';
import { t } from '../../lib/i18n.js';
import { timeAgo, truncate } from '../../lib/format.js';
import { useUser } from '../user/useUser.js';
import { useBusiness } from '../business/useBusiness.js';
import { uid } from '../../lib/auth.js';

/** Resolve how a conversation should be titled for the viewer. */
export function useConversationPeer(conv, actorId) {
  const asPage = actorId && actorId.startsWith('business_');
  const showBusiness = conv?.isBusiness && !asPage && conv.customerUid === uid.value;
  const biz = useBusiness(showBusiness ? conv.businessId : null);
  const user = useUser(showBusiness ? null : (asPage ? conv?.customerUid : conv?.otherId));
  if (showBusiness) return { name: biz?.name || t('common.business'), avatar: biz?.logo, square: true, href: `/business/${conv.businessId}` };
  return { name: user?.name || '…', avatar: user?.avatar, online: user?.online && Date.now() - (user?.lastSeen || 0) < 5 * 60000, href: user ? `/u/${user.id}` : null, user };
}

export function ConversationRow({ conv, active, onClick, href, actorId }) {
  const peer = useConversationPeer(conv, actorId);
  const mine = conv.lastSenderId === uid.value;
  const typing = Object.keys(conv.typing || {}).some((k) => k !== `user_${uid.value}` && conv.typing[k]);
  return (
    <a href={href || `/messages/${conv.id}`} class={`conv-row${conv.unread ? ' is-unread' : ''}${active ? ' is-active' : ''}`}
      onClick={onClick ? (e) => { e.preventDefault(); onClick(conv); } : undefined}>
      <Avatar src={peer.avatar} name={peer.name} size={52} square={peer.square} status={peer.online ? 'online' : undefined} />
      <span class="conv-row-body">
        <span class="conv-row-name">{peer.name}</span>
        <span class="conv-row-last">
          {typing ? <em class="conv-typing">{t('messages.typing')}</em> : (
            <>
              <span class="conv-row-preview">{mine ? `${t('messages.you')}: ` : ''}{truncate(conv.lastMessage || t('messages.startChat'), 60)}</span>
              {conv.updatedAt ? <span class="conv-row-time"> · {timeAgo(conv.updatedAt)}</span> : null}
            </>
          )}
        </span>
      </span>
      {conv.unread && <span class="notif-dot" aria-label={t('notif.unread')} />}
    </a>
  );
}
