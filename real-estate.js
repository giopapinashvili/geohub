/* ================================================================
   GeoHub — Real Estate / Apartments System
   ================================================================ */

// ======================== MOCK DATA ========================
const RE_AGENTS = [];

const MOCK_LISTINGS = [];

// ======================== STATE ========================
let reFilterState = { type: 'all', city: 'all', district: 'all', priceMin: '', priceMax: '', rooms: 'all', verified: false, nearMetro: false, petFriendly: false, sort: 'featured' };
let savedListings = window.safeStorage.get('gh_saved_listings', []);
let activeDetailId = null;
let galleryIdx = 0;

// ======================== HELPERS ========================
function getAgent(id) { return RE_AGENTS.find(a => a.id === id) || RE_AGENTS[0]; }
function fmtPrice(ls) {
  const n = ls.price >= 1000 ? (ls.price / 1000).toFixed(ls.price >= 10000 ? 0 : 1) + 'k' : ls.price;
  return n + ' ' + ls.currency + ls.period;
}
function isSaved(id) { return savedListings.includes(id); }
function toggleSave(id, btn) {
  const idx = savedListings.indexOf(id);
  if (idx === -1) { savedListings.push(id); if (btn) { btn.innerHTML = '<i class="fas fa-heart"></i>'; btn.classList.add('saved'); } }
  else            { savedListings.splice(idx, 1); if (btn) { btn.innerHTML = '<i class="far fa-heart"></i>'; btn.classList.remove('saved'); } }
  window.safeStorage.set('gh_saved_listings', savedListings);
  if (document.getElementById('panel-saved')?.classList.contains('active')) renderSaved();
}

