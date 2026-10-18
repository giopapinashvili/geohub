import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReviewTags, readableReviewTags, summarizeReviewTags, validCommunityReview, REVIEW_EXPERIENCE_TAGS } from '../src/lib/reviewTags.js';

const review = { placeId: 'place_1', userId: 'user_1', rating: 5, comment: 'ძალიან გემრიელი იყო', experienceTags: ['tasty', 'good-service'] };

test('only explicit unique allowed tags can be written, max six', () => {
  assert.deepEqual(normalizeReviewTags(), []);
  assert.deepEqual(normalizeReviewTags(review.experienceTags), ['tasty', 'good-service']);
  for (const tags of [['invented'], ['tasty', 'tasty'], 'tasty', null, REVIEW_EXPERIENCE_TAGS.slice(0, 7).map((tag) => tag.id)]) assert.throws(() => normalizeReviewTags(tags));
});

test('legacy prose does not become a community claim', () => {
  const legacy = { ...review, experienceTags: undefined };
  assert.deepEqual(readableReviewTags(legacy), []);
  assert.equal(summarizeReviewTags([legacy]).counts.tasty, 0);
  assert.equal(summarizeReviewTags([legacy]).taggedReviewCount, 0);
});

test('duplicate reviews cannot multiply a person’s tag vote', () => {
  const summary = summarizeReviewTags([review, review, { ...review, experienceTags: ['tasty', 'cozy'] }, { ...review, userId: 'user_2', experienceTags: ['tasty'] }]);
  assert.equal(summary.counts.tasty, 2);
  assert.equal(summary.counts['good-service'], 1);
  assert.equal(summary.counts.cozy, 1);
  assert.equal(summary.reviewCount, 2); assert.equal(summary.taggedReviewCount, 2);
});

test('demonstrations, hidden reviews, noninteger ratings and anonymous claims do not count', () => {
  const invalid = [{ ...review, isDemo: true }, { ...review, status: 'hidden' }, { ...review, rating: 4.2 }, { ...review, userId: '' }, { ...review, rating: '5' }];
  assert.ok(invalid.every((item) => !validCommunityReview(item)));
  assert.equal(summarizeReviewTags(invalid).counts.tasty, 0);
});
