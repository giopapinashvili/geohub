let XP_BAL = 847; // demo default (Nino); overridden per-user below
let XP_LOG_DATA = null; // null = demo/XP_LOG; real user branch sets this

const REWARDS = [
  { id:1, biz:'Entree Coffee',       cat:'coffee',   cost:300,  discount:'20% Off', title:'Any Order Discount',       expires:'Jun 30, 2026', code:'ENTREE20',  saved:false },
  { id:2, biz:'Rooms Hotel Kazbegi', cat:'hotel',    cost:900,  discount:'15% Off', title:'Room Booking Discount',    expires:'Jul 15, 2026', code:'ROOMS15K',  saved:true  },
  { id:3, biz:'Tbilisi Jazz Festival',cat:'event',   cost:1200, discount:'Free',    title:'Ticket Draw Entry',        expires:'May 25, 2026', code:'JAZZ2026',  saved:false },
  { id:4, biz:'Mountain Gear Georgia',cat:'activity', cost:700,  discount:'25 GEL',  title:'Off Any Purchase',         expires:'Aug 1, 2026',  code:'MGG25GEL',  saved:false },
  { id:5, biz:'Shavi Lomi Restaurant',cat:'food',    cost:500,  discount:'10% Off', title:'Dinner for Two',           expires:'Jun 15, 2026', code:'SHAVI10',   saved:false },
  { id:6, biz:'Kakheti Wine Tour',   cat:'activity', cost:1500, discount:'Free',    title:'Wine Tasting Session',     expires:'Sep 1, 2026',  code:'WINE-FREE', saved:true  },
  { id:7, biz:'Narikala Yoga Studio',cat:'activity', cost:400,  discount:'3 Classes','title':'Free Trial Pass',       expires:'Jul 1, 2026',  code:'YOGA3FREE', saved:false },
  { id:8, biz:'Fabrika Hostel',      cat:'hotel',    cost:600,  discount:'1 Night', title:'Free Weekday Stay',        expires:'Aug 15, 2026', code:'FABRIKA1N', saved:false },
];

const XP_LOG = [
  { action:'Check-in at Fabrika Tbilisi', icon:'map-marker-alt', xp:+85,  time:'2h ago',  type:'checkin'  },
  { action:'Review: Rooms Hotel Kazbegi',  icon:'star',           xp:+30,  time:'1d ago',  type:'review'   },
  { action:'Challenge: 5 New Places',      icon:'trophy',         xp:+150, time:'2d ago',  type:'challenge'},
  { action:'Friend invited: Ana Beridze',  icon:'user-plus',      xp:+50,  time:'3d ago',  type:'social'   },
  { action:'Claimed: Entree Coffee 20%',   icon:'ticket-alt',     xp:-300, time:'5d ago',  type:'claim'    },
  { action:'Photo upload at Mtatsminda',   icon:'camera',         xp:+15,  time:'5d ago',  type:'photo'    },
  { action:'Daily streak bonus ×12',       icon:'fire',           xp:+20,  time:'6d ago',  type:'streak'   },
  { action:'Discovered: Signagi Old Town', icon:'compass',        xp:+40,  time:'1w ago',  type:'discover' },
];

let currentFilter = 'all';
let saved = new Set(REWARDS.filter(r => r.saved).map(r => r.id));

function filterRewards(cat) {
  currentFilter = cat;
  document.querySelectorAll('.rfilt').forEach(b => b.classList.toggle('active', b.dataset.filter === cat));
  renderRewards();
}

function renderRewards() {
  const grid = document.getElementById('rewardsGrid');
  let list = REWARDS;
  if (currentFilter === 'saved') list = REWARDS.filter(r => saved.has(r.id));
  else if (currentFilter !== 'all') list = REWARDS.filter(r => r.cat === currentFilter);

  if (!list.length) {
    grid.innerHTML = '<div class="no-results"><i class="fas fa-search" style="font-size:1.5rem;margin-bottom:10px;display:block;opacity:0.3"></i>No rewards in this category yet</div>';
    return;
  }

  grid.innerHTML = list.map(r => {
    const can = XP_BAL >= r.cost;
    const isSaved = saved.has(r.id);
    return `<div class="reward-card${isSaved ? ' is-saved' : ''}">
      <div class="reward-card-top">
        <span class="cat-badge ${r.cat}">${r.cat}</span>
        <button class="save-btn${isSaved ? ' saved' : ''}" onclick="toggleSave(${r.id})" title="${isSaved ? 'Unsave' : 'Save'}">
          <i class="fas fa-bookmark"></i>
        </button>
      </div>
      <div class="reward-biz">${r.biz}</div>
      <div class="reward-title">${r.title}</div>
      <div class="reward-discount">${r.discount}</div>
      <div class="reward-cost">
        <span class="cost-pill ${can ? 'affordable' : 'locked'}"><i class="fas fa-coins"></i> ${r.cost.toLocaleString()} XP</span>
        ${!can ? `<span class="need-more">need ${(r.cost - XP_BAL).toLocaleString()} more</span>` : ''}
      </div>
      <div class="reward-expiry"><i class="fas fa-clock"></i> Expires ${r.expires}</div>
      <button class="reward-claim-btn ${can ? 'can-claim' : 'locked-btn'}"
        ${can ? `onclick="openClaim(${r.id})"` : 'disabled'}>
        ${can ? '<i class="fas fa-qrcode"></i> Claim Reward' : '<i class="fas fa-lock"></i> Not Enough XP'}
      </button>
    </div>`;
  }).join('');
}

