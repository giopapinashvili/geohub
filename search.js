/* ================================================================
   GeoHub — Global Search / Command Center
   search.js + shared GeoSearch namespace for Ctrl+K palette
   ================================================================ */

/* ── SHARED NAMESPACE (used by both search.html and palette) ── */
var GeoSearch = (function () {
  'use strict';

  var RECENT_KEY = 'geohub_recent_searches';

  /* ── FULL MOCK CATALOGUE ─────────────────────────────────── */
  var EVENTS = [
    { id:'ev1', type:'event', name:'Tbilisi Jazz Festival', city:'Tbilisi', desc:'Annual outdoor jazz series at Rike Park. World-class acts and local talent.', rating:4.8, tags:['Music','Outdoor','Annual'], action:'Join', url:'events.html', icon:'🎷', verified:true },
    { id:'ev2', type:'event', name:'Batumi Night Market', city:'Batumi', desc:'Street food, crafts, and live music every Friday evening on the boulevard.', rating:4.6, tags:['Food','Market'], action:'Join', url:'events.html', icon:'🌙', verified:true },
    { id:'ev3', type:'event', name:'Wine Harvest Festival', city:'Kakheti', desc:'Rtveli festival — grape harvest, wine pressing, traditional Georgian dance.', rating:4.9, tags:['Wine','Culture'], action:'Join', url:'events.html', icon:'🍇', verified:true },
    { id:'ev4', type:'event', name:'Photography Workshop', city:'Tbilisi', desc:'Phone photography + editing. Beginners welcome. Free via GeoHub student pass.', rating:4.5, tags:['Workshop','Free'], action:'Join', url:'events.html', icon:'📷', verified:false },
  ];

  var REWARDS = [
    { id:'rw1', type:'reward', name:'20% Off Fabrika Café', city:'Tbilisi', desc:'Verified GeoHub members get 20% off all drinks. Scan QR to claim.', xp:50, tags:['Café','QR'], action:'Claim', url:'rewards.html', icon:'☕', verified:true },
    { id:'rw2', type:'reward', name:'Free Trail Guide — Kazbegi', city:'Kazbegi', desc:'Claim a free guided hike map. Earn +80 XP on completion.', xp:80, tags:['Hiking','Free'], action:'Claim', url:'rewards.html', icon:'🏔️', verified:true },
    { id:'rw3', type:'reward', name:'Spa Day — Batumi Luxury', city:'Batumi', desc:'40% off spa day pass. Gold Explorer tier required.', xp:120, tags:['Spa','Luxury'], action:'Claim', url:'rewards.html', icon:'💆', verified:true },
    { id:'rw4', type:'reward', name:'Wine Tasting — 3 Glasses', city:'Kakheti', desc:'Partner winery. Claim with 200+ GeoPoints. Trust score 80+.', xp:60, tags:['Wine'], action:'Claim', url:'rewards.html', icon:'🍷', verified:false },
  ];

  var CHALLENGES = [
    { id:'ch1', type:'challenge', name:'Weekend Explorer Challenge', city:'Tbilisi', desc:'Visit 5 iconic Tbilisi districts in one weekend. Camera proof required.', xp:500, tags:['Weekend','Explorer'], action:'Start', url:'challenges.html', icon:'🗺️', verified:true },
    { id:'ch2', type:'challenge', name:'Vake Park Clean-up Mission', city:'Tbilisi', desc:'Patriot mission. Collect litter, earn +150 XP + Patriot badge.', xp:150, tags:['Patriot','Eco'], action:'Start', url:'patriot.html', icon:'🌿', verified:true },
    { id:'ch3', type:'challenge', name:'Wine Route — 7 Wineries', city:'Kakheti', desc:'Visit and review 7 partner wineries. High XP + Gold badge.', xp:700, tags:['Wine','Review'], action:'Start', url:'challenges.html', icon:'🍾', verified:false },
    { id:'ch4', type:'challenge', name:'Batumi Beach 5K Run', city:'Batumi', desc:'Join the morning run club. 5km coastal route. Fitness streak XP.', xp:200, tags:['Fitness','Running'], action:'Join', url:'challenges.html', icon:'🏃', verified:true },
  ];

  var GROUPS = [
    { id:'gr1', type:'group', name:'Tbilisi Hikers', city:'Tbilisi', desc:'Organized weekend trails across Greater Caucasus. 840 members.', members:840, tags:['Hiking','Weekend'], action:'Join', url:'groups.html', icon:'⛰️', verified:true },
    { id:'gr2', type:'group', name:'Remote Workers of Georgia', city:'Tbilisi', desc:'Co-work spots, WiFi reviews, and meetups for digital nomads.', members:1240, tags:['Remote Work','Nomads'], action:'Join', url:'groups.html', icon:'💻', verified:true },
    { id:'gr3', type:'group', name:'Kakheti Wine Explorers', city:'Kakheti', desc:'Wine tour planning, winery reviews, cellar door visits.', members:510, tags:['Wine','Tours'], action:'Join', url:'groups.html', icon:'🍷', verified:false },
    { id:'gr4', type:'group', name:'Batumi Beach Runners', city:'Batumi', desc:'Morning 5K coastal run every Saturday. All levels welcome.', members:320, tags:['Running','Fitness'], action:'Join', url:'groups.html', icon:'🏃', verified:true },
  ];

  var SERVICES = [
    { id:'sv1', type:'service', name:'Tbilisi City Tours', city:'Tbilisi', desc:'Licensed city guides. Old Town, balcony walks, wine bars. From 60 GEL.', rating:4.9, tags:['Tours','Licensed'], action:'Book', url:'services.html', icon:'🗺️', verified:true },
    { id:'sv2', type:'service', name:'Mountain Taxi — Kazbegi', city:'Kazbegi', desc:'4x4 transfers to trail heads. Reliable, GPS-tracked, GeoHub verified.', rating:4.7, tags:['Transport','4x4'], action:'Book', url:'services.html', icon:'🚙', verified:true },
    { id:'sv3', type:'service', name:'Georgian Cooking Class', city:'Tbilisi', desc:'Learn khinkali, churchkhela, and badrijani. Private or group.', rating:4.8, tags:['Food','Culture'], action:'Book', url:'services.html', icon:'🍽️', verified:true },
    { id:'sv4', type:'service', name:'Photography Session', city:'Batumi', desc:'Professional photo walk around Batumi Old Town. 2h session.', rating:4.6, tags:['Photography'], action:'Book', url:'services.html', icon:'📸', verified:false },
  ];

  var REAL_ESTATE = [
    { id:'re1', type:'realestate', name:'Modern Flat — Vera District', city:'Tbilisi', desc:'2BR, 75m², renovated. Walking distance to Rustaveli. 1,200 USD/mo.', price:'1,200 USD/mo', tags:['Rental','Vera'], action:'View', url:'real-estate.html', icon:'🏠', verified:true },
    { id:'re2', type:'realestate', name:'Studio — Fabrika Area', city:'Tbilisi', desc:'Trendy studio 42m². Rooftop access, co-work-ready. 800 USD/mo.', price:'800 USD/mo', tags:['Studio','Rental'], action:'View', url:'real-estate.html', icon:'🏢', verified:true },
    { id:'re3', type:'realestate', name:'Sea View Apt — Batumi', city:'Batumi', desc:'1BR beachfront. Fully furnished. High ROI for short-term rental.', price:'95,000 USD', tags:['Buy','Sea View'], action:'View', url:'real-estate.html', icon:'🌊', verified:true },
    { id:'re4', type:'realestate', name:'Kazbegi Mountain House', city:'Kazbegi', desc:'3BR stone house with Gergeti view. Ideal for guesthouse business.', price:'45,000 USD', tags:['Buy','Mountain'], action:'View', url:'real-estate.html', icon:'🏔️', verified:false },
  ];

  var LEARNING = [
    { id:'le1', type:'learning', name:'Georgian Language — Beginners', city:'Tbilisi', desc:'12-week course. Small groups. Certified teacher. GeoHub verified.', rating:4.9, tags:['Language','Beginner'], action:'Enroll', url:'learning.html', icon:'🇬🇪', verified:true },
    { id:'le2', type:'learning', name:'Wine Sommelier Course', city:'Kakheti', desc:'6 sessions at winery. Qvevri, amber wine, tasting notes.', rating:4.8, tags:['Wine','Certificate'], action:'Enroll', url:'learning.html', icon:'🍷', verified:true },
    { id:'le3', type:'learning', name:'Photography — Urban Street', city:'Tbilisi', desc:'4-week workshop. Street photography, editing, printing. 8 students max.', rating:4.7, tags:['Photography','Workshop'], action:'Enroll', url:'learning.html', icon:'📷', verified:false },
    { id:'le4', type:'learning', name:'GeoHub Creator Masterclass', city:'Online', desc:'Build your creator profile, grow followers, and monetize trust.', rating:4.6, tags:['Creator','Online'], action:'Enroll', url:'learning.html', icon:'🎬', verified:true },
  ];

  /* ── TYPE META ─────────────────────────────────────────────── */
  var TYPE_META = {
    people:     { label:'People',      color:'#10b981', bg:'rgba(16,185,129,0.12)', icon:'fas fa-user',       action:'View',   actionClass:'green',  url:'profile.html'    },
    place:      { label:'Place',       color:'#3b82f6', bg:'rgba(59,130,246,0.12)', icon:'fas fa-map-marker-alt', action:'View', actionClass:'blue',  url:'places.html'     },
    business:   { label:'Business',    color:'#f59e0b', bg:'rgba(245,158,11,0.12)', icon:'fas fa-store',      action:'View',   actionClass:'gold',   url:'business.html'   },
    event:      { label:'Event',       color:'#a855f7', bg:'rgba(168,85,247,0.12)', icon:'fas fa-calendar',   action:'Join',   actionClass:'purple', url:'events.html'     },
    reward:     { label:'Reward',      color:'#f97316', bg:'rgba(249,115,22,0.12)', icon:'fas fa-gift',       action:'Claim',  actionClass:'gold',   url:'rewards.html'    },
    challenge:  { label:'Challenge',   color:'#3b82f6', bg:'rgba(59,130,246,0.12)', icon:'fas fa-bolt',       action:'Start',  actionClass:'blue',   url:'challenges.html' },
    group:      { label:'Group',       color:'#10b981', bg:'rgba(16,185,129,0.12)', icon:'fas fa-users',      action:'Join',   actionClass:'green',  url:'groups.html'     },
    service:    { label:'Service',     color:'#06b6d4', bg:'rgba(6,182,212,0.12)',  icon:'fas fa-concierge-bell', action:'Book', actionClass:'blue',  url:'services.html'   },
    realestate: { label:'Real Estate', color:'#ec4899', bg:'rgba(236,72,153,0.12)', icon:'fas fa-home',       action:'View',   actionClass:'purple', url:'real-estate.html'},
    learning:   { label:'Learning',    color:'#f59e0b', bg:'rgba(245,158,11,0.12)', icon:'fas fa-graduation-cap', action:'Enroll', actionClass:'gold', url:'learning.html'  },
    creator:    { label:'Creator',     color:'#ec4899', bg:'rgba(236,72,153,0.12)', icon:'fas fa-star',       action:'Follow', actionClass:'purple', url:'creators.html'   },
    review:     { label:'Review',      color:'#10b981', bg:'rgba(16,185,129,0.12)', icon:'fas fa-star-half-alt', action:'View', actionClass:'green',  url:'reviews.html'    },
  };

  /* ── CATALOGUE ────────────────────────────────────────────── */
  function getCatalogue() {
    var items = [];

    // People / creators from MOCK_USERS
    if (typeof MOCK_USERS !== 'undefined') {
      MOCK_USERS.forEach(function (u) {
        var isCreator = ['Creator','Teacher'].includes(u.accountType);
        items.push({
          id: u.id, type: isCreator ? 'creator' : 'people',
          name: u.fullName, city: u.city,
          desc: u.bio,
          sub: '@' + u.username + ' · ' + u.city,
          rating: null, trust: u.trustScore, xp: u.xp,
          tags: u.badges.slice(0,2),
          verified: u.trustScore >= 85,
          action: isCreator ? 'Follow' : 'View',
          url: 'profile.html?user=' + u.id,
          avatar: u.avatar, avColor: null,
          icon: null, followers: u.followers,
        });
      });
    }

    // Businesses from data.js
    if (typeof BUSINESSES !== 'undefined') {
      BUSINESSES.forEach(function (b) {
        items.push({
          id: 'b' + b.id, type: 'business',
          name: b.name, city: b.city,
          desc: b.description ? b.description.slice(0, 120) : '',
          sub: b.categoryLabel + ' · ' + b.city,
          rating: b.rating, trust: null, xp: null,
          tags: (b.tags || []).slice(0,2),
          verified: b.verified,
          action: 'View', url: 'business.html',
          avatar: null, avColor: null,
          icon: null, image: b.image,
        });
      });
    }

    // Static mock data
    EVENTS.forEach(function (e) { items.push(Object.assign({ name: e.name, sub: e.icon + ' ' + e.city }, e)); });
    REWARDS.forEach(function (r) { items.push(Object.assign({ name: r.name, sub: '🎁 ' + r.city }, r)); });
    CHALLENGES.forEach(function (c) { items.push(Object.assign({ name: c.name, sub: '⚡ ' + c.city }, c)); });
    GROUPS.forEach(function (g) { items.push(Object.assign({ name: g.name, sub: '👥 ' + g.city + ' · ' + g.members + ' members' }, g)); });
    SERVICES.forEach(function (s) { items.push(Object.assign({ name: s.name, sub: '🔧 ' + s.city }, s)); });
    REAL_ESTATE.forEach(function (r) { items.push(Object.assign({ name: r.name, sub: '🏠 ' + r.city + ' · ' + r.price }, r)); });
    LEARNING.forEach(function (l) { items.push(Object.assign({ name: l.name, sub: '📚 ' + l.city }, l)); });

    return items;
  }

  /* ── SEARCH ───────────────────────────────────────────────── */
  function search(query, options) {
    options = options || {};
    var cat    = options.cat    || 'all';
    var filter = options.filter || 'all';
    var q      = (query || '').toLowerCase().trim();

    var items = getCatalogue();

    var results = items.filter(function (item) {
      if (cat !== 'all' && item.type !== cat) return false;
      if (filter === 'verified' && !item.verified) return false;
      if (filter === 'hightrust' && item.trust && item.trust < 85) return false;
      if (filter === 'tbilisi' && (item.city || '').toLowerCase() !== 'tbilisi') return false;
      if (filter === 'batumi'  && (item.city || '').toLowerCase() !== 'batumi')  return false;
      if (!q) return true;
      var haystack = [item.name, item.desc, item.city, (item.tags || []).join(' ')].join(' ').toLowerCase();
      return q.split(' ').every(function (word) { return haystack.includes(word); });
    });

    // Sort: verified first, then by rating/trust
    results.sort(function (a, b) {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      var sa = a.rating || a.trust / 10 || 0;
      var sb = b.rating || b.trust / 10 || 0;
      return sb - sa;
    });

    return results;
  }

  /* ── RECENT SEARCHES ─────────────────────────────────────── */
  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (_) { return []; }
  }
  function addRecent(q) {
    if (!q || q.length < 2) return;
    var list = getRecent().filter(function (r) { return r !== q; });
    list.unshift(q);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8))); } catch (_) {}
  }
  function removeRecent(q) {
    var list = getRecent().filter(function (r) { return r !== q; });
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (_) {}
  }

  return { search: search, getRecent: getRecent, addRecent: addRecent, removeRecent: removeRecent, getCatalogue: getCatalogue, TYPE_META: TYPE_META };
})();


