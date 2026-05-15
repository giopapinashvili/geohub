(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const compact = (v) => Number(v || 0) >= 1000 ? (Number(v) / 1000).toFixed(Number(v) >= 10000 ? 0 : 1) + 'k' : String(Number(v || 0));

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
      createdAt: data.createdAt || data.joinedAt || null,
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
        xp: 0, followers: 0, following: 0, postsCount: 0, visitedPlaces: 0, trustScore: 0,
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
    const count = async q => {
      if (GF.fs.getCountFromServer) {
        const snap = await GF.fs.getCountFromServer(q);
        return snap.data().count || 0;
      }
      const snap = await GF.fs.getDocs(q);
      return snap.size || 0;
    };
    try {
      const [posts, friends, followers, following] = await Promise.all([
        count(GF.fs.query(GF.fs.collection(GF.db, 'posts'), GF.fs.where('authorId', '==', user.uid), GF.fs.limit(200))).catch(() => 0),
        count(GF.fs.query(GF.fs.collection(GF.db, 'friends'), GF.fs.where('users', 'array-contains', user.uid), GF.fs.limit(200))).catch(() => 0),
        count(GF.fs.query(GF.fs.collection(GF.db, 'follows'), GF.fs.where('followingId', '==', user.uid), GF.fs.limit(200))).catch(() => 0),
        count(GF.fs.query(GF.fs.collection(GF.db, 'follows'), GF.fs.where('followerId', '==', user.uid), GF.fs.limit(200))).catch(() => 0)
      ]);
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
    const av = $('.profile-avatar'); if (av) { av.src = user.avatar; av.alt = user.fullName; }
    const lvl = $('.avatar-level'); if (lvl) lvl.textContent = level(user);
    const name = $('.profile-name'); if (name) name.textContent = user.fullName;
    const handle = $('.profile-handle'); if (handle) handle.textContent = '@' + (user.username || 'user') + (user.city ? ' · ' + user.city : '');
    const bio = $('.profile-bio'); if (bio) bio.textContent = user.bio || 'No bio yet.';
    const badges = $('.trust-badges');
    if (badges) badges.innerHTML = '<span class="trust-badge green"><i class="fas fa-check-circle"></i> Real account</span><span class="trust-badge gold"><i class="fas fa-bolt"></i> ' + compact(user.xp) + ' XP</span><span class="trust-badge purple"><i class="fas fa-id-badge"></i> ' + esc(user.accountType) + '</span>';
    const own = fbUser && user.uid === fbUser.uid;
    const coverActions = $('.cover-actions');
    if (coverActions) coverActions.innerHTML = own ? '<button class="cover-btn" data-share-profile><i class="fas fa-share-alt"></i> Share</button><button class="cover-btn primary" data-edit-profile><i class="fas fa-pen"></i> Edit Profile</button>' : '<button class="cover-btn" data-share-profile><i class="fas fa-share-alt"></i> Share</button><button class="cover-btn primary" data-friend-user="' + esc(user.uid) + '"><i class="fas fa-user-plus"></i> Add Friend</button>';
    const actions = $('.profile-actions');
    if (actions) actions.innerHTML = own ? '<button class="btn btn-primary btn-sm" data-edit-profile><i class="fas fa-pen"></i> Edit Profile</button><button class="btn btn-ghost btn-sm" data-share-profile><i class="fas fa-share-alt"></i></button><button class="btn btn-ghost btn-sm" data-logout><i class="fas fa-right-from-bracket"></i> Logout</button>' : '<button class="btn btn-ghost btn-sm" data-message-user="' + esc(user.uid) + '"><i class="fas fa-envelope"></i> Message</button><button class="btn btn-primary btn-sm" data-friend-user="' + esc(user.uid) + '"><i class="fas fa-user-plus"></i> Add Friend</button><button class="btn btn-ghost btn-sm" data-follow-user="' + esc(user.uid) + '"><i class="fas fa-rss"></i> Follow</button><button class="btn btn-ghost btn-sm" data-report-user="' + esc(user.uid) + '"><i class="fas fa-flag"></i></button><button class="btn btn-ghost btn-sm" data-block-user="' + esc(user.uid) + '"><i class="fas fa-ban"></i></button>';
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
    renderStats(user);
    refreshRealStats(user);
    renderStaticEmptyStates(user);
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
    $$('[data-friend-user="' + uid + '"]').forEach(btn => {
      btn.dataset.friendState = status.state || 'none';
      btn.dataset.requestId = status.requestId || '';
      if (status.state === 'friends') {
        btn.classList.add('following');
        btn.innerHTML = '<i class="fas fa-user-check"></i> Friends';
      } else if (status.state === 'incoming') {
        btn.classList.add('following');
        btn.innerHTML = '<i class="fas fa-user-clock"></i> Respond';
      } else if (status.state === 'outgoing') {
        btn.classList.add('following');
        btn.innerHTML = '<i class="fas fa-clock"></i> Request sent';
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
    emptyTab('#tab-places', 'fa-map-marker-alt', 'No visited places yet', 'Check in to real places and they will appear here.', 'map.html', 'Explore Map');
    emptyTab('#tab-checkins', 'fa-location-dot', 'No check-ins yet', 'Real check-ins will appear here.', 'checkin.html', 'Check in');
    emptyTab('#tab-friends', 'fa-user-group', 'No friends yet', 'Friends and requests will appear here.', null, '');
    renderRewardsTab(user, fbUser);
    emptyTab('#tab-challenges', 'fa-trophy', 'No challenges yet', 'Real challenges will appear here when added by GeoHub.', null, '');
    emptyTab('#tab-reviews', 'fa-star', 'No reviews yet', 'Real reviews will appear here after you write them.', 'reviews.html', 'Write Review');
    renderBadgeTab(user);
    renderBusinessesTab(user);
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
              + (post.mediaUrl ? '<img src="' + esc(post.mediaUrl) + '" alt="Post" loading="lazy" decoding="async">'
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
      if (ownProfile && window.GeoSocial.listenFriendRequests) {
        window.GeoSocial.listenFriendRequests(requests => {
          const pending = requests.map(r => '<div class="gh-friend-card"><span class="gh-avatar">GH</span><div style="flex:1"><strong>Friend request</strong><span>From user: '+esc(r.fromUserId||r.fromId||'')+'</span><div class="gh-friend-request-actions"><button class="btn btn-primary btn-sm" data-accept-request="'+esc(r.id)+'">Accept</button><button class="btn btn-ghost btn-sm" data-reject-request="'+esc(r.id)+'">Reject</button></div></div></div>').join('');
          if (friendsTab && pending) friendsTab.dataset.pendingRequestsHtml = '<div style="font-weight:800;margin:0 0 10px">Friend Requests</div><div class="gh-friend-grid">'+pending+'</div><div style="height:18px"></div>';
        });
      }
      window.GeoSocial.listenFriends(user.uid, friends => {
        if (countEl) countEl.textContent = friends.length || '0';
        if (!friendsTab) return;
        const pendingHtml = friendsTab.dataset.pendingRequestsHtml || '';
        if (!friends.length && !pendingHtml) { friendsTab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-user-group"></i><h3>No friends yet</h3><p>Send friend requests from profiles.</p></div>'; return; }
        friendsTab.innerHTML = pendingHtml + (friends.length ? '<div style="font-weight:800;margin:0 0 10px">Friends</div><div class="gh-friend-grid">'+friends.map(f => '<a class="gh-friend-card" href="profile.html?id='+encodeURIComponent(f.uid||f.id)+'"><span class="gh-avatar">'+(f.avatar||f.photoURL ? '<img src="'+esc(f.avatar||f.photoURL)+'" alt="" loading="lazy" decoding="async">' : esc(initialLetters(f.fullName||f.displayName||f.name||'GeoHub User',f.email)))+'</span><div><strong>'+esc(f.fullName||f.displayName||f.name||'GeoHub User')+'</strong><span>@'+esc(f.username||'user')+'</span></div></a>').join('')+'</div>' : '');
      });
    }

    if (window.GeoSocial && window.GeoSocial.listenUserPosts) {
      window.GeoSocial.listenUserPosts(user.uid, posts => {
        const count = $('.ptab[data-tab="posts"] .tab-count'); if (count) count.textContent = posts.length || '0';
        if (!posts.length) return;
        const tab = $('#tab-posts');
        tab.innerHTML = '<div class="posts-grid">' + posts.map(post => '<div class="post-thumb">' + (post.mediaUrl ? '<img src="' + esc(post.mediaUrl) + '" alt="Post" loading="lazy" decoding="async">' : '<div style="background:var(--bg-elevated);width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1rem;padding:16px;box-sizing:border-box;text-align:center;color:var(--text-secondary)">' + esc(post.text || '') + '</div>') + '<div class="post-overlay"><span><i class="fas fa-heart"></i> ' + (post.likeCount || 0) + '</span><span><i class="fas fa-comment"></i> ' + (post.commentCount || 0) + '</span></div></div>').join('') + '</div>';
      });
    }
  }


  function renderRewardsTab(user, fbUser) {
    const tab = $('#tab-rewards');
    if (!tab) return;
    const GF = window.GeoFirebase;
    const own = fbUser && user.uid === fbUser.uid;
    const viewingUid = user.uid;

    // Header: balance + action buttons
    const bal = compact(user.pointsBalance || 0);
    let headerHtml = '<div class="rw-profile-bal">' +
      '<div>' +
        '<div class="rw-profile-bal-label"><i class="fas fa-coins" style="margin-right:5px;color:#10b981"></i>GeoPoints Balance</div>' +
        '<div class="rw-profile-bal-pts">' + esc(bal) + ' pts</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        (own
          ? '<button class="btn btn-ghost btn-sm" id="profSendPtsBtn" style="text-decoration:none" onclick="window.location.href=\'rewards.html\'"><i class="fas fa-coins"></i> Rewards Store</button>'
          : '<button class="btn btn-primary btn-sm" id="profSendPtsBtn"><i class="fas fa-paper-plane"></i> Send Points</button>') +
      '</div>' +
    '</div>';

    tab.innerHTML = headerHtml + '<div id="profTxList" style="margin-top:4px"><div style="color:var(--text-muted);font-size:.82rem;padding:12px 0;text-align:center"><i class="fas fa-spinner fa-spin"></i> Loading history…</div></div>';

    // Wire "Send Points" button on other user's profile
    if (!own) {
      const sendBtn = document.getElementById('profSendPtsBtn');
      if (sendBtn) {
        sendBtn.onclick = function () {
          window.location.href = 'rewards.html?to=' + encodeURIComponent(viewingUid);
        };
      }
    }

    if (!GF || !GF.db || !GF.fs || !fbUser) return;

    // Load transaction history (only for own profile — can't read other users' transactions)
    if (!own) {
      const txList = document.getElementById('profTxList');
      if (txList) txList.innerHTML = '<div style="color:var(--text-muted);font-size:.82rem;padding:12px 0">Transaction history is private.</div>';
      return;
    }

    const uid = fbUser.uid;
    Promise.all([
      GF.fs.getDocs(GF.fs.query(
        GF.fs.collection(GF.db, 'pointTransactions'),
        GF.fs.where('participantIds', 'array-contains', uid),
        GF.fs.limit(30)
      )).catch(() => ({ forEach: () => {} })),
      GF.fs.getDocs(GF.fs.query(
        GF.fs.collection(GF.db, 'userRewards'),
        GF.fs.where('userId', '==', uid),
        GF.fs.limit(20)
      )).catch(() => ({ forEach: () => {} }))
    ]).then(([txSnap, rwSnap]) => {
      const items = [];

      txSnap.forEach(d => {
        const data = d.data();
        const ms = typeof data.createdAt === 'object' && data.createdAt
          ? (typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : (data.createdAt.seconds || 0) * 1000)
          : (Number(data.createdAt) || 0);
        items.push({ ms, type: data.type || 'tx', amount: Number(data.amount || 0), fromId: data.fromUserId, toId: data.toUserId, msg: data.message || '', title: data.rewardTitle || '' });
      });
      rwSnap.forEach(d => {
        const data = d.data();
        const ms = typeof data.createdAt === 'object' && data.createdAt
          ? (typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : (data.createdAt.seconds || 0) * 1000)
          : (Number(data.createdAt) || 0);
        items.push({ ms, type: 'userReward', amount: Number(data.cost || 0), title: data.rewardTitle || 'Reward', status: data.status || '' });
      });

      items.sort((a, b) => b.ms - a.ms);

      const txList = document.getElementById('profTxList');
      if (!txList) return;

      if (!items.length) {
        txList.innerHTML = '<div class="empty-profile-state"><i class="fas fa-coins"></i><h3>No transactions yet</h3><p>Earn GeoPoints through check-ins, challenges, and community activity. Redeem them in the <a href="rewards.html" style="color:var(--green)">Rewards Store</a>.</p></div>';
        return;
      }

      const rows = items.map(item => {
        let iconClass, dir, label, amtHtml;
        if (item.type === 'gift') {
          const isSender = item.fromId === uid;
          iconClass = isSender ? 'sent' : 'gift';
          const icon = isSender ? 'fa-paper-plane' : 'fa-gift';
          label = isSender ? 'Sent points' + (item.msg ? ': ' + esc(item.msg.slice(0, 40)) : '') : 'Received points' + (item.msg ? ': ' + esc(item.msg.slice(0, 40)) : '');
          amtHtml = isSender
            ? '<div class="rw-history-amount neg">−' + compact(item.amount) + '</div>'
            : '<div class="rw-history-amount pos">+' + compact(item.amount) + '</div>';
          return '<div class="rw-history-item">' +
            '<div class="rw-history-icon ' + iconClass + '"><i class="fas ' + icon + '"></i></div>' +
            '<div class="rw-history-info"><div class="rw-history-title">' + label + '</div><div class="rw-history-meta">Transfer</div></div>' +
            amtHtml + '</div>';
        }
        if (item.type === 'redeem' || item.type === 'userReward') {
          return '<div class="rw-history-item">' +
            '<div class="rw-history-icon redeem"><i class="fas fa-ticket-alt"></i></div>' +
            '<div class="rw-history-info"><div class="rw-history-title">Redeemed: ' + esc(item.title || 'Reward') + '</div><div class="rw-history-meta">Redemption</div></div>' +
            '<div class="rw-history-amount neg">−' + compact(item.amount) + '</div></div>';
        }
        return '';
      }).filter(Boolean);

      txList.innerHTML = rows.length
        ? '<div class="rw-history-list">' + rows.join('') + '</div>'
        : '<div style="color:var(--text-muted);font-size:.82rem;padding:12px 0">No transaction history.</div>';
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

  function openEditProfileModal(){
    const currentName = $('.profile-name') ? $('.profile-name').textContent : '';
    const currentBio = $('.profile-bio') ? $('.profile-bio').textContent.replace('No bio yet.','') : '';
    const html = '<div class="gh-modal-backdrop" id="profileEditModal"><div class="gh-modal"><div class="gh-modal-head"><h3>Edit profile</h3><button class="gh-modal-close" data-close-profile-modal>✕</button></div><div class="gh-modal-body"><input class="gh-input" id="peName" placeholder="Full name" value="'+esc(currentName)+'"><div style="height:10px"></div><textarea class="gh-textarea" id="peBio" placeholder="Bio">'+esc(currentBio)+'</textarea><div style="height:10px"></div><select class="gh-select" id="peScope"><option value="all_georgia">Interested in all Georgia</option><option value="multi_city">Specific cities / regions</option></select><div style="height:10px"></div><input class="gh-input" id="peCities" placeholder="Cities/regions, e.g. Tbilisi, Batumi, Kazbegi"></div><div class="gh-modal-actions"><button class="btn btn-ghost btn-sm" data-close-profile-modal>Cancel</button><button class="btn btn-primary btn-sm" id="peSave">Save</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    const modal = $('#profileEditModal');
    modal.addEventListener('click', e => { if(e.target === modal || e.target.closest('[data-close-profile-modal]')) modal.remove(); });
    $('#peSave').onclick = async function(){
      const GF = window.GeoFirebase; const u = GF && GF.auth && GF.auth.currentUser; if(!u) return;
      const scope = $('#peScope').value;
      const cityText = $('#peCities').value.trim();
      const cities = scope === 'all_georgia' ? ['all_georgia'] : cityText.split(',').map(x=>x.trim()).filter(Boolean);
      try {
        await GF.fs.updateDoc(GF.fs.doc(GF.db,'users',u.uid), { fullName: $('#peName').value.trim(), displayName: $('#peName').value.trim(), bio: $('#peBio').value.trim(), cityScope: scope, city: scope === 'all_georgia' ? 'all_georgia' : (cities[0] || ''), cities: cities, updatedAt: GF.fs.serverTimestamp() });
        toast('Profile updated'); modal.remove(); location.reload();
      } catch(err){ toast('Profile update failed', 'error'); }
    };
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
        try {
          const profile = await findProfile(GF, fbUser);
          if (!profile) return userNotFound();
          renderIdentity(profile, fbUser);
          if (window.GeoSocial) renderTabs(profile, fbUser);
          else window.addEventListener('GeoSocialReady', () => renderTabs(profile, fbUser), { once: true });
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
      if (!window.GeoSocial || !target) return toast('Friends system is still loading', 'error');
      if (st === 'incoming') {
        const reqId = friendBtn.dataset.requestId;
        if (reqId) window.GeoSocial.respondFriendRequest(reqId, true, () => updateFriendButtons(target, { state: 'friends' }));
      } else if (st === 'friends') {
        if (confirm('Remove this friend?')) window.GeoSocial.removeFriend(target, () => updateFriendButtons(target, { state: 'none' }));
      } else if (st === 'outgoing') {
        toast('Friend request is already pending');
      } else {
        window.GeoSocial.sendFriendRequest(target, state => updateFriendButtons(target, { state: state || 'outgoing' }));
      }
    }
    const acceptBtn = e.target.closest('[data-accept-request]');
    if (acceptBtn && window.GeoSocial) { e.preventDefault(); window.GeoSocial.respondFriendRequest(acceptBtn.dataset.acceptRequest, true, () => location.reload()); }
    const rejectBtn = e.target.closest('[data-reject-request]');
    if (rejectBtn && window.GeoSocial) { e.preventDefault(); window.GeoSocial.respondFriendRequest(rejectBtn.dataset.rejectRequest, false, () => location.reload()); }

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
    const reportBtn = e.target.closest('[data-report-user]');
    if (reportBtn) {
      e.preventDefault();
      const target = reportBtn.dataset.reportUser;
      if (window.GeoSocial && window.GeoSocial.reportTarget) window.GeoSocial.reportTarget('user', target, 'Reported from profile');
    }
    const blockBtn = e.target.closest('[data-block-user]');
    if (blockBtn) {
      e.preventDefault();
      const target = blockBtn.dataset.blockUser;
      if (target && confirm('Block this user? Their posts will be hidden from your feed.')) {
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
