/* ================================================================
   GeoHub — Marketplace / Services System
   ================================================================ */

// ======================== DATA ========================
const SV_CATEGORIES = ['All','Home Repair','Cleaning','Beauty','Photography','Design','Web Development','Fitness','Tour Guides','Drivers','Tutors','Event Services','Moving'];

const MOCK_PROVIDERS = [];

// ======================== STATE ========================
let svState = { category:'All', city:'all', priceMin:'', priceMax:'', rating:'all', verified:false, availableToday:false, onlineService:false, homeVisit:false, highTrust:false, q:'', sort:'featured' };
let savedProviders = window.safeStorage.get('gh_saved_providers', []);
let myRequests     = window.safeStorage.get('gh_my_requests',     []);
let activeProviderId = null;

// ======================== HELPERS ========================
function fmtK(n) { return n >= 1000 ? (n/1000).toFixed(1)+'k' : n; }
function svStars(r) {
  const full = Math.floor(r), half = r % 1 >= 0.5;
  return '<span class="sv-stars">'+'<i class="fas fa-star"></i>'.repeat(full)+(half?'<i class="fas fa-star-half-alt"></i>':'')+'<i class="far fa-star"></i>'.repeat(5-full-(half?1:0))+'</span>';
}
function catIcon(cat) {
  const m = { 'Home Repair':'fas fa-tools','Cleaning':'fas fa-broom','Beauty':'fas fa-spa','Photography':'fas fa-camera','Design':'fas fa-pen-nib','Web Development':'fas fa-code','Fitness':'fas fa-dumbbell','Tour Guides':'fas fa-map','Drivers':'fas fa-car','Tutors':'fas fa-book','Event Services':'fas fa-glass-cheers','Moving':'fas fa-truck' };
  return m[cat] || 'fas fa-briefcase';
}
function catColor(cat) {
  const m = { 'Home Repair':'#f97316','Cleaning':'#3b82f6','Beauty':'#ec4899','Photography':'#a78bfa','Design':'#f59e0b','Web Development':'#10b981','Fitness':'#22c55e','Tour Guides':'#14b8a6','Drivers':'#64748b','Tutors':'#6366f1','Event Services':'#e879f9','Moving':'#fb923c' };
  return m[cat] || '#64748b';
}

// ======================== FILTERS ========================
function applySvFilters() {
  const f = svState;
  let list = [...MOCK_PROVIDERS];
  if (f.q) { const q = f.q.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q) || p.profession.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)); }
  if (f.category !== 'All') list = list.filter(p => p.category === f.category);
  if (f.city !== 'all') list = list.filter(p => p.city === f.city);
  if (f.priceMin) list = list.filter(p => p.priceFrom >= Number(f.priceMin));
  if (f.priceMax) list = list.filter(p => p.priceFrom <= Number(f.priceMax));
  if (f.rating !== 'all') list = list.filter(p => p.rating >= Number(f.rating));
  if (f.verified) list = list.filter(p => p.verified);
  if (f.availableToday) list = list.filter(p => p.availableToday);
  if (f.onlineService) list = list.filter(p => p.online);
  if (f.homeVisit) list = list.filter(p => p.homeVisit);
  if (f.highTrust) list = list.filter(p => p.trustScore >= 880);
  if (f.sort === 'featured') list.sort((a,b) => (b.featured?1:0)-(a.featured?1:0));
  else if (f.sort === 'rating') list.sort((a,b) => b.rating-a.rating);
  else if (f.sort === 'jobs') list.sort((a,b) => b.completedJobs-a.completedJobs);
  else if (f.sort === 'price-asc') list.sort((a,b) => a.priceFrom-b.priceFrom);
  else if (f.sort === 'trust') list.sort((a,b) => b.trustScore-a.trustScore);
  const grid = document.getElementById('svGrid');
  const empty = document.getElementById('svEmpty');
  const countEl = document.getElementById('svCount');
  if (countEl) countEl.textContent = list.length + ' provider' + (list.length!==1?'s':'');
  if (!list.length) { if (grid) grid.innerHTML=''; if (empty) empty.style.display='flex'; return; }
  if (empty) empty.style.display='none';
  if (grid) grid.innerHTML = list.map(renderProviderCard).join('');
}

