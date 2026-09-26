import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { t } from '../../lib/i18n.js';
import { timeAgo, truncate } from '../../lib/format.js';
import { appHref } from '../../legacy.js';
import { navigate } from '../../lib/router.js';
import { markRead } from '../../data/notify.js';

const KIND = {
  like: { icon: 'heart-fill', tone: 'brand', key: 'notif.like' },
  comment: { icon: 'chat-circle-dots-fill', tone: 'info', key: 'notif.comment' },
  reply: { icon: 'chat-circle-dots-fill', tone: 'info', key: 'notif.reply' },
  comment_like: { icon: 'heart-fill', tone: 'brand', key: 'notif.commentLike' },
  follow: { icon: 'user-plus', tone: 'success', key: 'notif.follow' },
  friend_request: { icon: 'user-plus', tone: 'info', key: 'notif.friendRequest' },
  friend_accept: { icon: 'user-check', tone: 'success', key: 'notif.friendAccept' },
  friend_accepted: { icon: 'user-check', tone: 'success', key: 'notif.friendAccept' },
  message: { icon: 'chat-circle-dots-fill', tone: 'brand', key: 'notif.message' },
  story_reaction: { icon: 'heart-fill', tone: 'brand', key: 'notif.storyReaction' },
  story_reply: { icon: 'chat-circle-dots-fill', tone: 'info', key: 'notif.storyReply' },
  tag: { icon: 'user-circle-fill', tone: 'accent', key: 'notif.tag' },
  coauthor: { icon: 'user-circle-fill', tone: 'accent', key: 'notif.tag' },
  group_join_request: { icon: 'users-three-fill', tone: 'info', key: 'notif.groupRequest' },
  group_approved: { icon: 'users-three-fill', tone: 'success', key: 'notif.groupApproved' },
  badge: { icon: 'trophy-fill', tone: 'accent' },
  reward: { icon: 'gift-fill', tone: 'accent' },
  points_received: { icon: 'coins', tone: 'accent' },
  checkin: { icon: 'map-pin-fill', tone: 'success' },
  coupon_redeemed: { icon: 'gift-fill', tone: 'accent' },
};

function fallbackHref(n) {
  if (n.postId) return `/post/${n.postId}${n.commentId ? `?comment=${n.commentId}` : ''}`;
  if (n.storyId) return `/?story=${n.storyId}`;
  if (n.conversationId) return `/messages/${n.conversationId}`;
  if (n.fromUserId) return `/u/${n.fromUserId}`;
  return '/notifications';
}

export function notificationHref(n) {
  return n.href ? appHref(n.href) : fallbackHref(n);
}

export function NotificationItem({ n, onOpen, compact }) {
  const kind = KIND[n.type] || { icon: 'bell', tone: 'neutral' };
  const name = n.fromName || 'GeoHub';
  // Known types get a localised predicate after the actor's name; others
  // show the stored title (older notifications carry English titles).
  const href = notificationHref(n);
  return (
    <a
      href={href}
      class={`notif${n.read ? '' : ' is-unread'}${compact ? ' is-compact' : ''}`}
      onClick={(e) => { e.preventDefault(); if (!n.read) markRead(n.id); onOpen?.(); navigate(href); }}
    >
      <span class="notif-avatar">
        <Avatar src={n.fromAvatar} name={name} size={compact ? 48 : 56} />
        <span class={`notif-kind tone-${kind.tone}`}><Icon name={kind.icon} size={14} /></span>
      </span>
      <span class="notif-body">
        <span class="notif-text">
          {kind.key ? <><strong>{name}</strong> {t(kind.key)}</> : <strong>{n.title || name}</strong>}
          {n.body && n.type !== 'follow' && <span class="notif-snippet"> „{truncate(n.body, 90)}“</span>}
        </span>
        <span class="notif-time">{timeAgo(n.createdAt)}</span>
      </span>
      {!n.read && <span class="notif-dot" aria-label={t('notif.unread')} />}
    </a>
  );
}
