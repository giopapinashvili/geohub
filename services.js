/* ================================================================
   GeoHub — Marketplace / Services System
   ================================================================ */

// ======================== DATA ========================
const SV_CATEGORIES = ['All','Home Repair','Cleaning','Beauty','Photography','Design','Web Development','Fitness','Tour Guides','Drivers','Tutors','Event Services','Moving'];

const MOCK_PROVIDERS = [
  {
    id:'pv01', name:'Giorgi Khachidze', username:'giorgi_fix',
    avatar:'https://i.pravatar.cc/100?img=59',
    profession:'Plumber & Electrician', category:'Home Repair',
    city:'Tbilisi', district:'Vake', online:false, homeVisit:true, availableToday:true,
    priceFrom:80, currency:'GEL', priceUnit:'/ job',
    rating:4.9, reviewCount:312, completedJobs:841, responseRate:97,
    trustScore:923, verified:true, featured:true,
    badges:['Top Rated','Fast Response','Insured'],
    bio:'Licensed plumber and electrician with 12 years of experience. Emergency callouts available 7 days a week. All work guaranteed with a 6-month warranty. Tbilisi and suburbs covered.',
    services:[
      { name:'Pipe Repair', price:'From 80 GEL' },
      { name:'Electrical Wiring', price:'From 120 GEL' },
      { name:'Boiler Installation', price:'From 300 GEL' },
      { name:'Leak Detection', price:'From 60 GEL' },
    ],
    portfolio:['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80','https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80','https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&q=80'],
    availability:['Mon–Sat 08:00–20:00','Emergency: 24/7'],
    reviews:[
      { name:'Nino K.', rating:5, text:'Fixed our burst pipe at midnight. Incredible service, fair price.', date:'3 days ago' },
      { name:'Davit M.', rating:5, text:'Re-wired our whole apartment. Very professional and tidy.', date:'2 weeks ago' },
    ],
  },
  {
    id:'pv02', name:'Mariam Jgenti', username:'mariam_beauty',
    avatar:'https://i.pravatar.cc/100?img=5',
    profession:'Hair & Makeup Artist', category:'Beauty',
    city:'Tbilisi', district:'Saburtalo', online:false, homeVisit:true, availableToday:true,
    priceFrom:60, currency:'GEL', priceUnit:'/ session',
    rating:5.0, reviewCount:187, completedJobs:523, responseRate:99,
    trustScore:941, verified:true, featured:true,
    badges:['Top Rated','5-Star','Bridal Specialist'],
    bio:'Professional makeup artist and hair stylist specialising in bridal, editorial and special occasion looks. 8 years of experience. Home visits available across Tbilisi.',
    services:[
      { name:'Bridal Makeup', price:'From 250 GEL' },
      { name:'Evening Makeup', price:'From 80 GEL' },
      { name:'Hair Styling', price:'From 60 GEL' },
      { name:'Photoshoot Makeup', price:'From 100 GEL' },
    ],
    portfolio:['https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400&q=80','https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80','https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&q=80'],
    availability:['Mon–Sun 10:00–22:00','Advance booking required for weekends'],
    reviews:[
      { name:'Salome D.', rating:5, text:'Made me look absolutely stunning on my wedding day. Thank you!', date:'1 week ago' },
      { name:'Tamar B.', rating:5, text:'Best makeup artist in Tbilisi. Books up fast — plan ahead!', date:'1 month ago' },
    ],
  },
  {
    id:'pv03', name:'Luka Dolidze', username:'luka_photo',
    avatar:'https://i.pravatar.cc/100?img=68',
    profession:'Commercial Photographer', category:'Photography',
    city:'Tbilisi', district:'Mtatsminda', online:true, homeVisit:true, availableToday:false,
    priceFrom:200, currency:'GEL', priceUnit:'/ shoot',
    rating:4.8, reviewCount:94, completedJobs:267, responseRate:93,
    trustScore:872, verified:true, featured:true,
    badges:['Top Rated','Adobe Certified'],
    bio:'Commercial and portrait photographer. My work has appeared in Georgian Vogue, Forbes Georgia and major brand campaigns. I shoot portraits, products, events and interiors. Full post-production included.',
    services:[
      { name:'Portrait Session', price:'From 200 GEL' },
      { name:'Product Photography', price:'From 350 GEL' },
      { name:'Event Coverage', price:'From 500 GEL' },
      { name:'Real Estate Shoot', price:'From 300 GEL' },
    ],
    portfolio:['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80','https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=400&q=80','https://images.unsplash.com/photo-1519741497674-611481863552?w=400&q=80'],
    availability:['Tue–Sun 10:00–19:00','Weekends premium rate applies'],
    reviews:[
      { name:'Nika M.', rating:5, text:'The most professional photographer I have ever worked with.', date:'2 weeks ago' },
    ],
  },
  {
    id:'pv04', name:'Ana Kvaratskhelia', username:'ana_design',
    avatar:'https://i.pravatar.cc/100?img=25',
    profession:'Brand & UI Designer', category:'Design',
    city:'Tbilisi', district:'Vera', online:true, homeVisit:false, availableToday:true,
    priceFrom:150, currency:'GEL', priceUnit:'/ project',
    rating:4.9, reviewCount:76, completedJobs:143, responseRate:96,
    trustScore:898, verified:true, featured:false,
    badges:['Top Rated','Figma Expert','Fast Turnaround'],
    bio:'Brand identity and UI/UX designer with 6 years of experience working with Georgian startups, restaurants and retail brands. Specialise in Figma, brand systems and packaging design.',
    services:[
      { name:'Logo Design', price:'From 150 GEL' },
      { name:'Brand Identity', price:'From 500 GEL' },
      { name:'UI Design (per screen)', price:'From 80 GEL' },
      { name:'Packaging Design', price:'From 300 GEL' },
    ],
    portfolio:['https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80','https://images.unsplash.com/photo-1558655146-364adaf1fcc9?w=400&q=80','https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=400&q=80'],
    availability:['Mon–Fri 10:00–18:00','Remote only'],
    reviews:[
      { name:'Gigi P.', rating:5, text:'Designed our full rebrand in 10 days. Absolutely outstanding.', date:'3 weeks ago' },
      { name:'Lela T.', rating:5, text:'Very creative, listens carefully and delivers exactly what you imagine.', date:'2 months ago' },
    ],
  },
  {
    id:'pv05', name:'Sandro Beridze', username:'sandro_dev',
    avatar:'https://i.pravatar.cc/100?img=61',
    profession:'Full-Stack Developer', category:'Web Development',
    city:'Tbilisi', district:'Saburtalo', online:true, homeVisit:false, availableToday:true,
    priceFrom:100, currency:'GEL', priceUnit:'/ hour',
    rating:4.7, reviewCount:52, completedJobs:89, responseRate:91,
    trustScore:845, verified:true, featured:false,
    badges:['Verified','React Expert','Fast Delivery'],
    bio:'Senior full-stack developer specialising in React, Node.js and PostgreSQL. I build web apps, landing pages, APIs and e-commerce stores. Based in Tbilisi, work remotely worldwide.',
    services:[
      { name:'Landing Page', price:'From 400 GEL' },
      { name:'Web App (MVP)', price:'From 2000 GEL' },
      { name:'E-commerce Store', price:'From 1500 GEL' },
      { name:'API Development', price:'From 100 GEL/hr' },
    ],
    portfolio:['https://images.unsplash.com/photo-1547658719-da2b51169166?w=400&q=80','https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80','https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&q=80'],
    availability:['Mon–Fri 10:00–19:00','Remote — worldwide timezone'],
    reviews:[
      { name:'Vaso K.', rating:5, text:'Built our entire e-commerce site in 3 weeks. Clean code, fast delivery.', date:'1 month ago' },
    ],
  },
  {
    id:'pv06', name:'Nata Maisuradze', username:'nata_clean',
    avatar:'https://i.pravatar.cc/100?img=44',
    profession:'Cleaning Professional', category:'Cleaning',
    city:'Tbilisi', district:'Multiple', online:false, homeVisit:true, availableToday:true,
    priceFrom:50, currency:'GEL', priceUnit:'/ visit',
    rating:4.8, reviewCount:241, completedJobs:1047, responseRate:98,
    trustScore:887, verified:true, featured:false,
    badges:['Top Rated','Background Checked','Eco-Friendly'],
    bio:'Professional home and office cleaning service with a team of 4. We use eco-friendly products. Regular, deep-clean, post-renovation and move-out packages available. Fully insured team.',
    services:[
      { name:'Regular Clean (1BR)', price:'From 50 GEL' },
      { name:'Deep Clean', price:'From 120 GEL' },
      { name:'Post-Renovation', price:'From 200 GEL' },
      { name:'Office Cleaning', price:'From 80 GEL' },
    ],
    portfolio:['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80','https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&q=80','https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=400&q=80'],
    availability:['Mon–Sat 08:00–18:00'],
    reviews:[
      { name:'Eka V.', rating:5, text:'Our apartment was spotless. Came on short notice too.', date:'4 days ago' },
      { name:'Irakli J.', rating:5, text:'Best cleaning service in the city. Very reliable and thorough.', date:'2 weeks ago' },
    ],
  },
  {
    id:'pv07', name:'Zurab Koridze', username:'zurab_guide',
    avatar:'https://i.pravatar.cc/100?img=53',
    profession:'Licensed Tour Guide', category:'Tour Guides',
    city:'Tbilisi', district:'Old Tbilisi', online:false, homeVisit:false, availableToday:true,
    priceFrom:120, currency:'GEL', priceUnit:'/ half-day',
    rating:4.9, reviewCount:178, completedJobs:432, responseRate:95,
    trustScore:914, verified:true, featured:true,
    badges:['Top Rated','Multilingual','Licensed Guide'],
    bio:'Licensed Georgian tour guide fluent in English, Russian and German. Specialist in Tbilisi history, wine routes, Kazbegi and Svaneti expeditions. Private and group tours. 10 years experience.',
    services:[
      { name:'Old Tbilisi Walking Tour', price:'120 GEL / 3hr' },
      { name:'Wine Region Day Trip', price:'250 GEL / day' },
      { name:'Kazbegi Expedition', price:'400 GEL / 2 days' },
      { name:'Custom Private Tour', price:'From 150 GEL / day' },
    ],
    portfolio:['https://images.unsplash.com/photo-1565008576549-57569a49371d?w=400&q=80','https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=400&q=80','https://images.unsplash.com/photo-1593604572577-1c6c44fa2e04?w=400&q=80'],
    availability:['Daily 08:00–20:00','Book 24hr in advance'],
    reviews:[
      { name:'James R.', rating:5, text:'Best guide we ever had. Made Tbilisi come alive with stories.', date:'1 week ago' },
      { name:'Marta L.', rating:5, text:'The wine tour was exceptional. Zurab knows everyone and everything.', date:'3 weeks ago' },
    ],
  },
  {
    id:'pv08', name:'Giorgi Tabliashvili', username:'gio_driver',
    avatar:'https://i.pravatar.cc/100?img=70',
    profession:'Private Driver & Transfers', category:'Drivers',
    city:'Tbilisi', district:'All Tbilisi', online:false, homeVisit:false, availableToday:true,
    priceFrom:30, currency:'GEL', priceUnit:'/ trip',
    rating:4.8, reviewCount:523, completedJobs:2140, responseRate:99,
    trustScore:896, verified:true, featured:false,
    badges:['Top Rated','Airport Specialist','English Speaking'],
    bio:'Professional driver with 7 years of experience. Mercedes E-Class, clean and comfortable. Airport transfers, city rides, day trips and multi-day tours across Georgia. Available 24/7.',
    services:[
      { name:'Airport Transfer', price:'From 35 GEL' },
      { name:'City Ride (hourly)', price:'From 30 GEL/hr' },
      { name:'Day Trip (outside Tbilisi)', price:'From 120 GEL' },
      { name:'Multi-day Georgia Tour', price:'From 300 GEL / day' },
    ],
    portfolio:['https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&q=80','https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&q=80'],
    availability:['24 / 7 — always available'],
    reviews:[
      { name:'Tom H.', rating:5, text:'Picked me up at 4am no problem. Clean car, great conversation.', date:'5 days ago' },
    ],
  },
  {
    id:'pv09', name:'Maka Tatarashvili', username:'maka_fit',
    avatar:'https://i.pravatar.cc/100?img=29',
    profession:'Personal Trainer & Nutritionist', category:'Fitness',
    city:'Tbilisi', district:'Vake', online:true, homeVisit:true, availableToday:false,
    priceFrom:60, currency:'GEL', priceUnit:'/ session',
    rating:4.9, reviewCount:103, completedJobs:287, responseRate:94,
    trustScore:878, verified:true, featured:false,
    badges:['Top Rated','Certified PT','Nutrition Coach'],
    bio:'Certified personal trainer and precision nutritionist. I design fully customised training and nutrition programmes. In-person training in Vake gyms or home visits. Online coaching available worldwide.',
    services:[
      { name:'Personal Training Session', price:'From 60 GEL' },
      { name:'Monthly Coaching Package', price:'From 400 GEL' },
      { name:'Nutrition Plan', price:'From 150 GEL' },
      { name:'Online Coaching', price:'From 200 GEL / month' },
    ],
    portfolio:['https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80','https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80'],
    availability:['Mon–Sat 07:00–20:00'],
    reviews:[
      { name:'Beka T.', rating:5, text:'-15kg in 3 months. Maka changes lives.', date:'2 weeks ago' },
    ],
  },
  {
    id:'pv10', name:'Elene Sikharulidze', username:'elene_events',
    avatar:'https://i.pravatar.cc/100?img=16',
    profession:'Event Planner & Decorator', category:'Event Services',
    city:'Tbilisi', district:'Multiple', online:false, homeVisit:true, availableToday:false,
    priceFrom:300, currency:'GEL', priceUnit:'/ event',
    rating:4.8, reviewCount:67, completedJobs:134, responseRate:92,
    trustScore:851, verified:true, featured:false,
    badges:['Verified','Wedding Specialist','Creative Director'],
    bio:'Full-service event planner specialising in weddings, corporate events and birthday parties. End-to-end service: concept, decor, catering coordination, entertainment and on-day management.',
    services:[
      { name:'Wedding Planning (full)', price:'From 3000 GEL' },
      { name:'Birthday Party Setup', price:'From 300 GEL' },
      { name:'Corporate Event', price:'From 800 GEL' },
      { name:'Decor Only Package', price:'From 200 GEL' },
    ],
    portfolio:['https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=400&q=80','https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400&q=80','https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&q=80'],
    availability:['Mon–Sun by appointment'],
    reviews:[
      { name:'Keti N.', rating:5, text:'Our wedding was a dream. Elene handled everything perfectly.', date:'1 month ago' },
    ],
  },
  {
    id:'pv11', name:'Gega Putkaradze', username:'gega_move',
    avatar:'https://i.pravatar.cc/100?img=65',
    profession:'Moving & Delivery Service', category:'Moving',
    city:'Tbilisi', district:'All Tbilisi', online:false, homeVisit:true, availableToday:true,
    priceFrom:80, currency:'GEL', priceUnit:'/ move',
    rating:4.7, reviewCount:198, completedJobs:567, responseRate:96,
    trustScore:833, verified:false, featured:false,
    badges:['Insured','Team of 3','Same-Day'],
    bio:'Professional moving company with a truck and team of 3. We pack, move and unpack. Furniture assembly and disassembly included. Same-day bookings available. Tbilisi and intercity moves.',
    services:[
      { name:'Studio/1BR Move', price:'From 80 GEL' },
      { name:'2–3BR Move', price:'From 150 GEL' },
      { name:'Office Relocation', price:'From 200 GEL' },
      { name:'Intercity Move', price:'From 300 GEL' },
    ],
    portfolio:['https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=80','https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&q=80'],
    availability:['Mon–Sun 08:00–21:00'],
    reviews:[
      { name:'Sopho A.', rating:5, text:'Moved our 2BR in 3 hours, nothing broken, very careful.', date:'1 week ago' },
    ],
  },
  {
    id:'pv12', name:'Nino Dvalishvili', username:'nino_tutor',
    avatar:'https://i.pravatar.cc/100?img=48',
    profession:'Academic Tutor (Sciences)', category:'Tutors',
    city:'Tbilisi', district:'Isani', online:true, homeVisit:true, availableToday:true,
    priceFrom:40, currency:'GEL', priceUnit:'/ hour',
    rating:4.8, reviewCount:89, completedJobs:312, responseRate:97,
    trustScore:862, verified:true, featured:false,
    badges:['Verified','Exam Specialist','Patient Teacher'],
    bio:'Biology, Chemistry and Physics tutor for middle school, high school and university entrance exam preparation. 5 years of tutoring, 92% exam success rate. Online and in-person lessons.',
    services:[
      { name:'1-on-1 Lesson (60min)', price:'From 40 GEL' },
      { name:'Exam Prep Package (10 lessons)', price:'From 350 GEL' },
      { name:'Group Session (3 students)', price:'From 25 GEL/student' },
    ],
    portfolio:['https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&q=80','https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&q=80'],
    availability:['Mon–Fri 15:00–21:00','Sat 10:00–18:00'],
    reviews:[
      { name:'Luka M.', rating:5, text:'My son passed his entrance exams with flying colours. Amazing tutor.', date:'3 weeks ago' },
    ],
  },
];

