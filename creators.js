/* =========================================================
   CREATOR EXTRA DATA
   ========================================================= */
const CREATOR_EXTRA = {
  u01: {
    engagementRate: 7.5, niche: 'Cafés', nicheIcon: '☕', avgPrice: 80, completedCollabs: 12,
    audienceType: 'Young professionals, students & café enthusiasts in Tbilisi',
    topCategories: ['Café Reviews', 'Event Guides', 'Morning Routines', 'Hidden Spots'],
    packages: [
      { name: 'Story Mention', price: 40, desc: '3 stories, 24h live, geo-tag' },
      { name: 'Feed Post', price: 80, desc: '1 post + caption + location tags' },
      { name: 'Full Campaign', price: 180, desc: '1 post + 5 stories + save-worthy format' }
    ],
    previousCollabs: ['Fabrika Tbilisi', 'Roasters Lab', 'Stamba Hotel', 'Biltmore Tbilisi'],
    recentPlaces: ['Fabrika Tbilisi', 'Vake Park', 'Betsy Hotel'],
    matchScore: 96, availability: 'Available',
    bestPost: { caption: 'Morning coffee turned into a 2-hour coworking session.', likes: 128, img: 'feed-fabrika-real' }
  },
  u02: {
    engagementRate: 8.3, niche: 'Hiking', nicheIcon: '🏔️', avgPrice: 120, completedCollabs: 8,
    audienceType: 'Hikers, trail runners & outdoor adventure seekers across Georgia',
    topCategories: ['Trail Notes', 'Mountain Reviews', 'Route Maps', 'Gear Tips'],
    packages: [
      { name: 'Mention Post', price: 60, desc: '1 post with trail/adventure context' },
      { name: 'Guide Feature', price: 120, desc: 'Detailed route guide + post + story' },
      { name: 'Sponsored Trek', price: 300, desc: 'Full trek coverage + reel + 5 stories' }
    ],
    previousCollabs: ['Kazbegi Adventures', 'Mestia Svan Guesthouse', 'Trek Georgia'],
    recentPlaces: ['Juta Valley', 'Gergeti Glacier', 'Kazbegi'],
    matchScore: 72, availability: 'Available',
    bestPost: { caption: 'Trail is dry until the last section. The view after the ridge is unreal.', likes: 284, img: 'feed-juta-trail' }
  },
  u04: {
    engagementRate: 6.1, niche: 'Food & Wine', nicheIcon: '🍷', avgPrice: 100, completedCollabs: 15,
    audienceType: 'Food lovers, wine enthusiasts & restaurant-goers in Georgia',
    topCategories: ['Restaurant Reviews', 'Wine Pairing', 'Khinkali Guides', 'Menu Deep-dives'],
    packages: [
      { name: 'Dish Feature', price: 60, desc: '1 post featuring a specific dish' },
      { name: 'Restaurant Review', price: 100, desc: 'Full review post + stories + menu callout' },
      { name: 'Monthly Partner', price: 280, desc: '4 posts + 8 stories + story highlight' }
    ],
    previousCollabs: ['Shavi Lomi', 'Barbarestan', 'Wine Factory N1', 'Café Littera'],
    recentPlaces: ['Shavi Lomi', 'Keto & Kote', 'Vinotel Tbilisi'],
    matchScore: 89, availability: 'Available',
    bestPost: { caption: 'Seasonal menu is stronger this month. Try the mushroom khinkali.', likes: 176, img: 'feed-shavi-review' }
  },
  u06: {
    engagementRate: 5.8, niche: 'Nightlife', nicheIcon: '🎵', avgPrice: 90, completedCollabs: 7,
    audienceType: 'Young Tbilisi locals, night market crowd & event-goers',
    topCategories: ['Event Coverage', 'Night Market Guides', 'DJ Set Recaps', 'Group Plans'],
    packages: [
      { name: 'Event Story', price: 45, desc: 'Live stories from your event (2h)' },
      { name: 'Event Post', price: 90, desc: '1 post + pre/during/after stories' },
      { name: 'Full Event Promo', price: 200, desc: 'Pre-hype + live + recap reel' }
    ],
    previousCollabs: ['Fabrika Night Market', 'Bassiani', 'Khidi Club'],
    recentPlaces: ['Fabrika Courtyard', 'Rike Park', 'Chardin St.'],
    matchScore: 78, availability: 'Busy',
    bestPost: { caption: 'Group plan open for tonight. Food trucks + DJ after 21:00.', likes: 201, img: 'feed-night-market' }
  },
  u07: {
    engagementRate: 7.2, niche: 'Photography', nicheIcon: '📸', avgPrice: 110, completedCollabs: 10,
    audienceType: 'Aesthetics enthusiasts, design-lovers & Tbilisi architecture fans',
    topCategories: ['Urban Photography', 'Hidden Spots', 'Golden Hour Walks', 'Architecture'],
    packages: [
      { name: 'Location Feature', price: 55, desc: '1 aesthetics post tagging your location' },
      { name: 'Mini-shoot', price: 110, desc: '3 posts from your venue, curated lighting' },
      { name: 'Portfolio Series', price: 250, desc: '6-post series of your space over 2 weeks' }
    ],
    previousCollabs: ['Rooms Hotel Tbilisi', 'Fabrika', 'Old Town Gallery'],
    recentPlaces: ['Sololaki', 'Mtatsminda', 'Vera District'],
    matchScore: 82, availability: 'Available',
    bestPost: { caption: 'Tiny courtyard, blue stairs, warm light. Keep it respectful if you visit.', likes: 421, img: 'feed-sololaki-yard' }
  },
  u10: {
    engagementRate: 4.2, niche: 'Luxury', nicheIcon: '💎', avgPrice: 220, completedCollabs: 18,
    audienceType: 'Luxury travelers, spa-goers & premium experience seekers',
    topCategories: ['Boutique Hotels', 'Fine Dining', 'Spa Reviews', 'Premium Rewards'],
    packages: [
      { name: 'Hotel Story', price: 100, desc: '5 premium stories from your property' },
      { name: 'Luxury Feature', price: 220, desc: '1 post + 8 stories + highlight save' },
      { name: 'Brand Partnership', price: 550, desc: 'Monthly ambassador (4 posts + stories)' }
    ],
    previousCollabs: ['Biltmore Tbilisi', 'Stamba Hotel', 'Adjara Group Hotels', 'Château Mukhrani'],
    recentPlaces: ['Batumi Sheraton', 'Vinotel', 'Rixos Shekvetili'],
    matchScore: 68, availability: 'Available',
    bestPost: { caption: 'Boutique spa weekend done right. The amber wine pairing at dinner was the highlight.', likes: 389, img: 'gh-salome' }
  },
  u14: {
    engagementRate: 5.9, niche: 'Travel', nicheIcon: '✈️', avgPrice: 95, completedCollabs: 11,
    audienceType: 'International travelers, expats & slow-travel enthusiasts in Georgia',
    topCategories: ['Region Guides', 'Wine Routes', 'Travel Tips', 'Off-the-beaten-path'],
    packages: [
      { name: 'Destination Post', price: 50, desc: '1 travel-narrative post with location tag' },
      { name: 'Region Guide', price: 95, desc: 'Detailed post + 5 stories covering your area' },
      { name: 'Series Feature', price: 220, desc: '3-post mini-series across one week' }
    ],
    previousCollabs: ['Georgian Travel House', 'Wine Factory N1', 'Kaheti Lodge'],
    recentPlaces: ['Sighnaghi', 'Mtskheta', 'Borjomi'],
    matchScore: 74, availability: 'Available',
    bestPost: { caption: 'Documenting Georgia slowly, one region at a time.', likes: 214, img: 'gh-sofia' }
  },
  u27: {
    engagementRate: 9.1, niche: 'Hiking', nicheIcon: '🏔️', avgPrice: 80, completedCollabs: 6,
    audienceType: 'Trail runners, ultra athletes & fitness hikers in Georgia',
    topCategories: ['Trail Running', 'Elevation Maps', 'Weather Updates', 'Gear Reviews'],
    packages: [
      { name: 'Trail Mention', price: 40, desc: '1 post mentioning your tour/service' },
      { name: 'Route Feature', price: 80, desc: 'Full route post with your brand visible' },
      { name: 'Race Sponsorship', price: 180, desc: 'Race-day coverage + recap reel' }
    ],
    previousCollabs: ['Kazbegi Adventures', 'Borjomi Park Authority'],
    recentPlaces: ['Borjomi', 'Bakuriani Trail', 'Likani Park'],
    matchScore: 65, availability: 'Available',
    bestPost: { caption: 'Trail running reality check: wind after 2pm is no joke at this elevation.', likes: 198, img: 'feed-juta-trail' }
  },
  u30: {
    engagementRate: 6.4, niche: 'Photography', nicheIcon: '📸', avgPrice: 95, completedCollabs: 9,
    audienceType: 'Design enthusiasts, architecture lovers & gallery visitors',
    topCategories: ['Architecture', 'Gallery Coverage', 'City Walks', 'Light & Shadow'],
    packages: [
      { name: 'Space Feature', price: 50, desc: '1 aesthetic post from your venue' },
      { name: 'Atmosphere Series', price: 95, desc: '3 posts capturing your space\'s mood' },
      { name: 'Full Shoot', price: 210, desc: '6-post curated series across 2 sessions' }
    ],
    previousCollabs: ['Tbilisi Art House', 'Galleria Tbilisi', 'Rooms Hotel'],
    recentPlaces: ['Sololaki', 'Saburtalo Gallery', 'Mtatsminda'],
    matchScore: 80, availability: 'Busy',
    bestPost: { caption: 'Architecture, balconies, and slow city walks. This city never runs out of frames.', likes: 312, img: 'feed-sololaki-yard' }
  },
  u12: {
    engagementRate: 5.4, niche: 'Travel', nicheIcon: '🗺️', avgPrice: 70, completedCollabs: 5,
    audienceType: 'History lovers, museum-goers & hidden gem seekers in Tbilisi',
    topCategories: ['Hidden Courtyards', 'Museums', 'City History', 'Walking Routes'],
    packages: [
      { name: 'Discovery Post', price: 35, desc: '1 hidden-spot feature with your location' },
      { name: 'Guide Post', price: 70, desc: 'Narrative guide post + stories + map' },
      { name: 'Series', price: 160, desc: '3-part hidden Tbilisi series' }
    ],
    previousCollabs: ['National Museum of Georgia', 'Fabrika', 'Old City Tour'],
    recentPlaces: ['Narikala', 'Abanotubani', 'Sololaki'],
    matchScore: 71, availability: 'Available',
    bestPost: { caption: 'Old Sololaki still has magic. Places people walk past too fast.', likes: 287, img: 'feed-sololaki-yard' }
  },
  u21: {
    engagementRate: 4.8, niche: 'Events', nicheIcon: '🎉', avgPrice: 65, completedCollabs: 8,
    audienceType: 'Event-goers, workshop attendees & market visitors in Tbilisi',
    topCategories: ['Market Coverage', 'Workshop Reviews', 'Concert Recaps', 'Meetup Guides'],
    packages: [
      { name: 'Event Mention', price: 30, desc: '2 stories on event day' },
      { name: 'Event Feature', price: 65, desc: '1 post + before/after stories' },
      { name: 'Monthly Events', price: 150, desc: '4 event posts per month' }
    ],
    previousCollabs: ['Fabrika Night Market', 'Lisi Weekend Market', 'Open Air Tbilisi'],
    recentPlaces: ['Fabrika', 'Rike Park', 'Mziuri Park'],
    matchScore: 83, availability: 'Available',
    bestPost: { caption: 'I am bringing two friends. This market has the best lineup this season.', likes: 156, img: 'feed-night-market' }
  },
  u13: {
    engagementRate: 4.1, niche: 'Nightlife', nicheIcon: '🎵', avgPrice: 55, completedCollabs: 4,
    audienceType: 'Late-night Tbilisi crowd, bar-hoppers & music scene followers',
    topCategories: ['Bar Reviews', 'Music Nights', 'Late Dinner Maps', 'Nightlife Guides'],
    packages: [
      { name: 'Bar Story', price: 28, desc: '3 stories from your venue at night' },
      { name: 'Night Review', price: 55, desc: '1 review post + night stories' },
      { name: 'Weekly Feature', price: 120, desc: '4 nightlife posts per month' }
    ],
    previousCollabs: ['Mtkvarze Bar', 'Bassiani', 'Sharden Street Bars'],
    recentPlaces: ['Chardin St.', 'Wine Bar Tbilisi', 'Argo'],
    matchScore: 61, availability: 'Available',
    bestPost: { caption: 'Honest nightlife review: the new bar on Chardin is worth the line.', likes: 143, img: 'feed-night-market' }
  },
  u23: {
    engagementRate: 6.8, niche: 'Food & Wine', nicheIcon: '🍽️', avgPrice: 70, completedCollabs: 9,
    audienceType: 'Food bloggers, restaurant regulars & dessert hunters in Kutaisi & Tbilisi',
    topCategories: ['Detailed Reviews', 'Menu Photos', 'Dessert Features', 'No-drama Recs'],
    packages: [
      { name: 'Dish Review', price: 35, desc: '1 honest dish review with photos' },
      { name: 'Restaurant Feature', price: 70, desc: 'Full review post + menu photos + stories' },
      { name: 'Monthly Column', price: 190, desc: '4 reviews + ongoing story coverage' }
    ],
    previousCollabs: ['Palaty Restaurant', 'Kutaisi Pub', 'Wine Cellar Kutaisi'],
    recentPlaces: ['Palaty', 'Kutaisi Central Market', 'Bagrati Cathedral area'],
    matchScore: 87, availability: 'Available',
    bestPost: { caption: 'Detailed food notes and no-drama recommendations. Kutaisi has a food scene now.', likes: 167, img: 'feed-shavi-review' }
  },
  u18: {
    engagementRate: 5.2, niche: 'Travel', nicheIcon: '🎒', avgPrice: 50, completedCollabs: 6,
    audienceType: 'Budget backpackers, hostel travelers & route planners visiting Georgia',
    topCategories: ['Budget Routes', 'Hostel Reviews', 'Transport Maps', 'Cheap Eats'],
    packages: [
      { name: 'Route Feature', price: 25, desc: '1 route post tagging your service' },
      { name: 'Budget Guide', price: 50, desc: 'Budget travel post + hostel/tour mention' },
      { name: 'Backpacker Series', price: 110, desc: '3 budget travel posts over 2 weeks' }
    ],
    previousCollabs: ['Fabrika Hostel', 'Kutaisi Hostel Hub', 'Georgia Bus Tours'],
    recentPlaces: ['Kutaisi', 'Sighnaghi', 'Batumi'],
    matchScore: 58, availability: 'Available',
    bestPost: { caption: 'Backpacking Georgia: Kutaisi to Batumi in 48 hours under 40 GEL.', likes: 119, img: 'feed-kakheti-group' }
  },
};

