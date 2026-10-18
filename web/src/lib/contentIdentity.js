// Public display identity never replaces the authenticated permission owner.
const ID = /^[A-Za-z0-9_-]{1,150}$/;
export function notificationSender(user, identity = null) {
  if (!user?.uid) return null;
  if (identity && identity.uid !== user.uid) return null;
  if (identity?.authorType === 'business') {
    if (!ID.test(identity.businessId || '')) return null;
    return { fromUserId: user.uid, fromActorType: 'business', fromActorId: identity.businessId,
      fromName: identity.name || '', fromAvatar: identity.avatar || '' };
  }
  return { fromUserId: user.uid, fromActorType: 'user', fromActorId: user.uid,
    fromName: user.name || '', fromAvatar: user.avatar || '' };
}

export function contentRecipient(content) {
  if (content?.authorType === 'business') return ID.test(content.businessId || '') ? { type: 'business', id: content.businessId } : null;
  const id = content?.authorId || content?.userId;
  return ID.test(id || '') ? { type: 'user', id } : null;
}

export function isPersonalProfilePost(post) {
  return post?.authorType !== 'business' && post?.targetType !== 'group' && !post?.groupId;
}

export function postDraftKey(uid, { businessId = '', groupId = '' } = {}) {
  if (!ID.test(uid || '')) return null;
  const scope = groupId ? `group_${groupId}` : businessId ? `business_${businessId}` : 'personal';
  return `gh_draft:v2:${uid}:${scope}`;
}