// ======================== STATE ========================
let svState = { category:'All', city:'all', priceMin:'', priceMax:'', rating:'all', verified:false, availableToday:false, onlineService:false, homeVisit:false, highTrust:false, q:'', sort:'featured' };
let savedProviders = window.safeStorage.get('gh_saved_providers', []);
let myRequests     = window.safeStorage.get('gh_my_requests',     []);
let activeProviderId = null;

// ======================== HELPERS ========================
function fmtK(n) { return n >= 1000 ? (n/1000).toFixed(1)+'k' : n; }
function svStars(r) {
  const full = Math.floor(r), half = r % 1 >= 0.5;
  return '<span class="sv-stars">'+'<i class="fas fa-star"></i>'.repeat(full)+(half?'<i class="fas fa-star-half-alt"></i>':'')+'<i class="far fa-star"></i>'.repeat(5-full-(half?1:0))+'</span>';
}
function catIcon(cat) {
  const m = { 'Home Repair':'fas fa-tools','Cleaning':'fas fa-broom','Beauty':'fas fa-spa','Photography':'fas fa-camera','Design':'fas fa-pen-nib','Web Development':'fas fa-code','Fitness':'fas fa-dumbbell','Tour Guides':'fas fa-map','Drivers':'fas fa-car','Tutors':'fas fa-book','Event Services':'fas fa-glass-cheers','Moving':'fas fa-truck' };
  return m[cat] || 'fas fa-briefcase';
}
function catColor(cat) {
  const m = { 'Home Repair':'#f97316','Cleaning':'#3b82f6','Beauty':'#ec4899','Photography':'#a78bfa','Design':'#f59e0b','Web Development':'#10b981','Fitness':'#22c55e','Tour Guides':'#14b8a6','Drivers':'#64748b','Tutors':'#6366f1','Event Services':'#e879f9','Moving':'#fb923c' };
  return m[cat] || '#64748b';
}

