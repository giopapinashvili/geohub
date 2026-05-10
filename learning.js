/* ================================================================
   GeoHub — Teachers / Courses / Mentors System
   ================================================================ */

// ======================== MOCK DATA ========================
const MOCK_TEACHERS = [
  {
    id: 'tc01', name: 'Sopho Gachechiladze', username: 'sopho_teach',
    avatar: 'https://i.pravatar.cc/100?img=47',
    subjects: ['English', 'IELTS Prep', 'Business English'],
    city: 'Tbilisi', online: true, offline: true,
    pricePerLesson: 40, currency: 'GEL',
    rating: 4.9, reviewCount: 134, studentsCount: 312,
    trustScore: 912, verified: true, featured: true,
    level: 'Expert', experience: 8,
    badges: ['Top Rated', 'Fast Response', 'IELTS Certified'],
    bio: 'Cambridge CELTA-certified English teacher with 8 years of experience. Specialised in IELTS preparation — 97% of my students reach their target band score. Native-level fluency, patient and structured approach.',
    languages: ['Georgian', 'English', 'Russian'],
    schedule: ['Mon 10:00–18:00', 'Wed 10:00–18:00', 'Fri 12:00–20:00', 'Sat 10:00–16:00'],
    certificates: ['Cambridge CELTA', 'IELTS Examiner Certification', 'British Council Partner'],
    recentResults: [
      { student: 'Ana M.',   result: 'IELTS 7.5 achieved', date: '3 days ago' },
      { student: 'Giorgi T.', result: 'Band 8.0 — scholarship won', date: '2 weeks ago' },
      { student: 'Nino B.',  result: 'IELTS 6.5 first attempt', date: '1 month ago' },
    ],
    reviews: [
      { name: 'Luka D.', rating: 5, text: 'Best teacher I ever had. Went from 5.0 to 7.0 in 3 months!', date: '1 week ago' },
      { name: 'Mariam K.', rating: 5, text: 'Very patient and structured. Highly recommend for IELTS prep.', date: '3 weeks ago' },
    ],
  },
  {
    id: 'tc02', name: 'Davit Kvirikashvili', username: 'davit_code',
    avatar: 'https://i.pravatar.cc/100?img=60',
    subjects: ['Python', 'Machine Learning', 'Data Science'],
    city: 'Tbilisi', online: true, offline: false,
    pricePerLesson: 80, currency: 'GEL',
    rating: 4.8, reviewCount: 87, studentsCount: 198,
    trustScore: 891, verified: true, featured: true,
    level: 'Expert', experience: 6,
    badges: ['Top Rated', 'AI Specialist'],
    bio: 'Senior ML Engineer at a Tbilisi tech company. Teach Python, data science and machine learning from fundamentals to advanced deployment. Real project-based learning approach.',
    languages: ['Georgian', 'English'],
    schedule: ['Tue 19:00–22:00', 'Thu 19:00–22:00', 'Sat 11:00–18:00', 'Sun 11:00–15:00'],
    certificates: ['Google ML Certificate', 'AWS Machine Learning Specialty', 'TensorFlow Developer'],
    recentResults: [
      { student: 'Giorgi A.', result: 'Got hired as Junior Data Analyst', date: '2 weeks ago' },
      { student: 'Tamar G.', result: 'Completed Kaggle competition top 15%', date: '1 month ago' },
    ],
    reviews: [
      { name: 'Irakli M.', rating: 5, text: 'Explains complex ML concepts in a very clear way. Practical lessons with real projects.', date: '2 weeks ago' },
    ],
  },
  {
    id: 'tc03', name: 'Nino Arabidze', username: 'nino_art',
    avatar: 'https://i.pravatar.cc/100?img=9',
    subjects: ['Drawing', 'Watercolour', 'Digital Art'],
    city: 'Tbilisi', online: true, offline: true,
    pricePerLesson: 35, currency: 'GEL',
    rating: 4.9, reviewCount: 211, studentsCount: 487,
    trustScore: 934, verified: true, featured: false,
    level: 'Expert', experience: 11,
    badges: ['Top Rated', 'Most Popular', 'Fast Response'],
    bio: 'Professional illustrator and art educator. I teach drawing from zero to professional portfolio level. All ages welcome — children, teens and adults. My students regularly exhibit their work.',
    languages: ['Georgian', 'English'],
    schedule: ['Mon 14:00–19:00', 'Tue 14:00–19:00', 'Sat 10:00–18:00'],
    certificates: ['Tbilisi State Academy of Arts (MFA)', 'Adobe Certified Expert'],
    recentResults: [
      { student: 'Salome T.', result: 'Portfolio accepted to art school', date: '1 week ago' },
      { student: 'Beka A.', result: 'First paid commission received', date: '3 weeks ago' },
    ],
    reviews: [
      { name: 'Mariam E.', rating: 5, text: 'Started from zero, now I sell my art online. Nino is an amazing teacher!', date: '1 week ago' },
      { name: 'Sandro P.', rating: 5, text: 'Perfect for beginners. Very encouraging and patient.', date: '2 months ago' },
    ],
  },
  {
    id: 'tc04', name: 'Giorgi Tabatadze', username: 'giorgi_music',
    avatar: 'https://i.pravatar.cc/100?img=52',
    subjects: ['Guitar', 'Music Theory', 'Songwriting'],
    city: 'Batumi', online: true, offline: true,
    pricePerLesson: 30, currency: 'GEL',
    rating: 4.7, reviewCount: 63, studentsCount: 141,
    trustScore: 823, verified: true, featured: false,
    level: 'Advanced', experience: 9,
    badges: ['Verified', 'Musicians Guild'],
    bio: 'Classically trained guitarist and composer. I teach acoustic, electric and classical guitar. From first chords to full song composition and recording. Students of all ages.',
    languages: ['Georgian', 'English', 'Russian'],
    schedule: ['Mon 15:00–20:00', 'Wed 15:00–20:00', 'Sat 12:00–18:00'],
    certificates: ['Batumi Music Conservatory', 'Royal College of Music Online Certificate'],
    recentResults: [
      { student: 'Luka T.', result: 'Performed at Batumi Jazz Festival', date: '2 months ago' },
    ],
    reviews: [
      { name: 'Ana K.', rating: 5, text: 'Giorgi makes every lesson fun. I learned my first song in week 3!', date: '1 month ago' },
    ],
  },
  {
    id: 'tc05', name: 'Tamar Lomidze', username: 'tamar_math',
    avatar: 'https://i.pravatar.cc/100?img=26',
    subjects: ['Mathematics', 'Physics', 'SAT/ACT Prep'],
    city: 'Tbilisi', online: true, offline: true,
    pricePerLesson: 45, currency: 'GEL',
    rating: 4.8, reviewCount: 96, studentsCount: 229,
    trustScore: 878, verified: true, featured: false,
    level: 'Expert', experience: 7,
    badges: ['Top Rated', 'Exam Specialist'],
    bio: 'Mathematics and Physics teacher with 7 years in exam preparation. Specialised in university entrance exams, SAT and international olympiad preparation. Success rate above 90%.',
    languages: ['Georgian', 'English'],
    schedule: ['Mon–Fri 16:00–21:00', 'Sat 10:00–16:00'],
    certificates: ['Tbilisi State University (Mathematics)', 'SAT Official Tutor Certification'],
    recentResults: [
      { student: 'Nika M.', result: 'SAT 1480 — full scholarship', date: '1 month ago' },
      { student: 'Salome D.', result: 'Physics olympiad 2nd place', date: '3 months ago' },
    ],
    reviews: [
      { name: 'Beka K.', rating: 5, text: 'Went from failing math to top of my class in 2 months. Incredible teacher!', date: '2 weeks ago' },
    ],
  },
  {
    id: 'tc06', name: 'Levan Mchedlishvili', username: 'levan_chef',
    avatar: 'https://i.pravatar.cc/100?img=64',
    subjects: ['Georgian Cooking', 'European Cuisine', 'Baking'],
    city: 'Tbilisi', online: false, offline: true,
    pricePerLesson: 55, currency: 'GEL',
    rating: 4.9, reviewCount: 78, studentsCount: 156,
    trustScore: 856, verified: true, featured: false,
    level: 'Expert', experience: 14,
    badges: ['Verified', 'Chef Pro', 'Fast Response'],
    bio: 'Head chef and culinary instructor. 14 years of experience in Georgian, Mediterranean and European cuisine. Classes held in a fully equipped kitchen studio in Vake. Groups and private sessions available.',
    languages: ['Georgian', 'English'],
    schedule: ['Tue 11:00–14:00', 'Thu 11:00–14:00', 'Sat 11:00–17:00'],
    certificates: ['Le Cordon Bleu', 'Georgian Culinary Federation Member'],
    recentResults: [
      { student: 'Mariam P.', result: 'Opened her own café in Mtatsminda', date: '6 months ago' },
    ],
    reviews: [
      { name: 'Gio A.', rating: 5, text: 'The best cooking class in Tbilisi, no question. Levan is a genius in the kitchen.', date: '1 month ago' },
    ],
  },
  {
    id: 'tc07', name: 'Ana Gorgadze', username: 'ana_german',
    avatar: 'https://i.pravatar.cc/100?img=44',
    subjects: ['German', 'French', 'Linguistics'],
    city: 'Tbilisi', online: true, offline: false,
    pricePerLesson: 50, currency: 'GEL',
    rating: 4.6, reviewCount: 51, studentsCount: 103,
    trustScore: 811, verified: false, featured: false,
    level: 'Advanced', experience: 5,
    badges: ['Language Expert'],
    bio: 'European languages specialist — German (C2), French (C1). I prepare students for Goethe-Institut and DELF exams. Conversational and exam-focused tracks available. Small groups or 1-on-1.',
    languages: ['Georgian', 'German', 'French', 'English'],
    schedule: ['Mon 18:00–21:00', 'Wed 18:00–21:00', 'Fri 18:00–21:00'],
    certificates: ['Goethe-Institut Certified Instructor', 'DELF B2 Examiner'],
    recentResults: [
      { student: 'Keti B.', result: 'Goethe B2 passed — job in Germany secured', date: '2 months ago' },
    ],
    reviews: [
      { name: 'Natia G.', rating: 5, text: 'Ana made German feel approachable. Great methodology and lots of practice materials.', date: '3 weeks ago' },
    ],
  },
  {
    id: 'tc08', name: 'Irakli Beridze', username: 'irakli_fitness',
    avatar: 'https://i.pravatar.cc/100?img=57',
    subjects: ['Personal Training', 'Nutrition', 'Yoga'],
    city: 'Tbilisi', online: true, offline: true,
    pricePerLesson: 60, currency: 'GEL',
    rating: 4.8, reviewCount: 144, studentsCount: 267,
    trustScore: 869, verified: true, featured: true,
    level: 'Expert', experience: 10,
    badges: ['Top Rated', 'Certified Trainer', 'Fast Response'],
    bio: 'Personal fitness trainer and certified nutritionist. 10 years of experience transforming body composition and performance. Online and in-person sessions. Customised programmes for every client.',
    languages: ['Georgian', 'English'],
    schedule: ['Mon–Fri 07:00–10:00', 'Mon–Fri 18:00–21:00', 'Sat 08:00–14:00'],
    certificates: ['NSCA Certified Personal Trainer', 'Precision Nutrition Level 2', 'Yoga Alliance RYT-200'],
    recentResults: [
      { student: 'Nika P.', result: '-18kg in 4 months', date: '1 month ago' },
      { student: 'Salome M.', result: 'First marathon completed', date: '2 months ago' },
    ],
    reviews: [
      { name: 'Giorgi L.', rating: 5, text: 'Completely transformed my lifestyle. Irakli is motivating and very knowledgeable.', date: '2 weeks ago' },
    ],
  },
];

