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
  firstName: '', lastName: '', username: '', usernameStatus: '',
  birthday: '', gender: '', residentialCity: '', password: '',
  accountType: null,
  interests: [],
  city: 'all_georgia',
  cities: ['all_georgia'],
  cityScope: 'all_georgia',
  goals: [],
};

const TOTAL_STEPS = 11;

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
  // Pre-fill obState from existing user profile (Google/Facebook users already have some fields)
  var u = window.GeoCurrentUser;
  if (u) {
    var np = (u.fullName || '').trim().split(/\s+/);
    if (!obState.firstName && np[0]) obState.firstName = np[0];
    if (!obState.lastName && np.length > 1) obState.lastName = np.slice(1).join(' ');
    if (!obState.username && u.username) { obState.username = u.username; obState.usernameStatus = 'available'; }
    if (!obState.birthday && u.birthday) obState.birthday = u.birthday;
    if (!obState.gender && u.gender)     obState.gender = u.gender;
    if (!obState.residentialCity && u.city) obState.residentialCity = u.city;
    if (!obState.accountType && u.accountType) obState.accountType = u.accountType;
    if (!obState.interests.length && u.interests && u.interests.length) obState.interests = u.interests.slice();
    if (u.cities && u.cities.length) obState.cities = u.cities.slice();
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
  if (obState.step === 5) { obState.password = ''; }
  if (obState.step === 7) { obState.interests = []; }
  if (obState.step === 9) { obState.goals = []; }
  // Advance directly, bypassing validation
  if (obState.step === TOTAL_STEPS - 1) {
    var profile = computeProfile();
    saveToStorage(profile);
    renderStep(TOTAL_STEPS);
  } else if (obState.step < TOTAL_STEPS) {
    renderStep(obState.step + 1);
  }
}

// ── VALIDATION ───────────────────────────────────────────────────

