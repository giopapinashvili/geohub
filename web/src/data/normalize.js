// Read-side normalisers. Firestore documents written by several generations
// of the old site use different field names for the same thing
// (name/title, coverImage/coverUrl/imageUrl, memberCount/membersCount…).
// Each function maps any of those shapes to one canonical object and keeps
// the original under `raw`. Writers never use these — they write the exact
// legacy field names so older readers and the security rules stay happy.

import { tsToMillis } from '../lib/format.js';

const s = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = (v) => (Array.isArray(v) ? v : []);
const first = (...vals) => { for (const v of vals) if (v) return v; return ''; };

/* The seed script once wrote Georgian text through a broken encoder, so some
   demo documents contain U+FFFD in place of letters. They are demo content,
   not user data; hiding them keeps the interface free of garbled text. */
const TEXT_FIELDS = ['name', 'title', 'text', 'description', 'fullName', 'displayName', 'city', 'address', 'bio', 'authorName', 'caption'];
export function isCorruptSeed(d) {
  if (!d) return false;
  const seed = Object.keys(d).some((k) => k.startsWith('isSeed') && d[k] === true);
  if (!seed) return false;
  return TEXT_FIELDS.some((f) => typeof d[f] === 'string' && d[f].includes('�'));
}

export function normUser(id, d = {}) {
  const name = first(d.fullName, d.displayName, d.name, d.username, d.email && d.email.split('@')[0]) || 'GeoHub';
  const premiumUntil = tsToMillis(d.premiumUntil);
  return {
    id,
    uid: id,
    name: s(name),
    username: s(d.username),
    avatar: s(first(d.avatar, d.photoURL, d.avatarUrl, d.photoUrl)),
    cover: s(first(d.coverImage, d.coverUrl, d.cover)),
    bio: s(d.bio),
    city: s(d.city === 'all_georgia' ? '' : d.city),
    website: s(d.website),
    socialLinks: d.socialLinks || {},
    verified: !!(d.verified || d.isVerified),
    geoId: d.geoId || null,
    online: !!d.online,
    lastSeen: tsToMillis(d.lastSeen),
    followers: n(d.followers ?? d.followerCount),
    following: n(d.following ?? d.followingCount),
    friendsCount: n(d.friendsCount),
    visitedPlaces: n(d.visitedPlaces),
    points: n(d.pointsBalance ?? d.geoPointsBalance),
    xp: n(d.xp),
    level: n(d.level),
    premium: !!(d.isPremium && (!premiumUntil || premiumUntil > Date.now())) || premiumUntil > Date.now(),
    accountType: s(d.accountType),
    interests: arr(d.interests),
    privacy: d.privacy || {},
    createdAt: tsToMillis(d.createdAt),
    role: s(d.role),
    suspended: !!d.suspended,
    raw: d,
  };
}

function mediaList(d) {
  const list = arr(d.mediaUrls).filter(Boolean);
  if (list.length) return list;
  const one = first(d.mediaUrl, d.imageUrl, d.photoUrl, d.image);
  if (one) return [one];
  return arr(d.images).filter((x) => typeof x === 'string');
}

export function isVideoUrl(url, type) {
  if (type && String(type).startsWith('video')) return true;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || '') || /\/video\/upload\//.test(url || '');
}

export function normPost(id, d = {}) {
  const media = mediaList(d);
  return {
    id,
    kind: 'post',
    text: s(d.text || d.caption),
    media,
    mediaType: s(d.mediaType),
    authorId: s(first(d.authorId, d.userId, d.createdByUid, d.createdByUserId)),
    authorName: s(first(d.authorName, d.userName, d.businessName)) || 'GeoHub',
    authorAvatar: s(first(d.authorAvatar, d.userPhoto, d.userPhotoURL, d.avatar, d.logoUrl)),
    authorType: s(d.authorType || 'user'),
    authorVerified: !!d.authorVerified,
    businessId: s(d.businessId),
    targetType: s(d.targetType || 'user'),
    targetId: s(d.targetId),
    groupId: s(d.groupId),
    visibility: s(d.visibility || 'public'),
    status: s(d.status || 'active'),
    type: s(d.type || d.postType || 'post'),
    feeling: s(d.feeling),
    location: d.location || (d.placeName ? { name: d.placeName, placeId: d.placeId } : null),
    placeId: s(d.placeId),
    placeName: s(d.placeName),
    bgGradient: d.bgGradient || null,
    poll: d.poll || null,
    sharedPostId: s(d.sharedPostId),
    linkPreview: d.linkPreview || null,
    likeCount: Math.max(0, n(d.reactionCount) > n(d.likeCount) ? n(d.reactionCount) : n(d.likeCount)),
    commentCount: Math.max(0, n(d.commentCount)),
    shareCount: Math.max(0, n(d.shareCount)),
    viewCount: Math.max(0, n(d.viewCount)),
    commentsDisabled: !!d.commentsDisabled,
    pinned: !!d.pinned,
    createdAt: tsToMillis(d.createdAt),
    raw: d,
  };
}