const MOCK_COURSES = [
  {
    id: 'co01', title: 'IELTS 7+ Blueprint', category: 'Languages',
    level: 'Intermediate', duration: '8 weeks', lessons: 24,
    price: 299, currency: 'GEL', free: false,
    teacherId: 'tc01', enrolled: 1247, xpReward: 500, hasCertificate: true, featured: true,
    cover: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&q=80',
    description: 'Complete IELTS Academic preparation covering all 4 skills. Proven methodology with 97% success rate.',
    tags: ['IELTS', 'Academic', 'English'],
  },
  {
    id: 'co02', title: 'Python for Data Science', category: 'Technology',
    level: 'Beginner', duration: '10 weeks', lessons: 30,
    price: 0, currency: 'GEL', free: true,
    teacherId: 'tc02', enrolled: 3421, xpReward: 350, hasCertificate: true, featured: true,
    cover: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&q=80',
    description: 'Learn Python from scratch and apply it to real data science problems. Includes pandas, matplotlib, scikit-learn.',
    tags: ['Python', 'Data', 'Free'],
  },
  {
    id: 'co03', title: 'Watercolour Foundations', category: 'Arts & Crafts',
    level: 'Beginner', duration: '4 weeks', lessons: 12,
    price: 149, currency: 'GEL', free: false,
    teacherId: 'tc03', enrolled: 892, xpReward: 200, hasCertificate: false, featured: false,
    cover: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&q=80',
    description: 'Master watercolour painting from the very first brushstroke. Tools, mixing, washes, and your first full scene.',
    tags: ['Art', 'Watercolour', 'Beginner'],
  },
  {
    id: 'co04', title: 'Machine Learning A–Z', category: 'Technology',
    level: 'Advanced', duration: '16 weeks', lessons: 48,
    price: 549, currency: 'GEL', free: false,
    teacherId: 'tc02', enrolled: 678, xpReward: 800, hasCertificate: true, featured: true,
    cover: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=600&q=80',
    description: 'End-to-end ML course: regression, classification, clustering, deep learning, and model deployment.',
    tags: ['ML', 'AI', 'Deep Learning'],
  },
  {
    id: 'co05', title: 'SAT Math Masterclass', category: 'Academics',
    level: 'Intermediate', duration: '6 weeks', lessons: 18,
    price: 249, currency: 'GEL', free: false,
    teacherId: 'tc05', enrolled: 543, xpReward: 300, hasCertificate: true, featured: false,
    cover: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&q=80',
    description: 'Targeted SAT Math preparation with real past papers, strategies and personalised feedback.',
    tags: ['SAT', 'Math', 'Exam Prep'],
  },
  {
    id: 'co06', title: 'Georgian Cuisine Masterclass', category: 'Cooking',
    level: 'Beginner', duration: '3 weeks', lessons: 9,
    price: 199, currency: 'GEL', free: false,
    teacherId: 'tc06', enrolled: 317, xpReward: 150, hasCertificate: false, featured: false,
    cover: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80',
    description: 'Cook authentic Georgian dishes from scratch — khinkali, khachapuri, lobiani, satsivi and more.',
    tags: ['Cooking', 'Georgian', 'Beginner'],
  },
  {
    id: 'co07', title: 'Guitar Zero to Hero', category: 'Music',
    level: 'Beginner', duration: '12 weeks', lessons: 36,
    price: 0, currency: 'GEL', free: true,
    teacherId: 'tc04', enrolled: 2187, xpReward: 400, hasCertificate: false, featured: false,
    cover: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&q=80',
    description: 'Complete beginner guitar course. No experience needed. From first chord to playing full songs.',
    tags: ['Guitar', 'Music', 'Free'],
  },
  {
    id: 'co08', title: 'Goethe B1 German Prep', category: 'Languages',
    level: 'Intermediate', duration: '8 weeks', lessons: 24,
    price: 349, currency: 'GEL', free: false,
    teacherId: 'tc07', enrolled: 421, xpReward: 400, hasCertificate: true, featured: false,
    cover: 'https://images.unsplash.com/photo-1527866959252-deab85ef7d1b?w=600&q=80',
    description: 'Structured preparation for the Goethe-Institut B1 exam. Grammar, vocabulary, reading, writing and oral exam mock.',
    tags: ['German', 'Goethe', 'B1'],
  },
  {
    id: 'co09', title: 'Body Transformation 90 Days', category: 'Fitness',
    level: 'Intermediate', duration: '12 weeks', lessons: 36,
    price: 449, currency: 'GEL', free: false,
    teacherId: 'tc08', enrolled: 934, xpReward: 600, hasCertificate: true, featured: true,
    cover: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
    description: 'Full 90-day body transformation programme. Training plan + nutrition guide + weekly check-ins.',
    tags: ['Fitness', 'Nutrition', 'Transformation'],
  },
  {
    id: 'co10', title: 'Digital Art Fundamentals', category: 'Arts & Crafts',
    level: 'Beginner', duration: '6 weeks', lessons: 18,
    price: 0, currency: 'GEL', free: true,
    teacherId: 'tc03', enrolled: 1834, xpReward: 250, hasCertificate: false, featured: false,
    cover: 'https://images.unsplash.com/photo-1561998338-13ad7883b20f?w=600&q=80',
    description: 'Introduction to digital illustration using Procreate and Photoshop. Brushes, layers, colour theory and your first character.',
    tags: ['Digital Art', 'Procreate', 'Free'],
  },
];

