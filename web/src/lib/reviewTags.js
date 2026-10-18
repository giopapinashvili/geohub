export const REVIEW_EXPERIENCE_TAGS = Object.freeze([
  { id: 'tasty', label: 'გემრიელია' },
  { id: 'good-service', label: 'კარგი მომსახურება' },
  { id: 'cozy', label: 'მყუდრო გარემო' },
  { id: 'quiet', label: 'მშვიდი გარემო' },
  { id: 'lively', label: 'ცოცხალი ატმოსფერო' },
  { id: 'good-value', label: 'ღირს თავისი ფასი' },
  { id: 'family-friendly', label: 'კარგია ბავშვებთან ერთად' },
  { id: 'fast-service', label: 'სწრაფი მომსახურება' },
  { id: 'clean', label: 'სისუფთავე' },
  { id: 'easy-parking', label: 'მარტივი პარკირება' },
  { id: 'accessible', label: 'მარტივი მისაწვდომობა' },
  { id: 'good-for-work', label: 'კარგია სამუშაოდ' },
]);
export const MAX_REVIEW_TAGS = 6;
const TAG_IDS = new Set(REVIEW_EXPERIENCE_TAGS.map((tag) => tag.id));

export function normalizeReviewTags(value = []) {
  if (!Array.isArray(value) || value.length > MAX_REVIEW_TAGS || new Set(value).size !== value.length || value.some((id) => !TAG_IDS.has(id))) {
    throw new Error('აირჩიე მაქსიმუმ 6 განსხვავებული შეფასების ნიშანი.');
  }
  return [...value];
}
export const isReviewExperienceTag = (value) => TAG_IDS.has(value);
export const readableReviewTags = (review) => Array.isArray(review?.experienceTags)
  ? [...new Set(review.experienceTags.filter((id) => TAG_IDS.has(id)))].slice(0, MAX_REVIEW_TAGS) : [];

export function validCommunityReview(review) {
  return !!review && typeof review.userId === 'string' && !!review.userId
    && Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5
    && !['deleted', 'hidden', 'inactive'].includes(review.status) && review.isDemo !== true;
}

/** One person contributes at most one vote per tag, even with duplicate reviews. */
export function summarizeReviewTags(reviews = []) {
  const users = new Set();
  const taggedUsers = new Set();
  const voters = new Map(REVIEW_EXPERIENCE_TAGS.map((tag) => [tag.id, new Set()]));
  for (const review of reviews) {
    if (!validCommunityReview(review)) continue;
    users.add(review.userId);
    const tags = readableReviewTags(review);
    if (tags.length) taggedUsers.add(review.userId);
    for (const tag of tags) voters.get(tag).add(review.userId);
  }
  return { counts: Object.fromEntries([...voters].map(([id, people]) => [id, people.size])), reviewCount: users.size, taggedReviewCount: taggedUsers.size };
}
