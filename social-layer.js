(function GeoHubSocialLayer() {
  const users = window.MOCK_USERS || [];
  const interactions = window.MOCK_INTERACTIONS || { comments: {}, reactions: {}, friendsToShare: [], activity: [] };
  const notifications = window.MOCK_NOTIFICATIONS || [];
  const byId = Object.fromEntries(users.map(user => [user.id, user]));
  const byUsername = Object.fromEntries(users.map(user => [user.username, user]));
  const reactionTypes = [
    ['like', '👍', 'Like'],
    ['love', '💚', 'Love'],
    ['fire', '🔥', 'Fire'],
    ['wow', '😮', 'Wow'],
    ['saved', '🔖', 'Saved'],
    ['going', '✅', 'Going'],
    ['interested', '⭐', 'Interested']
  ];

  const storage = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  };

  const state = {
    reactions: storage.get('geohub_social_reactions', {}),
    comments: storage.get('geohub_social_comments', {}),
    follows: storage.get('geohub_social_follows', {}),
    readNotifications: storage.get('geohub_notifications_read', {}),
    shared: storage.get('geohub_social_shares', [])
  };

  function currentUser() {
    const key = localStorage.getItem('geohub_mock_user') || localStorage.getItem('geohub_mock_profile_user') || 'nino.explorer';
    return byId[key] || byUsername[key] || users[0] || { id: 'u01', fullName: 'GeoHub User', username: 'geohub.user', avatar: '' };
  }

  function saveState() {
    storage.set('geohub_social_reactions', state.reactions);
    storage.set('geohub_social_comments', state.comments);
    storage.set('geohub_social_follows', state.follows);
    storage.set('geohub_notifications_read', state.readNotifications);
    storage.set('geohub_social_shares', state.shared);
  }

  function profileHref(user) {
    return `profile.html?user=${encodeURIComponent(user?.username || 'nino.explorer')}`;
  }

  function itemId(el) {
    const host = el?.closest?.('[data-social-id], .feed-card, .place-card, .challenge-card, .coupon-card, .business-hero, .reward-card, .event-card, .profile-identity');
    if (!host) return `page-${location.pathname.split('/').pop() || 'index'}`;
    if (!host.dataset.socialId) {
      const title = host.querySelector('.ci-username, .place-card-name, .ch-name, .coupon-name, h1, h2, .profile-name, .event-title')?.textContent?.trim() || host.className || 'item';
      host.dataset.socialId = `auto-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || Math.random().toString(36).slice(2)}`;
    }
    return host.dataset.socialId;
  }

  function seededComments(id) {
    const local = state.comments[id] || [];
    const seed = interactions.comments?.[id] || [];
    const merged = new Map();
    seed.forEach(comment => merged.set(comment.id, comment));
    local.forEach(comment => merged.set(comment.id, comment));
    return [...merged.values()];
  }

  function reactionCounts(id) {
    const base = { ...(interactions.reactions?.[id] || {}) };
    reactionTypes.forEach(([type]) => {
      base[type] = base[type] || 0;
      if (state.reactions[id]?.[type]) base[type] += 1;
    });
    return base;
  }

  function activeReaction(id, type) {
    return Boolean(state.reactions[id]?.[type]);
  }

  function toast(message) {
    const existing = document.querySelector('.gh-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'gh-toast';
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, 1700);
  }

  function ensureModal() {
    if (document.getElementById('ghSocialModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="gh-modal-backdrop" id="ghSocialModal">
        <div class="gh-modal">
          <div class="gh-modal-head">
            <div class="gh-modal-title">GeoHub</div>
            <button class="gh-modal-close" type="button"><i class="fas fa-times"></i></button>
          </div>
          <div class="gh-modal-body"></div>
        </div>
      </div>`);
    document.querySelector('#ghSocialModal .gh-modal-close').addEventListener('click', closeModal);
    document.getElementById('ghSocialModal').addEventListener('click', event => {
      if (event.target.id === 'ghSocialModal') closeModal();
    });
  }

  function openModal(title, bodyHtml) {
    ensureModal();
    document.querySelector('#ghSocialModal .gh-modal-title').textContent = title;
    document.querySelector('#ghSocialModal .gh-modal-body').innerHTML = bodyHtml;
    document.getElementById('ghSocialModal').classList.add('open');
  }

  function closeModal() {
    document.getElementById('ghSocialModal')?.classList.remove('open');
  }

  function renderComment(comment, id, isReply = false) {
    const user = byId[comment.userId] || currentUser();
    return `
      <div class="gh-comment-item ${isReply ? 'reply' : ''}" data-comment-id="${comment.id}" data-social-id="${id}">
        <a href="${profileHref(user)}"><img class="gh-comment-avatar" src="${user.avatar}" alt="${user.fullName}"></a>
        <div>
          <div class="gh-comment-bubble">
            <div class="gh-comment-name"><a href="${profileHref(user)}">${user.fullName}</a></div>
            <div class="gh-comment-text">${comment.text}</div>
          </div>
          <div class="gh-comment-actions">
            <button class="gh-comment-like" type="button"><i class="fas fa-heart"></i> <span>${comment.likes || 0}</span></button>
            ${isReply ? '' : '<button class="gh-comment-reply" type="button">Reply</button>'}
          </div>
        </div>
        ${!isReply && comment.replies?.length ? `<div class="gh-replies">${comment.replies.map(reply => renderComment(reply, id, true)).join('')}</div>` : ''}
      </div>`;
  }

  function openComments(id) {
    const comments = seededComments(id);
    openModal('Comments', `
      <div class="gh-comments-list" data-social-id="${id}">
        ${comments.length ? comments.map(comment => renderComment(comment, id)).join('') : '<div class="empty-profile-state"><h3>No comments yet</h3><p>Start the conversation as the current mock user.</p></div>'}
      </div>
      <form class="gh-comment-form" data-social-id="${id}">
        <input type="text" name="comment" placeholder="Add a comment as ${currentUser().fullName}..." autocomplete="off">
        <button type="submit">Post</button>
      </form>`);
  }

  function addComment(id, text, parentId) {
    if (!text.trim()) return;
    const comment = { id: `lc-${Date.now()}`, userId: currentUser().id, text: text.trim(), likes: 0, replies: [] };
    state.comments[id] = state.comments[id] || [];
    if (parentId) {
      const merged = JSON.parse(JSON.stringify(seededComments(id)));
      const parent = merged.find(item => item.id === parentId);
      if (parent) parent.replies = [...(parent.replies || []), comment];
      state.comments[id] = merged;
    } else {
      state.comments[id].push(comment);
    }
    saveState();
    refresh();
    openComments(id);
  }

  function toggleReaction(id, type, btn) {
    state.reactions[id] = state.reactions[id] || {};
    state.reactions[id][type] = !state.reactions[id][type];
    saveState();
    btn?.classList.add('pulse');
    setTimeout(() => btn?.classList.remove('pulse'), 350);
    refreshReactions();
  }

  function renderReactionRow(card, id) {
    let row = card.querySelector('.gh-reaction-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'gh-reaction-row';
      const actions = card.querySelector('.ci-actions, .event-footer, .deal-footer, .ch-feed-footer, .place-card-body, .prv-foot, .ch-foot');
      if (actions) actions.insertAdjacentElement(actions.classList.contains('ci-actions') ? 'beforebegin' : 'afterend', row);
      else card.appendChild(row);
    }
    const counts = reactionCounts(id);
    row.innerHTML = reactionTypes.slice(0, 4).map(([type, emoji, label]) =>
      `<button class="gh-react-btn ${activeReaction(id, type) ? 'active' : ''}" type="button" data-reaction="${type}" title="${label}">${emoji} <span>${counts[type]}</span></button>`
    ).join('') + `<button class="gh-react-btn ${activeReaction(id, 'saved') ? 'active' : ''}" type="button" data-reaction="saved" title="Saved">🔖 <span>${counts.saved}</span></button><button class="gh-react-btn gh-share-trigger" type="button" title="Share"><i class="fas fa-share-alt"></i> Share</button>`;
  }

  function refreshReactions() {
    document.querySelectorAll('[data-social-id]').forEach(card => renderReactionRow(card, card.dataset.socialId));
  }

  function commentCount(id) {
    return seededComments(id).reduce((sum, comment) => sum + 1 + (comment.replies?.length || 0), 0);
  }

  function enhanceFeedCards() {
    document.querySelectorAll('.feed-card').forEach((card, index) => {
      if (!card.dataset.socialId) {
        const postId = card.dataset.postId || card.dataset.feedType && window.MOCK_FEED_POSTS?.[index]?.id;
        card.dataset.socialId = postId || `feed-${index + 1}`;
      }
      const id = card.dataset.socialId;
      const commentBtn = [...card.querySelectorAll('.ci-action-btn, button')].find(btn => btn.textContent.includes('Comment') || btn.querySelector('.fa-comment'));
      if (commentBtn) {
        commentBtn.classList.add('gh-comment-trigger');
        commentBtn.innerHTML = `<i class="fas fa-comment"></i> <span>${commentCount(id)}</span>`;
      }
      const shareBtn = [...card.querySelectorAll('.ci-action-btn, button')].find(btn => btn.querySelector('.fa-share-alt'));
      if (shareBtn) shareBtn.classList.add('gh-share-trigger');
      renderReactionRow(card, id);
    });
  }

  function enhanceGenericActions() {
    document.querySelectorAll('.place-card, .challenge-card, .ccard, .featured-challenge, .group-card, .badge-card, .coupon-card, .reward-card, .info-card, .service-item, .review-card, .profile-gallery, .business-hero, .profile-identity').forEach((card, index) => {
      if (!card.dataset.socialId) card.dataset.socialId = itemId(card) || `generic-${index}`;
      if (!card.querySelector('.gh-generic-actions')) {
        card.insertAdjacentHTML('beforeend', `
          <div class="gh-reaction-row gh-generic-actions">
            <button class="gh-react-btn" type="button" data-reaction="like">👍 <span>0</span></button>
            <button class="gh-react-btn gh-share-trigger" type="button"><i class="fas fa-share-alt"></i> Share</button>
          </div>`);
      }
    });
  }

  function usernameFromProfilePage() {
    const param = new URLSearchParams(location.search).get('user');
    if (param) return decodeURIComponent(param);
    const handle = document.querySelector('.profile-handle')?.textContent?.match(/@([a-z0-9._-]+)/i)?.[1];
    return handle || null;
  }

  function setFollowButton(btn, username) {
    if (!username) return;
    const user = byUsername[username] || users.find(item => item.fullName === username);
    const key = user?.username || username;
    const following = Boolean(state.follows[key]);
    btn.dataset.followUser = key;
    btn.textContent = following ? 'Following' : 'Follow';
    btn.classList.toggle('following', following);
  }

  function refreshFollows() {
    document.querySelectorAll('.follow-btn, .cover-btn.primary, .profile-actions .btn-primary, .su-follow').forEach(btn => {
      const row = btn.closest('.following-row, .su-row, .profile-identity, .profile-cover');
      const href = row?.querySelector?.('a[href*="profile.html?user="]')?.getAttribute('href');
      const fromHref = href ? new URL(href, location.href).searchParams.get('user') : null;
      const username = btn.dataset.followUser || fromHref || usernameFromProfilePage();
      setFollowButton(btn, username);
    });
  }

  function toggleFollow(username) {
    if (!username) return;
    state.follows[username] = !state.follows[username];
    saveState();
    refreshFollows();
    updateFollowerStats(username, state.follows[username] ? 1 : -1);
    toast(state.follows[username] ? 'Following' : 'Unfollowed');
  }

  function updateFollowerStats(username, delta) {
    const pageUser = usernameFromProfilePage();
    if (pageUser && (pageUser === username || pageUser === byUsername[username]?.username)) {
      const followersStat = [...document.querySelectorAll('.pstat')].find(stat => stat.textContent.includes('Followers'))?.querySelector('.pstat-value');
      if (followersStat) {
        const raw = Number(String(followersStat.textContent).replace(/[^0-9]/g, '')) || 0;
        followersStat.textContent = Math.max(0, raw + delta);
      }
    }
  }

  function openShare(id) {
    const link = `${location.origin === 'null' ? '' : location.origin}${location.pathname}${location.search}#${id}`;
    const friends = (interactions.friendsToShare || []).map(id => byId[id]).filter(Boolean);
    openModal('Share', `
      <div class="gh-share-options" data-social-id="${id}">
        <button class="gh-share-option" data-share-action="copy"><i class="fas fa-link"></i><span>Copy link</span></button>
        <button class="gh-share-option" data-share-action="repost"><i class="fas fa-retweet"></i><span>Repost to feed mock</span></button>
        <button class="gh-share-option" data-share-action="qr"><i class="fas fa-qrcode"></i><span>QR share mock</span></button>
        <div class="gh-share-option" style="display:block">
          <div style="font-weight:800;margin-bottom:8px"><i class="fas fa-user-friends"></i> Share to friends</div>
          <div class="gh-friend-list">
            ${friends.map(user => `<button class="gh-friend-chip" data-share-friend="${user.username}"><img src="${user.avatar}" alt="${user.fullName}"><span>${user.fullName}</span></button>`).join('')}
          </div>
        </div>
        <input type="hidden" id="ghShareLink" value="${link}">
      </div>`);
  }

  function injectNotifications() {
    const nav = document.querySelector('.navbar');
    const hamburger = document.querySelector('.hamburger');
    if (!nav || document.querySelector('.gh-bell-wrap')) return;
    const html = `
      <div class="gh-bell-wrap">
        <button class="gh-bell-btn" type="button" aria-label="Notifications"><i class="fas fa-bell"></i></button>
        <span class="gh-bell-count">0</span>
        <div class="gh-notifications-panel"></div>
      </div>`;
    if (hamburger) hamburger.insertAdjacentHTML('beforebegin', html);
    else nav.insertAdjacentHTML('beforeend', html);
    document.querySelector('.gh-bell-btn').addEventListener('click', () => {
      document.querySelector('.gh-notifications-panel').classList.toggle('open');
    });
    renderNotifications();
  }

  function renderNotifications() {
    const unread = notifications.filter(n => n.unread && !state.readNotifications[n.id]).length;
    const count = document.querySelector('.gh-bell-count');
    if (count) {
      count.textContent = unread;
      count.style.display = unread ? 'flex' : 'none';
    }
    const panel = document.querySelector('.gh-notifications-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="gh-panel-head"><div class="gh-panel-title">Notifications</div><button class="gh-link-btn" data-mark-all-read>Mark all read</button></div>
      ${notifications.map(n => {
        const unreadState = n.unread && !state.readNotifications[n.id];
        const user = byId[n.userId];
        return `<a class="gh-notification-item ${unreadState ? 'unread' : ''}" href="${n.href}" data-notification-id="${n.id}">
          <div class="gh-notification-icon"><i class="fas fa-${n.icon}"></i></div>
          <div><div class="gh-notification-title">${n.title}</div><div class="gh-notification-body">${n.body}</div><div class="gh-notification-time">${user ? user.fullName + ' · ' : ''}${n.time}</div></div>
        </a>`;
      }).join('')}`;
  }

  function injectActivityWidget() {
    if (document.querySelector('.gh-activity-widget')) return;
    const target = document.querySelector('.feed-sidebar, .profile-sidebar, .places-sidebar, .business-sidebar, .rewards-sidebar, .challenge-sidebar, aside');
    if (!target) return;
    target.insertAdjacentHTML('beforeend', `
      <div class="gh-activity-widget">
        <div class="gh-activity-title">Recent Activity</div>
        ${(interactions.activity || []).map(item => {
          const user = byId[item.userId];
          return `<a class="gh-activity-item" href="${item.href}">
            <div class="gh-activity-icon">${item.icon}</div>
            <div class="gh-activity-text"><strong>${user?.fullName || 'Someone'}</strong> ${item.text}</div>
          </a>`;
        }).join('')}
      </div>`);
  }

  function openMessageModal() {
    const user = byUsername[usernameFromProfilePage()] || currentUser();
    openModal('Message', `
      <div class="gh-share-options">
        <div class="gh-share-option" style="cursor:default"><i class="fas fa-message"></i><span>Mock message to ${user.fullName}</span></div>
        <form class="gh-comment-form" data-message-form>
          <input name="message" placeholder="Write a mock message..." autocomplete="off">
          <button type="submit">Send</button>
        </form>
      </div>`);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const reactBtn = event.target.closest('.gh-react-btn[data-reaction]');
      if (reactBtn) {
        toggleReaction(itemId(reactBtn), reactBtn.dataset.reaction, reactBtn);
        return;
      }
      const commentBtn = event.target.closest('.gh-comment-trigger');
      if (commentBtn) {
        openComments(itemId(commentBtn));
        return;
      }
      const shareBtn = event.target.closest('.gh-share-trigger, .cover-btn:first-child');
      if (shareBtn) {
        event.preventDefault();
        openShare(itemId(shareBtn));
        return;
      }
      const followBtn = event.target.closest('.follow-btn, .cover-btn.primary, .profile-actions .btn-primary, .su-follow');
      if (followBtn && !followBtn.closest('.gh-modal')) {
        event.preventDefault();
        toggleFollow(followBtn.dataset.followUser || usernameFromProfilePage());
        return;
      }
      const markAll = event.target.closest('[data-mark-all-read]');
      if (markAll) {
        notifications.forEach(n => state.readNotifications[n.id] = true);
        saveState();
        renderNotifications();
        return;
      }
      const notification = event.target.closest('.gh-notification-item');
      if (notification) {
        state.readNotifications[notification.dataset.notificationId] = true;
        saveState();
        renderNotifications();
        return;
      }
      const commentLike = event.target.closest('.gh-comment-like');
      if (commentLike) {
        const count = commentLike.querySelector('span');
        count.textContent = (Number(count.textContent) || 0) + 1;
        commentLike.style.color = 'var(--green-light)';
        return;
      }
      const reply = event.target.closest('.gh-comment-reply');
      if (reply) {
        const item = reply.closest('.gh-comment-item');
        const id = item.dataset.socialId;
        const parentId = item.dataset.commentId;
        const input = document.querySelector('.gh-comment-form input');
        input.value = `@${item.querySelector('.gh-comment-name').textContent.trim()} `;
        input.focus();
        document.querySelector('.gh-comment-form').dataset.replyTo = parentId;
        document.querySelector('.gh-modal-title').textContent = 'Reply';
        return;
      }
      const shareAction = event.target.closest('[data-share-action]');
      if (shareAction) {
        const action = shareAction.dataset.shareAction;
        if (action === 'copy') {
          const link = document.getElementById('ghShareLink')?.value || location.href;
          navigator.clipboard?.writeText(link).catch(() => {});
          toast('Link copied');
        } else if (action === 'repost') {
          state.shared.push({ id: itemId(shareAction), userId: currentUser().id, time: Date.now() });
          saveState();
          toast('Reposted to mock feed');
        } else {
          toast('QR share generated');
        }
        return;
      }
      const friend = event.target.closest('[data-share-friend]');
      if (friend) {
        toast(`Shared to ${friend.textContent.trim()}`);
      }
    });

    document.addEventListener('submit', event => {
      const form = event.target.closest('.gh-comment-form');
      if (form && form.dataset.socialId) {
        event.preventDefault();
        addComment(form.dataset.socialId, form.comment.value, form.dataset.replyTo);
      }
      if (form && form.hasAttribute('data-message-form')) {
        event.preventDefault();
        closeModal();
        toast('Mock message sent');
      }
    });
  }

  function refresh() {
    document.querySelector('.cover-actions .cover-btn:first-child')?.classList.add('gh-share-trigger');
    enhanceFeedCards();
    enhanceGenericActions();
    refreshReactions();
    refreshFollows();
    injectActivityWidget();
    renderNotifications();
  }

  function init() {
    injectNotifications();
    injectActivityWidget();
    bindEvents();
    refresh();
    const messageBtn = document.querySelector('.profile-actions .btn-ghost');
    if (messageBtn) messageBtn.addEventListener('click', openMessageModal);
  }

  window.GeoHubSocial = { refresh, openComments, openShare };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
