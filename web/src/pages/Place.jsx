import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Menu } from '../ui/Menu.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Confirm } from '../ui/Modal.jsx';
import { TextArea } from '../ui/Field.jsx';
import { Card, Empty, Img, PageSpinner, Spinner } from '../ui/misc.jsx';
import { t, tn, formatCount } from '../lib/i18n.js';
import { useTitle, useLive, useAsync } from '../lib/hooks.js';
import { timeAgo } from '../lib/format.js';
import { query, setQuery, navigate } from '../lib/router.js';
import { uid, isAdmin } from '../lib/auth.js';
import { requireLogin } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { cityLabel } from '../lib/geo.js';
import {
  listenPlace, listenPlaceReviews, addPlaceReview, deletePlaceReview, reviewStats, placeCheckins, placePosts, deletePlace,
} from '../data/places.js';
import { isSaved, setSaved } from '../data/posts.js';
import { categoryOf } from '../features/places/categories.js';
import { Stars, StarInput } from '../features/places/Stars.jsx';
import { CheckinDialog } from '../features/places/CheckinDialog.jsx';
import { PostCard } from '../features/post/PostCard.jsx';
import { Lightbox } from '../features/post/Lightbox.jsx';
import { copyLink } from '../features/post/ShareDialog.jsx';

function ReviewForm({ placeId, onDone }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!requireLogin('review') || !rating) return;
    setBusy(true);
    try { await addPlaceReview(placeId, rating, text); toast.success(t('place.reviewThanks')); setRating(0); setText(''); onDone?.(); }
    catch { toast.error(t('common.error')); }
    setBusy(false);
  };
  return (
    <div class="review-form">
      <strong>{t('place.writeReview')}</strong>
      <StarInput value={rating} onChange={setRating} />
      {rating > 0 && (
        <>
          <TextArea label={t('place.reviewText')} optional={t('common.optional')} value={text} onInput={(e) => setText(e.currentTarget.value)} maxLength={1000} minRows={2} placeholder={t('place.reviewHint')} />
          <div class="row gap-8"><Button variant="primary" onClick={submit} loading={busy}>{t('common.publish')}</Button><Button variant="ghost" onClick={() => setRating(0)}>{t('common.cancel')}</Button></div>
        </>
      )}
    </div>
  );
}

function Reviews({ place, reviews }) {
  const stats = reviewStats(reviews || [], place);
  const mine = reviews?.find((r) => r.userId === uid.value);
  return (
    <div class="stack">
      <Card class="review-summary">
        <div class="review-avg">
          <span class="review-avg-num">{stats.avg ? stats.avg.toFixed(1).replace('.', ',') : '—'}</span>
          <Stars value={stats.avg} size={18} />
          <span class="muted small">{tn('place.reviews', stats.count)}</span>
        </div>
        <div class="review-bars">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = stats.dist[n - 1];
            const total = reviews?.length || 0;
            return (
              <div key={n} class="review-bar">
                <span class="small">{n}</span>
                <span class="review-bar-track"><span style={{ width: `${total ? (c / total) * 100 : 0}%` }} /></span>
                <span class="muted small">{c}</span>
              </div>
            );
          })}
        </div>
      </Card>
      {!mine && <Card><ReviewForm placeId={place.id} /></Card>}
      {!reviews ? <div class="center-pad"><Spinner /></div> : reviews.length ? (
        <Card class="review-list">
          {reviews.map((r) => (
            <article key={r.id} class="review">
              <Avatar src={r.userPhoto} name={r.userName} size={40} href={r.userId ? `/u/${r.userId}` : undefined} />
              <div class="grow">
                <div class="row gap-8 wrap">
                  <a href={`/u/${r.userId}`} class="bold">{r.userName || t('common.user')}</a>
                  <Stars value={r.rating} size={14} />
                  <span class="muted xs">{timeAgo(r.createdAt)}</span>
                </div>
                {r.comment && <p class="review-text">{r.comment}</p>}
              </div>
              {(r.userId === uid.value || isAdmin.value) && (
                <IconButton icon="trash" label={t('common.delete')} size={32} onClick={() => deletePlaceReview(r.id).then(() => toast(t('place.reviewDeleted'))).catch(() => toast.error(t('common.error')))} />
              )}
            </article>
          ))}
        </Card>
      ) : <Card><Empty compact icon="star" title={t('place.noReviews')} /></Card>}
    </div>
  );
}

