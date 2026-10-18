import { REVIEW_EXPERIENCE_TAGS, MAX_REVIEW_TAGS, readableReviewTags, summarizeReviewTags } from '../../lib/reviewTags.js';
import '../../styles/review-tags.css';

export function ReviewTagInput({ value = [], onChange, disabled = false }) {
  return <fieldset class="review-tag-input" disabled={disabled}>
    <legend>როგორი იყო გამოცდილება? <small>არასავალდებულო</small></legend>
    <p>მონიშნე ის, რაც თავად გამოცადე — მაქსიმუმ {MAX_REVIEW_TAGS}.</p>
    <div class="review-tag-options">{REVIEW_EXPERIENCE_TAGS.map((tag) => {
      const selected = value.includes(tag.id);
      return <label key={tag.id} class={selected ? 'is-selected' : ''}>
        <input type="checkbox" checked={selected} disabled={!selected && value.length >= MAX_REVIEW_TAGS}
          onChange={() => onChange(selected ? value.filter((id) => id !== tag.id) : [...value, tag.id])}/>
        <span>{tag.label}</span>
      </label>;
    })}</div>
    <small class="review-tag-count" role="status" aria-live="polite">არჩეულია {value.length}/{MAX_REVIEW_TAGS}</small>
  </fieldset>;
}

export function ReviewTags({ review }) {
  const tags = readableReviewTags(review);
  if (!tags.length) return null;
  return <ul class="review-tag-labels" aria-label="მომხმარებლის მიერ მონიშნული შეფასებები">{REVIEW_EXPERIENCE_TAGS.filter((tag) => tags.includes(tag.id)).map((tag) => <li key={tag.id}>{tag.label}</li>)}</ul>;
}

export function ReviewTagSummary({ reviews = [] }) {
  const summary = summarizeReviewTags(reviews);
  const tags = REVIEW_EXPERIENCE_TAGS.filter((tag) => summary.counts[tag.id] > 0).sort((a, b) => summary.counts[b.id] - summary.counts[a.id]);
  if (!tags.length) return null;
  return <section class="review-tag-summary" aria-label="მომხმარებლების გამოცდილება">
    <strong>მომხმარებლების შეფასებით</strong>
    <p>ჩატვირთულ მიმოხილვებში {summary.taggedReviewCount} მომხმარებელმა თავად მონიშნა:</p>
    <ul>{tags.map((tag) => <li key={tag.id}><span>{tag.label}</span><b aria-label={`${summary.counts[tag.id]} მომხმარებელი`}>{summary.counts[tag.id]}</b></li>)}</ul>
  </section>;
}