const CATEGORIES = ['All', 'Languages', 'Technology', 'Arts & Crafts', 'Academics', 'Music', 'Cooking', 'Fitness'];

// ======================== STATE ========================
let lrState = {
  view: 'teachers', q: '', category: 'All', mode: 'all',
  city: 'all', priceMin: '', priceMax: '', level: 'all',
  verified: false, free: false, highRating: false, sort: 'featured',
};
let savedTeachers = window.safeStorage.get('gh_saved_teachers', []);
let savedCourses  = window.safeStorage.get('gh_saved_courses',  []);
let myBookings    = window.safeStorage.get('gh_bookings',        []);
let myCourses     = window.safeStorage.get('gh_my_courses',      []);
let learningXP    = window.safeStorage.get('gh_learning_xp',     0);

// ======================== HELPERS ========================
function getTeacher(id) { return MOCK_TEACHERS.find(t => t.id === id) || MOCK_TEACHERS[0]; }
function stars(r) {
  const full = Math.floor(r), half = r % 1 >= 0.5;
  return '<span class="lr-stars">'
    + '<i class="fas fa-star"></i>'.repeat(full)
    + (half ? '<i class="fas fa-star-half-alt"></i>' : '')
    + '<i class="far fa-star"></i>'.repeat(5 - full - (half ? 1 : 0))
    + '</span>';
}
function levelColor(lv) { return lv === 'Beginner' ? '#10b981' : lv === 'Intermediate' ? '#f59e0b' : '#a78bfa'; }
function fmtK(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n; }

