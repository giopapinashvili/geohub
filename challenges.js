const CHALLENGES = [
  // DAILY
  { id:1, type:'daily', title:'Morning Explorer', desc:'Check in to any place before noon today', diff:'easy', xp:50, deadline:'Today', tasks:['Check in to 1 place before 12:00'], progress:0, total:1, participants:234, status:'available' },
  { id:2, type:'daily', title:'Photo Journalist', desc:'Upload 3 camera-proof check-ins today', diff:'medium', xp:80, deadline:'Today', tasks:['Camera check-in 1','Camera check-in 2','Camera check-in 3'], progress:1, total:3, participants:156, status:'inprogress' },

  // WEEKLY
  { id:3, type:'weekly', title:'Café Circuit', desc:'Visit 5 different cafés this week', diff:'medium', xp:200, deadline:'5 days', tasks:['Entree Coffee','Fabrika Café','Lolita Coffee','Coffee Lab','Fifth Café'], progress:3, total:5, participants:891, status:'inprogress' },
  { id:4, type:'weekly', title:'Review Master', desc:'Write 3 detailed business reviews', diff:'easy', xp:120, deadline:'5 days', tasks:['Review business 1','Review business 2','Review business 3'], progress:0, total:3, participants:445, status:'available' },
  { id:5, type:'weekly', title:'Weekend Warrior', desc:'Check in to 3 places over the weekend', diff:'easy', xp:200, deadline:'2 days', tasks:['Place 1','Place 2','Place 3'], progress:2, total:3, participants:1203, status:'inprogress' },

  // CITY
  { id:6, type:'city', title:'Old Tbilisi Quest', desc:'Visit 7 iconic spots in Old Town Tbilisi', diff:'hard', xp:500, deadline:'30 days', tasks:['Narikala Fortress','Anchiskhati Basilica','Abanotubani Baths','Metekhi Church','Shardeni Street','Dry Bridge Market','Freedom Square'], progress:3, total:7, participants:2341, status:'inprogress' },
  { id:7, type:'city', title:'Batumi Explorer', desc:'Discover 5 hidden gems in Batumi', diff:'medium', xp:300, deadline:'14 days', tasks:['Piazza Square','Alphabet Tower','Europa Square','Batumi Boulevard','Gonio Fortress'], progress:0, total:5, participants:678, status:'available' },

  // BUSINESS
  { id:8, type:'business', title:'Coffee Connoisseur', desc:'Try coffee at 4 partner cafés and rate each', diff:'easy', xp:150, deadline:'7 days', tasks:['Entree Coffee ★★★★★','Fabrika Café ★★★★★','Lolita Coffee ★★★★★','Coffee Lab ★★★★★'], progress:2, total:4, participants:1567, status:'inprogress' },
  { id:9, type:'business', title:'Foodie Circuit', desc:'Dine at 3 partner restaurants', diff:'medium', xp:250, deadline:'10 days', tasks:['Shavi Lomi','Barbarestan','Azarphesha'], progress:0, total:3, participants:892, status:'available' },

  // PATRIOT
  { id:10, type:'patriot', title:'Park Guardian', desc:'Visit a public park and report its condition with photos', diff:'medium', xp:200, deadline:'Ongoing', tasks:['Arrive at public park','Take 3 condition photos','Submit GPS-verified report'], progress:0, total:3, participants:1089, status:'available', requires:['GPS','Camera','AI'] },
  { id:11, type:'patriot', title:'Street Hero', desc:'Find and document broken infrastructure in your area', diff:'easy', xp:150, deadline:'Ongoing', tasks:['Locate infrastructure issue','Photo document the problem','Submit location report'], progress:1, total:3, participants:789, status:'inprogress', requires:['GPS','Camera'] },
  { id:12, type:'patriot', title:'Community Builder', desc:'Help organize a neighborhood clean-up activity', diff:'hard', xp:500, deadline:'Monthly', tasks:['Register clean-up event','Recruit 5 participants','Complete the clean-up','Submit AI-verified photos'], progress:0, total:4, participants:234, status:'available', requires:['GPS','Camera','AI'] },

  // GROUP
  { id:13, type:'group', title:'Squad Goals', desc:'Check in to the same place simultaneously with 3 friends', diff:'medium', xp:300, deadline:'7 days', tasks:['Invite 3 friends','Arrive together','Simultaneous check-in','Tag all in post'], progress:1, total:4, participants:456, status:'inprogress' },
  { id:14, type:'group', title:'City Rangers', desc:'Form a team of 5 and explore 5 different districts together', diff:'hard', xp:600, deadline:'14 days', tasks:['Form group of 5','District 1 check-in','District 2 check-in','District 3 check-in','Complete all 5'], progress:0, total:5, participants:234, status:'available' },

  // COMPLETED
  { id:15, type:'completed', title:'First Explorer', desc:'Complete your very first check-in', diff:'easy', xp:50, deadline:'Completed', tasks:['First check-in ever'], progress:1, total:1, participants:18400, status:'completed', emoji:'🗺️', completedDate:'Apr 10' },
  { id:16, type:'completed', title:'Social Butterfly', desc:'Tag 3 friends in check-ins', diff:'easy', xp:120, deadline:'Completed', tasks:['Tag friend 1','Tag friend 2','Tag friend 3'], progress:3, total:3, participants:8900, status:'completed', emoji:'🦋', completedDate:'Apr 22' },
  { id:17, type:'completed', title:'Coffee Lover', desc:'Visit 3 different cafés', diff:'easy', xp:100, deadline:'Completed', tasks:['Café 1','Café 2','Café 3'], progress:3, total:3, participants:12300, status:'completed', emoji:'☕', completedDate:'May 1' },
];

