/* ================================================================
   GeoHub — Demo Mode Helper
   Floating panel for presentation / QA use.
   Toggle with: Ctrl+Shift+D  or  double-tap logo
   ================================================================ */

(function () {
  'use strict';

  var DEMO_KEY = 'geohub_demo_open';
  var isOpen = false;

  // ── CORE PAGES FOR QUICK NAV ─────────────────────────────────
  var CORE_LOOP = [
    { label: 'Home',        href: 'index.html',      icon: '🏠' },
    { label: 'Get Started', href: 'onboarding.html',  icon: '🚀' },
    { label: 'Discover',    href: 'feed.html',         icon: '🔍' },
    { label: 'Live City',   href: 'live.html',         icon: '📡' },
    { label: 'Map',         href: 'map.html',          icon: '🗺️' },
    { label: 'Rewards',     href: 'rewards.html',      icon: '🎁' },
    { label: 'Challenges',  href: 'challenges.html',   icon: '🏆' },
    { label: 'AI Plan',     href: 'assistant.html',    icon: '✨' },
    { label: 'Profile',     href: 'profile.html',      icon: '👤' },
    { label: 'Messages',    href: 'messages.html',     icon: '💬' },
    { label: 'Dashboard',   href: 'dashboard.html',    icon: '📊' },
    { label: 'Events',      href: 'events.html',       icon: '🎪' },
    { label: 'Groups',      href: 'groups.html',       icon: '👥' },
    { label: 'Creators',    href: 'creators.html',     icon: '🎨' },
    { label: 'Trust',       href: 'trust.html',        icon: '🛡️' },
    { label: 'Life Graph',  href: 'lifegraph.html',    icon: '🧬' },
    { label: 'Stories',     href: 'stories.html',      icon: '▶️' },
    { label: 'Real Estate', href: 'real-estate.html',  icon: '🏠' },
    { label: 'Learning',    href: 'learning.html',     icon: '📚' },
    { label: 'Services',    href: 'services.html',     icon: '🔧' },
    { label: 'Places',      href: 'places.html',       icon: '📍' },
    { label: 'Add Business',href: 'add-business.html', icon: '🏪' },
  ];

  var currentPage = window.location.pathname.split('/').pop() || 'index.html';

  // ── INJECT STYLES ─────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('demo-mode-styles')) return;
    var s = document.createElement('style');
    s.id = 'demo-mode-styles';
    s.textContent = [
      '.demo-fab{position:fixed;bottom:calc(78px + env(safe-area-inset-bottom,0px));right:16px;z-index:9990;',
        'width:44px;height:44px;border-radius:12px;background:rgba(17,24,39,0.92);border:1.5px solid rgba(16,185,129,0.4);',
        'color:#10b981;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;',
        'box-shadow:0 4px 20px rgba(0,0,0,0.6);transition:all .2s;backdrop-filter:blur(12px);}',
      '.demo-fab:hover{background:rgba(16,185,129,0.15);transform:scale(1.05);}',
      '@media(min-width:769px){.demo-fab{bottom:20px;}}',
      '.demo-panel{position:fixed;bottom:calc(132px + env(safe-area-inset-bottom,0px));right:16px;z-index:9989;',
        'width:280px;border-radius:14px;background:rgba(10,14,28,0.97);border:1px solid rgba(16,185,129,0.25);',
        'box-shadow:0 16px 48px rgba(0,0,0,0.8);backdrop-filter:blur(20px);',
        'transform:translateY(12px) scale(0.96);opacity:0;pointer-events:none;',
        'transition:all .28s cubic-bezier(.34,1.56,.64,1);max-height:70vh;overflow:hidden;display:flex;flex-direction:column;}',
      '.demo-panel.open{transform:translateY(0) scale(1);opacity:1;pointer-events:all;}',
      '@media(min-width:769px){.demo-panel{bottom:76px;}}',
      '.demo-header{padding:12px 14px 8px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;}',
      '.demo-header h4{font-size:0.8rem;font-weight:900;color:#34d399;text-transform:uppercase;letter-spacing:.8px;margin-bottom:2px;}',
      '.demo-header p{font-size:0.68rem;color:#4b5563;}',
      '.demo-actions{padding:8px;display:flex;flex-direction:column;gap:4px;flex-shrink:0;}',
      '.demo-btn{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:8px;border:none;',
        'background:rgba(255,255,255,0.04);color:#94a3b8;font-size:0.78rem;font-weight:600;cursor:pointer;',
        'transition:background .15s;text-align:left;width:100%;}',
      '.demo-btn:hover{background:rgba(255,255,255,0.08);color:#f1f5f9;}',
      '.demo-btn i{color:#10b981;width:14px;text-align:center;font-size:0.74rem;}',
      '.demo-btn.danger i{color:#f87171;}',
      '.demo-btn.danger:hover{background:rgba(239,68,68,0.08);}',
      '.demo-divider{height:1px;background:rgba(255,255,255,0.06);margin:4px 8px;}',
      '.demo-nav-label{font-size:0.66rem;font-weight:900;text-transform:uppercase;letter-spacing:.8px;',
        'color:#2a3d58;padding:6px 12px 4px;}',
      '.demo-nav-list{overflow-y:auto;flex:1;padding:0 8px 8px;scrollbar-width:none;}',
      '.demo-nav-list::-webkit-scrollbar{display:none;}',
      '.demo-nav-link{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;',
        'color:#94a3b8;font-size:0.78rem;font-weight:500;text-decoration:none;cursor:pointer;',
        'transition:all .15s;background:none;border:none;width:100%;text-align:left;}',
      '.demo-nav-link:hover{background:rgba(16,185,129,0.07);color:#f1f5f9;}',
      '.demo-nav-link.current{background:rgba(16,185,129,0.1);color:#34d399;font-weight:700;}',
      '.demo-nav-link .pg-emoji{font-size:0.88rem;width:20px;text-align:center;flex-shrink:0;}',
      '.demo-toast{position:fixed;top:80px;left:50%;transform:translateX(-50%) translateY(-8px);',
        'background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);color:#34d399;',
        'padding:8px 18px;border-radius:8px;font-size:0.8rem;font-weight:700;',
        'opacity:0;pointer-events:none;transition:all .25s;z-index:9999;white-space:nowrap;}',
      '.demo-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── BUILD PANEL ───────────────────────────────────────────────
  function buildPanel() {
    var navLinks = CORE_LOOP.map(function (p) {
      var isCurrent = currentPage === p.href;
      return '<a href="' + p.href + '" class="demo-nav-link' + (isCurrent ? ' current' : '') + '">' +
        '<span class="pg-emoji">' + p.icon + '</span>' + p.label + (isCurrent ? ' ←' : '') + '</a>';
    }).join('');

    return '<div class="demo-header">' +
      '<h4>🎯 GeoHub Demo Mode</h4>' +
      '<p>Presentation helper — not visible to users</p>' +
    '</div>' +
    '<div class="demo-actions">' +
      '<button class="demo-btn" onclick="ghDemoReset()"><i class="fas fa-rotate"></i> Reset mock data</button>' +
      '<button class="demo-btn" onclick="ghDemoClearStorage()"><i class="fas fa-trash-can"></i> Clear localStorage</button>' +
      '<button class="demo-btn" onclick="ghDemoRestartOnboarding()"><i class="fas fa-user-plus"></i> Restart onboarding</button>' +
      '<button class="demo-btn" onclick="ghDemoOpenLoop()"><i class="fas fa-play"></i> Start core loop</button>' +
      '<div class="demo-divider"></div>' +
      '<button class="demo-btn danger" onclick="ghDemoClose()"><i class="fas fa-xmark"></i> Close Demo Panel</button>' +
    '</div>' +
    '<div class="demo-nav-label">All Pages</div>' +
    '<div class="demo-nav-list">' + navLinks + '</div>';
  }

  // ── INJECT DOM ────────────────────────────────────────────────
  function inject() {
    if (document.getElementById('demo-fab')) return;

    var fab = document.createElement('button');
    fab.id = 'demo-fab';
    fab.className = 'demo-fab';
    fab.title = 'Demo Mode (Ctrl+Shift+D)';
    fab.setAttribute('aria-label', 'Toggle demo panel');
    fab.innerHTML = '<i class="fas fa-flask"></i>';
    fab.addEventListener('click', togglePanel);
    document.body.appendChild(fab);

    var panel = document.createElement('div');
    panel.id = 'demo-panel';
    panel.className = 'demo-panel';
    panel.innerHTML = buildPanel();
    document.body.appendChild(panel);

    var toast = document.createElement('div');
    toast.id = 'demo-toast';
    toast.className = 'demo-toast';
    document.body.appendChild(toast);
  }

  function togglePanel() {
    isOpen = !isOpen;
    var panel = document.getElementById('demo-panel');
    var fab = document.getElementById('demo-fab');
    if (!panel) return;
    panel.classList.toggle('open', isOpen);
    fab.innerHTML = isOpen ? '<i class="fas fa-xmark"></i>' : '<i class="fas fa-flask"></i>';
  }

  // ── DEMO ACTIONS ──────────────────────────────────────────────
  window.ghDemoClose = function () {
    isOpen = false;
    var panel = document.getElementById('demo-panel');
    var fab = document.getElementById('demo-fab');
    if (panel) panel.classList.remove('open');
    if (fab) fab.innerHTML = '<i class="fas fa-flask"></i>';
  };

  window.ghDemoReset = function () {
    showDemoToast('Mock data reset ✓');
    setTimeout(function () { window.location.reload(); }, 800);
  };

  window.ghDemoClearStorage = function () {
    try { localStorage.setItem('geohub_signed_out', '1'); } catch (e) {}
    function clearAndReload() {
      try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
      showDemoToast('Storage cleared ✓');
      setTimeout(function () { window.location.reload(); }, 800);
    }
    if (window.GeoFirebaseAuth) {
      window.GeoFirebaseAuth.logout().then(clearAndReload).catch(clearAndReload);
    } else {
      clearAndReload();
    }
  };

  window.ghDemoRestartOnboarding = function () {
    try { localStorage.removeItem('geohub_onboarding'); } catch (e) {}
    showDemoToast('Onboarding reset ✓');
    setTimeout(function () { window.location.href = 'onboarding.html'; }, 600);
  };

  window.ghDemoOpenLoop = function () {
    window.location.href = 'index.html';
  };

  function showDemoToast(msg) {
    var t = document.getElementById('demo-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showDemoToast._t);
    showDemoToast._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  // ── KEYBOARD SHORTCUT ─────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      togglePanel();
    }
  });

  // ── INIT ──────────────────────────────────────────────────────
  function init() {
    injectStyles();
    inject();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