// ======================== FILTERS ========================
function applyLrFilters() {
  const f = lrState;
  const view = f.view;

  if (view === 'teachers') {
    let list = [...MOCK_TEACHERS];
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(t => t.name.toLowerCase().includes(q) || t.subjects.some(s => s.toLowerCase().includes(q))); }
    if (f.category !== 'All') { const catMap = { Languages: ['English','German','French','Linguistics'], Technology: ['Python','Machine Learning','Data Science'], 'Arts & Crafts': ['Drawing','Watercolour','Digital Art'], Music: ['Guitar','Music Theory','Songwriting'], Cooking: ['Georgian Cooking','European Cuisine','Baking'], Fitness: ['Personal Training','Nutrition','Yoga'], Academics: ['Mathematics','Physics','SAT/ACT Prep'] }; const allowed = catMap[f.category] || []; list = list.filter(t => t.subjects.some(s => allowed.includes(s))); }
    if (f.mode !== 'all') list = list.filter(t => f.mode === 'online' ? t.online : t.offline);
    if (f.city !== 'all') list = list.filter(t => t.city === f.city);
    if (f.priceMin) list = list.filter(t => t.pricePerLesson >= Number(f.priceMin));
    if (f.priceMax) list = list.filter(t => t.pricePerLesson <= Number(f.priceMax));
    if (f.verified) list = list.filter(t => t.verified);
    if (f.highRating) list = list.filter(t => t.rating >= 4.8);
    if (f.sort === 'featured') list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    else if (f.sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    else if (f.sort === 'price-asc') list.sort((a, b) => a.pricePerLesson - b.pricePerLesson);
    else if (f.sort === 'price-desc') list.sort((a, b) => b.pricePerLesson - a.pricePerLesson);
    else if (f.sort === 'students') list.sort((a, b) => b.studentsCount - a.studentsCount);
    const grid = document.getElementById('teachersGrid');
    const empty = document.getElementById('lrEmpty');
    const countEl = document.getElementById('lrCount');
    if (countEl) countEl.textContent = list.length + ' teacher' + (list.length !== 1 ? 's' : '');
    if (!list.length) { grid.innerHTML = ''; if (empty) empty.style.display = 'flex'; return; }
    if (empty) empty.style.display = 'none';
    grid.innerHTML = list.map(renderTeacherCard).join('');
  } else {
    let list = [...MOCK_COURSES];
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(c => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)); }
    if (f.category !== 'All') list = list.filter(c => c.category === f.category);
    if (f.level !== 'all') list = list.filter(c => c.level === f.level);
    if (f.free) list = list.filter(c => c.free);
    if (f.sort === 'featured') list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    else if (f.sort === 'students') list.sort((a, b) => b.enrolled - a.enrolled);
    else if (f.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    const grid = document.getElementById('coursesGrid');
    const empty = document.getElementById('lrEmpty');
    const countEl = document.getElementById('lrCount');
    if (countEl) countEl.textContent = list.length + ' course' + (list.length !== 1 ? 's' : '');
    if (!list.length) { grid.innerHTML = ''; if (empty) empty.style.display = 'flex'; return; }
    if (empty) empty.style.display = 'none';
    grid.innerHTML = list.map(renderCourseCard).join('');
  }
}

