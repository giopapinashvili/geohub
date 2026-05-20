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
      initials
    };
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

    if (!uid && !username) return ensureOwnProfile(GF, fbUser);

    if (uid) {
      const snap = await GF.fs.getDoc(GF.fs.doc(GF.db, 'users', uid));
      if (!snap.exists()) return null;
      return normalizeProfile(null, Object.assign({ uid }, snap.data()));
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
    if (cover) cover.style.backgroundImage = user.coverImage ? `linear-gradient(180deg, rgba(4,5,13,0.08), rgba(4,5,13,0.72)), url('${user.coverImage}')` : 'linear-gradient(135deg, rgba(16,185,129,0.20), rgba(77,166,255,0.12), rgba(123,97,255,0.12))';
    const av = $('.profile-avatar'); if (av) { av.src = user.avatar; av.alt = user.fullName; av.onerror = function(){ this.onerror=null; this.src=initialsSvg(user.initials||'GH'); }; }
    const lvl = $('.avatar-level'); if (lvl) lvl.textContent = level(user);
    const name = $('.profile-name'); if (name) name.textContent = user.fullName;
    const handle = $('.profile-handle'); if (handle) handle.textContent = '@' + (user.username || 'user') + (user.city ? ' · ' + user.city : '');
    const bio = $('.profile-bio'); if (bio) bio.textContent = user.bio || 'No bio yet.';
    const badges = $('.trust-badges');
    if (badges) {
      var _badgeHtml = '<span class="trust-badge green"><i class="fas fa-check-circle"></i> Real account</span>';
      if (user.verified === true) _badgeHtml += '<span class="trust-badge blue"><i class="fas fa-circle-check"></i> Verified</span>';
      if (Number(user.xp) > 0) _badgeHtml += '<span class="trust-badge gold"><i class="fas fa-bolt"></i> ' + compact(user.xp) + ' XP</span>';
      badges.innerHTML = _badgeHtml;
    }
    const own = fbUser && user.uid === fbUser.uid;
    if (!own) {
      var _savedTabEl = document.querySelector('.ptab[data-tab="saved"]');
      if (_savedTabEl) _savedTabEl.style.display = 'none';
      var _savedPanelEl = document.getElementById('tab-saved');
      if (_savedPanelEl) _savedPanelEl.style.display = 'none';
    }
    const coverActions = $('.cover-actions');
    if (coverActions) coverActions.innerHTML = own
      ? '<button class="cover-btn" data-edit-cover><i class="fas fa-camera"></i> Edit Cover</button><button class="cover-btn" data-share-profile><i class="fas fa-share-alt"></i> Share</button><button class="cover-btn primary" data-edit-profile><i class="fas fa-pen"></i> Edit Profile</button>'
      : '<button class="cover-btn" data-share-profile><i class="fas fa-share-alt"></i> Share</button><button class="cover-btn primary" data-friend-user="' + esc(user.uid) + '"><i class="fas fa-user-plus"></i> Add Friend</button>';
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
    if (actions) actions.innerHTML = own ? '<button class="btn btn-primary btn-sm" data-edit-profile><i class="fas fa-pen"></i> Edit Profile</button><button class="btn btn-ghost btn-sm" data-share-profile><i class="fas fa-share-alt"></i> Share</button><button class="btn btn-ghost btn-sm profile-body-logout" data-logout><i class="fas fa-right-from-bracket"></i> Logout</button>' : '<button class="btn btn-ghost btn-sm" data-message-user="' + esc(user.uid) + '"><i class="fas fa-envelope"></i> Message</button><button class="btn btn-primary btn-sm" data-friend-user="' + esc(user.uid) + '"><i class="fas fa-user-plus"></i> Add Friend</button><button class="btn btn-ghost btn-sm" data-follow-user="' + esc(user.uid) + '"><i class="fas fa-rss"></i> Follow</button><button class="btn btn-ghost btn-sm" data-report-user="' + esc(user.uid) + '" data-user-name="' + esc(user.fullName) + '"><i class="fas fa-flag"></i></button><button class="btn btn-ghost btn-sm" data-mute-user="' + esc(user.uid) + '" data-user-name="' + esc(user.fullName) + '"><i class="fas fa-volume-mute"></i></button><button class="btn btn-ghost btn-sm" data-block-user="' + esc(user.uid) + '" data-user-name="' + esc(user.fullName) + '"><i class="fas fa-ban"></i></button>';
    if (!own && window.GeoSocial && window.GeoSocial.checkFollowing) {
      window.GeoSocial.checkFollowing(user.uid, isFollowing => {
        $$('[data-follow-user="' + user.uid + '"]').forEach(btn => {
          btn.classList.toggle('following', !!isFollowing);
          btn.innerHTML = isFollowing ? '<i class="fas fa-user-check"></i> Following' : '<i class="fas fa-user-plus"></i> Follow';
        });
      });
    }
    if (!own && window.GeoSocial && window.GeoSocial.listenFriendshipStatus) {
      window.GeoSocial.listenFriendshipStatus(user.uid, status => updateFriendButtons(user.uid, status));
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
    const l = level(user), xp = Number(user.xp || 0), inLvl = xp % 1000;
    const pill = $('.xp-level-pill'); if (pill) pill.innerHTML = '<i class="fas fa-bolt"></i> Level ' + l;
    const title = $('.xp-title-text'); if (title) title.textContent = user.explorerLevel || 'New Explorer';
    const fill = $('.xp-bar-fill'); if (fill) fill.style.width = Math.min(100, inLvl / 10) + '%';
    const nums = $('.xp-bar-numbers'); if (nums) nums.textContent = xp + ' / ' + (l * 1000) + ' XP';
    const next = $('.xp-to-next'); if (next) next.textContent = (1000 - inLvl) + ' XP to Level ' + (l + 1);
    const intro = $$('.intro-item');
    if (intro[0]) intro[0].innerHTML = '<i class="fas fa-map-marker-alt"></i> ' + (user.cityScope === 'all_georgia' ? 'Interested in all Georgia' : (user.city ? esc(user.city) : 'No location set'));
    if (intro[1]) intro[1].innerHTML = '<i class="fas fa-hiking"></i> ' + esc(user.accountType || 'Explorer');
    if (intro[2]) intro[2].innerHTML = '<i class="fas fa-calendar-alt"></i> Join date not set';
    if (intro[3]) intro[3].innerHTML = '<i class="fas fa-globe"></i> ' + (user.username ? 'geohub.ge/@' + esc(user.username) : 'No public username set');
    const lifestyle = $('.lifestyle-scores'); if (lifestyle) lifestyle.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:8px 0">Activity scores will appear after real check-ins and posts.</div>';
    const trustList = $('#trustItemsList');
    if (trustList) {
      var checkins = Number(user.checkinCount || user.checkinsCount || 0);
      var cameraProofs = Number(user.cameraProofs || user.cameraProofCount || 0);
      var phoneOk = !!user.phoneVerified;
      var idOk = !!user.idVerified;
      var cities = Number(user.citiesVisited || user.visitedCities || 0);
      trustList.innerHTML = [
        '<div class="trust-item ok"><i class="fas fa-check-circle"></i> Real account</div>',
        cameraProofs > 0 ? '<div class="trust-item ok"><i class="fas fa-camera"></i> ' + cameraProofs + ' camera proof' + (cameraProofs !== 1 ? 's' : '') + '</div>' : '<div class="trust-item warn"><i class="fas fa-camera"></i> No camera proofs yet</div>',
        checkins > 0 ? '<div class="trust-item ok"><i class="fas fa-map-marker-alt"></i> ' + checkins + ' real check-in' + (checkins !== 1 ? 's' : '') + '</div>' : '<div class="trust-item warn"><i class="fas fa-map-marker-alt"></i> No check-ins yet</div>',
        phoneOk ? '<div class="trust-item ok"><i class="fas fa-phone"></i> Phone verified</div>' : '<div class="trust-item warn"><i class="fas fa-phone"></i> Phone not verified</div>',
        idOk ? '<div class="trust-item ok"><i class="fas fa-id-card"></i> Identity verified</div>' : '<div class="trust-item warn"><i class="fas fa-id-card"></i> ID not verified yet</div>'
      ].join('');
      const citiesEl = document.getElementById('citiesVisited'); if (citiesEl) citiesEl.textContent = cities + ' cities';
    }
    const fav = $('.fav-cats'); if (fav) fav.innerHTML = user.interests.length ? user.interests.map(i => '<div class="fav-cat-chip">' + esc(i) + '</div>').join('') : '<div style="color:var(--text-muted);font-size:.85rem">No interests set yet</div>';
    ['spCitiesVal','spFriendsVal','spLikesVal','spGroupsVal'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0'; });
    const miniPts = $('.mini-wallet-pts'); if (miniPts) miniPts.textContent = compact(user.pointsBalance || 0) + ' pts';
    const miniSub = $('.mini-wallet-sub'); if (miniSub) miniSub.innerHTML = '<strong>' + compact(user.pointsBalance || 0) + ' pts</strong> earned · <a href="rewards.html" style="color:var(--green);text-decoration:none">Open store</a>';
    const review = $('#mostLikedReviewCard'); if (review) review.innerHTML = '<div class="sidebar-card-title">Most Helpful Review</div><div style="color:var(--text-muted);font-size:.85rem">No reviews yet</div>';
    const activity = $('.activity-feed .activity-feed-list'); if (activity) activity.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:12px 0">No real activity yet</div>';
    const thumbs = $('.followers-thumbs'); if (thumbs) thumbs.innerHTML = '';
    const ftxt = $('.followers-preview-text'); if (ftxt) ftxt.textContent = 'No followers yet';
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
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Add Friend';
      }
    });
  }

  function emptyTab(id, icon, title, text, href, cta) {
    const el = $(id); if (!el) return;
    el.innerHTML = '<div class="empty-profile-state"><i class="fas ' + icon + '"></i><h3>' + title + '</h3><p>' + text + '</p>' + (href ? '<a href="' + href + '" class="btn btn-primary btn-sm" style="margin-top:12px">' + cta + '</a>' : '') + '</div>';
  }

  function renderTabs(user, fbUser) {
    emptyTab('#tab-posts', 'fa-seedling', 'No posts yet', 'Real posts from Firestore will appear here.', 'feed.html?compose=1', 'Create Post');
    emptyTab('#tab-checkins', 'fa-location-dot', 'No check-ins yet', 'Real check-ins will appear here.', 'checkin.html', 'Check in');
    emptyTab('#tab-friends', 'fa-user-group', 'No friends yet', 'Friends and requests will appear here.', null, '');
    renderAboutTab(user);
    renderBadgeTab(user);
    renderBusinessesTab(user);
    loadCheckinsTab(user);
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
          friendsTab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-user-group"></i><h3>No friends yet</h3><p>Send friend requests from profiles.</p></div>';
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
      window.GeoSocial.listenUserPosts(user.uid, function(posts) {
        var count = $('.ptab[data-tab="posts"] .tab-count'); if (count) count.textContent = posts.length || '0';
        renderGalleryTab(posts);
        if (!posts.length) { emptyTab('#tab-posts', 'fa-seedling', 'No posts yet', 'Real posts from Firestore will appear here.', 'feed.html?compose=1', 'Create Post'); return; }
        var tab = $('#tab-posts');
        if (!tab) return;
        if (window.GeoSocialUI && window.GeoSocialUI.postCard && window.GeoSocialUI.bindPostInteractions) {
          // Use the full interactive post card from the social engine
          tab.innerHTML = '<div class="post-feed-list" id="profile-posts-list">' + posts.map(function(p) { return window.GeoSocialUI.postCard(p); }).join('') + '</div>';
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

  var BADGE_RARITY_COLOR = { common: '#94a3b8', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' };

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
    var tab = $('#tab-about'); if (!tab) return;
    var sl = user.socialLinks || {};
    var ICONS = { instagram:'fa-instagram', facebook:'fa-facebook', linkedin:'fa-linkedin', tiktok:'fa-tiktok', twitter:'fa-twitter', youtube:'fa-youtube' };
    var GF = window.GeoFirebase;
    var fbUser = GF && GF.auth && GF.auth.currentUser;
    var isOwn = fbUser && user.uid === fbUser.uid;

    var html = '<div class="about-card">';
    if (user.bio) html += '<div class="about-bio">' + esc(user.bio) + '</div>';
    html += '<div class="about-section-title">Location</div>';
    html += '<div class="about-item"><i class="fas fa-map-marker-alt"></i> ' + (user.cityScope === 'all_georgia' ? 'Interested in all Georgia' : esc(user.city || 'No location set')) + '</div>';
    if (user.hometown) html += '<div class="about-item"><i class="fas fa-home"></i> From ' + esc(user.hometown) + '</div>';
    if (user.currentCity) html += '<div class="about-item"><i class="fas fa-city"></i> Lives in ' + esc(user.currentCity) + '</div>';
    if (user.relationshipStatus) html += '<div class="about-item"><i class="fas fa-heart"></i> ' + esc(user.relationshipStatus) + '</div>';
    if (user.birthday) html += '<div class="about-item"><i class="fas fa-birthday-cake"></i> Birthday: ' + esc(user.birthday) + '</div>';
    if (user.website) html += '<div class="about-item"><i class="fas fa-globe"></i> <a href="' + esc(user.website) + '" target="_blank" rel="noopener noreferrer">' + esc(user.website) + '</a></div>';
    var joinYear = '';
    if (user.createdAt) {
      try {
        if (typeof user.createdAt.toDate === 'function') joinYear = user.createdAt.toDate().getFullYear();
        else if (user.createdAt.seconds) joinYear = new Date(user.createdAt.seconds * 1000).getFullYear();
        else if (typeof user.createdAt === 'number') joinYear = new Date(user.createdAt).getFullYear();
      } catch(e) {}
    }
    if (joinYear) html += '<div class="about-item"><i class="fas fa-calendar-alt"></i> Member since ' + joinYear + '</div>';

    // ── Work History ──
    html += '<div class="about-section-title">Work' + (isOwn ? '<button class="about-add-btn" data-work-add>+ Add</button>' : '') + '</div>';
    var work = Array.isArray(user.work) ? user.work : [];
    if (work.length) {
      work.forEach(function(w, idx) {
        html += '<div class="about-item about-work-item" data-work-idx="' + idx + '">'
          + '<i class="fas fa-briefcase" style="color:#10b981"></i> '
          + '<div style="flex:1"><strong>' + esc(w.position || 'Employee') + '</strong> at <strong>' + esc(w.company || '') + '</strong>'
          + (w.from ? '<div style="font-size:.75rem;color:var(--gh-muted,#64748b);margin-top:2px">' + esc(w.from) + ' – ' + (w.current ? 'Present' : esc(w.to || '')) + '</div>' : '')
          + '</div>'
          + (isOwn ? '<button class="about-edit-btn" data-work-edit="' + idx + '" title="Edit"><i class="fas fa-pen"></i></button>' : '')
          + '</div>';
      });
    } else {
      html += '<div class="about-item" style="color:var(--gh-muted,#64748b)"><i class="fas fa-briefcase"></i> ' + (isOwn ? 'Add your work history' : 'No work info') + '</div>';
    }

    // ── Education ──
    html += '<div class="about-section-title">Education' + (isOwn ? '<button class="about-add-btn" data-edu-add>+ Add</button>' : '') + '</div>';
    var edu = Array.isArray(user.education) ? user.education : [];
    if (edu.length) {
      edu.forEach(function(e, idx) {
        html += '<div class="about-item about-edu-item" data-edu-idx="' + idx + '">'
          + '<i class="fas fa-graduation-cap" style="color:#3b82f6"></i> '
          + '<div style="flex:1"><strong>' + esc(e.school || '') + '</strong>'
          + (e.degree ? ' · ' + esc(e.degree) : '')
          + (e.from ? '<div style="font-size:.75rem;color:var(--gh-muted,#64748b);margin-top:2px">' + esc(e.from) + ' – ' + esc(e.to || 'Present') + '</div>' : '')
          + '</div>'
          + (isOwn ? '<button class="about-edit-btn" data-edu-edit="' + idx + '" title="Edit"><i class="fas fa-pen"></i></button>' : '')
          + '</div>';
      });
    } else {
      html += '<div class="about-item" style="color:var(--gh-muted,#64748b)"><i class="fas fa-graduation-cap"></i> ' + (isOwn ? 'Add your education' : 'No education info') + '</div>';
    }

    // ── Languages ──
    if (Array.isArray(user.languages) && user.languages.length) {
      html += '<div class="about-section-title">Languages</div>';
      html += '<div class="about-interests">' + user.languages.map(function(l) { return '<span class="about-interest-chip">' + esc(l) + '</span>'; }).join('') + '</div>';
    }

    if (user.interests && user.interests.length) {
      html += '<div class="about-section-title">Interests</div>';
      html += '<div class="about-interests">' + user.interests.map(function(i) { return '<span class="about-interest-chip">' + esc(i) + '</span>'; }).join('') + '</div>';
    }
    var links = Object.entries(sl).filter(function(e) { return !!e[1]; });
    if (links.length) {
      html += '<div class="about-section-title">Social Links</div>';
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

    // Auto-generate events from work/education
    var events = [];
    (Array.isArray(user.work) ? user.work : []).forEach(function(w) {
      if (w.from && w.company) events.push({ type: 'work', year: w.from, label: 'Started working at ' + w.company, icon: 'fa-briefcase', color: '#10b981' });
    });
    (Array.isArray(user.education) ? user.education : []).forEach(function(e) {
      if (e.to && e.school) events.push({ type: 'edu', year: e.to, label: 'Graduated from ' + e.school, icon: 'fa-graduation-cap', color: '#3b82f6' });
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
    var work = Array.isArray(user.work) ? user.work : [];
    var entry = idx >= 0 ? (work[idx] || {}) : {};
    var isNew = idx < 0;
    var old = document.getElementById('gh-work-modal'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'gh-work-modal';
    ov.className = 'profile-edit-overlay';
    ov.innerHTML = '<div class="profile-edit-sheet" style="max-width:500px">'
      + '<div class="profile-edit-head"><h3>' + (isNew ? 'Add Work' : 'Edit Work') + '</h3><button class="profile-edit-close" id="gwClose"><i class="fas fa-times"></i></button></div>'
      + '<div class="profile-edit-body">'
      + '<div class="profile-edit-field"><label>Company</label><input class="profile-edit-input" id="gwCompany" placeholder="Company name" value="' + esc(entry.company || '') + '"></div>'
      + '<div class="profile-edit-field"><label>Position / Title</label><input class="profile-edit-input" id="gwPosition" placeholder="Software Engineer" value="' + esc(entry.position || '') + '"></div>'
      + '<div class="profile-edit-field"><label>From (year)</label><input class="profile-edit-input" id="gwFrom" placeholder="2020" value="' + esc(entry.from || '') + '"></div>'
      + '<div class="profile-edit-field"><label>To (year or leave blank)</label><input class="profile-edit-input" id="gwTo" placeholder="2023 or leave blank for current" value="' + esc(entry.to || '') + '"></div>'
      + '<div class="profile-edit-field"><label><input type="checkbox" id="gwCurrent"' + (entry.current ? ' checked' : '') + '> Currently work here</label></div>'
      + (idx >= 0 ? '<div style="margin-top:8px"><button class="btn btn-ghost btn-sm" id="gwDelete" style="color:#f87171"><i class="fas fa-trash"></i> Remove</button></div>' : '')
      + '</div>'
      + '<div class="profile-edit-footer"><button class="btn btn-ghost btn-sm" id="gwCancel">Cancel</button><button class="btn btn-primary btn-sm" id="gwSave"><i class="fas fa-check"></i> Save</button></div>'
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
      if (!newEntry.company) { toast('Company name is required.', 'error'); return; }
      var newWork = work.slice();
      if (isNew) newWork.push(newEntry);
      else newWork[idx] = newEntry;
      var GF = window.GeoFirebase;
      var fbUser = GF && GF.auth && GF.auth.currentUser;
      if (!GF || !GF.db || !GF.fs || !fbUser) { toast('Not signed in.', 'error'); return; }
      GF.fs.updateDoc(GF.fs.doc(GF.db, 'users', fbUser.uid), { work: newWork }).then(function() {
        toast('Work history saved.');
        user.work = newWork;
        renderAboutTab(user);
        ov.remove();
      }).catch(function(err) { toast('Save failed: ' + (err && err.message), 'error'); });
    }

    ov.querySelector('#gwSave').addEventListener('click', saveWork);
    var delBtn = ov.querySelector('#gwDelete');
    if (delBtn) {
      delBtn.addEventListener('click', function() {
        if (!confirm('Remove this work entry?')) return;
        var newWork = work.filter(function(_, i) { return i !== idx; });
        var GF = window.GeoFirebase;
        var fbUser = GF && GF.auth && GF.auth.currentUser;
        if (!GF || !GF.db || !GF.fs || !fbUser) return;
        GF.fs.updateDoc(GF.fs.doc(GF.db, 'users', fbUser.uid), { work: newWork }).then(function() {
          toast('Work entry removed.');
          user.work = newWork;
          renderAboutTab(user);
          ov.remove();
        }).catch(function(err) { toast('Remove failed: ' + (err && err.message), 'error'); });
      });
    }
  }

  function openEduModal(user, idx) {
    var edu = Array.isArray(user.education) ? user.education : [];
    var entry = idx >= 0 ? (edu[idx] || {}) : {};
    var isNew = idx < 0;
    var old = document.getElementById('gh-edu-modal'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'gh-edu-modal';
    ov.className = 'profile-edit-overlay';
    ov.innerHTML = '<div class="profile-edit-sheet" style="max-width:500px">'
      + '<div class="profile-edit-head"><h3>' + (isNew ? 'Add Education' : 'Edit Education') + '</h3><button class="profile-edit-close" id="geClose"><i class="fas fa-times"></i></button></div>'
      + '<div class="profile-edit-body">'
      + '<div class="profile-edit-field"><label>School / University</label><input class="profile-edit-input" id="geSchool" placeholder="University name" value="' + esc(entry.school || '') + '"></div>'
      + '<div class="profile-edit-field"><label>Degree</label><input class="profile-edit-input" id="geDegree" placeholder="Bachelor\'s, Master\'s…" value="' + esc(entry.degree || '') + '"></div>'
      + '<div class="profile-edit-field"><label>From (year)</label><input class="profile-edit-input" id="geFrom" placeholder="2018" value="' + esc(entry.from || '') + '"></div>'
      + '<div class="profile-edit-field"><label>To (year)</label><input class="profile-edit-input" id="geTo" placeholder="2022" value="' + esc(entry.to || '') + '"></div>'
      + (idx >= 0 ? '<div style="margin-top:8px"><button class="btn btn-ghost btn-sm" id="geDelete" style="color:#f87171"><i class="fas fa-trash"></i> Remove</button></div>' : '')
      + '</div>'
      + '<div class="profile-edit-footer"><button class="btn btn-ghost btn-sm" id="geCancel">Cancel</button><button class="btn btn-primary btn-sm" id="geSave"><i class="fas fa-check"></i> Save</button></div>'
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
      if (!newEntry.school) { toast('School name is required.', 'error'); return; }
      var newEdu = edu.slice();
      if (isNew) newEdu.push(newEntry);
      else newEdu[idx] = newEntry;
      var GF = window.GeoFirebase;
      var fbUser = GF && GF.auth && GF.auth.currentUser;
      if (!GF || !GF.db || !GF.fs || !fbUser) { toast('Not signed in.', 'error'); return; }
      GF.fs.updateDoc(GF.fs.doc(GF.db, 'users', fbUser.uid), { education: newEdu }).then(function() {
        toast('Education saved.');
        user.education = newEdu;
        renderAboutTab(user);
        ov.remove();
      }).catch(function(err) { toast('Save failed: ' + (err && err.message), 'error'); });
    }

    ov.querySelector('#geSave').addEventListener('click', saveEdu);
    var delBtn = ov.querySelector('#geDelete');
    if (delBtn) {
      delBtn.addEventListener('click', function() {
        if (!confirm('Remove this education entry?')) return;
        var newEdu = edu.filter(function(_, i) { return i !== idx; });
        var GF = window.GeoFirebase;
        var fbUser = GF && GF.auth && GF.auth.currentUser;
        if (!GF || !GF.db || !GF.fs || !fbUser) return;
        GF.fs.updateDoc(GF.fs.doc(GF.db, 'users', fbUser.uid), { education: newEdu }).then(function() {
          toast('Education entry removed.');
          user.education = newEdu;
          renderAboutTab(user);
          ov.remove();
        }).catch(function(err) { toast('Remove failed: ' + (err && err.message), 'error'); });
      });
    }
  }

  function openLifeEventModal(user) {
    var old = document.getElementById('gh-life-event-modal'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'gh-life-event-modal';
    ov.className = 'profile-edit-overlay';
    ov.innerHTML = '<div class="profile-edit-sheet" style="max-width:480px">'
      + '<div class="profile-edit-head"><h3>Add Life Event</h3><button class="profile-edit-close" id="gleClose"><i class="fas fa-times"></i></button></div>'
      + '<div class="profile-edit-body">'
      + '<div class="profile-edit-field"><label>Event Description</label><input class="profile-edit-input" id="gleLabel" placeholder="e.g. Moved to Tbilisi, Started a new chapter…"></div>'
      + '<div class="profile-edit-field"><label>Year</label><input class="profile-edit-input" id="gleYear" placeholder="2023" type="number" min="1900" max="2099"></div>'
      + '<div class="profile-edit-field"><label>Icon</label><select class="profile-edit-input" id="gleIcon"><option value="fa-star">⭐ Milestone</option><option value="fa-map-marker-alt">📍 Moved</option><option value="fa-heart">❤️ Relationship</option><option value="fa-baby">👶 New family</option><option value="fa-plane">✈️ Travel</option><option value="fa-trophy">🏆 Achievement</option></select></div>'
      + '</div>'
      + '<div class="profile-edit-footer"><button class="btn btn-ghost btn-sm" id="gleCancel">Cancel</button><button class="btn btn-primary btn-sm" id="gleSave"><i class="fas fa-check"></i> Add Event</button></div>'
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
      if (!label) { toast('Please describe the event.', 'error'); return; }
      var GF = window.GeoFirebase;
      var fbUser = GF && GF.auth && GF.auth.currentUser;
      if (!GF || !GF.db || !GF.fs || !fbUser) { toast('Not signed in.', 'error'); return; }
      GF.fs.addDoc(GF.fs.collection(GF.db, 'users', fbUser.uid, 'lifeEvents'), {
        label: label, year: year, icon: icon, createdAt: GF.fs.serverTimestamp()
      }).then(function() {
        toast('Life event added!');
        renderAboutTab(user);
        ov.remove();
      }).catch(function(err) { toast('Save failed: ' + (err && err.message), 'error'); });
    });
  }

  function maybeShowCompletionHint(user) {
    var old = document.getElementById('profile-completion-hint');
    if (old) old.remove();
    var missing = [];
    if (!user.bio) missing.push('bio');
    if (!user.avatar || user.avatar.indexOf('data:') === 0) missing.push('profile photo');
    if (!user.interests || !user.interests.length) missing.push('interests');
    if (!missing.length) return;
    var hint = document.createElement('div');
    hint.id = 'profile-completion-hint';
    hint.className = 'profile-completion-hint';
    hint.innerHTML = '<i class="fas fa-circle-info"></i> Complete your profile — add your '
      + missing.join(', ')
      + '. <button class="hint-edit-btn" data-edit-profile><i class="fas fa-pen"></i> Edit Profile</button>'
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
    if (!GS || !GS.sendPoints) { alert('Points system is still loading. Try again in a moment.'); return; }
    var raw = (prompt('Send GeoPoints to ' + esc(targetName) + ':\nEnter amount (1–500):') || '').trim();
    if (!raw) return;
    if (!/^\d+$/.test(raw)) { alert('Enter a whole number between 1 and 500.'); return; }
    var amount = parseInt(raw, 10);
    if (amount <= 0 || amount > 500) { alert('Enter a number between 1 and 500.'); return; }
    GS.sendPoints(targetUid, amount, 'Support for creator ' + targetName);
  };

  window._activateCreatorMode = function () {
    var fb = window.GeoFirebase;
    if (!fb || !fb.auth || !fb.db || !fb.fs) { alert('Loading — please try again.'); return; }
    var u = fb.auth.currentUser;
    if (!u) { window.location.href = 'auth.html'; return; }
    if (!confirm('Activate Creator Mode? Your profile will be listed on the Creators page.')) return;
    fb.fs.updateDoc(fb.fs.doc(fb.db, 'users', u.uid), { accountType: 'creator' })
      .then(function () { window.location.reload(); })
      .catch(function (err) { alert('Could not activate: ' + (err && err.message || 'unknown error')); });
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
    const currentCityScope = u.cityScope || 'all_georgia';
    const currentCities   = Array.isArray(u.cities) ? u.cities.filter(c => c !== 'all_georgia').join(', ') : '';
    const currentWebsite  = u.website || '';
    const sl = u.socialLinks || {};
    const currentInterests = Array.isArray(u.interests) ? u.interests : [];

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
      + '<div class="profile-edit-field"><label>Username</label><input class="profile-edit-input" id="peUsername" placeholder="your_username" value="' + esc(currentUsername) + '"></div>'
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
      saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving…';

      const scope    = document.getElementById('peScope').value;
      const cityText = (document.getElementById('peCities') ? document.getElementById('peCities').value : '').trim();
      const cities   = scope === 'all_georgia' ? ['all_georgia'] : cityText.split(',').map(function(x){ return x.trim(); }).filter(Boolean);

      const selectedInterests = [];
      overlay.querySelectorAll('.interest-chip.selected').forEach(function(el) { selectedInterests.push(el.dataset.interest); });

      const updates = {
        fullName:    (document.getElementById('peName').value || '').trim(),
        displayName: (document.getElementById('peName').value || '').trim(),
        username:    (document.getElementById('peUsername').value || '').trim().toLowerCase().replace(/[^a-z0-9_.]/g,''),
        bio:         (document.getElementById('peBio').value || '').trim(),
        cityScope:   scope,
        city:        scope === 'all_georgia' ? 'all_georgia' : (cities[0] || ''),
        cities:      cities,
        website:     (document.getElementById('peWebsite').value || '').trim(),
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
        if ('bio' in updates) { const bioEl = $('.profile-bio'); if (bioEl) bioEl.textContent = updates.bio || 'No bio yet.'; }
        if (updates.username || updates.city) { const hnd = $('.profile-handle'); if (hnd) hnd.textContent = '@' + (updates.username || (window.GeoCurrentUser && window.GeoCurrentUser.username) || 'user') + (updates.city && updates.city !== 'all_georgia' ? ' · ' + updates.city : ''); }
        toast('Profile saved');
      } catch (err) {
        toast('Save failed: ' + (err && err.message ? err.message : 'Unknown error'), 'error');
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

  function showPrivateProfileGate(name) {
    $$('#profileTabs, .profile-tabs, .profile-sidebar, .tab-panel').forEach(el => { el.style.display = 'none'; });
    $$('[data-follow-user],[data-friend-user],[data-message-user]').forEach(el => { el.style.display = 'none'; });
    const main = $('.profile-layout') || document.body;
    const gate = document.createElement('div');
    gate.className = 'private-profile-gate';
    gate.innerHTML = '<i class="fas fa-lock"></i><h3>This profile is private</h3><p>' + (name ? name + ' only shares' : 'This account only shares') + ' their profile with friends.</p>';
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
          if (!isOwnProfile && privPref === 'friends') {
            const fid = [fbUser.uid, profile.uid].sort().join('_');
            const [fSnap, legacySnap] = await Promise.all([
              GF.fs.getDoc(GF.fs.doc(GF.db, 'friends', fid)).catch(() => null),
              GF.fs.getDoc(GF.fs.doc(GF.db, 'friendships', fid)).catch(() => null)
            ]);
            if ((!fSnap || !fSnap.exists()) && (!legacySnap || !legacySnap.exists())) {
              showPrivateProfileGate(profile.fullName);
              return;
            }
          }
          if (window.GeoSocial) renderTabs(profile, fbUser);
          else window.addEventListener('GeoSocialReady', () => renderTabs(profile, fbUser), { once: true });

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
    const followBtn = e.target.closest('[data-follow-user]');
    if (followBtn) {
      e.preventDefault();
      const target = followBtn.dataset.followUser;
      if (!window.GeoSocial || !target) return toast('Social system is still loading', 'error');
      window.GeoSocial.toggleFollow(target, isFollowing => {
        $$('[data-follow-user="' + target + '"]').forEach(btn => {
          btn.classList.toggle('following', !!isFollowing);
          btn.innerHTML = isFollowing ? '<i class="fas fa-user-check"></i> Following' : '<i class="fas fa-user-plus"></i> Follow';
        });
      });
    }
    const friendBtn = e.target.closest('[data-friend-user]');
    if (friendBtn) {
      e.preventDefault();
      const target = friendBtn.dataset.friendUser;
      const st = friendBtn.dataset.friendState || 'none';
      if (!window.GeoSocial) { toast('Friends system is still loading', 'error'); return; }
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
        friendBtn.parentElement.style.position = 'relative';
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
        // Optimistic: immediately show Cancel Request; revert only on hard error
        friendBtn.disabled = true;
        updateFriendButtons(target, { state: 'outgoing' });
        window.GeoSocial.sendFriendRequest(target, function(state) {
          $$('[data-friend-user="' + target + '"]').forEach(function(b){ b.disabled = false; });
          if (state === 'error') {
            updateFriendButtons(target, { state: 'none' });
          } else {
            updateFriendButtons(target, { state: state === 'pending' ? 'outgoing' : (state || 'outgoing') });
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
      if (!window.GeoSocial || !target) return toast('Messages are still loading', 'error');
      window.GeoSocial.startConversation(target, () => { location.href = 'messages.html?with=' + encodeURIComponent(target); });
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
          if (!url) { toast('Upload failed', 'error'); return; }
          await GF2.fs.updateDoc(GF2.fs.doc(GF2.db, 'users', fbU.uid), { avatar: url, updatedAt: GF2.fs.serverTimestamp() });
          var avEl = $('.profile-avatar'); if (avEl) avEl.src = url;
          $$('.gh-avatar-img,.nav-avatar,[data-nav-avatar]').forEach(function(el){ el.src = url; });
          if (window.GeoCurrentUser) window.GeoCurrentUser.avatar = url;
          toast('Profile photo updated');
        } catch(err) { toast('Photo update failed', 'error'); }
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
          if (!url) { toast('Upload failed', 'error'); return; }
          await GF2.fs.updateDoc(GF2.fs.doc(GF2.db, 'users', fbU.uid), { coverImage: url, updatedAt: GF2.fs.serverTimestamp() });
          var coverEl = $('.profile-cover');
          if (coverEl) coverEl.style.backgroundImage = 'linear-gradient(180deg,rgba(4,5,13,0.08),rgba(4,5,13,0.72)),url(\'' + url + '\')';
          if (window.GeoCurrentUser) window.GeoCurrentUser.coverImage = url;
          toast('Cover photo updated');
        } catch(err) { toast('Cover update failed', 'error'); }
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
      } else if (target && confirm('Block this user? Their posts will be hidden from your feed.')) {
        if (window.GeoSocial && window.GeoSocial.blockUser) window.GeoSocial.blockUser(target, () => { location.href='feed.html'; });
      }
    }
    if (e.target.closest('[data-add-highlight]')) {
      e.preventDefault();
      location.href = 'feed.html';
    }
    if (e.target.closest('[data-share-profile]')) {
      e.preventDefault();
      navigator.clipboard && navigator.clipboard.writeText(location.href).then(() => toast('Profile link copied'));
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

// profile-dead-button-fix-v5
document.addEventListener('click', function(e){
  if(e.target.closest('[data-add-highlight], .highlight-add, .empty-profile-state .btn[href="feed.html"], .empty-profile-state .btn[href="feed.html?compose=1"]')){
    e.preventDefault(); window.location.href='feed.html?compose=1';
  }
});
