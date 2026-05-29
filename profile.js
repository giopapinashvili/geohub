(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const compact = (v) => Number(v || 0) >= 1000 ? (Number(v) / 1000).toFixed(Number(v) >= 10000 ? 0 : 1) + 'k' : String(Number(v || 0));
  const safeUrl = (s) => { var u = String(s || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; };

  function timeAgo(ts) {
    if (!ts) return '';
    var ms = typeof ts === 'object' ? (ts.toMillis ? ts.toMillis() : (ts.seconds || 0) * 1000) : Number(ts);
    var diff = Date.now() - ms;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    return new Date(ms).toLocaleDateString();
  }

  function isOpenNow(workingHours) {
    if (!workingHours) return null;
    var days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    var day = days[new Date().getDay()];
    var h = workingHours[day];
    if (!h || h.closed) return false;
    var now = new Date(); var cur = now.getHours() * 60 + now.getMinutes();
    function toMin(t) { var p = String(t || '00:00').split(':'); return parseInt(p[0] || 0) * 60 + parseInt(p[1] || 0); }
    return cur >= toMin(h.open) && cur < toMin(h.close);
  }

  function initialLetters(name, email) {
    name = String(name || '').trim();
    email = String(email || '').trim().toLowerCase();
    if (!name && email) name = email.split('@')[0].replace(/[._-]+/g, ' ');
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return 'GH';
  }

  function initialsSvg(initials) {
    const text = encodeURIComponent(initials || 'GH');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="120" fill="#6d3fd9"/><circle cx="120" cy="120" r="114" fill="none" stroke="#10b981" stroke-width="8"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="86" fill="white" font-weight="700">${text}</text></svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function toast(msg, type) {
    if (window.GeoSocial && window.GeoSocial.toast) return window.GeoSocial.toast(msg, type);
    console[type === 'error' ? 'error' : 'log']('[Profile]', msg);
  }
  function _pt(key,fallback){ if(typeof window.GHt==='function'){var v=window.GHt(key);if(v&&v!==key)return v;} return fallback||key; }

  function whenFirebase(cb) {
    if (window.GeoFirebase) return cb(window.GeoFirebase);
    window.addEventListener('GeoFirebaseReady', () => cb(window.GeoFirebase), { once: true });
  }

  function onAuthReady(GF, cb) {
    if (!GF || !GF.auth) return cb(null);
    if (typeof GF.auth.onAuthStateChanged === 'function') {
      return GF.auth.onAuthStateChanged(cb);
    }
    let waited = 0;
    const timer = setInterval(() => {
      waited += 100;
      if (GF.auth.currentUser || waited >= 3500) {
        clearInterval(timer);
        cb(GF.auth.currentUser || null);
      }
    }, 100);
  }

  function normalizeProfile(fbUser, data) {
    data = data || {};
    const email = data.email || (fbUser && fbUser.email) || '';
    let fullName = data.fullName || data.displayName || data.name || (fbUser && fbUser.displayName) || '';
    if (!fullName && email) fullName = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
    const initials = initialLetters(fullName, email);
    const avatar = data.avatar || data.photoURL || (fbUser && fbUser.photoURL) || initialsSvg(initials);
    return {
      uid: data.uid || data.id || (fbUser && fbUser.uid) || '',
      id: data.uid || data.id || (fbUser && fbUser.uid) || '',
      fullName: fullName || 'GeoHub User',
      username: data.username || (email ? email.split('@')[0].replace(/[^a-z0-9_.]/gi, '.').toLowerCase() : ''),
      email,
      avatar,
      coverImage: data.coverImage || '',
      bio: data.bio || '',
      city: data.cityScope === 'all_georgia' ? 'All Georgia' : (data.city || ''),
      cities: Array.isArray(data.cities) ? data.cities : (data.city ? [data.city] : ['all_georgia']),
      cityScope: data.cityScope || (data.city === 'all_georgia' ? 'all_georgia' : ''),
      accountType: data.accountType || 'Explorer',
      explorerLevel: data.explorerLevel || 'New Explorer',
      xp: Number(data.xp || 0),
      followers: Number(data.followers || 0),
      friendsCount: Number(data.friendsCount || 0),
      following: Number(data.following || 0),
      postsCount: Number(data.postsCount || 0),
      visitedPlaces: Number(data.visitedPlaces || 0),
      trustScore: Number(data.trustScore || 0),
      pointsBalance: Number(data.pointsBalance || data.geoPointsBalance || 0),
      interests: Array.isArray(data.interests) ? data.interests : [],
      badges: Array.isArray(data.badges) ? data.badges : [],
      socialLinks: data.socialLinks || {},
      website: data.website || '',
      createdAt: data.createdAt || data.joinedAt || null,
      privacy: data.privacy || null,
      isPrivate: data.isPrivate === true,
      geoId: data.geoId || null,
      nameVisibility: data.nameVisibility || 'everyone',
      initials
    };
  }

  function resolveDisplayName(user, isOwn) {
    if (isOwn) return user.fullName;
    var vis = user.nameVisibility || 'everyone';
    if (vis === 'me')       return '@' + (user.username || 'user');
    if (vis === 'friends')  return '@' + (user.username || 'user'); // simplified: full check needs friendship query
    return user.fullName;
  }

  async function ensureOwnProfile(GF, fbUser) {
    const ref = GF.fs.doc(GF.db, 'users', fbUser.uid);
    const snap = await GF.fs.getDoc(ref);
    const profile = normalizeProfile(fbUser, snap.exists() ? snap.data() : {});
    if (!snap.exists()) {
      await GF.fs.setDoc(ref, {
        uid: profile.uid,
        fullName: profile.fullName,
        username: profile.username,
        email: profile.email,
        avatar: profile.avatar,
        bio: '', city: 'all_georgia', cityScope: 'all_georgia', cities: ['all_georgia'], accountType: 'Explorer', interests: [],
        followers: 0, following: 0, postsCount: 0, visitedPlaces: 0,
        createdAt: GF.fs.serverTimestamp()
      }, { merge: true }).catch(err => console.warn('[Profile] create user doc failed', err.message));
    }
    return profile;
  }

  async function findProfile(GF, fbUser) {
    const params = new URLSearchParams(location.search);
    const uid = params.get('id') || params.get('uid');
    const username = params.get('user') || (location.pathname.match(/@([^/?#]+)/) || [])[1];
    const geoIdParam = params.get('geoId') || params.get('geoid');

    if (!uid && !username && !geoIdParam) return ensureOwnProfile(GF, fbUser);

    if (uid) {
      const snap = await GF.fs.getDoc(GF.fs.doc(GF.db, 'users', uid));
      if (!snap.exists()) return null;
      return normalizeProfile(null, Object.assign({ uid }, snap.data()));
    }

    // Search by 5-digit numeric geoId
    if (geoIdParam) {
      const numId = Number(geoIdParam);
      if (!isNaN(numId)) {
        const q = GF.fs.query(GF.fs.collection(GF.db, 'users'), GF.fs.where('geoId', '==', numId), GF.fs.limit(1));
        const res = await GF.fs.getDocs(q);
        if (!res.empty) {
          const doc = res.docs[0];
          return normalizeProfile(null, Object.assign({ uid: doc.id }, doc.data()));
        }
      }
      return null;
    }

    const q = GF.fs.query(GF.fs.collection(GF.db, 'users'), GF.fs.where('username', '==', username), GF.fs.limit(1));
    const res = await GF.fs.getDocs(q);
    if (res.empty) {
      if (fbUser && username && username === (fbUser.email || '').split('@')[0].replace(/[^a-z0-9_.]/gi, '.').toLowerCase()) {
        return ensureOwnProfile(GF, fbUser);
      }
      return null;
    }
    const doc = res.docs[0];
    return normalizeProfile(null, Object.assign({ uid: doc.id }, doc.data()));
  }

  function level(user) { return Math.max(1, Math.floor(Number(user.xp || 0) / 1000) + 1); }

  function renderStats(user) {
    const vals = [user.visitedPlaces, user.friendsCount || 0, user.followers, user.following, user.pointsBalance || Math.floor(user.xp / 10), user.trustScore];
    $$('.profile-stats-bar .pstat-value').forEach((el, i) => { el.textContent = compact(vals[i] || 0); });
    $$('.ptab .tab-count').forEach(c => { c.textContent = '0'; });
    // Make followers + following pstats clickable
    $$('.profile-stats-bar .pstat').forEach(function(el) {
      var lbl = (el.querySelector('.pstat-label') || {}).textContent || '';
      if (lbl === 'Followers') { el.style.cursor = 'pointer'; el.dataset.pfModal = 'followers'; el.title = 'ვინ მოგყვება'; }
      if (lbl === 'Following') { el.style.cursor = 'pointer'; el.dataset.pfModal = 'following'; el.title = 'ვის მოჰყვები'; }
    });
  }

  /* ── Followers / Following modal ────────────────────────── */
  function openFollowModal(type, userId) {
    var GF = window.GeoFirebase;
    if (!GF || !GF.fs || !GF.db) return;
    var title = type === 'followers' ? 'მომყოლები' : 'მოჰყვები';
    // Build modal
    var overlay = document.createElement('div');
    overlay.className = 'pf-modal-overlay';
    overlay.innerHTML =
      '<div class="pf-modal">' +
        '<div class="pf-modal-head">' +
          '<h3>' + title + '</h3>' +
          '<button class="pf-modal-close" id="pfModalClose"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="pf-modal-list" id="pfModalList">' +
          '<div class="pf-modal-loading"><i class="fas fa-spinner fa-spin"></i></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#pfModalClose').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

    // Query
    var field = type === 'followers' ? 'followingId' : 'followerId';
    var nameField = type === 'followers' ? 'followerId' : 'followingId';
    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'follows'),
      GF.fs.where(field, '==', userId),
      GF.fs.limit(100)
    )).then(function(snap) {
      var list = document.getElementById('pfModalList');
      if (!list) return;
      if (snap.empty) { list.innerHTML = '<div class="pf-modal-empty"><i class="fas fa-user-slash"></i><span>' + (type === 'followers' ? 'მომყოლი არ არის' : 'არავის მოჰყვები') + '</span></div>'; return; }
      var uids = [];
      snap.forEach(function(d) { var uid = (d.data() || {})[nameField]; if (uid) uids.push(uid); });
      // Fetch user docs (up to 10 at a time)
      var fetches = uids.map(function(uid) {
        return GF.fs.getDoc(GF.fs.doc(GF.db, 'users', uid)).then(function(d) {
          var data = d.exists() ? d.data() : {};
          return { uid: uid, name: data.fullName || data.displayName || data.name || 'GeoHub User', avatar: data.avatar || data.photoURL || '' };
        }).catch(function() { return { uid: uid, name: 'User', avatar: '' }; });
      });
      Promise.all(fetches).then(function(users) {
        if (!list) return;
        list.innerHTML = users.map(function(u) {
          var av = u.avatar
            ? '<img src="' + esc(u.avatar) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'\'">' +
              '<span style="display:none">' + esc((u.name||'U').charAt(0)) + '</span>'
            : '<span>' + esc((u.name||'U').charAt(0)) + '</span>';
          return '<a class="pf-modal-user" href="profile.html?id=' + esc(u.uid) + '">' +
            '<span class="pf-modal-av">' + av + '</span>' +
            '<span class="pf-modal-name">' + esc(u.name) + '</span>' +
            '<i class="fas fa-chevron-right pf-modal-arr"></i>' +
          '</a>';
        }).join('');
      });
    }).catch(function() {
      var list = document.getElementById('pfModalList');
      if (list) list.innerHTML = '<div class="pf-modal-empty"><i class="fas fa-triangle-exclamation"></i><span>ჩატვირთვა ვერ მოხერხდა</span></div>';
    });
  }

  async function refreshRealStats(user) {
    const GF = window.GeoFirebase;
    if (!GF || !GF.fs || !GF.db || !user || !user.uid) return;
    const getDocs = async q => {
      const snap = await GF.fs.getDocs(q);
      return snap.docs || [];
    };
    try {
      const [postDocs, friendsDocs, friendshipsDocs, followerDocs, followingDocs] = await Promise.all([
        getDocs(GF.fs.query(GF.fs.collection(GF.db, 'posts'), GF.fs.where('authorId', '==', user.uid), GF.fs.limit(200))).catch(() => []),
        getDocs(GF.fs.query(GF.fs.collection(GF.db, 'friends'), GF.fs.where('users', 'array-contains', user.uid), GF.fs.limit(200))).catch(() => []),
        getDocs(GF.fs.query(GF.fs.collection(GF.db, 'friendships'), GF.fs.where('users', 'array-contains', user.uid), GF.fs.limit(200))).catch(() => []),
        getDocs(GF.fs.query(GF.fs.collection(GF.db, 'follows'), GF.fs.where('followingId', '==', user.uid), GF.fs.limit(200))).catch(() => []),
        getDocs(GF.fs.query(GF.fs.collection(GF.db, 'follows'), GF.fs.where('followerId', '==', user.uid), GF.fs.limit(200))).catch(() => [])
      ]);
      // Deduplicate friends across both collections by doc ID (same sorted pair ID used in both).
      const friendIds = new Set([...friendsDocs.map(d => d.id), ...friendshipsDocs.map(d => d.id)]);
      const friends = friendIds.size;
      const posts = postDocs.length;
      const followers = followerDocs.length;
      const following = followingDocs.length;
      const vals = [Number(user.visitedPlaces || 0), friends, followers, following, user.pointsBalance || Math.floor(Number(user.xp || 0) / 10), Number(user.trustScore || 0)];
      $$('.profile-stats-bar .pstat-value').forEach((el, i) => { el.textContent = compact(vals[i] || 0); });
      const postTab = $('.ptab[data-tab="posts"] .tab-count'); if (postTab) postTab.textContent = posts || '0';
      const friendsTab = $('.ptab[data-tab="friends"] .tab-count'); if (friendsTab) friendsTab.textContent = friends || '0';
    } catch (err) {
      console.warn('[Profile] real stats failed', err && err.message);
    }
  }

  function renderIdentity(user, fbUser) {
    document.title = user.fullName + ' — GeoHub';
    const cover = $('.profile-cover');
    if (cover) {
      if (user.coverImage) {
        cover.classList.add('dynamic-cover');
        cover.style.backgroundImage = `url('${user.coverImage}')`;
      } else {
        cover.classList.remove('dynamic-cover');
        cover.style.backgroundImage = 'linear-gradient(135deg, rgba(16,185,129,0.20), rgba(77,166,255,0.12), rgba(123,97,255,0.12))';
      }
    }
    const av = $('.profile-avatar'); if (av) { av.src = user.avatar; av.alt = user.fullName; av.onerror = function(){ this.onerror=null; this.src=initialsSvg(user.initials||'GH'); }; }
    const lvl = $('.avatar-level'); if (lvl) lvl.textContent = level(user);
    const name = $('.profile-name');
    const handle = $('.profile-handle');
    const bio = $('.profile-bio'); if (bio) bio.textContent = user.bio || _t('profile_no_bio');
    const badges = $('.trust-badges');
    if (badges) {
      var _badgeHtml = '<span class="trust-badge green"><i class="fas fa-check-circle"></i> ' + _t('profile_real_account') + '</span>';
      if (user.verified === true) _badgeHtml += '<span class="trust-badge blue"><i class="fas fa-circle-check"></i> Verified</span>';
      if (Number(user.xp) > 0) _badgeHtml += '<span class="trust-badge gold"><i class="fas fa-bolt"></i> ' + compact(user.xp) + ' XP</span>';
      badges.innerHTML = _badgeHtml;
    }
    // Phase 22: Achievement badge strip
    _renderAchievementStrip(user.uid);
    const own = fbUser && user.uid === fbUser.uid;
    const displayedName = resolveDisplayName(user, own);
    if (name) name.textContent = displayedName;
    if (handle) {
      var handleParts = '@' + (user.username || 'user') + (user.city ? ' · ' + user.city : '');
      if (own && user.geoId) handleParts += ' · #' + user.geoId;
      handle.textContent = handleParts;
    }
    // Show geoId badge on own profile
    var geoIdBadge = document.getElementById('profileGeoId');
    if (own && user.geoId) {
      if (!geoIdBadge) {
        geoIdBadge = document.createElement('span');
        geoIdBadge.id = 'profileGeoId';
        geoIdBadge.title = 'Your GeoHub ID — share this for others to find you';
        geoIdBadge.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;background:rgba(77,166,255,.13);border:1px solid rgba(77,166,255,.25);color:#4da6ff;font-size:.73rem;font-weight:700;cursor:default;letter-spacing:.03em;margin-left:6px';
        geoIdBadge.innerHTML = '<i class="fas fa-hashtag" style="font-size:.65rem"></i>' + user.geoId;
        var nameEl = document.querySelector('.profile-name');
        if (nameEl && nameEl.parentNode) nameEl.parentNode.appendChild(geoIdBadge);
      } else { geoIdBadge.textContent = '#' + user.geoId; }
    }
    if (!own) {
      var _savedTabEl = document.querySelector('.ptab[data-tab="saved"]');
      if (_savedTabEl) _savedTabEl.style.display = 'none';
      var _savedPanelEl = document.getElementById('tab-saved');
      if (_savedPanelEl) _savedPanelEl.style.display = 'none';
    }
    var _t = function(k){ return typeof window.GHt === 'function' ? window.GHt(k) : k; };
    const coverActions = $('.cover-actions');
    if (coverActions) coverActions.innerHTML = own
      ? '<button class="cover-btn" data-edit-cover><i class="fas fa-camera"></i> Edit Cover</button><button class="cover-btn" data-share-profile><i class="fas fa-share-alt"></i> '+_t('post_action_share')+'</button><button class="cover-btn primary" data-edit-profile><i class="fas fa-pen"></i> '+_t('profile_edit')+'</button>'
      : '<button class="cover-btn" data-share-profile><i class="fas fa-share-alt"></i> '+_t('post_action_share')+'</button><button class="cover-btn primary" data-friend-user="' + esc(user.uid) + '"><i class="fas fa-user-plus"></i> '+_t('profile_add_friend')+'</button>';
    if (own) {
      const avatarWrap = $('.profile-avatar-wrap');
      if (avatarWrap && !avatarWrap.querySelector('.profile-avatar-edit')) {
        const editBtn = document.createElement('button');
        editBtn.className = 'profile-avatar-edit';
        editBtn.setAttribute('data-change-avatar', '');
        editBtn.setAttribute('aria-label', 'Change profile photo');
        editBtn.innerHTML = '<i class="fas fa-camera"></i>';
        avatarWrap.appendChild(editBtn);
      }
    }
    const actions = $('.profile-actions');
    if (actions) actions.innerHTML = own ? '<button class="btn btn-primary btn-sm" data-edit-profile><i class="fas fa-pen"></i> '+_t('profile_edit')+'</button><button class="btn btn-ghost btn-sm" data-share-profile><i class="fas fa-share-alt"></i> '+_t('post_action_share')+'</button><button class="btn btn-ghost btn-sm profile-body-logout" data-logout><i class="fas fa-right-from-bracket"></i> Logout</button>' : '<button class="btn btn-ghost btn-sm" data-message-user="' + esc(user.uid) + '"><i class="fas fa-envelope"></i> '+_t('profile_message')+'</button><button class="btn btn-ghost btn-sm" data-call-user="' + esc(user.uid) + '" data-call-type="audio" data-call-name="' + esc(user.fullName) + '" data-call-avatar="' + esc(user.avatar || '') + '" title="'+_t('call_voice','Voice call')+'"><i class="fas fa-phone"></i></button><button class="btn btn-ghost btn-sm" data-call-user="' + esc(user.uid) + '" data-call-type="video" data-call-name="' + esc(user.fullName) + '" data-call-avatar="' + esc(user.avatar || '') + '" title="'+_t('call_video','Video call')+'"><i class="fas fa-video"></i></button><button class="btn btn-primary btn-sm" data-friend-user="' + esc(user.uid) + '"><i class="fas fa-user-plus"></i> '+_t('profile_add_friend')+'</button><button class="btn btn-ghost btn-sm" data-follow-user="' + esc(user.uid) + '"><i class="fas fa-rss"></i> '+_t('follow')+'</button><button class="btn btn-ghost btn-sm" data-report-user="' + esc(user.uid) + '" data-user-name="' + esc(user.fullName) + '"><i class="fas fa-flag"></i></button><button class="btn btn-ghost btn-sm" data-mute-user="' + esc(user.uid) + '" data-user-name="' + esc(user.fullName) + '"><i class="fas fa-volume-mute"></i></button><button class="btn btn-ghost btn-sm" data-block-user="' + esc(user.uid) + '" data-user-name="' + esc(user.fullName) + '"><i class="fas fa-ban"></i></button>';
    // Profile visibility helpers
    var _privRel = own ? 'own' : 'stranger';
    var _privIsFollower = false;
    function _ppAllowed(setting, rel) {
      if (!setting || setting === 'everyone') return true;
      if (setting === 'nobody') return false;
      if (setting === 'friends') return rel === 'friend';
      if (setting === 'followers') return rel === 'follower' || rel === 'friend';
      return true;
    }
    function _applyProfileVisibility(rel) {
      if (own) return;
      var priv = user.privacy || {};
      var nameEl = document.querySelector('.profile-name');
      var bioEl = document.querySelector('.profile-bio');
      if (nameEl) {
        var showName = _ppAllowed(priv.showFullName, rel);
        nameEl.textContent = showName ? user.fullName : ('@' + (user.username || 'user'));
      }
      if (bioEl) {
        var showBio = _ppAllowed(priv.showBio, rel);
        bioEl.textContent = showBio ? (user.bio || _t('profile_no_bio')) : _t('profile_bio_private');
      }
    }
    if (!own) _applyProfileVisibility('stranger');

    if (!own) {
      var _socialStateSetup = false;
      var _setupSocialBtnState = function() {
        if (_socialStateSetup) return;
        if (!window.GeoSocial) return;
        _socialStateSetup = true;
        if (window.GeoSocial.checkFollowing) {
          window.GeoSocial.checkFollowing(user.uid, function(isFollowing) {
            $$('[data-follow-user="' + user.uid + '"]').forEach(function(btn) {
              btn.classList.toggle('following', !!isFollowing);
              btn.innerHTML = isFollowing
                ? '<i class="fas fa-user-check"></i> '+(typeof GHt==='function'?GHt('unfollow'):'Following')
                : '<i class="fas fa-rss"></i> '+(typeof GHt==='function'?GHt('follow'):'Follow');
            });
            _privIsFollower = !!isFollowing;
            if (_privRel !== 'friend') {
              _privRel = _privIsFollower ? 'follower' : 'stranger';
              _applyProfileVisibility(_privRel);
            }
          });
        }
        if (window.GeoSocial.listenFriendshipStatus) {
          window.GeoSocial.listenFriendshipStatus(user.uid, function(status) {
            updateFriendButtons(user.uid, status);
            var newRel = status === 'friends' ? 'friend' : (_privIsFollower ? 'follower' : 'stranger');
            if (newRel !== _privRel) { _privRel = newRel; _applyProfileVisibility(_privRel); }
          });
        }
      };
      if (window.GeoSocial) {
        _setupSocialBtnState();
      } else {
        window.addEventListener('GeoSocialReady', _setupSocialBtnState, { once: true });
      }
    }
    // Online status display
    if (!own) {
      var onlineEl = document.getElementById('profile-online-status');
      if (!onlineEl) {
        onlineEl = document.createElement('div');
        onlineEl.id = 'profile-online-status';
        onlineEl.style.cssText = 'margin-top:4px';
        var nameBlock = document.querySelector('.profile-name-block');
        if (nameBlock) nameBlock.appendChild(onlineEl);
      }
      if (window.GeoFriendships) window.GeoFriendships.renderOnlineStatus(user.uid, onlineEl);
      else window.addEventListener('GeoFriendshipsReady', function() { if (window.GeoFriendships) window.GeoFriendships.renderOnlineStatus(user.uid, onlineEl); }, { once: true });
      // Mutual friends
      var mutualEl = document.getElementById('profile-mutual-friends');
      if (!mutualEl) {
        mutualEl = document.createElement('div');
        mutualEl.id = 'profile-mutual-friends';
        mutualEl.style.cssText = 'margin-top:6px';
        var nameBlock2 = document.querySelector('.profile-name-block');
        if (nameBlock2) nameBlock2.appendChild(mutualEl);
      }
      if (window.GeoFriendships) window.GeoFriendships.renderMutualFriendsWidget(user.uid, mutualEl);
      else window.addEventListener('GeoFriendshipsReady', function() { if (window.GeoFriendships) window.GeoFriendships.renderMutualFriendsWidget(user.uid, mutualEl); }, { once: true });
    }
    if (!own && window.GeoSocial) {
      if (window.GeoSocial.checkBlocking) {
        window.GeoSocial.checkBlocking(user.uid, function(amBlocking) {
          const btn = document.querySelector('[data-block-user="' + user.uid + '"]');
          if (!btn || !amBlocking) return;
          btn.setAttribute('data-unblock-user', user.uid);
          btn.removeAttribute('data-block-user');
          btn.innerHTML = '<i class="fas fa-ban" style="color:#f87171"></i>';
          btn.title = 'Unblock';
        });
      }
      if (window.GeoSocial.checkMuting) {
        window.GeoSocial.checkMuting(user.uid, function(amMuting) {
          const btn = document.querySelector('[data-mute-user="' + user.uid + '"]');
          if (!btn || !amMuting) return;
          btn.setAttribute('data-unmute-user', user.uid);
          btn.removeAttribute('data-mute-user');
          btn.innerHTML = '<i class="fas fa-volume-up" style="color:#f59e0b"></i>';
          btn.title = 'Unmute';
        });
      }
      if (window.GeoSocial.checkBlockedBy) {
        window.GeoSocial.checkBlockedBy(user.uid, function(blockedByThem) {
          if (!blockedByThem) return;
          const msgBtn = document.querySelector('[data-message-user]');
          const friendBtn = document.querySelector('[data-friend-user]');
          const followBtn = document.querySelector('[data-follow-user]');
          if (msgBtn) msgBtn.style.display = 'none';
          if (friendBtn) friendBtn.style.display = 'none';
          if (followBtn) followBtn.style.display = 'none';
        });
      }
    }
    renderStats(user);
    refreshRealStats(user);
    renderStaticEmptyStates(user);
    if (own) maybeShowCompletionHint(user);
  }

  function renderPymkSidebar() {
    var card = document.querySelector('.following-card.sidebar-card');
    if (!card) return;
    var inner = card.querySelector('[style]') || card.lastElementChild;
    if (inner) inner.remove();
    var target = document.createElement('div');
    target.id = 'pymk-sidebar-content';
    card.appendChild(target);
    if (window.GeoFriendships) {
      window.GeoFriendships.renderPymkWidget(target);
    } else {
      window.addEventListener('GeoFriendshipsReady', function() {
        if (window.GeoFriendships) window.GeoFriendships.renderPymkWidget(target);
      }, { once: true });
    }
  }

  function renderStaticEmptyStates(user) {
    var _t = function(k){ return typeof window.GHt === 'function' ? window.GHt(k) : k; };
    const l = level(user), xp = Number(user.xp || 0), inLvl = xp % 1000;
    const pill = $('.xp-level-pill'); if (pill) pill.innerHTML = '<i class="fas fa-bolt"></i> Level ' + l;
    const title = $('.xp-title-text'); if (title) title.textContent = user.explorerLevel || 'New Explorer';
    const fill = $('.xp-bar-fill'); if (fill) fill.style.width = Math.min(100, inLvl / 10) + '%';
    const nums = $('.xp-bar-numbers'); if (nums) nums.textContent = xp + ' / ' + (l * 1000) + ' XP';
    const next = $('.xp-to-next'); if (next) next.textContent = (1000 - inLvl) + (_t('profile_xp_to_level') || ' XP to Level ') + (l + 1);
    const intro = $$('.intro-item');
    if (intro[0]) intro[0].innerHTML = '<i class="fas fa-map-marker-alt"></i> ' + (user.cityScope === 'all_georgia' ? _t('profile_all_georgia') : (user.city ? esc(user.city) : _t('profile_no_location')));
    if (intro[1]) intro[1].innerHTML = '<i class="fas fa-hiking"></i> ' + esc(user.accountType || 'Explorer');
    if (intro[2]) intro[2].innerHTML = '<i class="fas fa-calendar-alt"></i> ' + _t('profile_join_date_na');
    if (intro[3]) intro[3].innerHTML = '<i class="fas fa-globe"></i> ' + (user.username ? 'geohub.ge/@' + esc(user.username) : _t('profile_no_username'));
    const lifestyle = $('.lifestyle-scores'); if (lifestyle) lifestyle.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:8px 0">' + _t('trust_activity_hint') + '</div>';
    const trustList = $('#trustItemsList');
    if (trustList) {
      var checkins = Number(user.checkinCount || user.checkinsCount || 0);
      var cameraProofs = Number(user.cameraProofs || user.cameraProofCount || 0);
      var phoneOk = !!user.phoneVerified;
      var idOk = !!user.idVerified;
      var cities = Number(user.citiesVisited || user.visitedCities || 0);
      trustList.innerHTML = [
        '<div class="trust-item ok"><i class="fas fa-check-circle"></i> ' + _t('trust_real_account') + '</div>',
        cameraProofs > 0 ? '<div class="trust-item ok"><i class="fas fa-camera"></i> ' + cameraProofs + ' ' + _t('trust_camera_proof') + (cameraProofs !== 1 ? 's' : '') + '</div>' : '<div class="trust-item warn"><i class="fas fa-camera"></i> ' + _t('trust_no_camera') + '</div>',
        checkins > 0 ? '<div class="trust-item ok"><i class="fas fa-map-marker-alt"></i> ' + checkins + ' ' + _t('trust_checkin') + (checkins !== 1 ? 's' : '') + '</div>' : '<div class="trust-item warn"><i class="fas fa-map-marker-alt"></i> ' + _t('trust_no_checkin') + '</div>',
        phoneOk ? '<div class="trust-item ok"><i class="fas fa-phone"></i> ' + _t('trust_phone_ok') + '</div>' : '<div class="trust-item warn"><i class="fas fa-phone"></i> ' + _t('trust_phone_no') + '</div>',
        idOk ? '<div class="trust-item ok"><i class="fas fa-id-card"></i> ' + _t('trust_id_ok') + '</div>' : '<div class="trust-item warn"><i class="fas fa-id-card"></i> ' + _t('trust_id_no') + '</div>'
      ].join('');
      const citiesEl = document.getElementById('citiesVisited'); if (citiesEl) citiesEl.textContent = cities + (_t('trust_cities') || ' cities');
    }
    const fav = $('.fav-cats'); if (fav) fav.innerHTML = user.interests.length ? user.interests.map(i => '<div class="fav-cat-chip">' + esc(i) + '</div>').join('') : '<div style="color:var(--text-muted);font-size:.85rem">' + _t('profile_no_interests') + '</div>';
    ['spCitiesVal','spFriendsVal','spLikesVal','spGroupsVal'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0'; });
    const miniPts = $('.mini-wallet-pts'); if (miniPts) miniPts.textContent = compact(user.pointsBalance || 0) + ' pts';
    const miniSub = $('.mini-wallet-sub'); if (miniSub) miniSub.innerHTML = '<strong>' + compact(user.pointsBalance || 0) + ' pts</strong> earned · <a href="rewards.html" style="color:var(--green);text-decoration:none">Open store</a>';
    const review = $('#mostLikedReviewCard'); if (review) review.innerHTML = '<div class="sidebar-card-title">' + _t('trust_most_review') + '</div><div style="color:var(--text-muted);font-size:.85rem">' + _t('profile_no_reviews') + '</div>';
    const activity = $('.activity-feed .activity-feed-list'); if (activity) activity.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:12px 0">' + _t('profile_no_activity') + '</div>';
    const thumbs = $('.followers-thumbs'); if (thumbs) thumbs.innerHTML = '';
    const ftxt = $('.followers-preview-text'); if (ftxt) ftxt.textContent = _t('profile_no_followers');
    const highlights = $('.profile-highlights'); if (highlights) highlights.innerHTML = '<div class="highlight-item highlight-add" data-add-highlight><div class="highlight-ring add-ring"><i class="fas fa-plus"></i></div><div class="highlight-label">New</div></div>';
  }

  function updateFriendButtons(uid, status) {
    status = status || { state: 'none' };
    // Close any open friend dropdowns
    $$('.friend-dropdown-menu').forEach(function(m){ m.remove(); });
    $$('[data-friend-user="' + uid + '"]').forEach(function(btn) {
      // Remove previously injected siblings (decline button)
      var sib = btn.parentElement && btn.parentElement.querySelector('[data-decline-inline]');
      if (sib) sib.remove();
      btn.dataset.friendState = status.state || 'none';
      btn.dataset.requestId = status.requestId || '';
      if (status.state === 'friends') {
        btn.classList.add('following');
        btn.innerHTML = '<i class="fas fa-user-check"></i> Friends <i class="fas fa-chevron-down" style="font-size:.65em;margin-left:4px;opacity:.7"></i>';
        // ⭐ Close Friends badge — friends = close friends
        var nameEl = document.querySelector('.profile-name') || document.querySelector('.profile-display-name');
        if (nameEl && !document.getElementById('cf-badge-star')) {
          var badge = document.createElement('span');
          badge.id = 'cf-badge-star';
          badge.title = 'Close Friend';
          badge.style.cssText = 'display:inline-flex;align-items:center;gap:3px;background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.35);color:#fbbf24;border-radius:999px;font-size:.7rem;font-weight:700;padding:2px 8px;margin-left:8px;vertical-align:middle';
          badge.innerHTML = '⭐ Close Friend';
          nameEl.appendChild(badge);
        }
      } else if (status.state === 'incoming') {
        btn.classList.add('following');
        btn.innerHTML = '<i class="fas fa-check"></i> Accept';
        // Insert Decline button immediately after
        var declineBtn = document.createElement('button');
        declineBtn.className = btn.className.replace('btn-primary','btn-ghost');
        declineBtn.setAttribute('data-decline-inline', uid);
        declineBtn.dataset.requestId = status.requestId || '';
        declineBtn.innerHTML = '<i class="fas fa-times"></i> Decline';
        btn.insertAdjacentElement('afterend', declineBtn);
      } else if (status.state === 'outgoing') {
        btn.classList.remove('following');
        btn.innerHTML = '<i class="fas fa-clock"></i> Cancel Request';
      } else {
        btn.classList.remove('following');
        btn.innerHTML = '<i class="fas fa-user-plus"></i> '+(typeof GHt==='function'?GHt('profile_add_friend'):'Add Friend');
      }
    });
  }

  function emptyTab(id, icon, title, text, href, cta) {
    const el = $(id); if (!el) return;
    el.innerHTML = '<div class="empty-profile-state"><i class="fas ' + icon + '"></i><h3>' + title + '</h3><p>' + text + '</p>' + (href ? '<a href="' + href + '" class="btn btn-primary btn-sm" style="margin-top:12px">' + cta + '</a>' : '') + '</div>';
  }

  /* Phase 28: Story Highlights */
  function loadHighlights(user, fbUser) {
    var row = document.querySelector('.profile-highlights');
    if (!row) return;
    var GF = window.GeoFirebase;
    var isOwn = fbUser && user.uid === fbUser.uid;
    var addBtn = '<div class="highlight-item highlight-add" data-add-highlight><div class="highlight-ring add-ring"><i class="fas fa-plus"></i></div><div class="highlight-label">New</div></div>';
    if (!GF || !GF.db || !GF.fs) { row.innerHTML = isOwn ? addBtn : ''; return; }
    GF.fs.getDocs(
      GF.fs.query(GF.fs.collection(GF.db, 'users', user.uid, 'highlights'), GF.fs.orderBy('createdAt', 'desc'), GF.fs.limit(10))
    ).then(function(snap) {
      var html = isOwn ? addBtn : '';
      if (snap.empty && !isOwn) { row.innerHTML = ''; return; }
      snap.forEach(function(d) {
        var h = Object.assign({ id: d.id }, d.data());
        var coverStyle = h.coverUrl ? 'background-image:url("' + esc(h.coverUrl) + '");background-size:cover;background-position:center' : 'background:linear-gradient(135deg,#10b981,#3b82f6)';
        html += '<div class="highlight-item" data-open-highlight="' + esc(d.id) + '" data-highlight-uid="' + esc(user.uid) + '">' +
          '<div class="highlight-ring" style="' + coverStyle + '"></div>' +
          '<div class="highlight-label">' + esc(h.title || 'Highlight') + '</div>' +
          (isOwn ? '<button class="hl-del-btn" data-del-highlight="' + esc(d.id) + '" data-hl-uid="' + esc(user.uid) + '" title="Delete">×</button>' : '') +
        '</div>';
      });
      row.innerHTML = html;
      // Delete handler
      row.querySelectorAll('[data-del-highlight]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var hid = btn.dataset.delHighlight, huid = btn.dataset.hlUid;
          window.ghConfirm(typeof window.GHt === 'function' ? window.GHt('highlight_delete_cfm') : 'Delete this highlight?', function() {
            GF.fs.deleteDoc(GF.fs.doc(GF.db, 'users', huid, 'highlights', hid)).then(function() {
              loadHighlights(user, fbUser);
            }).catch(function() {});
          });
        });
      });
      // Open handler
      row.querySelectorAll('[data-open-highlight]').forEach(function(item) {
        item.addEventListener('click', function() {
          var hid = item.dataset.openHighlight, huid = item.dataset.highlightUid;
          GF.fs.getDoc(GF.fs.doc(GF.db, 'users', huid, 'highlights', hid)).then(function(s) {
            if (!s.exists()) return;
            var h = s.data();
            var stories = Array.isArray(h.stories) ? h.stories : [];
            if (!stories.length) return;
            _openHighlightViewer(h.title || 'Highlight', stories);
          }).catch(function() {});
        });
      });
    }).catch(function() { row.innerHTML = isOwn ? addBtn : ''; });
  }

  function _openHighlightViewer(title, storyUrls) {
    var idx = 0;
    var ov = document.createElement('div');
    ov.className = 'gh-hl-viewer';
    function render() {
      var url = storyUrls[idx];
      ov.innerHTML =
        '<div class="gh-hl-backdrop" data-hl-close></div>'+
        '<div class="gh-hl-card">'+
          '<div class="gh-hl-topbar">'+
            '<div class="gh-hl-dots">' + storyUrls.map(function(_, i){ return '<span class="gh-hl-dot' + (i===idx?' active':'') + '"></span>'; }).join('') + '</div>'+
            '<div class="gh-hl-title">' + esc(title) + '</div>'+
            '<button class="gh-hl-close" data-hl-close>×</button>'+
          '</div>'+
          (url.match(/\.(mp4|webm|mov)/i) ? '<video class="gh-hl-media" src="'+esc(url)+'" autoplay muted loop playsinline></video>' : '<img class="gh-hl-media" src="'+esc(url)+'" alt="">') +
          '<button class="gh-hl-prev"' + (idx===0?'disabled':'') + '><i class="fas fa-chevron-left"></i></button>'+
          '<button class="gh-hl-next"' + (idx===storyUrls.length-1?'disabled':'') + '><i class="fas fa-chevron-right"></i></button>'+
        '</div>';
      ov.querySelector('[data-hl-close]').onclick = function() { ov.remove(); };
      var prev = ov.querySelector('.gh-hl-prev');
      var next = ov.querySelector('.gh-hl-next');
      if (prev) prev.onclick = function() { if (idx > 0) { idx--; render(); } };
      if (next) next.onclick = function() { if (idx < storyUrls.length - 1) { idx++; render(); } };
    }
    render();
    document.body.appendChild(ov);
  }

  // Add highlight when "+" clicked: pick story from last 30 days
  window._createHighlight = function(uid, GF) {
    var title = prompt('Highlight-ის სახელი:');
    if (!title) return;
    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'stories'),
      GF.fs.where('userId', '==', uid),
      GF.fs.orderBy('createdAt', 'desc'),
      GF.fs.limit(20)
    )).then(function(snap) {
      var stories = [];
      snap.forEach(function(d) {
        var s = d.data();
        var url = s.mediaUrl || s.imageUrl || s.videoUrl || '';
        if (url) stories.push(url);
      });
      if (!stories.length) { toast('Stories ვერ მოიძებნა. ჯერ დაამატე story.', 'error'); return; }
      GF.fs.addDoc(GF.fs.collection(GF.db, 'users', uid, 'highlights'), {
        title: title, coverUrl: stories[0], stories: stories,
        createdAt: GF.fs.serverTimestamp()
      }).then(function() { location.reload(); }).catch(function(e) { toast((e && e.message) || 'Error', 'error'); });
    }).catch(function() { toast('Stories ვერ ჩაიტვირთა.', 'error'); });
  };

  function renderTabs(user, fbUser) {
    var _pt=typeof GHt==='function'?GHt:function(k){return k;};
    emptyTab('#tab-posts', 'fa-seedling', _pt('profile_posts')+': '+_pt('no_results'), _pt('profile_no_posts_hint'), 'feed.html?compose=1', _pt('create_post'));
    emptyTab('#tab-checkins', 'fa-location-dot', _pt('profile_checkins')+': '+_pt('no_results'), _pt('profile_no_checkins'), 'checkin.html', _pt('ci_title'));
    emptyTab('#tab-friends', 'fa-user-group', _pt('profile_friends')+': '+_pt('no_results'), _pt('profile_no_friends_hint'), null, '');
    loadHighlights(user, fbUser);
    renderAboutTab(user);
    renderBadgeTab(user);
    renderBusinessesTab(user);
    loadCheckinsTab(user);
    loadVideosTab(user);
    if (window.GeoSocial && window.GeoSocial.listenSavedPosts) {
      function updateSavedEmpty() {
        var ps = $('#saved-posts-section'), pl = $('#saved-places-section'), em = $('#saved-empty-state');
        if (!em) return;
        em.style.display = ((!ps || !ps.innerHTML.trim()) && (!pl || !pl.innerHTML.trim())) ? '' : 'none';
      }
      function updateSavedCount(total) {
        var cnt = $('.ptab[data-tab="saved"] .tab-count'); if (cnt) cnt.textContent = total || '';
      }
      window.GeoSocial.listenSavedPosts(user.uid, function (posts) {
        var sec = $('#saved-posts-section'); if (!sec) return;
        if (!posts.length) { sec.innerHTML = ''; updateSavedEmpty(); updateSavedCount(0); return; }
        sec.innerHTML = '<div style="font-size:.75rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px"><i class="fas fa-file-alt" style="margin-right:6px"></i>Saved Posts</div>'
          + '<div class="posts-grid">' + posts.map(function (post) {
            return '<div class="post-thumb">'
              + (post.mediaUrl ? '<img src="' + esc(post.mediaUrl) + '" alt="Post" loading="lazy" decoding="async" onerror="this.onerror=null;this.style.display=\'none\'">'
                : '<div style="background:var(--bg-elevated);width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:.9rem;padding:14px;box-sizing:border-box;text-align:center;color:var(--text-secondary)">' + esc((post.text || '').slice(0, 80)) + '</div>')
              + '<div class="post-overlay"><span><i class="fas fa-heart"></i> ' + (post.likeCount || 0) + '</span><span><i class="fas fa-comment"></i> ' + (post.commentCount || 0) + '</span></div>'
              + '</div>';
          }).join('') + '</div>';
        updateSavedEmpty(); updateSavedCount(posts.length);
      });
      window.GeoSocial.listenSavedPlaces(user.uid, function (places) {
        var sec = $('#saved-places-section'); if (!sec) return;
        if (!places.length) { sec.innerHTML = ''; updateSavedEmpty(); return; }
        sec.innerHTML = '<div style="font-size:.75rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.6px;margin:20px 0 12px"><i class="fas fa-map-marker-alt" style="margin-right:6px"></i>Saved Places</div>'
          + '<div style="display:flex;flex-direction:column;gap:10px">'
          + places.map(function (p) {
            var grad = 'linear-gradient(135deg,#10b981,#3b82f6)';
            var cover = p.photoUrl ? '<img src="' + esc(p.photoUrl) + '" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:10px">' : '<div style="width:100%;height:100%;background:' + grad + ';border-radius:10px;display:flex;align-items:center;justify-content:center"><i class="fas fa-map-marker-alt" style="color:#fff;font-size:1.1rem"></i></div>';
            return '<a href="places.html" style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;text-decoration:none;color:inherit;transition:border-color .15s">'
              + '<div style="width:52px;height:52px;border-radius:10px;overflow:hidden;flex-shrink:0">' + cover + '</div>'
              + '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.88rem;color:#f0f4ff;margin-bottom:3px">' + esc(p.name || 'Unknown Place') + '</div>'
              + '<div style="font-size:.74rem;color:#64748b">' + esc(p.category || '') + (p.address ? ' · ' + esc(p.address) : '') + '</div></div>'
              + '<i class="fas fa-bookmark" style="color:#10b981;font-size:.88rem;flex-shrink:0"></i></a>';
          }).join('') + '</div>';
        updateSavedEmpty();
      });
    }
    if (window.GeoSocial && window.GeoSocial.listenFriends) {
      const friendsTab = $('#tab-friends');
      const countEl = $('.ptab[data-tab="friends"] .tab-count');
      const ownProfile = window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser && window.GeoFirebase.auth.currentUser.uid === user.uid;
      function rebuildFriendsTab() {
        if (!friendsTab) return;
        const incomingHtml = friendsTab.dataset.incomingHtml || '';
        const sentHtml = friendsTab.dataset.sentHtml || '';
        const friendsListHtml = friendsTab.dataset.friendsListHtml || '';
        const isEmpty = !incomingHtml && !sentHtml && !friendsListHtml;
        if (isEmpty) {
          friendsTab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-user-group"></i><h3>' + _t('profile_no_friends') + '</h3><p>' + _t('profile_no_friends_hint') + '</p></div>';
        } else {
          friendsTab.innerHTML = incomingHtml + sentHtml + friendsListHtml;
        }
      }
      if (ownProfile && window.GeoSocial.listenFriendRequests) {
        window.GeoSocial.listenFriendRequests(function(requests) {
          const pending = requests.map(function(r) {
            const fromId = r.fromUserId || r.fromId || '';
            const avatarHtml = r.senderAvatar
              ? '<img src="' + esc(r.senderAvatar) + '" alt="" loading="lazy" decoding="async">'
              : esc(initialLetters(r.senderName || 'GeoHub User', ''));
            return '<a class="gh-friend-card" href="profile.html?id=' + encodeURIComponent(fromId) + '" style="text-decoration:none;color:inherit">'
              + '<span class="gh-avatar">' + avatarHtml + '</span>'
              + '<div style="flex:1;min-width:0">'
              + '<strong>' + esc(r.senderName || 'GeoHub User') + '</strong>'
              + '<span>@' + esc(r.senderUsername || fromId) + '</span>'
              + '<div class="gh-friend-request-actions" onclick="event.preventDefault()">'
              + '<button class="btn btn-primary btn-sm" data-accept-request="' + esc(r.id) + '" data-from-user-id="' + esc(fromId) + '">Accept</button>'
              + '<button class="btn btn-ghost btn-sm" data-reject-request="' + esc(r.id) + '">Decline</button>'
              + '</div></div></a>';
          }).join('');
          if (friendsTab) friendsTab.dataset.incomingHtml = pending ? '<div style="font-weight:800;margin:0 0 10px;color:var(--green)"><i class="fas fa-user-clock" style="margin-right:6px"></i>Friend Requests (' + requests.length + ')</div><div class="gh-friend-grid">' + pending + '</div><div style="height:18px"></div>' : '';
          rebuildFriendsTab();
        });
      }
      if (ownProfile && window.GeoSocial.listenSentFriendRequests) {
        window.GeoSocial.listenSentFriendRequests(function(sent) {
          const sentCards = sent.map(function(r) {
            const toId = r.toUserId || '';
            const avHtml = r.recipientAvatar
              ? '<img src="' + esc(r.recipientAvatar) + '" alt="" loading="lazy" decoding="async">'
              : esc(initialLetters(r.recipientName || 'GeoHub User', ''));
            return '<a class="gh-friend-card" href="profile.html?id=' + encodeURIComponent(toId) + '" style="text-decoration:none;color:inherit">'
              + '<span class="gh-avatar">' + avHtml + '</span>'
              + '<div style="flex:1;min-width:0">'
              + '<strong>' + esc(r.recipientName || 'GeoHub User') + '</strong>'
              + '<span>@' + esc(r.recipientUsername || toId) + '</span>'
              + '<div class="gh-friend-request-actions" onclick="event.preventDefault()">'
              + '<button class="btn btn-ghost btn-sm" data-cancel-sent-request="' + esc(r.id) + '" data-to-user-id="' + esc(toId) + '"><i class="fas fa-times"></i> Cancel</button>'
              + '</div></div></a>';
          }).join('');
          if (friendsTab) friendsTab.dataset.sentHtml = sentCards ? '<div style="font-weight:800;margin:0 0 10px"><i class="fas fa-paper-plane" style="margin-right:6px"></i>Sent Requests (' + sent.length + ')</div><div class="gh-friend-grid">' + sentCards + '</div><div style="height:18px"></div>' : '';
          rebuildFriendsTab();
        });
      }
      window.GeoSocial.listenFriends(user.uid, function(friends) {
        if (countEl) countEl.textContent = friends.length || '';
        const fl = friends.length ? '<div style="font-weight:800;margin:0 0 10px"><i class="fas fa-user-group" style="margin-right:6px"></i>Friends (' + friends.length + ')</div><div class="gh-friend-grid">' + friends.map(function(f) {
          var fuid = f.uid || f.id;
          return '<div class="gh-friend-card">'
            + '<a href="profile.html?id=' + encodeURIComponent(fuid) + '" style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;text-decoration:none;color:inherit;overflow:hidden">'
            + '<span class="gh-avatar">' + (f.avatar||f.photoURL ? '<img src="'+esc(f.avatar||f.photoURL)+'" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.style.display=\'none\'">' : esc(initialLetters(f.fullName||f.displayName||f.name||'GeoHub User',f.email||''))) + '</span>'
            + '<div style="flex:1;min-width:0"><strong>' + esc(f.fullName||f.displayName||f.name||'GeoHub User') + '</strong><span>@' + esc(f.username||'user') + '</span></div>'
            + '</a>'
            + (ownProfile ? '<button class="btn btn-ghost btn-sm" data-unfriend-user="' + esc(fuid) + '" title="Unfriend" style="flex-shrink:0;padding:5px 9px;font-size:.75rem"><i class="fas fa-user-minus"></i></button>' : '')
            + '</div>';
        }).join('') + '</div>' : '';
        if (friendsTab) friendsTab.dataset.friendsListHtml = fl;
        rebuildFriendsTab();
      });
    }

    if (window.GeoSocial && window.GeoSocial.listenUserPosts) {
      var _lastProfilePostsKey = '';
      var _profilePostsTimer = null;
      window.GeoSocial.listenUserPosts(user.uid, function(posts) {
        // Debounce: rapid Firestore updates collapse into one render
        if (_profilePostsTimer) clearTimeout(_profilePostsTimer);
        _profilePostsTimer = setTimeout(function() {
          _profilePostsTimer = null;
          var count = $('.ptab[data-tab="posts"] .tab-count'); if (count) count.textContent = posts.length || '0';
          renderGalleryTab(posts);
          if (!posts.length) {
            _lastProfilePostsKey = '';
            var _et=typeof window.GHt==='function'?window.GHt:function(k){return k;};
            emptyTab('#tab-posts', 'fa-seedling', _et('profile_no_posts'), _et('profile_no_posts_hint'), 'feed.html?compose=1', _et('create_post'));
            return;
          }
          var tab = $('#tab-posts');
          if (!tab) return;
          if (window.GeoSocialUI && window.GeoSocialUI.postCard && window.GeoSocialUI.bindPostInteractions) {
            // Phase 35: sort pinned post to top
            var _pinnedId = user.pinnedPostId || '';
            var _sorted = _pinnedId ? posts.slice().sort(function(a,b){ return (b.id===_pinnedId?1:0)-(a.id===_pinnedId?1:0); }) : posts;
            // Same-order skip: only patch counts if IDs unchanged
            var newKey = _sorted.map(function(p){ return p.id; }).join(',');
            if (newKey && newKey === _lastProfilePostsKey && tab.querySelector('#profile-posts-list')) {
              _sorted.forEach(function(p){
                var card = document.getElementById('post-'+p.id); if (!card) return;
                var lc = card.querySelector('[data-like-count]'); if (lc) lc.textContent = String(Number(p.likeCount||p.reactionCount||0));
                var cc = card.querySelector('[data-comment-count]'); if (cc) cc.textContent = String(Number(p.commentCount||0));
                var sc = card.querySelector('[data-share-count]'); if (sc) sc.textContent = String(Number(p.shareCount||0));
              });
              return; // skip full re-render — prevents scroll jump
            }
            _lastProfilePostsKey = newKey;
            var _pinLabel = (_pinnedId && _sorted.length && _sorted[0].id===_pinnedId)
              ? '<div class="gh-pin-label"><i class="fas fa-thumbtack"></i> Pinned Post</div>' : '';
            tab.innerHTML = '<div class="post-feed-list" id="profile-posts-list">' + _pinLabel + _sorted.map(function(p) { return window.GeoSocialUI.postCard(p); }).join('') + '</div>';
            var list = tab.querySelector('#profile-posts-list');
            if (list) {
              window.GeoSocialUI.bindPostInteractions(list);
              posts.forEach(function(p) {
                try { if (window.GeoSocialUI.hydrateReactionState) window.GeoSocialUI.hydrateReactionState(p.id); } catch(e) {}
                try { if (window.GeoSocialUI.loadReactionBreakdown) window.GeoSocialUI.loadReactionBreakdown(p.id); } catch(e) {}
              });
            }
          } else {
            // Fallback: social engine unavailable
            tab.innerHTML = '<div class="post-feed-list" style="padding:32px;text-align:center;color:var(--gh-muted)"><i class="fas fa-rotate-right" style="font-size:1.5rem"></i><p style="margin-top:8px">Refresh the page to load posts.</p></div>';
          }
        }, 80);
      });
    }
  }


  function renderRewardsTab(user, fbUser) {
    const tab = $('#tab-rewards');
    if (!tab) return;
    const GF = window.GeoFirebase;
    const GS = window.GeoSocial;
    const own = fbUser && user.uid === fbUser.uid;
    const viewingUid = user.uid;

    function buildHeader(balPts) {
      return '<div class="rw-profile-bal">' +
        '<div>' +
          '<div class="rw-profile-bal-label"><i class="fas fa-coins" style="margin-right:5px;color:#10b981"></i>GeoPoints Balance</div>' +
          '<div class="rw-profile-bal-pts" id="profRwBal">' + esc(compact(balPts)) + ' pts</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          (own
            ? '<button class="btn btn-ghost btn-sm" onclick="window.location.href=\'rewards.html\'"><i class="fas fa-coins"></i> Rewards Store</button>'
            : '<button class="btn btn-primary btn-sm" id="profSendPtsBtn"><i class="fas fa-paper-plane"></i> Send Points</button>') +
        '</div>' +
      '</div>';
    }

    // Show initial balance from public user doc, then update from wallet if own
    tab.innerHTML = buildHeader(user.pointsBalance || 0) +
      '<div id="profTxList" style="margin-top:4px"><div style="color:var(--text-muted);font-size:.82rem;padding:12px 0;text-align:center"><i class="fas fa-spinner fa-spin"></i> Loading history…</div></div>';

    if (!own) {
      const sendBtn = document.getElementById('profSendPtsBtn');
      if (sendBtn) sendBtn.onclick = function () { window.location.href = 'rewards.html?to=' + encodeURIComponent(viewingUid); };
      const txList = document.getElementById('profTxList');
      if (txList) txList.innerHTML = '<div style="color:var(--text-muted);font-size:.82rem;padding:12px 0">Transaction history is private.</div>';
      return;
    }

    if (!GF || !GF.db || !GF.fs || !fbUser) return;
    const uid = fbUser.uid;

    // Update balance from wallet (authoritative source)
    if (GS && GS.listenWallet) {
      var _walletUnsub = GS.listenWallet(uid, function (w) {
        var balEl = document.getElementById('profRwBal');
        if (balEl) balEl.textContent = compact(w.balance || 0) + ' pts';
        if (_walletUnsub) { _walletUnsub(); _walletUnsub = null; } // one-shot
      });
    } else {
      GF.fs.getDoc(GF.fs.doc(GF.db, 'users', uid, 'private', 'wallet')).then(function (snap) {
        if (!snap.exists()) return;
        var w = snap.data() || {};
        var bal = Math.max(0, Number(w.credits || 0) - Math.max(0, Number(w.reservedDebits || 0)));
        var balEl = document.getElementById('profRwBal');
        if (balEl) balEl.textContent = compact(bal) + ' pts';
      }).catch(function () {});
    }

    // Load history: point gifts (sent + received) + reward coupons
    var toMs = function (v) {
      if (!v) return 0;
      if (typeof v.toMillis === 'function') return v.toMillis();
      if (v.seconds) return v.seconds * 1000;
      return typeof v === 'number' ? v : (Date.parse(v) || 0);
    };

    Promise.all([
      GF.fs.getDocs(GF.fs.query(GF.fs.collection(GF.db, 'pointGifts'), GF.fs.where('fromUserId', '==', uid), GF.fs.limit(20))).catch(() => ({ forEach: () => {} })),
      GF.fs.getDocs(GF.fs.query(GF.fs.collection(GF.db, 'pointGifts'), GF.fs.where('toUserId',   '==', uid), GF.fs.limit(20))).catch(() => ({ forEach: () => {} })),
      GF.fs.getDocs(GF.fs.query(GF.fs.collection(GF.db, 'rewardCoupons'), GF.fs.where('userId', '==', uid), GF.fs.limit(20))).catch(() => ({ forEach: () => {} }))
    ]).then(([sentSnap, recvSnap, couponSnap]) => {
      const items = [];

      sentSnap.forEach(d => {
        const data = d.data();
        items.push({ ms: toMs(data.createdAt), type: 'gift_sent', amount: Number(data.amount || 0), toName: data.toName || '', msg: data.message || '', status: data.status || '' });
      });
      recvSnap.forEach(d => {
        const data = d.data();
        items.push({ ms: toMs(data.createdAt), type: 'gift_recv', amount: Number(data.amount || 0), fromName: data.fromName || '', msg: data.message || '', status: data.status || '' });
      });
      couponSnap.forEach(d => {
        const data = d.data();
        items.push({ ms: toMs(data.createdAt), type: 'coupon', amount: Number(data.pointPrice || data.cost || 0), title: data.rewardTitle || 'Reward', code: data.code || '', status: data.status || '' });
      });

      items.sort((a, b) => b.ms - a.ms);

      const txList = document.getElementById('profTxList');
      if (!txList) return;

      if (!items.length) {
        txList.innerHTML = '<div class="empty-profile-state"><i class="fas fa-coins"></i><h3>No activity yet</h3><p>Earn GeoPoints through check-ins, challenges, and community activity. Redeem them in the <a href="rewards.html" style="color:var(--green)">Rewards Store</a>.</p></div>';
        return;
      }

      const rows = items.map(item => {
        if (item.type === 'gift_sent') {
          const label = 'Sent to ' + esc(item.toName || 'user') + (item.msg ? ' · ' + esc(item.msg.slice(0, 40)) : '') + (item.status === 'pending' ? ' <span style="font-size:.65rem;color:#f59e0b">(pending)</span>' : '');
          return '<div class="rw-history-item">' +
            '<div class="rw-history-icon sent"><i class="fas fa-paper-plane"></i></div>' +
            '<div class="rw-history-info"><div class="rw-history-title">' + label + '</div><div class="rw-history-meta">Points transfer</div></div>' +
            '<div class="rw-history-amount neg">−' + compact(item.amount) + '</div></div>';
        }
        if (item.type === 'gift_recv') {
          const label = 'Received from ' + esc(item.fromName || 'user') + (item.msg ? ' · ' + esc(item.msg.slice(0, 40)) : '') + (item.status === 'pending' ? ' <span style="font-size:.65rem;color:#f59e0b">(unclaimed)</span>' : '');
          return '<div class="rw-history-item">' +
            '<div class="rw-history-icon gift"><i class="fas fa-gift"></i></div>' +
            '<div class="rw-history-info"><div class="rw-history-title">' + label + '</div><div class="rw-history-meta">Points gift</div></div>' +
            '<div class="rw-history-amount pos">+' + compact(item.amount) + '</div></div>';
        }
        if (item.type === 'coupon') {
          return '<div class="rw-history-item">' +
            '<div class="rw-history-icon redeem"><i class="fas fa-ticket-alt"></i></div>' +
            '<div class="rw-history-info"><div class="rw-history-title">Redeemed: ' + esc(item.title) + (item.code ? ' · <code style="font-size:.72rem">' + esc(item.code) + '</code>' : '') + '</div><div class="rw-history-meta">Reward redemption</div></div>' +
            '<div class="rw-history-amount neg">−' + compact(item.amount) + '</div></div>';
        }
        return '';
      }).filter(Boolean);

      txList.innerHTML = rows.length
        ? '<div class="rw-history-list">' + rows.join('') + '</div>'
        : '<div style="color:var(--text-muted);font-size:.82rem;padding:12px 0">No transaction history yet.</div>';
    }).catch(err => {
      console.warn('[Profile] rewards tab', err.message);
    });
  }

  /* Phase 27: Profile View Tracking */
  function _trackProfileView(GF, profileUid, viewerUid, isOwn) {
    if (!GF || !GF.db || !GF.fs || !profileUid) return;
    if (isOwn) {
      // On own profile: show view count for last 7 days
      var weekAgo = new Date(Date.now() - 7 * 86400000);
      GF.fs.getDocs(
        GF.fs.query(
          GF.fs.collection(GF.db, 'users', profileUid, 'profileViews'),
          GF.fs.where('viewedAt', '>=', weekAgo)
        )
      ).then(function(snap) {
        var count = snap.size;
        if (!count) return;
        // Insert view counter near trust-badges
        var existing = document.getElementById('profileViewCount');
        if (existing) { existing.textContent = count + ' ადამიანმა ნახა ამ კვირაში'; return; }
        var el = document.createElement('div');
        el.id = 'profileViewCount';
        el.className = 'profile-view-count';
        el.innerHTML = '<i class="fas fa-eye"></i> <b>' + count + '</b> ადამიანმა ნახა ამ კვირაში';
        var trustBadges = document.querySelector('.trust-badges');
        if (trustBadges) trustBadges.parentNode.insertBefore(el, trustBadges);
      }).catch(function() {});
      return;
    }
    // Viewer: record the view (throttle: once per session per profile)
    var key = 'gh_pv_' + profileUid;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch(e) {}
    if (!viewerUid) return; // don't record anonymous views
    var viewRef = GF.fs.doc(GF.db, 'users', profileUid, 'profileViews', viewerUid);
    GF.fs.setDoc(viewRef, { viewedAt: GF.fs.serverTimestamp(), viewerUid: viewerUid }, { merge: true }).catch(function() {});
  }

  /* Phase 22: Achievement badge strip in profile header */
  var BADGE_RARITY_COLOR = { common: '#94a3b8', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' };

  function _renderAchievementStrip(uid) {
    if (!uid) return;
    // Remove old strip if re-rendering
    var old = document.getElementById('profileAchievementStrip');
    if (old) old.remove();
    var GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) return;
    GF.fs.getDocs(GF.fs.collection(GF.db, 'users', uid, 'badges')).then(function(snap) {
      if (snap.empty) return;
      var earned = [];
      snap.forEach(function(d) { earned.push(Object.assign({ id: d.id }, d.data())); });
      // Sort: legendary first
      var order = { legendary: 0, epic: 1, rare: 2, common: 3 };
      earned.sort(function(a, b) { return (order[a.rarity] || 3) - (order[b.rarity] || 3); });
      var strip = document.createElement('div');
      strip.id = 'profileAchievementStrip';
      strip.className = 'profile-achievement-strip';
      strip.innerHTML = earned.slice(0, 8).map(function(b) {
        var rc = BADGE_RARITY_COLOR[b.rarity] || '#94a3b8';
        var emoji = b.emoji || '🏅';
        return '<span class="pach-badge" title="' + esc(b.title || b.badgeId || 'Badge') + '" style="border-color:' + rc + '">' +
          emoji +
        '</span>';
      }).join('');
      if (earned.length > 8) {
        strip.innerHTML += '<span class="pach-more">+' + (earned.length - 8) + '</span>';
      }
      var trustBadges = document.querySelector('.trust-badges');
      if (trustBadges && trustBadges.parentNode) {
        trustBadges.parentNode.insertBefore(strip, trustBadges.nextSibling);
      }
    }).catch(function() {});
  }

  function paintBadges(tab, badges) {
    const cnt = $('.ptab[data-tab="badges"] .tab-count');
    if (cnt) cnt.textContent = badges.length || '0';
    if (!badges.length) {
      tab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-medal"></i><h3>No badges yet</h3><p>Complete challenges to earn badges.</p></div>';
      return;
    }
    tab.innerHTML = '<div class="gh-friend-grid">' + badges.map(function (b) {
      const rc = BADGE_RARITY_COLOR[b.rarity] || '#94a3b8';
      return '<div class="gh-friend-card">' +
        '<span class="gh-avatar" style="background:rgba(16,185,129,.1);color:' + rc + '">' +
          '<i class="fas ' + esc(b.icon || 'fa-medal') + '"></i>' +
        '</span>' +
        '<div>' +
          '<strong>' + esc(b.title || b.badgeId || 'Badge') + '</strong>' +
          '<span>' + esc(b.description || 'GeoHub achievement') + '</span>' +
          (b.rarity ? '<span style="font-size:.65rem;color:' + rc + ';font-weight:700;text-transform:uppercase;margin-top:2px;display:block">' + esc(b.rarity) + '</span>' : '') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderBadgeTab(user) {
    const tab = $('#tab-badges');
    if (!tab) return;
    const GF = window.GeoFirebase;
    if (GF && GF.db && GF.fs) {
      // Primary: read from users/{uid}/badges (written by challenge-engine.js)
      GF.fs.onSnapshot(
        GF.fs.collection(GF.db, 'users', user.uid, 'badges'),
        function (snap) {
          const badges = [];
          snap.forEach(function (d) { badges.push(Object.assign({ id: d.id }, d.data())); });
          paintBadges(tab, badges);
        },
        function () {
          // Fallback: read from userBadges (written by firestore-social.js)
          if (window.GeoSocial && window.GeoSocial.listenUserBadges) {
            window.GeoSocial.listenUserBadges(user.uid, function (badges) { paintBadges(tab, badges); });
          }
        }
      );
    } else if (window.GeoSocial && window.GeoSocial.listenUserBadges) {
      window.GeoSocial.listenUserBadges(user.uid, function (badges) { paintBadges(tab, badges); });
    }
  }

  function renderBusinessesTab(user){
    const tab = $('#tab-businesses'); if(!tab) return;
    if (window.GeoSocial && window.GeoSocial.listenManagedBusinesses) {
      window.GeoSocial.listenManagedBusinesses(user.uid, businesses => {
        const cnt = $('.ptab[data-tab="businesses"] .tab-count'); if(cnt) cnt.textContent = businesses.length || '0';
        if(!businesses.length){ tab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-store"></i><h3>No business pages yet</h3><p>Business pages you manage will appear here.</p><a class="btn btn-primary btn-sm" href="add-business.html">Add Business</a></div>'; return; }
        tab.innerHTML = '<div class="gh-friend-grid">'+businesses.map(b => '<a class="gh-friend-card" href="business.html?id='+encodeURIComponent(b.id)+'"><span class="gh-avatar">'+(b.logoUrl||b.coverImageUrl?'<img src="'+esc(b.logoUrl||b.coverImageUrl)+'" alt="" loading="lazy" decoding="async">':esc(initialLetters(b.name||'Business')) )+'</span><div><strong>'+esc(b.name||'Business')+'</strong><span>'+esc(b.businessType==='online'?'Online / Nationwide':(b.city||b.category||'Business'))+'</span></div></a>').join('')+'</div>';
      });
    }
  }

  function loadCheckinsTab(user) {
    var tab = $('#tab-checkins');
    if (!tab) return;
    var GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) return;
    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'checkins'),
      GF.fs.where('userId', '==', user.uid),
      GF.fs.limit(30)
    )).then(function(snap) {
      var cnt = $('.ptab[data-tab="checkins"] .tab-count');
      if (snap.empty) { if (cnt) cnt.textContent = '0'; return; }
      if (cnt) cnt.textContent = snap.size;
      var items = [];
      snap.forEach(function(d) { items.push(Object.assign({ id: d.id }, d.data())); });
      function _ciTs(v) { if (!v) return 0; if (typeof v === 'object' && typeof v.toMillis === 'function') return v.toMillis(); if (typeof v === 'object' && v.seconds) return v.seconds * 1000; return Number(v) || 0; }
      items.sort(function(a, b) { return _ciTs(b.createdAt) - _ciTs(a.createdAt); });
      tab.innerHTML = '<div class="gh-friend-grid">' + items.map(function(c) {
        var placeHref = c.placeId ? 'places.html?id=' + encodeURIComponent(c.placeId) : '';
        var placeLink = placeHref ? '<a href="' + esc(placeHref) + '" style="color:#10b981;text-decoration:none">' + esc(c.city || c.location || c.placeName || '') + '</a>' : esc(c.city || c.location || '');
        var av = c.photoUrl
          ? '<img src="' + esc(c.photoUrl) + '" alt="" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0" onerror="this.onerror=null;this.style.background=\'rgba(16,185,129,.1)\';this.outerHTML=\'<span class=&quot;gh-avatar&quot; style=&quot;background:rgba(16,185,129,.1)&quot;><i class=&quot;fas fa-map-marker-alt&quot; style=&quot;color:#10b981&quot;></i></span>\'">'
          : '<span class="gh-avatar" style="background:rgba(16,185,129,.1)"><i class="fas fa-map-marker-alt" style="color:#10b981"></i></span>';
        return '<div class="gh-friend-card">'
          + av
          + '<div style="min-width:0">'
            + (placeHref
                ? '<strong><a href="' + esc(placeHref) + '" style="color:inherit;text-decoration:none">' + esc(c.placeName || c.name || 'Check-in') + '</a></strong>'
                : '<strong>' + esc(c.placeName || c.name || 'Check-in') + '</strong>')
            + '<span>' + placeLink + '</span>'
            + (c.caption ? '<span style="font-size:.74rem;color:#94a3b8;display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.caption) + '</span>' : '')
            + (c.createdAt ? '<span style="font-size:.7rem;color:#64748b;display:block;margin-top:2px">' + timeAgo(c.createdAt) + '</span>' : '')
          + '</div>'
        + '</div>';
      }).join('') + '</div>';
    }).catch(function() { /* keep empty state */ });
  }

  function postCardHtml(post, user) {
    var ts = timeAgo(post.createdAt || post.timestamp);
    var text = esc(post.text || post.content || '');
    var media = post.mediaUrl ? '<div class="pfc-media"><img src="' + esc(post.mediaUrl) + '" alt="Post" loading="lazy" decoding="async"></div>' : '';
    return '<div class="post-feed-card">'
      + '<div class="pfc-header"><img class="pfc-avatar" src="' + esc(user.avatar || '') + '" alt="" loading="lazy" decoding="async"><div><div class="pfc-name">' + esc(user.fullName) + '</div><div class="pfc-time">' + (ts || '') + '</div></div></div>'
      + (text ? '<div class="pfc-text">' + text + '</div>' : '')
      + media
      + '<div class="pfc-footer"><span class="pfc-stat"><i class="fas fa-heart"></i> ' + (post.likeCount || 0) + '</span><span class="pfc-stat"><i class="fas fa-comment"></i> ' + (post.commentCount || 0) + '</span></div>'
      + '</div>';
  }

  function loadVideosTab(user) {
    var tab = $('#tab-videos');
    if (!tab) return;
    var GF = window.GeoFirebase;
    if (!GF || !GF.fs || !GF.db) return;
    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'videos'),
      GF.fs.where('authorId', '==', user.uid),
      GF.fs.where('status', '==', 'active'),
      GF.fs.orderBy('createdAt', 'desc'),
      GF.fs.limit(24)
    )).then(function (snap) {
      var cnt = $('.ptab[data-tab="videos"] .tab-count');
      if (snap.empty) { if (cnt) cnt.textContent = ''; return; }
      if (cnt) cnt.textContent = snap.size || '';

      var totalViews = 0, totalLikes = 0, topReel = null, topReelScore = 0;
      snap.forEach(function (d) {
        var v = d.data();
        totalViews += Number(v.viewCount || 0);
        totalLikes += Number(v.likeCount || 0);
        var score = (v.likeCount || 0) * 3 + (v.viewCount || 0) * 0.2;
        if (v.isShort && score > topReelScore) { topReelScore = score; topReel = Object.assign({ id: d.id }, v); }
      });

      var statsRow = '<div class="vid-tab-stats">' +
        '<div class="vid-tab-stat"><div class="vid-tab-stat-val">' + compact(totalViews) + '</div><div class="vid-tab-stat-lbl">Views</div></div>' +
        '<div class="vid-tab-stat"><div class="vid-tab-stat-val">' + compact(totalLikes) + '</div><div class="vid-tab-stat-lbl">Likes</div></div>' +
        '<div class="vid-tab-stat"><div class="vid-tab-stat-val">' + (snap.size || 0) + '</div><div class="vid-tab-stat-lbl">Videos</div></div>' +
        (topReel ? '<div class="vid-tab-stat"><a href="watch.html?v=' + esc(topReel.id) + '" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;align-items:center;gap:1px"><div class="vid-tab-stat-val" style="color:#a855f7"><i class="fas fa-bolt" style="font-size:.8rem"></i></div><div class="vid-tab-stat-lbl">Top Reel</div></a></div>' : '') +
      '</div>';

      var cards = '';
      snap.forEach(function (d) {
        var v = Object.assign({ id: d.id }, d.data());
        var tid = v.youtubeId || '';
        var thumb = v.thumbnail || ('https://i.ytimg.com/vi/' + tid + '/hqdefault.jpg');
        cards += '<a href="watch.html?v=' + esc(v.id) + '" class="pv-card">' +
          '<div class="pv-thumb">' +
            '<img src="' + esc(thumb) + '" alt="" loading="lazy">' +
            '<div class="pv-play"><i class="fas fa-play"></i></div>' +
            (v.isShort ? '<span class="pv-badge">Short</span>' : '') +
          '</div>' +
          '<div class="pv-info">' +
            '<div class="pv-title">' + esc(v.title || 'Video') + '</div>' +
            '<div class="pv-meta"><i class="fas fa-eye"></i>' + compact(v.viewCount) + ' · <i class="fas fa-heart"></i>' + compact(v.likeCount) + '</div>' +
          '</div>' +
        '</a>';
      });
      tab.innerHTML = statsRow + '<div class="pv-grid">' + cards + '</div>';
    }).catch(function () {});
  }

  function renderGalleryTab(posts) {
    var tab = $('#tab-gallery'); if (!tab) return;
    var media = (posts || []).filter(function(p) { return !!p.mediaUrl; });
    var cnt = $('.ptab[data-tab="gallery"] .tab-count'); if (cnt) cnt.textContent = media.length || '';
    if (!media.length) { tab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-images"></i><h3>No photos yet</h3><p>Posts with photos will appear in the gallery.</p></div>'; return; }
    tab.innerHTML = '<div class="gallery-grid">' + media.map(function(p) {
      return '<div class="gallery-item"><img src="' + esc(p.mediaUrl) + '" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.closest(\'.gallery-item\').style.display=\'none\'"><div class="gallery-overlay"><span><i class="fas fa-heart"></i> ' + (p.likeCount || 0) + '</span></div></div>';
    }).join('') + '</div>';
  }

  function renderAboutTab(user) {
    var _t = function(k){ return typeof window.GHt === 'function' ? window.GHt(k) : k; };
    var tab = $('#tab-about'); if (!tab) return;
    var sl = user.socialLinks || {};
    var ICONS = { instagram:'fa-instagram', facebook:'fa-facebook', linkedin:'fa-linkedin', tiktok:'fa-tiktok', twitter:'fa-twitter', youtube:'fa-youtube' };
    var GF = window.GeoFirebase;
    var fbUser = GF && GF.auth && GF.auth.currentUser;
    var isOwn = fbUser && user.uid === fbUser.uid;

    var html = '<div class="about-card">';
    if (user.bio) html += '<div class="about-bio">' + esc(user.bio) + '</div>';
    html += '<div class="about-section-title">' + _t('about_location') + '</div>';
    html += '<div class="about-item"><i class="fas fa-map-marker-alt"></i> ' + (user.cityScope === 'all_georgia' ? _t('profile_all_georgia') : esc(user.city || _t('profile_no_location'))) + '</div>';
    if (user.hometown) html += '<div class="about-item"><i class="fas fa-home"></i> ' + _t('about_from') + esc(user.hometown) + '</div>';
    if (user.currentCity) html += '<div class="about-item"><i class="fas fa-city"></i> ' + _t('about_lives_in') + esc(user.currentCity) + '</div>';
    if (user.relationshipStatus) html += '<div class="about-item"><i class="fas fa-heart"></i> ' + esc(user.relationshipStatus) + '</div>';
    if (user.birthday) html += '<div class="about-item"><i class="fas fa-birthday-cake"></i> ' + _t('about_birthday') + esc(user.birthday) + '</div>';
    if (user.website) html += '<div class="about-item"><i class="fas fa-globe"></i> <a href="' + esc(user.website) + '" target="_blank" rel="noopener noreferrer">' + esc(user.website) + '</a></div>';
    var joinYear = '';
    if (user.createdAt) {
      try {
        if (typeof user.createdAt.toDate === 'function') joinYear = user.createdAt.toDate().getFullYear();
        else if (user.createdAt.seconds) joinYear = new Date(user.createdAt.seconds * 1000).getFullYear();
        else if (typeof user.createdAt === 'number') joinYear = new Date(user.createdAt).getFullYear();
      } catch(e) {}
    }
    if (joinYear) html += '<div class="about-item"><i class="fas fa-calendar-alt"></i> ' + _t('profile_member_since') + joinYear + '</div>';

    // ── Work History ──
    html += '<div class="about-section-title">' + _t('about_work') + (isOwn ? '<button class="about-add-btn" data-work-add>+ Add</button>' : '') + '</div>';
    var work = Array.isArray(user.work) ? user.work : [];
    if (work.length) {
      work.forEach(function(w, idx) {
        html += '<div class="about-item about-work-item" data-work-idx="' + idx + '">'
          + '<i class="fas fa-briefcase" style="color:#10b981"></i> '
          + '<div style="flex:1"><strong>' + esc(w.position || 'Employee') + '</strong> at <strong>' + esc(w.company || '') + '</strong>'
          + (w.from ? '<div style="font-size:.75rem;color:var(--gh-muted,#64748b);margin-top:2px">' + esc(w.from) + ' – ' + (w.current ? _t('about_work_present') : esc(w.to || '')) + '</div>' : '')
          + '</div>'
          + (isOwn ? '<button class="about-edit-btn" data-work-edit="' + idx + '" title="Edit"><i class="fas fa-pen"></i></button>' : '')
          + '</div>';
      });
    } else {
      html += '<div class="about-item" style="color:var(--gh-muted,#64748b)"><i class="fas fa-briefcase"></i> ' + (isOwn ? _t('about_work_add') : _t('about_work_none')) + '</div>';
    }

    // ── Education ──
    html += '<div class="about-section-title">' + _t('about_edu') + (isOwn ? '<button class="about-add-btn" data-edu-add>+ Add</button>' : '') + '</div>';
    var edu = Array.isArray(user.education) ? user.education : [];
    if (edu.length) {
      edu.forEach(function(e, idx) {
        html += '<div class="about-item about-edu-item" data-edu-idx="' + idx + '">'
          + '<i class="fas fa-graduation-cap" style="color:#3b82f6"></i> '
          + '<div style="flex:1"><strong>' + esc(e.school || '') + '</strong>'
          + (e.degree ? ' · ' + esc(e.degree) : '')
          + (e.from ? '<div style="font-size:.75rem;color:var(--gh-muted,#64748b);margin-top:2px">' + esc(e.from) + ' – ' + esc(e.to || _t('about_work_present')) + '</div>' : '')
          + '</div>'
          + (isOwn ? '<button class="about-edit-btn" data-edu-edit="' + idx + '" title="Edit"><i class="fas fa-pen"></i></button>' : '')
          + '</div>';
      });
    } else {
      html += '<div class="about-item" style="color:var(--gh-muted,#64748b)"><i class="fas fa-graduation-cap"></i> ' + (isOwn ? _t('about_edu_add') : _t('about_edu_none')) + '</div>';
    }

    // ── Languages ──
    if (Array.isArray(user.languages) && user.languages.length) {
      html += '<div class="about-section-title">' + _t('about_languages') + '</div>';
      html += '<div class="about-interests">' + user.languages.map(function(l) { return '<span class="about-interest-chip">' + esc(l) + '</span>'; }).join('') + '</div>';
    }

    if (user.interests && user.interests.length) {
      html += '<div class="about-section-title">' + _t('about_interests') + '</div>';
      html += '<div class="about-interests">' + user.interests.map(function(i) { return '<span class="about-interest-chip">' + esc(i) + '</span>'; }).join('') + '</div>';
    }
    var links = Object.entries(sl).filter(function(e) { return !!e[1]; });
    if (links.length) {
      html += '<div class="about-section-title">' + _t('about_social_links') + '</div>';
      html += '<div class="about-links">' + links.map(function(pair) {
        var platform = pair[0], val = String(pair[1] || '');
        var handle = val.replace(/^@/, '');
        var href = '';
        if (platform === 'instagram') href = 'https://instagram.com/' + encodeURIComponent(handle);
        else if (platform === 'tiktok') href = 'https://tiktok.com/@' + encodeURIComponent(handle);
        else if (platform === 'facebook') href = safeUrl(val) || ('https://facebook.com/' + encodeURIComponent(handle));
        else if (platform === 'linkedin') href = safeUrl(val) || ('https://linkedin.com/in/' + encodeURIComponent(handle));
        else if (platform === 'twitter') href = 'https://twitter.com/' + encodeURIComponent(handle);
        else if (platform === 'youtube') href = safeUrl(val) || ('https://youtube.com/@' + encodeURIComponent(handle));
        else href = safeUrl(val) || '';
        if (!href) return '<span class="about-link-chip"><i class="fab ' + (ICONS[platform] || 'fa-link') + '"></i> ' + esc(val) + '</span>';
        return '<a class="about-link-chip" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer"><i class="fab ' + (ICONS[platform] || 'fa-link') + '"></i> ' + esc(handle || val) + '</a>';
      }).join('') + '</div>';
    }
    html += '</div>';

    // ── Life Events Timeline ──
    html += '<div id="about-life-events" style="margin-top:8px"></div>';

    tab.innerHTML = html;

    // Load life events
    if (GF && GF.db && GF.fs) {
      renderLifeEventsTimeline(user, isOwn);
    }

    // Work / Education event delegation
    tab.addEventListener('click', function(ev) {
      if (ev.target.closest('[data-work-add]')) { ev.preventDefault(); openWorkModal(user, -1); }
      var we = ev.target.closest('[data-work-edit]');
      if (we) { ev.preventDefault(); openWorkModal(user, parseInt(we.dataset.workEdit)); }
      if (ev.target.closest('[data-edu-add]')) { ev.preventDefault(); openEduModal(user, -1); }
      var ee = ev.target.closest('[data-edu-edit]');
      if (ee) { ev.preventDefault(); openEduModal(user, parseInt(ee.dataset.eduEdit)); }
      if (ev.target.closest('[data-life-event-add]')) { ev.preventDefault(); openLifeEventModal(user); }
    });
  }

  function renderLifeEventsTimeline(user, isOwn) {
    var container = document.getElementById('about-life-events');
    if (!container) return;
    var GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) return;
    var _t = function(k){ return typeof window.GHt === 'function' ? window.GHt(k) : k; };

    // Auto-generate events from work/education
    var events = [];
    (Array.isArray(user.work) ? user.work : []).forEach(function(w) {
      if (w.from && w.company) events.push({ type: 'work', year: w.from, label: (_t('about_work_started') || 'Started working at ') + w.company, icon: 'fa-briefcase', color: '#10b981' });
    });
    (Array.isArray(user.education) ? user.education : []).forEach(function(e) {
      if (e.to && e.school) events.push({ type: 'edu', year: e.to, label: (_t('about_edu_graduated') || 'Graduated from ') + e.school, icon: 'fa-graduation-cap', color: '#3b82f6' });
    });

    // Load custom life events from Firestore
    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'users', user.uid, 'lifeEvents'),
      GF.fs.orderBy('year', 'desc'),
      GF.fs.limit(20)
    )).then(function(snap) {
      snap.forEach(function(d) {
        var data = Object.assign({ id: d.id }, d.data());
        events.push({ type: 'custom', year: data.year || '', label: data.label || 'Life event', icon: data.icon || 'fa-star', color: '#f59e0b', id: data.id });
      });
      events.sort(function(a, b) { return String(b.year).localeCompare(String(a.year)); });
      paintLifeEvents(container, events, user, isOwn);
    }).catch(function() {
      events.sort(function(a, b) { return String(b.year).localeCompare(String(a.year)); });
      paintLifeEvents(container, events, user, isOwn);
    });
  }

  function paintLifeEvents(container, events, user, isOwn) {
    if (!events.length && !isOwn) { container.innerHTML = ''; return; }
    var html = '<div class="about-section-title">Life Events' + (isOwn ? '<button class="about-add-btn" data-life-event-add>+ Add</button>' : '') + '</div>';
    if (!events.length) {
      html += '<div class="about-item" style="color:var(--gh-muted,#64748b)"><i class="fas fa-star"></i> Add your first life event</div>';
    } else {
      html += '<div class="life-events-timeline">';
      events.forEach(function(ev) {
        html += '<div class="life-event-item">'
          + '<div class="life-event-dot" style="background:' + esc(ev.color || '#6d3fd9') + '"><i class="fas ' + esc(ev.icon) + '"></i></div>'
          + '<div class="life-event-content">'
          + '<div class="life-event-label">' + esc(ev.label) + '</div>'
          + '<div class="life-event-year">' + esc(ev.year) + '</div>'
          + '</div>'
          + '</div>';
      });
      html += '</div>';
    }
    container.innerHTML = html;
  }

  function openWorkModal(user, idx) {
    var _t = function(k){ return typeof window.GHt === 'function' ? window.GHt(k) : k; };
    var work = Array.isArray(user.work) ? user.work : [];
    var entry = idx >= 0 ? (work[idx] || {}) : {};
    var isNew = idx < 0;
    var old = document.getElementById('gh-work-modal'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'gh-work-modal';
    ov.className = 'profile-edit-overlay';
    ov.innerHTML = '<div class="profile-edit-sheet" style="max-width:500px">'
      + '<div class="profile-edit-head"><h3>' + (isNew ? _t('work_modal_add') : _t('work_modal_edit')) + '</h3><button class="profile-edit-close" id="gwClose"><i class="fas fa-times"></i></button></div>'
      + '<div class="profile-edit-body">'
      + '<div class="profile-edit-field"><label>' + _t('work_company_lbl') + '</label><input class="profile-edit-input" id="gwCompany" placeholder="Company name" value="' + esc(entry.company || '') + '"></div>'
      + '<div class="profile-edit-field"><label>' + _t('work_position_lbl') + '</label><input class="profile-edit-input" id="gwPosition" placeholder="Software Engineer" value="' + esc(entry.position || '') + '"></div>'
      + '<div class="profile-edit-field"><label>' + _t('work_from_lbl') + '</label><input class="profile-edit-input" id="gwFrom" placeholder="2020" value="' + esc(entry.from || '') + '"></div>'
      + '<div class="profile-edit-field"><label>' + _t('work_to_lbl') + '</label><input class="profile-edit-input" id="gwTo" placeholder="2023" value="' + esc(entry.to || '') + '"></div>'
      + '<div class="profile-edit-field"><label><input type="checkbox" id="gwCurrent"' + (entry.current ? ' checked' : '') + '> ' + _t('work_currently') + '</label></div>'
      + (idx >= 0 ? '<div style="margin-top:8px"><button class="btn btn-ghost btn-sm" id="gwDelete" style="color:#f87171"><i class="fas fa-trash"></i> ' + _t('remove') + '</button></div>' : '')
      + '</div>'
      + '<div class="profile-edit-footer"><button class="btn btn-ghost btn-sm" id="gwCancel">' + _t('cancel') + '</button><button class="btn btn-primary btn-sm" id="gwSave"><i class="fas fa-check"></i> ' + _t('save') + '</button></div>'
      + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function() { ov.classList.add('open'); });
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    ov.querySelector('#gwClose').addEventListener('click', function() { ov.remove(); });
    ov.querySelector('#gwCancel').addEventListener('click', function() { ov.remove(); });

    function saveWork() {
      var newEntry = {
        company: (document.getElementById('gwCompany').value || '').trim(),
        position: (document.getElementById('gwPosition').value || '').trim(),
        from: (document.getElementById('gwFrom').value || '').trim(),
        to: (document.getElementById('gwTo').value || '').trim(),
        current: document.getElementById('gwCurrent').checked
      };
      if (!newEntry.company) { toast(_t('work_company_req'), 'error'); return; }
      var newWork = work.slice();
      if (isNew) newWork.push(newEntry);
      else newWork[idx] = newEntry;
      var GF = window.GeoFirebase;
      var fbUser = GF && GF.auth && GF.auth.currentUser;
      if (!GF || !GF.db || !GF.fs || !fbUser) { toast(_t('not_signed_in'), 'error'); return; }
      GF.fs.updateDoc(GF.fs.doc(GF.db, 'users', fbUser.uid), { work: newWork }).then(function() {
        toast(_t('work_saved'));
        user.work = newWork;
        renderAboutTab(user);
        ov.remove();
      }).catch(function(err) { toast(_t('save_failed') + ': ' + (err && err.message), 'error'); });
    }

    ov.querySelector('#gwSave').addEventListener('click', saveWork);
    var delBtn = ov.querySelector('#gwDelete');
    if (delBtn) {
      delBtn.addEventListener('click', function() {
        window.ghConfirm(_t('work_remove_cfm'), function() {
          var newWork = work.filter(function(_, i) { return i !== idx; });
          var GF = window.GeoFirebase;
          var fbUser = GF && GF.auth && GF.auth.currentUser;
          if (!GF || !GF.db || !GF.fs || !fbUser) return;
          GF.fs.updateDoc(GF.fs.doc(GF.db, 'users', fbUser.uid), { work: newWork }).then(function() {
            toast(_t('work_removed'));
            user.work = newWork;
            renderAboutTab(user);
            ov.remove();
          }).catch(function(err) { toast(_t('remove_failed') + ': ' + (err && err.message), 'error'); });
        });
      });
    }
  }

  function openEduModal(user, idx) {
    var _t = function(k){ return typeof window.GHt === 'function' ? window.GHt(k) : k; };
    var edu = Array.isArray(user.education) ? user.education : [];
    var entry = idx >= 0 ? (edu[idx] || {}) : {};
    var isNew = idx < 0;
    var old = document.getElementById('gh-edu-modal'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'gh-edu-modal';
    ov.className = 'profile-edit-overlay';
    ov.innerHTML = '<div class="profile-edit-sheet" style="max-width:500px">'
      + '<div class="profile-edit-head"><h3>' + (isNew ? _t('edu_modal_add') : _t('edu_modal_edit')) + '</h3><button class="profile-edit-close" id="geClose"><i class="fas fa-times"></i></button></div>'
      + '<div class="profile-edit-body">'
      + '<div class="profile-edit-field"><label>' + _t('edu_school_lbl') + '</label><input class="profile-edit-input" id="geSchool" placeholder="University name" value="' + esc(entry.school || '') + '"></div>'
      + '<div class="profile-edit-field"><label>' + _t('edu_degree_lbl') + '</label><input class="profile-edit-input" id="geDegree" placeholder="Bachelor\'s, Master\'s…" value="' + esc(entry.degree || '') + '"></div>'
      + '<div class="profile-edit-field"><label>' + _t('work_from_lbl') + '</label><input class="profile-edit-input" id="geFrom" placeholder="2018" value="' + esc(entry.from || '') + '"></div>'
      + '<div class="profile-edit-field"><label>' + _t('work_to_lbl') + '</label><input class="profile-edit-input" id="geTo" placeholder="2022" value="' + esc(entry.to || '') + '"></div>'
      + (idx >= 0 ? '<div style="margin-top:8px"><button class="btn btn-ghost btn-sm" id="geDelete" style="color:#f87171"><i class="fas fa-trash"></i> ' + _t('remove') + '</button></div>' : '')
      + '</div>'
      + '<div class="profile-edit-footer"><button class="btn btn-ghost btn-sm" id="geCancel">' + _t('cancel') + '</button><button class="btn btn-primary btn-sm" id="geSave"><i class="fas fa-check"></i> ' + _t('save') + '</button></div>'
      + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function() { ov.classList.add('open'); });
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    ov.querySelector('#geClose').addEventListener('click', function() { ov.remove(); });
    ov.querySelector('#geCancel').addEventListener('click', function() { ov.remove(); });

    function saveEdu() {
      var newEntry = {
        school: (document.getElementById('geSchool').value || '').trim(),
        degree: (document.getElementById('geDegree').value || '').trim(),
        from: (document.getElementById('geFrom').value || '').trim(),
        to: (document.getElementById('geTo').value || '').trim()
      };
      if (!newEntry.school) { toast(_t('edu_school_req'), 'error'); return; }
      var newEdu = edu.slice();
      if (isNew) newEdu.push(newEntry);
      else newEdu[idx] = newEntry;
      var GF = window.GeoFirebase;
      var fbUser = GF && GF.auth && GF.auth.currentUser;
      if (!GF || !GF.db || !GF.fs || !fbUser) { toast(_t('not_signed_in'), 'error'); return; }
      GF.fs.updateDoc(GF.fs.doc(GF.db, 'users', fbUser.uid), { education: newEdu }).then(function() {
        toast(_t('edu_saved'));
        user.education = newEdu;
        renderAboutTab(user);
        ov.remove();
      }).catch(function(err) { toast(_t('save_failed') + ': ' + (err && err.message), 'error'); });
    }

    ov.querySelector('#geSave').addEventListener('click', saveEdu);
    var delBtn = ov.querySelector('#geDelete');
    if (delBtn) {
      delBtn.addEventListener('click', function() {
        window.ghConfirm(_t('edu_remove_cfm'), function() {
          var newEdu = edu.filter(function(_, i) { return i !== idx; });
          var GF = window.GeoFirebase;
          var fbUser = GF && GF.auth && GF.auth.currentUser;
          if (!GF || !GF.db || !GF.fs || !fbUser) return;
          GF.fs.updateDoc(GF.fs.doc(GF.db, 'users', fbUser.uid), { education: newEdu }).then(function() {
            toast(_t('edu_removed'));
            user.education = newEdu;
            renderAboutTab(user);
            ov.remove();
          }).catch(function(err) { toast(_t('remove_failed') + ': ' + (err && err.message), 'error'); });
        });
      });
    }
  }

  function openLifeEventModal(user) {
    var _t = function(k){ return typeof window.GHt === 'function' ? window.GHt(k) : k; };
    var old = document.getElementById('gh-life-event-modal'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'gh-life-event-modal';
    ov.className = 'profile-edit-overlay';
    ov.innerHTML = '<div class="profile-edit-sheet" style="max-width:480px">'
      + '<div class="profile-edit-head"><h3>' + _t('life_event_add') + '</h3><button class="profile-edit-close" id="gleClose"><i class="fas fa-times"></i></button></div>'
      + '<div class="profile-edit-body">'
      + '<div class="profile-edit-field"><label>' + _t('life_event_desc') + '</label><input class="profile-edit-input" id="gleLabel" placeholder="მაგ. გადავედი თბილისში…"></div>'
      + '<div class="profile-edit-field"><label>' + _t('work_from_lbl') + '</label><input class="profile-edit-input" id="gleYear" placeholder="2023" type="number" min="1900" max="2099"></div>'
      + '<div class="profile-edit-field"><label>' + _t('life_event_icon') + '</label><select class="profile-edit-input" id="gleIcon"><option value="fa-star">⭐ Milestone</option><option value="fa-map-marker-alt">📍 Moved</option><option value="fa-heart">❤️ Relationship</option><option value="fa-baby">👶 New family</option><option value="fa-plane">✈️ Travel</option><option value="fa-trophy">🏆 Achievement</option></select></div>'
      + '</div>'
      + '<div class="profile-edit-footer"><button class="btn btn-ghost btn-sm" id="gleCancel">' + _t('cancel') + '</button><button class="btn btn-primary btn-sm" id="gleSave"><i class="fas fa-check"></i> ' + _t('life_event_add') + '</button></div>'
      + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function() { ov.classList.add('open'); });
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    ov.querySelector('#gleClose').addEventListener('click', function() { ov.remove(); });
    ov.querySelector('#gleCancel').addEventListener('click', function() { ov.remove(); });
    ov.querySelector('#gleSave').addEventListener('click', function() {
      var label = (document.getElementById('gleLabel').value || '').trim();
      var year  = (document.getElementById('gleYear').value || '').trim();
      var icon  = document.getElementById('gleIcon').value || 'fa-star';
      if (!label) { toast(_t('life_event_req'), 'error'); return; }
      var GF = window.GeoFirebase;
      var fbUser = GF && GF.auth && GF.auth.currentUser;
      if (!GF || !GF.db || !GF.fs || !fbUser) { toast(_t('not_signed_in'), 'error'); return; }
      GF.fs.addDoc(GF.fs.collection(GF.db, 'users', fbUser.uid, 'lifeEvents'), {
        label: label, year: year, icon: icon, createdAt: GF.fs.serverTimestamp()
      }).then(function() {
        toast(_t('life_event_added'));
        renderAboutTab(user);
        ov.remove();
      }).catch(function(err) { toast(_t('save_failed') + ': ' + (err && err.message), 'error'); });
    });
  }

  function maybeShowCompletionHint(user) {
    var old = document.getElementById('profile-completion-hint');
    if (old) old.remove();
    var _t2 = typeof window.GHt === 'function' ? window.GHt : function(k){return k;};
    var missing = [];
    if (!user.bio) missing.push(_t2('profile_bio') || 'bio');
    if (!user.avatar || user.avatar.indexOf('data:') === 0) missing.push(_t2('profile_photo') || 'profile photo');
    if (!user.interests || !user.interests.length) missing.push(_t2('profile_interests') || 'interests');
    if (!missing.length) return;
    var hint = document.createElement('div');
    hint.id = 'profile-completion-hint';
    hint.className = 'profile-completion-hint';
    hint.innerHTML = '<i class="fas fa-circle-info"></i> ' + (_t2('complete_profile') || 'Complete your profile') + ' — ' + missing.join(', ')
      + '. <button class="hint-edit-btn" data-edit-profile><i class="fas fa-pen"></i> ' + (_t2('edit_profile') || 'Edit Profile') + '</button>'
      + '<button class="hint-close-btn" onclick="document.getElementById(\'profile-completion-hint\').remove()" aria-label="Dismiss">&times;</button>';
    var nameBlock = document.querySelector('.profile-name-block');
    if (nameBlock) nameBlock.insertAdjacentElement('beforebegin', hint);
  }

  function applyCreatorMode(user, fbUser) {
    document.body.setAttribute('data-profile-mode', 'creator');
    var badge = $('.trust-badges');
    if (badge && !badge.querySelector('.creator-badge')) {
      badge.insertAdjacentHTML('beforeend', '<span class="trust-badge creator-badge"><i class="fas fa-star"></i> Creator</span>');
    }

    var nameBlock = document.querySelector('.profile-name-block');

    // Niche / category chip
    var niche = user.creatorCategory || user.niche || '';
    if (niche && nameBlock && !nameBlock.querySelector('.creator-niche-chip')) {
      nameBlock.insertAdjacentHTML('beforeend',
        '<span class="creator-niche-chip" style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;'
        + 'background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.25);border-radius:999px;'
        + 'font-size:.75rem;font-weight:700;color:#10e0a0;margin-top:6px">'
        + '<i class="fas fa-hashtag"></i>' + esc(niche) + '</span>');
    }

    // Social links strip in header
    var links = user.socialLinks || {};
    var website = safeUrl(user.website);
    var igHandle = links.instagram ? String(links.instagram).replace(/^@/, '') : '';
    var ttHandle = links.tiktok ? String(links.tiktok).replace(/^@/, '') : '';
    var fbUrl = safeUrl(links.facebook);
    var liUrl = safeUrl(links.linkedin);
    var hasLinks = website || igHandle || ttHandle || fbUrl || liUrl;
    if (hasLinks && nameBlock && !nameBlock.querySelector('.creator-social-links')) {
      var linksHtml = '<div class="creator-social-links" style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;align-items:center">';
      if (igHandle) linksHtml += '<a href="https://instagram.com/' + encodeURIComponent(igHandle) + '" target="_blank" rel="noopener noreferrer" style="color:#cd486b;font-size:.85rem;text-decoration:none"><i class="fab fa-instagram"></i> ' + esc(igHandle) + '</a>';
      if (ttHandle) linksHtml += '<a href="https://tiktok.com/@' + encodeURIComponent(ttHandle) + '" target="_blank" rel="noopener noreferrer" style="color:#94a3b8;font-size:.85rem;text-decoration:none"><i class="fab fa-tiktok"></i> ' + esc(ttHandle) + '</a>';
      if (fbUrl) linksHtml += '<a href="' + esc(fbUrl) + '" target="_blank" rel="noopener noreferrer" style="color:#4267b2;font-size:.85rem;text-decoration:none"><i class="fab fa-facebook"></i> Facebook</a>';
      if (liUrl) linksHtml += '<a href="' + esc(liUrl) + '" target="_blank" rel="noopener noreferrer" style="color:#0077b5;font-size:.85rem;text-decoration:none"><i class="fab fa-linkedin"></i> LinkedIn</a>';
      if (website) linksHtml += '<a href="' + esc(website) + '" target="_blank" rel="noopener noreferrer" style="color:#10e0a0;font-size:.85rem;text-decoration:none"><i class="fas fa-globe"></i> Website</a>';
      linksHtml += '</div>';
      nameBlock.insertAdjacentHTML('beforeend', linksHtml);
    }

    // Support Creator button for visitors
    var own = fbUser && user.uid === fbUser.uid;
    if (!own && fbUser) {
      var actions = $('.profile-actions');
      if (actions && !actions.querySelector('.support-creator-btn')) {
        actions.insertAdjacentHTML('beforeend',
          '<button class="btn btn-ghost btn-sm support-creator-btn" onclick="window._supportCreator(\''
          + esc(user.uid) + '\',\'' + esc(user.fullName || 'Creator') + '\')">'
          + '<i class="fas fa-heart"></i> Support</button>');
      }
    }
  }

  window._supportCreator = function (targetUid, targetName) {
    var GS = window.GeoSocial;
    if (!GS || !GS.sendPoints) { toast(_pt('points_loading'), 'error'); return; }
    var raw = (prompt('Send GeoPoints to ' + esc(targetName) + ':\nEnter amount (1–500):') || '').trim();
    if (!raw) return;
    if (!/^\d+$/.test(raw)) { toast(_pt('enter_points_1_500'), 'error'); return; }
    var amount = parseInt(raw, 10);
    if (amount <= 0 || amount > 500) { toast(_pt('enter_points_1_500'), 'error'); return; }
    GS.sendPoints(targetUid, amount, 'Support for creator ' + targetName);
  };

  window._activateCreatorMode = function () {
    var fb = window.GeoFirebase;
    if (!fb || !fb.auth || !fb.db || !fb.fs) { toast(_pt('app_loading'), 'error'); return; }
    var u = fb.auth.currentUser;
    if (!u) { window.location.href = 'auth.html'; return; }
    window.ghConfirm(typeof window.GHt === 'function' ? window.GHt('creator_activate_cfm') : 'Activate Creator Mode? Your profile will be listed on the Creators page.', function() {
      fb.fs.updateDoc(fb.fs.doc(fb.db, 'users', u.uid), { accountType: 'creator' })
        .then(function () { window.location.reload(); })
        .catch(function (err) { toast((err && err.message) || 'Could not activate', 'error'); });
    });
  };

  function loadBizMode(bizId, GF, fbUser) {
    document.body.setAttribute('data-profile-mode', 'business');
    GF.fs.getDoc(GF.fs.doc(GF.db, 'businesses', bizId)).then(function(snap) {
      if (!snap.exists()) {
        var main = $('.profile-layout') || document.body;
        main.innerHTML = '<div class="empty-profile-state" style="max-width:720px;margin:80px auto;text-align:center"><i class="fas fa-store-slash"></i><h2>Business not found</h2><p>This page does not exist or was removed.</p><a class="btn btn-primary btn-sm" href="index.html">Go Home</a></div>';
        return;
      }
      renderBizPage(Object.assign({ id: snap.id }, snap.data()), fbUser, GF);
    }).catch(function(err) { console.warn('[Profile] biz load failed', err && err.message); });
  }

  function renderBizPage(biz, fbUser, GF) {
    document.title = (biz.name || biz.title || 'Business') + ' — GeoHub';
    var isOwner = fbUser && (fbUser.uid === biz.ownerId || (Array.isArray(biz.adminIds) && biz.adminIds.includes(fbUser.uid)));
    var isOpen = isOpenNow(biz.workingHours);
    var openBadge = isOpen === null ? '' : (isOpen
      ? '<span class="biz-open-badge open"><i class="fas fa-circle" style="font-size:.45rem"></i> Open Now</span>'
      : '<span class="biz-open-badge closed"><i class="fas fa-circle" style="font-size:.45rem"></i> Closed</span>');
    var cover = $('.profile-cover');
    if (cover && biz.coverUrl) cover.style.backgroundImage = 'linear-gradient(180deg,rgba(4,5,13,0.08),rgba(4,5,13,0.72)),url(\'' + esc(biz.coverUrl) + '\')';
    var identity = $('.profile-identity-section');
    if (identity) {
      identity.innerHTML = '<div style="max-width:1200px;margin:0 auto;padding:0 24px 16px">'
        + '<div style="display:flex;align-items:flex-end;gap:20px">'
        + '<div class="biz-logo-wrap">'
        + (biz.logoUrl ? '<img src="' + esc(biz.logoUrl) + '" alt="Logo">' : '<div class="biz-logo-placeholder">🏢</div>')
        + '</div>'
        + '<div class="biz-info">'
        + '<div class="biz-name-row"><div class="biz-name">' + esc(biz.name || biz.title || 'Business') + '</div>'
        + (biz.verified || biz.status === 'active' ? '<span class="biz-verified-badge"><i class="fas fa-check-circle"></i> Verified</span>' : '')
        + openBadge + '</div>'
        + '<div class="biz-cat-row">' + esc(biz.category || '') + (biz.city ? ' · ' + esc(biz.city) : '') + (biz.rating ? ' · ★ ' + Number(biz.rating).toFixed(1) + ' (' + (biz.reviewCount || 0) + ')' : '') + '</div>'
        + '<div class="biz-actions">'
        + (biz.phone ? '<a class="biz-action-btn primary" href="tel:' + esc(biz.phone) + '"><i class="fas fa-phone"></i> Call</a>' : '')
        + (biz.whatsapp ? '<a class="biz-action-btn ghost" href="https://wa.me/' + esc(biz.whatsapp) + '" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> WhatsApp</a>' : '')
        + (biz.website ? '<a class="biz-action-btn ghost" href="' + esc(biz.website) + '" target="_blank" rel="noopener noreferrer"><i class="fas fa-globe"></i> Website</a>' : '')
        + (isOwner ? '<a class="biz-action-btn ghost" href="add-business.html?edit=' + esc(biz.id) + '"><i class="fas fa-pen"></i> Edit</a>' : '')
        + '</div></div></div></div>';
    }
    var xpSec = $('.xp-progress-section'); if (xpSec) xpSec.style.display = 'none';
    var tabsEl = $('#profileTabs');
    var bizTabs = ['overview','services','reviews','about'];
    if (isOwner) bizTabs.push('dashboard');
    var bizLabels = { overview:'Overview', services:'Services', reviews:'Reviews', about:'About', dashboard:'Dashboard' };
    if (tabsEl) {
      tabsEl.innerHTML = bizTabs.map(function(k, i) {
        return '<div class="ptab' + (i === 0 ? ' active' : '') + '" data-tab="biz-' + k + '">' + bizLabels[k] + '</div>';
      }).join('');
    }
    var mainEl = $('.profile-main');
    if (mainEl) {
      mainEl.innerHTML = bizTabs.map(function(k, i) {
        return '<div class="tab-panel' + (i === 0 ? ' active' : '') + '" id="tab-biz-' + k + '"></div>';
      }).join('');
    }
    var sidebar = $('.profile-sidebar');
    if (sidebar) renderBizSidebar(biz, sidebar);
    $$('.ptab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        $$('.ptab').forEach(function(t) { t.classList.remove('active'); });
        $$('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var p = $('#tab-' + tab.dataset.tab); if (p) p.classList.add('active');
      });
    });
    renderBizOverview(biz);
    renderBizServices(biz);
    renderBizReviews(biz, GF);
    renderBizAbout(biz);
    if (isOwner) renderBizDashboard(biz, GF, fbUser);
  }

  function renderBizSidebar(biz, sidebar) {
    var hours = biz.workingHours || {};
    var days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    var dayLabels = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' };
    var todayKey = days[(new Date().getDay() + 6) % 7];
    sidebar.innerHTML = '<div class="sidebar-card"><div class="sidebar-card-title">Contact</div>'
      + (biz.phone ? '<div class="intro-item"><i class="fas fa-phone"></i> ' + esc(biz.phone) + '</div>' : '')
      + (biz.email ? '<div class="intro-item"><i class="fas fa-envelope"></i> ' + esc(biz.email) + '</div>' : '')
      + (biz.address ? '<div class="intro-item"><i class="fas fa-map-marker-alt"></i> ' + esc(biz.address) + '</div>' : '')
      + (biz.website ? '<div class="intro-item"><i class="fas fa-globe"></i> <a href="' + esc(biz.website) + '" target="_blank" rel="noopener" style="color:var(--green);text-decoration:none">' + esc(biz.website) + '</a></div>' : '')
      + '</div>'
      + '<div class="sidebar-card"><div class="sidebar-card-title">Hours</div>'
      + days.map(function(d) {
          var h = hours[d]; var isToday = d === todayKey;
          var t = (h && !h.closed) ? esc(h.open || '') + ' – ' + esc(h.close || '') : '<span class="biz-hours-closed">Closed</span>';
          return '<div class="biz-hours-row' + (isToday ? ' today' : '') + '"><span>' + dayLabels[d] + '</span><span>' + t + '</span></div>';
        }).join('')
      + '</div>'
      + (biz.description ? '<div class="sidebar-card"><div class="sidebar-card-title">About</div><p style="font-size:.85rem;color:var(--text-secondary);line-height:1.6;margin:0">' + esc(biz.description) + '</p></div>' : '');
  }

  function renderBizOverview(biz) {
    var tab = $('#tab-biz-overview'); if (!tab) return;
    var html = '<div style="display:flex;flex-direction:column;gap:14px">';
    if (biz.description) html += '<div class="biz-info-card"><p style="font-size:.9rem;color:var(--text-secondary);line-height:1.7;margin:0">' + esc(biz.description) + '</p></div>';
    if (biz.phone || biz.email || biz.website || biz.address) {
      html += '<div class="biz-info-card"><div class="biz-info-card-title">Contact</div>'
        + (biz.phone ? '<div class="biz-detail-item"><i class="fas fa-phone"></i> ' + esc(biz.phone) + '</div>' : '')
        + (biz.email ? '<div class="biz-detail-item"><i class="fas fa-envelope"></i> ' + esc(biz.email) + '</div>' : '')
        + (biz.address ? '<div class="biz-detail-item"><i class="fas fa-map-marker-alt"></i> ' + esc(biz.address) + '</div>' : '')
        + (biz.website ? '<div class="biz-detail-item"><i class="fas fa-globe"></i> <a href="' + esc(biz.website) + '" target="_blank" rel="noopener" style="color:var(--green)">' + esc(biz.website) + '</a></div>' : '')
        + '</div>';
    }
    if (Array.isArray(biz.galleryPhotos) && biz.galleryPhotos.length) {
      html += '<div class="biz-info-card"><div class="biz-info-card-title">Photos</div><div class="gallery-grid">'
        + biz.galleryPhotos.slice(0,6).map(function(url) { return '<div class="gallery-item"><img src="' + esc(url) + '" alt="" loading="lazy" decoding="async"></div>'; }).join('')
        + '</div></div>';
    }
    if (!biz.description && !biz.phone && !biz.email && !biz.website && !biz.address && !(Array.isArray(biz.galleryPhotos) && biz.galleryPhotos.length)) {
      html += '<div class="empty-profile-state"><i class="fas fa-store"></i><h3>No info yet</h3><p>The owner hasn\'t added details yet.</p></div>';
    }
    tab.innerHTML = html + '</div>';
  }

  function renderBizServices(biz) {
    var tab = $('#tab-biz-services'); if (!tab) return;
    var services = Array.isArray(biz.services) ? biz.services : [];
    if (!services.length) { tab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-toolbox"></i><h3>No services listed</h3><p>Services will appear after the owner adds them.</p></div>'; return; }
    tab.innerHTML = '<div class="biz-services-list">' + services.map(function(s) {
      var name = typeof s === 'string' ? s : (s.name || '');
      var desc = typeof s === 'object' ? (s.description || '') : '';
      var price = typeof s === 'object' ? (s.price || '') : '';
      return '<div class="biz-service-item"><div class="biz-service-icon"><i class="fas fa-check"></i></div><div><div class="biz-service-name">' + esc(name) + '</div>' + (desc ? '<div class="biz-service-desc">' + esc(desc) + '</div>' : '') + '</div>' + (price ? '<div class="biz-service-price">' + esc(price) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  function renderBizReviews(biz, GF) {
    var tab = $('#tab-biz-reviews'); if (!tab) return;
    if (!GF || !GF.db || !GF.fs || !biz.id) { tab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-star"></i><h3>No reviews yet</h3></div>'; return; }
    GF.fs.getDocs(GF.fs.query(GF.fs.collection(GF.db,'reviews'), GF.fs.where('businessId','==',biz.id), GF.fs.orderBy('createdAt','desc'), GF.fs.limit(20))).then(function(snap) {
      if (snap.empty) { tab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-star"></i><h3>No reviews yet</h3><p>Be the first to review.</p></div>'; return; }
      var rows = [];
      snap.forEach(function(d) {
        var r = d.data(); var stars = '★'.repeat(Math.min(5, Math.round(r.rating || 0)));
        rows.push('<div class="biz-review-card"><div class="biz-reviewer-row"><div class="biz-reviewer-avatar">' + esc(initialLetters(r.authorName||'User','')) + '</div><div style="flex:1"><div style="font-weight:700;font-size:.88rem">' + esc(r.authorName||'Anonymous') + '</div><div class="biz-stars">' + stars + '</div></div><div style="font-size:.72rem;color:var(--text-muted)">' + timeAgo(r.createdAt) + '</div></div>' + (r.text ? '<p style="font-size:.85rem;color:var(--text-secondary);line-height:1.6;margin:0">' + esc(r.text) + '</p>' : '') + '</div>');
      });
      tab.innerHTML = rows.join('');
    }).catch(function() { tab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-star"></i><h3>No reviews yet</h3></div>'; });
  }

  function renderBizAbout(biz) {
    var tab = $('#tab-biz-about'); if (!tab) return;
    var html = '<div class="about-card">';
    if (biz.description) html += '<div class="about-bio">' + esc(biz.description) + '</div>';
    html += '<div class="about-section-title">Details</div>';
    if (biz.category) html += '<div class="about-item"><i class="fas fa-tag"></i> ' + esc(biz.category) + '</div>';
    if (biz.address || biz.city) html += '<div class="about-item"><i class="fas fa-map-marker-alt"></i> ' + esc(biz.address || biz.city) + '</div>';
    if (biz.phone) html += '<div class="about-item"><i class="fas fa-phone"></i> ' + esc(biz.phone) + '</div>';
    if (biz.email) html += '<div class="about-item"><i class="fas fa-envelope"></i> ' + esc(biz.email) + '</div>';
    if (biz.website) html += '<div class="about-item"><i class="fas fa-globe"></i> <a href="' + esc(biz.website) + '" target="_blank" rel="noopener" style="color:var(--green)">' + esc(biz.website) + '</a></div>';
    if (biz.priceRange) html += '<div class="about-item"><i class="fas fa-dollar-sign"></i> ' + esc(biz.priceRange) + '</div>';
    tab.innerHTML = html + '</div>';
  }

  function renderBizDashboard(biz, GF, fbUser) {
    var tab = $('#tab-biz-dashboard'); if (!tab) return;
    tab.innerHTML = '<div class="biz-info-card"><div class="biz-info-card-title">Owner Dashboard</div>'
      + '<div class="biz-detail-item"><i class="fas fa-star"></i> Rating: ' + (biz.rating ? Number(biz.rating).toFixed(1) + ' (' + (biz.reviewCount||0) + ' reviews)' : 'No ratings yet') + '</div>'
      + '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">'
      + '<a class="biz-action-btn primary" href="add-business.html?edit=' + esc(biz.id) + '"><i class="fas fa-pen"></i> Edit Business Info</a>'
      + '<a class="biz-action-btn ghost" href="business.html?id=' + esc(biz.id) + '"><i class="fas fa-eye"></i> View Public Page</a>'
      + '</div></div>';
  }

  function openEditProfileModal() {
    const GF = window.GeoFirebase;
    const fbUser = GF && GF.auth && GF.auth.currentUser;
    if (!fbUser) return;

    const u = window.GeoCurrentUser || {};
    const currentAvatar   = u.avatar || u.photoURL || '';
    const currentCover    = u.coverImage || '';
    const currentName     = u.fullName || u.displayName || '';
    const currentUsername = u.username || '';
    const currentBio      = u.bio || '';
    const currentCityScope    = u.cityScope || 'all_georgia';
    const currentCities       = Array.isArray(u.cities) ? u.cities.filter(c => c !== 'all_georgia').join(', ') : '';
    const currentWebsite      = u.website || '';
    const sl                  = u.socialLinks || {};
    const currentInterests    = Array.isArray(u.interests) ? u.interests : [];
    const currentGeoId        = u.geoId || null;
    const currentNameVis      = u.nameVisibility || 'everyone';

    const INTERESTS = ['Hiking','Cafés','Food','History','Arts','Nature','Sports','Nightlife','Shopping','Music','Photography','Travel','Adventure','Culture','Architecture'];

    const old = document.getElementById('profileEditModal'); if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'profileEditModal';
    overlay.className = 'profile-edit-overlay';
    overlay.innerHTML = '<div class="profile-edit-sheet">'
      + '<div class="profile-edit-head"><h3>Edit Profile</h3><button class="profile-edit-close" id="peClose"><i class="fas fa-times"></i></button></div>'
      + '<div class="profile-edit-body">'

      /* Photos */
      + '<div class="profile-edit-section">'
      + '<div class="profile-edit-section-title"><i class="fas fa-images"></i> Photos</div>'
      + '<div class="profile-edit-photos-row">'
      + '<div class="profile-edit-cover-wrap" id="peCoverWrap">'
      + (currentCover ? '<img id="peCoverImg" src="' + esc(currentCover) + '" alt="Cover">' : '')
      + '<div class="profile-edit-cover-overlay" id="peCoverOverlay"><i class="fas fa-camera"></i><span>Edit Cover</span></div>'
      + '</div>'
      + '<div class="profile-edit-avatar-col">'
      + '<div class="profile-edit-avatar-preview" id="peAvatarWrap">'
      + '<img id="peAvatarImg" src="' + esc(currentAvatar) + '" alt="Avatar">'
      + '<div class="profile-edit-avatar-badge"><i class="fas fa-camera"></i></div>'
      + '</div>'
      + '<span class="profile-edit-avatar-label">Photo</span>'
      + '</div>'
      + '</div>'
      + '<div class="upload-progress-bar-wrap" id="peUploadProgress" style="display:none"><div class="upload-progress-bar" id="peUploadBar"></div></div>'
      + '<div class="upload-status-text" id="peUploadStatus"></div>'
      + '</div>'

      /* Basic info */
      + '<div class="profile-edit-section">'
      + '<div class="profile-edit-section-title"><i class="fas fa-user"></i> Basic Info</div>'
      + '<div class="profile-edit-field"><label>Full Name</label><input class="profile-edit-input" id="peName" placeholder="Your full name" value="' + esc(currentName) + '"></div>'
      + '<div class="profile-edit-field"><label>Username <span style="font-weight:400;font-size:.75rem;color:#64748b">(unique · only a-z 0-9 . _)</span></label><input class="profile-edit-input" id="peUsername" placeholder="your_username" maxlength="20" value="' + esc(currentUsername) + '"><div id="peUsernameHint" style="font-size:.73rem;margin-top:3px;min-height:1.1em"></div></div>'
      + (currentGeoId ? '<div class="profile-edit-field"><label>GeoHub ID <span style="font-weight:400;font-size:.75rem;color:#64748b">(cannot be changed)</span></label><input class="profile-edit-input" value="#' + esc(String(currentGeoId)) + '" readonly style="color:#4da6ff;letter-spacing:.06em;cursor:default"></div>' : '')
      + '<div class="profile-edit-field"><label>Name Visibility <span style="font-weight:400;font-size:.75rem;color:#64748b">(who sees your full name)</span></label>'
      + '<select class="profile-edit-input" id="peNameVis">'
      + '<option value="everyone"' + (currentNameVis === 'everyone' ? ' selected' : '') + '>Everyone — ყველა ხედავს</option>'
      + '<option value="friends"'  + (currentNameVis === 'friends'  ? ' selected' : '') + '>Friends only — მხოლოდ მეგობრები</option>'
      + '<option value="me"'       + (currentNameVis === 'me'       ? ' selected' : '') + '>Only me — მხოლოდ მე (სხვები ნიკნეიმს ხედავენ)</option>'
      + '</select></div>'
      + '<div class="profile-edit-field"><label>Bio</label><textarea class="profile-edit-textarea" id="peBio" placeholder="Tell people about yourself…">' + esc(currentBio) + '</textarea></div>'
      + '</div>'

      /* Location */
      + '<div class="profile-edit-section">'
      + '<div class="profile-edit-section-title"><i class="fas fa-map-marker-alt"></i> Location &amp; Interests</div>'
      + '<div class="profile-edit-field"><label>Location Scope</label><select class="profile-edit-input" id="peScope"><option value="all_georgia"' + (currentCityScope === 'all_georgia' ? ' selected' : '') + '>Interested in all Georgia</option><option value="multi_city"' + (currentCityScope !== 'all_georgia' ? ' selected' : '') + '>Specific cities / regions</option></select></div>'
      + '<div class="profile-edit-field" id="peCitiesField"' + (currentCityScope === 'all_georgia' ? ' style="display:none"' : '') + '><label>Cities / Regions</label><input class="profile-edit-input" id="peCities" placeholder="Tbilisi, Batumi, Kazbegi" value="' + esc(currentCities) + '"></div>'
      + '<div class="profile-edit-field"><label>Interests</label><div class="interests-wrap" id="peInterests">'
      + INTERESTS.map(function(i) { return '<div class="interest-chip' + (currentInterests.indexOf(i) > -1 ? ' selected' : '') + '" data-interest="' + esc(i) + '">' + esc(i) + '</div>'; }).join('')
      + '</div></div>'
      + '</div>'

      /* Links */
      + '<div class="profile-edit-section">'
      + '<div class="profile-edit-section-title"><i class="fas fa-link"></i> Links &amp; Contact</div>'
      + '<div class="profile-edit-field"><label>Website</label><input class="profile-edit-input" id="peWebsite" placeholder="https://yourwebsite.com" value="' + esc(currentWebsite) + '"></div>'
      + '<div class="profile-edit-field"><label>Social Links</label><div class="social-links-grid">'
      + '<div class="social-link-field"><span class="social-link-icon"><i class="fab fa-instagram"></i></span><input id="peInstagram" placeholder="instagram" value="' + esc(sl.instagram || '') + '"></div>'
      + '<div class="social-link-field"><span class="social-link-icon"><i class="fab fa-facebook"></i></span><input id="peFacebook" placeholder="facebook" value="' + esc(sl.facebook || '') + '"></div>'
      + '<div class="social-link-field"><span class="social-link-icon"><i class="fab fa-linkedin"></i></span><input id="peLinkedin" placeholder="linkedin" value="' + esc(sl.linkedin || '') + '"></div>'
      + '<div class="social-link-field"><span class="social-link-icon"><i class="fab fa-tiktok"></i></span><input id="peTiktok" placeholder="tiktok" value="' + esc(sl.tiktok || '') + '"></div>'
      + '</div></div>'
      + '</div>'

      + '</div>'/* end body */
      + '<div class="profile-edit-footer"><button class="btn btn-ghost btn-sm" id="peCancel">Cancel</button><button class="btn btn-primary btn-sm" id="peSaveBtn"><i class="fas fa-check"></i> Save Changes</button></div>'
      + '</div>';/* end sheet */

    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('open'); });

    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#peClose').addEventListener('click', function() { overlay.remove(); });
    overlay.querySelector('#peCancel').addEventListener('click', function() { overlay.remove(); });

    overlay.querySelector('#peScope').addEventListener('change', function() {
      const cf = document.getElementById('peCitiesField');
      if (cf) cf.style.display = this.value === 'all_georgia' ? 'none' : '';
    });

    // Username uniqueness live check
    var _peUnTimer = null, _peUnStatus = 'ok';
    var peUnInput = overlay.querySelector('#peUsername');
    var peUnHint  = overlay.querySelector('#peUsernameHint');
    if (peUnInput && peUnHint) {
      peUnInput.addEventListener('input', function() {
        clearTimeout(_peUnTimer);
        var val = peUnInput.value.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
        if (peUnInput.value !== val) peUnInput.value = val;
        if (val === currentUsername) { peUnHint.textContent = ''; _peUnStatus = 'ok'; return; }
        if (val.length < 3)  { peUnHint.textContent = 'Minimum 3 characters'; peUnHint.style.color = '#f87171'; _peUnStatus = 'invalid'; return; }
        if (val.length > 20) { peUnHint.textContent = 'Maximum 20 characters'; peUnHint.style.color = '#f87171'; _peUnStatus = 'invalid'; return; }
        peUnHint.textContent = 'Checking…'; peUnHint.style.color = '#94a3b8'; _peUnStatus = 'checking';
        _peUnTimer = setTimeout(function() {
          var auth = window.GeoFirebaseAuth;
          if (!auth || !auth.isUsernameAvailable) { peUnHint.textContent = ''; _peUnStatus = 'ok'; return; }
          auth.isUsernameAvailable(val).then(function(avail) {
            if (avail) { peUnHint.textContent = '✓ @' + val + ' is available'; peUnHint.style.color = '#10b981'; _peUnStatus = 'ok'; }
            else       { peUnHint.textContent = '✗ @' + val + ' is taken'; peUnHint.style.color = '#f87171'; _peUnStatus = 'taken'; }
          }).catch(function() { peUnHint.textContent = ''; _peUnStatus = 'ok'; });
        }, 500);
      });
    }

    overlay.querySelector('#peInterests').addEventListener('click', function(e) {
      const chip = e.target.closest('.interest-chip');
      if (chip) chip.classList.toggle('selected');
    });

    var _pendingAvatar = '', _pendingCover = '';

    function doUpload(file, folder, onUrl) {
      const GS = window.GeoSocial;
      const pw = document.getElementById('peUploadProgress');
      const pb = document.getElementById('peUploadBar');
      const st = document.getElementById('peUploadStatus');
      if (!GS || !GS.uploadFile) { if (st) st.textContent = 'Upload unavailable.'; return; }
      if (pw) pw.style.display = '';
      if (pb) pb.style.width = '0%';
      if (st) st.textContent = 'Uploading…';
      GS.uploadFile(file, folder, function(pct) {
        if (pb) pb.style.width = pct + '%';
        if (st) st.textContent = pct + '%';
      }).then(function(url) {
        if (pw) pw.style.display = 'none';
        if (url) { if (st) st.textContent = 'Uploaded ✓'; onUrl(url); }
        else { if (st) st.textContent = 'Upload failed — try again.'; }
      }).catch(function() {
        if (pw) pw.style.display = 'none';
        if (st) st.textContent = 'Upload failed — try again.';
      });
    }

    overlay.querySelector('#peAvatarWrap').addEventListener('click', function() {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp'; inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.onchange = function() {
        var f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
        doUpload(f, 'avatars', function(url) {
          _pendingAvatar = url;
          var img = document.getElementById('peAvatarImg'); if (img) img.src = url;
        });
      };
      inp.click();
    });

    overlay.querySelector('#peCoverWrap').addEventListener('click', function() {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp'; inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.onchange = function() {
        var f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
        doUpload(f, 'covers', function(url) {
          _pendingCover = url;
          var wrap = document.getElementById('peCoverWrap');
          var ov   = document.getElementById('peCoverOverlay');
          var img  = document.getElementById('peCoverImg');
          if (!img && wrap) { img = document.createElement('img'); img.id = 'peCoverImg'; img.alt = 'Cover'; wrap.insertBefore(img, ov || null); }
          if (img) img.src = url;
        });
      };
      inp.click();
    });

    overlay.querySelector('#peSaveBtn').addEventListener('click', async function() {
      if (!GF || !GF.fs || !fbUser) return;
      const saveBtn = this;

      const newUsername = (document.getElementById('peUsername').value || '').trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
      const usernameChanged = newUsername && newUsername !== currentUsername;

      var _t2 = function(k){ return typeof window.GHt === 'function' ? window.GHt(k) : k; };
      if (_peUnStatus === 'taken') { toast(_t2('username_taken'), 'error'); return; }
      if (_peUnStatus === 'invalid') { toast(_t2('username_invalid'), 'error'); return; }
      if (_peUnStatus === 'checking') { toast(_t2('username_checking'), 'error'); return; }

      if (usernameChanged) {
        // Final availability check before saving
        const auth = window.GeoFirebaseAuth;
        if (auth && auth.isUsernameAvailable) {
          const avail = await auth.isUsernameAvailable(newUsername).catch(() => true);
          if (!avail) { toast('@' + newUsername + ' — ' + (_t2('username_taken') || 'was just taken. Choose a different one.'), 'error'); return; }
        }
      }

      saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving…';

      const scope    = document.getElementById('peScope').value;
      const cityText = (document.getElementById('peCities') ? document.getElementById('peCities').value : '').trim();
      const cities   = scope === 'all_georgia' ? ['all_georgia'] : cityText.split(',').map(function(x){ return x.trim(); }).filter(Boolean);

      const selectedInterests = [];
      overlay.querySelectorAll('.interest-chip.selected').forEach(function(el) { selectedInterests.push(el.dataset.interest); });

      const nameVisEl = document.getElementById('peNameVis');

      const updates = {
        fullName:        (document.getElementById('peName').value || '').trim(),
        displayName:     (document.getElementById('peName').value || '').trim(),
        username:        newUsername,
        bio:             (document.getElementById('peBio').value || '').trim(),
        cityScope:       scope,
        city:            scope === 'all_georgia' ? 'all_georgia' : (cities[0] || ''),
        cities:          cities,
        website:         (document.getElementById('peWebsite').value || '').trim(),
        nameVisibility:  nameVisEl ? nameVisEl.value : 'everyone',
        socialLinks: {
          instagram: (document.getElementById('peInstagram').value || '').trim(),
          facebook:  (document.getElementById('peFacebook').value || '').trim(),
          linkedin:  (document.getElementById('peLinkedin').value || '').trim(),
          tiktok:    (document.getElementById('peTiktok').value || '').trim()
        },
        interests:   selectedInterests,
        updatedAt:   GF.fs.serverTimestamp()
      };
      if (_pendingAvatar) updates.avatar = _pendingAvatar;
      if (_pendingCover)  updates.coverImage = _pendingCover;

      try {
        await GF.fs.updateDoc(GF.fs.doc(GF.db, 'users', fbUser.uid), updates);

        // Handle username reservation transfer
        if (usernameChanged) {
          const auth = window.GeoFirebaseAuth;
          if (auth) {
            if (currentUsername) await auth.releaseUsername(currentUsername).catch(() => {});
            await auth.reserveUsername(newUsername, fbUser.uid).catch(() => {});
          }
        }

        if (window.GeoCurrentUser) Object.assign(window.GeoCurrentUser, updates);
        if (window.GeoAuth && window.GeoAuth.updateUser) window.GeoAuth.updateUser(updates);
        overlay.remove();
        /* Reflect changes immediately in the page */
        if (_pendingCover) {
          const cover = $('.profile-cover');
          if (cover) cover.style.backgroundImage = 'linear-gradient(180deg,rgba(4,5,13,0.08),rgba(4,5,13,0.72)),url(\'' + _pendingCover + '\')';
        }
        if (_pendingAvatar) {
          const avEl = $('.profile-avatar'); if (avEl) avEl.src = _pendingAvatar;
          $$('.gh-avatar-img,.nav-avatar,[data-nav-avatar]').forEach(function(el) { el.src = _pendingAvatar; });
        }
        if (updates.fullName) { const nm = $('.profile-name'); if (nm) nm.textContent = updates.fullName; }
        if ('bio' in updates) { const bioEl = $('.profile-bio'); if (bioEl) bioEl.textContent = updates.bio || (typeof window.GHt==='function'?window.GHt('profile_no_bio'):'No bio yet.'); }
        if (updates.username || updates.city) { const hnd = $('.profile-handle'); if (hnd) hnd.textContent = '@' + (updates.username || (window.GeoCurrentUser && window.GeoCurrentUser.username) || 'user') + (updates.city && updates.city !== 'all_georgia' ? ' · ' + updates.city : ''); }
        toast(_t2('profile_saved_ok'));
      } catch (err) {
        toast(_t2('save_failed') + ': ' + (err && err.message ? err.message : 'Unknown error'), 'error');
        saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-check"></i> Save Changes';
      }
    });
  }

  function initTabs() {
    $$('.ptab').forEach(tab => tab.addEventListener('click', () => {
      if (tab.getAttribute('onclick')) return;
      $$('.ptab').forEach(t => t.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const p = $('#tab-' + tab.dataset.tab); if (p) p.classList.add('active');
    }));
  }

  function userNotFound() {
    document.title = 'User not found — GeoHub';
    const main = $('.profile-layout') || document.body;
    main.innerHTML = '<div class="empty-profile-state" style="max-width:720px;margin:120px auto;text-align:center"><i class="fas fa-user-slash"></i><h2>User not found</h2><p>This profile does not exist or was removed.</p><a class="btn btn-primary btn-sm" href="feed.html">Back to Feed</a></div>';
  }

  function showPrivateProfileGate(name, isPrivateAccount) {
    $$('#profileTabs, .profile-tabs, .profile-sidebar, .tab-panel').forEach(el => { el.style.display = 'none'; });
    const main = $('.profile-layout') || document.body;
    const gate = document.createElement('div');
    gate.className = 'private-profile-gate';
    if (isPrivateAccount) {
      gate.innerHTML = '<i class="fas fa-lock"></i><h3>Private Account</h3><p>' +
        (name ? esc(name) + ' has' : 'This account has') +
        ' a private profile.<br>Follow them to see their posts and content.</p>';
    } else {
      gate.innerHTML = '<i class="fas fa-lock"></i><h3>Friends Only</h3><p>' +
        (name ? esc(name) + ' only shares' : 'This account only shares') +
        ' their profile with friends.</p>';
    }
    main.appendChild(gate);
  }

  function start() {
    initTabs();
    whenFirebase(GF => {
      if (!GF || !GF.auth || !GF.db || !GF.fs) {
        location.replace('auth.html?next=' + encodeURIComponent(location.pathname.split('/').pop() || 'profile.html'));
        return;
      }
      onAuthReady(GF, async fbUser => {
        if (!fbUser) {
          location.replace('auth.html?next=' + encodeURIComponent((location.pathname.split('/').pop() || 'profile.html') + location.search));
          return;
        }
        const _bizId = new URLSearchParams(location.search).get('biz');
        if (_bizId) { loadBizMode(_bizId, GF, fbUser); return; }
        try {
          const profile = await findProfile(GF, fbUser);
          if (!profile) return userNotFound();
          renderIdentity(profile, fbUser);
          const isOwnProfile = profile.uid === fbUser.uid;
          if ((profile.accountType || '').toLowerCase() === 'creator') {
            applyCreatorMode(profile, fbUser);
          } else if (isOwnProfile) {
            // CTA: own non-creator profile — offer to activate creator mode
            const nameBlock = document.querySelector('.profile-name-block');
            if (nameBlock && !nameBlock.querySelector('.creator-cta-btn')) {
              nameBlock.insertAdjacentHTML('beforeend',
                '<div style="margin-top:10px">'
                + '<button class="creator-cta-btn" onclick="window._activateCreatorMode()" style="'
                + 'display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(16,185,129,.1);'
                + 'border:1px solid rgba(16,185,129,.25);border-radius:999px;color:#10e0a0;font-size:.78rem;'
                + 'font-weight:700;cursor:pointer">'
                + '<i class="fas fa-star"></i> Activate Creator Mode</button>'
                + '</div>');
            }
          }
          const privPref = (profile.privacy || {}).profilePref || 'public';
          const profileIsPrivate = profile.isPrivate;
          if (!isOwnProfile && (profileIsPrivate || privPref === 'friends')) {
            const fid = [fbUser.uid, profile.uid].sort().join('_');
            const [fSnap, legacySnap] = await Promise.all([
              GF.fs.getDoc(GF.fs.doc(GF.db, 'friends', fid)).catch(() => null),
              GF.fs.getDoc(GF.fs.doc(GF.db, 'friendships', fid)).catch(() => null)
            ]);
            const isFriend = (fSnap && fSnap.exists()) || (legacySnap && legacySnap.exists());
            if (!isFriend) {
              if (profileIsPrivate) {
                // პირადი ანგარიში: ფოლოვერებს ჩვეულებრივ ხედავენ, უცნობები ვერ
                const followSnap = await GF.fs.getDocs(GF.fs.query(
                  GF.fs.collection(GF.db, 'follows'),
                  GF.fs.where('followerId', '==', fbUser.uid),
                  GF.fs.where('followingId', '==', profile.uid),
                  GF.fs.limit(1)
                )).catch(() => null);
                const isFollower = followSnap && !followSnap.empty;
                if (!isFollower) {
                  showPrivateProfileGate(profile.fullName, true);
                  return;
                }
              } else {
                // friends-only პრეფერენცია
                showPrivateProfileGate(profile.fullName, false);
                return;
              }
            }
          }
          if (window.GeoSocial) renderTabs(profile, fbUser);
          else window.addEventListener('GeoSocialReady', () => renderTabs(profile, fbUser), { once: true });

          // Phase 27: Profile View Tracking
          _trackProfileView(GF, profile.uid, fbUser.uid, isOwnProfile);

          // People You May Know sidebar
          renderPymkSidebar();

          // Birthday check (own profile: check friends' birthdays)
          if (isOwnProfile && window.GeoFriendships) {
            window.GeoFriendships.getFriends(fbUser.uid, function(friendUids) {
              window.GeoFriendships.checkFriendBirthdays(friendUids);
            });
          }
        } catch (err) {
          console.error('[Profile]', err);
          userNotFound();
        }
      });
    });
  }

  document.addEventListener('click', async e => {
    if (e.target.closest('[data-logout]')) {
      e.preventDefault();
      try { if (window.GeoFirebase && window.GeoFirebase.auth) await window.GeoFirebase.auth.signOut(); } catch (err) {}
      location.href = 'auth.html';
    }
    // Followers / Following modal trigger
    var pfStat = e.target.closest('[data-pf-modal]');
    if (pfStat) {
      var profileUserId = new URLSearchParams(location.search).get('id') ||
        (window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser && window.GeoFirebase.auth.currentUser.uid) || '';
      if (profileUserId) openFollowModal(pfStat.dataset.pfModal, profileUserId);
      return;
    }
    const followBtn = e.target.closest('[data-follow-user]');
    if (followBtn) {
      e.preventDefault();
      const target = followBtn.dataset.followUser;
      if (!window.GeoSocial || !target) return toast(_pt('social_loading'), 'error');
      window.GeoSocial.toggleFollow(target, isFollowing => {
        $$('[data-follow-user="' + target + '"]').forEach(btn => {
          btn.classList.toggle('following', !!isFollowing);
          btn.innerHTML = isFollowing ? '<i class="fas fa-user-check"></i> '+(typeof GHt==='function'?GHt('unfollow'):'Following') : '<i class="fas fa-user-plus"></i> '+(typeof GHt==='function'?GHt('follow'):'Follow');
        });
      });
    }
    const friendBtn = e.target.closest('[data-friend-user]');
    if (friendBtn) {
      e.preventDefault();
      const target = friendBtn.dataset.friendUser;
      const st = friendBtn.dataset.friendState || 'none';
      if (!window.GeoSocial) { toast(_pt('friends_loading'), 'error'); return; }
      if (st === 'incoming') {
        // Accept directly (Decline is a sibling button handled separately)
        const reqId = friendBtn.dataset.requestId;
        if (reqId) {
          friendBtn.disabled = true;
          window.GeoSocial.respondFriendRequest(reqId, true, function() {
            friendBtn.disabled = false;
            updateFriendButtons(target, { state: 'friends' });
          });
        }
      } else if (st === 'friends') {
        // Toggle dropdown menu for Unfriend/Message
        var existingMenu = document.querySelector('.friend-dropdown-menu[data-for="' + target + '"]');
        if (existingMenu) { existingMenu.remove(); return; }
        var menu = document.createElement('div');
        menu.className = 'friend-dropdown-menu';
        menu.setAttribute('data-for', target);
        menu.style.cssText = 'position:absolute;z-index:9999;background:var(--bg-card,#0d111f);border:1px solid var(--gh-border,rgba(255,255,255,.1));border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.5);min-width:160px;padding:4px 0;margin-top:4px';
        menu.innerHTML = '<button class="fd-item" data-message-user="' + esc(target) + '" style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 16px;background:none;border:none;color:var(--gh-text,#f0f4ff);cursor:pointer;font-size:.87rem;text-align:left"><i class="fas fa-comment" style="width:14px"></i> Message</button>'
          + '<button class="fd-item" data-unfriend-user="' + esc(target) + '" style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 16px;background:none;border:none;color:#f87171;cursor:pointer;font-size:.87rem;text-align:left"><i class="fas fa-user-minus" style="width:14px"></i> Unfriend</button>';
        friendBtn.style.position = 'relative';
        var _fbPar = friendBtn.parentElement;
        var _fbParPos = window.getComputedStyle(_fbPar).position;
        if (_fbParPos !== 'absolute' && _fbParPos !== 'fixed') _fbPar.style.position = 'relative';
        friendBtn.insertAdjacentElement('afterend', menu);
        setTimeout(function() {
          function closeMenu(ev) { if (!menu.contains(ev.target) && ev.target !== friendBtn) { menu.remove(); document.removeEventListener('click', closeMenu); document.removeEventListener('keydown', closeOnEsc); } }
          function closeOnEsc(ev) { if (ev.key === 'Escape') { menu.remove(); document.removeEventListener('click', closeMenu); document.removeEventListener('keydown', closeOnEsc); } }
          document.addEventListener('click', closeMenu);
          document.addEventListener('keydown', closeOnEsc);
        }, 10);
      } else if (st === 'outgoing') {
        // Cancel the outgoing request
        friendBtn.disabled = true;
        friendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        if (window.GeoSocial.cancelFriendRequest) {
          window.GeoSocial.cancelFriendRequest(target, function() {
            friendBtn.disabled = false;
            updateFriendButtons(target, { state: 'none' });
          });
        } else if (window.GeoFriendships && window.GeoFriendships.cancelRequest) {
          window.GeoFriendships.cancelRequest(target, function() {
            friendBtn.disabled = false;
            updateFriendButtons(target, { state: 'none' });
          });
        }
      } else {
        // Show Sending… spinner; update to correct state from callback, listener provides final truth
        $$('[data-friend-user="' + target + '"]').forEach(function(b){
          b.disabled = true;
          b.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Sending…';
        });
        window.GeoSocial.sendFriendRequest(target, function(state) {
          $$('[data-friend-user="' + target + '"]').forEach(function(b){ b.disabled = false; });
          if (state === 'error') {
            updateFriendButtons(target, { state: 'none' });
          } else {
            var nextState = (state === 'friends') ? 'friends' : (state === 'incoming' ? 'incoming' : 'outgoing');
            updateFriendButtons(target, { state: nextState });
          }
        });
      }
    }
    // Decline inline button (injected by updateFriendButtons for incoming state)
    const declineInlineBtn = e.target.closest('[data-decline-inline]');
    if (declineInlineBtn) {
      e.preventDefault();
      const target = declineInlineBtn.dataset.declineInline;
      const reqId = declineInlineBtn.dataset.requestId;
      if (reqId && window.GeoSocial) {
        declineInlineBtn.disabled = true;
        window.GeoSocial.respondFriendRequest(reqId, false, function() {
          updateFriendButtons(target, { state: 'none' });
        });
      }
    }
    // Friend dropdown: Unfriend
    const unfriendBtn = e.target.closest('[data-unfriend-user]');
    if (unfriendBtn) {
      e.preventDefault();
      const target = unfriendBtn.dataset.unfriendUser;
      var menu2 = document.querySelector('.friend-dropdown-menu');
      if (menu2) menu2.remove();
      if (window.GeoSocial && window.GeoSocial.removeFriend) {
        window.GeoSocial.removeFriend(target, function() { updateFriendButtons(target, { state: 'none' }); });
      } else if (window.GeoFriendships) {
        window.GeoFriendships.unfriend(target);
        updateFriendButtons(target, { state: 'none' });
      }
    }
    const cancelSentBtn = e.target.closest('[data-cancel-sent-request]');
    if (cancelSentBtn) {
      e.preventDefault();
      const toId = cancelSentBtn.dataset.toUserId || '';
      if (toId && window.GeoSocial && window.GeoSocial.cancelFriendRequest) {
        cancelSentBtn.disabled = true;
        window.GeoSocial.cancelFriendRequest(toId, function() { cancelSentBtn.disabled = false; });
      }
    }
    const acceptBtn = e.target.closest('[data-accept-request]');
    if (acceptBtn) {
      e.preventDefault();
      const reqId = acceptBtn.dataset.acceptRequest;
      const fromUid = acceptBtn.dataset.fromUserId || '';
      if (window.GeoSocial) { window.GeoSocial.respondFriendRequest(reqId, true, function(){ }); }
      else if (window.GeoFriendships) { window.GeoFriendships.accept(reqId, fromUid); }
    }
    const rejectBtn = e.target.closest('[data-reject-request]');
    if (rejectBtn) {
      e.preventDefault();
      const reqId = rejectBtn.dataset.rejectRequest;
      if (window.GeoSocial) { window.GeoSocial.respondFriendRequest(reqId, false, function(){}); }
      else if (window.GeoFriendships) { window.GeoFriendships.decline(reqId); }
    }

    const msgBtn = e.target.closest('[data-message-user]');
    if (msgBtn) {
      e.preventDefault();
      const target = msgBtn.dataset.messageUser;
      if (!window.GeoSocial || !target) return toast(_pt('msg_loading'), 'error');
      window.GeoSocial.startConversation(target, () => { location.href = 'messages.html?with=' + encodeURIComponent(target); });
    }
    const callBtn = e.target.closest('[data-call-user]');
    if (callBtn) {
      e.preventDefault();
      if (!window.GhCalls || !window.GhCalls.startCall) return toast(_pt('call_not_ready', 'System not ready'), 'error');
      window.GhCalls.startCall(
        callBtn.dataset.callUser,
        callBtn.dataset.callName || 'User',
        callBtn.dataset.callAvatar || '',
        callBtn.dataset.callType || 'audio'
      );
    }
    if (e.target.closest('[data-edit-profile]')) {
      e.preventDefault();
      openEditProfileModal();
    }
    if (e.target.closest('[data-change-avatar]')) {
      e.preventDefault();
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp'; inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.onchange = async function() {
        var file = inp.files && inp.files[0]; inp.remove(); if (!file) return;
        var GS = window.GeoSocial; var GF2 = window.GeoFirebase;
        if (!GS || !GS.uploadFile || !GF2 || !GF2.auth || !GF2.auth.currentUser) return;
        var fbU = GF2.auth.currentUser;
        try {
          var url = await GS.uploadFile(file, 'avatars', function(){});
          var _tu = function(k){ return typeof window.GHt === 'function' ? window.GHt(k) : k; };
          if (!url) { toast(_tu('upload_failed'), 'error'); return; }
          await GF2.fs.updateDoc(GF2.fs.doc(GF2.db, 'users', fbU.uid), { avatar: url, updatedAt: GF2.fs.serverTimestamp() });
          var avEl = $('.profile-avatar'); if (avEl) avEl.src = url;
          $$('.gh-avatar-img,.nav-avatar,[data-nav-avatar]').forEach(function(el){ el.src = url; });
          if (window.GeoCurrentUser) window.GeoCurrentUser.avatar = url;
          toast(_tu('photo_updated'));
        } catch(err) { toast((typeof window.GHt === 'function' ? window.GHt('photo_failed') : 'Photo update failed'), 'error'); }
      };
      inp.click();
    }
    if (e.target.closest('[data-edit-cover]')) {
      e.preventDefault();
      var inp2 = document.createElement('input');
      inp2.type = 'file'; inp2.accept = 'image/png,image/jpeg,image/webp'; inp2.style.display = 'none';
      document.body.appendChild(inp2);
      inp2.onchange = async function() {
        var file = inp2.files && inp2.files[0]; inp2.remove(); if (!file) return;
        var GS = window.GeoSocial; var GF2 = window.GeoFirebase;
        if (!GS || !GS.uploadFile || !GF2 || !GF2.auth || !GF2.auth.currentUser) return;
        var fbU = GF2.auth.currentUser;
        try {
          var url = await GS.uploadFile(file, 'covers', function(){});
          var _tc = function(k){ return typeof window.GHt === 'function' ? window.GHt(k) : k; };
          if (!url) { toast(_tc('upload_failed'), 'error'); return; }
          await GF2.fs.updateDoc(GF2.fs.doc(GF2.db, 'users', fbU.uid), { coverImage: url, updatedAt: GF2.fs.serverTimestamp() });
          var coverEl = $('.profile-cover');
          if (coverEl) coverEl.style.backgroundImage = 'linear-gradient(180deg,rgba(4,5,13,0.08),rgba(4,5,13,0.72)),url(\'' + url + '\')';
          if (window.GeoCurrentUser) window.GeoCurrentUser.coverImage = url;
          toast(_tc('cover_updated'));
        } catch(err) { toast((typeof window.GHt === 'function' ? window.GHt('cover_failed') : 'Cover update failed'), 'error'); }
      };
      inp2.click();
    }
    const unblockBtn = e.target.closest('[data-unblock-user]');
    if (unblockBtn) {
      e.preventDefault();
      const target = unblockBtn.dataset.unblockUser;
      if (window.GeoSocial && window.GeoSocial.unblockUser) {
        window.GeoSocial.unblockUser(target, function() {
          unblockBtn.setAttribute('data-block-user', target);
          unblockBtn.removeAttribute('data-unblock-user');
          unblockBtn.innerHTML = '<i class="fas fa-ban"></i>';
          unblockBtn.title = 'Block';
        });
      }
    }
    const unmuteBtn = e.target.closest('[data-unmute-user]');
    if (unmuteBtn) {
      e.preventDefault();
      const target = unmuteBtn.dataset.unmuteUser;
      if (window.GeoSocial && window.GeoSocial.unmuteUser) {
        window.GeoSocial.unmuteUser(target, function() {
          unmuteBtn.setAttribute('data-mute-user', target);
          unmuteBtn.removeAttribute('data-unmute-user');
          unmuteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
          unmuteBtn.title = 'Mute';
        });
      }
    }
    const reportBtn = e.target.closest('[data-report-user]');
    if (reportBtn) {
      e.preventDefault();
      const target = reportBtn.dataset.reportUser;
      const uname = reportBtn.dataset.userName || '';
      if (window.GeoModeration) window.GeoModeration.openReportModal('user', target, uname);
      else if (window.GeoSocial && window.GeoSocial.reportTarget) window.GeoSocial.reportTarget('user', target, 'Reported from profile');
    }
    const muteBtn = e.target.closest('[data-mute-user]');
    if (muteBtn) {
      e.preventDefault();
      const target = muteBtn.dataset.muteUser;
      const uname = muteBtn.dataset.userName || '';
      if (window.GeoModeration) window.GeoModeration.openMuteConfirm(target, uname, function(){ if(window.GeoSocial && window.GeoSocial.muteUser) window.GeoSocial.muteUser(target); });
      else if (window.GeoSocial && window.GeoSocial.muteUser) window.GeoSocial.muteUser(target);
    }
    const blockBtn = e.target.closest('[data-block-user]');
    if (blockBtn) {
      e.preventDefault();
      const target = blockBtn.dataset.blockUser;
      const uname = blockBtn.dataset.userName || '';
      if (window.GeoModeration) {
        window.GeoModeration.openBlockConfirm(target, uname, function(){ if(window.GeoSocial && window.GeoSocial.blockUser) window.GeoSocial.blockUser(target, () => { location.href='feed.html'; }); });
      } else if (target) {
        window.ghConfirm(typeof window.GHt === 'function' ? window.GHt('block_user_cfm') : 'Block this user? Their posts will be hidden from your feed.', function() {
          if (window.GeoSocial && window.GeoSocial.blockUser) window.GeoSocial.blockUser(target, () => { location.href='feed.html'; });
        });
      }
    }
    if (e.target.closest('[data-add-highlight]')) {
      e.preventDefault();
      var GF = window.GeoFirebase;
      var fb = GF && GF.auth && GF.auth.currentUser;
      if (!fb) { location.href = 'feed.html'; return; }
      if (window._createHighlight) window._createHighlight(fb.uid, GF);
    }
    if (e.target.closest('[data-share-profile]')) {
      e.preventDefault();
      navigator.clipboard && navigator.clipboard.writeText(location.href).then(() => toast(typeof window.GHt==='function'?window.GHt('link_copied'):'Profile link copied'));
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

// profile-dead-button-fix-v5
document.addEventListener('click', function(e){
  if(e.target.closest('.empty-profile-state .btn[href="feed.html"], .empty-profile-state .btn[href="feed.html?compose=1"]')){
    e.preventDefault(); window.location.href='feed.html?compose=1';
  }
});