/* =========================================================
   BUILD CREATOR LIST  (MOCK_USERS + EXTRA)
   ========================================================= */
const CREATOR_IDS = ['u01','u02','u04','u06','u07','u10','u14','u27','u30','u12','u21','u13','u23','u18'];
const CREATORS = CREATOR_IDS.map(id => {
  const u = MOCK_USERS.find(x => x.id === id);
  const e = CREATOR_EXTRA[id] || {};
  return { ...u, ...e };
}).filter(Boolean);

/* =========================================================
   LEADERBOARD DATA
   ========================================================= */
const LB_DATA = {
  xp: [
    { id:'u02', val:'15,680 XP' }, { id:'u12', val:'12,140 XP' }, { id:'u27', val:'9,300 XP' },
    { id:'u01', val:'8,420 XP' }, { id:'u14', val:'8,350 XP' }
  ],
  engagement: [
    { id:'u27', val:'9.1%' }, { id:'u02', val:'8.3%' }, { id:'u01', val:'7.5%' },
    { id:'u07', val:'7.2%' }, { id:'u23', val:'6.8%' }
  ],
  collabs: [
    { id:'u10', val:'18 collabs' }, { id:'u04', val:'15 collabs' }, { id:'u01', val:'12 collabs' },
    { id:'u14', val:'11 collabs' }, { id:'u07', val:'10 collabs' }
  ],
  trust: [
    { id:'u12', val:'99 / 100' }, { id:'u02', val:'98 / 100' }, { id:'u04', val:'96 / 100' },
    { id:'u27', val:'96 / 100' }, { id:'u01', val:'94 / 100' }
  ]
};