// ======================== FILTERS ========================
function applySvFilters() {
  const f = svState;
  let list = [...MOCK_PROVIDERS];
  if (f.q) { const q = f.q.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q) || p.profession.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)); }
  if (f.category !== 'All') list = list.filter(p => p.category === f.category);
  if (f.city !== 'all') list = list.filter(p => p.city === f.city);
  if (f.priceMin) list = list.filter(p => p.priceFrom >= Number(f.priceMin));
  if (f.priceMax) list = list.filter(p => p.priceFrom <= Number(f.priceMax));
  if (f.rating !== 'all') list = list.filter(p => p.rating >= Number(f.rating));
  if (f.verified) list = list.filter(p => p.verified);
  if (f.availableToday) list = list.filter(p => p.availableToday);
  if (f.onlineService) list = list.filter(p => p.online);
  if (f.homeVisit) list = list.filter(p => p.homeVisit);
  if (f.highTrust) list = list.filter(p => p.trustScore >= 880);
  if (f.sort === 'featured') list.sort((a,b) => (b.featured?1:0)-(a.featured?1:0));
  else if (f.sort === 'rating') list.sort((a,b) => b.rating-a.rating);
  else if (f.sort === 'jobs') list.sort((a,b) => b.completedJobs-a.completedJobs);
  else if (f.sort === 'price-asc') list.sort((a,b) => a.priceFrom-b.priceFrom);
  else if (f.sort === 'trust') list.sort((a,b) => b.trustScore-a.trustScore);
  const grid = document.getElementById('svGrid');
  const empty = document.getElementById('svEmpty');
  const countEl = document.getElementById('svCount');
  if (countEl) countEl.textContent = list.length + ' provider' + (list.length!==1?'s':'');
  if (!list.length) { if (grid) grid.innerHTML=''; if (empty) empty.style.display='flex'; return; }
  if (empty) empty.style.display='none';
  if (grid) grid.innerHTML = list.map(renderProviderCard).join('');
}

