/* ================================================================
   GeoHub — Trust, Verification & Safety System
   ================================================================ */

// ======================== DATA ========================
(function () {
  var _u = null;
  try { var v = localStorage.getItem('geohub_auth_user'); _u = v ? JSON.parse(v) : null; } catch (e) {}
  var _score = (_u && _u.trustScore) ? _u.trustScore : 0;
  window._MY_TRUST_SCORE = _score;
})();

const MY_TRUST = {
  score: window._MY_TRUST_SCORE || 0, maxScore: 1000,
  level: 'Unverified', levelIndex: 0,
  nextLevel: 'Basic Verified', nextLevelMin: 0, nextLevelMax: 300,
  breakdown: [
    { label: 'Real Check-ins',  icon: 'fas fa-map-marker-alt', color: '#10b981', score: 0, max: 300, desc: 'No check-ins yet' },
    { label: 'Review Quality',  icon: 'fas fa-star',           color: '#f59e0b', score: 0, max: 250, desc: 'No reviews yet' },
    { label: 'Camera Proofs',   icon: 'fas fa-camera',         color: '#3b82f6', score: 0, max: 250, desc: 'No camera proofs yet' },
    { label: 'Community Trust', icon: 'fas fa-users',          color: '#a78bfa', score: 0, max: 150, desc: 'No community votes yet' },
    { label: 'Safety Record',   icon: 'fas fa-shield-alt',     color: '#22c55e', score: 0, max: 50,  desc: 'Clean record' },
  ],
  badges: [
    { label: 'Email Verified', icon: 'fas fa-envelope', color: '#3b82f6' },
  ],
};

const VERIFICATION_LEVELS = [
  {
    index: 0, name: 'Unverified', icon: 'fas fa-user', color: '#64748b', range: '0–100',
    requirements: ['Create a GeoHub account'],
    benefits: ['Browse listings', 'Save to wishlist'],
    done: true, current: false, locked: false,
  },
  {
    index: 1, name: 'Basic Verified', icon: 'fas fa-check-circle', color: '#3b82f6', range: '101–300',
    requirements: ['Verify email address', 'Add phone number', 'Complete your profile (80%)'],
    benefits: ['Write reviews', 'Add check-ins', 'Message businesses', 'Join events'],
    done: true, current: false, locked: false,
  },
  {
    index: 2, name: 'Camera Proof', icon: 'fas fa-camera', color: '#22c55e', range: '301–500',
    requirements: ['5+ camera-verified check-ins', 'GPS + timestamp embedded', 'AI image match passed'],
    benefits: ['Camera Proof badge on reviews', 'Higher review weight in rankings', 'Creator eligibility'],
    done: true, current: false, locked: false,
  },
  {
    index: 3, name: 'Trusted Explorer', icon: 'fas fa-shield-alt', color: '#10b981', range: '501–800',
    requirements: ['30+ real check-ins', '10+ quality reviews', '3+ camera proofs', 'No active warnings'],
    benefits: ['Trusted badge on profile', 'Priority in search results', 'Full business contact access', 'Event organizer tools'],
    done: false, current: true, locked: false,
  },
  {
    index: 4, name: 'Community Trusted', icon: 'fas fa-users', color: '#f59e0b', range: '801–950',
    requirements: ['15+ community votes from other members', '6+ months active', '50+ check-ins', 'Zero dispute record'],
    benefits: ['Gold trust badge', 'Content moderation access', 'Creator sponsorship access', 'Featured profile slot'],
    done: false, current: false, locked: true,
  },
  {
    index: 5, name: 'Business Verified', icon: 'fas fa-building', color: '#a78bfa', range: '901–1000',
    requirements: ['Business registration document', 'Physical location GPS-verified', 'QR partner kit installed', 'GeoHub team review passed'],
    benefits: ['Business Verified badge', 'Full analytics dashboard', 'Priority listing placement', 'GeoHub API access'],
    done: false, current: false, locked: true,
  },
];

