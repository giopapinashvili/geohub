/* ═══════════════════════════════════════════════════════════════════════════
   GeoHub — admin → site bridge
   ───────────────────────────────────────────────────────────────────────────
   The admin panel wrote settings that nothing on the site ever read:

     · adminFlags/*          feature toggles (rewards, events, live, ai,
                             camera, creators, patriot, maintenance) — written
                             by the toggle switches, read by nobody.
     · placeCategories/*     the category editor — read only by map.js, while
                             add-business and places used a hardcoded list.
     · siteSettings/global   did not exist at all.

   This module is loaded on every page. It reads those three, caches them so a
   repeat visit applies them instantly, and then actually acts on them.

   Exposes:
     window.GeoFlags       { rewards:true, events:false, … , maintenance:false }
     window.GeoSettings    { announcement, announcementLevel, featuredCity, … }
     window.GeoCatalog     { placeCategories:[…] }   admin list, else bundled
     events: 'GeoFlagsReady'  (fires once, with detail = {flags,settings})
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CACHE_KEY = 'gh_admin_bridge_v1';
  var CACHE_TTL = 5 * 60 * 1000;         // re-read at most every 5 minutes

  // Features the admin panel can switch off, and what they own on the site.
  // A flag missing from Firestore means "on" — the site never dark-launches
  // itself just because a document has not been written yet.
  var FEATURE_TARGETS = {
    rewards:  ['[href*="rewards.html"]', '[data-feature="rewards"]'],
    events:   ['[href*="events.html"]', '[data-feature="events"]'],
    creators: ['[href*="creators.html"]', '[data-feature="creators"]'],
    patriot:  ['[href*="patriot.html"]', '[data-feature="patriot"]'],
    ai:       ['[href*="assistant.html"]', '[data-feature="ai"]'],
    camera:   ['[data-feature="camera"]'],
    live:     ['[data-go-live]', '.gh-live-nav-btn', '[data-feature="live"]'],
    market:   ['[href*="marketplace.html"]', '[data-feature="market"]'],
    jobs:     ['[href*="jobs.html"]', '[data-feature="jobs"]']
  };

  var flags = {};
  var settings = {};
  var catalog = { placeCategories: [] };

  function t(key, fallback) {
    try { return (typeof window.GHt === 'function' && window.GHt(key) !== key) ? window.GHt(key) : fallback; }
    catch (e) { return fallback; }
  }

  /* ── cache ─────────────────────────────────────────────────────────── */
  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || !c.at) return null;
      return c;
    } catch (e) { return null; }
  }
  function writeCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        at: Date.now(), flags: flags, settings: settings, cats: catalog.placeCategories
      }));
    } catch (e) {}
  }

  /* ── apply ─────────────────────────────────────────────────────────── */
  function hide(sel) {
    try {
      document.querySelectorAll(sel).forEach(function (el) {
        var row = el.closest('.gh-nav-item, .nav-item, li, .app-action-item') || el;
        row.setAttribute('data-gh-feature-off', '1');
        row.style.display = 'none';
      });
    } catch (e) {}
  }

  function applyFeatures() {
    Object.keys(FEATURE_TARGETS).forEach(function (f) {
      if (flags[f] === false) FEATURE_TARGETS[f].forEach(hide);
    });
  }

  function applyAnnouncement() {
    var msg = settings.announcement;
    if (!msg || typeof msg !== 'string' || !msg.trim()) return;
    if (document.getElementById('gh-admin-banner')) return;

    var level = (settings.announcementLevel || 'info').toLowerCase();
    var hue = level === 'warn' ? 'var(--ds-h-reward)'
            : level === 'alert' ? 'var(--ds-danger-solid, #b91c1c)'
            : 'var(--ds-accent)';
    var ink = level === 'warn' ? 'var(--ds-h-reward-on, #1f1400)' : '#fff';

    // A dismissal is remembered per message, so editing the text shows it again.
    var sig = 'gh_ann_' + String(msg).slice(0, 40).replace(/\W+/g, '_');
    try { if (localStorage.getItem(sig)) return; } catch (e) {}

    var bar = document.createElement('div');
    bar.id = 'gh-admin-banner';
    bar.setAttribute('role', 'status');
    // Fixed rather than sticky: several pages rebuild document.body after this
    // runs, and a banner that depended on being body's first child vanished.
    bar.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:9998;display:flex;align-items:center;gap:12px;' +
      'padding:11px 16px;font-size:.86rem;font-weight:600;line-height:1.45;' +
      'background:' + hue + ';color:' + ink + ';' +
      'box-shadow:0 -2px 14px rgba(0,0,0,.28);' +
      'padding-bottom:calc(11px + env(safe-area-inset-bottom, 0px));';
    var span = document.createElement('span');
    span.style.cssText = 'flex:1;min-width:0';
    span.textContent = msg;
    var x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', t('close', 'დახურვა'));
    x.textContent = '✕';
    x.style.cssText =
      'background:transparent;border:0;color:inherit;font-size:1rem;cursor:pointer;' +
      'padding:2px 6px;border-radius:6px;flex-shrink:0;opacity:.85';
    x.addEventListener('click', function () {
      bar.remove();
      try { localStorage.setItem(sig, '1'); } catch (e) {}
    });
    bar.appendChild(span); bar.appendChild(x);
    if (document.body) document.body.appendChild(bar);
  }

  function applyMaintenance(isAdmin) {
    if (flags.maintenance !== true || isAdmin) return;
    var page = (location.pathname.split('/').pop() || '').toLowerCase();
    // Never lock the operator out of the door.
    if (page === 'admin.html' || page === 'auth.html' || page === 'offline.html') return;
    if (document.getElementById('gh-maintenance')) return;

    var o = document.createElement('div');
    o.id = 'gh-maintenance';
    o.style.cssText =
      'position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:28px;' +
      'background:var(--ds-bg,#060a09);color:var(--ds-text,#e9f3ef);text-align:center;' +
      'font-family:inherit;';
    var box = document.createElement('div');
    box.style.cssText = 'max-width:44ch;display:grid;gap:12px;justify-items:center';
    box.innerHTML =
      '<div style="font-size:2.6rem;line-height:1">🛠️</div>' +
      '<h1 style="margin:0;font-size:1.4rem;font-weight:700">' +
        t('maint_title', 'ვმუშაობთ საიტზე') + '</h1>' +
      '<p style="margin:0;color:var(--ds-text-2,#a9c1b8);line-height:1.6">' +
        (settings.maintenanceMessage ||
         t('maint_body', 'GeoHub დროებით მიუწვდომელია ტექნიკური სამუშაოების გამო. მალე დავბრუნდებით.')) +
      '</p>';
    o.appendChild(box);
    if (document.body) document.body.appendChild(o);
  }

  function applyAll(isAdmin) {
    applyFeatures();
    applyAnnouncement();
    applyMaintenance(isAdmin);
    window.GeoFlags = flags;
    window.GeoSettings = settings;
    window.GeoCatalog = catalog;
    try {
      window.dispatchEvent(new CustomEvent('GeoFlagsReady', {
        detail: { flags: flags, settings: settings, catalog: catalog }
      }));
    } catch (e) {}
  }

  /* ── load ──────────────────────────────────────────────────────────── */
  function bundledCategories() {
    var list = window.GEOHUB_PLACE_CATEGORIES;
    return Array.isArray(list) ? list : [];
  }

  function fromFirestore() {
    var GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) return Promise.resolve(false);
    var fs = GF.fs, db = GF.db;

    var jobs = [
      fs.getDocs(fs.collection(db, 'adminFlags')).then(function (snap) {
        snap.forEach(function (d) {
          var x = d.data() || {};
          flags[d.id] = x.enabled !== false;
        });
      }).catch(function () {}),

      fs.getDoc(fs.doc(db, 'siteSettings', 'global')).then(function (snap) {
        if (snap && snap.exists()) settings = snap.data() || {};
      }).catch(function () {}),

      fs.getDocs(fs.collection(db, 'placeCategories')).then(function (snap) {
        var cats = [];
        snap.forEach(function (d) {
          var x = d.data() || {};
          if (x.active === false) return;
          cats.push({
            id: d.id,
            icon: x.icon || '📍',
            color: x.color || '',
            label: x.labelKa || x.labelEn || d.id,
            labelKa: x.labelKa || '',
            labelEn: x.labelEn || '',
            order: typeof x.order === 'number' ? x.order : (x.sortOrder || 999),
            subcategories: (x.subcategories || []).filter(function (sc) { return sc && sc.active !== false; })
          });
        });
        cats.sort(function (a, b) { return a.order - b.order; });
        if (cats.length) catalog.placeCategories = cats;
      }).catch(function () {})
    ];
    return Promise.all(jobs).then(function () { return true; });
  }

  function isAdminUser() {
    try {
      var u = window.GeoCurrentUser;
      return !!(u && (u.isAdmin || u.role === 'admin' || u.role === 'owner'));
    } catch (e) { return false; }
  }

  function boot() {
    // 1 — paint from cache immediately so a toggle never flashes on and off.
    var c = readCache();
    if (c) {
      flags = c.flags || {};
      settings = c.settings || {};
      catalog.placeCategories = (c.cats && c.cats.length) ? c.cats : bundledCategories();
    } else {
      catalog.placeCategories = bundledCategories();
    }
    applyAll(isAdminUser());

    // 2 — refresh from Firestore, unless the cache is still warm.
    if (c && (Date.now() - c.at) < CACHE_TTL) return;
    fromFirestore().then(function (ok) {
      if (!ok) return;
      if (!catalog.placeCategories.length) catalog.placeCategories = bundledCategories();
      writeCache();
      applyAll(isAdminUser());
    });
  }

  function start() {
    if (window.GeoFirebase !== undefined) boot();
    else window.addEventListener('GeoFirebaseReady', boot, { once: true });
  }

  // Pages whose shell replaces document.body would drop what we injected, so
  // re-assert once those shells report ready, and once more shortly after.
  function reassert() {
    if (!window.GeoFlags) return;
    applyFeatures();
    applyAnnouncement();
    applyMaintenance(isAdminUser());
  }
  window.addEventListener('GeoSocialReady', reassert);
  window.addEventListener('GeoAuthReady', reassert);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // Feature toggles hide nav items that some shells render late.
  setTimeout(reassert, 1200);
  setTimeout(reassert, 3000);
})();
