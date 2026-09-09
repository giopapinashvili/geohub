/* ═══════════════════════════════════════════════════════════════════════════
   GeoHub — deep-link tab router
   ───────────────────────────────────────────────────────────────────────────
   Consolidating 59 pages into ~24 means several old URLs now redirect into a
   *section* of a surviving page (reels.html → videos.html?tab=reels). This
   reads that hint and opens the right section.

   It is deliberately dumb: it looks for a control that already exists on the
   page and clicks it. No page needs to know this file exists, and if a page
   has no matching control nothing happens.
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Where a tab hint isn't spelled the same way as the control that opens it.
  var ALIASES = {
    'videos.html':   { reels: ['reels', 'რილსი'], watch: ['watch', 'ყურება'],
                       live: ['live', 'პირდაპირი', 'ეთერი'], channel: ['channel', 'არხი'] },
    'places.html':   { updates: ['updates', 'სიახლეები'], reviews: ['reviews', 'შეფასებები'] },
    'marketplace.html': { products: ['products', 'პროდუქტები'], services: ['services', 'სერვისები'] },
    'checkin.html':  { camera: ['camera', 'კამერა'], scan: ['scan', 'სკანერი', 'qr'] },
    'search.html':   { creators: ['creators', 'შემქმნელები'] },
    'premium.html':  { early: ['early', 'early adopter'] },
    'admin.html':    { videos: ['videos', 'ვიდეო'] },
    'feed.html':     { stories: ['stories', 'სთორები'] }
  };

  // Controls that behave like tabs across the codebase's various conventions.
  var TAB_SELECTOR = [
    '[data-tab]', '[data-vid-tab]', '[data-pl-tab]', '[data-atab]',
    '.gh-feed-tab', '.gh-tab', '.gh-pill', '.vid-pill', '.clean-tab',
    '.pl-cat-btn', '.ptab', '.aud-tab', '[role="tab"]'
  ].join(',');

  function wanted() {
    try {
      var t = new URLSearchParams(location.search).get('tab');
      return t ? t.toLowerCase().trim() : '';
    } catch (e) { return ''; }
  }

  function candidates(tab) {
    var page = location.pathname.split('/').pop() || 'index.html';
    var names = [tab];
    var map = ALIASES[page];
    if (map && map[tab]) names = names.concat(map[tab]);
    return names.map(function (n) { return String(n).toLowerCase(); });
  }

  function activate(tab) {
    var names = candidates(tab);
    var nodes = document.querySelectorAll(TAB_SELECTOR);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var hay = [
        el.getAttribute('data-tab'), el.getAttribute('data-vid-tab'),
        el.getAttribute('data-pl-tab'), el.getAttribute('data-atab'),
        el.getAttribute('data-cat'), el.id, (el.textContent || '')
      ].filter(Boolean).join(' ').toLowerCase();
      for (var j = 0; j < names.length; j++) {
        if (names[j] && hay.indexOf(names[j]) !== -1) {
          try { el.click(); } catch (e) {}
          if (typeof el.scrollIntoView === 'function') {
            try { el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch (e) {}
          }
          return true;
        }
      }
    }
    return false;
  }

  function run() {
    var tab = wanted();
    if (!tab) return;
    if (activate(tab)) return;
    // Sections are often rendered after data loads — retry briefly, then stop.
    var tries = 0;
    var timer = setInterval(function () {
      if (activate(tab) || ++tries > 12) clearInterval(timer);
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  window.addEventListener('GeoSocialReady', run);
})();
