import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { t } from '../lib/i18n.js';
import { signedIn } from '../lib/auth.js';
import { incomingRequests, friendIds, openChat } from '../lib/store.js';
import { acceptFriendRequest, declineFriendRequest } from '../data/social.js';
import { getUsers } from '../data/users.js';
import { openDirect } from '../data/messages.js';
import { messageError } from '../features/messages/errors.js';
import { upcomingEvents } from '../data/events.js';
import { monthShort, timeAgo } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { navigate } from '../lib/router.js';
import { bp } from '../lib/hooks.js';

function Requests() {
  const list = incomingRequests.value.slice(0, 3);
  if (!list.length) return null;
  return (
    <section class="rail-block">
      <div class="rail-head">
        <h3>{t('friends.requests')}</h3>
        <a href="/friends" class="link">{t('common.seeAll')}</a>
      </div>
      {list.map((r) => (
        <div key={r.id} class="rail-request">
          <Avatar src={r.avatar} name={r.name} size={52} href={`/u/${r.fromId}`} />
          <div class="rail-request-body">
            <div class="rail-request-top"><a href={`/u/${r.fromId}`} class="rail-name">{r.name}</a><span class="muted small">{timeAgo(r.createdAt)}</span></div>
            <div class="rail-actions">
              <Button size="sm" variant="primary" onClick={() => acceptFriendRequest(r.id).then(() => toast.success(t('friends.accepted'))).catch(() => toast.error(t('common.error')))}>{t('friends.confirm')}</Button>
              <Button size="sm" variant="secondary" onClick={() => declineFriendRequest(r.id).catch(() => toast.error(t('common.error')))}>{t('common.delete')}</Button>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function Events() {
  const [events, setEvents] = useState([]);
  useEffect(() => { upcomingEvents(3).then(setEvents).catch(() => setEvents([])); }, []);
  if (!events.length) return null;
  return (
    <section class="rail-block">
      <div class="rail-head"><h3>{t('events.upcoming')}</h3><a href="/events" class="link">{t('common.seeAll')}</a></div>
      {events.map((e) => (
        <a key={e.id} href={`/events/${e.id}`} class="rail-event">
          <span class="rail-event-date">
            <strong>{new Date(e.date).getDate()}</strong>
            <span>{monthShort(e.date)}</span>
          </span>
          <span class="rail-event-body"><span class="rail-name">{e.title}</span><span class="muted small">{e.city || e.venue}</span></span>
        </a>
      ))}
    </section>
  );
}

function Contacts() {
  const [users, setUsers] = useState([]);
  const ids = [...friendIds.value];
  const key = ids.join(',');
  useEffect(() => { getUsers(ids.slice(0, 40)).then(setUsers); }, [key]);
  const sorted = [...users].sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
  return (
    <section class="rail-block">
      <div class="rail-head"><h3>{t('messages.contacts')}</h3></div>
      {!sorted.length && <p class="muted small rail-empty">{t('messages.noContacts')}</p>}
      {sorted.map((u) => (
        <button key={u.id} type="button" class="rail-contact" onClick={() => {
          openDirect(u.id)
            .then((cid) => { if (bp.value === 'xl' || bp.value === 'lg') openChat(cid); else navigate(`/messages/${cid}`); })
            .catch((e) => toast.error(messageError(e)));
        }}>
          <Avatar src={u.avatar} name={u.name} size={36} status={u.online && Date.now() - u.lastSeen < 5 * 60000 ? 'online' : undefined} />
          <span class="rail-name">{u.name}</span>
        </button>
      ))}
    </section>
  );
}

export function RightRail() {
  return (
    <aside class="rightrail" aria-label={t('nav.sidebar')}>
      <div class="rightrail-inner">
        {!signedIn.value ? (
          <section class="rail-block rail-join">
            <Icon name="sparkle" size={28} />
            <h3>{t('home.joinTitle')}</h3>
            <p class="muted">{t('home.joinText')}</p>
            <Button variant="primary" block href="/signup">{t('auth.signUp')}</Button>
            <Button variant="secondary" block href="/login">{t('auth.signIn')}</Button>
          </section>
        ) : (
          <>
            <Requests />
            <Events />
            <Contacts />
          </>
        )}
      </div>
    </aside>
  );
}
