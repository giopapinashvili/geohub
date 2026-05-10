/* ================================================================
   GeoHub — API Client  (Mock Mode)
   ----------------------------------------------------------------
   All functions return Promise<{ success, data }> or
   Promise<{ success: false, error, code }>.

   HOW TO MIGRATE TO REAL BACKEND:
   Each function has a marked TODO comment showing the real
   fetch() call that should replace the mock body.
   Steps:
     1. Set GeoConfig.DEMO_MODE = false
     2. Set GeoConfig.API_BASE_URL to your real endpoint
     3. Replace each function body with the fetch() pattern shown
     4. Add Authorization header using getToken() helper below
   ================================================================ */

(function () {
  'use strict';

  /* ── Config / helpers ──────────────────────────────────────── */
  var CFG = window.GeoConfig || {};
  var SK  = CFG.STORAGE_KEYS || {
    authUser: 'geohub_auth_user', authToken: 'geohub_auth_token',
    registeredUsers: 'geohub_registered_users',
    checkins: 'geohub_checkins', rewardClaims: 'geohub_reward_claims',
    challengeProgress: 'geohub_challenge_progress',
    tickets: 'geohub_tickets', messages: 'geohub_messages',
    reports: 'geohub_reports', campaigns: 'geohub_campaigns',
    collabOffers: 'geohub_collab_offers',
    serviceRequests: 'geohub_service_requests',
    lessonBookings: 'geohub_lesson_bookings',
  };
  var MOCK_DELAY = (CFG.MOCK && CFG.MOCK.delay) || { min: 180, max: 700 };

  function rls(key) {
    try { var v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }
  function wls(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  function sim() {
    var ms = MOCK_DELAY.min + Math.random() * (MOCK_DELAY.max - MOCK_DELAY.min);
    return new Promise(function (res) { setTimeout(res, ms); });
  }
  function ok(data)         { return { success: true,  data: data }; }
  function fail(msg, code)  { return { success: false, error: msg, code: code || 400 }; }

  function curUser()    { return rls(SK.authUser); }
  function getToken()   { return rls(SK.authToken) || 'mock_token'; }
  function requireAuth() {
    var u = curUser();
    if (!u) throw { code: 401, message: 'Authentication required' };
    return u;
  }
  function uid() { return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5); }

  /* ── REAL FETCH PATTERN (reference, not used yet) ────────────
  function apiFetch(method, path, body) {
    // TODO: Use this pattern to replace each mock function below
    return fetch(CFG.API_BASE_URL + path, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken(),
        'X-App-Version': CFG.APP_VERSION || '1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    .then(function(r) { return r.json(); })
    .catch(function(e) { return fail('Network error: ' + e.message, 0); });
  }
  ──────────────────────────────────────────────────────────── */

  /* ================================================================
     AUTH
  ================================================================ */

  function login(identifier, password) {
    // TODO: return apiFetch('POST', '/auth/login', { identifier, password });
    return sim().then(function () {
      var users = rls(SK.registeredUsers) || [];
      var id    = String(identifier).trim().toLowerCase();
      var user  = users.find(function (u) {
        return u.email === id ||
               u.username.toLowerCase() === id ||
               u.username === String(identifier).trim();
      });
      if (user && (String(password) === user.password || String(password) === 'demo123')) {
        var token = 'mock_jwt_' + user.id + '_' + Date.now();
        wls(SK.authUser,  user);
        wls(SK.authToken, token);
        return ok({ user: user, token: token });
      }
      return fail('Invalid credentials. Use demo123 as password for any mock user.', 401);
    });
  }

  function signup(data) {
    // TODO: return apiFetch('POST', '/auth/signup', data);
    return sim().then(function () {
      var users = rls(SK.registeredUsers) || [];
      if (users.find(function (u) {
        return u.username.toLowerCase() === String(data.username).toLowerCase();
      })) return fail('Username already taken.', 409);
      if (users.find(function (u) {
        return u.email.toLowerCase() === String(data.email).toLowerCase();
      })) return fail('Email already registered.', 409);

      var seed = String(data.username).replace(/\W/g, '') || 'u' + Date.now();
      var newUser = {
        id:             uid(),
        fullName:       data.fullName,
        username:       data.username,
        email:          data.email,
        password:       data.password,
        avatar:         'https://picsum.photos/seed/' + seed + '/200/200',
        coverImage:     'https://picsum.photos/seed/' + seed + 'cv/1200/500',
        bio:            '',
        city:           data.city || 'Tbilisi',
        explorerLevel:  'Bronze Explorer',
        xp:             0, rank: 9999, badges: [],
        interests:      data.interests || [],
        followers:      0, following: 0, postsCount: 0, visitedPlaces: 0,
        trustScore:     70, accountType: data.accountType || 'Explorer',
        isNew:          true, createdAt: Date.now(),
      };
      users.push(newUser);
      var token = 'mock_jwt_' + newUser.id + '_' + Date.now();
      wls(SK.registeredUsers, users);
      wls(SK.authUser,  newUser);
      wls(SK.authToken, token);
      return ok({ user: newUser, token: token });
    });
  }

  function logout() {
    // TODO: return apiFetch('POST', '/auth/logout');
    return sim().then(function () {
      try { localStorage.removeItem(SK.authUser); } catch (e) {}
      try { localStorage.removeItem(SK.authToken); } catch (e) {}
      return ok({ message: 'Logged out successfully.' });
    });
  }

  function getCurrentUser() {
    // TODO: return apiFetch('GET', '/auth/me');
    return sim().then(function () {
      var u = curUser();
      return u ? ok({ user: u }) : fail('Not authenticated.', 401);
    });
  }

  function updateProfile(updates) {
    // TODO: return apiFetch('PATCH', '/auth/me', updates);
    return sim().then(function () {
      try { var u = requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var merged = Object.assign({}, curUser(), updates);
      wls(SK.authUser, merged);
      // Sync in pool
      var users = rls(SK.registeredUsers) || [];
      var idx = users.findIndex(function (u) { return u.id === merged.id; });
      if (idx !== -1) { users[idx] = merged; wls(SK.registeredUsers, users); }
      return ok({ user: merged });
    });
  }

  /* ================================================================
     FEED
  ================================================================ */

  function getFeed(params) {
    // TODO: return apiFetch('GET', '/feed?' + new URLSearchParams(params));
    return sim().then(function () {
      var posts = window.MOCK_FEED_POSTS || [];
      var page  = (params && params.page)  || 1;
      var limit = (params && params.limit) || 12;
      var start = (page - 1) * limit;
      return ok({
        posts:   posts.slice(start, start + limit),
        total:   posts.length,
        page:    page,
        hasMore: start + limit < posts.length,
      });
    });
  }

  function createPost(data) {
    // TODO: return apiFetch('POST', '/feed/posts', data);
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      return ok({ post: Object.assign({ id: uid(), userId: curUser().id, createdAt: Date.now() }, data) });
    });
  }

  function createCheckin(placeId, data) {
    // TODO: return apiFetch('POST', '/checkins', { placeId, ...data });
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var xp = (CFG.MOCK && CFG.MOCK.xpPerCheckin) || 35;
      var ci = Object.assign({
        id: uid(), placeId: placeId,
        userId: curUser().id, xpEarned: xp, createdAt: Date.now(),
      }, data);
      var list = rls(SK.checkins) || [];
      list.push(ci);
      wls(SK.checkins, list);
      return ok({ checkin: ci, xpEarned: xp });
    });
  }

  /* ================================================================
     PLACES
  ================================================================ */

  function getPlaces(filters) {
    // TODO: return apiFetch('GET', '/places?' + new URLSearchParams(filters));
    return sim().then(function () {
      var places = window.BUSINESSES || window.MOCK_BUSINESSES || [];
      if (filters) {
        if (filters.city)     places = places.filter(function (p) { return p.city === filters.city; });
        if (filters.category) places = places.filter(function (p) { return p.category === filters.category; });
        if (filters.q)        places = places.filter(function (p) {
          var q = filters.q.toLowerCase();
          return (p.name || '').toLowerCase().includes(q) || (p.city || '').toLowerCase().includes(q);
        });
      }
      return ok({ places: places, total: places.length });
    });
  }

  function getPlace(placeId) {
    // TODO: return apiFetch('GET', '/places/' + placeId);
    return sim().then(function () {
      var places = window.BUSINESSES || [];
      var place  = places.find(function (p) { return String(p.id) === String(placeId); });
      return place ? ok({ place: place }) : fail('Place not found.', 404);
    });
  }

  /* ================================================================
     REWARDS
  ================================================================ */

  function getRewards(params) {
    // TODO: return apiFetch('GET', '/rewards');
    return sim().then(function () {
      var rewards = window.MOCK_REWARDS || [];
      return ok({ rewards: rewards, total: rewards.length });
    });
  }

  function claimReward(rewardId) {
    // TODO: return apiFetch('POST', '/rewards/' + rewardId + '/claim');
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var claims = rls(SK.rewardClaims) || [];
      if (claims.find(function (c) {
        return c.rewardId === rewardId && c.userId === curUser().id;
      })) return fail('Reward already claimed.', 409);

      var claim = {
        id: uid(), rewardId: rewardId, userId: curUser().id,
        code: 'GH-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
        claimedAt: Date.now(), status: 'active',
      };
      claims.push(claim);
      wls(SK.rewardClaims, claims);
      return ok({ claim: claim });
    });
  }

  /* ================================================================
     CHALLENGES
  ================================================================ */

  function getChallenges(params) {
    // TODO: return apiFetch('GET', '/challenges');
    return sim().then(function () {
      var ch = window.MOCK_CHALLENGES || [];
      return ok({ challenges: ch, total: ch.length });
    });
  }

  function joinChallenge(challengeId) {
    // TODO: return apiFetch('POST', '/challenges/' + challengeId + '/join');
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var progress = rls(SK.challengeProgress) || [];
      var existing = progress.find(function (p) {
        return p.challengeId === challengeId && p.userId === curUser().id;
      });
      if (existing) return ok({ progress: existing, alreadyJoined: true });
      var entry = {
        challengeId: challengeId, userId: curUser().id,
        joinedAt: Date.now(), progress: 0, completed: false,
      };
      progress.push(entry);
      wls(SK.challengeProgress, progress);
      return ok({ progress: entry });
    });
  }

  /* ================================================================
     EVENTS
  ================================================================ */

  function getEvents(params) {
    // TODO: return apiFetch('GET', '/events?' + new URLSearchParams(params));
    return sim().then(function () {
      var events = window.MOCK_EVENTS || [];
      if (params && params.city) {
        events = events.filter(function (e) { return e.city === params.city; });
      }
      return ok({ events: events, total: events.length });
    });
  }

  function bookTicket(eventId, quantity) {
    // TODO: return apiFetch('POST', '/events/' + eventId + '/tickets', { quantity });
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var ticket = {
        id: uid(), eventId: eventId, userId: curUser().id,
        quantity: quantity || 1, status: 'confirmed',
        code: 'TK-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
        bookedAt: Date.now(),
      };
      var list = rls(SK.tickets) || [];
      list.push(ticket);
      wls(SK.tickets, list);
      return ok({ ticket: ticket });
    });
  }

  /* ================================================================
     MESSAGES
  ================================================================ */

  function getMessages(conversationId) {
    // TODO: return apiFetch('GET', '/messages/' + (conversationId || ''));
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var all  = rls(SK.messages) || [];
      var msgs = conversationId
        ? all.filter(function (m) { return m.conversationId === conversationId; })
        : all;
      return ok({ messages: msgs, total: msgs.length });
    });
  }

  function sendMessage(conversationId, text, recipientId) {
    // TODO: return apiFetch('POST', '/messages', { conversationId, text, recipientId });
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var msg = {
        id: uid(), conversationId: conversationId,
        senderId: curUser().id, recipientId: recipientId,
        text: text, sentAt: Date.now(), read: false,
      };
      var all = rls(SK.messages) || [];
      all.push(msg);
      wls(SK.messages, all);
      return ok({ message: msg });
    });
  }

  /* ================================================================
     BUSINESSES
  ================================================================ */

  function getBusinesses(filters) {
    // TODO: return apiFetch('GET', '/businesses?' + new URLSearchParams(filters));
    return sim().then(function () {
      var biz = window.BUSINESSES || window.MOCK_BUSINESSES || [];
      if (filters && filters.category) {
        biz = biz.filter(function (b) { return b.category === filters.category; });
      }
      if (filters && filters.city) {
        biz = biz.filter(function (b) { return b.city === filters.city; });
      }
      return ok({ businesses: biz, total: biz.length });
    });
  }

  function createCampaign(data) {
    // TODO: return apiFetch('POST', '/campaigns', data);
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var campaign = Object.assign({
        id: uid(), ownerId: curUser().id, status: 'active', createdAt: Date.now(),
      }, data);
      var list = rls(SK.campaigns) || [];
      list.push(campaign);
      wls(SK.campaigns, list);
      return ok({ campaign: campaign });
    });
  }

  /* ================================================================
     CREATORS
  ================================================================ */

  function getCreators(params) {
    // TODO: return apiFetch('GET', '/creators?' + new URLSearchParams(params));
    return sim().then(function () {
      var creators = (window.MOCK_USERS || []).filter(function (u) {
        return u.accountType === 'Creator';
      });
      return ok({ creators: creators, total: creators.length });
    });
  }

  function sendCollabOffer(creatorId, offerData) {
    // TODO: return apiFetch('POST', '/creators/' + creatorId + '/offers', offerData);
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var offer = Object.assign({
        id: uid(), fromUserId: curUser().id,
        toCreatorId: creatorId, status: 'pending', sentAt: Date.now(),
      }, offerData);
      var list = rls(SK.collabOffers) || [];
      list.push(offer);
      wls(SK.collabOffers, list);
      return ok({ offer: offer });
    });
  }

  /* ================================================================
     REAL ESTATE
  ================================================================ */

  function getListings(filters) {
    // TODO: return apiFetch('GET', '/real-estate?' + new URLSearchParams(filters));
    return sim().then(function () {
      var listings = window.MOCK_LISTINGS || window.MOCK_REAL_ESTATE || [];
      if (filters && filters.city) {
        listings = listings.filter(function (l) { return l.city === filters.city; });
      }
      return ok({ listings: listings, total: listings.length });
    });
  }

  /* ================================================================
     SERVICES
  ================================================================ */

  function requestService(providerId, data) {
    // TODO: return apiFetch('POST', '/services/' + providerId + '/request', data);
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var req = Object.assign({
        id: uid(), userId: curUser().id, providerId: providerId,
        status: 'pending', requestedAt: Date.now(),
      }, data);
      var list = rls(SK.serviceRequests) || [];
      list.push(req);
      wls(SK.serviceRequests, list);
      return ok({ request: req });
    });
  }

  /* ================================================================
     LEARNING
  ================================================================ */

  function bookLesson(teacherId, data) {
    // TODO: return apiFetch('POST', '/lessons/book', { teacherId, ...data });
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var booking = Object.assign({
        id: uid(), studentId: curUser().id, teacherId: teacherId,
        status: 'confirmed', confirmedAt: Date.now(),
        code: 'LS-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      }, data);
      var list = rls(SK.lessonBookings) || [];
      list.push(booking);
      wls(SK.lessonBookings, list);
      return ok({ booking: booking });
    });
  }

  /* ================================================================
     TRUST / REPORTS
  ================================================================ */

  function submitReport(targetId, targetType, reason, details) {
    // TODO: return apiFetch('POST', '/reports', { targetId, targetType, reason, details });
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var report = {
        id: uid(), reporterId: curUser().id,
        targetId: targetId, targetType: targetType,
        reason: reason, details: details,
        status: 'pending', submittedAt: Date.now(),
      };
      var list = rls(SK.reports) || [];
      list.push(report);
      wls(SK.reports, list);
      return ok({ report: report, message: 'Report submitted. Our team will review it shortly.' });
    });
  }

  /* ================================================================
     NOTIFICATIONS
  ================================================================ */

  function getNotifications() {
    // TODO: return apiFetch('GET', '/notifications');
    return sim().then(function () {
      try { requireAuth(); } catch (e) { return fail(e.message, e.code); }
      var notifs = rls('geohub_notifications') || [];
      return ok({ notifications: notifs, unread: notifs.filter(function (n) { return !n.read; }).length });
    });
  }

  function markNotificationsRead() {
    // TODO: return apiFetch('POST', '/notifications/read');
    return sim().then(function () {
      var notifs = (rls('geohub_notifications') || []).map(function (n) {
        return Object.assign({}, n, { read: true });
      });
      wls('geohub_notifications', notifs);
      return ok({ updated: notifs.length });
    });
  }

  /* ================================================================
     PUBLIC API — window.GeoAPI
     Usage: GeoAPI.login('user@email.com', 'password').then(r => { ... })
  ================================================================ */
  window.GeoAPI = {
    // Auth
    login:                login,
    signup:               signup,
    logout:               logout,
    getCurrentUser:       getCurrentUser,
    updateProfile:        updateProfile,
    // Feed
    getFeed:              getFeed,
    createPost:           createPost,
    createCheckin:        createCheckin,
    // Places
    getPlaces:            getPlaces,
    getPlace:             getPlace,
    // Rewards
    getRewards:           getRewards,
    claimReward:          claimReward,
    // Challenges
    getChallenges:        getChallenges,
    joinChallenge:        joinChallenge,
    // Events
    getEvents:            getEvents,
    bookTicket:           bookTicket,
    // Messages
    getMessages:          getMessages,
    sendMessage:          sendMessage,
    // Businesses
    getBusinesses:        getBusinesses,
    createCampaign:       createCampaign,
    // Creators
    getCreators:          getCreators,
    sendCollabOffer:      sendCollabOffer,
    // Real Estate
    getListings:          getListings,
    // Services
    requestService:       requestService,
    // Learning
    bookLesson:           bookLesson,
    // Trust
    submitReport:         submitReport,
    // Notifications
    getNotifications:     getNotifications,
    markNotificationsRead: markNotificationsRead,
  };

})();