// ======================== PROVIDER CARD ========================
function renderProviderCard(pv) {
  const saved = savedProviders.includes(pv.id);
  const col = catColor(pv.category);
  const ico = catIcon(pv.category);
  return `
    <div class="sv-card animate-fade-up">
      <div class="sv-card-top" style="background:linear-gradient(135deg,${col}18,${col}08)">
        <img src="${pv.avatar}" class="sv-avatar" alt="${pv.name}" onerror="this.src='https://i.pravatar.cc/100?img=1'">
        <div class="sv-cat-icon" style="background:${col}18;color:${col}"><i class="${ico}"></i></div>
        <button class="sv-save-btn ${saved?'saved':''}" onclick="event.stopPropagation();toggleSavePv('${pv.id}',this)"><i class="${saved?'fas':'far'} fa-heart"></i></button>
        ${pv.featured?'<div class="sv-featured"><i class="fas fa-star"></i></div>':''}
        ${pv.availableToday?'<div class="sv-available">Available Today</div>':''}
      </div>
      <div class="sv-card-body">
        <div class="sv-name">${pv.name} ${pv.verified?'<i class="fas fa-check-circle" style="color:#3b82f6;font-size:0.75rem"></i>':''}</div>
        <div class="sv-profession" style="color:${col}">${pv.profession}</div>
        <div class="sv-loc"><i class="fas fa-map-marker-alt"></i>${pv.district}, ${pv.city}${pv.online?' · <span style="color:#10b981"><i class="fas fa-wifi"></i> Online</span>':''}</div>
        <div class="sv-rating-row">${svStars(pv.rating)} <strong>${pv.rating}</strong> <span>(${pv.reviewCount})</span></div>
        <div class="sv-stats-row">
          <span><i class="fas fa-briefcase"></i> ${fmtK(pv.completedJobs)} jobs</span>
          <span><i class="fas fa-shield-alt" style="color:#10b981"></i> ${pv.trustScore}</span>
          <span><i class="fas fa-reply"></i> ${pv.responseRate}%</span>
        </div>
        <div class="sv-badges">${pv.badges.slice(0,2).map(b=>`<span class="sv-badge" style="--bc:${col}">${b}</span>`).join('')}</div>
        <div class="sv-price">From <strong>${pv.priceFrom} ${pv.currency}</strong><span>${pv.priceUnit}</span></div>
        <div class="sv-actions">
          <button class="sv-btn-primary" onclick="openSvDetail('${pv.id}')"><i class="fas fa-eye"></i> View</button>
          <button class="sv-btn-icon" title="Message" onclick="window.location.href='messages.html?user='+encodeURIComponent('${pv.username}')"><i class="fas fa-comment"></i></button>
          <button class="sv-btn-request" onclick="openRequest('${pv.id}')"><i class="fas fa-paper-plane"></i> Request</button>
        </div>
      </div>
    </div>`;
}

