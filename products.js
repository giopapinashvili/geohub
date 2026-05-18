/* GeoHub — Products Directory (Phase 53)
   Reads products from businesses/{id}/services subcollections
   where type === 'product'.  All data is real Firestore data.
*/
(function () {
  'use strict';

  var allProducts = [];
  var filterCat  = 'all';
  var filterCity = 'all';
  var filterQ    = '';

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── filters ─────────────────────────────────────────────── */

  function buildFilters(cats, cities) {
    var catRow = document.getElementById('pdCatFilterRow');
    if (catRow) {
      if (!cats.length) {
        catRow.innerHTML = '<span style="color:#4b5563;font-size:.8rem">No categories yet</span>';
      } else {
        var html = '<button class="pd-filter-btn active" data-cat="all">All</button>';
        cats.forEach(function (cat) {
          html += '<button class="pd-filter-btn" data-cat="' + esc(cat) + '">' + esc(cat) + '</button>';
        });
        catRow.innerHTML = html;
        catRow.onclick = function (e) {
          var btn = e.target.closest('[data-cat]');
          if (!btn) return;
          filterCat = btn.dataset.cat;
          catRow.querySelectorAll('[data-cat]').forEach(function (b) { b.classList.toggle('active', b === btn); });
          applyFilters();
        };
      }
    }

    var cityWrap   = document.getElementById('pdCityWrap');
    var citySelect = document.getElementById('pdCityFilter');
    if (cityWrap && citySelect && cities.length > 1) {
      var opts = '<option value="all">All cities</option>';
      cities.forEach(function (c) { opts += '<option value="' + esc(c) + '">' + esc(c) + '</option>'; });
      citySelect.innerHTML = opts;
      citySelect.onchange  = function () { filterCity = citySelect.value; applyFilters(); };
      cityWrap.style.display = '';
    }
  }

  /* ── filter + render ──────────────────────────────────────── */

  function applyFilters() {
    var q = filterQ.toLowerCase().trim();
    var filtered = allProducts.filter(function (p) {
      if (filterCat  !== 'all' && (p.category || '') !== filterCat)  return false;
      if (filterCity !== 'all' && (p.businessCity || '') !== filterCity) return false;
      if (q) {
        var hay = [p.title, p.description, p.category, p.businessName, p.businessCity].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    renderCards(filtered);
    var el = document.getElementById('stat-total');
    if (el) el.textContent = filtered.length;
  }

  /* ── card HTML ────────────────────────────────────────────── */

  function productCard(p) {
    var title   = esc(p.title || p.name || 'Product');
    var bizName = esc(p.businessName || '');
    var cat     = esc(p.category || '');
    var city    = esc(p.businessCity || '');
    var price   = p.price ? esc(String(p.price)) + ' ' + esc(p.currency || 'GEL') : '';
    var desc    = p.description
      ? esc(p.description.slice(0, 120)) + (p.description.length > 120 ? '…' : '')
      : '';
    var imgHtml = p.imageUrl
      ? '<div class="pd-card-img"><img src="' + esc(p.imageUrl) + '" alt="' + title + '" loading="lazy" onerror="this.closest(\'.pd-card-img\').style.display=\'none\'"></div>'
      : '';
    var bizUrl  = 'business.html?id=' + encodeURIComponent(p.businessId || '');
    var askUrl  = bizUrl + '#services';
    var featBadge = p.featured ? '<span class="pd-badge pd-badge-featured"><i class="fas fa-star"></i> Featured</span>' : '';

    return '<div class="pd-card">' +
      imgHtml +
      '<div class="pd-card-body">' +
        '<div class="pd-card-badges">' +
          featBadge +
          (cat   ? '<span class="pd-badge pd-badge-cat">'   + cat   + '</span>' : '') +
          (price ? '<span class="pd-badge pd-badge-price">' + price + '</span>' : '') +
        '</div>' +
        '<div class="pd-card-title">' + title + '</div>' +
        (bizName ? '<div class="pd-card-biz"><i class="fas fa-store"></i>' + bizName + '</div>' : '') +
        (city    ? '<div class="pd-card-city"><i class="fas fa-map-marker-alt"></i>' + city + '</div>' : '') +
        (desc    ? '<div class="pd-card-desc">' + desc + '</div>' : '') +
        '<div class="pd-card-actions">' +
          '<a href="' + esc(bizUrl) + '" class="pd-btn pd-btn-ghost"><i class="fas fa-store"></i> View Business</a>' +
          '<a href="' + esc(askUrl) + '" class="pd-btn pd-btn-primary"><i class="fas fa-comment-dots"></i> Ask about It</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── render ───────────────────────────────────────────────── */

  function renderCards(items) {
    var list = document.getElementById('cleanList');
    if (!list) return;
    if (!items || !items.length) {
      var msg = allProducts.length > 0
        ? 'No products match your filters.'
        : 'No products yet. Business owners can add products from their business dashboard.';
      list.style.display = 'flex';
      list.innerHTML =
        '<div class="clean-empty" style="width:100%"><div>' +
          '<i class="fas fa-box" style="font-size:2rem;color:#374151;display:block;margin-bottom:12px"></i>' +
          '<h3 style="color:#f8fafc;margin:0 0 8px">' + esc(msg) + '</h3>' +
        '</div></div>';
      return;
    }
    list.style.display = '';
    list.innerHTML = '<div class="pd-grid">' + items.map(productCard).join('') + '</div>';
  }

  /* ── data loading ─────────────────────────────────────────── */

  function loadData(fs, db) {
    // Step 1: up to 50 non-deleted businesses
    fs.getDocs(fs.query(fs.collection(db, 'businesses'), fs.limit(50)))
      .then(function (bizSnap) {
        var bizList = [];
        bizSnap.forEach(function (d) {
          var data = d.data();
          if (data.status === 'deleted' || data.deleted === true || !!data.deletedAt) return;
          bizList.push({
            id:      d.id,
            title:   data.title || data.name || 'Business',
            city:    data.city  || '',
            logoUrl: data.logoUrl || ''
          });
        });
        // Step 2: read services subcollection per business in parallel
        return Promise.all(bizList.map(function (biz) {
          return fs.getDocs(fs.collection(db, 'businesses', biz.id, 'services'))
            .then(function (sSnap) {
              var prods = [];
              sSnap.forEach(function (d) {
                var s = Object.assign({ id: d.id }, d.data());
                if (s.type !== 'product') return;   // products only
                if (s.active === false) return;      // skip inactive
                prods.push(Object.assign({}, s, {
                  businessId:   biz.id,
                  businessName: biz.title,
                  businessCity: biz.city,
                  businessLogo: biz.logoUrl
                }));
              });
              return prods;
            })
            .catch(function () { return []; });
        }));
      })
      .then(function (nested) {
        allProducts = [].concat.apply([], nested);
        // Featured first, then alphabetical by business name
        allProducts.sort(function (a, b) {
          if (!!b.featured !== !!a.featured) return b.featured ? 1 : -1;
          return (a.businessName || '').localeCompare(b.businessName || '');
        });
        var catSet = {}, citySet = {};
        allProducts.forEach(function (p) {
          if (p.category)    catSet[p.category]    = true;
          if (p.businessCity) citySet[p.businessCity] = true;
        });
        buildFilters(Object.keys(catSet).sort(), Object.keys(citySet).sort());
        applyFilters();
      })
      .catch(function (err) {
        console.error('[products-dir] load failed', err);
        renderCards([]);
      });
  }

  /* ── init ─────────────────────────────────────────────────── */

  function init() {
    var searchInput = document.getElementById('pdSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function () { filterQ = searchInput.value; applyFilters(); });
    }
    var searchBtn = document.querySelector('.clean-search button');
    if (searchBtn) {
      searchBtn.onclick = function () { filterQ = searchInput ? searchInput.value : ''; applyFilters(); };
    }

    function doLoad() {
      var gf = window.GeoFirebase;
      if (gf && gf.fs && gf.db) loadData(gf.fs, gf.db);
    }

    if (window.GeoFirebase && window.GeoFirebase.db) { doLoad(); }
    else { window.addEventListener('GeoFirebaseReady', doLoad, { once: true }); }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
}());