function validateStep(step) {
  if (step === 3) {
    var fn = ((document.getElementById('ob-firstname') || {}).value || obState.firstName || '').trim();
    var ln = ((document.getElementById('ob-lastname')  || {}).value || obState.lastName  || '').trim();
    var un = obState.username || '';
    if (!fn) { showToast('Enter your first name.'); return false; }
    if (!ln) { showToast('Enter your last name.'); return false; }
    if (un.length < 3) { showToast('Username must be at least 3 characters.'); return false; }
    if (obState.usernameStatus === 'taken')    { showToast('That username is taken — choose another.'); return false; }
    if (obState.usernameStatus === 'checking') { showToast('Checking username — please wait.'); return false; }
    obState.firstName = fn; obState.lastName = ln;
    return true;
  }
  if (step === 4) {
    var bd = document.getElementById('ob-birthday'); if (bd) obState.birthday = bd.value;
    var gn = document.getElementById('ob-gender');   if (gn) obState.gender = gn.value;
    var rc = document.getElementById('ob-rescity');  if (rc) obState.residentialCity = rc.value.trim();
    if (!obState.birthday)        { showToast('Please enter your date of birth.'); return false; }
    if (!obState.gender)          { showToast('Please select your gender.'); return false; }
    if (!obState.residentialCity) { showToast('Please enter your city or village.'); return false; }
    return true;
  }
  if (step === 5) {
    var pw1 = document.getElementById('ob-password');
    var pw2 = document.getElementById('ob-password2');
    if (pw1 && pw1.value) {
      if (pw1.value.length < 8) { showToast('Password must be at least 8 characters.'); return false; }
      if (pw2 && pw1.value !== pw2.value) { showToast('Passwords do not match.'); return false; }
      obState.password = pw1.value;
    }
    return true;
  }
  if (step === 6 && !obState.accountType) {
    showToast('Choose an account type to continue.');
    return false;
  }
  if (step === 7 && obState.interests.length < 1) {
    showToast('Pick at least 1 interest.');
    return false;
  }
  if (step === 8 && (!obState.cities || !obState.cities.length)) {
    showToast('Choose at least one area, or select All Georgia.');
    return false;
  }
  if (step === 9 && obState.goals.length < 2) {
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
      case 1:  content.innerHTML = renderWelcome(); break;
      case 2:  content.innerHTML = renderPhoto(); break;
      case 3:  content.innerHTML = renderIdentity(); break;
      case 4:  content.innerHTML = renderAboutYou(); break;
      case 5:  content.innerHTML = renderAccountInfo(); break;
      case 6:  content.innerHTML = renderAccountType(); break;
      case 7:  content.innerHTML = renderInterests(); break;
      case 8:  content.innerHTML = renderCity(); break;
      case 9:  content.innerHTML = renderGoals(); break;
      case 10: content.innerHTML = renderNotifPermission(); break;
      case 11: content.innerHTML = renderResult(); break;
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
    skip.style.display = (step === 2 || step === 5 || step === 7 || step === 9 || step === 10) ? 'block' : 'none';
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

// ── STEP 3: IDENTITY ─────────────────────────────────────────────

var _unCheckTimer = null;

function obCheckUsername(val) {
  var clean = val.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 30);
  obState.username = clean;
  var inp = document.getElementById('ob-username');
  if (inp && inp.value !== clean) inp.value = clean;
  var status = document.getElementById('ob-username-status');
  if (!status) return;
  clearTimeout(_unCheckTimer);
  if (clean.length < 3) {
    obState.usernameStatus = 'invalid';
    status.innerHTML = clean.length > 0 ? '<span style="color:#ef4444"><i class="fas fa-times-circle"></i> At least 3 characters required</span>' : '';
    return;
  }
  obState.usernameStatus = 'checking';
  status.innerHTML = '<span style="color:#94a3b8"><i class="fas fa-circle-notch fa-spin"></i> Checking…</span>';
  _unCheckTimer = setTimeout(function () {
    var geo = window.GeoFirebase, f = geo && geo.fs;
    if (!geo || !f) {
      obState.usernameStatus = 'available';
      status.innerHTML = '<span style="color:#10b981"><i class="fas fa-check-circle"></i> @' + clean + ' looks good</span>';
      return;
    }
    var q = f.query(f.collection(geo.db, 'users'), f.where('username', '==', clean), f.limit(2));
    f.getDocs(q).then(function (snap) {
      var currentUid = window.GeoCurrentUser && window.GeoCurrentUser.uid;
      var taken = false;
      snap.forEach(function (d) { if (d.id !== currentUid) taken = true; });
      if (taken) {
        obState.usernameStatus = 'taken';
        status.innerHTML = '<span style="color:#ef4444"><i class="fas fa-times-circle"></i> This username is taken — try another</span>';
      } else {
        obState.usernameStatus = 'available';
        status.innerHTML = '<span style="color:#10b981"><i class="fas fa-check-circle"></i> @' + clean + ' is available</span>';
      }
    }).catch(function () {
      obState.usernameStatus = 'available';
      status.innerHTML = '<span style="color:#10b981"><i class="fas fa-check-circle"></i> @' + clean + ' looks good</span>';
    });
  }, 600);
}

function obCheckPasswords() {
  var pw1 = document.getElementById('ob-password');
  var pw2 = document.getElementById('ob-password2');
  var st  = document.getElementById('ob-pw-status');
  if (!pw1 || !pw2 || !st) return;
  if (!pw1.value && !pw2.value) { st.innerHTML = ''; return; }
  if (pw1.value.length < 8) { st.innerHTML = '<span style="color:#f59e0b">At least 8 characters</span>'; return; }
  if (pw1.value !== pw2.value) { st.innerHTML = '<span style="color:#ef4444">Passwords do not match</span>'; return; }
  st.innerHTML = '<span style="color:#10b981"><i class="fas fa-check-circle"></i> Passwords match</span>';
}

function renderIdentity() {
  var user = window.GeoCurrentUser || {};
  var fn = obState.firstName || '';
  var ln = obState.lastName  || '';
  var un = obState.username  || '';
  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">Step 2 — Identity</div>' +
    '<h2>Create your profile</h2>' +
    '<p>Set your name and a unique username for GeoHub.</p>' +
  '</div>' +
  '<div style="display:flex;flex-direction:column;gap:14px;max-width:440px;margin:0 auto">' +
    '<div style="display:flex;gap:12px">' +
      '<div style="flex:1">' +
        '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">First Name</label>' +
        '<input type="text" id="ob-firstname" class="form-input" placeholder="e.g. Giorgi" value="' + fn + '" oninput="obState.firstName=this.value.trim()">' +
      '</div>' +
      '<div style="flex:1">' +
        '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">Last Name</label>' +
        '<input type="text" id="ob-lastname" class="form-input" placeholder="e.g. Beridze" value="' + ln + '" oninput="obState.lastName=this.value.trim()">' +
      '</div>' +
    '</div>' +
    '<div>' +
      '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">Username <span style="color:#64748b;font-weight:400;font-size:.75rem">— unique @handle</span></label>' +
      '<div style="position:relative">' +
        '<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#64748b;pointer-events:none">@</span>' +
        '<input type="text" id="ob-username" class="form-input" style="padding-left:28px" placeholder="your_handle" value="' + un + '" oninput="obCheckUsername(this.value)" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">' +
      '</div>' +
      '<div id="ob-username-status" style="margin-top:5px;font-size:.78rem;min-height:18px">' +
        (un.length >= 3 ? '<span style="color:#10b981"><i class="fas fa-check-circle"></i> @' + un + ' is available</span>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}

// ── STEP 4: ABOUT YOU ─────────────────────────────────────────────

function renderAboutYou() {
  var maxDate = new Date(Date.now() - 13 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">Step 3 — About You</div>' +
    '<h2>A bit about you</h2>' +
    '<p>Helps personalize your experience. Only you control who sees this.</p>' +
  '</div>' +
  '<div style="display:flex;flex-direction:column;gap:14px;max-width:440px;margin:0 auto">' +
    '<div>' +
      '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">Date of Birth / დაბადების თარიღი</label>' +
      '<input type="date" id="ob-birthday" class="form-input" max="' + maxDate + '" value="' + (obState.birthday || '') + '">' +
    '</div>' +
    '<div>' +
      '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">Gender / სქესი</label>' +
      '<select id="ob-gender" class="form-input">' +
        '<option value="">Select / აირჩიეთ</option>' +
        '<option value="male"'   + (obState.gender === 'male'   ? ' selected' : '') + '>Male / მამრობითი</option>' +
        '<option value="female"' + (obState.gender === 'female' ? ' selected' : '') + '>Female / მდედრობითი</option>' +
        '<option value="other"'  + (obState.gender === 'other'  ? ' selected' : '') + '>Other / სხვა</option>' +
      '</select>' +
    '</div>' +
    '<div>' +
      '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">City / Village — საცხოვრებელი ადგილი</label>' +
      '<input type="text" id="ob-rescity" class="form-input" placeholder="e.g. Tbilisi / თბილისი" value="' + (obState.residentialCity || '') + '">' +
    '</div>' +
  '</div>';
}

// ── STEP 5: ACCOUNT INFO ──────────────────────────────────────────

function renderAccountInfo() {
  var fbUser = window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser;
  var email = (fbUser && fbUser.email) || (window.GeoCurrentUser && window.GeoCurrentUser.email) || '';
  var hasPwd = false;
  if (fbUser && fbUser.providerData) {
    fbUser.providerData.forEach(function (p) { if (p.providerId === 'password') hasPwd = true; });
  }
  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">Step 4 — Account</div>' +
    '<h2>Your account</h2>' +
    '<p>Confirm your email' + (hasPwd ? '.' : ' and optionally add a password to also log in with email.') + '</p>' +
  '</div>' +
  '<div style="display:flex;flex-direction:column;gap:14px;max-width:440px;margin:0 auto">' +
    '<div>' +
      '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">Email address</label>' +
      '<input type="email" class="form-input" value="' + email + '" readonly style="opacity:.6;cursor:default;background:rgba(255,255,255,.04)">' +
    '</div>' +
    (hasPwd
      ? '<div style="background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px">' +
          '<i class="fas fa-lock" style="color:#10b981"></i>' +
          '<span style="font-size:.85rem;color:#94a3b8">Password is already set for this account.</span>' +
        '</div>'
      : '<div>' +
          '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">Password <span style="color:#64748b;font-weight:400;font-size:.75rem">(optional — lets you also log in with email)</span></label>' +
          '<input type="password" id="ob-password" class="form-input" placeholder="Min. 8 characters" oninput="obCheckPasswords()">' +
        '</div>' +
        '<div>' +
          '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">Confirm password</label>' +
          '<input type="password" id="ob-password2" class="form-input" placeholder="Repeat password" oninput="obCheckPasswords()">' +
          '<div id="ob-pw-status" style="margin-top:5px;font-size:.78rem;min-height:18px"></div>' +
        '</div>') +
  '</div>';
}

// ── STEP 6: ACCOUNT TYPE ──────────────────────────────────────────

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
    '<div class="ob-step-kicker">Step 5 — Account Type</div>' +
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
    '<div class="ob-step-kicker">Step 6 — Interests</div>' +
    '<h2>What are you into?</h2>' +
    '<p>Your feed, AI suggestions, challenges, and groups will be built around your interests.</p>' +
    '<p class="ob-min-note">Pick at least 1</p>' +
  '</div>' +
  '<div class="ob-interest-grid">' + chips + '</div>' +
  '<div class="ob-select-count" id="ob-interest-count">' + interestCountText() + '</div>';
}

function interestCountText() {
  var n = obState.interests.length;
  if (n === 0) return 'Nothing selected yet — pick at least 1';
  return '<strong>' + n + '</strong> interest' + (n > 1 ? 's' : '') + ' selected ✓';
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
    '<div class="ob-step-kicker">Step 7 — Areas</div>' +
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
  renderStep(obState.step);
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
    '<div class="ob-step-kicker">Step 8 — Goals</div>' +
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
    '<div class="ob-step-kicker">Step 9 — Notifications</div>' +
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
  obState.firstName = ''; obState.lastName = ''; obState.username = ''; obState.usernameStatus = '';
  obState.birthday = ''; obState.gender = ''; obState.residentialCity = ''; obState.password = '';
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
    firstName:       obState.firstName || '',
    lastName:        obState.lastName  || '',
    username:        obState.username  || '',
    birthday:        obState.birthday  || '',
    gender:          obState.gender    || '',
    residentialCity: obState.residentialCity || '',
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
    var fullName = ((data.firstName || '') + ' ' + (data.lastName || '')).trim();
    var update = {
      onboardingComplete:    true,
      onboardingCompletedAt: fb.fs.serverTimestamp(),
      firstName:   data.firstName || '',
      lastName:    data.lastName  || '',
      username:    data.username  || '',
      birthday:    data.birthday  || '',
      gender:      data.gender    || '',
      city:        data.residentialCity || data.city || '',
      accountType: data.accountType || 'explorer',
      interests:   data.interests   || [],
      feedCity:    data.city        || 'all_georgia',
      cities:      data.cities      || [data.city || 'all_georgia'],
      goals:       data.goals       || [],
    };
    if (fullName) update.fullName = fullName;
    if (data.photoURL) { update.photoURL = data.photoURL; update.avatar = data.photoURL; }
    fb.fs.updateDoc(fb.fs.doc(fb.db, 'users', user.uid), update).catch(function () {});
    // Optionally set password for social-login users
    if (obState.password && obState.password.length >= 8) {
      try {
        var hasPwd = user.providerData && user.providerData.some(function(p){ return p.providerId === 'password'; });
        if (!hasPwd && fb.authFns && fb.authFns.EmailAuthProvider && fb.authFns.linkWithCredential) {
          var cred = fb.authFns.EmailAuthProvider.credential(user.email, obState.password);
          fb.authFns.linkWithCredential(user, cred).catch(function(){});
        } else if (hasPwd && fb.authFns && fb.authFns.updatePassword) {
          fb.authFns.updatePassword(user, obState.password).catch(function(){});
        }
      } catch(e) {}
    }
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
