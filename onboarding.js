/* ================================================================
   GeoHub — Onboarding / Sign-up Flow
   ================================================================ */

// ── DATA ─────────────────────────────────────────────────────────

const OB_DATA = {
  accountTypes: [
    { id: 'explorer',     label: 'Explorer',          icon: 'fas fa-compass',                desc: 'Discover places, earn XP, and explore Georgia.',     color: '#10b981' },
    { id: 'creator',      label: 'Creator',            icon: 'fas fa-wand-magic-sparkles',   desc: 'Share guides, build audience, and collaborate.',      color: '#a855f7' },
    { id: 'business',     label: 'Business Owner',     icon: 'fas fa-store',                 desc: 'Grow foot traffic, launch rewards and campaigns.',    color: '#3b82f6' },
    { id: 'teacher',      label: 'Teacher',            icon: 'fas fa-graduation-cap',        desc: 'Share knowledge, host workshops, grow community.',    color: '#f59e0b' },
    { id: 'service',      label: 'Service Provider',   icon: 'fas fa-wrench',                desc: 'List services, get reviews, reach local clients.',    color: '#f97316' },
    { id: 'realestate',   label: 'Real Estate Agent',  icon: 'fas fa-house',                 desc: 'List properties, get inquiries, showcase listings.',  color: '#14b8a6' },
    { id: 'events',       label: 'Event Organizer',    icon: 'fas fa-calendar-days',         desc: 'Create events, sell tickets, build your audience.',   color: '#ec4899' },
  ],

  interests: [
    { id: 'cafes',       label: 'Cafés',         icon: 'fas fa-mug-hot' },
    { id: 'hiking',      label: 'Hiking',         icon: 'fas fa-person-hiking' },
    { id: 'events',      label: 'Events',         icon: 'fas fa-ticket' },
    { id: 'nightlife',   label: 'Nightlife',      icon: 'fas fa-moon' },
    { id: 'learning',    label: 'Learning',       icon: 'fas fa-book-open' },
    { id: 'fitness',     label: 'Fitness',        icon: 'fas fa-dumbbell' },
    { id: 'realestate',  label: 'Real Estate',    icon: 'fas fa-house' },
    { id: 'services',    label: 'Services',       icon: 'fas fa-wrench' },
    { id: 'travel',      label: 'Travel',         icon: 'fas fa-plane' },
    { id: 'photography', label: 'Photography',    icon: 'fas fa-camera' },
    { id: 'discounts',   label: 'Discounts',      icon: 'fas fa-tag' },
    { id: 'community',   label: 'Community',      icon: 'fas fa-hand-holding-heart' },
  ],

  cities: [
    { id: 'all_georgia', name: 'All Georgia', region: 'Nationwide feed', emoji: '🇬🇪' },
    { id: 'tbilisi',   name: 'Tbilisi',   region: 'Capital',     emoji: '🏛️' },
    { id: 'batumi',    name: 'Batumi',    region: 'Adjara',      emoji: '🌊' },
    { id: 'kutaisi',   name: 'Kutaisi',   region: 'Imereti',     emoji: '🏔️' },
    { id: 'rustavi',   name: 'Rustavi',   region: 'Kvemo Kartli',emoji: '🏙️' },
    { id: 'gori',      name: 'Gori',      region: 'Shida Kartli',emoji: '🌄' },
    { id: 'zugdidi',   name: 'Zugdidi',   region: 'Samegrelo',   emoji: '🌿' },
    { id: 'telavi',    name: 'Telavi',    region: 'Kakheti',     emoji: '🍇' },
    { id: 'kobuleti',  name: 'Kobuleti',  region: 'Adjara',      emoji: '🏖️' },
  ],

  goals: [
    { id: 'discover',  label: 'Discover places',   icon: 'fas fa-compass',         desc: 'Find hidden gems and trending spots.' },
    { id: 'rewards',   label: 'Earn rewards',       icon: 'fas fa-gift',            desc: 'Unlock discounts, XP, and partner perks.' },
    { id: 'meet',      label: 'Meet people',        icon: 'fas fa-users',           desc: 'Join groups and connect with locals.' },
    { id: 'audience',  label: 'Grow audience',      icon: 'fas fa-chart-line',      desc: 'Build following through real-world content.' },
    { id: 'promote',   label: 'Promote business',   icon: 'fas fa-bullhorn',        desc: 'Reach customers and run local campaigns.' },
    { id: 'learn',     label: 'Learn skills',       icon: 'fas fa-graduation-cap',  desc: 'Complete courses, workshops, challenges.' },
    { id: 'services',  label: 'Find services',      icon: 'fas fa-magnifying-glass',desc: 'Hire trusted local professionals.' },
    { id: 'attend',    label: 'Attend events',      icon: 'fas fa-calendar-check',  desc: 'Find and RSVP to events near you.' },
  ],
};