export function normComment(id, d = {}) {
  return {
    id,
    text: s(d.text),
    voiceUrl: s(d.voiceUrl),
    authorId: s(first(d.authorId, d.userId)),
    userId: s(d.userId || d.authorId),
    authorName: s(d.authorName) || 'GeoHub',
    authorAvatar: s(d.authorAvatar),
    authorType: s(d.authorType || 'user'),
    businessId: s(d.businessId),
    replyCount: n(d.replyCount),
    reactionCount: n(d.reactionCount ?? d.likes ?? d.likeCount),
    status: s(d.status || 'active'),
    edited: !!(d.updatedAt && d.createdAt && tsToMillis(d.updatedAt) - tsToMillis(d.createdAt) > 5000 && d.edited !== false),
    createdAt: tsToMillis(d.createdAt),
    raw: d,
  };
}

export function normStory(id, d = {}) {
  return {
    id,
    text: s(d.text),
    mediaUrl: s(d.mediaUrl),
    mediaType: s(d.mediaType),
    bg: d.bg || null,
    authorId: s(first(d.authorId, d.userId)),
    authorName: s(d.authorName) || 'GeoHub',
    authorAvatar: s(d.authorAvatar),
    viewedBy: arr(d.viewedBy),
    viewCount: n(d.viewCount),
    closeFriends: !!d.closeFriends,
    closeFriendsList: arr(d.closeFriendsList),
    link: d.link || null,
    locationName: s(d.locationName),
    textStyle: d.textStyle || null,
    createdAt: tsToMillis(d.createdAt),
    expiresAt: tsToMillis(d.expiresAt),
    raw: d,
  };
}

export function normBiz(id, d = {}) {
  return {
    id,
    name: s(first(d.title, d.name)) || '—',
    description: s(first(d.description, d.desc)),
    category: s(d.category),
    tags: arr(d.tags),
    logo: s(first(d.logoUrl, d.logo)),
    cover: s(first(d.coverUrl, d.coverImageUrl, d.coverImage, d.imageUrl, d.image)),
    ownerId: s(first(d.ownerId, d.createdBy, d.userId)),
    city: s(d.city),
    address: s(d.address),
    phone: s(d.phone),
    email: s(d.email),
    website: s(d.website),
    hours: s(d.hours),
    workingHours: d.workingHours || null,
    socialLinks: { instagram: s(d.socialLinks?.instagram || d.instagram), facebook: s(d.socialLinks?.facebook || d.facebook), whatsapp: s(d.socialLinks?.whatsapp || d.whatsapp) },
    lat: Number(d.lat) || null,
    lng: Number(d.lng) || null,
    verified: !!(d.verified || d.isVerified),
    plan: s(d.plan || 'free'),
    status: s(d.status || 'active'),
    businessType: s(d.businessType),
    isOnline: !!(d.isOnline || d.businessType === 'online'),
    priceRange: s(d.priceRange),
    followerCount: n(d.followerCount),
    postCount: n(d.postCount),
    reviewCount: n(d.reviewCount ?? d.ratingCount),
    rating: n(d.ratingAverage || d.rating),
    createdAt: tsToMillis(d.createdAt),
    deleted: d.status === 'deleted' || d.deleted === true || !!d.deletedAt,
    raw: d,
  };
}

export function normPlace(id, d = {}) {
  const photos = arr(d.photos).filter((x) => typeof x === 'string');
  return {
    id,
    name: s(first(d.name, d.title)) || '—',
    description: s(first(d.description, d.shortDescription)),
    category: s(first(d.categoryId, d.category)),
    categoryLabel: s(d.category),
    subcategory: s(d.subcategory),
    city: s(d.city),
    address: s(d.address),
    region: s(d.region),
    lat: Number(d.lat) || null,
    lng: Number(d.lng) || null,
    image: s(first(d.coverImage, d.imageUrl, d.photoUrl, d.image, photos[0])),
    photos,
    rating: n(d.rating),
    reviewCount: n(d.reviewCount),
    checkinCount: n(d.checkinCount ?? d.visitCount),
    saveCount: n(d.saveCount),
    verified: !!d.isVerified,
    creatorId: s(first(d.creatorId, d.userId, d.createdBy, d.ownerId)),
    googlePlaceId: s(d.googlePlaceId),
    status: s(d.status || 'active'),
    createdAt: tsToMillis(d.createdAt),
    raw: d,
  };
}

