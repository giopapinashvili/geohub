// Tab navigation
  function switchTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    document.querySelectorAll('.dash-nav-item').forEach(a => a.classList.toggle('active', a.dataset.tab === name));
  }
  document.querySelectorAll('[data-tab]').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  // Views Chart
  const viewData = [42, 67, 55, 89, 103, 78, 95];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxV = Math.max(...viewData);
  document.getElementById('viewsChart').innerHTML = viewData.map((v, i) => `
    <div class="chart-col">
      <div class="chart-bar-v" style="height:${(v/maxV)*100}%;" title="${v} views on ${days[i]}"></div>
      <div class="chart-col-label">${days[i]}</div>
    </div>`).join('');

  // Reviews
  document.getElementById('dashReviews').innerHTML = REVIEWS.filter(r => r.businessId === 2).concat([
    { id: 10, author: 'Emily W.', avatar: 'E', rating: 5, date: '2024-12-01', text: 'Best tour in Georgia! Giorgi was an incredible guide. The 4x4 route was breathtaking.' },
    { id: 11, author: 'David L.', avatar: 'D', rating: 5, date: '2024-11-20', text: 'Excellent experience, highly professional team. Booked for 4 people and everyone loved it.' },
  ]).map(r => `
    <div class="dash-card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="reviewer-avatar">${r.avatar}</div>
          <div>
            <div style="font-weight:600;font-size:0.875rem">${r.author}</div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${r.date}</div>
          </div>
        </div>
        ${renderStars(r.rating)}
      </div>
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px">${r.text}</p>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm"><i class="fas fa-reply"></i> Reply</button>
        <button class="btn btn-ghost btn-sm"><i class="fas fa-flag"></i> Report</button>
      </div>
    </div>`).join('');

  initScrollAnimations();

  // ===== GROWTH SYSTEM JS =====

  // Modal helpers
  function openModal(id) {
    document.getElementById(id).classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    document.body.style.overflow = '';
  }
  document.querySelectorAll('.gh-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.gh-modal-overlay.open').forEach(o => closeModal(o.id));
  });

  // Campaign Modal
  let selectedCampaignType = 'discount';
  function openCampaignModal(type) {
    selectedCampaignType = type || 'discount';
    document.querySelectorAll('#modalTypeGrid .type-card').forEach(c => {
      c.classList.toggle('selected', c.onclick.toString().includes(`'${selectedCampaignType}'`));
    });
    openModal('campaignModal');
  }
  function selectModalType(el, type) {
    selectedCampaignType = type;
    document.querySelectorAll('#modalTypeGrid .type-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }

  const typeIcons = { discount:'🏷️', qr:'📱', xp:'⚡', influencer:'🌟', event:'🎉' };
  const typeBgs   = { discount:'rgba(245,158,11,0.12)', qr:'var(--green-muted)', xp:'var(--blue-muted)', influencer:'rgba(228,64,95,0.1)', event:'rgba(167,139,250,0.12)' };

  function createCampaign() {
    const title  = document.getElementById('newCampaignTitle').value.trim() || 'New Campaign';
    const reward = document.getElementById('newCampaignReward').value.trim() || 'Special offer';
    const end    = document.getElementById('newCampaignEnd').value || 'Dec 31';
    const icon   = typeIcons[selectedCampaignType] || '📢';
    const bg     = typeBgs[selectedCampaignType] || 'var(--bg-elevated)';

    const card = document.createElement('div');
    card.className = 'campaign-card';
    card.innerHTML = `
      <div class="campaign-icon" style="background:${bg}">${icon}</div>
      <div class="campaign-body">
        <div class="campaign-title">${title}</div>
        <div class="campaign-sub">${reward} · Exp. ${end}</div>
        <div class="campaign-metrics">
          <div class="campaign-metric"><strong>0</strong> views</div>
          <div class="campaign-metric"><strong>0</strong> claims</div>
        </div>
      </div>
      <div><div class="campaign-status active">● Active</div></div>`;
    document.getElementById('campaignList').prepend(card);
    closeModal('campaignModal');
    document.getElementById('newCampaignTitle').value = '';
    document.getElementById('newCampaignReward').value = '';
  }

  // Analytics views chart (30 days)
  const analyticsData = [28,34,41,38,55,62,48,70,83,77,91,68,74,85,92,79,103,88,95,110,97,84,119,126,108,131,143,128,138,152];
  const maxA = Math.max(...analyticsData);
  document.getElementById('analyticsViewsChart').innerHTML = analyticsData.map(v => `
    <div style="flex:1;border-radius:2px 2px 0 0;background:var(--gradient-brand);opacity:0.75;min-height:3px;transition:opacity .25s;cursor:pointer" style="height:${(v/maxA)*100}%" title="${v} views" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.75">
    </div>`).join('');
  // Fix heights via JS after render
  setTimeout(() => {
    const bars = document.querySelectorAll('#analyticsViewsChart > div');
    analyticsData.forEach((v, i) => { if (bars[i]) bars[i].style.height = `${(v/maxA)*100}%`; });
  }, 50);

  // Peak Hours chart
  const peakData = [5,3,8,15,22,34,45,68,72,64,58,71,80,88,92,85,75,62,78,84,76,55,38,20];
  const maxP = Math.max(...peakData);
  const peakLevels = peakData.map(v => v > 70 ? 'high' : v > 40 ? 'medium' : '');
  const peakHours = ['8am','9','10','11','12','1pm','2','3','4','5','6','7pm','8','9','10','11pm'];
  document.getElementById('peakHoursChart').innerHTML = peakData.slice(0, 16).map((v, i) => `
    <div class="peak-bar ${peakLevels[i]}" style="height:${(v/maxP)*100}%" data-tip="${['8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm','10pm','11pm'][i]}: ${v} visits"></div>`).join('');

  // QR Scan chart
  const qrData = [8, 14, 11, 18, 24, 31, 19];
  const maxQ = Math.max(...qrData);
  document.getElementById('qrScanChart').innerHTML = qrData.map((v, i) => `
    <div style="flex:1;border-radius:3px 3px 0 0;background:var(--gradient-brand);opacity:0.8;min-height:3px;cursor:pointer;transition:opacity .25s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8" title="${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}: ${v} scans"></div>`).join('');
  setTimeout(() => {
    const qBars = document.querySelectorAll('#qrScanChart > div');
    qrData.forEach((v, i) => { if (qBars[i]) qBars[i].style.height = `${(v/maxQ)*100}%`; });
  }, 50);

  // QR pixel art generator (decorative)
  function buildQR(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const pattern = [
      1,1,1,1,1,1,1,0,1,0,1,
      1,0,0,0,0,0,1,0,0,1,1,
      1,0,1,1,1,0,1,0,1,0,0,
      1,0,1,1,1,0,1,0,0,1,1,
      1,0,1,1,1,0,1,0,1,0,1,
      1,0,0,0,0,0,1,0,0,0,0,
      1,1,1,1,1,1,1,0,1,0,1,
      0,0,0,0,0,0,0,0,0,1,0,
      1,0,1,1,0,1,1,1,0,1,1,
      0,1,0,0,1,0,0,0,1,0,1,
      1,1,1,1,1,1,1,0,0,1,0,
    ];
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(11,1fr);gap:1.5px;width:100%;height:100%">
      ${pattern.map(b => `<div style="background:${b ? '#111' : 'white'};border-radius:1px"></div>`).join('')}
    </div>`;
  }
  buildQR('qrPixels');
  buildQR('qrPixelsModal');

  // Influencer offers
  const offerLabels = { free: 'Free Product', discount: 'Discount Code', paid: 'Paid Collab', event: 'Event Invite' };
  function sendOffer(btn, type) {
    const card = btn.closest('.influencer-card');
    const name = card.querySelector('.influencer-name').textContent;
    const handle = card.querySelector('.influencer-handle').textContent;
    const actDiv = card.querySelector('.inf-actions');
    actDiv.innerHTML = `<div class="sent-badge"><i class="fas fa-check-circle"></i> Offer Sent</div>`;

    const sentList = document.getElementById('sentOffersList');
    if (sentList.querySelector('[style*="text-align:center"]')) sentList.innerHTML = '';
    const item = document.createElement('div');
    item.style.cssText = 'padding:10px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border)';
    item.innerHTML = `<div style="font-size:0.78rem;font-weight:700">${name}</div>
      <div style="font-size:0.7rem;color:var(--text-muted)">${handle}</div>
      <div style="font-size:0.7rem;color:var(--green-light);margin-top:4px"><i class="fas fa-check-circle"></i> ${offerLabels[type]} sent</div>`;
    sentList.appendChild(item);
  }

  // Post Composer
  const postTypeEmojis = { offer:'🏷️', event:'🎉', menu:'🍽️', story:'📱', promo:'📢' };
  function selectPostType(btn) {
    document.querySelectorAll('.post-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const type = btn.dataset.type;
    document.getElementById('previewType').textContent = `${postTypeEmojis[type] || '📢'} ${btn.textContent.trim()} · just now`;
  }
  function updatePostPreview() {
    const t = document.getElementById('postTitle').value;
    const c = document.getElementById('postContent').value;
    document.getElementById('previewTitle').textContent = t || 'Your post title here...';
    document.getElementById('previewContent').textContent = c || 'Start typing your post content...';
  }
  function publishPost() {
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    if (!title && !content) return;
    const activeTypeBtn = document.querySelector('.post-type-btn.active');
    const typeLabel = activeTypeBtn ? activeTypeBtn.textContent.trim() : '📢 Post';
    const list = document.getElementById('publishedPostsList');
    const item = document.createElement('div');
    item.className = 'post-preview-box';
    item.innerHTML = `
      <div class="post-preview-header">
        <div class="post-preview-avatar">${(document.getElementById('dashPostPreviewAvatar') || {textContent:'B'}).textContent}</div>
        <div>
          <div style="font-size:0.8rem;font-weight:700">${(document.getElementById('dashPostPreviewName') || {textContent:'Your Business'}).textContent}</div>
          <div style="font-size:0.68rem;color:var(--text-muted)">${typeLabel} · just now</div>
        </div>
      </div>
      ${title ? `<div style="font-size:0.875rem;font-weight:700;margin-bottom:6px">${title}</div>` : ''}
      ${content ? `<div style="font-size:0.8rem;color:var(--text-secondary)">${content}</div>` : ''}
      <div style="display:flex;gap:12px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-subtle)">
        <span style="font-size:0.72rem;color:var(--text-muted)"><i class="fas fa-eye"></i> 0 views</span>
        <span style="font-size:0.72rem;color:var(--text-muted)"><i class="fas fa-heart"></i> 0 likes</span>
        <span style="font-size:0.72rem;color:var(--green-light);font-size:0.72rem;margin-left:auto"><i class="fas fa-check-circle"></i> Published</span>
      </div>`;
    list.prepend(item);
    document.getElementById('postTitle').value = '';
    document.getElementById('postContent').value = '';
    updatePostPreview();
  }
  function savePostDraft(btn) {
    btn.innerHTML = '<i class="fas fa-check"></i> Draft Saved!';
    btn.style.color = 'var(--green)';
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-save"></i> Save Draft'; btn.style.color = ''; }, 2000);
  }

function saveDashProfile() {
  if (!window.GeoMode || !window.GeoMode.isRealUser()) return;
  var user = window.GeoMode.getCurrentUser();
  if (!user) return;

  var existing = window.__geoDashboardBusiness || {};
  existing = existing || {};

  var name = document.getElementById('profBizName').value.trim();
  existing.name     = name || existing.name || '';
  existing.category = document.getElementById('profBizCat').value || existing.category || '';
  existing.city     = document.getElementById('profBizCity').value || existing.city || '';
  existing.address  = document.getElementById('profBizAddr').value.trim() || existing.address || '';
  existing.desc     = document.getElementById('profBizDesc').value.trim() || existing.desc || '';
  existing.phone    = document.getElementById('profBizPhone').value.trim() || existing.phone || '';
  existing.whatsapp = document.getElementById('profBizWhatsapp').value.trim() || existing.whatsapp || '';
  existing.instagram = document.getElementById('profBizInstagram').value.trim() || existing.instagram || '';
  existing.email    = document.getElementById('profBizEmail').value.trim() || existing.email || '';

  window.__geoDashboardBusiness = existing;
  if (window.GeoFirebase && window.GeoFirebase.db && window.GeoFirebase.fs) {
    window.GeoFirebase.fs.setDoc(window.GeoFirebase.fs.doc(window.GeoFirebase.db, 'businesses', existing.id || (user.uid + '_dashboard_business')), Object.assign({}, existing, { id: existing.id || (user.uid + '_dashboard_business'), ownerId: user.uid, createdBy: user.uid, status: 'active', updatedAt: Date.now() }), { merge: true }).catch(function(e){ console.warn('[Dashboard] business save failed', e.message); });
  }

  // Update live preview elements
  var bizName = existing.name || 'Your Business';
  var bizSlug = bizName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'your-business';
  var bizLetter = (bizName[0] || 'B').toUpperCase();

  var prevName = document.getElementById('prevBizName');
  if (prevName) prevName.textContent = bizName;
  var prevLoc = document.getElementById('prevBizLocation');
  if (prevLoc) prevLoc.innerHTML = '<i class="fas fa-map-marker-alt"></i> ' + (existing.city || 'Georgia');
  var urlEl = document.getElementById('profBizUrl');
  if (urlEl) urlEl.textContent = 'geohub.ge/' + bizSlug;
  var qrCardName = document.getElementById('dashQrCardName');
  if (qrCardName) qrCardName.textContent = bizName;
  var qrModalName = document.getElementById('dashQrModalName');
  if (qrModalName) qrModalName.textContent = bizName;
  var postPreviewName = document.getElementById('dashPostPreviewName');
  if (postPreviewName) postPreviewName.textContent = bizName;
  var postPreviewAvatar = document.getElementById('dashPostPreviewAvatar');
  if (postPreviewAvatar) postPreviewAvatar.textContent = bizLetter;
  var previewCtaUrl = document.getElementById('dashPreviewCtaUrl');
  if (previewCtaUrl) previewCtaUrl.textContent = 'Book Now → geohub.ge/' + bizSlug;
  var sidebarName = document.getElementById('dashSidebarName');
  if (sidebarName) sidebarName.textContent = bizName;
  var sidebarLetter = document.getElementById('dashSidebarLetter');
  if (sidebarLetter) sidebarLetter.textContent = bizLetter;
  document.querySelectorAll('.dash-nav-biz-name').forEach(function (el) { el.textContent = bizName; });

  var btn = document.getElementById('profSaveBtn');
  if (btn) {
    btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
    btn.style.background = 'var(--green)';
    setTimeout(function () {
      btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
      btn.style.background = '';
    }, 2500);
  }
}

(function () {
  if (!window.GeoMode) return;

  var user = window.GeoMode.getCurrentUser();

  // Not logged in at all → redirect to auth
  if (!user) { window.location.href = 'auth.html'; return; }

  // Demo user → show Kazbegi Adventures as-is
  if (!window.GeoMode.isRealUser()) return;

  var biz = window.__geoDashboardBusiness || null;
  if (!biz && window.GeoFirebase && window.GeoFirebase.db && window.GeoFirebase.fs) {
    window.GeoFirebase.fs.getDocs(window.GeoFirebase.fs.query(window.GeoFirebase.fs.collection(window.GeoFirebase.db, 'businesses'), window.GeoFirebase.fs.where('ownerId', '==', user.uid || user.id), window.GeoFirebase.fs.limit(1))).then(function(snap){
      if (!snap.empty) { var d = snap.docs[0]; window.__geoDashboardBusiness = Object.assign({ id: d.id }, d.data()); window.location.reload(); }
    }).catch(function(){});
  }

  var nav   = document.querySelector('.dashboard-nav');
  var main  = document.querySelector('.dashboard-content');
  var state = document.getElementById('realNoBizState');

  if (!biz) {
    // No business yet — show empty state
    if (nav)   nav.style.display   = 'none';
    if (main)  main.style.display  = 'none';
    if (state) state.style.display = 'flex';
    return;
  }

  // Business exists — personalise the sidebar header
  var bizName = biz.name || user.fullName + "'s Business";
  var bizLetter = (bizName[0] || 'B').toUpperCase();
  var bizSlug = bizName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'your-business';

  var nameEls = document.querySelectorAll('.dash-nav-biz-name');
  nameEls.forEach(function (el) { el.textContent = bizName; });

  // Replace hardcoded names in sidebar, QR cards, and post composer preview
  var sidebarLetter = document.getElementById('dashSidebarLetter');
  if (sidebarLetter) sidebarLetter.textContent = bizLetter;
  var sidebarName = document.getElementById('dashSidebarName');
  if (sidebarName) sidebarName.textContent = bizName;

  var qrCardName = document.getElementById('dashQrCardName');
  if (qrCardName) qrCardName.textContent = bizName;
  var qrModalName = document.getElementById('dashQrModalName');
  if (qrModalName) qrModalName.textContent = bizName;

  var postPreviewName = document.getElementById('dashPostPreviewName');
  if (postPreviewName) postPreviewName.textContent = bizName;
  var postPreviewAvatar = document.getElementById('dashPostPreviewAvatar');
  if (postPreviewAvatar) postPreviewAvatar.textContent = bizLetter;
  var previewCtaUrl = document.getElementById('dashPreviewCtaUrl');
  if (previewCtaUrl) previewCtaUrl.textContent = 'Book Now → geohub.ge/' + bizSlug;

  // Populate My Profile form fields
  var fields = {
    profBizName: biz.name || '',
    profBizAddr: biz.address || '',
    profBizPhone: biz.phone || '',
    profBizWhatsapp: biz.whatsapp || '',
    profBizInstagram: biz.instagram || '',
    profBizEmail: biz.email || ''
  };
  Object.keys(fields).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = fields[id];
  });
  // Select dropdowns
  var catSel = document.getElementById('profBizCat');
  if (catSel && biz.category) catSel.value = biz.category;
  var citySel = document.getElementById('profBizCity');
  if (citySel && biz.city) citySel.value = biz.city;
  var descEl = document.getElementById('profBizDesc');
  if (descEl) descEl.value = biz.desc || '';

  // Profile preview card
  var prevName = document.getElementById('prevBizName');
  if (prevName) prevName.textContent = bizName;
  var prevLoc = document.getElementById('prevBizLocation');
  if (prevLoc) prevLoc.innerHTML = '<i class="fas fa-map-marker-alt"></i> ' + (biz.city || 'Georgia');

  // GeoHub URL
  var urlEl = document.getElementById('profBizUrl');
  if (urlEl) urlEl.textContent = 'geohub.ge/' + bizSlug;

  // Clear demo Published Posts for real users
  var pubList = document.getElementById('publishedPostsList');
  if (pubList) pubList.innerHTML = '<div style="text-align:center;padding:32px 0;color:var(--text-muted);font-size:0.85rem"><i class="fas fa-edit" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.3"></i>No posts yet — compose your first post above</div>';

  // Zero stats and clear demo data for new business with no activity
  if (!biz.hasActivity) {
    document.querySelectorAll('.kpi-value, .stat-value').forEach(function (el) {
      if (!isNaN(parseInt(el.textContent))) el.textContent = '0';
    });
    document.querySelectorAll('.dash-nav-badge').forEach(function (el) { el.style.display = 'none'; });
    var chart = document.getElementById('viewsChart');
    if (chart) chart.innerHTML = '<div style="width:100%;text-align:center;padding:32px 0;color:var(--text-muted);font-size:0.85rem"><i class="fas fa-chart-bar" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.3"></i>No views yet — activity will appear here</div>';
    var rev = document.getElementById('dashReviews');
    if (rev) rev.innerHTML = '<div style="text-align:center;padding:32px 0;color:var(--text-muted);font-size:0.85rem"><i class="fas fa-star" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.3"></i>No reviews yet</div>';
    var bookTab = document.getElementById('tab-bookings');
    if (bookTab) {
      var bookTable = bookTab.querySelector('.booking-table');
      if (bookTable) bookTable.innerHTML = '<tbody><tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);font-size:0.85rem"><i class="fas fa-calendar" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.3"></i>No bookings yet</td></tr></tbody>';
    }
  }
})();