// ── STATE ─────────────────────────────────────────────────────────

const obState = {
  step: 1,
  accountType: null,
  interests: [],
  city: 'all_georgia',
  cities: ['all_georgia'],
  cityScope: 'all_georgia',
  goals: [],
};

const TOTAL_STEPS = 8;

// ── PERSONALIZATION MAPS ─────────────────────────────────────────

const FEED_TYPES = {
  explorer:   { label: 'Discovery Feed',   icon: 'fas fa-compass',              desc: 'Places, events, check-ins, challenges, creator posts.' },
  creator:    { label: 'Creator Feed',     icon: 'fas fa-wand-magic-sparkles',  desc: 'Trending content, collab opportunities, engagement.' },
  business:   { label: 'Business Hub',     icon: 'fas fa-store',                desc: 'Campaigns, customer visits, analytics, offers.' },
  teacher:    { label: 'Learning Hub',     icon: 'fas fa-graduation-cap',       desc: 'Workshops, study groups, skill challenges, courses.' },
  service:    { label: 'Services Feed',    icon: 'fas fa-wrench',               desc: 'Client requests, reviews, local service demand.' },
  realestate: { label: 'Property Feed',    icon: 'fas fa-house',                desc: 'Listings, market trends, open houses, inquiries.' },
  events:     { label: 'Events Hub',       icon: 'fas fa-calendar-days',        desc: 'Event creation, RSVPs, promotions, live coverage.' },
};

const GROUP_MAP = {
  cafes:       { name: 'Tbilisi Coffee Lovers',    members: '1.2K' },
  hiking:      { name: 'Georgia Trail Runners',     members: '840'  },
  events:      { name: 'City Event Crew',           members: '2.1K' },
  nightlife:   { name: 'Nightlife Tbilisi',         members: '680'  },
  learning:    { name: 'GeoHub Learners',           members: '520'  },
  fitness:     { name: 'Fitness Challengers',       members: '940'  },
  realestate:  { name: 'Georgia Property Network',  members: '320'  },
  services:    { name: 'Local Services Hub',        members: '410'  },
  travel:      { name: 'Georgia Explorers',         members: '1.8K' },
  photography: { name: 'GeoHub Photo Club',         members: '760'  },
  discounts:   { name: 'Deal Hunters',              members: '1.5K' },
  community:   { name: 'Patriot Community',         members: '890'  },
};

const CHALLENGE_MAP = {
  explorer:   ['First Check-in',           'Visit 5 Different Cafés',           'Explore 3 City Districts'],
  creator:    ['Post Your First Guide',     'Get 10 Saves on a Post',            'Collaborate with a Business'],
  business:   ['Set Up Your Business Page', 'Launch Your First Offer',           'Reach 10 Verified Visitors'],
  teacher:    ['Share a Learning Resource', 'Host Your First Workshop',          'Gain 5 Followers'],
  service:    ['List Your First Service',   'Get Your First Client Review',      'Earn a 5-Star Rating'],
  realestate: ['List Your First Property',  'Get 3 Inquiries',                   'Host a Virtual Tour'],
  events:     ['Create Your First Event',   'Get 20 RSVPs',                      'Run a Live Event'],
};

const CHALLENGE_XP = [50, 80, 120];

const REWARD_MAP = {
  cafes:       { emoji: '☕', label: 'Free coffee at partner cafes',  pts: 50  },
  hiking:      { emoji: '🥾', label: 'Trail guide PDF unlock',         pts: 80  },
  events:      { emoji: '🎟️', label: 'Event ticket 20% discount',      pts: 100 },
  nightlife:   { emoji: '🌙', label: 'Nightlife fast-entry pass',       pts: 120 },
  learning:    { emoji: '📚', label: 'Premium course access',           pts: 90  },
  fitness:     { emoji: '💪', label: 'Gym day pass at partner',         pts: 100 },
  realestate:  { emoji: '🏠', label: 'Property market report',          pts: 150 },
  services:    { emoji: '🔧', label: 'Service voucher (20 GEL off)',     pts: 80  },
  travel:      { emoji: '✈️', label: 'Georgia travel guide unlock',      pts: 60  },
  photography: { emoji: '📷', label: 'Photo contest entry ticket',       pts: 70  },
  discounts:   { emoji: '🏷️', label: '20% off at partner store',         pts: 40  },
  community:   { emoji: '🤝', label: 'Community Pioneer badge',          pts: 30  },
};

