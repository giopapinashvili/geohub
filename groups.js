/* ================================================================
   GeoHub — Groups / Communities System
   ================================================================ */

// ======================== DATA ========================
const GROUP_CATEGORIES = ['All','Hiking','Cafés','Photography','Nightlife','Startups','Fitness','Students','Travel','Learning','Real Estate'];

const MOCK_GROUPS = [
  {
    id:'gr01', name:'Tbilisi Hikers', slug:'tbilisi-hikers', category:'Hiking',
    cover:'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
    icon:'fas fa-mountain', color:'#10b981',
    city:'Tbilisi', members:1247, online:34, activity:'Very Active',
    trustLevel:'Trusted', verified:true, private:false,
    description:'Georgia\'s largest hiking community. Weekend trails, gear advice, safety tips and post-hike coffee. All levels welcome — from first timers to mountaineers.',
    tags:['Outdoor','Weekend Hikes','Kazbegi','Borjomi','Nature'],
    rules:['Be respectful and supportive','Share trail conditions and safety info','No spam or self-promotion','Leave no trace on trails'],
    admins:['u02','u07'],
    recentMembers:['https://i.pravatar.cc/40?img=5','https://i.pravatar.cc/40?img=12','https://i.pravatar.cc/40?img=44','https://i.pravatar.cc/40?img=60'],
    posts:[
      { id:'p1', authorId:'u02', authorName:'Giorgi M.', authorAv:'https://i.pravatar.cc/40?img=12', ts: Date.now()-3600000, text:'Who\'s in for Kazbegi this Saturday? Weather looks perfect! 🏔️ Need 2 more people for the minivan.', likes:34, comments:12, image:'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=600&q=80' },
      { id:'p2', authorId:'u07', authorName:'Nino B.', authorAv:'https://i.pravatar.cc/40?img=44', ts: Date.now()-86400000, text:'Trail report: Lomisi to Gudauri — snow still deep above 2400m. Take microspikes! Beautiful views though ❄️', likes:67, comments:8, image:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80' },
      { id:'p3', authorId:'u30', authorName:'Luka D.', authorAv:'https://i.pravatar.cc/40?img=67', ts: Date.now()-172800000, text:'Gear question: anyone have a recommendation for waterproof boots under 300 GEL? Planning Svaneti this summer.', likes:12, comments:21 },
    ],
    events:[
      { id:'e1', title:'Kazbegi Sunrise Hike', date:'Sat 15 Jun', time:'05:00', attendees:23, cover:'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&q=80' },
      { id:'e2', title:'Borjomi Valley Trail', date:'Sun 23 Jun', time:'09:00', attendees:14, cover:'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=400&q=80' },
    ],
    challenges:[
      { id:'c1', title:'10 Peaks Challenge', desc:'Summit 10 different Georgian peaks this season', xp:1000, participants:87, deadline:'Sep 30' },
      { id:'c2', title:'Leave No Trace Week', desc:'Document 3 clean hikes with camera proof', xp:300, participants:134, deadline:'Jun 30' },
    ],
  },
  {
    id:'gr02', name:'Tbilisi Café Hunters', slug:'tbilisi-cafe-hunters', category:'Cafés',
    cover:'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
    icon:'fas fa-coffee', color:'#f59e0b',
    city:'Tbilisi', members:2834, online:91, activity:'Very Active',
    trustLevel:'Community Trusted', verified:true, private:false,
    description:'Discover, review and debate the best cafés in Tbilisi. New spots, hidden gems, barista profiles, brewing guides and weekly café meetups.',
    tags:['Coffee','Specialty','Tbilisi','Reviews','Barista'],
    rules:['Be honest in reviews — no paid promotions without disclosure','No venue bashing without evidence','Respect other tastes'],
    admins:['u04','u21'],
    recentMembers:['https://i.pravatar.cc/40?img=9','https://i.pravatar.cc/40?img=25','https://i.pravatar.cc/40?img=33','https://i.pravatar.cc/40?img=50'],
    posts:[
      { id:'p4', authorId:'u04', authorName:'Nino A.', authorAv:'https://i.pravatar.cc/40?img=9', ts:Date.now()-7200000, text:'Just tried the new filter bar on Aghmashenebeli — single origin Ethiopian, natural process. Best pour-over I\'ve had in Tbilisi this year ☕', likes:89, comments:31, image:'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80' },
      { id:'p5', authorId:'u21', authorName:'Sandro P.', authorAv:'https://i.pravatar.cc/40?img=50', ts:Date.now()-14400000, text:'Café meetup this Thursday at Fabrika — who\'s joining? Trying the new roaster that just opened in the container.', likes:44, comments:18 },
    ],
    events:[
      { id:'e3', title:'Thursday Café Crawl', date:'Thu 13 Jun', time:'18:00', attendees:38, cover:'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&q=80' },
    ],
    challenges:[
      { id:'c3', title:'30 Cafés in 30 Days', desc:'Visit and review a new café every day for a month', xp:800, participants:213, deadline:'Jul 31' },
      { id:'c4', title:'Specialty Coffee Trail', desc:'Find and review all 15 specialty roasters in Tbilisi', xp:500, participants:76, deadline:'Aug 31' },
    ],
  },
  {
    id:'gr03', name:'Georgia Street Photography', slug:'georgia-street-photo', category:'Photography',
    cover:'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&q=80',
    icon:'fas fa-camera', color:'#a78bfa',
    city:'Multiple', members:891, online:22, activity:'Active',
    trustLevel:'Trusted', verified:true, private:false,
    description:'A creative community for photographers exploring Georgian cities, people and landscapes. Share your shots, get critique, and join photo walks.',
    tags:['Street','Portrait','Landscape','Critique','Photowalk'],
    rules:['Credit your gear if asked','Give constructive critique only','No watermarked spam','Credit subjects who were photographed with permission'],
    admins:['u10'],
    recentMembers:['https://i.pravatar.cc/40?img=15','https://i.pravatar.cc/40?img=27','https://i.pravatar.cc/40?img=41'],
    posts:[
      { id:'p6', authorId:'u10', authorName:'Beka C.', authorAv:'https://i.pravatar.cc/40?img=15', ts:Date.now()-10800000, text:'Old Tbilisi portrait series — Session 4. These faces tell stories no travel blog can. 📷', likes:213, comments:47, image:'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80' },
    ],
    events:[
      { id:'e4', title:'Mtatsminda Photo Walk', date:'Sat 22 Jun', time:'17:00', attendees:19, cover:'https://images.unsplash.com/photo-1596005554384-d293674c91d4?w=400&q=80' },
    ],
    challenges:[
      { id:'c5', title:'Golden Hour Challenge', desc:'Post 7 consecutive golden-hour shots from different locations', xp:400, participants:54, deadline:'Jul 15' },
    ],
  },
  {
    id:'gr04', name:'Tbilisi After Dark', slug:'tbilisi-after-dark', category:'Nightlife',
    cover:'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80',
    icon:'fas fa-moon', color:'#8b5cf6',
    city:'Tbilisi', members:3421, online:148, activity:'Very Active',
    trustLevel:'Basic', verified:false, private:false,
    description:'Tbilisi\'s nightlife community. Club nights, DJ sets, bar openings, guest lists, after-parties and honest venue reviews. 18+ only.',
    tags:['Techno','Clubs','Bars','Events','GuestList'],
    rules:['18+ only','No drugging or harassment — zero tolerance','Respect venue staff','No filming without consent in clubs'],
    admins:['u06'],
    recentMembers:['https://i.pravatar.cc/40?img=56','https://i.pravatar.cc/40?img=63','https://i.pravatar.cc/40?img=71','https://i.pravatar.cc/40?img=78'],
    posts:[
      { id:'p7', authorId:'u06', authorName:'Dato K.', authorAv:'https://i.pravatar.cc/40?img=56', ts:Date.now()-1800000, text:'Bassiani this Saturday — Robert Hood back-to-back with Objekt. Who needs a +1? Drop a comment 🎵', likes:312, comments:89 },
      { id:'p8', authorId:'u06', authorName:'Dato K.', authorAv:'https://i.pravatar.cc/40?img=56', ts:Date.now()-43200000, text:'Review: the new bar on Marjanishvili — cocktails 10/10, music 8/10, crowd was a bit mixed. Worth a visit on a Thursday.', likes:78, comments:24, image:'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=80' },
    ],
    events:[
      { id:'e5', title:'Bassiani: Robert Hood b2b Objekt', date:'Sat 15 Jun', time:'23:00', attendees:600, cover:'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80' },
    ],
    challenges:[],
  },
  {
    id:'gr05', name:'Georgia Startup Club', slug:'georgia-startup-club', category:'Startups',
    cover:'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80',
    icon:'fas fa-rocket', color:'#3b82f6',
    city:'Tbilisi', members:1087, online:43, activity:'Active',
    trustLevel:'Trusted', verified:true, private:false,
    description:'Georgia\'s premier startup community. Founders, investors, developers and mentors building the future. Pitch nights, co-founder matching, funding news.',
    tags:['Founders','Investors','Tech','Fintech','Pitch'],
    rules:['No MLM or pyramid schemes','Be transparent about your startup stage','Feedback should be constructive'],
    admins:['u12','u30'],
    recentMembers:['https://i.pravatar.cc/40?img=3','https://i.pravatar.cc/40?img=18','https://i.pravatar.cc/40?img=32'],
    posts:[
      { id:'p9', authorId:'u12', authorName:'Ana G.', authorAv:'https://i.pravatar.cc/40?img=3', ts:Date.now()-21600000, text:'We just closed our pre-seed! 🎉 $300k from local angels. Looking for a CTO — anyone know a strong React/Node dev based in Tbilisi?', likes:187, comments:56 },
      { id:'p10', authorId:'u30', authorName:'Levan M.', authorAv:'https://i.pravatar.cc/40?img=18', ts:Date.now()-86400000, text:'Reminder: pitch night this Wednesday at Impact Hub. 6 startups presenting to 3 investors. Free to attend, register in the link below.', likes:94, comments:17 },
    ],
    events:[
      { id:'e6', title:'Startup Pitch Night #12', date:'Wed 19 Jun', time:'19:00', attendees:87, cover:'https://images.unsplash.com/photo-1591115765373-5207764f72e4?w=400&q=80' },
    ],
    challenges:[
      { id:'c6', title:'100-Day Build Challenge', desc:'Ship a working product in 100 days and document the journey', xp:1500, participants:34, deadline:'Sep 15' },
    ],
  },
  {
    id:'gr06', name:'Tbilisi Fitness Crew', slug:'tbilisi-fitness', category:'Fitness',
    cover:'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
    icon:'fas fa-dumbbell', color:'#22c55e',
    city:'Tbilisi', members:2103, online:77, activity:'Very Active',
    trustLevel:'Community Trusted', verified:true, private:false,
    description:'Tbilisi\'s fitness accountability community. Morning runs, gym partners, nutrition advice, transformation challenges and weekly check-ins.',
    tags:['Running','Gym','Nutrition','Accountability','Transformation'],
    rules:['Be encouraging — no body shaming ever','Share progress not perfection','Tag camera-proof workouts for XP'],
    admins:['u08'],
    recentMembers:['https://i.pravatar.cc/40?img=29','https://i.pravatar.cc/40?img=57','https://i.pravatar.cc/40?img=38','https://i.pravatar.cc/40?img=49'],
    posts:[
      { id:'p11', authorId:'u08', authorName:'Irakli B.', authorAv:'https://i.pravatar.cc/40?img=57', ts:Date.now()-5400000, text:'Week 8 check-in results are in! 23 members completed the transformation challenge. Average weight change: -5.2kg 💪 Proud of this crew.', likes:234, comments:67, image:'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80' },
    ],
    events:[
      { id:'e7', title:'5K Morning Run — Vake Park', date:'Sun 23 Jun', time:'07:00', attendees:54, cover:'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=400&q=80' },
    ],
    challenges:[
      { id:'c7', title:'30-Day Transformation', desc:'Document your fitness journey every day for 30 days', xp:600, participants:312, deadline:'Jul 31' },
      { id:'c8', title:'Vake Park 5K Weekly', desc:'Run Vake Park 5K every Sunday for 8 weeks', xp:400, participants:89, deadline:'Aug 18' },
    ],
  },
  {
    id:'gr07', name:'Georgian Students Hub', slug:'georgian-students', category:'Students',
    cover:'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80',
    icon:'fas fa-graduation-cap', color:'#6366f1',
    city:'Multiple', members:4821, online:213, activity:'Very Active',
    trustLevel:'Basic', verified:false, private:false,
    description:'The biggest student community in Georgia. Study groups, scholarship alerts, exam help, internship listings and social events for university students.',
    tags:['University','Scholarships','Exams','Internships','Study'],
    rules:['No homework-doing services','Only share legitimate scholarships','Keep exam discussions ethical'],
    admins:['u16','u22'],
    recentMembers:['https://i.pravatar.cc/40?img=20','https://i.pravatar.cc/40?img=35','https://i.pravatar.cc/40?img=45','https://i.pravatar.cc/40?img=55'],
    posts:[
      { id:'p12', authorId:'u16', authorName:'Keti N.', authorAv:'https://i.pravatar.cc/40?img=20', ts:Date.now()-900000, text:'🚨 Chevening Scholarship 2025-26 applications are OPEN. Deadline July 5. Link in comments. Who is applying?', likes:543, comments:178 },
      { id:'p13', authorId:'u22', authorName:'Nika T.', authorAv:'https://i.pravatar.cc/40?img=35', ts:Date.now()-18000000, text:'Free IELTS prep study group starting Monday — TSU library room 3A, 18:00. All welcome, no registration needed.', likes:267, comments:43 },
    ],
    events:[
      { id:'e8', title:'Scholarship Information Day', date:'Mon 17 Jun', time:'16:00', attendees:143, cover:'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80' },
    ],
    challenges:[
      { id:'c9', title:'Study Streak', desc:'Study 2 hours a day for 21 consecutive days', xp:350, participants:892, deadline:'Jun 30' },
    ],
  },
  {
    id:'gr08', name:'Georgia Slow Travel', slug:'georgia-slow-travel', category:'Travel',
    cover:'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=800&q=80',
    icon:'fas fa-map-marked-alt', color:'#14b8a6',
    city:'Multiple', members:1632, online:48, activity:'Active',
    trustLevel:'Trusted', verified:true, private:false,
    description:'For travellers who take their time in Georgia. Hidden villages, guesthouses, local food, off-road routes and itinerary sharing. Quality over quantity.',
    tags:['Slow Travel','Svaneti','Tusheti','Guesthouses','Offbeat'],
    rules:['Share honest and detailed trip reports','Respect local communities and customs','No generic tourist content'],
    admins:['u14'],
    recentMembers:['https://i.pravatar.cc/40?img=7','https://i.pravatar.cc/40?img=19','https://i.pravatar.cc/40?img=42'],
    posts:[
      { id:'p14', authorId:'u14', authorName:'Lela M.', authorAv:'https://i.pravatar.cc/40?img=7', ts:Date.now()-28800000, text:'Tusheti road opens June 15 🎉 Already booked a guesthouse in Omalo. The route takes 5-6 hours from Telavi but it\'s worth every minute.', likes:312, comments:78, image:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80' },
    ],
    events:[
      { id:'e9', title:'Tusheti Group Trip', date:'Fri 28 Jun', time:'07:00', attendees:12, cover:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
    ],
    challenges:[
      { id:'c10', title:'9 Regions of Georgia', desc:'Visit and document a stay in all 9 regions of Georgia', xp:2000, participants:23, deadline:'Dec 31' },
    ],
  },
  {
    id:'gr09', name:'GeoHub Learning Circle', slug:'geohub-learning', category:'Learning',
    cover:'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80',
    icon:'fas fa-book-open', color:'#c4b5fd',
    city:'Online', members:934, online:67, activity:'Active',
    trustLevel:'Trusted', verified:true, private:false,
    description:'A community of lifelong learners. Book clubs, online courses, skill shares, language exchanges, and accountability groups.',
    tags:['Books','Languages','Skills','Accountability','Courses'],
    rules:['Share what you learn freely','Encourage peers — we grow together','No gatekeeping of knowledge'],
    admins:['u01','u25'],
    recentMembers:['https://i.pravatar.cc/40?img=47','https://i.pravatar.cc/40?img=60','https://i.pravatar.cc/40?img=28'],
    posts:[
      { id:'p15', authorId:'u01', authorName:'You', authorAv:'https://i.pravatar.cc/40?img=47', ts:Date.now()-3600000, text:'English-Georgian language exchange partner wanted! I\'m B2 English, A1 Georgian. Message me if interested 😊', likes:23, comments:11 },
    ],
    events:[
      { id:'e10', title:'Monthly Book Club — "The Alchemist"', date:'Sat 29 Jun', time:'19:00', attendees:31, cover:'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&q=80' },
    ],
    challenges:[
      { id:'c11', title:'Read 12 Books in a Year', desc:'Read one book a month and post a review in the group', xp:600, participants:187, deadline:'Dec 31' },
    ],
  },
  {
    id:'gr10', name:'Georgia Property Investors', slug:'georgia-property', category:'Real Estate',
    cover:'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    icon:'fas fa-building', color:'#38bdf8',
    city:'Multiple', members:721, online:19, activity:'Moderate',
    trustLevel:'Community Trusted', verified:true, private:true,
    description:'Private group for serious property investors in Georgia. Market analysis, deal sharing, legal advice, renovation tips and ROI discussions.',
    tags:['Investment','Tbilisi','Batumi','ROI','Rental'],
    rules:['Verified membership only — trust score 800+','No unsolicited deal promotions','Keep financial details confidential'],
    admins:['u06','u12'],
    recentMembers:['https://i.pravatar.cc/40?img=58','https://i.pravatar.cc/40?img=64','https://i.pravatar.cc/40?img=70'],
    posts:[
      { id:'p16', authorId:'u06', authorName:'Dato K.', authorAv:'https://i.pravatar.cc/40?img=58', ts:Date.now()-43200000, text:'Batumi Q2 analysis: yield on new-builds sitting at 8-10% annually. Better entry points than Tbilisi centre right now. Happy to share full report with verified members.', likes:67, comments:23 },
    ],
    events:[
      { id:'e11', title:'Property Investment Roundtable', date:'Wed 26 Jun', time:'19:30', attendees:18, cover:'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80' },
    ],
    challenges:[],
  },
];

const MY_INTERESTS = ['Hiking','Cafés','Learning','Fitness'];

// ======================== STATE ========================
let myGroups   = window.safeStorage.get('gh_my_groups', ['gr01','gr09']);
let grState    = { category:'All', city:'all', q:'', sort:'activity', verified:false, open:false };
let activeGroupId = null;

// ======================== HELPERS ========================
function isMember(id) { return myGroups.includes(id); }
function actColor(a) { return a==='Very Active'?'#10b981':a==='Active'?'#3b82f6':'#64748b'; }
function trustColor(t) { return t==='Community Trusted'?'#f59e0b':t==='Trusted'?'#10b981':'#64748b'; }
function fmtK(n) { return n>=1000?(n/1000).toFixed(1)+'k':n; }
function fmtTime(ts) {
  const d = Math.floor((Date.now()-ts)/60000);
  if (d<60) return d+'m ago'; if (d<1440) return Math.floor(d/60)+'h ago';
  return Math.floor(d/1440)+'d ago';
}

// ======================== FILTERS ========================
function applyGrFilters() {
  const f = grState;
  let list = [...MOCK_GROUPS];
  if (f.q) { const q=f.q.toLowerCase(); list=list.filter(g=>g.name.toLowerCase().includes(q)||g.category.toLowerCase().includes(q)||g.tags.some(t=>t.toLowerCase().includes(q))); }
  if (f.category!=='All') list=list.filter(g=>g.category===f.category);
  if (f.city!=='all') list=list.filter(g=>g.city===f.city||g.city==='Multiple'||g.city==='Online');
  if (f.verified) list=list.filter(g=>g.verified);
  if (f.open) list=list.filter(g=>!g.private);
  if (f.sort==='activity') list.sort((a,b)=>b.members-a.members);
  else if (f.sort==='newest') list.sort((a,b)=>b.id.localeCompare(a.id));
  else if (f.sort==='members') list.sort((a,b)=>b.members-a.members);
  const grid=document.getElementById('grGrid');
  const empty=document.getElementById('grEmpty');
  const countEl=document.getElementById('grCount');
  if (countEl) countEl.textContent=list.length+' group'+(list.length!==1?'s':'');
  if (!list.length){if(grid)grid.innerHTML='';if(empty)empty.style.display='flex';return;}
  if (empty) empty.style.display='none';
  if (grid) grid.innerHTML=list.map(renderGroupCard).join('');
}

// ======================== GROUP CARD ========================
function renderGroupCard(gr) {
  const joined = isMember(gr.id);
  return `
    <div class="gr-card animate-fade-up" onclick="openGroupDetail('${gr.id}')">
      <div class="gr-card-cover">
        <img src="${gr.cover}" alt="${gr.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80'">
        <div class="gr-card-overlay"></div>
        <div class="gr-cat-badge" style="background:${gr.color}22;border-color:${gr.color}44;color:${gr.color}"><i class="${gr.icon}"></i> ${gr.category}</div>
        ${gr.private?'<div class="gr-private-badge"><i class="fas fa-lock"></i> Private</div>':''}
        ${gr.verified?'<div class="gr-verified-badge"><i class="fas fa-check-circle"></i></div>':''}
      </div>
      <div class="gr-card-body">
        <div class="gr-card-name">${gr.name}</div>
        <div class="gr-card-desc">${gr.description.substring(0,90)}…</div>
        <div class="gr-card-meta">
          <span><i class="fas fa-users" style="color:${gr.color}"></i> ${fmtK(gr.members)}</span>
          <span><i class="fas fa-circle" style="color:${actColor(gr.activity)};font-size:.5rem"></i> ${gr.activity}</span>
          <span><i class="fas fa-map-marker-alt" style="color:var(--text-muted)"></i> ${gr.city}</span>
        </div>
        <div class="gr-card-tags">${gr.tags.slice(0,3).map(t=>`<span class="gr-tag">${t}</span>`).join('')}</div>
        <div class="gr-card-footer">
          <div class="gr-members-row">
            ${gr.recentMembers.slice(0,4).map(av=>`<img src="${av}" class="gr-member-av" alt="">`).join('')}
            <span class="gr-members-more">+${fmtK(gr.members-4)}</span>
          </div>
          <button class="gr-join-btn ${joined?'joined':''}" onclick="event.stopPropagation();toggleJoin('${gr.id}',this)">
            ${joined?'<i class="fas fa-check"></i> Joined':'<i class="fas fa-plus"></i> Join'}
          </button>
        </div>
      </div>
    </div>`;
}

// ======================== GROUP DETAIL MODAL ========================
function openGroupDetail(id) {
  const gr = MOCK_GROUPS.find(g=>g.id===id);
  if (!gr) return;
  activeGroupId = id;
  const joined = isMember(id);

  document.getElementById('grDetailContent').innerHTML = `
    <div class="grd-cover-wrap">
      <img src="${gr.cover}" class="grd-cover" alt="${gr.name}">
      <div class="grd-cover-overlay"></div>
      <div class="grd-cover-info">
        <div class="grd-cat-pill" style="background:${gr.color}22;border-color:${gr.color}44;color:${gr.color}"><i class="${gr.icon}"></i> ${gr.category}</div>
        <div class="grd-name">${gr.name} ${gr.verified?'<i class="fas fa-check-circle" style="color:#3b82f6;font-size:.9rem"></i>':''}${gr.private?'<span class="grd-private"><i class="fas fa-lock"></i> Private</span>':''}</div>
        <div class="grd-meta-row">
          <span><i class="fas fa-users"></i> ${fmtK(gr.members)} members</span>
          <span><i class="fas fa-circle" style="color:${actColor(gr.activity)};font-size:.5rem"></i> ${gr.activity}</span>
          <span><i class="fas fa-map-marker-alt"></i> ${gr.city}</span>
          <span class="grd-trust" style="color:${trustColor(gr.trustLevel)}"><i class="fas fa-shield-alt"></i> ${gr.trustLevel}</span>
        </div>
      </div>
      <div class="grd-cover-actions">
        <button class="grd-join-btn ${joined?'joined':''}" id="grdJoinBtn" onclick="toggleJoin('${gr.id}',this,true)">
          ${joined?'<i class="fas fa-check"></i> Joined':'<i class="fas fa-plus"></i> Join Group'}
        </button>
        <button class="grd-chat-btn" onclick="window.location.href='messages.html'"><i class="fas fa-comment"></i> Group Chat</button>
        <button class="grd-share-btn" onclick="openGrShare('${gr.id}')"><i class="fas fa-share-alt"></i></button>
      </div>
    </div>

    <div class="grd-body">
      <div class="grd-tabs">
        <button class="grd-tab active" onclick="switchGrdTab('feed',this)"><i class="fas fa-stream"></i> Feed</button>
        <button class="grd-tab" onclick="switchGrdTab('events',this)"><i class="fas fa-calendar"></i> Events <span class="grd-tab-count">${gr.events.length}</span></button>
        <button class="grd-tab" onclick="switchGrdTab('challenges',this)"><i class="fas fa-trophy"></i> Challenges <span class="grd-tab-count">${gr.challenges.length}</span></button>
        <button class="grd-tab" onclick="switchGrdTab('about',this)"><i class="fas fa-info-circle"></i> About</button>
      </div>

      <div id="grdPanel-feed" class="grd-panel active">
        ${!joined?`<div class="grd-join-prompt"><i class="${gr.icon}" style="color:${gr.color}"></i><div><strong>Join to see the full feed</strong><p>Members get access to all posts, discussions and group chat.</p></div><button class="gr-join-btn" onclick="toggleJoin('${gr.id}',this,true);renderGrdFeed('${gr.id}')"><i class="fas fa-plus"></i> Join Group</button></div>`:''}
        <div id="grdFeedInner">${renderGrdFeed_inner(gr)}</div>
        ${joined?`<div class="grd-post-compose"><img src="https://i.pravatar.cc/40?img=47" class="gr-member-av" alt="You"><input class="grd-compose-input" placeholder="Share something with the group…" onclick="openPostCompose('${gr.id}')"><button class="gr-join-btn" onclick="openPostCompose('${gr.id}')"><i class="fas fa-paper-plane"></i></button></div>`:''}
      </div>

      <div id="grdPanel-events" class="grd-panel">
        <div class="grd-events-grid">
          ${gr.events.map(ev=>`
            <div class="grd-event-card">
              <img src="${ev.cover}" alt="${ev.title}" onerror="this.style.display='none'">
              <div class="grd-event-info">
                <div class="grd-event-title">${ev.title}</div>
                <div class="grd-event-meta"><i class="fas fa-calendar"></i>${ev.date} · ${ev.time}</div>
                <div class="grd-event-meta"><i class="fas fa-users"></i>${ev.attendees} attending</div>
                <button class="gr-join-btn" style="margin-top:8px;width:100%" onclick="showGrToast('Event added to your calendar!')"><i class="fas fa-calendar-plus"></i> Attend</button>
              </div>
            </div>`).join('') || '<div class="grd-empty-state"><i class="fas fa-calendar"></i><p>No events scheduled yet.</p></div>'}
        </div>
      </div>

      <div id="grdPanel-challenges" class="grd-panel">
        <div class="grd-challenges-list">
          ${gr.challenges.map(ch=>`
            <div class="grd-challenge-card">
              <div class="grd-ch-icon" style="background:${gr.color}18;color:${gr.color}"><i class="fas fa-trophy"></i></div>
              <div class="grd-ch-info">
                <div class="grd-ch-title">${ch.title}</div>
                <div class="grd-ch-desc">${ch.desc}</div>
                <div class="grd-ch-meta"><span><i class="fas fa-users"></i>${ch.participants} joined</span><span><i class="fas fa-calendar"></i>Ends ${ch.deadline}</span><span class="grd-ch-xp"><i class="fas fa-bolt"></i>+${ch.xp} XP</span></div>
              </div>
              <button class="gr-join-btn" onclick="event.stopPropagation();showGrToast('Challenge joined! +${ch.xp} XP on completion.')"><i class="fas fa-plus"></i> Join</button>
            </div>`).join('') || '<div class="grd-empty-state"><i class="fas fa-trophy"></i><p>No challenges yet.</p></div>'}
        </div>
      </div>

      <div id="grdPanel-about" class="grd-panel">
        <div class="grd-about">
          <div class="grd-about-section"><div class="grd-about-title">About</div><p>${gr.description}</p></div>
          <div class="grd-about-section"><div class="grd-about-title">Tags</div><div class="gr-card-tags">${gr.tags.map(t=>`<span class="gr-tag">${t}</span>`).join('')}</div></div>
          <div class="grd-about-section"><div class="grd-about-title">Rules</div>${gr.rules.map((r,i)=>`<div class="grd-rule"><span class="grd-rule-num">${i+1}</span>${r}</div>`).join('')}</div>
          <div class="grd-about-section"><div class="grd-about-title">Trust Level</div><div class="trust-ind" style="display:inline-flex"><i class="fas fa-shield-alt" style="color:${trustColor(gr.trustLevel)}"></i>${gr.trustLevel}</div></div>
          <div class="grd-about-section" style="margin-top:20px"><button class="grd-report-btn" onclick="closeGrModal('grDetailModal');window.location.href='trust.html?report=bad_behavior&target='+encodeURIComponent('${gr.name}')"><i class="fas fa-flag"></i> Report Group</button></div>
        </div>
      </div>
    </div>`;

  openGrModal('grDetailModal');
}

function renderGrdFeed_inner(gr) {
  return gr.posts.map(p=>`
    <div class="grd-post">
      <div class="grd-post-header">
        <img src="${p.authorAv}" class="gr-member-av" style="width:36px;height:36px" alt="${p.authorName}">
        <div><div class="grd-post-author">${p.authorName}</div><div class="grd-post-time">${fmtTime(p.ts)}</div></div>
      </div>
      <div class="grd-post-text">${p.text}</div>
      ${p.image?`<img src="${p.image}" class="grd-post-img" alt="" onerror="this.style.display='none'">`:''}
      <div class="grd-post-actions">
        <button onclick="this.classList.toggle('liked');this.querySelector('span').textContent=parseInt(this.querySelector('span').textContent)+(this.classList.contains('liked')?1:-1)"><i class="far fa-heart"></i><span>${p.likes}</span></button>
        <button><i class="far fa-comment"></i><span>${p.comments}</span></button>
        <button onclick="showGrToast('Post shared!')"><i class="fas fa-share-alt"></i></button>
      </div>
    </div>`).join('');
}

function renderGrdFeed(groupId) {
  const gr = MOCK_GROUPS.find(g=>g.id===groupId);
  if (!gr) return;
  const el = document.getElementById('grdFeedInner');
  if (el) el.innerHTML = renderGrdFeed_inner(gr);
}

function switchGrdTab(tab, el) {
  document.querySelectorAll('.grd-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.grd-panel').forEach(p=>p.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('grdPanel-'+tab)?.classList.add('active');
}

function openPostCompose(grId) {
  document.getElementById('composeGroupId').value = grId;
  document.getElementById('composeText').value = '';
  openGrModal('composeModal');
}
function submitPost() {
  const text = document.getElementById('composeText')?.value?.trim();
  if (!text) return;
  const grId = document.getElementById('composeGroupId').value;
  const gr = MOCK_GROUPS.find(g=>g.id===grId);
  if (gr) {
    gr.posts.unshift({ id:'np_'+Date.now(), authorId:'u01', authorName:'You', authorAv:'https://i.pravatar.cc/40?img=47', ts:Date.now(), text, likes:0, comments:0 });
  }
  closeGrModal('composeModal');
  renderGrdFeed(grId);
  showGrToast('Post published!');
}

// ======================== JOIN / LEAVE ========================
function toggleJoin(id, btn, inDetail) {
  const joined = isMember(id);
  if (joined) { myGroups = myGroups.filter(g=>g!==id); }
  else { myGroups.push(id); }
  window.safeStorage.set('gh_my_groups', myGroups);
  const nowJoined = isMember(id);
  if (btn) {
    if (btn.classList.contains('grd-join-btn')) {
      btn.innerHTML = nowJoined ? '<i class="fas fa-check"></i> Joined' : '<i class="fas fa-plus"></i> Join Group';
    } else {
      btn.innerHTML = nowJoined ? '<i class="fas fa-check"></i> Joined' : '<i class="fas fa-plus"></i> Join';
    }
    btn.classList.toggle('joined', nowJoined);
  }
  document.querySelectorAll(`.gr-join-btn[onclick*="'${id}'"]`).forEach(b => {
    b.innerHTML = nowJoined ? '<i class="fas fa-check"></i> Joined' : '<i class="fas fa-plus"></i> Join';
    b.classList.toggle('joined', nowJoined);
  });
  showGrToast(nowJoined ? 'Joined group!' : 'Left group.');
  if (document.getElementById('panel-my-groups')?.classList.contains('active')) renderMyGroups();
}

// ======================== MY GROUPS PANEL ========================
function renderMyGroups() {
  const myEl = document.getElementById('myGroupsGrid');
  if (!myEl) return;
  const list = MOCK_GROUPS.filter(g=>myGroups.includes(g.id));
  myEl.innerHTML = list.length
    ? list.map(renderGroupCard).join('')
    : '<div class="gr-empty"><i class="fas fa-users"></i><p>You haven\'t joined any groups yet.<br>Discover and join groups that match your interests.</p></div>';

  const recEl = document.getElementById('recGroupsGrid');
  if (!recEl) return;
  const rec = MOCK_GROUPS.filter(g => !myGroups.includes(g.id) && MY_INTERESTS.includes(g.category)).slice(0,4);
  recEl.innerHTML = rec.length ? rec.map(renderGroupCard).join('') : '<div class="gr-empty"><i class="fas fa-bolt"></i><p>No recommendations right now.</p></div>';
}

// ======================== CREATE GROUP MODAL ========================
function openCreateGroup() { openGrModal('createGroupModal'); }
function submitCreateGroup() {
  const name  = document.getElementById('cgName')?.value?.trim();
  const cat   = document.getElementById('cgCategory')?.value;
  const city  = document.getElementById('cgCity')?.value;
  const desc  = document.getElementById('cgDesc')?.value?.trim();
  const errEl = document.getElementById('cgError');
  if (!name||!desc) { if(errEl){errEl.textContent='Name and description are required.';errEl.classList.remove('hidden');}return; }
  if(errEl) errEl.classList.add('hidden');
  const newGr = {
    id:'gr_'+Date.now(), name, slug:name.toLowerCase().replace(/\s+/g,'-'), category:cat||'Other',
    cover:'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
    icon:'fas fa-users', color:'#10b981',
    city:city||'Tbilisi', members:1, online:1, activity:'New',
    trustLevel:'Basic', verified:false, private:document.getElementById('cgPrivate')?.checked||false,
    description:desc, tags:[], rules:['Be respectful'], admins:['u01'],
    recentMembers:['https://i.pravatar.cc/40?img=47'],
    posts:[], events:[], challenges:[],
  };
  MOCK_GROUPS.unshift(newGr);
  myGroups.push(newGr.id);
  window.safeStorage.set('gh_my_groups', myGroups);
  document.getElementById('createWrap')?.classList.add('hidden');
  document.getElementById('createSuccess')?.classList.remove('hidden');
  applyGrFilters();
}

// ======================== SHARE ========================
function openGrShare(id) {
  const gr = MOCK_GROUPS.find(g=>g.id===id);
  document.getElementById('grShareUrl').value = window.location.href.split('?')[0]+'?group='+id;
  openGrModal('grShareModal');
}
function copyGrUrl() {
  const inp = document.getElementById('grShareUrl'); if(!inp) return;
  inp.select(); document.execCommand('copy');
  const btn = document.getElementById('copyGrBtn'); if(btn){btn.textContent='Copied!';setTimeout(()=>btn.textContent='Copy',1800);}
}

// ======================== TABS (PAGE) ========================
function switchGrTab(tab, el) {
  document.querySelectorAll('.gr-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.gr-tab-panel').forEach(p=>p.classList.remove('active'));
  if(el) el.classList.add('active');
  document.getElementById('panel-'+tab)?.classList.add('active');
  if(tab==='my-groups') renderMyGroups();
}

// ======================== MODAL HELPERS ========================
function openGrModal(id){const m=document.getElementById(id);if(!m)return;m.style.display='flex';requestAnimationFrame(()=>m.classList.add('open'));}
function closeGrModal(id){const m=document.getElementById(id);if(!m)return;m.classList.remove('open');setTimeout(()=>{m.style.display='none';},280);}
function showGrToast(msg){const t=document.getElementById('grToast');if(!t)return;t.textContent=msg;t.classList.add('visible');setTimeout(()=>t.classList.remove('visible'),2600);}

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded',()=>{
  applyGrFilters();
  renderMyGroups();

  const qi=document.getElementById('grSearchInput');
  if(qi) qi.addEventListener('input',()=>{grState.q=qi.value;applyGrFilters();});

  const sortSel=document.getElementById('grSortSelect');
  if(sortSel) sortSel.addEventListener('change',()=>{grState.sort=sortSel.value;applyGrFilters();});

  const citySel=document.getElementById('grCityFilter');
  if(citySel) citySel.addEventListener('change',()=>{grState.city=citySel.value;applyGrFilters();});

  ['grVerified','grOpen'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.addEventListener('change',()=>{
      if(id==='grVerified') grState.verified=el.checked;
      if(id==='grOpen')     grState.open=el.checked;
      applyGrFilters();
    });
  });

  document.addEventListener('keydown',e=>{if(e.key==='Escape')['grDetailModal','createGroupModal','composeModal','grShareModal'].forEach(closeGrModal);});
  ['grDetailModal','createGroupModal','composeModal','grShareModal'].forEach(id=>{
    const m=document.getElementById(id);
    if(m) m.addEventListener('click',e=>{if(e.target===m)closeGrModal(id);});
  });

  const url=new URLSearchParams(window.location.search);
  if(url.get('group')) openGroupDetail(url.get('group'));
});
