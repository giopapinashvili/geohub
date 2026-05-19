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
  var _pendingRequests = [];
  var _reqUnsub = null;
  var _isOpen = false;
  var _outsideClickBound = false;
  var _observer = null;
  var _bizUnread = {};
  var _bizUnsubscribers = [];
  var _beepLastAt = 0;

  var ACTOR_KEY = 'gh_active_actor';

  function getActiveActor() {
    try { return JSON.parse(localStorage.getItem(ACTOR_KEY) || 'null'); } catch(e) { return null; }
  }

  function swToast(msg) {
    if (window.GeoSocial && window.GeoSocial.toast) { window.GeoSocial.toast(msg); return; }
    var old = document.querySelector('.gh-toast'); if (old) old.remove();
    var el = document.createElement('div'); el.className = 'gh-toast'; el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function(){ el.classList.add('show'); });
    setTimeout(function(){ el.classList.remove('show'); setTimeout(function(){ if(el.parentNode) el.remove(); }, 250); }, 2300);
  }

  function setActiveActor(actor) {
    try { localStorage.setItem(ACTOR_KEY, JSON.stringify(actor)); } catch(e) {}
    updateNavbarForActor(actor);
    window.dispatchEvent(new CustomEvent('GeoActorChanged', { detail: actor }));
    close();
    if (actor && actor.type === 'business') swToast('Switched to ' + (actor.title || 'Business'));
    else swToast('Switched back to personal account');
  }

  function updateNavbarForActor(actor) {
    var btn = document.getElementById('geo-sw-btn');
    if (!btn) return;
    if (!actor || actor.type === 'user') {
      btn.innerHTML = btnLabelHtml();
      return;
    }
    var biz = null;
    for (var i = 0; i < _businesses.length; i++) {
      if (_businesses[i].id === actor.businessId) { biz = _businesses[i]; break; }
    }
    // If businesses haven't loaded yet, use actor data from localStorage as fallback
    if (!biz) biz = { id: actor.businessId, title: actor.title || 'Business', logoUrl: actor.logoUrl || '' };
    var iconInner = (biz.logoUrl || actor.logoUrl)
      ? '<img src="'+esc(biz.logoUrl || actor.logoUrl)+'" alt="" class="geo-sw-avatar" style="object-fit:cover">'
      : '<div class="geo-sw-avatar"><i class="fas fa-store" style="font-size:.8rem"></i></div>';
    var badge = _pendingRequests.length
      ? '<span style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:50%;width:18px;height:18px;font-size:.65rem;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid var(--gh-bg,#0d111f);pointer-events:none">'+Math.min(_pendingRequests.length, 9)+'</span>'
      : '';
    btn.innerHTML = '<span style="position:relative;display:inline-flex;flex-shrink:0">'+iconInner+badge+'</span>' +
      '<span style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem">'+esc(biz.title||'Business')+'</span>'+
      '<i class="fas fa-chevron-down geo-sw-chevron"></i>';
  }

  /* ── helpers ───────────────────────────────────────────────── */

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function playBeep() {
    var now = Date.now();
    if (now - _beepLastAt < 4000) return; // debounce — max once per 4 s
    _beepLastAt = now;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
      setTimeout(function() { try { ctx.close(); } catch(e) {} }, 600);
    } catch(e) {} // browser blocked autoplay — fail silently
  }

  function clearBizUnreadListeners() {
    _bizUnsubscribers.forEach(function(u) { try { u(); } catch(e) {} });
    _bizUnsubscribers = [];
    _bizUnread = {};
  }

  function loadBizUnreadListeners(bizIds, ownerUid) {
    clearBizUnreadListeners();
    if (!_db || !_fs || !bizIds.length || !ownerUid) return;
    var startedAt = Date.now();
    bizIds.forEach(function(bizId) {
      _bizUnread[bizId] = 0;
      var q = _fs.query(
        _fs.collection(_db, 'conversations'),
        _fs.where('businessId', '==', bizId),
        _fs.limit(50)
      );
      var unsub = _fs.onSnapshot(q, function(snap) {
        var prev = _bizUnread[bizId] || 0;
        var count = 0;
        snap.forEach(function(d) {
          var data = d.data();
          if (Array.isArray(data.unreadFor) && data.unreadFor.indexOf(ownerUid) !== -1) count++;
        });
        _bizUnread[bizId] = count;
        if (count > prev && Date.now() > startedAt + 2500) playBeep();
        if (_isOpen) {
          var dd = document.getElementById('geo-sw-dropdown');
          if (dd && dd.classList.contains('open')) dd.innerHTML = renderDropdown();
        }
      }, function(err) {
        console.warn('[AccountSwitcher] bizUnread', bizId, err.message);
      });
      _bizUnsubscribers.push(unsub);
    });
  }

  /* ── dropdown HTML ─────────────────────────────────────────── */

  function renderDropdown() {
    if (!_user) return '';

    var avatarContent = _user.photoURL
      ? '<img src="'+esc(_user.photoURL)+'" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">'
      : esc((_user.displayName || _user.email || 'U').charAt(0).toUpperCase());

    var _curActor = getActiveActor();
    var isPersonalActive = !_curActor || _curActor.type !== 'business';
    var profileSection =
      '<a class="geo-sw-profile" href="profile.html">'+
        '<div class="geo-sw-profile-avatar">'+avatarContent+'</div>'+
        '<div style="flex:1;min-width:0">'+
          '<div class="geo-sw-profile-name">'+esc(_user.displayName || (_user.email||'').split('@')[0] || 'User')+'</div>'+
          '<div class="geo-sw-profile-email">'+esc(_user.email||'')+'</div>'+
        '</div>'+
        (isPersonalActive ? '<span class="geo-sw-owner-pill" style="background:#10b981;color:#fff;flex-shrink:0">Active</span>' : '')+
      '</a>';

    // Friend requests section
    var friendReqSection = '';
    if (_pendingRequests.length) {
      friendReqSection = '<div class="geo-sw-divider"></div><div class="geo-sw-section-label">Friend Requests <span style="background:#ef4444;color:#fff;border-radius:10px;padding:1px 7px;font-size:.7rem;font-weight:700;margin-left:4px">'+_pendingRequests.length+'</span></div>';
      _pendingRequests.slice(0, 3).forEach(function(req) {
        var avatar = req.senderAvatar
          ? '<img src="'+esc(req.senderAvatar)+'" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">'
          : '<span style="font-weight:700;font-size:.8rem">'+esc((req.senderName||'U').charAt(0).toUpperCase())+'</span>';
        friendReqSection +=
          '<div class="geo-sw-item" style="flex-direction:column;align-items:flex-start;gap:6px;padding:10px 14px">'+
            '<div style="display:flex;align-items:center;gap:10px">'+
              '<div class="geo-sw-item-icon biz" style="width:36px;height:36px;border-radius:50%">'+avatar+'</div>'+
              '<div style="flex:1;min-width:0">'+
                '<div style="font-size:.82rem;font-weight:700;color:var(--gh-text,#f0f4ff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(req.senderName||'GeoHub User')+'</div>'+
                '<div style="font-size:.7rem;color:var(--gh-muted,#64748b)">Wants to be friends</div>'+
              '</div>'+
            '</div>'+
            '<div style="display:flex;gap:6px;padding-left:46px">'+
              '<button class="geo-sw-req-accept" data-req-id="'+esc(req.id)+'" data-from-uid="'+esc(req.fromUserId)+'" style="background:linear-gradient(135deg,#10b981,#3b82f6);color:#fff;border:none;border-radius:7px;padding:5px 12px;font-size:.74rem;font-weight:700;cursor:pointer">Accept</button>'+
              '<button class="geo-sw-req-decline" data-req-id="'+esc(req.id)+'" style="background:rgba(255,255,255,.07);color:var(--gh-text,#f0f4ff);border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:5px 12px;font-size:.74rem;cursor:pointer">Decline</button>'+
            '</div>'+
          '</div>';
      });
      if (_pendingRequests.length > 3) {
        friendReqSection += '<a class="geo-sw-item" href="profile.html#tab-friends" style="font-size:.78rem;color:var(--gh-muted,#64748b);justify-content:center;padding:6px 14px">See all '+_pendingRequests.length+' requests</a>';
      }
    }

    var currentActor = getActiveActor();
    var actorBanner = '';
    if (currentActor && currentActor.type === 'business') {
      var actingBiz = null;
      for (var i = 0; i < _businesses.length; i++) {
        if (_businesses[i].id === currentActor.businessId) { actingBiz = _businesses[i]; break; }
      }
      if (actingBiz) {
        actorBanner = '<div style="background:rgba(16,185,129,.08);border-bottom:1px solid rgba(16,185,129,.15);padding:10px 14px;font-size:.78rem;color:#10b981">'+
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px">'+
            '<span><i class="fas fa-store"></i> Page identity: <strong>'+esc(actingBiz.title||'Business')+'</strong></span>'+
            '<button onclick="event.stopPropagation();window._geoSW.switchToUser()" style="background:none;border:1px solid rgba(255,255,255,.1);color:#94a3b8;font-size:.72rem;cursor:pointer;padding:3px 8px;border-radius:6px">Switch to personal</button>'+
          '</div>'+
          '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
            '<a href="business.html?id='+esc(actingBiz.id)+'" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:7px;background:rgba(59,130,246,.18);color:#93c5fd;font-size:.72rem;font-weight:700;text-decoration:none"><i class="fas fa-arrow-up-right-from-square"></i> View Page</a>'+
            '<a href="business.html?id='+esc(actingBiz.id)+'&tab=manage" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:7px;background:rgba(255,255,255,.07);color:#94a3b8;font-size:.72rem;font-weight:700;text-decoration:none"><i class="fas fa-gear"></i> Manage</a>'+
            '<a href="messages.html?business='+esc(actingBiz.id)+'" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:7px;background:rgba(255,255,255,.07);color:#94a3b8;font-size:.72rem;font-weight:700;text-decoration:none"><i class="fas fa-comment-dots"></i> Inbox</a>'+
          '</div>'+
        '</div>';
      }
    }

    var bizSection = '';
    if (_businesses.length) {
      bizSection = '<div class="geo-sw-divider"></div><div class="geo-sw-section-label">Your Pages</div>';
      _businesses.forEach(function(biz) {
        var iconInner = biz.logoUrl
          ? '<img src="'+esc(biz.logoUrl)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">'
          : '<i class="fas fa-store"></i>';
        var isActive = currentActor && currentActor.type === 'business' && currentActor.businessId === biz.id;
        var unreadCount = _bizUnread[biz.id] || 0;
        var unreadDot = unreadCount > 0 ? '<span class="geo-sw-unread-dot" title="'+unreadCount+' unread message'+(unreadCount !== 1 ? 's' : '')+'"></span>' : '';
        bizSection +=
          '<div class="geo-sw-item" style="cursor:pointer" onclick="window._geoSW.switchToBusiness(\''+esc(biz.id)+'\')">'+
            '<div class="geo-sw-item-icon biz">'+iconInner+'</div>'+
            '<span class="geo-sw-item-name">'+esc(biz.title||'Business')+'</span>'+
            (isActive ? '<span class="geo-sw-owner-pill" style="background:#10b981;color:#fff">Active</span>' : '<span class="geo-sw-owner-pill">Owner</span>')+
            unreadDot+
            '<a href="business.html?id='+esc(biz.id)+'" onclick="event.stopPropagation()" style="margin-left:4px;color:#64748b;font-size:.8rem;padding:4px;border-radius:6px;display:flex;align-items:center" title="Open page"><i class="fas fa-arrow-up-right-from-square"></i></a>'+
          '</div>';
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

    var personalLabel = '<div class="geo-sw-section-label">Personal Account</div>';
    return actorBanner + personalLabel + profileSection + friendReqSection + bizSection + groupSection + bottomSection;
  }

  /* ── button label HTML ─────────────────────────────────────── */

  function btnLabelHtml() {
    if (!_user) return '';
    var avatarHtml = _user.photoURL
      ? '<img src="'+esc(_user.photoURL)+'" alt="" class="geo-sw-avatar" style="object-fit:cover" onerror="this.style.display=\'none\'">'
      : '<div class="geo-sw-avatar">'+esc((_user.displayName||_user.email||'U').charAt(0).toUpperCase())+'</div>';
    var name = _user.displayName || (_user.email||'').split('@')[0] || 'Account';
    var badge = _pendingRequests.length
      ? '<span style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:50%;width:18px;height:18px;font-size:.65rem;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid var(--gh-bg,#0d111f);pointer-events:none">'+Math.min(_pendingRequests.length, 9)+'</span>'
      : '';
    return '<span style="position:relative;display:inline-flex;flex-shrink:0">'+avatarHtml+badge+'</span>' +
      '<span style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem">'+esc(name)+'</span>'+
      '<i class="fas fa-chevron-down geo-sw-chevron"></i>';
  }

  function updateBtnBadge() {
    updateNavbarForActor(getActiveActor());
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
      // Wire friend request accept/decline buttons
      dropdown.addEventListener('click', function(e) {
        var acceptBtn = e.target.closest('.geo-sw-req-accept');
        if (acceptBtn) {
          e.stopPropagation();
          var reqId = acceptBtn.dataset.reqId;
          var fromUid = acceptBtn.dataset.fromUid;
          if (window.GeoFriendships) {
            window.GeoFriendships.accept(reqId, fromUid);
            _pendingRequests = _pendingRequests.filter(function(r) { return r.id !== reqId; });
            dropdown.innerHTML = renderDropdown();
            updateBtnBadge();
          }
        }
        var declineBtn = e.target.closest('.geo-sw-req-decline');
        if (declineBtn) {
          e.stopPropagation();
          var reqId = declineBtn.dataset.reqId;
          if (window.GeoFriendships) {
            window.GeoFriendships.decline(reqId);
            _pendingRequests = _pendingRequests.filter(function(r) { return r.id !== reqId; });
            dropdown.innerHTML = renderDropdown();
            updateBtnBadge();
          }
        }
      }, { once: false });
    }
    console.debug('[AccountSwitcher] dropdown opened');
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

    // 1. Social redesign slot (#ghActorBtnSlot injected by geohub-social-redesign.js topbar)
    var slot = document.getElementById('ghActorBtnSlot');
    if (slot && slot.parentNode) {
      slot.parentNode.replaceChild(wrap, slot);
      console.debug('[AccountSwitcher] mounted — replaced #ghActorBtnSlot');
    // 2. account.js element (#authNavUser)
    } else if (replaceTarget && replaceTarget.parentNode) {
      replaceTarget.parentNode.replaceChild(wrap, replaceTarget);
      console.debug('[AccountSwitcher] mounted — replaced #authNavUser');
    } else {
      // Fallback: ONLY look inside the real top <nav class="navbar"> to avoid
      // matching sidebar or page-body elements that share class names.
      var topNav = document.querySelector('nav.navbar') || document.querySelector('nav#navbar');
      var actions = topNav ? topNav.querySelector('.navbar-actions') : null;
      if (actions) {
        actions.appendChild(wrap);
        console.debug('[AccountSwitcher] mounted — appended to nav.navbar .navbar-actions');
      } else if (topNav) {
        topNav.appendChild(wrap);
        console.debug('[AccountSwitcher] mounted — appended to nav.navbar');
      } else {
        document.body.appendChild(wrap);
        console.warn('[AccountSwitcher] mounted — fallback to body (no nav.navbar found)');
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
    var root = document.querySelector('nav.navbar, nav#navbar') || document.querySelector('header') || document.body;
    _observer = new MutationObserver(function() {
      if (!_user) return;
      var ourWrap    = document.getElementById('geo-sw-wrap');
      if (ourWrap) return; // already mounted
      var slot       = document.getElementById('ghActorBtnSlot');
      var authUserEl = document.getElementById('authNavUser');
      if (slot) {
        console.debug('[AccountSwitcher] re-mounting after social topbar re-render');
        mountWrap(null);
      } else if (authUserEl) {
        console.debug('[AccountSwitcher] re-mounting after navbar re-render');
        mountWrap(authUserEl);
      }
    });
    _observer.observe(root, { childList: true, subtree: true });
    console.debug('[AccountSwitcher] observer started');
  }

  /* ── GeoActorChanged: keep button in sync when actor is changed externally ── */

  window.addEventListener('GeoActorChanged', function() {
    updateNavbarForActor(getActiveActor());
    if (_isOpen) {
      var dd = document.getElementById('geo-sw-dropdown');
      if (dd && dd.classList.contains('open')) dd.innerHTML = renderDropdown();
    }
  });

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
    console.debug('[AccountSwitcher] user ready via GeoAuthReady:', _user.email);
    var authUser = document.getElementById('authNavUser');
    mountWrap(authUser || null);
    if (_user.uid) { loadUserBusinesses(_user.uid); loadUserGroups(_user.uid); loadFriendRequests(_user.uid); }
    startObserver();
  });

  /* ── data ──────────────────────────────────────────────────── */

  function loadUserBusinesses(uid) {
    if (!_db || !_fs) return;
    _businesses = [];
    // Query 1: businessAdmins docs where userId === uid
    var adminP = _fs.getDocs(_fs.query(
      _fs.collection(_db, 'businessAdmins'),
      _fs.where('userId', '==', uid),
      _fs.limit(10)
    )).then(function(snap) {
      var ids = [];
      snap.forEach(function(d) {
        var id = d.id.replace('_' + uid, '');
        if (id) ids.push(id);
      });
      return ids;
    }).catch(function() { return []; });
    // Query 2: businesses where user is direct owner (ownerId field)
    var ownerP = _fs.getDocs(_fs.query(
      _fs.collection(_db, 'businesses'),
      _fs.where('ownerId', '==', uid),
      _fs.limit(10)
    )).then(function(snap) {
      var ids = [];
      snap.forEach(function(d) { ids.push(d.id); });
      return ids;
    }).catch(function() { return []; });
    Promise.all([adminP, ownerP]).then(function(both) {
      // Deduplicate IDs from both sources
      var seen = {}, bizIds = [];
      both[0].concat(both[1]).forEach(function(id) {
        if (id && !seen[id]) { seen[id] = true; bizIds.push(id); }
      });
      if (!bizIds.length) return null;
      return Promise.all(bizIds.map(function(id) {
        return _fs.getDoc(_fs.doc(_db, 'businesses', id))
          .then(function(d) {
            if (!d.exists()) return null;
            var data = d.data();
            // Skip soft-deleted pages so they don't appear in the account switcher
            if (data.status === 'deleted' || data.deleted === true || !!data.deletedAt) return null;
            return Object.assign({id: d.id}, data);
          })
          .catch(function() { return null; });
      }));
    }).then(function(results) {
      if (!results) return;
      _businesses = results.filter(Boolean);
      updateNavbarForActor(getActiveActor());
      if (_isOpen) {
        var dd = document.getElementById('geo-sw-dropdown');
        if (dd && dd.classList.contains('open')) dd.innerHTML = renderDropdown();
      }
      var ownerUid = _user && _user.uid;
      loadBizUnreadListeners(_businesses.map(function(bz) { return bz.id; }), ownerUid);
    }).catch(function() {});
  }

  function loadFriendRequests(uid) {
    if (!_db || !_fs) return;
    // Unsubscribe previous listener
    if (_reqUnsub) { try { _reqUnsub(); } catch(e) {} _reqUnsub = null; }

    function doListen() {
      _reqUnsub = _fs.onSnapshot(
        _fs.query(
          _fs.collection(_db, 'friendRequests'),
          _fs.where('toUserId', '==', uid),
          _fs.where('status', '==', 'pending'),
          _fs.limit(20)
        ),
        function(snap) {
          var reqs = [];
          var pending = snap.docs.length;
          if (!pending) {
            _pendingRequests = [];
            updateBtnBadge();
            if (_isOpen) {
              var dd = document.getElementById('geo-sw-dropdown');
              if (dd && dd.classList.contains('open')) dd.innerHTML = renderDropdown();
            }
            return;
          }
          snap.docs.forEach(function(d) {
            var r = Object.assign({ id: d.id }, d.data());
            _fs.getDoc(_fs.doc(_db, 'users', r.fromUserId)).then(function(uSnap) {
              var uData = uSnap.exists() ? uSnap.data() : {};
              r.senderName = uData.fullName || uData.displayName || 'GeoHub User';
              r.senderAvatar = uData.avatar || uData.photoURL || '';
              reqs.push(r);
              if (reqs.length === snap.docs.length) {
                _pendingRequests = reqs;
                updateBtnBadge();
                if (_isOpen) {
                  var dd = document.getElementById('geo-sw-dropdown');
                  if (dd && dd.classList.contains('open')) dd.innerHTML = renderDropdown();
                }
              }
            }).catch(function() {
              r.senderName = 'GeoHub User';
              r.senderAvatar = '';
              reqs.push(r);
              if (reqs.length === snap.docs.length) {
                _pendingRequests = reqs;
                updateBtnBadge();
                if (_isOpen) {
                  var dd = document.getElementById('geo-sw-dropdown');
                  if (dd && dd.classList.contains('open')) dd.innerHTML = renderDropdown();
                }
              }
            });
          });
        },
        function(err) { console.warn('[AccountSwitcher] friendRequests listener error', err.message); }
      );
    }

    // Small delay to let auth settle
    setTimeout(doListen, 1500);
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
    console.debug('[AccountSwitcher] loaded, Firebase ready');
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
        console.debug('[AccountSwitcher] late-init: replacing existing #authNavUser');
        mountWrap(authUser);
        loadUserBusinesses(_user.uid);
        loadUserGroups(_user.uid);
        loadFriendRequests(_user.uid);
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
    },
    switchToBusiness: function(bizId) {
      var biz = null;
      for (var i = 0; i < _businesses.length; i++) {
        if (_businesses[i].id === bizId) { biz = _businesses[i]; break; }
      }
      if (!biz || !_user) return;
      setActiveActor({ type: 'business', businessId: bizId, ownerUid: _user.uid, title: biz.title || 'Business', logoUrl: biz.logoUrl || '' });
    },
    switchToUser: function() {
      if (!_user) return;
      setActiveActor({ type: 'user', uid: _user.uid });
    },
    getActor: getActiveActor,
    onBusinessUpdated: function(bizId, data) {
      for (var i = 0; i < _businesses.length; i++) {
        if (_businesses[i].id === bizId) { Object.assign(_businesses[i], data); break; }
      }
      updateNavbarForActor(getActiveActor());
      if (_isOpen) {
        var dd = document.getElementById('geo-sw-dropdown');
        if (dd && dd.classList.contains('open')) dd.innerHTML = renderDropdown();
      }
    }
  };

  if (window.GeoFirebase && window.GeoFirebase.db) init(window.GeoFirebase);
  else window.addEventListener('GeoFirebaseReady', function() { init(window.GeoFirebase); }, {once: true});

})();
