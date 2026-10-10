// Posts, reactions, comments, replies, polls, saves and shares.
// Write payloads copy the old GeoSocial field names exactly: the rules
// (posts: newOwnerMatches, onlyCountersChanged, onlyPollChanged,
// onlyPostManagementFields; comments: onlyCommentCountersChanged …)
// were written against them.

import {
  doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, collection, query, where,
  orderBy, limit, limitToLast, startAfter, onSnapshot, serverTimestamp, increment, runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { actor } from '../lib/actor.js';
import { me, uid as myUid } from '../lib/auth.js';
import { normPost, normComment, isCorruptSeed } from './normalize.js';
import { notify } from './notify.js';
import { primeUser } from './users.js';

function requireMe() {
  const m = me();
  if (!m) throw Object.assign(new Error('auth'), { code: 'auth' });
  return m;
}

export const REACTIONS = [
  { type: 'like', emoji: '👍' },
  { type: 'love', emoji: '❤️' },
  { type: 'haha', emoji: '😂' },
  { type: 'wow', emoji: '😮' },
  { type: 'sad', emoji: '😢' },
  { type: 'angry', emoji: '😡' },
];
export const REACTION_EMOJI = { like: '👍', love: '❤️', haha: '😂', wow: '😮', sad: '😢', angry: '😡', clap: '👏' };

/* ── Reading ───────────────────────────────────────────────── */

/**
 * Who may see a post. Mirrors the audiences the old composer offered:
 * public · friends · followers · close_friends · onlyme.
 */
export function canSee(p, ctx) {
  if (!p || (p.status && p.status !== 'active')) return false;
  const viewer = ctx.uid;
  if (p.authorId && viewer && p.authorId === viewer) return true;
  if (ctx.blocked?.has(p.authorId) || ctx.muted?.has(p.authorId) || ctx.hidden?.has(p.id)) return false;
  const v = p.visibility;
  if (!v || v === 'public') return true;
  if (!viewer) return false;
  if (v === 'onlyme' || v === 'only_me' || v === 'private') return false;
  if (v === 'friends') return !!ctx.friends?.has(p.authorId);
  if (v === 'followers') return !!(ctx.following?.has(p.authorId) || ctx.friends?.has(p.authorId));
  if (v === 'close_friends') return Array.isArray(p.raw.closeFriendIds) ? p.raw.closeFriendIds.includes(viewer) : !!ctx.friends?.has(p.authorId);
  return true;
}

/*
 * The security rules decide who can read a post (public, friends, followers,
 * close friends, only me, group members). Rules are not filters, so every
 * query below carries the constraint that proves the viewer may read all of
 * its results; a query the rules cannot prove is rejected as a whole.
 */
const PUBLIC = where('visibility', '==', 'public');

function keepForFeed(d, ctx) {
  const data = d.data();
  if (isCorruptSeed(data)) return null;
  const p = normPost(d.id, data);
  if (p.targetType === 'group' || p.groupId) return null;
  return canSee(p, ctx) ? p : null;
}

/**
 * Posts the viewer may see beyond the public stream, created inside the
 * window [lower, upper): their own posts, posts shared with them through an
 * audience list (friends / close friends). Each query is provable by the rules.
 */
async function circlePosts(viewer, lower, upper, ctx) {
  const range = [];
  if (upper) range.push(where('createdAt', '<', upper));
  if (lower) range.push(where('createdAt', '>=', lower));
  const n = lower ? 40 : 60;
  const run = (constraint) => getDocs(query(collection(db, 'posts'), constraint, ...range, orderBy('createdAt', 'desc'), limit(n)))
    .then((s) => s.docs, () => []);
  const lists = await Promise.all([
    run(where('authorId', '==', viewer)),
    run(where('audienceIds', 'array-contains', viewer)),
    run(where('closeFriendIds', 'array-contains', viewer)),
  ]);
  const out = [];
  for (const docs of lists) for (const d of docs) { const p = keepForFeed(d, ctx); if (p) out.push(p); }
  return out;
}

/**
 * Home feed page: the public stream, merged with the viewer's own and
 * shared-with-them posts from the same time window. Skips garbled demo posts
 * and group posts (those live in groups). Returns { posts, cursor, done }.
 */
export async function fetchFeedPage({ cursor = null, want = 12, ctx }) {
  const st = cursor || { last: null, upper: null, done: false };
  const byId = new Map();
  let last = st.last;
  let pubDone = st.done;
  for (let round = 0; round < 6 && byId.size < want && !pubDone; round++) {
    const parts = [collection(db, 'posts'), PUBLIC, orderBy('createdAt', 'desc')];
    if (last) parts.push(startAfter(last));
    parts.push(limit(24));
    const snap = await getDocs(query(...parts));
    if (snap.empty) { pubDone = true; break; }
    last = snap.docs[snap.docs.length - 1];
    for (const d of snap.docs) { const p = keepForFeed(d, ctx); if (p) byId.set(p.id, p); }
    if (snap.docs.length < 24) pubDone = true;
  }
  // The public page ends at `last`; everything else is fetched for the same window.
  const lower = pubDone ? null : (last?.get('createdAt') || null);
  if (ctx.uid) {
    for (const p of await circlePosts(ctx.uid, lower, st.upper, ctx)) if (!byId.has(p.id)) byId.set(p.id, p);
  }
  const posts = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  return { posts, cursor: { last, upper: lower, done: pubDone }, done: pubDone };
}

/** Fires when a newer public post appears (for the "new posts" pill). */
export function listenNewest(onData) {
  return onSnapshot(query(collection(db, 'posts'), PUBLIC, orderBy('createdAt', 'desc'), limit(1)),
    (s) => { const d = s.docs[0]; onData(d ? normPost(d.id, d.data()) : null); }, () => {});
}

export async function getPost(id) {
  const s = await getDoc(doc(db, 'posts', id));
  return s.exists() ? normPost(s.id, s.data()) : null;
}

export function listenPost(id, onData, onError) {
  return onSnapshot(doc(db, 'posts', id), (s) => onData(s.exists() ? normPost(s.id, s.data()) : null), onError);
}

/**
 * Merge several live queries into one list. A query the rules reject just
 * contributes nothing, so a stricter audience never breaks the page.
 */
function listenMerged(queries, onData, finish) {
  const byKey = new Map();
  const ready = new Array(queries.length).fill(false);
  const emit = () => { if (ready.every(Boolean)) onData(finish([...byKey.values()])); };
  const unsubs = queries.map((q, i) => onSnapshot(q, (snap) => {
    snap.docChanges().forEach((ch) => {
      const key = `${i}:${ch.doc.id}`;
      if (ch.type === 'removed') byKey.delete(key);
      else byKey.set(key, normPost(ch.doc.id, ch.doc.data()));
    });
    ready[i] = true; emit();
  }, () => { ready[i] = true; emit(); }));
  return () => unsubs.forEach((u) => u());
}

function uniqueById(list) {
  const m = new Map();
  for (const p of list) m.set(p.id, p);
  return [...m.values()];
}

/**
 * Posts on a profile: authored by the user (authorId or legacy userId).
 * The owner sees everything; others get exactly what the rules allow them.
 * rel: { friend, following } — the viewer's relation to the profile owner.
 */
export function listenUserPosts(userId, onData, n = 40, rel = {}) {
  const posts = collection(db, 'posts');
  const viewer = myUid.value;
  const qs = [];
  if (viewer && viewer === userId) {
    qs.push(query(posts, where('authorId', '==', userId), limit(n)));
    qs.push(query(posts, where('userId', '==', userId), limit(n)));
  } else {
    qs.push(query(posts, where('authorId', '==', userId), PUBLIC, limit(n)));
    qs.push(query(posts, where('userId', '==', userId), PUBLIC, limit(n)));
    if (viewer) {
      qs.push(query(posts, where('authorId', '==', userId), where('audienceIds', 'array-contains', viewer), limit(n)));
      qs.push(query(posts, where('authorId', '==', userId), where('closeFriendIds', 'array-contains', viewer), limit(n)));
      if (rel.friend) qs.push(query(posts, where('authorId', '==', userId), where('visibility', 'in', ['friends', 'followers']), limit(n)));
      else if (rel.following) qs.push(query(posts, where('authorId', '==', userId), where('visibility', '==', 'followers'), limit(n)));
    }
  }
  return listenMerged(qs, onData, (list) => uniqueById(list)
    .filter((p) => p.status === 'active' && !(p.targetType === 'group' || p.groupId) && !isCorruptSeed(p.raw))
    .sort((a, b) => b.createdAt - a.createdAt));
}

/**
 * Posts published on a business page or a group wall. Private-group posts
 * are stored with visibility 'group' and only members may load them.
 */
export function listenTargetPosts(targetType, targetId, onData, n = 40, { member = false } = {}) {
  const field = targetType === 'business' ? 'businessId' : 'groupId';
  const posts = collection(db, 'posts');
  const qs = [query(posts, where(field, '==', targetId), PUBLIC, limit(n))];
  if (targetType === 'group' && member) qs.push(query(posts, where(field, '==', targetId), where('visibility', '==', 'group'), limit(n)));
  const viewer = myUid.value;
  if (viewer) qs.push(query(posts, where(field, '==', targetId), where('authorId', '==', viewer), limit(n)));
  return listenMerged(qs, onData, (list) => uniqueById(list)
    .filter((p) => p.status === 'active' || p.status === 'pending')
    .sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt)));
}

