import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Avatar } from '../../ui/Avatar.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { TextArea } from '../../ui/Field.jsx';
import { Empty, Img, Spinner } from '../../ui/misc.jsx';
import { t, tn } from '../../lib/i18n.js';
import { cityLabel } from '../../lib/geo.js';
import { readCoordinates } from '../../lib/coordinates.js';
import { timeAgo } from '../../lib/format.js';
import { uid, isAdmin } from '../../lib/auth.js';
import { requireLogin, storyCreator } from '../../lib/store.js';
import { toast } from '../../lib/toast.js';
import { listenPlaceActivity } from '../../data/placeActivity.js';
import { isVideoUrl } from '../../data/normalize.js';
import { listenPlaceReviews, addPlaceReview, deletePlaceReview, reviewStats } from '../../data/places.js';
import { usePlaceSaved } from './usePlaceSaved.js';
import { PersonalActionNotice } from '../auth/PersonalActionNotice.jsx';
import { categoryOf } from './categories.js';
import { Stars, StarInput } from './Stars.jsx';
import { ReviewTagInput, ReviewTags, ReviewTagSummary } from './ReviewTags.jsx';
import { PlaceCoordinates } from './PlaceCoordinates.jsx';
import { PlacePhotoCredits } from './PlacePhotoCredits.jsx';
import { placePageHref } from '../../lib/placeLinks.js';
import { MatchedCatalogItem } from './MatchedCatalogItem.jsx';
import { ImportedPlaceInfo } from './ImportedPlaceInfo.jsx';
import { Lightbox } from '../post/Lightbox.jsx';
import { StoryViewer } from '../story/StoryViewer.jsx';
import { PlaceCommerce } from '../commerce/PlaceCommerce.jsx';
import '../../styles/map-details.css';

const SECTIONS = [
  { id: 'about', key: 'place.about' },
  { id: 'photos', key: 'map.photos' },
  { id: 'catalog', key: 'commerce.menuCatalog' },
  { id: 'reviews', key: 'place.reviewsTab' },
  { id: 'checkins', key: 'map.checkins' },
  { id: 'stories', key: 'stories.title' },
];

function websiteUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const text = value.trim();
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password && url.hostname.includes('.') ? url.href : '';
  } catch { return ''; }
}

function ActivityError({ onRetry }) {
  return <div class="map-detail-error" data-testid="map-section-error" role="alert"><Icon name="warning-circle" size={20} /><span>{t('map.activityFailed')}</span><Button size="sm" variant="ghost" onClick={onRetry}>{t('common.retry')}</Button></div>;
}

function ReviewForm({ placeId, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [experienceTags, setExperienceTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!rating || busy || !requireLogin('review')) return;
    setBusy(true);
    try {
      await addPlaceReview(placeId, rating, comment, experienceTags);
      toast.success(t('place.reviewThanks'));
      onDone();
    } catch { toast.error(t('common.error')); }
    finally { setBusy(false); }
  };
  return (
    <form class="map-detail-review-form" onSubmit={submit}>
      <PersonalActionNotice>ადგილზე შეფასება შენი პირადი გამოცდილების სახელით გამოქვეყნდება.</PersonalActionNotice>
      <StarInput value={rating} onChange={setRating} />
      <TextArea label={t('place.reviewText')} optional={t('common.optional')} value={comment} onInput={(e) => setComment(e.currentTarget.value)} maxLength={1000} minRows={3} placeholder={t('place.reviewHint')} />
      <ReviewTagInput value={experienceTags} onChange={setExperienceTags} disabled={busy}/>
      <div class="row gap-8"><Button type="submit" variant="primary" size="sm" disabled={!rating} loading={busy}>{t('common.publish')}</Button><Button variant="ghost" size="sm" disabled={busy} onClick={onDone}>{t('common.cancel')}</Button></div>
    </form>
  );
}