function getAiSuggestion(city, interests, accountType) {
  const cityName = city === 'all_georgia' ? 'all Georgia' : (OB_DATA.cities.find(c => c.id === city)?.name || city || 'Georgia');
  const interest = OB_DATA.interests.find(i => i.id === interests[0])?.label || 'exploration';
  if (accountType === 'business') return `"Help me attract more customers to my ${cityName} business this week with XP rewards."`;
  if (accountType === 'creator') return `"Plan a content creation day in ${cityName} focused on ${interest} — maximize reach and XP."`;
  if (accountType === 'events') return `"What events are trending in ${cityName} this weekend and how can I promote mine?"`;
  return `"Plan my perfect ${interest.toLowerCase()} day in ${cityName} under 40 GEL with XP stops."`;
}

// ── INIT ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  const saved = window.safeStorage ? JSON.stringify(window.safeStorage.get('geohub_onboarding', null)) : null;
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data && data.accountType) {
        renderWelcomeBack(data);
        return;
      }
    } catch (e) { /* ignore corrupt data */ }
  }
  renderStep(1);
});

// ── NAVIGATION ───────────────────────────────────────────────────

function obNext() {
  if (!validateStep(obState.step)) return;
  if (obState.step === TOTAL_STEPS - 1) {
    var profile = computeProfile();
    saveToStorage(profile);
    renderStep(TOTAL_STEPS);
  } else if (obState.step < TOTAL_STEPS) {
    renderStep(obState.step + 1);
  }
}

function obBack() {
  if (obState.step > 1) renderStep(obState.step - 1);
}

function obSkip() {
  if (obState.step === 2) { /* skip photo */ }
  if (obState.step === 4) { obState.interests = []; }
  if (obState.step === 6) { obState.goals = []; }
  if (obState.step === 7) { /* skip notifications */ }
  obNext();
}

// ── VALIDATION ───────────────────────────────────────────────────

function validateStep(step) {
  if (step === 3 && !obState.accountType) {
    showToast('Choose an account type to continue.');
    return false;
  }
  if (step === 4 && obState.interests.length < 3) {
    showToast('Pick at least 3 interests.');
    return false;
  }
  if (step === 5 && (!obState.cities || !obState.cities.length)) {
    showToast('Choose at least one area, or select All Georgia.');
    return false;
  }
  if (step === 6 && obState.goals.length < 2) {
    showToast('Pick at least 2 goals.');
    return false;
  }
  return true;
}

// ── STEP RENDERER ─────────────────────────────────────────────────

function renderStep(n) {
  obState.step = n;
  updateHeader(n);

  const content = document.getElementById('ob-step-content');
  content.style.opacity = '0';
  content.style.transform = 'translateX(16px)';

  setTimeout(function () {
    switch (n) {
      case 1: content.innerHTML = renderWelcome(); break;
      case 2: content.innerHTML = renderPhoto(); break;
      case 3: content.innerHTML = renderAccountType(); break;
      case 4: content.innerHTML = renderInterests(); break;
      case 5: content.innerHTML = renderCity(); break;
      case 6: content.innerHTML = renderGoals(); break;
      case 7: content.innerHTML = renderNotifPermission(); break;
      case 8: content.innerHTML = renderResult(); break;
    }
    content.style.transition = 'opacity 0.26s ease, transform 0.26s ease';
    content.style.opacity = '1';
    content.style.transform = 'translateX(0)';
    bindStep(n);
  }, 180);
}

// ── HEADER UPDATE ─────────────────────────────────────────────────

function updateHeader(step) {
  var fill = document.getElementById('ob-progress-fill');
  var label = document.getElementById('ob-step-label');
  var nav = document.getElementById('ob-nav');
  var back = document.getElementById('ob-back-btn');
  var skip = document.getElementById('ob-skip-btn');
  var next = document.getElementById('ob-next-btn');

  var pct = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);
  fill.style.width = pct + '%';

  label.textContent = step > 1 && step < TOTAL_STEPS ? ('Step ' + (step - 1) + ' of ' + (TOTAL_STEPS - 2)) : '';

  if (step === 1 || step === TOTAL_STEPS) {
    nav.style.display = 'none';
  } else {
    nav.style.display = 'flex';
    back.style.display = step === 2 ? 'none' : 'inline-flex';
    skip.style.display = (step === 2 || step === 4 || step === 6 || step === 7) ? 'block' : 'none';
    next.innerHTML = step === TOTAL_STEPS - 1
      ? '<i class="fas fa-wand-magic-sparkles" style="margin-right:6px"></i> Build My Profile'
      : 'Continue <i class="fas fa-arrow-right" style="margin-left:6px"></i>';
  }
}