// ======================== PROVIDER CARD ========================
function renderProviderCard(pv) {
  const saved = savedProviders.includes(pv.id);
  const col = catColor(pv.category);
  const ico = catIcon(pv.category);
  return `
    <div class="sv-card animate-fade-up">
      <div class="sv-card-top" style="background:linear-gradient(135deg,${col}18,${col}08)">
        <img src="${pv.avatar}" class="sv-avatar" alt="${pv.name}" onerror="this.src='https://i.pravatar.cc/100?img=1'">
        <div class="sv-cat-icon" style="background:${col}18;color:${col}"><i class="${ico}"></i></div>
        <button class="sv-save-btn ${saved?'saved':''}" onclick="event.stopPropagation();toggleSavePv('${pv.id}',this)"><i class="${saved?'fas':'far'} fa-heart"></i></button>
        ${pv.featured?'<div class="sv-featured"><i class="fas fa-star"></i></div>':''}
        ${pv.availableToday?'<div class="sv-available">Available Today</div>':''}
      </div>
      <div class="sv-card-body">
        <div class="sv-name">${pv.name} ${pv.verified?'<i class="fas fa-check-circle" style="color:#3b82f6;font-size:0.75rem"></i>':''}</div>
        <div class="sv-profession" style="color:${col}">${pv.profession}</div>
        <div class="sv-loc"><i class="fas fa-map-marker-alt"></i>${pv.district}, ${pv.city}${pv.online?' · <span style="color:#10b981"><i class="fas fa-wifi"></i> Online</span>':''}</div>
        <div class="sv-rating-row">${svStars(pv.rating)} <strong>${pv.rating}</strong> <span>(${pv.reviewCount})</span></div>
        <div class="sv-stats-row">
          <span><i class="fas fa-briefcase"></i> ${fmtK(pv.completedJobs)} jobs</span>
          <span><i class="fas fa-shield-alt" style="color:#10b981"></i> ${pv.trustScore}</span>
          <span><i class="fas fa-reply"></i> ${pv.responseRate}%</span>
        </div>
        <div class="sv-badges">${pv.badges.slice(0,2).map(b=>`<span class="sv-badge" style="--bc:${col}">${b}</span>`).join('')}</div>
        <div class="sv-price">From <strong>${pv.priceFrom} ${pv.currency}</strong><span>${pv.priceUnit}</span></div>
        <div class="sv-actions">
          <button class="sv-btn-primary" onclick="openSvDetail('${pv.id}')"><i class="fas fa-eye"></i> View</button>
          <button class="sv-btn-icon" title="Message" onclick="window.location.href='messages.html?user='+encodeURIComponent('${pv.username}')"><i class="fas fa-comment"></i></button>
          <button class="sv-btn-request" onclick="openRequest('${pv.id}')"><i class="fas fa-paper-plane"></i> Request</button>
        </div>
      </div>
    </div>`;
}

