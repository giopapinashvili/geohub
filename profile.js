(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const compact = (v) => Number(v || 0) >= 1000 ? (Number(v) / 1000).toFixed(Number(v) >= 10000 ? 0 : 1) + 'k' : String(Number(v || 0));

  function initialLetters(name, email) {
    name = String(name || '').trim();
    email = String(email || '').trim().toLowerCase();
    if (!name && email === 'gio.papinashvili20@gmail.com') name = 'Giorgi Papinashvili';
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
    let fullName = data.fullName || data.displayName || (fbUser && fbUser.displayName) || '';
    if (!fullName && email === 'gio.papinashvili20@gmail.com') fullName = 'Giorgi Papinashvili';
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
      city: data.city || '',
      accountType: data.accountType || 'Explorer',
      explorerLevel: data.explorerLevel || 'New Explorer',
      xp: Number(data.xp || 0),
      followers: Number(data.followers || 0),
      following: Number(data.following || 0),
      postsCount: Number(data.postsCount || 0),
      visitedPlaces: Number(data.visitedPlaces || 0),
      trustScore: Number(data.trustScore || 0),
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
        bio: '', city: '', accountType: 'Explorer', interests: [],
        xp: 0, followers: 0, following: 0, postsCount: 0, visitedPlaces: 0, trustScore: 0,
        createdAt: GF.fs.serverTimestamp()
      }, { merge: true }).catch(err => console.warn('[Profile] create user doc failed', err.message));
    }
    return profile;
  }

  async function findProfile(GF, fbUser) {
    const params = new URLSearchParams(location.search);
    const uid = params.get('uid');
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
    const vals = [user.visitedPlaces, 0, user.followers, user.following, Math.floor(user.xp / 10), user.trustScore];
    $$('.profile-stats-bar .pstat-value').forEach((el, i) => { el.textContent = compact(vals[i] || 0); });
    $$('.ptab .tab-count').forEach(c => { c.textContent = '0'; });
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
    if (coverActions) coverActions.innerHTML = own ? '<button class="cover-btn" data-share-profile><i class="fas fa-share-alt"></i> Share</button><button class="cover-btn primary" data-edit-profile><i class="fas fa-pen"></i> Edit Profile</button>' : '<button class="cover-btn" data-share-profile><i class="fas fa-share-alt"></i> Share</button><button class="cover-btn primary" data-follow-user="' + esc(user.uid) + '"><i class="fas fa-user-plus"></i> Follow</button>';
    const actions = $('.profile-actions');
    if (actions) actions.innerHTML = own ? '<button class="btn btn-primary btn-sm" data-edit-profile><i class="fas fa-pen"></i> Edit Profile</button><button class="btn btn-ghost btn-sm" data-share-profile><i class="fas fa-share-alt"></i></button><button class="btn btn-ghost btn-sm" data-logout><i class="fas fa-right-from-bracket"></i> Logout</button>' : '<button class="btn btn-ghost btn-sm" data-message-user="' + esc(user.uid) + '"><i class="fas fa-envelope"></i></button><button class="btn btn-primary btn-sm" data-follow-user="' + esc(user.uid) + '"><i class="fas fa-user-plus"></i> Follow</button>';
    if (!own && window.GeoSocial && window.GeoSocial.checkFollowing) {
      window.GeoSocial.checkFollowing(user.uid, isFollowing => {
        $$('[data-follow-user="' + user.uid + '"]').forEach(btn => {
          btn.classList.toggle('following', !!isFollowing);
          btn.innerHTML = isFollowing ? '<i class="fas fa-user-check"></i> Following' : '<i class="fas fa-user-plus"></i> Follow';
        });
      });
    }
    renderStats(user);
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
    if (intro[0]) intro[0].innerHTML = '<i class="fas fa-map-marker-alt"></i> ' + (user.city ? esc(user.city) : 'No location set');
    if (intro[1]) intro[1].innerHTML = '<i class="fas fa-hiking"></i> ' + esc(user.accountType || 'Explorer');
    if (intro[2]) intro[2].innerHTML = '<i class="fas fa-calendar-alt"></i> Join date not set';
    if (intro[3]) intro[3].innerHTML = '<i class="fas fa-globe"></i> ' + (user.username ? 'geohub.ge/@' + esc(user.username) : 'No public username set');
    const lifestyle = $('.lifestyle-scores'); if (lifestyle) lifestyle.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:8px 0">Activity scores will appear after real check-ins and posts.</div>';
    const fav = $('.fav-cats'); if (fav) fav.innerHTML = user.interests.length ? user.interests.map(i => '<div class="fav-cat-chip">' + esc(i) + '</div>').join('') : '<div style="color:var(--text-muted);font-size:.85rem">No interests set yet</div>';
    ['spCitiesVal','spFriendsVal','spLikesVal','spGroupsVal'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0'; });
    const review = $('#mostLikedReviewCard'); if (review) review.innerHTML = '<div class="sidebar-card-title">Most Helpful Review</div><div style="color:var(--text-muted);font-size:.85rem">No reviews yet</div>';
    const activity = $('.activity-feed .activity-feed-list'); if (activity) activity.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:12px 0">No real activity yet</div>';
    const thumbs = $('.followers-thumbs'); if (thumbs) thumbs.innerHTML = '';
    const ftxt = $('.followers-preview-text'); if (ftxt) ftxt.textContent = 'No followers yet';
    const highlights = $('.profile-highlights'); if (highlights) highlights.innerHTML = '<div class="highlight-item highlight-add" data-add-highlight><div class="highlight-ring add-ring"><i class="fas fa-plus"></i></div><div class="highlight-label">New</div></div>';
  }

  function emptyTab(id, icon, title, text, href, cta) {
    const el = $(id); if (!el) return;
    el.innerHTML = '<div class="empty-profile-state"><i class="fas ' + icon + '"></i><h3>' + title + '</h3><p>' + text + '</p>' + (href ? '<a href="' + href + '" class="btn btn-primary btn-sm" style="margin-top:12px">' + cta + '</a>' : '') + '</div>';
  }

  function renderTabs(user) {
    emptyTab('#tab-posts', 'fa-seedling', 'No posts yet', 'Real posts from Firestore will appear here.', 'feed.html?compose=1', 'Create Post');
    emptyTab('#tab-places', 'fa-map-marker-alt', 'No visited places yet', 'Check in to real places and they will appear here.', 'map.html', 'Explore Map');
    emptyTab('#tab-checkins', 'fa-location-dot', 'No check-ins yet', 'Real check-ins will appear here.', 'checkin.html', 'Check in');
    emptyTab('#tab-rewards', 'fa-gift', 'No rewards yet', 'Rewards will appear after real XP and business offers are connected.', 'rewards.html', 'Open Rewards');
    emptyTab('#tab-challenges', 'fa-trophy', 'No challenges yet', 'Real challenges will appear here when added by GeoHub.', null, '');
    emptyTab('#tab-reviews', 'fa-star', 'No reviews yet', 'Real reviews will appear here after you write them.', 'reviews.html', 'Write Review');
    if (window.GeoSocial && window.GeoSocial.listenUserPosts) {
      window.GeoSocial.listenUserPosts(user.uid, posts => {
        const count = $('.ptab[data-tab="posts"] .tab-count'); if (count) count.textContent = posts.length || '0';
        if (!posts.length) return;
        const tab = $('#tab-posts');
        tab.innerHTML = '<div class="posts-grid">' + posts.map(post => '<div class="post-thumb">' + (post.mediaUrl ? '<img src="' + esc(post.mediaUrl) + '" alt="Post">' : '<div style="background:var(--bg-elevated);width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1rem;padding:16px;box-sizing:border-box;text-align:center;color:var(--text-secondary)">' + esc(post.text || '') + '</div>') + '<div class="post-overlay"><span><i class="fas fa-heart"></i> ' + (post.likeCount || 0) + '</span><span><i class="fas fa-comment"></i> ' + (post.commentCount || 0) + '</span></div></div>').join('') + '</div>';
      });
    }
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
          location.replace('auth.html?next=' + encodeURIComponent('profile.html'));
          return;
        }
        try {
          const profile = await findProfile(GF, fbUser);
          if (!profile) return userNotFound();
          renderIdentity(profile, fbUser);
          if (window.GeoSocial) renderTabs(profile);
          else window.addEventListener('GeoSocialReady', () => renderTabs(profile), { once: true });
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
    const msgBtn = e.target.closest('[data-message-user]');
    if (msgBtn) {
      e.preventDefault();
      const target = msgBtn.dataset.messageUser;
      if (!window.GeoSocial || !target) return toast('Messages are still loading', 'error');
      window.GeoSocial.startConversation(target, () => { location.href = 'messages.html?with=' + encodeURIComponent(target); });
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
