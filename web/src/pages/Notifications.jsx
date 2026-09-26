import { useState } from 'preact/hooks';
import { Card, Empty } from '../ui/misc.jsx';
import { Button } from '../ui/Button.jsx';
import { Segmented } from '../ui/Field.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { notifications, incomingRequests } from '../lib/store.js';
import { markAllRead } from '../data/notify.js';
import { NotificationItem } from '../features/notifications/NotificationItem.jsx';
import { PushPrompt } from '../features/notifications/PushPrompt.jsx';

export default function Notifications() {
  useTitle(t('notif.title'));
  const [filter, setFilter] = useState('all');
  const all = notifications.value.filter((n) => n.type !== 'message');
  const list = filter === 'unread' ? all.filter((n) => !n.read) : all;
  const dayAgo = Date.now() - 86400000;
  const fresh = list.filter((n) => n.createdAt >= dayAgo);
  const earlier = list.filter((n) => n.createdAt < dayAgo);
  return (
    <Card class="notif-page">
      <div class="page-head">
        <h1 class="page-title">{t('notif.title')}</h1>
        {all.some((n) => !n.read) && <Button variant="ghost" size="sm" icon="check" onClick={() => markAllRead(all)}>{t('notif.markAll')}</Button>}
      </div>
      <Segmented value={filter} onChange={setFilter} label={t('notif.title')} options={[{ value: 'all', label: t('notif.tabAll') }, { value: 'unread', label: t('notif.tabUnread') }]} />
      <PushPrompt />
      {incomingRequests.value.length > 0 && filter === 'all' && (
        <a href="/friends" class="notif-requests">
          <span class="notif-requests-icon">{incomingRequests.value.length}</span>
          <span><strong>{t('friends.requests')}</strong><span class="muted small"> · {t('notif.reviewRequests')}</span></span>
        </a>
      )}
      {!list.length && <Empty icon="bell" title={filter === 'unread' ? t('notif.noUnread') : t('notif.emptyTitle')} text={t('notif.emptyText')} />}
      {fresh.length > 0 && <h2 class="notif-group">{t('notif.new')}</h2>}
      {fresh.map((n) => <NotificationItem key={n.id} n={n} />)}
      {earlier.length > 0 && <h2 class="notif-group">{t('notif.earlier')}</h2>}
      {earlier.map((n) => <NotificationItem key={n.id} n={n} />)}
    </Card>
  );
}
