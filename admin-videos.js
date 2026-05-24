/* GeoHub Admin — Video Reports Moderation (Phase 9)
   Frontend-only; admin UIDs stored in Firestore adminConfig/videoMods
*/
(function () {
  'use strict';

  var state = {
    tab: 'pending',
    reports: []
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

  /* ── Admin check: reads adminConfig/videoMods.uids array ── */
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

  /* ── Update report status ────────────────────────────────── */
  function updateReportStatus(docId, newStatus, callback) {
    if (!fs() || !db()) { callback && callback('error'); return; }
    fs().updateDoc(fs().doc(db(), 'videoReports', docId), { status: newStatus })
      .then(function () { callback && callback(null); })
      .catch(function () { callback && callback('error'); });
  }

  /* ── Update video status ─────────────────────────────────── */
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

  /* ── Render table ────────────────────────────────────────── */
  function renderTable(reports) {
    var body = document.getElementById('admTableBody');
    if (!body) return;
    if (!reports.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="adm-empty"><i class="fas fa-check-circle"></i>Report არ არის ამ კატეგორიაში</div></td></tr>';
      return;
    }
    body.innerHTML = reports.map(function (r) {
      var thumb = ytThumb(r.videoYoutubeId || '');
      var statusClass = r.status === 'resolved' ? 'resolved' : r.status === 'dismissed' ? 'dismissed' : 'pending';
      var actionsHtml =
        (r.status === 'pending'
          ? '<button class="adm-btn hide" onclick="window.adminAct(\'hide\',\'' + esc(r._docId) + '\',\'' + esc(r.videoId) + '\')"><i class="fas fa-eye-slash"></i> Hide</button>' +
            '<button class="adm-btn remove" onclick="window.adminAct(\'remove\',\'' + esc(r._docId) + '\',\'' + esc(r.videoId) + '\')"><i class="fas fa-ban"></i> Remove</button>' +
            '<button class="adm-btn dismiss" onclick="window.adminAct(\'dismiss\',\'' + esc(r._docId) + '\',\'\')"><i class="fas fa-times"></i> Dismiss</button>'
          : '') +
        (r.status === 'resolved'
          ? '<button class="adm-btn restore" onclick="window.adminAct(\'restore\',\'' + esc(r._docId) + '\',\'' + esc(r.videoId) + '\')"><i class="fas fa-rotate-left"></i> Restore</button>'
          : '');

      return '<tr>' +
        '<td>' +
          (thumb ? '<a href="watch.html?v=' + esc(r.videoId) + '" target="_blank"><img class="adm-vid-thumb" src="' + thumb + '" alt="" onerror="this.style.display=\'none\'"></a>' : '') +
          '<div style="font-size:.75rem;color:var(--text-muted,#94a3b8);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px">' + esc(r.videoTitle || r.videoId) + '</div>' +
        '</td>' +
        '<td><span class="adm-reason-badge">' + esc(r.reason || '—') + '</span></td>' +
        '<td style="font-size:.75rem;color:var(--text-muted,#94a3b8)">' + esc(r.reporterName || r.reporterUid || '—') + '</td>' +
        '<td class="adm-note-col">' + esc(r.note || '') + '</td>' +
        '<td><span class="adm-status-badge ' + statusClass + '">' + esc(r.status || 'pending') + '</span></td>' +
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
      if (!confirm('ნამდვილად წაიშლება ვიდეო?')) return;
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
      var pendingCount = reports.filter(function (r) { return r.status === 'pending'; }).length;
      var badge = document.getElementById('admPendingCount');
      if (badge) badge.textContent = pendingCount + ' pending';
    });
  }

  /* ── Tabs ────────────────────────────────────────────────── */
  function bindTabs() {
    var tabs = document.getElementById('admTabs');
    if (!tabs) return;
    tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-adm-tab]');
      if (!btn) return;
      var tab = btn.dataset.admTab;
      state.tab = tab;
      tabs.querySelectorAll('.adm-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.admTab === tab); });
      refresh();
    });
  }

  /* ── Access denied message ───────────────────────────────── */
  function showDenied() {
    var wrap = document.getElementById('admWrap');
    if (wrap) wrap.innerHTML = '<div class="adm-access-denied"><i class="fas fa-lock"></i><h2>Access Denied</h2><p>Admin უფლება საჭიროა ამ გვერდზე.</p><a href="videos.html" style="color:var(--green)">← Videos-ზე დაბრუნება</a></div>';
  }

  /* ── Boot ────────────────────────────────────────────────── */
  function boot() {
    if (!document.getElementById('admWrap')) return;
    bindTabs();

    function tryInit() {
      var u = authUser();
      if (!u) {
        setTimeout(tryInit, 600);
        return;
      }
      checkAdmin(u.uid, function (isAdmin) {
        if (!isAdmin) { showDenied(); return; }
        refresh();
      });
    }

    if (auth()) {
      fb().authFns.onAuthStateChanged(auth(), function (u) {
        if (u) {
          checkAdmin(u.uid, function (isAdmin) {
            if (!isAdmin) { showDenied(); return; }
            refresh();
          });
        } else {
          showDenied();
        }
      });
    } else {
      setTimeout(tryInit, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('GeoFirebaseReady', function () { boot(); }, { once: true });

})();
