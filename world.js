(function () {
  'use strict';

  /* ── CITIES ─────────────────────────────────────────────────── */
  var CITIES = [
    { id:'tbilisi',  name:'Tbilisi',   icon:'🏛️',  x:.52, y:.54, pop:1200, color:'#00c8ff', zones:['Vake','Saburtalo','Mtatsminda','Fabrika','Old Town'], activity:92 },
    { id:'batumi',   name:'Batumi',    icon:'🌊',  x:.12, y:.72, pop:380,  color:'#3b82f6', zones:['Boulevard','Old Batumi','New Batumi'],             activity:74 },
    { id:'kutaisi',  name:'Kutaisi',   icon:'🏺',  x:.28, y:.48, pop:210,  color:'#8b5cf6', zones:['Center','Gelati Area'],                           activity:61 },
    { id:'gori',     name:'Gori',      icon:'🏰',  x:.42, y:.46, pop:90,   color:'#f59e0b', zones:['City Center','Museum District'],                  activity:48 },
    { id:'kazbegi',  name:'Kazbegi',   icon:'⛰️',  x:.56, y:.24, pop:45,   color:'#10b981', zones:['Stepantsminda','Gergeti'],                       activity:83 },
    { id:'sighnaghi',name:'Sighnaghi', icon:'🍷',  x:.72, y:.52, pop:60,   color:'#ec4899', zones:['Old Town','Wine Route'],                         activity:67 },
    { id:'mtskheta', name:'Mtskheta',  icon:'⛪',  x:.50, y:.48, pop:55,   color:'#f97316', zones:['Cathedral Area','Jvari'],                        activity:55 },
    { id:'zugdidi',  name:'Zugdidi',   icon:'🌿',  x:.18, y:.38, pop:75,   color:'#34d399', zones:['Center','Park District'],                        activity:42 }
  ];

  /* ── AI FEED TEMPLATES ───────────────────────────────────────── */
  var FEED_POOL = [
    { icon:'🔥', text:'Vake district is trending tonight — 3x normal foot traffic detected.', tag:'trend', city:'tbilisi' },
    { icon:'🎭', text:'3 creator meetups happening now in Tbilisi. 240+ attendees confirmed.', tag:'creator', city:'tbilisi' },
    { icon:'⛰️', text:'Kazbegi exploration activity up +42% this weekend. New patriot missions unlocked.', tag:'patriot', city:'kazbegi' },
    { icon:'🏆', text:'Reward claim spike near Fabrika Café — 47 claims in the last 30 minutes.', tag:'reward', city:'tbilisi' },
    { icon:'🛡️', text:'Patriot cleanup mission completed in Batumi Boulevard. Trust score +8 for 12 users.', tag:'patriot', city:'batumi' },
    { icon:'🍷', text:'Sighnaghi Wine Route check-ins surging. 82 new reviews posted today.', tag:'trend', city:'sighnaghi' },
    { icon:'🎵', text:'Nightlife activity in Tbilisi Old Town peaked — 6 live events simultaneous.', tag:'event', city:'tbilisi' },
    { icon:'📸', text:'Creator @nino.geo went live with 1,200 viewers exploring Mtskheta.', tag:'creator', city:'mtskheta' },
    { icon:'🚨', text:'Suspicious review cluster flagged in Kutaisi Center. AI moderation active.', tag:'alert', city:'kutaisi' },
    { icon:'☕', text:'Café check-in density record broken in Saburtalo — 340 check-ins today.', tag:'trend', city:'tbilisi' },
    { icon:'🎟️', text:'Concert tickets for Tbilisi Jazz Fest sold out in 8 minutes. 2,400 attendees.', tag:'event', city:'tbilisi' },
    { icon:'🌱', text:'Zugdidi eco-trail challenge completed by first 50 explorers. Badge unlocked.', tag:'patriot', city:'zugdidi' },
    { icon:'💎', text:'GeoHub Pro subscriptions up 18% this week. Businesses reporting 2.3x reach.', tag:'trend', city:'tbilisi' },
    { icon:'🗺️', text:'New exploration zone unlocked in Gori — 15 pioneer explorers awarded.', tag:'reward', city:'gori' },
    { icon:'🤝', text:'Community litter pickup in Batumi — 34 participants, Patriot XP distributed.', tag:'patriot', city:'batumi' }
  ];

  /* ── PREDICTIONS ─────────────────────────────────────────────── */
  var PREDICTIONS = [
    { title:'Vake Hotspot Tomorrow', sub:'AI predicts 3.1x user density based on weekend trend + scheduled events.', conf:'94% confidence', cls:'', icon:'🔥' },
    { title:'Fabrika Café Growth', sub:'New business gaining momentum. Likely trending in top 5 by next week.', conf:'87% confidence', cls:'gold', icon:'☕' },
    { title:'Creator @luka.tbilisi Rising', sub:'Content velocity +240% this month. Expected viral reel within 48h.', conf:'82% confidence', cls:'purple', icon:'🎬' },
    { title:'Jazz Festival Effect', sub:'Nightlife zone will extend to Vera district Friday 22:00–02:00.', conf:'91% confidence', cls:'green', icon:'🎵' },
    { title:'Kazbegi Weekend Rush', sub:'Explorer bookings suggest +60% activity Sat–Sun. Hotel capacity near 95%.', conf:'88% confidence', cls:'orange', icon:'⛰️' }
  ];

  /* ── ZONE TRENDS ─────────────────────────────────────────────── */
  var ZONES = [
    { label:'Vake',       pct:92, color:'#00c8ff' },
    { label:'Saburtalo',  pct:78, color:'#10b981' },
    { label:'Old Town',   pct:85, color:'#f59e0b' },
    { label:'Fabrika',    pct:71, color:'#8b5cf6' },
    { label:'Boulevard',  pct:64, color:'#3b82f6' },
    { label:'Kazbegi',    pct:83, color:'#10b981' },
    { label:'Sighnaghi',  pct:67, color:'#ec4899' },
    { label:'Mtskheta',   pct:55, color:'#f97316' }
  ];

  /* ── FILTER DEFINITIONS ──────────────────────────────────────── */
  var FILTERS = [
    { id:'live',       label:'Live',        icon:'🟢', cls:'f-live',       on:true },
    { id:'rewards',    label:'Rewards',     icon:'🏆', cls:'f-rewards',    on:true },
    { id:'events',     label:'Events',      icon:'🎟️', cls:'f-events',     on:true },
    { id:'creators',   label:'Creators',    icon:'🎬', cls:'f-creators',   on:true },
    { id:'patriot',    label:'Patriot',     icon:'🛡️', cls:'f-patriot',    on:false },
    { id:'businesses', label:'Businesses',  icon:'🏪', cls:'f-businesses', on:false },
    { id:'nightlife',  label:'Nightlife',   icon:'🌙', cls:'f-nightlife',  on:false },
    { id:'ai',         label:'AI Hints',    icon:'🤖', cls:'f-ai',         on:true }
  ];

  var HEATMAPS = ['Activity','Rewards','Events','Reviews','Nightlife','Patriot','Creators'];

  /* ── TIME OF DAY ─────────────────────────────────────────────── */
  var TIME_CONFIG = {
    morning:   { simTime:'08:15', actMult:.6,  bgTop:'rgba(245,158,11,0.04)', label:'🌅 Morning' },
    afternoon: { simTime:'14:32', actMult:1,   bgTop:'rgba(59,130,246,0.03)', label:'☀️ Afternoon' },
    evening:   { simTime:'19:47', actMult:1.3, bgTop:'rgba(249,115,22,0.05)', label:'🌆 Evening' },
    night:     { simTime:'23:08', actMult:.8,  bgTop:'rgba(139,92,246,0.06)', label:'🌙 Night' }
  };
  var currentTOD = 'afternoon';

  /* ── STATE ───────────────────────────────────────────────────── */
  var counters = { users:2841, checkins:1204, rewards:387, missions:94, tickets:628, stories:319, xp:48290 };
  var activeHeatmap = 'Activity';
  var feedItems = [];
  var feedBadgeCount = 3;
  var canvas, ctx, W, H;
  var animFrame;
  var pulses = [];
  var particles = [];
  var connections = [];
  var hoverCity = null;

  /* ── INIT ────────────────────────────────────────────────────── */
  function init() {
    canvas = document.getElementById('worldCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', function() {
      hoverCity = null;
      document.getElementById('cityTip').style.opacity = '0';
      setTimeout(function(){ document.getElementById('cityTip').style.display='none'; }, 200);
    });

    buildFilters();
    buildHeatmapBtns();
    buildCityList();
    buildTrendBars();
    buildPredictions();
    seedFeed(6);
    buildSocialLayer();

    startAnimation();
    startCounters();
    setInterval(injectFeedItem, 5000);
    setInterval(updateTrendBars, 4000);
    startSimClock();

    setTimeOfDay('afternoon');
  }

  /* ── CANVAS ──────────────────────────────────────────────────── */
  function resizeCanvas() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = canvas.width = rect.width;
    H = canvas.height = rect.height;
    spawnParticles();
  }

  function cityPos(c) {
    return { x: c.x * W, y: c.y * H };
  }

  /* ── DRAW LOOP ───────────────────────────────────────────────── */
  function startAnimation() {
    spawnInitialPulses();
    loop();
  }

  function loop() {
    animFrame = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    drawConnections();
    drawParticles();
    drawHeatBlobs();
    drawPulses();
    drawCities();
    drawCityLabels();
    spawnRandomPulse();
  }

  /* ── GRID ────────────────────────────────────────────────────── */
  function drawGrid() {
    ctx.strokeStyle = 'rgba(0,200,255,0.04)';
    ctx.lineWidth = 1;
    var step = 60;
    for (var x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (var y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  /* ── CONNECTIONS ─────────────────────────────────────────────── */
  var CONN_PAIRS = [
    ['tbilisi','mtskheta'],['tbilisi','gori'],['tbilisi','sighnaghi'],
    ['tbilisi','kazbegi'],['gori','kutaisi'],['kutaisi','batumi'],
    ['kutaisi','zugdidi'],['tbilisi','batumi']
  ];

  function drawConnections() {
    var t = Date.now() / 1000;
    CONN_PAIRS.forEach(function(pair) {
      var a = CITIES.find(function(c){ return c.id === pair[0]; });
      var b = CITIES.find(function(c){ return c.id === pair[1]; });
      if (!a || !b) return;
      var pa = cityPos(a), pb = cityPos(b);
      var grad = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
      grad.addColorStop(0, 'rgba(0,200,255,0.08)');
      grad.addColorStop(.5,'rgba(0,200,255,0.18)');
      grad.addColorStop(1, 'rgba(0,200,255,0.08)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.setLineDash([4,8]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.setLineDash([]);

      /* data packet dot */
      var phase = (t * .3 + pair[0].length * .1) % 1;
      var dx = pa.x + (pb.x - pa.x) * phase;
      var dy = pa.y + (pb.y - pa.y) * phase;
      ctx.beginPath();
      ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,200,255,0.9)';
      ctx.fill();
    });
  }

  /* ── PARTICLES ───────────────────────────────────────────────── */
  function spawnParticles() {
    particles = [];
    var count = Math.floor(W * H / 12000);
    for (var i = 0; i < count; i++) {
      var isCyan = Math.random() > .7;
      particles.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
        r: Math.random() * 1.5 + .3,
        a: Math.random() * .4 + .1,
        rgb: isCyan ? '0,200,255' : '139,92,246'
      });
    }
  }

  function drawParticles() {
    particles.forEach(function(p) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.rgb + ',' + p.a + ')';
      ctx.fill();
    });
  }

  /* ── HEAT BLOBS ──────────────────────────────────────────────── */
  var HEATMAP_COLORS = {
    Activity:  [[0,200,255],[0,200,255]],
    Rewards:   [[245,158,11],[249,115,22]],
    Events:    [[249,115,22],[239,68,68]],
    Reviews:   [[16,185,129],[52,211,153]],
    Nightlife: [[236,72,153],[139,92,246]],
    Patriot:   [[16,185,129],[16,185,129]],
    Creators:  [[139,92,246],[236,72,153]]
  };

  function drawHeatBlobs() {
    var cols = HEATMAP_COLORS[activeHeatmap] || HEATMAP_COLORS.Activity;
    var t = Date.now() / 1000;
    CITIES.forEach(function(c) {
      var p = cityPos(c);
      var mult = TIME_CONFIG[currentTOD] ? TIME_CONFIG[currentTOD].actMult : 1;
      var r = (c.activity / 100) * 80 * mult + Math.sin(t + c.x * 10) * 8;
      var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      var col = cols[0];
      grad.addColorStop(0, 'rgba('+col[0]+','+col[1]+','+col[2]+',.18)');
      grad.addColorStop(.5,'rgba('+col[0]+','+col[1]+','+col[2]+',.07)');
      grad.addColorStop(1, 'rgba('+col[0]+','+col[1]+','+col[2]+',.0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
  }

  /* ── PULSES ──────────────────────────────────────────────────── */
  function spawnInitialPulses() {
    CITIES.forEach(function(c) {
      for (var i = 0; i < 3; i++) {
        pulses.push({ city:c, life:Math.random(), speed:.008 + Math.random()*.006 });
      }
    });
  }

  function spawnRandomPulse() {
    if (Math.random() < .012) {
      var c = CITIES[Math.floor(Math.random() * CITIES.length)];
      pulses.push({ city:c, life:0, speed:.007 + Math.random()*.005 });
    }
  }

  function drawPulses() {
    pulses = pulses.filter(function(p){ return p.life < 1; });
    pulses.forEach(function(p) {
      var pos = cityPos(p.city);
      var maxR = 60 + (p.city.activity / 100) * 40;
      var r = p.life * maxR;
      var alpha = (1 - p.life) * .6;
      var col = hexToRgb(p.city.color);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba('+col+','+alpha+')';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      p.life += p.speed;
    });
  }

  /* ── CITIES ──────────────────────────────────────────────────── */
  function drawCities() {
    var t = Date.now() / 1000;
    CITIES.forEach(function(c) {
      var p = cityPos(c);
      var isHover = hoverCity && hoverCity.id === c.id;
      var mult = TIME_CONFIG[currentTOD] ? TIME_CONFIG[currentTOD].actMult : 1;
      var baseR = 6 + (c.activity / 100) * 8;
      var r = baseR + Math.sin(t * 2 + c.x * 5) * 1.5;
      if (isHover) r += 4;

      var col = hexToRgb(c.color);

      /* glow */
      var grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.5);
      grd.addColorStop(0, 'rgba('+col+',.5)');
      grd.addColorStop(1, 'rgba('+col+',0)');
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = grd; ctx.fill();

      /* core */
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = c.color; ctx.fill();

      /* inner */
      ctx.beginPath(); ctx.arc(p.x, p.y, r * .45, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
    });
  }

  function drawCityLabels() {
    CITIES.forEach(function(c) {
      var p = cityPos(c);
      ctx.font = '600 11px Segoe UI,system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(226,244,255,.75)';
      ctx.fillText(c.icon + ' ' + c.name, p.x, p.y + 22);
      ctx.font = '10px Segoe UI,system-ui,sans-serif';
      ctx.fillStyle = 'rgba(148,180,200,.5)';
      ctx.fillText(c.activity + '%', p.x, p.y + 34);
    });
  }

  /* ── MOUSE ───────────────────────────────────────────────────── */
  function onMouseMove(e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var found = null;
    CITIES.forEach(function(c) {
      var p = cityPos(c);
      var dx = mx - p.x, dy = my - p.y;
      if (Math.sqrt(dx*dx + dy*dy) < 22) found = c;
    });
    hoverCity = found;
    var tip = document.getElementById('cityTip');
    if (found) {
      tip.style.display = 'block';
      tip.style.opacity = '1';
      tip.style.left = (e.clientX - rect.left + 16) + 'px';
      tip.style.top  = (e.clientY - rect.top  - 10) + 'px';
      tip.innerHTML = '<div class="ct-name">' + found.icon + ' ' + found.name + '</div>' +
        '<div class="ct-row"><span class="ct-val" style="color:' + found.color + '">' + found.activity + '% Active</span></div>' +
        '<div class="ct-row"><span>Users</span><span class="ct-val">' + (found.pop * 2.3 | 0) + '</span></div>' +
        '<div class="ct-row"><span>Check-ins</span><span class="ct-val">' + (found.pop * 1.1 | 0) + '</span></div>' +
        '<div class="ct-row"><span>Hotzone</span><span class="ct-val">' + found.zones[0] + '</span></div>';
    } else {
      tip.style.opacity = '0';
      setTimeout(function(){ if (!hoverCity) tip.style.display='none'; }, 200);
    }
  }

  /* ── UI BUILDERS ─────────────────────────────────────────────── */
  function buildFilters() {
    var el = document.getElementById('filterGrid');
    el.innerHTML = FILTERS.map(function(f) {
      return '<button class="flt '+f.cls+(f.on?' on':'')+'" onclick="toggleFilter(\''+f.id+'\',this)" data-id="'+f.id+'">' +
        '<div class="flt-dot"></div>' + f.label + '</button>';
    }).join('');
  }

  function buildHeatmapBtns() {
    var el = document.getElementById('heatmapBtns');
    el.innerHTML = HEATMAPS.map(function(h) {
      return '<button class="hm-btn'+(h===activeHeatmap?' active':'')+'" onclick="setHeatmap(\''+h+'\',this)">'+h+'</button>';
    }).join('');
  }

  function buildCityList() {
    var el = document.getElementById('cityList');
    el.innerHTML = CITIES.slice(0,6).map(function(c) {
      return '<div class="city-card" onclick="focusCity(\''+c.id+'\')">' +
        '<div class="city-av" style="background:'+hexToRgba(c.color,.15)+';border:1px solid '+hexToRgba(c.color,.3)+'">' + c.icon + '</div>' +
        '<div class="city-info">' +
          '<div class="city-name">' + c.name + '</div>' +
          '<div class="city-zone">' + c.zones.join(' · ') + '</div>' +
          '<div class="city-bar-wrap"><div class="city-bar" style="width:'+c.activity+'%;background:'+c.color+'"></div></div>' +
        '</div>' +
        '<div class="city-pulse" style="color:'+c.color+'">' + c.activity + '%</div>' +
      '</div>';
    }).join('');
  }

  function buildTrendBars() {
    var el = document.getElementById('trendBars');
    el.innerHTML = ZONES.map(function(z) {
      return '<div class="trend-bar">' +
        '<span class="tb-label">' + z.label + '</span>' +
        '<div class="tb-track"><div class="tb-fill" style="width:'+z.pct+'%;background:'+z.color+'"></div></div>' +
        '<span class="tb-pct">' + z.pct + '%</span>' +
      '</div>';
    }).join('');
  }

  function updateTrendBars() {
    ZONES.forEach(function(z) {
      var delta = (Math.random() - .48) * 6 | 0;
      z.pct = Math.max(10, Math.min(99, z.pct + delta));
    });
    buildTrendBars();
  }

  function buildPredictions() {
    var el = document.getElementById('predList');
    el.innerHTML = PREDICTIONS.map(function(p) {
      return '<div class="pred '+p.cls+'">' +
        '<div class="pred-title">' + p.icon + ' ' + p.title + '</div>' +
        '<div class="pred-sub">' + p.sub + '</div>' +
        '<div class="pred-conf">AI: ' + p.conf + '</div>' +
      '</div>';
    }).join('');
  }

  function seedFeed(n) {
    var shuffled = FEED_POOL.slice().sort(function(){ return Math.random()-.5; });
    for (var i = 0; i < Math.min(n, shuffled.length); i++) {
      feedItems.unshift(shuffled[i]);
    }
    renderFeed();
  }

  function injectFeedItem() {
    var item = FEED_POOL[Math.floor(Math.random() * FEED_POOL.length)];
    feedItems.unshift(item);
    if (feedItems.length > 12) feedItems.pop();
    feedBadgeCount++;
    document.getElementById('feedBadge').textContent = feedBadgeCount;
    renderFeed();
  }

  function renderFeed() {
    var el = document.getElementById('aiFeed');
    var now = new Date();
    el.innerHTML = feedItems.slice(0, 8).map(function(f, i) {
      var mins = i * 3;
      var timeStr = mins === 0 ? 'Just now' : mins + 'm ago';
      return '<div class="feed-item">' +
        '<div class="feed-icon">' + f.icon + '</div>' +
        '<div>' +
          '<div class="feed-text">' + f.text + '</div>' +
          '<div class="feed-time">' + timeStr + ' · ' + (f.city ? f.city.charAt(0).toUpperCase()+f.city.slice(1) : 'Georgia') + '</div>' +
          '<span class="feed-tag tag-' + f.tag + '">' + f.tag + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function buildSocialLayer() {
    var el = document.getElementById('socialLayer');
    var avatarData = [
      { names:['G','N','L'], x:'38%', y:'45%', count:'+12 nearby', delay:'0s' },
      { names:['A','M','T'], x:'55%', y:'38%', count:'+7 nearby',  delay:'1.2s' },
      { names:['K','S'],     x:'25%', y:'65%', count:'+5 nearby',  delay:'0.6s' },
      { names:['D','E','V'], x:'68%', y:'52%', count:'+9 nearby',  delay:'1.8s' },
      { names:['R','I'],     x:'48%', y:'20%', count:'+3 nearby',  delay:'0.3s' }
    ];
    var colors = ['#00c8ff','#10b981','#8b5cf6','#f59e0b','#ec4899','#3b82f6'];
    el.innerHTML = avatarData.map(function(g) {
      var avs = g.names.map(function(n, i) {
        return '<div class="av-mini" style="background:'+colors[i%colors.length]+';color:#000;animation-delay:'+g.delay+'">' + n + '</div>';
      }).join('');
      return '<div class="avatar-cluster" style="left:'+g.x+';top:'+g.y+';animation-delay:'+g.delay+'">' +
        '<div class="av-stack">' + avs + '</div>' +
        '<div class="av-count">' + g.count + '</div>' +
      '</div>';
    }).join('');
  }

  /* ── COUNTERS ────────────────────────────────────────────────── */
  function startCounters() {
    setInterval(function() {
      var mult = TIME_CONFIG[currentTOD] ? TIME_CONFIG[currentTOD].actMult : 1;
      counters.users    += Math.floor(Math.random() * 8 * mult);
      counters.checkins += Math.floor(Math.random() * 6 * mult);
      counters.rewards  += Math.floor(Math.random() * 3 * mult);
      counters.missions += Math.random() < .3 * mult ? 1 : 0;
      counters.tickets  += Math.floor(Math.random() * 4 * mult);
      counters.stories  += Math.floor(Math.random() * 3 * mult);
      counters.xp       += Math.floor(Math.random() * 120 * mult);
      updateCounterDOM();
    }, 3000);
  }

  function updateCounterDOM() {
    function fmt(n) {
      return n >= 1000 ? (n/1000).toFixed(1).replace('.0','') + 'K' : n;
    }
    var map = {
      'ctr-users':   fmt(counters.users),
      'ctr-checkins':fmt(counters.checkins),
      'ctr-rewards': fmt(counters.rewards),
      'ctr-missions':counters.missions,
      'ctr-tickets': fmt(counters.tickets),
      'ctr-stories': fmt(counters.stories),
      'bc-users':    fmt(counters.users),
      'bc-checkins': fmt(counters.checkins),
      'bc-tickets':  fmt(counters.tickets),
      'bc-rewards':  fmt(counters.rewards),
      'bc-missions': counters.missions,
      'bc-stories':  fmt(counters.stories),
      'bc-xp':       fmt(counters.xp)
    };
    Object.keys(map).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = map[id];
    });
  }

  /* ── SIM CLOCK ───────────────────────────────────────────────── */
  function startSimClock() {
    setInterval(function() {
      var el = document.getElementById('simClock');
      if (!el) return;
      var parts = el.textContent.split(':');
      var h = parseInt(parts[0]), m = parseInt(parts[1]);
      m += 1;
      if (m >= 60) { m = 0; h = (h + 1) % 24; }
      el.textContent = (h < 10 ? '0'+h : h) + ':' + (m < 10 ? '0'+m : m);
    }, 800);
  }

  /* ── PUBLIC FUNCTIONS ────────────────────────────────────────── */
  window.setTimeOfDay = function(tod) {
    currentTOD = tod;
    document.querySelectorAll('.time-btn').forEach(function(b) {
      b.classList.toggle('active', b.textContent.toLowerCase().indexOf(tod.replace('afternoon','day')) > -1 || b.textContent.toLowerCase().indexOf(tod) > -1);
    });
    var ov = document.getElementById('timeOverlay');
    ov.className = 'time-overlay ' + tod;
    var cfg = TIME_CONFIG[tod];
    if (cfg) {
      document.getElementById('simClock').textContent = cfg.simTime;
    }
    var mult = cfg ? cfg.actMult : 1;
    CITIES.forEach(function(c) {
      c.activity = Math.max(20, Math.min(99, (c.activity * .5 + 50 * mult) | 0));
    });
    buildCityList();
  };

  window.toggleFilter = function(id, btn) {
    var f = FILTERS.find(function(f){ return f.id === id; });
    if (!f) return;
    f.on = !f.on;
    btn.classList.toggle('on', f.on);
  };

  window.setHeatmap = function(name, btn) {
    activeHeatmap = name;
    document.querySelectorAll('.hm-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
  };

  window.focusCity = function(id) {
    var c = CITIES.find(function(c){ return c.id === id; });
    if (!c) return;
    hoverCity = c;
    setTimeout(function(){ hoverCity = null; }, 2500);
  };

  /* ── HELPERS ─────────────────────────────────────────────────── */
  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1,3),16);
    var g = parseInt(hex.slice(3,5),16);
    var b = parseInt(hex.slice(5,7),16);
    return r+','+g+','+b;
  }
  function hexToRgba(hex, a) {
    return 'rgba('+hexToRgb(hex)+','+a+')';
  }

  /* ── BOOT ────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
