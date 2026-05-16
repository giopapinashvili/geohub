/* ================================================================
   GeoHub — Mobile App Shell JS
   Bottom nav, FAB, action sheet, notifications, install prompt,
   splash screen, service worker.
   ================================================================ */

(function () {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────────

  var SKIP_PAGES = ['onboarding.html'];
  var currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  if (SKIP_PAGES.some(function (p) { return currentPage.includes(p); })) return;

  // Self-inject mobile-nav.css so pages don't need to load it explicitly
  (function() {
    if (document.querySelector('link[href*="mobile-nav.css"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'mobile-nav.css';
    document.head.appendChild(link);
  })();

  // ── ACTIVE PAGE DETECTION ─────────────────────────────────────

  function getActiveTab() {
    var p = currentPage;
    if (!p || p === 'index.html') return 'home';
    if (['feed.html','places.html','events.html','groups.html','explore.html'].includes(p)) return 'explore';
    if (['live.html'].includes(p)) return 'live';
    if (['map.html'].includes(p)) return 'map';
    if (['rewards.html','challenges.html'].includes(p)) return 'rewards';
    if (['messages.html'].includes(p)) return 'messages';
    if (['profile.html','auth.html'].includes(p)) return 'profile';
    return '';
  }

  function getAuthUser() { return (window.GeoAuth && window.GeoAuth.getCurrentUser && window.GeoAuth.getCurrentUser()) || window.GeoCurrentUser || null; }

  // ── INJECT BOTTOM NAV ─────────────────────────────────────────

  function injectBottomNav() {
    if (document.getElementById('app-bottom-nav')) return;
    var active = getActiveTab();

    var nav = document.createElement('nav');
    nav.id = 'app-bottom-nav';
    nav.className = 'app-bottom-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Main navigation');

    var authUser = getAuthUser();
    var profileHref  = authUser ? 'profile.html' : 'auth.html';
    var profileLabel = authUser ? 'Profile' : 'Login';
    var profileIcon  = authUser ? 'fas fa-user-circle' : 'fas fa-sign-in-alt';

    nav.innerHTML =
      navItem('index.html',  'fas fa-home',    'Home',    active === 'home',    '') +
      navItem('feed.html',   'fas fa-compass', 'Explore', active === 'explore', '') +
      '<div class="app-fab-wrap">' +
        '<button class="app-fab" id="app-fab" aria-label="Quick actions" aria-expanded="false">' +
          '<i class="fas fa-plus" aria-hidden="true"></i>' +
        '</button>' +
      '</div>' +
      navItem('map.html',       'fas fa-map',        'Map',     active === 'map' || active === 'live', '') +
      navItem(profileHref,      profileIcon,          profileLabel, active === 'profile', '');

    document.body.appendChild(nav);
    document.getElementById('app-fab').addEventListener('click', toggleActionSheet);
  }

  function navItem(href, icon, label, isActive, extra) {
    return '<a href="' + href + '" class="app-nav-item' + (isActive ? ' active' : '') + (extra ? ' ' + extra : '') + '">' +
      (label === 'Live' ? '<span class="nav-live-dot"></span>' : '') +
      '<i class="' + icon + '" aria-hidden="true"></i>' +
      '<span>' + label + '</span>' +
    '</a>';
  }

  // ── INJECT ACTION SHEET ───────────────────────────────────────

  function injectActionSheet() {
    if (document.getElementById('app-action-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'app-action-overlay';
    overlay.className = 'app-action-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.addEventListener('click', closeActionSheet);
    document.body.appendChild(overlay);

    var sheet = document.createElement('div');
    sheet.id = 'app-action-sheet';
    sheet.className = 'app-action-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Quick actions');
    sheet.innerHTML =
      '<div class="app-action-sheet-handle" aria-hidden="true"></div>' +
      '<div class="app-action-sheet-title">Quick Actions</div>' +
      actionItem('map.html',     'fas fa-location-dot',   'rgba(16,185,129,0.15)', '#34d399', 'Quick Check-in', 'Tag your location and earn XP') +
      actionItem('feed.html',    'fas fa-pen-to-square',  'rgba(59,130,246,0.15)', '#60a5fa', 'Create Post',    'Share a place, tip, or update') +
      actionItem('events.html',  'fas fa-calendar-plus',  'rgba(245,158,11,0.15)', '#fbbf24', 'Create Event',   'Organize a meetup or city event') +
      actionItem('places.html',  'fas fa-location-dot',   'rgba(16,185,129,0.12)', '#6ee7b7', 'Find a Place',   'Search for restaurants, cafes and more') +
      '<div class="app-action-item" onclick="showStoryToast();closeActionSheet();" style="cursor:pointer">' +
        '<div class="app-action-icon" style="background:rgba(236,72,153,0.15);color:#f472b6"><i class="fas fa-circle-plus" aria-hidden="true"></i></div>' +
        '<div class="app-action-text"><h4>Add Story</h4><p>Share a 24h city moment</p></div>' +
        '<i class="fas fa-chevron-right app-action-chevron" aria-hidden="true"></i>' +
      '</div>';
    document.body.appendChild(sheet);
  }

  function actionItem(href, icon, bg, color, title, desc) {
    return '<a href="' + href + '" class="app-action-item" onclick="closeActionSheet()">' +
      '<div class="app-action-icon" style="background:' + bg + ';color:' + color + '">' +
        '<i class="' + icon + '" aria-hidden="true"></i>' +
      '</div>' +
      '<div class="app-action-text"><h4>' + title + '</h4><p>' + desc + '</p></div>' +
      '<i class="fas fa-chevron-right app-action-chevron" aria-hidden="true"></i>' +
    '</a>';
  }

  // ── FAB TOGGLE ────────────────────────────────────────────────

  var fabOpen = false;

  function toggleActionSheet() {
    fabOpen = !fabOpen;
    var fab     = document.getElementById('app-fab');
    var overlay = document.getElementById('app-action-overlay');
    var sheet   = document.getElementById('app-action-sheet');
    if (!fab || !overlay || !sheet) return;
    fab.classList.toggle('open', fabOpen);
    fab.setAttribute('aria-expanded', String(fabOpen));
    overlay.classList.toggle('open', fabOpen);
    sheet.classList.toggle('open', fabOpen);
  }

  function closeActionSheet() {
    fabOpen = false;
    var fab     = document.getElementById('app-fab');
    var overlay = document.getElementById('app-action-overlay');
    var sheet   = document.getElementById('app-action-sheet');
    if (fab) { fab.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); }
    if (overlay) overlay.classList.remove('open');
    if (sheet) sheet.classList.remove('open');
  }

  window.closeActionSheet = closeActionSheet;

  window.showStoryToast = function () {
    pushNotif({
      emoji: '📸',
      bg: 'rgba(236,72,153,0.15)',
      color: '#f472b6',
      title: 'Open Stories',
      text: '24h city moments — launching with the next update.',
      link: null,
    });
  };

  // ── INSTALL PROMPT ────────────────────────────────────────────

  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstall = e;
  });

  function injectInstallPrompt() {
    if (window.safeStorage && window.safeStorage.get('gh_install_dismissed', false)) return;
    if (document.getElementById('app-install-prompt')) return;

    var el = document.createElement('div');
    el.id = 'app-install-prompt';
    el.className = 'app-install-prompt';
    el.innerHTML =
      '<div class="install-icon">GH</div>' +
      '<div class="install-text">' +
        '<strong>Install GeoHub App</strong>' +
        '<span>Add to home screen — works offline too</span>' +
      '</div>' +
      '<div class="install-actions">' +
        '<button class="install-later" onclick="window.ghDismissInstall()">Later</button>' +
        '<button class="install-now" onclick="window.ghInstall()">Install</button>' +
      '</div>';
    document.body.appendChild(el);

    setTimeout(function () { el.classList.add('visible'); }, 5000);
    setTimeout(function () { if (el.parentNode) window.ghDismissInstall(); }, 18000);
  }

  window.ghDismissInstall = function () {
    var el = document.getElementById('app-install-prompt');
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.3s, transform 0.3s';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    window.safeStorage && window.safeStorage.set('gh_install_dismissed', true);
  };

  window.ghInstall = function () {
    if (deferredInstall) {
      deferredInstall.prompt();
      deferredInstall.userChoice.then(function () { deferredInstall = null; });
    }
    window.ghDismissInstall();
    pushNotif({
      emoji: '✅', bg: 'rgba(16,185,129,0.15)', color: '#34d399',
      title: 'GeoHub installing…',
      text: 'Use "Add to Home Screen" from your browser menu.',
      link: null,
    });
  };

  // ── NOTIFICATION TOASTS ───────────────────────────────────────

  var NOTIFS = [];

  var notifIdx = 0;
  var notifShown = 0;

  function injectNotifContainer() {
    if (document.getElementById('app-notif-toast')) return;
    var el = document.createElement('div');
    el.id = 'app-notif-toast';
    el.className = 'app-notif-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }

  function pushNotif(n) {
    var toast = document.getElementById('app-notif-toast');
    if (!toast) return;

    toast.innerHTML =
      '<div class="notif-icon-wrap" style="background:' + n.bg + ';color:' + n.color + '">' + n.emoji + '</div>' +
      '<div class="notif-body"><strong>' + n.title + '</strong><span>' + n.text + '</span></div>' +
      '<span class="notif-time">now</span>' +
      '<button class="notif-close" onclick="window.ghDismissNotif()" aria-label="Dismiss">✕</button>';

    if (n.link) {
      toast.style.cursor = 'pointer';
      toast.onclick = function (e) {
        if (e.target.classList.contains('notif-close')) return;
        window.location.href = n.link;
      };
    } else {
      toast.style.cursor = 'default';
      toast.onclick = null;
    }

    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.classList.remove('show'); }, 4800);
  }

  window.ghDismissNotif = function () {
    var t = document.getElementById('app-notif-toast');
    if (t) t.classList.remove('show');
  };

  function startNotifCycle() {
    if (notifShown >= NOTIFS.length) return;
    setTimeout(function cycle() {
      if (notifShown >= NOTIFS.length) return;
      pushNotif(NOTIFS[notifIdx]);
      notifIdx = (notifIdx + 1) % NOTIFS.length;
      notifShown++;
      if (notifShown < NOTIFS.length) setTimeout(cycle, 13000);
    }, 7000);
  }

  // ── SPLASH SCREEN ─────────────────────────────────────────────

  function showSplash() {
    var isPWA = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (!isPWA) return;
    if (window.safeStorage && window.safeStorage.get('gh_splashed', false)) return;

    var el = document.createElement('div');
    el.className = 'app-splash';
    el.innerHTML =
      '<div class="splash-logo">GH</div>' +
      '<div class="splash-name">Geo<span>Hub</span></div>' +
      '<div class="splash-tagline">Discover Georgia · Earn XP · Grow</div>' +
      '<div class="splash-loader"><div class="splash-loader-fill"></div></div>';
    document.body.appendChild(el);

    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
    }, 1300);

    window.safeStorage && window.safeStorage.set('gh_splashed', true);
  }

  // ── PWA META INJECTION ────────────────────────────────────────

  function injectPWAMeta() {
    if (!document.querySelector('link[rel="manifest"]')) {
      var ml = document.createElement('link');
      ml.rel = 'manifest'; ml.href = '/manifest.json';
      document.head.appendChild(ml);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      var al = document.createElement('link');
      al.rel = 'apple-touch-icon'; al.href = '/icons/icon-192.png';
      document.head.appendChild(al);
    }
    if (!document.querySelector('link[rel="icon"]')) {
      var il = document.createElement('link');
      il.rel = 'icon'; il.type = 'image/png'; il.href = '/icons/icon-96.png';
      document.head.appendChild(il);
    }
    var metas = {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-title': 'GeoHub',
      'theme-color': '#10b981',
    };
    Object.keys(metas).forEach(function(name) {
      if (!document.querySelector('meta[name="' + name + '"]')) {
        var m = document.createElement('meta');
        m.name = name; m.content = metas[name];
        document.head.appendChild(m);
      }
    });
  }

  // ── OFFLINE / UPDATE BANNERS ──────────────────────────────────

  function injectOfflineBanner() {
    if (document.getElementById('gh-offline-banner')) return;
    var style = document.createElement('style');
    style.textContent = [
      '#gh-offline-banner{position:fixed;top:0;left:0;right:0;z-index:99999;background:#ef4444;color:#fff;text-align:center;padding:10px 16px;font-size:0.83rem;font-weight:600;transform:translateY(-100%);transition:transform 0.28s ease;pointer-events:none;letter-spacing:.01em}',
      '#gh-offline-banner.visible{transform:translateY(0);pointer-events:auto}',
      '#gh-update-banner{position:fixed;bottom:0;left:0;right:0;z-index:99998;background:#0c0e1c;border-top:2px solid rgba(16,185,129,.5);color:#f1f5f9;display:flex;align-items:center;justify-content:center;gap:14px;padding:13px 16px;font-size:0.83rem;transform:translateY(100%);transition:transform 0.28s ease;pointer-events:none}',
      '#gh-update-banner.visible{transform:translateY(0);pointer-events:auto}',
      '#gh-update-banner strong{color:#34d399}',
      '#gh-update-banner button{background:#10b981;color:#fff;border:none;border-radius:8px;padding:7px 18px;font-size:0.78rem;font-weight:700;cursor:pointer;flex-shrink:0}',
      '#gh-update-banner button:hover{background:#0d9268}',
    ].join('');
    document.head.appendChild(style);

    var ob = document.createElement('div');
    ob.id = 'gh-offline-banner';
    ob.setAttribute('role', 'alert');
    ob.textContent = '📡 You\'re offline — some features may not work';
    document.body.appendChild(ob);

    var ub = document.createElement('div');
    ub.id = 'gh-update-banner';
    ub.setAttribute('role', 'status');
    ub.innerHTML = '<span>🎉 <strong>New version available</strong></span><button onclick="window.location.reload()">Reload</button>';
    document.body.appendChild(ub);
  }

  function showOfflineBanner() {
    var b = document.getElementById('gh-offline-banner');
    if (b) b.classList.add('visible');
  }

  function hideOfflineBanner() {
    var b = document.getElementById('gh-offline-banner');
    if (b) b.classList.remove('visible');
  }

  function showSWUpdateBanner() {
    var b = document.getElementById('gh-update-banner');
    if (b) b.classList.add('visible');
  }

  function setupConnectivityListeners() {
    window.addEventListener('offline', showOfflineBanner);
    window.addEventListener('online',  hideOfflineBanner);
    if (!navigator.onLine) showOfflineBanner();
  }

  // ── SERVICE WORKER ────────────────────────────────────────────

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol === 'file:') return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(reg) {
      reg.addEventListener('updatefound', function() {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function() {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showSWUpdateBanner();
          }
        });
      });
      setInterval(function() { reg.update().catch(function() {}); }, 30 * 60 * 1000);
    }).catch(function() {});

    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.addEventListener('message', function(ev) {
      if (ev.data && ev.data.type === 'SW_UPDATED') showSWUpdateBanner();
    });
  }

  // ── ESCAPE KEY ────────────────────────────────────────────────

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeActionSheet(); closeCmdPalette(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); toggleCmdPalette(); }
  });

  // ── SWIPE TO CLOSE ACTION SHEET ───────────────────────────────

  var touchStartY = 0;
  document.addEventListener('touchstart', function (e) {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!fabOpen) return;
    var dy = e.changedTouches[0].clientY - touchStartY;
    if (dy > 60) closeActionSheet();
  }, { passive: true });

  // ── INIT ──────────────────────────────────────────────────────

  // ── COMMAND PALETTE (Ctrl/Cmd+K) ─────────────────────────────

  var cmdOpen = false;
  var cmdDebounce;

  function injectCmdPalette() {
    if (document.getElementById('geo-cmd-overlay')) return;

    var style = document.createElement('style');
    style.textContent = [
      '#geo-cmd-overlay{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);display:none;align-items:flex-start;justify-content:center;padding:10vh 16px 0}',
      '#geo-cmd-overlay.open{display:flex}',
      '#geo-cmd-box{width:100%;max-width:620px;background:#0c0e1c;border:1px solid rgba(255,255,255,0.12);border-radius:18px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.05);animation:cmdIn 0.22s cubic-bezier(.34,1.56,.64,1)}',
      '@keyframes cmdIn{from{transform:scale(0.94) translateY(-12px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}',
      '#geo-cmd-input-row{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.07)}',
      '#geo-cmd-search-icon{color:#4b5563;font-size:0.92rem;flex-shrink:0}',
      '#geo-cmd-input{flex:1;background:none;border:none;outline:none;color:#f1f5f9;font-size:1rem;font-family:Inter,system-ui,sans-serif}',
      '#geo-cmd-input::placeholder{color:#4b5563}',
      '#geo-cmd-kbd{font-size:0.62rem;color:#4b5563;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:2px 6px;white-space:nowrap}',
      '#geo-cmd-sections{max-height:60vh;overflow-y:auto;scrollbar-width:none}',
      '#geo-cmd-sections::-webkit-scrollbar{display:none}',
      '.cmd-section-title{font-size:0.62rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#4b5563;padding:10px 16px 4px}',
      '.cmd-item{display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;transition:background 0.15s}',
      '.cmd-item:hover,.cmd-item.focused{background:rgba(16,185,129,0.08)}',
      '.cmd-item-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0}',
      '.cmd-item-text{flex:1}',
      '.cmd-item-title{font-size:0.85rem;font-weight:700;color:#f1f5f9}',
      '.cmd-item-sub{font-size:0.68rem;color:#64748b}',
      '.cmd-item-shortcut{font-size:0.6rem;color:#4b5563;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:1px 5px}',
      '.cmd-divider{height:1px;background:rgba(255,255,255,0.06);margin:4px 0}',
      '.cmd-result-type{margin-left:auto;flex-shrink:0;padding:2px 6px;border-radius:4px;font-size:0.58rem;font-weight:800}',
      '#geo-cmd-footer{padding:8px 16px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px}',
      '.cmd-footer-hint{font-size:0.62rem;color:#4b5563;display:flex;align-items:center;gap:4px}',
    ].join('');
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.id  = 'geo-cmd-overlay';
    overlay.innerHTML = '<div id="geo-cmd-box">' +
      '<div id="geo-cmd-input-row">' +
        '<i class="fas fa-search" id="geo-cmd-search-icon"></i>' +
        '<input id="geo-cmd-input" placeholder="Search GeoHub or run a command…" autocomplete="off" spellcheck="false">' +
        '<span id="geo-cmd-kbd">ESC</span>' +
      '</div>' +
      '<div id="geo-cmd-sections"></div>' +
      '<div id="geo-cmd-footer">' +
        '<span class="cmd-footer-hint"><kbd style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:3px;padding:1px 4px;font-size:0.6rem">↑↓</kbd> navigate</span>' +
        '<span class="cmd-footer-hint"><kbd style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:3px;padding:1px 4px;font-size:0.6rem">↵</kbd> open</span>' +
        '<span class="cmd-footer-hint" style="margin-left:auto"><a href="search.html" style="color:#10b981;text-decoration:none;font-weight:700;font-size:0.68rem">Full Search →</a></span>' +
      '</div>' +
    '</div>';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeCmdPalette(); });
    document.body.appendChild(overlay);

    document.getElementById('geo-cmd-input').addEventListener('input', function () {
      clearTimeout(cmdDebounce);
      cmdDebounce = setTimeout(function () { renderCmdResults(document.getElementById('geo-cmd-input').value); }, 200);
    });

    document.getElementById('geo-cmd-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var focused = document.querySelector('.cmd-item.focused');
        if (focused) { focused.click(); } else {
          var q = this.value.trim();
          if (q) location.href = 'search.html?q=' + encodeURIComponent(q);
          else location.href = 'search.html';
        }
      }
    });
  }

  var QUICK_ACTIONS = [
    { icon:'📍', bg:'rgba(16,185,129,0.15)', color:'#34d399', title:'Create Check-in',    sub:'Tag your location + camera proof', url:'checkin.html',    shortcut:'' },
    { icon:'🤖', bg:'rgba(168,85,247,0.15)', color:'#c084fc', title:'Open AI Assistant',  sub:'Get a smart city day plan',        url:'assistant.html',  shortcut:'' },
    { icon:'🎁', bg:'rgba(245,158,11,0.15)', color:'#fbbf24', title:'View Rewards',        sub:'Claim GeoPoints & partner offers',  url:'rewards.html',    shortcut:'' },
    { icon:'⚡', bg:'rgba(59,130,246,0.15)',  color:'#60a5fa', title:'Start Challenge',     sub:'Missions, XP, and badges',         url:'challenges.html', shortcut:'' },
    { icon:'📡', bg:'rgba(239,68,68,0.15)',   color:'#f87171', title:'Open Live City',      sub:'Live check-ins and city pulse',     url:'live.html',       shortcut:'' },
    { icon:'💬', bg:'rgba(236,72,153,0.15)',  color:'#f472b6', title:'Messages',            sub:'Chat with people you follow',       url:'messages.html',   shortcut:'' },
    { icon:'🇬🇪', bg:'rgba(249,115,22,0.15)',  color:'#fb923c', title:'Patriot Missions',   sub:'Civic tasks + Patriot XP',          url:'patriot.html',    shortcut:'' },
    { icon:'⭐', bg:'rgba(16,185,129,0.15)',  color:'#34d399', title:'Reviews Hub',         sub:'Write or browse trusted reviews',   url:'reviews.html',    shortcut:'' },
  ];

  function renderCmdResults(q) {
    var sections = document.getElementById('geo-cmd-sections');
    if (!sections) return;

    if (!q.trim()) {
      var recentHtml = '';
      if (typeof GeoSearch !== 'undefined') {
        var recent = GeoSearch.getRecent().slice(0, 4);
        if (recent.length) {
          recentHtml = '<div class="cmd-section-title">Recent Searches</div>' +
            recent.map(function (r) {
              return '<div class="cmd-item" onclick="location.href=\'search.html?q=' + encodeURIComponent(r) + '\'">' +
                '<div class="cmd-item-icon" style="background:rgba(255,255,255,0.04);color:#64748b"><i class="fas fa-clock"></i></div>' +
                '<div class="cmd-item-text"><div class="cmd-item-title">' + r + '</div></div></div>';
            }).join('') + '<div class="cmd-divider"></div>';
        }
      }

      sections.innerHTML = recentHtml +
        '<div class="cmd-section-title">Quick Actions</div>' +
        QUICK_ACTIONS.map(function (a) {
          return '<div class="cmd-item" onclick="closeCmdPalette();location.href=\'' + a.url + '\'">' +
            '<div class="cmd-item-icon" style="background:' + a.bg + ';color:' + a.color + '">' + a.icon + '</div>' +
            '<div class="cmd-item-text"><div class="cmd-item-title">' + a.title + '</div><div class="cmd-item-sub">' + a.sub + '</div></div>' +
          '</div>';
        }).join('');
      return;
    }

    if (typeof GeoSearch === 'undefined') {
      sections.innerHTML = '<div class="cmd-item" onclick="location.href=\'search.html?q=' + encodeURIComponent(q) + '\'">' +
        '<div class="cmd-item-icon" style="background:rgba(16,185,129,0.1);color:#10b981"><i class="fas fa-search"></i></div>' +
        '<div class="cmd-item-text"><div class="cmd-item-title">Search for "' + q + '"</div><div class="cmd-item-sub">Open full search</div></div>' +
        '</div>';
      return;
    }

    var results = GeoSearch.search(q).slice(0, 7);
    var tm = GeoSearch.TYPE_META;

    var html = '<div class="cmd-section-title">' + results.length + ' results</div>';
    if (!results.length) {
      html = '<div class="cmd-item"><div class="cmd-item-icon" style="background:rgba(255,255,255,0.04);color:#4b5563"><i class="fas fa-search"></i></div>' +
        '<div class="cmd-item-text"><div class="cmd-item-title" style="color:#64748b">No results for "' + q + '"</div></div></div>';
    } else {
      html += results.map(function (r) {
        var t = tm[r.type] || tm.people;
        var url = r.url || t.url;
        return '<div class="cmd-item" onclick="closeCmdPalette();location.href=\'' + url + '\'">' +
          '<div class="cmd-item-icon" style="background:' + t.bg + ';color:' + t.color + '">' +
            (r.icon || '<i class="' + t.icon + '"></i>') +
          '</div>' +
          '<div class="cmd-item-text"><div class="cmd-item-title">' + r.name + '</div><div class="cmd-item-sub">' + (r.sub || r.city || '') + '</div></div>' +
          '<span class="cmd-result-type" style="background:' + t.bg + ';color:' + t.color + '">' + t.label + '</span>' +
        '</div>';
      }).join('');
      html += '<div class="cmd-divider"></div><div class="cmd-item" onclick="closeCmdPalette();location.href=\'search.html?q=' + encodeURIComponent(q) + '\'">' +
        '<div class="cmd-item-icon" style="background:rgba(16,185,129,0.1);color:#10b981"><i class="fas fa-external-link-alt"></i></div>' +
        '<div class="cmd-item-text"><div class="cmd-item-title" style="color:#10b981">See all results for "' + q + '"</div></div></div>';
    }
    sections.innerHTML = html;
  }

  function toggleCmdPalette() { if (cmdOpen) closeCmdPalette(); else openCmdPalette(); }
  function openCmdPalette() {
    injectCmdPalette();
    var overlay = document.getElementById('geo-cmd-overlay');
    var input   = document.getElementById('geo-cmd-input');
    if (!overlay) return;
    renderCmdResults('');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    cmdOpen = true;
    setTimeout(function () { if (input) input.focus(); }, 60);
  }
  function closeCmdPalette() {
    var overlay = document.getElementById('geo-cmd-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    cmdOpen = false;
  }
  window.toggleCmdPalette = toggleCmdPalette;
  window.openCmdPalette   = openCmdPalette;
  window.closeCmdPalette  = closeCmdPalette;

  function injectScript(src) {
    if (document.querySelector('script[src*="' + src + '"]')) return;
    var s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
  }

  function injectAnalytics() { injectScript('analytics.js'); }
  function injectGrowthScripts() {
    injectScript('invite.js');
    injectScript('growth.js');
    injectScript('share.js');
  }

  function init() {
    injectPWAMeta();
    injectAnalytics();
    injectGrowthScripts();
    showSplash();
    injectBottomNav();
    injectActionSheet();
    injectNotifContainer();
    injectOfflineBanner();
    setupConnectivityListeners();
    injectInstallPrompt();
    injectCmdPalette();
    registerSW();
    startNotifCycle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