// ======================== DETAIL MODAL ========================
function openSvDetail(id) {
  const pv = MOCK_PROVIDERS.find(p => p.id === id);
  if (!pv) return;
  activeProviderId = id;
  const saved = savedProviders.includes(id);
  const col = catColor(pv.category);

  document.getElementById('svDetailContent').innerHTML = `
    <div class="svd-hero" style="background:linear-gradient(135deg,${col}15,${col}06)">
      <img src="${pv.avatar}" class="svd-avatar" alt="${pv.name}" onerror="this.src='https://i.pravatar.cc/100?img=1'">
      <div class="svd-hero-info">
        <div class="svd-name">${pv.name} ${pv.verified?'<span class="svd-verified"><i class="fas fa-check-circle"></i> Verified</span>':''}</div>
        <div class="svd-prof" style="color:${col}"><i class="${catIcon(pv.category)}"></i> ${pv.profession}</div>
        <div class="svd-loc"><i class="fas fa-map-marker-alt" style="color:${col}"></i> ${pv.district}, ${pv.city}${pv.online?' · <span style="color:#10b981"><i class="fas fa-wifi"></i> Online</span>':''}${pv.homeVisit?' · <span style="color:#a78bfa"><i class="fas fa-home"></i> Home Visit</span>':''}</div>
        <div class="svd-rating-row">${svStars(pv.rating)} <strong>${pv.rating}</strong> <span>(${pv.reviewCount} reviews)</span> <span class="svd-trust"><i class="fas fa-shield-alt"></i> ${pv.trustScore} Trust</span></div>
        <div class="svd-stats">
          <div class="svd-stat"><strong>${fmtK(pv.completedJobs)}</strong><span>Jobs Done</span></div>
          <div class="svd-stat"><strong>${pv.responseRate}%</strong><span>Response Rate</span></div>
          <div class="svd-stat"><strong>${pv.trustScore}</strong><span>Trust Score</span></div>
        </div>
        <div class="svd-badges">${pv.badges.map(b=>`<span class="sv-badge" style="--bc:${col}">${b}</span>`).join('')}</div>
      </div>
      <div class="svd-price-box">
        <div class="svd-price-num">${pv.priceFrom} ${pv.currency}</div>
        <div class="svd-price-lbl">${pv.priceUnit}</div>
        <button class="sv-btn-primary" style="width:100%;margin-top:12px;padding:11px" onclick="closeSvModal('svDetailModal');openRequest('${pv.id}')"><i class="fas fa-paper-plane"></i> Request Service</button>
        <button class="sv-btn-secondary" style="width:100%;margin-top:8px" onclick="window.location.href='messages.html?user='+encodeURIComponent('${pv.username}')"><i class="fas fa-comment"></i> Message</button>
        <button class="svd-save-btn ${saved?'saved':''}" id="svdSaveBtn" onclick="toggleSavePv('${pv.id}',this)"><i class="${saved?'fas':'far'} fa-heart"></i> ${saved?'Saved':'Save'}</button>
        <button class="svd-report-btn" onclick="closeSvModal('svDetailModal');window.location.href='trust.html?report=bad_behavior&target='+encodeURIComponent('${pv.name}')"><i class="fas fa-flag"></i> Report</button>
      </div>
    </div>

    <div class="svd-body">
      <div class="svd-main">
        <div class="svd-section-title">About</div>
        <p class="svd-bio">${pv.bio}</p>

        <div class="svd-section-title">Services & Pricing</div>
        <div class="svd-services">${pv.services.map(s=>`
          <div class="svd-service-row">
            <span class="svd-svc-name"><i class="fas fa-check" style="color:${col}"></i>${s.name}</span>
            <span class="svd-svc-price">${s.price}</span>
          </div>`).join('')}</div>

        <div class="svd-section-title">Portfolio</div>
        <div class="svd-portfolio">${pv.portfolio.map(img=>`<img src="${img}" alt="Portfolio" loading="lazy" onerror="this.style.display='none'">`).join('')}</div>

        <div class="svd-section-title">Availability</div>
        <div class="svd-avail">${pv.availability.map(a=>`<div class="svd-avail-row"><i class="fas fa-clock" style="color:${col}"></i>${a}</div>`).join('')}</div>

        <div class="svd-section-title">Trust Indicators</div>
        <div class="svd-trust-row">
          <div class="trust-ind"><i class="fas fa-shield-alt" style="color:#10b981"></i> Trust ${pv.trustScore}</div>
          <div class="trust-ind"><i class="fas fa-briefcase" style="color:${col}"></i> ${fmtK(pv.completedJobs)} completed</div>
          <div class="trust-ind"><i class="fas fa-reply" style="color:#a78bfa"></i> ${pv.responseRate}% response</div>
          ${pv.verified?'<div class="trust-ind"><i class="fas fa-check-circle" style="color:#3b82f6"></i> GeoHub Verified</div>':''}
          ${pv.homeVisit?'<div class="trust-ind"><i class="fas fa-home" style="color:#a78bfa"></i> Home Visits</div>':''}
        </div>

        <div class="svd-section-title">Reviews</div>
        <div class="svd-reviews">${pv.reviews.map(r=>`
          <div class="svd-review">
            <div class="svd-review-header"><strong>${r.name}</strong>${svStars(r.rating)}<span>${r.date}</span></div>
            <p>${r.text}</p>
          </div>`).join('')}</div>
      </div>
    </div>`;

  openSvModal('svDetailModal');
}

// ======================== REQUEST MODAL ========================
function openRequest(providerId) {
  document.getElementById('reqWrap')?.classList.remove('hidden');
  document.getElementById('reqSuccess')?.classList.add('hidden');
  document.getElementById('reqProviderId').value = providerId || activeProviderId || '';
  const pv = MOCK_PROVIDERS.find(p => p.id === (providerId || activeProviderId));
  if (pv) {
    const nameEl = document.getElementById('reqProviderName');
    const avEl   = document.getElementById('reqProviderAv');
    const profEl = document.getElementById('reqProviderProf');
    if (nameEl) nameEl.textContent = pv.name;
    if (avEl)   avEl.src = pv.avatar;
    if (profEl) profEl.textContent = pv.profession;
    const typeSel = document.getElementById('reqServiceType');
    if (typeSel) { typeSel.innerHTML = pv.services.map(s=>`<option>${s.name}</option>`).join(''); }
  }
  const dateEl = document.getElementById('reqDate');
  if (dateEl) dateEl.min = new Date().toISOString().split('T')[0];
  openSvModal('requestModal');
}