/* ── Writing posts ─────────────────────────────────────────── */

/**
 * Create a post. Options mirror the old composer; unknown extras are ignored.
 * asBusiness: { id, name, logo } posts as the page (rules check canManageBiz).
 */
export async function createPost({
  text = '', media = [], mediaType = '', visibility = 'public', feeling = '', location = null,
  bgGradient = null, poll = null, taggedUsers = [], groupId = null, groupPrivacy, asBusiness = null,
  onBusinessId = null, sharedPostId = null, status = 'active', type = null, closeFriendIds, friendIds,
}) {
  const m = requireMe();
  const clean = String(text || '').trim();
  const mediaUrls = media.filter(Boolean);
  if (!clean && !mediaUrls.length && !poll && !sharedPostId) throw Object.assign(new Error('empty'), { code: 'empty' });
  const isBiz = !!asBusiness;
  const businessId = isBiz ? asBusiness.id : onBusinessId;
  const data = {
    text: poll ? (clean || poll.question) : clean,
    mediaUrl: mediaUrls[0] || null,
    mediaType: mediaType || null,
    mediaUrls,
    taggedUserIds: taggedUsers.map((u) => u.id),
    taggedUsers: taggedUsers.map((u) => ({ uid: u.id, name: u.name })),
    feeling,
    authorId: m.uid,
    userId: m.uid,
    createdByUid: m.uid,
    authorName: isBiz ? asBusiness.name : m.name,
    authorAvatar: isBiz ? (asBusiness.logo || '') : m.avatar,
    authorType: isBiz ? 'business' : 'user',
    authorVerified: !!m.verified,
    businessId: businessId || null,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    visibility,
    status,
    sharedPostId: sharedPostId || null,
    targetType: groupId ? 'group' : businessId ? 'business' : 'user',
    targetId: groupId || businessId || m.uid,
    groupId: groupId || null,
    bgGradient: bgGradient || null,
    location: location || null,
    type: poll ? 'poll' : type,
    poll: poll ? { question: poll.question, options: poll.options.map((o, i) => ({ id: String(i), text: o, votes: 0 })), endsAt: poll.endsAt || null, totalVotes: 0 } : null,
    createdAt: serverTimestamp(),
  };
  if (groupId) {
    data.groupPrivacy = groupPrivacy || 'public';
    // Posts in private/secret groups are for members only (rules: 'group').
    data.visibility = data.groupPrivacy === 'public' ? 'public' : 'group';
  }
  Object.assign(data, audienceFields(data.visibility, m.uid, { closeFriendIds, friendIds }));
  const ref = await addDoc(collection(db, 'posts'), data);
  if (sharedPostId) updateDoc(doc(db, 'posts', sharedPostId), { shareCount: increment(1) }).catch(() => {});
  for (const u of taggedUsers) {
    notify(u.id, { type: 'tag', title: `${m.name} მოგნიშნა პოსტში`, body: clean.slice(0, 120), href: `feed.html?post=${ref.id}`, extra: { postId: ref.id } });
  }
  return normPost(ref.id, { ...data, createdAt: Date.now() });
}

