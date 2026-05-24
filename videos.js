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
    var constraints = [fs().where('status', '==', 'active'), fs().orderBy('createdAt', 'desc'), fs().limit(60)];
    if (opts && opts.category && opts.category !== 'all') {
      constraints = [fs().where('status', '==', 'active'), fs().where('category', '==', opts.category), fs().orderBy('createdAt', 'desc'), fs().limit(60)];
    }
    var q = fs().query.apply(null, [videosCol()].concat(constraints));
    return fs().onSnapshot(q, function (snap) {
      var vids = [];
      snap.forEach(function (d) { vids.push(Object.assign({ id: d.id }, d.data())); });
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
    return '<a class="vid-card" href="watch.html?v=' + v.id + '" data-vid-id="' + v.id + '">' +
      '<div class="vid-thumb-wrap">' +
        '<img src="' + thumb + '" alt="" loading="lazy" onerror="this.src=\'' + ytThumb(v.youtubeId) + '\'">' +
        '<div class="vid-play-overlay"><div class="vid-play-btn"><i class="fas fa-play"></i></div></div>' +
        (v.category ? '<div class="vid-card-cat-badge"><i class="fas ' + m.icon + '"></i>' + m.label + '</div>' : '') +
      '</div>' +
      '<div class="vid-card-body">' +
        '<div class="vid-card-title">' + esc(v.title || 'Untitled') + '</div>' +
        '<div class="vid-card-meta">' +
          '<span class="vid-card-channel"><i class="fab fa-youtube"></i>' + esc(v.channelName || '') + '</span>' +
          (v.city ? '<span class="vid-card-city"><i class="fas fa-location-dot"></i>' + esc(v.city) + '</span>' : '') +
        '</div>' +
        '<div class="vid-card-stats">' +
          '<span class="vid-card-stat"><i class="fas fa-eye"></i>' + fmtNum(v.viewCount) + '</span>' +
          '<span class="vid-card-stat"><i class="fas fa-heart"></i>' + fmtNum(v.likeCount) + '</span>' +
          '<span class="vid-card-stat"><i class="fas fa-clock"></i>' + timeAgo(v.createdAt) + '</span>' +
        '</div>' +
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

  /* ── Videos page init ─────────────────────────────────── */
  function initVideosPage() {
    var page = document.getElementById('vidPage');
    if (!page) return;

    renderCategoryPills();
    loadAndRender();
    bindUI();
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

  function renderGrid() {
    var grid = document.getElementById('vidGrid');
    if (!grid) return;
    var vids = applySearch(applyCity(state.videos));
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
    var shorts = applyCity(state.shorts);
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
      '</div>';

    document.body.appendChild(ov);

    var _fetched = null;

    document.getElementById('vidModalClose').onclick = closeAddVideoModal;
    document.getElementById('vidCancelBtn').onclick = closeAddVideoModal;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeAddVideoModal(); });

    var urlInput = document.getElementById('vidUrlInput');
    var titleInput = document.getElementById('vidTitleInput');
    var submitBtn = document.getElementById('vidSubmitBtn');

    function checkReady() {
      submitBtn.disabled = !(urlInput.value.trim() && titleInput.value.trim() && parseYTId(urlInput.value));
    }
    urlInput.addEventListener('input', checkReady);
    titleInput.addEventListener('input', checkReady);

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
        category:    (document.getElementById('vidCatInput') || {}).value || '',
        city:        (document.getElementById('vidCityInput') || {}).value || '',
        description: (document.getElementById('vidDescInput') || {}).value.trim() || '',
        isShort:     !!(document.getElementById('vidIsShort') || {}).checked,
        tags:        [],
        lat:         null,
        lng:         null,
        placeId:     null,
        bizId:       null
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
      renderWatchPage(video);
      incrementViewCount(docId);
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
        '<button class="watch-action-btn" id="watchShareBtn">' +
          '<i class="fas fa-share-nodes"></i>გაზიარება' +
        '</button>' +
        (v.channelUrl ? '<a href="' + esc(v.channelUrl) + '" target="_blank" rel="noopener" class="watch-action-btn">' +
          '<i class="fab fa-youtube"></i>Channel</a>' : '') +
        '<a href="videos.html" class="watch-action-btn ghost">' +
          '<i class="fas fa-arrow-left"></i>ვიდეოები</a>';
      bindWatchLike(v);
      bindWatchShare(v);
    }

    if (descEl && v.description) {
      descEl.innerHTML = '<div class="watch-desc-wrap"><p>' + esc(v.description) + '</p></div>';
    }

    if (addedByEl) {
      addedByEl.innerHTML =
        '<div class="watch-added-by">' +
          '<span class="watch-channel-av">' +
            (v.authorAvatar ? '<img src="' + esc(v.authorAvatar) + '" alt="">' : (v.authorName || 'U').charAt(0)) +
          '</span>' +
          '<div><div class="watch-channel-name">' + esc(v.authorName || 'GeoHub User') + '</div>' +
          '<div class="watch-channel-sub">დამატებულია GeoHub-ზე</div></div>' +
        '</div>';
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
      });
    });
  }

  function bindWatchShare(v) {
    var btn = document.getElementById('watchShareBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var url = location.origin + '/watch.html?v=' + v.id;
      if (navigator.share) {
        navigator.share({ title: v.title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { toast('ლინკი დაკოპირდა!'); }).catch(function () {});
      }
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
        return '<div class="watch-comment">' +
          '<div class="watch-comment-av">' + av + '</div>' +
          '<div class="watch-comment-body">' +
            '<div class="watch-comment-name">' + esc(c.authorName || 'GeoHub User') + ' <span class="watch-comment-time">' + timeAgo(c.createdAt) + '</span></div>' +
            '<div class="watch-comment-text">' + esc(c.text) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
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
          if (err) { toast('შეცდომა', 'error'); } else { inputEl.value = ''; }
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
    loadVideoById: loadVideoById
  };

})();
