/* content-pages.js — GeoHub shared content-page module
   Drives: events, creators, real-estate, live, learning, services
   Requires: window.GeoFirebase (fires GeoFirebaseReady when ready)
*/
(function () {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────────── */
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function fmtDate(raw) {
    if (!raw) return '';
    var d;
    if (raw && typeof raw.toDate === 'function') {
      d = raw.toDate();
    } else if (typeof raw === 'number') {
      d = new Date(raw);
    } else if (raw && typeof raw === 'object' && raw.seconds) {
      d = new Date(raw.seconds * 1000);
    } else {
      d = new Date(raw);
    }
    if (isNaN(d.getTime())) return '';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function snippet(str, len) {
    if (!str) return '';
    str = String(str);
    if (str.length <= len) return esc(str);
    return esc(str.slice(0, len)) + '&hellip;';
  }

  function initials(name) {
    if (!name) return '?';
    var parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /* ── page configs ─────────────────────────────────────────────── */
  var PAGE_CONFIGS = {
    'page-creators': {
      collection: 'creators',
      label: 'Creators'
    },
    'page-real-estate': {
      collection: 'realEstateListings',
      label: 'Listings'
    },
    'page-live': {
      collection: 'liveActivity',
      label: 'Activities'
    },
    'page-learning': {
      collection: 'learningItems',
      label: 'Lessons'
    },
    'page-services': {
      collection: 'services',
      label: 'Services'
    }
  };

  /* ── card renderers ───────────────────────────────────────────── */
  function renderEvent(d) {
    var rawDate = d.date || d.startDate;
    var dateStr = fmtDate(rawDate);
    var loc = esc(d.venue || d.city || d.location || '');
    var isFree = d.price === 0 || d.price === '0' || d.free === true || d.price === 'free';
    var priceLabel = isFree ? 'Free' : (d.price ? esc(String(d.price)) : '');
    var priceBadge = priceLabel
      ? '<span class="cp-badge cp-badge-green">' + priceLabel + '</span>'
      : '';
    return '<div class="cp-card">' +
      '<div class="cp-card-head">' +
        '<span class="cp-badge cp-badge-blue">' + esc(d.category || 'Event') + '</span>' +
        priceBadge +
      '</div>' +
      '<div class="cp-card-title">' + esc(d.title || d.name || '') + '</div>' +
      (d.description ? '<div class="cp-card-desc">' + snippet(d.description, 80) + '</div>' : '') +
      '<div class="cp-card-meta">' +
        (dateStr ? '<span><i class="fa fa-calendar"></i>' + dateStr + '</span>' : '') +
        (loc ? '<span><i class="fa fa-map-marker"></i>' + loc + '</span>' : '') +
      '</div>' +
    '</div>';
  }

  function renderCreator(d) {
    var name = esc(d.name || d.displayName || '');
    var imgUrl = d.imageUrl || d.image || d.photoUrl || '';
    var avatarInner = imgUrl
      ? '<img class="cp-av-img" src="' + esc(imgUrl) + '" alt="' + name + '">'
      : initials(d.name || d.displayName || '');
    var niche = esc(d.niche || d.category || 'Creator');
    var followers = d.followersCount || d.followers || 0;
    var city = esc(d.city || '');
    return '<div class="cp-card">' +
      '<div class="cp-card-avatar">' + avatarInner + '</div>' +
      '<div class="cp-card-head">' +
        '<span class="cp-badge cp-badge-purple">' + niche + '</span>' +
      '</div>' +
      '<div class="cp-card-title">' + name + '</div>' +
      (d.description ? '<div class="cp-card-desc">' + snippet(d.description, 80) + '</div>' : '') +
      '<div class="cp-card-meta">' +
        (followers ? '<span><i class="fa fa-users"></i>' + compact(followers) + '</span>' : '') +
        (city ? '<span><i class="fa fa-map-marker"></i>' + city + '</span>' : '') +
      '</div>' +
    '</div>';
  }

  function renderRealEstate(d) {
    var type = String(d.listingType || d.type || '').toLowerCase();
    var typeBadgeClass = type === 'rent' ? 'cp-badge-blue' : 'cp-badge-green';
    var typeLabel = esc(d.listingType || d.type || 'Listing');
    var price = d.price || d.pricePerMonth || d.pricePerNight || '';
    var priceStr = price
      ? '<div class="cp-card-price">&#x20BE;' + Number(price).toLocaleString() + '</div>'
      : '';
    var area = d.area || d.size || '';
    var beds = d.bedrooms || d.beds || '';
    var addr = esc(d.address || d.city || '');
    return '<div class="cp-card">' +
      '<div class="cp-card-head">' +
        '<span class="cp-badge ' + typeBadgeClass + '">' + typeLabel + '</span>' +
      '</div>' +
      '<div class="cp-card-title">' + esc(d.title || d.name || '') + '</div>' +
      priceStr +
      (d.description ? '<div class="cp-card-desc">' + snippet(d.description, 80) + '</div>' : '') +
      '<div class="cp-card-meta">' +
        (area ? '<span><i class="fa fa-expand"></i>' + esc(String(area)) + ' m&sup2;</span>' : '') +
        (beds ? '<span><i class="fa fa-bed"></i>' + esc(String(beds)) + '</span>' : '') +
        (addr ? '<span><i class="fa fa-map-marker"></i>' + addr + '</span>' : '') +
      '</div>' +
    '</div>';
  }

  function renderLive(d) {
    var intensity = Math.min(5, Math.max(1, parseInt(d.intensity, 10) || 1));
    var bars = '';
    for (var i = 1; i <= 5; i++) {
      bars += '<span style="display:inline-block;width:6px;height:' + (6 + i * 3) + 'px;border-radius:2px;margin-right:2px;background:' + (i <= intensity ? '#10b981' : 'rgba(255,255,255,.1)') + '"></span>';
    }
    var alertType = esc(d.alertType || d.type || 'Live');
    var loc = esc(d.city || d.location || '');
    return '<div class="cp-card">' +
      '<div class="cp-card-head">' +
        '<span class="cp-badge cp-badge-orange">' + alertType + '</span>' +
        '<span style="display:inline-flex;align-items:flex-end;gap:0;margin-left:4px">' + bars + '</span>' +
      '</div>' +
      '<div class="cp-card-title">' + esc(d.title || d.name || '') + '</div>' +
      (d.description ? '<div class="cp-card-desc">' + snippet(d.description, 80) + '</div>' : '') +
      '<div class="cp-card-meta">' +
        (loc ? '<span><i class="fa fa-map-marker"></i>' + loc + '</span>' : '') +
      '</div>' +
    '</div>';
  }

  function renderLearning(d) {
    var subject = esc(d.subject || d.category || 'Learning');
    var isFree = d.price === 0 || d.price === '0' || d.free === true || d.price === 'free';
    var priceLabel = isFree ? 'Free' : (d.price ? esc(String(d.price)) : '');
    var priceBadge = priceLabel
      ? '<span class="cp-badge cp-badge-green">' + priceLabel + '</span>'
      : '';
    var teacher = esc(d.teacher || d.teacherName || d.instructor || '');
    var duration = esc(d.duration || '');
    var city = esc(d.city || '');
    return '<div class="cp-card">' +
      '<div class="cp-card-head">' +
        '<span class="cp-badge cp-badge-purple">' + subject + '</span>' +
        priceBadge +
      '</div>' +
      '<div class="cp-card-title">' + esc(d.title || d.name || '') + '</div>' +
      (teacher ? '<div class="cp-card-sub"><i class="fa fa-user-tie"></i>' + teacher + '</div>' : '') +
      (d.description ? '<div class="cp-card-desc">' + snippet(d.description, 80) + '</div>' : '') +
      '<div class="cp-card-meta">' +
        (duration ? '<span><i class="fa fa-clock"></i>' + duration + '</span>' : '') +
        (city ? '<span><i class="fa fa-map-marker"></i>' + city + '</span>' : '') +
      '</div>' +
    '</div>';
  }

  function renderService(d) {
    var svcType = esc(d.serviceType || d.category || 'Service');
    var price = d.price || d.priceFrom || '';
    var priceStr = price ? ' from &#x20BE;' + esc(String(price)) : '';
    var loc = esc(d.city || d.location || '');
    var bizId = d.businessId || d.bizId || '';
    var bizName = esc(d.businessName || d.bizName || d.businessTitle || '');
    var cardOpen = bizId
      ? '<a class="cp-card cp-card-link" href="business.html?id=' + esc(bizId) + '">'
      : '<div class="cp-card">';
    var cardClose = bizId ? '</a>' : '</div>';
    return cardOpen +
      '<div class="cp-card-head">' +
        '<span class="cp-badge">' + svcType + '</span>' +
      '</div>' +
      '<div class="cp-card-title">' + esc(d.title || d.name || '') + '</div>' +
      (bizName ? '<div class="cp-card-sub"><i class="fa fa-store"></i>' + bizName + '</div>' : '') +
      (priceStr ? '<div class="cp-card-price">' + priceStr + '</div>' : '') +
      (d.description ? '<div class="cp-card-desc">' + snippet(d.description, 80) + '</div>' : '') +
      '<div class="cp-card-meta">' +
        (loc ? '<span><i class="fa fa-map-marker"></i>' + loc + '</span>' : '') +
        (bizId ? '<span class="cp-biz-link-chip"><i class="fa fa-store"></i>View Business</span>' : '') +
      '</div>' +
    cardClose;
  }

  var RENDERERS = {
    'page-creators': renderCreator,
    'page-real-estate': renderRealEstate,
    'page-live': renderLive,
    'page-learning': renderLearning,
    'page-services': renderService
  };

  /* ── CSS injection ───────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('cp-styles')) return;
    var s = document.createElement('style');
    s.id = 'cp-styles';
    s.textContent = [
      '.cp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;width:100%}',
      '.cp-card{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px;transition:all .2s;cursor:default}',
      '.cp-card:hover{border-color:rgba(16,185,129,.3);transform:translateY(-2px);background:rgba(255,255,255,.06)}',
      '.cp-card-head{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}',
      '.cp-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:99px;font-size:.68rem;font-weight:800;background:rgba(255,255,255,.08);color:#94a3b8;text-transform:uppercase;letter-spacing:.03em}',
      '.cp-badge-blue{background:rgba(59,130,246,.15);color:#93c5fd}',
      '.cp-badge-green{background:rgba(16,185,129,.15);color:#6ee7b7}',
      '.cp-badge-purple{background:rgba(139,92,246,.15);color:#c4b5fd}',
      '.cp-badge-orange{background:rgba(249,115,22,.15);color:#fdba74}',
      '.cp-card-title{font-size:.98rem;font-weight:800;color:#f0f4ff;margin-bottom:6px}',
      '.cp-card-sub{font-size:.78rem;color:#64748b;margin-bottom:8px;display:flex;align-items:center;gap:5px}',
      '.cp-card-desc{font-size:.82rem;color:#94a3b8;line-height:1.55;margin-bottom:10px}',
      '.cp-card-price{font-size:1.1rem;font-weight:800;color:#10e0a0;margin-bottom:8px}',
      '.cp-card-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:.74rem;color:#4b5563}',
      '.cp-card-meta span{display:flex;align-items:center;gap:4px}',
      '.cp-card-meta i{color:#10b981}',
      '.cp-card-avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#10b981,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:.88rem;font-weight:800;color:#fff;margin-bottom:12px;overflow:hidden}',
      '.cp-av-img{width:100%;height:100%;object-fit:cover}',
      '.cp-card-link{display:block;text-decoration:none;color:inherit;cursor:pointer}',
      '.cp-card-link:hover{border-color:rgba(16,185,129,.4);background:rgba(16,185,129,.06)}',
      '.cp-biz-link-chip{display:inline-flex;align-items:center;gap:4px;color:#10b981;font-size:.72rem;font-weight:700}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── state ───────────────────────────────────────────────────── */
  var allItems = [];
  var currentPageKey = null;

  /* ── rendering ───────────────────────────────────────────────── */
  function renderItems(items) {
    var list = document.getElementById('cleanList');
    if (!list) return;
    if (!items || items.length === 0) {
      var _t = typeof GHt === 'function' ? GHt : function(k){return k;};
      list.innerHTML = '<div class="clean-empty">' +
        '<i class="fa fa-inbox fa-3x" style="margin-bottom:16px;color:#374151"></i>' +
        '<h3>' + _t('cp_nothing_yet') + '</h3>' +
        '<p>' + _t('cp_check_back') + '</p>' +
      '</div>';
      return;
    }
    var renderer = RENDERERS[currentPageKey];
    var html = '<div class="cp-grid">';
    for (var i = 0; i < items.length; i++) {
      html += renderer(items[i]);
    }
    html += '</div>';
    list.innerHTML = html;
  }

  function updateCount(n) {
    var el = document.getElementById('stat-total');
    if (el) el.textContent = n;
  }

  /* ── search ──────────────────────────────────────────────────── */
  function matchesSearch(item, term) {
    if (!term) return true;
    term = term.toLowerCase();
    var fields = [
      item.title, item.name, item.displayName,
      item.city, item.location, item.description,
      item.address, item.venue, item.niche, item.category,
      item.subject, item.teacher, item.teacherName, item.serviceType
    ];
    for (var i = 0; i < fields.length; i++) {
      if (fields[i] && String(fields[i]).toLowerCase().indexOf(term) !== -1) {
        return true;
      }
    }
    return false;
  }

  function wireSearch() {
    var searchInput = document.querySelector('.clean-search input');
    if (!searchInput) return;
    searchInput.addEventListener('input', function () {
      var term = searchInput.value;
      var filtered = [];
      for (var i = 0; i < allItems.length; i++) {
        if (matchesSearch(allItems[i], term)) {
          filtered.push(allItems[i]);
        }
      }
      renderItems(filtered);
      updateCount(filtered.length);
    });
  }

  /* ── data loading ────────────────────────────────────────────── */
  function loadData() {
    var cfg = PAGE_CONFIGS[currentPageKey];
    if (!cfg) return;

    var fs = window.GeoFirebase.fs;
    var db = window.GeoFirebase.db;

    var getDocs = fs.getDocs;
    var query = fs.query;
    var collection = fs.collection;
    var where = fs.where;
    var limit = fs.limit;

    var colRef = collection(db, cfg.collection);

    function handleDocs(snapshot) {
      allItems = [];
      snapshot.forEach(function (docSnap) {
        var d = docSnap.data();
        d._id = docSnap.id;
        allItems.push(d);
      });
      updateCount(allItems.length);
      renderItems(allItems);
      wireSearch();
    }

    function fallbackLoad() {
      getDocs(query(colRef, limit(100))).then(function (snapshot) {
        var filtered = [];
        snapshot.forEach(function (docSnap) {
          var d = docSnap.data();
          d._id = docSnap.id;
          if (d.status !== 'inactive') {
            filtered.push(d);
          }
        });
        allItems = filtered;
        updateCount(allItems.length);
        renderItems(allItems);
        wireSearch();
      }).catch(function (err) {
        console.error('[content-pages] fallback load failed for ' + cfg.collection, err);
        renderItems([]);
      });
    }

    try {
      var q = query(colRef, where('status', '==', 'active'), limit(100));
      getDocs(q).then(function (snapshot) {
        handleDocs(snapshot);
      }).catch(function () {
        fallbackLoad();
      });
    } catch (e) {
      fallbackLoad();
    }
  }

  /* ── detect page ─────────────────────────────────────────────── */
  function detectPage() {
    var body = document.body;
    if (!body) return null;
    var keys = Object.keys(PAGE_CONFIGS);
    for (var i = 0; i < keys.length; i++) {
      if (body.classList.contains(keys[i])) {
        return keys[i];
      }
    }
    return null;
  }

  /* ── init ────────────────────────────────────────────────────── */
  function init() {
    currentPageKey = detectPage();
    if (!currentPageKey) return;

    injectStyles();

    if (window.GeoFirebase && window.GeoFirebase.db) {
      loadData();
    } else {
      window.addEventListener('GeoFirebaseReady', function () {
        loadData();
      }, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
