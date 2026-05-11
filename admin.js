(function () {
  'use strict';

  /* ── AUTH GUARD ────────────────────────────────────────────── */
  (function adminGuard() {
    var ADMIN_EMAILS = ['gio.papinashvili26@gmail.com'];
    try {
      var stored = localStorage.getItem('geohub_auth_user');
      var u = stored ? JSON.parse(stored) : null;
      if (!u || !u.isFirebaseUser) { window.location.href = 'auth.html'; return; }
      if (!ADMIN_EMAILS.includes((u.email || '').toLowerCase())) { window.location.href = 'index.html'; return; }
    } catch (e) {
      window.location.href = 'auth.html';
    }
  })();

  /* ── MOCK DATA ─────────────────────────────────────────────── */

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

    if (section === 'live')    startLiveFeed();
    if (section === 'revenue') { setTimeout(drawRevChart, 80); setTimeout(drawRevTrendChart, 80); }
    if (section === 'overview') { setTimeout(drawOverviewCharts, 80); }
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

  /* ── REAL STATS FROM LOCALSTORAGE ───────────────────────── */
  function loadRealStats() {
    // Count businesses registered via the dashboard form
    var bizCount = 0;
    try {
      Object.keys(localStorage).forEach(function(k) {
        if (k.startsWith('geohub_business_')) bizCount++;
      });
    } catch(_) {}

    // Update overview KPI cards
    var el;
    el = document.getElementById('stat-biz');   if (el) el.textContent = bizCount;
    el = document.getElementById('stat-events'); if (el) el.textContent = '0';
    el = document.getElementById('stat-rev');    if (el) el.textContent = '₾0';
    el = document.getElementById('stat-checkins'); if (el) el.textContent = '0';
    el = document.getElementById('stat-reviews');  if (el) el.textContent = '0';
    el = document.getElementById('stat-rewards');  if (el) el.textContent = '0';
    el = document.getElementById('stat-missions'); if (el) el.textContent = '0';
    el = document.getElementById('stat-reports');  if (el) el.textContent = '0';
    el = document.getElementById('stat-trust');    if (el) el.textContent = '—';

    // Sidebar badges
    el = document.getElementById('sb-biz-side'); if (el) el.textContent = bizCount;
    el = document.getElementById('sb-creators');  if (el) el.textContent = '0';
    el = document.getElementById('sb-notif');     if (el) el.textContent = '0';
    el = document.getElementById('sb-live');      if (el) el.textContent = '0';
    el = document.getElementById('sb-users');     if (el) el.textContent = '—';

    // Subtitles
    el = document.getElementById('bizSubtitle');
    if (el) el.textContent = bizCount + ' registered · Verify, feature, approve';
    el = document.getElementById('usersSubtitle');
    if (el) el.textContent = 'Firebase-authenticated accounts';

    // Users table: show empty state
    var tbody = document.getElementById('usersBody');
    if (tbody && !USERS.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--ts);font-size:0.85rem">' +
        '<i class="fas fa-users" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.3"></i>' +
        'User list requires Firebase Admin SDK — not available in static mode.<br>' +
        '<span style="font-size:0.75rem;opacity:0.6;margin-top:4px;display:block">Connect a backend to list all registered users.</span>' +
        '</td></tr>';
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
      var flags = JSON.parse(localStorage.getItem('geohub_flags') || '{}');
      flags[feature] = enabled;
      localStorage.setItem('geohub_flags', JSON.stringify(flags));
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
