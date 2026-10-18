import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { uid } from '../lib/auth.js';
import { tsToMillis } from '../lib/format.js';
import { normStory } from './normalize.js';

export const RECENT_CHECKIN_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const STORY_DURATIONS = { '24h': DAY_MS, '7d': 7 * DAY_MS, '30d': 30 * DAY_MS };

function publicRecord(data) {
  return !data.deleted && !data.deletedAt && !data.isPrivate && !data.private && !data.closeFriends
    && data.isPublic !== false && data.public !== false
    && !['deleted', 'inactive', 'hidden', 'private', 'draft', 'pending', 'rejected'].includes(data.status)
    && (!data.visibility || data.visibility === 'public')
    && (!data.audience || data.audience === 'public')
    && (!data.privacy || data.privacy === 'public');
}

function imageUrl(value, mediaType = '') {
  if (typeof value !== 'string') return '';
  const src = value.trim();
  if (!/^(https?:\/\/|\/(?!\/))/i.test(src)) return '';
  if (mediaType && mediaType !== 'image' && !mediaType.startsWith('image/')) return '';
  if (/\/video\/upload\/|\.(mp4|webm|mov|m4v|avi|m3u8)([?#]|$)/i.test(src)) return '';
  return src;
}

function storyDeadline(story) {
  if (story.raw.expiresAt != null) return story.expiresAt;
  if (story.raw.duration === 'forever') return Infinity;
  return story.createdAt + (STORY_DURATIONS[story.raw.duration] || DAY_MS);
}

/** Pure projection shared by the live listener and its clock refresh. */
export function buildPlaceActivity(place, checkinRecords = [], storyRecords = [], now = Date.now()) {
  const businessId = typeof place?.raw?.businessId === 'string' ? place.raw.businessId.trim() : '';
  const checkins = checkinRecords.filter((r) => r.placeId === place?.id && publicRecord(r)).map((r) => ({
    ...r,
    authorId: r.authorId || r.userId || '',
    authorName: r.authorName || r.userName || '',
    authorAvatar: r.authorAvatar || r.userAvatar || r.userPhoto || '',
    caption: r.caption || r.text || '',
    photoUrl: imageUrl(r.photoUrl),
    createdAt: tsToMillis(r.createdAt),
    raw: r,
  })).filter((r) => Number.isFinite(r.createdAt) && r.createdAt > 0 && r.createdAt <= now)
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));

  // A recent check-in is not evidence that the person is still at the place.
  const users = new Set();
  const recentCheckins = checkins.filter((r) => {
    if (!r.authorId || now - r.createdAt > RECENT_CHECKIN_MS || users.has(r.authorId)) return false;
    users.add(r.authorId);
    return true;
  });

  const ids = new Set();
  const stories = storyRecords.filter((r) => {
    const linked = r.placeId === place?.id || (businessId && r.businessId === businessId);
    if (!linked || r.closeFriends !== false || !publicRecord(r) || r.groupId || r.eventId || ids.has(r.id)) return false;
    ids.add(r.id);
    return true;
  }).map((r) => normStory(r.id, r))
    .filter((s) => s.authorId && Number.isFinite(s.createdAt) && s.createdAt > 0 && s.createdAt <= now && storyDeadline(s) > now)
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));

  const groups = new Map();
  for (const story of stories) {
    const actorId = story.actorId || `user_${story.authorId}`;
    if (!groups.has(actorId)) groups.set(actorId, {
      authorId: story.authorId, actorId, businessId: story.businessId || '', name: story.authorName, avatar: story.authorAvatar, stories: [], latest: story.createdAt,
    });
    groups.get(actorId).stories.push(story);
  }
  const viewer = uid.value;
  const storyGroups = [...groups.values()].map((group) => ({
    ...group,
    stories: group.stories.sort((a, b) => a.createdAt - b.createdAt),
    seen: !!viewer && group.stories.every((s) => s.viewedBy.includes(viewer)),
  })).sort((a, b) => b.latest - a.latest);
  const photos = [...new Set([
    imageUrl(place?.image),
    ...(Array.isArray(place?.photos) ? place.photos.map((p) => imageUrl(p)) : []),
    ...checkins.map((c) => c.photoUrl),
    ...stories.map((s) => imageUrl(s.mediaUrl, s.mediaType)),
  ].filter(Boolean))];
  return { checkins, recentCheckins, stories, storyGroups, photos };
}

/**
 * Place-scoped live public activity. No author/name inference or broad scans.
 * onData additionally receives loading, pending and errors so a failed query
 * never masquerades as an empty place. onError(error, source) is optional.
 * Ordered queries need the additive place-activity indexes in firestore.indexes.json.
 */
export function listenPlaceActivity(place, onData, onError) {
  let active = true;
  let timer;
  const unsubs = [];
  const businessId = typeof place?.raw?.businessId === 'string' ? place.raw.businessId.trim() : '';
  const parts = { checkins: [], placeStories: [], businessStories: [] };
  const pending = { checkins: !!place?.id, placeStories: !!place?.id, businessStories: !!place?.id && !!businessId };
  const failures = { checkins: null, placeStories: null, businessStories: null };

  const emit = () => {
    if (!active) return;
    const now = Date.now();
    const data = buildPlaceActivity(place, parts.checkins, [...parts.placeStories, ...parts.businessStories], now);
    const storiesPending = pending.placeStories || pending.businessStories;
    onData({
      ...data,
      loading: pending.checkins || storiesPending,
      pending: { checkins: pending.checkins, stories: storiesPending },
      errors: { checkins: failures.checkins, stories: failures.placeStories || failures.businessStories },
    });
    clearTimeout(timer);
    // Refresh on expiry even when Firestore has no new snapshots. The minute
    // cap also accounts for a clock change and server timestamps just ahead.
    const deadlines = [
      ...data.recentCheckins.map((c) => c.createdAt + RECENT_CHECKIN_MS + 1),
      ...data.stories.map(storyDeadline),
    ].filter((time) => Number.isFinite(time) && time > now);
    const delay = Math.min(60000, ...deadlines.map((time) => Math.max(1, time - now)));
    if (active && place?.id) timer = setTimeout(emit, delay);
  };

  const listen = (key, request) => {
    const fail = (error) => {
      if (!active) return;
      failures[key] = error;
      pending[key] = false;
      parts[key] = [];
      emit();
      onError?.(error, key === 'checkins' ? 'checkins' : 'stories');
    };
    try {
      unsubs.push(onSnapshot(request, (snapshot) => {
        if (!active) return;
        failures[key] = null;
        pending[key] = false;
        parts[key] = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
        emit();
      }, fail));
    } catch (error) { fail(error); }
  };

  emit();
  if (place?.id) {
    listen('checkins', query(collection(db, 'checkins'), where('placeId', '==', place.id), orderBy('createdAt', 'desc'), limit(60)));
    const publicStories = (field, id) => query(collection(db, 'stories'), where(field, '==', id), where('closeFriends', '==', false), orderBy('createdAt', 'desc'), limit(40));
    listen('placeStories', publicStories('placeId', place.id));
    if (businessId) listen('businessStories', publicStories('businessId', businessId));
  }
  return () => {
    active = false;
    clearTimeout(timer);
    unsubs.forEach((unsubscribe) => unsubscribe());
  };
}
