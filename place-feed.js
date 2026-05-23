(function () {
  'use strict';

  // ── Category config ────────────────────────────────────────────
  const PLACE_CATS = {
    food:          { icon: '🍔', label: 'რესტორნები',  color: '#e74c3c', bg: 'rgba(231,76,60,.15)'  },
    cafe:          { icon: '☕', label: 'კაფე / ყავა', color: '#8e5a3c', bg: 'rgba(142,90,60,.15)'  },
    nightlife:     { icon: '🍸', label: 'ბარები',       color: '#8e44ad', bg: 'rgba(142,68,173,.15)' },
    shopping:      { icon: '🛍️',label: 'მაღაზიები',   color: '#3498db', bg: 'rgba(52,152,219,.15)'  },
    fitness:       { icon: '🏋️',label: 'ფიტნესი',     color: '#f39c12', bg: 'rgba(243,156,18,.15)'  },
    sports:        { icon: '🏃', label: 'სპორტი',      color: '#f39c12', bg: 'rgba(243,156,18,.15)'  },
    park:          { icon: '🌳', label: 'პარკი',        color: '#27ae60', bg: 'rgba(39,174,96,.15)'   },
    nature:        { icon: '🏞️',label: 'ბუნება',       color: '#2ecc71', bg: 'rgba(46,204,113,.15)'  },
    hotel:         { icon: '🏨', label: 'სასტუმრო',    color: '#0891b2', bg: 'rgba(8,145,178,.15)'   },
    beauty:        { icon: '✂️', label: 'სილამაზე',    color: '#ff66b3', bg: 'rgba(255,102,179,.15)' },
    entertainment: { icon: '🎬', label: 'გართობა',     color: '#f1c40f', bg: 'rgba(241,196,15,.15)'  },
    culture:       { icon: '🎭', label: 'კულტურა',     color: '#a67c52', bg: 'rgba(166,124,82,.15)'  },
    photo_spot:    { icon: '📸', label: 'ფოტო სპოტი',  color: '#db2777', bg: 'rgba(219,39,119,.15)'  },
    rooftop:       { icon: '🌃', label: 'Rooftop',      color: '#4f46e5', bg: 'rgba(79,70,229,.15)'   },
    animals:       { icon: '🐾', label: 'ცხოველები',   color: '#92400e', bg: 'rgba(146,64,14,.15)'   },
    landmark:      { icon: '📍', label: 'ღირსშესანიშ.',color: '#b45309', bg: 'rgba(180,83,9,.15)'    },
  };

  const RX = { love: '❤️', haha: '😂', wow: '😮', sad: '😢', angry: '😡', clap: '👏' };
  const PAGE_SIZE = 20;

  // ── State ──────────────────────────────────────────────────────
  let _db, _fs, _auth, _user;
  let _bizMap = {};         // { bizId: bizData }
  let _allPosts = [];       // all loaded posts (raw)
  let _userLikes = {};      // { postId: 'love'|'' }
  let _currentCat = '';
  let _lastDoc = null;
  let _loading = false;

  // ── Helpers ────────────────────────────────────────────────────
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    var el = $('pfToast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function() { el.classList.remove('show'); }, 2800);
  }
  function timeAgo(v) {
    if (!v) return '';
    var ms = typeof v.toMillis === 'function' ? v.toMillis() : (v.seconds ? v.seconds * 1000 : new Date(v).getTime());
    var diff = Date.now() - ms;
    if (diff < 60000)  return 'ახლახანს';
    if (diff < 3600000) return Math.floor(diff/60000) + ' წ. წინ';
    if (diff < 86400000) return Math.floor(diff/3600000) + ' სთ. წინ';
    return Math.floor(diff/86400000) + ' დ. წინ';
  }
  function catInfo(cat) {
    return PLACE_CATS[cat] || { icon: '📍', label: cat || 'Place', color: '#64748b', bg: 'rgba(100,116,139,.15)' };
  }
  function bizInitials(name) {
    return (name || 'B').split(' ').slice(0, 2).map(function(w) { return w[0]; }).join('').toUpperCase();
  }
  function getMediaUrls(p) {
    if (Array.isArray(p.mediaUrls) && p.mediaUrls.length) return p.mediaUrls;
    if (p.mediaUrl) return [p.mediaUrl];
    return [];
  }
  function formatCount(n) {
    n = Number(n) || 0;
    if (n >= 1000) return (n/1000).toFixed(1) + 'k';
    return String(n);
  }

  // ── Init Firebase ──────────────────────────────────────────────
  function ready(fn) {
    if (window.GeoFirebase && window.GeoFirebase.db) { fn(); return; }
    window.addEventListener('GeoFirebaseReady', fn, { once: true });
  }

  ready(function() {
    var GF = window.GeoFirebase;
    _db   = GF.db;
    _fs   = GF.fs;
    _auth = GF.auth;
    _user = window.GeoCurrentUser || (_auth && _auth.currentUser) || null;

    // Reload user if auth fires later
    if (_auth && _auth.onAuthStateChanged) {
      _auth.onAuthStateChanged(function(u) {
        _user = u || null;
        if (u) loadUserLikes();
      });
    }

    loadBusinesses();
  });

  // ── Load businesses ────────────────────────────────────────────
  function loadBusinesses() {
    _fs.getDocs(_fs.query(_fs.collection(_db, 'businesses'), _fs.limit(300)))
      .then(function(snap) {
        snap.forEach(function(d) {
          var biz = Object.assign({ id: d.id }, d.data());
          if (PLACE_CATS[biz.category]) _bizMap[d.id] = biz;
        });
        buildChips();
        loadPosts(true);
      })
      .catch(function() { loadPosts(true); });
  }

  // ── Build category chips ───────────────────────────────────────
  function buildChips() {
    var wrap = $('pfChips'); if (!wrap) return;

    // Collect which cats actually have businesses
    var usedCats = {};
    Object.values(_bizMap).forEach(function(b) {
      if (b.category && PLACE_CATS[b.category]) usedCats[b.category] = true;
    });

    var html = '<button class="pf-chip active" data-cat="">🗺️ ყველა</button>';
    Object.keys(PLACE_CATS).forEach(function(cat) {
      if (!usedCats[cat]) return;
      var c = PLACE_CATS[cat];
      html += '<button class="pf-chip" data-cat="' + esc(cat) + '">'
        + '<span class="pf-chip-dot" style="background:' + c.color + '"></span>'
        + esc(c.icon + ' ' + c.label)
        + '</button>';
    });

    wrap.innerHTML = html;
    wrap.querySelectorAll('.pf-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        wrap.querySelectorAll('.pf-chip').forEach(function(c) { c.classList.remove('active'); });
        chip.classList.add('active');
        _currentCat = chip.dataset.cat || '';
        _lastDoc = null;
        renderFeed(true);
      });
    });
  }

  // ── Skeleton loaders ───────────────────────────────────────────
  function showSkeletons(n) {
    var feed = $('pfFeed'); if (!feed) return;
    feed.innerHTML = Array.from({ length: n || 3 }, function() {
      return '<div class="pf-card-skel">'
        + '<div class="pf-skel-head">'
          + '<div class="pf-skeleton pf-skel-logo"></div>'
          + '<div class="pf-skel-lines">'
            + '<div class="pf-skeleton pf-skel-line" style="width:55%"></div>'
            + '<div class="pf-skeleton pf-skel-line" style="width:35%"></div>'
          + '</div>'
        + '</div>'
        + '<div class="pf-skeleton pf-skel-img"></div>'
        + '<div class="pf-skeleton pf-skel-text" style="width:90%"></div>'
        + '<div class="pf-skeleton pf-skel-text" style="width:70%"></div>'
        + '</div>';
    }).join('');
  }

  // ── Load posts ─────────────────────────────────────────────────
  function loadPosts(reset) {
    if (_loading) return;
    _loading = true;
    if (reset) showSkeletons(4);

    // Build query: posts by businesses (actorType = business OR authorType = business)
    var q = _fs.query(
      _fs.collection(_db, 'posts'),
      _fs.where('authorType', '==', 'business'),
      _fs.orderBy('createdAt', 'desc'),
      _fs.limit(PAGE_SIZE * 3)
    );

    _fs.getDocs(q)
      .then(function(snap) {
        var posts = [];
        snap.forEach(function(d) {
          posts.push(Object.assign({ id: d.id }, d.data()));
        });

        if (reset) _allPosts = posts;
        else _allPosts = _allPosts.concat(posts);

        _lastDoc = snap.docs[snap.docs.length - 1] || null;
        _loading = false;
        renderFeed(reset);
        if (_user) loadUserLikes();
      })
      .catch(function(err) {
        console.warn('[PlaceFeed] posts query failed:', err.message);
        // Fallback: try without orderBy (index may not exist yet)
        _fs.getDocs(_fs.query(
          _fs.collection(_db, 'posts'),
          _fs.where('authorType', '==', 'business'),
          _fs.limit(PAGE_SIZE * 3)
        )).then(function(snap2) {
          var posts = [];
          snap2.forEach(function(d) { posts.push(Object.assign({ id: d.id }, d.data())); });
          posts.sort(function(a, b) {
            var ta = a.createdAt ? (a.createdAt.seconds || 0) : 0;
            var tb = b.createdAt ? (b.createdAt.seconds || 0) : 0;
            return tb - ta;
          });
          if (reset) _allPosts = posts;
          _loading = false;
          renderFeed(reset);
          if (_user) loadUserLikes();
        }).catch(function() { _loading = false; renderFeed(reset); });
      });
  }

  function loadUserLikes() {
    if (!_user || !_db || !_fs) return;
    // Sample user reactions for the loaded posts
    var ids = _allPosts.map(function(p) { return p.id; }).slice(0, 20);
    ids.forEach(function(pid) {
      _fs.getDoc(_fs.doc(_db, 'posts', pid, 'reactions', _user.uid))
        .then(function(snap) {
          if (snap.exists()) {
            _userLikes[pid] = (snap.data() || {}).type || 'love';
            // Update like button if rendered
            var btn = document.querySelector('[data-like-btn="' + pid + '"]');
            if (btn) btn.classList.add('liked');
          }
        }).catch(function() {});
    });
  }

  // ── Render feed ────────────────────────────────────────────────
  function renderFeed(reset) {
    var feed = $('pfFeed');
    var empty = $('pfEmpty');
    var loadMore = $('pfLoadMore');
    if (!feed) return;

    // Filter by category
    var posts = _allPosts.filter(function(p) {
      if (!_currentCat) return true;
      var bizId = p.businessId || p.authorId || p.actorId || '';
      var biz = _bizMap[bizId];
      return biz && biz.category === _currentCat;
    });

    // Also filter to only posts from businesses in our place map
    posts = posts.filter(function(p) {
      var bizId = p.businessId || p.authorId || p.actorId || '';
      return !!_bizMap[bizId] || !bizId; // include if bizId is in map or unknown
    });

    if (reset) feed.innerHTML = '';

    if (!posts.length && reset) {
      feed.innerHTML = '';
      if (empty) empty.style.display = '';
      if (loadMore) loadMore.style.display = 'none';
      return;
    }
    if (empty) empty.style.display = 'none';

    posts.forEach(function(p) {
      if (feed.querySelector('[data-post-id="' + p.id + '"]')) return; // already rendered
      feed.appendChild(buildCard(p));
    });

    if (loadMore) loadMore.style.display = _lastDoc ? '' : 'none';
  }

  // ── Build card ─────────────────────────────────────────────────
  function buildCard(p) {
    var bizId  = p.businessId || p.authorId || p.actorId || '';
    var biz    = _bizMap[bizId] || {};
    var cat    = catInfo(biz.category || p.category || '');
    var name   = p.authorName || biz.title || 'Business';
    var logo   = p.authorAvatar || biz.logoUrl || '';
    var city   = biz.city || p.city || '';
    var media  = getMediaUrls(p);
    var text   = p.text || p.content || '';
    var likes  = Number(p.likeCount || p.reactionCount || 0);
    var comms  = Number(p.commentCount || 0);
    var liked  = !!_userLikes[p.id];

    var card = document.createElement('article');
    card.className = 'pf-card';
    card.dataset.postId = p.id;

    // Logo HTML
    var logoHtml = logo
      ? '<img src="' + esc(logo) + '" alt="' + esc(name) + '" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.textContent=\'' + bizInitials(name) + '\'">'
      : bizInitials(name);
    var logoBg = logo ? '' : 'style="background:' + cat.color + '33;color:' + cat.color + '"';

    // Media HTML
    var mediaHtml = '';
    if (media.length === 1) {
      mediaHtml = '<img class="pf-card-cover" src="' + esc(media[0]) + '" alt="" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">';
    } else if (media.length >= 2) {
      mediaHtml = '<div class="pf-card-cover-multi">'
        + media.slice(0, 4).map(function(u) {
            return '<img src="' + esc(u) + '" alt="" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">';
          }).join('')
        + '</div>';
    }

    // Text (clamp long text)
    var longText = text.length > 220;
    var textHtml = text
      ? '<div class="pf-card-body">'
          + '<div class="pf-card-text' + (longText ? ' clamped' : '') + '">' + esc(text) + '</div>'
          + (longText ? '<button class="pf-read-more" data-expand>კიდევ წაიკითხე</button>' : '')
        + '</div>'
      : '';

    // Stats
    var statsHtml = (likes || comms)
      ? '<div class="pf-card-stats">'
          + (likes ? '<span>❤️ ' + formatCount(likes) + '</span>' : '')
          + (comms ? '<span>💬 ' + formatCount(comms) + ' კომენტარი</span>' : '')
        + '</div>'
      : '';

    // Reaction strip
    var rxStrip = '<div class="pf-rx-strip">'
      + Object.keys(RX).map(function(k) {
          return '<button class="pf-rx-btn" data-reaction="' + k + '" title="' + k + '">' + RX[k] + '</button>';
        }).join('')
      + '</div>';

    // View business link
    var viewBizHref = bizId ? 'business.html?id=' + encodeURIComponent(bizId) : 'places.html';
    var mapHref = (biz.lat && biz.lng) ? 'map.html' : 'map.html';

    card.innerHTML =
      '<div class="pf-card-head">'
        + '<a href="' + viewBizHref + '" class="pf-card-logo" ' + logoBg + '>' + logoHtml + '</a>'
        + '<div class="pf-card-meta">'
          + '<a href="' + viewBizHref + '" class="pf-card-bizname">' + esc(name) + '</a>'
          + '<div class="pf-card-bizinfo">'
            + '<span class="pf-cat-badge" style="background:' + cat.bg + ';color:' + cat.color + '">'
              + cat.icon + ' ' + esc(cat.label)
            + '</span>'
            + (city ? '<span class="pf-city"><i class="fas fa-location-dot"></i>' + esc(city) + '</span>' : '')
          + '</div>'
        + '</div>'
        + '<span class="pf-time">' + timeAgo(p.createdAt) + '</span>'
      + '</div>'
      + mediaHtml
      + textHtml
      + statsHtml
      + '<div class="pf-card-actions">'
        + '<div class="pf-rx-wrap">'
          + rxStrip
          + '<button class="pf-act' + (liked ? ' liked' : '') + '" data-like-btn="' + p.id + '">'
            + '<i class="' + (liked ? 'fas' : 'far') + ' fa-heart"></i> '
            + (liked ? 'Liked' : 'Like')
          + '</button>'
        + '</div>'
        + '<div class="pf-act-divider"></div>'
        + '<button class="pf-act" data-comment-btn="' + p.id + '">'
          + '<i class="far fa-comment"></i> Comment'
        + '</button>'
        + '<div class="pf-act-divider"></div>'
        + '<a class="pf-act pf-act-view" href="' + viewBizHref + '">'
          + '<i class="fas fa-arrow-up-right-from-square"></i> View'
        + '</a>'
      + '</div>';

    // Events
    // Expand long text
    var expandBtn = card.querySelector('[data-expand]');
    if (expandBtn) {
      expandBtn.addEventListener('click', function() {
        var textEl = card.querySelector('.pf-card-text');
        textEl.classList.remove('clamped');
        expandBtn.remove();
      });
    }

    // Like / reaction
    var likeBtn = card.querySelector('[data-like-btn]');
    if (likeBtn) {
      likeBtn.addEventListener('click', function() { toggleLike(p.id, 'love', card); });
    }
    card.querySelectorAll('[data-reaction]').forEach(function(btn) {
      btn.addEventListener('click', function() { toggleLike(p.id, btn.dataset.reaction, card); });
    });

    // Comment → link to business page
    var commentBtn = card.querySelector('[data-comment-btn]');
    if (commentBtn) {
      commentBtn.addEventListener('click', function() {
        if (bizId) window.location.href = viewBizHref + '#post-' + p.id;
      });
    }

    return card;
  }

  // ── Toggle like ────────────────────────────────────────────────
  function toggleLike(postId, type, card) {
    if (!_user) { toast('გთხოვთ გაიაროთ ავტორიზაცია'); return; }
    var already = _userLikes[postId];
    var newType = already === type ? '' : type;
    _userLikes[postId] = newType;

    var btn = card.querySelector('[data-like-btn]');
    if (btn) {
      btn.classList.toggle('liked', !!newType);
      btn.innerHTML = '<i class="' + (newType ? 'fas' : 'far') + ' fa-heart"></i> ' + (newType ? (RX[newType] || '❤️') : 'Like');
    }

    var f = _fs, d = _db;
    var rxRef  = f.doc(d, 'posts', postId, 'reactions', _user.uid);
    var postRef = f.doc(d, 'posts', postId);

    if (!newType) {
      f.deleteDoc(rxRef).catch(function() {});
      f.updateDoc(postRef, { likeCount: f.increment(-1), reactionCount: f.increment(-1) }).catch(function() {});
    } else {
      f.setDoc(rxRef, { userId: _user.uid, type: newType, createdAt: f.serverTimestamp() }, { merge: true })
        .then(function() {
          if (!already) f.updateDoc(postRef, { likeCount: f.increment(1), reactionCount: f.increment(1) }).catch(function() {});
        }).catch(function() {});
    }
  }

  // ── Load more button ───────────────────────────────────────────
  function initLoadMore() {
    var btn = $('pfLoadMore');
    if (!btn) return;
    btn.addEventListener('click', function() {
      if (_lastDoc) loadMore();
    });
  }

  function loadMore() {
    if (_loading || !_lastDoc) return;
    _loading = true;
    var btn = $('pfLoadMore');
    if (btn) { btn.textContent = 'იტვირთება…'; btn.disabled = true; }

    _fs.getDocs(_fs.query(
      _fs.collection(_db, 'posts'),
      _fs.where('authorType', '==', 'business'),
      _fs.orderBy('createdAt', 'desc'),
      _fs.startAfter(_lastDoc),
      _fs.limit(PAGE_SIZE)
    )).then(function(snap) {
      var posts = [];
      snap.forEach(function(d) { posts.push(Object.assign({ id: d.id }, d.data())); });
      _allPosts = _allPosts.concat(posts);
      _lastDoc = snap.docs[snap.docs.length - 1] || null;
      _loading = false;
      if (btn) { btn.innerHTML = '<i class="fas fa-rotate-right"></i> Load more'; btn.disabled = false; }
      renderFeed(false);
      if (_user) loadUserLikes();
    }).catch(function() {
      _loading = false;
      if (btn) { btn.innerHTML = '<i class="fas fa-rotate-right"></i> Load more'; btn.disabled = false; }
    });
  }

  // ── Boot ───────────────────────────────────────────────────────
  function init() {
    initLoadMore();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
