import { useEffect, useState } from 'preact/hooks';
import { Card, CardHeader } from '../../ui/misc.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { t } from '../../lib/i18n.js';
import { uid } from '../../lib/auth.js';
import { friendIds, incomingRequests } from '../../lib/store.js';
import { recentUsers } from '../../data/users.js';
import { FriendButton } from './FriendButton.jsx';

export function useSuggestions(n = 12) {
  const [list, setList] = useState(null);
  const me = uid.value;
  const key = friendIds.value.size;
  useEffect(() => {
    recentUsers(60).then((users) => {
      const pending = new Set(incomingRequests.value.map((r) => r.fromId));
      setList(users.filter((u) => u.id !== me && !friendIds.value.has(u.id) && !pending.has(u.id)).slice(0, n));
    }).catch(() => setList([]));
  }, [me, key]);
  return list;
}

/** "People you may know" carousel. */
export function PeopleStrip() {
  const list = useSuggestions(10);
  if (!list?.length) return null;
  return (
    <Card class="strip-card">
      <CardHeader title={t('friends.suggestions')} action={<a href="/friends?tab=suggestions" class="link">{t('common.seeAll')}</a>} />
      <div class="strip-scroll">
        {list.map((u) => (
          <div key={u.id} class="person-card">
            <a href={`/u/${u.id}`} class="person-card-top">
              <Avatar src={u.avatar} name={u.name} size={88} />
              <strong class="person-card-name">{u.name}</strong>
              <span class="muted small">{u.city || ' '}</span>
            </a>
            <FriendButton userId={u.id} size="sm" block />
          </div>
        ))}
      </div>
    </Card>
  );
}
