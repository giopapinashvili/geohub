/* GeoHub — Demo / Investor Presentation Mode */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     STEP DATA
  ══════════════════════════════════════════════════════════════ */
  var STEPS = [
    {
      id: 'problem', n: 1,
      tag: 'The Problem', color: '#ef4444',
      title: "Georgia’s Local Economy Has No Discovery Stack",
      sub: '14 million tourists. 180,000+ SMBs. Zero unified platform.',
      body: 'Businesses have no digital loyalty tool. Visitors have no local discovery app. Locals have no way to earn rewards for supporting Georgian businesses. Everyone is losing value that could easily flow through a single connected platform.',
      stats: [
        { v: '89%', l: 'of Georgian SMBs have no digital loyalty program' },
        { v: '14M',  l: 'annual tourism visits with no local discovery app' },
        { v: '60%',  l: 'of first-time customers never return — no engagement loop' },
      ],
      cta: { label: 'Explore Places', href: 'places.html', icon: 'fa-map-marker-alt' },
    },
    {
      id: 'solution', n: 2,
      tag: 'The Solution', color: '#10b981',
      title: 'One Platform. Four Value Pillars.',
      sub: 'GeoHub connects users, businesses, creators, and the city.',
      body: 'GeoHub is the first unified discovery + loyalty + social platform built specifically for the Georgian economy. Every feature is designed to create value for all four stakeholder groups simultaneously — so growth is compounding, not linear.',
      stats: [
        { v: '4',  l: 'connected stakeholder groups in one ecosystem' },
        { v: '23', l: 'product pages covering every user need' },
        { v: '1',  l: 'platform to rule discovery, loyalty, and community' },
      ],
      cta: { label: 'See the Feed', href: 'feed.html', icon: 'fa-rss' },
    },
    {
      id: 'onboarding', n: 3,
      tag: 'User Onboarding', color: '#3b82f6',
      title: 'Personalized from Minute One',
      sub: 'A 5-step setup that builds your perfect GeoHub profile.',
      body: 'Users pick account type, interests, city, and goals. GeoHub immediately generates a curated feed, starter challenges, nearby groups, and first rewards — before they even check in once. Personalization drives Day 1 retention.',
      stats: [
        { v: '7',  l: 'account types — explorer, creator, business, student, teacher…' },
        { v: '12', l: 'interest categories to personalize the feed' },
        { v: '8',  l: 'Georgian cities with local content and groups' },
      ],
      cta: { label: 'Try Onboarding', href: 'onboarding.html', icon: 'fa-rocket' },
    },
    {
      id: 'feed', n: 4,
      tag: 'Discover Feed', color: '#8b5cf6',
      title: 'A Social Feed Built for Real-World Exploration',
      sub: 'Check-ins, reviews, events, group plans — all in one stream.',
      body: 'The GeoHub feed combines social posts, live check-ins, event announcements, business deals, challenge completions, and patriot tasks. It is Instagram + Airbnb + Discord — built specifically for the Georgian city experience.',
      stats: [
        { v: '12', l: 'feed post types: checkin, review, event, deal, patriot…' },
        { v: '30', l: 'active users posting to the mock feed right now' },
        { v: '∞',  l: 'scroll depth — the city never stops moving' },
      ],
      cta: { label: 'Open Feed', href: 'feed.html', icon: 'fa-stream' },
    },
    {
      id: 'checkin', n: 5,
      tag: 'Check-in + XP', color: '#f59e0b',
      title: 'Every Visit Earns XP. Every XP Unlocks Something.',
      sub: 'Gamification that drives repeat visits and business loyalty.',
      body: 'Check in at a place, earn 35 XP. Write a review, earn 55 XP. Complete a challenge, earn 120 XP. XP powers your explorer level, leaderboard rank, and reward eligibility — creating a genuine engagement loop that benefits both users and businesses.',
      stats: [
        { v: '35',  l: 'XP per check-in (business gets +1 verified visit)' },
        { v: '5',   l: 'explorer levels: Bronze → Silver → Gold → Platinum' },
        { v: '180', l: 'XP for completing a patriot community task' },
      ],
      cta: { label: 'Try Check-in', href: 'checkin.html', icon: 'fa-map-pin' },
    },
    {
      id: 'rewards', n: 6,
      tag: 'Rewards System', color: '#10b981',
      title: 'Real Rewards from Real Georgian Businesses',
      sub: 'QR-based claims. Honest loyalty. No tricks.',
      body: 'Businesses create reward campaigns directly on GeoHub. Users claim with one tap — getting a unique QR code instantly. Businesses verify at point of sale with a phone scan. No third-party apps, no paper coupons, no expiry tricks. Just honest loyalty infrastructure.',
      stats: [
        { v: 'QR',  l: 'unique claim code per reward, verified at point of sale' },
        { v: '3×',  l: 'average repeat visit rate for businesses with active rewards' },
        { v: '₾0',  l: 'cost for users — rewards are always free to claim' },
      ],
      cta: { label: 'Browse Rewards', href: 'rewards.html', icon: 'fa-trophy' },
    },
    {
      id: 'live', n: 7,
      tag: 'Live City', color: '#ef4444',
      title: 'The City Is Moving — See It Right Now',
      sub: 'Real-time pulse: hotspots, events, groups, and crowd data.',
      body: 'Live City shows active hotspots, ongoing events, nearby groups, trending places, and city alerts — all in a continuously updating feed. On the backend this is a WebSocket event stream. Today it runs on a smart simulation that proves the concept end-to-end.',
      stats: [
        { v: '18', l: 'active hotspots tracked simultaneously in the demo' },
        { v: '12', l: 'nearby groups discoverable at any moment' },
        { v: '5',  l: 'city alert types: deals, cleanups, events, crowds, rewards' },
      ],
      cta: { label: 'See Live City', href: 'live.html', icon: 'fa-circle' },
    },
    {
      id: 'assistant', n: 8,
      tag: 'AI Assistant', color: '#3b82f6',
      title: 'Your Personal City Guide, Powered by AI',
      sub: 'Context-aware recommendations that know your taste.',
      body: 'The GeoHub AI Assistant understands your account type, interests, city, and XP level — giving recommendations that are actually useful. Ask for weekend plans, find patriot tasks nearby, or get business growth advice. It is a real product feature, not a chatbot demo.',
      stats: [
        { v: 'GPT',  l: 'powered with full GeoHub context injection' },
        { v: '7',    l: 'assistant personas adapting to account type' },
        { v: '∞',    l: 'conversation memory per session with history' },
      ],
      cta: { label: 'Try AI Assistant', href: 'assistant.html', icon: 'fa-robot' },
    },
    {
      id: 'dashboard', n: 9,
      tag: 'Business Dashboard', color: '#f59e0b',
      title: 'The Growth Tool Georgian Businesses Were Missing',
      sub: 'Analytics, campaigns, QR rewards — all in 3 minutes.',
      body: 'Business owners see real visitor analytics, active reward campaign performance, check-in frequency by day, and customer trust scores. Launch a new loyalty campaign in under 3 minutes. No agency, no developer, no marketing budget required.',
      stats: [
        { v: '1,800+', l: 'Georgian businesses already in the platform' },
        { v: '3 min',  l: 'time to launch a new loyalty campaign from scratch' },
        { v: '4',      l: 'plan tiers: Free → Starter → Growth → Premium' },
      ],
      cta: { label: 'View Dashboard', href: 'dashboard.html', icon: 'fa-chart-bar' },
    },
    {
      id: 'creators', n: 10,
      tag: 'Creator Marketplace', color: '#a855f7',
      title: 'Connect Georgian Creators with Local Brands',
      sub: 'Collab offers, analytics, and revenue sharing — all native.',
      body: 'GeoHub has a dedicated Creator Marketplace where businesses send collaboration offers to verified creators. Creators manage offers, track analytics, and see earnings — all inside the platform. No DMs, no spreadsheets, no agencies taking 40% cuts.',
      stats: [
        { v: '30+', l: 'verified creator profiles already in beta' },
        { v: '15%', l: 'platform fee on collaboration deals (vs 40% agency)' },
        { v: '2.1M', l: 'combined social reach of the GeoHub creator network' },
      ],
      cta: { label: 'Explore Creators', href: 'creators.html', icon: 'fa-star' },
    },
    {
      id: 'events', n: 11,
      tag: 'Events + Tickets', color: '#f97316',
      title: 'From Discovery to Ticket in One Tap',
      sub: 'Events in the feed, tickets in the app, XP after attending.',
      body: 'Events on GeoHub are first-class citizens: they appear in the feed, Live City, the map, and the events page simultaneously. Users buy tickets without leaving the app, earn XP for attending, and share post-event reviews that drive future discovery.',
      stats: [
        { v: '5%',   l: 'ticket processing fee (Phase 2 — BOG Pay integration)' },
        { v: '+45',  l: 'XP earned for each event attended and reviewed' },
        { v: 'Q3',   l: '2026 target for live ticketing with real payments' },
      ],
      cta: { label: 'Browse Events', href: 'events.html', icon: 'fa-calendar' },
    },
    {
      id: 'trust', n: 12,
      tag: 'Trust & Verification', color: '#6366f1',
      title: 'Authenticity at Scale: The Trust Score System',
      sub: 'Every user and business has a transparent trust score.',
      body: 'The GeoHub Trust Score (0–100) is computed from account age, review quality, check-in consistency, community flags, and verified interactions. Users with high trust scores get featured in search and qualify for premium rewards. It makes fake reviews economically pointless.',
      stats: [
        { v: '99',    l: 'trust threshold for "Verified Expert" status' },
        { v: '11',    l: 'input signals powering the trust algorithm' },
        { v: '<24h',  l: 'average report review time (planned production SLA)' },
      ],
      cta: { label: 'Trust System', href: 'trust.html', icon: 'fa-shield-alt' },
    },
    {
      id: 'revenue', n: 13,
      tag: 'Revenue Model', color: '#10b981',
      title: '8 Revenue Streams. Growing in Parallel.',
      sub: 'Both sides of every transaction. Built for resilience.',
      body: 'GeoHub generates revenue from businesses (tools to grow) and from transactions (events, services, creators). No single revenue stream dominates. Year 1 target: ₾250K ARR at 200 premium businesses + early event fees.',
      stats: [
        { v: '₾250K',  l: 'Year 1 projected ARR at 200 premium business accounts' },
        { v: '₾1.2M',  l: 'Year 2 ARR at 1,000 businesses + events + services' },
        { v: '₾12M+',  l: 'serviceable addressable market — Georgia only' },
      ],
      cta: { label: 'Full Roadmap', href: 'backend-roadmap.md', icon: 'fa-road' },
    },
    {
      id: 'roadmap', n: 14,
      tag: 'Roadmap + Ask', color: '#f59e0b',
      title: 'From Prototype to Market Leader in 12 Months',
      sub: 'A clear path to backend, payments, and scale.',
      body: 'The prototype is fully functional: 23 pages, 8,000+ lines of code, complete auth system, PWA, AI assistant, and full mock data. Phase 2 connects a real backend (Supabase + Node.js), adds BOG Pay for tickets, and soft-launches in Tbilisi with 50 real business partners.',
      stats: [
        { v: '12mo',  l: 'to full production launch with paying customers' },
        { v: '$150K', l: 'seed ask — 6-month runway + backend build + launch' },
        { v: '4',     l: 'team members needed: 2 founders + 2 engineers' },
      ],
      cta: { label: 'Try the Platform', href: 'onboarding.html', icon: 'fa-rocket' },
    },
  ];

  var PITCH_TEXT = 'GeoHub is building Georgia\'s first unified discovery, loyalty, and social platform. We connect users who want to explore local places and earn real rewards, with businesses that need a digital engagement tool, creators who want to monetize their audience, and a city that wants to activate community participation. Georgia has 14 million annual tourism visits and 180,000+ SMBs with no shared digital loyalty infrastructure. GeoHub solves this with XP-based gamification, QR reward campaigns, a live city feed, an AI assistant, and 8 revenue streams. We are raising a $150,000 seed round to build the production backend and launch in Tbilisi with 50 business partners.';

  /* ══════════════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════════════ */
  var state = {
    current: 0,
    total: STEPS.length,
    autoPlaying: false,
    autoTimer: null,
    autoInterval: 7000,
    timerStart: null,
    rafId: null,
  };

  /* ══════════════════════════════════════════════════════════════
     PREVIEW GENERATORS
  ══════════════════════════════════════════════════════════════ */
  function pv(id) {
    var h = '';
    switch (id) {

      case 'problem':
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">Local business landscape</span></div><div class="pv-body"><div class="pv-compare"><div class="pv-cmp-col bad"><div class="pv-cmp-head">❌ Today</div><div class="pv-cmp-row"><i class="fas fa-times" style="color:#ef4444;font-size:0.6rem;flex-shrink:0;margin-top:3px;"></i> Businesses use paper stamp cards</div><div class="pv-cmp-row"><i class="fas fa-times" style="color:#ef4444;font-size:0.6rem;flex-shrink:0;margin-top:3px;"></i> Tourists rely on outdated blogs</div><div class="pv-cmp-row"><i class="fas fa-times" style="color:#ef4444;font-size:0.6rem;flex-shrink:0;margin-top:3px;"></i> No local discovery app</div><div class="pv-cmp-row"><i class="fas fa-times" style="color:#ef4444;font-size:0.6rem;flex-shrink:0;margin-top:3px;"></i> Zero community rewards</div></div><div class="pv-cmp-col good"><div class="pv-cmp-head">✅ GeoHub</div><div class="pv-cmp-row"><i class="fas fa-check" style="color:#10b981;font-size:0.6rem;flex-shrink:0;margin-top:3px;"></i> Digital QR loyalty campaigns</div><div class="pv-cmp-row"><i class="fas fa-check" style="color:#10b981;font-size:0.6rem;flex-shrink:0;margin-top:3px;"></i> Social discovery feed</div><div class="pv-cmp-row"><i class="fas fa-check" style="color:#10b981;font-size:0.6rem;flex-shrink:0;margin-top:3px;"></i> Live city pulse map</div><div class="pv-cmp-row"><i class="fas fa-check" style="color:#10b981;font-size:0.6rem;flex-shrink:0;margin-top:3px;"></i> XP + real rewards for locals</div></div></div></div></div>';
        break;

      case 'solution':
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">GeoHub platform</span></div><div class="pv-body"><div class="pv-pillars"><div class="pv-pillar" style="background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.2)"><div class="pv-pillar-icon">🗺️</div><div class="pv-pillar-title">Discover</div><div class="pv-pillar-sub">Feed, map, live city, AI guide</div></div><div class="pv-pillar" style="background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2)"><div class="pv-pillar-icon">⚡</div><div class="pv-pillar-title">Earn</div><div class="pv-pillar-sub">XP, levels, rewards, QR claims</div></div><div class="pv-pillar" style="background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.2)"><div class="pv-pillar-icon">🤝</div><div class="pv-pillar-title">Connect</div><div class="pv-pillar-sub">Groups, events, creators, messages</div></div><div class="pv-pillar" style="background:rgba(168,85,247,0.07);border:1px solid rgba(168,85,247,0.2)"><div class="pv-pillar-icon">📈</div><div class="pv-pillar-title">Grow</div><div class="pv-pillar-sub">Dashboard, campaigns, analytics</div></div></div><div style="margin-top:12px;padding:10px;background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.12);border-radius:8px;text-align:center;font-size:0.78rem;color:#94a3b8;">Georgia\&#39;s first <strong style="color:#f1f5f9;">unified local economy platform</strong></div></div></div>';
        break;

      case 'onboarding':
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">onboarding.html — Step 3/5</span></div><div class="pv-body"><div style="display:flex;gap:6px;justify-content:center;margin-bottom:16px;">' + [1,2,3,4,5].map(function(i){return '<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.68rem;font-weight:800;'+(i<3?'background:rgba(16,185,129,0.2);border:2px solid #10b981;color:#10b981;':i===3?'background:rgba(59,130,246,0.2);border:2px solid #3b82f6;color:#3b82f6;':'background:#172030;border:2px solid #1b2537;color:#4b5563;')+'">'+i+'</div>';}).join('') + '</div><div style="text-align:center;font-size:0.82rem;font-weight:700;color:#f1f5f9;margin-bottom:12px;">Pick Your City</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' + [['🏛️','Tbilisi'],['🌊','Batumi'],['🏛️','Kutaisi'],['⛰️','Kazbegi']].map(function(c,i){return '<div style="padding:10px;border-radius:8px;border:1.5px solid '+(i===0?'#3b82f6':'#1b2537')+';background:'+(i===0?'rgba(59,130,246,0.1)':'transparent')+';text-align:center;font-size:0.75rem;color:'+(i===0?'#f1f5f9':'#64748b')+';">'+c[0]+' '+c[1]+'</div>';}).join('') + '</div></div></div>';
        break;

      case 'feed':
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">feed.html — Discover</span></div><div class="pv-body"><div class="pv-item"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><div class="pv-avatar">NG</div><div><div style="font-size:0.75rem;font-weight:700;color:#f1f5f9;">Nino Gelashvili</div><div style="font-size:0.65rem;color:#64748b;">📍 Fabrika Tbilisi · 18 min ago</div></div><span class="pv-chip" style="margin-left:auto;">+35 XP</span></div><div style="height:60px;background:linear-gradient(135deg,rgba(16,185,129,0.2),rgba(59,130,246,0.15));border-radius:8px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">☕</div><div style="font-size:0.75rem;color:#94a3b8;">Morning coffee turned into a 2h coworking session.</div><div style="display:flex;gap:12px;margin-top:8px;font-size:0.68rem;color:#64748b;"><span>❤️ 128</span><span>💬 3</span></div></div><div class="pv-item"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><div class="pv-avatar" style="background:linear-gradient(135deg,#a855f7,#3b82f6);">TJ</div><div><div style="font-size:0.75rem;font-weight:700;color:#f1f5f9;">Tamo Jikia</div><div style="font-size:0.65rem;color:#64748b;">🎟️ Fabrika Night Market · 2h ago</div></div><span class="pv-chip blue" style="margin-left:auto;">Event</span></div><div style="font-size:0.75rem;color:#94a3b8;">Group plan is open tonight. Food trucks + DJ after 21:00.</div><div style="display:flex;gap:8px;margin-top:8px;"><span style="font-size:0.65rem;padding:3px 8px;background:rgba(59,130,246,0.1);border-radius:100px;color:#3b82f6;">✓ Nino is going</span><span style="font-size:0.65rem;padding:3px 8px;background:rgba(59,130,246,0.1);border-radius:100px;color:#3b82f6;">+11 more</span></div></div></div></div>';
        break;

      case 'checkin':
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">checkin.html</span></div><div class="pv-body"><div style="display:flex;gap:16px;align-items:center;justify-content:center;margin-bottom:16px;"><div class="pv-ring-wrap" style="padding:12px;"><div class="pv-ring"><div class="pv-ring-inner"><span class="pv-ring-v">8,420</span><span class="pv-ring-l">XP</span></div></div><div style="font-size:0.7rem;color:#10b981;font-weight:700;margin-top:4px;">Gold Explorer</div></div><div style="flex:1;"><div class="pv-metric"><span class="pv-metric-l">Check-ins</span><span class="pv-metric-v" style="color:#10b981;">+35 XP</span></div><div class="pv-metric"><span class="pv-metric-l">Reviews</span><span class="pv-metric-v" style="color:#3b82f6;">+55 XP</span></div><div class="pv-metric"><span class="pv-metric-l">Challenge</span><span class="pv-metric-v" style="color:#f59e0b;">+120 XP</span></div><div class="pv-metric"><span class="pv-metric-l">Patriot task</span><span class="pv-metric-v" style="color:#a855f7;">+180 XP</span></div></div></div><div style="background:#172030;border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:10px;"><i class="fas fa-map-marker-alt" style="color:#10b981;"></i><div><div style="font-size:0.78rem;font-weight:700;color:#f1f5f9;">Fabrika Tbilisi</div><div style="font-size:0.65rem;color:#64748b;">Café · Tbilisi · ⭐ 4.8</div></div><span class="pv-chip" style="margin-left:auto;cursor:pointer;">Check In</span></div></div></div>';
        break;

      case 'rewards':
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">rewards.html</span></div><div class="pv-body"><div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:14px;margin-bottom:10px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;"><div><div style="font-size:0.85rem;font-weight:700;color:#f1f5f9;">Free Espresso</div><div style="font-size:0.7rem;color:#64748b;">Roasters Lab · Every 5th visit</div></div><span class="pv-chip">Active</span></div><div style="background:#111827;border-radius:8px;padding:12px;text-align:center;margin-bottom:8px;"><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;justify-items:center;margin-bottom:8px;">'+ [1,2,3,4,5].map(function(i){return '<div style="width:24px;height:24px;border-radius:4px;background:'+(i<5?'rgba(16,185,129,0.3)':'rgba(16,185,129,0.08)')+';border:1px solid '+(i<5?'rgba(16,185,129,0.5)':'rgba(16,185,129,0.15)')+';display:flex;align-items:center;justify-content:center;font-size:0.55rem;">'+(i<5?'✓':i)+'</div>';}).join('') +'</div><div style="font-size:0.65rem;color:#64748b;">4/5 visits — one more to unlock</div></div><div style="text-align:center;font-size:0.72rem;color:#10b981;font-weight:600;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>QR code generated on claim</div></div><div class="pv-item" style="margin-bottom:0;"><div style="display:flex;justify-content:space-between;align-items:center;"><div style="font-size:0.78rem;font-weight:700;color:#f1f5f9;">20% Off — Shavi Lomi</div><span class="pv-chip gold">Claimed ✓</span></div><div style="font-size:0.7rem;color:#64748b;margin-top:3px;">Code: GH-A8F2K1</div></div></div></div>';
        break;

      case 'live':
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444;animation:pulse-blink 1.2s infinite;"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">live.html — City Pulse <span style="color:#ef4444;font-size:0.65rem;">● LIVE</span></span></div><style>@keyframes pulse-blink{0%,100%{opacity:1}50%{opacity:0.3}}</style><div class="pv-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;"><div style="background:#172030;border-radius:8px;padding:10px;text-align:center;"><div style="font-size:1.4rem;font-weight:900;color:#10b981;">18</div><div style="font-size:0.65rem;color:#64748b;">active hotspots</div></div><div style="background:#172030;border-radius:8px;padding:10px;text-align:center;"><div style="font-size:1.4rem;font-weight:900;color:#3b82f6;">7</div><div style="font-size:0.65rem;color:#64748b;">events live</div></div><div style="background:#172030;border-radius:8px;padding:10px;text-align:center;"><div style="font-size:1.4rem;font-weight:900;color:#a855f7;">12</div><div style="font-size:0.65rem;color:#64748b;">groups nearby</div></div><div style="background:#172030;border-radius:8px;padding:10px;text-align:center;"><div style="font-size:1.4rem;font-weight:900;color:#ef4444;">5</div><div style="font-size:0.65rem;color:#64748b;">city alerts</div></div></div><div style="display:flex;flex-direction:column;gap:6px;">'+ ['🔴 Fabrika is busy — 40+ people now','🟡 Night Market starts in 2 hours','🟢 Cleanup task verified: Batumi Blvd'].map(function(t){return '<div style="background:#172030;border-radius:6px;padding:7px 10px;font-size:0.72rem;color:#94a3b8;">'+t+'</div>';}).join('')+'</div></div></div>';
        break;

      case 'assistant':
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">assistant.html — AI Guide</span></div><div class="pv-body"><div class="pv-bubble user">What should I do this weekend in Tbilisi? I like cafés and hidden spots. 🧭</div><div class="pv-bubble ai"><strong>Weekend plan for you:</strong><br>☕ Saturday morning — Fabrika coworking café (Gold Explorer bonus there)<br>📸 Afternoon — Sololaki courtyard walk, photography challenge active<br>🍷 Evening — Shavi Lomi wine dinner, +55 XP for your review<br>🎉 Sunday — Night Market group plan, 12 people going</div><div class="pv-bubble user">Can I earn XP at all of these?</div><div class="pv-bubble ai"><strong>Yes! Estimated weekend XP:</strong> <span style="color:#10b981;font-weight:700;">+320 XP</span> — which puts you 80 points from Silver Explorer 🏅</div></div></div>';
        break;

      case 'dashboard':
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">dashboard.html — Roasters Lab</span></div><div class="pv-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;"><div style="background:#172030;border-radius:8px;padding:10px;"><div style="font-size:0.65rem;color:#64748b;margin-bottom:3px;">Monthly Check-ins</div><div style="font-size:1.2rem;font-weight:800;color:#10b981;">248</div><div style="font-size:0.65rem;color:#10b981;">↑ 18% vs last month</div></div><div style="background:#172030;border-radius:8px;padding:10px;"><div style="font-size:0.65rem;color:#64748b;margin-bottom:3px;">Rewards Claimed</div><div style="font-size:1.2rem;font-weight:800;color:#3b82f6;">67</div><div style="font-size:0.65rem;color:#3b82f6;">↑ 31% this month</div></div><div style="background:#172030;border-radius:8px;padding:10px;"><div style="font-size:0.65rem;color:#64748b;margin-bottom:3px;">Profile Views</div><div style="font-size:1.2rem;font-weight:800;color:#f59e0b;">1,240</div><div style="font-size:0.65rem;color:#f59e0b;">↑ 8% this week</div></div><div style="background:#172030;border-radius:8px;padding:10px;"><div style="font-size:0.65rem;color:#64748b;margin-bottom:3px;">Trust Score</div><div style="font-size:1.2rem;font-weight:800;color:#a855f7;">89/100</div><div style="font-size:0.65rem;color:#a855f7;">Verified ✓</div></div></div><div style="background:#172030;border-radius:8px;padding:10px;"><div style="font-size:0.72rem;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Active Campaign: Free Espresso</div><div class="pv-bar-wrap"><div class="pv-bar-fill" style="width:67%;background:var(--gradient-brand);"></div></div><div style="display:flex;justify-content:space-between;margin-top:4px;font-size:0.65rem;color:#64748b;"><span>67 / 100 claims</span><span>Ends in 8 days</span></div></div></div></div>';
        break;

      case 'creators':
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">creators.html — Marketplace</span></div><div class="pv-body">'+ [['LA','Luka Abashidze','Mountain + Hiking','15.6K','#a855f7'],['SD','Sandro Frames','Photography + Spots','11.2K','#3b82f6'],['SL','Salome Luxe','Hotels + Fine Dining','22.4K','#f59e0b']].map(function(c){return '<div style="display:flex;align-items:center;gap:10px;background:#172030;border-radius:8px;padding:10px 12px;margin-bottom:8px;"><div style="width:32px;height:32px;border-radius:50%;background:'+c[4]+';display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:white;flex-shrink:0;">'+c[0]+'</div><div style="flex:1;"><div style="font-size:0.78rem;font-weight:700;color:#f1f5f9;">'+c[1]+'</div><div style="font-size:0.65rem;color:#64748b;">'+c[2]+'</div></div><div style="text-align:right;"><div style="font-size:0.7rem;font-weight:700;color:'+c[4]+';">'+c[3]+' reach</div><div style="font-size:0.6rem;color:#64748b;margin-top:1px;">Send offer →</div></div></div>';}).join('') + '<div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.2);border-radius:8px;padding:8px 10px;text-align:center;font-size:0.72rem;color:#a855f7;"><i class="fas fa-handshake" style="margin-right:6px;"></i>15% platform fee on collab deals</div></div></div>';
        break;

      case 'events':
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">events.html</span></div><div class="pv-event-img">🎉</div><div class="pv-event-body"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;"><div><div style="font-size:0.9rem;font-weight:800;color:#f1f5f9;">Fabrika Night Market</div><div style="font-size:0.72rem;color:#64748b;margin-top:3px;"><i class="fas fa-map-marker-alt"></i> Fabrika Courtyard · Tbilisi</div></div><span class="pv-chip gold">Free</span></div><div style="display:flex;gap:8px;margin-bottom:12px;"><div style="background:#172030;border-radius:6px;padding:6px 10px;text-align:center;"><div style="font-size:0.9rem;font-weight:800;color:#f1f5f9;">24</div><div style="font-size:0.6rem;color:#64748b;">MAY</div></div><div style="font-size:0.75rem;color:#94a3b8;line-height:1.5;">Food trucks, vintage sellers, DJ set after 21:00. Group plan open — 24 people going.</div></div><div style="display:flex;gap:8px;"><div style="flex:1;padding:9px;background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.25);border-radius:8px;text-align:center;font-size:0.78rem;font-weight:700;color:#f97316;">Join Group</div><div style="flex:1;padding:9px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:8px;text-align:center;font-size:0.78rem;font-weight:700;color:#10b981;">+ 45 XP</div></div></div></div>';
        break;

      case 'trust':
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">trust.html — Verification</span></div><div class="pv-body"><div style="display:flex;align-items:center;gap:16px;margin-bottom:14px;"><div class="pv-trust-ring"><div class="pv-trust-inner"><span class="pv-trust-v">94</span><span class="pv-trust-l">TRUST</span></div></div><div><div style="font-size:0.82rem;font-weight:700;color:#f1f5f9;margin-bottom:6px;">Nino Gelashvili</div><div style="display:flex;flex-wrap:wrap;gap:5px;">' + ['Verified Email','Active 6mo+','Top Reviewer','No Flags'].map(function(b){return '<span class="pv-chip" style="font-size:0.6rem;">'+b+'</span>';}).join('') + '</div></div></div><div style="display:flex;flex-direction:column;gap:6px;">' + [['Account age','6 months','#10b981'],['Review quality','Excellent','#10b981'],['Check-in consistency','Strong','#3b82f6'],['Community reports','0 received','#10b981'],['Verified check-ins','148','#f59e0b']].map(function(r){return '<div class="pv-metric"><span class="pv-metric-l">'+r[0]+'</span><span class="pv-metric-v" style="color:'+r[2]+';">'+r[1]+'</span></div>';}).join('') + '</div></div></div>';
        break;

      case 'revenue':
        var streams = [
          ['#10b981','Premium Business Profiles','₾49–299/mo'],
          ['#3b82f6','QR Reward Campaigns','₾25–149'],
          ['#f59e0b','Featured Listings','₾89/mo'],
          ['#a855f7','Creator Collab Fees','15% of deal'],
          ['#f97316','Event Ticket Processing','5% + ₾0.50'],
          ['#06b6d4','Service Marketplace','12% commission'],
          ['#84cc16','Real Estate Promos','₾199/listing/mo'],
          ['#ec4899','Learning / Courses','20% commission'],
        ];
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">Revenue Model</span></div><div class="pv-body">' + streams.map(function(s){return '<div class="pv-rev-row"><div class="pv-rev-dot" style="background:'+s[0]+';"></div><span class="pv-rev-name">'+s[1]+'</span><span class="pv-rev-val" style="color:'+s[0]+';">'+s[2]+'</span></div>';}).join('') + '<div style="margin-top:10px;padding:8px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:8px;text-align:center;font-size:0.75rem;color:#10b981;font-weight:700;">Year 1 Target: ₾250,000 ARR</div></div></div>';
        break;

      case 'roadmap':
        var phases = [
          ['done','✓','Q1 2026','Prototype: 23 pages, Auth, PWA, AI, mock data'],
          ['active','→','Q2 2026','Backend: Supabase + Node.js, real auth, 50 businesses'],
          ['planned','○','Q3 2026','Payments: BOG Pay, event tickets, creator revenue'],
          ['planned','○','Q4 2026','Scale: Batumi + Kutaisi launch, 500 businesses, Series A prep'],
        ];
        h = '<div class="pv-card"><div class="pv-header"><div class="pv-dot" style="background:#ef4444"></div><div class="pv-dot" style="background:#f59e0b"></div><div class="pv-dot" style="background:#10b981"></div><span class="pv-title-bar">GeoHub Roadmap</span></div><div class="pv-body"><div class="pv-timeline">' + phases.map(function(p){return '<div class="pv-tl-item"><div class="pv-tl-dot '+p[0]+'">'+p[1]+'</div><div><div class="pv-tl-label">'+p[2]+'</div><div class="pv-tl-title">'+p[3]+'</div></div></div>';}).join('') + '</div><div style="margin-top:8px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:8px 12px;font-size:0.72rem;color:#f59e0b;"><i class="fas fa-hand-holding-usd" style="margin-right:6px;"></i>Raising: $150K seed — runway + backend + launch</div></div></div>';
        break;

      default:
        h = '<div class="pv-card"><div class="pv-body"><div class="pv-item"><span class="pv-item-title">GeoHub Platform</span></div></div></div>';
    }
    return h;
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  function colorStyle(c) { return 'color:' + c + ';'; }

  function renderAllSlides() {
    var container = document.getElementById('dpSlides');
    if (!container) return;
    container.innerHTML = STEPS.map(function (s, i) {
      var ctaStyle = 'background:' + s.color + ';color:' + (s.color === '#f59e0b' ? '#000' : '#fff') + ';';
      return '<div class="dp-slide" id="dpSlide' + i + '">' +
        '<div class="dp-slide-left">' +
          '<div class="dp-step-tag" style="' + colorStyle(s.color) + '">' + s.tag + '</div>' +
          '<h2 class="dp-slide-title">' + s.title + '</h2>' +
          '<p class="dp-slide-sub">' + s.sub + '</p>' +
          '<p class="dp-slide-body">' + s.body + '</p>' +
          '<div class="dp-slide-stats">' +
            s.stats.map(function (st) {
              return '<div class="dp-slide-stat"><span class="dp-slide-stat-v" style="' + colorStyle(s.color) + '">' + st.v + '</span><span class="dp-slide-stat-l">' + st.l + '</span></div>';
            }).join('') +
          '</div>' +
          '<a href="' + s.cta.href + '" class="dp-slide-cta" style="' + ctaStyle + '" target="_blank">' +
            '<i class="fas ' + s.cta.icon + '"></i> ' + s.cta.label +
          '</a>' +
        '</div>' +
        '<div class="dp-slide-right"><div class="dp-preview">' + pv(s.id) + '</div></div>' +
      '</div>';
    }).join('');
  }

  function renderDots() {
    var el = document.getElementById('dpDots');
    if (!el) return;
    el.innerHTML = STEPS.map(function (_, i) {
      return '<div class="dp-dot' + (i === state.current ? ' active' : '') + '" data-i="' + i + '"></div>';
    }).join('');
    el.querySelectorAll('.dp-dot').forEach(function (dot) {
      dot.addEventListener('click', function () { goTo(parseInt(dot.dataset.i)); });
    });
  }

  function updateUI() {
    var n = state.current;
    var total = state.total;

    // Show active slide
    document.querySelectorAll('.dp-slide').forEach(function (s, i) {
      s.classList.toggle('active', i === n);
    });

    // Progress bar
    var fill = document.getElementById('dpPbarFill');
    if (fill) fill.style.width = ((n + 1) / total * 100) + '%';

    // Labels
    var lbl = document.getElementById('dpStepLabel');
    if (lbl) lbl.textContent = 'Step ' + (n + 1) + ' / ' + total;
    var ctr = document.getElementById('dpCounter');
    if (ctr) ctr.textContent = (n + 1) + ' / ' + total;

    // Buttons
    var prev = document.getElementById('dpPrev');
    var next = document.getElementById('dpNext');
    if (prev) prev.disabled = (n === 0);
    if (next) next.innerHTML = n === total - 1 ? '<i class="fas fa-flag-checkered"></i> Finish' : 'Next <i class="fas fa-arrow-right"></i>';

    // Dots
    document.querySelectorAll('.dp-dot').forEach(function (d, i) {
      d.classList.toggle('active', i === n);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     NAVIGATION
  ══════════════════════════════════════════════════════════════ */
  function goTo(n, dir) {
    if (n < 0 || n >= state.total) return;
    var prev = state.current;
    state.current = n;
    updateUI();
    if (state.autoPlaying) resetTimer();
  }

  function goNext() {
    if (state.current < state.total - 1) goTo(state.current + 1, 1);
    else finishDemo();
  }
  function goPrev() { goTo(state.current - 1, -1); }

  function finishDemo() {
    stopAutoPlay();
    closePresentation();
  }

  /* ══════════════════════════════════════════════════════════════
     AUTO-PLAY
  ══════════════════════════════════════════════════════════════ */
  function startAutoPlay() {
    state.autoPlaying = true;
    var btn = document.getElementById('dpAutoBtn');
    if (btn) { btn.classList.add('playing'); btn.innerHTML = '<i class="fas fa-pause"></i> Pause'; }
    resetTimer();
  }

  function stopAutoPlay() {
    state.autoPlaying = false;
    if (state.autoTimer) { clearTimeout(state.autoTimer); state.autoTimer = null; }
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    var btn = document.getElementById('dpAutoBtn');
    if (btn) { btn.classList.remove('playing'); btn.innerHTML = '<i class="fas fa-play"></i> Auto'; }
    var bar = document.getElementById('dpTimerBar');
    if (bar) { bar.style.transition = 'none'; bar.style.width = '0'; bar.classList.remove('running'); }
  }

  function resetTimer() {
    if (state.autoTimer) { clearTimeout(state.autoTimer); state.autoTimer = null; }
    var bar = document.getElementById('dpTimerBar');
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.width = '0';
    bar.classList.add('running');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        bar.style.transition = 'width ' + state.autoInterval + 'ms linear';
        bar.style.width = '100%';
      });
    });
    state.autoTimer = setTimeout(function () {
      if (state.current < state.total - 1) {
        goTo(state.current + 1, 1);
      } else {
        stopAutoPlay();
        closePresentation();
      }
    }, state.autoInterval);
  }

  function toggleAutoPlay() {
    if (state.autoPlaying) stopAutoPlay();
    else startAutoPlay();
  }

  /* ══════════════════════════════════════════════════════════════
     SHOW / HIDE
  ══════════════════════════════════════════════════════════════ */
  function openPresentation() {
    try {
      var pres = document.getElementById('demoPresentation');
      var land = document.getElementById('demoLanding');
      if (!pres) return;
      var slides = document.getElementById('dpSlides');
      if (slides && !slides.querySelector('.dp-slide')) {
        renderAllSlides();
        renderDots();
      }
      if (land) land.style.display = 'none';
      pres.classList.add('active');
      document.body.style.overflow = 'hidden';
      state.current = 0;
      updateUI();
      var s0 = document.getElementById('dpSlide0');
      if (s0) { s0.classList.remove('active'); requestAnimationFrame(function () { s0.classList.add('active'); }); }
    } catch (e) { if (typeof console !== 'undefined') console.error('GeoHub demo open error:', e); }
  }

  function closePresentation() {
    var pres = document.getElementById('demoPresentation');
    var land = document.getElementById('demoLanding');
    if (pres) pres.classList.remove('active');
    if (land) land.style.display = '';
    document.body.style.overflow = '';
    stopAutoPlay();
  }

  /* ══════════════════════════════════════════════════════════════
     PITCH MODAL
  ══════════════════════════════════════════════════════════════ */
  function openPitchModal() {
    var m = document.getElementById('pitchModal');
    var t = document.getElementById('pitchText');
    if (!m) return;
    if (t) t.textContent = PITCH_TEXT;
    m.classList.add('open');
  }
  function closePitchModal() {
    var m = document.getElementById('pitchModal');
    if (m) m.classList.remove('open');
  }
  function copyPitch() {
    try {
      navigator.clipboard.writeText(PITCH_TEXT).then(function () {
        showCopied();
      }).catch(function () { fallbackCopy(); });
    } catch (e) { fallbackCopy(); }
  }
  function fallbackCopy() {
    var ta = document.createElement('textarea');
    ta.value = PITCH_TEXT;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showCopied(); } catch (e) {}
    document.body.removeChild(ta);
  }
  function showCopied() {
    var c = document.getElementById('pitchCopied');
    if (c) { c.style.display = 'inline-flex'; setTimeout(function () { c.style.display = 'none'; }, 2500); }
  }

  /* ══════════════════════════════════════════════════════════════
     KEYBOARD
  ══════════════════════════════════════════════════════════════ */
  function onKey(e) {
    var pres = document.getElementById('demoPresentation');
    if (!pres || !pres.classList.contains('active')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    else if (e.key === 'Escape') closePresentation();
    else if (e.key === 'f' || e.key === 'F') toggleAutoPlay();
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */
  function initDemo() {
    try {
      renderAllSlides();
      renderDots();
      updateUI();
    } catch (e) { /* render errors are non-fatal */ }

    try {
      // Landing buttons
      var startBtn = document.getElementById('startDemoBtn');
      var pitchBtn = document.getElementById('pitchBtn');
      if (startBtn) startBtn.addEventListener('click', openPresentation);
      if (pitchBtn) pitchBtn.addEventListener('click', openPitchModal);

      // Presentation controls
      var exitBtn = document.getElementById('dpExit');
      var prevBtn = document.getElementById('dpPrev');
      var nextBtn = document.getElementById('dpNext');
      var autoBtn = document.getElementById('dpAutoBtn');
      if (exitBtn) exitBtn.addEventListener('click', closePresentation);
      if (prevBtn) prevBtn.addEventListener('click', goPrev);
      if (nextBtn) nextBtn.addEventListener('click', goNext);
      if (autoBtn) autoBtn.addEventListener('click', toggleAutoPlay);

      // Pitch modal
      var closeBtn = document.getElementById('pitchClose');
      var copyBtn  = document.getElementById('copyPitchBtn');
      var modal    = document.getElementById('pitchModal');
      if (closeBtn) closeBtn.addEventListener('click', closePitchModal);
      if (copyBtn)  copyBtn.addEventListener('click', copyPitch);
      if (modal)    modal.addEventListener('click', function (e) { if (e.target === modal) closePitchModal(); });

      // Keyboard
      document.addEventListener('keydown', onKey);
    } catch (e) { if (typeof console !== 'undefined') console.error('GeoHub demo bind error:', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDemo);
  } else {
    initDemo();
  }

})();
