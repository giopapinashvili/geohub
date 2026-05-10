/* ================================================================
   GeoHub — Events & Tickets System
   ================================================================ */

const MOCK_EVENTS = [
  {
    id: 'ev01', title: 'Electronic Music Night', category: 'music', dateTag: 'today',
    dateStr: 'Today', time: '22:00', endTime: '06:00',
    venue: 'Bassiani Club', city: 'Tbilisi', address: 'Tbilisi, 6 Akaki Tsereteli Ave',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=700&q=80',
    price: 25, currency: 'GEL', free: false, live: true,
    xp: 150, attending: 234, capacity: 800,
    organizer: 'Bassiani', organizerAvatar: 'https://i.pravatar.cc/40?img=3',
    tags: ['Techno', 'Electronic', '18+'],
    description: 'One of the most iconic techno clubs in the world opens its doors for an all-night electronic music journey. International DJs, state-of-the-art sound system, and an unforgettable atmosphere.',
    schedule: [
      { time: '22:00', act: 'Doors Open' },
      { time: '23:00', act: 'DJ Giorgi K (Warm-up)' },
      { time: '01:00', act: 'SHXCXCHXSH (Headliner)' },
      { time: '04:00', act: 'After Hours Set' },
    ],
    friendsGoing: ['u01','u06','u10'],
  },
  {
    id: 'ev02', title: 'Fabrika Night Market', category: 'nightlife', dateTag: 'today',
    dateStr: 'Today', time: '18:00', endTime: '23:00',
    venue: 'Fabrika Tbilisi', city: 'Tbilisi', address: '8 Davit Agmashenebeli Ave',
    cover: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=700&q=80',
    price: 0, currency: 'GEL', free: true, live: true,
    xp: 80, attending: 512, capacity: 2000,
    organizer: 'Fabrika', organizerAvatar: 'https://i.pravatar.cc/40?img=8',
    tags: ['Market', 'Food', 'Free Entry'],
    description: 'Tbilisi\'s most vibrant creative hub hosts its famous night market. Local vendors, street food, live music, and handmade goods in the iconic factory courtyard.',
    schedule: [
      { time: '18:00', act: 'Market Opens' },
      { time: '19:30', act: 'Live Band Performance' },
      { time: '21:00', act: 'DJ Set Begins' },
      { time: '23:00', act: 'Closing' },
    ],
    friendsGoing: ['u02','u04','u07'],
  },
  {
    id: 'ev03', title: 'Yoga in Vake Park', category: 'sports', dateTag: 'today',
    dateStr: 'Today', time: '08:00', endTime: '09:30',
    venue: 'Vake Park', city: 'Tbilisi', address: 'Vake Park, Tbilisi',
    cover: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=700&q=80',
    price: 0, currency: 'GEL', free: true, live: true,
    xp: 60, attending: 87, capacity: 200,
    organizer: 'TbilisiYoga', organizerAvatar: 'https://i.pravatar.cc/40?img=12',
    tags: ['Yoga', 'Wellness', 'Outdoor', 'Free'],
    description: 'Start your morning with an energizing outdoor yoga session in the heart of Vake Park. All levels welcome. Bring your own mat.',
    schedule: [
      { time: '08:00', act: 'Warm-up & Breathing' },
      { time: '08:20', act: 'Vinyasa Flow' },
      { time: '09:10', act: 'Cool Down & Meditation' },
    ],
    friendsGoing: ['u14','u21'],
  },
  {
    id: 'ev04', title: 'Tbilisi Jazz Festival', category: 'music', dateTag: 'tomorrow',
    dateStr: 'Tomorrow', time: '20:00', endTime: '23:30',
    venue: 'Tbilisi Philharmonic', city: 'Tbilisi', address: '1 Melikishvili Ave',
    cover: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=700&q=80',
    price: 35, currency: 'GEL', free: false, live: false,
    xp: 120, attending: 356, capacity: 1200,
    organizer: 'TbilisiJazzFest', organizerAvatar: 'https://i.pravatar.cc/40?img=15',
    tags: ['Jazz', 'Live Music', 'Classical Venue'],
    description: 'An elegant evening of world-class jazz at the historic Tbilisi Philharmonic Hall. Featuring local and international jazz ensembles across two stages.',
    schedule: [
      { time: '20:00', act: 'Doors Open & Exhibition' },
      { time: '20:30', act: 'Quartet Rustavi (Opening)' },
      { time: '21:30', act: 'Maria Schneider Orchestra (Headliner)' },
      { time: '23:00', act: 'Jazz Jam Session' },
    ],
    friendsGoing: ['u27','u12'],
  },
  {
    id: 'ev05', title: 'Sololaki Art Walk', category: 'art', dateTag: 'tomorrow',
    dateStr: 'Tomorrow', time: '16:00', endTime: '21:00',
    venue: 'Sololaki District', city: 'Tbilisi', address: 'Sololaki, Old Town, Tbilisi',
    cover: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=700&q=80',
    price: 0, currency: 'GEL', free: true, live: false,
    xp: 90, attending: 143, capacity: 500,
    organizer: 'GeoArtSpace', organizerAvatar: 'https://i.pravatar.cc/40?img=20',
    tags: ['Art', 'Culture', 'Walking Tour', 'Free'],
    description: 'Explore Sololaki\'s hidden art galleries, street murals, and open studios. Local artists open their doors to the public for an evening of creativity and culture.',
    schedule: [
      { time: '16:00', act: 'Starting Point: Lado Asatiani St' },
      { time: '17:00', act: 'Gallery Openings Begin' },
      { time: '19:00', act: 'Artist Talks & Live Painting' },
      { time: '21:00', act: 'Closing Reception' },
    ],
    friendsGoing: ['u23','u13'],
  },
  {
    id: 'ev06', title: 'Latin Dance Workshop', category: 'workshop', dateTag: 'tomorrow',
    dateStr: 'Tomorrow', time: '19:00', endTime: '21:30',
    venue: 'Dance Studio Flow', city: 'Tbilisi', address: '42 Kostava St, Tbilisi',
    cover: 'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?w=700&q=80',
    price: 35, currency: 'GEL', free: false, live: false,
    xp: 100, attending: 28, capacity: 40,
    organizer: 'DanceFlowGe', organizerAvatar: 'https://i.pravatar.cc/40?img=25',
    tags: ['Dance', 'Salsa', 'Bachata', 'Beginner Friendly'],
    description: 'Learn salsa and bachata from scratch! Professional instructors guide you through the fundamentals of Latin dance in a fun, welcoming environment. No partner needed.',
    schedule: [
      { time: '19:00', act: 'Warm-up & Footwork Basics' },
      { time: '19:45', act: 'Salsa Fundamentals' },
      { time: '20:30', act: 'Bachata & Partner Work' },
      { time: '21:15', act: 'Social Dance & Q&A' },
    ],
    friendsGoing: ['u18'],
  },
  {
    id: 'ev07', title: 'Gergeti Sunrise Hike', category: 'hiking', dateTag: 'weekend',
    dateStr: 'Sat 10 May', time: '04:00', endTime: '14:00',
    venue: 'Gergeti Trinity Church', city: 'Kazbegi', address: 'Kazbegi National Park',
    cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=700&q=80',
    price: 80, currency: 'GEL', free: false, live: false,
    xp: 300, attending: 22, capacity: 30,
    organizer: 'GeoTrails', organizerAvatar: 'https://i.pravatar.cc/40?img=30',
    tags: ['Hiking', 'Sunrise', 'Kazbegi', 'Guided'],
    description: 'Watch the sunrise from Gergeti Trinity Church at 2170m. A guided 10km round-trip hike through stunning Caucasus mountain scenery. Transport from Tbilisi included.',
    schedule: [
      { time: '04:00', act: 'Departure from Tbilisi (Rustaveli)' },
      { time: '07:00', act: 'Arrive Kazbegi, Begin Hike' },
      { time: '09:30', act: 'Summit — Sunrise at Gergeti Church' },
      { time: '11:00', act: 'Descent & Breakfast in Stepantsminda' },
      { time: '14:00', act: 'Return to Tbilisi' },
    ],
    friendsGoing: ['u30','u07'],
  },
  {
    id: 'ev08', title: 'Georgian Wine Tasting', category: 'food', dateTag: 'weekend',
    dateStr: 'Sat 10 May', time: '15:00', endTime: '18:00',
    venue: 'Vino Underground', city: 'Tbilisi', address: '18 Galaktion Tabidze St',
    cover: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=700&q=80',
    price: 45, currency: 'GEL', free: false, live: false,
    xp: 110, attending: 38, capacity: 50,
    organizer: 'VinoGe', organizerAvatar: 'https://i.pravatar.cc/40?img=35',
    tags: ['Wine', 'Qvevri', 'Tasting', 'Georgian'],
    description: 'Discover the world\'s oldest wine-making tradition. Taste 8 premium natural Georgian wines with expert sommelier guidance. Includes cheese and charcuterie pairing.',
    schedule: [
      { time: '15:00', act: 'Welcome & Introduction to Qvevri' },
      { time: '15:30', act: 'White Wines Tasting (4 varieties)' },
      { time: '16:30', act: 'Amber & Red Wines' },
      { time: '17:30', act: 'Q&A & Open Tasting' },
    ],
    friendsGoing: ['u01','u04'],
  },
  {
    id: 'ev09', title: 'Urban Photography Workshop', category: 'workshop', dateTag: 'weekend',
    dateStr: 'Sun 11 May', time: '10:00', endTime: '14:00',
    venue: 'Old Town Tbilisi', city: 'Tbilisi', address: 'Meet at Metekhi Bridge',
    cover: 'https://images.unsplash.com/photo-1495745966610-2a67f2297e5e?w=700&q=80',
    price: 30, currency: 'GEL', free: false, live: false,
    xp: 120, attending: 14, capacity: 20,
    organizer: 'LensGe', organizerAvatar: 'https://i.pravatar.cc/40?img=40',
    tags: ['Photography', 'Street', 'Urban', 'Workshop'],
    description: 'Explore Tbilisi\'s most photogenic streets with a professional photographer. Learn composition, light, and storytelling through your lens. All camera types welcome.',
    schedule: [
      { time: '10:00', act: 'Meet & Camera Settings Basics' },
      { time: '10:30', act: 'Old Town Walk — Abanotubani' },
      { time: '12:00', act: 'Shardeni Street & Markets' },
      { time: '13:30', act: 'Photo Review & Feedback' },
    ],
    friendsGoing: ['u13','u27'],
  },
  {
    id: 'ev10', title: 'Tbilisi Craft Beer Festival', category: 'nightlife', dateTag: 'weekend',
    dateStr: 'Sun 11 May', time: '14:00', endTime: '22:00',
    venue: 'Rike Park', city: 'Tbilisi', address: 'Rike Park, Tbilisi',
    cover: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=700&q=80',
    price: 25, currency: 'GEL', free: false, live: false,
    xp: 100, attending: 890, capacity: 3000,
    organizer: 'CraftBeerGe', organizerAvatar: 'https://i.pravatar.cc/40?img=45',
    tags: ['Beer', 'Festival', 'Outdoor', 'Live Music'],
    description: 'Georgia\'s biggest craft beer festival returns to Rike Park. 40+ local and international breweries, live bands, food trucks, and games in the heart of Tbilisi.',
    schedule: [
      { time: '14:00', act: 'Festival Opens, Breweries Set Up' },
      { time: '16:00', act: 'Live Band: The Deers' },
      { time: '18:30', act: 'Beer Tasting Competition' },
      { time: '20:00', act: 'Headliner: Mgzavrebi' },
    ],
    friendsGoing: ['u02','u06','u30'],
  },
  {
    id: 'ev11', title: 'Tech Startup Meetup', category: 'workshop', dateTag: 'next-week',
    dateStr: 'Tue 13 May', time: '19:00', endTime: '21:30',
    venue: 'Impact Hub Tbilisi', city: 'Tbilisi', address: '27 Rustaveli Ave',
    cover: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=700&q=80',
    price: 0, currency: 'GEL', free: true, live: false,
    xp: 80, attending: 67, capacity: 100,
    organizer: 'StartupGe', organizerAvatar: 'https://i.pravatar.cc/40?img=50',
    tags: ['Tech', 'Startup', 'Networking', 'Free'],
    description: 'Monthly meetup for Georgia\'s startup ecosystem. Pitch sessions, investor talks, and networking. 3 founders pitch their MVPs live. All are welcome.',
    schedule: [
      { time: '19:00', act: 'Networking & Check-in' },
      { time: '19:30', act: '3x Founder Pitches (5 min each)' },
      { time: '20:30', act: 'Investor Panel Q&A' },
      { time: '21:00', act: 'Open Networking' },
    ],
    friendsGoing: ['u10','u12'],
  },
  {
    id: 'ev12', title: 'Kutaisi Food Festival', category: 'food', dateTag: 'next-week',
    dateStr: 'Sat 17 May', time: '12:00', endTime: '20:00',
    venue: 'Kutaisi White Bridge', city: 'Kutaisi', address: 'White Bridge, Kutaisi',
    cover: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=700&q=80',
    price: 0, currency: 'GEL', free: true, live: false,
    xp: 90, attending: 320, capacity: 2000,
    organizer: 'KutaisiFest', organizerAvatar: 'https://i.pravatar.cc/40?img=55',
    tags: ['Food', 'Culture', 'Kutaisi', 'Free'],
    description: 'Celebrate the flavors of western Georgia along the Rioni River. Traditional dishes, cooking demos, folk music, and local producers showcase the best of Imereti cuisine.',
    schedule: [
      { time: '12:00', act: 'Festival Opens' },
      { time: '13:00', act: 'Cooking Demonstration: Imeruli Khachapuri' },
      { time: '15:00', act: 'Folk Music Performance' },
      { time: '17:00', act: 'Chef Competition & Tasting' },
    ],
    friendsGoing: ['u21','u23'],
  },
];