function Visitors({ placeId }) {
  const { data } = useAsync(() => placeCheckins(placeId, 40), [placeId]);
  if (!data) return <div class="center-pad"><Spinner /></div>;
  if (!data.length) return <Empty compact icon="map-pin" title={t('place.noCheckins')} />;
  return (
    <div class="visitor-list">
      {data.map((c) => (
        <a key={c.id} href={`/u/${c.authorId || c.userId}`} class="visitor">
          <Avatar src={c.authorAvatar} name={c.authorName} size={40} />
          <span class="grow">
            <strong class="ellipsis" style={{ display: 'block' }}>{c.authorName || t('common.user')}</strong>
            {c.caption && <span class="small text-2 ellipsis" style={{ display: 'block' }}>{c.caption}</span>}
          </span>
          {c.verified && <Icon name="seal-check-fill" size={16} class="tone-green" label={t('checkin.verified')} />}
          <span class="muted xs">{timeAgo(c.createdAt)}</span>
        </a>
      ))}
    </div>
  );
}

function Posts({ placeId }) {
  const { data } = useAsync(() => placePosts(placeId, 30), [placeId]);
  if (!data) return <div class="center-pad"><Spinner /></div>;
  if (!data.length) return <Card><Empty compact icon="note-pencil" title={t('place.noPosts')} /></Card>;
  return <div class="feed">{data.map((p) => <PostCard key={p.id} post={p} />)}</div>;
}