const REPORT_TYPES = [
  { id: 'fake_review',  label: 'Fake Review',        icon: 'fas fa-star',               color: '#f59e0b', desc: 'Fabricated, paid or incentivised review' },
  { id: 'fake_checkin', label: 'Fake Check-in',       icon: 'fas fa-map-marker-alt',     color: '#10b981', desc: 'Check-in submitted without physical presence' },
  { id: 'scam_biz',     label: 'Scam Business',       icon: 'fas fa-store-slash',        color: '#ef4444', desc: 'Business that deceives or defrauds customers' },
  { id: 'bad_behavior', label: 'Bad Behavior',         icon: 'fas fa-exclamation-circle', color: '#f97316', desc: 'Harassment, hate speech or unsafe conduct' },
  { id: 'unsafe_event', label: 'Unsafe Event',         icon: 'fas fa-calendar-times',    color: '#ef4444', desc: 'Event with safety risks or misleading info' },
  { id: 'fake_offer',   label: 'Fake Creator Offer',  icon: 'fas fa-handshake-slash',    color: '#a78bfa', desc: 'Fraudulent brand collaboration offer' },
];

const SAFETY_STATS = {
  reviewed: 1247, removed: 89, flagged: 34,
  trusted: 4821, resolution: '94%', avgTime: '4.2h',
};

const MOCK_REPORT_FEED = [];

const CREDIBILITY_INDICATORS = [
  { icon: 'fas fa-camera',       color: '#3b82f6', label: 'Camera Proof',      desc: 'Photo taken in-app with GPS + timestamp during visit' },
  { icon: 'fas fa-redo',         color: '#10b981', label: 'Repeat Customer',   desc: 'Reviewer has visited this place 3+ times' },
  { icon: 'fas fa-shield-alt',   color: '#a78bfa', label: 'Trusted Reviewer',  desc: 'Account has Trusted Explorer level or above' },
  { icon: 'fas fa-qrcode',       color: '#f59e0b', label: 'QR Check-in',       desc: 'Physically scanned the business QR on location' },
  { icon: 'fas fa-map-marker-alt', color: '#22c55e', label: 'Verified Visit',  desc: 'GPS coordinates match business location within 50m' },
  { icon: 'fas fa-exclamation-triangle', color: '#ef4444', label: 'Suspicious Pattern', desc: 'Unusual posting frequency or location mismatch detected' },
];

// ======================== STATE ========================
let selectedReportType = null;
let myReports    = window.safeStorage.get('gh_my_reports',   []);
let dismissedW   = window.safeStorage.get('gh_dismissed_w', []);

// ======================== TABS ========================
function switchTrustTab(tab, el) {
  document.querySelectorAll('.trust-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.trust-tab-panel').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('tp-' + tab)?.classList.add('active');
}

// ======================== OVERVIEW ========================
function renderOverview() {
  const pct = MY_TRUST.score / MY_TRUST.maxScore;
  const deg = (pct * 360).toFixed(1);

  const ringEl = document.getElementById('trustRing');
  if (ringEl) ringEl.style.background = `conic-gradient(#10b981 0deg ${deg}deg, #0d1525 ${deg}deg)`;

  const nextPct = Math.min(100, Math.round(
    (MY_TRUST.score - MY_TRUST.nextLevelMin) / (MY_TRUST.nextLevelMax - MY_TRUST.nextLevelMin) * 100
  ));
  setTimeout(() => {
    const bar = document.getElementById('nextLevelBar');
    if (bar) bar.style.width = nextPct + '%';
  }, 400);

  const breakdownEl = document.getElementById('trustBreakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = MY_TRUST.breakdown.map(item => {
      const p = Math.min(100, Math.round(item.score / item.max * 100));
      return `
        <div class="bd-item">
          <div class="bd-header">
            <span class="bd-label"><i class="${item.icon}" style="color:${item.color}"></i> ${item.label}</span>
            <span class="bd-score">${item.score}<span class="bd-max">/${item.max}</span></span>
          </div>
          <div class="bd-track"><div class="bd-bar" data-pct="${p}" style="background:${item.color};width:0%"></div></div>
          <div class="bd-desc">${item.desc}</div>
        </div>`;
    }).join('');
    setTimeout(() => document.querySelectorAll('.bd-bar').forEach(b => { b.style.width = b.dataset.pct + '%'; }), 400);
  }

  const badgesEl = document.getElementById('trustBadges');
  if (badgesEl) {
    badgesEl.innerHTML = MY_TRUST.badges.map(b => `
      <div class="tbadge-pill" style="--bc:${b.color}">
        <i class="${b.icon}"></i> ${b.label}
      </div>`).join('');
  }

  const credEl = document.getElementById('credibilityList');
  if (credEl) {
    credEl.innerHTML = CREDIBILITY_INDICATORS.map(ci => `
      <div class="cred-item">
        <div class="cred-icon" style="color:${ci.color};background:${ci.color}18"><i class="${ci.icon}"></i></div>
        <div>
          <div class="cred-label">${ci.label}</div>
          <div class="cred-desc">${ci.desc}</div>
        </div>
      </div>`).join('');
  }
}