const QR_PATTERN = [
  [1,1,1,1,1,1,1,0,1,0,1],
  [1,0,0,0,0,0,1,0,0,1,0],
  [1,0,1,1,1,0,1,0,1,0,1],
  [1,0,1,1,1,0,1,0,0,1,1],
  [1,0,1,1,1,0,1,0,1,1,0],
  [1,0,0,0,0,0,1,0,0,0,1],
  [1,1,1,1,1,1,1,0,1,0,1],
  [0,0,0,0,0,0,0,0,1,1,0],
  [1,0,1,1,0,1,0,1,0,1,1],
  [0,1,0,0,1,0,0,0,1,0,0],
  [1,1,1,0,1,1,1,1,0,1,1],
];

const evFilterState = { date: 'all', category: 'all', q: '', sort: 'date', city: 'all' };
let myTickets = window.safeStorage.get('gh_my_tickets', []);
let currentDetailId = null;
let currentTicketId = null;
let selectedInvitees = [];

// ======================== FILTERS ========================
function setDateFilter(val, el) {
  evFilterState.date = val;
  document.querySelectorAll('.qf-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  applyFilters();
}

function setCatFilter(val, el) {
  evFilterState.category = val;
  document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  applyFilters();
}

function setSortFilter(val) {
  evFilterState.sort = val;
  applyFilters();
}

function clearFilters() {
  evFilterState.date = 'all';
  evFilterState.category = 'all';
  evFilterState.q = '';
  document.querySelectorAll('.qf-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.qf-btn[data-date="all"]')?.classList.add('active');
  document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
  document.querySelector('.cat-chip[data-cat="all"]')?.classList.add('active');
  const si = document.getElementById('evSearch');
  if (si) si.value = '';
  applyFilters();
}

function applyFilters() {
  const q = (document.getElementById('evSearch')?.value || '').toLowerCase();
  const city = document.getElementById('evCity')?.value || 'All Cities';
  evFilterState.q = q;

  let filtered = MOCK_EVENTS.filter(ev => {
    if (evFilterState.date !== 'all' && ev.dateTag !== evFilterState.date) return false;
    if (evFilterState.category === 'free') { if (!ev.free) return false; }
    else if (evFilterState.category !== 'all' && ev.category !== evFilterState.category) return false;
    if (city !== 'All Cities' && ev.city !== city) return false;
    if (q && !ev.title.toLowerCase().includes(q) && !ev.venue.toLowerCase().includes(q) && !ev.city.toLowerCase().includes(q)) return false;
    return true;
  });

  if (evFilterState.sort === 'popular') filtered.sort((a, b) => b.attending - a.attending);
  else if (evFilterState.sort === 'price-low') filtered.sort((a, b) => a.price - b.price);
  else if (evFilterState.sort === 'price-high') filtered.sort((a, b) => b.price - a.price);

  const grid = document.getElementById('eventsGrid');
  const empty = document.getElementById('eventsEmpty');
  const count = document.getElementById('resultCount');

  if (grid) grid.innerHTML = filtered.map(renderEventCard).join('');
  if (count) count.textContent = `${filtered.length} event${filtered.length !== 1 ? 's' : ''} found`;
  if (empty) empty.classList.toggle('hidden', filtered.length > 0);
}

// ======================== CARD RENDER ========================
function renderEventCard(ev) {
  const hasTix = myTickets.find(t => t.eventId === ev.id);
  const friendAvatars = (ev.friendsGoing || []).slice(0, 3).map(uid => {
    const u = (typeof MOCK_USERS !== 'undefined' ? MOCK_USERS : []).find(x => x.id === uid);
    return u ? `<img src="${u.avatar}" alt="${u.fullName}" title="${u.fullName}">` : '';
  }).join('');

  return `
  <div class="event-card" onclick="openDetail('${ev.id}')">
    <div class="event-card-img-wrap">
      <img src="${ev.cover}" alt="${ev.title}" loading="lazy" class="event-card-img">
      <div class="event-card-overlays">
        ${ev.live ? '<span class="ev-live-badge"><span class="ev-live-dot"></span>LIVE</span>' : ''}
        <span class="ev-date-badge">${ev.dateStr} · ${ev.time}</span>
      </div>
      <div class="ev-xp-badge"><i class="fas fa-bolt"></i> +${ev.xp} XP</div>
    </div>
    <div class="event-card-body">
      <div class="ev-cat-row">
        <span class="ev-category-tag ev-cat-${ev.category}">${ev.category}</span>
        ${ev.free ? '<span class="ev-free-tag">FREE</span>' : ''}
      </div>
      <h3 class="event-card-title">${ev.title}</h3>
      <div class="event-card-meta">
        <span><i class="fas fa-map-marker-alt"></i> ${ev.venue}</span>
        <span><i class="fas fa-city"></i> ${ev.city}</span>
      </div>
      <div class="event-card-footer">
        <div class="ev-friends-row">
          ${friendAvatars ? `<div class="ev-friend-avatars">${friendAvatars}</div><span class="ev-friends-text">${ev.friendsGoing.length} friend${ev.friendsGoing.length !== 1 ? 's' : ''} going</span>` : `<span class="ev-attending"><i class="fas fa-user"></i> ${ev.attending} going</span>`}
        </div>
        <div class="ev-price-action">
          ${ev.free
            ? `<button class="btn btn-sm ev-join-btn ${hasTix ? 'ev-joined' : 'btn-primary'}" onclick="event.stopPropagation();${hasTix ? '' : `openTicketModal('${ev.id}')`}">
                ${hasTix ? '<i class="fas fa-check"></i> Joined' : '<i class="fas fa-plus"></i> Join'}
              </button>`
            : `<div class="ev-price-wrap">
                <span class="ev-price-from">From</span>
                <span class="ev-price-val">${ev.price} ${ev.currency}</span>
              </div>
              <button class="btn btn-sm ${hasTix ? 'btn-ghost ev-joined' : 'btn-primary'}" onclick="event.stopPropagation();${hasTix ? '' : `openTicketModal('${ev.id}')`}">
                ${hasTix ? '<i class="fas fa-ticket-alt"></i> Got Ticket' : 'Get Ticket'}
              </button>`
          }
        </div>
      </div>
    </div>
  </div>`;
}

// ======================== LIVE STRIP ========================
function renderLiveStrip() {
  const strip = document.getElementById('liveStrip');
  if (!strip) return;
  const liveEvs = MOCK_EVENTS.filter(e => e.live);
  strip.innerHTML = liveEvs.map(ev => `
    <div class="live-strip-card" onclick="openDetail('${ev.id}')">
      <img src="${ev.cover}" alt="${ev.title}" class="live-strip-img">
      <div class="live-strip-info">
        <div class="live-strip-title">${ev.title}</div>
        <div class="live-strip-sub"><i class="fas fa-map-marker-alt"></i> ${ev.venue} · ${ev.time}</div>
        <div class="live-strip-att"><i class="fas fa-user"></i> ${ev.attending} attending</div>
      </div>
      <span class="live-pill"><span class="live-dot-sm"></span> LIVE</span>
    </div>`).join('');
}

// ======================== MODALS ========================
function openEvModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEvModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['detailModal','ticketModal','inviteModal','shareModal','createEventModal','promoModal'].forEach(closeEvModal);
  }
});