// ======================== DETAIL MODAL ========================
function openSvDetail(id) {
  const pv = MOCK_PROVIDERS.find(p => p.id === id);
  if (!pv) return;
  activeProviderId = id;
  const saved = savedProviders.includes(id);
  const col = catColor(pv.category);

  document.getElementById('svDetailContent').innerHTML = `
    <div class="svd-hero" style="background:linear-gradient(135deg,${col}15,${col}06)">
      <img src="${pv.avatar}" class="svd-avatar" alt="${pv.name}" onerror="this.src='https://i.pravatar.cc/100?img=1'">
      <div class="svd-hero-info">
        <div class="svd-name">${pv.name} ${pv.verified?'<span class="svd-verified"><i class="fas fa-check-circle"></i> Verified</span>':''}</div>
        <div class="svd-prof" style="color:${col}"><i class="${catIcon(pv.category)}"></i> ${pv.profession}</div>
        <div class="svd-loc"><i class="fas fa-map-marker-alt" style="color:${col}"></i> ${pv.district}, ${pv.city}${pv.online?' · <span style="color:#10b981"><i class="fas fa-wifi"></i> Online</span>':''}${pv.homeVisit?' · <span style="color:#a78bfa"><i class="fas fa-home"></i> Home Visit</span>':''}</div>
        <div class="svd-rating-row">${svStars(pv.rating)} <strong>${pv.rating}</strong> <span>(${pv.reviewCount} reviews)</span> <span class="svd-trust"><i class="fas fa-shield-alt"></i> ${pv.trustScore} Trust</span></div>
        <div class="svd-stats">
          <div class="svd-stat"><strong>${fmtK(pv.completedJobs)}</strong><span>Jobs Done</span></div>
          <div class="svd-stat"><strong>${pv.responseRate}%</strong><span>Response Rate</span></div>
          <div class="svd-stat"><strong>${pv.trustScore}</strong><span>Trust Score</span></div>
        </div>
        <div class="svd-badges">${pv.badges.map(b=>`<span class="sv-badge" style="--bc:${col}">${b}</span>`).join('')}</div>
      </div>
      <div class="svd-price-box">
        <div class="svd-price-num">${pv.priceFrom} ${pv.currency}</div>
        <div class="svd-price-lbl">${pv.priceUnit}</div>
        <button class="sv-btn-primary" style="width:100%;margin-top:12px;padding:11px" onclick="closeSvModal('svDetailModal');openRequest('${pv.id}')"><i class="fas fa-paper-plane"></i> Request Service</button>
        <button class="sv-btn-secondary" style="width:100%;margin-top:8px" onclick="window.location.href='messages.html?user='+encodeURIComponent('${pv.username}')"><i class="fas fa-comment"></i> Message</button>
        <button class="svd-save-btn ${saved?'saved':''}" id="svdSaveBtn" onclick="toggleSavePv('${pv.id}',this)"><i class="${saved?'fas':'far'} fa-heart"></i> ${saved?'Saved':'Save'}</button>
        <button class="svd-report-btn" onclick="closeSvModal('svDetailModal');window.location.href='trust.html?report=bad_behavior&target='+encodeURIComponent('${pv.name}')"><i class="fas fa-flag"></i> Report</button>
      </div>
    </div>

    <div class="svd-body">
      <div class="svd-main">
        <div class="svd-section-title">About</div>
        <p class="svd-bio">${pv.bio}</p>

        <div class="svd-section-title">Services & Pricing</div>
        <div class="svd-services">${pv.services.map(s=>`
          <div class="svd-service-row">
            <span class="svd-svc-name"><i class="fas fa-check" style="color:${col}"></i>${s.name}</span>
            <span class="svd-svc-price">${s.price}</span>
          </div>`).join('')}</div>

        <div class="svd-section-title">Portfolio</div>
        <div class="svd-portfolio">${pv.portfolio.map(img=>`<img src="${img}" alt="Portfolio" loading="lazy" onerror="this.style.display='none'">`).join('')}</div>

        <div class="svd-section-title">Availability</div>
        <div class="svd-avail">${pv.availability.map(a=>`<div class="svd-avail-row"><i class="fas fa-clock" style="color:${col}"></i>${a}</div>`).join('')}</div>

        <div class="svd-section-title">Trust Indicators</div>
        <div class="svd-trust-row">
          <div class="trust-ind"><i class="fas fa-shield-alt" style="color:#10b981"></i> Trust ${pv.trustScore}</div>
          <div class="trust-ind"><i class="fas fa-briefcase" style="color:${col}"></i> ${fmtK(pv.completedJobs)} completed</div>
          <div class="trust-ind"><i class="fas fa-reply" style="color:#a78bfa"></i> ${pv.responseRate}% response</div>
          ${pv.verified?'<div class="trust-ind"><i class="fas fa-check-circle" style="color:#3b82f6"></i> GeoHub Verified</div>':''}
          ${pv.homeVisit?'<div class="trust-ind"><i class="fas fa-home" style="color:#a78bfa"></i> Home Visits</div>':''}
        </div>

        <div class="svd-section-title">Reviews</div>
        <div class="svd-reviews">${pv.reviews.map(r=>`
          <div class="svd-review">
            <div class="svd-review-header"><strong>${r.name}</strong>${svStars(r.rating)}<span>${r.date}</span></div>
            <p>${r.text}</p>
          </div>`).join('')}</div>
      </div>
    </div>`;

  openSvModal('svDetailModal');
}

