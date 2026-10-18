import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationSender, contentRecipient, postDraftKey, isPersonalProfilePost } from '../src/lib/contentIdentity.js';

const user = { uid: 'owner', name: 'Personal name', avatar: 'personal.png' };
test('explicit page notification identity keeps the authenticated UID and the page display identity', () => {
  const sender = notificationSender(user, { uid: 'owner', authorType: 'business', businessId: 'pageA', name: 'Page A', avatar: 'page.png' });
  assert.deepEqual(sender, { fromUserId: 'owner', fromActorType: 'business', fromActorId: 'pageA', fromName: 'Page A', fromAvatar: 'page.png' });
  assert.equal(notificationSender(user).fromName, user.name);
  assert.equal(notificationSender(user).fromActorType, 'user');
  assert.equal(notificationSender(user, { uid: 'other', authorType: 'business', businessId: 'pageA' }), null);
  assert.equal(notificationSender(user, { uid: 'owner', authorType: 'business', businessId: '../bad' }), null);
});
test('activity on a page-authored object targets that page rather than the creator’s private inbox', () => {
  assert.deepEqual(contentRecipient({ authorId: 'owner', authorType: 'business', businessId: 'pageA' }), { type: 'business', id: 'pageA' });
  assert.deepEqual(contentRecipient({ authorId: 'owner', authorType: 'user', businessId: 'visitedPage' }), { type: 'user', id: 'owner' });
  assert.deepEqual(contentRecipient({ userId: 'legacyUser' }), { type: 'user', id: 'legacyUser' });
  assert.equal(contentRecipient({ authorId: 'owner', authorType: 'business' }), null);
});
test('post drafts are isolated by account, page and group', () => {
  const keys = [postDraftKey('owner'), postDraftKey('another'), postDraftKey('owner', { businessId: 'a' }),
    postDraftKey('owner', { businessId: 'b' }), postDraftKey('owner', { groupId: 'a' })];
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every(key => key.startsWith('gh_draft:v2:')));
  assert.equal(postDraftKey(''), null);
});
test('business posts cannot leak into the administrator’s personal profile feed', () => {
  assert.equal(isPersonalProfilePost({ authorId: 'owner', authorType: 'business', businessId: 'pageA' }), false);
  assert.equal(isPersonalProfilePost({ authorId: 'owner', authorType: 'user', businessId: 'visitedPage' }), true);
  assert.equal(isPersonalProfilePost({ authorId: 'owner', groupId: 'privateGroup' }), false);
});
