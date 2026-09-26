import { Popover } from '../ui/Menu.jsx';
import { Empty } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { notifications, conversations, openChat } from '../lib/store.js';
import { markAllRead } from '../data/notify.js';
import { NotificationItem } from '../features/notifications/NotificationItem.jsx';
import { ConversationRow } from '../features/messages/ConversationRow.jsx';
import { navigate } from '../lib/router.js';

export function NotificationsPopover({ trigger }) {
  return (
    <Popover trigger={trigger} width={380} label={t('nav.notifications')}>
      {(close) => {
        const list = notifications.value.filter((n) => n.type !== 'message').slice(0, 12);
        return (
          <div class="pop-panel">
            <div class="pop-head">
              <h2>{t('nav.notifications')}</h2>
              {list.some((n) => !n.read) && <button type="button" class="link" onClick={() => markAllRead(notifications.value)}>{t('notif.markAll')}</button>}
            </div>
            {list.length ? (
              <div class="pop-list">{list.map((n) => <NotificationItem key={n.id} n={n} onOpen={close} compact />)}</div>
            ) : <Empty compact icon="bell" title={t('notif.emptyTitle')} text={t('notif.emptyText')} />}
            <a href="/notifications" class="pop-foot" onClick={close}>{t('common.seeAll')}</a>
          </div>
        );
      }}
    </Popover>
  );
}

export function MessagesPopover({ trigger }) {
  return (
    <Popover trigger={trigger} width={380} label={t('nav.messages')}>
      {(close) => {
        const list = conversations.value.slice(0, 10);
        return (
          <div class="pop-panel">
            <div class="pop-head">
              <h2>{t('nav.messages')}</h2>
              <a href="/messages" class="link" onClick={close}>{t('messages.openAll')}</a>
            </div>
            {list.length ? (
              <div class="pop-list">
                {list.map((c) => <ConversationRow key={c.id} conv={c} onClick={(conv) => { close(); openChat(conv.id); }} />)}
              </div>
            ) : <Empty compact icon="chat-circle-dots" title={t('messages.emptyTitle')} text={t('messages.emptyText')} />}
            <button type="button" class="pop-foot" onClick={() => { close(); navigate('/messages'); }}>{t('messages.seeAllInMessenger')}</button>
          </div>
        );
      }}
    </Popover>
  );
}
