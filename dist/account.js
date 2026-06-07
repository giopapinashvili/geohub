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
  var ADMIN_ONLY_FIELDS = ['xp','trustScore','level','verified','role','isAdmin','adminLevel','premiumUntil','pointsBalance','totalPointsEarned','totalPointsSpent','totalPointsTransferred','totalPointsReceived'];
  function stripAdminFields(obj) {
    var out = Object.assign({}, obj);
    ADMIN_ONLY_FIELDS.forEach(function(k) { delete out[k]; });
    return out;
  }
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
      return f.setDoc(f.doc(geo.db, 'users', fbUser.uid), stripAdminFields(Object.assign({}, base, { updatedAt: Date.now() })), { merge: true }).then(function(){ return base; });
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
    return f.setDoc(f.doc(geo.db, 'users', merged.uid), stripAdminFields(merged), { merge: true }).then(function(){ return merged; });
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
    return;
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

  var NOTIF_ICONS = {
    like:      { icon: 'fa-heart',    color: '#ef4444' },
    comment:   { icon: 'fa-comment',  color: '#3b82f6' },
    reply:     { icon: 'fa-reply',    color: '#8b5cf6' },
    follow:    { icon: 'fa-user-plus',color: '#10b981' },
    message:   { icon: 'fa-envelope', color: '#06b6d4' },
    reward:          { icon: 'fa-gift',       color: '#f59e0b' },
    badge:           { icon: 'fa-medal',      color: '#f59e0b' },
    challenge:       { icon: 'fa-trophy',     color: '#f59e0b' },
    coupon_redeemed:    { icon: 'fa-ticket-alt', color: '#10b981' },
    group_join_request: { icon: 'fa-user-clock', color: '#a855f7' },
    group_approved:     { icon: 'fa-user-check', color: '#10b981' },
    group_declined:     { icon: 'fa-user-times', color: '#ef4444' }
  };

  function notifTimeAgo(ts) {
    if (!ts) return '';
    var ms = ts.toMillis ? ts.toMillis() : (ts.seconds ? ts.seconds * 1000 : 0);
    if (!ms) return '';
    var diff = Date.now() - ms;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
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
      '<div class="nav-notif-list" id="navNotifList">' +
      '<div class="nav-notif-skel-item"></div><div class="nav-notif-skel-item"></div><div class="nav-notif-skel-item"></div>' +
      '</div>' +
      '<div class="nav-notif-footer">' +
      '<button class="nav-notif-mark-all" id="navNotifMarkAll">Mark all read</button>' +
      '<a class="nav-notif-view-all" href="notifications.html">View all</a>' +
      '</div>';
    document.body.appendChild(panel);
    requestAnimationFrame(function() { panel.classList.add('open'); });
    var outsideHandler = null;
    var closePanel = function() {
      if (panel.parentNode) {
        if (panel._unsub) panel._unsub();
        panel.remove();
        if (outsideHandler) { document.removeEventListener('click', outsideHandler); outsideHandler = null; }
      }
    };
    document.getElementById('navNotifClose').addEventListener('click', closePanel);
    setTimeout(function() {
      outsideHandler = function(e) {
        var bell = document.getElementById('navBellBtn');
        if (!panel.contains(e.target) && (!bell || !bell.contains(e.target))) {
          closePanel();
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
          var ic = NOTIF_ICONS[n.type] || { icon: 'fa-bell', color: '#10b981' };
          return '<a class="nav-notif-item' + (!n.read ? ' unread' : '') + '" href="' + esc(n.href || '#') + '" data-notif-id="' + esc(n.id) + '">' +
            '<div class="nav-notif-icon" style="color:' + ic.color + '"><i class="fas ' + ic.icon + '"></i></div>' +
            '<div class="nav-notif-text"><strong>' + esc(n.title || 'GeoHub') + '</strong>' +
            '<span>' + esc(n.body || n.message || '') + (n.createdAt ? ' · ' + notifTimeAgo(n.createdAt) : '') + '</span></div>' +
            (!n.read ? '<div class="nav-notif-dot"></div>' : '') +
            '</a>';
        }).join('');
        list.querySelectorAll('[data-notif-id]').forEach(function(a) {
          a.addEventListener('click', function() {
            var id = a.dataset.notifId;
            try { f.updateDoc(f.doc(geo.db, 'userNotifications', id), { read: true, seen: true }); } catch(e) {}
          });
        });
        var badge = document.getElementById('navNotifBadge');
        var unreadCount = items.filter(function(n) { return !n.read && !n.seen; }).length;
        if (badge) { badge.textContent = unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : ''; badge.style.display = unreadCount > 0 ? '' : 'none'; }
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
          a.classList.remove('unread');
          var dot = a.querySelector('.nav-notif-dot');
          if (dot) dot.remove();
        });
        var badge = document.getElementById('navNotifBadge');
        if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
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
        '<a href="search.html" class="nav-icon-btn" title="Search" aria-label="Search"><i class="fas fa-search"></i></a>' +
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
        '<a href="safety.html" class="auth-dd-item"><i class="fas fa-shield-alt"></i> Privacy &amp; Safety</a>' +
        '<a href="settings.html" class="auth-dd-item" id="authSettingsBtn"><i class="fas fa-cog"></i> Settings</a>' +
        (isAdmin ? '<a href="admin.html" class="auth-dd-item auth-admin-link" style="color:#10b981"><i class="fas fa-shield-alt"></i> Admin Panel</a>' : '') +
        '<div class="auth-dd-sep"></div><button class="auth-dd-item auth-dd-logout" id="authLogoutBtn"><i class="fas fa-sign-out-alt"></i> Logout</button></div></div>';
      var navUser = document.getElementById('authNavUser');
      var navDrop = document.getElementById('authNavDropdown');
      checkAdminDoc(user.uid || user.id, function(ok){ if(ok && navDrop && !navDrop.querySelector('.auth-admin-link')){ var a=document.createElement('a'); a.href='admin.html'; a.className='auth-dd-item auth-admin-link'; a.style.color='#10b981'; a.innerHTML='<i class="fas fa-shield-alt"></i> Admin Panel'; var sep=navDrop.querySelector('.auth-dd-sep'); navDrop.insertBefore(a, sep || navDrop.lastChild); } });
      if (navUser) navUser.addEventListener('click', function (e) { e.stopPropagation(); if(navDrop) navDrop.classList.toggle('open'); });
      document.addEventListener('click', function () { if (navDrop) navDrop.classList.remove('open'); });
      var out = document.getElementById('authLogoutBtn'); if (out) out.addEventListener('click', doLogout);
      var set = document.getElementById('authSettingsBtn'); if (set) set.addEventListener('click', function(){ if(navDrop) navDrop.classList.remove('open'); });
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
    var settings = document.createElement('a');
    settings.href = 'settings.html';
    settings.innerHTML = '<i class="fas fa-cog"></i> Settings';
    menu.appendChild(settings);
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
    var avatarSrc = esc(user.avatar || user.photoURL || '');
    m.innerHTML = '<div class="auth-modal-card" style="max-width:520px;max-height:90vh;overflow-y:auto">'
      + '<button class="auth-modal-close" id="asClose"><i class="fas fa-times"></i></button>'
      + '<h3>Account Settings</h3>'
      + '<div style="display:flex;align-items:center;gap:14px;margin:12px 0 16px">'
      + '<div id="asAvatarWrap" style="position:relative;width:64px;height:64px;border-radius:50%;overflow:hidden;background:var(--bg-elevated,#1a1d2e);flex-shrink:0">'
      + (avatarSrc ? '<img id="asAvatarImg" src="' + avatarSrc + '" alt="Avatar" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">' : '')
      + '</div>'
      + '<div style="flex:1">'
      + '<button type="button" class="btn-ghost" id="asChangeAvatar" style="font-size:.82rem;padding:6px 12px"><i class="fas fa-camera"></i> Change avatar</button>'
      + '<div id="asAvatarStatus" style="font-size:.75rem;color:#64748b;margin-top:4px"></div>'
      + '</div></div>'
      + '<input id="asName" class="form-input" style="margin:8px 0" value="' + esc(user.fullName || '') + '" placeholder="Name">'
      + '<input id="asCity" class="form-input" style="margin:8px 0" value="' + esc(user.city || '') + '" placeholder="City">'
      + '<textarea id="asBio" class="form-input" style="margin:8px 0;min-height:90px" placeholder="Bio">' + esc(user.bio || '') + '</textarea>'
      + '<button class="btn-primary auth-modal-btn" id="asSave">Save</button>'
      + notifHTML
      + '</div>';
    document.body.appendChild(m);
    requestAnimationFrame(function(){ m.classList.add('open'); });
    m.querySelector('#asClose').addEventListener('click', function(){ m.remove(); });

    var _pendingAvatar = '';
    m.querySelector('#asChangeAvatar').addEventListener('click', function() {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp,image/gif'; inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.onchange = function() {
        var file = inp.files && inp.files[0];
        inp.remove();
        if (!file) return;
        var GS = window.GeoSocial;
        if (!GS || !GS.uploadFile) { var status = document.getElementById('asAvatarStatus'); if (status) status.textContent = 'Avatar upload unavailable.'; return; }
        var btn = document.getElementById('asChangeAvatar');
        var status = document.getElementById('asAvatarStatus');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Uploading…'; }
        if (status) status.textContent = '';
        GS.uploadFile(file, 'avatars', function(pct) { if (status) status.textContent = pct + '%'; }).then(function(url) {
          _pendingAvatar = url || '';
          if (url) {
            var wrap = document.getElementById('asAvatarWrap');
            if (wrap) { wrap.innerHTML = '<img id="asAvatarImg" src="' + esc(url) + '" alt="Avatar" style="width:100%;height:100%;object-fit:cover">'; }
            if (status) status.textContent = 'Ready to save';
          } else {
            if (status) status.textContent = 'Upload failed. Try again.';
          }
        }).finally(function() {
          if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-camera"></i> Change avatar'; }
        });
      };
      inp.click();
    });

    m.querySelector('#asSave').addEventListener('click', function(){
      var updates = {
        fullName: document.getElementById('asName').value.trim(),
        city:     document.getElementById('asCity').value.trim(),
        bio:      document.getElementById('asBio').value.trim()
      };
      if (_pendingAvatar) updates.avatar = _pendingAvatar;
      updateUser(updates).then(function(){ m.remove(); initAuthNav(); });
    });
    if (window.GeoPush) window.GeoPush.bindSettingsEvents();
  }

  function checkOnboardingComplete(user) {
    if (!user || !user.uid) return;
    var page = window.location.pathname;
    if (page.indexOf('auth.html') !== -1 || page.indexOf('onboarding.html') !== -1) return;
    if (user.onboardingComplete) return;
    // Users who completed old onboarding have accountType set in Firestore
    if (user.accountType) return;
    window.location.href = 'onboarding.html';
  }

  function startAuthListener() {
    var geo = fb();
    if (!geo || !geo.auth || !geo.authFns || !geo.authFns.onAuthStateChanged) { authReady = true; initAuthNav(); initMobileMenuAuth(); return; }
    geo.authFns.onAuthStateChanged(geo.auth, function(fbUser){ loadProfile(fbUser).then(function(profile){ authReady = true; initAuthNav(); initMobileMenuAuth(); if (profile) checkOnboardingComplete(profile); window.dispatchEvent(new CustomEvent('GeoAuthReady', { detail: profile })); }); });
  }

  document.addEventListener('DOMContentLoaded', function(){ initAuthNav(); initMobileMenuAuth(); initProtectedActions(); });
  if (window.GeoFirebase && window.GeoFirebase.auth) startAuthListener(); else window.addEventListener('GeoFirebaseReady', startAuthListener, { once: true });

  window.addEventListener('pagehide', clearBellListeners);

  // Load push notifications module on all pages
  if ('serviceWorker' in navigator && !document.getElementById('ghPushScript')) {
    var _ps = document.createElement('script');
    _ps.id = 'ghPushScript'; _ps.defer = true; _ps.src = 'push-notifications.js';
    document.head.appendChild(_ps);
  }
})();