// ======================== TEACHER CARD ========================
function renderTeacherCard(tc) {
  const saved = savedTeachers.includes(tc.id);
  return `
    <div class="lr-teacher-card animate-fade-up">
      <div class="tc-header">
        <img src="${tc.avatar}" class="tc-avatar" alt="${tc.name}" onerror="this.src='https://i.pravatar.cc/100?img=1'">
        <button class="tc-save ${saved ? 'saved' : ''}" onclick="toggleSaveTeacher('${tc.id}',this)">
          <i class="${saved ? 'fas' : 'far'} fa-heart"></i>
        </button>
        ${tc.featured ? '<div class="tc-featured"><i class="fas fa-star"></i></div>' : ''}
      </div>
      <div class="tc-body">
        <div class="tc-name">${tc.name} ${tc.verified ? '<i class="fas fa-check-circle" style="color:#3b82f6;font-size:0.78rem"></i>' : ''}</div>
        <div class="tc-subjects">${tc.subjects.slice(0, 2).join(' · ')}</div>
        <div class="tc-meta">
          <span><i class="fas fa-map-marker-alt"></i> ${tc.city}</span>
          ${tc.online ? '<span class="tc-mode online"><i class="fas fa-wifi"></i> Online</span>' : ''}
          ${tc.offline ? '<span class="tc-mode offline"><i class="fas fa-building"></i> In-person</span>' : ''}
        </div>
        <div class="tc-rating-row">
          ${stars(tc.rating)}
          <span class="tc-rating-num">${tc.rating}</span>
          <span class="tc-review-count">(${tc.reviewCount})</span>
        </div>
        <div class="tc-stats-row">
          <span><i class="fas fa-users"></i> ${fmtK(tc.studentsCount)} students</span>
          <span><i class="fas fa-shield-alt" style="color:#10b981"></i> ${tc.trustScore}</span>
          <span><i class="fas fa-graduation-cap"></i> ${tc.experience}yr exp</span>
        </div>
        <div class="tc-badges">
          ${tc.badges.slice(0, 2).map(b => `<span class="tc-badge">${b}</span>`).join('')}
        </div>
        <div class="tc-price"><span class="tc-price-from">From</span> <strong>${tc.pricePerLesson} ${tc.currency}</strong><span class="tc-price-per"> / lesson</span></div>
        <div class="tc-actions">
          <button class="lr-btn-primary" onclick="openTeacherDetail('${tc.id}')"><i class="fas fa-eye"></i> View</button>
          <button class="lr-btn-secondary" onclick="window.location.href='messages.html?user='+encodeURIComponent('${tc.username}')"><i class="fas fa-comment"></i></button>
          <button class="lr-btn-book" onclick="openBooking('${tc.id}')"><i class="fas fa-calendar-check"></i> Book</button>
        </div>
      </div>
    </div>`;
}

// ======================== COURSE CARD ========================
function renderCourseCard(co) {
  const tc = getTeacher(co.teacherId);
  const enrolled = myCourses.includes(co.id);
  return `
    <div class="lr-course-card animate-fade-up" onclick="openCourseDetail('${co.id}')">
      <div class="co-img-wrap">
        <img src="${co.cover}" alt="${co.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&q=80'">
        ${co.featured ? '<div class="co-featured"><i class="fas fa-star"></i> Featured</div>' : ''}
        ${co.free ? '<div class="co-free">Free</div>' : ''}
        ${co.hasCertificate ? '<div class="co-cert"><i class="fas fa-certificate"></i></div>' : ''}
      </div>
      <div class="co-body">
        <div class="co-top">
          <span class="co-cat">${co.category}</span>
          <span class="co-level" style="color:${levelColor(co.level)}">${co.level}</span>
        </div>
        <div class="co-title">${co.title}</div>
        <div class="co-teacher-row">
          <img src="${tc.avatar}" class="co-tc-av" alt="${tc.name}">
          <span>${tc.name}</span>
        </div>
        <div class="co-meta">
          <span><i class="fas fa-clock"></i> ${co.duration}</span>
          <span><i class="fas fa-book"></i> ${co.lessons} lessons</span>
          <span><i class="fas fa-users"></i> ${fmtK(co.enrolled)}</span>
        </div>
        <div class="co-footer">
          <div class="co-price">${co.free ? '<span class="co-price-free">Free</span>' : `<span class="co-price-num">${co.price} ${co.currency}</span>`}</div>
          <div class="co-xp"><i class="fas fa-bolt"></i> +${co.xpReward} XP</div>
          ${enrolled ? '<div class="co-enrolled"><i class="fas fa-check-circle"></i> Enrolled</div>' : ''}
        </div>
      </div>
    </div>`;
}

