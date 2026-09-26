import { useEffect, useState } from 'preact/hooks';
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
import { ReportDialog } from '../features/post/PostCard.jsx';
import { safeBackground } from '../features/post/backgrounds.js';
import { isVideoUrl } from '../data/normalize.js';
import { FriendButton, FollowButton } from '../features/user/FriendButton.jsx';
import { EditProfileDialog } from '../features/user/EditProfileDialog.jsx';
import { messageError } from '../features/messages/errors.js';
import { copyLink } from '../features/post/ShareDialog.jsx';
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
    { value: 'posts', label: t('profile.posts'), icon: 'squares-four', count: visiblePosts.length },
    { value: 'about', label: t('profile.about'), icon: 'user-circle' },
    { value: 'friends', label: t('nav.friends'), icon: 'users', count: friendCount },
    { value: 'checkins', label: t('profile.checkins'), icon: 'map-pin' },
  ];

  return (
    <div class="profile">
      <section class="pf-head">
        <div class="pf-avatar">
          <Avatar src={user.avatar} name={user.name} size={150} ring="story" />
          {own && <IconButton icon="camera" label={t('profile.changePhoto')} variant="soft" size={36} class="pf-avatar-btn" onClick={() => setDialog('edit')} />}
        </div>
        <div class="pf-info">
          <div class="pf-name-row">
            <h1 class="pf-name">{user.name}{user.verified && <Verified size={20} />}</h1>
            {user.premium && <span class="tag tag-accent"><Icon name="crown-fill" size={12} />{t('nav.premium')}</span>}
          </div>
          {user.username && <p class="pf-username">@{user.username}</p>}
          <div class="pf-stats">
            <span><strong>{formatCount(visiblePosts.length)}</strong>{t('profile.postsWord')}</span>
            <button type="button" onClick={() => setDialog('followers')}><strong>{counts.followers == null ? '–' : formatCount(counts.followers)}</strong>{t('profile.followersWord')}</button>
            <button type="button" onClick={() => setQuery({ tab: 'friends' })}><strong>{formatCount(friendCount)}</strong>{t('profile.friendsWord')}</button>
            <button type="button" onClick={() => setDialog('following')}><strong>{counts.following == null ? '–' : formatCount(counts.following)}</strong>{t('profile.followingWord')}</button>
          </div>
          {user.bio && <p class="pf-bio">{user.bio}</p>}
          {(user.city || user.website) && (
            <p class="pf-meta">
              {user.city && <span><Icon name="map-pin" size={14} />{cityLabel(user.city)}</span>}
              {user.website && <a href={/^https?:/.test(user.website) ? user.website : `https://${user.website}`} target="_blank" rel="noopener" class="link"><Icon name="link" size={14} />{user.website.replace(/^https?:\/\//, '')}</a>}
            </p>
          )}
          <div class="pf-actions">
            {own ? (
              <>
                <Button variant="secondary" icon="pencil-simple" onClick={() => setDialog('edit')}>{t('profile.edit')}</Button>
                <Button variant="secondary" icon="plus-circle" onClick={() => { storyCreator.value = true; }}>{t('stories.create')}</Button>
              </>
            ) : (
              <>
                <FollowButton userId={userId} />
                <Button variant="secondary" icon="chat-circle-dots" onClick={message}>{t('profile.message')}</Button>
                <FriendButton userId={userId} />
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
      </section>
      {friends.length > 0 && (
        <div class="pf-friends" aria-label={t('nav.friends')}>
          {friends.slice(0, 12).map((f) => (
            <a key={f.id} href={`/u/${f.id}`} class="pf-friend"><Avatar src={f.avatar} name={f.name} size={60} ring="seen" /><span>{f.name.split(' ')[0]}</span></a>
          ))}
        </div>
      )}
      <Tabs items={tabs} value={tab} onChange={(v) => setQuery({ tab: v === 'posts' ? null : v })} label={t('nav.profile')} class="pf-tabs" />

      {restricted ? (
        <Card><Empty icon="lock" title={t('profile.privateTitle')} text={t('profile.privateText', { name: user.name.split(' ')[0] })} /></Card>
      ) : (
        <>
          {tab === 'posts' && (postsLive.loading ? <PageSpinner /> : visiblePosts.length ? (
            <div class="pf-grid">
              {own && <button type="button" class="pf-grid-add" onClick={() => openComposer({})}><Icon name="plus" size={30} /><span>{t('home.share')}</span></button>}
              {visiblePosts.map((p) => <PostThumb key={p.id} post={p} />)}
            </div>
          ) : <Card><Empty compact icon="camera" title={t('profile.noPosts')} text={own ? t('profile.noPostsOwn') : ''} action={own && <Button variant="primary" icon="plus" onClick={() => openComposer({})}>{t('home.share')}</Button>} /></Card>)}
          {tab === 'about' && <div class="profile-narrow"><Intro user={user} own={own} onEdit={() => setDialog('edit')} /></div>}
          {tab === 'friends' && (
            <Card>
              <CardHeader title={t('nav.friends')} sub={tn('friends.count', friendCount)} />
              {friends.length ? <div class="friend-list-grid">{friends.map((f) => (
                <a key={f.id} href={`/u/${f.id}`} class="friend-tile"><Avatar src={f.avatar} name={f.name} size={72} square /><span class="friend-tile-text"><strong>{f.name}</strong>{f.city && <span class="muted small">{cityLabel(f.city)}</span>}</span></a>
              ))}</div> : <Empty compact icon="users" title={t('friends.noFriends')} />}
            </Card>
          )}
          {tab === 'checkins' && <CheckinsTab userId={userId} />}
        </>
      )}

      {dialog === 'edit' && <EditProfileDialog user={user} onClose={() => setDialog(null)} />}
      {dialog === 'report' && <ReportDialog target={{ type: 'user', id: userId }} onClose={() => setDialog(null)} />}
      {dialog === 'followers' && <PeopleList title={t('follow.followers')} load={() => listFollowers(userId)} onClose={() => setDialog(null)} />}
      {dialog === 'following' && <PeopleList title={t('follow.followingTab')} load={() => listFollowing(userId)} onClose={() => setDialog(null)} />}
    </div>
  );
}

/** Square grid tile: first photo, or the text on its background. */
function PostThumb({ post }) {
  const media = post.media[0];
  const video = media && isVideoUrl(media, post.mediaType);
  const bg = safeBackground(post.bgGradient);
  return (
    <a href={`/post/${post.id}`} class="pf-thumb" aria-label={post.text.slice(0, 80) || t('profile.posts')}>
      {media && !video && <Img src={media} width={420} alt="" />}
      {video && <span class="pf-thumb-text is-video"><Icon name="play-fill" size={32} /></span>}
      {!media && <span class="pf-thumb-text" style={bg ? { background: bg.css, color: bg.dark ? '#fff' : '#0b1220' } : undefined}>{(post.poll?.question || post.text).slice(0, 90)}</span>}
      {post.media.length > 1 && <span class="pf-thumb-multi"><Icon name="images" size={16} /></span>}
      <span class="pf-thumb-hover"><span><Icon name="heart-fill" size={18} />{formatCount(post.likeCount)}</span><span><Icon name="chat-circle-fill" size={18} />{formatCount(post.commentCount)}</span></span>
    </a>
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

