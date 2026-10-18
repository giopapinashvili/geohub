import { formatCoordinates } from './coordinates.js';
import { taxonomyCategory } from './placeTaxonomy.js';
import { photoDateLabel } from './photoDate.js';

const DIETS = { vegan: 'ვეგანური არჩევანი', vegetarian: 'ვეგეტარიანული არჩევანი', halal: 'ჰალალის არჩევანი', kosher: 'კოშერის არჩევანი', 'gluten-free': 'უგლუტენო არჩევანი', 'lactose-free': 'ლაქტოზის გარეშე' };
const ACCESS = { private: 'კერძო ტერიტორია', no: 'საჯარო შესვლა აკრძალულია', customers: 'მხოლოდ მომხმარებლებისთვის', permit: 'საჭიროა ნებართვა', members: 'მხოლოდ წევრებისთვის' };
export function sourceHttpUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function sourceDateLabel(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? `${String(parsed.getUTCDate()).padStart(2, '0')}.${String(parsed.getUTCMonth() + 1).padStart(2, '0')}.${parsed.getUTCFullYear()}` : '';
}

/** Directory entries, never authored merchant posts, reviews or recent activity. */
export function importedPlaceEntries(place) {
  const match = /^osm_(node|way|relation)_(\d+)$/.exec(place?.id || '');
  if (!match || place?.raw?.source !== 'openstreetmap') return null;
  const raw = place.raw, facets = place.facets || {}, category = taxonomyCategory(place.category);
  const sourceUrl = `https://www.openstreetmap.org/${match[1]}/${match[2]}`;
  const text = value => typeof value === 'string' ? value.trim() : '';
  const facts = [{ icon: category.icon, label: 'კატეგორია', value: category.label }];
  const add = (icon, label, value, href) => { if (value) facts.push({ icon, label, value, ...(href ? { href } : {}) }); };
  add('map-pin', 'მისამართი', text(place.address));
  add('crosshair', raw.coordinateAccuracy === 'approximate-center' ? 'ობიექტის სავარაუდო ცენტრი' : 'კოორდინატები', formatCoordinates(place));
  add('clock', 'სამუშაო საათები წყაროს მიხედვით', text(raw.openingHours));
  const phone = text(raw.phone).split(';')[0].trim(), telephone = phone.replace(/[^\d+]/g, '');
  if (telephone) add('phone', 'ტელეფონი წყაროს მიხედვით', phone, `tel:${telephone}`);
  const website = sourceHttpUrl(raw.website);
  add('globe-simple', 'საიტი წყაროს მიხედვით', website ? new URL(website).hostname : '', website);
  add('buildings', 'სართული წყაროს მიხედვით', text(facets.level));
  add('info', 'შესვლის პირობები', ACCESS[facets.access]);
  const amenities = [...new Set([
    ...(Array.isArray(facets.diets) ? facets.diets : []).map(id => DIETS[id]),
    facets.wheelchair === 'yes' ? 'ეტლით მისაწვდომი' : facets.wheelchair === 'limited' ? 'ეტლით ნაწილობრივ მისაწვდომი' : '',
    facets.outdoorSeating === true ? 'გარე დასაჯდომი სივრცე' : '',
    facets.takeaway === true ? 'წასაღებად' : '', facets.delivery === true ? 'მიტანა' : '',
  ].filter(Boolean))];
  const photoUrls = new Set([place.image, ...(Array.isArray(place.photos) ? place.photos : [])]);
  const used = new Set();
  const photos = (Array.isArray(raw.photoCredits) ? raw.photoCredits : []).filter(photo => {
    if (!photo || !photoUrls.has(photo.url) || used.has(photo.url)) return false;
    const imageSafe = /^\/place-media\/[\w.-]+$/.test(photo.url) || sourceHttpUrl(photo.url).startsWith('https://');
    if (!imageSafe || !sourceHttpUrl(photo.sourceUrl) || !sourceHttpUrl(photo.licenseUrl) || !text(photo.license) || !text(photo.author)) return false;
    used.add(photo.url); return true;
  }).map(photo => ({ ...photo, sourceUrl: sourceHttpUrl(photo.sourceUrl), licenseUrl: sourceHttpUrl(photo.licenseUrl), authorUrl: sourceHttpUrl(photo.authorUrl), caption: text(photo.caption) || place.name, dateLabel: photoDateLabel(photo.dateTaken) }));
  return { placeId: place.id, placeHref: `/place/${place.id}`, mapHref: `/map?place=${place.id}`, name: place.name, category,
    sourceUrl, sourceDate: sourceDateLabel(raw.sourceDate), updatedDate: sourceDateLabel(raw.sourceUpdatedAt),
    description: text(place.description), facts, amenities, photos,
    summary: `${category.label}${place.address ? ` · ${place.address}` : ''}`,
  };
}
