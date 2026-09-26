import { useEffect, useState } from 'preact/hooks';
import { t, lang } from '../../lib/i18n.js';
import { placeCategories } from '../../data/places.js';

/**
 * Place categories. The first set matches what the old site stored in
 * places.category; Firestore placeCategories may add more (they bring their
 * own labels and an emoji).
 */
export const PLACE_CATEGORIES = [
  { id: 'nature', icon: 'mountains', tone: '#2f9e5b' },
  { id: 'history', icon: 'castle-turret', tone: '#9a6b2f' },
  { id: 'museum', icon: 'bank', tone: '#7a5bc4' },
  { id: 'food', icon: 'fork-knife', tone: '#e0662b' },
  { id: 'restaurant', icon: 'fork-knife', tone: '#e0662b' },
  { id: 'cafe', icon: 'coffee', tone: '#a0673a' },
  { id: 'wine', icon: 'wine', tone: '#b0264f' },
  { id: 'beach', icon: 'umbrella', tone: '#1f8fbf' },
  { id: 'city', icon: 'buildings', tone: '#4b6bd6' },
  { id: 'hotel', icon: 'bed', tone: '#3c8c8c' },
  { id: 'shopping', icon: 'shopping-bag', tone: '#d4468a' },
  { id: 'nightlife', icon: 'martini', tone: '#6a3fbf' },
  { id: 'sports', icon: 'soccer-ball', tone: '#3a9a3a' },
  { id: 'other', icon: 'map-pin', tone: '#7b746f' },
];
const BY_ID = Object.fromEntries(PLACE_CATEGORIES.map((c) => [c.id, c]));

let remote = null;
function loadRemote() {
  if (!remote) remote = placeCategories().catch(() => []);
  return remote;
}

function labelFor(id, extra) {
  const key = `place.cat.${id}`;
  const v = t(key);
  if (v !== key) return v;
  if (extra) {
    const l = lang.value === 'ka' ? extra.labelKa : extra.labelEn || extra.labelKa;
    if (l) return String(l).replace(/^\p{Extended_Pictographic}️?\s*/u, '');
  }
  return id;
}

/** Category meta for a place (known id, remote category, or the raw label). */
export function categoryOf(place) {
  const id = place?.category || 'other';
  const c = BY_ID[id];
  if (c) return { ...c, label: labelFor(id) };
  return { id, icon: 'map-pin', tone: '#7b746f', label: place?.categoryLabel && place.categoryLabel !== id ? place.categoryLabel : labelFor(id) };
}

/** All categories for filters and forms: built-in plus any from Firestore. */
export function useCategories() {
  const [extra, setExtra] = useState([]);
  useEffect(() => { loadRemote().then(setExtra); }, []);
  void lang.value;
  const list = PLACE_CATEGORIES.filter((c) => c.id !== 'restaurant').map((c) => ({ ...c, label: labelFor(c.id, extra.find((e) => e.id === c.id)) }));
  for (const e of extra) {
    if (BY_ID[e.id]) continue;
    list.splice(list.length - 1, 0, { id: e.id, icon: 'map-pin', tone: '#7b746f', emoji: e.icon, label: labelFor(e.id, e) });
  }
  return list;
}