function submitRequest() {
  const date = document.getElementById('reqDate')?.value;
  const time = document.getElementById('reqTime')?.value;
  const desc = document.getElementById('reqDesc')?.value?.trim();
  const errEl = document.getElementById('reqError');
  if (!date || !time) { if (errEl) { errEl.textContent='Please select a date and time.'; errEl.classList.remove('hidden'); } return; }
  if (!desc) { if (errEl) { errEl.textContent='Please describe what you need.'; errEl.classList.remove('hidden'); } return; }
  if (errEl) errEl.classList.add('hidden');
  const pvId = document.getElementById('reqProviderId').value;
  const pv = MOCK_PROVIDERS.find(p => p.id === pvId);
  myRequests.unshift({
    id:'rq_'+Date.now(), providerId:pvId,
    providerName: pv?.name || '', profession: pv?.profession || '',
    serviceType: document.getElementById('reqServiceType')?.value || '',
    date, time, location: document.getElementById('reqLocation')?.value || '',
    budget: document.getElementById('reqBudget')?.value || '',
    description: desc, status:'pending', ts:Date.now(),
  });
  window.safeStorage.set('gh_my_requests', myRequests);
  document.getElementById('reqWrap')?.classList.add('hidden');
  document.getElementById('reqSuccess')?.classList.remove('hidden');
  renderSvDashboard();
}

// ======================== SAVE ========================
function toggleSavePv(id, btn) {
  const idx = savedProviders.indexOf(id);
  const isSaved = idx === -1;
  if (isSaved) savedProviders.push(id);
  else savedProviders.splice(idx, 1);
  window.safeStorage.set('gh_saved_providers', savedProviders);
  if (!btn) return;
  const isSave = btn.classList.contains('svd-save-btn');
  if (isSave) { btn.innerHTML = `<i class="${isSaved?'fas':'far'} fa-heart"></i> ${isSaved?'Saved':'Save'}`; btn.classList.toggle('saved', isSaved); }
  else { btn.innerHTML = `<i class="${isSaved?'fas':'far'} fa-heart"></i>`; btn.classList.toggle('saved', isSaved); }
}

// ======================== DASHBOARD ========================
function renderSvDashboard() {
  const statuses = { pending:'badge-gold', accepted:'badge-green', completed:'badge-blue' };
  const statusLabels = { pending:'Pending', accepted:'Accepted', completed:'Completed' };

  const pendingEl = document.getElementById('svdPending');
  if (pendingEl) {
    const list = myRequests.filter(r => r.status === 'pending').slice(0,4);
    pendingEl.innerHTML = list.length ? list.map(r=>`
      <div class="svd-req-item">
        <div class="svd-req-svc"><i class="${catIcon(MOCK_PROVIDERS.find(p=>p.id===r.providerId)?.category||'')}"></i>${r.serviceType||r.profession}</div>
        <div class="svd-req-provider">${r.providerName}</div>
        <div class="svd-req-date"><i class="fas fa-calendar"></i>${r.date} at ${r.time}</div>
        <span class="svd-req-badge badge-gold">Pending</span>
      </div>`).join('') : '<div class="svd-empty">No pending requests.</div>';
  }

  const allEl = document.getElementById('svdAllRequests');
  if (allEl) {
    allEl.innerHTML = myRequests.slice(0,6).map(r=>`
      <div class="svd-req-item">
        <div class="svd-req-svc">${r.serviceType||r.profession}</div>
        <div class="svd-req-provider">${r.providerName} · <span style="color:var(--text-muted)">${r.date}</span></div>
        <span class="svd-req-badge ${statuses[r.status]||'badge-gray'}">${statusLabels[r.status]||r.status}</span>
      </div>`).join('') || '<div class="svd-empty">No requests yet.</div>';
  }

  const savedEl = document.getElementById('svdSaved');
  if (savedEl) {
    const list = MOCK_PROVIDERS.filter(p => savedProviders.includes(p.id)).slice(0,4);
    savedEl.innerHTML = list.length ? list.map(pv=>`
      <div class="svd-saved-item" onclick="openSvDetail('${pv.id}')">
        <img src="${pv.avatar}" alt="${pv.name}" onerror="this.src='https://i.pravatar.cc/100?img=1'">
        <div>
          <div class="svd-saved-name">${pv.name}</div>
          <div class="svd-saved-prof" style="color:${catColor(pv.category)}">${pv.profession}</div>
        </div>
        <div class="svd-saved-price" style="margin-left:auto">${pv.priceFrom} GEL</div>
      </div>`).join('') : '<div class="svd-empty">No saved providers yet.</div>';
  }

  const recEl = document.getElementById('svdRecommended');
  if (recEl) {
    const list = MOCK_PROVIDERS.filter(p => !savedProviders.includes(p.id) && p.featured).slice(0,3);
    recEl.innerHTML = list.map(pv=>`
      <div class="svd-saved-item" onclick="openSvDetail('${pv.id}')">
        <img src="${pv.avatar}" alt="${pv.name}" onerror="this.src='https://i.pravatar.cc/100?img=1'">
        <div>
          <div class="svd-saved-name">${pv.name}</div>
          <div class="svd-saved-prof" style="color:${catColor(pv.category)}">${pv.profession}</div>
        </div>
        <span class="sv-badge" style="--bc:#10b981;margin-left:auto">Featured</span>
      </div>`).join('');
  }
}

