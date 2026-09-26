import { signal, computed, effect } from '@preact/signals';
import ka from '../i18n/ka.js';
import en from '../i18n/en.js';
import ru from '../i18n/ru.js';

const DICTS = { ka, en, ru };
export const LANGS = [
  { code: 'ka', label: 'ქართული' },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
];
const LOCALES = { ka: 'ka-GE', en: 'en-GB', ru: 'ru-RU' };

function initial() {
  try {
    const v = localStorage.getItem('gh_lang');
    if (v && DICTS[v]) return v;
  } catch { /* ignore */ }
  return 'ka';
}

export const lang = signal(initial());
export const locale = computed(() => LOCALES[lang.value]);

effect(() => {
  document.documentElement.setAttribute('lang', lang.value);
  try { localStorage.setItem('gh_lang', lang.value); } catch { /* ignore */ }
});

export function setLang(code) { if (DICTS[code]) lang.value = code; }

function lookup(key) {
  const d = DICTS[lang.value];
  if (d[key] != null) return d[key];
  if (ka[key] != null) return ka[key];
  if (import.meta.env.DEV) console.warn('[i18n] missing', key);
  return key;
}

function fill(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m));
}

/** Translate `key`, interpolating `{name}` placeholders from `params`. */
export function t(key, params) {
  // Reading lang.value subscribes the calling component to language changes.
  void lang.value;
  return fill(lookup(key), params);
}

const pluralRules = {};
/**
 * Pluralised translation. Looks up `key.one`, `key.few`, `key.many`,
 * `key.other` by the current language's plural rules, then `key`.
 * Georgian nouns stay singular after numerals, so ka usually defines `key`.
 */
export function tn(key, n, params) {
  const l = lang.value;
  const rules = pluralRules[l] || (pluralRules[l] = new Intl.PluralRules(LOCALES[l]));
  const form = rules.select(n);
  const d = DICTS[l];
  const str = d[`${key}.${form}`] ?? d[`${key}.other`] ?? d[key] ?? ka[key] ?? key;
  return fill(str, { n: formatCount(n), ...params });
}

/** Compact counts: 950, 1,2 ათ., 3,4 მლნ — independent of browser locale data. */
export function formatCount(n) {
  n = Math.max(0, Number(n) || 0);
  if (n < 1000) return String(Math.round(n));
  const [v, unit] = n >= 1e6 ? [n / 1e6, lookup('num.million')] : [n / 1e3, lookup('num.thousand')];
  const s = (v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, ''));
  return `${lang.value === 'en' ? s : s.replace('.', ',')}${lang.value === 'en' ? '' : ' '}${unit}`;
}

export function formatNumber(n) {
  const s = String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, lang.value === 'en' ? ',' : '\u00a0');
  return s;
}