// ── STEP 1: WELCOME ───────────────────────────────────────────────

function renderWelcome() {
  return '<div class="ob-welcome">' +
    '<img src="icons/icon-192.png" alt="GeoHub" style="width:80px;height:80px;border-radius:22px;object-fit:cover;box-shadow:0 8px 32px rgba(16,185,129,.3);margin-bottom:16px">' +
    '<h1>Welcome to <span class="hl">GeoHub</span></h1>' +
    '<p>Set up your profile in 2 minutes and get a personalized feed, starter challenges, and real rewards — tailored to your lifestyle.</p>' +
    '<div class="ob-feature-chips">' +
      '<span class="ob-feature-chip"><i class="fas fa-bolt"></i> XP for real activity</span>' +
      '<span class="ob-feature-chip"><i class="fas fa-gift"></i> Personalized rewards</span>' +
      '<span class="ob-feature-chip"><i class="fas fa-users"></i> Matched groups</span>' +
      '<span class="ob-feature-chip"><i class="fas fa-wand-magic-sparkles"></i> AI plan ready</span>' +
      '<span class="ob-feature-chip"><i class="fas fa-chart-line"></i> Business tools</span>' +
    '</div>' +
    '<div class="ob-welcome-cta">' +
      '<button class="ob-start-btn" onclick="renderStep(2)">' +
        '<i class="fas fa-arrow-right"></i> Get Started — it\'s free' +
      '</button>' +
      '<a href="feed.html" class="ob-already-link">Already set up? Go to feed →</a>' +
    '</div>' +
  '</div>';
}

// ── STEP 2: PROFILE PHOTO ─────────────────────────────────────────

function renderPhoto() {
  var preview = obState.photoURL || '';
  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">Step 1 — Your Photo</div>' +
    '<h2>Add a profile photo</h2>' +
    '<p>Help people recognise you. You can always change it later.</p>' +
  '</div>' +
  '<div style="display:flex;flex-direction:column;align-items:center;gap:20px;padding:20px 0">' +
    '<div id="ob-photo-preview" style="width:110px;height:110px;border-radius:50%;background:rgba(16,185,129,.12);border:3px dashed rgba(16,185,129,.4);display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer" onclick="document.getElementById(\'ob-photo-input\').click()">' +
      (preview
        ? '<img src="' + preview + '" style="width:100%;height:100%;object-fit:cover">'
        : '<i class="fas fa-camera" style="font-size:2rem;color:rgba(16,185,129,.6)"></i>') +
    '</div>' +
    '<input type="file" id="ob-photo-input" accept="image/*" style="display:none" onchange="obHandlePhoto(this)">' +
    '<button type="button" onclick="document.getElementById(\'ob-photo-input\').click()" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);color:#10e0a0;border-radius:12px;padding:10px 24px;font-weight:700;cursor:pointer;font-size:.9rem">' +
      '<i class="fas fa-upload" style="margin-right:8px"></i>' + (preview ? 'Change Photo' : 'Choose Photo') +
    '</button>' +
    (preview ? '<p style="color:#10b981;font-size:.85rem"><i class="fas fa-check-circle"></i> Photo selected</p>' : '') +
  '</div>';
}

function obHandlePhoto(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    obState.photoFile = file;
    obState.photoURL = e.target.result;
    var preview = document.getElementById('ob-photo-preview');
    if (preview) preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover">';
    var btn = preview && preview.nextElementSibling && preview.nextElementSibling.nextElementSibling;
    if (btn) btn.innerHTML = '<i class="fas fa-upload" style="margin-right:8px"></i> Change Photo';
  };
  reader.readAsDataURL(file);

  // Upload to Cloudinary in background
  var formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'geohub_unsigned');
  formData.append('folder', 'geohub/avatars');
  fetch('https://api.cloudinary.com/v1_1/dw5dqk2w7/image/upload', { method: 'POST', body: formData })
    .then(function(r){ return r.json(); })
    .then(function(data){ if (data.secure_url) obState.photoCloudinaryURL = data.secure_url; })
    .catch(function(){});
}

// ── STEP 3: ACCOUNT TYPE ──────────────────────────────────────────

