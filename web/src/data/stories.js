import {
  doc, addDoc, setDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, onSnapshot,
  serverTimestamp, arrayUnion, increment, getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { me, uid as myUid } from '../lib/auth.js';
import { normStory } from './normalize.js';
import { notify } from './notify.js';

const DURATIONS = { '24h': 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 };

/**
 * Live stories grouped by author, own first, then unseen, then seen.
 * Close-friends stories are shown only to people on the author's list.
 */
export function listenStoryTray(onData) {
  return onSnapshot(query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(40)), (snap) => {
    const now = Date.now();
    const viewer = myUid.value;
    const groups = new Map();
    for (const d of snap.docs) {
      const s = normStory(d.id, d.data());
      if (s.expiresAt && s.expiresAt < now) continue;
      if (!s.expiresAt && s.raw.duration !== 'forever' && s.createdAt && now - s.createdAt > DURATIONS['24h']) continue;
      if (s.closeFriends && s.authorId !== viewer && !s.closeFriendsList.includes(viewer)) continue;
      if (s.raw.groupId || s.raw.eventId) continue;
      if (!groups.has(s.authorId)) groups.set(s.authorId, { authorId: s.authorId, name: s.authorName, avatar: s.authorAvatar, stories: [] });
      groups.get(s.authorId).stories.push(s);
    }
    const list = [...groups.values()].map((g) => {
      g.stories.sort((a, b) => a.createdAt - b.createdAt);
      g.seen = viewer ? g.stories.every((s) => s.viewedBy.includes(viewer)) : false;
      g.latest = g.stories[g.stories.length - 1].createdAt;
      return g;
    });
    list.sort((a, b) => (b.authorId === viewer) - (a.authorId === viewer) || (a.seen - b.seen) || (b.latest - a.latest));
    onData(list);
  }, () => onData([]));
}

export async function createStory({ text = '', mediaUrl = null, mediaType = '', bg = null, textStyle = null, duration = '24h', closeFriends = false, closeFriendsList = [], link = null, locationName = '' }) {
  const m = me();
  if (!m) throw Object.assign(new Error('auth'), { code: 'auth' });
  const data = {
    text,
    mediaUrl,
    authorId: m.uid,
    userId: m.uid,
    authorName: m.name,
    authorAvatar: m.avatar,
    createdAt: serverTimestamp(),
    duration,
  };
  if (duration !== 'forever') data.expiresAt = new Date(Date.now() + (DURATIONS[duration] || DURATIONS['24h']));
  if (mediaType) data.mediaType = mediaType;
  if (bg) data.bg = bg;
  if (textStyle) data.textStyle = textStyle;
  if (link) data.link = link;
  if (locationName) data.locationName = locationName;
  if (closeFriends) { data.closeFriends = true; data.closeFriendsList = closeFriendsList; }
  const ref = await addDoc(collection(db, 'stories'), data);
  // Archive so highlights can reference the story after it expires.
  setDoc(doc(db, 'users', m.uid, 'storyArchive', ref.id), { ...data, storyId: ref.id, archivedAt: serverTimestamp() }).catch(() => {});
  return ref.id;
}

/** Record a view (rules: onlyStoryViewFields — viewedBy, viewCount, updatedAt). */
const viewedStories = new Set();
export function markStoryViewed(story) {
  const id = myUid.value;
  if (!id || story.authorId === id || story.viewedBy.includes(id) || viewedStories.has(story.id)) return;
  viewedStories.add(story.id);
  updateDoc(doc(db, 'stories', story.id), { viewedBy: arrayUnion(id), viewCount: increment(1), updatedAt: serverTimestamp() }).catch(() => {});
}

export async function reactToStory(story, emoji) {
  const m = me();
  if (!m) return;
  await setDoc(doc(db, 'stories', story.id, 'reactions', m.uid), { userId: m.uid, reaction: emoji, createdAt: serverTimestamp() });
  notify(story.authorId, { type: 'story_reaction', title: `${m.name} ${emoji} შენს სთორიზე`, href: `feed.html?story=${story.id}`, extra: { storyId: story.id, reaction: emoji }, dedupKey: `story_reaction_${m.uid}_${story.id}` });
}

export async function replyToStory(story, text) {
  const m = me();
  if (!m || !text.trim()) return;
  await addDoc(collection(db, 'stories', story.id, 'replies'), {
    storyId: story.id, ownerId: story.authorId, fromUserId: m.uid, authorId: m.uid,
    authorName: m.name, authorAvatar: m.avatar, text: text.trim(), createdAt: serverTimestamp(),
  });
  notify(story.authorId, { type: 'story_reply', title: `${m.name} გიპასუხა სთორიზე`, body: text.trim().slice(0, 80), href: `feed.html?story=${story.id}`, extra: { storyId: story.id } });
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
