/* ================================================================
   GeoHub — Growth Module
   People you may know, trending places / posts / users.
   All queries are Firestore-driven; renders empty state if no data.
   ================================================================ */
(function () {
  'use strict';

  var _db, _fs;

  // ── HELPERS ───────────────────────────────────────────────────

  function safeEsc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function sevenDaysAgo() {
    var d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }

  // ── QUERIES ───────────────────────────────────────────────────

  function getPeopleYouMayKnow(uid, city, maxItems) {
    maxItems = maxItems || 6;
    var constraints = [_fs.orderBy('followerCount', 'desc'), _fs.limit(maxItems + 5)];
    if (city && city !== 'all_georgia') {
      constraints.unshift(_fs.where('city', '==', city));
    }
    var q = _fs.query.apply(null, [_fs.collection(_db, 'users')].concat(constraints));
    return _fs.getDocs(q).then(function (snap) {
      var results = [];
      snap.forEach(function (doc) {
        if (doc.id !== uid && results.length < maxItems) {
          var d = doc.data();
          results.push({ id: doc.id, displayName: d.displayName, fullName: d.fullName, photoURL: d.photoURL, city: d.city, followerCount: d.followerCount || 0 });
        }
      });
      return results;
    });
  }

  function getTrendingPlaces(city, maxItems) {
    maxItems = maxItems || 5;
    var constraints = [_fs.orderBy('checkinCount', 'desc'), _fs.limit(maxItems)];
    if (city && city !== 'all_georgia') {
      constraints.unshift(_fs.where('city', '==', city));
    }
    var q = _fs.query.apply(null, [_fs.collection(_db, 'places')].concat(constraints));
    return _fs.getDocs(q).then(function (snap) {
      var results = [];
      snap.forEach(function (doc) {
        var d = doc.data();
        results.push({ id: doc.id, name: d.name, category: d.category, city: d.city, checkinCount: d.checkinCount || 0 });
      });
      return results;
    });
  }

  function getTrendingPosts(city, maxItems) {
    maxItems = maxItems || 5;
    var cutoff = sevenDaysAgo();
    var constraints = [_fs.where('createdAt', '>=', cutoff), _fs.orderBy('createdAt', 'desc'), _fs.limit(maxItems * 2)];
    if (city && city !== 'all_georgia') {
      constraints.unshift(_fs.where('city', '==', city));
    }
    var q = _fs.query.apply(null, [_fs.collection(_db, 'posts')].concat(constraints));
    return _fs.getDocs(q).then(function (snap) {
      var results = [];
      snap.forEach(function (doc) {
        var d = doc.data();
        results.push({ id: doc.id, text: d.text, city: d.city, likeCount: d.likeCount || 0 });
      });
      // Sort by likeCount client-side (Firestore can't compound-orderBy without index for city+date+likes)
      results.sort(function (a, b) { return b.likeCount - a.likeCount; });
      return results.slice(0, maxItems);
    });
  }

  function getTrendingUsers(city, maxItems) {
    maxItems = maxItems || 5;
    var constraints = [_fs.orderBy('followerCount', 'desc'), _fs.limit(maxItems)];
    if (city && city !== 'all_georgia') {
      constraints.unshift(_fs.where('city', '==', city));
    }
    var q = _fs.query.apply(null, [_fs.collection(_db, 'users')].concat(constraints));
    return _fs.getDocs(q).then(function (snap) {
      var results = [];
      snap.forEach(function (doc) {
        var d = doc.data();
        results.push({ id: doc.id, displayName: d.displayName, fullName: d.fullName, photoURL: d.photoURL, city: d.city, followerCount: d.followerCount || 0 });
      });
      return results;
    });
  }

  // ── RENDER HELPERS ────────────────────────────────────────────

  function avatarHtml(user, size) {
    size = size || 40;
    if (user.photoURL) {
      return '<img src="' + safeEsc(user.photoURL) + '" alt="" class="growth-avatar" width="' + size + '" height="' + size + '">';
    }
    var initial = ((user.displayName || user.fullName || 'U')[0] || 'U').toUpperCase();
    return '<div class="growth-avatar growth-avatar-initial">' + safeEsc(initial) + '</div>';
  }

  function emptyState(icon, msg) {
    return '<div class="growth-empty"><i class="' + icon + '"></i><span>' + msg + '</span></div>';
  }

  function loadingHtml() {
    return '<div class="growth-loading"><i class="fas fa-spinner fa-spin"></i></div>';
  }

  // ── RENDER SECTIONS ───────────────────────────────────────────

  function renderPeopleYouMayKnow(containerId, uid, city) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = loadingHtml();

    getPeopleYouMayKnow(uid, city, 6).then(function (people) {
      if (!people.length) {
        el.innerHTML = emptyState('fas fa-users', 'No suggestions yet — invite friends to build your network!');
        return;
      }
      el.innerHTML =
        '<div class="growth-section-title"><i class="fas fa-user-group"></i> People You May Know</div>' +
        '<div class="growth-people-list">' +
          people.map(function (u) {
            var name = safeEsc(u.displayName || u.fullName || 'User');
            var loc  = u.city ? safeEsc(u.city) : 'Georgia';
            return '<div class="growth-person-card">' +
              '<a href="profile.html?uid=' + safeEsc(u.id) + '" class="growth-person-link">' +
                avatarHtml(u) +
                '<div class="growth-person-info">' +
                  '<div class="growth-person-name">' + name + '</div>' +
                  '<div class="growth-person-meta">' + loc + ' · ' + (u.followerCount || 0) + ' followers</div>' +
                '</div>' +
              '</a>' +
              '<a href="profile.html?uid=' + safeEsc(u.id) + '" class="growth-follow-btn">Follow</a>' +
            '</div>';
          }).join('') +
        '</div>';
    }).catch(function () {
      el.innerHTML = emptyState('fas fa-users', 'Suggestions unavailable right now.');
    });
  }

  function renderTrendingPlaces(containerId, city) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = loadingHtml();

    getTrendingPlaces(city, 5).then(function (places) {
      if (!places.length) {
        el.innerHTML = emptyState('fas fa-location-dot', 'No places yet — be the first to check in!');
        return;
      }
      el.innerHTML =
        '<div class="growth-section-title"><i class="fas fa-location-dot"></i> Trending Places</div>' +
        '<div class="growth-list">' +
          places.map(function (p, i) {
            return '<a href="places.html?id=' + safeEsc(p.id) + '" class="growth-list-item">' +
              '<span class="growth-rank">' + (i + 1) + '</span>' +
              '<div class="growth-item-info">' +
                '<div class="growth-item-name">' + safeEsc(p.name || 'Place') + '</div>' +
                '<div class="growth-item-meta">' + safeEsc(p.category || p.city || 'Georgia') + ' · ' + (p.checkinCount || 0) + ' check-ins</div>' +
              '</div>' +
              '<i class="fas fa-chevron-right growth-chevron"></i>' +
            '</a>';
          }).join('') +
        '</div>';
    }).catch(function () {
      el.innerHTML = emptyState('fas fa-location-dot', 'Trending places unavailable.');
    });
  }

  function renderTrendingPosts(containerId, city) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = loadingHtml();

    getTrendingPosts(city, 5).then(function (posts) {
      if (!posts.length) {
        el.innerHTML = emptyState('fas fa-fire', 'No trending posts yet — create the first one!');
        return;
      }
      el.innerHTML =
        '<div class="growth-section-title"><i class="fas fa-fire"></i> Trending This Week</div>' +
        '<div class="growth-list">' +
          posts.map(function (p, i) {
            var preview = safeEsc((p.text || '').slice(0, 72) + ((p.text || '').length > 72 ? '…' : ''));
            return '<a href="feed.html?post=' + safeEsc(p.id) + '" class="growth-list-item">' +
              '<span class="growth-rank">' + (i + 1) + '</span>' +
              '<div class="growth-item-info">' +
                '<div class="growth-item-name">' + (preview || 'Post') + '</div>' +
                '<div class="growth-item-meta">' + (p.likeCount || 0) + ' likes' + (p.city ? ' · ' + safeEsc(p.city) : '') + '</div>' +
              '</div>' +
              '<i class="fas fa-chevron-right growth-chevron"></i>' +
            '</a>';
          }).join('') +
        '</div>';
    }).catch(function () {
      el.innerHTML = emptyState('fas fa-fire', 'Trending posts unavailable.');
    });
  }

  function renderTrendingUsers(containerId, city) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = loadingHtml();

    getTrendingUsers(city, 5).then(function (users) {
      if (!users.length) {
        el.innerHTML = emptyState('fas fa-trophy', 'No top users yet.');
        return;
      }
      el.innerHTML =
        '<div class="growth-section-title"><i class="fas fa-trophy"></i> Top Explorers</div>' +
        '<div class="growth-people-list">' +
          users.map(function (u, i) {
            var name = safeEsc(u.displayName || u.fullName || 'User');
            return '<div class="growth-person-card">' +
              '<a href="profile.html?uid=' + safeEsc(u.id) + '" class="growth-person-link">' +
                '<span class="growth-rank" style="margin-right:10px">' + (i + 1) + '</span>' +
                avatarHtml(u) +
                '<div class="growth-person-info">' +
                  '<div class="growth-person-name">' + name + '</div>' +
                  '<div class="growth-person-meta">' + (u.followerCount || 0) + ' followers</div>' +
                '</div>' +
              '</a>' +
            '</div>';
          }).join('') +
        '</div>';
    }).catch(function () {
      el.innerHTML = emptyState('fas fa-trophy', 'Leaderboard unavailable.');
    });
  }

  // ── INIT ──────────────────────────────────────────────────────

  function init(fb) {
    _db = fb.db;
    _fs = fb.fs;

    window.GeoGrowth = {
      getPeopleYouMayKnow:  getPeopleYouMayKnow,
      getTrendingPlaces:    getTrendingPlaces,
      getTrendingPosts:     getTrendingPosts,
      getTrendingUsers:     getTrendingUsers,
      renderPeopleYouMayKnow: renderPeopleYouMayKnow,
      renderTrendingPlaces:   renderTrendingPlaces,
      renderTrendingPosts:    renderTrendingPosts,
      renderTrendingUsers:    renderTrendingUsers,
    };
  }

  if (window.GeoFirebase) {
    init(window.GeoFirebase);
  } else {
    window.addEventListener('GeoFirebaseReady', function () { init(window.GeoFirebase); }, { once: true });
  }
})();
