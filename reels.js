/* GeoHub Reels — Fullscreen snap-scroll video experience
   Depends on: videos.js (window.GeoVideos), firebase-config.js
*/
(function () {
  'use strict';

  var state = {
    reels: [],
    activeIdx: -1,
    unsub: null,
    observer: null,
    tapTimer: null,
    tapVidId: null,
    _lastTap: 0,
    _muted: false,
    booted: false
  };

  /* ── Helpers ────────────────────────────────────────────── */
  function GV() { return window.GeoVideos || {}; }
  function fb() { return window.GeoFirebase || null; }
  function auth() { return fb() && fb().auth ? fb().auth : null; }
  function authUser() { return auth() && auth().currentUser ? auth().currentUser : null; }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function timeAgo(ts) {
    if (!ts) return '';
    var now = Date.now();
    var t = ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : now);
    var s = Math.floor((now - t) / 1000);
    if (s < 60) return 'ახლა';
    if (s < 3600) return Math.floor(s / 60) + 'წ';
    if (s < 86400) return Math.floor(s / 3600) + 'სთ';
    return Math.floor(s / 86400) + 'დ';
  }
  function fmtNum(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }
  function ytThumb(id) { return id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : ''; }
  function ytEmbed(id) { return 'https://www.youtube.com/embed/' + id + '?autoplay=1&mute=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1'; }
  function ytCmd(iframe, cmd) {
    if (!iframe || !iframe.contentWindow) return;
    try { iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*'); } catch (e) {}
  }

  function toast(msg, type) {
    var el = document.querySelector('.gh-toast');
    if (el) el.remove();
    el = document.createElement('div');
    el.className = 'gh-toast' + (type === 'error' ? ' gh-toast-error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 250); }, 2500);
  }

  var CAT_ICONS = {
    travel: 'fa-plane', hiking: 'fa-person-hiking', food: 'fa-utensils',
    nightlife: 'fa-martini-glass', culture: 'fa-landmark', nature: 'fa-leaf',
    city: 'fa-city', beach: 'fa-umbrella-beach', winter: 'fa-snowflake',
    events: 'fa-calendar-star', local: 'fa-map-pin'
  };
  function catIcon(cat) { return CAT_ICONS[cat] || 'fa-film'; }
  function catLabel(cat) {
    var labels = { travel:'Travel', hiking:'Hiking', food:'Food', nightlife:'Nightlife',
      culture:'Culture', nature:'Nature', city:'City', beach:'Beach', winter:'Winter',
      events:'Events', local:'Local' };
    return labels[cat] || (cat || 'Video');
  }

  /* ── Load reels from Firestore ──────────────────────────── */
  function loadReels(callback) {
    var gv = window.GeoVideos;
    if (!gv || !gv.loadVideos) { callback([]); return; }
    return gv.loadVideos({ category: 'all' }, function (vids) {
      var shorts = vids.filter(function (v) { return v.isShort; });
      var longs = vids.filter(function (v) { return !v.isShort; });
      callback(shorts.concat(longs));
    });
  }

  /* ── Render reel card HTML ──────────────────────────────── */
  function reelCardHTML(v, idx, total) {
    var thumb = v.thumbnail || ytThumb(v.youtubeId);
    var avHtml = v.authorAvatar
      ? '<img src="' + esc(v.authorAvatar) + '" alt="">'
      : '<span style="font-size:.75rem;font-weight:700">' + (v.authorName || 'U').charAt(0) + '</span>';

    var u = authUser();
    var isOwn = u && v.authorId && u.uid === v.authorId;
    var followBtn = v.authorId && !isOwn
      ? '<button class="reel-follow-btn" data-follow-creator="' + esc(v.authorId) + '">Follow</button>'
      : '';

    return '<div class="reel-card" data-reel-idx="' + idx + '" data-vid-id="' + v.id + '" data-yt-id="' + esc(v.youtubeId || '') + '" data-author-id="' + esc(v.authorId || '') + '">' +
      /* Phase 7: progress bar */
      '<div class="reel-progress" id="reelProg' + idx + '"><div class="reel-progress-fill"></div></div>' +
      /* Blurred bg */
      '<div class="reel-bg"><img src="' + thumb + '" alt="" loading="lazy"></div>' +
      /* Gradient overlays */
      '<div class="reel-top-gradient"></div>' +
      '<div class="reel-gradient"></div>' +
      /* Counter */
      '<div class="reel-counter">' + (idx + 1) + ' / ' + total + '</div>' +
      /* Category badge */
      (v.category ? '<div class="reel-cat-badge"><i class="fas ' + catIcon(v.category) + '"></i>' + catLabel(v.category) + '</div>' : '') +
      /* Player area */
      '<div class="reel-player" id="reelPlayer' + idx + '">' +
        '<div class="reel-thumb-cover" id="reelCover' + idx + '">' +
          '<img src="' + thumb + '" alt="" onerror="this.src=\'' + ytThumb(v.youtubeId) + '\'">' +
          '<div class="reel-thumb-play"><i class="fas fa-play"></i></div>' +
        '</div>' +
      '</div>' +
      /* Right actions */
      '<div class="reel-actions">' +
        '<button class="reel-action reel-like-btn" data-vid-id="' + v.id + '" title="Like"><i class="fas fa-heart"></i><span class="reel-like-cnt">' + fmtNum(v.likeCount) + '</span></button>' +
        '<button class="reel-action reel-comment-btn" data-vid-id="' + v.id + '" data-idx="' + idx + '" title="Comments"><i class="fas fa-comment-dots"></i><span class="reel-comment-cnt">' + fmtNum(v.commentCount) + '</span></button>' +
        '<button class="reel-action reel-share-btn" data-vid-id="' + v.id + '" data-title="' + esc(v.title || '') + '" title="Share"><i class="fas fa-share-nodes"></i><span>Share</span></button>' +
        '<button class="reel-action reel-save-btn" data-save-reel="' + esc(v.id) + '" title="Save"><i class="far fa-bookmark"></i><span>Save</span></button>' +
        '<a class="reel-action" href="watch.html?v=' + v.id + '" title="Watch full"><i class="fas fa-expand"></i><span>Watch</span></a>' +
      '</div>' +
      /* Bottom info */
      '<div class="reel-info">' +
        '<div class="reel-info-author">' +
          '<a class="reel-info-av" href="' + (v.authorId ? 'profile.html?id=' + esc(v.authorId) : '#') + '" onclick="event.stopPropagation()">' + avHtml + '</a>' +
          '<span class="reel-info-name">' + esc(v.authorName || 'GeoHub User') + '</span>' +
          followBtn +
        '</div>' +
        '<div class="reel-info-title">' + esc(v.title || 'GeoHub Reel') + '</div>' +
        '<div class="reel-info-tags">' +
          (v.city && v.placeId
            ? '<a class="reel-info-tag" href="places.html?id=' + esc(v.placeId) + '" style="text-decoration:none;color:inherit" onclick="event.stopPropagation()"><i class="fas fa-location-dot"></i>' + esc(v.city) + '</a>'
            : (v.city ? '<span class="reel-info-tag"><i class="fas fa-location-dot"></i>' + esc(v.city) + '</span>' : '')) +
          (v.channelName ? '<span class="reel-info-tag"><i class="fab fa-youtube"></i>' + esc(v.channelName) + '</span>' : '') +
          (v.businessName && v.businessId ? '<a class="reel-info-tag" href="business.html?id=' + esc(v.businessId) + '" style="text-decoration:none;color:inherit;opacity:.85" onclick="event.stopPropagation()"><i class="fas fa-store"></i>' + esc(v.businessName) + '</a>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Render all reels ───────────────────────────────────── */
  function renderReels(reels) {
    var wrap = document.getElementById('reelsWrap');
    if (!wrap) return;
    wrap.innerHTML = reels.map(function (v, i) { return reelCardHTML(v, i, reels.length); }).join('');
    bindCardActions(wrap);
  }

  /* ── Activate reel (start playing) ─────────────────────── */
  var _isDesktop = !('ontouchstart' in window) && window.innerWidth >= 600;

  function activateReel(idx) {
    if (state.activeIdx === idx) return;

    /* Pause previous + reset progress */
    if (state.activeIdx >= 0) {
      var prevCard = document.querySelector('[data-reel-idx="' + state.activeIdx + '"]');
      if (prevCard) stopReelPlay(prevCard);
      resetProgressBar(state.activeIdx);
    }

    state.activeIdx = idx;

    /* Start progress bar */
    startProgressBar(idx);

    /* Preload next reel thumbnail */
    var next = state.reels[idx + 1];
    if (next && next.youtubeId) {
      var preloadImg = new Image();
      preloadImg.src = ytThumb(next.youtubeId);
    }

    /* On desktop: autoload iframe */
    if (_isDesktop) {
      var card = document.querySelector('[data-reel-idx="' + idx + '"]');
      if (card) startReelPlay(card, idx);
    }

    /* Update nav buttons */
    var upBtn = document.getElementById('reelNavUp');
    var downBtn = document.getElementById('reelNavDown');
    if (upBtn) upBtn.disabled = (idx === 0);
    if (downBtn) downBtn.disabled = (idx === state.reels.length - 1);

    /* Update follow state for the new reel's creator */
    updateReelFollowState(idx);

    /* Track view (debounced - only after 1.5s continuous view) */
    clearTimeout(state._viewTimer);
    var vidId = state.reels[idx] && state.reels[idx].id;
    if (vidId) {
      state._viewTimer = setTimeout(function () {
        if (state.activeIdx === idx && window.GeoVideos && window.GeoVideos.incrementViewCount) {
          window.GeoVideos.incrementViewCount(vidId);
        }
      }, 1500);
    }
  }

  function startReelPlay(card, idx) {
    var playerDiv = card.querySelector('.reel-player');
    var coverDiv = card.querySelector('.reel-thumb-cover');
    if (!playerDiv) return;
    var v = state.reels[idx];
    if (!v || !v.youtubeId) return;
    var iframe = playerDiv.querySelector('iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
      playerDiv.appendChild(iframe);
    }
    iframe.src = ytEmbed(v.youtubeId);
    if (coverDiv) coverDiv.style.display = 'none';
  }

  function stopReelPlay(card) {
    var iframe = card.querySelector('iframe');
    if (iframe) iframe.src = '';
    var coverDiv = card.querySelector('.reel-thumb-cover');
    if (coverDiv) coverDiv.style.display = '';
  }

  /* ── IntersectionObserver ───────────────────────────────── */
  function initObserver() {
    if (state.observer) { state.observer.disconnect(); }
    var wrap = document.getElementById('reelsWrap');
    if (!wrap) return;

    state.observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.intersectionRatio >= 0.75) {
          var idx = parseInt(entry.target.dataset.reelIdx, 10);
          activateReel(idx);
        }
      });
    }, { root: wrap, threshold: 0.75 });

    wrap.querySelectorAll('.reel-card').forEach(function (card) {
      state.observer.observe(card);
    });
  }

  /* ── Phase 7: Reel progress bar ────────────────────────── */
  function startProgressBar(idx) {
    var v = state.reels[idx];
    var prog = document.getElementById('reelProg' + idx);
    if (!prog) return;
    var fill = prog.querySelector('.reel-progress-fill');
    if (!fill) return;
    var dur = (v && v.isShort ? 30 : 75);
    fill.style.transition = 'none';
    fill.style.width = '0%';
    fill.offsetWidth; /* force reflow */
    fill.style.transition = 'width ' + dur + 's linear';
    fill.style.width = '100%';
  }

  function resetProgressBar(idx) {
    var prog = document.getElementById('reelProg' + idx);
    if (!prog) return;
    var fill = prog.querySelector('.reel-progress-fill');
    if (!fill) return;
    fill.style.transition = 'none';
    fill.style.width = '0%';
  }

  /* ── Phase 5: Mute button ───────────────────────────────── */
  function initMuteBtn() {
    if (document.getElementById('reelMuteBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'reelMuteBtn';
    btn.className = 'reel-mute-global';
    btn.setAttribute('aria-label', 'Mute/unmute');
    btn.innerHTML = '<i class="fas fa-volume-up"></i>';
    document.body.appendChild(btn);
    btn.addEventListener('click', function () {
      state._muted = !state._muted;
      btn.innerHTML = state._muted ? '<i class="fas fa-volume-xmark"></i>' : '<i class="fas fa-volume-up"></i>';
      var card = document.querySelector('[data-reel-idx="' + state.activeIdx + '"]');
      if (card) {
        var iframe = card.querySelector('iframe');
        ytCmd(iframe, state._muted ? 'mute' : 'unMute');
      }
    });
  }

  /* ── Phase 5: Update follow state on active reel ────────── */
  function updateReelFollowState(idx) {
    var v = state.reels[idx];
    if (!v || !v.authorId) return;
    var gs = window.GeoSocial;
    var u = authUser();
    if (!gs || !gs.checkFollowing || !u || u.uid === v.authorId) return;
    var card = document.querySelector('[data-reel-idx="' + idx + '"]');
    if (!card) return;
    var btn = card.querySelector('[data-follow-creator]');
    if (!btn) return;
    gs.checkFollowing(v.authorId, function (isFollowing) {
      if (btn) {
        btn.classList.toggle('following', !!isFollowing);
        btn.textContent = isFollowing ? 'Following' : 'Follow';
      }
    });
  }

  /* ── Scroll to reel by index ────────────────────────────── */
  function scrollToReel(idx) {
    var n = state.reels.length;
    if (idx < 0 || idx >= n) return;
    var wrap = document.getElementById('reelsWrap');
    if (!wrap) return;
    var card = wrap.querySelector('[data-reel-idx="' + idx + '"]');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── Desktop nav arrows ─────────────────────────────────── */
  function initNavArrows() {
    var upBtn = document.getElementById('reelNavUp');
    var downBtn = document.getElementById('reelNavDown');
    if (upBtn) {
      upBtn.disabled = true;
      upBtn.addEventListener('click', function () { scrollToReel(state.activeIdx - 1); });
    }
    if (downBtn) {
      downBtn.addEventListener('click', function () { scrollToReel(state.activeIdx + 1); });
    }
  }

  /* ── Keyboard navigation ────────────────────────────────── */
  function initKeyboard() {
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'j') {
        e.preventDefault();
        scrollToReel(state.activeIdx + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'k') {
        e.preventDefault();
        scrollToReel(state.activeIdx - 1);
      }
    });
  }

  /* ── Double-tap like ────────────────────────────────────── */
  function fireLike(card, vidId) {
    var u = authUser();
    if (!u) { toast('Like-ისთვის გაიარე ავტორიზაცია', 'error'); return; }
    if (!window.GeoVideos || !window.GeoVideos.toggleVideoLike) return;
    window.GeoVideos.toggleVideoLike(vidId, u.uid, function (nowLiked) {
      var likeBtn = card.querySelector('.reel-like-btn');
      if (likeBtn) likeBtn.classList.toggle('liked', nowLiked);
      var cntEl = card.querySelector('.reel-like-cnt');
      if (cntEl) {
        var n = parseInt(cntEl.textContent.replace(/[KM].*/, '')) || 0;
        cntEl.textContent = fmtNum(nowLiked ? n + 1 : Math.max(n - 1, 0));
      }
    });
    /* Heart burst animation */
    var burst = document.createElement('div');
    burst.className = 'reel-heart-burst';
    burst.textContent = '❤️';
    card.appendChild(burst);
    setTimeout(function () { if (burst.parentNode) burst.parentNode.removeChild(burst); }, 700);
  }

  /* ── Bind click/tap actions on cards ───────────────────── */
  function bindCardActions(wrap) {
    wrap.addEventListener('click', function (e) {
      /* Like button */
      var likeBtn = e.target.closest('.reel-like-btn');
      if (likeBtn) {
        e.stopPropagation();
        var card = likeBtn.closest('.reel-card');
        fireLike(card, likeBtn.dataset.vidId);
        return;
      }

      /* Comment button */
      var commentBtn = e.target.closest('.reel-comment-btn');
      if (commentBtn) {
        e.stopPropagation();
        openComments(commentBtn.dataset.vidId, parseInt(commentBtn.dataset.idx, 10));
        return;
      }

      /* Share button */
      var shareBtn = e.target.closest('.reel-share-btn');
      if (shareBtn) {
        e.stopPropagation();
        var url = location.origin + '/watch.html?v=' + shareBtn.dataset.vidId;
        var title = shareBtn.dataset.title;
        if (navigator.share) {
          navigator.share({ title: title, url: url }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () { toast('ლინკი დაკოპირდა!'); }).catch(function () {});
        }
        return;
      }

      /* Save reel button */
      var saveBtn = e.target.closest('.reel-save-btn[data-save-reel]');
      if (saveBtn) {
        e.stopPropagation();
        var uSave = authUser();
        var vidIdSave = saveBtn.dataset.saveReel;
        if (!uSave) { toast('შენახვისთვის გაიარე ავტორიზაცია', 'error'); return; }
        var gv = window.GeoVideos;
        if (!gv || !gv.toggleVideoSave) return;
        var vSave = null;
        for (var si = 0; si < state.reels.length; si++) { if (state.reels[si].id === vidIdSave) { vSave = state.reels[si]; break; } }
        gv.toggleVideoSave(vidIdSave, vSave || { id: vidIdSave }, function (nowSaved) {
          if (nowSaved === null) return;
          saveBtn.classList.toggle('saved', nowSaved);
          var ico = saveBtn.querySelector('i');
          if (ico) ico.className = nowSaved ? 'fas fa-bookmark' : 'far fa-bookmark';
          toast(nowSaved ? 'შეინახა!' : 'შენახვიდან წაიშალა');
        });
        return;
      }

      /* Follow creator button */
      var followBtn2 = e.target.closest('[data-follow-creator]');
      if (followBtn2) {
        e.stopPropagation();
        var gs = window.GeoSocial;
        var u2 = authUser();
        var creatorId = followBtn2.dataset.followCreator;
        if (!gs || !gs.toggleFollow || !u2 || !creatorId) {
          if (!u2) toast('Follow-ისთვის გაიარე ავტორიზაცია', 'error');
          return;
        }
        gs.toggleFollow(creatorId, function (nowFollowing) {
          followBtn2.classList.toggle('following', !!nowFollowing);
          followBtn2.textContent = nowFollowing ? 'Following' : 'Follow';
          toast(nowFollowing ? 'Creator-ს დაუფოლოუე!' : 'Unfollowed');
        });
        return;
      }

      /* Tap on cover (play) */
      var cover = e.target.closest('.reel-thumb-cover');
      if (cover) {
        e.stopPropagation();
        var card2 = cover.closest('.reel-card');
        var idx = parseInt(card2.dataset.reelIdx, 10);
        startReelPlay(card2, idx);
        return;
      }

      /* Double-tap on card to like */
      var card3 = e.target.closest('.reel-card');
      if (!card3) return;
      var vidId = card3.dataset.vidId;
      var now = Date.now();
      if (state.tapTimer && state.tapVidId === vidId && now - state._lastTap < 330) {
        clearTimeout(state.tapTimer);
        state.tapTimer = null;
        fireLike(card3, vidId);
      } else {
        state._lastTap = now;
        state.tapVidId = vidId;
        state.tapTimer = setTimeout(function () { state.tapTimer = null; }, 400);
      }
    });
  }

  /* ── Comments slide-up panel ────────────────────────────── */
  function openComments(vidId, reelIdx) {
    if (document.getElementById('reelCommentsPanel')) return;

    var u = authUser();
    var av = u && u.photoURL
      ? '<img src="' + esc(u.photoURL) + '" alt="">'
      : '<i class="fas fa-user" style="font-size:.75rem"></i>';

    var panel = document.createElement('div');
    panel.id = 'reelCommentsPanel';
    panel.className = 'reel-comments-overlay';
    panel.innerHTML =
      '<div class="reel-comments-backdrop"></div>' +
      '<div class="reel-comments-sheet">' +
        '<div class="reel-comments-handle">' +
          '<h4><i class="fas fa-comments"></i> კომენტარები</h4>' +
          '<button class="reel-comments-close" id="reelCommentsClose"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="reel-comments-list" id="reelCommentsList">' +
          '<div class="reel-comments-empty"><i class="fas fa-spinner fa-spin"></i> იტვირთება...</div>' +
        '</div>' +
        '<div class="reel-comment-input-row">' +
          '<div class="reel-comment-av-sm">' + av + '</div>' +
          '<input class="reel-comment-text-inp" id="reelCommentInput" type="text" placeholder="კომენტარი...">' +
          '<button class="reel-send-btn" id="reelCommentSend"><i class="fas fa-paper-plane"></i></button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(panel);

    panel.querySelector('.reel-comments-backdrop').addEventListener('click', closeComments);
    document.getElementById('reelCommentsClose').addEventListener('click', closeComments);

    /* Load comments */
    var unsub = null;
    if (window.GeoVideos && window.GeoVideos.listenVideoComments) {
      unsub = window.GeoVideos.listenVideoComments(vidId, function (comments) {
        renderComments(comments);
      });
    }

    /* Send comment */
    var input = document.getElementById('reelCommentInput');
    var sendBtn = document.getElementById('reelCommentSend');
    function doSend() {
      var text = input.value.trim();
      if (!text) return;
      var user = authUser();
      if (!user) { toast('კომენტარისთვის გაიარე ავტორიზაცია', 'error'); return; }
      sendBtn.disabled = true;
      if (window.GeoVideos && window.GeoVideos.addVideoComment) {
        window.GeoVideos.addVideoComment(vidId, text, user, function (err) {
          sendBtn.disabled = false;
          if (!err) {
            input.value = '';
            /* update comment count on reel card */
            var card = document.querySelector('[data-vid-id="' + vidId + '"]');
            if (card) {
              var cntEl = card.querySelector('.reel-comment-cnt');
              if (cntEl) {
                var n = parseInt(cntEl.textContent) || 0;
                cntEl.textContent = fmtNum(n + 1);
              }
            }
          }
        });
      }
    }
    sendBtn.addEventListener('click', doSend);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSend(); } });

    panel._unsub = unsub;
  }

  function renderComments(comments) {
    var list = document.getElementById('reelCommentsList');
    if (!list) return;
    if (!comments.length) {
      list.innerHTML = '<div class="reel-comments-empty">კომენტარი ჯერ არ არის. პირველი იყავი! 💬</div>';
      return;
    }
    list.innerHTML = comments.map(function (c) {
      var av = c.authorAvatar
        ? '<img src="' + esc(c.authorAvatar) + '" alt="">'
        : '<span style="font-size:.65rem;font-weight:700">' + (c.authorName || 'U').charAt(0) + '</span>';
      return '<div class="reel-comment">' +
        '<div class="reel-comment-av">' + av + '</div>' +
        '<div>' +
          '<div class="reel-comment-name">' + esc(c.authorName || 'GeoHub User') + ' <span class="reel-comment-time">' + timeAgo(c.createdAt) + '</span></div>' +
          '<div class="reel-comment-text">' + esc(c.text) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function closeComments() {
    var panel = document.getElementById('reelCommentsPanel');
    if (!panel) return;
    if (panel._unsub) panel._unsub();
    panel.remove();
  }

  /* ── Check initial likes ────────────────────────────────── */
  function checkLikedStates(reels) {
    var u = authUser();
    if (!u || !window.GeoVideos || !window.GeoVideos.checkVideoLiked) return;
    reels.forEach(function (v) {
      window.GeoVideos.checkVideoLiked(v.id, u.uid, function (liked) {
        if (!liked) return;
        var btn = document.querySelector('.reel-like-btn[data-vid-id="' + v.id + '"]');
        if (btn) btn.classList.add('liked');
      });
    });
  }

  /* ── Boot ───────────────────────────────────────────────── */
  function boot() {
    if (state.booted) return;
    var wrap = document.getElementById('reelsWrap');
    if (!wrap) return;
    state.booted = true;

    if (state.unsub) { state.unsub(); state.unsub = null; }

    state.unsub = loadReels(function (reels) {
      state.reels = reels;
      if (!reels.length) {
        wrap.innerHTML =
          '<div class="reels-empty">' +
            '<i class="fas fa-video-slash"></i>' +
            '<h3>Reels ჯერ არ არის</h3>' +
            '<p>დაამატე პირველი ვიდეო და ის აქ გამოჩნდება!</p>' +
            '<a href="videos.html"><i class="fas fa-plus"></i> ვიდეოს დამატება</a>' +
          '</div>';
        return;
      }
      renderReels(reels);
      initObserver();
      initNavArrows();
      initKeyboard();
      initMuteBtn();
      /* Activate first reel after a tick */
      setTimeout(function () {
        activateReel(0);
        checkLikedStates(reels);
      }, 100);
    });
  }

  /* ── Init sequence ──────────────────────────────────────── */
  window.addEventListener('GeoFirebaseReady', function () {
    if (document.getElementById('reelsWrap')) boot();
  }, { once: true });

  /* Fallback: if GeoFirebaseReady already fired */
  if (document.readyState !== 'loading') {
    setTimeout(function () {
      if (!state.booted && document.getElementById('reelsWrap')) boot();
    }, 300);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () {
        if (!state.booted && document.getElementById('reelsWrap')) boot();
      }, 300);
    });
  }

})();
