/* ================================================================
   GeoHub — Patriot / City Missions System
   patriot.js
   ================================================================ */
(function () {
  'use strict';

  /* ── DATA ────────────────────────────────────────────────── */
  const MISSIONS = [
    {
      id: 'pm1', type: 'cleanup', emoji: '🌿', title: 'Vake Park Clean-up',
      location: 'Vake Park, Tbilisi', dist: '0.4 km',
      desc: 'Collect litter along the main walking path. Before/after photos required for AI verification.',
      diff: 'easy', xp: 150, trust: 5, people: 3, deadline: 'Today',
      verify: ['GPS','Camera','AI'], progress: 2, total: 4, status: 'inprogress', urgent: false,
    },
    {
      id: 'pm2', type: 'infra', emoji: '💡', title: 'Broken Street Light Report',
      location: 'Rustaveli Ave, Tbilisi', dist: '0.9 km',
      desc: 'Document and report the broken street light at the crossroads. GPS + photo required.',
      diff: 'easy', xp: 80, trust: 3, people: 1, deadline: 'Ongoing',
      verify: ['GPS','Camera'], progress: 0, total: 2, status: 'available', urgent: true,
    },
    {
      id: 'pm3', type: 'park', emoji: '🌳', title: 'Park Bench Restoration',
      location: 'Mtatsminda Park', dist: '1.2 km',
      desc: 'Report damaged benches and help coordinate a restoration volunteer group.',
      diff: 'medium', xp: 200, trust: 8, people: 5, deadline: '3 days',
      verify: ['GPS','Camera','AI'], progress: 1, total: 5, status: 'inprogress', urgent: false,
    },
    {
      id: 'pm4', type: 'community', emoji: '🤝', title: 'Help Elderly Neighbor',
      location: 'Saburtalo District', dist: '0.6 km',
      desc: 'Assist elderly residents with groceries or errands. Community impact tracked via GeoHub.',
      diff: 'easy', xp: 120, trust: 6, people: 2, deadline: 'Ongoing',
      verify: ['GPS'], progress: 0, total: 3, status: 'available', urgent: false,
    },
    {
      id: 'pm5', type: 'animal', emoji: '🐾', title: 'Street Animal Care',
      location: 'Old Town, Tbilisi', dist: '1.5 km',
      desc: 'Feed and register street animals using the GeoHub animal care registry.',
      diff: 'easy', xp: 100, trust: 4, people: 1, deadline: 'Ongoing',
      verify: ['GPS','Camera'], progress: 0, total: 2, status: 'available', urgent: false,
    },
    {
      id: 'pm6', type: 'safety', emoji: '🚨', title: 'Unsafe Alley Alert',
      location: 'Gldani District', dist: '2.1 km',
      desc: 'Document and report poor lighting and safety hazards in the northern alley zone.',
      diff: 'medium', xp: 180, trust: 7, people: 2, deadline: 'Urgent',
      verify: ['GPS','Camera','AI'], progress: 0, total: 3, status: 'available', urgent: true,
    },
    {
      id: 'pm7', type: 'eco', emoji: '♻️', title: 'Recycling Drive Coordinator',
      location: 'Fabrika Area, Tbilisi', dist: '0.8 km',
      desc: 'Organize and lead a neighborhood recycling collection. AI verifies volume collected.',
      diff: 'hard', xp: 350, trust: 12, people: 8, deadline: '5 days',
      verify: ['GPS','Camera','AI'], progress: 0, total: 6, status: 'available', urgent: false,
    },
    {
      id: 'pm8', type: 'volunteer', emoji: '🎯', title: 'Community Event Helper',
      location: 'Rustaveli Cultural Centre', dist: '1.0 km',
      desc: 'Volunteer for the city\'s monthly community event — setup, guidance, and takedown.',
      diff: 'medium', xp: 250, trust: 10, people: 10, deadline: 'Sat May 11',
      verify: ['GPS','Camera'], progress: 0, total: 4, status: 'available', urgent: false,
    },
  ];

  const NEARBY_PROBLEMS = [
    { emoji: '🗑️', title: 'Overflowing Bin', loc: 'Vake Park entrance', dist: '0.3 km', urgency: 'high', reports: 4 },
    { emoji: '🪑', title: 'Broken Park Bench', loc: 'Mtatsminda Promenade', dist: '1.1 km', urgency: 'medium', reports: 2 },
    { emoji: '💡', title: 'Street Light Out', loc: 'Rustaveli Ave #42', dist: '0.9 km', urgency: 'high', reports: 6 },
    { emoji: '🛣️', title: 'Road Pothole', loc: 'Kostava St Junction', dist: '0.7 km', urgency: 'medium', reports: 3 },
    { emoji: '⚠️', title: 'Unsafe Pavement', loc: 'Old Town Steps', dist: '1.8 km', urgency: 'low', reports: 1 },
  ];

  const COMPLETED_ACTIONS = [
    { emoji: '🌿', title: 'Didube Park Clean-up', date: 'May 6', xp: 150, trust: 5 },
    { emoji: '💡', title: 'Light Report Filed', date: 'May 3', xp: 80, trust: 3 },
    { emoji: '♻️', title: 'Recycling Drive', date: 'Apr 29', xp: 350, trust: 12 },
    { emoji: '🤝', title: 'Helped 2 Neighbors', date: 'Apr 25', xp: 120, trust: 6 },
    { emoji: '🐾', title: 'Fed 8 Street Cats', date: 'Apr 20', xp: 100, trust: 4 },
    { emoji: '🚨', title: 'Safety Alert Filed', date: 'Apr 17', xp: 180, trust: 7 },
  ];
  let LEADERBOARD = [];

  const CIVIC_REWARDS = [
    { emoji: '☕', title: 'Café Discount', desc: '20% off at partner cafés across Tbilisi. Earned through civic participation.', cost: '500 XP', locked: false },
    { emoji: '🎟️', title: 'Event Ticket Draw', desc: 'Enter a monthly draw for free tickets to Tbilisi cultural events.', cost: '300 XP', locked: false },
    { emoji: '🏅', title: 'Public Recognition Badge', desc: 'Your name displayed on the GeoHub City Impact board for the month.', cost: '1000 XP', locked: true, lockReason: 'Need Patriot Level 3' },
    { emoji: '🎁', title: 'Partner Gift Box', desc: 'Monthly box from GeoHub partners — eco products, local artisan goods.', cost: '1500 XP', locked: true, lockReason: 'Gold Explorer tier' },
  ];

  const AI_MESSAGES = [
    'Vake Park has 3 reports this week — clean-up mission active nearby',
    'Best mission for you today: Recycling Drive at Fabrika (+350 XP)',
    'You can earn +350 XP today with 2 available missions near you',
    'Your Patriot score is in top 12% of Tbilisi civic helpers',
    'Animal Care missions have low competition — easy XP right now',
  ];

  /* ── STATE ───────────────────────────────────────────────── */
  let aiIdx = 0;
  let reportType = null;
  let reportUrgency = 'medium';
  let localMissions = [];

  /* ── INIT ────────────────────────────────────────────────── */
  function init() {
    loadLocalMissions();
    renderAIDots();
    renderMissions();
    renderNearby();
    renderDone();
    renderLeaderboard();
    loadRealLeaderboard();
    renderRewards();
    animateRing();
    startAICycle();
  }

  /* ── LOCAL MISSIONS (from report modal) ─────────────────── */
  function loadLocalMissions() {
    try { localMissions = (window.safeStorage && window.safeStorage.get('geohub_reported_missions', [])) || []; }
    catch (_) { localMissions = []; }
  }

  function saveLocalMission(m) {
    localMissions.unshift(m);
    try { if (window.safeStorage) window.safeStorage.set('geohub_reported_missions', localMissions.slice(0, 20)); }
    catch (_) { /* ignore */ }
  }

  /* ── RING ANIMATION ──────────────────────────────────────── */
  function animateRing() {
    const fill = document.getElementById('ptRingFill');
    if (!fill) return;
    const r = 46;
    const circ = 2 * Math.PI * r;
    const score = 74;
    fill.style.strokeDasharray = circ;
    fill.style.strokeDashoffset = circ;
    requestAnimationFrame(() => {
      setTimeout(() => {
        fill.style.strokeDashoffset = circ - (circ * score / 100);
      }, 300);
    });
  }

  /* ── TABS ────────────────────────────────────────────────── */
  function switchTab(btn, tab) {
    document.querySelectorAll('.pt-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('[id^="panel-"]').forEach(p => p.style.display = 'none');
    const panel = document.getElementById('panel-' + tab);
    if (panel) panel.style.display = 'block';
  }
  window.switchTab = switchTab;

  /* ── RENDER MISSIONS ─────────────────────────────────────── */
  function renderMissions() {
    const grid = document.getElementById('missionGrid');
    if (!grid) return;
    const all = [...MISSIONS, ...localMissions.map(lm => ({
      id: lm.id, type: lm.type || 'infra', emoji: lm.emoji || '📌', title: lm.title,
      location: lm.location || 'Tbilisi', dist: 'Nearby',
      desc: lm.desc || lm.description || 'Community reported problem', diff: lm.urgency === 'high' ? 'hard' : 'easy',
      xp: 80, trust: 3, people: 2, deadline: 'Community', verify: ['GPS','Camera'],
      progress: 0, total: 2, status: 'available', urgent: lm.urgency === 'high',
    }))];

    document.getElementById('tcActive').textContent = all.length;

    grid.innerHTML = all.map(m => {
      const pct = Math.round((m.progress / m.total) * 100);
      const vbadges = m.verify.map(v => `<span class="pm-vbadge ${v.toLowerCase()}"><i class="fas fa-${v==='GPS'?'map-marker-alt':v==='Camera'?'camera':'robot'}"></i>${v}</span>`).join('');
      const isInprog = m.status === 'inprogress';
      const missionUrl = `camera.html?mode=patriot&mission=${m.id}`;
      return `<div class="pm-card ${m.type}${m.urgent ? ' urgent' : ''}${isInprog ? ' inprogress' : ''}" id="mc-${m.id}">
        <div class="pm-top">
          <div class="pm-emoji">${m.emoji}</div>
          <div class="pm-badges">
            <span class="pm-type-badge ${m.type}">${m.type}</span>
            <span class="pm-diff-badge ${m.diff}">${m.diff}</span>
          </div>
        </div>
        <div class="pm-title">${m.title}</div>
        <div class="pm-location"><i class="fas fa-map-marker-alt"></i>${m.location} <span style="margin-left:4px;color:rgba(255,255,255,0.2)">·</span> ${m.dist}</div>
        <div class="pm-desc">${m.desc}</div>
        <div class="pm-meta">
          <span class="pm-meta-pill xp"><i class="fas fa-coins"></i>+${m.xp} XP</span>
          <span class="pm-meta-pill trust"><i class="fas fa-shield-alt"></i>+${m.trust} Trust</span>
          <span class="pm-meta-pill people"><i class="fas fa-users"></i>${m.people} needed</span>
          <span class="pm-meta-pill${m.urgent ? ' urgent-pill' : ' deadline'}"><i class="fas fa-clock"></i>${m.deadline}</span>
        </div>
        <div class="pm-verify-row">${vbadges}</div>
        <div class="pm-prog-wrap">
          <div class="pm-prog-bar"><div class="pm-prog-fill ${m.type}" data-pct="${pct}" style="width:0"></div></div>
          <div class="pm-prog-text"><span>${m.progress}/${m.total} steps</span><span>${pct}%</span></div>
        </div>
        <div class="pm-actions">
          <button class="pm-btn-start${isInprog ? ' inprog' : ''}${m.urgent ? ' urgent-start' : ''}" onclick="startMission('${m.id}','${missionUrl}')">
            <i class="fas fa-${isInprog ? 'play' : 'camera'}"></i> ${isInprog ? 'Continue' : 'Start Mission'}
          </button>
          <button class="pm-btn-icon" title="Join" onclick="joinMission('${m.id}')"><i class="fas fa-user-plus"></i></button>
          <button class="pm-btn-icon" title="Share" onclick="ptToast('Link copied!')"><i class="fas fa-share-alt"></i></button>
        </div>
      </div>`;
    }).join('');

    setTimeout(() => {
      document.querySelectorAll('.pm-prog-fill').forEach(el => {
        el.style.width = (el.dataset.pct || 0) + '%';
      });
    }, 120);
  }

  /* ── RENDER NEARBY PROBLEMS ──────────────────────────────── */
  function renderNearby() {
    const list = document.getElementById('probList');
    if (!list) return;
    list.innerHTML = NEARBY_PROBLEMS.map(p => `
      <div class="prob-card">
        <div class="prob-icon" style="background:rgba(239,68,68,0.1)">${p.emoji}</div>
        <div class="prob-info">
          <div class="prob-title">${p.title}</div>
          <div class="prob-loc"><i class="fas fa-map-marker-alt" style="color:var(--green)"></i>${p.loc} · ${p.dist} · ${p.reports} reports</div>
        </div>
        <div class="prob-meta">
          <span class="prob-urgency ${p.urgency}">${p.urgency}</span>
          <button class="prob-join-btn" onclick="joinProblem(this)">Join Fix</button>
        </div>
      </div>`).join('');
  }

  /* ── RENDER COMPLETED ────────────────────────────────────── */
  function renderDone() {
    const grid = document.getElementById('doneGrid');
    if (!grid) return;
    grid.innerHTML = COMPLETED_ACTIONS.map(a => `
      <div class="done-card">
        <div class="done-icon">${a.emoji}</div>
        <div class="done-info">
          <div class="done-title">${a.title}</div>
          <div class="done-date">${a.date}</div>
          <div class="done-xp">+${a.xp} XP · +${a.trust} Trust</div>
        </div>
      </div>`).join('');
  }

  /* ── RENDER LEADERBOARD ──────────────────────────────────── */
  function loadRealLeaderboard() {
    const fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) return;
    try {
      const q = fb.fs.query(fb.fs.collection(fb.db, 'users'), fb.fs.orderBy('xp', 'desc'), fb.fs.limit(10));
      fb.fs.getDocs(q).then(snap => {
        LEADERBOARD = [];
        snap.forEach(d => {
          const u = d.data() || {};
          LEADERBOARD.push({
            id: d.id,
            name: u.fullName || u.displayName || u.username || u.email || 'GeoHub User',
            av: ((u.fullName || u.displayName || u.username || 'GH').match(/\b\w/g) || ['G','H']).slice(0,2).join('').toUpperCase(),
            color: '#10b981', xp: Number(u.xp || 0), trust: Number(u.trustScore || 0),
            impact: u.explorerLevel || 'Explorer', badges: Array.isArray(u.badges) && u.badges.length ? u.badges.slice(0,2) : ['🌍 GeoHub']
          });
        });
        renderLeaderboard();
      }).catch(() => renderLeaderboard());
    } catch (e) { renderLeaderboard(); }
  }

  function renderLeaderboard() {
    const list = document.getElementById('lbList');
    if (!list) return;
    if (!LEADERBOARD.length) {
      list.innerHTML = '<div class="lb-card"><div class="lb-info"><div class="lb-name">Leaderboard admin-controlled</div><div class="lb-badges-row"><span class="lb-badge">Real XP rankings will appear after users earn XP.</span></div></div></div>';
      return;
    }
    const rankLabel = ['🥇','🥈','🥉'];
    list.innerHTML = LEADERBOARD.map((u, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      return `<div class="lb-card${i < 3 ? ' top' : ''}">
        <div class="lb-rank ${rankClass}">${i < 3 ? rankLabel[i] : '#' + (i+1)}</div>
        <div class="lb-av" style="background:${u.color}">${u.av}</div>
        <div class="lb-info">
          <div class="lb-name">${u.name}</div>
          <div class="lb-badges-row">${u.badges.map(b => `<span class="lb-badge">${b}</span>`).join('')}</div>
        </div>
        <div class="lb-score-col">
          <div class="lb-xp">${Number(u.xp||0).toLocaleString()} XP</div>
          <div class="lb-trust">Trust ${u.trust}</div>
          <div class="lb-impact">${u.impact}</div>
        </div>
      </div>`;
    }).join('');
  }

  /* ── RENDER REWARDS ──────────────────────────────────────── */
  function renderRewards() {
    const grid = document.getElementById('rewardsGrid');
    if (!grid) return;
    grid.innerHTML = CIVIC_REWARDS.map(r => `
      <div class="civic-reward" onclick="${r.locked ? `ptToast('🔒 ${r.lockReason}')` : `claimReward(this,'${r.title}')`}">
        <div class="cr-icon">${r.emoji}</div>
        <div class="cr-title">${r.title}</div>
        <div class="cr-desc">${r.desc}</div>
        <div class="cr-cost"><i class="fas fa-coins"></i>${r.cost}</div>
        ${r.locked ? `<div class="cr-locked"><i class="fas fa-lock"></i>${r.lockReason}</div>` : ''}
      </div>`).join('');
  }

  /* ── AI SUGGESTIONS ──────────────────────────────────────── */
  function renderAIDots() {
    const dotsEl = document.getElementById('aiDots');
    if (!dotsEl) return;
    dotsEl.innerHTML = AI_MESSAGES.map((_, i) => `<div class="ai-dot${i===0?' active':''}" onclick="setAI(${i});event.stopPropagation()"></div>`).join('');
  }

  function setAI(idx) {
    aiIdx = idx;
    const msg = document.getElementById('aiMsg');
    if (msg) { msg.style.opacity = 0; setTimeout(() => { msg.textContent = AI_MESSAGES[idx]; msg.style.opacity = 1; }, 200); }
    document.querySelectorAll('.ai-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  function cycleAI() { setAI((aiIdx + 1) % AI_MESSAGES.length); }
  window.cycleAI = cycleAI;

  function startAICycle() {
    setInterval(() => cycleAI(), 5000);
  }

  /* ── ACTIONS ─────────────────────────────────────────────── */
  function startMission(id, url) {
    location.href = url;
  }
  window.startMission = startMission;

  function joinMission(id) {
    ptToast('Joined mission! You\'ll earn XP when complete');
    const card = document.getElementById('mc-' + id);
    if (card) {
      const btn = card.querySelector('.pm-btn-start');
      if (btn && !btn.classList.contains('inprog')) {
        btn.classList.add('inprog');
        btn.innerHTML = '<i class="fas fa-play"></i> Continue';
      }
    }
  }
  window.joinMission = joinMission;

  function joinProblem(btn) {
    btn.textContent = 'Joined!';
    btn.style.background = 'rgba(16,185,129,0.2)';
    btn.disabled = true;
    ptToast('Problem mission joined! +20 XP on completion');
  }
  window.joinProblem = joinProblem;

  function claimReward(el, title) {
    ptToast(`Reward claimed: ${title}`);
  }
  window.claimReward = claimReward;

  /* ── REPORT MODAL ────────────────────────────────────────── */
  function openReport() {
    document.getElementById('reportModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeReport() {
    document.getElementById('reportModal').classList.remove('open');
    document.body.style.overflow = '';
  }
  function selectType(btn) {
    document.querySelectorAll('.pt-type-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    reportType = btn.dataset.type;
  }
  function selectUrgency(btn, val) {
    document.querySelectorAll('.pt-urg-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    reportUrgency = val;
  }
  function photoAttach(el) {
    document.getElementById('photoPlaceholderLabel').textContent = '✓ Photo attached';
    el.style.borderColor = 'rgba(16,185,129,0.5)';
    el.style.background = 'rgba(16,185,129,0.08)';
    el.querySelector('i').style.color = 'var(--green)';
  }
  function submitReport() {
    const title = document.getElementById('reportTitle').value.trim();
    const location = document.getElementById('reportLocation').value.trim();
    const desc = document.getElementById('reportDesc').value.trim();
    if (!title) { document.getElementById('reportTitle').focus(); return; }

    const typeEmojis = { trash:'🗑️', bench:'🪑', light:'💡', unsafe:'⚠️', road:'🛣️', other:'📌' };
    const newMission = {
      id: 'rep-' + Date.now(),
      type: reportType || 'infra',
      emoji: typeEmojis[reportType] || '📌',
      title: title || 'Reported Problem',
      location: location || 'Tbilisi',
      description: desc,
      urgency: reportUrgency,
      timestamp: new Date().toISOString(),
    };
    saveLocalMission(newMission);
    renderMissions();
    closeReport();
    ptToast('✓ Report submitted! Mission created +20 XP');

    // Reset form
    document.getElementById('reportTitle').value = '';
    document.getElementById('reportLocation').value = '';
    document.getElementById('reportDesc').value = '';
    reportType = null;
    reportUrgency = 'medium';
    document.querySelectorAll('.pt-type-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.pt-urg-btn').forEach((b, i) => b.classList.toggle('selected', i === 1));
    document.getElementById('photoPlaceholderLabel').textContent = 'Tap to attach photo';
  }

  window.openReport   = openReport;
  window.closeReport  = closeReport;
  window.selectType   = selectType;
  window.selectUrgency = selectUrgency;
  window.photoAttach = photoAttach;
  window.submitReport = submitReport;
  window.toggleFilter = () => ptToast('Filter: All missions');

  /* ── CLOSE MODAL ON OVERLAY CLICK ───────────────────────── */
  document.getElementById('reportModal').addEventListener('click', function (e) {
    if (e.target === this) closeReport();
  });

  /* ── TOAST ───────────────────────────────────────────────── */
  function ptToast(msg) {
    const t = document.getElementById('ptToast');
    const m = document.getElementById('ptToastMsg');
    if (!t || !m) return;
    m.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  }
  window.ptToast = ptToast;

  /* ── RUN ─────────────────────────────────────────────────── */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
