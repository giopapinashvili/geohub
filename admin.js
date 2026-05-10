(function () {
  'use strict';

  /* ── MOCK DATA ─────────────────────────────────────────────── */

  var USERS = [
    { id:1,  name:'Nino Kiknadze',    handle:'@nino_k',    trust:98, status:'verified', checkins:218, reviews:42, joined:'Jan 2024', av:'linear-gradient(135deg,#10b981,#3b82f6)', init:'N' },
    { id:2,  name:'Giorgi Beridze',   handle:'@giorgi_b',  trust:95, status:'verified', checkins:184, reviews:38, joined:'Feb 2024', av:'linear-gradient(135deg,#3b82f6,#a855f7)', init:'G' },
    { id:3,  name:'Salome Tsiklauri', handle:'@salome_t',  trust:93, status:'verified', checkins:156, reviews:31, joined:'Feb 2024', av:'linear-gradient(135deg,#f59e0b,#ef4444)', init:'S' },
    { id:4,  name:'Tamara Gabunia',   handle:'@tamara_g',  trust:91, status:'verified', checkins:143, reviews:27, joined:'Mar 2024', av:'linear-gradient(135deg,#a855f7,#3b82f6)', init:'T' },
    { id:5,  name:'Davit Kvaratskhelia', handle:'@davit_k', trust:87, status:'verified', checkins:112, reviews:19, joined:'Mar 2024', av:'linear-gradient(135deg,#10b981,#f59e0b)', init:'D' },
    { id:6,  name:'Ana Lomidze',      handle:'@ana_l',     trust:82, status:'verified', checkins:98,  reviews:14, joined:'Apr 2024', av:'linear-gradient(135deg,#ef4444,#a855f7)', init:'A' },
    { id:7,  name:'Luka Chikhelidze', handle:'@luka_c',    trust:76, status:'active',   checkins:74,  reviews:11, joined:'Apr 2024', av:'linear-gradient(135deg,#3b82f6,#10b981)', init:'L' },
    { id:8,  name:'Mariam Jikia',     handle:'@mariam_j',  trust:71, status:'active',   checkins:62,  reviews:8,  joined:'May 2024', av:'linear-gradient(135deg,#f97316,#f59e0b)', init:'M' },
    { id:9,  name:'Irakli Tavauri',   handle:'@irakli_t',  trust:65, status:'active',   checkins:48,  reviews:6,  joined:'May 2024', av:'linear-gradient(135deg,#10b981,#a855f7)', init:'I' },
    { id:10, name:'Ketevan Abashidze',handle:'@ketevan_a', trust:58, status:'active',   checkins:34,  reviews:4,  joined:'Jun 2024', av:'linear-gradient(135deg,#ef4444,#3b82f6)', init:'K' },
    { id:11, name:'Zaza Mchedlishvili',handle:'@zaza_m',   trust:34, status:'flagged',  checkins:12,  reviews:18, joined:'Jun 2024', av:'linear-gradient(135deg,#ef4444,#f97316)', init:'Z' },
    { id:12, name:'Beka Gugushvili',  handle:'@beka_g',    trust:22, status:'suspended', checkins:3,  reviews:0,  joined:'Jul 2024', av:'linear-gradient(135deg,#475569,#334155)', init:'B' },
    { id:13, name:'Nata Svanidze',    handle:'@nata_s',    trust:88, status:'verified', checkins:91,  reviews:16, joined:'Feb 2024', av:'linear-gradient(135deg,#a855f7,#ef4444)', init:'N' },
    { id:14, name:'Giorgi Kapanadze', handle:'@giorgi_kap',trust:44, status:'flagged',  checkins:18,  reviews:22, joined:'May 2024', av:'linear-gradient(135deg,#f59e0b,#ef4444)', init:'G' },
    { id:15, name:'Tiko Maisuradze',  handle:'@tiko_m',    trust:79, status:'active',   checkins:55,  reviews:9,  joined:'Mar 2024', av:'linear-gradient(135deg,#10b981,#3b82f6)', init:'T' }
  ];

  var BUSINESSES = [
    { id:1, name:'Fabrika',         cat:'Café & Co-working', city:'Tbilisi', status:'verified', featured:true,  rating:4.8, reviews:284, checkins:1240, icon:'☕', iconBg:'rgba(16,185,129,0.15)',  campaigns:3 },
    { id:2, name:'Rooms Hotel',     cat:'Luxury Hotel',      city:'Tbilisi', status:'verified', featured:true,  rating:4.9, reviews:198, checkins:840,  icon:'🏨', iconBg:'rgba(59,130,246,0.15)',  campaigns:2 },
    { id:3, name:'Lolita Bar',      cat:'Bar & Nightlife',   city:'Tbilisi', status:'verified', featured:false, rating:4.7, reviews:142, checkins:620,  icon:'🍸', iconBg:'rgba(239,68,68,0.15)',   campaigns:1 },
    { id:4, name:'Stamba Hotel',    cat:'Boutique Hotel',    city:'Tbilisi', status:'pending',  featured:false, rating:4.6, reviews:89,  checkins:380,  icon:'🏩', iconBg:'rgba(245,158,11,0.15)',  campaigns:0 },
    { id:5, name:'Batumi Spa',      cat:'Wellness & Spa',    city:'Batumi',  status:'verified', featured:true,  rating:4.5, reviews:64,  checkins:210,  icon:'💆', iconBg:'rgba(168,85,247,0.15)',  campaigns:2 },
    { id:6, name:'Wine House GE',   cat:'Wine Bar',          city:'Kakheti', status:'verified', featured:false, rating:4.8, reviews:112, checkins:290,  icon:'🍷', iconBg:'rgba(249,115,22,0.15)',  campaigns:1 },
    { id:7, name:'GeoTech Office',  cat:'Tech & Coworking',  city:'Tbilisi', status:'rejected', featured:false, rating:3.2, reviews:8,   checkins:12,   icon:'💻', iconBg:'rgba(100,116,139,0.15)', campaigns:0 },
    { id:8, name:'Kazbegi Resort',  cat:'Mountain Resort',   city:'Kazbegi', status:'pending',  featured:false, rating:4.7, reviews:44,  checkins:180,  icon:'🏔️', iconBg:'rgba(59,130,246,0.15)',  campaigns:0 }
  ];

  var CREATORS = [
    { id:1, name:'Nino Kiknadze',    handle:'@nino_k',    followers:28400, posts:142, trust:98, verified:true,  collabs:8,  av:'linear-gradient(135deg,#10b981,#3b82f6)', init:'N' },
    { id:2, name:'Giorgi Beridze',   handle:'@giorgi_b',  followers:19200, posts:98,  trust:95, verified:true,  collabs:6,  av:'linear-gradient(135deg,#3b82f6,#a855f7)', init:'G' },
    { id:3, name:'Salome Travel',    handle:'@salome_tr', followers:14800, posts:76,  trust:89, verified:true,  collabs:4,  av:'linear-gradient(135deg,#f59e0b,#ef4444)', init:'S' },
    { id:4, name:'TbilisiVibes',     handle:'@tbvibe',    followers:32100, posts:204, trust:84, verified:true,  collabs:12, av:'linear-gradient(135deg,#a855f7,#ef4444)', init:'T' },
    { id:5, name:'GeoFood Blog',     handle:'@geofood',   followers:8900,  posts:58,  trust:76, verified:false, collabs:2,  av:'linear-gradient(135deg,#10b981,#f59e0b)', init:'G' },
    { id:6, name:'Batumi Days',      handle:'@batumiday', followers:6200,  posts:44,  trust:71, verified:false, collabs:1,  av:'linear-gradient(135deg,#3b82f6,#10b981)', init:'B' }
  ];

  var MOD_QUEUE = [
    { id:1,  type:'review',   title:'Coordinated Fake Reviews',   sub:'Stamba Hotel · 14 reviews',          body:'14 reviews posted from accounts created on the same day. Identical writing patterns detected by AI. Confidence: 91%.',                           priority:'high',   icon:'⭐', bg:'rgba(245,158,11,0.15)' },
    { id:2,  type:'checkin',  title:'Automated Check-in Cluster',  sub:'Old Town Tbilisi · 7 check-ins',     body:'7 check-ins from identical device fingerprints within a 2-minute window. GPS variance only ±3m — likely bot activity.',                          priority:'high',   icon:'📍', bg:'rgba(16,185,129,0.15)' },
    { id:3,  type:'user',     title:'Trust Score Manipulation',    sub:'@giorgi_k · +28 trust in 48h',       body:'User trust score jumped 28 points in 48 hours via self-referral loop and mass-follow pattern. AI flag: 74% confidence.',                         priority:'high',   icon:'👤', bg:'rgba(59,130,246,0.15)' },
    { id:4,  type:'review',   title:'Offensive Review Content',    sub:'Fabrika · 1 review',                 body:'Review contains offensive language targeting staff by name. User has 2 prior warnings. Escalation recommended.',                                  priority:'medium', icon:'⭐', bg:'rgba(239,68,68,0.15)'  },
    { id:5,  type:'content',  title:'Spam Creator Account',        sub:'@promo_bot_ge · 22 posts',           body:'Account posting identical promotional content across 22 places with no organic engagement. Follower count purchased.',                             priority:'medium', icon:'📢', bg:'rgba(168,85,247,0.15)' },
    { id:6,  type:'checkin',  title:'Suspicious Reward Farming',   sub:'@beka_g · 48 check-ins today',       body:'User checked in 48 times in a single day across 30 different venues — physically impossible. Reward farming pattern.',                            priority:'medium', icon:'📍', bg:'rgba(16,185,129,0.15)' },
    { id:7,  type:'review',   title:'Competitor Sabotage',         sub:'Rooms Hotel · 3 reviews',            body:'3 suspiciously negative reviews from brand-new accounts. IP addresses trace to same network as a competing hotel.',                                priority:'medium', icon:'⭐', bg:'rgba(245,158,11,0.15)' },
    { id:8,  type:'user',     title:'Underage Account Suspected',  sub:'@anon_user_2891',                    body:'Profile content and activity patterns suggest user may be under platform minimum age. Photo verification required.',                               priority:'low',    icon:'👤', bg:'rgba(59,130,246,0.15)' },
    { id:9,  type:'content',  title:'Copyright Infringement',      sub:'@geofood · 4 posts',                 body:'4 story posts contain watermarked photos from commercial photography sites. DMCA claim pending.',                                                  priority:'low',    icon:'🖼️', bg:'rgba(249,115,22,0.15)' },
    { id:10, type:'checkin',  title:'GPS Spoofing Detected',       sub:'@zaza_m · Kazbegi',                  body:'Check-in location data shows Kazbegi while cellular tower data places device in Tbilisi. GPS spoofing library signature detected.',               priority:'low',    icon:'📍', bg:'rgba(16,185,129,0.15)' },
    { id:11, type:'review',   title:'Unverified Medical Claim',    sub:'Batumi Spa · 1 review',              body:'Review claims spa caused a medical condition. Cannot be verified. May expose platform to legal liability.',                                        priority:'low',    icon:'⭐', bg:'rgba(239,68,68,0.15)'  },
    { id:12, type:'user',     title:'Multiple Account Suspicion',  sub:'@nata_alt',                          body:'Account shares device fingerprint with banned user @beka_g. Profile avatar and bio closely match suspended account.',                             priority:'low',    icon:'👤', bg:'rgba(59,130,246,0.15)' }
  ];

  var LIVE_EVENTS = [
    { icon:'📍', bg:'rgba(16,185,129,0.15)',  text:'<strong>nino_k</strong> checked in at <strong>Fabrika Café</strong>',            type:'check-in' },
    { icon:'⭐', bg:'rgba(245,158,11,0.15)',  text:'<strong>giorgi_b</strong> left a 5-star review for <strong>Rooms Hotel</strong>', type:'review'   },
    { icon:'🎁', bg:'rgba(59,130,246,0.15)',  text:'<strong>salome_t</strong> claimed reward at <strong>Lolita Bar</strong>',         type:'reward'   },
    { icon:'🛡️', bg:'rgba(249,115,22,0.15)', text:'<strong>davit_k</strong> completed Patriot Mission in <strong>Vake Park</strong>', type:'patriot'  },
    { icon:'🎬', bg:'rgba(168,85,247,0.15)',  text:'<strong>tbvibe</strong> posted a new Story from <strong>Old Town</strong>',        type:'story'    },
    { icon:'📍', bg:'rgba(16,185,129,0.15)',  text:'<strong>tamara_g</strong> checked in at <strong>Mtatsminda Park</strong>',         type:'check-in' },
    { icon:'⭐', bg:'rgba(245,158,11,0.15)',  text:'<strong>ana_l</strong> reviewed <strong>Wine House GE</strong> — 4 stars',         type:'review'   },
    { icon:'🎁', bg:'rgba(59,130,246,0.15)',  text:'<strong>luka_c</strong> claimed Kazbegi hiking reward — <strong>+80 XP</strong>', type:'reward'   },
    { icon:'🏆', bg:'rgba(168,85,247,0.15)',  text:'<strong>nata_s</strong> reached <strong>Explorer Level 5</strong>',               type:'milestone'},
    { icon:'📍', bg:'rgba(16,185,129,0.15)',  text:'<strong>mariam_j</strong> checked in at <strong>Batumi Boulevard</strong>',        type:'check-in' },
    { icon:'🛡️', bg:'rgba(249,115,22,0.15)', text:'<strong>irakli_t</strong> reported infrastructure issue in <strong>Saburtalo</strong>', type:'patriot' },
    { icon:'🎬', bg:'rgba(168,85,247,0.15)',  text:'<strong>geofood</strong> posted a Story — <strong>Old Town street food</strong>',  type:'story'    }
  ];

  /* ── STATE ───────────────────────────────────────────────── */
  var currentSection = 'overview';
  var liveRunning    = true;
  var liveFeedCount  = 0;
  var liveTimer      = null;
  var liveActiveCount = 47;
  var selectedUser   = null;
  var modItems       = MOD_QUEUE.slice();
  var notifCount     = 3;

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

  /* ── SPARKLINES ──────────────────────────────────────────── */
  function buildSparklines() {
    var configs = [
      { id:'sp-users', color:'#10b981', data:[22,31,28,35,40,38,44,51,48,58,62,55,70,78] },
      { id:'sp-biz',   color:'#3b82f6', data:[10,12,11,14,13,16,15,17,16,18,17,19,18,18] },
      { id:'sp-ev',    color:'#f59e0b', data:[8,9,11,10,12,14,13,15,14,16,15,18,17,14]   },
      { id:'sp-rev',   color:'#a855f7', data:[18,22,20,25,28,26,30,32,29,34,38,35,40,43] }
    ];
    configs.forEach(function (cfg) {
      var wrap = document.getElementById(cfg.id);
      if (!wrap) return;
      var max = Math.max.apply(null, cfg.data);
      wrap.innerHTML = '';
      cfg.data.forEach(function (v) {
        var b = document.createElement('div');
        b.className = 'sp';
        b.style.background = cfg.color;
        b.style.height = Math.max(3, Math.round((v / max) * 24)) + 'px';
        wrap.appendChild(b);
      });
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
    var growthData  = [120,145,132,160,178,165,192,210,198,224,241,228,260,278,265,290,312,298,324,310,340,328,356,342,368,354,380,398,384,412];
    var dauData     = [42,48,44,52,58,54,61,68,64,72,78,74,82,88];

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
    var vals = [18420, 12800, 6240, 3180, 2200];
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
    var data = [28000,30200,29800,31500,33000,32400,34800,36200,35400,37800,39100,38400,40200,41800,40600,42840];
    drawLine(ctx, data, '#a855f7', 'rgba(168,85,247,0.08)', canvas.width, canvas.height);
  }

  /* ── HOUR BARS (City) ─────────────────────────────────────── */
  function buildHourBars() {
    var barsEl = document.getElementById('hourBars');
    var lblsEl = document.getElementById('hourLabels');
    if (!barsEl || !lblsEl) return;
    var vals = [2,1,1,2,3,8,18,34,42,48,52,55,58,54,50,46,52,60,72,68,62,54,42,28];
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