/**
 * Audience lists stored on a post. Friends-only posts carry the author's
 * friend list at posting time, so friends can find them in their feed with a
 * query the rules can prove; other audiences clear the lists.
 */
export function audienceFields(visibility, authorId, { closeFriendIds, friendIds } = {}) {
  const ids = (list) => [...new Set([authorId, ...(list || [])])].slice(0, 2000);
  if (visibility === 'close_friends') return { closeFriendIds: ids(closeFriendIds), audienceIds: [] };
  if (visibility === 'friends' || visibility === 'followers') return { audienceIds: ids(friendIds), closeFriendIds: [] };
  return { audienceIds: [], closeFriendIds: [] };
}

export async function editPost(id, patch, { authorId, friendIds, closeFriendIds } = {}) {
  const allowed = {};
  for (const k of ['text', 'visibility', 'commentsDisabled', 'pinned', 'status']) if (k in patch) allowed[k] = patch[k];
  if ('visibility' in patch && authorId) Object.assign(allowed, audienceFields(patch.visibility, authorId, { friendIds, closeFriendIds }));
  allowed.updatedAt = serverTimestamp();
  await updateDoc(doc(db, 'posts', id), allowed);
}

export async function deletePost(id) {
  await deleteDoc(doc(db, 'posts', id));
}

