import {
  doc, addDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, arrayUnion, increment, getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { me, uid as myUid } from '../lib/auth.js';
import { actingIdentity } from '../lib/actor.js';
import { normStory } from './normalize.js';
import { notifyAuthor } from './notify.js';

const DURATIONS = { '24h': 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 };

/**
 * Live stories grouped by author, own first, then unseen, then seen.
 * Close-friends stories are shown only to people on the author's list.
 */
export function listenStoryTray(onData) {
  // The rules only let close-friends stories reach the people on the list, so
  // the tray is three provable queries: public, shared with me, my own.
  const viewer = myUid.value;
  const currentActorId = actingIdentity.value?.actorId;
  const stories = collection(db, 'stories');
  const qs = [query(stories, where('closeFriends', '==', false), orderBy('createdAt', 'desc'), limit(40))];
  if (viewer) {
    qs.push(query(stories, where('closeFriendsList', 'array-contains', viewer), orderBy('createdAt', 'desc'), limit(40)));
    qs.push(query(stories, where('authorId', '==', viewer), orderBy('createdAt', 'desc'), limit(20)));
  }
  const parts = qs.map(() => null);
  const unsubs = qs.map((q, i) => onSnapshot(q, (snap) => { parts[i] = snap.docs; build(); }, () => { parts[i] = []; build(); }));
  function build() {
    if (parts.some((p) => p === null)) return;
    const seenIds = new Set();
    const docs = parts.flat().filter((d) => (seenIds.has(d.id) ? false : seenIds.add(d.id)));
    const now = Date.now();
    const groups = new Map();
    for (const d of docs) {
      const s = normStory(d.id, d.data());
      if (s.expiresAt && s.expiresAt < now) continue;
      if (!s.expiresAt && s.raw.duration !== 'forever' && s.createdAt && now - s.createdAt > DURATIONS['24h']) continue;
      if (s.closeFriends && s.authorId !== viewer && !s.closeFriendsList.includes(viewer)) continue;
      if (s.raw.groupId || s.raw.eventId) continue;
      if (!groups.has(s.actorId)) groups.set(s.actorId, { actorId: s.actorId, authorId: s.authorId, authorType: s.authorType, businessId: s.businessId, name: s.authorName, avatar: s.authorAvatar, stories: [] });
      groups.get(s.actorId).stories.push(s);
    }
    const list = [...groups.values()].map((g) => {
      g.stories.sort((a, b) => a.createdAt - b.createdAt);
      g.seen = viewer ? g.stories.every((s) => s.viewedBy.includes(viewer)) : false;
      g.latest = g.stories[g.stories.length - 1].createdAt;
      return g;
    });
    list.sort((a, b) => (b.actorId === currentActorId) - (a.actorId === currentActorId) || (a.seen - b.seen) || (b.latest - a.latest));
    onData(list);
  }
  return () => unsubs.forEach((u) => u());
}

export async function createStory({ text = '', mediaUrl = null, mediaType = '', bg = null, textStyle = null, duration = '24h', closeFriends = false, closeFriendsList = [], link = null, locationName = '', placeId = '', identity = actingIdentity.value }) {
  const m = me();
  if (!m) throw Object.assign(new Error('auth'), { code: 'auth' });
  if (!identity || identity.uid !== m.uid || identity.actorId !== actingIdentity.value?.actorId) throw Object.assign(new Error('identity-changed'), { code: 'identity-changed' });
  const isBusiness = identity.authorType === 'business';
  const data = {
    text,
    mediaUrl,
    authorId: m.uid,
    userId: m.uid,
    authorName: identity.name,
    authorAvatar: identity.avatar,
    authorType: identity.authorType,
    businessId: identity.businessId,
    createdAt: serverTimestamp(),
    duration,
  };
  if (duration !== 'forever') data.expiresAt = new Date(Date.now() + (DURATIONS[duration] || DURATIONS['24h']));
  if (mediaType) data.mediaType = mediaType;
  if (bg) data.bg = bg;
  if (textStyle) data.textStyle = textStyle;
  if (link) data.link = link;
  if (locationName) data.locationName = locationName;
  // Only a place explicitly chosen in the map supplies this relation. An
  // author's profile or business ownership never implies a place link.
  if (typeof placeId === 'string' && placeId.trim()) data.placeId = placeId.trim();
  // Always explicit: the public tray query asks for closeFriends == false.
  data.closeFriends = !isBusiness && !!closeFriends;
  if (data.closeFriends) data.closeFriendsList = closeFriendsList;
  const ref = await addDoc(collection(db, 'stories'), data);
  // Archive so highlights can reference the story after it expires.
  const archive = isBusiness ? doc(db, 'businesses', identity.businessId, 'storyArchive', ref.id) : doc(db, 'users', m.uid, 'storyArchive', ref.id);
  setDoc(archive, { ...data, storyId: ref.id, archivedAt: serverTimestamp() }).catch(() => {});
  return ref.id;
}

/** Record a view (rules: onlyStoryViewFields — viewedBy, viewCount, updatedAt). */
const viewedStories = new Set();
export function markStoryViewed(story) {
  const id = myUid.value;
  if (!id || story.authorId === id || story.actorId === actingIdentity.value?.actorId || story.viewedBy.includes(id) || viewedStories.has(`${id}:${story.id}`)) return;
  viewedStories.add(`${id}:${story.id}`);
  updateDoc(doc(db, 'stories', story.id), { viewedBy: arrayUnion(id), viewCount: increment(1), updatedAt: serverTimestamp() }).catch(() => {});
}

export async function reactToStory(story, emoji) {
  const m = me();
  if (!m) return;
  await setDoc(doc(db, 'stories', story.id, 'reactions', m.uid), { userId: m.uid, reaction: emoji, createdAt: serverTimestamp() });
  notifyAuthor(story, { type: 'story_reaction', title: `${m.name} ${emoji} შენს სთორიზე`, href: `feed.html?story=${story.id}`, extra: { storyId: story.id, reaction: emoji }, dedupKey: `story_reaction_${m.uid}_${story.id}` });
}

export async function replyToStory(story, text) {
  const m = me();
  if (!m || !text.trim()) return;
  const identity = actingIdentity.value;
  await addDoc(collection(db, 'stories', story.id, 'replies'), {
    storyId: story.id, ownerId: story.authorId, fromUserId: m.uid, authorId: m.uid,
    authorType: identity.authorType, businessId: identity.businessId,
    authorName: identity.name, authorAvatar: identity.avatar, text: text.trim(), createdAt: serverTimestamp(),
  });
  notifyAuthor(story, { type: 'story_reply', title: `${identity.name} გიპასუხა სთორიზე`, body: text.trim().slice(0, 80), href: `feed.html?story=${story.id}`, extra: { storyId: story.id }, sender: identity });
}

export async function deleteStory(id) {
  await deleteDoc(doc(db, 'stories', id));
}

export async function storyViewers(story) {
  return story.viewedBy.slice(0, 100);
}

export async function storyReplies(storyId) {
  const s = await getDocs(query(collection(db, 'stories', storyId, 'replies'), orderBy('createdAt', 'desc'), limit(50))).catch(() => ({ docs: [] }));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