// ======================== EVENT DETAIL ========================
function openDetail(id) {
  const ev = MOCK_EVENTS.find(e => e.id === id);
  if (!ev) return;
  currentDetailId = id;

  const hasTix = myTickets.find(t => t.eventId === id);
  const friendsHtml = (ev.friendsGoing || []).map(uid => {
    const u = (typeof MOCK_USERS !== 'undefined' ? MOCK_USERS : []).find(x => x.id === uid);
    return u ? `<div class="detail-friend"><img src="${u.avatar}" alt="${u.fullName}"><span>${u.fullName.split(' ')[0]}</span></div>` : '';
  }).join('');

  const scheduleHtml = ev.schedule.map(s =>
    `<div class="detail-schedule-item"><span class="sch-time">${s.time}</span><span class="sch-act">${s.act}</span></div>`
  ).join('');

  const tagsHtml = ev.tags.map(t => `<span class="ev-tag-pill">${t}</span>`).join('');

  document.getElementById('detailContent').innerHTML = `
    <img src="${ev.cover}" alt="${ev.title}" class="detail-cover">
    <div class="detail-body">
      <div class="detail-header">
        <div>
          ${ev.live ? '<span class="ev-live-badge" style="position:static;margin-bottom:8px;display:inline-flex"><span class="ev-live-dot"></span>LIVE NOW</span>' : ''}
          <h2 class="detail-title">${ev.title}</h2>
          <div class="detail-meta-row">
            <span><i class="fas fa-calendar"></i> ${ev.dateStr} · ${ev.time}–${ev.endTime}</span>
            <span><i class="fas fa-map-marker-alt"></i> ${ev.venue}, ${ev.city}</span>
          </div>
          <div class="detail-tags">${tagsHtml}</div>
        </div>
        <div class="detail-xp-box">
          <i class="fas fa-bolt" style="color:var(--gold)"></i>
          <span class="detail-xp-val">+${ev.xp}</span>
          <span class="detail-xp-lbl">XP</span>
        </div>
      </div>

      <p class="detail-desc">${ev.description}</p>

      <div class="detail-section">
        <div class="detail-section-title"><i class="fas fa-clock"></i> Schedule</div>
        <div class="detail-schedule">${scheduleHtml}</div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title"><i class="fas fa-map"></i> Location</div>
        <div class="detail-map-stub">
          <i class="fas fa-map-marker-alt"></i>
          <div>
            <div style="font-weight:700">${ev.venue}</div>
            <div style="font-size:0.82rem;color:var(--text-muted)">${ev.address}</div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title"><i class="fas fa-user-tie"></i> Organizer</div>
        <div class="detail-organizer">
          <img src="${ev.organizer_avatar || ev.organizerAvatar}" class="detail-org-avatar">
          <div>
            <div style="font-weight:700">${ev.organizer}</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">Event Organizer</div>
          </div>
        </div>
      </div>

      ${friendsHtml ? `<div class="detail-section">
        <div class="detail-section-title"><i class="fas fa-users"></i> Friends Going</div>
        <div class="detail-friends">${friendsHtml}</div>
      </div>` : ''}

      <div class="detail-actions">
        <div class="detail-attending"><i class="fas fa-user"></i> ${ev.attending} attending · ${ev.capacity - ev.attending} spots left</div>
        <div class="detail-btn-row">
          <button class="btn btn-ghost btn-sm" onclick="openInvite('${ev.id}')"><i class="fas fa-user-plus"></i> Invite</button>
          <button class="btn btn-ghost btn-sm" onclick="closeEvModal('detailModal');openShare('${ev.id}')"><i class="fas fa-share-alt"></i> Share</button>
          <button class="btn btn-ghost btn-sm" onclick="closeEvModal('detailModal');openPromotion('${ev.id}')"><i class="fas fa-rocket"></i> Promote</button>
          ${hasTix
            ? `<button class="btn btn-primary" style="opacity:0.7;cursor:default"><i class="fas fa-check"></i> ${ev.free ? 'Joined' : 'Ticket Saved'}</button>`
            : `<button class="btn btn-primary" onclick="closeEvModal('detailModal');openTicketModal('${ev.id}')"><i class="fas fa-ticket-alt"></i> ${ev.free ? 'Join Event' : 'Get Ticket — ' + ev.price + ' ' + ev.currency}</button>`
          }
        </div>
      </div>
    </div>`;

  openEvModal('detailModal');
}

