// Videos (YouTube-backed or uploaded), reels (isShort) and channels.
// Queries avoid composite indexes: production only has the indexes in
// firestore.indexes.json, and the emulator would not catch a missing one.

import {
  doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy,
  limit, startAfter, onSnapshot, serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { me, uid as myUid } from '../lib/auth.js';
import { normVideo, normChannel } from './normalize.js';
import { tsToMillis } from '../lib/format.js';
import { actingIdentity } from '../lib/actor.js';
import { normalizeVideoSource, videoText, publicMediaUrl } from '../lib/videoSource.js';

const active = (v) => v.status === 'active' && (v.youtubeId || v.videoUrl);

export async function fetchVideos({ cursor = null, n = 24 } = {}) {
  const parts = [collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(n)];
  if (cursor) parts.splice(2, 0, startAfter(cursor));
  const snap = await getDocs(query(...parts));
  return {
    videos: snap.docs.map((d) => normVideo(d.id, d.data())).filter((v) => active(v) && !v.isShort),
    cursor: snap.docs[snap.docs.length - 1] || null,
    done: snap.docs.length < n,
  };
}

export async function fetchReels(n = 40) {
  const snap = await getDocs(query(collection(db, 'videos'), where('isShort', '==', true), limit(n)));
  return snap.docs.map((d) => normVideo(d.id, d.data())).filter(active).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getVideo(id) {
  const s = await getDoc(doc(db, 'videos', id));
  return s.exists() ? normVideo(s.id, s.data()) : null;
}

export function listenVideo(id, onData, onError) {
  return onSnapshot(doc(db, 'videos', id), (s) => onData(s.exists() ? normVideo(s.id, s.data()) : null), onError);
}

export async function channelVideos(channelId, n = 60) {
  const snap = await getDocs(query(collection(db, 'videos'), where('channelId', '==', channelId), limit(n)));
  return snap.docs.map((d) => normVideo(d.id, d.data())).filter(active).sort((a, b) => b.createdAt - a.createdAt);
}

export async function relatedVideos(video, n = 12) {
  const list = video.channelId ? await channelVideos(video.channelId, 30) : [];
  const others = list.filter((v) => v.id !== video.id && !v.isShort);
  if (others.length >= n) return others.slice(0, n);
  const more = (await fetchVideos({ n: 30 })).videos.filter((v) => v.id !== video.id && !others.some((o) => o.id === v.id));
  return [...others, ...more].slice(0, n);
}

export async function listChannels(n = 30) {
  const snap = await getDocs(query(collection(db, 'channels'), limit(n)));
  return snap.docs.map((d) => normChannel(d.id, d.data())).sort((a, b) => b.subscriberCount - a.subscriberCount);
}

export async function getChannel(id) {
  const s = await getDoc(doc(db, 'channels', id));
  return s.exists() ? normChannel(s.id, s.data()) : null;
}

export async function myChannels() {
  const id = myUid.value;
  if (!id) return [];
  const snap = await getDocs(query(collection(db, 'channels'), where('ownerId', '==', id), limit(10)));
  return snap.docs.map((d) => normChannel(d.id, d.data()));
}

export async function createChannel({ name, description = '', avatar = '', banner = '' }) {
  const id = myUid.value;
  if (!id) throw new Error('არხის შესაქმნელად შედი ანგარიშში.');
  const ref = await addDoc(collection(db, 'channels'), {
    name: videoText(name, 80, 'არხის სახელი', true), description: videoText(description, 5000, 'აღწერა'),
    avatar: publicMediaUrl(avatar, 'არხის ფოტო'), banner: publicMediaUrl(banner, 'არხის გარეკანი'),
    ownerId: id, subscriberCount: 0, videoCount: 0, youtubeUrl: '', createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Owner edits: name, description, avatar, banner. */
export async function updateChannel(id, patch) {
  if (!myUid.value) throw new Error('არხის შესაცვლელად შედი ანგარიშში.');
  const allowed = {};
  if (patch.name !== undefined) allowed.name = videoText(patch.name, 80, 'არხის სახელი', true);
  if (patch.description !== undefined) allowed.description = videoText(patch.description, 5000, 'აღწერა');
  for (const k of ['avatar', 'banner']) if (patch[k] !== undefined) allowed[k] = publicMediaUrl(patch[k], 'არხის ფოტო');
  await updateDoc(doc(db, 'channels', id), allowed);
}

/**
 * Publish a video: a YouTube link or an uploaded file URL.
 * Rules: authorId == caller, status 'active'.
 */
export async function createVideo({ title, description = '', youtubeUrl = '', videoUrl = '', thumbnail = '', isShort = false, channel = null, category = '', city = '', placeId = null, placeName = null }) {
  const m = me();
  if (!m?.uid) throw new Error('ვიდეოს გამოსაქვეყნებლად შედი ანგარიშში.');
  const source = normalizeVideoSource({ youtubeUrl, videoUrl, isShort });
  let ownChannel = null;
  if (channel?.id) {
    ownChannel = await getChannel(channel.id);
    if (!ownChannel || ownChannel.ownerId !== m.uid) throw new Error('ვიდეოს დამატება მხოლოდ საკუთარ არხზე შეგიძლია.');
  }
  const data = {
    title: videoText(title, 200, 'სათაური', true),
    description: videoText(description, 5000, 'აღწერა'),
    authorId: m.uid,
    authorName: m.name,
    authorAvatar: m.avatar,
    ...source,
    thumbnail: publicMediaUrl(thumbnail, 'ვიდეოს ფოტო') || (source.youtubeId ? `https://i.ytimg.com/vi/${source.youtubeId}/hqdefault.jpg` : ''),
    channelId: ownChannel?.id || null,
    channelName: ownChannel?.name || null,
    channelAvatar: ownChannel?.avatar || null,
    category, city, tags: [], placeId, placeName, businessId: null, businessName: null,
    status: 'active', likeCount: 0, viewCount: 0, commentCount: 0,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'videos'), data);
  if (ownChannel?.id) updateDoc(doc(db, 'channels', ownChannel.id), { videoCount: increment(1) }).catch(() => {});
  return ref.id;
}

export async function deleteVideo(id) { await deleteDoc(doc(db, 'videos', id)); }

const viewedVideos = new Set();
export function countVideoView(id) {
  if (!myUid.value || viewedVideos.has(id)) return;
  viewedVideos.add(id);
  updateDoc(doc(db, 'videos', id), { viewCount: increment(1) }).catch(() => {});
}

export async function isVideoLiked(id) {
  const u = myUid.value;
  if (!u) return false;
  const s = await getDoc(doc(db, 'videos', id, 'likes', u)).catch(() => null);
  return !!s?.exists();
}

export async function setVideoLiked(id, liked) {
  const u = myUid.value;
  const ref = doc(db, 'videos', id, 'likes', u);
  if (liked) await setDoc(ref, { uid: u, userId: u, createdAt: serverTimestamp() });
  else await deleteDoc(ref);
  updateDoc(doc(db, 'videos', id), { likeCount: increment(liked ? 1 : -1) }).catch(() => {});
}

export function listenVideoComments(id, onData) {
  return onSnapshot(query(collection(db, 'videos', id, 'comments'), orderBy('createdAt', 'desc'), limit(60)),
    (s) => onData(s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToMillis(d.data().createdAt) }))), () => onData([]));
}

export async function addVideoComment(id, text) {
  const m = me();
  if (!m?.uid) throw new Error('კომენტარის დასამატებლად შედი ანგარიშში.');
  const identity = actingIdentity.value;
  await addDoc(collection(db, 'videos', id, 'comments'), {
    text: videoText(text, 5000, 'კომენტარი', true), authorId: m.uid, userId: m.uid,
    authorType: identity.authorType, businessId: identity.businessId,
    authorName: identity.name, authorAvatar: identity.avatar, createdAt: serverTimestamp(),
  });
  updateDoc(doc(db, 'videos', id), { commentCount: increment(1) }).catch(() => {});
}

export async function deleteVideoComment(videoId, commentId) {
  await deleteDoc(doc(db, 'videos', videoId, 'comments', commentId));
  updateDoc(doc(db, 'videos', videoId), { commentCount: increment(-1) }).catch(() => {});
}

export async function reportVideo(videoId, reason) {
  const u = myUid.value;
  await setDoc(doc(db, 'videoReports', `${u}_${videoId}`), { reporterUid: u, videoId, reason, status: 'pending', createdAt: serverTimestamp() });
}

export async function isSubscribed(channelId) {
  const u = myUid.value;
  if (!u) return false;
  const s = await getDoc(doc(db, 'channels', channelId, 'subscribers', u)).catch(() => null);
  return !!s?.exists();
}

export async function setSubscribed(channelId, on) {
  const u = myUid.value;
  const ref = doc(db, 'channels', channelId, 'subscribers', u);
  if (on) await setDoc(ref, { uid: u, createdAt: serverTimestamp() });
  else await deleteDoc(ref);
  updateDoc(doc(db, 'channels', channelId), { subscriberCount: increment(on ? 1 : -1) }).catch(() => {});
}