export function normGroup(id, d = {}) {
  return {
    id,
    name: s(first(d.name, d.title)) || '—',
    description: s(first(d.description, d.desc)),
    category: s(d.category || 'general'),
    privacy: s(d.privacy || (d.joinType === 'approval' ? 'private' : 'public')),
    cover: s(first(d.coverUrl, d.coverImage, d.imageUrl, d.image)),
    avatar: s(d.avatar),
    emoji: s(d.emoji),
    city: s(first(d.city, d.location)),
    ownerId: s(first(d.creatorId, d.ownerId, d.userId, d.createdBy)),
    memberCount: n(d.memberCount ?? d.membersCount),
    postCount: n(d.postCount ?? d.postsCount),
    rules: arr(d.rules),
    joinQuestions: arr(d.joinQuestions),
    postApproval: !!d.postApproval,
    inviteToken: s(d.inviteToken),
    inviteEnabled: !!d.inviteEnabled,
    createdAt: tsToMillis(d.createdAt),
    raw: d,
  };
}

export function normEvent(id, d = {}) {
  return {
    id,
    title: s(first(d.title, d.name)) || '—',
    description: s(d.description),
    category: s(d.category),
    city: s(d.city),
    venue: s(first(d.venue, d.location, d.address)),
    image: s(first(d.imageUrl, d.image, d.coverUrl)),
    date: tsToMillis(d.date || d.startsAt || d.startDate),
    endDate: tsToMillis(d.endDate || d.endsAt),
    price: n(d.ticketPrice ?? d.price),
    capacity: n(d.capacity),
    ownerId: s(first(d.ownerId, d.createdBy, d.userId)),
    status: s(d.status || 'active'),
    lat: Number(d.lat) || null,
    lng: Number(d.lng) || null,
    createdAt: tsToMillis(d.createdAt),
    raw: d,
  };
}

export function youtubeIdFrom(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

export function normVideo(id, d = {}) {
  const yt = s(d.youtubeId) || youtubeIdFrom(d.youtubeUrl || d.url);
  return {
    id,
    kind: 'video',
    title: s(d.title) || '—',
    description: s(d.description),
    youtubeId: yt,
    videoUrl: s(first(d.videoUrl, d.mediaUrl)),
    thumbnail: s(first(d.thumbnail, d.thumbnailUrl, yt && `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`)),
    isShort: !!d.isShort,
    channelId: s(d.channelId),
    channelName: s(d.channelName),
    channelAvatar: s(d.channelAvatar),
    authorId: s(d.authorId),
    authorName: s(d.authorName),
    authorAvatar: s(d.authorAvatar),
    category: s(d.category),
    city: s(d.city),
    tags: arr(d.tags),
    placeId: s(d.placeId),
    placeName: s(d.placeName),
    businessId: s(d.businessId),
    likeCount: n(d.likeCount),
    viewCount: n(d.viewCount),
    commentCount: n(d.commentCount),
    status: s(d.status || 'active'),
    createdAt: tsToMillis(d.createdAt),
    raw: d,
  };
}

export function normChannel(id, d = {}) {
  return {
    id,
    name: s(d.name) || '—',
    description: s(d.description),
    avatar: s(d.avatar),
    banner: s(d.banner),
    ownerId: s(d.ownerId),
    youtubeUrl: s(d.youtubeUrl),
    subscriberCount: n(d.subscriberCount),
    videoCount: n(d.videoCount),
    createdAt: tsToMillis(d.createdAt),
    raw: d,
  };
}

export function normItem(id, d = {}) {
  const images = arr(d.images).filter(Boolean);
  return {
    id,
    title: s(d.title) || '—',
    description: s(d.description),
    price: n(d.price),
    currency: s(d.currency || 'GEL'),
    category: s(d.category || 'item'),
    subcategory: s(d.subcategory),
    condition: s(d.condition),
    city: s(d.city),
    images: images.length ? images : [s(first(d.imageUrl, d.image))].filter(Boolean),
    sellerId: s(first(d.sellerId, d.userId, d.ownerId, d.createdBy)),
    sellerName: s(d.sellerName),
    sellerAvatar: s(d.sellerAvatar),
    status: s(d.status || 'active'),
    createdAt: tsToMillis(d.createdAt),
    raw: d,
  };
}

export function normNotification(id, d = {}) {
  return {
    id,
    type: s(d.type || 'notification'),
    title: s(d.title),
    body: s(d.body || d.message),
    href: s(d.href || d.link || d.url),
    fromUserId: s(d.fromUserId || d.fromUid),
    fromName: s(d.fromName),
    fromAvatar: s(d.fromAvatar),
    read: !!(d.read || d.seen),
    postId: s(d.postId),
    commentId: s(d.commentId),
    storyId: s(d.storyId),
    conversationId: s(d.conversationId),
    createdAt: tsToMillis(d.createdAt),
    raw: d,
  };
}
