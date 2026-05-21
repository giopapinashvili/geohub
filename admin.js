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
  var modItems       = []; // legacy — real data loaded from Firestore via loadModeration()
  var notifCount     = 0;
  var _chalUnsubscribe = function () {};
  var _chalEditId    = null;
  var BADGE_RARITY_COLORS = { common: '#94a3b8', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' };
  var _firestorePlaceCats = null;
  var _pcatEditId = null;

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
    if (section === 'challenges') { loadChallenges(); }
    if (section === 'rewards')    { loadAdminRewards(); }
    if (section === 'analytics')  { loadAdminAnalytics(); }
    if (section === 'errors')     { loadAdminErrors(); }
    if (section === 'businesses') { loadAdminBusinesses(); }
    if (section === 'placecat')   { loadPlaceCategorySection(); }
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

  /* ── BUSINESSES (Firestore) ──────────────────────────────────── */
  function loadAdminBusinesses() {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db) return;
    var el = document.getElementById('bizList');
    if (el) el.innerHTML = '<div style="color:#94a3b8;font-size:.85rem;padding:20px"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';

    fb.fs.getDocs(fb.fs.query(fb.fs.collection(fb.db, 'businesses'), fb.fs.orderBy('createdAt', 'desc'), fb.fs.limit(100)))
      .then(function (snap) {
        if (!snap.size) {
          if (el) el.innerHTML = '<div style="color:#64748b;font-size:.85rem;text-align:center;padding:40px">No businesses yet.</div>';
          return;
        }
        var html = '';
        snap.forEach(function (d) {
          var b = Object.assign({ id: d.id }, d.data());
          var statusBadge = {
            verified: '<span class="badge bg-green"><i class="fas fa-check"></i> Verified</span>',
            active:   '<span class="badge bg-blue">Active</span>',
            pending:  '<span class="badge bg-gold">Pending</span>',
            rejected: '<span class="badge bg-red">Rejected</span>',
            inactive: '<span class="badge" style="background:rgba(100,116,139,.2);color:#94a3b8">Inactive</span>',
          }[b.status || 'active'] || '<span class="badge bg-blue">Active</span>';

          var loc = b.isOnline ? '<i class="fas fa-globe"></i> Online' : ('<i class="fas fa-location-dot"></i> ' + (b.city || 'Unknown'));
          var views = b.viewCount || 0;
          var saves = b.saveCount || 0;
          var quotes = b.quoteCount || 0;

          html += '<div class="biz-card">' +
            '<div class="biz-ico" style="background:rgba(16,185,129,.12);color:#10b981;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">' +
              '<i class="fas fa-store"></i>' +
            '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">' +
                '<div class="biz-name">' + esc(b.title || 'Unnamed') + '</div>' +
                statusBadge +
                (b.featured ? '<span class="badge bg-purple"><i class="fas fa-star"></i> Featured</span>' : '') +
              '</div>' +
              '<div class="biz-meta" style="font-size:.75rem;color:#64748b;margin-bottom:4px">' + esc(b.category || '—') + ' · ' + loc + '</div>' +
              '<div class="biz-stats" style="font-size:.72rem;color:#94a3b8">' +
                'Views <strong>' + views + '</strong> · ' +
                'Saves <strong>' + saves + '</strong> · ' +
                'Quotes <strong>' + quotes + '</strong> · ' +
                'Reviews <strong>' + (b.reviewCount || 0) + '</strong>' +
              '</div>' +
              '<div class="biz-acts" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' +
                (b.status !== 'verified'
                  ? '<button class="btn btn-green btn-sm" onclick="adminVerifyBiz(\'' + d.id + '\')"><i class="fas fa-check"></i> Verify</button>'
                  : '<button class="btn btn-ghost btn-sm" disabled><i class="fas fa-check-circle"></i> Verified</button>') +
                (b.status !== 'inactive'
                  ? '<button class="btn btn-gold btn-sm" onclick="adminDeactivateBiz(\'' + d.id + '\')"><i class="fas fa-ban"></i> Deactivate</button>'
                  : '<button class="btn btn-ghost btn-sm" onclick="adminActivateBiz(\'' + d.id + '\')"><i class="fas fa-check"></i> Reactivate</button>') +
                '<button class="btn btn-' + (b.featured ? 'gold' : 'ghost') + ' btn-sm" onclick="adminToggleFeature(\'' + d.id + '\', ' + (!b.featured) + ')">' +
                  (b.featured ? '<i class="fas fa-star"></i> Unfeature' : '<i class="far fa-star"></i> Feature') + '</button>' +
                '<a href="business.html?id=' + d.id + '" target="_blank" class="btn btn-ghost btn-sm"><i class="fas fa-external-link-alt"></i> View</a>' +
                '<button class="btn btn-ghost btn-sm" onclick="adminViewQuotes(\'' + d.id + '\', this)"><i class="fas fa-inbox"></i> Quotes</button>' +
              '</div>' +
              '<div id="admin-quotes-' + d.id + '" style="display:none;margin-top:8px;font-size:.8rem;color:#94a3b8"></div>' +
            '</div>' +
          '</div>';
        });
        if (el) el.innerHTML = html;
      }).catch(function (err) {
        console.error('[Admin] loadAdminBusinesses failed', err);
        if (el) el.innerHTML = '<div style="color:#ef4444;font-size:.85rem;padding:20px">Could not load businesses.</div>';
      });
  }

  function esc(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  window.adminVerifyBiz = function (id) {
    var fb = window.GeoFirebase;
    if (!fb) return;
    fb.fs.updateDoc(fb.fs.doc(fb.db, 'businesses', id), { status: 'verified', verified: true, verifiedAt: fb.fs.serverTimestamp() })
      .then(function () { toast('Business verified ✓'); loadAdminBusinesses(); })
      .catch(function (e) { toast('Error: ' + e.message, 'rgba(239,68,68,.95)'); });
  };

  window.adminDeactivateBiz = function (id) {
    var fb = window.GeoFirebase;
    if (!fb) return;
    fb.fs.updateDoc(fb.fs.doc(fb.db, 'businesses', id), { status: 'inactive', updatedAt: fb.fs.serverTimestamp() })
      .then(function () { toast('Business deactivated', 'rgba(245,158,11,.95)'); loadAdminBusinesses(); })
      .catch(function (e) { toast('Error: ' + e.message, 'rgba(239,68,68,.95)'); });
  };

  window.adminActivateBiz = function (id) {
    var fb = window.GeoFirebase;
    if (!fb) return;
    fb.fs.updateDoc(fb.fs.doc(fb.db, 'businesses', id), { status: 'active', updatedAt: fb.fs.serverTimestamp() })
      .then(function () { toast('Business reactivated'); loadAdminBusinesses(); })
      .catch(function (e) { toast('Error: ' + e.message, 'rgba(239,68,68,.95)'); });
  };

  window.adminToggleFeature = function (id, featureState) {
    var fb = window.GeoFirebase;
    if (!fb) return;
    fb.fs.updateDoc(fb.fs.doc(fb.db, 'businesses', id), { featured: featureState, updatedAt: fb.fs.serverTimestamp() })
      .then(function () { toast(featureState ? 'Business featured' : 'Business unfeatured'); loadAdminBusinesses(); })
      .catch(function (e) { toast('Error: ' + e.message, 'rgba(239,68,68,.95)'); });
  };

  window.adminViewQuotes = function (bizId, btn) {
    var panel = document.getElementById('admin-quotes-' + bizId);
    if (!panel) return;
    if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    panel.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading quotes…';
    var fb = window.GeoFirebase;
    if (!fb) return;
    fb.fs.getDocs(fb.fs.query(
      fb.fs.collection(fb.db, 'businesses', bizId, 'quoteRequests'),
      fb.fs.orderBy('createdAt', 'desc'),
      fb.fs.limit(10)
    )).then(function (snap) {
      if (!snap.size) { panel.innerHTML = 'No quote requests.'; return; }
      var html = '';
      snap.forEach(function (d) {
        var q = d.data();
        var ts = q.createdAt ? (q.createdAt.toDate ? q.createdAt.toDate().toLocaleDateString() : '') : '';
        html += '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px 10px;margin-bottom:6px">' +
          '<strong style="color:#f1f5f9">' + esc(q.name || 'Anonymous') + '</strong>' +
          (q.status === 'new' ? ' <span style="background:rgba(16,185,129,.15);color:#34d399;border-radius:4px;font-size:.65rem;padding:1px 6px;font-weight:700">NEW</span>' : '') +
          ' <span style="color:#64748b;font-size:.72rem">' + ts + '</span><br>' +
          '<span style="color:#94a3b8">' + esc(q.email || '') + (q.phone ? ' · ' + esc(q.phone) : '') + '</span><br>' +
          '<span style="color:#94a3b8">' + esc((q.message || '').slice(0, 120)) + '</span>' +
          '</div>';
      });
      panel.innerHTML = html;
    }).catch(function () { panel.innerHTML = 'Could not load quotes.'; });
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

  /* ── MODERATION QUEUE (Firestore) ─────────────────────────── */
  var modStatusFilter = 'pending';
  var modTypeFilter   = 'all';
  var modReportUnsub  = null;
  var modReports      = [];

  function modTimeAgo(ts) {
    if (!ts) return '';
    var ms = ts.toMillis ? ts.toMillis() : (ts.seconds ? ts.seconds * 1000 : Number(ts));
    var d = Math.floor((Date.now() - ms) / 1000);
    if (d < 60) return d + 's ago';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    return Math.floor(d / 86400) + 'd ago';
  }

  function loadModeration() {
    var el = document.getElementById('modQueue');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--ts)"><i class="fas fa-spinner fa-spin"></i> Loading reports…</div>';
    var geo = window.GeoFirebase;
    if (!geo || !geo.fs || !geo.db) {
      el.innerHTML = '<div class="mod-empty"><i class="fas fa-exclamation-circle"></i><p>Firebase not ready</p></div>';
      return;
    }
    var f = geo.fs, db = geo.db;
    if (modReportUnsub) { try { modReportUnsub(); } catch (e) {} modReportUnsub = null; }
    var conditions = [f.orderBy('createdAt', 'desc'), f.limit(100)];
    if (modStatusFilter !== 'all') conditions.unshift(f.where('status', '==', modStatusFilter));
    if (modTypeFilter   !== 'all') conditions.unshift(f.where('targetType', '==', modTypeFilter));
    var q = f.query.apply(null, [f.collection(db, 'reports')].concat(conditions));
    modReportUnsub = f.onSnapshot(q, function (snap) {
      modReports = [];
      snap.forEach(function (d) { modReports.push(Object.assign({ id: d.id }, d.data())); });
      var pending = modReports.filter(function (r) { return r.status === 'pending'; }).length;
      var countEl = document.getElementById('modSub');
      if (countEl) countEl.textContent = modReports.length + ' reports · ' + pending + ' pending';
      var sbEl = document.getElementById('sb-mod');
      if (sbEl) sbEl.textContent = pending > 0 ? String(pending) : '';
      renderModQueue();
    }, function (err) {
      if (el) el.innerHTML = '<div class="mod-empty"><i class="fas fa-lock"></i><p>Admin access required to view reports.</p></div>';
      console.warn('[Admin] reports listener', err.message);
    });
  }

  // Safe URL builder for report targets — avoids injecting unknown collection names.
  function modTargetUrl(type, id) {
    if (!type || !id) return '';
    var map = {
      user:     'profile.html?id=' + encodeURIComponent(id),
      business: 'business.html?id=' + encodeURIComponent(id),
      group:    'groups.html?id=' + encodeURIComponent(id),
      place:    'places.html?id=' + encodeURIComponent(id),
      event:    'events.html?id=' + encodeURIComponent(id)
    };
    return map[type] || '';
  }

  function renderModQueue() {
    var el = document.getElementById('modQueue');
    if (!el) return;
    if (!modReports.length) {
      el.innerHTML = '<div class="mod-empty"><i class="fas fa-check-circle" style="color:#10b981"></i><p>No reports match these filters.</p></div>';
      return;
    }
    el.innerHTML = modReports.map(function (r) {
      var typeClass   = 'mod-badge-' + (r.targetType || 'post');
      var statusClass = 'mod-status-' + (r.status || 'pending');
      var isPending   = (r.status || 'pending') === 'pending';
      // escAttr() for onclick JS string context; esc() for HTML display.
      var idA  = escAttr(r.id || '');
      var ttA  = escAttr(r.targetType || '');
      var tidA = escAttr(r.targetId || '');
      var tid  = esc(r.targetId || '—');
      var rid  = esc(r.reporterId || '—');
      var viewUrl = modTargetUrl(r.targetType, r.targetId);
      return '<div class="mod-report-card' + (isPending ? ' unread' : '') + '">' +
        '<div class="mod-report-meta">' +
          '<span class="mod-type-badge ' + typeClass + '">' + esc(r.targetType || 'unknown') + '</span>' +
          '<span class="mod-report-reason">' + esc(r.reason || 'No reason given') + '</span>' +
          '<span class="mod-status-badge ' + statusClass + '">' + esc(r.status || 'pending') + '</span>' +
        '</div>' +
        (r.details ? '<div class="mod-report-details">' + esc(r.details) + '</div>' : '') +
        '<div class="mod-report-details" style="font-size:.69rem">Target: <code>' + tid + '</code>' +
          (viewUrl ? ' <a href="' + viewUrl + '" target="_blank" rel="noopener noreferrer" style="color:#10e0a0;font-size:.69rem;margin-left:4px">View</a>' : '') +
          ' &nbsp;·&nbsp; Reporter: <code>' + rid + '</code>' +
        '</div>' +
        '<div class="mod-report-footer">' +
          '<span class="mod-report-time">' + modTimeAgo(r.createdAt) + '</span>' +
          (isPending
            ? '<button class="mod-act-btn mod-act-resolve" onclick="modResolve(\'' + idA + '\')"><i class="fas fa-check"></i> Resolve</button>' +
              '<button class="mod-act-btn mod-act-dismiss" onclick="modDismiss(\'' + idA + '\')"><i class="fas fa-eye-slash"></i> Dismiss</button>' +
              '<button class="mod-act-btn mod-act-remove"  onclick="modRemoveContent(\'' + idA + '\',\'' + ttA + '\',\'' + tidA + '\')"><i class="fas fa-trash"></i> Remove</button>' +
              '<button class="mod-act-btn mod-act-warn"    onclick="modWarnUser(\'' + idA + '\',\'' + tidA + '\')"><i class="fas fa-exclamation-triangle"></i> Warn</button>'
            : '') +
        '</div>' +
        '</div>';
    }).join('');
  }

  window.filterMod = function (type) {
    modTypeFilter = type;
    document.querySelectorAll('#modTypeBar .mod-filter-btn').forEach(function (b) {
      b.classList.toggle('active', b.textContent.trim().toLowerCase().replace(' types','') === (type === 'all' ? 'all types' : type).toLowerCase().replace(' types',''));
    });
    loadModeration();
  };
  window.filterModStatus = function (status) {
    modStatusFilter = status;
    document.querySelectorAll('#modStatusBar .mod-filter-btn').forEach(function (b) {
      b.classList.toggle('active', b.textContent.trim().toLowerCase() === status);
    });
    loadModeration();
  };

  function modUpdateReport(id, status, extra) {
    var geo = window.GeoFirebase;
    if (!geo || !geo.fs) return Promise.reject(new Error('no firebase'));
    var f = geo.fs;
    return f.updateDoc(f.doc(geo.db, 'reports', id), Object.assign({
      status: status, resolvedAt: f.serverTimestamp(),
      resolvedBy: (window.GeoCurrentUser || {}).uid || ''
    }, extra || {}));
  }
  function modLogAction(action, targetId, targetType, notes) {
    var geo = window.GeoFirebase;
    if (!geo || !geo.fs) return Promise.resolve();
    var f = geo.fs;
    return f.addDoc(f.collection(geo.db, 'moderationActions'), {
      action: action, targetId: targetId || '', targetType: targetType || '',
      notes: notes || '', adminId: (window.GeoCurrentUser || {}).uid || '', createdAt: f.serverTimestamp()
    });
  }

  window.modResolve = function (id) {
    modUpdateReport(id, 'resolved')
      .then(function () { toast('Report resolved'); })
      .catch(function (e) { toast('Error: ' + e.message, 'rgba(239,68,68,.9)'); });
  };
  window.modDismiss = function (id) {
    modUpdateReport(id, 'dismissed')
      .then(function () { toast('Report dismissed'); })
      .catch(function (e) { toast('Error: ' + e.message, 'rgba(239,68,68,.9)'); });
  };
  window.modRemoveContent = function (reportId, targetType, targetId) {
    if (!targetId) { toast('No target ID', 'rgba(239,68,68,.9)'); return; }
    if (!confirm('Permanently remove this ' + (targetType || 'item') + '?\nID: ' + targetId + '\n\nThis cannot be undone.')) return;
    var geo = window.GeoFirebase;
    if (!geo || !geo.fs) return;
    var f = geo.fs, db = geo.db;
    var colMap = { post:'posts', user:'users', comment:'posts', place:'places', business:'businesses', event:'events', group:'groups' };
    var col = colMap[targetType];
    if (!col) { toast('Unknown content type: ' + esc(targetType || '?'), 'rgba(239,68,68,.9)'); return; }
    f.deleteDoc(f.doc(db, col, targetId))
      .then(function () { return modUpdateReport(reportId, 'resolved', { action: 'content_removed' }); })
      .then(function () { return modLogAction('content_removed', targetId, targetType); })
      .then(function () { toast('Content removed'); loadAuditLog(); })
      .catch(function (e) { toast('Failed: ' + e.message, 'rgba(239,68,68,.9)'); });
  };
  window.modWarnUser = function (reportId, userId) {
    var notes = prompt('Warning notes (internal only):');
    if (notes === null) return;
    modUpdateReport(reportId, 'resolved', { action: 'user_warned' })
      .then(function () { return modLogAction('user_warned', userId, 'user', notes); })
      .then(function () { toast('Warning logged'); loadAuditLog(); })
      .catch(function (e) { toast('Failed: ' + e.message, 'rgba(239,68,68,.9)'); });
  };
  window.modSuspendUser = function (userId) {
    if (!userId || !confirm('Suspend user ' + userId + '? They will be marked suspended.')) return;
    var geo = window.GeoFirebase;
    if (!geo || !geo.fs) return;
    var f = geo.fs;
    f.updateDoc(f.doc(geo.db, 'users', userId), {
      suspended: true, suspendedAt: f.serverTimestamp(), suspendedBy: (window.GeoCurrentUser || {}).uid || ''
    }).then(function () { return modLogAction('user_suspended', userId, 'user'); })
      .then(function () { toast('User suspended'); loadAuditLog(); })
      .catch(function (e) { toast('Failed: ' + e.message, 'rgba(239,68,68,.9)'); });
  };

  /* ── Audit log ── */
  function loadAuditLog() {
    var el = document.getElementById('modAuditLog');
    if (!el) return;
    var geo = window.GeoFirebase;
    if (!geo || !geo.fs || !geo.db) return;
    var f = geo.fs, db = geo.db;
    f.getDocs(f.query(f.collection(db, 'moderationActions'), f.orderBy('createdAt', 'desc'), f.limit(30)))
      .then(function (snap) {
        if (snap.empty) {
          el.innerHTML = '<div class="mod-empty" style="padding:16px 0"><i class="fas fa-shield-alt"></i><p>No moderation actions yet.</p></div>';
          return;
        }
        var iconMap = {
          content_removed: '<i class="fas fa-trash" style="color:#f87171"></i>',
          user_warned:     '<i class="fas fa-exclamation-triangle" style="color:#f59e0b"></i>',
          user_suspended:  '<i class="fas fa-ban" style="color:#f87171"></i>'
        };
        el.innerHTML = snap.docs.map(function (d) {
          var a = d.data();
          return '<div class="mod-audit-item">' +
            '<div class="mod-audit-icon" style="background:rgba(255,255,255,.05)">' +
              (iconMap[a.action] || '<i class="fas fa-shield-alt" style="color:#64748b"></i>') +
            '</div>' +
            '<div class="mod-audit-body">' +
              '<div class="mod-audit-action">' + esc(a.action || 'action') + '</div>' +
              '<div class="mod-audit-meta">Target: ' + esc(a.targetId || '—') +
                ' &nbsp;·&nbsp; Admin: ' + esc(a.adminId || '—') +
                (a.notes ? ' &nbsp;·&nbsp; ' + esc(a.notes) : '') +
                ' &nbsp;·&nbsp; ' + modTimeAgo(a.createdAt) +
              '</div>' +
            '</div></div>';
        }).join('');
      }).catch(function () {});
  }

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
        ? '<img src="' + escHtmlAdmin(item.mediaUrl) + '" loading="lazy" decoding="async" style="max-height:130px;border-radius:8px;margin-top:8px;object-fit:cover;max-width:100%">'
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
      { id: 'csDate',       label: 'Start Date & Time',           type: 'datetime-local', key: 'date' },
      { id: 'csEndDate',    label: 'End Date & Time (optional)',   type: 'datetime-local', key: 'endDate' },
      { id: 'csPrice',      label: 'Ticket Price (₾, 0 = free)',  type: 'number', key: 'ticketPrice', min: 0 },
      { id: 'csCapacity',   label: 'Capacity (0 = unlimited)',    type: 'number', key: 'capacity', min: 0 },
      { id: 'csVenue',      label: 'Venue / address',             type: 'text',   key: 'venue' },
      { id: 'csHostName',   label: 'Host / Organizer name',       type: 'text',   key: 'hostName' },
      { id: 'csBusinessId', label: 'Business ID (optional link)', type: 'text',   key: 'businessId' },
      { id: 'csGroupId',    label: 'Group ID (optional link)',    type: 'text',   key: 'groupId' }
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
    ],
    challenges: [
      { id: 'csChallengeType', label: 'Type (checkin_count / city_checkin / place_checkin / business_checkin / date_limited_checkin)', type: 'text', key: 'type', placeholder: 'checkin_count' },
      { id: 'csChallengeCategory', label: 'Category (travel / food / events / patriot / fitness / exploration / community)', type: 'text', key: 'category', placeholder: 'exploration' },
      { id: 'csChallengeTarget', label: 'Target count', type: 'number', key: 'targetCount', min: 1 },
      { id: 'csChallengeXp', label: 'XP reward', type: 'number', key: 'xpReward', min: 0 },
      { id: 'csChallengeBadgeId', label: 'Badge ID optional', type: 'text', key: 'badgeId' },
      { id: 'csChallengeBadgeTitle', label: 'Badge title optional', type: 'text', key: 'badgeTitle' },
      { id: 'csChallengeBadgeRarity', label: 'Badge rarity optional', type: 'text', key: 'badgeRarity', placeholder: 'common' },
      { id: 'csChallengePlace', label: 'Place ID optional', type: 'text', key: 'placeId' },
      { id: 'csChallengeBusiness', label: 'Business ID optional', type: 'text', key: 'businessId' },
      { id: 'csChallengeStart', label: 'Start date', type: 'date', key: 'startAt' },
      { id: 'csChallengeEnd', label: 'End date', type: 'date', key: 'endAt' }
    ],
    services: [
      { id: 'csServiceType', label: 'Service type (e.g. plumbing, legal, tutoring)', type: 'text', key: 'serviceType' },
      { id: 'csPrice', label: 'Starting price ₾ (0 = negotiable)', type: 'number', key: 'price', min: 0 },
      { id: 'csPhone', label: 'Contact phone', type: 'tel', key: 'phone' },
      { id: 'csAddress', label: 'Address / area', type: 'text', key: 'address' }
    ],
    realEstateListings: [
      { id: 'csListingType', label: 'Type (sale / rent)', type: 'text', key: 'listingType', placeholder: 'sale' },
      { id: 'csPrice', label: 'Price ₾', type: 'number', key: 'price', min: 0 },
      { id: 'csArea', label: 'Area m²', type: 'number', key: 'area', min: 0 },
      { id: 'csBedrooms', label: 'Bedrooms', type: 'number', key: 'bedrooms', min: 0 },
      { id: 'csAddress', label: 'Address', type: 'text', key: 'address' }
    ],
    learningItems: [
      { id: 'csTeacher', label: 'Teacher / instructor name', type: 'text', key: 'teacher' },
      { id: 'csSubject', label: 'Subject (e.g. English, Math, Programming)', type: 'text', key: 'subject' },
      { id: 'csPrice', label: 'Price ₾ (0 = free)', type: 'number', key: 'price', min: 0 },
      { id: 'csDuration', label: 'Duration (e.g. 8 weeks, 20 hours)', type: 'text', key: 'duration' },
      { id: 'csFormat', label: 'Format (online / in-person / hybrid)', type: 'text', key: 'format', placeholder: 'online' }
    ],
    liveActivity: [
      { id: 'csAlertType', label: 'Type (hotspot / event / alert / news)', type: 'text', key: 'alertType', placeholder: 'hotspot' },
      { id: 'csIntensity', label: 'Intensity 1–5', type: 'number', key: 'intensity', min: 1 },
      { id: 'csLat', label: 'Latitude', type: 'number', key: 'lat', step: 'any' },
      { id: 'csLng', label: 'Longitude', type: 'number', key: 'lng', step: 'any' }
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

  function getPlaceCategories() {
    if (_firestorePlaceCats !== null) return _firestorePlaceCats;
    return window.GEOHUB_PLACE_CATEGORIES || [];
  }

  function loadPlaceCatsFromFirestore(callback) {
    var fb = window.GeoFirebase, f = fb && fb.fs;
    if (!fb || !f) { if (callback) callback([]); return; }
    f.getDocs(f.query(f.collection(fb.db, 'placeCategories'), f.orderBy('sortOrder', 'asc'))).then(function(snap) {
      var cats = [];
      snap.forEach(function(d) {
        var data = d.data();
        if (data.active === false) return;
        cats.push({
          id: d.id,
          icon: data.icon || '📍',
          label: data.labelKa || data.labelEn || d.id,
          labelEn: data.labelEn || '',
          color: data.color || '#6c757d',
          sortOrder: data.sortOrder || 100,
          subcategories: data.subcategories || []
        });
      });
      _firestorePlaceCats = cats.length ? cats : null;
      if (callback) callback(cats);
    }).catch(function() { if (callback) callback([]); });
  }

  function populatePlaceCategorySelect(selectedValue) {
    var sel = document.getElementById('adminPlaceCategory');
    if (!sel) return;
    var cats = getPlaceCategories();
    var opts = '<option value="">აირჩიე კატეგორია</option>';
    cats.forEach(function(c) {
      var isSelected = selectedValue && (c.id === selectedValue || c.label === selectedValue);
      opts += '<option value="' + c.id + '"' + (isSelected ? ' selected' : '') + '>' + c.label + '</option>';
    });
    sel.innerHTML = opts;
  }

  function populatePlaceSubcategorySelect(categoryId, selectedSub) {
    var sel = document.getElementById('adminPlaceSubcategory');
    if (!sel) return;
    var cats = getPlaceCategories();
    var cat = cats.find(function(c) { return c.id === categoryId || c.label === categoryId; });
    var subs = (cat && cat.subcategories) || [];
    // Fallback to _PCAT_DEFAULTS when Firestore loaded but subcategories are empty
    if (subs.length === 0 && categoryId) {
      var defCat = _PCAT_DEFAULTS.find(function(c) { return c.id === categoryId; });
      if (defCat && defCat.subcategories && defCat.subcategories.length) subs = defCat.subcategories;
    }
    // Fallback to static window.GEOHUB_PLACE_CATEGORIES strings
    if (subs.length === 0 && categoryId && window.GEOHUB_PLACE_CATEGORIES) {
      var staticCat = window.GEOHUB_PLACE_CATEGORIES.find(function(c) { return c.id === categoryId; });
      if (staticCat && staticCat.subcategories) subs = staticCat.subcategories;
    }
    sel.disabled = subs.length === 0;
    var opts = '<option value="">აირჩიე ქვეკატეგორია</option>';
    var foundSub = false;
    subs.forEach(function(s) {
      var subId    = (typeof s === 'object') ? (s.id || '') : s;
      var subLabel = (typeof s === 'object') ? (s.labelKa || s.labelEn || s.id || '') : s;
      var isSelected = selectedSub && subId === selectedSub;
      if (isSelected) foundSub = true;
      opts += '<option value="' + subId + '"' + (isSelected ? ' selected' : '') + '>' + subLabel + '</option>';
    });
    if (selectedSub && !foundSub) {
      opts += '<option value="' + selectedSub + '" selected>' + selectedSub + '</option>';
    }
    sel.innerHTML = opts;
  }

  function syncPlaceSubcategories() {
    var catSel = document.getElementById('adminPlaceCategory');
    var subSel = document.getElementById('adminPlaceSubcategory');
    var textCat = document.getElementById('adminContentCategory');
    if (!catSel) return;
    populatePlaceSubcategorySelect(catSel.value, '');
    if (subSel) {
      subSel.style.display = catSel.value ? 'block' : 'none';
      subSel.disabled = !catSel.value;
    }
    var cats = getPlaceCategories();
    var cat = cats.find(function(c) { return c.id === catSel.value; });
    if (textCat) {
      textCat.value = cat ? cat.label : catSel.value;
    }
    // Auto-fill icon unless admin manually typed their own
    var iconEl = document.getElementById('adminPlaceIcon');
    if (iconEl && !iconEl.dataset.userEdited && cat && cat.icon) {
      iconEl.value = cat.icon;
    }
    var iconPreview = document.getElementById('adminPlaceIconPreview');
    if (iconPreview) iconPreview.textContent = (iconEl && iconEl.value.trim()) || (cat && cat.icon) || '';
  }

  function togglePlaceCategoryUI(col) {
    var textCat  = document.getElementById('adminContentCategory');
    var placeCat = document.getElementById('adminPlaceCategory');
    var subSel   = document.getElementById('adminPlaceSubcategory');
    var gWrap    = document.getElementById('adminGooglePlaceWrap');
    var iconWrap = document.getElementById('adminPlaceIconWrap');
    var isPlaces = col === 'places';
    if (textCat) textCat.style.display = isPlaces ? 'none' : '';
    if (placeCat) {
      placeCat.style.display = isPlaces ? 'block' : 'none';
      if (isPlaces) {
        if (_firestorePlaceCats === null) {
          loadPlaceCatsFromFirestore(function() { populatePlaceCategorySelect(''); });
        } else {
          populatePlaceCategorySelect('');
        }
      }
    }
    if (subSel) subSel.style.display = 'none';
    if (gWrap)   gWrap.style.display   = isPlaces ? 'block' : 'none';
    if (iconWrap) iconWrap.style.display = isPlaces ? 'flex' : 'none';
  }

  var _editingPlaceId = null; // null = add mode; docId string = edit mode

  function getPlaceImageUrl(place) {
    return (place && (place.imageUrl || place.image || place.photoUrl || place.mediaUrl)) || '';
  }

  function normalizePlaceImport(it, user, fs) {
    var cats = getPlaceCategories();
    var catId    = it.categoryId || '';
    var catLabel = it.category   || '';
    var matched  = null;
    if (catId)    matched = cats.find(function(c) { return c.id    === catId;    });
    if (!matched && catLabel) matched = cats.find(function(c) { return c.label === catLabel; });
    if (matched) { catId = matched.id; catLabel = matched.label; }
    else         { catId = catId || ''; }

    // imageSearchUrl is always rejected; use only real https image URLs
    var rawImg = it.imageUrl || it.image || it.coverImage || it.coverImageUrl ||
                 it.coverUrl || it.photoUrl || it.thumbnail || null;
    if (rawImg && rawImg === it.imageSearchUrl) rawImg = null; // explicitly reject imageSearchUrl
    var imgUrl = (rawImg && typeof rawImg === 'string' && /^https:\/\//i.test(rawImg)) ? rawImg : null;

    var lat = (it.lat  !== undefined && it.lat  !== null && !isNaN(Number(it.lat)))  ? Number(it.lat)  : null;
    var lng = (it.lng  !== undefined && it.lng  !== null && !isNaN(Number(it.lng)))  ? Number(it.lng)  : null;

    var doc = {
      name: it.name || it.title,
      title: it.title || it.name,
      description: it.description || it.shortDescription || '',
      shortDescription: it.shortDescription || it.description || '',
      city: it.city || '',
      region: it.region || '',
      district: it.district || '',
      address: it.address || '',
      category: catLabel,
      categoryId: catId,
      subcategory: it.subcategory || '',
      imageUrl: imgUrl,
      image: imgUrl,
      sourceUrl: it.sourceUrl || '',
      isVerified: it.isVerified || false,
      status: it.status || 'active',
      googlePlaceId: it.googlePlaceId || '',
      googleLinked:  !!(it.googlePlaceId),
      dataSource:    it.googlePlaceId ? 'manual+google' : 'manual',
      createdBy: user.uid, ownerId: user.uid, userId: user.uid,
      createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp()
    };
    if (lat !== null) doc.lat = lat;
    if (lng !== null) doc.lng = lng;
    return doc;
  }

  function bindContentStudio() {
    var form = document.getElementById('adminContentForm');
    if (!form || form._wired) return;
    form._wired = true;

    var colSel = document.getElementById('adminContentCollection');
    if (colSel) {
      colSel.addEventListener('change', function() {
        renderExtFields(colSel.value);
        togglePlaceCategoryUI(colSel.value);
      });
      renderExtFields(colSel.value);
      togglePlaceCategoryUI(colSel.value);
    }

    var placeCatSel = document.getElementById('adminPlaceCategory');
    if (placeCatSel) placeCatSel.addEventListener('change', syncPlaceSubcategories);

    var placeSubSel = document.getElementById('adminPlaceSubcategory');
    if (placeSubSel) placeSubSel.addEventListener('change', function() {
      var iconEl = document.getElementById('adminPlaceIcon');
      if (iconEl && iconEl.dataset.userEdited) return;
      var catVal = placeCatSel ? placeCatSel.value : '';
      // Resolve subcategory from all sources (Firestore → _PCAT_DEFAULTS → static)
      var allSubs = [];
      var cats = getPlaceCategories();
      var cat = cats.find(function(c) { return c.id === catVal; });
      allSubs = (cat && cat.subcategories) || [];
      if (allSubs.length === 0 && catVal) {
        var defCat = _PCAT_DEFAULTS.find(function(c) { return c.id === catVal; });
        if (defCat && defCat.subcategories) allSubs = defCat.subcategories;
      }
      var selectedId = placeSubSel.value;
      var subIcon = '';
      if (allSubs.length) {
        var sub = allSubs.find(function(s) {
          return (typeof s === 'object') ? s.id === selectedId : s === selectedId;
        });
        if (sub && typeof sub === 'object') subIcon = sub.icon || '';
      }
      var newIcon = subIcon || (cat && cat.icon) || '';
      if (newIcon && iconEl) {
        iconEl.value = newIcon;
        var prev = document.getElementById('adminPlaceIconPreview');
        if (prev) prev.textContent = newIcon;
      }
    });

    // Cloudinary image upload for Content Studio cover
    var csImgFile = document.getElementById('adminCsImageFile');
    if (csImgFile) {
      csImgFile.addEventListener('change', function() {
        var file = csImgFile.files && csImgFile.files[0];
        if (!file) return;
        var lbl = document.getElementById('adminCsUploadLabel');
        if (lbl) { lbl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading…'; }
        var cfg = (window.GeoConfig && window.GeoConfig.CLOUDINARY) || { cloudName: 'dw5dqk2w7', uploadPreset: 'geohub_unsigned', rootFolder: 'geohub' };
        var fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', cfg.uploadPreset);
        fd.append('folder', (cfg.rootFolder || 'geohub') + '/events');
        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + cfg.cloudName + '/image/upload');
        xhr.onload = function() {
          try {
            var r = JSON.parse(xhr.responseText);
            var url = r.secure_url || null;
            if (url) {
              var imgInput = document.getElementById('adminContentImage');
              if (imgInput) imgInput.value = url;
              if (lbl) lbl.innerHTML = '<i class="fas fa-check"></i> Uploaded';
            } else {
              if (lbl) lbl.innerHTML = '<i class="fas fa-upload"></i> Upload';
              toast('Upload failed: no URL returned');
            }
          } catch(e) {
            if (lbl) lbl.innerHTML = '<i class="fas fa-upload"></i> Upload';
            toast('Upload failed');
          }
          csImgFile.value = '';
        };
        xhr.onerror = function() {
          if (lbl) lbl.innerHTML = '<i class="fas fa-upload"></i> Upload';
          toast('Upload error');
          csImgFile.value = '';
        };
        xhr.send(fd);
      });
    }

    // Image URL live preview
    var imgInput = document.getElementById('adminContentImage');
    if (imgInput) {
      imgInput.addEventListener('input', function() {
        adminUpdateImagePreview(imgInput.value.trim());
      });
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
      if (col === 'challenges') {
        doc.type = 'checkin_count';
        doc.targetCount = 1;
        doc.xpReward = 100;
        doc.active = true;
      }

      if (col === 'places') {
        var placeCatSel = document.getElementById('adminPlaceCategory');
        var placeSubSel = document.getElementById('adminPlaceSubcategory');
        var placeCatId = (placeCatSel && placeCatSel.value) || '';
        var matchedCat = getPlaceCategories().find(function(c) { return c.id === placeCatId; });
        if (matchedCat) {
          doc.categoryId = matchedCat.id;
          doc.category   = matchedCat.label;
        } else {
          doc.categoryId = '';
        }
        doc.subcategory = (placeSubSel && placeSubSel.value) || '';
        var iconInputEl = document.getElementById('adminPlaceIcon');
        var iconVal     = (iconInputEl && iconInputEl.value.trim()) || '';
        if (!iconVal && matchedCat && matchedCat.icon) iconVal = matchedCat.icon;
        if (iconVal) doc.icon = iconVal;
        var gPlaceIdEl  = document.getElementById('adminGooglePlaceIdInput');
        var gPlaceId    = (gPlaceIdEl && gPlaceIdEl.value.trim()) || '';
        doc.googlePlaceId = gPlaceId;
        doc.googleLinked  = !!gPlaceId;
        doc.dataSource    = gPlaceId ? 'manual+google' : 'manual';
      }

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
      var isEdit = !!(col === 'places' && _editingPlaceId);
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (isEdit ? 'Updating…' : 'Creating…');

      var savePromise;
      if (isEdit) {
        // Edit mode: updateDoc, preserve unknown fields
        delete doc.createdAt; delete doc.createdBy;
        doc.updatedAt = fs.serverTimestamp();
        savePromise = fs.updateDoc(fs.doc(db, col, _editingPlaceId), doc).then(function() {
          return { id: _editingPlaceId, _update: true };
        });
      } else {
        savePromise = fs.addDoc(fs.collection(db, col), doc);
      }

      savePromise.then(function(ref) {
        var docId = ref._update ? ref.id : (ref && ref.id);
        if (isEdit) {
          toast('ადგილი განახლდა: ' + title);
          window.adminCancelEditPlace();
        } else {
          form.reset();
          var iconReset = document.getElementById('adminPlaceIcon');
          if (iconReset) { iconReset.value = ''; delete iconReset.dataset.userEdited; }
          var iconPrevReset = document.getElementById('adminPlaceIconPreview');
          if (iconPrevReset) iconPrevReset.textContent = '';
          renderExtFields(col);
          toast('Created: ' + title + ' (ID: ' + (docId||'').slice(-6) + ')');
        }
        var preview = document.getElementById('adminContentPreview');
        var previewBody = document.getElementById('adminContentPreviewBody');
        if (preview && previewBody) {
          var lines = ['<strong>' + esc(title) + '</strong> → <code style="font-size:.78rem">' + col + '/' + (docId||'') + '</code>'];
          if (desc) lines.push(esc(desc.slice(0, 120)) + (desc.length > 120 ? '…' : ''));
          if (city) lines.push('City: ' + esc(city));
          if (category) lines.push('Category: ' + esc(category));
          if (image) {
            var imgPreviewStyle = 'max-height:60px;max-width:100%;border-radius:6px;margin-top:4px;display:block';
            lines.push('Image: <code style="font-size:.75rem">' + esc(image.slice(0, 72)) + (image.length > 72 ? '…' : '') + '</code>' +
              '<br><img src="' + esc(image) + '" style="' + imgPreviewStyle + '" onerror="this.style.display=\'none\'">');
          }
          previewBody.innerHTML = lines.join('<br>');
          preview.style.display = 'block';
          setTimeout(function() { if (preview) preview.style.display = 'none'; }, 8000);
        }
        window.loadContentList();
      }).catch(function(err) {
        console.error('[Admin Content Studio]', err);
        toast((isEdit ? 'Update' : 'Create') + ' failed: ' + err.message);
      }).finally(function() {
        btn.disabled = false;
        btn.innerHTML = isEdit
          ? '<i class="fas fa-save"></i> Update Place'
          : '<i class="fas fa-plus"></i> Create real item';
      });
    });
  }

  /* ── DELETE ALL PLACES ────────────────────────────────────── */
  function setDeletePlacesProgress(msg, color) {
    var el = document.getElementById('adminDeletePlacesProgress');
    if (!el) return;
    el.style.color = color || '#94a3b8';
    el.textContent = msg;
  }

  function bindDeleteAllPlacesButton() {
    var bulkColSel = document.getElementById('adminBulkCollection');
    var wrap     = document.getElementById('adminDeletePlacesWrap');
    var imgWrap  = document.getElementById('adminCheckImagesWrap');
    if (!bulkColSel || !wrap) return;
    function toggle() {
      var isPlaces = bulkColSel.value === 'places';
      wrap.style.display    = isPlaces ? 'block' : 'none';
      if (imgWrap) imgWrap.style.display = isPlaces ? 'block' : 'none';
    }
    bulkColSel.addEventListener('change', toggle);
    toggle();
  }

  /* ── IMAGE URL HELPERS ────────────────────────────────────── */
  function isLikelyBadImageUrl(url) {
    if (!url || typeof url !== 'string') return true;
    if (!/^https?:\/\//i.test(url)) return true;
    if (url.indexOf('commons.wikimedia.org/wiki/Special:Redirect') !== -1) return true;
    if (url.indexOf('imageSearchUrl') !== -1) return true;
    return false;
  }

  function testImageLoad(url) {
    return new Promise(function(resolve) {
      if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) { resolve(false); return; }
      var img = new Image();
      var done = false;
      function finish(ok) { if (!done) { done = true; resolve(ok); } }
      img.onload  = function() { finish(this.naturalWidth > 0 && this.naturalHeight > 0); };
      img.onerror = function() { finish(false); };
      setTimeout(function() { finish(false); }, 8000);
      img.src = url;
    });
  }

  function setBrokenProgress(msg, color) {
    var el = document.getElementById('adminCheckImagesProgress');
    if (el) { el.style.color = color || '#94a3b8'; el.textContent = msg; }
  }

  /* ── BROKEN IMAGE CHECKER ─────────────────────────────────── */
  window.checkBrokenPlaceImages = function() {
    if (!window.GeoFirebase || !window.GeoFirebase.fs) return toast('Firebase not ready');
    var gf = window.GeoFirebase, fs = gf.fs, db = gf.db;
    var btn = document.getElementById('adminCheckImagesBtn');
    var panel = document.getElementById('adminBrokenImagesPanel');
    if (btn) { btn.disabled = true; }
    if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
    setBrokenProgress('ადგილები იძებნება…');

    fs.getDocs(fs.collection(db, 'places')).then(function(snap) {
      var docs = snap.docs;
      if (!docs.length) {
        setBrokenProgress('ადგილები არ მოიძებნა.', '#94a3b8');
        if (btn) btn.disabled = false;
        return;
      }
      var total = docs.length;
      var checked = 0;
      var broken = [];

      function checkNext(i) {
        if (i >= docs.length) {
          setBrokenProgress(broken.length === 0
            ? 'ყველა ფოტო სწორია (' + total + ' ადგილი).'
            : broken.length + ' პრობლემური ადგილი ' + total + '-დან.', broken.length ? '#f59e0b' : '#10e0a0');
          if (btn) btn.disabled = false;
          renderBrokenPanel(broken);
          return;
        }
        var d = docs[i];
        var data = d.data() || {};
        var url = getPlaceImageUrl(data);
        setBrokenProgress('ფოტოების შემოწმება: ' + (i+1) + ' / ' + total + '…');
        if (isLikelyBadImageUrl(url)) {
          broken.push({ id: d.id, data: data, url: url, reason: url ? 'bad URL format' : 'no imageUrl' });
          checkNext(i + 1);
        } else {
          testImageLoad(url).then(function(ok) {
            if (!ok) broken.push({ id: d.id, data: data, url: url, reason: 'image failed to load' });
            checkNext(i + 1);
          });
        }
      }
      checkNext(0);
    }).catch(function(err) {
      setBrokenProgress('შეცდომა: ' + (err && err.message), '#ef4444');
      if (btn) btn.disabled = false;
    });
  };

  function renderBrokenPanel(broken) {
    var panel = document.getElementById('adminBrokenImagesPanel');
    if (!panel) return;
    if (!broken.length) { panel.style.display = 'none'; return; }
    var rows = broken.map(function(b) {
      var id   = escHtmlAdmin(b.id);
      var name = escHtmlAdmin(b.data.name || b.data.title || b.id);
      var cat  = escHtmlAdmin((b.data.category || '') + (b.data.subcategory ? ' / ' + b.data.subcategory : ''));
      var url  = escHtmlAdmin(b.url || '');
      var urlShort = escHtmlAdmin((b.url||'').slice(0, 60) + ((b.url||'').length > 60 ? '…' : ''));
      var reason = escHtmlAdmin(b.reason || '');
      var imgStyle = 'width:40px;height:40px;border-radius:6px;object-fit:cover;flex-shrink:0;background:#1e293b';
      var thumb = b.url
        ? '<img src="' + url + '" style="' + imgStyle + '" onerror="this.outerHTML=\'<div style=\\\'' + imgStyle + ';display:flex;align-items:center;justify-content:center;font-size:1.2rem\\\'>📍</div>\'">'
        : '<div style="' + imgStyle + ';display:flex;align-items:center;justify-content:center;font-size:1.2rem">📍</div>';
      var openBtn = b.url
        ? '<a href="' + url + '" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="font-size:.72rem">Open</a>'
        : '';
      var editBtn = '<button class="btn btn-ghost btn-sm" style="font-size:.72rem" onclick="adminEditPlaceFromBroken(\'' + id + '\')">' +
        '<i class="fas fa-pen"></i> Edit</button>';
      var replaceBtn = '<button class="btn btn-ghost btn-sm" style="font-size:.72rem;color:#818cf8;border-color:rgba(99,102,241,.35)" ' +
        'onclick="adminReplaceImageUrl(\'' + id + '\')"><i class="fas fa-link"></i> Replace URL</button>';
      var clearBtn = '<button class="btn btn-ghost btn-sm" style="font-size:.72rem;color:#f59e0b;border-color:rgba(245,158,11,.35)" ' +
        'onclick="adminClearImageUrl(\'' + id + '\',this)"><i class="fas fa-eraser"></i> Clear</button>';
      var delBtn = '<button class="btn btn-ghost btn-sm" style="font-size:.72rem;color:#ef4444;border-color:rgba(239,68,68,.35)" ' +
        'onclick="adminDeleteBrokenPlace(\'' + id + '\',\'' + name + '\',this)"><i class="fas fa-trash"></i> Delete</button>';
      return '<div class="bi" style="gap:8px;padding:8px 6px;flex-wrap:wrap;align-items:flex-start">' +
        thumb +
        '<div style="flex:1;min-width:140px">' +
          '<div style="font-size:.8rem;font-weight:700;color:#f0f4ff">' + name + '</div>' +
          '<div style="font-size:.7rem;color:#94a3b8">' + cat + '</div>' +
          '<div style="font-size:.68rem;color:#64748b;word-break:break-all">' + urlShort + '</div>' +
          '<div style="font-size:.68rem;color:#f87171">' + reason + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
          openBtn + editBtn + replaceBtn + clearBtn + delBtn +
        '</div>' +
      '</div>';
    }).join('');
    panel.innerHTML =
      '<div style="font-size:.8rem;font-weight:700;color:#f87171;margin-bottom:8px">' +
        '<i class="fas fa-exclamation-triangle"></i> პრობლემური ფოტოები (' + broken.length + ')</div>' +
      '<div class="bl">' + rows + '</div>';
    panel.style.display = 'block';
  }

  window.adminReplaceImageUrl = function(placeId) {
    var newUrl = window.prompt('ახალი imageUrl (https://...)');
    if (newUrl === null) return;
    newUrl = newUrl.trim();
    if (!newUrl) return;
    if (!/^https:\/\//i.test(newUrl)) { toast('URL უნდა იწყებოდეს https://'); return; }
    var gf = window.GeoFirebase, fs = gf.fs, db = gf.db;
    testImageLoad(newUrl).then(function(ok) {
      if (!ok) {
        if (!confirm('ფოტო ვერ ჩაიტვირთა. მაინც შეიცვალოს?')) return;
      }
      fs.updateDoc(fs.doc(db, 'places', placeId), {
        imageUrl: newUrl, image: newUrl, updatedAt: fs.serverTimestamp()
      }).then(function() {
        toast('imageUrl განახლდა');
        window.checkBrokenPlaceImages();
      }).catch(function(err) { toast('შეცდომა: ' + (err && err.message)); });
    });
  };

  window.adminClearImageUrl = function(placeId, btn) {
    if (!confirm('ამ ადგილის ფოტო წაიშალოს?')) return;
    if (!window.GeoFirebase || !window.GeoFirebase.fs) return toast('Firebase not ready');
    var gf = window.GeoFirebase, fs = gf.fs, db = gf.db;
    if (btn) btn.disabled = true;
    fs.updateDoc(fs.doc(db, 'places', placeId), {
      imageUrl: '', image: '', updatedAt: fs.serverTimestamp()
    }).then(function() {
      toast('ფოტო გასუფთავდა');
      window.checkBrokenPlaceImages();
    }).catch(function(err) {
      toast('შეცდომა: ' + (err && err.message));
      if (btn) btn.disabled = false;
    });
  };

  window.adminDeleteBrokenPlace = function(placeId, name, btn) {
    if (!confirm('წაიშალოს ადგილი: ' + name + '?')) return;
    if (!window.GeoFirebase || !window.GeoFirebase.fs) return toast('Firebase not ready');
    var gf = window.GeoFirebase, fs = gf.fs, db = gf.db;
    if (btn) btn.disabled = true;
    fs.deleteDoc(fs.doc(db, 'places', placeId)).then(function() {
      toast('ადგილი წაიშალა: ' + name);
      window.checkBrokenPlaceImages();
    }).catch(function(err) {
      toast('შეცდომა: ' + (err && err.message));
      if (btn) btn.disabled = false;
    });
  };

  window.adminEditPlaceFromBroken = function(placeId) {
    if (!window.GeoFirebase || !window.GeoFirebase.fs) return toast('Firebase not ready');
    var gf = window.GeoFirebase, fs = gf.fs, db = gf.db;
    fs.getDoc(fs.doc(db, 'places', placeId)).then(function(snap) {
      if (!snap.exists()) return toast('ადგილი ვერ მოიძებნა');
      window.adminEditPlace(snap.id, snap.data());
      // scroll to form
      var f = document.getElementById('adminContentForm');
      if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function(err) { toast('შეცდომა: ' + (err && err.message)); });
  };

  window.deleteAllPlaces = function() {
    var typed = window.prompt('წასაშლელად ჩაწერე DELETE PLACES');
    if (typed === null) return;
    if (typed.trim() !== 'DELETE PLACES') { toast('გაუქმდა — ტექსტი არასწორია'); return; }
    if (!window.confirm('დარწმუნებული ხარ? ეს წაშლის ყველა ადგილს და უკან დაბრუნება შეუძლებელია.')) return;

    if (!window.GeoFirebase || !window.GeoFirebase.fs) return toast('Firebase not ready');
    var gf = window.GeoFirebase, fs = gf.fs, db = gf.db;

    var btn = document.getElementById('adminDeletePlacesBtn');
    if (btn) btn.disabled = true;
    setDeletePlacesProgress('ადგილები იძებნება…');

    fs.getDocs(fs.collection(db, 'places')).then(function(snap) {
      var docs = snap.docs;
      if (docs.length === 0) {
        setDeletePlacesProgress('ადგილები არ მოიძებნა.', '#94a3b8');
        if (btn) btn.disabled = false;
        return;
      }
      setDeletePlacesProgress('წაიშლება ' + docs.length + ' ადგილი…', '#f59e0b');

      var CHUNK = 400;
      var chunks = [];
      for (var i = 0; i < docs.length; i += CHUNK) { chunks.push(docs.slice(i, i + CHUNK)); }

      var deleted = 0;
      function deleteChunk(idx) {
        if (idx >= chunks.length) {
          setDeletePlacesProgress('წაიშალა ' + deleted + ' ადგილი.', '#10e0a0');
          toast('ყველა ადგილი წაიშალა');
          if (btn) btn.disabled = false;
          return;
        }
        var batch = fs.writeBatch(db);
        chunks[idx].forEach(function(d) { batch.delete(d.ref); });
        batch.commit().then(function() {
          deleted += chunks[idx].length;
          setDeletePlacesProgress('წაიშალა ' + deleted + ' / ' + docs.length + '…', '#f59e0b');
          deleteChunk(idx + 1);
        }).catch(function(err) {
          var msg = (err && err.message) || '';
          setDeletePlacesProgress('შეცდომა: ' + msg, '#ef4444');
          if (msg.toLowerCase().indexOf('permission') !== -1) toast('წაშლა ვერ მოხერხდა — permission denied');
          else toast('წაშლა ვერ მოხერხდა: ' + msg);
          if (btn) btn.disabled = false;
        });
      }
      deleteChunk(0);
    }).catch(function(err) {
      var msg = (err && err.message) || '';
      setDeletePlacesProgress('შეცდომა: ' + msg, '#ef4444');
      toast('წაშლა ვერ მოხერხდა: ' + msg);
      if (btn) btn.disabled = false;
    });
  };

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
    if (resEl) resEl.style.display = 'none';

    // Warn about suspicious image URLs in places imports
    if (col === 'places') {
      var badUrlItems = items.filter(function(it) {
        var u = it.imageUrl || it.image || '';
        return u && (isLikelyBadImageUrl(u) || !/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u));
      });
      if (badUrlItems.length > 0) {
        if (valEl) { valEl.style.color = '#f59e0b'; valEl.textContent = badUrlItems.length + ' ადგილს აქვს სავარაუდოდ პრობლემური imageUrl (Wikimedia, non-https, ან არა-პირდაპირი ფოტო ლინკი). ზოგი ფოტო შეიძლება არ გამოჩნდეს.'; }
        // continue import anyway — just warn
      } else {
        if (valEl) { valEl.style.color = '#94a3b8'; valEl.textContent = 'Importing ' + items.length + ' items…'; }
      }
    } else {
      if (valEl) { valEl.style.color = '#94a3b8'; valEl.textContent = 'Importing ' + items.length + ' items…'; }
    }

    var promises = items.map(function(it) {
      var doc;
      if (col === 'places') {
        doc = normalizePlaceImport(it, user, fs);
      } else {
        var imgNorm = it.imageUrl||it.image||it.coverImage||it.coverImageUrl||it.coverUrl||it.photoUrl||it.thumbnail||null;
        doc = Object.assign({}, it, {
          name: it.name || it.title,
          title: it.title || it.name,
          imageUrl: imgNorm,
          image: imgNorm,
          status: it.status || 'active',
          createdBy: user.uid, ownerId: user.uid, userId: user.uid,
          createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp()
        });
      }
      return fs.addDoc(fs.collection(db, col), doc);
    });

    Promise.allSettled(promises).then(function(results) {
      var ok  = results.filter(function(r) { return r.status === 'fulfilled'; }).length;
      var err = results.filter(function(r) { return r.status === 'rejected'; }).length;
      jsonEl.value = '';
      if (valEl) { valEl.style.color = '#10e0a0'; valEl.textContent = 'Done.'; }
      if (resEl) {
        var rows = results.map(function(r, i) {
          var it = items[i];
          var t = (it && (it.title || it.name)) || ('item ' + (i + 1));
          var tEsc = t.replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
          if (r.status === 'fulfilled') {
            var docId = r.value && r.value.id ? r.value.id : '—';
            return '<li style="color:#10e0a0;padding:3px 0"><i class="fas fa-check" style="width:14px"></i> <strong>' + tEsc + '</strong> <span style="color:#64748b;font-size:.78em">' + col + '/' + docId + '</span></li>';
          }
          var errMsg = (r.reason && r.reason.message) || 'failed';
          var errEsc = errMsg.replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
          return '<li style="color:#ef4444;padding:3px 0"><i class="fas fa-xmark" style="width:14px"></i> <strong>' + tEsc + '</strong> <span style="font-size:.78em">' + errEsc + '</span></li>';
        }).join('');
        resEl.style.display = 'block';
        resEl.innerHTML = '<div style="margin-bottom:10px;font-size:.9rem"><i class="fas fa-check-circle" style="color:#10e0a0"></i> Imported <strong>' + ok + '</strong> into <strong>' + col + '</strong>'
          + (err ? ' &nbsp;·&nbsp; <span style="color:#ef4444">' + err + ' failed</span>' : '') + '</div>'
          + '<ul style="list-style:none;padding:0;margin:0;max-height:220px;overflow-y:auto;font-size:.82rem">' + rows + '</ul>';
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

  /* ── CHALLENGE STUDIO ────────────────────────────────────── */
  function toDateInput(v) {
    if (!v) return '';
    var ms = typeof v.toMillis === 'function' ? v.toMillis() : (v.seconds ? v.seconds * 1000 : Number(v));
    if (!ms || isNaN(ms)) return '';
    return new Date(ms).toISOString().slice(0, 10);
  }

  function loadChallenges() {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) {
      window.addEventListener('GeoFirebaseReady', function () { loadChallenges(); }, { once: true });
      return;
    }
    _chalUnsubscribe();
    var db = fb.db, fs = fb.fs;
    _chalUnsubscribe = fs.onSnapshot(
      fs.query(fs.collection(db, 'challenges'), fs.orderBy('createdAt', 'desc')),
      function (snap) {
        var rows = [];
        snap.forEach(function (d) { rows.push(Object.assign({ id: d.id }, d.data())); });
        renderChallengeList(rows);
        var sb = document.getElementById('sb-challenges');
        if (sb) sb.textContent = rows.length;
        var sub = document.getElementById('chalStudioSub');
        if (sub) sub.textContent = rows.length + ' challenge' + (rows.length !== 1 ? 's' : '') + ' in Firestore';
      },
      function (err) {
        console.warn('[Admin] challenges listen', err.message);
        var list = document.getElementById('chalList');
        if (list) list.innerHTML = '<div class="alert danger"><i class="fas fa-exclamation-triangle"></i> ' + escHtmlAdmin(err.message) + '</div>';
      }
    );
  }

  function renderChallengeList(rows) {
    var list = document.getElementById('chalList');
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<div class="admin-step4-empty"><i class="fas fa-bolt" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.3"></i>No challenges yet — create one using the form below.</div>';
      return;
    }
    var TYPE_COLORS = {
      checkin_count: 'bg-green', city_checkin: 'bg-blue', place_checkin: 'bg-purple',
      business_checkin: 'bg-gold', date_limited_checkin: 'bg-orange',
      checkin: 'bg-green', photo: 'bg-blue', qr: 'bg-purple', event: 'bg-gold', distance: 'bg-orange'
    };
    list.innerHTML = rows.map(function (c) {
      var typeColor = TYPE_COLORS[c.type || 'checkin'] || 'bg-gray';
      var xp = Number(c.xpReward || 0);
      var target = Number(c.targetCount || 1);
      return '<div class="admin-step4-row" id="chal-row-' + escHtmlAdmin(c.id) + '">' +
        '<div class="admin-step4-thumb" style="background:' + (c.active ? 'rgba(16,185,129,.1)' : 'rgba(255,255,255,.04)') + '">' +
          '<i class="fas fa-bolt" style="color:' + (c.active ? 'var(--green)' : 'var(--ts)') + ';font-size:1.2rem"></i>' +
        '</div>' +
        '<div class="admin-step4-main">' +
          '<strong>' + escHtmlAdmin(c.title || c.name || 'Untitled') + '</strong>' +
          '<span>' +
            '<span class="badge ' + typeColor + '" style="margin-right:4px">' + escHtmlAdmin(c.type || 'checkin') + '</span>' +
            (c.active ? '<span class="badge bg-green">Active</span>' : '<span class="badge bg-gray">Inactive</span>') +
            (c.badge ? ' <span class="badge bg-purple" style="margin-left:2px"><i class="fas fa-medal"></i> ' + escHtmlAdmin(c.badgeId || (typeof c.badge === 'string' ? c.badge : 'badge')) + '</span>' : '') +
          '</span>' +
          '<p>' + escHtmlAdmin(c.description || '—') + '</p>' +
          '<span style="font-size:.7rem;color:var(--ts)">Target: <strong style="color:var(--t)">' + target + '</strong> &nbsp;·&nbsp; XP: <strong style="color:var(--gold)">+' + xp + '</strong>' +
            (c.city ? ' &nbsp;·&nbsp; ' + escHtmlAdmin(c.city) : '') +
          '</span>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0">' +
          '<button class="btn btn-ghost btn-xs" onclick="chalEdit(\'' + escAttr(c.id) + '\')"><i class="fas fa-pen"></i> Edit</button>' +
          '<button class="btn btn-' + (c.active ? 'gold' : 'green') + ' btn-xs" onclick="chalToggleActive(\'' + escAttr(c.id) + '\',' + !c.active + ')">' +
            (c.active ? '<i class="fas fa-pause"></i> Deactivate' : '<i class="fas fa-play"></i> Activate') +
          '</button>' +
          '<button class="btn btn-red btn-xs" onclick="chalDelete(\'' + escAttr(c.id) + '\',\'' + escAttr(c.title || c.name || 'this challenge') + '\')"><i class="fas fa-trash"></i> Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.chalFormMode = function (mode) {
    var panel = document.getElementById('chalFormPanel');
    var formTitleEl = document.getElementById('chalFormTitle');
    var form = document.getElementById('chalForm');
    var cancelBtnInForm = document.getElementById('chalCancelBtn');
    var cancelBtnInHdr = document.getElementById('chalFormCancel');
    var hiddenId = document.getElementById('chalEditId');
    var previewWrap = document.getElementById('chalBadgePreviewWrap');
    _chalEditId = null;
    if (form) form.reset();
    if (hiddenId) hiddenId.value = '';
    if (previewWrap) previewWrap.style.display = 'none';
    if (formTitleEl) formTitleEl.textContent = 'New Challenge';
    var showCancel = (mode === 'create');
    if (cancelBtnInForm) cancelBtnInForm.style.display = showCancel ? '' : 'none';
    if (cancelBtnInHdr) cancelBtnInHdr.style.display = showCancel ? '' : 'none';
    if (mode === 'create' && panel) panel.scrollIntoView({ behavior: 'smooth' });
  };

  window.chalEdit = function (id) {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) { toast('Firebase not ready', 'rgba(239,68,68,0.95)'); return; }
    fb.fs.getDoc(fb.fs.doc(fb.db, 'challenges', id)).then(function (snap) {
      if (!snap.exists()) { toast('Challenge not found', 'rgba(239,68,68,0.95)'); return; }
      var c = snap.data();
      _chalEditId = id;
      function el(i) { return document.getElementById(i); }
      var hiddenId = el('chalEditId'); if (hiddenId) hiddenId.value = id;
      var t = el('cfTitle'); if (t) t.value = c.title || c.name || '';
      var typeEl = el('cfType'); if (typeEl) typeEl.value = c.type || 'checkin';
      var categoryEl = el('cfCategory'); if (categoryEl) categoryEl.value = c.category || 'exploration';
      var desc = el('cfDesc'); if (desc) desc.value = c.description || '';
      var target = el('cfTarget'); if (target) target.value = c.targetCount || 1;
      var xp = el('cfXp'); if (xp) xp.value = c.xpReward || 0;
      var city = el('cfCity'); if (city) city.value = c.city || '';
      var start = el('cfStart'); if (start) start.value = toDateInput(c.startAt);
      var end = el('cfEnd'); if (end) end.value = toDateInput(c.endAt);
      var placeId = el('cfPlaceId'); if (placeId) placeId.value = c.placeId || '';
      var bizId = el('cfBusinessId'); if (bizId) bizId.value = c.businessId || '';
      var active = el('cfActive'); if (active) active.checked = c.active === true;
      var bId = el('cfBadgeId'); if (bId) bId.value = c.badgeId || (typeof c.badge === 'string' ? c.badge : '') || '';
      var bTitle = el('cfBadgeTitle'); if (bTitle) bTitle.value = c.badgeTitle || '';
      var bIcon = el('cfBadgeIcon'); if (bIcon) bIcon.value = c.badgeIcon || '';
      var bRarity = el('cfBadgeRarity'); if (bRarity) bRarity.value = c.badgeRarity || 'common';
      var bDesc = el('cfBadgeDesc'); if (bDesc) bDesc.value = c.badgeDescription || '';
      var sort = el('cfSort'); if (sort) sort.value = c.sortOrder || 0;
      var formTitleEl = el('chalFormTitle'); if (formTitleEl) formTitleEl.textContent = 'Edit Challenge';
      var cancelBtnInForm = el('chalCancelBtn'); if (cancelBtnInForm) cancelBtnInForm.style.display = '';
      var cancelBtnInHdr = el('chalFormCancel'); if (cancelBtnInHdr) cancelBtnInHdr.style.display = '';
      window.chalBadgePreview();
      var panel = el('chalFormPanel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth' });
    }).catch(function (err) {
      toast('Load failed: ' + err.message, 'rgba(239,68,68,0.95)');
    });
  };

  window.chalBadgePreview = function () {
    var badgeId = ((document.getElementById('cfBadgeId') || {}).value || '').trim();
    var bTitle = (document.getElementById('cfBadgeTitle') || {}).value || badgeId;
    var bIcon = ((document.getElementById('cfBadgeIcon') || {}).value || '').trim() || 'fa-medal';
    var bRarity = ((document.getElementById('cfBadgeRarity') || {}).value) || 'common';
    var bDesc = (document.getElementById('cfBadgeDesc') || {}).value || '';
    var wrap = document.getElementById('chalBadgePreviewWrap');
    if (!wrap) return;
    if (!badgeId) { wrap.style.display = 'none'; return; }
    var rc = BADGE_RARITY_COLORS[bRarity] || '#94a3b8';
    wrap.style.display = 'block';
    var iconEl = document.getElementById('chalBadgePreviewIcon');
    if (iconEl) { iconEl.style.color = rc; iconEl.innerHTML = '<i class="fas ' + escHtmlAdmin(bIcon) + '"></i>'; }
    var titleEl = document.getElementById('chalBadgePreviewTitle');
    if (titleEl) titleEl.textContent = bTitle || badgeId;
    var descEl = document.getElementById('chalBadgePreviewDesc');
    if (descEl) descEl.textContent = bDesc || 'GeoHub achievement';
    var rarityEl = document.getElementById('chalBadgePreviewRarity');
    if (rarityEl) { rarityEl.textContent = bRarity; rarityEl.style.color = rc; }
  };

  window.chalToggleActive = function (id, newActive) {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) { toast('Firebase not ready', 'rgba(239,68,68,0.95)'); return; }
    fb.fs.updateDoc(fb.fs.doc(fb.db, 'challenges', id), { active: newActive, updatedAt: fb.fs.serverTimestamp() })
      .then(function () { toast(newActive ? 'Challenge activated' : 'Challenge deactivated'); })
      .catch(function (err) { toast('Update failed: ' + err.message, 'rgba(239,68,68,0.95)'); });
  };

  window.chalDelete = function (id, name) {
    if (!confirm('Delete challenge "' + name + '"?\nThis cannot be undone.')) return;
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) { toast('Firebase not ready', 'rgba(239,68,68,0.95)'); return; }
    fb.fs.deleteDoc(fb.fs.doc(fb.db, 'challenges', id))
      .then(function () { toast('Challenge deleted'); })
      .catch(function (err) { toast('Delete failed: ' + err.message, 'rgba(239,68,68,0.95)'); });
  };

  function bindChallengeStudio() {
    var form = document.getElementById('chalForm');
    if (!form || form._wired) return;
    form._wired = true;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fb = window.GeoFirebase;
      if (!fb || !fb.db || !fb.fs) { toast('Firebase not ready', 'rgba(239,68,68,0.95)'); return; }
      var db = fb.db, fs = fb.fs;
      var user = fb.auth && fb.auth.currentUser;
      if (!user) { toast('Admin login required', 'rgba(239,68,68,0.95)'); return; }

      var titleVal = ((document.getElementById('cfTitle') || {}).value || '').trim();
      if (!titleVal) { toast('Title is required', 'rgba(239,68,68,0.95)'); return; }

      var target = Math.max(1, parseInt(((document.getElementById('cfTarget') || {}).value || '1'), 10) || 1);
      var xpVal = Math.max(0, parseInt(((document.getElementById('cfXp') || {}).value || '0'), 10) || 0);
      var startVal = (document.getElementById('cfStart') || {}).value || '';
      var endVal = (document.getElementById('cfEnd') || {}).value || '';
      var badgeId = ((document.getElementById('cfBadgeId') || {}).value || '').trim();
      var cityVal = ((document.getElementById('cfCity') || {}).value || '').trim();
      var placeVal = ((document.getElementById('cfPlaceId') || {}).value || '').trim();
      var bizVal = ((document.getElementById('cfBusinessId') || {}).value || '').trim();

      var doc = {
        title: titleVal,
        name: titleVal,
        description: ((document.getElementById('cfDesc') || {}).value || '').trim(),
        type: (document.getElementById('cfType') || {}).value || 'checkin',
        category: (document.getElementById('cfCategory') || {}).value || 'exploration',
        targetCount: target,
        xpReward: xpVal,
        city: cityVal || null,
        placeId: placeVal || null,
        businessId: bizVal || null,
        active: !!((document.getElementById('cfActive') || {}).checked),
        sortOrder: parseInt(((document.getElementById('cfSort') || {}).value || '0'), 10) || 0,
        updatedAt: fs.serverTimestamp()
      };
      if (startVal) doc.startAt = new Date(startVal).getTime();
      if (endVal) doc.endAt = new Date(endVal).getTime();
      if (badgeId) {
        doc.badge = true;
        doc.badgeId = badgeId;
        doc.badgeTitle = ((document.getElementById('cfBadgeTitle') || {}).value || '').trim() || titleVal;
        doc.badgeIcon = ((document.getElementById('cfBadgeIcon') || {}).value || '').trim() || 'fa-medal';
        doc.badgeRarity = (document.getElementById('cfBadgeRarity') || {}).value || 'common';
        doc.badgeDescription = ((document.getElementById('cfBadgeDesc') || {}).value || '').trim();
      } else {
        doc.badge = false;
        doc.badgeId = null;
      }

      var btn = document.getElementById('chalSaveBtn');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

      var editId = (document.getElementById('chalEditId') || {}).value || '';
      var op;
      if (editId) {
        op = fs.setDoc(fs.doc(db, 'challenges', editId), doc, { merge: true });
      } else {
        doc.createdAt = fs.serverTimestamp();
        doc.createdBy = user.uid;
        op = fs.addDoc(fs.collection(db, 'challenges'), doc);
      }

      op.then(function (ref) {
        var challengeId = editId || (ref && ref.id) || '';
        if (badgeId) {
          return fs.setDoc(fs.doc(db, 'badges', badgeId), {
            title: doc.badgeTitle,
            description: doc.badgeDescription || '',
            icon: doc.badgeIcon,
            rarity: doc.badgeRarity || 'common',
            xpBonus: 0,
            challengeId: challengeId,
            createdAt: fs.serverTimestamp(),
            updatedAt: fs.serverTimestamp()
          }, { merge: true });
        }
      }).then(function () {
        toast(editId ? 'Challenge updated' : 'Challenge created: ' + titleVal);
        window.chalFormMode('none');
      }).catch(function (err) {
        console.error('[Admin] chalForm', err);
        toast('Save failed: ' + err.message, 'rgba(239,68,68,0.95)');
      }).finally(function () {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save challenge'; }
      });
    });
  }

  /* ── REWARDS STUDIO ─────────────────────────────────────── */
  var _rwEditId = null;

  function loadAdminRewards() {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) return;
    var f = fb.fs, db = fb.db;

    // Load all rewards (active + inactive)
    f.getDocs(f.query(f.collection(db, 'rewards'), f.limit(200))).then(function (snap) {
      var rows = [];
      snap.forEach(function (d) { rows.push(Object.assign({ id: d.id }, d.data())); });
      rows.sort(function (a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); });

      var el = document.getElementById('sb-rewards');
      if (el) el.textContent = rows.length;
      var sub = document.getElementById('rewardsSubtitle');
      if (sub) sub.textContent = rows.length + ' rewards in store';

      var list = document.getElementById('rwList');
      if (!list) return;
      if (!rows.length) {
        list.innerHTML = '<div style="text-align:center;padding:28px;color:var(--ts);font-size:.82rem">No rewards yet. Click "New Reward" to add one.</div>';
        return;
      }
      list.innerHTML = '<div class="bl">' + rows.map(function (r) {
        var stock = r.stock != null ? String(r.stock) + ' left' : '∞ unlimited';
        var cost = Number(r.cost || r.pointsCost || 0);
        var activeStyle = r.active ? 'color:var(--green)' : 'color:var(--red)';
        var expMs = r.expiresAt ? (r.expiresAt.toMillis ? r.expiresAt.toMillis() : (r.expiresAt.seconds ? r.expiresAt.seconds * 1000 : Number(r.expiresAt))) : 0;
        var expLabel = expMs ? ' &nbsp;·&nbsp; Exp: ' + new Date(expMs).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        var bizLabel = r.businessName ? ' &nbsp;·&nbsp; <i class="fas fa-store" style="font-size:.65rem"></i> ' + escHtmlAdmin(r.businessName) : '';
        return '<div class="bi" style="display:flex;align-items:center;gap:12px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700;font-size:.88rem">' + escHtmlAdmin(r.title || 'Untitled') + '</div>' +
            '<div style="font-size:.72rem;color:var(--ts);margin-top:2px">' +
              escHtmlAdmin(r.category || 'other') + ' &nbsp;·&nbsp; ' +
              '<span style="color:var(--gold);font-weight:700">' + cost + ' pts</span>' +
              ' &nbsp;·&nbsp; ' + escHtmlAdmin(stock) +
              ' &nbsp;·&nbsp; <span style="' + activeStyle + ';font-weight:700">' + (r.active ? 'Active' : 'Inactive') + '</span>' +
              bizLabel + expLabel +
            '</div>' +
          '</div>' +
          '<button class="btn btn-ghost btn-sm" onclick="rwEdit(\'' + escAttr(r.id) + '\')"><i class="fas fa-edit"></i></button>' +
          '<button class="btn btn-ghost btn-sm" onclick="rwToggleActive(\'' + escAttr(r.id) + '\',' + (r.active ? 'false' : 'true') + ')" title="' + (r.active ? 'Deactivate' : 'Activate') + '"><i class="fas ' + (r.active ? 'fa-eye-slash' : 'fa-eye') + '"></i></button>' +
          '<button class="btn btn-ghost btn-sm" onclick="rwDelete(\'' + escAttr(r.id) + '\')" style="color:var(--red)"><i class="fas fa-trash"></i></button>' +
        '</div>';
      }).join('') + '</div>';
    }).catch(function (err) {
      console.error('[Admin] loadAdminRewards', err);
    });

    // Load recent transactions
    f.getDocs(f.query(f.collection(db, 'pointTransactions'), f.orderBy('createdAt', 'desc'), f.limit(50)))
      .then(function (snap) {
        var txList = document.getElementById('rwTxList');
        if (!txList) return;
        if (snap.empty) {
          txList.innerHTML = '<div style="text-align:center;padding:28px;color:var(--ts);font-size:.82rem">No point transactions yet.</div>';
          return;
        }
        var rows = [];
        snap.forEach(function (d) {
          var data = d.data();
          var typeLabel = (data.type === 'gift' || data.type === 'transfer_sent') ? '<span style="color:var(--green)">Transfer</span>'
            : data.type === 'redeem' ? '<span style="color:var(--blue)">Redeem</span>'
            : data.type === 'admin_adjustment' ? '<span style="color:var(--gold)">Admin Adj.</span>'
            : '<span style="color:var(--ts)">' + escHtmlAdmin(data.type || 'tx') + '</span>';
          rows.push('<div class="bi" style="display:flex;align-items:center;gap:12px">' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-size:.78rem;font-weight:700">' + typeLabel + ' &nbsp;' +
                '<span style="color:var(--gold);font-weight:800">' + Number(data.amount || 0) + ' pts</span>' +
                (data.rewardTitle ? ' &nbsp;·&nbsp; ' + escHtmlAdmin(data.rewardTitle) : '') +
                (data.message ? ' &nbsp;·&nbsp; <em style="color:var(--ts)">' + escHtmlAdmin(String(data.message).slice(0, 50)) + '</em>' : '') +
              '</div>' +
              '<div style="font-size:.67rem;color:var(--ts);margin-top:2px">' +
                'from: <code style="font-size:.67rem">' + escHtmlAdmin((data.fromUserId || '').slice(0, 14)) + '…</code>' +
                (data.toUserId ? ' → to: <code style="font-size:.67rem">' + escHtmlAdmin((data.toUserId || '').slice(0, 14)) + '…</code>' : '') +
              '</div>' +
            '</div>' +
          '</div>');
        });
        txList.innerHTML = '<div class="bl">' + rows.join('') + '</div>';
      }).catch(function (err) {
        var txList = document.getElementById('rwTxList');
        if (txList) txList.innerHTML = '<div style="text-align:center;padding:28px;color:var(--ts);font-size:.72rem">Could not load transactions — index may be building.<br>Try again in a moment.</div>';
        console.warn('[Admin] txList', err && err.message);
      });
  }

  window.rwFormMode = function (mode) {
    var form = document.getElementById('rwForm');
    var formTitle = document.getElementById('rwFormTitle');
    if (!form) return;
    if (mode === 'none') {
      form.style.display = 'none';
      _rwEditId = null;
      var el = document.getElementById('rwEditId'); if (el) el.value = '';
      var f = document.getElementById('rwFormEl'); if (f) f.reset();
      return;
    }
    form.style.display = '';
    if (formTitle) formTitle.textContent = mode === 'create' ? 'Create Reward' : 'Edit Reward';
    if (mode === 'create') {
      _rwEditId = null;
      var el = document.getElementById('rwEditId'); if (el) el.value = '';
      var f = document.getElementById('rwFormEl'); if (f) f.reset();
      var active = document.getElementById('rwActive'); if (active) active.checked = true;
    }
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.rwEdit = function (id) {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) return;
    fb.fs.getDoc(fb.fs.doc(fb.db, 'rewards', id)).then(function (snap) {
      if (!snap.exists()) { toast('Reward not found', 'rgba(239,68,68,.95)'); return; }
      var c = Object.assign({ id: snap.id }, snap.data());
      _rwEditId = id;
      window.rwFormMode('edit');
      var set = function (elId, val) { var el = document.getElementById(elId); if (el) el.value = val != null ? val : ''; };
      set('rwEditId', id);
      set('rwTitle', c.title || '');
      set('rwDesc', c.description || '');
      set('rwCost', c.cost || c.pointsCost || '');
      set('rwStock', c.stock != null ? c.stock : '');
      set('rwSort', c.sortOrder || '0');
      set('rwImage', c.imageUrl || '');
      set('rwTerms', c.termsNote || '');
      set('rwCategory', c.category || 'other');
      var active = document.getElementById('rwActive'); if (active) active.checked = !!c.active;
      // Business-linked fields
      var expMs = c.expiresAt ? (c.expiresAt.toMillis ? c.expiresAt.toMillis() : (c.expiresAt.seconds ? c.expiresAt.seconds * 1000 : Number(c.expiresAt))) : 0;
      set('rwExpiresAt', expMs ? new Date(expMs).toISOString().slice(0, 10) : '');
      set('rwBusinessId', c.businessId || '');
      set('rwBusinessName', c.businessName || '');
      set('rwOwnerId', c.ownerId || '');
    }).catch(function (err) {
      toast('Load failed: ' + err.message, 'rgba(239,68,68,.95)');
    });
  };

  window.rwToggleActive = function (id, makeActive) {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) return;
    fb.fs.setDoc(fb.fs.doc(fb.db, 'rewards', id), { active: makeActive, updatedAt: fb.fs.serverTimestamp() }, { merge: true })
      .then(function () {
        toast(makeActive ? 'Reward activated' : 'Reward deactivated');
        loadAdminRewards();
      }).catch(function (err) { toast('Failed: ' + err.message, 'rgba(239,68,68,.95)'); });
  };

  window.rwDelete = function (id) {
    if (!confirm('Delete this reward permanently?')) return;
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) return;
    fb.fs.deleteDoc(fb.fs.doc(fb.db, 'rewards', id))
      .then(function () { toast('Reward deleted'); loadAdminRewards(); })
      .catch(function (err) { toast('Delete failed: ' + err.message, 'rgba(239,68,68,.95)'); });
  };

  function bindRewardsStudio() {
    var form = document.getElementById('rwFormEl');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fb = window.GeoFirebase;
      if (!fb || !fb.db || !fb.fs) return;
      var user = (window.GeoAuth && window.GeoAuth.getCurrentUser && window.GeoAuth.getCurrentUser())
        || (fb.auth && fb.auth.currentUser);
      if (!user) { toast('Not logged in', 'rgba(239,68,68,.95)'); return; }

      var f = fb.fs, db = fb.db;

      var title = ((document.getElementById('rwTitle') || {}).value || '').trim();
      var desc = ((document.getElementById('rwDesc') || {}).value || '').trim();
      var cost = parseInt(((document.getElementById('rwCost') || {}).value || '0'), 10) || 0;
      var stockRaw = ((document.getElementById('rwStock') || {}).value || '').trim();
      var sort = parseInt(((document.getElementById('rwSort') || {}).value || '0'), 10) || 0;
      var image = ((document.getElementById('rwImage') || {}).value || '').trim();
      var terms = ((document.getElementById('rwTerms') || {}).value || '').trim();
      var category = (document.getElementById('rwCategory') || {}).value || 'other';
      var active = !!((document.getElementById('rwActive') || {}).checked);
      var expiresDateStr = ((document.getElementById('rwExpiresAt') || {}).value || '').trim();
      var businessId = ((document.getElementById('rwBusinessId') || {}).value || '').trim();
      var businessName = ((document.getElementById('rwBusinessName') || {}).value || '').trim();
      var ownerId = ((document.getElementById('rwOwnerId') || {}).value || '').trim();

      if (!title) { toast('Title is required', 'rgba(239,68,68,.95)'); return; }
      if (cost < 1) { toast('Points cost must be at least 1', 'rgba(239,68,68,.95)'); return; }

      var doc = {
        title: title,
        description: desc || null,
        category: category,
        cost: cost,
        pointsCost: cost,
        stock: stockRaw !== '' ? parseInt(stockRaw, 10) : null,
        sortOrder: sort,
        imageUrl: image || null,
        termsNote: terms || null,
        active: active,
        expiresAt: expiresDateStr ? new Date(expiresDateStr) : null,
        businessId: businessId || null,
        businessName: businessName || null,
        ownerId: ownerId || null,
        updatedAt: f.serverTimestamp()
      };

      var btn = document.getElementById('rwSaveBtn');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

      var editId = (document.getElementById('rwEditId') || {}).value || '';
      var op = editId
        ? f.setDoc(f.doc(db, 'rewards', editId), doc, { merge: true })
        : (function () { doc.createdAt = f.serverTimestamp(); doc.createdBy = user.uid; return f.addDoc(f.collection(db, 'rewards'), doc); })();

      op.then(function () {
        toast(editId ? 'Reward updated' : 'Reward created: ' + title);
        window.rwFormMode('none');
        loadAdminRewards();
      }).catch(function (err) {
        console.error('[Admin] rwSave', err);
        toast('Save failed: ' + err.message, 'rgba(239,68,68,.95)');
      }).finally(function () {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save reward'; }
      });
    });
  }

  /* ── CONTENT MANAGER ───────────────────────────────────── */
  window.loadContentList = function () {
    var fb = window.GeoFirebase;
    if (!fb || !fb.fs || !fb.db) { toast('Firebase not ready'); return; }
    var col = ((document.getElementById('manageContentCol') || {}).value || '').trim();
    if (!col) return;
    var list = document.getElementById('manageContentList');
    if (list) list.innerHTML = '<div style="text-align:center;padding:28px;color:var(--ts)"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';

    fb.fs.getDocs(fb.fs.query(fb.fs.collection(fb.db, col), fb.fs.limit(60)))
      .then(function (snap) {
        if (!list) return;
        if (snap.empty) {
          list.innerHTML = '<div style="text-align:center;padding:28px;color:var(--ts);font-size:.82rem">No items in ' + escHtmlAdmin(col) + '.</div>';
          return;
        }
        var rows = [];
        snap.forEach(function (d) {
          var data = d.data();
          var active = data.status === 'active' || (data.active === true && data.status !== 'inactive');
          var label = escHtmlAdmin(data.title || data.name || d.id.slice(-8));
          var imgUrl = col === 'places' ? escHtmlAdmin(getPlaceImageUrl(data)) : '';
          var thumb = imgUrl
            ? '<img src="' + imgUrl + '" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0" ' +
                'onerror="this.outerHTML=\'<div style=\\\'width:36px;height:36px;border-radius:6px;background:#1e293b;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0\\\'>📍</div>\'">'
            : '';
          var editBtn = col === 'places'
            ? '<button class="btn btn-ghost btn-sm" style="font-size:.72rem" ' +
                'onclick="adminEditPlaceFromBroken(\'' + escHtmlAdmin(d.id) + '\')">' +
                '<i class="fas fa-pen"></i></button>'
            : '';
          rows.push(
            '<div class="bi" style="display:flex;align-items:center;gap:8px">' +
              thumb +
              '<div style="flex:1;min-width:0">' +
                '<div style="font-size:.82rem;font-weight:700;color:#f0f4ff">' + label + '</div>' +
                '<div style="font-size:.68rem;color:var(--ts)">' + escHtmlAdmin(d.id) + ' &nbsp;·&nbsp; ' +
                  (active ? '<span style="color:#10e0a0">active</span>' : '<span style="color:#f59e0b">inactive</span>') +
                '</div>' +
              '</div>' +
              editBtn +
              '<button class="btn btn-ghost btn-sm" onclick="adminToggleItem(\'' + escHtmlAdmin(col) + '\',\'' + escHtmlAdmin(d.id) + '\',' + (active ? 'true' : 'false') + ')">' +
                (active ? 'Deactivate' : 'Activate') +
              '</button>' +
              '<button class="btn btn-ghost btn-sm" style="color:#ef4444;border-color:rgba(239,68,68,.35)" ' +
                'onclick="adminDeleteItem(\'' + escHtmlAdmin(col) + '\',\'' + escHtmlAdmin(d.id) + '\')">' +
                '<i class="fas fa-trash"></i>' +
              '</button>' +
            '</div>'
          );
        });
        list.innerHTML = '<div class="bl">' + rows.join('') + '</div>';
      }).catch(function (err) {
        if (list) list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ts);font-size:.82rem">Load failed: ' + escHtmlAdmin(err.message) + '</div>';
      });
  };

  window.adminToggleItem = function (col, id, currentlyActive) {
    var fb = window.GeoFirebase;
    if (!fb || !fb.fs) return;
    var newStatus = currentlyActive ? 'inactive' : 'active';
    fb.fs.setDoc(fb.fs.doc(fb.db, col, id), { status: newStatus, active: !currentlyActive, updatedAt: fb.fs.serverTimestamp() }, { merge: true })
      .then(function () {
        toast((currentlyActive ? 'Deactivated' : 'Activated') + ': ' + id.slice(-6));
        window.loadContentList();
      }).catch(function (err) { toast('Toggle failed: ' + err.message); });
  };

  /* ── PLACE EDIT MODE ─────────────────────────────────────── */
  window.adminEditPlace = function(placeId, data) {
    if (!placeId || !data) return;
    _editingPlaceId = placeId;

    // Switch collection selector to 'places'
    var colSel = document.getElementById('adminContentCollection');
    if (colSel) { colSel.value = 'places'; colSel.dispatchEvent(new Event('change')); }
    togglePlaceCategoryUI('places');

    // Populate form fields
    var set = function(id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; };
    set('adminContentTitle',    data.name || data.title || '');
    set('adminContentDesc',     data.shortDescription || data.description || '');
    set('adminContentCity',     data.city || '');
    set('adminContentImage',    getPlaceImageUrl(data));
    set('adminContentCategory', data.category || '');

    // Extended fields (lat, lng, district, address, region, sourceUrl, etc.)
    var extMap = { adminPlaceLat: 'lat', adminPlaceLng: 'lng', adminPlaceDistrict: 'district',
                   adminPlaceAddress: 'address', adminPlaceRegion: 'region',
                   adminPlaceSourceUrl: 'sourceUrl', adminPlaceShortDesc: 'shortDescription' };
    Object.keys(extMap).forEach(function(id) {
      var el = document.getElementById(id);
      if (el && data[extMap[id]] !== undefined) el.value = data[extMap[id]];
    });
    // isVerified / status via ext fields
    var statEl = document.getElementById('adminPlaceStatus');
    if (statEl) statEl.value = data.status || 'active';
    var verEl = document.getElementById('adminPlaceIsVerified');
    if (verEl) verEl.value = data.isVerified ? 'true' : 'false';

    // Icon field — mark as user-edited only if a custom icon was explicitly saved
    var iconEl2 = document.getElementById('adminPlaceIcon');
    if (iconEl2) {
      iconEl2.value = data.icon || '';
      if (data.icon) { iconEl2.dataset.userEdited = '1'; } else { delete iconEl2.dataset.userEdited; }
    }
    var iconPreview2 = document.getElementById('adminPlaceIconPreview');
    if (iconPreview2) iconPreview2.textContent = data.icon || '';

    // Google Place ID
    var gPlaceEl = document.getElementById('adminGooglePlaceIdInput');
    if (gPlaceEl) gPlaceEl.value = data.googlePlaceId || '';
    var gPreviewPanel = document.getElementById('adminGooglePreviewPanel');
    if (gPreviewPanel) { gPreviewPanel.style.display = 'none'; gPreviewPanel.innerHTML = ''; }
    var gSearchPanel = document.getElementById('adminGoogleSearchResults');
    if (gSearchPanel) { gSearchPanel.style.display = 'none'; gSearchPanel.innerHTML = ''; }

    // Category dropdowns
    populatePlaceCategorySelect(data.categoryId || '');
    if (data.categoryId) populatePlaceSubcategorySelect(data.categoryId, data.subcategory || '');
    syncPlaceSubcategories();

    // Update submit button and show edit indicator
    var btn = document.querySelector('#adminContentForm button[type="submit"]');
    if (btn) btn.innerHTML = '<i class="fas fa-save"></i> Update Place';

    var editBar = document.getElementById('adminEditPlaceBar');
    if (!editBar) {
      editBar = document.createElement('div');
      editBar.id = 'adminEditPlaceBar';
      editBar.style.cssText = 'background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.35);border-radius:10px;padding:8px 14px;margin-bottom:12px;font-size:.82rem;color:#a5b4fc;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap';
      var form = document.getElementById('adminContentForm');
      if (form) form.insertBefore(editBar, form.firstChild);
    }
    editBar.innerHTML =
      '<span><i class="fas fa-pen"></i> რედაქტირება: <strong>' + escHtmlAdmin(data.name || data.title || placeId) + '</strong></span>' +
      '<button type="button" class="btn btn-ghost btn-sm" style="font-size:.75rem;color:#94a3b8" onclick="adminCancelEditPlace()">გაუქმება</button>';
    editBar.style.display = 'flex';

    // Image preview in form
    adminUpdateImagePreview(getPlaceImageUrl(data));
  };

  window.adminCancelEditPlace = function() {
    _editingPlaceId = null;
    var editBar = document.getElementById('adminEditPlaceBar');
    if (editBar) editBar.style.display = 'none';
    var btn = document.querySelector('#adminContentForm button[type="submit"]');
    if (btn) btn.innerHTML = '<i class="fas fa-plus"></i> Create real item';
    var form = document.getElementById('adminContentForm');
    if (form) { form.reset(); renderExtFields('places'); }
    adminUpdateImagePreview('');
    var iconElC = document.getElementById('adminPlaceIcon');
    if (iconElC) { iconElC.value = ''; delete iconElC.dataset.userEdited; }
    var iconPrevC = document.getElementById('adminPlaceIconPreview');
    if (iconPrevC) iconPrevC.textContent = '';
    var gPlaceEl = document.getElementById('adminGooglePlaceIdInput');
    if (gPlaceEl) gPlaceEl.value = '';
    var gPreviewPanel = document.getElementById('adminGooglePreviewPanel');
    if (gPreviewPanel) { gPreviewPanel.style.display = 'none'; gPreviewPanel.innerHTML = ''; }
    var gSearchPanel = document.getElementById('adminGoogleSearchResults');
    if (gSearchPanel) { gSearchPanel.style.display = 'none'; gSearchPanel.innerHTML = ''; }
    _editingPlaceId = null;
  };

  function adminUpdateImagePreview(url) {
    var wrap = document.getElementById('adminImgPreviewWrap');
    if (!wrap) return;
    if (!url) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    var img = wrap.querySelector('img');
    var ph  = wrap.querySelector('.admin-img-ph');
    if (img) {
      img.src = url;
      img.onerror = function() { this.style.display = 'none'; if (ph) ph.style.display = 'flex'; };
      img.onload  = function() { this.style.display = ''; if (ph) ph.style.display = 'none'; };
    }
  }

  window.adminTestImageUrl = function() {
    var imgEl = document.getElementById('adminContentImage');
    if (!imgEl) return;
    var url = imgEl.value.trim();
    if (!url) { toast('URL ჩაწერეთ'); return; }
    toast('შემოწმება…');
    testImageLoad(url).then(function(ok) {
      toast(ok ? '✓ ფოტო ჩაიტვირთა' : '✗ ფოტო ვერ ჩაიტვირთა');
      adminUpdateImagePreview(url);
    });
  };

  window.adminFetchGooglePreview = function() {
    var idEl  = document.getElementById('adminGooglePlaceIdInput');
    var panel = document.getElementById('adminGooglePreviewPanel');
    if (!idEl) return;
    var placeId = idEl.value.trim();
    if (!placeId) { toast('Google Place ID ჩაწერეთ'); return; }
    if (panel) { panel.style.display = 'block'; panel.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ჩატვირთვა…'; }
    var workerUrl = (window.GeoConfig && window.GeoConfig.PAYMENTS && window.GeoConfig.PAYMENTS.WORKER_URL) || '';
    fetch(workerUrl + '/api/google-place-details?placeId=' + encodeURIComponent(placeId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!panel) return;
        if (data.error) {
          panel.innerHTML = '<span style="color:#f87171"><i class="fas fa-exclamation-triangle"></i> ' + escHtmlAdmin(data.error) + '</span>';
          return;
        }
        var html = '<strong>' + escHtmlAdmin(data.name) + '</strong>';
        if (data.address) html += '<br><span style="color:#94a3b8">' + escHtmlAdmin(data.address) + '</span>';
        if (data.rating) {
          html += '<br>⭐ ' + data.rating + ' <span style="color:#64748b;font-size:.75rem">(' + (data.userRatingCount || 0) + ' reviews)</span>';
        }
        if (data.isOpen !== null && data.isOpen !== undefined) {
          html += ' &nbsp;<span style="color:' + (data.isOpen ? '#10b981' : '#f87171') + ';font-weight:700">' + (data.isOpen ? 'Open' : 'Closed') + '</span>';
        }
        if (data.todayHours) html += '<br><span style="color:#64748b;font-size:.75rem">' + escHtmlAdmin(data.todayHours) + '</span>';
        if (data.phone) html += '<br><i class="fas fa-phone" style="color:#64748b;width:12px"></i> ' + escHtmlAdmin(data.phone);
        if (data.website) {
          html += '<br><i class="fas fa-globe" style="color:#64748b;width:12px"></i> <a href="' + escHtmlAdmin(data.website) + '" target="_blank" rel="noopener" style="color:#818cf8">' + escHtmlAdmin(data.website.replace(/^https?:\/\//, '').slice(0, 50)) + '</a>';
        }
        if (data.photos && data.photos.length) {
          var proxyUrl = workerUrl + '/api/google-place-photo?maxWidth=300&name=' + encodeURIComponent(data.photos[0]);
          html += '<br><img src="' + escHtmlAdmin(proxyUrl) + '" style="max-height:100px;border-radius:6px;margin-top:6px;display:block" onerror="this.style.display=\'none\'">';
        }
        html += '<br><span style="color:#4b5563;font-size:.72rem">Powered by Google</span>';
        panel.innerHTML = html;
        panel.style.display = 'block';
      })
      .catch(function(err) {
        if (panel) panel.innerHTML = '<span style="color:#f87171">Fetch failed: ' + escHtmlAdmin(err.message) + '</span>';
      });
  };

  window.adminSearchGooglePlace = function() {
    var qEl  = document.getElementById('adminGoogleSearchInput');
    var rEl  = document.getElementById('adminGoogleSearchResults');
    if (!qEl) return;
    var q = qEl.value.trim();
    if (!q) { toast('საძიებო სიტყვა ჩაწერეთ'); return; }
    if (rEl) { rEl.style.display = 'block'; rEl.innerHTML = '<div style="padding:10px;font-size:.82rem"><i class="fas fa-spinner fa-spin"></i> ძიება…</div>'; }
    var workerUrl = (window.GeoConfig && window.GeoConfig.PAYMENTS && window.GeoConfig.PAYMENTS.WORKER_URL) || '';
    fetch(workerUrl + '/api/google-place-search?q=' + encodeURIComponent(q))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!rEl) return;
        if (data.error || !data.results) {
          rEl.innerHTML = '<div style="padding:10px;color:#f87171">Error: ' + escHtmlAdmin(data.error || 'Unknown') + '</div>';
          return;
        }
        if (!data.results.length) {
          rEl.innerHTML = '<div style="padding:10px;font-size:.82rem;opacity:.5">No results found</div>';
          return;
        }
        rEl.innerHTML = data.results.map(function(r) {
          return '<div style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:8px">'
            + '<div style="flex:1;min-width:0;font-size:.82rem">'
            + '<div style="font-weight:700">' + escHtmlAdmin(r.name) + '</div>'
            + '<div style="color:#94a3b8;font-size:.75rem">' + escHtmlAdmin(r.address) + '</div>'
            + (r.rating ? '<div style="color:#f59e0b;font-size:.75rem">⭐ ' + r.rating + '</div>' : '')
            + '<div style="color:#4b5563;font-size:.72rem;margin-top:2px">' + escHtmlAdmin(r.id) + '</div>'
            + '</div>'
            + '<button type="button" class="btn btn-ghost btn-sm" style="font-size:.75rem;white-space:nowrap" onclick="adminUseGooglePlaceId(' + JSON.stringify(r.id) + ')">Use</button>'
            + '</div>';
        }).join('');
      })
      .catch(function(err) {
        if (rEl) rEl.innerHTML = '<div style="padding:10px;color:#f87171">Fetch failed: ' + escHtmlAdmin(err.message) + '</div>';
      });
  };

  window.adminUseGooglePlaceId = function(placeId) {
    var idEl = document.getElementById('adminGooglePlaceIdInput');
    if (idEl) idEl.value = placeId;
    var rEl = document.getElementById('adminGoogleSearchResults');
    if (rEl) { rEl.style.display = 'none'; rEl.innerHTML = ''; }
    window.adminFetchGooglePreview();
  };

  window.adminDeleteItem = function (col, id) {
    if (!confirm('Delete this item permanently from ' + col + '? This cannot be undone.')) return;
    var fb = window.GeoFirebase;
    if (!fb || !fb.fs) return;
    fb.fs.deleteDoc(fb.fs.doc(fb.db, col, id))
      .then(function () {
        toast('Deleted: ' + id.slice(-6));
        window.loadContentList();
      }).catch(function (err) { toast('Delete failed: ' + err.message); });
  };

  /* ── ADMIN ADJUST POINTS ────────────────────────────────── */
  window.doAdminAdjust = function () {
    var fb = window.GeoFirebase;
    if (!fb || !fb.functions || !fb.httpsCallable) { toast('Firebase not ready', 'rgba(239,68,68,.95)'); return; }

    var userId = ((document.getElementById('adjUserId') || {}).value || '').trim();
    var amtRaw = ((document.getElementById('adjAmount') || {}).value || '').trim();
    var reason = ((document.getElementById('adjReason') || {}).value || '').trim();

    if (!userId) { toast('User ID is required', 'rgba(239,68,68,.95)'); return; }
    var amount = parseInt(amtRaw, 10);
    if (isNaN(amount) || amount === 0) { toast('Amount must be a non-zero integer', 'rgba(239,68,68,.95)'); return; }
    if (!reason) { toast('Reason is required', 'rgba(239,68,68,.95)'); return; }

    var btn = document.getElementById('adjBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying…'; }

    fb.httpsCallable(fb.functions, 'adminAdjustPoints')({ userId: userId, amount: amount, reason: reason })
      .then(function (result) {
        var d = result.data || result;
        toast('Adjusted: ' + (amount > 0 ? '+' : '') + amount + ' pts. New balance: ' + d.newBalance + ' pts');
        var el = document.getElementById('adjUserId'); if (el) el.value = '';
        var el2 = document.getElementById('adjAmount'); if (el2) el2.value = '';
        var el3 = document.getElementById('adjReason'); if (el3) el3.value = '';
        loadAdminRewards();
      }).catch(function (err) {
        console.error('[Admin] adminAdjustPoints', err);
        var msg = (err.message || '').replace(/^Firebase:\s*/i, '').replace(/\s*\(functions\/[^)]+\)\.?$/, '');
        toast(msg || 'Adjustment failed', 'rgba(239,68,68,.95)');
      }).finally(function () {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sliders-h"></i> Apply Adjustment'; }
      });
  };

  /* ── ANALYTICS DASHBOARD ─────────────────────────────────── */
  function getDateStr(daysAgo) {
    var d = new Date(Date.now() - daysAgo * 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function escA(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function renderTopPages(data) {
    var el = document.getElementById('an-top-pages');
    if (!el) return;
    var entries = Object.keys(data).filter(function (k) { return k !== '_total'; })
      .map(function (k) { return { page: k, count: data[k] }; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, 8);
    if (!entries.length) { el.innerHTML = '<div style="padding:16px;text-align:center;opacity:0.5">No data yet</div>'; return; }
    var max = entries[0].count || 1;
    el.innerHTML = entries.map(function (e) {
      var pct = Math.round((e.count / max) * 100);
      return '<div style="margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;font-size:0.76rem;margin-bottom:3px">' +
          '<span style="color:var(--t)">' + escA(e.page) + '</span>' +
          '<span style="color:var(--green);font-weight:700">' + e.count + '</span>' +
        '</div>' +
        '<div style="height:5px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden">' +
          '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#10b981,#3b82f6);border-radius:3px;transition:width 0.6s ease"></div>' +
        '</div></div>';
    }).join('');
  }

  function renderTopSearches(data) {
    var el = document.getElementById('an-top-searches');
    if (!el) return;
    var entries = Object.keys(data).filter(function (k) { return k !== '_count'; })
      .map(function (k) { return { term: k.replace(/^t_/, '').replace(/_/g, ' '), count: data[k] }; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, 8);
    if (!entries.length) { el.innerHTML = '<div style="padding:16px;text-align:center;opacity:0.5">No searches yet</div>'; return; }
    el.innerHTML = entries.map(function (e) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">' +
        '<span style="color:var(--t);font-size:0.8rem">' + escA(e.term) + '</span>' +
        '<span style="color:var(--ts);font-size:0.74rem;font-weight:700">' + e.count + 'x</span>' +
      '</div>';
    }).join('');
  }

  function render7DayTrend(days) {
    var el = document.getElementById('an-trend');
    if (!el) return;
    var totals = days.map(function (d) { return d._total || 0; });
    var max = Math.max.apply(null, totals) || 1;
    el.innerHTML = days.map(function (d, i) {
      var h = Math.max(6, Math.round((d._total || 0) / max * 72));
      var label = getDateStr(6 - i).slice(5);
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">' +
        '<div style="font-size:0.65rem;color:var(--ts)">' + (d._total || 0) + '</div>' +
        '<div style="width:100%;border-radius:3px 3px 0 0;background:linear-gradient(180deg,#10b981,#3b82f6);height:' + h + 'px"></div>' +
        '<div style="font-size:0.62rem;color:var(--ts)">' + label + '</div>' +
      '</div>';
    }).join('');
  }

  function renderPerf(data) {
    var el = document.getElementById('an-perf');
    if (!el) return;
    if (!data || !data.samples) { el.innerHTML = '<div style="padding:12px;opacity:0.5">No performance data yet</div>'; return; }
    var s = data.samples;
    var ttfb    = s && data.sum_ttfb    ? Math.round(data.sum_ttfb / s)    : '—';
    var domLoad = s && data.sum_domLoad ? Math.round(data.sum_domLoad / s) : '—';
    var lcp     = s && data.sum_lcp     ? Math.round(data.sum_lcp / s)     : '—';
    var total   = s && data.sum_total   ? Math.round(data.sum_total / s)   : '—';
    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">' +
      ['TTFB', ttfb, 'DOM Load', domLoad, 'LCP', lcp, 'Total', total].reduce(function (acc, v, i) {
        if (i % 2 === 0) acc.push('<div style="text-align:center">');
        if (i % 2 === 0) acc.push('<div style="font-size:1.1rem;font-weight:800;color:var(--green)">' + v + '</div>');
        else acc.push('<div style="font-size:0.7rem;color:var(--ts)">' + v + ' ms</div></div>');
        return acc;
      }, []).join('') +
    '</div>';
  }

  function loadAdminAnalytics() {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) {
      window.addEventListener('GeoFirebaseReady', function () { loadAdminAnalytics(); }, { once: true });
      return;
    }
    var db = fb.db, fs = fb.fs;
    var today = getDateStr(0);
    var subEl = document.getElementById('analyticsSub');
    if (subEl) subEl.textContent = 'Loading…';

    var pvEl = document.getElementById('an-pv');
    var onlineEl = document.getElementById('an-online');
    var searchEl = document.getElementById('an-searches');
    var evEl = document.getElementById('an-events');

    Promise.all([
      fs.getDoc(fs.doc(db, 'analytics', 'pageViews', 'daily', today)),
      fs.getDoc(fs.doc(db, 'analytics', 'searches', 'daily', today)),
      fs.getDoc(fs.doc(db, 'analytics', 'events', 'daily', today)),
      fs.getDoc(fs.doc(db, 'analytics', 'performance', 'pages', 'index.html')),
      fs.getDocs(fs.query(
        fs.collection(db, 'analytics', 'presence', 'users'),
        fs.where('lastSeen', '>', new Date(Date.now() - 5 * 60 * 1000))
      ))
    ]).then(function (res) {
      var pvData   = res[0].exists() ? res[0].data() : {};
      var srData   = res[1].exists() ? res[1].data() : {};
      var evData   = res[2].exists() ? res[2].data() : {};
      var perfData = res[3].exists() ? res[3].data() : null;
      var onlineCount = res[4].size;

      var pvTotal = pvData._total || 0;
      var srTotal = srData._count || 0;
      var evTotal = Object.keys(evData).reduce(function (s, k) { return s + (evData[k] || 0); }, 0);

      if (pvEl)     pvEl.textContent     = pvTotal;
      if (onlineEl) onlineEl.textContent = onlineCount;
      if (searchEl) searchEl.textContent = srTotal;
      if (evEl)     evEl.textContent     = evTotal;
      if (subEl)    subEl.textContent    = 'Updated ' + new Date().toLocaleTimeString();

      var sbEl = document.getElementById('sb-analytics');
      if (sbEl) sbEl.textContent = pvTotal || '0';

      renderTopPages(pvData);
      renderTopSearches(srData);
      renderPerf(perfData);

      var trendPromises = [];
      for (var i = 6; i >= 0; i--) {
        trendPromises.push(fs.getDoc(fs.doc(db, 'analytics', 'pageViews', 'daily', getDateStr(i))));
      }
      Promise.all(trendPromises).then(function (snaps) {
        var days = snaps.map(function (s) { return s.exists() ? s.data() : {}; });
        render7DayTrend(days);
      }).catch(function () {});
    }).catch(function (err) {
      if (subEl) subEl.textContent = 'Load failed — check Firestore rules';
      console.warn('[Admin] analytics', err && err.message);
    });
  }

  /* ── ERROR MONITOR ────────────────────────────────────────── */
  function renderErrorLog(docs) {
    var el = document.getElementById('err-log');
    if (!el) return;
    if (!docs.length) {
      el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--ts);font-size:0.8rem"><i class="fas fa-check-circle" style="color:#10b981;margin-right:6px"></i>No JS errors logged</div>';
      return;
    }
    el.innerHTML = docs.map(function (d) {
      var ts = d.timestamp ? (d.timestamp.toDate ? d.timestamp.toDate().toLocaleString() : new Date(d.timestamp.seconds * 1000).toLocaleString()) : '—';
      return '<div style="padding:10px 12px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:8px">' +
        '<div style="font-size:0.78rem;font-weight:700;color:#ef4444;margin-bottom:3px">' + escA(String(d.message || '').slice(0, 120)) + '</div>' +
        '<div style="font-size:0.68rem;color:var(--ts)">' +
          escA(d.page || '—') + ' &nbsp;·&nbsp; line ' + (d.line || 0) +
          (d.uid ? ' &nbsp;·&nbsp; uid: ' + escA(String(d.uid).slice(0, 12)) + '…' : '') +
          ' &nbsp;·&nbsp; ' + ts +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderUploadFailures(docs) {
    var el = document.getElementById('err-uploads-log');
    if (!el) return;
    if (!docs.length) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--ts);font-size:0.8rem"><i class="fas fa-check-circle" style="color:#10b981;margin-right:6px"></i>No upload failures</div>';
      return;
    }
    el.innerHTML = docs.map(function (d) {
      var ts = d.timestamp ? (d.timestamp.toDate ? d.timestamp.toDate().toLocaleString() : new Date(d.timestamp.seconds * 1000).toLocaleString()) : '—';
      return '<div style="padding:9px 12px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);border-radius:8px">' +
        '<div style="font-size:0.76rem;font-weight:700;color:#f59e0b">' + escA(d.type || 'unknown') + '</div>' +
        '<div style="font-size:0.68rem;color:var(--ts)">' + escA(String(d.reason || '').slice(0, 100)) + ' &nbsp;·&nbsp; ' + escA(d.page || '—') + ' &nbsp;·&nbsp; ' + ts + '</div>' +
      '</div>';
    }).join('');
  }

  function loadAdminErrors() {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) {
      window.addEventListener('GeoFirebaseReady', function () { loadAdminErrors(); }, { once: true });
      return;
    }
    var db = fb.db, fs = fb.fs;
    var subEl = document.getElementById('errorsSub');
    var todayKey = getDateStr(0);

    Promise.all([
      fs.getDocs(fs.query(fs.collection(db, 'analytics', 'errors', 'log'), fs.orderBy('timestamp', 'desc'), fs.limit(30))),
      fs.getDocs(fs.query(fs.collection(db, 'analytics', 'uploads', 'failures'), fs.orderBy('timestamp', 'desc'), fs.limit(20))),
      fs.getDoc(fs.doc(db, 'analytics', 'errors', 'daily', todayKey))
    ]).then(function (res) {
      var errDocs = [];
      res[0].forEach(function (d) { errDocs.push(Object.assign({ _id: d.id }, d.data())); });
      var upDocs = [];
      res[1].forEach(function (d) { upDocs.push(Object.assign({ _id: d.id }, d.data())); });
      var todayData = res[2].exists() ? res[2].data() : {};

      var todayErrs = todayData.count || 0;
      var pagesAffected = new Set(errDocs.map(function (d) { return d.page; })).size;

      var e1 = document.getElementById('err-today');     if (e1) e1.textContent = todayErrs;
      var e2 = document.getElementById('err-uploads');   if (e2) e2.textContent = upDocs.length;
      var e3 = document.getElementById('err-pages');     if (e3) e3.textContent = pagesAffected;
      if (subEl) subEl.textContent = errDocs.length + ' errors · ' + upDocs.length + ' upload failures';

      var sbEl = document.getElementById('sb-errors');
      if (sbEl) sbEl.textContent = todayErrs > 0 ? String(todayErrs) : '0';

      renderErrorLog(errDocs);
      renderUploadFailures(upDocs);
    }).catch(function (err) {
      if (subEl) subEl.textContent = 'Load failed — check Firestore rules';
      console.warn('[Admin] errors', err && err.message);
    });
  }

  /* ── PLACE CATEGORY MANAGER ─────────────────────────────── */

  var _PCAT_DEFAULTS = [
    { id: 'food', labelKa: '🍔 საკვები / რესტორნები', labelEn: 'Food / Restaurants', icon: '🍔', color: '#e74c3c', sortOrder: 10,
      subcategories: [
        { id: 'restaurant', labelKa: 'რესტორანი', labelEn: 'Restaurant', icon: '🍽️', active: true },
        { id: 'fast_food', labelKa: 'ფასტ-ფუდი', labelEn: 'Fast Food', icon: '🍟', active: true },
        { id: 'bakery', labelKa: 'საცხობი / პური', labelEn: 'Bakery', icon: '🥐', active: true },
        { id: 'dessert', labelKa: 'დესერტი / ტკბილეული', labelEn: 'Dessert', icon: '🍰', active: true },
        { id: 'cafe', labelKa: 'კაფე', labelEn: 'Cafe', icon: '☕', active: true }
      ]
    },
    { id: 'cafe', labelKa: '☕ კაფე / ყავა / დესერტი', labelEn: 'Cafe / Coffee / Dessert', icon: '☕', color: '#8e5a3c', sortOrder: 20 },
    { id: 'nightlife', labelKa: '🍸 ბარები / ღამის ცხოვრება', labelEn: 'Bars / Nightlife', icon: '🍸', color: '#8e44ad', sortOrder: 30,
      subcategories: [
        { id: 'bar', labelKa: 'ბარი', labelEn: 'Bar', icon: '🍺', active: true },
        { id: 'wine_bar', labelKa: 'ღვინის ბარი', labelEn: 'Wine Bar', icon: '🍷', active: true },
        { id: 'club', labelKa: 'კლუბი', labelEn: 'Club', icon: '🎵', active: true },
        { id: 'rooftop_bar', labelKa: 'Rooftop ბარი', labelEn: 'Rooftop Bar', icon: '🌃', active: true },
        { id: 'lounge', labelKa: 'ლაუნჯი', labelEn: 'Lounge', icon: '🛋️', active: true }
      ]
    },
    { id: 'shopping', labelKa: '🛍️ მაღაზიები / მოლები', labelEn: 'Shopping / Malls', icon: '🛍️', color: '#3498db', sortOrder: 40,
      subcategories: [
        { id: 'mall', labelKa: 'სავაჭრო ცენტრი', labelEn: 'Mall', icon: '🏬', active: true },
        { id: 'supermarket', labelKa: 'სუპერმარკეტი', labelEn: 'Supermarket', icon: '🛒', active: true },
        { id: 'electronics', labelKa: 'ელექტრონიკა', labelEn: 'Electronics', icon: '📱', active: true },
        { id: 'clothing', labelKa: 'ტანსაცმელი', labelEn: 'Clothing', icon: '👕', active: true },
        { id: 'market', labelKa: 'ბაზარი', labelEn: 'Market', icon: '🏪', active: true }
      ]
    },
    { id: 'fitness', labelKa: '🏋️ სპორტი / ფიტნესი', labelEn: 'Sports / Fitness', icon: '🏋️', color: '#f39c12', sortOrder: 50,
      subcategories: [
        { id: 'gym', labelKa: 'სპორტდარბაზი', labelEn: 'Gym', icon: '🏋️', active: true },
        { id: 'mma', labelKa: 'MMA / ბოქსი', labelEn: 'MMA / Boxing', icon: '🥊', active: true },
        { id: 'yoga', labelKa: 'იოგა / პილატესი', labelEn: 'Yoga / Pilates', icon: '🧘', active: true },
        { id: 'swimming', labelKa: 'საცურაო', labelEn: 'Swimming', icon: '🏊', active: true },
        { id: 'sports_field', labelKa: 'სპორტული მოედანი', labelEn: 'Sports Field', icon: '⚽', active: true }
      ]
    },
    { id: 'sports', labelKa: '🏃 სპორტული ობიექტი', labelEn: 'Sports Venue', icon: '🏃', color: '#f39c12', sortOrder: 55 },
    { id: 'park', labelKa: '🌳 პარკები', labelEn: 'Parks', icon: '🌳', color: '#27ae60', sortOrder: 60,
      subcategories: [
        { id: 'urban_park', labelKa: 'სკვერი / პარკი', labelEn: 'Urban Park', icon: '🌳', active: true },
        { id: 'garden', labelKa: 'ბოტანიკური ბაღი', labelEn: 'Garden', icon: '🌸', active: true },
        { id: 'lake_park', labelKa: 'ტბა / ტბისპირი', labelEn: 'Lake Park', icon: '🏞️', active: true },
        { id: 'playground', labelKa: 'სათამაშო მოედანი', labelEn: 'Playground', icon: '🎠', active: true }
      ]
    },
    { id: 'nature', labelKa: '🏞️ ბუნება / ტბები', labelEn: 'Nature / Lakes', icon: '🏞️', color: '#2ecc71', sortOrder: 70 },
    { id: 'transport', labelKa: '🚇 ტრანსპორტი', labelEn: 'Transport', icon: '🚇', color: '#1f5fbf', sortOrder: 80,
      subcategories: [
        { id: 'metro', labelKa: 'მეტრო', labelEn: 'Metro', icon: '🚇', active: true },
        { id: 'bus_station', labelKa: 'ავტობუსის გაჩერება', labelEn: 'Bus Station', icon: '🚌', active: true },
        { id: 'train_station', labelKa: 'სარკინიგზო სადგური', labelEn: 'Train Station', icon: '🚉', active: true },
        { id: 'parking', labelKa: 'პარკინგი', labelEn: 'Parking', icon: '🅿️', active: true },
        { id: 'gas_station', labelKa: 'ბენზინგასამართი', labelEn: 'Gas Station', icon: '⛽', active: true }
      ]
    },
    { id: 'health', labelKa: '🏥 ჯანმრთელობა', labelEn: 'Health / Medical', icon: '🏥', color: '#ff5a6e', sortOrder: 90,
      subcategories: [
        { id: 'hospital', labelKa: 'საავადმყოფო', labelEn: 'Hospital', icon: '🏥', active: true },
        { id: 'clinic', labelKa: 'კლინიკა', labelEn: 'Clinic', icon: '🩺', active: true },
        { id: 'dental', labelKa: 'სტომატოლოგია', labelEn: 'Dental', icon: '🦷', active: true },
        { id: 'vet', labelKa: 'ვეტერინარი', labelEn: 'Vet', icon: '🐾', active: true }
      ]
    },
    { id: 'pharmacy', labelKa: '💊 აფთიაქი', labelEn: 'Pharmacy', icon: '💊', color: '#06b6d4', sortOrder: 100 },
    { id: 'finance', labelKa: '🏦 ფინანსები', labelEn: 'Finance / Banking', icon: '🏦', color: '#16a085', sortOrder: 110 },
    { id: 'hotel', labelKa: '🏨 სასტუმრო', labelEn: 'Hotels', icon: '🏨', color: '#0891b2', sortOrder: 120 },
    { id: 'education', labelKa: '🎓 განათლება', labelEn: 'Education', icon: '🎓', color: '#059669', sortOrder: 130,
      subcategories: [
        { id: 'university', labelKa: 'უნივერსიტეტი', labelEn: 'University', icon: '🎓', active: true },
        { id: 'school', labelKa: 'სკოლა', labelEn: 'School', icon: '🏫', active: true },
        { id: 'course_center', labelKa: 'კურსები / ტრენინგი', labelEn: 'Course Center', icon: '📚', active: true },
        { id: 'library', labelKa: 'ბიბლიოთეკა', labelEn: 'Library', icon: '📖', active: true }
      ]
    },
    { id: 'beauty', labelKa: '✂️ სილამაზე / სალონი', labelEn: 'Beauty / Salon', icon: '✂️', color: '#ff66b3', sortOrder: 140,
      subcategories: [
        { id: 'salon', labelKa: 'სილამაზის სალონი', labelEn: 'Salon', icon: '💇', active: true },
        { id: 'barber', labelKa: 'საბარბიეო', labelEn: 'Barber', icon: '✂️', active: true },
        { id: 'nail_salon', labelKa: 'ნეილ სტუდია', labelEn: 'Nail Salon', icon: '💅', active: true },
        { id: 'tattoo', labelKa: 'ტატუ სტუდია', labelEn: 'Tattoo Studio', icon: '🎨', active: true }
      ]
    },
    { id: 'auto', labelKa: '⛽ ავტო / ბენზინი', labelEn: 'Auto / Gas', icon: '⛽', color: '#64748b', sortOrder: 150,
      subcategories: [
        { id: 'auto_gas', labelKa: 'ბენზინგასამართი', labelEn: 'Gas Station', icon: '⛽', active: true },
        { id: 'auto_service', labelKa: 'ავტოსერვისი', labelEn: 'Auto Service', icon: '🔧', active: true },
        { id: 'car_wash', labelKa: 'ავტოსარეცხი', labelEn: 'Car Wash', icon: '🚗', active: true },
        { id: 'car_rental', labelKa: 'ავტოიჯარა', labelEn: 'Car Rental', icon: '🚙', active: true }
      ]
    },
    { id: 'government', labelKa: '🏛️ სახელმწიფო', labelEn: 'Government', icon: '🏛️', color: '#7f8c8d', sortOrder: 160 },
    { id: 'religion', labelKa: '⛪ რელიგიური ადგილები', labelEn: 'Religious Sites', icon: '⛪', color: '#7d3c98', sortOrder: 170 },
    { id: 'animals', labelKa: '🐾 ცხოველები / ვეტერინარი', labelEn: 'Animals / Vet', icon: '🐾', color: '#92400e', sortOrder: 180 },
    { id: 'culture', labelKa: '🎭 კულტურა / თეატრი / მუზეუმი', labelEn: 'Culture / Theatre / Museum', icon: '🎭', color: '#a67c52', sortOrder: 190,
      subcategories: [
        { id: 'museum', labelKa: 'მუზეუმი', labelEn: 'Museum', icon: '🏛️', active: true },
        { id: 'theatre', labelKa: 'თეატრი', labelEn: 'Theatre', icon: '🎭', active: true },
        { id: 'gallery', labelKa: 'გალერეა', labelEn: 'Gallery', icon: '🖼️', active: true },
        { id: 'monument', labelKa: 'ძეგლი / მემორიალი', labelEn: 'Monument', icon: '🗽', active: true }
      ]
    },
    { id: 'entertainment', labelKa: '🎬 გართობა', labelEn: 'Entertainment', icon: '🎬', color: '#f1c40f', sortOrder: 200 },
    { id: 'work', labelKa: '💼 სამუშაო / Coworking', labelEn: 'Work / Coworking', icon: '💼', color: '#475569', sortOrder: 210 },
    { id: 'photo_spot', labelKa: '📸 ფოტო ლოკაციები', labelEn: 'Photo Spots', icon: '📸', color: '#db2777', sortOrder: 220 },
    { id: 'rooftop', labelKa: '🌃 Rooftop / ხედები', labelEn: 'Rooftop / Views', icon: '🌃', color: '#4f46e5', sortOrder: 230 },
    { id: 'service', labelKa: '🛠️ სერვისები', labelEn: 'Services', icon: '🛠️', color: '#9ca3af', sortOrder: 240,
      subcategories: [
        { id: 'repair', labelKa: 'სარემონტო', labelEn: 'Repair', icon: '🔧', active: true },
        { id: 'cleaning', labelKa: 'დასუფთავება', labelEn: 'Cleaning', icon: '🧹', active: true },
        { id: 'printing', labelKa: 'ბეჭდვა / ქსეროქსი', labelEn: 'Printing', icon: '🖨️', active: true },
        { id: 'delivery', labelKa: 'მიტანის სერვისი', labelEn: 'Delivery', icon: '📦', active: true },
        { id: 'photo_studio', labelKa: 'ფოტოსტუდია', labelEn: 'Photo Studio', icon: '📷', active: true }
      ]
    },
    { id: 'landmark', labelKa: '📍 ღირსშესანიშნაობა', labelEn: 'Landmark', icon: '📍', color: '#b45309', sortOrder: 250 }
  ];

  window.loadPlaceCategorySection = function() {
    var fb = window.GeoFirebase, f = fb && fb.fs;
    if (!fb || !f) return;
    var listEl = document.getElementById('pcatList');
    var countEl = document.getElementById('pcatCount');
    if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:28px;color:var(--ts);font-size:.82rem"><i class="fas fa-spinner fa-spin"></i></div>';
    f.getDocs(f.query(f.collection(fb.db, 'placeCategories'), f.orderBy('sortOrder', 'asc'))).then(function(snap) {
      var rows = [];
      snap.forEach(function(d) { rows.push({ id: d.id, data: d.data() }); });
      if (countEl) countEl.textContent = '(' + rows.length + ')';
      if (!rows.length) {
        if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:28px;color:var(--ts);font-size:.82rem">No categories yet. Click "Seed 25 Defaults" to start.</div>';
        return;
      }
      var html = '<div style="display:grid;gap:6px">';
      rows.forEach(function(row) {
        var d = row.data;
        var inactive = d.active === false;
        html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:' + (inactive ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.06)') + ';opacity:' + (inactive ? '0.55' : '1') + '">'
          + '<span style="font-size:1.4rem;min-width:2rem;text-align:center">' + escHtmlAdmin(d.icon || '📍') + '</span>'
          + '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:' + escHtmlAdmin(d.color || '#666') + ';flex-shrink:0"></span>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-weight:700;font-size:.85rem;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtmlAdmin(d.labelKa || row.id) + '</div>'
          + '<div style="font-size:.72rem;color:#64748b;display:flex;gap:8px">'
          + (d.labelEn ? '<span>' + escHtmlAdmin(d.labelEn) + '</span>' : '')
          + '<code style="font-size:.7rem;color:#94a3b8">' + escHtmlAdmin(row.id) + '</code>'
          + (d.subcategories && d.subcategories.length ? '<span style="color:#10b981">' + d.subcategories.length + ' subs</span>' : '')
          + '</div>'
          + '</div>'
          + '<button type="button" onclick="togglePlaceCatActive(' + JSON.stringify(row.id) + ',' + JSON.stringify(!!d.active !== false) + ')" style="padding:3px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#94a3b8;cursor:pointer;font-size:.72rem" title="' + (inactive ? 'Enable' : 'Disable') + '">' + (inactive ? 'Off' : 'On') + '</button>'
          + '<button type="button" onclick="editPlaceCatRow(' + JSON.stringify(row.id) + ')" style="padding:3px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#94a3b8;cursor:pointer;font-size:.72rem">Edit</button>'
          + '<button type="button" onclick="deletePlaceCat(' + JSON.stringify(row.id) + ')" style="padding:3px 10px;border-radius:6px;border:none;background:rgba(239,68,68,.15);color:#f87171;cursor:pointer;font-size:.72rem">Del</button>'
          + '</div>';
      });
      html += '</div>';
      if (listEl) listEl.innerHTML = html;
    }).catch(function(err) {
      if (listEl) listEl.innerHTML = '<div style="color:#f87171;padding:16px;font-size:.82rem">Error: ' + escHtmlAdmin(err.message) + '</div>';
    });
  };

  window.savePlaceCategory = function(e) {
    e.preventDefault();
    var fb = window.GeoFirebase, f = fb && fb.fs;
    if (!fb || !f) return toast('Firebase not ready', 'rgba(239,68,68,.95)');
    var id      = (document.getElementById('pcatId').value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    var labelKa = (document.getElementById('pcatLabelKa').value || '').trim();
    var labelEn = (document.getElementById('pcatLabelEn').value || '').trim();
    var icon    = (document.getElementById('pcatIcon').value || '').trim();
    var color   = (document.getElementById('pcatColor').value || '#3498db').trim();
    var sortOrder = parseInt(document.getElementById('pcatSort').value || '100', 10);
    var active  = document.getElementById('pcatActive').checked;
    if (!id)      return toast('ID/slug is required', 'rgba(239,68,68,.95)');
    if (!labelKa) return toast('Georgian label is required', 'rgba(239,68,68,.95)');
    var docId = _pcatEditId || id;
    var data = { labelKa: labelKa, labelEn: labelEn, icon: icon || '📍', color: color, sortOrder: isNaN(sortOrder) ? 100 : sortOrder, active: active, updatedAt: new Date() };
    if (!_pcatEditId) data.createdAt = new Date();
    f.setDoc(f.doc(fb.db, 'placeCategories', docId), data, { merge: true })
      .then(function() {
        toast(_pcatEditId ? 'Category updated' : 'Category created');
        _firestorePlaceCats = null;
        resetPcatForm();
        window.loadPlaceCategorySection();
      }).catch(function(err) { toast('Save failed: ' + err.message, 'rgba(239,68,68,.95)'); });
  };

  window.editPlaceCatRow = function(catId) {
    var fb = window.GeoFirebase, f = fb && fb.fs;
    if (!fb || !f) return;
    f.getDoc(f.doc(fb.db, 'placeCategories', catId)).then(function(snap) {
      if (!snap.exists()) return toast('Category not found', 'rgba(239,68,68,.95)');
      var d = snap.data();
      _pcatEditId = catId;
      var set = function(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; };
      set('pcatId', catId);
      set('pcatLabelKa', d.labelKa || '');
      set('pcatLabelEn', d.labelEn || '');
      set('pcatIcon', d.icon || '');
      set('pcatColor', d.color || '#3498db');
      set('pcatSort', d.sortOrder || 100);
      var activeEl = document.getElementById('pcatActive');
      if (activeEl) activeEl.checked = d.active !== false;
      var titleEl = document.getElementById('pcatFormTitle');
      if (titleEl) titleEl.textContent = 'Edit: ' + catId;
      var idEl = document.getElementById('pcatId');
      if (idEl) idEl.readOnly = true;
      var cancelBtn = document.getElementById('pcatCancelBtn');
      if (cancelBtn) cancelBtn.style.display = '';
      document.getElementById('pcatForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      renderPcatSubcatSection(catId, d.subcategories || []);
    });
  };

  window.deletePlaceCat = function(catId) {
    if (!confirm('Delete category "' + catId + '"? Places using this category will keep their data but lose the icon.')) return;
    var fb = window.GeoFirebase, f = fb && fb.fs;
    if (!fb || !f) return;
    f.deleteDoc(f.doc(fb.db, 'placeCategories', catId)).then(function() {
      toast('Deleted: ' + catId);
      _firestorePlaceCats = null;
      window.loadPlaceCategorySection();
    }).catch(function(err) { toast('Delete failed: ' + err.message, 'rgba(239,68,68,.95)'); });
  };

  window.togglePlaceCatActive = function(catId, currentActive) {
    var fb = window.GeoFirebase, f = fb && fb.fs;
    if (!fb || !f) return;
    f.setDoc(f.doc(fb.db, 'placeCategories', catId), { active: !currentActive }, { merge: true }).then(function() {
      _firestorePlaceCats = null;
      window.loadPlaceCategorySection();
    }).catch(function(err) { toast('Update failed: ' + err.message, 'rgba(239,68,68,.95)'); });
  };

  window.resetPcatForm = function() {
    _pcatEditId = null;
    var form = document.getElementById('pcatForm');
    if (form) form.reset();
    var titleEl = document.getElementById('pcatFormTitle');
    if (titleEl) titleEl.textContent = 'Add Category';
    var idEl = document.getElementById('pcatId');
    if (idEl) idEl.readOnly = false;
    var cancelBtn = document.getElementById('pcatCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    var colorEl = document.getElementById('pcatColor');
    if (colorEl) colorEl.value = '#3498db';
    var activeEl = document.getElementById('pcatActive');
    if (activeEl) activeEl.checked = true;
    var subWrap = document.getElementById('pcatSubcatsWrap');
    if (subWrap) subWrap.remove();
  };

  window.seedDefaultPlaceCategories = function() {
    if (!confirm('Seed 25 default place categories with subcategories? Categories without existing subcategories will have default subcategories added.')) return;
    var fb = window.GeoFirebase, f = fb && fb.fs;
    if (!fb || !f) return toast('Firebase not ready', 'rgba(239,68,68,.95)');
    var promises = _PCAT_DEFAULTS.map(function(cat) {
      var docRef = f.doc(fb.db, 'placeCategories', cat.id);
      return f.getDoc(docRef).then(function(snap) {
        var existing = snap.exists() ? snap.data() : {};
        var data = {
          labelKa: cat.labelKa, labelEn: cat.labelEn, icon: cat.icon,
          color: cat.color, sortOrder: cat.sortOrder, active: true
        };
        // Only seed subcategories if none exist yet
        if (cat.subcategories && cat.subcategories.length && (!existing.subcategories || !existing.subcategories.length)) {
          data.subcategories = cat.subcategories;
        }
        return f.setDoc(docRef, data, { merge: true });
      });
    });
    Promise.all(promises).then(function() {
      toast('25 default categories seeded');
      _firestorePlaceCats = null;
      window.loadPlaceCategorySection();
    }).catch(function(err) { toast('Seed failed: ' + err.message, 'rgba(239,68,68,.95)'); });
  };

  /* ── PLACE SUBCATEGORY MANAGEMENT ───────────────────────── */

  function renderPcatSubcatSection(catId, subs) {
    var existingWrap = document.getElementById('pcatSubcatsWrap');
    if (existingWrap) existingWrap.remove();
    var form = document.getElementById('pcatForm');
    if (!form) return;
    var wrap = document.createElement('div');
    wrap.id = 'pcatSubcatsWrap';
    wrap.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)';
    form.parentNode.insertBefore(wrap, form.nextSibling);

    var html = '<div style="font-weight:700;font-size:.8rem;color:var(--ts);margin-bottom:8px">Subcategories (' + subs.length + ')</div>';
    if (subs.length) {
      html += '<div style="display:grid;gap:4px;margin-bottom:10px">';
      subs.forEach(function(sub, idx) {
        var inactive = sub.active === false;
        html += '<div style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,.04);opacity:' + (inactive ? '0.5' : '1') + '">'
          + '<span style="font-size:1.1rem;min-width:1.5rem;text-align:center">' + escHtmlAdmin(sub.icon || '') + '</span>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:.8rem;color:#f8fafc;font-weight:600">' + escHtmlAdmin(sub.labelKa || sub.id) + '</div>'
          + '<div style="font-size:.7rem;color:#64748b"><code>' + escHtmlAdmin(sub.id) + '</code>' + (sub.labelEn ? ' · ' + escHtmlAdmin(sub.labelEn) : '') + '</div>'
          + '</div>'
          + '<button type="button" onclick="editPcatSubcatItem(' + JSON.stringify(catId) + ',' + idx + ')" style="padding:2px 8px;border-radius:5px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#94a3b8;cursor:pointer;font-size:.7rem">Edit</button>'
          + '<button type="button" onclick="togglePcatSubcatActive(' + JSON.stringify(catId) + ',' + idx + ',' + JSON.stringify(sub.active !== false) + ')" style="padding:2px 8px;border-radius:5px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#94a3b8;cursor:pointer;font-size:.7rem">' + (inactive ? 'Off' : 'On') + '</button>'
          + '<button type="button" onclick="removePcatSubcat(' + JSON.stringify(catId) + ',' + idx + ')" style="padding:2px 8px;border-radius:5px;border:none;background:rgba(239,68,68,.12);color:#f87171;cursor:pointer;font-size:.7rem">✕</button>'
          + '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="font-size:.78rem;color:#64748b;margin-bottom:10px">No subcategories yet.</div>';
    }
    html += '<div id="pcatSubcatFormTitle" style="font-size:.78rem;font-weight:700;color:var(--ts);margin-bottom:6px">Add Subcategory</div>'
      + '<div style="display:grid;gap:6px">'
      + '<input id="pcatSubId" placeholder="ID (e.g. restaurant)" style="padding:8px;border-radius:8px;background:#111827;color:#f8fafc;border:1px solid rgba(255,255,255,.12);font-size:.8rem">'
      + '<input id="pcatSubLabelKa" placeholder="Georgian label" style="padding:8px;border-radius:8px;background:#111827;color:#f8fafc;border:1px solid rgba(255,255,255,.12);font-size:.8rem">'
      + '<input id="pcatSubLabelEn" placeholder="English label (optional)" style="padding:8px;border-radius:8px;background:#111827;color:#f8fafc;border:1px solid rgba(255,255,255,.12);font-size:.8rem">'
      + '<div style="display:grid;grid-template-columns:1fr auto;gap:6px">'
      + '<input id="pcatSubIcon" placeholder="Icon emoji" style="padding:8px;border-radius:8px;background:#111827;color:#f8fafc;border:1px solid rgba(255,255,255,.12);font-size:1rem;text-align:center" maxlength="8">'
      + '<button type="button" onclick="savePcatSubcatItem(' + JSON.stringify(catId) + ')" style="padding:8px 14px;border-radius:8px;background:#10b981;border:none;color:#fff;cursor:pointer;font-size:.8rem;font-weight:700">Save</button>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--ts)">'
      + '<input type="checkbox" id="pcatSubActive" checked style="width:14px;height:14px"> Active'
      + '<input type="hidden" id="pcatSubEditIdx" value="">'
      + '<button type="button" id="pcatSubCancelBtn" onclick="cancelPcatSubcatEdit()" style="display:none;margin-left:auto;padding:4px 10px;border-radius:6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#94a3b8;cursor:pointer;font-size:.72rem">Cancel</button>'
      + '</div>'
      + '</div>';
    wrap.innerHTML = html;
  }

  window.savePcatSubcatItem = function(catId) {
    var fb = window.GeoFirebase, f = fb && fb.fs;
    if (!fb || !f) return;
    var subId = (document.getElementById('pcatSubId').value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    var labelKa = (document.getElementById('pcatSubLabelKa').value || '').trim();
    var labelEn = (document.getElementById('pcatSubLabelEn').value || '').trim();
    var icon = (document.getElementById('pcatSubIcon').value || '').trim();
    var active = document.getElementById('pcatSubActive').checked;
    var editIdxEl = document.getElementById('pcatSubEditIdx');
    var editIdx = editIdxEl ? editIdxEl.value : '';
    if (!subId || !labelKa) return toast('ID and Georgian label required', 'rgba(239,68,68,.95)');
    var docRef = f.doc(fb.db, 'placeCategories', catId);
    f.getDoc(docRef).then(function(snap) {
      var subs = snap.exists() ? (snap.data().subcategories || []).slice() : [];
      var newSub = { id: subId, labelKa: labelKa, labelEn: labelEn, icon: icon || '📍', active: active };
      if (editIdx !== '') {
        subs[parseInt(editIdx, 10)] = newSub;
      } else {
        if (subs.some(function(s) { return s.id === subId; })) { toast('Subcategory ID already exists', 'rgba(239,68,68,.95)'); return Promise.reject('dup'); }
        subs.push(newSub);
      }
      return f.setDoc(docRef, { subcategories: subs }, { merge: true }).then(function() { return subs; });
    }).then(function(subs) {
      if (!subs) return;
      toast('Subcategory saved');
      _firestorePlaceCats = null;
      renderPcatSubcatSection(catId, subs);
    }).catch(function(err) { if (err !== 'dup') toast('Error: ' + (err && err.message), 'rgba(239,68,68,.95)'); });
  };

  window.removePcatSubcat = function(catId, subIdx) {
    if (!confirm('Remove this subcategory?')) return;
    var fb = window.GeoFirebase, f = fb && fb.fs;
    if (!fb || !f) return;
    var docRef = f.doc(fb.db, 'placeCategories', catId);
    f.getDoc(docRef).then(function(snap) {
      var subs = snap.exists() ? (snap.data().subcategories || []).slice() : [];
      subs.splice(subIdx, 1);
      return f.setDoc(docRef, { subcategories: subs }, { merge: true }).then(function() { return subs; });
    }).then(function(subs) {
      _firestorePlaceCats = null;
      renderPcatSubcatSection(catId, subs);
      toast('Subcategory removed');
    }).catch(function(err) { toast('Error: ' + (err && err.message), 'rgba(239,68,68,.95)'); });
  };

  window.togglePcatSubcatActive = function(catId, subIdx, currentActive) {
    var fb = window.GeoFirebase, f = fb && fb.fs;
    if (!fb || !f) return;
    var docRef = f.doc(fb.db, 'placeCategories', catId);
    f.getDoc(docRef).then(function(snap) {
      var subs = snap.exists() ? (snap.data().subcategories || []).slice() : [];
      if (subs[subIdx]) subs[subIdx] = Object.assign({}, subs[subIdx], { active: !currentActive });
      return f.setDoc(docRef, { subcategories: subs }, { merge: true }).then(function() { return subs; });
    }).then(function(subs) {
      _firestorePlaceCats = null;
      renderPcatSubcatSection(catId, subs);
    }).catch(function(err) { toast('Error: ' + (err && err.message), 'rgba(239,68,68,.95)'); });
  };

  window.editPcatSubcatItem = function(catId, subIdx) {
    var fb = window.GeoFirebase, f = fb && fb.fs;
    if (!fb || !f) return;
    f.getDoc(f.doc(fb.db, 'placeCategories', catId)).then(function(snap) {
      var subs = snap.exists() ? (snap.data().subcategories || []) : [];
      var sub = subs[subIdx];
      if (!sub) return;
      var set = function(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; };
      set('pcatSubId', sub.id);
      set('pcatSubLabelKa', sub.labelKa || '');
      set('pcatSubLabelEn', sub.labelEn || '');
      set('pcatSubIcon', sub.icon || '');
      var activeEl = document.getElementById('pcatSubActive'); if (activeEl) activeEl.checked = sub.active !== false;
      var editIdxEl = document.getElementById('pcatSubEditIdx'); if (editIdxEl) editIdxEl.value = subIdx;
      var idEl = document.getElementById('pcatSubId'); if (idEl) idEl.readOnly = true;
      var titleEl = document.getElementById('pcatSubcatFormTitle'); if (titleEl) titleEl.textContent = 'Edit: ' + sub.id;
      var cancelBtn = document.getElementById('pcatSubCancelBtn'); if (cancelBtn) cancelBtn.style.display = '';
    });
  };

  window.cancelPcatSubcatEdit = function() {
    ['pcatSubId','pcatSubLabelKa','pcatSubLabelEn','pcatSubIcon','pcatSubEditIdx'].forEach(function(id) {
      var el = document.getElementById(id); if (el) { el.value = ''; el.readOnly = false; }
    });
    var activeEl = document.getElementById('pcatSubActive'); if (activeEl) activeEl.checked = true;
    var titleEl = document.getElementById('pcatSubcatFormTitle'); if (titleEl) titleEl.textContent = 'Add Subcategory';
    var cancelBtn = document.getElementById('pcatSubCancelBtn'); if (cancelBtn) cancelBtn.style.display = 'none';
  };

  /* ── INIT ────────────────────────────────────────────────── */
  function init() {
    loadRealStats();
    buildSparklines();
    buildHourBars();
    renderUsers();
    renderBusinesses();
    renderCreators();
    loadModeration();
    loadAuditLog();
    setTimeout(drawOverviewCharts, 120);
    bindContentStudio();
    bindChallengeStudio();
    bindRewardsStudio();
    bindDeleteAllPlacesButton();

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
