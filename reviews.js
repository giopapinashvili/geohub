/* ================================================================
   GeoHub — Reviews 2.0 / Reputation System
   reviews.js
   ================================================================ */
(function () {
  'use strict';

  /* ── SEED DATA ───────────────────────────────────────────── */
  const TYPE_META = {
    place:      { icon: '📍', label: 'Place',      color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    business:   { icon: '🏢', label: 'Business',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    event:      { icon: '🎭', label: 'Event',       color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
    teacher:    { icon: '👩‍🏫', label: 'Teacher',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    service:    { icon: '🔧', label: 'Service',     color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
    realestate: { icon: '🏠', label: 'Real Estate', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)'  },
    creator:    { icon: '🎬', label: 'Creator',     color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  };

  const SEED_REVIEWS = [
    {
      id: 'r1', type: 'place', subject: 'Mtatsminda Park', subjectSub: 'Tbilisi · Park & Viewpoint',
      reviewer: 'Nino Kvaratskhelia', av: 'NK', avColor: '#10b981', trust: 94, reviewCount: 52,
      rating: 5, text: 'Absolutely stunning panoramic views of Tbilisi at sunset. The cable car ride is an experience in itself, and the park grounds are well-maintained with great photo spots. Perfect for families or date nights.',
      tags: ['Great Views', 'Family Friendly', 'Must Visit'], recommend: true,
      verified: true, cameraProof: true, featured: true, photos: 3,
      helpful: 84, date: 'May 8, 2026', reply: { name: 'Mtatsminda Park Admin', text: 'Thank you Nino! We\'re so glad you enjoyed the views. We\'ve recently improved the cable car schedule — hope to see you again soon!' },
      suspicious: false, repeatCustomer: false,
    },
    {
      id: 'r2', type: 'business', subject: 'Fabrika Café & Co-work', subjectSub: 'Tbilisi · Café & Co-working',
      reviewer: 'Giorgi Beridze', av: 'GB', avColor: '#3b82f6', trust: 88, reviewCount: 31,
      rating: 4, text: 'Great atmosphere for working remotely. Fast WiFi, excellent specialty coffee. Gets crowded on weekends but weekday mornings are perfect. The baristas are knowledgeable about their beans.',
      tags: ['Good WiFi', 'Great Coffee', 'Hidden Gem'], recommend: true,
      verified: true, cameraProof: false, featured: false, photos: 2,
      helpful: 47, date: 'May 6, 2026', reply: null,
      suspicious: false, repeatCustomer: true,
    },
    {
      id: 'r3', type: 'event', subject: 'Tbilisi Jazz Festival', subjectSub: 'Rike Park · Annual Music Event',
      reviewer: 'Tamar Lomidze', av: 'TL', avColor: '#a855f7', trust: 82, reviewCount: 28,
      rating: 5, text: 'One of the best events I\'ve attended in Tbilisi. The lineup was world-class, the outdoor setting at Rike Park was magical, and the organization was flawless. Already looking forward to next year.',
      tags: ['Amazing Lineup', 'Great Atmosphere', 'Well Organized'], recommend: true,
      verified: true, cameraProof: true, featured: false, photos: 4,
      helpful: 63, date: 'May 4, 2026', reply: null,
      suspicious: false, repeatCustomer: false,
    },
    {
      id: 'r4', type: 'teacher', subject: 'Mariam Jgerenaia — Georgian Language', subjectSub: 'Private Tutor · Tbilisi',
      reviewer: 'Alex Turner', av: 'AT', avColor: '#f59e0b', trust: 71, reviewCount: 12,
      rating: 5, text: 'Mariam is an exceptional Georgian language teacher. She\'s patient, creative with teaching methods, and genuinely invested in her students\' progress. I went from zero to conversational in 6 weeks.',
      tags: ['Patient', 'Effective', 'Highly Recommend'], recommend: true,
      verified: true, cameraProof: false, featured: false, photos: 0,
      helpful: 38, date: 'May 2, 2026', reply: { name: 'Mariam Jgerenaia', text: 'Thank you Alex! It was a pleasure teaching you. Your dedication made all the difference. Გამარჯობა to all! 🇬🇪' },
      suspicious: false, repeatCustomer: false,
    },
    {
      id: 'r5', type: 'service', subject: 'Vake Auto Service', subjectSub: 'Vake · Car Repair & Maintenance',
      reviewer: 'Luka Tabatadze', av: 'LT', avColor: '#f97316', trust: 76, reviewCount: 19,
      rating: 2, text: 'Took my car in for a simple oil change and they kept it for 3 days without notification. Communication was poor, price was higher than quoted. Would not return.',
      tags: ['Poor Communication', 'Overpriced'], recommend: false,
      verified: true, cameraProof: false, featured: false, photos: 0,
      helpful: 22, date: 'Apr 30, 2026', reply: { name: 'Vake Auto Service', text: 'We apologize for the delays and communication issues. We\'ve since improved our notification system. Please contact us directly — we\'d like to offer a complimentary service.' },
      suspicious: false, repeatCustomer: false,
    },
    {
      id: 'r6', type: 'realestate', subject: 'Nika Chikvatia — Real Estate', subjectSub: 'GeoHub Agent · Tbilisi',
      reviewer: 'Salome Kirtadze', av: 'SK', avColor: '#06b6d4', trust: 79, reviewCount: 7,
      rating: 5, text: 'Nika helped us find our dream apartment in Vera in just 2 weeks. He was honest about pricing, responsive 24/7, and handled all the paperwork smoothly. Exceptional agent — will use again.',
      tags: ['Honest', 'Responsive', 'Professional'], recommend: true,
      verified: true, cameraProof: false, featured: false, photos: 1,
      helpful: 31, date: 'Apr 27, 2026', reply: null,
      suspicious: false, repeatCustomer: false,
    },
    {
      id: 'r7', type: 'creator', subject: 'TbilisiEats (Creator)', subjectSub: 'Food & Travel Creator · GeoHub',
      reviewer: 'Dachi Maisuradze', av: 'DM', avColor: '#ec4899', trust: 68, reviewCount: 9,
      rating: 4, text: 'Collaborated on a restaurant review series. Very professional, creative concepts, delivered on time. The branded content performed really well. Would collaborate again.',
      tags: ['Professional', 'Creative', 'Good ROI'], recommend: true,
      verified: false, cameraProof: true, featured: false, photos: 2,
      helpful: 14, date: 'Apr 24, 2026', reply: null,
      suspicious: false, repeatCustomer: false,
    },
    {
      id: 'r8', type: 'place', subject: 'Narikala Fortress', subjectSub: 'Old Tbilisi · Historical Site',
      reviewer: 'Unknown User #443', av: '??', avColor: '#4b5563', trust: 22, reviewCount: 2,
      rating: 5, text: 'Best place ever!!!! Amazing incredible wow must go!!!',
      tags: [], recommend: true,
      verified: false, cameraProof: false, featured: false, photos: 0,
      helpful: 2, date: 'Apr 20, 2026', reply: null,
      suspicious: true, repeatCustomer: false,
    },
  ];

  const TOP_REVIEWERS = [
    { name: 'Nino Kvaratskhelia', av: 'NK', color: '#10b981', count: 52, score: 94 },
    { name: 'Giorgi Beridze',     av: 'GB', color: '#3b82f6', count: 31, score: 88 },
    { name: 'Tamar Lomidze',      av: 'TL', color: '#a855f7', count: 28, score: 82 },
    { name: 'Luka Tabatadze',     av: 'LT', color: '#f97316', count: 19, score: 76 },
    { name: 'You (Gio P.)',        av: 'GP', color: '#f59e0b', count: 28, score: 92 },
  ];

  const CAT_BREAKDOWN = [
    { label: 'Places',      key: 'place',      count: 6120, pct: 82 },
    { label: 'Business',    key: 'business',   count: 4340, pct: 58 },
    { label: 'Events',      key: 'event',      count: 2100, pct: 28 },
    { label: 'Teachers',    key: 'teacher',    count: 940,  pct: 13 },
    { label: 'Services',    key: 'service',    count: 780,  pct: 10 },
    { label: 'Real Estate', key: 'realestate', count: 340,  pct: 5  },
    { label: 'Creators',    key: 'creator',    count: 200,  pct: 3  },
  ];

  const RATING_DIST = [
    { stars: 5, pct: 62 },
    { stars: 4, pct: 22 },
    { stars: 3, pct: 9  },
    { stars: 2, pct: 4  },
    { stars: 1, pct: 3  },
  ];

  /* ── STATE ───────────────────────────────────────────────── */
  let writeType     = 'place';
  let writeStar     = 0;
  let proofAttached = false;
  let selectedTags  = [];
  let activeFilter  = 'all';
  let activeCat     = 'all';
  let visibleCount  = 5;
  let allReviews    = [];

  /* ── INIT ────────────────────────────────────────────────── */
  function init() {
    loadReviews();
    renderFeed();
    renderTopReviewers();
    renderCatBreakdown();
    renderRatingBars();
    updateCatCounts();
  }

  /* ── LOAD ────────────────────────────────────────────────── */
  function loadReviews() {
    let local = [];
    try { local = JSON.parse(localStorage.getItem('geohub_reviews')) || []; } catch (_) {}
    allReviews = [...local, ...SEED_REVIEWS];
  }

  /* ── RENDER FEED ─────────────────────────────────────────── */
  function renderFeed() {
    const feed   = document.getElementById('reviewFeed');
    const btn    = document.getElementById('loadMoreBtn');
    const count  = document.getElementById('feedCount');
    if (!feed) return;

    let filtered = allReviews.filter(r => {
      if (activeCat !== 'all' && r.type !== activeCat) return false;
      if (activeFilter === 'verified' && !r.verified) return false;
      if (activeFilter === 'camera'   && !r.cameraProof) return false;
      if (activeFilter === 'high'     && r.rating < 4) return false;
      if (activeFilter === 'low'      && r.rating > 2) return false;
      return true;
    });

    if (activeFilter === 'recent') {
      filtered = [...filtered].reverse();
    }

    if (count) count.textContent = filtered.length + ' reviews';

    const slice = filtered.slice(0, visibleCount);
    feed.innerHTML = slice.length ? slice.map(buildCard).join('') : `<div class="rv-empty"><i class="fas fa-star-half-alt"></i><p>No reviews match this filter</p></div>`;

    if (btn) btn.style.display = filtered.length > visibleCount ? 'block' : 'none';

    feed.querySelectorAll('.pm-prog-fill, .rv-rbar-fill, .rv-cat-fill').forEach(el => {
      el.style.width = (el.dataset.pct || 0) + '%';
    });
  }

  /* ── BUILD CARD ──────────────────────────────────────────── */
  function buildCard(r) {
    const tm = TYPE_META[r.type] || TYPE_META.place;
    const stars = [1,2,3,4,5].map(i => `<span class="rv-star${i > r.rating ? ' empty' : ''}"><i class="fas fa-star"></i></span>`).join('');

    const badges = [
      r.verified     ? `<span class="rv-badge verified"><i class="fas fa-check-circle"></i>Verified Visit</span>` : '',
      r.cameraProof  ? `<span class="rv-badge camera"><i class="fas fa-camera"></i>Camera Proof</span>`   : '',
      r.featured     ? `<span class="rv-badge top"><i class="fas fa-medal"></i>Top Review</span>`          : '',
      r.repeatCustomer ? `<span class="rv-badge repeat"><i class="fas fa-redo"></i>Repeat</span>`          : '',
    ].filter(Boolean).join('');

    const photosHTML = r.photos > 0 ? `<div class="rv-photos">
      ${Array(r.photos).fill(0).map((_, i) => `<div class="rv-photo-thumb">
        <i class="fas fa-image"></i>
        ${r.cameraProof ? '<div class="rv-photo-camera"><i class="fas fa-camera"></i></div>' : ''}
      </div>`).join('')}
    </div>` : '';

    const tagsHTML = r.tags.length ? `<div class="rv-tags">${r.tags.map(t => `<span class="rv-tag">${t}</span>`).join('')}</div>` : '';

    const replyHTML = r.reply ? `<div class="rv-owner-reply">
      <div class="rv-reply-header">
        <div class="rv-reply-av">${r.reply.name[0]}</div>
        <span class="rv-reply-name">${r.reply.name}</span>
        <span class="rv-reply-badge">Owner Reply</span>
      </div>
      <div class="rv-reply-text">${r.reply.text}</div>
    </div>` : `<div class="rv-reply-form" id="rf-${r.id}">
      <textarea class="rv-reply-input" rows="2" placeholder="Write owner reply..."></textarea>
      <button class="rv-reply-send" onclick="sendReply('${r.id}')">Reply</button>
    </div>`;

    const suspiciousHTML = r.suspicious ? `<div class="rv-suspicious">
      <div class="rv-sus-banner"><i class="fas fa-exclamation-triangle"></i> Suspicious pattern detected — low trust score reviewer, short generic review. GeoHub Trust is reviewing.</div>
    </div>` : '';

    const recommendHTML = `<div class="rv-recommend-row">
      <i class="fas fa-${r.recommend ? 'thumbs-up' : 'thumbs-down'} ${r.recommend ? 'rv-recommend-yes' : 'rv-recommend-no'}"></i>
      <span class="${r.recommend ? 'rv-recommend-yes' : 'rv-recommend-no'}">${r.recommend ? 'Recommends' : 'Does not recommend'}</span>
    </div>`;

    return `<div class="rv-card${r.featured ? ' featured' : ''}${r.id.startsWith('local-') ? ' user-submitted' : ''}" id="card-${r.id}">
      <div class="rv-card-header">
        <div class="rv-av" style="background:${r.avColor}">${r.av}
          <div class="rv-av-trust">${r.trust}</div>
        </div>
        <div class="rv-reviewer-info">
          <div class="rv-reviewer-name">${r.reviewer}</div>
          <div class="rv-reviewer-meta">
            <span class="rv-reviewer-trust"><i class="fas fa-shield-alt"></i> ${r.trust} Trust</span>
            <span class="rv-reviewer-count">· ${r.reviewCount} reviews</span>
          </div>
        </div>
        <div class="rv-date">${r.date}</div>
        <div class="rv-card-badges">${badges}</div>
      </div>
      <div class="rv-subject-row">
        <div class="rv-subject-icon" style="background:${tm.bg}">${tm.icon}</div>
        <div>
          <div class="rv-subject-name">${r.subject}</div>
          <div class="rv-subject-type"><i class="fas fa-map-marker-alt" style="color:${tm.color}"></i>${r.subjectSub}</div>
        </div>
        <span class="rv-type-tag" style="background:${tm.bg};color:${tm.color}">${tm.label}</span>
      </div>
      <div class="rv-rating-row">
        <div class="rv-stars">${stars}</div>
        <span class="rv-rating-num">${r.rating}.0</span>
      </div>
      ${suspiciousHTML}
      <div class="rv-text">${r.text.length > 220 ? r.text.slice(0, 220) + `… <span class="read-more" onclick="expandText(this,'${r.id}')">read more</span>` : r.text}</div>
      ${photosHTML}
      ${tagsHTML}
      ${recommendHTML}
      <div class="rv-card-footer">
        <button class="rv-helpful-btn" id="hbtn-${r.id}" onclick="toggleHelpful('${r.id}',${r.helpful})">
          <i class="fas fa-thumbs-up"></i> Helpful
        </button>
        <span class="rv-helpful-count" id="hcount-${r.id}">${r.helpful} found helpful</span>
        <div class="rv-spacer"></div>
        ${!r.reply ? `<button class="rv-reply-btn" onclick="toggleReplyForm('${r.id}')"><i class="fas fa-reply"></i> Reply</button>` : ''}
        <button class="rv-report-btn" onclick="reportReview('${r.id}')"><i class="fas fa-flag"></i> Report</button>
      </div>
      ${replyHTML}
    </div>`;
  }

  /* ── RENDER SIDEBAR ──────────────────────────────────────── */
  function renderTopReviewers() {
    const el = document.getElementById('topReviewers');
    if (!el) return;
    el.innerHTML = TOP_REVIEWERS.map((u, i) => `
      <div class="rv-reviewer-row">
        <div class="rv-r-av" style="background:${u.color}">${u.av}</div>
        <div>
          <div class="rv-r-name">${u.name}</div>
          <div class="rv-r-meta">${u.count} reviews</div>
        </div>
        <div class="rv-r-score">${u.score}</div>
      </div>`).join('');
  }

  function renderCatBreakdown() {
    const el = document.getElementById('catBreakdown');
    if (!el) return;
    el.innerHTML = CAT_BREAKDOWN.map(c => `
      <div class="rv-cat-line">
        <span class="rv-cat-label">${c.label}</span>
        <div class="rv-cat-track"><div class="rv-cat-fill" data-pct="${c.pct}" style="width:0"></div></div>
        <span class="rv-cat-num">${c.count > 999 ? (c.count/1000).toFixed(1) + 'k' : c.count}</span>
      </div>`).join('');
    setTimeout(() => el.querySelectorAll('.rv-cat-fill').forEach(f => f.style.width = f.dataset.pct + '%'), 100);
  }

  function renderRatingBars() {
    const el = document.getElementById('ratingBars');
    if (!el) return;
    el.innerHTML = RATING_DIST.map(d => `
      <div class="rv-rbar-row">
        <span class="rv-rbar-label">${d.stars}</span>
        <div class="rv-rbar-track"><div class="rv-rbar-fill" style="width:0" data-pct="${d.pct}"></div></div>
      </div>`).join('');
    setTimeout(() => el.querySelectorAll('.rv-rbar-fill').forEach(f => f.style.width = f.dataset.pct + '%'), 100);
  }

  function updateCatCounts() {
    const counts = {};
    allReviews.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
    Object.keys(counts).forEach(k => {
      const el = document.getElementById('cc' + k.charAt(0).toUpperCase() + k.slice(1));
      if (el) el.textContent = counts[k];
    });
    const total = document.getElementById('ccAll');
    if (total) total.textContent = allReviews.length;
  }

  /* ── FILTERS & CATEGORIES ────────────────────────────────── */
  function filterCat(btn, cat) {
    document.querySelectorAll('.rv-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCat = cat;
    visibleCount = 5;
    renderFeed();
  }
  window.filterCat = filterCat;

  function applyFilter(btn, filter) {
    document.querySelectorAll('.rv-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = filter;
    visibleCount = 5;
    renderFeed();
  }
  window.applyFilter = applyFilter;

  function loadMore() {
    visibleCount += 4;
    renderFeed();
  }
  window.loadMore = loadMore;

  /* ── CARD INTERACTIONS ───────────────────────────────────── */
  function toggleHelpful(id, base) {
    const btn    = document.getElementById('hbtn-' + id);
    const countEl = document.getElementById('hcount-' + id);
    if (!btn || !countEl) return;
    const liked = btn.classList.toggle('liked');
    const newCount = base + (liked ? 1 : 0);
    countEl.textContent = newCount + ' found helpful';
  }
  window.toggleHelpful = toggleHelpful;

  function expandText(el, id) {
    const r = allReviews.find(rv => rv.id === id);
    if (!r) return;
    const textEl = el.closest('.rv-text');
    if (textEl) textEl.textContent = r.text;
  }
  window.expandText = expandText;

  function reportReview(id) { rvToast('Report submitted — Trust team will review within 4 hours'); }
  window.reportReview = reportReview;

  function toggleReplyForm(id) {
    const form = document.getElementById('rf-' + id);
    if (!form) return;
    form.classList.toggle('open');
  }
  window.toggleReplyForm = toggleReplyForm;

  function sendReply(id) {
    const form = document.getElementById('rf-' + id);
    if (!form) return;
    const ta = form.querySelector('.rv-reply-input');
    if (!ta || !ta.value.trim()) return;
    const text = ta.value.trim();
    form.outerHTML = `<div class="rv-owner-reply">
      <div class="rv-reply-header">
        <div class="rv-reply-av">G</div>
        <span class="rv-reply-name">You (Owner)</span>
        <span class="rv-reply-badge">Owner Reply</span>
      </div>
      <div class="rv-reply-text">${text}</div>
    </div>`;
    rvToast('Reply posted!');
  }
  window.sendReply = sendReply;

  /* ── WRITE REVIEW MODAL ──────────────────────────────────── */
  function openWriteModal() {
    document.getElementById('writeModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeWriteModal() {
    document.getElementById('writeModal').classList.remove('open');
    document.body.style.overflow = '';
  }
  window.openWriteModal  = openWriteModal;
  window.closeWriteModal = closeWriteModal;

  document.getElementById('writeModal').addEventListener('click', function (e) {
    if (e.target === this) closeWriteModal();
  });

  function selectType(btn) {
    document.querySelectorAll('.rv-type-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    writeType = btn.dataset.type;
  }
  window.selectType = selectType;

  function setStar(n) {
    writeStar = n;
    document.querySelectorAll('.rv-star-pick').forEach((b, i) => b.classList.toggle('lit', i < n));
  }
  window.setStar = setStar;

  function mockProofAttach() {
    proofAttached = true;
    const area  = document.getElementById('proofArea');
    const label = document.getElementById('proofLabel');
    if (area)  { area.style.borderColor = 'rgba(59,130,246,0.6)'; area.style.background = 'rgba(59,130,246,0.1)'; }
    if (label) label.textContent = '✓ Camera proof attached — Camera Proof badge will appear';
  }
  window.mockProofAttach = mockProofAttach;

  function toggleTag(btn) {
    btn.classList.toggle('selected');
    const tag = btn.textContent.trim();
    if (btn.classList.contains('selected')) selectedTags.push(tag);
    else selectedTags = selectedTags.filter(t => t !== tag);
  }
  window.toggleTag = toggleTag;

  function submitReview() {
    const subject = (document.getElementById('writeSubject') || {}).value.trim();
    const text    = (document.getElementById('writeText')    || {}).value.trim();
    if (!subject) { document.getElementById('writeSubject').focus(); return; }
    if (!writeStar) { rvToast('Please select a rating'); return; }
    if (!text || text.length < 10) { document.getElementById('writeText').focus(); return; }

    const tm = TYPE_META[writeType];
    const recommend = document.getElementById('writeRecommend').checked;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const newReview = {
      id: 'local-' + Date.now(),
      type: writeType,
      subject: subject,
      subjectSub: tm.label + ' · Tbilisi',
      reviewer: 'Gio Papinashvili',
      av: 'GP',
      avColor: '#10b981',
      trust: 92,
      reviewCount: 29,
      rating: writeStar,
      text: text,
      tags: [...selectedTags],
      recommend: recommend,
      verified: true,
      cameraProof: proofAttached,
      featured: false,
      photos: proofAttached ? 1 : 0,
      helpful: 0,
      date: dateStr,
      reply: null,
      suspicious: false,
      repeatCustomer: false,
    };

    let stored = [];
    try { stored = JSON.parse(localStorage.getItem('geohub_reviews')) || []; } catch (_) {}
    stored.unshift(newReview);
    try { localStorage.setItem('geohub_reviews', JSON.stringify(stored.slice(0, 50))); } catch (_) {}

    allReviews.unshift(newReview);
    updateCatCounts();
    activeCat = 'all';
    activeFilter = 'all';
    visibleCount = 5;
    document.querySelectorAll('.rv-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === 'all'));
    document.querySelectorAll('.rv-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
    renderFeed();
    closeWriteModal();
    rvToast(`✓ Review posted! +${proofAttached ? 60 : 40} XP earned`);

    // Reset
    writeStar = 0;
    proofAttached = false;
    selectedTags = [];
    document.getElementById('writeSubject').value = '';
    document.getElementById('writeText').value = '';
    document.getElementById('writeRecommend').checked = true;
    document.querySelectorAll('.rv-star-pick').forEach(b => b.classList.remove('lit'));
    document.querySelectorAll('.rv-tag-pick').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.rv-type-btn').forEach(b => b.classList.toggle('selected', b.dataset.type === 'place'));
    writeType = 'place';
    const proofArea  = document.getElementById('proofArea');
    const proofLabel = document.getElementById('proofLabel');
    if (proofArea)  { proofArea.style.borderColor = ''; proofArea.style.background = ''; }
    if (proofLabel) proofLabel.textContent = 'Attach camera proof for Camera Proof badge';
  }
  window.submitReview = submitReview;

  /* ── TOAST ───────────────────────────────────────────────── */
  function rvToast(msg) {
    const t = document.getElementById('rvToast');
    const m = document.getElementById('rvToastMsg');
    if (!t || !m) return;
    m.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }
  window.rvToast = rvToast;

  /* ── RUN ─────────────────────────────────────────────────── */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
