import { useEffect, useMemo, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { Menu } from '../ui/Menu.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Card, CardHeader, Empty, Img, PageSpinner, Verified, Spinner } from '../ui/misc.jsx';
import { t, tn, formatCount } from '../lib/i18n.js';
import { useTitle, useLive, useAsync } from '../lib/hooks.js';
import { navigate, query, setQuery } from '../lib/router.js';
import { formatDate } from '../lib/format.js';
import { cityLabel } from '../lib/geo.js';
import { uid, signedIn } from '../lib/auth.js';
import { openComposer, storyCreator, friendIds } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { resolveUserKey, listenUser, getUsers } from '../data/users.js';
import { listenUserPosts } from '../data/posts.js';
import { followCounts, listenFriendIds, blockUser, isBlockedBy, listFollowers, listFollowing } from '../data/social.js';
import { openDirect } from '../data/messages.js';
import { userCheckins } from '../data/places.js';
import { PostCard, ReportDialog } from '../features/post/PostCard.jsx';
import { FriendButton, FollowButton } from '../features/user/FriendButton.jsx';
import { EditProfileDialog } from '../features/user/EditProfileDialog.jsx';
import { messageError } from '../features/messages/errors.js';
import { copyLink } from '../features/post/ShareDialog.jsx';
import { Lightbox } from '../features/post/Lightbox.jsx';
import { Modal } from '../ui/Modal.jsx';

function PeopleGrid({ users, limit = 9 }) {
  return (
    <div class="people-grid">
      {users.slice(0, limit).map((u) => (
        <a key={u.id} href={`/u/${u.id}`} class="people-grid-item">
          {u.avatar ? <Img src={u.avatar} width={120} alt="" /> : <Avatar name={u.name} size={96} square />}
          <span>{u.name}</span>
        </a>
      ))}
    </div>
  );
}

function PeopleList({ title, load, onClose }) {
  const { data } = useAsync(load, []);
  return (
    <Modal open onClose={onClose} title={title} size="sm">
      {!data ? <div class="center-pad"><Spinner /></div> : !data.length ? <Empty compact icon="users" title={t('profile.nobody')} /> : (
        <div class="picker-list">
          {data.map((u) => <a key={u.id} href={`/u/${u.id}`} class="picker-row" onClick={onClose}><Avatar src={u.avatar} name={u.name} size={40} /><span class="picker-text"><strong>{u.name}</strong>{u.city && <span class="muted small">{cityLabel(u.city)}</span>}</span></a>)}
        </div>
      )}
    </Modal>
  );
}

function Intro({ user, own, onEdit }) {
  const rows = [
    user.city && { icon: 'map-pin', text: <>{t('profile.livesIn')} <strong>{cityLabel(user.city)}</strong></> },
    user.raw.work && { icon: 'briefcase', text: user.raw.work },
    user.raw.education && { icon: 'graduation-cap', text: user.raw.education },
    user.website && { icon: 'link', text: <a class="link" href={/^https?:/.test(user.website) ? user.website : `https://${user.website}`} target="_blank" rel="noopener noreferrer nofollow">{user.website.replace(/^https?:\/\//, '')}</a> },
    user.geoId && { icon: 'identification-card', text: <>GeoHub ID <strong>{user.geoId}</strong></> },
    user.createdAt && { icon: 'clock', text: t('profile.joined', { date: formatDate(user.createdAt, { withYear: true }) }) },
  ].filter(Boolean);
  const social = Object.entries(user.socialLinks || {}).filter(([, v]) => v && typeof v === 'string');
  return (
    <Card>
      <CardHeader title={t('profile.intro')} />
      {user.bio && <p class="intro-bio">{user.bio}</p>}
      <ul class="intro-list" role="list">
        {rows.map((r, i) => <li key={i}><Icon name={r.icon} size={20} /><span>{r.text}</span></li>)}
      </ul>
      {social.length > 0 && (
        <div class="intro-social">
          {social.map(([k, v]) => {
            const icon = { instagram: 'instagram-logo', facebook: 'facebook-logo', tiktok: 'tiktok-logo', linkedin: 'link', youtube: 'youtube-logo' }[k] || 'link';
            const href = /^https?:/.test(v) ? v : `https://${k}.com/${v.replace(/^@/, '')}`;
            return <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow" class="icon-btn icon-btn-soft" style={{ width: 38, height: 38 }} aria-label={k}><Icon name={icon} size={20} /></a>;
          })}
        </div>
      )}
      {own && <Button block variant="secondary" onClick={onEdit}>{t('profile.editDetails')}</Button>}
    </Card>
  );
}

function PhotosGrid({ photos, limit = 9, onOpen }) {
  if (!photos.length) return <p class="muted small">{t('profile.noPhotos')}</p>;
  return (
    <div class="photo-grid">
      {photos.slice(0, limit).map((u, i) => <button key={u + i} type="button" class="photo-grid-item" onClick={() => onOpen(i)}><Img src={u} width={200} alt="" /></button>)}
    </div>
  );
}

/** Profile: cover, identity, relationship actions and tabs. */
export default function Profile({ params }) {
  const key = params.id === 'me' ? uid.value : params.id;
  const resolved = useAsync(() => (key ? resolveUserKey(key) : Promise.resolve(null)), [key]);
  const userId = resolved.data;
  const live = useLive(userId ? (ok, err) => listenUser(userId, ok, err) : null, [userId]);
  const user = live.data;
  const own = !!uid.value && userId === uid.value;
  const tab = query.value.get('tab') || 'posts';
  const [dialog, setDialog] = useState(null);
  const [lightbox, setLightbox] = useState(-1);
  const [counts, setCounts] = useState({ followers: null, following: null });
  const [friends, setFriends] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const postsLive = useLive(userId ? (ok) => listenUserPosts(userId, ok) : null, [userId]);
  const blocked = useAsync(() => (userId && !own ? isBlockedBy(userId) : Promise.resolve(false)), [userId, own]);
  useTitle(user?.name || t('nav.profile'));

  useEffect(() => { if (params.id === 'me' && !signedIn.value && uid.value === null) navigate('/login?next=/u/me', { replace: true }); }, [params.id, uid.value]);
  useEffect(() => { if (userId) followCounts(userId).then(setCounts); }, [userId]);
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    const unsub = listenFriendIds(userId, (ids) => { setFriendCount(ids.length); getUsers(ids.slice(0, 30)).then((u) => alive && setFriends(u)); });
    return () => { alive = false; unsub(); };
  }, [userId]);

  const posts = postsLive.data || [];
  const photos = useMemo(() => posts.flatMap((p) => p.media.filter((m) => !/\.(mp4|webm|mov)|\/video\/upload\//i.test(m))), [posts]);
  const isFriend = friendIds.value.has(userId);
  const restricted = !own && user && (user.privacy?.profilePref === 'friends' || user.privacy?.profilePref === 'private') && !isFriend;
  const visiblePosts = posts.filter((p) => own || p.visibility === 'public' || !p.visibility || (isFriend && ['friends', 'followers', 'close_friends'].includes(p.visibility)));

  if (resolved.loading || (userId && live.loading)) return <PageSpinner />;
  if (!userId || !user || user.suspended || blocked.data) {
    return <Card><Empty icon="user-circle" title={t('profile.notFound')} text={t('profile.notFoundText')} action={<Button variant="primary" href="/">{t('nav.home')}</Button>} /></Card>;
  }

  const message = async () => {
    try { navigate(`/messages/${await openDirect(userId)}`); } catch (e) { toast.error(messageError(e)); }
  };

  const tabs = [
    { value: 'posts', label: t('profile.posts') },
    { value: 'about', label: t('profile.about') },
    { value: 'friends', label: t('nav.friends'), count: friendCount },
    { value: 'photos', label: t('profile.photos'), count: photos.length },
    { value: 'checkins', label: t('profile.checkins') },
  ];

  return (
    <div class="profile">
      <Card pad={false} class="profile-header">
        <div class="profile-cover">
          {user.cover ? <Img src={user.cover} width={1100} alt="" eager /> : <div class="profile-cover-empty" />}
          {own && <Button size="sm" variant="secondary" icon="camera" class="profile-cover-btn" onClick={() => setDialog('edit')}>{t('profile.editCover')}</Button>}
        </div>
        <div class="profile-id">
          <div class="profile-avatar">
            <Avatar src={user.avatar} name={user.name} size={168} ring={undefined} />
            {own && <IconButton icon="camera" label={t('profile.changePhoto')} variant="soft" size={40} class="profile-avatar-btn" onClick={() => setDialog('edit')} />}
          </div>
          <div class="profile-names">
            <h1 class="profile-name">{user.name}{user.verified && <Verified size={22} />}</h1>
            <div class="profile-sub">
              {user.username && <span>@{user.username}</span>}
              {user.premium && <span class="tag tag-accent"><Icon name="crown-fill" size={12} />{t('nav.premium')}</span>}
            </div>
            <div class="profile-stats">
              <button type="button" onClick={() => setQuery({ tab: 'friends' })}><strong>{formatCount(friendCount)}</strong> {t('profile.friendsWord')}</button>
              <button type="button" onClick={() => setDialog('followers')}><strong>{counts.followers == null ? '–' : formatCount(counts.followers)}</strong> {t('profile.followersWord')}</button>
              <button type="button" onClick={() => setDialog('following')}><strong>{counts.following == null ? '–' : formatCount(counts.following)}</strong> {t('profile.followingWord')}</button>
            </div>
            {friends.length > 0 && (
              <div class="profile-friend-faces">{friends.slice(0, 8).map((f) => <Avatar key={f.id} src={f.avatar} name={f.name} size={32} href={`/u/${f.id}`} />)}</div>
            )}
          </div>
          <div class="profile-actions">
            {own ? (
              <>
                <Button variant="primary" icon="plus" onClick={() => { storyCreator.value = true; }}>{t('stories.create')}</Button>
                <Button variant="secondary" icon="pencil-simple" onClick={() => setDialog('edit')}>{t('profile.edit')}</Button>
              </>
            ) : (
              <>
                <FriendButton userId={userId} />
                <Button variant="primary" icon="chat-circle-dots" onClick={message}>{t('profile.message')}</Button>
                <FollowButton userId={userId} />
              </>
            )}
            <Menu label={t('common.more')} width={260} items={[
              { icon: 'link', label: t('common.copyLink'), onClick: () => copyLink(`${location.origin}/u/${user.username || userId}`) },
              { icon: 'flag', label: t('profile.report'), hidden: own, onClick: () => setDialog('report') },
              { icon: 'prohibit', label: t('profile.block'), danger: true, hidden: own || !signedIn.value, onClick: () => blockUser(userId).then(() => { toast(t('safety.blocked')); navigate('/'); }).catch(() => toast.error(t('common.error'))) },
              { icon: 'gear', label: t('nav.settings'), hidden: !own, href: '/settings' },
            ]} trigger={(p) => <IconButton {...p} icon="dots-three" label={t('common.more')} variant="soft" size={40} />} />
          </div>
        </div>
        <Tabs items={tabs} value={tab} onChange={(v) => setQuery({ tab: v === 'posts' ? null : v })} label={t('nav.profile')} class="profile-tabs" />
      </Card>

      {restricted ? (
        <Card><Empty icon="lock" title={t('profile.privateTitle')} text={t('profile.privateText', { name: user.name.split(' ')[0] })} /></Card>
      ) : (
        <>
          {tab === 'posts' && (
            <div class="profile-grid">
              <div class="profile-side">
                <Intro user={user} own={own} onEdit={() => setDialog('edit')} />
                <Card>
                  <CardHeader title={t('profile.photos')} action={photos.length > 0 && <button type="button" class="link" onClick={() => setQuery({ tab: 'photos' })}>{t('common.seeAll')}</button>} />
                  <PhotosGrid photos={photos} onOpen={setLightbox} />
                </Card>
                <Card>
                  <CardHeader title={t('nav.friends')} sub={tn('friends.count', friendCount)} action={friendCount > 0 && <button type="button" class="link" onClick={() => setQuery({ tab: 'friends' })}>{t('common.seeAll')}</button>} />
                  {friends.length ? <PeopleGrid users={friends} /> : <p class="muted small">{t('friends.noFriends')}</p>}
                </Card>
              </div>
              <div class="profile-main feed">
                {own && (
                  <Card class="composer-card">
                    <div class="composer-card-top" style={{ borderBottom: 0, paddingBottom: 0 }}>
                      <Avatar src={user.avatar} name={user.name} size={40} />
                      <button type="button" class="composer-card-input" onClick={() => openComposer({})}>{t('composer.placeholder', { name: user.name.split(' ')[0] })}</button>
                    </div>
                  </Card>
                )}
                {postsLive.loading && <PageSpinner />}
                {!postsLive.loading && !visiblePosts.length && <Card><Empty compact icon="note-pencil" title={t('profile.noPosts')} text={own ? t('profile.noPostsOwn') : ''} /></Card>}
                {visiblePosts.map((p) => <PostCard key={p.id} post={p} />)}
              </div>
            </div>
          )}
          {tab === 'about' && <div class="profile-narrow"><Intro user={user} own={own} onEdit={() => setDialog('edit')} /></div>}
          {tab === 'friends' && (
            <Card>
              <CardHeader title={t('nav.friends')} sub={tn('friends.count', friendCount)} />
              {friends.length ? <div class="friend-list-grid">{friends.map((f) => (
                <a key={f.id} href={`/u/${f.id}`} class="friend-tile"><Avatar src={f.avatar} name={f.name} size={72} square /><span class="friend-tile-text"><strong>{f.name}</strong>{f.city && <span class="muted small">{cityLabel(f.city)}</span>}</span></a>
              ))}</div> : <Empty compact icon="users" title={t('friends.noFriends')} />}
            </Card>
          )}
          {tab === 'photos' && (
            <Card>
              <CardHeader title={t('profile.photos')} />
              <PhotosGrid photos={photos} limit={200} onOpen={setLightbox} />
            </Card>
          )}
          {tab === 'checkins' && <CheckinsTab userId={userId} />}
        </>
      )}

      {lightbox >= 0 && <Lightbox media={photos} index={lightbox} onClose={() => setLightbox(-1)} />}
      {dialog === 'edit' && <EditProfileDialog user={user} onClose={() => setDialog(null)} />}
      {dialog === 'report' && <ReportDialog target={{ type: 'user', id: userId }} onClose={() => setDialog(null)} />}
      {dialog === 'followers' && <PeopleList title={t('follow.followers')} load={() => listFollowers(userId)} onClose={() => setDialog(null)} />}
      {dialog === 'following' && <PeopleList title={t('follow.followingTab')} load={() => listFollowing(userId)} onClose={() => setDialog(null)} />}
    </div>
  );
}

function CheckinsTab({ userId }) {
  const { data, loading } = useAsync(() => userCheckins(userId), [userId]);
  return (
    <Card>
      <CardHeader title={t('profile.checkins')} />
      {loading && <div class="center-pad"><Spinner /></div>}
      {data && !data.length && <Empty compact icon="map-pin" title={t('profile.noCheckins')} />}
      <div class="checkin-list">
        {data?.map((c) => (
          <a key={c.id} href={c.placeId ? `/place/${c.placeId}` : '#'} class="checkin-row">
            <span class="searchbox-ico is-place"><Icon name="map-pin-fill" size={20} /></span>
            <span class="picker-text"><strong>{c.placeName || '—'}</strong><span class="muted small">{formatDate(c.createdAt)}</span></span>
          </a>
        ))}
      </div>
    </Card>
  );
}