function renderAccountType() {
  var cards = OB_DATA.accountTypes.map(function (t) {
    var sel = obState.accountType === t.id;
    return '<div class="ob-type-card' + (sel ? ' selected' : '') + '"' +
      ' style="--ob-color:' + t.color + '"' +
      ' onclick="selectType(\'' + t.id + '\')">' +
      '<div class="ob-type-check"><i class="fas fa-check"></i></div>' +
      '<div class="ob-type-icon"><i class="' + t.icon + '"></i></div>' +
      '<h3>' + t.label + '</h3>' +
      '<p>' + t.desc + '</p>' +
    '</div>';
  }).join('');

  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">Step 1 — Your Profile</div>' +
    '<h2>What describes you best?</h2>' +
    '<p>GeoHub will tailor your feed, challenges, and tools to your role.</p>' +
  '</div>' +
  '<div class="ob-type-grid">' + cards + '</div>';
}

function selectType(id) {
  obState.accountType = id;
  document.querySelectorAll('.ob-type-card').forEach(function (el) { el.classList.remove('selected'); });
  var cards = document.querySelectorAll('.ob-type-card');
  OB_DATA.accountTypes.forEach(function (t, i) {
    if (t.id === id) cards[i].classList.add('selected');
  });
}

// ── STEP 3: INTERESTS ─────────────────────────────────────────────

function renderInterests() {
  var chips = OB_DATA.interests.map(function (item) {
    var sel = obState.interests.indexOf(item.id) !== -1;
    return '<div class="ob-interest-chip' + (sel ? ' selected' : '') + '"' +
      ' onclick="toggleInterest(\'' + item.id + '\')">' +
      '<i class="' + item.icon + '"></i>' +
      '<span>' + item.label + '</span>' +
    '</div>';
  }).join('');

  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">Step 2 — Interests</div>' +
    '<h2>What are you into?</h2>' +
    '<p>Your feed, AI suggestions, challenges, and groups will be built around your interests.</p>' +
    '<p class="ob-min-note">Pick at least 3</p>' +
  '</div>' +
  '<div class="ob-interest-grid">' + chips + '</div>' +
  '<div class="ob-select-count" id="ob-interest-count">' + interestCountText() + '</div>';
}

function interestCountText() {
  var n = obState.interests.length;
  if (n === 0) return 'Nothing selected yet';
  if (n < 3)   return '<strong>' + n + '</strong> selected — pick ' + (3 - n) + ' more';
  return '<strong>' + n + '</strong> interests selected ✓';
}

function toggleInterest(id) {
  var idx = obState.interests.indexOf(id);
  if (idx === -1) {
    obState.interests.push(id);
  } else {
    obState.interests.splice(idx, 1);
  }
  document.querySelectorAll('.ob-interest-chip').forEach(function (el, i) {
    var isSelected = obState.interests.indexOf(OB_DATA.interests[i].id) !== -1;
    el.classList.toggle('selected', isSelected);
  });
  var countEl = document.getElementById('ob-interest-count');
  if (countEl) countEl.innerHTML = interestCountText();
}

// ── STEP 4: CITY ──────────────────────────────────────────────────

function renderCity() {
  var selected = obState.cities || [obState.city || 'all_georgia'];
  var cards = OB_DATA.cities.map(function (c) {
    var sel = selected.indexOf(c.id) !== -1;
    return '<div class="ob-city-card' + (sel ? ' selected' : '') + '"' +
      ' onclick="selectCity(\'' + c.id + '\')">' +
      '<div class="ob-city-emoji">' + c.emoji + '</div>' +
      '<div class="ob-city-name">' + c.name + '</div>' +
      '<div class="ob-city-region">' + c.region + '</div>' +
    '</div>';
  }).join('');

  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">Step 3 — Areas</div>' +
    '<h2>Which parts of Georgia interest you?</h2>' +
    '<p>Georgia is small and people move between cities often. Choose <strong>All Georgia</strong> for a nationwide feed, or select several cities/regions.</p>' +
  '</div>' +
  '<div class="ob-city-grid">' + cards + '</div>' +
  '<div class="ob-select-count"><strong>' + selected.length + '</strong> area option' + (selected.length === 1 ? '' : 's') + ' selected</div>';
}

function selectCity(id) {
  if (!obState.cities) obState.cities = obState.city ? [obState.city] : ['all_georgia'];
  if (id === 'all_georgia') {
    obState.cities = ['all_georgia'];
    obState.city = 'all_georgia';
    obState.cityScope = 'all_georgia';
  } else {
    obState.cities = obState.cities.filter(function (x) { return x !== 'all_georgia'; });
    var idx = obState.cities.indexOf(id);
    if (idx === -1) obState.cities.push(id); else obState.cities.splice(idx, 1);
    if (!obState.cities.length) obState.cities = ['all_georgia'];
    obState.city = obState.cities[0];
    obState.cityScope = obState.cities.indexOf('all_georgia') !== -1 ? 'all_georgia' : 'multi_city';
  }
  renderStep(4);
}

