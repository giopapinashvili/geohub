(function () {
  'use strict';

  /* ── PLANS DATA ──────────────────────────────────────────── */

  var PLANS = {
    users: {
      title: 'Plans for Explorers',
      sub: 'Start free, upgrade when GeoHub becomes essential to your city life',
      plans: [
        {
          id: 'user-free', name: 'Free Explorer', icon: '🗺️', tag: null, style: 'free-card',
          monthly: 0, yearly: 0,
          desc: 'Everything you need to start exploring Georgia.',
          cta: 'Get Started Free', ctaStyle: 'outline',
          features: [
            { yes: true,  text: 'Public profile & city map access' },
            { yes: true,  text: '3 check-ins per day' },
            { yes: true,  text: '5 reviews per month' },
            { yes: true,  text: 'Basic trust score' },
            { yes: true,  text: 'Community challenges (view only)' },
            { yes: false, text: 'Analytics dashboard' },
            { yes: false, text: 'AI city recommendations' },
            { yes: false, text: 'QR reward campaigns' },
            { yes: false, text: 'Priority search ranking' }
          ]
        },
        {
          id: 'user-plus', name: 'Plus Explorer', icon: '⚡', tag: 'Most Popular', tagStyle: 'popular-tag', style: 'popular',
          monthly: 9, yearly: 7,
          desc: 'Unlock city insights and exclusive rewards.',
          cta: 'Upgrade to Plus', ctaStyle: 'primary',
          features: [
            { yes: true,  text: 'Everything in Free' },
            { yes: true,  text: 'Unlimited check-ins & reviews' },
            { yes: true,  text: 'Basic analytics dashboard' },
            { yes: true,  text: 'AI place recommendations' },
            { yes: true,  text: 'QR reward claiming (priority)' },
            { yes: true,  text: 'Verified trust badge' },
            { yes: true,  text: 'Join premium challenges' },
            { yes: false, text: 'Creator tools & monetization' },
            { yes: false, text: 'Priority search ranking' }
          ]
        },
        {
          id: 'user-pro', name: 'Pro Explorer', icon: '🏆', tag: 'Best Value', tagStyle: 'value-tag', style: '',
          monthly: 19, yearly: 14,
          desc: 'Maximum visibility, analytics, and creator power.',
          cta: 'Go Pro', ctaStyle: 'primary',
          features: [
            { yes: true,  text: 'Everything in Plus' },
            { yes: true,  text: 'Full analytics + heatmaps' },
            { yes: true,  text: 'Priority search ranking' },
            { yes: true,  text: 'Creator tools & monetization' },
            { yes: true,  text: 'Advanced AI city assistant' },
            { yes: true,  text: 'Exclusive Pro challenges & rewards' },
            { yes: true,  text: '⭐ Pro badge on profile' },
            { yes: true,  text: 'Priority support (24h SLA)' },
            { yes: true,  text: 'Early access to new features' }
          ]
        }
      ]
    },

    businesses: {
      title: 'Plans for Businesses',
      sub: 'Get discovered, drive check-ins, run QR campaigns, and grow with GeoHub',
      plans: [
        {
          id: 'biz-free', name: 'Free Profile', icon: '📌', tag: null, style: 'free-card',
          monthly: 0, yearly: 0,
          desc: 'Your business on the GeoHub map, basic listing.',
          cta: 'Claim Free Listing', ctaStyle: 'outline',
          features: [
            { yes: true,  text: 'Business listing on city map' },
            { yes: true,  text: 'Contact info + 1 photo' },
            { yes: true,  text: 'Receive customer check-ins' },
            { yes: true,  text: 'View & respond to reviews' },
            { yes: false, text: 'Analytics dashboard' },
            { yes: false, text: 'QR campaigns & rewards' },
            { yes: false, text: 'Featured placement in search' },
            { yes: false, text: 'Check-in notifications' }
          ]
        },
        {
          id: 'biz-growth', name: 'Growth', icon: '📈', tag: null, style: '',
          monthly: 29, yearly: 22,
          desc: 'Analytics and your first QR campaign tools.',
          cta: 'Start Growing', ctaStyle: 'primary',
          features: [
            { yes: true,  text: 'Everything in Free' },
            { yes: true,  text: 'Full photo gallery (20 photos)' },
            { yes: true,  text: 'Analytics dashboard' },
            { yes: true,  text: '1 QR reward campaign/month' },
            { yes: true,  text: 'Check-in notifications (real-time)' },
            { yes: true,  text: 'Review management tools' },
            { yes: false, text: 'Featured search placement' },
            { yes: false, text: 'Homepage feature slot' }
          ]
        },
        {
          id: 'biz-premium', name: 'Premium', icon: '🚀', tag: 'Most Popular', tagStyle: 'popular-tag', style: 'popular',
          monthly: 79, yearly: 59,
          desc: 'Full campaign suite, featured search, customer insights.',
          cta: 'Upgrade to Premium', ctaStyle: 'primary',
          features: [
            { yes: true,  text: 'Everything in Growth' },
            { yes: true,  text: '5 QR campaigns/month' },
            { yes: true,  text: 'Featured placement in search' },
            { yes: true,  text: 'Create reward campaigns' },
            { yes: true,  text: 'Customer insights & heatmap' },
            { yes: true,  text: 'Priority review moderation' },
            { yes: true,  text: 'API access for integrations' },
            { yes: false, text: 'Homepage feature slot' }
          ]
        },
        {
          id: 'biz-featured', name: 'Featured Partner', icon: '⭐', tag: 'Top Tier', tagStyle: 'featured-tag', style: 'featured',
          monthly: 149, yearly: 112,
          desc: 'Maximum exposure — homepage feature, unlimited campaigns.',
          cta: 'Become a Partner', ctaStyle: 'gold-cta',
          features: [
            { yes: true,  text: 'Everything in Premium' },
            { yes: true,  text: 'Homepage featured placement' },
            { yes: true,  text: 'Unlimited QR campaigns' },
            { yes: true,  text: 'Dedicated account manager' },
            { yes: true,  text: 'Custom reward badges & branding' },
            { yes: true,  text: 'City heatmap priority visibility' },
            { yes: true,  text: '⭐ Partner badge on profile' },
            { yes: true,  text: 'Priority support SLA (4h)' }
          ]
        }
      ]
    },

    creators: {
      title: 'Plans for Creators',
      sub: 'Build your audience, get verified, and monetize your city influence',
      plans: [
        {
          id: 'cr-free', name: 'Creator Free', icon: '📱', tag: null, style: 'free-card',
          monthly: 0, yearly: 0,
          desc: 'Start building your creator presence on GeoHub.',
          cta: 'Start Creating', ctaStyle: 'outline',
          features: [
            { yes: true,  text: 'Public creator profile' },
            { yes: true,  text: 'Post stories & city content' },
            { yes: true,  text: 'Basic follower management' },
            { yes: true,  text: 'Community collaboration requests' },
            { yes: false, text: 'Analytics dashboard' },
            { yes: false, text: 'Verified creator badge' },
            { yes: false, text: 'Monetization tools' },
            { yes: false, text: 'Brand deals marketplace' }
          ]
        },
        {
          id: 'cr-pro', name: 'Creator Pro', icon: '🎯', tag: 'Most Popular', tagStyle: 'popular-tag', style: 'popular',
          monthly: 15, yearly: 12,
          desc: 'Analytics, verification, and priority discovery.',
          cta: 'Go Creator Pro', ctaStyle: 'primary',
          features: [
            { yes: true,  text: 'Everything in Free' },
            { yes: true,  text: 'Full analytics dashboard' },
            { yes: true,  text: '✓ Verified creator badge' },
            { yes: true,  text: 'Priority in creator search' },
            { yes: true,  text: 'Collaboration request inbox' },
            { yes: true,  text: 'Audience insights' },
            { yes: false, text: 'Revenue dashboard' },
            { yes: false, text: 'Custom storefront' }
          ]
        },
        {
          id: 'cr-studio', name: 'Creator Studio', icon: '🎬', tag: 'Full Suite', tagStyle: 'featured-tag', style: 'featured',
          monthly: 35, yearly: 26,
          desc: 'Complete creator economy — monetize, brand, grow.',
          cta: 'Open Your Studio', ctaStyle: 'gold-cta',
          features: [
            { yes: true,  text: 'Everything in Creator Pro' },
            { yes: true,  text: 'Revenue dashboard & payouts' },
            { yes: true,  text: 'Custom creator storefront' },
            { yes: true,  text: 'Brand deals marketplace access' },
            { yes: true,  text: 'AI content suggestions' },
            { yes: true,  text: 'Homepage featured slot' },
            { yes: true,  text: '🎬 Studio badge on profile' },
            { yes: true,  text: 'Dedicated creator manager' }
          ]
        }
      ]
    },

    organizers: {
      title: 'Plans for Event Organizers',
      sub: 'Create, sell tickets, and promote events across Georgia',
      plans: [
        {
          id: 'org-starter', name: 'Event Starter', icon: '🎪', tag: null, style: 'free-card',
          monthly: 0, yearly: 0,
          desc: 'Host your first events with no upfront cost.',
          cta: 'Create First Event', ctaStyle: 'outline',
          features: [
            { yes: true,  text: 'Up to 2 active events' },
            { yes: true,  text: 'Basic event page + map pin' },
            { yes: true,  text: 'Up to 50 attendees' },
            { yes: true,  text: 'Free RSVP management' },
            { yes: false, text: 'Ticket sales' },
            { yes: false, text: 'Event analytics' },
            { yes: false, text: 'QR check-in system' },
            { yes: false, text: 'Homepage promotion' }
          ]
        },
        {
          id: 'org-growth', name: 'Event Growth', icon: '📣', tag: 'Most Popular', tagStyle: 'popular-tag', style: 'popular',
          monthly: 25, yearly: 19,
          desc: 'Sell tickets, track attendance, and manage up to 10 events.',
          cta: 'Grow Your Events', ctaStyle: 'primary',
          features: [
            { yes: true,  text: 'Up to 10 active events' },
            { yes: true,  text: 'Ticket sales (5% platform fee)' },
            { yes: true,  text: 'Up to 500 attendees/event' },
            { yes: true,  text: 'Event analytics dashboard' },
            { yes: true,  text: 'QR attendee check-in system' },
            { yes: true,  text: 'Promo codes for tickets' },
            { yes: false, text: 'Homepage promotion' },
            { yes: false, text: 'Custom event badges' }
          ]
        },
        {
          id: 'org-pro', name: 'Event Pro', icon: '🎭', tag: 'Unlimited', tagStyle: 'featured-tag', style: 'featured',
          monthly: 59, yearly: 44,
          desc: 'Professional event infrastructure for large-scale events.',
          cta: 'Go Event Pro', ctaStyle: 'gold-cta',
          features: [
            { yes: true,  text: 'Unlimited active events' },
            { yes: true,  text: 'Ticket sales (2% platform fee)' },
            { yes: true,  text: 'Unlimited attendees' },
            { yes: true,  text: 'Advanced analytics + forecasting' },
            { yes: true,  text: 'Homepage featured promotion' },
            { yes: true,  text: 'Custom event badges & branding' },
            { yes: true,  text: 'Priority support (4h SLA)' },
            { yes: true,  text: 'White-label event pages' }
          ]
        }
      ]
    },

    teachers: {
      title: 'Plans for Teachers',
      sub: 'List courses, issue certificates, and reach students across Georgia',
      plans: [
        {
          id: 'teach-basic', name: 'Teacher Basic', icon: '📚', tag: null, style: 'free-card',
          monthly: 0, yearly: 0,
          desc: 'Get discovered by students looking to learn.',
          cta: 'Start Teaching', ctaStyle: 'outline',
          features: [
            { yes: true,  text: 'Teacher profile page' },
            { yes: true,  text: '1 course or service listing' },
            { yes: true,  text: 'Student messaging' },
            { yes: true,  text: 'Subject & location tags' },
            { yes: false, text: 'Analytics dashboard' },
            { yes: false, text: 'Certificate issuance' },
            { yes: false, text: 'Priority in search' },
            { yes: false, text: 'AI curriculum tools' }
          ]
        },
        {
          id: 'teach-pro', name: 'Professional', icon: '🎓', tag: 'Most Popular', tagStyle: 'popular-tag', style: 'popular',
          monthly: 19, yearly: 14,
          desc: 'Certificates, analytics, and priority listing.',
          cta: 'Go Professional', ctaStyle: 'primary',
          features: [
            { yes: true,  text: 'Everything in Basic' },
            { yes: true,  text: 'Up to 10 course listings' },
            { yes: true,  text: 'Student analytics dashboard' },
            { yes: true,  text: 'GeoHub certificate issuance' },
            { yes: true,  text: 'Priority in teacher search' },
            { yes: true,  text: 'Verified teacher badge' },
            { yes: false, text: 'AI curriculum suggestions' },
            { yes: false, text: 'Custom learning paths' }
          ]
        },
        {
          id: 'teach-premium', name: 'Premium Teacher', icon: '🏅', tag: 'Full Suite', tagStyle: 'featured-tag', style: 'featured',
          monthly: 39, yearly: 29,
          desc: 'AI-powered curriculum, unlimited courses, revenue dashboard.',
          cta: 'Unlock Premium', ctaStyle: 'gold-cta',
          features: [
            { yes: true,  text: 'Everything in Professional' },
            { yes: true,  text: 'Unlimited course listings' },
            { yes: true,  text: 'AI curriculum suggestions' },
            { yes: true,  text: 'Custom learning paths' },
            { yes: true,  text: 'Revenue & payment dashboard' },
            { yes: true,  text: '🏅 Premium teacher badge' },
            { yes: true,  text: 'Priority support (24h SLA)' },
            { yes: true,  text: 'Homepage featured slot' }
          ]
        }
      ]
    },

    services: {
      title: 'Plans for Service Providers',
      sub: 'Get found, get reviews, and grow your client base across Georgian cities',
      plans: [
        {
          id: 'svc-basic', name: 'Service Basic', icon: '🔧', tag: null, style: 'free-card',
          monthly: 0, yearly: 0,
          desc: 'Your service on the GeoHub map — start free.',
          cta: 'List Your Service', ctaStyle: 'outline',
          features: [
            { yes: true,  text: 'Service listing on city map' },
            { yes: true,  text: 'Contact form & location pin' },
            { yes: true,  text: 'Customer reviews' },
            { yes: true,  text: 'Service category tags' },
            { yes: false, text: 'Analytics dashboard' },
            { yes: false, text: 'Priority placement in search' },
            { yes: false, text: 'QR card for offline marketing' },
            { yes: false, text: 'AI customer matching' }
          ]
        },
        {
          id: 'svc-pro', name: 'Professional', icon: '💼', tag: 'Most Popular', tagStyle: 'popular-tag', style: 'popular',
          monthly: 19, yearly: 14,
          desc: 'Analytics, priority listing, and offline QR card.',
          cta: 'Go Professional', ctaStyle: 'primary',
          features: [
            { yes: true,  text: 'Everything in Basic' },
            { yes: true,  text: 'Analytics dashboard' },
            { yes: true,  text: 'Priority placement in search' },
            { yes: true,  text: 'Customer review management tools' },
            { yes: true,  text: 'QR card for offline marketing' },
            { yes: true,  text: 'Verified service badge' },
            { yes: false, text: 'Homepage feature slot' },
            { yes: false, text: 'AI customer matching' }
          ]
        },
        {
          id: 'svc-premium', name: 'Premium Provider', icon: '💎', tag: 'Full Suite', tagStyle: 'featured-tag', style: 'featured',
          monthly: 39, yearly: 29,
          desc: 'Homepage visibility, AI matching, and full trust suite.',
          cta: 'Unlock Premium', ctaStyle: 'gold-cta',
          features: [
            { yes: true,  text: 'Everything in Professional' },
            { yes: true,  text: 'Homepage feature slot' },
            { yes: true,  text: 'AI customer-service matching' },
            { yes: true,  text: 'Trust verified badge' },
            { yes: true,  text: 'Unlimited inquiry tracking' },
            { yes: true,  text: 'Client insights dashboard' },
            { yes: true,  text: '💎 Premium provider badge' },
            { yes: true,  text: 'Priority support (24h SLA)' }
          ]
        }
      ]
    }
  };

  /* ── COMPARISON TABLE DATA ───────────────────────────────── */
  var COMP_FEATURES = {
    users: {
      headers: ['Feature', 'Free', 'Plus', 'Pro'],
      rows: [
        ['City map access',           '✓','✓','✓'],
        ['Check-ins per day',         '3','∞','∞'],
        ['Reviews per month',         '5','∞','∞'],
        ['Trust score',               '✓','✓','✓'],
        ['Verified badge',            '✗','✓','✓'],
        ['Analytics dashboard',       '✗','Basic','Full'],
        ['AI recommendations',        '✗','✓','Advanced'],
        ['QR rewards',                '✗','✓','✓'],
        ['Priority search ranking',   '✗','✗','✓'],
        ['Creator tools',             '✗','✗','✓'],
        ['Exclusive challenges',      '✗','✓','✓'],
        ['Pro profile badge',         '✗','✗','✓'],
        ['Priority support',          '✗','✗','✓'],
      ]
    },
    businesses: {
      headers: ['Feature', 'Free', 'Growth', 'Premium', 'Partner'],
      rows: [
        ['City map listing',          '✓','✓','✓','✓'],
        ['Photos',                    '1','20','∞','∞'],
        ['Review management',         '✓','✓','✓','✓'],
        ['Analytics',                 '✗','✓','✓','✓'],
        ['QR campaigns/month',        '0','1','5','∞'],
        ['Featured in search',        '✗','✗','✓','✓'],
        ['Reward campaign creation',  '✗','✗','✓','✓'],
        ['Homepage featured',         '✗','✗','✗','✓'],
        ['Account manager',           '✗','✗','✗','✓'],
        ['Partner badge',             '✗','✗','✗','✓'],
        ['Support SLA',               '✗','48h','24h','4h'],
      ]
    },
    creators: {
      headers: ['Feature', 'Free', 'Pro', 'Studio'],
      rows: [
        ['Creator profile',           '✓','✓','✓'],
        ['Stories & posts',           '✓','✓','✓'],
        ['Analytics',                 '✗','✓','✓'],
        ['Verified badge',            '✗','✓','✓'],
        ['Priority discovery',        '✗','✓','✓'],
        ['Collaboration inbox',       '✗','✓','✓'],
        ['Revenue dashboard',         '✗','✗','✓'],
        ['Custom storefront',         '✗','✗','✓'],
        ['Brand deals marketplace',   '✗','✗','✓'],
        ['Homepage feature',          '✗','✗','✓'],
        ['Studio badge',              '✗','✗','✓'],
      ]
    },
    organizers: {
      headers: ['Feature', 'Starter', 'Growth', 'Pro'],
      rows: [
        ['Active events',             '2','10','∞'],
        ['Attendees/event',           '50','500','∞'],
        ['Ticket sales',              '✗','✓ (5%)','✓ (2%)'],
        ['QR check-in',               '✗','✓','✓'],
        ['Event analytics',           '✗','✓','Advanced'],
        ['Promo codes',               '✗','✓','✓'],
        ['Homepage promotion',        '✗','✗','✓'],
        ['Custom badges',             '✗','✗','✓'],
        ['White-label pages',         '✗','✗','✓'],
        ['Support SLA',               '✗','48h','4h'],
      ]
    },
    teachers: {
      headers: ['Feature', 'Basic', 'Professional', 'Premium'],
      rows: [
        ['Teacher profile',           '✓','✓','✓'],
        ['Course listings',           '1','10','∞'],
        ['Student messaging',         '✓','✓','✓'],
        ['Analytics',                 '✗','✓','✓'],
        ['Certificate issuance',      '✗','✓','✓'],
        ['Priority in search',        '✗','✓','✓'],
        ['AI curriculum tools',       '✗','✗','✓'],
        ['Custom learning paths',     '✗','✗','✓'],
        ['Revenue dashboard',         '✗','✗','✓'],
        ['Homepage featured',         '✗','✗','✓'],
      ]
    },
    services: {
      headers: ['Feature', 'Basic', 'Professional', 'Premium'],
      rows: [
        ['Service listing',           '✓','✓','✓'],
        ['Review management',         '✓','✓','✓'],
        ['Analytics',                 '✗','✓','✓'],
        ['Priority in search',        '✗','✓','✓'],
        ['QR offline card',           '✗','✓','✓'],
        ['Verified badge',            '✗','✓','✓'],
        ['AI customer matching',      '✗','✗','✓'],
        ['Homepage feature',          '✗','✗','✓'],
        ['Client insights',           '✗','✗','✓'],
        ['Premium badge',             '✗','✗','✓'],
      ]
    }
  };

  /* ── COUPON CODES ────────────────────────────────────────── */
  var COUPONS = {
    'GEOHUB25':  { pct: 25, label: '25% off applied!' },
    'GEORGIA50': { pct: 50, label: '50% student discount applied!' },
    'WELCOME10': { pct: 10, label: '10% welcome discount applied!' },
    'TBILISI':   { pct: 15, label: '15% Tbilisi launch discount!' }
  };

  /* ── STATE ───────────────────────────────────────────────── */
  var billing       = 'monthly';
  var activeAud     = 'users';
  var modalPlan     = null;
  var modalBilling  = 'monthly';
  var couponDiscount = 0;
  var compOpen      = false;

  /* ── HELPERS ─────────────────────────────────────────────── */
  function fmt(n) { return n === 0 ? 'Free' : '₾' + n; }
  function fmtP(n) { return n === 0 ? '₾0' : '₾' + n; }

  function getCurrentPlan() {
    try { return JSON.parse(localStorage.getItem('geohub_subscription') || 'null'); } catch (_) { return null; }
  }

  function saveCurrentPlan(plan, aud, billing) {
    var next = new Date(); next.setMonth(next.getMonth() + (billing === 'yearly' ? 12 : 1));
    var sub = { planId: plan.id, planName: plan.name, icon: plan.icon, audience: aud, billing: billing, price: billing === 'yearly' ? plan.yearly : plan.monthly, nextBilling: next.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) };
    try { localStorage.setItem('geohub_subscription', JSON.stringify(sub)); } catch (_) {}
  }

  /* ── RENDER PLANS ────────────────────────────────────────── */
  function renderPlans() {
    var aud = PLANS[activeAud];
    var grid = document.getElementById('plansGrid');
    var titleEl = document.getElementById('plansTitle');
    var subEl   = document.getElementById('plansSub');
    if (!grid) return;
    titleEl.textContent = aud.title;
    subEl.textContent   = aud.sub;

    var curPlan = getCurrentPlan();

    grid.innerHTML = aud.plans.map(function (p) {
      var price  = billing === 'yearly' ? p.yearly : p.monthly;
      var isCur  = curPlan && curPlan.planId === p.id;
      var isFree = price === 0;

      var saveNote = '';
      if (billing === 'yearly' && p.monthly > 0 && p.yearly > 0) {
        var annual = p.yearly * 12;
        var saved  = (p.monthly * 12) - annual;
        saveNote = '<span class="strikethrough">₾' + p.monthly + '</span> <span class="save">Save ₾' + saved + '/yr</span>';
      }

      var cta = isCur
        ? '<button class="plan-cta current" disabled>✓ Current Plan</button>'
        : isFree
          ? '<button class="plan-cta ' + p.ctaStyle + '" onclick="handleFreeCta(\'' + p.id + '\')">' + p.cta + '</button>'
          : '<button class="plan-cta ' + p.ctaStyle + '" onclick="openUpgrade(\'' + p.id + '\')">' + p.cta + '</button>';

      return '<div class="plan-card ' + (p.style || '') + '">' +
        (p.tag ? '<div class="plan-tag ' + p.tagStyle + '">' + p.tag + '</div>' : '') +
        '<div class="plan-icon">' + p.icon + '</div>' +
        '<div class="plan-name">' + p.name + '</div>' +
        '<div class="plan-desc">' + p.desc + '</div>' +
        '<div class="plan-price-row">' +
        (price === 0 ? '' : '<div class="plan-currency">₾</div>') +
        '<div class="plan-price">' + (price === 0 ? 'Free' : price) + '</div>' +
        '</div>' +
        (price > 0 ? '<div class="plan-period">/month' + (billing === 'yearly' ? ' · billed yearly' : '') + '</div>' : '<div class="plan-period">forever</div>') +
        '<div class="plan-monthly-note">' + saveNote + '</div>' +
        '<div class="plan-divider"></div>' +
        '<ul class="plan-features">' +
        p.features.map(function (f) {
          return '<li class="pf-item"><div class="pf-ic ' + (f.yes ? 'yes' : 'no') + '"><i class="fas fa-' + (f.yes ? 'check' : 'times') + '"></i></div><span class="pf-text' + (f.yes ? '' : ' dim') + '">' + f.text + '</span></li>';
        }).join('') +
        '</ul>' + cta + '</div>';
    }).join('');
  }

  /* ── RENDER COMPARISON TABLE ─────────────────────────────── */
  function renderCompTable() {
    var data = COMP_FEATURES[activeAud];
    var table = document.getElementById('compTable');
    if (!table || !data) return;

    var popIndex = 2; // typically 3rd column = popular
    var featIndex = data.headers.length - 1; // last = featured/top

    var thead = '<thead><tr>' + data.headers.map(function (h, i) {
      var cls = i === popIndex ? ' class="plan-head pop"' : i === featIndex && i !== popIndex ? ' class="plan-head feat"' : ' class="plan-head"';
      return '<th' + (i === 0 ? '' : cls) + '>' + h + '</th>';
    }).join('') + '</tr></thead>';

    var tbody = '<tbody>' + data.rows.map(function (row) {
      return '<tr>' + row.map(function (cell, i) {
        if (i === 0) return '<td class="feature-name">' + cell + '</td>';
        if (cell === '✓') return '<td><i class="fas fa-check-circle check"></i></td>';
        if (cell === '✗') return '<td><i class="fas fa-times-circle cross"></i></td>';
        return '<td class="partial">' + cell + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';

    table.innerHTML = thead + tbody;
  }

  /* ── AUDIENCE SWITCH ─────────────────────────────────────── */
  window.switchAud = function (aud) {
    activeAud = aud;
    document.querySelectorAll('.aud-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.aud === aud);
    });
    renderPlans();
    if (compOpen) renderCompTable();
  };

  /* ── BILLING TOGGLE ──────────────────────────────────────── */
  window.setBilling = function (type) {
    billing = type;
    document.getElementById('btMonthly').classList.toggle('active', type === 'monthly');
    document.getElementById('btYearly').classList.toggle('active', type === 'yearly');
    var badge = document.getElementById('saveBadge');
    badge.style.display = type === 'yearly' ? 'flex' : 'none';
    renderPlans();
  };

  /* ── COMPARISON TOGGLE ───────────────────────────────────── */
  window.toggleCompTable = function () {
    compOpen = !compOpen;
    var wrap  = document.getElementById('compTableWrap');
    var label = document.getElementById('compToggleLabel');
    var icon  = document.getElementById('compToggleIcon');
    wrap.classList.toggle('open', compOpen);
    label.textContent = compOpen ? 'Hide feature comparison' : 'Show full feature comparison';
    icon.style.transform = compOpen ? 'rotate(180deg)' : 'rotate(0)';
    if (compOpen) renderCompTable();
  };

  /* ── FAQ ─────────────────────────────────────────────────── */
  window.toggleFaq = function (el) {
    var wasOpen = el.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(function (i) { i.classList.remove('open'); });
    if (!wasOpen) el.classList.add('open');
  };

  /* ── FREE CTA ────────────────────────────────────────────── */
  window.handleFreeCta = function (planId) {
    var sub = { planId: planId, planName: 'Free Explorer', icon: '🗺️', audience: activeAud, billing: 'free', price: 0, nextBilling: 'Never' };
    try { localStorage.setItem('geohub_subscription', JSON.stringify(sub)); } catch (_) {}
    renderPlans();
    loadCurrentPlan();
  };

  /* ── UPGRADE MODAL ───────────────────────────────────────── */
  window.openUpgrade = function (planId) {
    var plan = null;
    var plans = PLANS[activeAud].plans;
    for (var i = 0; i < plans.length; i++) {
      if (plans[i].id === planId) { plan = plans[i]; break; }
    }
    if (!plan) return;
    modalPlan    = plan;
    modalBilling = billing;
    couponDiscount = 0;

    document.getElementById('modalPlanName').textContent    = plan.name;
    document.getElementById('modalIcon').textContent        = plan.icon;
    document.getElementById('modalSummaryName').textContent = plan.name;
    document.getElementById('modalSummaryDesc').textContent = plan.desc;

    var mPrice = plan.monthly;
    var yPrice = plan.yearly;
    var ySave  = (mPrice - yPrice) * 12;

    document.getElementById('mbcMonthlyPrice').textContent = '₾' + mPrice + '/mo';
    document.getElementById('mbcYearlyPrice').textContent  = '₾' + yPrice + '/mo';
    document.getElementById('mbcSave').textContent         = 'Save ₾' + ySave + '/year';

    document.getElementById('couponInp').value    = '';
    document.getElementById('couponResult').textContent = '';
    document.getElementById('couponResult').className   = 'coupon-result';
    document.getElementById('osDiscountRow').style.display = 'none';
    document.getElementById('cardNumber').value  = '';
    document.getElementById('cardExpiry').value  = '';
    document.getElementById('cardCvv').value     = '';
    document.getElementById('cardName').value    = '';

    setModalBilling(billing);
    document.getElementById('upgradeModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeUpgrade = function () {
    document.getElementById('upgradeModal').classList.remove('open');
    document.body.style.overflow = '';
  };

  window.setModalBilling = function (type) {
    modalBilling = type;
    document.getElementById('mbcMonthly').classList.toggle('active', type === 'monthly');
    document.getElementById('mbcYearly').classList.toggle('active', type === 'yearly');
    updateOrderSummary();
  };

  function updateOrderSummary() {
    if (!modalPlan) return;
    var basePrice   = modalBilling === 'yearly' ? modalPlan.yearly * 12 : modalPlan.monthly;
    var perMonthStr = modalBilling === 'yearly' ? '₾' + modalPlan.yearly + '/mo' : '₾' + modalPlan.monthly + '/mo';
    var periodStr   = modalBilling === 'yearly' ? '/year' : '/month';
    var yearlySave  = modalBilling === 'yearly' ? (modalPlan.monthly - modalPlan.yearly) * 12 : 0;

    document.getElementById('modalPrice').textContent      = fmtP(modalBilling === 'yearly' ? modalPlan.yearly : modalPlan.monthly);
    document.getElementById('modalPricePeriod').textContent = periodStr;
    document.getElementById('osPlanLabel').textContent     = modalPlan.name + (modalBilling === 'yearly' ? ' × 12 months' : ' × 1 month');
    document.getElementById('osPlanPrice').textContent     = '₾' + basePrice;

    var discountAmt = Math.round(basePrice * couponDiscount / 100);
    document.getElementById('osDiscount').textContent      = '-₾' + discountAmt;
    document.getElementById('osDiscountRow').style.display = couponDiscount ? 'flex' : 'none';

    document.getElementById('osYearlySave').textContent    = '-₾' + yearlySave;
    document.getElementById('osYearlyRow').style.display   = yearlySave ? 'flex' : 'none';

    var total = basePrice - discountAmt;
    document.getElementById('osTotal').textContent = '₾' + total;
    document.getElementById('payBtnLabel').textContent = 'Pay ₾' + total + (modalBilling === 'yearly' ? '/year' : '/month');

    var isGold = modalPlan.ctaStyle === 'gold-cta';
    document.getElementById('payBtn').className = 'pay-btn' + (isGold ? ' gold' : '');
  }

  /* ── COUPON ──────────────────────────────────────────────── */
  window.applyCoupon = function () {
    var code = document.getElementById('couponInp').value.trim().toUpperCase();
    var res  = document.getElementById('couponResult');
    if (!code) { res.className = 'coupon-result err'; res.textContent = 'Enter a promo code.'; return; }
    var coupon = COUPONS[code];
    if (coupon) {
      couponDiscount = coupon.pct;
      res.className  = 'coupon-result ok';
      res.textContent = '✓ ' + coupon.label;
    } else {
      couponDiscount = 0;
      res.className  = 'coupon-result err';
      res.textContent = '✗ Invalid promo code.';
    }
    updateOrderSummary();
  };

  /* ── MOCK PAYMENT ────────────────────────────────────────── */
  window.fmtCard = function (inp) {
    var v = inp.value.replace(/\D/g, '').slice(0, 16);
    inp.value = v.replace(/(.{4})/g, '$1 ').trim();
  };

  window.fmtExpiry = function (inp) {
    var v = inp.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 2) inp.value = v.slice(0, 2) + ' / ' + v.slice(2);
    else inp.value = v;
  };

  window.processPayment = function () {
    if (!modalPlan) return;
    var btn = document.getElementById('payBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…';
    btn.disabled = true;

    setTimeout(function () {
      saveCurrentPlan(modalPlan, activeAud, modalBilling);
      closeUpgrade();
      showSuccess(modalPlan);
    }, 1800);
  };

  /* ── SUCCESS ─────────────────────────────────────────────── */
  function showSuccess(plan) {
    document.getElementById('successTitle').textContent = 'Welcome to ' + plan.name + '! 🎉';
    document.getElementById('successSub').textContent   = 'Your plan is now active. Enjoy your new features — they\'re unlocked immediately.';

    var topFeatures = plan.features.filter(function (f) { return f.yes; }).slice(0, 4);
    document.getElementById('successFeatures').innerHTML = topFeatures.map(function (f) {
      return '<div class="sf-item"><i class="fas fa-check-circle"></i> ' + f.text + '</div>';
    }).join('');

    document.getElementById('successOv').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  window.closeSuccess = function () {
    document.getElementById('successOv').classList.remove('open');
    document.body.style.overflow = '';
    renderPlans();
    loadCurrentPlan();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── SUBSCRIPTION DASHBOARD ──────────────────────────────── */
  function loadCurrentPlan() {
    var sub = getCurrentPlan();
    var banner = document.getElementById('cpBanner');
    var dash   = document.getElementById('subDash');

    if (!sub || sub.price === 0) {
      if (banner) banner.style.display = 'none';
      if (dash) dash.style.display = 'none';
      return;
    }

    if (banner) {
      banner.style.display = 'block';
      var cpName = document.getElementById('cpName');
      var cpBill = document.getElementById('cpBilling');
      if (cpName) cpName.textContent = sub.planName;
      if (cpBill) cpBill.textContent = sub.nextBilling;
    }

    if (dash) {
      dash.style.display = 'block';
      renderSubDash(sub);
    }
  }

  function renderSubDash(sub) {
    var card = document.getElementById('sdCard');
    if (!card) return;
    card.innerHTML =
      '<div class="sd-plan-row">' +
      '<div class="sd-plan-ic">' + sub.icon + '</div>' +
      '<div><div class="sd-plan-name">' + sub.planName + '</div><div class="sd-plan-desc">' + (sub.billing === 'yearly' ? 'Yearly plan · renews ' : 'Monthly plan · renews ') + sub.nextBilling + '</div></div>' +
      '<div class="sd-plan-price"><div class="sd-plan-pval">₾' + sub.price + '</div><div class="sd-plan-pper">/' + (sub.billing === 'yearly' ? 'mo (billed yearly)' : 'month') + '</div></div>' +
      '</div>' +
      '<div class="sd-meters">' +
      '<div class="sd-meter"><div class="sd-meter-label">Check-ins</div><div class="sd-meter-val">∞ / ∞</div><div class="sd-meter-bar"><div class="sd-meter-fill" style="width:38%"></div></div></div>' +
      '<div class="sd-meter"><div class="sd-meter-label">Reviews</div><div class="sd-meter-val">∞ / ∞</div><div class="sd-meter-bar"><div class="sd-meter-fill" style="width:55%"></div></div></div>' +
      '<div class="sd-meter"><div class="sd-meter-label">AI Requests</div><div class="sd-meter-val">142 / ∞</div><div class="sd-meter-bar"><div class="sd-meter-fill" style="width:22%"></div></div></div>' +
      '</div>' +
      '<div class="sd-actions">' +
      '<button class="sd-btn primary" onclick="switchAud(\'' + sub.audience + '\');window.scrollTo({top:120,behavior:\'smooth\'})"><i class="fas fa-arrow-up"></i> Upgrade Plan</button>' +
      '<button class="sd-btn ghost" onclick="switchAud(\'' + sub.audience + '\')"><i class="fas fa-exchange-alt"></i> Change Plan</button>' +
      '<button class="sd-btn danger" onclick="cancelSub()"><i class="fas fa-times"></i> Cancel Subscription</button>' +
      '</div>';
  }

  window.scrollToSubDash = function () {
    var el = document.getElementById('subDash');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.cancelSub = function () {
    if (!confirm('Cancel subscription? You\'ll revert to the Free plan at end of billing period.')) return;
    try { localStorage.removeItem('geohub_subscription'); } catch (_) {}
    loadCurrentPlan();
    renderPlans();
    var dash = document.getElementById('subDash');
    if (dash) dash.style.display = 'none';
    var banner = document.getElementById('cpBanner');
    if (banner) banner.style.display = 'none';
  };

  /* ── INIT ────────────────────────────────────────────────── */
  function init() {
    renderPlans();
    loadCurrentPlan();

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeUpgrade();
        document.getElementById('successOv').classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