// ======================== TEACHER DETAIL MODAL ========================
function openTeacherDetail(id) {
  const tc = MOCK_TEACHERS.find(t => t.id === id);
  if (!tc) return;
  const saved = savedTeachers.includes(id);

  document.getElementById('teacherDetailContent').innerHTML = `
    <div class="td-hero">
      <img src="${tc.avatar}" class="td-avatar" alt="${tc.name}" onerror="this.src='https://i.pravatar.cc/100?img=1'">
      <div class="td-hero-info">
        <div class="td-name">${tc.name} ${tc.verified ? '<span class="td-verified"><i class="fas fa-check-circle"></i> Verified</span>' : ''}</div>
        <div class="td-subjects">${tc.subjects.join(' · ')}</div>
        <div class="td-city"><i class="fas fa-map-marker-alt" style="color:#10b981"></i> ${tc.city} · ${tc.online ? '<span style="color:#10b981"><i class="fas fa-wifi"></i> Online</span>' : ''} ${tc.offline ? '<span style="color:#a78bfa"><i class="fas fa-building"></i> In-person</span>' : ''}</div>
        <div class="td-rating-row">
          ${stars(tc.rating)} <strong>${tc.rating}</strong> <span style="color:var(--text-muted)">(${tc.reviewCount} reviews)</span>
          <span class="td-trust"><i class="fas fa-shield-alt" style="color:#10b981"></i> ${tc.trustScore} Trust</span>
        </div>
        <div class="td-badges-row">${tc.badges.map(b => `<span class="tc-badge">${b}</span>`).join('')}</div>
      </div>
      <div class="td-price-box">
        <div class="td-price-num">${tc.pricePerLesson} ${tc.currency}</div>
        <div class="td-price-lbl">per lesson</div>
        <button class="lr-btn-primary" style="width:100%;margin-top:12px" onclick="closeLrModal('teacherDetailModal');openBooking('${tc.id}')"><i class="fas fa-calendar-check"></i> Book Lesson</button>
        <button class="lr-btn-secondary" style="width:100%;margin-top:8px" onclick="window.location.href='messages.html?user='+encodeURIComponent('${tc.username}')"><i class="fas fa-comment"></i> Message</button>
        <button class="td-save-btn ${saved ? 'saved' : ''}" id="tdSaveBtn" onclick="toggleSaveTeacher('${tc.id}',this)">
          <i class="${saved ? 'fas' : 'far'} fa-heart"></i> ${saved ? 'Saved' : 'Save'}
        </button>
        <button class="td-report-btn" onclick="closeLrModal('teacherDetailModal');window.location.href='trust.html?report=bad_behavior&target='+encodeURIComponent('${tc.name}')"><i class="fas fa-flag"></i> Report</button>
      </div>
    </div>

    <div class="td-body">
      <div class="td-main">
        <div class="td-section-title">About</div>
        <p class="td-bio">${tc.bio}</p>

        <div class="td-section-title">Languages</div>
        <div class="td-tags">${tc.languages.map(l => `<span class="td-tag">${l}</span>`).join('')}</div>

        <div class="td-section-title">Schedule</div>
        <div class="td-schedule">${tc.schedule.map(s => `<div class="td-sched-row"><i class="fas fa-clock" style="color:var(--green-light)"></i> ${s}</div>`).join('')}</div>

        <div class="td-section-title">Certificates</div>
        <div class="td-certs">${tc.certificates.map(c => `<div class="td-cert-row"><i class="fas fa-certificate" style="color:#f59e0b"></i> ${c}</div>`).join('')}</div>

        <div class="td-section-title">Trust Indicators</div>
        <div class="td-trust-row">
          <div class="trust-ind"><i class="fas fa-shield-alt" style="color:#10b981"></i> Trust Score ${tc.trustScore}</div>
          <div class="trust-ind"><i class="fas fa-users" style="color:#a78bfa"></i> ${fmtK(tc.studentsCount)} Students</div>
          <div class="trust-ind"><i class="fas fa-graduation-cap" style="color:#f59e0b"></i> ${tc.experience} Years Exp</div>
          ${tc.verified ? '<div class="trust-ind"><i class="fas fa-check-circle" style="color:#3b82f6"></i> GeoHub Verified</div>' : ''}
        </div>

        <div class="td-section-title">Recent Student Results</div>
        <div class="td-results">${tc.recentResults.map(r => `
          <div class="td-result-item">
            <i class="fas fa-trophy" style="color:#f59e0b"></i>
            <div>
              <div class="td-result-student">${r.student}</div>
              <div class="td-result-text">${r.result}</div>
              <div class="td-result-date">${r.date}</div>
            </div>
          </div>`).join('')}</div>

        <div class="td-section-title">Reviews</div>
        <div class="td-reviews">${tc.reviews.map(r => `
          <div class="td-review">
            <div class="td-review-header">
              <strong>${r.name}</strong>
              <div>${stars(r.rating)}</div>
              <span style="color:var(--text-muted);font-size:0.72rem">${r.date}</span>
            </div>
            <p class="td-review-text">${r.text}</p>
          </div>`).join('')}</div>
      </div>
    </div>`;

  openLrModal('teacherDetailModal');
}

// ======================== COURSE DETAIL MODAL ========================
function openCourseDetail(id) {
  const co = MOCK_COURSES.find(c => c.id === id);
  if (!co) return;
  const tc = getTeacher(co.teacherId);
  const enrolled = myCourses.includes(id);

  document.getElementById('courseDetailContent').innerHTML = `
    <div class="cd-hero">
      <img src="${co.cover}" class="cd-cover" alt="${co.title}">
    </div>
    <div class="cd-body">
      <div class="cd-main">
        <div class="cd-top-row">
          <span class="co-cat">${co.category}</span>
          <span class="co-level" style="color:${levelColor(co.level)}">${co.level}</span>
          ${co.hasCertificate ? '<span class="co-cat" style="color:#f59e0b;background:rgba(245,158,11,0.1)"><i class="fas fa-certificate"></i> Certificate</span>' : ''}
        </div>
        <div class="cd-title">${co.title}</div>
        <div class="td-rating-row" style="margin-bottom:12px">
          <span><i class="fas fa-users" style="color:#a78bfa"></i> ${fmtK(co.enrolled)} enrolled</span>
          <span style="margin-left:12px"><i class="fas fa-clock" style="color:#f59e0b"></i> ${co.duration}</span>
          <span style="margin-left:12px"><i class="fas fa-book" style="color:#3b82f6"></i> ${co.lessons} lessons</span>
        </div>
        <p class="td-bio">${co.description}</p>
        <div class="cd-tags">${co.tags.map(t => `<span class="td-tag">${t}</span>`).join('')}</div>

        <div class="td-section-title" style="margin-top:20px">Your Teacher</div>
        <div class="cd-teacher-card" onclick="closeLrModal('courseDetailModal');openTeacherDetail('${tc.id}')">
          <img src="${tc.avatar}" alt="${tc.name}" class="co-tc-av" style="width:44px;height:44px">
          <div>
            <div style="font-weight:700;font-size:0.88rem">${tc.name}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${tc.subjects.slice(0,2).join(' · ')}</div>
          </div>
          <div class="trust-ind" style="margin-left:auto"><i class="fas fa-shield-alt" style="color:#10b981"></i> ${tc.trustScore}</div>
        </div>
      </div>
      <div class="cd-sidebar">
        <div class="cd-price-box">
          <div class="cd-price">${co.free ? '<span class="co-price-free" style="font-size:1.5rem">Free</span>' : `<span class="co-price-num" style="font-size:1.5rem">${co.price} ${co.currency}</span>`}</div>
          <div class="co-xp" style="font-size:0.85rem;margin-bottom:14px"><i class="fas fa-bolt"></i> +${co.xpReward} XP on completion</div>
          <button class="lr-btn-primary" style="width:100%;padding:13px" onclick="${enrolled ? '' : `enrollCourse('${co.id}',this)`}" ${enrolled ? 'disabled style="opacity:0.6;cursor:not-allowed"' : ''}>
            ${enrolled ? '<i class="fas fa-check-circle"></i> Enrolled' : '<i class="fas fa-graduation-cap"></i> Enrol Now'}
          </button>
          <button class="lr-btn-secondary" style="width:100%;margin-top:8px" onclick="window.location.href='messages.html?user='+encodeURIComponent('${tc.username}')"><i class="fas fa-comment"></i> Ask Teacher</button>
        </div>
      </div>
    </div>`;

  openLrModal('courseDetailModal');
}

