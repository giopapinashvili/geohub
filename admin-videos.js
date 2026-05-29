/* GeoHub Admin — Video Reports Moderation (Phase 10 polish)
   Frontend-only; admin UIDs stored in Firestore adminConfig/videoMods
*/
(function () {
  'use strict';

  var state = {
    tab: 'pending',
    reports: [],
    search: '',
    reasonFilter: ''
  };

  function fb()  { return window.GeoFirebase || null; }
  function fs()  { return fb() && fb().fs  ? fb().fs  : null; }
  function db()  { return fb() && fb().db  ? fb().db  : null; }
  function auth(){ return fb() && fb().auth ? fb().auth : null; }
  function authUser() { return auth() && auth().currentUser ? auth().currentUser : null; }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

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

  /* ── Admin check ─────────────────────────────────────────── */
  function checkAdmin(uid, callback) {
    if (!fs() || !db() || !uid) { callback(false); return; }
    fs().getDoc(fs().doc(db(), 'adminConfig', 'videoMods'))
      .then(function (snap) {
        if (!snap.exists()) { callback(false); return; }
        var uids = snap.data().uids || [];
        callback(uids.indexOf(uid) !== -1);
      })
      .catch(function () { callback(false); });
  }

  /* ── Load reports ────────────────────────────────────────── */
  function loadReports(tabFilter, callback) {
    if (!fs() || !db()) { callback([]); return; }
    var col = fs().collection(db(), 'videoReports');
    var q;
    if (tabFilter === 'all') {
      q = fs().query(col, fs().orderBy('createdAt', 'desc'), fs().limit(100));
    } else {
      q = fs().query(col, fs().where('status', '==', tabFilter), fs().orderBy('createdAt', 'desc'), fs().limit(100));
    }
    fs().getDocs(q)
      .then(function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ _docId: d.id }, d.data())); });
        callback(items);
      })
      .catch(function () { callback([]); });
  }

  /* ── Update report / video status ───────────────────────── */
  function updateReportStatus(docId, newStatus, callback) {
    if (!fs() || !db()) { callback && callback('error'); return; }
    fs().updateDoc(fs().doc(db(), 'videoReports', docId), { status: newStatus })
      .then(function () { callback && callback(null); })
      .catch(function () { callback && callback('error'); });
  }

  function updateVideoStatus(videoId, newStatus, callback) {
    if (!fs() || !db() || !videoId) { callback && callback('error'); return; }
    fs().updateDoc(fs().doc(db(), 'videos', videoId), { status: newStatus })
      .then(function () { callback && callback(null); })
      .catch(function () { callback && callback('error'); });
  }

  /* ── ytThumb helper ──────────────────────────────────────── */
  function ytThumb(id) {
    return id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : '';
  }

  /* ── Filter reports client-side ──────────────────────────── */
  function applyFilters(reports) {
    var q = state.search.toLowerCase().trim();
    var r = state.reasonFilter;
    return reports.filter(function (rep) {
      if (r && rep.reason !== r) return false;
      if (q) {
        var haystack = (rep.videoTitle || '') + ' ' + (rep.videoAuthorName || '') + ' ' + (rep.reporterName || '');
        if (haystack.toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /* ── Render table ────────────────────────────────────────── */
  function renderTable(reports) {
    var body = document.getElementById('admTableBody');
    if (!body) return;

    var filtered = applyFilters(reports);

    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="adm-empty"><i class="fas fa-check-circle"></i>' +
        (state.search || state.reasonFilter ? 'ფილტრით Report ვერ მოიძებნა' : 'Report არ არის ამ კატეგორიაში') +
        '</div></td></tr>';
      return;
    }

    body.innerHTML = filtered.map(function (r) {
      var thumb = ytThumb(r.videoYoutubeId || '');
      var statusClass = r.status === 'resolved' ? 'resolved' : r.status === 'dismissed' ? 'dismissed' : 'pending';

      var actionsHtml =
        (r.status === 'pending'
          ? '<button class="adm-btn hide"    onclick="window.adminAct(\'hide\',\''    + esc(r._docId) + '\',\'' + esc(r.videoId) + '\')"><i class="fas fa-eye-slash"></i> დამალვა</button>' +
            '<button class="adm-btn remove"  onclick="window.adminAct(\'remove\',\'' + esc(r._docId) + '\',\'' + esc(r.videoId) + '\')"><i class="fas fa-ban"></i> წაშლა</button>' +
            '<button class="adm-btn dismiss" onclick="window.adminAct(\'dismiss\',\'' + esc(r._docId) + '\',\'\')"><i class="fas fa-times"></i> უარყოფა</button>'
          : '') +
        (r.status === 'resolved'
          ? '<button class="adm-btn restore" onclick="window.adminAct(\'restore\',\'' + esc(r._docId) + '\',\'' + esc(r.videoId) + '\')"><i class="fas fa-rotate-left"></i> აღდგენა</button>'
          : '');

      return '<tr>' +
        /* Video thumbnail + title */
        '<td style="min-width:160px">' +
          (thumb
            ? '<img class="adm-vid-thumb" src="' + esc(thumb) + '" alt="" onerror="this.style.display=\'none\'">'
            : '<div style="width:64px;height:36px;background:rgba(255,255,255,.05);border-radius:5px;display:inline-block"></div>') +
          '<div class="adm-note-col" style="max-width:150px;margin-top:3px">' + esc(r.videoTitle || r.videoId || '—') + '</div>' +
        '</td>' +
        /* Creator */
        '<td>' +
          (r.videoAuthorId
            ? '<a class="adm-creator-link" href="profile.html?id=' + esc(r.videoAuthorId) + '" target="_blank">' + esc(r.videoAuthorName || r.videoAuthorId) + '</a>'
            : '<span style="color:var(--text-muted,#94a3b8);font-size:.75rem">—</span>') +
        '</td>' +
        /* Reason + reporter */
        '<td>' +
          '<span class="adm-reason-badge">' + esc(r.reason || '—') + '</span>' +
          '<div style="font-size:.7rem;color:var(--text-muted,#94a3b8);margin-top:4px">' + esc(r.reporterName || r.reporterUid || '—') + '</div>' +
        '</td>' +
        /* Note */
        '<td class="adm-note-col">' + esc(r.note || '') + '</td>' +
        /* Links */
        '<td style="white-space:nowrap">' +
          (r.videoId
            ? '<a class="adm-action-link" href="watch.html?v=' + esc(r.videoId) + '" target="_blank"><i class="fas fa-play"></i> ნახვა</a>'
            : '') +
          (r.videoAuthorId
            ? '<br><a class="adm-action-link" href="profile.html?id=' + esc(r.videoAuthorId) + '" target="_blank"><i class="fas fa-user"></i> პროფილი</a>'
            : '') +
        '</td>' +
        /* Status */
        '<td><span class="adm-status-badge ' + statusClass + '">' + ({pending:'განხილვაში',resolved:'გადაწყდა',dismissed:'უარყოფილი'}[r.status] || esc(r.status || 'pending')) + '</span></td>' +
        /* Actions */
        '<td><div class="adm-actions">' + actionsHtml + '</div></td>' +
      '</tr>';
    }).join('');
  }

  /* ── Admin action ────────────────────────────────────────── */
  window.adminAct = function (action, reportDocId, videoId) {
    if (action === 'hide') {
      updateVideoStatus(videoId, 'hidden', function (err) {
        if (err) { toast('შეცდომა', 'error'); return; }
        updateReportStatus(reportDocId, 'resolved', function () {
          toast('ვიდეო დაიმალა ✓');
          refresh();
        });
      });
    } else if (action === 'remove') {
      if (!confirm('ნამდვილად წაიშლება ვიდეო? ეს ქმედება სტატუსს "removed"-ზე დააყენებს.')) return;
      updateVideoStatus(videoId, 'removed', function (err) {
        if (err) { toast('შეცდომა', 'error'); return; }
        updateReportStatus(reportDocId, 'resolved', function () {
          toast('ვიდეო წაიშალა ✓');
          refresh();
        });
      });
    } else if (action === 'dismiss') {
      updateReportStatus(reportDocId, 'dismissed', function (err) {
        if (err) { toast('შეცდომა', 'error'); return; }
        toast('Report უარყოფილია');
        refresh();
      });
    } else if (action === 'restore') {
      updateVideoStatus(videoId, 'active', function (err) {
        if (err) { toast('შეცდომა', 'error'); return; }
        updateReportStatus(reportDocId, 'dismissed', function () {
          toast('ვიდეო აღდგა ✓');
          refresh();
        });
      });
    }
  };

  function refresh() {
    loadReports(state.tab, function (reports) {
      state.reports = reports;
      renderTable(reports);
      var pendingAll = reports.filter(function (r) { return r.status === 'pending'; }).length;
      var badge = document.getElementById('admPendingCount');
      if (badge) badge.textContent = pendingAll + ' განხილვაში';
    });
  }

  /* ── Tabs ────────────────────────────────────────────────── */
  function bindTabs() {
    var tabs = document.getElementById('admTabs');
    if (!tabs) return;
    tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-adm-tab]');
      if (!btn) return;
      state.tab = btn.dataset.admTab;
      tabs.querySelectorAll('.adm-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.admTab === state.tab); });
      refresh();
    });
  }

  /* ── Search + reason filter ──────────────────────────────── */
  function bindSearch() {
    var searchEl = document.getElementById('admSearch');
    var reasonEl = document.getElementById('admReasonFilter');
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        state.search = searchEl.value;
        renderTable(state.reports);
      });
    }
    if (reasonEl) {
      reasonEl.addEventListener('change', function () {
        state.reasonFilter = reasonEl.value;
        renderTable(state.reports);
      });
    }
  }

  /* ── Access denied ───────────────────────────────────────── */
  function showDenied() {
    var wrap = document.getElementById('admWrap');
    if (wrap) wrap.innerHTML = '<div class="adm-access-denied"><i class="fas fa-lock"></i><h2>წვდომა აკრძალულია</h2><p>ადმინის უფლება საჭიროა ამ გვერდზე.</p><a href="videos.html" style="color:var(--green)">← ვიდეოებზე დაბრუნება</a></div>';
  }

  /* ── Boot ────────────────────────────────────────────────── */
  function boot() {
    if (!document.getElementById('admWrap')) return;
    bindTabs();
    bindSearch();

    function initWithUser(u) {
      if (!u) { showDenied(); return; }
      checkAdmin(u.uid, function (isAdm) {
        if (!isAdm) { showDenied(); return; }
        refresh();
      });
    }

    if (auth()) {
      fb().authFns.onAuthStateChanged(auth(), initWithUser);
    } else {
      var tries = 0;
      var poll = setInterval(function () {
        var u = authUser();
        if (u || ++tries > 10) { clearInterval(poll); initWithUser(u); }
      }, 600);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('GeoFirebaseReady', function () { boot(); }, { once: true });

})();
