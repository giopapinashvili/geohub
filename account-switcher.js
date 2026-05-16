/* ================================================================
   GeoHub — Account Switcher (v2)
   Injects an account dropdown into the navbar.

   Strategy: account.js overwrites .navbar-actions innerHTML via an
   async loadProfile() call, destroying any element we inject during
   the onAuthStateChanged sync window. We solve this by:
   1. Listening for the 'GeoAuthReady' event (dispatched by account.js
      AFTER it has finished injecting #authNavUser).
   2. Replacing #authNavUser (account.js's element) with our wrap.
   3. Using a MutationObserver as a catch-all for re-renders
      (e.g., after settings save).
   ================================================================ */
(function () {
  'use strict';

  var _db, _fs;
  var _user = null;
  var _businesses = [];
  var _groups = [];
  var _isOpen = false;
  var _outsideClickBound = false;
  var _observer = null;

  /* ── helpers ───────────────────────────────────────────────── */

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── dropdown HTML ─────────────────────────────────────────── */

  function renderDropdown() {
    if (!_user) return '';

    var avatarContent = _user.photoURL
      ? '<img src="'+esc(_user.photoURL)+'" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">'
      : esc((_user.displayName || _user.email || 'U').charAt(0).toUpperCase());

    var profileSection =
      '<a class="geo-sw-profile" href="profile.html">'+
        '<div class="geo-sw-profile-avatar">'+avatarContent+'</div>'+
        '<div>'+
          '<div class="geo-sw-profile-name">'+esc(_user.displayName || (_user.email||'').split('@')[0] || 'User')+'</div>'+
          '<div class="geo-sw-profile-email">'+esc(_user.email||'')+'</div>'+
        '</div>'+
      '</a>';

    var bizSection = '';
    if (_businesses.length) {
      bizSection = '<div class="geo-sw-divider"></div><div class="geo-sw-section-label">Your Pages</div>';
      _businesses.forEach(function(biz) {
        var iconInner = biz.logoUrl
          ? '<img src="'+esc(biz.logoUrl)+'" alt="">'
          : '<i class="fas fa-store"></i>';
        bizSection +=
          '<a class="geo-sw-item" href="business.html?id='+esc(biz.id)+'">'+
            '<div class="geo-sw-item-icon biz">'+iconInner+'</div>'+
            '<span class="geo-sw-item-name">'+esc(biz.title||'Business')+'</span>'+
            '<span class="geo-sw-owner-pill">Owner</span>'+
          '</a>';
      });
    }

    var bottomSection =
      '<div class="geo-sw-divider"></div>'+
      '<a class="geo-sw-item" href="add-business.html">'+
        '<div class="geo-sw-item-icon create"><i class="fas fa-plus"></i></div>'+
        '<span class="geo-sw-item-name">Create Page</span>'+
      '</a>'+
      '<div class="geo-sw-divider"></div>'+
      '<a class="geo-sw-item" href="profile.html">'+
        '<div class="geo-sw-item-icon settings"><i class="fas fa-gear"></i></div>'+
        '<span class="geo-sw-item-name">Settings & Profile</span>'+
      '</a>'+
      '<button class="geo-sw-item" onclick="window._geoSW.signOut()" style="font-family:inherit">'+
        '<div class="geo-sw-item-icon signout"><i class="fas fa-arrow-right-from-bracket"></i></div>'+
        '<span class="geo-sw-item-name" style="color:#f87171">Sign Out</span>'+
      '</button>';

    var groupSection = '';
    if (_groups && _groups.length) {
      groupSection = '<div class="geo-sw-divider"></div><div class="geo-sw-section-label">Your Groups</div>';
      _groups.forEach(function(g) {
        groupSection +=
          '<a class="geo-sw-item" href="groups.html?id='+esc(g.id)+'">'+
            '<div class="geo-sw-item-icon biz"><i class="fas fa-users"></i></div>'+
            '<span class="geo-sw-item-name">'+esc(g.name||'Group')+'</span>'+
            '<span class="geo-sw-owner-pill">Admin</span>'+
          '</a>';
      });
    }

    return profileSection + bizSection + groupSection + bottomSection;
  }

  /* ── button label HTML ─────────────────────────────────────── */

  function btnLabelHtml() {
    if (!_user) return '';
    var avatarHtml = _user.photoURL
      ? '<img src="'+esc(_user.photoURL)+'" alt="" class="geo-sw-avatar" style="object-fit:cover" onerror="this.style.display=\'none\'">'
      : '<div class="geo-sw-avatar">'+esc((_user.displayName||_user.email||'U').charAt(0).toUpperCase())+'</div>';
    var name = _user.displayName || (_user.email||'').split('@')[0] || 'Account';
    return avatarHtml +
      '<span style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem">'+esc(name)+'</span>'+
      '<i class="fas fa-chevron-down geo-sw-chevron"></i>';
  }

  /* ── toggle ────────────────────────────────────────────────── */

  function toggle(e) {
    if (e) e.stopPropagation();
    _isOpen ? close() : open();
  }

  function open() {
    _isOpen = true;
    var btn = document.getElementById('geo-sw-btn');
    var dropdown = document.getElementById('geo-sw-dropdown');
    if (btn) btn.classList.add('open');
    if (dropdown) {
      dropdown.innerHTML = renderDropdown();
      // Position dropdown below the button using fixed coords
      var rect = btn ? btn.getBoundingClientRect() : null;
      if (rect) {
        var top = rect.bottom + 8;
        var right = window.innerWidth - rect.right;
        dropdown.style.top = top + 'px';
        dropdown.style.right = right + 'px';
        dropdown.style.left = 'auto';
      }
      dropdown.classList.add('open');
    }
    console.log('[AccountSwitcher] dropdown opened');
  }

  function close() {
    _isOpen = false;
    var btn = document.getElementById('geo-sw-btn');
    var dropdown = document.getElementById('geo-sw-dropdown');
    if (btn) btn.classList.remove('open');
    if (dropdown) dropdown.classList.remove('open');
  }

  /* ── mount ─────────────────────────────────────────────────── */

  function mountWrap(replaceTarget) {
    if (!_user) return;

    // Remove stale wrap if any
    var old = document.getElementById('geo-sw-wrap');
    if (old) old.remove();

    var wrap = document.createElement('div');
    wrap.id = 'geo-sw-wrap';
    wrap.className = 'geo-sw-wrap';

    var btn = document.createElement('button');
    btn.id = 'geo-sw-btn';
    btn.className = 'geo-sw-btn';
    btn.setAttribute('aria-label', 'Account switcher');
    btn.setAttribute('aria-haspopup', 'true');
    btn.innerHTML = btnLabelHtml();
    btn.addEventListener('click', toggle);
    wrap.appendChild(btn);

    var dropdown = document.createElement('div');
    dropdown.id = 'geo-sw-dropdown';
    dropdown.className = 'geo-sw-dropdown';
    dropdown.setAttribute('role', 'menu');
    wrap.appendChild(dropdown);

    // Try replacing #authNavUser (the account.js element) if supplied
    if (replaceTarget && replaceTarget.parentNode) {
      replaceTarget.parentNode.replaceChild(wrap, replaceTarget);
      console.log('[AccountSwitcher] mounted — replaced #authNavUser');
    } else {
      // Fallback: find navbar-actions (multiple selector variants)
      var actions = document.querySelector(
        '.navbar-actions, .nav-actions, [data-navbar-actions], .topbar-actions'
      );
      if (actions) {
        actions.appendChild(wrap);
        console.log('[AccountSwitcher] mounted — appended to navbar-actions');
      } else {
        var navbar = document.querySelector('.navbar, header');
        if (navbar) { navbar.appendChild(wrap); console.log('[AccountSwitcher] mounted — appended to navbar'); }
        else { document.body.appendChild(wrap); console.warn('[AccountSwitcher] mounted — fallback to body'); }
      }
    }

    // Bind outside-click once
    if (!_outsideClickBound) {
      _outsideClickBound = true;
      document.addEventListener('click', function(e) {
        if (!_isOpen) return;
        var w = document.getElementById('geo-sw-wrap');
        if (w && !w.contains(e.target)) close();
      });
    }
  }

  /* ── observe navbar for re-renders (account.js may re-run initAuthNav) ── */

  function startObserver() {
    if (_observer) { _observer.disconnect(); _observer = null; }
    var root = document.querySelector('.navbar, header, .navbar-actions') || document.body;
    _observer = new MutationObserver(function() {
      if (!_user) return;
      var authUser = document.getElementById('authNavUser');
      var ourWrap  = document.getElementById('geo-sw-wrap');
      // account.js injected its UI and destroyed ours → replace
      if (authUser && !ourWrap) {
        console.log('[AccountSwitcher] re-mounting after navbar re-render');
        mountWrap(authUser);
      }
    });
    _observer.observe(root, { childList: true, subtree: true });
    console.log('[AccountSwitcher] observer started');
  }

  /* ── GeoAuthReady: fired by account.js after initAuthNav() ── */

  window.addEventListener('GeoAuthReady', function(e) {
    var profile = e.detail;
    if (!profile) return;
    // Normalise to the shape our renderer expects
    _user = {
      displayName: profile.fullName || profile.displayName || profile.username || '',
      email: profile.email || '',
      photoURL: profile.avatar || profile.photoURL || '',
      uid: profile.uid || profile.id || ''
    };
    console.log('[AccountSwitcher] user ready via GeoAuthReady:', _user.email);
    var authUser = document.getElementById('authNavUser');
    mountWrap(authUser || null);
    if (_user.uid) { loadUserBusinesses(_user.uid); loadUserGroups(_user.uid); }
    startObserver();
  });

  /* ── data ──────────────────────────────────────────────────── */

  function loadUserBusinesses(uid) {
    if (!_db || !_fs) return;
    _businesses = [];
    var q = _fs.query(
      _fs.collection(_db, 'businessAdmins'),
      _fs.where('userId', '==', uid),
      _fs.limit(10)
    );
    _fs.getDocs(q).then(function(snap) {
      if (!snap.size) return null;
      var bizIds = [];
      snap.forEach(function(d) {
        var id = d.id.replace('_' + uid, '');
        if (id) bizIds.push(id);
      });
      return Promise.all(bizIds.map(function(id) {
        return _fs.getDoc(_fs.doc(_db, 'businesses', id))
          .then(function(d) { return d.exists() ? Object.assign({id: d.id}, d.data()) : null; })
          .catch(function() { return null; });
      }));
    }).then(function(results) {
      if (!results) return;
      _businesses = results.filter(Boolean);
      // Refresh button label in dropdown if open
      if (_isOpen) {
        var dd = document.getElementById('geo-sw-dropdown');
        if (dd && dd.classList.contains('open')) dd.innerHTML = renderDropdown();
      }
    }).catch(function() {});
  }

  function loadUserGroups(uid) {
    if (!_db || !_fs) return;
    _groups = [];
    _fs.getDocs(_fs.query(
      _fs.collection(_db, 'groups'),
      _fs.where('ownerId', '==', uid),
      _fs.limit(5)
    )).then(function(snap) {
      snap.forEach(function(d) { _groups.push(Object.assign({id: d.id}, d.data())); });
      if (_isOpen) {
        var dd = document.getElementById('geo-sw-dropdown');
        if (dd && dd.classList.contains('open')) dd.innerHTML = renderDropdown();
      }
    }).catch(function() {});
  }

  /* ── init ──────────────────────────────────────────────────── */

  function init(fb) {
    _db = fb.db; _fs = fb.fs;
    console.log('[AccountSwitcher] loaded, Firebase ready');
    // GeoAuthReady handler above handles the primary mount.
    // If GeoAuthReady already fired before this script loaded (unlikely
    // with defer, but handle it), check for #authNavUser immediately.
    if (window.GeoCurrentUser && window.GeoCurrentUser.uid) {
      _user = {
        displayName: window.GeoCurrentUser.fullName || window.GeoCurrentUser.displayName || '',
        email: window.GeoCurrentUser.email || '',
        photoURL: window.GeoCurrentUser.avatar || window.GeoCurrentUser.photoURL || '',
        uid: window.GeoCurrentUser.uid
      };
      var authUser = document.getElementById('authNavUser');
      if (authUser) {
        console.log('[AccountSwitcher] late-init: replacing existing #authNavUser');
        mountWrap(authUser);
        loadUserBusinesses(_user.uid);
        loadUserGroups(_user.uid);
        startObserver();
      } else {
        startObserver(); // observe for when account.js finishes
      }
    } else {
      startObserver(); // observe for when account.js finishes
    }
  }

  /* ── public API ────────────────────────────────────────────── */

  window._geoSW = {
    close: close,
    open: open,
    signOut: function() {
      var fb = window.GeoFirebase;
      if (fb && fb.auth && fb.authFns) {
        fb.authFns.signOut(fb.auth)
          .then(function() { window.location.href = 'index.html'; })
          .catch(function() {});
      }
    }
  };

  if (window.GeoFirebase && window.GeoFirebase.db) init(window.GeoFirebase);
  else window.addEventListener('GeoFirebaseReady', function() { init(window.GeoFirebase); }, {once: true});

})();