let currentTab = 'all';
let cardStates = {}; // track started/claimed per card

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.ctab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderAll();
}

function renderAll() {
  const tab = currentTab;
  const showFeatured = (tab === 'all' || tab === 'weekly');
  const showPatriot  = (tab === 'all' || tab === 'patriot');
  const showGroup    = (tab === 'all' || tab === 'group');
  const showCompleted= (tab === 'all' || tab === 'completed');

  document.getElementById('featuredSection').style.display = showFeatured ? '' : 'none';
  document.getElementById('patriotSection').style.display  = showPatriot  ? '' : 'none';
  document.getElementById('groupSection').style.display    = showGroup    ? '' : 'none';
  document.getElementById('completedSection').style.display= showCompleted ? '' : 'none';

  let list;
  if (tab === 'all') list = CHALLENGES.filter(c => c.type !== 'completed' && c.type !== 'patriot' && c.type !== 'group');
  else if (tab === 'completed') list = CHALLENGES.filter(c => c.type === 'completed');
  else list = CHALLENGES.filter(c => c.type === tab);

  document.getElementById('gridLabel').innerHTML = `<i class="fas fa-bolt"></i> ${tabLabel(tab)} <span class="section-count" id="gridCount">(${list.length})</span>`;
  document.getElementById('challengesGrid').innerHTML = list.length
    ? list.map(renderCard).join('')
    : `<div class="no-chal"><i class="fas fa-check-circle" style="font-size:2rem;opacity:.3;display:block;margin-bottom:12px"></i>No challenges in this category yet</div>`;

  if (showPatriot) {
    const patriot = CHALLENGES.filter(c => c.type === 'patriot');
    document.getElementById('patriotGrid').innerHTML = patriot.map(renderCard).join('');
  }
  if (showGroup) renderGroupCards();
  if (showCompleted) renderBadges();

  setTimeout(animateBars, 80);
}

function tabLabel(tab) {
  const labels = { all:'All Challenges', daily:'Daily Missions', weekly:'Weekly Challenges', city:'City Quests', business:'Business Missions', group:'Group Challenges', patriot:'Patriot Missions', completed:'Completed' };
  return labels[tab] || tab;
}

