/* GeoHub Social Redesign v2
   Self-contained app shell for feed/discover/groups/business pages.
   Uses Firebase Auth + Firestore through window.GeoFirebase and window.GeoSocial.
*/
(function(){
  'use strict';

  var PATH = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var PAGE = document.body && document.body.dataset ? document.body.dataset.ghPage : '';
  var state = { page: PAGE, filter: 'all', postsUnsubs: {}, replyUnsubs: {}, currentBusinessTab: 'posts', bizDashSection: 'overview', currentGroupTab: 'discussion', starRating: 5, theme: 'light', authUnsub: null, badgeUnsubs: [], sidebarCollapsed: false, hiddenPostIds: [], blockedUserIds: [], mutedUserIds: [], safetyUnsub: null, sharedPostCache: {}, friendIds: [], followingIds: [], followedBusinessIds: [], closeFriendIds: [], bizFeedPosts: [], bizFeedUnsub: null, audienceLoaded: false, pageUnsubs: [], currentBizId: null, currentBizOwner: null, openCommentPids: {}, cachedComments: {}, cachedReplies: {}, feedTab: 'foryou', feedUnsub: null, feedRenderId: 0, userCity: null };

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
    var pref = theme === 'system' || theme === 'dark' || theme === 'light' ? theme : 'dark';
    var effective = pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : pref === 'light' ? 'light' : 'dark';
    state.theme = pref;
    document.documentElement.setAttribute('data-gh-theme', effective);
    document.body && document.body.setAttribute('data-gh-theme', effective);
    try { localStorage.setItem('gh_theme', pref); } catch(e) {}
    var btn = document.getElementById('ghThemeToggle');
    if(btn){
      btn.setAttribute('aria-label', effective === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.innerHTML = effective === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
  }
  function initTheme(){
    var current = 'dark';
    try { current = localStorage.getItem('gh_theme') || document.documentElement.getAttribute('data-gh-theme') || 'dark'; } catch(e) { current = document.documentElement.getAttribute('data-gh-theme') || 'dark'; }
    state.theme = current;
    var effective = current === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : current === 'light' ? 'light' : 'dark';
    var btn = document.getElementById('ghThemeToggle');
    if(btn){
      btn.setAttribute('aria-label', effective === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.innerHTML = effective === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
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
  var actorAvatarCache = {};
  function postAuthorActor(p){
    p = p || {};
    var uid = p.authorId || p.userId || p.uid || p.createdByUserId || p.createdBy || '';
    if(p.authorType === 'user') return uid ? { type:'user', id:String(uid) } : null;
    var businessId = p.businessId || (p.authorType === 'business' ? p.authorId : '') || (p.targetType === 'business' && (!uid || uid === p.targetId) ? p.targetId : '');
    if(businessId && (p.authorType === 'business' || p.targetType === 'business' || p.businessId)){
      return { type:'business', id:String(businessId) };
    }
    return uid ? { type:'user', id:String(uid) } : null;
  }
  function latestActorAvatar(type, id){
    if(!type || !id || !fs() || !db()) return Promise.resolve(null);
    var key = type + ':' + id;
    if(actorAvatarCache[key]) return actorAvatarCache[key];
    actorAvatarCache[key] = fs().getDoc(fs().doc(db(), type === 'business' ? 'businesses' : 'users', id)).then(function(snap){
      if(!snap.exists()) return null;
      var data = snap.data() || {};
      var avatar = type === 'business'
        ? (data.logoUrl || data.logo || data.avatar || data.photoURL || data.photoUrl || data.imageUrl || '')
        : (data.avatar || data.photoURL || data.photoUrl || data.profilePhoto || data.profilePhotoUrl || data.imageUrl || '');
      var name = type === 'business' ? (data.title || data.name || data.businessName || '') : (data.name || data.displayName || data.fullName || '');
      return avatar ? { avatar:avatar, name:name } : null;
    }).catch(function(err){
      console.warn('[GeoHub] avatar hydration failed', type, id, err && (err.code || err.message || err));
      return null;
    });
    return actorAvatarCache[key];
  }
  function hydratePostAuthorAvatars(root){
    root = root || document;
    if(!root.querySelectorAll) return;
    $all('[data-post-author-avatar]', root).forEach(function(el){
      var type = el.dataset.actorType || '';
      var id = el.dataset.actorId || '';
      if(!type || !id || el.dataset.avatarHydrating === '1') return;
      el.dataset.avatarHydrating = '1';
      latestActorAvatar(type, id).then(function(info){
        el.dataset.avatarHydrating = '';
        if(!info || !info.avatar || el.dataset.latestAvatar === info.avatar) return;
        el.dataset.latestAvatar = info.avatar;
        el.innerHTML = img(info.avatar, info.name || el.getAttribute('aria-label') || '');
      });
    });
  }
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
  function getActiveActor(){ try{ return JSON.parse(localStorage.getItem('gh_active_actor')||'null'); }catch(e){ return null; } }
  function notificationActor(){
    var u=authUser();
    var actor=getActiveActor();
    if(actor && actor.type==='business' && actor.businessId){
      return { type:'business', targetActorType:'business', targetActorId:actor.businessId, businessId:actor.businessId, title:actor.title||actor.name||'Page' };
    }
    return { type:'user', targetActorType:'user', targetActorId:u?u.uid:'', uid:u?u.uid:'', title:u?(u.displayName||'Personal'):'Personal' };
  }
  function listenCurrentActorNotifications(cb){
    var actor=notificationActor();
    if(!actor.targetActorId) { cb([]); return function(){}; }
    if(GS() && GS().listenActorNotifications) return GS().listenActorNotifications(actor, cb);
    return GS() && GS().listenUserNotifications ? GS().listenUserNotifications(actor.targetActorId, cb) : function(){};
  }
  function notificationEmptyCopy(actor){
    return actor && actor.type==='business'
      ? { title:'No page activity yet', body:'Messages, quotes, redemptions and page engagement will appear here.' }
      : { title:'No notifications yet', body:'Likes, comments, messages and requests will appear here.' };
  }
  function buildActorExtra(){
    var actor=getActiveActor();
    if(!actor||actor.type!=='business') return {};
    var u=authUser();
    return { authorType:'business', businessId:actor.businessId, authorId:actor.businessId, authorName:actor.title||'Business', authorAvatar:actor.logoUrl||'', createdByUid:u?u.uid:'', targetType:'business', targetId:actor.businessId };
  }
  function isBusinessActor(actor){
    return !!(actor && actor.type==='business' && actor.businessId);
  }
  function activeBusinessActor(){
    var actor=getActiveActor();
    return isBusinessActor(actor) ? actor : null;
  }
  function actorMessagesHref(actor){
    return isBusinessActor(actor) ? 'messages.html?business='+encodeURIComponent(actor.businessId) : 'messages.html';
  }
  function clearFeedListener(){
    if(state.feedUnsub){ try{ state.feedUnsub(); }catch(e){} state.feedUnsub=null; }
    if(state.bizFeedUnsub){ try{ state.bizFeedUnsub(); }catch(e){} state.bizFeedUnsub=null; }
    state.bizFeedPosts=[];
  }
  function requireLogin(){ if(authUser()) return true; if(GS()) GS().requireAuth(); else toast('შესვლა აუცილებელია', 'error'); return false; }
  function currentUserInfo(){ var u=authUser(); return { uid:u && u.uid, name:u ? (u.displayName || (u.email||'').split('@')[0] || 'GeoHub User') : 'Guest', avatar:u ? (u.photoURL || '') : ''}; }
  function canSeePost(p){
    if(!p) return false;
    if(p.status && p.status !== 'active') return false;
    var u=authUser();
    var author = p.authorId || p.userId || p.createdByUserId || p.createdBy || '';
    if(p.id && state.hiddenPostIds.indexOf(p.id) > -1) return false;
    if(author && state.blockedUserIds.indexOf(author) > -1) return false;
    if(author && state.mutedUserIds.indexOf(author) > -1) return false;
    var visibility = (p.visibility || 'public').toLowerCase();
    if(visibility === 'onlyme' || visibility === 'only_me') return !!(u && author === u.uid);
    if(visibility === 'friends') return !!(u && (author === u.uid || state.friendIds.indexOf(author) > -1));
    if(visibility === 'followers') return !!(u && (author === u.uid || state.followingIds.indexOf(author) > -1));
    if(visibility === 'close_friends'){
      if(!u) return false;
      if(author === u.uid) return true;
      var cf = p.closeFriendIds;
      return !!(cf && cf.indexOf(u.uid) > -1);
    }
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
      }).catch(function(){ state.followingIds=[]; }),
      fs().getDocs(fs().query(fs().collection(db(),'businessFollowers'), fs().where('userId','==',u.uid), fs().limit(200))).then(function(snap){
        var ids=[]; snap.forEach(function(d){ var biz=(d.data()||{}).businessId; if(biz) ids.push(biz); });
        state.followedBusinessIds = ids;
      }).catch(function(){ state.followedBusinessIds=[]; }),
      Promise.resolve().then(function(){ state.closeFriendIds = state.friendIds.slice(); })
    ]).then(function(){ state.audienceLoaded = true; if(typeof onChange === 'function') onChange(); });
  }

  function extractMentions(textVal){
    var mentions=[];
    String(textVal||'').replace(/@([A-Za-z0-9_.-]{2,32})/g,function(_,u){ if(mentions.indexOf(u)===-1) mentions.push(u); });
    return mentions;
  }
  window.ghToggleReadMore = function(btn) {
    var wrap  = btn.parentElement;
    var short = wrap && wrap.querySelector('.gh-post-short');
    var full  = wrap && wrap.querySelector('.gh-post-full');
    if (!short || !full) return;
    var expanding = full.style.display === 'none';
    short.style.display = expanding ? 'none' : '';
    full.style.display  = expanding ? ''     : 'none';
    btn.textContent = expanding ? 'ნაკლები ▴' : 'წაიკითხე მეტი ▾';
  };

  function docLink(type, id){ if(type==='business') return 'business.html?id='+encodeURIComponent(id); if(type==='group') return 'groups.html?id='+encodeURIComponent(id); if(type==='place') return 'places.html?id='+encodeURIComponent(id); if(type==='event') return 'events.html?id='+encodeURIComponent(id); if(type==='creator') return 'profile.html?id='+encodeURIComponent(id); return 'feed.html#post-'+encodeURIComponent(id); }
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
    var _ctMap={feed:'feed',groups:'groups',messages:'messages',notifications:'notifications'};
    document.body.innerHTML = '<div class="gh-shell">'+topbar(_ctMap[opts.active]||'')+
      '<div class="gh-layout">'+leftNav(opts.active||'')+'<main class="gh-center" id="ghCenter"></main>'+rightRail(opts.right||'')+'</div></div>';
    $('#ghCenter').innerHTML = opts.center || '';
    bindShell();
    updateTopUser();
    bindAuthState();
    listenBadges();
  }

  function injectShellNav(activePage){
    if(document.querySelector('.gh-topbar')) return;
    document.body.classList.add('gh-social-body','gh-fb-inspired','gh-has-injected-nav');
    initTheme();
    var tbDiv=document.createElement('div');
    tbDiv.innerHTML=topbar();
    document.body.insertBefore(tbDiv.firstChild, document.body.firstChild);
    var lvDiv=document.createElement('div');
    lvDiv.innerHTML=leftNav(activePage);
    document.body.insertBefore(lvDiv.firstChild, document.body.children[1]||null);
    bindShell();
    updateTopUser();
    bindAuthState();
    listenBadges();
  }

  function topbar(centerActive){
    function ca(t){ return centerActive===t?' class="active"':''; }
    return '<header class="gh-topbar gh-hub-topbar">'+
      '<a class="gh-brand" href="feed.html"><div class="gh-brand-mark">GH</div><span>Geo<span>Hub</span></span></a>'+
      '<div class="gh-top-search"><i class="fas fa-search"></i><input id="ghGlobalSearch" placeholder="მოძებნე ადგილები, ადამიანები, ჯგუფები…"></div>'+
      '<nav class="gh-center-tabs" aria-label="Primary navigation">'+
        '<a'+ca('feed')+' href="feed.html" title="Feed"><i class="fas fa-house"></i></a>'+
        '<a'+ca('groups')+' href="groups.html" title="Groups"><i class="fas fa-user-group"></i></a>'+
        '<a'+ca('messages')+' id="ghMsgLink" href="messages.html" title="Messages"><i class="fas fa-comment-dots"></i><b class="gh-badge-count" id="ghMsgBadge"></b></a>'+
        '<button type="button" id="ghNotifBtn" title="Notifications"><i class="fas fa-bell"></i><b class="gh-badge-count" id="ghNotifBadge"></b></button>'+
      '</nav>'+
      '<div class="gh-top-actions">'+
        '<button class="gh-icon-btn gh-sidebar-toggle" id="ghSidebarToggle" title="Collapse sidebar"><i class="fas fa-bars-staggered"></i></button>'+
        '<a class="gh-icon-btn" href="settings.html" title="Settings" aria-label="Settings"><i class="fas fa-gear"></i></a>'+
        '<button class="gh-icon-btn gh-theme-toggle" id="ghThemeToggle" title="Toggle light/dark mode"><i class="fas fa-moon"></i></button>'+
        '<div id="ghActorBtnSlot" class="gh-actor-btn-slot"></div>'+
      '</div></header>';
  }

  function leftNav(active){
    var items=[
      ['feed','feed.html','fa-house','მთავარი Feed'],['places','places.html','fa-location-dot','Places'],['map','map.html','fa-map','Map'],['videos','videos.html','fa-film','Videos'],['reels','reels.html','fa-bolt','Reels'],['place-feed','place-feed.html','fa-store','Place Updates'],['business','business.html','fa-store','Businesses'],['groups','groups.html','fa-users','Groups'],['events','events.html','fa-calendar-xmark','Events'],['messages','messages.html','fa-comment-dots','Messages'],['notifications','notifications.html','fa-bell','Notifications'],['rewards','rewards.html','fa-gift','Rewards / Points'],['challenges','challenges.html','fa-trophy','Challenges'],['services','services.html','fa-grip','Services'],['realestate','real-estate.html','fa-house-chimney','Real Estate'],['learning','learning.html','fa-graduation-cap','Learning'],['creators','creators.html','fa-camera-retro','Creators'],['trust','trust.html','fa-shield-halved','Trust / Safety'],['admin','admin.html','fa-user-shield','Admin Panel']
    ];
    items.splice(Math.max(items.length - 1, 0), 0, ['settings','settings.html','fa-gear','Settings']);
    return '<aside class="gh-left"><nav class="gh-panel">'+items.map(function(it){return '<a class="gh-nav-item '+(active===it[0]?'active':'')+'" href="'+it[1]+'"><i class="fas '+it[2]+'"></i><span>'+it[3]+'</span></a>';}).join('')+'<button class="gh-nav-tour-btn" data-start-tour><i class="fas fa-question-circle"></i><span>How GeoHub works</span></button>'+'</nav></aside>';
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
    var themeBtn=$('#ghThemeToggle');
    if(themeBtn){ themeBtn.onclick=function(e){ e.preventDefault(); e.stopPropagation(); var effective=document.documentElement.getAttribute('data-gh-theme')||'dark'; applyTheme(effective==='dark' ? 'light' : 'dark'); }; applyTheme(state.theme); }
    var sideBtn=$('#ghSidebarToggle');
    if(sideBtn){ sideBtn.onclick=function(e){ e.preventDefault(); e.stopPropagation(); state.sidebarCollapsed=!state.sidebarCollapsed; document.body.classList.toggle('gh-sidebar-collapsed', state.sidebarCollapsed); sideBtn.setAttribute('aria-pressed', state.sidebarCollapsed ? 'true' : 'false'); sideBtn.title = state.sidebarCollapsed ? 'Expand sidebars' : 'Collapse sidebars'; }; }
    if(!state._shellClickBound){
      state._shellClickBound=true;
      document.addEventListener('click', function(e){
        if(e.target.closest('[data-create-post]')){ e.preventDefault(); e.stopPropagation(); openPostModal(buildActorExtra()); return; }
        if(e.target.closest('[data-create-story]')){ e.preventDefault(); e.stopPropagation(); openStoryModal(); return; }
        if(e.target.closest('#ghNotifBtn')) openNotifications();
        if(e.target.closest('[data-start-tour]')){ var _tu=authUser(); startTour(_tu?_tu.uid:null); }
        var notif=e.target.closest('[data-notif]');
        if(notif && GS() && GS().markNotificationRead) GS().markNotificationRead(notif.dataset.notif);
      });
    }
    var gs=$('#ghGlobalSearch');
    if(gs){
      var _gsDrop=null,_gsTimer=null,_gsIdx=-1,_gsRecentCache=null;
      function _gsClose(){if(_gsDrop){_gsDrop.remove();_gsDrop=null;}_gsIdx=-1;}
      function _gsMountDrop(html){
        _gsClose();
        var rect=gs.getBoundingClientRect();
        var w=Math.min(Math.max(rect.width,280),window.innerWidth-24);
        var l=Math.min(rect.left,window.innerWidth-w-12);
        _gsDrop=document.createElement('div');
        _gsDrop.className='gh-search-drop';
        _gsDrop.style.cssText='top:'+(rect.bottom+4)+'px;left:'+l+'px;width:'+w+'px;';
        _gsDrop.innerHTML=html;
        document.body.appendChild(_gsDrop);
      }
      function _gsRowHtml(it){
        var avHtml=it.avatar
          ?'<img src="'+esc(it.avatar)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
          :'<i class="fas '+esc(it.icon)+'"></i>';
        return '<a class="gh-search-row" href="'+esc(it.href)+'" data-gs-item>'
          +'<span class="gh-search-row-icon gh-sri-'+esc(it.type)+'">'+avHtml+'</span>'
          +'<span class="gh-search-row-body"><span class="gh-search-row-name">'+esc(it.label)+'</span>'
          +(it.sub?'<span class="gh-search-row-sub">'+esc(it.sub)+'</span>':'')
          +'</span></a>';
      }
      function _gsLoadRecent(cb){
        if(_gsRecentCache!==null){cb(_gsRecentCache);return;}
        var u=authUser();if(!u||!fs()){_gsRecentCache=[];cb([]);return;}
        fs().getDoc(fs().doc(db(),'users',u.uid)).then(function(snap){
          var h=[];if(snap.exists()){var d=snap.data()||{};h=Array.isArray(d.searchHistory)?d.searchHistory.slice(0,10):[];}
          _gsRecentCache=h;cb(h);
        }).catch(function(){_gsRecentCache=[];cb([]);});
      }
      function _gsSaveRecent(q){
        q=(q||'').trim();if(!q) return;
        var u=authUser();if(!u||!fs()) return;
        var h=Array.isArray(_gsRecentCache)?_gsRecentCache.filter(function(x){return x!==q;}).slice(0,9):[];
        h.unshift(q);_gsRecentCache=h;
        fs().updateDoc(fs().doc(db(),'users',u.uid),{searchHistory:h}).catch(function(){});
      }
      function _gsShowRecent(){
        _gsLoadRecent(function(history){
          if(!history.length) return;
          var html='<div class="gh-search-section">Recent</div>'
            +history.slice(0,5).map(function(q){
              return '<a class="gh-search-row gh-search-recent" href="search.html?q='+encodeURIComponent(q)+'" data-gs-item>'
                +'<span class="gh-search-row-icon gh-sri-recent"><i class="fas fa-clock"></i></span>'
                +'<span class="gh-search-row-body"><span class="gh-search-row-name">'+esc(q)+'</span></span>'
                +'</a>';
            }).join('')
            +'<a class="gh-search-see-all" href="search.html">Open search <i class="fas fa-arrow-right"></i></a>';
          _gsMountDrop(html);
          if(_gsDrop) _gsDrop.querySelectorAll('[data-gs-item]').forEach(function(a){
            a.addEventListener('click',function(){gs.value='';_gsClose();});
          });
        });
      }
      function _gsShowResults(items,q){
        var seAll='<a class="gh-search-see-all" href="search.html?q='+encodeURIComponent(q)+'" data-gs-seeall>'
          +'See all results for “'+esc(q)+'” <i class="fas fa-arrow-right"></i></a>';
        var html=(!items.length
          ?'<div class="gh-search-empty">No results for <strong>'+esc(q)+'</strong></div>'
          :items.map(_gsRowHtml).join(''))+seAll;
        _gsMountDrop(html);
        if(_gsDrop) _gsDrop.querySelectorAll('[data-gs-item],[data-gs-seeall]').forEach(function(a){
          a.addEventListener('click',function(){_gsSaveRecent(q);gs.value='';_gsClose();});
        });
      }
      gs.addEventListener('keydown',function(e){
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){
          e.preventDefault();
          if(!_gsDrop) return;
          var rows=[].slice.call(_gsDrop.querySelectorAll('[data-gs-item],[data-gs-seeall]'));
          if(!rows.length) return;
          _gsIdx=(e.key==='ArrowDown')?Math.min(_gsIdx+1,rows.length-1):Math.max(_gsIdx-1,0);
          rows.forEach(function(r,i){r.classList.toggle('gh-search-active',i===_gsIdx);});
          if(rows[_gsIdx]) rows[_gsIdx].scrollIntoView({block:'nearest'});
          return;
        }
        if(e.key==='Enter'){
          if(_gsIdx>=0&&_gsDrop){var act=_gsDrop.querySelectorAll('[data-gs-item],[data-gs-seeall]')[_gsIdx];if(act){act.click();return;}}
          var q=gs.value.trim();if(!q) return;
          _gsSaveRecent(q);_gsClose();
          var _sri=document.getElementById('srchInput');
          if(_sri){_sri.value=q;_sri.dispatchEvent(new Event('input'));gs.blur();}
          else{location.href='search.html?q='+encodeURIComponent(q);}
          return;
        }
        if(e.key==='Escape'){_gsClose();gs.blur();}
      });
      document.addEventListener('click',function(e){if(_gsDrop&&!gs.contains(e.target)&&!_gsDrop.contains(e.target)) _gsClose();});
      gs.addEventListener('focus',function(){
        if(document.getElementById('srchInput')) return; // search page drives its own input
        if(!gs.value.trim()&&!_gsDrop) _gsShowRecent();
      });
      gs.addEventListener('input',function(){
        var q=gs.value.trim();
        clearTimeout(_gsTimer);_gsIdx=-1;
        var _sri=document.getElementById('srchInput');
        if(_sri){_sri.value=gs.value;_sri.dispatchEvent(new Event('input'));_gsClose();return;}
        if(!q){_gsClose();_gsShowRecent();return;}
        _gsTimer=setTimeout(function(){
          var geo=GS();if(!geo||!geo.searchFirestore) return;
          _gsMountDrop('<div class="gh-search-loading"><i class="fas fa-circle-notch fa-spin"></i> Searching…</div>');
          geo.searchFirestore(q,function(res){
            if(gs.value.trim()!==q) return;
            var items=[];
            (res.users||[]).slice(0,3).forEach(function(u){items.push({type:'user',icon:'fa-user',avatar:u.photoURL||u.avatar||u.avatarUrl||u.photo||'',label:u.fullName||u.displayName||u.name||'User',sub:'@'+(u.username||u.id||''),href:'profile.html?id='+encodeURIComponent(u.id||u.uid||'')});});
            (res.businesses||[]).filter(function(b){return !isDeletedBiz(b);}).slice(0,3).forEach(function(b){items.push({type:'business',icon:'fa-store',avatar:b.logoUrl||b.coverImageUrl||b.coverUrl||b.imageUrl||b.photoUrl||'',label:b.name||'Business',sub:b.city||b.category||'Business',href:'business.html?id='+encodeURIComponent(b.id||'')});});
            (res.places||[]).slice(0,2).forEach(function(p){items.push({type:'place',icon:'fa-map-marker-alt',avatar:p.imageUrl||p.photoUrl||p.coverUrl||p.coverImageUrl||'',label:p.name||'Place',sub:p.address||p.category||p.city||'Place',href:'places.html?id='+encodeURIComponent(p.id||'')});});
            (res.groups||[]).slice(0,1).forEach(function(g){items.push({type:'group',icon:'fa-users',avatar:g.logoUrl||g.coverImageUrl||g.coverUrl||g.imageUrl||g.photoUrl||'',label:g.name||'Group',sub:(g.memberCount||0)+' members',href:'groups.html?id='+encodeURIComponent(g.id||'')});});
            (res.events||[]).slice(0,1).forEach(function(ev){items.push({type:'event',icon:'fa-calendar',avatar:'',label:ev.name||ev.title||'Event',sub:ev.location||ev.city||'Event',href:'events.html?id='+encodeURIComponent(ev.id||'')});});
            _gsShowResults(items,q);
          });
        },280);
      });
    }
    if(window.requestIdleCallback) requestIdleCallback(loadRightRail, { timeout: 2500 });
    else setTimeout(loadRightRail, 700);
    // Register global listeners once only — bindShell() may be called on every page navigation
    if(!state._shellListenersRegistered){
      state._shellListenersRegistered=true;
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
      // Re-render topbar + composer on every actor change (account switcher), global across all pages
      window.addEventListener('GeoActorChanged', function(){
        updateTopUser();
        listenBadges();
        if(PAGE==='feed' || PATH==='feed.html' || PATH==='index.html'){
          renderFeed();
        }
      });
    }
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
    // Determine topbar + composer identity: business actor overrides user
    var _actor=getActiveActor();
    var topName=displayName, topAvatar=displayAvatar, topHref=profileLink(u.uid);
    if(_actor&&_actor.type==='business'){
      topName=_actor.title||'Business'; topAvatar=_actor.logoUrl||'';
      topHref='business.html?id='+encodeURIComponent(_actor.businessId||'');
    }
    if(av){ av.className='gh-avatar'; av.innerHTML=topAvatar?img(topAvatar,topName):esc(initials(topName||'')); }
    if(nm){ nm.className=''; nm.textContent=(topName||'').split(' ')[0]||'Me'; }
    if(link) link.setAttribute('href', topHref);
    document.querySelectorAll('.gh-nav-item').forEach(function(a){
      var txt=(a.textContent||'').trim().toLowerCase();
      if(txt==='profile'){
        a.setAttribute('href',(_actor&&_actor.type==='business'&&_actor.businessId)
          ?'business.html?id='+encodeURIComponent(_actor.businessId)
          :profileLink(u.uid));
      }
      if(txt==='saved') a.setAttribute('href', profileLink(u.uid)+'&tab=saved');
    });
    // Update composer avatar with active actor identity
    var ca=$('#ghComposerAvatar');
    if(ca){ ca.className='gh-avatar'; ca.innerHTML=topAvatar?img(topAvatar,topName):esc(initials(topName||'')); }
    // Persist to cache (always real user data, not actor data)
    setCachedUser({uid:u.uid,name:displayName,avatar:displayAvatar});
    // Actor-aware: update messages link in topbar + left nav
    var msgsHref=actorMessagesHref(_actor);
    var msgLink=document.getElementById('ghMsgLink');
    if(msgLink) msgLink.setAttribute('href',msgsHref);
    document.querySelectorAll('.gh-nav-item').forEach(function(a){
      if(a.querySelector('.fa-comment-dots')) a.setAttribute('href',msgsHref);
    });
    // Page mode banner
    updatePageModeBanner(_actor,topName);
  }

  function updatePageModeBanner(_actor,topName){
    var banner=document.getElementById('ghPageModeBanner');
    if(!banner){
      banner=document.createElement('div');
      banner.id='ghPageModeBanner';
      banner.style.display='none';
      var layout=document.querySelector('.gh-layout');
      if(layout&&layout.parentNode){ layout.parentNode.insertBefore(banner,layout); }
      else{
        var msgPage=document.querySelector('.messages-page');
        if(msgPage){ msgPage.insertBefore(banner,msgPage.firstChild); }
        else{
          var mainEl=document.querySelector('main');
          if(mainEl){ mainEl.insertBefore(banner,mainEl.firstChild); }
          else{ document.body.appendChild(banner); }
        }
      }
    }
    var isBiz=_actor&&_actor.type==='business'&&_actor.businessId;
    if(isBiz){
      banner.style.display='';
      banner.innerHTML='<div class="gh-pmb-inner">'+
        '<i class="fas fa-store"></i> Using GeoHub as <strong>'+esc(topName||'Business')+'</strong>'+
        '<div class="gh-pmb-actions">'+
          '<a class="gh-pmb-action" href="business.html?id='+encodeURIComponent(_actor.businessId)+'" title="View Page"><i class="fas fa-arrow-up-right-from-square"></i> View Page</a>'+
          '<a class="gh-pmb-action" href="messages.html?business='+encodeURIComponent(_actor.businessId)+'" title="Business Inbox"><i class="fas fa-comment-dots"></i> Inbox</a>'+
          '<button class="gh-pmb-switch" onclick="if(window._geoSW&&window._geoSW.switchToUser){window._geoSW.switchToUser();}else{try{localStorage.removeItem(\'gh_active_actor\');}catch(e){}window.dispatchEvent(new CustomEvent(\'GeoActorChanged\',{detail:{type:\'user\'}}));}">Switch Back</button>'+
        '</div>'+
      '</div>';
    } else {
      banner.style.display='none';
      banner.innerHTML='';
    }
  }

  function validateActorOnLoad(){
    var actor=getActiveActor();
    if(!actor||actor.type!=='business'||!actor.businessId) return;
    if(!fs()||!db()) return;
    var uid=authUser()&&authUser().uid; if(!uid) return;
    // Verify business still exists, is not deleted, and current user is still an admin
    Promise.all([
      fs().getDoc(fs().doc(db(),'businesses',actor.businessId)),
      fs().getDoc(fs().doc(db(),'businessAdmins',actor.businessId+'_'+uid))
    ]).then(function(results){
      var bizSnap=results[0], adminSnap=results[1];
      var bizData=bizSnap.exists()?bizSnap.data():{};
      var isOwner=bizData.ownerId===uid||bizData.ownerUid===uid;
      var isAdmin=adminSnap.exists();
      if(!bizSnap.exists()||bizData.status==='deleted'||bizData.deleted===true||(!isOwner&&!isAdmin)){
        // Business gone or user is neither owner nor admin — reset actor to user
        try{localStorage.removeItem('gh_active_actor');}catch(e){}
        window.dispatchEvent(new CustomEvent('GeoActorChanged',{detail:{type:'user',uid:uid}}));
        return;
      }
      // Refresh stored actor with fresh name/logo
      var fresh=Object.assign({},actor,{
        title:bizData.title||bizData.name||actor.title||'Business',
        logoUrl:bizData.logoUrl||bizData.logo||bizData.avatar||actor.logoUrl||'',
        coverUrl:bizData.coverUrl||bizData.coverImage||actor.coverUrl||''
      });
      try{localStorage.setItem('gh_active_actor',JSON.stringify(fresh));}catch(e){}
      var changed = fresh.title !== actor.title || fresh.logoUrl !== actor.logoUrl || fresh.coverUrl !== actor.coverUrl;
      if(changed) window.dispatchEvent(new CustomEvent('GeoActorChanged',{detail:fresh}));
    }).catch(function(){});
  }

  function bindAuthState(){
    var gf=GF();
    if(!gf || !gf.authFns || !gf.authFns.onAuthStateChanged || !gf.auth) return;
    if(state.authUnsub){ try{ state.authUnsub(); }catch(e){} state.authUnsub=null; }
    state.authUnsub = gf.authFns.onAuthStateChanged(gf.auth, function(fbUser){
      if(!fbUser){ clearCachedUser(); try{localStorage.removeItem('gh_active_actor');}catch(e){} }
      updateTopUser();
      listenBadges();
      if(fbUser) validateActorOnLoad();
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
        state.badgeUnsubs.push(listenCurrentActorNotifications(function(items){ var n=items.filter(function(x){return !x.read && !x.seen;}).length; var b=$('#ghNotifBadge'); if(b) b.textContent=n?String(n):''; }));
        var _msgActor=getActiveActor();
        var _msgQ;
        if(_msgActor&&_msgActor.type==='business'&&_msgActor.businessId){
          _msgQ=fs().query(fs().collection(db(),'conversations'),fs().where('businessId','==',_msgActor.businessId),fs().limit(25));
          state.badgeUnsubs.push(fs().onSnapshot(_msgQ,function(snap){ var n=0; snap.forEach(function(d){ var x=d.data()||{}; if(Array.isArray(x.unreadFor)&&x.unreadFor.indexOf(u.uid)>-1) n++; }); var b=$('#ghMsgBadge'); if(b) b.textContent=n?String(n):''; },function(){}));
        } else {
          _msgQ=fs().query(fs().collection(db(),'conversations'),fs().where('participants','array-contains',u.uid),fs().limit(25));
          state.badgeUnsubs.push(fs().onSnapshot(_msgQ,function(snap){ var n=0; snap.forEach(function(d){ var x=d.data()||{}; if(x.lastSenderId&&x.lastSenderId!==u.uid&&Array.isArray(x.unreadFor)&&x.unreadFor.indexOf(u.uid)>-1) n++; }); var b=$('#ghMsgBadge'); if(b) b.textContent=n?String(n):''; },function(){}));
        }
      }catch(e){}
    });
  }

  function loadRightRail(){
    ready(function(){
      if($('#ghRightStories')) loadStories('#ghRightStories', true);
      var list=$('#ghSuggestions'); if(!list) return;
      var uid=authUser()&&authUser().uid;
      loadUserCity(uid, function(city){
        Promise.all([getLatest('groups',10), getLatest('places',10), getLatest('events',15), getLatest('rewards',3)]).then(function(res){
          var allGroups=res[0], allPlaces=res[1], allEvents=res[2], rewards=res[3];
          // Upcoming events only — filter out past events first, then city-filter
          var upcomingEvts=allEvents.filter(function(e){ return isFutureTsVal(e.startDate||e.date); });
          var groups=cityFilter(allGroups.filter(function(g){return (g.privacy||'public')!=='secret';}), city).slice(0,4);
          var places=cityFilter(allPlaces, city).slice(0,4);
          var events=cityFilter(upcomingEvts, city, ['city','location']).slice(0,3);
          var cityLabel=city?' in '+esc(city):'';
          if(!groups.length){ list.innerHTML='<div class="gh-empty mini"><i class="fas fa-users"></i><h3>No groups yet</h3><p>Real groups appear after creation.</p></div>'; }
          else { list.innerHTML=groups.map(function(x){ var title=x.name||x.title||'Untitled'; var photo=x.logoUrl||x.coverImageUrl||x.coverUrl||x.imageUrl||x.photoUrl; return '<a class="gh-mini-item" href="'+docLink('group',x.id)+'"><span class="gh-mini-thumb">'+(photo?img(photo,title):'<i class="fas fa-users"></i>')+'</span><div><strong>'+esc(title)+'</strong><span>'+esc(x.category||x.city||'Group')+'</span></div></a>'; }).join(''); }
          var pl=$('#ghRightPlaces');
          if(pl){
            var pTitle=pl.closest('.gh-panel'); if(pTitle){ var h3=pTitle.querySelector('h3'); if(h3&&city) h3.textContent='Nearby Places'+cityLabel; }
            pl.innerHTML = places.length ? places.map(function(x){ var title=x.name||x.title||'Untitled'; var photo=x.imageUrl||x.photoUrl||x.coverUrl||x.coverImageUrl; return '<a class="gh-mini-item" href="'+docLink('place',x.id)+'"><span class="gh-mini-thumb">'+(photo?img(photo,title):'<i class="fas fa-location-dot"></i>')+'</span><div><strong>'+esc(title)+'</strong><span>'+esc(x.city||x.region||x.category||'Place')+'</span></div></a>'; }).join('') : '<div class="gh-empty mini"><i class="fas fa-location-dot"></i><h3>No places yet</h3><p>Real places appear after admin adds them.</p></div>';
          }
          var ev=$('#ghRightEvents');
          if(ev){
            var evPanel=ev.closest('.gh-panel'); if(evPanel){ var evH3=evPanel.querySelector('h3'); if(evH3) evH3.textContent='Upcoming Events'+(cityLabel||''); }
            ev.innerHTML = events.length ? events.map(function(x){ var title=x.name||x.title||'Untitled'; var when=x.startDate||x.date; var whenStr=when?timeAgo(when):''; return '<a class="gh-mini-item" href="events.html?id='+esc(x.id)+'"><span class="gh-mini-thumb event"><i class="fas fa-calendar"></i></span><div><strong>'+esc(title)+'</strong><span>'+esc(x.city||x.location||whenStr)+'</span></div></a>'; }).join('') : '<div class="gh-empty mini"><i class="fas fa-calendar"></i><h3>No upcoming events</h3><p>'+esc(city?'No upcoming events in '+city+' yet.':'Create the first event!')+'</p></div>';
          }
          var rw=$('#ghRightRewards'); if(rw){ rw.innerHTML = rewards.length ? rewards.map(function(x){ var title=x.name||x.title||'Untitled'; var pts=x.points||x.cost||x.price||''; return '<a class="gh-mini-item" href="rewards.html"><span class="gh-mini-thumb reward"><i class="fas fa-gift"></i></span><div><strong>'+esc(title)+'</strong><span>'+esc(pts?pts+' points':'Reward')+'</span></div></a>'; }).join('') : '<div class="gh-empty mini"><i class="fas fa-gift"></i><h3>No rewards yet</h3><p>Real rewards appear after admin adds them.</p></div>'; }
        });
      });
    });
  }

  function isDeletedBiz(b){ return !b || b.status==='deleted' || b.deleted===true || !!b.deletedAt; }

  function getLatest(collectionName, n){
    if(!GF()) return Promise.resolve([]);
    return fs().getDocs(fs().query(fs().collection(db(), collectionName), fs().limit(n||10))).then(function(snap){ var arr=[]; snap.forEach(function(d){ arr.push(Object.assign({id:d.id}, d.data())); }); arr.sort(function(a,b){ return ts(b.createdAt)-ts(a.createdAt); }); return arr; }).catch(function(){ return []; });
  }

  function loadUserCity(uid, cb){
    if(state.userCity !== null){ cb(state.userCity||''); return; }
    if(!uid||!fs()||!db()){ state.userCity=''; cb(''); return; }
    fs().getDoc(fs().doc(db(),'users',uid)).then(function(snap){
      var c=snap.exists()?((snap.data()||{}).city||''):'';
      state.userCity=(c==='all_georgia'?'':c);
      cb(state.userCity);
    }).catch(function(){ state.userCity=''; cb(''); });
  }

  function cityFilter(items, city, fields){
    if(!city) return items;
    fields=fields||['city','location','address'];
    var low=city.toLowerCase();
    var matched=items.filter(function(x){ return fields.some(function(f){ return (x[f]||'').toLowerCase()===low; }); });
    return matched.length?matched:items;
  }

  function isFutureTsVal(val){
    if(!val) return false;
    return ts(val)>Date.now();
  }

  var GH_NOTIF_ICONS = {
    like:            { icon: 'fa-heart',       color: '#ef4444' },
    comment:         { icon: 'fa-comment',     color: '#3b82f6' },
    reply:           { icon: 'fa-reply',       color: '#8b5cf6' },
    follow:          { icon: 'fa-user-plus',   color: '#10b981' },
    message:         { icon: 'fa-envelope',    color: '#06b6d4' },
    reward:          { icon: 'fa-gift',        color: '#f59e0b' },
    badge:           { icon: 'fa-medal',       color: '#f59e0b' },
    challenge:       { icon: 'fa-trophy',      color: '#f59e0b' },
    story_reply:     { icon: 'fa-film',        color: '#ec4899' },
    story_reaction:  { icon: 'fa-star',        color: '#f97316' },
    friend_request:  { icon: 'fa-user-clock',  color: '#10b981' },
    friend_accept:   { icon: 'fa-handshake',   color: '#22d3ee' },
    points_received: { icon: 'fa-coins',       color: '#eab308' },
    quote:           { icon: 'fa-file-invoice',color: '#6366f1' },
    quote_request:   { icon: 'fa-file-invoice',color: '#6366f1' },
    business_review: { icon: 'fa-star',        color: '#f59e0b' },
    business_follow: { icon: 'fa-store',       color: '#10b981' },
    coupon_redeemed:     { icon: 'fa-ticket-alt',  color: '#10b981' },
    group_join_request:  { icon: 'fa-user-clock',  color: '#a855f7' },
    group_approved:      { icon: 'fa-user-check',  color: '#10b981' },
    group_declined:      { icon: 'fa-user-times',  color: '#ef4444' }
  };

  function openNotifications(){
    if(!requireLogin()) return;
    var existing=$('#ghNotifModal'); if(existing){existing.remove();return;}
    var notifActor = notificationActor();
    var notifTitle = notifActor.type === 'business' ? (notifActor.title + ' Activity') : 'Notifications';
    modal(notifTitle,'<div id="ghNotifList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading…</h3></div></div>','<button class="gh-btn ghost" id="ghMarkAllRead">Mark all read</button><a class="gh-btn ghost" href="notifications.html">View all</a><button class="gh-btn ghost" data-close-modal>Close</button>','ghNotifModal');
    ready(function(){
      $('#ghMarkAllRead').onclick=function(){ markVisibleNotificationsRead(); };
      var unsub = listenCurrentActorNotifications(function(items){
        var box=$('#ghNotifList'); if(!box) return;
        var visibleNotifs=items.filter(function(n){ var actor=n.actorId||n.fromUserId||n.senderId||n.authorId||''; return !actor||state.blockedUserIds.indexOf(actor)===-1; });
        if(!visibleNotifs.length){ var empty=notificationEmptyCopy(notificationActor()); box.innerHTML='<div class="gh-empty"><i class="fas fa-bell"></i><h3>'+esc(empty.title)+'</h3><p>'+esc(empty.body)+'</p></div>'; return; }
        box.innerHTML='<div class="gh-mini-list">'+visibleNotifs.slice(0,30).map(function(n){
          var ic=GH_NOTIF_ICONS[n.type]||{icon:'fa-bell',color:'#10b981'};
          var bAv=n.fromAvatar||''; var bInit=((n.fromName||'G')[0]||'G').toUpperCase();
          var bAvHtml=bAv
            ?'<img class="gh-notif-av-img" src="'+esc(bAv)+'" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
              +'<div class="gh-notif-av-fb" style="display:none">'+esc(bInit)+'</div>'
            :'<div class="gh-notif-av-fb">'+esc(bInit)+'</div>';
          return '<a class="gh-mini-item '+(!n.read?'unread':'')+'" href="'+esc(n.href||'notifications.html')+'" data-notif="'+esc(n.id)+'">'
            +'<div class="gh-notif-av"><div class="gh-notif-av-wrap">'+bAvHtml+'</div>'
            +'<span class="gh-notif-av-badge" style="background:'+ic.color+'"><i class="fas '+ic.icon+'"></i></span></div>'
            +'<div class="gh-notif-body"><strong>'+esc(n.title||'GeoHub')+'</strong>'
            +'<span class="gh-notif-sub">'+esc((n.body||n.message||'').slice(0,60))+'</span>'
            +'<span class="gh-notif-time">'+timeAgo(n.createdAt)+'</span></div></a>';
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

  var BG_GRADIENTS = [
    'linear-gradient(135deg,#10b981,#064e3b)',
    'linear-gradient(135deg,#3b82f6,#1e40af)',
    'linear-gradient(135deg,#8b5cf6,#4c1d95)',
    'linear-gradient(135deg,#f59e0b,#92400e)',
    'linear-gradient(135deg,#ec4899,#831843)',
    'linear-gradient(135deg,#06b6d4,#0e7490)',
    'linear-gradient(135deg,#0f172a,#1e293b)',
    'linear-gradient(135deg,#ef4444,#991b1b)'
  ];
  var FEELINGS = [
    '😊 Happy','😂 Laughing','😍 Loved','😢 Sad','😠 Angry',
    '🎉 Celebrating','💪 Motivated','🙏 Grateful','🎂 Birthday','🏖️ Traveling'
  ];

  function openPostModal(extra){
    if(!requireLogin()) return;
    extra = extra || {};

    // Build actor / destination row
    var actor = getActiveActor();
    var me = currentUserInfo();
    var isBusinessActor = actor && actor.type === 'business';
    var actorName = isBusinessActor ? (actor.title || 'Business') : (me.name || 'You');
    var actorAvatar = isBusinessActor ? (actor.logoUrl || '') : (me.avatar || '');
    var destination = isBusinessActor
      ? 'Posting as ' + actorName
      : (extra._groupName ? 'Posting in ' + extra._groupName : 'Posting to your profile');
    var actorAvHtml = actorAvatar
      ? '<img src="'+esc(actorAvatar)+'" alt="" onerror="this.style.display=\'none\'">'
      : esc(initials(actorName));

    var body =
      '<div class="gh-cmp-actor-row">'+
        '<span class="gh-avatar gh-cmp-actor-av">'+actorAvHtml+'</span>'+
        '<div class="gh-cmp-actor-info">'+
          '<strong>'+esc(actorName)+'</strong>'+
          '<span class="gh-cmp-destination"><i class="fas fa-earth-europe"></i> '+esc(destination)+'</span>'+
        '</div>'+
      '</div>'+
      '<div id="ghPollComposer" style="display:none">'+
        '<textarea class="gh-textarea" id="ghPollQuestion" placeholder="Ask a question…" rows="2"></textarea>'+
        '<div id="ghPollOpts">'+
          '<input class="gh-input" style="margin-bottom:7px" data-poll-opt placeholder="Option 1">'+
          '<input class="gh-input" style="margin-bottom:7px" data-poll-opt placeholder="Option 2">'+
        '</div>'+
        '<button class="gh-btn ghost" id="ghPollAddOpt" type="button" style="margin-bottom:10px"><i class="fas fa-plus"></i> Add option</button>'+
        '<select class="gh-select" id="ghPollDuration"><option value="1">1 day</option><option value="3" selected>3 days</option><option value="7">7 days</option></select>'+
      '</div>'+
      '<div id="ghRegularComposer">'+
        '<textarea class="gh-textarea gh-cmp-textarea" id="ghPostText" placeholder="What\'s on your mind?" rows="4"></textarea>'+
        '<div id="ghLinkPreviewCard" style="display:none" class="gh-lp-composer-preview"></div>'+
        '<div class="gh-feeling-row" id="ghFeelingRow">'+FEELINGS.map(function(f){ return '<button type="button" class="gh-feeling-chip" data-feeling="'+esc(f)+'">'+esc(f)+'</button>'; }).join('')+'</div>'+
        '<div id="ghSelectedFeeling" style="display:none;font-size:.84rem;color:var(--gh-green);margin:4px 0 8px;padding:4px 10px;background:rgba(16,185,129,.08);border-radius:10px"></div>'+
        '<div class="gh-bg-picker" id="ghBgPicker" style="display:none">'+BG_GRADIENTS.map(function(g,i){ return '<button type="button" class="gh-bg-swatch" data-bg-gradient="'+esc(g)+'" style="background:'+esc(g)+'"'+(i===0?' title="No color"':'')+' aria-label="Color '+i+'"></button>'; }).join('')+'<button type="button" class="gh-bg-swatch gh-bg-none" data-bg-gradient="" title="No color"><i class="fas fa-times"></i></button></div>'+
        '<div id="ghCmpMediaGrid" class="gh-cmp-media-grid"></div>'+
      '</div>'+
      '<div class="gh-cmp-footer-row">'+
        '<select class="gh-select gh-cmp-vis-select" id="ghPostVisibility"><option value="public">🌍 Public</option><option value="followers">👁 Followers</option><option value="close_friends">⭐ Close Friends</option><option value="onlyme">🔒 Only Me</option></select>'+
      '</div>'+
      '<div class="gh-cmp-toolbar">'+
        '<button class="gh-cmp-tool" id="ghPickPostImage" type="button" title="Add photos"><i class="fas fa-image"></i><span>Photo</span></button>'+
        '<button class="gh-cmp-tool" id="ghTogglePoll" type="button" title="Create poll"><i class="fas fa-chart-bar"></i><span>Poll</span></button>'+
        '<button class="gh-cmp-tool" id="ghToggleFeeling" type="button" title="Feeling or activity"><i class="fas fa-face-smile"></i><span>Feeling</span></button>'+
        '<button class="gh-cmp-tool" id="ghToggleBg" type="button" title="Background color"><i class="fas fa-palette"></i><span>Background</span></button>'+
      '</div>'+
      '<input type="file" id="ghPostFileInput" accept="image/*" multiple style="display:none">'+
      '<div class="gh-upload-progress" id="ghPostUploadBar" style="display:none"><div class="gh-upload-track"><div class="gh-upload-bar" id="ghPostUploadFill"></div></div><span id="ghPostUploadPct">0%</span></div>';

    var m = modal('Create post', body,
      '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitPost" disabled><i class="fas fa-paper-plane"></i> Post</button>',
      'ghPostModal');

    var pickedFiles=[], selectedFeeling='', selectedBg='', pollMode=false, feelingRowVisible=false, bgVisible=false;
    var _lpTimer=null, _lpUrl='';

    var ta=$('#ghPostText');

    // Auto-focus
    if(ta) { ta.focus(); }

    // Validate: enable/disable Post button
    function updateSubmit(){
      var btn=$('#ghSubmitPost'); if(!btn) return;
      var hasText = pollMode
        ? !!(($('#ghPollQuestion')||{}).value||'').trim()
        : !!(ta && ta.value.trim());
      btn.disabled = !(hasText || pickedFiles.length);
    }
    if(ta) ta.addEventListener('input', function(){
      updateSubmit();
      clearTimeout(_lpTimer);
      _lpTimer=setTimeout(function(){ detectAndLoadLinkPreview(ta.value); }, 700);
    });
    var pqEl=$('#ghPollQuestion');
    if(pqEl) pqEl.addEventListener('input', updateSubmit);

    // Dirty-state close confirmation (capture phase fires before the modal's bubble-phase close handler)
    m.addEventListener('click', function(e){
      if(e.target===m || e.target.closest('[data-close-modal]')){
        var textVal = pollMode ? (($('#ghPollQuestion')||{}).value||'') : (ta ? ta.value : '');
        if((textVal.trim() || pickedFiles.length) && !confirm('Discard your post?')){
          e.stopPropagation();
          e.preventDefault();
        }
      }
    }, true);

    // Multi-image preview grid
    function renderMediaGrid(){
      var grid=$('#ghCmpMediaGrid'); if(!grid) return;
      if(!pickedFiles.length){ grid.innerHTML=''; return; }
      grid.innerHTML=pickedFiles.map(function(f,i){
        var obj=URL.createObjectURL(f);
        return '<div class="gh-cmp-thumb">'+
          '<img src="'+esc(obj)+'" alt="" onload="URL.revokeObjectURL(this.src)">'+
          '<button type="button" class="gh-cmp-thumb-rm" data-rm-idx="'+i+'" title="Remove"><i class="fas fa-times"></i></button>'+
        '</div>';
      }).join('');
      grid.querySelectorAll('[data-rm-idx]').forEach(function(btn){
        btn.addEventListener('click', function(){
          pickedFiles.splice(Number(btn.dataset.rmIdx),1);
          renderMediaGrid();
          updateSubmit();
        });
      });
    }

    var fileInput=$('#ghPostFileInput');
    if(fileInput) fileInput.addEventListener('change', function(){
      var newFiles=Array.from(fileInput.files||[]);
      pickedFiles=pickedFiles.concat(newFiles).slice(0,4);
      fileInput.value='';
      renderMediaGrid();
      updateSubmit();
    });

    $('#ghPickPostImage').onclick=function(){ if(fileInput) fileInput.click(); };

    $('#ghTogglePoll').onclick=function(){
      pollMode=!pollMode;
      $('#ghPollComposer').style.display=pollMode?'':'none';
      $('#ghRegularComposer').style.display=pollMode?'none':'';
      this.classList.toggle('active',pollMode);
      updateSubmit();
    };

    $('#ghToggleFeeling').onclick=function(){
      feelingRowVisible=!feelingRowVisible;
      $('#ghFeelingRow').style.display=feelingRowVisible?'flex':'none';
      this.classList.toggle('active',feelingRowVisible);
    };
    $('#ghFeelingRow').style.display='none';

    $('#ghToggleBg').onclick=function(){
      bgVisible=!bgVisible;
      $('#ghBgPicker').style.display=bgVisible?'flex':'none';
      this.classList.toggle('active',bgVisible);
    };

    var feelingRow=$('#ghFeelingRow');
    if(feelingRow) feelingRow.addEventListener('click',function(e){
      var chip=e.target.closest('[data-feeling]'); if(!chip) return;
      selectedFeeling=chip.dataset.feeling===selectedFeeling?'':chip.dataset.feeling;
      feelingRow.querySelectorAll('.gh-feeling-chip').forEach(function(b){ b.classList.toggle('active', b.dataset.feeling===selectedFeeling); });
      var sf=$('#ghSelectedFeeling');
      if(sf){ sf.style.display=selectedFeeling?'block':'none'; sf.textContent=selectedFeeling?'Feeling: '+selectedFeeling:''; }
    });

    var bgPicker=$('#ghBgPicker');
    if(bgPicker) bgPicker.addEventListener('click',function(e){
      var sw=e.target.closest('[data-bg-gradient]'); if(!sw) return;
      selectedBg=sw.dataset.bgGradient;
      bgPicker.querySelectorAll('.gh-bg-swatch').forEach(function(b){ b.classList.toggle('active', b===sw); });
    });

    if($('#ghPollAddOpt')) $('#ghPollAddOpt').onclick=function(){
      var pollOptsEl=$('#ghPollOpts'); if(!pollOptsEl) return;
      var opts=$all('[data-poll-opt]', pollOptsEl); if(opts.length>=6) return;
      var inp=document.createElement('input'); inp.className='gh-input'; inp.style.marginBottom='7px'; inp.dataset.pollOpt=''; inp.placeholder='Option '+(opts.length+1);
      pollOptsEl.appendChild(inp); inp.addEventListener('input', updateSubmit);
    };

    function detectAndLoadLinkPreview(textVal){
      var urlMatch=textVal.match(/https?:\/\/[^\s]+/);
      if(!urlMatch){ hideLinkPreview(); return; }
      var url=urlMatch[0];
      if(url===_lpUrl) return;
      _lpUrl=url;
      var card=$('#ghLinkPreviewCard'); if(!card) return;
      card.style.display='block'; card.innerHTML='<i class="fas fa-circle-notch fa-spin gh-muted"></i>';
      fetch('https://api.allorigins.win/get?url='+encodeURIComponent(url))
        .then(function(r){ return r.json(); })
        .then(function(data){
          var html=data.contents||'';
          var title=(html.match(/<title[^>]*>([^<]+)<\/title>/i)||[])[1]||'';
          var desc=(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)||[])[1]||'';
          var img=(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)||[])[1]||'';
          var domain=url.replace(/^https?:\/\//,'').split('/')[0];
          if(!title){ hideLinkPreview(); return; }
          state._lpData={url:url,title:title.slice(0,120),description:desc.slice(0,200),image:img,domain:domain};
          card.style.display='block';
          card.innerHTML='<div class="gh-lp-composer-inner">'+(img?'<img src="'+esc(img)+'" loading="lazy" onerror="this.remove()">':'')+'<div><div class="gh-lp-domain">'+esc(domain)+'</div><div class="gh-lp-title">'+esc(title.slice(0,80))+'</div>'+(desc?'<div class="gh-lp-desc">'+esc(desc.slice(0,120))+'</div>':'')+'</div><button type="button" class="gh-lp-remove" id="ghRemoveLp"><i class="fas fa-times"></i></button></div>';
          var rmBtn=$('#ghRemoveLp'); if(rmBtn) rmBtn.onclick=function(){ hideLinkPreview(); };
        }).catch(function(){ hideLinkPreview(); });
    }
    function hideLinkPreview(){ _lpUrl=''; state._lpData=null; var c=$('#ghLinkPreviewCard'); if(c){c.style.display='none';c.innerHTML='';} }

    $('#ghSubmitPost').onclick=function(){
      var submitBtn=$('#ghSubmitPost'); if(!submitBtn || submitBtn.disabled) return;
      var bar=$('#ghPostUploadBar'), fill=$('#ghPostUploadFill'), pctEl=$('#ghPostUploadPct');

      if(pollMode){
        var question=(($('#ghPollQuestion')||{}).value||'').trim();
        var pollOptsEl=$('#ghPollOpts');
        var opts=$all('[data-poll-opt]', pollOptsEl).map(function(inp,idx){ return {id:String(idx),text:(inp.value||'').trim(),votes:0}; }).filter(function(o){ return o.text; });
        if(!question) return toast('Poll needs a question','error');
        if(opts.length<2) return toast('Add at least 2 poll options','error');
        var durDays=Number(($('#ghPollDuration')||{}).value||3);
        var endsAt=new Date(Date.now()+durDays*86400000);
        var pollPayload=Object.assign({ type:'poll', poll:{question:question,options:opts,endsAt:endsAt,totalVotes:0}, visibility:($('#ghPostVisibility')||{}).value||'public' }, extra||{});
        submitBtn.disabled=true;
        submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Posting…';
        GS().createPost(question, '', function(){ var modal=$('#ghPostModal'); if(modal) modal.remove(); }, pollPayload);
        return;
      }

      var txt=(ta&&ta.value)||'';
      if(!txt.trim() && !pickedFiles.length) return toast('Write something or add a photo','error');

      var payload=Object.assign({
        visibility: ($('#ghPostVisibility')||{}).value||'public',
        feeling: selectedFeeling,
        bgGradient: selectedBg,
        linkPreview: state._lpData||null,
        mentions: extractMentions(txt)
      }, extra||{});

      submitBtn.disabled=true;

      if(pickedFiles.length){
        if(bar) bar.style.display='flex';
        submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Uploading…';
        var total=pickedFiles.length, done=0;
        Promise.all(pickedFiles.map(function(f){
          return prepareMedia(f,'posts',function(pct){
            var overall=Math.round((done/total)*100+pct/total);
            if(fill) fill.style.width=overall+'%';
            if(pctEl) pctEl.textContent=overall+'%';
            submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> '+overall+'%';
          }).then(function(url){ done++; return url; });
        })).then(function(urls){
          var validUrls=urls.filter(Boolean);
          if(bar) bar.style.display='none';
          if(!validUrls.length && pickedFiles.length) throw new Error('All uploads failed');
          payload.mediaUrls=validUrls;
          submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Posting…';
          GS().createPost(txt, validUrls[0]||'', function(){ var modal=$('#ghPostModal'); if(modal) modal.remove(); }, payload);
        }).catch(function(err){
          console.error('[GeoHub] multi-image upload',err);
          toast('Image upload failed. Check Cloudinary settings.','error');
          if(bar) bar.style.display='none';
          submitBtn.disabled=false;
          submitBtn.innerHTML='<i class="fas fa-paper-plane"></i> Post';
        });
      } else {
        submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Posting…';
        GS().createPost(txt, '', function(){ var modal=$('#ghPostModal'); if(modal) modal.remove(); }, payload);
      }
    };
  }

  function openStoryModal(){
    if(!requireLogin()) return;
    var me=currentUserInfo();
    var av=me.avatar||''; var name=me.name||'You';
    var actorAv='<span class="gh-cmp-actor-av gh-avatar sm">'+(av?'<img src="'+esc(av)+'" alt="">':esc(initials(name)))+'</span>';
    var body=
      '<div class="gh-cmp-actor-row">'+
        actorAv+
        '<div class="gh-cmp-actor-info">'+
          '<span class="gh-cmp-actor-name">'+esc(name)+'</span>'+
          '<span class="gh-cmp-destination">Adding to your story</span>'+
        '</div>'+
      '</div>'+
      '<textarea class="gh-cmp-textarea" id="ghStoryText" placeholder="What\'s your story?…" rows="3"></textarea>'+
      '<div id="ghStoryPreview" style="margin-top:10px"></div>'+
      '<div class="gh-upload-progress" id="ghStoryUploadBar" style="display:none"><div class="gh-upload-track"><div class="gh-upload-bar" id="ghStoryUploadFill"></div></div><span id="ghStoryUploadPct">0%</span></div>'+
      '<input type="file" id="ghStoryFilePick" accept="image/*,video/*" style="display:none">'+
      '<div class="gh-cmp-toolbar" style="margin-top:10px">'+
        '<button type="button" class="gh-cmp-tool" id="ghStoryPhotoBtn"><i class="fas fa-image"></i><span> Photo/Video</span></button>'+
      '</div>';
    var m=modal('Add to your story', body,
      '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitStory" disabled>Share story</button>',
      'ghStoryModal');
    var pickedFile=null;
    function isDirty(){ return !!(($('#ghStoryText')||{}).value||'').trim()||!!pickedFile; }
    function updateSubmit(){ var btn=$('#ghSubmitStory'); if(btn) btn.disabled=!isDirty(); }
    m.addEventListener('click', function(e){
      if(e.target===m||e.target.closest('[data-close-modal]')){
        if(isDirty()&&!confirm('Discard your story?')){ e.stopPropagation(); e.preventDefault(); }
      }
    }, true);
    var ta=$('#ghStoryText');
    if(ta){ ta.addEventListener('input', updateSubmit); setTimeout(function(){ ta.focus(); }, 60); }
    $('#ghStoryPhotoBtn').onclick=function(){ var fp=$('#ghStoryFilePick'); if(fp) fp.click(); };
    $('#ghStoryFilePick').onchange=function(){
      var file=this.files&&this.files[0]; if(!file) return;
      pickedFile=file;
      var localUrl=URL.createObjectURL(file);
      var isVideo=file.type.startsWith('video/');
      $('#ghStoryPreview').innerHTML=isVideo
        ? '<video src="'+esc(localUrl)+'" style="width:100%;max-height:260px;border-radius:16px;border:1px solid var(--gh-border)" muted playsinline controls></video>'+
          '<button type="button" id="ghStoryRemoveMedia" style="margin-top:6px;border-radius:8px;padding:4px 12px;background:rgba(220,38,38,.15);color:#ef4444;border:none;cursor:pointer;display:block"><i class="fas fa-times"></i> Remove</button>'
        : '<div style="position:relative;display:inline-block;width:100%"><img src="'+esc(localUrl)+'" style="width:100%;max-height:260px;object-fit:cover;border-radius:16px;border:1px solid var(--gh-border)">'+
          '<button type="button" id="ghStoryRemoveMedia" style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;background:rgba(15,23,42,.75);border:none;color:#fff;cursor:pointer;font-size:1.1rem;display:grid;place-items:center"><i class="fas fa-times"></i></button></div>';
      updateSubmit();
      var rmBtn=$('#ghStoryRemoveMedia');
      if(rmBtn) rmBtn.onclick=function(){ pickedFile=null; $('#ghStoryPreview').innerHTML=''; updateSubmit(); };
    };
    $('#ghSubmitStory').onclick=function(){
      var t=($('#ghStoryText')||{}).value||'';
      if(!t.trim()&&!pickedFile) return toast('Story needs text or image','error');
      if(!GS().createStory) return toast('Stories unavailable','error');
      var submitBtn=$('#ghSubmitStory');
      if(submitBtn.disabled) return;
      submitBtn.disabled=true;
      var origHtml=submitBtn.innerHTML;
      submitBtn.innerHTML=pickedFile?'<i class="fas fa-circle-notch fa-spin"></i> Uploading…':'<i class="fas fa-circle-notch fa-spin"></i> Sharing…';
      var bar=$('#ghStoryUploadBar'), fill=$('#ghStoryUploadFill'), pctEl=$('#ghStoryUploadPct');
      if(bar&&pickedFile) bar.style.display='flex';
      prepareMedia(pickedFile||null,'stories',function(pct){
        if(fill) fill.style.width=pct+'%'; if(pctEl) pctEl.textContent=pct+'%';
        submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> '+pct+'%';
      }).then(function(finalUrl){
        if(pickedFile&&!finalUrl) throw new Error('Image upload failed');
        if(bar) bar.style.display='none';
        GS().createStory(t,finalUrl,function(){ var mo=$('#ghStoryModal'); if(mo) mo.remove(); });
      }).catch(function(err){
        console.error('[GeoHub] story upload failed',err);
        toast('Image upload failed. Check Cloudinary settings.','error');
        if(bar) bar.style.display='none';
      }).finally(function(){ var b=$('#ghSubmitStory'); if(b){ b.disabled=false; b.innerHTML=origHtml; } });
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
    var _cu = window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser;
    var _uid = _cu ? _cu.uid : '';
    var allSeen = !!(_uid && group.stories.length > 0 && group.stories.every(function(s){
      return Array.isArray(s.viewedBy) && s.viewedBy.indexOf(_uid) !== -1;
    }));
    return '<button type="button" class="gh-story-card gh-story-v2-card'+(allSeen?' gh-story-seen':'')+'" data-story-group="'+index+'" aria-label="Open '+esc(group.authorName)+' stories">'+
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
      function buildCreateCard(){
        var me=currentUserInfo(); var av=me.avatar||''; var name=me.name||'';
        return '<button type="button" class="gh-story-card gh-story-add" data-create-story>'+
          (av?'<span class="gh-story-add-avatar"><img src="'+esc(av)+'" alt="'+esc(name)+'"></span>':
              '<div class="gh-story-add-icon"><i class="fas fa-plus-circle"></i></div>')+
          '<br><strong>Create</strong>'+
        '</button>';
      }
      box.innerHTML=buildCreateCard();
      GS().listenStories(function(items){
        groups=buildStoryGroups(items||[]);
        var add=buildCreateCard();
        if(!groups.length){
          box.innerHTML=add+'<span class="gh-story-empty">No stories yet. Be the first!</span>';
        } else {
          box.innerHTML=add+groups.slice(0,16).map(renderStoryCard).join('');
        }
      });
      box.addEventListener('click', function(e){
        var add=e.target.closest('[data-create-story]');
        if(add){ e.preventDefault(); openStoryModal(); return; }
        var card=e.target.closest('[data-story-group]');
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
    var _paused = false;
    var _inputFocused = false;
    var _myReactions = {};
    var _rxLoaded = {};
    var STORY_DUR = 5000;

    function clearTimer(){ if(_autoTimer){ clearTimeout(_autoTimer); _autoTimer=null; } }
    function scheduleAdvance(){ clearTimer(); if(!_paused && !_inputFocused){ _autoTimer = setTimeout(tryAdvance, STORY_DUR); } }
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

      // Skip expired stories
      if(st.expiresAt){
        var _exp = typeof st.expiresAt.toMillis==='function' ? st.expiresAt.toMillis() : (st.expiresAt.seconds ? st.expiresAt.seconds*1000 : Number(st.expiresAt)||0);
        if(_exp && _exp < Date.now()){ tryAdvance(); return; }
      }

      var media = st.mediaUrl || '';
      var bars = g.stories.map(function(_,i){
        return '<span class="'+(i < storyIndex ? 'done' : (i === storyIndex ? 'current' : ''))+'"></span>';
      }).join('');

      var _cu = authUser();
      var isOwner = !!(_cu && st.authorId && _cu.uid === st.authorId);
      var isSignedIn = !!_cu;

      // Reactions bar (4 emojis, shown to all signed-in users)
      var rxEmojis = ['❤️','🔥','😂','😮'];
      var curRx = _myReactions[st.id] || null;
      var reactHtml = isSignedIn
        ? '<div class="gh-story-reactions">'+
            rxEmojis.map(function(em){
              return '<button type="button" class="gh-story-react-btn'+(curRx===em?' active':'')+'" data-story-react="'+esc(em)+'">'+em+'</button>';
            }).join('')+
          '</div>'
        : '';

      // Reply input (signed-in non-owner)
      var replyHtml = isSignedIn && !isOwner
        ? '<div class="gh-story-reply-row">'+
            '<input class="gh-story-reply-input" id="ghStRpInput" placeholder="Reply to '+esc(g.authorName)+'…" autocomplete="off" maxlength="300">'+
            '<button type="button" class="gh-story-reply-send" id="ghStRpSend" aria-label="Send reply"><i class="fas fa-paper-plane"></i></button>'+
          '</div>'
        : '';

      // Owner seen count
      var seenCount = isOwner ? Math.max(Number(st.viewCount)||0, Array.isArray(st.viewedBy) ? st.viewedBy.length : 0) : 0;
      var seenHtml = isOwner
        ? '<div class="gh-story-seen-row"><i class="fas fa-eye"></i> Seen by '+seenCount+'</div>'
        : '';

      // Owner delete button
      var ownerDeleteHtml = isOwner
        ? '<button type="button" class="gh-story-owner-del" id="ghStoryDelete" aria-label="Delete story"><i class="fas fa-trash-alt"></i></button>'
        : '';

      var footerHtml = (reactHtml||replyHtml||seenHtml)
        ? '<div class="gh-story-footer">'+(reactHtml||'')+(replyHtml||'')+(seenHtml||'')+'</div>'
        : '';

      overlay.innerHTML =
        '<div class="gh-story-shell" role="dialog" aria-modal="true" aria-label="Story viewer">'+
        '<div class="gh-story-progress">'+bars+'</div>'+
        '<div class="gh-story-head">'+
          '<div class="gh-story-author">'+
            (g.authorAvatar?'<span class="gh-story-author-avatar">'+img(g.authorAvatar,g.authorName)+'</span>':'<span class="gh-story-author-avatar initials">'+esc(initials(g.authorName))+'</span>')+
            '<div><strong>'+esc(g.authorName)+'</strong><small>'+(storyIndex+1)+'/'+g.stories.length+' · '+timeAgo(st.createdAt)+'</small></div>'+
          '</div>'+
          '<div class="gh-story-head-actions">'+ownerDeleteHtml+'<button type="button" class="gh-story-close" aria-label="Close story">×</button></div>'+
        '</div>'+
        '<div class="gh-story-main">'+
          (media?'<img src="'+esc(media)+'" alt="Story image" loading="eager" onerror="this.style.display=\'none\'">':'<p>'+esc(st.text||'Story')+'</p>')+
          (media && st.text?'<div class="gh-story-caption">'+esc(st.text)+'</div>':'')+
        '</div>'+
        footerHtml+
        '<button type="button" class="gh-story-nav prev" aria-label="Previous story">‹</button>'+
        '<button type="button" class="gh-story-nav next" aria-label="Next story">›</button>'+
        '</div>';

      // Non-blocking view tracking — owner excluded; viewCount only increments on first view
      var _fsSdk = window.GeoFirebase && window.GeoFirebase.fs;
      var _db = window.GeoFirebase && window.GeoFirebase.db;
      if(_cu && st.id && !isOwner && _fsSdk && _db && _fsSdk.updateDoc && _fsSdk.doc){
        var _alreadyViewed = Array.isArray(st.viewedBy) && st.viewedBy.indexOf(_cu.uid) !== -1;
        var _viewUpdate = _alreadyViewed
          ? { viewedBy: _fsSdk.arrayUnion(_cu.uid) }
          : { viewedBy: _fsSdk.arrayUnion(_cu.uid), viewCount: _fsSdk.increment(1) };
        _fsSdk.updateDoc(_fsSdk.doc(_db,'stories',st.id), _viewUpdate).catch(function(){});
      }

      // Load existing reaction for this story once per session; updates buttons when resolved
      if(isSignedIn && st.id && !_rxLoaded[st.id] && _fsSdk && _db && _fsSdk.getDoc && _fsSdk.doc){
        _rxLoaded[st.id] = true;
        _fsSdk.getDoc(_fsSdk.doc(_db,'stories',st.id,'reactions',_cu.uid))
          .then(function(d){
            if(d && d.exists && d.exists()){
              var em = (d.data()||{}).reaction || null;
              if(em) _myReactions[st.id] = em;
            }
            var cur = groups[groupIndex] && groups[groupIndex].stories[storyIndex];
            if(cur && cur.id === st.id){
              overlay.querySelectorAll('[data-story-react]').forEach(function(b){
                b.classList.toggle('active', _myReactions[st.id] === b.dataset.storyReact);
              });
            }
          }).catch(function(){});
      }

      overlay.querySelector('.gh-story-close').onclick = close;

      // Owner delete
      var delBtn = overlay.querySelector('#ghStoryDelete');
      if(delBtn) delBtn.onclick = function(e){
        e.stopPropagation();
        if(!confirm('Delete this story?')) return;
        if(GS().deleteStory){
          GS().deleteStory(st.id, function(err){
            if(!err){ toast('Story deleted'); close(); }
            else toast('Could not delete story.','error');
          });
        }
      };

      // Reaction buttons — update only buttons on click, no full redraw
      overlay.querySelectorAll('[data-story-react]').forEach(function(btn){
        btn.addEventListener('click', function(e){
          e.stopPropagation();
          var em = btn.dataset.storyReact;
          if(_myReactions[st.id] === em){
            _myReactions[st.id] = null;
            if(GS().removeStoryReaction) GS().removeStoryReaction(st.id);
          } else {
            _myReactions[st.id] = em;
            if(GS().addStoryReaction) GS().addStoryReaction(st.id, st.authorId || '', em);
          }
          overlay.querySelectorAll('[data-story-react]').forEach(function(b){
            b.classList.toggle('active', _myReactions[st.id] === b.dataset.storyReact);
          });
        });
      });

      // Reply input
      var replyInput = overlay.querySelector('#ghStRpInput');
      var replySend = overlay.querySelector('#ghStRpSend');
      if(replyInput){
        replyInput.addEventListener('focus', function(){ _inputFocused=true; clearTimer(); });
        replyInput.addEventListener('blur', function(){ _inputFocused=false; if(!_paused) scheduleAdvance(); });
        replyInput.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); if(replySend) replySend.click(); } });
      }
      if(replySend){
        replySend.addEventListener('click', function(e){
          e.stopPropagation();
          var text = replyInput ? replyInput.value.trim() : '';
          if(!text) return;
          replySend.disabled = true;
          var origIcon = replySend.innerHTML;
          replySend.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
          if(replyInput) replyInput.value = '';
          if(GS().addStoryReply){
            GS().addStoryReply(st.id, st.authorId, text, function(err){
              var btn = overlay.querySelector('#ghStRpSend');
              if(btn){ btn.disabled = false; btn.innerHTML = origIcon; }
              if(!err){ toast('Reply sent'); if(replyInput) replyInput.blur(); }
              else if(replyInput){ replyInput.value = text; replyInput.focus(); }
            });
          } else {
            replySend.disabled = false; replySend.innerHTML = origIcon;
          }
        });
      }

      overlay.querySelector('.gh-story-nav.prev').onclick = function(e){
        e.stopPropagation();
        if(storyIndex > 0){ storyIndex--; } else if(groupIndex > 0){ groupIndex--; storyIndex=groups[groupIndex].stories.length-1; } else return;
        draw();
      };
      overlay.querySelector('.gh-story-nav.next').onclick = function(e){ e.stopPropagation(); tryAdvance(); };
      overlay.querySelector('.gh-story-main').onclick = function(e){
        if(e.target.closest('.gh-story-caption') || e.target.closest('.gh-story-footer')) return;
        var r = overlay.querySelector('.gh-story-main').getBoundingClientRect();
        if(e.clientX < r.left + r.width * 0.35){
          if(storyIndex > 0){ storyIndex--; } else if(groupIndex > 0){ groupIndex--; storyIndex=groups[groupIndex].stories.length-1; } else return;
          draw();
        } else { tryAdvance(); }
      };

      // Pause auto-advance on hover (desktop)
      var shell = overlay.querySelector('.gh-story-shell');
      if(shell){
        shell.addEventListener('mouseenter', function(){
          _paused=true; clearTimer(); shell.classList.add('gh-story-paused');
        });
        shell.addEventListener('mouseleave', function(){
          _paused=false; shell.classList.remove('gh-story-paused'); if(!_inputFocused) scheduleAdvance();
        });
      }

      scheduleAdvance();
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

  var RX_EMOJIS = { love:'❤️', haha:'😂', wow:'😮', sad:'😢', angry:'😡', clap:'👏' };

  function postCard(p, options){
    options=options||{};
    // Business context flags
    var bizCtx = !!(options.biz);
    var biz = options.biz || null;
    var canManage = options.canManage; // boolean when biz, undefined for feed
    var isAdmin = !!options.isAdmin;

    var name=p.authorName||p.userName||p.businessName||'GeoHub User';
    var av=p.authorAvatar||p.userPhotoURL||p.logoUrl||'';
    var pid=p.id; var target='';
    var authorHref = authorLinkFor(p);
    var authorId = p.authorId || p.userId || p.createdByUserId || p.createdBy || '';
    var authorActor = postAuthorActor(p);
    var avatarHtml = (av?img(av,name):esc(initials(name)));
    var authorAttrs = authorId ? ' data-user-profile="'+esc(authorId)+'"' : '';
    var avatarAttrs = authorActor ? ' data-post-author-avatar data-actor-type="'+esc(authorActor.type)+'" data-actor-id="'+esc(authorActor.id)+'" aria-label="'+esc(name)+'"' : '';
    if(p.targetType && p.targetId) target='<div class="gh-post-target"><i class="fas '+iconFor(p.targetType)+'"></i>'+esc(labelFor(p.targetType))+'</div>';
    var privacyIcon = (p.visibility==='onlyme'||p.visibility==='only_me') ? 'fa-lock' : (p.visibility==='followers' ? 'fa-user-group' : ((p.visibility==='close_friends'||p.visibility==='friends') ? 'fa-star' : 'fa-earth-europe'));

    // "posted on BusinessName" for visitor posts inside a biz context
    var bizPostedOnHtml = (bizCtx && biz && p.authorType==='user')
      ? ' · <a href="business.html?id='+encodeURIComponent(biz.id||'')+'" class="gh-biz-posted-on">on '+esc(biz.title||'Business')+'</a>'
      : '';

    var bgStyle = (p.bgGradient && (p.text||'').length < 150) ? ' style="background:'+esc(p.bgGradient)+';border-radius:18px;padding:32px 20px;text-align:center;min-height:180px;display:flex;align-items:center;justify-content:center"' : '';
    var postTextHtml = '';
    if (p.text) {
      if (p.bgGradient && p.text.length < 150) {
        postTextHtml = '<div class="gh-post-bg-text"'+bgStyle+'><span>'+esc(p.text)+'</span></div>';
      } else {
        var _MAX_POST = 300;
        if (p.text.length > _MAX_POST) {
          var _cut = p.text.lastIndexOf(' ', _MAX_POST);
          if (_cut < _MAX_POST * 0.7) _cut = _MAX_POST;
          postTextHtml = '<div class="gh-post-text">'
            + '<span class="gh-post-short">'+esc(p.text.slice(0,_cut))+'…</span>'
            + '<span class="gh-post-full" style="display:none">'+esc(p.text)+'</span>'
            + '<button type="button" class="gh-read-more" onclick="ghToggleReadMore(this)">წაიკითხე მეტი ▾</button>'
            + '</div>';
        } else {
          postTextHtml = '<div class="gh-post-text">'+esc(p.text)+'</div>';
        }
      }
    }

    // Media: multi-image grid or single image
    var multiUrls = (p.mediaUrls && p.mediaUrls.length > 1) ? p.mediaUrls : [];
    var singleImgUrl = multiUrls.length ? '' : (p.imageUrl||p.mediaUrl||p.photoUrl||(p.mediaUrls&&p.mediaUrls[0])||'');
    var mediaHtml = '';
    if (multiUrls.length > 1) {
      var gridN = Math.min(multiUrls.length, 4);
      mediaHtml = '<div class="gh-post-media-grid gh-post-grid-'+gridN+'">' +
        multiUrls.slice(0,4).map(function(u,i){
          var moreOv = (i===3 && multiUrls.length>4) ? '<div class="gh-post-grid-more">+'+(multiUrls.length-4)+'</div>' : '';
          return '<div class="gh-post-grid-item" data-open-photo="'+esc(u)+'"><img src="'+esc(u)+'" loading="lazy" alt="" onerror="this.style.display=\'none\'">'+moreOv+'</div>';
        }).join('')+'</div>';
    } else if (singleImgUrl) {
      mediaHtml = '<div class="gh-post-img-wrap" data-open-photo="'+esc(singleImgUrl)+'"><img class="gh-post-img" src="'+esc(singleImgUrl)+'" alt="post image" loading="lazy" onerror="this.parentElement.style.display=\'none\'"></div>';
    }

    var pollHtml = '';
    if(p.type==='poll' && p.poll) {
      var pol=p.poll; var totalV=Math.max(0,Number(pol.totalVotes||0));
      var pollEndsAt=pol.endsAt||pol.expiresAt;
      var pollExpired=pollEndsAt&&(new Date(pollEndsAt.toMillis?pollEndsAt.toMillis():pollEndsAt)<new Date());
      pollHtml = '<div class="gh-poll-card" data-poll-pid="'+esc(pid)+'">' +
        '<div class="gh-poll-question">'+esc(pol.question||'')+'</div>' +
        (pol.options||[]).map(function(opt){
          var pct = totalV > 0 ? Math.round(Math.max(0,Number(opt.votes||0))/totalV*100) : 0;
          return '<button class="gh-poll-opt'+(pollExpired?' expired':'')+'" '+
            (pollExpired?'disabled ':'data-poll-vote ')+
            'data-pid="'+esc(pid)+'" data-opt-id="'+esc(opt.id)+'">' +
            '<div class="gh-poll-bar" style="width:'+pct+'%"></div>' +
            '<span class="gh-poll-label">'+esc(opt.text)+'</span>' +
            '<span class="gh-poll-pct">'+pct+'%</span>' +
          '</button>';
        }).join('') +
        '<div class="gh-poll-footer">'+totalV+' vote'+(totalV===1?'':'s')+(pollExpired?' · <em>Poll ended</em>':'')+'</div>' +
      '</div>';
    }

    var linkPrevHtml = '';
    if(p.linkPreview && p.linkPreview.url) {
      var lp=p.linkPreview;
      linkPrevHtml = '<a class="gh-link-preview" href="'+esc(lp.url)+'" target="_blank" rel="noopener">' +
        (lp.image ? '<img src="'+esc(lp.image)+'" alt="'+esc(lp.title||'')+'" loading="lazy" onerror="this.remove()">' : '') +
        '<div class="gh-lp-body">' +
          '<div class="gh-lp-domain">'+esc(lp.domain||lp.url)+'</div>' +
          '<div class="gh-lp-title">'+esc(lp.title||'')+'</div>' +
          (lp.description ? '<div class="gh-lp-desc">'+esc(lp.description)+'</div>' : '') +
        '</div>' +
      '</a>';
    }

    var totalRx = Number(p.likeCount||p.reactionCount||0);

    // Business context extras
    var pinBanner = (bizCtx && p.pinned) ? '<div class="gh-post-pinned-banner"><i class="fas fa-thumbtack"></i> Pinned post</div>' : '';
    var followedPageBanner = options.fromFollowedPage ? '<a class="gh-followed-page-banner" href="business.html?id='+esc(p.targetId||p.businessId||'')+'"><i class="fas fa-store"></i> From a page you follow</a>' : '';
    var viewCountHtml = (bizCtx && isAdmin) ? '<div class="gh-post-view-count" id="post-views-'+esc(pid)+'"><i class="fas fa-eye"></i> '+(p.viewCount||0)+' views</div>' : '';

    // More/menu button — biz mode shows dropdown, feed mode opens modal
    var moreBtn;
    if (bizCtx && canManage) {
      var isPinned=!!p.pinned; var cmtOff=!!p.commentsDisabled; var vis=p.visibility||'public';
      moreBtn =
        '<div class="biz-post-menu-wrap">'+
        '<button class="gh-post-more" data-biz-post-menu title="Post options"><i class="fas fa-ellipsis"></i></button>'+
        '<div class="biz-post-menu-dropdown" id="biz-pmenu-'+esc(pid)+'">'+
          '<button class="biz-pmenu-item" data-biz-action="edit" data-pid="'+esc(pid)+'"><i class="fas fa-pen"></i> Edit post</button>'+
          '<button class="biz-pmenu-item" data-biz-action="pin" data-pid="'+esc(pid)+'" data-pinned="'+(isPinned?'1':'0')+'"><i class="fas fa-thumbtack"></i> '+(isPinned?'Unpin':'Pin')+' post</button>'+
          '<div class="biz-pmenu-sep"></div>'+
          '<button class="biz-pmenu-item" data-biz-action="toggleComments" data-pid="'+esc(pid)+'" data-cmt-off="'+(cmtOff?'1':'0')+'"><i class="fas fa-comment-slash"></i> '+(cmtOff?'Enable':'Disable')+' comments</button>'+
          '<div class="biz-pmenu-sep"></div>'+
          '<button class="biz-pmenu-item" data-biz-action="setVis" data-pid="'+esc(pid)+'" data-vis="public"><i class="fas fa-globe"></i> Public'+(vis==='public'?' <i class="fas fa-check" style="color:#10b981;font-size:.65rem"></i>':'')+' </button>'+
          '<button class="biz-pmenu-item" data-biz-action="setVis" data-pid="'+esc(pid)+'" data-vis="followers"><i class="fas fa-user-group"></i> Followers'+(vis==='followers'?' <i class="fas fa-check" style="color:#10b981;font-size:.65rem"></i>':'')+' </button>'+
          '<button class="biz-pmenu-item" data-biz-action="setVis" data-pid="'+esc(pid)+'" data-vis="private"><i class="fas fa-lock"></i> Private'+(vis==='private'?' <i class="fas fa-check" style="color:#10b981;font-size:.65rem"></i>':'')+' </button>'+
          '<div class="biz-pmenu-sep"></div>'+
          '<button class="biz-pmenu-item danger" data-biz-action="delete" data-pid="'+esc(pid)+'"><i class="fas fa-trash"></i> Delete post</button>'+
        '</div>'+
        '</div>';
    } else if (bizCtx) {
      moreBtn = ''; // not a manager in biz context — no menu
    } else {
      moreBtn = '<button class="gh-post-more" data-post-menu><i class="fas fa-ellipsis"></i></button>';
    }

    // Comment form — hide when commentsDisabled in biz context
    var cmtFormHtml = (bizCtx && p.commentsDisabled)
      ? '<div class="gh-comments-disabled"><i class="fas fa-comment-slash"></i> Comments are turned off.</div>'
      : '<form class="gh-comment-form" data-comment-form><input class="gh-input" placeholder="Write a comment…"><button class="gh-btn"><i class="fas fa-paper-plane"></i></button></form>';

    // Card element data attributes
    var cardAttrs = ' id="post-'+esc(pid)+'" data-post-id="'+esc(pid)+'" data-author-id="'+esc(authorId)+'"';
    if (bizCtx && p.pinned) cardAttrs += ' data-pinned="1"';
    if (bizCtx) cardAttrs += ' data-vis="'+esc(p.visibility||'public')+'"';
    if (bizCtx && isAdmin) cardAttrs += ' data-biz-admin="1"';

    return '<article class="gh-card gh-post"'+cardAttrs+'>'+
      followedPageBanner+
      pinBanner+
      '<div class="gh-post-head"><a class="gh-avatar gh-profile-avatar-link" href="'+esc(authorHref)+'"'+authorAttrs+avatarAttrs+'>'+(avatarHtml)+'</a><div class="gh-post-meta"><a class="gh-post-name gh-profile-name-link" href="'+esc(authorHref)+'"'+authorAttrs+'>'+esc(name)+'</a><div class="gh-post-time">'+timeAgo(p.createdAt)+' · <i class="fas '+privacyIcon+'"></i>'+target+(p.feeling?' · '+esc(p.feeling):'')+bizPostedOnHtml+'</div></div>'+moreBtn+'</div>'+
      postTextHtml+
      mediaHtml+
      pollHtml+
      linkPrevHtml+
      (p.sharedPostId?'<div class="gh-shared-preview" data-shared-post="'+esc(p.sharedPostId)+'"><i class="fas fa-share"></i><div><strong>Shared post</strong><span>Loading original post...</span></div></div>':'')+
      viewCountHtml+
      '<div class="gh-post-stats"><span><button class="gh-rx-who-btn" data-who-reacted="'+esc(pid)+'">❤️ <b data-like-count>'+totalRx+'</b>'+(totalRx?' people reacted':'')+'</button></span><span><button class="gh-stats-btn" data-open-comments-btn><b data-comment-count>'+Math.max(0,Number(p.commentCount||0))+'</b> comments</button> · <button class="gh-stats-btn" data-open-shares-btn><b data-share-count>'+Number(p.shareCount||0)+'</b> shares</button></span></div>'+
      '<div class="gh-rx-breakdown" data-rx-pid="'+esc(pid)+'"></div>'+
      '<div class="gh-post-actions"><span class="gh-like-wrap"><button class="gh-act" data-like>❤️ Like</button><div class="gh-reaction-strip"><button data-reaction="love">❤️</button><button data-reaction="haha">😂</button><button data-reaction="wow">😮</button><button data-reaction="sad">😢</button><button data-reaction="angry">😡</button><button data-reaction="clap">👏</button></div></span><button class="gh-act" data-comment-toggle><i class="fas fa-comment"></i> Comment</button><button class="gh-act" data-share><i class="fas fa-share"></i> Share</button><button class="gh-act" data-save><i class="fas fa-bookmark"></i> Save</button></div>'+
      '<div class="gh-comments" data-comments hidden><div data-comments-list></div>'+cmtFormHtml+'</div>'+
    '</article>';
  }

  function loadReactionBreakdown(pid) {
    if(!fs() || !db()) return;
    fs().getDocs(fs().query(fs().collection(db(),'posts',pid,'reactions'), fs().limit(50))).then(function(snap){
      var counts = {};
      snap.forEach(function(d){ var t=(d.data()||{}).type||'like'; counts[t]=(counts[t]||0)+1; });
      var types = Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; }).slice(0,3);
      var boxes = document.querySelectorAll('[data-rx-pid="'+CSS.escape(pid)+'"]');
      if(!boxes.length) return;
      var rxHtml = types.length ? types.map(function(t){ return '<span class="gh-rx-chip">'+RX_EMOJIS[t]+' '+counts[t]+'</span>'; }).join('') : '';
      boxes.forEach(function(box){ box.innerHTML = rxHtml; });
    }).catch(function(){});
  }

  function openWhoReactedModal(pid) {
    if(!fs() || !db()) return;
    modal('Who Reacted', '<div class="gh-who-rx-tabs" id="ghWhoRxTabs"><button class="gh-who-rx-tab active" data-rx-tab="all">All</button>'+Object.keys(RX_EMOJIS).map(function(t){ return '<button class="gh-who-rx-tab" data-rx-tab="'+t+'">'+RX_EMOJIS[t]+'</button>'; }).join('')+'</div><div id="ghWhoRxList"><i class="fas fa-circle-notch fa-spin gh-muted"></i></div>', '<button class="gh-btn ghost" data-close-modal>Close</button>', 'ghWhoRxModal');
    var allReactions = [];
    fs().getDocs(fs().query(fs().collection(db(),'posts',pid,'reactions'), fs().limit(50))).then(function(snap){
      snap.forEach(function(d){ allReactions.push(Object.assign({id:d.id}, d.data())); });
      // Fetch real user profiles so we display accurate names/avatars
      return Promise.all(allReactions.map(function(r){
        var uid = r.userId || r.id || '';
        if(!uid) return Promise.resolve();
        return fs().getDoc(fs().doc(db(),'users',uid)).then(function(uSnap){
          if(uSnap.exists()){
            var u = uSnap.data();
            r.displayName = u.fullName || u.displayName || u.username || r.displayName || 'GeoHub User';
            r.photoURL = u.avatar || u.photoURL || r.photoURL || '';
          }
        }).catch(function(){});
      }));
    }).then(function(){
      renderWhoRxList('all');
    }).catch(function(){ var box=$('#ghWhoRxList'); if(box) box.innerHTML='<div class="gh-muted" style="padding:10px">Could not load.</div>'; });
    function renderWhoRxList(tab) {
      var box=$('#ghWhoRxList'); if(!box) return;
      var items = tab==='all' ? allReactions : allReactions.filter(function(r){ return r.type===tab; });
      if(!items.length){ box.innerHTML='<div class="gh-muted" style="padding:10px 0">No reactions yet.</div>'; return; }
      box.innerHTML = '<div class="gh-mini-list">'+items.map(function(r){
        var name = r.displayName || 'GeoHub User';
        var av = r.photoURL ? img(r.photoURL, name) : esc(initials(name));
        return '<a class="gh-mini-item" href="'+profileLink(r.userId||r.id||'')+'"><span class="gh-avatar" style="width:36px;height:36px">'+av+'</span><div><strong>'+esc(name)+'</strong><span>'+RX_EMOJIS[r.type||'like']+'</span></div></a>';
      }).join('')+'</div>';
    }
    var tabBar=$('#ghWhoRxTabs');
    if(tabBar) tabBar.addEventListener('click', function(e){
      var btn=e.target.closest('[data-rx-tab]'); if(!btn) return;
      tabBar.querySelectorAll('.gh-who-rx-tab').forEach(function(b){ b.classList.toggle('active',b===btn); });
      renderWhoRxList(btn.dataset.rxTab);
    });
  }

  function closePostMenus(except){
    var generic = document.getElementById('ghPostMenuDrop');
    if(generic && generic !== except) generic.remove();
    var floatingBiz = document.getElementById('ghBizPostMenuDrop');
    if(floatingBiz && floatingBiz !== except) floatingBiz.remove();
    document.querySelectorAll('.biz-post-menu-dropdown.open').forEach(function(d){
      if(d !== except){
        d.classList.remove('open');
        d.style.visibility = '';
      }
    });
  }

  function positionFixedPostMenu(menu, anchor, fallbackWidth){
    if(!menu || !anchor) return;
    var rect = anchor.getBoundingClientRect();
    var gap = 8;
    menu.style.position = 'fixed';
    menu.style.left = '0px';
    menu.style.right = 'auto';
    menu.style.top = '0px';
    menu.style.visibility = 'hidden';
    menu.classList.add('open');
    var menuWidth = menu.offsetWidth || fallbackWidth || 220;
    var menuHeight = menu.offsetHeight || 260;
    var vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    var vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    var left = rect.right - menuWidth;
    if(left < gap) left = gap;
    if(left + menuWidth > vw - gap) left = Math.max(gap, vw - menuWidth - gap);
    var top = rect.bottom + gap;
    if(top + menuHeight > vh - gap) top = rect.top - menuHeight - gap;
    if(top < gap) top = gap;
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
    menu.style.visibility = '';
  }

  function ensurePostMenuDismissers(){
    if(window.__ghPostMenuDismissers) return;
    window.__ghPostMenuDismissers = true;
    document.addEventListener('click', function(ev){
      var t = ev.target;
      if(t && t.closest && (t.closest('#ghPostMenuDrop') || t.closest('#ghBizPostMenuDrop') || t.closest('.biz-post-menu-dropdown') || t.closest('[data-post-menu]') || t.closest('[data-biz-post-menu]') || t.closest('.biz-post-menu-btn'))) return;
      closePostMenus();
    }, true);
    document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') closePostMenus(); });
    window.addEventListener('scroll', function(){ closePostMenus(); }, false);
    window.addEventListener('resize', function(){ closePostMenus(); });
  }

  function bindPostInteractions(root, options){
    root = root || document;
    options = options || {};
    hydratePostAuthorAvatars(root);
    ensurePostMenuDismissers();
    // Always update options — allows re-calls with onBizAction to take effect even if already bound
    root.__postInteractionsOptions = options;
    if(root.__ghPostInteractionsBound) return;
    root.__ghPostInteractionsBound = true;
    root.addEventListener('click', function(e){
      var opts = root.__postInteractionsOptions || {};
      // Business post menu toggle — intercept before generic card check
      var bizMenuBtn = e.target.closest('[data-biz-post-menu], .biz-post-menu-btn');
      if (bizMenuBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        var bizCard0 = bizMenuBtn.closest('[data-post-id]');
        var bizPid0 = bizCard0 ? bizCard0.dataset.postId : '';
        if (!bizCard0 || !bizPid0) { console.warn('[BizPostMenu] no card/postId for button'); return; }
        var dd = bizCard0.querySelector('.biz-post-menu-dropdown');
        if (!dd) { console.warn('[BizPostMenu] no .biz-post-menu-dropdown in card', bizPid0); return; }
        var currentBizMenu = document.getElementById('ghBizPostMenuDrop');
        var isOpen0 = currentBizMenu && currentBizMenu.dataset.postId === String(bizPid0 || '');
        closePostMenus();
        if (!isOpen0) {
          var floatingMenu = dd.cloneNode(true);
          floatingMenu.id = 'ghBizPostMenuDrop';
          floatingMenu.dataset.postId = String(bizPid0 || '');
          floatingMenu.classList.remove('biz-post-menu-dropdown');
          floatingMenu.classList.add('biz-post-menu-floating');
          floatingMenu.style.setProperty('display', 'block', 'important');
          floatingMenu.style.setProperty('visibility', 'visible', 'important');
          floatingMenu.style.setProperty('opacity', '1', 'important');
          floatingMenu.style.setProperty('pointer-events', 'auto', 'important');
          floatingMenu.style.setProperty('position', 'fixed', 'important');
          floatingMenu.style.setProperty('z-index', '10080', 'important');
          document.body.appendChild(floatingMenu);
          floatingMenu.addEventListener('click', function(ev){
            var actionBtn = ev.target.closest && ev.target.closest('[data-biz-action]');
            if (!actionBtn) return;
            ev.preventDefault();
            ev.stopPropagation();
            closePostMenus();
            var currentOpts = root.__postInteractionsOptions || {};
            if (currentOpts.onBizAction) currentOpts.onBizAction(actionBtn.dataset.pid || bizPid0, actionBtn.dataset.bizAction, actionBtn.dataset);
          });
          positionFixedPostMenu(floatingMenu, bizMenuBtn, 218);
        }
        return;
      }

      var card=e.target.closest('[data-post-id]'); if(!card) return; var pid=card.dataset.postId;

      // Business-specific menu actions (edit, pin, toggleComments, setVis, delete)
      var bizAction = e.target.closest('[data-biz-action]');
      if (bizAction) {
        document.querySelectorAll('.biz-post-menu-dropdown.open').forEach(function(d){ d.classList.remove('open'); });
        var currentOpts = root.__postInteractionsOptions || {};
        if (currentOpts.onBizAction) currentOpts.onBizAction(bizAction.dataset.pid||pid, bizAction.dataset.bizAction, bizAction.dataset);
        return;
      }

      // Multi-image grid photo click
      var photoItem = e.target.closest('[data-open-photo]');
      if (photoItem) {
        var photoUrl = photoItem.dataset.openPhoto;
        var allPhotos = Array.from(card.querySelectorAll('[data-open-photo]')).map(function(el){ return el.dataset.openPhoto; });
        var photoIdx = allPhotos.indexOf(photoUrl);
        if (options.onOpenPhoto) options.onOpenPhoto(photoUrl, allPhotos, photoIdx);
        else if (photoUrl) openMediaLightbox(photoUrl, allPhotos, photoIdx);
        return;
      }
      if(e.target.closest('[data-like]') && !e.target.closest('.gh-reaction-strip')){ if(!requireLogin()) return; setReaction(pid,'love',card); }
      var ro=e.target.closest('[data-reaction]'); if(ro){ if(!requireLogin()) return; setReaction(pid,ro.dataset.reaction,card); }
      if(e.target.closest('[data-comment-toggle]')){ toggleComments(card,pid); }
      if(e.target.closest('[data-open-comments-btn]')){ openFocusedPost(pid); return; }
      if(e.target.closest('[data-open-shares-btn]')){ var scEl=card.querySelector('[data-share-count]'); openWhoSharedModal(pid, scEl ? Number(scEl.textContent||0) : 0); return; }
      if(e.target.closest('[data-share]')){ sharePost(pid); }
      if(e.target.closest('[data-save]')){ if(!requireLogin()) return; GS().toggleSavePost(pid,function(saved){ var b=card.querySelector('[data-save]'); if(b) b.classList.toggle('active',!!saved); }); }
      var menuBtn=e.target.closest('[data-post-menu]'); if(menuBtn){ postMenu(pid,card,menuBtn); }
      var rb=e.target.closest('[data-comment-reply]'); if(rb){ e.preventDefault(); openReplyForm(card,pid,rb.dataset.commentId); }
      var cr=e.target.closest('[data-copy-post-link]'); if(cr && navigator.clipboard){ navigator.clipboard.writeText(location.origin+location.pathname+'#post-'+pid).then(function(){toast('Post link copied');}); }
      var wrBtn=e.target.closest('[data-who-reacted]'); if(wrBtn){ openWhoReactedModal(wrBtn.dataset.whoReacted); }
      var pv=e.target.closest('[data-poll-vote]'); if(pv){ if(!requireLogin()) return; submitPollVote(pv.dataset.pid, pv.dataset.optId, card); }
      var clBtn=e.target.closest('[data-comment-like]'); if(clBtn){ if(!requireLogin()) return; toggleCommentReaction(pid, clBtn.dataset.commentId, clBtn.dataset.commentReaction||'love', clBtn); }
      var eb=e.target.closest('[data-edit-comment]'); if(eb){ e.preventDefault(); openFeedCommentEditor(pid, eb.dataset.commentId, eb); }
      var db2=e.target.closest('[data-delete-comment]'); if(db2){ e.preventDefault();
        if(!confirm('Delete this comment?')) return;
        var cid2=db2.dataset.commentId;
        db2.disabled=true;
        fs().deleteDoc(fs().doc(db(),'posts',pid,'comments',cid2))
          .then(function(){
            var row=card.querySelector('[data-comment-id="'+CSS.escape(cid2)+'"]');
            if(row){row.style.transition='opacity .2s';row.style.opacity='0';setTimeout(function(){row.remove();},220);}
            fs().updateDoc(fs().doc(db(),'posts',pid),{commentCount:fs().increment(-1)}).catch(function(){});
            toast('Comment deleted');
          }).catch(function(err){db2.disabled=false;toast('Could not delete: '+(err.code||err.message),'error');});
      }
      var drBtn=e.target.closest('[data-delete-reply]'); if(drBtn){ e.preventDefault();
        if(!confirm('Delete this reply?')) return;
        var rid=drBtn.dataset.replyId, rcid=drBtn.dataset.commentId;
        drBtn.disabled=true;
        fs().deleteDoc(fs().doc(db(),'posts',pid,'comments',rcid,'replies',rid))
          .then(function(){
            var rrow=card.querySelector('[data-reply-id="'+CSS.escape(rid)+'"]');
            if(rrow){rrow.style.transition='opacity .2s';rrow.style.opacity='0';setTimeout(function(){rrow.remove();},220);}
            fs().updateDoc(fs().doc(db(),'posts',pid,'comments',rcid),{replyCount:fs().increment(-1)}).catch(function(){});
            // Update cache to prevent deleted reply reappearing on next paint
            var rkey=pid+'_'+rcid;
            if(state.cachedReplies[rkey]) state.cachedReplies[rkey]=state.cachedReplies[rkey].filter(function(r){return r.id!==rid;});
            toast('Reply deleted');
          }).catch(function(err){drBtn.disabled=false;toast('Could not delete: '+(err.code||err.message),'error');});
      }
    });
    root.addEventListener('submit', function(e){
      var form=e.target.closest('[data-comment-form]');
      if(form){ e.preventDefault(); var card=form.closest('[data-post-id]'), pid=card.dataset.postId; var input=form.querySelector('input,textarea'); var val=input.value.trim(); if(!val) return; if(!requireLogin()) return; state.openCommentPids[pid]=true; GS().addComment(pid,val,function(){ input.value=''; },buildActorExtra()); return; }
      var rform=e.target.closest('[data-reply-form]');
      if(rform){ e.preventDefault(); var card2=rform.closest('[data-post-id]'), pid2=card2.dataset.postId, cid=rform.dataset.commentId; var rin=rform.querySelector('input'); var rv=rin.value.trim(); if(!rv) return; if(!requireLogin()) return; if(GS().addCommentReply) GS().addCommentReply(pid2,cid,rv,function(){ rin.value=''; rform.hidden=true; },buildActorExtra()); else toast('Replies are not available','error'); }
    });

    // Reaction strip: show on Like hover, hide after 1.5s delay
    // Comment reaction picker: show on hover, 1.5s minimum stay
    root.addEventListener('mouseover', function(e){
      if(e.target.closest('[data-like]')){
        var card3 = e.target.closest('[data-post-id]'); if(!card3) return;
        var strip = card3.querySelector('.gh-reaction-strip'); if(!strip) return;
        clearTimeout(strip._rxt); strip.classList.add('visible');
      }
      var strip2 = e.target.closest('.gh-reaction-strip');
      if(strip2){ clearTimeout(strip2._rxt); }
      if(e.target.closest('.gh-cmt-rx-btn') || e.target.closest('.gh-cmt-rx-picker')){
        var wrap = e.target.closest('.gh-cmt-rx-wrap'); if(!wrap) return;
        var pk = wrap.querySelector('.gh-cmt-rx-picker'); if(!pk) return;
        clearTimeout(pk._rxt); pk.classList.add('visible');
      }
    });
    root.addEventListener('mouseout', function(e){
      var strip3 = e.target.closest('.gh-reaction-strip');
      if(strip3){
        var rel = e.relatedTarget;
        if(!rel || !strip3.contains(rel)){
          clearTimeout(strip3._rxt);
          strip3._rxt = setTimeout(function(){ strip3.classList.remove('visible'); }, 1500);
        }
        return;
      }
      if(e.target.closest('[data-like]') && !e.target.closest('.gh-reaction-strip')){
        var card4 = e.target.closest('[data-post-id]'); if(!card4) return;
        var rel2 = e.relatedTarget;
        var s = card4.querySelector('.gh-reaction-strip'); if(!s) return;
        if(!rel2 || !s.contains(rel2)){ clearTimeout(s._rxt); s._rxt = setTimeout(function(){ s.classList.remove('visible'); }, 1500); }
        return;
      }
      var wrap2 = e.target.closest('.gh-cmt-rx-wrap');
      if(wrap2){
        var rel3 = e.relatedTarget;
        if(!rel3 || !wrap2.contains(rel3)){
          var pk2 = wrap2.querySelector('.gh-cmt-rx-picker'); if(!pk2) return;
          clearTimeout(pk2._rxt); pk2._rxt = setTimeout(function(){ pk2.classList.remove('visible'); }, 1500);
        }
      }
    });
    // Mobile: tap Like to toggle reaction strip for 3s
    root.addEventListener('touchstart', function(e){
      if(e.target.closest('[data-like]')){
        var card5 = e.target.closest('[data-post-id]'); if(!card5) return;
        var strip4 = card5.querySelector('.gh-reaction-strip'); if(!strip4) return;
        clearTimeout(strip4._rxt);
        strip4.classList.add('visible');
        strip4._rxt = setTimeout(function(){ strip4.classList.remove('visible'); }, 3000);
      }
    }, { passive: true });
  }


  function hydrateReactionState(postId){
    var u=authUser(); if(!u || !fs()) return;
    var cards=document.querySelectorAll('[data-post-id="'+CSS.escape(postId)+'"]');
    if(!cards.length) return;
    fs().getDoc(fs().doc(db(),'posts',postId,'reactions',u.uid)).then(function(snap){
      var type=snap.exists() ? ((snap.data()||{}).type||'like') : '';
      cards.forEach(function(card){
        if(type) updateReactionUi(card,type);
        else if(GS().checkLiked) GS().checkLiked(postId,function(liked){ if(liked) updateReactionUi(card,'like'); });
      });
    }).catch(function(){
      if(GS().checkLiked) GS().checkLiked(postId,function(liked){
        cards.forEach(function(card){ if(liked) updateReactionUi(card,'like'); });
      });
    });
    cards.forEach(function(card){ if(card.querySelector('[data-poll-pid]')) hydratePollVote(postId); });
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
    var pid=card.dataset&&card.dataset.postId;
    var targets=pid?Array.from(document.querySelectorAll('[data-post-id="'+CSS.escape(pid)+'"]')):[card];
    targets.forEach(function(c){
      var like=c.querySelector('[data-like]');
      if(like){ like.classList.toggle('active',!!type); like.innerHTML=(type==='love'?'❤️ Love':type==='haha'?'😂 Haha':type==='wow'?'😮 Wow':type==='sad'?'😢 Sad':type==='angry'?'😡 Angry':type==='clap'?'👏 Clap':'❤️ Like'); }
      $all('[data-reaction]',c).forEach(function(b){ b.classList.toggle('active',b.dataset.reaction===type); });
    });
  }

  function renderSharedPreviewData(p){
    if(!p || p.status==='deleted') {
      return '<div class="gh-shared-unavail"><i class="fas fa-ban"></i><span>Original post unavailable</span></div>';
    }
    var name = p.authorName || p.userName || p.businessName || 'GeoHub User';
    var av = p.authorAvatar || p.userPhotoURL || p.logoUrl || '';
    var authorId = p.authorId || p.userId || '';
    var avHtml = av
      ? '<img src="'+esc(av)+'" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display=\'none\'">'
      : esc(initials(name));
    var privacyIcon = (p.visibility==='onlyme'||p.visibility==='only_me') ? 'fa-lock' : (p.visibility==='followers' ? 'fa-user-group' : ((p.visibility==='close_friends'||p.visibility==='friends') ? 'fa-star' : 'fa-earth-europe'));
    var imgUrl = p.imageUrl || p.mediaUrl || p.photoUrl || '';
    var authorHref = authorId ? profileLink(authorId) : '#';
    return '<div class="gh-shared-embed">'+
      '<div class="gh-shared-embed-head">'+
        '<a class="gh-avatar" href="'+esc(authorHref)+'" style="width:32px;height:32px;flex-shrink:0">'+avHtml+'</a>'+
        '<div>'+
          '<a class="gh-shared-embed-name" href="'+esc(authorHref)+'">'+esc(name)+'</a>'+
          '<div class="gh-small gh-muted">'+timeAgo(p.createdAt)+' · <i class="fas '+privacyIcon+'"></i></div>'+
        '</div>'+
      '</div>'+
      (p.text ? '<div class="gh-shared-embed-text">'+esc(p.text.slice(0,300))+(p.text.length>300?'…':'')+'</div>' : '')+
      (imgUrl ? '<img class="gh-shared-embed-img" src="'+esc(imgUrl)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '')+
    '</div>';
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

  function renderCommentsForPid(pid, items){
    var cards=document.querySelectorAll('[data-post-id="'+CSS.escape(pid)+'"]');
    if(!cards.length) return;
    var visible=items.filter(function(c){
      if(c.status==='deleted') return false;
      var uid=c.authorId||c.userId||'';
      return !uid||(state.blockedUserIds.indexOf(uid)===-1&&state.mutedUserIds.indexOf(uid)===-1);
    });
    var html=visible.length
      ? visible.map(function(c){ return commentCard(pid,c); }).join('')
      : '<div class="gh-small" style="padding:10px 6px">No comments yet.</div>';
    cards.forEach(function(card){
      var list=card.querySelector('[data-comments-list]'); if(!list) return;
      var box=card.querySelector('[data-comments]');
      if(box && state.openCommentPids[pid]) box.hidden=false;
      list.innerHTML=html;
    });
    visible.forEach(function(c){ loadReplies(pid,c.id); });
  }

  function toggleComments(card,pid){
    var box=card.querySelector('[data-comments]'); if(!box) return;
    box.hidden=!box.hidden;
    if(box.hidden){ delete state.openCommentPids[pid]; return; }
    state.openCommentPids[pid]=true;
    // If listener already active, render from cache and return
    if(state.postsUnsubs[pid]){
      if(state.cachedComments[pid]) renderCommentsForPid(pid, state.cachedComments[pid]);
      return;
    }
    state.postsUnsubs[pid]=GS().listenComments(pid,function(items){
      state.cachedComments[pid]=items;
      renderCommentsForPid(pid, items);
    });
  }

  function commentCard(pid,c){
    var name=c.authorName||c.userName||'User'; var uid=c.authorId||c.userId||''; var avHtml=(c.authorAvatar?img(c.authorAvatar,name):esc(initials(name)));
    var u=authUser();
    // isOwn: true for direct author OR for the real user behind a business-posted comment
    var isOwn=u&&(u.uid===uid||(c.createdByUid&&u.uid===c.createdByUid)||(c.userId&&u.uid===c.userId));
    // Biz admins can delete any comment on posts they manage
    var postCard0=document.querySelector('[data-post-id="'+CSS.escape(pid)+'"]');
    var isBizAdmin=!!(postCard0&&postCard0.dataset.bizAdmin==='1');
    var canDelete=isOwn||isBizAdmin;
    // Author link: business comments link to business page
    var isBizComment=(c.authorType==='business')&&(c.businessId||c.authorId);
    var cAuthorHref=isBizComment?('business.html?id='+encodeURIComponent(c.businessId||c.authorId)):profileLink(uid);
    var avAnchor='<a class="gh-avatar gh-profile-avatar-link" href="'+esc(cAuthorHref)+'" style="width:32px;height:32px" title="'+esc('Open '+name+' profile')+'">'+avHtml+'</a>';
    var nameAnchor='<a class="gh-profile-name-link" href="'+esc(cAuthorHref)+'" title="'+esc('Open '+name+' profile')+'">'+esc(name)+'</a>';
    var ownerBtns =
      (isOwn ? ' · <button type="button" class="gh-cmt-act" data-edit-comment data-comment-id="'+esc(c.id)+'" data-post-id="'+esc(pid)+'">Edit</button>' : '')+
      (canDelete ? ' · <button type="button" class="gh-cmt-act" data-delete-comment data-comment-id="'+esc(c.id)+'" data-post-id="'+esc(pid)+'">Delete</button>' : '');
    var rxCount = Number(c.reactionCount||0);
    var rxType = c._myRxType||'';
    var rxLabel = rxType ? (RX_EMOJIS[rxType]+' '+(rxCount||1)) : '❤️ '+(rxCount||'Like');
    return '<div class="gh-comment-row" data-comment-id="'+esc(c.id)+'">'+
      avAnchor+
      '<div class="gh-comment-main"><div class="gh-comment-bubble"><strong>'+nameAnchor+'</strong><span class="gh-cmt-text" data-cmt-text>'+esc(c.text||'')+'</span></div>'+
      '<div class="gh-small gh-comment-actions">'+timeAgo(c.createdAt)+' · <button type="button" data-comment-reply data-comment-id="'+esc(c.id)+'">Reply</button>'+
      ' · <span class="gh-cmt-rx-wrap"><button type="button" class="gh-cmt-act gh-cmt-rx-btn'+(rxType?' active':'')+'" data-comment-like data-comment-id="'+esc(c.id)+'" data-comment-reaction="'+esc(rxType||'like')+'">'+rxLabel+'</button>'+
      '<span class="gh-cmt-rx-picker" data-rx-picker="'+esc(c.id)+'">'+Object.keys(RX_EMOJIS).map(function(t){ return '<button type="button" class="gh-cmt-rx-pick" data-comment-like data-comment-id="'+esc(c.id)+'" data-comment-reaction="'+t+'">'+RX_EMOJIS[t]+'</button>'; }).join('')+'</span></span>'+
      ownerBtns+'</div>'+
      '<form class="gh-reply-form" data-reply-form data-comment-id="'+esc(c.id)+'" hidden><input class="gh-input" placeholder="Write a reply…"><button class="gh-btn sm"><i class="fas fa-paper-plane"></i></button></form>'+
      '<div class="gh-replies" data-replies-for="'+esc(c.id)+'"></div></div></div>';
  }

  function toggleCommentReaction(pid, cid, type, btn) {
    var u=authUser(); if(!u) return requireLogin();
    var f=fs(), rxRef=f.doc(db(),'posts',pid,'comments',cid,'reactions',u.uid);
    var commentRef=f.doc(db(),'posts',pid,'comments',cid);
    f.getDoc(rxRef).then(function(snap){
      var exists=snap.exists(), prev=exists?(snap.data()||{}).type||'like':'';
      if(exists && prev===type){
        return f.deleteDoc(rxRef).then(function(){
          return f.updateDoc(commentRef,{reactionCount:f.increment(-1)}).catch(function(){});
        }).then(function(){
          if(btn){ btn.classList.remove('active'); btn.dataset.commentReaction='love'; btn.textContent='❤️ Like'; }
        });
      }
      var write=f.setDoc(rxRef,{userId:u.uid,type:type,createdAt:f.serverTimestamp()},{merge:true});
      if(!exists) write=write.then(function(){ return f.updateDoc(commentRef,{reactionCount:f.increment(1)}).catch(function(){}); });
      return write.then(function(){
        if(btn){ btn.classList.add('active'); btn.dataset.commentReaction=type; btn.textContent=RX_EMOJIS[type]+' 1'; }
      });
    }).catch(function(err){ toast('Reaction failed','error'); });
  }

  function updatePollUi(pid, opts, totalVotes, myOptId, card){
    var pollDivs=[];
    document.querySelectorAll('[data-post-id="'+CSS.escape(pid)+'"]').forEach(function(c){
      var pd=c.querySelector('[data-poll-pid]'); if(pd) pollDivs.push(pd);
    });
    if(!pollDivs.length && card){ var pd=card.querySelector('[data-poll-pid]'); if(pd) pollDivs.push(pd); }
    if(!pollDivs.length) return;
    var totalV=Math.max(0,Number(totalVotes||0));
    pollDivs.forEach(function(pollDiv){
      $all('.gh-poll-opt',pollDiv).forEach(function(btn){
        var oId=btn.dataset.optId||'';
        var opt=null; for(var i=0;i<opts.length;i++){ if(opts[i].id===oId){opt=opts[i];break;} }
        var votes=opt?Math.max(0,Number(opt.votes||0)):0;
        var pct=totalV>0?Math.round(votes/totalV*100):0;
        var bar=btn.querySelector('.gh-poll-bar'); if(bar) bar.style.width=pct+'%';
        var pctEl=btn.querySelector('.gh-poll-pct'); if(pctEl) pctEl.textContent=pct+'%';
        btn.classList.toggle('selected',!!(oId&&oId===myOptId));
      });
      var footer=pollDiv.querySelector('.gh-poll-footer');
      if(footer) footer.textContent=totalV+' vote'+(totalV===1?'':'s')+(pollDiv.querySelector('.gh-poll-opt.expired')?' · Poll ended':'');
      if(myOptId) pollDiv.classList.add('voted');
    });
  }

  function hydratePollVote(pid){
    var u=authUser(); if(!u||!fs()) return;
    fs().getDoc(fs().doc(db(),'posts',pid,'pollVotes',u.uid)).then(function(snap){
      if(!snap.exists()) return;
      var myOptId=(snap.data()||{}).optionId||'';
      if(!myOptId) return;
      document.querySelectorAll('[data-post-id="'+CSS.escape(pid)+'"]').forEach(function(card){
        var pollDiv=card.querySelector('[data-poll-pid]'); if(!pollDiv) return;
        $all('.gh-poll-opt',pollDiv).forEach(function(btn){
          btn.classList.toggle('selected',btn.dataset.optId===myOptId);
        });
        pollDiv.classList.add('voted');
      });
    }).catch(function(){});
  }

  function submitPollVote(pid, optId, card) {
    var u=authUser(); if(!u) return requireLogin();
    var f=fs();
    var voteRef=f.doc(db(),'posts',pid,'pollVotes',u.uid);
    var postRef=f.doc(db(),'posts',pid);

    // Disable all options while writing to prevent double-click
    var pollDiv=card&&card.querySelector('[data-poll-pid]');
    function enableOpts(){ if(pollDiv) $all('.gh-poll-opt',pollDiv).forEach(function(b){ b.disabled=false; }); }
    if(pollDiv) $all('.gh-poll-opt',pollDiv).forEach(function(b){ b.disabled=true; });

    Promise.all([f.getDoc(voteRef), f.getDoc(postRef)]).then(function(results){
      var voteSnap=results[0], postSnap=results[1];
      var prevOptId=voteSnap.exists()?((voteSnap.data()||{}).optionId||''):'';

      // Same option clicked — no-op (keep selected state unchanged)
      if(prevOptId===optId){ enableOpts(); return; }

      if(!postSnap.exists()){ enableOpts(); return; }
      var pd=postSnap.data().poll||{};
      var origOpts=(pd.options||[]).slice();
      var origTotal=Math.max(0,Number(pd.totalVotes||0));

      // Compute new counts (floor at 0 to prevent negative)
      var newOpts=origOpts.map(function(o){
        var v=Math.max(0,Number(o.votes||0));
        if(o.id===prevOptId) v=Math.max(0,v-1);
        if(o.id===optId) v=v+1;
        return Object.assign({},o,{votes:v});
      });
      var newTotal=prevOptId?origTotal:origTotal+1; // only increment total on first vote

      // Optimistic UI update immediately
      updatePollUi(pid,newOpts,newTotal,optId,card);

      // Write vote doc (create or update)
      var voteWrite=voteSnap.exists()
        ?f.updateDoc(voteRef,{optionId:optId,updatedAt:f.serverTimestamp()})
        :f.setDoc(voteRef,{optionId:optId,uid:u.uid,userId:u.uid,createdAt:f.serverTimestamp(),updatedAt:f.serverTimestamp()});

      return voteWrite
        .then(function(){
          // TODO: move to Cloud Function for true atomicity (Blaze plan required)
          return f.updateDoc(postRef,{'poll.options':newOpts,'poll.totalVotes':newTotal}).catch(function(){});
        })
        .then(function(){ enableOpts(); toast('Vote recorded'); })
        .catch(function(err){
          // Revert optimistic UI to original state
          updatePollUi(pid,origOpts,origTotal,prevOptId,card);
          enableOpts();
          toast('Vote failed: '+(err.code||err.message),'error');
        });
    }).catch(function(err){
      enableOpts();
      toast('Vote failed: '+(err.code||err.message),'error');
    });
  }

  function openReplyForm(card,pid,cid){
    var f=card.querySelector('[data-reply-form][data-comment-id="'+CSS.escape(cid)+'"]');
    if(!f) return; f.hidden=!f.hidden; if(!f.hidden){ var input=f.querySelector('input'); if(input) input.focus(); }
  }

  function replyCard(pid, r){
    var u=authUser();
    var rUid=r.authorId||r.userId||'';
    var name=r.authorName||'User';
    var av=r.authorAvatar?img(r.authorAvatar,name):esc(initials(name));
    var avEl=userProfileAnchor(rUid,'gh-avatar gh-reply-avatar',av,'');
    var nameEl=userProfileAnchor(rUid,'gh-profile-name-link',esc(name),'');
    var isOwn=u&&(u.uid===rUid||(r.createdByUid&&u.uid===r.createdByUid)||(r.userId&&u.uid===r.userId));
    var postCard0=document.querySelector('[data-post-id="'+CSS.escape(pid)+'"]');
    var isBizAdmin=!!(postCard0&&postCard0.dataset.bizAdmin==='1');
    var canDelete=isOwn||isBizAdmin;
    var delBtn=canDelete?(' · <button type="button" class="gh-cmt-act" data-delete-reply data-reply-id="'+esc(r.id)+'" data-comment-id="'+esc(r.commentId||'')+'" title="Delete reply"><i class="fas fa-trash" style="font-size:.65rem"></i></button>'):'';
    return '<div class="gh-reply-row" data-reply-id="'+esc(r.id)+'">'+avEl+
      '<div class="gh-comment-main"><div class="gh-comment-bubble"><strong>'+nameEl+'</strong><span class="gh-cmt-text">'+esc(r.text||'')+'</span></div>'+
      '<div class="gh-small gh-comment-actions">'+timeAgo(r.createdAt)+delBtn+'</div>'+
    '</div></div>';
  }

  function renderRepliesIntoBox(pid, cid, items){
    var visible=items.filter(function(r){
      if(r.status==='deleted') return false;
      var uid=r.authorId||r.userId||'';
      return !uid||(state.blockedUserIds.indexOf(uid)===-1&&state.mutedUserIds.indexOf(uid)===-1);
    });
    var html=visible.length?visible.map(function(r){ return replyCard(pid,r); }).join(''):'';
    document.querySelectorAll('[data-post-id="'+CSS.escape(pid)+'"] [data-replies-for="'+CSS.escape(cid)+'"]').forEach(function(box){
      box.innerHTML=html;
    });
  }

  function loadReplies(pid,cid){
    var key=pid+'_'+cid;
    if(state.replyUnsubs[key]){
      // Listener already active — DOM was rebuilt by paint()/renderCommentsForPid, repopulate from cache
      var cached=state.cachedReplies[key];
      if(cached) renderRepliesIntoBox(pid,cid,cached);
      return;
    }
    if(!GS||!GS()||!GS().listenCommentReplies) return;
    state.replyUnsubs[key]=GS().listenCommentReplies(pid,cid,function(items){
      state.cachedReplies[key]=items;
      renderRepliesIntoBox(pid,cid,items);
    });
  }

  function sharePost(pid){
    if(!requireLogin()) return;
    var existing = document.getElementById('ghShareSheet');
    if (existing) { existing.remove(); return; }

    var sheet = document.createElement('div');
    sheet.id = 'ghShareSheet';
    sheet.className = 'gh-share-sheet-overlay';
    sheet.innerHTML =
      '<div class="gh-share-sheet">' +
        '<div class="gh-share-sheet-handle"></div>' +
        '<div class="gh-share-sheet-title">Share</div>' +
        '<button class="gh-share-opt" id="ghShareToFeed">' +
          '<span class="gh-share-opt-icon"><i class="fas fa-share-nodes"></i></span>' +
          '<span class="gh-share-opt-text"><strong>Share to GeoHub</strong><em>Post to your feed with a caption</em></span>' +
        '</button>' +
        '<button class="gh-share-opt" id="ghShareToStory">' +
          '<span class="gh-share-opt-icon"><i class="fas fa-film"></i></span>' +
          '<span class="gh-share-opt-text"><strong>Share to Story</strong><em>Add this post to your 24h story</em></span>' +
        '</button>' +
        '<button class="gh-share-opt" id="ghShareCopyLink">' +
          '<span class="gh-share-opt-icon"><i class="fas fa-link"></i></span>' +
          '<span class="gh-share-opt-text"><strong>Copy link</strong><em>Copy post link to clipboard</em></span>' +
        '</button>' +
        (navigator.share ?
          '<button class="gh-share-opt" id="ghShareNative">' +
            '<span class="gh-share-opt-icon"><i class="fas fa-ellipsis"></i></span>' +
            '<span class="gh-share-opt-text"><strong>More options</strong><em>Share via other apps</em></span>' +
          '</button>'
          : '') +
        '<button class="gh-share-sheet-cancel" id="ghShareCancel">Cancel</button>' +
      '</div>';
    document.body.appendChild(sheet);

    function closeSheet() {
      var s = document.getElementById('ghShareSheet');
      if (s) { s.classList.add('gh-share-sheet-out'); setTimeout(function() { if (s.parentNode) s.remove(); }, 220); }
    }

    document.getElementById('ghShareToFeed').onclick = function() { closeSheet(); openShareCompose(pid); };
    document.getElementById('ghShareToStory').onclick = function() {
      closeSheet();
      if (typeof openStoryModal === 'function') { openStoryModal(pid); return; }
      // Fallback: open story composer prefilled with post link
      var url = location.origin + location.pathname + '#post-' + pid;
      var body =
        '<textarea class="gh-cmp-textarea" id="ghStoryTextShare" placeholder="What\'s your story?…" rows="3"></textarea>'+
        '<p style="font-size:.75rem;color:#94a3b8;margin:6px 0 0"><i class="fas fa-link"></i> ' + url + '</p>';
      var m = modal('Add to your story', body,
        '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitStoryShare">Share story</button>',
        'ghStoryShareModal');
      var btn = document.getElementById('ghSubmitStoryShare');
      if (btn) btn.onclick = function() {
        btn.disabled = true; btn.textContent = 'Sharing…';
        var text = (document.getElementById('ghStoryTextShare') || {}).value || '';
        var u2 = requireLogin() && window.GeoCurrentUser;
        if (!u2) { toast('Please sign in', 'error'); return; }
        var f = fs(), d = db();
        f.addDoc(f.collection(d, 'stories'), {
          authorId: u2.uid,
          authorName: u2.displayName || u2.email || 'GeoHub User',
          authorAvatar: u2.photoURL || '',
          text: text,
          sharedPostId: pid,
          postLink: url,
          type: 'shared_post',
          expiresAt: new Date(Date.now() + 24*3600*1000),
          createdAt: f.serverTimestamp()
        }).then(function() {
          if (m && m.remove) m.remove(); else document.getElementById('ghStoryShareModal') && document.getElementById('ghStoryShareModal').remove();
          toast('Added to your story!');
        }).catch(function(e) { toast('Failed: ' + e.message, 'error'); btn.disabled = false; btn.textContent = 'Share story'; });
      };
    };
    document.getElementById('ghShareCopyLink').onclick = function() {
      if (navigator.clipboard) { navigator.clipboard.writeText(location.origin+location.pathname+'#post-'+pid).then(function(){ toast('Post link copied'); }); }
      closeSheet();
    };
    if (navigator.share) {
      document.getElementById('ghShareNative').onclick = function() {
        navigator.share({ url: location.origin+location.pathname+'#post-'+pid }).catch(function(){});
        closeSheet();
      };
    }
    document.getElementById('ghShareCancel').onclick = closeSheet;
    sheet.addEventListener('click', function(e) { if (e.target === sheet) closeSheet(); });
    setTimeout(function() { sheet.classList.add('gh-share-sheet-in'); }, 10);
  }

  function openShareCompose(pid) {
    if (!requireLogin()) return;
    var body =
      '<textarea class="gh-textarea" id="ghShareText" placeholder="Say something about this…" rows="3"></textarea>' +
      '<div class="gh-form-grid" style="margin-top:8px">' +
        '<select class="gh-select" id="ghShareVisibility">' +
          '<option value="public">🌍 Public</option>' +
          '<option value="close_friends">⭐ Close Friends</option>' +
          '<option value="onlyme">🔒 Only Me</option>' +
        '</select>' +
      '</div>' +
      '<div class="gh-shared-preview" data-shared-post="'+esc(pid)+'" style="margin-top:10px"><i class="fas fa-circle-notch fa-spin gh-muted"></i></div>';
    modal('Share to your feed', body,
      '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitShare">Post</button>',
      'ghShareModal');
    hydrateSharedPreviews($('#ghShareModal'));
    $('#ghSubmitShare').onclick = function() {
      var btn = $('#ghSubmitShare');
      if (btn) { btn.disabled = true; btn.textContent = 'Posting…'; }
      GS().createPost($('#ghShareText').value, '', function() {
        if ($('#ghShareModal')) $('#ghShareModal').remove();
        if (GS().trackShare) GS().trackShare(pid);
        toast('Shared to your feed!');
      }, Object.assign({ sharedPostId: pid, visibility: $('#ghShareVisibility').value }, buildActorExtra()));
    };
  }

  function openWhoSharedModal(pid, count) {
    if (!count || count <= 0) { toast('No shares yet'); return; }
    if (!fs() || !db()) return;
    modal('Who Shared', '<div id="ghWhoSharedList" class="gh-who-rx-list"><i class="fas fa-circle-notch fa-spin gh-muted"></i></div>',
      '<button class="gh-btn ghost" data-close-modal>Close</button>', 'ghWhoSharedModal');
    fs().getDocs(fs().query(
      fs().collection(db(), 'posts'),
      fs().where('sharedPostId', '==', pid),
      fs().limit(20)
    )).then(function(snap) {
      var list = document.getElementById('ghWhoSharedList');
      if (!list) return;
      if (snap.empty) { list.innerHTML = '<p class="gh-muted" style="padding:16px 0;text-align:center">No shares yet.</p>'; return; }
      var rows = [];
      snap.forEach(function(d) {
        var p = Object.assign({ id: d.id }, d.data());
        var name = p.authorName || p.userName || 'GeoHub User';
        var av = p.authorAvatar || p.userPhotoURL || '';
        var authorId = p.authorId || p.userId || '';
        var avHtml = av
          ? '<img src="'+esc(av)+'" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display=\'none\'">'
          : esc(initials(name));
        var href = authorId ? profileLink(authorId) : '#';
        rows.push(
          '<div class="gh-who-rx-row">' +
            '<a class="gh-avatar" href="'+esc(href)+'" style="width:38px;height:38px;flex-shrink:0">'+avHtml+'</a>' +
            '<div>' +
              '<a class="gh-who-rx-name" href="'+esc(href)+'">'+esc(name)+'</a>' +
              '<div class="gh-small gh-muted">'+timeAgo(p.createdAt)+'</div>' +
              (p.text ? '<div class="gh-who-shared-caption">'+esc(p.text.slice(0,80))+(p.text.length>80?'…':'')+'</div>' : '') +
            '</div>' +
          '</div>'
        );
      });
      list.innerHTML = rows.join('');
    }).catch(function(err) {
      var list = document.getElementById('ghWhoSharedList');
      if (list) list.innerHTML = '<p class="gh-muted" style="padding:16px 0;text-align:center">Could not load.</p>';
      console.warn('[GeoHub] openWhoSharedModal', err);
    });
  }

  function postMenu(pid, card, anchor){
    if(!requireLogin()) return;
    var existing = document.getElementById('ghPostMenuDrop');
    if (existing) {
      var samePost = existing.dataset.postId === String(pid || '');
      existing.remove();
      if (samePost) return;
    }
    closePostMenus();

    var authorId = card && card.dataset ? card.dataset.authorId : '';
    var authorName = card && card.dataset ? (card.dataset.authorName || '') : '';
    var u = authUser();
    var isOwn = u && authorId && u.uid === authorId;

    var items = '<div class="gh-pmenu-list">';
    if (isOwn) {
      items += '<button class="gh-pmenu-item" data-menu-edit-post><i class="fas fa-pen"></i> Edit post</button>';
      items += '<button class="gh-pmenu-item danger" data-menu-delete-post><i class="fas fa-trash"></i> Delete post</button>';
      items += '<div class="gh-pmenu-sep"></div>';
    }
    items += '<button class="gh-pmenu-item" data-copy-post-link><i class="fas fa-link"></i> Copy link</button>';
    items += '<button class="gh-pmenu-item" data-menu-save><i class="fas fa-bookmark"></i> Save post</button>';
    if (!isOwn) {
      items += '<div class="gh-pmenu-sep"></div>';
      items += '<button class="gh-pmenu-item" data-menu-hide><i class="fas fa-eye-slash"></i> Hide post</button>';
      items += '<button class="gh-pmenu-item" data-menu-report><i class="fas fa-flag"></i> Report post</button>';
      if (authorId) {
        items += '<div class="gh-pmenu-sep"></div>';
        items += '<button class="gh-pmenu-item" data-menu-report-user><i class="fas fa-user-shield"></i> Report author</button>';
        items += '<button class="gh-pmenu-item" data-menu-mute-user><i class="fas fa-volume-mute"></i> Mute author</button>';
        items += '<button class="gh-pmenu-item danger" data-menu-block-user><i class="fas fa-ban"></i> Block author</button>';
      }
    }
    items += '</div>';

    var drop = document.createElement('div');
    drop.id = 'ghPostMenuDrop';
    drop.className = 'gh-post-menu-drop';
    drop.dataset.postId = String(pid || '');
    drop.innerHTML = items;
    document.body.appendChild(drop);

    positionFixedPostMenu(drop, anchor, 220);

    function closeDrop() { var d = document.getElementById('ghPostMenuDrop'); if (d) d.remove(); }

    drop.addEventListener('click', function(e) {
      e.stopPropagation();
      if (e.target.closest('[data-menu-edit-post]') && isOwn) { closeDrop(); openFeedPostEditor(pid, card); return; }
      if (e.target.closest('[data-menu-delete-post]') && isOwn) {
        closeDrop();
        if (!confirm('Delete this post? This cannot be undone.')) return;
        fs().updateDoc(fs().doc(db(),'posts',pid), { status:'deleted', updatedAt:fs().serverTimestamp() })
          .then(function(){ if(card){ card.style.transition='opacity .25s'; card.style.opacity='0'; setTimeout(function(){ card.remove(); },260); } toast('Post deleted'); })
          .catch(function(err){ toast('Could not delete: '+(err.code||err.message),'error'); });
        return;
      }
      if (e.target.closest('[data-copy-post-link]')) { navigator.clipboard && navigator.clipboard.writeText(location.origin+location.pathname+'#post-'+pid).then(function(){toast('Link copied!');}); closeDrop(); return; }
      if (e.target.closest('[data-menu-save]')) { if(GS().toggleSavePost) GS().toggleSavePost(pid); closeDrop(); return; }
      if (e.target.closest('[data-menu-hide]')) { if(GS().hidePost) GS().hidePost(pid, function(){ if(card) card.remove(); }); closeDrop(); return; }
      if (e.target.closest('[data-menu-report]')) { closeDrop(); if(window.GeoModeration) window.GeoModeration.openReportModal('post', pid, ''); else if(GS().reportTarget) GS().reportTarget('post', pid, 'Reported'); return; }
      if (e.target.closest('[data-menu-report-user]') && authorId) { closeDrop(); if(window.GeoModeration) window.GeoModeration.openReportModal('user', authorId, authorName); else if(GS().reportTarget) GS().reportTarget('user', authorId, 'Reported'); return; }
      if (e.target.closest('[data-menu-mute-user]') && authorId) { closeDrop(); if(window.GeoModeration) window.GeoModeration.openMuteConfirm(authorId, authorName, function(){ if(GS().muteUser) GS().muteUser(authorId); }); else if(GS().muteUser) GS().muteUser(authorId); return; }
      if (e.target.closest('[data-menu-block-user]') && authorId) { closeDrop(); if(window.GeoModeration) window.GeoModeration.openBlockConfirm(authorId, authorName, function(){ if(GS().blockUser) GS().blockUser(authorId, function(){ if(card) card.remove(); }); }); else if(GS().blockUser) GS().blockUser(authorId, function(){ if(card) card.remove(); }); return; }
    });

    ensurePostMenuDismissers();
  }

  function openFocusedPost(pid) {
    if (!fs() || !db()) return;
    if (document.getElementById('ghFocusedPostOverlay')) return; // already open

    var overlay = document.createElement('div');
    overlay.id = 'ghFocusedPostOverlay';
    overlay.className = 'gh-fpm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="gh-fpm-panel">' +
        '<div class="gh-fpm-header">' +
          '<span class="gh-fpm-title">Post</span>' +
          '<button class="gh-fpm-close" id="ghFpmClose" aria-label="Close"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="gh-fpm-body" id="ghFpmBody"><div class="gh-fpm-loading"><i class="fas fa-circle-notch fa-spin"></i></div></div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('gh-fpm-open');

    var _ownedListeners = [];

    function closeFpm() {
      _ownedListeners.forEach(function(item) {
        if (item.unsub) {
          try { item.unsub(); } catch(e) {}
          // Only remove from state if we created it (not if feed already had it)
          if (item.owned && state.postsUnsubs && state.postsUnsubs[item.pid] === item.unsub) {
            delete state.postsUnsubs[item.pid];
          }
        }
      });
      document.body.classList.remove('gh-fpm-open');
      overlay.style.opacity = '0';
      setTimeout(function() { overlay.remove(); }, 200);
      document.removeEventListener('keydown', _keydown);
    }

    function _keydown(ev) { if (ev.key === 'Escape') closeFpm(); }
    document.addEventListener('keydown', _keydown);

    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeFpm(); });
    document.getElementById('ghFpmClose').addEventListener('click', closeFpm);

    fs().getDoc(fs().doc(db(), 'posts', pid)).then(function(snap) {
      if (!snap.exists()) { document.getElementById('ghFpmBody').innerHTML = '<p class="gh-fpm-empty">Post not found.</p>'; return; }
      var p = Object.assign({ id: pid }, snap.data());
      if (p.status === 'deleted') { document.getElementById('ghFpmBody').innerHTML = '<p class="gh-fpm-empty">This post was deleted.</p>'; return; }

      var titleEl = overlay.querySelector('.gh-fpm-title');
      if (titleEl) {
        var pName = p.authorName || p.userName || p.businessName || '';
        titleEl.textContent = pName ? pName + "’s post" : 'Post';
      }
      var cardHtml = postCard(p, {});
      var body = document.getElementById('ghFpmBody');
      body.innerHTML = '<div class="gh-fpm-card-wrap">' + cardHtml + '</div>';

      // Always show comments in focused modal
      var card = body.querySelector('[data-post-id="' + CSS.escape(pid) + '"]');
      if (card) {
        var commBox = card.querySelector('[data-comments]');
        if (commBox) commBox.hidden = false;
        if (!state.openCommentPids) state.openCommentPids = {};
        state.openCommentPids[pid] = true;
      }

      // Bind interactions to this modal's subtree
      bindPostInteractions(body, {
        onOpenPhoto: function(url) { openMediaLightbox(url); }
      });
      hydratePostAuthorAvatars(body);

      // Reuse existing comment listener if active; otherwise create one
      if (state.postsUnsubs && state.postsUnsubs[pid]) {
        // Feed already has a listener — render cached comments if available
        if (state.cachedComments && state.cachedComments[pid]) {
          renderCommentsForPid(pid, state.cachedComments[pid]);
        }
      } else if (GS() && GS().listenComments) {
        var unsub = GS().listenComments(pid, function(items) {
          if (!state.cachedComments) state.cachedComments = {};
          state.cachedComments[pid] = items;
          renderCommentsForPid(pid, items);
        });
        if (!state.postsUnsubs) state.postsUnsubs = {};
        state.postsUnsubs[pid] = unsub;
        _ownedListeners.push({ pid: pid, unsub: unsub, owned: true });
      }

      loadReactionBreakdown(pid);
      hydrateReactionState(pid);
      if (typeof hydrateSharedPreviews === 'function') hydrateSharedPreviews(body);
    }).catch(function(err) {
      var b = document.getElementById('ghFpmBody');
      if (b) b.innerHTML = '<p class="gh-fpm-empty">Could not load post.</p>';
      console.error('[GeoHub] openFocusedPost', err);
    });
  }

  function openMediaLightbox(url, allUrls, idx) {
    if (!url) return;
    var existing = document.getElementById('ghMediaLightbox');
    if (existing) existing.remove();

    var urls = (Array.isArray(allUrls) && allUrls.length > 1) ? allUrls : [url];
    var cur = (typeof idx === 'number' && idx >= 0 && idx < urls.length) ? idx : Math.max(0, urls.indexOf(url));

    var lb = document.createElement('div');
    lb.id = 'ghMediaLightbox';
    lb.className = 'gh-media-lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');

    function buildInner() {
      var hasNav = urls.length > 1;
      return '<div class="gh-media-lb-inner">' +
        '<button class="gh-media-lb-close" aria-label="Close"><i class="fas fa-times"></i></button>' +
        (hasNav ? '<button class="gh-media-lb-nav gh-media-lb-prev" aria-label="Previous"><i class="fas fa-chevron-left"></i></button>' : '') +
        '<img class="gh-media-lb-img" src="'+esc(urls[cur])+'" alt="Full size image" onerror="this.alt=\'Image could not load\'">' +
        (hasNav ? '<button class="gh-media-lb-nav gh-media-lb-next" aria-label="Next"><i class="fas fa-chevron-right"></i></button>' : '') +
        (hasNav ? '<div class="gh-media-lb-counter">'+(cur+1)+' / '+urls.length+'</div>' : '') +
      '</div>';
    }

    lb.innerHTML = buildInner();
    document.body.appendChild(lb);

    function navigate(delta) {
      cur = (cur + delta + urls.length) % urls.length;
      lb.innerHTML = buildInner();
      bindLbEvents();
    }

    function closeLb() {
      var el = document.getElementById('ghMediaLightbox');
      if (el) el.remove();
      document.removeEventListener('keydown', _k);
    }
    function _k(ev) {
      if (ev.key === 'Escape') { closeLb(); return; }
      if (urls.length > 1 && ev.key === 'ArrowLeft') navigate(-1);
      if (urls.length > 1 && ev.key === 'ArrowRight') navigate(1);
    }
    document.addEventListener('keydown', _k);

    function bindLbEvents() {
      lb.querySelector('.gh-media-lb-close').addEventListener('click', closeLb);
      lb.addEventListener('click', function(e) { if (e.target === lb) closeLb(); });
      var prevBtn = lb.querySelector('.gh-media-lb-prev');
      var nextBtn = lb.querySelector('.gh-media-lb-next');
      if (prevBtn) prevBtn.addEventListener('click', function(e) { e.stopPropagation(); navigate(-1); });
      if (nextBtn) nextBtn.addEventListener('click', function(e) { e.stopPropagation(); navigate(1); });
    }
    bindLbEvents();
  }

  function openFeedCommentEditor(pid, cid, btnEl) {
    var row = document.querySelector('[data-comment-id="'+CSS.escape(cid)+'"]');
    if (!row) return;
    var textEl = row.querySelector('[data-cmt-text]');
    if (!textEl || textEl.querySelector('textarea')) return;
    var current = textEl.textContent || '';
    var ta = document.createElement('textarea');
    ta.className = 'gh-input'; ta.rows = 2;
    ta.style.cssText = 'width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#f1f5f9;padding:6px 10px;resize:none;font-size:.87rem;font-family:inherit;outline:none;display:block;margin-top:4px';
    ta.value = current;
    var saveBtn = document.createElement('button');
    saveBtn.style.cssText = 'margin-top:4px;background:#10b981;color:#fff;border:none;border-radius:10px;padding:4px 14px;font-size:.8rem;cursor:pointer;font-family:inherit';
    saveBtn.textContent = 'Save';
    var cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'margin-top:4px;margin-left:6px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:.8rem;padding:4px 8px;font-family:inherit';
    cancelBtn.textContent = 'Cancel';
    textEl.innerHTML = '';
    textEl.appendChild(ta);
    textEl.appendChild(document.createElement('br'));
    textEl.appendChild(saveBtn);
    textEl.appendChild(cancelBtn);
    ta.focus();
    cancelBtn.onclick = function() { textEl.innerHTML = esc(current); };
    saveBtn.onclick = function() {
      var newText = ta.value.trim();
      if (!newText || newText === current) { textEl.innerHTML = esc(current); return; }
      saveBtn.disabled = true; saveBtn.textContent = '…';
      fs().updateDoc(fs().doc(db(),'posts',pid,'comments',cid), { text:newText, updatedAt:fs().serverTimestamp() })
        .then(function(){ textEl.innerHTML = esc(newText); toast('Comment updated'); })
        .catch(function(){ textEl.innerHTML = esc(current); toast('Could not edit','error'); });
    };
  }

  function openFeedPostEditor(pid, card) {
    fs().getDoc(fs().doc(db(),'posts',pid)).then(function(snap){
      if(!snap.exists()) return;
      var d = snap.data();
      var currentText = d.text || '';
      var currentVis = d.visibility || 'public';
      var body = '<textarea class="gh-textarea" id="ghEditPostText" rows="4" style="min-height:100px">'+esc(currentText)+'</textarea>'+
        '<div style="margin-top:10px"><select class="gh-select" id="ghEditPostVis">'+
          '<option value="public"'+(currentVis==='public'?' selected':'')+'>🌍 Public</option>'+
          '<option value="followers"'+(currentVis==='followers'?' selected':'')+'>👁 Followers</option>'+
          '<option value="close_friends"'+(currentVis==='close_friends'||currentVis==='friends'?' selected':'')+'>⭐ Close Friends</option>'+
          '<option value="onlyme"'+(currentVis==='onlyme'?' selected':'')+'>🔒 Only Me</option>'+
        '</select></div>';
      modal('Edit post', body,
        '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSavePostEdit">Save</button>',
        'ghEditPostModal');
      document.getElementById('ghSavePostEdit').onclick = function() {
        var newText = document.getElementById('ghEditPostText').value.trim();
        var newVis  = document.getElementById('ghEditPostVis').value;
        if(!newText) return;
        fs().updateDoc(fs().doc(db(),'posts',pid), { text:newText, visibility:newVis, updatedAt:fs().serverTimestamp() })
          .then(function(){
            var m = document.getElementById('ghEditPostModal'); if(m) m.remove();
            // Update text in card without full reload
            if(card){
              var textEl = card.querySelector('.gh-post-text');
              if(textEl) textEl.textContent = newText;
            }
            toast('Post updated');
          })
          .catch(function(err){ toast('Could not save: '+(err.code||err.message),'error'); });
      };
    }).catch(function(){ toast('Could not load post','error'); });
  }

  function createReport(type,id,reason){
    if(!requireLogin()) return;
    if(window.GeoModeration) { window.GeoModeration.openReportModal(type, id, ''); return; }
    if(GS() && GS().reportTarget) return GS().reportTarget(type, id, reason);
    var u=authUser();
    fs().addDoc(fs().collection(db(),'reports'), { reporterId:u.uid, targetType:type, targetId:id, reason:reason||'report', status:'pending', createdAt:fs().serverTimestamp() }).then(function(){toast('Report sent');}).catch(function(){toast('Report failed','error');});
  }


  function setupSafetyListener(onChange){
    if(state.safetyUnsub){ return; }
    if(!GS() || !GS().listenSafetyPrefs) return;
    state.safetyUnsub = GS().listenSafetyPrefs(function(prefs){
      state.hiddenPostIds = prefs.hiddenPostIds || [];
      state.blockedUserIds = prefs.blockedUserIds || [];
      state.mutedUserIds = prefs.mutedUserIds || [];
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

  function openDeepLinkedStory(){
    var sid = new URLSearchParams(location.search).get('story');
    if(!sid) return;
    var GF = window.GeoFirebase;
    if(!GF || !GF.fs || !GF.db) return;
    GF.fs.getDoc(GF.fs.doc(GF.db, 'stories', sid)).then(function(snap){
      if(!snap.exists || !snap.exists()){
        toast('Story not found or has expired.');
        return;
      }
      var data = snap.data() || {};
      var tsVal = data.createdAt;
      var ms = tsVal && tsVal.toMillis ? tsVal.toMillis() : (tsVal && tsVal.seconds ? tsVal.seconds*1000 : 0);
      if(ms && (Date.now() - ms) > 24 * 3600 * 1000){
        toast('This story has expired.');
        return;
      }
      var story = normalizeStoryItem(Object.assign({ id: snap.id }, data));
      openStoryViewer(buildStoryGroups([story]), 0, 0);
    }).catch(function(){ });
  }

  function feedRightSidebar(){
    return '<div id="ghFeedRight">'+
      '<div class="gh-panel gh-right-widget" id="ghOnlineFriendsPanel"><div class="gh-section-title"><h3><i class="fas fa-circle" style="color:#22c55e;font-size:.55rem"></i> Online Friends</h3></div><div id="ghOnlineFriendsList"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div></div>'+
      '<div class="gh-panel gh-right-widget" id="ghPymkPanel"><div class="gh-section-title"><h3>People You May Know</h3><a class="gh-small" href="search.html">Find people</a></div><div id="ghPymkList"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div></div>'+
      '<div class="gh-panel gh-right-widget" id="ghCreatorPanel"><div class="gh-section-title"><h3>Featured Creators</h3><a class="gh-small" href="creators.html">All</a></div><div id="ghCreatorList"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div></div>'+
      '<div class="gh-panel gh-right-widget"><div class="gh-section-title"><h3>Suggested Pages</h3><a class="gh-small" href="business.html">All</a></div><div id="ghSuggestedPages"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div></div>'+
      '<div class="gh-panel gh-right-widget" id="ghFeedGroupsPanel"><div class="gh-section-title"><h3>Suggested Groups</h3><a class="gh-small" href="groups.html">All</a></div><div id="ghFeedGroupsList"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div></div>'+
      '<div class="gh-panel gh-right-widget" id="ghFeedEventsPanel"><div class="gh-section-title"><h3>Upcoming Events</h3><a class="gh-small" href="events.html">All</a></div><div id="ghFeedEventsList"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div></div>'+
      '<div class="gh-panel gh-right-widget" id="ghFeedCheckinsPanel"><div class="gh-section-title"><h3>Recent Check-ins</h3><a class="gh-small" href="checkin.html">Check in</a></div><div id="ghFeedCheckinsList"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div></div>'+
      '<div class="gh-panel gh-right-widget"><div class="gh-section-title"><h3>Contacts</h3></div><input class="gh-input" id="ghContactsSearch" placeholder="Search contacts…" style="margin-bottom:8px"><div id="ghContactsList"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div></div>'+
    '</div>';
  }

  function pageHomeContext(actor){
    var name=actor.title||actor.name||'Business';
    var logo=actor.logoUrl||actor.avatar||'';
    var bizId=actor.businessId;
    var inbox=actorMessagesHref(actor);
    return '<section class="gh-card gh-page-home-card">'+
      '<div class="gh-page-home-main">'+
        '<span class="gh-page-home-avatar">'+(logo?img(logo,name):'<i class="fas fa-store"></i>')+'</span>'+
        '<div class="gh-page-home-copy">'+
          '<h1>'+esc(name)+' Home</h1>'+
          '<p>You\'re using GeoHub as '+esc(name)+'. Manage posts, messages, quotes, and page activity from here.</p>'+
        '</div>'+
      '</div>'+
      '<div class="gh-page-home-actions">'+
        '<a class="gh-btn ghost" href="business.html?id='+encodeURIComponent(bizId)+'"><i class="fas fa-arrow-up-right-from-square"></i> View Page</a>'+
        '<button class="gh-btn" data-create-post><i class="fas fa-plus"></i> Create Page Post</button>'+
        '<a class="gh-btn ghost" href="'+inbox+'"><i class="fas fa-comment-dots"></i> Page Inbox</a>'+
        '<a class="gh-btn ghost" href="notifications.html"><i class="fas fa-bell"></i> Page Activity</a>'+
        '<a class="gh-btn ghost" href="business.html?id='+encodeURIComponent(bizId)+'#quotes"><i class="fas fa-file-signature"></i> Quotes</a>'+
      '</div>'+
    '</section>';
  }

  function pageFeedRightSidebar(actor){
    var name=actor.title||actor.name||'Business';
    var bizId=actor.businessId;
    var inbox=actorMessagesHref(actor);
    return '<div id="ghFeedRight" class="gh-page-feed-right">'+
      '<div class="gh-panel gh-right-widget">'+
        '<div class="gh-section-title"><h3>Page Shortcuts</h3></div>'+
        '<div class="gh-page-shortcuts">'+
          '<a class="gh-page-shortcut" href="business.html?id='+encodeURIComponent(bizId)+'"><i class="fas fa-store"></i><span><strong>View Page</strong><small>'+esc(name)+'</small></span></a>'+
          '<a class="gh-page-shortcut" href="'+inbox+'"><i class="fas fa-comment-dots"></i><span><strong>Page Inbox</strong><small>Business conversations</small></span></a>'+
          '<a class="gh-page-shortcut" href="notifications.html"><i class="fas fa-bell"></i><span><strong>Page Activity</strong><small>Notifications for this page</small></span></a>'+
          '<a class="gh-page-shortcut" href="business.html?id='+encodeURIComponent(bizId)+'#quotes"><i class="fas fa-file-signature"></i><span><strong>Quotes</strong><small>Customer quote requests</small></span></a>'+
        '</div>'+
      '</div>'+
      '<div class="gh-panel gh-right-widget">'+
        '<div class="gh-section-title"><h3>Posting As</h3></div>'+
        '<div class="gh-page-right-identity">'+
          '<span class="gh-avatar sm">'+(actor.logoUrl?img(actor.logoUrl,name):esc(initials(name)))+'</span>'+
          '<div><strong>'+esc(name)+'</strong><p class="gh-muted">New feed posts from this page are saved to the business page timeline.</p></div>'+
        '</div>'+
      '</div>'+
      '<div id="gh-page-audience-slot"></div>'+
    '</div>';
  }

  var _audienceUserCache = {};

  function _audienceAvatarHtml(f) {
    var name = f.userName || f.displayName || 'User';
    if (f.userAvatar) return img(f.userAvatar, name);
    return '<span class="gh-aud-initials">'+esc(initials(name))+'</span>';
  }

  function _audienceRowHtml(f) {
    var href = 'profile.html?uid='+encodeURIComponent(f.userId||f.uid||'');
    var name = esc(f.userName || f.displayName || 'GeoHub User');
    var dateStr = f.createdAt ? '<span class="gh-aud-date">'+timeAgo(f.createdAt)+'</span>' : '';
    return '<a href="'+href+'" class="gh-aud-row">'+
      '<div class="gh-aud-av">'+_audienceAvatarHtml(f)+'</div>'+
      '<div class="gh-aud-info"><span class="gh-aud-name">'+name+'</span>'+dateStr+'</div>'+
    '</a>';
  }

  function _fetchAudienceProfile(uid, row) {
    if (!uid || !row) return;
    if (_audienceUserCache[uid]) {
      var d = _audienceUserCache[uid];
      if (d.userAvatar) row.querySelector('.gh-aud-av').innerHTML = img(d.userAvatar, d.userName||'');
      if (d.userName) row.querySelector('.gh-aud-name').textContent = d.userName;
      return;
    }
    _audienceUserCache[uid] = {};
    fs().getDoc(fs().doc(db(),'users',uid)).then(function(snap){
      if (!snap.exists()) return;
      var d = snap.data() || {};
      var uName = d.fullName || d.displayName || d.name || 'GeoHub User';
      var uAv   = d.avatar || d.photoURL || '';
      _audienceUserCache[uid] = { userName: uName, userAvatar: uAv };
      if (uAv && row.isConnected) row.querySelector('.gh-aud-av').innerHTML = img(uAv, uName);
      if (uName && row.isConnected) { var n=row.querySelector('.gh-aud-name'); if(n) n.textContent=uName; }
    }).catch(function(){});
  }

  function _audienceQueryFirst(bizId) {
    var c = fs().collection(db(),'businessFollowers');
    try {
      return fs().query(c, fs().where('businessId','==',bizId), fs().orderBy('createdAt','desc'), fs().limit(20));
    } catch(_e) {
      return fs().query(c, fs().where('businessId','==',bizId), fs().limit(20));
    }
  }

  function _audienceQueryAfter(bizId, lastDoc) {
    var c = fs().collection(db(),'businessFollowers');
    try {
      return fs().query(c, fs().where('businessId','==',bizId), fs().orderBy('createdAt','desc'), fs().startAfter(lastDoc), fs().limit(20));
    } catch(_e) {
      return null;
    }
  }

  function openPageAudienceModal(bizId, totalCount) {
    var old = document.getElementById('ghAudienceModal');
    if (old) old.remove();

    var wrap = document.createElement('div');
    wrap.id = 'ghAudienceModal';
    wrap.className = 'gh-modal-backdrop';
    wrap.innerHTML =
      '<div class="gh-modal gh-aud-modal">'+
        '<div class="gh-modal-head">'+
          '<h3><i class="fas fa-users" style="color:var(--gh-accent);margin-right:8px"></i>Page Audience'+
            (totalCount ? ' <span class="gh-aud-modal-count">('+totalCount+')</span>' : '')+
          '</h3>'+
          '<button class="gh-modal-close" data-close-modal>✕</button>'+
        '</div>'+
        '<div class="gh-modal-body gh-aud-modal-body" id="ghAudienceList"></div>'+
        '<div class="gh-modal-actions" id="ghAudienceActions" style="justify-content:center">'+
          '<div class="gh-aud-modal-status" id="ghAudienceStatus" style="font-size:13px;color:var(--gh-muted)">Loading...</div>'+
        '</div>'+
      '</div>';

    document.body.appendChild(wrap);
    wrap.addEventListener('click', function(e){
      if (e.target === wrap || e.target.closest('[data-close-modal]')) wrap.remove();
    });
    document.addEventListener('keydown', function onEsc(e){
      if (e.key === 'Escape') { wrap.remove(); document.removeEventListener('keydown', onEsc); }
    });

    var list   = wrap.querySelector('#ghAudienceList');
    var status = wrap.querySelector('#ghAudienceStatus');
    var acts   = wrap.querySelector('#ghAudienceActions');
    var _lastDoc = null;
    var _done    = false;

    function appendRows(snap) {
      if (snap.empty) { _done = true; return; }
      snap.forEach(function(d){
        var f = d.data() || {};
        var uid = f.userId || f.uid || '';
        var row = document.createElement('div');
        row.innerHTML = _audienceRowHtml(f);
        var a = row.firstChild;
        list.appendChild(a);
        if (uid && (!f.userName || !f.userAvatar)) _fetchAudienceProfile(uid, a);
      });
      _lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < 20) _done = true;
    }

    function showLoadMore() {
      status.textContent = '';
      var existing = acts.querySelector('.gh-aud-load-more');
      if (existing) existing.remove();
      if (_done) {
        status.textContent = '';
        if (!list.children.length) status.textContent = 'No followers yet';
        return;
      }
      var btn = document.createElement('button');
      btn.className = 'gh-btn ghost gh-aud-load-more';
      btn.textContent = 'Load more';
      btn.onclick = function() {
        if (!_lastDoc) return;
        btn.disabled = true; btn.textContent = 'Loading…';
        var q = _audienceQueryAfter(bizId, _lastDoc);
        if (!q) { _done = true; btn.remove(); return; }
        fs().getDocs(q).then(function(snap){
          appendRows(snap);
          btn.remove();
          showLoadMore();
        }).catch(function(err){
          btn.disabled = false; btn.textContent = 'Load more';
          console.warn('[GeoHub] audience load more failed', err && err.message);
        });
      };
      acts.appendChild(btn);
    }

    fs().getDocs(_audienceQueryFirst(bizId)).then(function(snap){
      status.textContent = '';
      appendRows(snap);
      if (!list.children.length) {
        list.innerHTML = '<div class="gh-empty"><i class="fas fa-users"></i><h3>No followers yet</h3><p>Create posts or share your page to grow your audience.</p></div>';
        _done = true;
      }
      showLoadMore();
    }).catch(function(err){
      status.textContent = 'Could not load followers.';
      console.warn('[GeoHub] audience modal load failed', err && err.message);
    });
  }

  function loadPageAudienceWidget(bizId){
    if(!bizId) return;
    var slot=document.getElementById('gh-page-audience-slot');
    if(!slot) return;
    slot.innerHTML='<div class="gh-panel gh-right-widget"><div class="gh-section-title"><h3>Page Audience</h3></div><div style="padding:12px;color:var(--gh-muted);text-align:center;font-size:13px;">Loading...</div></div>';

    var PREVIEW = 8;
    Promise.all([
      fs().getDocs(fs().query(fs().collection(db(),'businessFollowers'), fs().where('businessId','==',bizId), fs().limit(PREVIEW))),
      fs().getDoc(fs().doc(db(),'businesses',bizId))
    ]).then(function(results){
      var snap=results[0]; var bizDoc=results[1];
      var count=(bizDoc.exists()&&bizDoc.data().followerCount) || snap.size || 0;
      var followers=[]; snap.forEach(function(d){ followers.push(d.data()); });
      followers.sort(function(a,b){ return ts(b.createdAt)-ts(a.createdAt); });
      followers=followers.slice(0,PREVIEW);

      var rowsHtml = followers.map(function(f){ return _audienceRowHtml(f); }).join('');
      var hasFollowers = followers.length > 0;
      var viewAllBtn = hasFollowers
        ? '<button class="gh-btn sm ghost gh-aud-view-all" data-biz-id="'+esc(bizId)+'" data-biz-count="'+count+'" style="width:100%;margin-top:8px"><i class="fas fa-users"></i> View All</button>'
        : '';

      slot.innerHTML='<div class="gh-panel gh-right-widget">'+
        '<div class="gh-section-title">'+
          '<h3>Page Audience</h3>'+
          '<div class="gh-aud-stat"><span class="gh-aud-count">'+count+'</span><span class="gh-aud-label"> followers</span></div>'+
        '</div>'+
        '<div class="gh-aud-preview">'+
          (hasFollowers
            ? '<div class="gh-aud-list" id="ghAudiencePreviewList">'+rowsHtml+'</div>'
            : '<div class="gh-aud-empty"><p>No followers yet</p><p class="gh-aud-hint">Create posts or share your page to grow your audience.</p></div>')+
          viewAllBtn+
        '</div>'+
      '</div>';

      slot.querySelectorAll('.gh-aud-row').forEach(function(row, i){
        var f = followers[i] || {};
        var uid = f.userId || f.uid || '';
        if (uid && (!f.userName || !f.userAvatar)) _fetchAudienceProfile(uid, row);
      });

      var viewAllEl = slot.querySelector('.gh-aud-view-all');
      if (viewAllEl) {
        viewAllEl.addEventListener('click', function(){
          openPageAudienceModal(bizId, count);
        });
      }
    }).catch(function(err){
      console.warn('[GeoHub] page audience widget failed', err && err.message);
      slot.innerHTML='<div class="gh-panel gh-right-widget"><div class="gh-section-title"><h3>Page Audience</h3></div><div class="gh-aud-preview"><div class="gh-aud-empty"><p>No followers yet</p></div></div></div>';
    });
  }

  function isPageFeedPost(p,bizId){
    if(!p || !bizId) return false;
    return (p.targetType==='business' && p.targetId===bizId) ||
      p.businessId===bizId ||
      (p.authorType==='business' && p.authorId===bizId);
  }

  function loadFeedRightSidebar(){
    ready(function(){
      var auth = GF() && GF().auth;
      if(!auth){
        var ob=$('#ghOnlineFriendsList'); if(ob) ob.innerHTML='<div class="gh-muted" style="font-size:.82rem">Unavailable</div>';
        var pb=$('#ghSuggestedPages'); if(pb) pb.innerHTML='<div class="gh-muted" style="font-size:.82rem">Unavailable</div>';
        var cb=$('#ghContactsList'); if(cb) cb.innerHTML='<div class="gh-muted" style="font-size:.82rem">Unavailable</div>';
        loadFeedGroupsWidget(); loadFeedEventsWidget(null); loadFeedCheckinsWidget();
        return;
      }
      // onAuthStateChanged fires once auth is resolved (currentUser may still be null even if ready() fired)
      var unsub = auth.onAuthStateChanged(function(u){
        unsub();
        var onlineBox=$('#ghOnlineFriendsList');
        var pagesBox=$('#ghSuggestedPages');
        var contactsBox=$('#ghContactsList');
        if(!u){
          if(onlineBox) onlineBox.innerHTML='<div class="gh-muted" style="font-size:.82rem">Sign in to see online contacts</div>';
          if(pagesBox) pagesBox.innerHTML='<div class="gh-muted" style="font-size:.82rem">Sign in to see suggestions</div>';
          if(contactsBox) contactsBox.innerHTML='<div class="gh-muted" style="font-size:.82rem">Sign in to see contacts</div>';
          var pymkBox=$('#ghPymkList'); if(pymkBox) pymkBox.innerHTML='<div class="gh-muted" style="font-size:.82rem">Sign in to see suggestions</div>';
          var crBox=$('#ghCreatorList'); if(crBox) crBox.innerHTML='<div class="gh-muted" style="font-size:.82rem">Sign in to see creators</div>';
          loadFeedGroupsWidget(); loadFeedEventsWidget(null); loadFeedCheckinsWidget();
          return;
        }

        var fiveMinsAgo=new Date(Date.now()-5*60*1000);
        fs().getDocs(fs().query(fs().collection(db(),'users'), fs().where('lastSeen','>',fiveMinsAgo), fs().limit(15))).then(function(snap){
          var box=$('#ghOnlineFriendsList'); if(!box) return;
          var items=[]; snap.forEach(function(d){ if(d.id!==u.uid) items.push(Object.assign({id:d.id},d.data())); });
          if(!items.length){ box.innerHTML='<div class="gh-muted" style="font-size:.82rem">No friends online</div>'; return; }
          box.innerHTML='<div class="gh-contacts-list">'+items.slice(0,8).map(function(p){
            var name=p.fullName||p.displayName||p.name||'User';
            var av=p.avatar||p.photoURL||'';
            return '<a class="gh-contact-row" href="messages.html?with='+esc(p.id)+'"><span class="gh-avatar" style="width:32px;height:32px">'+(av?img(av,name):esc(initials(name)))+'</span><span class="gh-contact-name">'+esc(name)+'</span><span class="gh-online-dot"></span></a>';
          }).join('')+'</div>';
        }).catch(function(){ var box=$('#ghOnlineFriendsList'); if(box) box.innerHTML='<div class="gh-muted" style="font-size:.82rem">Online list unavailable</div>'; });

        getLatest('businesses',20).then(function(items){
          var box=$('#ghSuggestedPages'); if(!box) return;
          var seen={};
          var visible=items.filter(function(b){
            if(isDeletedBiz(b)) return false;
            var key=(b.title||b.name||'').toLowerCase().trim();
            if(!key||seen[key]) return false;
            seen[key]=true;
            return true;
          });
          if(!visible.length){ box.innerHTML='<div class="gh-muted" style="font-size:.82rem">No business pages yet</div>'; return; }
          box.innerHTML='<div class="gh-mini-list">'+visible.slice(0,3).map(function(b){
            var title=b.title||b.name||'Business'; var logo=b.logoUrl||'';
            return '<div class="gh-mini-item"><span class="gh-mini-thumb">'+(logo?img(logo,title):'<i class="fas fa-store"></i>')+'</span><div style="flex:1"><strong>'+esc(title)+'</strong><span>'+esc(b.category||'Business')+'</span></div><button class="gh-btn sm ghost" onclick="location.href=\'business.html?id='+esc(b.id)+'\'">View</button></div>';
          }).join('')+'</div>';
        }).catch(function(){ var box=$('#ghSuggestedPages'); if(box) box.innerHTML='<div class="gh-muted" style="font-size:.82rem">Suggested pages unavailable</div>'; });

        loadContactsList(u.uid);
        loadPymkWidget(u.uid);
        loadCreatorWidget(u.uid);
        loadFeedGroupsWidget();
        loadFeedEventsWidget(u.uid);
        loadFeedCheckinsWidget();
      });
    });
  }

  function loadPymkWidget(uid){
    var box=$('#ghPymkList'); if(!box) return;
    if(!fs()||!db()){ box.innerHTML=''; var p=$('#ghPymkPanel'); if(p) p.style.display='none'; return; }
    fs().getDocs(fs().query(fs().collection(db(),'users'), fs().orderBy('followerCount','desc'), fs().limit(12))).then(function(snap){
      var people=[];
      snap.forEach(function(d){ if(d.id===uid) return; var data=d.data()||{}; people.push({id:d.id, fullName:data.fullName||data.displayName||data.name||'GeoHub User', avatar:data.avatar||data.photoURL||'', city:data.city||'', accountType:data.accountType||''}); });
      if(!people.length){ var p=$('#ghPymkPanel'); if(p) p.style.display='none'; return; }
      var shown=people.slice(0,5);
      box.innerHTML='<div class="gh-mini-list">'+shown.map(function(p){
        var name=esc(p.fullName);
        var avHtml=p.avatar ? '<img src="'+esc(p.avatar)+'" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.onerror=null;this.parentNode.innerHTML=\'<span style=&quot;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6d3fd9,#10b981);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:700;flex-shrink:0&quot;>'+esc(initials(p.fullName))+'</span>\'">' : '<span style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6d3fd9,#10b981);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:700;flex-shrink:0">'+esc(initials(p.fullName))+'</span>';
        var creatorChip=p.accountType==='creator'?'<span style="font-size:.62rem;color:#10b981;font-weight:700;margin-left:4px">● Creator</span>':'';
        return '<div class="gh-mini-item" style="gap:8px">'+
          '<a href="profile.html?id='+esc(p.id)+'" style="flex-shrink:0;line-height:0">'+avHtml+'</a>'+
          '<div style="flex:1;min-width:0;overflow:hidden"><div style="font-size:.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+name+creatorChip+'</div><div style="font-size:.72rem;color:var(--gh-muted)">'+esc(p.city||'Georgia')+'</div></div>'+
          '<button class="gh-btn sm ghost gh-pymk-btn" data-pymk-uid="'+esc(p.id)+'" style="flex-shrink:0;padding:4px 8px;font-size:.72rem">Follow</button>'+
          '</div>';
      }).join('')+'</div>';
      Array.from(box.querySelectorAll('.gh-pymk-btn')).forEach(function(btn){
        btn.onclick=function(){
          var tid=btn.dataset.pymkUid;
          if(!GS()||!GS().toggleFollow){ return; }
          GS().toggleFollow(tid,function(isNow){
            btn.textContent=isNow?'Following':'Follow';
            btn.classList.toggle('gh-btn-active',!!isNow);
          });
        };
      });
    }).catch(function(){ var p=$('#ghPymkPanel'); if(p) p.style.display='none'; });
  }

  function loadCreatorWidget(uid){
    var box=$('#ghCreatorList'); if(!box) return;
    if(!fs()||!db()){ box.innerHTML=''; var p=$('#ghCreatorPanel'); if(p) p.style.display='none'; return; }
    fs().getDocs(fs().query(fs().collection(db(),'users'), fs().where('accountType','==','creator'), fs().limit(8))).then(function(snap){
      var creators=[];
      snap.forEach(function(d){ if(d.id===uid) return; var data=d.data()||{}; creators.push({id:d.id, fullName:data.fullName||data.displayName||data.name||'Creator', avatar:data.avatar||data.photoURL||'', city:data.city||'', niche:data.niche||data.creatorNiche||data.category||''}); });
      if(!creators.length){ var p=$('#ghCreatorPanel'); if(p) p.style.display='none'; return; }
      var shown=creators.slice(0,4);
      box.innerHTML='<div class="gh-mini-list">'+shown.map(function(c){
        var name=esc(c.fullName);
        var avHtml=c.avatar ? '<img src="'+esc(c.avatar)+'" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.onerror=null;this.parentNode.innerHTML=\'<span style=&quot;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#ec4899,#f59e0b);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:700;flex-shrink:0&quot;>'+esc(initials(c.fullName))+'</span>\'">' : '<span style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#ec4899,#f59e0b);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:700;flex-shrink:0">'+esc(initials(c.fullName))+'</span>';
        return '<div class="gh-mini-item" style="gap:8px">'+
          '<a href="profile.html?id='+esc(c.id)+'" style="flex-shrink:0;line-height:0">'+avHtml+'</a>'+
          '<div style="flex:1;min-width:0;overflow:hidden"><div style="font-size:.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+name+'</div><div style="font-size:.72rem;color:var(--gh-muted)">'+esc(c.niche||c.city||'Creator')+'</div></div>'+
          '<a href="profile.html?id='+esc(c.id)+'" class="gh-btn sm ghost" style="flex-shrink:0;padding:4px 8px;font-size:.72rem">View</a>'+
          '</div>';
      }).join('')+'</div>';
    }).catch(function(){ var p=$('#ghCreatorPanel'); if(p) p.style.display='none'; });
  }

  function loadFeedGroupsWidget(){
    var box=$('#ghFeedGroupsList'); if(!box) return;
    if(!fs()||!db()){ var p=$('#ghFeedGroupsPanel'); if(p) p.style.display='none'; return; }
    getLatest('groups',4).then(function(groups){
      var pub=groups.filter(function(g){ return (g.privacy||'public')!=='secret'; });
      if(!pub.length){ var p=$('#ghFeedGroupsPanel'); if(p) p.style.display='none'; return; }
      box.innerHTML='<div class="gh-mini-list">'+pub.slice(0,4).map(function(g){
        var title=g.name||g.title||'Group';
        var photo=g.logoUrl||g.coverImageUrl||g.coverUrl||g.imageUrl||g.photoUrl||'';
        var members=Number(g.memberCount||g.membersCount||0);
        return '<a class="gh-mini-item" href="groups.html?id='+esc(g.id)+'" style="text-decoration:none;color:inherit">'+
          '<span class="gh-mini-thumb">'+(photo?'<img src="'+esc(photo)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px" onerror="this.onerror=null;this.style.display=\'none\'">':'<i class="fas fa-users"></i>')+'</span>'+
          '<div style="flex:1;min-width:0"><div style="font-size:.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(title)+'</div><div style="font-size:.72rem;color:var(--gh-muted)">'+esc(g.category||'Group')+(members?' · '+members+' members':'')+'</div></div>'+
          '</a>';
      }).join('')+'</div>';
    }).catch(function(){ var p=$('#ghFeedGroupsPanel'); if(p) p.style.display='none'; });
  }

  function loadFeedEventsWidget(uid){
    var box=$('#ghFeedEventsList'); if(!box) return;
    if(!fs()||!db()){ var p=$('#ghFeedEventsPanel'); if(p) p.style.display='none'; return; }
    loadUserCity(uid, function(city){
      getLatest('events',15).then(function(allEvents){
        var upcoming=allEvents.filter(function(e){ return isFutureTsVal(e.startDate||e.date); });
        var filtered=cityFilter(upcoming, city, ['city','location']);
        var shown=filtered.slice(0,3);
        if(!shown.length){ var p=$('#ghFeedEventsPanel'); if(p) p.style.display='none'; return; }
        var panel=$('#ghFeedEventsPanel');
        if(panel&&city){ var h3=panel.querySelector('h3'); if(h3) h3.textContent='Upcoming Events in '+city; }
        box.innerHTML='<div class="gh-mini-list">'+shown.map(function(e){
          var title=e.name||e.title||'Event';
          var when=e.startDate||e.date;
          var whenStr=when?timeAgo(when):'';
          return '<a class="gh-mini-item" href="events.html?id='+esc(e.id)+'" style="text-decoration:none;color:inherit">'+
            '<span class="gh-mini-thumb event"><i class="fas fa-calendar-check"></i></span>'+
            '<div style="flex:1;min-width:0"><div style="font-size:.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(title)+'</div>'+
            '<div style="font-size:.72rem;color:var(--gh-muted)">'+esc(e.city||e.location||whenStr||'Event')+'</div></div>'+
            '</a>';
        }).join('')+'</div>';
      }).catch(function(){ var p=$('#ghFeedEventsPanel'); if(p) p.style.display='none'; });
    });
  }

  function loadFeedCheckinsWidget(){
    var box=$('#ghFeedCheckinsList'); if(!box) return;
    if(!fs()||!db()){ var p=$('#ghFeedCheckinsPanel'); if(p) p.style.display='none'; return; }
    getLatest('checkins',8).then(function(checkins){
      if(!checkins.length){ var p=$('#ghFeedCheckinsPanel'); if(p) p.style.display='none'; return; }
      box.innerHTML='<div class="gh-mini-list">'+checkins.map(function(c){
        var placeName=c.placeName||c.name||c.placeTitle||'A place';
        var city=c.city||c.placeCity||'';
        var when=c.createdAt;
        var whenStr=when?timeAgo(when):'';
        var placeId=c.placeId||c.place||'';
        var href=placeId?'places.html?id='+esc(placeId):'checkin.html';
        return '<a class="gh-mini-item" href="'+href+'" style="text-decoration:none;color:inherit">'+
          '<span class="gh-mini-thumb" style="background:linear-gradient(135deg,#10b981,#06b6d4)"><i class="fas fa-map-pin"></i></span>'+
          '<div style="flex:1;min-width:0"><div style="font-size:.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(placeName)+'</div>'+
          '<div style="font-size:.72rem;color:var(--gh-muted)">'+esc(city||whenStr||'Check-in')+'</div></div>'+
          '</a>';
      }).join('')+'</div>';
    }).catch(function(){ var p=$('#ghFeedCheckinsPanel'); if(p) p.style.display='none'; });
  }

  function loadContactsList(uid){
    var box=$('#ghContactsList'); if(!box) return;
    if(!fs()||!db()){ box.innerHTML='<div class="gh-muted" style="font-size:.82rem">Contacts unavailable</div>'; return; }
    var allContacts=[];
    Promise.all([
      fs().getDocs(fs().query(fs().collection(db(),'follows'), fs().where('followerId','==',uid), fs().limit(50))).then(function(snap){
        var ids=[]; snap.forEach(function(d){ var id=(d.data()||{}).followingId; if(id&&id!==uid) ids.push(id); });
        return ids;
      }).catch(function(){ return []; })
    ]).then(function(res){
      var ids=res[0]; if(!ids.length){ box.innerHTML='<div class="gh-muted" style="font-size:.82rem">No contacts yet</div>'; return; }
      return Promise.all(ids.slice(0,20).map(function(id){ return fs().getDoc(fs().doc(db(),'users',id)).then(function(d){ return d.exists()?Object.assign({id:d.id},d.data()):null; }).catch(function(){ return null; }); }));
    }).then(function(profiles){
      if(!profiles) return;
      allContacts=(profiles||[]).filter(Boolean);
      renderContactsList(allContacts,'');
    }).catch(function(){ var box=$('#ghContactsList'); if(box) box.innerHTML='<div class="gh-muted" style="font-size:.82rem">Contacts unavailable</div>'; });

    var search=$('#ghContactsSearch');
    if(search) search.addEventListener('input',function(){ renderContactsList(allContacts, search.value.trim().toLowerCase()); });
  }

  function renderContactsList(contacts, q){
    var box=$('#ghContactsList'); if(!box) return;
    var filtered=q ? contacts.filter(function(p){ return (p.fullName||p.displayName||p.name||'').toLowerCase().includes(q); }) : contacts;
    if(!filtered.length){ box.innerHTML='<div class="gh-muted" style="font-size:.82rem">No contacts found</div>'; return; }
    box.innerHTML='<div class="gh-contacts-list">'+filtered.slice(0,15).map(function(p){
      var name=p.fullName||p.displayName||p.name||'User';
      var av=p.avatar||p.photoURL||'';
      return '<a class="gh-contact-row" href="messages.html?with='+esc(p.id)+'"><span class="gh-avatar" style="width:32px;height:32px">'+(av?img(av,name):esc(initials(name)))+'</span><span class="gh-contact-name">'+esc(name)+'</span></a>';
    }).join('')+'</div>';
  }

  function getFeedComposerActor(){
    var actor=getActiveActor();
    if(actor&&actor.type==='business') return { name:actor.title||'Business', avatar:actor.logoUrl||'' };
    var c=getCachedUser();
    return c||null;
  }

  // ── Onboarding helpers ────────────────────────────────────────────────────

  function _loadUiState(uid, cb){
    var gf=GF(); if(!gf||!gf.fs||!gf.db){ cb({}); return; }
    gf.fs.getDoc(gf.fs.doc(gf.db,'userUiState',uid)).then(function(snap){
      cb(snap.exists() ? snap.data() : {});
    }).catch(function(){ cb({}); });
  }

  function _saveUiState(uid, updates){
    var gf=GF(); if(!gf||!gf.fs||!gf.db) return;
    gf.fs.setDoc(gf.fs.doc(gf.db,'userUiState',uid), updates, {merge:true}).catch(function(){});
  }

  function maybeShowOnboarding(slot){
    if(!slot) return;
    var gf=GF(); if(!gf||!gf.auth||!gf.authFns) return;
    var unsub=gf.authFns.onAuthStateChanged(gf.auth, function(fbUser){
      unsub();
      if(!fbUser) return;
      var uid=fbUser.uid;
      _loadUiState(uid, function(st){
        var html='';
        if(!st.onboardingDismissed){
          html+='<div class="gh-onboard-card" id="ghOnboardCard">'+
            '<button class="gh-onboard-x" onclick="(function(){'+
              'var c=document.getElementById(\'ghOnboardCard\');'+
              'if(c){c.classList.add(\'dismissing\');setTimeout(function(){c.remove();},310);}'+
              'window._ghSaveUiState&&window._ghSaveUiState(\''+esc(uid)+'\',{onboardingDismissed:true});'+
            '})()"><i class="fas fa-times"></i></button>'+
            '<div class="gh-onboard-hero"><span class="gh-onboard-globe">🌍</span><div>'+
              '<p class="gh-onboard-title">Welcome to GeoHub!</p>'+
              '<p class="gh-onboard-desc">Georgia\'s real community platform — discover, share, connect.</p>'+
            '</div></div>'+
            '<div class="gh-onboard-steps">'+
              '<a class="gh-onboard-step" href="profile.html"><i class="fas fa-user"></i>Complete your profile<i class="fas fa-chevron-right gh-onboard-arrow"></i></a>'+
              '<a class="gh-onboard-step" href="places.html"><i class="fas fa-map-marker-alt"></i>Explore real places in Georgia<i class="fas fa-chevron-right gh-onboard-arrow"></i></a>'+
              '<a class="gh-onboard-step" href="groups.html"><i class="fas fa-users"></i>Join or create a group<i class="fas fa-chevron-right gh-onboard-arrow"></i></a>'+
              '<a class="gh-onboard-step" href="events.html"><i class="fas fa-calendar-alt"></i>Find upcoming events<i class="fas fa-chevron-right gh-onboard-arrow"></i></a>'+
              '<button class="gh-onboard-step" data-create-post><i class="fas fa-pen"></i>Share your first post<i class="fas fa-chevron-right gh-onboard-arrow"></i></button>'+
              '<button class="gh-onboard-step" style="border-color:rgba(16,185,129,.2);background:rgba(16,185,129,.06)" onclick="window._ghStartTour&&window._ghStartTour(\''+esc(uid)+'\')"><i class="fas fa-compass"></i>Take a quick tour of GeoHub<i class="fas fa-chevron-right gh-onboard-arrow"></i></button>'+
            '</div>'+
          '</div>';
        }
        var missingPhoto=!fbUser.photoURL;
        var missingName=!fbUser.displayName||fbUser.displayName.trim()==='';
        if(!st.profilePromptDismissed && (missingPhoto||missingName)){
          var missing=missingPhoto&&missingName?'photo and display name':missingPhoto?'profile photo':'display name';
          html+='<div class="gh-profile-prompt" id="ghProfilePrompt">'+
            '<i class="fas fa-user-circle"></i>'+
            '<div class="gh-profile-prompt-body">'+
              '<strong>Finish setting up your profile</strong>'+
              '<span>Add your '+esc(missing)+' so others can find you.</span>'+
            '</div>'+
            '<a class="gh-profile-prompt-btn" href="profile.html">Update</a>'+
            '<button class="gh-profile-prompt-btn" style="margin-left:6px;background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.1);color:var(--gh-muted)" onclick="(function(){'+
              'var e=document.getElementById(\'ghProfilePrompt\');if(e)e.remove();'+
              'window._ghSaveUiState&&window._ghSaveUiState(\''+esc(uid)+'\',{profilePromptDismissed:true});'+
            '})()">Dismiss</button>'+
          '</div>';
        }
        if(html){
          slot.innerHTML=html;
          var btn=slot.querySelector('[data-create-post]');
          if(btn) btn.onclick=function(){ openCreatePostModal&&openCreatePostModal(); };
        }
      });
    });
    window._ghSaveUiState=_saveUiState;
  }

  // ── Guided Tour ──────────────────────────────────────────────────────────

  var TOUR_STEPS=[
    {icon:'fa-house',title:'Your Feed',desc:'Create posts, share photos, add stories, and react to real content from people across Georgia.',sel:'#ghFeedList, .gh-composer'},
    {icon:'fa-search',title:'Search Everything',desc:'Find people, businesses, places, groups, and events instantly using the search bar at the top.',sel:'#ghGlobalSearch'},
    {icon:'fa-store',title:'Business Pages',desc:'Discover verified Georgian businesses, leave reviews, request quotes, and follow your favorites.',sel:'a[href="business.html"]'},
    {icon:'fa-location-dot',title:'Places, Events & Groups',desc:'Explore real places on the map, find upcoming events, and join communities that share your interests.',sel:'a[href="places.html"]'},
    {icon:'fa-comment-dots',title:'Messages & Notifications',desc:'Stay connected — chat with friends and get notified about reactions, comments, and friend requests.',sel:'a[href="messages.html"]'},
    {icon:'fa-user',title:'Your Profile',desc:'Add your photo, fill in your bio, earn badges, and build your reputation in the GeoHub community.',sel:'a[href="profile.html"], .gh-user-btn'}
  ];
  var _tourSt={step:0,uid:null};

  function _tourEl(sel){ if(!sel)return null; try{return document.querySelector(sel);}catch(e){return null;} }
  function _tourClearHL(){ document.querySelectorAll('.gh-tour-hl').forEach(function(el){el.classList.remove('gh-tour-hl');}); }

  function _tourRender(){
    var box=document.getElementById('ghTourBox'); if(!box)return;
    var s=_tourSt.step; var step=TOUR_STEPS[s]; var total=TOUR_STEPS.length; var last=s===total-1;
    var targetEl=_tourEl(step.sel);
    _tourClearHL();
    if(targetEl){
      targetEl.classList.add('gh-tour-hl');
      try{ targetEl.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'}); }catch(e){}
    }
    var dots=TOUR_STEPS.map(function(_,i){return '<span class="gh-tour-dot'+(i===s?' gh-tour-dot-on':'')+'"></span>';}).join('');
    box.innerHTML=
      '<div class="gh-tour-icon"><i class="fas '+esc(step.icon)+'"></i></div>'+
      '<div class="gh-tour-dots">'+dots+'</div>'+
      '<h3 class="gh-tour-h">'+esc(step.title)+'</h3>'+
      '<p class="gh-tour-p">'+esc(step.desc)+'</p>'+
      '<div class="gh-tour-btns">'+
        (s>0?'<button class="gh-tbtn" data-tbk>‹ Back</button>':'<span></span>')+
        '<div class="gh-tour-right">'+
          '<button class="gh-tbtn" data-tsk>Skip</button>'+
          (last?'<button class="gh-tbtn gh-tbtn-p" data-tfn>Finish ✓</button>':'<button class="gh-tbtn gh-tbtn-p" data-tnx>Next ›</button>')+
        '</div>'+
      '</div>';
    var isMobile=window.innerWidth<640;
    if(!targetEl||isMobile){
      box.className='gh-tour-box gh-tour-cx';
      box.style.top=''; box.style.left=''; box.style.width='';
    } else {
      box.className='gh-tour-box';
      var r=targetEl.getBoundingClientRect(); var bw=300; var bh=220; var vw=window.innerWidth; var vh=window.innerHeight;
      var top=r.bottom+12; if(top+bh>vh) top=Math.max(12,r.top-bh-12);
      var left=Math.max(12,Math.min(r.left,vw-bw-12));
      box.style.top=top+'px'; box.style.left=left+'px'; box.style.width=bw+'px';
    }
    var bk=box.querySelector('[data-tbk]'); if(bk) bk.onclick=function(){_tourSt.step--;_tourRender();};
    var sk=box.querySelector('[data-tsk]'); if(sk) sk.onclick=function(){_tourDone(false,true);};
    var nx=box.querySelector('[data-tnx]'); if(nx) nx.onclick=function(){_tourSt.step++;_tourRender();};
    var fn=box.querySelector('[data-tfn]'); if(fn) fn.onclick=function(){_tourDone(true,false);};
  }

  function _tourDone(completed,skipped){
    _tourClearHL();
    var box=document.getElementById('ghTourBox'); var bd=document.getElementById('ghTourBd');
    function fadeOut(el){ if(!el)return; el.style.opacity='0'; el.style.transform='scale(.95)'; setTimeout(function(){if(el.parentNode)el.remove();},260); }
    fadeOut(box); fadeOut(bd);
    var uid=_tourSt.uid;
    if(uid){
      var up={};
      if(completed){up.tourCompleted=true;up.tourCompletedAt=new Date().toISOString();}
      if(skipped){up.tourSkipped=true;up.tourSkippedAt=new Date().toISOString();}
      if(completed||skipped) _saveUiState(uid,up);
    }
  }

  function startTour(uid){
    _tourSt.step=0; _tourSt.uid=uid||null;
    var old=document.getElementById('ghTourBox'); if(old)old.remove();
    var obd=document.getElementById('ghTourBd'); if(obd)obd.remove();
    _tourClearHL();
    var bd=document.createElement('div'); bd.id='ghTourBd'; bd.className='gh-tour-bd';
    document.body.appendChild(bd);
    var box=document.createElement('div'); box.id='ghTourBox'; box.className='gh-tour-box';
    box.style.opacity='0'; box.style.transform='scale(.94)';
    document.body.appendChild(box);
    _tourRender();
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        box.style.transition='opacity .22s,transform .22s,top .25s,left .25s';
        box.style.opacity='1'; box.style.transform='';
      });
    });
  }

  window._ghStartTour=startTour;

  function renderFeed(){
    clearFeedListener();
    var renderId=++state.feedRenderId;
    var actor=activeBusinessActor();
    var pageMode=!!actor;
    document.body.classList.toggle('gh-page-feed-mode', pageMode);
    state.feedTab = 'foryou';
    var c=getFeedComposerActor();
    var compAvClass='gh-avatar'+(c?'':' gh-skel');
    var compAvContent=c?(c.avatar?'<img src="'+esc(c.avatar)+'" alt="" loading="eager" onerror="this.remove()">':esc(initials(c.name||''))):'';
    var composerText=pageMode ? 'Post as '+(actor.title||'Business') : '';
    var composerActions=pageMode
      ? '<button class="gh-composer-action" data-create-post><i class="fas fa-image" style="color:#22c55e"></i> Photo</button><button class="gh-composer-action" data-create-post><i class="fas fa-pen-to-square" style="color:#38bdf8"></i> Page Post</button><button class="gh-composer-action" onclick="location.href=\''+actorMessagesHref(actor)+'\'"><i class="fas fa-comment-dots" style="color:#f59e0b"></i> Inbox</button><button class="gh-composer-action" onclick="location.href=\'notifications.html\'"><i class="fas fa-bell" style="color:#ef4444"></i> Activity</button>'
      : '<button class="gh-composer-action" data-create-post><i class="fas fa-image" style="color:#22c55e"></i> Photo</button><button class="gh-composer-action" onclick="location.href=\'places.html\'"><i class="fas fa-map-marker-alt" style="color:#ef4444"></i> Place</button><button class="gh-composer-action" onclick="location.href=\'add-business.html\'"><i class="fas fa-store" style="color:#38bdf8"></i> Business</button><button class="gh-composer-action" onclick="location.href=\'events.html\'"><i class="fas fa-calendar" style="color:#f59e0b"></i> Event</button>';
    shell({ active:'feed',
      right: pageMode ? pageFeedRightSidebar(actor) : feedRightSidebar(),
      center:
        (pageMode ? pageHomeContext(actor) : '<section class="gh-card gh-story-strip-card"><div class="gh-stories" id="ghStories"></div></section>')+
        '<section class="gh-card gh-composer"><div class="gh-composer-top"><span class="'+compAvClass+'" id="ghComposerAvatar">'+compAvContent+'</span><button class="gh-composer-fake" data-create-post>რას აზიარებ დღეს?</button></div><div class="gh-composer-actions"><button class="gh-composer-action" data-create-post><i class="fas fa-image" style="color:#22c55e"></i> Photo</button><button class="gh-composer-action" onclick="location.href=\'places.html\'"><i class="fas fa-map-marker-alt" style="color:#ef4444"></i> Place</button><button class="gh-composer-action" onclick="location.href=\'add-business.html\'"><i class="fas fa-store" style="color:#38bdf8"></i> Business</button><button class="gh-composer-action" onclick="location.href=\'events.html\'"><i class="fas fa-calendar" style="color:#f59e0b"></i> Event</button></div></section>'+
        (pageMode ? '' : '<div id="ghWelcomeSlot"></div>')+
        (pageMode ? '<div class="gh-pill-row gh-page-feed-tabs" id="ghFeedTabs" style="padding:0 4px 4px"><button class="gh-pill active" data-feed-tab="page"><i class="fas fa-store" style="font-size:.75rem"></i> Page Activity</button></div>' : '<div class="gh-pill-row" id="ghFeedTabs" style="padding:0 4px 4px"><button class="gh-pill active" data-feed-tab="foryou"><i class="fas fa-house" style="font-size:.75rem"></i> For You</button><button class="gh-pill" data-feed-tab="following"><i class="fas fa-user-group" style="font-size:.75rem"></i> Following</button></div>')+
        '<div id="ghFeedList">'+skelPostCard()+skelPostCard()+skelPostCard()+'</div>'
    });
    if(pageMode){
      var fake=$('.gh-composer-fake');
      var actions=$('.gh-composer-actions');
      var comp=$('.gh-composer');
      if(comp) comp.classList.add('gh-page-composer');
      if(fake) fake.textContent=composerText;
      if(actions) actions.innerHTML=composerActions;
    }
    if(window.refreshMobileNav) setTimeout(window.refreshMobileNav, 0);
    if(!pageMode) loadStories('#ghStories');
    if(!pageMode) loadFeedRightSidebar();
    if(pageMode && actor && actor.businessId) loadPageAudienceWidget(actor.businessId);
    ready(function(){
      if(renderId!==state.feedRenderId) return;
      if(!pageMode) maybeShowOnboarding($('#ghWelcomeSlot'));
      openDeepLinkedStory();
      var list=$('#ghFeedList'); bindPostInteractions(list); var lastPosts=[]; var pageFeedLoaded=false;
      function pageFeedEmptyHtml(){
        return '<div class="gh-card gh-empty gh-page-feed-empty"><i class="fas fa-store"></i><h3>No page posts yet</h3><p>Create a post as '+esc(actor.title||'your page')+' to start building your audience.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="gh-btn" data-create-post><i class="fas fa-plus"></i>Create Page Post</button><a class="gh-btn ghost" href="business.html?id='+encodeURIComponent(actor.businessId)+'"><i class="fas fa-arrow-up-right-from-square"></i>View Page</a><a class="gh-btn ghost" href="'+actorMessagesHref(actor)+'"><i class="fas fa-comment-dots"></i>Page Inbox</a></div></div>';
      }
      function paint(){
        if(renderId!==state.feedRenderId) return;
        if(!list) return;
        var visible=lastPosts.filter(canSeePost);
        if(pageMode){
          visible=visible.filter(function(p){ return isPageFeedPost(p, actor.businessId); });
        } else if(state.feedTab === 'following'){
          var u=authUser();
          if(u){
            visible=visible.filter(function(p){
              var author=p.authorId||p.userId||p.createdByUserId||p.createdBy||'';
              var isFollowedBizPost=p.targetType==='business' && p.targetId && state.followedBusinessIds.indexOf(p.targetId)>-1;
              return isFollowedBizPost || (author && (author===u.uid || state.followingIds.indexOf(author)>-1));
            });
          }
        } else {
          // foryou: merge in all business page posts not already in the main feed
          if(state.bizFeedPosts.length){
            var seen={}; visible.forEach(function(p){ seen[p.id]=true; });
            state.bizFeedPosts.forEach(function(p){
              if(!seen[p.id] && canSeePost(p)){
                seen[p.id]=true; visible.push(p);
              }
            });
            visible.sort(function(a,b){ return ts(b.createdAt)-ts(a.createdAt); });
          }
        }
        if(!visible.length){
          if(pageMode){
            list.innerHTML=pageFeedEmptyHtml();
          } else if(state.feedTab === 'following'){
            list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-user-group"></i><h3>Nothing from people you follow</h3><p>Follow people and creators to see their posts here.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><a class="gh-btn ghost" href="search.html"><i class="fas fa-search"></i>Find people</a><a class="gh-btn ghost" href="creators.html"><i class="fas fa-star"></i>Discover creators</a></div></div>';
          } else {
            list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-seedling"></i><h3>Feed is empty</h3><p>Start connecting with people, groups, and businesses to fill your feed.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="gh-btn" data-create-post><i class="fas fa-plus"></i>Create post</button><a class="gh-btn ghost" href="search.html"><i class="fas fa-search"></i>Find people</a><a class="gh-btn ghost" href="groups.html"><i class="fas fa-users"></i>Join groups</a><a class="gh-btn ghost" href="business.html"><i class="fas fa-store"></i>Businesses</a><a class="gh-btn ghost" href="creators.html"><i class="fas fa-star"></i>Creators</a></div></div>';
          }
          return;
        }
        list.innerHTML=visible.map(function(p){
          var isFollowedPage=!pageMode && p.targetType==='business' && p.targetId && state.followedBusinessIds.indexOf(p.targetId)>-1;
          return postCard(p, isFollowedPage ? {fromFollowedPage:true} : {});
        }).join('');
        visible.forEach(function(p){ try{ hydrateReactionState(p.id); loadReactionBreakdown(p.id); }catch(e){} });
        hydratePostAuthorAvatars(list);
        hydrateSharedPreviews(list);
        // Restore open comment sections that were visible before re-render
        Object.keys(state.openCommentPids).forEach(function(pid){
          if(state.cachedComments[pid]) renderCommentsForPid(pid, state.cachedComments[pid]);
        });
        setTimeout(openDeepLinkedPost, 350);
      }
      var tabsEl=$('#ghFeedTabs');
      if(tabsEl) tabsEl.addEventListener('click',function(e){
        var btn=e.target.closest('[data-feed-tab]'); if(!btn) return;
        state.feedTab=btn.dataset.feedTab;
        $all('.gh-pill',tabsEl).forEach(function(p){p.classList.toggle('active',p===btn);});
        paint();
      });
      setupSafetyListener(paint);
      setupAudienceAccess(paint);
      if(pageMode){
        setTimeout(function(){
          if(renderId===state.feedRenderId && !pageFeedLoaded && list){
            console.warn('[GeoHub] Page feed listener did not return before fallback; showing empty state');
            list.innerHTML=pageFeedEmptyHtml();
          }
        }, 6500);
        state.feedUnsub=listenTargetPosts('business', actor.businessId, function(posts){
          if(renderId!==state.feedRenderId) return;
          pageFeedLoaded=true;
          lastPosts=posts;
          paint();
        });
      } else {
        state.feedUnsub=GS().listenFeed(function(posts){
          if(renderId!==state.feedRenderId) return;
          lastPosts=posts;
          paint();
        }, 50);
        // Listen for page posts from any business so we can merge into For You feed
        if(state.bizFeedUnsub){ try{state.bizFeedUnsub();}catch(e){} state.bizFeedUnsub=null; }
        state.bizFeedUnsub=fs().onSnapshot(
          fs().query(fs().collection(db(),'posts'), fs().where('targetType','==','business'), fs().limit(50)),
          function(snap){
            if(renderId!==state.feedRenderId){ if(state.bizFeedUnsub){ try{state.bizFeedUnsub();}catch(e){} state.bizFeedUnsub=null; } return; }
            var arr=[]; snap.forEach(function(d){ arr.push(Object.assign({id:d.id},d.data())); });
            state.bizFeedPosts=arr;
            paint();
          },
          function(){ state.bizFeedPosts=[]; }
        );
      }
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
    ready(function(){ var q=fs().query(fs().collection(db(),'businesses'), fs().orderBy('createdAt','desc'), fs().limit(40)); var _u=fs().onSnapshot(q,function(snap){ all=[]; snap.forEach(function(d){ var schema=window.GH||{}; var biz=schema.normBiz?schema.normBiz(d.data(),d.id):Object.assign({id:d.id},d.data()); if(isDeletedBiz(biz)) return; all.push(biz); }); paint(); }, function(err){ $('#ghBusinessList').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Could not load businesses</h3><p>'+esc(err.message)+'</p></div>'; }); state.pageUnsubs.push(_u); });
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
              '<button class="gh-btn ghost" data-message-business="'+esc(b.id)+'" data-message-owner="'+esc(owner)+'"><i class="fas fa-comment"></i> Message</button>'+
              (isOwner?'<a class="gh-btn" href="business-suite.html?businessId='+encodeURIComponent(b.id)+'"><i class="fas fa-briefcase"></i> Business Suite</a>':'')+
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
      var msg=e.target.closest('[data-message-business]'); if(msg){ var bizId=msg.dataset.messageBusiness; var oid=msg.dataset.messageOwner; if(!oid) return toast('Business owner not available','error'); if(!requireLogin()) return; GS().startBusinessConversation(bizId,oid,function(cid){ location.href='messages.html?business='+encodeURIComponent(bizId)+'&cid='+encodeURIComponent(cid); }); return; }
      var edit=e.target.closest('[data-edit-business]'); if(edit) location.href='add-business.html?edit='+encodeURIComponent(b.id);
      var cta=e.target.closest('[data-track-cta]'); if(cta&&state.currentBizId) bizTrack(state.currentBizId,cta.dataset.trackCta);
    };

    updateBusinessFollowButton(b.id);
    wireBusinessImageEdits(b);
    renderBusinessTab(b);
    trackBizView(b.id, owner);
  }

  function wireBusinessImageEdits(b) {
    var ownerUid = b.ownerId || b.createdBy || b.userId || '';
    var u = authUser();
    if (!u || !u.uid || !ownerUid || u.uid !== ownerUid) return;

    function doUpload(file, field, onSuccess) {
      if (!file || !window.GeoSocial) return;
      toast('Uploading image…');
      var reader = new FileReader();
      reader.onload = function() {
        window.GeoSocial.uploadImageDataUrl(reader.result, 'businesses')
          .then(function(url) {
            if (!url) throw new Error('Upload returned no URL');
            var patch = { updatedAt: fs().serverTimestamp() };
            patch[field] = url;
            return fs().updateDoc(fs().doc(db(), 'businesses', b.id), patch)
              .then(function() { toast('Image updated'); onSuccess(url); });
          })
          .catch(function(err) { toast('Upload failed: ' + (err.message || err), 'error'); });
      };
      reader.readAsDataURL(file);
    }

    function makeFileInput(accept) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept; inp.style.display = 'none';
      document.body.appendChild(inp);
      return inp;
    }

    // Logo edit
    var logoWrap = document.querySelector('.gh-biz-logo');
    if (logoWrap) {
      var logoInput = makeFileInput('image/*');
      var logoBtn = document.createElement('button');
      logoBtn.className = 'gh-biz-logo-edit-btn';
      logoBtn.title = 'Change logo';
      logoBtn.innerHTML = '<i class="fas fa-camera"></i><span>Edit</span>';
      logoWrap.appendChild(logoBtn);
      logoBtn.onclick = function(e) { e.stopPropagation(); logoInput.click(); };
      logoInput.onchange = function() {
        var file = logoInput.files && logoInput.files[0]; logoInput.value = '';
        doUpload(file, 'logoUrl', function(url) {
          var img = logoWrap.querySelector('img');
          if (img) {
            img.src = url;
            img.onerror = function() { this.style.display = 'none'; };
          } else {
            var ni = document.createElement('img');
            ni.src = url; ni.alt = ''; ni.loading = 'lazy';
            ni.style.cssText = 'width:100%;height:100%;object-fit:cover';
            logoWrap.insertBefore(ni, logoWrap.firstChild);
          }
          var actor = getActiveActor();
          if (actor && actor.type === 'business' && actor.businessId === b.id) {
            actor.logoUrl = url;
            try { localStorage.setItem('gh_active_actor', JSON.stringify(actor)); } catch(e2) {}
            window.dispatchEvent(new CustomEvent('GeoActorChanged', { detail: actor }));
          }
          if (window._geoSW && window._geoSW.onBusinessUpdated) window._geoSW.onBusinessUpdated(b.id, { logoUrl: url });
        });
      };
    }

    // Cover edit
    var coverWrap = document.querySelector('.gh-biz-cover');
    if (coverWrap) {
      var coverInput = makeFileInput('image/*');
      var coverBtn = document.createElement('button');
      coverBtn.className = 'gh-biz-cover-edit-btn';
      coverBtn.innerHTML = '<i class="fas fa-camera"></i> Edit Cover';
      coverWrap.appendChild(coverBtn);
      coverBtn.onclick = function(e) { e.stopPropagation(); coverInput.click(); };
      coverInput.onchange = function() {
        var file = coverInput.files && coverInput.files[0]; coverInput.value = '';
        doUpload(file, 'coverUrl', function(url) {
          var img = coverWrap.querySelector('img');
          if (img) {
            img.src = url;
            img.onerror = function() { this.style.display = 'none'; };
          } else {
            var ni = document.createElement('img');
            ni.src = url; ni.alt = ''; ni.loading = 'lazy';
            ni.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
            coverWrap.insertBefore(ni, coverWrap.firstChild);
          }
        });
      };
    }
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
              '<a class="gh-btn full ghost" href="business-suite.html?businessId='+encodeURIComponent(b.id)+'"><i class="fas fa-briefcase"></i> Business Suite</a>'+
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
      hydratePostAuthorAvatars(el);
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
    setupAudienceAccess(function(){ var list=$('#ghBusinessPosts'); if(list&&list._lastPosts){ var posts=list._lastPosts.filter(canSeePost); list.innerHTML=posts.length?posts.map(postCard).join(''):'<div class="gh-card gh-empty"><i class="fas fa-newspaper"></i><h3>No posts yet</h3><p>Business updates will appear here.</p></div>'; hydratePostAuthorAvatars(list); hydrateSharedPreviews(list); } });
    listenTargetPosts('business',b.id,function(posts){ var list=$('#ghBusinessPosts'); if(!list)return; list._lastPosts=posts||[]; posts=posts.filter(canSeePost); if(!posts.length){list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-newspaper"></i><h3>No posts yet</h3><p>Business page updates will appear here.</p></div>';return;} list.innerHTML=posts.map(postCard).join(''); bindPostInteractions(list); hydratePostAuthorAvatars(list); posts.forEach(function(p){hydrateReactionState(p.id);}); hydrateSharedPreviews(list); });
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
    if(!requireLogin()) return; var user=authUser(); var uid=user.uid; var uName=user.displayName||''; var uAvatar=user.photoURL||''; var id=businessId+'_'+uid; var ref=fs().doc(db(),'businessFollowers',id); var biz=fs().doc(db(),'businesses',businessId);
    var btn=document.querySelector('[data-follow-business="'+businessId+'"]');
    if(btn){ btn.disabled=true; btn.classList.add('is-loading'); }
    return fs().getDoc(ref).then(function(d){
      if(d.exists()){
        return fs().deleteDoc(ref)
          .then(function(){ return fs().updateDoc(biz,{followerCount:fs().increment(-1)}).catch(function(){}); })
          .then(function(){bizTrack(businessId,'unfollows');toast('Unfollowed');});
      }
      return fs().setDoc(ref,{businessId:businessId,userId:uid,createdAt:fs().serverTimestamp(),userName:uName,userAvatar:uAvatar})
        .then(function(){return fs().updateDoc(biz,{followerCount:fs().increment(1)}).catch(function(){});})
        .then(function(){
          bizTrack(businessId,'follows');toast('Following business');
          GS()&&GS().createActorNotification&&GS().createActorNotification('business',businessId,'page_follow',(uName||'Someone')+' followed your page','Your page has a new follower.','business.html?id='+encodeURIComponent(businessId),{followerId:uid,followerName:uName,followerAvatar:uAvatar,businessId:businessId},'page_follow_'+businessId+'_'+uid).catch(function(){});
        });
    }).catch(function(err){toast('Follow failed: '+(err.code||err.message),'error');})
      .finally(function(){ if(btn){ btn.disabled=false; btn.classList.remove('is-loading'); } updateBusinessFollowButton(businessId); });
  }

  function listenTargetPosts(type,id,cb){
    if(type==='business'){
      var sourceRows={target:{},business:{}}, settled={target:false,business:false};
      function emit(){
        if(!settled.target || !settled.business) return;
        var rowsById=Object.assign({},sourceRows.target,sourceRows.business);
        var arr=Object.keys(rowsById).map(function(k){ return rowsById[k]; })
          .filter(function(p){ return isPageFeedPost(p,id); });
        arr.sort(function(a,b){return ts(b.createdAt)-ts(a.createdAt);});
        cb(arr);
      }
      function readSnap(kind,snap){
        var next={};
        snap.forEach(function(d){ next[d.id]=Object.assign({id:d.id},d.data()); });
        sourceRows[kind]=next;
        settled[kind]=true;
        emit();
      }
      var unsubs=[];
      unsubs.push(fs().onSnapshot(fs().query(fs().collection(db(),'posts'), fs().where('targetId','==',id), fs().limit(50)), function(snap){ readSnap('target',snap); }, function(err){ console.warn('listenTargetPosts targetId',err.message); settled.target=true; emit(); }));
      unsubs.push(fs().onSnapshot(fs().query(fs().collection(db(),'posts'), fs().where('businessId','==',id), fs().limit(50)), function(snap){ readSnap('business',snap); }, function(err){ console.warn('listenTargetPosts businessId',err.message); settled.business=true; emit(); }));
      var allUnsub=function(){ unsubs.forEach(function(u){ try{u();}catch(e){} }); };
      state.pageUnsubs.push(allUnsub);
      return allUnsub;
    }
    var q=fs().query(fs().collection(db(),'posts'), fs().where('targetType','==',type), fs().where('targetId','==',id), fs().limit(50));
    var _u=fs().onSnapshot(q,function(snap){ var arr=[]; snap.forEach(function(d){arr.push(Object.assign({id:d.id},d.data()));}); arr.sort(function(a,b){return ts(b.createdAt)-ts(a.createdAt);}); cb(arr); },function(err){ console.warn('listenTargetPosts',err.message); cb([]); });
    state.pageUnsubs.push(_u);
    return _u;
  }

  // ── Group helper functions ────────────────────────────────────────────
  function grPrivacyIcon(privacy){ if(privacy==='private') return '<i class="fas fa-lock" title="Private" style="color:var(--gh-yellow)"></i>'; if(privacy==='secret') return '<i class="fas fa-eye-slash" title="Secret" style="color:var(--gh-red)"></i>'; return '<i class="fas fa-globe" title="Public" style="color:var(--gh-green)"></i>'; }
  function grRoleBadge(role){ if(role==='owner') return '<span class="gr-role-badge owner" title="Owner">&#128081;</span>'; if(role==='admin') return '<span class="gr-role-badge admin" title="Admin">&#11088;</span>'; if(role==='moderator') return '<span class="gr-role-badge mod" title="Moderator">&#128737;</span>'; return ''; }
  function grFormatBytes(bytes){ if(!bytes) return ''; if(bytes<1024) return bytes+'B'; if(bytes<1048576) return (bytes/1024).toFixed(1)+'KB'; return (bytes/1048576).toFixed(1)+'MB'; }
  function grTimeAgo(ts){ if(!ts) return ''; var ms=ts.toMillis?ts.toMillis():(ts.seconds?ts.seconds*1000:0); if(!ms) return ''; var d=Date.now()-ms; if(d<60000) return 'just now'; if(d<3600000) return Math.floor(d/60000)+'m ago'; if(d<86400000) return Math.floor(d/3600000)+'h ago'; return Math.floor(d/86400000)+'d ago'; }
  function grIsAdmin(g){ var role=state.currentGroupRole; var uid=authUser()&&authUser().uid; return role==='owner'||role==='admin'||(g&&(g.creatorId===uid||g.userId===uid||g.ownerId===uid)); }
  function grIsModerator(){ return grIsAdmin()||state.currentGroupRole==='moderator'; }
  function grIsMember(){ return !!state.currentGroupRole; }

  function renderGroups(){
    var params=new URLSearchParams(location.search);
    var id=params.get('id'); var inviteToken=params.get('invite');
    if(id) return renderGroupDetail(id);
    if(inviteToken) return renderGroupInvitePage(inviteToken);
    shell({ active:'groups', center:'<div class="gh-card"><div class="gh-section-title"><div><h1>Groups</h1><p class="gh-muted" style="margin:.25rem 0 0">Facebook-style communities with GeoHub design.</p></div><button class="gh-btn" id="ghOpenGroupCreate"><i class="fas fa-plus"></i>Create Group</button></div><input class="gh-input" id="ghGroupSearch" placeholder="Search groups…"><div style="height:12px"></div><div class="gh-pill-row"><button class="gh-pill active" data-group-tab="discover">Discover</button><button class="gh-pill" data-group-tab="mine">Your groups</button><button class="gh-pill" data-group-tab="requests">Requests</button></div></div><div id="ghGroupsList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>' });
    var groups=[], myGroups=[], requests={}; state.groupTab='discover';
    function paint(){ var q=($('#ghGroupSearch').value||'').toLowerCase(); var arr=state.groupTab==='mine'?myGroups:groups; if(state.groupTab==='discover') arr=arr.filter(function(g){return (g.privacy||'public')!=='secret';}); if(state.groupTab==='requests'){ var ids=Object.keys(requests||{}); arr=groups.filter(function(g){return ids.indexOf(g.id)>-1;}); } arr=arr.filter(function(g){return !q||JSON.stringify(g).toLowerCase().includes(q);}); var list=$('#ghGroupsList'); if(!arr.length){ list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-users"></i><h3>No groups yet</h3><p>Create a group and start posting with members.</p><button class="gh-btn" id="ghEmptyCreateGroup">Create group</button></div>'; return; } list.innerHTML='<div class="gh-grid">'+arr.map(groupCard).join('')+'</div>'; }
    $('#ghOpenGroupCreate').onclick=openGroupCreate;
    $('#ghCenter').addEventListener('click', function(e){ var t=e.target.closest('[data-group-tab]'); if(t){ state.groupTab=t.dataset.groupTab; $all('[data-group-tab]').forEach(function(x){x.classList.toggle('active',x===t);}); paint(); return; } if(e.target.closest('#ghEmptyCreateGroup')) openGroupCreate(); var j=e.target.closest('[data-join-group]'); if(j){ var gPrivacy=j.dataset.privacy; if(gPrivacy==='private'||gPrivacy==='secret') GS().requestJoinGroup(j.dataset.joinGroup,function(){paint();}); else GS().toggleGroupMember(j.dataset.joinGroup,j.dataset.name,function(){paint();}); } });
    $('#ghGroupSearch').oninput=paint;
    ready(function(){ GS().listenGroups(function(items){ groups=items; paint(); }); var u=authUser(); if(u){ GS().listenMyGroups(u.uid,function(items){ myGroups=items; paint(); }); GS().getMyJoinRequests(function(map){ requests=map; paint(); }); } });
    if(location.hash==='#create') setTimeout(openGroupCreate,350);
  }

  function groupCard(g){ var title=g.name||'Untitled group'; var cover=getItemCover(g); var privIcon=grPrivacyIcon(g.privacy||'public'); return '<article class="gh-card gh-item-card"><div class="gh-item-media">'+itemMediaHtml(cover,title,'fa-users')+'<span class="gh-type-badge">'+privIcon+' '+esc(g.privacy||'public')+'</span></div><div class="gh-item-body"><h3>'+esc(title)+'</h3><p>'+esc((g.description||'Group community on GeoHub').slice(0,100))+'</p><div class="gh-item-meta"><span class="gh-chip"><i class="fas fa-users"></i> '+Number(g.memberCount||0)+'</span><span class="gh-chip">'+esc(g.category||'general')+'</span></div><div class="gh-card-actions"><a class="gh-btn sm" href="groups.html?id='+encodeURIComponent(g.id)+'">View</a><button class="gh-btn sm ghost" data-join-group="'+esc(g.id)+'" data-name="'+esc(title)+'" data-privacy="'+esc(g.privacy||'public')+'">'+((g.privacy==='private'||g.privacy==='secret')?'Request':'Join')+'</button></div></div></article>'; }

  function openGroupCreate(){
    if(!requireLogin()) return;
    var body='<input class="gh-input" id="ghGroupName" placeholder="Group name *"><div style="height:8px"></div><textarea class="gh-textarea" id="ghGroupDesc" placeholder="What is this group about?" rows="3"></textarea><div style="height:8px"></div><select class="gh-select" id="ghGroupCat"><option value="general">General</option><option value="hiking">Hiking</option><option value="travel">Travel</option><option value="photography">Photography</option><option value="business">Business</option><option value="learning">Learning</option><option value="fitness">Fitness</option><option value="nightlife">Nightlife</option></select><div style="height:8px"></div><select class="gh-select" id="ghGroupPrivacy"><option value="public">Public — visible, posts open to all</option><option value="private">Private — visible, posts for members only</option><option value="secret">Secret — invite only, not in search</option></select><div style="height:8px"></div><div style="display:flex;gap:8px;align-items:center"><input class="gh-input" id="ghGroupCover" placeholder="Cover image URL (optional)" style="flex:1"><label for="ghGroupCoverFile" class="gh-btn ghost sm" id="ghGrCoverUploadLbl" style="cursor:pointer;white-space:nowrap;flex-shrink:0;padding:10px 13px"><i class="fas fa-upload"></i></label><input type="file" id="ghGroupCoverFile" accept="image/*" style="display:none"></div>';
    modal('Create Group', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitGroup">Create</button>', 'ghGroupCreateModal');
    (function(){
      var fi=$('#ghGroupCoverFile'); if(!fi) return;
      fi.addEventListener('change',function(){
        var file=fi.files&&fi.files[0]; if(!file) return;
        var lbl=$('#ghGrCoverUploadLbl'); if(lbl) lbl.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
        var cfg=(window.GeoConfig&&window.GeoConfig.CLOUDINARY)||{cloudName:'dw5dqk2w7',uploadPreset:'geohub_unsigned',rootFolder:'geohub'};
        var fd=new FormData(); fd.append('file',file); fd.append('upload_preset',cfg.uploadPreset); fd.append('folder',(cfg.rootFolder||'geohub')+'/groups');
        var xhr=new XMLHttpRequest(); xhr.open('POST','https://api.cloudinary.com/v1_1/'+cfg.cloudName+'/image/upload');
        xhr.onload=function(){ try{ var r=JSON.parse(xhr.responseText); var url=r.secure_url||null; var ci=$('#ghGroupCover'); if(url&&ci) ci.value=url; if(lbl) lbl.innerHTML=url?'<i class="fas fa-check"></i>':'<i class="fas fa-upload"></i>'; }catch(e){ if(lbl) lbl.innerHTML='<i class="fas fa-upload"></i>'; } fi.value=''; };
        xhr.onerror=function(){ if(lbl) lbl.innerHTML='<i class="fas fa-upload"></i>'; fi.value=''; };
        xhr.send(fd);
      });
    })();
    $('#ghSubmitGroup').onclick=function(){ GS().createGroup({ name:$('#ghGroupName').value, description:$('#ghGroupDesc').value, category:$('#ghGroupCat').value, privacy:$('#ghGroupPrivacy').value, coverUrl:$('#ghGroupCover').value.trim(), rules:[], joinQuestions:[], pinnedPostIds:[], postApproval:false }, function(id){ if(id) location.href='groups.html?id='+encodeURIComponent(id); }); };
  }

  function renderGroupInvitePage(token){
    shell({ active:'groups', center:'<div id="ghGroupInviteWrap"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading invite…</h3></div></div>' });
    ready(function(){ GS().getGroupByInviteToken(token, function(g){ var wrap=$('#ghGroupInviteWrap'); if(!g){ wrap.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-link-slash"></i><h3>Invite link invalid or expired</h3><a class="gh-btn" href="groups.html">Browse Groups</a></div>'; return; } var cover=getItemCover(g); wrap.innerHTML='<div class="gh-card" style="text-align:center;padding:32px 24px">'+(cover?'<img src="'+esc(cover)+'" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;margin-bottom:20px">':'<div style="font-size:3rem;margin-bottom:16px"><i class="fas fa-users" style="color:var(--gh-green)"></i></div>')+'<h2 style="margin-bottom:8px">You\'ve been invited to</h2><h1 style="margin-bottom:12px">'+esc(g.name||'Group')+'</h1><p class="gh-muted" style="margin-bottom:20px">'+esc(g.description||'')+'</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="gh-btn" id="ghInviteJoin"><i class="fas fa-user-plus"></i> Join Group</button><a class="gh-btn ghost" href="groups.html?id='+encodeURIComponent(g.id)+'">View Group</a></div></div>'; $('#ghInviteJoin').onclick=function(){ if(!requireLogin())return; GS().joinGroupViaInvite(g.id,g.name,function(ok){ if(ok) location.href='groups.html?id='+encodeURIComponent(g.id); }); }; }); });
  }

  function renderGroupDetail(id){
    shell({ active:'groups', center:'<div id="ghGroupDetail"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading group…</h3></div></div>' });
    state.currentGroupId=id; state.currentGroupRole=null; state.currentGroupData=null; state.currentGroupMuted=false; state.currentGroupJoinRequested=false; state.grTabUnsubs=[];
    ready(function(){
      GS().getGroupMemberRole(id, function(role){
        var prev=state.currentGroupRole; state.currentGroupRole=role;
        if(!role){ GS().checkJoinRequest(id,function(s){ state.currentGroupJoinRequested=(s==='pending'); if(state.currentGroupData) paintGroupDetail(state.currentGroupData); }); } else { state.currentGroupJoinRequested=false; }
        if(prev!==role && state.currentGroupData) paintGroupDetail(state.currentGroupData);
      });
      GS().getGroupMuteStatus(id, function(muted){ state.currentGroupMuted=muted; });
      var _u=fs().onSnapshot(fs().doc(db(),'groups',id), function(snap){ if(!snap.exists()){ $('#ghGroupDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-users-slash"></i><h3>Group not found</h3></div>'; return; } var g=Object.assign({id:id},snap.data()); state.currentGroupData=g; paintGroupDetail(g); }, function(err){ $('#ghGroupDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Failed</h3><p>'+esc(err.message)+'</p></div>'; });
      state.pageUnsubs.push(_u);
    });
  }

  function paintGroupDetail(g){
    var title=g.name||'Group'; var cover=getItemCover(g);
    var uid=authUser()&&authUser().uid; var privacy=g.privacy||'public';
    var isAdmin=grIsAdmin(g); var isMember=grIsMember(); var isMuted=state.currentGroupMuted;
    if(privacy==='secret'&&!isMember&&!isAdmin){ $('#ghGroupDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-eye-slash"></i><h3>Secret group</h3><p>You need an invite link to access this group.</p><a class="gh-btn" href="groups.html">Browse Groups</a></div>'; return; }
    var joinBtn=!isMember?(state.currentGroupJoinRequested?'<button class="gh-btn ghost" data-group-cancel-request><i class="fas fa-hourglass-half"></i> Request Pending</button>':((privacy==='private'||privacy==='secret')?'<button class="gh-btn" data-group-join-request><i class="fas fa-hand-paper"></i> Request to Join</button>':'<button class="gh-btn" data-group-join><i class="fas fa-user-plus"></i> Join</button>')):'<button class="gh-btn ghost" data-group-leave><i class="fas fa-sign-out-alt"></i> Leave</button>';
    var adminBtn=isAdmin?'<button class="gh-btn ghost sm" data-group-admin-panel><i class="fas fa-cog"></i> Manage</button>':'';
    var coverUpBtn=isAdmin?'<button class="gh-btn ghost sm gr-cover-upload-btn" data-group-cover-upload title="Change cover"><i class="fas fa-camera"></i></button>':'';
    $('#ghGroupDetail').innerHTML=
      '<section class="gh-card gr-group-hero" style="padding:0;overflow:hidden">'+
        '<div class="gh-page-cover gr-cover-wrap">'+(cover?img(cover,title):'<div class="gr-cover-placeholder"><i class="fas fa-users"></i></div>')+coverUpBtn+'</div>'+
        '<div class="gh-page-info">'+
          '<div class="gh-page-logo"><i class="fas fa-users"></i></div>'+
          '<div class="gh-page-title"><h1>'+esc(title)+'</h1><p>'+grPrivacyIcon(privacy)+' '+esc(privacy)+' group · '+Number(g.memberCount||0)+' members · '+esc(g.category||'general')+(g.city?' &nbsp;·&nbsp; <i class="fas fa-map-marker-alt" style="color:#3b82f6;font-size:.8em"></i> '+esc(g.city):'')+'</p></div>'+
          '<div class="gh-page-actions">'+joinBtn+' '+adminBtn+
            ' <button class="gh-btn ghost sm gr-mute-btn" data-group-mute title="'+(isMuted?'Unmute':'Mute')+'"><i class="fas fa-'+(isMuted?'bell-slash':'bell')+'"></i></button>'+
            ' <button class="gh-btn ghost sm" data-share-group><i class="fas fa-share"></i></button>'+
          '</div>'+
        '</div>'+
        '<div class="gh-tabbar">'+
          '<button class="gh-tab active" data-group-detail-tab="discussion">Discussion</button>'+
          '<button class="gh-tab" data-group-detail-tab="about">About</button>'+
          '<button class="gh-tab" data-group-detail-tab="members">Members</button>'+
          '<button class="gh-tab" data-group-detail-tab="events">Events</button>'+
          '<button class="gh-tab" data-group-detail-tab="files">Files</button>'+
          '<button class="gh-tab" data-group-detail-tab="chat">Chat</button>'+
          '<button class="gh-tab" data-group-detail-tab="media">Media</button>'+
          (isAdmin?'<button class="gh-tab" data-group-detail-tab="admin">Admin</button>':'')+
        '</div>'+
      '</section><div id="ghGroupTabContent"></div>';
    $('#ghGroupDetail').onclick=function(e){
      var tab=e.target.closest('[data-group-detail-tab]'); if(tab){ state.currentGroupTab=tab.dataset.groupDetailTab; $all('[data-group-detail-tab]').forEach(function(x){x.classList.toggle('active',x===tab);}); renderGroupTab(g); return; }
      if(e.target.closest('[data-group-join]')){ if(!requireLogin())return; GS().toggleGroupMember(g.id,title,function(){GS().getGroupMemberRole(g.id,function(r){state.currentGroupRole=r;}); paintGroupDetail(g);}); return; }
      if(e.target.closest('[data-group-join-request]')){ if(!requireLogin())return; openGroupJoinRequestModal(g); return; }
      if(e.target.closest('[data-group-cancel-request]')){ if(!requireLogin())return; GS().requestJoinGroup(g.id,function(){ state.currentGroupJoinRequested=false; paintGroupDetail(g); }); return; }
      if(e.target.closest('[data-group-leave]')){ if(!confirm('Leave "'+title+'"?'))return; GS().leaveGroup(g.id,function(ok){if(ok){state.currentGroupRole=null;paintGroupDetail(g);}}); return; }
      if(e.target.closest('[data-group-mute]')){ if(!requireLogin())return; var newMuted=!state.currentGroupMuted; GS().setGroupMute(g.id,newMuted,function(ok){if(ok){state.currentGroupMuted=newMuted;paintGroupDetail(g);}}); return; }
      if(e.target.closest('[data-group-admin-panel]')){ state.currentGroupTab='admin'; $all('[data-group-detail-tab]').forEach(function(x){x.classList.toggle('active',x.dataset.groupDetailTab==='admin');}); renderGroupTab(g); return; }
      if(e.target.closest('[data-group-cover-upload]')){ openGroupCoverUpload(g); return; }
      if(e.target.closest('[data-share-group]')){ var shareUrl=location.origin+'/groups.html?id='+encodeURIComponent(g.id); if(navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(function(){toast('Group link copied!');}); return; }
    };
    state.currentGroupTab=state.currentGroupTab||'discussion';
    renderGroupTab(g);
  }

  function openGroupCoverUpload(g){
    if(!requireLogin()) return;
    var body='<input type="file" class="gh-input" id="ghGroupCoverFile" accept="image/*" style="padding:8px"><div style="height:8px"></div><input class="gh-input" id="ghGroupCoverUrl" placeholder="Or paste image URL">';
    modal('Group Cover Photo', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitGroupCover">Save</button>', 'ghGroupCoverModal');
    $('#ghSubmitGroupCover').onclick=function(){ var file=$('#ghGroupCoverFile').files&&$('#ghGroupCoverFile').files[0]; var url=($('#ghGroupCoverUrl').value||'').trim(); if(file){ GS().uploadGroupCover(g.id,file,function(ok){var m=document.getElementById('ghGroupCoverModal');if(m)m.remove();}); } else if(url){ GS().updateGroupSettings(g.id,{coverUrl:url},function(){var m=document.getElementById('ghGroupCoverModal');if(m)m.remove();}); } else toast('Select a file or enter a URL','error'); };
  }

  function openGroupJoinRequestModal(g){
    if(!requireLogin()) return;
    var questions=g.joinQuestions||[]; var rules=g.rules||[];
    var rulesHtml=rules.length?'<div class="gr-rules-box"><h4><i class="fas fa-gavel"></i> Group Rules</h4>'+rules.map(function(r,i){return '<div class="gr-rule-item"><strong>'+(i+1)+'. '+esc(r.title||'')+'</strong><p>'+esc(r.description||'')+'</p></div>';}).join('')+'<label class="gr-rule-ack"><input type="checkbox" id="ghRulesAck"> I have read and agree to the group rules</label></div>':'';
    var questionsHtml=questions.length?'<div style="margin-top:12px"><h4><i class="fas fa-question-circle"></i> Membership Questions</h4>'+questions.map(function(q,i){return '<div style="margin-bottom:10px"><label class="gh-muted" style="font-size:.85rem;display:block;margin-bottom:4px">'+(i+1)+'. '+esc(q.question||q)+'</label><textarea class="gh-textarea" id="ghJoinQ'+i+'" rows="2" placeholder="Your answer…"></textarea></div>';}).join('')+'</div>':'';
    var body=(rulesHtml||questionsHtml)?rulesHtml+questionsHtml:'<p class="gh-muted">Your join request will be sent to the group admin for approval.</p>';
    modal('Request to Join '+esc(g.name||'Group'), body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitJoinRequest">Send Request</button>', 'ghJoinRequestModal');
    $('#ghSubmitJoinRequest').onclick=function(){ if(rules.length&&!($('#ghRulesAck')&&$('#ghRulesAck').checked)){toast('You must agree to the group rules','error');return;} var answers=questions.map(function(q,i){return {question:q.question||q,answer:($('#ghJoinQ'+i)||{}).value||''};}); GS().requestJoinGroupWithAnswers(g.id,answers,function(){var m=document.getElementById('ghJoinRequestModal');if(m)m.remove();toast('Request sent! Awaiting approval.');state.currentGroupJoinRequested=true;if(state.currentGroupData)paintGroupDetail(state.currentGroupData);}); };
  }

  function renderGroupTab(g){
    (state.grTabUnsubs||[]).forEach(function(u){try{u();}catch(e){}}); state.grTabUnsubs=[];
    var box=$('#ghGroupTabContent'); if(!box) return;
    var tab=state.currentGroupTab||'discussion';
    var isMember=grIsMember(); var isAdmin=grIsAdmin(g); var isMod=grIsModerator();
    if(tab==='about'){ renderGroupAboutTab(g,box,isAdmin); return; }
    if(tab==='members'){ renderGroupMembersTab(g,box,isAdmin); return; }
    if(tab==='events'){ renderGroupEventsTab(g,box,isAdmin); return; }
    if(tab==='files'){ renderGroupFilesTab(g,box,isAdmin,isMember); return; }
    if(tab==='chat'){ renderGroupChatTab(g,box,isMember); return; }
    if(tab==='media'){ renderGroupMediaTab(g,box); return; }
    if(tab==='admin'&&isAdmin){ renderGroupAdminTab(g,box); return; }
    // Discussion
    var canPost=isMember||(g.privacy==='public');
    var composerHtml=canPost?'<section class="gh-card gh-composer"><div class="gh-composer-top"><span class="gh-avatar"><i class="fas fa-users"></i></span><button class="gh-composer-fake" data-create-group-post>Post in '+esc(g.name||'group')+'…</button></div></section>':'<div class="gh-card gh-empty" style="padding:20px"><i class="fas fa-lock"></i><h3>Members only</h3><p>Join this group to post.</p></div>';
    box.innerHTML=composerHtml+'<div id="ghGroupPosts"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>';
    box.onclick=function(e){
      if(e.target.closest('[data-create-group-post]')) openGroupPostModal(g);
      var pinBtn=e.target.closest('[data-pin-post]'); if(pinBtn&&isAdmin) GS().pinGroupPost(g.id,pinBtn.dataset.pinPost,function(){});
      var unpinBtn=e.target.closest('[data-unpin-post]'); if(unpinBtn&&isAdmin) GS().unpinGroupPost(g.id,unpinBtn.dataset.unpinPost,function(){});
    };
    var _uDisc=listenTargetPosts('group', g.id, function(items){
      var list=$('#ghGroupPosts'); if(!list) return;
      if((g.privacy==='private'||g.privacy==='secret')&&!isMember&&!isAdmin){ list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-lock"></i><h3>Join to see posts</h3></div>'; return; }
      var pinnedIds=g.pinnedPostIds||[];
      var active=items.filter(function(p){return p.status!=='pending'&&p.status!=='declined';});
      var pinned=active.filter(function(p){return pinnedIds.indexOf(p.id)>-1;});
      var regular=active.filter(function(p){return pinnedIds.indexOf(p.id)===-1;});
      var all=pinned.concat(regular);
      if(!all.length){ list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-newspaper"></i><h3>No posts yet</h3><p>Start the discussion.</p></div>'; return; }
      list.innerHTML=all.map(function(p){ p.targetType='group'; p.targetId=g.id; var isPinned=pinnedIds.indexOf(p.id)>-1; var badge=isPinned?'<div class="gr-announce-badge">&#128226; Announcement</div>':''; var pinCtrl=isAdmin?(isPinned?'<button class="gr-pin-btn" data-unpin-post="'+esc(p.id)+'">Unpin</button>':'<button class="gr-pin-btn" data-pin-post="'+esc(p.id)+'">Pin</button>'):''; return badge+pinCtrl+postCard(p); }).join('');
      bindPostInteractions(list); all.forEach(function(p){hydrateReactionState(p.id);});
    });
    if(_uDisc) state.grTabUnsubs.push(_uDisc);
  }

  function renderGroupAboutTab(g,box,isAdmin){
    var rules=g.rules||[];
    var rulesHtml=rules.length?rules.map(function(r,i){return '<div class="gr-rule-item"><strong>'+(i+1)+'. '+esc(r.title||'')+'</strong><p>'+esc(r.description||'')+'</p></div>';}).join(''):'<p class="gh-muted">No rules set yet.</p>';
    var token=g.inviteToken; var enabled=g.inviteEnabled;
    var inviteUrl=token&&enabled?(location.origin+'/groups.html?invite='+token):'';
    var inviteSection=isAdmin?'<div class="gh-card"><div class="gh-section-title"><h2><i class="fas fa-link"></i> Invite Link</h2></div>'+(inviteUrl?'<div class="gr-invite-link-row"><input class="gh-input" value="'+esc(inviteUrl)+'" readonly id="ghInviteUrlInput"><button class="gh-btn sm" id="ghCopyInvite">Copy</button></div>':'<p class="gh-muted">No active invite link.</p>')+'<div style="display:flex;gap:8px;margin-top:10px"><button class="gh-btn sm" id="ghGenInvite"><i class="fas fa-rotate"></i> Generate New</button>'+(token&&enabled?'<button class="gh-btn sm ghost danger" id="ghDisableInvite">Disable</button>':'')+'</div></div>':'';
    box.innerHTML='<div style="display:grid;gap:14px"><div class="gh-card"><div class="gh-section-title"><h2>About</h2></div><div class="gh-about-list">'+aboutRow('fa-align-left',g.description||'No description')+aboutRow('fa-lock',g.privacy||'public')+aboutRow('fa-tag',g.category||'general')+aboutRow('fa-users',Number(g.memberCount||0)+' members')+'</div></div><div class="gh-card"><div class="gh-section-title"><h2><i class="fas fa-gavel"></i> Group Rules</h2>'+(isAdmin?'<button class="gh-btn sm ghost" id="ghEditRules">Edit</button>':'')+'</div><div class="gr-rules-list">'+rulesHtml+'</div></div>'+inviteSection+'</div>';
    if(isAdmin){
      var er=$('#ghEditRules'); if(er) er.onclick=function(){openGroupRulesEditor(g);};
      var gi=$('#ghGenInvite'); if(gi) gi.onclick=function(){GS().generateGroupInviteToken(g.id,function(){});};
      var di=$('#ghDisableInvite'); if(di) di.onclick=function(){GS().disableGroupInviteToken(g.id,function(){});};
      var ci=$('#ghCopyInvite'); if(ci) ci.onclick=function(){var inp=$('#ghInviteUrlInput');if(inp&&navigator.clipboard)navigator.clipboard.writeText(inp.value).then(function(){toast('Invite link copied!');});};
    }
  }

  function openGroupRulesEditor(g){
    var rules=(g.rules||[]).slice();
    function bHtml(){ return rules.map(function(r,i){return '<div class="gr-rule-editor-row"><input class="gh-input" placeholder="Rule title" value="'+esc(r.title||'')+'" data-rule-title="'+i+'"><div style="height:6px"></div><textarea class="gh-textarea" placeholder="Description (optional)" rows="2" data-rule-desc="'+i+'">'+esc(r.description||'')+'</textarea><button class="gh-btn sm ghost danger" style="margin-top:6px" data-delete-rule="'+i+'"><i class="fas fa-trash"></i> Remove</button><hr style="border-color:var(--gh-border);margin:12px 0"></div>';}).join('')+'<button class="gh-btn sm ghost" id="ghAddRule"><i class="fas fa-plus"></i> Add Rule</button>'; }
    var body='<div id="ghRulesEditorBody">'+bHtml()+'</div>';
    modal('Edit Group Rules', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSaveRules">Save Rules</button>', 'ghGroupRulesModal');
    function rebind(){ var b=$('#ghRulesEditorBody'); if(!b)return; var a=$('#ghAddRule'); if(a)a.onclick=function(){rules.push({id:'r'+Date.now(),title:'',description:'',order:rules.length});b.innerHTML=bHtml();rebind();}; b.querySelectorAll('[data-delete-rule]').forEach(function(btn){btn.onclick=function(){rules.splice(Number(btn.dataset.deleteRule),1);b.innerHTML=bHtml();rebind();};}); } rebind();
    $('#ghSaveRules').onclick=function(){ var b=$('#ghRulesEditorBody'); rules=Array.from(b.querySelectorAll('.gr-rule-editor-row')).map(function(row,i){return {id:'r'+i,title:(row.querySelector('[data-rule-title]')||{}).value||'',description:(row.querySelector('[data-rule-desc]')||{}).value||'',order:i};}); GS().updateGroupRules(g.id,rules,function(){var m=document.getElementById('ghGroupRulesModal');if(m)m.remove();}); };
  }

  function renderGroupMembersTab(g,box,isAdmin){
    box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>Members <span class="gh-chip">'+Number(g.memberCount||0)+'</span></h2></div><input class="gh-input" id="ghMemberSearch" placeholder="Search members…" style="margin-bottom:12px"><div id="ghGroupMembersList"><div class="gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>';
    var allMembers=[]; var myUid=authUser()&&authUser().uid;
    function paintMembers(){ var q=($('#ghMemberSearch').value||'').toLowerCase(); var list=$('#ghGroupMembersList'); if(!list)return; var filtered=allMembers.filter(function(m){var u=m.profile||{};var name=u.fullName||u.displayName||u.name||m.userName||'';return !q||name.toLowerCase().includes(q);}); if(!filtered.length){list.innerHTML='<div class="gh-empty" style="min-height:80px"><i class="fas fa-users"></i><h3>No members found</h3></div>';return;} list.innerHTML=filtered.map(function(m){var u=m.profile||{};var name=u.fullName||u.displayName||u.name||m.userName||'GeoHub User';var avatar=u.avatar||u.photoURL||'';var muid=u.uid||u.id||m.userId||m.uid||'';var role=m.role||'member';var isSelf=muid===myUid;var adminControls=isAdmin&&!isSelf?'<div class="gr-member-controls"><select class="gh-select sm gr-role-select" data-member-role-uid="'+esc(muid)+'">'+['owner','admin','moderator','member'].map(function(r){return '<option value="'+r+'"'+(r===role?' selected':'')+'>'+r+'</option>';}).join('')+'</select><button class="gh-btn sm ghost danger" data-remove-member="'+esc(muid)+'">Remove</button><button class="gh-btn sm ghost danger" data-ban-member="'+esc(muid)+'" data-ban-name="'+esc(name)+'">Ban</button></div>':'';return '<div class="gh-friend-card gr-member-row"><a href="'+profileLink(muid)+'" style="text-decoration:none;display:flex;gap:10px;align-items:center;min-width:0"><span class="gh-avatar">'+(avatar?img(avatar,name):esc(initials(name)))+'</span><div style="min-width:0"><strong>'+esc(name)+'</strong><span class="gr-role-label">'+grRoleBadge(role)+' '+esc(role)+'</span></div></a>'+adminControls+'</div>';}).join('');
    if(isAdmin){list.querySelectorAll('[data-remove-member]').forEach(function(btn){btn.onclick=function(){if(!confirm('Remove this member?'))return;GS().removeGroupMember(g.id,btn.dataset.removeMember,function(){});};});list.querySelectorAll('[data-ban-member]').forEach(function(btn){btn.onclick=function(){openBanMemberModal(g,btn.dataset.banMember,btn.dataset.banName);};});list.querySelectorAll('[data-member-role-uid]').forEach(function(sel){sel.onchange=function(){GS().setGroupMemberRole(g.id,sel.dataset.memberRoleUid,sel.value,function(){});};});} }
    var ms=$('#ghMemberSearch'); if(ms)ms.oninput=paintMembers;
    var _um=GS().listenGroupMembers(g.id,function(items){allMembers=items;paintMembers();});
    if(_um){state.pageUnsubs.push(_um);state.grTabUnsubs.push(_um);}
  }

  function openBanMemberModal(g,targetUid,targetName){
    var body='<p>Ban <strong>'+esc(targetName||'member')+'</strong> from '+esc(g.name||'group')+'?</p><div style="height:8px"></div><select class="gh-select" id="ghBanDuration"><option value="7">7 days</option><option value="30">30 days</option><option value="0">Permanent</option></select><div style="height:8px"></div><input class="gh-input" id="ghBanReason" placeholder="Reason (optional)">';
    modal('Ban Member',body,'<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn danger" id="ghConfirmBan">Ban</button>','ghBanModal');
    $('#ghConfirmBan').onclick=function(){GS().banGroupMember(g.id,targetUid,($('#ghBanReason').value||'').trim(),Number($('#ghBanDuration').value||7),function(){var m=document.getElementById('ghBanModal');if(m)m.remove();});};
  }

  function renderGroupEventsTab(g,box,isAdmin){
    box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>Events</h2>'+(isAdmin?'<button class="gh-btn sm" id="ghCreateGroupEvent"><i class="fas fa-plus"></i> Create Event</button>':'')+'</div><div id="ghGroupEventsList"><div class="gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>';
    if(isAdmin){var cb=$('#ghCreateGroupEvent');if(cb)cb.onclick=function(){openGroupEventModal(g);};}
    var _u=GS().listenGroupEvents(g.id,function(items){var list=$('#ghGroupEventsList');if(!list)return;if(!items.length){list.innerHTML='<div class="gh-empty" style="min-height:80px"><i class="fas fa-calendar"></i><h3>No events yet</h3></div>';return;}list.innerHTML=items.map(function(ev){var dateStr=ev.date?new Date(ev.date).toLocaleDateString():'TBD';return '<div class="gr-event-card">'+(ev.coverUrl?'<img src="'+esc(ev.coverUrl)+'" class="gr-event-cover" alt="">':'')+'<div class="gr-event-body"><h3>'+esc(ev.name||'Event')+'</h3><div class="gr-event-meta"><span><i class="fas fa-calendar"></i> '+esc(dateStr)+'</span>'+(ev.location?'<span><i class="fas fa-map-marker-alt"></i> '+esc(ev.location)+'</span>':'')+'</div><p class="gh-muted">'+esc((ev.description||'').slice(0,150))+'</p><div class="gr-event-actions"><button class="gh-btn sm" data-rsvp-event="'+esc(ev.id)+'" data-rsvp-status="going">Going</button><button class="gh-btn sm ghost" data-rsvp-event="'+esc(ev.id)+'" data-rsvp-status="interested">Interested</button></div></div></div>';}).join('');list.querySelectorAll('[data-rsvp-event]').forEach(function(btn){btn.onclick=function(){if(!requireLogin())return;GS().rsvpGroupEvent(g.id,btn.dataset.rsvpEvent,btn.dataset.rsvpStatus,function(){});};});});
    state.pageUnsubs.push(_u); state.grTabUnsubs.push(_u);
  }

  function openGroupEventModal(g){
    var body='<input class="gh-input" id="ghEventName" placeholder="Event name *"><div style="height:8px"></div><input class="gh-input" type="datetime-local" id="ghEventDate"><div style="height:8px"></div><input class="gh-input" id="ghEventLocation" placeholder="Location"><div style="height:8px"></div><textarea class="gh-textarea" id="ghEventDesc" placeholder="Description" rows="3"></textarea><div style="height:8px"></div><input class="gh-input" id="ghEventCover" placeholder="Cover image URL (optional)">';
    modal('Create Group Event',body,'<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitGroupEvent">Create</button>','ghGroupEventModal');
    $('#ghSubmitGroupEvent').onclick=function(){GS().createGroupEvent(g.id,{name:$('#ghEventName').value,date:$('#ghEventDate').value,location:$('#ghEventLocation').value,description:$('#ghEventDesc').value,coverUrl:$('#ghEventCover').value.trim()},function(id){if(id){var m=document.getElementById('ghGroupEventModal');if(m)m.remove();}});};
  }

  function renderGroupFilesTab(g,box,isAdmin,isMember){
    box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>Files</h2>'+(isMember?'<button class="gh-btn sm" id="ghUploadGroupFile"><i class="fas fa-upload"></i> Upload</button>':'')+'</div><div id="ghGroupFilesList"><div class="gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>';
    if(isMember){var ub=$('#ghUploadGroupFile');if(ub)ub.onclick=function(){var inp=document.createElement('input');inp.type='file';inp.onchange=function(){var file=inp.files&&inp.files[0];if(!file)return;GS().uploadGroupFile(g.id,file,function(){});};inp.click();};}
    var myUid=authUser()&&authUser().uid;
    var _u=GS().listenGroupFiles(g.id,function(items){var list=$('#ghGroupFilesList');if(!list)return;if(!items.length){list.innerHTML='<div class="gh-empty" style="min-height:80px"><i class="fas fa-folder-open"></i><h3>No files yet</h3></div>';return;}list.innerHTML=items.map(function(f){var canDelete=isAdmin||(f.uploaderId===myUid);return '<div class="gr-file-card"><div class="gr-file-icon"><i class="fas fa-file'+(f.type&&f.type.startsWith('image')?'-image':(f.type&&f.type.includes('pdf')?'-pdf':''))+'"></i></div><div class="gr-file-body"><strong>'+esc(f.name||'File')+'</strong><span class="gh-muted" style="font-size:.8rem">'+esc(grFormatBytes(f.size))+(f.uploaderName?' · '+esc(f.uploaderName):'')+' · '+grTimeAgo(f.createdAt)+'</span></div><div class="gr-file-actions"><a class="gh-btn sm" href="'+esc(f.url||'#')+'" target="_blank" rel="noopener"><i class="fas fa-download"></i></a>'+(canDelete?'<button class="gh-btn sm ghost danger" data-delete-file="'+esc(f.id)+'"><i class="fas fa-trash"></i></button>':'')+'</div></div>';}).join('');list.querySelectorAll('[data-delete-file]').forEach(function(btn){btn.onclick=function(){if(!confirm('Delete this file?'))return;GS().deleteGroupFile(g.id,btn.dataset.deleteFile,function(){});};});});
    state.pageUnsubs.push(_u); state.grTabUnsubs.push(_u);
  }

  function renderGroupChatTab(g,box,isMember){
    var canChat=isMember||(g.privacy==='public');
    box.innerHTML='<div class="gh-card gr-chat-wrap"><div class="gh-section-title"><h2><i class="fas fa-comments"></i> Group Chat</h2></div><div class="gr-chat-messages" id="ghChatMessages"><div class="gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+(canChat?'<div class="gr-chat-input-row"><input class="gh-input" id="ghChatInput" placeholder="Type a message…"><button class="gh-btn" id="ghChatSend"><i class="fas fa-paper-plane"></i></button></div>':'<p class="gh-muted" style="text-align:center;padding:12px">Join this group to chat.</p>')+'</div>';
    var myUid=authUser()&&authUser().uid;
    var _u=GS().listenGroupChat(g.id,function(messages){var chatBox=$('#ghChatMessages');if(!chatBox)return;if(!messages.length){chatBox.innerHTML='<div class="gh-empty" style="min-height:80px"><i class="fas fa-comment-slash"></i><h3>No messages yet</h3><p>Say hello!</p></div>';return;}chatBox.innerHTML=messages.map(function(m){var isMine=m.senderId===myUid;return '<div class="gr-chat-msg'+(isMine?' mine':'')+'">'+ (!isMine?'<span class="gh-avatar sm">'+(m.senderAvatar?img(m.senderAvatar,m.senderName):esc(initials(m.senderName||'?')))+'</span>':'')+'<div class="gr-chat-bubble">'+(!isMine?'<strong class="gr-chat-name">'+esc(m.senderName||'User')+'</strong>':'')+'<p>'+esc(m.text||'')+'</p><span class="gr-chat-time">'+grTimeAgo(m.createdAt)+'</span></div>'+(isMine||grIsModerator()?'<button class="gr-chat-del" data-del-msg="'+esc(m.id)+'" title="Delete"><i class="fas fa-times"></i></button>':'')+'</div>';}).join('');chatBox.scrollTop=chatBox.scrollHeight;chatBox.querySelectorAll('[data-del-msg]').forEach(function(btn){btn.onclick=function(){GS().deleteGroupChatMessage(g.id,btn.dataset.delMsg,function(){});};});});
    state.pageUnsubs.push(_u); state.grTabUnsubs.push(_u);
    if(canChat){var input=$('#ghChatInput');var sendBtn=$('#ghChatSend');function doSend(){if(!requireLogin())return;var val=(input.value||'').trim();if(!val)return;GS().sendGroupChatMessage(g.id,val,function(){});input.value='';}if(sendBtn)sendBtn.onclick=doSend;if(input)input.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}};}
  }

  function renderGroupMediaTab(g,box){
    box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>Media</h2></div><div id="ghGroupMediaGrid"><div class="gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>';
    var _uMedia=listenTargetPosts('group',g.id,function(items){var media=items.filter(function(p){return p.imageUrl||p.mediaUrl||p.photoUrl;});var grid=$('#ghGroupMediaGrid');if(!grid)return;if(!media.length){grid.innerHTML='<div class="gh-empty" style="min-height:80px"><i class="fas fa-images"></i><h3>No media yet</h3></div>';return;}grid.innerHTML='<div class="gh-grid">'+media.map(function(p){var url=p.imageUrl||p.mediaUrl||p.photoUrl;return '<a class="gh-card" href="feed.html#post-'+esc(p.id)+'" style="padding:0;overflow:hidden"><img src="'+esc(url)+'" alt="media" loading="lazy" decoding="async" style="width:100%;height:180px;object-fit:cover"><div style="padding:10px;font-size:.85rem;color:var(--gh-muted)">'+esc((p.text||'').slice(0,80))+'</div></a>';}).join('')+'</div>';});
    if(_uMedia) state.grTabUnsubs.push(_uMedia);
  }

  function renderGroupAdminTab(g,box){
    var isAdmin=grIsAdmin(g); if(!isAdmin){box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-lock"></i><h3>Admin only</h3></div>';return;}
    box.innerHTML='<div style="display:grid;gap:14px">'+
      '<div class="gh-card"><div class="gh-section-title"><h2><i class="fas fa-cog"></i> Settings</h2></div><div class="gr-settings-form"><label class="gr-setting-row"><span>Post Approval Required</span><label class="gr-toggle"><input type="checkbox" id="ghPostApproval"'+(g.postApproval?' checked':'')+'><span></span></label></label><div style="height:8px"></div><label class="gh-muted" style="font-size:.85rem;display:block;margin-bottom:4px">Privacy</label><select class="gh-select" id="ghGroupPrivacySetting"><option value="public"'+(g.privacy==='public'?' selected':'')+'>Public</option><option value="private"'+(g.privacy==='private'?' selected':'')+'>Private</option><option value="secret"'+(g.privacy==='secret'?' selected':'')+'>Secret</option></select><div style="height:8px"></div><button class="gh-btn" id="ghSaveGroupSettings">Save</button></div></div>'+
      '<div class="gh-card"><div class="gh-section-title"><h2><i class="fas fa-question-circle"></i> Membership Questions</h2><button class="gh-btn sm ghost" id="ghEditJoinQuestions">Edit</button></div><div class="gr-questions-preview">'+((g.joinQuestions||[]).length?(g.joinQuestions||[]).map(function(q,i){return '<p><strong>'+(i+1)+'.</strong> '+esc(q.question||q)+'</p>';}).join(''):'<p class="gh-muted">No questions set.</p>')+'</div></div>'+
      (g.postApproval?'<div class="gh-card"><div class="gh-section-title"><h2><i class="fas fa-hourglass-half"></i> Pending Posts</h2></div><div id="ghPendingPostsQueue"><div class="gh-empty" style="min-height:60px"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>':'')+
      '<div class="gh-card"><div class="gh-section-title"><h2><i class="fas fa-user-clock"></i> Join Requests</h2></div><div id="ghJoinRequestsList"><div class="gh-empty" style="min-height:60px"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>'+
      '<div class="gh-card"><div class="gh-section-title"><h2><i class="fas fa-chart-bar"></i> Insights</h2></div><div id="ghGroupInsights"><div class="gh-empty" style="min-height:60px"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>'+
    '</div>';
    var ssBtn=$('#ghSaveGroupSettings'); if(ssBtn)ssBtn.onclick=function(){GS().updateGroupSettings(g.id,{postApproval:$('#ghPostApproval').checked,privacy:$('#ghGroupPrivacySetting').value},function(){});};
    var ejBtn=$('#ghEditJoinQuestions'); if(ejBtn)ejBtn.onclick=function(){openGroupJoinQuestionsEditor(g);};
    if(g.postApproval){var pu=GS().listenPendingGroupPosts(g.id,function(pending){var q=$('#ghPendingPostsQueue');if(!q)return;if(!pending.length){q.innerHTML='<p class="gh-muted" style="padding:8px 0">No pending posts.</p>';return;}q.innerHTML=pending.map(function(p){return '<div class="gr-pending-post-row"><div class="gr-pending-post-text">'+esc((p.text||'').slice(0,120))+'</div><div style="font-size:.8rem;color:var(--gh-muted)">by '+esc(p.authorName||'User')+' · '+grTimeAgo(p.createdAt)+'</div><div class="gr-pending-actions"><button class="gh-btn sm" data-approve-post="'+esc(p.id)+'">Approve</button><button class="gh-btn sm ghost danger" data-decline-post="'+esc(p.id)+'">Decline</button></div></div>';}).join('');q.querySelectorAll('[data-approve-post]').forEach(function(btn){btn.onclick=function(){GS().approveGroupPost(btn.dataset.approvePost,function(){});};});q.querySelectorAll('[data-decline-post]').forEach(function(btn){btn.onclick=function(){GS().declineGroupPost(btn.dataset.declinePost,function(){});};});});state.pageUnsubs.push(pu);state.grTabUnsubs.push(pu);}
    var ju=GS().listenGroupJoinRequests(g.id,function(requests){var jrl=$('#ghJoinRequestsList');if(!jrl)return;if(!requests.length){jrl.innerHTML='<p class="gh-muted" style="padding:8px 0">No pending requests.</p>';return;}jrl.innerHTML=requests.map(function(req){return '<div class="gr-join-request-row"><div style="display:flex;align-items:center;gap:10px"><span class="gh-avatar sm">'+(req.userPhoto?img(req.userPhoto,req.userName):esc(initials(req.userName||'U')))+'</span><div><strong>'+esc(req.userName||'User')+'</strong>'+(req.answers&&req.answers.length?'<div class="gr-req-answers">'+req.answers.map(function(a){return '<p><em>'+esc(a.question||'')+'</em><br>'+esc(a.answer||'—')+'</p>';}).join('')+'</div>':'')+'</div></div><div class="gr-join-request-actions"><button class="gh-btn sm" data-approve-req="'+esc(req.id)+'" data-approve-uid="'+esc(req.userId)+'">Approve</button><button class="gh-btn sm ghost danger" data-decline-req="'+esc(req.id)+'">Decline</button></div></div>';}).join('');jrl.querySelectorAll('[data-approve-req]').forEach(function(btn){btn.onclick=function(){GS().approveJoinRequest(g.id,btn.dataset.approveReq,btn.dataset.approveUid,function(){});};});jrl.querySelectorAll('[data-decline-req]').forEach(function(btn){btn.onclick=function(){GS().declineJoinRequest(btn.dataset.declineReq,function(){});};});});
    state.pageUnsubs.push(ju);state.grTabUnsubs.push(ju);
    GS().getGroupInsights(g.id,function(data){var ins=$('#ghGroupInsights');if(!ins)return;if(!data){ins.innerHTML='<p class="gh-muted">Could not load insights.</p>';return;}var contribs=data.topContributors||[];ins.innerHTML='<div class="gr-insights-grid"><div class="gr-insight-card"><div class="gr-insight-val">'+Number(data.memberCount||0)+'</div><div class="gr-insight-label">Total Members</div></div><div class="gr-insight-card"><div class="gr-insight-val">'+Number(data.postCount30||0)+'</div><div class="gr-insight-label">Posts (30 days)</div></div></div>'+(contribs.length?'<div style="margin-top:14px"><h4 style="margin-bottom:8px;font-size:.9rem">Top Contributors</h4><div id="ghContribRows">'+contribs.map(function(c,i){return '<div class="gr-contributor-row"><span>#'+(i+1)+'</span><span class="gh-chip sm">'+c.count+' post'+(c.count!==1?'s':'')+'</span></div>';}).join('')+'</div></div>':'');if(!contribs.length||!fs||!db)return;Promise.all(contribs.map(function(c){return fs().getDoc(fs().doc(db(),'users',c.uid)).then(function(d){var ud=d.exists()?d.data():{};return {uid:c.uid,count:c.count,name:ud.fullName||ud.displayName||ud.name||''};}).catch(function(){return {uid:c.uid,count:c.count,name:''};});})).then(function(resolved){var rows=$('#ghContribRows');if(!rows)return;rows.innerHTML=resolved.map(function(c,i){var n=c.name||(c.uid.slice(0,8)+'…');return '<div class="gr-contributor-row"><span style="display:flex;align-items:center;gap:8px">#'+(i+1)+' <strong style="color:var(--gh-text)">'+esc(n)+'</strong></span><span class="gh-chip sm">'+c.count+' post'+(c.count!==1?'s':'')+'</span></div>';}).join('');}).catch(function(){});});
  }

  function openGroupJoinQuestionsEditor(g){
    var questions=(g.joinQuestions||[]).slice().map(function(q){return typeof q==='string'?{question:q}:q;});
    function bQHtml(){return (questions.length?questions.map(function(q,i){return '<div class="gr-q-editor-row"><input class="gh-input" placeholder="Question '+(i+1)+'" value="'+esc(q.question||'')+'" data-q-idx="'+i+'"><button class="gh-btn sm ghost danger" style="margin-left:8px" data-del-q="'+i+'"><i class="fas fa-trash"></i></button><hr style="border-color:var(--gh-border);margin:8px 0"></div>';}).join(''):'<p class="gh-muted">No questions.</p>')+'<button class="gh-btn sm ghost" id="ghAddQ" style="margin-top:6px"><i class="fas fa-plus"></i> Add Question</button>';}
    var body='<div id="ghQEditorBody">'+bQHtml()+'</div>';
    modal('Membership Questions (max 3)',body,'<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSaveJoinQ">Save</button>','ghJoinQModal');
    function rebindQ(){var b=$('#ghQEditorBody');if(!b)return;var a=$('#ghAddQ');if(a)a.onclick=function(){if(questions.length>=3){toast('Maximum 3 questions','error');return;}questions.push({question:''});b.innerHTML=bQHtml();rebindQ();};b.querySelectorAll('[data-del-q]').forEach(function(btn){btn.onclick=function(){questions.splice(Number(btn.dataset.delQ),1);b.innerHTML=bQHtml();rebindQ();};});} rebindQ();
    $('#ghSaveJoinQ').onclick=function(){var b=$('#ghQEditorBody');var saved=Array.from(b.querySelectorAll('[data-q-idx]')).map(function(inp){return {question:inp.value.trim()};}).filter(function(q){return q.question;});GS().updateGroupJoinQuestions(g.id,saved,function(){var m=document.getElementById('ghJoinQModal');if(m)m.remove();});};
  }

  function openGroupPostModal(g){
    if(!requireLogin()) return;
    var me=currentUserInfo();
    var actorAvHtml=me.avatar?'<img src="'+esc(me.avatar)+'" alt="" onerror="this.style.display=\'none\'">':esc(initials(me.name||''));

    var body=
      '<div class="gh-cmp-actor-row">'+
        '<span class="gh-avatar gh-cmp-actor-av">'+actorAvHtml+'</span>'+
        '<div class="gh-cmp-actor-info">'+
          '<strong>'+esc(me.name||'You')+'</strong>'+
          '<span class="gh-cmp-destination"><i class="fas fa-users"></i> Posting in '+esc(g.name||'group')+'</span>'+
        '</div>'+
      '</div>'+
      '<textarea class="gh-textarea gh-cmp-textarea" id="ghGroupPostText" placeholder="Write something to the group…" rows="4"></textarea>'+
      '<div id="ghGroupMediaGrid" class="gh-cmp-media-grid"></div>'+
      '<input type="file" id="ghGroupPostFile" accept="image/*" style="display:none">'+
      '<div class="gh-cmp-toolbar">'+
        '<button class="gh-cmp-tool" id="ghGroupPickPhoto" type="button" title="Add photo"><i class="fas fa-image"></i><span>Photo</span></button>'+
      '</div>'+
      '<div class="gh-upload-progress" id="ghGroupUploadBar" style="display:none"><div class="gh-upload-track"><div class="gh-upload-bar" id="ghGroupUploadFill"></div></div><span id="ghGroupUploadPct">0%</span></div>';

    var m=modal('Post in '+(g.name||'group'), body,
      '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitGroupPost" disabled><i class="fas fa-paper-plane"></i> Post</button>',
      'ghGroupPostModal');

    var pickedFile=null;
    var ta=$('#ghGroupPostText');
    if(ta) ta.focus();

    function updateGroupSubmit(){
      var btn=$('#ghSubmitGroupPost'); if(!btn) return;
      btn.disabled=!(ta&&ta.value.trim()) && !pickedFile;
    }
    if(ta) ta.addEventListener('input', updateGroupSubmit);

    // Dirty-state close confirmation
    m.addEventListener('click', function(e){
      if(e.target===m || e.target.closest('[data-close-modal]')){
        if(((ta&&ta.value.trim())||pickedFile) && !confirm('Discard your post?')){
          e.stopPropagation(); e.preventDefault();
        }
      }
    }, true);

    // File picker + preview
    var fileInput=$('#ghGroupPostFile');
    if(fileInput) fileInput.addEventListener('change', function(){
      pickedFile=fileInput.files&&fileInput.files[0]||null;
      fileInput.value='';
      var grid=$('#ghGroupMediaGrid'); if(!grid) { updateGroupSubmit(); return; }
      if(!pickedFile){ grid.innerHTML=''; updateGroupSubmit(); return; }
      var reader=new FileReader();
      reader.onload=function(ev){
        grid.innerHTML='<div class="gh-cmp-thumb">'+
          '<img src="'+esc(ev.target.result)+'" alt="">'+
          '<button type="button" class="gh-cmp-thumb-rm" id="ghGroupRmPhoto" title="Remove"><i class="fas fa-times"></i></button>'+
        '</div>';
        var rm=$('#ghGroupRmPhoto');
        if(rm) rm.onclick=function(){ pickedFile=null; grid.innerHTML=''; updateGroupSubmit(); };
      };
      reader.readAsDataURL(pickedFile);
      updateGroupSubmit();
    });
    var pickBtn=$('#ghGroupPickPhoto');
    if(pickBtn) pickBtn.onclick=function(){ if(fileInput) fileInput.click(); };

    $('#ghSubmitGroupPost').onclick=function(){
      var submitBtn=$('#ghSubmitGroupPost'); if(!submitBtn||submitBtn.disabled) return;
      var text=ta?ta.value.trim():'';
      if(!text&&!pickedFile) return toast('Write something or add a photo','error');
      var postStatus=g.postApproval?'pending':'active';
      submitBtn.disabled=true;
      var bar=$('#ghGroupUploadBar'), fill=$('#ghGroupUploadFill'), pctEl=$('#ghGroupUploadPct');

      if(pickedFile){
        if(bar) bar.style.display='flex';
        submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Uploading…';
        prepareMedia(pickedFile,'group_posts',function(pct){
          if(fill) fill.style.width=pct+'%';
          if(pctEl) pctEl.textContent=pct+'%';
        }).then(function(url){
          if(bar) bar.style.display='none';
          submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Posting…';
          GS().createPost(text,url||'',function(){ var modal=document.getElementById('ghGroupPostModal'); if(modal) modal.remove(); if(postStatus==='pending') toast('Post submitted for approval.'); },{targetType:'group',targetId:g.id,groupId:g.id,status:postStatus});
        }).catch(function(){
          if(bar) bar.style.display='none';
          toast('Image upload failed','error');
          submitBtn.disabled=false;
          submitBtn.innerHTML='<i class="fas fa-paper-plane"></i> Post';
        });
      } else {
        submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Posting…';
        GS().createPost(text,'',function(){ var modal=document.getElementById('ghGroupPostModal'); if(modal) modal.remove(); if(postStatus==='pending') toast('Post submitted for approval.'); },{targetType:'group',targetId:g.id,groupId:g.id,status:postStatus});
      }
    };
  }

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
      var clean=(textVal||'').trim();
      var isPoll = extra.type === 'poll' && extra.poll && extra.poll.question;
      if(!clean && !mediaUrl && !extra.sharedPostId && !isPoll) return toast('Write something first','error');
      if(isPoll && !clean) clean = String(extra.poll.question || '').trim();
      var me=currentUserInfo();
      var payload={
        text:clean,
        mediaUrl:mediaUrl||null,
        imageUrl:mediaUrl||null,
        mediaUrls:(extra.mediaUrls&&extra.mediaUrls.length)?extra.mediaUrls:(mediaUrl?[mediaUrl]:[]),
        visibility:extra.visibility||'public',
        mentions:extra.mentions||extractMentions(clean),
        taggedUserIds:extra.taggedUserIds||[],
        feeling:extra.feeling||'',
        targetType:extra.targetType||'user',
        targetId:extra.targetId||user.uid,
        authorType:extra.authorType||'user',
        authorId:extra.authorId||user.uid,
        businessId:extra.businessId||null,
        userId:user.uid,
        createdByUid:user.uid,
        createdByUserId:extra.createdByUserId||user.uid,
        authorName:extra.authorName||me.name,
        authorAvatar:extra.authorAvatar||me.avatar,
        sharedPostId:extra.sharedPostId||null,
        type:extra.type||'post',
        poll:extra.poll||null,
        bgGradient:extra.bgGradient||null,
        linkPreview:extra.linkPreview||null,
        likeCount:0, reactionCount:0, commentCount:0, shareCount:0, saveCount:0,
        status:'active', createdAt:GF.fs.serverTimestamp(), updatedAt:GF.fs.serverTimestamp()
      };
      GF.fs.addDoc(GF.fs.collection(GF.db,'posts'), payload).then(function(ref){
        toast('Post published'); if(window.GeoSocial.awardPoints) window.GeoSocial.awardPoints(extra.targetType==='business'?10:20, extra.targetType==='business'?'Business page post':'Create post', 'post', ref.id); if(extra.targetType==='business' && extra.targetId) GF.fs.updateDoc(GF.fs.doc(GF.db,'businesses',extra.targetId), {postCount:GF.fs.increment(1)}).catch(function(){}); if(extra.targetType==='group' && extra.targetId) GF.fs.updateDoc(GF.fs.doc(GF.db,'groups',extra.targetId), {postCount:GF.fs.increment(1)}).catch(function(){}); if(callback) callback(ref.id);
      }).catch(function(err){ console.error('createPost enhanced',err); toast('Post failed: '+(err.code||err.message),'error'); if(callback) callback(null,err); });
    };
  }

  var NP_ICONS = {
    like:            { icon: 'fa-heart',       color: '#ef4444' },
    comment:         { icon: 'fa-comment',     color: '#3b82f6' },
    reply:           { icon: 'fa-reply',       color: '#8b5cf6' },
    follow:          { icon: 'fa-user-plus',   color: '#10b981' },
    message:         { icon: 'fa-envelope',    color: '#06b6d4' },
    reward:          { icon: 'fa-gift',        color: '#f59e0b' },
    badge:           { icon: 'fa-medal',       color: '#f59e0b' },
    challenge:       { icon: 'fa-trophy',      color: '#f59e0b' },
    story_reply:     { icon: 'fa-film',        color: '#ec4899' },
    story_reaction:  { icon: 'fa-star',        color: '#f97316' },
    friend_request:  { icon: 'fa-user-clock',  color: '#10b981' },
    friend_accept:   { icon: 'fa-handshake',   color: '#22d3ee' },
    points_received: { icon: 'fa-coins',       color: '#eab308' },
    quote:           { icon: 'fa-file-invoice',color: '#6366f1' },
    quote_request:   { icon: 'fa-file-invoice',color: '#6366f1' },
    business_review: { icon: 'fa-star',        color: '#f59e0b' },
    business_follow: { icon: 'fa-store',       color: '#10b981' },
    coupon_redeemed:     { icon: 'fa-ticket-alt',  color: '#10b981' },
    group_join_request:  { icon: 'fa-user-clock',  color: '#a855f7' },
    group_approved:      { icon: 'fa-user-check',  color: '#10b981' },
    group_declined:      { icon: 'fa-user-times',  color: '#ef4444' }
  };
  var NP_FILTERS = [
    { key: 'all',     label: 'All' },
    { key: 'like',    label: 'Likes' },
    { key: 'comment', label: 'Comments' },
    { key: 'reply',   label: 'Replies' },
    { key: 'follow',  label: 'Follows', types: ['follow', 'business_follow'] },
    { key: 'message', label: 'Messages' },
    { key: 'story',   label: 'Stories',  types: ['story_reply', 'story_reaction'] },
    { key: 'reward',  label: 'Rewards',  types: ['reward', 'badge', 'challenge', 'points_received', 'coupon_redeemed'] }
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
    var pageActor = notificationActor();
    var pageTitle = pageActor.type === 'business' ? esc(pageActor.title + ' Activity') : 'Notifications';
    var pageSub = pageActor.type === 'business' ? 'Using GeoHub as '+pageActor.title : '';
    shell({ active: 'notifications', right: '', center:
      '<div class="np-page">' +
        '<div class="np-head">' +
          '<div><h2 id="npTitle"><i class="fas fa-bell"></i> '+pageTitle+'</h2><p class="np-context" id="npContext"'+(pageSub?'':' style="display:none"')+'>'+esc(pageSub)+'</p></div>' +
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
    var npStarted = false;
    var npActorKey = '';
    var npFilter = 'all';
    var npItems = [];

    function npRender() {
      var box = $('#npList'); if (!box) return;
      var currentNpF = NP_FILTERS.find(function(f){ return f.key === npFilter; });
      var filtered = npFilter === 'all' ? npItems : npItems.filter(function(n){
        if(currentNpF && currentNpF.types) return currentNpF.types.indexOf(n.type) !== -1;
        return n.type === npFilter;
      });
      if (!filtered.length) {
        var emptyActor = notificationActor();
        var empty = notificationEmptyCopy(emptyActor);
        var emptyBody = npFilter === 'all' ? empty.body : 'No ' + npFilter + (emptyActor.type === 'business' ? ' page activity yet.' : ' notifications yet.');
        box.innerHTML = '<div class="np-empty"><i class="fas fa-bell"></i><h3>'+esc(empty.title)+'</h3><p>' + esc(emptyBody) + '</p></div>';
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
            var pageBadge = n.targetActorType === 'business' ? '<span class="np-page-badge"><i class="fas fa-store"></i> Page</span>' : '';
            var npAv = n.fromAvatar || '';
            var npInit = ((n.fromName || 'G')[0] || 'G').toUpperCase();
            var npAvHtml = npAv
              ? '<img class="np-item-av-img" src="' + esc(npAv) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                + '<div class="np-item-av-fb" style="display:none">' + esc(npInit) + '</div>'
              : '<div class="np-item-av-fb">' + esc(npInit) + '</div>';
            return '<a class="np-item' + (!n.read ? ' unread' : '') + '" href="' + esc(n.href || 'notifications.html') + '" data-np-id="' + esc(n.id) + '">' +
              '<div class="np-item-av"><div class="np-item-av-wrap">' + npAvHtml + '</div>' +
              '<span class="np-item-av-badge" style="background:' + ic.color + '"><i class="fas ' + ic.icon + '"></i></span></div>' +
              '<div class="np-item-body">' +
                '<div class="np-item-title">' + esc(n.title || 'GeoHub') + '</div>' +
                '<div class="np-item-sub">' + esc(n.body || n.message || '') + '</div>' +
                '<div class="np-item-time">' + npTimeAgo(n.createdAt) + pageBadge + '</div>' +
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

    function _tryStartNpListen() {
      var u = authUser();
      if (!u) return;
      var actor = notificationActor();
      var nextKey = actor.type + ':' + actor.targetActorId;
      var titleEl = $('#npTitle');
      var ctxEl = $('#npContext');
      if(titleEl) titleEl.innerHTML = '<i class="fas fa-bell"></i> ' + (actor.type === 'business' ? esc(actor.title + ' Activity') : 'Notifications');
      if(ctxEl) {
        if(actor.type === 'business') { ctxEl.style.display = ''; ctxEl.textContent = 'Using GeoHub as ' + actor.title; }
        else { ctxEl.style.display = 'none'; ctxEl.textContent = ''; }
      }
      if (npUnsub && npActorKey === nextKey) return;
      if (npUnsub) { try { npUnsub(); } catch(e) {} npUnsub = null; }
      npActorKey = nextKey;
      npItems = [];
      npRender();
      npStarted = true;
      var sub = GS() && GS().listenActorNotifications
        ? GS().listenActorNotifications(actor, function(items) { npItems = items || []; npRender(); })
        : GS() && GS().listenUserNotifications
          ? GS().listenUserNotifications(u.uid, function(items) { npItems = items || []; npRender(); })
        : null;
      if (sub) {
        npUnsub = sub;
        state.pageUnsubs.push(npUnsub);
      } else {
        npStarted = false;
        npRender();
      }
    }
    ready(function() { _tryStartNpListen(); });
    window.addEventListener('GeoActorChanged', function(){ _tryStartNpListen(); });
    window.addEventListener('GeoAuthReady', function() {
      if (!authUser()) { npRender(); return; }
      _tryStartNpListen();
    }, { once: true });
  }

  function renderSearch(){
    injectShellNav('search');
    // Sync URL query into topbar search so it stays consistent
    var sri=document.getElementById('srchInput');
    var gs2=document.getElementById('ghGlobalSearch');
    if(sri && gs2 && sri.value) gs2.value=sri.value;
  }

  function renderComingSoon(){
    var title = (PAGE || PATH.replace('.html','') || 'section').replace(/[-_]/g,' ');
    title = title.charAt(0).toUpperCase() + title.slice(1);
    shell({ active: PAGE, center: '<div class="gh-card gh-empty" style="min-height:360px"><i class="fas fa-tools"></i><h3>'+esc(title)+' is admin-controlled</h3><p>This section is not ready yet. No fake demo content is shown.</p><a class="gh-btn" href="feed.html">Back to Feed</a></div>' });
  }

  function init(){
    // Never inject the app shell on auth / login / onboarding pages.
    var AUTH_PAGES = ['auth.html','onboarding.html','login.html','register.html','signup.html'];
    if(AUTH_PAGES.indexOf(PATH) !== -1) return;
    ready(function(){ enhanceGeoSocial(); });
    if(PAGE==='rewards' || PATH==='rewards.html') return; // geohub-points.js renders the integrated rewards app shell.
    if(PAGE==='feed' || PATH==='feed.html' || PATH==='index.html') return renderFeed();
    if(PAGE==='discover' || PATH==='explore.html') return renderDiscover();
    if(PAGE==='business' || PATH==='business.html') {
      if(new URLSearchParams(location.search).get('id')){ injectShellNav('business'); return; } // business-page.js renders detail
      return renderBusinesses();
    }
    if(PAGE==='groups' || PATH==='groups.html') return renderGroups();
    if(PAGE==='add-business' || PATH==='add-business.html') return patchAddBusinessPage();
    if(PAGE==='notifications' || PATH==='notifications.html') return renderNotifications();
    if(PAGE==='search' || PATH==='search.html') return renderSearch();
    if(PAGE==='messages' || PATH==='messages.html'){ injectShellNav('messages'); return; }
    if(PAGE==='profile' || PATH==='profile.html'){ injectShellNav('profile'); return; } // profile.js renders profile content
    return renderComingSoon();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Expose rendering helpers for other scripts (e.g. profile.js)
  window.GeoSocialUI = {
    postCard: postCard,
    bindPostInteractions: bindPostInteractions,
    hydratePostAuthorAvatars: hydratePostAuthorAvatars,
    hydrateReactionState: hydrateReactionState,
    loadReactionBreakdown: loadReactionBreakdown,
    hydratePollVote: hydratePollVote,
    renderCommentsForPid: renderCommentsForPid
  };
  window.GeoHubPostInteractions = { bind: bindPostInteractions };

  // Clean up all Firestore listeners when navigating away to avoid runaway billing
  window.addEventListener('pagehide', function() {
    if(state.authUnsub){ try{ state.authUnsub(); }catch(e){} state.authUnsub=null; }
    if(state.safetyUnsub){ try{ state.safetyUnsub(); }catch(e){} state.safetyUnsub=null; }
    clearFeedListener();
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
