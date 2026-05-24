(function () {
  'use strict';

  function fb()    { return window.GeoFirebase || null; }
  function fs()    { return fb() && fb().fs   ? fb().fs   : null; }
  function db()    { return fb() && fb().db   ? fb().db   : null; }
  function auth()  { return fb() && fb().auth ? fb().auth : null; }
  function authUser() { return auth() && auth().currentUser ? auth().currentUser : null; }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }
  function timeAgo(ts) {
    if (!ts) return '';
    var ms = ts.toMillis ? ts.toMillis() : ts;
    var s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60)   return 'ახლახანს';
    if (s < 3600) return Math.floor(s/60) + ' წ. წინ';
    if (s < 86400) return Math.floor(s/3600) + ' სთ. წინ';
    return Math.floor(s/86400) + ' დღის წინ';
  }

  var CHANNEL_ID = new URLSearchParams(location.search).get('id');

  /* ── Load & render channel ──────────────────────────────── */
  function loadChannel() {
    if (!CHANNEL_ID) { showError('Channel ID არ არის'); return; }
    if (!fs() || !db()) { window.addEventListener('GeoFirebaseReady', loadChannel, { once: true }); return; }

    fs().getDoc(fs().doc(db(), 'channels', CHANNEL_ID))
      .then(function (snap) {
        if (!snap.exists()) { showError('Channel ვერ მოიძებნა'); return; }
        renderChannel(Object.assign({ _id: snap.id }, snap.data()));
      })
      .catch(function (e) { showError(e.message); });
  }

  function renderChannel(ch) {
    document.title = esc(ch.name) + ' — GeoHub';

    var page = document.getElementById('channelPage');
    if (!page) return;

    page.innerHTML =
      /* Banner */
      '<div class="ch-banner">' +
        (ch.banner
          ? '<img class="ch-banner-img" src="' + esc(ch.banner) + '" alt="" onerror="this.style.display=\'none\'">'
          : '') +
      '</div>' +

      /* Meta row */
      '<div class="ch-meta">' +
        '<div class="ch-avatar-wrap">' +
          (ch.avatar
            ? '<img class="ch-avatar" src="' + esc(ch.avatar) + '" alt="">'
            : '<div class="ch-avatar-placeholder"><i class="fas fa-tv"></i></div>') +
        '</div>' +
        '<div class="ch-info">' +
          '<h1 class="ch-name">' + esc(ch.name || 'Channel') + '</h1>' +
          '<div class="ch-stats">' +
            '<span id="chSubCount"><i class="fas fa-users"></i> ' + fmtNum(ch.subscriberCount) + ' გამომწერი</span>' +
            ' &middot; <span>' + fmtNum(ch.videoCount) + ' ვიდეო</span>' +
            (ch.customUrl ? ' &middot; <span>' + esc(ch.customUrl) + '</span>' : '') +
          '</div>' +
          (ch.description
            ? '<p class="ch-description">' + esc(ch.description.slice(0, 200)) + (ch.description.length > 200 ? '…' : '') + '</p>'
            : '') +
          (ch.youtubeUrl
            ? '<a class="ch-yt-link" href="' + esc(ch.youtubeUrl) + '" target="_blank" rel="noopener"><i class="fab fa-youtube"></i> YouTube-ზე ნახვა</a>'
            : '') +
        '</div>' +
        '<div class="ch-actions">' +
          '<button class="ch-sub-btn" id="chSubBtn"><i class="fas fa-plus"></i> გამოწერა</button>' +
        '</div>' +
      '</div>' +

      /* Videos section */
      '<div class="ch-videos-section">' +
        '<div class="ch-section-header">' +
          '<h2 class="ch-section-title"><i class="fas fa-video"></i> ვიდეოები</h2>' +
        '</div>' +
        '<div id="chVideoGrid" class="vid-grid"><div class="ch-init-loading"><i class="fas fa-spinner fa-spin"></i></div></div>' +
      '</div>';

    /* Subscribe button state */
    initSubBtn(ch);

    /* Load videos */
    loadChannelVideos(ch._id);
  }

  /* ── Subscribe / Unsubscribe ────────────────────────────── */
  function initSubBtn(ch) {
    var btn = document.getElementById('chSubBtn');
    if (!btn) return;

    var u = authUser();
    if (!u) {
      btn.onclick = function () { window.location.href = 'auth.html'; };
      return;
    }

    /* Check current state */
    fs().getDoc(fs().doc(db(), 'channels', ch._id, 'subscribers', u.uid))
      .then(function (d) { setSubBtn(btn, d.exists()); })
      .catch(function () {});

    btn.onclick = function () {
      var u2 = authUser();
      if (!u2) { window.location.href = 'auth.html'; return; }
      btn.disabled = true;
      var subRef = fs().doc(db(), 'channels', ch._id, 'subscribers', u2.uid);
      var chRef  = fs().doc(db(), 'channels', ch._id);
      fs().getDoc(subRef).then(function (d) {
        if (d.exists()) {
          return fs().deleteDoc(subRef)
            .then(function () { return fs().updateDoc(chRef, { subscriberCount: fs().increment(-1) }); })
            .then(function () {
              setSubBtn(btn, false);
              decrementSubDisplay();
            });
        } else {
          return fs().setDoc(subRef, { subscribedAt: fs().serverTimestamp() })
            .then(function () { return fs().updateDoc(chRef, { subscriberCount: fs().increment(1) }); })
            .then(function () {
              setSubBtn(btn, true);
              incrementSubDisplay();
            });
        }
      }).finally(function () { btn.disabled = false; });
    };
  }

  function setSubBtn(btn, subscribed) {
    if (subscribed) {
      btn.innerHTML = '<i class="fas fa-check"></i> გამოწერილია';
      btn.classList.add('subscribed');
    } else {
      btn.innerHTML = '<i class="fas fa-plus"></i> გამოწერა';
      btn.classList.remove('subscribed');
    }
  }

  function incrementSubDisplay() {
    var el = document.getElementById('chSubCount');
    if (!el) return;
    var m = el.textContent.match(/[\d.,KM]+/);
    if (m) el.innerHTML = '<i class="fas fa-users"></i> ' + fmtNum((parseFloat(m[0]) || 0) + 1) + ' გამომწერი';
  }
  function decrementSubDisplay() {
    var el = document.getElementById('chSubCount');
    if (!el) return;
    var m = el.textContent.match(/[\d.,KM]+/);
    if (m) el.innerHTML = '<i class="fas fa-users"></i> ' + fmtNum(Math.max(0, (parseFloat(m[0]) || 1) - 1)) + ' გამომწერი';
  }

  /* ── Load channel videos ────────────────────────────────── */
  function loadChannelVideos(channelId) {
    var grid = document.getElementById('chVideoGrid');
    if (!grid || !fs() || !db()) return;

    fs().getDocs(fs().query(
      fs().collection(db(), 'videos'),
      fs().where('channelId', '==', channelId),
      fs().limit(200)
    )).then(function (snap) {
      var vids = [];
      snap.forEach(function (d) {
        var v = d.data();
        if (v.status === 'hidden' || v.status === 'removed') return;
        vids.push(Object.assign({ id: d.id }, v));
      });

      /* sort newest first client-side */
      vids.sort(function (a, b) {
        var ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
        var tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });

      if (!vids.length) {
        grid.innerHTML = '<div class="vid-empty"><i class="fas fa-video-slash"></i><h3>ვიდეო არ არის</h3><p>ჯერ ვიდეო არ დამატებულა</p></div>';
        return;
      }

      /* Use GeoVideos card renderer if videos.js is loaded */
      if (window.GeoVideos && window.GeoVideos.cardHTML) {
        grid.innerHTML = vids.map(function (v) { return window.GeoVideos.cardHTML(v); }).join('');
        /* re-init save buttons */
        if (window.GeoVideos.initSaveButtons) window.GeoVideos.initSaveButtons();
      } else {
        grid.innerHTML = vids.map(function (v) {
          var thumb = v.thumbnail || ('https://i.ytimg.com/vi/' + (v.youtubeId || '') + '/hqdefault.jpg');
          return '<a class="vid-card" href="watch.html?v=' + esc(v.id) + '">' +
            '<div class="vid-thumb-wrap">' +
              '<img src="' + esc(thumb) + '" alt="" loading="lazy">' +
              '<div class="vid-play-overlay"><div class="vid-play-btn"><i class="fas fa-play"></i></div></div>' +
            '</div>' +
            '<div class="vid-card-body">' +
              '<div class="vid-card-title">' + esc(v.title || 'Untitled') + '</div>' +
              '<div class="vid-card-meta">' +
                '<span class="vid-card-stat"><i class="fas fa-eye"></i>' + fmtNum(v.viewCount) + '</span>' +
                '<span class="vid-card-stat"><i class="fas fa-clock"></i>' + timeAgo(v.createdAt) + '</span>' +
              '</div>' +
            '</div>' +
          '</a>';
        }).join('');
      }
    }).catch(function () {
      grid.innerHTML = '<div class="vid-empty"><i class="fas fa-exclamation-circle"></i><h3>ჩატვირთვის შეცდომა</h3></div>';
    });
  }

  /* ── Error state ────────────────────────────────────────── */
  function showError(msg) {
    var page = document.getElementById('channelPage');
    if (page) page.innerHTML = '<div class="vid-empty" style="padding:100px 0"><i class="fas fa-exclamation-circle" style="font-size:3rem;color:#ef4444;display:block;margin-bottom:16px"></i><h3>' + esc(msg) + '</h3><a href="videos.html" style="color:var(--green)">← Videos-ზე დაბრუნება</a></div>';
  }

  /* ── Boot ───────────────────────────────────────────────── */
  function boot() {
    if (!document.getElementById('channelPage')) return;
    if (fs() && db()) {
      loadChannel();
    } else {
      window.addEventListener('GeoFirebaseReady', loadChannel, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
