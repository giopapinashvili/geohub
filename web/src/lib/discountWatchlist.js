import { COMMERCE_TYPES, priceToMinor, commerceOfferState } from './commerce.js';
import { discoveryScore, normalizeSearch } from './discoverySearch.js';

export const MAX_DISCOUNT_WATCHES = 20;
export function normalizeDiscountWatch({ term = '', type = '', maxPrice = '' } = {}) {
  const text = String(term).trim();
  if (text.length > 120) throw new Error('ძიება მაქსიმუმ 120 სიმბოლოს უნდა შეიცავდეს.');
  if (type && !COMMERCE_TYPES.includes(type)) throw new Error('შეთავაზების ტიპი არასწორია.');
  const maxPriceMinor = priceToMinor(maxPrice);
  if (!text && !type && maxPriceMinor === null) throw new Error('შენახვამდე მიუთითე საძიებო სიტყვა, ტიპი ან მაქსიმალური ფასი.');
  return { term: text, type, maxPriceMinor };
}
export function readableDiscountWatches(entries) {
  if (!Array.isArray(entries)) return [];
  const seen = new Set();
  return entries.filter(entry => {
    if (!entry || typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(entry.id) || seen.has(entry.id)) return false;
    if (typeof entry.term !== 'string' || entry.term.length > 120 || (entry.type !== '' && !COMMERCE_TYPES.includes(entry.type))) return false;
    if (entry.maxPriceMinor !== null && (!Number.isSafeInteger(entry.maxPriceMinor) || entry.maxPriceMinor < 0 || entry.maxPriceMinor > 100000000)) return false;
    if (!entry.term.trim() && !entry.type && entry.maxPriceMinor === null) return false;
    seen.add(entry.id); return true;
  }).slice(0, MAX_DISCOUNT_WATCHES).map(({ id, term, type, maxPriceMinor, createdAtMs }) => ({ id, term, type, maxPriceMinor, createdAtMs: Number(createdAtMs) || 0 }));
}
export function addDiscountWatch(entries, query, { id, now = Date.now() } = {}) {
  const current = readableDiscountWatches(entries);
  const normalized = normalizeDiscountWatch(query);
  const key = value => `${normalizeSearch(value.term)}|${value.type}|${value.maxPriceMinor}`;
  if (current.some(entry => key(entry) === key(normalized))) return current;
  if (current.length >= MAX_DISCOUNT_WATCHES) throw new Error('მაქსიმუმ 20 ძიების შენახვა შეგიძლია. ახალი ძიებისთვის ერთი წაშალე.');
  return [{ ...normalized, id, createdAtMs: now }, ...current];
}
/** Counts only genuine, currently active offers loaded into the feed. */
export function matchesDiscountWatch(offer, watch, now = Date.now()) {
  if (!offer || offer.isDemo !== false || commerceOfferState(offer, now) !== 'active') return false;
  return matchesDiscountFilters(offer, watch);
}
export function matchesDiscountFilters(offer, watch) {
  if (watch.type && offer.type !== watch.type) return false;
  if (watch.maxPriceMinor !== null && (!Number.isSafeInteger(watch.maxPriceMinor) || watch.maxPriceMinor < 0 || offer.currency !== 'GEL' || !Number.isSafeInteger(offer.priceMinor) || offer.priceMinor > watch.maxPriceMinor)) return false;
  return !watch.term || discoveryScore({ ...offer, name: offer.itemTitle || offer.title, aliases: [offer.title, offer.businessName] }, watch.term).score > 0;
}
