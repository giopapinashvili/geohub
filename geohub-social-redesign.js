/* GeoHub Social Redesign v2
   Self-contained app shell for feed/discover/groups/business pages.
   Uses Firebase Auth + Firestore through window.GeoFirebase and window.GeoSocial.
*/
(function(){
  'use strict';

  var PATH = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var PAGE = document.body && document.body.dataset ? document.body.dataset.ghPage : '';
  var state = { page: PAGE, filter: 'all', postsUnsubs: {}, replyUnsubs: {}, currentBusinessTab: 'posts', bizDashSection: 'overview', currentGroupTab: 'discussion', starRating: 5, theme: 'light', authUnsub: null, badgeUnsubs: [], sidebarCollapsed: false, hiddenPostIds: [], blockedUserIds: [], safetyUnsub: null, sharedPostCache: {}, friendIds: [], followingIds: [], audienceLoaded: false, pageUnsubs: [], currentBizId: null, currentBizOwner: null };

  /* ── User cache (instant topbar, no flash) ──────────────── */
  var USER_CACHE_KEY = 'gh_uc1';
  function getCachedUser(){
    try{var s=localStorage.getItem(USER_CACHE_KEY);if(!s)return null;var d=JSON.parse(s);if(Date.now()-d.ts>7*864e5){localStorage.removeItem(USER_CACHE_KEY);return null;}return d;}catch(e){return null;}
  }
  function setCachedUser(u){
    if(!u||!u.uid)return;
    try{localStorage.setItem(USER_CACHE_KEY,JSON.stringify({uid:u.uid,name:u.name||'',avatar:u.avatar||'',ts:Date.now()}));}catch(e){}
  }
  function clearCachedUser(){try{localStorage.removeItem(USER_CACHE_KEY);}catch(e){}}

  /* ── Analytics helpers ───────────────────────────────────── */
  function todayDateKey(){
    var d=new Date(); var mm=String(d.getMonth()+1).padStart(2,'0'); var dd=String(d.getDate()).padStart(2,'0');
    return d.getFullYear()+'-'+mm+'-'+dd;
  }
  function bizTrack(bizId, field){
    if(!bizId||!field||!fs()||!db()) return;
    var uid=authUser()&&authUser().uid;
    if(uid&&state.currentBizOwner&&uid===state.currentBizOwner) return;
    var upd={updatedAt:fs().serverTimestamp()}; upd[field]=fs().increment(1);
    fs().setDoc(fs().doc(db(),'businesses',bizId,'analytics',todayDateKey()),upd,{merge:true}).catch(function(){});
  }
  function trackBizView(bizId, ownerId){
    if(!bizId||!fs()||!db()) return;
    var uid=authUser()&&authUser().uid;
    if(uid&&ownerId&&uid===ownerId) return;
    var key='ghbv_'+bizId; if(sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key,'1');
    fs().setDoc(fs().doc(db(),'businesses',bizId,'analytics',todayDateKey()),{views:fs().increment(1),uniqueViews:fs().increment(1),updatedAt:fs().serverTimestamp()},{merge:true}).catch(function(){});
  }

  /* ── Skeleton post card (feed loading state) ─────────────── */
  function skelPostCard(){
    return '<div class="gh-skel-post">'+
      '<div class="gh-skel-post-head"><div class="gh-avatar gh-skel"></div>'+
        '<div style="flex:1;min-width:0"><div class="gh-skel-line" style="width:130px;height:13px;margin-bottom:6px"></div>'+
        '<div class="gh-skel-line" style="width:72px;height:10px"></div></div></div>'+
      '<div class="gh-skel-line" style="width:95%;height:13px;margin:10px 0 6px"></div>'+
      '<div class="gh-skel-line" style="width:78%;height:13px;margin-bottom:6px"></div>'+
      '<div class="gh-skel-line" style="width:86%;height:13px;margin-bottom:14px"></div>'+
      '<div class="gh-skel-img"></div>'+
      '<div class="gh-skel-post-actions"><div class="gh-skel-line" style="width:58px;height:11px"></div>'+
        '<div class="gh-skel-line" style="width:58px;height:11px"></div>'+
        '<div class="gh-skel-line" style="width:58px;height:11px"></div></div>'+
    '</div>';
  }

  /* ── Working hours constants ────────────────────────────── */
  var DAYS_KEYS   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  var DAYS_LABELS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  function applyTheme(theme){
    theme = theme === 'dark' ? 'dark' : 'light';
    state.theme = theme;
    document.documentElement.setAttribute('data-gh-theme', theme);
    document.body && document.body.setAttribute('data-gh-theme', theme);
    try { localStorage.setItem('gh_theme', theme); } catch(e) {}
    var btn = document.getElementById('ghThemeToggle');
    if(btn){
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
  }
  function initTheme(){
    var current = document.documentElement.getAttribute('data-gh-theme') || 'dark';
    state.theme = current;
    var btn = document.getElementById('ghThemeToggle');
    if(btn){
      btn.setAttribute('aria-label', current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.innerHTML = current === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
  }

  function $(s, root){ return (root || document).querySelector(s); }
  function $all(s, root){ return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function text(v, fallback){ v = String(v == null ? '' : v).trim(); return v || fallback || ''; }
  function ts(v){ if(!v) return 0; if(typeof v.toMillis === 'function') return v.toMillis(); if(v.seconds) return v.seconds * 1000; if(v instanceof Date) return v.getTime(); if(typeof v === 'number') return v; return Date.parse(v) || 0; }
  function getItemImage(x){ return x.imageUrl||x.image||x.coverImage||x.coverImageUrl||x.coverUrl||x.photoUrl||x.mediaUrl||x.logoUrl||x.thumbnail||''; }
  function getItemCover(x){ return x.coverImage||x.coverImageUrl||x.coverUrl||x.imageUrl||x.image||x.photoUrl||x.thumbnail||(x.photos&&x.photos[0])||(x.images&&x.images[0])||''; }
  function itemMediaHtml(photo,title,icon){ return '<div class="gh-item-no-img"><i class="fas '+icon+'"></i></div>'+(photo?'<img src="'+esc(photo)+'" alt="'+esc(title||'')+'" loading="lazy" onerror="this.remove()">':''); }
  
  function isOnlineBusiness(b){ return !!(b && (b.businessType === 'online' || b.isOnline === true)); }
  function businessAreaLabel(b){
    if(!isOnlineBusiness(b)) return b && b.city ? b.city : 'Local';
    return b.serviceAreaText || ({georgia:'Available across Georgia', worldwide:'Worldwide / Remote', tbilisi:'Tbilisi only', batumi:'Batumi only', regions:'Selected regions'}[b.serviceArea] || 'Online Service');
  }
  function getPlaceCoords(p) {
    if (!p) return null;
    var lat = p.lat != null ? Number(p.lat) :
              p.latitude != null ? Number(p.latitude) :
              (p.location && typeof p.location === 'object' && p.location.lat != null) ? Number(p.location.lat) : null;
    var lng = p.lng != null ? Number(p.lng) :
              p.longitude != null ? Number(p.longitude) :
              (p.location && typeof p.location === 'object' && p.location.lng != null) ? Number(p.location.lng) : null;
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat: lat, lng: lng };
  }
  function businessModeChip(b){
    return isOnlineBusiness(b)
      ? '<span class="gh-chip gh-chip-online"><i class="fas fa-globe"></i> '+esc(businessAreaLabel(b))+'</span>'
      : '<span class="gh-chip"><i class="fas fa-location-dot"></i> '+esc(businessAreaLabel(b))+'</span>';
  }

  function formatWorkingHours(hours){
    if(!hours) return 'Working hours not added';
    if(typeof hours === 'string') return hours;
    if(typeof hours === 'object'){
      var todayJs = new Date().getDay(); // 0=Sun
      var todayKey = DAYS_KEYS[todayJs===0?6:todayJs-1];
      var h = hours[todayKey] || hours[DAYS_LABELS[todayJs===0?6:todayJs-1]] || hours[DAYS_LABELS[todayJs===0?6:todayJs-1].toLowerCase()] || null;
      if(h){ return h.closed ? 'Closed today' : ((h.open||'09:00')+' – '+(h.close||'18:00')); }
      return 'Hours added';
    }
    return 'Working hours not added';
  }

  function normWorkingHours(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) return null;
    var out={};
    DAYS_KEYS.forEach(function(k,i){
      var h=raw[k]||raw[DAYS_LABELS[i]]||raw[DAYS_LABELS[i].toLowerCase()]||null;
      out[k]=h&&typeof h==='object'
        ?{closed:!!h.closed,open:h.open||'09:00',close:h.close||'18:00'}
        :{closed:false,open:'09:00',close:'18:00'};
    });
    return out;
  }

  function parseMins(t){ var p=(t||'00:00').split(':'); return parseInt(p[0]||0)*60+parseInt(p[1]||0); }

  function isOpenNow(nhObj){
    if(!nhObj) return null;
    var now=new Date();
    var jsDay=now.getDay();
    var todayIdx=jsDay===0?6:jsDay-1;
    var h=nhObj[DAYS_KEYS[todayIdx]]; if(!h) return null;
    if(h.closed){
      var nextOpen=null;
      for(var i=1;i<=7;i++){
        var ni=(todayIdx+i)%7; var nh=nhObj[DAYS_KEYS[ni]];
        if(nh&&!nh.closed){ nextOpen=(i===1?'Tomorrow':'On '+DAYS_LABELS[ni])+' at '+(nh.open||'09:00'); break; }
      }
      return {open:false,nextOpen:nextOpen};
    }
    var openT=h.open||'09:00'; var closeT=h.close||'18:00';
    var nowM=now.getHours()*60+now.getMinutes();
    var openM=parseMins(openT); var closeM=parseMins(closeT);
    var isOpen=nowM>=openM&&nowM<closeM;
    var nextOpen2=null;
    if(!isOpen){
      if(nowM<openM) nextOpen2='Today at '+openT;
      else { for(var j=1;j<=7;j++){ var nj=(todayIdx+j)%7; var njh=nhObj[DAYS_KEYS[nj]]; if(njh&&!njh.closed){ nextOpen2=(j===1?'Tomorrow':'On '+DAYS_LABELS[nj])+' at '+(njh.open||'09:00'); break; } } }
    }
    return {open:isOpen,hours:openT+' – '+closeT,nextOpen:nextOpen2};
  }

  function openStatusBadge(wh){
    if(!wh||typeof wh!=='object') return '';
    var nh=normWorkingHours(wh); if(!nh) return '';
    var s=isOpenNow(nh); if(!s) return '';
    var label=s.open?'Open now':'Closed';
    var extra=(!s.open&&s.nextOpen)?'<span class="gh-hours-next"> · '+esc(s.nextOpen)+'</span>':'';
    return '<span class="gh-hours-status '+(s.open?'open':'closed')+'"><i class="fas fa-circle"></i> '+label+'</span>'+extra;
  }

  function workingHoursEditorHtml(wh){
    var n=normWorkingHours(wh)||{};
    DAYS_KEYS.forEach(function(k){ if(!n[k]) n[k]={closed:false,open:'09:00',close:'18:00'}; });
    return '<div class="gh-hours-editor" id="ghHoursEditor">'+
      DAYS_KEYS.map(function(k,i){
        var h=n[k];
        return '<div class="gh-hours-editor-row">'+
          '<span class="gh-hours-editor-day">'+DAYS_LABELS[i].slice(0,3)+'</span>'+
          '<label class="gh-hours-closed-toggle"><input type="checkbox" data-day="'+k+'" data-type="closed" id="hDay_'+k+'_closed"'+(h.closed?' checked':'')+'> <span>Closed</span></label>'+
          '<div class="gh-hours-times'+(h.closed?' gh-hours-times-hidden':'')+'" id="hDay_'+k+'_times">'+
            '<input type="time" class="gh-input gh-time-input" id="hDay_'+k+'_open" value="'+esc(h.open)+'" data-day="'+k+'" data-type="open">'+
            '<span class="gh-hours-dash">–</span>'+
            '<input type="time" class="gh-input gh-time-input" id="hDay_'+k+'_close" value="'+esc(h.close)+'" data-day="'+k+'" data-type="close">'+
          '</div>'+
        '</div>';
      }).join('')+
    '</div>';
  }

  function readWorkingHoursFromForm(){
    var wh={};
    DAYS_KEYS.forEach(function(k){
      var cb=$('#hDay_'+k+'_closed'); if(!cb) return;
      wh[k]=cb.checked
        ?{closed:true}
        :{closed:false,open:($('#hDay_'+k+'_open')&&$('#hDay_'+k+'_open').value)||'09:00',close:($('#hDay_'+k+'_close')&&$('#hDay_'+k+'_close').value)||'18:00'};
    });
    return Object.keys(wh).length===7?wh:null;
  }

  function bizInfoCardHtml(icon, label, valueHtml){
    return '<div class="gh-biz-info-card"><i class="fas '+icon+'"></i><div><span class="gh-biz-ic-label">'+esc(label)+'</span><span class="gh-biz-ic-value">'+valueHtml+'</span></div></div>';
  }

  function isValidUrl(v){ return !v||/^https?:\/\/.+\..+/.test(v); }
  function isValidEmail(v){ return !v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function timeAgo(v){ var t=ts(v); if(!t) return 'ახლახან'; var s=Math.max(1, Math.floor((Date.now()-t)/1000)); if(s<60)return s+'s'; var m=Math.floor(s/60); if(m<60)return m+'m'; var h=Math.floor(m/60); if(h<24)return h+'h'; var d=Math.floor(h/24); if(d<30)return d+'d'; var mo=Math.floor(d/30); if(mo<12)return mo+'mo'; return Math.floor(mo/12)+'y'; }
  function initials(name){ name=text(name,'GeoHub'); return name.split(/\s+/).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase(); }
  function img(url, alt){ return url ? '<img src="'+esc(url)+'" alt="'+esc(alt||'')+'" loading="lazy" onerror="this.remove()">' : ''; }
  function readFileAsDataUrl(file){ return new Promise(function(resolve,reject){ if(!file) return resolve(''); if(!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type||'')) return reject(new Error('Use a PNG, JPG, WEBP or GIF image.')); if(file.size > 8 * 1024 * 1024) return reject(new Error('Image must be under 8 MB.')); var r=new FileReader(); r.onload=function(){ resolve(r.result||''); }; r.onerror=reject; r.readAsDataURL(file); }); }
  function triggerImagePick(cb){ var input=document.createElement('input'); input.type='file'; input.accept='image/png,image/jpeg,image/webp,image/gif'; input.style.display='none'; document.body.appendChild(input); input.onchange=function(){ var f=input.files && input.files[0]; readFileAsDataUrl(f).then(function(url){ cb(url, f); }).catch(function(err){ toast(err.message || 'Image could not be read','error'); }).finally(function(){ input.remove(); }); }; input.click(); }
  function iconFor(type){ return ({post:'fa-newspaper',business:'fa-store',group:'fa-users',place:'fa-map-marker-alt',event:'fa-calendar',service:'fa-briefcase',reward:'fa-gift',challenge:'fa-trophy',learning:'fa-graduation-cap',creator:'fa-user-astronaut'})[type] || 'fa-circle'; }
  function labelFor(type){ return ({post:'Post',business:'Business',group:'Group',place:'Place',event:'Event',service:'Service',reward:'Reward',challenge:'Challenge',learning:'Learning',creator:'Creator'})[type] || text(type,'Item'); }
  function toast(msg, type){ if(window.GeoSocial && window.GeoSocial.toast) return window.GeoSocial.toast(msg,type); var old=$('.gh-toast'); if(old) old.remove(); var el=document.createElement('div'); el.className='gh-toast'+(type==='error'?' error':''); el.textContent=msg; document.body.appendChild(el); requestAnimationFrame(function(){el.classList.add('show');}); setTimeout(function(){el.classList.remove('show'); setTimeout(function(){el.remove();},250);},2300); }
  function GF(){ return window.GeoFirebase; }
  function GS(){ return window.GeoSocial; }
  function authUser(){ return GF() && GF().auth ? GF().auth.currentUser : null; }
  function fs(){ return GF() && GF().fs; }
  function db(){ return GF() && GF().db; }
  function ready(cb){ if(window.GeoSocial && window.GeoFirebase) return cb(); window.addEventListener('GeoSocialReady', function(){ cb(); }, { once:true }); }
  function requireLogin(){ if(authUser()) return true; if(GS()) GS().requireAuth(); else toast('შესვლა აუცილებელია', 'error'); return false; }
  function currentUserInfo(){ var u=authUser(); return { uid:u && u.uid, name:u ? (u.displayName || (u.email||'').split('@')[0] || 'GeoHub User') : 'Guest', avatar:u ? (u.photoURL || '') : ''}; }
  function canSeePost(p){
    if(!p) return false;
    if(p.status && p.status !== 'active') return false;
    var u=authUser();
    var author = p.authorId || p.userId || p.createdByUserId || p.createdBy || '';
    if(p.id && state.hiddenPostIds.indexOf(p.id) > -1) return false;
    if(author && state.blockedUserIds.indexOf(author) > -1) return false;
    var visibility = (p.visibility || 'public').toLowerCase();
    if(visibility === 'onlyme' || visibility === 'only_me') return !!(u && author === u.uid);
    if(visibility === 'friends') return !!(u && (author === u.uid || state.friendIds.indexOf(author) > -1));
    if(visibility === 'followers') return !!(u && (author === u.uid || state.followingIds.indexOf(author) > -1));
    return true;
  }

  function setupAudienceAccess(onChange){
    var u=authUser();
    state.friendIds = [];
    state.followingIds = [];
    state.audienceLoaded = false;
    if(!u || !fs() || !db()){ if(typeof onChange === 'function') onChange(); return; }
    Promise.all([
      fs().getDocs(fs().query(fs().collection(db(),'friends'), fs().where('users','array-contains',u.uid), fs().limit(300))).then(function(snap){
        var ids=[]; snap.forEach(function(d){ var arr=(d.data()||{}).users||[]; var other=arr.find(function(id){ return id !== u.uid; }); if(other) ids.push(other); });
        state.friendIds = ids;
      }).catch(function(){ state.friendIds=[]; }),
      fs().getDocs(fs().query(fs().collection(db(),'follows'), fs().where('followerId','==',u.uid), fs().limit(500))).then(function(snap){
        var ids=[]; snap.forEach(function(d){ var following=(d.data()||{}).followingId; if(following) ids.push(following); });
        state.followingIds = ids;
      }).catch(function(){ state.followingIds=[]; })
    ]).then(function(){ state.audienceLoaded = true; if(typeof onChange === 'function') onChange(); });
  }

  function extractMentions(textVal){
    var mentions=[];
    String(textVal||'').replace(/@([A-Za-z0-9_.-]{2,32})/g,function(_,u){ if(mentions.indexOf(u)===-1) mentions.push(u); });
    return mentions;
  }
  function docLink(type, id){ if(type==='business') return 'business.html?id='+encodeURIComponent(id); if(type==='group') return 'groups.html?id='+encodeURIComponent(id); if(type==='place') return 'places.html?id='+encodeURIComponent(id); if(type==='event') return 'events.html?id='+encodeURIComponent(id); return 'feed.html#post-'+encodeURIComponent(id); }
  function profileLink(uid){ return uid ? 'profile.html?id='+encodeURIComponent(uid) : 'profile.html'; }
  function authorLinkFor(item){
    item = item || {};
    var authorType = String(item.authorType || '').toLowerCase();
    if(authorType === 'business' || (item.targetType === 'business' && item.authorId && item.authorId === item.targetId)){
      return item.businessId || item.targetId || item.authorId ? 'business.html?id='+encodeURIComponent(item.businessId || item.targetId || item.authorId) : 'business.html';
    }
    return profileLink(item.authorId || item.userId || item.createdByUserId || item.createdBy || item.uid || '');
  }
  function userProfileAnchor(uid, cls, html, title){
    uid = uid || '';
    var label = title ? ' title="'+esc(title)+'" aria-label="'+esc(title)+'"' : '';
    if(!uid) return '<span class="'+esc(cls||'')+'"'+label+'>'+html+'</span>';
    return '<a class="'+esc(cls||'')+'" href="'+profileLink(uid)+'" data-user-profile="'+esc(uid)+'"'+label+'>'+html+'</a>';
  }

  function shell(opts){
    opts = opts || {};
    document.body.classList.add('gh-social-body','gh-fb-inspired');
    initTheme();
    document.body.innerHTML = '<div class="gh-shell">'+topbar()+
      '<div class="gh-layout">'+leftNav(opts.active||'')+'<main class="gh-center" id="ghCenter"></main>'+rightRail(opts.right||'')+'</div>'+createMenu()+'</div>';
    $('#ghCenter').innerHTML = opts.center || '';
    bindShell();
    updateTopUser();
    bindAuthState();
    listenBadges();
  }

  function topbar(){
    var c=getCachedUser();
    var avClass='gh-avatar'+(c?'':' gh-skel');
    var avContent=c?(c.avatar?'<img src="'+esc(c.avatar)+'" alt="" loading="eager" onerror="this.remove()">':esc(initials(c.name||''))):'';
    var nameContent=c?esc((c.name||'').split(' ')[0]):'';
    var nameAttr=c?'':' class="gh-skel-line"';
    var userHref=c?('profile.html?id='+encodeURIComponent(c.uid)):'#';
    return '<header class="gh-topbar gh-hub-topbar">'+
      '<a class="gh-brand" href="feed.html"><div class="gh-brand-mark">GH</div><span>Geo<span>Hub</span></span></a>'+
      '<div class="gh-top-search"><i class="fas fa-search"></i><input id="ghGlobalSearch" placeholder="მოძებნე ადგილები, ადამიანები, ჯგუფები…"></div>'+
      '<nav class="gh-center-tabs" aria-label="Primary navigation">'+
        '<a class="active" href="feed.html" title="Feed"><i class="fas fa-house"></i></a>'+
        '<a href="groups.html" title="Groups"><i class="fas fa-user-group"></i></a>'+
        '<a href="messages.html" title="Messages"><i class="fas fa-comment-dots"></i><b class="gh-badge-count" id="ghMsgBadge"></b></a>'+
        '<button type="button" id="ghNotifBtn" title="Notifications"><i class="fas fa-bell"></i><b class="gh-badge-count" id="ghNotifBadge"></b></button>'+
      '</nav>'+
      '<div class="gh-top-actions">'+
        '<button class="gh-icon-btn gh-sidebar-toggle" id="ghSidebarToggle" title="Collapse sidebar"><i class="fas fa-bars-staggered"></i></button>'+
        '<button class="gh-icon-btn gh-theme-toggle" id="ghThemeToggle" title="Toggle light/dark mode"><i class="fas fa-moon"></i></button>'+
        '<a class="gh-user-btn" href="'+userHref+'"><span class="'+avClass+'" id="ghTopAvatar">'+avContent+'</span><span id="ghTopName"'+nameAttr+'>'+nameContent+'</span></a>'+
        '<button class="gh-create-btn" id="ghCreateBtn"><i class="fas fa-plus"></i><span>შექმნა</span></button>'+
      '</div></header>';
  }

  function leftNav(active){
    var items=[
      ['feed','feed.html','fa-house','მთავარი Feed'],['places','places.html','fa-location-dot','რუკა / Places'],['business','business.html','fa-store','Businesses'],['groups','groups.html','fa-users','Groups'],['events','events.html','fa-calendar-xmark','Events'],['messages','messages.html','fa-comment-dots','Messages'],['notifications','notifications.html','fa-bell','Notifications'],['rewards','rewards.html','fa-gift','Rewards / Points'],['challenges','challenges.html','fa-trophy','Challenges'],['services','services.html','fa-grip','Services'],['realestate','real-estate.html','fa-house-chimney','Real Estate'],['learning','learning.html','fa-graduation-cap','Learning'],['creators','creators.html','fa-camera-retro','Creators'],['trust','trust.html','fa-shield-halved','Trust / Safety'],['admin','admin.html','fa-user-shield','Admin Panel']
    ];
    return '<aside class="gh-left"><nav class="gh-panel">'+items.map(function(it){return '<a class="gh-nav-item '+(active===it[0]?'active':'')+'" href="'+it[1]+'"><i class="fas '+it[2]+'"></i><span>'+it[3]+'</span></a>';}).join('')+'</nav></aside>';
  }

  function rightRail(extra){
    return '<aside class="gh-right" id="ghRightRail">'+(extra || defaultRight())+'</aside>';
  }

  function defaultRight(){
    return '<div class="gh-panel gh-right-widget"><div class="gh-section-title"><h3>Nearby Places</h3><a class="gh-small" href="places.html">ყველა</a></div><div class="gh-mini-list" id="ghRightPlaces"><div class="gh-mini-item"><span class="gh-mini-thumb"><i class="fas fa-spinner fa-spin"></i></span><div><strong>Loading places…</strong><span>Firestore</span></div></div></div></div>'+
      '<div class="gh-panel gh-right-widget"><div class="gh-section-title"><h3>Upcoming Events</h3><a class="gh-small" href="events.html">ყველა</a></div><div class="gh-mini-list" id="ghRightEvents"><div class="gh-mini-item"><span class="gh-mini-thumb"><i class="fas fa-spinner fa-spin"></i></span><div><strong>Loading events…</strong><span>Firestore</span></div></div></div></div>'+
      '<div class="gh-panel gh-right-widget"><div class="gh-section-title"><h3>Suggested Groups</h3><a class="gh-small" href="groups.html">ყველა</a></div><div class="gh-mini-list" id="ghSuggestions"><div class="gh-mini-item"><span class="gh-mini-thumb"><i class="fas fa-spinner fa-spin"></i></span><div><strong>Loading groups…</strong><span>Firestore</span></div></div></div></div>'+
      '<div class="gh-panel gh-right-widget"><div class="gh-section-title"><h3>Rewards & Coupons</h3><a class="gh-small" href="rewards.html">ყველა</a></div><div class="gh-mini-list" id="ghRightRewards"><div class="gh-empty mini"><i class="fas fa-gift"></i><h3>No rewards yet</h3><p>Real rewards appear after admin adds them.</p></div></div></div>';
  }

  function createMenu(){
    return '<div class="gh-create-menu" id="ghCreateMenu">'+
      '<button data-create-post><i class="fas fa-pen"></i>Create post</button>'+
      '<button data-create-story><i class="fas fa-bolt"></i>Add story</button>'+
      '<a href="add-business.html"><i class="fas fa-store"></i>Add business/page</a>'+
      '<a href="groups.html#create"><i class="fas fa-users"></i>Create group</a>'+
      '<a href="events.html"><i class="fas fa-calendar-plus"></i>Create event</a>'+
      '<a href="places.html"><i class="fas fa-map-marker-alt"></i>Add place</a>'+
    '</div>';
  }

  function bindShell(){
    var createBtn=$('#ghCreateBtn'), menu=$('#ghCreateMenu');
    if(createBtn && menu){ createBtn.onclick=function(e){ e.stopPropagation(); menu.classList.toggle('open'); }; document.addEventListener('click', function(){ menu.classList.remove('open'); }); menu.onclick=function(e){ e.stopPropagation(); }; }
    var themeBtn=$('#ghThemeToggle');
    if(themeBtn){ themeBtn.onclick=function(e){ e.preventDefault(); e.stopPropagation(); applyTheme(state.theme==='dark' ? 'light' : 'dark'); }; applyTheme(state.theme); }
    var sideBtn=$('#ghSidebarToggle');
    if(sideBtn){ sideBtn.onclick=function(e){ e.preventDefault(); e.stopPropagation(); state.sidebarCollapsed=!state.sidebarCollapsed; document.body.classList.toggle('gh-sidebar-collapsed', state.sidebarCollapsed); sideBtn.setAttribute('aria-pressed', state.sidebarCollapsed ? 'true' : 'false'); sideBtn.title = state.sidebarCollapsed ? 'Expand sidebars' : 'Collapse sidebars'; }; }
    document.addEventListener('click', function(e){
      if(e.target.closest('[data-create-post]')) openPostModal({});
      if(e.target.closest('[data-create-story]')) openStoryModal();
      if(e.target.closest('#ghNotifBtn')) openNotifications();
      var notif=e.target.closest('[data-notif]');
      if(notif && GS() && GS().markNotificationRead) GS().markNotificationRead(notif.dataset.notif);
    });
    var gs=$('#ghGlobalSearch'); if(gs){ gs.addEventListener('keydown', function(e){ if(e.key==='Enter' && gs.value.trim()) location.href='search.html?q='+encodeURIComponent(gs.value.trim()); }); }
    if(window.requestIdleCallback) requestIdleCallback(loadRightRail, { timeout: 2500 });
    else setTimeout(loadRightRail, 700);
    // When Firestore profile fully loads, refresh cache + topbar with richer data
    window.addEventListener('GeoAuthReady', function(e){
      var p=e&&e.detail;
      if(p&&p.uid){
        setCachedUser({uid:p.uid,name:p.fullName||p.displayName||p.name||'',avatar:p.avatar||p.photoURL||''});
      } else {
        clearCachedUser();
      }
      updateTopUser();
    });
  }

  function updateTopUser(){
    var isAuth=!!authUser(); var cached=getCachedUser();
    var av=$('#ghTopAvatar'), nm=$('#ghTopName'), link=document.querySelector('.gh-user-btn');
    if(!isAuth){
      if(cached){
        // Cache already rendered by topbar(); only ensure link is set
        if(link && link.getAttribute('href')==='#') link.setAttribute('href','profile.html?id='+encodeURIComponent(cached.uid));
        return;
      }
      // No auth, no cache — apply skeleton (first-visit / logged-out state)
      if(av){ av.className='gh-avatar gh-skel'; av.innerHTML=''; }
      if(nm){ nm.className='gh-skel-line'; nm.textContent=''; }
      if(link) link.setAttribute('href','#');
      return;
    }
    // Auth resolved — render real user
    var u=currentUserInfo();
    // Prefer GeoAuth Firestore profile for name/avatar if richer
    var ga=window.GeoAuth&&window.GeoAuth.getCurrentUser&&window.GeoAuth.getCurrentUser();
    var displayName=(ga&&(ga.fullName||ga.displayName||ga.name))||u.name||'';
    var displayAvatar=(ga&&(ga.avatar||ga.photoURL))||u.avatar||'';
    if(av){ av.className='gh-avatar'; av.innerHTML=displayAvatar?img(displayAvatar,displayName):esc(initials(displayName||'')); }
    if(nm){ nm.className=''; nm.textContent=(displayName||'').split(' ')[0]||'Me'; }
    if(link) link.setAttribute('href', profileLink(u.uid));
    document.querySelectorAll('.gh-nav-item').forEach(function(a){
      var txt=(a.textContent||'').trim().toLowerCase();
      if(txt==='profile') a.setAttribute('href', profileLink(u.uid));
      if(txt==='saved') a.setAttribute('href', profileLink(u.uid)+'&tab=saved');
    });
    // Update composer avatar if present
    var ca=$('#ghComposerAvatar');
    if(ca){ ca.className='gh-avatar'; ca.innerHTML=displayAvatar?img(displayAvatar,displayName):esc(initials(displayName||'')); }
    // Persist to cache
    setCachedUser({uid:u.uid,name:displayName,avatar:displayAvatar});
  }

  function bindAuthState(){
    var gf=GF();
    if(!gf || !gf.authFns || !gf.authFns.onAuthStateChanged || !gf.auth) return;
    if(state.authUnsub){ try{ state.authUnsub(); }catch(e){} state.authUnsub=null; }
    state.authUnsub = gf.authFns.onAuthStateChanged(gf.auth, function(fbUser){
      if(!fbUser) clearCachedUser();
      updateTopUser();
      listenBadges();
      var bid = new URLSearchParams(location.search).get('id');
      if((state.page === 'business' || PAGE === 'business') && bid) updateBusinessFollowButton(bid);
    });
  }

  function listenBadges(){
    ready(function(){
      var nb=$('#ghNotifBadge'), mb=$('#ghMsgBadge');
      if(nb) nb.textContent='';
      if(mb) mb.textContent='';
      (state.badgeUnsubs || []).forEach(function(u){ try{ if(u) u(); }catch(e){} });
      state.badgeUnsubs = [];
      var u=authUser(); if(!u) return;
      try{
        state.badgeUnsubs.push(GS().listenUserNotifications(u.uid, function(items){ var n=items.filter(function(x){return !x.read && !x.seen;}).length; var b=$('#ghNotifBadge'); if(b) b.textContent=n?String(n):''; }));
        var q=fs().query(fs().collection(db(),'conversations'), fs().where('participants','array-contains',u.uid), fs().limit(25));
        state.badgeUnsubs.push(fs().onSnapshot(q,function(snap){ var n=0; snap.forEach(function(d){ var x=d.data()||{}; if(x.lastSenderId && x.lastSenderId!==u.uid && Array.isArray(x.unreadFor) && x.unreadFor.indexOf(u.uid)>-1) n++; }); var b=$('#ghMsgBadge'); if(b) b.textContent=n?String(n):''; },function(){ }));
      }catch(e){}
    });
  }

  function loadRightRail(){
    ready(function(){
      if($('#ghRightStories')) loadStories('#ghRightStories', true);
      var list=$('#ghSuggestions'); if(!list) return;
      Promise.all([getLatest('groups',4), getLatest('places',4), getLatest('events',3), getLatest('rewards',3)]).then(function(res){
        var groups=res[0], places=res[1], events=res[2], rewards=res[3];
        if(!groups.length){ list.innerHTML='<div class="gh-empty mini"><i class="fas fa-users"></i><h3>No groups yet</h3><p>Real groups appear after creation.</p></div>'; }
        else { list.innerHTML=groups.map(function(x){ var title=x.name||x.title||'Untitled'; var photo=x.logoUrl||x.coverImageUrl||x.coverUrl||x.imageUrl||x.photoUrl; return '<a class="gh-mini-item" href="'+docLink('group',x.id)+'"><span class="gh-mini-thumb">'+(photo?img(photo,title):'<i class="fas fa-users"></i>')+'</span><div><strong>'+esc(title)+'</strong><span>'+esc(x.category||'Group')+'</span></div></a>'; }).join(''); }
        var pl=$('#ghRightPlaces'); if(pl){ pl.innerHTML = places.length ? places.map(function(x){ var title=x.name||x.title||'Untitled'; var photo=x.imageUrl||x.photoUrl||x.coverUrl||x.coverImageUrl; return '<a class="gh-mini-item" href="'+docLink('place',x.id)+'"><span class="gh-mini-thumb">'+(photo?img(photo,title):'<i class="fas fa-location-dot"></i>')+'</span><div><strong>'+esc(title)+'</strong><span>'+esc(x.city||x.region||'Place')+'</span></div></a>'; }).join('') : '<div class="gh-empty mini"><i class="fas fa-location-dot"></i><h3>No places yet</h3><p>Real places appear after admin adds them.</p></div>'; }
        var ev=$('#ghRightEvents'); if(ev){ ev.innerHTML = events.length ? events.map(function(x){ var title=x.name||x.title||'Untitled'; var when=x.startDate||x.date||x.createdAt; return '<a class="gh-mini-item" href="'+docLink('event',x.id)+'"><span class="gh-mini-thumb event"><i class="fas fa-calendar"></i></span><div><strong>'+esc(title)+'</strong><span>'+esc(x.city||x.location||timeAgo(when))+'</span></div></a>'; }).join('') : '<div class="gh-empty mini"><i class="fas fa-calendar"></i><h3>No events yet</h3><p>Real events appear after admin adds them.</p></div>'; }
        var rw=$('#ghRightRewards'); if(rw){ rw.innerHTML = rewards.length ? rewards.map(function(x){ var title=x.name||x.title||'Untitled'; var pts=x.points||x.cost||x.price||''; return '<a class="gh-mini-item" href="rewards.html"><span class="gh-mini-thumb reward"><i class="fas fa-gift"></i></span><div><strong>'+esc(title)+'</strong><span>'+esc(pts?pts+' points':'Reward')+'</span></div></a>'; }).join('') : '<div class="gh-empty mini"><i class="fas fa-gift"></i><h3>No rewards yet</h3><p>Real rewards appear after admin adds them.</p></div>'; }
      });
    });
  }

  function getLatest(collectionName, n){
    if(!GF()) return Promise.resolve([]);
    return fs().getDocs(fs().query(fs().collection(db(), collectionName), fs().limit(n||10))).then(function(snap){ var arr=[]; snap.forEach(function(d){ arr.push(Object.assign({id:d.id}, d.data())); }); arr.sort(function(a,b){ return ts(b.createdAt)-ts(a.createdAt); }); return arr; }).catch(function(){ return []; });
  }

  var GH_NOTIF_ICONS = {
    like:      { icon: 'fa-heart',    color: '#ef4444' },
    comment:   { icon: 'fa-comment',  color: '#3b82f6' },
    reply:     { icon: 'fa-reply',    color: '#8b5cf6' },
    follow:    { icon: 'fa-user-plus',color: '#10b981' },
    message:   { icon: 'fa-envelope', color: '#06b6d4' },
    reward:    { icon: 'fa-gift',     color: '#f59e0b' },
    badge:     { icon: 'fa-medal',    color: '#f59e0b' },
    challenge: { icon: 'fa-trophy',   color: '#f59e0b' }
  };

  function openNotifications(){
    if(!requireLogin()) return;
    var existing=$('#ghNotifModal'); if(existing){existing.remove();return;}
    modal('Notifications','<div id="ghNotifList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading…</h3></div></div>','<button class="gh-btn ghost" id="ghMarkAllRead">Mark all read</button><a class="gh-btn ghost" href="notifications.html">View all</a><button class="gh-btn ghost" data-close-modal>Close</button>','ghNotifModal');
    ready(function(){
      var uid=authUser().uid;
      $('#ghMarkAllRead').onclick=function(){ markVisibleNotificationsRead(); };
      var unsub = GS().listenUserNotifications(uid, function(items){
        var box=$('#ghNotifList'); if(!box) return;
        if(!items.length){ box.innerHTML='<div class="gh-empty"><i class="fas fa-bell"></i><h3>No notifications</h3><p>Likes, comments, messages and requests will appear here.</p></div>'; return; }
        box.innerHTML='<div class="gh-mini-list">'+items.slice(0,30).map(function(n){
          var ic=GH_NOTIF_ICONS[n.type]||{icon:'fa-bell',color:'#10b981'};
          return '<a class="gh-mini-item '+(!n.read?'unread':'')+'" href="'+esc(n.href||'feed.html')+'" data-notif="'+esc(n.id)+'">'+
            '<span class="gh-mini-thumb" style="color:'+ic.color+'"><i class="fas '+ic.icon+'"></i></span>'+
            '<div><strong>'+esc(n.title||'GeoHub')+'</strong><span>'+esc(n.body||n.message||'')+' · '+timeAgo(n.createdAt)+'</span></div></a>';
        }).join('')+'</div>';
        $all('[data-notif]').forEach(function(a){
          a.addEventListener('click', function(){
            var id=a.dataset.notif;
            if(fs()) fs().updateDoc(fs().doc(db(),'userNotifications',id),{read:true,seen:true}).catch(function(){});
          }, {once:true});
        });
      });
      var modalEl = $('#ghNotifModal');
      if(modalEl) modalEl._unsub = unsub;
    });
  }

  function markVisibleNotificationsRead(){
    if(!authUser() || !fs()) return;
    $all('[data-notif]').forEach(function(a){
      var id=a.dataset.notif;
      fs().updateDoc(fs().doc(db(),'userNotifications',id), { read:true, seen:true, openedAt:fs().serverTimestamp(), updatedAt:fs().serverTimestamp() }).catch(function(){});
    });
  }

  function modal(title, body, actions, id){
    var old=id?$('#'+id):null; if(old) old.remove();
    var wrap=document.createElement('div'); wrap.className='gh-modal-backdrop'; if(id) wrap.id=id;
    wrap.innerHTML='<div class="gh-modal"><div class="gh-modal-head"><h3>'+esc(title)+'</h3><button class="gh-modal-close" data-close-modal>✕</button></div><div class="gh-modal-body">'+body+'</div><div class="gh-modal-actions">'+(actions||'<button class="gh-btn ghost" data-close-modal>Cancel</button>')+'</div></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function(e){ if(e.target===wrap || e.target.closest('[data-close-modal]')){ if(wrap._unsub) try{ wrap._unsub(); }catch(_e){} wrap.remove(); } });
    return wrap;
  }


  function prepareMedia(urlOrFile, folder, onProgress){
    if(!urlOrFile) return Promise.resolve('');
    if(urlOrFile instanceof File){
      if(GS() && GS().uploadFile) return GS().uploadFile(urlOrFile, folder || 'posts', onProgress);
      return readFileAsDataUrl(urlOrFile).then(function(dataUrl){ return prepareMedia(dataUrl, folder, onProgress); });
    }
    if(GS() && GS().uploadImageDataUrl) return GS().uploadImageDataUrl(urlOrFile, folder || 'posts').then(function(finalUrl){
      if(urlOrFile.indexOf('data:') === 0 && !finalUrl) throw new Error('Image upload failed');
      return finalUrl;
    });
    return Promise.resolve(urlOrFile);
  }

  function openPostModal(extra){
    if(!requireLogin()) return;
    var body='<textarea class="gh-textarea" id="ghPostText" placeholder="რას აზიარებ დღეს?"></textarea>'+
      '<div class="gh-form-grid"><select class="gh-select" id="ghPostVisibility"><option value="public">🌍 Public</option><option value="friends">👥 Friends / Followers</option><option value="onlyme">🔒 Only me</option></select><input class="gh-input" id="ghPostFeeling" placeholder="Feeling / activity optional"></div>'+
      '<div style="height:10px"></div><input class="gh-input" id="ghPostImg" placeholder="Image URL optional"><div style="height:10px"></div>'+
      '<button class="gh-btn ghost full" id="ghPickPostImage" type="button"><i class="fas fa-image"></i> Choose image from device</button>'+
      '<div id="ghPostPreview" style="margin-top:10px"></div>'+
      '<div class="gh-upload-progress" id="ghPostUploadBar" style="display:none"><div class="gh-upload-track"><div class="gh-upload-bar" id="ghPostUploadFill"></div></div><span id="ghPostUploadPct">0%</span></div>'+
      '<div class="gh-small" style="margin-top:10px">Tip: mention people with @username. Privacy is saved with the post.</div>';
    modal('Create post', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitPost"><i class="fas fa-paper-plane"></i> Post</button>', 'ghPostModal');
    var picked='', pickedFile=null;
    $('#ghPickPostImage').onclick=function(){
      triggerImagePick(function(url, file){
        picked=url; pickedFile=file||null;
        $('#ghPostImg').value='';
        $('#ghPostPreview').innerHTML=url?'<img src="'+esc(url)+'" style="width:100%;max-height:260px;object-fit:cover;border-radius:16px;border:1px solid var(--gh-border)">':'';
      });
    };
    $('#ghSubmitPost').onclick=function(){
      var txt=$('#ghPostText').value, urlInput=$('#ghPostImg').value.trim();
      var mediaSource = pickedFile || picked || urlInput;
      if(!txt.trim() && !mediaSource) return toast('Write something or pick an image','error');
      var payload=Object.assign({ visibility: $('#ghPostVisibility').value, feeling: $('#ghPostFeeling').value.trim(), mentions: extractMentions(txt) }, extra||{});
      var submitBtn = $('#ghSubmitPost');
      if(submitBtn.disabled) return;
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = mediaSource ? '<i class="fas fa-circle-notch fa-spin"></i> Uploading…' : '<i class="fas fa-circle-notch fa-spin"></i> Posting…';
      var bar=$('#ghPostUploadBar'), fill=$('#ghPostUploadFill'), pctEl=$('#ghPostUploadPct');
      if(bar && mediaSource) bar.style.display='flex';
      prepareMedia(mediaSource, 'posts', function(pct){
        if(fill) fill.style.width=pct+'%';
        if(pctEl) pctEl.textContent=pct+'%';
        submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> '+pct+'%';
      }).then(function(finalUrl){
        if(mediaSource && !finalUrl && !(urlInput && !picked && !pickedFile)) throw new Error('Image upload failed');
        if(bar) bar.style.display='none';
        submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Posting…';
        GS().createPost(txt, finalUrl, function(){ var m=$('#ghPostModal'); if(m)m.remove(); }, payload);
      }).catch(function(err){ console.error('[GeoHub] post image upload failed', err); toast('Image upload failed. Check Cloudinary settings.', 'error'); if(bar) bar.style.display='none'; })
        .finally(function(){ var b=$('#ghSubmitPost'); if(b){ b.disabled=false; b.innerHTML=b.dataset.originalText || '<i class="fas fa-paper-plane"></i> Post'; } });
    };
  }

  function openStoryModal(){
    if(!requireLogin()) return;
    var body='<textarea class="gh-textarea" id="ghStoryText" placeholder="Story text…"></textarea>'+
      '<div style="height:10px"></div><input class="gh-input" id="ghStoryImg" placeholder="Image URL optional"><div style="height:10px"></div>'+
      '<button class="gh-btn ghost full" id="ghPickStoryImage" type="button"><i class="fas fa-image"></i> Choose image</button>'+
      '<div id="ghStoryPreview" style="margin-top:10px"></div>'+
      '<div class="gh-upload-progress" id="ghStoryUploadBar" style="display:none"><div class="gh-upload-track"><div class="gh-upload-bar" id="ghStoryUploadFill"></div></div><span id="ghStoryUploadPct">0%</span></div>';
    modal('Add story', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitStory">Share story</button>', 'ghStoryModal');
    var picked='', pickedFile=null;
    $('#ghPickStoryImage').onclick=function(){
      triggerImagePick(function(url, file){
        picked=url; pickedFile=file||null;
        $('#ghStoryImg').value='';
        $('#ghStoryPreview').innerHTML=url?'<img src="'+esc(url)+'" style="width:100%;max-height:260px;object-fit:cover;border-radius:16px;border:1px solid var(--gh-border)">':'';
      });
    };
    $('#ghSubmitStory').onclick=function(){
      var t=$('#ghStoryText').value, urlInput=$('#ghStoryImg').value.trim();
      var mediaSource=pickedFile||picked||urlInput;
      if(!t.trim()&&!mediaSource) return toast('Story needs text or image','error');
      if(!GS().createStory) return toast('Stories unavailable','error');
      var submitBtn=$('#ghSubmitStory');
      if(submitBtn.disabled) return;
      submitBtn.disabled=true; submitBtn.dataset.originalText=submitBtn.innerHTML;
      submitBtn.innerHTML=mediaSource?'<i class="fas fa-circle-notch fa-spin"></i> Uploading…':'<i class="fas fa-circle-notch fa-spin"></i> Sharing…';
      var bar=$('#ghStoryUploadBar'), fill=$('#ghStoryUploadFill'), pctEl=$('#ghStoryUploadPct');
      if(bar && mediaSource) bar.style.display='flex';
      prepareMedia(mediaSource,'stories',function(pct){
        if(fill) fill.style.width=pct+'%';
        if(pctEl) pctEl.textContent=pct+'%';
        submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> '+pct+'%';
      }).then(function(finalUrl){
        if(mediaSource && !finalUrl && !(urlInput && !picked && !pickedFile)) throw new Error('Image upload failed');
        if(bar) bar.style.display='none';
        GS().createStory(t,finalUrl,function(){ var m=$('#ghStoryModal'); if(m)m.remove(); });
      }).catch(function(err){ console.error('[GeoHub] story image upload failed', err); toast('Image upload failed. Check Cloudinary settings.','error'); if(bar) bar.style.display='none'; })
        .finally(function(){ var b=$('#ghSubmitStory'); if(b){ b.disabled=false; b.innerHTML=b.dataset.originalText||'Share story'; } });
    };
  }

  function normalizeStoryItem(s){
    s=s||{};
    return Object.assign({}, s, {
      id: s.id || s.storyId || '',
      authorId: s.authorId || s.userId || s.uid || '',
      authorName: s.authorName || s.userName || s.name || 'GeoHub User',
      authorAvatar: s.authorAvatar || s.userPhotoURL || s.photoURL || '',
      mediaUrl: s.mediaUrl || s.imageUrl || s.photoUrl || '',
      text: s.text || s.caption || '',
      createdAt: s.createdAt || s.timestamp || Date.now()
    });
  }

  function buildStoryGroups(items){
    var groups=[], map={}, seenIds={};
    (items||[]).map(normalizeStoryItem).forEach(function(story){
      if(story.id && seenIds[story.id]) return;
      if(story.id) seenIds[story.id]=true;
      var key = story.authorId || story.authorName || story.id || 'unknown';
      if(!map[key]){
        map[key] = { key:key, authorId:story.authorId, authorName:story.authorName, authorAvatar:story.authorAvatar, stories:[] };
        groups.push(map[key]);
      }
      if(story.authorAvatar && !map[key].authorAvatar) map[key].authorAvatar = story.authorAvatar;
      map[key].stories.push(story);
    });
    groups.forEach(function(g){ g.stories.sort(function(a,b){ return ts(b.createdAt)-ts(a.createdAt); }); });
    return groups;
  }

  function renderStoryCard(group, index){
    var first = group.stories[0] || {};
    var media = first.mediaUrl || '';
    var av = group.authorAvatar || '';
    return '<button type="button" class="gh-story-card gh-story-v2-card" data-story-group="'+index+'" aria-label="Open '+esc(group.authorName)+' stories">'+
      '<div class="gh-story-bg">'+(media ? img(media, group.authorName) : '<span>📖</span>')+'</div>'+
      '<span class="gh-story-avatar-mini">'+(av ? img(av, group.authorName) : esc(initials(group.authorName)))+'</span>'+
      (group.stories.length > 1 ? '<span class="gh-story-count">'+group.stories.length+'</span>' : '')+
      '<strong>'+esc(group.authorName)+'</strong>'+
      '<small>'+timeAgo(first.createdAt)+'</small>'+
    '</button>';
  }

  function loadStories(selector, mini){
    ready(function(){
      var box=$(selector); if(!box) return;
      if(box.dataset.storiesBound === '1') return;
      box.dataset.storiesBound = '1';
      var groups=[];
      box.innerHTML='<button type="button" class="gh-story-card gh-story-add" data-create-story><div><i class="fas fa-plus-circle"></i><br><strong>Create</strong></div></button>';
      GS().listenStories(function(items){
        groups = buildStoryGroups(items || []);
        var add='<button type="button" class="gh-story-card gh-story-add" data-create-story><div><i class="fas fa-plus-circle"></i><br><strong>Create</strong></div></button>';
        box.innerHTML = add + groups.slice(0, 16).map(renderStoryCard).join('');
      });
      box.addEventListener('click', function(e){
        var add = e.target.closest('[data-create-story]');
        if(add){ e.preventDefault(); openStoryModal(); return; }
        var card = e.target.closest('[data-story-group]');
        if(card){ e.preventDefault(); openStoryViewer(groups, Number(card.dataset.storyGroup)||0, 0); }
      });
    });
  }

  function openStoryViewer(groupsOrElement, groupIndex, storyIndex){
    var groups = Array.isArray(groupsOrElement) ? groupsOrElement : null;
    if(!groups){
      var el = groupsOrElement;
      var story = normalizeStoryItem({
        id: el && el.dataset ? el.dataset.storyId : '',
        authorId: el && el.dataset ? el.dataset.storyAuthorId : '',
        authorName: el && el.dataset ? el.dataset.storyAuthor : 'Story',
        text: el && el.dataset ? el.dataset.storyText : '',
        mediaUrl: el && el.dataset ? el.dataset.storyMedia : ''
      });
      groups = buildStoryGroups([story]);
      groupIndex = 0;
      storyIndex = 0;
    }
    if(!groups || !groups.length) return;
    groupIndex = Number(groupIndex)||0;
    storyIndex = Number(storyIndex)||0;
    var old = document.getElementById('ghStoryOverlay'); if(old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'ghStoryOverlay';
    overlay.className = 'gh-story-overlay';
    document.body.appendChild(overlay);
    document.body.classList.add('gh-story-open');

    var _autoTimer = null;
    var STORY_DUR = 5000;

    function clearTimer(){ if(_autoTimer){ clearTimeout(_autoTimer); _autoTimer=null; } }
    function close(){ clearTimer(); overlay.remove(); document.body.classList.remove('gh-story-open'); document.removeEventListener('keydown', onKey); }

    function tryAdvance(){
      var g = groups[groupIndex];
      var nextS = storyIndex + 1;
      if(nextS < g.stories.length){ storyIndex=nextS; draw(); return; }
      var nextG = groupIndex + 1;
      if(nextG < groups.length){ groupIndex=nextG; storyIndex=0; draw(); return; }
      close();
    }

    function draw(){
      clearTimer();
      var g = groups[groupIndex];
      var st = g.stories[storyIndex] || {};
      var media = st.mediaUrl || '';
      var bars = g.stories.map(function(_,i){
        return '<span class="'+(i < storyIndex ? 'done' : (i === storyIndex ? 'current' : ''))+'"></span>';
      }).join('');
      overlay.innerHTML =
        '<div class="gh-story-shell" role="dialog" aria-modal="true" aria-label="Story viewer">'+
        '<div class="gh-story-progress">'+bars+'</div>'+
        '<div class="gh-story-head">'+
          '<div class="gh-story-author">'+
            (g.authorAvatar?'<span class="gh-story-author-avatar">'+img(g.authorAvatar,g.authorName)+'</span>':'<span class="gh-story-author-avatar initials">'+esc(initials(g.authorName))+'</span>')+
            '<div><strong>'+esc(g.authorName)+'</strong><small>'+(storyIndex+1)+'/'+g.stories.length+' · '+timeAgo(st.createdAt)+'</small></div>'+
          '</div>'+
          '<button type="button" class="gh-story-close" aria-label="Close story">×</button>'+
        '</div>'+
        '<div class="gh-story-main">'+
          (media?'<img src="'+esc(media)+'" alt="Story image" loading="eager" onerror="this.style.display=\'none\'">':'<p>'+esc(st.text||'Story')+'</p>')+
          (media && st.text?'<div class="gh-story-caption">'+esc(st.text)+'</div>':'')+
        '</div>'+
        '<button type="button" class="gh-story-nav prev" aria-label="Previous story">‹</button>'+
        '<button type="button" class="gh-story-nav next" aria-label="Next story">›</button>'+
        '</div>';

      overlay.querySelector('.gh-story-close').onclick = close;
      overlay.querySelector('.gh-story-nav.prev').onclick = function(e){
        e.stopPropagation();
        if(storyIndex > 0){ storyIndex--; } else if(groupIndex > 0){ groupIndex--; storyIndex=groups[groupIndex].stories.length-1; } else return;
        draw();
      };
      overlay.querySelector('.gh-story-nav.next').onclick = function(e){ e.stopPropagation(); tryAdvance(); };
      overlay.querySelector('.gh-story-main').onclick = function(e){
        if(e.target.closest('.gh-story-caption')) return;
        var r = overlay.querySelector('.gh-story-main').getBoundingClientRect();
        if(e.clientX < r.left + r.width * 0.35){
          if(storyIndex > 0){ storyIndex--; } else if(groupIndex > 0){ groupIndex--; storyIndex=groups[groupIndex].stories.length-1; } else return;
          draw();
        } else { tryAdvance(); }
      };

      _autoTimer = setTimeout(tryAdvance, STORY_DUR);
    }

    function onKey(e){ if(e.key==='Escape') close(); if(e.key==='ArrowLeft'){ clearTimer(); if(storyIndex>0){storyIndex--;}else if(groupIndex>0){groupIndex--;storyIndex=groups[groupIndex].stories.length-1;}else return; draw(); } if(e.key==='ArrowRight'){ clearTimer(); tryAdvance(); } }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) close(); });
    var _tx = 0;
    overlay.addEventListener('touchstart', function(e){ _tx = e.changedTouches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', function(e){
      var dx = e.changedTouches[0].clientX - _tx;
      if(Math.abs(dx) > 48){ clearTimer(); if(dx < 0){ tryAdvance(); } else { if(storyIndex>0){storyIndex--;}else if(groupIndex>0){groupIndex--;storyIndex=groups[groupIndex].stories.length-1;} draw(); } }
    }, { passive: true });
    draw();
  }

  function postCard(p, options){
    options=options||{}; var name=p.authorName||p.userName||p.businessName||'GeoHub User'; var av=p.authorAvatar||p.userPhotoURL||p.logoUrl||''; var imgUrl=p.imageUrl||p.mediaUrl||p.photoUrl||''; var pid=p.id; var target='';
    var authorHref = authorLinkFor(p);
    var authorId = p.authorId || p.userId || p.createdByUserId || p.createdBy || '';
    var avatarHtml = (av?img(av,name):esc(initials(name)));
    var authorAttrs = authorId ? ' data-user-profile="'+esc(authorId)+'"' : '';
    if(p.targetType && p.targetId) target='<div class="gh-post-target"><i class="fas '+iconFor(p.targetType)+'"></i>'+esc(labelFor(p.targetType))+'</div>';
    var privacyIcon = (p.visibility==='onlyme'||p.visibility==='only_me') ? 'fa-lock' : ((p.visibility==='friends'||p.visibility==='followers') ? 'fa-user-group' : 'fa-earth-europe');
    return '<article class="gh-card gh-post" id="post-'+esc(pid)+'" data-post-id="'+esc(pid)+'" data-author-id="'+esc(authorId)+'">'+
      '<div class="gh-post-head"><a class="gh-avatar gh-profile-avatar-link" href="'+esc(authorHref)+'"'+authorAttrs+'>'+(avatarHtml)+'</a><div class="gh-post-meta"><a class="gh-post-name gh-profile-name-link" href="'+esc(authorHref)+'"'+authorAttrs+'>'+esc(name)+'</a><div class="gh-post-time">'+timeAgo(p.createdAt)+' · <i class="fas '+privacyIcon+'"></i>'+target+(p.feeling?' · '+esc(p.feeling):'')+'</div></div><button class="gh-post-more" data-post-menu><i class="fas fa-ellipsis"></i></button></div>'+
      (p.text?'<div class="gh-post-text">'+esc(p.text)+'</div>':'')+
      (imgUrl?'<img class="gh-post-img" src="'+esc(imgUrl)+'" alt="post image" loading="lazy" onerror="this.style.display=\'none\'">':'')+
      (p.sharedPostId?'<div class="gh-shared-preview" data-shared-post="'+esc(p.sharedPostId)+'"><i class="fas fa-share"></i><div><strong>Shared post</strong><span>Loading original post...</span></div></div>':'')+
      '<div class="gh-post-stats"><span><i class="fas fa-thumbs-up"></i> <b data-like-count>'+Number(p.likeCount||p.reactionCount||0)+'</b></span><span><b data-comment-count>'+Number(p.commentCount||0)+'</b> comments · <b>'+Number(p.shareCount||0)+'</b> shares</span></div>'+
      '<div class="gh-post-actions"><button class="gh-act" data-like><i class="fas fa-thumbs-up"></i> Like</button><button class="gh-act" data-comment-toggle><i class="fas fa-comment"></i> Comment</button><button class="gh-act" data-share><i class="fas fa-share"></i> Share</button><button class="gh-act" data-save><i class="fas fa-bookmark"></i> Save</button></div>'+
      '<div class="gh-reaction-strip"><button data-reaction="like">👍</button><button data-reaction="love">❤️</button><button data-reaction="haha">😂</button><button data-reaction="wow">😮</button><button data-reaction="sad">😢</button><button data-reaction="angry">😡</button></div>'+
      '<div class="gh-comments" data-comments hidden><div data-comments-list></div><form class="gh-comment-form" data-comment-form><input class="gh-input" placeholder="Write a comment…"><button class="gh-btn"><i class="fas fa-paper-plane"></i></button></form></div>'+
    '</article>';
  }

  function bindPostInteractions(root){
    root = root || document;
    root.addEventListener('click', function(e){
      var card=e.target.closest('[data-post-id]'); if(!card) return; var pid=card.dataset.postId;
      if(e.target.closest('[data-like]')){ if(!requireLogin()) return; setReaction(pid,'like',card); }
      var ro=e.target.closest('[data-reaction]'); if(ro){ if(!requireLogin()) return; setReaction(pid,ro.dataset.reaction,card); }
      if(e.target.closest('[data-comment-toggle]')){ toggleComments(card,pid); }
      if(e.target.closest('[data-share]')){ sharePost(pid); }
      if(e.target.closest('[data-save]')){ if(!requireLogin()) return; GS().toggleSavePost(pid,function(saved){ var b=card.querySelector('[data-save]'); if(b) b.classList.toggle('active',!!saved); }); }
      if(e.target.closest('[data-post-menu]')){ postMenu(pid,card); }
      var rb=e.target.closest('[data-comment-reply]'); if(rb){ e.preventDefault(); openReplyForm(card,pid,rb.dataset.commentId); }
      var cr=e.target.closest('[data-copy-post-link]'); if(cr && navigator.clipboard){ navigator.clipboard.writeText(location.origin+location.pathname+'#post-'+pid).then(function(){toast('Post link copied');}); }
    });
    root.addEventListener('submit', function(e){
      var form=e.target.closest('[data-comment-form]');
      if(form){ e.preventDefault(); var card=form.closest('[data-post-id]'), pid=card.dataset.postId; var input=form.querySelector('input'); var val=input.value.trim(); if(!val) return; if(!requireLogin()) return; GS().addComment(pid,val,function(){ input.value=''; }); return; }
      var rform=e.target.closest('[data-reply-form]');
      if(rform){ e.preventDefault(); var card2=rform.closest('[data-post-id]'), pid2=card2.dataset.postId, cid=rform.dataset.commentId; var rin=rform.querySelector('input'); var rv=rin.value.trim(); if(!rv) return; if(!requireLogin()) return; if(GS().addCommentReply) GS().addCommentReply(pid2,cid,rv,function(){ rin.value=''; rform.hidden=true; }); else toast('Replies are not available','error'); }
    });
  }


  function hydrateReactionState(postId){
    var u=authUser(); if(!u || !fs()) return;
    var card=document.querySelector('[data-post-id="'+CSS.escape(postId)+'"]');
    if(!card) return;
    fs().getDoc(fs().doc(db(),'posts',postId,'reactions',u.uid)).then(function(snap){
      if(snap.exists()) updateReactionUi(card, (snap.data()||{}).type || 'like');
      else if(GS().checkLiked) GS().checkLiked(postId,function(liked){ if(liked) updateReactionUi(card,'like'); });
    }).catch(function(){ if(GS().checkLiked) GS().checkLiked(postId,function(liked){ if(liked) updateReactionUi(card,'like'); }); });
  }

  function setReaction(postId, type, card){
    var u=authUser(); if(!u) return requireLogin();
    var f=fs(), reactionRef=f.doc(db(),'posts',postId,'reactions',u.uid), postRef=f.doc(db(),'posts',postId);
    f.getDoc(reactionRef).then(function(snap){
      var exists=snap.exists(), prev=exists ? (snap.data().type||'like') : '';
      if(exists && prev===type){
        return f.deleteDoc(reactionRef).then(function(){ return f.updateDoc(postRef,{likeCount:f.increment(-1), reactionCount:f.increment(-1)}).catch(function(){}); }).then(function(){ updateReactionUi(card,''); });
      }
      var write=f.setDoc(reactionRef,{userId:u.uid,type:type,createdAt:f.serverTimestamp(),updatedAt:f.serverTimestamp()},{merge:true});
      if(!exists) write=write.then(function(){ return f.updateDoc(postRef,{likeCount:f.increment(1), reactionCount:f.increment(1)}).catch(function(){}); });
      return write.then(function(){ updateReactionUi(card,type); });
    }).catch(function(err){ console.error('setReaction',err); toast('Reaction failed','error'); });
  }

  function updateReactionUi(card,type){
    if(!card) return;
    var like=card.querySelector('[data-like]');
    if(like){ like.classList.toggle('active',!!type); like.innerHTML=(type==='love'?'❤️ Love':type==='haha'?'😂 Haha':type==='wow'?'😮 Wow':type==='sad'?'😢 Sad':type==='angry'?'😡 Angry':'<i class="fas fa-thumbs-up"></i> Like'); }
    $all('[data-reaction]',card).forEach(function(b){ b.classList.toggle('active',b.dataset.reaction===type); });
  }

  function renderSharedPreviewData(p){
    if(!p) return '<i class="fas fa-share"></i><div><strong>Original post unavailable</strong><span>This post was deleted or is private.</span></div>';
    var name=p.authorName||p.userName||'GeoHub User';
    var imgUrl=p.imageUrl||p.mediaUrl||p.photoUrl||'';
    return (imgUrl?'<span class="gh-shared-thumb">'+img(imgUrl,'Shared post')+'</span>':'<i class="fas fa-share"></i>')+
      '<div><strong>'+esc(name)+'</strong><span>'+esc((p.text||'Photo post').slice(0,140))+' - '+timeAgo(p.createdAt)+'</span></div>';
  }

  function hydrateSharedPreviews(root){
    if(!fs() || !db()) return;
    $all('[data-shared-post]', root || document).forEach(function(el){
      var id=el.dataset.sharedPost;
      if(!id || el.dataset.loaded==='1') return;
      el.dataset.loaded='1';
      var cached=state.sharedPostCache[id];
      if(cached !== undefined){ el.innerHTML=renderSharedPreviewData(cached); return; }
      fs().getDoc(fs().doc(db(),'posts',id)).then(function(snap){
        var post=snap.exists()?Object.assign({id:id}, snap.data()):null;
        state.sharedPostCache[id]=post;
        el.innerHTML=renderSharedPreviewData(post);
      }).catch(function(){
        state.sharedPostCache[id]=null;
        el.innerHTML=renderSharedPreviewData(null);
      });
    });
  }

  function toggleComments(card,pid){
    var box=card.querySelector('[data-comments]'); if(!box) return; box.hidden=!box.hidden; if(box.hidden) return;
    if(state.postsUnsubs[pid]) return;
    var list=card.querySelector('[data-comments-list]');
    state.postsUnsubs[pid]=GS().listenComments(pid,function(items){
      if(!items.length){ list.innerHTML='<div class="gh-small" style="padding:10px 6px">No comments yet.</div>'; return; }
      list.innerHTML=items.map(function(c){ return commentCard(pid,c); }).join('');
      items.forEach(function(c){ loadReplies(pid,c.id); });
    });
  }

  function commentCard(pid,c){
    var name=c.authorName||c.userName||'User'; var uid=c.authorId||c.userId||''; var avHtml=(c.authorAvatar?img(c.authorAvatar,name):esc(initials(name)));
    return '<div class="gh-comment-row" data-comment-id="'+esc(c.id)+'">'+
      userProfileAnchor(uid,'gh-avatar gh-profile-avatar-link',avHtml,'Open '+name+' profile').replace('class="gh-avatar gh-profile-avatar-link"','class="gh-avatar gh-profile-avatar-link" style="width:32px;height:32px"')+
      '<div class="gh-comment-main"><div class="gh-comment-bubble"><strong>'+userProfileAnchor(uid,'gh-profile-name-link',esc(name),'Open '+name+' profile')+'</strong><span>'+esc(c.text||'')+'</span></div>'+
      '<div class="gh-small gh-comment-actions">'+timeAgo(c.createdAt)+' · <button type="button" data-comment-reply data-comment-id="'+esc(c.id)+'">Reply</button></div>'+
      '<form class="gh-reply-form" data-reply-form data-comment-id="'+esc(c.id)+'" hidden><input class="gh-input" placeholder="Write a reply…"><button class="gh-btn sm"><i class="fas fa-paper-plane"></i></button></form>'+
      '<div class="gh-replies" data-replies-for="'+esc(c.id)+'"></div></div></div>';
  }

  function openReplyForm(card,pid,cid){
    var f=card.querySelector('[data-reply-form][data-comment-id="'+CSS.escape(cid)+'"]');
    if(!f) return; f.hidden=!f.hidden; if(!f.hidden){ var input=f.querySelector('input'); if(input) input.focus(); }
  }

  function loadReplies(pid,cid){
    var key=pid+'_'+cid; if(state.replyUnsubs[key]) return;
    if(!GS().listenCommentReplies) return;
    state.replyUnsubs[key]=GS().listenCommentReplies(pid,cid,function(items){
      var box=document.querySelector('[data-post-id="'+CSS.escape(pid)+'"] [data-replies-for="'+CSS.escape(cid)+'"]'); if(!box) return;
      if(!items.length){ box.innerHTML=''; return; }
      box.innerHTML=items.map(function(r){ var name=r.authorName||'User'; var uid=r.authorId||r.userId||''; var av=(r.authorAvatar?img(r.authorAvatar,name):esc(initials(name))); return '<div class="gh-reply-row">'+userProfileAnchor(uid,'gh-avatar gh-profile-avatar-link',av,'Open '+name+' profile').replace('class="gh-avatar gh-profile-avatar-link"','class="gh-avatar gh-profile-avatar-link" style="width:26px;height:26px"')+'<div><div class="gh-comment-bubble"><strong>'+userProfileAnchor(uid,'gh-profile-name-link',esc(name),'Open '+name+' profile')+'</strong><span>'+esc(r.text||'')+'</span></div><div class="gh-small" style="padding-left:8px;margin-top:3px">'+timeAgo(r.createdAt)+'</div></div></div>'; }).join('');
    });
  }

  function sharePost(pid){
    if(!requireLogin()) return;
    var body='<textarea class="gh-textarea" id="ghShareText" placeholder="Say something about this…"></textarea><div class="gh-form-grid"><select class="gh-select" id="ghShareVisibility"><option value="public">🌍 Public</option><option value="friends">👥 Friends / Followers</option><option value="onlyme">🔒 Only me</option></select><button class="gh-btn ghost" id="ghCopySharedLink" type="button"><i class="fas fa-link"></i> Copy link</button></div><div class="gh-shared-preview" data-shared-post="'+esc(pid)+'" style="margin-top:10px"><i class="fas fa-share"></i><div><strong>Shared post</strong><span>Loading original post...</span></div></div>';
    modal('Share post', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitShare">Share to feed</button>', 'ghShareModal');
    hydrateSharedPreviews($('#ghShareModal'));
    $('#ghCopySharedLink').onclick=function(){ navigator.clipboard && navigator.clipboard.writeText(location.origin+location.pathname+'#post-'+pid).then(function(){toast('Post link copied');}); };
    $('#ghSubmitShare').onclick=function(){ GS().createPost($('#ghShareText').value, '', function(){ if($('#ghShareModal')) $('#ghShareModal').remove(); if(GS().trackShare) GS().trackShare(pid); }, { sharedPostId: pid, visibility: $('#ghShareVisibility').value }); };
  }

  function postMenu(pid, card){
    if(!requireLogin()) return;
    var authorId = card && card.dataset ? card.dataset.authorId : '';
    var body='<div class="gh-mini-list"><button class="gh-mini-item" data-copy-post-link><span class="gh-mini-thumb"><i class="fas fa-link"></i></span><div><strong>Copy link</strong><span>Share a direct link</span></div></button><button class="gh-mini-item" data-menu-save><span class="gh-mini-thumb"><i class="fas fa-bookmark"></i></span><div><strong>Save post</strong><span>Keep it for later</span></div></button><button class="gh-mini-item" data-menu-hide><span class="gh-mini-thumb"><i class="fas fa-eye-slash"></i></span><div><strong>Hide post</strong><span>Remove it from your feed</span></div></button><button class="gh-mini-item" data-menu-report><span class="gh-mini-thumb"><i class="fas fa-flag"></i></span><div><strong>Report post</strong><span>Send to moderation</span></div></button>'+(authorId?'<button class="gh-mini-item" data-menu-report-user><span class="gh-mini-thumb"><i class="fas fa-user-shield"></i></span><div><strong>Report author</strong><span>Report this user</span></div></button><button class="gh-mini-item danger" data-menu-block-user><span class="gh-mini-thumb"><i class="fas fa-ban"></i></span><div><strong>Block author</strong><span>Hide this user from your GeoHub</span></div></button>':'')+'</div>';
    modal('Post options', body, '<button class="gh-btn ghost" data-close-modal>Close</button>', 'ghPostMenuModal');
    var m=$('#ghPostMenuModal');
    m.addEventListener('click', function(e){
      if(e.target.closest('[data-menu-save]')){ GS().toggleSavePost(pid); m.remove(); }
      if(e.target.closest('[data-menu-hide]')){ if(GS().hidePost) GS().hidePost(pid,function(){ if(card) card.remove(); }); m.remove(); }
      if(e.target.closest('[data-menu-report]')){ if(GS().reportTarget) GS().reportTarget('post',pid,'Reported from post menu'); else createReport('post',pid,'Reported from post menu'); m.remove(); }
      if(e.target.closest('[data-menu-report-user]') && authorId){ if(GS().reportTarget) GS().reportTarget('user',authorId,'Reported from post menu'); m.remove(); }
      if(e.target.closest('[data-menu-block-user]') && authorId){ if(confirm('Block this user? Their posts will be hidden from your feed.')){ if(GS().blockUser) GS().blockUser(authorId,function(){ if(card) card.remove(); }); } m.remove(); }
    });
  }

  function createReport(type,id,reason){
    if(!requireLogin()) return;
    if(GS() && GS().reportTarget) return GS().reportTarget(type,id,reason); var u=authUser(); fs().addDoc(fs().collection(db(),'reports'), { reporterId:u.uid, targetType:type, targetId:id, reason:reason||'report', status:'pending', createdAt:fs().serverTimestamp() }).then(function(){toast('Report sent');}).catch(function(){toast('Report failed','error');});
  }


  function setupSafetyListener(onChange){
    if(state.safetyUnsub){ return; }
    if(!GS() || !GS().listenSafetyPrefs) return;
    state.safetyUnsub = GS().listenSafetyPrefs(function(prefs){
      state.hiddenPostIds = prefs.hiddenPostIds || [];
      state.blockedUserIds = prefs.blockedUserIds || [];
      if(typeof onChange === 'function') onChange();
    });
  }

  function setTextById(id, value){ var el=document.getElementById(id); if(el) el.textContent=value; }
  function updateGeoPulse(){
    ready(function(){
      Promise.all([getLatest('posts',25), getLatest('events',25), getLatest('businesses',25), getLatest('checkins',25)]).then(function(res){
        var posts=res[0].length, events=res[1].length, businesses=res[2].length, checkins=res[3].length;
        setTextById('gpPosts', posts); setTextById('gpPosts2', posts);
        setTextById('gpEvents', events); setTextById('gpEvents2', events);
        setTextById('gpBusinesses', businesses);
        setTextById('gpCheckins', checkins); setTextById('gpCheckins2', checkins);
        setTextById('gpActive', posts+events+businesses+checkins ? 'Live' : 'Ready');
      }).catch(function(){ setTextById('gpActive','Ready'); });
    });
  }

  function openDeepLinkedPost(){
    var params = new URLSearchParams(location.search);
    var pid = params.get('post') || (location.hash || '').replace('#post-','');
    if(!pid) return;
    var card = document.getElementById('post-'+pid) || document.querySelector('[data-post-id="'+CSS.escape(pid)+'"]');
    if(!card) return;
    card.classList.add('gh-deep-linked');
    card.scrollIntoView({ behavior:'smooth', block:'center' });
    toggleComments(card, pid);
    var cid = params.get('comment');
    if(cid){ setTimeout(function(){ var c = card.querySelector('[data-comment-id="'+CSS.escape(cid)+'"]'); if(c){ c.classList.add('gh-deep-linked-comment'); c.scrollIntoView({ behavior:'smooth', block:'center' }); } }, 1200); }
  }

  function renderFeed(){
    var c=getCachedUser();
    var compAvClass='gh-avatar'+(c?'':' gh-skel');
    var compAvContent=c?(c.avatar?'<img src="'+esc(c.avatar)+'" alt="" loading="eager" onerror="this.remove()">':esc(initials(c.name||''))):'';
    shell({ active:'feed', center:
      '<section class="gh-card gh-story-strip-card"><div class="gh-stories" id="ghStories"></div></section>'+
      '<section class="gh-card gh-composer"><div class="gh-composer-top"><span class="'+compAvClass+'" id="ghComposerAvatar">'+compAvContent+'</span><button class="gh-composer-fake" data-create-post>რას აზიარებ დღეს?</button></div><div class="gh-composer-actions"><button class="gh-composer-action" data-create-post><i class="fas fa-image" style="color:#22c55e"></i> Photo</button><button class="gh-composer-action" onclick="location.href=\'places.html\'"><i class="fas fa-map-marker-alt" style="color:#ef4444"></i> Place</button><button class="gh-composer-action" onclick="location.href=\'add-business.html\'"><i class="fas fa-store" style="color:#38bdf8"></i> Business</button><button class="gh-composer-action" onclick="location.href=\'events.html\'"><i class="fas fa-calendar" style="color:#f59e0b"></i> Event</button></div></section>'+
      '<div id="ghFeedList">'+skelPostCard()+skelPostCard()+skelPostCard()+'</div>'
    });
    loadStories('#ghStories');
    ready(function(){
      var list=$('#ghFeedList'); bindPostInteractions(list); var lastPosts=[];
      function paint(){
        var visible=lastPosts.filter(canSeePost);
        if(!visible.length){ list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-seedling"></i><h3>Feed is empty</h3><p>Create the first real post or adjust hidden/blocked filters.</p><button class="gh-btn" data-create-post><i class="fas fa-plus"></i>Create post</button></div>'; return; }
        list.innerHTML=visible.map(function(p){ return postCard(p); }).join('');
        visible.forEach(function(p){ try{ hydrateReactionState(p.id); }catch(e){} });
        hydrateSharedPreviews(list);
        setTimeout(openDeepLinkedPost, 350);
      }
      setupSafetyListener(paint);
      setupAudienceAccess(paint);
      GS().listenFeed(function(posts){ lastPosts=posts; paint(); }, 20);
    });
  }

  function discoverItem(x){
    var type=x._type; var title=x.title||x.name||x.text||'Untitled'; var desc=x.description||x.desc||x.text||x.category||''; var photo=getItemImage(x);
    if(type==='post') title=x.authorName ? x.authorName+' posted' : 'Post';
    return '<article class="gh-card gh-item-card" data-discover-card data-type="'+esc(type)+'"><div class="gh-item-media">'+itemMediaHtml(photo,title,iconFor(type))+'<span class="gh-type-badge"><i class="fas '+iconFor(type)+'"></i> '+labelFor(type)+'</span></div><div class="gh-item-body"><h3>'+esc(title)+'</h3><p>'+esc(desc||'Real GeoHub item')+'</p><div class="gh-item-meta">'+(type==='business'?businessModeChip(x):(x.city?'<span class="gh-chip"><i class="fas fa-location-dot"></i> '+esc(x.city)+'</span>':''))+(x.category?'<span class="gh-chip">'+esc(x.category)+'</span>':'')+'<span class="gh-chip">'+timeAgo(x.createdAt)+'</span></div><div class="gh-card-actions"><a class="gh-btn sm" href="'+docLink(type,x.id)+'">View</a><button class="gh-btn sm ghost" data-save-item data-type="'+esc(type)+'" data-id="'+esc(x.id)+'"><i class="fas fa-bookmark"></i></button><button class="gh-btn sm ghost" data-share-item data-url="'+docLink(type,x.id)+'"><i class="fas fa-share"></i></button></div></div></article>';
  }

  function renderDiscover(){
    shell({ active:'discover', center:'<div class="gh-card"><div class="gh-section-title"><div><h1>Discover</h1><p class="gh-muted" style="margin:.25rem 0 0">All real GeoHub content in one social feed.</p></div><a href="add-business.html" class="gh-btn"><i class="fas fa-plus"></i>Add business</a></div><input class="gh-input" id="ghDiscoverSearch" placeholder="Search posts, businesses, groups, places…"><div style="height:12px"></div><div class="gh-pill-row" id="ghDiscoverTabs"></div></div><div id="ghDiscoverList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading Discover…</h3></div></div>' });
    var tabs=['all','post','business','group','place','event','service','learning','reward','challenge','creator'];
    $('#ghDiscoverTabs').innerHTML=tabs.map(function(t){return '<button class="gh-pill '+(t==='all'?'active':'')+'" data-filter="'+t+'">'+(t==='all'?'All':labelFor(t))+'</button>';}).join('');
    var items=[];
    function paint(){
      var q=($('#ghDiscoverSearch') && $('#ghDiscoverSearch').value || '').toLowerCase().trim(); var f=state.filter||'all';
      var filtered=items.filter(function(x){ var ok=f==='all'||x._type===f; if(!ok)return false; if(!q)return true; return JSON.stringify(x).toLowerCase().includes(q); });
      var list=$('#ghDiscoverList');
      if(!filtered.length){ list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-compass"></i><h3>Nothing found</h3><p>No real Firestore content matches this filter.</p></div>'; return; }
      list.innerHTML='<div class="gh-grid">'+filtered.map(discoverItem).join('')+'</div>';
    }
    $('#ghDiscoverTabs').onclick=function(e){ var b=e.target.closest('[data-filter]'); if(!b)return; state.filter=b.dataset.filter; $all('.gh-pill', $('#ghDiscoverTabs')).forEach(function(x){x.classList.toggle('active',x===b);}); paint(); };
    $('#ghDiscoverSearch').oninput=paint;
    $('#ghCenter').addEventListener('click', function(e){
      var s=e.target.closest('[data-save-item]'); if(s){ if(!requireLogin())return; GS().toggleSaveItem(s.dataset.type,s.dataset.id); }
      var sh=e.target.closest('[data-share-item]'); if(sh){ navigator.clipboard && navigator.clipboard.writeText(location.origin+'/'+sh.dataset.url).then(function(){toast('Link copied');}).catch(function(){toast('Copy failed','error');}); }
    });
    ready(function(){
      var collections=[['posts','post'],['businesses','business'],['groups','group'],['places','place'],['events','event'],['services','service'],['rewards','reward'],['challenges','challenge'],['learningItems','learning'],['creators','creator']];
      Promise.all(collections.map(function(c){ return getLatest(c[0],20).then(function(arr){ return arr.map(function(x){ x._type=c[1]; return x; }); }); })).then(function(all){ items=[].concat.apply([],all).sort(function(a,b){return ts(b.createdAt)-ts(a.createdAt);}); paint(); }).catch(function(err){ var list=$('#ghDiscoverList'); if(list) list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Discover failed</h3><p>'+esc(err.message||err)+'</p></div>'; });
    });
  }

  function businessListCard(b){
    var title=b.title||b.name||'Untitled business'; var photo=b.coverUrl||getItemCover(b);
    return '<article class="gh-card gh-item-card"><div class="gh-item-media">'+itemMediaHtml(photo,title,'fa-store')+'<span class="gh-type-badge"><i class="fas fa-store"></i> Business Page</span></div><div class="gh-item-body"><h3>'+esc(title)+'</h3><p>'+esc(b.description||'Business page on GeoHub')+'</p><div class="gh-item-meta"><span class="gh-chip">'+esc(b.category||'Business')+'</span>'+businessModeChip(b)+'<span class="gh-chip">'+Number(b.followerCount||0)+' followers</span></div><div class="gh-card-actions"><a class="gh-btn sm" href="business.html?id='+encodeURIComponent(b.id)+'">View Page</a><button class="gh-btn sm ghost" data-follow-business="'+esc(b.id)+'"><i class="fas fa-plus"></i> Follow</button><button class="gh-btn sm ghost" data-save-item data-type="business" data-id="'+esc(b.id)+'"><i class="fas fa-bookmark"></i></button></div></div></article>';
  }

  function renderBusinesses(){
    var id=new URLSearchParams(location.search).get('id');
    if(id) return renderBusinessDetail(id);
    shell({ active:'business', center:'<div class="gh-card"><div class="gh-section-title"><div><h1>Businesses / Pages</h1><p class="gh-muted" style="margin:.25rem 0 0">Every business becomes a Page where owners can post updates.</p></div><a href="add-business.html" class="gh-btn"><i class="fas fa-plus"></i>Add Business</a></div><input class="gh-input" id="ghBusinessSearch" placeholder="Search businesses…"><div style="height:12px"></div><div class="gh-pill-row"><button class="gh-pill active" data-biz-filter="all">All</button><button class="gh-pill" data-biz-filter="food">Food</button><button class="gh-pill" data-biz-filter="tourism">Tourism</button><button class="gh-pill" data-biz-filter="services">Services</button><button class="gh-pill" data-biz-filter="online">Online</button><button class="gh-pill" data-biz-filter="shop">Shops</button><button class="gh-pill" data-biz-filter="education">Education</button></div></div><div id="ghBusinessList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>' });
    var all=[]; state.bizFilter='all';
    function paint(){ var q=($('#ghBusinessSearch').value||'').toLowerCase(); var arr=all.filter(function(b){ var cat=(b.category||'').toLowerCase(); var ok=state.bizFilter==='all'||cat.includes(state.bizFilter)||(state.bizFilter==='online' && isOnlineBusiness(b)); if(!ok)return false; return !q || JSON.stringify(b).toLowerCase().includes(q); }); var list=$('#ghBusinessList'); if(!arr.length){list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-store"></i><h3>No businesses yet</h3><p>Add a business and GeoHub will create a page for it.</p><a href="add-business.html" class="gh-btn">Add Business</a></div>';return;} list.innerHTML='<div class="gh-grid">'+arr.map(businessListCard).join('')+'</div>'; }
    $('#ghBusinessSearch').oninput=paint; $('#ghCenter').addEventListener('click', function(e){ var f=e.target.closest('[data-biz-filter]'); if(f){ state.bizFilter=f.dataset.bizFilter; $all('[data-biz-filter]').forEach(function(x){x.classList.toggle('active',x===f);}); paint(); } var fb=e.target.closest('[data-follow-business]'); if(fb) followBusiness(fb.dataset.followBusiness); var s=e.target.closest('[data-save-item]'); if(s){ if(!requireLogin())return; GS().toggleSaveItem(s.dataset.type,s.dataset.id); } });
    ready(function(){ var q=fs().query(fs().collection(db(),'businesses'), fs().orderBy('createdAt','desc'), fs().limit(40)); var _u=fs().onSnapshot(q,function(snap){ all=[]; snap.forEach(function(d){ var schema=window.GH||{}; all.push(schema.normBiz?schema.normBiz(d.data(),d.id):Object.assign({id:d.id},d.data())); }); paint(); }, function(err){ $('#ghBusinessList').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Could not load businesses</h3><p>'+esc(err.message)+'</p></div>'; }); state.pageUnsubs.push(_u); });
  }

  function renderBusinessDetail(id){
    shell({ active:'business', center:'<div id="ghBusinessDetail"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading business page…</h3></div></div>' });
    ready(function(){
      var _u=fs().onSnapshot(fs().doc(db(),'businesses',id), function(snap){
        if(!snap.exists()){ $('#ghBusinessDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-store-slash"></i><h3>Business not found</h3><p>This page does not exist or was removed.</p></div>'; return; }
        var raw=snap.data()||{}; var b=(window.GH&&window.GH.normBiz)?window.GH.normBiz(raw,id):Object.assign({id:id},raw); paintBusinessDetail(b);
      }, function(err){ $('#ghBusinessDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Load failed</h3><p>'+esc(err.message)+'</p></div>'; });
      state.pageUnsubs.push(_u);
    });
  }

  function paintBusinessDetail(b){
    var title  = b.title||b.name||'Business';
    var cover  = b.coverUrl||getItemCover(b);
    var logo   = b.logoUrl||'';
    var owner  = b.ownerId||b.createdBy||b.userId||'';
    var isOwner= !!(authUser() && authUser().uid && owner && authUser().uid===owner);
    state.currentBizId = b.id;
    state.currentBizOwner = owner;

    var statusBadge='';
    if(b.status==='suspended') statusBadge='<span class="gh-biz-status-badge suspended"><i class="fas fa-ban"></i> Suspended</span>';
    else if(b.status==='under_review') statusBadge='<span class="gh-biz-status-badge under-review"><i class="fas fa-clock"></i> Under Review</span>';

    var coverHtml = cover ? '<img src="'+esc(cover)+'" alt="'+esc(title)+'" loading="lazy" onerror="this.remove()">' : '';
    var logoHtml  = logo  ? '<img src="'+esc(logo)+'"  alt="'+esc(title)+'" loading="lazy" onerror="this.remove()">' : esc(initials(title));

    var verifiedBadge = b.verified ? '<span class="gh-biz-verified"><i class="fas fa-circle-check"></i> Verified</span>' : '';
    var shortDesc = b.description ? '<p class="gh-biz-short-desc">'+esc(b.description)+'</p>' : '';

    var ratingAvg = b.ratingCount > 0
      ? (b.ratingTotal/b.ratingCount).toFixed(1)
      : (b.ratingAverage > 0 ? Number(b.ratingAverage).toFixed(1) : null);
    var ratingDisplay = ratingAvg ? ratingAvg+' ★' : '—';

    var tabs=[{id:'overview',l:'Overview'},{id:'posts',l:'Posts'},{id:'services',l:'Services'},{id:'photos',l:'Photos'},{id:'reviews',l:'Reviews'},{id:'about',l:'About'}];
    if(isOwner) tabs.push({id:'manage',l:'Dashboard'});
    var tabsHtml=tabs.map(function(t){
      return '<button class="gh-biz-tab'+(t.id==='overview'?' active':'')+'" data-biz-tab="'+t.id+'">'+t.l+'</button>';
    }).join('');

    $('#ghBusinessDetail').innerHTML=
      '<div class="gh-biz-page">'+
        '<div class="gh-biz-cover">'+coverHtml+statusBadge+'</div>'+
        '<div class="gh-biz-header">'+
          '<div class="gh-biz-logo">'+logoHtml+'</div>'+
          '<div class="gh-biz-header-inner">'+
            '<div class="gh-biz-name-area">'+
              '<div class="gh-biz-title-row"><h1>'+esc(title)+'</h1>'+verifiedBadge+'</div>'+
              '<div class="gh-biz-chips">'+
                (b.category?'<span class="gh-chip">'+esc(b.category)+'</span>':'')+
                (isOnlineBusiness(b)?'<span class="gh-chip"><i class="fas fa-globe"></i> '+esc(businessAreaLabel(b))+'</span>':'<span class="gh-chip"><i class="fas fa-location-dot"></i> '+esc(businessAreaLabel(b))+'</span>')+
                (b.plan&&b.plan!=='free'?'<span class="gh-chip" style="background:rgba(250,204,21,.12);color:#facc15;border-color:rgba(250,204,21,.25)"><i class="fas fa-crown"></i> Pro</span>':'')+
              '</div>'+
              shortDesc+
            '</div>'+
            '<div class="gh-biz-actions">'+
              '<button class="gh-btn gh-follow-business-btn" data-follow-business="'+esc(b.id)+'"><i class="fas fa-plus"></i> Follow</button>'+
              '<button class="gh-btn ghost" data-message-business="'+esc(owner)+'"><i class="fas fa-comment"></i> Message</button>'+
              (isOwner?'<button class="gh-btn ghost" data-edit-business><i class="fas fa-gear"></i> Edit</button>':'')+
              '<button class="gh-btn ghost" aria-label="Save business" data-save-item data-type="business" data-id="'+esc(b.id)+'"><i class="fas fa-bookmark"></i></button>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div class="gh-biz-stats-bar">'+
          '<div class="gh-biz-stat"><strong>'+Number(b.followerCount||0)+'</strong><span>Followers</span></div>'+
          '<div class="gh-biz-stat"><strong>'+ratingDisplay+'</strong><span>Rating</span></div>'+
          '<div class="gh-biz-stat"><strong>'+Number(b.reviewCount||0)+'</strong><span>Reviews</span></div>'+
          '<div class="gh-biz-stat"><strong>'+Number(b.postCount||0)+'</strong><span>Posts</span></div>'+
        '</div>'+
        '<div class="gh-biz-tabs" id="ghBizTabs">'+tabsHtml+'</div>'+
      '</div>'+
      '<div id="ghBusinessTabContent"></div>';

    state.currentBusinessTab='overview';

    $('#ghBusinessDetail').onclick=function(e){
      var tab=e.target.closest('[data-biz-tab]');
      if(tab){ state.currentBusinessTab=tab.dataset.bizTab; $all('[data-biz-tab]').forEach(function(x){x.classList.toggle('active',x===tab);}); renderBusinessTab(b); return; }
      var fl=e.target.closest('[data-follow-business]'); if(fl){ followBusiness(b.id); return; }
      var sv=e.target.closest('[data-save-item]'); if(sv){ if(!requireLogin())return; GS().toggleSaveItem(sv.dataset.type,sv.dataset.id); return; }
      var msg=e.target.closest('[data-message-business]'); if(msg){ var oid=msg.dataset.messageBusiness; if(!oid) return toast('Business owner not available','error'); if(!requireLogin()) return; GS().startConversation(oid,function(){ location.href='messages.html?with='+encodeURIComponent(oid); }); return; }
      var edit=e.target.closest('[data-edit-business]'); if(edit) location.href='add-business.html?edit='+encodeURIComponent(b.id);
      var cta=e.target.closest('[data-track-cta]'); if(cta&&state.currentBizId) bizTrack(state.currentBizId,cta.dataset.trackCta);
    };

    updateBusinessFollowButton(b.id);
    renderBusinessTab(b);
    trackBizView(b.id, owner);
  }


  function renderBusinessManageTab(b){
    var box=$('#ghBusinessTabContent'); if(!box) return;
    // Hard ownership guard — re-validated in JS before any UI renders
    var u=authUser();
    if(!u||!u.uid||(b.ownerId!==u.uid&&b.createdBy!==u.uid&&b.userId!==u.uid)){
      box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-lock"></i><h3>Access Denied</h3><p>You do not have permission to manage this business.</p></div>';
      return;
    }
    if(!state.bizDashSection) state.bizDashSection='overview';
    var sections=[
      {id:'overview', icon:'fa-chart-line',  l:'Overview'},
      {id:'settings', icon:'fa-gear',        l:'Settings'},
      {id:'posts',    icon:'fa-newspaper',   l:'Posts'},
      {id:'services', icon:'fa-briefcase',   l:'Services'},
      {id:'gallery',  icon:'fa-images',      l:'Gallery'},
      {id:'reviews',  icon:'fa-star',        l:'Reviews'},
      {id:'employees',icon:'fa-user-group',  l:'Employees'},
      {id:'analytics',icon:'fa-chart-bar',   l:'Analytics'},
      {id:'qr',       icon:'fa-qrcode',      l:'QR Check-in'},
    ];
    var sideNav='<nav class="gh-dash-sidebar-nav">'+
      sections.map(function(s){ return '<button class="gh-dash-nav-item'+(state.bizDashSection===s.id?' active':'')+'" data-dash-section="'+s.id+'"><i class="fas '+s.icon+'"></i><span>'+s.l+'</span></button>'; }).join('')+
      '<hr class="gh-dash-divider">'+
      '<button class="gh-dash-nav-item" data-edit-business-direct><i class="fas fa-pen"></i><span>Edit Page</span></button>'+
    '</nav>';
    box.innerHTML=
      '<div class="gh-dash-wrap">'+
        '<div class="gh-dash-sidebar">'+
          '<div class="gh-dash-sidebar-header">'+
            '<div class="gh-dash-biz-logo">'+(b.logoUrl?'<img src="'+esc(b.logoUrl)+'" alt="" loading="lazy" decoding="async" onerror="this.remove()">':esc(initials(b.title||b.name||'B')))+'</div>'+
            '<div>'+
              '<div class="gh-dash-biz-name">'+esc(b.title||b.name||'Business')+'</div>'+
              '<div class="gh-dash-biz-status gh-dash-status-'+esc((b.status||'active').replace(/[^a-z_]/g,''))+'">'+esc(b.status||'active')+'</div>'+
            '</div>'+
          '</div>'+
          sideNav+
        '</div>'+
        '<div class="gh-dash-content" id="ghDashContent"></div>'+
      '</div>';
    box.onclick=function(e){
      var nav=e.target.closest('[data-dash-section]');
      if(nav){ state.bizDashSection=nav.dataset.dashSection; $all('[data-dash-section]').forEach(function(x){x.classList.toggle('active',x.dataset.dashSection===state.bizDashSection);}); renderBizDashSection(b); return; }
      if(e.target.closest('[data-edit-business-direct]')){ location.href='add-business.html?edit='+encodeURIComponent(b.id); }
    };
    renderBizDashSection(b);
  }

  function renderBizDashSection(b){
    var s=state.bizDashSection||'overview';
    if(s==='overview')  return renderBizDashOverview(b);
    if(s==='settings')  return renderBizDashSettings(b);
    if(s==='posts')     return renderBizDashPosts(b);
    if(s==='services')  return renderBizDashServices(b);
    if(s==='gallery')   return renderBizDashGallery(b);
    if(s==='reviews')   return renderBizDashReviews(b);
    if(s==='employees') return renderBizDashEmployees(b);
    if(s==='analytics') return renderBizDashAnalytics(b);
    if(s==='qr')        return renderBizDashQr(b);
  }

  function renderBizDashOverview(b){
    var cont=$('#ghDashContent'); if(!cont) return;
    var ratingAvg=b.ratingCount>0?(b.ratingTotal/b.ratingCount).toFixed(1):(b.ratingAverage>0?Number(b.ratingAverage).toFixed(1):null);
    var statusColor=b.status==='active'?'#10b981':b.status==='suspended'?'#ef4444':'#f59e0b';
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<h2 class="gh-dash-section-title">Overview</h2>'+
        '<div class="gh-dash-stats-grid">'+
          '<div class="gh-dash-stat-card"><i class="fas fa-users"></i><strong>'+Number(b.followerCount||0)+'</strong><span>Followers</span></div>'+
          '<div class="gh-dash-stat-card"><i class="fas fa-newspaper"></i><strong>'+Number(b.postCount||0)+'</strong><span>Posts</span></div>'+
          '<div class="gh-dash-stat-card"><i class="fas fa-star" style="color:#facc15"></i><strong>'+(ratingAvg||'—')+'</strong><span>Rating</span></div>'+
          '<div class="gh-dash-stat-card"><i class="fas fa-comments"></i><strong>'+Number(b.reviewCount||0)+'</strong><span>Reviews</span></div>'+
        '</div>'+
        '<div class="gh-dash-info-grid">'+
          '<div class="gh-card" style="margin-bottom:0">'+
            '<div class="gh-biz-sec-head"><h3>Business Info</h3><button class="gh-btn sm ghost" data-dash-section="settings"><i class="fas fa-pencil"></i> Edit</button></div>'+
            '<div class="gh-about-list">'+
              aboutRow('fa-store',b.title||b.name||'Untitled')+
              aboutRow('fa-tag',b.category||'No category')+
              '<div class="gh-about-row"><i class="fas fa-circle-dot" style="color:'+statusColor+'"></i><span style="color:'+statusColor+';font-weight:700;text-transform:capitalize">'+esc(b.status||'active')+'</span></div>'+
              (b.plan&&b.plan!=='free'?aboutRow('fa-crown','Pro plan'):aboutRow('fa-circle-check','Free listing'))+
            '</div>'+
          '</div>'+
          '<div class="gh-card" style="margin-bottom:0">'+
            '<div class="gh-biz-sec-head"><h3>Quick Actions</h3></div>'+
            '<div style="display:flex;flex-direction:column;gap:8px">'+
              '<button class="gh-btn full ghost" data-ov-post-as-biz><i class="fas fa-bullhorn"></i> Post an update</button>'+
              '<button class="gh-btn full ghost" data-dash-section="services"><i class="fas fa-briefcase"></i> Manage services</button>'+
              '<button class="gh-btn full ghost" data-dash-section="gallery"><i class="fas fa-images"></i> Upload to gallery</button>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    cont.onclick=function(e){
      var nav=e.target.closest('[data-dash-section]');
      if(nav){ state.bizDashSection=nav.dataset.dashSection; $all('[data-dash-section]').forEach(function(x){x.classList.toggle('active',x.dataset.dashSection===state.bizDashSection);}); renderBizDashSection(b); return; }
      if(e.target.closest('[data-ov-post-as-biz]')){ var bTitle=b.title||b.name||'Business'; openPostModal({targetType:'business',targetId:b.id,authorType:'business',businessId:b.id,authorId:b.id,authorName:bTitle,authorAvatar:b.logoUrl||b.coverUrl||'',createdByUserId:authUser()&&authUser().uid}); }
    };
  }

  function renderBizDashSettings(b){
    var cont=$('#ghDashContent'); if(!cont) return;
    var sLinks=b.socialLinks||{};
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<h2 class="gh-dash-section-title">Settings</h2>'+
        '<div class="gh-card">'+
          '<div class="gh-biz-sec-head"><h3>Basic Info</h3></div>'+
          '<div class="gh-form-rows">'+
            '<label class="gh-form-label" for="dsTitle">Business Name<input class="gh-input" id="dsTitle" value="'+esc(b.title||b.name||'')+'"></label>'+
            '<label class="gh-form-label" for="dsDesc">Description<textarea class="gh-textarea" id="dsDesc" rows="3">'+esc(b.description||'')+'</textarea></label>'+
            '<label class="gh-form-label" for="dsCat">Category<input class="gh-input" id="dsCat" value="'+esc(b.category||'')+'" placeholder="e.g. Restaurant, Salon, Tech"></label>'+
          '</div>'+
        '</div>'+
        '<div class="gh-card">'+
          '<div class="gh-biz-sec-head"><h3>Contact & Links</h3></div>'+
          '<div class="gh-form-rows">'+
            '<div class="gh-form-grid">'+
              '<label class="gh-form-label" for="dsPhone">Phone<input class="gh-input" id="dsPhone" value="'+esc(b.phone||'')+'" placeholder="+995 5XX XXX XXX"></label>'+
              '<label class="gh-form-label" for="dsEmail">Email<input class="gh-input" id="dsEmail" value="'+esc(b.email||'')+'" placeholder="contact@yourbusiness.com"></label>'+
            '</div>'+
            '<label class="gh-form-label" for="dsWebsite">Website<input class="gh-input" id="dsWebsite" value="'+esc(b.website||'')+'" placeholder="https://yourbusiness.com"></label>'+
            '<label class="gh-form-label" for="dsBooking">Booking / Appointment URL<input class="gh-input" id="dsBooking" value="'+esc(b.bookingUrl||'')+'" placeholder="https://..."></label>'+
            '<div class="gh-form-grid">'+
              '<label class="gh-form-label" for="dsIg"><i class="fab fa-instagram"></i> Instagram<input class="gh-input" id="dsIg" value="'+esc(sLinks.instagram||'')+'" placeholder="@handle"></label>'+
              '<label class="gh-form-label" for="dsFb"><i class="fab fa-facebook"></i> Facebook<input class="gh-input" id="dsFb" value="'+esc(sLinks.facebook||'')+'" placeholder="page name or URL"></label>'+
            '</div>'+
            '<div class="gh-form-grid">'+
              '<label class="gh-form-label" for="dsWa"><i class="fab fa-whatsapp"></i> WhatsApp<input class="gh-input" id="dsWa" value="'+esc(sLinks.whatsapp||'')+'" placeholder="+995 5XX XXX XXX"></label>'+
              '<label class="gh-form-label" for="dsTk"><i class="fab fa-tiktok"></i> TikTok<input class="gh-input" id="dsTk" value="'+esc(sLinks.tiktok||'')+'" placeholder="@handle"></label>'+
            '</div>'+
            '<label class="gh-form-label" for="dsLi"><i class="fab fa-linkedin"></i> LinkedIn<input class="gh-input" id="dsLi" value="'+esc(sLinks.linkedin||'')+'" placeholder="https://linkedin.com/company/..."></label>'+
          '</div>'+
        '</div>'+
        '<div class="gh-card">'+
          '<div class="gh-biz-sec-head"><h3>Working Hours</h3><span class="gh-form-hint">Customers see when you\'re open</span></div>'+
          workingHoursEditorHtml(b.workingHours)+
        '</div>'+
        (!isOnlineBusiness(b)?
        '<div class="gh-card">'+
          '<div class="gh-biz-sec-head"><h3>Location Coordinates</h3><span class="gh-form-hint">Required for GPS check-in verification</span></div>'+
          '<div class="gh-form-rows">'+
            (!getPlaceCoords(b)?'<div style="padding:6px 0 10px;color:#f59e0b;font-size:.82rem"><i class="fas fa-triangle-exclamation"></i> No coordinates saved — customers cannot GPS-verify check-ins at this place.</div>':'')+
            '<div class="gh-form-grid">'+
              '<label class="gh-form-label" for="dsLat">Latitude<input class="gh-input" id="dsLat" type="number" step="any" min="-90" max="90" value="'+(getPlaceCoords(b)?getPlaceCoords(b).lat:esc(b.lat||b.latitude||''))+'" placeholder="e.g. 41.6938"></label>'+
              '<label class="gh-form-label" for="dsLng">Longitude<input class="gh-input" id="dsLng" type="number" step="any" min="-180" max="180" value="'+(getPlaceCoords(b)?getPlaceCoords(b).lng:esc(b.lng||b.longitude||''))+'" placeholder="e.g. 44.8015"></label>'+
            '</div>'+
            '<button type="button" class="gh-btn sm ghost" id="dsGetLocBtn" style="margin-top:4px"><i class="fas fa-location-crosshairs"></i> Use My Current Location</button>'+
          '</div>'+
        '</div>':'')+
        '<div class="gh-card">'+
          '<div class="gh-biz-sec-head"><h3>Branding</h3></div>'+
          '<div class="gh-form-rows">'+
            '<label class="gh-form-label" for="dsCover">Cover Image URL<input class="gh-input" id="dsCover" value="'+esc(b.coverUrl||'')+'" placeholder="https://..."></label>'+
            '<label class="gh-form-label" for="dsLogo">Logo URL<input class="gh-input" id="dsLogo" value="'+esc(b.logoUrl||'')+'" placeholder="https://..."></label>'+
          '</div>'+
        '</div>'+
        '<div class="gh-dash-actions"><button class="gh-btn" id="dsSaveBtn"><i class="fas fa-check"></i> Save changes</button></div>'+
      '</div>';
    $('#dsSaveBtn').onclick=function(){ saveBizSettings(b); };
    var dsLocBtn=$('#dsGetLocBtn');
    if(dsLocBtn) dsLocBtn.onclick=function(){
      if(!navigator.geolocation){ toast('GPS not available on this device','error'); return; }
      dsLocBtn.disabled=true; dsLocBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Getting location…';
      navigator.geolocation.getCurrentPosition(function(pos){
        var lat=pos.coords.latitude.toFixed(6);
        var lng=pos.coords.longitude.toFixed(6);
        var latEl=$('#dsLat'); var lngEl=$('#dsLng');
        if(latEl) latEl.value=lat;
        if(lngEl) lngEl.value=lng;
        dsLocBtn.disabled=false; dsLocBtn.innerHTML='<i class="fas fa-location-crosshairs"></i> Use My Current Location';
        toast('Location filled: '+lat+', '+lng);
      },function(err){
        dsLocBtn.disabled=false; dsLocBtn.innerHTML='<i class="fas fa-location-crosshairs"></i> Use My Current Location';
        var msgs={1:'Location permission denied.',2:'Signal unavailable.',3:'Request timed out.'};
        toast(msgs[err.code]||'GPS error','error');
      },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
    };
    // Wire closed-toggle visibility for time inputs
    var editor=$('#ghHoursEditor');
    if(editor) editor.addEventListener('change',function(e){
      var cb=e.target;
      if(!cb||cb.dataset.type!=='closed') return;
      var timesEl=$('#hDay_'+cb.dataset.day+'_times');
      if(timesEl) timesEl.classList.toggle('gh-hours-times-hidden',cb.checked);
    });
  }

  function saveBizSettings(b){
    var u=authUser();
    if(!u||!u.uid) return toast('Not logged in','error');
    if(b.ownerId!==u.uid&&b.createdBy!==u.uid&&b.userId!==u.uid) return toast('Access denied','error');
    if(!fs()||!db()) return toast('Database unavailable','error');
    var title=($('#dsTitle').value||'').trim();
    if(!title) return toast('Business name required','error');
    // Soft validation — warn but don't hard-block
    var website=($('#dsWebsite').value||'').trim();
    var booking=($('#dsBooking').value||'').trim();
    var email=($('#dsEmail').value||'').trim();
    var li=($('#dsLi').value||'').trim();
    if(website&&!isValidUrl(website)) return toast('Website should start with https://','error');
    if(booking&&!isValidUrl(booking)) return toast('Booking URL should start with https://','error');
    if(li&&!isValidUrl(li)) return toast('LinkedIn URL should start with https://','error');
    if(email&&!isValidEmail(email)) return toast('Email address looks invalid','error');
    var wh=readWorkingHoursFromForm();
    var latRaw=($('#dsLat')?$('#dsLat').value||'':'').trim();
    var lngRaw=($('#dsLng')?$('#dsLng').value||'':'').trim();
    var lat=latRaw?parseFloat(latRaw):null;
    var lng=lngRaw?parseFloat(lngRaw):null;
    if((latRaw||lngRaw)&&(isNaN(lat)||isNaN(lng))) return toast('Coordinates must be valid numbers','error');
    if(lat!=null&&(lat<-90||lat>90)) return toast('Latitude must be between -90 and 90','error');
    if(lng!=null&&(lng<-180||lng>180)) return toast('Longitude must be between -180 and 180','error');
    if((latRaw&&!lngRaw)||(lngRaw&&!latRaw)) return toast('Both latitude and longitude are required','error');
    var fields={
      title:      title,
      description:($('#dsDesc').value||'').trim(),
      category:   ($('#dsCat').value||'').trim(),
      phone:      ($('#dsPhone').value||'').trim(),
      email:      email,
      website:    website,
      bookingUrl: booking,
      socialLinks:{
        instagram:($('#dsIg').value||'').trim(),
        facebook: ($('#dsFb').value||'').trim(),
        whatsapp: ($('#dsWa').value||'').trim(),
        tiktok:   ($('#dsTk').value||'').trim(),
        linkedin: li,
      },
      coverUrl:   ($('#dsCover').value||'').trim(),
      logoUrl:    ($('#dsLogo').value||'').trim(),
      updatedAt:  fs().serverTimestamp(),
    };
    if(lat!=null&&lng!=null){ fields.lat=lat; fields.lng=lng; }
    if(wh) fields.workingHours=wh;
    var btn=$('#dsSaveBtn');
    if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Saving…';}
    fs().updateDoc(fs().doc(db(),'businesses',b.id),fields).then(function(){
      toast('Settings saved');
      if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-check"></i> Save changes';}
    }).catch(function(err){
      toast('Save failed: '+(err.message||err),'error');
      if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-check"></i> Save changes';}
    });
  }

  function renderBizDashPosts(b){
    var cont=$('#ghDashContent'); if(!cont) return;
    var bTitle=b.title||b.name||'Business';
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<div class="gh-biz-sec-head"><h2 class="gh-dash-section-title">Posts</h2>'+
          '<button class="gh-btn" data-dp-post-as-biz><i class="fas fa-bullhorn"></i> Post update</button>'+
        '</div>'+
        '<div id="ghDashPostsList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+
      '</div>';
    cont.onclick=function(e){ if(e.target.closest('[data-dp-post-as-biz]')){ openPostModal({targetType:'business',targetId:b.id,authorType:'business',businessId:b.id,authorId:b.id,authorName:bTitle,authorAvatar:b.logoUrl||b.coverUrl||'',createdByUserId:authUser()&&authUser().uid}); } };
    listenTargetPosts('business',b.id,function(posts){
      var el=$('#ghDashPostsList'); if(!el) return;
      posts=posts.filter(canSeePost);
      if(!posts.length){el.innerHTML='<div class="gh-empty"><i class="fas fa-newspaper"></i><h3>No posts yet</h3><p>Post updates to engage with your followers.</p></div>'; return;}
      el.innerHTML=posts.map(postCard).join('');
      bindPostInteractions(el);
      posts.forEach(function(p){hydrateReactionState(p.id);});
      hydrateSharedPreviews(el);
    });
  }

  /* ── QR Check-in dashboard section ────────────────────────────────
     Loads qrcode.js lazily, generates/reads the qrCode field, renders
     the QR image plus copy/download actions and scan stats.
  ─────────────────────────────────────────────────────────────────── */
  function renderBizDashQr(b){
    var cont=$('#ghDashContent'); if(!cont) return;
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<h2 class="gh-dash-section-title">QR Check-in</h2>'+
        '<div id="ghQrBody"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><p>Loading QR code…</p></div></div>'+
      '</div>';

    var GQ=window.GeoQr;
    if(!GQ){
      var el2=$('#ghQrBody'); if(el2) el2.innerHTML='<div class="gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>QR engine not loaded</h3><p>Please reload the page.</p></div>';
      return;
    }

    GQ.ensureBusinessQr(b.id, function(res){
      var el=$('#ghQrBody'); if(!el) return;
      if(!res){
        el.innerHTML='<div class="gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Could not generate QR</h3><p>Make sure you own this business and try again.</p></div>';
        return;
      }
      var scanUrl=location.origin+'/scan.html?code='+encodeURIComponent(res.qrCode);
      el.innerHTML=
        '<div class="gh-card" style="text-align:center">'+
          '<div class="gh-biz-sec-head" style="justify-content:center"><h3>Your Business QR Code</h3></div>'+
          '<p style="font-size:0.82rem;color:var(--gh-muted,#64748b);margin:0 0 16px">Customers scan this code to check in instantly and earn 60 XP.</p>'+
          '<div id="ghQrCanvas" style="display:inline-block;background:#fff;padding:16px;border-radius:16px;margin-bottom:16px"></div>'+
          '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:20px">'+
            '<button class="gh-btn ghost sm" id="ghQrCopy"><i class="fas fa-copy"></i> Copy Code</button>'+
            '<button class="gh-btn sm" id="ghQrDownload"><i class="fas fa-download"></i> Download PNG</button>'+
          '</div>'+
          '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;font-size:0.8rem;margin-bottom:16px">'+
            '<i class="fas fa-qrcode" style="color:#10b981;flex-shrink:0"></i>'+
            '<code style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;color:#94a3b8" title="'+esc(res.qrCode)+'">'+esc(res.qrCode)+'</code>'+
          '</div>'+
          '<div style="font-size:0.78rem;color:var(--gh-muted,#64748b)">QR check-ins: <strong id="ghQrScanCount">…</strong></div>'+
        '</div>'+
        '<div class="gh-card" style="background:rgba(99,102,241,0.05);border-color:rgba(99,102,241,0.15)">'+
          '<div class="gh-biz-sec-head"><h3>How to use</h3></div>'+
          '<ol style="padding-left:18px;font-size:0.85rem;line-height:2;color:var(--gh-muted,#64748b)">'+
            '<li>Download and print the QR code, or display it on a screen.</li>'+
            '<li>Place it at your entrance, counter, or table.</li>'+
            '<li>Customers open GeoHub, tap <strong>Scan QR</strong>, and scan the code.</li>'+
            '<li>They earn <strong>60 XP</strong> instantly — verified by QR.</li>'+
          '</ol>'+
        '</div>';

      // Load qrcode.js lazily then render
      loadQrCodeLib(function(){
        var canvas=$('#ghQrCanvas'); if(!canvas) return;
        try {
          // eslint-disable-next-line no-new
          new QRCode(canvas, {
            text:          scanUrl,
            width:         200,
            height:        200,
            colorDark:     '#000000',
            colorLight:    '#ffffff',
            correctLevel:  QRCode.CorrectLevel.M
          });
        } catch(e){ canvas.innerHTML='<p style="color:#ef4444;font-size:0.8rem">QR generation failed.</p>'; }
      });

      // Copy button
      $('#ghQrCopy')&&($('#ghQrCopy').onclick=function(){
        try{ navigator.clipboard.writeText(res.qrCode).then(function(){ toast('QR code ID copied!'); }).catch(function(){ toast(res.qrCode,'info'); }); }
        catch(e){ toast(res.qrCode,'info'); }
      });

      // Download PNG button
      $('#ghQrDownload')&&($('#ghQrDownload').onclick=function(){
        var img=$('#ghQrCanvas img');
        var cvs=$('#ghQrCanvas canvas');
        if(img&&img.src){
          var a=document.createElement('a'); a.href=img.src; a.download='geohub-qr-'+b.id.slice(0,8)+'.png'; a.click();
        } else if(cvs){
          var a2=document.createElement('a'); a2.href=cvs.toDataURL('image/png'); a2.download='geohub-qr-'+b.id.slice(0,8)+'.png'; a2.click();
        } else { toast('QR image not ready yet. Try again.','warn'); }
      });

      // Load scan count
      GQ.getQrScanCount(b.id, function(count){
        var el2=$('#ghQrScanCount'); if(el2) el2.textContent=count;
      });
    });
  }

  function loadQrCodeLib(cb){
    if(window.QRCode){ cb(); return; }
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
    s.onload=cb;
    s.onerror=function(){
      var el=$('#ghQrCanvas');
      if(el) el.innerHTML='<p style="color:#ef4444;font-size:0.8rem;padding:10px">QR library failed to load. Check internet connection.</p>';
    };
    document.head.appendChild(s);
  }

  function renderBizDashServices(b){
    var cont=$('#ghDashContent'); if(!cont) return;
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<div class="gh-biz-sec-head"><h2 class="gh-dash-section-title">Services</h2>'+
          '<button class="gh-btn" data-ds-add-svc><i class="fas fa-plus"></i> Add service</button>'+
        '</div>'+
        '<div id="ghDashSvcList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+
      '</div>';
    cont.onclick=function(e){
      if(e.target.closest('[data-ds-add-svc]')) openServiceModal(b,null,function(){loadDashServices(b);});
      var edit=e.target.closest('[data-edit-service]'); if(edit){ loadServiceForEdit(b,edit.dataset.editService,function(svc){if(svc) openServiceModal(b,svc,function(){loadDashServices(b);});}); }
      var del=e.target.closest('[data-delete-service]'); if(del) deleteService(b,del.dataset.deleteService);
      var tog=e.target.closest('[data-toggle-svc-active]'); if(tog) toggleServiceActive(b,tog.dataset.toggleSvcActive,tog.dataset.isSvcActive!=='true');
      var feat=e.target.closest('[data-toggle-svc-feat]'); if(feat) toggleServiceFeatured(b,feat.dataset.toggleSvcFeat,feat.dataset.isSvcFeat!=='true');
    };
    loadDashServices(b);
  }

  function loadDashServices(b){
    var el=$('#ghDashSvcList'); if(!el) return;
    el.innerHTML='<div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div>';
    loadServices(b.id,function(items){
      var el2=$('#ghDashSvcList'); if(!el2) return;
      if(!items.length){ el2.innerHTML='<div class="gh-empty"><i class="fas fa-briefcase"></i><h3>No services yet</h3><p>Add your first service to show clients what you offer.</p><button class="gh-btn" data-ds-add-svc>Add service</button></div>'; return; }
      el2.innerHTML='<div class="gh-svc-dash-list">'+items.map(function(s){
        return '<div class="gh-svc-dash-item'+(s.active?'':' gh-svc-inactive')+'">'+
          (s.imageUrl?'<img class="gh-svc-dash-thumb" src="'+esc(s.imageUrl)+'" alt="'+esc(s.title)+'" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">':'')+
          '<div class="gh-svc-dash-info">'+
            '<div class="gh-svc-dash-badges">'+
              (s.featured?'<span class="gh-svc-badge featured"><i class="fas fa-star"></i></span>':'')+
              '<span class="gh-svc-badge type">'+esc(s.type||'service')+'</span>'+
              (!s.active?'<span class="gh-svc-badge inactive">Inactive</span>':'')+
            '</div>'+
            '<strong>'+esc(s.title)+'</strong>'+(s.price?'<span class="gh-svc-dash-price">'+esc(s.price)+' '+esc(s.currency||'GEL')+'</span>':'')+
            (s.description?'<p>'+esc(s.description.slice(0,80))+(s.description.length>80?'…':'')+'</p>':'')+
          '</div>'+
          '<div class="gh-svc-mgmt-row">'+
            '<button class="gh-gallery-feat-btn" data-toggle-svc-feat="'+esc(s.id)+'" data-is-svc-feat="'+!!s.featured+'" title="'+(s.featured?'Unmark featured':'Mark featured')+'">'+(s.featured?'<i class="fas fa-star" style="color:#facc15"></i>':'<i class="far fa-star"></i>')+'</button>'+
            '<button class="gh-btn sm ghost" data-toggle-svc-active="'+esc(s.id)+'" data-is-svc-active="'+!!s.active+'" title="'+(s.active?'Deactivate':'Activate')+'">'+(s.active?'<i class="fas fa-eye"></i>':'<i class="fas fa-eye-slash"></i>')+'</button>'+
            '<button class="gh-btn sm ghost" data-edit-service="'+esc(s.id)+'"><i class="fas fa-pencil"></i></button>'+
            '<button class="gh-btn sm ghost" data-delete-service="'+esc(s.id)+'"><i class="fas fa-trash"></i></button>'+
          '</div>'+
        '</div>';
      }).join('')+'</div>';
    },true);
  }

  function deleteService(b, serviceId){
    if(!serviceId||!fs()||!db()) return;
    if(!confirm('Delete this service?')) return;
    fs().deleteDoc(fs().doc(db(),'businesses',b.id,'services',serviceId)).then(function(){
      toast('Service deleted'); loadDashServices(b);
    }).catch(function(err){ toast('Failed: '+(err.message||err),'error'); });
  }

  function renderBizDashGallery(b){
    var cont=$('#ghDashContent'); if(!cont) return;
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<div class="gh-biz-sec-head"><h2 class="gh-dash-section-title">Gallery</h2>'+
          '<button class="gh-btn" data-dg-add><i class="fas fa-plus"></i> Add photo</button>'+
        '</div>'+
        '<div id="ghDashGallery"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+
      '</div>';
    cont.onclick=function(e){
      if(e.target.closest('[data-dg-add]')) openAddGalleryPhotoModal(b,function(){loadDashGallery(b);});
      var del=e.target.closest('[data-delete-photo]'); if(del) deleteGalleryPhoto(b,del.dataset.deletePhoto);
      var feat=e.target.closest('[data-toggle-featured]'); if(feat) toggleGalleryFeatured(b,feat.dataset.toggleFeatured,feat.dataset.isFeatured==='true');
    };
    loadDashGallery(b);
  }

  function loadDashGallery(b){
    var el=$('#ghDashGallery'); if(!el) return;
    el.innerHTML='<div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div>';
    loadGalleryPhotos(b.id,function(photos){
      var el2=$('#ghDashGallery'); if(!el2) return;
      if(!photos.length){ el2.innerHTML='<div class="gh-empty"><i class="fas fa-images"></i><h3>No photos yet</h3><p>Upload photos to showcase your business.</p><button class="gh-btn" data-dg-add>Add first photo</button></div>'; return; }
      el2.innerHTML='<div class="gh-gallery-grid">'+photos.map(function(p){
        return '<div class="gh-gallery-item gh-gallery-item-mgmt'+(p.featured?' gh-gallery-item-featured':'')+'" data-ph-id="'+esc(p.id)+'">'+
          '<img src="'+esc(p.url||p.imageUrl||'')+'" alt="'+esc(p.caption||'')+'" loading="lazy" onerror="this.closest(\'.gh-gallery-item\').style.display=\'none\'">'+
          (p.featured?'<span class="gh-gallery-featured-badge"><i class="fas fa-star"></i></span>':'')+
          (p.caption?'<div class="gh-gallery-caption">'+esc(p.caption)+'</div>':'')+
          '<div class="gh-gallery-mgmt-bar">'+
            '<button class="gh-gallery-feat-btn" data-toggle-featured="'+esc(p.id)+'" data-is-featured="'+!!p.featured+'" title="'+(p.featured?'Unmark featured':'Mark as featured')+'">'+(p.featured?'<i class="fas fa-star" style="color:#facc15"></i>':'<i class="far fa-star"></i>')+'</button>'+
            '<button class="gh-gallery-delete-btn" data-delete-photo="'+esc(p.id)+'"><i class="fas fa-trash"></i></button>'+
          '</div>'+
        '</div>';
      }).join('')+'</div>';
    });
  }

  function deleteGalleryPhoto(b, photoId){
    if(!photoId||!fs()||!db()) return;
    if(!confirm('Delete this photo?')) return;
    fs().deleteDoc(fs().doc(db(),'businesses',b.id,'gallery',photoId)).then(function(){
      toast('Photo deleted'); loadDashGallery(b);
    }).catch(function(err){ toast('Failed: '+(err.message||err),'error'); });
  }

  function renderBizDashReviews(b){
    var cont=$('#ghDashContent'); if(!cont) return;
    var ratingAvg=b.ratingCount>0?(b.ratingTotal/b.ratingCount).toFixed(1):(b.ratingAverage>0?Number(b.ratingAverage).toFixed(1):null);
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<h2 class="gh-dash-section-title">Reviews</h2>'+
        (ratingAvg?
          '<div class="gh-card" style="margin-bottom:0">'+
            '<div class="gh-biz-rating-row"><div class="gh-biz-rating-big">'+ratingAvg+'</div>'+
            '<div><span class="gh-biz-rating-stars">'+starsHtml(ratingAvg)+'</span><span class="gh-biz-rating-sub">'+Number(b.ratingCount||b.reviewCount||0)+' reviews</span></div></div>'+
          '</div>' : '')+
        '<div class="gh-card" style="margin-bottom:0"><div id="ghDashRevList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>'+
      '</div>';
    listenBusinessReviews(b.id,function(items){
      var el=$('#ghDashRevList'); if(!el) return;
      if(!items.length){el.innerHTML='<div class="gh-empty"><i class="fas fa-star"></i><h3>No reviews yet</h3><p>Customer reviews will appear here.</p></div>'; return;}
      el.innerHTML='<div class="gh-reviews-wrap">'+items.map(function(r){
        var normR=window.GH&&window.GH.normReview?window.GH.normReview(r,r.id):r;
        var rating=Number(normR.rating||r.rating||0); var name=normR.userName||'User';
        return '<div class="gh-review-card">'+
          '<div class="gh-review-head">'+
            '<div class="gh-avatar">'+esc(initials(name))+'</div>'+
            '<div class="gh-review-user-info"><strong>'+esc(name)+'</strong><span>'+timeAgo(normR.createdAt||r.createdAt)+'</span></div>'+
            '<div class="gh-review-stars-row"><span class="gh-review-stars">'+starsHtml(rating)+'</span><span class="gh-review-rating-num">'+rating.toFixed(1)+'</span></div>'+
          '</div>'+
          '<p class="gh-review-text">'+esc(normR.text||r.text||'')+'</p>'+
          '<div class="gh-review-footer">'+
            '<span class="gh-review-date">'+(normR.createdAt?new Date(ts(normR.createdAt)).toLocaleDateString():'')+'</span>'+
            '<button class="gh-btn sm ghost" disabled title="Reply feature coming in a future update"><i class="fas fa-reply"></i> Reply</button>'+
          '</div>'+
        '</div>';
      }).join('')+'</div>';
    });
  }

  /* ── Employee invite helpers ─────────────────────────────── */
  function empTypeLabel(t){
    var m={full_time:'Full-time',part_time:'Part-time',freelance:'Freelance',temporary:'Temporary',internship:'Internship'};
    return m[t]||t||'';
  }
  function empStatusBadge(s){
    var cls={pending:'pending',accepted:'accepted',declined:'declined',cancelled:'cancelled'};
    return '<span class="gh-emp-badge '+(cls[s]||'')+'">'+esc(s||'')+'</span>';
  }
  function loadBizInvites(bizId, cb){
    if(!fs()||!db()){cb([]);return;}
    fs().getDocs(fs().collection(db(),'businesses',bizId,'invites')).then(function(snap){
      var items=[]; snap.forEach(function(d){items.push(Object.assign({id:d.id},d.data()));});
      items.sort(function(a,b){var o={pending:0,accepted:1,declined:2,cancelled:3};var ao=o[a.status]||4,bo=o[b.status]||4;if(ao!==bo)return ao-bo;return ts(b.invitedAt)-ts(a.invitedAt);});
      cb(items);
    }).catch(function(){cb([]);});
  }
  function loadBizStaff(bizId, cb, publicOnly){
    if(!fs()||!db()){cb([]);return;}
    fs().getDocs(fs().collection(db(),'businesses',bizId,'staff')).then(function(snap){
      var items=[]; snap.forEach(function(d){items.push(Object.assign({id:d.id},d.data()));});
      if(publicOnly) items=items.filter(function(s){return s.visibility==='public';});
      cb(items);
    }).catch(function(){cb([]);});
  }
  function openInviteModal(b){
    if(!requireLogin()) return;
    modal('Invite Employee',
      '<label class="gh-form-label">Email address *</label>'+
      '<input class="gh-input" id="ghInvEmail" type="email" placeholder="employee@example.com">'+
      '<div style="height:10px"></div>'+
      '<label class="gh-form-label">Role / Job title *</label>'+
      '<input class="gh-input" id="ghInvRole" placeholder="e.g. Sales Manager, Developer…" maxlength="60">'+
      '<div style="height:10px"></div>'+
      '<label class="gh-form-label">Employment type</label>'+
      '<select class="gh-select" id="ghInvType">'+
        '<option value="full_time">Full-time</option>'+
        '<option value="part_time">Part-time</option>'+
        '<option value="freelance">Freelance</option>'+
        '<option value="temporary">Temporary</option>'+
        '<option value="internship">Internship</option>'+
      '</select>'+
      '<div style="height:10px"></div>'+
      '<label class="gh-form-label">Personal message (optional)</label>'+
      '<textarea class="gh-textarea" id="ghInvMsg" placeholder="Add a note to your invitation…" rows="3" maxlength="300"></textarea>'+
      '<div id="ghInvError" style="display:none" class="gh-form-hint error"></div>',
      '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSendInvite"><i class="fas fa-paper-plane"></i> Send Invitation</button>',
      'ghInviteModal');
    $('#ghSendInvite').onclick=function(){
      var email=($('#ghInvEmail').value||'').trim().toLowerCase();
      var role=($('#ghInvRole').value||'').trim();
      var type=$('#ghInvType').value||'full_time';
      var msg=($('#ghInvMsg').value||'').trim();
      var errEl=$('#ghInvError');
      if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){errEl.textContent='Valid email required.';errEl.style.display='';return;}
      if(!role){errEl.textContent='Role / job title required.';errEl.style.display='';return;}
      errEl.style.display='none';
      var btn=$('#ghSendInvite');btn.disabled=true;btn.textContent='Sending…';
      sendEmpInvite(b,{email:email,roleTitle:role,employmentType:type,message:msg},function(ok){
        if(ok){closeModal('ghInviteModal');renderBizDashEmployees(b);}
        else{btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i> Send Invitation';errEl.textContent='Failed. Try again.';errEl.style.display='';}
      });
    };
  }
  function sendEmpInvite(b, fields, cb){
    if(!fs()||!db()||!authUser()){cb(false);return;}
    var u=authUser();
    var ga=window.GeoAuth&&window.GeoAuth.getCurrentUser&&window.GeoAuth.getCurrentUser();
    var senderName=(ga&&(ga.fullName||ga.displayName||ga.name))||u.displayName||u.email||'';
    fs().addDoc(fs().collection(db(),'businesses',b.id,'invites'),{
      businessId:b.id,businessTitle:b.title||b.name||'',
      invitedEmail:fields.email,inviteeEmail:fields.email,
      roleTitle:fields.roleTitle||'',employmentType:fields.employmentType||'full_time',
      message:fields.message||'',status:'pending',
      invitedBy:u.uid,invitedByName:senderName,
      invitedAt:fs().serverTimestamp(),respondedAt:null,
    }).then(function(){cb(true);}).catch(function(){cb(false);});
  }
  function cancelEmpInvite(b, inviteId, cb){
    if(!fs()||!db()){if(cb)cb(false);return;}
    fs().updateDoc(fs().doc(db(),'businesses',b.id,'invites',inviteId),{status:'cancelled',respondedAt:fs().serverTimestamp()})
      .then(function(){if(cb)cb(true);}).catch(function(){if(cb)cb(false);});
  }
  function acceptEmpInvite(b, invite){
    if(!requireLogin()) return;
    var u=authUser(); if(!u||!u.uid) return;
    var ga=window.GeoAuth&&window.GeoAuth.getCurrentUser&&window.GeoAuth.getCurrentUser();
    var displayName=(ga&&(ga.fullName||ga.displayName||ga.name))||u.displayName||(u.email||'').split('@')[0]||'';
    var email=(u.email||'').toLowerCase().trim();
    var invEmail=(invite.invitedEmail||invite.inviteeEmail||'').toLowerCase().trim();
    if(email!==invEmail){toast('This invitation is not for your account.','error');return;}
    var invRef=fs().doc(db(),'businesses',b.id,'invites',invite.id);
    var staffRef=fs().doc(db(),'businesses',b.id,'staff',u.uid);
    var now=fs().serverTimestamp();
    Promise.all([
      fs().updateDoc(invRef,{status:'accepted',respondedAt:now}),
      fs().setDoc(staffRef,{
        userId:u.uid,email:email,displayName:displayName,
        roleTitle:invite.roleTitle||'',employmentType:invite.employmentType||'full_time',
        status:'active',visibility:'public',joinedAt:now,invitedBy:invite.invitedBy||'',
      }),
    ]).then(function(){
      fs().setDoc(fs().doc(db(),'users',u.uid,'workHistory',b.id),{
        businessId:b.id,businessTitle:b.title||b.name||'',
        roleTitle:invite.roleTitle||'',employmentType:invite.employmentType||'full_time',
        status:'active',startedAt:now,visibility:'public',
      },{merge:true}).catch(function(){});
      toast('Welcome to the team!');
      renderBusinessTab(b);
    }).catch(function(err){toast('Failed: '+(err.code||err.message),'error');});
  }
  function declineEmpInvite(b, inviteId){
    if(!fs()||!db()) return;
    fs().updateDoc(fs().doc(db(),'businesses',b.id,'invites',inviteId),{status:'declined',respondedAt:fs().serverTimestamp()})
      .then(function(){toast('Invitation declined.');renderBusinessAbout(b);}).catch(function(e){toast('Failed: '+(e.code||e.message),'error');});
  }
  function updateStaffVisibility(b, staffId, visibility){
    if(!fs()||!db()) return;
    fs().updateDoc(fs().doc(db(),'businesses',b.id,'staff',staffId),{visibility:visibility})
      .then(function(){toast('Visibility updated.');}).catch(function(e){toast('Failed: '+(e.code||e.message),'error');});
  }

  function renderBizDashEmployees(b){
    var cont=$('#ghDashContent'); if(!cont) return;
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<div class="gh-emp-header">'+
          '<h2 class="gh-dash-section-title" style="margin:0">Employees</h2>'+
          '<button class="gh-btn sm" id="ghEmpInviteBtn"><i class="fas fa-paper-plane"></i> Invite</button>'+
        '</div>'+
        '<div id="ghEmpBody"><div class="gh-empty" style="padding:24px 0"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+
      '</div>';
    $('#ghEmpInviteBtn').onclick=function(){openInviteModal(b);};
    function paint(){
      var el=$('#ghEmpBody'); if(!el) return;
      loadBizInvites(b.id,function(invites){
        loadBizStaff(b.id,function(staff){
          var pending=invites.filter(function(i){return i.status==='pending';});
          var declined=invites.filter(function(i){return i.status==='declined'||i.status==='cancelled';});
          var html='';
          // Active team members
          html+='<div class="gh-emp-section">'+
            '<div class="gh-emp-sec-title"><i class="fas fa-user-check"></i> Team Members ('+staff.length+')</div>';
          if(!staff.length){html+='<div class="gh-emp-empty">No team members yet. Send your first invitation.</div>';}
          else{html+='<div class="gh-emp-list">'+staff.map(function(s){
            var sid=s.userId||s.id;
            return '<div class="gh-emp-card">'+
              '<div class="gh-avatar" style="flex-shrink:0">'+esc(initials(s.displayName||s.email||'?'))+'</div>'+
              '<div class="gh-emp-info">'+
                '<div class="gh-emp-name">'+esc(s.displayName||s.email||'Employee')+'</div>'+
                '<div class="gh-emp-meta">'+
                  (s.roleTitle?'<span class="gh-emp-role">'+esc(s.roleTitle)+'</span>':'')+
                  (s.employmentType?'<span class="gh-emp-type">'+esc(empTypeLabel(s.employmentType))+'</span>':'')+
                  '<span class="gh-emp-badge accepted">Active</span>'+
                '</div>'+
              '</div>'+
              '<select class="gh-emp-vis-select" data-staff-vis="'+esc(sid)+'" title="Profile visibility">'+
                '<option value="public"'+(s.visibility==='public'?' selected':'')+'>Public</option>'+
                '<option value="companies_only"'+(s.visibility==='companies_only'?' selected':'')+'>Companies only</option>'+
                '<option value="hidden"'+(s.visibility==='hidden'?' selected':'')+'>Hidden</option>'+
              '</select>'+
            '</div>';
          }).join('')+'</div>';}
          html+='</div>';
          // Pending invites
          html+='<div class="gh-emp-section">'+
            '<div class="gh-emp-sec-title"><i class="fas fa-clock"></i> Pending Invites ('+pending.length+')</div>';
          if(!pending.length){html+='<div class="gh-emp-empty">No pending invites.</div>';}
          else{html+='<div class="gh-emp-list">'+pending.map(function(inv){
            return '<div class="gh-emp-card">'+
              '<div class="gh-avatar" style="flex-shrink:0;color:var(--gh-muted);font-size:.85rem"><i class="fas fa-envelope"></i></div>'+
              '<div class="gh-emp-info">'+
                '<div class="gh-emp-name">'+esc(inv.invitedEmail||inv.inviteeEmail||'')+'</div>'+
                '<div class="gh-emp-meta">'+
                  (inv.roleTitle?'<span class="gh-emp-role">'+esc(inv.roleTitle)+'</span>':'')+
                  (inv.employmentType?'<span class="gh-emp-type">'+esc(empTypeLabel(inv.employmentType))+'</span>':'')+
                  '<span class="gh-emp-badge pending">Pending</span>'+
                '</div>'+
                (inv.message?'<div class="gh-emp-msg">"'+esc(inv.message)+'"</div>':'')+
              '</div>'+
              '<button class="gh-btn xs danger" data-cancel-invite="'+esc(inv.id)+'"><i class="fas fa-xmark"></i> Cancel</button>'+
            '</div>';
          }).join('')+'</div>';}
          html+='</div>';
          // Declined/cancelled — collapsible
          if(declined.length){
            html+='<details class="gh-emp-section">'+
              '<summary class="gh-emp-sec-title" style="cursor:pointer;user-select:none"><i class="fas fa-ban"></i> Declined / Cancelled ('+declined.length+')</summary>'+
              '<div class="gh-emp-list" style="margin-top:10px">'+declined.map(function(inv){
                return '<div class="gh-emp-card muted">'+
                  '<div class="gh-emp-info">'+
                    '<div class="gh-emp-name">'+esc(inv.invitedEmail||inv.inviteeEmail||'')+'</div>'+
                    '<div class="gh-emp-meta">'+empStatusBadge(inv.status)+(inv.roleTitle?'<span class="gh-emp-role">'+esc(inv.roleTitle)+'</span>':'')+'</div>'+
                  '</div>'+
                '</div>';
              }).join('')+'</div>'+
            '</details>';
          }
          el.innerHTML=html;
          // Bind cancel buttons
          el.querySelectorAll('[data-cancel-invite]').forEach(function(btn){
            btn.onclick=function(){
              if(!confirm('Cancel this invitation?')) return;
              btn.disabled=true;btn.innerHTML='…';
              cancelEmpInvite(b,btn.dataset.cancelInvite,function(ok){
                if(ok){toast('Invitation cancelled.');paint();}
                else{btn.disabled=false;btn.innerHTML='<i class="fas fa-xmark"></i> Cancel';toast('Failed','error');}
              });
            };
          });
          // Bind visibility selects
          el.querySelectorAll('[data-staff-vis]').forEach(function(sel){
            sel.onchange=function(){updateStaffVisibility(b,sel.dataset.staffVis,sel.value);};
          });
        });
      });
    }
    paint();
  }

  function renderBizDashAnalytics(b){
    var cont=$('#ghDashContent'); if(!cont) return;
    cont.innerHTML='<div class="gh-dash-section"><h2 class="gh-dash-section-title">Analytics</h2><div id="ghDaBody"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>';
    if(!fs()||!db()) return;
    fs().getDocs(fs().query(fs().collection(db(),'businesses',b.id,'analytics'),fs().orderBy('date','desc'),fs().limit(30))).then(function(snap){
      var days=[]; snap.forEach(function(d){days.push(Object.assign({id:d.id},d.data()));});
      var el=$('#ghDaBody'); if(!el) return;
      var today=todayDateKey();
      var todayData=days.find(function(d){return d.date===today;})||{};
      var sum7={views:0,phones:0,wa:0,email:0,booking:0,website:0,directions:0,service:0,follows:0};
      var sum30={views:0,phones:0,wa:0,email:0,booking:0,website:0,directions:0,service:0,follows:0,unfollows:0};
      days.forEach(function(d,i){
        var ph=Number(d.phoneClicks)||0,wa=Number(d.whatsappClicks)||0,em=Number(d.emailClicks)||0;
        var bk=Number(d.bookingClicks)||0,ws=Number(d.websiteClicks)||0,dr=Number(d.directionsClicks)||0;
        var sv=Number(d.serviceClicks)||0,fl=Number(d.follows)||0,ufl=Number(d.unfollows)||0,vi=Number(d.views)||0;
        sum30.views+=vi;sum30.phones+=ph;sum30.wa+=wa;sum30.email+=em;sum30.booking+=bk;
        sum30.website+=ws;sum30.directions+=dr;sum30.service+=sv;sum30.follows+=fl;sum30.unfollows+=ufl;
        if(i<7){sum7.views+=vi;sum7.phones+=ph;sum7.wa+=wa;sum7.email+=em;sum7.booking+=bk;sum7.website+=ws;sum7.directions+=dr;sum7.service+=sv;sum7.follows+=fl;}
      });
      var viewsToday=Number(todayData.views)||0;
      var interactions=[
        {icon:'fa-phone',label:'Calls',val:sum30.phones},
        {icon:'fa-brands fa-whatsapp',label:'WhatsApp',val:sum30.wa},
        {icon:'fa-envelope',label:'Emails',val:sum30.email},
        {icon:'fa-calendar-check',label:'Bookings',val:sum30.booking},
        {icon:'fa-globe',label:'Website',val:sum30.website},
        {icon:'fa-map-location-dot',label:'Directions',val:sum30.directions},
        {icon:'fa-briefcase',label:'Services',val:sum30.service},
      ];
      var maxIA=Math.max.apply(null,interactions.map(function(x){return x.val;}))||1;
      var hasData=days.length>0&&(sum30.views>0||interactions.some(function(x){return x.val>0;}));
      if(!hasData){
        el.innerHTML='<div class="gh-card"><div class="gh-empty"><i class="fas fa-chart-bar"></i><h3>No analytics data yet</h3><p>Activity will appear after people visit or contact this business.</p></div></div>';
        return;
      }
      function daKpiCard(icon,label,val){
        return '<div class="gh-da-kpi-card"><i class="fas '+icon+'"></i><div class="gh-da-kpi-body"><span class="gh-da-kpi-val">'+val+'</span><span class="gh-da-kpi-label">'+label+'</span></div></div>';
      }
      var ratingAvg=b.ratingCount>0?(b.ratingTotal/b.ratingCount).toFixed(1):(b.ratingAverage>0?Number(b.ratingAverage).toFixed(1):'—');
      el.innerHTML=
        '<div class="gh-da-section">'+
          '<h3 class="gh-da-section-title">Overview</h3>'+
          '<div class="gh-da-kpi-grid">'+
            daKpiCard('fa-eye','Views Today',viewsToday||'—')+
            daKpiCard('fa-calendar-week','Views 7d',sum7.views||'—')+
            daKpiCard('fa-calendar','Views 30d',sum30.views||'—')+
            daKpiCard('fa-users','Followers',Number(b.followerCount||0))+
            daKpiCard('fa-star','Rating',ratingAvg)+
            daKpiCard('fa-comment-dots','Reviews',Number(b.reviewCount||0))+
            daKpiCard('fa-newspaper','Posts',Number(b.postCount||0))+
            daKpiCard('fa-heart','Follows 30d',sum30.follows||'—')+
          '</div>'+
        '</div>'+
        (interactions.some(function(x){return x.val>0;})?
          '<div class="gh-da-section">'+
            '<h3 class="gh-da-section-title">Contact Interactions <span class="gh-muted" style="font-size:.78rem;font-weight:400">(last 30 days)</span></h3>'+
            '<div class="gh-da-actions">'+
              interactions.map(function(x){
                var pct=Math.round((x.val/maxIA)*100);
                return '<div class="gh-da-action-row">'+
                  '<i class="fas '+x.icon+' gh-da-action-icon"></i>'+
                  '<span class="gh-da-action-label">'+x.label+'</span>'+
                  '<div class="gh-da-bar-wrap"><div class="gh-da-bar-fill" style="width:'+pct+'%"></div></div>'+
                  '<span class="gh-da-action-val">'+x.val+'</span>'+
                '</div>';
              }).join('')+
            '</div>'+
          '</div>':'')+
        (days.slice(0,7).length>0?
          '<div class="gh-da-section">'+
            '<h3 class="gh-da-section-title">Last 7 days</h3>'+
            '<div class="gh-da-days">'+
              '<div class="gh-da-day-head"><span>Date</span><span>Views</span><span>Contacts</span><span>Follows</span></div>'+
              days.slice(0,7).map(function(d){
                var contacts=(Number(d.phoneClicks)||0)+(Number(d.whatsappClicks)||0)+(Number(d.emailClicks)||0)+(Number(d.bookingClicks)||0)+(Number(d.websiteClicks)||0)+(Number(d.directionsClicks)||0)+(Number(d.serviceClicks)||0);
                var isToday=d.date===today;
                return '<div class="gh-da-day-row'+(isToday?' gh-da-today':'')+'">'+
                  '<span>'+(isToday?'Today':esc(d.date||''))+'</span>'+
                  '<span>'+(Number(d.views)||0)+'</span>'+
                  '<span>'+contacts+'</span>'+
                  '<span>'+(Number(d.follows)||0)+'</span>'+
                '</div>';
              }).join('')+
            '</div>'+
          '</div>':'');
    }).catch(function(){var el=$('#ghDaBody');if(el)el.innerHTML='<div class="gh-card"><div class="gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Failed to load analytics</h3></div></div>';});
  }


  function normService(d, id){
    if(!d) return null;
    return {
      id:         id||d.id||'',
      title:      d.title||d.name||'',
      description:d.description||'',
      price:      d.price||'',
      currency:   d.currency||'GEL',
      category:   d.category||'',
      imageUrl:   d.imageUrl||d.image||'',
      type:       d.type||'service',
      featured:   !!d.featured,
      active:     d.active!==false,
      bookingUrl: d.bookingUrl||'',
      order:      Number(d.order)||0,
      createdAt:  d.createdAt||null,
    };
  }

  function loadServices(businessId, cb, includeInactive){
    if(!fs()||!db()){ cb([]); return; }
    fs().getDocs(fs().collection(db(),'businesses',businessId,'services')).then(function(snap){
      var items=[]; snap.forEach(function(d){items.push(normService(Object.assign({id:d.id},d.data()),d.id));});
      if(!includeInactive) items=items.filter(function(s){return s.active;});
      // Featured first, then by order ascending — sorted in JS to avoid compound index
      items.sort(function(a,b){ var af=!!a.featured,bf=!!b.featured; if(af!==bf) return bf?-1:1; return (Number(a.order)||0)-(Number(b.order)||0); });
      cb(items);
    }).catch(function(){ cb([]); });
  }

  function loadServiceForEdit(b, svcId, cb){
    if(!fs()||!db()){ cb(null); return; }
    fs().getDoc(fs().doc(db(),'businesses',b.id,'services',svcId)).then(function(snap){
      if(!snap.exists()){ cb(null); return; }
      cb(normService(Object.assign({id:snap.id},snap.data()),snap.id));
    }).catch(function(){ cb(null); });
  }

  function svcPublicCard(s, b){
    var type=s.type||'service';
    var ctaHtml='';
    if(s.bookingUrl) ctaHtml='<a href="'+esc(s.bookingUrl)+'" target="_blank" rel="noopener" class="gh-svc-cta" data-track-cta="serviceClicks"><i class="fas fa-calendar-check"></i> Book / Contact</a>';
    else if(b&&b.phone) ctaHtml='<a href="tel:'+esc(b.phone)+'" class="gh-svc-cta" data-track-cta="serviceClicks"><i class="fas fa-phone"></i> Call</a>';
    else if(b&&b.website) ctaHtml='<a href="'+esc(b.website)+'" target="_blank" rel="noopener" class="gh-svc-cta" data-track-cta="serviceClicks"><i class="fas fa-globe"></i> Visit website</a>';
    return '<div class="gh-svc-card2">'+
      (s.imageUrl?'<div class="gh-svc-card-img"><img src="'+esc(s.imageUrl)+'" alt="'+esc(s.title)+'" loading="lazy" onerror="this.closest(\'.gh-svc-card-img\').style.display=\'none\'"></div>':'')+
      '<div class="gh-svc-body">'+
        '<div class="gh-svc-header-row">'+
          '<div class="gh-svc-badges">'+
            (s.featured?'<span class="gh-svc-badge featured"><i class="fas fa-star"></i> Featured</span>':'')+
            '<span class="gh-svc-badge type">'+esc(type.charAt(0).toUpperCase()+type.slice(1))+'</span>'+
            (s.category?'<span class="gh-svc-badge cat">'+esc(s.category)+'</span>':'')+
          '</div>'+
          (s.price?'<div class="gh-svc-price-block"><strong>'+esc(s.price)+'</strong><span>'+esc(s.currency||'GEL')+'</span></div>':'')+
        '</div>'+
        '<h3 class="gh-svc-title">'+esc(s.title)+'</h3>'+
        (s.description?'<p class="gh-svc-desc">'+esc(s.description)+'</p>':'')+
        ctaHtml+
      '</div>'+
    '</div>';
  }

  function renderBusinessServices(b){
    var box=$('#ghBusinessTabContent'); if(!box)return;
    var isOwner=!!(authUser()&&authUser().uid&&(b.ownerId===authUser().uid||b.createdBy===authUser().uid||b.userId===authUser().uid));
    state.svcFilter='all';
    box.innerHTML=
      '<div class="gh-card">'+
        '<div class="gh-biz-sec-head"><h2>Services</h2>'+(isOwner?'<button class="gh-btn sm" data-svc-add><i class="fas fa-plus"></i> Add</button>':'')+'</div>'+
        '<div class="gh-svc-filter-row" id="ghSvcFilterRow"></div>'+
        '<div id="ghServicesList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+
      '</div>';
    box.onclick=function(e){
      if(e.target.closest('[data-svc-add]')) openServiceModal(b,null,function(){renderBusinessServices(b);});
      var chip=e.target.closest('[data-svc-filter]');
      if(chip){ state.svcFilter=chip.dataset.svcFilter; paintSvcFilterChips(state.allSvcs||[],state.svcFilter); paintSvcPublic(state.allSvcs||[],state.svcFilter,b); }
    };
    loadServices(b.id,function(items){
      state.allSvcs=items;
      paintSvcFilterChips(items,'all');
      var list=$('#ghServicesList'); if(!list)return;
      if(!items.length){list.innerHTML='<div class="gh-empty"><i class="fas fa-briefcase"></i><h3>No services listed yet</h3>'+(isOwner?'<p>Add your first service.</p><button class="gh-btn" data-svc-add>Add service</button>':'<p>This business has not added any services yet.</p>')+'</div>'; return;}
      paintSvcPublic(items,'all',b);
    });
  }

  function paintSvcFilterChips(items, active){
    var row=$('#ghSvcFilterRow'); if(!row)return;
    var cats=[]; items.forEach(function(s){if(s.category&&cats.indexOf(s.category)<0)cats.push(s.category);});
    var filters=[{k:'all',l:'All'},{k:'service',l:'Services'},{k:'product',l:'Products'},{k:'featured',l:'Featured'}];
    cats.forEach(function(c){filters.push({k:'cat:'+c,l:c});});
    row.innerHTML=filters.map(function(f){return '<button class="gh-pill'+(f.k===(active||'all')?' active':'')+'" data-svc-filter="'+esc(f.k)+'">'+esc(f.l)+'</button>';}).join('');
  }

  function paintSvcPublic(items, filter, b){
    var list=$('#ghServicesList'); if(!list)return;
    var show=items.filter(function(s){
      if(filter==='service') return s.type==='service'||s.type===''||!s.type;
      if(filter==='product') return s.type==='product';
      if(filter==='featured') return s.featured;
      if(filter&&filter.indexOf('cat:')===0) return s.category===filter.slice(4);
      return true;
    });
    if(!show.length){list.innerHTML='<div class="gh-empty"><i class="fas fa-briefcase"></i><h3>Nothing here yet</h3></div>'; return;}
    list.innerHTML='<div class="gh-svc-grid">'+show.map(function(s){return svcPublicCard(s,b);}).join('')+'</div>';
  }

  function openServiceModal(b, svc, onSuccess){
    if(!requireLogin()) return;
    var isEdit=!!(svc&&svc.id);
    var body=
      '<div class="gh-form-rows">'+
        '<label class="gh-form-label">Service name *</label>'+
        '<input class="gh-input" id="svcTitle" placeholder="e.g. Website Design" value="'+esc(isEdit?(svc.title||''):'')+'">'+
        '<label class="gh-form-label">Type</label>'+
        '<select class="gh-select" id="svcType">'+
          '<option value="service"'+((!isEdit||(svc.type||'service')==='service')?' selected':'')+'>Service</option>'+
          '<option value="product"'+(isEdit&&svc.type==='product'?' selected':'')+'>Product</option>'+
        '</select>'+
        '<label class="gh-form-label">Description</label>'+
        '<textarea class="gh-textarea" id="svcDesc" placeholder="Describe this service or product">'+esc(isEdit?(svc.description||''):'')+'</textarea>'+
        '<div class="gh-form-grid">'+
          '<div><label class="gh-form-label">Price</label><input class="gh-input" id="svcPrice" placeholder="e.g. 150" value="'+esc(isEdit?(svc.price||''):'')+'"></div>'+
          '<div><label class="gh-form-label">Currency</label><select class="gh-select" id="svcCurrency">'+
            '<option value="GEL"'+((!isEdit||svc.currency==='GEL')?' selected':'')+'>GEL</option>'+
            '<option value="USD"'+(isEdit&&svc.currency==='USD'?' selected':'')+'>USD</option>'+
            '<option value="EUR"'+(isEdit&&svc.currency==='EUR'?' selected':'')+'>EUR</option>'+
          '</select></div>'+
        '</div>'+
        '<label class="gh-form-label">Category (optional)</label>'+
        '<input class="gh-input" id="svcCat" placeholder="e.g. Design, Photography" value="'+esc(isEdit?(svc.category||''):'')+'">'+
        '<label class="gh-form-label">Image URL (optional)</label>'+
        '<input class="gh-input" id="svcImg" placeholder="https://..." value="'+esc(isEdit?(svc.imageUrl||''):'')+'">'+
        '<label class="gh-form-label">Booking / Contact URL (optional)</label>'+
        '<input class="gh-input" id="svcBook" placeholder="https://..." value="'+esc(isEdit?(svc.bookingUrl||''):'')+'">'+
        '<div style="display:flex;gap:18px;margin-top:4px">'+
          '<label class="gh-form-check"><input type="checkbox" id="svcFeatured"'+(isEdit&&svc.featured?' checked':'')+'>  Featured</label>'+
          '<label class="gh-form-check"><input type="checkbox" id="svcActive"'+((!isEdit||svc.active!==false)?' checked':'')+'>  Active (visible publicly)</label>'+
        '</div>'+
      '</div>';
    modal(isEdit?'Edit Service':'Add Service', body,
      '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="svcSubmit">'+(isEdit?'Save changes':'Add service')+'</button>',
      'ghSvcModal');
    $('#svcSubmit').onclick=function(){
      var titleVal=($('#svcTitle').value||'').trim(); if(!titleVal) return toast('Service name required','error');
      var tsFn=fs().serverTimestamp(); var schema=window.GH||{};
      var fields={title:titleVal,type:$('#svcType').value||'service',description:$('#svcDesc').value.trim(),price:$('#svcPrice').value.trim(),currency:$('#svcCurrency').value||'GEL',category:$('#svcCat').value.trim(),imageUrl:$('#svcImg').value.trim(),bookingUrl:$('#svcBook').value.trim(),featured:!!$('#svcFeatured').checked,active:!!$('#svcActive').checked};
      var btn=$('#svcSubmit'); if(btn) btn.disabled=true;
      function done(){ var m=$('#ghSvcModal'); if(m)m.remove(); toast(isEdit?'Service updated':'Service added'); if(typeof onSuccess==='function') onSuccess(); }
      function fail(err){ toast('Failed: '+(err.message||err),'error'); var b2=$('#svcSubmit'); if(b2)b2.disabled=false; }
      if(isEdit){
        fs().updateDoc(fs().doc(db(),'businesses',b.id,'services',svc.id),Object.assign({},fields,{updatedAt:tsFn})).then(done).catch(fail);
      } else {
        var base=schema.newService?schema.newService(fields,authUser().uid,0,tsFn):{title:fields.title,description:fields.description,price:fields.price,currency:fields.currency,status:'active',order:0,createdBy:authUser().uid,createdAt:tsFn,updatedAt:tsFn};
        fs().addDoc(fs().collection(db(),'businesses',b.id,'services'),Object.assign(base,{type:fields.type,featured:fields.featured,active:fields.active,imageUrl:fields.imageUrl,bookingUrl:fields.bookingUrl,category:fields.category||base.category||''})).then(done).catch(fail);
      }
    };
  }

  function openAddServiceModal(b, cb){ openServiceModal(b,null,cb); }

  function toggleServiceActive(b, svcId, isActive){
    if(!svcId||!fs()||!db()) return;
    fs().updateDoc(fs().doc(db(),'businesses',b.id,'services',svcId),{active:isActive,status:isActive?'active':'inactive',updatedAt:fs().serverTimestamp()}).then(function(){loadDashServices(b);}).catch(function(err){toast('Failed: '+(err.message||err),'error');});
  }

  function toggleServiceFeatured(b, svcId, isFeatured){
    if(!svcId||!fs()||!db()) return;
    fs().updateDoc(fs().doc(db(),'businesses',b.id,'services',svcId),{featured:isFeatured,updatedAt:fs().serverTimestamp()}).then(function(){loadDashServices(b);}).catch(function(err){toast('Failed: '+(err.message||err),'error');});
  }

  function renderBusinessPhotos(b){
    var box=$('#ghBusinessTabContent'); if(!box) return;
    var isOwner=!!(authUser()&&authUser().uid&&(b.ownerId===authUser().uid||b.createdBy===authUser().uid||b.userId===authUser().uid));
    box.innerHTML=
      '<div class="gh-card">'+
        '<div class="gh-biz-sec-head"><h2>Photos</h2>'+(isOwner?'<button class="gh-btn sm" data-pub-add-photo><i class="fas fa-plus"></i> Add photo</button>':'')+'</div>'+
        '<div id="ghGalleryGrid"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+
      '</div>';
    box.onclick=function(e){ if(e.target.closest('[data-pub-add-photo]')) openAddGalleryPhotoModal(b,function(){renderBusinessPhotos(b);}); };
    if(!fs()||!db()){ $('#ghGalleryGrid').innerHTML='<div class="gh-empty"><i class="fas fa-images"></i><h3>Photos unavailable</h3></div>'; return; }
    loadGalleryPhotos(b.id,function(photos){
      var grid=$('#ghGalleryGrid'); if(!grid) return;
      if(!photos.length){
        grid.innerHTML='<div class="gh-empty"><i class="fas fa-images"></i><h3>No photos yet</h3>'+(isOwner?'<p>Add photos to showcase your business.</p><button class="gh-btn" data-pub-add-photo>Add first photo</button>':'<p>No photos have been added yet.</p>')+'</div>';
        return;
      }
      grid.innerHTML='<div class="gh-gallery-grid">'+photos.map(function(p,i){
        return '<div class="gh-gallery-item'+(p.featured?' gh-gallery-item-featured':'')+'" data-gallery-idx="'+i+'">'+
          (p.featured?'<span class="gh-gallery-featured-badge"><i class="fas fa-star"></i></span>':'')+
          '<img src="'+esc(p.url||p.imageUrl||'')+'" alt="'+esc(p.caption||'')+'" loading="lazy" onerror="this.closest(\'.gh-gallery-item\').style.display=\'none\'">'+
          (p.caption?'<div class="gh-gallery-caption">'+esc(p.caption)+'</div>':'')+
        '</div>';
      }).join('')+'</div>';
      grid.onclick=function(e){ var item=e.target.closest('[data-gallery-idx]'); if(item) openGalleryPreview(photos,Number(item.dataset.galleryIdx)); };
    });
  }

  function uploadGalleryPhoto(b, onSuccess){
    openAddGalleryPhotoModal(b, onSuccess||function(){renderBusinessPhotos(b);});
  }

  function loadGalleryPhotos(businessId, cb){
    if(!fs()||!db()){ cb([]); return; }
    fs().getDocs(fs().query(fs().collection(db(),'businesses',businessId,'gallery'))).then(function(snap){
      var photos=[]; snap.forEach(function(d){photos.push(Object.assign({id:d.id},d.data()));});
      // Featured first, then by order ascending — sorted in JS to avoid compound index
      photos.sort(function(a,b){ var af=!!a.featured,bf=!!b.featured; if(af!==bf) return bf?-1:1; return (Number(a.order)||0)-(Number(b.order)||0); });
      cb(photos);
    }).catch(function(){ cb([]); });
  }

  function openGalleryPreview(photos, startIdx){
    if(state.currentBizId) bizTrack(state.currentBizId,'galleryViews');
    var cur={idx:startIdx||0};
    function render(){
      var m=$('#ghGalleryModal'); if(!m) return;
      var p=photos[cur.idx]; if(!p) return;
      var imgEl=m.querySelector('.gh-gm-img');
      var capEl=m.querySelector('.gh-gm-caption');
      var ctrEl=m.querySelector('.gh-gm-counter');
      var featEl=m.querySelector('.gh-gm-featured');
      if(imgEl){ imgEl.src=''; imgEl.src=p.url||p.imageUrl||''; imgEl.alt=p.caption||''; }
      if(capEl){ capEl.textContent=p.caption||''; capEl.style.display=p.caption?'':'none'; }
      if(ctrEl) ctrEl.textContent=(cur.idx+1)+' / '+photos.length;
      if(featEl) featEl.style.display=p.featured?'':'none';
      var prevBtn=m.querySelector('.gh-gm-prev'), nextBtn=m.querySelector('.gh-gm-next');
      if(prevBtn) prevBtn.disabled=cur.idx===0;
      if(nextBtn) nextBtn.disabled=cur.idx===photos.length-1;
    }
    var old=$('#ghGalleryModal'); if(old) old.remove();
    var el=document.createElement('div'); el.id='ghGalleryModal'; el.className='gh-gallery-modal';
    el.innerHTML=
      '<div class="gh-gm-backdrop"></div>'+
      '<div class="gh-gm-dialog">'+
        '<button class="gh-gm-close" aria-label="Close"><i class="fas fa-times"></i></button>'+
        '<div class="gh-gm-img-wrap">'+
          '<img class="gh-gm-img" src="" alt="" loading="lazy" onerror="this.src=\'\'">'+
          '<button class="gh-gm-prev" aria-label="Previous"><i class="fas fa-chevron-left"></i></button>'+
          '<button class="gh-gm-next" aria-label="Next"><i class="fas fa-chevron-right"></i></button>'+
        '</div>'+
        '<div class="gh-gm-footer">'+
          '<span class="gh-gm-featured"><i class="fas fa-star" style="color:#facc15"></i> Featured</span>'+
          '<span class="gh-gm-caption"></span>'+
          '<span class="gh-gm-counter"></span>'+
        '</div>'+
      '</div>';
    document.body.appendChild(el);
    function closeModal(){ var m2=$('#ghGalleryModal'); if(m2){m2.classList.remove('open');setTimeout(function(){m2.remove();},180);} document.removeEventListener('keydown',onKey); }
    el.querySelector('.gh-gm-backdrop').onclick=closeModal;
    el.querySelector('.gh-gm-close').onclick=closeModal;
    el.querySelector('.gh-gm-prev').onclick=function(){ if(cur.idx>0){cur.idx--;render();} };
    el.querySelector('.gh-gm-next').onclick=function(){ if(cur.idx<photos.length-1){cur.idx++;render();} };
    function onKey(e){ if(!$('#ghGalleryModal')){document.removeEventListener('keydown',onKey);return;} if(e.key==='Escape') closeModal(); if(e.key==='ArrowLeft'&&cur.idx>0){cur.idx--;render();} if(e.key==='ArrowRight'&&cur.idx<photos.length-1){cur.idx++;render();} }
    document.addEventListener('keydown',onKey);
    render();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('open'); }); });
  }

  function openAddGalleryPhotoModal(b, onSuccess){
    if(!requireLogin()) return;
    var pickedUrl='';
    var body=
      '<div class="gh-form-rows">'+
        '<div>'+
          '<div class="gh-gallery-pick-row">'+
            '<button type="button" class="gh-btn ghost" id="gpmPickFile"><i class="fas fa-upload"></i> Upload from device</button>'+
            '<span class="gh-gallery-pick-or">or</span>'+
            '<input class="gh-input" id="gpmUrl" placeholder="Paste image URL https://…">'+
          '</div>'+
          '<div id="gpmPreview" style="display:none;margin-top:10px;text-align:center"><img id="gpmPreviewImg" src="" alt="" style="max-width:100%;max-height:180px;border-radius:10px;object-fit:contain;background:rgba(0,0,0,.1)"></div>'+
        '</div>'+
        '<label class="gh-form-label">Caption (optional)<input class="gh-input" id="gpmCaption" placeholder="Describe this photo…"></label>'+
        '<label class="gh-form-label">Category (optional)<input class="gh-input" id="gpmCategory" placeholder="e.g. Interior, Team, Products"></label>'+
        '<label class="gh-form-check"><input type="checkbox" id="gpmFeatured"><span>Mark as featured photo</span></label>'+
      '</div>';
    modal('Add Photo', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="gpmSubmit"><i class="fas fa-plus"></i> Add photo</button>', 'ghGalleryPhotoModal');
    $('#gpmPickFile').onclick=function(){
      triggerImagePick(function(dataUrl){ if(!dataUrl) return; pickedUrl=dataUrl; var prev=$('#gpmPreview'),img=$('#gpmPreviewImg'); if(prev&&img){img.src=dataUrl;prev.style.display='';} var urlIn=$('#gpmUrl'); if(urlIn) urlIn.value=''; });
    };
    $('#gpmUrl').oninput=function(){ var v=this.value.trim(); pickedUrl=''; var prev=$('#gpmPreview'),img=$('#gpmPreviewImg'); if(prev&&img&&v){img.src=v;prev.style.display='';} else if(prev) prev.style.display='none'; };
    $('#gpmSubmit').onclick=function(){
      var url=pickedUrl||($('#gpmUrl').value||'').trim(); if(!url) return toast('Add a photo first','error');
      var caption=($('#gpmCaption').value||'').trim(), category=($('#gpmCategory').value||'').trim(), featured=!!$('#gpmFeatured').checked;
      var now=fs().serverTimestamp(), schema=window.GH||{};
      var doc=schema.newGalleryPhoto
        ? Object.assign(schema.newGalleryPhoto(url,authUser().uid,caption,Date.now(),now),{category:category,featured:featured})
        : {url:url,caption:caption,category:category,featured:featured,order:Date.now(),uploadedBy:authUser().uid,createdAt:now};
      var btn=$('#gpmSubmit'); if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Adding…';}
      fs().addDoc(fs().collection(db(),'businesses',b.id,'gallery'),doc).then(function(){
        var m=$('#ghGalleryPhotoModal'); if(m) m.remove(); toast('Photo added');
        if(typeof onSuccess==='function') onSuccess();
      }).catch(function(err){ toast('Failed: '+(err.message||err),'error'); if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-plus"></i> Add photo';} });
    };
  }

  function toggleGalleryFeatured(b, photoId, isFeatured){
    if(!photoId||!fs()||!db()) return;
    fs().updateDoc(fs().doc(db(),'businesses',b.id,'gallery',photoId),{featured:!isFeatured}).then(function(){
      toast(isFeatured?'Removed from featured':'Marked as featured'); loadDashGallery(b);
    }).catch(function(err){ toast('Failed: '+(err.message||err),'error'); });
  }

  function openBusinessRewardModal(b){
    if(!requireLogin()) return;
    var body='<input class="gh-input" id="brTitle" placeholder="Reward title, e.g. Free coffee"><div style="height:10px"></div><textarea class="gh-textarea" id="brDesc" placeholder="Reward details and how it works"></textarea><div class="gh-form-grid"><select class="gh-select" id="brType"><option value="discount">Discount</option><option value="free_item">Free item</option><option value="visit">Daily visit / pass</option><option value="course">Online course</option><option value="platform_perk">GeoHub perk</option></select><input class="gh-input" id="brPrice" type="number" min="1" placeholder="Point price"></div><div class="gh-form-grid"><input class="gh-input" id="brQty" type="number" min="0" placeholder="Quantity, 0 = unlimited"><input class="gh-input" id="brExpires" placeholder="Expires, e.g. 2026-06-30"></div><div style="height:10px"></div><textarea class="gh-textarea" id="brTerms" placeholder="Terms: no cash value, one-time use, partner conditions…"></textarea>';
    modal('New partner reward for '+(b.title||b.name||'business'), body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="brSubmit"><i class="fas fa-gift"></i>Create reward</button>', 'ghRewardModal');
    $('#brSubmit').onclick=function(){
      if(!GS().createReward) return toast('Reward system unavailable','error');
      GS().createReward({ businessId:b.id, businessName:b.name||'', title:$('#brTitle').value, description:$('#brDesc').value, rewardType:$('#brType').value, pointPrice:$('#brPrice').value, quantity:$('#brQty').value, expiresAt:$('#brExpires').value, terms:$('#brTerms').value }, function(){ var m=$('#ghRewardModal'); if(m)m.remove(); renderBusinessManageTab(b); });
    };
  }

  function openBusinessOfferModal(b){
    if(!requireLogin()) return;
    var body='<input class="gh-input" id="boTitle" placeholder="Offer title, e.g. Weekend discount"><div style="height:10px"></div><textarea class="gh-textarea" id="boDesc" placeholder="Offer details"></textarea><div class="gh-form-grid"><input class="gh-input" id="boStarts" placeholder="Starts e.g. today"><input class="gh-input" id="boEnds" placeholder="Ends e.g. Sunday"></div>';
    modal('New offer for '+(b.title||b.name||'business'), body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="boSubmit">Create offer</button>', 'ghOfferModal');
    $('#boSubmit').onclick=function(){ if(!GS().createBusinessOffer) return toast('Offers unavailable','error'); GS().createBusinessOffer(b.id,{ title:$('#boTitle').value, description:$('#boDesc').value, startsAt:$('#boStarts').value, endsAt:$('#boEnds').value },function(){ var m=$('#ghOfferModal'); if(m)m.remove(); renderBusinessManageTab(b); }); };
  }

  function renderBusinessTab(b){
    var box=$('#ghBusinessTabContent'); if(!box)return;
    var tab=state.currentBusinessTab||'overview';
    if(tab==='overview')  return renderBusinessOverview(b);
    if(tab==='about')     return renderBusinessAbout(b);
    if(tab==='reviews')   return renderBusinessReviews(b);
    if(tab==='manage')    return renderBusinessManageTab(b);
    if(tab==='services')  return renderBusinessServices(b);
    if(tab==='photos')  { renderBusinessPhotos(b); return; }
    // posts tab
    var bTitle=b.title||b.name||'Business';
    var isOwner=!!(authUser() && authUser().uid && (b.ownerId===authUser().uid || b.createdBy===authUser().uid || b.userId===authUser().uid));
    box.innerHTML=
      (isOwner?'<section class="gh-card gh-composer"><div class="gh-composer-top"><span class="gh-avatar">'+esc(initials(bTitle))+'</span><button class="gh-composer-fake" data-post-as-business>Post as '+esc(bTitle)+'</button></div></section>':'')+
      '<div id="ghBusinessPosts"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>';
    box.onclick=function(e){ if(e.target.closest('[data-post-as-business]')) openPostModal({ targetType:'business',targetId:b.id,authorType:'business',businessId:b.id,authorId:b.id,authorName:bTitle,authorAvatar:b.logoUrl||b.coverUrl||'',createdByUserId:authUser()&&authUser().uid }); };
    bindPostInteractions(box);
    setupAudienceAccess(function(){ var list=$('#ghBusinessPosts'); if(list&&list._lastPosts){ var posts=list._lastPosts.filter(canSeePost); list.innerHTML=posts.length?posts.map(postCard).join(''):'<div class="gh-card gh-empty"><i class="fas fa-newspaper"></i><h3>No posts yet</h3><p>Business updates will appear here.</p></div>'; hydrateSharedPreviews(list); } });
    listenTargetPosts('business',b.id,function(posts){ var list=$('#ghBusinessPosts'); if(!list)return; list._lastPosts=posts||[]; posts=posts.filter(canSeePost); if(!posts.length){list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-newspaper"></i><h3>No posts yet</h3><p>Business page updates will appear here.</p></div>';return;} list.innerHTML=posts.map(postCard).join(''); bindPostInteractions(list); posts.forEach(function(p){hydrateReactionState(p.id);}); hydrateSharedPreviews(list); });
  }

  function aboutRow(ic, txt){ return '<div class="gh-about-row"><i class="fas '+ic+'"></i><span>'+esc(txt)+'</span></div>'; }

  function bizInfoCard(icon, label, value, link){
    var valHtml = link ? '<a href="'+esc(link)+'" target="_blank" rel="noopener">'+esc(value)+'</a>' : esc(value);
    return '<div class="gh-biz-info-card"><i class="fas '+icon+'"></i><div><span class="gh-biz-ic-label">'+esc(label)+'</span><span class="gh-biz-ic-value">'+valHtml+'</span></div></div>';
  }

  function starsHtml(rating, max){
    max = max || 5; rating = Number(rating) || 0;
    var full=Math.round(rating); var out='';
    for(var i=1;i<=max;i++) out+='<span class="gh-star-'+(i<=full?'full':'empty')+'">★</span>';
    return out;
  }

  function renderBusinessOverview(b){
    var box=$('#ghBusinessTabContent'); if(!box)return;
    var sLinks=b.socialLinks||{};
    var ratingAvg = b.ratingCount>0 ? (b.ratingTotal/b.ratingCount).toFixed(1) : (b.ratingAverage>0 ? Number(b.ratingAverage).toFixed(1) : null);
    var infoCards='';
    if(b.phone)    infoCards+=bizInfoCard('fa-phone','Phone',b.phone,'tel:'+b.phone);
    if(b.email)    infoCards+=bizInfoCard('fa-envelope','Email',b.email,'mailto:'+b.email);
    if(b.website)  infoCards+=bizInfoCard('fa-globe','Website',b.website,b.website);
    if(!isOnlineBusiness(b)&&b.city) infoCards+=bizInfoCard('fa-location-dot','Location',b.address?b.address+', '+b.city:b.city,'');
    if(isOnlineBusiness(b))          infoCards+=bizInfoCard('fa-globe','Service area',b.serviceAreaText||businessAreaLabel(b),'');
    if(b.workingHours){
      var nhOv=normWorkingHours(b.workingHours);
      var ovS=nhOv?isOpenNow(nhOv):null;
      var ovBadge=ovS?'<span class="gh-hours-status '+(ovS.open?'open':'closed')+'" style="margin-left:6px;font-size:.7rem"><i class="fas fa-circle" style="font-size:.5rem;vertical-align:middle"></i> '+(ovS.open?'Open now':'Closed')+'</span>':'';
      infoCards+=bizInfoCardHtml('fa-clock','Today',esc(formatWorkingHours(b.workingHours))+ovBadge);
    }
    if(b.priceRange||b.startingPrice) infoCards+=bizInfoCard('fa-tag','Pricing',(b.startingPrice?'From '+b.startingPrice+' · ':'')+esc(b.priceRange||''));
    var sIg=sLinks.instagram||b.instagram||''; var sFb=sLinks.facebook||b.facebook||''; var sWa=sLinks.whatsapp||b.whatsapp||'';
    if(sIg) infoCards+=bizInfoCard('fa-brands fa-instagram','Instagram',sIg,'https://instagram.com/'+sIg.replace(/^@/,''));
    if(sFb) infoCards+=bizInfoCard('fa-brands fa-facebook','Facebook',sFb,sFb.startsWith('http')?sFb:'https://facebook.com/'+sFb);
    if(sWa) infoCards+=bizInfoCard('fa-brands fa-whatsapp','WhatsApp',sWa,'https://wa.me/'+sWa.replace(/\D/g,''));

    var ratingSection = ratingAvg ?
      '<div class="gh-card" style="margin-bottom:0">'+
        '<div class="gh-biz-sec-head"><h3>Rating</h3><button class="gh-btn sm ghost" data-switch-tab="reviews">All reviews</button></div>'+
        '<div class="gh-biz-rating-row">'+
          '<div class="gh-biz-rating-big">'+ratingAvg+'</div>'+
          '<div><span class="gh-biz-rating-stars">'+starsHtml(ratingAvg)+'</span><span class="gh-biz-rating-sub">'+Number(b.ratingCount||b.reviewCount||0)+' reviews</span></div>'+
        '</div>'+
      '</div>' : '';

    box.innerHTML=
      '<div style="display:grid;gap:14px">'+
      (b.description ? '<div class="gh-card" style="margin-bottom:0"><p style="margin:0;line-height:1.65;color:var(--gh-text)">'+esc(b.description)+'</p></div>' : '')+
      (infoCards ? '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>Contact & Info</h3></div><div class="gh-biz-info-grid">'+infoCards+'</div></div>' : '')+
      ratingSection+
      '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>Latest Posts</h3><button class="gh-btn sm ghost" data-switch-tab="posts">All posts</button></div><div id="ghOvPosts"><div class="gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>'+
      '<div class="gh-card" style="margin-bottom:0" id="ghOvSvcWrap"><div class="gh-biz-sec-head"><h3>Services</h3><button class="gh-btn sm ghost" data-switch-tab="services">All services</button></div><div id="ghOvSvc"><div class="gh-empty" style="min-height:60px"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>'+
      '</div>';

    box.onclick=function(e){ var sw=e.target.closest('[data-switch-tab]'); if(sw){ state.currentBusinessTab=sw.dataset.switchTab; $all('[data-biz-tab]').forEach(function(x){x.classList.toggle('active',x.dataset.bizTab===state.currentBusinessTab);}); renderBusinessTab(b); } };

    listenTargetPosts('business',b.id,function(posts){ var el=$('#ghOvPosts'); if(!el)return; posts=posts.filter(canSeePost).slice(0,3); if(!posts.length){el.innerHTML='<div class="gh-empty" style="min-height:60px"><i class="fas fa-newspaper"></i><p>No posts yet</p></div>'; return;} el.innerHTML='<div class="gh-biz-preview-posts">'+posts.map(function(p){ return '<div class="gh-biz-preview-post">'+esc((p.text||'').slice(0,160))+'</div>'; }).join('')+'</div>'; });

    loadServices(b.id,function(items){
      var el=$('#ghOvSvc'); if(!el)return;
      items=items.slice(0,3);
      if(!items.length){var wrap=$('#ghOvSvcWrap'); if(wrap) wrap.style.display='none'; return;}
      el.innerHTML='<div class="gh-svc-list">'+items.map(function(s){return '<div class="gh-svc-card">'+
        (s.featured?'<span class="gh-svc-badge featured" style="margin-bottom:5px"><i class="fas fa-star"></i></span>':'')+
        '<div class="gh-svc-info"><h3>'+esc(s.title)+'</h3>'+(s.description?'<p>'+esc(s.description.slice(0,80))+'</p>':'')+'</div>'+
        (s.price?'<div class="gh-svc-price"><strong>'+esc(s.price)+'</strong><span>'+esc(s.currency||'GEL')+'</span></div>':'')+
      '</div>';}).join('')+'</div>';
    });
  }

  function renderBusinessAbout(b){
    var box=$('#ghBusinessTabContent'); if(!box)return;
    var sLinks=b.socialLinks||{};
    var ig=sLinks.instagram||b.instagram||'';
    var fb=sLinks.facebook||b.facebook||'';
    var wa=sLinks.whatsapp||b.whatsapp||'';
    var tk=sLinks.tiktok||'';
    var li=sLinks.linkedin||'';
    var bookingUrl=b.bookingUrl||sLinks.bookingUrl||'';
    var todayIdx=new Date().getDay()===0?6:new Date().getDay()-1;
    var todayLabel=DAYS_LABELS[todayIdx];
    var _placeCoords=getPlaceCoords(b);
    var _mapsUrl=b.mapsLink||(_placeCoords?'https://maps.google.com/?q='+_placeCoords.lat+','+_placeCoords.lng:null);

    // Working hours block with open/closed status
    var nh=b.workingHours&&typeof b.workingHours==='object'?normWorkingHours(b.workingHours):null;
    var openStatus=nh?isOpenNow(nh):null;
    var hoursStatusHtml='';
    if(openStatus){
      hoursStatusHtml='<div class="gh-hours-status-row">'+
        '<span class="gh-hours-status '+(openStatus.open?'open':'closed')+'"><i class="fas fa-circle"></i> '+(openStatus.open?'Open now':'Closed')+'</span>'+
        (openStatus.hours?'<span class="gh-hours-today-label">'+esc(openStatus.hours)+'</span>':'')+
        (!openStatus.open&&openStatus.nextOpen?'<span class="gh-hours-next">Opens '+esc(openStatus.nextOpen)+'</span>':'')+
      '</div>';
    }
    var hoursHtml='';
    if(nh){
      hoursHtml=hoursStatusHtml+'<div class="gh-hours-grid">'+DAYS_KEYS.map(function(k,i){
        var h=nh[k]; var isToday=DAYS_LABELS[i]===todayLabel;
        var label=h?(h.closed?'<em class="gh-hours-closed-label">Closed</em>':esc((h.open||'09:00')+' – '+(h.close||'18:00'))):'—';
        return '<div class="gh-hours-row'+(isToday?' today':'')+'"><span>'+DAYS_LABELS[i].slice(0,3)+'</span><span>'+label+'</span></div>';
      }).join('')+'</div>';
    } else if(b.workingHours&&typeof b.workingHours==='string'){
      hoursHtml='<p style="margin:0;font-size:.88rem;color:var(--gh-text)">'+esc(b.workingHours)+'</p>';
    } else {
      hoursHtml='<p class="gh-muted" style="margin:0;font-size:.85rem">Working hours not added yet.</p>';
    }

    // Contact CTA buttons — only for real data
    var ctaBtns=[];
    if(b.phone)      ctaBtns.push('<a href="tel:'+esc(b.phone)+'" class="gh-contact-cta-btn" data-track-cta="phoneClicks"><i class="fas fa-phone"></i> Call</a>');
    if(wa)           ctaBtns.push('<a href="https://wa.me/'+esc(wa.replace(/\D/g,''))+'" target="_blank" rel="noopener" class="gh-contact-cta-btn" data-track-cta="whatsappClicks"><i class="fab fa-whatsapp"></i> WhatsApp</a>');
    if(b.email)      ctaBtns.push('<a href="mailto:'+esc(b.email)+'" class="gh-contact-cta-btn" data-track-cta="emailClicks"><i class="fas fa-envelope"></i> Email</a>');
    if(bookingUrl)   ctaBtns.push('<a href="'+esc(bookingUrl)+'" target="_blank" rel="noopener" class="gh-contact-cta-btn primary" data-track-cta="bookingClicks"><i class="fas fa-calendar-check"></i> Book</a>');
    if(b.website)    ctaBtns.push('<a href="'+esc(b.website)+'" target="_blank" rel="noopener" class="gh-contact-cta-btn" data-track-cta="websiteClicks"><i class="fas fa-globe"></i> Website</a>');
    if(!isOnlineBusiness(b)&&_mapsUrl) ctaBtns.push('<a href="'+esc(_mapsUrl)+'" target="_blank" rel="noopener" class="gh-contact-cta-btn" data-track-cta="directionsClicks"><i class="fas fa-map-location-dot"></i> Directions</a>');
    var ctaHtml=ctaBtns.length?'<div class="gh-contact-ctas">'+ctaBtns.join('')+'</div>':'';
    var hasContact=b.phone||b.email||b.website||ig||fb||wa||tk||li||bookingUrl;

    box.innerHTML=
      '<div id="ghBizInviteBanner"></div>'+
      '<div class="gh-biz-about-grid">'+
        '<div style="display:grid;gap:12px">'+
          (b.description?'<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>About</h3></div><p style="margin:0;line-height:1.65;font-size:.9rem;color:var(--gh-text)">'+esc(b.description)+'</p></div>':'')+
          '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>Contact</h3></div>'+
            ctaHtml+
            '<div class="gh-about-list">'+
              (b.phone?aboutRow('fa-phone',b.phone):'')+
              (b.email?aboutRow('fa-envelope',b.email):'')+
              (b.website?aboutRow('fa-globe',b.website):'')+
              (ig?aboutRow('fa-brands fa-instagram','@'+ig.replace(/^@/,'')):'')+
              (fb?aboutRow('fa-brands fa-facebook',fb):'')+
              (wa?aboutRow('fa-brands fa-whatsapp',wa):'')+
              (tk?aboutRow('fa-brands fa-tiktok','@'+tk.replace(/^@/,'')):'')+
              (li?aboutRow('fa-brands fa-linkedin',li):'')+
              (!hasContact?'<p class="gh-muted" style="font-size:.85rem;margin:0">No contact info added yet.</p>':'')+
            '</div>'+
          '</div>'+
          (!isOnlineBusiness(b)&&(b.city||b.address)?
            '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>Location</h3></div><div class="gh-about-list">'+
              aboutRow('fa-location-dot',b.address?b.address+', '+b.city:b.city)+
              (_mapsUrl?'<a href="'+esc(_mapsUrl)+'" target="_blank" rel="noopener" class="gh-btn sm ghost" style="margin-top:8px"><i class="fas fa-map-location-dot"></i> Directions</a>':'')+
              (!_placeCoords&&!isOnlineBusiness(b)?'<p style="margin:8px 0 0;font-size:.78rem;color:#f59e0b"><i class="fas fa-triangle-exclamation"></i> GPS coordinates not set — check-in distance verification unavailable</p>':'')+
            '</div></div>':'')+
          (isOnlineBusiness(b)?'<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>Service Area</h3></div>'+aboutRow('fa-globe',b.serviceAreaText||businessAreaLabel(b))+'</div>':'')+
        '</div>'+
        '<div style="display:grid;gap:12px">'+
          '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>Working Hours</h3></div>'+hoursHtml+'</div>'+
          ((b.priceRange||b.startingPrice)?
            '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>Pricing</h3></div><div class="gh-about-list">'+
              (b.priceRange?aboutRow('fa-tag','Range: '+b.priceRange):'')+
              (b.startingPrice?aboutRow('fa-tag','Starting from: '+b.startingPrice):'')+
            '</div></div>':'')+
          '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>Details</h3></div><div class="gh-about-list">'+
            aboutRow('fa-store',b.category||'Business')+
            aboutRow(isOnlineBusiness(b)?'fa-globe':'fa-location-dot',isOnlineBusiness(b)?'Online service':'Physical business')+
            (b.plan&&b.plan!=='free'?aboutRow('fa-crown','Pro plan'):aboutRow('fa-circle-check','Free listing'))+
          '</div></div>'+
        '</div>'+
      '</div>'+
      '<div id="ghBizTeamSection" style="margin-top:16px"></div>';
    loadPublicTeam(b);
    checkInviteBanner(b);
  }

  function loadPublicTeam(b){
    var el=$('#ghBizTeamSection'); if(!el) return;
    loadBizStaff(b.id,function(staff){
      if(!staff.length){return;}
      el.innerHTML='<div class="gh-card" style="margin-bottom:0">'+
        '<div class="gh-biz-sec-head"><h3>Team</h3></div>'+
        '<div class="gh-team-grid">'+
        staff.map(function(s){
          return '<div class="gh-team-card">'+
            '<div class="gh-team-avatar">'+esc(initials(s.displayName||s.email||'?'))+'</div>'+
            '<div class="gh-team-name">'+esc(s.displayName||s.email||'Team member')+'</div>'+
            (s.roleTitle?'<div class="gh-team-role">'+esc(s.roleTitle)+'</div>':'')+
            (s.employmentType?'<div class="gh-team-type">'+esc(empTypeLabel(s.employmentType))+'</div>':'')+
          '</div>';
        }).join('')+
        '</div></div>';
    },true);
  }

  function checkInviteBanner(b){
    var u=authUser(); if(!u||!u.email||!fs()||!db()) return;
    var el=$('#ghBizInviteBanner'); if(!el) return;
    var email=(u.email||'').toLowerCase().trim();
    fs().getDocs(fs().query(
      fs().collection(db(),'businesses',b.id,'invites'),
      fs().where('invitedEmail','==',email),
      fs().where('status','==','pending')
    )).then(function(snap){
      if(snap.empty) return;
      var inv=Object.assign({id:snap.docs[0].id},snap.docs[0].data());
      el.innerHTML=
        '<div class="gh-invite-banner">'+
          '<div class="gh-invite-banner-title"><i class="fas fa-envelope-open-text"></i> You have a pending job invitation</div>'+
          '<div class="gh-invite-banner-meta">'+
            '<strong>'+esc(b.title||b.name||'This business')+'</strong> invited you'+
            (inv.roleTitle?' as <strong>'+esc(inv.roleTitle)+'</strong>':'')+
            (inv.employmentType?' ('+esc(empTypeLabel(inv.employmentType))+')':'')+'.'+
          '</div>'+
          (inv.message?'<div class="gh-invite-banner-msg">&#8220;'+esc(inv.message)+'&#8221;</div>':'')+
          '<div class="gh-invite-banner-actions">'+
            '<button class="gh-btn" id="ghAcceptInvite"><i class="fas fa-check"></i> Accept</button>'+
            '<button class="gh-btn ghost" id="ghDeclineInvite"><i class="fas fa-xmark"></i> Decline</button>'+
          '</div>'+
        '</div>';
      $('#ghAcceptInvite').onclick=function(){acceptEmpInvite(b,inv);};
      $('#ghDeclineInvite').onclick=function(){if(confirm('Decline this invitation?'))declineEmpInvite(b,inv.id);};
    }).catch(function(){});
  }

  /* ── Review helpers ── */
  function normReviewFull(d, id){
    var base=(window.GH&&window.GH.normReview)?window.GH.normReview(d,id):{id:id||d.id||'',businessId:d.businessId||'',userId:d.userId||'',userName:d.userName||'User',avatarUrl:d.userAvatarUrl||d.userPhoto||d.avatar||'',rating:Number(d.rating)||0,text:d.text||d.comment||'',status:d.status||'active',helpful:Number(d.helpful)||0,reported:!!d.reported,createdAt:d.createdAt||null};
    return Object.assign(base,{editedAt:d.editedAt||null,ownerReply:d.ownerReply||null,reportCount:Number(d.reportCount)||0,hidden:!!d.hidden,moderationStatus:d.moderationStatus||'active',verifiedInteraction:!!d.verifiedInteraction,helpfulCount:Number(d.helpfulCount||d.helpful)||0});
  }

  function ratingDistHtml(reviews){
    var counts=[0,0,0,0,0];
    reviews.forEach(function(r){var v=Math.round(Number(r.rating)||0);if(v>=1&&v<=5)counts[v-1]++;});
    var max=Math.max.apply(null,counts)||1;
    var out='<div class="gh-rv-dist">';
    for(var s=5;s>=1;s--){var c=counts[s-1];var pct=Math.round((c/max)*100);out+='<div class="gh-rv-dist-row"><span class="gh-rv-dist-label">'+s+'<i class="fas fa-star"></i></span><div class="gh-rv-dist-bar"><div class="gh-rv-dist-fill" style="width:'+pct+'%"></div></div><span class="gh-rv-dist-count">'+c+'</span></div>';}
    return out+'</div>';
  }

  function reviewWriteFormHtml(rating){
    var r=rating||state.reviewWriteRating||5;
    return '<div class="gh-rv-write-form">'+
      '<div class="gh-rv-write-label">Your rating</div>'+
      '<div class="gh-rv-stars-row" id="ghReviewStars">'+[1,2,3,4,5].map(function(i){return '<button type="button" class="gh-rv-star-btn'+(i<=r?' active':'')+'" data-star="'+i+'">★</button>';}).join('')+'</div>'+
      '<textarea class="gh-textarea" id="ghReviewText" placeholder="Describe your experience…" rows="3"></textarea>'+
      '<div class="gh-rv-write-actions"><button class="gh-btn" id="ghSubmitReview"><i class="fas fa-star"></i> Submit review</button></div>'+
    '</div>';
  }

  function reviewCardHtml(r, isOwner, currentUid){
    if(r.hidden&&!isOwner) return '';
    var isAuthor=!!(currentUid&&currentUid===r.userId);
    var name=r.userName||'User';
    var avHtml=r.avatarUrl?img(r.avatarUrl,name):esc(initials(name));
    var rating=Number(r.rating||0);
    var edited=r.editedAt?'<span class="gh-rv-edited">· edited</span>':'';
    var verified=r.verifiedInteraction?'<span class="gh-rv-verified" title="Verified interaction"><i class="fas fa-circle-check"></i></span>':'';
    var replyHtml='';
    if(r.ownerReply&&r.ownerReply.text){
      var rp=r.ownerReply;
      replyHtml='<div class="gh-rv-reply">'+
        '<div class="gh-rv-reply-head">'+
          '<span class="gh-rv-reply-label"><i class="fas fa-reply"></i> Owner reply</span>'+
          '<span class="gh-rv-reply-time">'+timeAgo(rp.createdAt)+(rp.editedAt?'<span class="gh-rv-edited"> · edited</span>':'')+'</span>'+
          (isOwner?'<div class="gh-rv-reply-actions">'+
            '<button class="gh-btn xs ghost" data-edit-reply="'+esc(r.id)+'" title="Edit reply"><i class="fas fa-pen"></i></button>'+
            '<button class="gh-btn xs ghost" data-delete-reply="'+esc(r.id)+'" title="Delete reply"><i class="fas fa-trash"></i></button>'+
          '</div>':'')+
        '</div>'+
        '<p class="gh-rv-reply-text">'+esc(rp.text)+'</p>'+
      '</div>';
    }
    var ownActions=isAuthor?
      '<div class="gh-rv-own-actions">'+
        '<button class="gh-btn xs ghost" data-edit-review="'+esc(r.id)+'" data-review-rating="'+rating+'" data-review-text="'+esc(r.text||'')+'" title="Edit"><i class="fas fa-pen"></i> Edit</button>'+
        '<button class="gh-btn xs ghost danger" data-delete-review="'+esc(r.id)+'" data-review-rating="'+rating+'" title="Delete"><i class="fas fa-trash"></i> Delete</button>'+
      '</div>':'';
    var ownerReplyBtn=(isOwner&&!isAuthor&&!r.ownerReply)?
      '<button class="gh-btn xs ghost" data-reply-review="'+esc(r.id)+'" title="Reply"><i class="fas fa-reply"></i> Reply</button>':'';
    var reportBtn=(!isAuthor&&currentUid)?
      '<button class="gh-btn xs ghost" data-report-review="'+esc(r.id)+'" title="Report"><i class="fas fa-flag"></i></button>':'';
    return '<div class="gh-rv-card'+(r.hidden?' gh-rv-hidden':'')+(r.moderationStatus==='flagged'?' gh-rv-flagged':'')+'" data-review-id="'+esc(r.id)+'">'+
      '<div class="gh-rv-head">'+
        userProfileAnchor(r.userId,'gh-avatar gh-profile-avatar-link',avHtml,'Open '+name)+
        '<div class="gh-rv-user-info">'+
          '<div class="gh-rv-user-row">'+
            '<strong>'+userProfileAnchor(r.userId,'gh-profile-name-link',esc(name),'Open '+name)+'</strong>'+
            verified+
            (r.hidden?'<span class="gh-rv-badge hidden">hidden</span>':'')+
            (r.moderationStatus==='flagged'?'<span class="gh-rv-badge flagged">flagged</span>':'')+
          '</div>'+
          '<div class="gh-rv-meta">'+
            '<span class="gh-rv-stars">'+starsHtml(rating)+'</span>'+
            '<span class="gh-rv-rating-num">'+rating.toFixed(1)+'</span>'+
            '<span class="gh-rv-time">'+timeAgo(r.createdAt)+edited+'</span>'+
          '</div>'+
        '</div>'+
      '</div>'+
      (r.text?'<p class="gh-rv-text">'+esc(r.text)+'</p>':'')+
      replyHtml+
      '<div class="gh-rv-footer">'+ownActions+'<div class="gh-rv-footer-right">'+ownerReplyBtn+reportBtn+'</div></div>'+
    '</div>';
  }

  function renderBusinessReviews(b){
    var box=$('#ghBusinessTabContent'); if(!box)return;
    var u=authUser(); var currentUid=u?u.uid:'';
    var isOwner=!!(u&&(b.ownerId===u.uid||b.createdBy===u.uid||b.userId===u.uid));
    var cachedReviews=[]; state.reviewSort=state.reviewSort||'newest'; state.reviewWriteRating=5;

    function sortedReviews(arr){
      var out=arr.slice();
      if(state.reviewSort==='highest') out.sort(function(a,b){return (Number(b.rating)||0)-(Number(a.rating)||0)||ts(b.createdAt)-ts(a.createdAt);});
      else if(state.reviewSort==='lowest') out.sort(function(a,b){return (Number(a.rating)||0)-(Number(b.rating)||0)||ts(b.createdAt)-ts(a.createdAt);});
      else out.sort(function(a,b){return ts(b.createdAt)-ts(a.createdAt);});
      return out;
    }

    function wireWriteForm(){
      var stars=$('#ghReviewStars'); var submit=$('#ghSubmitReview');
      if(stars) stars.onclick=function(e){var s=e.target.closest('[data-star]');if(!s)return;state.reviewWriteRating=Number(s.dataset.star);$all('#ghReviewStars [data-star]').forEach(function(x){x.classList.toggle('active',Number(x.dataset.star)<=state.reviewWriteRating);});};
      if(submit) submit.onclick=function(){createBusinessReview(b.id,state.reviewWriteRating||5,($('#ghReviewText')||{}).value||'');};
    }

    function renderList(reviews){
      $all('[data-rv-sort]').forEach(function(x){x.classList.toggle('active',x.dataset.rvSort===state.reviewSort);});
      var userReview=currentUid?reviews.find(function(r){return r.userId===currentUid;}):null;
      var formWrap=$('#ghRvFormWrap');
      if(formWrap){
        if(userReview){
          formWrap.innerHTML='<div class="gh-rv-already"><i class="fas fa-check-circle"></i> You reviewed this business.'+
            '<div class="gh-rv-already-actions">'+
            '<button class="gh-btn xs ghost" data-edit-review="'+esc(userReview.id)+'" data-review-rating="'+Number(userReview.rating||0)+'" data-review-text="'+esc(userReview.text||'')+'"><i class="fas fa-pen"></i> Edit</button>'+
            '<button class="gh-btn xs ghost danger" data-delete-review="'+esc(userReview.id)+'" data-review-rating="'+Number(userReview.rating||0)+'"><i class="fas fa-trash"></i> Delete</button>'+
            '</div></div>';
        } else {
          formWrap.innerHTML=reviewWriteFormHtml(state.reviewWriteRating);
          wireWriteForm();
        }
      }
      var summaryEl=$('#ghRvSummary');
      if(summaryEl&&reviews.length>0){
        var total=reviews.reduce(function(acc,r){return acc+(Number(r.rating)||0);},0);
        var avg=(total/reviews.length).toFixed(1);
        var cnt=reviews.length;
        summaryEl.innerHTML='<div class="gh-rv-summary-inner">'+
          '<div class="gh-rv-summary-score">'+
            '<div class="gh-rv-big-score">'+avg+'</div>'+
            '<div class="gh-rv-summary-stars">'+starsHtml(parseFloat(avg))+'</div>'+
            '<div class="gh-rv-summary-count">'+cnt+' review'+(cnt!==1?'s':'')+'</div>'+
          '</div>'+ratingDistHtml(reviews)+'</div>';
        summaryEl.style.display='';
      }
      var listEl=$('#ghRvList'); if(!listEl)return;
      var sorted=sortedReviews(reviews);
      if(!sorted.length){
        listEl.innerHTML=isOwner?
          '<div class="gh-empty"><i class="fas fa-star"></i><h3>No reviews yet</h3><p>Reviews will appear here when customers leave feedback.</p></div>':
          '<div class="gh-empty"><i class="fas fa-star"></i><h3>No reviews yet</h3><p>Be the first to review this business.</p></div>';
        return;
      }
      listEl.innerHTML=sorted.map(function(r){return reviewCardHtml(r,isOwner,currentUid);}).join('');
    }

    var ratingAvg=b.ratingCount>0?(b.ratingTotal/b.ratingCount).toFixed(1):(b.ratingAverage>0?Number(b.ratingAverage).toFixed(1):null);
    var cnt=Number(b.ratingCount||b.reviewCount||0);
    box.innerHTML='<div style="display:grid;gap:14px">'+
      '<div class="gh-card gh-rv-summary-card" style="margin-bottom:0'+(ratingAvg?'':'display:none')+'" id="ghRvSummary">'+
        (ratingAvg?'<div class="gh-rv-summary-inner"><div class="gh-rv-summary-score"><div class="gh-rv-big-score">'+ratingAvg+'</div><div class="gh-rv-summary-stars">'+starsHtml(parseFloat(ratingAvg))+'</div><div class="gh-rv-summary-count">'+cnt+' review'+(cnt!==1?'s':'')+'</div></div><div class="gh-rv-dist-placeholder"><i class="fas fa-circle-notch fa-spin gh-muted"></i></div></div>':'')+'</div>'+
      (!isOwner?'<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>Write a Review</h3></div><div id="ghRvFormWrap">'+reviewWriteFormHtml(5)+'</div></div>':'')+
      '<div class="gh-card" style="margin-bottom:0">'+
        '<div class="gh-biz-sec-head"><h3>Reviews</h3><div class="gh-rv-sort-row">'+
          ['newest','highest','lowest'].map(function(s){return '<button class="gh-rv-sort-chip'+(state.reviewSort===s?' active':'')+'" data-rv-sort="'+s+'">'+s.charAt(0).toUpperCase()+s.slice(1)+'</button>';}).join('')+
        '</div></div>'+
        '<div id="ghRvList"><div class="gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+
      '</div>'+
    '</div>';

    if(!isOwner) wireWriteForm();

    box.onclick=function(e){
      var sortChip=e.target.closest('[data-rv-sort]'); if(sortChip){state.reviewSort=sortChip.dataset.rvSort;renderList(cachedReviews);return;}
      var editBtn=e.target.closest('[data-edit-review]'); if(editBtn){openEditReviewModal(b,editBtn.dataset.editReview,Number(editBtn.dataset.reviewRating||0),editBtn.dataset.reviewText||'');return;}
      var delBtn=e.target.closest('[data-delete-review]'); if(delBtn){deleteBusinessReview(delBtn.dataset.deleteReview,b.id,Number(delBtn.dataset.reviewRating||0));return;}
      var replyBtn=e.target.closest('[data-reply-review]'); if(replyBtn){openOwnerReplyModal(replyBtn.dataset.replyReview,false,'');return;}
      var editReply=e.target.closest('[data-edit-reply]'); if(editReply){var rv=cachedReviews.find(function(r){return r.id===editReply.dataset.editReply;});openOwnerReplyModal(editReply.dataset.editReply,true,rv&&rv.ownerReply&&rv.ownerReply.text||'');return;}
      var delReply=e.target.closest('[data-delete-reply]'); if(delReply){deleteOwnerReply(delReply.dataset.deleteReply);return;}
      var repBtn=e.target.closest('[data-report-review]'); if(repBtn){if(!requireLogin())return;openReportReviewModal(repBtn.dataset.reportReview,b.id);return;}
    };

    listenBusinessReviews(b.id,function(items){
      cachedReviews=items.map(function(d){return normReviewFull(d,d.id);});
      renderList(cachedReviews);
    });
  }

  function createBusinessReview(businessId, rating, textVal){
    if(!requireLogin()) return;
    var u=currentUserInfo(); var textClean=(textVal||'').trim();
    if(!textClean) return toast('Write a review first','error');
    if(rating<1||rating>5) return toast('Select a star rating','error');
    var schema=window.GH||{};
    var now=fs().serverTimestamp();
    var doc=schema.newBusinessReview?schema.newBusinessReview(businessId,u.uid,u.name,u.avatar,rating,textClean,now):{businessId:businessId,userId:u.uid,userName:u.name,userAvatarUrl:u.avatar,rating:rating,text:textClean,status:'active',helpful:0,reported:false,createdAt:now,updatedAt:now};
    Object.assign(doc,{editedAt:null,ownerReply:null,reportCount:0,hidden:false,moderationStatus:'active',verifiedInteraction:false,helpfulCount:0});
    fs().addDoc(fs().collection(db(),'businessReviews'),doc)
      .then(function(){return fs().updateDoc(fs().doc(db(),'businesses',businessId),{reviewCount:fs().increment(1),ratingTotal:fs().increment(rating),ratingCount:fs().increment(1)}).catch(function(){});})
      .then(function(){if(GS().awardPoints)GS().awardPoints(25,'Write business review','business',businessId);toast('Review submitted');state.reviewWriteRating=5;})
      .catch(function(err){toast('Review failed: '+(err.code||err.message),'error');});
  }

  function openEditReviewModal(b, reviewId, oldRating, oldText){
    if(!requireLogin()) return;
    state.editStarRating=oldRating||5;
    var body='<div class="gh-rv-write-form">'+
      '<div class="gh-rv-write-label">Your rating</div>'+
      '<div class="gh-rv-stars-row" id="ghEditStars">'+[1,2,3,4,5].map(function(i){return '<button type="button" class="gh-rv-star-btn'+(i<=state.editStarRating?' active':'')+'" data-star="'+i+'">★</button>';}).join('')+'</div>'+
      '<textarea class="gh-textarea" id="ghEditText" rows="3">'+esc(oldText)+'</textarea>'+
    '</div>';
    modal('Edit Your Review',body,'<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSaveEditReview">Save changes</button>','ghEditReviewModal');
    setTimeout(function(){
      var stars=$('#ghEditStars'); var save=$('#ghSaveEditReview');
      if(stars) stars.onclick=function(e){var s=e.target.closest('[data-star]');if(!s)return;state.editStarRating=Number(s.dataset.star);$all('#ghEditStars [data-star]').forEach(function(x){x.classList.toggle('active',Number(x.dataset.star)<=state.editStarRating);});};
      if(save) save.onclick=function(){editBusinessReview(reviewId,b.id,oldRating,state.editStarRating,($('#ghEditText')||{}).value||'');};
    },80);
  }

  function editBusinessReview(reviewId, bizId, oldRating, newRating, newText){
    var textClean=(newText||'').trim(); if(!textClean) return toast('Review text is required','error');
    fs().updateDoc(fs().doc(db(),'businessReviews',reviewId),{rating:newRating,text:textClean,editedAt:fs().serverTimestamp(),updatedAt:fs().serverTimestamp()})
      .then(function(){var diff=newRating-oldRating;if(diff!==0)return fs().updateDoc(fs().doc(db(),'businesses',bizId),{ratingTotal:fs().increment(diff)}).catch(function(){});})
      .then(function(){var m=document.getElementById('ghEditReviewModal');if(m)m.remove();toast('Review updated');})
      .catch(function(err){toast('Update failed: '+(err.code||err.message),'error');});
  }

  function deleteBusinessReview(reviewId, bizId, oldRating){
    if(!confirm('Delete your review? This cannot be undone.')) return;
    fs().deleteDoc(fs().doc(db(),'businessReviews',reviewId))
      .then(function(){return fs().updateDoc(fs().doc(db(),'businesses',bizId),{reviewCount:fs().increment(-1),ratingTotal:fs().increment(-oldRating),ratingCount:fs().increment(-1)}).catch(function(){});})
      .then(function(){toast('Review deleted');})
      .catch(function(err){toast('Delete failed: '+(err.code||err.message),'error');});
  }

  function openOwnerReplyModal(reviewId, isEdit, existingText){
    if(!requireLogin()) return;
    var body='<textarea class="gh-textarea" id="ghReplyText" rows="3" placeholder="Write your reply…">'+esc(existingText||'')+'</textarea>';
    modal(isEdit?'Edit Reply':'Reply to Review',body,'<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitReply">'+(isEdit?'Save changes':'Post reply')+'</button>','ghOwnerReplyModal');
    setTimeout(function(){
      var submit=$('#ghSubmitReply'); if(!submit)return;
      submit.onclick=function(){submitOwnerReply(reviewId,($('#ghReplyText')||{}).value||'',isEdit);};
    },80);
  }

  function submitOwnerReply(reviewId, replyText, isEdit){
    var textClean=(replyText||'').trim(); if(!textClean) return toast('Write a reply first','error');
    var u=currentUserInfo();
    var replyObj={text:textClean,authorId:u.uid,authorName:u.name};
    if(isEdit){replyObj.editedAt=fs().serverTimestamp();}
    else{replyObj.createdAt=fs().serverTimestamp();}
    fs().updateDoc(fs().doc(db(),'businessReviews',reviewId),{ownerReply:replyObj})
      .then(function(){var m=document.getElementById('ghOwnerReplyModal');if(m)m.remove();toast(isEdit?'Reply updated':'Reply posted');})
      .catch(function(err){toast('Failed: '+(err.code||err.message),'error');});
  }

  function deleteOwnerReply(reviewId){
    if(!confirm('Delete your reply?')) return;
    fs().updateDoc(fs().doc(db(),'businessReviews',reviewId),{ownerReply:null})
      .then(function(){toast('Reply deleted');})
      .catch(function(err){toast('Failed: '+(err.code||err.message),'error');});
  }

  function openReportReviewModal(reviewId, bizId){
    var reasons=['spam','fake','abuse','scam','other'];
    var body='<p class="gh-muted" style="margin:0 0 12px;font-size:.87rem">Why are you reporting this review?</p>'+
      '<div style="display:grid;gap:6px">'+reasons.map(function(r,i){return '<label class="gh-rv-report-option"><input type="radio" name="ghRvReportReason" value="'+r+'"'+(i===0?' checked':'')+'>'+r.charAt(0).toUpperCase()+r.slice(1)+'</label>';}).join('')+'</div>'+
      '<textarea class="gh-textarea" id="ghReportDetails" placeholder="Additional details (optional)" style="margin-top:12px" rows="2"></textarea>';
    modal('Report Review',body,'<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn danger" id="ghSubmitRvReport">Report</button>','ghReportReviewModal');
    setTimeout(function(){
      var submit=$('#ghSubmitRvReport'); if(!submit)return;
      submit.onclick=function(){
        var reason=(document.querySelector('input[name="ghRvReportReason"]:checked')||{}).value||'other';
        var details=($('#ghReportDetails')||{}).value||'';
        submitReviewReport(reviewId,bizId,reason,details);
      };
    },80);
  }

  function submitReviewReport(reviewId, bizId, reason, details){
    var u=currentUserInfo(); var schema=window.GH||{};
    var reportDoc=schema.newReport?schema.newReport(u.uid,'review',reviewId,reason,details,fs().serverTimestamp()):{reporterId:u.uid,targetType:'review',targetId:reviewId,reason:reason,details:details,status:'pending',reviewedBy:null,reviewedAt:null,createdAt:fs().serverTimestamp()};
    fs().addDoc(fs().collection(db(),'reports'),reportDoc)
      .then(function(){return fs().updateDoc(fs().doc(db(),'businessReviews',reviewId),{reportCount:fs().increment(1),reported:true}).catch(function(){});})
      .then(function(){var m=document.getElementById('ghReportReviewModal');if(m)m.remove();toast('Report submitted — thank you');})
      .catch(function(err){toast('Report failed: '+(err.code||err.message),'error');});
  }

  function listenBusinessReviews(businessId, cb){ var q=fs().query(fs().collection(db(),'businessReviews'), fs().where('businessId','==',businessId), fs().limit(50)); var _u=fs().onSnapshot(q,function(snap){ var arr=[]; snap.forEach(function(d){arr.push(Object.assign({id:d.id},d.data()));}); arr.sort(function(a,b){return ts(b.createdAt)-ts(a.createdAt);}); cb(arr); },function(){cb([]); }); state.pageUnsubs.push(_u); }

  function updateBusinessFollowButton(businessId){
    var btn=document.querySelector('[data-follow-business="'+businessId+'"]');
    if(!btn) return;
    var user=authUser();
    if(!user){ btn.classList.remove('is-following'); btn.innerHTML='<i class="fas fa-plus"></i> Follow'; return; }
    if(!fs() || !db()){ btn.innerHTML='<i class="fas fa-plus"></i> Follow'; return; }
    var id=businessId+'_'+user.uid;
    fs().getDoc(fs().doc(db(),'businessFollowers',id)).then(function(d){
      if(d.exists()){
        btn.classList.add('is-following');
        btn.innerHTML='<i class="fas fa-check"></i> Following';
        btn.title='Click to unfollow';
      }else{
        btn.classList.remove('is-following');
        btn.innerHTML='<i class="fas fa-plus"></i> Follow';
        btn.title='Follow this business';
      }
    }).catch(function(){
      btn.classList.remove('is-following');
      btn.innerHTML='<i class="fas fa-plus"></i> Follow';
    });
  }

  function followBusiness(businessId){
    if(!requireLogin()) return; var uid=authUser().uid; var id=businessId+'_'+uid; var ref=fs().doc(db(),'businessFollowers',id); var biz=fs().doc(db(),'businesses',businessId);
    var btn=document.querySelector('[data-follow-business="'+businessId+'"]');
    if(btn){ btn.disabled=true; btn.classList.add('is-loading'); }
    return fs().getDoc(ref).then(function(d){
      if(d.exists()){
        return fs().deleteDoc(ref)
          .then(function(){ return fs().updateDoc(biz,{followerCount:fs().increment(-1)}).catch(function(){}); })
          .then(function(){bizTrack(businessId,'unfollows');toast('Unfollowed');});
      }
      return fs().setDoc(ref,{businessId:businessId,userId:uid,createdAt:fs().serverTimestamp()})
        .then(function(){return fs().updateDoc(biz,{followerCount:fs().increment(1)}).catch(function(){});})
        .then(function(){bizTrack(businessId,'follows');toast('Following business');});
    }).catch(function(err){toast('Follow failed: '+(err.code||err.message),'error');})
      .finally(function(){ if(btn){ btn.disabled=false; btn.classList.remove('is-loading'); } updateBusinessFollowButton(businessId); });
  }

  function listenTargetPosts(type,id,cb){
    var q=fs().query(fs().collection(db(),'posts'), fs().where('targetType','==',type), fs().where('targetId','==',id), fs().limit(50));
    var _u=fs().onSnapshot(q,function(snap){ var arr=[]; snap.forEach(function(d){arr.push(Object.assign({id:d.id},d.data()));}); arr.sort(function(a,b){return ts(b.createdAt)-ts(a.createdAt);}); cb(arr); },function(err){ console.warn('listenTargetPosts',err.message); cb([]); });
    state.pageUnsubs.push(_u);
  }

  function renderGroups(){
    var id=new URLSearchParams(location.search).get('id'); if(id) return renderGroupDetail(id);
    shell({ active:'groups', center:'<div class="gh-card"><div class="gh-section-title"><div><h1>Groups</h1><p class="gh-muted" style="margin:.25rem 0 0">Facebook-style communities with GeoHub design.</p></div><button class="gh-btn" id="ghOpenGroupCreate"><i class="fas fa-plus"></i>Create Group</button></div><input class="gh-input" id="ghGroupSearch" placeholder="Search groups…"><div style="height:12px"></div><div class="gh-pill-row"><button class="gh-pill active" data-group-tab="discover">Discover</button><button class="gh-pill" data-group-tab="mine">Your groups</button><button class="gh-pill" data-group-tab="requests">Requests</button></div></div><div id="ghGroupsList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>' });
    var groups=[], myGroups=[], requests={}; state.groupTab='discover';
    function paint(){ var q=($('#ghGroupSearch').value||'').toLowerCase(); var arr=state.groupTab==='mine'?myGroups:groups; if(state.groupTab==='requests'){ var ids=Object.keys(requests||{}); arr=groups.filter(function(g){return ids.indexOf(g.id)>-1;}); } arr=arr.filter(function(g){ return !q || JSON.stringify(g).toLowerCase().includes(q); }); var list=$('#ghGroupsList'); if(!arr.length){ list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-users"></i><h3>No groups yet</h3><p>Create a group and start posting with members.</p><button class="gh-btn" id="ghEmptyCreateGroup">Create group</button></div>'; return; } list.innerHTML='<div class="gh-grid">'+arr.map(groupCard).join('')+'</div>'; }
    $('#ghOpenGroupCreate').onclick=openGroupCreate; $('#ghCenter').addEventListener('click', function(e){ var t=e.target.closest('[data-group-tab]'); if(t){ state.groupTab=t.dataset.groupTab; $all('[data-group-tab]').forEach(function(x){x.classList.toggle('active',x===t);}); paint(); } if(e.target.closest('#ghEmptyCreateGroup')) openGroupCreate(); var j=e.target.closest('[data-join-group]'); if(j){ var privacy=j.dataset.privacy; if(privacy==='private') GS().requestJoinGroup(j.dataset.joinGroup,function(){paint();}); else GS().toggleGroupMember(j.dataset.joinGroup,j.dataset.name,function(){paint();}); } });
    $('#ghGroupSearch').oninput=paint;
    ready(function(){ GS().listenGroups(function(items){ groups=items; paint(); }); var u=authUser(); if(u){ GS().listenMyGroups(u.uid,function(items){ myGroups=items; paint(); }); GS().getMyJoinRequests(function(map){ requests=map; paint(); }); } });
    if(location.hash==='#create') setTimeout(openGroupCreate,350);
  }

  function groupCard(g){ var title=g.name||'Untitled group'; var cover=getItemCover(g); return '<article class="gh-card gh-item-card"><div class="gh-item-media">'+itemMediaHtml(cover,title,'fa-users')+'<span class="gh-type-badge"><i class="fas fa-users"></i> '+esc(g.privacy||'public')+'</span></div><div class="gh-item-body"><h3>'+esc(title)+'</h3><p>'+esc(g.description||'Group community on GeoHub')+'</p><div class="gh-item-meta"><span class="gh-chip">'+Number(g.memberCount||0)+' members</span><span class="gh-chip">'+esc(g.category||'general')+'</span></div><div class="gh-card-actions"><a class="gh-btn sm" href="groups.html?id='+encodeURIComponent(g.id)+'">View group</a><button class="gh-btn sm ghost" data-join-group="'+esc(g.id)+'" data-name="'+esc(title)+'" data-privacy="'+esc(g.privacy||'public')+'">Join</button></div></div></article>'; }

  function openGroupCreate(){
    if(!requireLogin()) return;
    var body='<input class="gh-input" id="ghGroupName" placeholder="Group name"><div style="height:10px"></div><textarea class="gh-textarea" id="ghGroupDesc" placeholder="What is this group about?"></textarea><div style="height:10px"></div><select class="gh-select" id="ghGroupCat"><option value="general">General</option><option value="hiking">Hiking</option><option value="travel">Travel</option><option value="business">Business</option><option value="learning">Learning</option></select><div style="height:10px"></div><select class="gh-select" id="ghGroupPrivacy"><option value="public">Public</option><option value="private">Private</option></select><div style="height:10px"></div><input class="gh-input" id="ghGroupCover" placeholder="Cover image URL optional">';
    modal('Create group', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitGroup">Create</button>', 'ghGroupCreateModal');
    $('#ghSubmitGroup').onclick=function(){ GS().createGroup({ name:$('#ghGroupName').value, description:$('#ghGroupDesc').value, category:$('#ghGroupCat').value, privacy:$('#ghGroupPrivacy').value, coverUrl:$('#ghGroupCover').value.trim() }, function(id){ if(id) location.href='groups.html?id='+encodeURIComponent(id); }); };
  }

  function renderGroupDetail(id){
    shell({ active:'groups', center:'<div id="ghGroupDetail"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading group…</h3></div></div>' });
    ready(function(){ var _u=fs().onSnapshot(fs().doc(db(),'groups',id), function(snap){ if(!snap.exists()){ $('#ghGroupDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-users-slash"></i><h3>Group not found</h3></div>'; return; } paintGroupDetail(Object.assign({id:id},snap.data())); }, function(err){ $('#ghGroupDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Failed</h3><p>'+esc(err.message)+'</p></div>'; }); state.pageUnsubs.push(_u); });
  }

  function paintGroupDetail(g){
    var title=g.name||'Group'; var cover=getItemCover(g);
    $('#ghGroupDetail').innerHTML='<section class="gh-card" style="padding:0;overflow:hidden"><div class="gh-page-cover">'+(cover?img(cover,title):'')+'</div><div class="gh-page-info"><div class="gh-page-logo"><i class="fas fa-users"></i></div><div class="gh-page-title"><h1>'+esc(title)+'</h1><p>'+esc(g.privacy||'public')+' group · '+Number(g.memberCount||0)+' members · '+esc(g.category||'general')+'</p></div><div class="gh-page-actions"><button class="gh-btn" data-join-group="'+esc(g.id)+'" data-name="'+esc(title)+'" data-privacy="'+esc(g.privacy||'public')+'"><i class="fas fa-user-plus"></i> Join</button><button class="gh-btn ghost" data-share-group><i class="fas fa-share"></i> Share</button></div></div><div class="gh-tabbar"><button class="gh-tab active" data-group-detail-tab="discussion">Discussion</button><button class="gh-tab" data-group-detail-tab="about">About</button><button class="gh-tab" data-group-detail-tab="members">Members</button><button class="gh-tab" data-group-detail-tab="media">Media</button></div></section><div id="ghGroupTabContent"></div>';
    $('#ghGroupDetail').onclick=function(e){ var tab=e.target.closest('[data-group-detail-tab]'); if(tab){ state.currentGroupTab=tab.dataset.groupDetailTab; $all('[data-group-detail-tab]').forEach(function(x){x.classList.toggle('active',x===tab);}); renderGroupTab(g); } var j=e.target.closest('[data-join-group]'); if(j){ if((g.privacy||'public')==='private') GS().requestJoinGroup(g.id); else GS().toggleGroupMember(g.id,title); } var sh=e.target.closest('[data-share-group]'); if(sh && navigator.clipboard) navigator.clipboard.writeText(location.href).then(function(){toast('Group link copied');}); };
    renderGroupTab(g);
  }

  function renderGroupTab(g){
    var box=$('#ghGroupTabContent'); var tab=state.currentGroupTab||'discussion';
    if(tab==='about'){ box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>About this group</h2></div><div class="gh-about-list">'+aboutRow('fa-align-left',g.description||'No description')+aboutRow('fa-lock',g.privacy||'public')+aboutRow('fa-tag',g.category||'general')+aboutRow('fa-users',Number(g.memberCount||0)+' members')+'</div></div>'; return; }
    if(tab==='members'){ box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>Members</h2></div><div id="ghGroupMembersList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading members…</h3></div></div></div>'; if(GS().listenGroupMembers){ GS().listenGroupMembers(g.id,function(items){ var list=$('#ghGroupMembersList'); if(!list)return; if(!items.length){ list.innerHTML='<div class="gh-empty"><i class="fas fa-users"></i><h3>No members yet</h3></div>'; return; } list.innerHTML='<div class="gh-friend-grid">'+items.map(function(m){ var u=m.profile||{}; var name=u.fullName||u.displayName||u.name||m.userName||'GeoHub User'; var avatar=u.avatar||u.photoURL||''; var uid=u.uid||u.id||m.userId||m.uid||''; return '<a class="gh-friend-card" href="'+profileLink(uid)+'"><span class="gh-avatar">'+(avatar?img(avatar,name):esc(initials(name)))+'</span><div><strong>'+esc(name)+'</strong><span>'+esc(m.role||'member')+'</span></div></a>'; }).join('')+'</div>'; }); } return; }
    if(tab==='media'){ box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>Media</h2></div><div id="ghGroupMediaGrid"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading media…</h3></div></div></div>'; listenTargetPosts('group', g.id, function(items){ var media=items.filter(function(p){return p.imageUrl||p.mediaUrl||p.photoUrl;}); var grid=$('#ghGroupMediaGrid'); if(!grid)return; if(!media.length){ grid.innerHTML='<div class="gh-empty"><i class="fas fa-images"></i><h3>No media yet</h3><p>Photos from group posts will appear here.</p></div>'; return;} grid.innerHTML='<div class="gh-grid">'+media.map(function(p){var url=p.imageUrl||p.mediaUrl||p.photoUrl;return '<a class="gh-card" href="feed.html#post-'+esc(p.id)+'" style="padding:0;overflow:hidden"><img src="'+esc(url)+'" alt="media" loading="lazy" decoding="async" style="width:100%;height:180px;object-fit:cover"><div style="padding:10px;font-size:.85rem;color:var(--gh-muted)">'+esc((p.text||'').slice(0,80))+'</div></a>';}).join('')+'</div>'; }); return; }
    box.innerHTML='<section class="gh-card gh-composer"><div class="gh-composer-top"><span class="gh-avatar"><i class="fas fa-users"></i></span><button class="gh-composer-fake" data-create-group-post>Post in '+esc(g.name||'group')+'</button></div></section><div id="ghGroupPosts"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>';
    box.onclick=function(e){ if(e.target.closest('[data-create-group-post]')) openGroupPostModal(g); };
    listenTargetPosts('group', g.id, function(items){ var list=$('#ghGroupPosts'); if(!list)return; if(!items.length){ list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-newspaper"></i><h3>No group posts yet</h3><p>Start the discussion.</p></div>'; return; } list.innerHTML=items.map(function(p){ p.targetType='group'; p.targetId=g.id; return postCard(p); }).join(''); bindPostInteractions(list); items.forEach(function(p){hydrateReactionState(p.id);}); });
  }

  function openGroupPostModal(g){ if(!requireLogin())return; var body='<textarea class="gh-textarea" id="ghGroupPostText" placeholder="Write something to the group…"></textarea><div style="height:10px"></div><input class="gh-input" id="ghGroupPostImg" placeholder="Image URL optional">'; modal('Post in '+(g.name||'group'), body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitGroupPost">Post</button>', 'ghGroupPostModal'); $('#ghSubmitGroupPost').onclick=function(){ GS().createPost($('#ghGroupPostText').value,$('#ghGroupPostImg').value.trim(),function(){ var m=$('#ghGroupPostModal'); if(m)m.remove(); }, { targetType:'group', targetId:g.id, groupId:g.id }); }; }

  function patchAddBusinessPage(){
    // Keep the existing wizard UI. add-business.js owns the full Firestore submit logic.
    // This fallback supports both physical and online/nationwide businesses if add-business.js fails.
    if (typeof window.submitForm === 'function') return;
    window.submitForm = function(){
      ready(function(){
        if(!requireLogin()) return;
        var user=authUser(), f=fs();
        var name=text($('#bizNameInput') && $('#bizNameInput').value,'');
        var city=text($('#citySelect') && $('#citySelect').value,'');
        var typeSel=$('.business-type-option.selected');
        var businessType=typeSel && typeSel.dataset.businessType || 'physical';
        var serviceArea=$('#serviceAreaSelect') && $('#serviceAreaSelect').value || 'georgia';
        var serviceAreaText=businessType==='online' ? (serviceArea==='worldwide'?'Worldwide / Remote':serviceArea==='regions'?'Selected Georgian regions':serviceArea==='tbilisi'?'Tbilisi only':serviceArea==='batumi'?'Batumi only':'Available across Georgia') : (city?city+', Georgia':'Local business');
        var catEl=document.querySelector('.cat-option.selected');
        var category=catEl && catEl.dataset ? catEl.dataset.cat : '';
        if(!name){ toast('Business name is required','error'); return; }
        if(businessType !== 'online' && !city){ toast('City is required for physical businesses','error'); return; }
        var data={
          name:name,
          title:name,
          description:text($('#descInput') && $('#descInput').value,''),
          desc:text($('#descInput') && $('#descInput').value,''),
          city:businessType==='online'?'':city,
          businessType:businessType,
          serviceArea:businessType==='online'?serviceArea:(city||'local').toLowerCase(),
          serviceAreaText:serviceAreaText,
          isOnline:businessType==='online',
          category:category||'business',
          phone:text($('#phoneInput') && $('#phoneInput').value,''),
          email:text($('#emailInput') && $('#emailInput').value,''),
          website:text($('#websiteInput') && $('#websiteInput').value,''),
          address:businessType==='online'?'':text($('#addressInput') && $('#addressInput').value,''),
          mapsLink:businessType==='online'?'':text($('#mapsLink') && $('#mapsLink').value,''),
          logoUrl:'', coverImageUrl:'', imageUrl:'',
          ownerId:user.uid, createdBy:user.uid, userId:user.uid,
          status:'active', verified:false,
          followerCount:0, postCount:0, reviewCount:0, ratingAverage:0,
          createdAt:f.serverTimestamp(), updatedAt:f.serverTimestamp()
        };
        f.addDoc(f.collection(db(),'businesses'), data).then(function(ref){
          return f.setDoc(f.doc(db(),'businessAdmins',ref.id+'_'+user.uid), {businessId:ref.id,userId:user.uid,role:'owner',createdAt:f.serverTimestamp()}).then(function(){return ref;});
        }).then(function(ref){ toast('Business Page created'); location.href='business.html?id='+encodeURIComponent(ref.id); }).catch(function(err){ console.error('create business',err); toast('Business create failed: '+(err.code||err.message),'error'); });
      });
    };
    setTimeout(function(){ $all('button').forEach(function(b){ if((b.textContent||'').toLowerCase().includes('submit') || (b.textContent||'').toLowerCase().includes('launch') || (b.textContent||'').toLowerCase().includes('finish')){ b.onclick=window.submitForm; } }); },500);
  }

  function enhanceGeoSocial(){
    // Extend createPost to preserve target/business/share fields by wrapping if needed.
    if(!window.GeoSocial || window.GeoSocial.__ghEnhanced) return;
    window.GeoSocial.__ghEnhanced=true;
    var original=window.GeoSocial.createPost;
    window.GeoSocial.createPost=function(textVal, mediaUrl, callback, extra){
      extra=extra||{};
      var GF=window.GeoFirebase, user=GF && GF.auth && GF.auth.currentUser;
      if(!user){ window.GeoSocial.requireAuth(); return; }
      var clean=(textVal||'').trim(); if(!clean && !mediaUrl && !extra.sharedPostId) return toast('Write something first','error');
      var me=currentUserInfo();
      var payload={
        text:clean,
        mediaUrl:mediaUrl||null,
        imageUrl:mediaUrl||null,
        visibility:extra.visibility||'public',
        mentions:extra.mentions||extractMentions(clean),
        taggedUserIds:extra.taggedUserIds||[],
        feeling:extra.feeling||'',
        targetType:extra.targetType||'user',
        targetId:extra.targetId||user.uid,
        authorType:extra.authorType||'user',
        authorId:extra.authorId||user.uid,
        userId:user.uid,
        createdByUserId:extra.createdByUserId||user.uid,
        authorName:extra.authorName||me.name,
        authorAvatar:extra.authorAvatar||me.avatar,
        sharedPostId:extra.sharedPostId||null,
        likeCount:0, reactionCount:0, commentCount:0, shareCount:0, saveCount:0,
        status:'active', createdAt:GF.fs.serverTimestamp(), updatedAt:GF.fs.serverTimestamp()
      };
      GF.fs.addDoc(GF.fs.collection(GF.db,'posts'), payload).then(function(ref){
        toast('Post published'); if(window.GeoSocial.awardPoints) window.GeoSocial.awardPoints(extra.targetType==='business'?10:20, extra.targetType==='business'?'Business page post':'Create post', 'post', ref.id); if(extra.targetType==='business' && extra.targetId) GF.fs.updateDoc(GF.fs.doc(GF.db,'businesses',extra.targetId), {postCount:GF.fs.increment(1)}).catch(function(){}); if(extra.targetType==='group' && extra.targetId) GF.fs.updateDoc(GF.fs.doc(GF.db,'groups',extra.targetId), {postCount:GF.fs.increment(1)}).catch(function(){}); if(callback) callback(ref.id);
      }).catch(function(err){ console.error('createPost enhanced',err); toast('Post failed: '+(err.code||err.message),'error'); if(callback) callback(null,err); });
    };
  }

  var NP_ICONS = {
    like:      { icon: 'fa-heart',    color: '#ef4444' },
    comment:   { icon: 'fa-comment',  color: '#3b82f6' },
    reply:     { icon: 'fa-reply',    color: '#8b5cf6' },
    follow:    { icon: 'fa-user-plus',color: '#10b981' },
    message:   { icon: 'fa-envelope', color: '#06b6d4' },
    reward:    { icon: 'fa-gift',     color: '#f59e0b' },
    badge:     { icon: 'fa-medal',    color: '#f59e0b' },
    challenge: { icon: 'fa-trophy',   color: '#f59e0b' }
  };
  var NP_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'like', label: 'Likes' },
    { key: 'comment', label: 'Comments' },
    { key: 'follow', label: 'Follows' },
    { key: 'message', label: 'Messages' },
    { key: 'reward', label: 'Rewards' }
  ];

  function npTimeAgo(ts) {
    if (!ts) return '';
    var ms = ts.toMillis ? ts.toMillis() : (ts.seconds ? ts.seconds * 1000 : 0);
    if (!ms) return '';
    var diff = Date.now() - ms;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  function npDayLabel(ts) {
    if (!ts) return 'Older';
    var ms = ts.toMillis ? ts.toMillis() : (ts.seconds ? ts.seconds * 1000 : 0);
    if (!ms) return 'Older';
    var now = Date.now(), diff = now - ms;
    var today = new Date(); today.setHours(0,0,0,0);
    var itemDate = new Date(ms); itemDate.setHours(0,0,0,0);
    if (itemDate.getTime() === today.getTime()) return 'Today';
    if (today.getTime() - itemDate.getTime() === 86400000) return 'Yesterday';
    if (diff < 7 * 86400000) return 'This week';
    return 'Older';
  }

  function renderNotifications() {
    shell({ active: 'notifications', right: '', center:
      '<div class="np-page">' +
        '<div class="np-head">' +
          '<h2><i class="fas fa-bell"></i> Notifications</h2>' +
          '<button class="np-mark-all gh-btn ghost" id="npMarkAll"><i class="fas fa-check-double"></i> Mark all read</button>' +
        '</div>' +
        '<div class="np-filters" id="npFilters">' +
          NP_FILTERS.map(function(f,i){ return '<button class="np-filter-btn'+(i===0?' active':'')+'" data-np-filter="'+f.key+'">'+f.label+'</button>'; }).join('') +
        '</div>' +
        '<div id="npList">' +
          '<div class="np-skel"></div><div class="np-skel"></div><div class="np-skel"></div>' +
          '<div class="np-skel"></div><div class="np-skel"></div>' +
        '</div>' +
      '</div>'
    });
    var npUnsub = null;
    var npFilter = 'all';
    var npItems = [];

    function npRender() {
      var box = $('#npList'); if (!box) return;
      var filtered = npFilter === 'all' ? npItems : npItems.filter(function(n){ return n.type === npFilter; });
      if (!filtered.length) {
        box.innerHTML = '<div class="np-empty"><i class="fas fa-bell"></i><h3>No notifications</h3><p>' + (npFilter === 'all' ? 'Likes, comments, follows and rewards will appear here.' : 'No ' + npFilter + ' notifications yet.') + '</p></div>';
        return;
      }
      var groups = {}, order = [];
      filtered.forEach(function(n) {
        var label = npDayLabel(n.createdAt);
        if (!groups[label]) { groups[label] = []; order.push(label); }
        groups[label].push(n);
      });
      box.innerHTML = order.map(function(label) {
        return '<div class="np-group">' +
          '<div class="np-group-label">' + esc(label) + '</div>' +
          groups[label].map(function(n) {
            var ic = NP_ICONS[n.type] || { icon: 'fa-bell', color: '#10b981' };
            return '<a class="np-item' + (!n.read ? ' unread' : '') + '" href="' + esc(n.href || '#') + '" data-np-id="' + esc(n.id) + '">' +
              '<div class="np-item-icon" style="background:' + ic.color + '22;color:' + ic.color + '"><i class="fas ' + ic.icon + '"></i></div>' +
              '<div class="np-item-body">' +
                '<div class="np-item-title">' + esc(n.title || 'GeoHub') + '</div>' +
                '<div class="np-item-sub">' + esc(n.body || n.message || '') + '</div>' +
                '<div class="np-item-time">' + npTimeAgo(n.createdAt) + '</div>' +
              '</div>' +
              (!n.read ? '<div class="np-unread-dot"></div>' : '') +
            '</a>';
          }).join('') +
        '</div>';
      }).join('');
      box.querySelectorAll('[data-np-id]').forEach(function(a) {
        a.addEventListener('click', function() {
          var id = a.dataset.npId;
          a.classList.remove('unread');
          var dot = a.querySelector('.np-unread-dot'); if (dot) dot.remove();
          if (fs()) fs().updateDoc(fs().doc(db(), 'userNotifications', id), { read: true, seen: true }).catch(function(){});
        }, { once: true });
      });
    }

    var filterBar = $('#npFilters');
    if (filterBar) {
      filterBar.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-np-filter]');
        if (!btn) return;
        npFilter = btn.dataset.npFilter;
        filterBar.querySelectorAll('.np-filter-btn').forEach(function(b){ b.classList.toggle('active', b === btn); });
        npRender();
      });
    }

    var markAllBtn = $('#npMarkAll');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', function() {
        npItems.forEach(function(n) {
          if (!n.read) {
            n.read = true;
            if (fs()) fs().updateDoc(fs().doc(db(), 'userNotifications', n.id), { read: true, seen: true }).catch(function(){});
          }
        });
        npRender();
        var badge = $('#ghNotifBadge'); if (badge) badge.textContent = '';
      });
    }

    ready(function() {
      var u = authUser(); if (!u) return;
      npUnsub = GS().listenUserNotifications(u.uid, function(items) {
        npItems = items;
        npRender();
      });
      state.pageUnsubs.push(npUnsub);
    });
  }

  function renderComingSoon(){
    var title = (PAGE || PATH.replace('.html','') || 'section').replace(/[-_]/g,' ');
    title = title.charAt(0).toUpperCase() + title.slice(1);
    shell({ active: PAGE, center: '<div class="gh-card gh-empty" style="min-height:360px"><i class="fas fa-tools"></i><h3>'+esc(title)+' is admin-controlled</h3><p>This section is not ready yet. No fake demo content is shown.</p><a class="gh-btn" href="feed.html">Back to Feed</a></div>' });
  }

  function init(){
    ready(function(){ enhanceGeoSocial(); });
    if(PAGE==='rewards' || PATH==='rewards.html') return; // geohub-points.js renders the integrated rewards app shell.
    if(PAGE==='feed' || PATH==='feed.html' || PATH==='index.html') return renderFeed();
    if(PAGE==='discover' || PATH==='explore.html') return renderDiscover();
    if(PAGE==='business' || PATH==='business.html') return renderBusinesses();
    if(PAGE==='groups' || PATH==='groups.html') return renderGroups();
    if(PAGE==='add-business' || PATH==='add-business.html') return patchAddBusinessPage();
    if(PAGE==='notifications' || PATH==='notifications.html') return renderNotifications();
    return renderComingSoon();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Clean up all Firestore listeners when navigating away to avoid runaway billing
  window.addEventListener('pagehide', function() {
    if(state.authUnsub){ try{ state.authUnsub(); }catch(e){} state.authUnsub=null; }
    if(state.safetyUnsub){ try{ state.safetyUnsub(); }catch(e){} state.safetyUnsub=null; }
    (state.badgeUnsubs||[]).forEach(function(u){ try{ if(u) u(); }catch(e){} });
    state.badgeUnsubs=[];
    Object.values(state.postsUnsubs||{}).forEach(function(u){ try{ if(u) u(); }catch(e){} });
    state.postsUnsubs={};
    Object.values(state.replyUnsubs||{}).forEach(function(u){ try{ if(u) u(); }catch(e){} });
    state.replyUnsubs={};
    (state.pageUnsubs||[]).forEach(function(u){ try{ if(u) u(); }catch(e){} });
    state.pageUnsubs=[];
  });
})();