// ======================== REQUEST MODAL ========================
function openRequest(providerId) {
  document.getElementById('reqWrap')?.classList.remove('hidden');
  document.getElementById('reqSuccess')?.classList.add('hidden');
  document.getElementById('reqProviderId').value = providerId || activeProviderId || '';
  const pv = MOCK_PROVIDERS.find(p => p.id === (providerId || activeProviderId));
  if (pv) {
    const nameEl = document.getElementById('reqProviderName');
    const avEl   = document.getElementById('reqProviderAv');
    const profEl = document.getElementById('reqProviderProf');
    if (nameEl) nameEl.textContent = pv.name;
    if (avEl)   avEl.src = pv.avatar;
    if (profEl) profEl.textContent = pv.profession;
    const typeSel = document.getElementById('reqServiceType');
    if (typeSel) { typeSel.innerHTML = pv.services.map(s=>`<option>${s.name}</option>`).join(''); }
  }
  const dateEl = document.getElementById('reqDate');
  if (dateEl) dateEl.min = new Date().toISOString().split('T')[0];
  openSvModal('requestModal');
}

function submitRequest() {
  const date = document.getElementById('reqDate')?.value;
  const time = document.getElementById('reqTime')?.value;
  const desc = document.getElementById('reqDesc')?.value?.trim();
  const errEl = document.getElementById('reqError');
  if (!date || !time) { if (errEl) { errEl.textContent='Please select a date and time.'; errEl.classList.remove('hidden'); } return; }
  if (!desc) { if (errEl) { errEl.textContent='Please describe what you need.'; errEl.classList.remove('hidden'); } return; }
  if (errEl) errEl.classList.add('hidden');
  const pvId = document.getElementById('reqProviderId').value;
  const pv = MOCK_PROVIDERS.find(p => p.id === pvId);
  myRequests.unshift({
    id:'rq_'+Date.now(), providerId:pvId,
    providerName: pv?.name || '', profession: pv?.profession || '',
    serviceType: document.getElementById('reqServiceType')?.value || '',
    date, time, location: document.getElementById('reqLocation')?.value || '',
    budget: document.getElementById('reqBudget')?.value || '',
    description: desc, status:'pending', ts:Date.now(),
  });
  window.safeStorage.set('gh_my_requests', myRequests);
  document.getElementById('reqWrap')?.classList.add('hidden');
  document.getElementById('reqSuccess')?.classList.remove('hidden');
  renderSvDashboard();
}