/** Place page: gallery, rating, check-in, save, reviews, visitors and posts. */
export default function Place({ params }) {
  const { data: place, loading } = useLive((ok, err) => listenPlace(params.id, ok, err), [params.id]);
  const [reviews, setReviews] = useState(null);
  const [saved, setSavedState] = useState(false);
  const [checkin, setCheckin] = useState(false);
  const [lightbox, setLightbox] = useState(-1);
  const [confirmDel, setConfirmDel] = useState(false);
  useTitle(place?.name || t('nav.explore'));
  useEffect(() => listenPlaceReviews(params.id, setReviews), [params.id]);
  useEffect(() => { if (uid.value) isSaved('place', params.id).then(setSavedState); }, [params.id, uid.value]);
  const tab = query.value.get('tab') || 'about';

  if (loading) return <PageSpinner />;
  if (!place || place.status === 'deleted') {
    return <Card><Empty icon="map-pin" title={t('place.notFound')} action={<Button variant="primary" href="/explore">{t('nav.explore')}</Button>} /></Card>;
  }

  const cat = categoryOf(place);
  const stats = reviewStats(reviews || [], place);
  const photos = [place.image, ...place.photos].filter((x, i, a) => x && a.indexOf(x) === i);
  const own = place.creatorId === uid.value;
  const toggleSave = async () => {
    if (!requireLogin('save')) return;
    try { await setSaved('place', place.id, !saved, { title: place.name, image: place.image }); setSavedState(!saved); toast(t(saved ? 'saved.removed' : 'saved.added')); }
    catch { toast.error(t('common.error')); }
  };

  return (
    <div class="place-page">
      <Card class="place-hero" pad={false}>
        <div class={`place-gallery n${Math.min(photos.length, 3)}`}>
          {photos.length ? photos.slice(0, 3).map((src, i) => (
            <button key={src} type="button" class="place-gallery-item" onClick={() => setLightbox(i)} aria-label={t('place.photo', { n: i + 1 })}>
              <Img src={src} width={i === 0 ? 1200 : 600} alt="" eager={i === 0} />
              {i === 2 && photos.length > 3 && <span class="place-gallery-more">+{photos.length - 3}</span>}
            </button>
          )) : <span class="place-gallery-empty" style={{ '--tone': cat.tone }}><Icon name={cat.icon} size={56} /></span>}
        </div>
        <div class="place-head">
          <span class="place-cat-chip" style={{ '--tone': cat.tone }}><Icon name={cat.icon} size={14} />{cat.label}</span>
          <h1 class="place-name">{place.name}{place.verified && <Icon name="seal-check-fill" size={22} class="tone-brand" label={t('common.verified')} />}</h1>
          <p class="place-meta">
            {(place.address || place.city) && <span><Icon name="map-pin" size={15} />{[place.address !== place.city ? place.address : '', cityLabel(place.city)].filter(Boolean).join(', ')}</span>}
            {stats.avg > 0 && <span class="place-rating"><Icon name="star-fill" size={15} />{stats.avg.toFixed(1).replace('.', ',')} <span class="muted">({tn('place.reviews', stats.count)})</span></span>}
            {place.checkinCount > 0 && <span class="muted">{tn('place.checkins', place.checkinCount)}</span>}
          </p>
          <div class="place-actions">
            <Button variant="primary" icon="map-pin" onClick={() => { if (requireLogin('checkin')) setCheckin(true); }}>{t('checkin.short')}</Button>
            <Button variant={saved ? 'soft' : 'secondary'} icon={saved ? 'bookmark-simple-fill' : 'bookmark-simple'} onClick={toggleSave}>{t(saved ? 'common.saved' : 'post.save')}</Button>
            {place.lat != null && <Button variant="secondary" icon="navigation-arrow" href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`} target="_blank" rel="noopener">{t('place.directions')}</Button>}
            {place.lat != null && <Button variant="secondary" icon="map-trifold" href={`/map?place=${place.id}`}>{t('place.onMap')}</Button>}
            <Menu label={t('common.more')} width={240} items={[
              { icon: 'share-fat', label: t('common.copyLink'), onClick: () => copyLink(`${location.origin}/place/${place.id}`) },
              { icon: 'trash', label: t('common.delete'), danger: true, hidden: !own && !isAdmin.value, onClick: () => setConfirmDel(true) },
            ]} trigger={(p) => <IconButton {...p} icon="dots-three" label={t('common.more')} variant="soft" size={40} />} />
          </div>
        </div>
        <div class="place-tabs">
          <Tabs value={tab} onChange={(v) => setQuery({ tab: v === 'about' ? null : v })} label={place.name} items={[
            { value: 'about', label: t('place.about') },
            { value: 'reviews', label: `${t('place.reviewsTab')}${stats.count ? ` · ${formatCount(stats.count)}` : ''}` },
            { value: 'visitors', label: t('place.visitors') },
            { value: 'posts', label: t('place.posts') },
          ]} />
        </div>
      </Card>

      <div class="place-body">
        {tab === 'about' && (
          <>
            <Card>
              <h2 class="card-title">{t('place.about')}</h2>
              <p class="place-desc">{place.description || t('place.noDescription')}</p>
              {photos.length > 3 && (
                <div class="place-photo-grid">
                  {photos.map((src, i) => <button key={src} type="button" onClick={() => setLightbox(i)} aria-label={t('place.photo', { n: i + 1 })}><Img src={src} width={320} alt="" /></button>)}
                </div>
              )}
            </Card>
            {reviews?.length > 0 && (
              <Card>
                <div class="card-head"><h2 class="card-title">{t('place.reviewsTab')}</h2><button type="button" class="link" onClick={() => setQuery({ tab: 'reviews' })}>{t('common.seeAll')}</button></div>
                <div class="review-list">
                  {reviews.slice(0, 2).map((r) => (
                    <article key={r.id} class="review">
                      <Avatar src={r.userPhoto} name={r.userName} size={36} />
                      <div class="grow"><div class="row gap-8 wrap"><strong>{r.userName}</strong><Stars value={r.rating} size={13} /></div>{r.comment && <p class="review-text">{r.comment}</p>}</div>
                    </article>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
        {tab === 'reviews' && <Reviews place={place} reviews={reviews} />}
        {tab === 'visitors' && <Card><Visitors placeId={place.id} /></Card>}
        {tab === 'posts' && <Posts placeId={place.id} />}
      </div>

      {checkin && <CheckinDialog place={place} onClose={() => setCheckin(false)} />}
      {lightbox >= 0 && <Lightbox media={photos} index={lightbox} onClose={() => setLightbox(-1)} />}
      <Confirm open={confirmDel} danger title={t('place.deleteTitle')} confirmLabel={t('common.delete')} onClose={() => setConfirmDel(false)}
        onConfirm={() => deletePlace(place.id).then(() => { toast(t('place.deleted')); navigate('/explore'); }).catch(() => toast.error(t('common.error')))} />
    </div>
  );
}