// ── STEP 5: GOALS ─────────────────────────────────────────────────

function renderGoals() {
  var cards = OB_DATA.goals.map(function (g) {
    var sel = obState.goals.indexOf(g.id) !== -1;
    return '<div class="ob-goal-card' + (sel ? ' selected' : '') + '"' +
      ' onclick="toggleGoal(\'' + g.id + '\')">' +
      '<div class="ob-goal-icon"><i class="' + g.icon + '"></i></div>' +
      '<div class="ob-goal-text"><h4>' + g.label + '</h4><p>' + g.desc + '</p></div>' +
    '</div>';
  }).join('');

  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">Step 4 — Goals</div>' +
    '<h2>What do you want to achieve?</h2>' +
    '<p>Your challenges, rewards, and recommendations will be optimized for your goals.</p>' +
    '<p class="ob-min-note">Pick at least 2</p>' +
  '</div>' +
  '<div class="ob-goal-grid">' + cards + '</div>';
}

function toggleGoal(id) {
  var idx = obState.goals.indexOf(id);
  if (idx === -1) {
    obState.goals.push(id);
  } else {
    obState.goals.splice(idx, 1);
  }
  document.querySelectorAll('.ob-goal-card').forEach(function (el, i) {
    el.classList.toggle('selected', obState.goals.indexOf(OB_DATA.goals[i].id) !== -1);
  });
}

// ── STEP 7: NOTIFICATIONS ─────────────────────────────────────────

function renderNotifPermission() {
  var granted = Notification && Notification.permission === 'granted';
  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">Step 6 — Notifications</div>' +
    '<h2>Stay in the loop</h2>' +
    '<p>Get notified when someone follows you, comments on your post, or a nearby deal drops.</p>' +
  '</div>' +
  '<div style="display:flex;flex-direction:column;align-items:center;gap:20px;padding:20px 0">' +
    '<div style="font-size:4rem">🔔</div>' +
    '<div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:360px">' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,.04);border-radius:14px;border:1px solid rgba(255,255,255,.07)">' +
        '<i class="fas fa-heart" style="color:#f43f5e;width:20px"></i><span style="font-size:.88rem">New followers & reactions</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,.04);border-radius:14px;border:1px solid rgba(255,255,255,.07)">' +
        '<i class="fas fa-tag" style="color:#f59e0b;width:20px"></i><span style="font-size:.88rem">Exclusive local deals</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,.04);border-radius:14px;border:1px solid rgba(255,255,255,.07)">' +
        '<i class="fas fa-trophy" style="color:#10b981;width:20px"></i><span style="font-size:.88rem">XP milestones & challenges</span>' +
      '</div>' +
    '</div>' +
    (granted
      ? '<div style="color:#10b981;font-weight:700;font-size:.95rem"><i class="fas fa-check-circle"></i> Notifications already enabled!</div>'
      : '<button type="button" id="ob-notif-btn" onclick="obRequestNotif()" style="background:linear-gradient(135deg,#10b981,#3b82f6);border:none;color:#fff;border-radius:14px;padding:14px 32px;font-weight:800;font-size:1rem;cursor:pointer;width:100%;max-width:360px"><i class="fas fa-bell" style="margin-right:8px"></i> Enable Notifications</button>') +
  '</div>';
}

function obRequestNotif() {
  var btn = document.getElementById('ob-notif-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enabling…'; }
  if (!('Notification' in window)) { obNext(); return; }
  Notification.requestPermission().then(function(result) {
    if (result === 'granted') {
      if (btn) btn.innerHTML = '<i class="fas fa-check-circle"></i> Notifications enabled!';
      setTimeout(obNext, 800);
    } else {
      obNext();
    }
  }).catch(obNext);
}

// ── STEP 8: RESULT ────────────────────────────────────────────────

