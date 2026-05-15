/* GeoHub account/runtime auth helper — Firebase/Firestore only. */
(function () {
  'use strict';

  var currentUser = window.GeoCurrentUser || null;
  var authReady = false;
  var appLang = 'en';
  var _bellUnsubs = [];

  function esc(s) { return String(s || '').replace(/[&<>'"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]; }); }
  function fb() { return window.GeoFirebase; }
  function fs() { return fb() && fb().fs; }
  function checkAdminDoc(uid, cb) {
    var geo = fb(), f = fs();
    if (!geo || !f || !uid) return cb(false);
    f.getDoc(f.doc(geo.db, 'admins', uid)).then(function(snap){ cb(!!snap.exists()); }).catch(function(){ cb(false); });
  }

  function fbUserToGeoUser(fbUser) {
    if (!fbUser) return null;
    var name = fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'GeoHub User');
    return { id: fbUser.uid, uid: fbUser.uid, fullName: name, username: (fbUser.email || fbUser.uid).split('@')[0].replace(/[^a-z0-9_.]/gi,'.').toLowerCase(), email: fbUser.email || '', avatar: fbUser.photoURL || '', isFirebaseUser: true };
  }

  function loadProfile(fbUser) {
    if (!fbUser) { currentUser = null; window.GeoCurrentUser = null; return Promise.resolve(null); }
    var base = fbUserToGeoUser(fbUser);
    var geo = fb(), f = fs();
    if (!geo || !f) { currentUser = base; window.GeoCurrentUser = base; return Promise.resolve(base); }
    return f.getDoc(f.doc(geo.db, 'users', fbUser.uid)).then(function(snap) {
      if (snap.exists()) Object.assign(base, snap.data(), { uid: fbUser.uid, id: fbUser.uid, email: fbUser.email || (snap.data().email || ''), isFirebaseUser: true });
      return f.setDoc(f.doc(geo.db, 'users', fbUser.uid), Object.assign({}, base, { updatedAt: Date.now() }), { merge: true }).then(function(){ return base; });
    }).catch(function(){ return base; }).then(function(profile){ currentUser = profile; window.GeoCurrentUser = profile; return profile; });
  }

  function getCurrentUser() { return currentUser || window.GeoCurrentUser || null; }

  function updateUser(updates) {
    var user = getCurrentUser();
    if (!user || !user.uid) return Promise.resolve(null);
    var merged = Object.assign({}, user, updates || {}, { updatedAt: Date.now() });
    currentUser = merged; window.GeoCurrentUser = merged;
    var geo = fb(), f = fs();
    if (!geo || !f) return Promise.resolve(merged);
    return f.setDoc(f.doc(geo.db, 'users', merged.uid), merged, { merge: true }).then(function(){ return merged; });
  }

  function doLogout() {
    var geo = fb();
    currentUser = null; window.GeoCurrentUser = null;
    var done = function(){ window.location.href = 'index.html'; };
    if (window.GeoFirebaseAuth && window.GeoFirebaseAuth.logout) return window.GeoFirebaseAuth.logout().finally(done);
    if (geo && geo.auth && geo.authFns && geo.authFns.signOut) return geo.authFns.signOut(geo.auth).finally(done);
    done();
  }

  window.GeoAuth = { getCurrentUser: getCurrentUser, updateUser: updateUser, logout: doLogout, isReady: function(){ return authReady; } };

  function ensureLangToggle(actionsEl) {
    if (document.getElementById('geoLangToggle')) return;
    var b = document.createElement('button');
    b.id = 'geoLangToggle';
    b.setAttribute('aria-label', 'Switch language');
    b.textContent = appLang === 'ka' ? 'EN' : 'ქარ';
    b.style.cssText = 'background:transparent;border:1px solid rgba(255,255,255,.18);color:#aaa;border-radius:6px;padding:3px 9px;font-size:.75rem;font-weight:700;letter-spacing:.5px;cursor:pointer;white-space:nowrap;flex-shrink:0;font-family:inherit;transition:border-color .2s,color .2s';
    b.onmouseenter = function() { b.style.borderColor = '#10b981'; b.style.color = '#10b981'; };
    b.onmouseleave = function() { b.style.borderColor = 'rgba(255,255,255,.18)'; b.style.color = '#aaa'; };
    b.onclick = function() { appLang = appLang === 'ka' ? 'en' : 'ka'; window.GeoLang = appLang; window.dispatchEvent(new CustomEvent('GeoLangChange', { detail: appLang })); window.location.reload(); };
    if (actionsEl) actionsEl.insertBefore(b, actionsEl.firstChild);
  }

  function clearBellListeners() {
    _bellUnsubs.forEach(function(u) { try { u(); } catch(e) {} });
    _bellUnsubs = [];
  }

  function wireBadges(uid, f, geo) {
    if (!uid || !f || !geo) return;
    try {
      var nq = f.query(f.collection(geo.db, 'userNotifications'), f.where('userId', '==', uid), f.limit(25));
      _bellUnsubs.push(f.onSnapshot(nq, function(snap) {
        var count = 0;
        snap.forEach(function(d) { var x = d.data(); if (!x.read && !x.seen) count++; });
        var b = document.getElementById('navNotifBadge');
        if (b) { b.textContent = count > 99 ? '99+' : count > 0 ? String(count) : ''; b.style.display = count > 0 ? '' : 'none'; }
      }, function() {}));
    } catch(e) {}
    try {
      var cq = f.query(f.collection(geo.db, 'chats'), f.where('members', 'array-contains', uid));
      _bellUnsubs.push(f.onSnapshot(cq, function(snap) {
        var count = 0;
        snap.forEach(function(d) { var x = d.data() || {}; if (x.lastSenderId && x.lastSenderId !== uid && Array.isArray(x.unreadFor) && x.unreadFor.indexOf(uid) > -1) count++; });
        var b = document.getElementById('navMsgBadge');
        if (b) { b.textContent = count > 99 ? '99+' : count > 0 ? String(count) : ''; b.style.display = count > 0 ? '' : 'none'; }
      }, function() {}));
    } catch(e) {}
  }

  function openNavNotifications(uid, f, geo) {
    var existing = document.getElementById('navNotifPanel');
    if (existing) { if (existing._unsub) existing._unsub(); existing.remove(); return; }
    var panel = document.createElement('div');
    panel.id = 'navNotifPanel';
    panel.className = 'nav-notif-panel';
    panel.innerHTML =
      '<div class="nav-notif-header"><strong>Notifications</strong>' +
      '<button class="nav-notif-close" id="navNotifClose"><i class="fas fa-times"></i></button></div>' +
      '<div class="nav-notif-list" id="navNotifList"><div class="nav-notif-loading"><i class="fas fa-circle-notch fa-spin"></i></div></div>' +
      '<div class="nav-notif-footer"><button class="nav-notif-mark-all" id="navNotifMarkAll">Mark all read</button></div>';
    document.body.appendChild(panel);
    requestAnimationFrame(function() { panel.classList.add('open'); });
    var closePanel = function() { if (panel.parentNode) { if (panel._unsub) panel._unsub(); panel.remove(); } };
    document.getElementById('navNotifClose').addEventListener('click', closePanel);
    setTimeout(function() {
      var outsideHandler = function(e) {
        var bell = document.getElementById('navBellBtn');
        if (!panel.contains(e.target) && (!bell || !bell.contains(e.target))) {
          closePanel();
          document.removeEventListener('click', outsideHandler);
        }
      };
      document.addEventListener('click', outsideHandler);
    }, 0);
    try {
      var q = f.query(f.collection(geo.db, 'userNotifications'), f.where('userId', '==', uid), f.limit(20));
      var unsub = f.onSnapshot(q, function(snap) {
        var items = [];
        snap.forEach(function(d) { items.push(Object.assign({ id: d.id }, d.data())); });
        items.sort(function(a, b) {
          function ms(v) { return v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds * 1000 : 0); }
          return ms(b.createdAt) - ms(a.createdAt);
        });
        var list = document.getElementById('navNotifList');
        if (!list) return;
        if (!items.length) {
          list.innerHTML = '<div class="nav-notif-empty"><i class="fas fa-bell"></i><p>No notifications yet</p></div>';
          return;
        }
        list.innerHTML = items.map(function(n) {
          return '<a class="nav-notif-item' + (!n.read ? ' unread' : '') + '" href="' + esc(n.href || '#') + '" data-notif-id="' + esc(n.id) + '">' +
            '<div class="nav-notif-icon"><i class="fas fa-bell"></i></div>' +
            '<div class="nav-notif-text"><strong>' + esc(n.title || 'GeoHub') + '</strong>' +
            '<span>' + esc(n.body || n.message || '') + '</span></div></a>';
        }).join('');
      }, function() {
        var list = document.getElementById('navNotifList');
        if (list) list.innerHTML = '<div class="nav-notif-empty"><i class="fas fa-bell"></i><p>No notifications yet</p></div>';
      });
      panel._unsub = unsub;
    } catch(e) {
      var list = document.getElementById('navNotifList');
      if (list) list.innerHTML = '<div class="nav-notif-empty"><i class="fas fa-bell"></i><p>No notifications yet</p></div>';
    }
    var markAllBtn = document.getElementById('navNotifMarkAll');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', function() {
        panel.querySelectorAll('[data-notif-id]').forEach(function(a) {
          var id = a.dataset.notifId;
          try { f.updateDoc(f.doc(geo.db, 'userNotifications', id), { read: true, seen: true }); } catch(e) {}
        });
      });
    }
  }

  function initAuthNav() {
    var actionsEl = document.querySelector('.navbar-actions');
    if (!actionsEl) return;
    var user = getCurrentUser();
    if (user) {
      var firstName = (user.fullName || user.displayName || 'User').split(' ')[0];
      var isAdmin = !!(user.isAdmin || user.adminRole);
      clearBellListeners();
      actionsEl.innerHTML =
        '<a href="messages.html" class="nav-icon-btn" id="navMsgBtn" title="Messages" aria-label="Messages"><i class="fas fa-comment-dots"></i><b class="nav-badge" id="navMsgBadge" style="display:none"></b></a>' +
        '<button type="button" class="nav-icon-btn" id="navBellBtn" title="Notifications" aria-label="Notifications"><i class="fas fa-bell"></i><b class="nav-badge" id="navNotifBadge" style="display:none"></b></button>' +
        '<div class="auth-nav-user" id="authNavUser">' +
        '<img src="' + esc(user.avatar || user.photoURL || '') + '" alt="' + esc(firstName) + '" class="auth-nav-avatar" onerror="this.style.display=\'none\'">' +
        '<span class="auth-nav-name">' + esc(firstName) + '</span><i class="fas fa-chevron-down auth-nav-caret"></i>' +
        '<div class="auth-nav-dropdown" id="authNavDropdown">' +
        '<a href="profile.html?id=' + esc(user.uid || user.id || '') + '" class="auth-dd-item"><i class="fas fa-user"></i> My Profile</a>' +
        '<a href="rewards.html" class="auth-dd-item"><i class="fas fa-trophy"></i> Rewards</a>' +
        '<a href="messages.html" class="auth-dd-item"><i class="fas fa-envelope"></i> Messages</a>' +
        '<a href="dashboard.html" class="auth-dd-item"><i class="fas fa-chart-bar"></i> Dashboard</a>' +
        '<button class="auth-dd-item" id="authSettingsBtn"><i class="fas fa-cog"></i> Settings</button>' +
        (isAdmin ? '<a href="admin.html" class="auth-dd-item auth-admin-link" style="color:#10b981"><i class="fas fa-shield-alt"></i> Admin Panel</a>' : '') +
        '<div class="auth-dd-sep"></div><button class="auth-dd-item auth-dd-logout" id="authLogoutBtn"><i class="fas fa-sign-out-alt"></i> Logout</button></div></div>';
      var navUser = document.getElementById('authNavUser');
      var navDrop = document.getElementById('authNavDropdown');
      checkAdminDoc(user.uid || user.id, function(ok){ if(ok && navDrop && !navDrop.querySelector('.auth-admin-link')){ var a=document.createElement('a'); a.href='admin.html'; a.className='auth-dd-item auth-admin-link'; a.style.color='#10b981'; a.innerHTML='<i class="fas fa-shield-alt"></i> Admin Panel'; var sep=navDrop.querySelector('.auth-dd-sep'); navDrop.insertBefore(a, sep || navDrop.lastChild); } });
      if (navUser) navUser.addEventListener('click', function (e) { e.stopPropagation(); if(navDrop) navDrop.classList.toggle('open'); });
      document.addEventListener('click', function () { if (navDrop) navDrop.classList.remove('open'); });
      var out = document.getElementById('authLogoutBtn'); if (out) out.addEventListener('click', doLogout);
      var set = document.getElementById('authSettingsBtn'); if (set) set.addEventListener('click', function(){ showAccountSettings(); });
      var bellBtn = document.getElementById('navBellBtn');
      if (bellBtn) { bellBtn.addEventListener('click', function(e) { e.stopPropagation(); var geo = fb(), f = fs(); if (geo && f) openNavNotifications(user.uid || user.id, f, geo); }); }
      var _geo = fb(), _f = fs(); if (_geo && _f) wireBadges(user.uid || user.id, _f, _geo);
    } else {
      actionsEl.innerHTML = '<a href="auth.html" class="btn-ghost-nav"><i class="fas fa-sign-in-alt"></i> Login</a>' +
        '<a href="auth.html?tab=signup" class="btn-primary" style="padding:8px 16px;font-size:0.875rem;border-radius:8px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:600;"><i class="fas fa-user-plus"></i> Sign Up</a>';
    }
    ensureLangToggle(actionsEl);
  }

  function initMobileMenuAuth() {
    var menu = document.querySelector('.mobile-menu');
    if (!menu) return;
    menu.querySelectorAll('a[href="profile.html"],a[href="auth.html"]').forEach(function(a){ if(a.textContent.match(/Login|Profile|Sign/i)) a.remove(); });
    var user = getCurrentUser();
    var item = document.createElement('a');
    item.href = user ? 'profile.html?id=' + encodeURIComponent(user.uid || user.id || '') : 'auth.html';
    item.innerHTML = user ? '<i class="fas fa-user-circle"></i> ' + esc(user.fullName || 'Profile') : '<i class="fas fa-sign-in-alt"></i> Login / Sign Up';
    menu.appendChild(item);
  }

  function showLoginRequired(action) {
    var old = document.getElementById('loginRequiredModal'); if (old) old.remove();
    var m = document.createElement('div');
    m.id = 'loginRequiredModal'; m.className = 'auth-modal-overlay';
    m.innerHTML = '<div class="auth-modal-card"><button class="auth-modal-close" id="lrClose"><i class="fas fa-times"></i></button><div class="auth-modal-icon"><i class="fas fa-lock"></i></div><h3>Login Required</h3><p>Please log in to ' + esc(action || 'continue') + '.</p><div class="auth-modal-btns"><a href="auth.html" class="btn-primary auth-modal-btn"><i class="fas fa-sign-in-alt"></i> Login</a><a href="auth.html?tab=signup" class="btn-ghost auth-modal-btn">Sign Up</a></div></div>';
    document.body.appendChild(m); requestAnimationFrame(function(){ m.classList.add('open'); });
    m.querySelector('#lrClose').addEventListener('click', function(){ m.remove(); });
    m.addEventListener('click', function(e){ if(e.target === m) m.remove(); });
  }

  var PROTECTED = [
    { match: '[data-action="checkin"],.btn-checkin,.checkin-btn,.check-in-btn', msg: 'check in' },
    { match: '.listing-card-wishlist,[data-action="save"],.wishlist-btn,.btn-save', msg: 'save places' },
    { match: '[data-action="follow"],.follow-btn,.btn-follow', msg: 'follow users' },
    { match: '[data-action="message"],.message-btn,.btn-message,.start-chat-btn', msg: 'send messages' },
    { match: '[data-action="claim"],.reward-claim-btn,.btn-claim,.claim-btn', msg: 'claim rewards' },
    { match: '[data-action="join-challenge"],.challenge-join-btn,.btn-join-challenge', msg: 'join challenges' },
    { match: '[data-action="book"],.book-btn,.btn-book,.booking-btn', msg: 'book lessons' },
    { match: '[data-action="request"],.request-btn,.service-request-btn', msg: 'request services' }
  ];
  function initProtectedActions() {
    document.addEventListener('click', function (e) {
      if (getCurrentUser()) return;
      var t = e.target;
      for (var i = 0; i < PROTECTED.length; i++) {
        var selectors = PROTECTED[i].match.split(',');
        for (var j = 0; j < selectors.length; j++) {
          try { if (t.closest(selectors[j].trim())) { e.preventDefault(); e.stopImmediatePropagation(); showLoginRequired(PROTECTED[i].msg); return; } } catch (err) {}
        }
      }
    }, true);
  }

  function showAccountSettings() {
    var user = getCurrentUser(); if (!user) return;
    var old = document.getElementById('accountSettingsModal'); if (old) old.remove();
    var m = document.createElement('div');
    m.id = 'accountSettingsModal'; m.className = 'auth-modal-overlay';
    var notifHTML = window.GeoPush ? window.GeoPush.buildSettingsHTML() : '';
    m.innerHTML = '<div class="auth-modal-card" style="max-width:520px;max-height:90vh;overflow-y:auto">'
      + '<button class="auth-modal-close" id="asClose"><i class="fas fa-times"></i></button>'
      + '<h3>Account Settings</h3>'
      + '<p>Update your public GeoHub profile.</p>'
      + '<input id="asName" class="form-input" style="margin:8px 0" value="' + esc(user.fullName || '') + '" placeholder="Name">'
      + '<input id="asCity" class="form-input" style="margin:8px 0" value="' + esc(user.city || '') + '" placeholder="City">'
      + '<textarea id="asBio" class="form-input" style="margin:8px 0;min-height:90px" placeholder="Bio">' + esc(user.bio || '') + '</textarea>'
      + '<button class="btn-primary auth-modal-btn" id="asSave">Save</button>'
      + notifHTML
      + '</div>';
    document.body.appendChild(m);
    requestAnimationFrame(function(){ m.classList.add('open'); });
    m.querySelector('#asClose').addEventListener('click', function(){ m.remove(); });
    m.querySelector('#asSave').addEventListener('click', function(){
      updateUser({
        fullName: document.getElementById('asName').value.trim(),
        city:     document.getElementById('asCity').value.trim(),
        bio:      document.getElementById('asBio').value.trim()
      }).then(function(){ m.remove(); initAuthNav(); });
    });
    if (window.GeoPush) window.GeoPush.bindSettingsEvents();
  }

  function startAuthListener() {
    var geo = fb();
    if (!geo || !geo.auth || !geo.authFns || !geo.authFns.onAuthStateChanged) { authReady = true; initAuthNav(); initMobileMenuAuth(); return; }
    geo.authFns.onAuthStateChanged(geo.auth, function(fbUser){ loadProfile(fbUser).then(function(profile){ authReady = true; initAuthNav(); initMobileMenuAuth(); window.dispatchEvent(new CustomEvent('GeoAuthReady', { detail: profile })); }); });
  }

  document.addEventListener('DOMContentLoaded', function(){ initAuthNav(); initMobileMenuAuth(); initProtectedActions(); });
  if (window.GeoFirebase && window.GeoFirebase.auth) startAuthListener(); else window.addEventListener('GeoFirebaseReady', startAuthListener, { once: true });

  // Load push notifications module on all pages
  if ('serviceWorker' in navigator && !document.getElementById('ghPushScript')) {
    var _ps = document.createElement('script');
    _ps.id = 'ghPushScript'; _ps.defer = true; _ps.src = 'push-notifications.js';
    document.head.appendChild(_ps);
  }
})();
