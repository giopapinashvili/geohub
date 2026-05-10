const mockUserById = Object.fromEntries(MOCK_USERS.map(user => [user.id, user]));
  const accountClass = type => type.toLowerCase().replace(/\s+/g, '-');
  const accountBadge = type => `<span class="account-label ${accountClass(type)}">${type}</span>`;
  const compact = n => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : n;
  const userName = id => mockUserById[id]?.fullName || 'GeoHub User';
  const userAvatar = id => mockUserById[id]?.avatar || 'https://picsum.photos/seed/geohub-user/200/200';

  function getCurrentMockUser() {
    const saved = localStorage.getItem('geohub_mock_user') || 'u01';
    return mockUserById[saved] || MOCK_USERS[0] || null;
  }

  function postScoreForUser(post, currentUser) {
    const text = [post.type, post.category, post.place, post.title, post.caption].filter(Boolean).join(' ').toLowerCase();
    return currentUser.interests.reduce((score, interest) => text.includes(interest.toLowerCase().split(' ')[0]) ? score + 1 : score, 0);
  }

  function renderStories(currentUser, isReal) {
    const mySlot = isReal && currentUser
      ? `<div class="story-item">
          <div class="story-ring place">
            <img class="story-avatar" src="${currentUser.avatar || ''}" alt="${currentUser.fullName || 'You'}" onerror="this.style.display='none'">
          </div>
          <div class="story-name">@${currentUser.username || 'you'}</div>
        </div>`
      : '';
    document.querySelector('.stories-inner').innerHTML = `
      <div class="story-add-wrap">
        <div class="story-add"><i class="fas fa-plus"></i></div>
        <div class="story-name">Your Story</div>
      </div>
      ${MOCK_STORIES.map(story => {
        const user = mockUserById[story.userId];
        return `
          <div class="story-item">
            <div class="story-ring ${story.ring}">
              <a href="profile.html?user=${encodeURIComponent(user.username)}"><img class="story-avatar" src="${user.avatar}" alt="${user.fullName}"></a>
              ${story.label ? `<div class="story-live-badge">${story.label}</div>` : ''}
            </div>
            <div class="story-name">${user.username}</div>
          </div>`;
      }).join('')}
      ${mySlot}`;
  }

  function renderComments(comments = []) {
    if (!comments.length) return '';
    return `<div class="ci-comments">${comments.map(comment => `
      <div class="ci-comment">
        <img src="${userAvatar(comment.userId)}" alt="${userName(comment.userId)}">
        <div class="ci-comment-text"><strong>${userName(comment.userId)}</strong> ${comment.text}</div>
      </div>`).join('')}</div>`;
  }

  function renderPostCard(post) {
    const user = mockUserById[post.userId];
    const withUsers = post.withUsers?.length ? `<div class="ci-with"><i class="fas fa-user-friends"></i> with ${post.withUsers.map(userName).join(', ')}</div>` : '';
    const going = post.going?.length ? `<div class="ci-with"><i class="fas fa-users"></i> ${post.going.map(userName).join(', ')}</div>` : '';
    const iconMap = { hiking: 'fa-mountain', event: 'fa-ticket', deal: 'fa-qrcode', review: 'fa-star', challenge: 'fa-trophy', patriot: 'fa-hand-holding-heart', photo: 'fa-camera', group: 'fa-users', business: 'fa-store', course: 'fa-graduation-cap', new_user: 'fa-seedling', checkin: 'fa-location-dot' };
    return `
      <div class="feed-card mock-feed-card" data-feed-type="${post.type}" data-social-id="${post.id}">
        <div class="ci-header">
          <a href="profile.html?user=${encodeURIComponent(user.username)}"><img class="ci-avatar" src="${user.avatar}" alt="${user.fullName}"></a>
          <div class="ci-user-info">
            <div class="ci-username"><a href="profile.html?user=${encodeURIComponent(user.username)}">${user.fullName}</a> ${accountBadge(user.accountType)} <span style="font-size:0.72rem;color:var(--text-muted);font-weight:400">posted</span></div>
            <div class="ci-sub">@${user.username} · ${user.explorerLevel} · ${post.time}</div>
          </div>
          <div class="ci-options"><i class="fas fa-ellipsis-h"></i></div>
        </div>
        <div class="ci-place-tag"><i class="fas ${iconMap[post.type] || 'fa-map-marker-alt'}"></i> ${post.place || post.title} · ${post.category || post.type}</div>
        <img class="ci-photo" src="${post.image}" alt="${post.place || post.title}">
        <div class="ci-caption">${post.caption}</div>
        <div class="ci-meta-row">
          <div class="ci-mood">${post.mood || post.title || 'GeoHub activity'}</div>
          ${withUsers}
          ${going}
          <div class="ci-xp">+${post.xp} XP</div>
        </div>
        <div class="ci-actions">
          <button class="ci-action-btn like-btn"><i class="fas fa-heart"></i> <span class="like-count">${post.likes}</span></button>
          <button class="ci-action-btn"><i class="fas fa-comment"></i> ${post.comments?.length || 0}</button>
          <button class="ci-action-btn"><i class="fas fa-share-alt"></i></button>
          <div class="ci-spacer"></div>
          <button class="ci-action-btn save-btn"><i class="far fa-bookmark"></i></button>
        </div>
        ${renderComments(post.comments)}
      </div>`;
  }

  function renderMockSwitcher(currentUser) {
    const sidebar = document.querySelector('.feed-sidebar');
    const existing = document.getElementById('mockUserSwitcherWidget');
    if (existing) existing.remove();

    // Real Firebase users see their own account card — no mock switcher
    if (window.GeoMode && window.GeoMode.isRealUser()) {
      const real = window.GeoMode.getCurrentUser();
      sidebar.insertAdjacentHTML('afterbegin', `
        <div class="sidebar-widget" id="mockUserSwitcherWidget">
          <div class="sw-title">Your Account</div>
          <div class="mock-current-user">
            <img src="${real.avatar || ''}" alt="${real.fullName}" onerror="this.style.display='none'">
            <div>
              <div class="mock-user-name">${real.fullName} ${accountBadge(real.accountType || 'Explorer')}</div>
              <div class="mock-user-meta">@${real.username} · ${real.city || 'Tbilisi'}</div>
            </div>
          </div>
          <div class="mock-stats">
            <div class="mock-stat"><strong>${compact(real.xp || 250)}</strong><span>XP</span></div>
            <div class="mock-stat"><strong>${real.explorerLevel ? real.explorerLevel.split(' ')[0] : 'New'}</strong><span>Level</span></div>
            <div class="mock-stat"><strong>${real.trustScore || 70}</strong><span>Trust</span></div>
          </div>
          <div class="mock-user-meta" style="margin-top:10px">
            <a href="profile.html" style="color:var(--green)"><i class="fas fa-user"></i> View your profile</a>
          </div>
        </div>`);
      return;
    }

    // Not logged in → show Join GeoHub CTA
    sidebar.insertAdjacentHTML('afterbegin', `
      <div class="sidebar-widget" id="mockUserSwitcherWidget">
        <div class="sw-title">Join GeoHub</div>
        <div class="mock-user-meta" style="margin-bottom:12px;line-height:1.6">Create an account to personalize your feed, check in to places, and connect with explorers across Georgia.</div>
        <a href="auth.html" style="display:block;text-align:center;padding:9px 0;border-radius:8px;font-size:0.875rem;text-decoration:none;font-weight:700;background:var(--gradient-brand);color:#fff"><i class="fas fa-sign-in-alt"></i> Login or Sign Up</a>
      </div>`);
  }

  function renderTrendingExplorers() {
    const widget = document.querySelector('.feed-sidebar .sidebar-widget:nth-of-type(2)');
    const topUsers = [...MOCK_USERS].sort((a, b) => a.rank - b.rank).slice(0, 5);
    widget.innerHTML = `
      <div class="sw-title">🔥 Trending Explorers <a href="profile.html">View all</a></div>
      ${topUsers.map(user => `
        <div class="explorer-row">
          <a href="profile.html?user=${encodeURIComponent(user.username)}"><img class="explorer-avatar" src="${user.avatar}" alt="${user.fullName}"></a>
          <div class="explorer-info">
            <div class="explorer-name"><a href="profile.html?user=${encodeURIComponent(user.username)}">${user.fullName}</a></div>
            <div class="explorer-stat">${user.explorerLevel} · ${compact(user.followers)} followers</div>
          </div>
          <div class="explorer-rank">#${user.rank}</div>
        </div>`).join('')}`;
  }

  function renderSidebarMocks(currentUser) {
    const sidebar = document.querySelector('.feed-sidebar');
    renderMockSwitcher(currentUser);
    renderTrendingExplorers();

    const suggestedWidget = sidebar.querySelector('.sidebar-widget:last-of-type');
    const suggested = MOCK_USERS
      .filter(user => user.id !== (currentUser && currentUser.id))
      .sort((a, b) => {
        const overlap = user => user.interests.filter(i => currentUser.interests.includes(i)).length;
        return overlap(b) - overlap(a) || b.trustScore - a.trustScore;
      })
      .slice(0, 5);
    suggestedWidget.innerHTML = `
      <div class="sw-title">👥 Suggested to Follow</div>
      ${suggested.length ? suggested.map(user => `
        <div class="su-row">
          <a href="profile.html?user=${encodeURIComponent(user.username)}"><img class="su-avatar" src="${user.avatar}" alt="${user.fullName}"></a>
          <div class="su-info">
            <div class="su-name"><a href="profile.html?user=${encodeURIComponent(user.username)}">${user.fullName}</a></div>
            <div class="su-type">${user.accountType} · ${compact(user.followers)} followers</div>
          </div>
          <button class="su-follow follow-btn">Follow</button>
        </div>`).join('') : '<div style="padding:12px 0;text-align:center;font-size:0.85rem;color:var(--text-muted)">Sign up and connect with explorers across Georgia.<br><a href="auth.html?tab=signup" style="color:var(--green);font-weight:700;text-decoration:none">Create account →</a></div>'}`;

    const challengeWidget = [...sidebar.querySelectorAll('.sidebar-widget')].find(w => w.textContent.includes('Top Challenges') || w.textContent.includes('Active Challenges'));
    if (challengeWidget) {
      challengeWidget.innerHTML = `
        <div class="sw-title">🏆 Challenges <a href="challenges.html">See all</a></div>
        ${MOCK_CHALLENGES.length ? MOCK_CHALLENGES.map(challenge => `
          <div class="sc-item">
            <div class="sc-row"><div class="sc-icon">${challenge.icon}</div><div class="sc-name">${challenge.name}</div><div class="sc-xp">+${challenge.xp}</div></div>
            <div class="sc-bar"><div class="sc-fill" style="width:${challenge.progress}%"></div></div>
          </div>`).join('') : '<div style="padding:12px 0;text-align:center"><a href="challenges.html" class="btn btn-primary btn-sm" style="font-size:0.78rem">Browse Challenges</a></div>'}`;
    }
  }

  function renderMockFeed() {
    const mockUser = getCurrentMockUser();
    const isReal = window.GeoMode && window.GeoMode.isRealUser();
    const realUser = isReal ? window.GeoMode.getCurrentUser() : null;
    const currentUser = mockUser || { id: null, interests: [], rank: 9999, accountType: 'Explorer' };
    const sortedPosts = [...MOCK_FEED_POSTS].sort((a, b) => postScoreForUser(b, currentUser) - postScoreForUser(a, currentUser));
    document.querySelector('.feed-header-sub').textContent = isReal
      ? 'Georgia · personalized for you'
      : 'Georgia · community highlights';
    renderStories(realUser || currentUser, isReal);
    if (!sortedPosts.length) {
      document.getElementById('feedCards').innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#4b5563;">
          <i class="fas fa-compass" style="font-size:2.5rem;color:#1e293b;margin-bottom:16px;display:block;"></i>
          <h3 style="font-size:1.1rem;font-weight:700;color:#94a3b8;margin-bottom:8px;">Feed is empty</h3>
          <p style="font-size:0.85rem;max-width:300px;margin:0 auto 20px;">Check in to places, join events, and follow people — your feed will fill up as you explore.</p>
          <a href="map.html" class="btn btn-primary btn-sm"><i class="fas fa-map-marker-alt"></i> Explore Places</a>
        </div>`;
    } else {
      document.getElementById('feedCards').innerHTML = sortedPosts.map(renderPostCard).join('') + `
        <div style="text-align:center;padding:10px 0 30px">
          <button class="btn btn-ghost" id="loadMoreBtn"><i class="fas fa-sync-alt"></i> Load More</button>
        </div>`;
    }
    renderSidebarMocks(currentUser);
    bindMockInteractions();
    applyFeedTab(document.querySelector('.feed-tab.active')?.dataset.tab || 'foryou');
    setTimeout(() => window.GeoHubSocial?.refresh?.(), 0);
  }

  function bindMockInteractions() {
    document.querySelectorAll('.like-btn').forEach(btn => {
      btn.onclick = function() {
        this.classList.toggle('liked');
        const countEl = this.querySelector('.like-count');
        if (countEl) {
          const n = parseInt(countEl.textContent, 10);
          countEl.textContent = this.classList.contains('liked') ? n + 1 : n - 1;
        }
      };
    });
    document.querySelectorAll('.save-btn').forEach(btn => {
      btn.onclick = function() {
        this.classList.toggle('saved');
        const icon = this.querySelector('i');
        if (icon) icon.className = this.classList.contains('saved') ? 'fas fa-bookmark' : 'far fa-bookmark';
      };
    });
    document.querySelectorAll('.follow-btn').forEach(btn => {
      btn.onclick = function() {
        const following = this.classList.toggle('following');
        this.textContent = following ? 'Following' : 'Follow';
      };
    });
    const loadMore = document.getElementById('loadMoreBtn');
    if (loadMore) {
      loadMore.onclick = function() {
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        setTimeout(() => {
          this.innerHTML = '<i class="fas fa-sync-alt"></i> Load More';
        }, 900);
      };
    }
  }

  function applyFeedTab(tabName) {
    const visibleByTab = {
      foryou: null,
      following: ['checkin', 'photo', 'review', 'hiking'],
      nearby: ['checkin', 'deal', 'business', 'patriot'],
      events: ['event', 'group', 'course'],
      challenges: ['challenge', 'patriot'],
      deals: ['deal', 'business']
    };
    const allowed = visibleByTab[tabName];
    document.querySelectorAll('#feedCards .feed-card').forEach((card, i) => {
      const show = !allowed || allowed.includes(card.dataset.feedType);
      card.style.display = show ? '' : 'none';
      if (show) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(12px)';
        setTimeout(() => {
          card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, i * 30);
      }
    });
  }

  renderMockFeed();

  // Feed tab switching
  const tabContents = {
    foryou: null,
    following: ['checkin', 'photo', 'review', 'hiking'],
    nearby: ['checkin', 'deal', 'business', 'patriot'],
    events: ['event', 'group', 'course'],
    challenges: ['challenge', 'patriot'],
    deals: ['deal', 'business']
  };

  document.querySelectorAll('.feed-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      applyFeedTab(tab.dataset.tab);
    });
  });

  // Like button toggle
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      this.classList.toggle('liked');
      const countEl = this.querySelector('.like-count');
      if (countEl) {
        const n = parseInt(countEl.textContent);
        countEl.textContent = this.classList.contains('liked') ? n + 1 : n - 1;
      }
      const icon = this.querySelector('i');
      if (icon) {
        icon.className = this.classList.contains('liked') ? 'fas fa-heart' : 'fas fa-heart';
      }
    });
  });

  // Save/bookmark toggle
  document.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      this.classList.toggle('saved');
      const icon = this.querySelector('i');
      if (icon) {
        icon.className = this.classList.contains('saved') ? 'fas fa-bookmark' : 'far fa-bookmark';
      }
    });
  });

  // Join event / challenge
  document.querySelectorAll('.join-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.classList.contains('event-join-btn')) {
        const joined = this.classList.toggle('joined');
        this.textContent = joined ? '✓ Going' : 'Join Event';
      } else if (this.classList.contains('ch-accept-btn')) {
        this.classList.add('joined');
        this.textContent = '✓ Accepted';
      } else if (this.classList.contains('ne-join')) {
        this.textContent = this.textContent === 'Join' ? '✓' : 'Join';
        this.style.background = this.textContent === '✓' ? 'var(--green)' : '';
        this.style.color = this.textContent === '✓' ? '#000' : '';
      }
    });
  });

  // Follow button toggle
  document.querySelectorAll('.follow-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const following = this.classList.toggle('following');
      this.textContent = following ? 'Following' : 'Follow';
    });
  });

  // Claim deal
  document.querySelectorAll('.claim-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      this.textContent = '✓ Claimed! Check your wallet';
      this.style.background = 'rgba(16,185,129,0.3)';
      this.style.color = 'var(--green)';
      this.disabled = true;
    });
  });

  // loadMoreBtn is handled inside bindMockInteractions() above
  window.GeoHubSocial?.refresh?.();