function enrollCourse(id, btn) {
  if (!myCourses.includes(id)) {
    myCourses.push(id);
    window.safeStorage.set('gh_my_courses', myCourses);
    const co = MOCK_COURSES.find(c => c.id === id);
    if (co) { learningXP += co.xpReward; window.safeStorage.set('gh_learning_xp', learningXP); }
  }
  if (btn) { btn.innerHTML = '<i class="fas fa-check-circle"></i> Enrolled'; btn.disabled = true; btn.style.opacity = '0.6'; }
  showLrToast('Enrolled! Check your Student Dashboard.');
}

// ======================== BOOKING MODAL ========================
function openBooking(teacherId) {
  document.getElementById('bookingWrap')?.classList.remove('hidden');
  document.getElementById('bookingSuccess')?.classList.add('hidden');
  document.getElementById('bookTeacherId').value = teacherId;
  const tc = getTeacher(teacherId);
  const nameEl = document.getElementById('bookTeacherName');
  const avEl   = document.getElementById('bookTeacherAv');
  const priceEl = document.getElementById('bookPrice');
  if (nameEl) nameEl.textContent = tc.name;
  if (avEl)   avEl.src = tc.avatar;
  if (priceEl) priceEl.textContent = tc.pricePerLesson + ' ' + tc.currency + ' / lesson';
  const dateInput = document.getElementById('bookDate');
  if (dateInput) { const d = new Date(); dateInput.min = d.toISOString().split('T')[0]; }
  openLrModal('bookingModal');
}
function submitBooking() {
  const date  = document.getElementById('bookDate')?.value;
  const time  = document.getElementById('bookTime')?.value;
  const type  = document.getElementById('bookType')?.value;
  const msg   = document.getElementById('bookMsg')?.value?.trim();
  const errEl = document.getElementById('bookError');
  if (!date || !time) { if (errEl) { errEl.textContent = 'Please select a date and time.'; errEl.classList.remove('hidden'); } return; }
  if (errEl) errEl.classList.add('hidden');
  const tcId = document.getElementById('bookTeacherId').value;
  const tc = getTeacher(tcId);
  myBookings.unshift({ id: 'bk_' + Date.now(), teacherId: tcId, teacherName: tc.name, date, time, type: type || 'Standard Lesson', message: msg, status: 'confirmed', ts: Date.now() });
  window.safeStorage.set('gh_bookings', myBookings);
  document.getElementById('bookingWrap')?.classList.add('hidden');
  document.getElementById('bookingSuccess')?.classList.remove('hidden');
  renderDashboard();
}

// ======================== SAVE TEACHER ========================
function toggleSaveTeacher(id, btn) {
  const idx = savedTeachers.indexOf(id);
  if (idx === -1) { savedTeachers.push(id); if (btn) { btn.innerHTML = '<i class="fas fa-heart"></i>'; btn.classList.add('saved'); if (btn.classList.contains('td-save-btn')) btn.innerHTML = '<i class="fas fa-heart"></i> Saved'; } }
  else { savedTeachers.splice(idx, 1); if (btn) { btn.innerHTML = '<i class="far fa-heart"></i>'; btn.classList.remove('saved'); if (btn.classList.contains('td-save-btn')) btn.innerHTML = '<i class="far fa-heart"></i> Save'; } }
  window.safeStorage.set('gh_saved_teachers', savedTeachers);
}