/** Non-modal place drawer: all content belongs to the current map selection. */
export function MapPlaceDetails({ place, onClose, onCheckin }) {
  const cat = categoryOf(place);
  const coords = readCoordinates(place);
  const closeRef = useRef(null);
  const scrollRef = useRef(null);
  const navRef = useRef(null);
  const sectionRefs = useRef({});
  const overlayFocus = useRef(null);
  const [activity, setActivity] = useState(null);
  const [activityRetry, setActivityRetry] = useState(0);
  const [reviews, setReviews] = useState(null);
  const [reviewError, setReviewError] = useState(null);
  const [reviewRetry, setReviewRetry] = useState(0);
  const [section, setSection] = useState('about');
  const [lightbox, setLightbox] = useState(null);
  const [storyView, setStoryView] = useState(null);
  const [writingReview, setWritingReview] = useState(false);
  const { toggleSave, ...saveState } = usePlaceSaved(place.id, place);
  const [deletingReview, setDeletingReview] = useState('');
  const pageHref = placePageHref(place);
  const headingId = `map-place-heading-${place.id}`;
  const viewerId = uid.value;
  const retryActivity = () => setActivityRetry((n) => n + 1);

  useEffect(() => {
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    return () => { cancelAnimationFrame(frame); if (previous?.isConnected) previous.focus?.({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    setActivity(null);
    return listenPlaceActivity(place, setActivity);
  }, [place.id, place.raw?.businessId, viewerId, activityRetry]);

  useEffect(() => {
    setReviews(null);
    setReviewError(null);
    return listenPlaceReviews(place.id, setReviews, (error) => { setReviewError(error); setReviews(null); });
  }, [place.id, reviewRetry]);

  useLayoutEffect(() => {
    const onKey = (event) => {
      // Nested viewers and the shared auth/check-in/creator dialog own Escape.
      if (event.key === 'Escape' && !event.defaultPrevented && !lightbox && !storyView && !document.querySelector('.modal-layer, .story-viewer, .lightbox')) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [!!lightbox, !!storyView, onClose]);

  const photos = activity?.photos || [...new Set([place.image, ...(place.photos || [])].filter(Boolean))];
  const groups = activity?.storyGroups || [];
  const recent = activity?.recentCheckins || [];
  const checkins = activity?.checkins || [];
  const stats = reviewStats(reviews || [], place);
  const mine = reviews?.some((r) => r.userId === viewerId);
  const raw = place.raw || {};
  const phone = typeof raw.phone === 'string' ? raw.phone.trim() : '';
  const telephone = phone.replace(/[^\d+]/g, '');
  const website = websiteUrl(raw.website || raw.url);
  const hours = [raw.hours, raw.openingHours].find((v) => typeof v === 'string' && v.trim());
  const facilities = (Array.isArray(raw.amenities) ? raw.amenities : Array.isArray(raw.facilities) ? raw.facilities : []).filter((v) => typeof v === 'string' && v.trim()).slice(0, 12);

  const jump = (id) => {
    const container = scrollRef.current;
    const target = sectionRefs.current[id];
    if (!container || !target) return;
    setSection(id);
    const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - (navRef.current?.offsetHeight || 0);
    container.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const onScroll = () => {
    const top = scrollRef.current?.getBoundingClientRect().top + (navRef.current?.offsetHeight || 0) + 8;
    let active = 'about';
    for (const { id } of SECTIONS) if (sectionRefs.current[id]?.getBoundingClientRect().top <= top) active = id;
    setSection((current) => current === active ? current : active);
  };
  const openPhoto = (index) => { if (index < 0 || !photos[index]) return; overlayFocus.current = document.activeElement; setLightbox({ media: [...photos], index }); };
  const closePhoto = () => { setLightbox(null); requestAnimationFrame(() => overlayFocus.current?.focus?.({ preventScroll: true })); };
  const openStory = (group) => { overlayFocus.current = document.activeElement; setStoryView({ groups, start: { group, story: 0 } }); };
  const closeStory = () => { setStoryView(null); requestAnimationFrame(() => overlayFocus.current?.focus?.({ preventScroll: true })); };
  const addStory = () => { if (requireLogin('story')) storyCreator.value = { placeId: place.id, placeName: place.name }; };
  const removeReview = async (id) => {
    setDeletingReview(id);
    try { await deletePlaceReview(id); toast(t('place.reviewDeleted')); }
    catch { toast.error(t('common.error')); }
    finally { setDeletingReview(''); }
  };
  const pageLink = () => <a data-testid="map-place-page" class="map-detail-page-link" href={pageHref} target="_blank" rel="noopener noreferrer">{t('map.openPage')}<Icon name="arrow-up-right" size={14} /></a>;
  const picture = (src, width = 480, eager = false) => <Img key={src} src={src} width={width} eager={eager} alt="" />;
  const sectionProps = (id) => ({ id: `map-place-section-${id}`, 'data-map-section': id, ref: (el) => { sectionRefs.current[id] = el; } });

  return (
    <aside class="map-place-details" aria-labelledby={headingId}>
      <header class="map-detail-toolbar">
        <button ref={closeRef} type="button" data-testid="map-details-close" class="map-detail-back" onClick={onClose}><Icon name="caret-left" size={18} />{t('map.backToMap')}</button>
        {pageLink()}
      </header>
      <div ref={scrollRef} class="map-detail-scroll" onScroll={onScroll}>
        <section class="map-detail-recent" data-testid="map-recent-checkins" aria-labelledby="map-recent-heading">
          <div class="map-detail-section-head"><h3 id="map-recent-heading">{t('map.recentCheckins')}</h3><span>{t('map.recentWindow')}</span></div>
          <div class={`map-detail-activity${recent.length && !activity?.pending.checkins && !activity?.errors.checkins ? ' has-recent' : ''}`}>
          {activity?.errors.checkins ? <ActivityError onRetry={retryActivity} /> : !activity || activity.pending.checkins ? <div class="map-detail-loading"><Spinner /></div> : recent.length ? (
            <div class="map-detail-people">
              {recent.slice(0, 4).map((c) => <div key={c.id} class="map-detail-person"><Avatar src={c.authorAvatar} name={c.authorName} size={38} /><span class="ellipsis">{c.authorName || t('common.user')}</span><small>{timeAgo(c.createdAt)}</small></div>)}
              {recent.length > 4 && <button type="button" class="map-detail-more-people" onClick={() => jump('checkins')}>+{recent.length - 4}</button>}
            </div>
          ) : <p class="map-detail-hint">{t('map.noRecentCheckins')}</p>}
          <div class="map-detail-story-strip">
            {groups.slice(0, 5).map((g, index) => <button key={g.actorId || g.authorId} type="button" class={`map-detail-story-person${g.seen ? ' is-seen' : ''}`} onClick={() => openStory(index)} aria-label={t('stories.open', { name: g.name })}><span class="map-detail-story-ring"><Avatar src={g.avatar || place.image} name={g.name || place.name} size={40} /></span><span class="ellipsis">{g.name || place.name}</span></button>)}
            <button type="button" class="map-detail-add-story" onClick={addStory}><span><Icon name="plus" size={20} /></span><small>{t('map.addStory')}</small></button>
          </div>
          </div>
        </section>

        <div class={`map-detail-gallery n${Math.min(photos.length, 3)}`}>
          {photos.length ? photos.slice(0, 3).map((src, index) => <button key={src} type="button" data-testid="map-details-photo" onClick={() => openPhoto(index)} aria-label={t('place.photo', { n: index + 1 })}>{picture(src, index ? 320 : 800, index === 0)}{index === Math.min(photos.length, 3) - 1 && <span class="map-detail-photo-count"><Icon name="images" size={14} />{tn('map.photoCount', photos.length)}</span>}</button>) : <div class="map-detail-no-photo" style={{ '--tone': cat.tone }}><Icon name={cat.icon} size={48} /><span>{t('map.noPhotos')}</span></div>}
        </div>

        <section class="map-detail-intro">
          <span class="map-detail-category" style={{ '--tone': cat.tone }}><Icon name={cat.icon} size={14} />{[cat.label, cityLabel(place.city)].filter(Boolean).join(' · ')}</span>
          <h2 id={headingId}>{place.name}{place.verified && <Icon name="seal-check-fill" size={21} class="tone-brand" label={t('common.verified')} />}</h2>
          {stats.avg > 0 && <div class="map-detail-rating"><Stars value={stats.avg} size={14} /><strong>{stats.avg.toFixed(1).replace('.', ',')}</strong><button type="button" class="link muted small" onClick={() => jump('reviews')}>{tn('place.reviews', stats.count)}</button></div>}
          <p class="map-detail-summary">{place.description || t('place.noDescription')}</p>
          <MatchedCatalogItem place={place} />
          <div class="map-detail-actions">
            <Button variant="primary" size="sm" icon="map-pin" onClick={onCheckin}>{t('checkin.short')}</Button>
            <Button variant={saveState.saved ? 'soft' : 'secondary'} size="sm" icon={saveState.saved ? 'bookmark-simple-fill' : 'bookmark-simple'} loading={saveState.busy || saveState.loading} onClick={toggleSave}>{t(saveState.saved ? 'common.saved' : 'post.save')}</Button>
            {coords && <IconButton icon="navigation-arrow" label={t('place.directions')} variant="soft" size={40} href={`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`} target="_blank" rel="noopener noreferrer" />}
          </div>
        </section>

        <nav ref={navRef} class="map-detail-tabs" aria-label={t('map.placeSections')}>
          {SECTIONS.map(({ id, key }) => <button key={id} type="button" data-section={id} aria-pressed={section === id} aria-controls={`map-place-section-${id}`} class={section === id ? 'is-active' : ''} onClick={() => jump(id)}>{t(key)}</button>)}
        </nav>

        <section class="map-detail-section" {...sectionProps('about')}>
          <h3>{t('map.aboutPlace')}</h3>
          <p class="map-detail-description">{place.description || t('place.noDescription')}</p>
          {(place.address || place.city) && <div class="map-detail-info-row"><Icon name="map-pin" size={18} /><span>{[place.address, cityLabel(place.city)].filter((v, i, a) => v && a.indexOf(v) === i).join(', ')}</span></div>}
          <PlaceCoordinates key={place.id} place={place} showMissing />
          <ImportedPlaceInfo place={place} showFacts={false}/>
          {hours && <div class="map-detail-info-row"><Icon name="clock" size={18} /><span>{hours}</span></div>}
          {phone && telephone && <a class="map-detail-info-row" href={`tel:${telephone}`}><Icon name="phone" size={18} /><span>{phone}</span></a>}
          {website && <a class="map-detail-info-row" href={website} target="_blank" rel="noopener noreferrer"><Icon name="globe" size={18} /><span>{new URL(website).hostname}</span><Icon name="arrow-up-right" size={14} /></a>}
          {facilities.length > 0 && <div class="map-detail-facilities">{facilities.map((text) => <span key={text}>{text}</span>)}</div>}
        </section>

        <section class="map-detail-section" {...sectionProps('photos')}>
          <div class="map-detail-section-head"><h3>{t('map.photos')}</h3><span>{photos.length || ''}</span></div>
          {photos.length ? <div class="map-detail-photo-grid">{photos.map((src, index) => <button key={src} type="button" data-testid="map-details-photo" onClick={() => openPhoto(index)} aria-label={t('place.photo', { n: index + 1 })}>{picture(src, 320)}</button>)}</div> : <Empty compact icon="images" title={t('map.noPhotos')} text={t('map.photoHint')} />}
          <PlacePhotoCredits place={place}/>
        </section>

        <section class="map-detail-section" {...sectionProps('catalog')}>
          <h3>{t('commerce.menuCatalog')}</h3>
          <PlaceCommerce place={place} />
        </section>

        <section class="map-detail-section" {...sectionProps('reviews')}>
          <h3>{t('map.reviewsAndComments')}</h3>
          {reviewError ? <ActivityError onRetry={() => setReviewRetry((n) => n + 1)} /> : !reviews ? <div class="map-detail-loading"><Spinner /></div> : <>
            <div class="map-detail-review-summary"><strong>{stats.avg ? stats.avg.toFixed(1).replace('.', ',') : '—'}</strong><div><Stars value={stats.avg} size={16} /><span class="muted small">{tn('place.reviews', stats.count)}</span></div></div>
            <ReviewTagSummary reviews={reviews}/>
            {!mine && <Button variant="secondary" size="sm" icon="note-pencil" onClick={() => { if (requireLogin('review')) setWritingReview((v) => !v); }}>{t('place.writeReview')}</Button>}
            {writingReview && !mine && <ReviewForm key={`${place.id}:${viewerId || ''}`} placeId={place.id} onDone={() => setWritingReview(false)} />}
            {reviews.length ? <div class="map-detail-review-list">{reviews.map((r) => <article key={r.id} class="map-detail-review"><Avatar src={r.userPhoto} name={r.userName} size={38} /><div class="grow"><div class="map-detail-review-head"><strong>{r.userName || t('common.user')}</strong><small>{timeAgo(r.createdAt)}</small></div><Stars value={r.rating} size={12} />{r.comment && <p>{r.comment}</p>}<ReviewTags review={r}/></div>{(r.userId === viewerId || isAdmin.value) && <IconButton icon="trash" size={32} label={t('common.delete')} disabled={!!deletingReview} onClick={() => removeReview(r.id)} />}</article>)}</div> : <Empty compact icon="star" title={t('place.noReviews')} />}
          </>}
        </section>

        <section class="map-detail-section" {...sectionProps('checkins')}>
          <h3>{t('map.guestCheckins')}</h3>
          {activity?.errors.checkins ? <ActivityError onRetry={retryActivity} /> : !activity || activity.pending.checkins ? <div class="map-detail-loading"><Spinner /></div> : checkins.length ? <div class="map-detail-checkin-list">{checkins.map((c) => <article key={c.id} class="map-detail-checkin"><Avatar src={c.authorAvatar} name={c.authorName} size={38} /><div class="grow"><strong>{c.authorName || t('common.user')}</strong>{c.caption && <p>{c.caption}</p>}{c.photoUrl && <button type="button" class="map-detail-checkin-photo" onClick={() => openPhoto(photos.indexOf(c.photoUrl))} aria-label={t('common.photo')}>{picture(c.photoUrl, 240)}</button>}</div><small>{timeAgo(c.createdAt)}</small></article>)}</div> : <Empty compact icon="map-pin" title={t('place.noCheckins')} />}
        </section>

        <section class="map-detail-section" {...sectionProps('stories')}>
          <div class="map-detail-section-head"><h3>{t('map.placeStories')}</h3><Button variant="ghost" size="sm" icon="plus" onClick={addStory}>{t('map.addStory')}</Button></div>
          {activity?.errors.stories ? <ActivityError onRetry={retryActivity} /> : !activity || activity.pending.stories ? <div class="map-detail-loading"><Spinner /></div> : groups.length ? <div class="map-detail-story-grid">{groups.map((g, index) => {
            const latest = g.stories[g.stories.length - 1];
            const cover = latest.mediaType?.startsWith('video') || isVideoUrl(latest.mediaUrl || '') ? '' : latest.mediaUrl;
            return <button key={g.actorId || g.authorId} type="button" class="map-detail-story-card" onClick={() => openStory(index)} aria-label={t('stories.open', { name: g.name })}>{cover ? picture(cover, 320) : <span class="map-detail-story-text">{latest.text || g.name}</span>}<span class="map-detail-story-card-label"><Avatar src={g.avatar} name={g.name} size={28} /><span>{g.name || t('common.user')}<small>{timeAgo(latest.createdAt)}</small></span></span></button>;
          })}</div> : <Empty compact icon="circle-dashed" title={t('map.noStories')} text={t('map.storyHint')} />}
        </section>
        <footer class="map-detail-footer">{pageLink()}</footer>
      </div>
      {lightbox && <Lightbox media={lightbox.media} index={lightbox.index} onClose={closePhoto} />}
      {storyView && <StoryViewer groups={storyView.groups} start={storyView.start} onClose={closeStory} />}
    </aside>
  );
}