// ======================== FILTERS ========================
function applyReFilters() {
  let list = [...MOCK_LISTINGS];
  const f = reFilterState;
  if (f.type !== 'all') list = list.filter(l => l.type === f.type);
  if (f.city !== 'all') list = list.filter(l => l.city === f.city);
  if (f.district !== 'all') list = list.filter(l => l.district === f.district);
  if (f.priceMin) list = list.filter(l => l.price >= Number(f.priceMin));
  if (f.priceMax) list = list.filter(l => l.price <= Number(f.priceMax));
  if (f.rooms !== 'all') {
    if (f.rooms === '4+') list = list.filter(l => l.rooms >= 4);
    else list = list.filter(l => l.rooms === Number(f.rooms));
  }
  if (f.verified)   list = list.filter(l => l.verified);
  if (f.nearMetro)  list = list.filter(l => l.nearMetro);
  if (f.petFriendly)list = list.filter(l => l.petFriendly);
  if (f.q) { const q = f.q.toLowerCase(); list = list.filter(l => l.title.toLowerCase().includes(q) || l.district.toLowerCase().includes(q) || l.city.toLowerCase().includes(q)); }

  if (f.sort === 'featured') list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  else if (f.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (f.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  else if (f.sort === 'newest') list.sort((a, b) => b.id.localeCompare(a.id));

  const grid = document.getElementById('reGrid');
  const empty = document.getElementById('reEmpty');
  const countEl = document.getElementById('reCount');
  if (countEl) countEl.textContent = list.length + ' listing' + (list.length !== 1 ? 's' : '');
  if (!list.length) { grid.innerHTML = ''; if (empty) empty.style.display = 'flex'; return; }
  if (empty) empty.style.display = 'none';
  grid.innerHTML = list.map(renderRealEstateCard).join('');
}

// ======================== CARD ========================
function renderRealEstateCard(ls) {
  const ag = getAgent(ls.agentId);
  const saved = isSaved(ls.id);
  return `
    <div class="re-card animate-fade-up" onclick="openDetail('${ls.id}')">
      <div class="re-card-img">
        <img src="${ls.images[0]}" alt="${ls.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80'">
        <div class="re-card-type ${ls.type === 'rent' ? 'type-rent' : 'type-sale'}">${ls.type === 'rent' ? 'For Rent' : 'For Sale'}</div>
        ${ls.featured ? '<div class="re-card-featured"><i class="fas fa-star"></i> Featured</div>' : ''}
        <button class="re-card-save ${saved ? 'saved' : ''}" onclick="event.stopPropagation();toggleSave('${ls.id}',this)">
          <i class="${saved ? 'fas' : 'far'} fa-heart"></i>
        </button>
        ${ls.images.length > 1 ? `<div class="re-card-imgs-count"><i class="fas fa-images"></i> ${ls.images.length}</div>` : ''}
      </div>
      <div class="re-card-body">
        <div class="re-card-price">${fmtPrice(ls)}</div>
        <div class="re-card-title">${ls.title}</div>
        <div class="re-card-loc"><i class="fas fa-map-marker-alt"></i> ${ls.district}, ${ls.city}</div>
        <div class="re-card-specs">
          <span><i class="fas fa-door-open"></i> ${ls.rooms} ${ls.rooms === 1 ? 'room' : 'rooms'}</span>
          <span><i class="fas fa-vector-square"></i> ${ls.area} m²</span>
          <span><i class="fas fa-building"></i> Floor ${ls.floor}/${ls.floors}</span>
        </div>
        <div class="re-card-tags">
          ${ls.verified  ? '<span class="re-tag re-tag-green"><i class="fas fa-check-circle"></i> Verified</span>' : ''}
          ${ls.nearMetro ? '<span class="re-tag re-tag-blue"><i class="fas fa-subway"></i> Metro</span>' : ''}
          ${ls.petFriendly ? '<span class="re-tag re-tag-gold"><i class="fas fa-paw"></i> Pets OK</span>' : ''}
        </div>
        <div class="re-card-agent" onclick="event.stopPropagation()">
          <img src="${ag.avatar}" alt="${ag.name}" class="re-agent-av">
          <div class="re-agent-info">
            <div class="re-agent-name">${ag.name} ${ag.verified ? '<i class="fas fa-check-circle" style="color:#3b82f6;font-size:0.7rem"></i>' : ''}</div>
            <div class="re-agent-trust"><i class="fas fa-shield-alt" style="color:#10b981"></i> ${ag.trustScore}</div>
          </div>
          <button class="re-msg-btn" onclick="event.stopPropagation();window.location.href='messages.html?user='+encodeURIComponent('${ag.username}')">
            <i class="fas fa-comment"></i>
          </button>
        </div>
      </div>
    </div>`;
}

// ======================== DETAIL MODAL ========================
function openDetail(id) {
  const ls = MOCK_LISTINGS.find(l => l.id === id);
  if (!ls) return;
  activeDetailId = id;
  galleryIdx = 0;
  const ag = getAgent(ls.agentId);
  const saved = isSaved(id);

  const similar = MOCK_LISTINGS.filter(l => l.id !== id && (l.city === ls.city || l.type === ls.type)).slice(0, 3);

  document.getElementById('detailContent').innerHTML = `
    <div class="detail-gallery">
      <div class="detail-gallery-main">
        <img id="galleryMain" src="${ls.images[0]}" alt="${ls.title}">
        ${ls.images.length > 1 ? `
          <button class="gal-nav gal-prev" onclick="changeGallery(-1)"><i class="fas fa-chevron-left"></i></button>
          <button class="gal-nav gal-next" onclick="changeGallery(1)"><i class="fas fa-chevron-right"></i></button>
          <div class="gal-counter" id="galCounter">1 / ${ls.images.length}</div>` : ''}
      </div>
      ${ls.images.length > 1 ? `<div class="detail-gallery-thumbs">${ls.images.map((img, i) =>
        `<img src="${img}" class="gal-thumb ${i === 0 ? 'active' : ''}" onclick="setGallery(${i})" alt="">`).join('')}</div>` : ''}
    </div>

    <div class="detail-body">
      <div class="detail-main">
        <div class="detail-top-row">
          <div>
            <div class="detail-price">${fmtPrice(ls)}</div>
            <div class="detail-title">${ls.title}</div>
            <div class="detail-loc"><i class="fas fa-map-marker-alt"></i> ${ls.address}</div>
          </div>
          <div class="detail-badges">
            <span class="re-type-badge ${ls.type === 'rent' ? 'type-rent' : 'type-sale'}">${ls.type === 'rent' ? 'For Rent' : 'For Sale'}</span>
            ${ls.verified ? '<span class="re-type-badge type-verified"><i class="fas fa-check-circle"></i> Verified</span>' : ''}
          </div>
        </div>

        <div class="detail-specs-row">
          <div class="detail-spec"><i class="fas fa-door-open"></i><span>${ls.rooms}</span><small>Rooms</small></div>
          <div class="detail-spec"><i class="fas fa-vector-square"></i><span>${ls.area}</span><small>m²</small></div>
          <div class="detail-spec"><i class="fas fa-building"></i><span>${ls.floor}/${ls.floors}</span><small>Floor</small></div>
          <div class="detail-spec"><i class="fas fa-map-marker-alt"></i><span>${ls.district}</span><small>District</small></div>
        </div>

        <div class="detail-section-title">Description</div>
        <p class="detail-desc">${ls.description}</p>

        <div class="detail-section-title">Amenities</div>
        <div class="detail-amenities">
          ${ls.amenities.map(a => `<span class="amenity-pill"><i class="fas fa-check"></i> ${a}</span>`).join('')}
        </div>

        <div class="detail-section-title">Location</div>
        <div class="detail-map-mock">
          <div class="map-mock-inner">
            <i class="fas fa-map-marker-alt" style="color:#10b981;font-size:1.8rem"></i>
            <div style="font-weight:700;margin-top:8px">${ls.address}</div>
            <div style="color:var(--text-muted);font-size:0.8rem">${ls.district}, ${ls.city}</div>
          </div>
        </div>

        <div class="detail-section-title">Trust Indicators</div>
        <div class="detail-trust-row">
          ${ls.verified ? '<div class="trust-ind"><i class="fas fa-check-circle" style="color:#3b82f6"></i> Verified Listing</div>' : ''}
          <div class="trust-ind"><i class="fas fa-shield-alt" style="color:#10b981"></i> Agent Trust Score ${ag.trustScore}</div>
          <div class="trust-ind"><i class="fas fa-comments" style="color:#a78bfa"></i> ${ag.responseRate}% Response Rate</div>
        </div>

        ${similar.length ? `
        <div class="detail-section-title">Similar Listings</div>
        <div class="detail-similar">${similar.map(s => `
          <div class="sim-card" onclick="openDetail('${s.id}')">
            <img src="${s.images[0]}" alt="${s.title}">
            <div class="sim-info">
              <div class="sim-title">${s.title}</div>
              <div class="sim-price">${fmtPrice(s)}</div>
            </div>
          </div>`).join('')}</div>` : ''}
      </div>

      <div class="detail-sidebar">
        <div class="detail-agent-card">
          <img src="${ag.avatar}" class="detail-agent-av" alt="${ag.name}">
          <div class="detail-agent-name">${ag.name} ${ag.verified ? '<i class="fas fa-check-circle" style="color:#3b82f6;font-size:0.8rem"></i>' : ''}</div>
          <div class="detail-agent-spec">${ag.speciality}</div>
          <div class="detail-agent-stats">
            <div><strong>${ag.listings}</strong><small>Listings</small></div>
            <div><strong>${ag.responseRate}%</strong><small>Response</small></div>
            <div><strong>${ag.trustScore}</strong><small>Trust</small></div>
          </div>
          <button class="re-btn-primary" onclick="window.location.href='messages.html?user='+encodeURIComponent('${ag.username}')">
            <i class="fas fa-comment"></i> Message Agent
          </button>
          <button class="re-btn-secondary" onclick="openSchedule('${ls.id}')">
            <i class="fas fa-calendar-check"></i> Schedule Visit
          </button>
        </div>

        <div class="detail-actions">
          <button class="detail-action-btn ${saved ? 'saved' : ''}" id="detailSaveBtn" onclick="toggleSave('${ls.id}',this);this.innerHTML=isSaved('${ls.id}')?'<i class=\\'fas fa-heart\\'></i> Saved':'<i class=\\'far fa-heart\\'></i> Save'">
            <i class="${saved ? 'fas' : 'far'} fa-heart"></i> ${saved ? 'Saved' : 'Save'}
          </button>
          <button class="detail-action-btn" onclick="openShareModal('${ls.id}')">
            <i class="fas fa-share-alt"></i> Share
          </button>
          <button class="detail-action-btn" onclick="closeReModal('detailModal');window.location.href='trust.html?report=scam_biz&target='+encodeURIComponent('${ls.title}')">
            <i class="fas fa-flag"></i> Report
          </button>
        </div>
      </div>
    </div>`;

  openReModal('detailModal');
}

function changeGallery(dir) {
  const ls = MOCK_LISTINGS.find(l => l.id === activeDetailId);
  if (!ls) return;
  galleryIdx = (galleryIdx + dir + ls.images.length) % ls.images.length;
  setGallery(galleryIdx);
}
function setGallery(idx) {
  const ls = MOCK_LISTINGS.find(l => l.id === activeDetailId);
  if (!ls) return;
  galleryIdx = idx;
  const main = document.getElementById('galleryMain');
  if (main) main.src = ls.images[idx];
  document.querySelectorAll('.gal-thumb').forEach((t, i) => t.classList.toggle('active', i === idx));
  const ctr = document.getElementById('galCounter');
  if (ctr) ctr.textContent = (idx + 1) + ' / ' + ls.images.length;
}

// ======================== SHARE MODAL ========================
function openShareModal(id) {
  const ls = MOCK_LISTINGS.find(l => l.id === id);
  if (!ls) return;
  document.getElementById('shareUrl').value = window.location.href.split('?')[0] + '?listing=' + id;
  openReModal('shareModal');
}
function copyShareUrl() {
  const inp = document.getElementById('shareUrl');
  if (!inp) return;
  inp.select();
  document.execCommand('copy');
  const btn = document.getElementById('copyShareBtn');
  if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 1800); }
}

