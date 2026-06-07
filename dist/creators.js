(function () {
  'use strict';

  var state = { all: [], search: '', catFilter: '' };
  // Parallel array matching sidebar buttons — indices used in onclick to avoid
  // injecting user-controlled strings into JS attribute context.
  var _catList = [];

  function $(sel) { return document.querySelector(sel); }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Only allow absolute http/https URLs in link hrefs to block javascript: XSS.
  function safeUrl(s) {
    var u = String(s || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }

  function whenFirebase(cb) {
    if (window.GeoFirebase && window.GeoFirebase.db) { cb(window.GeoFirebase); return; }
    window.addEventListener('GeoFirebaseReady', function () { cb(window.GeoFirebase); }, { once: true });
  }

  function avatarHtml(url, name) {
    var safeImg = safeUrl(url);
    if (safeImg) return '<img src="' + esc(safeImg) + '" onerror="this.src=\'icons/icon-192.png\'" alt="' + esc(name) + '" class="cr-avatar-img">';
    var initial = (name || '?').trim()[0].toUpperCase();
    return '<span class="cr-avatar-initials">' + esc(initial) + '</span>';
  }

  function socialIcons(links, website) {
    links = links || {};
    var html = '';
    if (links.instagram) {
      var igHandle = String(links.instagram).replace(/^@/, '');
      html += '<a href="https://instagram.com/' + encodeURIComponent(igHandle) + '" target="_blank" rel="noopener noreferrer" class="cr-social-icon" title="Instagram"><i class="fab fa-instagram"></i></a>';
    }
    if (links.tiktok) {
      var ttHandle = String(links.tiktok).replace(/^@/, '');
      html += '<a href="https://tiktok.com/@' + encodeURIComponent(ttHandle) + '" target="_blank" rel="noopener noreferrer" class="cr-social-icon" title="TikTok"><i class="fab fa-tiktok"></i></a>';
    }
    var fbUrl = safeUrl(links.facebook);
    if (fbUrl) html += '<a href="' + esc(fbUrl) + '" target="_blank" rel="noopener noreferrer" class="cr-social-icon" title="Facebook"><i class="fab fa-facebook"></i></a>';
    var liUrl = safeUrl(links.linkedin);
    if (liUrl) html += '<a href="' + esc(liUrl) + '" target="_blank" rel="noopener noreferrer" class="cr-social-icon" title="LinkedIn"><i class="fab fa-linkedin"></i></a>';
    var siteUrl = safeUrl(website);
    if (siteUrl) html += '<a href="' + esc(siteUrl) + '" target="_blank" rel="noopener noreferrer" class="cr-social-icon" title="Website"><i class="fas fa-globe"></i></a>';
    return html;
  }

  function renderCard(u) {
    var name = u.fullName || u.displayName || 'Creator';
    var bio = (u.bio || '').slice(0, 110);
    var niche = u.creatorCategory || u.niche || '';
    var icons = socialIcons(u.socialLinks, u.website);
    return '<a href="profile.html?id=' + encodeURIComponent(u.uid || u.id) + '" class="cr-card">'
      + '<div class="cr-avatar-wrap">' + avatarHtml(u.photoURL || u.avatar, name) + '</div>'
      + '<div class="cr-card-body">'
      + '<div class="cr-card-top">'
      + '<strong class="cr-name">' + esc(name) + '</strong>'
      + '<span class="cr-badge"><i class="fas fa-star"></i> Creator</span>'
      + '</div>'
      + (niche ? '<span class="cr-niche-tag">' + esc(niche) + '</span>' : '')
      + (bio ? '<p class="cr-bio">' + esc(bio) + (u.bio && u.bio.length > 110 ? '…' : '') + '</p>' : '')
      + (icons ? '<div class="cr-socials">' + icons + '</div>' : '')
      + '</div>'
      + '</a>';
  }

  function getFilteredItems() {
    var q = state.search.trim().toLowerCase();
    return state.all.filter(function (u) {
      if (state.catFilter) {
        var niche = (u.creatorCategory || u.niche || '').toLowerCase();
        if (niche !== state.catFilter.toLowerCase()) return false;
      }
      if (!q) return true;
      var name = (u.fullName || u.displayName || '').toLowerCase();
      var bio = (u.bio || '').toLowerCase();
      var cat = (u.creatorCategory || u.niche || '').toLowerCase();
      return name.includes(q) || bio.includes(q) || cat.includes(q);
    });
  }

  function paint() {
    var list = document.getElementById('cleanList');
    if (!list) return;
    var items = getFilteredItems();

    var statFiltered = document.getElementById('stat-filtered');
    if (statFiltered) statFiltered.textContent = items.length;

    if (!items.length) {
      var msg = (state.search || state.catFilter) ? 'No creators match your search.' : 'Users who activate Creator mode will appear here.';
      var head = (state.search || state.catFilter) ? 'No results' : 'No creators yet';
      list.innerHTML = '<div class="clean-empty"><div><i class="fas fa-star"></i><h3>' + head + '</h3><p>' + msg + '</p></div></div>';
      return;
    }
    list.innerHTML = '<div class="cr-grid">' + items.map(renderCard).join('') + '</div>';
  }

  function getNiches() {
    var seen = {};
    var niches = [];
    state.all.forEach(function (u) {
      var n = (u.creatorCategory || u.niche || '').trim();
      if (n && !seen[n]) { seen[n] = true; niches.push(n); }
    });
    return niches;
  }

  function paintSidebar() {
    var aside = $('aside.clean-card');
    if (!aside) return;
    _catList = getNiches();
    // Category buttons use numeric index in onclick to avoid injecting
    // user-controlled strings (e.g. niche names with quotes) into JS context.
    var html = '<strong style="font-size:.9rem;color:#f8fafc">Filter by Category</strong>'
      + '<div class="cr-cat-list">'
      + '<button class="cr-cat-btn' + (!state.catFilter ? ' active' : '') + '" onclick="window._crSetCat(\'\')">All Creators</button>';
    _catList.forEach(function (n, i) {
      html += '<button class="cr-cat-btn' + (state.catFilter === n ? ' active' : '') + '" onclick="window._crSetCatIdx(' + i + ')">' + esc(n) + '</button>';
    });
    html += '</div>';
    aside.innerHTML = html;
  }

  function load() {
    var list = document.getElementById('cleanList');
    if (list) list.innerHTML = '<div class="clean-empty"><div><i class="fas fa-spinner fa-spin" style="color:#10e0a0"></i><h3>Loading creators…</h3></div></div>';

    whenFirebase(function (fb) {
      var q = fb.fs.query(
        fb.fs.collection(fb.db, 'users'),
        fb.fs.where('accountType', '==', 'creator'),
        fb.fs.limit(100)
      );
      fb.fs.getDocs(q).then(function (snap) {
        state.all = snap.docs.map(function (d) {
          return Object.assign({ id: d.id, uid: d.id }, d.data());
        });

        var totalEl = document.getElementById('stat-total');
        if (totalEl) totalEl.textContent = state.all.length;

        paintSidebar();
        paint();
      }).catch(function (err) {
        console.warn('[Creators] load failed', err && err.message);
        if (list) list.innerHTML = '<div class="clean-empty"><div><i class="fas fa-exclamation-circle"></i><h3>Could not load creators</h3><p>Please try again later.</p></div></div>';
      });
    });
  }

  window._crSetCat = function (cat) {
    state.catFilter = cat;
    paint();
    paintSidebar();
  };

  // Safe category setter by index — onclick only receives a numeric literal.
  window._crSetCatIdx = function (i) {
    window._crSetCat(_catList[i] !== undefined ? _catList[i] : '');
  };

  function bindSearch() {
    var input = $('section.clean-hero .clean-search input');
    var btn = $('section.clean-hero .clean-search button');
    if (!input) return;
    var doSearch = function () { state.search = input.value; paint(); };
    if (btn) btn.addEventListener('click', doSearch);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
  }

  function bindTabs() {
    document.querySelectorAll('.clean-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.clean-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindSearch();
    bindTabs();
    load();
  });
})();
