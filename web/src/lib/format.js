import { lang, t, formatNumber } from './i18n.js';

export function tsToMillis(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const p = Date.parse(v);
  return Number.isNaN(p) ? 0 : p;
}

/** Short relative time: "ახლახან", "5 წთ", "3 სთ", "2 დღე", then a date. */
export function timeAgo(v) {
  void lang.value;
  const ms = tsToMillis(v);
  if (!ms) return '';
  const diff = Math.max(0, Date.now() - ms);
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('time.now');
  if (m < 60) return t('time.min', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('time.hour', { n: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t('time.day', { n: d });
  return formatDate(ms, { withYear: new Date(ms).getFullYear() !== new Date().getFullYear() });
}

const pad = (n) => String(n).padStart(2, '0');

/** Month names come from the dictionaries: some browsers ship no Georgian locale data. */
function months(short) {
  return t(short ? 'date.monthsShort' : 'date.months').split(',');
}

export function formatDate(v, { withYear = true, withTime = false, weekday = false, short = false } = {}) {
  const ms = tsToMillis(v);
  if (!ms) return '';
  const d = new Date(ms);
  let out = `${d.getDate()} ${months(short)[d.getMonth()]}`;
  if (withYear) out += ` ${d.getFullYear()}`;
  if (weekday) out = `${t('date.weekdays').split(',')[d.getDay()]}, ${out}`;
  if (withTime) out += `, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return out;
}

export function monthShort(v) {
  const ms = tsToMillis(v);
  return ms ? months(true)[new Date(ms).getMonth()] : '';
}

export function formatTime(v) {
  const ms = tsToMillis(v);
  if (!ms) return '';
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatPrice(amount, currency = 'GEL') {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return t('common.free');
  const whole = Math.trunc(n);
  const frac = Math.round((n - whole) * 100);
  const s = formatNumber(whole) + (frac ? (lang.value === 'en' ? '.' : ',') + String(frac).padStart(2, '0') : '');
  return currency === 'GEL' ? `${s} ₾` : `${s} ${currency}`;
}

// String#toUpperCase turns Mkhedruli into Mtavruli, which FiraGO lacks.
const GEORGIAN = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/;
function upper(c) { return GEORGIAN.test(c) ? c : c.toUpperCase(); }

/** Initials for avatar fallbacks — Georgian letters are left as they are. */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const a = Array.from(parts[0])[0] || '';
  const b = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] || '' : '';
  return upper(a) + upper(b);
}

export function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

export function pluralKey(n) { return n === 1 ? 'one' : 'other'; }
