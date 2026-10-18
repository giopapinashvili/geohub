import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLegacy, appHref } from '../src/legacy.js';

test('modern customer message links remain customer message links', () => {
  assert.equal(resolveLegacy('/messages?business=page_123'), null);
  assert.equal(appHref('/messages?business=page_123'), '/messages?business=page_123');
  assert.equal(appHref('/messages?with=user_123'), '/messages?with=user_123');
});

test('legacy owner and customer message links preserve their different destinations', () => {
  assert.equal(appHref('/messages.html?business=page_123'), '/business/page_123/manage?tab=inbox');
  assert.equal(appHref('/messages.html?withBusiness=page_123'), '/messages?business=page_123');
  assert.equal(appHref('/messages?withBusiness=page_123'), '/messages?business=page_123');
  assert.equal(appHref('/messages.html?cid=conversation_123'), '/messages/conversation_123');
});
