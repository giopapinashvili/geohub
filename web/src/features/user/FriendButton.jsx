import { useEffect, useState } from 'preact/hooks';
import { Button } from '../../ui/Button.jsx';
import { Menu } from '../../ui/Menu.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { uid } from '../../lib/auth.js';
import { requireLogin } from '../../lib/store.js';
import {
  listenFriendship, sendFriendRequest, cancelFriendRequest, acceptFriendRequest, declineFriendRequest, unfriend,
  listenIsFollowing, follow, unfollow,
} from '../../data/social.js';

function errText(e) {
  if (e?.code === 'requests-disabled') return t('friends.err.disabled');
  if (e?.code === 'follow-disabled') return t('follow.err.disabled');
  return t('common.error');
}

/** Add friend / requested / respond / friends — driven by live state. */
export function FriendButton({ userId, size = 'md', block, compact }) {
  const [st, setSt] = useState({ state: 'loading' });
  const [busy, setBusy] = useState(false);
  useEffect(() => listenFriendship(userId, setSt), [userId, uid.value]);
  const run = async (fn, okKey) => {
    if (!requireLogin('friend')) return;
    setBusy(true);
    try { await fn(); if (okKey) toast.success(t(okKey)); } catch (e) { toast.error(errText(e)); }
    setBusy(false);
  };
  if (!uid.value) return <Button size={size} block={block} variant="soft" icon="user-plus" onClick={() => requireLogin('friend')}>{t('friends.add')}</Button>;
  if (st.state === 'self' || st.state === 'loading') return st.state === 'loading' ? <Button size={size} block={block} variant="secondary" disabled>…</Button> : null;
  if (st.state === 'friends') {
    return (
      <Menu label={t('friends.isFriend')} width={240} items={[{ icon: 'user-minus', label: t('friends.unfriend'), danger: true, onClick: () => run(() => unfriend(userId), 'friends.removed') }]}
        trigger={(p) => <Button {...p} size={size} block={block} variant="secondary" icon="user-check">{compact ? null : t('friends.isFriend')}</Button>} />
    );
  }
  if (st.state === 'outgoing') {
    return <Button size={size} block={block} variant="secondary" icon="user-minus" loading={busy} onClick={() => run(() => cancelFriendRequest(userId), 'friends.requestCancelled')}>{t('friends.cancel')}</Button>;
  }
  if (st.state === 'incoming') {
    return (
      <Menu label={t('friends.respond')} width={240} items={[
        { icon: 'user-check', label: t('friends.confirm'), onClick: () => run(() => acceptFriendRequest(st.requestId), 'friends.accepted') },
        { icon: 'x', label: t('common.delete'), onClick: () => run(() => declineFriendRequest(st.requestId), 'friends.declined') },
      ]} trigger={(p) => <Button {...p} size={size} block={block} variant="primary" icon="user-plus" loading={busy}>{t('friends.respond')}</Button>} />
    );
  }
  return <Button size={size} block={block} variant="soft" icon="user-plus" loading={busy} onClick={() => run(() => sendFriendRequest(userId), 'friends.requestSent')}>{t('friends.add')}</Button>;
}

export function FollowButton({ userId, size = 'md', block }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => listenIsFollowing(userId, setOn), [userId, uid.value]);
  if (uid.value === userId) return null;
  const toggle = async () => {
    if (!requireLogin('follow')) return;
    setBusy(true);
    try { if (on) await unfollow(userId); else await follow(userId); } catch (e) { toast.error(errText(e)); }
    setBusy(false);
  };
  return <Button size={size} block={block} variant={on ? 'secondary' : 'outline'} icon={on ? 'check' : 'plus'} loading={busy} onClick={toggle}>{t(on ? 'follow.following' : 'follow.follow')}</Button>;
}