// ======================== TABS ========================
function switchSvTab(tab, el) {
  document.querySelectorAll('.sv-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sv-tab-panel').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('panel-sv-'+tab)?.classList.add('active');
  if (tab === 'dashboard') renderSvDashboard();
  if (tab === 'nearby') renderNearby();
  if (tab === 'saved') renderSavedPanel();
}

function renderNearby() {
  const el = document.getElementById('nearbyGrid');
  if (!el) return;
  const list = MOCK_PROVIDERS.filter(p => p.availableToday).sort((a,b) => b.trustScore-a.trustScore);
  el.innerHTML = list.map(renderProviderCard).join('');
}

function renderSavedPanel() {
  const el = document.getElementById('savedGrid');
  if (!el) return;
  const list = MOCK_PROVIDERS.filter(p => savedProviders.includes(p.id));
  el.innerHTML = list.length ? list.map(renderProviderCard).join('')
    : '<div class="svd-empty" style="padding:48px;text-align:center;color:var(--text-muted)"><i class="far fa-heart" style="font-size:2rem;display:block;margin-bottom:12px;opacity:0.3"></i>No saved providers yet.</div>';
}

// ======================== MODAL HELPERS ========================
function openSvModal(id) { const m = document.getElementById(id); if (!m) return; m.style.display='flex'; requestAnimationFrame(() => m.classList.add('open')); }
function closeSvModal(id) { const m = document.getElementById(id); if (!m) return; m.classList.remove('open'); setTimeout(() => { m.style.display='none'; }, 280); }
function showSvToast(msg) { const t = document.getElementById('svToast'); if (!t) return; t.textContent=msg; t.classList.add('visible'); setTimeout(()=>t.classList.remove('visible'),2800); }

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => {
  applySvFilters();
  renderSvDashboard();

  const qi = document.getElementById('svSearchInput');
  if (qi) qi.addEventListener('input', () => { svState.q = qi.value; applySvFilters(); });

  const sortSel = document.getElementById('svSortSelect');
  if (sortSel) sortSel.addEventListener('change', () => { svState.sort = sortSel.value; applySvFilters(); });

  const citySel = document.getElementById('svCityFilter');
  if (citySel) citySel.addEventListener('change', () => { svState.city = citySel.value; applySvFilters(); });

  const ratingSel = document.getElementById('svRatingFilter');
  if (ratingSel) ratingSel.addEventListener('change', () => { svState.rating = ratingSel.value; applySvFilters(); });

  const priceMin = document.getElementById('svPriceMin');
  const priceMax = document.getElementById('svPriceMax');
  if (priceMin) priceMin.addEventListener('input', () => { svState.priceMin = priceMin.value; applySvFilters(); });
  if (priceMax) priceMax.addEventListener('input', () => { svState.priceMax = priceMax.value; applySvFilters(); });

  ['svVerified','svAvailToday','svOnline','svHomeVisit','svHighTrust'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      if (id==='svVerified')   svState.verified      = el.checked;
      if (id==='svAvailToday') svState.availableToday = el.checked;
      if (id==='svOnline')     svState.onlineService  = el.checked;
      if (id==='svHomeVisit')  svState.homeVisit      = el.checked;
      if (id==='svHighTrust')  svState.highTrust      = el.checked;
      applySvFilters();
    });
  });

  document.addEventListener('keydown', e => { if (e.key==='Escape') ['svDetailModal','requestModal'].forEach(closeSvModal); });
  ['svDetailModal','requestModal'].forEach(id => { const m = document.getElementById(id); if (m) m.addEventListener('click', e => { if (e.target===m) closeSvModal(id); }); });
});
