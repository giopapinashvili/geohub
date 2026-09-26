import { t } from '../../lib/i18n.js';

export const EVENT_CATEGORIES = [
  { id: 'music', icon: 'music-notes', tone: '#7a5bc4' },
  { id: 'food', icon: 'fork-knife', tone: '#e0662b' },
  { id: 'outdoor', icon: 'mountains', tone: '#2f9e5b' },
  { id: 'culture', icon: 'mask-happy', tone: '#b0264f' },
  { id: 'sports', icon: 'soccer-ball', tone: '#3a9a3a' },
  { id: 'tech', icon: 'laptop', tone: '#4b6bd6' },
  { id: 'kids', icon: 'baby', tone: '#e3a21a' },
  { id: 'party', icon: 'confetti', tone: '#d4468a' },
  { id: 'other', icon: 'calendar-blank', tone: '#7b746f' },
];

export function eventCategory(id) {
  const c = EVENT_CATEGORIES.find((x) => x.id === id) || EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];
  const key = `events.cat.${c.id}`;
  return { ...c, label: id && !EVENT_CATEGORIES.some((x) => x.id === id) ? id : t(key) };
}