function renderCard(c) {
  const state = cardStates[c.id] || c.status;
  const prog = c.progress;
  const pct = Math.round((prog / c.total) * 100);
  const tasks = c.tasks.slice(0, 3).map((t, i) =>
    `<div class="ctask${i < prog ? ' done' : ''}"><i class="fas fa-${i < prog ? 'check-circle' : 'circle'}"></i>${t}</div>`
  ).join('');
  const moreCount = c.tasks.length - 3;

  const verifyBadges = c.requires
    ? c.requires.map(r => `<span class="vbadge ${r.toLowerCase()}"><i class="fas fa-${r==='GPS'?'map-marker-alt':r==='Camera'?'camera':'robot'}"></i>${r}</span>`).join('')
    : '';

  let btnHtml;
  if (c.type === 'completed') {
    btnHtml = state === 'claimed'
      ? `<button class="ccard-btn claimed" disabled><i class="fas fa-check"></i> Claimed</button>`
      : `<button class="ccard-btn claim" onclick="openClaim(${c.id})"><i class="fas fa-gift"></i> Claim Badge</button>`;
  } else if (state === 'inprogress') {
    btnHtml = `<button class="ccard-btn inprog" onclick="continueChallenge(${c.id})"><i class="fas fa-play"></i> Continue</button>`;
  } else if (state === 'started') {
    btnHtml = `<button class="ccard-btn inprog" onclick="continueChallenge(${c.id})"><i class="fas fa-play"></i> In Progress</button>`;
  } else {
    btnHtml = `<button class="ccard-btn start" onclick="startChallenge(${c.id})"><i class="fas fa-bolt"></i> Start</button>`;
  }

  const deadlineClass = c.deadline === 'Today' || c.deadline === '2 days' ? ' deadline-urgent' : '';

  return `<div class="ccard ${state==='inprogress'||state==='started'?'inprogress-card':state==='completed'?'completed-card':''}" id="ccard-${c.id}" style="position:relative">
    <div class="ccard-top">
      <div class="ccard-badges">
        <span class="type-badge ${c.type}">${c.type}</span>
        <span class="diff-badge ${c.diff}">${c.diff}</span>
      </div>
    </div>
    <div class="ccard-title">${c.title}</div>
    <div class="ccard-desc">${c.desc}</div>
    ${verifyBadges ? `<div class="verify-badges">${verifyBadges}</div>` : ''}
    <div class="ccard-xp"><i class="fas fa-coins"></i> +${c.xp} XP</div>
    <div class="ccard-tasks">${tasks}${moreCount > 0 ? `<div class="tasks-more">+${moreCount} more tasks</div>` : ''}</div>
    <div class="ccard-prog-bar"><div class="ccard-prog-fill ${c.type}" data-pct="${pct}" style="width:0"></div></div>
    <div class="ccard-prog-text"><span>${prog} of ${c.total} complete</span><span>${pct}%</span></div>
    <div class="ccard-bottom">
      <div class="ccard-participants"><i class="fas fa-users"></i> ${c.participants.toLocaleString()}</div>
      <div class="ccard-deadline${deadlineClass}"><i class="fas fa-clock"></i> ${c.deadline}</div>
      ${btnHtml}
    </div>
  </div>`;
}

function renderGroupCards() {
  const groups = CHALLENGES.filter(c => c.type === 'group');
  document.getElementById('groupGrid').innerHTML = groups.map(c => {
    const state = cardStates[c.id] || c.status;
    const pct = Math.round((c.progress / c.total) * 100);
    return `<div class="group-card">
      <div class="group-card-top">
        <div>
          <div class="group-card-title">${c.title}</div>
          <span class="diff-badge ${c.diff}" style="margin-top:4px;display:inline-block">${c.diff}</span>
        </div>
        <div class="ccard-xp"><i class="fas fa-coins"></i> +${c.xp} XP</div>
      </div>
      <div class="group-card-desc">${c.desc}</div>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="group-avatars">
          <div class="gavatar g1">AN</div>
          <div class="gavatar g2">GI</div>
          <div class="gavatar g3">MA</div>
          ${c.status==='inprogress' ? '<div class="gavatar g4">TE</div>' : '<div class="gavatar gavatar-more">+?</div>'}
        </div>
        <div class="group-bonus"><i class="fas fa-star"></i> +50 XP bonus per friend</div>
      </div>
      <div class="ccard-prog-bar"><div class="ccard-prog-fill group" data-pct="${pct}" style="width:0"></div></div>
      <div class="ccard-prog-text"><span>${c.progress} of ${c.total} tasks</span><span>${pct}%</span></div>
      <div class="group-actions">
        <button class="btn-invite" onclick="openInvite()"><i class="fas fa-user-plus"></i> Invite Friends</button>
        <button class="btn-join-group" onclick="startChallenge(${c.id})">
          ${state==='inprogress'||state==='started' ? '<i class="fas fa-play"></i> Continue' : '<i class="fas fa-bolt"></i> Join Group'}
        </button>
      </div>
    </div>`;
  }).join('');
}

