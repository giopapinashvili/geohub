/* ================================================================
   GeoHub — Groups / Communities System
   ================================================================ */

// ======================== DATA ========================
const GROUP_CATEGORIES = ['All','Hiking','Cafés','Photography','Nightlife','Startups','Fitness','Students','Travel','Learning','Real Estate'];

const MOCK_GROUPS = [];

const MY_INTERESTS = ['Hiking','Cafés','Learning','Fitness'];

// ======================== STATE ========================
let myGroups   = window.safeStorage.get('gh_my_groups', []);
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
