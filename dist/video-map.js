/* GeoHub Video Map Mode
   Adds 🎬 video pins to map.html when enabled.
   Requires: window._ghMap (set by map.js after init)
*/
(function () {
  'use strict';

  var _state = {
    active: false,
    markers: [],
    placeCache: {},
    videos: []
  };

  window.GeoVideoMap = {
    toggle: toggle,
    init:   init,
    isActive: function () { return _state.active; }
  };

  /* ── Firebase helpers ──────────────────────────────────── */
  function fb()  { return window.GeoFirebase || null; }
  function fs()  { return fb() && fb().fs  ? fb().fs  : null; }
  function db()  { return fb() && fb().db  ? fb().db  : null; }
  function map() { return window._ghMap   || null; }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Inject CSS once ───────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('vid-map-styles')) return;
    var style = document.createElement('style');
    style.id = 'vid-map-styles';
    style.textContent = [
      /* pin */
      '.vid-map-pin{cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:rgba(16,185,129,.9);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);transition:transform .15s;font-size:16px;user-select:none}',
      '.vid-map-pin:hover{transform:scale(1.15)}',
      '.vid-map-pin-count{position:absolute;top:-6px;right:-6px;background:#f97316;color:#fff;font-size:9px;font-weight:800;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 3px;border:1.5px solid #fff}',
      /* card */
      '.vid-map-card{display:none;position:absolute;bottom:80px;left:50%;transform:translateX(-50%);z-index:1200;background:rgba(12,16,30,.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.6);width:300px;max-width:calc(100vw - 32px);flex-direction:column;overflow:hidden}',
      '.vid-map-card-close{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.5);border:none;color:#fff;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;z-index:1}',
      '.vid-map-card-thumb{position:relative;display:block;aspect-ratio:16/9;overflow:hidden;background:#000;text-decoration:none}',
      '.vid-map-card-thumb img{width:100%;height:100%;object-fit:cover}',
      '.vid-map-card-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.3)}',
      '.vid-map-card-play i{width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.9rem}',
      '.vid-map-card-body{padding:12px 14px}',
      '.vid-map-card-title{font-size:.88rem;font-weight:700;color:#f1f5f9;margin-bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.vid-map-card-creator{font-size:.73rem;color:#94a3b8;margin-bottom:3px}',
      '.vid-map-card-creator i,.vid-map-card-meta i{margin-right:4px;color:#10b981}',
      '.vid-map-card-meta{font-size:.73rem;color:#94a3b8;margin-bottom:10px}',
      '.vid-map-card-actions{display:flex;align-items:center;gap:8px}',
      '.vid-map-card-watch{display:inline-flex;align-items:center;gap:6px;background:#10b981;color:#fff;font-size:.78rem;font-weight:700;padding:6px 14px;border-radius:20px;text-decoration:none;transition:background .15s}',
      '.vid-map-card-watch:hover{background:#059669}',
      '.vid-map-card-num{font-size:.72rem;color:#94a3b8}',
      '.vid-map-card-more{display:flex;gap:8px;padding:0 14px 12px;overflow-x:auto;scrollbar-width:none}',
      '.vid-map-card-more::-webkit-scrollbar{display:none}',
      '.vid-map-card-mini{flex-shrink:0;width:90px;text-decoration:none}',
      '.vid-map-card-mini img{width:100%;height:54px;object-fit:cover;border-radius:6px;display:block}',
      '.vid-map-card-mini div{font-size:.66rem;color:#94a3b8;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      /* toggle active state */
      '.map-toggle-btn.vid-active{background:rgba(16,185,129,.25);border-color:rgba(16,185,129,.6);color:#10b981}'
    ].join('');
    document.head.appendChild(style);
  }

  /* ── Toggle video mode ─────────────────────────────────── */
  function toggle() {
    _state.active = !_state.active;
    var btn = document.getElementById('vidMapToggle');
    if (btn) btn.classList.toggle('vid-active', _state.active);

    if (_state.active) {
      if (_state.videos.length) pinVideos(_state.videos);
      else loadAndPin();
    } else {
      clearMarkers();
    }
    return _state.active;
  }

  /* ── Load videos from Firestore ────────────────────────── */
  function loadAndPin() {
    if (!fs() || !db()) return;
    var q = fs().query(
      fs().collection(db(), 'videos'),
      fs().where('status', '==', 'active'),
      fs().limit(100)
    );
    fs().getDocs(q).then(function (snap) {
      var vids = [];
      snap.forEach(function (d) {
        var v = Object.assign({ id: d.id }, d.data());
        if (v.placeId || (v.lat && v.lng)) vids.push(v);
      });
      _state.videos = vids;
      if (!vids.length) return;
      enrichAndPin(vids);
    }).catch(function () {});
  }

  /* ── Fetch place coordinates for videos with placeId ────── */
  function enrichAndPin(vids) {
    var needed = [];
    vids.forEach(function (v) {
      if (v.placeId && !_state.placeCache[v.placeId] && needed.indexOf(v.placeId) < 0) {
        needed.push(v.placeId);
      }
    });
    if (!needed.length || !fs() || !db()) { pinVideos(vids); return; }

    var pending = needed.length;
    needed.forEach(function (pid) {
      fs().getDoc(fs().doc(db(), 'places', pid))
        .then(function (snap) {
          if (snap.exists()) {
            var d = snap.data();
            var lat = d.lat || d.latitude || (d.location && d.location.lat);
            var lng = d.lng || d.longitude || (d.location && d.location.lng);
            if (lat && lng) _state.placeCache[pid] = { lat: Number(lat), lng: Number(lng) };
          }
        })
        .catch(function () {})
        .finally(function () { if (--pending === 0) pinVideos(vids); });
    });
  }

  /* ── Place pins on the map ─────────────────────────────── */
  function pinVideos(vids) {
    clearMarkers();
    var m = map();
    if (!m || !window.maplibregl) return;

    /* Group by location bucket (4 decimal places ≈ 11m resolution) */
    var byLoc = {};
    vids.forEach(function (v) {
      var lat = v.lat ? Number(v.lat) : null;
      var lng = v.lng ? Number(v.lng) : null;
      if (!lat && v.placeId && _state.placeCache[v.placeId]) {
        lat = _state.placeCache[v.placeId].lat;
        lng = _state.placeCache[v.placeId].lng;
      }
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
      var key = lat.toFixed(4) + ',' + lng.toFixed(4);
      if (!byLoc[key]) byLoc[key] = { lat: lat, lng: lng, vids: [] };
      byLoc[key].vids.push(v);
    });

    Object.keys(byLoc).forEach(function (key) {
      var loc = byLoc[key];
      var count = loc.vids.length;

      var el = document.createElement('div');
      el.className = 'vid-map-pin';
      el.innerHTML = '🎬' + (count > 1 ? '<span class="vid-map-pin-count">' + count + '</span>' : '');
      el.title = loc.vids[0].title || 'Video';

      /* closure to capture loc */
      (function (captured) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          showVideoCard(captured.vids, captured.lat, captured.lng);
        });
      })(loc);

      var marker = new window.maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([loc.lng, loc.lat])
        .addTo(m);
      _state.markers.push(marker);
    });
  }

  /* ── Clear all video markers ───────────────────────────── */
  function clearMarkers() {
    _state.markers.forEach(function (m) { m.remove(); });
    _state.markers = [];
    hideVideoCard();
  }

  /* ── Show video mini-card popup ────────────────────────── */
  function showVideoCard(vids, lat, lng) {
    var card = document.getElementById('vidMapCard');
    if (!card) return;

    var v = vids[0];
    var thumb = v.thumbnail || ('https://i.ytimg.com/vi/' + (v.youtubeId || '') + '/hqdefault.jpg');

    var moreHtml = '';
    if (vids.length > 1) {
      moreHtml = '<div class="vid-map-card-more">' +
        vids.slice(1, 5).map(function (vv) {
          var t = vv.thumbnail || ('https://i.ytimg.com/vi/' + (vv.youtubeId || '') + '/hqdefault.jpg');
          return '<a href="watch.html?v=' + esc(vv.id) + '" class="vid-map-card-mini">' +
            '<img src="' + esc(t) + '" alt="" loading="lazy">' +
            '<div>' + esc(vv.title || 'Video') + '</div>' +
          '</a>';
        }).join('') +
      '</div>';
    }

    card.style.display = 'flex';
    card.innerHTML =
      '<button class="vid-map-card-close" id="vidMapCardClose">✕</button>' +
      '<a href="watch.html?v=' + esc(v.id) + '" class="vid-map-card-thumb">' +
        '<img src="' + esc(thumb) + '" alt="" loading="lazy">' +
        '<div class="vid-map-card-play"><i class="fas fa-play"></i></div>' +
      '</a>' +
      '<div class="vid-map-card-body">' +
        '<div class="vid-map-card-title">' + esc(v.title || 'Video') + '</div>' +
        (v.authorName ? '<div class="vid-map-card-creator"><i class="fas fa-user"></i>' + esc(v.authorName) + '</div>' : '') +
        (v.city ? '<div class="vid-map-card-meta"><i class="fas fa-location-dot"></i>' + esc(v.city) + '</div>' : '') +
        '<div class="vid-map-card-actions">' +
          '<a href="watch.html?v=' + esc(v.id) + '" class="vid-map-card-watch"><i class="fas fa-play"></i> Watch</a>' +
          (vids.length > 1 ? '<span class="vid-map-card-num">+' + (vids.length - 1) + ' more</span>' : '') +
        '</div>' +
      '</div>' +
      moreHtml;

    document.getElementById('vidMapCardClose').onclick = hideVideoCard;

    /* Fly to pin */
    var m = map();
    if (m) m.flyTo({ center: [lng, lat], zoom: Math.max(m.getZoom(), 13), duration: 600 });
  }

  function hideVideoCard() {
    var card = document.getElementById('vidMapCard');
    if (card) { card.style.display = 'none'; card.innerHTML = ''; }
  }

  /* ── Fly to a place by ID ──────────────────────────────── */
  function flyToPlace(placeId) {
    if (!fs() || !db()) return;
    /* Check cache first */
    if (_state.placeCache[placeId]) {
      var c = _state.placeCache[placeId];
      var m = map();
      if (m) m.flyTo({ center: [c.lng, c.lat], zoom: 15, duration: 1200 });
      return;
    }
    fs().getDoc(fs().doc(db(), 'places', placeId)).then(function (snap) {
      if (!snap.exists()) return;
      var d = snap.data();
      var lat = d.lat || d.latitude || (d.location && d.location.lat);
      var lng = d.lng || d.longitude || (d.location && d.location.lng);
      if (!lat || !lng) return;
      _state.placeCache[placeId] = { lat: Number(lat), lng: Number(lng) };
      var m = map();
      if (m) m.flyTo({ center: [Number(lng), Number(lat)], zoom: 15, duration: 1200 });
    }).catch(function () {});
  }

  /* ── Init — called by map.js after map loads ───────────── */
  function init() {
    injectStyles();

    /* Wire toggle button */
    var btn = document.getElementById('vidMapToggle');
    if (btn) btn.addEventListener('click', toggle);

    /* Parse URL params */
    var params = new URLSearchParams(location.search);

    if (params.get('mode') === 'videos') {
      _state.active = true;
      if (btn) btn.classList.add('vid-active');
      if (fs() && db()) loadAndPin();
      else window.addEventListener('GeoFirebaseReady', function () { loadAndPin(); }, { once: true });
    }

    var placeParam = params.get('place');
    if (placeParam) {
      if (fs() && db()) flyToPlace(placeParam);
      else window.addEventListener('GeoFirebaseReady', function () { flyToPlace(placeParam); }, { once: true });
    }
  }

})();
