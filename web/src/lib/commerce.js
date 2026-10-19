// Shared, dependency-free catalog and offer contracts. Store money in minor
// units so calculating a discount never depends on floating-point arithmetic.
export const COMMERCE_TYPES = Object.freeze(['product', 'dish', 'service', 'bundle']);
export const COMMERCE_CURRENCIES = Object.freeze(['GEL', 'USD', 'EUR']);
export const DIETARY_TAGS = Object.freeze(['vegetarian', 'vegan', 'halal', 'gluten-free', 'dairy-free']);
export const DEMO_OFFER_LABEL = 'დემო — შეთავაზება არ მოქმედებს';
const STATUSES = ['draft', 'published', 'archived'];
const MAX_PRICE = 100000000;
const ID = /^[A-Za-z0-9_-]{1,150}$/;

export class CommerceValidationError extends Error {
  constructor(field, message) { super(message); this.name = 'CommerceValidationError'; this.field = field; }
}
const fail = (field, message) => { throw new CommerceValidationError(field, message); };
function text(value, field, max, required = false) {
  if (typeof value !== 'string') fail(field, 'მიუთითე ტექსტი.');
  const result = value.trim();
  if (result.length > max || (required && !result)) fail(field, `შეავსე ველი (მაქსიმუმ ${max} სიმბოლო).`);
  return result;
}
export function commerceId(value, field = 'id') {
  if (typeof value !== 'string' || !ID.test(value)) fail(field, 'არასწორი ჩანაწერის იდენტიფიკატორი.');
  return value;
}
function minor(value, field, nullable = false) {
  if (nullable && value == null) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_PRICE) fail(field, 'ფასი მიუთითე სწორად.');
  return value;
}
function choice(value, values, field) {
  if (!values.includes(value)) fail(field, 'აირჩიე დასაშვები მნიშვნელობა.');
  return value;
}
function uniqueList(value, field, max, validate) {
  if (!Array.isArray(value) || value.length > max) fail(field, `მაქსიმუმ ${max} მნიშვნელობაა დაშვებული.`);
  const result = value.map((v) => validate(v, field));
  if (new Set(result).size !== result.length) fail(field, 'სიაში განმეორებული მნიშვნელობაა.');
  return result;
}
function httpsUrl(value, field) {
  const result = text(value || '', field, 2048);
  if (result) {
    try { if (new URL(result).protocol !== 'https:') fail(field, 'გამოიყენე HTTPS ბმული.'); }
    catch { fail(field, 'არასწორი ბმული.'); }
  }
  return result;
}
function provenance(input) {
  const isDemo = input.isDemo === true;
  if (input.isDemo != null && typeof input.isDemo !== 'boolean') fail('isDemo', 'არასწორი დემო ნიშნული.');
  const demoBatchId = isDemo ? commerceId(input.demoBatchId, 'demoBatchId') : '';
  if (!isDemo && input.demoBatchId) fail('demoBatchId', 'ნამდვილი ჩანაწერი დემო ჯგუფს ვერ მიეკუთვნება.');
  return { isDemo, demoBatchId, datasetVersion: 1 };
}
function branchScope(input) {
  const allBranches = input.allBranches !== false;
  const branchIds = uniqueList(input.branchIds || [], 'branchIds', 5, commerceId);
  if (allBranches && branchIds.length) fail('branchIds', 'აირჩიე ყველა ფილიალი ან კონკრეტული ფილიალები.');
  if (!allBranches && !branchIds.length) fail('branchIds', 'აირჩიე სულ მცირე ერთი ფილიალი.');
  return { allBranches, branchIds };
}

/** Strict decimal parsing for form values: no currency symbols, exponent,
 * grouping or silent truncation. Empty price remains unknown, never zero. */
