// Minimal client router: history API, legacy-URL rewriting, scroll
// restoration and path params. Every same-origin <a href> is intercepted,
// so pages use plain links and still work when opened in a new tab.

import { signal, computed } from '@preact/signals';
import { appHref } from '../legacy.js';

function snapshot() {
  return { path: location.pathname.replace(/\/+$/, '') || '/', search: location.search, hash: location.hash };
}

export const loc = signal(snapshot());
export const path = computed(() => loc.value.path);
export const query = computed(() => new URLSearchParams(loc.value.search));

/* ── Scroll restoration ────────────────────────────────────── */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const scrolls = new Map();
let entryKey = history.state?.key || Math.random().toString(36).slice(2);
// idx counts in-app history depth so back() never leaves the site.
let entryIdx = history.state?.idx || 0;
if (!history.state?.key) history.replaceState({ ...(history.state || {}), key: entryKey, idx: entryIdx }, '');

function saveScroll() { scrolls.set(entryKey, window.scrollY); }

function restoreScroll(key, hash) {
  requestAnimationFrame(() => {
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) { el.scrollIntoView({ block: 'start' }); return; }
    }
    window.scrollTo(0, scrolls.get(key) || 0);
  });
}

/* ── Navigation ────────────────────────────────────────────── */
const listeners = new Set();
/** Called before each navigation; return false to cancel (unsaved changes). */
export function onBeforeNavigate(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function navigate(to, { replace = false, keepScroll = false } = {}) {
  const href = appHref(to);
  if (/^https?:/i.test(href)) { location.href = href; return; }
  for (const fn of listeners) if (fn(href) === false) return;
  const current = location.pathname + location.search + location.hash;
  if (href === current && !replace) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  saveScroll();
  const key = Math.random().toString(36).slice(2);
  if (replace) history.replaceState({ key, idx: entryIdx }, '', href);
  else history.pushState({ key, idx: ++entryIdx }, '', href);
  entryKey = key;
  loc.value = snapshot();
  if (!keepScroll) restoreScroll(key, location.hash);
}

/** Replace only the query string (tabs, filters) without adding history. */
export function setQuery(params, { push = false } = {}) {
  const q = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  const href = location.pathname + (s ? `?${s}` : '') + location.hash;
  if (push) history.pushState({ key: entryKey, idx: ++entryIdx }, '', href);
  else history.replaceState({ ...(history.state || {}), key: entryKey, idx: entryIdx }, '', href);
  loc.value = snapshot();
}

export function back(fallback = '/') {
  if (entryIdx > 0) history.back();
  else navigate(fallback, { replace: true });
}

window.addEventListener('popstate', (e) => {
  saveScroll();
  entryKey = e.state?.key || entryKey;
  entryIdx = e.state?.idx || 0;
  const fixed = appHref(location.pathname + location.search + location.hash);
  if (fixed !== location.pathname + location.search + location.hash) history.replaceState({ key: entryKey, idx: entryIdx }, '', fixed);
  loc.value = snapshot();
  restoreScroll(entryKey, location.hash);
});

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.composedPath().find((el) => el.tagName === 'A');
  if (!a || !a.href || a.hasAttribute('download') || a.dataset.native !== undefined) return;
  if (a.target && a.target !== '_self') return;
  const raw = a.getAttribute('href');
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
  const url = new URL(a.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/__/')) return;
  e.preventDefault();
  navigate(url.pathname + url.search + url.hash);
});

/* ── Matching ──────────────────────────────────────────────── */
/** Match "/u/:id" style patterns; ":x?" optional, "*" rest. */
export function match(pattern, pathname) {
  const p = pattern.split('/').filter(Boolean);
  const u = pathname.split('/').filter(Boolean);
  const params = {};
  for (let i = 0; i < Math.max(p.length, u.length); i++) {
    const seg = p[i];
    if (seg === '*') { params.rest = u.slice(i).join('/'); return params; }
    if (seg === undefined) return null;
    if (seg.startsWith(':')) {
      const optional = seg.endsWith('?');
      const name = seg.slice(1, optional ? -1 : undefined);
      if (u[i] === undefined) { if (optional) continue; return null; }
      try { params[name] = decodeURIComponent(u[i]); } catch { params[name] = u[i]; }
      continue;
    }
    if (seg !== u[i]) return null;
  }
  return params;
}