// ======================== TICKET MODAL ========================
function openTicketModal(id) {
  const ev = MOCK_EVENTS.find(e => e.id === id);
  if (!ev) return;
  currentTicketId = id;

  document.getElementById('ticketContent').innerHTML = buildTicketForm(ev);
  openEvModal('ticketModal');
}

function buildTicketForm(ev) {
  return `
    <div class="ticket-modal-header">
      <img src="${ev.cover}" class="ticket-modal-cover">
      <div class="ticket-modal-info">
        <h3>${ev.title}</h3>
        <div class="ticket-meta"><i class="fas fa-calendar"></i> ${ev.dateStr} · ${ev.time}</div>
        <div class="ticket-meta"><i class="fas fa-map-marker-alt"></i> ${ev.venue}</div>
      </div>
    </div>
    <div class="ticket-form-body" id="ticketFormBody">
      ${ev.free ? '' : `
      <div class="ticket-qty-row">
        <span class="ticket-form-label">Tickets</span>
        <div class="ticket-qty-ctrl">
          <button onclick="changeQty(-1)">−</button>
          <span id="qtyDisplay">1</span>
          <button onclick="changeQty(1)">+</button>
        </div>
      </div>
      <div class="ticket-type-row">
        <label class="ticket-type-opt active" onclick="selectTicketType(this,'General','${ev.price}')">
          <input type="radio" name="ttype" checked>
          <span class="tt-name">General</span><span class="tt-price">${ev.price} GEL</span>
        </label>
        <label class="ticket-type-opt" onclick="selectTicketType(this,'VIP','${ev.price * 2}')">
          <input type="radio" name="ttype">
          <span class="tt-name">VIP</span><span class="tt-price">${ev.price * 2} GEL</span>
        </label>
      </div>
      <div class="coupon-row">
        <input type="text" id="couponInput" placeholder="Promo code" class="coupon-input">
        <button class="btn btn-ghost btn-sm" onclick="applyCoupon()">Apply</button>
      </div>
      <div id="couponMsg" style="font-size:0.78rem;margin-top:4px"></div>
      `}
      <div class="ticket-total-row">
        <span>Total</span>
        <span id="ticketTotal">${ev.free ? 'Free' : ev.price + ' GEL'}</span>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="confirmTicket()">
        <i class="fas fa-ticket-alt"></i> ${ev.free ? 'Confirm & Join' : 'Pay & Get Ticket'}
      </button>
      <p style="font-size:0.72rem;color:var(--text-muted);text-align:center;margin-top:8px">Mock payment — no real charges</p>
    </div>
    <div class="ticket-success hidden" id="ticketSuccess">
      <div class="ticket-success-icon"><i class="fas fa-check-circle"></i></div>
      <h3>${ev.free ? 'You\'re in!' : 'Ticket Confirmed!'}</h3>
      <p>Your ticket has been saved to My Tickets</p>
      <div class="ticket-qr-wrap" id="confirmQR"></div>
      <div class="ticket-code-label" id="ticketCodeDisplay"></div>
      <button class="btn btn-primary" style="margin-top:16px" onclick="closeEvModal('ticketModal')">Done</button>
    </div>`;
}

