/* GeoHub — Account system (runs on every page except auth.html)
   BACKEND PREP: getCurrentUser() and doLogout() read/write localStorage
   directly. When backend is live, replace with:
     GeoAPI.getCurrentUser() and GeoAPI.logout()
   Storage keys: use GeoConfig.STORAGE_KEYS (config.js) */
(function () {
  'use strict';

  var AUTH_KEY  = 'geohub_auth_user';
  var USERS_KEY = 'geohub_registered_users';

  /* ── Core helpers ──────────────────────────────────────── */
  function readLS(key) {
    try { var v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }
  function writeLS(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function getCurrentUser() { return readLS(AUTH_KEY); }

  function updateUser(updates) {
    var user = getCurrentUser();
    if (!user) return;
    var merged = Object.assign({}, user, updates);
    writeLS(AUTH_KEY, merged);
    // Sync in registered users pool
    var users = readLS(USERS_KEY) || [];
    var idx = users.findIndex(function (u) { return u.id === user.id; });
    if (idx !== -1) { users[idx] = merged; writeLS(USERS_KEY, users); }
    return merged;
  }

  function doLogout() {
    try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
    try { localStorage.setItem('geohub_signed_out', '1'); } catch (e) {}
    if (window.GeoFirebaseAuth) {
      window.GeoFirebaseAuth.logout().finally(function () {
        window.location.href = 'index.html';
      });
    } else {
      window.location.href = 'index.html';
    }
  }

  // Expose globally so other scripts can call GeoAuth.*
  window.GeoAuth = {
    getCurrentUser: getCurrentUser,
    updateUser: updateUser,
    logout: doLogout
  };

  /* ── Lang toggle (always injected after navbar renders) ─── */
  function ensureLangToggle(actionsEl) {
    if (document.getElementById('geoLangToggle')) return;
    var lang = 'en';
    try { lang = localStorage.getItem('geohub_lang') || 'en'; } catch(e) {}
    var b = document.createElement('button');
    b.id = 'geoLangToggle';
    b.setAttribute('aria-label', 'Switch language');
    b.textContent = lang === 'ka' ? 'EN' : 'ქარ';
    b.style.cssText = [
      'background:transparent',
      'border:1px solid rgba(255,255,255,.18)',
      'color:#aaa',
      'border-radius:6px',
      'padding:3px 9px',
      'font-size:.75rem',
      'font-weight:700',
      'letter-spacing:.5px',
      'cursor:pointer',
      'white-space:nowrap',
      'flex-shrink:0',
      'font-family:inherit',
      'transition:border-color .2s,color .2s'
    ].join(';');
    b.onmouseenter = function() { b.style.borderColor = '#10b981'; b.style.color = '#10b981'; };
    b.onmouseleave = function() { b.style.borderColor = 'rgba(255,255,255,.18)'; b.style.color = '#aaa'; };
    b.onclick = function() {
      try { localStorage.setItem('geohub_lang', lang === 'ka' ? 'en' : 'ka'); } catch(e) {}
      window.location.reload();
    };
    if (actionsEl) actionsEl.insertBefore(b, actionsEl.firstChild);
  }

  /* ── Navbar injection ──────────────────────────────────── */
  function initAuthNav() {
    var actionsEl = document.querySelector('.navbar-actions');
    if (!actionsEl) return;

    var user = getCurrentUser();

    if (user) {
      var firstName = (user.fullName || 'User').split(' ')[0];
      actionsEl.innerHTML =
        '<div class="auth-nav-user" id="authNavUser">' +
          '<img src="' + (user.avatar || '') + '" alt="' + firstName + '" class="auth-nav-avatar" ' +
              'onerror="this.style.display=\'none\'">' +
          '<span class="auth-nav-name">' + esc(firstName) + '</span>' +
          '<i class="fas fa-chevron-down auth-nav-caret"></i>' +
          '<div class="auth-nav-dropdown" id="authNavDropdown">' +
            '<a href="profile.html" class="auth-dd-item"><i class="fas fa-user"></i> My Profile</a>' +
            '<a href="rewards.html" class="auth-dd-item"><i class="fas fa-trophy"></i> Rewards</a>' +
            '<a href="messages.html" class="auth-dd-item"><i class="fas fa-envelope"></i> Messages</a>' +
            '<a href="dashboard.html" class="auth-dd-item"><i class="fas fa-chart-bar"></i> Dashboard</a>' +
            '<button class="auth-dd-item" id="authSettingsBtn"><i class="fas fa-cog"></i> Settings</button>' +
            '<div class="auth-dd-sep"></div>' +
            '<button class="auth-dd-item auth-dd-logout" id="authLogoutBtn"><i class="fas fa-sign-out-alt"></i> Logout</button>' +
          '</div>' +
        '</div>';

      var navUser = document.getElementById('authNavUser');
      var navDrop = document.getElementById('authNavDropdown');

      navUser.addEventListener('click', function (e) {
        e.stopPropagation();
        navDrop.classList.toggle('open');
      });
      document.addEventListener('click', function () {
        if (navDrop) navDrop.classList.remove('open');
      });
      document.getElementById('authLogoutBtn').addEventListener('click', doLogout);
      document.getElementById('authSettingsBtn').addEventListener('click', function () {
        navDrop.classList.remove('open');
        showAccountSettings();
      });
    } else {
      actionsEl.innerHTML =
        '<a href="auth.html" class="btn-ghost-nav"><i class="fas fa-sign-in-alt"></i> Login</a>' +
        '<a href="auth.html?tab=signup" class="btn-primary" style="' +
          'padding:8px 16px;font-size:0.875rem;border-radius:8px;text-decoration:none;' +
          'display:inline-flex;align-items:center;gap:6px;font-weight:600;">' +
          '<i class="fas fa-user-plus"></i> Sign Up</a>';
    }

    ensureLangToggle(actionsEl);
  }

  /* ── Mobile menu auth entry ────────────────────────────── */
  function initMobileMenuAuth() {
    var menu = document.querySelector('.mobile-menu');
    if (!menu) return;

    // Remove old profile link if present
    menu.querySelectorAll('a[href="profile.html"]').forEach(function (a) { a.remove(); });

    var user = getCurrentUser();
    var item = document.createElement('a');
    if (user) {
      item.href = 'profile.html';
      item.innerHTML = '<i class="fas fa-user-circle"></i> ' + esc((user.fullName || 'Profile'));
    } else {
      item.href = 'auth.html';
      item.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login / Sign Up';
    }
    menu.appendChild(item);
  }

  /* ── Protected action interceptor ─────────────────────── */
  var PROTECTED = [
    { match: '[data-action="checkin"],.btn-checkin,.checkin-btn,.check-in-btn', msg: 'check in' },
    { match: '.listing-card-wishlist,[data-action="save"],.wishlist-btn,.btn-save', msg: 'save places' },
    { match: '[data-action="follow"],.follow-btn,.btn-follow', msg: 'follow users' },
    { match: '[data-action="message"],.message-btn,.btn-message,.start-chat-btn', msg: 'send messages' },
    { match: '[data-action="claim"],.reward-claim-btn,.btn-claim,.claim-btn', msg: 'claim rewards' },
    { match: '[data-action="join-challenge"],.challenge-join-btn,.btn-join-challenge', msg: 'join challenges' },
    { match: '[data-action="book"],.book-btn,.btn-book,.booking-btn', msg: 'book lessons' },
    { match: '[data-action="request"],.request-btn,.service-request-btn', msg: 'request services' },
  ];

  function initProtectedActions() {
    document.addEventListener('click', function (e) {
      if (getCurrentUser()) return; // logged in → allow everything
      var t = e.target;
      for (var i = 0; i < PROTECTED.length; i++) {
        var selectors = PROTECTED[i].match.split(',');
        for (var j = 0; j < selectors.length; j++) {
          try {
            if (t.closest(selectors[j].trim())) {
              e.preventDefault();
              e.stopImmediatePropagation();
              showLoginRequired(PROTECTED[i].msg);
              return;
            }
          } catch (err) {}
        }
      }
    }, true);
  }

  /* ── Login required modal ──────────────────────────────── */
  function showLoginRequired(action) {
    removeModal('loginRequiredModal');
    var m = document.createElement('div');
    m.id = 'loginRequiredModal';
    m.className = 'auth-modal-overlay';
    m.innerHTML =
      '<div class="auth-modal-card">' +
        '<button class="auth-modal-close" id="lrClose"><i class="fas fa-times"></i></button>' +
        '<div class="auth-modal-icon"><i class="fas fa-lock"></i></div>' +
        '<h3>Login Required</h3>' +
        '<p>Please log in to ' + esc(action || 'continue') + '.</p>' +
        '<div class="auth-modal-btns">' +
          '<a href="auth.html" class="btn-primary auth-modal-btn"><i class="fas fa-sign-in-alt"></i> Login</a>' +
          '<a href="auth.html?tab=signup" class="btn-ghost auth-modal-btn">Sign Up</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('open'); });
    m.querySelector('#lrClose').addEventListener('click', function () { closeModal(m); });
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(m); });
  }

  /* ── Account settings modal ─────────────────────────────── */
  function showAccountSettings() {
    var user = getCurrentUser();
    if (!user) return;
    removeModal('accountSettingsModal');

    var CITIES = ['Tbilisi','Batumi','Kutaisi','Mestia','Sighnaghi','Kazbegi','Borjomi','Telavi'];
    var TYPES  = ['Explorer','Creator','Business Owner','Student','Teacher','Patriot'];
    var INTS   = ['cafes','hiking','events','photography','restaurants','nightlife',
                  'museums','fitness','music','travel','coworking','wine'];

    function opts(list, cur) {
      return list.map(function (v) {
        return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>';
      }).join('');
    }

    var chips = INTS.map(function (i) {
      var sel = (user.interests || []).indexOf(i) !== -1 ? ' selected' : '';
      return '<button type="button" class="ob-interest-chip' + sel + '" data-interest="' + i + '">' + i + '</button>';
    }).join('');

    var m = document.createElement('div');
    m.id = 'accountSettingsModal';
    m.className = 'auth-modal-overlay';
    m.innerHTML =
      '<div class="auth-modal-card settings-card">' +
        '<button class="auth-modal-close" id="settingsClose"><i class="fas fa-times"></i></button>' +
        '<h3><i class="fas fa-cog"></i> Account Settings</h3>' +
        '<form id="settingsForm" style="margin-top:16px;">' +
          '<div class="auth-form-group">' +
            '<label>Full Name</label>' +
            '<input type="text" id="setFullName" value="' + esc(user.fullName || '') + '" placeholder="Full Name">' +
          '</div>' +
          '<div class="auth-form-row-2">' +
            '<div class="auth-form-group">' +
              '<label>Username</label>' +
              '<input type="text" id="setUsername" value="' + esc(user.username || '') + '" placeholder="username">' +
            '</div>' +
            '<div class="auth-form-group">' +
              '<label>Email</label>' +
              '<input type="email" id="setEmail" value="' + esc(user.email || '') + '" placeholder="email">' +
            '</div>' +
          '</div>' +
          '<div class="auth-form-group">' +
            '<label>Bio</label>' +
            '<textarea id="setBio" placeholder="Short bio…">' + esc(user.bio || '') + '</textarea>' +
          '</div>' +
          '<div class="auth-form-row-2">' +
            '<div class="auth-form-group"><label>City</label><select id="setCity">' + opts(CITIES, user.city) + '</select></div>' +
            '<div class="auth-form-group"><label>Account Type</label><select id="setType">' + opts(TYPES, user.accountType) + '</select></div>' +
          '</div>' +
          '<div class="auth-form-group">' +
            '<label>Interests</label>' +
            '<div class="ob-interest-grid" id="setInterests">' + chips + '</div>' +
          '</div>' +
          '<div class="settings-save-row">' +
            '<button type="submit" class="auth-submit" style="width:auto;padding:11px 28px;">Save Changes</button>' +
            '<div class="settings-success" id="settingsSaved" style="display:none;">' +
              '<i class="fas fa-check-circle"></i> Saved!' +
            '</div>' +
          '</div>' +
        '</form>' +
      '</div>';

    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('open'); });

    m.querySelectorAll('.ob-interest-chip').forEach(function (c) {
      c.addEventListener('click', function () { c.classList.toggle('selected'); });
    });
    m.querySelector('#settingsClose').addEventListener('click', function () { closeModal(m); });
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(m); });

    m.querySelector('#settingsForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var ints = [];
      m.querySelectorAll('.ob-interest-chip.selected').forEach(function (c) { ints.push(c.dataset.interest); });
      updateUser({
        fullName:    document.getElementById('setFullName').value.trim(),
        username:    document.getElementById('setUsername').value.trim(),
        email:       document.getElementById('setEmail').value.trim(),
        bio:         document.getElementById('setBio').value.trim(),
        city:        document.getElementById('setCity').value,
        accountType: document.getElementById('setType').value,
        interests:   ints
      });
      var saved = document.getElementById('settingsSaved');
      saved.style.display = 'flex';
      setTimeout(function () { saved.style.display = 'none'; }, 2500);
    });
  }

  /* ── Update bottom nav profile tab ────────────────────── */
  function updateBottomNavProfile() {
    var profileTab = document.querySelector('.app-nav-item[data-tab="profile"]');
    if (!profileTab) return;
    var user = getCurrentUser();
    if (!user) return;

    var iconEl = profileTab.querySelector('.app-nav-icon');
    if (!iconEl) return;
    iconEl.innerHTML =
      '<img src="' + (user.avatar || '') + '" class="app-nav-avatar" ' +
      'alt="' + esc((user.fullName || '').split(' ')[0]) + '" ' +
      'onerror="this.style.display=\'none\';this.nextSibling.style.display=\'block\'">' +
      '<i class="fas fa-user" style="display:none;"></i>';
  }

  /* ── Utilities ─────────────────────────────────────────── */
  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function removeModal(id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  }
  function closeModal(m) {
    m.classList.remove('open');
    setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 300);
  }

  /* ── Clear stale mock keys for real Firebase users ──────── */
  (function clearMockStorage() {
    try {
      var u = readLS(AUTH_KEY);
      if (u && u.isFirebaseUser === true) {
        localStorage.removeItem('geohub_mock_user');
        localStorage.removeItem('geohub_mock_profile_user');
      }
    } catch (e) {}
  })();

  /* ── Init ───────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initAuthNav();
    initMobileMenuAuth();
    initProtectedActions();
    updateBottomNavProfile();
  });

  // Also expose showLoginRequired globally for page scripts
  window.GeoAuth.showLoginRequired = showLoginRequired;
  window.GeoAuth.showAccountSettings = showAccountSettings;

})();