function computeProfile() {
  var typeId = obState.accountType || 'explorer';
  var feed = FEED_TYPES[typeId] || FEED_TYPES.explorer;
  var typeData = OB_DATA.accountTypes.find(function (t) { return t.id === typeId; }) || OB_DATA.accountTypes[0];
  var selectedCities = obState.cities && obState.cities.length ? obState.cities : [obState.city || 'all_georgia'];
  var cityData = selectedCities.indexOf('all_georgia') !== -1 ? OB_DATA.cities[0] : (OB_DATA.cities.find(function (c) { return c.id === selectedCities[0]; }) || OB_DATA.cities[0]);
  var cityNames = selectedCities.indexOf('all_georgia') !== -1 ? ['All Georgia'] : selectedCities.map(function(id){ var c = OB_DATA.cities.find(function(x){return x.id===id;}); return c ? c.name : id; });

  var topInterests = obState.interests.length ? obState.interests.slice(0, 3) : ['cafes', 'events', 'travel'];
  var groups = topInterests.map(function (id) { return GROUP_MAP[id] || { name: 'City Explorers', members: '500+' }; });

  var challenges = CHALLENGE_MAP[typeId] || CHALLENGE_MAP.explorer;

  var rewardInterests = obState.interests.length ? obState.interests.slice(0, 2) : ['cafes', 'events'];
  var rewards = rewardInterests.map(function (id) { return REWARD_MAP[id] || { emoji: '🎁', label: 'Starter reward', pts: 50 }; });

  var aiSuggestion = getAiSuggestion(obState.city, obState.interests, typeId);

  return {
    accountType: typeId,
    accountLabel: typeData.label,
    accountColor: typeData.color,
    accountIcon: typeData.icon,
    city: obState.city,
    cities: selectedCities,
    cityScope: selectedCities.indexOf('all_georgia') !== -1 ? 'all_georgia' : 'multi_city',
    cityName: cityNames.join(', '),
    cityEmoji: cityData.emoji,
    interests: obState.interests,
    goals: obState.goals,
    feed: feed,
    groups: groups,
    challenges: challenges,
    rewards: rewards,
    aiSuggestion: aiSuggestion,
    xpBonus: 250,
    completedAt: new Date().toISOString(),
  };
}

function renderResult() {
  var profile = computeProfile();

  var groupChips = profile.groups.map(function (g) {
    return '<div class="ob-group-chip"><i class="fas fa-users"></i> ' + g.name + ' <span>· ' + g.members + ' members</span></div>';
  }).join('');

  var challengeRows = profile.challenges.map(function (c, i) {
    return '<div class="ob-challenge-row">' +
      '<i class="fas fa-trophy"></i>' +
      '<span>' + c + '</span>' +
      '<span class="ob-challenge-xp">+' + CHALLENGE_XP[i] + ' XP</span>' +
    '</div>';
  }).join('');

  var rewardRows = profile.rewards.map(function (r) {
    return '<div class="ob-reward-row">' +
      '<span class="reward-icon">' + r.emoji + '</span>' +
      '<span>' + r.label + '</span>' +
      '<span class="ob-reward-pts">' + r.pts + ' XP</span>' +
    '</div>';
  }).join('');

  return '<div class="ob-result-hero">' +
    '<div class="ob-result-check"><i class="fas fa-check"></i></div>' +
    '<h2>Your GeoHub is ready!</h2>' +
    '<p>We built a personalized profile based on your choices.</p>' +
  '</div>' +

  '<div class="ob-result-profile">' +
    '<div class="ob-profile-avatar" style="background:' + profile.accountColor + '22;color:' + profile.accountColor + '">' +
      '<i class="' + profile.accountIcon + '"></i>' +
    '</div>' +
    '<div class="ob-profile-info">' +
      '<h3>' + profile.accountLabel + ' · ' + profile.cityEmoji + ' ' + profile.cityName + '</h3>' +
      '<p>Feed type: <strong>' + profile.feed.label + '</strong></p>' +
    '</div>' +
    '<div class="ob-profile-xp">' +
      '<strong>+' + profile.xpBonus + ' XP</strong>' +
      '<span>Signup bonus</span>' +
    '</div>' +
  '</div>' +

  '<div class="ob-result-section">' +
    '<div class="ob-result-label"><i class="fas fa-compass" style="margin-right:5px"></i> Recommended Feed</div>' +
    '<div class="ob-feed-badge"><i class="' + profile.feed.icon + '"></i> ' + profile.feed.label + '</div>' +
    '<p style="color:var(--text-muted);font-size:0.8rem;margin-top:8px">' + profile.feed.desc + '</p>' +
  '</div>' +

  '<div class="ob-result-section">' +
    '<div class="ob-result-label"><i class="fas fa-users" style="margin-right:5px"></i> Suggested Groups</div>' +
    '<div class="ob-result-grid">' + groupChips + '</div>' +
  '</div>' +

  '<div class="ob-result-section">' +
    '<div class="ob-result-label"><i class="fas fa-trophy" style="margin-right:5px"></i> Starter Challenges</div>' +
    '<div class="ob-challenge-list">' + challengeRows + '</div>' +
  '</div>' +

  '<div class="ob-result-section">' +
    '<div class="ob-result-label"><i class="fas fa-gift" style="margin-right:5px"></i> First Rewards to Unlock</div>' +
    '<div class="ob-reward-list">' + rewardRows + '</div>' +
  '</div>' +

  '<div class="ob-result-section">' +
    '<div class="ob-result-label"><i class="fas fa-wand-magic-sparkles" style="margin-right:5px"></i> AI Assistant Pre-loaded</div>' +
    '<div class="ob-ai-bubble"><strong>Try asking</strong><span class="ob-ai-suggestion">' + profile.aiSuggestion + '</span></div>' +
  '</div>' +

  '<div class="ob-result-finish">' +
    '<a href="feed.html" class="ob-finish-btn"><i class="fas fa-compass"></i> Start Exploring GeoHub</a>' +
    '<p class="ob-finish-note">Your profile is saved. You can update interests anytime in Settings.</p>' +
  '</div>';
}