/* =========================================================
   FILTER STATE
   ========================================================= */
let state = { niche:'', level:'', availability:'', trust:'', city:'', followers:'', engagement:'', sort:'match' };
let activeCreator = null;
let activeOfferType = 'free_product';

/* =========================================================
   RENDER CREATORS
   ========================================================= */
function levelClass(lvl) {
  if (lvl.includes('Platinum')) return 'platinum';
  if (lvl.includes('Gold')) return 'gold';
  if (lvl.includes('Silver')) return 'silver';
  return 'bronze';
}
function fmtNum(n) { return n >= 1000 ? (n/1000).toFixed(1) + 'K' : n; }

function renderCreatorCard(c) {
  const lvl = levelClass(c.explorerLevel);
  const seeds = ['cafe-1','feed-fabrika-real','feed-night-market','feed-sololaki-yard','feed-juta-trail'];
  const placeThumbs = (c.recentPlaces || ['Tbilisi','Batumi','Kutaisi']).slice(0,3).map((p,i)=>
    `<div class="creator-place-thumb"><img src="https://picsum.photos/seed/${seeds[i%seeds.length]}/200/80" alt="${p}" loading="lazy"></div>`).join('');
  const badges = (c.badges || []).slice(0,2).map(b => `<span class="creator-badge">${b}</span>`).join('');

  return `
  <div class="creator-card animate-fade-up" onclick="openProfile('${c.id}')">
    <div class="creator-card-top">
      <img src="https://picsum.photos/seed/gh-${c.id}-cover/600/200" alt="" class="creator-card-cover" loading="lazy">
      <div class="creator-match-badge"><i class="fas fa-robot" style="margin-right:3px"></i>${c.matchScore}% match</div>
      <div class="creator-level-ring ${lvl}">
        <div class="creator-avatar-inner">
          <img src="${c.avatar}" alt="${c.fullName}" loading="lazy">
        </div>
      </div>
    </div>
    <div class="creator-card-body">
      <div class="creator-name">${c.fullName}</div>
      <div class="creator-username">@${c.username}</div>
      <div class="creator-meta">
        <span class="creator-city"><i class="fas fa-map-marker-alt" style="color:var(--green);font-size:0.65rem"></i>${c.city}</span>
        <span class="creator-niche">${c.nicheIcon || '🌍'} ${c.niche || 'Creator'}</span>
        ${c.availability === 'Available'
          ? '<span style="font-size:0.68rem;color:var(--green-light);font-weight:700">● Available</span>'
          : '<span style="font-size:0.68rem;color:var(--gold-light);font-weight:700">● Busy</span>'}
      </div>
      <div class="creator-stats">
        <div class="creator-stat">
          <div class="creator-stat-val gradient-text">${fmtNum(c.followers)}</div>
          <div class="creator-stat-lbl">Followers</div>
        </div>
        <div class="creator-stat">
          <div class="creator-stat-val" style="color:var(--green-light)">${c.engagementRate}%</div>
          <div class="creator-stat-lbl">Eng.</div>
        </div>
        <div class="creator-stat">
          <div class="creator-stat-val" style="color:var(--gold-light)">${fmtNum(c.xp)}</div>
          <div class="creator-stat-lbl">XP</div>
        </div>
        <div class="creator-stat">
          <div class="creator-stat-val" style="color:#a78bfa">${c.trustScore}</div>
          <div class="creator-stat-lbl">Trust</div>
        </div>
      </div>
      <div class="creator-badges">${badges}</div>
      <div class="creator-places">${placeThumbs}</div>
      <div class="match-bar-wrap">
        <div class="match-bar-label">
          <span class="match-bar-text"><i class="fas fa-robot"></i> Business match score</span>
          <span class="match-bar-pct">${c.matchScore}%</span>
        </div>
        <div class="match-bar-track"><div class="match-bar-fill" style="width:${c.matchScore}%"></div></div>
      </div>
      <div class="creator-price">Avg. collab from <strong>${c.avgPrice} GEL</strong> · ${c.completedCollabs} collabs done</div>
      <div class="creator-actions" onclick="event.stopPropagation()">
        <button class="btn btn-primary btn-sm btn-full" onclick="openOffer('${c.id}')"><i class="fas fa-paper-plane"></i> Send Offer</button>
        <button class="btn btn-ghost btn-sm" onclick="openProfile('${c.id}')"><i class="fas fa-eye"></i> View</button>
        <button class="btn btn-ghost btn-sm" title="Report" onclick="window.location.href='trust.html?report=bad_behavior&target='+encodeURIComponent('${c.username||c.name}')" style="padding:0 10px;color:var(--text-muted)"><i class="fas fa-flag"></i></button>
      </div>
    </div>
  </div>`;
}