export function priceToMinor(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) fail('price', 'მიუთითე ფასი, მაგალითად 12.50.');
  const [whole, fraction = ''] = normalized.split('.');
  return minor(Number(whole) * 100 + Number(fraction.padEnd(2, '0')), 'price');
}
export function formatCommercePrice(value, currency = 'GEL', locale = 'ka-GE') {
  if (!Number.isSafeInteger(value) || value < 0) return 'ფასი დასაზუსტებელია';
  if (currency === 'GEL') {
    const amount = new Intl.NumberFormat(locale, { minimumFractionDigits: value % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(value / 100);
    return `${amount} ₾`;
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 }).format(value / 100);
}
export function discountPercent(originalPriceMinor, priceMinor) {
  if (!Number.isSafeInteger(originalPriceMinor) || originalPriceMinor <= 0 || !Number.isSafeInteger(priceMinor) || priceMinor < 0 || priceMinor >= originalPriceMinor) return 0;
  return Math.round((originalPriceMinor - priceMinor) * 100 / originalPriceMinor);
}

export function normalizeCommerceItem(input) {
  const type = choice(input.type, COMMERCE_TYPES, 'type');
  const preparationMinutes = input.preparationMinutes == null || input.preparationMinutes === '' ? null : input.preparationMinutes;
  if (preparationMinutes !== null && (!Number.isInteger(preparationMinutes) || preparationMinutes < 1 || preparationMinutes > 1440)) fail('preparationMinutes', 'დრო მიუთითე 1–1440 წუთის ფარგლებში.');
  const dietaryTags = uniqueList(input.dietaryTags || [], 'dietaryTags', 5, (v) => choice(v, DIETARY_TAGS, 'dietaryTags'));
  if (type !== 'dish' && (preparationMinutes !== null || dietaryTags.length)) fail('type', 'საკვების მახასიათებლები მხოლოდ კერძს ეკუთვნის.');
  const bundleItemIds = uniqueList(input.bundleItemIds || [], 'bundleItemIds', 5, commerceId);
  if ((type === 'bundle' && !bundleItemIds.length) || (type !== 'bundle' && bundleItemIds.length)) fail('bundleItemIds', 'პაკეტში მიუთითე შემადგენელი პროდუქტები ან სერვისები.');
  const scope = branchScope(input);
  if (scope.branchIds.length + bundleItemIds.length > 5) fail('bundleItemIds', 'ფილიალებისა და პაკეტის ჩანაწერების ჯამური რაოდენობა მაქსიმუმ 5-ია.');
  return {
    businessId: commerceId(input.businessId, 'businessId'), type,
    title: text(input.title, 'title', 160, true), description: text(input.description || '', 'description', 4000),
    categoryId: text(input.categoryId || '', 'categoryId', 100),
    imageUrl: httpsUrl(input.imageUrl, 'imageUrl'), imageAssetId: text(input.imageAssetId || '', 'imageAssetId', 300),
    sourceUrl: httpsUrl(input.sourceUrl, 'sourceUrl'),
    priceMinor: minor(input.priceMinor, 'priceMinor', true), currency: choice(input.currency || 'GEL', COMMERCE_CURRENCIES, 'currency'),
    status: choice(input.status || 'draft', STATUSES, 'status'), available: input.available !== false,
    ...scope, dietaryTags, preparationMinutes, bundleItemIds,
    ...provenance(input),
  };
}

export function normalizeCommerceOffer(input, item) {
  if (!item || item.id !== input.itemId || item.businessId !== input.businessId) fail('itemId', 'აირჩიე ამ ბიზნესის კატალოგის ჩანაწერი.');
  if (item.status !== 'published' || item.available === false) fail('itemId', 'შეთავაზებას გამოქვეყნებული, ხელმისაწვდომი ჩანაწერი სჭირდება.');
  const originalPriceMinor = minor(input.originalPriceMinor, 'originalPriceMinor');
  const priceMinor = minor(input.priceMinor, 'priceMinor');
  if (originalPriceMinor !== item.priceMinor || originalPriceMinor <= priceMinor) fail('priceMinor', 'ახალი ფასი კატალოგის მიმდინარე ფასზე ნაკლები უნდა იყოს.');
  const startsAtMs = input.startsAtMs;
  const endsAtMs = input.endsAtMs;
  if (!Number.isSafeInteger(startsAtMs) || startsAtMs < 0 || !Number.isSafeInteger(endsAtMs) || endsAtMs <= startsAtMs || endsAtMs > 4102444800000) fail('endsAtMs', 'შეთავაზების დასრულება დაწყების შემდეგ უნდა იყოს.');
  const scope = branchScope(input);
  if (!item.allBranches && (scope.allBranches || scope.branchIds.some((id) => !item.branchIds.includes(id)))) fail('branchIds', 'შეთავაზება მხოლოდ კატალოგის მითითებულ ფილიალებში შეიძლება მოქმედებდეს.');
  const demo = provenance(input);
  if (demo.isDemo !== !!item.isDemo || demo.demoBatchId !== (item.demoBatchId || '')) fail('isDemo', 'დემო შეთავაზება დემო კატალოგის ჩანაწერს უნდა უკავშირდებოდეს.');
  return {
    businessId: commerceId(input.businessId, 'businessId'), itemId: commerceId(input.itemId, 'itemId'),
    type: item.type, categoryId: item.categoryId || '',
    title: text(input.title || item.title, 'title', 160, true), description: text(input.description || '', 'description', 4000),
    conditions: text(input.conditions || '', 'conditions', 2000), imageUrl: httpsUrl(input.imageUrl || item.imageUrl, 'imageUrl'),
    originalPriceMinor, priceMinor, currency: item.currency,
    startsAtMs, endsAtMs, status: choice(input.status || 'draft', STATUSES, 'status'),
    ...scope, ...demo,
  };
}

export function normalizeBusinessBranch(input) {
  const lat = input.lat == null || input.lat === '' ? null : input.lat;
  const lng = input.lng == null || input.lng === '' ? null : input.lng;
  if (!((lat === null && lng === null) || (typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 && typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180))) fail('lat', 'შეიყვანე ორივე სწორი კოორდინატი ან ორივე დატოვე ცარიელი.');
  return {
    businessId: commerceId(input.businessId, 'businessId'),
    placeId: input.placeId ? commerceId(input.placeId, 'placeId') : '',
    parentMallId: input.parentMallId ? commerceId(input.parentMallId, 'parentMallId') : '',
    title: text(input.title, 'title', 160, true), address: text(input.address || '', 'address', 300),
    city: text(input.city || '', 'city', 100), lat, lng,
    status: choice(input.status || 'draft', STATUSES, 'status'), ...provenance(input),
  };
}

/** Display state must be recomputed, including for an already-open page. */
export function commerceOfferState(offer, now = Date.now()) {
  if (offer.status !== 'published') return offer.status || 'draft';
  if (offer.sourceKind === 'official-website') {
    if (offer.isDemo || !Number.isFinite(offer.observedAtMs) || !Number.isFinite(offer.freshnessUntilMs) || offer.freshnessUntilMs <= offer.observedAtMs) return 'invalid';
    return now >= offer.freshnessUntilMs ? 'expired' : now < offer.observedAtMs ? 'scheduled' : 'active';
  }
  if (!Number.isFinite(offer.startsAtMs) || !Number.isFinite(offer.endsAtMs) || offer.endsAtMs <= offer.startsAtMs) return 'invalid';
  if (now < offer.startsAtMs) return 'scheduled';
  if (now >= offer.endsAtMs) return 'expired';
  return offer.isDemo ? 'demo' : 'active';
}

/** Build an allowlisted dry-run manifest, never parent business/place deletes.
 * Actual deletion requires re-reading every record and verifying these marks. */
export function planDemoCleanup(records, demoBatchId) {
  commerceId(demoBatchId, 'demoBatchId');
  const allowed = ['commerceOffers', 'commerceItems', 'businessBranches'];
  const selected = records.filter((record) => allowed.includes(record.collection) && record.isDemo === true && record.demoBatchId === demoBatchId);
  const documents = [...new Set(selected.map((record) => `${record.collection}/${commerceId(record.id)}`))]
    .sort((a, b) => allowed.indexOf(a.split('/')[0]) - allowed.indexOf(b.split('/')[0]) || a.localeCompare(b));
  // Asset IDs of shared/real photos must never become cleanup targets.
  const prefix = `geohub/demo/${demoBatchId}/`;
  const assets = [...new Set(selected.map((record) => record.imageAssetId).filter((asset) => typeof asset === 'string' && asset.startsWith(prefix) && !asset.includes('..')))];
  return { datasetVersion: 1, demoBatchId, documents, assets };
}