// ======================== DASHBOARD ========================
function renderDashboard() {
  const xpEl = document.getElementById('dashXP');
  if (xpEl) xpEl.textContent = learningXP;

  const bookEl = document.getElementById('dashBookings');
  if (bookEl) {
    const upcoming = myBookings.filter(b => new Date(b.date) >= new Date()).slice(0, 4);
    if (!upcoming.length) { bookEl.innerHTML = '<div class="dash-empty">No upcoming lessons. <button class="dash-link" onclick="switchLrTab(\'teachers\')">Find a teacher</button></div>'; }
    else bookEl.innerHTML = upcoming.map(b => `
      <div class="dash-booking-item">
        <div class="dash-bk-date"><i class="fas fa-calendar" style="color:var(--green-light)"></i> ${b.date} at ${b.time}</div>
        <div class="dash-bk-teacher">${b.teacherName} — ${b.type}</div>
        <span class="dash-bk-status">Confirmed</span>
      </div>`).join('');
  }

  const savedEl = document.getElementById('dashSaved');
  if (savedEl) {
    const teachers = MOCK_TEACHERS.filter(t => savedTeachers.includes(t.id)).slice(0, 4);
    if (!teachers.length) { savedEl.innerHTML = '<div class="dash-empty">No saved teachers yet.</div>'; }
    else savedEl.innerHTML = teachers.map(tc => `
      <div class="dash-saved-item" onclick="openTeacherDetail('${tc.id}')">
        <img src="${tc.avatar}" alt="${tc.name}">
        <div>
          <div class="dash-saved-name">${tc.name}</div>
          <div class="dash-saved-sub">${tc.subjects[0]}</div>
        </div>
        <div class="dash-saved-price">${tc.pricePerLesson} GEL</div>
      </div>`).join('');
  }

  const coursesEl = document.getElementById('dashCourses');
  if (coursesEl) {
    const courses = MOCK_COURSES.filter(c => myCourses.includes(c.id)).slice(0, 4);
    if (!courses.length) { coursesEl.innerHTML = '<div class="dash-empty">No courses enrolled. <button class="dash-link" onclick="switchLrTab(\'courses\')">Browse courses</button></div>'; }
    else coursesEl.innerHTML = courses.map(co => `
      <div class="dash-course-item" onclick="openCourseDetail('${co.id}')">
        <img src="${co.cover}" alt="${co.title}">
        <div>
          <div class="dash-course-name">${co.title}</div>
          <div class="dash-course-meta">${co.duration} · +${co.xpReward} XP</div>
        </div>
        <i class="fas fa-check-circle" style="color:#10b981;margin-left:auto"></i>
      </div>`).join('');
  }

  const recEl = document.getElementById('dashRecommended');
  if (recEl) {
    const notEnrolled = MOCK_COURSES.filter(c => !myCourses.includes(c.id)).slice(0, 3);
    recEl.innerHTML = notEnrolled.map(co => `
      <div class="dash-course-item" onclick="openCourseDetail('${co.id}')">
        <img src="${co.cover}" alt="${co.title}">
        <div>
          <div class="dash-course-name">${co.title}</div>
          <div class="dash-course-meta">${co.free ? 'Free' : co.price + ' GEL'} · +${co.xpReward} XP</div>
        </div>
        <i class="fas fa-arrow-right" style="color:var(--text-muted);margin-left:auto"></i>
      </div>`).join('');
  }
}

// ======================== TABS ========================
function switchLrTab(tab, el) {
  document.querySelectorAll('.lr-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.lr-tab-panel').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  else document.querySelector(`.lr-tab[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById('panel-' + tab)?.classList.add('active');
  lrState.view = tab;

  const teachersGrid = document.getElementById('teachersGrid');
  const coursesGrid  = document.getElementById('coursesGrid');
  if (teachersGrid) teachersGrid.style.display = (tab === 'teachers' || tab === 'mentors') ? 'grid' : 'none';
  if (coursesGrid)  coursesGrid.style.display  = tab === 'courses' ? 'grid' : 'none';

  if (tab === 'mentors') {
    lrState.view = 'teachers';
    const f = lrState;
    let list = MOCK_TEACHERS.filter(t => t.experience >= 6 && t.trustScore >= 850);
    document.getElementById('teachersGrid').innerHTML = list.map(renderTeacherCard).join('');
    document.getElementById('lrCount').textContent = list.length + ' mentors';
    return;
  }
  if (tab === 'dashboard') { renderDashboard(); return; }
  applyLrFilters();
}

// ======================== MODAL HELPERS ========================
function openLrModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = 'flex';
  requestAnimationFrame(() => m.classList.add('open'));
}
function closeLrModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('open');
  setTimeout(() => { m.style.display = 'none'; }, 280);
}

// ======================== TOAST ========================
function showLrToast(msg) {
  const t = document.getElementById('lrToast');
  if (!t) return;
  t.textContent = msg; t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), 2800);
}

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => {
  applyLrFilters();
  renderDashboard();

  const qi = document.getElementById('lrSearchInput');
  if (qi) qi.addEventListener('input', () => { lrState.q = qi.value; applyLrFilters(); });

  const sortSel = document.getElementById('lrSortSelect');
  if (sortSel) sortSel.addEventListener('change', () => { lrState.sort = sortSel.value; applyLrFilters(); });

  document.querySelectorAll('.lr-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lr-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      lrState.mode = btn.dataset.mode;
      applyLrFilters();
    });
  });

  const citySel = document.getElementById('lrCityFilter');
  if (citySel) citySel.addEventListener('change', () => { lrState.city = citySel.value; applyLrFilters(); });

  document.querySelectorAll('.lr-level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lr-level-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      lrState.level = btn.dataset.level;
      applyLrFilters();
    });
  });

  const priceMin = document.getElementById('lrPriceMin');
  const priceMax = document.getElementById('lrPriceMax');
  if (priceMin) priceMin.addEventListener('input', () => { lrState.priceMin = priceMin.value; applyLrFilters(); });
  if (priceMax) priceMax.addEventListener('input', () => { lrState.priceMax = priceMax.value; applyLrFilters(); });

  ['lrVerified','lrFree','lrHighRating'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      if (id === 'lrVerified')   lrState.verified   = el.checked;
      if (id === 'lrFree')       lrState.free        = el.checked;
      if (id === 'lrHighRating') lrState.highRating  = el.checked;
      applyLrFilters();
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') ['teacherDetailModal','courseDetailModal','bookingModal'].forEach(closeLrModal);
  });
  ['teacherDetailModal','courseDetailModal','bookingModal'].forEach(id => {
    const m = document.getElementById(id);
    if (m) m.addEventListener('click', e => { if (e.target === m) closeLrModal(id); });
  });
});
