const profileUsersByUsername = Object.fromEntries(MOCK_USERS.map(user => [user.username, user]));
  const slugifyProfile = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const accountClassProfile = type => type.toLowerCase().replace(/\s+/g, '-');
  const accountBadgeProfile = type => `<span class="account-label ${accountClassProfile(type)}">${type}</span>`;
  const compactProfile = value => value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : value;
  const profilePlaces = [
    { name: 'Fabrika Tbilisi', cat: 'Cafe', city: 'Tbilisi', image: 'https://picsum.photos/seed/profile-fabrika-place/400/300', tags: ['cafes', 'events', 'student deals', 'coworking'] },
    { name: 'Juta Valley Trail', cat: 'Hiking', city: 'Kazbegi', image: 'https://picsum.photos/seed/profile-juta-place/400/300', tags: ['hiking', 'routes', 'trail running'] },
    { name: 'Shavi Lomi', cat: 'Restaurant', city: 'Tbilisi', image: 'https://picsum.photos/seed/profile-shavi-place/400/300', tags: ['restaurants', 'reviews', 'fine dining'] },
    { name: 'Dedaena Park', cat: 'Events', city: 'Tbilisi', image: 'https://picsum.photos/seed/profile-dedaena-place/400/300', tags: ['events', 'workshops', 'free events'] },
    { name: 'Batumi Boulevard', cat: 'Patriot Task', city: 'Batumi', image: 'https://picsum.photos/seed/profile-boulevard-place/400/300', tags: ['patriot tasks', 'cleanup', 'fitness'] },
    { name: 'Sololaki Courtyard', cat: 'Hidden Spot', city: 'Tbilisi', image: 'https://picsum.photos/seed/profile-sololaki-place/400/300', tags: ['hidden spots', 'photography', 'architecture'] },
    { name: 'Sighnaghi Wine Route', cat: 'Wine', city: 'Sighnaghi', image: 'https://picsum.photos/seed/profile-sighnaghi-place/400/300', tags: ['wine', 'travel', 'routes'] },
    { name: 'Mestia Svan Guesthouse', cat: 'Guesthouse', city: 'Mestia', image: 'https://picsum.photos/seed/profile-mestia-place/400/300', tags: ['guesthouses', 'hiking', 'business'] }
  ];

  function buildFirebaseProfile(authUser) {
    const seed = (authUser.username || authUser.email || 'fbuser').replace(/\W/g, '') || 'fbuser';
    return {
      id:            authUser.uid || authUser.id || 'firebase_user',
      uid:           authUser.uid || authUser.id,
      fullName:      authUser.fullName || (authUser.email || 'Explorer').split('@')[0],
      username:      authUser.username || (authUser.email || 'explorer').split('@')[0],
      email:         authUser.email || '',
      avatar:        authUser.avatar || ('https://picsum.photos/seed/' + seed + '_fb/200/200'),
      coverImage:    authUser.coverImage || ('https://picsum.photos/seed/' + seed + '_fbcv/1200/500'),
      bio:           authUser.bio || '',
      city:          authUser.city || 'Tbilisi',
      explorerLevel: authUser.explorerLevel || 'New Explorer',
      xp:            authUser.xp != null ? authUser.xp : 250,
      rank:          authUser.rank || 9999,
      badges:        (authUser.badges && authUser.badges.length) ? authUser.badges : ['New Member'],
      interests:     (authUser.interests && authUser.interests.length) ? authUser.interests : ['travel', 'cafes'],
      followers:     authUser.followers || 0,
      following:     authUser.following || 0,
      postsCount:    authUser.postsCount || 0,
      visitedPlaces: authUser.visitedPlaces || 0,
      trustScore:    authUser.trustScore || 70,
      accountType:   authUser.accountType || 'Explorer',
      isFirebaseUser: true
    };
  }

  function resolveProfileUser() {
    const urlParam = new URLSearchParams(location.search).get('user');

    // Own profile: real Firebase user
    if (!urlParam) {
      try {
        const authUser = JSON.parse(localStorage.getItem('geohub_auth_user') || 'null');
        if (authUser && authUser.isFirebaseUser) return buildFirebaseProfile(authUser);
      } catch (e) {}
      // Not logged in and no ?user= param → redirect to auth
      window.location.href = 'auth.html';
      return null;
    }

    // Public profile lookup via ?user= param — no mock users exist
    window.location.href = 'index.html';
    return null;
  }

  function scoreInterestProfile(item, user) {
    const haystack = [item.type, item.category, item.place, item.title, item.caption, item.cat, item.name, ...(item.tags || [])].filter(Boolean).join(' ').toLowerCase();
    return user.interests.reduce((score, interest) => haystack.includes(interest.toLowerCase().split(' ')[0]) ? score + 1 : score, 0);
  }

  function profileLevelNumber(user) {
    return Math.max(1, Math.min(99, Math.floor(user.xp / 1000) + 1));
  }

  function profileActivityType(user) {
    const joined = user.interests.join(' ').toLowerCase();
    if (user.accountType === 'Patriot') return 'Community Helper';
    if (user.accountType === 'Business Owner') return 'Local Business Builder';
    if (user.accountType === 'Teacher') return 'Course Creator';
    if (user.accountType === 'Student') return 'Student Explorer';
    if (joined.includes('hiking') || joined.includes('trail')) return 'Nature Explorer';
    if (joined.includes('nightlife') || joined.includes('events')) return 'Social Explorer';
    if (joined.includes('photography') || joined.includes('architecture')) return 'Visual Storyteller';
    if (joined.includes('food') || joined.includes('restaurant')) return 'Food Reviewer';
    if (joined.includes('real estate')) return 'District Scout';
    return 'City Explorer';
  }

  function updateStats(user) {
    const stats = document.querySelectorAll('.profile-stats-bar .pstat-value');
    const reviewCount = Math.max(0, Math.round(user.postsCount * 0.36));
    const geoPoints = Math.round(user.xp / 10);
    const values = [user.visitedPlaces, reviewCount, compactProfile(user.followers), compactProfile(user.following), compactProfile(geoPoints), user.trustScore];
    stats.forEach((stat, index) => stat.textContent = values[index]);
    document.querySelectorAll('.ptab .tab-count').forEach(count => {
      const tab = count.closest('.ptab')?.dataset.tab;
      if (tab === 'posts') count.textContent = user.postsCount;
      if (tab === 'places') count.textContent = user.visitedPlaces;
      if (tab === 'reviews') count.textContent = reviewCount;
    });
  }

  function renderIdentity(user) {
    const fav = user.interests.slice(0, 5);
    document.querySelector('.explorer-type').innerHTML = `${accountBadgeProfile(user.accountType)} ${profileActivityType(user)}`;
    document.querySelector('.fav-cats').innerHTML = fav.map((interest, index) =>
      `<div class="fav-cat-chip">${interest} <span class="fav-cat-rank">#${index + 1}</span></div>`
    ).join('');

    const scores = [
      ['Adventure', user.interests.some(i => /hiking|travel|route|camping|trail/i.test(i)) ? 92 : 42, '#10b981'],
      ['Cafe Life', user.interests.some(i => /cafe|coffee|coworking/i.test(i)) ? 88 : 35, '#f59e0b'],
      ['Foodie', user.interests.some(i => /restaurant|food|wine|dessert|brunch/i.test(i)) ? 86 : 38, '#ef4444'],
      ['Culture', user.interests.some(i => /course|museum|workshop|architecture|history|gallery/i.test(i)) ? 82 : 45, '#a855f7'],
      ['Social', user.interests.some(i => /event|nightlife|group|meetup/i.test(i)) ? 90 : 40, '#3b82f6']
    ];
    document.querySelector('.lifestyle-scores').innerHTML = scores.map(([label, score, color]) => `
      <div class="ls-row">
        <div class="ls-label">${label}</div>
        <div class="ls-bar-wrap"><div class="ls-bar" style="width:${score}%;background:linear-gradient(90deg,${color},#60a5fa)"></div></div>
        <div class="ls-score" style="color:${color}">${score}</div>
      </div>`).join('');
  }

  function renderProfilePosts(user) {
    const postsTab = document.getElementById('tab-posts');
    if (user.accountType === 'New User' || user.postsCount < 4) {
      postsTab.innerHTML = `<div class="empty-profile-state"><i class="fas fa-seedling"></i><h3>New profile, first map loading</h3><p>${user.fullName} has only started exploring. First check-ins, reviews, and badges will appear here.</p></div>`;
      return;
    }
    const posts = [...MOCK_FEED_POSTS].sort((a, b) => scoreInterestProfile(b, user) - scoreInterestProfile(a, user)).slice(0, 9);
    postsTab.innerHTML = `<div class="posts-grid">${posts.map((post, index) => `
      <div class="post-thumb">
        <img src="${post.image || `https://picsum.photos/seed/profile-${user.id}-${index}/400/400`}" alt="${post.place || post.title || 'Profile post'}">
        <div class="post-overlay"><span><i class="fas fa-heart"></i> ${post.likes || 20 + index * 7}</span><span><i class="fas fa-comment"></i> ${post.comments?.length || index + 1}</span></div>
      </div>`).join('')}</div>`;
  }

  function renderPlaces(user) {
    const isNewUser = user.accountType === 'New User' || (user.isFirebaseUser && !user.visitedPlaces);
    const places = [...profilePlaces].sort((a, b) => scoreInterestProfile(b, user) - scoreInterestProfile(a, user)).slice(0, isNewUser ? 2 : 6);
    document.querySelector('.places-filter-chips').innerHTML = `<div class="places-chip active">All (${user.visitedPlaces})</div>` + user.interests.slice(0, 5).map(i => `<div class="places-chip">${i}</div>`).join('');
    document.querySelector('#tab-places .places-grid').innerHTML = places.map(place => `
      <div class="place-card">
        <div class="place-card-img-wrap">
          <img class="place-card-img" src="${place.image}" alt="${place.name}">
          ${!isNewUser ? '<div class="checkin-badge"><i class="fas fa-check"></i> Visited</div>' : ''}
        </div>
        <div class="place-card-body">
          <div class="place-card-name">${place.name}</div>
          <div class="place-card-meta">${place.cat} · ${place.city} · ★ ${(4.5 + Math.random() * 0.4).toFixed(1)}</div>
        </div>
      </div>`).join('');
  }

  function renderChallenges(user) {
    const matched = [...MOCK_CHALLENGES].sort((a, b) => {
      const joinedA = a.participants.includes(user.id) ? 2 : 0;
      const joinedB = b.participants.includes(user.id) ? 2 : 0;
      return joinedB - joinedA || b.progress - a.progress;
    });
    document.querySelector('#tab-challenges .challenges-grid').innerHTML = matched.map((challenge, index) => {
      const joined = challenge.participants.includes(user.id);
      const done = joined && challenge.progress >= 100;
      const progress = joined ? challenge.progress : Math.max(8, challenge.progress - 35);
      return `
        <div class="challenge-card ${done ? 'complete' : ''}">
          <div class="ch-header"><div class="ch-icon">${challenge.icon}</div><div class="ch-badge ${done ? 'done' : joined ? 'active' : 'locked'}">${done ? 'Completed' : joined ? 'In Progress' : 'Suggested'}</div></div>
          <div class="ch-name">${challenge.name}</div>
          <div class="ch-desc">${joined ? `${user.fullName.split(' ')[0]} is participating` : 'Recommended from interests'}</div>
          <div class="ch-progress"><div class="ch-progress-fill ${done ? 'done' : joined ? 'active' : 'locked'}" style="width:${progress}%"></div></div>
          <div class="ch-foot"><span>${progress}% progress</span><span class="ch-reward">+${challenge.xp} pts</span></div>
        </div>`;
    }).join('');
  }

  function renderReviews(user) {
    const isNewUser = user.accountType === 'New User' || (user.isFirebaseUser && !user.visitedPlaces);
    const reviews = [...profilePlaces].sort((a, b) => scoreInterestProfile(b, user) - scoreInterestProfile(a, user)).slice(0, isNewUser ? 1 : 4);
    document.getElementById('tab-reviews').innerHTML = reviews.map((place, index) => `
      <div class="profile-review-card">
        <div class="prv-place-row">
          <img class="prv-place-img" src="${place.image}" alt="${place.name}">
          <div><div class="prv-place-name">${place.name}</div><div class="prv-place-cat">${place.cat} · ${place.city}</div></div>
          <div style="margin-left:auto;font-size:0.85rem">★★★★★</div>
        </div>
        <div class="prv-text">"${user.accountType === 'New User' ? 'First short review: good place to start exploring.' : `A ${place.cat.toLowerCase()} spot that matches my ${user.interests[0]} side. Worth saving if you are building a real GeoHub map.`}"</div>
        <div class="prv-foot"><button class="prv-like-btn"><i class="fas fa-heart"></i> ${Math.max(3, Math.round(user.trustScore / 2) - index * 8)} Helpful</button><div class="prv-date">May 2026</div></div>
      </div>`).join('');
  }

  function renderActivity(user) {
    const isNew = user.accountType === 'New User' || (user.isFirebaseUser && !user.postsCount && !user.visitedPlaces);
    const activity = isNew
      ? [
          ['green', '🌱', `Created a GeoHub profile and picked <strong>${user.interests[0]}</strong> as a first interest`, 'Today'],
          ['blue', '📍', 'Saved the first nearby place to wishlist', 'Today']
        ]
      : [
          ['green', '📸', `Checked in at <strong>${profilePlaces[0].name}</strong> and earned XP`, '2 hours ago'],
          ['gold', '⭐', `Left a review based on <strong>${user.interests[0] || 'travel'}</strong> interests`, 'Yesterday'],
          MOCK_CHALLENGES.length ? ['purple', '🏆', `Joined the <strong>${MOCK_CHALLENGES[0].name}</strong> challenge`, '3 days ago'] : null,
          MOCK_USERS.length ? ['blue', '👥', `Followed <strong>${MOCK_USERS[(user.rank + 3) % MOCK_USERS.length].fullName}</strong>`, '5 days ago'] : null
        ].filter(Boolean);
    document.querySelector('.activity-feed').innerHTML = `<div class="activity-feed-title">Recent Activity</div>` + activity.map(item => `
      <div class="activity-item"><div class="activity-dot ${item[0]}">${item[1]}</div><div><div class="activity-text">${item[2]}</div><div class="activity-time">${item[3]}</div></div></div>
    `).join('');
  }

  function renderProfileSidebar(user) {
    const sidebar = document.querySelector('.profile-sidebar');
    // Remove any legacy mock switcher
    const existing = document.getElementById('profileUserSwitcherCard');
    if (existing) existing.remove();

    document.querySelector('.geo-map-widget-title span').textContent = `${Math.max(1, Math.round(user.visitedPlaces / 12))} cities`;

    // Update rewards tab wallet card
    const geoPoints = Math.round(user.xp / 10);
    const tierName = user.explorerLevel.replace(' Explorer', '');
    const walletPts = document.querySelector('.wallet-points');
    if (walletPts) walletPts.textContent = geoPoints;
    const walletTier = document.querySelector('.wallet-tier');
    if (walletTier) walletTier.innerHTML = `<i class="fas fa-gem"></i> ${tierName} Tier`;
    const walletProgLabel = document.querySelector('.wallet-progress-label span:last-child');
    if (walletProgLabel) walletProgLabel.textContent = `${geoPoints} / 1,000 pts`;
    const walletStatEls = document.querySelectorAll('.wallet-card .wstat-value');
    if (walletStatEls.length >= 2) { walletStatEls[0].textContent = geoPoints; walletStatEls[1].textContent = '0'; }

    document.querySelector('.mini-wallet-pts').textContent = `${compactProfile(Math.round(user.xp / 10))} pts`;
    document.querySelector('.mini-wallet-label').textContent = `GeoPoints · ${user.explorerLevel.replace(' Explorer', '')} Tier`;
    document.querySelector('.mini-wallet-sub').innerHTML = `<strong>${Math.max(20, 1000 - Math.round(user.xp / 10))} pts</strong> to next tier · ${user.accountType === 'New User' ? 0 : 3} active coupons`;
    document.querySelector('.trust-number').textContent = user.trustScore;
    document.querySelector('.trust-info-label').textContent = user.trustScore > 92 ? 'Highly Trusted' : user.trustScore > 80 ? 'Trusted Explorer' : 'Building Trust';
    const isNewUserCtx = user.accountType === 'New User' || (user.isFirebaseUser && !user.visitedPlaces);
    document.querySelector('.trust-info-sub').textContent = isNewUserCtx ? 'New profile under review' : `Rank #${user.rank} in GeoHub`;
    const isNewUser = user.accountType === 'New User' || (user.isFirebaseUser && !user.visitedPlaces);
    document.querySelector('.trust-items').innerHTML = `
      <div class="trust-item ok"><i class="fas fa-check-circle"></i> ${user.isFirebaseUser ? 'Firebase account verified' : 'Profile mock verified'}</div>
      <div class="trust-item ok"><i class="fas fa-map-marker-alt"></i> ${user.visitedPlaces} visited places</div>
      <div class="trust-item ok"><i class="fas fa-star"></i> ${user.badges.length} badges earned</div>
      <div class="trust-item ${isNewUser ? 'warn' : 'ok'}"><i class="fas fa-camera"></i> ${isNewUser ? 'Needs more camera proofs' : 'Camera proof active'}</div>`;

    const suggested = MOCK_USERS.filter(candidate => candidate.id !== user.id).sort((a, b) => b.trustScore - a.trustScore).slice(0, 4);
    document.querySelector('.following-card').innerHTML = `<div class="following-header">People You May Know</div>` + suggested.map(candidate => `
      <div class="following-row">
        <a href="profile.html?user=${encodeURIComponent(candidate.username)}"><img class="following-avatar" src="${candidate.avatar}" alt="${candidate.fullName}"></a>
        <div><div class="following-name"><a href="profile.html?user=${encodeURIComponent(candidate.username)}">${candidate.fullName}</a></div><div class="following-type">${candidate.accountType}</div></div>
        <button class="follow-btn">Follow</button>
      </div>`).join('');
  }

  function isOwnProfile(user) {
    const urlParam = new URLSearchParams(location.search).get('user');
    if (urlParam) return false;
    try {
      const authUser = JSON.parse(localStorage.getItem('geohub_auth_user') || 'null');
      if (!authUser) return false;
      if (authUser.username && user.username && authUser.username === user.username) return true;
      if (authUser.uid && user.uid && authUser.uid === user.uid) return true;
      if (authUser.id && user.id && authUser.id === user.id) return true;
    } catch (e) {}
    return false;
  }

  function renderDynamicProfile(user) {
    const ownProfile = isOwnProfile(user);
    document.title = `${user.fullName} - GeoHub Profile`;
    document.querySelector('.profile-cover').classList.add('dynamic-cover');
    document.querySelector('.profile-cover').style.backgroundImage = `linear-gradient(180deg, rgba(4,5,13,0.1), rgba(4,5,13,0.72)), url('${user.coverImage}')`;
    document.querySelector('.profile-avatar').src = user.avatar;
    document.querySelector('.profile-avatar').alt = user.fullName;
    document.querySelector('.avatar-level').textContent = profileLevelNumber(user);
    document.querySelector('.profile-name').textContent = user.fullName;
    document.querySelector('.profile-handle').innerHTML = `@${user.username} · ${user.city} · ${accountBadgeProfile(user.accountType)}`;
    // Cover action buttons: own profile vs public
    const coverActions = document.querySelector('.cover-actions');
    if (coverActions) {
      if (ownProfile) {
        coverActions.innerHTML = `<button class="cover-btn"><i class="fas fa-share-alt"></i> Share</button><button class="cover-btn primary" onclick="window.GeoAuth&&window.GeoAuth.showAccountSettings()"><i class="fas fa-pen"></i> Edit Profile</button>`;
      } else {
        coverActions.innerHTML = `<button class="cover-btn"><i class="fas fa-share-alt"></i> Share</button><button class="cover-btn primary"><i class="fas fa-user-plus"></i> Follow</button>`;
      }
    }
    // Profile action buttons
    const profileActions = document.querySelector('.profile-actions');
    if (profileActions) {
      if (ownProfile) {
        profileActions.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="window.GeoAuth&&window.GeoAuth.showAccountSettings()"><i class="fas fa-pen"></i></button><a href="lifegraph.html" class="btn btn-primary btn-sm" style="text-decoration:none"><i class="fas fa-chart-line"></i> Life Graph</a>`;
      } else {
        profileActions.innerHTML = `<button class="btn btn-ghost btn-sm"><i class="fas fa-envelope"></i></button><button class="btn btn-primary btn-sm"><i class="fas fa-user-plus"></i> Follow</button><a href="lifegraph.html" class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none"><i class="fas fa-chart-line"></i> Life Graph</a>`;
      }
    }
    document.querySelector('.profile-bio').textContent = user.bio;
    document.querySelector('.trust-badges').innerHTML = `
      <span class="trust-badge green"><i class="fas fa-check-circle"></i> ${user.explorerLevel}</span>
      <span class="trust-badge gold"><i class="fas fa-star"></i> ${compactProfile(user.xp)} XP</span>
      <span class="trust-badge blue"><i class="fas fa-ranking-star"></i> ${user.rank >= 9000 ? 'New Explorer' : 'Rank #' + user.rank}</span>
      <span class="trust-badge purple"><i class="fas fa-id-badge"></i> ${user.accountType}</span>
      <span class="trust-badge green"><i class="fas fa-map-marker-alt"></i> Real Check-ins: ${user.visitedPlaces}</span>`;
    updateStats(user);
    renderIdentity(user);
    renderProfilePosts(user);
    renderPlaces(user);
    renderChallenges(user);
    renderReviews(user);
    renderActivity(user);
    renderProfileSidebar(user);
    setTimeout(() => window.GeoHubSocial?.refresh?.(), 0);
  }

  const _profileUser = resolveProfileUser();
  if (_profileUser) renderDynamicProfile(_profileUser);

  // Tab switching
  function switchTab(tabId) {
    document.querySelectorAll('.ptab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === 'tab-' + tabId);
    });
  }

  document.querySelectorAll('.ptab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Places filter chips
  document.querySelectorAll('.places-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.places-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // Copy coupon code on click
  document.querySelectorAll('.coupon-code').forEach(el => {
    el.addEventListener('click', () => {
      navigator.clipboard.writeText(el.textContent.trim()).catch(() => {});
      const orig = el.textContent;
      el.textContent = 'Copied!';
      setTimeout(() => el.textContent = orig, 1500);
    });
  });

  // Follow buttons
  document.querySelectorAll('.follow-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.textContent === 'Follow') {
        this.textContent = 'Following';
        this.style.background = 'rgba(16,185,129,0.2)';
      } else {
        this.textContent = 'Follow';
        this.style.background = '';
      }
    });
  });
  window.GeoHubSocial?.refresh?.();