function renderBadges() {
  const completed = CHALLENGES.filter(c => c.type === 'completed');
  const extra = [
    { emoji:'⭐', name:'Rising Star', date:'Mar 15', xp:'+80 XP' },
    { emoji:'📸', name:'Photo Pro', date:'Mar 28', xp:'+60 XP' },
    { emoji:'🏙️', name:'City Scout', date:'Apr 2', xp:'+150 XP' },
  ];
  const all = [...completed.map(c => ({ emoji: c.emoji, name: c.title, date: c.completedDate, xp: `+${c.xp} XP` })), ...extra];
  document.getElementById('badgesGrid').innerHTML = all.map(b => `
    <div class="badge-card">
      <div class="badge-emoji">${b.emoji}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-date">${b.date}</div>
      <div class="badge-xp">${b.xp}</div>
    </div>`).join('');
}

function startChallenge(id) {
  const ch = CHALLENGES.find(c => c.id === id);
  if (ch && ch.type === 'patriot') {
    location.href = 'camera.html?mode=patriot';
    return;
  }
  cardStates[id] = 'started';
  renderAll();
}

function continueChallenge(id) {
  const c = CHALLENGES.find(x => x.id === id);
  if (!c) return;
  if (c.type === 'patriot' || c.type === 'city') {
    window.location.href = 'places.html';
  } else {
    window.location.href = 'checkin.html';
  }
}

let currentClaimId = null;
function openClaim(id) {
  const c = CHALLENGES.find(x => x.id === id);
  if (!c) return;
  currentClaimId = id;
  document.getElementById('claimModalTitle').textContent = `${c.title} — Complete!`;
  document.getElementById('claimModalSub').textContent = c.desc;
  document.getElementById('claimModalIcon').textContent = c.emoji || '🎉';
  document.getElementById('claimModalRewards').innerHTML = `
    <div class="modal-reward-row"><div class="modal-reward-label"><i class="fas fa-coins"></i> XP Reward</div><div class="modal-reward-val">+${c.xp} XP</div></div>
    <div class="modal-reward-row"><div class="modal-reward-label"><i class="fas fa-award"></i> Badge</div><div class="modal-reward-val">${c.emoji || '🏅'} ${c.title}</div></div>
    <div class="modal-reward-row"><div class="modal-reward-label"><i class="fas fa-star"></i> Completed</div><div class="modal-reward-val">${c.completedDate || 'Today'}</div></div>`;
  document.getElementById('claimModal').classList.add('open');
}

function confirmClaim() {
  if (currentClaimId) cardStates[currentClaimId] = 'claimed';
  closeModal('claimModal');
  renderAll();
}

function openInvite() { document.getElementById('inviteModal').classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function handleOverlay(e, id) { if (e.target === e.currentTarget) closeModal(id); }

function inviteFriend(btn) {
  btn.textContent = 'Invited ✓';
  btn.classList.add('invited');
  btn.disabled = true;
}

function goCheckin() { window.location.href = 'checkin.html'; }

function animateBars() {
  document.querySelectorAll('.ccard-prog-fill[data-pct], .featured-prog-fill[data-pct]').forEach(bar => {
    const pct = parseFloat(bar.dataset.pct);
    if (bar.style.width !== pct + '%') {
      bar.style.width = '0';
      requestAnimationFrame(() => { setTimeout(() => { bar.style.width = pct + '%'; }, 50); });
    }
  });
}

renderAll();
setTimeout(() => { document.getElementById('featFill').style.width = '60%'; }, 200);
setTimeout(() => window.GeoHubSocial?.refresh?.(), 0);

(function () {
  try {
    var u = JSON.parse(localStorage.getItem('geohub_auth_user') || 'null');
    var name = (u && u.fullName) ? u.fullName.split(' ')[0] : (u && u.email ? u.email.split('@')[0] : null);
    if (name) {
      var el = document.getElementById('chalHeroTitle');
      if (el) el.innerHTML = 'Your Challenges,<br>' + name + '.';
    }
  } catch (e) {}
})();
