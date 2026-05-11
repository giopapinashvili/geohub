(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const compact = (v) => Number(v || 0) >= 1000 ? (Number(v) / 1000).toFixed(Number(v) >= 10000 ? 0 : 1) + 'k' : String(Number(v || 0));
  const tsToDate = (v) => {
    if (!v) return '';
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v.toMillis === 'function') return new Date(v.toMillis());
    if (v.seconds) return new Date(v.seconds * 1000);
    if (typeof v === 'number') return new Date(v);
    const d = new Date(v); return isNaN(d) ? '' : d;
  };
  const fmtDate = (v) => {
    const d = tsToDate(v); if (!d) return '';
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  function toast(msg, type) {
    if (window.GeoSocial && window.GeoSocial.toast) return window.GeoSocial.toast(msg, type);
    alert(msg);
  }

  function currentFbUser() {
    return window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser;
  }

  function defaultProfile(fbUser, data) {
    data = data || {};
    const email = data.email || (fbUser && fbUser.email) || '';
    const seed = ((data.username || email || (fbUser && fbUser.uid) || 'geohub-user') + '').replace(/\W/g, '') || 'geohubuser';
    return {
      id: data.uid || (fbUser && fbUser.uid) || data.id || '',
      uid: data.uid || (fbUser && fbUser.uid) || data.id || '',
      fullName: data.fullName || data.displayName || (fbUser && fbUser.displayName) || (email ? email.split('@')[0] : 'GeoHub User'),
      username: data.username || (email ? email.split('@')[0].replace(/[^a-z0-9_.]/gi, '.').toLowerCase() : ''),
      email,
      avatar: data.avatar || data.photoURL || (fbUser && fbUser.photoURL) || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(seed)),
      coverImage: data.coverImage || '',
      bio: data.bio || '',
      city: data.city || '',
      accountType: data.accountType || 'Explorer',
      explorerLevel: data.explorerLevel || 'New Explorer',
      xp: Number(data.xp || 0),
      rank: Number(data.rank || 0),
      badges: Array.isArray(data.badges) ? data.badges : [],
      interests: Array.isArray(data.interests) ? data.interests : [],
      followers: Number(data.followers || 0),
      following: Number(data.following || 0),
      postsCount: Number(data.postsCount || 0),
      visitedPlaces: Number(data.visitedPlaces || 0),
      trustScore: Number(data.trustScore || 0),
      createdAt: data.createdAt || data.joinedAt || null,
      isReal: true
    };
  }

  function setLoading() {
    const n = $('.profile-name'); if (n) n.textContent = 'Loading profile…';
    const h = $('.profile-handle'); if (h) h.textContent = '';
    const b = $('.profile-bio'); if (b) b.textContent = '';
  }

  function userNotFound() {
    document.title = 'User not found — GeoHub';
    const main = $('.profile-layout') || document.body;
    main.innerHTML = '<div class="empty-profile-state" style="max-width:720px;margin:120px auto;text-align:center"><i class="fas fa-user-slash"></i><h2>User not found</h2><p>This profile does not exist or was removed.</p><a class="btn btn-primary btn-sm" href="feed.html">Back to Feed</a></div>';
  }

  function ensureUserDoc(fbUser) {
    const GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs || !fbUser) return Promise.resolve(defaultProfile(fbUser, {}));
    const ref = GF.fs.doc(GF.db, 'users', fbUser.uid);
    return GF.fs.getDoc(ref).then(snap => {
      const base = defaultProfile(fbUser, snap.exists() ? snap.data() : {});
      if (!snap.exists()) {
        return GF.fs.setDoc(ref, {
          uid: fbUser.uid,
          fullName: base.fullName,
          username: base.username,
          email: base.email,
          avatar: base.avatar,
          bio: '', city: '', accountType: 'Explorer', interests: [],
          xp: 0, followers: 0, following: 0, postsCount: 0, visitedPlaces: 0, trustScore: 0,
          createdAt: GF.fs.serverTimestamp()
        }, { merge: true }).then(() => base).catch(() => base);
      }
      return base;
    });
  }

  function loadProfile() {
    setLoading();
    const params = new URLSearchParams(location.search);
    const uidParam = params.get('uid');
    const usernameParam = params.get('user') || (location.pathname.match(/@([^/?#]+)/) || [])[1];
    const GF = window.GeoFirebase;
    const fbUser = currentFbUser();

    if (!GF || !GF.db || !GF.fs) {
      if (fbUser) return Promise.resolve(defaultProfile(fbUser, {}));
      location.replace('auth.html');
      return Promise.resolve(null);
    }

    if (!uidParam && !usernameParam) {
      if (!fbUser) { location.replace('auth.html'); return Promise.resolve(null); }
      return ensureUserDoc(fbUser);
    }

    if (uidParam) {
      return GF.fs.getDoc(GF.fs.doc(GF.db, 'users', uidParam)).then(snap => {
        if (!snap.exists()) return null;
        return defaultProfile(null, Object.assign({ uid: uidParam }, snap.data()));
      });
    }

    const q = GF.fs.query(GF.fs.collection(GF.db, 'users'), GF.fs.where('username', '==', usernameParam), GF.fs.limit(1));
    return GF.fs.getDocs(q).then(snap => {
      if (snap.empty) return null;
      const d = snap.docs[0];
      return defaultProfile(null, Object.assign({ uid: d.id }, d.data()));
    });
  }

  function isOwnProfile(user) {
    const fb = currentFbUser();
    return !!(fb && user && user.uid && fb.uid === user.uid);
  }

  function level(user) { return Math.max(1, Math.floor(Number(user.xp || 0) / 1000) + 1); }

  function renderStats(user) {
    const values = [user.visitedPlaces, 0, compact(user.followers), compact(user.following), compact(Math.floor(user.xp / 10)), user.trustScore];
    $$('.profile-stats-bar .pstat-value').forEach((el, i) => el.textContent = values[i] || '0');
    $$('.ptab .tab-count').forEach(c => {
      const t = c.closest('.ptab') && c.closest('.ptab').dataset.tab;
      if (t === 'posts') c.textContent = '0';
      if (t === 'places') c.textContent = user.visitedPlaces || 0;
      if (t === 'checkins') c.textContent = '0';
      if (t === 'reviews') c.textContent = '0';
    });
  }

  function renderIdentity(user) {
    document.title = user.fullName + ' — GeoHub';
    const cover = $('.profile-cover');
    if (cover) {
      cover.classList.add('dynamic-cover');
      cover.style.backgroundImage = user.coverImage
        ? "linear-gradient(180deg, rgba(4,5,13,0.08), rgba(4,5,13,0.72)), url('" + user.coverImage + "')"
        : 'linear-gradient(135deg, rgba(16,185,129,0.20), rgba(77,166,255,0.12), rgba(123,97,255,0.12))';
    }
    const av = $('.profile-avatar'); if (av) { av.src = user.avatar; av.alt = user.fullName; }
    const lvl = $('.avatar-level'); if (lvl) lvl.textContent = level(user);
    const name = $('.profile-name'); if (name) name.textContent = user.fullName;
    const handle = $('.profile-handle'); if (handle) handle.textContent = '@' + (user.username || 'user') + (user.city ? ' · ' + user.city : '');
    const bio = $('.profile-bio'); if (bio) bio.textContent = user.bio || 'No bio yet.';
    const badges = $('.trust-badges');
    if (badges) badges.innerHTML = [
      '<span class="trust-badge green"><i class="fas fa-check-circle"></i> Real account</span>',
      '<span class="trust-badge gold"><i class="fas fa-bolt"></i> ' + compact(user.xp) + ' XP</span>',
      '<span class="trust-badge purple"><i class="fas fa-id-badge"></i> ' + esc(user.accountType) + '</span>'
    ].join('');

    const own = isOwnProfile(user);
    const coverActions = $('.cover-actions');
    if (coverActions) coverActions.innerHTML = own
      ? '<button class="cover-btn" data-share-profile><i class="fas fa-share-alt"></i> Share</button><button class="cover-btn primary" data-edit-profile><i class="fas fa-pen"></i> Edit Profile</button>'
      : '<button class="cover-btn" data-share-profile><i class="fas fa-share-alt"></i> Share</button><button class="cover-btn primary" data-follow-user="' + esc(user.uid) + '"><i class="fas fa-user-plus"></i> Follow</button>';
    const actions = $('.profile-actions');
    if (actions) actions.innerHTML = own
      ? '<button class="btn btn-primary btn-sm" data-edit-profile><i class="fas fa-pen"></i> Edit Profile</button><button class="btn btn-ghost btn-sm" data-share-profile><i class="fas fa-share-alt"></i></button><a href="lifegraph.html" class="btn btn-ghost btn-sm" style="text-decoration:none"><i class="fas fa-chart-line"></i> Life Graph</a>'
      : '<button class="btn btn-ghost btn-sm"><i class="fas fa-envelope"></i></button><button class="btn btn-primary btn-sm" data-follow-user="' + esc(user.uid) + '"><i class="fas fa-user-plus"></i> Follow</button>';

    renderStats(user);
    renderXp(user);
    renderIntro(user);
    renderSidebar(user);
    renderHighlights();
  }

  function renderXp(user) {
    const l = level(user), xp = Number(user.xp || 0), inLvl = xp % 1000;
    const pill = $('.xp-level-pill'); if (pill) pill.innerHTML = '<i class="fas fa-bolt"></i> Level ' + l;
    const title = $('.xp-title-text'); if (title) title.textContent = user.explorerLevel || 'New Explorer';
    const fill = $('.xp-bar-fill'); if (fill) fill.style.width = Math.min(100, inLvl / 10) + '%';
    const nums = $('.xp-bar-numbers'); if (nums) nums.textContent = xp + ' / ' + (l * 1000) + ' XP';
    const next = $('.xp-to-next'); if (next) next.textContent = (1000 - inLvl) + ' XP to Level ' + (l + 1);
  }

  function renderIntro(user) {
    const items = $$('.intro-item');
    if (items[0]) items[0].innerHTML = '<i class="fas fa-map-marker-alt"></i> ' + (user.city ? esc(user.city) : 'No location set');
    if (items[1]) items[1].innerHTML = '<i class="fas fa-hiking"></i> ' + esc(user.accountType || 'Explorer');
    if (items[2]) items[2].innerHTML = '<i class="fas fa-calendar-alt"></i> ' + (user.createdAt ? 'Joined ' + fmtDate(user.createdAt) : 'Join date not set');
    if (items[3]) items[3].innerHTML = '<i class="fas fa-globe"></i> ' + (user.username ? 'geohub.ge/@' + esc(user.username) : 'No public username set');
    const fw = $('.followers-preview-text'); if (fw) fw.innerHTML = user.followers ? '<strong>' + compact(user.followers) + ' followers</strong>' : 'No followers yet';
    const thumbs = $('.followers-thumbs'); if (thumbs) thumbs.innerHTML = '';
  }

  function renderSidebar(user) {
    const explorer = $('.explorer-type'); if (explorer) explorer.textContent = user.accountType || 'Explorer';
    const scores = $('.lifestyle-scores');
    if (scores) scores.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0">Activity scores will appear after real check-ins and posts.</div>';
    const fav = $('.fav-cats');
    if (fav) fav.innerHTML = user.interests.length ? user.interests.map(i => '<div class="fav-cat-chip">' + esc(i) + '</div>').join('') : '<div style="color:var(--text-muted);font-size:0.85rem">No interests set yet</div>';
    const mostLiked = $('#mostLikedReviewCard');
    if (mostLiked) mostLiked.innerHTML = '<div class="sidebar-card-title">Most Helpful Review</div><div style="color:var(--text-muted);font-size:0.85rem">No reviews yet</div>';
    const activity = $('.activity-feed .activity-feed-list');
    if (activity) activity.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:12px 0">No real activity yet</div>';
    const mapPins = $$('.geo-map-widget .city-pin'); mapPins.forEach(p => p.remove());
    const followingCard = $('.following-card');
    if (followingCard) followingCard.innerHTML = '<div class="following-header">People You May Know</div><div style="padding:16px 0;text-align:center;color:var(--text-muted);font-size:0.85rem">No suggestions yet</div>';
  }

  function renderHighlights() {
    const strip = $('.profile-highlights');
    if (!strip) return;
    strip.innerHTML = '<div class="highlight-item highlight-add" data-add-highlight><div class="highlight-ring add-ring"><i class="fas fa-plus"></i></div><div class="highlight-label">New</div></div>';
  }

  function renderPosts(user) {
    const tab = $('#tab-posts'); if (!tab) return;
    tab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-spinner fa-spin"></i><p>Loading posts…</p></div>';
    const cb = (posts) => {
      const count = $('.ptab[data-tab="posts"] .tab-count'); if (count) count.textContent = posts.length;
      if (!posts.length) {
        tab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-seedling"></i><h3>No posts yet</h3><p>Real posts from Firestore will appear here.</p><a href="feed.html" class="btn btn-primary btn-sm" style="margin-top:12px">Create Post</a></div>';
        return;
      }
      tab.innerHTML = '<div class="posts-grid">' + posts.map(post => '<div class="post-thumb">' +
        (post.mediaUrl ? '<img src="' + esc(post.mediaUrl) + '" alt="Post">' : '<div style="background:var(--bg-elevated);width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1rem;padding:16px;box-sizing:border-box;text-align:center;color:var(--text-secondary)">' + esc(post.text || '') + '</div>') +
        '<div class="post-overlay"><span><i class="fas fa-heart"></i> ' + (post.likeCount || 0) + '</span><span><i class="fas fa-comment"></i> ' + (post.commentCount || 0) + '</span></div></div>').join('') + '</div>';
    };
    if (window.GeoSocial && window.GeoSocial.listenUserPosts) window.GeoSocial.listenUserPosts(user.uid, cb);
    else window.addEventListener('GeoSocialReady', () => window.GeoSocial && window.GeoSocial.listenUserPosts(user.uid, cb), { once: true });
  }

  function emptyTab(id, icon, title, text, ctaHref, ctaText) {
    const el = $(id); if (!el) return;
    el.innerHTML = '<div class="empty-profile-state"><i class="fas ' + icon + '"></i><h3>' + title + '</h3><p>' + text + '</p>' + (ctaHref ? '<a href="' + ctaHref + '" class="btn btn-primary btn-sm" style="margin-top:12px">' + ctaText + '</a>' : '') + '</div>';
  }

  function renderPlaces() { emptyTab('#tab-places', 'fa-map-marker-alt', 'No visited places yet', 'Check in to real places and they will appear here.', 'map.html', 'Explore Map'); }
  function renderRewards() { emptyTab('#tab-rewards', 'fa-gift', 'No rewards yet', 'Rewards will appear after real XP and business offers are connected.', 'rewards.html', 'Open Rewards'); }
  function renderChallenges() { emptyTab('#tab-challenges', 'fa-trophy', 'No challenges yet', 'Real challenges will appear here when added by GeoHub.', null, ''); }
  function renderReviews() { emptyTab('#tab-reviews', 'fa-star', 'No reviews yet', 'Real reviews will appear here after you write them.', 'reviews.html', 'Write Review'); }

  function renderCheckins(user) {
    const tab = $('#tab-checkins'); if (!tab) return;
    tab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-spinner fa-spin"></i><p>Loading check-ins…</p></div>';
    const cb = (items) => {
      const count = $('.ptab[data-tab="checkins"] .tab-count'); if (count) count.textContent = items.length;
      const places = $('.ptab[data-tab="places"] .tab-count'); if (places) places.textContent = items.length;
      if (!items.length) {
        tab.innerHTML = '<div class="empty-profile-state"><i class="fas fa-location-dot"></i><h3>No check-ins yet</h3><p>Only real Firestore check-ins will appear here.</p><a href="checkin.html" class="btn btn-primary btn-sm" style="margin-top:12px">Create Check-in</a></div>';
        return;
      }
      tab.innerHTML = '<div class="checkin-timeline">' + items.map(c => '<div class="checkin-item"><div class="checkin-date-badge"><div class="checkin-day">' + (tsToDate(c.createdAt) ? tsToDate(c.createdAt).getDate() : '—') + '</div><div class="checkin-month">' + (tsToDate(c.createdAt) ? tsToDate(c.createdAt).toLocaleDateString('en-US', {month:'short'}) : '') + '</div></div><div class="checkin-card"><div class="checkin-card-body"><div class="checkin-name">' + esc(c.placeName || 'GeoHub place') + '</div><div class="checkin-meta"><i class="fas fa-map-marker-alt"></i> Real check-in</div><div class="checkin-actions"><span><i class="fas fa-bolt"></i> +' + (c.xpAwarded || 0) + ' XP</span></div></div></div></div>').join('') + '</div>';
    };
    if (window.GeoSocial && window.GeoSocial.listenUserCheckins) window.GeoSocial.listenUserCheckins(user.uid, cb);
    else window.addEventListener('GeoSocialReady', () => window.GeoSocial && window.GeoSocial.listenUserCheckins(user.uid, cb), { once: true });
  }

  function wireActions(user) {
    document.addEventListener('click', function (e) {
      const edit = e.target.closest('[data-edit-profile]');
      if (edit) { e.preventDefault(); window.GeoAuth && window.GeoAuth.showAccountSettings && window.GeoAuth.showAccountSettings(); return; }
      const share = e.target.closest('[data-share-profile]');
      if (share) { e.preventDefault(); navigator.clipboard && navigator.clipboard.writeText(location.href).catch(()=>{}); toast('Profile link copied'); return; }
      const follow = e.target.closest('[data-follow-user]');
      if (follow) { e.preventDefault(); const uid = follow.getAttribute('data-follow-user'); if (window.GeoSocial) window.GeoSocial.toggleFollow(uid, (ok) => { follow.innerHTML = ok ? '<i class="fas fa-check"></i> Following' : '<i class="fas fa-user-plus"></i> Follow'; }); return; }
      const add = e.target.closest('[data-add-highlight]');
      if (add) { e.preventDefault(); toast('Highlights will appear after real stories are added.'); }
    });
  }

  function renderAll(user) {
    renderIdentity(user);
    renderPosts(user);
    renderCheckins(user);
    renderPlaces(user);
    renderRewards(user);
    renderChallenges(user);
    renderReviews(user);
    wireActions(user);
  }

  function initTabs() {
    $$('.ptab').forEach(tab => tab.addEventListener('click', () => {
      if (tab.dataset.tab === 'reviews' && tab.getAttribute('onclick')) return;
      $$('.ptab').forEach(t => t.classList.toggle('active', t === tab));
      $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab.dataset.tab));
    }));
  }

  function start() {
    initTabs();
    function loadNow() {
      loadProfile().then(user => {
        if (!user) return userNotFound();
        renderAll(user);
      }).catch(err => { console.error('[Profile]', err); userNotFound(); });
    }
    if (window.GeoFirebase) loadNow();
    else window.addEventListener('GeoFirebaseReady', loadNow, { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