function toggleSave(id) {
  saved.has(id) ? saved.delete(id) : saved.add(id);
  document.getElementById('savedCountDisplay').textContent = saved.size;
  renderRewards();
}

function openClaim(id) {
  const r = REWARDS.find(x => x.id === id);
  if (!r) return;
  document.getElementById('mBiz').textContent = r.biz;
  document.getElementById('mTitle').textContent = r.title;
  document.getElementById('mCost').innerHTML = `<i class="fas fa-coins"></i> -${r.cost} XP`;
  document.getElementById('mCode').textContent = r.code;
  document.getElementById('mNote').innerHTML = `Show this QR or enter code at <strong>${r.biz}</strong>.<br>Valid until ${r.expires}. Single use only.`;
  const btn = document.getElementById('copyBtn');
  btn.innerHTML = '<i class="fas fa-copy"></i> Copy Code';
  btn.className = 'code-copy-btn';
  document.getElementById('claimModal').classList.add('open');
}

function closeModal() { document.getElementById('claimModal').classList.remove('open'); }
function handleModalClick(e) { if (e.target === e.currentTarget) closeModal(); }

function copyModalCode() {
  const code = document.getElementById('mCode').textContent;
  navigator.clipboard.writeText(code).catch(() => {});
  const btn = document.getElementById('copyBtn');
  btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
  btn.classList.add('copied');
  setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copy Code'; btn.classList.remove('copied'); }, 2000);
}

function copyCode(btn, code) {
  navigator.clipboard.writeText(code).catch(() => {});
  const orig = btn.textContent;
  btn.textContent = 'Copied!';
  btn.style.cssText = 'border-color:var(--green);color:var(--green)';
  setTimeout(() => { btn.textContent = orig; btn.style.cssText = ''; }, 2000);
}

function renderXP() {
  const log = XP_LOG_DATA !== null ? XP_LOG_DATA : XP_LOG;
  document.getElementById('xpGrid').innerHTML = log.map(h => `
    <div class="xp-item">
      <div class="xp-icon ${h.type}"><i class="fas fa-${h.icon}"></i></div>
      <div class="xp-info">
        <div class="xp-action">${h.action}</div>
        <div class="xp-time">${h.time}</div>
      </div>
      <div class="xp-amount ${h.xp > 0 ? 'gain' : 'spend'}">${h.xp > 0 ? '+' : ''}${h.xp} XP</div>
    </div>`).join('');
}

function animateBalance() {
  const el = document.getElementById('balanceDisplay');
  const target = XP_BAL;
  let current = 0;
  const step = Math.ceil(target / 50);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current.toLocaleString();
    if (current >= target) clearInterval(timer);
  }, 18);
}

function animateBars() {
  document.querySelectorAll('.chal-fill').forEach(bar => {
    const pct = bar.dataset.pct;
    bar.style.width = '0';
    setTimeout(() => { bar.style.width = pct + '%'; }, 200);
  });
}

// Real user mode: use actual XP, empty history
if (window.GeoMode && window.GeoMode.isRealUser()) {
  const _u = window.GeoMode.getCurrentUser();
  XP_BAL = (_u.xp != null) ? _u.xp : 250;
  XP_LOG_DATA = [
    { action: 'Created GeoHub account', icon: 'user-plus', xp: +XP_BAL, time: 'Today', type: 'social' }
  ];
  // Update the hardcoded balance-sub text
  const balSub = document.querySelector('.balance-sub');
  if (balSub) balSub.innerHTML = `of <strong>${XP_BAL}</strong> total earned &nbsp;·&nbsp; <strong>0</strong> spent on rewards`;
}

renderRewards();
renderXP();
animateBalance();
setTimeout(animateBars, 150);
  window.GeoHubSocial?.refresh?.();