export async function trackShare(id) {
  await updateDoc(doc(db, 'posts', id), { shareCount: increment(1) }).catch(() => {});
}

/** Count a view once per session (rules clamp counters to ±1). */
const viewed = new Set();
export function trackView(id) {
  if (!myUid.value || viewed.has(id)) return;
  viewed.add(id);
  updateDoc(doc(db, 'posts', id), { viewCount: increment(1) }).catch(() => {});
}

/* ── Reactions ─────────────────────────────────────────────── */

const myReactionCache = new Map();

/** The viewer's reaction type on a post ('' when none). */
export async function getMyReaction(postId) {
  const id = myUid.value;
  if (!id) return '';
  const key = `${id}:${postId}`;
  if (myReactionCache.has(key)) return myReactionCache.get(key);
  const p = Promise.all([
    getDoc(doc(db, 'posts', postId, 'reactions', id)).catch(() => null),
    getDoc(doc(db, 'posts', postId, 'likes', id)).catch(() => null),
  ]).then(([r, l]) => (r?.exists() ? (r.data().type || 'like') : l?.exists() ? 'like' : ''));
  myReactionCache.set(key, p);
  return p;
}

/**
 * Set, change or clear (type = '') the viewer's reaction.
 * Returns the count delta (+1, 0, -1) for optimistic UI.
 */
