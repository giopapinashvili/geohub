/* ================================================================
   GeoHub — Production Analytics & Error Monitoring
   Self-initializing IIFE. Sets window.GeoAnalytics.
   Error handlers attach immediately; Firestore writes wait for GeoFirebaseReady.
   ================================================================ */
(function () {
  'use strict';

  var PAGE = (window.location.pathname.split('/').pop() || 'index.html').replace(/[^a-zA-Z0-9._-]/g, '_');
  var SESSION_START = Date.now();

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Skip analytics on admin/auth/private pages
  var SKIP_PAGES = ['admin.html', 'auth.html', 'onboarding.html'];
  if (SKIP_PAGES.indexOf(PAGE) !== -1) return;

  /* ── STATE ────────────────────────────────────────────────── */
  var _db = null;
  var _fs = null;
  var _uid = null;
  var _ready = false;
  var _errorBuffer = [];
  var _errHashes = {};
  var _errorCount = 0;
  var _MAX_ERRORS = 20;
  var _presenceTimer = null;

  /* ── HELPERS ─────────────────────────────────────────────── */
  function safeStr(v, max) {
    return String(v || '').slice(0, max || 120).replace(/[^\w\s.@\-:,]/g, '');
  }

  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < Math.min(s.length, 200); i++) {
      h = (Math.imul ? Math.imul(31, h) : (31 * h | 0)) + s.charCodeAt(i) | 0;
    }
    return h;
  }

  function isExtensionError(src) {
    return src && (src.indexOf('chrome-extension://') !== -1 || src.indexOf('moz-extension://') !== -1);
  }

  /* ── CORE: increment a daily counter field ───────────────── */
  function incrDaily(subcol, key) {
    if (!_ready) return;
    try {
      var today = todayStr();
      var update = {};
      update[key] = _fs.increment(1);
      _fs.setDoc(_fs.doc(_db, 'analytics', subcol, 'daily', today), update, { merge: true }).catch(function () {});
    } catch (_) {}
  }

  /* ── PAGE VIEWS ──────────────────────────────────────────── */
  function trackPageView() {
    incrDaily('pageViews', PAGE);
    incrDaily('pageViews', '_total');
  }

  /* ── GENERIC EVENT ──────────────────────────────────────── */
  function trackEvent(category, action) {
    incrDaily('events', safeStr(category, 40) + '_' + safeStr(action, 60));
  }

  /* ── SEARCH ─────────────────────────────────────────────── */
  var _PII_RE = /[\w.+-]+@[\w-]+\.\w+|\+?\d[\d\s\-().]{8,}/g;
  function trackSearch(query, resultCount) {
    if (!_ready || !query) return;
    var q = String(query).replace(_PII_RE, '').trim().slice(0, 80).toLowerCase();
    if (!q) return;
    try {
      var today = todayStr();
      var update = { _count: _fs.increment(1) };
      update['t_' + q.replace(/[^a-z0-9]/g, '_').slice(0, 60)] = _fs.increment(1);
      _fs.setDoc(_fs.doc(_db, 'analytics', 'searches', 'daily', today), update, { merge: true }).catch(function () {});
    } catch (_) {}
  }

  /* ── ENGAGEMENT ─────────────────────────────────────────── */
  function trackEngagement(type, contentType) {
    trackEvent('engagement', safeStr(type, 30) + '_' + safeStr(contentType, 30));
  }

  function trackNotificationEngagement(type, action) {
    trackEvent('notification', safeStr(type, 40) + '_' + safeStr(action, 40));
  }

  /* ── UPLOAD FAILURES ─────────────────────────────────────── */
  function trackUploadFailure(uploadType, reason) {
    if (!_ready) return;
    try {
      _fs.addDoc(_fs.collection(_db, 'analytics', 'uploads', 'failures'), {
        type: safeStr(uploadType, 40),
        reason: safeStr(reason, 120),
        page: PAGE,
        uid: _uid || null,
        timestamp: _fs.serverTimestamp()
      }).catch(function () {});
    } catch (_) {}
  }

  /* ── ERROR TRACKING ──────────────────────────────────────── */
  function _sendError(msg, src, line, col, errObj) {
    if (!_ready) {
      _errorBuffer.push([msg, src, line, col, errObj]);
      return;
    }
    try {
      var stack = (errObj && errObj.stack) ? String(errObj.stack).slice(0, 500) : '';
      _fs.addDoc(_fs.collection(_db, 'analytics', 'errors', 'log'), {
        message: safeStr(msg, 200),
        source: safeStr(src, 200),
        line: line || 0,
        col: col || 0,
        stack: stack,
        page: PAGE,
        uid: _uid || null,
        ua: navigator.userAgent.slice(0, 120),
        timestamp: _fs.serverTimestamp()
      }).catch(function () {});
      incrDaily('errors', 'count');
    } catch (_) {}
  }

  function trackError(msg, src, line, col, errObj) {
    if (!msg || msg === 'Script error.' || isExtensionError(src)) return;
    if (_errorCount >= _MAX_ERRORS) return;
    var h = hashStr(String(msg) + String(src) + String(line));
    var now = Date.now();
    if (_errHashes[h] && now - _errHashes[h] < 60000) return;
    _errHashes[h] = now;
    _errorCount++;
    _sendError(msg, src, line, col, errObj);
  }

  function _flushErrors() {
    var buf = _errorBuffer.splice(0);
    buf.forEach(function (args) { _sendError.apply(null, args); });
  }

  /* ── PRESENCE ────────────────────────────────────────────── */
  function _updatePresence() {
    if (!_ready || !_uid) return;
    try {
      _fs.setDoc(_fs.doc(_db, 'analytics', 'presence', 'users', _uid), {
        page: PAGE,
        uid: _uid,
        lastSeen: _fs.serverTimestamp()
      }, { merge: true }).catch(function () {});
    } catch (_) {}
  }

  function _startPresence() {
    _updatePresence();
    if (_presenceTimer) clearInterval(_presenceTimer);
    _presenceTimer = setInterval(_updatePresence, 2 * 60 * 1000);
  }

  /* ── PERFORMANCE ─────────────────────────────────────────── */
  function _sendPerf(metrics) {
    if (!_ready) return;
    try {
      var update = { samples: _fs.increment(1) };
      if (metrics.ttfb)     { update.sum_ttfb     = _fs.increment(Math.round(metrics.ttfb)); }
      if (metrics.domLoad)  { update.sum_domLoad  = _fs.increment(Math.round(metrics.domLoad)); }
      if (metrics.total)    { update.sum_total     = _fs.increment(Math.round(metrics.total)); }
      if (metrics.lcp)      { update.sum_lcp       = _fs.increment(Math.round(metrics.lcp)); }
      _fs.setDoc(_fs.doc(_db, 'analytics', 'performance', 'pages', PAGE), update, { merge: true }).catch(function () {});
    } catch (_) {}
  }

  function _trackPerformance() {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav) {
        _sendPerf({
          ttfb: nav.responseStart - nav.requestStart,
          domLoad: nav.domContentLoadedEventEnd - nav.startTime,
          total: nav.loadEventEnd - nav.startTime
        });
      }
    } catch (_) {}

    try {
      if (window.PerformanceObserver) {
        var po = new PerformanceObserver(function (list) {
          var entries = list.getEntries();
          if (entries.length) {
            var lcp = entries[entries.length - 1].startTime;
            _sendPerf({ lcp: lcp });
          }
          po.disconnect();
        });
        po.observe({ type: 'largest-contentful-paint', buffered: true });
      }
    } catch (_) {}
  }

  /* ── INIT ────────────────────────────────────────────────── */
  function _init() {
    var geo = window.GeoFirebase;
    if (!geo || !geo.db || !geo.fs) return;
    _db = geo.db;
    _fs = geo.fs;
    _ready = true;

    var user = (geo.auth && geo.auth.currentUser) ||
               (window.GeoAuth && window.GeoAuth.getCurrentUser && window.GeoAuth.getCurrentUser());
    if (user && user.uid) _uid = user.uid;

    _flushErrors();
    trackPageView();
    _startPresence();
    setTimeout(_trackPerformance, 3000);

    if (geo.authFns && geo.authFns.onAuthStateChanged) {
      geo.authFns.onAuthStateChanged(geo.auth, function (u) {
        _uid = u ? u.uid : null;
        if (u) _updatePresence();
      });
    }
  }

  /* ── GLOBAL ERROR HANDLERS (set up before Firebase ready) ── */
  window.onerror = (function (prev) {
    return function (msg, src, line, col, err) {
      trackError(msg, src, line, col, err);
      if (prev) return prev.apply(this, arguments);
      return false;
    };
  })(window.onerror);

  window.addEventListener('unhandledrejection', function (ev) {
    var reason = ev.reason;
    var msg = reason instanceof Error ? reason.message : String(reason || 'Unhandled rejection');
    trackError(msg, PAGE, 0, 0, reason instanceof Error ? reason : null);
  });

  /* ── EXPOSE PUBLIC API ──────────────────────────────────── */
  window.GeoAnalytics = {
    trackPageView: trackPageView,
    trackEvent: trackEvent,
    trackSearch: trackSearch,
    trackEngagement: trackEngagement,
    trackNotificationEngagement: trackNotificationEngagement,
    trackUploadFailure: trackUploadFailure,
    trackError: trackError
  };

  /* ── BOOT ────────────────────────────────────────────────── */
  if (window.GeoFirebase && window.GeoFirebase.db) {
    _init();
  } else {
    window.addEventListener('GeoFirebaseReady', _init, { once: true });
  }

})();
