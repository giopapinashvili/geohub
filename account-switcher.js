/* ================================================================
   GeoHub — Account Switcher
   Injects an account dropdown into .navbar-actions on any page
   ================================================================ */
(function () {
  'use strict';

  var _db, _fs, _auth;
  var _user = null;
  var _businesses = [];
  var _isOpen = false;

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Render dropdown content ────────────────────────────────────

  function renderDropdown() {
    if (!_user) return '';

    var avatarContent = _user.photoURL
      ? '<img src="'+esc(_user.photoURL)+'" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">'
      : (_user.displayName || _user.email || 'U').charAt(0).toUpperCase();

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
        '<span class="geo-sw-item-name">Create Business Page</span>'+
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

    return profileSection + bizSection + bottomSection;
  }

  // ── Inject button into navbar ─────────────────────────────────

  function injectBtn() {
    if (document.getElementById('geo-sw-wrap')) return;

    var wrap = document.createElement('div');
    wrap.id = 'geo-sw-wrap';
    wrap.className = 'geo-sw-wrap';

    var btn = document.createElement('button');
    btn.id = 'geo-sw-btn';
    btn.className = 'geo-sw-btn';
    btn.setAttribute('aria-label', 'Account switcher');
    btn.setAttribute('aria-haspopup', 'true');
    btn.onclick = toggle;
    wrap.appendChild(btn);

    var dropdown = document.createElement('div');
    dropdown.id = 'geo-sw-dropdown';
    dropdown.className = 'geo-sw-dropdown';
    dropdown.setAttribute('role', 'menu');
    wrap.appendChild(dropdown);

    // Insert at start of navbar-actions (before any other action buttons)
    var actions = document.querySelector('.navbar-actions');
    if (actions) {
      actions.insertBefore(wrap, actions.firstChild);
    } else {
      // Fallback: try appending to navbar
      var nav = document.querySelector('.navbar');
      if (nav) nav.appendChild(wrap);
    }

    // Close on outside click
    document.addEventListener('click', function(e) {
      var w = document.getElementById('geo-sw-wrap');
      if (w && !w.contains(e.target)) close();
    });
  }

  function updateBtnLabel() {
    var btn = document.getElementById('geo-sw-btn');
    if (!btn || !_user) return;

    var avatarHtml = _user.photoURL
      ? '<img src="'+esc(_user.photoURL)+'" alt="" class="geo-sw-avatar" style="object-fit:cover" onerror="this.style.display=\'none\'">'
      : '<div class="geo-sw-avatar">'+(_user.displayName||_user.email||'U').charAt(0).toUpperCase()+'</div>';

    var name = _user.displayName || (_user.email||'').split('@')[0] || 'Account';
    btn.innerHTML =
      avatarHtml +
      '<span style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem">'+esc(name)+'</span>'+
      '<i class="fas fa-chevron-down geo-sw-chevron"></i>';
  }

  // ── Toggle ────────────────────────────────────────────────────

  function toggle() { _isOpen ? close() : open(); }

  function open() {
    _isOpen = true;
    var btn = document.getElementById('geo-sw-btn');
    var dropdown = document.getElementById('geo-sw-dropdown');
    if (btn) btn.classList.add('open');
    if (dropdown) {
      dropdown.innerHTML = renderDropdown();
      dropdown.classList.add('open');
    }
  }

  function close() {
    _isOpen = false;
    var btn = document.getElementById('geo-sw-btn');
    var dropdown = document.getElementById('geo-sw-dropdown');
    if (btn) btn.classList.remove('open');
    if (dropdown) dropdown.classList.remove('open');
  }

  // ── Data ──────────────────────────────────────────────────────

  function loadUserBusinesses(uid) {
    _businesses = [];
    var q = _fs.query(
      _fs.collection(_db, 'businessAdmins'),
      _fs.where('userId', '==', uid),
      _fs.limit(10)
    );
    _fs.getDocs(q).then(function(snap) {
      if (!snap.size) return;
      var bizIds = [];
      snap.forEach(function(d) {
        // doc id format: bizId_userId — extract bizId (everything before last underscore+uid)
        var id = d.id.replace('_'+uid, '');
        if (id) bizIds.push(id);
      });
      if (!bizIds.length) return;
      return Promise.all(bizIds.map(function(id) {
        return _fs.getDoc(_fs.doc(_db, 'businesses', id))
          .then(function(d) { return d.exists() ? Object.assign({id: d.id}, d.data()) : null; })
          .catch(function() { return null; });
      }));
    }).then(function(results) {
      if (!results) return;
      _businesses = results.filter(Boolean);
    }).catch(function() {});
  }

  // ── Init ──────────────────────────────────────────────────────

  function init(fb) {
    _db = fb.db; _fs = fb.fs; _auth = fb.auth;

    fb.authFns.onAuthStateChanged(_auth, function(user) {
      _user = user;
      if (user) {
        injectBtn();
        updateBtnLabel();
        loadUserBusinesses(user.uid);
      } else {
        _businesses = [];
        close();
        var wrap = document.getElementById('geo-sw-wrap');
        if (wrap) wrap.remove();
      }
    });
  }

  // ── Public API ────────────────────────────────────────────────

  window._geoSW = {
    close: close,
    open: open,
    signOut: function() {
      var fb = window.GeoFirebase;
      if (fb && fb.auth && fb.authFns) {
        fb.authFns.signOut(fb.auth).then(function() {
          window.location.href = 'index.html';
        }).catch(function() {});
      }
    }
  };

  if (window.GeoFirebase && window.GeoFirebase.db) init(window.GeoFirebase);
  else window.addEventListener('GeoFirebaseReady', function() { init(window.GeoFirebase); }, {once: true});
})();