export async function setReaction(post, type, previous) {
  const m = requireMe();
  const postRef = doc(db, 'posts', post.id);
  const rxRef = doc(db, 'posts', post.id, 'reactions', m.uid);
  const key = `${m.uid}:${post.id}`;
  if (!type) {
    await deleteDoc(rxRef).catch(() => {});
    await deleteDoc(doc(db, 'posts', post.id, 'likes', m.uid)).catch(() => {});
    if (previous) await updateDoc(postRef, { likeCount: increment(-1), reactionCount: increment(-1) }).catch(() => {});
    myReactionCache.set(key, Promise.resolve(''));
    return;
  }
  await setDoc(rxRef, { userId: m.uid, type, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  if (!previous) await updateDoc(postRef, { likeCount: increment(1), reactionCount: increment(1) }).catch(() => {});
  myReactionCache.set(key, Promise.resolve(type));
  if (!previous && post.authorId && post.authorType !== 'business') {
    notify(post.authorId, {
      type: 'like', title: `${m.name} ${REACTION_EMOJI[type] || '👍'} შენს პოსტზე`, body: (post.text || '').slice(0, 80),
      href: `feed.html?post=${post.id}`, extra: { postId: post.id, reaction: type }, dedupKey: `like_${m.uid}_${post.id}`,
    });
  }
}

/** Who reacted, with type — for the reactions dialog. */
export async function listReactions(postId, n = 60) {
  const [rx, likes] = await Promise.all([
    getDocs(query(collection(db, 'posts', postId, 'reactions'), limit(n))).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, 'posts', postId, 'likes'), limit(n))).catch(() => ({ docs: [] })),
  ]);
  const map = new Map();
  likes.docs.forEach((d) => map.set(d.id, 'like'));
  rx.docs.forEach((d) => map.set(d.id, d.data().type || 'like'));
  return [...map.entries()].map(([userId, type]) => ({ userId, type }));
}

/* ── Polls ─────────────────────────────────────────────────── */

export async function getMyVote(postId) {
  const id = myUid.value;
  if (!id) return '';
  const s = await getDoc(doc(db, 'posts', postId, 'pollVotes', id)).catch(() => null);
  return s?.exists() ? s.data().optionId || '' : '';
}