// ======================== SCHEDULE VISIT MODAL ========================
function openSchedule(listingId) {
  closeReModal('detailModal');
  document.getElementById('scheduleWrap')?.classList.remove('hidden');
  document.getElementById('scheduleSuccess')?.classList.add('hidden');
  document.getElementById('schedListingId').value = listingId || activeDetailId || '';
  // Set min date to today
  const dateInput = document.getElementById('schedDate');
  if (dateInput) { const d = new Date(); dateInput.min = d.toISOString().split('T')[0]; }
  openReModal('scheduleModal');
}
function submitSchedule() {
  const date = document.getElementById('schedDate')?.value;
  const time = document.getElementById('schedTime')?.value;
  const msg  = document.getElementById('schedMsg')?.value?.trim();
  const errEl = document.getElementById('schedError');
  if (!date || !time) { if (errEl) { errEl.textContent = 'Please select a date and time.'; errEl.classList.remove('hidden'); } return; }
  if (errEl) errEl.classList.add('hidden');
  document.getElementById('scheduleWrap')?.classList.add('hidden');
  document.getElementById('scheduleSuccess')?.classList.remove('hidden');
}

// ======================== MODAL HELPERS ========================
function openReModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = 'flex';
  requestAnimationFrame(() => m.classList.add('open'));
}
function closeReModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('open');
  setTimeout(() => { m.style.display = 'none'; }, 280);
}