// ======================== SAVE ========================
function toggleSavePv(id, btn) {
  const idx = savedProviders.indexOf(id);
  const isSaved = idx === -1;
  if (isSaved) savedProviders.push(id);
  else savedProviders.splice(idx, 1);
  window.safeStorage.set('gh_saved_providers', savedProviders);
  if (!btn) return;
  const isSave = btn.classList.contains('svd-save-btn');
  if (isSave) { btn.innerHTML = `<i class="${isSaved?'fas':'far'} fa-heart"></i> ${isSaved?'Saved':'Save'}`; btn.classList.toggle('saved', isSaved); }
  else { btn.innerHTML = `<i class="${isSaved?'fas':'far'} fa-heart"></i>`; btn.classList.toggle('saved', isSaved); }
}

// ======================== DASHBOARD ========================
function renderSvDashboard() {
  const statuses = { pending:'badge-gold', accepted:'badge-green', completed:'badge-blue' };
  const statusLabels = { pending:'Pending', accepted:'Accepted', completed:'Completed' };

  const pendingEl = document.getElementById('svdPending');
  if (pendingEl) {
    const list = myRequests.filter(r => r.status === 'pending').slice(0,4);
    pendingEl.innerHTML = list.length ? list.map(r=>`
      <div class="svd-req-item">
        <div class="svd-req-svc"><i class="${catIcon(MOCK_PROVIDERS.find(p=>p.id===r.providerId)?.category||'')}"></i>${r.serviceType||r.profession}</div>
        <div class="svd-req-provider">${r.providerName}</div>
        <div class="svd-req-date"><i class="fas fa-calendar"></i>${r.date} at ${r.time}</div>
        <span class="svd-req-badge badge-gold">Pending</span>
      </div>`).join('') : '<div class="svd-empty">No pending requests.</div>';
  }

  const allEl = document.getElementById('svdAllRequests');
  if (allEl) {
    allEl.innerHTML = myRequests.slice(0,6).map(r=>`
      <div class="svd-req-item">
        <div class="svd-req-svc">${r.serviceType||r.profession}</div>
        <div class="svd-req-provider">${r.providerName} · <span style="color:var(--text-muted)">${r.date}</span></div>
        <span class="svd-req-badge ${statuses[r.status]||'badge-gray'}">${statusLabels[r.status]||r.status}</span>
      </div>`).join('') || '<div class="svd-empty">No requests yet.</div>';
  }

  const savedEl = document.getElementById('svdSaved');
  if (savedEl) {
    const list = MOCK_PROVIDERS.filter(p => savedProviders.includes(p.id)).slice(0,4);
    savedEl.innerHTML = list.length ? list.map(pv=>`
      <div class="svd-saved-item" onclick="openSvDetail('${pv.id}')">
        <img src="${pv.avatar}" alt="${pv.name}" onerror="this.src='https://i.pravatar.cc/100?img=1'">
        <div>
          <div class="svd-saved-name">${pv.name}</div>
          <div class="svd-saved-prof" style="color:${catColor(pv.category)}">${pv.profession}</div>
        </div>
        <div class="svd-saved-price" style="margin-left:auto">${pv.priceFrom} GEL</div>
      </div>`).join('') : '<div class="svd-empty">No saved providers yet.</div>';
  }

  const recEl = document.getElementById('svdRecommended');
  if (recEl) {
    const list = MOCK_PROVIDERS.filter(p => !savedProviders.includes(p.id) && p.featured).slice(0,3);
    recEl.innerHTML = list.map(pv=>`
      <div class="svd-saved-item" onclick="openSvDetail('${pv.id}')">
        <img src="${pv.avatar}" alt="${pv.name}" onerror="this.src='https://i.pravatar.cc/100?img=1'">
        <div>
          <div class="svd-saved-name">${pv.name}</div>
          <div class="svd-saved-prof" style="color:${catColor(pv.category)}">${pv.profession}</div>
        </div>
        <span class="sv-badge" style="--bc:#10b981;margin-left:auto">Featured</span>
      </div>`).join('');
  }
}

