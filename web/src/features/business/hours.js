import { t } from '../../lib/i18n.js';

// The old signup form keyed working hours by Georgian weekday name, Monday
// first: { 'ორშაბათი': { closed, open: '09:00', close: '18:00' }, … }.
export const DAY_KEYS = ['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი', 'კვირა'];
const ALIASES = [
  ['mon', 'monday'], ['tue', 'tuesday'], ['wed', 'wednesday'], ['thu', 'thursday'], ['fri', 'friday'], ['sat', 'saturday'], ['sun', 'sunday'],
];

/** Seven { closed, open, close } rows, Monday first; null when not set. */
export function readHours(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rows = DAY_KEYS.map((ka, i) => {
    const v = raw[ka] ?? raw[ALIASES[i][0]] ?? raw[ALIASES[i][1]] ?? raw[i];
    if (!v || typeof v !== 'object') return null;
    return { closed: !!v.closed, open: String(v.open || ''), close: String(v.close || '') };
  });
  return rows.some(Boolean) ? rows.map((r) => r || { closed: true, open: '', close: '' }) : null;
}

export function writeHours(rows) {
  return Object.fromEntries(DAY_KEYS.map((k, i) => [k, { closed: !!rows[i].closed, open: rows[i].closed ? '' : rows[i].open, close: rows[i].closed ? '' : rows[i].close }]));
}

export const defaultHours = () => DAY_KEYS.map((_, i) => ({ closed: i === 6, open: '09:00', close: '19:00' }));

const mins = (s) => { const [h, m] = String(s).split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };

/** { open: bool, until?: 'HH:MM' } for now, or null when hours are unknown. */
export function openState(raw, now = new Date()) {
  const rows = readHours(raw);
  if (!rows) return null;
  const idx = (now.getDay() + 6) % 7;
  const cur = now.getHours() * 60 + now.getMinutes();
  const today = rows[idx];
  const yday = rows[(idx + 6) % 7];
  // Still inside yesterday's overnight slot (e.g. 20:00–02:00)?
  if (yday && !yday.closed && mins(yday.close) != null && mins(yday.close) < mins(yday.open) && cur < mins(yday.close)) return { open: true, until: yday.close };
  if (!today || today.closed || mins(today.open) == null || mins(today.close) == null) return { open: false };
  const o = mins(today.open);
  const c = mins(today.close);
  const inside = c > o ? cur >= o && cur < c : cur >= o || cur < c;
  return inside ? { open: true, until: today.close } : { open: false, opens: cur < o ? today.open : null };
}

export const dayLabel = (i) => t('date.weekdaysLong').split(',')[(i + 1) % 7];