let currentQty = 1;
let currentTicketPrice = 0;
let currentTicketType = 'General';
let couponApplied = false;

function changeQty(delta) {
  currentQty = Math.max(1, Math.min(10, currentQty + delta));
  document.getElementById('qtyDisplay').textContent = currentQty;
  updateTotal();
}

function selectTicketType(el, type, price) {
  document.querySelectorAll('.ticket-type-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  currentTicketType = type;
  currentTicketPrice = parseFloat(price);
  updateTotal();
}

function updateTotal() {
  const ev = MOCK_EVENTS.find(e => e.id === currentTicketId);
  if (!ev || ev.free) return;
  const base = currentTicketPrice || ev.price;
  let total = base * currentQty;
  if (couponApplied) total = Math.round(total * 0.8);
  const el = document.getElementById('ticketTotal');
  if (el) el.textContent = total + ' GEL';
}

function applyCoupon() {
  const code = document.getElementById('couponInput')?.value.trim().toUpperCase();
  const msg = document.getElementById('couponMsg');
  if (code === 'GEOHUB20') {
    couponApplied = true;
    if (msg) { msg.textContent = '✓ 20% discount applied!'; msg.style.color = 'var(--green)'; }
    updateTotal();
  } else {
    couponApplied = false;
    if (msg) { msg.textContent = 'Invalid promo code'; msg.style.color = 'var(--red, #ef4444)'; }
  }
}

function confirmTicket() {
  const ev = MOCK_EVENTS.find(e => e.id === currentTicketId);
  if (!ev) return;

  const code = 'GH-' + ev.id.toUpperCase() + '-' + Math.random().toString(36).slice(2,7).toUpperCase();
  const ticket = {
    eventId: ev.id,
    title: ev.title,
    dateStr: ev.dateStr,
    time: ev.time,
    venue: ev.venue,
    cover: ev.cover,
    type: currentTicketType,
    qty: currentQty,
    code,
    free: ev.free,
    savedAt: Date.now(),
  };

  myTickets = myTickets.filter(t => t.eventId !== ev.id);
  myTickets.unshift(ticket);
  window.safeStorage.set('gh_my_tickets', myTickets);

  document.getElementById('ticketFormBody')?.classList.add('hidden');
  const succ = document.getElementById('ticketSuccess');
  if (succ) succ.classList.remove('hidden');

  const qrWrap = document.getElementById('confirmQR');
  if (qrWrap) buildQR('confirmQR', code);

  const codeEl = document.getElementById('ticketCodeDisplay');
  if (codeEl) codeEl.textContent = code;

  updateMyTicketsCount();
  applyFilters();
}

// ======================== QR BUILDER ========================
function buildQR(containerId, code) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const seed = code ? code.charCodeAt(code.length - 1) % 3 : 0;
  const shifted = QR_PATTERN.map((row, ri) =>
    row.map((cell, ci) => cell ^ ((ri + ci + seed) % 7 === 0 ? 1 : 0))
  );
  const size = 11;
  let html = `<div class="qr-grid" style="display:grid;grid-template-columns:repeat(${size},1fr);gap:2px;width:110px;margin:0 auto">`;
  shifted.forEach(row => {
    row.forEach(cell => {
      html += `<div style="width:8px;height:8px;background:${cell ? '#fff' : '#111'};border-radius:1px"></div>`;
    });
  });
  html += '</div>';
  wrap.innerHTML = html;
}

// ======================== MY TICKETS ========================
function renderMyTickets() {
  const wrap = document.getElementById('myTicketsWrap');
  if (!wrap) return;

  if (!myTickets.length) {
    wrap.innerHTML = `<div class="tickets-empty"><i class="fas fa-ticket-alt"></i><p>No tickets yet</p><button class="btn btn-primary btn-sm" onclick="switchEvTab('discover',document.querySelector('.ev-tab'))">Discover Events</button></div>`;
    return;
  }

  wrap.innerHTML = myTickets.map(t => `
    <div class="my-ticket-card">
      <img src="${t.cover}" class="my-ticket-cover">
      <div class="my-ticket-info">
        <div class="my-ticket-title">${t.title}</div>
        <div class="my-ticket-meta"><i class="fas fa-calendar"></i> ${t.dateStr} · ${t.time}</div>
        <div class="my-ticket-meta"><i class="fas fa-map-marker-alt"></i> ${t.venue}</div>
        <div class="my-ticket-meta"><i class="fas fa-tag"></i> ${t.type}${t.qty > 1 ? ' × ' + t.qty : ''} · ${t.free ? 'Free' : 'Paid'}</div>
        <div class="my-ticket-code">${t.code}</div>
      </div>
      <div class="my-ticket-qr" id="qr-${t.eventId}"></div>
    </div>`).join('');

  myTickets.forEach(t => buildQR('qr-' + t.eventId, t.code));
}

