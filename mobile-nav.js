/* ================================================================
   GeoHub — Mobile App Shell JS
   Bottom nav, FAB, action sheet, notifications, install prompt,
   splash screen, service worker.
   ================================================================ */

(function () {
  'use strict';

  // Shared shell strings go through the global i18n dictionary (Georgian by default).
  function T(key, fallback) { try { return (typeof window.GHt === 'function' && window.GHt(key) !== key) ? window.GHt(key) : fallback; } catch (e) { return fallback; } }
  if (window.__ghMobileNavInit) return;
  window.__ghMobileNavInit = true;

  // ── CONFIG ────────────────────────────────────────────────────

  var SKIP_PAGES = ['onboarding.html'];
  var currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (currentPage && currentPage.indexOf('.') === -1) currentPage += '.html';

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
    if (['feed.html','places.html','events.html','groups.html','explore.html','place-feed.html'].includes(p)) return 'explore';
    if (['live.html'].includes(p)) return 'live';
    if (['map.html'].includes(p)) return 'map';
    if (['rewards.html','challenges.html'].includes(p)) return 'rewards';
    if (['messages.html'].includes(p)) return 'messages';
    if (['profile.html','auth.html'].includes(p)) return 'profile';
    return '';
  }

  function getAuthUser() { return (window.GeoAuth && window.GeoAuth.getCurrentUser && window.GeoAuth.getCurrentUser()) || window.GeoCurrentUser || null; }
  function getActiveActor() {
    try { return JSON.parse(localStorage.getItem('gh_active_actor') || 'null'); } catch(e) { return null; }
  }
  function mobileMessagesHref() {
    var actor = getActiveActor();
    return actor && actor.type === 'business' && actor.businessId
      ? 'messages.html?business=' + encodeURIComponent(actor.businessId)
      : 'messages.html';
  }
  function updateActorMessageLinks() {
    var href = mobileMessagesHref();
    document.querySelectorAll('[data-gh-actor-messages]').forEach(function(a) {
      a.setAttribute('href', href);
    });
  }

  // ── INJECT BOTTOM NAV ─────────────────────────────────────────

  function injectBottomNav() {
    if (currentPage === 'messages.html') return;
    if (document.getElementById('app-bottom-nav')) return;
    var active = getActiveTab();

    var nav = document.createElement('nav');
    nav.id = 'app-bottom-nav';
    nav.className = 'app-bottom-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Main navigation');

    nav.innerHTML =
      navItem('feed.html',          'fas fa-house', 'Feed', active === 'home' || currentPage === 'feed.html', '') +
      navItem('search.html',        'fas fa-magnifying-glass', 'Explore', active === 'explore' || currentPage === 'search.html', '') +
      navItem(mobileMessagesHref(), 'fas fa-comment-dots', 'Messages', active === 'messages', '', 'data-gh-actor-messages') +
      navItem('notifications.html', 'fas fa-bell', 'Notifications', currentPage === 'notifications.html', '') +
      navButton('fas fa-bars', T('menu_label','Menu'));

    document.body.appendChild(nav);
    setupBottomNavAutoHide(nav);
  }

  function navItem(href, icon, label, isActive, extra, attrs) {
    return '<a href="' + href + '" class="app-nav-item' + (isActive ? ' active' : '') + (extra ? ' ' + extra : '') + '" ' + (attrs || '') + '>' +
      (label === 'Live' ? '<span class="nav-live-dot"></span>' : '') +
      '<i class="' + icon + '" aria-hidden="true"></i>' +
      '<span>' + label + '</span>' +
    '</a>';
  }

  function navButton(icon, label) {
    return '<button type="button" class="app-nav-item app-nav-menu" data-gh-mobile-menu-toggle aria-label="' + label + '">' +
      '<i class="' + icon + '" aria-hidden="true"></i>' +
      '<span>' + label + '</span>' +
    '</button>';
  }

  function setupBottomNavAutoHide(nav) {
    if (!nav || nav._ghAutoHideBound) return;
    nav._ghAutoHideBound = true;
    var lastY = window.scrollY || 0;
    window.addEventListener('scroll', function () {
      var y = window.scrollY || 0;
      if (Math.abs(y - lastY) < 8) return;
      nav.classList.toggle('is-hidden', y > lastY && y > 80);
      lastY = y;
    }, { passive: true });
  }

  function _mesc(s) {
    return String(s || '').replace(/[&<>'"]/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];
    });
  }

  function mobileMenuHtml() {
    // Same six destinations as the shell's rail — one list, one language.
    var T = (typeof window.GHt === 'function') ? window.GHt : function (k, f) { return f || k; };
    function row(href, icon, key, fallback, attrs) {
      return '<a class="gh-mobile-menu-row" href="' + href + '"' + (attrs || '') + '>' +
        '<i class="fas ' + icon + '"></i><span data-i18n="' + key + '">' +
        _mesc(T(key) !== key ? T(key) : fallback) + '</span></a>';
    }
    return '<div class="mobile-account-panel" id="ghMobileAccountSlot"></div>' +
      '<div class="mobile-menu-group"><div class="mobile-menu-title" data-i18n="nav_main">მთავარი</div>' +
        row('feed.html',        'fa-house',        'nav_feed',        'მთავარი') +
        row('map.html',         'fa-map',          'nav_map',         'რუკა') +
        row('videos.html',      'fa-film',         'nav_videos',      'ვიდეო') +
        row('marketplace.html', 'fa-bag-shopping', 'nav_marketplace', 'ბაზარი') +
        row('groups.html',      'fa-users',        'nav_groups',      'ჯგუფები') +
      '</div>' +
      '<div class="mobile-menu-group"><div class="mobile-menu-title" data-i18n="nav_account">ანგარიში</div>' +
        row(mobileMessagesHref(), 'fa-comment-dots', 'nav_messages', 'ჩატი', ' data-gh-actor-messages') +
        row('notifications.html', 'fa-bell',         'nav_notifications', 'შეტყობინებები') +
        row('add-business.html',  'fa-plus-circle',  'nav_add_business',  'ბიზნესის დამატება') +
        '<div id="ghMobileAuthActions"></div>' +
      '</div>';
  }


  function updateMobileAuthActions(user) {
    var slot = document.getElementById('ghMobileAuthActions');
    if (!slot) return;
    if (user) {
      var uid = user.uid || user.id || '';
      var name = _mesc(user.fullName || user.displayName || 'Profile');
      var href = uid ? 'profile.html?id=' + encodeURIComponent(uid) : 'profile.html';
      slot.innerHTML =
        '<a class="gh-mobile-menu-row" href="' + href + '">' +
          '<i class="fas fa-user"></i><span>' + name + '</span>' +
        '</a>' +
        '<a class="gh-mobile-menu-row" href="settings.html">' +
          '<i class="fas fa-gear"></i><span data-i18n="settings">პარამეტრები</span>' +
        '</a>' +
        '<button type="button" class="gh-mobile-menu-row mobile-menu-danger gh-mobile-menu-danger" data-gh-mobile-logout>' +
          '<i class="fas fa-right-from-bracket"></i><span data-i18n="signout">გასვლა</span>' +
        '</button>';
    } else {
      slot.innerHTML =
        '<a class="gh-mobile-menu-row" href="auth.html">' +
          '<i class="fas fa-sign-in-alt"></i><span>Login / Sign Up</span>' +
        '</a>';
    }
  }

  function tryUpdateMobileAuth() {
    var GF = window.GeoFirebase;
    if (!GF || !GF.auth) return false;
    updateMobileAuthActions(GF.auth.currentUser || null);
    if (GF.authFns && GF.authFns.onAuthStateChanged && !window.__ghMobileAuthBound) {
      window.__ghMobileAuthBound = true;
      GF.authFns.onAuthStateChanged(GF.auth, function(u) { updateMobileAuthActions(u || null); });
    }
    return true;
  }

  function ensureMobileOverlay() {
    var overlay = document.getElementById('gh-mobile-menu-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'gh-mobile-menu-overlay';
      overlay.className = 'gh-mobile-menu-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function ensureMobileMenu() {
    var menu = document.querySelector('.mobile-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'mobile-menu';
      document.body.appendChild(menu);
    }
    if (!menu.querySelector('#ghMobileAccountSlot')) menu.innerHTML = mobileMenuHtml();
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'GeoHub mobile menu');

    // Only at mobile widths: on desktop this id belongs to the rail's own
    // collapse control, and claiming it turned that button into a drawer toggle.
    var socialMenu = window.matchMedia('(max-width: 768px)').matches
      ? document.getElementById('ghSidebarToggle')
      : null;
    if (socialMenu && !socialMenu._ghMenuBound) {
      socialMenu._ghMenuBound = true;
      socialMenu.type = 'button';
      socialMenu.classList.add('gh-mobile-menu-btn');
      socialMenu.setAttribute('data-gh-mobile-menu-toggle', '');
      socialMenu.setAttribute('aria-label', T('menu_label','Menu'));
      socialMenu.title = T('menu_label','Menu');
      socialMenu.innerHTML = '<i class="fas fa-bars"></i>';
      socialMenu.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleMobileMenu();
      });
    }

    var hamburger = document.getElementById('geoHamburger');
    if (hamburger) {
      hamburger.removeAttribute('onclick'); // prevent double-toggle with inline onclick attr
      hamburger.type = 'button';
      hamburger.setAttribute('data-gh-mobile-menu-toggle', '');
      if (!hamburger._ghMenuBound) {
        hamburger._ghMenuBound = true;
        hamburger.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          toggleMobileMenu();
        });
      }
    }
    ensureMobileOverlay();
    return menu;
  }

  function ensureDesktopMenu() {
    var menu = document.querySelector('.gh-desktop-menu-dropdown');
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'gh-desktop-menu-dropdown';
      document.body.appendChild(menu);
    }
    menu.innerHTML = mobileMenuHtml();
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'GeoHub desktop menu');
    updateMobileAuthActions(getAuthUser());
    updateActorMessageLinks();
    return menu;
  }

  function isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function setMenuOpen(open) {
    var menu = ensureMobileMenu();
    var overlay = ensureMobileOverlay();
    var hamburger = document.getElementById('geoHamburger') || document.querySelector('.gh-mobile-menu-btn');
    if (!menu) return;
    if (open) document.body.classList.remove('gh-desktop-menu-open');
    if (open) {
      var desktopMenu = document.querySelector('.gh-desktop-menu-dropdown');
      if (desktopMenu) desktopMenu.classList.remove('open');
    }
    menu.classList.toggle('open', !!open);
    document.body.classList.toggle('gh-mobile-menu-open', !!open);
    if (overlay) overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (hamburger) {
      hamburger.classList.toggle('open', !!open);
      hamburger.setAttribute('aria-expanded', String(!!open));
    }
  }

  function setDesktopMenuOpen(open) {
    var menu = ensureDesktopMenu();
    var hamburger = document.getElementById('geoHamburger') || document.querySelector('.gh-mobile-menu-btn');
    if (!menu) return;
    document.body.classList.remove('gh-mobile-menu-open');
    var mobile = document.querySelector('.mobile-menu');
    if (mobile) mobile.classList.remove('open');
    var overlay = ensureMobileOverlay();
    if (overlay) overlay.setAttribute('aria-hidden', 'true');
    menu.classList.toggle('open', !!open);
    document.body.classList.toggle('gh-desktop-menu-open', !!open);
    if (hamburger) {
      hamburger.classList.toggle('open', !!open);
      hamburger.setAttribute('aria-expanded', String(!!open));
    }
  }

  function openMobileMenu() { setMenuOpen(true); }
  function closeMobileMenu() { setMenuOpen(false); }
  function openDesktopMenu() { setDesktopMenuOpen(true); }
  function closeDesktopMenu() { setDesktopMenuOpen(false); }
  function toggleMobileMenu() {
    if (!isMobileViewport()) {
      document.body.classList.remove('gh-mobile-menu-open');
      var isOpen = document.body.classList.contains('gh-desktop-menu-open');
      setDesktopMenuOpen(!isOpen);
      return;
    }
    var menu = ensureMobileMenu();
    setMenuOpen(!(menu && menu.classList.contains('open')));
  }

  window.geoOpenMenu = openMobileMenu;
  window.geoCloseMenu = closeMobileMenu;
  window.geoToggleMenu = toggleMobileMenu;
  window.openMobileMenu = openMobileMenu;
  window.closeMobileMenu = closeMobileMenu;
  window.toggleMobileMenu = toggleMobileMenu;
  window.closeDesktopMenu = closeDesktopMenu;
  window.refreshMobileNav = function() {
    ensureMobileMenu();
    ensureDesktopMenu();
    injectBottomNav();
    updateActorMessageLinks();
  };

  function bindMobileMenuEvents() {
    if (window.__ghMobileMenuEventsBound) return;
    window.__ghMobileMenuEventsBound = true;
    document.addEventListener('click', function(e) {
      var toggle = e.target.closest('[data-gh-mobile-menu-toggle]');
      if (toggle) {
        e.preventDefault();
        e.stopPropagation();
        if (!isMobileViewport()) {
          var isOpen = document.body.classList.contains('gh-desktop-menu-open');
          setDesktopMenuOpen(!isOpen);
        } else {
          var m = document.querySelector('.mobile-menu');
          setMenuOpen(!(m && m.classList.contains('open')));
        }
        return;
      }
      if (e.target.closest('#gh-mobile-menu-overlay')) {
        e.preventDefault();
        closeMobileMenu();
        return;
      }
      // Desktop dropdown: close when clicking outside the menu panel
      if (document.body.classList.contains('gh-desktop-menu-open')) {
        var dMenu = document.querySelector('.gh-desktop-menu-dropdown');
        if (dMenu && !dMenu.contains(e.target) && !e.target.closest('[data-gh-mobile-menu-toggle]')) {
          closeDesktopMenu();
        }
      }
      var menuLink = e.target.closest('.mobile-menu a, .gh-desktop-menu-dropdown a');
      if (menuLink) { closeMobileMenu(); closeDesktopMenu(); }
      var logout = e.target.closest('[data-gh-mobile-logout]');
      if (logout) {
        e.preventDefault();
        closeMobileMenu();
        closeDesktopMenu();
        var fb = window.GeoFirebase;
        if (fb && fb.authFns && fb.auth) fb.authFns.signOut(fb.auth).finally(function(){ location.href='auth.html'; });
        else if (fb && fb.auth && fb.auth.signOut) fb.auth.signOut().finally(function(){ location.href='auth.html'; });
      }
    }, true);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { closeMobileMenu(); closeDesktopMenu(); }
    });
    window.addEventListener('resize', function() {
      if (!isMobileViewport()) {
        document.body.classList.remove('gh-mobile-menu-open');
        var mobile = document.querySelector('.mobile-menu');
        if (mobile) mobile.classList.remove('open');
        var overlay = document.getElementById('gh-mobile-menu-overlay');
        if (overlay) overlay.setAttribute('aria-hidden', 'true');
      } else {
        closeDesktopMenu();
      }
    });
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
    sheet.setAttribute('aria-label', T('qa_sheet_label', 'Quick actions'));
    sheet.innerHTML =
      '<div class="app-action-sheet-handle" aria-hidden="true"></div>' +
      '<div class="app-action-sheet-title">'+T('cmd_quick_actions','Quick Actions')+'</div>' +
      actionItem('map.html',     'fas fa-location-dot',   'rgba(var(--ds-accent-rgb),0.15)', 'var(--ds-accent-hi)', T('qa_checkin','Quick Check-in'), T('qa_checkin_sub','Tag your location and earn XP')) +
      actionItem('feed.html',    'fas fa-pen-to-square',  'rgba(59,130,246,0.15)', '#60a5fa', T('qa_post','Create Post'), T('qa_post_sub','Share a place, tip, or update')) +
      actionItem('events.html',  'fas fa-calendar-plus',  'rgba(245,158,11,0.15)', '#fbbf24', T('qa_event','Create Event'), T('qa_event_sub','Organize a meetup or city event')) +
      actionItem('places.html',  'fas fa-location-dot',   'rgba(var(--ds-accent-rgb),0.12)', '#6ee7b7', T('qa_place','Find a Place'), T('qa_place_sub','Search for restaurants, cafes and more')) +
      '<div class="app-action-item" onclick="showStoryToast();closeActionSheet();" style="cursor:pointer">' +
        '<div class="app-action-icon" style="background:rgba(236,72,153,0.15);color:#f472b6"><i class="fas fa-circle-plus" aria-hidden="true"></i></div>' +
        '<div class="app-action-text"><h4>'+T('qa_story','Add Story')+'</h4><p>'+T('qa_story_sub','Share a 24h city moment')+'</p></div>' +
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

  // ── SMART INSTALL PROMPT (Phase 23) ──────────────────────────

  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstall = e;
    // Try to show banner if engagement already met
    _pwaCheckShow();
  });

  // Engagement tracker
  var _pwaEng = { score: 0, shown: false, timer: null };
  var _PWA_THRESHOLD = 3;          // engagement points needed
  var _PWA_SNOOZE_MS = 7 * 86400000; // 7 days

  function _pwaGetSnooze() {
    try { return parseInt(localStorage.getItem('gh_pwa_snooze') || '0', 10); } catch(e){ return 0; }
  }
  function _pwaSetSnooze() {
    try { localStorage.setItem('gh_pwa_snooze', String(Date.now() + _PWA_SNOOZE_MS)); } catch(e){}
  }
  function _pwaIsInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
  }
  function _pwaCanShow() {
    if (_pwaIsInstalled()) return false;
    if (_pwaEng.shown) return false;
    if (document.getElementById('app-install-prompt')) return false;
    if (_pwaGetSnooze() > Date.now()) return false;
    return true;
  }

  function _pwaAddScore(n) {
    _pwaEng.score += (n || 1);
    _pwaCheckShow();
  }

  function _pwaCheckShow() {
    if (!_pwaCanShow()) return;
    if (_pwaEng.score < _PWA_THRESHOLD) return;
    _showSmartInstallBanner();
  }

  function _showSmartInstallBanner() {
    if (!_pwaCanShow()) return;
    _pwaEng.shown = true;
    var ios = isIOS();

    var el = document.createElement('div');
    el.id = 'app-install-prompt';
    el.className = 'app-install-prompt gh-smart-install';
    el.setAttribute('role', 'complementary');
    el.setAttribute('aria-label', T('install_geohub','Install GeoHub'));
    el.innerHTML =
      '<button class="gh-sip-close" aria-label="Close" onclick="window.ghDismissInstall()">×</button>'+
      '<div class="gh-sip-left">'+
        '<div class="gh-sip-logo"><img src="icons/icon-192.png" alt="GeoHub" onerror="this.outerHTML=\'<span style=&quot;font-size:1.6rem;font-weight:900;color:var(--ds-accent-ink)&quot;>GH</span>\'"></div>'+
      '</div>'+
      '<div class="gh-sip-body">'+
        '<div class="gh-sip-title">GeoHub დააინსტალირე</div>'+
        '<div class="gh-sip-sub">სწრაფი წვდომა · offline-ი · შეტყობინებები</div>'+
        '<div class="gh-sip-feats">'+
          '<span>🚀 მომენტალური გახსნა</span>'+
          '<span>📴 Offline-ი</span>'+
          '<span>🔔 Push-ი</span>'+
        '</div>'+
      '</div>'+
      '<div class="gh-sip-actions">'+
        (ios
          ? '<button class="install-later gh-sip-later" onclick="window.ghDismissInstall()">მოგვიანებით</button>'+
            '<button class="install-now gh-sip-install" onclick="window.ghInstall()"><i class="fas fa-share-from-square"></i> დამატება</button>'
          : '<button class="install-later gh-sip-later" onclick="window.ghDismissInstall()">მოგვიანებით</button>'+
            '<button class="install-now gh-sip-install" onclick="window.ghInstall()"><i class="fas fa-download"></i> ინსტალაცია</button>'
        )+
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function(){ el.classList.add('visible'); document.body.classList.add('gh-install-visible'); });
    // Auto-dismiss after 25s
    setTimeout(function(){ if(el.parentNode) window.ghDismissInstall(); }, 25000);
  }

  // Expose engagement hook for geohub-social-redesign.js
  window.ghPwaEngage = _pwaAddScore;

  window.ghDismissInstall = function () {
    var el = document.getElementById('app-install-prompt');
    if (!el) return;
    el.classList.remove('visible');
    document.body.classList.remove('gh-install-visible');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
    _pwaSetSnooze();
  };

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function showInstallInstructions() {
    var old = document.getElementById('gh-install-help');
    if (old) old.remove();
    var modal = document.createElement('div');
    modal.id = 'gh-install-help';
    modal.className = 'gh-install-help';
    modal.innerHTML =
      '<div class="gh-install-sheet" role="dialog" aria-label="Install GeoHub">' +
        '<button type="button" class="gh-install-close" aria-label="Close">&times;</button>' +
        '<img src="icons/icon-192.png" alt="" class="gh-ish-icon" onerror="this.remove()">' +
        '<h3>GeoHub-ის დამატება</h3>' +
        '<p>iPhone-ზე მენიუდან "Add to Home Screen" აირჩიე:</p>' +
        '<ol>'+
          '<li>Safari-ში გახსენი Share (<i class="fas fa-share-from-square"></i>)</li>'+
          '<li>«Add to Home Screen» დააჭირე</li>'+
          '<li>«Add» / «დამატება» დაადასტურე</li>'+
        '</ol>' +
        '<button type="button" class="install-now gh-install-ok">გასაგებია!</button>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e){
      if(e.target === modal || e.target.closest('.gh-install-close,.gh-install-ok')) modal.remove();
    });
  }

  window.ghInstall = function () {
    if (deferredInstall) {
      deferredInstall.prompt();
      deferredInstall.userChoice.then(function(choice){
        deferredInstall = null;
        if (choice && choice.outcome === 'accepted') {
          // Thank-you toast
          setTimeout(function(){
            if(window.GeoSocial && window.GeoSocial.toast)
              window.GeoSocial.toast('🎉 GeoHub წარმატებით დაინსტალირდა!', 'success');
          }, 800);
        }
      });
      window.ghDismissInstall();
      return;
    }
    if (isIOS()) { showInstallInstructions(); return; }
    showInstallInstructions();
  };

  // ── Engagement scoring: time on page ─────────────────────────
  function injectInstallPrompt() {
    if (_pwaIsInstalled()) return;
    if (_pwaGetSnooze() > Date.now()) return;

    // 1. Score: time on page (30s = +2 pts, triggers alone; 15s = +1)
    setTimeout(function(){ _pwaAddScore(1); }, 15000);
    setTimeout(function(){ _pwaAddScore(2); }, 30000);

    // 2. Score: page-view counter (cross-page, stored in sessionStorage)
    try {
      var pv = parseInt(sessionStorage.getItem('gh_pv') || '0', 10) + 1;
      sessionStorage.setItem('gh_pv', String(pv));
      if (pv >= 3) _pwaEng.score += 2; // already explored several pages
    } catch(e){}
  }

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
      // Matches the page, not the brand: a bright green browser bar over a
      // near-black shell looked like a rendering fault on mobile.
      'theme-color': (function () {
        var t = '';
        try { t = localStorage.getItem('gh_theme') || ''; } catch (e) {}
        if (!t) t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
        return t === 'light' ? '#ffffff' : '#060a09';
      })(),
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
      '#gh-offline-banner{position:fixed;top:0;left:0;right:0;z-index:99999;background:var(--ds-danger-solid,#b91c1c);color:#fff;text-align:center;padding:10px 16px;font-size:0.83rem;font-weight:600;transform:translateY(-100%);transition:transform 0.28s ease;pointer-events:none;letter-spacing:.01em}',
      '#gh-offline-banner.visible{transform:translateY(0);pointer-events:auto}',
      '#gh-update-banner{position:fixed;bottom:0;left:0;right:0;z-index:99998;background:var(--ds-surface);border-top:2px solid rgba(var(--ds-accent-rgb),.5);color:var(--ds-text);display:flex;align-items:center;justify-content:center;gap:14px;padding:13px 16px;font-size:0.83rem;transform:translateY(100%);transition:transform 0.28s ease;pointer-events:none}',
      '#gh-update-banner.visible{transform:translateY(0);pointer-events:auto}',
      '#gh-update-banner strong{color:var(--ds-accent-ink)}',
      '#gh-update-banner button{background:var(--ds-accent-fill);color:var(--ds-accent-on);border:none;border-radius:8px;padding:7px 18px;font-size:0.78rem;font-weight:700;cursor:pointer;flex-shrink:0}',
      '#gh-update-banner button:hover{background:#0d9268}',
    ].join('');
    document.head.appendChild(style);

    var ob = document.createElement('div');
    ob.id = 'gh-offline-banner';
    ob.setAttribute('role', 'alert');
    ob.textContent = T('banner_offline', '\uD83D\uDCE1 You\'re offline — some features may not work');
    document.body.appendChild(ob);

    var ub = document.createElement('div');
    ub.id = 'gh-update-banner';
    ub.setAttribute('role', 'status');
    ub.innerHTML = '<span>\uD83C\uDF89 <strong>'+T('banner_update','New version available')+'</strong></span><button onclick="window.location.reload()">'+T('banner_reload','Reload')+'</button>';
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
    if (e.key === 'Escape') { closeActionSheet(); closeCmdPalette(); closeDesktopMenu(); }
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
      '#geo-cmd-box{width:100%;max-width:620px;background:var(--ds-surface);border:1px solid rgba(255,255,255,0.12);border-radius:18px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.05);animation:cmdIn 0.22s cubic-bezier(.34,1.56,.64,1)}',
      '@keyframes cmdIn{from{transform:scale(0.94) translateY(-12px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}',
      '#geo-cmd-input-row{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.07)}',
      '#geo-cmd-search-icon{color:var(--ds-text-3);font-size:0.92rem;flex-shrink:0}',
      '#geo-cmd-input{flex:1;background:none;border:none;outline:none;color:var(--ds-text);font-size:1rem;font-family:Inter,system-ui,sans-serif}',
      '#geo-cmd-input::placeholder{color:var(--ds-text-3)}',
      '#geo-cmd-kbd{font-size:0.62rem;color:var(--ds-text-3);background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:2px 6px;white-space:nowrap}',
      '#geo-cmd-sections{max-height:60vh;overflow-y:auto;scrollbar-width:none}',
      '#geo-cmd-sections::-webkit-scrollbar{display:none}',
      '.cmd-section-title{font-size:0.62rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--ds-text-3);padding:10px 16px 4px}',
      '.cmd-item{display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;transition:background 0.15s}',
      '.cmd-item:hover,.cmd-item.focused{background:rgba(var(--ds-accent-rgb),0.08)}',
      '.cmd-item-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0}',
      '.cmd-item-text{flex:1}',
      '.cmd-item-title{font-size:0.85rem;font-weight:700;color:var(--ds-text)}',
      '.cmd-item-sub{font-size:0.68rem;color:var(--ds-text-3)}',
      '.cmd-item-shortcut{font-size:0.6rem;color:var(--ds-text-3);background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:1px 5px}',
      '.cmd-divider{height:1px;background:rgba(255,255,255,0.06);margin:4px 0}',
      '.cmd-result-type{margin-left:auto;flex-shrink:0;padding:2px 6px;border-radius:4px;font-size:0.58rem;font-weight:800}',
      '#geo-cmd-footer{padding:8px 16px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px}',
      '.cmd-footer-hint{font-size:0.62rem;color:var(--ds-text-3);display:flex;align-items:center;gap:4px}',
    ].join('');
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.id  = 'geo-cmd-overlay';
    overlay.innerHTML = '<div id="geo-cmd-box">' +
      '<div id="geo-cmd-input-row">' +
        '<i class="fas fa-search" id="geo-cmd-search-icon"></i>' +
        '<input id="geo-cmd-input" placeholder="'+T('cmd_placeholder','Search GeoHub or run a command…')+'" autocomplete="off" spellcheck="false">' +
        '<span id="geo-cmd-kbd">ESC</span>' +
      '</div>' +
      '<div id="geo-cmd-sections"></div>' +
      '<div id="geo-cmd-footer">' +
        '<span class="cmd-footer-hint"><kbd style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:3px;padding:1px 4px;font-size:0.6rem">↑↓</kbd> '+T('cmd_navigate','navigate')+'</span>' +
        '<span class="cmd-footer-hint"><kbd style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:3px;padding:1px 4px;font-size:0.6rem">↵</kbd> '+T('cmd_open','open')+'</span>' +
        '<span class="cmd-footer-hint" style="margin-left:auto"><a href="search.html" style="color:var(--ds-accent-ink);text-decoration:none;font-weight:700;font-size:0.68rem">'+T('cmd_full_search','Full Search →')+'</a></span>' +
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
    { icon:'📍', bg:'rgba(var(--ds-accent-rgb),0.15)', color:'var(--ds-accent-hi)', title:'Create Check-in',    sub:'Tag your location + camera proof', url:'checkin.html',    shortcut:'' },
    { icon:'🤖', bg:'rgba(168,85,247,0.15)', color:'#c084fc', title:'Open AI Assistant',  sub:'Get a smart city day plan',        url:'assistant.html',  shortcut:'' },
    { icon:'🎁', bg:'rgba(245,158,11,0.15)', color:'#fbbf24', title:'View Rewards',        sub:'Claim GeoPoints & partner offers',  url:'rewards.html',    shortcut:'' },
    { icon:'⚡', bg:'rgba(59,130,246,0.15)',  color:'#60a5fa', title:'Start Challenge',     sub:'Missions, XP, and badges',         url:'challenges.html', shortcut:'' },
    { icon:'📡', bg:'rgba(239,68,68,0.15)',   color:'#f87171', title:'Open Live City',      sub:'Live check-ins and city pulse',     url:'live.html',       shortcut:'' },
    { icon:'💬', bg:'rgba(236,72,153,0.15)',  color:'#f472b6', title:'Messages',            sub:'Chat with people you follow',       url:'messages.html',   shortcut:'' },
    { icon:'🇬🇪', bg:'rgba(249,115,22,0.15)',  color:'#fb923c', title:'Patriot Missions',   sub:'Civic tasks + Patriot XP',          url:'patriot.html',    shortcut:'' },
    { icon:'⭐', bg:'rgba(var(--ds-accent-rgb),0.15)',  color:'var(--ds-accent-hi)', title:'Reviews Hub',         sub:'Write or browse trusted reviews',   url:'reviews.html',    shortcut:'' },
  ];

  function renderCmdResults(q) {
    var sections = document.getElementById('geo-cmd-sections');
    if (!sections) return;

    if (!q.trim()) {
      var recentHtml = '';
      if (typeof GeoSearch !== 'undefined') {
        var recent = GeoSearch.getRecent().slice(0, 4);
        if (recent.length) {
          recentHtml = '<div class="cmd-section-title">'+T('cmd_recent','Recent Searches')+'</div>' +
            recent.map(function (r) {
              return '<div class="cmd-item" onclick="location.href=\'search.html?q=' + encodeURIComponent(r) + '\'">' +
                '<div class="cmd-item-icon" style="background:rgba(255,255,255,0.04);color:var(--ds-text-3)"><i class="fas fa-clock"></i></div>' +
                '<div class="cmd-item-text"><div class="cmd-item-title">' + r + '</div></div></div>';
            }).join('') + '<div class="cmd-divider"></div>';
        }
      }

      sections.innerHTML = recentHtml +
        '<div class="cmd-section-title">'+T('cmd_quick_actions','Quick Actions')+'</div>' +
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
        '<div class="cmd-item-icon" style="background:rgba(var(--ds-accent-rgb),0.1);color:var(--ds-accent-ink)"><i class="fas fa-search"></i></div>' +
        '<div class="cmd-item-text"><div class="cmd-item-title">Search for "' + q + '"</div><div class="cmd-item-sub">Open full search</div></div>' +
        '</div>';
      return;
    }

    var results = GeoSearch.search(q).slice(0, 7);
    var tm = GeoSearch.TYPE_META;

    var html = '<div class="cmd-section-title">' + results.length + ' results</div>';
    if (!results.length) {
      html = '<div class="cmd-item"><div class="cmd-item-icon" style="background:rgba(255,255,255,0.04);color:var(--ds-text-3)"><i class="fas fa-search"></i></div>' +
        '<div class="cmd-item-text"><div class="cmd-item-title" style="color:var(--ds-text-3)">No results for "' + q + '"</div></div></div>';
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
        '<div class="cmd-item-icon" style="background:rgba(var(--ds-accent-rgb),0.1);color:var(--ds-accent-ink)"><i class="fas fa-external-link-alt"></i></div>' +
        '<div class="cmd-item-text"><div class="cmd-item-title" style="color:var(--ds-accent-ink)">See all results for "' + q + '"</div></div></div>';
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
    ensureMobileMenu();
    bindMobileMenuEvents();
    injectBottomNav();
    updateActorMessageLinks();
    injectActionSheet();
    injectNotifContainer();
    injectOfflineBanner();
    setupConnectivityListeners();
    injectInstallPrompt();
    injectCmdPalette();
    registerSW();
    startNotifCycle();
    setTimeout(function(){ ensureMobileMenu(); injectBottomNav(); updateActorMessageLinks(); }, 400);
    setTimeout(function(){ ensureMobileMenu(); injectBottomNav(); updateActorMessageLinks(); }, 1200);
    window.addEventListener('GeoActorChanged', updateActorMessageLinks);

    if (!tryUpdateMobileAuth()) {
      var _authPoll = setInterval(function() {
        if (tryUpdateMobileAuth()) clearInterval(_authPoll);
      }, 300);
      setTimeout(function() { clearInterval(_authPoll); }, 8000);
    }
    window.addEventListener('GeoFirebaseReady', tryUpdateMobileAuth);
    window.addEventListener('GeoAuthReady', function(e) {
      updateMobileAuthActions(e && e.detail || null);
      tryUpdateMobileAuth();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