// ======================== TABS ========================
function switchReTab(tab, el) {
  document.querySelectorAll('.re-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.re-tab-panel').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('panel-' + tab)?.classList.add('active');
  if (tab === 'saved') renderSaved();
  if (tab === 'agents') renderAgents();
}

// ======================== SAVED PANEL ========================
function renderSaved() {
  const el = document.getElementById('savedGrid');
  if (!el) return;
  const list = MOCK_LISTINGS.filter(l => savedListings.includes(l.id));
  if (!list.length) {
    el.innerHTML = '<div class="re-empty" style="display:flex"><i class="far fa-heart"></i><p>No saved listings yet.<br>Tap the heart icon on any listing.</p></div>';
    return;
  }
  el.innerHTML = list.map(renderRealEstateCard).join('');
}

// ======================== AGENTS PANEL ========================
function renderAgents() {
  const el = document.getElementById('agentsGrid');
  if (!el) return;
  el.innerHTML = RE_AGENTS.map(ag => `
    <div class="agent-card animate-fade-up">
      <div class="agent-card-top">
        <img src="${ag.avatar}" class="agent-av" alt="${ag.name}">
        <div class="agent-online"></div>
      </div>
      <div class="agent-name">${ag.name} ${ag.verified ? '<i class="fas fa-check-circle" style="color:#3b82f6;font-size:0.8rem"></i>' : ''}</div>
      <div class="agent-spec">${ag.speciality}</div>
      <div class="agent-city"><i class="fas fa-map-marker-alt" style="color:#10b981"></i> ${ag.city}</div>
      <div class="agent-stats">
        <div class="agent-stat"><strong>${ag.listings}</strong><span>Listings</span></div>
        <div class="agent-stat"><strong>${ag.responseRate}%</strong><span>Response</span></div>
        <div class="agent-stat"><strong>${ag.trustScore}</strong><span>Trust</span></div>
      </div>
      <div class="agent-trust-bar">
        <div class="agent-trust-fill" style="width:${Math.round(ag.trustScore/10)}%"></div>
      </div>
      <div class="agent-actions">
        <button class="re-btn-primary" onclick="window.location.href='messages.html?user='+encodeURIComponent('${ag.username}')">
          <i class="fas fa-comment"></i> Message
        </button>
        <button class="re-btn-secondary" onclick="window.location.href='trust.html?report=bad_behavior&target='+encodeURIComponent('${ag.name}')">
          <i class="fas fa-flag"></i>
        </button>
      </div>
    </div>`).join('');
}

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => {
  applyReFilters();
  renderAgents();

  // Search input
  const qi = document.getElementById('reSearchInput');
  if (qi) qi.addEventListener('input', () => { reFilterState.q = qi.value; applyReFilters(); });

  // Sort select
  const sortSel = document.getElementById('reSortSelect');
  if (sortSel) sortSel.addEventListener('change', () => { reFilterState.sort = sortSel.value; applyReFilters(); });

  // Filter: type buttons
  document.querySelectorAll('.re-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.re-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      reFilterState.type = btn.dataset.type;
      applyReFilters();
    });
  });

  // Filter: city select
  const citySel = document.getElementById('reCityFilter');
  if (citySel) citySel.addEventListener('change', () => { reFilterState.city = citySel.value; applyReFilters(); });

  // Filter: rooms
  document.querySelectorAll('.re-room-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.re-room-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      reFilterState.rooms = btn.dataset.rooms;
      applyReFilters();
    });
  });

  // Filter: price range
  const priceMin = document.getElementById('rePriceMin');
  const priceMax = document.getElementById('rePriceMax');
  if (priceMin) priceMin.addEventListener('input', () => { reFilterState.priceMin = priceMin.value; applyReFilters(); });
  if (priceMax) priceMax.addEventListener('input', () => { reFilterState.priceMax = priceMax.value; applyReFilters(); });

  // Filter: checkboxes
  ['reVerified','reNearMetro','rePetFriendly'].forEach(chkId => {
    const el = document.getElementById(chkId);
    if (!el) return;
    el.addEventListener('change', () => {
      if (chkId === 'reVerified')   reFilterState.verified    = el.checked;
      if (chkId === 'reNearMetro')  reFilterState.nearMetro   = el.checked;
      if (chkId === 'rePetFriendly')reFilterState.petFriendly = el.checked;
      applyReFilters();
    });
  });

  // ESC closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') ['detailModal','scheduleModal','shareModal'].forEach(closeReModal);
  });

  // Backdrop click
  ['detailModal','scheduleModal','shareModal'].forEach(id => {
    const m = document.getElementById(id);
    if (m) m.addEventListener('click', e => { if (e.target === m) closeReModal(id); });
  });

  // URL param: open listing directly
  const url = new URLSearchParams(window.location.search);
  if (url.get('listing')) openDetail(url.get('listing'));
});