function updateMyTicketsCount() {
  const el = document.getElementById('myTicketsCount');
  if (el) el.textContent = myTickets.length || '';
  if (el) el.style.display = myTickets.length ? 'inline-flex' : 'none';
  renderMyTickets();
}

// ======================== TABS ========================
function switchEvTab(tab, el) {
  document.querySelectorAll('.ev-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.ev-tab-panel').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  else document.querySelector(`.ev-tab[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById('panel-' + tab)?.classList.add('active');
  if (tab === 'mytickets') renderMyTickets();
  else if (tab === 'organizer') renderOrganizerPanel();
}

// ======================== INVITE MODAL ========================
function openInvite(id) {
  const ev = MOCK_EVENTS.find(e => e.id === id);
  if (!ev) return;
  selectedInvitees = [];

  const users = typeof MOCK_USERS !== 'undefined' ? MOCK_USERS.slice(0, 16) : [];
  const usersHtml = users.map(u => `
    <div class="invite-user ${selectedInvitees.includes(u.id) ? 'selected' : ''}" id="inv-${u.id}" onclick="toggleInvitee('${u.id}',this)">
      <img src="${u.avatar}" alt="${u.fullName}">
      <span class="inv-name">${u.fullName.split(' ')[0]}</span>
      <span class="inv-check"><i class="fas fa-check"></i></span>
    </div>`).join('');

  document.getElementById('inviteContent').innerHTML = `
    <div class="invite-header">
      <h3>Invite Friends</h3>
      <p style="color:var(--text-muted);font-size:0.85rem">Invite your GeoHub friends to <strong>${ev.title}</strong></p>
    </div>
    <div class="invite-grid">${usersHtml}</div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-ghost" style="flex:1" onclick="closeEvModal('inviteModal')">Cancel</button>
      <button class="btn btn-primary" style="flex:1" onclick="sendInvites('${ev.title}')"><i class="fas fa-paper-plane"></i> Send Invites</button>
    </div>`;

  openEvModal('inviteModal');
}

function toggleInvitee(uid, el) {
  const idx = selectedInvitees.indexOf(uid);
  if (idx === -1) { selectedInvitees.push(uid); el.classList.add('selected'); }
  else { selectedInvitees.splice(idx, 1); el.classList.remove('selected'); }
}

function sendInvites(evTitle) {
  if (!selectedInvitees.length) {
    document.getElementById('inviteContent').querySelector('p').textContent = 'Select at least one friend';
    return;
  }
  document.getElementById('inviteContent').innerHTML = `
    <div style="text-align:center;padding:32px">
      <div style="font-size:2.5rem;margin-bottom:12px">🎉</div>
      <h3>Invites Sent!</h3>
      <p style="color:var(--text-muted);margin-bottom:20px">${selectedInvitees.length} friend${selectedInvitees.length > 1 ? 's' : ''} invited to <strong>${evTitle}</strong></p>
      <button class="btn btn-primary" onclick="closeEvModal('inviteModal')">Done</button>
    </div>`;
}

// ======================== SHARE MODAL ========================
function openShare(id) {
  const ev = MOCK_EVENTS.find(e => e.id === id);
  if (!ev) return;
  const url = `events.html?id=${ev.id}`;
  document.getElementById('shareContent').innerHTML = `
    <h3 style="margin-bottom:4px">Share Event</h3>
    <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:20px">${ev.title}</p>
    <div class="share-options">
      <button class="share-opt" onclick="copyLink('${url}',this)"><i class="fas fa-link"></i><span>Copy Link</span></button>
      <button class="share-opt" style="background:rgba(24,119,242,0.12);border-color:rgba(24,119,242,0.3)"><i class="fab fa-facebook" style="color:#1877f2"></i><span>Facebook</span></button>
      <button class="share-opt" style="background:rgba(29,161,242,0.12);border-color:rgba(29,161,242,0.3)"><i class="fab fa-twitter" style="color:#1da1f2"></i><span>Twitter</span></button>
      <button class="share-opt" style="background:rgba(37,211,102,0.12);border-color:rgba(37,211,102,0.3)"><i class="fab fa-whatsapp" style="color:#25d366"></i><span>WhatsApp</span></button>
    </div>`;
  openEvModal('shareModal');
}

function copyLink(url, btn) {
  navigator.clipboard.writeText(window.location.origin + '/' + url).catch(() => {});
  btn.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
  btn.style.borderColor = 'var(--green)';
  btn.style.color = 'var(--green)';
}

// ======================== ORGANIZER TOOLS ========================
const PROMO_OPTIONS = [
  { id: 'featured', name: 'Featured Event',      icon: 'fas fa-star',           desc: 'Pinned to top of discover feed for 48h',         price: 30, reachBoost: 3000, partBoost: 40  },
  { id: 'xpboost',  name: 'XP Boost ×2',         icon: 'fas fa-bolt',           desc: 'Double XP reward attracts more explorers',        price: 20, reachBoost: 1200, partBoost: 25  },
  { id: 'push',     name: 'Push Notification',    icon: 'fas fa-bell',           desc: 'Notify nearby GeoHub users instantly',            price: 15, reachBoost: 5000, partBoost: 60  },
  { id: 'creator',  name: 'Creator Promotion',    icon: 'fas fa-user-astronaut', desc: '3 matched creators post about your event',        price: 50, reachBoost: 8000, partBoost: 120 },
  { id: 'cityspot', name: 'Live City Highlight',  icon: 'fas fa-map-marker-alt', desc: 'Featured in the city live events map',            price: 25, reachBoost: 2500, partBoost: 35  },
];

let organizerEvents = window.safeStorage.get('gh_organizer_events', []);
let selectedPromoOptions = new Set();
let currentPromoEventId = null;

(function loadOrganizerEvents() {
  organizerEvents.forEach(ev => {
    if (!MOCK_EVENTS.find(e => e.id === ev.id)) MOCK_EVENTS.push(ev);
  });
})();

function getMockOrgStats(ev) {
  const seed = ev.id ? ev.id.charCodeAt(ev.id.length - 1) : 42;
  return {
    reservations: 5  + (seed * 3)  % 45,
    views:        200 + (seed * 47) % 1800,
    shares:       10  + (seed * 7)  % 90,
    conversion:   (2  + (seed * 13) % 13).toFixed(1),
    revenue:      ev.free ? 0 : (5 + (seed * 3) % 45) * ev.price,
  };
}

function renderOrganizerPanel() {
  const wrap = document.getElementById('organizerWrap');
  if (!wrap) return;
  const orgEvs = organizerEvents;

  const totRes    = orgEvs.reduce((s, e) => s + getMockOrgStats(e).reservations, 0);
  const totViews  = orgEvs.reduce((s, e) => s + getMockOrgStats(e).views, 0);
  const totShares = orgEvs.reduce((s, e) => s + getMockOrgStats(e).shares, 0);
  const totRev    = orgEvs.reduce((s, e) => s + getMockOrgStats(e).revenue, 0);
  const avgConv   = orgEvs.length ? (orgEvs.reduce((s, e) => s + parseFloat(getMockOrgStats(e).conversion), 0) / orgEvs.length).toFixed(1) + '%' : '—';
  const viewsStr  = totViews >= 1000 ? (totViews / 1000).toFixed(1) + 'k' : String(totViews);

  const statsHtml = `
    <div class="org-analytics-grid">
      <div class="org-stat-card"><div class="org-stat-icon" style="color:var(--green)"><i class="fas fa-ticket-alt"></i></div><div class="org-stat-val">${totRes}</div><div class="org-stat-lbl">Reservations</div></div>
      <div class="org-stat-card"><div class="org-stat-icon" style="color:var(--blue)"><i class="fas fa-eye"></i></div><div class="org-stat-val">${viewsStr}</div><div class="org-stat-lbl">Event Views</div></div>
      <div class="org-stat-card"><div class="org-stat-icon" style="color:var(--gold)"><i class="fas fa-share-alt"></i></div><div class="org-stat-val">${totShares}</div><div class="org-stat-lbl">Invite Shares</div></div>
      <div class="org-stat-card"><div class="org-stat-icon" style="color:#a78bfa"><i class="fas fa-chart-line"></i></div><div class="org-stat-val">${avgConv}</div><div class="org-stat-lbl">Avg Conversion</div></div>
      <div class="org-stat-card"><div class="org-stat-icon" style="color:var(--green)"><i class="fas fa-coins"></i></div><div class="org-stat-val">${totRev} GEL</div><div class="org-stat-lbl">Revenue Est.</div></div>
    </div>`;

  const evListHtml = orgEvs.length === 0
    ? `<div class="org-empty"><i class="fas fa-calendar-plus"></i><p>No events created yet</p><button class="btn btn-primary btn-sm" style="margin-top:4px" onclick="openCreateEvent()">Create your first event</button></div>`
    : orgEvs.map(ev => {
        const st = getMockOrgStats(ev);
        return `<div class="org-event-item">
          <img src="${ev.cover}" class="org-event-thumb" onerror="this.style.background='#172030';this.style.display='block'">
          <div class="org-event-info">
            <div class="org-event-title">${ev.title}</div>
            <div class="org-event-meta"><i class="fas fa-calendar"></i> ${ev.dateStr} · ${ev.time}</div>
            <div class="org-event-meta"><i class="fas fa-map-marker-alt"></i> ${ev.venue}, ${ev.city}</div>
            <div class="org-event-stats">
              <span><i class="fas fa-ticket-alt"></i> ${st.reservations} reservations</span>
              <span><i class="fas fa-eye"></i> ${st.views} views</span>
              <span class="org-revenue">${ev.free ? 'Free' : st.revenue + ' GEL'}</span>
            </div>
          </div>
          <div class="org-event-actions">
            <button class="btn btn-ghost btn-sm" onclick="openDetail('${ev.id}')"><i class="fas fa-eye"></i></button>
            <button class="btn btn-sm" style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:var(--gold);white-space:nowrap" onclick="openPromotion('${ev.id}')"><i class="fas fa-rocket"></i> Promote</button>
            <button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="deleteOrgEvent('${ev.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
      }).join('');

  wrap.innerHTML = `
    <div class="org-header">
      <div>
        <div class="org-title">Organizer Dashboard</div>
        <div class="org-sub">Manage your events and track performance</div>
      </div>
      <button class="btn btn-primary" onclick="openCreateEvent()"><i class="fas fa-plus"></i> Create Event</button>
    </div>
    ${statsHtml}
    <div class="org-section-title">Your Events (${orgEvs.length})</div>
    <div class="org-events-list">${evListHtml}</div>`;
}

