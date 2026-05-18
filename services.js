/* GeoHub — Services Directory (Phase 52)
   Reads services from businesses/{id}/services subcollections.
   All data is real Firestore data — no fake/demo content.
*/
(function () {
  'use strict';

  var allServices = [];
  var filterCat  = 'all';
  var filterCity = 'all';
  var filterQ    = '';

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── filters ───────────────────────────────────────────────────── */

  function buildFilters(cats, cities) {
    var catRow = document.getElementById('svCatFilterRow');
    if (catRow) {
      if (!cats.length) {
        catRow.innerHTML = '<span style="color:#4b5563;font-size:.8rem">No categories yet</span>';
      } else {
        var html = '<button class="sv-filter-btn active" data-cat="all">All</button>';
        cats.forEach(function (cat) {
          html += '<button class="sv-filter-btn" data-cat="' + esc(cat) + '">' + esc(cat) + '</button>';
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

    var cityWrap   = document.getElementById('svCityWrap');
    var citySelect = document.getElementById('svCityFilter');
    if (cityWrap && citySelect && cities.length > 1) {
      var opts = '<option value="all">All cities</option>';
      cities.forEach(function (c) { opts += '<option value="' + esc(c) + '">' + esc(c) + '</option>'; });
      citySelect.innerHTML = opts;
      citySelect.onchange  = function () { filterCity = citySelect.value; applyFilters(); };
      cityWrap.style.display = '';
    }
  }

  /* ── filter + render ───────────────────────────────────────────── */

  function applyFilters() {
    var q = filterQ.toLowerCase().trim();
    var filtered = allServices.filter(function (s) {
      if (filterCat  !== 'all' && (s.category || '') !== filterCat)  return false;
      if (filterCity !== 'all' && (s.businessCity || '') !== filterCity) return false;
      if (q) {
        var hay = [s.title, s.description, s.category, s.businessName, s.businessCity].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    renderCards(filtered);
    var el = document.getElementById('stat-total');
    if (el) el.textContent = filtered.length;
  }

  /* ── card HTML ─────────────────────────────────────────────────── */

  function serviceCard(s) {
    var title   = esc(s.title || s.name || 'Service');
    var bizName = esc(s.businessName || '');
    var cat     = esc(s.category || s.type || '');
    var city    = esc(s.businessCity || '');
    var price   = s.price ? esc(String(s.price)) + ' ' + esc(s.currency || 'GEL') : '';
    var desc    = s.description
      ? esc(s.description.slice(0, 110)) + (s.description.length > 110 ? '…' : '')
      : '';
    var imgHtml = s.imageUrl
      ? '<div class="sv-card-img"><img src="' + esc(s.imageUrl) + '" alt="' + title + '" loading="lazy" onerror="this.closest(\'.sv-card-img\').style.display=\'none\'"></div>'
      : '';
    var bizUrl  = 'business.html?id=' + encodeURIComponent(s.businessId || '');
    var reqUrl  = bizUrl + '#services';

    return '<div class="sv-card">' +
      imgHtml +
      '<div class="sv-card-body">' +
        '<div class="sv-card-badges">' +
          (cat   ? '<span class="sv-badge sv-badge-cat">'   + cat   + '</span>' : '') +
          (price ? '<span class="sv-badge sv-badge-price">' + price + '</span>' : '') +
        '</div>' +
        '<div class="sv-card-title">' + title + '</div>' +
        (bizName ? '<div class="sv-card-biz"><i class="fas fa-store"></i>' + bizName + '</div>' : '') +
        (city    ? '<div class="sv-card-city"><i class="fas fa-map-marker-alt"></i>' + city + '</div>' : '') +
        (desc    ? '<div class="sv-card-desc">' + desc + '</div>' : '') +
        '<div class="sv-card-actions">' +
          '<a href="' + esc(bizUrl) + '" class="sv-btn sv-btn-ghost"><i class="fas fa-store"></i> View Business</a>' +
          '<a href="' + esc(reqUrl) + '" class="sv-btn sv-btn-primary"><i class="fas fa-paper-plane"></i> Request</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── render ────────────────────────────────────────────────────── */

  function renderCards(items) {
    var list = document.getElementById('cleanList');
    if (!list) return;
    if (!items || !items.length) {
      var msg = allServices.length > 0
        ? 'No services match your filters.'
        : 'No services yet. Business owners can add services from their business dashboard.';
      list.style.display = 'flex';
      list.innerHTML =
        '<div class="clean-empty" style="width:100%"><div>' +
          '<i class="fas fa-briefcase" style="font-size:2rem;color:#374151;display:block;margin-bottom:12px"></i>' +
          '<h3 style="color:#f8fafc;margin:0 0 8px">' + esc(msg) + '</h3>' +
        '</div></div>';
      return;
    }
    list.style.display = '';
    list.innerHTML = '<div class="sv-grid">' + items.map(serviceCard).join('') + '</div>';
  }

  /* ── data loading ──────────────────────────────────────────────── */

  function loadData(fs, db) {
    // Step 1: read up to 50 non-deleted businesses
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
        // Step 2: read each business's services subcollection in parallel
        return Promise.all(bizList.map(function (biz) {
          return fs.getDocs(fs.collection(db, 'businesses', biz.id, 'services'))
            .then(function (sSnap) {
              var svcs = [];
              sSnap.forEach(function (d) {
                var s = Object.assign({ id: d.id }, d.data());
                if (s.active === false) return; // skip inactive
                svcs.push(Object.assign({}, s, {
                  businessId:   biz.id,
                  businessName: biz.title,
                  businessCity: biz.city,
                  businessLogo: biz.logoUrl
                }));
              });
              return svcs;
            })
            .catch(function () { return []; });
        }));
      })
      .then(function (nested) {
        allServices = [].concat.apply([], nested);
        // Sort: featured first, then by businessName for predictable ordering
        allServices.sort(function (a, b) {
          if (!!b.featured !== !!a.featured) return b.featured ? 1 : -1;
          return (a.businessName || '').localeCompare(b.businessName || '');
        });
        // Collect unique categories and cities from real data
        var catSet = {}, citySet = {};
        allServices.forEach(function (s) {
          if (s.category)    catSet[s.category]    = true;
          if (s.businessCity) citySet[s.businessCity] = true;
        });
        buildFilters(Object.keys(catSet).sort(), Object.keys(citySet).sort());
        applyFilters();
      })
      .catch(function (err) {
        console.error('[services-dir] load failed', err);
        renderCards([]);
      });
  }

  /* ── init ──────────────────────────────────────────────────────── */

  function init() {
    var searchInput = document.getElementById('svSearchInput');
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
