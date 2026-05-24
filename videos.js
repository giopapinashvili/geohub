/* GeoHub Video Platform — Phase 1 (YouTube embed)
   Handles: YouTube parsing, oEmbed, Firestore CRUD, rendering, modals
*/
(function () {
  'use strict';

  var state = {
    videos: [],
    shorts: [],
    filter: 'all',
    city: '',
    sort: 'newest',
    query: '',
    loading: false,
    unsub: null,
    currentUser: null,
    currentUserData: null
  };

  var CAT_META = {
    all:      { label: 'ყველა',       icon: 'fa-film' },
    travel:   { label: 'Travel',      icon: 'fa-plane' },
    hiking:   { label: 'Hiking',      icon: 'fa-person-hiking' },
    food:     { label: 'Food',        icon: 'fa-utensils' },
    nightlife:{ label: 'Nightlife',   icon: 'fa-martini-glass' },
    culture:  { label: 'Culture',     icon: 'fa-landmark' },
    nature:   { label: 'Nature',      icon: 'fa-leaf' },
    city:     { label: 'City',        icon: 'fa-city' },
    beach:    { label: 'Beach',       icon: 'fa-umbrella-beach' },
    winter:   { label: 'Winter',      icon: 'fa-snowflake' },
    events:   { label: 'Events',      icon: 'fa-calendar-star' },
    local:    { label: 'Local',       icon: 'fa-map-pin' }
  };

  /* ── Firebase helpers ─────────────────────────────────── */
  function fb() { return window.GeoFirebase || null; }
  function fs() { return fb() && fb().fs ? fb().fs : null; }
  function db() { return fb() && fb().db ? fb().db : null; }
  function auth() { return fb() && fb().auth ? fb().auth : null; }
  function authUser() { return auth() && auth().currentUser ? auth().currentUser : null; }

  function toast(msg, type) {
    var el = document.querySelector('.gh-toast');
    if (el) el.remove();
    el = document.createElement('div');
    el.className = 'gh-toast' + (type === 'error' ? ' gh-toast-error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 250); }, 2800);
  }

  /* ── YouTube helpers ──────────────────────────────────── */
  function parseYTId(url) {
    if (!url) return null;
    var m;
    m = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{11})/);
    if (m) return m[1];
    m = url.match(/youtube\.com\/shorts\/([\w-]{11})/);
    if (m) return m[1];
    m = url.match(/youtube\.com\/embed\/([\w-]{11})/);
    if (m) return m[1];
    return null;
  }

  function ytThumb(id) {
    return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
  }

  function ytMaxThumb(id) {
    return 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg';
  }

  function ytEmbed(id) {
    return 'https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1';
  }

  function fetchOEmbed(url, callback) {
    var oe = 'https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json';
    fetch(oe)
      .then(function (r) { return r.json(); })
      .then(function (d) { callback(null, d); })
      .catch(function (e) { callback(e, null); });
  }

  /* ── Firestore ops ────────────────────────────────────── */
  function videosCol() {
    if (!fs() || !db()) return null;
    return fs().collection(db(), 'videos');
  }

  function saveVideo(data, callback) {
    var col = videosCol();
    if (!col) { callback(new Error('Firebase unavailable')); return; }
    fs().addDoc(col, Object.assign({}, data, {
      likeCount: 0,
      viewCount: 0,
      commentCount: 0,
      status: 'active',
      createdAt: fs().serverTimestamp()
    })).then(function (ref) { callback(null, ref.id); })
       .catch(function (e) { callback(e); });
  }

  function incrementViewCount(docId) {
    if (!fs() || !db() || !docId) return;
    fs().updateDoc(fs().doc(db(), 'videos', docId), {
      viewCount: fs().increment(1)
    }).catch(function () {});
  }

  function toggleVideoLike(docId, uid, callback) {
    if (!fs() || !db() || !docId || !uid) { callback && callback(false); return; }
    var likeRef = fs().doc(db(), 'videos', docId, 'likes', uid);
    fs().getDoc(likeRef).then(function (snap) {
      if (snap.exists()) {
        return fs().deleteDoc(likeRef).then(function () {
          return fs().updateDoc(fs().doc(db(), 'videos', docId), { likeCount: fs().increment(-1) });
        }).then(function () { callback && callback(false); });
      } else {
        return fs().setDoc(likeRef, { uid: uid, createdAt: fs().serverTimestamp() }).then(function () {
          return fs().updateDoc(fs().doc(db(), 'videos', docId), { likeCount: fs().increment(1) });
        }).then(function () { callback && callback(true); });
      }
    }).catch(function () { callback && callback(null); });
  }

  function checkVideoLiked(docId, uid, callback) {
    if (!fs() || !db() || !docId || !uid) { callback(false); return; }
    fs().getDoc(fs().doc(db(), 'videos', docId, 'likes', uid))
      .then(function (s) { callback(s.exists()); })
      .catch(function () { callback(false); });
  }

  /* ── Video comments ───────────────────────────────────── */
  function addVideoComment(docId, text, user, callback) {
    if (!fs() || !db() || !docId || !text || !user) return;
    var col = fs().collection(db(), 'videos', docId, 'comments');
    fs().addDoc(col, {
      text: text,
      authorId: user.uid,
      authorName: user.displayName || 'GeoHub User',
      authorAvatar: user.photoURL || '',
      createdAt: fs().serverTimestamp()
    }).then(function () {
      fs().updateDoc(fs().doc(db(), 'videos', docId), { commentCount: fs().increment(1) }).catch(function () {});
      callback && callback(null);
    }).catch(function (e) { callback && callback(e); });
  }

  function listenVideoComments(docId, callback) {
    if (!fs() || !db() || !docId) return function () {};
    var q = fs().query(fs().collection(db(), 'videos', docId, 'comments'), fs().orderBy('createdAt', 'desc'), fs().limit(50));
    return fs().onSnapshot(q, function (snap) {
      var comments = [];
      snap.forEach(function (d) { comments.push(Object.assign({ id: d.id }, d.data())); });
      callback(comments);
    }, function () {});
  }

  /* ── Load videos feed ─────────────────────────────────── */
  function loadVideos(opts, callback) {
    if (!fs() || !db()) { callback([]); return; }
    /* No status filter in query so legacy docs (no status field) still show.
       Hidden/removed filtered client-side. */
    var constraints = [fs().orderBy('createdAt', 'desc'), fs().limit(60)];
    if (opts && opts.category && opts.category !== 'all') {
      constraints = [fs().where('category', '==', opts.category), fs().orderBy('createdAt', 'desc'), fs().limit(60)];
    }
    var q = fs().query.apply(null, [videosCol()].concat(constraints));
    return fs().onSnapshot(q, function (snap) {
      var vids = [];
      snap.forEach(function (d) { vids.push(Object.assign({ id: d.id }, d.data())); });
      /* Allow: no status (legacy) or active. Exclude: hidden, removed. */
      vids = vids.filter(function (v) { return v.status !== 'hidden' && v.status !== 'removed'; });
      callback(vids);
    }, function () { callback([]); });
  }

  function loadVideoById(docId, callback) {
    if (!fs() || !db() || !docId) { callback(null); return; }
    fs().getDoc(fs().doc(db(), 'videos', docId))
      .then(function (snap) { callback(snap.exists() ? Object.assign({ id: snap.id }, snap.data()) : null); })
      .catch(function () { callback(null); });
  }

  /* ── Rendering helpers ────────────────────────────────── */
  function timeAgo(ts) {
    if (!ts) return '';
    var now = Date.now();
    var t = ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : now);
    var s = Math.floor((now - t) / 1000);
    if (s < 60) return 'ახლა';
    if (s < 3600) return Math.floor(s / 60) + ' წ. წინ';
    if (s < 86400) return Math.floor(s / 3600) + ' სთ. წინ';
    return Math.floor(s / 86400) + ' დღის წინ';
  }

  function fmtNum(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function catMeta(cat) {
    return CAT_META[cat] || { label: cat || 'Video', icon: 'fa-film' };
  }

  function vidCardHTML(v) {
    var m = catMeta(v.category);
    var thumb = v.thumbnail || ytThumb(v.youtubeId);
    var locBadges = '';
    if (v.placeName && v.placeId) {
      locBadges += '<a class="vid-loc-badge place" href="places.html?id=' + esc(v.placeId) + '" onclick="event.stopPropagation()"><i class="fas fa-map-pin"></i>' + esc(v.placeName) + '</a>';
    }
    if (v.businessName && v.businessId) {
      locBadges += '<a class="vid-loc-badge business" href="business.html?id=' + esc(v.businessId) + '" onclick="event.stopPropagation()"><i class="fas fa-store"></i>' + esc(v.businessName) + '</a>';
    }
    return '<a class="vid-card" href="watch.html?v=' + v.id + '" data-vid-id="' + v.id + '">' +
      '<div class="vid-thumb-wrap">' +
        '<img src="' + thumb + '" alt="" loading="lazy" onerror="this.src=\'' + ytThumb(v.youtubeId) + '\'">' +
        '<div class="vid-play-overlay"><div class="vid-play-btn"><i class="fas fa-play"></i></div></div>' +
        (v.category ? '<div class="vid-card-cat-badge"><i class="fas ' + m.icon + '"></i>' + m.label + '</div>' : '') +
        videoBadgesHTML(v) +
        '<button class="vid-save-btn" data-save-vid="' + esc(v.id) + '" title="Save" onclick="event.preventDefault();event.stopPropagation()"><i class="far fa-bookmark"></i></button>' +
      '</div>' +
      '<div class="vid-card-body">' +
        '<div class="vid-card-title">' + esc(v.title || 'Untitled') + '</div>' +
        '<div class="vid-card-meta">' +
          '<span class="vid-card-channel"><i class="fab fa-youtube"></i>' + esc(v.channelName || '') + '</span>' +
          (v.city ? '<span class="vid-card-city"><i class="fas fa-location-dot"></i>' + esc(v.city) + '</span>' : '') +
        '</div>' +
        (locBadges ? '<div class="vid-loc-badges">' + locBadges + '</div>' : '') +
        '<div class="vid-card-footer">' +
          '<div class="vid-card-stats">' +
            '<span class="vid-card-stat"><i class="fas fa-eye"></i>' + fmtNum(v.viewCount) + '</span>' +
            '<span class="vid-card-stat"><i class="fas fa-heart"></i>' + fmtNum(v.likeCount) + '</span>' +
            '<span class="vid-card-stat"><i class="fas fa-clock"></i>' + timeAgo(v.createdAt) + '</span>' +
          '</div>' +
          '<button class="vid-card-menu-btn" data-vid-menu="' + esc(v.id) + '" title="More options" onclick="event.preventDefault();event.stopPropagation()"><i class="fas fa-ellipsis-vertical"></i></button>' +
        '</div>' +
        (v.channelId
          ? '<a class="vid-creator-link" href="channel.html?id=' + esc(v.channelId) + '" onclick="event.stopPropagation()">' +
              '<div class="vid-creator-av ch-av"><i class="fas fa-tv"></i></div>' +
              esc(v.channelName || 'GeoHub Channel') +
            '</a>'
          : (v.authorId ? '<a class="vid-creator-link" href="profile.html?id=' + esc(v.authorId) + '" onclick="event.stopPropagation()">' +
              '<div class="vid-creator-av">' + (v.authorAvatar ? '<img src="' + esc(v.authorAvatar) + '" alt="">' : '<span>' + (v.authorName || 'U').charAt(0) + '</span>') + '</div>' +
              esc(v.authorName || 'GeoHub User') +
            '</a>' : '')) +
      '</div>' +
    '</a>';
  }

  function shortCardHTML(v) {
    var thumb = v.thumbnail || ytThumb(v.youtubeId);
    return '<a class="vid-short-card" href="watch.html?v=' + v.id + '">' +
      '<div class="vid-short-thumb">' +
        '<img src="' + thumb + '" alt="" loading="lazy" onerror="this.src=\'' + ytThumb(v.youtubeId) + '\'">' +
        '<div class="vid-short-overlay">' +
          '<div class="vid-short-title">' + esc(v.title || 'Short') + '</div>' +
          (v.city ? '<div class="vid-short-city"><i class="fas fa-location-dot"></i>' + esc(v.city) + '</div>' : '') +
        '</div>' +
        '<div class="vid-short-play"><i class="fas fa-play"></i></div>' +
      '</div>' +
    '</a>';
  }

  function skelCards(n) {
    var html = '';
    for (var i = 0; i < n; i++) {
      html += '<div class="vid-skel"><div class="vid-skel-thumb"></div><div class="vid-skel-body"><div class="vid-skel-line"></div><div class="vid-skel-line short"></div></div></div>';
    }
    return html;
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Phase 5: Watch follow button ───────────────────────── */
  function initWatchFollow(v) {
    var btn = document.getElementById('watchFollowBtn');
    if (!btn || !v.authorId) return;
    var gs = window.GeoSocial;
    var u = authUser();
    if (!gs || !u) { btn.style.display = 'none'; return; }

    if (gs.checkFollowing) {
      gs.checkFollowing(v.authorId, function (isFollowing) {
        btn.classList.toggle('following', !!isFollowing);
        btn.innerHTML = isFollowing
          ? '<i class="fas fa-user-check"></i> Following'
          : '<i class="fas fa-user-plus"></i> Follow';
      });
    }

    btn.addEventListener('click', function () {
      if (!gs.toggleFollow) return;
      gs.toggleFollow(v.authorId, function (nowFollowing) {
        btn.classList.toggle('following', !!nowFollowing);
        btn.innerHTML = nowFollowing
          ? '<i class="fas fa-user-check"></i> Following'
          : '<i class="fas fa-user-plus"></i> Follow';
        toast(nowFollowing ? 'Creator-ს დაუფოლოუე!' : 'Unfollowed');
      });
    });
  }

  /* ── Phase 5: Top Creators section ───────────────────────── */
  function renderTopCreators(allVids) {
    var el = document.getElementById('vidTopCreators');
    if (!el) return;

    var map = {};
    allVids.forEach(function (v) {
      if (!v.authorId) return;
      if (!map[v.authorId]) {
        map[v.authorId] = { uid: v.authorId, name: v.authorName || 'GeoHub User', avatar: v.authorAvatar || '', videos: 0, likes: 0, views: 0 };
      }
      map[v.authorId].videos++;
      map[v.authorId].likes += v.likeCount || 0;
      map[v.authorId].views += v.viewCount || 0;
    });

    var creators = Object.keys(map).map(function (k) { return map[k]; });
    if (creators.length < 2) { el.style.display = 'none'; return; }

    creators.forEach(function (c) { c._score = c.likes * 3 + c.views * 0.2 + c.videos * 10; });
    creators.sort(function (a, b) { return b._score - a._score; });
    var top = creators.slice(0, 8);

    el.style.display = '';
    el.innerHTML =
      '<div class="vid-tv-section">' +
        '<div class="vid-tv-head">' +
          '<span class="vid-tv-icon" style="color:#f59e0b"><i class="fas fa-crown"></i></span>' +
          '<h3>Top Creators</h3>' +
        '</div>' +
        '<div class="vid-creator-row">' +
          top.map(function (c) {
            var av = c.avatar
              ? '<img src="' + esc(c.avatar) + '" alt="" onerror="this.style.display=\'none\'">'
              : '<span>' + (c.name || 'U').charAt(0) + '</span>';
            return '<a class="vid-creator-chip" href="profile.html?id=' + esc(c.uid) + '">' +
              '<div class="vid-creator-chip-av">' + av + '</div>' +
              '<div class="vid-creator-chip-info">' +
                '<div class="vid-creator-chip-name">' + esc(c.name) + '</div>' +
                '<div class="vid-creator-chip-stats">' + c.videos + ' vids · ' + fmtNum(c.likes) + ' likes</div>' +
              '</div>' +
            '</a>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  /* ── Phase 4: Trending score ────────────────────────────── */
  function trendScore(v) {
    var now = Date.now();
    var created = v.createdAt
      ? (v.createdAt.toMillis ? v.createdAt.toMillis() : (typeof v.createdAt === 'number' ? v.createdAt : now))
      : now;
    var ageHours = (now - created) / 3600000;
    var recency = Math.max(0, 1 - ageHours / 168) * 100;
    return (v.likeCount || 0) * 3 + (v.commentCount || 0) * 5 + (v.viewCount || 0) * 0.2 + recency;
  }

  /* ── Phase 4: TV section card HTML ──────────────────────── */
  function tvCardHTML(v, rank) {
    var thumb = v.thumbnail || ytThumb(v.youtubeId);
    return '<a class="vid-tv-card" href="watch.html?v=' + esc(v.id) + '">' +
      '<div class="vid-tv-thumb">' +
        '<img src="' + thumb + '" alt="" loading="lazy" onerror="this.src=\'' + ytThumb(v.youtubeId) + '\'">' +
        '<div class="vid-tv-play"><i class="fas fa-play"></i></div>' +
        (rank <= 3 ? '<div class="vid-tv-badge"><i class="fas fa-fire"></i>#' + rank + '</div>' : '') +
        '<div class="vid-tv-rank"><i class="fas fa-fire" style="color:#f97316;margin-right:2px"></i>' + Math.round(v._score || 0) + '</div>' +
        videoBadgesHTML(v) +
        '<button class="vid-save-btn" data-save-vid="' + esc(v.id) + '" title="Save" onclick="event.preventDefault();event.stopPropagation()"><i class="far fa-bookmark"></i></button>' +
      '</div>' +
      '<div class="vid-tv-info">' +
        '<div class="vid-tv-title">' + esc(v.title || 'Video') + '</div>' +
        '<div class="vid-tv-meta">' +
          (v.city ? '<span><i class="fas fa-location-dot"></i>' + esc(v.city) + '</span>' : '') +
          '<span><i class="fas fa-heart"></i>' + fmtNum(v.likeCount) + '</span>' +
          '<span><i class="fas fa-eye"></i>' + fmtNum(v.viewCount) + '</span>' +
        '</div>' +
      '</div>' +
    '</a>';
  }

  function tvReelCardHTML(v) {
    var thumb = v.thumbnail || ytThumb(v.youtubeId);
    return '<a class="vid-tv-reel" href="reels.html?v=' + esc(v.id) + '">' +
      '<div class="vid-tv-reel-thumb">' +
        '<img src="' + thumb + '" alt="" loading="lazy" onerror="this.src=\'' + ytThumb(v.youtubeId) + '\'">' +
        '<div class="vid-tv-play"><i class="fas fa-play"></i></div>' +
      '</div>' +
      '<div class="vid-tv-info">' +
        '<div class="vid-tv-title">' + esc(v.title || 'Reel') + '</div>' +
        '<div class="vid-tv-meta">' +
          (v.city ? '<span><i class="fas fa-location-dot"></i>' + esc(v.city) + '</span>' : '') +
        '</div>' +
      '</div>' +
    '</a>';
  }

  var TV_SECTIONS = [
    { id: 'trending',  icon: 'fa-fire',           color: '#f97316', label: 'Trending Today',
      filter: function(v) { return !v.isShort; }, n: 12 },
    { id: 'reels',     icon: 'fa-bolt',            color: '#a855f7', label: 'Viral Reels',
      filter: function(v) { return !!v.isShort; },  n: 10, reels: true },
    { id: 'tbilisi',   icon: 'fa-city',            color: '#60a5fa', label: 'Trending in Tbilisi',
      filter: function(v) { return !v.isShort && v.city === 'თბილისი'; }, n: 8 },
    { id: 'batumi',    icon: 'fa-umbrella-beach',  color: '#34d399', label: 'Batumi Vibes',
      filter: function(v) { return !v.isShort && v.city === 'ბათუმი'; }, n: 8 },
    { id: 'food',      icon: 'fa-utensils',        color: '#fb923c', label: 'Food & Nightlife',
      filter: function(v) { return !v.isShort && (v.category === 'food' || v.category === 'nightlife'); }, n: 8 },
    { id: 'nature',    icon: 'fa-mountain',        color: '#4ade80', label: 'Nature & Hiking',
      filter: function(v) { return !v.isShort && (v.category === 'nature' || v.category === 'hiking' || v.category === 'winter' || v.category === 'beach'); }, n: 8 },
    { id: 'culture',   icon: 'fa-landmark',        color: '#facc15', label: 'Culture & History',
      filter: function(v) { return !v.isShort && (v.category === 'culture' || v.category === 'events'); }, n: 8 }
  ];

  function renderTVSections(allVids) {
    var el = document.getElementById('vidTVSections');
    if (!el) return;

    var scored = allVids.map(function(v) {
      return Object.assign({}, v, { _score: trendScore(v) });
    });
    scored.sort(function(a, b) { return b._score - a._score; });

    var html = TV_SECTIONS.map(function(sec) {
      var items = scored.filter(sec.filter).slice(0, sec.n);
      if (!items.length) return '';
      var cards = items.map(function(v, i) {
        return sec.reels ? tvReelCardHTML(v) : tvCardHTML(v, i + 1);
      }).join('');
      return '<div class="vid-tv-section">' +
        '<div class="vid-tv-head">' +
          '<span class="vid-tv-icon" style="color:' + sec.color + '"><i class="fas ' + sec.icon + '"></i></span>' +
          '<h3>' + sec.label + '</h3>' +
        '</div>' +
        '<div class="vid-tv-row">' + cards + '</div>' +
      '</div>';
    }).join('');

    el.innerHTML = html;
  }

  /* ── Phase 3: Firestore prefix search ───────────────────── */
  function searchCollection(colName, query, limit, callback) {
    if (!fs() || !db() || !query.trim()) { callback([]); return; }
    var q = query.trim();
    var col = fs().collection(db(), colName);
    var fq = fs().query(col,
      fs().orderBy('name'),
      fs().startAt(q),
      fs().endAt(q + ''),
      fs().limit(limit || 5)
    );
    fs().getDocs(fq)
      .then(function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        callback(items);
      })
      .catch(function () { callback([]); });
  }

  function searchPlaces(q, cb) { searchCollection('places', q, 5, cb); }
  function searchBusinesses(q, cb) { searchCollection('businesses', q, 5, cb); }

  /* ── Phase 3: Watch page location panel ─────────────────── */
  function loadWatchLocation(v) {
    var panel = document.getElementById('watchLocation');
    if (!panel) return;
    var hasCity = !!v.city;
    var hasPlace = !!(v.placeId && v.placeName);
    var hasBusiness = !!(v.businessId && v.businessName);
    if (!hasCity && !hasPlace && !hasBusiness) { panel.style.display = 'none'; return; }

    var cityRow = hasCity
      ? '<div class="watch-city-row"><i class="fas fa-location-dot"></i>გადაღებულია ' + esc(v.city) + '-ში</div>'
      : '';

    var cards = '';
    if (hasPlace) {
      var placeHref = 'places.html?id=' + esc(v.placeId);
      cards += '<a class="watch-loc-card" href="' + placeHref + '">' +
        '<div class="watch-loc-icon place"><i class="fas fa-map-pin"></i></div>' +
        '<div class="watch-loc-info">' +
          '<div class="watch-loc-name">' + esc(v.placeName) + '</div>' +
          '<div class="watch-loc-type">ადგილი</div>' +
        '</div>' +
        '<span class="watch-loc-map-btn"><i class="fas fa-map"></i>რუკა</span>' +
      '</a>';
    }
    if (hasBusiness) {
      var bizHref = 'business.html?id=' + esc(v.businessId);
      cards += '<a class="watch-loc-card" href="' + bizHref + '">' +
        '<div class="watch-loc-icon business"><i class="fas fa-store"></i></div>' +
        '<div class="watch-loc-info">' +
          '<div class="watch-loc-name">' + esc(v.businessName) + '</div>' +
          '<div class="watch-loc-type">ბიზნესი</div>' +
        '</div>' +
        '<span class="watch-loc-map-btn"><i class="fas fa-arrow-right"></i>გვერდი</span>' +
      '</a>';
    }

    panel.style.display = '';
    panel.innerHTML =
      '<div class="watch-location-panel">' +
        '<h4><i class="fas fa-location-dot"></i>მდებარეობა</h4>' +
        cityRow +
        (cards ? '<div class="watch-loc-cards">' + cards + '</div>' : '') +
      '</div>';
  }

  /* ── Phase 6: Nearby Videos ─────────────────────────────── */
  function haversineDist(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function initNearbyBtn() {
    var btn = document.getElementById('vidNearbyBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (!navigator.geolocation) { toast('გეოლოკაცია მხარდაჭერილი არ არის', 'error'); return; }
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      btn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          btn.innerHTML = '<i class="fas fa-location-dot"></i> Near Me';
          btn.disabled = false;
          computeNearby(pos.coords.latitude, pos.coords.longitude);
        },
        function () {
          btn.innerHTML = '<i class="fas fa-location-dot"></i> Near Me';
          btn.disabled = false;
          toast('Location permission denied', 'error');
        },
        { timeout: 6000 }
      );
    });
  }

  function computeNearby(userLat, userLng) {
    var allVids = state.videos.concat(state.shorts).filter(function (v) { return v.placeId; });
    if (!allVids.length) { toast('ახლომდებარე ვიდეო არ არის', 'error'); return; }

    var seen = {}, placeIds = [];
    allVids.forEach(function (v) {
      if (!seen[v.placeId]) { seen[v.placeId] = true; placeIds.push(v.placeId); }
    });

    if (!fs() || !db()) { toast('Firebase unavailable', 'error'); return; }

    var placeCoords = {};
    var pending = placeIds.length;

    function done() {
      var withDist = allVids.map(function (v) {
        var c = placeCoords[v.placeId];
        if (!c) return null;
        return Object.assign({}, v, { _dist: haversineDist(userLat, userLng, c.lat, c.lng) });
      }).filter(Boolean);
      withDist.sort(function (a, b) { return a._dist - b._dist; });
      var nearby = withDist.slice(0, 8);
      if (!nearby.length) { toast('ახლომდებარე ვიდეო არ არის', 'error'); return; }
      renderNearbySection(nearby);
    }

    placeIds.forEach(function (pid) {
      fs().getDoc(fs().doc(db(), 'places', pid))
        .then(function (snap) {
          if (snap.exists()) {
            var d = snap.data();
            var lat = d.lat || d.latitude || (d.location && d.location.lat);
            var lng = d.lng || d.longitude || (d.location && d.location.lng);
            if (lat && lng) placeCoords[pid] = { lat: Number(lat), lng: Number(lng) };
          }
        })
        .catch(function () {})
        .finally(function () { if (--pending === 0) done(); });
    });
  }

  function renderNearbySection(vids) {
    var section = document.getElementById('vidNearbySection');
    var strip   = document.getElementById('vidNearbyStrip');
    if (!section || !strip) return;
    section.style.display = '';
    strip.innerHTML = vids.map(function (v) {
      var distKm = v._dist;
      var distStr = distKm < 1 ? Math.round(distKm * 1000) + 'm' : distKm.toFixed(1) + 'km';
      var thumb = v.thumbnail || ytThumb(v.youtubeId);
      return '<a class="vid-tv-card" href="watch.html?v=' + esc(v.id) + '">' +
        '<div class="vid-tv-thumb">' +
          '<img src="' + thumb + '" alt="" loading="lazy" onerror="this.src=\'' + ytThumb(v.youtubeId) + '\'">' +
          '<div class="vid-tv-play"><i class="fas fa-play"></i></div>' +
        '</div>' +
        '<div class="vid-tv-info">' +
          '<div class="vid-tv-title">' + esc(v.title || 'Video') + '</div>' +
          '<div class="vid-tv-meta">' +
            '<span style="color:var(--green)"><i class="fas fa-location-dot"></i>' + distStr + '</span>' +
            (v.city ? '<span>' + esc(v.city) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</a>';
    }).join('');
  }

  /* ── Phase 7: Watch history ──────────────────────────────── */
  var HIST_KEY = 'gh_watch_history';

  function addToHistory(v) {
    try {
      var hist = getHistory();
      hist = hist.filter(function (h) { return h.id !== v.id; });
      hist.unshift({ id: v.id, title: v.title || '', thumb: v.thumbnail || ytThumb(v.youtubeId), city: v.city || '', ts: Date.now() });
      if (hist.length > 20) hist = hist.slice(0, 20);
      localStorage.setItem(HIST_KEY, JSON.stringify(hist));
    } catch (e) {}
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch (e) { return []; }
  }

  /* ── Phase 7: Video save ─────────────────────────────────── */
  function toggleVideoSave(videoId, videoData, callback) {
    var u = authUser();
    if (!u || !fs() || !db()) { callback && callback(null); return; }
    var docId = u.uid + '_video_' + videoId;
    var ref = fs().doc(db(), 'savedVideos', docId);
    fs().getDoc(ref).then(function (snap) {
      if (snap.exists()) {
        return fs().deleteDoc(ref).then(function () { callback && callback(false); });
      } else {
        return fs().setDoc(ref, {
          userId: u.uid,
          videoId: videoId,
          title: videoData.title || '',
          thumbnail: videoData.thumbnail || ytThumb(videoData.youtubeId || ''),
          city: videoData.city || '',
          authorName: videoData.authorName || '',
          createdAt: Date.now()
        }).then(function () {
          callback && callback(true);
          if (videoData.authorId && videoData.authorId !== u.uid) {
            var gs = window.GeoSocial;
            if (gs && gs.createNotification) {
              gs.createNotification(
                videoData.authorId, 'video_save',
                (u.displayName || 'Someone') + ' saved your video',
                videoData.title || '',
                'watch.html?v=' + videoId,
                { videoId: videoId },
                'vsave_' + u.uid + '_' + videoId
              );
            }
          }
        });
      }
    }).catch(function () { callback && callback(null); });
  }

  function checkVideoSaved(videoId, callback) {
    var u = authUser();
    if (!u || !fs() || !db()) { callback(false); return; }
    var docId = u.uid + '_video_' + videoId;
    fs().getDoc(fs().doc(db(), 'savedVideos', docId))
      .then(function (snap) { callback(snap.exists()); })
      .catch(function () { callback(false); });
  }

  function loadSavedVideos(uid, callback) {
    if (!fs() || !db() || !uid) { callback([]); return; }
    var q = fs().query(
      fs().collection(db(), 'savedVideos'),
      fs().where('userId', '==', uid),
      fs().limit(20)
    );
    fs().getDocs(q)
      .then(function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        items.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        callback(items);
      })
      .catch(function () { callback([]); });
  }

  /* ── Phase 7: Video badges ───────────────────────────────── */
  function videoBadgesHTML(v) {
    var html = '';
    if (trendScore(v) >= 60) {
      html += '<span class="vid-status-badge trending"><i class="fas fa-fire"></i>Trending</span>';
    }
    if ((v.viewCount || 0) >= 1000) {
      html += '<span class="vid-status-badge viral"><i class="fas fa-bolt"></i>Viral</span>';
    }
    var now = Date.now();
    var created = v.createdAt
      ? (v.createdAt.toMillis ? v.createdAt.toMillis() : (typeof v.createdAt === 'number' ? v.createdAt : 0))
      : 0;
    if (created && now - created < 86400000) {
      html += '<span class="vid-status-badge new"><i class="fas fa-sparkles"></i>New</span>';
    }
    return html ? '<div class="vid-badge-row">' + html + '</div>' : '';
  }

  /* ── Phase 7: Continue Watching row ─────────────────────── */
  function renderContinueWatching() {
    var section = document.getElementById('vidContinueSection');
    var strip = document.getElementById('vidContinueStrip');
    if (!section || !strip) return;
    var hist = getHistory();
    if (!hist.length) { section.style.display = 'none'; return; }
    section.style.display = '';
    strip.innerHTML = hist.map(function (h) {
      return '<a class="vid-tv-card" href="watch.html?v=' + esc(h.id) + '">' +
        '<div class="vid-tv-thumb">' +
          '<img src="' + esc(h.thumb) + '" alt="" loading="lazy">' +
          '<div class="vid-tv-play"><i class="fas fa-play"></i></div>' +
        '</div>' +
        '<div class="vid-tv-info">' +
          '<div class="vid-tv-title">' + esc(h.title) + '</div>' +
          '<div class="vid-tv-meta">' + (h.city ? '<span><i class="fas fa-location-dot"></i>' + esc(h.city) + '</span>' : '') + '</div>' +
        '</div>' +
      '</a>';
    }).join('');
  }

  /* ── Phase 7: Saved Videos row ──────────────────────────── */
  function renderSavedSection() {
    var section = document.getElementById('vidSavedSection');
    var strip = document.getElementById('vidSavedStrip');
    if (!section || !strip) return;
    var u = authUser();
    if (!u) { section.style.display = 'none'; return; }
    loadSavedVideos(u.uid, function (items) {
      if (!items.length) { section.style.display = 'none'; return; }
      section.style.display = '';
      strip.innerHTML = items.map(function (h) {
        return '<a class="vid-tv-card" href="watch.html?v=' + esc(h.videoId) + '">' +
          '<div class="vid-tv-thumb">' +
            '<img src="' + esc(h.thumbnail) + '" alt="" loading="lazy">' +
            '<div class="vid-tv-play"><i class="fas fa-play"></i></div>' +
          '</div>' +
          '<div class="vid-tv-info">' +
            '<div class="vid-tv-title">' + esc(h.title) + '</div>' +
            '<div class="vid-tv-meta">' + (h.city ? '<span><i class="fas fa-location-dot"></i>' + esc(h.city) + '</span>' : '') + '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    });
  }

  /* ── Phase 7: Watch page save button ────────────────────── */
  function bindWatchSave(v) {
    var btn = document.getElementById('watchSaveBtn');
    if (!btn) return;
    var u = authUser();
    if (!u) { btn.style.display = 'none'; return; }
    checkVideoSaved(v.id, function (isSaved) {
      btn.classList.toggle('saved', isSaved);
      var ico = btn.querySelector('i');
      if (ico) ico.className = isSaved ? 'fas fa-bookmark' : 'far fa-bookmark';
    });
    btn.addEventListener('click', function () {
      toggleVideoSave(v.id, v, function (nowSaved) {
        if (nowSaved === null) return;
        btn.classList.toggle('saved', nowSaved);
        var ico = btn.querySelector('i');
        if (ico) ico.className = nowSaved ? 'fas fa-bookmark' : 'far fa-bookmark';
        toast(nowSaved ? 'ვიდეო შეინახა!' : 'შენახვიდან წაიშალა');
      });
    });
  }

  /* ── Phase 7: Share mini-menu ───────────────────────────── */
  function openShareMenu(v, btn) {
    var existing = document.getElementById('vidShareMenu');
    if (existing) { existing.remove(); return; }
    var url = location.origin + '/watch.html?v=' + v.id;
    var menu = document.createElement('div');
    menu.className = 'vid-share-menu';
    menu.id = 'vidShareMenu';
    menu.innerHTML =
      '<div class="vid-share-menu-item" id="vsm-copy"><i class="fas fa-link"></i>ლინკის კოპირება</div>' +
      (navigator.share ? '<div class="vid-share-menu-item" id="vsm-native"><i class="fas fa-share-nodes"></i>გაზიარება</div>' : '') +
      '<div class="vid-share-menu-item" id="vsm-story"><i class="fas fa-circle-play"></i>Share to Story</div>' +
      '<div class="vid-share-menu-item" id="vsm-post"><i class="fas fa-pen-to-square"></i>Share to Post</div>';

    var rect = btn.getBoundingClientRect();
    menu.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    menu.style.left = Math.max(8, rect.left + window.scrollX - 60) + 'px';
    document.body.appendChild(menu);

    menu.querySelector('#vsm-copy').addEventListener('click', function () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { toast('ლინკი დაკოპირდა!'); }).catch(function () {});
      }
      menu.remove();
    });
    if (navigator.share) {
      var nativeBtn = menu.querySelector('#vsm-native');
      if (nativeBtn) nativeBtn.addEventListener('click', function () {
        navigator.share({ title: v.title, url: url }).catch(function () {});
        menu.remove();
      });
    }
    var storyBtn = menu.querySelector('#vsm-story');
    if (storyBtn) storyBtn.addEventListener('click', function () {
      var gs = window.GeoSocial;
      if (!gs || !gs.createStory) { toast('Story system unavailable', 'error'); menu.remove(); return; }
      var storyText = '▶ ' + (v.title || 'GeoHub Video');
      var storyMedia = v.thumbnail || ytThumb(v.youtubeId);
      gs.createStory(storyText, storyMedia, function (err) {
        if (!err) toast('Story-ში გაზიარდა! 🎬');
        else toast('გაზიარება ვერ მოხდა', 'error');
      });
      menu.remove();
    });

    var postBtn = menu.querySelector('#vsm-post');
    if (postBtn) postBtn.addEventListener('click', function () {
      window.location.href = 'feed.html?share=video&id=' + esc(v.id) + '&title=' + encodeURIComponent(v.title || '');
      menu.remove();
    });

    setTimeout(function () {
      document.addEventListener('click', function rmMenu(e) {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', rmMenu); }
      });
    }, 0);
  }

  /* ── Phase 10: Undo toast ───────────────────────────────── */
  function showUndoToast(msg, onUndo, onCommit) {
    var prev = document.querySelector('.gh-undo-toast');
    if (prev) prev.remove();
    var el = document.createElement('div');
    el.className = 'gh-undo-toast';
    el.innerHTML = '<span>' + esc(msg) + '</span><button class="gh-undo-btn">Undo</button>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    var committed = false;
    var t = setTimeout(function () {
      committed = true;
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 250);
      onCommit && onCommit();
    }, 3200);
    el.querySelector('.gh-undo-btn').addEventListener('click', function () {
      if (committed) return;
      committed = true;
      clearTimeout(t);
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 250);
      onUndo && onUndo();
    });
  }

  /* ── Phase 9: Report Video ───────────────────────────────── */
  function reportVideo(videoId, videoData, reason, note, callback) {
    var u = authUser();
    if (!u || !fs() || !db()) { callback && callback('error'); return; }
    var docId = u.uid + '_' + videoId;
    var ref = fs().doc(db(), 'videoReports', docId);
    fs().getDoc(ref).then(function (snap) {
      if (snap.exists()) { callback && callback('already'); return; }
      return fs().setDoc(ref, {
        videoId: videoId,
        videoTitle: videoData.title || '',
        videoYoutubeId: videoData.youtubeId || '',
        videoAuthorId: videoData.authorId || '',
        videoAuthorName: videoData.authorName || '',
        reporterUid: u.uid,
        reporterName: u.displayName || 'GeoHub User',
        reason: reason,
        note: note || '',
        status: 'pending',
        createdAt: fs().serverTimestamp()
      }).then(function () { callback && callback(null); });
    }).catch(function () { callback && callback('error'); });
  }

  function checkAlreadyReported(videoId, callback) {
    var u = authUser();
    if (!u || !fs() || !db()) { callback(false); return; }
    fs().getDoc(fs().doc(db(), 'videoReports', u.uid + '_' + videoId))
      .then(function (snap) { callback(snap.exists()); })
      .catch(function () { callback(false); });
  }

  function openReportModal(videoId, videoData) {
    var u = authUser();
    if (!u) { toast('Report-ისთვის გაიარე ავტორიზაცია', 'error'); return; }
    if (document.getElementById('vidReportModal')) return;
    checkAlreadyReported(videoId, function (already) {
      if (already) { toast('ეს ვიდეო უკვე გაქვს reported ✓'); return; }
      _openReportModalInner(videoId, videoData);
    });
  }

  function _openReportModalInner(videoId, videoData) {

    var REASONS = [
      { val: 'spam',         label: 'Spam' },
      { val: 'inappropriate',label: 'Inappropriate content' },
      { val: 'misleading',   label: 'Misleading / fake' },
      { val: 'copyright',    label: 'Copyright violation' },
      { val: 'other',        label: 'Other' }
    ];

    var ov = document.createElement('div');
    ov.className = 'vid-modal-overlay';
    ov.id = 'vidReportModal';
    ov.innerHTML =
      '<div class="vid-modal" style="max-width:400px">' +
        '<h2 style="color:#ef4444"><i class="fas fa-flag"></i> Report Video<button class="vid-modal-close" id="vidRepClose"><i class="fas fa-times"></i></button></h2>' +
        '<p style="font-size:.83rem;color:var(--text-muted);margin:0 0 12px">' + esc(videoData.title || 'Video') + '</p>' +
        '<div class="vid-report-reasons">' +
          REASONS.map(function (r) {
            return '<label class="vid-report-reason"><input type="radio" name="vidRepReason" value="' + r.val + '"> ' + r.label + '</label>';
          }).join('') +
        '</div>' +
        '<textarea id="vidRepNote" class="vid-form-textarea" style="margin-top:10px;height:56px" placeholder="დამატებითი ინფო (არასავალდებულო)..."></textarea>' +
        '<div class="vid-modal-footer">' +
          '<button class="vid-btn ghost" id="vidRepCancel"><i class="fas fa-times"></i> გაუქმება</button>' +
          '<button class="vid-btn primary" id="vidRepSubmit" style="background:#ef4444;border-color:#ef4444"><i class="fas fa-flag"></i> გაგზავნა</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    document.getElementById('vidRepClose').onclick = function () { ov.remove(); };
    document.getElementById('vidRepCancel').onclick = function () { ov.remove(); };
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });

    document.getElementById('vidRepSubmit').addEventListener('click', function () {
      var checked = ov.querySelector('input[name="vidRepReason"]:checked');
      if (!checked) { toast('მიზეზი აირჩიე', 'error'); return; }
      var btn = document.getElementById('vidRepSubmit');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      var note = (document.getElementById('vidRepNote') || {}).value || '';
      reportVideo(videoId, videoData, checked.value, note.trim(), function (err) {
        btn.disabled = false;
        if (err === 'already') { toast('ეს ვიდეო უკვე გაქვს reported', 'error'); ov.remove(); }
        else if (err) { toast('შეცდომა — სცადე თავიდან', 'error'); btn.innerHTML = '<i class="fas fa-flag"></i> გაგზავნა'; }
        else { toast('Report გაიგზავნა. მადლობა! 🙏'); ov.remove(); }
      });
    });
  }

  /* ── Phase 9: Not Interested ─────────────────────────────── */
  var NI_KEY = 'gh_not_interested';

  function addNotInterested(videoId) {
    try {
      var list = getNotInterested();
      if (list.indexOf(videoId) === -1) list.push(videoId);
      if (list.length > 200) list = list.slice(-200);
      localStorage.setItem(NI_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function getNotInterested() {
    try { return JSON.parse(localStorage.getItem(NI_KEY) || '[]'); } catch (e) { return []; }
  }

  /* ── Phase 9: Delete comment ─────────────────────────────── */
  function deleteVideoComment(videoId, commentId, commentAuthorId, videoAuthorId, callback) {
    var u = authUser();
    if (!u || !fs() || !db()) { callback && callback('auth'); return; }
    if (u.uid !== commentAuthorId && u.uid !== videoAuthorId) { callback && callback('perm'); return; }
    fs().deleteDoc(fs().doc(db(), 'videos', videoId, 'comments', commentId))
      .then(function () {
        fs().updateDoc(fs().doc(db(), 'videos', videoId), { commentCount: fs().increment(-1) }).catch(function () {});
        callback && callback(null);
      })
      .catch(function () { callback && callback('error'); });
  }

  /* ── Phase 9: Card context menu ──────────────────────────── */
  function openCardContextMenu(videoId, videoData, anchorEl) {
    var existing = document.getElementById('vidCtxMenu');
    if (existing) { existing.remove(); return; }
    var menu = document.createElement('div');
    menu.className = 'vid-card-context-menu';
    menu.id = 'vidCtxMenu';
    menu.innerHTML =
      '<div class="vid-card-ctx-item" id="vctx-ni"><i class="fas fa-ban"></i>Not interested</div>' +
      '<div class="vid-card-ctx-item danger" id="vctx-rep"><i class="fas fa-flag"></i>Report</div>';
    var rect = anchorEl.getBoundingClientRect();
    menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    menu.style.left = Math.max(8, rect.right + window.scrollX - 170) + 'px';
    document.body.appendChild(menu);

    menu.querySelector('#vctx-ni').addEventListener('click', function () {
      addNotInterested(videoId);
      var card = document.querySelector('[data-vid-id="' + videoId + '"]');
      var undone = false;
      if (card) {
        card.style.transition = 'opacity .25s, transform .25s';
        card.style.opacity = '0';
        card.style.transform = 'scale(.95)';
        card.style.pointerEvents = 'none';
      }
      showUndoToast('ამ ვიდეოს აღარ ნახავ', function () {
        undone = true;
        var ni = getNotInterested().filter(function (id) { return id !== videoId; });
        try { localStorage.setItem(NI_KEY, JSON.stringify(ni)); } catch (e) {}
        if (card) {
          card.style.opacity = '1';
          card.style.transform = '';
          card.style.pointerEvents = '';
        }
      }, function () {
        if (!undone && card && card.parentNode) card.parentNode.removeChild(card);
      });
      menu.remove();
    });
    menu.querySelector('#vctx-rep').addEventListener('click', function () {
      openReportModal(videoId, videoData);
      menu.remove();
    });
    setTimeout(function () {
      document.addEventListener('click', function rmCtx(e) {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', rmCtx); }
      });
    }, 0);
  }

  /* ── Phase 8: Live Activity Feed ────────────────────────── */
  var _actTimer = null;
  var _actIdx = 0;
  var _actItems = [];

  function getTs(ts) {
    if (!ts) return 0;
    return ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : 0);
  }

  function generateActivityItems(vids) {
    var items = [];
    var now = Date.now();

    /* Recent uploads (last 48h) */
    var recent = vids.filter(function (v) { return getTs(v.createdAt) > now - 172800000; });
    recent.slice(0, 3).forEach(function (v) {
      var type = v.isShort ? 'reel' : 'video';
      var icon = v.isShort ? '⚡' : '🎬';
      items.push({
        icon: icon,
        html: '<strong>' + esc(v.authorName || 'Someone') + '</strong> uploaded a new ' + type + (v.city ? ' in <strong>' + esc(v.city) + '</strong>' : ''),
        href: 'watch.html?v=' + v.id,
        ts: getTs(v.createdAt)
      });
    });

    /* Trending videos */
    vids.filter(function (v) { return trendScore(v) >= 60; }).slice(0, 2).forEach(function (v) {
      items.push({
        icon: '🔥',
        html: '"<strong>' + esc(v.title || 'Video') + '</strong>" is trending',
        href: 'watch.html?v=' + v.id,
        ts: 0
      });
    });

    /* City hotspots */
    var cityMap = {};
    vids.forEach(function (v) { if (v.city) cityMap[v.city] = (cityMap[v.city] || 0) + 1; });
    var topCities = Object.keys(cityMap).sort(function (a, b) { return cityMap[b] - cityMap[a]; }).slice(0, 2);
    topCities.forEach(function (city) {
      items.push({
        icon: '📍',
        html: '<strong>' + cityMap[city] + '</strong> videos in <strong>' + esc(city) + '</strong>',
        href: 'videos.html',
        ts: 0
      });
    });

    /* Viral */
    vids.filter(function (v) { return (v.viewCount || 0) >= 1000; }).slice(0, 1).forEach(function (v) {
      items.push({
        icon: '🚀',
        html: '"<strong>' + esc(v.title || 'Video') + '</strong>" — ' + fmtNum(v.viewCount) + ' views',
        href: 'watch.html?v=' + v.id,
        ts: 0
      });
    });

    items.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    return items.slice(0, 8);
  }

  function showActivityItem(idx) {
    var ticker = document.getElementById('vidActivityTicker');
    if (!ticker || !_actItems[idx]) return;
    var item = _actItems[idx];
    ticker.style.animation = 'none';
    ticker.offsetWidth;
    ticker.style.animation = '';
    ticker.innerHTML =
      '<span style="margin-right:6px">' + item.icon + '</span>' +
      item.html +
      '<span class="vid-activity-count" style="margin-left:8px">' + (idx + 1) + '/' + _actItems.length + '</span>';
    var wrap = document.getElementById('vidActivityWrap');
    if (wrap && item.href) {
      wrap.onclick = function () { window.location.href = item.href; };
    }
  }

  function renderActivityFeed(vids) {
    var wrap = document.getElementById('vidActivityWrap');
    if (!wrap) return;
    _actItems = generateActivityItems(vids);
    if (!_actItems.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    _actIdx = 0;
    showActivityItem(0);
    if (_actTimer) clearInterval(_actTimer);
    _actTimer = setInterval(function () {
      _actIdx = (_actIdx + 1) % _actItems.length;
      showActivityItem(_actIdx);
    }, 4000);
  }

  /* ── Phase 8: Video Reactions ────────────────────────────── */
  var REACTION_EMOJIS = ['❤️', '🔥', '😮', '😂', '😍'];

  function toggleVideoReaction(videoId, uid, emoji, callback) {
    if (!fs() || !db() || !videoId || !uid) { callback && callback(null); return; }
    var ref = fs().doc(db(), 'videos', videoId, 'reactions', uid);
    fs().getDoc(ref).then(function (snap) {
      if (snap.exists() && snap.data().emoji === emoji) {
        return fs().deleteDoc(ref).then(function () { callback && callback(null); });
      } else {
        return fs().setDoc(ref, { emoji: emoji, uid: uid, createdAt: fs().serverTimestamp() })
          .then(function () { callback && callback(emoji); });
      }
    }).catch(function () { callback && callback(null); });
  }

  function listenVideoReactions(videoId, callback) {
    if (!fs() || !db() || !videoId) return function () {};
    var col = fs().collection(db(), 'videos', videoId, 'reactions');
    return fs().onSnapshot(col, function (snap) {
      var counts = {};
      snap.forEach(function (d) {
        var e = d.data().emoji;
        if (e) counts[e] = (counts[e] || 0) + 1;
      });
      callback(counts);
    }, function () {});
  }

  function initWatchReactions(v) {
    var el = document.getElementById('watchReactions');
    if (!el) return;
    var u = authUser();
    var userReaction = null;
    var unsubReact = null;

    if (u) {
      fs() && db() && fs().getDoc(fs().doc(db(), 'videos', v.id, 'reactions', u.uid))
        .then(function (snap) { if (snap.exists()) userReaction = snap.data().emoji; })
        .catch(function () {});
    }

    function render(counts) {
      el.innerHTML = '<div class="vid-reactions">' +
        REACTION_EMOJIS.map(function (emoji) {
          var cnt = counts[emoji] || 0;
          var active = userReaction === emoji;
          return '<button class="vid-reaction-btn' + (active ? ' active' : '') + '" data-reaction-emoji="' + esc(emoji) + '">' +
            emoji + (cnt ? '<span>' + fmtNum(cnt) + '</span>' : '') +
          '</button>';
        }).join('') +
      '</div>';

      el.querySelectorAll('.vid-reaction-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!u) { toast('Reaction-ისთვის გაიარე ავტორიზაცია', 'error'); return; }
          var emoji = btn.dataset.reactionEmoji;
          btn.classList.add('vid-reaction-pop');
          setTimeout(function () { btn.classList.remove('vid-reaction-pop'); }, 250);
          toggleVideoReaction(v.id, u.uid, emoji, function (newEmoji) {
            userReaction = newEmoji;
          });
        });
      });
    }

    unsubReact = listenVideoReactions(v.id, render);

    /* Clean up listener when navigating away */
    window.addEventListener('beforeunload', function () { if (unsubReact) unsubReact(); }, { once: true });
  }

  /* ── Phase 8: Creator presence dot ──────────────────────── */
  function checkCreatorPresence(authorId) {
    if (!authorId || !fs() || !db()) return;
    fs().getDoc(fs().doc(db(), 'users', authorId))
      .then(function (snap) {
        if (!snap.exists()) return;
        var d = snap.data();
        var ts = d.lastSeen ? (d.lastSeen.toMillis ? d.lastSeen.toMillis() : (d.lastSeen.seconds ? d.lastSeen.seconds * 1000 : 0)) : 0;
        if (ts && Date.now() - ts < 300000) {
          var dot = document.getElementById('watchOnlineDot');
          if (dot) dot.style.display = '';
        }
      })
      .catch(function () {});
  }

  /* ── Videos page init ─────────────────────────────────── */
  function initVideosPage() {
    var page = document.getElementById('vidPage');
    if (!page) return;

    renderCategoryPills();
    loadAndRender();
    bindUI();
    initMyChannelBar();
  }

  function renderCategoryPills() {
    var row = document.getElementById('vidCatRow');
    if (!row) return;
    var html = '';
    Object.keys(CAT_META).forEach(function (key) {
      var m = CAT_META[key];
      html += '<button class="vid-pill' + (state.filter === key ? ' active' : '') + '" data-cat="' + key + '">' +
        '<i class="fas ' + m.icon + '"></i>' + m.label + '</button>';
    });
    row.innerHTML = html;
    row.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cat]');
      if (!btn) return;
      var cat = btn.dataset.cat;
      state.filter = cat;
      row.querySelectorAll('.vid-pill').forEach(function (p) { p.classList.toggle('active', p.dataset.cat === cat); });
      loadAndRender();
    });
  }

  function loadAndRender() {
    var grid = document.getElementById('vidGrid');
    var shortsStrip = document.getElementById('vidShortsStrip');
    if (grid) grid.innerHTML = skelCards(8);

    if (state.unsub) { state.unsub(); state.unsub = null; }

    state.unsub = loadVideos({ category: state.filter }, function (vids) {
      state.videos = vids.filter(function (v) { return !v.isShort; });
      state.shorts = vids.filter(function (v) { return v.isShort; });
      if (state.filter === 'all') {
        renderTVSections(vids);
        renderTopCreators(vids);
        renderContinueWatching();
        renderSavedSection();
        renderActivityFeed(vids);
      }
      renderGrid();
      renderShorts();
    });
  }

  function applySearch(vids) {
    var q = (state.query || '').toLowerCase().trim();
    if (!q) return vids;
    return vids.filter(function (v) {
      return (v.title || '').toLowerCase().includes(q) ||
             (v.channelName || '').toLowerCase().includes(q) ||
             (v.city || '').toLowerCase().includes(q) ||
             (v.tags || []).some(function (t) { return t.toLowerCase().includes(q); });
    });
  }

  function applyCity(vids) {
    if (!state.city) return vids;
    return vids.filter(function (v) { return (v.city || '').toLowerCase() === state.city.toLowerCase(); });
  }

  function applySort(vids) {
    if (state.sort === 'popular') {
      return vids.slice().sort(function(a, b) { return (b.viewCount || 0) - (a.viewCount || 0); });
    }
    if (state.sort === 'trending') {
      return vids.slice().sort(function(a, b) { return trendScore(b) - trendScore(a); });
    }
    return vids;
  }

  function renderGrid() {
    var grid = document.getElementById('vidGrid');
    if (!grid) return;
    var ni = getNotInterested();
    var vids = applySort(applySearch(applyCity(state.videos))).filter(function (v) { return ni.indexOf(v.id) === -1; });
    if (!vids.length) {
      grid.innerHTML = '<div class="vid-empty"><i class="fas fa-film"></i><h3>ვიდეო არ მოიძებნა</h3><p>სხვა ფილტრი სცადე ან დაამატე ახალი ვიდეო</p></div>';
      return;
    }
    grid.innerHTML = vids.map(vidCardHTML).join('');
  }

  function renderShorts() {
    var strip = document.getElementById('vidShortsStrip');
    var section = document.getElementById('vidShortsSection');
    if (!strip) return;
    var ni = getNotInterested();
    var shorts = applyCity(state.shorts).filter(function (v) { return ni.indexOf(v.id) === -1; });
    if (!shorts.length) {
      if (section) section.style.display = 'none';
      return;
    }
    if (section) section.style.display = '';
    strip.innerHTML = shorts.map(shortCardHTML).join('');
  }

  function bindUI() {
    var searchEl = document.getElementById('vidSearch');
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        state.query = searchEl.value;
        renderGrid();
      });
    }

    var cityEl = document.getElementById('vidCityFilter');
    if (cityEl) {
      cityEl.addEventListener('change', function () {
        state.city = cityEl.value;
        renderGrid();
        renderShorts();
      });
    }

    var sortEl = document.getElementById('vidSort');
    if (sortEl) {
      sortEl.addEventListener('change', function () {
        state.sort = sortEl.value;
        loadAndRender();
      });
    }

    var addBtn = document.getElementById('vidAddBtn');
    var addBtn2 = document.getElementById('vidAddBtn2');
    [addBtn, addBtn2].forEach(function (btn) {
      if (btn) btn.addEventListener('click', function () { openAddVideoModal(); });
    });

    initNearbyBtn();
  }

  /* ── Delete all videos belonging to current user ─────── */
  function deleteAllMyVideos(u) {
    if (!u) return;
    if (!confirm('წაიშლება ყველა ვიდეო, რომელიც შენ ატვირთე. დარწმუნებული ხარ?')) return;
    if (!fs() || !db()) { toast('Firebase მიუწვდომელია', 'error'); return; }
    var col = fs().collection(db(), 'videos');
    var btn = document.getElementById('vidDelAllMyVids');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> იშლება...'; }
    fs().getDocs(fs().query(col, fs().where('authorId', '==', u.uid)))
      .then(function (snap) {
        if (snap.empty) { toast('წასაშლელი ვიდეო არ მოიძებნა'); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> ყველა ვიდეოს წაშლა'; } return; }
        var dels = snap.docs.map(function (d) { return fs().deleteDoc(fs().doc(db(), 'videos', d.id)); });
        return Promise.all(dels).then(function () {
          toast('წაიშალა ' + snap.docs.length + ' ვიდეო', 'success');
          setTimeout(function () { window.location.reload(); }, 1000);
        });
      })
      .catch(function (e) {
        toast('შეცდომა: ' + e.message, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> ყველა ვიდეოს წაშლა'; }
      });
  }

  /* ── My Channel bar on videos page ───────────────────── */
  function initMyChannelBar() {
    var bar = document.getElementById('vidMyChannelBar');
    if (!bar) return;

    function wireDelBtn(u) {
      var b = document.getElementById('vidDelAllMyVids');
      if (b) b.onclick = function () { deleteAllMyVideos(u); };
    }

    function renderNoChannel(u) {
      bar.innerHTML =
        '<div class="vid-mychannel-bar">' +
          '<div class="vid-mychannel-av-ph"><i class="fas fa-tv"></i></div>' +
          '<div class="vid-mychannel-info">' +
            '<span class="vid-mychannel-name">GeoHub არხი</span>' +
            '<span class="vid-mychannel-sub">შექმენი შენი პირადი არხი და ატვირთე ვიდეოები</span>' +
          '</div>' +
          '<button class="vid-btn-outline" id="vidDelAllMyVids" style="color:#ef4444;border-color:rgba(239,68,68,.3);font-size:.8rem"><i class="fas fa-trash"></i> ყველა ვიდეოს წაშლა</button>' +
          '<button class="vid-add-btn" id="vidCreateChBtn" style="font-size:.85rem"><i class="fas fa-plus"></i> შექმენი არხი</button>' +
        '</div>';
      wireDelBtn(u);
      var btn = document.getElementById('vidCreateChBtn');
      if (btn) btn.onclick = function () { openCreateChannelModal(u); };
    }

    function render(u) {
      if (!u) { bar.innerHTML = ''; return; }
      /* Show bar immediately so the delete button is always visible */
      renderNoChannel(u);
      if (!fs() || !db()) { window.addEventListener('GeoFirebaseReady', function () { render(u); }, { once: true }); return; }
      fs().getDocs(fs().query(fs().collection(db(), 'channels'), fs().where('ownerId', '==', u.uid), fs().limit(1)))
        .then(function (snap) {
          if (snap.empty) return; /* already showing renderNoChannel */
          var ch = Object.assign({ _id: snap.docs[0].id }, snap.docs[0].data());
          bar.innerHTML =
            '<div class="vid-mychannel-bar">' +
              (ch.avatar
                ? '<img class="vid-mychannel-av" src="' + esc(ch.avatar) + '" alt="">'
                : '<div class="vid-mychannel-av-ph"><i class="fas fa-tv"></i></div>') +
              '<div class="vid-mychannel-info">' +
                '<span class="vid-mychannel-name">' + esc(ch.name) + '</span>' +
                '<span class="vid-mychannel-sub"><i class="fas fa-users"></i> ' + fmtNum(ch.subscriberCount || 0) + ' გამომწერი &nbsp;·&nbsp; <i class="fas fa-film"></i> ' + fmtNum(ch.videoCount || 0) + ' ვიდეო</span>' +
              '</div>' +
              '<button class="vid-btn-outline" id="vidDelAllMyVids" style="color:#ef4444;border-color:rgba(239,68,68,.3);font-size:.8rem"><i class="fas fa-trash"></i> ყველა ვიდეო</button>' +
              '<a class="vid-add-btn" href="channel.html?id=' + esc(ch._id) + '" style="font-size:.85rem;text-decoration:none"><i class="fas fa-tv"></i> ჩემი არხი</a>' +
            '</div>';
          wireDelBtn(u);
        })
        .catch(function () { /* bar already shows renderNoChannel, keep it */ });
    }

    if (auth()) {
      fb().authFns.onAuthStateChanged(auth(), render);
    } else {
      window.addEventListener('GeoFirebaseReady', function () {
        fb().authFns.onAuthStateChanged(auth(), render);
      }, { once: true });
    }
  }

  /* ── Create Channel Modal ─────────────────────────────── */
  function openCreateChannelModal(u) {
    if (document.getElementById('vidCreateChModal')) return;
    if (!u) { toast('ავტორიზაცია საჭიროა', 'error'); return; }

    var ov = document.createElement('div');
    ov.className = 'vid-modal-overlay';
    ov.id = 'vidCreateChModal';
    ov.innerHTML =
      '<div class="vid-modal" style="max-width:480px">' +
        '<h2><i class="fas fa-tv"></i> GeoHub არხის შექმნა' +
          '<button class="vid-modal-close" id="vccClose"><i class="fas fa-times"></i></button>' +
        '</h2>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label">არხის სახელი <span>*</span></label>' +
          '<input id="vccName" class="vid-form-input" type="text" placeholder="ჩემი GeoHub არხი" maxlength="80">' +
        '</div>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label">აღწერა</label>' +
          '<textarea id="vccDesc" class="vid-form-textarea" placeholder="არხის მოკლე აღწერა..." maxlength="500"></textarea>' +
        '</div>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label">Avatar URL <span style="color:var(--text-muted);font-weight:400">(არასავალდებულო)</span></label>' +
          '<input id="vccAvatar" class="vid-form-input" type="url" placeholder="https://...">' +
        '</div>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label">YouTube Channel URL <span style="color:var(--text-muted);font-weight:400">(ავტო-შევსება)</span></label>' +
          '<div class="vid-url-group">' +
            '<input id="vccYtUrl" class="vid-form-input" type="url" placeholder="https://www.youtube.com/@channel">' +
            '<button class="vid-fetch-btn" id="vccYtFetch"><i class="fas fa-wand-magic-sparkles"></i> Auto-fill</button>' +
          '</div>' +
        '</div>' +
        '<div id="vccPreview"></div>' +
        '<div class="vid-form-group" id="vccImportRow" style="display:none;align-items:center;gap:10px">' +
          '<input type="checkbox" id="vccImportVideos" style="width:16px;height:16px;accent-color:var(--green);cursor:pointer" checked>' +
          '<label for="vccImportVideos" style="font-size:.85rem;color:var(--text-secondary);cursor:pointer"><i class="fas fa-download" style="color:var(--green);margin-right:4px"></i>არხის ყველა ვიდეო ავტომატურად გადმოვიდეს</label>' +
        '</div>' +
        '<div class="vid-modal-footer">' +
          '<button class="vid-btn ghost" id="vccCancel"><i class="fas fa-times"></i> გაუქმება</button>' +
          '<button class="vid-btn primary" id="vccSubmit" disabled><i class="fas fa-plus"></i> შექმნა</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(ov);

    var nameEl   = document.getElementById('vccName');
    var submitEl = document.getElementById('vccSubmit');

    function checkReady() { submitEl.disabled = !nameEl.value.trim(); }
    nameEl.addEventListener('input', checkReady);

    document.getElementById('vccClose').onclick =
    document.getElementById('vccCancel').onclick = function () { ov.remove(); };
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });

    /* YouTube auto-fill */
    var YT_KEY = 'AIzaSyAglbv5RL5LqRturGbqHaNrh8AH8KlLQ0I';
    document.getElementById('vccYtFetch').onclick = function () {
      var url = (document.getElementById('vccYtUrl').value || '').trim();
      if (!url) return;
      var btn = document.getElementById('vccYtFetch');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      var m = url.match(/youtube\.com\/@([\w.-]+)/) || url.match(/youtube\.com\/channel\/(UC[\w-]{20,})/);
      var apiPath = m && url.includes('/channel/')
        ? 'channels?part=snippet&id=' + encodeURIComponent(m[1])
        : m ? 'channels?part=snippet&forHandle=' + encodeURIComponent(m[1]) : null;
      if (!apiPath) { toast('YouTube URL ვერ ამოვიცანი', 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Auto-fill'; return; }
      fetch('https://www.googleapis.com/youtube/v3/' + apiPath + '&key=' + YT_KEY)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.items || !d.items[0]) throw new Error('Channel ვერ მოიძებნა');
          var sn = d.items[0].snippet;
          nameEl.value   = sn.title || '';
          document.getElementById('vccDesc').value   = (sn.description || '').slice(0, 500);
          document.getElementById('vccAvatar').value = (sn.thumbnails && (sn.thumbnails.high || sn.thumbnails.default) || {}).url || '';
          document.getElementById('vccPreview').innerHTML =
            '<div class="vid-ch-preview">' +
              (document.getElementById('vccAvatar').value ? '<img class="vid-ch-av" src="' + esc(document.getElementById('vccAvatar').value) + '" alt="">' : '') +
              '<div><div class="vid-ch-preview-name">' + esc(sn.title) + '</div>' +
              (sn.customUrl ? '<div class="vid-ch-preview-sub">' + esc(sn.customUrl) + '</div>' : '') + '</div>' +
            '</div>';
          /* show import checkbox when YouTube URL is filled */
          var importRow = document.getElementById('vccImportRow');
          if (importRow) importRow.style.display = 'flex';
          checkReady();
        })
        .catch(function (e) { toast(e.message || 'შეცდომა', 'error'); })
        .finally(function () { btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Auto-fill'; });
    };

    /* Submit */
    document.getElementById('vccSubmit').onclick = function () {
      var name = nameEl.value.trim();
      if (!name) return;
      submitEl.disabled = true;
      submitEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> იქმნება...';
      if (!fs() || !db()) { toast('Firebase unavailable', 'error'); submitEl.disabled = false; return; }
      var ytUrl = document.getElementById('vccYtUrl').value.trim();
      var doImport = !!(document.getElementById('vccImportVideos') || {}).checked && ytUrl;
      fs().addDoc(fs().collection(db(), 'channels'), {
        name:             name,
        description:      document.getElementById('vccDesc').value.trim(),
        avatar:           document.getElementById('vccAvatar').value.trim(),
        banner:           '',
        customUrl:        '',
        youtubeUrl:       ytUrl,
        youtubeChannelId: '',
        subscriberCount:  0,
        videoCount:       0,
        ownerId:          u.uid,
        createdAt:        fs().serverTimestamp()
      }).then(function (ref) {
        toast('არხი შეიქმნა! ✓');
        ov.remove();
        if (doImport) {
          /* import all videos then redirect */
          _importChannelVideos(ytUrl, ref.id, u, function () {
            window.location.href = 'channel.html?id=' + ref.id;
          });
        } else {
          window.location.href = 'channel.html?id=' + ref.id;
        }
      }).catch(function (e) {
        toast('შეცდომა: ' + e.message, 'error');
        submitEl.disabled = false;
        submitEl.innerHTML = '<i class="fas fa-plus"></i> შექმნა';
      });
    };
  }

  /* ── Helper: import all videos from YT channel URL into a GeoHub channel ── */
  function _importChannelVideos(ytUrl, geoChannelId, u, onDone) {
    var YT_KEY = 'AIzaSyAglbv5RL5LqRturGbqHaNrh8AH8KlLQ0I';
    function ytApi(path) {
      return fetch('https://www.googleapis.com/youtube/v3/' + path + '&key=' + YT_KEY).then(function (r) { return r.json(); });
    }
    function resolveId(url) {
      var m = url.match(/youtube\.com\/channel\/(UC[\w-]{20,})/);
      if (m) return Promise.resolve(m[1]);
      m = url.match(/youtube\.com\/@([\w.-]+)/);
      if (m) return ytApi('channels?part=id&forHandle=' + encodeURIComponent(m[1])).then(function (d) { return d.items && d.items[0] && d.items[0].id; });
      return Promise.resolve(null);
    }
    resolveId(ytUrl).then(function (cid) {
      if (!cid) { onDone(); return; }
      return ytApi('channels?part=contentDetails,snippet&id=' + cid).then(function (d) {
        if (!d.items || !d.items[0]) { onDone(); return; }
        var item = d.items[0];
        var uploadsId = item.contentDetails.relatedPlaylists.uploads;
        var chName = item.snippet.title;
        var chUrl  = 'https://www.youtube.com/channel/' + cid;
        var videos = [];
        function fetchPage(pt) {
          var path = 'playlistItems?part=snippet&playlistId=' + uploadsId + '&maxResults=50' + (pt ? '&pageToken=' + pt : '');
          return ytApi(path).then(function (d2) {
            (d2.items || []).forEach(function (item2) {
              var sn = item2.snippet;
              var vid = sn.resourceId && sn.resourceId.videoId;
              if (!vid || sn.title === 'Private video' || sn.title === 'Deleted video') return;
              videos.push({ youtubeId: vid, title: sn.title || '', channelName: chName, channelUrl: chUrl });
            });
            if (d2.nextPageToken) return fetchPage(d2.nextPageToken);
          });
        }
        return fetchPage(null).then(function () {
          var done = 0; var errors = 0;
          function next() {
            if (!videos.length) {
              if (fs() && db()) fs().updateDoc(fs().doc(db(), 'channels', geoChannelId), { videoCount: fs().increment(done) }).catch(function(){});
              toast(done + ' ვიდეო დაემატა ✓'); onDone(); return;
            }
            var v = videos.shift();
            saveVideo({ youtubeId: v.youtubeId, youtubeUrl: 'https://www.youtube.com/watch?v=' + v.youtubeId,
              title: v.title, thumbnail: ytMaxThumb(v.youtubeId), channelId: geoChannelId,
              channelName: v.channelName, channelUrl: v.channelUrl,
              authorId: u.uid, authorName: u.displayName || 'GeoHub User', authorAvatar: u.photoURL || '',
              category: '', city: '', description: '', isShort: false, tags: [],
              placeId: null, placeName: null, businessId: null, businessName: null
            }, function (err) { if (err) errors++; else done++; next(); });
          }
          next();
        });
      });
    }).catch(function () { onDone(); });
  }

  /* ── Add Video Modal ──────────────────────────────────── */
  function openAddVideoModal() {
    if (!authUser()) {
      toast('ვიდეოს დასამატებლად გაიარე ავტორიზაცია', 'error');
      setTimeout(function () { window.location.href = 'auth.html'; }, 800);
      return;
    }
    if (document.getElementById('vidAddModal')) return;

    var cities = ['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'ზუგდიდი', 'გორი', 'ფოთი', 'ახალციხე', 'ხაშური', 'სამტრედია', 'სენაკი', 'ზესტაფონი', 'მარტვილი', 'ობიჯვარი', 'ახმეტა', 'თელავი', 'სიღნაღი', 'დუშეთი', 'ბორჯომი', 'ბაკურიანი', 'გუდაური', 'სვანეთი', 'ანაკლია'];
    var catOpts = Object.keys(CAT_META).filter(function (k) { return k !== 'all'; }).map(function (k) {
      return '<option value="' + k + '">' + CAT_META[k].label + '</option>';
    }).join('');
    var cityOpts = cities.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');

    var ov = document.createElement('div');
    ov.className = 'vid-modal-overlay';
    ov.id = 'vidAddModal';
    ov.innerHTML =
      '<div class="vid-modal" id="vidModalBox">' +
        '<h2><i class="fab fa-youtube"></i> ვიდეოს დამატება<button class="vid-modal-close" id="vidModalClose"><i class="fas fa-times"></i></button></h2>' +
        '<div class="vid-modal-tabs" id="vidModalTabs">' +
          '<button class="vid-modal-tab active" data-vtab="single"><i class="fas fa-video"></i> ვიდეო</button>' +
          '<button class="vid-modal-tab" data-vtab="channel"><i class="fas fa-list"></i> არხის Import</button>' +
        '</div>' +
        /* ── Single video panel ── */
        '<div id="vidSinglePanel">' +
          '<div id="vidPreviewCard" class="vid-preview-card"></div>' +
          '<div class="vid-form-group vid-url-group">' +
            '<label class="vid-form-label">YouTube URL <span>*</span></label>' +
            '<input id="vidUrlInput" class="vid-form-input" type="url" placeholder="https://www.youtube.com/watch?v=...">' +
            '<button class="vid-fetch-btn" id="vidFetchBtn"><i class="fas fa-wand-magic-sparkles"></i> Auto-fill</button>' +
          '</div>' +
          '<div class="vid-form-group">' +
            '<label class="vid-form-label">სათაური <span>*</span></label>' +
            '<input id="vidTitleInput" class="vid-form-input" type="text" placeholder="ვიდეოს სათაური">' +
          '</div>' +
          '<div class="vid-form-row">' +
            '<div class="vid-form-group">' +
              '<label class="vid-form-label">კატეგორია</label>' +
              '<select id="vidCatInput" class="vid-form-select"><option value="">-- კატეგორია --</option>' + catOpts + '</select>' +
            '</div>' +
            '<div class="vid-form-group">' +
              '<label class="vid-form-label">ქალაქი</label>' +
              '<select id="vidCityInput" class="vid-form-select"><option value="">-- ქალაქი --</option>' + cityOpts + '</select>' +
            '</div>' +
          '</div>' +
          '<div class="vid-form-row">' +
            '<div class="vid-form-group">' +
              '<label class="vid-form-label"><i class="fas fa-map-pin" style="color:var(--green);margin-right:4px"></i>ადგილი (არასავალდებულო)</label>' +
              '<div class="vid-field-wrap">' +
                '<input id="vidPlaceSearch" class="vid-form-input" type="text" placeholder="ადგილის ძიება..." autocomplete="off">' +
                '<button class="vid-search-clear" id="vidPlaceClear" type="button"><i class="fas fa-times"></i></button>' +
                '<div class="vid-search-dropdown" id="vidPlaceDd"></div>' +
              '</div>' +
              '<div class="vid-search-selected" id="vidPlaceSelected"><i class="fas fa-map-pin"></i><span class="vid-search-selected-name" id="vidPlaceSelectedName"></span><button class="vid-search-selected-remove" id="vidPlaceRemove" type="button"><i class="fas fa-times"></i></button></div>' +
            '</div>' +
            '<div class="vid-form-group">' +
              '<label class="vid-form-label"><i class="fas fa-store" style="color:#60a5fa;margin-right:4px"></i>ბიზნესი (არასავალდებულო)</label>' +
              '<div class="vid-field-wrap">' +
                '<input id="vidBizSearch" class="vid-form-input" type="text" placeholder="ბიზნესის ძიება..." autocomplete="off">' +
                '<button class="vid-search-clear" id="vidBizClear" type="button"><i class="fas fa-times"></i></button>' +
                '<div class="vid-search-dropdown" id="vidBizDd"></div>' +
              '</div>' +
              '<div class="vid-search-selected" id="vidBizSelected" style="border-color:rgba(59,130,246,.2);background:rgba(59,130,246,.08)"><i class="fas fa-store" style="color:#60a5fa"></i><span class="vid-search-selected-name" id="vidBizSelectedName" style="color:#60a5fa"></span><button class="vid-search-selected-remove" id="vidBizRemove" type="button"><i class="fas fa-times"></i></button></div>' +
            '</div>' +
          '</div>' +
          '<div class="vid-form-group">' +
            '<label class="vid-form-label">აღწერა</label>' +
            '<textarea id="vidDescInput" class="vid-form-textarea" placeholder="ვიდეოზე მოკლე აღწერა..."></textarea>' +
          '</div>' +
          '<div class="vid-form-group" style="display:flex;align-items:center;gap:10px">' +
            '<input type="checkbox" id="vidIsShort" style="width:16px;height:16px;cursor:pointer">' +
            '<label for="vidIsShort" style="font-size:.85rem;color:var(--text-secondary);cursor:pointer">ეს არის Short (ვერტიკალური ვიდეო)</label>' +
          '</div>' +
          '<div class="vid-modal-footer">' +
            '<button class="vid-btn ghost" id="vidCancelBtn"><i class="fas fa-times"></i> გაუქმება</button>' +
            '<button class="vid-btn primary" id="vidSubmitBtn" disabled><i class="fas fa-plus"></i> დამატება</button>' +
          '</div>' +
        '</div>' +
        /* ── Channel import panel ── */
        '<div id="vidChannelPanel" style="display:none">' +
          '<div class="vid-form-group vid-url-group">' +
            '<label class="vid-form-label">YouTube Channel URL</label>' +
            '<input id="vidChInput" class="vid-form-input" type="url" placeholder="https://www.youtube.com/@channelname">' +
            '<button class="vid-fetch-btn" id="vidChFetchBtn"><i class="fas fa-search"></i> ძებნა</button>' +
          '</div>' +
          '<div class="vid-form-row" style="margin-bottom:12px">' +
            '<div class="vid-form-group" style="margin:0">' +
              '<label class="vid-form-label">კატეგორია (ყველასთვის)</label>' +
              '<select id="vidChCat" class="vid-form-select"><option value="">-- კატეგორია --</option>' + catOpts + '</select>' +
            '</div>' +
            '<div class="vid-form-group" style="margin:0">' +
              '<label class="vid-form-label">ქალაქი (ყველასთვის)</label>' +
              '<select id="vidChCity" class="vid-form-select"><option value="">-- ქალაქი --</option>' + cityOpts + '</select>' +
            '</div>' +
          '</div>' +
          '<div id="vidChResult"></div>' +
          '<div id="vidChFooter" style="display:none" class="vid-modal-footer">' +
            '<span id="vidChCountLabel" style="font-size:.78rem;color:var(--text-muted);margin-right:auto"></span>' +
            '<button class="vid-btn ghost" id="vidChSelectAllBtn"><i class="fas fa-check-double"></i> ყველა</button>' +
            '<button class="vid-btn primary" id="vidChImportBtn" disabled><i class="fas fa-download"></i> Import (0)</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(ov);

    /* ── Tab switcher ───────────────────────────────────── */
    document.getElementById('vidModalTabs').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-vtab]');
      if (!btn) return;
      var tab = btn.dataset.vtab;
      document.querySelectorAll('#vidModalTabs .vid-modal-tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.vtab === tab);
      });
      document.getElementById('vidSinglePanel').style.display = tab === 'single' ? '' : 'none';
      document.getElementById('vidChannelPanel').style.display = tab === 'channel' ? '' : 'none';
    });

    /* ── Channel import logic (YouTube Data API v3) ────────── */
    (function () {
      var YT_KEY = 'AIzaSyAglbv5RL5LqRturGbqHaNrh8AH8KlLQ0I';
      var _chVideos = [];

      function ytApi(path) {
        return fetch('https://www.googleapis.com/youtube/v3/' + path + '&key=' + YT_KEY)
          .then(function (r) {
            if (!r.ok) return r.json().then(function (e) { throw new Error((e.error && e.error.message) || ('HTTP ' + r.status)); });
            return r.json();
          });
      }

      /* Resolve any channel URL format → channel ID */
      function resolveChannelId(url) {
        var m;
        m = url.match(/youtube\.com\/channel\/(UC[\w-]{20,})/);
        if (m) return Promise.resolve(m[1]);

        m = url.match(/youtube\.com\/@([\w.-]+)/);
        if (m) return ytApi('channels?part=id&forHandle=' + encodeURIComponent(m[1]))
          .then(function (d) {
            if (d.items && d.items[0]) return d.items[0].id;
            throw new Error('Channel ვერ მოიძებნა: @' + m[1]);
          });

        m = url.match(/youtube\.com\/user\/([\w-]+)/);
        if (m) return ytApi('channels?part=id&forUsername=' + encodeURIComponent(m[1]))
          .then(function (d) {
            if (d.items && d.items[0]) return d.items[0].id;
            throw new Error('Channel ვერ მოიძებნა: ' + m[1]);
          });

        m = url.match(/youtube\.com\/c\/([\w-]+)/);
        if (m) return ytApi('channels?part=id&forHandle=' + encodeURIComponent(m[1]))
          .then(function (d) {
            if (d.items && d.items[0]) return d.items[0].id;
            throw new Error('Channel ვერ მოიძებნა: ' + m[1]);
          });

        throw new Error('YouTube channel URL ვერ ამოვიცანი. სცადე @handle ან /channel/UC... ფორმატი.');
      }

      /* Fetch full channel details from YouTube API */
      function getChannelInfo(ytChannelId) {
        return ytApi('channels?part=contentDetails,snippet,brandingSettings&id=' + ytChannelId)
          .then(function (d) {
            if (!d.items || !d.items[0]) throw new Error('Channel ვერ მოიძებნა');
            var item = d.items[0];
            var sn = item.snippet;
            var bs = (item.brandingSettings || {}).image || {};
            return {
              ytChannelId:  ytChannelId,
              uploadsId:    item.contentDetails.relatedPlaylists.uploads,
              name:         sn.title || '',
              description:  sn.description || '',
              avatar:       (sn.thumbnails && (sn.thumbnails.high || sn.thumbnails.medium || sn.thumbnails.default) || {}).url || '',
              banner:       bs.bannerExternalUrl || '',
              customUrl:    sn.customUrl || '',
              youtubeUrl:   'https://www.youtube.com/channel/' + ytChannelId
            };
          });
      }

      /* Create or find existing GeoHub channel doc */
      function createOrGetGeoChannel(info, userId) {
        if (!fs() || !db()) return Promise.reject(new Error('Firebase unavailable'));
        var col = fs().collection(db(), 'channels');
        return fs().getDocs(fs().query(col, fs().where('youtubeChannelId', '==', info.ytChannelId), fs().limit(1)))
          .then(function (snap) {
            if (!snap.empty) {
              var docId = snap.docs[0].id;
              var updates = {};
              if (info.banner)    updates.banner    = info.banner;
              if (info.avatar)    updates.avatar    = info.avatar;
              if (info.name)      updates.name      = info.name;
              if (info.description) updates.description = info.description;
              if (Object.keys(updates).length) {
                fs().updateDoc(fs().doc(db(), 'channels', docId), updates).catch(function(){});
              }
              return docId;
            }
            return fs().addDoc(col, {
              youtubeChannelId: info.ytChannelId,
              name:            info.name,
              description:     info.description,
              avatar:          info.avatar,
              banner:          info.banner,
              customUrl:       info.customUrl,
              youtubeUrl:      info.youtubeUrl,
              subscriberCount: 0,
              videoCount:      0,
              ownerId:         userId,
              createdAt:       fs().serverTimestamp()
            }).then(function (ref) { return ref.id; });
          });
      }

      /* Fetch all videos from uploads playlist with pagination */
      function fetchAllVideos(info) {
        var videos = [];
        var res = document.getElementById('vidChResult');

        function fetchPage(pageToken) {
          var path = 'playlistItems?part=snippet&playlistId=' + info.uploadsId +
            '&maxResults=50' + (pageToken ? '&pageToken=' + pageToken : '');
          return ytApi(path).then(function (d) {
            (d.items || []).forEach(function (item) {
              var sn = item.snippet;
              var vid = sn.resourceId && sn.resourceId.videoId;
              if (!vid || sn.title === 'Private video' || sn.title === 'Deleted video') return;
              videos.push({
                youtubeId:   vid,
                title:       sn.title || '',
                channelName: info.name,
                channelUrl:  info.youtubeUrl,
                thumbnail:   ytMaxThumb(vid)
              });
            });
            if (res) res.innerHTML = '<div class="vid-ch-loading"><i class="fas fa-spinner fa-spin"></i> ' + videos.length + ' ვიდეო ჩაიტვირთა...</div>';
            if (d.nextPageToken) return fetchPage(d.nextPageToken);
            return videos;
          });
        }
        return fetchPage(null);
      }

      var _chInfo = null; /* full channel info from YouTube API */

      function renderChannelPreview(info) {
        var res = document.getElementById('vidChResult');
        res.innerHTML =
          '<div class="vid-ch-preview">' +
            (info.avatar ? '<img class="vid-ch-av" src="' + esc(info.avatar) + '" alt="">' : '<div class="vid-ch-av-placeholder"><i class="fas fa-tv"></i></div>') +
            '<div>' +
              '<div class="vid-ch-preview-name">' + esc(info.name) + '</div>' +
              (info.customUrl ? '<div class="vid-ch-preview-sub">' + esc(info.customUrl) + '</div>' : '') +
            '</div>' +
            '<span class="vid-ch-preview-badge"><i class="fas fa-spinner fa-spin"></i> ვიდეოები იტვირთება...</span>' +
          '</div>';
      }

      function renderImportList(videos) {
        var res = document.getElementById('vidChResult');
        var footer = document.getElementById('vidChFooter');
        var importBtn = document.getElementById('vidChImportBtn');
        var countLabel = document.getElementById('vidChCountLabel');
        if (!videos.length) {
          res.innerHTML = '<div class="vid-empty" style="padding:24px 0"><i class="fas fa-video-slash"></i>ვიდეო ვერ მოიძებნა</div>';
          footer.style.display = 'none';
          return;
        }
        _chVideos = videos;
        var preview = _chInfo
          ? '<div class="vid-ch-preview">' +
              (_chInfo.avatar ? '<img class="vid-ch-av" src="' + esc(_chInfo.avatar) + '" alt="">' : '<div class="vid-ch-av-placeholder"><i class="fas fa-tv"></i></div>') +
              '<div>' +
                '<div class="vid-ch-preview-name">' + esc(_chInfo.name) + '</div>' +
                (_chInfo.customUrl ? '<div class="vid-ch-preview-sub">' + esc(_chInfo.customUrl) + '</div>' : '') +
              '</div>' +
              '<span class="vid-ch-preview-badge vid-ch-preview-badge-ok"><i class="fas fa-check"></i> GeoHub Channel შეიქმნება</span>' +
            '</div>'
          : '';
        if (countLabel) countLabel.textContent = 'სულ ' + videos.length + ' ვიდეო';
        res.innerHTML = preview + '<div class="vid-import-list">' +
          videos.map(function (v, i) {
            return '<label class="vid-import-item">' +
              '<input type="checkbox" class="vid-import-cb" data-i="' + i + '" checked>' +
              '<img class="vid-import-thumb" src="' + esc(v.thumbnail) + '" alt="" onerror="this.src=\'\';">' +
              '<div class="vid-import-title">' + esc(v.title) + '</div>' +
            '</label>';
          }).join('') +
        '</div>';
        footer.style.display = 'flex';
        function updateCount() {
          var n = res.querySelectorAll('.vid-import-cb:checked').length;
          importBtn.disabled = n === 0;
          importBtn.innerHTML = '<i class="fas fa-download"></i> Import (' + n + ')';
        }
        res.addEventListener('change', updateCount);
        updateCount();
      }

      document.getElementById('vidChFetchBtn').onclick = function () {
        var url = (document.getElementById('vidChInput').value || '').trim();
        if (!url) return;
        var res = document.getElementById('vidChResult');
        var btn = document.getElementById('vidChFetchBtn');
        _chInfo = null;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        res.innerHTML = '<div class="vid-ch-loading"><i class="fas fa-spinner fa-spin"></i> Channel იტვირთება...</div>';
        document.getElementById('vidChFooter').style.display = 'none';
        resolveChannelId(url)
          .then(function (cid) { return getChannelInfo(cid); })
          .then(function (info) {
            _chInfo = info;
            renderChannelPreview(info);
            return fetchAllVideos(info);
          })
          .then(function (vids) { renderImportList(vids); })
          .catch(function (err) {
            res.innerHTML = '<div class="vid-ch-error"><i class="fas fa-exclamation-circle"></i> ' + esc(err.message || 'შეცდომა') + '</div>';
          })
          .finally(function () {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-search"></i> ძებნა';
          });
      };

      document.getElementById('vidChSelectAllBtn').onclick = function () {
        var cbs = document.querySelectorAll('#vidChResult .vid-import-cb');
        var allChecked = Array.prototype.every.call(cbs, function (cb) { return cb.checked; });
        cbs.forEach(function (cb) { cb.checked = !allChecked; });
        cbs.length && cbs[0].dispatchEvent(new Event('change', { bubbles: true }));
      };

      document.getElementById('vidChImportBtn').onclick = function () {
        var checked = document.querySelectorAll('#vidChResult .vid-import-cb:checked');
        if (!checked.length) return;
        var u = authUser();
        if (!u) { toast('ავტორიზაცია საჭიროა', 'error'); return; }
        var cat  = (document.getElementById('vidChCat')  || {}).value || '';
        var city = (document.getElementById('vidChCity') || {}).value || '';
        var importBtn = document.getElementById('vidChImportBtn');
        importBtn.disabled = true;
        importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Channel იქმნება...';
        var indices = Array.prototype.map.call(checked, function (cb) { return parseInt(cb.dataset.i, 10); });
        var total = indices.length;
        /* First create/get the GeoHub channel doc, then import videos */
        createOrGetGeoChannel(_chInfo, u.uid)
          .then(function (geoChannelId) {
            var done = 0;
            var errors = 0;
            function next() {
              if (!indices.length) {
                /* update videoCount */
                if (fs() && db()) {
                  fs().updateDoc(fs().doc(db(), 'channels', geoChannelId), {
                    videoCount: fs().increment(done)
                  }).catch(function () {});
                }
                toast(done + ' ვიდეო დაემატა' + (errors ? ' (' + errors + ' შეცდომა)' : '') + ' ✓');
                closeAddVideoModal();
                return;
              }
              importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + done + '/' + total;
              var idx = indices.shift();
              var v = _chVideos[idx];
              saveVideo({
                youtubeId:    v.youtubeId,
                youtubeUrl:   'https://www.youtube.com/watch?v=' + v.youtubeId,
                title:        v.title,
                thumbnail:    v.thumbnail,
                channelId:    geoChannelId,
                channelName:  v.channelName,
                channelUrl:   v.channelUrl,
                authorId:     u.uid,
                authorName:   u.displayName || 'GeoHub User',
                authorAvatar: u.photoURL || '',
                category:     cat,
                city:         city,
                description:  '',
                isShort:      false,
                tags:         [],
                placeId:      null,
                placeName:    null,
                businessId:   null,
                businessName: null
              }, function (err) {
                if (err) errors++; else done++;
                next();
              });
            }
            next();
          })
          .catch(function (err) {
            toast('Channel შექმნა ვერ მოხერხდა: ' + (err.message || ''), 'error');
            importBtn.disabled = false;
            importBtn.innerHTML = '<i class="fas fa-download"></i> Import (' + indices.length + ')';
          });
      };
    }());

    var _fetched = null;
    var _selectedPlace = null;
    var _selectedBiz = null;

    document.getElementById('vidModalClose').onclick = closeAddVideoModal;
    document.getElementById('vidCancelBtn').onclick = closeAddVideoModal;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeAddVideoModal(); });

    var urlInput = document.getElementById('vidUrlInput');
    var titleInput = document.getElementById('vidTitleInput');
    var submitBtn = document.getElementById('vidSubmitBtn');

    function checkReady() {
      submitBtn.disabled = !(urlInput.value.trim() && titleInput.value.trim() && parseYTId(urlInput.value));
    }
    urlInput.addEventListener('input', function () {
      checkReady();
      var url = urlInput.value.trim();
      if (url.includes('youtube.com/shorts/') || url.includes('youtu.be/') && url.length < 35) {
        var shortCb = document.getElementById('vidIsShort');
        if (shortCb && !shortCb.checked) shortCb.checked = true;
      }
    });
    titleInput.addEventListener('input', checkReady);

    /* ── Search field wiring ─────────────────────────────── */
    function makeSearchField(inputId, clearId, ddId, selectedId, selectedNameId, removeId, searchFn, type, onSelect) {
      var inp = document.getElementById(inputId);
      var clr = document.getElementById(clearId);
      var dd  = document.getElementById(ddId);
      var sel = document.getElementById(selectedId);
      var selName = document.getElementById(selectedNameId);
      var rem = document.getElementById(removeId);
      if (!inp) return;
      var debounceT = null;

      function showDd(items) {
        if (!items.length) { dd.classList.remove('open'); dd.innerHTML = ''; return; }
        dd.innerHTML = items.map(function (it) {
          return '<div class="vid-search-item" data-id="' + esc(it.id) + '" data-name="' + esc(it.name || '') + '">' +
            '<div class="vid-search-item-icon ' + type + '"><i class="fas ' + (type === 'place' ? 'fa-map-pin' : 'fa-store') + '"></i></div>' +
            '<div class="vid-search-item-name">' + esc(it.name || '') + '</div>' +
            (it.city ? '<div class="vid-search-item-sub">' + esc(it.city) + '</div>' : '') +
          '</div>';
        }).join('');
        dd.classList.add('open');
      }

      inp.addEventListener('input', function () {
        var q = inp.value.trim();
        clr.classList.toggle('visible', !!q);
        clearTimeout(debounceT);
        if (!q) { dd.classList.remove('open'); dd.innerHTML = ''; return; }
        debounceT = setTimeout(function () {
          searchFn(q, function (items) { showDd(items); });
        }, 280);
      });

      dd.addEventListener('click', function (e) {
        var item = e.target.closest('[data-id]');
        if (!item) return;
        var id = item.dataset.id;
        var name = item.dataset.name;
        inp.value = '';
        clr.classList.remove('visible');
        dd.classList.remove('open');
        dd.innerHTML = '';
        selName.textContent = name;
        sel.classList.add('visible');
        onSelect({ id: id, name: name });
      });

      rem.addEventListener('click', function () {
        sel.classList.remove('visible');
        onSelect(null);
      });

      clr.addEventListener('click', function () {
        inp.value = '';
        clr.classList.remove('visible');
        dd.classList.remove('open');
        dd.innerHTML = '';
      });

      document.addEventListener('click', function hideDd(e) {
        if (!inp.closest('.vid-field-wrap').contains(e.target)) {
          dd.classList.remove('open');
          if (!inp.closest('#vidAddModal')) document.removeEventListener('click', hideDd);
        }
      });
    }

    makeSearchField('vidPlaceSearch','vidPlaceClear','vidPlaceDd','vidPlaceSelected','vidPlaceSelectedName','vidPlaceRemove',
      searchPlaces, 'place', function (v) { _selectedPlace = v; });
    makeSearchField('vidBizSearch','vidBizClear','vidBizDd','vidBizSelected','vidBizSelectedName','vidBizRemove',
      searchBusinesses, 'business', function (v) { _selectedBiz = v; });

    document.getElementById('vidFetchBtn').addEventListener('click', function () {
      var url = urlInput.value.trim();
      if (!url) { toast('URL ჩასვი', 'error'); return; }
      var ytId = parseYTId(url);
      if (!ytId) { toast('YouTube URL სწორად ჩასვი', 'error'); return; }
      var btn = document.getElementById('vidFetchBtn');
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      btn.disabled = true;
      fetchOEmbed(url, function (err, data) {
        btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Auto-fill';
        btn.disabled = false;
        if (err || !data) { toast('ვიდეო ვერ მოიძებნა', 'error'); return; }
        _fetched = { ytId: ytId, oembed: data };
        titleInput.value = data.title || '';
        var prev = document.getElementById('vidPreviewCard');
        prev.className = 'vid-preview-card show';
        prev.innerHTML = '<img src="' + ytMaxThumb(ytId) + '" alt="" onerror="this.src=\'' + ytThumb(ytId) + '\'">' +
          '<div class="vid-preview-info"><strong>' + esc(data.title) + '</strong><span>' + esc(data.author_name) + '</span></div>';
        checkReady();
      });
    });

    submitBtn.addEventListener('click', function () {
      var url = urlInput.value.trim();
      var ytId = parseYTId(url);
      if (!ytId) { toast('YouTube URL სწორია?', 'error'); return; }
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ინახება...';
      var u = authUser();
      var channelName = (_fetched && _fetched.oembed && _fetched.oembed.author_name) || '';
      var channelUrl  = (_fetched && _fetched.oembed && _fetched.oembed.author_url)  || '';
      var thumbnail   = (_fetched && _fetched.oembed) ? (ytMaxThumb(ytId)) : ytThumb(ytId);
      saveVideo({
        youtubeId:   ytId,
        youtubeUrl:  url,
        title:       titleInput.value.trim(),
        thumbnail:   thumbnail,
        channelName: channelName,
        channelUrl:  channelUrl,
        authorId:    u.uid,
        authorName:  u.displayName || 'GeoHub User',
        authorAvatar: u.photoURL || '',
        category:      (document.getElementById('vidCatInput') || {}).value || '',
        city:          (document.getElementById('vidCityInput') || {}).value || '',
        description:   (document.getElementById('vidDescInput') || {}).value.trim() || '',
        isShort:       !!(document.getElementById('vidIsShort') || {}).checked,
        tags:          [],
        placeId:       _selectedPlace ? _selectedPlace.id : null,
        placeName:     _selectedPlace ? _selectedPlace.name : null,
        businessId:    _selectedBiz ? _selectedBiz.id : null,
        businessName:  _selectedBiz ? _selectedBiz.name : null
      }, function (err, id) {
        if (err) {
          toast('შეცდომა: ' + err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-plus"></i> დამატება';
        } else {
          toast('ვიდეო დაემატა!');
          closeAddVideoModal();
        }
      });
    });
  }

  function closeAddVideoModal() {
    var el = document.getElementById('vidAddModal');
    if (el) el.remove();
  }

  /* ── Watch page ───────────────────────────────────────── */
  function initWatchPage() {
    var page = document.getElementById('watchPage');
    if (!page) return;

    var params = new URLSearchParams(location.search);
    var docId = params.get('v');
    if (!docId) { showWatchError('ვიდეო არ მოიძებნა'); return; }

    loadVideoById(docId, function (video) {
      if (!video) { showWatchError('ვიდეო წაშლილია ან არ არსებობს'); return; }
      if (video.status === 'hidden' || video.status === 'removed') {
        showWatchError('ეს ვიდეო აღარ არის ხელმისაწვდომი. 🚫'); return;
      }
      addToHistory(video);
      renderWatchPage(video);
      try {
        var sessKey = 'gh_viewed_' + docId;
        if (!sessionStorage.getItem(sessKey)) {
          incrementViewCount(docId);
          sessionStorage.setItem(sessKey, '1');
        }
      } catch (e) { incrementViewCount(docId); }
      loadRelated(video);
      initWatchComments(video);
    });
  }

  function showWatchError(msg) {
    var main = document.getElementById('watchMain');
    if (main) main.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted)"><i class="fas fa-film" style="font-size:3rem;display:block;margin-bottom:16px"></i><h3>' + esc(msg) + '</h3><a href="videos.html" style="color:var(--green)">← ვიდეოებზე დაბრუნება</a></div>';
  }

  function renderWatchPage(v) {
    document.title = (v.title || 'Video') + ' — GeoHub';
    var playerWrap = document.getElementById('watchPlayer');
    var titleEl = document.getElementById('watchTitle');
    var metaEl = document.getElementById('watchMeta');
    var actionsEl = document.getElementById('watchActions');
    var descEl = document.getElementById('watchDesc');
    var addedByEl = document.getElementById('watchAddedBy');

    /* Set cinematic blurred background */
    var cinBg = document.getElementById('watchCinBg');
    if (cinBg) {
      var bgThumb = v.thumbnail || ytMaxThumb(v.youtubeId);
      cinBg.style.backgroundImage = 'url(' + bgThumb + ')';
    }
    document.body.classList.add('watch-cinematic');

    if (playerWrap) {
      playerWrap.innerHTML = '<iframe src="' + ytEmbed(v.youtubeId) + '" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>';
    }
    if (titleEl) titleEl.textContent = v.title || 'Untitled';

    var m = catMeta(v.category);
    if (metaEl) {
      metaEl.innerHTML =
        (v.category ? '<span class="watch-badge cat"><i class="fas ' + m.icon + '"></i>' + m.label + '</span>' : '') +
        (v.city ? '<span class="watch-badge city"><i class="fas fa-location-dot"></i>' + esc(v.city) + '</span>' : '') +
        '<a href="https://www.youtube.com/watch?v=' + esc(v.youtubeId) + '" target="_blank" rel="noopener" class="watch-badge yt"><i class="fab fa-youtube"></i>YouTube-ზე ნახვა</a>' +
        '<span style="font-size:.8rem;color:var(--text-muted)">' + timeAgo(v.createdAt) + '</span>';
    }

    if (actionsEl) {
      actionsEl.innerHTML =
        '<button class="watch-action-btn" id="watchLikeBtn" data-vid-id="' + v.id + '">' +
          '<i class="fas fa-heart"></i><span id="watchLikeCount">' + fmtNum(v.likeCount) + '</span>' +
        '</button>' +
        '<button class="watch-action-btn" id="watchSaveBtn">' +
          '<i class="far fa-bookmark"></i>შენახვა' +
        '</button>' +
        '<button class="watch-action-btn" id="watchShareBtn">' +
          '<i class="fas fa-share-nodes"></i>გაზიარება' +
        '</button>' +
        (v.channelUrl ? '<a href="' + esc(v.channelUrl) + '" target="_blank" rel="noopener" class="watch-action-btn">' +
          '<i class="fab fa-youtube"></i>Channel</a>' : '') +
        '<a href="videos.html" class="watch-action-btn ghost">' +
          '<i class="fas fa-arrow-left"></i>ვიდეოები</a>' +
        (v.placeId ? '<a href="map.html?mode=videos&place=' + esc(v.placeId) + '" class="watch-action-btn ghost">' +
          '<i class="fas fa-map"></i>Map</a>' : '') +
        '<button class="watch-action-btn ghost" id="watchReportBtn" style="color:#ef4444"><i class="fas fa-flag"></i>Report</button>';
      bindWatchLike(v);
      bindWatchSave(v);
      bindWatchShare(v);
      var repBtn = document.getElementById('watchReportBtn');
      if (repBtn) {
        repBtn.addEventListener('click', function () { openReportModal(v.id, v); });
        checkAlreadyReported(v.id, function (already) {
          if (already) {
            repBtn.innerHTML = '<i class="fas fa-flag"></i>Reported';
            repBtn.style.color = '#94a3b8';
            repBtn.disabled = true;
          }
        });
      }
    }

    initWatchReactions(v);
    loadWatchLocation(v);

    if (descEl && v.description) {
      descEl.innerHTML = '<div class="watch-desc-wrap"><p>' + esc(v.description) + '</p></div>';
    }

    if (addedByEl) {
      var u = authUser();
      var isOwn = u && u.uid === v.authorId;
      addedByEl.innerHTML =
        '<div class="watch-added-by">' +
          '<div class="watch-creator-row">' +
            '<a class="watch-creator-left" href="' + (v.authorId ? 'profile.html?id=' + esc(v.authorId) : '#') + '">' +
              '<span class="watch-channel-av">' +
                (v.authorAvatar ? '<img src="' + esc(v.authorAvatar) + '" alt="">' : (v.authorName || 'U').charAt(0)) +
              '</span>' +
              '<div><div class="watch-channel-name">' + esc(v.authorName || 'GeoHub User') + '<span class="watch-online-dot" id="watchOnlineDot" style="display:none" title="Online now"></span></div>' +
              '<div class="watch-channel-sub">Creator on GeoHub</div></div>' +
            '</a>' +
            (!isOwn && v.authorId ? '<button class="watch-follow-btn" id="watchFollowBtn" data-author-id="' + esc(v.authorId) + '"><i class="fas fa-user-plus"></i> Follow</button>' : '') +
          '</div>' +
        '</div>';
      initWatchFollow(v);
      checkCreatorPresence(v.authorId);
    }
  }

  function bindWatchLike(v) {
    var btn = document.getElementById('watchLikeBtn');
    if (!btn) return;
    var u = authUser();
    var liked = false;

    if (u) {
      checkVideoLiked(v.id, u.uid, function (is) {
        liked = is;
        btn.classList.toggle('liked', liked);
      });
    }

    btn.addEventListener('click', function () {
      if (!u) { toast('Like-ისთვის გაიარე ავტორიზაცია', 'error'); return; }
      toggleVideoLike(v.id, u.uid, function (nowLiked) {
        liked = nowLiked;
        btn.classList.toggle('liked', liked);
        var cur = parseInt((document.getElementById('watchLikeCount') || {}).textContent) || 0;
        var newCount = liked ? cur + 1 : Math.max(cur - 1, 0);
        var el = document.getElementById('watchLikeCount');
        if (el) el.textContent = fmtNum(newCount);
        toast(liked ? 'მოიწონე!' : 'Like მოხსნილია');
        if (nowLiked && v.authorId && v.authorId !== u.uid) {
          var gs = window.GeoSocial;
          if (gs && gs.createNotification) {
            gs.createNotification(
              v.authorId, 'video_like',
              (u.displayName || 'Someone') + ' liked your video',
              v.title || '',
              'watch.html?v=' + v.id,
              { videoId: v.id, likerAvatar: u.photoURL || '' },
              'vlike_' + u.uid + '_' + v.id
            );
          }
        }
      });
    });
  }

  function bindWatchShare(v) {
    var btn = document.getElementById('watchShareBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      openShareMenu(v, btn);
    });
  }

  function loadRelated(v) {
    var sidebar = document.getElementById('watchSidebar');
    if (!sidebar) return;
    sidebar.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:8px 0"><i class="fas fa-spinner fa-spin"></i> იტვირთება...</div>';
    loadVideos({ category: v.category }, function (vids) {
      var rel = vids.filter(function (r) { return r.id !== v.id && !r.isShort; }).slice(0, 10);
      if (!rel.length) {
        sidebar.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:8px 0">მსგავსი ვიდეო არ არის</div>';
        return;
      }
      sidebar.innerHTML = rel.map(function (r) {
        var thumb = r.thumbnail || ytThumb(r.youtubeId);
        var rm = catMeta(r.category);
        return '<a class="related-vid" href="watch.html?v=' + r.id + '">' +
          '<div class="related-thumb"><img src="' + thumb + '" alt="" loading="lazy" onerror="this.src=\'' + ytThumb(r.youtubeId) + '\'"><div class="related-play"><i class="fas fa-play"></i></div></div>' +
          '<div class="related-info"><div class="related-title">' + esc(r.title || 'Untitled') + '</div>' +
            '<div class="related-meta"><i class="fas ' + rm.icon + '"></i>' + rm.label + (r.city ? ' · ' + esc(r.city) : '') + '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    });
  }

  function initWatchComments(v) {
    var section = document.getElementById('watchCommentsSection');
    if (!section) return;
    var countEl = document.getElementById('watchCommentCount');
    var listEl = document.getElementById('watchCommentsList');
    var inputEl = document.getElementById('watchCommentInput');
    var submitEl = document.getElementById('watchCommentSubmit');

    var u = authUser();
    var unsub = listenVideoComments(v.id, function (comments) {
      if (countEl) countEl.textContent = comments.length;
      if (!listEl) return;
      if (!comments.length) {
        listEl.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:12px 0">კომენტარი ჯერ არ არის. პირველი იყავი!</div>';
        return;
      }
      listEl.innerHTML = comments.map(function (c) {
        var av = c.authorAvatar ?
          '<img src="' + esc(c.authorAvatar) + '" alt="">' :
          '<span style="font-size:.7rem;font-weight:700">' + (c.authorName || 'U').charAt(0) + '</span>';
        var canDel = u && (u.uid === c.authorId || u.uid === v.authorId);
        return '<div class="watch-comment" data-cid="' + esc(c.id) + '">' +
          '<div class="watch-comment-av">' + av + '</div>' +
          '<div class="watch-comment-body">' +
            '<div class="watch-comment-name">' + esc(c.authorName || 'GeoHub User') + ' <span class="watch-comment-time">' + timeAgo(c.createdAt) + '</span>' +
              (canDel ? '<button class="watch-comment-del" data-cid="' + esc(c.id) + '" data-cauth="' + esc(c.authorId) + '" title="Delete"><i class="fas fa-trash-can"></i></button>' : '') +
            '</div>' +
            '<div class="watch-comment-text">' + esc(c.text) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      listEl.addEventListener('click', function (e) {
        var delBtn = e.target.closest('.watch-comment-del');
        if (!delBtn) return;
        var cid = delBtn.dataset.cid;
        var cauth = delBtn.dataset.cauth;
        delBtn.disabled = true;
        deleteVideoComment(v.id, cid, cauth, v.authorId, function (err) {
          if (err === 'perm') { toast('უფლება არ გაქვს', 'error'); delBtn.disabled = false; }
          else if (err) { toast('შეცდომა', 'error'); delBtn.disabled = false; }
          else { toast('კომენტარი წაიშალა'); }
        });
      }, { once: true });
    });

    if (submitEl && inputEl) {
      submitEl.addEventListener('click', function () {
        var text = inputEl.value.trim();
        if (!text) return;
        var u = authUser();
        if (!u) { toast('კომენტარისთვის გაიარე ავტორიზაცია', 'error'); return; }
        submitEl.disabled = true;
        addVideoComment(v.id, text, u, function (err) {
          submitEl.disabled = false;
          if (err) { toast('შეცდომა', 'error'); } else {
            inputEl.value = '';
            if (v.authorId && v.authorId !== u.uid) {
              var gs = window.GeoSocial;
              if (gs && gs.createNotification) {
                gs.createNotification(
                  v.authorId, 'video_comment',
                  (u.displayName || 'Someone') + ' commented on your video',
                  text.substring(0, 80),
                  'watch.html?v=' + v.id,
                  { videoId: v.id }, null
                );
              }
            }
          }
        });
      });
      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEl.click(); }
      });
    }
  }

  /* ── Boot ─────────────────────────────────────────────── */
  function boot() {
    if (auth()) {
      fb().authFns.onAuthStateChanged(auth(), function (u) {
        state.currentUser = u;
      });
    }
    if (document.getElementById('vidPage')) initVideosPage();
    if (document.getElementById('watchPage')) initWatchPage();

    /* Phase 9: global card menu-button delegation */
    document.addEventListener('click', function (e) {
      var menuBtn = e.target.closest('.vid-card-menu-btn[data-vid-menu]');
      if (!menuBtn) return;
      e.preventDefault();
      e.stopPropagation();
      var vidId = menuBtn.dataset.vidMenu;
      var all = state.videos.concat(state.shorts);
      var found = null;
      for (var i = 0; i < all.length; i++) { if (all[i].id === vidId) { found = all[i]; break; } }
      openCardContextMenu(vidId, found || { id: vidId }, menuBtn);
    });

    /* Phase 7: global save-button delegation */
    document.addEventListener('click', function (e) {
      var saveBtn = e.target.closest('.vid-save-btn[data-save-vid]');
      if (!saveBtn) return;
      e.preventDefault();
      e.stopPropagation();
      var vidId = saveBtn.dataset.saveVid;
      var u = authUser();
      if (!u) { toast('შენახვისთვის გაიარე ავტორიზაცია', 'error'); return; }
      var all = state.videos.concat(state.shorts);
      var found = null;
      for (var i = 0; i < all.length; i++) { if (all[i].id === vidId) { found = all[i]; break; } }
      var vidData = found || { id: vidId };
      toggleVideoSave(vidId, vidData, function (nowSaved) {
        if (nowSaved === null) return;
        saveBtn.classList.toggle('saved', nowSaved);
        var ico = saveBtn.querySelector('i');
        if (ico) ico.className = nowSaved ? 'fas fa-bookmark' : 'far fa-bookmark';
        toast(nowSaved ? 'შეინახა!' : 'შენახვიდან წაიშალა');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('GeoFirebaseReady', function () {
    if (document.getElementById('vidPage')) initVideosPage();
    if (document.getElementById('watchPage')) initWatchPage();
  }, { once: true });

  window.GeoVideos = {
    openAddModal: openAddVideoModal,
    parseYTId: parseYTId,
    loadVideoById: loadVideoById,
    loadVideos: loadVideos,
    toggleVideoLike: toggleVideoLike,
    checkVideoLiked: checkVideoLiked,
    addVideoComment: addVideoComment,
    listenVideoComments: listenVideoComments,
    incrementViewCount: incrementViewCount,
    toggleVideoSave: toggleVideoSave,
    checkVideoSaved: checkVideoSaved,
    loadSavedVideos: loadSavedVideos,
    addToHistory: addToHistory,
    getHistory: getHistory,
    toggleVideoReaction: toggleVideoReaction,
    listenVideoReactions: listenVideoReactions,
    reportVideo: reportVideo,
    openReportModal: openReportModal,
    timeAgo: timeAgo,
    fmtNum: fmtNum,
    ytThumb: ytThumb,
    ytEmbed: ytEmbed,
    catMeta: catMeta,
    esc: esc,
    cardHTML: vidCardHTML
  };

})();
