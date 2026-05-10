/* GeoHub — Life Graph / AI Companion */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     CURRENT USER — real Firebase user takes priority over mock data
  ══════════════════════════════════════════════════════════════ */
  var _fbUser = (function () {
    try { var u = JSON.parse(localStorage.getItem('geohub_auth_user') || 'null'); return (u && u.isFirebaseUser) ? u : null; } catch (e) { return null; }
  })();

  var BASE = _fbUser ? {
    fullName: _fbUser.fullName || _fbUser.email || 'GeoHub User',
    username: _fbUser.username || (_fbUser.email || '').split('@')[0] || 'user',
    city: _fbUser.city || 'Georgia',
    explorerLevel: 'New Explorer',
    xp: _fbUser.xp || 250,
    rank: null,
    badges: _fbUser.badges || [],
    interests: _fbUser.interests || [],
    followers: 0, following: 0, postsCount: 0,
    visitedPlaces: 0, trustScore: 0, accountType: _fbUser.accountType || 'Explorer',
  } : (typeof MOCK_USERS !== 'undefined' && Array.isArray(MOCK_USERS) && MOCK_USERS[0]) ? MOCK_USERS[0] : {
    fullName: 'Nino Gelashvili', username: 'nino.explorer',
    city: 'Tbilisi', explorerLevel: 'Gold Explorer', xp: 8420, rank: 14,
    badges: ['Café Hunter', 'Weekend Explorer', 'Top Reviewer'],
    interests: ['cafes', 'events', 'photography'],
    followers: 1240, following: 318, postsCount: 186,
    visitedPlaces: 148, trustScore: 94, accountType: 'Creator',
  };

  var P = {
    user:           BASE,
    initials:       (BASE.fullName || 'GH').split(' ').map(function(n){ return n[0] || ''; }).join('').slice(0, 2).toUpperCase(),
    memberSince:    _fbUser ? 'Jan 2026' : 'Jan 2025',
    visitedPlaces:  BASE.visitedPlaces || (_fbUser ? 0 : 148),
    challengesDone: _fbUser ? 0 : 18,
    eventsAttended: _fbUser ? 0 : 31,
    reviewsWritten: _fbUser ? 0 : 74,
    rewardsUnlocked: _fbUser ? 0 : 23,
    friendsCount:   _fbUser ? 0 : 47,
    photosShared:   _fbUser ? 0 : 312,

    radar: _fbUser ? [
      { label:'Social', value:0 }, { label:'Discovery', value:0 }, { label:'Reviews', value:0 },
      { label:'Challenges', value:0 }, { label:'Events', value:0 }, { label:'Community', value:0 },
    ] : [
      { label:'Social',     value:82 },
      { label:'Discovery',  value:91 },
      { label:'Reviews',    value:88 },
      { label:'Challenges', value:67 },
      { label:'Events',     value:74 },
      { label:'Community',  value:79 },
    ],

    categories: _fbUser ? [
      { label:'Cafés & Coffee',    icon:'☕', pct:0, color:'#f59e0b' },
      { label:'Photography Spots', icon:'📸', pct:0, color:'#3b82f6' },
      { label:'Events & Markets',  icon:'🎪', pct:0, color:'#8b5cf6' },
      { label:'Restaurants',       icon:'🍽️', pct:0, color:'#ef4444' },
      { label:'Parks & Nature',    icon:'🌿', pct:0, color:'#10b981' },
      { label:'Art & Culture',     icon:'🎨', pct:0, color:'#ec4899' },
    ] : [
      { label:'Cafés & Coffee',     icon:'☕', pct:88, color:'#f59e0b' },
      { label:'Photography Spots',  icon:'📸', pct:79, color:'#3b82f6' },
      { label:'Events & Markets',   icon:'🎪', pct:71, color:'#8b5cf6' },
      { label:'Restaurants',        icon:'🍽️', pct:64, color:'#ef4444' },
      { label:'Parks & Nature',     icon:'🌿', pct:55, color:'#10b981' },
      { label:'Art & Culture',      icon:'🎨', pct:48, color:'#ec4899' },
    ],

    weeklyPattern: _fbUser ? [
      { day:'Mo', level:0 }, { day:'Tu', level:0 }, { day:'We', level:0 },
      { day:'Th', level:0 }, { day:'Fr', level:0 }, { day:'Sa', level:0 },
      { day:'Su', level:0 },
    ] : [
      { day:'Mo', level:2 }, { day:'Tu', level:1 }, { day:'We', level:2 },
      { day:'Th', level:1 }, { day:'Fr', level:3 }, { day:'Sa', level:4 },
      { day:'Su', level:4 },
    ],

    xpMonthly: _fbUser ? [
      { m:'Jan', xp:0 }, { m:'Feb', xp:0 }, { m:'Mar', xp:0 },
      { m:'Apr', xp:0 }, { m:'May', xp: BASE.xp || 250 }, { m:'Jun', xp:0 },
      { m:'Jul', xp:0 }, { m:'Aug', xp:0 }, { m:'Sep', xp:0 },
      { m:'Oct', xp:0 }, { m:'Nov', xp:0 }, { m:'Dec', xp:0 },
    ] : [
      { m:'Jan', xp:420  }, { m:'Feb', xp:380  }, { m:'Mar', xp:520  },
      { m:'Apr', xp:640  }, { m:'May', xp:710  }, { m:'Jun', xp:890  },
      { m:'Jul', xp:960  }, { m:'Aug', xp:1080 }, { m:'Sep', xp:780  },
      { m:'Oct', xp:820  }, { m:'Nov', xp:650  }, { m:'Dec', xp:570  },
    ],

    districts: _fbUser ? [] : [
      { name:'Fabrika',    visits:48, color:'#10b981', pct:95 },
      { name:'Vake',       visits:34, color:'#3b82f6', pct:68 },
      { name:'Rustaveli',  visits:29, color:'#8b5cf6', pct:58 },
      { name:'Mtatsminda', visits:22, color:'#f59e0b', pct:44 },
      { name:'Old Town',   visits:18, color:'#ec4899', pct:36 },
      { name:'Saburtalo',  visits:12, color:'#06b6d4', pct:24 },
      { name:'Avlabari',   visits:4,  color:'#475569', pct: 8 },
      { name:'Didube',     visits:2,  color:'#334155', pct: 4 },
    ],

    timeline: _fbUser ? [] : [
      { type:'place',     icon:'📍', color:'#10b981', date:'May 3, 2026',  title:'Checked in at Fabrika Tbilisi',         sub:'Café · Tbilisi · ⭐ 4.8',                              xp:35  },
      { type:'review',    icon:'✍️', color:'#3b82f6', date:'Apr 28, 2026', title:'Wrote a review for Roasters Lab',       sub:'"Best specialty coffee in the city."',                 xp:55  },
      { type:'challenge', icon:'🏆', color:'#f59e0b', date:'Apr 20, 2026', title:'Completed "Café Hopper" Challenge',     sub:'Visited 10 unique cafés in 30 days',                   xp:120 },
      { type:'event',     icon:'🎪', color:'#8b5cf6', date:'Apr 15, 2026', title:'Attended Fabrika Night Market',         sub:'Group of 14 · social attendance bonus',                xp:45  },
      { type:'reward',    icon:'🎁', color:'#ec4899', date:'Apr 8, 2026',  title:'Claimed: Free Coffee at Roasters Lab',  sub:'QR code used at point of sale',                        xp:0   },
      { type:'friend',    icon:'🤝', color:'#06b6d4', date:'Mar 30, 2026', title:'Connected with Sandro Maisuradze',      sub:'Shared interests: photography, architecture',          xp:10  },
      { type:'place',     icon:'📍', color:'#10b981', date:'Mar 22, 2026', title:'First visit to Sololaki district',      sub:'New zone unlocked! Hidden spots discovered.',          xp:70  },
      { type:'challenge', icon:'🏆', color:'#f59e0b', date:'Mar 10, 2026', title:'Completed "Weekend Warrior" Challenge', sub:'Active every weekend for 4 consecutive weeks',         xp:180 },
      { type:'review',    icon:'✍️', color:'#3b82f6', date:'Feb 28, 2026', title:'Review featured in GeoHub Picks',       sub:'Your Shavi Lomi review reached 840 views',             xp:30  },
      { type:'place',     icon:'📍', color:'#10b981', date:'Feb 14, 2026', title:'Valentine\'s Day — Rooms Hotel',        sub:'Special event badge unlocked',                        xp:50  },
    ],

    friends: _fbUser ? [] : [
      { name:'Sandro Maisuradze',   ini:'SM', color:'#3b82f6', city:'Tbilisi', overlap:87, tag:'Photography'  },
      { name:'Tamo Jikia',          ini:'TJ', color:'#8b5cf6', city:'Tbilisi', overlap:74, tag:'Events'       },
      { name:'Mariam Chikovanidze', ini:'MC', color:'#10b981', city:'Tbilisi', overlap:91, tag:'Cafés'        },
      { name:'Giorgi Beridze',      ini:'GB', color:'#f59e0b', city:'Tbilisi', overlap:62, tag:'Food'         },
      { name:'Ana Kvaratskhelia',   ini:'AK', color:'#22c55e', city:'Kutaisi', overlap:55, tag:'Community'    },
    ],

    influenceScore: _fbUser ? 0 : 78,

    sharedInterests: _fbUser ? [] : [
      { label:'Cafés',       count:12, color:'#f59e0b' },
      { label:'Photography', count:8,  color:'#3b82f6' },
      { label:'Events',      count:15, color:'#8b5cf6' },
      { label:'Nightlife',   count:6,  color:'#ec4899' },
      { label:'Art',         count:9,  color:'#06b6d4' },
    ],

    forecasts: [
      { icon:'⛰️', type:'Next Interest', title:'Mountain & Hiking Routes',        reason:'Your photography style matches outdoor explorers. 4 of your close connections are active hikers.',       conf:84, cc:'#10b981' },
      { icon:'🏅', type:'Achievement',   title:'Top Reviewer Badge',              reason:'You\'re 6 reviews away from the milestone. Your average review quality is 4.7/5.',                      conf:91, cc:'#f59e0b' },
      { icon:'🌇', type:'Discovery',     title:'Mtatsminda District',             reason:'Based on your café and photography activity, Mtatsminda matches perfectly — you haven\'t explored it.', conf:78, cc:'#8b5cf6' },
      { icon:'🤝', type:'Connection',    title:'Luka Abashidze',                  reason:'Mountain photographer · 15.6K reach · 73% activity pattern overlap with you.',                          conf:69, cc:'#3b82f6' },
      { icon:'🏪', type:'Business',      title:'Sololaki Coffee Roasters',        reason:'Just opened 800m from your favourite check-in zone. Matches your top 2 categories.',                   conf:88, cc:'#10b981' },
      { icon:'⚡', type:'Challenge',     title:'"District Master" Challenge',     reason:'You\'ve visited 5/8 required districts. 2 more visits = 320 XP waiting.',                              conf:95, cc:'#f59e0b' },
    ],

    reflStats: _fbUser ? [
      { icon:'⚡', v: String(BASE.xp || 250),  l:'XP Earned',       color:'#10b981' },
      { icon:'📍', v: '0',   l:'Places Visited',   color:'#3b82f6' },
      { icon:'✍️', v: '0',   l:'Reviews Written',  color:'#8b5cf6' },
      { icon:'🏆', v: '0',   l:'Challenges Done',  color:'#f59e0b' },
      { icon:'🎪', v: '0',   l:'Events Attended',  color:'#ec4899' },
      { icon:'🎁', v: '0',   l:'Rewards Claimed',  color:'#06b6d4' },
      { icon:'🤝', v: '0',   l:'Connections Made', color:'#22c55e' },
      { icon:'📸', v: '0',   l:'Photos Shared',    color:'#a855f7' },
    ] : [
      { icon:'⚡', v:'8,420', l:'XP Earned',       color:'#10b981' },
      { icon:'📍', v:'148',   l:'Places Visited',   color:'#3b82f6' },
      { icon:'✍️', v:'74',    l:'Reviews Written',  color:'#8b5cf6' },
      { icon:'🏆', v:'18',    l:'Challenges Done',  color:'#f59e0b' },
      { icon:'🎪', v:'31',    l:'Events Attended',  color:'#ec4899' },
      { icon:'🎁', v:'23',    l:'Rewards Claimed',  color:'#06b6d4' },
      { icon:'🤝', v:'47',    l:'Connections Made', color:'#22c55e' },
      { icon:'📸', v:'312',   l:'Photos Shared',    color:'#a855f7' },
    ],

    growthBadges: [
      { icon:'🥇', title:'Gold Explorer',    desc:'Reached Gold Explorer level'     },
      { icon:'☕', title:'Café Connoisseur', desc:'50+ café check-ins this year'    },
      { icon:'🌟', title:'Featured Reviewer',desc:'Review highlighted in GeoHub Picks' },
      { icon:'🔥', title:'30-Day Streak',    desc:'Active every day for a full month' },
      { icon:'👥', title:'Social Butterfly', desc:'40+ new connections made'        },
      { icon:'🗺️', title:'City Explorer',    desc:'5 Tbilisi districts unlocked'    },
    ],

    topMoments: [
      { icon:'☕', bg:'rgba(245,158,11,0.1)',  bd:'rgba(245,158,11,0.2)',  title:'Favourite Place',    sub:'Fabrika Tbilisi — visited 48 times this year'      },
      { icon:'🏆', bg:'rgba(16,185,129,0.1)',  bd:'rgba(16,185,129,0.2)',  title:'Best Month',         sub:'August — 1,080 XP earned in a single month'        },
      { icon:'✍️', bg:'rgba(59,130,246,0.1)',  bd:'rgba(59,130,246,0.2)',  title:'Top Review',         sub:'Shavi Lomi review — 840 views, 4.9 stars'          },
      { icon:'🌟', bg:'rgba(168,85,247,0.1)',  bd:'rgba(168,85,247,0.2)',  title:'Biggest Discovery',  sub:'Sololaki — first to review 3 hidden spots'         },
    ],
  };

  /* ══════════════════════════════════════════════════════════════
     IDENTITY ENGINE
  ══════════════════════════════════════════════════════════════ */
  var IDS = [
    { label:'Café Hunter',        icon:'☕', color:'#f59e0b', bg:'rgba(245,158,11,0.12)', bd:'rgba(245,158,11,0.28)',  test:function(p){ return p.categories[0] && p.categories[0].label.includes('Café'); } },
    { label:'Weekend Adventurer', icon:'🎒', color:'#3b82f6', bg:'rgba(59,130,246,0.12)', bd:'rgba(59,130,246,0.28)', test:function(p){ return p.weeklyPattern[5].level >= 3; } },
    { label:'Photo Journalist',   icon:'📸', color:'#8b5cf6', bg:'rgba(139,92,246,0.12)', bd:'rgba(139,92,246,0.28)', test:function(p){ return p.photosShared > 200; } },
    { label:'Social Connector',   icon:'🤝', color:'#ec4899', bg:'rgba(236,72,153,0.12)', bd:'rgba(236,72,153,0.28)', test:function(p){ return p.friendsCount > 40; } },
    { label:'Local Legend',       icon:'🏆', color:'#f59e0b', bg:'rgba(245,158,11,0.12)', bd:'rgba(245,158,11,0.28)', test:function(p){ return p.user.trustScore > 90 && p.visitedPlaces > 100; } },
    { label:'City Creator',       icon:'✨', color:'#a855f7', bg:'rgba(168,85,247,0.12)', bd:'rgba(168,85,247,0.28)', test:function(p){ return p.user.accountType === 'Creator'; } },
    { label:'Trusted Explorer',   icon:'🛡️', color:'#10b981', bg:'rgba(16,185,129,0.12)', bd:'rgba(16,185,129,0.28)', test:function(p){ return p.user.trustScore > 85; } },
    { label:'Event Addict',       icon:'🎪', color:'#06b6d4', bg:'rgba(6,182,212,0.12)',  bd:'rgba(6,182,212,0.28)',  test:function(p){ return p.eventsAttended > 25; } },
  ];

  function identities() {
    return IDS.filter(function(id){ try{ return id.test(P); }catch(e){ return false; } });
  }

  /* ══════════════════════════════════════════════════════════════
     AI INSIGHTS
  ══════════════════════════════════════════════════════════════ */
  var INSIGHTS = [
    { icon:'🌙', text:'You\'re most active on <strong>Friday and Saturday evenings</strong> — a true City Night Owl.' },
    { icon:'☕', text:'You\'ve visited <strong>' + Math.floor(P.visitedPlaces * 0.32) + ' cafés</strong> this year — one of GeoHub\'s top café hunters.' },
    { icon:'📈', text:'Your trust score grew <strong>14% this month</strong>. You\'re trending toward Verified Expert.' },
    { icon:'🤝', text:'You share <strong>87% of interests</strong> with Sandro Maisuradze. A collab could go far.' },
    { icon:'📍', text:'Your most-visited spot is <strong>Fabrika Tbilisi</strong> — 48 check-ins and counting.' },
    { icon:'⚡', text:'<strong>August was your best month</strong> — 1,080 XP. You were on fire.' },
    { icon:'🎪', text:'You attended <strong>' + P.eventsAttended + ' events</strong> this year. Top 5% of city event-goers.' },
    { icon:'🌟', text:'Your Shavi Lomi review reached <strong>840 views</strong>. You\'re becoming a real city voice.' },
  ];

  /* ══════════════════════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════════════════════ */
  function qs(id){ return document.getElementById(id); }

  function animBars(root, attr, delay) {
    setTimeout(function(){
      if (!root) return;
      root.querySelectorAll('[data-' + attr + ']').forEach(function(el){
        el.style.width = el.dataset[attr];
        el.style.transition = 'width 1.1s cubic-bezier(.4,0,.2,1)';
      });
    }, delay || 120);
  }

  function animHeights(root, delay) {
    setTimeout(function(){
      if (!root) return;
      root.querySelectorAll('[data-h]').forEach(function(el){
        el.style.height = el.dataset.h;
        el.style.transition = 'height 1.1s cubic-bezier(.4,0,.2,1)';
      });
    }, delay || 120);
  }

  /* ══════════════════════════════════════════════════════════════
     HERO
  ══════════════════════════════════════════════════════════════ */
  function renderHero() {
    try {
      var u = P.user;
      var core = qs('lgAvCore');
      if (core) core.textContent = P.initials;

      var fill = qs('lgAvFill');
      if (fill) {
        var circ = 2 * Math.PI * 48;
        var offset = circ - (u.trustScore / 100) * circ;
        fill.setAttribute('stroke-dasharray', circ.toFixed(1) + ' ' + circ.toFixed(1));
        fill.setAttribute('stroke-dashoffset', circ.toFixed(1));
        setTimeout(function(){ fill.style.strokeDashoffset = offset.toFixed(1); }, 350);
      }

      var nm = qs('lgPname');
      if (nm) nm.textContent = u.fullName;

      var lv = qs('lgPlevel');
      if (lv) {
        lv.textContent = u.explorerLevel;
        lv.style.cssText += ';background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);color:#f59e0b';
      }

      var mt = qs('lgPmeta');
      if (mt) mt.innerHTML =
        '<span><i class="fas fa-map-marker-alt" style="color:#10b981"></i> ' + (u.city || 'Tbilisi') + '</span>' +
        '<span><i class="fas fa-calendar" style="color:#3b82f6"></i> Since ' + P.memberSince + '</span>' +
        '<span><i class="fas fa-shield-alt" style="color:#8b5cf6"></i> Trust ' + u.trustScore + '/100</span>';

      var ch = qs('lgIdChips');
      if (ch) ch.innerHTML = identities().map(function(id, i){
        return '<div class="lg-id-chip" style="background:' + id.bg + ';border:1px solid ' + id.bd + ';color:' + id.color + ';animation-delay:' + (i*0.07) + 's">' +
          id.icon + ' ' + id.label + '</div>';
      }).join('');

      var hs = qs('lgHStats');
      var patriotXP = 0;
      try { var ptTotals = JSON.parse(localStorage.getItem('geohub_totals')||'{}'); patriotXP = ptTotals.xp || 2840; } catch(_){}
      if (hs) hs.innerHTML = [
        { ico:'⚡', bg:'rgba(16,185,129,0.12)', c:'#10b981', v:(u.xp||P.visitedPlaces*50).toLocaleString(), l:'Total XP'  },
        { ico:'📍', bg:'rgba(59,130,246,0.12)', c:'#3b82f6', v:P.visitedPlaces,  l:'Places'     },
        { ico:'🇬🇪', bg:'rgba(249,115,22,0.12)', c:'#f97316', v:patriotXP.toLocaleString(), l:'Patriot XP', link:'patriot.html' },
        { ico:'🏆', bg:'rgba(245,158,11,0.12)', c:'#f59e0b', v:P.challengesDone, l:'Challenges' },
      ].map(function(s){
        var inner = '<div class="lg-hstat-ico" style="background:' + s.bg + ';color:' + s.c + '">' + s.ico + '</div>' +
          '<div><div class="lg-hstat-v">' + s.v + '</div><div class="lg-hstat-l">' + s.l + '</div></div>';
        return s.link
          ? '<a href="' + s.link + '" class="lg-hstat" style="text-decoration:none;cursor:pointer;border-color:rgba(249,115,22,0.25)">' + inner + '</a>'
          : '<div class="lg-hstat">' + inner + '</div>';
      }).join('');

      var rt = qs('lgReflTitle');
      if (rt) rt.textContent = 'What a Year, ' + ((u.fullName || '').split(' ')[0]) + ' 🌟';
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     INSIGHTS
  ══════════════════════════════════════════════════════════════ */
  function renderInsights() {
    try {
      var el = qs('lgInsights');
      if (!el) return;
      el.innerHTML = INSIGHTS.map(function(ins){
        return '<div class="lg-ins-card"><div class="lg-ins-ico">' + ins.icon + '</div><div class="lg-ins-text">' + ins.text + '</div></div>';
      }).join('');
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     RADAR CHART (pure SVG)
  ══════════════════════════════════════════════════════════════ */
  function renderRadar() {
    try {
      var el = qs('lgRadar');
      if (!el) return;
      var dims = P.radar, n = dims.length;
      var allZero = dims.every(function(d){ return !d.value; });
      if (allZero) {
        el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:0.83rem"><i class="fas fa-chart-pie" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.2"></i>Activity graph will appear as you explore</div>';
        var leg = qs('lgRadarLeg'); if (leg) leg.innerHTML = '';
        return;
      }
      var cx = 110, cy = 110, R = 88;
      var step = (2 * Math.PI) / n;

      function pt(i, r) {
        var a = i * step - Math.PI / 2;
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
      }

      var bg = [0.25, 0.5, 0.75, 1].map(function(s){
        return '<polygon points="' + dims.map(function(_,i){ var p=pt(i,R*s); return p.x+','+p.y; }).join(' ') +
          '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>';
      }).join('');

      var lines = dims.map(function(_,i){
        var p = pt(i, R);
        return '<line x1="'+cx+'" y1="'+cy+'" x2="'+p.x+'" y2="'+p.y+'" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>';
      }).join('');

      var poly = '<polygon points="' + dims.map(function(d,i){ var p=pt(i,R*d.value/100); return p.x+','+p.y; }).join(' ') +
        '" fill="rgba(16,185,129,0.14)" stroke="#10b981" stroke-width="1.5"/>';

      var dots = dims.map(function(d,i){
        var p = pt(i, R * d.value / 100);
        return '<circle cx="'+p.x+'" cy="'+p.y+'" r="3.5" fill="#10b981" stroke="#04050d" stroke-width="1.5"/>';
      }).join('');

      var lbls = dims.map(function(d,i){
        var p = pt(i, R + 18);
        return '<text x="'+p.x+'" y="'+p.y+'" text-anchor="middle" dominant-baseline="middle" fill="#6b7280" font-size="10" font-weight="700" font-family="Inter,system-ui,sans-serif">'+d.label+'</text>';
      }).join('');

      el.innerHTML = '<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">' + bg + lines + poly + dots + lbls + '</svg>';

      var leg = qs('lgRadarLeg');
      if (leg) leg.innerHTML = dims.map(function(d){
        return '<div class="lg-radar-leg-item"><div class="lg-rl-dot" style="background:#10b981;opacity:' + (0.35 + d.value/100*0.65).toFixed(2) + '"></div><span>' + d.label + ': <strong style="color:var(--text-primary)">' + d.value + '%</strong></span></div>';
      }).join('');
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     CATEGORY BARS
  ══════════════════════════════════════════════════════════════ */
  function renderCBars() {
    try {
      var el = qs('lgCBars');
      if (!el) return;
      var allZero = P.categories.every(function(c){ return !c.pct; });
      if (allZero) {
        el.innerHTML = '<div style="text-align:center;padding:32px 20px;color:var(--text-muted);font-size:0.83rem"><i class="fas fa-compass" style="font-size:1.8rem;display:block;margin-bottom:10px;opacity:0.2"></i>Categories will fill in as you check in to places</div>';
        return;
      }
      el.innerHTML = P.categories.map(function(c){
        return '<div>' +
          '<div class="lg-cbar-hd"><span class="lg-cbar-lbl">' + c.icon + ' ' + c.label + '</span><span class="lg-cbar-v">' + c.pct + '%</span></div>' +
          '<div class="lg-cbar-track"><div class="lg-cbar-fill" style="background:' + c.color + '" data-w="' + c.pct + '%"></div></div>' +
          '</div>';
      }).join('');
      animBars(el, 'w');
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     WEEKLY ACTIVITY
  ══════════════════════════════════════════════════════════════ */
  function renderActGrid() {
    try {
      var el = qs('lgActGrid');
      if (!el) return;
      var cols = ['rgba(255,255,255,0.04)','rgba(16,185,129,0.2)','rgba(16,185,129,0.44)','rgba(16,185,129,0.68)','#10b981'];
      el.innerHTML = P.weeklyPattern.map(function(d){
        return '<div class="lg-act-cell" style="background:' + (cols[d.level]||cols[0]) + ';min-height:44px">' + d.day + '</div>';
      }).join('');
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     RECENT MOMENTS
  ══════════════════════════════════════════════════════════════ */
  function renderRecent() {
    try {
      var el = qs('lgRecent');
      if (!el) return;
      el.innerHTML = P.timeline.slice(0, 4).map(function(m){
        return '<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05)">' +
          '<div style="width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0">' + m.icon + '</div>' +
          '<div style="flex:1"><div style="font-size:0.8rem;font-weight:700;color:var(--text-primary);margin-bottom:2px">' + m.title + '</div><div style="font-size:0.69rem;color:var(--text-muted)">' + m.date + '</div></div>' +
          (m.xp ? '<span style="font-size:0.69rem;font-weight:700;color:#10b981;padding:2px 8px;background:rgba(16,185,129,0.1);border-radius:100px;flex-shrink:0">+' + m.xp + ' XP</span>' : '') +
          '</div>';
      }).join('');
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     TIMELINE
  ══════════════════════════════════════════════════════════════ */
  function renderTimeline() {
    try {
      var el = qs('lgTimeline');
      if (!el) return;
      if (!P.timeline.length) {
        el.innerHTML = '<div style="text-align:center;padding:48px 20px;color:var(--text-muted);font-size:0.85rem"><i class="fas fa-clock-rotate-left" style="font-size:2rem;display:block;margin-bottom:12px;opacity:0.2"></i>Your journey timeline will appear here as you explore, review, and connect.</div>';
        return;
      }
      el.innerHTML = P.timeline.map(function(item, i){
        return '<div class="lg-tl-item lg-fade" style="animation-delay:' + (i*0.06) + 's">' +
          '<div class="lg-tl-dot" style="border-color:' + item.color + ';color:' + item.color + '">' + item.icon + '</div>' +
          '<div class="lg-tl-card">' +
            '<div class="lg-tl-date">' + item.date + '</div>' +
            '<div class="lg-tl-title">' + item.title + '</div>' +
            '<div class="lg-tl-sub">' + item.sub + '</div>' +
            (item.xp ? '<div class="lg-tl-xp"><i class="fas fa-bolt"></i> +' + item.xp + ' XP</div>' : '') +
          '</div>' +
          '</div>';
      }).join('');
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     HEATMAP CALENDAR
  ══════════════════════════════════════════════════════════════ */
  function renderHeatmap() {
    try {
      var el = qs('lgCalGrid');
      if (!el) return;

      var today = new Date();
      var start = new Date(today);
      start.setDate(start.getDate() - 363);
      while (start.getDay() !== 0) { start.setDate(start.getDate() - 1); }

      var html = '', active = 0, d = new Date(start);
      for (var w = 0; w < 52; w++) {
        html += '<div class="lg-cal-col">';
        for (var day = 0; day < 7; day++) {
          var lv = 0;
          if (!_fbUser) {
            // Demo mode: use random mock data
            var isWe = d.getDay() === 0 || d.getDay() === 6;
            var r = Math.random();
            if (r > 0.48) lv = 1;
            if (r > 0.68) lv = 2;
            if (r > 0.83) lv = 3;
            if (r > 0.93) lv = 4;
            if (isWe) lv = Math.min(4, lv + 1);
          }
          if (lv > 0) active++;
          var ds = d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
          html += '<div class="lg-hm lg-hm-' + lv + '" title="' + ds + '"></div>';
          d.setDate(d.getDate() + 1);
        }
        html += '</div>';
      }

      el.innerHTML = html;
      var tot = qs('lgCalDays');
      if (tot) tot.textContent = active;
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     CITY MAP
  ══════════════════════════════════════════════════════════════ */
  function renderCityMap() {
    try {
      var el = qs('lgCityMap');
      if (!el) return;
      el.innerHTML = P.districts.map(function(d){
        return '<div class="lg-dist">' +
          '<div class="lg-dist-name">' + d.name + '</div>' +
          '<div class="lg-dist-v" style="color:' + d.color + '">' + d.visits + '</div>' +
          '<div class="lg-dist-l">visits</div>' +
          '<div class="lg-dist-bar" style="background:' + d.color + ';width:0%" data-w="' + d.pct + '%"></div>' +
          '</div>';
      }).join('');
      animBars(el, 'w', 150);
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     SOCIAL
  ══════════════════════════════════════════════════════════════ */
  function renderSocial() {
    try {
      var fl = qs('lgFriends');
      if (fl) {
        if (!P.friends.length) {
          fl.innerHTML = '<div style="text-align:center;padding:32px 20px;color:var(--text-muted);font-size:0.83rem"><i class="fas fa-user-group" style="font-size:1.8rem;display:block;margin-bottom:10px;opacity:0.2"></i>Connections will appear as you follow and interact with people</div>';
        } else {
          fl.innerHTML = P.friends.map(function(f, i){
            return '<div class="lg-friend lg-fade" style="animation-delay:' + (i*0.07) + 's">' +
              '<div class="lg-fav" style="background:' + f.color + '">' + f.ini + '</div>' +
              '<div style="flex:1"><div class="lg-fn">' + f.name + '</div><div class="lg-fm">' + f.city + ' · ' + f.tag + '</div></div>' +
              '<div class="lg-fov">' + f.overlap + '% match</div>' +
              '</div>';
          }).join('');
        }
      }

      var inf = qs('lgInfluence');
      if (inf) {
        if (!P.influenceScore) {
          inf.innerHTML = '<div style="text-align:center;padding:32px 20px;color:var(--text-muted);font-size:0.83rem"><i class="fas fa-signal" style="font-size:1.8rem;display:block;margin-bottom:10px;opacity:0.2"></i>Influence score builds as you create content and connect with others</div>';
        } else {
          var circ = 2 * Math.PI * 46;
          var off  = circ - (P.influenceScore / 100) * circ;
          inf.innerHTML =
            '<svg viewBox="0 0 104 104" style="width:104px;height:104px;transform:rotate(-90deg)">' +
              '<circle cx="52" cy="52" r="46" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>' +
              '<circle id="lgInflFill" cx="52" cy="52" r="46" fill="none" stroke="#a855f7" stroke-width="8" stroke-linecap="round"' +
              ' stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + circ.toFixed(1) + '"/>' +
            '</svg>' +
            '<div style="margin-top:-52px;position:relative;z-index:1;padding:16px 0">' +
              '<div style="font-size:2rem;font-weight:900;color:var(--text-primary)">' + P.influenceScore + '</div>' +
              '<div style="font-size:0.63rem;color:#a855f7;font-weight:700">INFLUENCE SCORE</div>' +
            '</div>' +
            '<div style="font-size:0.77rem;color:var(--text-secondary);padding-bottom:4px">Your content reaches an estimated <strong style="color:var(--text-primary)">2,100+ people</strong>/month on GeoHub.</div>';
          setTimeout(function(){
            var f2 = qs('lgInflFill');
            if (f2) { f2.style.transition = 'stroke-dashoffset 1.5s ease'; f2.style.strokeDashoffset = off.toFixed(1); }
          }, 350);
        }
      }

      var sh = qs('lgShared');
      if (sh) {
        if (!P.sharedInterests.length) {
          sh.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;padding:12px 0">No shared interests yet — start following people to discover overlaps.</div>';
        } else {
          sh.innerHTML = P.sharedInterests.map(function(item){
            return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05)">' +
              '<span style="font-size:0.81rem;color:var(--text-secondary)">' + item.label + '</span>' +
              '<span style="font-size:0.81rem;font-weight:700;color:' + item.color + '">' + item.count + ' friends</span>' +
              '</div>';
          }).join('');
        }
      }
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     GROWTH
  ══════════════════════════════════════════════════════════════ */
  function renderGrowth() {
    try {
      /* XP total label */
      var xpTotalEl = document.getElementById('lgXpTotal');
      if (xpTotalEl) xpTotalEl.innerHTML = 'Total: <strong style="color:#10b981">' + (BASE.xp || 250).toLocaleString() + ' XP</strong>';

      /* XP chart */
      var xpEl = qs('lgXpChart');
      if (xpEl) {
        var maxXp = Math.max.apply(null, P.xpMonthly.map(function(m){ return m.xp; }));
        if (!maxXp) maxXp = 1; // guard division by zero
        xpEl.innerHTML = P.xpMonthly.map(function(m){
          var h = Math.round(m.xp / maxXp * 100);
          var hi = m.xp === maxXp ? ' hi' : '';
          return '<div class="lg-xp-col">' +
            '<div class="lg-xp-bw"><div class="lg-xp-bar' + hi + '" style="height:4px" data-h="' + h + '%" title="' + m.xp + ' XP"></div></div>' +
            '<div class="lg-xp-lbl">' + m.m + '</div>' +
            '</div>';
        }).join('');
        animHeights(xpEl, 150);
      }

      /* Milestones */
      var mlEl = qs('lgMiles');
      if (mlEl) {
        var ms = [
          { n:'Bronze', ico:'🥉', s:'done'    },
          { n:'Silver', ico:'🥈', s:'done'    },
          { n:'Gold',   ico:'🥇', s:'current' },
          { n:'Platinum',ico:'💎',s:'locked'  },
          { n:'Diamond',ico:'✨', s:'locked'  },
        ];
        mlEl.innerHTML = ms.map(function(m){
          return '<div class="lg-mile ' + m.s + '">' +
            '<div class="lg-mile-dot">' + m.ico + '</div>' +
            '<div class="lg-mile-nm">' + m.n + '</div>' +
          '</div>';
        }).join('');
      }

      /* Trust growth bars */
      var tgEl = qs('lgTrustG');
      if (tgEl) {
        var trust = [72,74,75,78,80,83,85,88,90,91,93,94];
        var mns   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        tgEl.innerHTML =
          '<div style="display:flex;align-items:flex-end;gap:5px;height:80px">' +
          trust.map(function(v, i){
            var h = Math.round(v / 100 * 100);
            return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">' +
              '<div style="width:100%;background:rgba(99,102,241,0.55);border-radius:3px 3px 0 0;height:4px" data-h="' + h + '%"></div>' +
              '<div style="font-size:0.59rem;color:var(--text-muted)">' + mns[i] + '</div>' +
            '</div>';
          }).join('') +
          '</div>' +
          '<div style="margin-top:10px;display:flex;justify-content:space-between;font-size:0.78rem">' +
            '<span style="color:var(--text-muted)">Started: <strong style="color:var(--text-primary)">72</strong></span>' +
            '<span style="color:#10b981;font-weight:700">+22 points this year ↑</span>' +
          '</div>';
        setTimeout(function(){
          if (!tgEl) return;
          tgEl.querySelectorAll('[data-h]').forEach(function(el){
            el.style.height = el.dataset.h;
            el.style.transition = 'height 1.1s cubic-bezier(.4,0,.2,1)';
          });
        }, 150);
      }

      /* Forecast */
      var fcEl = qs('lgForecast');
      if (fcEl) {
        fcEl.innerHTML = P.forecasts.map(function(f, i){
          return '<div class="lg-fc-card lg-fade" style="animation-delay:' + (i*0.07) + 's">' +
            '<div class="lg-fc-ico">' + f.icon + '</div>' +
            '<div class="lg-fc-type">' + f.type + '</div>' +
            '<div class="lg-fc-ttl">' + f.title + '</div>' +
            '<div class="lg-fc-why">' + f.reason + '</div>' +
            '<div class="lg-fc-conf">' +
              '<div class="lg-fc-cbr"><div class="lg-fc-cfill" style="background:' + f.cc + '" data-w="' + f.conf + '%"></div></div>' +
              '<span class="lg-fc-cpct">' + f.conf + '%</span>' +
            '</div>' +
            '</div>';
        }).join('');
        setTimeout(function(){
          if (!fcEl) return;
          fcEl.querySelectorAll('[data-w]').forEach(function(el){
            el.style.width = el.dataset.w;
            el.style.transition = 'width 1.1s ease';
          });
        }, 200);
      }
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     REFLECTION
  ══════════════════════════════════════════════════════════════ */
  function renderReflection() {
    try {
      var stEl = qs('lgReflStats');
      if (stEl) stEl.innerHTML = P.reflStats.map(function(s){
        return '<div class="lg-refl-stat">' +
          '<div class="lg-rs-ico">' + s.icon + '</div>' +
          '<div class="lg-rs-v" style="color:' + s.color + '">' + s.v + '</div>' +
          '<div class="lg-rs-l">' + s.l + '</div>' +
          '</div>';
      }).join('');

      var bgEl = qs('lgGBadges');
      if (bgEl) bgEl.innerHTML = P.growthBadges.map(function(b){
        return '<div class="lg-gbadge">' +
          '<div class="lg-gbadge-ico">' + b.icon + '</div>' +
          '<div><div class="lg-gbadge-ttl">' + b.title + '</div><div class="lg-gbadge-desc">' + b.desc + '</div></div>' +
          '</div>';
      }).join('');

      var tmEl = qs('lgTopMoments');
      if (tmEl) tmEl.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px">' +
        P.topMoments.map(function(m){
          return '<div style="background:' + m.bg + ';border:1px solid ' + m.bd + ';border-radius:14px;padding:18px">' +
            '<div style="font-size:1.55rem;margin-bottom:8px">' + m.icon + '</div>' +
            '<div style="font-size:0.67rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:5px">' + m.title + '</div>' +
            '<div style="font-size:0.81rem;color:var(--text-secondary)">' + m.sub + '</div>' +
          '</div>';
        }).join('') +
        '</div>';
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     TAB SWITCHING  — lazy render per panel
  ══════════════════════════════════════════════════════════════ */
  var done = {};

  function switchTab(panel, btn) {
    try {
      document.querySelectorAll('.lg-tab').forEach(function(t){ t.classList.remove('active'); });
      document.querySelectorAll('.lg-panel').forEach(function(p){ p.classList.remove('active'); });
      if (btn) btn.classList.add('active');
      var el = document.getElementById('lgp-' + panel);
      if (el) el.classList.add('active');

      if (!done[panel]) {
        done[panel] = true;
        if (panel === 'timeline')   renderTimeline();
        if (panel === 'heatmap')  { renderHeatmap(); renderCityMap(); }
        if (panel === 'social')     renderSocial();
        if (panel === 'growth')     renderGrowth();
        if (panel === 'reflection') renderReflection();
      }
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */
  function init() {
    try {
      renderHero();
      renderInsights();
      renderRadar();
      renderCBars();
      renderActGrid();
      renderRecent();
      done.overview = true;

      document.querySelectorAll('.lg-tab').forEach(function(tab){
        tab.addEventListener('click', function(){ switchTab(tab.dataset.panel, tab); });
      });
    } catch(e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
