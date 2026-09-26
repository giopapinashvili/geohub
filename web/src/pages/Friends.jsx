import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { SearchInput } from '../ui/Field.jsx';
import { Card, Empty, Spinner } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { query, setQuery } from '../lib/router.js';
import { timeAgo } from '../lib/format.js';
import { cityLabel } from '../lib/geo.js';
import { toast } from '../lib/toast.js';
import { uid } from '../lib/auth.js';
import { incomingRequests } from '../lib/store.js';
import { acceptFriendRequest, declineFriendRequest, listenSentRequests, cancelFriendRequest, listenFriends } from '../data/social.js';
import { useSuggestions } from '../features/user/PeopleStrip.jsx';
import { FriendButton } from '../features/user/FriendButton.jsx';

function Tile({ href, avatar, name, sub, children }) {
  return (
    <div class="friend-card">
      <a href={href} class="friend-card-photo">{avatar ? <img src={avatar} alt="" loading="lazy" referrerpolicy="no-referrer" /> : <Avatar name={name} size={120} square />}</a>
      <div class="friend-card-body">
        <a href={href} class="friend-card-name">{name}</a>
        {sub && <span class="muted small">{sub}</span>}
        <div class="friend-card-actions">{children}</div>
      </div>
    </div>
  );
}

function Requests() {
  const list = incomingRequests.value;
  const act = (fn, key) => fn.then(() => key && toast.success(t(key))).catch(() => toast.error(t('common.error')));
  if (!list.length) return <Empty icon="user-plus" title={t('friends.noRequests')} />;
  return (
    <div class="friend-grid">
      {list.map((r) => (
        <Tile key={r.id} href={`/u/${r.fromId}`} avatar={r.avatar} name={r.name} sub={timeAgo(r.createdAt)}>
          <Button variant="primary" block onClick={() => act(acceptFriendRequest(r.id), 'friends.accepted')}>{t('friends.confirm')}</Button>
          <Button variant="secondary" block onClick={() => act(declineFriendRequest(r.id), 'friends.declined')}>{t('common.delete')}</Button>
        </Tile>
      ))}
    </div>
  );
}

function Suggestions() {
  const list = useSuggestions(24);
  if (!list) return <div class="center-pad"><Spinner /></div>;
  if (!list.length) return <Empty icon="users" title={t('friends.noSuggestions')} />;
  return (
    <div class="friend-grid">
      {list.map((u) => <Tile key={u.id} href={`/u/${u.id}`} avatar={u.avatar} name={u.name} sub={cityLabel(u.city)}><FriendButton userId={u.id} block /></Tile>)}
    </div>
  );
}

function AllFriends() {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => listenFriends(uid.value, setList), [uid.value]);
  if (!list) return <div class="center-pad"><Spinner /></div>;
  const shown = list.filter((u) => !q.trim() || u.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <div class="friends-search"><SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('friends.searchFriends')} /></div>
      {!list.length && <Empty icon="users" title={t('friends.noFriends')} text={t('friends.noFriendsText')} action={<Button variant="primary" onClick={() => setQuery({ tab: 'suggestions' })}>{t('friends.suggestions')}</Button>} />}
      <div class="friend-list-grid">
        {shown.map((u) => (
          <div key={u.id} class="friend-tile">
            <a href={`/u/${u.id}`}><Avatar src={u.avatar} name={u.name} size={64} square /></a>
            <a href={`/u/${u.id}`} class="friend-tile-text"><strong>{u.name}</strong>{u.city && <span class="muted small">{cityLabel(u.city)}</span>}</a>
            <FriendButton userId={u.id} size="sm" compact />
          </div>
        ))}
      </div>
    </>
  );
}

function Sent() {
  const [list, setList] = useState(null);
  useEffect(() => listenSentRequests(setList), [uid.value]);
  if (!list) return <div class="center-pad"><Spinner /></div>;
  if (!list.length) return <Empty icon="paper-plane-tilt" title={t('friends.noSent')} />;
  return (
    <div class="friend-grid">
      {list.map((r) => (
        <Tile key={r.id} href={`/u/${r.toId}`} avatar={r.avatar} name={r.name} sub={timeAgo(r.createdAt)}>
          <Button variant="secondary" block onClick={() => cancelFriendRequest(r.toId).then(() => toast(t('friends.requestCancelled'))).catch(() => toast.error(t('common.error')))}>{t('friends.cancel')}</Button>
        </Tile>
      ))}
    </div>
  );
}

export default function Friends() {
  useTitle(t('friends.title'));
  const tab = query.value.get('tab') || (incomingRequests.value.length ? 'requests' : 'suggestions');
  return (
    <div class="page-pad">
      <div class="page-head"><h1 class="page-title">{t('friends.title')}</h1></div>
      <Tabs variant="pill" value={tab} onChange={(v) => setQuery({ tab: v })} label={t('friends.title')} items={[
        { value: 'requests', label: t('friends.requests'), count: incomingRequests.value.length },
        { value: 'suggestions', label: t('friends.suggestions') },
        { value: 'all', label: t('friends.all') },
        { value: 'sent', label: t('friends.sent') },
      ]} />
      <Card class="friends-body">
        {tab === 'requests' && <Requests />}
        {tab === 'suggestions' && <Suggestions />}
        {tab === 'all' && <AllFriends />}
        {tab === 'sent' && <Sent />}
      </Card>
    </div>
  );
}