/* ================================================================
   SEARCH PAGE  (only runs on search.html)
================================================================ */
(function () {
  'use strict';
  if (!document.getElementById('bigInput')) return;

  var CAT_DEFS = [
    { id:'all',        label:'All',         icon:'fas fa-search' },
    { id:'people',     label:'People',      icon:'fas fa-user' },
    { id:'creator',    label:'Creators',    icon:'fas fa-star' },
    { id:'place',      label:'Places',      icon:'fas fa-map-marker-alt' },
    { id:'business',   label:'Businesses',  icon:'fas fa-store' },
    { id:'event',      label:'Events',      icon:'fas fa-calendar' },
    { id:'group',      label:'Groups',      icon:'fas fa-users' },
    { id:'reward',     label:'Rewards',     icon:'fas fa-gift' },
    { id:'challenge',  label:'Challenges',  icon:'fas fa-bolt' },
    { id:'service',    label:'Services',    icon:'fas fa-concierge-bell' },
    { id:'realestate', label:'Real Estate', icon:'fas fa-home' },
    { id:'learning',   label:'Learning',    icon:'fas fa-graduation-cap' },
    { id:'review',     label:'Reviews',     icon:'fas fa-star-half-alt' },
  ];

  var TRENDING = [
    { q:'Fabrika café',       icon:'☕', count:'2.4k' },
    { q:'Kazbegi hiking',     icon:'🏔️', count:'1.8k' },
    { q:'Tbilisi wine bars',  icon:'🍷', count:'1.5k' },
    { q:'Weekend explorer',   icon:'🗺️', count:'1.2k' },
    { q:'Patriot missions',   icon:'🇬🇪', count:'980' },
    { q:'Batumi beach',       icon:'🌊', count:'870' },
    { q:'Photography walk',   icon:'📷', count:'740' },
    { q:'Jazz festival',      icon:'🎷', count:'660' },
    { q:'Remote work spots',  icon:'💻', count:'590' },
    { q:'Kakheti wine route', icon:'🍇', count:'520' },
  ];

  var QUICK_BROWSE = [
    { name:'Top Creators',      sub:'Tbilisi',   icon:'⭐', type:'creator',   url:'creators.html',    color:'#ec4899' },
    { name:'Live Events',       sub:'This week', icon:'🎭', type:'event',     url:'events.html',      color:'#a855f7' },
    { name:'Active Challenges', sub:'Join now',  icon:'⚡', type:'challenge', url:'challenges.html',  color:'#3b82f6' },
    { name:'Best Rewards',      sub:'Claim XP',  icon:'🎁', type:'reward',    url:'rewards.html',     color:'#f97316' },
    { name:'Patriot Missions',  sub:'Civic XP',  icon:'🇬🇪', type:'challenge', url:'patriot.html',    color:'#10b981' },
    { name:'Learning Hub',      sub:'Courses',   icon:'📚', type:'learning',  url:'learning.html',    color:'#f59e0b' },
  ];

  var activeCat    = 'all';
  var activeFilter = 'all';
  var currentQuery = '';
  var visibleCount = 12;
  var allResults   = [];
  var debounceTimer;

  /* ── BUILD TABS ────────────────────────────────────────── */
  function buildTabs() {
    var cat = GeoSearch.getCatalogue();
    var counts = {};
    cat.forEach(function (i) { counts[i.type] = (counts[i.type] || 0) + 1; });
    counts['all'] = cat.length;

    document.getElementById('catTabs').innerHTML = CAT_DEFS.map(function (c) {
      return '<button class="sr-cat-tab' + (c.id === 'all' ? ' active' : '') + '" data-cat="' + c.id + '" onclick="switchCat(this,\'' + c.id + '\')">' +
        '<i class="' + c.icon + '"></i>' + c.label +
        (counts[c.id] ? '<span class="sr-cat-count">' + (counts[c.id] || 0) + '</span>' : '') +
      '</button>';
    }).join('');
  }

  /* ── EMPTY / LANDING STATE ─────────────────────────────── */
  function renderEmptyState() {
    renderRecent();
    renderTrending();
    renderQuickBrowse();
    document.getElementById('srEmptyState').style.display = 'block';
    document.getElementById('srResults').style.display    = 'none';
    document.getElementById('srHero').style.display       = '';
  }

  function renderRecent() {
    var list  = GeoSearch.getRecent();
    var el    = document.getElementById('recentList');
    var title = document.getElementById('recentTitle');
    if (!el) return;
    if (!list.length) { title.style.display = 'none'; el.innerHTML = ''; return; }
    title.style.display = 'flex';
    el.innerHTML = list.map(function (q) {
      return '<div class="sr-recent-item" onclick="submitSearch(\'' + q.replace(/'/g, "\\'") + '\')">' +
        '<div class="sr-recent-icon"><i class="fas fa-clock"></i></div>' +
        '<div class="sr-recent-text">' + q + '</div>' +
        '<span class="sr-recent-del" onclick="event.stopPropagation();deleteRecent(\'' + q.replace(/'/g, "\\'") + '\')" title="Remove"><i class="fas fa-times"></i></span>' +
      '</div>';
    }).join('');
  }

  function renderTrending() {
    document.getElementById('trendingGrid').innerHTML = TRENDING.map(function (t) {
      return '<button class="sr-trending-pill" onclick="submitSearch(\'' + t.q + '\')">' +
        '<span class="pill-icon">' + t.icon + '</span>' + t.q +
        '<span class="pill-count">' + t.count + '</span>' +
      '</button>';
    }).join('');
  }

  function renderQuickBrowse() {
    document.getElementById('quickBrowseGrid').innerHTML = QUICK_BROWSE.map(function (b) {
      return '<div class="sr-card" onclick="location.href=\'' + b.url + '\'">' +
        '<div class="sr-card-img" style="background:' + hexToRgba(b.color, 0.08) + ';font-size:3rem;height:90px">' + b.icon + '</div>' +
        '<div class="sr-card-body">' +
          '<div class="sr-card-top"><span class="sr-card-name">' + b.name + '</span></div>' +
          '<div class="sr-card-sub"><i class="fas fa-arrow-right" style="color:' + b.color + '"></i>' + b.sub + '</div>' +
        '</div></div>';
    }).join('');
  }

  /* ── RENDER RESULTS ────────────────────────────────────── */
  function renderResults(q) {
    currentQuery = q;
    allResults   = GeoSearch.search(q, { cat: activeCat, filter: activeFilter });
    visibleCount = 12;
    displayResults();
    document.getElementById('srEmptyState').style.display = 'none';
    document.getElementById('srResults').style.display    = 'block';
    document.getElementById('srHero').style.display       = 'none';
  }

  function displayResults() {
    var grid    = document.getElementById('resultsGrid');
    var countEl = document.getElementById('resultsCount');
    var moreBtn = document.getElementById('srLoadMore');
    if (!grid) return;

    var slice = allResults.slice(0, visibleCount);
    if (countEl) countEl.textContent = allResults.length + ' results for "' + currentQuery + '"';

    if (!allResults.length) {
      grid.innerHTML = '<div class="sr-no-results" style="grid-column:1/-1"><i class="fas fa-search"></i><p>No results for <span>"' + currentQuery + '"</span></p><p style="margin-top:6px;font-size:0.78rem">Try different keywords or browse categories above</p></div>';
      if (moreBtn) moreBtn.style.display = 'none';
      return;
    }

    grid.innerHTML = slice.map(buildResultCard).join('');
    if (moreBtn) moreBtn.style.display = allResults.length > visibleCount ? 'block' : 'none';
  }

  /* ── BUILD CARD ────────────────────────────────────────── */
  function buildResultCard(item) {
    var tm     = GeoSearch.TYPE_META[item.type] || GeoSearch.TYPE_META.people;
    var action = item.action || tm.action;
    var url    = item.url    || tm.url;
    var aClass = tm.actionClass;

    var imgHTML;
    if (item.avatar) {
      imgHTML = '<div class="sr-card-img" style="height:80px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.03)">' +
        '<img src="' + item.avatar + '" style="width:56px;height:56px;border-radius:50%;object-fit:cover" loading="lazy" onerror="this.style.display=\'none\'">' +
      '</div>';
    } else if (item.image) {
      imgHTML = '<div class="sr-card-img" style="height:100px"><img src="' + item.image + '" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.parentNode.innerHTML=\'' + (item.icon || '📍') + '\'"></div>';
    } else {
      imgHTML = '<div class="sr-card-img" style="background:' + hexToRgba(tm.color, 0.07) + ';height:80px;font-size:2.4rem">' + (item.icon || '') + '</div>';
    }

    var meta = [];
    if (item.rating)   meta.push('<span class="sr-card-pill gold">★ ' + item.rating + '</span>');
    if (item.trust)    meta.push('<span class="sr-card-pill green">Trust ' + item.trust + '</span>');
    if (item.xp)       meta.push('<span class="sr-card-pill gold">+' + item.xp + ' XP</span>');
    if (item.followers) meta.push('<span class="sr-card-pill blue">' + fmtNum(item.followers) + ' followers</span>');
    if (item.members)  meta.push('<span class="sr-card-pill green">' + fmtNum(item.members) + ' members</span>');
    if (item.price)    meta.push('<span class="sr-card-pill purple">' + item.price + '</span>');
    (item.tags || []).slice(0,2).forEach(function (t) { meta.push('<span class="sr-card-pill blue">' + t + '</span>'); });

    return '<div class="sr-card" onclick="goTo(\'' + url + '\')">' +
      imgHTML +
      '<div class="sr-card-body">' +
        '<div class="sr-card-top">' +
          '<span class="sr-card-name">' + item.name + (item.verified ? ' <i class="fas fa-check-circle sr-verified"></i>' : '') + '</span>' +
          '<span class="sr-card-type" style="background:' + tm.bg + ';color:' + tm.color + '">' + tm.label + '</span>' +
        '</div>' +
        '<div class="sr-card-sub"><i class="' + tm.icon + '" style="color:' + tm.color + '"></i>' + (item.sub || item.city) + '</div>' +
        (item.desc ? '<div class="sr-card-desc">' + item.desc.slice(0,110) + (item.desc.length>110?'…':'') + '</div>' : '') +
        (meta.length ? '<div class="sr-card-meta">' + meta.join('') + '</div>' : '') +
        '<button class="sr-card-action ' + aClass + '" onclick="event.stopPropagation();doAction(\'' + action + '\',\'' + url + '\')">' +
          action +
        '</button>' +
      '</div>' +
    '</div>';
  }

  /* ── INPUT HANDLERS ────────────────────────────────────── */
  function onInput(q) {
    var clearBtns = document.querySelectorAll('#topbarClear, #bigClear');
    clearBtns.forEach(function (b) { b.classList.toggle('visible', q.length > 0); });
    clearTimeout(debounceTimer);
    if (!q.trim()) { renderEmptyState(); return; }
    debounceTimer = setTimeout(function () {
      GeoSearch.addRecent(q.trim());
      renderResults(q.trim());
    }, 280);
  }

  function syncInputs(val) {
    var big = document.getElementById('bigInput');
    var top = document.getElementById('topbarInput');
    if (big && big !== document.activeElement) big.value = val;
    if (top && top !== document.activeElement) top.value = val;
  }

  /* ── PUBLIC ACTIONS ────────────────────────────────────── */
  window.submitSearch = function (q) {
    syncInputs(q);
    onInput(q);
    document.getElementById('topbarInput').value = q;
  };

  window.deleteRecent = function (q) {
    GeoSearch.removeRecent(q);
    renderRecent();
  };

  window.clearSearch = function () {
    syncInputs('');
    document.querySelectorAll('#topbarClear,#bigClear').forEach(function (b) { b.classList.remove('visible'); });
    renderEmptyState();
  };

  window.switchCat = function (btn, cat) {
    document.querySelectorAll('.sr-cat-tab').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    activeCat = cat;
    if (currentQuery) renderResults(currentQuery);
  };

  window.applyFilter = function (btn, filter) {
    document.querySelectorAll('.sr-filter').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    activeFilter = filter;
    if (currentQuery) renderResults(currentQuery);
  };

  window.loadMoreResults = function () { visibleCount += 8; displayResults(); };

  window.goTo = function (url) { location.href = url; };

  window.doAction = function (action, url) {
    var toasts = { Follow:'Following! 🎉', Join:'Joined! +20 XP', Claim:'Claimed! Check your Rewards', Start:'Mission started!', Enroll:'Enrolled!', Book:'Booking request sent!', View:'Opening…', Message:'Message opened' };
    showToast(toasts[action] || 'Done!');
    setTimeout(function () { if (url) location.href = url; }, 900);
  };

  /* ── SEARCH PAGE INIT ──────────────────────────────────── */
  function init() {
    buildTabs();
    renderEmptyState();

    var bigInput = document.getElementById('bigInput');
    var topInput = document.getElementById('topbarInput');

    bigInput.addEventListener('input', function () { syncInputs(this.value); onInput(this.value); });
    topInput.addEventListener('input', function () { syncInputs(this.value); onInput(this.value); });
    bigInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { GeoSearch.addRecent(this.value.trim()); renderResults(this.value.trim()); } });

    // Pre-fill from URL ?q=
    var urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ) { syncInputs(urlQ); onInput(urlQ); bigInput.value = urlQ; topInput.value = urlQ; }
    else { bigInput.focus(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* ── TOAST ──────────────────────────────────────────────── */
  function showToast(msg) {
    var t = document.getElementById('srToast');
    var m = document.getElementById('srToastMsg');
    if (!t || !m) return;
    m.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2800);
  }
})();


/* ── HELPERS ── */
function hexToRgba(hex, alpha) {
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}
function fmtNum(n) { return n >= 1000 ? (n/1000).toFixed(1) + 'k' : n; }