// ======================== LEVELS ========================
function renderLevels() {
  const el = document.getElementById('levelsGrid');
  if (!el) return;
  el.innerHTML = VERIFICATION_LEVELS.map(lv => `
    <div class="lv-card ${lv.current ? 'lv-current' : ''} ${lv.done && !lv.current ? 'lv-done' : ''} ${lv.locked ? 'lv-locked' : ''}">
      <div class="lv-header">
        <div class="lv-icon" style="background:${lv.color}18;border-color:${lv.color}35;color:${lv.color}">
          <i class="${lv.icon}"></i>
        </div>
        <div>
          <div class="lv-name">${lv.name}</div>
          <div class="lv-range">${lv.range} pts</div>
        </div>
        ${lv.current ? '<span class="lv-badge lv-badge-current">Your Level</span>' : ''}
        ${lv.done && !lv.current ? '<span class="lv-badge lv-badge-done"><i class="fas fa-check"></i> Achieved</span>' : ''}
        ${lv.locked ? '<span class="lv-badge lv-badge-locked"><i class="fas fa-lock"></i></span>' : ''}
      </div>
      <div class="lv-section-title">Requirements</div>
      <div class="lv-reqs">
        ${lv.requirements.map(r => `
          <div class="lv-req ${lv.done || lv.current ? 'req-done' : ''}">
            <i class="fas fa-${lv.done || lv.current ? 'check-circle' : 'circle'}"></i>${r}
          </div>`).join('')}
      </div>
      <div class="lv-section-title">Benefits</div>
      <div class="lv-benefits">
        ${lv.benefits.map(b => `<div class="lv-benefit"><i class="fas fa-arrow-right"></i>${b}</div>`).join('')}
      </div>
    </div>`).join('');
}

// ======================== REPORT SYSTEM ========================
function renderReportTypes() {
  const el = document.getElementById('reportTypes');
  if (!el) return;
  el.innerHTML = REPORT_TYPES.map(rt => `
    <div class="rt-card ${selectedReportType === rt.id ? 'rt-selected' : ''}" onclick="selectReportType('${rt.id}')">
      <div class="rt-icon" style="color:${rt.color};background:${rt.color}18"><i class="${rt.icon}"></i></div>
      <div class="rt-info">
        <div class="rt-label">${rt.label}</div>
        <div class="rt-desc">${rt.desc}</div>
      </div>
      <div class="rt-check"><i class="fas fa-check"></i></div>
    </div>`).join('');
}

function selectReportType(id) {
  selectedReportType = id;
  document.querySelectorAll('.rt-card').forEach(c => c.classList.remove('rt-selected'));
  document.querySelector(`.rt-card[onclick*="${id}"]`)?.classList.add('rt-selected');
  document.getElementById('reportFormSection')?.classList.remove('hidden');
  document.getElementById('reportTypeError')?.classList.add('hidden');
}