function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  state.city = document.getElementById('filterCity').value;
  const nicheTop = document.getElementById('filterNiche').value;
  const followersF = document.getElementById('filterFollowers').value;
  const engF = document.getElementById('filterEngagement').value;
  const levelF = document.getElementById('filterLevel').value;
  state.sort = document.getElementById('sortBy').value;

  let list = CREATORS.filter(c => {
    if (search && !c.fullName.toLowerCase().includes(search) && !c.username.toLowerCase().includes(search)) return false;
    if (state.city && c.city !== state.city) return false;
    const niche = state.niche || nicheTop;
    if (niche && !c.niche.includes(niche)) return false;
    if (levelF && c.explorerLevel !== levelF) return false;
    if (state.level && c.explorerLevel !== state.level) return false;
    if (state.availability && c.availability !== state.availability) return false;
    if (state.trust && c.trustScore < parseInt(state.trust)) return false;
    if (followersF === 'lt1k' && c.followers >= 1000) return false;
    if (followersF === '1k5k' && (c.followers < 1000 || c.followers >= 5000)) return false;
    if (followersF === 'gt5k' && c.followers < 5000) return false;
    if (engF === 'lt3' && c.engagementRate >= 3) return false;
    if (engF === '3to6' && (c.engagementRate < 3 || c.engagementRate > 6)) return false;
    if (engF === 'gt6' && c.engagementRate <= 6) return false;
    return true;
  });

  list.sort((a,b) => {
    if (state.sort === 'xp') return b.xp - a.xp;
    if (state.sort === 'engagement') return b.engagementRate - a.engagementRate;
    if (state.sort === 'price_asc') return a.avgPrice - b.avgPrice;
    if (state.sort === 'price_desc') return b.avgPrice - a.avgPrice;
    if (state.sort === 'followers') return b.followers - a.followers;
    return b.matchScore - a.matchScore;
  });

  const grid = document.getElementById('creatorGrid');
  document.getElementById('resultCount').textContent = list.length;
  if (list.length === 0) {
    grid.innerHTML = `<div class="no-results"><i class="fas fa-search"></i><div style="font-size:1rem;font-weight:700;margin-bottom:6px">No creators found</div><div style="font-size:0.85rem">Try adjusting your filters</div></div>`;
    return;
  }
  grid.innerHTML = list.map(c => renderCreatorCard(c)).join('');
}