// ── WELCOME BACK ──────────────────────────────────────────────────

function renderWelcomeBack(data) {
  var header = document.getElementById('ob-step-label');
  if (header) header.textContent = '';
  var fill = document.getElementById('ob-progress-fill');
  if (fill) fill.style.width = '100%';
  var nav = document.getElementById('ob-nav');
  if (nav) nav.style.display = 'none';

  var typeData = OB_DATA.accountTypes.find(function (t) { return t.id === data.accountType; });
  var cityData = OB_DATA.cities.find(function (c) { return c.id === data.city; });
  var label = typeData ? typeData.label : 'Explorer';
  var cityName = cityData ? (cityData.emoji + ' ' + cityData.name) : 'Georgia';

  var content = document.getElementById('ob-step-content');
  content.innerHTML =
    '<div class="ob-welcome-back">' +
      '<div class="ob-wb-badge"><i class="fas fa-check-circle"></i> Profile already set up</div>' +
      '<h2>Welcome back, ' + label + '!</h2>' +
      '<p>Your GeoHub profile is ready in ' + cityName + '. Jump back in where you left off.</p>' +
      '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">' +
        '<a href="feed.html" class="btn btn-primary btn-lg"><i class="fas fa-compass"></i> Continue to GeoHub</a>' +
        '<button class="btn btn-ghost" onclick="restartOnboarding()"><i class="fas fa-rotate"></i> Restart Setup</button>' +
      '</div>' +
    '</div>';
}

function restartOnboarding() {
  if (window.safeStorage) window.safeStorage.remove('geohub_onboarding');
  obState.accountType = null;
  obState.interests = [];
  obState.city = 'all_georgia';
  obState.cities = ['all_georgia'];
  obState.cityScope = 'all_georgia';
  obState.goals = [];
  renderStep(1);
}

// ── STORAGE ───────────────────────────────────────────────────────

function saveToStorage(profile) {
  var data = {
    accountType: obState.accountType,
    interests:   obState.interests,
    city:        obState.city,
    cities:      obState.cities || [obState.city || 'all_georgia'],
    cityScope:   obState.cityScope || 'all_georgia',
    goals:       obState.goals,
    photoURL:    obState.photoCloudinaryURL || obState.photoURL || '',
    profile:     profile,
    completedAt: new Date().toISOString(),
  };
  if (window.safeStorage) window.safeStorage.set('geohub_onboarding', data);
  saveOnboardingToFirestore(data);
}

function saveOnboardingToFirestore(data) {
  function doSave(fb) {
    var user = fb.auth && fb.auth.currentUser;
    if (!user) return;
    var update = {
      onboardingComplete: true,
      onboardingCompletedAt: fb.fs.serverTimestamp(),
      accountType: data.accountType || 'explorer',
      interests:   data.interests   || [],
      city:        data.city        || 'all_georgia',
      cities:      data.cities      || [data.city || 'all_georgia'],
      goals:       data.goals       || [],
    };
    if (data.photoURL) { update.photoURL = data.photoURL; update.avatar = data.photoURL; }
    fb.fs.updateDoc(fb.fs.doc(fb.db, 'users', user.uid), update).catch(function () {});
  }
  if (window.GeoFirebase && window.GeoFirebase.auth) {
    doSave(window.GeoFirebase);
  } else {
    window.addEventListener('GeoFirebaseReady', function () {
      if (window.GeoFirebase) doSave(window.GeoFirebase);
    }, { once: true });
  }
}

// ── TOAST ─────────────────────────────────────────────────────────

function showToast(msg) {
  var toast = document.getElementById('ob-toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function () { toast.classList.remove('show'); }, 2800);
}

// ── BIND STEP (post-render hooks) ─────────────────────────────────

function bindStep() {
  // No additional binding needed — all handled via inline onclick
}
