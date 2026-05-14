(function () {
  'use strict';
  /* ── AUTH GUARD ────────────────────────────────────────────── */
  function adminGuardReady(cb) {
    function waitFirebase(fn){
      if (window.GeoFirebase && window.GeoFirebase.db && window.GeoFirebase.fs) return fn();
      window.addEventListener('GeoFirebaseReady', fn, { once: true });
    }
    function check() {
      var u = (window.GeoAuth && window.GeoAuth.getCurrentUser && window.GeoAuth.getCurrentUser()) || window.GeoCurrentUser || (window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser);
      if (!u || !u.uid) { window.location.href = 'auth.html'; return; }
      waitFirebase(function(){
        var fb = window.GeoFirebase, f = fb && fb.fs;
        if (!fb || !f) { window.location.href = 'index.html'; return; }
        f.getDoc(f.doc(fb.db, 'admins', u.uid)).then(function(snap){
          if (!snap.exists()) { window.location.href = 'index.html'; return; }
          if (cb) cb(u);
        }).catch(function(){ window.location.href = 'index.html'; });
      });
    }
    if (window.GeoAuth && window.GeoAuth.isReady && window.GeoAuth.isReady()) check();
    else window.addEventListener('GeoAuthReady', check, { once: true });
    // Fallback: wait for Firebase Auth's own onAuthStateChanged to fire (handles slow/offline starts)
    if (window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.authFns) {
      var _unsub = window.GeoFirebase.authFns.onAuthStateChanged(window.GeoFirebase.auth, function (u) {
        _unsub();
        if (!u) { window.location.href = 'auth.html'; return; }
        window.GeoCurrentUser = window.GeoCurrentUser || u;
        check();
      });
    } else {
      // Last resort: 4s timeout (doubled from before to tolerate slow mobile connections)
      setTimeout(function () {
        if (!(window.GeoAuth && window.GeoAuth.getCurrentUser && window.GeoAuth.getCurrentUser()) &&
            !(window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser)) {
          window.location.href = 'auth.html';
        }
      }, 4000);
    }
  }
  adminGuardReady();

  /* ── PLACEHOLDER DATA ─────────────────────────────────────────────── */

  var USERS = [];

  var BUSINESSES = [];

  var CREATORS = [];

  var MOD_QUEUE = [];

  var LIVE_EVENTS = [];

  /* ── STATE ───────────────────────────────────────────────── */
  var currentSection = 'overview';
  var liveRunning    = true;
  var liveFeedCount  = 0;
  var liveTimer      = null;
  var liveActiveCount = 0;
  var selectedUser   = null;
  var modItems       = MOD_QUEUE.slice();
  var notifCount     = 0;

  /* ── NAVIGATION ──────────────────────────────────────────── */
  window.adminNav = function (section) {
    document.querySelectorAll('.sec').forEach(function (s) { s.classList.remove('active'); });
    document.querySelectorAll('.sb-item').forEach(function (i) { i.classList.remove('active'); });

    var el = document.getElementById('sec-' + section);
    if (el) el.classList.add('active');

    document.querySelectorAll('.sb-item').forEach(function (i) {
      if (i.getAttribute('onclick') && i.getAttribute('onclick').indexOf("'" + section + "'") !== -1) {
        i.classList.add('active');
      }
    });

    currentSection = section;

    if (section === 'live')     startLiveFeed();
    if (section === 'revenue')  { setTimeout(drawRevChart, 80); setTimeout(drawRevTrendChart, 80); }
    if (section === 'overview') { setTimeout(drawOverviewCharts, 80); }
    if (section === 'activity') { setTimeout(function () { window.loadActivity(_activityFilter || 'all'); }, 60); }
  };

  /* ── TOAST ───────────────────────────────────────────────── */
  function toast(msg, color) {
    var el = document.getElementById('adminToast');
    var msgEl = document.getElementById('adminToastMsg');
    msgEl.textContent = msg;
    el.style.background = color || 'rgba(16,185,129,0.95)';
    el.style.color = color ? '#fff' : '#000';
    el.style.transform = 'translateX(-50%) translateY(0)';
    el.style.opacity = '1';
    setTimeout(function () {
      el.style.transform = 'translateX(-50%) translateY(60px)';
      el.style.opacity = '0';
    }, 2500);
  }

  /* ── RENDER STATS (called after data is loaded) ─────────── */
  function renderStats(registeredUsers, bizCount) {
    bizCount = bizCount || 0;
    var userCount = registeredUsers.length;
    var el;

    el = document.getElementById('stat-users');  if (el) el.textContent = userCount || '—';
    el = document.getElementById('stat-biz');    if (el) el.textContent = bizCount;
    el = document.getElementById('stat-events'); if (el) el.textContent = '0';
    el = document.getElementById('stat-rev');    if (el) el.textContent = '₾0';
    el = document.getElementById('stat-checkins'); if (el) el.textContent = '0';
    el = document.getElementById('stat-reviews');  if (el) el.textContent = '0';
    el = document.getElementById('stat-rewards');  if (el) el.textContent = '0';
    el = document.getElementById('stat-missions'); if (el) el.textContent = '0';
    el = document.getElementById('stat-reports');  if (el) el.textContent = '0';
    el = document.getElementById('stat-trust');    if (el) el.textContent = '—';

    el = document.getElementById('sb-users');     if (el) el.textContent = userCount || '—';
    el = document.getElementById('sb-biz-side'); if (el) el.textContent = bizCount;
    el = document.getElementById('sb-creators');  if (el) el.textContent = '0';
    el = document.getElementById('sb-notif');     if (el) el.textContent = '0';
    el = document.getElementById('sb-live');      if (el) el.textContent = '0';

    el = document.getElementById('bizSubtitle');
    if (el) el.textContent = bizCount + ' registered · Verify, feature, approve';
    el = document.getElementById('usersSubtitle');
    if (el) el.textContent = userCount + ' registered · Firebase Auth';

    var tbody = document.getElementById('usersBody');
    if (tbody) {
      if (registeredUsers.length) {
        tbody.innerHTML = registeredUsers.map(function(u) {
          var name = u.fullName || u.username || u.email || 'Unknown';
          var email = u.email || '—';
          var type = u.accountType || 'Explorer';
          var city = u.city || '—';
          var letter = (name[0] || '?').toUpperCase();
          var created = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—';
          return '<tr>' +
            '<td><div class="uinfo"><div class="uav" style="background:linear-gradient(135deg,#10b981,#3b82f6)">' + letter + '</div>' +
            '<div><div class="uname">' + name + '</div><div class="uhandle">@' + (u.username || '—') + '</div></div></div></td>' +
            '<td>' + email + '</td>' +
            '<td><span class="badge bg-blue">' + type + '</span></td>' +
            '<td>' + city + '</td>' +
            '<td>0</td><td>0</td>' +
            '<td><span class="badge bg-green">Active</span></td>' +
            '</tr>';
        }).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--ts);font-size:0.85rem">' +
          '<i class="fas fa-users" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.3"></i>' +
          'No registered users yet.' +
          '</td></tr>';
      }
    }
  }

  /* ── LOAD REAL STATS FROM FIRESTORE ─────────────────────── */
  function loadRealStats() {
    var fb = window.GeoFirebase;
    if (fb && fb.db && fb.fs) {
      Promise.all([
        fb.fs.getDocs(fb.fs.collection(fb.db, 'users')),
        fb.fs.getDocs(fb.fs.collection(fb.db, 'businesses'))
      ]).then(function(parts) {
        var users = [];
        parts[0].forEach(function(d) { users.push(Object.assign({ id: d.id }, d.data())); });
        renderStats(users, parts[1].size);
      }).catch(function(err) {
        console.warn('[Admin] Firestore query failed:', err.message);
        renderStats([], 0);
      });
    } else {
      window.addEventListener('GeoFirebaseReady', function() { loadRealStats(); }, { once: true });
    }
  }

  /* ── SPARKLINES ──────────────────────────────────────────── */
  function buildSparklines() {
    // Flat sparklines — no fake growth data
    var configs = [
      { id:'sp-users', color:'#10b981' },
      { id:'sp-biz',   color:'#3b82f6' },
      { id:'sp-ev',    color:'#f59e0b' },
      { id:'sp-rev',   color:'#a855f7' }
    ];
    configs.forEach(function (cfg) {
      var wrap = document.getElementById(cfg.id);
      if (!wrap) return;
      wrap.innerHTML = '';
      for (var i = 0; i < 14; i++) {
        var b = document.createElement('div');
        b.className = 'sp';
        b.style.background = cfg.color;
        b.style.height = '3px';
        b.style.opacity = '0.3';
        wrap.appendChild(b);
      }
    });
  }

  /* ── CANVAS CHARTS ───────────────────────────────────────── */
  function drawLine(ctx, data, color, fill, w, h) {
    var max = Math.max.apply(null, data);
    var min = Math.min.apply(null, data);
    var range = max - min || 1;
    var pad = 8;
    var uw = (w - pad * 2) / (data.length - 1);

    function pt(i) {
      return {
        x: pad + i * uw,
        y: h - pad - ((data[i] - min) / range) * (h - pad * 2)
      };
    }

    if (fill) {
      ctx.beginPath();
      ctx.moveTo(pt(0).x, h - pad);
      data.forEach(function (_, i) { var p = pt(i); ctx.lineTo(p.x, p.y); });
      ctx.lineTo(pt(data.length - 1).x, h - pad);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }

    ctx.beginPath();
    data.forEach(function (_, i) {
      var p = pt(i);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function drawOverviewCharts() {
    var growthData  = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1];
    var dauData     = [0,0,0,0,0,0,0,0,0,0,0,0,0,1];

    var gc = document.getElementById('growthChart');
    var dc = document.getElementById('dauChart');
    if (!gc || !dc) return;

    gc.width  = gc.offsetWidth || 400;
    dc.width  = dc.offsetWidth || 400;

    var gctx = gc.getContext('2d');
    var dctx = dc.getContext('2d');

    gctx.clearRect(0, 0, gc.width, gc.height);
    dctx.clearRect(0, 0, dc.width, dc.height);

    drawLine(gctx, growthData, '#10b981', 'rgba(16,185,129,0.08)', gc.width, gc.height);
    drawLine(dctx, dauData,    '#3b82f6', 'rgba(59,130,246,0.08)', dc.width, dc.height);
  }

  function drawRevChart() {
    var canvas = document.getElementById('revChart');
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 380;
    var ctx = canvas.getContext('2d');
    var h = canvas.height;
    var w = canvas.width;
    ctx.clearRect(0, 0, w, h);

    var cats = ['Premium', 'Campaigns', 'Tickets', 'QR', 'Market'];
    var vals = [0, 0, 0, 0, 0];
    var colors = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#f97316'];
    var max = Math.max.apply(null, vals);
    var bw = (w - 40) / cats.length;
    var pad = 10;

    cats.forEach(function (cat, i) {
      var bh = ((vals[i] / max) * (h - 40));
      var x = 20 + i * bw + 4;
      var y = h - 20 - bh;
      ctx.fillStyle = colors[i];
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, bw - 8, bh, [4, 4, 0, 0]) : ctx.rect(x, y, bw - 8, bh);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(148,163,184,0.7)';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cat, x + (bw - 8) / 2, h - 6);
    });
  }

  function drawRevTrendChart() {
    var canvas = document.getElementById('revTrendChart');
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 700;
    var ctx = canvas.getContext('2d');
    var data = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    drawLine(ctx, data, '#a855f7', 'rgba(168,85,247,0.08)', canvas.width, canvas.height);
  }

  /* ── HOUR BARS (City) ─────────────────────────────────────── */
  function buildHourBars() {
    var barsEl = document.getElementById('hourBars');
    var lblsEl = document.getElementById('hourLabels');
    if (!barsEl || !lblsEl) return;
    var vals = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    var max = Math.max.apply(null, vals);
    var now = new Date().getHours();
    barsEl.innerHTML = '';
    lblsEl.innerHTML = '';
    vals.forEach(function (v, h) {
      var b = document.createElement('div');
      b.className = 'hb' + (v === max ? ' peak' : '');
      b.style.height = Math.max(4, Math.round((v / max) * 56)) + 'px';
      b.title = h + ':00 — ' + v + ' active';
      barsEl.appendChild(b);
      var l = document.createElement('div');
      l.className = 'hl';
      l.textContent = (h % 4 === 0) ? h + 'h' : '';
      lblsEl.appendChild(l);
    });
  }

  /* ── USERS TABLE ─────────────────────────────────────────── */
  function renderUsers(list) {
    var tbody = document.getElementById('usersBody');
    if (!tbody) return;
    if (!list) list = USERS;
    tbody.innerHTML = list.map(function (u) {
      var statusBadge = {
        verified:  '<span class="badge bg-green">✓ Verified</span>',
        active:    '<span class="badge bg-blue">Active</span>',
        flagged:   '<span class="badge bg-gold">⚠ Flagged</span>',
        suspended: '<span class="badge bg-red">Suspended</span>'
      }[u.status] || '';

      var trustColor = u.trust >= 80 ? 'var(--green)' : u.trust >= 50 ? 'var(--gold)' : 'var(--red)';
      return '<tr onclick="openUserDetail(' + u.id + ')">' +
        '<td><div class="uinfo"><div class="uav" style="background:' + u.av + '">' + u.init + '</div>' +
        '<div><div class="uname">' + u.name + '</div><div class="uhandle">' + u.handle + '</div></div></div></td>' +
        '<td><span style="font-family:var(--mono);font-weight:700;color:' + trustColor + '">' + u.trust + '</span></td>' +
        '<td>' + statusBadge + '</td>' +
        '<td style="font-family:var(--mono)">' + u.checkins + '</td>' +
        '<td style="font-family:var(--mono)">' + u.reviews + '</td>' +
        '<td style="color:var(--ts);font-size:0.74rem">' + u.joined + '</td>' +
        '<td><div style="display:flex;gap:5px">' +
        '<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openUserDetail(' + u.id + ')"><i class="fas fa-eye"></i></button>' +
        '<button class="btn btn-' + (u.status === 'suspended' ? 'green' : 'red') + ' btn-xs" onclick="event.stopPropagation();toggleSuspend(' + u.id + ')">' + (u.status === 'suspended' ? 'Restore' : 'Suspend') + '</button>' +
        '</div></td></tr>';
    }).join('');
  }

  window.filterUsers = function (q, status, trust) {
    q = (q || '').toLowerCase();
    var list = USERS.filter(function (u) {
      var matchQ = !q || u.name.toLowerCase().indexOf(q) !== -1 || u.handle.toLowerCase().indexOf(q) !== -1;
      var matchS = !status || u.status === status;
      var matchT = !trust ||
        (trust === 'high' && u.trust >= 80) ||
        (trust === 'low'  && u.trust < 40);
      return matchQ && matchS && matchT;
    });
    renderUsers(list);
  };

  window.toggleSuspend = function (id) {
    var u = USERS.find(function (u) { return u.id === id; });
    if (!u) return;
    if (u.status === 'suspended') {
      u.status = 'active';
      toast('User ' + u.handle + ' restored');
    } else {
      u.status = 'suspended';
      toast('User ' + u.handle + ' suspended', 'rgba(239,68,68,0.95)');
    }
    renderUsers();
  };

  /* ── USER DETAIL PANEL ───────────────────────────────────── */
  window.openUserDetail = function (id) {
    var u = USERS.find(function (u) { return u.id === id; });
    if (!u) return;
    selectedUser = u;
    document.getElementById('udpAv').style.background    = u.av;
    document.getElementById('udpAv').textContent          = u.init;
    document.getElementById('udpName').textContent        = u.name;
    document.getElementById('udpHandle').textContent      = u.handle;
    document.getElementById('udpTrustNum').textContent    = u.trust;
    document.getElementById('udpTrustBar').style.width    = u.trust + '%';

    var statusBadge = { verified:'<span class="badge bg-green">✓ Verified</span>', active:'<span class="badge bg-blue">Active</span>', flagged:'<span class="badge bg-gold">Flagged</span>', suspended:'<span class="badge bg-red">Suspended</span>' };
    document.getElementById('udpStatus').innerHTML = statusBadge[u.status] || '';

    document.getElementById('udpStats').innerHTML =
      '<div class="udp-stat"><div class="udp-sv">' + u.checkins + '</div><div class="udp-sl">Check-ins</div></div>' +
      '<div class="udp-stat"><div class="udp-sv">' + u.reviews + '</div><div class="udp-sl">Reviews</div></div>' +
      '<div class="udp-stat"><div class="udp-sv">' + u.trust + '</div><div class="udp-sl">Trust</div></div>';

    document.getElementById('udpActs').innerHTML =
      '<button class="btn btn-green" onclick="verifyUser(' + u.id + ')"><i class="fas fa-check"></i> Mark Verified</button>' +
      '<button class="btn btn-gold" onclick="warnUser(' + u.id + ')"><i class="fas fa-exclamation"></i> Issue Warning</button>' +
      '<button class="btn btn-red" onclick="toggleSuspend(' + u.id + ')"><i class="fas fa-ban"></i> ' + (u.status === 'suspended' ? 'Restore Account' : 'Suspend Account') + '</button>' +
      '<a href="profile.html" class="btn btn-ghost"><i class="fas fa-external-link-alt"></i> Open Profile Page</a>';

    document.getElementById('udpOv').classList.add('open');
  };

  window.closeUserDetail = function () {
    document.getElementById('udpOv').classList.remove('open');
    selectedUser = null;
  };

  window.verifyUser = function (id) {
    var u = USERS.find(function (u) { return u.id === id; });
    if (u) { u.status = 'verified'; u.trust = Math.min(100, u.trust + 5); }
    toast('User verified · Trust +5');
    renderUsers();
    closeUserDetail();
  };

  window.warnUser = function (id) {
    toast('Warning issued to user', 'rgba(245,158,11,0.95)');
  };

  /* ── BUSINESSES ──────────────────────────────────────────── */
  function renderBusinesses() {
    var el = document.getElementById('bizList');
    if (!el) return;
    el.innerHTML = BUSINESSES.map(function (b) {
      var statusBadge = {
        verified: '<span class="badge bg-green">✓ Verified</span>',
        pending:  '<span class="badge bg-gold">⏳ Pending</span>',
        rejected: '<span class="badge bg-red">Rejected</span>'
      }[b.status] || '';

      return '<div class="biz-card">' +
        '<div class="biz-ico" style="background:' + b.iconBg + '">' + b.icon + '</div>' +
        '<div style="flex:1">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px"><div class="biz-name">' + b.name + '</div>' + statusBadge + (b.featured ? '<span class="badge bg-purple">⭐ Featured</span>' : '') + '</div>' +
        '<div class="biz-meta">' + b.cat + ' · ' + b.city + '</div>' +
        '<div class="biz-stats">Reviews <strong>' + b.reviews + '</strong> · Rating <strong>★' + b.rating + '</strong> · Check-ins <strong>' + b.checkins + '</strong> · Campaigns <strong>' + b.campaigns + '</strong></div>' +
        '<div class="biz-acts">' +
        (b.status !== 'verified' ? '<button class="btn btn-green btn-sm" onclick="approveBiz(' + b.id + ')"><i class="fas fa-check"></i> Approve</button>' : '<button class="btn btn-ghost btn-sm" disabled><i class="fas fa-check"></i> Approved</button>') +
        '<button class="btn btn-' + (b.featured ? 'gold' : 'ghost') + ' btn-sm" onclick="toggleFeature(' + b.id + ')">' + (b.featured ? '⭐ Unfeature' : '⭐ Feature') + '</button>' +
        '<a href="business.html" class="btn btn-ghost btn-sm"><i class="fas fa-external-link-alt"></i> View</a>' +
        (b.status !== 'rejected' ? '<button class="btn btn-red btn-sm" onclick="rejectBiz(' + b.id + ')">Reject</button>' : '') +
        '</div></div></div>';
    }).join('');
  }

  window.approveBiz = function (id) {
    var b = BUSINESSES.find(function (b) { return b.id === id; });
    if (b) b.status = 'verified';
    toast('Business approved · Verification badge added');
    renderBusinesses();
  };

  window.rejectBiz = function (id) {
    var b = BUSINESSES.find(function (b) { return b.id === id; });
    if (b) b.status = 'rejected';
    toast('Business rejected', 'rgba(239,68,68,0.95)');
    renderBusinesses();
  };

  window.toggleFeature = function (id) {
    var b = BUSINESSES.find(function (b) { return b.id === id; });
    if (b) b.featured = !b.featured;
    toast(b.featured ? 'Business featured on homepage' : 'Business unfeatured');
    renderBusinesses();
  };

  /* ── CREATORS ─────────────────────────────────────────────── */
  function renderCreators() {
    var el = document.getElementById('creatorGrid');
    if (!el) return;
    el.innerHTML = CREATORS.map(function (c) {
      return '<div class="cr-card">' +
        '<div class="cr-av" style="background:' + c.av + '">' + c.init + '</div>' +
        '<div class="cr-name">' + c.name + '</div>' +
        '<div class="cr-handle">' + c.handle + '</div>' +
        '<div class="cr-stats">' +
        '<div><strong>' + fmtNum(c.followers) + '</strong>Followers</div>' +
        '<div><strong>' + c.posts + '</strong>Posts</div>' +
        '<div><strong>' + c.collabs + '</strong>Collabs</div>' +
        '</div>' +
        '<div style="margin-bottom:10px">' + (c.verified ? '<span class="badge bg-green">✓ Verified</span>' : '<span class="badge bg-gray">Unverified</span>') + '</div>' +
        '<div class="cr-acts">' +
        '<button class="btn btn-green btn-xs" onclick="verifyCreator(' + c.id + ')">' + (c.verified ? 'Re-verify' : 'Verify') + '</button>' +
        '<button class="btn btn-gold btn-xs" onclick="featureCreator(' + c.id + ')">Feature</button>' +
        '<a href="creators.html" class="btn btn-ghost btn-xs">View</a>' +
        '</div></div>';
    }).join('');
  }

  function fmtNum(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n; }

  window.verifyCreator = function (id) {
    var c = CREATORS.find(function (c) { return c.id === id; });
    if (c) c.verified = true;
    toast('Creator verified · Badge added to profile');
    renderCreators();
  };

  window.featureCreator = function (id) {
    var c = CREATORS.find(function (c) { return c.id === id; });
    toast('Creator ' + (c ? c.handle : '') + ' featured on discovery');
  };

  /* ── MODERATION QUEUE ─────────────────────────────────────── */
  var modFilter = 'all';

  function renderModQueue() {
    var el = document.getElementById('modQueue');
    if (!el) return;
    var list = modFilter === 'all' ? modItems : modItems.filter(function (m) { return m.type === modFilter; });
    var countEl = document.getElementById('modSub');
    if (countEl) countEl.textContent = list.length + ' items in queue';
    document.getElementById('sb-mod').textContent = modItems.length;

    el.innerHTML = list.map(function (m) {
      var pBadge = { high:'<span class="badge bg-red">High Priority</span>', medium:'<span class="badge bg-gold">Medium</span>', low:'<span class="badge bg-gray">Low</span>' }[m.priority] || '';
      return '<div class="mod-card" id="mod-' + m.id + '">' +
        '<div class="mod-hdr"><div class="mod-ic" style="background:' + m.bg + '">' + m.icon + '</div>' +
        '<div class="mod-info"><div class="mod-title">' + m.title + '</div><div class="mod-sub">' + m.sub + '</div></div>' +
        pBadge + '</div>' +
        '<div class="mod-body">' + m.body + '</div>' +
        '<div class="mod-acts">' +
        '<button class="btn btn-red btn-sm" onclick="modAction(' + m.id + ',\'remove\')"><i class="fas fa-trash"></i> Remove</button>' +
        '<button class="btn btn-gold btn-sm" onclick="modAction(' + m.id + ',\'warn\')"><i class="fas fa-exclamation"></i> Warn User</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="modAction(' + m.id + ',\'ignore\')"><i class="fas fa-eye-slash"></i> Ignore</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="modAction(' + m.id + ',\'suspend\')"><i class="fas fa-ban"></i> Suspend</button>' +
        '</div></div>';
    }).join('');
  }

  window.filterMod = function (type) { modFilter = type; renderModQueue(); };

  window.modAction = function (id, action) {
    modItems = modItems.filter(function (m) { return m.id !== id; });
    var msgs = { remove:'Content removed from platform', warn:'User warning issued', ignore:'Item dismissed from queue', suspend:'User suspended' };
    var colors = { remove:'rgba(239,68,68,0.95)', warn:'rgba(245,158,11,0.95)', ignore:null, suspend:'rgba(239,68,68,0.95)' };
    toast(msgs[action] || 'Done', colors[action]);
    document.getElementById('sb-mod').textContent = modItems.length;
    renderModQueue();
  };

  /* ── ACTIVITY ────────────────────────────────────────────── */
  var _activityFilter = 'all';
  var _deleteTarget = null;

  window._activityFilter = _activityFilter; // expose for inline onclick refresh button

  function timeAgoAdmin(ts) {
    if (!ts) return '';
    var ms = ts.toMillis ? ts.toMillis() : (ts.seconds ? ts.seconds * 1000 : Number(ts));
    var d = Math.floor((Date.now() - ms) / 1000);
    if (d < 60) return d + 's ago';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    return Math.floor(d / 86400) + 'd ago';
  }

  function escHtmlAdmin(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function escAttr(s) {
    return String(s || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  }

  window.loadActivity = function (filter) {
    _activityFilter = filter || 'all';
    window._activityFilter = _activityFilter;

    ['all','posts','stories','checkins'].forEach(function (t) {
      var el = document.getElementById('act-tab-' + t);
      if (el) el.className = 'btn btn-' + (t === _activityFilter ? 'primary' : 'ghost') + ' btn-sm';
    });

    var listEl = document.getElementById('activityList');
    var subEl  = document.getElementById('activitySub');
    if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--ts)"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';

    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) {
      window.addEventListener('GeoFirebaseReady', function () { window.loadActivity(filter); }, { once: true });
      return;
    }

    var db = fb.db, fs = fb.fs;
    var cols = _activityFilter === 'all'     ? ['posts','stories','checkins'] :
               _activityFilter === 'posts'   ? ['posts']   :
               _activityFilter === 'stories' ? ['stories'] :
               _activityFilter === 'checkins'? ['checkins']: ['posts'];

    var allItems = [];
    var pending  = cols.length;

    cols.forEach(function (col) {
      fs.getDocs(fs.query(fs.collection(db, col), fs.orderBy('createdAt', 'desc'), fs.limit(50)))
        .then(function (snap) {
          snap.forEach(function (d) {
            allItems.push(Object.assign({ _id: d.id, _col: col }, d.data()));
          });
          pending--;
          if (pending === 0) renderActivityItems(allItems);
        })
        .catch(function () {
          pending--;
          if (pending === 0) renderActivityItems(allItems);
        });
    });
  };

  function renderActivityItems(items) {
    items.sort(function (a, b) {
      var ta = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt.seconds || 0) * 1000) : 0;
      var tb = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt.seconds || 0) * 1000) : 0;
      return tb - ta;
    });

    var listEl = document.getElementById('activityList');
    var subEl  = document.getElementById('activitySub');
    var sbEl   = document.getElementById('sb-activity');

    if (subEl) subEl.textContent = items.length + ' item' + (items.length !== 1 ? 's' : '');
    if (sbEl)  sbEl.textContent  = items.length;

    if (!items.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:48px;color:var(--ts);font-size:0.85rem"><i class="fas fa-stream" style="font-size:1.8rem;display:block;margin-bottom:12px;opacity:0.2"></i>No content found</div>';
      return;
    }

    listEl.innerHTML = items.map(function (item) {
      var typeLabel = item._col === 'posts' ? 'Post' : item._col === 'stories' ? 'Story' : 'Check-in';
      var typeColor = item._col === 'posts' ? 'bg-blue' : item._col === 'stories' ? 'bg-purple' : 'bg-green';
      var typeIcon  = item._col === 'posts' ? '📝' : item._col === 'stories' ? '📖' : '📍';

      var initLetter = (item.authorName || '?').charAt(0).toUpperCase();
      var preview = item._col === 'checkins'
        ? 'Checked in at ' + (item.placeName || '—')
        : (item.text || (item.mediaUrl ? '[media attachment]' : '—'));
      if (preview.length > 140) preview = preview.substring(0, 140) + '…';

      var avatarHtml = item.authorAvatar
        ? '<img src="' + escHtmlAdmin(item.authorAvatar) + '" style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.outerHTML=\'<div class=uav style=width:38px;height:38px;font-size:.9rem;background:linear-gradient(135deg,#10b981,#3b82f6);flex-shrink:0>' + initLetter + '</div>\'">'
        : '<div class="uav" style="width:38px;height:38px;font-size:0.9rem;background:linear-gradient(135deg,#10b981,#3b82f6);flex-shrink:0">' + initLetter + '</div>';

      var mediaHtml = (item.mediaUrl && item._col !== 'checkins')
        ? '<img src="' + escHtmlAdmin(item.mediaUrl) + '" style="max-height:130px;border-radius:8px;margin-top:8px;object-fit:cover;max-width:100%">'
        : '';

      var authorId   = escAttr(item.authorId   || '');
      var authorName = escAttr(item.authorName  || 'Unknown');
      var docId      = escAttr(item._id);
      var col        = escAttr(item._col);

      return '<div class="panel" style="padding:14px 16px" id="ai-' + item._id + '">' +
        '<div style="display:flex;align-items:flex-start;gap:12px">' +
          avatarHtml +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">' +
              '<span style="font-weight:800;font-size:0.88rem">' + escHtmlAdmin(item.authorName || 'Unknown') + '</span>' +
              '<span class="badge ' + typeColor + '">' + typeIcon + ' ' + typeLabel + '</span>' +
              '<span style="font-size:0.7rem;color:var(--ts);margin-left:auto">' + timeAgoAdmin(item.createdAt) + '</span>' +
            '</div>' +
            '<div style="font-size:0.83rem;color:var(--ts);line-height:1.5;word-break:break-word">' + escHtmlAdmin(preview) + '</div>' +
            mediaHtml +
            '<div style="display:flex;align-items:center;gap:16px;margin-top:10px">' +
              '<span style="font-size:0.74rem;color:var(--ts)"><i class="fas fa-heart" style="color:#ef4444;margin-right:3px"></i>' + (item.likeCount || 0) + ' likes</span>' +
              '<span style="font-size:0.74rem;color:var(--ts)"><i class="fas fa-comment" style="color:#3b82f6;margin-right:3px"></i>' + (item.commentCount || 0) + ' comments</span>' +
              (item._col === 'checkins' ? '<span style="font-size:0.74rem;color:var(--green)"><i class="fas fa-bolt" style="margin-right:3px"></i>+' + (item.xpAwarded || 50) + ' XP</span>' : '') +
              '<div style="margin-left:auto">' +
                '<button class="btn btn-red btn-xs" onclick="openDeleteModal(\'' + col + '\',\'' + docId + '\',\'' + authorId + '\',\'' + typeLabel + '\',\'' + escAttr(item.authorName || 'User') + '\')">' +
                  '<i class="fas fa-trash"></i> Delete' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.openDeleteModal = function (col, docId, authorId, contentType, authorName) {
    _deleteTarget = { col: col, docId: docId, authorId: authorId, contentType: contentType, authorName: authorName };
    var descEl = document.getElementById('deleteModalDesc');
    if (descEl) descEl.textContent = 'Remove ' + (authorName || 'user') + '\'s ' + (contentType || 'content').toLowerCase() + ' from GeoHub';
    var msgEl = document.getElementById('deleteModalMsg');
    if (msgEl) msgEl.value = 'Your ' + (contentType || 'content').toLowerCase() + ' was removed by an administrator for violating GeoHub community guidelines.';
    var modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'flex';
    setTimeout(function () { if (msgEl) msgEl.focus(); }, 60);
  };

  window.closeDeleteModal = function () {
    var modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'none';
    _deleteTarget = null;
    var btn = document.getElementById('deleteConfirmBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> Delete &amp; Notify User'; }
  };

  window.executeDelete = function () {
    if (!_deleteTarget) return;
    var target = _deleteTarget;
    var msgEl = document.getElementById('deleteModalMsg');
    var msg = msgEl ? msgEl.value.trim() : '';

    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) { toast('Firebase not ready', 'rgba(239,68,68,0.95)'); return; }

    var db = fb.db, fs = fb.fs;
    var btn = document.getElementById('deleteConfirmBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting…'; }

    fs.deleteDoc(fs.doc(db, target.col, target.docId))
      .then(function () {
        if (target.authorId) {
          return fs.addDoc(fs.collection(db, 'userNotifications'), {
            toUserId:    target.authorId,
            type:        'content_removed',
            contentType: (target.contentType || 'content').toLowerCase(),
            message:     msg || ('Your ' + (target.contentType || 'content').toLowerCase() + ' was removed by an administrator.'),
            read:        false,
            createdAt:   fs.serverTimestamp()
          });
        }
      })
      .then(function () {
        toast('Deleted · User notified');
        closeDeleteModal();
        var el = document.getElementById('ai-' + target.docId);
        if (el) {
          el.style.opacity = '0';
          el.style.transition = 'opacity 0.3s';
          setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
        }
        var sbEl = document.getElementById('sb-activity');
        if (sbEl) sbEl.textContent = Math.max(0, parseInt(sbEl.textContent, 10) - 1);
      })
      .catch(function (err) {
        console.error('[Admin] executeDelete', err);
        toast('Delete failed: ' + err.message, 'rgba(239,68,68,0.95)');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> Delete &amp; Notify User'; }
      });
  };

  /* ── LIVE FEED ────────────────────────────────────────────── */
  function startLiveFeed() {
    if (liveTimer) return;
    injectLiveItem();
    liveTimer = setInterval(function () {
      if (!liveRunning) return;
      injectLiveItem();
      liveActiveCount = Math.max(30, liveActiveCount + Math.round((Math.random() - 0.45) * 4));
      var n = document.getElementById('liveActiveNow');
      var lbl = document.getElementById('liveCountLabel');
      if (n) n.textContent = liveActiveCount;
      if (lbl) lbl.textContent = liveActiveCount;
      var sb = document.getElementById('sb-live');
      if (sb) sb.textContent = liveActiveCount;
    }, 3000);
  }

  function injectLiveItem() {
    var list = document.getElementById('liveFeedList');
    if (!list) return;
    var ev = LIVE_EVENTS[liveFeedCount % LIVE_EVENTS.length];
    liveFeedCount++;

    var now = new Date();
    var timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');

    var el = document.createElement('div');
    el.className = 'live-item';
    el.innerHTML = '<div class="live-ic" style="background:' + ev.bg + '">' + ev.icon + '</div>' +
      '<div class="live-body"><div class="live-text">' + ev.text + '</div><div class="live-time">' + timeStr + '</div></div>';

    list.insertBefore(el, list.firstChild);
    if (list.children.length > 20) list.removeChild(list.lastChild);

    var cntEl = document.getElementById('liveFeedCnt');
    if (cntEl) cntEl.textContent = liveFeedCount + ' events';
  }

  window.toggleLive = function () {
    liveRunning = !liveRunning;
    var btn = document.getElementById('livePauseBtn');
    if (btn) btn.innerHTML = liveRunning ? '<i class="fas fa-pause"></i> Pause' : '<i class="fas fa-play"></i> Resume';
    toast(liveRunning ? 'Live feed resumed' : 'Live feed paused');
  };

  /* ── PLATFORM TOGGLES ─────────────────────────────────────── */
  window.handleToggle = function (feature, enabled) {
    if (feature === 'maintenance' && enabled) {
      toast('⚠ Maintenance mode ON — platform showing offline page', 'rgba(239,68,68,0.95)');
    } else {
      var labels = { live:'Live City Mode', rewards:'Rewards System', events:'Events & Ticketing', creators:'Creator Marketplace', patriot:'Patriot Missions', ai:'AI Assistant', camera:'Camera Proof', demo:'Demo Mode' };
      toast((labels[feature] || feature) + (enabled ? ' enabled' : ' disabled'));
    }
    try {
      window.__geoAdminFlags = window.__geoAdminFlags || {};
      window.__geoAdminFlags[feature] = enabled;
      if (window.GeoFirebase && window.GeoFirebase.db && window.GeoFirebase.fs) {
        window.GeoFirebase.fs.setDoc(window.GeoFirebase.fs.doc(window.GeoFirebase.db, 'adminFlags', feature), { feature: feature, enabled: enabled, updatedAt: Date.now() }, { merge:true }).catch(function(){});
      }
    } catch (_) {}
  };

  /* ── NOTIFICATIONS ────────────────────────────────────────── */
  window.markAllRead = function () {
    document.querySelectorAll('.ni.unread').forEach(function (n) { n.classList.remove('unread'); });
    notifCount = 0;
    var b = document.getElementById('notifBadge');
    if (b) b.style.display = 'none';
    var sb = document.getElementById('sb-notif');
    if (sb) sb.textContent = '0';
    var sub = document.getElementById('notifSub');
    if (sub) sub.textContent = 'All caught up';
    toast('All notifications marked as read');
  };


  /* ── CONTENT STUDIO ─────────────────────────────────────── */

  var CONTENT_EXT_FIELDS = {
    events: [
      { id: 'csDate',     label: 'Date & Time',    type: 'datetime-local', key: 'date' },
      { id: 'csPrice',    label: 'Ticket Price (₾, 0 = free)', type: 'number', key: 'ticketPrice', min: 0 },
      { id: 'csCapacity', label: 'Capacity (0 = unlimited)', type: 'number', key: 'capacity', min: 0 },
      { id: 'csVenue',    label: 'Venue / address', type: 'text', key: 'venue' }
    ],
    places: [
      { id: 'csAddress',  label: 'Address',  type: 'text',   key: 'address' },
      { id: 'csLat',      label: 'Latitude', type: 'number', key: 'lat',  step: 'any' },
      { id: 'csLng',      label: 'Longitude',type: 'number', key: 'lng',  step: 'any' }
    ],
    businesses: [
      { id: 'csPhone',    label: 'Phone',    type: 'tel',  key: 'phone' },
      { id: 'csAddress',  label: 'Address',  type: 'text', key: 'address' },
      { id: 'csWebsite',  label: 'Website',  type: 'url',  key: 'website' },
      { id: 'csInstagram',label: 'Instagram (@handle)', type: 'text', key: 'instagram' }
    ],
    groups: [
      { id: 'csJoinType', label: 'Join type (open/invite)', type: 'text', key: 'joinType', placeholder: 'open' },
      { id: 'csMaxMembers',label: 'Max members (0 = unlimited)', type: 'number', key: 'maxMembers', min: 0 }
    ],
    rewards: [
      { id: 'csXpCost',   label: 'XP cost', type: 'number', key: 'xpCost', min: 0 },
      { id: 'csExpiry',   label: 'Expiry date', type: 'date', key: 'expiresAt' }
    ]
  };

  function renderExtFields(col) {
    var container = document.getElementById('adminExtFields');
    if (!container) return;
    var fields = CONTENT_EXT_FIELDS[col] || [];
    container.innerHTML = fields.map(function(f) {
      return '<input id="' + f.id + '" type="' + f.type + '" placeholder="' + (f.label || f.key) + '" '
        + (f.min !== undefined ? 'min="' + f.min + '" ' : '')
        + (f.step ? 'step="' + f.step + '" ' : '')
        + (f.placeholder ? 'data-ph="' + f.placeholder + '" ' : '')
        + 'style="padding:12px;border-radius:10px;background:#111827;color:#f8fafc;border:1px solid rgba(255,255,255,.12)">';
    }).join('');
  }

  function bindContentStudio() {
    var form = document.getElementById('adminContentForm');
    if (!form || form._wired) return;
    form._wired = true;

    var colSel = document.getElementById('adminContentCollection');
    if (colSel) {
      colSel.addEventListener('change', function() { renderExtFields(colSel.value); });
      renderExtFields(colSel.value);
    }

    // Live JSON validation for bulk import textarea
    var bulkJson = document.getElementById('adminBulkJson');
    var bulkVal  = document.getElementById('adminBulkValidation');
    if (bulkJson && bulkVal) {
      bulkJson.addEventListener('input', function() {
        var v = bulkJson.value.trim();
        if (!v) { bulkVal.style.color = '#94a3b8'; bulkVal.textContent = ''; return; }
        try {
          var arr = JSON.parse(v);
          if (!Array.isArray(arr)) throw new Error('Must be an array');
          var missing = arr.filter(function(it) { return !it || (!it.name && !it.title); }).length;
          bulkVal.style.color = missing ? '#f59e0b' : '#10e0a0';
          bulkVal.textContent = arr.length + ' items' + (missing ? ' · ' + missing + ' missing name/title' : ' · valid');
        } catch(e) {
          bulkVal.style.color = '#ef4444';
          bulkVal.textContent = 'JSON error: ' + e.message;
        }
      });
    }

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      if (!window.GeoFirebase || !window.GeoFirebase.fs) return toast('Firebase not ready');
      var gf = window.GeoFirebase, fs = gf.fs, db = gf.db;
      var user = gf.auth && gf.auth.currentUser;
      if (!user) return toast('Admin login required');
      var col = document.getElementById('adminContentCollection').value;
      var title = document.getElementById('adminContentTitle').value.trim();
      var desc = document.getElementById('adminContentDesc').value.trim();
      var city = document.getElementById('adminContentCity').value.trim();
      var category = document.getElementById('adminContentCategory').value.trim();
      var image = document.getElementById('adminContentImage').value.trim();
      if (!title) return toast('Title is required');

      var doc = {
        name: title, title: title, description: desc, city: city,
        location: city, category: category,
        image: image || null, imageUrl: image || null,
        status: 'active', createdBy: user.uid, ownerId: user.uid, userId: user.uid,
        createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp()
      };

      // Collect extended fields for this collection type
      (CONTENT_EXT_FIELDS[col] || []).forEach(function(f) {
        var el = document.getElementById(f.id);
        if (!el) return;
        var v = el.value.trim();
        if (!v) return;
        if (f.type === 'number') {
          doc[f.key] = Number(v);
        } else if (f.type === 'datetime-local' || f.type === 'date') {
          doc[f.key] = new Date(v).getTime();
        } else {
          doc[f.key] = v;
        }
      });

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
      fs.addDoc(fs.collection(db, col), doc).then(function(ref) {
        form.reset();
        renderExtFields(col);
        toast('Created: ' + title + ' (ID: ' + ref.id.slice(-6) + ')');
        // Show live preview
        var preview = document.getElementById('adminContentPreview');
        var previewBody = document.getElementById('adminContentPreviewBody');
        if (preview && previewBody) {
          var lines = ['<strong>' + esc(title) + '</strong> → <code style="font-size:.78rem">' + col + '/' + ref.id + '</code>'];
          if (desc) lines.push(esc(desc.slice(0, 120)) + (desc.length > 120 ? '…' : ''));
          if (city) lines.push('City: ' + esc(city));
          if (category) lines.push('Category: ' + esc(category));
          previewBody.innerHTML = lines.join('<br>');
          preview.style.display = 'block';
          setTimeout(function() { if (preview) preview.style.display = 'none'; }, 8000);
        }
      }).catch(function(err) {
        console.error('[Admin Content Studio]', err); toast('Create failed: ' + err.message);
      }).finally(function() {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Create real item';
      });
    });
  }

  /* ── JSON BULK IMPORT ─────────────────────────────────────── */
  window.adminBulkImport = function() {
    var jsonEl = document.getElementById('adminBulkJson');
    var colEl  = document.getElementById('adminBulkCollection');
    var valEl  = document.getElementById('adminBulkValidation');
    var resEl  = document.getElementById('adminBulkResult');
    if (!jsonEl || !colEl) return;

    var raw = jsonEl.value.trim();
    if (!raw) { if (valEl) valEl.textContent = 'Paste a JSON array first.'; return; }

    var items;
    try { items = JSON.parse(raw); } catch(e) { if (valEl) valEl.style.color = '#ef4444'; valEl.textContent = 'Invalid JSON: ' + e.message; return; }
    if (!Array.isArray(items)) { if (valEl) { valEl.style.color = '#ef4444'; valEl.textContent = 'Must be a JSON array [ {...}, ... ]'; } return; }
    if (items.length === 0) { if (valEl) valEl.textContent = 'Array is empty.'; return; }
    if (items.length > 200) { if (valEl) { valEl.style.color = '#ef4444'; valEl.textContent = 'Max 200 items per import.'; } return; }

    // Validate required field
    var missing = items.filter(function(it) { return !it || typeof it !== 'object' || (!it.name && !it.title); });
    if (missing.length) { if (valEl) { valEl.style.color = '#ef4444'; valEl.textContent = missing.length + ' item(s) are missing a name/title field.'; } return; }

    if (!window.GeoFirebase || !window.GeoFirebase.fs) return toast('Firebase not ready');
    var gf = window.GeoFirebase, fs = gf.fs, db = gf.db;
    var user = gf.auth && gf.auth.currentUser;
    if (!user) return toast('Admin login required');

    var col = colEl.value;
    if (valEl) { valEl.style.color = '#94a3b8'; valEl.textContent = 'Importing ' + items.length + ' items…'; }
    if (resEl) resEl.style.display = 'none';

    var promises = items.map(function(it) {
      var imgNorm = it.imageUrl||it.image||it.coverImage||it.coverImageUrl||it.coverUrl||it.photoUrl||it.thumbnail||null;
      var doc = Object.assign({}, it, {
        name: it.name || it.title,
        title: it.title || it.name,
        imageUrl: imgNorm,
        image: imgNorm,
        status: it.status || 'active',
        createdBy: user.uid, ownerId: user.uid, userId: user.uid,
        createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp()
      });
      return fs.addDoc(fs.collection(db, col), doc);
    });

    Promise.allSettled(promises).then(function(results) {
      var ok  = results.filter(function(r) { return r.status === 'fulfilled'; }).length;
      var err = results.filter(function(r) { return r.status === 'rejected'; }).length;
      jsonEl.value = '';
      if (valEl) { valEl.style.color = '#10e0a0'; valEl.textContent = 'Done.'; }
      if (resEl) {
        resEl.style.display = 'block';
        resEl.innerHTML = '<i class="fas fa-check-circle"></i> Imported <strong>' + ok + '</strong> items into <strong>' + col + '</strong>'
          + (err ? ' · <span style="color:#ef4444">' + err + ' failed</span>' : '');
      }
      toast('Imported ' + ok + ' items' + (err ? ', ' + err + ' failed' : ''));
    });
  };

  /* ── GLOBAL SEARCH ────────────────────────────────────────── */
  window.handleGlobalSearch = function (q) {
    if (!q.trim()) return;
    var results = USERS.filter(function (u) { return u.name.toLowerCase().indexOf(q.toLowerCase()) !== -1; });
    if (results.length) {
      adminNav('users');
      setTimeout(function () {
        var inp = document.getElementById('userSearch');
        if (inp) { inp.value = q; filterUsers(q); }
      }, 100);
    }
  };

  /* ── ANIMATE BARS (refresh simulation) ──────────────────── */
  window.animateBars = function () {
    document.querySelectorAll('.bf').forEach(function (b) {
      var w = b.style.width;
      b.style.width = '0';
      setTimeout(function () { b.style.width = w; }, 50);
    });
    drawOverviewCharts();
    toast('Dashboard refreshed');
  };

  /* ── INIT ────────────────────────────────────────────────── */
  function init() {
    loadRealStats();
    buildSparklines();
    buildHourBars();
    renderUsers();
    renderBusinesses();
    renderCreators();
    renderModQueue();
    setTimeout(drawOverviewCharts, 120);
    bindContentStudio();

    window.addEventListener('resize', function () {
      if (currentSection === 'overview') drawOverviewCharts();
      if (currentSection === 'revenue') { drawRevChart(); drawRevTrendChart(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