function setSidebarFilter(type, val, el) {
  state[type] = val;
  const parent = el.parentElement;
  parent.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  applyFilters();
}

function clearAllFilters() {
  state = { niche:'', level:'', availability:'', trust:'', city:'', followers:'', engagement:'', sort:'match' };
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCity').value = '';
  document.getElementById('filterNiche').value = '';
  document.getElementById('filterFollowers').value = '';
  document.getElementById('filterEngagement').value = '';
  document.getElementById('filterLevel').value = '';
  document.getElementById('sortBy').value = 'match';
  document.querySelectorAll('.filter-chips .filter-chip').forEach((c,i) => {
    c.classList.toggle('active', i === 0 && c.parentElement.children[0] === c);
  });
  // Reset all first chips to active
  document.querySelectorAll('.filter-chips').forEach(fc => {
    fc.querySelectorAll('.filter-chip').forEach((c,i) => c.classList.toggle('active', i === 0));
  });
  applyFilters();
}

/* =========================================================
   PROFILE MODAL
   ========================================================= */
function openProfile(id) {
  const c = CREATORS.find(x => x.id === id);
  if (!c) return;
  activeCreator = c;

  document.getElementById('cmCover').src = c.coverImage || `https://picsum.photos/seed/gh-${id}-cover/800/300`;
  document.getElementById('cmAvatar').src = c.avatar;
  document.getElementById('cmName').textContent = c.fullName;
  document.getElementById('cmHandle').textContent = `@${c.username} · ${c.city} · ${c.explorerLevel}`;
  document.getElementById('cmBio').textContent = c.bio;
  document.getElementById('cmFollowers').textContent = fmtNum(c.followers);
  document.getElementById('cmXP').textContent = fmtNum(c.xp);
  document.getElementById('cmEng').textContent = c.engagementRate + '%';
  document.getElementById('cmPlaces').textContent = c.visitedPlaces;
  document.getElementById('cmTrust').textContent = c.trustScore;
  document.getElementById('cmAudience').textContent = c.audienceType || 'General GeoHub audience';

  const lvl = levelClass(c.explorerLevel);
  const lvlColors = { bronze:'#cd7f32', silver:'#94a3b8', gold:'#f59e0b', platinum:'#a78bfa' };
  document.getElementById('cmLevelBadge').textContent = c.explorerLevel.replace(' Explorer','');
  document.getElementById('cmLevelBadge').style.cssText = `background:${lvlColors[lvl]};color:${lvl==='silver'?'#000':'#fff'};`;

  document.getElementById('cmCategories').innerHTML = (c.topCategories || []).map(cat =>
    `<span class="creator-badge" style="font-size:0.72rem">${cat}</span>`).join('');

  const imgSeeds = ['feed-fabrika-real','feed-juta-trail','feed-night-market','feed-sololaki-yard','feed-shavi-review','feed-cleanup'];
  document.getElementById('cmPostGrid').innerHTML = imgSeeds.slice(0,6).map(s =>
    `<div class="cm-post-thumb"><img src="https://picsum.photos/seed/${s}/300/300" alt="" loading="lazy"></div>`).join('');

  const bp = c.bestPost || {};
  document.getElementById('cmBestPost').innerHTML = `
    <div class="cm-best-post-img"><img src="https://picsum.photos/seed/${bp.img||'feed-fabrika-real'}/200/200" alt="" loading="lazy"></div>
    <div>
      <div style="font-size:0.8rem;font-weight:700;margin-bottom:4px;color:var(--green-light)">Best Performing Post</div>
      <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:6px">"${bp.caption||c.bio}"</div>
      <div style="font-size:0.72rem;color:var(--text-muted)"><i class="fas fa-heart" style="color:#ef4444"></i> ${bp.likes||'--'} likes · Top post this month</div>
    </div>`;

  document.getElementById('cmPackages').innerHTML = (c.packages || []).map(pkg => `
    <div class="cm-package">
      <div>
        <div class="cm-pkg-name">${pkg.name}</div>
        <div class="cm-pkg-desc">${pkg.desc}</div>
      </div>
      <div class="cm-pkg-price">${pkg.price} GEL</div>
    </div>`).join('');

  document.getElementById('cmPrevCollabs').innerHTML = (c.previousCollabs || []).map(b =>
    `<span class="cm-collab-tag"><i class="fas fa-store" style="color:var(--green);margin-right:4px;font-size:0.65rem"></i>${b}</span>`).join('');

  const indicators = [
    { icon:'fa-check-circle', label:`Trust Score: ${c.trustScore}/100` },
    { icon:'fa-bolt', label:`XP Rank #${c.rank}` },
    { icon:'fa-handshake', label:`${c.completedCollabs} completed collabs` },
    { icon:'fa-map-marker-alt', label:`${c.visitedPlaces} places verified` },
    ...(c.availability === 'Available' ? [{ icon:'fa-calendar-check', label:'Available now' }] : [])
  ];
  document.getElementById('cmTrustIndicators').innerHTML = indicators.map(i =>
    `<div class="cm-trust-item"><i class="fas ${i.icon}"></i>${i.label}</div>`).join('');

  document.getElementById('profileModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.remove('open');
  document.body.style.overflow = '';
}

function openOfferFromProfile() {
  closeProfileModal();
  if (activeCreator) openOffer(activeCreator.id);
}

/* =========================================================
   OFFER MODAL
   ========================================================= */
function openOffer(id) {
  const c = CREATORS.find(x => x.id === id);
  if (!c) return;
  activeCreator = c;
  document.getElementById('offerTargetName').textContent = `To: ${c.fullName} (@${c.username})`;
  document.getElementById('offerSuccess').classList.remove('show');
  document.getElementById('offerFormBody').classList.remove('hidden');
  document.getElementById('offerTitle').value = '';
  document.getElementById('offerDetails').value = '';
  document.getElementById('offerBudget').value = '';
  document.getElementById('offerDeliverables').value = '';
  document.querySelector('.offer-type-card.selected')?.classList.remove('selected');
  document.querySelector('[data-type="free_product"]').classList.add('selected');
  activeOfferType = 'free_product';
  document.getElementById('offerModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeOfferModal() {
  document.getElementById('offerModal').classList.remove('open');
  document.body.style.overflow = '';
}

function selectOfferType(el) {
  document.querySelectorAll('.offer-type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  activeOfferType = el.dataset.type;
}

const offerTypeLabels = {
  free_product: 'Free Product', paid: 'Paid Collaboration', discount: 'Discount Code',
  event: 'Event Invite', checkin: 'Sponsored Check-in', story: 'Story Promotion', feed: 'Feed Post'
};

function submitOffer() {
  const title = document.getElementById('offerTitle').value.trim();
  const budget = document.getElementById('offerBudget').value;
  const deliverables = document.getElementById('offerDeliverables').value.trim();
  const c = activeCreator;

  document.getElementById('offerSummary').innerHTML = `
    <div style="margin-bottom:6px"><strong>Creator:</strong> ${c.fullName} (@${c.username})</div>
    <div style="margin-bottom:6px"><strong>Offer Type:</strong> ${offerTypeLabels[activeOfferType]}</div>
    <div style="margin-bottom:6px"><strong>Campaign:</strong> ${title || 'Untitled'}</div>
    ${budget ? `<div style="margin-bottom:6px"><strong>Budget:</strong> ${budget} GEL</div>` : ''}
    ${deliverables ? `<div><strong>Expected:</strong> ${deliverables}</div>` : ''}
  `;
  document.getElementById('offerFormBody').classList.add('hidden');
  document.getElementById('offerSuccess').classList.add('show');
}

/* =========================================================
   LEADERBOARD
   ========================================================= */
let currentLbTab = 'xp';
function switchLbTab(tab, el) {
  currentLbTab = tab;
  document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderLeaderboard();
}

function renderLeaderboard() {
  const data = LB_DATA[currentLbTab] || [];
  const rankClasses = ['r1','r2','r3','rn','rn'];
  document.getElementById('lbGrid').innerHTML = data.map((item, i) => {
    const u = MOCK_USERS.find(x => x.id === item.id);
    if (!u) return '';
    return `
    <div class="lb-card animate-fade-up">
      <div class="lb-rank ${rankClasses[i]}">${i+1}</div>
      <div class="lb-avatar"><img src="${u.avatar}" alt="${u.fullName}" loading="lazy"></div>
      <div class="lb-info">
        <div class="lb-name">${u.fullName}</div>
        <div class="lb-sub">@${u.username} · ${u.city}</div>
      </div>
      <div class="lb-val">${item.val}</div>
    </div>`;
  }).join('');
}

/* =========================================================
   CLOSE MODALS
   ========================================================= */
document.getElementById('profileModal').addEventListener('click', e => { if (e.target.id === 'profileModal') closeProfileModal(); });
document.getElementById('offerModal').addEventListener('click', e => { if (e.target.id === 'offerModal') closeOfferModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeProfileModal(); closeOfferModal(); }
});

/* =========================================================
   INIT
   ========================================================= */
applyFilters();
renderLeaderboard();
initScrollAnimations?.();

// Scroll animation for match bars
setTimeout(() => {
  document.querySelectorAll('.match-bar-fill').forEach(bar => {
    const w = bar.style.width;
    bar.style.width = '0';
    setTimeout(() => { bar.style.width = w; }, 100);
  });
}, 200);