// ======================== CREATE EVENT ========================
function openCreateEvent() {
  const dateInput = document.getElementById('ce-date');
  if (dateInput) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    dateInput.value = d.toISOString().split('T')[0];
    dateInput.min   = new Date().toISOString().split('T')[0];
  }
  const errEl = document.getElementById('ceError');
  if (errEl) errEl.classList.add('hidden');
  openEvModal('createEventModal');
}

function submitCreateEvent() {
  const get = id => document.getElementById(id)?.value.trim();
  const title       = get('ce-title');
  const category    = get('ce-category') || 'music';
  const city        = get('ce-city')     || 'Tbilisi';
  const date        = get('ce-date');
  const time        = get('ce-time')    || '19:00';
  const endTime     = get('ce-endtime') || '22:00';
  const priceRaw    = get('ce-price');
  const capacity    = parseInt(document.getElementById('ce-capacity')?.value) || 100;
  const xp          = parseInt(document.getElementById('ce-xp')?.value)       || 100;
  const organizer   = get('ce-organizer');
  const venue       = get('ce-venue');
  const cover       = get('ce-cover');
  const description = get('ce-description');

  const errEl = document.getElementById('ceError');
  if (!title || !organizer || !venue || !description || !date) {
    if (errEl) { errEl.textContent = 'Please fill in all required fields (*)'; errEl.classList.remove('hidden'); }
    return;
  }
  if (errEl) errEl.classList.add('hidden');

  const price = parseFloat(priceRaw) || 0;
  const free  = price === 0;

  const dateObj   = new Date(date);
  const days      = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr   = `${days[dateObj.getDay()]} ${dateObj.getDate()} ${months[dateObj.getMonth()]}`;

  const today    = new Date(); today.setHours(0,0,0,0);
  const evDate   = new Date(date); evDate.setHours(0,0,0,0);
  const diffDays = Math.round((evDate - today) / 86400000);
  const dateTag  = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : diffDays <= 7 ? 'weekend' : 'next-week';

  const defaultCovers = {
    music:     'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=700&q=80',
    nightlife: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=700&q=80',
    workshop:  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=700&q=80',
    hiking:    'https://images.unsplash.com/photo-1551632811-561732d1e306?w=700&q=80',
    sports:    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=700&q=80',
    art:       'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=700&q=80',
    food:      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=700&q=80',
  };

  const newEvent = {
    id: 'cust-' + Date.now(),
    title, category, dateTag, dateStr, time, endTime,
    venue, city, address: venue,
    cover: cover || defaultCovers[category] || defaultCovers.music,
    price, currency: 'GEL', free, xp, attending: 0, capacity,
    organizer, organizerAvatar: `https://i.pravatar.cc/40?img=${Math.floor(Math.random() * 70) + 1}`,
    tags: [category.charAt(0).toUpperCase() + category.slice(1)],
    description,
    schedule: [{ time, act: 'Event Begins' }, { time: endTime, act: 'Event Ends' }],
    friendsGoing: [], isOwn: true,
  };

  MOCK_EVENTS.push(newEvent);
  organizerEvents.push(newEvent);
  window.safeStorage.set('gh_organizer_events', organizerEvents);

  closeEvModal('createEventModal');
  applyFilters();
  showEvToast('🎉 Event published! It\'s now live in the feed.');
  ['ce-title','ce-venue','ce-cover','ce-description','ce-organizer'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

function deleteOrgEvent(id) {
  organizerEvents = organizerEvents.filter(e => e.id !== id);
  const idx = MOCK_EVENTS.findIndex(e => e.id === id);
  if (idx !== -1) MOCK_EVENTS.splice(idx, 1);
  window.safeStorage.set('gh_organizer_events', organizerEvents);
  applyFilters();
  renderOrganizerPanel();
  showEvToast('Event removed.');
}

// ======================== PROMOTION ========================
function openPromotion(id) {
  const ev = MOCK_EVENTS.find(e => e.id === id);
  if (!ev) return;
  currentPromoEventId = id;
  selectedPromoOptions.clear();

  const titleEl = document.getElementById('promoEventTitle');
  if (titleEl) titleEl.textContent = ev.title;

  const grid = document.getElementById('promoOptionsGrid');
  if (grid) {
    grid.innerHTML = PROMO_OPTIONS.map(opt => `
      <div class="promo-opt-card" id="pcard-${opt.id}" onclick="togglePromoOption('${opt.id}')">
        <div class="promo-opt-icon"><i class="${opt.icon}"></i></div>
        <div class="promo-opt-info">
          <div class="promo-opt-name">${opt.name}</div>
          <div class="promo-opt-desc">${opt.desc}</div>
        </div>
        <div class="promo-opt-price">${opt.price} GEL</div>
        <div class="promo-opt-check"><i class="fas fa-check"></i></div>
      </div>`).join('');
  }

  updatePromoPreview();
  openEvModal('promoModal');
}

function togglePromoOption(optId) {
  if (selectedPromoOptions.has(optId)) selectedPromoOptions.delete(optId);
  else selectedPromoOptions.add(optId);
  document.getElementById('pcard-' + optId)?.classList.toggle('selected', selectedPromoOptions.has(optId));
  updatePromoPreview();
}

function updatePromoPreview() {
  const selected   = PROMO_OPTIONS.filter(o => selectedPromoOptions.has(o.id));
  const totalCost  = selected.reduce((s, o) => s + o.price, 0);
  const totalReach = 500 + selected.reduce((s, o) => s + o.reachBoost, 0);
  const totalPart  = 10  + selected.reduce((s, o) => s + o.partBoost, 0);

  const costEl = document.getElementById('promoTotalCost');
  if (costEl) costEl.textContent = totalCost + ' GEL';

  const statsGrid = document.getElementById('promoStatsGrid');
  if (statsGrid) {
    const reachStr  = totalReach >= 1000 ? (totalReach / 1000).toFixed(1) + 'k' : totalReach;
    const xpStr     = selectedPromoOptions.has('xpboost') ? '×2' : '×1';
    const creatorsN = selectedPromoOptions.has('creator') ? '3' : '0';
    statsGrid.innerHTML = `
      <div class="promo-stat"><div class="promo-stat-val">${reachStr}</div><div class="promo-stat-lbl">Est. Reach</div></div>
      <div class="promo-stat"><div class="promo-stat-val">+${totalPart}</div><div class="promo-stat-lbl">Participants</div></div>
      <div class="promo-stat"><div class="promo-stat-val">${xpStr}</div><div class="promo-stat-lbl">XP Boost</div></div>
      <div class="promo-stat"><div class="promo-stat-val">${creatorsN}</div><div class="promo-stat-lbl">Creators</div></div>`;
  }

  const preview = document.getElementById('promoPreview');
  if (preview) preview.style.display = selected.length ? 'block' : 'none';
}

function submitPromotion() {
  if (!selectedPromoOptions.size) { showEvToast('Select at least one promotion option.'); return; }
  const selected  = PROMO_OPTIONS.filter(o => selectedPromoOptions.has(o.id));
  const totalCost = selected.reduce((s, o) => s + o.price, 0);
  const modal     = document.querySelector('#promoModal .cm-modal');
  if (!modal) return;
  modal.innerHTML = `
    <button class="cm-close" onclick="closeEvModal('promoModal')"><i class="fas fa-times"></i></button>
    <div style="text-align:center;padding:40px 24px">
      <div style="font-size:3rem;margin-bottom:14px">🚀</div>
      <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:8px">Promotion Activated!</h3>
      <p style="color:var(--text-muted);margin-bottom:20px">Your event is boosted with ${selected.length} package${selected.length > 1 ? 's' : ''}.</p>
      <div style="background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:16px;margin-bottom:20px;text-align:left">
        ${selected.map(o => `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border-subtle)"><i class="${o.icon}" style="color:var(--green);width:14px;text-align:center"></i><span style="flex:1;font-size:0.85rem">${o.name}</span><span style="font-size:0.82rem;color:var(--text-muted)">${o.price} GEL</span></div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding-top:10px;font-weight:800"><span>Total</span><span style="color:var(--green)">${totalCost} GEL</span></div>
      </div>
      <button class="btn btn-primary" onclick="closeEvModal('promoModal')">Done</button>
    </div>`;
}

// ======================== TOAST ========================
function showEvToast(msg, duration = 3200) {
  const toast = document.getElementById('evToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => {
  applyFilters();
  renderLiveStrip();
  updateMyTicketsCount();

  document.getElementById('evSearch')?.addEventListener('input', () => applyFilters());
  document.getElementById('evCity')?.addEventListener('change', () => applyFilters());

  const initialQty = document.getElementById('qtyDisplay');
  if (!initialQty) currentQty = 1;
});