export async function votePoll(postId, optionId) {
  const m = requireMe();
  const postRef = doc(db, 'posts', postId);
  const voteRef = doc(db, 'posts', postId, 'pollVotes', m.uid);
  return runTransaction(db, async (tx) => {
    const [ps, vs] = [await tx.get(postRef), await tx.get(voteRef)];
    if (!ps.exists()) throw new Error('not-found');
    const prev = vs.exists() ? vs.data().optionId || '' : '';
    if (prev === optionId) return ps.data().poll;
    const poll = ps.data().poll || {};
    const options = (poll.options || []).map((o) => {
      let v = Math.max(0, Number(o.votes || 0));
      if (o.id === prev) v = Math.max(0, v - 1);
      if (o.id === optionId) v += 1;
      return { ...o, votes: v };
    });
    const totalVotes = prev ? Math.max(0, Number(poll.totalVotes || 0)) : Math.max(0, Number(poll.totalVotes || 0)) + 1;
    if (vs.exists()) tx.update(voteRef, { optionId, updatedAt: serverTimestamp() });
    else tx.set(voteRef, { optionId, uid: m.uid, userId: m.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.update(postRef, { 'poll.options': options, 'poll.totalVotes': totalVotes });
    return { ...poll, options, totalVotes };
  });
}

/* ── Comments ──────────────────────────────────────────────── */

/** The newest `n` comments, oldest first. */
export function listenComments(postId, onData, n = 50) {
  return onSnapshot(query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'), limitToLast(n)),
    (s) => onData(s.docs.map((d) => normComment(d.id, d.data())).filter((c) => !c.raw.parentId)),
    () => onData([]));
}

export async function addComment(post, text, { voiceUrl = '' } = {}) {
  const m = requireMe();
  const clean = String(text || '').trim();
  if (!clean && !voiceUrl) return null;
  if (post.authorId && post.authorId !== m.uid) {
    const blocked = await getDoc(doc(db, 'blockedUsers', `${post.authorId}_${m.uid}`)).catch(() => null);
    if (blocked?.exists()) throw Object.assign(new Error('blocked'), { code: 'blocked' });
  }
  const data = {
    text: clean || '🎤',
    voiceUrl,
    authorId: m.uid,
    userId: m.uid,
    createdByUid: m.uid,
    authorType: actor.value ? 'business' : 'user',
    authorName: actor.value ? actor.value.name : m.name,
    authorAvatar: actor.value ? actor.value.logo : m.avatar,
    businessId: actor.value ? actor.value.id : null,
    likes: 0,
    reactionCount: 0,
    replyCount: 0,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'posts', post.id, 'comments'), data);
  updateDoc(doc(db, 'posts', post.id), { commentCount: increment(1), updatedAt: serverTimestamp() }).catch(() => {});
  if (post.authorId && post.authorType !== 'business') {
    notify(post.authorId, {
      type: 'comment', title: `${m.name} დააკომენტარა შენს პოსტზე`, body: clean.slice(0, 120),
      href: `feed.html?post=${post.id}&comment=${ref.id}`, extra: { postId: post.id, commentId: ref.id },
    });
  }
  return ref.id;
}

export async function editComment(postId, commentId, text) {
  await updateDoc(doc(db, 'posts', postId, 'comments', commentId), { text: String(text).trim(), updatedAt: serverTimestamp() });
}

/** Own comment → soft delete (keeps replies); post owner → hard delete. */
export async function removeComment(postId, comment) {
  const id = myUid.value;
  if (comment.userId === id || comment.authorId === id) {
    await updateDoc(doc(db, 'posts', postId, 'comments', comment.id), { status: 'deleted', updatedAt: serverTimestamp() });
  } else {
    await deleteDoc(doc(db, 'posts', postId, 'comments', comment.id));
  }
  updateDoc(doc(db, 'posts', postId), { commentCount: increment(-1), updatedAt: serverTimestamp() }).catch(() => {});
}

export async function getMyCommentReaction(postId, commentId) {
  const id = myUid.value;
  if (!id) return '';
  const s = await getDoc(doc(db, 'posts', postId, 'comments', commentId, 'reactions', id)).catch(() => null);
  return s?.exists() ? s.data().type || 'like' : '';
}

export async function setCommentReaction(postId, comment, type, previous) {
  const m = requireMe();
  const ref = doc(db, 'posts', postId, 'comments', comment.id, 'reactions', m.uid);
  const cRef = doc(db, 'posts', postId, 'comments', comment.id);
  if (!type) {
    await deleteDoc(ref);
    if (previous) updateDoc(cRef, { reactionCount: increment(-1), updatedAt: serverTimestamp() }).catch(() => {});
    return;
  }
  await setDoc(ref, { userId: m.uid, type, createdAt: serverTimestamp() }, { merge: true });
  if (!previous) {
    updateDoc(cRef, { reactionCount: increment(1), updatedAt: serverTimestamp() }).catch(() => {});
    if (comment.userId && comment.userId !== m.uid) {
      notify(comment.userId, { type: 'comment_like', title: `${m.name} ${REACTION_EMOJI[type]} შენს კომენტარზე`, body: comment.text.slice(0, 80), href: `feed.html?post=${postId}&comment=${comment.id}`, extra: { postId, commentId: comment.id }, dedupKey: `clike_${m.uid}_${comment.id}` });
    }
  }
}

export function listenReplies(postId, commentId, onData) {
  return onSnapshot(query(collection(db, 'posts', postId, 'comments', commentId, 'replies'), orderBy('createdAt', 'asc'), limit(50)),
    (s) => onData(s.docs.map((d) => normComment(d.id, d.data()))),
    () => onData([]));
}

export async function addReply(postId, comment, text) {
  const m = requireMe();
  const clean = String(text || '').trim();
  if (!clean) return;
  await addDoc(collection(db, 'posts', postId, 'comments', comment.id, 'replies'), {
    postId,
    commentId: comment.id,
    text: clean,
    authorId: m.uid,
    userId: m.uid,
    createdByUid: m.uid,
    authorType: actor.value ? 'business' : 'user',
    authorName: actor.value ? actor.value.name : m.name,
    authorAvatar: actor.value ? actor.value.logo : m.avatar,
    businessId: actor.value ? actor.value.id : null,
    likeCount: 0,
    status: 'active',
    createdAt: serverTimestamp(),
  });
  updateDoc(doc(db, 'posts', postId, 'comments', comment.id), { replyCount: increment(1) }).catch(() => {});
  if (comment.userId && comment.userId !== m.uid) {
    notify(comment.userId, { type: 'reply', title: `${m.name} გიპასუხა კომენტარზე`, body: clean.slice(0, 120), href: `feed.html?post=${postId}&comment=${comment.id}`, extra: { postId, commentId: comment.id } });
  }
}

export async function deleteReply(postId, commentId, replyId) {
  await deleteDoc(doc(db, 'posts', postId, 'comments', commentId, 'replies', replyId));
  updateDoc(doc(db, 'posts', postId, 'comments', commentId), { replyCount: increment(-1) }).catch(() => {});
}

/* ── Saved ─────────────────────────────────────────────────── */

export async function isSaved(type, itemId) {
  const id = myUid.value;
  if (!id) return false;
  const checks = [getDoc(doc(db, 'savedItems', `${id}_${type}_${itemId}`)).catch(() => null)];
  if (type === 'post') checks.push(getDoc(doc(db, 'savedPosts', `${id}_${itemId}`)).catch(() => null));
  const res = await Promise.all(checks);
  return res.some((s) => s?.exists());
}

export async function setSaved(type, itemId, saved, extra = {}) {
  const id = myUid.value;
  if (!id) throw Object.assign(new Error('auth'), { code: 'auth' });
  const ref = doc(db, 'savedItems', `${id}_${type}_${itemId}`);
  if (saved) {
    await setDoc(ref, { uid: id, userId: id, type, itemId, ...(type === 'post' ? { postId: itemId } : {}), ...extra, createdAt: serverTimestamp() });
  } else {
    await deleteDoc(ref).catch(() => {});
    if (type === 'post') await deleteDoc(doc(db, 'savedPosts', `${id}_${itemId}`)).catch(() => {});
  }
}

/** Saved items of every type, newest first: [{ type, itemId, createdAt }] */
export function listenSaved(onData) {
  const id = myUid.value;
  if (!id) { onData([]); return () => {}; }
  const state = { a: [], b: [], ra: false, rb: false };
  const emit = () => {
    if (!state.ra || !state.rb) return;
    const seen = new Set();
    const all = [...state.a, ...state.b].filter((x) => { const k = `${x.type}:${x.itemId}`; if (seen.has(k)) return false; seen.add(k); return true; });
    onData(all.sort((x, y) => y.createdAt - x.createdAt));
  };
  const u1 = onSnapshot(query(collection(db, 'savedItems'), where('userId', '==', id), limit(200)), (s) => {
    state.a = s.docs.map((d) => { const x = d.data(); return { type: x.type || 'post', itemId: x.itemId || x.postId, createdAt: x.createdAt?.toMillis?.() || 0, title: x.title || '', image: x.image || '' }; }).filter((x) => x.itemId);
    state.ra = true; emit();
  }, () => { state.ra = true; emit(); });
  const u2 = onSnapshot(query(collection(db, 'savedPosts'), where('userId', '==', id), limit(200)), (s) => {
    state.b = s.docs.map((d) => { const x = d.data(); return { type: 'post', itemId: x.postId, createdAt: x.createdAt?.toMillis?.() || 0 }; }).filter((x) => x.itemId);
    state.rb = true; emit();
  }, () => { state.rb = true; emit(); });
  return () => { u1(); u2(); };
}

export { primeUser };
