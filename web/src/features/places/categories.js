import { useEffect, useState } from 'preact/hooks';
import { t, lang } from '../../lib/i18n.js';
import { placeCategories } from '../../data/places.js';
import { PLACE_TAXONOMY, canonicalCategory } from '../../lib/placeTaxonomy.js';

/**
 * Place categories. The first set matches what the old site stored in
 * places.category; Firestore placeCategories may add more (they bring their
 * own labels and an emoji).
 */
export const PLACE_CATEGORIES = PLACE_TAXONOMY;
const BY_ID = Object.fromEntries(PLACE_CATEGORIES.map((c) => [c.id, c]));

let remote = null;
function loadRemote() {
  if (!remote) remote = placeCategories().catch(() => []);
  return remote;
}

function labelFor(id, extra) {
  if (BY_ID[id]?.label && lang.value === 'ka') return BY_ID[id].label;
  const key = `place.cat.${id}`;
  const v = t(key);
  if (v !== key) return v;
  if (extra) {
    const l = lang.value === 'ka' ? extra.labelKa : extra.labelEn || extra.labelKa;
    if (l) return String(l).replace(/^\p{Extended_Pictographic}️?\s*/u, '');
  }
  if (BY_ID[id]?.label) return BY_ID[id].label;
  return id;
}

/** Category meta for a place (known id, remote category, or the raw label). */
export function categoryOf(place) {
  const id = place?.category || 'other';
  const normalized = canonicalCategory(id);
  const c = BY_ID[id] || (normalized !== 'other' ? BY_ID[normalized] : null);
  if (c) return { ...c, label: labelFor(c.id) };
  return { id, icon: 'map-pin', tone: '#7b746f', label: place?.categoryLabel && place.categoryLabel !== id ? place.categoryLabel : labelFor(id) };
}

/** All categories for filters and forms: built-in plus any from Firestore. */
export function useCategories() {
  const [extra, setExtra] = useState([]);
  useEffect(() => { loadRemote().then(setExtra); }, []);
  void lang.value;
  const list = PLACE_CATEGORIES.map((c) => ({ ...c, label: labelFor(c.id, extra.find((e) => e.id === c.id)) }));
  for (const e of extra) {
    if (BY_ID[e.id]) continue;
    list.splice(list.length - 1, 0, { id: e.id, icon: 'map-pin', tone: '#7b746f', emoji: e.icon, label: labelFor(e.id, e) });
  }
  return list;
}