function submitReport() {
  if (!selectedReportType) {
    document.getElementById('reportTypeError')?.classList.remove('hidden');
    return;
  }
  const target = document.getElementById('reportTarget')?.value.trim() || '';
  const desc   = document.getElementById('reportDesc')?.value.trim()   || '';
  if (!desc) {
    const e = document.getElementById('reportDescError');
    if (e) { e.textContent = 'Please describe the issue.'; e.classList.remove('hidden'); }
    return;
  }
  myReports.unshift({ id: 'r_' + Date.now(), type: selectedReportType, target: target || 'Unknown', description: desc, ts: Date.now(), status: 'pending' });
  window.safeStorage.set('gh_my_reports', myReports);

  document.getElementById('reportFormWrap')?.classList.add('hidden');
  document.getElementById('reportSuccess')?.classList.remove('hidden');
  renderSafety();
}

function resetReport() {
  selectedReportType = null;
  document.getElementById('reportFormWrap')?.classList.remove('hidden');
  document.getElementById('reportSuccess')?.classList.add('hidden');
  document.getElementById('reportFormSection')?.classList.add('hidden');
  const t = document.getElementById('reportTarget'); if (t) t.value = '';
  const d = document.getElementById('reportDesc');   if (d) d.value = '';
  renderReportTypes();
}

// ======================== SAFETY DASHBOARD ========================
function renderSafety() {
  const statsEl = document.getElementById('safetyStats');
  if (statsEl) {
    const s = SAFETY_STATS;
    const cards = [
      { label: 'Reports Reviewed',     val: s.reviewed.toLocaleString(), icon: 'fas fa-clipboard-check', c: '#3b82f6' },
      { label: 'Fake Reviews Removed', val: s.removed,                   icon: 'fas fa-trash-alt',       c: '#ef4444' },
      { label: 'Content Flagged',      val: s.flagged,                   icon: 'fas fa-flag',            c: '#f97316' },
      { label: 'Trusted Users',        val: s.trusted.toLocaleString(),  icon: 'fas fa-shield-alt',      c: '#10b981' },
      { label: 'Resolution Rate',      val: s.resolution,                icon: 'fas fa-chart-pie',       c: '#a78bfa' },
      { label: 'Avg Response Time',    val: s.avgTime,                   icon: 'fas fa-clock',           c: '#f59e0b' },
    ];
    statsEl.innerHTML = cards.map(c => `
      <div class="ss-card">
        <div class="ss-icon" style="color:${c.c}"><i class="${c.icon}"></i></div>
        <div class="ss-val">${c.val}</div>
        <div class="ss-lbl">${c.label}</div>
      </div>`).join('');
  }

  const feedEl = document.getElementById('safetyFeed');
  if (feedEl) {
    const STATUS = { resolved: ['badge-green','Resolved'], under_review: ['badge-gold','Under Review'], dismissed: ['badge-gray','Dismissed'], pending: ['badge-blue','Pending'] };
    const all = [...MOCK_REPORT_FEED, ...myReports.slice(0, 4)].sort((a, b) => b.ts - a.ts).slice(0, 10);
    feedEl.innerHTML = all.map(r => {
      const rt = REPORT_TYPES.find(t => t.id === r.type) || { label: r.type, icon: 'fas fa-flag', color: '#64748b' };
      const [badgeCls, badgeLbl] = STATUS[r.status] || ['badge-gray', r.status];
      const d = new Date(r.ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `
        <div class="sf-item">
          <div class="sf-icon" style="color:${rt.color};background:${rt.color}15"><i class="${rt.icon}"></i></div>
          <div class="sf-info">
            <div class="sf-type">${rt.label}</div>
            <div class="sf-target">${r.target}</div>
          </div>
          <div class="sf-meta">
            <span class="sf-badge ${badgeCls}">${badgeLbl}</span>
            <span class="sf-date">${d}</span>
          </div>
        </div>`;
    }).join('') || '<div class="sf-empty">No reports filed yet.</div>';
  }
}

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => {
  renderOverview();
  renderLevels();
  renderReportTypes();
  renderSafety();

  const url = new URLSearchParams(window.location.search);
  if (url.get('report')) {
    const type = url.get('report');
    const target = url.get('target') || '';
    switchTrustTab('report', document.querySelector('.trust-tab[data-tab="report"]'));
    if (type) setTimeout(() => selectReportType(type), 100);
    if (target) setTimeout(() => { const el = document.getElementById('reportTarget'); if (el) el.value = target; }, 150);
  }
});
