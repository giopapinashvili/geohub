(function () {
  'use strict';

  /* ── Call History Panel ─────────────────────────────────────────
     Shows recent calls (missed, incoming, outgoing) for the current user.
     Usage: GhCallHistory.open()  /  GhCallHistory.close()
  ──────────────────────────────────────────────────────────────── */

  window.GhCallHistory = window.GhCallHistory || {};
  var GH = window.GhCallHistory;

  function _t(k, fb) {
    if (typeof window.GHt === 'function') { var v = window.GHt(k); if (v && v !== k) return v; }
    return fb || k;
  }
  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function _fb() {
    var GF = window.GeoFirebase;
    return GF && GF.db && GF.fs && GF.auth ? GF : null;
  }
  function _me() {
    var GF = window.GeoFirebase;
    return GF && GF.auth && GF.auth.currentUser;
  }
  function _fmt(sec) {
    if (!sec || sec < 1) return '';
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }
  function _ago(ts) {
    if (!ts) return '';
    var ms = ts.toMillis ? ts.toMillis() : (ts.seconds ? ts.seconds * 1000 : ts);
    var diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 60)   return 'ახლა';
    if (diff < 3600) return Math.floor(diff / 60) + ' წუთის წინ';
    if (diff < 86400) return Math.floor(diff / 3600) + ' საათის წინ';
    return Math.floor(diff / 86400) + ' დღის წინ';
  }

  /* ── Panel UI ───────────────────────────────────────────────── */
  function _getPanel() {
    var el = document.getElementById('ghCallHistoryPanel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ghCallHistoryPanel';
      el.className = 'gch-panel';
      document.body.appendChild(el);
    }
    return el;
  }

  GH.open = async function () {
    var panel = _getPanel();
    panel.innerHTML = '<div class="gch-header"><span>' + _t('call_history', 'ზარების ისტორია') + '</span><button class="gch-close" onclick="GhCallHistory.close()"><i class="fas fa-times"></i></button></div><div class="gch-list" id="ghCallHistoryList"><div class="gch-loading"><i class="fas fa-spinner fa-spin"></i></div></div>';
    panel.classList.add('gch-open');

    var GF = _fb();
    var me = _me();
    if (!GF || !me) { document.getElementById('ghCallHistoryList').innerHTML = '<div class="gch-empty">შესვლა საჭიროა</div>'; return; }

    try {
      var q = GF.fs.query(
        GF.fs.collection(GF.db, 'calls'),
        GF.fs.where('callerId', '==', me.uid),
        GF.fs.orderBy('createdAt', 'desc'),
        GF.fs.limit(30)
      );
      var q2 = GF.fs.query(
        GF.fs.collection(GF.db, 'calls'),
        GF.fs.where('calleeId', '==', me.uid),
        GF.fs.orderBy('createdAt', 'desc'),
        GF.fs.limit(30)
      );

      var [snap1, snap2] = await Promise.all([GF.fs.getDocs(q), GF.fs.getDocs(q2)]);
      var calls = [];
      snap1.forEach(function (d) { calls.push(Object.assign({ _id: d.id }, d.data())); });
      snap2.forEach(function (d) { calls.push(Object.assign({ _id: d.id }, d.data())); });

      // Sort by createdAt desc and deduplicate
      var seen = {};
      calls = calls.filter(function (c) { if (seen[c._id]) return false; seen[c._id] = true; return true; });
      calls.sort(function (a, b) {
        var ta = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
        var tb = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
        return tb - ta;
      });

      var list = document.getElementById('ghCallHistoryList');
      if (!list) return;
      if (!calls.length) { list.innerHTML = '<div class="gch-empty">' + _t('call_history_empty', 'ზარების ისტორია ცარიელია') + '</div>'; return; }

      list.innerHTML = calls.map(function (c) {
        var outgoing = c.callerId === me.uid;
        var missed   = c.status === 'missed' || (c.status !== 'ended' && c.status !== 'active' && !outgoing);
        var icon, iconClass;
        if (outgoing)     { icon = 'fa-phone-arrow-up-right'; iconClass = 'gch-icon-out'; }
        else if (missed)  { icon = 'fa-phone-missed';          iconClass = 'gch-icon-miss'; }
        else              { icon = 'fa-phone-arrow-down-left'; iconClass = 'gch-icon-in'; }

        var otherName = outgoing ? _esc(c.calleeName || 'Unknown') : _esc(c.callerName || 'Unknown');
        var otherAv   = outgoing ? (c.calleeAvatar || '') : (c.callerAvatar || '');
        var avHtml    = otherAv
          ? '<img src="' + _esc(otherAv) + '" class="gch-av" onerror="this.style.display=\'none\'">'
          : '<div class="gch-av gch-av-init">' + _esc((otherName || '?')[0].toUpperCase()) + '</div>';

        var dur  = c.duration ? ' · ' + _fmt(c.duration) : '';
        var type = c.type === 'video' ? '<i class="fas fa-video gch-type-icon"></i>' : '<i class="fas fa-phone gch-type-icon"></i>';

        return '<div class="gch-row" onclick="GhCallHistory.callback(\'' + _esc(c.callerId === me.uid ? c.calleeId : c.callerId) + '\',\'' + _esc(c.callerName && c.callerId !== me.uid ? c.callerName : c.calleeName || '') + '\',\'' + _esc(otherAv) + '\',\'' + _esc(c.type || 'audio') + '\')">' +
          avHtml +
          '<div class="gch-info">' +
            '<div class="gch-name">' + type + ' ' + otherName + '</div>' +
            '<div class="gch-meta ' + iconClass + '"><i class="fas ' + icon + '"></i> ' + _ago(c.createdAt) + _esc(dur) + '</div>' +
          '</div>' +
          '<div class="gch-actions">' +
            '<button class="gch-call-btn" onclick="event.stopPropagation();GhCallHistory.callBack(\'' + _esc(c.callerId === me.uid ? c.calleeId : c.callerId) + '\',\'' + _esc(otherName) + '\',\'' + _esc(otherAv) + '\',\'' + _esc(c.type || 'audio') + '\')" title="' + _t('call_back', 'Callback') + '"><i class="fas fa-phone"></i></button>' +
          '</div>' +
        '</div>';
      }).join('');
    } catch (e) {
      var list2 = document.getElementById('ghCallHistoryList');
      if (list2) list2.innerHTML = '<div class="gch-empty">ვერ ჩაიტვირთა</div>';
    }
  };

  GH.close = function () {
    var panel = document.getElementById('ghCallHistoryPanel');
    if (panel) panel.classList.remove('gch-open');
  };

  GH.callBack = function (uid, name, avatar, type) {
    GH.close();
    if (window.GhCalls && window.GhCalls.startCall) {
      window.GhCalls.startCall(uid, name, avatar, type);
    }
  };

  // Expose for row click (profile view or call back)
  GH.callback = GH.callBack;

})();
