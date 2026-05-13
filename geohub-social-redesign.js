/* GeoHub Social Redesign v2
   Self-contained app shell for feed/discover/groups/business pages.
   Uses Firebase Auth + Firestore through window.GeoFirebase and window.GeoSocial.
*/
(function(){
  'use strict';

  var PATH = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var PAGE = document.body && document.body.dataset ? document.body.dataset.ghPage : '';
  var state = { page: PAGE, filter: 'all', postsUnsubs: {}, replyUnsubs: {}, currentBusinessTab: 'posts', currentGroupTab: 'discussion', starRating: 5, theme: 'light', authUnsub: null, badgeUnsubs: [], sidebarCollapsed: false, hiddenPostIds: [], blockedUserIds: [], safetyUnsub: null, sharedPostCache: {}, friendIds: [], followingIds: [], audienceLoaded: false };

  function applyTheme(theme){
    theme = theme === 'dark' ? 'dark' : 'light';
    state.theme = theme;
    document.documentElement.setAttribute('data-gh-theme', theme);
    document.body && document.body.setAttribute('data-gh-theme', theme);
    var btn = document.getElementById('ghThemeToggle');
    if(btn){
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
  }
  function initTheme(){
    var preferred = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    applyTheme(document.documentElement.getAttribute('data-gh-theme') || preferred);
  }

  function $(s, root){ return (root || document).querySelector(s); }
  function $all(s, root){ return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function text(v, fallback){ v = String(v == null ? '' : v).trim(); return v || fallback || ''; }
  function ts(v){ if(!v) return 0; if(typeof v.toMillis === 'function') return v.toMillis(); if(v.seconds) return v.seconds * 1000; if(v instanceof Date) return v.getTime(); if(typeof v === 'number') return v; return Date.parse(v) || 0; }
  
  function isOnlineBusiness(b){ return !!(b && (b.businessType === 'online' || b.isOnline === true)); }
  function businessAreaLabel(b){
    if(!isOnlineBusiness(b)) return b && b.city ? b.city : 'Local';
    return b.serviceAreaText || ({georgia:'Available across Georgia', worldwide:'Worldwide / Remote', tbilisi:'Tbilisi only', batumi:'Batumi only', regions:'Selected regions'}[b.serviceArea] || 'Online Service');
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
      var today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
      var h = hours[today] || hours[today.toLowerCase()] || null;
      if(h){ return h.closed ? 'Closed today' : ((h.open||'09:00')+' - '+(h.close||'18:00')+' today'); }
      return 'Working hours added';
    }
    return 'Working hours not added';
  }
function timeAgo(v){ var t=ts(v); if(!t) return 'ახლახან'; var s=Math.max(1, Math.floor((Date.now()-t)/1000)); if(s<60)return s+'s'; var m=Math.floor(s/60); if(m<60)return m+'m'; var h=Math.floor(m/60); if(h<24)return h+'h'; var d=Math.floor(h/24); if(d<30)return d+'d'; var mo=Math.floor(d/30); if(mo<12)return mo+'mo'; return Math.floor(mo/12)+'y'; }
  function initials(name){ name=text(name,'GeoHub'); return name.split(/\s+/).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase(); }
  function img(url, alt){ return url ? '<img src="'+esc(url)+'" alt="'+esc(alt||'')+'" loading="lazy" onerror="this.remove()">' : ''; }
  function readFileAsDataUrl(file){ return new Promise(function(resolve,reject){ if(!file) return resolve(''); if(!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type||'')) return reject(new Error('Use a PNG, JPG, WEBP or GIF image.')); if(file.size > 8 * 1024 * 1024) return reject(new Error('Image must be under 8 MB.')); var r=new FileReader(); r.onload=function(){ resolve(r.result||''); }; r.onerror=reject; r.readAsDataURL(file); }); }
  function triggerImagePick(cb){ var input=document.createElement('input'); input.type='file'; input.accept='image/png,image/jpeg,image/webp,image/gif'; input.style.display='none'; document.body.appendChild(input); input.onchange=function(){ var f=input.files && input.files[0]; readFileAsDataUrl(f).then(function(url){ cb(url); }).catch(function(err){ toast(err.message || 'Image could not be read','error'); }).finally(function(){ input.remove(); }); }; input.click(); }
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
    document.body.classList.add('gh-social-body');
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
    return '<header class="gh-topbar">'+
      '<a class="gh-brand" href="feed.html"><div class="gh-brand-mark">GH</div><span>Geo<span>Hub</span></span></a>'+
      '<div class="gh-top-search"><i class="fas fa-search"></i><input id="ghGlobalSearch" placeholder="Search GeoHub…"></div>'+
      '<div class="gh-top-actions">'+
        '<button class="gh-icon-btn gh-sidebar-toggle" id="ghSidebarToggle" title="Collapse sidebars"><i class="fas fa-bars-staggered"></i></button>'+
        '<a class="gh-icon-btn" href="feed.html" title="Home"><i class="fas fa-house"></i></a>'+
        '<a class="gh-icon-btn" href="explore.html" title="Discover"><i class="fas fa-compass"></i></a>'+
        '<button class="gh-create-btn" id="ghCreateBtn"><i class="fas fa-plus"></i><span>Create</span></button>'+
        '<button class="gh-icon-btn gh-theme-toggle" id="ghThemeToggle" title="Toggle light/dark mode"><i class="fas fa-moon"></i></button>'+
        '<a class="gh-icon-btn" href="messages.html" title="Messages"><i class="fas fa-comment-dots"></i><b class="gh-badge-count" id="ghMsgBadge"></b></a>'+
        '<button class="gh-icon-btn" id="ghNotifBtn" title="Notifications"><i class="fas fa-bell"></i><b class="gh-badge-count" id="ghNotifBadge"></b></button>'+
        '<a class="gh-user-btn" href="auth.html"><span class="gh-avatar" id="ghTopAvatar">GH</span><span id="ghTopName">Sign in</span></a>'+
      '</div></header>';
  }

  function leftNav(active){
    var items=[
      ['feed','feed.html','fa-house','Home'],['discover','explore.html','fa-compass','Discover'],['groups','groups.html','fa-users','Groups'],['business','business.html','fa-store','Businesses'],['places','places.html','fa-map-marker-alt','Places'],['events','events.html','fa-calendar','Events'],['services','services.html','fa-briefcase','Services'],['learning','learning.html','fa-graduation-cap','Learning'],['rewards','rewards.html','fa-gift','Rewards'],['challenges','challenges.html','fa-trophy','Challenges'],['messages','messages.html','fa-comment-dots','Messages'],['profile','auth.html','fa-user','Profile'],['saved','auth.html','fa-bookmark','Saved']
    ];
    return '<aside class="gh-left"><nav class="gh-panel">'+items.map(function(it){return '<a class="gh-nav-item '+(active===it[0]?'active':'')+'" href="'+it[1]+'"><i class="fas '+it[2]+'"></i><span>'+it[3]+'</span></a>';}).join('')+'</nav></aside>';
  }

  function rightRail(extra){
    return '<aside class="gh-right" id="ghRightRail">'+(extra || defaultRight())+'</aside>';
  }

  function defaultRight(){
    return '<div class="gh-panel gh-right-widget gh-happening"><div class="gh-section-title"><h3>What’s happening</h3><a class="gh-small" href="explore.html">See all</a></div><div class="gh-mini-list" id="ghSuggestions"><div class="gh-mini-item"><span class="gh-mini-thumb"><i class="fas fa-spinner fa-spin"></i></span><div><strong>Loading real activity…</strong><span>Firestore</span></div></div></div></div>'+
      '<div class="gh-panel gh-right-widget gh-premium-card"><div><strong><i class="fas fa-crown"></i> GeoHub Premium</strong><p>More rewards, more discovery, more Georgia.</p><a href="pricing.html" class="gh-btn sm ghost">Go Premium</a></div></div>'+
      '<div class="gh-panel gh-right-widget"><div class="gh-section-title"><h3>Quick actions</h3></div><div class="gh-mini-list"><a class="gh-mini-item" href="add-business.html"><span class="gh-mini-thumb"><i class="fas fa-store"></i></span><div><strong>Add business</strong><span>Create a page</span></div></a><a class="gh-mini-item" href="groups.html"><span class="gh-mini-thumb"><i class="fas fa-users"></i></span><div><strong>Create group</strong><span>Build community</span></div></a></div></div>';
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
  }

  function updateTopUser(){
    var u=currentUserInfo(); var av=$('#ghTopAvatar'), nm=$('#ghTopName'), link=document.querySelector('.gh-user-btn');
    if(av) av.innerHTML = u.avatar ? img(u.avatar,u.name) : esc(initials(u.name));
    if(nm) nm.textContent = authUser() ? u.name.split(' ')[0] : 'Sign in';
    if(link) link.setAttribute('href', authUser() ? profileLink(u.uid) : 'auth.html');
    document.querySelectorAll('.gh-nav-item').forEach(function(a){
      var txt=(a.textContent||'').trim().toLowerCase();
      if(txt==='profile') a.setAttribute('href', authUser() ? profileLink(u.uid) : 'auth.html');
      if(txt==='saved') a.setAttribute('href', authUser() ? profileLink(u.uid)+'&tab=saved' : 'auth.html');
    });
  }

  function bindAuthState(){
    var gf=GF();
    if(!gf || !gf.authFns || !gf.authFns.onAuthStateChanged || !gf.auth) return;
    if(state.authUnsub){ try{ state.authUnsub(); }catch(e){} state.authUnsub=null; }
    state.authUnsub = gf.authFns.onAuthStateChanged(gf.auth, function(){
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
        state.badgeUnsubs.push(GS().listenUserNotifications(u.uid, function(items){ var n=items.filter(function(x){return !x.read;}).length; var b=$('#ghNotifBadge'); if(b) b.textContent=n?String(n):''; }));
        var q=fs().query(fs().collection(db(),'conversations'), fs().where('participants','array-contains',u.uid), fs().limit(25));
        state.badgeUnsubs.push(fs().onSnapshot(q,function(snap){ var n=0; snap.forEach(function(d){ var x=d.data()||{}; if(x.lastSenderId && x.lastSenderId!==u.uid && Array.isArray(x.unreadFor) && x.unreadFor.indexOf(u.uid)>-1) n++; }); var b=$('#ghMsgBadge'); if(b) b.textContent=n?String(n):''; },function(){ }));
      }catch(e){}
    });
  }

  function loadRightRail(){
    ready(function(){
      if($('#ghRightStories')) loadStories('#ghRightStories', true);
      var list=$('#ghSuggestions'); if(!list) return;
      Promise.all([getLatest('businesses',4), getLatest('groups',4)]).then(function(res){
        var items=res[0].map(function(x){x._type='business';return x;}).concat(res[1].map(function(x){x._type='group';return x;})).slice(0,6);
        if(!items.length){ list.innerHTML='<div class="gh-empty" style="min-height:120px"><i class="fas fa-seedling"></i><h3>Nothing yet</h3><p>Real suggestions appear after content is added.</p></div>'; return; }
        list.innerHTML=items.map(function(x){ var title=x.name||x.title||'Untitled'; var photo=x.logoUrl||x.coverImageUrl||x.coverUrl||x.imageUrl||x.photoUrl; return '<a class="gh-mini-item" href="'+docLink(x._type,x.id)+'"><span class="gh-mini-thumb">'+(photo?img(photo,title):'<i class="fas '+iconFor(x._type)+'"></i>')+'</span><div><strong>'+esc(title)+'</strong><span>'+labelFor(x._type)+' · '+esc(x.city||x.category||'GeoHub')+'</span></div></a>'; }).join('');
      });
    });
  }

  function getLatest(collectionName, n){
    if(!GF()) return Promise.resolve([]);
    return fs().getDocs(fs().query(fs().collection(db(), collectionName), fs().limit(n||10))).then(function(snap){ var arr=[]; snap.forEach(function(d){ arr.push(Object.assign({id:d.id}, d.data())); }); arr.sort(function(a,b){ return ts(b.createdAt)-ts(a.createdAt); }); return arr; }).catch(function(){ return []; });
  }

  function openNotifications(){
    if(!requireLogin()) return;
    var existing=$('#ghNotifModal'); if(existing){existing.remove();return;}
    modal('Notifications','<div id="ghNotifList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading…</h3></div></div>','<button class="gh-btn ghost" id="ghMarkAllRead">Mark all read</button><button class="gh-btn ghost" data-close-modal>Close</button>','ghNotifModal');
    ready(function(){
      var uid=authUser().uid;
      $('#ghMarkAllRead').onclick=function(){ markVisibleNotificationsRead(); };
      var unsub = GS().listenUserNotifications(uid, function(items){
        var box=$('#ghNotifList'); if(!box) return;
        if(!items.length){ box.innerHTML='<div class="gh-empty"><i class="fas fa-bell"></i><h3>No notifications</h3><p>Likes, comments, messages and requests will appear here.</p></div>'; return; }
        box.innerHTML='<div class="gh-mini-list">'+items.slice(0,30).map(function(n){return '<a class="gh-mini-item '+(!n.read?'unread':'')+'" href="'+esc(n.href||'feed.html')+'" data-notif="'+esc(n.id)+'"><span class="gh-mini-thumb"><i class="fas fa-bell"></i></span><div><strong>'+esc(n.title||'GeoHub')+'</strong><span>'+esc(n.body||n.message||'')+' · '+timeAgo(n.createdAt)+'</span></div></a>';}).join('')+'</div>';
      });
      var modalEl = $('#ghNotifModal');
      if(modalEl) modalEl._unsub = unsub;
    });
  }

  function markVisibleNotificationsRead(){
    if(!authUser() || !fs()) return;
    $all('[data-notif]').forEach(function(a){
      var id=a.dataset.notif;
      fs().updateDoc(fs().doc(db(),'userNotifications',id), { read:true, updatedAt:fs().serverTimestamp() }).catch(function(){});
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


  function prepareMedia(url, folder){
    if(!url) return Promise.resolve('');
    if(GS() && GS().uploadImageDataUrl) return GS().uploadImageDataUrl(url, folder || 'posts').then(function(finalUrl){
      if(url.indexOf('data:') === 0 && !finalUrl) throw new Error('Image upload failed');
      return finalUrl;
    });
    return Promise.resolve(url);
  }

  function openPostModal(extra){
    if(!requireLogin()) return;
    var body='<textarea class="gh-textarea" id="ghPostText" placeholder="რას აზიარებ დღეს?"></textarea>'+
      '<div class="gh-form-grid"><select class="gh-select" id="ghPostVisibility"><option value="public">🌍 Public</option><option value="friends">👥 Friends / Followers</option><option value="onlyme">🔒 Only me</option></select><input class="gh-input" id="ghPostFeeling" placeholder="Feeling / activity optional"></div>'+
      '<div style="height:10px"></div><input class="gh-input" id="ghPostImg" placeholder="Image URL optional"><div style="height:10px"></div><button class="gh-btn ghost full" id="ghPickPostImage" type="button"><i class="fas fa-image"></i> Choose image from device</button><div id="ghPostPreview" style="margin-top:10px"></div>'+
      '<div class="gh-small" style="margin-top:10px">Tip: mention people with @username. Privacy is saved with the post.</div>';
    modal('Create post', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitPost"><i class="fas fa-paper-plane"></i> Post</button>', 'ghPostModal');
    var picked='';
    $('#ghPickPostImage').onclick=function(){ triggerImagePick(function(url){ picked=url; $('#ghPostImg').value=''; $('#ghPostPreview').innerHTML=url?'<img src="'+esc(url)+'" style="width:100%;max-height:260px;object-fit:cover;border-radius:16px;border:1px solid var(--gh-border)">':''; }); };
    $('#ghSubmitPost').onclick=function(){
      var txt=$('#ghPostText').value, url=picked || $('#ghPostImg').value.trim();
      var payload=Object.assign({ visibility: $('#ghPostVisibility').value, feeling: $('#ghPostFeeling').value.trim(), mentions: extractMentions(txt) }, extra||{});
      $('#ghSubmitPost').disabled = true;
      prepareMedia(url, 'posts').then(function(finalUrl){
        if(url && !finalUrl) throw new Error('Image upload failed');
        GS().createPost(txt, finalUrl, function(){ var m=$('#ghPostModal'); if(m)m.remove(); }, payload);
      }).catch(function(){ toast('Image upload failed', 'error'); }).finally(function(){ var b=$('#ghSubmitPost'); if(b)b.disabled=false; });
    };
  }

  function openStoryModal(){
    if(!requireLogin()) return;
    var body='<textarea class="gh-textarea" id="ghStoryText" placeholder="Story text…"></textarea><div style="height:10px"></div><input class="gh-input" id="ghStoryImg" placeholder="Image URL optional"><div style="height:10px"></div><button class="gh-btn ghost full" id="ghPickStoryImage" type="button"><i class="fas fa-image"></i> Choose image</button><div id="ghStoryPreview" style="margin-top:10px"></div>';
    modal('Add story', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitStory">Share story</button>', 'ghStoryModal');
    var picked=''; $('#ghPickStoryImage').onclick=function(){ triggerImagePick(function(url){ picked=url; $('#ghStoryImg').value=''; $('#ghStoryPreview').innerHTML=url?'<img src="'+esc(url)+'" style="width:100%;max-height:260px;object-fit:cover;border-radius:16px;border:1px solid var(--gh-border)">':''; }); };
    $('#ghSubmitStory').onclick=function(){ var t=$('#ghStoryText').value, url=picked||$('#ghStoryImg').value.trim(); if(!t.trim()&&!url)return toast('Story needs text or image','error'); if(!GS().createStory) return toast('Stories unavailable','error'); $('#ghSubmitStory').disabled=true; prepareMedia(url,'stories').then(function(finalUrl){ if(url && !finalUrl) throw new Error('Image upload failed'); GS().createStory(t,finalUrl,function(){ var m=$('#ghStoryModal'); if(m)m.remove(); }); }).catch(function(){ toast('Image upload failed','error'); }).finally(function(){ var b=$('#ghSubmitStory'); if(b)b.disabled=false; }); };
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
    var groups=[], map={};
    (items||[]).map(normalizeStoryItem).forEach(function(story){
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

    function close(){ overlay.remove(); document.body.classList.remove('gh-story-open'); document.removeEventListener('keydown', onKey); }
    function normalizeIndexes(){
      if(groupIndex < 0) groupIndex = groups.length - 1;
      if(groupIndex >= groups.length) groupIndex = 0;
      var g = groups[groupIndex];
      if(storyIndex < 0){ groupIndex = groupIndex - 1; if(groupIndex < 0) groupIndex = groups.length - 1; g = groups[groupIndex]; storyIndex = g.stories.length - 1; }
      if(storyIndex >= g.stories.length){ groupIndex = groupIndex + 1; if(groupIndex >= groups.length) groupIndex = 0; g = groups[groupIndex]; storyIndex = 0; }
    }
    function draw(){
      normalizeIndexes();
      var g = groups[groupIndex];
      var st = g.stories[storyIndex] || {};
      var media = st.mediaUrl || '';
      overlay.innerHTML = '<div class="gh-story-shell" role="dialog" aria-modal="true" aria-label="Story viewer">'+
        '<div class="gh-story-progress">'+g.stories.map(function(_,i){ return '<span class="'+(i<=storyIndex?'active':'')+'"></span>'; }).join('')+'</div>'+
        '<div class="gh-story-head"><div class="gh-story-author">'+(g.authorAvatar?'<span class="gh-story-author-avatar">'+img(g.authorAvatar,g.authorName)+'</span>':'<span class="gh-story-author-avatar initials">'+esc(initials(g.authorName))+'</span>')+'<div><strong>'+esc(g.authorName)+'</strong><small>'+(storyIndex+1)+'/'+g.stories.length+' · '+timeAgo(st.createdAt)+'</small></div></div><button type="button" class="gh-story-close" aria-label="Close story">×</button></div>'+
        '<div class="gh-story-main">'+(media?'<img src="'+esc(media)+'" alt="Story image" loading="eager">':'<p>'+esc(st.text||'Story')+'</p>')+(media && st.text?'<div class="gh-story-caption">'+esc(st.text)+'</div>':'')+'</div>'+
        '<button type="button" class="gh-story-nav prev" aria-label="Previous story">‹</button><button type="button" class="gh-story-nav next" aria-label="Next story">›</button>'+
      '</div>';
      overlay.querySelector('.gh-story-close').onclick = close;
      overlay.querySelector('.gh-story-nav.prev').onclick = function(e){ e.stopPropagation(); storyIndex--; draw(); };
      overlay.querySelector('.gh-story-nav.next').onclick = function(e){ e.stopPropagation(); storyIndex++; draw(); };
      overlay.querySelector('.gh-story-main').onclick = function(e){
        var r = overlay.querySelector('.gh-story-main').getBoundingClientRect();
        if(e.clientX < r.left + r.width/2) storyIndex--; else storyIndex++;
        draw();
      };
    }
    function onKey(e){ if(e.key==='Escape') close(); if(e.key==='ArrowLeft'){ storyIndex--; draw(); } if(e.key==='ArrowRight'){ storyIndex++; draw(); } }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) close(); });
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
      (imgUrl?'<img class="gh-post-img" src="'+esc(imgUrl)+'" alt="post image" loading="lazy">':'')+
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
    shell({ active:'feed', center:
      '<section class="gh-card gh-live-map"><div class="gh-live-map-bg"><div class="gh-map-dot gh-map-dot-a"><b id="gpPosts">—</b><span>Posts</span></div><div class="gh-map-dot gh-map-dot-b"><b id="gpEvents">—</b><span>Events</span></div><div class="gh-map-dot gh-map-dot-c"><b id="gpBusinesses">—</b><span>Businesses</span></div><div class="gh-map-dot gh-map-dot-d"><b id="gpCheckins">—</b><span>Check-ins</span></div></div><div class="gh-live-map-head"><div><h1>GeoPulse — Live Georgia</h1><p>Real activity from posts, businesses, events and check-ins.</p></div><a href="map.html" class="gh-btn ghost"><i class="fas fa-location-dot"></i> Open Full Map</a></div><div class="gh-live-stats"><div><i class="fas fa-wave-square"></i><strong id="gpActive">Loading</strong><span>Activity</span></div><div><i class="fas fa-calendar"></i><strong id="gpEvents2">—</strong><span>Events</span></div><div><i class="fas fa-location-dot"></i><strong id="gpCheckins2">—</strong><span>Check-ins</span></div><div><i class="fas fa-comment-dots"></i><strong id="gpPosts2">—</strong><span>Posts</span></div></div></section>'+
      '<section class="gh-card"><div class="gh-section-title"><h2>Stories from Places</h2><a class="gh-small" href="explore.html">See all</a></div><div class="gh-stories" id="ghStories"></div></section>'+
      '<section class="gh-card gh-composer"><div class="gh-composer-top"><span class="gh-avatar" id="ghComposerAvatar">GH</span><button class="gh-composer-fake" data-create-post>რას აზიარებ დღეს?</button></div><div class="gh-composer-actions"><button class="gh-composer-action" data-create-post><i class="fas fa-image" style="color:#22c55e"></i> Photo</button><button class="gh-composer-action" onclick="location.href=\'places.html\'"><i class="fas fa-map-marker-alt" style="color:#ef4444"></i> Place</button><button class="gh-composer-action" onclick="location.href=\'add-business.html\'"><i class="fas fa-store" style="color:#38bdf8"></i> Business</button><button class="gh-composer-action" onclick="location.href=\'events.html\'"><i class="fas fa-calendar" style="color:#f59e0b"></i> Event</button></div></section>'+
      '<div id="ghFeedList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading feed…</h3></div></div>'
    });
    var u=currentUserInfo(); var ca=$('#ghComposerAvatar'); if(ca) ca.innerHTML = u.avatar ? img(u.avatar,u.name) : esc(initials(u.name));
    loadStories('#ghStories');
    updateGeoPulse();
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
    var type=x._type; var title=x.title||x.name||x.text||'Untitled'; var desc=x.description||x.desc||x.text||x.category||''; var photo=x.imageUrl||x.photoUrl||x.mediaUrl||x.coverImageUrl||x.coverUrl||x.logoUrl||'';
    if(type==='post') title=x.authorName ? x.authorName+' posted' : 'Post';
    return '<article class="gh-card gh-item-card" data-discover-card data-type="'+esc(type)+'"><div class="gh-item-media">'+(photo?img(photo,title):'')+'<span class="gh-type-badge"><i class="fas '+iconFor(type)+'"></i> '+labelFor(type)+'</span></div><div class="gh-item-body"><h3>'+esc(title)+'</h3><p>'+esc(desc||'Real GeoHub item')+'</p><div class="gh-item-meta">'+(type==='business'?businessModeChip(x):(x.city?'<span class="gh-chip"><i class="fas fa-location-dot"></i> '+esc(x.city)+'</span>':''))+(x.category?'<span class="gh-chip">'+esc(x.category)+'</span>':'')+'<span class="gh-chip">'+timeAgo(x.createdAt)+'</span></div><div class="gh-card-actions"><a class="gh-btn sm" href="'+docLink(type,x.id)+'">View</a><button class="gh-btn sm ghost" data-save-item data-type="'+esc(type)+'" data-id="'+esc(x.id)+'"><i class="fas fa-bookmark"></i></button><button class="gh-btn sm ghost" data-share-item data-url="'+docLink(type,x.id)+'"><i class="fas fa-share"></i></button></div></div></article>';
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
    var title=b.name||'Untitled business'; var photo=b.coverImageUrl||b.imageUrl||b.photoUrl||b.logoUrl||'';
    return '<article class="gh-card gh-item-card"><div class="gh-item-media">'+(photo?img(photo,title):'')+'<span class="gh-type-badge"><i class="fas fa-store"></i> Business Page</span></div><div class="gh-item-body"><h3>'+esc(title)+'</h3><p>'+esc(b.description||b.desc||'Business page on GeoHub')+'</p><div class="gh-item-meta"><span class="gh-chip">'+esc(b.category||'Business')+'</span>'+businessModeChip(b)+'<span class="gh-chip">'+Number(b.followerCount||0)+' followers</span></div><div class="gh-card-actions"><a class="gh-btn sm" href="business.html?id='+encodeURIComponent(b.id)+'">View Page</a><button class="gh-btn sm ghost" data-follow-business="'+esc(b.id)+'"><i class="fas fa-plus"></i> Follow</button><button class="gh-btn sm ghost" data-save-item data-type="business" data-id="'+esc(b.id)+'"><i class="fas fa-bookmark"></i></button></div></div></article>';
  }

  function renderBusinesses(){
    var id=new URLSearchParams(location.search).get('id');
    if(id) return renderBusinessDetail(id);
    shell({ active:'business', center:'<div class="gh-card"><div class="gh-section-title"><div><h1>Businesses / Pages</h1><p class="gh-muted" style="margin:.25rem 0 0">Every business becomes a Page where owners can post updates.</p></div><a href="add-business.html" class="gh-btn"><i class="fas fa-plus"></i>Add Business</a></div><input class="gh-input" id="ghBusinessSearch" placeholder="Search businesses…"><div style="height:12px"></div><div class="gh-pill-row"><button class="gh-pill active" data-biz-filter="all">All</button><button class="gh-pill" data-biz-filter="food">Food</button><button class="gh-pill" data-biz-filter="tourism">Tourism</button><button class="gh-pill" data-biz-filter="services">Services</button><button class="gh-pill" data-biz-filter="online">Online</button><button class="gh-pill" data-biz-filter="shop">Shops</button><button class="gh-pill" data-biz-filter="education">Education</button></div></div><div id="ghBusinessList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>' });
    var all=[]; state.bizFilter='all';
    function paint(){ var q=($('#ghBusinessSearch').value||'').toLowerCase(); var arr=all.filter(function(b){ var cat=(b.category||'').toLowerCase(); var ok=state.bizFilter==='all'||cat.includes(state.bizFilter)||(state.bizFilter==='online' && isOnlineBusiness(b)); if(!ok)return false; return !q || JSON.stringify(b).toLowerCase().includes(q); }); var list=$('#ghBusinessList'); if(!arr.length){list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-store"></i><h3>No businesses yet</h3><p>Add a business and GeoHub will create a page for it.</p><a href="add-business.html" class="gh-btn">Add Business</a></div>';return;} list.innerHTML='<div class="gh-grid">'+arr.map(businessListCard).join('')+'</div>'; }
    $('#ghBusinessSearch').oninput=paint; $('#ghCenter').addEventListener('click', function(e){ var f=e.target.closest('[data-biz-filter]'); if(f){ state.bizFilter=f.dataset.bizFilter; $all('[data-biz-filter]').forEach(function(x){x.classList.toggle('active',x===f);}); paint(); } var fb=e.target.closest('[data-follow-business]'); if(fb) followBusiness(fb.dataset.followBusiness); var s=e.target.closest('[data-save-item]'); if(s){ if(!requireLogin())return; GS().toggleSaveItem(s.dataset.type,s.dataset.id); } });
    ready(function(){ var q=fs().query(fs().collection(db(),'businesses'), fs().limit(100)); fs().onSnapshot(q,function(snap){ all=[]; snap.forEach(function(d){ all.push(Object.assign({id:d.id},d.data())); }); all.sort(function(a,b){return ts(b.createdAt)-ts(a.createdAt);}); paint(); }, function(err){ $('#ghBusinessList').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Could not load businesses</h3><p>'+esc(err.message)+'</p></div>'; }); });
  }

  function renderBusinessDetail(id){
    shell({ active:'business', center:'<div id="ghBusinessDetail"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading business page…</h3></div></div>' });
    ready(function(){
      fs().onSnapshot(fs().doc(db(),'businesses',id), function(snap){
        if(!snap.exists()){ $('#ghBusinessDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-store-slash"></i><h3>Business not found</h3><p>This page does not exist or was removed.</p></div>'; return; }
        var b=Object.assign({id:id}, snap.data()); paintBusinessDetail(b);
      }, function(err){ $('#ghBusinessDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Load failed</h3><p>'+esc(err.message)+'</p></div>'; });
    });
  }

  function paintBusinessDetail(b){
    var title=b.name||'Business'; var cover=b.coverImageUrl||b.imageUrl||b.photoUrl||''; var logo=b.logoUrl||''; var isOwner=authUser() && (b.ownerId===authUser().uid || b.createdBy===authUser().uid || b.userId===authUser().uid);
    $('#ghBusinessDetail').innerHTML='<section class="gh-card" style="padding:0;overflow:hidden"><div class="gh-page-cover">'+(cover?img(cover,title):'')+'</div><div class="gh-page-info"><div class="gh-page-logo">'+(logo?img(logo,title):esc(initials(title)))+'</div><div class="gh-page-title"><h1>'+esc(title)+'</h1><p><i class="fas fa-store"></i> '+esc(b.category||'Business')+' · '+esc(businessAreaLabel(b))+' · '+Number(b.followerCount||0)+' followers</p></div><div class="gh-page-actions"><button class="gh-btn gh-follow-business-btn" data-follow-business="'+esc(b.id)+'"><i class="fas fa-plus"></i> Follow</button><button class="gh-btn ghost" data-message-business="'+esc(b.ownerId||b.createdBy||'')+'"><i class="fas fa-comment"></i> Message</button><button class="gh-btn ghost" data-save-item data-type="business" data-id="'+esc(b.id)+'"><i class="fas fa-bookmark"></i></button>'+(isOwner?'<button class="gh-btn ghost" data-edit-business><i class="fas fa-gear"></i> Manage</button>':'')+'</div></div><div class="gh-tabbar"><button class="gh-tab active" data-business-tab="posts">Posts</button><button class="gh-tab" data-business-tab="about">About</button><button class="gh-tab" data-business-tab="reviews">Reviews</button><button class="gh-tab" data-business-tab="photos">Photos</button>'+(isOwner?'<button class="gh-tab" data-business-tab="manage">Dashboard</button>':'')+'</div></section><div id="ghBusinessTabContent"></div>';
    $('#ghBusinessDetail').onclick=function(e){ var tab=e.target.closest('[data-business-tab]'); if(tab){ state.currentBusinessTab=tab.dataset.businessTab; $all('[data-business-tab]').forEach(function(x){x.classList.toggle('active',x===tab);}); renderBusinessTab(b); } var fl=e.target.closest('[data-follow-business]'); if(fl) followBusiness(b.id); var sv=e.target.closest('[data-save-item]'); if(sv){ if(!requireLogin())return; GS().toggleSaveItem(sv.dataset.type,sv.dataset.id); } var msg=e.target.closest('[data-message-business]'); if(msg){ var owner=msg.dataset.messageBusiness; if(!owner) return toast('Business owner not available','error'); if(!requireLogin()) return; GS().startConversation(owner,function(){ location.href='messages.html?with='+encodeURIComponent(owner); }); } var edit=e.target.closest('[data-edit-business]'); if(edit) location.href='add-business.html?edit='+encodeURIComponent(b.id); };
    updateBusinessFollowButton(b.id);
    renderBusinessTab(b);
  }


  function renderBusinessManageTab(b){
    var box=$('#ghBusinessTabContent'); if(!box)return;
    box.innerHTML='<div class="gh-card"><div class="gh-section-title"><div><h2>Business Dashboard</h2><p class="gh-muted" style="margin:.25rem 0 0">Manage your page, offers and analytics.</p></div><button class="gh-btn" data-new-reward><i class="fas fa-gift"></i>New reward</button><button class="gh-btn ghost" data-new-offer><i class="fas fa-tag"></i>New offer</button></div><div class="gh-live-stats gh-dashboard-stats"><div><i class="fas fa-users"></i><strong id="bdFollowers">—</strong><span>Followers</span></div><div><i class="fas fa-newspaper"></i><strong id="bdPosts">—</strong><span>Posts</span></div><div><i class="fas fa-star"></i><strong id="bdReviews">—</strong><span>Reviews</span></div><div><i class="fas fa-tag"></i><strong id="bdOffers">—</strong><span>Offers</span></div><div><i class="fas fa-gift"></i><strong id="bdRewards">—</strong><span>Rewards</span></div></div><div class="gh-card-actions" style="margin-top:14px"><button class="gh-btn ghost" data-edit-business><i class="fas fa-pen"></i>Edit page</button><a class="gh-btn ghost" href="events.html"><i class="fas fa-calendar-plus"></i>Create event</a><button class="gh-btn ghost" data-post-as-business><i class="fas fa-bullhorn"></i>Post update</button></div></div><div class="gh-card"><div class="gh-section-title"><h3>Partner Rewards</h3><a class="gh-small" href="rewards.html">Reward Store</a></div><div id="bdRewardsList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div></div><div class="gh-card"><div class="gh-section-title"><h3>Active Offers</h3></div><div id="bdOffersList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>';
    box.onclick=function(e){ if(e.target.closest('[data-new-reward]')) openBusinessRewardModal(b); if(e.target.closest('[data-new-offer]')) openBusinessOfferModal(b); if(e.target.closest('[data-edit-business]')) location.href='add-business.html?edit='+encodeURIComponent(b.id); if(e.target.closest('[data-post-as-business]')) openPostModal({ targetType:'business', targetId:b.id, authorType:'business', businessId:b.id, authorId:b.id, authorName:b.name, authorAvatar:b.logoUrl||b.coverImageUrl||'', createdByUserId:authUser() && authUser().uid }); };
    if(GS().getBusinessDashboard) GS().getBusinessDashboard(b.id,function(stats){
      setTextById('bdFollowers', stats.followers || b.followerCount || 0); setTextById('bdPosts', stats.posts || b.postCount || 0); setTextById('bdReviews', stats.reviews || b.reviewCount || 0); setTextById('bdOffers', (stats.offers||[]).length); setTextById('bdRewards', (stats.rewards||[]).length);
      var rlist=$('#bdRewardsList'); var rewards=stats.rewards||[]; if(rlist){ if(!rewards.length){ rlist.innerHTML='<div class="gh-empty"><i class="fas fa-gift"></i><h3>No rewards yet</h3><p>Create coupons that users unlock with GeoPoints.</p></div>'; } else { rlist.innerHTML='<div class="gh-mini-list">'+rewards.map(function(r){return '<a class="gh-mini-item" href="rewards.html"><span class="gh-mini-thumb"><i class="fas fa-gift"></i></span><div><strong>'+esc(r.title||r.name||'Reward')+'</strong><span>'+Number(r.pointPrice||0)+' GeoPoints · '+esc(r.rewardType||'reward')+'</span></div></a>';}).join('')+'</div>'; }}
      var list=$('#bdOffersList'); if(!list)return; var offers=stats.offers||[]; if(!offers.length){ list.innerHTML='<div class="gh-empty"><i class="fas fa-tag"></i><h3>No offers yet</h3><p>Create a discount, announcement or campaign for your followers.</p></div>'; return; }
      list.innerHTML='<div class="gh-mini-list">'+offers.map(function(o){return '<div class="gh-mini-item"><span class="gh-mini-thumb"><i class="fas fa-tag"></i></span><div><strong>'+esc(o.title||'Offer')+'</strong><span>'+esc(o.description||'')+'</span></div></div>';}).join('')+'</div>';
    });
  }


  function openBusinessRewardModal(b){
    if(!requireLogin()) return;
    var body='<input class="gh-input" id="brTitle" placeholder="Reward title, e.g. Free coffee"><div style="height:10px"></div><textarea class="gh-textarea" id="brDesc" placeholder="Reward details and how it works"></textarea><div class="gh-form-grid"><select class="gh-select" id="brType"><option value="discount">Discount</option><option value="free_item">Free item</option><option value="visit">Daily visit / pass</option><option value="course">Online course</option><option value="platform_perk">GeoHub perk</option></select><input class="gh-input" id="brPrice" type="number" min="1" placeholder="Point price"></div><div class="gh-form-grid"><input class="gh-input" id="brQty" type="number" min="0" placeholder="Quantity, 0 = unlimited"><input class="gh-input" id="brExpires" placeholder="Expires, e.g. 2026-06-30"></div><div style="height:10px"></div><textarea class="gh-textarea" id="brTerms" placeholder="Terms: no cash value, one-time use, partner conditions…"></textarea>';
    modal('New partner reward for '+(b.name||'business'), body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="brSubmit"><i class="fas fa-gift"></i>Create reward</button>', 'ghRewardModal');
    $('#brSubmit').onclick=function(){
      if(!GS().createReward) return toast('Reward system unavailable','error');
      GS().createReward({ businessId:b.id, businessName:b.name||'', title:$('#brTitle').value, description:$('#brDesc').value, rewardType:$('#brType').value, pointPrice:$('#brPrice').value, quantity:$('#brQty').value, expiresAt:$('#brExpires').value, terms:$('#brTerms').value }, function(){ var m=$('#ghRewardModal'); if(m)m.remove(); renderBusinessManageTab(b); });
    };
  }

  function openBusinessOfferModal(b){
    if(!requireLogin()) return;
    var body='<input class="gh-input" id="boTitle" placeholder="Offer title, e.g. Weekend discount"><div style="height:10px"></div><textarea class="gh-textarea" id="boDesc" placeholder="Offer details"></textarea><div class="gh-form-grid"><input class="gh-input" id="boStarts" placeholder="Starts e.g. today"><input class="gh-input" id="boEnds" placeholder="Ends e.g. Sunday"></div>';
    modal('New offer for '+(b.name||'business'), body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="boSubmit">Create offer</button>', 'ghOfferModal');
    $('#boSubmit').onclick=function(){ if(!GS().createBusinessOffer) return toast('Offers unavailable','error'); GS().createBusinessOffer(b.id,{ title:$('#boTitle').value, description:$('#boDesc').value, startsAt:$('#boStarts').value, endsAt:$('#boEnds').value },function(){ var m=$('#ghOfferModal'); if(m)m.remove(); renderBusinessManageTab(b); }); };
  }

  function renderBusinessTab(b){
    var box=$('#ghBusinessTabContent'); if(!box)return; var tab=state.currentBusinessTab||'posts';
    if(tab==='about'){
      box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>About</h2></div><div class="gh-about-list">'+
        aboutRow('fa-align-left',b.description||b.desc||'No description yet')+aboutRow(isOnlineBusiness(b)?'fa-globe':'fa-location-dot',isOnlineBusiness(b)?businessAreaLabel(b):(b.address||b.city||'No address'))+(isOnlineBusiness(b)?aboutRow('fa-laptop','Online / nationwide service'):'')+aboutRow('fa-phone',b.phone||'No phone')+aboutRow('fa-envelope',b.email||'No email')+aboutRow('fa-globe',b.website||'No website')+aboutRow('fa-clock',formatWorkingHours(b.workingHours))+'</div></div>'; return;
    }
    if(tab==='reviews') return renderBusinessReviews(b);
    if(tab==='manage') return renderBusinessManageTab(b);
    if(tab==='photos'){ box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-images"></i><h3>Photos</h3><p>Photos from business posts will appear here.</p></div>'; return; }
    var isOwner=authUser() && (b.ownerId===authUser().uid || b.createdBy===authUser().uid || b.userId===authUser().uid);
    box.innerHTML=(isOwner?'<section class="gh-card gh-composer"><div class="gh-composer-top"><span class="gh-avatar">'+esc(initials(b.name))+'</span><button class="gh-composer-fake" data-post-as-business>Post as '+esc(b.name||'business')+'</button></div></section>':'')+'<div id="ghBusinessPosts"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>';
    box.onclick=function(e){ if(e.target.closest('[data-post-as-business]')) openPostModal({ targetType:'business', targetId:b.id, authorType:'business', businessId:b.id, authorId:b.id, authorName:b.name, authorAvatar:b.logoUrl||b.coverImageUrl||'', createdByUserId:authUser() && authUser().uid }); };
    bindPostInteractions(box);
    setupAudienceAccess(function(){ var list=$('#ghBusinessPosts'); if(list && list._lastPosts) { var posts=list._lastPosts.filter(canSeePost); list.innerHTML=posts.length ? posts.map(postCard).join('') : '<div class="gh-card gh-empty"><i class="fas fa-newspaper"></i><h3>No posts yet</h3><p>Business page updates will appear here.</p></div>'; hydrateSharedPreviews(list); } });
    listenTargetPosts('business', b.id, function(posts){ var list=$('#ghBusinessPosts'); if(!list) return; list._lastPosts=posts||[]; posts=posts.filter(canSeePost); if(!posts.length){ list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-newspaper"></i><h3>No posts yet</h3><p>Business page updates will appear here.</p></div>'; return; } list.innerHTML=posts.map(postCard).join(''); bindPostInteractions(list); posts.forEach(function(p){hydrateReactionState(p.id);}); hydrateSharedPreviews(list); });
  }

  function aboutRow(ic, txt){ return '<div class="gh-about-row"><i class="fas '+ic+'"></i><span>'+esc(txt)+'</span></div>'; }

  function renderBusinessReviews(b){
    var box=$('#ghBusinessTabContent');
    box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>Reviews</h2><span class="gh-small">'+Number(b.reviewCount||0)+' reviews</span></div><div class="gh-review-form"><div class="gh-stars" id="ghReviewStars">'+[1,2,3,4,5].map(function(i){return '<button class="gh-star active" data-star="'+i+'">★</button>';}).join('')+'</div><textarea class="gh-textarea" id="ghReviewText" placeholder="Write a review…"></textarea><button class="gh-btn" id="ghSubmitReview">Submit review</button></div></div><div id="ghBusinessReviewsList"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>';
    $('#ghReviewStars').onclick=function(e){ var s=e.target.closest('[data-star]'); if(!s)return; state.starRating=Number(s.dataset.star); $all('[data-star]').forEach(function(x){x.classList.toggle('active', Number(x.dataset.star)<=state.starRating);}); };
    $('#ghSubmitReview').onclick=function(){ createBusinessReview(b.id, state.starRating||5, $('#ghReviewText').value); };
    listenBusinessReviews(b.id, function(items){ var list=$('#ghBusinessReviewsList'); if(!items.length){list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-star"></i><h3>No reviews yet</h3><p>Be first to review this business.</p></div>';return;} list.innerHTML=items.map(function(r){ var uid=r.userId||r.authorId||''; var name=r.userName||r.authorName||'User'; var avHtml=(r.userPhoto?img(r.userPhoto,name):esc(initials(name))); return '<div class="gh-card"><div class="gh-post-head">'+userProfileAnchor(uid,'gh-avatar gh-profile-avatar-link',avHtml,'Open '+name+' profile')+'<div><div class="gh-post-name">'+userProfileAnchor(uid,'gh-profile-name-link',esc(name),'Open '+name+' profile')+'</div><div class="gh-post-time">'+('★'.repeat(Number(r.rating||5)))+' · '+timeAgo(r.createdAt)+'</div></div></div><div class="gh-post-text">'+esc(r.text||r.comment||'')+'</div></div>';}).join(''); });
  }

  function createBusinessReview(businessId, rating, textVal){
    if(!requireLogin()) return; var u=currentUserInfo(); var textClean=(textVal||'').trim(); if(!textClean) return toast('Write review first','error');
    fs().addDoc(fs().collection(db(),'businessReviews'), { businessId:businessId, userId:u.uid, userName:u.name, userPhoto:u.avatar, rating:rating, text:textClean, status:'active', createdAt:fs().serverTimestamp() }).then(function(){ return fs().updateDoc(fs().doc(db(),'businesses',businessId), { reviewCount: fs().increment(1) }).catch(function(){}); }).then(function(){ if(GS().awardPoints) GS().awardPoints(25, 'Write business review', 'business', businessId); toast('Review submitted'); $('#ghReviewText').value=''; }).catch(function(err){ toast('Review failed: '+(err.code||err.message),'error'); });
  }
  function listenBusinessReviews(businessId, cb){ var q=fs().query(fs().collection(db(),'businessReviews'), fs().where('businessId','==',businessId), fs().limit(50)); fs().onSnapshot(q,function(snap){ var arr=[]; snap.forEach(function(d){arr.push(Object.assign({id:d.id},d.data()));}); arr.sort(function(a,b){return ts(b.createdAt)-ts(a.createdAt);}); cb(arr); },function(){cb([]);}); }

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
          .then(function(){toast('Unfollowed');});
      }
      return fs().setDoc(ref,{businessId:businessId,userId:uid,createdAt:fs().serverTimestamp()})
        .then(function(){return fs().updateDoc(biz,{followerCount:fs().increment(1)}).catch(function(){});})
        .then(function(){toast('Following business');});
    }).catch(function(err){toast('Follow failed: '+(err.code||err.message),'error');})
      .finally(function(){ if(btn){ btn.disabled=false; btn.classList.remove('is-loading'); } updateBusinessFollowButton(businessId); });
  }

  function listenTargetPosts(type,id,cb){
    var q=fs().query(fs().collection(db(),'posts'), fs().where('targetType','==',type), fs().where('targetId','==',id), fs().limit(50));
    fs().onSnapshot(q,function(snap){ var arr=[]; snap.forEach(function(d){arr.push(Object.assign({id:d.id},d.data()));}); arr.sort(function(a,b){return ts(b.createdAt)-ts(a.createdAt);}); cb(arr); },function(err){ console.warn('listenTargetPosts',err.message); cb([]); });
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

  function groupCard(g){ var title=g.name||'Untitled group'; var cover=g.coverUrl||g.coverImageUrl||g.imageUrl||''; return '<article class="gh-card gh-item-card"><div class="gh-item-media">'+(cover?img(cover,title):'')+'<span class="gh-type-badge"><i class="fas fa-users"></i> '+esc(g.privacy||'public')+'</span></div><div class="gh-item-body"><h3>'+esc(title)+'</h3><p>'+esc(g.description||'Group community on GeoHub')+'</p><div class="gh-item-meta"><span class="gh-chip">'+Number(g.memberCount||0)+' members</span><span class="gh-chip">'+esc(g.category||'general')+'</span></div><div class="gh-card-actions"><a class="gh-btn sm" href="groups.html?id='+encodeURIComponent(g.id)+'">View group</a><button class="gh-btn sm ghost" data-join-group="'+esc(g.id)+'" data-name="'+esc(title)+'" data-privacy="'+esc(g.privacy||'public')+'">Join</button></div></div></article>'; }

  function openGroupCreate(){
    if(!requireLogin()) return;
    var body='<input class="gh-input" id="ghGroupName" placeholder="Group name"><div style="height:10px"></div><textarea class="gh-textarea" id="ghGroupDesc" placeholder="What is this group about?"></textarea><div style="height:10px"></div><select class="gh-select" id="ghGroupCat"><option value="general">General</option><option value="hiking">Hiking</option><option value="travel">Travel</option><option value="business">Business</option><option value="learning">Learning</option></select><div style="height:10px"></div><select class="gh-select" id="ghGroupPrivacy"><option value="public">Public</option><option value="private">Private</option></select><div style="height:10px"></div><input class="gh-input" id="ghGroupCover" placeholder="Cover image URL optional">';
    modal('Create group', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitGroup">Create</button>', 'ghGroupCreateModal');
    $('#ghSubmitGroup').onclick=function(){ GS().createGroup({ name:$('#ghGroupName').value, description:$('#ghGroupDesc').value, category:$('#ghGroupCat').value, privacy:$('#ghGroupPrivacy').value, coverUrl:$('#ghGroupCover').value.trim() }, function(id){ if(id) location.href='groups.html?id='+encodeURIComponent(id); }); };
  }

  function renderGroupDetail(id){
    shell({ active:'groups', center:'<div id="ghGroupDetail"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading group…</h3></div></div>' });
    ready(function(){ fs().onSnapshot(fs().doc(db(),'groups',id), function(snap){ if(!snap.exists()){ $('#ghGroupDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-users-slash"></i><h3>Group not found</h3></div>'; return; } paintGroupDetail(Object.assign({id:id},snap.data())); }, function(err){ $('#ghGroupDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Failed</h3><p>'+esc(err.message)+'</p></div>'; }); });
  }

  function paintGroupDetail(g){
    var title=g.name||'Group'; var cover=g.coverUrl||g.coverImageUrl||'';
    $('#ghGroupDetail').innerHTML='<section class="gh-card" style="padding:0;overflow:hidden"><div class="gh-page-cover">'+(cover?img(cover,title):'')+'</div><div class="gh-page-info"><div class="gh-page-logo"><i class="fas fa-users"></i></div><div class="gh-page-title"><h1>'+esc(title)+'</h1><p>'+esc(g.privacy||'public')+' group · '+Number(g.memberCount||0)+' members · '+esc(g.category||'general')+'</p></div><div class="gh-page-actions"><button class="gh-btn" data-join-group="'+esc(g.id)+'" data-name="'+esc(title)+'" data-privacy="'+esc(g.privacy||'public')+'"><i class="fas fa-user-plus"></i> Join</button><button class="gh-btn ghost" data-share-group><i class="fas fa-share"></i> Share</button></div></div><div class="gh-tabbar"><button class="gh-tab active" data-group-detail-tab="discussion">Discussion</button><button class="gh-tab" data-group-detail-tab="about">About</button><button class="gh-tab" data-group-detail-tab="members">Members</button><button class="gh-tab" data-group-detail-tab="media">Media</button></div></section><div id="ghGroupTabContent"></div>';
    $('#ghGroupDetail').onclick=function(e){ var tab=e.target.closest('[data-group-detail-tab]'); if(tab){ state.currentGroupTab=tab.dataset.groupDetailTab; $all('[data-group-detail-tab]').forEach(function(x){x.classList.toggle('active',x===tab);}); renderGroupTab(g); } var j=e.target.closest('[data-join-group]'); if(j){ if((g.privacy||'public')==='private') GS().requestJoinGroup(g.id); else GS().toggleGroupMember(g.id,title); } var sh=e.target.closest('[data-share-group]'); if(sh && navigator.clipboard) navigator.clipboard.writeText(location.href).then(function(){toast('Group link copied');}); };
    renderGroupTab(g);
  }

  function renderGroupTab(g){
    var box=$('#ghGroupTabContent'); var tab=state.currentGroupTab||'discussion';
    if(tab==='about'){ box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>About this group</h2></div><div class="gh-about-list">'+aboutRow('fa-align-left',g.description||'No description')+aboutRow('fa-lock',g.privacy||'public')+aboutRow('fa-tag',g.category||'general')+aboutRow('fa-users',Number(g.memberCount||0)+' members')+'</div></div>'; return; }
    if(tab==='members'){ box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>Members</h2></div><div id="ghGroupMembersList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading members…</h3></div></div></div>'; if(GS().listenGroupMembers){ GS().listenGroupMembers(g.id,function(items){ var list=$('#ghGroupMembersList'); if(!list)return; if(!items.length){ list.innerHTML='<div class="gh-empty"><i class="fas fa-users"></i><h3>No members yet</h3></div>'; return; } list.innerHTML='<div class="gh-friend-grid">'+items.map(function(m){ var u=m.profile||{}; var name=u.fullName||u.displayName||u.name||m.userName||'GeoHub User'; var avatar=u.avatar||u.photoURL||''; var uid=u.uid||u.id||m.userId||m.uid||''; return '<a class="gh-friend-card" href="'+profileLink(uid)+'"><span class="gh-avatar">'+(avatar?img(avatar,name):esc(initials(name)))+'</span><div><strong>'+esc(name)+'</strong><span>'+esc(m.role||'member')+'</span></div></a>'; }).join('')+'</div>'; }); } return; }
    if(tab==='media'){ box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>Media</h2></div><div id="ghGroupMediaGrid"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading media…</h3></div></div></div>'; listenTargetPosts('group', g.id, function(items){ var media=items.filter(function(p){return p.imageUrl||p.mediaUrl||p.photoUrl;}); var grid=$('#ghGroupMediaGrid'); if(!grid)return; if(!media.length){ grid.innerHTML='<div class="gh-empty"><i class="fas fa-images"></i><h3>No media yet</h3><p>Photos from group posts will appear here.</p></div>'; return;} grid.innerHTML='<div class="gh-grid">'+media.map(function(p){var url=p.imageUrl||p.mediaUrl||p.photoUrl;return '<a class="gh-card" href="feed.html#post-'+esc(p.id)+'" style="padding:0;overflow:hidden"><img src="'+esc(url)+'" alt="media" style="width:100%;height:180px;object-fit:cover"><div style="padding:10px;font-size:.85rem;color:var(--gh-muted)">'+esc((p.text||'').slice(0,80))+'</div></a>';}).join('')+'</div>'; }); return; }
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
    return renderComingSoon();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