// ======================== TABS ========================
function switchSvTab(tab, el) {
  document.querySelectorAll('.sv-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sv-tab-panel').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('panel-sv-'+tab)?.classList.add('active');
  if (tab === 'dashboard') renderSvDashboard();
  if (tab === 'nearby') renderNearby();
  if (tab === 'saved') renderSavedPanel();
}

function renderNearby() {
  const el = document.getElementById('nearbyGrid');
  if (!el) return;
  const list = MOCK_PROVIDERS.filter(p => p.availableToday).sort((a,b) => b.trustScore-a.trustScore);
  el.innerHTML = list.map(renderProviderCard).join('');
}

function renderSavedPanel() {
  const el = document.getElementById('savedGrid');
  if (!el) return;
  const list = MOCK_PROVIDERS.filter(p => savedProviders.includes(p.id));
  el.innerHTML = list.length ? list.map(renderProviderCard).join('')
    : '<div class="svd-empty" style="padding:48px;text-align:center;color:var(--text-muted)"><i class="far fa-heart" style="font-size:2rem;display:block;margin-bottom:12px;opacity:0.3"></i>No saved providers yet.</div>';
}

// ======================== MODAL HELPERS ========================
function openSvModal(id) { const m = document.getElementById(id); if (!m) return; m.style.display='flex'; requestAnimationFrame(() => m.classList.add('open')); }
function closeSvModal(id) { const m = document.getElementById(id); if (!m) return; m.classList.remove('open'); setTimeout(() => { m.style.display='none'; }, 280); }
function showSvToast(msg) { const t = document.getElementById('svToast'); if (!t) return; t.textContent=msg; t.classList.add('visible'); setTimeout(()=>t.classList.remove('visible'),2800); }

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => {
  applySvFilters();
  renderSvDashboard();

  const qi = document.getElementById('svSearchInput');
  if (qi) qi.addEventListener('input', () => { svState.q = qi.value; applySvFilters(); });

  const sortSel = document.getElementById('svSortSelect');
  if (sortSel) sortSel.addEventListener('change', () => { svState.sort = sortSel.value; applySvFilters(); });

  const citySel = document.getElementById('svCityFilter');
  if (citySel) citySel.addEventListener('change', () => { svState.city = citySel.value; applySvFilters(); });

  const ratingSel = document.getElementById('svRatingFilter');
  if (ratingSel) ratingSel.addEventListener('change', () => { svState.rating = ratingSel.value; applySvFilters(); });

  const priceMin = document.getElementById('svPriceMin');
  const priceMax = document.getElementById('svPriceMax');
  if (priceMin) priceMin.addEventListener('input', () => { svState.priceMin = priceMin.value; applySvFilters(); });
  if (priceMax) priceMax.addEventListener('input', () => { svState.priceMax = priceMax.value; applySvFilters(); });

  ['svVerified','svAvailToday','svOnline','svHomeVisit','svHighTrust'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      if (id==='svVerified')   svState.verified      = el.checked;
      if (id==='svAvailToday') svState.availableToday = el.checked;
      if (id==='svOnline')     svState.onlineService  = el.checked;
      if (id==='svHomeVisit')  svState.homeVisit      = el.checked;
      if (id==='svHighTrust')  svState.highTrust      = el.checked;
      applySvFilters();
    });
  });

  document.addEventListener('keydown', e => { if (e.key==='Escape') ['svDetailModal','requestModal'].forEach(closeSvModal); });
  ['svDetailModal','requestModal'].forEach(id => { const m = document.getElementById(id); if (m) m.addEventListener('click', e => { if (e.target===m) closeSvModal(id); }); });
});
