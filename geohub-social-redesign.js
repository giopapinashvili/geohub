/* GeoHub Social Redesign v2
   Self-contained app shell for feed/discover/groups/business pages.
   Uses Firebase Auth + Firestore through window.GeoFirebase and window.GeoSocial.
*/
(function(){
  'use strict';

  /* ── Phase 60: Multi-Language UI ──────────────────────────── */
  var _GH_LANGS={
    ka:{
      writePost:'რას აზიარებ დღეს?', comment:'დაწერე კომენტარი…',
      like:'Like', comment_btn:'Comment', share:'Share', save:'Save',
      follow:'Follow', following:'Following', unfollow:'Unfollow',
      post:'Post', cancel:'Cancel', delete:'Delete', edit:'Edit',
      translate:'🌐 Translate', readMore:'წაიკითხე მეტი ▾',
      noFeed:'Feed ცარიელია', findPeople:'ადამიანების პოვნა',
      voiceNote:'🎙️ Voice Note', gifLabel:'GIF',
      sponsored:'სპონსორირებული', trending:'ტრენდული',
      schedulePost:'Post-ის დაგეგმვა', draftSaved:'✏️ Draft შენახულია',
      repost:'Repost', coAuthor:'Co-Author',
    },
    en:{
      writePost:"What's on your mind?", comment:'Write a comment…',
      like:'Like', comment_btn:'Comment', share:'Share', save:'Save',
      follow:'Follow', following:'Following', unfollow:'Unfollow',
      post:'Post', cancel:'Cancel', delete:'Delete', edit:'Edit',
      translate:'🌐 Translate', readMore:'Read more ▾',
      noFeed:'Feed is empty', findPeople:'Find people',
      voiceNote:'🎙️ Voice Note', gifLabel:'GIF',
      sponsored:'Sponsored', trending:'Trending',
      schedulePost:'Schedule post', draftSaved:'✏️ Draft saved',
      repost:'Repost', coAuthor:'Co-Author',
    },
    ru:{
      writePost:'Что у вас нового?', comment:'Написать комментарий…',
      like:'Нравится', comment_btn:'Комментарий', share:'Поделиться', save:'Сохранить',
      follow:'Подписаться', following:'Вы подписаны', unfollow:'Отписаться',
      post:'Опубликовать', cancel:'Отмена', delete:'Удалить', edit:'Редактировать',
      translate:'🌐 Перевести', readMore:'Читать далее ▾',
      noFeed:'Лента пуста', findPeople:'Найти людей',
      voiceNote:'🎙️ Голосовое', gifLabel:'GIF',
      sponsored:'Реклама', trending:'В тренде',
      schedulePost:'Запланировать', draftSaved:'✏️ Черновик сохранён',
      repost:'Репост', coAuthor:'Соавтор',
    }
  };
  var _ghLang='ka';
  try{ _ghLang=localStorage.getItem('gh_lang')||'ka'; }catch(e){}
  if(!_GH_LANGS[_ghLang]) _ghLang='ka';
  function t(key){ return (_GH_LANGS[_ghLang]||_GH_LANGS.ka)[key]||key; }
  function setLang(lang){
    if(!_GH_LANGS[lang]) return;
    _ghLang=lang;
    try{ localStorage.setItem('gh_lang',lang); }catch(e){}
    // Update dynamic placeholders
    $all('[data-i18n]').forEach(function(el){ var k=el.dataset.i18n; if(k) el.textContent=t(k); });
    $all('[data-i18n-ph]').forEach(function(el){ var k=el.dataset.i18nPh; if(k) el.placeholder=t(k); });
  }
  window.ghSetLang=setLang;
  window.ghT=t;

  var PATH = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var PAGE = document.body && document.body.dataset ? document.body.dataset.ghPage : '';
  var state = { page: PAGE, filter: 'all', postsUnsubs: {}, replyUnsubs: {}, currentBusinessTab: 'posts', bizDashSection: 'overview', currentGroupTab: 'discussion', starRating: 5, theme: 'light', authUnsub: null, badgeUnsubs: [], sidebarCollapsed: false, hiddenPostIds: [], blockedUserIds: [], mutedUserIds: [], safetyUnsub: null, sharedPostCache: {}, friendIds: [], followingIds: [], followedBusinessIds: [], closeFriendIds: [], bizFeedPosts: [], bizFeedUnsub: null, audienceLoaded: false, pageUnsubs: [], currentBizId: null, currentBizOwner: null, openCommentPids: {}, cachedComments: {}, cachedReplies: {}, feedTab: 'foryou', feedTag: '', feedUnsub: null, feedRenderId: 0, userCity: null };

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
  /* ── Skeleton video card (looks like a videoPostCard placeholder) ── */
  function skelVideoCard(){
    return '<div class="gh-skel-post">'+
      '<div class="gh-skel-img" style="height:220px;border-radius:12px;margin-bottom:12px"></div>'+
      '<div class="gh-skel-post-head" style="margin-bottom:8px">'+
        '<div class="gh-avatar gh-skel" style="width:34px;height:34px"></div>'+
        '<div style="flex:1;min-width:0">'+
          '<div class="gh-skel-line" style="width:120px;height:12px;margin-bottom:5px"></div>'+
          '<div class="gh-skel-line" style="width:65px;height:10px"></div>'+
        '</div>'+
      '</div>'+
      '<div class="gh-skel-line" style="width:88%;height:13px;margin-bottom:5px"></div>'+
      '<div class="gh-skel-line" style="width:62%;height:11px"></div>'+
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

  /* ── Phase 60: Language Picker init ──────────────────────── */
  function initLangPicker(){
    var btn=document.getElementById('ghLangBtn');
    var drop=document.getElementById('ghLangDrop');
    var label=document.getElementById('ghLangLabel');
    if(!btn||!drop) return;
    // Reflect current lang
    var _labels={ka:'KA',en:'EN',ru:'RU'};
    if(label) label.textContent=_labels[_ghLang]||'KA';
    drop.querySelectorAll('.gh-lang-opt').forEach(function(opt){
      opt.classList.toggle('active', opt.dataset.setLang===_ghLang);
    });
    // Toggle dropdown
    btn.onclick=function(e){ e.stopPropagation(); drop.classList.toggle('open'); };
    // Option click
    drop.querySelectorAll('.gh-lang-opt').forEach(function(opt){
      opt.onclick=function(e){
        e.stopPropagation();
        var lang=opt.dataset.setLang;
        setLang(lang);
        if(label) label.textContent=_labels[lang]||'KA';
        drop.querySelectorAll('.gh-lang-opt').forEach(function(o){ o.classList.toggle('active', o.dataset.setLang===lang); });
        drop.classList.remove('open');
      };
    });
    // Close on outside click
    document.addEventListener('click',function(){ drop.classList.remove('open'); });
  }

  function $(s, root){ return (root || document).querySelector(s); }
  function $all(s, root){ return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  /* Phase 21: linkify hashtags in post text */
  function linkifyText(v){
    return esc(v)
      .replace(/#([\wა-ჿ]+)/g,function(_,tag){
        return '<a class="gh-hashtag" href="feed.html?tag='+encodeURIComponent(tag.toLowerCase())+'" onclick="event.stopPropagation()">#'+tag+'</a>';
      })
      .replace(/@([A-Za-z0-9_.ა-ჿ]{2,32})/g,function(_,u){
        return '<a class="gh-mention" href="profile.html?user='+encodeURIComponent(u)+'" onclick="event.stopPropagation()">@'+u+'</a>';
      });
  }
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
    var _osbt=typeof GHt==='function'?GHt:function(k){return k;};
    var label=s.open?_osbt('biz_ov_open_now'):_osbt('biz_ov_closed');
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
    // New audience-based check
    if(p.audience && p.audience.types && p.audience.types.length) {
      var aud = p.audience;
      var types = aud.types;
      if(types.indexOf('onlyme') > -1) return !!(u && author === u.uid);
      if(u && author === u.uid) return true;
      var viewerIsFriend   = !!(u && state.friendIds.indexOf(author) > -1);
      var viewerIsFollower = !!(u && state.followingIds.indexOf(author) > -1);
      var typeOK = false;
      if(types.indexOf('friends')   > -1 && viewerIsFriend)   typeOK = true;
      if(types.indexOf('followers') > -1 && viewerIsFollower) typeOK = true;
      if(types.indexOf('strangers') > -1) typeOK = true;
      if(!typeOK) return false;
      // Gender filter
      if(aud.gender && aud.gender !== 'all') {
        var vg = window.GeoCurrentUser && window.GeoCurrentUser.gender;
        if(vg && vg !== aud.gender) return false;
      }
      // Age filter
      if(aud.ageMin || aud.ageMax) {
        var vbd = window.GeoCurrentUser && window.GeoCurrentUser.birthday;
        if(vbd) {
          var vAge = Math.floor((Date.now() - new Date(vbd).getTime()) / (365.25*24*3600*1000));
          if(aud.ageMin && vAge < aud.ageMin) return false;
          if(aud.ageMax && vAge > aud.ageMax) return false;
        }
      }
      return true;
    }
    // Legacy visibility check
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

  function bottomNav(active){
    var tabs=[
      {k:'feed',   href:'feed.html',          icon:'fa-house',     lbl:'Feed',          i18n:'nav_feed'},
      {k:'search', href:'search.html',         icon:'fa-search',    lbl:'ძებნა',         i18n:'nav_search'},
      {k:'_post',  href:'#',                   icon:'fa-plus',      lbl:'პოსტი',         i18n:'nav_post',  isPost:true},
      {k:'notifs', href:'notifications.html',  icon:'fa-bell',      lbl:'შეტყობინება',   i18n:'nav_notifications', badge:true},
      {k:'profile',href:'profile.html',        icon:'fa-user',      lbl:'პროფილი',       i18n:'nav_profile'}
    ];
    return '<nav class="gh-bottom-nav" id="ghBottomNav">'+
      tabs.map(function(t){
        if(t.isPost) return '<button class="gh-bnav-item gh-bnav-post" data-create-post>'+
          '<span class="gh-bnav-icon"><i class="fas fa-plus"></i></span>'+
          '<span class="gh-bnav-lbl" data-i18n="'+t.i18n+'">'+t.lbl+'</span></button>';
        return '<a class="gh-bnav-item'+(active===t.k?' active':'')+'" href="'+t.href+'">'+
          '<span class="gh-bnav-icon"><i class="fas '+t.icon+'"></i>'+
          (t.badge?'<b class="gh-badge-count" id="ghBNavNotifBadge" style="top:-4px;right:-6px"></b>':'')+
          '</span>'+
          '<span class="gh-bnav-lbl" data-i18n="'+t.i18n+'">'+t.lbl+'</span></a>';
      }).join('')+
    '</nav>';
  }

  function shell(opts){
    opts = opts || {};
    document.body.classList.add('gh-social-body','gh-fb-inspired');
    initTheme();
    var _ctMap={feed:'feed',groups:'groups',messages:'messages',notifications:'notifications'};
    var bnavKey = opts.active==='notifications'?'notifs':(opts.active||'');
    document.body.innerHTML = '<div class="gh-shell">'+topbar(_ctMap[opts.active]||'')+
      '<div class="gh-layout">'+leftNav(opts.active||'')+'<main class="gh-center" id="ghCenter"></main>'+rightRail(opts.right||'')+'</div></div>'+
      bottomNav(bnavKey);
    $('#ghCenter').innerHTML = opts.center || '';
    initLangPicker();
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
    var bnDiv=document.createElement('div');
    var bnavKey=activePage==='notifications'?'notifs':activePage;
    bnDiv.innerHTML=bottomNav(bnavKey);
    document.body.appendChild(bnDiv.firstChild);
    initLangPicker();
    bindShell();
    updateTopUser();
    bindAuthState();
    listenBadges();
  }

  function topbar(centerActive){
    function ca(t){ return centerActive===t?' class="active"':''; }
    return '<header class="gh-topbar gh-hub-topbar">'+
      '<a class="gh-brand" href="feed.html"><img src="icons/icon-96.png" alt="GeoHub" style="width:36px;height:36px;border-radius:10px;object-fit:cover;flex-shrink:0"><span>Geo<span>Hub</span></span></a>'+
      '<div class="gh-top-search"><i class="fas fa-search"></i><input id="ghGlobalSearch" data-i18n-placeholder="search_placeholder" placeholder="მოძებნე ადგილები, ადამიანები, ჯგუფები…"></div>'+
      '<nav class="gh-center-tabs" aria-label="Primary navigation">'+
        '<a'+ca('feed')+' href="feed.html" title="Feed"><i class="fas fa-house"></i></a>'+
        '<a'+ca('groups')+' href="groups.html" title="Groups"><i class="fas fa-user-group"></i></a>'+
        '<a'+ca('messages')+' id="ghMsgLink" href="messages.html" title="Messages"><i class="fas fa-comment-dots"></i><b class="gh-badge-count" id="ghMsgBadge"></b></a>'+
        '<button type="button" id="ghNotifBtn" title="Notifications"><i class="fas fa-bell"></i><b class="gh-badge-count" id="ghNotifBadge"></b></button>'+
      '</nav>'+
      '<div class="gh-top-actions">'+
        '<button class="gh-icon-btn gh-sidebar-toggle" id="ghSidebarToggle" title="Collapse sidebar"><i class="fas fa-bars-staggered"></i></button>'+
        '<button class="gh-icon-btn gh-streak-btn" id="ghStreakBtn" title="Streak" style="display:none"><span class="gh-streak-fire">🔥</span><b class="gh-streak-count" id="ghStreakBadge">0</b></button>'+
        '<a class="gh-icon-btn" href="settings.html" title="Settings" aria-label="Settings"><i class="fas fa-gear"></i></a>'+
        '<button class="gh-icon-btn gh-theme-toggle" id="ghThemeToggle" title="Toggle light/dark mode"><i class="fas fa-moon"></i></button>'+
        '<div id="ghActorBtnSlot" class="gh-actor-btn-slot"></div>'+
      '</div></header>';
  }

  function leftNav(active){
    var PRIMARY=[
      ['feed','feed.html','fa-house','მთავარი','nav_feed'],
      ['videos','videos.html','fa-film','Videos','nav_videos'],
      ['map','map.html','fa-map','Map','nav_map'],
      ['groups','groups.html','fa-users','Groups','nav_groups'],
      ['places','places.html','fa-location-dot','Places','nav_places']
    ];
    var SECONDARY=[
      ['my-channel','#','fa-tv','ჩემი არხი','nav_my_channel'],
      ['reels','reels.html','fa-bolt','Reels','nav_reels'],
      ['business','business.html','fa-store','Businesses','nav_business'],
      ['marketplace','marketplace.html','fa-store-alt','Marketplace','nav_marketplace'],
      ['events','events.html','fa-calendar-xmark','Events','nav_events'],
      ['messages','messages.html','fa-comment-dots','Messages','nav_messages'],
      ['notifications','notifications.html','fa-bell','Notifications','nav_notifications'],
      ['creators','creators.html','fa-camera-retro','Creators','nav_creators'],
      ['rewards','rewards.html','fa-gift','Rewards','nav_rewards'],
      ['gamification','gamification.html','fa-trophy','XP & Badges','nav_gamification'],
      ['assistant','assistant.html','fa-robot','GeoAI','nav_assistant'],
      ['premium','premium.html','fa-crown','Premium 👑','nav_premium'],
      ['challenges','challenges.html','fa-flag-checkered','Challenges','nav_challenges'],
      ['services','services.html','fa-grip','Services','nav_services'],
      ['realestate','real-estate.html','fa-house-chimney','Real Estate','nav_realestate'],
      ['learning','learning.html','fa-graduation-cap','Learning','nav_learning'],
      ['trust','trust.html','fa-shield-halved','Trust / Safety','nav_trust'],
      ['settings','settings.html','fa-gear','Settings','settings'],
      ['admin','admin.html','fa-user-shield','Admin Panel','nav_admin']
    ];
    var exp=false; try{ exp=localStorage.getItem('gh_nav_exp')==='1'; }catch(e){}
    function navItem(it,sec){
      var extra=it[0]==='my-channel'?' data-my-channel="1"':'';
      var cls='gh-nav-item'+(active===it[0]?' active':'')+(sec?' gh-nav-sec':'');
      var tag=it[1]==='#'?'button':'a';
      var href=it[1]==='#'?'':' href="'+it[1]+'"';
      var badgeHtml=it[0]==='notifications'?'<b class="gh-badge-count gh-lnav-notif-badge" id="ghLeftNavNotifBadge" style="position:absolute;top:6px;right:8px"></b>':'';
      var posStyle=it[0]==='notifications'?' style="position:relative"':'';
      var i18nAttr=it[4]?' data-i18n="'+it[4]+'"':'';
      return '<'+tag+' class="'+cls+'"'+extra+href+posStyle+'><i class="fas '+it[2]+'"></i><span'+i18nAttr+'>'+it[3]+'</span>'+badgeHtml+'</'+tag+'>';
    }
    return '<aside class="gh-left"><nav class="gh-panel">'+
      PRIMARY.map(function(it){ return navItem(it,false); }).join('')+
      '<button class="gh-nav-item gh-nav-more" id="ghNavMore" data-nav-more>'+
        '<i class="fas fa-chevron-'+(exp?'up':'down')+'" id="ghNavMoreIcon"></i>'+
        '<span id="ghNavMoreTxt" data-i18n="'+(exp?'nav_less':'nav_more')+'">'+(exp?'ნაკლები':'მეტი')+'</span>'+
      '</button>'+
      '<div class="gh-nav-sec-list'+(exp?' open':'') +'" id="ghNavSecList">'+
        SECONDARY.map(function(it){ return navItem(it,true); }).join('')+
      '</div>'+
      '<button class="gh-nav-item gh-live-nav-btn" data-go-live onclick="if(window.ghOpenGoLive)ghOpenGoLive()"><i class="fas fa-video"></i><span data-i18n="nav_go_live">Go Live</span></button>'+
      '<button class="gh-nav-tour-btn" data-start-tour><i class="fas fa-question-circle"></i><span data-i18n="nav_how_works">How GeoHub works</span></button>'+
    '</nav></aside>';
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
    /* ── Phase 20: Auto-updating timestamps (60s tick) ───── */
    if(!state._tsTickerBound){
      state._tsTickerBound=true;
      setInterval(function(){
        document.querySelectorAll('[data-cmt-time]').forEach(function(el){
          var ms=Number(el.dataset.cmtTime||0); if(!ms) return;
          el.textContent=timeAgo({toMillis:function(){ return ms; }});
        });
      },60000);
    }
    /* ── Phase 16: In-app push notification toast ──────────── */
    if(!state._pushToastBound){
      state._pushToastBound=true;
      var NOTIF_ICONS={message:'💬',like:'❤️',comment:'💬',follow:'👤',friend_request:'🤝',event_reminder:'🎉',general:'🔔'};
      window.addEventListener('GeoNotification',function(e){
        var d=e.detail||{}; if(!d.title) return;
        var existing=document.getElementById('ghInAppNotifToast'); if(existing) existing.remove();
        var toast=document.createElement('div');
        toast.id='ghInAppNotifToast'; toast.className='gh-inapp-notif';
        var icon=NOTIF_ICONS[d.type]||'🔔';
        var url=d.url||'';
        toast.innerHTML=
          '<div class="gh-ian-inner">'+
            '<div class="gh-ian-icon">'+icon+'</div>'+
            '<div class="gh-ian-body">'+
              '<div class="gh-ian-title">'+esc(d.title)+'</div>'+
              (d.body?'<div class="gh-ian-body-txt">'+esc(d.body)+'</div>':'')+
            '</div>'+
            (url?'<a class="gh-ian-action" href="'+esc(url)+'"><i class="fas fa-arrow-right"></i></a>':'')+
            '<button class="gh-ian-close" onclick="this.closest(\'#ghInAppNotifToast\').remove()">✕</button>'+
          '</div>';
        document.body.appendChild(toast);
        requestAnimationFrame(function(){ toast.classList.add('show'); });
        setTimeout(function(){ toast.classList.remove('show'); toast.classList.add('hide'); setTimeout(function(){ if(toast.parentNode) toast.remove(); },400); },5000);
        if(url){ toast.querySelector('.gh-ian-inner').style.cursor='pointer'; toast.querySelector('.gh-ian-inner').addEventListener('click',function(ev){ if(!ev.target.closest('.gh-ian-close') && !ev.target.closest('.gh-ian-action')) window.location.href=url; }); }
      });
    }
    if(!state._shellClickBound){
      state._shellClickBound=true;
      document.addEventListener('click', function(e){
        /* Sidebar "მეტი/ნაკლები" toggle */
        if(e.target.closest('[data-nav-more]')){
          var sec=document.getElementById('ghNavSecList');
          var icon=document.getElementById('ghNavMoreIcon');
          var txt=document.getElementById('ghNavMoreTxt');
          if(!sec) return;
          var open=sec.classList.toggle('open');
          if(icon){ icon.className='fas fa-chevron-'+(open?'up':'down'); }
          if(txt){ txt.textContent=open?'ნაკლები':'მეტი'; }
          try{ localStorage.setItem('gh_nav_exp', open?'1':'0'); }catch(e2){}
          return;
        }
        /* Inline video playback — only expand button navigates to video page */
        var playThumb = e.target.closest('[data-play-video]');
        if(playThumb && !e.target.closest('.gh-video-expand-btn')){
          e.preventDefault(); e.stopPropagation();
          var vHref = playThumb.dataset.videoHref;
          if(vHref) window.location.href = vHref;
          return;
        }
        if(e.target.closest('[data-create-post]')){ e.preventDefault(); e.stopPropagation(); openPostModal(buildActorExtra()); return; }
        if(e.target.closest('[data-create-story]')){ e.preventDefault(); e.stopPropagation(); openStoryModal(); return; }
        if(e.target.closest('[data-my-channel]')){ e.preventDefault(); e.stopPropagation(); openMyChannelPicker(e.target.closest('[data-my-channel]')); return; }
        if(e.target.closest('#ghNotifBtn')) openNotifications();
        if(e.target.closest('[data-start-tour]')){ var _tu=authUser(); startTour(_tu?_tu.uid:null); }
        var notif=e.target.closest('[data-notif]');
        if(notif && GS() && GS().markNotificationRead) GS().markNotificationRead(notif.dataset.notif);
        /* close channel picker on outside click */
        if(!e.target.closest('#ghChPicker') && !e.target.closest('[data-my-channel]')){
          var pk=document.getElementById('ghChPicker'); if(pk) pk.remove();
        }
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
            var _meUid=(authUser()||{}).uid;
            var _visUsers=(res.users||[]).filter(function(u){
              if(!u.isPrivate) return true;
              if(_meUid && (u.id===_meUid||u.uid===_meUid)) return true;
              var _gid=u.geoId&&String(u.geoId);
              if(q===u.id||q===u.uid||(_gid&&q===_gid)) return true;
              return state.friendIds.indexOf(u.id||u.uid)>-1||state.followingIds.indexOf(u.id||u.uid)>-1;
            });
            _visUsers.slice(0,3).forEach(function(u){items.push({type:'user',icon:'fa-user',avatar:u.photoURL||u.avatar||u.avatarUrl||u.photo||'',label:(u.isPrivate?'🔒 ':''+(u.fullName||u.displayName||u.name||'User')),sub:'@'+(u.username||u.id||''),href:'profile.html?id='+encodeURIComponent(u.id||u.uid||'')});});
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

  /* ── My Channel picker (sidebar nav item) ──────────────── */
  function openMyChannelPicker(anchor){
    var existing=document.getElementById('ghChPicker');
    if(existing){ existing.remove(); return; }
    var u=authUser();
    if(!u){ window.location.href='auth.html'; return; }
    var pk=document.createElement('div');
    pk.id='ghChPicker';
    pk.style.cssText='position:fixed;z-index:9999;background:var(--gh-surface,#1a2133);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:8px;min-width:220px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
    /* position near anchor */
    if(anchor){
      var r=anchor.getBoundingClientRect();
      pk.style.top=(r.top)+'px';
      pk.style.left=(r.right+8)+'px';
    } else { pk.style.top='200px'; pk.style.left='260px'; }
    pk.innerHTML='<div style="padding:6px 10px 10px;font-size:.78rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.06em">ჩემი არხები</div><div id="ghChPickerList"><i class="fas fa-spinner fa-spin" style="margin:10px 14px;color:#94a3b8"></i></div>'+
      '<div style="border-top:1px solid rgba(255,255,255,.08);margin-top:6px;padding-top:6px;">'+
        '<a href="videos.html?action=createCh" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;color:#10b981;font-size:.84rem;font-weight:600;text-decoration:none;transition:background .15s" onmouseover="this.style.background=\'rgba(16,185,129,.1)\'" onmouseout="this.style.background=\'\'">'+
          '<i class="fas fa-plus-circle"></i> ახალი არხი</a>'+
      '</div>';
    document.body.appendChild(pk);
    if(!fs()||!db()){ document.getElementById('ghChPickerList').innerHTML='<div style="padding:10px 14px;font-size:.82rem;color:#94a3b8">Firebase არ არის მზად</div>'; return; }
    fs().getDocs(fs().query(fs().collection(db(),'channels'),fs().where('ownerId','==',u.uid)))
      .then(function(snap){
        var list=document.getElementById('ghChPickerList');
        if(!list) return;
        if(snap.empty){
          list.innerHTML='<div style="padding:10px 14px;font-size:.82rem;color:#94a3b8"><i class="fas fa-tv" style="margin-right:6px"></i>არხი ჯერ არ გაქვს</div>';
          return;
        }
        list.innerHTML=snap.docs.map(function(d){
          var ch=d.data();
          var av=ch.avatar?'<img src="'+ch.avatar+'" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display=\'none\'">'
            :'<div style="width:32px;height:32px;border-radius:50%;background:rgba(16,185,129,.15);color:#10b981;display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0"><i class="fas fa-tv"></i></div>';
          return '<a href="channel.html?id='+d.id+'" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;color:var(--gh-text,#f1f5f9);font-size:.84rem;text-decoration:none;transition:background .15s" onmouseover="this.style.background=\'rgba(255,255,255,.06)\'" onmouseout="this.style.background=\'\'">'+
            av+'<div style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">'+(ch.name||'არხი')+'</div>'+
            '<div style="font-size:.72rem;color:#94a3b8">'+(ch.videoCount||0)+' ვიდეო</div></div></a>';
        }).join('');
      })
      .catch(function(){ var l=document.getElementById('ghChPickerList'); if(l) l.innerHTML='<div style="padding:10px 14px;font-size:.82rem;color:#ef4444">ვერ ჩაიტვირთა</div>'; });
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
      if(fbUser){ validateActorOnLoad(); maybeUpdateStreak(fbUser.uid); _initWrapped(fbUser.uid); setTimeout(function(){ checkAndAwardBadges(fbUser.uid); }, 3000); setTimeout(function(){ loadOnThisDay(fbUser.uid); }, 1500); setTimeout(function(){ _loadBirthdayFeedCards(fbUser.uid); _loadWeeklyDigest(fbUser.uid); }, 2500); setTimeout(function(){ checkAndPublishScheduledPosts(fbUser.uid); }, 4000); setTimeout(function(){ startPostInsightsListener(fbUser.uid); }, 6000); }
      if(!fbUser){ var sb=document.getElementById('ghStreakBtn'); if(sb) sb.style.display='none'; }
      var bid = new URLSearchParams(location.search).get('id');
      if((state.page === 'business' || PAGE === 'business') && bid) updateBusinessFollowButton(bid);
    });
  }

  /* ── Phase 38: Smart Notifications Badge ────────────────── */
  function _showNotifPreviewToast(n){
    if(!n) return;
    var ic=GH_NOTIF_ICONS[n.type]||{icon:'fa-bell',color:'#10b981'};
    var bodyText=n.body||n.message||n.text||'New notification';
    var existing=document.getElementById('ghNotifPreviewToast');
    if(existing) existing.remove();
    var el=document.createElement('div');
    el.id='ghNotifPreviewToast';
    el.className='gh-notif-preview-toast';
    el.innerHTML=
      '<div class="gh-npt-icon" style="background:'+esc(ic.color)+'"><i class="fas '+esc(ic.icon)+'"></i></div>'+
      '<div class="gh-npt-body">'+
        '<strong class="gh-npt-name">'+esc(n.senderName||n.actorName||'Notification')+'</strong>'+
        '<span class="gh-npt-text">'+esc((bodyText).slice(0,90))+'</span>'+
      '</div>'+
      '<a class="gh-npt-link" href="'+esc(n.href||'notifications.html')+'"></a>';
    document.body.appendChild(el);
    requestAnimationFrame(function(){ el.classList.add('gh-npt-show'); });
    var _nptTimer=setTimeout(function(){ el.classList.remove('gh-npt-show'); setTimeout(function(){ if(el.parentNode) el.remove(); },300); },4500);
    el.addEventListener('click',function(){ clearTimeout(_nptTimer); el.remove(); });
  }

  function _pulseBadge(el){
    if(!el) return;
    el.classList.remove('gh-badge-pulse');
    void el.offsetWidth; // reflow to restart animation
    el.classList.add('gh-badge-pulse');
    setTimeout(function(){ el.classList.remove('gh-badge-pulse'); },700);
  }

  function _setAllNotifBadges(n){
    [$('#ghNotifBadge'),$('#ghBNavNotifBadge'),$('#ghLeftNavNotifBadge')].forEach(function(b){ if(b) b.textContent=n?String(n):''; });
  }

  function listenBadges(){
    ready(function(){
      var nb=$('#ghNotifBadge'), mb=$('#ghMsgBadge');
      if(nb) nb.textContent='';
      if(mb) mb.textContent='';
      _setAllNotifBadges(0);
      (state.badgeUnsubs || []).forEach(function(u){ try{ if(u) u(); }catch(e){} });
      state.badgeUnsubs = [];
      var u=authUser(); if(!u) return;
      try{
        var _prevNotifCount=-1;
        var _prevNotifIds={};
        state.badgeUnsubs.push(listenCurrentActorNotifications(function(items){
          var unread=items.filter(function(x){return !x.read&&!x.seen;});
          var n=unread.length;
          _setAllNotifBadges(n);
          // Pulse + preview toast on new notification
          if(_prevNotifCount>=0 && n>_prevNotifCount){
            _pulseBadge($('#ghNotifBadge')); _pulseBadge($('#ghBNavNotifBadge'));
            var newest=unread.filter(function(x){ return !_prevNotifIds[x.id||x.uid||'']; })[0];
            if(newest) _showNotifPreviewToast(newest);
          }
          _prevNotifCount=n;
          _prevNotifIds={}; unread.forEach(function(x){ if(x.id) _prevNotifIds[x.id]=1; });
        }));
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
    '🎉 Celebrating','💪 Motivated','🙏 Grateful','🎂 Birthday','🏖️ Traveling',
    '😴 Tired','🤔 Thinking','😎 Cool','🥰 In Love','😤 Frustrated',
    '🤩 Excited','😌 Relaxed','💔 Heartbroken','🥳 Partying','😬 Nervous',
    '🏃 Active','🍀 Lucky','☕ Cozy','🌙 Sleepy','🔥 On Fire'
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
        '<textarea class="gh-textarea gh-cmp-textarea" id="ghPostText" data-i18n-placeholder="composer_placeholder" placeholder="What\'s on your mind?" rows="4" maxlength="2000"></textarea>'+
        '<div class="gh-char-count"><span id="ghCharUsed">0</span>/2000</div>'+
        '<div id="ghLinkPreviewCard" style="display:none" class="gh-lp-composer-preview"></div>'+
        '<div class="gh-feeling-row" id="ghFeelingRow">'+FEELINGS.map(function(f){ return '<button type="button" class="gh-feeling-chip" data-feeling="'+esc(f)+'">'+esc(f)+'</button>'; }).join('')+'</div>'+
        '<div id="ghSelectedFeeling" style="display:none;font-size:.84rem;color:var(--gh-green);margin:4px 0 8px;padding:4px 10px;background:rgba(16,185,129,.08);border-radius:10px"></div>'+
        '<div class="gh-bg-picker" id="ghBgPicker" style="display:none">'+BG_GRADIENTS.map(function(g,i){ return '<button type="button" class="gh-bg-swatch" data-bg-gradient="'+esc(g)+'" style="background:'+esc(g)+'"'+(i===0?' title="No color"':'')+' aria-label="Color '+i+'"></button>'; }).join('')+'<button type="button" class="gh-bg-swatch gh-bg-none" data-bg-gradient="" title="No color"><i class="fas fa-times"></i></button></div>'+
        '<div id="ghBgTextStyle" style="display:none;margin:8px 0;padding:8px 10px;background:rgba(255,255,255,.04);border:1px solid var(--gh-border);border-radius:10px;display:none">'+
          '<div style="font-size:.75rem;font-weight:700;color:var(--gh-muted);margin-bottom:6px">Text style</div>'+
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">'+
            '<button type="button" class="gh-bgts-color active" data-text-color="#ffffff" style="background:#fff;width:22px;height:22px;border-radius:50%;border:2px solid var(--gh-green)" title="White"></button>'+
            '<button type="button" class="gh-bgts-color" data-text-color="#000000" style="background:#000;width:22px;height:22px;border-radius:50%;border:2px solid transparent" title="Black"></button>'+
            '<button type="button" class="gh-bgts-color" data-text-color="#fbbf24" style="background:#fbbf24;width:22px;height:22px;border-radius:50%;border:2px solid transparent" title="Gold"></button>'+
            '<button type="button" class="gh-bgts-color" data-text-color="#f472b6" style="background:#f472b6;width:22px;height:22px;border-radius:50%;border:2px solid transparent" title="Pink"></button>'+
            '<button type="button" class="gh-bgts-color" data-text-color="#4ade80" style="background:#4ade80;width:22px;height:22px;border-radius:50%;border:2px solid transparent" title="Green"></button>'+
          '</div>'+
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">'+
            '<button type="button" class="gh-bgts-size" data-text-size="0.85rem" style="font-size:.75rem;padding:2px 8px;border-radius:8px;border:1px solid var(--gh-border);background:transparent;color:var(--gh-muted);cursor:pointer">S</button>'+
            '<button type="button" class="gh-bgts-size active" data-text-size="1.1rem" style="font-size:.85rem;padding:2px 8px;border-radius:8px;border:1px solid var(--gh-green);background:rgba(16,185,129,.1);color:var(--gh-green);cursor:pointer">M</button>'+
            '<button type="button" class="gh-bgts-size" data-text-size="1.4rem" style="font-size:.95rem;padding:2px 8px;border-radius:8px;border:1px solid var(--gh-border);background:transparent;color:var(--gh-muted);cursor:pointer">L</button>'+
            '<button type="button" class="gh-bgts-size" data-text-size="1.8rem" style="font-size:1rem;padding:2px 8px;border-radius:8px;border:1px solid var(--gh-border);background:transparent;color:var(--gh-muted);cursor:pointer">XL</button>'+
          '</div>'+
          '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
            '<button type="button" class="gh-bgts-style active" data-text-bold="0" data-text-italic="0" style="padding:2px 8px;border-radius:8px;border:1px solid var(--gh-green);background:rgba(16,185,129,.1);color:var(--gh-green);cursor:pointer;font-size:.78rem">Normal</button>'+
            '<button type="button" class="gh-bgts-style" data-text-bold="1" data-text-italic="0" style="padding:2px 8px;border-radius:8px;border:1px solid var(--gh-border);background:transparent;color:var(--gh-muted);cursor:pointer;font-size:.78rem;font-weight:700">Bold</button>'+
            '<button type="button" class="gh-bgts-style" data-text-bold="0" data-text-italic="1" style="padding:2px 8px;border-radius:8px;border:1px solid var(--gh-border);background:transparent;color:var(--gh-muted);cursor:pointer;font-size:.78rem;font-style:italic">Italic</button>'+
            '<button type="button" class="gh-bgts-style" data-text-bold="1" data-text-italic="1" style="padding:2px 8px;border-radius:8px;border:1px solid var(--gh-border);background:transparent;color:var(--gh-muted);cursor:pointer;font-size:.78rem;font-weight:700;font-style:italic">Bold Italic</button>'+
          '</div>'+
        '</div>'+
        '<div id="ghCmpMediaGrid" class="gh-cmp-media-grid"></div>'+
      '</div>'+
      '<div class="gh-cmp-footer-row">'+
        '<button type="button" class="gh-audience-btn" id="ghAudienceToggle">'+
          '<i class="fas fa-earth-europe gh-aud-icon-i" id="ghAudienceIcon"></i>'+
          '<span id="ghAudienceLbl">Everyone</span>'+
          '<i class="fas fa-chevron-down gh-aud-caret" id="ghAudienceCaret"></i>'+
        '</button>'+
      '</div>'+
      '<div class="gh-cmp-aud-panel" id="ghAudiencePanel">'+
        '<div class="gh-cmp-aud-section">'+
          '<div class="gh-cmp-aud-hd"><i class="fas fa-eye"></i> Who can see?</div>'+
          '<div class="gh-cmp-aud-checks">'+
            '<label class="gh-cmp-aud-check"><input type="checkbox" id="ghAudFriends" value="friends" checked><i class="fas fa-user-group"></i> Friends</label>'+
            '<label class="gh-cmp-aud-check"><input type="checkbox" id="ghAudFollowers" value="followers" checked><i class="fas fa-rss"></i> Followers</label>'+
            '<label class="gh-cmp-aud-check"><input type="checkbox" id="ghAudStrangers" value="strangers" checked><i class="fas fa-earth-europe"></i> Everyone</label>'+
            '<label class="gh-cmp-aud-check"><input type="checkbox" id="ghAudOnlyMe" value="onlyme"><i class="fas fa-lock"></i> Only me</label>'+
          '</div>'+
        '</div>'+
        '<div class="gh-cmp-aud-section">'+
          '<div class="gh-cmp-aud-hd"><i class="fas fa-venus-mars"></i> Gender filter</div>'+
          '<div class="gh-cmp-aud-radios">'+
            '<label class="gh-cmp-aud-radio"><input type="radio" name="ghAudGender" value="all" checked> All</label>'+
            '<label class="gh-cmp-aud-radio"><input type="radio" name="ghAudGender" value="male"> Men only</label>'+
            '<label class="gh-cmp-aud-radio"><input type="radio" name="ghAudGender" value="female"> Women only</label>'+
          '</div>'+
        '</div>'+
        '<div class="gh-cmp-aud-section">'+
          '<div class="gh-cmp-aud-hd"><i class="fas fa-calendar-alt"></i> Age filter</div>'+
          '<select class="gh-select" id="ghAudAgeMode" style="width:100%;font-size:.82rem">'+
            '<option value="all">All ages</option>'+
            '<option value="18plus">18+</option>'+
            '<option value="25to45">25–45</option>'+
            '<option value="custom">Custom range</option>'+
          '</select>'+
          '<div class="gh-cmp-aud-custom-age" id="ghAudAgeCustom">'+
            '<input type="number" class="gh-input" id="ghAudAgeMin" placeholder="Min" min="13" max="99">'+
            '<span style="flex-shrink:0;color:var(--gh-muted)">–</span>'+
            '<input type="number" class="gh-input" id="ghAudAgeMax" placeholder="Max" min="13" max="99">'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div class="gh-cmp-toolbar">'+
        '<button class="gh-cmp-tool" id="ghPickPostImage" type="button" title="Add photos"><i class="fas fa-image"></i><span>Photo</span></button>'+
        '<button class="gh-cmp-tool" id="ghTogglePoll" type="button" title="Create poll"><i class="fas fa-chart-bar"></i><span>Poll</span></button>'+
        '<button class="gh-cmp-tool" id="ghToggleFeeling" type="button" title="Feeling or activity"><i class="fas fa-face-smile"></i><span>Feeling</span></button>'+
        '<button class="gh-cmp-tool" id="ghToggleBg" type="button" title="Background color"><i class="fas fa-palette"></i><span>Background</span></button>'+
        '<button class="gh-cmp-tool" id="ghToggleEmoji" type="button" title="Emoji"><i class="fas fa-face-grin"></i><span>Emoji</span></button>'+
        '<button class="gh-cmp-tool" id="ghVoiceRecord" type="button" title="Record voice note"><i class="fas fa-microphone"></i><span>Voice</span></button>'+
        '<button class="gh-cmp-tool" id="ghToggleGif" type="button" title="Add GIF"><i class="fas fa-film"></i><span>GIF</span></button>'+
        '<button class="gh-cmp-tool" id="ghToggleCoAuthor" type="button" title="Tag co-author"><i class="fas fa-user-plus"></i><span>Tag</span></button>'+
        '<button class="gh-cmp-tool" id="ghToggleCategory" type="button" title="Post category"><i class="fas fa-tag"></i><span>Topic</span></button>'+
        '<button class="gh-cmp-tool" id="ghAiCaption" type="button" title="AI Caption suggestions"><i class="fas fa-wand-magic-sparkles"></i><span>AI</span></button>'+
        '<button class="gh-cmp-tool" id="ghToggleSchedule" type="button" title="Schedule post"><i class="fas fa-clock"></i><span>Schedule</span></button>'+
        '<button class="gh-cmp-tool" id="ghToggleFormat" type="button" title="Advanced post format"><i class="fas fa-newspaper"></i><span>Format</span></button>'+
      '</div>'+
      '<div id="ghFormatPanel" style="display:none;margin:8px 0;padding:10px;background:rgba(255,255,255,.04);border:1px solid var(--gh-border);border-radius:12px">'+
        '<div style="font-size:.82rem;font-weight:700;margin-bottom:8px;color:var(--gh-muted)">Post Format</div>'+
        '<div class="gh-format-types">'+
          '<button type="button" class="gh-fmt-btn" data-fmt="">📝 Regular</button>'+
          '<button type="button" class="gh-fmt-btn" data-fmt="article">📰 Article</button>'+
          '<button type="button" class="gh-fmt-btn" data-fmt="review">⭐ Review</button>'+
          '<button type="button" class="gh-fmt-btn" data-fmt="recipe">🍽️ Recipe</button>'+
          '<button type="button" class="gh-fmt-btn" data-fmt="job">💼 Job</button>'+
          '<button type="button" class="gh-fmt-btn" data-fmt="question">❓ Question</button>'+
          '<button type="button" class="gh-fmt-btn" data-fmt="tip">💡 Tip</button>'+
          '<button type="button" class="gh-fmt-btn" data-fmt="event">📅 Event</button>'+
          '<button type="button" class="gh-fmt-btn" data-fmt="quote">💬 Quote</button>'+
          '<button type="button" class="gh-fmt-btn" data-fmt="announcement">📢 Announcement</button>'+
        '</div>'+
        '<div id="ghFmtArticle" style="display:none;margin-top:10px">'+
          '<input class="gh-input" id="ghArtTitle" placeholder="Article title *" maxlength="120" style="margin-bottom:6px">'+
          '<input class="gh-input" id="ghArtSubtitle" placeholder="Subtitle (optional)" maxlength="200">'+
        '</div>'+
        '<div id="ghFmtReview" style="display:none;margin-top:10px">'+
          '<input class="gh-input" id="ghRevTarget" placeholder="What are you reviewing? (business, product…)" maxlength="80" style="margin-bottom:6px">'+
          '<div class="gh-star-row" id="ghRevStars" style="display:flex;gap:6px;font-size:1.5rem;margin-bottom:6px;cursor:pointer">'+
            [1,2,3,4,5].map(function(i){ return '<span data-star="'+i+'">☆</span>'; }).join('')+
          '</div>'+
          '<input type="hidden" id="ghRevScore" value="0">'+
        '</div>'+
        '<div id="ghFmtRecipe" style="display:none;margin-top:10px">'+
          '<input class="gh-input" id="ghRecName" placeholder="Recipe name *" maxlength="80" style="margin-bottom:6px">'+
          '<input class="gh-input" id="ghRecIngredients" placeholder="Ingredients (comma separated)" style="margin-bottom:6px">'+
          '<input class="gh-input" id="ghRecTime" placeholder="Prep time (e.g. 30 min)" maxlength="30">'+
        '</div>'+
        '<div id="ghFmtJob" style="display:none;margin-top:10px">'+
          '<input class="gh-input" id="ghJobTitle" placeholder="Job title *" maxlength="80" style="margin-bottom:6px">'+
          '<input class="gh-input" id="ghJobCompany" placeholder="Company name" maxlength="80" style="margin-bottom:6px">'+
          '<input class="gh-input" id="ghJobCity" placeholder="Location / City" maxlength="60" style="margin-bottom:6px">'+
          '<input class="gh-input" id="ghJobSalary" placeholder="Salary range (optional)" maxlength="60">'+
        '</div>'+
        '<div id="ghFmtQuestion" style="display:none;margin-top:10px">'+
          '<div style="font-size:.82rem;color:var(--gh-muted);padding:6px 0">❓ Write your question in the text area above. Followers can reply in comments.</div>'+
        '</div>'+
        '<div id="ghFmtTip" style="display:none;margin-top:10px">'+
          '<input class="gh-input" id="ghTipTitle" placeholder="Tip headline *" maxlength="100">'+
        '</div>'+
        '<div id="ghFmtEvent" style="display:none;margin-top:10px">'+
          '<input class="gh-input" id="ghEvtTitle" placeholder="Event name *" maxlength="100" style="margin-bottom:6px">'+
          '<input type="datetime-local" class="gh-input" id="ghEvtDate" style="margin-bottom:6px;font-size:.82rem">'+
          '<input class="gh-input" id="ghEvtPlace" placeholder="Venue / Location (optional)" maxlength="100">'+
        '</div>'+
        '<div id="ghFmtQuote" style="display:none;margin-top:10px">'+
          '<div style="font-size:.82rem;color:var(--gh-muted);padding:4px 0 6px">💬 Put the quote text in the main text area above.</div>'+
          '<input class="gh-input" id="ghQuoteAuthor" placeholder="Quote source / author (optional)" maxlength="80">'+
        '</div>'+
        '<div id="ghFmtAnnouncement" style="display:none;margin-top:10px">'+
          '<input class="gh-input" id="ghAnnTitle" placeholder="Announcement title *" maxlength="120">'+
        '</div>'+
      '</div>'+
      '<div class="gh-voice-panel" id="ghVoicePanel" style="display:none">'+
        '<div class="gh-voice-ui">'+
          '<div class="gh-voice-waves" id="ghVoiceWaves"><span></span><span></span><span></span><span></span><span></span></div>'+
          '<span class="gh-voice-timer" id="ghVoiceTimer">0:00</span>'+
          '<div class="gh-voice-btns">'+
            '<button type="button" class="gh-voice-rec-btn" id="ghVoiceStart"><i class="fas fa-microphone"></i> Start Recording</button>'+
            '<button type="button" class="gh-voice-stop-btn" id="ghVoiceStop" style="display:none"><i class="fas fa-stop"></i> Stop</button>'+
            '<button type="button" class="gh-voice-discard-btn" id="ghVoiceDiscard" style="display:none"><i class="fas fa-trash"></i></button>'+
          '</div>'+
        '</div>'+
        '<div class="gh-voice-preview" id="ghVoicePreview" style="display:none">'+
          '<div class="gh-voice-player">'+
            '<button type="button" class="gh-vp-play" id="ghVoicePlay"><i class="fas fa-play"></i></button>'+
            '<div class="gh-vp-bar"><div class="gh-vp-fill" id="ghVoiceFill"></div></div>'+
            '<span class="gh-vp-dur" id="ghVoiceDur">0:00</span>'+
          '</div>'+
          '<button type="button" class="gh-voice-discard-btn" id="ghVoiceRemove"><i class="fas fa-times"></i> Remove</button>'+
        '</div>'+
      '</div>'+
      '<div class="gh-gif-panel" id="ghGifPanel" style="display:none">'+
        '<div class="gh-gif-search-row"><input class="gh-input" id="ghGifSearch" placeholder="Search GIFs…" autocomplete="off"><button type="button" class="gh-btn sm ghost" id="ghClearGif" title="Remove GIF" style="display:none"><i class="fas fa-times"></i> Remove</button></div>'+
        '<div class="gh-gif-grid" id="ghGifGrid"><div class="gh-gif-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading trending…</div></div>'+
      '</div>'+
      '<div class="gh-gif-selected-preview" id="ghGifPreview" style="display:none">'+
        '<img id="ghGifPreviewImg" src="" alt="Selected GIF" style="max-height:180px;border-radius:10px;max-width:100%">'+
        '<button type="button" class="gh-gif-remove-btn" id="ghGifRemoveBtn" title="Remove GIF"><i class="fas fa-times"></i></button>'+
      '</div>'+
      '<div class="gh-ai-panel" id="ghAiPanel" style="display:none">'+
        '<div class="gh-ai-panel-header"><i class="fas fa-wand-magic-sparkles" style="color:#a78bfa"></i> AI Caption Suggestions</div>'+
        '<div id="ghAiSuggestions" class="gh-ai-suggestions"><div class="gh-ai-loading"><i class="fas fa-circle-notch fa-spin"></i> Generating…</div></div>'+
      '</div>'+
      '<div class="gh-category-panel" id="ghCategoryPanel" style="display:none">'+
        '<div class="gh-cat-label"><i class="fas fa-tag"></i> Choose a topic</div>'+
        '<div class="gh-cat-grid">'+
          ['Travel ✈️','Food 🍕','Business 💼','Nature 🌿','Tech 💻','Sport ⚽','Music 🎵','Art 🎨','News 📰','Humor 😂','Health 💊','Fashion 👗','Cars 🚗','Education 📚','Finance 💰','Gaming 🎮','Film 🎬','Pets 🐾','DIY 🔧','Events 📅','Real Estate 🏠','Politics 🏛️','Science 🔬','Religion ✝️','Relationships 💑'].map(function(c){
            var id=c.split(' ')[0].toLowerCase();
            return '<button type="button" class="gh-cat-btn" data-cat="'+id+'">'+c+'</button>';
          }).join('')+
        '</div>'+
      '</div>'+
      '<div id="ghCategoryChip" class="gh-cat-chip-wrap" style="display:none"><span class="gh-cat-chip" id="ghCatChipLabel"></span><button type="button" id="ghClearCategory" title="Remove">×</button></div>'+
      '<div class="gh-coauthor-panel" id="ghCoAuthorPanel" style="display:none">'+
        '<div class="gh-coa-search-row">'+
          '<i class="fas fa-user-plus" style="color:var(--gh-green,#2d6a4f);flex-shrink:0"></i>'+
          '<input class="gh-input" id="ghCoAuthorSearch" placeholder="Search people to tag…" autocomplete="off">'+
        '</div>'+
        '<div id="ghCoAuthorResults" class="gh-coa-results"></div>'+
        '<div id="ghCoAuthorChips" class="gh-coa-chips"></div>'+
      '</div>'+
      '<div class="gh-schedule-panel" id="ghSchedulePanel" style="display:none">'+
        '<i class="fas fa-calendar-alt" style="color:#f59e0b;flex-shrink:0"></i>'+
        '<input type="datetime-local" class="gh-input" id="ghScheduleAt" style="flex:1;font-size:.82rem">'+
        '<button type="button" class="gh-btn sm ghost" id="ghClearSchedule" title="Clear"><i class="fas fa-times"></i></button>'+
      '</div>'+
      '<div class="gh-schedule-indicator" id="ghScheduleIndicator" style="display:none">'+
        '<i class="fas fa-clock"></i><span id="ghScheduleLabel"></span>'+
      '</div>'+
      '<input type="file" id="ghPostFileInput" accept="image/*" multiple style="display:none">'+
      '<div class="gh-upload-progress" id="ghPostUploadBar" style="display:none"><div class="gh-upload-track"><div class="gh-upload-bar" id="ghPostUploadFill"></div></div><span id="ghPostUploadPct">0%</span></div>';

    var m = modal((typeof GHt==='function'?GHt('create_post'):'Create post'), body,
      '<button class="gh-btn ghost" data-close-modal>'+(typeof GHt==='function'?GHt('cancel'):'Cancel')+'</button><button class="gh-btn ghost" id="ghSaveDraft" title="Save draft"><i class="fas fa-floppy-disk"></i></button><button class="gh-btn" id="ghSubmitPost" disabled><i class="fas fa-paper-plane"></i> '+(typeof GHt==='function'?GHt('submit'):'Post')+'</button>',
      'ghPostModal');

    var pickedFiles=[], selectedFeeling='', selectedBg='', pollMode=false, feelingRowVisible=false, bgVisible=false, scheduledAt=null;
    var bgTextStyle={color:'#ffffff', size:'1.1rem', bold:false, italic:false};
    var _lpTimer=null, _lpUrl='';

    // ── Audience Picker ──────────────────────────────────────────────
    var _audPanel  = document.getElementById('ghAudiencePanel');
    var _audToggle = document.getElementById('ghAudienceToggle');
    var _audCaret  = document.getElementById('ghAudienceCaret');
    var _audLbl    = document.getElementById('ghAudienceLbl');
    var _audIcon   = document.getElementById('ghAudienceIcon');

    function _getAudienceTypes() {
      var onlyMeCb = document.getElementById('ghAudOnlyMe');
      if (onlyMeCb && onlyMeCb.checked) return ['onlyme'];
      var types = [];
      ['ghAudFriends','ghAudFollowers','ghAudStrangers'].forEach(function(id) {
        var cb = document.getElementById(id);
        if (cb && cb.checked) types.push(cb.value);
      });
      return types.length ? types : ['friends','followers','strangers'];
    }
    function _getAudienceGender() {
      var els = document.querySelectorAll('input[name="ghAudGender"]');
      for (var gi = 0; gi < els.length; gi++) { if (els[gi].checked) return els[gi].value; }
      return 'all';
    }
    function _getAudienceAgeData() {
      var mode = (document.getElementById('ghAudAgeMode') || {}).value || 'all';
      if (mode === '18plus') return { ageMin: 18, ageMax: null };
      if (mode === '25to45') return { ageMin: 25, ageMax: 45 };
      if (mode === 'custom') {
        var mn = document.getElementById('ghAudAgeMin');
        var mx = document.getElementById('ghAudAgeMax');
        return { ageMin: mn && mn.value ? Number(mn.value) : null, ageMax: mx && mx.value ? Number(mx.value) : null };
      }
      return { ageMin: null, ageMax: null };
    }
    function _getAudienceData() {
      var ad = _getAudienceAgeData();
      return { types: _getAudienceTypes(), gender: _getAudienceGender(), ageMin: ad.ageMin, ageMax: ad.ageMax };
    }
    function _getAudienceVis() {
      var types = _getAudienceTypes();
      if (types.indexOf('onlyme') > -1) return 'onlyme';
      if (types.indexOf('strangers') > -1 && types.indexOf('followers') > -1 && types.indexOf('friends') > -1) return 'public';
      if (types.length === 1 && types[0] === 'friends') return 'friends';
      if (types.length === 1 && types[0] === 'followers') return 'followers';
      return 'public';
    }
    function _syncAudienceLabel() {
      if (!_audLbl || !_audIcon) return;
      var types = _getAudienceTypes();
      var gender = _getAudienceGender();
      var ad = _getAudienceAgeData();
      var label, icon;
      if (types.indexOf('onlyme') > -1) { label = 'Only me'; icon = 'fas fa-lock'; }
      else if (types.length >= 3 || types.indexOf('strangers') > -1) { label = 'Everyone'; icon = 'fas fa-earth-europe'; }
      else if (types.length === 2) { label = types.map(function(t){ return t[0].toUpperCase()+t.slice(1); }).join(' & '); icon = 'fas fa-users'; }
      else if (types[0] === 'friends') { label = 'Friends'; icon = 'fas fa-user-group'; }
      else if (types[0] === 'followers') { label = 'Followers'; icon = 'fas fa-rss'; }
      else { label = 'Everyone'; icon = 'fas fa-earth-europe'; }
      var extras = [];
      if (gender === 'male') extras.push('♂');
      else if (gender === 'female') extras.push('♀');
      if (ad.ageMin && ad.ageMax) extras.push(ad.ageMin+'–'+ad.ageMax);
      else if (ad.ageMin) extras.push(ad.ageMin+'+');
      if (extras.length) label += ' · ' + extras.join(' ');
      _audLbl.textContent = label;
      _audIcon.className = icon + ' gh-aud-icon-i';
    }
    if (_audToggle) _audToggle.addEventListener('click', function() {
      var open = _audPanel && _audPanel.classList.contains('open');
      if (_audPanel) _audPanel.classList.toggle('open');
      if (_audCaret) _audCaret.style.transform = open ? '' : 'rotate(180deg)';
    });
    var _onlyMeCb = document.getElementById('ghAudOnlyMe');
    var _typeCbIds = ['ghAudFriends','ghAudFollowers','ghAudStrangers'];
    if (_onlyMeCb) _onlyMeCb.addEventListener('change', function() {
      var dis = this.checked;
      _typeCbIds.forEach(function(id) { var cb = document.getElementById(id); if (cb) { cb.disabled = dis; if (dis) cb.checked = false; } });
      _syncAudienceLabel();
    });
    _typeCbIds.forEach(function(id) {
      var cb = document.getElementById(id);
      if (cb) cb.addEventListener('change', function() {
        if (this.checked && _onlyMeCb) _onlyMeCb.checked = false;
        _syncAudienceLabel();
      });
    });
    document.querySelectorAll('input[name="ghAudGender"]').forEach(function(r) {
      r.addEventListener('change', _syncAudienceLabel);
    });
    var _audAgeMode   = document.getElementById('ghAudAgeMode');
    var _audAgeCustom = document.getElementById('ghAudAgeCustom');
    if (_audAgeMode) _audAgeMode.addEventListener('change', function() {
      if (_audAgeCustom) _audAgeCustom.style.display = this.value === 'custom' ? 'flex' : 'none';
      _syncAudienceLabel();
    });
    ['ghAudAgeMin','ghAudAgeMax'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.addEventListener('input', _syncAudienceLabel);
    });
    // Apply user's default post audience from privacy settings
    (function _applyComposerDefaults(){
      var defs = window._userPrivacyDefaults || {};
      var dAud = defs.defaultPostAudience || 'everyone';
      var dGen = defs.defaultPostGender || 'all';
      var dAge = defs.defaultPostAgeMode || 'all';
      var onlyMe = document.getElementById('ghAudOnlyMe');
      var friends = document.getElementById('ghAudFriends');
      var followers = document.getElementById('ghAudFollowers');
      var strangers = document.getElementById('ghAudStrangers');
      if (dAud === 'onlyme') {
        if (onlyMe) onlyMe.checked = true;
        [friends, followers, strangers].forEach(function(cb) { if (cb) { cb.checked = false; cb.disabled = true; } });
      } else {
        if (onlyMe) onlyMe.checked = false;
        if (friends) { friends.checked = dAud === 'everyone' || dAud === 'friends'; friends.disabled = false; }
        if (followers) { followers.checked = dAud === 'everyone' || dAud === 'followers'; followers.disabled = false; }
        if (strangers) { strangers.checked = dAud === 'everyone'; strangers.disabled = false; }
      }
      document.querySelectorAll('input[name="ghAudGender"]').forEach(function(r) { r.checked = r.value === dGen; });
      var ageEl = document.getElementById('ghAudAgeMode');
      if (ageEl) ageEl.value = dAge;
      _syncAudienceLabel();
    })();
    // ──────────────────────────────────────────────────────────────────

    var ta=$('#ghPostText');
    if(ta) _bindMentionAutocomplete(ta);

    // Character counter
    var _charUsedEl=document.getElementById('ghCharUsed');
    var _charCountEl=_charUsedEl&&_charUsedEl.parentElement;
    var _MAX_CHARS=2000;
    if(ta && _charUsedEl){
      function _updateCharCount(){
        var n=ta.value.length;
        _charUsedEl.textContent=n;
        var pct=n/_MAX_CHARS;
        _charUsedEl.style.color=pct>=1?'#ef4444':pct>=0.85?'#f59e0b':'';
        if(_charCountEl) _charCountEl.style.color=pct>=1?'#ef4444':pct>=0.85?'#f59e0b':'var(--gh-muted,#8aa69a)';
      }
      ta.addEventListener('input',_updateCharCount);
      _updateCharCount();
    }

    // Auto-focus
    if(ta) { ta.focus(); }

    // Phase 32: emoji picker for composer
    var _emojiToolBtn=document.getElementById('ghToggleEmoji');
    if(_emojiToolBtn && ta) _emojiToolBtn.addEventListener('click',function(){ _openEmojiPicker(ta,_emojiToolBtn); });

    // Phase 52: Voice Note recorder
    var voiceBlob=null, voiceUrl='', voiceAudio=null;
    var _voiceBtn=document.getElementById('ghVoiceRecord');
    var _voicePanel=document.getElementById('ghVoicePanel');
    var _voiceStart=document.getElementById('ghVoiceStart');
    var _voiceStop=document.getElementById('ghVoiceStop');
    var _voiceDiscard=document.getElementById('ghVoiceDiscard');
    var _voicePreview=document.getElementById('ghVoicePreview');
    var _voiceRemove=document.getElementById('ghVoiceRemove');
    var _voiceTimer=document.getElementById('ghVoiceTimer');
    var _voiceDur=document.getElementById('ghVoiceDur');
    var _voiceFill=document.getElementById('ghVoiceFill');
    var _voicePlayBtn=document.getElementById('ghVoicePlay');
    var _mediaRec=null, _recChunks=[], _recTimer=null, _recSec=0;
    var MAX_VOICE_SEC=60;
    function _fmtSec(s){ return Math.floor(s/60)+':'+(s%60<10?'0':'')+s%60; }
    function _stopTimer(){ clearInterval(_recTimer); _recTimer=null; }
    function _resetVoice(){
      voiceBlob=null; voiceUrl='';
      if(voiceAudio){ voiceAudio.pause(); voiceAudio=null; }
      if(_mediaRec&&_mediaRec.state!=='inactive'){ try{_mediaRec.stop();}catch(e){} }
      _stopTimer(); _recSec=0;
      if(_voiceTimer) _voiceTimer.textContent='0:00';
      if(_voiceStart){ _voiceStart.style.display=''; }
      if(_voiceStop) _voiceStop.style.display='none';
      if(_voiceDiscard) _voiceDiscard.style.display='none';
      if(_voicePreview) _voicePreview.style.display='none';
      document.getElementById('ghVoiceWaves') && document.getElementById('ghVoiceWaves').classList.remove('active');
      if(_voiceBtn) _voiceBtn.classList.remove('active');
      updateSubmit();
    }
    if(_voiceBtn) _voiceBtn.addEventListener('click',function(){
      if(!_voicePanel) return;
      var open=_voicePanel.style.display!=='none';
      _voicePanel.style.display=open?'none':'block';
    });
    if(_voiceStart) _voiceStart.addEventListener('click',function(){
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ toast(typeof GHt==='function'?GHt('mic_not_supported'):'Microphone not supported','error'); return; }
      navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
        _recChunks=[];
        _mediaRec=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':'audio/ogg'});
        _mediaRec.ondataavailable=function(e){ if(e.data&&e.data.size>0) _recChunks.push(e.data); };
        _mediaRec.onstop=function(){
          stream.getTracks().forEach(function(t){ t.stop(); });
          voiceBlob=new Blob(_recChunks,{type:_mediaRec.mimeType||'audio/webm'});
          voiceUrl=URL.createObjectURL(voiceBlob);
          voiceAudio=new Audio(voiceUrl);
          var dur=_recSec;
          if(_voiceDur) _voiceDur.textContent=_fmtSec(dur);
          if(_voicePreview) _voicePreview.style.display='block';
          var wavEl=document.getElementById('ghVoiceWaves'); if(wavEl) wavEl.classList.remove('active');
          if(_voiceStart) _voiceStart.style.display='none';
          if(_voiceStop) _voiceStop.style.display='none';
          if(_voiceDiscard) _voiceDiscard.style.display='none';
          if(_voiceBtn) _voiceBtn.classList.add('active');
          updateSubmit();
        };
        _mediaRec.start(250);
        if(_voiceStart) _voiceStart.style.display='none';
        if(_voiceStop) _voiceStop.style.display='';
        if(_voiceDiscard) _voiceDiscard.style.display='';
        var wavEl=document.getElementById('ghVoiceWaves'); if(wavEl) wavEl.classList.add('active');
        _recSec=0; if(_voiceTimer) _voiceTimer.textContent='0:00';
        _recTimer=setInterval(function(){
          _recSec++;
          if(_voiceTimer) _voiceTimer.textContent=_fmtSec(_recSec);
          if(_recSec>=MAX_VOICE_SEC&&_mediaRec&&_mediaRec.state==='recording'){ _mediaRec.stop(); _stopTimer(); toast(typeof GHt==='function'?GHt('voice_max_60'):'Max 60s reached'); }
        },1000);
      }).catch(function(){ toast(typeof GHt==='function'?GHt('mic_denied'):'Microphone access denied','error'); });
    });
    if(_voiceStop) _voiceStop.addEventListener('click',function(){ if(_mediaRec&&_mediaRec.state==='recording'){ _mediaRec.stop(); _stopTimer(); } });
    if(_voiceDiscard) _voiceDiscard.addEventListener('click',function(){ _resetVoice(); });
    if(_voiceRemove) _voiceRemove.addEventListener('click',function(){ _resetVoice(); });
    if(_voicePlayBtn) _voicePlayBtn.addEventListener('click',function(){
      if(!voiceAudio) return;
      if(voiceAudio.paused){ voiceAudio.play(); _voicePlayBtn.innerHTML='<i class="fas fa-pause"></i>'; }
      else { voiceAudio.pause(); _voicePlayBtn.innerHTML='<i class="fas fa-play"></i>'; }
      voiceAudio.ontimeupdate=function(){
        var pct=voiceAudio.duration?voiceAudio.currentTime/voiceAudio.duration*100:0;
        if(_voiceFill) _voiceFill.style.width=pct+'%';
      };
      voiceAudio.onended=function(){ _voicePlayBtn.innerHTML='<i class="fas fa-play"></i>'; if(_voiceFill) _voiceFill.style.width='0%'; };
    });

    // Phase 43: GIF picker
    var pickedGifUrl='';
    var _gifBtn=document.getElementById('ghToggleGif');
    var _gifPanel=document.getElementById('ghGifPanel');
    var _gifSearch=document.getElementById('ghGifSearch');
    var _gifGrid=document.getElementById('ghGifGrid');
    var _gifPreview=document.getElementById('ghGifPreview');
    var _gifPreviewImg=document.getElementById('ghGifPreviewImg');
    var _gifRemoveBtn=document.getElementById('ghGifRemoveBtn');
    var _gifTimer=null;
    var _TENOR_KEY='AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCY4';
    function _loadGifs(q){
      if(!_gifGrid) return;
      _gifGrid.innerHTML='<div class="gh-gif-loading"><i class="fas fa-circle-notch fa-spin"></i></div>';
      var url=q
        ?'https://tenor.googleapis.com/v2/search?q='+encodeURIComponent(q)+'&key='+_TENOR_KEY+'&limit=24&media_filter=gif&contentfilter=high&locale=en_US'
        :'https://tenor.googleapis.com/v2/featured?key='+_TENOR_KEY+'&limit=24&media_filter=gif&contentfilter=high&locale=en_US';
      fetch(url).then(function(r){return r.json();}).then(function(data){
        var gifs=(data.results||[]);
        if(!gifs.length){_gifGrid.innerHTML='<div class="gh-gif-loading">No GIFs found</div>';return;}
        _gifGrid.innerHTML=gifs.map(function(g){
          var mf=g.media_formats||{};
          var preview=(mf.tinygif&&mf.tinygif.url)||(mf.gif&&mf.gif.url)||'';
          var full=(mf.gif&&mf.gif.url)||preview;
          if(!preview) return '';
          return '<button type="button" class="gh-gif-item" data-gif-url="'+esc(full)+'" data-gif-preview="'+esc(preview)+'"><img src="'+esc(preview)+'" alt="'+esc(g.content_description||'')+'" loading="lazy"></button>';
        }).filter(Boolean).join('');
        if(!_gifGrid.children.length) _gifGrid.innerHTML='<div class="gh-gif-loading">No GIFs found</div>';
      }).catch(function(){_gifGrid.innerHTML='<div class="gh-gif-loading" style="color:var(--gh-muted)">Could not load GIFs</div>';});
    }
    function _selectGif(url){
      pickedGifUrl=url;
      if(_gifPreviewImg) _gifPreviewImg.src=url;
      if(_gifPreview) _gifPreview.style.display='block';
      if(_gifPanel) _gifPanel.style.display='none';
      if(_gifBtn) _gifBtn.classList.add('active');
      if(document.getElementById('ghClearGif')) document.getElementById('ghClearGif').style.display='';
      updateSubmit();
    }
    function _clearGif(){
      pickedGifUrl='';
      if(_gifPreviewImg) _gifPreviewImg.src='';
      if(_gifPreview) _gifPreview.style.display='none';
      if(_gifBtn) _gifBtn.classList.remove('active');
      if(document.getElementById('ghClearGif')) document.getElementById('ghClearGif').style.display='none';
      updateSubmit();
    }
    if(_gifBtn) _gifBtn.addEventListener('click',function(){
      if(!_gifPanel) return;
      var open=_gifPanel.style.display!=='none';
      _gifPanel.style.display=open?'none':'block';
      if(!open){ _loadGifs(''); if(_gifSearch) _gifSearch.focus(); }
    });
    if(_gifSearch) _gifSearch.addEventListener('input',function(){
      clearTimeout(_gifTimer);
      var q=this.value.trim();
      _gifTimer=setTimeout(function(){_loadGifs(q);},400);
    });
    if(_gifGrid) _gifGrid.addEventListener('click',function(e){
      var btn=e.target.closest('.gh-gif-item'); if(!btn) return;
      _selectGif(btn.dataset.gifUrl||'');
    });
    if(_gifRemoveBtn) _gifRemoveBtn.addEventListener('click',function(){ _clearGif(); });
    if(document.getElementById('ghClearGif')) document.getElementById('ghClearGif').addEventListener('click',function(){ _clearGif(); });

    // Phase 45: Co-Authors
    var coAuthors=[]; // [{uid,name,avatar,slug}]
    var _coaBtn=document.getElementById('ghToggleCoAuthor');
    var _coaPanel=document.getElementById('ghCoAuthorPanel');
    var _coaSearch=document.getElementById('ghCoAuthorSearch');
    var _coaResults=document.getElementById('ghCoAuthorResults');
    var _coaChips=document.getElementById('ghCoAuthorChips');
    var _coaTimer=null;
    function _renderCoaChips(){
      if(!_coaChips) return;
      if(!coAuthors.length){ _coaChips.innerHTML=''; return; }
      _coaChips.innerHTML=coAuthors.map(function(u,i){
        return '<span class="gh-coa-chip">'+
          (u.avatar?'<img src="'+esc(u.avatar)+'" alt="">':'<span class="gh-coa-chip-init">'+esc(initials(u.name))+'</span>')+
          '<span>'+esc(u.name)+'</span>'+
          '<button type="button" data-coa-remove="'+i+'" title="Remove">×</button>'+
        '</span>';
      }).join('');
      _coaChips.addEventListener('click',function(e){
        var rb=e.target.closest('[data-coa-remove]'); if(!rb) return;
        coAuthors.splice(Number(rb.dataset.coaRemove),1);
        _renderCoaChips();
        if(!coAuthors.length && _coaBtn) _coaBtn.classList.remove('active');
      });
    }
    if(_coaBtn) _coaBtn.addEventListener('click',function(){
      if(!_coaPanel) return;
      var open=_coaPanel.style.display!=='none';
      _coaPanel.style.display=open?'none':'block';
      if(!open && _coaSearch) _coaSearch.focus();
    });
    if(_coaSearch) _coaSearch.addEventListener('input',function(){
      clearTimeout(_coaTimer);
      var q=this.value.trim(); if(q.length<1){ if(_coaResults) _coaResults.innerHTML=''; return; }
      _coaTimer=setTimeout(function(){
        if(!GS()||!GS().searchFirestore) return;
        GS().searchFirestore(q,function(res){
          var users=((res&&res.users)||[]).slice(0,6);
          if(!_coaResults) return;
          if(!users.length){ _coaResults.innerHTML='<div class="gh-coa-no-result">No users found</div>'; return; }
          _coaResults.innerHTML=users.map(function(u){
            var slug=u.username||(u.displayName||u.fullName||'').replace(/\s+/g,'').toLowerCase();
            var nm=u.fullName||u.displayName||u.name||'User';
            var av=u.photoURL||u.avatar||'';
            var uid2=u.id||u.uid||'';
            return '<button type="button" class="gh-coa-opt" data-uid="'+esc(uid2)+'" data-name="'+esc(nm)+'" data-avatar="'+esc(av)+'" data-slug="'+esc(slug)+'">'+
              (av?'<img src="'+esc(av)+'" alt="" onerror="this.onerror=null;this.remove()">':'<span class="gh-coa-opt-init">'+esc(initials(nm))+'</span>')+
              '<span>'+esc(nm)+'</span>'+
              (slug?'<span class="gh-muted" style="font-size:.72rem">@'+esc(slug)+'</span>':'')+
            '</button>';
          }).join('');
          _coaResults.addEventListener('click',function(e2){
            var ob=e2.target.closest('.gh-coa-opt'); if(!ob) return;
            var already=coAuthors.some(function(x){ return x.uid===ob.dataset.uid; });
            if(!already && coAuthors.length<3) coAuthors.push({uid:ob.dataset.uid,name:ob.dataset.name,avatar:ob.dataset.avatar,slug:ob.dataset.slug});
            _renderCoaChips();
            if(coAuthors.length && _coaBtn) _coaBtn.classList.add('active');
            if(_coaSearch) _coaSearch.value='';
            if(_coaResults) _coaResults.innerHTML='';
            if(_coaPanel) _coaPanel.style.display='none';
          });
        });
      },300);
    });

    // Phase 46: Category
    var selectedCategory='';
    var _catBtn=document.getElementById('ghToggleCategory');
    var _catPanel=document.getElementById('ghCategoryPanel');
    var _catChipWrap=document.getElementById('ghCategoryChip');
    var _catChipLabel=document.getElementById('ghCatChipLabel');
    var _clearCat=document.getElementById('ghClearCategory');
    function _setCategory(cat){
      selectedCategory=cat;
      if(_catChipLabel) _catChipLabel.textContent=cat;
      if(_catChipWrap) _catChipWrap.style.display=cat?'flex':'none';
      if(_catBtn) _catBtn.classList.toggle('active',!!cat);
      if(_catPanel) _catPanel.style.display='none';
    }
    if(_catBtn) _catBtn.addEventListener('click',function(){
      if(!_catPanel) return;
      var open=_catPanel.style.display!=='none';
      _catPanel.style.display=open?'none':'block';
    });
    if(_catPanel) _catPanel.addEventListener('click',function(e){
      var b=e.target.closest('.gh-cat-btn'); if(!b) return;
      _setCategory(b.dataset.cat===selectedCategory?'':b.dataset.cat);
      // Highlight selected
      _catPanel.querySelectorAll('.gh-cat-btn').forEach(function(btn){ btn.classList.toggle('active',btn.dataset.cat===selectedCategory); });
    });
    if(_clearCat) _clearCat.addEventListener('click',function(){ _setCategory(''); });

    // Phase 50: AI Caption
    var _aiBtn=document.getElementById('ghAiCaption');
    var _aiPanel=document.getElementById('ghAiPanel');
    var _aiSugg=document.getElementById('ghAiSuggestions');
    var _AI_CAPTIONS={
      travel:['კვლავ გზაში ✈️ სამყარო ველოდება ჩვენს აღმოჩენას','ყოველი ახალი ადგილი — ახალი ამბავი 🌍','მგზავრობა ეს ცხოვრება. ყველა დანარჩენი უბრალოდ დეტალებია 🗺️'],
      food:['ჭამა ეს ხელოვნებაა, მხოლოდ სრულყოფილი ინგრედიენტებია საჭირო 🍽️','გემო, რომელიც სიტყვებით ვერ გამოიხატება 😍','ყველაზე კარგი საუბრები — საჭმლის გვერდით ხდება ☕'],
      business:['წარმატება ეს სამსახური, არა საიდუმლო 💼','ყოველი დიდი სტარტაპი ერთი იდეიდან დაიწყო 🚀','ბიზნესი = ადამიანები. ყველა სხვა — სტრატეგია 🎯'],
      nature:['ბუნება ყველაზე კარგი არქიტექტორია 🌿','ამ სიჩუმეში მოვისმინე ყველაზე ლამაზი მუსიკა 🌲','ყოველი გამთენია ახალი შანსია 🌅'],
      tech:['კოდი ეს ახალი ენაა — ვისაუბრებ ყველასთვის 💻','ტექნოლოგია ცვლის სამყაროს, ჩვენ ვცვლით ტექნოლოგიას ⚡','ინოვაცია — ბუნდოვანი მომავლის ერთადერთი სარკმელი 🔭'],
      sport:['ლიმიტი მხოლოდ შენს თავშია 💪','ყოველი ვარჯიში — ნაბიჯი მიზნისკენ 🏆','სიმძიმე, ოფლი, გამარჯვება. ეს ჩემი ფორმულაა ⚽'],
      music:['მუსიკა ეს სული, რომელიც ყოველთვის ესმის 🎵','ამ სიმღერაში ჩემი მთელი ამბავია 🎸','ახლა ვუსმენ — ყველა სხვა ითვლება 🎶'],
      art:['ხელოვნება = გამბედაობა + სიყვარული 🎨','ეს ნახატი 1000 სიტყვად ლაპარაკობს ✨','შემოქმედება ჩვენი ენაა, ვინც ვისი გამოხატვა ვეცდება 🖌️'],
      news:['რეალობა ხანდახან ყველა ფიქციიდან სიურელია 📰','ვამახინჯებ? ვჩვენ? ვახმახინჯებ ▸ ვიდეო ბმული ბიოში','დღეს ყველა ამბობს — მხოლოდ ფაქტებს ვიტყვი 📢'],
      humor:['ჩემი ჰიუმორი — ჩემი სუფთა ოქრო 😂','ცხოვრება ძალიან მოკლეა სერიოზულობისთვის 🤣','ვინც არ სეირი — ლინქი ბიოში 😏']
    };
    var _AI_DEFAULT=['GeoHub-ზე ყოველი მომენტი ისტორიაა ✨','გაიზიარე შენი სამყარო 🌍','დღეს ეს, ხვალ — რა მოვა 🔥'];
    var _AI_GEO=['დღეს საქართველოში ყველაზე ლამაზ ადგილას ვარ 🇬🇪','ჩვენი ქვეყნის ყოველი კუთხე — ულამაზესი ამბავია 🏔️','GeoHub — ქართულ სიამაყეს ვუზიარებ სამყაროს 🌟'];
    function _genAiCaptions(){
      var cat=selectedCategory||'';
      var feel=selectedFeeling||'';
      var txt=(ta&&ta.value)||'';
      var kaCount=(txt.match(/[ა-ჿ]/g)||[]).length;
      var isGeoText=txt.length>0&&kaCount/txt.length>0.3;
      var pool=_AI_CAPTIONS[cat]||(isGeoText?_AI_GEO:_AI_DEFAULT);
      // Shuffle + take 3
      var shuffled=pool.slice().sort(function(){return Math.random()-.5;});
      return shuffled.slice(0,3);
    }
    if(_aiBtn) _aiBtn.addEventListener('click',function(){
      if(!_aiPanel) return;
      var open=_aiPanel.style.display!=='none';
      _aiPanel.style.display=open?'none':'block';
      _aiBtn.classList.toggle('active',!open);
      if(open) return;
      if(_aiSugg) _aiSugg.innerHTML='<div class="gh-ai-loading"><i class="fas fa-circle-notch fa-spin"></i> Generating…</div>';
      setTimeout(function(){
        var captions=_genAiCaptions();
        if(!_aiSugg) return;
        _aiSugg.innerHTML=captions.map(function(c,i){
          return '<button type="button" class="gh-ai-opt" data-ai-caption="'+esc(c)+'">'+
            '<span class="gh-ai-num">'+(i+1)+'</span>'+
            '<span>'+esc(c)+'</span>'+
            '<span class="gh-ai-use">Use</span>'+
          '</button>';
        }).join('');
        _aiSugg.addEventListener('click',function(e){
          var btn=e.target.closest('.gh-ai-opt'); if(!btn) return;
          var cap=btn.dataset.aiCaption||'';
          if(ta){
            var v=ta.value; var cur=ta.selectionStart||v.length;
            ta.value=(v?v+'\n':'')+cap;
            ta.selectionStart=ta.selectionEnd=ta.value.length;
            ta.dispatchEvent(new Event('input',{bubbles:true}));
          }
          _aiPanel.style.display='none';
          _aiBtn.classList.remove('active');
          ta&&ta.focus();
          toast(typeof GHt==='function'?GHt('caption_added'):'✨ Caption added!');
        });
      },600);
    });

    // Phase 39: Schedule
    function _updateScheduleIndicator(){
      var ind=$('#ghScheduleIndicator'), lbl=$('#ghScheduleLabel'), sb=$('#ghSubmitPost');
      if(scheduledAt && scheduledAt>new Date()){
        var fmt=scheduledAt.toLocaleDateString('ka-GE',{month:'short',day:'numeric'})+' '+scheduledAt.toLocaleTimeString('ka-GE',{hour:'2-digit',minute:'2-digit'});
        if(ind) ind.style.display='flex';
        if(lbl) lbl.textContent=(typeof GHt==='function'?GHt('scheduled_for'):'Scheduled for ')+fmt;
        if(sb&&!sb.disabled) sb.innerHTML='<i class="fas fa-clock"></i> Schedule';
      } else {
        scheduledAt=null;
        if(ind) ind.style.display='none';
        if(sb&&!sb.disabled) sb.innerHTML='<i class="fas fa-paper-plane"></i> Post';
      }
    }
    var _schedBtn=document.getElementById('ghToggleSchedule');
    if(_schedBtn) _schedBtn.addEventListener('click',function(){
      var panel=$('#ghSchedulePanel');
      var visible=panel&&panel.style.display!=='none';
      if(visible){ panel.style.display='none'; this.classList.remove('active'); scheduledAt=null; _updateScheduleIndicator(); return; }
      if(panel) panel.style.display='flex';
      this.classList.add('active');
      // Default: 1 hour from now, rounded to nearest 15min
      var d=new Date(Date.now()+3600000); d.setMinutes(Math.ceil(d.getMinutes()/15)*15,0,0);
      var local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
      var inp=$('#ghScheduleAt'); if(inp){ inp.value=local; inp.min=new Date(Date.now()+120000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16); }
      scheduledAt=d; _updateScheduleIndicator();
    });
    var _schedInput=document.getElementById('ghScheduleAt');
    if(_schedInput) _schedInput.addEventListener('change',function(){
      scheduledAt=this.value?new Date(this.value):null; _updateScheduleIndicator();
    });
    var _clearSched=document.getElementById('ghClearSchedule');
    if(_clearSched) _clearSched.addEventListener('click',function(){
      scheduledAt=null;
      var panel=$('#ghSchedulePanel'); if(panel) panel.style.display='none';
      var sb=$('#ghToggleSchedule'); if(sb) sb.classList.remove('active');
      _updateScheduleIndicator();
    });

    // Phase 69: Advanced Format panel toggle + star rating
    var _fmtToggle=document.getElementById('ghToggleFormat');
    var _fmtPanel=document.getElementById('ghFormatPanel');
    if(_fmtToggle&&_fmtPanel){
      _fmtToggle.onclick=function(){
        var open=_fmtPanel.style.display!=='none';
        _fmtPanel.style.display=open?'none':'block';
        _fmtToggle.classList.toggle('active',!open);
      };
      _fmtPanel.querySelectorAll('.gh-fmt-btn').forEach(function(btn){
        btn.onclick=function(){
          _fmtPanel.querySelectorAll('.gh-fmt-btn').forEach(function(b){ b.classList.remove('active'); });
          btn.classList.add('active');
          var fmt=btn.dataset.fmt||'';
          ['ghFmtArticle','ghFmtReview','ghFmtRecipe','ghFmtJob','ghFmtQuestion','ghFmtTip','ghFmtEvent','ghFmtQuote','ghFmtAnnouncement'].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display='none'; });
          if(fmt==='article') { var el=document.getElementById('ghFmtArticle'); if(el) el.style.display='block'; }
          else if(fmt==='review') { var el=document.getElementById('ghFmtReview'); if(el) el.style.display='block'; }
          else if(fmt==='recipe') { var el=document.getElementById('ghFmtRecipe'); if(el) el.style.display='block'; }
          else if(fmt==='job') { var el=document.getElementById('ghFmtJob'); if(el) el.style.display='block'; }
          else if(fmt==='question') { var el=document.getElementById('ghFmtQuestion'); if(el) el.style.display='block'; }
          else if(fmt==='tip') { var el=document.getElementById('ghFmtTip'); if(el) el.style.display='block'; }
          else if(fmt==='event') { var el=document.getElementById('ghFmtEvent'); if(el) el.style.display='block'; }
          else if(fmt==='quote') { var el=document.getElementById('ghFmtQuote'); if(el) el.style.display='block'; }
          else if(fmt==='announcement') { var el=document.getElementById('ghFmtAnnouncement'); if(el) el.style.display='block'; }
          // 'question' and '' need no extra fields
        };
      });
      // Star rating
      var starsEl=document.getElementById('ghRevStars');
      var scoreEl=document.getElementById('ghRevScore');
      if(starsEl&&scoreEl){
        starsEl.querySelectorAll('[data-star]').forEach(function(star){
          star.onclick=function(){
            var val=Number(star.dataset.star);
            scoreEl.value=val;
            starsEl.querySelectorAll('[data-star]').forEach(function(s){ s.textContent=Number(s.dataset.star)<=val?'⭐':'☆'; });
          };
          star.onmouseover=function(){
            var val=Number(star.dataset.star);
            starsEl.querySelectorAll('[data-star]').forEach(function(s){ s.textContent=Number(s.dataset.star)<=val?'⭐':'☆'; });
          };
          star.onmouseout=function(){
            var cur=Number(scoreEl.value||0);
            starsEl.querySelectorAll('[data-star]').forEach(function(s){ s.textContent=Number(s.dataset.star)<=cur?'⭐':'☆'; });
          };
        });
      }
    }

    // Phase 36: Draft save/restore
    var _DRAFT_KEY='gh_draft';
    var _saveDraftBtn=document.getElementById('ghSaveDraft');
    if(_saveDraftBtn) _saveDraftBtn.addEventListener('click',function(){
      var txt=ta?ta.value:'';
      if(txt.trim()){ try{ localStorage.setItem(_DRAFT_KEY, JSON.stringify({ text:txt, feeling:selectedFeeling, visibility:_getAudienceVis(), savedAt:Date.now() })); }catch(e){} }
      toast(typeof GHt==='function'?GHt('draft_saved'):'✏️ Draft saved');
      var m2=$('#ghPostModal'); if(m2) m2.remove();
    });
    // Auto-save on input (debounced 1.5s)
    var _draftAutoTimer=null;
    if(ta) ta.addEventListener('input',function(){
      clearTimeout(_draftAutoTimer);
      _draftAutoTimer=setTimeout(function(){
        var txt2=ta.value||'';
        if(!txt2.trim()){ try{ localStorage.removeItem(_DRAFT_KEY); }catch(e){} return; }
        try{ localStorage.setItem(_DRAFT_KEY, JSON.stringify({ text:txt2, feeling:selectedFeeling, visibility:_getAudienceVis(), savedAt:Date.now() })); }catch(e){}
      },1500);
    });
    // Restore existing draft
    try{
      var _draftRaw=localStorage.getItem(_DRAFT_KEY);
      if(_draftRaw && !pollMode){
        var _draft=JSON.parse(_draftRaw);
        if(_draft&&_draft.text&&_draft.text.trim()){
          var _draftAge=Math.round((Date.now()-(_draft.savedAt||0))/60000);
          var _draftAgeStr=_draftAge<2?'just now':(_draftAge<60?_draftAge+'m ago':Math.round(_draftAge/60)+'h ago');
          var _db=document.createElement('div');
          _db.className='gh-draft-banner';
          _db.innerHTML=
            '<i class="fas fa-floppy-disk" style="color:#10b981"></i>'+
            '<span>Draft from '+esc(_draftAgeStr)+'</span>'+
            '<button class="gh-btn sm" id="ghRestoreDraft">Restore</button>'+
            '<button class="gh-draft-discard" id="ghDiscardDraft" title="Discard draft"><i class="fas fa-times"></i></button>';
          var _mbody=document.querySelector('#ghPostModal .gh-modal-body');
          if(_mbody) _mbody.insertBefore(_db,_mbody.firstChild);
          var _rBtn=document.getElementById('ghRestoreDraft');
          var _xBtn=document.getElementById('ghDiscardDraft');
          if(_rBtn) _rBtn.onclick=function(){
            if(ta) ta.value=_draft.text||'';
            if(_draft.feeling){ selectedFeeling=_draft.feeling; var sfe=$('#ghSelectedFeeling'); if(sfe){ sfe.textContent=_draft.feeling; sfe.style.display='block'; } }
            // Restore audience from draft visibility (legacy compat)
            if(_draft.visibility === 'onlyme') {
              var _dmo=document.getElementById('ghAudOnlyMe'); if(_dmo){_dmo.checked=true;_dmo.dispatchEvent(new Event('change'));}
            } else if(_draft.visibility === 'followers') {
              var _dmf=document.getElementById('ghAudFriends'); if(_dmf) _dmf.checked=false;
              var _dms=document.getElementById('ghAudStrangers'); if(_dms) _dms.checked=false;
            } else if(_draft.visibility === 'friends') {
              var _dmfl=document.getElementById('ghAudFollowers'); if(_dmfl) _dmfl.checked=false;
              var _dms2=document.getElementById('ghAudStrangers'); if(_dms2) _dms2.checked=false;
            }
            _syncAudienceLabel();
            _db.remove(); updateSubmit();
            if(ta){ ta.focus(); ta.dispatchEvent(new Event('input',{bubbles:true})); }
          };
          if(_xBtn) _xBtn.onclick=function(){
            try{ localStorage.removeItem(_DRAFT_KEY); }catch(e){}
            _db.remove();
          };
        }
      }
    }catch(e){}

    // Validate: enable/disable Post button
    function updateSubmit(){
      var btn=$('#ghSubmitPost'); if(!btn) return;
      var hasText = pollMode
        ? !!(($('#ghPollQuestion')||{}).value||'').trim()
        : !!(ta && ta.value.trim());
      btn.disabled = !(hasText || pickedFiles.length || pickedGifUrl || voiceBlob);
    }
    if(ta) ta.addEventListener('input', function(){
      updateSubmit();
      clearTimeout(_lpTimer);
      _lpTimer=setTimeout(function(){ detectAndLoadLinkPreview(ta.value); }, 700);
    });
    var pqEl=$('#ghPollQuestion');
    if(pqEl) pqEl.addEventListener('input', updateSubmit);

    // Phase 36: auto-save draft on close instead of confirm-discard
    m.addEventListener('click', function(e){
      if(e.target===m || e.target.closest('[data-close-modal]')){
        var textVal = pollMode ? '' : (ta ? ta.value : '');
        if(textVal.trim()){
          try{ localStorage.setItem('gh_draft', JSON.stringify({ text:textVal, feeling:selectedFeeling, visibility:_getAudienceVis(), savedAt:Date.now() })); }catch(_ec){}
          setTimeout(function(){ toast('✏️ Draft saved'); },100);
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

    var _feelBtn=document.getElementById('ghToggleFeeling');
    var _feelRow=document.getElementById('ghFeelingRow');
    if(_feelRow) _feelRow.style.display='none';
    if(_feelBtn) _feelBtn.addEventListener('click',function(){
      feelingRowVisible=!feelingRowVisible;
      if(_feelRow) _feelRow.style.display=feelingRowVisible?'flex':'none';
      _feelBtn.classList.toggle('active',feelingRowVisible);
    });

    $('#ghToggleBg').onclick=function(){
      bgVisible=!bgVisible;
      $('#ghBgPicker').style.display=bgVisible?'flex':'none';
      if(!bgVisible){ selectedBg=''; var _tp=$('#ghBgTextStyle'); if(_tp) _tp.style.display='none'; _applyBgPreview(''); }
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
    var _bgPreviewWrap=document.getElementById('ghRegularComposer');
    function _applyBgPreview(grad){
      if(!ta) return;
      if(grad){
        ta.style.background=grad;
        ta.style.color=bgTextStyle.color||'#fff';
        ta.style.borderRadius='14px';
        ta.style.textAlign='center';
        ta.style.fontWeight=bgTextStyle.bold?'900':'700';
        ta.style.fontStyle=bgTextStyle.italic?'italic':'normal';
        ta.style.fontSize=bgTextStyle.size||'1.1rem';
        ta.style.minHeight='140px';
      } else {
        ta.style.background='';
        ta.style.color='';
        ta.style.borderRadius='';
        ta.style.textAlign='';
        ta.style.fontWeight='';
        ta.style.fontStyle='';
        ta.style.fontSize='';
        ta.style.minHeight='';
      }
    }
    if(bgPicker) bgPicker.addEventListener('click',function(e){
      var sw=e.target.closest('[data-bg-gradient]'); if(!sw) return;
      selectedBg=sw.dataset.bgGradient;
      bgPicker.querySelectorAll('.gh-bg-swatch').forEach(function(b){ b.classList.toggle('active', b===sw); });
      var tsPanel=$('#ghBgTextStyle');
      if(tsPanel) tsPanel.style.display=selectedBg?'block':'none';
      _applyBgPreview(selectedBg);
    });
    var _bgtsPanel=$('#ghBgTextStyle');
    if(_bgtsPanel){
      _bgtsPanel.addEventListener('click',function(e){
        var cb=e.target.closest('.gh-bgts-color');
        if(cb){ bgTextStyle.color=cb.dataset.textColor||'#fff'; _bgtsPanel.querySelectorAll('.gh-bgts-color').forEach(function(b){b.style.border=b===cb?'2px solid var(--gh-green)':'2px solid transparent';}); _applyBgPreview(selectedBg); }
        var sb=e.target.closest('.gh-bgts-size');
        if(sb){ bgTextStyle.size=sb.dataset.textSize||'1.1rem'; _bgtsPanel.querySelectorAll('.gh-bgts-size').forEach(function(b){b.style.border=b===sb?'1px solid var(--gh-green)':'1px solid var(--gh-border)';b.style.color=b===sb?'var(--gh-green)':'var(--gh-muted)';b.style.background=b===sb?'rgba(16,185,129,.1)':'transparent';}); _applyBgPreview(selectedBg); }
        var stb=e.target.closest('.gh-bgts-style');
        if(stb){ bgTextStyle.bold=stb.dataset.textBold==='1'; bgTextStyle.italic=stb.dataset.textItalic==='1'; _bgtsPanel.querySelectorAll('.gh-bgts-style').forEach(function(b){b.style.border=b===stb?'1px solid var(--gh-green)':'1px solid var(--gh-border)';b.style.color=b===stb?'var(--gh-green)':'var(--gh-muted)';b.style.background=b===stb?'rgba(16,185,129,.1)':'transparent';}); _applyBgPreview(selectedBg); }
      });
    }

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
        if(!question) return toast(typeof GHt==='function'?GHt('post_poll_q_req'):'Poll needs a question','error');
        if(opts.length<2) return toast(typeof GHt==='function'?GHt('post_poll_opts'):'Add at least 2 poll options','error');
        var durDays=Number(($('#ghPollDuration')||{}).value||3);
        var endsAt=new Date(Date.now()+durDays*86400000);
        var pollPayload=Object.assign({ type:'poll', poll:{question:question,options:opts,endsAt:endsAt,totalVotes:0}, visibility:_getAudienceVis(), audience:_getAudienceData() }, extra||{});
        submitBtn.disabled=true;
        submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Posting…';
        GS().createPost(question, '', function(){ var modal=$('#ghPostModal'); if(modal) modal.remove(); try{localStorage.removeItem('gh_draft');}catch(_e){} }, pollPayload);
        return;
      }

      var txt=(ta&&ta.value)||'';
      if(!txt.trim() && !pickedFiles.length && !pickedGifUrl && !voiceBlob) return toast(typeof GHt==='function'?GHt('post_content_req'):'Write something or add a photo/GIF/voice','error');

      // Phase 69: collect advanced format data
      var _fmtData=null, _activeFmt=document.getElementById('ghFormatPanel')&&document.querySelector('.gh-fmt-btn.active');
      var _fmtKey=_activeFmt?(_activeFmt.dataset.fmt||''):'';
      if(_fmtKey==='article'){
        var _artT=($('#ghArtTitle')||{}).value||''; if(!_artT.trim()) return toast(typeof GHt==='function'?GHt('post_article_req'):'Add article title','error');
        _fmtData={format:'article',articleTitle:_artT.trim(),articleSubtitle:($('#ghArtSubtitle')||{}).value||''};
      } else if(_fmtKey==='review'){
        var _revT=($('#ghRevTarget')||{}).value||''; var _revS=Number(($('#ghRevScore')||{}).value||0);
        if(!_revT.trim()) return toast(typeof GHt==='function'?GHt('post_review_req'):'Add what you are reviewing','error');
        if(!_revS) return toast(typeof GHt==='function'?GHt('post_rating_req'):'Add star rating','error');
        _fmtData={format:'review',reviewTarget:_revT.trim(),reviewScore:_revS};
      } else if(_fmtKey==='recipe'){
        var _recN=($('#ghRecName')||{}).value||''; if(!_recN.trim()) return toast(typeof GHt==='function'?GHt('post_recipe_req'):'Add recipe name','error');
        _fmtData={format:'recipe',recipeName:_recN.trim(),recipeIngredients:($('#ghRecIngredients')||{}).value||'',recipeTime:($('#ghRecTime')||{}).value||''};
      } else if(_fmtKey==='job'){
        var _jobT=($('#ghJobTitle')||{}).value||''; if(!_jobT.trim()) return toast(typeof GHt==='function'?GHt('post_job_req'):'Add job title','error');
        _fmtData={format:'job',jobTitle:_jobT.trim(),jobCompany:($('#ghJobCompany')||{}).value||'',jobCity:($('#ghJobCity')||{}).value||'',jobSalary:($('#ghJobSalary')||{}).value||''};
      } else if(_fmtKey==='question'){
        _fmtData={format:'question'};
      } else if(_fmtKey==='tip'){
        var _tipT=($('#ghTipTitle')||{}).value||''; if(!_tipT.trim()) return toast(typeof GHt==='function'?GHt('post_tip_req'):'Add tip headline','error');
        _fmtData={format:'tip',tipTitle:_tipT.trim()};
      } else if(_fmtKey==='event'){
        var _evtT=($('#ghEvtTitle')||{}).value||''; if(!_evtT.trim()) return toast(typeof GHt==='function'?GHt('post_event_req'):'Add event name','error');
        _fmtData={format:'event',eventTitle:_evtT.trim(),eventDate:($('#ghEvtDate')||{}).value||'',eventPlace:($('#ghEvtPlace')||{}).value||''};
      } else if(_fmtKey==='quote'){
        _fmtData={format:'quote',quoteAuthor:($('#ghQuoteAuthor')||{}).value||''};
      } else if(_fmtKey==='announcement'){
        var _annT=($('#ghAnnTitle')||{}).value||''; if(!_annT.trim()) return toast(typeof GHt==='function'?GHt('post_ann_req'):'Add announcement title','error');
        _fmtData={format:'announcement',announcementTitle:_annT.trim()};
      }

      var payload=Object.assign({
        visibility: _getAudienceVis(),
        audience: _getAudienceData(),
        feeling: selectedFeeling,
        bgGradient: selectedBg,
        bgTextStyle: selectedBg ? Object.assign({}, bgTextStyle) : null,
        linkPreview: state._lpData||null,
        mentions: extractMentions(txt),
        gifUrl: pickedGifUrl||null,
        coAuthors: coAuthors.length ? coAuthors : null,
        category: selectedCategory||null,
        voiceUrl: null,  // filled below if voice blob exists
        postFormat: _fmtData||null,
        location: window._composerLocation || null
      }, extra||{});
      // Phase 39: scheduled post
      if(scheduledAt && scheduledAt>new Date()){ payload.status='scheduled'; payload.scheduledAt=scheduledAt; }

      submitBtn.disabled=true;

      // Phase 52: upload voice blob first if present
      function _doSubmit(finalPayload){
        if(pickedFiles.length){
          if(bar) bar.style.display='flex';
          submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Uploading…';
          var total=pickedFiles.length, done=0;
          Promise.all(pickedFiles.map(function(f){
            return prepareMedia(f,'posts',function(pct){
              var overall=Math.round((done/total)*100+pct/total);
              if(fill) fill.style.width=overall+'%'; if(pctEl) pctEl.textContent=overall+'%';
              submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> '+overall+'%';
            }).then(function(url){ done++; return url; });
          })).then(function(urls){
            var validUrls=urls.filter(Boolean); if(bar) bar.style.display='none';
            if(!validUrls.length && pickedFiles.length) throw new Error('All uploads failed');
            finalPayload.mediaUrls=validUrls; submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Posting…';
            GS().createPost(txt, validUrls[0]||'', function(){ var modal=$('#ghPostModal'); if(modal) modal.remove(); window._composerLocation=null; try{localStorage.removeItem('gh_draft');}catch(_e){} var _u=authUser(); if(_u) setTimeout(function(){ checkAndAwardBadges(_u.uid); },2000); }, finalPayload);
          }).catch(function(err){ console.error('[GeoHub] upload',err); toast('Image upload failed.','error'); if(bar) bar.style.display='none'; submitBtn.disabled=false; submitBtn.innerHTML='<i class="fas fa-paper-plane"></i> Post'; });
        } else {
          submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Posting…';
          GS().createPost(txt, '', function(){ var modal=$('#ghPostModal'); if(modal) modal.remove(); window._composerLocation=null; try{localStorage.removeItem('gh_draft');}catch(_e){} var _u=authUser(); if(_u) setTimeout(function(){ checkAndAwardBadges(_u.uid); },2000); }, finalPayload);
        }
      }

      if(voiceBlob){
        submitBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Uploading voice…';
        var _u2=authUser();
        GS().uploadAudioBlob(voiceBlob, _u2&&_u2.uid, function(url){
          payload.voiceUrl=url||''; _doSubmit(payload);
        });
      } else {
        _doSubmit(payload);
      }

    };
  }

  /* ── Phase 63: Story Highlights ─────────────────────────── */
  function _openSaveToHighlightModal(st, onClose){
    if(!requireLogin()) return onClose&&onClose();
    var uid=(authUser()||{}).uid; if(!uid) return onClose&&onClose();
    if(!fs()||!db()) return onClose&&onClose();
    // Load existing highlights
    fs().getDocs(fs().query(fs().collection(db(),'users',uid,'storyHighlights'),fs().orderBy('createdAt','desc'),fs().limit(20))).then(function(snap){
      var hls=[]; snap.forEach(function(d){ hls.push(Object.assign({id:d.id},d.data())); });
      var existHtml=hls.length?hls.map(function(h){
        return '<button class="gh-hl-pick-btn" data-hl-id="'+esc(h.id)+'" data-hl-name="'+esc(h.name||'Highlight')+'"><i class="fas fa-star"></i> '+esc(h.name||'Highlight')+'</button>';
      }).join(''):'<div class="gh-muted" style="font-size:.82rem;padding:4px 0">No highlights yet</div>';
      var body='<div style="margin-bottom:12px"><div class="gh-bold" style="font-size:.88rem;margin-bottom:6px">Add to existing highlight</div>'+existHtml+'</div>'+
        '<hr style="border-color:var(--gh-border);margin:10px 0">'+
        '<div class="gh-bold" style="font-size:.88rem;margin-bottom:6px">Create new highlight</div>'+
        '<input class="gh-input" id="ghNewHlName" placeholder="Highlight name…" maxlength="40">';
      modal('Save to Highlight',body,'<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSaveHl">Save</button>','ghHlModal');
      var hlModal=document.getElementById('ghHlModal');
      if(hlModal){
        hlModal.querySelectorAll('.gh-hl-pick-btn').forEach(function(btn){
          btn.onclick=function(){
            var hlId=btn.dataset.hlId;
            fs().updateDoc(fs().doc(db(),'users',uid,'storyHighlights',hlId),{
              stories:fs().arrayUnion({id:st.id,mediaUrl:st.mediaUrl||'',text:st.text||'',createdAt:st.createdAt||null})
            }).then(function(){ toast(typeof GHt==='function'?GHt('highlight_added'):'Added to highlight!'); hlModal.remove(); onClose&&onClose(); }).catch(function(){ toast('Failed','error'); });
          };
        });
        var saveBtn=document.getElementById('ghSaveHl');
        if(saveBtn){
          saveBtn.onclick=function(){
            var name=(document.getElementById('ghNewHlName').value||'').trim();
            if(!name) return toast('Enter a name','error');
            fs().addDoc(fs().collection(db(),'users',uid,'storyHighlights'),{
              name:name, coverUrl:st.mediaUrl||'', createdAt:fs().serverTimestamp(),
              stories:[{id:st.id,mediaUrl:st.mediaUrl||'',text:st.text||'',createdAt:st.createdAt||null}]
            }).then(function(){ toast((typeof GHt==='function'?GHt('highlight_created'):'Highlight')+' "'+name+'"'); hlModal.remove(); onClose&&onClose(); }).catch(function(){ toast('Failed','error'); });
          };
        }
      }
    }).catch(function(){ onClose&&onClose(); });
  }

  /* ── Phase 63: Highlights Strip on profile (injected by profile.js integration) */
  window.ghLoadHighlights=function(uid, container){
    if(!fs()||!db()||!uid||!container) return;
    fs().getDocs(fs().query(fs().collection(db(),'users',uid,'storyHighlights'),fs().orderBy('createdAt','desc'),fs().limit(15))).then(function(snap){
      if(snap.empty) return;
      var html='<div class="gh-hl-strip">';
      snap.forEach(function(d){
        var h=Object.assign({id:d.id},d.data());
        var cover=h.coverUrl||'';
        html+='<div class="gh-hl-item" data-hl-open="'+esc(d.id)+'" data-hl-uid="'+esc(uid)+'" title="'+esc(h.name||'Highlight')+'">'+
          '<div class="gh-hl-thumb">'+(cover?'<img src="'+esc(cover)+'" alt="">':'<i class="fas fa-star"></i>')+'</div>'+
          '<div class="gh-hl-label">'+esc((h.name||'Highlight').slice(0,10))+'</div>'+
        '</div>';
      });
      html+='</div>';
      container.innerHTML=html;
      container.querySelectorAll('[data-hl-open]').forEach(function(el){
        el.onclick=function(){
          var hlId=el.dataset.hlOpen, hlUid=el.dataset.hlUid;
          fs().getDoc(fs().doc(db(),'users',hlUid,'storyHighlights',hlId)).then(function(snap){
            if(!snap.exists()) return;
            var h=snap.data();
            var stories=(h.stories||[]).map(function(s){ return Object.assign({authorId:hlUid},s); });
            if(stories.length) openStoryViewer(buildStoryGroups(stories),0,0);
          }).catch(function(){});
        };
      });
    }).catch(function(){});
  };

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
      '<div id="ghStoryPollWrap" style="display:none;margin-top:10px">'+
        '<div class="gh-story-poll-builder">'+
          '<input class="gh-input" id="ghStoryPollQ" placeholder="Poll question…" maxlength="80">'+
          '<div style="display:flex;gap:8px;margin-top:6px">'+
            '<input class="gh-input" id="ghStoryPollA" placeholder="Option A (Yes)" maxlength="40" value="">'+
            '<input class="gh-input" id="ghStoryPollB" placeholder="Option B (No)" maxlength="40" value="">'+
          '</div>'+
          '<button type="button" class="gh-btn ghost sm" id="ghStoryPollRemove" style="margin-top:6px"><i class="fas fa-times"></i> Remove poll</button>'+
        '</div>'+
      '</div>'+
      '<div id="ghStoryLinkWrap" style="display:none;margin-top:8px">'+
        '<div style="display:flex;align-items:center;gap:6px">'+
          '<input class="gh-input" id="ghStoryLinkUrl" placeholder="Link URL (https://…)" maxlength="200" style="flex:1">'+
          '<input class="gh-input" id="ghStoryLinkLabel" placeholder="Button label" maxlength="30" style="width:130px">'+
          '<button type="button" class="gh-btn ghost sm" id="ghStoryLinkRemove"><i class="fas fa-times"></i></button>'+
        '</div>'+
      '</div>'+
      '<div class="gh-cmp-toolbar" style="margin-top:10px">'+
        '<button type="button" class="gh-cmp-tool" id="ghStoryPhotoBtn"><i class="fas fa-image"></i><span> Photo/Video</span></button>'+
        '<button type="button" class="gh-cmp-tool" id="ghStoryPollBtn"><i class="fas fa-check-to-slot"></i><span> Poll</span></button>'+
        '<button type="button" class="gh-cmp-tool" id="ghStoryLinkBtn"><i class="fas fa-link"></i><span> Link</span></button>'+
      '</div>';
    var m=modal('Add to your story', body,
      '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitStory" disabled>Share story</button>',
      'ghStoryModal');
    var pickedFile=null;
    function isDirty(){ return !!(($('#ghStoryText')||{}).value||'').trim()||!!pickedFile; }
    function updateSubmit(){ var btn=$('#ghSubmitStory'); if(btn) btn.disabled=!isDirty(); }
    m.addEventListener('click', function(e){
      if(e.target===m||e.target.closest('[data-close-modal]')){
        if(isDirty()){ e.stopPropagation(); e.preventDefault();
          window.ghConfirm(typeof GHt==='function'?GHt('discard_story_cfm'):'Discard your story?', function(){ m.remove(); });
        }
      }
    }, true);
    var ta=$('#ghStoryText');
    if(ta){ ta.addEventListener('input', updateSubmit); setTimeout(function(){ ta.focus(); }, 60); }
    $('#ghStoryPhotoBtn').onclick=function(){ var fp=$('#ghStoryFilePick'); if(fp) fp.click(); };
    // Phase 62: Poll toggle
    var _pollVisible=false, _linkVisible=false;
    var pollBtn=$('#ghStoryPollBtn'); var pollWrap=$('#ghStoryPollWrap');
    var linkBtn=$('#ghStoryLinkBtn'); var linkWrap=$('#ghStoryLinkWrap');
    if(pollBtn&&pollWrap){ pollBtn.onclick=function(){ _pollVisible=!_pollVisible; pollWrap.style.display=_pollVisible?'':'none'; pollBtn.classList.toggle('active',_pollVisible); }; }
    if(linkBtn&&linkWrap){ linkBtn.onclick=function(){ _linkVisible=!_linkVisible; linkWrap.style.display=_linkVisible?'':'none'; linkBtn.classList.toggle('active',_linkVisible); }; }
    var pollRm=$('#ghStoryPollRemove'); if(pollRm) pollRm.onclick=function(){ _pollVisible=false; pollWrap.style.display='none'; pollBtn&&pollBtn.classList.remove('active'); };
    var linkRm=$('#ghStoryLinkRemove'); if(linkRm) linkRm.onclick=function(){ _linkVisible=false; linkWrap.style.display='none'; linkBtn&&linkBtn.classList.remove('active'); };
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
      // Phase 62: collect poll + link data
      var _pollData=null;
      if(_pollVisible){
        var pq=($('#ghStoryPollQ')||{}).value||''; var pa=($('#ghStoryPollA')||{}).value||'Yes'; var pb=($('#ghStoryPollB')||{}).value||'No';
        if(pq.trim()) _pollData={question:pq.trim(),optionA:pa.trim()||'Yes',optionB:pb.trim()||'No',votes:{}};
      }
      var _linkData=null;
      if(_linkVisible){
        var lu=($('#ghStoryLinkUrl')||{}).value||''; var ll=($('#ghStoryLinkLabel')||{}).value||'Visit';
        if(lu.trim()&&(lu.startsWith('http://')||lu.startsWith('https://'))) _linkData={url:lu.trim(),label:ll.trim()||'Visit'};
      }
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
        var _extra={}; if(_pollData) _extra.poll=_pollData; if(_linkData) _extra.link=_linkData;
        GS().createStory(t,finalUrl,function(){ var mo=$('#ghStoryModal'); if(mo) mo.remove(); },_extra);
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
        var ga=window.GeoAuth&&window.GeoAuth.getCurrentUser&&window.GeoAuth.getCurrentUser();
        var me=currentUserInfo();
        var av=(ga&&(ga.avatar||ga.photoURL))||me.avatar||'';
        var name=(ga&&(ga.fullName||ga.displayName||ga.name))||me.name||'';
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

      // Owner delete button + Phase 63: Save to Highlight
      var ownerDeleteHtml = isOwner
        ? '<button type="button" class="gh-story-owner-del" id="ghStoryDelete" aria-label="Delete story"><i class="fas fa-trash-alt"></i></button>'+
          '<button type="button" class="gh-story-owner-hl" id="ghStorySaveHL" title="Save to Highlights"><i class="fas fa-star"></i></button>'
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
        window.ghConfirm(typeof GHt==='function'?GHt('story_delete_cfm'):'Delete this story?', function() {
          if(GS().deleteStory){
            GS().deleteStory(st.id, function(err){
              if(!err){ toast('Story deleted'); close(); }
              else toast('Could not delete story.','error');
            });
          }
        });
      };
      // Phase 63: Save to Highlight
      var hlBtn=overlay.querySelector('#ghStorySaveHL');
      if(hlBtn && st.id && isOwner){
        hlBtn.onclick=function(e){
          e.stopPropagation();
          clearTimer();
          _openSaveToHighlightModal(st, function(){ scheduleAdvance(); });
        };
      }

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

      // Phase 62: Views list — click "Seen by X" opens modal with viewer names
      var seenRow=overlay.querySelector('.gh-story-seen-row');
      if(seenRow && st.id && isOwner){
        seenRow.style.cursor='pointer';
        seenRow.title='See who viewed';
        seenRow.onclick=function(e){
          e.stopPropagation();
          clearTimer();
          if(!fs()||!db()) return;
          fs().getDoc(fs().doc(db(),'stories',st.id)).then(function(snap){
            var data=snap.exists()?snap.data():{};
            var viewedBy=data.viewedBy||[];
            if(!viewedBy.length){ toast('No views yet'); scheduleAdvance(); return; }
            var docsP=viewedBy.slice(0,30).map(function(uid){ return fs().getDoc(fs().doc(db(),'users',uid)).then(function(s){ return s.exists()?Object.assign({id:s.id},s.data()):null; }).catch(function(){ return null; }); });
            Promise.all(docsP).then(function(users){
              users=users.filter(Boolean);
              var html='<div class="gh-sv-list">'+users.map(function(u){
                var n=u.fullName||u.displayName||u.name||'User'; var av=u.avatar||u.photoURL||'';
                return '<div class="gh-sv-row"><a href="profile.html?user='+esc(u.id)+'" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit"><span class="gh-avatar" style="width:36px;height:36px">'+(av?'<img src="'+esc(av)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':esc(initials(n)))+'</span><strong>'+esc(n)+'</strong></a></div>';
              }).join('')+'</div>';
              modal('Viewed by '+users.length,html,'<button class="gh-btn ghost" data-close-modal>Close</button>','ghStoryViewsModal');
              scheduleAdvance();
            });
          }).catch(function(){ scheduleAdvance(); });
        };
      }

      // Phase 62: Poll voting in story viewer
      if(st.poll && st.poll.question){
        var pollEl=overlay.querySelector('[data-story-poll]');
        if(pollEl){
          var _u=authUser();
          var hasVoted=st.poll.votes&&_u&&st.poll.votes[_u.uid];
          pollEl.querySelectorAll('[data-poll-opt]').forEach(function(btn){
            btn.onclick=function(e){
              e.stopPropagation();
              if(!requireLogin()) return;
              if(hasVoted) return toast('You already voted');
              var opt=btn.dataset.pollOpt;
              hasVoted=true;
              btn.classList.add('voted');
              var upd={}; upd['poll.votes.'+_u.uid]=opt;
              if(fs()&&db()) fs().updateDoc(fs().doc(db(),'stories',st.id),upd).catch(function(){});
            };
          });
        }
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

  function videoPostCard(p){
    var thumb   = p.thumbnail || (p.youtubeId ? 'https://i.ytimg.com/vi/'+p.youtubeId+'/hqdefault.jpg' : '');
    var href    = p.videoId ? 'watch.html?v='+encodeURIComponent(p.videoId) : (p.youtubeId ? 'watch.html?v='+encodeURIComponent(p.videoId||p.youtubeId) : '#');
    var chHref  = p.channelId ? 'channel.html?id='+encodeURIComponent(p.channelId) : '#';
    var tsStr   = p.createdAt && p.createdAt.toMillis ? timeAgo2(p.createdAt.toMillis()) : '';
    var ytId    = p.youtubeId || '';
    var chName  = p.channelName || p.authorName || 'GeoHub';
    var chAv    = p.channelAvatar || '';
    var chInit  = initials(chName);
    var pid     = p.id || '';
    var desc    = (p.description || '').slice(0, 160);
    var avHtml  = chAv
      ? '<img src="'+esc(chAv)+'" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'\'"><span style="display:none">'+esc(chInit)+'</span>'
      : '<span>'+esc(chInit)+'</span>';
    var cloudUrl = p.videoUrl || '';
    return '<article class="gh-card gh-video-post-card" data-post-id="'+esc(pid)+'"'+(cloudUrl?' data-video-url="'+esc(cloudUrl)+'"':'')+' data-video-thumb="'+esc(thumb)+'">' +
      '<div class="gh-video-post-thumb" data-play-video data-youtube-id="'+esc(ytId)+'" data-video-href="'+esc(href)+'">' +
        (thumb ? '<img src="'+esc(thumb)+'" alt="" loading="lazy">' : '<div class="gh-video-post-thumb-ph"><i class="fas fa-play-circle"></i></div>') +
        '<div class="gh-video-play-btn"><i class="fas fa-play"></i></div>' +
        '<a class="gh-video-expand-btn" href="'+esc(href)+'" title="ვიდეოს გვერდი"><i class="fas fa-expand-alt"></i></a>' +
        '<div class="gh-video-overlay">' +
          '<a href="'+esc(chHref)+'" class="gh-avatar gh-video-av">'+avHtml+'</a>' +
          '<div class="gh-video-overlay-meta">' +
            '<a href="'+esc(chHref)+'" class="gh-video-overlay-ch">'+esc(chName)+'</a>' +
            '<div class="gh-video-overlay-time">'+(tsStr ? esc(tsStr)+' · ' : '')+'<span class="gh-video-post-badge"><i class="fas fa-film"></i> Video</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="gh-video-post-body">' +
        '<div class="gh-video-post-title"><a href="'+esc(href)+'">'+esc((p.title||'').slice(0,100))+'</a></div>' +
        (desc ? '<div class="gh-video-post-desc">'+esc(desc)+(p.description && p.description.length>160 ? '…' : '')+'</div>' : '') +
      '</div>' +
      '<div class="gh-post-stats">'+
        '<span><button class="gh-rx-who-btn" data-who-reacted="'+esc(pid)+'">❤️ <b data-like-count>'+(p.likeCount||0)+'</b>'+(p.likeCount?' people reacted':'')+'</button></span>'+
        '<span><button class="gh-stats-btn" data-open-comments-btn><b data-comment-count>'+(p.commentCount||0)+'</b> comments</button></span>'+
      '</div>'+
      '<div class="gh-rx-breakdown" data-rx-pid="'+esc(pid)+'"></div>' +
      '<div class="gh-post-actions">'+
        '<span class="gh-like-wrap"><button class="gh-act" data-like>❤️ <span data-i18n="post_action_like">Like</span></button>'+
          '<div class="gh-reaction-strip"><button data-reaction="love">❤️</button><button data-reaction="haha">😂</button><button data-reaction="wow">😮</button><button data-reaction="sad">😢</button><button data-reaction="angry">😡</button><button data-reaction="clap">👏</button></div>'+
        '</span>'+
        '<button class="gh-act" data-comment-toggle><i class="fas fa-comment"></i> <span data-i18n="post_action_comment">Comment</span></button>'+
        '<button class="gh-act" data-share><i class="fas fa-share"></i> <span data-i18n="post_action_share">Share</span></button>'+
        '<button class="gh-act" data-save><i class="fas fa-bookmark"></i> <span data-i18n="post_action_save">Save</span></button>'+
      '</div>'+
      '<div class="gh-comments" data-comments hidden><div data-comments-list></div>'+
        '<form class="gh-comment-form" data-comment-form><button class="gh-comment-emoji" type="button" title="Emoji"><i class="fas fa-face-smile"></i></button><button class="gh-comment-mic" type="button" title="Voice comment"><i class="fas fa-microphone"></i></button><div class="gh-cmt-voice-preview" style="display:none"></div><input class="gh-input gh-cmt-text-input" data-i18n-placeholder="comment_placeholder" placeholder="Write a comment…"><button class="gh-btn"><i class="fas fa-paper-plane"></i></button></form>'+
      '</div>'+
    '</article>';
  }
  function timeAgo2(ms){ var s=Math.floor((Date.now()-ms)/1000); if(s<60) return 'ახლახანს'; if(s<3600) return Math.floor(s/60)+' წ. წინ'; if(s<86400) return Math.floor(s/3600)+' სთ. წინ'; return Math.floor(s/86400)+' დ. წინ'; }

  function channelPostCard(p){
    var chHref = p.channelId ? 'channel.html?id='+encodeURIComponent(p.channelId) : '#';
    var ts = p.createdAt && p.createdAt.toMillis ? timeAgo2(p.createdAt.toMillis()) : '';
    var av = p.authorAvatar || '';
    var name = p.channelName || p.authorName || 'GeoHub';
    return '<article class="gh-card gh-ch-post-card" data-post-id="'+esc(p.id||'')+'">' +
      '<div class="gh-post-header">' +
        '<span class="gh-avatar" style="flex-shrink:0">'+(av?'<img src="'+esc(av)+'" alt="" loading="lazy" onerror="this.remove()">':esc(initials(name)))+'</span>' +
        '<div class="gh-post-meta">' +
          '<a class="gh-post-author" href="'+esc(chHref)+'">'+esc(name)+'</a>' +
          (ts?'<span class="gh-post-time">'+ts+'</span>':'') +
        '</div>' +
        '<span class="gh-ch-post-badge"><i class="fas fa-newspaper"></i> Post</span>' +
      '</div>' +
      (p.text?'<div class="gh-post-body" style="white-space:pre-wrap">'+esc((p.text||'').slice(0,500))+((p.text||'').length>500?'…':'')+'</div>':'') +
      (p.imageUrl?'<div class="gh-ch-post-img"><img src="'+esc(p.imageUrl)+'" alt="" loading="lazy" style="width:100%;border-radius:12px;margin-top:10px;max-height:400px;object-fit:cover"></div>':'') +
      '<div class="gh-post-stats" style="margin-top:8px">'+
        '<span><button class="gh-rx-who-btn" data-who-reacted="'+esc(p.id||'')+'">❤️ <b data-like-count>'+(p.likeCount||0)+'</b>'+(p.likeCount?' people reacted':'')+'</button></span>'+
        '<span><b data-comment-count>'+(p.commentCount||0)+'</b> comments</span>'+
      '</div>'+
      '<div class="gh-post-actions">'+
        '<span class="gh-like-wrap"><button class="gh-act" data-like>❤️ <span data-i18n="post_action_like">Like</span></button>'+
          '<div class="gh-reaction-strip"><button data-reaction="love">❤️</button><button data-reaction="haha">😂</button><button data-reaction="wow">😮</button><button data-reaction="sad">😢</button><button data-reaction="angry">😡</button><button data-reaction="clap">👏</button></div>'+
        '</span>'+
        '<button class="gh-act" data-comment-toggle><i class="fas fa-comment"></i> <span data-i18n="post_action_comment">Comment</span></button>'+
        '<button class="gh-act" data-share><i class="fas fa-share"></i> <span data-i18n="post_action_share">Share</span></button>'+
      '</div>'+
      '<div class="gh-comments" data-comments hidden><div data-comments-list></div>'+
        '<form class="gh-comment-form" data-comment-form><button class="gh-comment-emoji" type="button" title="Emoji"><i class="fas fa-face-smile"></i></button><button class="gh-comment-mic" type="button" title="Voice comment"><i class="fas fa-microphone"></i></button><div class="gh-cmt-voice-preview" style="display:none"></div><input class="gh-input gh-cmt-text-input" data-i18n-placeholder="comment_placeholder" placeholder="Write a comment…"><button class="gh-btn"><i class="fas fa-paper-plane"></i></button></form>'+
      '</div>'+
    '</article>';
  }

  /* ── Phase 17: Check-in post card ─────────────────────────────────────── */
  function checkinPostCard(p){
    var name=p.authorName||'GeoHub User';
    var av=p.authorAvatar||'';
    var ts=p.createdAt&&p.createdAt.toMillis?timeAgo2(p.createdAt.toMillis()):'';
    var pid=p.id||'';
    var placeName=p.placeName||'ადგილი';
    var city=p.city||'';
    var placeHref=p.placeId?'places.html?id='+encodeURIComponent(p.placeId):'#';
    var bizHref=p.businessId?'business.html?id='+encodeURIComponent(p.businessId):placeHref;
    var checkinHref='checkin.html'+(p.placeId?'?place='+encodeURIComponent(p.placeId):'');
    var caption=p.caption||'';
    var photo=p.imageUrl||p.photoUrl||'';
    var verBadge=p.verified?'<span class="gh-ci-verified"><i class="fas fa-circle-check"></i> Verified</span>':'';
    var xpBadge=p.xpAwarded?'<span class="gh-ci-xp">+'+p.xpAwarded+' XP</span>':'';
    return '<article class="gh-card gh-checkin-card" data-post-id="'+esc(pid)+'">'+
      '<div class="gh-ci-header">'+
        '<span class="gh-avatar" style="flex-shrink:0">'+(av?'<img src="'+esc(av)+'" alt="" loading="lazy" onerror="this.remove()">':esc(initials(name)))+'</span>'+
        '<div class="gh-ci-meta">'+
          '<span class="gh-ci-who"><b>'+esc(name)+'</b> checked in</span>'+
          '<a class="gh-ci-where" href="'+esc(bizHref)+'"><i class="fas fa-location-dot"></i> '+esc(placeName)+(city?' · '+esc(city):'')+'</a>'+
          (ts?'<span class="gh-post-time">'+esc(ts)+'</span>':'')+
        '</div>'+
        '<div class="gh-ci-badges">'+verBadge+xpBadge+'</div>'+
      '</div>'+
      '<div class="gh-ci-map-banner">'+
        '<div class="gh-ci-map-pin"><i class="fas fa-location-dot"></i></div>'+
        '<div class="gh-ci-map-info">'+
          '<strong>'+esc(placeName)+'</strong>'+
          (city?'<span>'+esc(city)+'</span>':'')+
        '</div>'+
        '<a class="gh-btn sm ghost gh-ci-checkin-btn" href="'+esc(checkinHref)+'"><i class="fas fa-plus"></i> Check in here</a>'+
      '</div>'+
      (photo?'<div class="gh-ci-photo"><img src="'+esc(photo)+'" alt="" loading="lazy"></div>':'')+
      (caption?'<div class="gh-ci-caption">'+esc(caption)+'</div>':'')+
      '<div class="gh-post-stats">'+
        '<span><button class="gh-rx-who-btn" data-who-reacted="'+esc(pid)+'">❤️ <b data-like-count>'+(p.likeCount||0)+'</b></button></span>'+
        '<span><b data-comment-count>'+(p.commentCount||0)+'</b> comments</span>'+
      '</div>'+
      '<div class="gh-post-actions">'+
        '<span class="gh-like-wrap"><button class="gh-act" data-like>❤️ <span data-i18n="post_action_like">Like</span></button>'+
          '<div class="gh-reaction-strip"><button data-reaction="love">❤️</button><button data-reaction="haha">😂</button><button data-reaction="wow">😮</button><button data-reaction="sad">😢</button><button data-reaction="angry">😡</button><button data-reaction="clap">👏</button></div>'+
        '</span>'+
        '<button class="gh-act" data-comment-toggle><i class="fas fa-comment"></i> <span data-i18n="post_action_comment">Comment</span></button>'+
        '<button class="gh-act" data-share><i class="fas fa-share"></i> <span data-i18n="post_action_share">Share</span></button>'+
      '</div>'+
      '<div class="gh-comments" data-comments hidden><div data-comments-list></div>'+
        '<form class="gh-comment-form" data-comment-form><button class="gh-comment-emoji" type="button" title="Emoji"><i class="fas fa-face-smile"></i></button><button class="gh-comment-mic" type="button" title="Voice comment"><i class="fas fa-microphone"></i></button><div class="gh-cmt-voice-preview" style="display:none"></div><input class="gh-input gh-cmt-text-input" data-i18n-placeholder="comment_placeholder" placeholder="Write a comment…"><button class="gh-btn"><i class="fas fa-paper-plane"></i></button></form>'+
      '</div>'+
    '</article>';
  }

  function postCard(p, options){
    if(p.type==='video') return videoPostCard(p);
    if(p.type==='channelPost') return channelPostCard(p);
    if(p.type==='checkin') return checkinPostCard(p);
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

    // Phase 46: category badge
    var CAT_ICONS={travel:'✈️',food:'🍕',business:'💼',nature:'🌿',tech:'💻',sport:'⚽',music:'🎵',art:'🎨',news:'📰',humor:'😂',health:'🏥',fashion:'👗',cars:'🚗',education:'📚',finance:'💰',gaming:'🎮',film:'🎬',pets:'🐾',diy:'🔧',events:'📅',realestate:'🏠',politics:'🏛️',science:'🔬',religion:'🕌',relationships:'💞'};
    var categoryBadge = p.category ? '<a class="gh-cat-badge" href="feed.html?cat='+encodeURIComponent(p.category)+'" onclick="event.stopPropagation()">'+(CAT_ICONS[p.category]||'🏷️')+' '+esc(p.category.charAt(0).toUpperCase()+p.category.slice(1))+'</a>' : '';

    // Post format badge (article, review, recipe, job, question, tip, event, quote, announcement)
    var FMT_ICONS={article:'📰',review:'⭐',recipe:'🍽️',job:'💼',question:'❓',tip:'💡',event:'📅',quote:'💬',announcement:'📢'};
    var fmtBadge='';
    if(p.postFormat && p.postFormat.format && FMT_ICONS[p.postFormat.format]){
      fmtBadge='<span class="gh-fmt-badge">'+FMT_ICONS[p.postFormat.format]+' '+esc(p.postFormat.format.charAt(0).toUpperCase()+p.postFormat.format.slice(1))+'</span>';
    }

    // Post format detail block (article title, review stars, recipe name, job details)
    var fmtDetailHtml='';
    if(p.postFormat){
      var pf=p.postFormat, pfmt=pf.format||pf.type||'';
      if(pfmt==='article' && pf.articleTitle){
        fmtDetailHtml='<div class="gh-fmt-article"><div class="gh-fmt-art-title">'+esc(pf.articleTitle)+'</div>'+(pf.articleSubtitle?'<div class="gh-fmt-art-sub">'+esc(pf.articleSubtitle)+'</div>':'')+'</div>';
      } else if(pfmt==='review' && pf.reviewTarget){
        var _stars=''; for(var _si=1;_si<=5;_si++) _stars+='<span style="color:'+(_si<=(pf.reviewScore||0)?'#fbbf24':'rgba(255,255,255,.2)')+'">★</span>';
        fmtDetailHtml='<div class="gh-fmt-review"><span class="gh-fmt-rev-target">'+esc(pf.reviewTarget)+'</span><span class="gh-fmt-rev-stars">'+_stars+'</span></div>';
      } else if(pfmt==='recipe' && pf.recipeName){
        fmtDetailHtml='<div class="gh-fmt-recipe"><span>🍽️ <strong>'+esc(pf.recipeName)+'</strong></span>'+(pf.recipeTime?'<span class="gh-fmt-recipe-time">⏱ '+esc(pf.recipeTime)+'</span>':'')+'</div>';
      } else if(pfmt==='job' && pf.jobTitle){
        fmtDetailHtml='<div class="gh-fmt-job"><strong class="gh-fmt-job-title">'+esc(pf.jobTitle)+'</strong>'+(pf.jobCompany?'<span> · '+esc(pf.jobCompany)+'</span>':'')+(pf.jobCity?'<span> · 📍'+esc(pf.jobCity)+'</span>':'')+(pf.jobSalary?'<span class="gh-fmt-salary">💵 '+esc(pf.jobSalary)+'</span>':'')+'</div>';
      } else if(pfmt==='question'){
        fmtDetailHtml='<div class="gh-fmt-question"><i class="fas fa-question-circle"></i> Community Question</div>';
      } else if(pfmt==='tip' && pf.tipTitle){
        fmtDetailHtml='<div class="gh-fmt-tip"><i class="fas fa-lightbulb"></i> <strong>'+esc(pf.tipTitle)+'</strong></div>';
      } else if(pfmt==='event' && pf.eventTitle){
        var _evtDateStr=''; try{ if(pf.eventDate) _evtDateStr=new Date(pf.eventDate).toLocaleString('ka-GE',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }catch(e){}
        fmtDetailHtml='<div class="gh-fmt-event"><strong class="gh-fmt-evt-title">📅 '+esc(pf.eventTitle)+'</strong>'+(_evtDateStr?'<span class="gh-fmt-evt-date"> · '+esc(_evtDateStr)+'</span>':'')+(pf.eventPlace?'<span class="gh-fmt-evt-place"> · 📍'+esc(pf.eventPlace)+'</span>':'')+'</div>';
      } else if(pfmt==='quote'){
        fmtDetailHtml='<div class="gh-fmt-quote">'+(pf.quoteAuthor?'<span class="gh-fmt-quote-author">— '+esc(pf.quoteAuthor)+'</span>':'')+'</div>';
      } else if(pfmt==='announcement' && pf.announcementTitle){
        fmtDetailHtml='<div class="gh-fmt-announcement"><i class="fas fa-bullhorn"></i> <strong>'+esc(pf.announcementTitle)+'</strong></div>';
      }
    }

    // Location
    var locationHtml='';
    if(p.location && p.location.name){
      locationHtml='<div class="gh-post-location"><i class="fas fa-map-marker-alt"></i> '+esc(p.location.name)+'</div>';
    }

    // Phase 59: Verification badge
    var verifiedBadge = p.authorVerified ? '<span class="gh-verified-badge" title="Verified account"><i class="fas fa-circle-check"></i></span>' : (p.authorType==='business' && p.authorBizVerified ? '<span class="gh-verified-badge gh-verified-biz" title="Verified business"><i class="fas fa-store"></i></span>' : '');

    // Phase 54: Sponsored/Boosted label
    var _now54=Date.now();
    var _boostActive=p.boosted && (!p.boostExpiresAt || ts(p.boostExpiresAt)>_now54);
    var sponsoredHtml=_boostActive?'<span class="gh-sponsored-label"><i class="fas fa-bolt-lightning"></i>'+t('sponsored')+'</span>':'';

    // Phase 45: co-authors "with X, Y"
    var coAuthorHtml = '';
    if(p.coAuthors && p.coAuthors.length){
      coAuthorHtml = ' <span class="gh-coauthor-with">with '+p.coAuthors.map(function(ca){
        return '<a class="gh-coauthor-link" href="profile.html?user='+encodeURIComponent(ca.slug||ca.uid)+'">'+(ca.avatar?'<img src="'+esc(ca.avatar)+'" alt="">':'')+esc(ca.name)+'</a>';
      }).join(', ')+'</span>';
    }

    var _bts = p.bgTextStyle || {};
    var bgStyle = (p.bgGradient && (p.text||'').length < 150) ? ' style="background:'+esc(p.bgGradient)+';border-radius:18px;padding:32px 20px;text-align:center;min-height:180px;display:flex;align-items:center;justify-content:center;color:'+esc(_bts.color||'#fff')+';font-size:'+esc(_bts.size||'1.1rem')+';font-weight:'+(_bts.bold?'900':'700')+';font-style:'+(_bts.italic?'italic':'normal')+'"' : '';
    // Phase 42: read time — show only for long posts (>120 words)
    var _wordCount = p.text ? p.text.trim().split(/\s+/).length : 0;
    var _readTimeMins = Math.ceil(_wordCount / 200);
    var readTimeBadge = (_wordCount > 120) ? '<span class="gh-read-time"><i class="fas fa-clock"></i> ~'+_readTimeMins+' min read</span>' : '';
    var postTextHtml = '';
    if (p.text) {
      if (p.bgGradient && p.text.length < 150) {
        postTextHtml = '<div class="gh-post-bg-text"'+bgStyle+'><span>'+linkifyText(p.text)+'</span></div>';
      } else {
        var _MAX_POST = 300;
        if (p.text.length > _MAX_POST) {
          var _cut = p.text.lastIndexOf(' ', _MAX_POST);
          if (_cut < _MAX_POST * 0.7) _cut = _MAX_POST;
          postTextHtml = '<div class="gh-post-text">'
            + '<span class="gh-post-short">'+linkifyText(p.text.slice(0,_cut))+'…</span>'
            + '<span class="gh-post-full" style="display:none">'+linkifyText(p.text)+'</span>'
            + '<button type="button" class="gh-read-more" onclick="ghToggleReadMore(this)">წაიკითხე მეტი ▾</button>'
            + '</div>';
        } else {
          postTextHtml = '<div class="gh-post-text">'+linkifyText(p.text)+'</div>';
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
    // Phase 52: Voice Note player
    var voiceHtml = p.voiceUrl ? '<div class="gh-voice-note-card"><div class="gh-vnc-icon"><i class="fas fa-microphone"></i></div><div class="gh-vnc-player"><button class="gh-vnc-play" data-voice-play data-voice-src="'+esc(p.voiceUrl)+'"><i class="fas fa-play"></i></button><div class="gh-vnc-bar"><div class="gh-vnc-fill" data-voice-fill></div></div><span class="gh-vnc-dur" data-voice-dur>🎙️ Voice Note</span></div></div>' : '';

    // Phase 43: GIF
    if(!mediaHtml && p.gifUrl) {
      mediaHtml = '<div class="gh-post-gif-wrap"><img class="gh-post-gif" src="'+esc(p.gifUrl)+'" alt="GIF" loading="lazy"><span class="gh-gif-badge">GIF</span></div>';
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
            'data-pid="'+esc(pid)+'" data-opt-id="'+esc(opt.id)+'" data-poll-opt="'+esc(opt.id)+'">' +
            '<div class="gh-poll-bar" style="width:'+pct+'%;transition:width .6s cubic-bezier(.4,0,.2,1)"></div>' +
            '<span class="gh-poll-label">'+esc(opt.text)+'</span>' +
            '<span class="gh-poll-pct">'+pct+'%</span>' +
            '<span class="gh-poll-votes" style="font-size:.65rem;color:var(--gh-muted);margin-left:4px">'+Number(opt.votes||0)+' ხმა</span>'+
          '</button>';
        }).join('') +
        '<div class="gh-poll-footer" data-poll-total>'+totalV+' vote'+(totalV===1?'':'s')+(pollExpired?' · <em>Poll ended</em>':'')+'</div>' +
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

    // Phase 84/87: postFormat renderers (Flash Sale + Fundraiser)
    var flashSaleHtml = '';
    if(p.postFormat && p.postFormat.type === 'flash_sale' && typeof window.ghRenderFlashSale === 'function') {
      try { flashSaleHtml = window.ghRenderFlashSale(p.postFormat) || ''; } catch(e) {}
    }
    var fundraiserHtml = '';
    if(p.postFormat && p.postFormat.type === 'fundraiser' && typeof window.ghRenderFundraiser === 'function') {
      try { fundraiserHtml = window.ghRenderFundraiser(p.postFormat, pid) || ''; } catch(e) {}
    }

    var totalRx = Number(p.likeCount||p.reactionCount||0);

    // Phase 41: translate button (only when post has text)
    var translateHtml = p.text ? '<div class="gh-post-translate"><button class="gh-translate-btn" data-translate data-translate-text="'+esc((p.text||'').slice(0,500))+'" data-i18n="translate_btn">🌐 Translate</button><div class="gh-translate-result" data-translate-result hidden></div></div>' : '';

    // Phase 44: Repost banner
    var repostBanner = p.isRepost ? '<div class="gh-repost-banner"><i class="fas fa-retweet"></i> <strong>'+esc(name)+'</strong> reposted</div>' : '';

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
      : '<form class="gh-comment-form" data-comment-form><button class="gh-comment-emoji" type="button" title="Emoji"><i class="fas fa-face-smile"></i></button><button class="gh-comment-mic" type="button" title="Voice comment"><i class="fas fa-microphone"></i></button><div class="gh-cmt-voice-preview" style="display:none"></div><input class="gh-input gh-cmt-text-input" data-i18n-placeholder="comment_placeholder" placeholder="Write a comment…"><button class="gh-btn"><i class="fas fa-paper-plane"></i></button></form>';

    // Card element data attributes
    var cardAttrs = ' id="post-'+esc(pid)+'" data-post-id="'+esc(pid)+'" data-author-id="'+esc(authorId)+'"';
    if (bizCtx && p.pinned) cardAttrs += ' data-pinned="1"';
    if (bizCtx) cardAttrs += ' data-vis="'+esc(p.visibility||'public')+'"';
    if (bizCtx && isAdmin) cardAttrs += ' data-biz-admin="1"';

    return '<article class="gh-card gh-post"'+cardAttrs+'>'+
      repostBanner+
      followedPageBanner+
      pinBanner+
      '<div class="gh-post-head"><a class="gh-avatar gh-profile-avatar-link" href="'+esc(authorHref)+'"'+authorAttrs+avatarAttrs+'>'+(avatarHtml)+'</a><div class="gh-post-meta"><div class="gh-post-name-row"><a class="gh-post-name gh-profile-name-link" href="'+esc(authorHref)+'"'+authorAttrs+'>'+esc(name)+'</a>'+verifiedBadge+coAuthorHtml+sponsoredHtml+'</div><div class="gh-post-time">'+timeAgo(p.createdAt)+' · <i class="fas '+privacyIcon+'"></i>'+target+(p.feeling?' · '+esc(p.feeling):'')+(categoryBadge?' · '+categoryBadge:'')+(fmtBadge?' · '+fmtBadge:'')+bizPostedOnHtml+(readTimeBadge?' · '+readTimeBadge:'')+'</div></div>'+moreBtn+'</div>'+
      locationHtml+
      fmtDetailHtml+
      postTextHtml+
      translateHtml+
      voiceHtml+
      mediaHtml+
      pollHtml+
      flashSaleHtml+
      fundraiserHtml+
      linkPrevHtml+
      (p.sharedPostId?'<div class="gh-shared-preview" data-shared-post="'+esc(p.sharedPostId)+'"><i class="fas fa-share"></i><div><strong>Shared post</strong><span>Loading original post...</span></div></div>':'')+
      viewCountHtml+
      '<div class="gh-post-stats"><span><button class="gh-rx-who-btn" data-who-reacted="'+esc(pid)+'">❤️ <b data-like-count>'+totalRx+'</b>'+(totalRx?' people reacted':'')+'</button></span><span><button class="gh-stats-btn" data-open-comments-btn><b data-comment-count>'+Math.max(0,Number(p.commentCount||0))+'</b> comments</button> · <button class="gh-stats-btn" data-open-shares-btn><b data-share-count>'+Number(p.shareCount||0)+'</b> shares</button>'+(Number(p.viewCount||0)>0?' · <span class="gh-view-count"><i class="fas fa-eye"></i> <span data-view-count>'+Number(p.viewCount||0)+'</span></span>':'')+'</span></div>'+
      '<div class="gh-rx-breakdown" data-rx-pid="'+esc(pid)+'"></div>'+
      '<div class="gh-post-actions"><span class="gh-like-wrap"><button class="gh-act" data-like>❤️ <span data-i18n="post_action_like">Like</span></button><div class="gh-reaction-strip"><button data-reaction="love">❤️</button><button data-reaction="haha">😂</button><button data-reaction="wow">😮</button><button data-reaction="sad">😢</button><button data-reaction="angry">😡</button><button data-reaction="clap">👏</button></div></span><button class="gh-act" data-comment-toggle><i class="fas fa-comment"></i> <span data-i18n="post_action_comment">Comment</span></button><button class="gh-act" data-share><i class="fas fa-share"></i> <span data-i18n="post_action_share">Share</span></button><button class="gh-act" data-save><i class="fas fa-bookmark"></i> <span data-i18n="post_action_save">Save</span></button></div>'+
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

  /* ── Phase 37: Reaction Analytics ───────────────────────── */
  function _renderRxAnalytics(reactions){
    var box=document.getElementById('ghRxAnalytics'); if(!box) return;
    if(!reactions.length){ box.innerHTML=''; return; }
    var counts={}, total=reactions.length;
    reactions.forEach(function(r){ var t=r.type||'love'; counts[t]=(counts[t]||0)+1; });
    var sorted=Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; });
    box.innerHTML=
      '<div class="gh-rx-chart">'+
        sorted.map(function(t){
          var c=counts[t], pct=Math.round(c/total*100);
          return '<div class="gh-rx-bar-row">'+
            '<span class="gh-rx-bar-emoji">'+(RX_EMOJIS[t]||'❤️')+'</span>'+
            '<div class="gh-rx-bar-wrap"><div class="gh-rx-bar-fill" style="width:'+pct+'%"></div></div>'+
            '<span class="gh-rx-bar-stat">'+c+' <span class="gh-muted gh-rx-pct">('+pct+'%)</span></span>'+
          '</div>';
        }).join('')+
        '<div class="gh-rx-total">'+total+' total reaction'+(total===1?'':'s')+'</div>'+
      '</div>';
  }

  function openWhoReactedModal(pid) {
    if(!fs() || !db()) return;
    var body=
      '<div class="gh-rx-analytics" id="ghRxAnalytics"><div class="gh-muted" style="text-align:center;padding:8px"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+
      '<div class="gh-who-rx-divider"></div>'+
      '<div class="gh-who-rx-tabs" id="ghWhoRxTabs"><button class="gh-who-rx-tab active" data-rx-tab="all">All</button>'+Object.keys(RX_EMOJIS).map(function(t){ return '<button class="gh-who-rx-tab" data-rx-tab="'+t+'">'+RX_EMOJIS[t]+'</button>'; }).join('')+'</div>'+
      '<div id="ghWhoRxList"><i class="fas fa-circle-notch fa-spin gh-muted"></i></div>';
    modal('Reactions', body, '<button class="gh-btn ghost" data-close-modal>Close</button>', 'ghWhoRxModal');
    var allReactions = [];
    fs().getDocs(fs().query(fs().collection(db(),'posts',pid,'reactions'), fs().limit(100))).then(function(snap){
      snap.forEach(function(d){ allReactions.push(Object.assign({id:d.id}, d.data())); });
      // Render analytics bar chart immediately from counts
      _renderRxAnalytics(allReactions);
      // Fetch real user profiles
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
        return '<a class="gh-mini-item" href="'+profileLink(r.userId||r.id||'')+'"><span class="gh-avatar" style="width:36px;height:36px">'+av+'</span><div><strong>'+esc(name)+'</strong><span>'+(RX_EMOJIS[r.type||'love']||'❤️')+'</span></div></a>';
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
      if(e.target.closest('[data-like]') && !e.target.closest('.gh-reaction-strip')){ if(!requireLogin()) return; setReaction(pid,'love',card); if(window.ghPwaEngage) window.ghPwaEngage(1); }
      var ro=e.target.closest('[data-reaction]'); if(ro){ if(!requireLogin()) return; setReaction(pid,ro.dataset.reaction,card); if(window.ghPwaEngage) window.ghPwaEngage(1); }
      if(e.target.closest('[data-comment-toggle]')){ toggleComments(card,pid); if(window.ghPwaEngage) window.ghPwaEngage(1); }
      if(e.target.closest('[data-open-comments-btn]')){ openFocusedPost(pid); return; }
      if(e.target.closest('[data-open-shares-btn]')){ var scEl=card.querySelector('[data-share-count]'); openWhoSharedModal(pid, scEl ? Number(scEl.textContent||0) : 0); return; }
      if(e.target.closest('[data-share]')){ sharePost(pid); if(window.ghPwaEngage) window.ghPwaEngage(2); }
      if(e.target.closest('[data-save]')){ if(!requireLogin()) return; GS().toggleSavePost(pid,function(saved){ var b=card.querySelector('[data-save]'); if(b) b.classList.toggle('active',!!saved); }); if(window.ghPwaEngage) window.ghPwaEngage(1); }
      var menuBtn=e.target.closest('[data-post-menu]'); if(menuBtn){ postMenu(pid,card,menuBtn); }
      var trBtn=e.target.closest('[data-translate]'); if(trBtn){ e.stopPropagation(); _translatePost(trBtn); return; }
      var vpBtn=e.target.closest('[data-voice-play]'); if(vpBtn){ e.stopPropagation(); _toggleVoicePlay(vpBtn); return; }
      var rb=e.target.closest('[data-comment-reply]'); if(rb){ e.preventDefault(); openReplyForm(card,pid,rb.dataset.commentId); }
      var cr=e.target.closest('[data-copy-post-link]'); if(cr && navigator.clipboard){ navigator.clipboard.writeText(location.origin+location.pathname+'#post-'+pid).then(function(){toast('Post link copied');}); }
      var wrBtn=e.target.closest('[data-who-reacted]'); if(wrBtn){ openWhoReactedModal(wrBtn.dataset.whoReacted); }
      var pv=e.target.closest('[data-poll-vote]'); if(pv){ if(!requireLogin()) return; submitPollVote(pv.dataset.pid, pv.dataset.optId, card); }
      var clBtn=e.target.closest('[data-comment-like]'); if(clBtn){ if(!requireLogin()) return; toggleCommentReaction(pid, clBtn.dataset.commentId, clBtn.dataset.commentReaction||'love', clBtn); }
      var emojBtn=e.target.closest('.gh-comment-emoji'); if(emojBtn){ var frm=emojBtn.closest('.gh-comment-form,.gh-reply-form'); var inp=frm&&frm.querySelector('.gh-input'); if(inp) _openEmojiPicker(inp,emojBtn); return; }
      var micBtn=e.target.closest('.gh-comment-mic'); if(micBtn){ _handleCommentMic(micBtn); return; }
      var eb=e.target.closest('[data-edit-comment]'); if(eb){ e.preventDefault(); openFeedCommentEditor(pid, eb.dataset.commentId, eb); }
      var db2=e.target.closest('[data-delete-comment]'); if(db2){ e.preventDefault();
        window.ghConfirm(typeof GHt==='function'?GHt('comment_delete_cfm'):'Delete this comment?', function() {
          var cid2=db2.dataset.commentId;
          db2.disabled=true;
          fs().deleteDoc(fs().doc(db(),'posts',pid,'comments',cid2))
            .then(function(){
              var row=card.querySelector('[data-comment-id="'+CSS.escape(cid2)+'"]');
              if(row){row.style.transition='opacity .2s';row.style.opacity='0';setTimeout(function(){row.remove();},220);}
              fs().updateDoc(fs().doc(db(),'posts',pid),{commentCount:fs().increment(-1)}).catch(function(){});
              toast('Comment deleted');
            }).catch(function(err){db2.disabled=false;toast('Could not delete: '+(err.code||err.message),'error');});
        });
      }
      var drBtn=e.target.closest('[data-delete-reply]'); if(drBtn){ e.preventDefault();
        window.ghConfirm(typeof GHt==='function'?GHt('reply_delete_cfm'):'Delete this reply?', function() {
          var rid=drBtn.dataset.replyId, rcid=drBtn.dataset.commentId;
          drBtn.disabled=true;
          fs().deleteDoc(fs().doc(db(),'posts',pid,'comments',rcid,'replies',rid))
            .then(function(){
              var rrow=card.querySelector('[data-reply-id="'+CSS.escape(rid)+'"]');
              if(rrow){rrow.style.transition='opacity .2s';rrow.style.opacity='0';setTimeout(function(){rrow.remove();},220);}
              fs().updateDoc(fs().doc(db(),'posts',pid,'comments',rcid),{replyCount:fs().increment(-1)}).catch(function(){});
              var rkey=pid+'_'+rcid;
              if(state.cachedReplies[rkey]) state.cachedReplies[rkey]=state.cachedReplies[rkey].filter(function(r){return r.id!==rid;});
              toast('Reply deleted');
            }).catch(function(err){drBtn.disabled=false;toast('Could not delete: '+(err.code||err.message),'error');});
        });
      }
    });
    root.addEventListener('submit', function(e){
      var form=e.target.closest('[data-comment-form]');
      if(form){ e.preventDefault(); var card=form.closest('[data-post-id]'), pid=card.dataset.postId; var input=form.querySelector('.gh-cmt-text-input'); var val=input?input.value.trim():''; var cmtVBlob=form._cmt_voice_blob||null; if(!val && !cmtVBlob) return; if(!requireLogin()) return; state.openCommentPids[pid]=true;
        if(cmtVBlob){
          var _previewEl=form.querySelector('.gh-cmt-voice-preview');
          var _micBtn2=form.querySelector('.gh-comment-mic');
          if(_micBtn2){_micBtn2.disabled=true;_micBtn2.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>';}
          GS().uploadAudioBlob(cmtVBlob, authUser()&&authUser().uid, function(uploadedUrl){
            var extra2=Object.assign(buildActorExtra(),{voiceUrl:uploadedUrl||''});
            GS().addComment(pid, val, function(){ if(input) input.value=''; form._cmt_voice_blob=null; if(_previewEl) _previewEl.style.display='none'; if(_micBtn2){_micBtn2.disabled=false;_micBtn2.innerHTML='<i class="fas fa-microphone"></i>';} if(window.ghPwaEngage) window.ghPwaEngage(2); }, extra2);
          });
        } else {
          GS().addComment(pid, val, function(){ if(input) input.value=''; if(window.ghPwaEngage) window.ghPwaEngage(2); }, buildActorExtra());
        }
        return; }
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
    // Phase 40: bind @mention autocomplete on comment/reply inputs
    root.addEventListener('focusin', function(e){
      var inp = e.target.closest('.gh-comment-form .gh-input, .gh-reply-form .gh-input');
      if(inp) _bindMentionAutocomplete(inp);
    });
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
    cards.forEach(function(card){ if(card.querySelector('[data-poll-pid]')){ hydratePollVote(postId); hydratePollLive(card,postId); } });
    // Phase 49: track view once per session using IntersectionObserver
    var firstCard=cards[0];
    if(firstCard&&!firstCard._viewTracked&&u&&fs()&&db()){
      var _obs=new IntersectionObserver(function(entries,obs){
        if(entries[0]&&entries[0].isIntersecting){
          firstCard._viewTracked=true;
          obs.disconnect();
          fs().updateDoc(fs().doc(db(),'posts',postId),{viewCount:fs().increment(1)}).catch(function(){});
        }
      },{threshold:0.6});
      _obs.observe(firstCard);
    }
  }

  function setReaction(postId, type, card){
    var u=authUser(); if(!u) return requireLogin();
    var f=fs(), reactionRef=f.doc(db(),'posts',postId,'reactions',u.uid), postRef=f.doc(db(),'posts',postId);
    f.getDoc(reactionRef).then(function(snap){
      var exists=snap.exists(), prev=exists ? (snap.data().type||'like') : '';
      if(exists && prev===type){
        // Same reaction clicked again → remove it (delta = -1)
        return f.deleteDoc(reactionRef).then(function(){ return f.updateDoc(postRef,{likeCount:f.increment(-1), reactionCount:f.increment(-1)}).catch(function(){}); }).then(function(){ updateReactionUi(card,'',-1); });
      }
      var write=f.setDoc(reactionRef,{userId:u.uid,type:type,createdAt:f.serverTimestamp(),updatedAt:f.serverTimestamp()},{merge:true});
      // New reaction → +1; changing type → 0 (count unchanged)
      var delta=exists?0:1;
      if(!exists) write=write.then(function(){ return f.updateDoc(postRef,{likeCount:f.increment(1), reactionCount:f.increment(1)}).catch(function(){}); });
      return write.then(function(){ updateReactionUi(card,type,delta); });
    }).catch(function(err){ console.error('setReaction',err); toast('Reaction failed','error'); });
  }

  function updateReactionUi(card,type,delta){
    if(!card) return;
    var pid=card.dataset&&card.dataset.postId;
    var targets=pid?Array.from(document.querySelectorAll('[data-post-id="'+CSS.escape(pid)+'"]')):[card];
    targets.forEach(function(c){
      // Update like button label + active state
      var like=c.querySelector('[data-like]');
      if(like){ like.classList.toggle('active',!!type); like.innerHTML=(type==='love'?'❤️ Love':type==='haha'?'😂 Haha':type==='wow'?'😮 Wow':type==='sad'?'😢 Sad':type==='angry'?'😡 Angry':type==='clap'?'👏 Clap':'❤️ Like'); }
      $all('[data-reaction]',c).forEach(function(b){ b.classList.toggle('active',b.dataset.reaction===type); });
      // Update like count display immediately (no Firestore re-read needed)
      if(delta){
        var countEl=c.querySelector('[data-like-count]');
        if(countEl){
          var n=Math.max(0,(parseInt(countEl.textContent,10)||0)+delta);
          countEl.textContent=n;
          // Update sibling text node "X people reacted"
          var btn=countEl.parentElement;
          if(btn && btn.lastChild && btn.lastChild.nodeType===3){
            btn.lastChild.textContent=n?' people reacted':'';
          }
        }
      }
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

  /* Phase 20: track rendered comment IDs per-pid for diff render */
  var _cmtRendered={};

  function renderCommentsForPid(pid, items){
    var cards=document.querySelectorAll('[data-post-id="'+CSS.escape(pid)+'"]');
    if(!cards.length) return;
    var visible=items.filter(function(c){
      if(c.status==='deleted') return false;
      var uid=c.authorId||c.userId||'';
      return !uid||(state.blockedUserIds.indexOf(uid)===-1&&state.mutedUserIds.indexOf(uid)===-1);
    });
    /* Live comment count update on button + stat */
    var cnt=visible.length;
    cards.forEach(function(card){
      var cb=card.querySelector('[data-comment-count]'); if(cb) cb.textContent=cnt;
    });
    /* Diff: find new IDs not yet in DOM */
    var prev=_cmtRendered[pid]||{};
    var newIds={};
    visible.forEach(function(c){ newIds[c.id]=true; });
    /* Full re-render if list was empty before, else diff */
    var wasEmpty=!Object.keys(prev).length;
    cards.forEach(function(card){
      var list=card.querySelector('[data-comments-list]'); if(!list) return;
      var box=card.querySelector('[data-comments]');
      if(box && state.openCommentPids[pid]) box.hidden=false;
      if(!visible.length){
        list.innerHTML='<div class="gh-small" style="padding:10px 6px">No comments yet.</div>';
        return;
      }
      if(wasEmpty){
        list.innerHTML=visible.map(function(c){ return commentCard(pid,c); }).join('');
        return;
      }
      /* Remove deleted */
      list.querySelectorAll('[data-comment-id]').forEach(function(el){
        if(!newIds[el.dataset.commentId]){ el.classList.add('gh-cmt-exit'); setTimeout(function(){ el.remove(); },300); }
      });
      /* Add new */
      visible.forEach(function(c){
        if(prev[c.id]) return; /* already in DOM */
        var tmp=document.createElement('div');
        tmp.innerHTML=commentCard(pid,c);
        var newEl=tmp.firstElementChild;
        newEl.classList.add('gh-cmt-enter');
        list.appendChild(newEl);
        loadReplies(pid,c.id);
        requestAnimationFrame(function(){ requestAnimationFrame(function(){ newEl.classList.remove('gh-cmt-enter'); }); });
      });
    });
    _cmtRendered[pid]=newIds;
    if(wasEmpty) visible.forEach(function(c){ loadReplies(pid,c.id); });
  }

  function toggleComments(card,pid){
    var box=card.querySelector('[data-comments]'); if(!box) return;
    box.hidden=!box.hidden;
    if(box.hidden){
      delete state.openCommentPids[pid];
      delete _cmtRendered[pid]; /* reset diff state */
      _stopTypingIndicator(pid);
      return;
    }
    state.openCommentPids[pid]=true;
    delete _cmtRendered[pid]; /* reset on open so first load is a clean render */
    // If listener already active, render from cache and return
    if(state.postsUnsubs[pid]){
      if(state.cachedComments[pid]) renderCommentsForPid(pid, state.cachedComments[pid]);
      _startTypingIndicator(pid, box);
      return;
    }
    state.postsUnsubs[pid]=GS().listenComments(pid,function(items){
      state.cachedComments[pid]=items;
      renderCommentsForPid(pid, items);
    });
    _startTypingIndicator(pid, box);
  }

  /* ── Phase 20: Typing indicator ─────────────────────── */
  var _typingUnsubs={};
  var _myTypingTimer={};

  function _startTypingIndicator(pid, commentBox){
    if(!commentBox||!fs()||!db()) return;
    /* ensure typing-row slot exists */
    var slot=commentBox.querySelector('[data-typing-row]');
    if(!slot){ slot=document.createElement('div'); slot.setAttribute('data-typing-row',''); commentBox.insertBefore(slot,commentBox.querySelector('[data-comment-form]')); }
    /* listen to typing/{uid} docs under this post */
    if(_typingUnsubs[pid]) return;
    var u=authUser();
    _typingUnsubs[pid]=fs().onSnapshot(
      fs().collection(db(),'posts',pid,'typing'),
      function(snap){
        var names=[];
        var now=Date.now();
        snap.forEach(function(d){
          var data=d.data()||{};
          if(u&&d.id===u.uid) return; /* skip self */
          var ms=data.at&&data.at.toMillis?data.at.toMillis():(typeof data.at==='number'?data.at:0);
          if(now-ms<8000) names.push(data.name||'Someone');
        });
        var rows=document.querySelectorAll('[data-post-id="'+CSS.escape(pid)+'"] [data-typing-row]');
        rows.forEach(function(r){
          if(!names.length){ r.innerHTML=''; return; }
          var label=names.length===1?names[0]+' is typing…':names.length+' people are typing…';
          r.innerHTML='<div class="gh-typing-row"><span class="gh-typing-dots"><span></span><span></span><span></span></span><span class="gh-typing-label">'+esc(label)+'</span></div>';
        });
      },
      function(){ /* ignore errors — typing is nice-to-have */ }
    );

    /* Write own typing status on input */
    var form=commentBox.querySelector('[data-comment-form]');
    if(form && !form.dataset.typingBound){
      form.dataset.typingBound='1';
      var inp=form.querySelector('input,textarea');
      if(inp){
        inp.addEventListener('input',function(){
          var u2=authUser(); if(!u2||!fs()||!db()) return;
          var me=u2.displayName||u2.email||'Someone';
          clearTimeout(_myTypingTimer[pid]);
          fs().setDoc(fs().doc(db(),'posts',pid,'typing',u2.uid),{name:me,at:fs().serverTimestamp()},{merge:true}).catch(function(){});
          _myTypingTimer[pid]=setTimeout(function(){ _clearMyTyping(pid); },5000);
        });
        inp.addEventListener('blur',function(){ _clearMyTyping(pid); });
        form.addEventListener('submit',function(){ _clearMyTyping(pid); });
      }
    }
  }

  function _stopTypingIndicator(pid){
    if(_typingUnsubs[pid]){ try{_typingUnsubs[pid]();}catch(e){} delete _typingUnsubs[pid]; }
    _clearMyTyping(pid);
  }

  function _clearMyTyping(pid){
    clearTimeout(_myTypingTimer[pid]);
    var u=authUser(); if(!u||!fs()||!db()) return;
    fs().deleteDoc(fs().doc(db(),'posts',pid,'typing',u.uid)).catch(function(){});
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
    var cmtVoiceHtml = c.voiceUrl ? '<div class="gh-cmt-voice-note"><audio controls src="'+esc(c.voiceUrl)+'" preload="none" style="height:32px;max-width:220px;border-radius:20px;margin-top:4px"></audio></div>' : '';
    return '<div class="gh-comment-row" data-comment-id="'+esc(c.id)+'">'+
      avAnchor+
      '<div class="gh-comment-main"><div class="gh-comment-bubble"><strong>'+nameAnchor+'</strong>'+(c.text?'<span class="gh-cmt-text" data-cmt-text>'+esc(c.text)+'</span>':'')+cmtVoiceHtml+'</div>'+
      '<div class="gh-small gh-comment-actions"><span data-cmt-time="'+(c.createdAt&&c.createdAt.toMillis?c.createdAt.toMillis():0)+'">'+timeAgo(c.createdAt)+'</span> · <button type="button" data-comment-reply data-comment-id="'+esc(c.id)+'">Reply</button>'+
      ' · <span class="gh-cmt-rx-wrap"><button type="button" class="gh-cmt-act gh-cmt-rx-btn'+(rxType?' active':'')+'" data-comment-like data-comment-id="'+esc(c.id)+'" data-comment-reaction="'+esc(rxType||'like')+'">'+rxLabel+'</button>'+
      '<span class="gh-cmt-rx-picker" data-rx-picker="'+esc(c.id)+'">'+Object.keys(RX_EMOJIS).map(function(t){ return '<button type="button" class="gh-cmt-rx-pick" data-comment-like data-comment-id="'+esc(c.id)+'" data-comment-reaction="'+t+'">'+RX_EMOJIS[t]+'</button>'; }).join('')+'</span></span>'+
      ownerBtns+'</div>'+
      '<form class="gh-reply-form" data-reply-form data-comment-id="'+esc(c.id)+'" hidden><button class="gh-comment-emoji" type="button" title="Emoji"><i class="fas fa-face-smile"></i></button><input class="gh-input" placeholder="Write a reply…"><button class="gh-btn sm"><i class="fas fa-paper-plane"></i></button></form>'+
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

  // Voice comment recording state machine
  var _cmtMicRec=null, _cmtMicChunks=[], _cmtMicActive=null;
  function _handleCommentMic(btn){
    if(!requireLogin()) return;
    var form=btn.closest('.gh-comment-form'); if(!form) return;
    var preview=form.querySelector('.gh-cmt-voice-preview');

    // If already recording on this button — stop
    if(btn._cmtRecording){
      btn._cmtRecording=false;
      if(_cmtMicRec && _cmtMicRec.state==='recording') _cmtMicRec.stop();
      return;
    }

    // If another button is recording — stop it first
    if(_cmtMicActive && _cmtMicActive!==btn){
      _cmtMicActive._cmtRecording=false;
      if(_cmtMicRec && _cmtMicRec.state==='recording') _cmtMicRec.stop();
    }

    navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
      _cmtMicChunks=[];
      _cmtMicRec=new MediaRecorder(stream);
      _cmtMicActive=btn;
      btn._cmtRecording=true;
      btn.classList.add('recording');
      btn.innerHTML='<i class="fas fa-stop-circle"></i>';

      _cmtMicRec.ondataavailable=function(ev){ if(ev.data&&ev.data.size>0) _cmtMicChunks.push(ev.data); };
      _cmtMicRec.onstop=function(){
        stream.getTracks().forEach(function(t){t.stop();});
        btn.classList.remove('recording');
        btn.innerHTML='<i class="fas fa-microphone"></i>';
        btn._cmtRecording=false;
        _cmtMicActive=null;
        if(!_cmtMicChunks.length) return;
        var blob=new Blob(_cmtMicChunks,{type:_cmtMicRec.mimeType||'audio/webm'});
        form._cmt_voice_blob=blob;
        var objUrl=URL.createObjectURL(blob);
        if(preview){
          preview.style.display='flex';
          preview.innerHTML='<audio controls src="'+objUrl+'" preload="none" style="height:32px;max-width:180px;border-radius:20px"></audio>'+
            '<button type="button" class="gh-cmt-voice-del" title="Remove" style="background:none;border:none;color:var(--gh-muted);cursor:pointer;padding:0 4px"><i class="fas fa-times"></i></button>';
          var delBtn=preview.querySelector('.gh-cmt-voice-del');
          if(delBtn) delBtn.onclick=function(){ preview.style.display='none'; preview.innerHTML=''; form._cmt_voice_blob=null; };
        }
      };
      _cmtMicRec.start();
    }).catch(function(){ toast('Microphone access denied','error'); });
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
        '<button class="gh-share-opt" id="ghQuickRepost">' +
          '<span class="gh-share-opt-icon gh-repost-icon"><i class="fas fa-retweet"></i></span>' +
          '<span class="gh-share-opt-text"><strong>Repost</strong><em>Instantly share to your feed</em></span>' +
        '</button>' +
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

    document.getElementById('ghQuickRepost').onclick = function() { closeSheet(); _quickRepost(pid); };
    document.getElementById('ghShareToFeed').onclick = function() { closeSheet(); openShareCompose(pid); };
    document.getElementById('ghShareToStory').onclick = function() {
      closeSheet();
      if (typeof openStoryModal === 'function') { openStoryModal(pid); return; }
      // Fallback: open story composer prefilled with post link
      var url = location.origin + location.pathname + '#post-' + pid;
      var body =
        '<textarea class="gh-cmp-textarea" id="ghStoryTextShare" placeholder="What\'s your story?…" rows="3"></textarea>'+
        '<p style="font-size:.75rem;color:#94a3b8;margin:6px 0 0"><i class="fas fa-link"></i> ' + url + '</p>';
      var m = modal((typeof GHt==='function'?GHt('story_share_modal'):'Add to your story'), body,
        '<button class="gh-btn ghost" data-close-modal>'+(typeof GHt==='function'?GHt('cancel'):'Cancel')+'</button><button class="gh-btn" id="ghSubmitStoryShare">'+(typeof GHt==='function'?GHt('story_share_btn'):'Share story')+'</button>',
        'ghStoryShareModal');
      var btn = document.getElementById('ghSubmitStoryShare');
      if (btn) btn.onclick = function() {
        btn.disabled = true; btn.textContent = (typeof GHt==='function'?GHt('story_sharing'):'Sharing…');
        var text = (document.getElementById('ghStoryTextShare') || {}).value || '';
        var u2 = requireLogin() && window.GeoCurrentUser;
        if (!u2) { toast(typeof GHt==='function'?GHt('please_sign_in'):'Please sign in', 'error'); return; }
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

  /* ── Phase 44: Quick Repost ─────────────────────────────── */
  function _quickRepost(pid){
    var u=authUser(); if(!u) return requireLogin();
    var f=fs(), d=db(); if(!f||!d) return;
    // Check if already reposted
    f.getDocs(f.query(
      f.collection(d,'posts'),
      f.where('authorId','==',u.uid),
      f.where('sharedPostId','==',pid),
      f.where('isRepost','==',true),
      f.limit(1)
    )).then(function(snap){
      if(!snap.empty){
        // Already reposted → undo
        window.ghConfirm(typeof GHt==='function'?GHt('repost_remove_cfm'):'Remove your repost?', function() {
          var repostDoc=snap.docs[0];
          f.deleteDoc(f.doc(d,'posts',repostDoc.id)).then(function(){
            f.updateDoc(f.doc(d,'posts',pid),{reshareCount:f.increment(-1)}).catch(function(){});
            toast('Repost removed');
          });
        });
        return;
      }
      // Create repost
      var me=window.GeoCurrentUser||{};
      return f.addDoc(f.collection(d,'posts'),{
        text:'',
        authorId:u.uid,
        userId:u.uid,
        authorName:me.displayName||u.displayName||'GeoHub User',
        authorAvatar:me.photoURL||u.photoURL||'',
        authorType:'user',
        isRepost:true,
        sharedPostId:pid,
        visibility:'public',
        status:'active',
        likeCount:0, commentCount:0, shareCount:0, reshareCount:0,
        createdAt:f.serverTimestamp()
      }).then(function(){
        f.updateDoc(f.doc(d,'posts',pid),{reshareCount:f.increment(1)}).catch(function(){});
        toast('🔁 Reposted!');
      });
    }).catch(function(e){ toast('Repost failed: '+(e.message||e.code),'error'); });
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
      items += '<button class="gh-pmenu-item" data-menu-analytics><i class="fas fa-chart-bar"></i> View Analytics</button>';
      items += '<button class="gh-pmenu-item" data-menu-pin><i class="fas fa-thumbtack"></i> Pin to profile</button>';
      items += '<button class="gh-pmenu-item" data-menu-boost><i class="fas fa-bolt-lightning"></i> Boost post</button>';
      items += '<button class="gh-pmenu-item danger" data-menu-delete-post><i class="fas fa-trash"></i> Delete post</button>';
      items += '<div class="gh-pmenu-sep"></div>';
    }
    items += '<button class="gh-pmenu-item" data-copy-post-link><i class="fas fa-link"></i> Copy link</button>';
    items += '<button class="gh-pmenu-item" data-menu-save><i class="fas fa-bookmark"></i> Save post</button>';
    if(!isOwn && authorId){ items += '<button class="gh-pmenu-item" data-menu-tip><i class="fas fa-coins" style="color:#f59e0b"></i> Send tip</button>'; }
    items += '<button class="gh-pmenu-item" data-menu-save-col><i class="fas fa-folder-plus"></i> Save to Collection</button>';
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
        window.ghConfirm(typeof GHt==='function'?GHt('post_delete_cfm'):'Delete this post? This cannot be undone.', function() {
          fs().updateDoc(fs().doc(db(),'posts',pid), { status:'deleted', updatedAt:fs().serverTimestamp() })
            .then(function(){ if(card){ card.style.transition='opacity .25s'; card.style.opacity='0'; setTimeout(function(){ card.remove(); },260); } toast('Post deleted'); })
            .catch(function(err){ toast('Could not delete: '+(err.code||err.message),'error'); });
        });
        return;
      }
      if (e.target.closest('[data-copy-post-link]')) { navigator.clipboard && navigator.clipboard.writeText(location.origin+location.pathname+'#post-'+pid).then(function(){toast('Link copied!');}); closeDrop(); return; }
      if (e.target.closest('[data-menu-save]')) { if(GS().toggleSavePost) GS().toggleSavePost(pid); closeDrop(); return; }
      if (e.target.closest('[data-menu-save-col]')) { closeDrop(); openSaveToCollection(pid); return; }
      if (e.target.closest('[data-menu-analytics]') && isOwn) { closeDrop(); _openPostAnalytics(pid, card); return; }
      if (e.target.closest('[data-menu-pin]') && isOwn) { closeDrop(); _pinPostToProfile(pid); return; }
      if (e.target.closest('[data-menu-boost]') && isOwn) { closeDrop(); _openBoostModal(pid, card); return; }
      if (e.target.closest('[data-menu-tip]') && !isOwn && authorId) { closeDrop(); _openTipModal(authorId, authorName||'Creator'); return; }
      if (e.target.closest('[data-menu-hide]')) { if(GS().hidePost) GS().hidePost(pid, function(){ if(card) card.remove(); }); closeDrop(); return; }
      if (e.target.closest('[data-menu-report]')) { closeDrop(); if(window.GeoModeration) window.GeoModeration.openReportModal('post', pid, ''); else if(GS().reportTarget) GS().reportTarget('post', pid, 'Reported'); return; }
      if (e.target.closest('[data-menu-report-user]') && authorId) { closeDrop(); if(window.GeoModeration) window.GeoModeration.openReportModal('user', authorId, authorName); else if(GS().reportTarget) GS().reportTarget('user', authorId, 'Reported'); return; }
      if (e.target.closest('[data-menu-mute-user]') && authorId) { closeDrop(); if(window.GeoModeration) window.GeoModeration.openMuteConfirm(authorId, authorName, function(){ if(GS().muteUser) GS().muteUser(authorId); }); else if(GS().muteUser) GS().muteUser(authorId); return; }
      if (e.target.closest('[data-menu-block-user]') && authorId) { closeDrop(); if(window.GeoModeration) window.GeoModeration.openBlockConfirm(authorId, authorName, function(){ if(GS().blockUser) GS().blockUser(authorId, function(){ if(card) card.remove(); }); }); else if(GS().blockUser) GS().blockUser(authorId, function(){ if(card) card.remove(); }); return; }
    });

    ensurePostMenuDismissers();
  }

  /* ── Phase 54: Post Boost Modal ─────────────────────────── */
  function _openBoostModal(pid, card){
    if(!requireLogin()) return;
    if(!fs()||!db()) return;
    // Check current boost state
    fs().getDoc(fs().doc(db(),'posts',pid)).then(function(snap){
      var p=snap.exists()?snap.data():{};
      var isActive=p.boosted && (!p.boostExpiresAt || ts(p.boostExpiresAt)>Date.now());
      var boostInfo='';
      if(isActive && p.boostExpiresAt){
        var rem=Math.max(0,Math.round((ts(p.boostExpiresAt)-Date.now())/3600000));
        boostInfo='<div class="gh-boost-badge" style="margin-bottom:10px"><i class="fas fa-bolt-lightning"></i> Boosted — '+rem+'h remaining</div>';
      }
      var body='<div class="gh-boost-panel">'+
        '<h4><i class="fas fa-bolt-lightning"></i> Boost this Post</h4>'+
        '<p class="gh-boost-info">Boosted posts appear higher in the feed and are labelled as Sponsored. Other users will see your post more often.</p>'+
        boostInfo+
        '<div style="margin-bottom:4px;font-size:.82rem;font-weight:600;color:var(--gh-muted)">Duration</div>'+
        '<div class="gh-boost-actions">'+
          '<button class="gh-btn sm ghost" data-boost-h="6">6 hours</button>'+
          '<button class="gh-btn sm ghost" data-boost-h="24">24 hours</button>'+
          '<button class="gh-btn sm ghost" data-boost-h="72">3 days</button>'+
          '<button class="gh-btn sm ghost" data-boost-h="168">7 days</button>'+
        '</div>'+
      '</div>'+
      (isActive?'<button class="gh-btn ghost danger" id="ghBoostStop" style="margin-top:8px;width:100%"><i class="fas fa-stop"></i> Stop Boost</button>':'');
      modal('Boost Post',body,'<button class="gh-btn ghost" data-close-modal>Cancel</button>','ghBoostModal');
      // Attach listeners after modal renders
      setTimeout(function(){
        var m=document.getElementById('ghBoostModal');
        if(!m) return;
        m.querySelectorAll('[data-boost-h]').forEach(function(btn){
          btn.onclick=function(){
            var hours=Number(btn.dataset.boostH)||24;
            var exp=new Date(Date.now()+hours*3600000);
            fs().updateDoc(fs().doc(db(),'posts',pid),{
              boosted:true,
              boostExpiresAt:fs().Timestamp.fromDate(exp),
              boostStartedAt:fs().serverTimestamp()
            }).then(function(){
              toast('🚀 Post boosted for '+hours+' hours!');
              m.remove();
              // Update card badge visually
              if(card){
                var nameRow=card.querySelector('.gh-post-name-row');
                if(nameRow && !nameRow.querySelector('.gh-sponsored-label')){
                  nameRow.insertAdjacentHTML('beforeend','<span class="gh-sponsored-label"><i class="fas fa-bolt-lightning"></i>'+t('sponsored')+'</span>');
                }
              }
            }).catch(function(err){ toast('Failed: '+(err.message||err.code),'error'); });
          };
        });
        var stopBtn=document.getElementById('ghBoostStop');
        if(stopBtn){
          stopBtn.onclick=function(){
            fs().updateDoc(fs().doc(db(),'posts',pid),{
              boosted:false,
              boostExpiresAt:null
            }).then(function(){
              toast('Boost stopped.');
              m.remove();
              if(card){ var sl=card.querySelector('.gh-sponsored-label'); if(sl) sl.remove(); }
            }).catch(function(err){ toast('Failed: '+(err.message||err.code),'error'); });
          };
        }
      },50);
    }).catch(function(err){ toast('Error: '+(err.message||err.code),'error'); });
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
    saveBtn.textContent = (typeof GHt==='function'?GHt('save'):'Save');
    var cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'margin-top:4px;margin-left:6px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:.8rem;padding:4px 8px;font-family:inherit';
    cancelBtn.textContent = (typeof GHt==='function'?GHt('cancel'):'Cancel');
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
      '<div class="gh-panel gh-right-widget" id="ghLiveActivityPanel">'+
        '<div class="gh-section-title"><h3><span class="gh-live-dot"></span> Live Activity</h3></div>'+
        '<div id="ghLiveActivityList"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div>'+
      '</div>'+
      '<div class="gh-panel gh-right-widget" id="ghCreatorPanel"><div class="gh-section-title"><h3>Featured Creators</h3><a class="gh-small" href="creators.html">All</a></div><div id="ghCreatorList"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div></div>'+
      '<div class="gh-panel gh-right-widget" id="ghTrendingPanel">'+
        '<div class="gh-section-title"><h3>🔥 Trending Hashtags</h3></div>'+
        '<div id="ghTrendingList"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div>'+
      '</div>'+
      '<div class="gh-panel gh-right-widget" id="ghTrendingPostsPanel">'+
        '<div class="gh-section-title"><h3>⚡ Trending Posts</h3></div>'+
        '<div id="ghTrendingPostsList"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div>'+
      '</div>'+
      '<div class="gh-panel gh-right-widget" id="ghLeaderPanel">'+
        '<div class="gh-section-title"><h3>🏆 Top Creators</h3><a class="gh-small" href="creators.html">ყველა</a></div>'+
        '<div class="gh-ldr-cities" id="ghLdrCities">'+
          '<button class="gh-ldr-city active" data-ldr-city="">🌍 Georgia</button>'+
          '<button class="gh-ldr-city" data-ldr-city="თბილისი">🏙️ თბილისი</button>'+
          '<button class="gh-ldr-city" data-ldr-city="ბათუმი">🌊 ბათუმი</button>'+
          '<button class="gh-ldr-city" data-ldr-city="ქუთაისი">🏔️ ქუთაისი</button>'+
        '</div>'+
        '<div id="ghLeaderList"><div class="gh-muted" style="font-size:.82rem">Loading…</div></div>'+
      '</div>'+
      '<div class="gh-panel gh-wrapped-teaser" id="ghWrappedTeaser" style="display:none">'+
        '<div class="gh-wt-glow"></div>'+
        '<div class="gh-wt-content">'+
          '<div class="gh-wt-icon">🇬🇪</div>'+
          '<div class="gh-wt-text">'+
            '<strong>GeoHub Wrapped '+(new Date().getFullYear())+'</strong>'+
            '<span>შენი წლის სტატისტიკა</span>'+
          '</div>'+
          '<button class="gh-btn sm gh-wt-open-btn" id="ghWrappedOpenBtn"><i class="fas fa-play"></i></button>'+
        '</div>'+
      '</div>'+
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
        if (!list.children.length) status.textContent = (typeof GHt==='function'?GHt('profile_no_followers'):'No followers yet');
        return;
      }
      var btn = document.createElement('button');
      btn.className = 'gh-btn ghost gh-aud-load-more';
      btn.textContent = (typeof GHt==='function'?GHt('load_more'):'Load more');
      btn.onclick = function() {
        if (!_lastDoc) return;
        btn.disabled = true; btn.textContent = (typeof GHt==='function'?GHt('loading'):'Loading…');
        var q = _audienceQueryAfter(bizId, _lastDoc);
        if (!q) { _done = true; btn.remove(); return; }
        fs().getDocs(q).then(function(snap){
          appendRows(snap);
          btn.remove();
          showLoadMore();
        }).catch(function(err){
          btn.disabled = false; btn.textContent = (typeof GHt==='function'?GHt('load_more'):'Load more');
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
        loadLeaderboardWidget(''); loadTrendingHashtags(); loadTrendingPostsWidget(); startLiveActivityTicker(); loadFeedGroupsWidget(); loadFeedEventsWidget(null); loadFeedCheckinsWidget();
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
          loadLeaderboardWidget(''); loadTrendingHashtags(); loadTrendingPostsWidget(); startLiveActivityTicker(); loadFeedGroupsWidget(); loadFeedEventsWidget(null); loadFeedCheckinsWidget();
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
        loadLeaderboardWidget(u.uid);
        loadTrendingHashtags();
        loadTrendingPostsWidget();
        startLiveActivityTicker();
        loadFeedGroupsWidget();
        loadFeedEventsWidget(u.uid);
        loadFeedCheckinsWidget();
      });
    });
  }

  function loadPymkWidget(uid){
    var box=$('#ghPymkList'); if(!box) return;
    if(!fs()||!db()){ box.innerHTML=''; var p=$('#ghPymkPanel'); if(p) p.style.display='none'; return; }
    // Phase 31: Smart PYMK v2 — friends-of-friends + social proof
    var alreadyFollowing=new Set(state.followingIds||[]);
    alreadyFollowing.add(uid);
    // Step 1: get current user profile for city/interests
    fs().getDoc(fs().doc(db(),'users',uid)).then(function(meSnap){
      var meData=meSnap.exists()?meSnap.data():{};
      var myCity=(meData.city||'').toLowerCase();
      // Step 2: if following someone, get one person they follow (FOF)
      var fofPromise=Promise.resolve([]);
      if(state.followingIds&&state.followingIds.length){
        var sampleFollowing=state.followingIds[Math.floor(Math.random()*state.followingIds.length)];
        fofPromise=fs().getDocs(fs().query(
          fs().collection(db(),'follows'),
          fs().where('followerId','==',sampleFollowing),
          fs().limit(10)
        )).then(function(snap){
          var fofIds=[];
          snap.forEach(function(d){ var fid=d.data().followedId||d.id; if(!alreadyFollowing.has(fid)) fofIds.push({uid:fid,referrer:sampleFollowing}); });
          return fofIds;
        }).catch(function(){ return []; });
      }
      // Step 3: get popular users from same city
      var cityPromise=myCity?
        fs().getDocs(fs().query(fs().collection(db(),'users'),fs().where('city','==',meData.city),fs().orderBy('followerCount','desc'),fs().limit(8))).then(function(snap){
          var arr=[]; snap.forEach(function(d){ if(!alreadyFollowing.has(d.id)){ var x=d.data(); arr.push({id:d.id,fullName:x.fullName||x.displayName||'User',avatar:x.avatar||x.photoURL||'',city:x.city||'',accountType:x.accountType||'',followerCount:Number(x.followerCount||0),_reason:'📍 '+esc(meData.city)}); } }); return arr;
        }).catch(function(){ return []; })
        : Promise.resolve([]);
      Promise.all([fofPromise, cityPromise]).then(function(results){
        var fofList=results[0]||[], cityList=results[1]||[];
        // Resolve FOF user docs
        var fofDocPromises=fofList.slice(0,4).map(function(item){
          return fs().getDoc(fs().doc(db(),'users',item.uid)).then(function(s){
            if(!s.exists()) return null;
            var d=s.data();
            return {id:s.id,fullName:d.fullName||d.displayName||'User',avatar:d.avatar||d.photoURL||'',city:d.city||'',accountType:d.accountType||'',followerCount:Number(d.followerCount||0),_reason:'👥 Followed by someone you follow'};
          }).catch(function(){ return null; });
        });
        Promise.all(fofDocPromises).then(function(fofDocs){
          // Merge: FOF first, then city, then dedupe
          var seen=new Set(alreadyFollowing);
          var merged=[];
          fofDocs.concat(cityList).forEach(function(p){
            if(!p||seen.has(p.id)) return;
            seen.add(p.id);
            merged.push(p);
          });
          // Fallback: if still empty, get top followers
          if(!merged.length){
            return fs().getDocs(fs().query(fs().collection(db(),'users'),fs().orderBy('followerCount','desc'),fs().limit(10))).then(function(snap){
              var arr=[]; snap.forEach(function(d){ if(!alreadyFollowing.has(d.id)){ var x=d.data(); arr.push({id:d.id,fullName:x.fullName||x.displayName||'User',avatar:x.avatar||x.photoURL||'',city:x.city||'',accountType:x.accountType||'',followerCount:Number(x.followerCount||0),_reason:'⭐ Popular on GeoHub'}); } }); _renderPymk(box,arr.slice(0,5));
            }).catch(function(){ var p=$('#ghPymkPanel'); if(p) p.style.display='none'; });
          }
          _renderPymk(box, merged.slice(0,5));
        });
      });
    }).catch(function(){ var p=$('#ghPymkPanel'); if(p) p.style.display='none'; });
  }

  function _renderPymk(box, people){
    if(!people.length){ var p=$('#ghPymkPanel'); if(p) p.style.display='none'; return; }
    box.innerHTML='<div class="gh-mini-list">'+people.map(function(p){
      var avHtml=p.avatar?'<img src="'+esc(p.avatar)+'" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.onerror=null;this.parentNode.innerHTML=\'<span style=&quot;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6d3fd9,#10b981);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:700;flex-shrink:0&quot;>'+esc(initials(p.fullName))+'</span>\'">':'<span style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6d3fd9,#10b981);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:700;flex-shrink:0">'+esc(initials(p.fullName))+'</span>';
      var creatorChip=p.accountType==='creator'?'<span style="font-size:.62rem;color:#10b981;font-weight:700;margin-left:2px">✦Creator</span>':'';
      var followerStr=p.followerCount?_fmtCount(p.followerCount)+' followers':'';
      var reason=p._reason||'';
      return '<div class="gh-mini-item" style="gap:8px">'+
        '<a href="profile.html?id='+esc(p.id)+'" style="flex-shrink:0;line-height:0">'+avHtml+'</a>'+
        '<div style="flex:1;min-width:0;overflow:hidden">'+
          '<div style="font-size:.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(p.fullName)+creatorChip+'</div>'+
          '<div style="font-size:.68rem;color:var(--gh-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+reason+(followerStr&&reason?' · ':'')+followerStr+'</div>'+
        '</div>'+
        '<button class="gh-btn sm ghost gh-pymk-btn" data-pymk-uid="'+esc(p.id)+'" style="flex-shrink:0;padding:4px 8px;font-size:.72rem">'+(typeof GHt==='function'?GHt('follow'):'Follow')+'</button>'+
      '</div>';
    }).join('')+'</div>';
    Array.from(box.querySelectorAll('.gh-pymk-btn')).forEach(function(btn){
      btn.onclick=function(){
        var tid=btn.dataset.pymkUid;
        if(!GS()||!GS().toggleFollow) return;
        GS().toggleFollow(tid,function(isNow){
          btn.textContent=isNow?(typeof GHt==='function'?GHt('unfollow'):'Following'):(typeof GHt==='function'?GHt('follow'):'Follow');
          btn.classList.toggle('gh-btn-active',!!isNow);
        });
      };
    });
  }

  /* ── Phase 39: Scheduled Posts — auto-publish ───────────── */
  function checkAndPublishScheduledPosts(uid){
    if(!uid||!fs()||!db()) return;
    var now=new Date();
    fs().getDocs(
      fs().query(
        fs().collection(db(),'posts'),
        fs().where('authorId','==',uid),
        fs().where('status','==','scheduled'),
        fs().where('scheduledAt','<=',now),
        fs().limit(15)
      )
    ).then(function(snap){
      if(!snap.size) return;
      var batch=fs().writeBatch(db());
      snap.forEach(function(d){
        batch.update(fs().doc(db(),'posts',d.id),{status:'active',publishedAt:fs().serverTimestamp()});
      });
      return batch.commit().then(function(){
        toast('📅 '+snap.size+' scheduled post'+(snap.size>1?'s':'')+' published!');
      });
    }).catch(function(){});
  }

  /* ── Phase 57: Post Insights Notifications ──────────────── */
  var _insightUnsubs=[];
  var _INSIGHT_MILESTONES=[
    {field:'likeCount',   vals:[5,10,25,50,100,250,500], icon:'🔥', msg:function(n){ return 'Your post got '+n+' reactions!'; }},
    {field:'viewCount',   vals:[50,100,250,500,1000],     icon:'👁️', msg:function(n){ return n+' people viewed your post'; }},
    {field:'commentCount',vals:[5,10,25,50],              icon:'💬', msg:function(n){ return 'Your post has '+n+' comments!'; }},
    {field:'shareCount',  vals:[3,5,10,25],               icon:'🔁', msg:function(n){ return 'Your post was shared '+n+' times!'; }}
  ];
  function startPostInsightsListener(uid){
    if(!uid||!fs()||!db()) return;
    _insightUnsubs.forEach(function(u){ try{u();}catch(e){} }); _insightUnsubs=[];
    var _milestoneKey='gh_insight_ms';
    var _seen={};
    try{ _seen=JSON.parse(localStorage.getItem(_milestoneKey)||'{}'); }catch(e){}
    function _saveSeen(){ try{ localStorage.setItem(_milestoneKey, JSON.stringify(_seen)); }catch(e){} }
    // Listen to user's recent posts (last 10)
    var q=fs().query(fs().collection(db(),'posts'),fs().where('authorId','==',uid),fs().orderBy('createdAt','desc'),fs().limit(10));
    var unsub=fs().onSnapshot(q,function(snap){
      snap.forEach(function(d){
        var p=d.data()||{}, pid=d.id;
        _INSIGHT_MILESTONES.forEach(function(m){
          var val=Number(p[m.field]||0);
          m.vals.forEach(function(threshold){
            var key=pid+'_'+m.field+'_'+threshold;
            if(val>=threshold && !_seen[key]){
              _seen[key]=1; _saveSeen();
              toast(m.icon+' '+m.msg(threshold),'');
              // Write to user's notifications
              if(fs()&&db()) fs().setDoc(fs().doc(db(),'users',uid,'notifications','insight_'+key),{
                type:'insight', message:m.msg(threshold), icon:m.icon,
                postId:pid, field:m.field, threshold:threshold,
                read:false, createdAt:fs().serverTimestamp()
              }).catch(function(){});
            }
          });
        });
      });
    },function(){});
    _insightUnsubs.push(unsub);
  }

  /* ── Phase 40: @Mention Autocomplete ────────────────────── */
  function _bindMentionAutocomplete(el){
    if(!el||el._mentionBound) return;
    el._mentionBound=true;
    var _mTimer=null, _mDrop=null, _mStart=-1;

    function _closeMDrop(){
      if(_mDrop){ _mDrop.remove(); _mDrop=null; }
      _mStart=-1;
    }

    function _insertMention(username){
      var s=el.selectionStart||0, v=el.value;
      el.value=v.slice(0,_mStart)+'@'+username+' '+v.slice(s);
      el.selectionStart=el.selectionEnd=_mStart+username.length+2;
      el.dispatchEvent(new Event('input',{bubbles:true}));
      _closeMDrop(); el.focus();
    }

    function _showMDrop(users){
      _closeMDrop();
      if(!users.length) return;
      var drop=document.createElement('div');
      drop.className='gh-mention-drop';
      drop.innerHTML=users.map(function(u){
        var avHtml=u.avatar
          ?'<img src="'+esc(u.avatar)+'" alt="" onerror="this.onerror=null;this.remove()">'
          :'<span style="color:#fff;font-size:.62rem;font-weight:700">'+esc(initials(u.name))+'</span>';
        return '<button type="button" class="gh-mention-opt" data-mu="'+esc(u.slug)+'">'+
          '<span class="gh-mention-av">'+avHtml+'</span>'+
          '<span class="gh-mention-info">'+
            '<strong>'+esc(u.name)+'</strong>'+
            '<span>'+(u.slug?'@'+esc(u.slug):'')+'</span>'+
          '</span>'+
        '</button>';
      }).join('');
      document.body.appendChild(drop);
      _mDrop=drop;
      // Position below the input
      var rect=el.getBoundingClientRect();
      var dw=220, left=Math.max(8,Math.min(rect.left,window.innerWidth-dw-8));
      drop.style.cssText='top:'+(rect.bottom+4)+'px;left:'+left+'px;width:'+dw+'px';
      drop.addEventListener('mousedown',function(e){
        var btn=e.target.closest('[data-mu]'); if(!btn) return;
        e.preventDefault(); _insertMention(btn.dataset.mu);
      });
    }

    el.addEventListener('input',function(){
      clearTimeout(_mTimer);
      var v=el.value, cur=el.selectionStart||0;
      // Find @ before cursor (no whitespace between)
      var at=-1;
      for(var i=cur-1;i>=Math.max(0,cur-30);i--){
        if(v[i]==='@'){ at=i; break; }
        if(/[\s\n]/.test(v[i])) break;
      }
      if(at<0||at===cur-1){ _closeMDrop(); return; }
      var typed=v.slice(at+1,cur);
      if(typed.length<1||/[\s@#]/.test(typed)){ _closeMDrop(); return; }
      _mStart=at;
      _mTimer=setTimeout(function(){
        if(!GS()||!GS().searchFirestore) return;
        GS().searchFirestore(typed,function(res){
          if((el.value.slice(at+1,el.selectionStart||0))!==typed) return;
          var users=(res.users||[]).slice(0,5).map(function(u){
            var slug=u.username||(u.displayName||u.fullName||'').replace(/\s+/g,'').toLowerCase();
            return { name:u.fullName||u.displayName||u.name||'User', slug:slug||u.id||u.uid||'', avatar:u.photoURL||u.avatar||'' };
          });
          _showMDrop(users);
        });
      },260);
    });

    el.addEventListener('keydown',function(e){
      if(!_mDrop) return;
      var opts=[].slice.call(_mDrop.querySelectorAll('.gh-mention-opt'));
      var idx=opts.indexOf(document.activeElement);
      if(e.key==='ArrowDown'){ e.preventDefault(); var n=opts[Math.min(idx+1,opts.length-1)]; if(n) n.focus(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); if(idx>0) opts[idx-1].focus(); else el.focus(); }
      else if(e.key==='Escape'){ _closeMDrop(); }
      else if(e.key==='Enter'&&idx>=0){ e.preventDefault(); _insertMention(opts[idx].dataset.mu); }
    });

    el.addEventListener('blur',function(){
      setTimeout(function(){ if(_mDrop&&!_mDrop.contains(document.activeElement)) _closeMDrop(); },160);
    });
  }

  /* ── Phase 41: Post Translation ──────────────────────────── */
  function _translatePost(btn){
    var card=btn.closest('[data-post-id]'); if(!card) return;
    var resultDiv=card.querySelector('[data-translate-result]'); if(!resultDiv) return;
    // Toggle off
    if(!resultDiv.hidden){
      resultDiv.hidden=true;
      btn.innerHTML='🌐 Translate';
      btn.classList.remove('active');
      return;
    }
    // Show cached
    if(resultDiv.dataset.translated){
      resultDiv.hidden=false;
      btn.innerHTML='✕ Original';
      btn.classList.add('active');
      return;
    }
    var text=(btn.dataset.translateText||'').trim();
    if(!text) return;
    // Detect language: >20% Georgian chars → translate to English, else → Georgian
    var kaCount=(text.match(/[ა-ჿ]/g)||[]).length;
    var isGeo=text.length>0 && kaCount/text.length>0.2;
    var langpair=isGeo?'ka|en':'en|ka';
    var targetLabel=isGeo?'🇬🇧 English':'🇬🇪 Georgian';
    btn.innerHTML='<i class="fas fa-circle-notch fa-spin" style="font-size:.75rem"></i>';
    btn.disabled=true;
    fetch('https://api.mymemory.translated.net/get?q='+encodeURIComponent(text.slice(0,500))+'&langpair='+langpair)
      .then(function(r){return r.json();})
      .then(function(data){
        var tr=data.responseData&&data.responseData.translatedText;
        if(!tr||tr===text){toast('Translation not available','error');btn.innerHTML='🌐 Translate';btn.disabled=false;return;}
        resultDiv.dataset.translated='1';
        resultDiv.innerHTML='<div class="gh-translate-box"><span class="gh-translate-lang">'+targetLabel+'</span><p>'+esc(tr)+'</p></div>';
        resultDiv.hidden=false;
        btn.innerHTML='✕ Original';
        btn.classList.add('active');
        btn.disabled=false;
      })
      .catch(function(){toast('Translation failed','error');btn.innerHTML='🌐 Translate';btn.disabled=false;});
  }

  /* ── Phase 64: GeoHub Coins & Creator Tips ──────────────── */
  var _COIN_AMOUNTS=[10,25,50,100,250];
  function _openTipModal(targetUid, targetName){
    if(!requireLogin()) return;
    var u=authUser(); if(!u) return;
    if(u.uid===targetUid) return toast('You cannot tip yourself');
    if(!fs()||!db()) return;
    // Load tipper's coin balance
    fs().getDoc(fs().doc(db(),'userCoins',u.uid)).then(function(snap){
      var bal=snap.exists()?(snap.data().balance||0):0;
      var body='<div class="gh-tip-modal">'+
        '<div class="gh-tip-balance"><i class="fas fa-coins" style="color:#f59e0b"></i> Your balance: <strong>'+bal+' GeoCoins</strong></div>'+
        '<div style="margin:12px 0 6px;font-size:.88rem;font-weight:600">Select amount</div>'+
        '<div class="gh-tip-amounts">'+
          _COIN_AMOUNTS.map(function(a){ return '<button class="gh-tip-amt'+(bal<a?' disabled':'')+'" data-tip-amt="'+a+'" '+(bal<a?'disabled':'')+'>'+a+' 🪙</button>'; }).join('')+
        '</div>'+
        '<div style="margin:10px 0 4px;font-size:.82rem;color:var(--gh-muted)">Or enter custom amount</div>'+
        '<input class="gh-input" id="ghTipCustom" type="number" min="1" max="'+bal+'" placeholder="Custom coins…">'+
        '<div id="ghTipFeedback" style="margin-top:8px;font-size:.82rem;color:var(--gh-muted)">Tipping <strong>'+esc(targetName)+'</strong></div>'+
      '</div>';
      modal('💰 Send GeoCoins',body,'<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSendTipBtn">Send Tip</button>','ghTipModal');
      var tipModal=document.getElementById('ghTipModal');
      var selectedAmt=0;
      if(tipModal){
        tipModal.querySelectorAll('[data-tip-amt]').forEach(function(btn){
          btn.onclick=function(){
            if(btn.disabled) return;
            selectedAmt=Number(btn.dataset.tipAmt);
            tipModal.querySelectorAll('[data-tip-amt]').forEach(function(b){ b.classList.toggle('active',b===btn); });
            var ci=document.getElementById('ghTipCustom'); if(ci) ci.value='';
          };
        });
        var stBtn=document.getElementById('ghSendTipBtn');
        if(stBtn){
          stBtn.onclick=function(){
            var ci=document.getElementById('ghTipCustom'); var custom=ci&&Number(ci.value||0);
            var amt=custom||selectedAmt;
            if(!amt||amt<1) return toast('Pick an amount','error');
            if(amt>bal) return toast('Not enough GeoCoins','error');
            stBtn.disabled=true; stBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>';
            var batch=fs().writeBatch(db());
            // Debit tipper
            batch.set(fs().doc(db(),'userCoins',u.uid),{balance:fs().increment(-amt),updatedAt:fs().serverTimestamp()},{merge:true});
            // Credit recipient
            batch.set(fs().doc(db(),'userCoins',targetUid),{balance:fs().increment(amt),totalReceived:fs().increment(amt),updatedAt:fs().serverTimestamp()},{merge:true});
            // Record transaction
            batch.set(fs().doc(fs().collection(db(),'coinTransactions')),{
              from:u.uid, to:targetUid, amount:amt, type:'tip', createdAt:fs().serverTimestamp()
            });
            batch.commit().then(function(){
              toast('💰 Sent '+amt+' GeoCoins to '+targetName+'!');
              tipModal.remove();
            }).catch(function(err){ toast('Failed: '+(err.message||err.code),'error'); stBtn.disabled=false; stBtn.innerHTML='Send Tip'; });
          };
        }
      }
    }).catch(function(){ toast('Could not load balance','error'); });
  }
  // Expose so profile pages can use it
  window.ghOpenTip=_openTipModal;

  /* ── Phase 49: Post Analytics Dashboard ─────────────────── */
  function _openPostAnalytics(pid, card){
    if(!fs()||!db()) return;
    var m=modal('📊 Post Analytics',
      '<div class="gh-analytics-wrap" id="ghAnalyticsWrap">'+
        '<div class="gh-analytics-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>'+
      '</div>',
      '<button class="gh-btn ghost" data-close-modal>Close</button>',
      'ghPostAnalyticsModal'
    );
    var box=document.getElementById('ghAnalyticsWrap');

    // Fetch post doc + reactions subcollection in parallel
    Promise.all([
      fs().getDoc(fs().doc(db(),'posts',pid)),
      fs().getDocs(fs().query(fs().collection(db(),'posts',pid,'reactions'),fs().limit(200)))
    ]).then(function(results){
      var postSnap=results[0], rxSnap=results[1];
      var p=postSnap.data()||{};
      var views=Number(p.viewCount||0);
      var likes=Number(p.likeCount||p.reactionCount||0);
      var comments=Number(p.commentCount||0);
      var shares=Number(p.shareCount||0);
      var saves=Number(p.saveCount||0);
      var reshares=Number(p.reshareCount||0);

      // Reaction breakdown
      var rxCounts={};
      rxSnap.forEach(function(d){ var t=(d.data()||{}).type||'love'; rxCounts[t]=(rxCounts[t]||0)+1; });
      var rxTotal=rxSnap.size;
      var rxTypes=Object.keys(rxCounts).sort(function(a,b){return rxCounts[b]-rxCounts[a];});

      // Engagement rate = (likes + comments + shares) / max(views, 1)
      var eng=views>0?Math.round((likes+comments+shares)/views*100):0;

      var statRow=function(icon,label,val,color){
        return '<div class="gh-anl-row"><span class="gh-anl-icon" style="color:'+color+'"><i class="fas '+icon+'"></i></span>'+
          '<span class="gh-anl-label">'+label+'</span>'+
          '<span class="gh-anl-val">'+val+'</span></div>';
      };

      // SVG bar chart for reactions
      var chartHtml='';
      if(rxTypes.length){
        var maxRx=rxCounts[rxTypes[0]]||1;
        chartHtml='<div class="gh-anl-chart-title">Reaction Breakdown</div>'+
          '<div class="gh-anl-chart">'+
            rxTypes.map(function(t){
              var pct=Math.round(rxCounts[t]/maxRx*100);
              var totalPct=rxTotal?Math.round(rxCounts[t]/rxTotal*100):0;
              return '<div class="gh-anl-bar-row">'+
                '<span class="gh-anl-bar-emoji">'+(RX_EMOJIS[t]||'❤️')+'</span>'+
                '<div class="gh-anl-bar-wrap"><div class="gh-anl-bar-fill" style="width:'+pct+'%"></div></div>'+
                '<span class="gh-anl-bar-num">'+rxCounts[t]+' <span class="gh-anl-bar-pct">('+totalPct+'%)</span></span>'+
              '</div>';
            }).join('')+
            '<div class="gh-anl-total">'+rxTotal+' total reactions</div>'+
          '</div>';
      }

      if(box) box.innerHTML=
        '<div class="gh-anl-stats">'+
          statRow('fa-eye','Views',views,'#60a5fa')+
          statRow('fa-heart','Reactions',likes,'#f87171')+
          statRow('fa-comment','Comments',comments,'#34d399')+
          statRow('fa-share','Shares',shares,'#a78bfa')+
          (reshares?statRow('fa-retweet','Reposts',reshares,'#fb923c'):'')+
          (saves?statRow('fa-bookmark','Saves',saves,'#fbbf24'):'')+
          statRow('fa-chart-line','Engagement',eng+'%','#2d6a4f')+
        '</div>'+chartHtml;
    }).catch(function(e){
      if(box) box.innerHTML='<div class="gh-muted" style="padding:16px;text-align:center">Could not load analytics.</div>';
    });

    // Increment viewCount on the post each time analytics is opened (owner only)
    fs().updateDoc(fs().doc(db(),'posts',pid),{viewCount:fs().increment(1)}).catch(function(){});
    // Also update card display
    if(card){
      var vcEl=card.querySelector('[data-view-count]');
      if(vcEl) vcEl.textContent=Number(vcEl.textContent||0)+1;
    }
  }

  /* ── Phase 48: Live Streaming Indicator ─────────────────── */
  function _openGoLiveModal(){
    var u=authUser(); if(!u) return requireLogin();
    var f=fs(), d=db(); if(!f||!d) return;
    // Check current live status
    f.getDoc(f.doc(d,'users',u.uid)).then(function(snap){
      var userData=snap.data()||{};
      var isLive=!!userData.isLive;
      var liveUrl=userData.liveUrl||'';

      // Phase 66: viewer count from liveStreams doc
      var _liveVcUnsub=null;
      var body=
        '<div class="gh-live-modal-body">'+
          (isLive
            ? '<div class="gh-live-indicator-big"><span class="gh-live-dot"></span><strong>You are LIVE</strong>'+
                '<span class="gh-live-vc-badge" id="ghLiveVcBadge"><i class="fas fa-eye"></i> <span id="ghLiveVcNum">0</span></span>'+
              '</div>'+
              '<p class="gh-muted" style="font-size:.82rem;text-align:center">Click "End Live" to stop your broadcast.</p>'+
              (liveUrl?'<div class="gh-live-url-display"><i class="fas fa-link"></i> <a href="'+esc(liveUrl)+'" target="_blank" rel="noopener">'+esc(liveUrl)+'</a></div>':'')+
              '<div class="gh-live-chat-wrap">'+
                '<div class="gh-live-chat-msgs" id="ghLiveChatMsgs" style="max-height:120px;overflow-y:auto;font-size:.8rem"></div>'+
                '<div style="display:flex;gap:6px;margin-top:6px"><input class="gh-input" id="ghLiveChatInput" placeholder="Chat…" maxlength="200" style="flex:1"><button class="gh-btn sm" id="ghLiveChatSend"><i class="fas fa-paper-plane"></i></button></div>'+
              '</div>'
            : '<div class="gh-live-pre-desc"><i class="fas fa-video" style="font-size:2rem;color:var(--gh-green,#2d6a4f)"></i><p>Start a live broadcast. Share a stream link (YouTube Live, Zoom, etc.) or just go live without a link.</p></div>'+
              '<input class="gh-input" id="ghLiveUrlInput" placeholder="Stream URL (optional — YouTube, Zoom, Meet…)" value="'+esc(liveUrl)+'" style="margin-top:10px">'+
              '<input class="gh-input" id="ghLiveTitleInput" placeholder="Stream title (optional)" style="margin-top:8px">')+
        '</div>';

      var footerBtns=isLive
        ? '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn danger" id="ghEndLiveBtn">🔴 End Live</button>'
        : '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghStartLiveBtn" style="background:#ef4444;border-color:#ef4444">🔴 Go Live!</button>';

      var m=modal(isLive?'🔴 You\'re Live':'🔴 Go Live', body, footerBtns, 'ghGoLiveModal');

      if(!isLive){
        var startBtn=document.getElementById('ghStartLiveBtn');
        if(startBtn) startBtn.addEventListener('click',function(){
          var url=(document.getElementById('ghLiveUrlInput')||{}).value||'';
          var title=(document.getElementById('ghLiveTitleInput')||{}).value||'';
          startBtn.disabled=true; startBtn.textContent=typeof GHt==='function'?GHt('live_starting'):'Starting…';
          // Phase 66: create liveStreams doc for viewer count + chat
          f.setDoc(f.doc(d,'liveStreams',u.uid),{
            uid:u.uid, authorName:userData.fullName||userData.displayName||'User',
            title:title.trim()||'', streamUrl:url.trim(), viewerCount:0,
            startedAt:f.serverTimestamp(), active:true
          },{merge:true});
          f.updateDoc(f.doc(d,'users',u.uid),{isLive:true,liveUrl:url.trim(),liveTitle:title.trim(),liveStartedAt:f.serverTimestamp()})
            .then(function(){
              if(m) m.remove();
              toast('🔴 You are now LIVE!');
              _updateLiveBadge(true);
            }).catch(function(e){ toast('Could not start live: '+(e.message||e.code),'error'); startBtn.disabled=false; startBtn.textContent='🔴 Go Live!'; });
        });
      } else {
        // Phase 66: real-time viewer count
        _liveVcUnsub=f.onSnapshot(f.doc(d,'liveStreams',u.uid),function(snap){
          if(!snap.exists()) return;
          var vcNum=document.getElementById('ghLiveVcNum');
          if(vcNum) vcNum.textContent=Number(snap.data().viewerCount||0);
        });
        // Phase 66: live chat
        var _chatUnsub=f.onSnapshot(
          f.query(f.collection(d,'liveStreams',u.uid,'messages'),f.orderBy('t','desc'),f.limit(20)),
          function(snap){
            var box=document.getElementById('ghLiveChatMsgs'); if(!box) return;
            var msgs=[]; snap.forEach(function(dd){ msgs.unshift(dd.data()); });
            box.innerHTML=msgs.map(function(msg){ return '<div style="padding:2px 0"><strong>'+esc(msg.name||'User')+'</strong>: '+esc(msg.text||'')+'</div>'; }).join('');
            box.scrollTop=box.scrollHeight;
          });
        var chatSend=document.getElementById('ghLiveChatSend');
        var chatInp=document.getElementById('ghLiveChatInput');
        if(chatSend&&chatInp){
          var _sendChat=function(){ var txt=chatInp.value.trim(); if(!txt) return; chatInp.value=''; f.addDoc(f.collection(d,'liveStreams',u.uid,'messages'),{name:userData.fullName||'Host',text:txt,t:f.serverTimestamp()}); };
          chatSend.onclick=_sendChat;
          chatInp.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); _sendChat(); } };
        }
        var endBtn=document.getElementById('ghEndLiveBtn');
        if(endBtn) endBtn.addEventListener('click',function(){
          endBtn.disabled=true; endBtn.textContent=typeof GHt==='function'?GHt('live_ending'):'Ending…';
          if(_liveVcUnsub){ try{_liveVcUnsub();}catch(e){} _liveVcUnsub=null; }
          if(_chatUnsub){ try{_chatUnsub();}catch(e){} }
          f.updateDoc(f.doc(d,'users',u.uid),{isLive:false,liveUrl:'',liveStartedAt:null})
            .then(function(){
              f.updateDoc(f.doc(d,'liveStreams',u.uid),{active:false,endedAt:f.serverTimestamp()}).catch(function(){});
              if(m) m.remove();
              // Phase 66: prompt to save as video post
              if(liveUrl){
                window.ghConfirm(typeof GHt==='function'?GHt('live_save_cfm'):'Live ended! Save your stream URL as a video post?', function(){
                  var GeoSoc=window.GeoSocial||GS();
                  if(GeoSoc&&GeoSoc.createPost) GeoSoc.createPost({text:'🔴 Watch my live recording!',videoUrl:liveUrl,type:'video'},null,function(){toast('Video post created!');});
                }, function(){ toast('Live ended'); });
              } else {
                toast('Live ended');
              }
              _updateLiveBadge(false);
            }).catch(function(e){ toast('Could not end live','error'); endBtn.disabled=false; endBtn.textContent='🔴 End Live'; });
        });
      }
    }).catch(function(){ toast('Could not load live status','error'); });
  }

  function _updateLiveBadge(isLive){
    $all('[data-live-badge]').forEach(function(b){
      b.style.display=isLive?'flex':'none';
      b.textContent=isLive?'LIVE':'';
    });
    var goLiveBtns=$all('[data-go-live]');
    goLiveBtns.forEach(function(btn){
      btn.classList.toggle('active',isLive);
      btn.innerHTML=isLive?'<i class="fas fa-circle-dot" style="color:#ef4444"></i> Live':'<i class="fas fa-video"></i> Go Live';
    });
  }

  // Expose so external pages can call it
  window.ghOpenGoLive = _openGoLiveModal;

  /* ── Phase 52: Voice Note player ─────────────────────────── */
  var _currentVoiceAudio=null, _currentVoiceBtn=null;
  function _toggleVoicePlay(btn){
    var src=btn.dataset.voiceSrc||''; if(!src) return;
    var card=btn.closest('[data-post-id]');
    var fillEl=card&&card.querySelector('[data-voice-fill]');
    var durEl=card&&card.querySelector('[data-voice-dur]');
    // Stop any currently playing voice
    if(_currentVoiceAudio&&_currentVoiceAudio!==btn._vAudio){
      _currentVoiceAudio.pause();
      if(_currentVoiceBtn) _currentVoiceBtn.innerHTML='<i class="fas fa-play"></i>';
      _currentVoiceAudio=null; _currentVoiceBtn=null;
    }
    if(!btn._vAudio) btn._vAudio=new Audio(src);
    var au=btn._vAudio;
    if(au.paused){
      au.play().catch(function(){});
      btn.innerHTML='<i class="fas fa-pause"></i>';
      _currentVoiceAudio=au; _currentVoiceBtn=btn;
      au.ontimeupdate=function(){
        var pct=au.duration?au.currentTime/au.duration*100:0;
        if(fillEl) fillEl.style.width=pct+'%';
        if(durEl) durEl.textContent=_fmtVoiceSec(au.currentTime)+' / '+_fmtVoiceSec(au.duration||0);
      };
      au.onended=function(){
        btn.innerHTML='<i class="fas fa-play"></i>';
        if(fillEl) fillEl.style.width='0%';
        _currentVoiceAudio=null; _currentVoiceBtn=null;
      };
      au.onloadedmetadata=function(){ if(durEl) durEl.textContent='0:00 / '+_fmtVoiceSec(au.duration||0); };
    } else {
      au.pause(); btn.innerHTML='<i class="fas fa-play"></i>';
      _currentVoiceAudio=null; _currentVoiceBtn=null;
    }
  }
  function _fmtVoiceSec(s){ s=Math.floor(s||0); return Math.floor(s/60)+':'+(s%60<10?'0':'')+s%60; }

  /* ── Phase 32: Emoji Picker ──────────────────────────────── */
  var _EMOJIS = '😀 😂 🥹 😊 😍 🤩 😎 😢 😭 🤯 😤 😠 🥺 😴 🤗 🥰 😏 🙄 😬 🫡 👍 👎 👋 🤝 ✌️ 🤞 🤟 👏 🙏 💪 🫶 🤜 🤛 ☝️ 👌 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💕 💞 💓 💗 💖 💝 💘 💔 🎉 🎊 🎁 🎈 🎂 🏆 🥇 🎯 🎮 🎸 🎵 🎶 🔥 ⭐ ✨ 🌟 💫 🌍 🌈 ☀️ 🌙 ❄️ 🌊 🌺 🌸 🌻 🍀 🌿 🍕 🍔 🌮 🍜 🍣 🍩 🍦 🍰 🍷 🍺 ☕ 🧃 🍎 🍓 🐱 🐶 🐻 🦊 🐼 🐸 🦁 🐯 🐷 🐮 🐙 🦋 🐝'.split(' ');

  function _insertAtCursor(el, text){
    if(el.tagName==='TEXTAREA'||el.tagName==='INPUT'){
      var s=el.selectionStart||0, e2=el.selectionEnd||0, v=el.value;
      el.value=v.slice(0,s)+text+v.slice(e2);
      el.selectionStart=el.selectionEnd=s+text.length;
    }
  }

  function _openEmojiPicker(targetEl, anchorEl){
    var existing=document.getElementById('ghEmojiPicker');
    if(existing){ existing.remove(); return; }
    var picker=document.createElement('div');
    picker.id='ghEmojiPicker';
    picker.className='gh-emoji-picker';
    picker.innerHTML='<div class="gh-ep-grid">'+_EMOJIS.map(function(e){ return '<button type="button" class="gh-ep-btn" data-emoji="'+e+'">'+e+'</button>'; }).join('')+'</div>';
    document.body.appendChild(picker);
    // Fixed position near anchor
    var rect=anchorEl.getBoundingClientRect();
    var pw=268, ph=216;
    var top=rect.top-ph-6; if(top<8) top=rect.bottom+6;
    var left=Math.max(8,Math.min(rect.left,window.innerWidth-pw-8));
    picker.style.top=top+'px'; picker.style.left=left+'px';
    picker.addEventListener('click',function(e){
      var btn=e.target.closest('[data-emoji]'); if(!btn) return;
      e.stopPropagation();
      _insertAtCursor(targetEl,btn.dataset.emoji);
      targetEl.dispatchEvent(new Event('input',{bubbles:true}));
      picker.remove(); targetEl.focus();
    });
    setTimeout(function(){
      function _closeOut(ev){ if(!picker.contains(ev.target)&&ev.target!==anchorEl){ picker.remove(); document.removeEventListener('click',_closeOut,true); } }
      document.addEventListener('click',_closeOut,true);
    },10);
  }

  /* ── Phase 34: Save to Collection ───────────────────────── */
  function openSaveToCollection(pid){
    var u=authUser(); if(!u){ requireLogin(); return; }
    if(!fs()||!db()) return;
    var uid=u.uid;
    var body=
      '<div id="ghColList" style="min-height:60px"><div class="gh-empty" style="min-height:60px"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+
      '<div style="margin-top:12px;display:flex;gap:8px">'+
        '<input class="gh-input" id="ghNewColName" placeholder="New collection name…" maxlength="40" style="flex:1">'+
        '<button class="gh-btn" id="ghCreateCol" title="Create"><i class="fas fa-plus"></i></button>'+
      '</div>';
    var m=modal('Save to Collection',body,'<button class="gh-btn ghost" data-close-modal>Done</button>','ghSaveColModal');
    function loadCols(){
      var list=document.getElementById('ghColList'); if(!list) return;
      fs().getDocs(fs().query(fs().collection(db(),'users',uid,'collections'),fs().orderBy('createdAt','desc'),fs().limit(20))).then(function(snap){
        if(!snap.size){ list.innerHTML='<p class="gh-muted" style="font-size:.82rem;padding:4px 0">No collections yet. Create one below.</p>'; return; }
        list.innerHTML='<div style="display:flex;flex-direction:column;gap:6px">'+
          snap.docs.map(function(d){
            var col=d.data(), ids=col.postIds||[], saved=ids.indexOf(pid)>-1;
            return '<div class="gh-col-row">'+
              '<i class="fas fa-folder gh-col-icon"></i>'+
              '<div style="flex:1;min-width:0">'+
                '<strong style="font-size:.85rem">'+esc(col.name||'Untitled')+'</strong>'+
                '<span class="gh-muted" style="font-size:.72rem;margin-left:6px">'+ids.length+' posts</span>'+
              '</div>'+
              '<button class="gh-btn sm'+(saved?' gh-col-saved':'')+'" data-col-id="'+esc(d.id)+'" data-col-saved="'+(saved?'1':'0')+'">'+
                (saved?'<i class="fas fa-check"></i> Saved':'Save')+
              '</button>'+
            '</div>';
          }).join('')+
        '</div>';
        list.querySelectorAll('[data-col-id]').forEach(function(btn){
          btn.onclick=function(){
            var colId=btn.dataset.colId, isSaved=btn.dataset.colSaved==='1';
            var ref=fs().doc(db(),'users',uid,'collections',colId);
            (isSaved?fs().updateDoc(ref,{postIds:fs().arrayRemove(pid)}):fs().updateDoc(ref,{postIds:fs().arrayUnion(pid)}))
              .then(function(){ loadCols(); toast(isSaved?'Removed from collection':'Saved to collection ✓'); })
              .catch(function(){});
          };
        });
      }).catch(function(){});
    }
    loadCols();
    var createBtn=document.getElementById('ghCreateCol');
    if(createBtn) createBtn.onclick=function(){
      var nameEl=document.getElementById('ghNewColName');
      var name=(nameEl&&nameEl.value||'').trim(); if(!name) return;
      createBtn.disabled=true;
      fs().addDoc(fs().collection(db(),'users',uid,'collections'),{name:name,postIds:[pid],createdAt:fs().serverTimestamp()})
        .then(function(){ if(nameEl) nameEl.value=''; createBtn.disabled=false; loadCols(); toast('Collection created ✓'); })
        .catch(function(){ createBtn.disabled=false; toast(typeof GHt==='function'?GHt('error_creating'):'Error creating collection','error'); });
    };
    var nameEl2=document.getElementById('ghNewColName');
    if(nameEl2) nameEl2.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); createBtn&&createBtn.click(); } });
  }

  /* ── Phase 35: Pin Post to Profile ──────────────────────── */
  function _pinPostToProfile(pid){
    var u=authUser(); if(!u||!fs()||!db()) return;
    var ref=fs().doc(db(),'users',u.uid);
    fs().getDoc(ref).then(function(snap){
      var d=snap.data()||{}, alreadyPinned=d.pinnedPostId===pid;
      return fs().updateDoc(ref,{pinnedPostId:alreadyPinned?'':pid}).then(function(){
        toast(alreadyPinned?'Post unpinned from profile':'📌 Pinned to your profile!');
      });
    }).catch(function(err){ toast('Could not pin: '+(err.message||err.code),'error'); });
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

  /* ── Phase 18: Creator Leaderboard by City ───────────────────────────── */
  function loadLeaderboardWidget(uid){
    var panel=document.getElementById('ghLeaderPanel');
    var box=document.getElementById('ghLeaderList');
    var citiesEl=document.getElementById('ghLdrCities');
    if(!box||!panel) return;
    if(!fs()||!db()){ panel.style.display='none'; return; }

    var MEDALS=['🥇','🥈','🥉'];
    var _allCreators=[];
    var _cityFilter='';

    function _score(u){ return (Number(u.followerCount||0)*3)+(Number(u.postCount||0)*2)+(Number(u.xp||0)); }

    function _renderList(){
      var data=_cityFilter
        ? _allCreators.filter(function(u){ return (u.city||'').toLowerCase()===_cityFilter.toLowerCase(); })
        : _allCreators;
      data=data.slice(0,5);
      if(!data.length){
        box.innerHTML='<div class="gh-muted" style="font-size:.78rem;padding:8px 0">ამ ქალაქიდან creator-ები ვერ მოიძებნა</div>';
        return;
      }
      box.innerHTML=data.map(function(u,i){
        var rank=i<3?MEDALS[i]:'<span class="gh-ldr-rank">'+(i+1)+'</span>';
        var av=u.avatar?'<img src="'+esc(u.avatar)+'" alt="" loading="lazy" onerror="this.remove()">':esc(initials(u.fullName||''));
        var followers=Number(u.followerCount||0);
        var fLabel=followers>=1000?(followers/1000).toFixed(1)+'K':String(followers);
        var xpLv=u.xp?_xpLvl(Number(u.xp)):0;
        var lvBadge=xpLv>0?'<span class="gh-ldr-lv">Lv '+xpLv+'</span>':'';
        return '<a class="gh-ldr-row" href="profile.html?id='+esc(u.id)+'" data-user-profile="'+esc(u.id)+'">'+
          '<div class="gh-ldr-medal">'+rank+'</div>'+
          '<span class="gh-avatar gh-ldr-av">'+av+'</span>'+
          '<div class="gh-ldr-info">'+
            '<div class="gh-ldr-name">'+esc(u.fullName||'GeoHub User')+lvBadge+'</div>'+
            '<div class="gh-ldr-sub">'+(u.city?esc(u.city)+' · ':'')+fLabel+' followers</div>'+
          '</div>'+
        '</a>';
      }).join('');
    }

    function _xpLvl(xp){ if(xp<100)return 1;if(xp<300)return 2;if(xp<700)return 3;if(xp<1500)return 4;return 5; }

    /* Firestore: top 40 users by followerCount */
    box.innerHTML='<div class="gh-muted" style="font-size:.82rem">Loading…</div>';
    fs().getDocs(fs().query(
      fs().collection(db(),'users'),
      fs().orderBy('followerCount','desc'),
      fs().limit(40)
    )).then(function(snap){
      _allCreators=[];
      snap.forEach(function(d){
        if(d.id===uid) return;
        var u=d.data()||{};
        _allCreators.push({
          id:d.id,
          fullName:u.fullName||u.displayName||u.name||'GeoHub User',
          avatar:u.avatar||u.photoURL||'',
          city:u.city||'',
          followerCount:u.followerCount||0,
          postCount:u.postCount||0,
          xp:u.xp||0
        });
      });
      /* sort by composite score */
      _allCreators.sort(function(a,b){ return _score(b)-_score(a); });
      if(!_allCreators.length){ panel.style.display='none'; return; }
      _renderList();
    }).catch(function(){ panel.style.display='none'; });

    /* City tab clicks */
    if(citiesEl && !citiesEl.dataset.ldrBound){
      citiesEl.dataset.ldrBound='1';
      citiesEl.addEventListener('click',function(e){
        var btn=e.target.closest('[data-ldr-city]'); if(!btn) return;
        _cityFilter=btn.dataset.ldrCity||'';
        Array.from(citiesEl.querySelectorAll('.gh-ldr-city')).forEach(function(b){ b.classList.toggle('active',b===btn); });
        _renderList();
      });
    }
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
        if(panel&&city){ var h3=panel.querySelector('h3'); if(h3) h3.textContent=(typeof GHt==='function'?GHt('upcoming_events'):'Upcoming Events in ')+city; }
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

  /* ── Phase 13: Daily Streak + XP System ──────────────────────────────────── */
  var STREAK_MILESTONES=[3,7,14,30,60,100];
  var XP_PER_LOGIN=10;
  var XP_MILESTONE_BONUS={3:20,7:50,14:100,30:300,60:500,100:1000};
  function _dateStr(d){ d=d||new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function _xpLevel(xp){ if(xp<100)return 1; if(xp<300)return 2; if(xp<700)return 3; if(xp<1500)return 4; return 5; }
  function _xpToNextLevel(xp){ var t=[0,100,300,700,1500,99999]; var lv=_xpLevel(xp); return t[lv]-xp; }

  function _updateStreakBadge(streak){
    var badge=document.getElementById('ghStreakBadge');
    if(!badge) return;
    badge.textContent=streak||0;
    var btn=document.getElementById('ghStreakBtn');
    if(btn){
      btn.title=(streak||0)+' დღის ზოლი';
      btn.style.display=(streak&&streak>0)?'':'none';
    }
    if((streak||0)>=3) badge.classList.add('gh-streak-hot');
    else badge.classList.remove('gh-streak-hot');
  }

  function _showXpToast(opts){
    var existing=document.getElementById('ghXpToast'); if(existing) existing.remove();
    var toast=document.createElement('div');
    toast.id='ghXpToast'; toast.className='gh-xp-toast';
    var milIcon=opts.milestone?'🎉':'🔥';
    var mainHtml=opts.milestone
      ? '<strong>'+opts.milestone+'</strong>'
      : '<strong>🔥 '+opts.streak+' დღე ზედიზედ!</strong>';
    toast.innerHTML=
      '<div class="gh-xp-toast-inner">'+
        '<div class="gh-xp-icon">'+milIcon+'</div>'+
        '<div class="gh-xp-body">'+
          '<div class="gh-xp-main">'+mainHtml+'</div>'+
          '<div class="gh-xp-sub">+'+opts.xpGained+' XP</div>'+
        '</div>'+
        '<button class="gh-xp-close" onclick="this.closest(\'#ghXpToast\').remove()">✕</button>'+
      '</div>';
    document.body.appendChild(toast);
    requestAnimationFrame(function(){ toast.classList.add('show'); });
    var ttl=opts.milestone?5500:3200;
    setTimeout(function(){ toast.classList.remove('show'); toast.classList.add('hide'); setTimeout(function(){ if(toast.parentNode) toast.remove(); },450); }, ttl);
  }

  function maybeUpdateStreak(uid){
    _loadUiState(uid, function(data){
      var today=_dateStr();
      var yesterday=_dateStr(new Date(Date.now()-86400000));
      var lastDate=data.lastStreakDate||'';
      if(lastDate===today){ _updateStreakBadge(data.streak||0); return; }
      var prevStreak=data.streak||0;
      var newStreak=(lastDate===yesterday) ? prevStreak+1 : 1;
      var xpGained=XP_PER_LOGIN;
      var milestoneLabel=null;
      STREAK_MILESTONES.forEach(function(m){
        if(newStreak===m){ milestoneLabel=m+' დღის ზოლი! 🎉'; xpGained+=(XP_MILESTONE_BONUS[m]||0); }
      });
      var newXp=(data.xp||0)+xpGained;
      var newLongest=Math.max(data.longestStreak||0,newStreak);
      _saveUiState(uid,{streak:newStreak,lastStreakDate:today,xp:newXp,longestStreak:newLongest});
      _updateStreakBadge(newStreak);
      setTimeout(function(){
        _showXpToast({xpGained:xpGained,streak:newStreak,milestone:milestoneLabel});
      },1800);
    });
  }

  /* ── Phase 21: Trending Hashtags ────────────────────────────────────── */
  function loadTrendingHashtags(){
    var panel=document.getElementById('ghTrendingPanel');
    var box=document.getElementById('ghTrendingList');
    if(!box||!panel) return;
    if(!fs()||!db()){ panel.style.display='none'; return; }
    fs().getDocs(
      fs().query(
        fs().collection(db(),'hashtagCounts'),
        fs().orderBy('count','desc'),
        fs().limit(12)
      )
    ).then(function(snap){
      if(snap.empty){ panel.style.display='none'; return; }
      panel.style.display='';
      var html='<div class="gh-trending-chips">';
      snap.docs.forEach(function(d,i){
        var tag=d.data().tag||d.id;
        var cnt=d.data().count||0;
        html+='<a class="gh-trending-chip" href="feed.html?tag='+encodeURIComponent(tag)+'">'
          +'<span class="gh-tc-tag">#'+esc(tag)+'</span>'
          +'<span class="gh-tc-count">'+_fmtCount(cnt)+'</span>'
          +'</a>';
      });
      html+='</div>';
      box.innerHTML=html;
    }).catch(function(){ panel.style.display='none'; });
  }
  /* ── Phase 61: Trending Posts Widget ────────────────────── */
  function loadTrendingPostsWidget(){
    var panel=document.getElementById('ghTrendingPostsPanel');
    var box=document.getElementById('ghTrendingPostsList');
    if(!box||!panel) return;
    if(!fs()||!db()){ panel.style.display='none'; return; }
    var since=new Date(Date.now()-48*3600000); // last 48h
    fs().getDocs(fs().query(
      fs().collection(db(),'posts'),
      fs().where('createdAt','>',fs().Timestamp.fromDate(since)),
      fs().where('status','!=','deleted'),
      fs().limit(30)
    )).then(function(snap){
      if(snap.empty){ panel.style.display='none'; return; }
      var arr=[]; snap.forEach(function(d){ arr.push(Object.assign({id:d.id},d.data())); });
      // Score each post
      function score(p){ var r=Number(p.likeCount||p.reactionCount||0)*3,c=Number(p.commentCount||0)*5,s=Number(p.shareCount||0)*4; return r+c+s; }
      arr.sort(function(a,b){ return score(b)-score(a); });
      var top=arr.filter(function(p){ return score(p)>0; }).slice(0,5);
      if(!top.length){ panel.style.display='none'; return; }
      box.innerHTML=top.map(function(p,i){
        var name=p.authorName||p.userName||'User';
        var av=p.authorAvatar||p.userPhotoURL||'';
        var txt=(p.text||'').slice(0,80)+(p.text&&p.text.length>80?'…':'');
        var eng=score(p);
        return '<div class="gh-trpost-row" onclick="document.getElementById(\'post-'+esc(p.id)+'\')&&document.getElementById(\'post-'+esc(p.id)+'\').scrollIntoView({behavior:\'smooth\'})" style="cursor:pointer">'+
          '<span class="gh-trpost-rank">'+(i+1)+'</span>'+
          '<div class="gh-trpost-body">'+
            '<div class="gh-trpost-author">'+
              '<span class="gh-avatar" style="width:22px;height:22px;font-size:.55rem">'+(av?'<img src="'+esc(av)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':esc(initials(name)))+'</span>'+
              '<span class="gh-trpost-name">'+esc(name)+'</span>'+
            '</div>'+
            (txt?'<div class="gh-trpost-text">'+esc(txt)+'</div>':'')+
            '<div class="gh-trpost-meta"><i class="fas fa-fire"></i> '+eng+' engagements</div>'+
          '</div>'+
        '</div>';
      }).join('');
    }).catch(function(){ panel.style.display='none'; });
  }

  function _fmtCount(n){
    n=Number(n)||0;
    if(n>=1000000) return (n/1000000).toFixed(1)+'M';
    if(n>=1000) return (n/1000).toFixed(1)+'K';
    return String(n);
  }

  // Module-level post score utility (used by feed + business analytics)
  function _postScore(p){
    var now=Date.now(), age=(now-ts(p.createdAt))/3600000; // hours old
    var decay=age<1?1:age<6?1.5:age<24?3:age<72?8:20;
    var eng=(Number(p.likeCount||p.reactionCount||0)*3)+(Number(p.commentCount||0)*5)+(Number(p.shareCount||0)*4)+(Number(p.reshareCount||0)*2)+(Number(p.viewCount||0)*0.1);
    return eng/decay;
  }

  /* ── Phase 29: Birthday Feed Cards ──────────────────────────────────── */
  function _loadBirthdayFeedCards(uid){
    if(!uid||!fs()||!db()) return;
    var slot=document.getElementById('ghWelcomeSlot'); if(!slot) return;
    var today=new Date();
    var todayStr=String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
    var dismissKey='gh_bday_'+todayStr;
    try{ if(localStorage.getItem(dismissKey)) return; }catch(e){}
    // Get following list
    fs().getDocs(fs().query(fs().collection(db(),'follows'),fs().where('followerId','==',uid),fs().limit(100))).then(function(snap){
      var followingIds=[];
      snap.forEach(function(d){ followingIds.push(d.data().followedId||d.id); });
      if(!followingIds.length) return;
      // Check each followed user's birthday (batch check first 20)
      var toCheck=followingIds.slice(0,20);
      var birthdays=[];
      var done=0;
      toCheck.forEach(function(fid){
        fs().getDoc(fs().doc(db(),'users',fid)).then(function(s){
          if(s.exists()){
            var d=s.data();
            if(d.birthday===todayStr) birthdays.push({uid:fid,name:d.fullName||d.displayName||'Friend',avatar:d.avatar||d.photoURL||''});
          }
          done++;
          if(done===toCheck.length && birthdays.length) _renderBirthdayCard(slot,birthdays,dismissKey);
        }).catch(function(){ done++; if(done===toCheck.length && birthdays.length) _renderBirthdayCard(slot,birthdays,dismissKey); });
      });
    }).catch(function(){});
  }

  function _renderBirthdayCard(slot, people, dismissKey){
    var first=people[0];
    var av=first.avatar?'<img src="'+esc(first.avatar)+'" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0">'
      :'<span style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#ef4444);display:inline-flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0">🎂</span>';
    var names=people.map(function(p){ return esc(p.name); }).join(', ');
    var card=document.createElement('section');
    card.className='gh-card gh-birthday-card';
    card.innerHTML=
      '<div class="gh-bday-head">'+
        '<span class="gh-bday-emoji">🎂</span>'+
        '<div>'+
          '<strong>დღეს '+(people.length>1?people.length+' ადამიანს':esc(first.name)+'-ს')+' აქვს დაბადების დღე!</strong>'+
          (people.length>1?'<span>'+names+'</span>':'<span>გაუგზავნე სურვილი</span>')+
        '</div>'+
        '<button class="gh-bday-close">×</button>'+
      '</div>'+
      '<div class="gh-bday-people">'+
        people.slice(0,4).map(function(p){
          var a=p.avatar?'<img src="'+esc(p.avatar)+'" alt="" loading="lazy">':'<span class="gh-avatar" style="width:36px;height:36px;font-size:.75rem">'+esc(initials(p.name))+'</span>';
          return '<a class="gh-bday-person" href="messages.html?with='+esc(p.uid)+'">'+a+'<span>'+esc(p.name)+'</span></a>';
        }).join('')+
      '</div>'+
      '<div class="gh-bday-actions">'+
        people.slice(0,2).map(function(p){
          return '<a class="gh-btn sm" href="messages.html?with='+esc(p.uid)+'"><i class="fas fa-birthday-cake"></i> '+esc(p.name.split(' ')[0])+'-ს სურვილი</a>';
        }).join('')+
      '</div>';
    card.querySelector('.gh-bday-close').onclick=function(){
      card.style.opacity='0'; card.style.transform='scale(.97)'; card.style.transition='all .25s';
      setTimeout(function(){ if(card.parentNode) card.remove(); },250);
      try{ localStorage.setItem(dismissKey,'1'); }catch(e){}
    };
    slot.insertBefore(card, slot.firstChild);
  }

  /* ── Phase 30: Weekly Digest Card ────────────────────────────────────── */
  function _loadWeeklyDigest(uid){
    if(!uid||!fs()||!db()) return;
    var slot=document.getElementById('ghWelcomeSlot'); if(!slot) return;
    // Show only on Monday or if not seen this week
    var now=new Date();
    var weekKey='gh_digest_'+now.getFullYear()+'_'+_getWeekNumber(now);
    try{ if(localStorage.getItem(weekKey)) return; }catch(e){}
    // Only show on Monday (day 1) or if it's been forced
    if(now.getDay()!==1 && !new URLSearchParams(location.search).has('digest')) return;
    // Query user's stats for this week
    var weekAgo=new Date(now.getTime()-7*86400000);
    Promise.all([
      fs().getDocs(fs().query(fs().collection(db(),'posts'),fs().where('authorId','==',uid),fs().where('createdAt','>=',weekAgo),fs().limit(50))),
      fs().getDocs(fs().query(fs().collection(db(),'follows'),fs().where('followedId','==',uid),fs().where('createdAt','>=',weekAgo),fs().limit(50))),
      fs().getDocs(fs().collection(db(),'users',uid,'badges'))
    ]).then(function(results){
      var postCount=results[0].size;
      var newFollowers=results[1].size;
      var totalBadges=results[2].size;
      if(!postCount && !newFollowers && !totalBadges) return; // nothing to show
      _renderWeeklyDigest(slot, weekKey, {postCount:postCount, newFollowers:newFollowers, totalBadges:totalBadges});
    }).catch(function(){});
  }

  function _getWeekNumber(d){
    var start=new Date(d.getFullYear(),0,1);
    return Math.ceil(((d-start)/86400000+start.getDay()+1)/7);
  }

  function _renderWeeklyDigest(slot, weekKey, stats){
    var items=[];
    if(stats.postCount) items.push('<div class="gh-wd-stat"><span class="gh-wd-n">'+stats.postCount+'</span><span class="gh-wd-l">📝 პოსტი</span></div>');
    if(stats.newFollowers) items.push('<div class="gh-wd-stat"><span class="gh-wd-n">+'+stats.newFollowers+'</span><span class="gh-wd-l">👥 მიმდევარი</span></div>');
    if(stats.totalBadges) items.push('<div class="gh-wd-stat"><span class="gh-wd-n">'+stats.totalBadges+'</span><span class="gh-wd-l">🏅 ბეჯი</span></div>');
    var card=document.createElement('section');
    card.className='gh-card gh-weekly-digest';
    card.innerHTML=
      '<div class="gh-wd-head">'+
        '<span>🗓️</span>'+
        '<div>'+
          '<strong>კვირის შეჯამება</strong>'+
          '<span>'+new Date().toLocaleDateString('ka-GE',{month:'long',day:'numeric'})+' — შენი პროგრესი</span>'+
        '</div>'+
        '<button class="gh-wd-close">×</button>'+
      '</div>'+
      '<div class="gh-wd-stats">'+items.join('')+'</div>'+
      '<a class="gh-btn sm ghost" href="profile.html" style="margin-top:10px;display:inline-flex"><i class="fas fa-chart-line"></i> ჩემი პროფილი</a>';
    card.querySelector('.gh-wd-close').onclick=function(){
      card.style.opacity='0'; card.style.transform='scale(.97)'; card.style.transition='all .25s';
      setTimeout(function(){ if(card.parentNode) card.remove(); },250);
      try{ localStorage.setItem(weekKey,'1'); }catch(e){}
    };
    // Insert after birthday card if it exists
    var birthdayCard=slot.querySelector('.gh-birthday-card');
    if(birthdayCard) birthdayCard.insertAdjacentElement('afterend',card);
    else slot.insertBefore(card, slot.firstChild);
  }

  /* ── Phase 24: Live Activity Ticker ─────────────────────────────────── */
  var _latUnsub = null;
  var _latItems = [];
  var _LAT_MAX = 8;

  var _LAT_VERBS = {
    post:    function(d){ return 'გამოაქვეყნა პოსტი'+(d.text?' — "'+d.text.slice(0,40)+(d.text.length>40?'…':'')+'"':''); },
    video:   function(d){ return 'ვიდეო გამოაქვეყნა'+(d.title?' — "'+d.title.slice(0,35)+'"':''); },
    checkin: function(d){ return 'checked in'+(d.placeName?' → '+d.placeName.slice(0,30):''); },
    story:   function(){ return 'story გამოაქვეყნა'; },
    poll:    function(d){ return 'poll-ი შექმნა'+(d.text?' — "'+d.text.slice(0,35)+(d.text.length>35?'…':'')+'"':''); }
  };

  function _latVerb(d){ return (_LAT_VERBS[d.type]||_LAT_VERBS.post)(d); }

  function _latCard(item){
    var av=item.avatar
      ? '<img src="'+esc(item.avatar)+'" alt="" loading="lazy" onerror="this.outerHTML=\''+esc('<span class=\'gh-avatar\' style=\'width:26px;height:26px;font-size:.6rem\'>'+(initials(item.name||'')||'?')+'</span>')+'\'">'
      : esc(initials(item.name||'')||'?');
    return '<div class="gh-lat-row gh-lat-enter">'+
      '<a class="gh-avatar" href="'+esc(profileLink(item.uid||''))+'" style="width:26px;height:26px;flex-shrink:0;font-size:.6rem">'+av+'</a>'+
      '<div class="gh-lat-body">'+
        '<a class="gh-lat-name" href="'+esc(profileLink(item.uid||''))+'">'+esc(item.name||'User')+'</a>'+
        ' <span class="gh-lat-verb">'+esc(_latVerb(item))+'</span>'+
      '</div>'+
      '<span class="gh-lat-time" title="'+esc(new Date(item._ms).toLocaleString())+'">'+_latAgo(item._ms)+'</span>'+
    '</div>';
  }

  function _latAgo(ms){
    var diff=Date.now()-ms;
    if(diff<60000) return 'ახლა';
    if(diff<3600000) return Math.floor(diff/60000)+'წ';
    return Math.floor(diff/3600000)+'სთ';
  }

  function _latRender(){
    var box=document.getElementById('ghLiveActivityList'); if(!box) return;
    if(!_latItems.length){ box.innerHTML='<div class="gh-muted" style="font-size:.78rem">აქტიურობა ჯერ არ ჩანს</div>'; return; }
    box.innerHTML=_latItems.map(_latCard).join('');
  }

  function _latPush(item){
    // Remove duplicate
    _latItems=_latItems.filter(function(x){ return x._id!==item._id; });
    _latItems.unshift(item);
    if(_latItems.length>_LAT_MAX) _latItems=_latItems.slice(0,_LAT_MAX);
    var box=document.getElementById('ghLiveActivityList'); if(!box) return;
    // Prepend with animation instead of full re-render
    var row=document.createElement('div');
    row.innerHTML=_latCard(item);
    var el=row.firstElementChild;
    box.insertBefore(el,box.firstChild);
    // Remove extras
    while(box.children.length>_LAT_MAX) box.removeChild(box.lastChild);
    // Remove enter class after animation
    requestAnimationFrame(function(){ el.classList.remove('gh-lat-enter'); });
  }

  function startLiveActivityTicker(){
    var panel=document.getElementById('ghLiveActivityPanel');
    var box=document.getElementById('ghLiveActivityList');
    if(!box||!panel) return;
    if(!fs()||!db()){ panel.style.display='none'; return; }
    if(_latUnsub){ _latUnsub(); _latUnsub=null; }
    _latItems=[];
    // Listen to recent posts (last 2h)
    var since=new Date(Date.now()-2*3600000);
    _latUnsub=fs().onSnapshot(
      fs().query(
        fs().collection(db(),'posts'),
        fs().where('createdAt','>=',since),
        fs().orderBy('createdAt','desc'),
        fs().limit(20)
      ),
      function(snap){
        snap.docChanges().forEach(function(ch){
          if(ch.type==='added'){
            var d=ch.doc.data(); var id=ch.doc.id;
            var ms=d.createdAt?(d.createdAt.toMillis?d.createdAt.toMillis():d.createdAt.seconds*1000||Date.now()):Date.now();
            // Don't show items older than what we already have on initial load
            if(Math.abs(Date.now()-ms)<5000){ // only truly new (<5s old)
              _latPush({ _id:id, _ms:ms, uid:d.authorId||d.userId||'', name:d.authorName||d.userName||'User', avatar:d.authorAvatar||d.userAvatar||'', type:d.type||'post', text:d.text||'', title:d.title||'' });
            } else {
              // Seed initial items
              _latItems.push({ _id:id, _ms:ms, uid:d.authorId||d.userId||'', name:d.authorName||d.userName||'User', avatar:d.authorAvatar||d.userAvatar||'', type:d.type||'post', text:d.text||'', title:d.title||'' });
            }
          }
        });
        _latItems.sort(function(a,b){ return b._ms-a._ms; });
        _latItems=_latItems.slice(0,_LAT_MAX);
        _latRender();
      },
      function(){ panel.style.display='none'; }
    );
    state.pageUnsubs.push(function(){ if(_latUnsub){ _latUnsub(); _latUnsub=null; } });
  }

  /* ── Phase 25: "On This Day" Memories ───────────────────────────────── */
  var _OTD_KEY = 'gh_otd_dismissed';

  function loadOnThisDay(uid){
    if(!uid||!fs()||!db()) return;
    var slot=document.getElementById('ghWelcomeSlot'); if(!slot) return;
    // Check if dismissed today
    try{
      var dismissed=localStorage.getItem(_OTD_KEY);
      if(dismissed===_dateStr()) return;
    }catch(e){}
    // Query posts from 1 year ago ± 4 days
    var yearAgo=Date.now()-365*86400000;
    var rangeStart=new Date(yearAgo-4*86400000);
    var rangeEnd=new Date(yearAgo+4*86400000);
    fs().getDocs(
      fs().query(
        fs().collection(db(),'posts'),
        fs().where('authorId','==',uid),
        fs().where('createdAt','>=',rangeStart),
        fs().where('createdAt','<=',rangeEnd),
        fs().orderBy('createdAt','desc'),
        fs().limit(3)
      )
    ).then(function(snap){
      if(snap.empty) return;
      var posts=[]; snap.forEach(function(d){ posts.push(Object.assign({id:d.id},d.data())); });
      _renderOnThisDay(slot, posts);
    }).catch(function(){});
  }

  function _renderOnThisDay(slot, posts){
    var p=posts[0];
    var yearAgo=new Date(Date.now()-365*86400000);
    var dateLabel=yearAgo.toLocaleDateString('ka-GE',{month:'long',day:'numeric'});
    var preview='';
    if(p.mediaUrls&&p.mediaUrls[0]) preview='<img class="gh-otd-img" src="'+esc(p.mediaUrls[0])+'" alt="" loading="lazy">';
    else if(p.text) preview='<p class="gh-otd-text">'+esc(p.text.slice(0,160))+(p.text.length>160?'…':'')+'</p>';
    var card=document.createElement('section');
    card.className='gh-card gh-otd-card';
    card.innerHTML=
      '<div class="gh-otd-head">'+
        '<span class="gh-otd-icon">📅</span>'+
        '<div>'+
          '<strong>ახსოვს ეს?</strong>'+
          '<span>'+dateLabel+', ზუსტად ერთი წლის წინ</span>'+
        '</div>'+
        '<button class="gh-otd-dismiss" aria-label="Dismiss">×</button>'+
      '</div>'+
      preview+
      (posts.length>1?'<div class="gh-otd-more">და კიდევ '+(posts.length-1)+' პოსტი ამ დღეს</div>':'')+
      '<div class="gh-otd-actions">'+
        '<a class="gh-btn sm ghost" href="feed.html#post-'+esc(p.id)+'"><i class="fas fa-eye"></i> ნახვა</a>'+
        '<button class="gh-btn sm gh-otd-share-btn" data-share-memory="'+esc(p.id)+'"><i class="fas fa-share"></i> გაზიარება</button>'+
      '</div>';
    // Dismiss handler
    card.querySelector('.gh-otd-dismiss').onclick=function(){
      card.style.opacity='0'; card.style.transform='scale(.96)'; card.style.transition='all .3s';
      setTimeout(function(){ if(card.parentNode) card.remove(); },300);
      try{ localStorage.setItem(_OTD_KEY, _dateStr()); }catch(e){}
    };
    // Share handler
    card.querySelector('.gh-otd-share-btn').onclick=function(){
      if(navigator.share){ navigator.share({ title:'GeoHub Memories', text:'📅 ერთი წლის წინ: '+esc(p.text||''), url:location.origin+'/feed.html#post-'+p.id }).catch(function(){}); }
      else { try{ navigator.clipboard.writeText(location.origin+'/feed.html#post-'+p.id); toast('ბმული დაკოპირდა'); }catch(e){} }
    };
    slot.insertBefore(card, slot.firstChild);
  }

  /* ── Phase 26: Real-time Poll Vote Updates ───────────────────────────── */
  var _pollListeners = {};  // pid → unsub

  function hydratePollLive(card, pid){
    if(!pid||!fs()||!db()) return;
    if(_pollListeners[pid]) return; // already listening
    _pollListeners[pid]=fs().onSnapshot(
      fs().doc(db(),'posts',pid),
      function(snap){
        if(!snap.exists()) return;
        var data=snap.data();
        var poll=data.poll; if(!poll||!poll.options) return;
        var total=poll.options.reduce(function(s,o){ return s+Number(o.votes||0); },0)||1;
        var pollEl=card.querySelector('[data-poll-pid="'+CSS.escape(pid)+'"]'); if(!pollEl) return;
        poll.options.forEach(function(o){
          var pct=Math.round((Number(o.votes||0)/total)*100);
          var row=pollEl.querySelector('[data-poll-opt="'+CSS.escape(o.id||o.text)+'"]'); if(!row) return;
          var bar=row.querySelector('.gh-poll-bar');
          var pctEl=row.querySelector('.gh-poll-pct');
          var votesEl=row.querySelector('.gh-poll-votes');
          if(bar){ bar.style.width=pct+'%'; bar.style.transition='width .6s cubic-bezier(.4,0,.2,1)'; }
          if(pctEl) pctEl.textContent=pct+'%';
          if(votesEl) votesEl.textContent=Number(o.votes||0)+' ხმა';
        });
        var totalEl=pollEl.querySelector('[data-poll-total]'); if(totalEl) totalEl.textContent=(total===1&&poll.options.reduce(function(s,o){return s+Number(o.votes||0);},0)===0?0:total)+' ხმა';
      },
      function(){}
    );
  }

  /* ── Phase 22: Badges & Achievements ────────────────────────────────── */
  var BADGE_CATALOG = [
    { id:'first_post',    emoji:'📝', icon:'fa-pen-to-square', title:'პირველი პოსტი',   desc:'გამოაქვეყნე პირველი პოსტი',    rarity:'common',    check:function(s){ return s.postCount>=1; } },
    { id:'post_10',       emoji:'✍️',  icon:'fa-feather',       title:'აქტიური ავტორი', desc:'10 პოსტი გამოქვეყნებული',      rarity:'common',    check:function(s){ return s.postCount>=10; } },
    { id:'post_50',       emoji:'💬',  icon:'fa-comments',      title:'დიდი მწერალი',   desc:'50 პოსტი გამოქვეყნებული',      rarity:'rare',      check:function(s){ return s.postCount>=50; } },
    { id:'post_100',      emoji:'📚',  icon:'fa-book',          title:'კონტენტ კრეატორი','desc':'100 პოსტი გამოქვეყნებული', rarity:'epic',      check:function(s){ return s.postCount>=100; } },
    { id:'streak_7',      emoji:'🔥',  icon:'fa-fire',          title:'კვირის სტრიქი',  desc:'7 დღიანი სტრიქი',              rarity:'common',    check:function(s){ return s.streak>=7; } },
    { id:'streak_30',     emoji:'🌟',  icon:'fa-fire-flame-curved','title':'თვის სტრიქი','desc':'30 დღიანი სტრიქი',           rarity:'rare',      check:function(s){ return s.streak>=30; } },
    { id:'streak_100',    emoji:'⚡',  icon:'fa-bolt',          title:'ლეგენდა',        desc:'100 დღიანი სტრიქი',            rarity:'legendary', check:function(s){ return s.streak>=100; } },
    { id:'first_checkin', emoji:'📍',  icon:'fa-location-dot',  title:'მოგზაური',       desc:'პირველი check-in',             rarity:'common',    check:function(s){ return s.checkins>=1; } },
    { id:'checkin_10',    emoji:'🗺️',  icon:'fa-map',           title:'მკვლევარი',      desc:'10 check-in',                  rarity:'rare',      check:function(s){ return s.checkins>=10; } },
    { id:'checkin_50',    emoji:'🌍',  icon:'fa-earth-europe',  title:'გლობტროტერი',    desc:'50 check-in',                  rarity:'epic',      check:function(s){ return s.checkins>=50; } },
    { id:'social_10',     emoji:'🤝',  icon:'fa-users',         title:'სოციალური',      desc:'10 მიმდევარი',                 rarity:'common',    check:function(s){ return s.followers>=10; } },
    { id:'popular',       emoji:'⭐',  icon:'fa-star',          title:'პოპულარული',     desc:'100 მიმდევარი',                rarity:'rare',      check:function(s){ return s.followers>=100; } },
    { id:'influencer',    emoji:'🎯',  icon:'fa-bullseye',      title:'ინფლუენსერი',    desc:'500 მიმდევარი',                rarity:'epic',      check:function(s){ return s.followers>=500; } },
    { id:'verified',      emoji:'✅',  icon:'fa-circle-check',  title:'ვერიფიცირებული', desc:'GeoHub-ის ვერიფიცირებული ანგარიში','rarity':'legendary', check:function(s){ return s.verified===true; } }
  ];

  function checkAndAwardBadges(uid){
    if(!fs()||!db()||!uid) return;
    Promise.all([
      fs().getDoc(fs().doc(db(),'users',uid)),
      fs().getDoc(fs().doc(db(),'userUiState',uid)),
      fs().getDocs(fs().collection(db(),'users',uid,'badges'))
    ]).then(function(results){
      var userData=results[0].exists()?results[0].data():{};
      var uiData=results[1].exists()?results[1].data():{};
      var existingBadges={};
      results[2].forEach(function(d){ existingBadges[d.id]=true; });
      // Count checkins separately (use stored count if available, else fetch)
      var ciCount=Number(userData.checkinCount||uiData.checkinCount||0);
      function _run(checkins){
        var stats={
          postCount:Number(userData.postCount||userData.postsCount||0),
          streak:Number(uiData.streak||0),
          checkins:checkins,
          followers:Number(userData.followerCount||userData.followers||0),
          verified:userData.verified===true
        };
        var newBadges=[];
        BADGE_CATALOG.forEach(function(b){
          if(!existingBadges[b.id] && b.check(stats)) newBadges.push(b);
        });
        if(!newBadges.length) return;
        newBadges.forEach(function(b){
          fs().setDoc(fs().doc(db(),'users',uid,'badges',b.id),{
            badgeId:b.id, title:b.title, description:b.desc,
            icon:b.icon, emoji:b.emoji, rarity:b.rarity,
            awardedAt:fs().serverTimestamp()
          },{merge:true}).catch(function(){});
        });
        // Show toast for first new badge only (avoid spam)
        setTimeout(function(){ _showBadgeToast(newBadges[0]); }, 1200);
        if(newBadges.length>1){
          setTimeout(function(){ _showBadgeToast(newBadges[1]); }, 3500);
        }
      }
      if(ciCount){
        _run(ciCount);
      } else {
        fs().getDocs(fs().query(
          fs().collection(db(),'checkins'),
          fs().where('userId','==',uid),
          fs().limit(100)
        )).then(function(s){ _run(s.size); }).catch(function(){ _run(0); });
      }
    }).catch(function(){});
  }

  var RARITY_COLOR={ common:'#94a3b8', rare:'#3b82f6', epic:'#a855f7', legendary:'#f59e0b' };

  function _showBadgeToast(badge){
    var rc=RARITY_COLOR[badge.rarity]||'#94a3b8';
    var el=document.createElement('div');
    el.className='gh-badge-toast';
    el.setAttribute('role','alert');
    el.innerHTML=
      '<div class="gh-bt-inner">'+
        '<div class="gh-bt-emoji">'+badge.emoji+'</div>'+
        '<div class="gh-bt-body">'+
          '<div class="gh-bt-label">🏅 ბეჯი მიღებულია!</div>'+
          '<div class="gh-bt-name" style="color:'+rc+'">'+esc(badge.title)+'</div>'+
          '<div class="gh-bt-desc">'+esc(badge.desc)+'</div>'+
        '</div>'+
        '<button class="gh-bt-close" aria-label="Close">×</button>'+
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function(){ el.classList.add('visible'); });
    el.querySelector('.gh-bt-close').onclick=function(){
      el.classList.remove('visible');
      setTimeout(function(){ if(el.parentNode) el.remove(); },400);
    };
    setTimeout(function(){
      el.classList.remove('visible');
      setTimeout(function(){ if(el.parentNode) el.remove(); },400);
    }, 6000);
  }

  /* ── Phase 19: Georgia Wrapped ────────────────────────────────────────── */
  var WRAPPED_YEAR = new Date().getFullYear();

  function _initWrapped(uid){
    var teaser=document.getElementById('ghWrappedTeaser'); if(!teaser) return;
    teaser.style.display='';
    var btn=document.getElementById('ghWrappedOpenBtn');
    if(btn && !btn.dataset.wrappedBound){
      btn.dataset.wrappedBound='1';
      btn.onclick=function(){ _openWrapped(uid); };
    }
  }

  function _openWrapped(uid){
    if(document.getElementById('ghWrappedOverlay')) return;
    var gf=GF(); if(!gf||!gf.fs||!gf.db) return;
    var u=authUser(); if(!u) return;

    /* Show loading state */
    var ov=document.createElement('div');
    ov.id='ghWrappedOverlay'; ov.className='gh-wrapped-ov';
    ov.innerHTML='<div class="gh-wrapped-card"><div class="gh-wrapped-loading"><div class="gh-feed-dots"><span></span><span></span><span></span></div><p>მომზადება…</p></div></div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ ov.classList.add('show'); });

    var yearStart=new Date(WRAPPED_YEAR,0,1);
    Promise.all([
      gf.fs.getDoc(gf.fs.doc(gf.db,'users',uid)),
      gf.fs.getDoc(gf.fs.doc(gf.db,'userUiState',uid)),
      gf.fs.getDocs(gf.fs.query(
        gf.fs.collection(gf.db,'posts'),
        gf.fs.where('authorId','==',uid),
        gf.fs.where('createdAt','>=',yearStart),
        gf.fs.limit(300)
      )),
      gf.fs.getDocs(gf.fs.query(
        gf.fs.collection(gf.db,'checkins'),
        gf.fs.where('userId','==',uid),
        gf.fs.where('createdAt','>=',yearStart),
        gf.fs.limit(300)
      ))
    ]).then(function(res){
      var userData=res[0].exists()?res[0].data():{};
      var uiData=res[1].exists()?res[1].data():{};
      var postsSnap=res[2]; var checkinsSnap=res[3];

      /* Aggregate */
      var totalPosts=postsSnap.size;
      var totalCheckins=checkinsSnap.size;
      var xp=Number(uiData.xp||0);
      var streak=Number(uiData.streak||0);
      var longestStreak=Number(uiData.longestStreak||0);
      var followers=Number(userData.followerCount||0);
      var likesReceived=0;
      postsSnap.forEach(function(d){ likesReceived+=Number(d.data().likeCount||0); });
      var cityCounts={};
      checkinsSnap.forEach(function(d){ var c=d.data().city||''; if(c) cityCounts[c]=(cityCounts[c]||0)+1; });
      var topCity=''; var topCityCount=0;
      Object.keys(cityCounts).forEach(function(c){ if(cityCounts[c]>topCityCount){ topCityCount=cityCounts[c]; topCity=c; } });
      var xpLevel=_xpLevel(xp);
      var name=userData.fullName||userData.displayName||u.displayName||'მომხმარებელი';

      /* Build slides */
      var slides=[
        {
          gradient:'linear-gradient(135deg,#1a1f35 0%,#10b981 100%)',
          emoji:'🇬🇪',
          label:'GeoHub Wrapped',
          value:String(WRAPPED_YEAR),
          sub:esc(name)+' — შენი '+WRAPPED_YEAR+' წელი GeoHub-ზე',
          countUp:false
        },
        {
          gradient:'linear-gradient(135deg,#1e3a5f,#3b82f6)',
          emoji:'📝',
          label:'გაგზავნილი პოსტები',
          value:totalPosts,
          sub:totalPosts===0?'დროა პირველი პოსტი!':totalPosts>20?'შენ ერთ-ერთი ყველაზე აქტიური ხარ!':'კარგი დასაწყისი!',
          countUp:true
        },
        {
          gradient:'linear-gradient(135deg,#1a2c1a,#22c55e)',
          emoji:'📍',
          label:'Check-in'+( totalCheckins!==1?'-ები':''),
          value:totalCheckins,
          sub:topCity?'ყველაზე ხშირი: <b>'+esc(topCity)+'</b> ('+topCityCount+'x)':'სცადე Check-in ახლომდებარე ადგილებში!',
          countUp:true
        },
        {
          gradient:'linear-gradient(135deg,#2d1a00,#f59e0b)',
          emoji:'🔥',
          label:'ყველაზე გრძელი ზოლი',
          value:longestStreak,
          sub:'ამჟამინდელი ზოლი: <b>'+streak+'</b> დღე',
          countUp:true
        },
        {
          gradient:'linear-gradient(135deg,#1a0a2e,#a855f7)',
          emoji:'⚡',
          label:'XP მოპოვებული',
          value:xp,
          sub:'დონე <b>'+xpLevel+'</b> · ❤️ <b>'+likesReceived+'</b> reaction · 👥 <b>'+followers+'</b> follower',
          countUp:true,
          isLast:true,
          shareText:'GeoHub Wrapped '+WRAPPED_YEAR+' ✨\n'+
            '📝 '+totalPosts+' posts  📍 '+totalCheckins+' check-ins\n'+
            '🔥 '+longestStreak+' day streak  ⚡ '+xp+' XP\n'+
            '🌍 geohub.pages.dev'
        }
      ];

      _renderWrapped(ov, slides, 0);
    }).catch(function(){
      var card=ov.querySelector('.gh-wrapped-card');
      if(card) card.innerHTML='<div style="padding:32px;text-align:center"><div style="font-size:2rem">⚠️</div><p style="color:var(--gh-muted)">მონაცემები ვერ ჩაიტვირთა</p><button class="gh-btn ghost" onclick="document.getElementById(\'ghWrappedOverlay\').remove()">დახურვა</button></div>';
    });
  }

  function _renderWrapped(ov, slides, idx){
    var slide=slides[idx];
    var isLast=!!slide.isLast;
    var card=ov.querySelector('.gh-wrapped-card');
    if(!card) return;

    card.style.background=slide.gradient;
    card.innerHTML=
      '<button class="gh-wrapped-close" onclick="document.getElementById(\'ghWrappedOverlay\').remove()"><i class="fas fa-times"></i></button>'+
      '<div class="gh-wrapped-slide">'+
        '<div class="gh-wrapped-emoji">'+slide.emoji+'</div>'+
        '<div class="gh-wrapped-label">'+esc(slide.label)+'</div>'+
        '<div class="gh-wrapped-value" id="ghWrVal">'+(slide.countUp?'0':esc(String(slide.value)))+'</div>'+
        '<div class="gh-wrapped-sub">'+slide.sub+'</div>'+
        (isLast?
          '<div class="gh-wrapped-actions">'+
            '<button class="gh-btn gh-wra-share" id="ghWrShare"><i class="fas fa-share-nodes"></i> გაზიარება</button>'+
            '<button class="gh-btn ghost gh-wra-close" onclick="document.getElementById(\'ghWrappedOverlay\').remove()">დახურვა</button>'+
          '</div>'
          :'<button class="gh-btn gh-wrapped-next" id="ghWrNext">'+
            (idx===slides.length-2?'🎉 დასრულება':'შემდეგი <i class="fas fa-arrow-right"></i>')+
          '</button>'
        )+
        '<div class="gh-wrapped-dots">'+slides.map(function(_,i){ return '<span class="gh-wd'+(i===idx?' active':'')+'"></span>'; }).join('')+'</div>'+
      '</div>';

    /* Count up animation */
    if(slide.countUp && typeof slide.value==='number'){
      var el=document.getElementById('ghWrVal');
      if(el) _countUp(el, 0, slide.value, 900);
    }

    /* Next button */
    var nxt=document.getElementById('ghWrNext');
    if(nxt) nxt.onclick=function(){ _renderWrapped(ov, slides, idx+1); };

    /* Share button */
    var shr=document.getElementById('ghWrShare');
    if(shr) shr.onclick=function(){
      var txt=slide.shareText||'GeoHub Wrapped '+WRAPPED_YEAR+'\n🌍 geohub.pages.dev';
      if(navigator.share){ navigator.share({title:'GeoHub Wrapped '+WRAPPED_YEAR, text:txt, url:'https://geohub.pages.dev/feed.html'}); }
      else { try{ navigator.clipboard.writeText(txt); shr.textContent='✓ კოპირებულია!'; setTimeout(function(){ shr.innerHTML='<i class="fas fa-share-nodes"></i> გაზიარება'; },2000); }catch(e){} }
    };
  }

  function _countUp(el, from, to, duration){
    if(to===0){ el.textContent='0'; return; }
    var start=performance.now();
    function step(t){
      var p=Math.min((t-start)/duration,1);
      var e=1-Math.pow(1-p,3);
      el.textContent=Math.round(from+(to-from)*e).toLocaleString();
      if(p<1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ── Phase 8: Onboarding interests list ───────────────────────────────── */
  var OB_INTERESTS=[
    {id:'travel',    icon:'✈️',  label:'Travel'},
    {id:'food',      icon:'🍽️', label:'Food'},
    {id:'nature',    icon:'🏔️', label:'Nature'},
    {id:'culture',   icon:'🏛️', label:'Culture'},
    {id:'sports',    icon:'⚽',  label:'Sports'},
    {id:'music',     icon:'🎵',  label:'Music'},
    {id:'art',       icon:'🎨',  label:'Art'},
    {id:'business',  icon:'💼',  label:'Business'},
    {id:'tech',      icon:'💻',  label:'Tech'},
    {id:'nightlife', icon:'🌙',  label:'Nightlife'},
    {id:'family',    icon:'👨‍👩‍👧', label:'Family'},
    {id:'fashion',   icon:'👗',  label:'Fashion'}
  ];

  function _showOnboardingModal(uid, fbUser){
    if(document.getElementById('ghObOverlay')) return;
    var step=0;
    var selected={};

    function render(){
      var ov=document.getElementById('ghObOverlay');
      if(!ov){
        ov=document.createElement('div');
        ov.id='ghObOverlay';
        ov.className='gh-ob-overlay';
        document.body.appendChild(ov);
      }
      var dots=[0,1,2].map(function(i){ return '<div class="gh-ob-dot'+(i===step?' active':'')+'"></div>'; }).join('');
      var panels=[_obStepWelcome(), _obStepInterests(selected), _obStepDone()];
      ov.innerHTML='<div class="gh-ob-modal" id="ghObModal"><div class="gh-ob-progress">'+dots+'</div>'+panels[step]+'</div>';

      if(step===0){
        ov.querySelector('.gh-ob-start-btn').onclick=function(){ step=1; render(); };
        ov.querySelector('.gh-ob-skip-link').onclick=function(){ _obDismiss(uid, selected); };
      }
      if(step===1){
        ov.querySelectorAll('.gh-ob-chip').forEach(function(chip){
          chip.onclick=function(){
            var id=chip.dataset.id;
            if(selected[id]){ delete selected[id]; chip.classList.remove('active'); }
            else{ selected[id]=true; chip.classList.add('active'); }
          };
        });
        ov.querySelector('.gh-ob-back-btn').onclick=function(){ step=0; render(); };
        ov.querySelector('.gh-ob-next-btn').onclick=function(){ step=2; render(); };
      }
      if(step===2){
        ov.querySelector('.gh-ob-done-btn').onclick=function(){ _obDismiss(uid, selected); };
      }
    }
    render();
  }

  function _obDismiss(uid, selected){
    _saveUiState(uid,{onboardingDismissed:true, interests:Object.keys(selected)});
    var ov=document.getElementById('ghObOverlay');
    if(ov){ ov.classList.add('closing'); setTimeout(function(){ ov.remove(); },350); }
  }

  function _obStepWelcome(){
    return '<div class="gh-ob-panel">'+
      '<div class="gh-ob-icon-hero">🌍</div>'+
      '<h2 class="gh-ob-heading">Welcome to GeoHub!</h2>'+
      '<p class="gh-ob-subheading">საქართველოს რეალური კომიუნიტი — ადგილები, ადამიანები და ისტორიები.</p>'+
      '<button class="gh-ob-start-btn gh-ob-btn-primary">დაწყება <i class="fas fa-arrow-right"></i></button>'+
      '<button class="gh-ob-skip-link">Skip</button>'+
    '</div>';
  }

  function _obStepInterests(sel){
    return '<div class="gh-ob-panel">'+
      '<h2 class="gh-ob-heading">რა გაინტერესებს?</h2>'+
      '<p class="gh-ob-subheading">აირჩიე ინტერესები — ჩვენ შენს ფიდს მოვარგებთ.</p>'+
      '<div class="gh-ob-chips">'+
        OB_INTERESTS.map(function(it){
          return '<button class="gh-ob-chip'+(sel[it.id]?' active':'')+'" data-id="'+esc(it.id)+'">'+
            '<span class="gh-ob-chip-icon">'+it.icon+'</span>'+esc(it.label)+
          '</button>';
        }).join('')+
      '</div>'+
      '<div class="gh-ob-nav">'+
        '<button class="gh-ob-back-btn gh-ob-btn-ghost"><i class="fas fa-arrow-left"></i> უკან</button>'+
        '<button class="gh-ob-next-btn gh-ob-btn-primary">გაგრძელება <i class="fas fa-arrow-right"></i></button>'+
      '</div>'+
    '</div>';
  }

  function _obStepDone(){
    return '<div class="gh-ob-panel">'+
      '<div class="gh-ob-icon-hero">🎉</div>'+
      '<h2 class="gh-ob-heading">მზად ხარ!</h2>'+
      '<p class="gh-ob-subheading">GeoHub-ი ახლა შენს ინტერესებს მოარგებს.</p>'+
      '<div class="gh-ob-done-links">'+
        '<a class="gh-ob-done-item" href="profile.html"><i class="fas fa-user-circle"></i>პროფილის დასრულება</a>'+
        '<a class="gh-ob-done-item" href="places.html"><i class="fas fa-map-marker-alt"></i>ადგილების გამოკვლევა</a>'+
        '<a class="gh-ob-done-item" href="videos.html"><i class="fas fa-film"></i>ვიდეოების ყურება</a>'+
      '</div>'+
      '<button class="gh-ob-done-btn gh-ob-btn-primary">აღმოჩენის დაწყება 🚀</button>'+
    '</div>';
  }

  function maybeShowOnboarding(slot){
    var gf=GF(); if(!gf||!gf.auth||!gf.authFns) return;
    var unsub=gf.authFns.onAuthStateChanged(gf.auth, function(fbUser){
      unsub();
      if(!fbUser) return;
      var uid=fbUser.uid;
      _loadUiState(uid, function(st){
        /* Profile completion prompt (inline in slot) */
        if(slot){
          var missingPhoto=!fbUser.photoURL;
          var missingName=!fbUser.displayName||fbUser.displayName.trim()==='';
          if(!st.profilePromptDismissed && (missingPhoto||missingName)){
            var missing=missingPhoto&&missingName?'photo and display name':missingPhoto?'profile photo':'display name';
            slot.innerHTML='<div class="gh-profile-prompt" id="ghProfilePrompt">'+
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
        }
        /* Full-screen onboarding modal (Phase 8) */
        if(!st.onboardingDismissed){
          _showOnboardingModal(uid, fbUser);
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
        '<section class="gh-card gh-composer"><div class="gh-composer-top"><span class="'+compAvClass+'" id="ghComposerAvatar">'+compAvContent+'</span><button class="gh-composer-fake" data-create-post data-i18n="composer_placeholder">რას აზიარებ დღეს?</button></div><div class="gh-composer-actions"><button class="gh-composer-action" data-create-post><i class="fas fa-image" style="color:#22c55e"></i> <span data-i18n="photo">Photo</span></button><button class="gh-composer-action" onclick="location.href=\'places.html\'"><i class="fas fa-map-marker-alt" style="color:#ef4444"></i> <span data-i18n="place">Place</span></button><button class="gh-composer-action" onclick="location.href=\'add-business.html\'"><i class="fas fa-store" style="color:#38bdf8"></i> <span data-i18n="business">Business</span></button><button class="gh-composer-action" onclick="location.href=\'events.html\'"><i class="fas fa-calendar" style="color:#f59e0b"></i> <span data-i18n="event">Event</span></button></div></section>'+
        (pageMode ? '' : '<div id="ghWelcomeSlot"></div>')+
        (pageMode ? '<div class="gh-pill-row gh-page-feed-tabs" id="ghFeedTabs" style="padding:0 4px 4px"><button class="gh-pill active" data-feed-tab="page"><i class="fas fa-store" style="font-size:.75rem"></i> Page Activity</button></div>' : '<div class="gh-pill-row" id="ghFeedTabs" style="padding:0 4px 4px"><button class="gh-pill active" data-feed-tab="foryou"><i class="fas fa-house" style="font-size:.75rem"></i> <span data-i18n="feed_foryou">For You</span></button><button class="gh-pill" data-feed-tab="following"><i class="fas fa-user-group" style="font-size:.75rem"></i> <span data-i18n="feed_following">Following</span></button><button class="gh-pill" data-feed-tab="local"><i class="fas fa-city" style="font-size:.75rem"></i> <span data-i18n="feed_local">Local</span></button><button class="gh-pill" data-feed-tab="nearme"><i class="fas fa-location-dot" style="font-size:.75rem"></i> <span data-i18n="feed_nearme">Near Me</span></button></div>')+
        '<div id="ghFeedList">'+skelPostCard()+skelVideoCard()+skelPostCard()+skelVideoCard()+skelPostCard()+'</div>'+
        '<div id="ghFeedLoadMore" style="text-align:center;padding:16px 0 8px"></div>'
    });
    // Phase 36: Draft chip in composer area
    try{
      var _feedDraftRaw=localStorage.getItem('gh_draft');
      if(_feedDraftRaw&&!pageMode){
        var _feedDraft=JSON.parse(_feedDraftRaw);
        if(_feedDraft&&_feedDraft.text&&_feedDraft.text.trim()){
          var _compSec=document.querySelector('.gh-composer');
          if(_compSec){
            var _dc=document.createElement('div');
            _dc.className='gh-draft-chip';
            _dc.innerHTML='<i class="fas fa-floppy-disk"></i> Unpublished draft — <button class="gh-draft-chip-resume" data-create-post>Continue writing</button>';
            _compSec.appendChild(_dc);
          }
        }
      }
    }catch(e){}
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
      /* ── "New posts available" pill (Phase 11) ─────────────── */
      var _renderedIds={};
      var _pendingVisible=null;
      var _newPillTimer=null;
      var _feedVideoObs=null;
      var _activeInlineFeedVid=null;
      var _lastRenderedKey='';   // joined post IDs of last _doPaint — skip if unchanged
      var _paintDebounceTimer=null; // debounce rapid consecutive paint() calls

      /* ── Phase 55: Events Feed Integration ───────────────── */
      var _feedEvents=[]; var _myEvRsvps={};
      function _efcCountdown(ev){
        var target=ts(ev.startDate||ev.date||ev.dateTime||ev.startAt);
        if(!target) return '';
        var diff=target-Date.now();
        if(diff<=0) return '<span class="gh-efc-countdown"><i class="fas fa-circle-dot"></i> Live Now</span>';
        var d=Math.floor(diff/86400000), h=Math.floor((diff%86400000)/3600000), m=Math.floor((diff%3600000)/60000);
        var str=d>0?d+'d '+h+'h':h>0?h+'h '+m+'m':m+'m';
        return '<span class="gh-efc-countdown"><i class="fas fa-clock"></i> '+str+' left</span>';
      }
      function _buildEventFeedCard(ev){
        var cover=ev.imageUrl||ev.image||ev.coverImage||ev.coverImageUrl||ev.coverUrl||ev.photoUrl||ev.thumbnail||'';
        var name=ev.name||ev.title||'Event';
        var loc=ev.location||ev.locationName||'';
        var cat=ev.category||'';
        var catColors={music:'#a855f7',sports:'#3b82f6',tech:'#06b6d4',food:'#f59e0b',art:'#ec4899',outdoor:'#10b981',gaming:'#8b5cf6',business:'#64748b'};
        var cc=catColors[(cat||'').toLowerCase()]||'#10b981';
        var catBadge=cat?'<span class="gh-efc-category" style="color:'+cc+'">'+esc(cat.charAt(0).toUpperCase()+cat.slice(1))+'</span>':'';
        var countdown=_efcCountdown(ev);
        var target=ts(ev.startDate||ev.date||ev.dateTime||ev.startAt);
        var dateStr=target?new Date(target).toLocaleDateString('ka-GE',{weekday:'long',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
        var going=Number(ev.going||ev.goingCount||ev.attendeeCount||0);
        var interested=Number(ev.interested||ev.interestedCount||0);
        var myStatus=_myEvRsvps[ev.id]||'';
        return '<div class="gh-event-feed-card" data-event-feed-card="'+esc(ev.id)+'">'+
          (cover?'<img class="gh-efc-cover" src="'+esc(cover)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">':'')+
          '<div class="gh-efc-body">'+
            catBadge+
            '<h3 class="gh-efc-title">'+esc(name)+'</h3>'+
            '<div class="gh-efc-meta">'+
              (dateStr?'<span><i class="fas fa-calendar"></i> '+esc(dateStr)+'</span>':'')+
              (loc?'<span><i class="fas fa-location-dot"></i> '+esc(loc)+'</span>':'')+
            '</div>'+
            (ev.description?'<div style="font-size:.82rem;color:var(--gh-muted);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+esc((ev.description||'').slice(0,200))+'</div>':'')+
            '<div class="gh-efc-actions">'+
              '<button class="gh-efc-rsvp-going'+(myStatus==='going'?' active':'')+'" data-event-rsvp="'+esc(ev.id)+'" data-rsvp-status="going"><i class="fas fa-'+(myStatus==='going'?'check':'thumbs-up')+'"></i> '+(myStatus==='going'?'Going ✓':'Going')+'</button>'+
              '<button class="gh-efc-rsvp-interested'+(myStatus==='interested'?' active':'')+'" data-event-rsvp="'+esc(ev.id)+'" data-rsvp-status="interested"><i class="fas fa-star'+(myStatus==='interested'?'':'-regular')+'"></i> Interested</button>'+
              '<a class="gh-efc-attendees" href="events.html?id='+esc(ev.id)+'">'+
                (going?'<span>'+going+' going</span>':'')+
                (interested&&!going?'<span>'+interested+' interested</span>':'')+
              '</a>'+
              countdown+
            '</div>'+
          '</div>'+
        '</div>';
      }
      function _injectEventCards(inject_positions){
        if(!_feedEvents.length||pageMode) return;
        var cards=list.querySelectorAll('.gh-post');
        inject_positions.forEach(function(idx,i){
          var ev=_feedEvents[i%_feedEvents.length]; if(!ev) return;
          var refCard=cards[idx]; if(!refCard) return;
          // Prevent duplicates
          if(list.querySelector('[data-event-feed-card="'+ev.id+'"]')) return;
          var div=document.createElement('div');
          div.innerHTML=_buildEventFeedCard(ev);
          refCard.parentNode.insertBefore(div.firstChild,refCard);
        });
        list.querySelectorAll('[data-event-rsvp]').forEach(function(btn){
          btn.addEventListener('click',function(e){
            e.stopPropagation();
            if(!requireLogin()) return;
            var eid=btn.dataset.eventRsvp, status=btn.dataset.rsvpStatus;
            if(!eid||!status||!fs()||!db()) return;
            var u=authUser(); if(!u) return;
            var prev=_myEvRsvps[eid]||'';
            // Toggle off if same status
            if(prev===status){
              // Remove RSVP
              fs().getDocs(fs().query(fs().collection(db(),'eventParticipants'),
                fs().where('userId','==',u.uid),fs().where('eventId','==',eid),fs().limit(1)))
                .then(function(snap){ snap.forEach(function(d){ fs().deleteDoc(d.ref); }); });
              delete _myEvRsvps[eid];
              _updateEvRsvpBtns(eid,'');
              return;
            }
            // Add/update RSVP
            _myEvRsvps[eid]=status;
            _updateEvRsvpBtns(eid,status);
            fs().addDoc(fs().collection(db(),'eventParticipants'),{
              userId:u.uid, eventId:eid, status:status, createdAt:fs().serverTimestamp()
            }).catch(function(){});
          });
        });
      }
      function _updateEvRsvpBtns(eid,status){
        list.querySelectorAll('[data-event-feed-card="'+eid+'"]').forEach(function(card){
          var gb=card.querySelector('[data-rsvp-status="going"]');
          var ib=card.querySelector('[data-rsvp-status="interested"]');
          if(gb){ gb.classList.toggle('active',status==='going'); gb.innerHTML='<i class="fas fa-'+(status==='going'?'check':'thumbs-up')+'"></i> '+(status==='going'?'Going ✓':'Going'); }
          if(ib){ ib.classList.toggle('active',status==='interested'); }
        });
      }
      function _loadFeedEvents(){
        if(!fs()||!db()) return;
        var now=new Date();
        try{
          fs().getDocs(fs().query(
            fs().collection(db(),'events'),
            fs().where('status','==','active'),
            fs().orderBy('startDate','asc'),
            fs().limit(6)
          )).then(function(snap){
            _feedEvents=[];
            snap.forEach(function(d){ var ev=Object.assign({},d.data(),{id:d.id}); if(ts(ev.startDate||ev.date||ev.dateTime)>Date.now()) _feedEvents.push(ev); });
          }).catch(function(){
            // Fallback without where clause
            fs().getDocs(fs().query(fs().collection(db(),'events'),fs().orderBy('startDate','asc'),fs().limit(6))).then(function(snap){
              _feedEvents=[]; snap.forEach(function(d){ var ev=Object.assign({},d.data(),{id:d.id}); if(ts(ev.startDate||ev.date||ev.dateTime)>Date.now()) _feedEvents.push(ev); });
            }).catch(function(){});
          });
        }catch(e){}
        // Also load my RSVPs
        var u=authUser(); if(!u) return;
        try{
          fs().getDocs(fs().query(fs().collection(db(),'eventParticipants'),
            fs().where('userId','==',u.uid),fs().limit(50))).then(function(snap){
            _myEvRsvps={};
            snap.forEach(function(d){ var r=d.data()||{}; if(r.eventId) _myEvRsvps[r.eventId]=r.status; });
          }).catch(function(){});
        }catch(e){}
      }

      function _dismissNewPill(){
        var pill=document.getElementById('ghNewPostsPill');
        if(pill){ pill.classList.add('hiding'); setTimeout(function(){ pill&&pill.remove(); },350); }
        _pendingVisible=null;
      }
      function _showNewPill(n){
        var existing=document.getElementById('ghNewPostsPill');
        if(existing){ existing.querySelector('.gh-npp-count').textContent=n; return; }
        var pill=document.createElement('button');
        pill.id='ghNewPostsPill';
        pill.className='gh-new-posts-pill';
        pill.innerHTML='<i class="fas fa-arrow-up"></i> <span class="gh-npp-count">'+n+'</span> ახალი პოსტი';
        document.body.appendChild(pill);
        requestAnimationFrame(function(){ pill.classList.add('visible'); });
        pill.addEventListener('click',function(){
          _dismissNewPill();
          window.scrollTo({top:0,behavior:'smooth'});
          if(_pendingVisible!==null){ _doPaint(_pendingVisible); _pendingVisible=null; }
        });
      }

      function _doPaint(visible){
        // Skip full re-render if the same posts in the same order are already shown
        var newKey=visible.map(function(p){ return p.id; }).join(',');
        if(newKey && newKey===_lastRenderedKey && list.children.length>0){
          // Same order — only refresh dynamic counters in-place (no scroll jump)
          visible.forEach(function(p){
            try{
              var card=document.getElementById('post-'+p.id);
              if(!card) return;
              var lc=card.querySelector('[data-like-count]'); if(lc) lc.textContent=Number(p.likeCount||p.reactionCount||0)||0;
              var cc=card.querySelector('[data-comment-count]'); if(cc) cc.textContent=Math.max(0,Number(p.commentCount||0));
              var sc=card.querySelector('[data-share-count]'); if(sc) sc.textContent=Number(p.shareCount||0);
              var vc=card.querySelector('[data-view-count]'); if(vc) vc.textContent=Number(p.viewCount||0);
            }catch(e){}
          });
          return;
        }
        _lastRenderedKey=newKey;
        list.innerHTML=visible.map(function(p){
          var isFollowedPage=!pageMode && p.targetType==='business' && p.targetId && state.followedBusinessIds.indexOf(p.targetId)>-1;
          return postCard(p, isFollowedPage ? {fromFollowedPage:true} : {});
        }).join('');
        visible.forEach(function(p){ _renderedIds[p.id]=true; });
        visible.forEach(function(p){ try{ hydrateReactionState(p.id); loadReactionBreakdown(p.id); }catch(e){} });
        hydratePostAuthorAvatars(list);
        hydrateSharedPreviews(list);
        Object.keys(state.openCommentPids).forEach(function(pid){
          if(state.cachedComments[pid]) renderCommentsForPid(pid, state.cachedComments[pid]);
        });
        // Phase 55: inject event feed cards at positions 3, 8 (For You tab only)
        if(!pageMode && (state.feedTab==='foryou'||!state.feedTab)){
          _injectEventCards([3,8]);
        }
        setTimeout(openDeepLinkedPost, 350);
        _bindFeedVideoAutoplay();
      }

      /* ── Phase 14: Video autoplay in feed ───────────────────── */
      function _stopInlineFeedVid(card){
        var vid=card.querySelector('.gh-feed-vid-el');
        if(vid) vid.pause();
        if(_activeInlineFeedVid===card) _activeInlineFeedVid=null;
      }
      function _startInlineFeedVid(card){
        var videoUrl=card.dataset.videoUrl; if(!videoUrl) return;
        if(_activeInlineFeedVid && _activeInlineFeedVid!==card) _stopInlineFeedVid(_activeInlineFeedVid);
        var vid=card.querySelector('.gh-feed-vid-el');
        if(vid){ vid.play().catch(function(){}); _activeInlineFeedVid=card; return; }
        var thumb=card.querySelector('.gh-video-post-thumb'); if(!thumb) return;
        // create <video>
        vid=document.createElement('video');
        vid.className='gh-feed-vid-el';
        vid.src=videoUrl;
        vid.muted=true; vid.autoplay=true; vid.loop=true;
        vid.setAttribute('playsinline',''); vid.setAttribute('webkit-playsinline','');
        // hide static thumbnail image and play button
        var img=thumb.querySelector('img, .gh-video-post-thumb-ph');
        if(img) img.classList.add('gh-feed-vid-hidden');
        var playBtn=thumb.querySelector('.gh-video-play-btn');
        if(playBtn) playBtn.classList.add('gh-feed-vid-hidden');
        // mute toggle
        var muteBtn=document.createElement('button');
        muteBtn.className='gh-feed-vid-mute'; muteBtn.title='Unmute';
        muteBtn.innerHTML='<i class="fas fa-volume-xmark"></i>';
        muteBtn.onclick=function(e){
          e.preventDefault(); e.stopPropagation();
          vid.muted=!vid.muted;
          muteBtn.innerHTML=vid.muted?'<i class="fas fa-volume-xmark"></i>':'<i class="fas fa-volume-high"></i>';
          muteBtn.title=vid.muted?'Unmute':'Mute';
        };
        thumb.insertBefore(vid,thumb.firstChild);
        thumb.appendChild(muteBtn);
        vid.play().catch(function(){});
        _activeInlineFeedVid=card;
      }
      function _bindFeedVideoAutoplay(){
        if(_feedVideoObs){ _feedVideoObs.disconnect(); _feedVideoObs=null; }
        if(!window.IntersectionObserver) return;
        var cards=list.querySelectorAll('.gh-video-post-card[data-video-url]');
        if(!cards.length) return;
        _feedVideoObs=new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            if(entry.isIntersecting && entry.intersectionRatio>=0.5){
              _startInlineFeedVid(entry.target);
            } else {
              _stopInlineFeedVid(entry.target);
            }
          });
        },{threshold:[0.5]});
        cards.forEach(function(card){ _feedVideoObs.observe(card); });
      }

      /* ── Phase 15: Near Me Live Feed ────────────────────────── */
      var _nm={ status:'idle', items:[], userLat:null, userLng:null };

      function _haversineM(lat1,lng1,lat2,lng2){
        var R=6371000,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
        var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
        return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      }
      function _distLabel(m){ return m<1000 ? Math.round(m)+' მ' : (m/1000).toFixed(1)+' კმ'; }

      function _nearCard(item){
        var type=item._type||'place';
        var icon=iconFor(type); var label=labelFor(type);
        var title=item.title||item.name||''; var photo=getItemImage(item);
        var dist=item._distM!=null?_distLabel(item._distM):'';
        var href=docLink(type,item.id);
        var city=item.city||item.address||''; var cat=item.category||item.subcategory||'';
        return '<article class="gh-near-card">'+
          '<div class="gh-near-media">'+
            (photo?'<img src="'+esc(photo)+'" alt="" loading="lazy">':'<div class="gh-near-ph"><i class="fas '+esc(icon)+'"></i></div>')+
            '<span class="gh-near-type"><i class="fas '+esc(icon)+'"></i> '+esc(label)+'</span>'+
            (dist?'<span class="gh-near-dist"><i class="fas fa-location-dot"></i> '+esc(dist)+'</span>':'')+
          '</div>'+
          '<div class="gh-near-body">'+
            '<h3><a href="'+esc(href)+'">'+esc(title)+'</a></h3>'+
            ((city||cat)?'<div class="gh-near-meta">'+(cat?'<span>'+esc(cat)+'</span>':'')+(city?'<span><i class="fas fa-map-pin" style="color:var(--gh-green)"></i> '+esc(city)+'</span>':'')+'</div>':'')+
            '<a class="gh-btn sm" href="'+esc(href)+'">ნახვა <i class="fas fa-arrow-right"></i></a>'+
          '</div>'+
        '</article>';
      }

      function _renderNearMe(){
        if(_nm.status==='idle'){
          list.innerHTML='<div class="gh-near-prompt">'+
            '<div class="gh-near-prompt-icon">📍</div>'+
            '<h3>Near Me</h3>'+
            '<p>ნახე ახლოს მდებარე ადგილები, ბიზნესები — 2 კმ-ის რადიუსში</p>'+
            '<button class="gh-btn gh-near-grant-btn" id="ghNearGrant"><i class="fas fa-location-dot"></i> ლოკაციის ნებართვა</button>'+
          '</div>';
          var gBtn=document.getElementById('ghNearGrant');
          if(gBtn) gBtn.onclick=function(){ _loadNearMe(); };
          return;
        }
        if(_nm.status==='loading'){
          list.innerHTML='<div class="gh-near-prompt"><div class="gh-feed-dots" style="margin:0 auto 12px"><span></span><span></span><span></span></div><p style="text-align:center;color:var(--gh-muted);font-size:.85rem">ლოკაციის დამუშავება…</p></div>';
          return;
        }
        if(_nm.status==='denied'){
          list.innerHTML='<div class="gh-near-prompt"><div class="gh-near-prompt-icon">🚫</div><h3>ლოკაცია გათიშულია</h3><p>ბრაუზერის პარამეტრებში დაუშვი ლოკაციის წვდომა და გვერდი განახლე.</p></div>';
          return;
        }
        if(_nm.status==='error'){
          list.innerHTML='<div class="gh-near-prompt"><div class="gh-near-prompt-icon">⚠️</div><h3>ლოკაცია ვერ დაიდგინა</h3><p>სცადე ხელახლა.</p><button class="gh-btn ghost" id="ghNearRetry"><i class="fas fa-rotate-right"></i> სცადე</button></div>';
          var rBtn=document.getElementById('ghNearRetry');
          if(rBtn) rBtn.onclick=function(){ _nm.status='idle'; _loadNearMe(); };
          return;
        }
        if(!_nm.items.length){
          list.innerHTML='<div class="gh-near-prompt"><div class="gh-near-prompt-icon">🗺️</div><h3>ახლოს არაფერია</h3><p>2 კმ-ის რადიუსში ვერ ვიპოვე ადგილები.</p><a class="gh-btn ghost" href="map.html"><i class="fas fa-map"></i> რუქა გახსნა</a></div>';
          return;
        }
        list.innerHTML=
          '<div class="gh-near-header"><i class="fas fa-location-dot"></i> შენ ახლოს — <b>'+_nm.items.length+'</b> ადგილი</div>'+
          '<div class="gh-near-grid">'+_nm.items.map(_nearCard).join('')+'</div>';
      }

      function _loadNearMe(){
        if(!navigator.geolocation){ _nm.status='error'; paint(); return; }
        _nm.status='loading'; paint();
        navigator.geolocation.getCurrentPosition(function(pos){
          var uLat=pos.coords.latitude, uLng=pos.coords.longitude;
          _nm.userLat=uLat; _nm.userLng=uLng;
          var gf=GF(); if(!gf||!gf.fs||!gf.db){ _nm.status='error'; paint(); return; }
          var RADIUS=2000;
          var latD=RADIUS/111000;
          var minLat=uLat-latD, maxLat=uLat+latD;
          var cols=['places','businesses']; var allItems=[]; var done=0;
          cols.forEach(function(col){
            gf.fs.getDocs(gf.fs.query(
              gf.fs.collection(gf.db,col),
              gf.fs.where('lat','>=',minLat),
              gf.fs.where('lat','<=',maxLat),
              gf.fs.limit(80)
            )).then(function(snap){
              snap.forEach(function(d){
                var item=Object.assign({id:d.id,_type:col==='businesses'?'business':'place'},d.data());
                var co=getPlaceCoords(item); if(!co) return;
                var dist=_haversineM(uLat,uLng,co.lat,co.lng);
                if(dist<=RADIUS){ item._distM=dist; allItems.push(item); }
              });
            }).catch(function(){}).then(function(){
              done++;
              if(done===cols.length){
                allItems.sort(function(a,b){ return (a._distM||9999)-(b._distM||9999); });
                _nm.items=allItems.slice(0,40);
                _nm.status='loaded';
                paint();
              }
            });
          });
        },function(err){
          _nm.status=(err.code===1)?'denied':'error'; paint();
        },{timeout:10000,enableHighAccuracy:true});
      }

      function paint(){
        // Debounce: collapse rapid successive paint() calls (bizFeed + listenFeed firing together)
        if(_paintDebounceTimer) clearTimeout(_paintDebounceTimer);
        _paintDebounceTimer=setTimeout(_doPaintCycle, 80);
      }
      function _doPaintCycle(){
        _paintDebounceTimer=null;
        if(renderId!==state.feedRenderId) return;
        if(!list) return;
        /* Near Me: own rendering path */
        if(state.feedTab==='nearme'){ _renderNearMe(); return; }
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
        } else if(state.feedTab==='local'){
          // Phase 68: Local Community Feed — filter by user's city
          var _localUsr=authUser();
          var _myCity=''; try{ _myCity=(JSON.parse(localStorage.getItem('gh_me_data')||'{}')||{}).city||''; }catch(e){}
          if(_myCity){
            visible=visible.filter(function(p){
              return (p.city||'').toLowerCase()===_myCity.toLowerCase();
            });
          }
        } else if(state.feedTag){
          /* hashtag filter: show posts whose text contains #tag */
          var _htag=state.feedTag.toLowerCase();
          visible=visible.filter(function(p){
            return p.text && p.text.toLowerCase().indexOf('#'+_htag)>-1;
          });
        } else if(state.feedTab==='foryou'||!state.feedTab){
          // Phase 58: Smart Feed — score-based ranking for For You tab
          // foryou: merge in all business page posts not already in the main feed
          if(state.bizFeedPosts.length){
            var seen={}; visible.forEach(function(p){ seen[p.id]=true; });
            var toInsert=[];
            state.bizFeedPosts.forEach(function(p){
              if(!seen[p.id] && canSeePost(p)){ seen[p.id]=true; toInsert.push(p); }
            });
            // Insert biz posts at chronologically correct positions without
            // re-sorting the whole array (re-sorting would destroy emit()'s interleaving)
            toInsert.sort(function(a,b){ return ts(b.createdAt)-ts(a.createdAt); });
            toInsert.forEach(function(bp){
              var t=ts(bp.createdAt), idx=visible.length;
              for(var i=0;i<visible.length;i++){ if(ts(visible[i].createdAt)<t){ idx=i; break; } }
              visible.splice(idx,0,bp);
            });
          }
          // Phase 58: score-based sort — only after initial merge
          function _postScore(p){
            var now=Date.now(), age=(now-ts(p.createdAt))/3600000; // hours
            var decay=age<1?1:age<6?1.5:age<24?3:age<72?8:20;
            var eng=(Number(p.likeCount||p.reactionCount||0)*3)+(Number(p.commentCount||0)*5)+(Number(p.shareCount||0)*4)+(Number(p.reshareCount||0)*2)+(Number(p.viewCount||0)*0.1);
            return eng/decay;
          }
          visible.sort(function(a,b){ return _postScore(b)-_postScore(a); });
        }
        if(!visible.length){
          if(pageMode){
            list.innerHTML=pageFeedEmptyHtml();
          } else if(state.feedTab === 'following'){
            list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-user-group"></i><h3>Nothing from people you follow</h3><p>Follow people and creators to see their posts here.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><a class="gh-btn ghost" href="search.html"><i class="fas fa-search"></i>Find people</a><a class="gh-btn ghost" href="creators.html"><i class="fas fa-star"></i>Discover creators</a></div></div>';
          } else if(state.feedTab==='local'){
            list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-city"></i><h3>No local posts yet</h3><p>Be the first to share something in your city!</p><button class="gh-btn" data-create-post><i class="fas fa-plus"></i> Share locally</button></div>';
          } else if(state.feedTag){
            list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-hashtag"></i><h3>#'+esc(state.feedTag)+'</h3><p>ამ ჰეშთეგით პოსტები ვერ მოიძებნა. პირველი იყავი!</p><button class="gh-btn" data-create-post><i class="fas fa-plus"></i> პოსტის გაზიარება</button></div>';
          } else {
            list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-seedling"></i><h3>Feed is empty</h3><p>Start connecting with people, groups, and businesses to fill your feed.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="gh-btn" data-create-post><i class="fas fa-plus"></i>Create post</button><a class="gh-btn ghost" href="search.html"><i class="fas fa-search"></i>Find people</a><a class="gh-btn ghost" href="groups.html"><i class="fas fa-users"></i>Join groups</a><a class="gh-btn ghost" href="business.html"><i class="fas fa-store"></i>Businesses</a><a class="gh-btn ghost" href="creators.html"><i class="fas fa-star"></i>Creators</a></div></div>';
          }
          return;
        }
        /* Check for genuinely new posts (not yet rendered) */
        var newCount=0;
        visible.forEach(function(p){ if(!_renderedIds[p.id]) newCount++; });
        var isScrolledDown = window.scrollY > 220;
        var isFirstRender = Object.keys(_renderedIds).length === 0;

        if(!isFirstRender && newCount > 0 && isScrolledDown && !pageMode){
          /* User is reading — buffer new render, show pill */
          _pendingVisible = visible;
          _showNewPill(newCount);
        } else {
          /* At top or first render — paint immediately */
          _dismissNewPill();
          _doPaint(visible);
        }
      }
      /* ── Phase 21: ?tag= URL param → auto-activate hashtag tab ── */
      if(!pageMode){
        var _urlTag=(new URLSearchParams(location.search)).get('tag');
        if(_urlTag){
          _urlTag=_urlTag.toLowerCase().replace(/[^a-z0-9_ა-ჿ]/g,'');
          if(_urlTag){
            state.feedTag=_urlTag;
            state.feedTab='hashtag';
            var tabsElHt=$('#ghFeedTabs');
            if(tabsElHt){
              $all('.gh-pill',tabsElHt).forEach(function(p){ p.classList.remove('active'); });
              var htBtn=document.createElement('button');
              htBtn.className='gh-pill active gh-hashtag-tab';
              htBtn.dataset.feedTab='hashtag';
              htBtn.innerHTML='<i class="fas fa-hashtag" style="font-size:.75rem"></i> #'+esc(_urlTag)+' <span class="gh-htab-close" title="ფილტრის გასუფთავება">×</span>';
              tabsElHt.appendChild(htBtn);
              htBtn.querySelector('.gh-htab-close').addEventListener('click',function(ev){
                ev.stopPropagation();
                state.feedTag=''; state.feedTab='foryou'; _renderedIds={};
                htBtn.remove();
                var firstPill=$('.gh-pill',tabsElHt); if(firstPill) firstPill.classList.add('active');
                history.replaceState(null,'',location.pathname);
                paint();
              });
            }
          }
        } else {
          state.feedTag='';
        }
      }
      var tabsEl=$('#ghFeedTabs');
      if(tabsEl) tabsEl.addEventListener('click',function(e){
        var btn=e.target.closest('[data-feed-tab]'); if(!btn) return;
        if(btn.dataset.feedTab!=='hashtag') state.feedTag='';
        state.feedTab=btn.dataset.feedTab;
        $all('.gh-pill',tabsEl).forEach(function(p){p.classList.toggle('active',p===btn);});
        _dismissNewPill();
        _renderedIds={};
        if(state.feedTab==='nearme' && _nm.status==='idle') _loadNearMe();
        else paint();
      });
      setupSafetyListener(paint);
      setupAudienceAccess(paint);
      // Load user's default audience prefs for composer pre-fill
      (function _loadUserPrivacyDefaults(){
        var _u = authUser();
        if (!_u || !fs() || !db()) return;
        fs().getDoc(fs().doc(db(), 'users', _u.uid)).then(function(snap){
          if (snap.exists()) { window._userPrivacyDefaults = (snap.data() || {}).privacy || {}; }
        }).catch(function(){});
      })();
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
        var feedN = state.feedN || 20;
        var lmBtn = document.getElementById('ghFeedLoadMore');
        var _lmObserver = null;
        function _disconnectLmObs(){ if(_lmObserver){ _lmObserver.disconnect(); _lmObserver=null; } }
        function startFeedListen(n){
          if(state.feedUnsub){ try{state.feedUnsub();}catch(e){} state.feedUnsub=null; }
          _disconnectLmObs();
          if(lmBtn) lmBtn.innerHTML='<div class="gh-feed-dots"><span></span><span></span><span></span></div>';
          state.feedUnsub=GS().listenFeed(function(posts){
            if(renderId!==state.feedRenderId) return;
            lastPosts=posts;
            paint();
            _disconnectLmObs();
            if(lmBtn){
              var hasMore=posts.length>=n;
              if(hasMore){
                lmBtn.innerHTML='<div class="gh-feed-sentinel"></div>';
                var sentinel=lmBtn.querySelector('.gh-feed-sentinel');
                _lmObserver=new IntersectionObserver(function(entries){
                  if(!entries[0].isIntersecting) return;
                  _disconnectLmObs();
                  lmBtn.innerHTML='<div class="gh-feed-dots"><span></span><span></span><span></span></div>';
                  _dismissNewPill();
                  _renderedIds={};
                  state.feedN=(state.feedN||20)+20;
                  startFeedListen(state.feedN);
                },{rootMargin:'300px'});
                _lmObserver.observe(sentinel);
              } else {
                lmBtn.innerHTML='<div class="gh-feed-end"><span>✓</span> <span data-i18n="all_caught_up">ყველა პოსტი ნანახია</span></div>';
              }
            }
          }, n);
        }
        startFeedListen(feedN);
        // Phase 55: preload upcoming events for feed cards (2s delay so feed loads first)
        setTimeout(_loadFeedEvents, 2500);
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
    var _dt=typeof GHt==='function'?GHt:function(k){return k;};
    shell({ active:'discover', center:'<div class="gh-card"><div class="gh-section-title"><div><h1>'+_dt('disc_title')+'</h1><p class="gh-muted" style="margin:.25rem 0 0">'+_dt('disc_sub')+'</p></div><a href="add-business.html" class="gh-btn"><i class="fas fa-plus"></i>'+_dt('disc_add_biz')+'</a></div><input class="gh-input" id="ghDiscoverSearch" placeholder="'+_dt('disc_search')+'"><div style="height:12px"></div><div class="gh-pill-row" id="ghDiscoverTabs"></div></div><div id="ghDiscoverList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>'+_dt('disc_loading')+'</h3></div></div>' });
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
    var _blt=typeof GHt==='function'?GHt:function(k){return k;};
    shell({ active:'business', center:'<div class="gh-card"><div class="gh-section-title"><div><h1 data-i18n="nav_business">Businesses / Pages</h1><p class="gh-muted" style="margin:.25rem 0 0">'+_blt('biz_page_desc')+'</p></div><a href="add-business.html" class="gh-btn"><i class="fas fa-plus"></i>'+_blt('biz_add_business')+'</a></div><input class="gh-input" id="ghBusinessSearch" data-i18n-placeholder="search" placeholder="Search businesses…"><div style="height:12px"></div><div class="gh-pill-row"><button class="gh-pill active" data-biz-filter="all">'+_blt('biz_cat_all')+'</button><button class="gh-pill" data-biz-filter="food">'+_blt('biz_cat_food')+'</button><button class="gh-pill" data-biz-filter="tourism">'+_blt('biz_cat_tourism')+'</button><button class="gh-pill" data-biz-filter="services">'+_blt('biz_cat_services')+'</button><button class="gh-pill" data-biz-filter="online">'+_blt('biz_cat_online')+'</button><button class="gh-pill" data-biz-filter="shop">'+_blt('biz_cat_shops')+'</button><button class="gh-pill" data-biz-filter="education">'+_blt('biz_cat_education')+'</button></div></div><div id="ghBusinessList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>' });
    var all=[]; state.bizFilter='all';
    function paint(){ var _plt=typeof GHt==='function'?GHt:function(k){return k;}; var q=($('#ghBusinessSearch').value||'').toLowerCase(); var arr=all.filter(function(b){ var cat=(b.category||'').toLowerCase(); var ok=state.bizFilter==='all'||cat.includes(state.bizFilter)||(state.bizFilter==='online' && isOnlineBusiness(b)); if(!ok)return false; return !q || JSON.stringify(b).toLowerCase().includes(q); }); var list=$('#ghBusinessList'); if(!arr.length){list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-store"></i><h3>'+_plt('biz_empty')+'</h3><p>'+_plt('biz_empty_hint')+'</p><a href="add-business.html" class="gh-btn">'+_plt('biz_add_business')+'</a></div>';return;} list.innerHTML='<div class="gh-grid">'+arr.map(businessListCard).join('')+'</div>'; }
    $('#ghBusinessSearch').oninput=paint; $('#ghCenter').addEventListener('click', function(e){ var f=e.target.closest('[data-biz-filter]'); if(f){ state.bizFilter=f.dataset.bizFilter; $all('[data-biz-filter]').forEach(function(x){x.classList.toggle('active',x===f);}); paint(); } var fb=e.target.closest('[data-follow-business]'); if(fb) followBusiness(fb.dataset.followBusiness); var s=e.target.closest('[data-save-item]'); if(s){ if(!requireLogin())return; GS().toggleSaveItem(s.dataset.type,s.dataset.id); } });
    ready(function(){ var _bft=typeof GHt==='function'?GHt:function(k){return k;}; var q=fs().query(fs().collection(db(),'businesses'), fs().orderBy('createdAt','desc'), fs().limit(40)); var _u=fs().onSnapshot(q,function(snap){ all=[]; snap.forEach(function(d){ var schema=window.GH||{}; var biz=schema.normBiz?schema.normBiz(d.data(),d.id):Object.assign({id:d.id},d.data()); if(isDeletedBiz(biz)) return; all.push(biz); }); paint(); }, function(err){ $('#ghBusinessList').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>'+_bft('biz_load_fail')+'</h3><p>'+esc(err.message)+'</p></div>'; }); state.pageUnsubs.push(_u); });
  }

  function renderBusinessDetail(id){
    var _bdt=typeof GHt==='function'?GHt:function(k){return k;};
    shell({ active:'business', center:'<div id="ghBusinessDetail"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>'+_bdt('biz_loading')+'</h3></div></div>' });
    ready(function(){
      var _u=fs().onSnapshot(fs().doc(db(),'businesses',id), function(snap){
        var _bt=typeof GHt==='function'?GHt:function(k){return k;};
        if(!snap.exists()){ $('#ghBusinessDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-store-slash"></i><h3>'+_bt('biz_not_found')+'</h3><p>'+_bt('biz_not_found_hint')+'</p></div>'; return; }
        var raw=snap.data()||{}; var b=(window.GH&&window.GH.normBiz)?window.GH.normBiz(raw,id):Object.assign({id:id},raw); paintBusinessDetail(b);
      }, function(err){ var _bt=typeof GHt==='function'?GHt:function(k){return k;}; $('#ghBusinessDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>'+_bt('biz_load_fail')+'</h3><p>'+esc(err.message)+'</p></div>'; });
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

    var _bpt=typeof GHt==='function'?GHt:function(k){return k;};
    var statusBadge='';
    if(b.status==='suspended') statusBadge='<span class="gh-biz-status-badge suspended"><i class="fas fa-ban"></i> '+_bpt('biz_suspended')+'</span>';
    else if(b.status==='under_review') statusBadge='<span class="gh-biz-status-badge under-review"><i class="fas fa-clock"></i> '+_bpt('biz_under_review')+'</span>';

    var coverHtml = cover ? '<img src="'+esc(cover)+'" alt="'+esc(title)+'" loading="lazy" onerror="this.remove()">' : '';
    var logoHtml  = logo  ? '<img src="'+esc(logo)+'"  alt="'+esc(title)+'" loading="lazy" onerror="this.remove()">' : esc(initials(title));

    var verifiedBadge = b.verified ? '<span class="gh-biz-verified"><i class="fas fa-circle-check"></i> '+_bpt('biz_verified')+'</span>' : '';
    var shortDesc = b.description ? '<p class="gh-biz-short-desc">'+esc(b.description)+'</p>' : '';

    var ratingAvg = b.ratingCount > 0
      ? (b.ratingTotal/b.ratingCount).toFixed(1)
      : (b.ratingAverage > 0 ? Number(b.ratingAverage).toFixed(1) : null);
    var ratingDisplay = ratingAvg ? ratingAvg+' ★' : '—';

    var _bgt=typeof GHt==='function'?GHt:function(k){return k;};
    var tabs=[{id:'overview',l:_bgt('biz_overview')},{id:'posts',l:_bgt('profile_posts')},{id:'services',l:_bgt('biz_services')},{id:'photos',l:_bgt('biz_photos')},{id:'videos',l:_bgt('nav_videos')},{id:'reviews',l:_bgt('biz_reviews')},{id:'about',l:_bgt('profile_about')}];
    if(isOwner) tabs.push({id:'manage',l:_bgt('biz_dashboard')});
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
              '<button class="gh-btn gh-follow-business-btn" data-follow-business="'+esc(b.id)+'"><i class="fas fa-plus"></i> '+_bgt('follow')+'</button>'+
              '<button class="gh-btn ghost" data-message-business="'+esc(b.id)+'" data-message-owner="'+esc(owner)+'"><i class="fas fa-comment"></i> '+_bgt('biz_message')+'</button>'+
              (isOwner?'<a class="gh-btn" href="business-suite.html?businessId='+encodeURIComponent(b.id)+'"><i class="fas fa-briefcase"></i> '+_bgt('biz_suite')+'</a>':'')+
              (isOwner?'<button class="gh-btn ghost" data-edit-business><i class="fas fa-gear"></i> '+_bgt('edit')+'</button>':'')+
              '<button class="gh-btn ghost" aria-label="Save business" data-save-item data-type="business" data-id="'+esc(b.id)+'"><i class="fas fa-bookmark"></i></button>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div class="gh-biz-stats-bar">'+
          '<div class="gh-biz-stat"><strong>'+Number(b.followerCount||0)+'</strong><span>'+_bgt('biz_followers')+'</span></div>'+
          '<div class="gh-biz-stat"><strong>'+ratingDisplay+'</strong><span>'+_bgt('biz_rating')+'</span></div>'+
          '<div class="gh-biz-stat"><strong>'+Number(b.reviewCount||0)+'</strong><span>'+_bgt('biz_reviews_lbl')+'</span></div>'+
          '<div class="gh-biz-stat"><strong>'+Number(b.postCount||0)+'</strong><span>'+_bgt('profile_posts')+'</span></div>'+
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
    var _dt=typeof GHt==='function'?GHt:function(k){return k;};
    if(!u||!u.uid||(b.ownerId!==u.uid&&b.createdBy!==u.uid&&b.userId!==u.uid)){
      box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-lock"></i><h3>'+_dt('bd_access_denied')+'</h3><p>'+_dt('bd_access_denied_msg')+'</p></div>';
      return;
    }
    if(!state.bizDashSection) state.bizDashSection='overview';
    var sections=[
      {id:'overview', icon:'fa-chart-line',  l:_dt('bd_nav_overview')},
      {id:'settings', icon:'fa-gear',        l:_dt('bd_nav_settings')},
      {id:'posts',    icon:'fa-newspaper',   l:_dt('bd_nav_posts')},
      {id:'services', icon:'fa-briefcase',   l:_dt('bd_nav_services')},
      {id:'gallery',  icon:'fa-images',      l:_dt('bd_nav_gallery')},
      {id:'reviews',  icon:'fa-star',        l:_dt('bd_nav_reviews')},
      {id:'employees',icon:'fa-user-group',  l:_dt('bd_nav_employees')},
      {id:'analytics',icon:'fa-chart-bar',   l:_dt('bd_nav_analytics')},
      {id:'qr',       icon:'fa-qrcode',      l:_dt('bd_nav_qr')},
    ];
    var sideNav='<nav class="gh-dash-sidebar-nav">'+
      sections.map(function(s){ return '<button class="gh-dash-nav-item'+(state.bizDashSection===s.id?' active':'')+'" data-dash-section="'+s.id+'"><i class="fas '+s.icon+'"></i><span>'+s.l+'</span></button>'; }).join('')+
      '<hr class="gh-dash-divider">'+
      '<button class="gh-dash-nav-item" data-edit-business-direct><i class="fas fa-pen"></i><span>'+_dt('bd_edit_page')+'</span></button>'+
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
    var _ovdt=typeof GHt==='function'?GHt:function(k){return k;};
    var ratingAvg=b.ratingCount>0?(b.ratingTotal/b.ratingCount).toFixed(1):(b.ratingAverage>0?Number(b.ratingAverage).toFixed(1):null);
    var statusColor=b.status==='active'?'#10b981':b.status==='suspended'?'#ef4444':'#f59e0b';
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<h2 class="gh-dash-section-title">'+_ovdt('bd_nav_overview')+'</h2>'+
        '<div class="gh-dash-stats-grid">'+
          '<div class="gh-dash-stat-card"><i class="fas fa-users"></i><strong>'+Number(b.followerCount||0)+'</strong><span>'+_ovdt('bd_ov_followers')+'</span></div>'+
          '<div class="gh-dash-stat-card"><i class="fas fa-newspaper"></i><strong>'+Number(b.postCount||0)+'</strong><span>'+_ovdt('bd_nav_posts')+'</span></div>'+
          '<div class="gh-dash-stat-card"><i class="fas fa-star" style="color:#facc15"></i><strong>'+(ratingAvg||'—')+'</strong><span>'+_ovdt('biz_ov_rating')+'</span></div>'+
          '<div class="gh-dash-stat-card"><i class="fas fa-comments"></i><strong>'+Number(b.reviewCount||0)+'</strong><span>'+_ovdt('bd_nav_reviews')+'</span></div>'+
        '</div>'+
        '<div class="gh-dash-info-grid">'+
          '<div class="gh-card" style="margin-bottom:0">'+
            '<div class="gh-biz-sec-head"><h3>'+_ovdt('bd_ov_biz_info')+'</h3><button class="gh-btn sm ghost" data-dash-section="settings"><i class="fas fa-pencil"></i> '+_ovdt('bd_edit_page')+'</button></div>'+
            '<div class="gh-about-list">'+
              aboutRow('fa-store',b.title||b.name||'Untitled')+
              aboutRow('fa-tag',b.category||_ovdt('bd_ov_no_cat'))+
              '<div class="gh-about-row"><i class="fas fa-circle-dot" style="color:'+statusColor+'"></i><span style="color:'+statusColor+';font-weight:700;text-transform:capitalize">'+esc(b.status||'active')+'</span></div>'+
              (b.plan&&b.plan!=='free'?aboutRow('fa-crown',_ovdt('biz_ab_pro')):aboutRow('fa-circle-check',_ovdt('biz_ab_free_listing')))+
            '</div>'+
          '</div>'+
          '<div class="gh-card" style="margin-bottom:0">'+
            '<div class="gh-biz-sec-head"><h3>'+_ovdt('bd_ov_quick')+'</h3></div>'+
            '<div style="display:flex;flex-direction:column;gap:8px">'+
              '<button class="gh-btn full ghost" data-ov-post-as-biz><i class="fas fa-bullhorn"></i> '+_ovdt('bd_ov_post_update')+'</button>'+
              '<a class="gh-btn full ghost" href="business-suite.html?businessId='+encodeURIComponent(b.id)+'"><i class="fas fa-briefcase"></i> '+_ovdt('biz_suite')+'</a>'+
              '<button class="gh-btn full ghost" data-dash-section="services"><i class="fas fa-briefcase"></i> '+_ovdt('bd_ov_manage_svc')+'</button>'+
              '<button class="gh-btn full ghost" data-dash-section="gallery"><i class="fas fa-images"></i> '+_ovdt('bd_ov_gallery_upload')+'</button>'+
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
    var _st=typeof GHt==='function'?GHt:function(k){return k;};
    var sLinks=b.socialLinks||{};
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<h2 class="gh-dash-section-title">'+_st('bd_nav_settings')+'</h2>'+
        '<div class="gh-card">'+
          '<div class="gh-biz-sec-head"><h3>'+_st('bd_set_basic')+'</h3></div>'+
          '<div class="gh-form-rows">'+
            '<label class="gh-form-label" for="dsTitle">'+_st('bd_set_biz_name')+'<input class="gh-input" id="dsTitle" value="'+esc(b.title||b.name||'')+'"></label>'+
            '<label class="gh-form-label" for="dsDesc">Description<textarea class="gh-textarea" id="dsDesc" rows="3">'+esc(b.description||'')+'</textarea></label>'+
            '<label class="gh-form-label" for="dsCat">Category<input class="gh-input" id="dsCat" value="'+esc(b.category||'')+'" placeholder="e.g. Restaurant, Salon, Tech"></label>'+
          '</div>'+
        '</div>'+
        '<div class="gh-card">'+
          '<div class="gh-biz-sec-head"><h3>'+_st('bd_set_contact')+'</h3></div>'+
          '<div class="gh-form-rows">'+
            '<div class="gh-form-grid">'+
              '<label class="gh-form-label" for="dsPhone">'+_st('biz_ov_phone')+'<input class="gh-input" id="dsPhone" value="'+esc(b.phone||'')+'" placeholder="+995 5XX XXX XXX"></label>'+
              '<label class="gh-form-label" for="dsEmail">'+_st('biz_ov_email')+'<input class="gh-input" id="dsEmail" value="'+esc(b.email||'')+'" placeholder="contact@yourbusiness.com"></label>'+
            '</div>'+
            '<label class="gh-form-label" for="dsWebsite">'+_st('biz_ov_website')+'<input class="gh-input" id="dsWebsite" value="'+esc(b.website||'')+'" placeholder="https://yourbusiness.com"></label>'+
            '<label class="gh-form-label" for="dsBooking">'+_st('bd_set_booking')+'<input class="gh-input" id="dsBooking" value="'+esc(b.bookingUrl||'')+'" placeholder="https://..."></label>'+
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
          '<div class="gh-biz-sec-head"><h3>'+_st('biz_ab_working_hrs')+'</h3><span class="gh-form-hint">'+_st('bd_set_hours_hint')+'</span></div>'+
          workingHoursEditorHtml(b.workingHours)+
        '</div>'+
        (!isOnlineBusiness(b)?
        '<div class="gh-card">'+
          '<div class="gh-biz-sec-head"><h3>'+_st('bd_set_loc')+'</h3><span class="gh-form-hint">'+_st('bd_set_loc_hint')+'</span></div>'+
          '<div class="gh-form-rows">'+
            (!getPlaceCoords(b)?'<div style="padding:6px 0 10px;color:#f59e0b;font-size:.82rem"><i class="fas fa-triangle-exclamation"></i> '+_st('bd_set_no_coords')+'</div>':'')+
            '<div class="gh-form-grid">'+
              '<label class="gh-form-label" for="dsLat">Latitude<input class="gh-input" id="dsLat" type="number" step="any" min="-90" max="90" value="'+(getPlaceCoords(b)?getPlaceCoords(b).lat:esc(b.lat||b.latitude||''))+'" placeholder="e.g. 41.6938"></label>'+
              '<label class="gh-form-label" for="dsLng">Longitude<input class="gh-input" id="dsLng" type="number" step="any" min="-180" max="180" value="'+(getPlaceCoords(b)?getPlaceCoords(b).lng:esc(b.lng||b.longitude||''))+'" placeholder="e.g. 44.8015"></label>'+
            '</div>'+
            '<button type="button" class="gh-btn sm ghost" id="dsGetLocBtn" style="margin-top:4px"><i class="fas fa-location-crosshairs"></i> '+_st('bd_set_use_loc')+'</button>'+
          '</div>'+
        '</div>':'')+
        '<div class="gh-card">'+
          '<div class="gh-biz-sec-head"><h3>'+_st('bd_set_branding')+'</h3></div>'+
          '<div class="gh-form-rows">'+
            '<label class="gh-form-label" for="dsCover">'+_st('bd_set_cover')+'<input class="gh-input" id="dsCover" value="'+esc(b.coverUrl||'')+'" placeholder="https://..."></label>'+
            '<label class="gh-form-label" for="dsLogo">'+_st('bd_set_logo')+'<input class="gh-input" id="dsLogo" value="'+esc(b.logoUrl||'')+'" placeholder="https://..."></label>'+
          '</div>'+
        '</div>'+
        '<div class="gh-dash-actions"><button class="gh-btn" id="dsSaveBtn"><i class="fas fa-check"></i> '+_st('bd_set_save')+'</button></div>'+
      '</div>';
    $('#dsSaveBtn').onclick=function(){ saveBizSettings(b); };
    var dsLocBtn=$('#dsGetLocBtn');
    if(dsLocBtn) dsLocBtn.onclick=function(){
      if(!navigator.geolocation){ toast('GPS not available on this device','error'); return; }
      var _glbt=typeof GHt==='function'?GHt:function(k){return k;};
      dsLocBtn.disabled=true; dsLocBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> '+_glbt('bd_set_getting_loc');
      navigator.geolocation.getCurrentPosition(function(pos){
        var lat=pos.coords.latitude.toFixed(6);
        var lng=pos.coords.longitude.toFixed(6);
        var latEl=$('#dsLat'); var lngEl=$('#dsLng');
        if(latEl) latEl.value=lat;
        if(lngEl) lngEl.value=lng;
        dsLocBtn.disabled=false; dsLocBtn.innerHTML='<i class="fas fa-location-crosshairs"></i> '+_glbt('bd_set_use_loc');
        toast('Location filled: '+lat+', '+lng);
      },function(err){
        dsLocBtn.disabled=false; dsLocBtn.innerHTML='<i class="fas fa-location-crosshairs"></i> '+_glbt('bd_set_use_loc');
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
    var _svbt=typeof GHt==='function'?GHt:function(k){return k;};
    if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> '+_svbt('bd_set_saving');}
    fs().updateDoc(fs().doc(db(),'businesses',b.id),fields).then(function(){
      toast(_svbt('bd_set_saved'));
      if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-check"></i> '+_svbt('bd_set_save');}
    }).catch(function(err){
      toast('Save failed: '+(err.message||err),'error');
      if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-check"></i> '+_svbt('bd_set_save');}
    });
  }

  function renderBizDashPosts(b){
    var cont=$('#ghDashContent'); if(!cont) return;
    var _pst=typeof GHt==='function'?GHt:function(k){return k;};
    var bTitle=b.title||b.name||'Business';
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<div class="gh-biz-sec-head"><h2 class="gh-dash-section-title">'+_pst('bd_nav_posts')+'</h2>'+
          '<button class="gh-btn" data-dp-post-as-biz><i class="fas fa-bullhorn"></i> '+_pst('bd_posts_btn')+'</button>'+
        '</div>'+
        '<div id="ghDashPostsList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+
      '</div>';
    cont.onclick=function(e){ if(e.target.closest('[data-dp-post-as-biz]')){ openPostModal({targetType:'business',targetId:b.id,authorType:'business',businessId:b.id,authorId:b.id,authorName:bTitle,authorAvatar:b.logoUrl||b.coverUrl||'',createdByUserId:authUser()&&authUser().uid}); } };
    listenTargetPosts('business',b.id,function(posts){
      var el=$('#ghDashPostsList'); if(!el) return;
      posts=posts.filter(canSeePost);
      if(!posts.length){el.innerHTML='<div class="gh-empty"><i class="fas fa-newspaper"></i><h3>'+_pst('bd_posts_empty')+'</h3><p>'+_pst('bd_posts_empty_hint')+'</p></div>'; return;}
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
    var _qrt=typeof GHt==='function'?GHt:function(k){return k;};
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<h2 class="gh-dash-section-title">'+_qrt('bd_nav_qr')+'</h2>'+
        '<div id="ghQrBody"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><p>'+_qrt('bd_qr_loading')+'</p></div></div>'+
      '</div>';

    var GQ=window.GeoQr;
    if(!GQ){
      var el2=$('#ghQrBody'); if(el2) el2.innerHTML='<div class="gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>'+_qrt('bd_qr_no_engine')+'</h3><p>'+_qrt('bd_qr_no_engine_hint')+'</p></div>';
      return;
    }

    GQ.ensureBusinessQr(b.id, function(res){
      var el=$('#ghQrBody'); if(!el) return;
      if(!res){
        el.innerHTML='<div class="gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>'+_qrt('bd_qr_error')+'</h3><p>'+_qrt('bd_qr_error_hint')+'</p></div>';
        return;
      }
      var scanUrl=location.origin+'/scan.html?code='+encodeURIComponent(res.qrCode);
      el.innerHTML=
        '<div class="gh-card" style="text-align:center">'+
          '<div class="gh-biz-sec-head" style="justify-content:center"><h3>'+_qrt('bd_qr_card_title')+'</h3></div>'+
          '<p style="font-size:0.82rem;color:var(--gh-muted,#64748b);margin:0 0 16px">'+_qrt('bd_qr_desc')+'</p>'+
          '<div id="ghQrCanvas" style="display:inline-block;background:#fff;padding:16px;border-radius:16px;margin-bottom:16px"></div>'+
          '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:20px">'+
            '<button class="gh-btn ghost sm" id="ghQrCopy"><i class="fas fa-copy"></i> '+_qrt('bd_qr_copy')+'</button>'+
            '<button class="gh-btn sm" id="ghQrDownload"><i class="fas fa-download"></i> '+_qrt('bd_qr_download')+'</button>'+
          '</div>'+
          '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;font-size:0.8rem;margin-bottom:16px">'+
            '<i class="fas fa-qrcode" style="color:#10b981;flex-shrink:0"></i>'+
            '<code style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;color:#94a3b8" title="'+esc(res.qrCode)+'">'+esc(res.qrCode)+'</code>'+
          '</div>'+
          '<div style="font-size:0.78rem;color:var(--gh-muted,#64748b)">'+_qrt('bd_qr_scan_count')+' <strong id="ghQrScanCount">…</strong></div>'+
        '</div>'+
        '<div class="gh-card" style="background:rgba(99,102,241,0.05);border-color:rgba(99,102,241,0.15)">'+
          '<div class="gh-biz-sec-head"><h3>'+_qrt('bd_qr_how_to')+'</h3></div>'+
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
    var _svct=typeof GHt==='function'?GHt:function(k){return k;};
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<div class="gh-biz-sec-head"><h2 class="gh-dash-section-title">'+_svct('bd_nav_services')+'</h2>'+
          '<button class="gh-btn" data-ds-add-svc><i class="fas fa-plus"></i> '+_svct('bd_svc_add')+'</button>'+
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
      var _lsvt=typeof GHt==='function'?GHt:function(k){return k;};
      if(!items.length){ el2.innerHTML='<div class="gh-empty"><i class="fas fa-briefcase"></i><h3>'+_lsvt('bd_svc_empty')+'</h3><p>'+_lsvt('bd_svc_empty_hint')+'</p><button class="gh-btn" data-ds-add-svc>'+_lsvt('bd_svc_add')+'</button></div>'; return; }
      el2.innerHTML='<div class="gh-svc-dash-list">'+items.map(function(s){
        return '<div class="gh-svc-dash-item'+(s.active?'':' gh-svc-inactive')+'">'+
          (s.imageUrl?'<img class="gh-svc-dash-thumb" src="'+esc(s.imageUrl)+'" alt="'+esc(s.title)+'" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">':'')+
          '<div class="gh-svc-dash-info">'+
            '<div class="gh-svc-dash-badges">'+
              (s.featured?'<span class="gh-svc-badge featured"><i class="fas fa-star"></i></span>':'')+
              '<span class="gh-svc-badge type">'+esc(s.type||'service')+'</span>'+
              (!s.active?'<span class="gh-svc-badge inactive">'+_lsvt('bd_svc_inactive')+'</span>':'')+
            '</div>'+
            '<strong>'+esc(s.title)+'</strong>'+(s.price?'<span class="gh-svc-dash-price">'+esc(s.price)+' '+esc(s.currency||'GEL')+'</span>':'')+
            (s.description?'<p>'+esc(s.description.slice(0,80))+(s.description.length>80?'…':'')+'</p>':'')+
          '</div>'+
          '<div class="gh-svc-mgmt-row">'+
            '<button class="gh-gallery-feat-btn" data-toggle-svc-feat="'+esc(s.id)+'" data-is-svc-feat="'+!!s.featured+'" title="'+(s.featured?_lsvt('bd_svc_feat_unmark'):_lsvt('bd_svc_feat_mark'))+'">'+(s.featured?'<i class="fas fa-star" style="color:#facc15"></i>':'<i class="far fa-star"></i>')+'</button>'+
            '<button class="gh-btn sm ghost" data-toggle-svc-active="'+esc(s.id)+'" data-is-svc-active="'+!!s.active+'" title="'+(s.active?_lsvt('bd_svc_deactivate'):_lsvt('bd_svc_activate'))+'">'+(s.active?'<i class="fas fa-eye"></i>':'<i class="fas fa-eye-slash"></i>')+'</button>'+
            '<button class="gh-btn sm ghost" data-edit-service="'+esc(s.id)+'"><i class="fas fa-pencil"></i></button>'+
            '<button class="gh-btn sm ghost" data-delete-service="'+esc(s.id)+'"><i class="fas fa-trash"></i></button>'+
          '</div>'+
        '</div>';
      }).join('')+'</div>';
    },true);
  }

  function deleteService(b, serviceId){
    var _dsct=typeof GHt==='function'?GHt:function(k){return k;};
    if(!serviceId||!fs()||!db()) return;
    if(!confirm(_dsct('bd_svc_delete_cfm'))) return;
    fs().deleteDoc(fs().doc(db(),'businesses',b.id,'services',serviceId)).then(function(){
      toast(_dsct('bd_svc_deleted')); loadDashServices(b);
    }).catch(function(err){ toast('Failed: '+(err.message||err),'error'); });
  }

  function renderBizDashGallery(b){
    var cont=$('#ghDashContent'); if(!cont) return;
    var _galt=typeof GHt==='function'?GHt:function(k){return k;};
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<div class="gh-biz-sec-head"><h2 class="gh-dash-section-title">'+_galt('bd_nav_gallery')+'</h2>'+
          '<button class="gh-btn" data-dg-add><i class="fas fa-plus"></i> '+_galt('bd_gal_add')+'</button>'+
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
      var _lgalt=typeof GHt==='function'?GHt:function(k){return k;};
      if(!photos.length){ el2.innerHTML='<div class="gh-empty"><i class="fas fa-images"></i><h3>'+_lgalt('bd_gal_empty')+'</h3><p>'+_lgalt('bd_gal_empty_hint')+'</p><button class="gh-btn" data-dg-add>'+_lgalt('bd_gal_add_first')+'</button></div>'; return; }
      el2.innerHTML='<div class="gh-gallery-grid">'+photos.map(function(p){
        return '<div class="gh-gallery-item gh-gallery-item-mgmt'+(p.featured?' gh-gallery-item-featured':'')+'" data-ph-id="'+esc(p.id)+'">'+
          '<img src="'+esc(p.url||p.imageUrl||'')+'" alt="'+esc(p.caption||'')+'" loading="lazy" onerror="this.closest(\'.gh-gallery-item\').style.display=\'none\'">'+
          (p.featured?'<span class="gh-gallery-featured-badge"><i class="fas fa-star"></i></span>':'')+
          (p.caption?'<div class="gh-gallery-caption">'+esc(p.caption)+'</div>':'')+
          '<div class="gh-gallery-mgmt-bar">'+
            '<button class="gh-gallery-feat-btn" data-toggle-featured="'+esc(p.id)+'" data-is-featured="'+!!p.featured+'" title="'+(p.featured?_lgalt('bd_gal_feat_unmark'):_lgalt('bd_gal_feat_mark'))+'">'+(p.featured?'<i class="fas fa-star" style="color:#facc15"></i>':'<i class="far fa-star"></i>')+'</button>'+
            '<button class="gh-gallery-delete-btn" data-delete-photo="'+esc(p.id)+'"><i class="fas fa-trash"></i></button>'+
          '</div>'+
        '</div>';
      }).join('')+'</div>';
    });
  }

  function deleteGalleryPhoto(b, photoId){
    var _dgpt=typeof GHt==='function'?GHt:function(k){return k;};
    if(!photoId||!fs()||!db()) return;
    if(!confirm(_dgpt('bd_gal_delete_cfm'))) return;
    fs().deleteDoc(fs().doc(db(),'businesses',b.id,'gallery',photoId)).then(function(){
      toast(_dgpt('bd_gal_deleted')); loadDashGallery(b);
    }).catch(function(err){ toast('Failed: '+(err.message||err),'error'); });
  }

  function renderBizDashReviews(b){
    var cont=$('#ghDashContent'); if(!cont) return;
    var _revt=typeof GHt==='function'?GHt:function(k){return k;};
    var ratingAvg=b.ratingCount>0?(b.ratingTotal/b.ratingCount).toFixed(1):(b.ratingAverage>0?Number(b.ratingAverage).toFixed(1):null);
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<h2 class="gh-dash-section-title">'+_revt('bd_nav_reviews')+'</h2>'+
        (ratingAvg?
          '<div class="gh-card" style="margin-bottom:0">'+
            '<div class="gh-biz-rating-row"><div class="gh-biz-rating-big">'+ratingAvg+'</div>'+
            '<div><span class="gh-biz-rating-stars">'+starsHtml(ratingAvg)+'</span><span class="gh-biz-rating-sub">'+Number(b.ratingCount||b.reviewCount||0)+' '+_revt('biz_ov_reviews')+'</span></div></div>'+
          '</div>' : '')+
        '<div class="gh-card" style="margin-bottom:0"><div id="ghDashRevList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>'+
      '</div>';
    listenBusinessReviews(b.id,function(items){
      var el=$('#ghDashRevList'); if(!el) return;
      if(!items.length){el.innerHTML='<div class="gh-empty"><i class="fas fa-star"></i><h3>'+_revt('bd_rev_empty')+'</h3><p>'+_revt('bd_rev_empty_hint')+'</p></div>'; return;}
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
            '<button class="gh-btn sm ghost" disabled title="Reply feature coming in a future update"><i class="fas fa-reply"></i> '+_revt('bd_rev_reply')+'</button>'+
          '</div>'+
        '</div>';
      }).join('')+'</div>';
    });
  }

  /* ── Employee invite helpers ─────────────────────────────── */
  function empTypeLabel(t){
    var _et=typeof GHt==='function'?GHt:function(k){return k;};
    var m={full_time:_et('bd_inv_full_time'),part_time:_et('bd_inv_part_time'),freelance:_et('bd_inv_freelance'),temporary:_et('bd_inv_temporary'),internship:_et('bd_inv_internship')};
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
    var _imt=typeof GHt==='function'?GHt:function(k){return k;};
    modal(_imt('bd_inv_title'),
      '<label class="gh-form-label">'+_imt('bd_inv_email')+'</label>'+
      '<input class="gh-input" id="ghInvEmail" type="email" placeholder="employee@example.com">'+
      '<div style="height:10px"></div>'+
      '<label class="gh-form-label">'+_imt('bd_inv_role')+'</label>'+
      '<input class="gh-input" id="ghInvRole" placeholder="e.g. Sales Manager, Developer…" maxlength="60">'+
      '<div style="height:10px"></div>'+
      '<label class="gh-form-label">'+_imt('bd_inv_type')+'</label>'+
      '<select class="gh-select" id="ghInvType">'+
        '<option value="full_time">'+_imt('bd_inv_full_time')+'</option>'+
        '<option value="part_time">'+_imt('bd_inv_part_time')+'</option>'+
        '<option value="freelance">'+_imt('bd_inv_freelance')+'</option>'+
        '<option value="temporary">'+_imt('bd_inv_temporary')+'</option>'+
        '<option value="internship">'+_imt('bd_inv_internship')+'</option>'+
      '</select>'+
      '<div style="height:10px"></div>'+
      '<label class="gh-form-label">'+_imt('bd_inv_msg')+'</label>'+
      '<textarea class="gh-textarea" id="ghInvMsg" placeholder="'+_imt('bd_inv_msg_ph')+'" rows="3" maxlength="300"></textarea>'+
      '<div id="ghInvError" style="display:none" class="gh-form-hint error"></div>',
      '<button class="gh-btn ghost" data-close-modal>'+_imt('cancel')+'</button><button class="gh-btn" id="ghSendInvite"><i class="fas fa-paper-plane"></i> '+_imt('bd_inv_send')+'</button>',
      'ghInviteModal');
    $('#ghSendInvite').onclick=function(){
      var email=($('#ghInvEmail').value||'').trim().toLowerCase();
      var role=($('#ghInvRole').value||'').trim();
      var type=$('#ghInvType').value||'full_time';
      var msg=($('#ghInvMsg').value||'').trim();
      var errEl=$('#ghInvError');
      if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){errEl.textContent='Valid email required.';errEl.style.display='';return;}
      if(!role){errEl.textContent=typeof GHt==='function'?GHt('role_required'):'Role / job title required.';errEl.style.display='';return;}
      errEl.style.display='none';
      var _isbt=typeof GHt==='function'?GHt:function(k){return k;};
      var btn=$('#ghSendInvite');btn.disabled=true;btn.textContent=_isbt('bd_inv_sending');
      sendEmpInvite(b,{email:email,roleTitle:role,employmentType:type,message:msg},function(ok){
        if(ok){closeModal('ghInviteModal');renderBizDashEmployees(b);}
        else{btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i> '+_isbt('bd_inv_send');errEl.textContent='Failed. Try again.';errEl.style.display='';}
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
    var _empt=typeof GHt==='function'?GHt:function(k){return k;};
    cont.innerHTML=
      '<div class="gh-dash-section">'+
        '<div class="gh-emp-header">'+
          '<h2 class="gh-dash-section-title" style="margin:0">'+_empt('bd_nav_employees')+'</h2>'+
          '<button class="gh-btn sm" id="ghEmpInviteBtn"><i class="fas fa-paper-plane"></i> '+_empt('bd_emp_invite_btn')+'</button>'+
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
            '<div class="gh-emp-sec-title"><i class="fas fa-user-check"></i> '+_empt('bd_emp_members')+' ('+staff.length+')</div>';
          if(!staff.length){html+='<div class="gh-emp-empty">'+_empt('bd_emp_no_members')+'</div>';}
          else{html+='<div class="gh-emp-list">'+staff.map(function(s){
            var sid=s.userId||s.id;
            return '<div class="gh-emp-card">'+
              '<div class="gh-avatar" style="flex-shrink:0">'+esc(initials(s.displayName||s.email||'?'))+'</div>'+
              '<div class="gh-emp-info">'+
                '<div class="gh-emp-name">'+esc(s.displayName||s.email||'Employee')+'</div>'+
                '<div class="gh-emp-meta">'+
                  (s.roleTitle?'<span class="gh-emp-role">'+esc(s.roleTitle)+'</span>':'')+
                  (s.employmentType?'<span class="gh-emp-type">'+esc(empTypeLabel(s.employmentType))+'</span>':'')+
                  '<span class="gh-emp-badge accepted">'+_empt('bd_emp_active')+'</span>'+
                '</div>'+
              '</div>'+
              '<select class="gh-emp-vis-select" data-staff-vis="'+esc(sid)+'" title="Profile visibility">'+
                '<option value="public"'+(s.visibility==='public'?' selected':'')+'>'+_empt('bd_emp_public')+'</option>'+
                '<option value="companies_only"'+(s.visibility==='companies_only'?' selected':'')+'>'+_empt('bd_emp_companies')+'</option>'+
                '<option value="hidden"'+(s.visibility==='hidden'?' selected':'')+'>'+_empt('bd_emp_hidden')+'</option>'+
              '</select>'+
            '</div>';
          }).join('')+'</div>';}
          html+='</div>';
          // Pending invites
          html+='<div class="gh-emp-section">'+
            '<div class="gh-emp-sec-title"><i class="fas fa-clock"></i> '+_empt('bd_emp_pending')+' ('+pending.length+')</div>';
          if(!pending.length){html+='<div class="gh-emp-empty">'+_empt('bd_emp_no_pending')+'</div>';}
          else{html+='<div class="gh-emp-list">'+pending.map(function(inv){
            return '<div class="gh-emp-card">'+
              '<div class="gh-avatar" style="flex-shrink:0;color:var(--gh-muted);font-size:.85rem"><i class="fas fa-envelope"></i></div>'+
              '<div class="gh-emp-info">'+
                '<div class="gh-emp-name">'+esc(inv.invitedEmail||inv.inviteeEmail||'')+'</div>'+
                '<div class="gh-emp-meta">'+
                  (inv.roleTitle?'<span class="gh-emp-role">'+esc(inv.roleTitle)+'</span>':'')+
                  (inv.employmentType?'<span class="gh-emp-type">'+esc(empTypeLabel(inv.employmentType))+'</span>':'')+
                  '<span class="gh-emp-badge pending">'+_empt('bd_emp_pending_badge')+'</span>'+
                '</div>'+
                (inv.message?'<div class="gh-emp-msg">"'+esc(inv.message)+'"</div>':'')+
              '</div>'+
              '<button class="gh-btn xs danger" data-cancel-invite="'+esc(inv.id)+'"><i class="fas fa-xmark"></i> '+_empt('bd_emp_cancel')+'</button>'+
            '</div>';
          }).join('')+'</div>';}
          html+='</div>';
          // Declined/cancelled — collapsible
          if(declined.length){
            html+='<details class="gh-emp-section">'+
              '<summary class="gh-emp-sec-title" style="cursor:pointer;user-select:none"><i class="fas fa-ban"></i> '+_empt('bd_emp_declined')+' ('+declined.length+')</summary>'+
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
              var _cit=typeof GHt==='function'?GHt:function(k){return k;};
              if(!confirm(_cit('bd_emp_cancel_cfm'))) return;
              btn.disabled=true;btn.innerHTML='…';
              cancelEmpInvite(b,btn.dataset.cancelInvite,function(ok){
                if(ok){toast(_cit('bd_emp_cancelled'));paint();}
                else{btn.disabled=false;btn.innerHTML='<i class="fas fa-xmark"></i> '+_cit('bd_emp_cancel');toast('Failed','error');}
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
    var _ant=typeof GHt==='function'?GHt:function(k){return k;};
    cont.innerHTML='<div class="gh-dash-section"><h2 class="gh-dash-section-title">'+_ant('bd_nav_analytics')+'</h2><div id="ghDaBody"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>';
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
        {icon:'fa-phone',label:_ant('bd_an_calls'),val:sum30.phones},
        {icon:'fa-brands fa-whatsapp',label:_ant('biz_ov_whatsapp'),val:sum30.wa},
        {icon:'fa-envelope',label:_ant('bd_an_emails'),val:sum30.email},
        {icon:'fa-calendar-check',label:_ant('bd_an_bookings'),val:sum30.booking},
        {icon:'fa-globe',label:_ant('biz_ov_website'),val:sum30.website},
        {icon:'fa-map-location-dot',label:_ant('biz_ab_directions'),val:sum30.directions},
        {icon:'fa-briefcase',label:_ant('bd_nav_services'),val:sum30.service},
      ];
      var maxIA=Math.max.apply(null,interactions.map(function(x){return x.val;}))||1;
      var hasData=days.length>0&&(sum30.views>0||interactions.some(function(x){return x.val>0;}));
      if(!hasData){
        el.innerHTML='<div class="gh-card"><div class="gh-empty"><i class="fas fa-chart-bar"></i><h3>'+_ant('bd_an_no_data')+'</h3><p>'+_ant('bd_an_no_data_hint')+'</p></div></div>';
        return;
      }
      function daKpiCard(icon,label,val){
        return '<div class="gh-da-kpi-card"><i class="fas '+icon+'"></i><div class="gh-da-kpi-body"><span class="gh-da-kpi-val">'+val+'</span><span class="gh-da-kpi-label">'+label+'</span></div></div>';
      }
      var ratingAvg=b.ratingCount>0?(b.ratingTotal/b.ratingCount).toFixed(1):(b.ratingAverage>0?Number(b.ratingAverage).toFixed(1):'—');
      el.innerHTML=
        '<div class="gh-da-section">'+
          '<h3 class="gh-da-section-title">'+_ant('bd_nav_overview')+'</h3>'+
          '<div class="gh-da-kpi-grid">'+
            daKpiCard('fa-eye',_ant('bd_an_views_today'),viewsToday||'—')+
            daKpiCard('fa-calendar-week',_ant('bd_an_views_7d'),sum7.views||'—')+
            daKpiCard('fa-calendar',_ant('bd_an_views_30d'),sum30.views||'—')+
            daKpiCard('fa-users',_ant('bd_ov_followers'),Number(b.followerCount||0))+
            daKpiCard('fa-star',_ant('biz_ov_rating'),ratingAvg)+
            daKpiCard('fa-comment-dots',_ant('bd_nav_reviews'),Number(b.reviewCount||0))+
            daKpiCard('fa-newspaper',_ant('bd_nav_posts'),Number(b.postCount||0))+
            daKpiCard('fa-heart',_ant('bd_an_follows_30d'),sum30.follows||'—')+
          '</div>'+
        '</div>'+
        (interactions.some(function(x){return x.val>0;})?
          '<div class="gh-da-section">'+
            '<h3 class="gh-da-section-title">'+_ant('bd_an_interactions')+' <span class="gh-muted" style="font-size:.78rem;font-weight:400">('+_ant('bd_an_30d_note')+')</span></h3>'+
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
            '<h3 class="gh-da-section-title">'+_ant('bd_an_last7')+'</h3>'+
            '<div class="gh-da-days">'+
              '<div class="gh-da-day-head"><span>'+_ant('bd_an_date')+'</span><span>'+_ant('bd_an_views')+'</span><span>'+_ant('bd_an_contacts')+'</span><span>'+_ant('bd_an_follows')+'</span></div>'+
              days.slice(0,7).map(function(d){
                var contacts=(Number(d.phoneClicks)||0)+(Number(d.whatsappClicks)||0)+(Number(d.emailClicks)||0)+(Number(d.bookingClicks)||0)+(Number(d.websiteClicks)||0)+(Number(d.directionsClicks)||0)+(Number(d.serviceClicks)||0);
                var isToday=d.date===today;
                return '<div class="gh-da-day-row'+(isToday?' gh-da-today':'')+'">'+
                  '<span>'+(isToday?_ant('biz_ov_today'):esc(d.date||''))+'</span>'+
                  '<span>'+(Number(d.views)||0)+'</span>'+
                  '<span>'+contacts+'</span>'+
                  '<span>'+(Number(d.follows)||0)+'</span>'+
                '</div>';
              }).join('')+
            '</div>'+
          '</div>':'');
    }).catch(function(){var _anft=typeof GHt==='function'?GHt:function(k){return k;};var el=$('#ghDaBody');if(el)el.innerHTML='<div class="gh-card"><div class="gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>'+_anft('bd_an_fail')+'</h3></div></div>';});
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

  function renderBizVideos(b){
    var box=$('#ghBusinessTabContent'); if(!box)return;
    box.innerHTML='<div id="ghBizVideoList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;padding:4px 0"><div style="color:var(--text-muted,#888);font-size:.85rem;grid-column:1/-1;padding:20px 0;text-align:center"><i class="fas fa-circle-notch fa-spin"></i></div></div>';
    var _fs=window.GeoFirebase&&window.GeoFirebase.fs?window.GeoFirebase.fs:null;
    var _db=window.GeoFirebase&&window.GeoFirebase.db?window.GeoFirebase.db:null;
    if(!_fs||!_db){box.querySelector('#ghBizVideoList').innerHTML='<div style="color:var(--text-muted,#888);font-size:.85rem;grid-column:1/-1;padding:20px 0;text-align:center"><i class="fas fa-film"></i> ვიდეო არ არის</div>';return;}
    var q=_fs.query(_fs.collection(_db,'videos'),_fs.where('businessId','==',b.id),_fs.where('status','==','active'),_fs.orderBy('createdAt','desc'),_fs.limit(12));
    _fs.getDocs(q).then(function(snap){
      var list=box.querySelector('#ghBizVideoList'); if(!list)return;
      if(snap.empty){list.innerHTML='<div style="color:var(--text-muted,#888);font-size:.85rem;grid-column:1/-1;padding:40px 0;text-align:center"><i class="fas fa-film" style="font-size:2rem;display:block;margin-bottom:8px;opacity:.4"></i>ვიდეო ჯერ არ არის</div>';return;}
      var html='';
      snap.forEach(function(d){
        var v=Object.assign({id:d.id},d.data());
        var thumb=v.thumbnail||('https://i.ytimg.com/vi/'+(v.youtubeId||'')+'/'+'hqdefault.jpg');
        html+='<a href="watch.html?v='+esc(v.id)+'" style="display:block;border-radius:10px;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);text-decoration:none;transition:transform .15s" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'\'">'+
          '<div style="position:relative;padding-top:56.25%;background:#000"><img src="'+esc(thumb)+'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" loading="lazy">'+
          '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25)"><div style="width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem"><i class="fas fa-play"></i></div></div></div>'+
          '<div style="padding:8px 10px"><div style="font-size:.8rem;font-weight:600;color:var(--text-primary,#f1f5f9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(v.title||'Video')+'</div>'+
          (v.city?'<div style="font-size:.7rem;color:var(--text-muted,#888);margin-top:2px"><i class="fas fa-location-dot" style="margin-right:3px"></i>'+esc(v.city)+'</div>':'')+
          '</div></a>';
      });
      list.innerHTML=html;
    }).catch(function(){
      var list=box.querySelector('#ghBizVideoList'); if(list)list.innerHTML='<div style="color:var(--text-muted,#888);font-size:.85rem;grid-column:1/-1;padding:20px 0;text-align:center"><i class="fas fa-film"></i> ვიდეო ვერ ჩაიტვირთა</div>';
    });
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
    if(tab==='videos')  { renderBizVideos(b); return; }
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
    var _ovt=typeof GHt==='function'?GHt:function(k){return k;};
    var sLinks=b.socialLinks||{};
    var ratingAvg = b.ratingCount>0 ? (b.ratingTotal/b.ratingCount).toFixed(1) : (b.ratingAverage>0 ? Number(b.ratingAverage).toFixed(1) : null);
    var infoCards='';
    if(b.phone)    infoCards+=bizInfoCard('fa-phone',_ovt('biz_ov_phone'),b.phone,'tel:'+b.phone);
    if(b.email)    infoCards+=bizInfoCard('fa-envelope',_ovt('biz_ov_email'),b.email,'mailto:'+b.email);
    if(b.website)  infoCards+=bizInfoCard('fa-globe',_ovt('biz_ov_website'),b.website,b.website);
    if(!isOnlineBusiness(b)&&b.city) infoCards+=bizInfoCard('fa-location-dot',_ovt('biz_ov_location'),b.address?b.address+', '+b.city:b.city,'');
    if(isOnlineBusiness(b))          infoCards+=bizInfoCard('fa-globe',_ovt('biz_ov_service_area'),b.serviceAreaText||businessAreaLabel(b),'');
    if(b.workingHours){
      var nhOv=normWorkingHours(b.workingHours);
      var ovS=nhOv?isOpenNow(nhOv):null;
      var ovBadge=ovS?'<span class="gh-hours-status '+(ovS.open?'open':'closed')+'" style="margin-left:6px;font-size:.7rem"><i class="fas fa-circle" style="font-size:.5rem;vertical-align:middle"></i> '+(ovS.open?_ovt('biz_ov_open_now'):_ovt('biz_ov_closed'))+'</span>':'';
      infoCards+=bizInfoCardHtml('fa-clock',_ovt('biz_ov_today'),esc(formatWorkingHours(b.workingHours))+ovBadge);
    }
    if(b.priceRange||b.startingPrice) infoCards+=bizInfoCard('fa-tag',_ovt('biz_ov_pricing'),(b.startingPrice?_ovt('biz_ov_from')+b.startingPrice+' · ':'')+esc(b.priceRange||''));
    var sIg=sLinks.instagram||b.instagram||''; var sFb=sLinks.facebook||b.facebook||''; var sWa=sLinks.whatsapp||b.whatsapp||'';
    if(sIg) infoCards+=bizInfoCard('fa-brands fa-instagram',_ovt('biz_ov_instagram'),sIg,'https://instagram.com/'+sIg.replace(/^@/,''));
    if(sFb) infoCards+=bizInfoCard('fa-brands fa-facebook',_ovt('biz_ov_facebook'),sFb,sFb.startsWith('http')?sFb:'https://facebook.com/'+sFb);
    if(sWa) infoCards+=bizInfoCard('fa-brands fa-whatsapp',_ovt('biz_ov_whatsapp'),sWa,'https://wa.me/'+sWa.replace(/\D/g,''));

    var ratingSection = ratingAvg ?
      '<div class="gh-card" style="margin-bottom:0">'+
        '<div class="gh-biz-sec-head"><h3>'+_ovt('biz_ov_rating')+'</h3><button class="gh-btn sm ghost" data-switch-tab="reviews">'+_ovt('biz_ov_all_reviews')+'</button></div>'+
        '<div class="gh-biz-rating-row">'+
          '<div class="gh-biz-rating-big">'+ratingAvg+'</div>'+
          '<div><span class="gh-biz-rating-stars">'+starsHtml(ratingAvg)+'</span><span class="gh-biz-rating-sub">'+Number(b.ratingCount||b.reviewCount||0)+' '+_ovt('biz_ov_reviews')+'</span></div>'+
        '</div>'+
      '</div>' : '';

    box.innerHTML=
      '<div style="display:grid;gap:14px">'+
      (b.description ? '<div class="gh-card" style="margin-bottom:0"><p style="margin:0;line-height:1.65;color:var(--gh-text)">'+esc(b.description)+'</p></div>' : '')+
      (infoCards ? '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>'+_ovt('biz_ov_contact_info')+'</h3></div><div class="gh-biz-info-grid">'+infoCards+'</div></div>' : '')+
      ratingSection+
      '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>'+_ovt('biz_ov_latest_posts')+'</h3><button class="gh-btn sm ghost" data-switch-tab="posts">'+_ovt('biz_ov_all_posts')+'</button></div><div id="ghOvPosts"><div class="gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>'+
      '<div class="gh-card" style="margin-bottom:0" id="ghOvSvcWrap"><div class="gh-biz-sec-head"><h3>'+_ovt('biz_ov_services')+'</h3><button class="gh-btn sm ghost" data-switch-tab="services">'+_ovt('biz_ov_all_services')+'</button></div><div id="ghOvSvc"><div class="gh-empty" style="min-height:60px"><i class="fas fa-circle-notch fa-spin"></i></div></div></div>'+
      '</div>';

    box.onclick=function(e){ var sw=e.target.closest('[data-switch-tab]'); if(sw){ state.currentBusinessTab=sw.dataset.switchTab; $all('[data-biz-tab]').forEach(function(x){x.classList.toggle('active',x.dataset.bizTab===state.currentBusinessTab);}); renderBusinessTab(b); } };

    listenTargetPosts('business',b.id,function(posts){ var el=$('#ghOvPosts'); if(!el)return; posts=posts.filter(canSeePost).slice(0,3); if(!posts.length){el.innerHTML='<div class="gh-empty" style="min-height:60px"><i class="fas fa-newspaper"></i><p>'+_ovt('biz_ov_no_posts')+'</p></div>'; return;} el.innerHTML='<div class="gh-biz-preview-posts">'+posts.map(function(p){ return '<div class="gh-biz-preview-post">'+esc((p.text||'').slice(0,160))+'</div>'; }).join('')+'</div>'; });

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
    var _abt=typeof GHt==='function'?GHt:function(k){return k;};
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
        '<span class="gh-hours-status '+(openStatus.open?'open':'closed')+'"><i class="fas fa-circle"></i> '+(openStatus.open?_abt('biz_ov_open_now'):_abt('biz_ov_closed'))+'</span>'+
        (openStatus.hours?'<span class="gh-hours-today-label">'+esc(openStatus.hours)+'</span>':'')+
        (!openStatus.open&&openStatus.nextOpen?'<span class="gh-hours-next">'+_abt('biz_ab_opens')+esc(openStatus.nextOpen)+'</span>':'')+
      '</div>';
    }
    var hoursHtml='';
    if(nh){
      hoursHtml=hoursStatusHtml+'<div class="gh-hours-grid">'+DAYS_KEYS.map(function(k,i){
        var h=nh[k]; var isToday=DAYS_LABELS[i]===todayLabel;
        var label=h?(h.closed?'<em class="gh-hours-closed-label">'+_abt('biz_ov_closed')+'</em>':esc((h.open||'09:00')+' – '+(h.close||'18:00'))):'—';
        return '<div class="gh-hours-row'+(isToday?' today':'')+'"><span>'+DAYS_LABELS[i].slice(0,3)+'</span><span>'+label+'</span></div>';
      }).join('')+'</div>';
    } else if(b.workingHours&&typeof b.workingHours==='string'){
      hoursHtml='<p style="margin:0;font-size:.88rem;color:var(--gh-text)">'+esc(b.workingHours)+'</p>';
    } else {
      hoursHtml='<p class="gh-muted" style="margin:0;font-size:.85rem">'+_abt('biz_ab_no_hours')+'</p>';
    }

    // Contact CTA buttons — only for real data
    var ctaBtns=[];
    if(b.phone)      ctaBtns.push('<a href="tel:'+esc(b.phone)+'" class="gh-contact-cta-btn" data-track-cta="phoneClicks"><i class="fas fa-phone"></i> '+_abt('biz_ab_call')+'</a>');
    if(wa)           ctaBtns.push('<a href="https://wa.me/'+esc(wa.replace(/\D/g,''))+'" target="_blank" rel="noopener" class="gh-contact-cta-btn" data-track-cta="whatsappClicks"><i class="fab fa-whatsapp"></i> '+_abt('biz_ov_whatsapp')+'</a>');
    if(b.email)      ctaBtns.push('<a href="mailto:'+esc(b.email)+'" class="gh-contact-cta-btn" data-track-cta="emailClicks"><i class="fas fa-envelope"></i> '+_abt('biz_ov_email')+'</a>');
    if(bookingUrl)   ctaBtns.push('<a href="'+esc(bookingUrl)+'" target="_blank" rel="noopener" class="gh-contact-cta-btn primary" data-track-cta="bookingClicks"><i class="fas fa-calendar-check"></i> '+_abt('biz_ab_book')+'</a>');
    if(b.website)    ctaBtns.push('<a href="'+esc(b.website)+'" target="_blank" rel="noopener" class="gh-contact-cta-btn" data-track-cta="websiteClicks"><i class="fas fa-globe"></i> '+_abt('biz_ov_website')+'</a>');
    if(!isOnlineBusiness(b)&&_mapsUrl) ctaBtns.push('<a href="'+esc(_mapsUrl)+'" target="_blank" rel="noopener" class="gh-contact-cta-btn" data-track-cta="directionsClicks"><i class="fas fa-map-location-dot"></i> '+_abt('biz_ab_directions')+'</a>');
    var ctaHtml=ctaBtns.length?'<div class="gh-contact-ctas">'+ctaBtns.join('')+'</div>':'';
    var hasContact=b.phone||b.email||b.website||ig||fb||wa||tk||li||bookingUrl;

    box.innerHTML=
      '<div id="ghBizInviteBanner"></div>'+
      '<div class="gh-biz-about-grid">'+
        '<div style="display:grid;gap:12px">'+
          (b.description?'<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>'+_abt('biz_ab_about')+'</h3></div><p style="margin:0;line-height:1.65;font-size:.9rem;color:var(--gh-text)">'+esc(b.description)+'</p></div>':'')+
          '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>'+_abt('biz_ab_contact')+'</h3></div>'+
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
              (!hasContact?'<p class="gh-muted" style="font-size:.85rem;margin:0">'+_abt('biz_ab_no_contact')+'</p>':'')+
            '</div>'+
          '</div>'+
          (!isOnlineBusiness(b)&&(b.city||b.address)?
            '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>'+_abt('biz_ov_location')+'</h3></div><div class="gh-about-list">'+
              aboutRow('fa-location-dot',b.address?b.address+', '+b.city:b.city)+
              (_mapsUrl?'<a href="'+esc(_mapsUrl)+'" target="_blank" rel="noopener" class="gh-btn sm ghost" style="margin-top:8px"><i class="fas fa-map-location-dot"></i> '+_abt('biz_ab_directions')+'</a>':'')+
              (!_placeCoords&&!isOnlineBusiness(b)?'<p style="margin:8px 0 0;font-size:.78rem;color:#f59e0b"><i class="fas fa-triangle-exclamation"></i> '+_abt('biz_ab_no_gps')+'</p>':'')+
            '</div></div>':'')+
          (isOnlineBusiness(b)?'<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>'+_abt('biz_ab_service_area')+'</h3></div>'+aboutRow('fa-globe',b.serviceAreaText||businessAreaLabel(b))+'</div>':'')+
        '</div>'+
        '<div style="display:grid;gap:12px">'+
          '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>'+_abt('biz_ab_working_hrs')+'</h3></div>'+hoursHtml+'</div>'+
          ((b.priceRange||b.startingPrice)?
            '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>'+_abt('biz_ov_pricing')+'</h3></div><div class="gh-about-list">'+
              (b.priceRange?aboutRow('fa-tag',_abt('biz_ab_range')+b.priceRange):'')+
              (b.startingPrice?aboutRow('fa-tag',_abt('biz_ab_starting_from')+b.startingPrice):'')+
            '</div></div>':'')+
          '<div class="gh-card" style="margin-bottom:0"><div class="gh-biz-sec-head"><h3>'+_abt('biz_ab_details')+'</h3></div><div class="gh-about-list">'+
            aboutRow('fa-store',b.category||'Business')+
            aboutRow(isOnlineBusiness(b)?'fa-globe':'fa-location-dot',isOnlineBusiness(b)?_abt('biz_ab_online'):_abt('biz_ab_physical'))+
            (b.plan&&b.plan!=='free'?aboutRow('fa-crown',_abt('biz_ab_pro')):aboutRow('fa-circle-check',_abt('biz_ab_free_listing')))+
          '</div></div>'+
        '</div>'+
      '</div>'+
      '<div id="ghBizTeamSection" style="margin-top:16px"></div>';
    loadPublicTeam(b);
    checkInviteBanner(b);
  }

  function loadPublicTeam(b){
    var el=$('#ghBizTeamSection'); if(!el) return;
    var _tmt=typeof GHt==='function'?GHt:function(k){return k;};
    loadBizStaff(b.id,function(staff){
      if(!staff.length){return;}
      el.innerHTML='<div class="gh-card" style="margin-bottom:0">'+
        '<div class="gh-biz-sec-head"><h3>'+_tmt('biz_ab_team')+'</h3></div>'+
        '<div class="gh-team-grid">'+
        staff.map(function(s){
          return '<div class="gh-team-card">'+
            '<div class="gh-team-avatar">'+esc(initials(s.displayName||s.email||'?'))+'</div>'+
            '<div class="gh-team-name">'+esc(s.displayName||s.email||_tmt('biz_ab_team_member'))+'</div>'+
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
      $('#ghDeclineInvite').onclick=function(){window.ghConfirm(typeof GHt==='function'?GHt('invite_decline_cfm'):'Decline this invitation?',function(){declineEmpInvite(b,inv.id);});};
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
    window.ghConfirm(typeof GHt==='function'?GHt('review_delete_cfm'):'Delete your review? This cannot be undone.', function(){
      fs().deleteDoc(fs().doc(db(),'businessReviews',reviewId))
        .then(function(){return fs().updateDoc(fs().doc(db(),'businesses',bizId),{reviewCount:fs().increment(-1),ratingTotal:fs().increment(-oldRating),ratingCount:fs().increment(-1)}).catch(function(){});})
        .then(function(){toast('Review deleted');})
        .catch(function(err){toast('Delete failed: '+(err.code||err.message),'error');});
    });
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
    window.ghConfirm(typeof GHt==='function'?GHt('reply_delete_cfm'):'Delete your reply?', function(){
      fs().updateDoc(fs().doc(db(),'businessReviews',reviewId),{ownerReply:null})
        .then(function(){toast('Reply deleted');})
        .catch(function(err){toast('Failed: '+(err.code||err.message),'error');});
    });
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
    var _t=typeof GHt==='function'?GHt:function(k){return k;};
    if(!user){ btn.classList.remove('is-following'); btn.innerHTML='<i class="fas fa-plus"></i> '+_t('follow'); return; }
    if(!fs() || !db()){ btn.innerHTML='<i class="fas fa-plus"></i> '+_t('follow'); return; }
    var id=businessId+'_'+user.uid;
    fs().getDoc(fs().doc(db(),'businessFollowers',id)).then(function(d){
      if(d.exists()){
        btn.classList.add('is-following');
        btn.innerHTML='<i class="fas fa-check"></i> '+_t('unfollow');
        btn.title='Click to unfollow';
      }else{
        btn.classList.remove('is-following');
        btn.innerHTML='<i class="fas fa-plus"></i> '+_t('follow');
        btn.title='Follow this business';
      }
    }).catch(function(){
      btn.classList.remove('is-following');
      btn.innerHTML='<i class="fas fa-plus"></i> '+_t('follow');
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
    var _gt=typeof GHt==='function'?GHt:function(k){return k;};
    shell({ active:'groups', center:'<div class="gh-card"><div class="gh-section-title"><div><h1 data-i18n="nav_groups">Groups</h1><p class="gh-muted" style="margin:.25rem 0 0">'+_gt('grp_subtitle')+'</p></div><button class="gh-btn" id="ghOpenGroupCreate"><i class="fas fa-plus"></i>'+_gt('create_group')+'</button></div><input class="gh-input" id="ghGroupSearch" data-i18n-placeholder="search" placeholder="Search groups…"><div style="height:12px"></div><div class="gh-pill-row"><button class="gh-pill active" data-group-tab="discover">'+_gt('groups_discover')+'</button><button class="gh-pill" data-group-tab="mine">'+_gt('groups_mine')+'</button><button class="gh-pill" data-group-tab="requests">'+_gt('groups_requests')+'</button></div></div><div id="ghGroupsList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>' });
    var groups=[], myGroups=[], requests={}; state.groupTab='discover';
    function paint(){ var _gpt=typeof GHt==='function'?GHt:function(k){return k;}; var q=($('#ghGroupSearch').value||'').toLowerCase(); var arr=state.groupTab==='mine'?myGroups:groups; if(state.groupTab==='discover') arr=arr.filter(function(g){return (g.privacy||'public')!=='secret';}); if(state.groupTab==='requests'){ var ids=Object.keys(requests||{}); arr=groups.filter(function(g){return ids.indexOf(g.id)>-1;}); } arr=arr.filter(function(g){return !q||JSON.stringify(g).toLowerCase().includes(q);}); var list=$('#ghGroupsList'); if(!arr.length){ list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-users"></i><h3>'+_gpt('grp_no_groups')+'</h3><p>'+_gpt('grp_no_groups_hint')+'</p><button class="gh-btn" id="ghEmptyCreateGroup">'+_gpt('create_group')+'</button></div>'; return; } list.innerHTML='<div class="gh-grid">'+arr.map(groupCard).join('')+'</div>'; }
    $('#ghOpenGroupCreate').onclick=openGroupCreate;
    $('#ghCenter').addEventListener('click', function(e){ var t=e.target.closest('[data-group-tab]'); if(t){ state.groupTab=t.dataset.groupTab; $all('[data-group-tab]').forEach(function(x){x.classList.toggle('active',x===t);}); paint(); return; } if(e.target.closest('#ghEmptyCreateGroup')) openGroupCreate(); var j=e.target.closest('[data-join-group]'); if(j){ var gPrivacy=j.dataset.privacy; if(gPrivacy==='private'||gPrivacy==='secret') GS().requestJoinGroup(j.dataset.joinGroup,function(){paint();}); else GS().toggleGroupMember(j.dataset.joinGroup,j.dataset.name,function(){paint();}); } });
    $('#ghGroupSearch').oninput=paint;
    ready(function(){ GS().listenGroups(function(items){ groups=items; paint(); }); var u=authUser(); if(u){ GS().listenMyGroups(u.uid,function(items){ myGroups=items; paint(); }); GS().getMyJoinRequests(function(map){ requests=map; paint(); }); } });
    if(location.hash==='#create') setTimeout(openGroupCreate,350);
  }

  function groupCard(g){ var _gt=typeof GHt==='function'?GHt:function(k){return k;}; var title=g.name||'Untitled group'; var cover=getItemCover(g); var privIcon=grPrivacyIcon(g.privacy||'public'); return '<article class="gh-card gh-item-card"><div class="gh-item-media">'+itemMediaHtml(cover,title,'fa-users')+'<span class="gh-type-badge">'+privIcon+' '+esc(g.privacy||'public')+'</span></div><div class="gh-item-body"><h3>'+esc(title)+'</h3><p>'+esc((g.description||_gt('grp_community')).slice(0,100))+'</p><div class="gh-item-meta"><span class="gh-chip"><i class="fas fa-users"></i> '+Number(g.memberCount||0)+'</span><span class="gh-chip">'+esc(g.category||'general')+'</span></div><div class="gh-card-actions"><a class="gh-btn sm" href="groups.html?id='+encodeURIComponent(g.id)+'">'+_gt('evt_view')+'</a><button class="gh-btn sm ghost" data-join-group="'+esc(g.id)+'" data-name="'+esc(title)+'" data-privacy="'+esc(g.privacy||'public')+'">'+((g.privacy==='private'||g.privacy==='secret')?_gt('group_request_join'):_gt('group_join'))+'</button></div></div></article>'; }

  function openGroupCreate(){
    if(!requireLogin()) return;
    var _gct=typeof GHt==='function'?GHt:function(k){return k;};
    var body='<input class="gh-input" id="ghGroupName" placeholder="'+_gct('grp_name_ph')+'"><div style="height:8px"></div><textarea class="gh-textarea" id="ghGroupDesc" placeholder="'+_gct('grp_desc_ph')+'" rows="3"></textarea><div style="height:8px"></div><select class="gh-select" id="ghGroupCat"><option value="general">General</option><option value="hiking">Hiking</option><option value="travel">Travel</option><option value="photography">Photography</option><option value="business">Business</option><option value="learning">Learning</option><option value="fitness">Fitness</option><option value="nightlife">Nightlife</option></select><div style="height:8px"></div><select class="gh-select" id="ghGroupPrivacy"><option value="public">'+_gct('grp_privacy_pub')+'</option><option value="private">'+_gct('grp_privacy_priv')+'</option><option value="secret">'+_gct('grp_privacy_sec')+'</option></select><div style="height:8px"></div><div style="display:flex;gap:8px;align-items:center"><input class="gh-input" id="ghGroupCover" placeholder="'+_gct('grp_cover_ph')+'" style="flex:1"><label for="ghGroupCoverFile" class="gh-btn ghost sm" id="ghGrCoverUploadLbl" style="cursor:pointer;white-space:nowrap;flex-shrink:0;padding:10px 13px"><i class="fas fa-upload"></i></label><input type="file" id="ghGroupCoverFile" accept="image/*" style="display:none"></div>';
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
    var _git=typeof GHt==='function'?GHt:function(k){return k;};
    shell({ active:'groups', center:'<div id="ghGroupInviteWrap"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>'+_git('grp_loading_invite')+'</h3></div></div>' });
    ready(function(){ GS().getGroupByInviteToken(token, function(g){ var _gi2=typeof GHt==='function'?GHt:function(k){return k;}; var wrap=$('#ghGroupInviteWrap'); if(!g){ wrap.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-link-slash"></i><h3>'+_gi2('grp_invite_invalid')+'</h3><a class="gh-btn" href="groups.html">'+_gi2('grp_browse')+'</a></div>'; return; } var cover=getItemCover(g); wrap.innerHTML='<div class="gh-card" style="text-align:center;padding:32px 24px">'+(cover?'<img src="'+esc(cover)+'" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;margin-bottom:20px">':'<div style="font-size:3rem;margin-bottom:16px"><i class="fas fa-users" style="color:var(--gh-green)"></i></div>')+'<h2 style="margin-bottom:8px">'+_gi2('grp_invited_to')+'</h2><h1 style="margin-bottom:12px">'+esc(g.name||'Group')+'</h1><p class="gh-muted" style="margin-bottom:20px">'+esc(g.description||'')+'</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="gh-btn" id="ghInviteJoin"><i class="fas fa-user-plus"></i> '+_gi2('grp_join_btn')+'</button><a class="gh-btn ghost" href="groups.html?id='+encodeURIComponent(g.id)+'">'+_gi2('grp_view')+'</a></div></div>'; $('#ghInviteJoin').onclick=function(){ if(!requireLogin())return; GS().joinGroupViaInvite(g.id,g.name,function(ok){ if(ok) location.href='groups.html?id='+encodeURIComponent(g.id); }); }; }); });
  }

  function renderGroupDetail(id){
    shell({ active:'groups', center:'<div id="ghGroupDetail"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>'+(typeof GHt==='function'?GHt('grp_loading'):'Loading group…')+'</h3></div></div>' });
    state.currentGroupId=id; state.currentGroupRole=null; state.currentGroupData=null; state.currentGroupMuted=false; state.currentGroupJoinRequested=false; state.grTabUnsubs=[];
    ready(function(){
      GS().getGroupMemberRole(id, function(role){
        var prev=state.currentGroupRole; state.currentGroupRole=role;
        if(!role){ GS().checkJoinRequest(id,function(s){ state.currentGroupJoinRequested=(s==='pending'); if(state.currentGroupData) paintGroupDetail(state.currentGroupData); }); } else { state.currentGroupJoinRequested=false; }
        if(prev!==role && state.currentGroupData) paintGroupDetail(state.currentGroupData);
      });
      GS().getGroupMuteStatus(id, function(muted){ state.currentGroupMuted=muted; });
      var _u=fs().onSnapshot(fs().doc(db(),'groups',id), function(snap){ var _gdt=typeof GHt==='function'?GHt:function(k){return k;}; if(!snap.exists()){ $('#ghGroupDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-users-slash"></i><h3>'+_gdt('grp_not_found')+'</h3></div>'; return; } var g=Object.assign({id:id},snap.data()); state.currentGroupData=g; paintGroupDetail(g); }, function(err){ $('#ghGroupDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Failed</h3><p>'+esc(err.message)+'</p></div>'; });
      state.pageUnsubs.push(_u);
    });
  }

  function paintGroupDetail(g){
    var title=g.name||'Group'; var cover=getItemCover(g);
    var uid=authUser()&&authUser().uid; var privacy=g.privacy||'public';
    var isAdmin=grIsAdmin(g); var isMember=grIsMember(); var isMuted=state.currentGroupMuted;
    var _gpdt=typeof GHt==='function'?GHt:function(k){return k;};
    if(privacy==='secret'&&!isMember&&!isAdmin){ $('#ghGroupDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-eye-slash"></i><h3>'+_gpdt('grp_secret')+'</h3><p>'+_gpdt('grp_secret_hint')+'</p><a class="gh-btn" href="groups.html">'+_gpdt('grp_browse')+'</a></div>'; return; }
    var _gt=typeof GHt==='function'?GHt:function(k){return k;};
    var joinBtn=!isMember?(state.currentGroupJoinRequested?'<button class="gh-btn ghost" data-group-cancel-request><i class="fas fa-hourglass-half"></i> '+_gt('group_pending')+'</button>':((privacy==='private'||privacy==='secret')?'<button class="gh-btn" data-group-join-request><i class="fas fa-hand-paper"></i> '+_gt('group_request_join')+'</button>':'<button class="gh-btn" data-group-join><i class="fas fa-user-plus"></i> '+_gt('group_join')+'</button>')):'<button class="gh-btn ghost" data-group-leave><i class="fas fa-sign-out-alt"></i> '+_gt('group_leave')+'</button>';
    var adminBtn=isAdmin?'<button class="gh-btn ghost sm" data-group-admin-panel><i class="fas fa-cog"></i> '+_gt('group_manage')+'</button>':'';
    var coverUpBtn=isAdmin?'<button class="gh-btn ghost sm gr-cover-upload-btn" data-group-cover-upload title="Change cover"><i class="fas fa-camera"></i></button>':'';
    $('#ghGroupDetail').innerHTML=
      '<section class="gh-card gr-group-hero" style="padding:0;overflow:hidden">'+
        '<div class="gh-page-cover gr-cover-wrap">'+(cover?img(cover,title):'<div class="gr-cover-placeholder"><i class="fas fa-users"></i></div>')+coverUpBtn+'</div>'+
        '<div class="gh-page-info">'+
          '<div class="gh-page-logo"><i class="fas fa-users"></i></div>'+
          '<div class="gh-page-title"><h1>'+esc(title)+'</h1><p>'+grPrivacyIcon(privacy)+' '+esc(privacy)+' · '+Number(g.memberCount||0)+' '+_gpdt('grp_members_lbl')+' · '+esc(g.category||'general')+(g.city?' &nbsp;·&nbsp; <i class="fas fa-map-marker-alt" style="color:#3b82f6;font-size:.8em"></i> '+esc(g.city):'')+'</p></div>'+
          '<div class="gh-page-actions">'+joinBtn+' '+adminBtn+
            ' <button class="gh-btn ghost sm gr-mute-btn" data-group-mute title="'+(isMuted?_gpdt('grp_unmute'):_gpdt('grp_mute'))+'"><i class="fas fa-'+(isMuted?'bell-slash':'bell')+'"></i></button>'+
            ' <button class="gh-btn ghost sm" data-share-group><i class="fas fa-share"></i></button>'+
          '</div>'+
        '</div>'+
        '<div class="gh-tabbar">'+
          '<button class="gh-tab active" data-group-detail-tab="discussion">'+_gt('group_discussion')+'</button>'+
          '<button class="gh-tab" data-group-detail-tab="about">'+_gt('profile_about')+'</button>'+
          '<button class="gh-tab" data-group-detail-tab="members">'+_gt('group_members')+'</button>'+
          '<button class="gh-tab" data-group-detail-tab="events">'+_gt('nav_events')+'</button>'+
          '<button class="gh-tab" data-group-detail-tab="files">'+_gt('group_files')+'</button>'+
          '<button class="gh-tab" data-group-detail-tab="chat">'+_gt('group_chat')+'</button>'+
          '<button class="gh-tab" data-group-detail-tab="media">'+_gt('group_media')+'</button>'+
          (isAdmin?'<button class="gh-tab" data-group-detail-tab="admin">'+_gt('group_admin')+'</button>':'')+
        '</div>'+
      '</section><div id="ghGroupTabContent"></div>';
    $('#ghGroupDetail').onclick=function(e){
      var tab=e.target.closest('[data-group-detail-tab]'); if(tab){ state.currentGroupTab=tab.dataset.groupDetailTab; $all('[data-group-detail-tab]').forEach(function(x){x.classList.toggle('active',x===tab);}); renderGroupTab(g); return; }
      if(e.target.closest('[data-group-join]')){ if(!requireLogin())return; GS().toggleGroupMember(g.id,title,function(){GS().getGroupMemberRole(g.id,function(r){state.currentGroupRole=r;}); paintGroupDetail(g);}); return; }
      if(e.target.closest('[data-group-join-request]')){ if(!requireLogin())return; openGroupJoinRequestModal(g); return; }
      if(e.target.closest('[data-group-cancel-request]')){ if(!requireLogin())return; GS().requestJoinGroup(g.id,function(){ state.currentGroupJoinRequested=false; paintGroupDetail(g); }); return; }
      if(e.target.closest('[data-group-leave]')){ var _glt=typeof GHt==='function'?GHt:function(k){return k;}; if(!confirm(_glt('grp_leave_confirm')))return; GS().leaveGroup(g.id,function(ok){if(ok){state.currentGroupRole=null;paintGroupDetail(g);}}); return; }
      if(e.target.closest('[data-group-mute]')){ if(!requireLogin())return; var newMuted=!state.currentGroupMuted; GS().setGroupMute(g.id,newMuted,function(ok){if(ok){state.currentGroupMuted=newMuted;paintGroupDetail(g);}}); return; }
      if(e.target.closest('[data-group-admin-panel]')){ state.currentGroupTab='admin'; $all('[data-group-detail-tab]').forEach(function(x){x.classList.toggle('active',x.dataset.groupDetailTab==='admin');}); renderGroupTab(g); return; }
      if(e.target.closest('[data-group-cover-upload]')){ openGroupCoverUpload(g); return; }
      if(e.target.closest('[data-share-group]')){ var _sgt=typeof GHt==='function'?GHt:function(k){return k;}; var shareUrl=location.origin+'/groups.html?id='+encodeURIComponent(g.id); if(navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(function(){toast(_sgt('grp_link_copied'));}); return; }
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
    var _jrt=typeof GHt==='function'?GHt:function(k){return k;};
    var rulesHtml=rules.length?'<div class="gr-rules-box"><h4><i class="fas fa-gavel"></i> '+_jrt('grp_rules')+'</h4>'+rules.map(function(r,i){return '<div class="gr-rule-item"><strong>'+(i+1)+'. '+esc(r.title||'')+'</strong><p>'+esc(r.description||'')+'</p></div>';}).join('')+'<label class="gr-rule-ack"><input type="checkbox" id="ghRulesAck"> '+_jrt('grp_rules_ack')+'</label></div>':'';
    var questionsHtml=questions.length?'<div style="margin-top:12px"><h4><i class="fas fa-question-circle"></i> '+_jrt('grp_questions')+'</h4>'+questions.map(function(q,i){return '<div style="margin-bottom:10px"><label class="gh-muted" style="font-size:.85rem;display:block;margin-bottom:4px">'+(i+1)+'. '+esc(q.question||q)+'</label><textarea class="gh-textarea" id="ghJoinQ'+i+'" rows="2" placeholder="'+_jrt('grp_answer_ph')+'"></textarea></div>';}).join('')+'</div>':'';
    var body=(rulesHtml||questionsHtml)?rulesHtml+questionsHtml:'<p class="gh-muted">'+_jrt('grp_join_msg')+'</p>';
    modal(_jrt('group_request_join')+' '+esc(g.name||'Group'), body, '<button class="gh-btn ghost" data-close-modal>'+_jrt('cancel')+'</button><button class="gh-btn" id="ghSubmitJoinRequest">'+_jrt('grp_send_request')+'</button>', 'ghJoinRequestModal');
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
    var _u=GS().listenGroupFiles(g.id,function(items){var list=$('#ghGroupFilesList');if(!list)return;if(!items.length){list.innerHTML='<div class="gh-empty" style="min-height:80px"><i class="fas fa-folder-open"></i><h3>No files yet</h3></div>';return;}list.innerHTML=items.map(function(f){var canDelete=isAdmin||(f.uploaderId===myUid);return '<div class="gr-file-card"><div class="gr-file-icon"><i class="fas fa-file'+(f.type&&f.type.startsWith('image')?'-image':(f.type&&f.type.includes('pdf')?'-pdf':''))+'"></i></div><div class="gr-file-body"><strong>'+esc(f.name||'File')+'</strong><span class="gh-muted" style="font-size:.8rem">'+esc(grFormatBytes(f.size))+(f.uploaderName?' · '+esc(f.uploaderName):'')+' · '+grTimeAgo(f.createdAt)+'</span></div><div class="gr-file-actions"><a class="gh-btn sm" href="'+esc(f.url||'#')+'" target="_blank" rel="noopener"><i class="fas fa-download"></i></a>'+(canDelete?'<button class="gh-btn sm ghost danger" data-delete-file="'+esc(f.id)+'"><i class="fas fa-trash"></i></button>':'')+'</div></div>';}).join('');list.querySelectorAll('[data-delete-file]').forEach(function(btn){btn.onclick=function(){var fid=btn.dataset.deleteFile;window.ghConfirm(typeof GHt==='function'?GHt('file_delete_cfm'):'Delete this file?',function(){GS().deleteGroupFile(g.id,fid,function(){});});};});});
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
        if((ta&&ta.value.trim())||pickedFile){
          e.stopPropagation(); e.preventDefault();
          window.ghConfirm(typeof GHt==='function'?GHt('discard_post_cfm'):'Discard your post?', function(){ m.remove(); });
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
  var NP_FILTERS = (function(){
    var _g=typeof GHt==='function'?GHt:function(k){return k;};
    return [
      { key: 'all',     label: _g('notif_all') },
      { key: 'like',    label: _g('notif_likes') },
      { key: 'comment', label: _g('notif_comments') },
      { key: 'reply',   label: _g('notif_replies') },
      { key: 'follow',  label: _g('notif_follows'), types: ['follow', 'business_follow'] },
      { key: 'message', label: _g('nav_messages') },
      { key: 'story',   label: _g('notif_stories'),  types: ['story_reply', 'story_reaction'] },
      { key: 'reward',  label: _g('notif_rewards'),  types: ['reward', 'badge', 'challenge', 'points_received', 'coupon_redeemed'] }
    ];
  })();

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
    var _nt=typeof GHt==='function'?GHt:function(k){return k;};
    if (!ms) return _nt('notif_older');
    var now = Date.now(), diff = now - ms;
    var today = new Date(); today.setHours(0,0,0,0);
    var itemDate = new Date(ms); itemDate.setHours(0,0,0,0);
    if (itemDate.getTime() === today.getTime()) return _nt('notif_today');
    if (today.getTime() - itemDate.getTime() === 86400000) return _nt('notif_yesterday');
    if (diff < 7 * 86400000) return 'This week';
    return _nt('notif_older');
  }

  /* ── Phase 65: Notification Preferences + DND + Web Push ── */
  var _NOTIF_CATS=[
    {key:'reactions',label:'Reactions',icon:'fas fa-heart',default:true},
    {key:'comments',label:'Comments',icon:'fas fa-comment',default:true},
    {key:'follows',label:'Follows',icon:'fas fa-user-plus',default:true},
    {key:'mentions',label:'Mentions',icon:'fas fa-at',default:true},
    {key:'messages',label:'Messages',icon:'fas fa-comment-dots',default:true},
    {key:'events',label:'Events',icon:'fas fa-calendar',default:true},
    {key:'insights',label:'Post Insights',icon:'fas fa-chart-bar',default:false},
    {key:'reposts',label:'Reposts',icon:'fas fa-retweet',default:true}
  ];
  function _getNotifPrefs(){
    try{ var s=localStorage.getItem('gh_notif_prefs'); return s?JSON.parse(s):null; }catch(e){ return null; }
  }
  function _setNotifPrefs(prefs){
    try{ localStorage.setItem('gh_notif_prefs',JSON.stringify(prefs)); }catch(e){}
  }
  function _isNotifEnabled(type){
    var prefs=_getNotifPrefs(); if(!prefs) return true; // default all on
    if(prefs.dnd) return false;
    var cat=_NOTIF_CATS.find(function(c){ return c.key===type||type.indexOf(c.key)>-1; });
    if(!cat) return true;
    return prefs[cat.key]!==false;
  }
  function _openNotifSettings(){
    var prefs=_getNotifPrefs()||{};
    var dnd=!!prefs.dnd;
    var pushEnabled='Notification' in window && Notification.permission==='granted';
    var body='<div class="gh-notif-prefs">'+
      '<div class="gh-np-row gh-np-dnd">'+
        '<div><strong><i class="fas fa-moon"></i> Do Not Disturb</strong><div class="gh-muted" style="font-size:.78rem">Silence all alerts temporarily</div></div>'+
        '<label class="gh-toggle"><input type="checkbox" id="ghDndToggle"'+(dnd?' checked':'')+"><span></span></label>"+
      '</div>'+
      '<hr style="border-color:var(--gh-border);margin:10px 0">'+
      '<div class="gh-np-row">'+
        '<div><strong><i class="fas fa-bell"></i> Browser Push Notifications</strong><div class="gh-muted" style="font-size:.78rem">'+(pushEnabled?'Enabled':'Click to enable')+'</div></div>'+
        '<button class="gh-btn sm ghost" id="ghEnablePush">'+(pushEnabled?'<i class="fas fa-check"></i> Enabled':'Enable')+'</button>'+
      '</div>'+
      '<hr style="border-color:var(--gh-border);margin:10px 0">'+
      '<div style="font-weight:700;font-size:.85rem;margin-bottom:8px">Notification Categories</div>'+
      _NOTIF_CATS.map(function(cat){
        var on=prefs[cat.key]!==false;
        return '<div class="gh-np-row">'+
          '<div><i class="'+cat.icon+'" style="width:16px;text-align:center;margin-right:6px"></i>'+cat.label+'</div>'+
          '<label class="gh-toggle"><input type="checkbox" data-nc="'+cat.key+'"'+(on?' checked':'')+"><span></span></label>"+
        '</div>';
      }).join('')+
    '</div>';
    modal('Notification Settings',body,'<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSaveNotifPrefs">Save</button>','ghNotifPrefsModal');
    // Web Push
    var pushBtn=document.getElementById('ghEnablePush');
    if(pushBtn&&!pushEnabled&&'Notification' in window){
      pushBtn.onclick=function(){
        Notification.requestPermission().then(function(perm){
          if(perm==='granted'){ pushBtn.innerHTML='<i class="fas fa-check"></i> Enabled'; toast('Push notifications enabled!'); }
          else toast('Permission denied','error');
        });
      };
    }
    // Save prefs
    var saveBtn=document.getElementById('ghSaveNotifPrefs');
    if(saveBtn){
      saveBtn.onclick=function(){
        var newPrefs={dnd:(document.getElementById('ghDndToggle')||{}).checked||false};
        document.querySelectorAll('[data-nc]').forEach(function(inp){ newPrefs[inp.dataset.nc]=inp.checked; });
        _setNotifPrefs(newPrefs);
        toast('Preferences saved');
        var m=document.getElementById('ghNotifPrefsModal'); if(m) m.remove();
      };
    }
  }
  window.ghOpenNotifSettings=_openNotifSettings;

  function renderNotifications() {
    var pageActor = notificationActor();
    var _nt=typeof GHt==='function'?GHt:function(k){return k;};
    var pageTitle = pageActor.type === 'business' ? esc(pageActor.title + ' Activity') : _nt('nav_notifications');
    var pageSub = pageActor.type === 'business' ? 'Using GeoHub as '+pageActor.title : '';
    shell({ active: 'notifications', right: '', center:
      '<div class="np-page">' +
        '<div class="np-head">' +
          '<div><h2 id="npTitle"><i class="fas fa-bell"></i> '+pageTitle+'</h2><p class="np-context" id="npContext"'+(pageSub?'':' style="display:none"')+'>'+esc(pageSub)+'</p></div>' +
          '<div style="display:flex;gap:8px"><button class="np-mark-all gh-btn ghost" id="npMarkAll"><i class="fas fa-check-double"></i> '+_nt('notif_mark_all')+'</button><button class="gh-btn ghost" onclick="if(window.ghOpenNotifSettings)ghOpenNotifSettings()" title="Notification settings"><i class="fas fa-gear"></i></button></div>' +
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

  /* ── Phase 61: Advanced Search Page ────────────────────── */
  /* ── Phase 67: Marketplace Lite ─────────────────────────── */
  var _MKT_CATS=['All','Electronics','Clothing','Furniture','Vehicles','Books','Sports','Food','Services','Other'];
  function renderMarketplace(){
    var _mt=typeof GHt==='function'?GHt:function(k){return k;};
    shell({ active:'marketplace',
      center:
        '<div class="gh-card" style="padding:16px 16px 10px">'+
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">'+
            '<h2 style="margin:0;font-size:1.05rem" data-i18n="nav_marketplace"><i class="fas fa-store"></i> Marketplace</h2>'+
            '<button class="gh-btn" id="ghSellBtn"><i class="fas fa-plus"></i> '+_mt('mkt_sell')+'</button>'+
          '</div>'+
          '<div class="gh-top-search" style="max-width:100%;margin-bottom:10px"><i class="fas fa-search"></i><input id="ghMktSearch" data-i18n-placeholder="search" placeholder="Search listings…" autocomplete="off"></div>'+
          '<div class="gh-pill-row" id="ghMktCats" style="flex-wrap:wrap">'+
            (function(){var _ml={'All':_mt('mkt_cat_all'),'Electronics':_mt('mkt_cat_electronics'),'Clothing':_mt('mkt_cat_clothing'),'Furniture':_mt('mkt_cat_furniture'),'Vehicles':_mt('mkt_cat_vehicles'),'Books':_mt('mkt_cat_books'),'Sports':_mt('mkt_cat_sports'),'Food':_mt('mkt_cat_food'),'Services':_mt('mkt_cat_services'),'Other':_mt('mkt_cat_other')};return _MKT_CATS.map(function(c,i){return '<button class="gh-pill'+(i===0?' active':'')+'" data-mkt-cat="'+esc(i===0?'':c)+'">'+esc(_ml[c]||c)+'</button>';}).join('');})() +
          '</div>'+
        '</div>'+
        '<div id="ghMktList"><div class="gh-card gh-empty" style="min-height:120px"><i class="fas fa-circle-notch fa-spin"></i></div></div>'
    });
    ready(function(){
      var _cat='', _q='', _items=[], _timer=null;
      var sellBtn=document.getElementById('ghSellBtn');
      if(sellBtn) sellBtn.onclick=function(){ if(!requireLogin()) return; _openSellModal(); };
      var cats=document.getElementById('ghMktCats');
      if(cats) cats.addEventListener('click',function(e){ var b=e.target.closest('[data-mkt-cat]'); if(!b) return; _cat=b.dataset.mktCat||''; cats.querySelectorAll('.gh-pill').forEach(function(p){ p.classList.toggle('active',p===b); }); _loadMkt(); });
      var srch=document.getElementById('ghMktSearch');
      if(srch) srch.oninput=function(){ clearTimeout(_timer); _q=this.value.trim(); _timer=setTimeout(_loadMkt,350); };
      function _loadMkt(){
        var box=document.getElementById('ghMktList'); if(!box) return;
        var _mlt=typeof GHt==='function'?GHt:function(k){return k;};
        if(!fs()||!db()){ box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>'+_mlt('rw_unavailable')+'</h3></div>'; return; }
        box.innerHTML='<div class="gh-card gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div>';
        var constraints=[fs().where('status','==','active')];
        if(_cat) constraints.push(fs().where('category','==',_cat));
        var q=fs().query.apply(null,[fs().collection(db(),'marketplace')].concat(constraints).concat([fs().orderBy('createdAt','desc'),fs().limit(24)]));
        fs().getDocs(q).then(function(snap){
          var items=[]; snap.forEach(function(d){ items.push(Object.assign({id:d.id},d.data())); });
          if(_q) items=items.filter(function(x){ return (x.title||x.name||'').toLowerCase().indexOf(_q.toLowerCase())>-1; });
          if(!items.length){ box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-store"></i><h3>'+_mlt('mkt_no_listings')+'</h3><p>'+_mlt('mkt_no_hint')+'</p></div>'; return; }
          box.innerHTML='<div class="gh-mkt-grid">'+items.map(function(x){
            var _mct=typeof GHt==='function'?GHt:function(k){return k;}; var title=x.title||x.name||'Item'; var price=x.price?Number(x.price).toLocaleString()+' ₾':_mct('mkt_free');
            var img2=x.imageUrl||x.photos&&x.photos[0]||'';
            var sold=x.sold||x.status==='sold';
            return '<div class="gh-mkt-card'+(sold?' sold':'')+'" data-mkt-id="'+esc(x.id)+'">'+
              (img2?'<div class="gh-mkt-img"><img src="'+esc(img2)+'" alt="'+esc(title)+'" loading="lazy">'+(sold?'<div class="gh-mkt-sold-badge">SOLD</div>':'')+'</div>':'<div class="gh-mkt-img-ph"><i class="fas fa-box-open"></i></div>')+
              '<div class="gh-mkt-body">'+
                '<div class="gh-mkt-price">'+esc(price)+'</div>'+
                '<div class="gh-mkt-title">'+esc(title)+'</div>'+
                (x.city?'<div class="gh-mkt-loc"><i class="fas fa-location-dot"></i> '+esc(x.city)+'</div>':'')+
                '<div class="gh-mkt-actions">'+
                  (!sold?'<button class="gh-btn sm" data-mkt-contact="'+esc(x.sellerId||x.authorId||x.userId||'')+'" data-mkt-title="'+esc(title)+'"><i class="fas fa-comment-dots"></i> '+(typeof GHt==='function'?GHt('mkt_contact'):'Contact')+'</button>':'<span class="gh-chip">'+(typeof GHt==='function'?GHt('mkt_sold'):'Sold')+'</span>')+
                  '<button class="gh-btn sm ghost" data-mkt-save="'+esc(x.id)+'"><i class="fas fa-bookmark"></i></button>'+
                '</div>'+
              '</div>'+
            '</div>';
          }).join('')+'</div>';
          // Bind contact buttons
          box.querySelectorAll('[data-mkt-contact]').forEach(function(btn){
            btn.addEventListener('click',function(){ if(!requireLogin()) return; var sid=btn.dataset.mktContact; if(sid) location.href='messages.html?with='+encodeURIComponent(sid)+'&ref=marketplace&item='+encodeURIComponent(btn.dataset.mktTitle||''); });
          });
        }).catch(function(err){ box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>'+_mlt('mkt_load_fail')+'</h3><p>'+esc(err.message||'')+'</p></div>'; });
      }
      _loadMkt();
    });
  }
  function _openSellModal(){
    var body=
      '<div class="gh-upload-progress" id="ghMktUploadBar" style="display:none"><div class="gh-upload-track"><div class="gh-upload-bar" id="ghMktUploadFill"></div></div><span id="ghMktUploadPct">0%</span></div>'+
      '<div id="ghMktImgPreview" style="margin-bottom:10px"></div>'+
      '<input class="gh-input" id="ghMktTitle" placeholder="'+(typeof GHt==='function'?GHt('mkt_title_ph'):'Item title *')+'" maxlength="80" style="margin-bottom:8px">'+
      '<div style="display:flex;gap:8px;margin-bottom:8px">'+
        '<input class="gh-input" id="ghMktPrice" type="number" min="0" placeholder="'+(typeof GHt==='function'?GHt('mkt_price_ph'):'Price (₾, 0=free)')+'" style="flex:1">'+
        '<select class="gh-select" id="ghMktCat" style="flex:1">'+
          _MKT_CATS.filter(function(c){ return c!=='All'; }).map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('')+
        '</select>'+
      '</div>'+
      '<textarea class="gh-textarea" id="ghMktDesc" placeholder="'+(typeof GHt==='function'?GHt('mkt_desc_ph'):'Description (optional)')+'" rows="3" style="margin-bottom:8px"></textarea>'+
      '<input class="gh-input" id="ghMktCity" placeholder="'+(typeof GHt==='function'?GHt('mkt_city_ph'):'City / Location (optional)')+'" style="margin-bottom:8px">'+
      '<input type="file" id="ghMktFilePick" accept="image/*" style="display:none">'+
      '<button type="button" class="gh-btn ghost" id="ghMktPhotoBtn"><i class="fas fa-image"></i> '+(typeof GHt==='function'?GHt('mkt_add_photo'):'Add Photo')+'</button>';
    modal((typeof GHt==='function'?GHt('mkt_sell_modal'):'Sell an Item'),body,'<button class="gh-btn ghost" data-close-modal>'+(typeof GHt==='function'?GHt('cancel'):'Cancel')+'</button><button class="gh-btn" id="ghMktSubmitBtn">'+(typeof GHt==='function'?GHt('mkt_list_item'):'List Item')+'</button>','ghSellModal');
    var mktModal=document.getElementById('ghSellModal');
    if(!mktModal) return;
    var pickedMktFile=null;
    mktModal.querySelector('#ghMktPhotoBtn').onclick=function(){ mktModal.querySelector('#ghMktFilePick').click(); };
    mktModal.querySelector('#ghMktFilePick').onchange=function(){
      var file=this.files&&this.files[0]; if(!file) return;
      pickedMktFile=file;
      var prev=document.getElementById('ghMktImgPreview');
      if(prev) prev.innerHTML='<img src="'+esc(URL.createObjectURL(file))+'" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px">';
    };
    var sbtn=document.getElementById('ghMktSubmitBtn');
    if(sbtn) sbtn.onclick=function(){
      var title=(document.getElementById('ghMktTitle').value||'').trim();
      var _mst=typeof GHt==='function'?GHt:function(k){return k;};
      if(!title) return toast(_mst('mkt_enter_title'),'error');
      sbtn.disabled=true; sbtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>';
      var u=authUser(); if(!u){ sbtn.disabled=false; return toast(_mst('sign_in'),'error'); }
      prepareMedia(pickedMktFile||null,'marketplace',function(pct){
        var fill=document.getElementById('ghMktUploadFill'); if(fill) fill.style.width=pct+'%';
        var bar=document.getElementById('ghMktUploadBar'); if(bar) bar.style.display='flex';
      }).then(function(imgUrl){
        return fs().addDoc(fs().collection(db(),'marketplace'),{
          title:title,
          price:Number((document.getElementById('ghMktPrice').value)||0)||0,
          category:(document.getElementById('ghMktCat').value)||'Other',
          description:(document.getElementById('ghMktDesc').value||'').trim(),
          city:(document.getElementById('ghMktCity').value||'').trim(),
          imageUrl:imgUrl||'',
          status:'active', sold:false,
          sellerId:u.uid,
          authorId:u.uid,
          createdAt:fs().serverTimestamp()
        });
      }).then(function(){
        var _mft=typeof GHt==='function'?GHt:function(k){return k;};
        toast(_mft('mkt_listed'));
        if(mktModal) mktModal.remove();
      }).catch(function(err){ var _mft=typeof GHt==='function'?GHt:function(k){return k;}; toast('Failed: '+(err.message||err.code),'error'); sbtn.disabled=false; sbtn.innerHTML=_mft('mkt_list_item'); });
    };
  }

  function renderSearch(){
    var _st=typeof GHt==='function'?GHt:function(k){return k;};
    var _qParam=new URLSearchParams(location.search).get('q')||'';
    shell({ active:'search',
      center:
        '<div class="gh-card" style="padding:16px 16px 8px">'+
          '<h2 style="margin:0 0 12px;font-size:1.05rem"><i class="fas fa-search"></i> '+_st('srch_title')+'</h2>'+
          '<div class="gh-top-search" style="max-width:100%;margin-bottom:10px"><i class="fas fa-search"></i><input id="ghSearchMain" placeholder="'+_st('search_placeholder')+'" value="'+esc(_qParam)+'" autocomplete="off"></div>'+
          '<div class="gh-pill-row" id="ghSearchTabs">'+
            '<button class="gh-pill active" data-stab="all">'+_st('notif_all')+'</button>'+
            '<button class="gh-pill" data-stab="people"><i class="fas fa-user"></i> '+_st('srch_people')+'</button>'+
            '<button class="gh-pill" data-stab="posts"><i class="fas fa-newspaper"></i> '+_st('profile_posts')+'</button>'+
            '<button class="gh-pill" data-stab="businesses"><i class="fas fa-store"></i> '+_st('nav_business')+'</button>'+
            '<button class="gh-pill" data-stab="groups"><i class="fas fa-users"></i> '+_st('nav_groups')+'</button>'+
            '<button class="gh-pill" data-stab="events"><i class="fas fa-calendar"></i> '+_st('nav_events')+'</button>'+
          '</div>'+
        '</div>'+
        '<div id="ghSearchResults"><div class="gh-card gh-empty" style="min-height:180px"><i class="fas fa-search"></i><h3>'+_st('srch_type_to_search')+'</h3><p>'+_st('search_placeholder')+'</p></div></div>'
    });
    ready(function(){
      var inp=document.getElementById('ghSearchMain');
      var res=document.getElementById('ghSearchResults');
      var tabs=document.getElementById('ghSearchTabs');
      if(!inp||!res||!tabs) return;
      var _tab='all', _q='', _timer=null;
      // Reflect initial query
      if(_qParam){ _q=_qParam; _doSearch(); }
      inp.oninput=function(){ clearTimeout(_timer); _q=this.value.trim(); _timer=setTimeout(_doSearch,350); };
      inp.onkeydown=function(e){ if(e.key==='Enter'){ clearTimeout(_timer); _q=this.value.trim(); _doSearch(); } };
      tabs.addEventListener('click',function(e){ var b=e.target.closest('[data-stab]'); if(!b) return; _tab=b.dataset.stab; tabs.querySelectorAll('.gh-pill').forEach(function(p){ p.classList.toggle('active',p===b); }); _doSearch(); });
      function _doSearch(){
        if(!_q){ res.innerHTML='<div class="gh-card gh-empty" style="min-height:180px"><i class="fas fa-search"></i><h3>'+(typeof GHt==='function'?GHt('srch_type_to_search'):'Type to search')+'</h3></div>'; return; }
        res.innerHTML='<div class="gh-card gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div>';
        history.replaceState(null,'',location.pathname+'?q='+encodeURIComponent(_q));
        var ps=[];
        if((_tab==='all'||_tab==='people')&&fs()&&db()){
          ps.push(fs().getDocs(fs().query(fs().collection(db(),'users'),fs().orderBy('fullName'),fs().startAt(_q),fs().endAt(_q+''),fs().limit(8))).then(function(s){ var a=[]; s.forEach(function(d){ a.push(Object.assign({_type:'user',id:d.id},d.data())); }); return a; }).catch(function(){ return []; }));
        } else ps.push(Promise.resolve([]));
        if((_tab==='all'||_tab==='posts')&&fs()&&db()){
          ps.push(fs().getDocs(fs().query(fs().collection(db(),'posts'),fs().where('status','!=','deleted'),fs().orderBy('createdAt','desc'),fs().limit(12))).then(function(s){ var a=[]; s.forEach(function(d){ var p=d.data(); if(p.text&&p.text.toLowerCase().indexOf(_q.toLowerCase())>-1) a.push(Object.assign({_type:'post',id:d.id},p)); }); return a; }).catch(function(){ return []; }));
        } else ps.push(Promise.resolve([]));
        if((_tab==='all'||_tab==='businesses')&&fs()&&db()){
          ps.push(fs().getDocs(fs().query(fs().collection(db(),'businesses'),fs().orderBy('title'),fs().startAt(_q),fs().endAt(_q+''),fs().limit(6))).then(function(s){ var a=[]; s.forEach(function(d){ a.push(Object.assign({_type:'business',id:d.id},d.data())); }); return a; }).catch(function(){ return []; }));
        } else ps.push(Promise.resolve([]));
        if((_tab==='all'||_tab==='groups')&&fs()&&db()){
          ps.push(fs().getDocs(fs().query(fs().collection(db(),'groups'),fs().orderBy('name'),fs().startAt(_q),fs().endAt(_q+''),fs().limit(6))).then(function(s){ var a=[]; s.forEach(function(d){ a.push(Object.assign({_type:'group',id:d.id},d.data())); }); return a; }).catch(function(){ return []; }));
        } else ps.push(Promise.resolve([]));
        if((_tab==='all'||_tab==='events')&&fs()&&db()){
          ps.push(fs().getDocs(fs().query(fs().collection(db(),'events'),fs().orderBy('name'),fs().startAt(_q),fs().endAt(_q+''),fs().limit(6))).then(function(s){ var a=[]; s.forEach(function(d){ a.push(Object.assign({_type:'event',id:d.id},d.data())); }); return a; }).catch(function(){ return []; }));
        } else ps.push(Promise.resolve([]));
        Promise.all(ps).then(function(results){
          var _srMeUid=(authUser()||{}).uid;
          var users=results[0]||[], posts=results[1]||[], bizs=results[2]||[], groups=results[3]||[], events=results[4]||[];
          // private account filter
          users=users.filter(function(u){
            if(!u.isPrivate) return true;
            if(_srMeUid && (u.id===_srMeUid||u.uid===_srMeUid)) return true;
            var _gid=u.geoId&&String(u.geoId);
            if(_q===u.id||_q===u.uid||(_gid&&_q===_gid)) return true;
            return state.friendIds.indexOf(u.id||u.uid)>-1||state.followingIds.indexOf(u.id||u.uid)>-1;
          });
          var all=[]; if(_tab==='all'){ all=users.concat(posts).concat(bizs).concat(groups).concat(events); } else if(_tab==='people') all=users; else if(_tab==='posts') all=posts; else if(_tab==='businesses') all=bizs; else if(_tab==='groups') all=groups; else if(_tab==='events') all=events;
          if(!all.length){ res.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-search"></i><h3>No results for "'+esc(_q)+'"</h3><p>Try different keywords or broaden your search.</p></div>'; return; }
          var html='<div class="gh-search-results-list">';
          all.forEach(function(x){
            if(x._type==='user'){
              var uname=x.fullName||x.displayName||x.name||'User'; var uav=x.avatar||x.photoURL||''; var ufc=x.followerCount||0;
              var _isKnown=state.friendIds.indexOf(x.id||x.uid)>-1||state.followingIds.indexOf(x.id||x.uid)>-1;
              var _privBadge=x.isPrivate?'<i class="fas fa-lock" style="font-size:.65rem;opacity:.55;margin-left:4px" title="Private account"></i>':'';
              // name: სახელი/გვარი ჩანს მხოლოდ მეგობრებისთვის (showFullName პარამ), სხვებს username
              var _dispName = uname;
              if(x.isPrivate && !_isKnown && (x.privacy&&x.privacy.showFullName)!=='everyone') _dispName='@'+(x.username||x.id||'user');
              var _srFollowing=state.followingIds.indexOf(x.id||x.uid)>-1;
              var _srFriend=state.friendIds.indexOf(x.id||x.uid)>-1;
              var _srFollowLabel=_srFollowing?'<i class="fas fa-user-check"></i> Following':'<i class="fas fa-rss"></i> Follow';
              var _srFollowCls='gh-btn sm'+(_srFollowing?' ghost':'');
              html+='<div class="gh-sr-item"><a href="profile.html?id='+esc(x.id||'')+'" class="gh-sr-main"><span class="gh-avatar" style="width:40px;height:40px">'+(uav?'<img src="'+esc(uav)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':esc(initials(_dispName)))+'</span><div class="gh-sr-info"><strong>'+esc(_dispName)+_privBadge+'</strong><span>'+esc(x.city||x.tagline||'GeoHub User')+(ufc&&_isKnown?' · '+_fmtCount(ufc)+' followers':'')+'</span></div></a><button class="'+_srFollowCls+'" data-follow-user="'+esc(x.id||'')+'" data-following="'+(_srFollowing?'1':'0')+'">'+_srFollowLabel+'</button></div>';
            } else if(x._type==='post'){
              var pname=x.authorName||'User'; var ptxt=(x.text||'').slice(0,100);
              html+='<div class="gh-sr-item"><div class="gh-sr-main" style="cursor:pointer" onclick="location.href=\'feed.html#post-'+esc(x.id)+'\'"><span class="gh-sr-icon"><i class="fas fa-newspaper"></i></span><div class="gh-sr-info"><strong>'+esc(pname)+'</strong><span>'+esc(ptxt)+'</span></div></div></div>';
            } else if(x._type==='business'){
              var btitle=x.title||x.name||'Business'; var bcat=x.category||'';
              html+='<div class="gh-sr-item"><a href="business.html?id='+esc(x.id||'')+'" class="gh-sr-main"><span class="gh-avatar" style="width:40px;height:40px;border-radius:10px">'+(x.logoUrl?'<img src="'+esc(x.logoUrl)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">':'<i class="fas fa-store"></i>')+'</span><div class="gh-sr-info"><strong>'+esc(btitle)+'</strong><span>'+esc(bcat||'Business')+'</span></div></a><a class="gh-btn sm ghost" href="business.html?id='+esc(x.id||'')+'">View</a></div>';
            } else if(x._type==='group'){
              var gname=x.name||'Group'; var gmc=x.memberCount||0;
              html+='<div class="gh-sr-item"><a href="groups.html?id='+esc(x.id||'')+'" class="gh-sr-main"><span class="gh-sr-icon"><i class="fas fa-users"></i></span><div class="gh-sr-info"><strong>'+esc(gname)+'</strong><span>'+esc(x.privacy||'Public')+' · '+gmc+' members</span></div></a><a class="gh-btn sm ghost" href="groups.html?id='+esc(x.id||'')+'">Join</a></div>';
            } else if(x._type==='event'){
              var ename=x.name||x.title||'Event';
              html+='<div class="gh-sr-item"><a href="events.html?id='+esc(x.id||'')+'" class="gh-sr-main"><span class="gh-sr-icon"><i class="fas fa-calendar"></i></span><div class="gh-sr-info"><strong>'+esc(ename)+'</strong><span>'+esc(x.location||x.category||'Event')+'</span></div></a><a class="gh-btn sm ghost" href="events.html?id='+esc(x.id||'')+'">View</a></div>';
            }
          });
          html+='</div>';
          res.innerHTML=html;
          // Bind follow buttons
          res.querySelectorAll('[data-follow-user]').forEach(function(btn){
            btn.addEventListener('click',function(e){ e.preventDefault(); if(!requireLogin()) return; var uid2=btn.dataset.followUser; if(GS().toggleFollow) GS().toggleFollow(uid2,function(isNowFollowing){ btn.dataset.following=isNowFollowing?'1':'0'; btn.innerHTML=isNowFollowing?'<i class="fas fa-user-check"></i> Following':'<i class="fas fa-rss"></i> Follow'; btn.classList.toggle('ghost',!!isNowFollowing); }); });
          });
        }).catch(function(){ res.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>'+(typeof GHt==='function'?GHt('search_failed'):'Search failed — try again.')+'</h3></div>'; });
      }
    });
  }

  function renderComingSoon(){
    var _ct=typeof GHt==='function'?GHt:function(k){return k;};
    var title = (PAGE || PATH.replace('.html','') || 'section').replace(/[-_]/g,' ');
    title = title.charAt(0).toUpperCase() + title.slice(1);
    shell({ active: PAGE, center: '<div class="gh-card gh-empty" style="min-height:360px"><i class="fas fa-tools"></i><h3>'+esc(title)+' — '+_ct('coming_soon')+'</h3><p>This section is not ready yet. No fake demo content is shown.</p><a class="gh-btn" href="feed.html">'+_ct('back_to_feed')+'</a></div>' });
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
    if(PAGE==='marketplace' || PATH==='marketplace.html') return renderMarketplace();
    if(PAGE==='messages' || PATH==='messages.html'){ injectShellNav('messages'); return; }
    if(PAGE==='profile' || PATH==='profile.html'){ injectShellNav('profile'); return; } // profile.js renders profile content
    if(PAGE==='videos'  || PATH==='videos.html')  { injectShellNav('videos');  return; }
    if(PAGE==='watch'   || PATH==='watch.html')   { injectShellNav('watch');   return; }
    if(PAGE==='places'  || PATH==='places.html')  { injectShellNav('places');  return; }
    if(PAGE==='admin-videos' || PATH==='admin-videos.html') { injectShellNav('admin-videos'); return; }
    if(PAGE==='channel'     || PATH==='channel.html')     { injectShellNav('channel');     return; }
    if(PAGE==='events'      || PATH==='events.html')      return renderEvents();
    if(PAGE==='assistant'   || PATH==='assistant.html')   return renderAssistant();
    if(PAGE==='map'         || PATH==='map.html')         return renderMapPage();
    if(PAGE==='reels'       || PATH==='reels.html')       return renderReels();
    if(PAGE==='gamification'|| PATH==='gamification.html')return renderGamification();
    if(PAGE==='admin'       || PATH==='admin.html')       return renderAdmin();
    if(PAGE==='premium'     || PATH==='premium.html')     return renderPremium();
    return renderComingSoon();
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 72 — Events Full Page
  ══════════════════════════════════════════════════════════════ */
  var _EV_CATS=['All','Music','Sports','Art','Food & Drink','Business','Technology','Outdoor','Social','Education'];
  function renderEvents(){
    var _idParam=new URLSearchParams(location.search).get('id');
    if(_idParam) return _renderEventDetail(_idParam);
    shell({ active:'events',
      center:
        '<div class="gh-card" style="padding:16px 16px 10px">'+
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">'+
            '<h2 style="margin:0;font-size:1.05rem"><i class="fas fa-calendar-days"></i> '+(typeof GHt==='function'?GHt('evt_in_georgia'):'Events in Georgia')+'</h2>'+
            '<button class="gh-btn" id="ghCreateEvtBtn"><i class="fas fa-plus"></i> '+(typeof GHt==='function'?GHt('create_event'):'Create Event')+'</button>'+
          '</div>'+
          '<div class="gh-top-search" style="max-width:100%;margin-bottom:10px"><i class="fas fa-search"></i><input id="ghEvtSearch" placeholder="Search events…" autocomplete="off"></div>'+
          '<div class="gh-pill-row" style="flex-wrap:wrap" id="ghEvtCatPills">'+
            _EV_CATS.map(function(c,i){ return '<button class="gh-pill'+(i===0?' active':'')+'" data-evt-cat="'+esc(i===0?'':c)+'">'+esc(c)+'</button>'; }).join('')+
          '</div>'+
        '</div>'+
        '<div class="gh-pill-row" style="padding:0 16px;gap:6px" id="ghEvtTimePills">'+
          '<button class="gh-pill active" data-evt-time="upcoming">'+(typeof GHt==='function'?GHt('evt_upcoming'):'Upcoming')+'</button>'+
          '<button class="gh-pill" data-evt-time="today">'+(typeof GHt==='function'?GHt('evt_today'):'Today')+'</button>'+
          '<button class="gh-pill" data-evt-time="weekend">'+(typeof GHt==='function'?GHt('evt_weekend'):'This weekend')+'</button>'+
          '<button class="gh-pill" data-evt-time="past">'+(typeof GHt==='function'?GHt('evt_past'):'Past')+'</button>'+
        '</div>'+
        '<div style="height:12px"></div>'+
        '<div id="ghEvtList"><div class="gh-card gh-empty" style="min-height:120px"><i class="fas fa-circle-notch fa-spin"></i></div></div>'
    });
    ready(function(){
      var _cat='', _time='upcoming', _q='', _timer=null;
      var catPills=document.getElementById('ghEvtCatPills');
      var timePills=document.getElementById('ghEvtTimePills');
      var srchIn=document.getElementById('ghEvtSearch');
      var createBtn=document.getElementById('ghCreateEvtBtn');
      if(createBtn) createBtn.onclick=function(){ if(!requireLogin()) return; _openCreateEventModal(); };
      if(catPills) catPills.addEventListener('click',function(e){ var b=e.target.closest('[data-evt-cat]'); if(!b) return; _cat=b.dataset.evtCat||''; catPills.querySelectorAll('.gh-pill').forEach(function(p){ p.classList.toggle('active',p===b); }); _loadEvents(); });
      if(timePills) timePills.addEventListener('click',function(e){ var b=e.target.closest('[data-evt-time]'); if(!b) return; _time=b.dataset.evtTime||'upcoming'; timePills.querySelectorAll('.gh-pill').forEach(function(p){ p.classList.toggle('active',p===b); }); _loadEvents(); });
      if(srchIn) srchIn.oninput=function(){ clearTimeout(_timer); _q=this.value.trim(); _timer=setTimeout(_loadEvents,350); };
      function _loadEvents(){
        var box=document.getElementById('ghEvtList'); if(!box) return;
        if(!fs()||!db()){ box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Unavailable</h3></div>'; return; }
        box.innerHTML='<div class="gh-card gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div>';
        var now=new Date();
        var todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());
        var todayEnd=new Date(todayStart.getTime()+86400000);
        var weekendStart=new Date(todayStart);
        weekendStart.setDate(todayStart.getDate()+(6-todayStart.getDay()));
        var weekendEnd=new Date(weekendStart.getTime()+172800000);
        var constraints=[fs().where('status','!=','deleted'),fs().orderBy('status'),fs().orderBy('startDate','asc')];
        if(_cat) constraints.push(fs().where('category','==',_cat));
        var q=fs().query.apply(null,[fs().collection(db(),'events')].concat(constraints).concat([fs().limit(30)]));
        fs().getDocs(q).then(function(snap){
          var items=[]; snap.forEach(function(d){ items.push(Object.assign({id:d.id},d.data())); });
          if(_q) items=items.filter(function(x){ return JSON.stringify(x).toLowerCase().indexOf(_q.toLowerCase())>-1; });
          if(_time==='upcoming') items=items.filter(function(x){ var d=ts(x.startDate); return !d||d>=now.getTime(); });
          else if(_time==='today') items=items.filter(function(x){ var d=ts(x.startDate); return d&&d>=todayStart.getTime()&&d<todayEnd.getTime(); });
          else if(_time==='weekend') items=items.filter(function(x){ var d=ts(x.startDate); return d&&d>=weekendStart.getTime()&&d<weekendEnd.getTime(); });
          else if(_time==='past') items=items.filter(function(x){ var d=ts(x.startDate); return d&&d<now.getTime(); });
          if(!items.length){ var _et=typeof GHt==='function'?GHt:function(k){return k;}; box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-calendar-xmark"></i><h3>'+_et('evt_no_results')+'</h3><p>'+_et('evt_no_results_tip')+'</p></div>'; return; }
          box.innerHTML=items.map(function(ev){
            var name=ev.name||ev.title||'Event';
            var evDate=ev.startDate?new Date(ts(ev.startDate)):null;
            var dateStr=evDate?evDate.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'TBA';
            var img72=ev.coverUrl||ev.imageUrl||ev.thumbnail||'';
            var rsvp=ev.rsvpCount||ev.attendeeCount||0;
            var isPast=evDate&&evDate<now;
            return '<div class="gh-evt-card" data-evt-id="'+esc(ev.id)+'">'+
              (img72?'<div class="gh-evt-cover"><img src="'+esc(img72)+'" alt="'+esc(name)+'" loading="lazy"></div>':'')+
              '<div class="gh-evt-body">'+
                '<div class="gh-evt-date-badge">'+
                  (evDate?'<span class="gh-evt-day">'+evDate.getDate()+'</span><span class="gh-evt-mon">'+evDate.toLocaleString('default',{month:'short'})+'</span>':'<span class="gh-evt-day">?</span><span class="gh-evt-mon">TBA</span>')+
                '</div>'+
                '<div class="gh-evt-info">'+
                  '<div class="gh-evt-name">'+esc(name)+'</div>'+
                  '<div class="gh-evt-meta"><i class="fas fa-clock"></i> '+esc(dateStr)+'</div>'+
                  (ev.location||ev.city?'<div class="gh-evt-meta"><i class="fas fa-map-marker-alt"></i> '+esc(ev.location||ev.city)+'</div>':'')+
                  (rsvp?'<div class="gh-evt-meta"><i class="fas fa-users"></i> '+rsvp+' '+(typeof GHt==='function'?GHt('evt_going_count'):'going')+'</div>':'')+
                  (ev.category?'<span class="gh-chip" style="margin-top:6px">'+esc(ev.category)+'</span>':'')+
                  '<div class="gh-evt-actions">'+
                    '<button class="gh-btn sm" data-evt-view="'+esc(ev.id)+'">'+(typeof GHt==='function'?GHt('evt_view'):'View')+'</button>'+
                    (!isPast?'<button class="gh-btn sm ghost" data-evt-rsvp="'+esc(ev.id)+'" data-evt-name="'+esc(name)+'"><i class="fas fa-check"></i> '+(typeof GHt==='function'?GHt('evt_rsvp'):'RSVP')+'</button>':'')+
                  '</div>'+
                '</div>'+
              '</div>'+
            '</div>';
          }).join('');
          // Bind clicks
          box.querySelectorAll('[data-evt-view]').forEach(function(b){
            b.addEventListener('click',function(){ location.href='events.html?id='+encodeURIComponent(b.dataset.evtView); });
          });
          box.querySelectorAll('[data-evt-rsvp]').forEach(function(b){
            b.addEventListener('click',function(){ if(!requireLogin()) return; _doRsvp(b.dataset.evtRsvp,b.dataset.evtName,b); });
          });
          box.querySelectorAll('.gh-evt-card').forEach(function(card){
            card.style.cursor='pointer';
            card.addEventListener('click',function(e){ if(e.target.closest('button')) return; location.href='events.html?id='+encodeURIComponent(card.dataset.evtId); });
          });
        }).catch(function(err){ box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Failed</h3><p>'+esc(err&&err.message||'')+'</p></div>'; });
      }
      _loadEvents();
    });
  }

  function _doRsvp(evId, evName, btn){
    var u=authUser(); if(!u) return;
    var going=btn.classList.contains('rsvp-active');
    var op=going?fs().arrayRemove(u.uid):fs().arrayUnion(u.uid);
    fs().updateDoc(fs().doc(db(),'events',evId),{ attendees:op, rsvpCount:fs().increment(going?-1:1) }).then(function(){
      btn.classList.toggle('rsvp-active',!going);
      var _et=typeof GHt==='function'?GHt:function(k){return k;};
      btn.innerHTML=(!going?'<i class="fas fa-check-circle"></i> '+_et('evt_going_check'):'<i class="fas fa-check"></i> '+_et('evt_rsvp'));
      toast(!going?'🎉 '+evName:'RSVP removed');
    }).catch(function(err){ toast('Failed: '+(err.message||err.code),'error'); });
  }

  function _renderEventDetail(evId){
    shell({ active:'events', center:'<div id="ghEvtDetail"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>'+(typeof GHt==='function'?GHt('evt_loading'):'Loading event…')+'</h3></div></div>' });
    ready(function(){
      var _et=typeof GHt==='function'?GHt:function(k){return k;};
      if(!fs()||!db()){ document.getElementById('ghEvtDetail').innerHTML='<div class="gh-card gh-empty"><h3>'+_et('rw_unavailable')+'</h3></div>'; return; }
      fs().getDoc(fs().doc(db(),'events',evId)).then(function(snap){
        if(!snap.exists()){ document.getElementById('ghEvtDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-calendar-xmark"></i><h3>'+_et('evt_not_found')+'</h3><a class="gh-btn" href="events.html">'+_et('evt_back')+'</a></div>'; return; }
        var ev=Object.assign({id:evId},snap.data());
        var name=ev.name||ev.title||'Event';
        var evDate=ev.startDate?new Date(ts(ev.startDate)):null;
        var dateStr=evDate?evDate.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}):'TBA';
        var endStr=ev.endDate?new Date(ts(ev.endDate)).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'';
        var img72=ev.coverUrl||ev.imageUrl||ev.thumbnail||'';
        var rsvp=ev.rsvpCount||ev.attendeeCount||0;
        var u=authUser();
        var isOrg=u&&(ev.organizerId===u.uid||ev.createdBy===u.uid||ev.userId===u.uid);
        var isGoing=u&&ev.attendees&&(Array.isArray(ev.attendees)?ev.attendees.indexOf(u.uid)>-1:false);
        document.getElementById('ghEvtDetail').innerHTML=
          '<div class="gh-card" style="padding:0;overflow:hidden">'+
            (img72?'<img src="'+esc(img72)+'" alt="'+esc(name)+'" style="width:100%;max-height:280px;object-fit:cover">':'')+
            '<div style="padding:20px">'+
              '<div style="display:flex;gap:16px;align-items:flex-start">'+
                '<div class="gh-evt-date-badge" style="flex-shrink:0">'+
                  (evDate?'<span class="gh-evt-day">'+evDate.getDate()+'</span><span class="gh-evt-mon">'+evDate.toLocaleString('default',{month:'short'})+'</span>':'<span class="gh-evt-day">?</span><span class="gh-evt-mon">TBA</span>')+
                '</div>'+
                '<div style="flex:1">'+
                  '<h1 style="margin:0 0 8px;font-size:1.3rem">'+esc(name)+'</h1>'+
                  '<div class="gh-evt-meta" style="margin-bottom:6px"><i class="fas fa-clock"></i> '+esc(dateStr)+(endStr?' – '+esc(endStr):'')+'</div>'+
                  (ev.location?'<div class="gh-evt-meta" style="margin-bottom:6px"><i class="fas fa-map-marker-alt"></i> '+esc(ev.location)+'</div>':'')+
                  (ev.organizer||ev.organizerName?'<div class="gh-evt-meta" style="margin-bottom:6px"><i class="fas fa-user"></i> '+_et('evt_organized_by')+' '+esc(ev.organizer||ev.organizerName)+'</div>':'')+
                  '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">'+
                    '<button class="gh-btn'+(isGoing?' active':'')+'" id="ghEvtRsvpBtn" data-ev-id="'+esc(evId)+'" data-ev-name="'+esc(name)+'">'+
                      (isGoing?'<i class="fas fa-check-circle"></i> '+_et('evt_going_check'):'<i class="fas fa-check"></i> '+_et('evt_rsvp'))+
                    '</button>'+
                    '<button class="gh-btn ghost" id="ghEvtShareBtn"><i class="fas fa-share"></i> '+_et('evt_share')+'</button>'+
                    (isOrg?'<button class="gh-btn ghost" id="ghEvtEditBtn"><i class="fas fa-pen"></i> '+_et('evt_edit')+'</button>':'')+
                  '</div>'+
                  '<div class="gh-evt-meta" style="margin-top:8px"><i class="fas fa-users"></i> <strong>'+rsvp+'</strong> '+_et('evt_going_count')+'</div>'+
                '</div>'+
              '</div>'+
              (ev.description?'<div class="gh-evt-desc" style="margin-top:16px;line-height:1.6;color:var(--gh-text)">'+esc(ev.description)+'</div>':'')+
              (ev.ticketUrl?'<a class="gh-btn" style="margin-top:16px;display:inline-block" href="'+esc(ev.ticketUrl)+'" target="_blank" rel="noopener"><i class="fas fa-ticket"></i> '+_et('evt_get_tickets')+'</a>':'')+
            '</div>'+
          '</div>'+
          '<a class="gh-btn ghost" href="events.html" style="margin-top:10px;display:block;text-align:center"><i class="fas fa-arrow-left"></i> '+_et('evt_back')+'</a>';
        var rsvpBtn=document.getElementById('ghEvtRsvpBtn');
        if(rsvpBtn) rsvpBtn.onclick=function(){ if(!requireLogin()) return; _doRsvp(evId,name,rsvpBtn); };
        var shareBtn=document.getElementById('ghEvtShareBtn');
        if(shareBtn) shareBtn.onclick=function(){
          if(navigator.share) navigator.share({title:name,url:location.href}).catch(function(){});
          else{ try{navigator.clipboard.writeText(location.href);}catch(e){} toast('Link copied!'); }
        };
      }).catch(function(err){ document.getElementById('ghEvtDetail').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Failed</h3><p>'+esc(err.message||'')+'</p></div>'; });
    });
  }

  function _openCreateEventModal(){
    var body=
      '<input class="gh-input" id="ghEvtName" placeholder="Event name *" maxlength="100" style="margin-bottom:8px">'+
      '<div style="display:flex;gap:8px;margin-bottom:8px">'+
        '<input class="gh-input" type="datetime-local" id="ghEvtStart" style="flex:1" title="Start date & time">'+
        '<input class="gh-input" type="datetime-local" id="ghEvtEnd" style="flex:1" title="End date & time">'+
      '</div>'+
      '<input class="gh-input" id="ghEvtLocation" placeholder="Location / Address" style="margin-bottom:8px">'+
      '<select class="gh-select" id="ghEvtCat" style="margin-bottom:8px">'+
        _EV_CATS.filter(function(c){ return c!=='All'; }).map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('')+
      '</select>'+
      '<textarea class="gh-textarea" id="ghEvtDesc" placeholder="About this event…" rows="3" style="margin-bottom:8px"></textarea>'+
      '<input class="gh-input" id="ghEvtCover" placeholder="Cover image URL (optional)" style="margin-bottom:8px">'+
      '<input class="gh-input" id="ghEvtTicket" placeholder="Ticket link (optional)">';
    modal('Create Event',body,
      '<button class="gh-btn ghost" data-close-modal>Cancel</button>'+
      '<button class="gh-btn" id="ghEvtSubmitBtn"><i class="fas fa-calendar-plus"></i> Create</button>',
      'ghCreateEvtModal');
    var sbtn=document.getElementById('ghEvtSubmitBtn');
    if(sbtn) sbtn.onclick=function(){
      var name=(document.getElementById('ghEvtName').value||'').trim();
      if(!name) return toast('Enter event name','error');
      var u=authUser(); if(!u) return toast('Sign in required','error');
      sbtn.disabled=true; sbtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>';
      var startVal=document.getElementById('ghEvtStart').value;
      var endVal=document.getElementById('ghEvtEnd').value;
      fs().addDoc(fs().collection(db(),'events'),{
        name:name,
        category:(document.getElementById('ghEvtCat').value)||'Social',
        description:(document.getElementById('ghEvtDesc').value||'').trim(),
        location:(document.getElementById('ghEvtLocation').value||'').trim(),
        coverUrl:(document.getElementById('ghEvtCover').value||'').trim(),
        ticketUrl:(document.getElementById('ghEvtTicket').value||'').trim(),
        startDate:startVal?fs().Timestamp.fromDate(new Date(startVal)):fs().serverTimestamp(),
        endDate:endVal?fs().Timestamp.fromDate(new Date(endVal)):null,
        organizerId:u.uid,
        organizerName:u.displayName||'',
        status:'active',
        rsvpCount:0,
        attendees:[],
        createdAt:fs().serverTimestamp()
      }).then(function(ref){
        toast('Event created! 🎉');
        var m=document.getElementById('ghCreateEvtModal'); if(m) m.remove();
        if(ref&&ref.id) setTimeout(function(){ location.href='events.html?id='+encodeURIComponent(ref.id); },400);
      }).catch(function(err){ toast('Failed: '+(err.message||err.code),'error'); sbtn.disabled=false; sbtn.innerHTML='Create'; });
    };
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 73 — Business Analytics Dashboard (enhance manage tab)
  ══════════════════════════════════════════════════════════════ */
  window.ghRenderBizAnalytics = function(bizId, container){
    if(!container) return;
    container.innerHTML='<div class="gh-biz-analytics"><div class="gh-card gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div></div>';
    if(!fs()||!db()){ container.innerHTML='<div class="gh-card gh-empty"><h3>Unavailable</h3></div>'; return; }
    Promise.all([
      fs().getDocs(fs().query(fs().collection(db(),'posts'),fs().where('bizId','==',bizId),fs().where('status','!=','deleted'),fs().orderBy('status'),fs().orderBy('createdAt','desc'),fs().limit(20))).catch(function(){ return {docs:[]}; }),
      fs().getDoc(fs().doc(db(),'businesses',bizId)).catch(function(){ return null; })
    ]).then(function(results){
      var postSnap=results[0]; var bizSnap=results[1];
      var posts=[]; postSnap.docs.forEach(function(d){ posts.push(Object.assign({id:d.id},d.data())); });
      var biz=bizSnap&&bizSnap.exists()?bizSnap.data():{};
      var totalViews=posts.reduce(function(s,p){ return s+(p.viewCount||p.views||0); },0);
      var totalReactions=posts.reduce(function(s,p){ var r=p.reactions||{}; return s+Object.values(r).reduce(function(a,b){ return a+(b||0); },0); },0);
      var totalComments=posts.reduce(function(s,p){ return s+(p.commentCount||p.comments||0); },0);
      var followers=biz.followerCount||biz.followers||0;
      var topPost=posts.sort(function(a,b){ return (_postScore(b))-(_postScore(a)); })[0];
      container.innerHTML=
        '<div class="gh-biz-analytics">'+
          '<h3 style="margin:0 0 16px;font-size:1rem"><i class="fas fa-chart-line"></i> Page Analytics</h3>'+
          '<div class="gh-analytics-grid">'+
            '<div class="gh-analytics-stat"><div class="gh-analytics-val">'+_fmtCount(followers)+'</div><div class="gh-analytics-lbl">Followers</div></div>'+
            '<div class="gh-analytics-stat"><div class="gh-analytics-val">'+_fmtCount(totalViews)+'</div><div class="gh-analytics-lbl">Total Views</div></div>'+
            '<div class="gh-analytics-stat"><div class="gh-analytics-val">'+_fmtCount(totalReactions)+'</div><div class="gh-analytics-lbl">Reactions</div></div>'+
            '<div class="gh-analytics-stat"><div class="gh-analytics-val">'+_fmtCount(totalComments)+'</div><div class="gh-analytics-lbl">Comments</div></div>'+
            '<div class="gh-analytics-stat"><div class="gh-analytics-val">'+posts.length+'</div><div class="gh-analytics-lbl">Posts (last 20)</div></div>'+
            '<div class="gh-analytics-stat"><div class="gh-analytics-val">'+(posts.length?Math.round((totalViews+totalReactions*3)/posts.length):0)+'</div><div class="gh-analytics-lbl">Avg. Engagement</div></div>'+
          '</div>'+
          (topPost?
            '<div style="margin-top:16px"><strong style="font-size:.85rem;color:var(--gh-muted)">⭐ Top performing post</strong>'+
            '<div class="gh-analytics-top-post" onclick="location.href=\'feed.html#post-'+esc(topPost.id)+'\'" style="cursor:pointer;margin-top:8px;padding:12px;background:var(--gh-surface);border-radius:10px;border:1px solid var(--gh-border)">'+
              '<div style="font-size:.9rem;margin-bottom:6px">'+esc((topPost.text||'').slice(0,120)+(topPost.text&&topPost.text.length>120?'…':''))+'</div>'+
              '<div style="display:flex;gap:12px;font-size:.8rem;color:var(--gh-muted)">'+
                '<span><i class="fas fa-eye"></i> '+(topPost.viewCount||topPost.views||0)+'</span>'+
                '<span><i class="fas fa-heart"></i> '+(topPost.reactionCount||0)+'</span>'+
                '<span><i class="fas fa-comment"></i> '+(topPost.commentCount||0)+'</span>'+
              '</div>'+
            '</div></div>':'')+
          '<div style="margin-top:16px"><button class="gh-btn ghost" onclick="this.closest(\'.gh-biz-analytics\').querySelector(\'.gh-boost-panel\')&&this.closest(\'.gh-biz-analytics\').querySelector(\'.gh-boost-panel\').remove();window.ghPromotePage&&window.ghPromotePage(\''+esc(bizId)+'\')"><i class="fas fa-rocket"></i> Promote Page</button></div>'+
        '</div>';
    }).catch(function(err){ container.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Analytics failed</h3><p>'+esc(err.message||'')+'</p></div>'; });
  };

  /* ══════════════════════════════════════════════════════════════
     PHASE 74 — Reels / Short Video Feed
  ══════════════════════════════════════════════════════════════ */
  function renderReels(){
    var _rt=typeof GHt==='function'?GHt:function(k){return k;};
    shell({ active:'reels',
      center:
        '<div id="ghReelsFeed" class="gh-reels-feed">'+
          '<div class="gh-reels-loading"><i class="fas fa-circle-notch fa-spin"></i><span>'+_rt('reels_loading')+'</span></div>'+
        '</div>'
    });
    ready(function(){
      var feed=document.getElementById('ghReelsFeed'); if(!feed) return;
      var _rt2=typeof GHt==='function'?GHt:function(k){return k;};
      if(!fs()||!db()){ feed.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-video-slash"></i><h3>'+_rt2('reels_unavailable')+'</h3></div>'; return; }
      var _currentIdx=0; var _reels=[]; var _obs=null;
      fs().getDocs(fs().query(
        fs().collection(db(),'posts'),
        fs().where('mediaType','==','video'),
        fs().where('status','!=','deleted'),
        fs().orderBy('status'),
        fs().orderBy('createdAt','desc'),
        fs().limit(20)
      )).then(function(snap){
        snap.forEach(function(d){ _reels.push(Object.assign({id:d.id},d.data())); });
        if(!_reels.length){
          var _rt3=typeof GHt==='function'?GHt:function(k){return k;};
          feed.innerHTML='<div class="gh-card gh-empty" style="min-height:400px"><i class="fas fa-film"></i><h3>'+_rt3('reels_empty')+'</h3><p>'+_rt3('reels_empty_sub')+'</p></div>';
          return;
        }
        feed.innerHTML='';
        _reels.forEach(function(r,idx){
          var name=r.authorName||'Creator'; var av=r.authorAvatar||r.photoURL||''; var txt=(r.text||'').slice(0,100);
          var rx=r.reactionCount||0; var cm=r.commentCount||0;
          var div=document.createElement('div');
          div.className='gh-reel-item'; div.dataset.reelIdx=idx;
          div.innerHTML=
            '<video class="gh-reel-video" src="'+esc(r.mediaUrl||r.videoUrl||'')+'" playsinline muted loop preload="metadata"></video>'+
            '<div class="gh-reel-overlay">'+
              '<div class="gh-reel-author">'+
                '<span class="gh-avatar sm">'+(av?'<img src="'+esc(av)+'" alt="">':esc((name[0]||'U').toUpperCase()))+'</span>'+
                '<strong>'+esc(name)+'</strong>'+
              '</div>'+
              (txt?'<div class="gh-reel-caption">'+esc(txt)+'</div>':'')+
            '</div>'+
            '<div class="gh-reel-actions">'+
              '<button class="gh-reel-action" data-reel-like="'+esc(r.id)+'"><i class="fas fa-heart"></i><span>'+_fmtCount(rx)+'</span></button>'+
              '<button class="gh-reel-action" data-reel-comment="'+esc(r.id)+'"><i class="fas fa-comment"></i><span>'+_fmtCount(cm)+'</span></button>'+
              '<button class="gh-reel-action" data-reel-share="'+esc(r.id)+'"><i class="fas fa-share"></i></button>'+
              '<button class="gh-reel-action" data-reel-mute><i class="fas fa-volume-xmark"></i></button>'+
            '</div>';
          feed.appendChild(div);
          // Mute toggle
          div.querySelector('[data-reel-mute]').onclick=function(){
            var vid=div.querySelector('video'); if(!vid) return;
            vid.muted=!vid.muted;
            this.innerHTML=vid.muted?'<i class="fas fa-volume-xmark"></i>':'<i class="fas fa-volume-high"></i>';
          };
          // Like
          div.querySelector('[data-reel-like]').onclick=function(){ if(!requireLogin()) return; var pid=this.dataset.reelLike; if(GS()&&GS().reactToPost) GS().reactToPost(pid,'love',function(){}); };
          // Comment
          div.querySelector('[data-reel-comment]').onclick=function(){ if(!requireLogin()) return; var pid=this.dataset.reelComment; openFocusedPost(pid); };
          // Share
          div.querySelector('[data-reel-share]').onclick=function(){
            if(navigator.share) navigator.share({url:location.origin+'/feed.html#post-'+this.dataset.reelShare}).catch(function(){});
            else toast('Link copied!');
          };
        });
        // IntersectionObserver for autoplay
        _obs=new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            var vid=entry.target.querySelector('video');
            if(!vid) return;
            if(entry.isIntersecting && entry.intersectionRatio>0.6){
              vid.play().catch(function(){});
            } else {
              vid.pause();
            }
          });
        },{ threshold:[0,0.6,1] });
        feed.querySelectorAll('.gh-reel-item').forEach(function(item){ _obs.observe(item); });
        state.pageUnsubs.push(function(){ if(_obs){ _obs.disconnect(); _obs=null; } });
      }).catch(function(err){
        feed.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>'+(typeof GHt==='function'?GHt('reels_fail'):'Failed to load reels')+'</h3><p>'+esc(err.message||'')+'</p></div>';
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 75 — DM Voice Messages (injected into messages page)
  ══════════════════════════════════════════════════════════════ */
  window.ghInitVoiceDM = function(inputRow){
    if(!inputRow) return;
    if(inputRow.querySelector('.gh-voice-dm-btn')) return; // already injected
    var btn=document.createElement('button');
    btn.className='gh-voice-dm-btn gh-btn ghost sm';
    btn.title='Voice message'; btn.innerHTML='<i class="fas fa-microphone"></i>';
    var _mr=null; var _chunks=[]; var _recording=false;
    btn.onclick=function(){
      if(!_recording){
        if(!navigator.mediaDevices||!window.MediaRecorder){ return toast('Mic not supported','error'); }
        navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
          _mr=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':'audio/ogg'}); _chunks=[];
          _mr.ondataavailable=function(e){ if(e.data&&e.data.size>0) _chunks.push(e.data); };
          _mr.onstop=function(){
            stream.getTracks().forEach(function(t){ t.stop(); });
            var blob=new Blob(_chunks,{type:_mr.mimeType||'audio/webm'});
            var file=new File([blob],'voice-'+Date.now()+'.webm',{type:blob.type});
            btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>'; btn.disabled=true;
            prepareMedia(file,'voice-dm',function(pct){ btn.title=pct+'%'; }).then(function(url){
              btn.innerHTML='<i class="fas fa-microphone"></i>'; btn.disabled=false; btn.title='Voice message';
              if(url && window.ghSendMessage) window.ghSendMessage({type:'voice',audioUrl:url,duration:Math.round(_chunks.length*100/10)});
              else toast('Voice message ready');
            }).catch(function(){ btn.innerHTML='<i class="fas fa-microphone"></i>'; btn.disabled=false; toast('Upload failed','error'); });
          };
          _mr.start(100); _recording=true;
          btn.innerHTML='<i class="fas fa-stop" style="color:#ef4444"></i>'; btn.title='Stop recording';
        }).catch(function(){ toast(typeof GHt==='function'?GHt('mic_denied'):'Microphone access denied','error'); });
      } else {
        if(_mr&&_mr.state!=='inactive') _mr.stop();
        _recording=false;
        btn.innerHTML='<i class="fas fa-microphone"></i>'; btn.title='Voice message';
      }
    };
    inputRow.appendChild(btn);
  };

  /* ══════════════════════════════════════════════════════════════
     PHASE 76 — Post Impression Tracker (view count via IntersectionObserver)
  ══════════════════════════════════════════════════════════════ */
  (function _initImpressionTracker(){
    var _tracked={};
    var _obs76=null;
    function _startTracking(){
      if(_obs76) return;
      _obs76=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(!entry.isIntersecting||entry.intersectionRatio<0.5) return;
          var card=entry.target; var pid=card.dataset.postId||card.id&&card.id.replace('post-','');
          if(!pid||_tracked[pid]) return;
          _tracked[pid]=true;
          _obs76.unobserve(card);
          setTimeout(function(){
            if(!fs()||!db()) return;
            fs().updateDoc(fs().doc(db(),'posts',pid),{ viewCount:fs().increment(1) }).catch(function(){});
          },2000);
        });
      },{ threshold:0.5 });
    }
    // Observe new post cards as they're painted
    var _mutObs=new MutationObserver(function(muts){
      if(!_obs76) _startTracking();
      muts.forEach(function(mut){
        mut.addedNodes.forEach(function(node){
          if(node.nodeType!==1) return;
          var cards=node.classList&&node.classList.contains('gh-post')?[node]:[].slice.call(node.querySelectorAll&&node.querySelectorAll('.gh-post')||[]);
          cards.forEach(function(card){
            var pid=card.dataset.postId||card.id&&card.id.replace('post-','');
            if(pid&&!_tracked[pid]) _obs76.observe(card);
          });
        });
      });
    });
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',function(){ _mutObs.observe(document.body,{childList:true,subtree:true}); });
    } else { _mutObs.observe(document.body,{childList:true,subtree:true}); }
  })();

  /* ══════════════════════════════════════════════════════════════
     PHASE 77 — GeoAI Assistant
  ══════════════════════════════════════════════════════════════ */
  function renderAssistant(){
    var _at=typeof GHt==='function'?GHt:function(k){return k;};
    shell({ active:'assistant',
      center:
        '<div class="gh-ai-chat" id="ghAiChat">'+
          '<div class="gh-ai-header">'+
            '<div class="gh-ai-avatar"><i class="fas fa-robot"></i></div>'+
            '<div><strong>GeoAI</strong><div class="gh-muted" style="font-size:.8rem">'+_at('ai_subtitle')+'</div></div>'+
            '<button class="gh-btn ghost sm" id="ghAiClear"><i class="fas fa-trash"></i></button>'+
          '</div>'+
          '<div class="gh-ai-messages" id="ghAiMessages">'+
            '<div class="gh-ai-msg bot">'+
              '<div class="gh-ai-bubble">👋 გამარჯობა! მე GeoAI ვარ — GeoHub-ის ინტელექტუალური ასისტენტი. შემიძლია:<br><br>'+
              '• 📍 <strong>ადგილები</strong> — Georgia-ს საუკეთესო სათვალთვალო წერტილები<br>'+
              '• 🗓️ <strong>ივენთები</strong> — ახლო ღონისძიებები<br>'+
              '• ✍️ <strong>Caption</strong> — post-ისთვის კარგი ტექსტი<br>'+
              '• 🏷️ <strong>Hashtags</strong> — ვირუსული ჰეშთეგები<br>'+
              '• 📅 <strong>გეგმა</strong> — კვირის მარშრუტი<br><br>'+
              'რა შემიძლია დაგეხმარო?</div>'+
            '</div>'+
          '</div>'+
          '<div class="gh-ai-quick-btns" id="ghAiQuick">'+
            '<button class="gh-pill" data-ai-q="საუკეთესო ადგილები Tbilisi-ში?">📍 Tbilisi spots</button>'+
            '<button class="gh-pill" data-ai-q="დამიწერე Instagram caption ფოტოსთვის">✍️ Caption</button>'+
            '<button class="gh-pill" data-ai-q="ვირუსული hashtag-ები Georgia-სთვის">🏷️ Hashtags</button>'+
            '<button class="gh-pill" data-ai-q="კვირის trip plan Kazbegi-ში">🗓️ Trip plan</button>'+
          '</div>'+
          '<div class="gh-ai-input-row">'+
            '<textarea class="gh-ai-input" id="ghAiInput" placeholder="'+_at('ai_placeholder')+'" rows="1"></textarea>'+
            '<button class="gh-btn" id="ghAiSend"><i class="fas fa-paper-plane"></i></button>'+
          '</div>'+
        '</div>'
    });
    ready(function(){
      var msgs=document.getElementById('ghAiMessages');
      var inp=document.getElementById('ghAiInput');
      var sendBtn=document.getElementById('ghAiSend');
      var clearBtn=document.getElementById('ghAiClear');
      var quickBtns=document.getElementById('ghAiQuick');
      if(!msgs||!inp||!sendBtn) return;
      var _history=[];
      try{ var saved=JSON.parse(localStorage.getItem('gh_ai_history')||'null'); if(Array.isArray(saved)) _history=saved; }catch(e){}
      if(_history.length){
        _history.forEach(function(m){
          var d=document.createElement('div');
          d.className='gh-ai-msg '+(m.role==='user'?'user':'bot');
          d.innerHTML='<div class="gh-ai-bubble">'+esc(m.content)+'</div>';
          msgs.appendChild(d);
        });
        msgs.scrollTop=msgs.scrollHeight;
      }
      if(clearBtn) clearBtn.onclick=function(){
        _history=[]; try{localStorage.removeItem('gh_ai_history');}catch(e){}
        var _atc=typeof GHt==='function'?GHt:function(k){return k;};
        msgs.innerHTML='<div class="gh-ai-msg bot"><div class="gh-ai-bubble">'+_atc('ai_cleared')+'</div></div>';
      };
      if(quickBtns) quickBtns.addEventListener('click',function(e){
        var b=e.target.closest('[data-ai-q]'); if(!b) return;
        inp.value=b.dataset.aiQ; _sendMsg();
      });
      sendBtn.onclick=_sendMsg;
      inp.addEventListener('keydown',function(e){
        if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); _sendMsg(); }
      });
      inp.oninput=function(){ this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,120)+'px'; };

      function _addMsg(role,text){
        var d=document.createElement('div');
        d.className='gh-ai-msg '+(role==='user'?'user':'bot');
        d.innerHTML='<div class="gh-ai-bubble">'+(role==='bot'?text:esc(text))+'</div>';
        msgs.appendChild(d);
        msgs.scrollTop=msgs.scrollHeight;
        return d;
      }
      function _sendMsg(){
        var q=(inp.value||'').trim(); if(!q) return;
        inp.value=''; inp.style.height='auto';
        _addMsg('user',q);
        _history.push({role:'user',content:q});
        var thinkDiv=_addMsg('bot','<i class="fas fa-circle-notch fa-spin"></i> Thinking…');
        // GeoAI local smart responses (no API key needed)
        setTimeout(function(){
          var resp=_geoAIRespond(q);
          thinkDiv.querySelector('.gh-ai-bubble').innerHTML=resp;
          _history.push({role:'assistant',content:resp});
          if(_history.length>30) _history=_history.slice(-30);
          try{ localStorage.setItem('gh_ai_history',JSON.stringify(_history)); }catch(e){}
          msgs.scrollTop=msgs.scrollHeight;
        },800+Math.random()*700);
      }
      function _geoAIRespond(q){
        var ql=q.toLowerCase();
        if(ql.indexOf('caption')>-1||ql.indexOf('კაპციონ')>-1){
          var caps=['✨ Living my best life in Georgia 🇬🇪 #GeoHub #Georgia','🌿 გული ივსება ამ ხედებით 😍 #Tbilisi #DiscoverGeorgia','🏔️ Mountains are calling and I must go! Kazbegi never disappoints. #Adventure #Georgia','☕ Tbilisi vibes hit differently when it rains. #OldTown #TbilisiCity','🌸 Every street in Old Tbilisi tells a story ✨ #GeoHub #ExploreGeorgia'];
          return '📝 <strong>Caption ideas for you:</strong><br><br>'+caps.map(function(c,i){ return (i+1)+'. '+c; }).join('<br><br>');
        }
        if(ql.indexOf('hashtag')>-1||ql.indexOf('ჰეშთეგ')>-1){
          return '🏷️ <strong>Top hashtags for Georgia content:</strong><br><br>#GeoHub #Georgia #DiscoverGeorgia #Tbilisi #VisitGeorgia #TbilisiCity #GeorgianWine #Kazbegi #OldTown #GeoTravel<br><br><em>For reels:</em> #GeorgiaReels #TbilisiLife #GeorgianCuisine #HikingGeorgia #ExploreGeorgia';
        }
        if(ql.indexOf('tbilisi')>-1||ql.indexOf('თბილის')>-1){
          return '📍 <strong>Top Tbilisi spots:</strong><br><br>1. 🏰 Narikala Fortress — panoramic city views<br>2. 🛁 Abanotubani — sulfur baths district<br>3. 🏛️ Rustaveli Avenue — culture & shopping<br>4. 🍷 Fabrika — trendy creative hub<br>5. ⛪ Metekhi Church — iconic riverside<br>6. 🌿 Mtatsminda Park — cable car & views<br>7. 🌉 Peace Bridge — night photography<br><br>Best time: Spring (April-June) or Fall (Sept-Oct) 🍂';
        }
        if(ql.indexOf('kazbegi')>-1||ql.indexOf('ყაზბეგ')>-1){
          return '🏔️ <strong>Kazbegi Trip Plan:</strong><br><br>📅 <strong>Day 1:</strong> Tbilisi → Gudauri (stop for views) → Kazbegi village<br>🏠 Stay: Rooms Hotel Kazbegi or guesthouse<br><br>📅 <strong>Day 2:</strong> 🌄 Early morning hike to Gergeti Trinity Church (2h)<br>Afternoon: Truso Valley or Dariali Gorge<br><br>📅 <strong>Day 3:</strong> Return via Military Highway, stop at Ananuri Castle<br><br>💡 Tips: Take marshrutka from Didube station. Bring warm layers even in summer!';
        }
        if(ql.indexOf('wine')>-1||ql.indexOf('ღვინო')>-1||ql.indexOf('kakheti')>-1){
          return '🍷 <strong>Georgia Wine Guide:</strong><br><br>🏆 Must-try regions: Kakheti (Telavi, Sighnaghi)<br><br>🍇 Best varieties: Rkatsiteli, Saperavi, Mtsvane<br><br>📍 Top wineries: Château Mukhrani, Twins Wine House, Pheasant\'s Tears<br><br>🎉 Wine festivals: Rtveli harvest (October) — don\'t miss it!<br><br>#GeorgianWine #Kakheti #Saperavi';
        }
        if(ql.indexOf('plan')>-1||ql.indexOf('trip')>-1||ql.indexOf('გეგმ')>-1){
          return '🗺️ <strong>7-Day Georgia Highlights:</strong><br><br>Day 1-2: Tbilisi — Old Town, Narikala, sulfur baths<br>Day 3: Day trip to Mtskheta (UNESCO site)<br>Day 4-5: Kazbegi — mountains, Gergeti Church<br>Day 6: Kakheti — wine, vineyards, Sighnaghi<br>Day 7: Back to Tbilisi, Rustaveli, Black Lion Square<br><br>🚌 Transport: Marshrutka + car rental for mountains<br>💰 Budget: ~50-80 GEL/day';
        }
        if(ql.indexOf('food')>-1||ql.indexOf('eat')>-1||ql.indexOf('კვება')>-1||ql.indexOf('საჭმელ')>-1){
          return '🍽️ <strong>Must-try Georgian Foods:</strong><br><br>🥟 Khinkali — soup dumplings (twist & sip!)<br>🧀 Khachapuri — cheese bread (Adjarian has egg on top)<br>🫕 Ojakhuri — family-style pork & potatoes<br>🌿 Pkhali — vegetable balls with walnut sauce<br>🍢 Mtsvadi — Georgian BBQ skewers<br>🍮 Churchkhela — grape+walnut candy<br><br>Best restaurant streets: Leselidze, Erekle II, Atoneli (Tbilisi)';
        }
        // Default
        var defaults=[
          '🇬🇪 Georgia is one of the world\'s oldest wine-making countries — 8,000 years of tradition! Check out Kakheti region for wine tasting.',
          '💡 Pro tip: Follow local GeoHub creators for real-time insider recommendations in your city!',
          '📱 Use GeoHub\'s "Local Feed" tab to see posts from your city only — great for discovering nearby events!',
          '🌟 Did you know? GeoHub has a rewards system — earn XP by posting, commenting, and exploring!'
        ];
        return defaults[Math.floor(Math.random()*defaults.length)];
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 78 — Map / Discover Page (Leaflet.js)
  ══════════════════════════════════════════════════════════════ */
  function renderMapPage(){
    var _mt=typeof GHt==='function'?GHt:function(k){return k;};
    shell({ active:'map',
      center:
        '<div class="gh-map-page" id="ghMapPage">'+
          '<div class="gh-card" style="padding:12px 16px">'+
            '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'+
              '<h2 style="margin:0;font-size:1rem"><i class="fas fa-map"></i> '+_mt('map_title')+'</h2>'+
              '<div class="gh-pill-row" id="ghMapFilter" style="gap:6px">'+
                '<button class="gh-pill active" data-map-layer="posts"><i class="fas fa-newspaper"></i> '+_mt('profile_posts')+'</button>'+
                '<button class="gh-pill" data-map-layer="events"><i class="fas fa-calendar"></i> '+_mt('nav_events')+'</button>'+
                '<button class="gh-pill" data-map-layer="businesses"><i class="fas fa-store"></i> '+_mt('map_biz')+'</button>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div id="ghLeafletMap" class="gh-leaflet-map"></div>'+
          '<div id="ghMapSidebar" class="gh-map-sidebar"></div>'+
        '</div>'
    });
    ready(function(){
      var mapEl=document.getElementById('ghLeafletMap');
      if(!mapEl){ return; }
      // Dynamically load Leaflet CSS + JS
      if(!window.L){
        var lcss=document.createElement('link');
        lcss.rel='stylesheet'; lcss.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(lcss);
        var ljs=document.createElement('script');
        ljs.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        ljs.onload=function(){ _initLeafletMap(); };
        ljs.onerror=function(){ if(mapEl) mapEl.innerHTML='<div class="gh-card gh-empty" style="height:100%;display:flex;align-items:center;justify-content:center"><div><i class="fas fa-triangle-exclamation" style="font-size:2rem;color:#f59e0b"></i><p style="margin-top:8px">Map library failed to load. Check your connection.</p></div></div>'; };
        document.head.appendChild(ljs);
      } else { _initLeafletMap(); }

      var _map=null; var _markers=[]; var _layer='posts';
      function _initLeafletMap(){
        if(!window.L||_map) return;
        _map=L.map('ghLeafletMap').setView([41.6941,44.8337],12); // Tbilisi center
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
          attribution:'© OpenStreetMap contributors',maxZoom:19
        }).addTo(_map);
        _loadLayer('posts');
        // Filter buttons
        var filterBar=document.getElementById('ghMapFilter');
        if(filterBar) filterBar.addEventListener('click',function(e){
          var b=e.target.closest('[data-map-layer]'); if(!b) return;
          _layer=b.dataset.mapLayer;
          filterBar.querySelectorAll('.gh-pill').forEach(function(p){ p.classList.toggle('active',p===b); });
          _loadLayer(_layer);
        });
        // My location
        if(navigator.geolocation){
          navigator.geolocation.getCurrentPosition(function(pos){
            var lat=pos.coords.latitude, lng=pos.coords.longitude;
            _map.setView([lat,lng],14);
            L.circleMarker([lat,lng],{radius:8,fillColor:'#10b981',color:'#fff',weight:2,fillOpacity:1}).addTo(_map).bindPopup('📍 You are here');
          },function(){});
        }
      }

      function _loadLayer(layer){
        if(!_map||!fs()||!db()) return;
        _markers.forEach(function(m){ _map.removeLayer(m); }); _markers=[];
        var sidebar=document.getElementById('ghMapSidebar');
        if(sidebar) sidebar.innerHTML='<div class="gh-muted" style="font-size:.82rem;padding:8px"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>';
        var col,q;
        if(layer==='posts'){
          // Only ONE inequality filter allowed per Firestore query — filter location client-side
          q=fs().query(fs().collection(db(),'posts'),fs().where('status','!=','deleted'),fs().orderBy('status'),fs().orderBy('createdAt','desc'),fs().limit(60));
        } else if(layer==='events'){
          q=fs().query(fs().collection(db(),'events'),fs().where('status','!=','deleted'),fs().orderBy('status'),fs().orderBy('startDate','desc'),fs().limit(20));
        } else {
          q=fs().query(fs().collection(db(),'businesses'),fs().orderBy('createdAt','desc'),fs().limit(25));
        }
        fs().getDocs(q).then(function(snap){
          var items=[]; snap.forEach(function(d){ items.push(Object.assign({id:d.id},d.data())); });
          var sideHtml='';
          items.forEach(function(item){
            var lat=null,lng=null;
            if(item.location&&item.location.lat&&item.location.lng){ lat=item.location.lat; lng=item.location.lng; }
            else if(item.lat&&item.lng){ lat=item.lat; lng=item.lng; }
            else if(item.geopoint){ lat=item.geopoint.latitude; lng=item.geopoint.longitude; }
            // Fallback to rough city coords for demo
            if(!lat){ lat=41.69+(Math.random()-0.5)*0.1; lng=44.83+(Math.random()-0.5)*0.1; }
            var label=item.name||item.title||item.text||'Item';
            var icon=layer==='posts'?'📝':layer==='events'?'🗓️':'🏪';
            var m=L.marker([lat,lng]).addTo(_map);
            m.bindPopup('<strong>'+esc(label.slice(0,50))+'</strong>'+
              (layer==='events'&&item.startDate?'<br><small>'+new Date(ts(item.startDate)).toLocaleDateString()+'</small>':'')+
              '<br><a href="'+(layer==='businesses'?'business.html?id=':layer==='events'?'events.html?id=':'feed.html#post-')+esc(item.id)+'" style="color:#10b981">View →</a>');
            _markers.push(m);
            sideHtml+='<div class="gh-map-side-item" onclick="location.href=\''+(layer==='businesses'?'business.html?id=':layer==='events'?'events.html?id=':'feed.html#post-')+esc(item.id)+'\'">'+
              '<span style="font-size:1.2rem">'+icon+'</span>'+
              '<div><strong>'+esc(label.slice(0,40))+'</strong>'+
              (item.city||item.location?'<div class="gh-muted" style="font-size:.78rem">'+esc((item.city||item.location||'').slice(0,30))+'</div>':'')+
              '</div></div>';
          });
          if(sidebar) sidebar.innerHTML=sideHtml||'<div class="gh-muted" style="padding:8px;font-size:.82rem">Nothing to show</div>';
        }).catch(function(err){
          if(sidebar) sidebar.innerHTML='<div class="gh-muted" style="font-size:.82rem;padding:8px">Failed: '+esc(err.message||'')+'</div>';
        });
      }
      state.pageUnsubs.push(function(){ if(_map){ _map.remove(); _map=null; } });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 79 — Gamification Hub (XP, Badges, Leaderboard)
  ══════════════════════════════════════════════════════════════ */
  function renderGamification(){
    var _xt=typeof GHt==='function'?GHt:function(k){return k;};
    shell({ active:'gamification',
      center:
        '<div class="gh-gamif-page" id="ghGamifPage">'+
          '<div class="gh-card" style="text-align:center;padding:24px">'+
            '<div style="font-size:2rem;margin-bottom:8px">🏆</div>'+
            '<h2 style="margin:0 0 4px" data-i18n="xp_rewards_title">GeoHub XP & Rewards</h2>'+
            '<p class="gh-muted" style="margin:0">'+(typeof GHt==='function'?GHt('xp_earn_desc'):'Earn XP, unlock badges, climb the leaderboard')+'</p>'+
          '</div>'+
          '<div id="ghGamifContent"><div class="gh-card gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+
        '</div>'
    });
    ready(function(){
      var u=authUser();
      var box=document.getElementById('ghGamifContent'); if(!box) return;
      if(!u){ box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-lock"></i><h3>'+_xt('xp_sign_in')+'</h3><a class="gh-btn" href="auth.html">'+_xt('sign_in')+'</a></div>'; return; }
      var _BADGES=[
        {id:'first_post',icon:'✍️',name:'First Post',nkey:'badge_first_post',desc:'Made your first post',xp:50},
        {id:'explorer',icon:'🗺️',name:'Explorer',nkey:'badge_explorer',desc:'Visited 5 different pages',xp:100},
        {id:'social_butterfly',icon:'🦋',name:'Social Butterfly',nkey:'badge_social',desc:'Got 50 followers',xp:200},
        {id:'storyteller',icon:'📖',name:'Storyteller',nkey:'badge_storyteller',desc:'Posted 10 stories',xp:150},
        {id:'influencer',icon:'⭐',name:'Influencer',nkey:'badge_influencer',desc:'Got 100 reactions',xp:300},
        {id:'local_hero',icon:'🏙️',name:'Local Hero',nkey:'badge_local_hero',desc:'5 posts about your city',xp:200},
        {id:'connector',icon:'🤝',name:'Connector',nkey:'badge_connector',desc:'Followed 20 people',xp:100},
        {id:'reviewer',icon:'🌟',name:'Reviewer',nkey:'badge_reviewer',desc:'Left 5 business reviews',xp:150},
        {id:'event_goer',icon:'🎉',name:'Event Goer',nkey:'badge_event_goer',desc:'RSVP\'d to 3 events',xp:100},
        {id:'tipster',icon:'💎',name:'Tipster',nkey:'badge_tipster',desc:'Sent your first tip',xp:75}
      ];
      var _DAILY=[
        {id:'post_today',icon:'✍️',task:'Make a post today',tkey:'dm_post_today',xp:20,key:'posts'},
        {id:'like_3',icon:'❤️',task:'React to 3 posts',tkey:'dm_like_3',xp:10,key:'reactions'},
        {id:'comment_1',icon:'💬',task:'Leave a comment',tkey:'dm_comment_1',xp:15,key:'comments'},
        {id:'story_today',icon:'📸',task:'Post a story',tkey:'dm_story_today',xp:25,key:'stories'},
        {id:'discover_1',icon:'🔍',task:'Visit Discover page',tkey:'dm_discover_1',xp:5,key:'discover'}
      ];
      Promise.all([
        fs().getDoc(fs().doc(db(),'userXP',u.uid)).catch(function(){ return null; }),
        fs().getDocs(fs().query(fs().collection(db(),'userXP'),fs().orderBy('xp','desc'),fs().limit(10))).catch(function(){ return {docs:[]}; }),
        fs().getDocs(fs().query(fs().collection(db(),'users'),fs().where('uid','==',u.uid),fs().limit(1))).catch(function(){ return {docs:[]}; })
      ]).then(function(results){
        var xpDoc=results[0]&&results[0].exists()?results[0].data():{};
        var myXP=xpDoc.xp||0; var myLevel=Math.floor(myXP/500)+1; var nextLvlXP=myLevel*500;
        var myBadges=xpDoc.badges||[]; var dailyDone=xpDoc.dailyCompleted||{};
        var todayKey=new Date().toISOString().slice(0,10);
        var leaderDocs=results[1].docs;
        var leaders=[]; leaderDocs.forEach(function(d){ leaders.push(Object.assign({id:d.id},d.data())); });
        var pct=Math.min(100,Math.round((myXP%(nextLvlXP-500||500))/(nextLvlXP-500||500)*100));
        box.innerHTML=
          '<div class="gh-gamif-hero gh-card">'+
            '<div style="display:flex;align-items:center;gap:16px">'+
              '<div class="gh-xp-level-badge">Lv.'+myLevel+'</div>'+
              '<div style="flex:1">'+
                '<div style="font-size:.85rem;color:var(--gh-muted);margin-bottom:4px">'+_xt('xp_total')+' <strong style="color:var(--gh-green)">'+myXP.toLocaleString()+'</strong></div>'+
                '<div class="gh-xp-bar"><div class="gh-xp-fill" style="width:'+pct+'%"></div></div>'+
                '<div style="font-size:.75rem;color:var(--gh-muted);margin-top:2px">'+pct+'% to Level '+(myLevel+1)+'</div>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div class="gh-card">'+
            '<h3 style="margin:0 0 12px;font-size:.95rem"><i class="fas fa-sun"></i> '+_xt('xp_daily')+'</h3>'+
            '<div class="gh-daily-missions">'+
              _DAILY.map(function(m){
                var done=dailyDone[todayKey]&&dailyDone[todayKey][m.id];
                return '<div class="gh-mission-row'+(done?' done':'')+'" data-mission="'+esc(m.id)+'">'+
                  '<span class="gh-mission-icon">'+m.icon+'</span>'+
                  '<div class="gh-mission-info"><strong>'+esc(_xt(m.tkey)||m.task)+'</strong><span class="gh-muted">+'+m.xp+' XP</span></div>'+
                  (done?'<span class="gh-mission-check"><i class="fas fa-check-circle"></i></span>':'<button class="gh-btn sm ghost gh-mission-claim" data-mid="'+esc(m.id)+'" data-mxp="'+m.xp+'">'+_xt('xp_claim')+'</button>')+
                '</div>';
              }).join('')+
            '</div>'+
          '</div>'+
          '<div class="gh-card">'+
            '<h3 style="margin:0 0 12px;font-size:.95rem"><i class="fas fa-medal"></i> '+_xt('xp_badges')+'</h3>'+
            '<div class="gh-badges-grid">'+
              _BADGES.map(function(b){
                var earned=myBadges.indexOf(b.id)>-1;
                return '<div class="gh-badge-item'+(earned?' earned':'')+'" title="'+esc(b.desc)+(earned?'\nEarned!':'\n+'+b.xp+' XP')+'">'+
                  '<div class="gh-badge-icon">'+b.icon+'</div>'+
                  '<div class="gh-badge-name">'+esc(_xt(b.nkey)||b.name)+'</div>'+
                  '<div class="gh-badge-xp">'+esc(earned?_xt('xp_earned'):'+'+b.xp+' XP')+'</div>'+
                '</div>';
              }).join('')+
            '</div>'+
          '</div>'+
          '<div class="gh-card">'+
            '<h3 style="margin:0 0 12px;font-size:.95rem"><i class="fas fa-trophy"></i> '+_xt('xp_leaderboard')+' <span class="gh-muted" style="font-size:.8rem">(Top 10)</span></h3>'+
            (leaders.length?
              '<div class="gh-leader-list">'+
                leaders.map(function(l,i){
                  var isMe=l.id===u.uid;
                  return '<div class="gh-leader-row'+(isMe?' me':'')+'">'+
                    '<span class="gh-leader-rank">'+(i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.')+'</span>'+
                    '<span class="gh-avatar sm">'+(l.avatar||l.photoURL?'<img src="'+esc(l.avatar||l.photoURL||'')+'" alt="">':esc(((l.name||l.displayName||'?')[0]||'?').toUpperCase()))+'</span>'+
                    '<span class="gh-leader-name">'+esc(l.name||l.displayName||'User')+(isMe?' '+_xt('xp_you'):'')+'</span>'+
                    '<span class="gh-leader-xp">'+(_fmtCount(l.xp||0))+' XP</span>'+
                  '</div>';
                }).join('')+
              '</div>':
              '<div class="gh-muted" style="font-size:.85rem">'+_xt('xp_no_leaders')+'</div>')+
          '</div>';
        // Bind claim buttons
        box.querySelectorAll('.gh-mission-claim').forEach(function(btn){
          btn.addEventListener('click',function(){
            var mid=btn.dataset.mid; var mxp=parseInt(btn.dataset.mxp)||0;
            btn.disabled=true; btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>';
            // Use updateDoc (supports dotted nested paths); fall back to setDoc for first-time users
            var _ref=fs().doc(db(),'userXP',u.uid);
            // Also store name+avatar so leaderboard can display them
            var _meData=window.GeoCurrentUser||{}; var _myName=_meData.displayName||_meData.name||u.displayName||'User'; var _myAv=_meData.photoURL||_meData.avatar||u.photoURL||'';
            var _upd={}; _upd['dailyCompleted.'+todayKey+'.'+mid]=true; _upd['xp']=fs().increment(mxp); _upd['name']=_myName; _upd['avatar']=_myAv;
            fs().updateDoc(_ref,_upd).catch(function(){
              // Document doesn't exist yet — create it with correct nested structure
              var init={xp:mxp,name:_myName,avatar:_myAv,dailyCompleted:{}}; init.dailyCompleted[todayKey]={}; init.dailyCompleted[todayKey][mid]=true;
              return fs().setDoc(_ref,init,{merge:true});
            }).then(function(){
              toast('+'+mxp+' '+_xt('xp_keep_going'));
              var row=btn.closest('.gh-mission-row'); if(row){ row.classList.add('done'); var check=document.createElement('span'); check.className='gh-mission-check'; check.innerHTML='<i class="fas fa-check-circle"></i>'; btn.replaceWith(check); }
            }).catch(function(err){ toast('Failed','error'); btn.disabled=false; btn.innerHTML=_xt('xp_claim'); });
          });
        });
      }).catch(function(err){ box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Failed</h3><p>'+esc(err.message||'')+'</p></div>'; });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 80 — Advanced Profile (Portfolio tab, skills, collab badge)
  ══════════════════════════════════════════════════════════════ */
  window.ghProfilePortfolio = function(uid, container){
    if(!container) return;
    container.innerHTML='<div class="gh-portfolio-grid" id="ghPortfolioGrid"><div class="gh-card gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div></div>';
    if(!fs()||!db()){ container.innerHTML='<div class="gh-card gh-empty"><h3>Unavailable</h3></div>'; return; }
    // Load user's media posts as portfolio
    fs().getDocs(fs().query(
      fs().collection(db(),'posts'),
      fs().where('authorId','==',uid),
      fs().where('status','!=','deleted'),
      fs().orderBy('status'),
      fs().orderBy('createdAt','desc'),
      fs().limit(24)
    )).then(function(snap){
      var items=[]; snap.forEach(function(d){ items.push(Object.assign({id:d.id},d.data())); });
      var mediaPosts=items.filter(function(p){ return p.mediaUrl||p.imageUrl||p.videoUrl||p.thumbnail; });
      var box=document.getElementById('ghPortfolioGrid');
      if(!box) return;
      if(!mediaPosts.length){
        box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-images"></i><h3>No media posts yet</h3><p>Post photos or videos to build your portfolio!</p></div>';
        return;
      }
      box.innerHTML='<div class="gh-portfolio-mosaic">'+
        mediaPosts.map(function(p){
          var img=p.mediaUrl||p.imageUrl||p.thumbnail||'';
          var isVideo=p.mediaType==='video'||/\.(mp4|webm|mov)/i.test(img);
          return '<div class="gh-portfolio-item" onclick="openFocusedPost&&openFocusedPost(\''+esc(p.id)+'\')">'+
            (isVideo?'<video src="'+esc(img)+'" muted playsinline class="gh-portfolio-media" onerror="this.remove()"></video>':'<img src="'+esc(img)+'" alt="" loading="lazy" class="gh-portfolio-media" onerror="this.remove()">') +
            (isVideo?'<div class="gh-portfolio-video-badge"><i class="fas fa-play"></i></div>':'')+
            '<div class="gh-portfolio-hover"><i class="fas fa-heart"></i> '+_fmtCount(p.reactionCount||0)+'  <i class="fas fa-comment"></i> '+_fmtCount(p.commentCount||0)+'</div>'+
          '</div>';
        }).join('')+
      '</div>';
    }).catch(function(err){ var box=document.getElementById('ghPortfolioGrid'); if(box) box.innerHTML='<div class="gh-card gh-empty"><h3>Failed</h3></div>'; });
  };

  window.ghProfileSkills = function(uid, container, isOwn){
    if(!container) return;
    if(!fs()||!db()){ return; }
    fs().getDoc(fs().doc(db(),'users',uid)).then(function(snap){
      if(!snap.exists()) return;
      var data=snap.data()||{};
      var skills=data.skills||[];
      var openCollab=data.openToCollab||false;
      container.innerHTML=
        (openCollab?'<div class="gh-collab-badge"><i class="fas fa-handshake"></i> Open to Collab</div>':'')+
        (skills.length?
          '<div class="gh-skills-row">'+skills.map(function(s){ return '<span class="gh-skill-chip">'+esc(s)+'</span>'; }).join('')+'</div>':
          (isOwn?'<div class="gh-muted" style="font-size:.82rem">No skills added yet.</div>':'')+
        '')+
        (isOwn?
          '<button class="gh-btn ghost sm" style="margin-top:8px" id="ghEditSkillsBtn"><i class="fas fa-pen"></i> Edit Skills</button>':
          '');
      if(isOwn){
        var editBtn=container.querySelector('#ghEditSkillsBtn');
        if(editBtn) editBtn.onclick=function(){
          var current=(data.skills||[]).join(', ');
          var newSkills=window.prompt('Enter skills (comma separated):', current);
          if(newSkills===null) return;
          var arr=newSkills.split(',').map(function(s){ return s.trim(); }).filter(Boolean).slice(0,12);
          fs().updateDoc(fs().doc(db(),'users',uid),{ skills:arr }).then(function(){
            toast('Skills updated!'); ghProfileSkills(uid,container,true);
          }).catch(function(err){ toast('Failed','error'); });
        };
      }
    }).catch(function(){});
  };

  window.ghToggleOpenCollab = function(uid, btn){
    if(!fs()||!db()) return;
    fs().getDoc(fs().doc(db(),'users',uid)).then(function(snap){
      var current=(snap.exists()&&snap.data().openToCollab)||false;
      return fs().updateDoc(fs().doc(db(),'users',uid),{ openToCollab:!current });
    }).then(function(){
      toast(!btn||!btn.dataset.active?'You\'re now open to collab! 🤝':'Collab status removed');
    }).catch(function(err){ toast('Failed','error'); });
  };

  /* ── Phase 70: PWA install prompt + SW sync handler ─────── */
  var _pwaPrompt=null;
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault(); _pwaPrompt=e;
    // Show install banner after 30s if user hasn't dismissed it
    setTimeout(function(){
      if(!_pwaPrompt) return;
      try{ if(localStorage.getItem('gh_pwa_dismissed')) return; }catch(e2){}
      var banner=document.createElement('div');
      banner.id='ghPwaBanner';
      banner.className='gh-pwa-banner';
      banner.innerHTML='<span><i class="fas fa-mobile-screen"></i> Add GeoHub to Home Screen</span>'+
        '<div style="display:flex;gap:6px">'+
          '<button class="gh-btn sm" id="ghPwaInstall">Install</button>'+
          '<button class="gh-btn sm ghost" id="ghPwaDismiss">Not now</button>'+
        '</div>';
      document.body.appendChild(banner);
      requestAnimationFrame(function(){ banner.classList.add('visible'); });
      document.getElementById('ghPwaInstall').onclick=function(){
        if(_pwaPrompt){ _pwaPrompt.prompt(); _pwaPrompt.userChoice.then(function(){ _pwaPrompt=null; banner.remove(); }); }
      };
      document.getElementById('ghPwaDismiss').onclick=function(){
        try{ localStorage.setItem('gh_pwa_dismissed','1'); }catch(e2){}
        banner.remove(); _pwaPrompt=null;
      };
    },30000);
  });
  // Background sync draft listener
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message',function(e){
      if(e.data&&e.data.type==='GH_SYNC_DRAFTS'){
        try{
          var draft=JSON.parse(localStorage.getItem('gh_draft')||'null');
          if(draft&&draft.text&&window.GeoSocial&&window.GeoSocial.createPost){
            toast('🔄 Syncing draft…');
          }
        }catch(se){}
      }
      if(e.data&&e.data.type==='SW_UPDATED'){
        toast('✅ GeoHub updated to latest version!');
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 82 — Story Music Sticker
  ══════════════════════════════════════════════════════════════ */
  // Music button injected into story toolbar via openStoryModal patch
  var _STORY_TRACKS=[
    {id:'tb1',label:'Tbilisi Nights',url:'https://res.cloudinary.com/dw5dqk2w7/video/upload/v1/geohub/audio/tbilisi_nights.mp3',emoji:'🌙'},
    {id:'vb1',label:'Vibrant Georgia',url:'https://res.cloudinary.com/dw5dqk2w7/video/upload/v1/geohub/audio/vibrant_georgia.mp3',emoji:'🇬🇪'},
    {id:'ch1',label:'Chill Vibes',url:'https://res.cloudinary.com/dw5dqk2w7/video/upload/v1/geohub/audio/chill_vibes.mp3',emoji:'🎶'},
    {id:'up1',label:'Upbeat Morning',url:'https://res.cloudinary.com/dw5dqk2w7/video/upload/v1/geohub/audio/upbeat_morning.mp3',emoji:'☀️'},
    {id:'dr1',label:'Deep Feels',url:'https://res.cloudinary.com/dw5dqk2w7/video/upload/v1/geohub/audio/deep_feels.mp3',emoji:'💙'},
    {id:'hype',label:'Hype Energy',url:'https://res.cloudinary.com/dw5dqk2w7/video/upload/v1/geohub/audio/hype_energy.mp3',emoji:'🔥'}
  ];
  window.ghOpenStoryMusic = function(onSelect){
    var body='<div class="gh-music-list">'+
      _STORY_TRACKS.map(function(t){
        return '<button class="gh-music-item" data-track-id="'+esc(t.id)+'" data-track-url="'+esc(t.url)+'" data-track-label="'+esc(t.label)+'">'+
          '<span class="gh-music-emoji">'+t.emoji+'</span>'+
          '<div class="gh-music-info"><strong>'+esc(t.label)+'</strong><span class="gh-muted">GeoHub Music</span></div>'+
          '<button type="button" class="gh-music-preview gh-btn ghost sm" data-preview-url="'+esc(t.url)+'"><i class="fas fa-play"></i></button>'+
          '<button type="button" class="gh-music-pick gh-btn sm" data-pick-url="'+esc(t.url)+'" data-pick-label="'+esc(t.label)+'">Use</button>'+
        '</button>';
      }).join('')+
    '</div>';
    var m=modal('Add Music 🎵',body,'<button class="gh-btn ghost" data-close-modal>Cancel</button>','ghMusicPickerModal');
    var _previewAudio=null;
    if(m) m.addEventListener('click',function(e){
      var prev=e.target.closest('[data-preview-url]');
      if(prev){
        e.stopPropagation();
        if(_previewAudio){ _previewAudio.pause(); _previewAudio=null; prev.innerHTML='<i class="fas fa-play"></i>'; return; }
        _previewAudio=new Audio(prev.dataset.previewUrl);
        _previewAudio.volume=0.5; _previewAudio.play().catch(function(){});
        _previewAudio.onended=function(){ prev.innerHTML='<i class="fas fa-play"></i>'; _previewAudio=null; };
        prev.innerHTML='<i class="fas fa-stop"></i>';
        return;
      }
      var pick=e.target.closest('[data-pick-url]');
      if(pick){
        if(_previewAudio){ _previewAudio.pause(); _previewAudio=null; }
        if(m) m.remove();
        if(onSelect) onSelect({url:pick.dataset.pickUrl, label:pick.dataset.pickLabel});
        return;
      }
    });
  };

  /* Patch openStoryModal to inject Music button after story modal opens */
  var _origOpenStoryModal=window.openStoryModal||null;
  function _patchStoryModalMusic(){
    var toolbar=document.querySelector('#ghStoryModal .gh-cmp-toolbar');
    if(!toolbar||toolbar.querySelector('#ghStoryMusicBtn')) return;
    var musicBtn=document.createElement('button');
    musicBtn.type='button'; musicBtn.id='ghStoryMusicBtn'; musicBtn.className='gh-cmp-tool';
    musicBtn.innerHTML='<i class="fas fa-music"></i><span> Music</span>';
    toolbar.appendChild(musicBtn);
    var _selectedMusic=null;
    var indicator=document.createElement('div');
    indicator.id='ghStoryMusicIndicator'; indicator.className='gh-music-indicator'; indicator.style.display='none';
    toolbar.parentNode.insertBefore(indicator,toolbar.nextSibling);
    musicBtn.onclick=function(){
      window.ghOpenStoryMusic(function(track){
        _selectedMusic=track; musicBtn.classList.add('active');
        indicator.style.display='flex'; indicator.innerHTML='<i class="fas fa-music"></i> <strong>'+esc(track.label)+'</strong> <button type="button" id="ghRemoveMusic" style="background:none;border:none;color:var(--gh-muted);cursor:pointer;font-size:1rem;margin-left:4px">×</button>';
        document.getElementById('ghRemoveMusic').onclick=function(){ _selectedMusic=null; musicBtn.classList.remove('active'); indicator.style.display='none'; };
      });
    };
    // Expose for story submit
    window._getStoryMusic=function(){ return _selectedMusic; };
  }
  // Observer to patch after modal opens
  (function(){
    var _mobs=new MutationObserver(function(muts){
      if(document.getElementById('ghStoryModal')) _patchStoryModalMusic();
    });
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ _mobs.observe(document.body,{childList:true,subtree:false}); });
    else _mobs.observe(document.body,{childList:true,subtree:false});
  })();

  /* ══════════════════════════════════════════════════════════════
     PHASE 83 — Creator Subscriptions
  ══════════════════════════════════════════════════════════════ */
  var _SUB_TIERS=[
    {id:'fan',label:'Fan',price:2,emoji:'⭐',perks:['Early access to posts','Fan badge on comments']},
    {id:'vip',label:'VIP',price:5,emoji:'💎',perks:['All Fan perks','Exclusive VIP-only posts','Direct message priority','Monthly shoutout']},
    {id:'super',label:'Super Fan',price:15,emoji:'👑',perks:['All VIP perks','Monthly 1-on-1 Q&A','Name in creator bio','Co-create one post/month']}
  ];
  window.ghOpenSubscribeModal = function(creatorUid, creatorName){
    if(!requireLogin()) return;
    var u=authUser(); if(!u) return;
    var body=
      '<div style="text-align:center;margin-bottom:16px">'+
        '<div style="font-size:1.5rem;margin-bottom:4px">'+esc(creatorName||'Creator')+'</div>'+
        '<div class="gh-muted" style="font-size:.85rem">Choose a subscription tier</div>'+
      '</div>'+
      '<div class="gh-sub-tiers">'+
      _SUB_TIERS.map(function(t){
        return '<div class="gh-sub-tier" data-tier-id="'+esc(t.id)+'" data-tier-price="'+t.price+'">'+
          '<div class="gh-sub-tier-header">'+
            '<span class="gh-sub-emoji">'+t.emoji+'</span>'+
            '<strong>'+esc(t.label)+'</strong>'+
            '<span class="gh-sub-price">'+t.price+' GEL/mo</span>'+
          '</div>'+
          '<ul class="gh-sub-perks">'+t.perks.map(function(p){ return '<li><i class="fas fa-check" style="color:var(--gh-green);margin-right:6px"></i>'+esc(p)+'</li>'; }).join('')+'</ul>'+
          '<button class="gh-btn" style="width:100%;margin-top:10px" data-sub-tier="'+esc(t.id)+'" data-sub-price="'+t.price+'" data-sub-label="'+esc(t.label)+'">Subscribe — '+t.price+' GEL/mo</button>'+
        '</div>';
      }).join('')+
      '</div>';
    var m=modal('Subscribe to '+esc(creatorName||'Creator'),body,'<button class="gh-btn ghost" data-close-modal>Maybe later</button>','ghSubModal');
    if(!m) return;
    m.addEventListener('click',function(e){
      var btn=e.target.closest('[data-sub-tier]'); if(!btn) return;
      var tier=btn.dataset.subTier; var price=parseInt(btn.dataset.subPrice)||0; var label=btn.dataset.subLabel;
      btn.disabled=true; btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>';
      // Write subscription to Firestore
      var myCoins=0;
      fs().getDoc(fs().doc(db(),'userCoins',u.uid)).then(function(snap){
        myCoins=(snap.exists()?snap.data().coins:0)||0;
        if(myCoins<price){ throw new Error('Not enough GeoCoins. You have '+myCoins+' coins, need '+price+'.'); }
        var batch=fs().writeBatch(db());
        // Debit subscriber
        batch.set(fs().doc(db(),'userCoins',u.uid),{coins:fs().increment(-price)},{merge:true});
        // Credit creator
        batch.set(fs().doc(db(),'userCoins',creatorUid),{coins:fs().increment(price)},{merge:true});
        // Record subscription
        var subRef=fs().doc(db(),'creatorSubscriptions',creatorUid+'_'+u.uid+'_'+tier);
        batch.set(subRef,{
          creatorUid:creatorUid, subscriberUid:u.uid,
          tier:tier, tierLabel:label, priceGEL:price,
          subscribedAt:fs().serverTimestamp(),
          expiresAt:fs().Timestamp.fromDate(new Date(Date.now()+30*86400000)),
          active:true
        },{merge:true});
        return batch.commit();
      }).then(function(){
        toast('🎉 Subscribed as '+label+'!');
        if(m) m.remove();
      }).catch(function(err){ toast((err&&err.message)||'Subscription failed','error'); btn.disabled=false; btn.innerHTML='Subscribe — '+price+' GEL/mo'; });
    });
  };
  window.ghCheckSubscription = function(creatorUid, cb){
    var u=authUser(); if(!u||!fs()||!db()){ if(cb) cb(null); return; }
    fs().getDocs(fs().query(
      fs().collection(db(),'creatorSubscriptions'),
      fs().where('creatorUid','==',creatorUid),
      fs().where('subscriberUid','==',u.uid),
      fs().where('active','==',true),
      fs().limit(1)
    )).then(function(snap){ if(cb) cb(snap.empty?null:snap.docs[0].data()); }).catch(function(){ if(cb) cb(null); });
  };

  /* ══════════════════════════════════════════════════════════════
     PHASE 84 — Business Flash Sale Posts
  ══════════════════════════════════════════════════════════════ */
  window.ghOpenFlashSaleModal = function(bizId, bizName){
    if(!requireLogin()) return;
    var body=
      '<input class="gh-input" id="ghFsTitle" placeholder="Sale title *" maxlength="80" style="margin-bottom:8px">'+
      '<div style="display:flex;gap:8px;margin-bottom:8px">'+
        '<input class="gh-input" id="ghFsOrigPrice" type="number" min="0" placeholder="Original price (₾)" style="flex:1">'+
        '<input class="gh-input" id="ghFsSalePrice" type="number" min="0" placeholder="Sale price (₾)" style="flex:1">'+
      '</div>'+
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">'+
        '<label style="font-size:.85rem;white-space:nowrap">Ends at:</label>'+
        '<input type="datetime-local" class="gh-input" id="ghFsEndsAt" style="flex:1">'+
      '</div>'+
      '<textarea class="gh-textarea" id="ghFsDesc" placeholder="What\'s on sale? (optional)" rows="3" style="margin-bottom:8px"></textarea>'+
      '<input class="gh-input" id="ghFsCoupon" placeholder="Coupon code (optional, e.g. SUMMER20)">';
    modal('⚡ Flash Sale',body,
      '<button class="gh-btn ghost" data-close-modal>Cancel</button>'+
      '<button class="gh-btn" id="ghFsSubmit" style="background:linear-gradient(135deg,#f59e0b,#ef4444)"><i class="fas fa-bolt-lightning"></i> Publish Sale</button>',
      'ghFlashSaleModal');
    var sbtn=document.getElementById('ghFsSubmit'); if(!sbtn) return;
    sbtn.onclick=function(){
      var title=(document.getElementById('ghFsTitle').value||'').trim(); if(!title) return toast('Enter a title','error');
      var orig=parseFloat(document.getElementById('ghFsOrigPrice').value)||0;
      var sale=parseFloat(document.getElementById('ghFsSalePrice').value)||0;
      var endsVal=document.getElementById('ghFsEndsAt').value;
      var discount=orig>0&&sale<orig?Math.round((1-sale/orig)*100):0;
      sbtn.disabled=true; sbtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>';
      var u=authUser(); if(!u){ sbtn.disabled=false; return toast('Sign in required','error'); }
      fs().addDoc(fs().collection(db(),'posts'),{
        text:'⚡ '+title+(discount?' — -'+discount+'% OFF!':''),
        postFormat:{type:'flash_sale',origPrice:orig,salePrice:sale,discount:discount,coupon:(document.getElementById('ghFsCoupon').value||'').trim(),description:(document.getElementById('ghFsDesc').value||'').trim(),endsAt:endsVal?fs().Timestamp.fromDate(new Date(endsVal)):null,title:title},
        authorId:u.uid, authorName:u.displayName||'',
        bizId:bizId, bizName:bizName||'',
        status:'published', type:'flash_sale',
        reactionCount:0, commentCount:0, viewCount:0,
        createdAt:fs().serverTimestamp()
      }).then(function(){
        toast('⚡ Flash Sale live!');
        var m=document.getElementById('ghFlashSaleModal'); if(m) m.remove();
      }).catch(function(err){ toast('Failed: '+(err.message||err.code),'error'); sbtn.disabled=false; sbtn.innerHTML='Publish Sale'; });
    };
  };

  // Flash sale post card renderer (called from postCard if postFormat.type==='flash_sale')
  window.ghRenderFlashSale = function(pf){
    if(!pf||pf.type!=='flash_sale') return '';
    var now=Date.now();
    var ends=pf.endsAt?ts(pf.endsAt):0;
    var msLeft=ends?ends-now:0;
    var expired=ends&&now>ends;
    var timeStr='';
    if(msLeft>0){
      var hrs=Math.floor(msLeft/3600000); var mins=Math.floor((msLeft%3600000)/60000);
      timeStr=hrs>0?hrs+'h '+mins+'m left':mins+'m left';
    }
    return '<div class="gh-flash-sale'+(expired?' expired':'')+'">'+
      '<div class="gh-fs-badge"><i class="fas fa-bolt-lightning"></i> FLASH SALE'+(expired?' — ENDED':'')+'</div>'+
      '<div class="gh-fs-body">'+
        (pf.origPrice&&pf.salePrice?
          '<div class="gh-fs-prices">'+
            '<span class="gh-fs-orig">'+Number(pf.origPrice).toLocaleString()+' ₾</span>'+
            '<span class="gh-fs-sale">'+Number(pf.salePrice).toLocaleString()+' ₾</span>'+
            (pf.discount?'<span class="gh-fs-disc">-'+pf.discount+'%</span>':'')+
          '</div>':'')+
        (pf.description?'<div class="gh-fs-desc">'+esc(pf.description)+'</div>':'')+
        (pf.coupon?'<div class="gh-fs-coupon"><span>Code:</span> <strong>'+esc(pf.coupon)+'</strong> <button class="gh-btn sm ghost" onclick="try{navigator.clipboard.writeText(\''+esc(pf.coupon)+'\');}catch(e){} window.toast&&toast(\'Copied!\')"><i class="fas fa-copy"></i></button></div>':'')+
        (timeStr&&!expired?'<div class="gh-fs-timer"><i class="fas fa-clock"></i> '+esc(timeStr)+'</div>':'')+
      '</div>'+
    '</div>';
  };

  /* ══════════════════════════════════════════════════════════════
     PHASE 85 — Verification Request System
  ══════════════════════════════════════════════════════════════ */
  window.ghOpenVerificationRequest = function(){
    if(!requireLogin()) return;
    var u=authUser(); if(!u) return;
    var body=
      '<div class="gh-verify-intro">'+
        '<i class="fas fa-circle-check" style="font-size:2rem;color:var(--gh-green);display:block;text-align:center;margin-bottom:10px"></i>'+
        '<p style="text-align:center;color:var(--gh-muted);font-size:.88rem;margin-bottom:14px">Apply to get a verified badge on your profile. We review all requests manually.</p>'+
      '</div>'+
      '<input class="gh-input" id="ghVrFullName" placeholder="Full legal name *" style="margin-bottom:8px">'+
      '<select class="gh-select" id="ghVrIdType" style="margin-bottom:8px">'+
        '<option value="">ID type *</option>'+
        '<option value="national_id">National ID Card</option>'+
        '<option value="passport">Passport</option>'+
        '<option value="driving_licence">Driving Licence</option>'+
        '<option value="business_reg">Business Registration</option>'+
      '</select>'+
      '<input class="gh-input" id="ghVrLinks" placeholder="Instagram/Twitter/website URL (optional)" style="margin-bottom:8px">'+
      '<select class="gh-select" id="ghVrCategory" style="margin-bottom:8px">'+
        '<option value="">Account category *</option>'+
        '<option value="creator">Creator / Influencer</option>'+
        '<option value="business">Business / Brand</option>'+
        '<option value="journalist">Journalist / Media</option>'+
        '<option value="public_figure">Public Figure</option>'+
        '<option value="nonprofit">Non-profit / Government</option>'+
      '</select>'+
      '<textarea class="gh-textarea" id="ghVrReason" placeholder="Why should you be verified? (explain your notability, audience size, etc.)" rows="3"></textarea>';
    modal('Apply for Verification',body,
      '<button class="gh-btn ghost" data-close-modal>Cancel</button>'+
      '<button class="gh-btn" id="ghVrSubmit"><i class="fas fa-paper-plane"></i> Submit Request</button>',
      'ghVerifyModal');
    var sbtn=document.getElementById('ghVrSubmit'); if(!sbtn) return;
    sbtn.onclick=function(){
      var name=(document.getElementById('ghVrFullName').value||'').trim();
      var idType=document.getElementById('ghVrIdType').value;
      var cat=document.getElementById('ghVrCategory').value;
      if(!name||!idType||!cat) return toast('Fill in all required fields','error');
      sbtn.disabled=true; sbtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>';
      fs().addDoc(fs().collection(db(),'verificationRequests'),{
        uid:u.uid, displayName:u.displayName||'', email:u.email||'',
        fullName:name, idType:idType, category:cat,
        links:(document.getElementById('ghVrLinks').value||'').trim(),
        reason:(document.getElementById('ghVrReason').value||'').trim(),
        status:'pending', createdAt:fs().serverTimestamp()
      }).then(function(){
        toast('✅ Request submitted! We\'ll review within 7 days.');
        var m=document.getElementById('ghVerifyModal'); if(m) m.remove();
      }).catch(function(err){ toast('Failed: '+(err.message||err.code),'error'); sbtn.disabled=false; sbtn.innerHTML='Submit Request'; });
    };
  };

  /* ══════════════════════════════════════════════════════════════
     PHASE 87 — Group DM / Chat Rooms
  ══════════════════════════════════════════════════════════════ */
  window.ghOpenGroupChatModal = function(){
    if(!requireLogin()) return;
    var u=authUser(); if(!u) return;
    var body=
      '<input class="gh-input" id="ghGcName" placeholder="Chat room name (e.g. Kazbegi Hikers) *" maxlength="60" style="margin-bottom:8px">'+
      '<div id="ghGcMemberSearch" style="margin-bottom:8px">'+
        '<div class="gh-coa-search-row">'+
          '<i class="fas fa-user-plus" style="color:var(--gh-green);flex-shrink:0"></i>'+
          '<input class="gh-input" id="ghGcMembersInp" placeholder="Search people to add…" autocomplete="off">'+
        '</div>'+
        '<div id="ghGcSearchResults" class="gh-coa-results"></div>'+
        '<div id="ghGcSelectedChips" class="gh-coa-chips"></div>'+
      '</div>'+
      '<input class="gh-input" id="ghGcAvatar" placeholder="Group icon URL (optional)">';
    modal('New Group Chat',body,
      '<button class="gh-btn ghost" data-close-modal>Cancel</button>'+
      '<button class="gh-btn" id="ghGcSubmit"><i class="fas fa-users"></i> Create Chat</button>',
      'ghGroupChatModal');
    var _members={}; // uid → {uid,name,avatar}
    var inp=document.getElementById('ghGcMembersInp');
    var resultsBox=document.getElementById('ghGcSearchResults');
    var chipsBox=document.getElementById('ghGcSelectedChips');
    if(inp&&resultsBox){
      var _gctimer=null;
      inp.oninput=function(){
        clearTimeout(_gctimer); var q=this.value.trim(); if(!q){ resultsBox.innerHTML=''; return; }
        _gctimer=setTimeout(function(){
          if(!fs()||!db()){ return; }
          fs().getDocs(fs().query(fs().collection(db(),'users'),fs().orderBy('fullName'),fs().startAt(q),fs().endAt(q+''),fs().limit(6))).then(function(snap){
            var html=''; snap.forEach(function(d){
              if(d.id===u.uid||_members[d.id]) return;
              var data=d.data(); var name=data.fullName||data.displayName||'User'; var av=data.avatar||data.photoURL||'';
              html+='<div class="gh-coa-item" data-add-uid="'+esc(d.id)+'" data-add-name="'+esc(name)+'" data-add-av="'+esc(av)+'">'+
                '<span class="gh-avatar sm">'+(av?'<img src="'+esc(av)+'" alt="">':esc((name[0]||'U').toUpperCase()))+'</span>'+
                '<span>'+esc(name)+'</span>'+
              '</div>';
            });
            resultsBox.innerHTML=html||'<div class="gh-coa-item gh-muted">No results</div>';
          }).catch(function(){});
        },300);
      };
      resultsBox.addEventListener('click',function(e){
        var item=e.target.closest('[data-add-uid]'); if(!item) return;
        var uid2=item.dataset.addUid, name=item.dataset.addName, av=item.dataset.addAv;
        _members[uid2]={uid:uid2,name:name,avatar:av};
        _renderGcChips(); resultsBox.innerHTML=''; inp.value='';
      });
    }
    function _renderGcChips(){
      if(!chipsBox) return;
      chipsBox.innerHTML=Object.values(_members).map(function(m){
        return '<span class="gh-coa-chip">'+esc(m.name)+'<button type="button" data-remove-uid="'+esc(m.uid)+'">×</button></span>';
      }).join('');
      chipsBox.querySelectorAll('[data-remove-uid]').forEach(function(b){
        b.onclick=function(){ delete _members[b.dataset.removeUid]; _renderGcChips(); };
      });
    }
    var sbtn=document.getElementById('ghGcSubmit'); if(!sbtn) return;
    sbtn.onclick=function(){
      var name=(document.getElementById('ghGcName').value||'').trim(); if(!name) return toast('Enter a chat name','error');
      var memberIds=Object.keys(_members); if(!memberIds.length) return toast('Add at least one member','error');
      sbtn.disabled=true; sbtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>';
      var allMembers=[u.uid].concat(memberIds);
      fs().addDoc(fs().collection(db(),'groupChats'),{
        name:name, members:allMembers,
        adminUid:u.uid, adminName:u.displayName||'',
        avatarUrl:(document.getElementById('ghGcAvatar').value||'').trim(),
        lastMessage:'', lastMessageAt:fs().serverTimestamp(),
        createdAt:fs().serverTimestamp()
      }).then(function(ref){
        toast('💬 Group chat created!');
        var m=document.getElementById('ghGroupChatModal'); if(m) m.remove();
        if(ref&&ref.id) setTimeout(function(){ location.href='messages.html?group='+encodeURIComponent(ref.id); },400);
      }).catch(function(err){ toast('Failed: '+(err.message||err.code),'error'); sbtn.disabled=false; sbtn.innerHTML='Create Chat'; });
    };
  };

  /* ══════════════════════════════════════════════════════════════
     PHASE 88 — Check-ins & Location Tags
  ══════════════════════════════════════════════════════════════ */
  window.ghOpenLocationPicker = function(onSelect){
    var body=
      '<div id="ghLocPermRow" style="text-align:center;padding:8px 0;margin-bottom:8px">'+
        '<button class="gh-btn" id="ghLocGpsBtn"><i class="fas fa-location-crosshairs"></i> Use my location</button>'+
        '<div class="gh-muted" style="font-size:.8rem;margin-top:6px">or type a place name below</div>'+
      '</div>'+
      '<div class="gh-coa-search-row" style="margin-bottom:8px">'+
        '<i class="fas fa-search" style="color:var(--gh-muted)"></i>'+
        '<input class="gh-input" id="ghLocSearch" placeholder="Search Georgia places…" autocomplete="off">'+
      '</div>'+
      '<div id="ghLocResults" class="gh-loc-results"></div>';
    var m=modal('📍 Tag Location',body,'<button class="gh-btn ghost" data-close-modal>Cancel</button>','ghLocPickerModal');
    var _GEO_PLACES=[
      {name:'Tbilisi',city:'Tbilisi',lat:41.6941,lng:44.8337,icon:'🏙️'},
      {name:'Narikala Fortress, Tbilisi',city:'Tbilisi',lat:41.6842,lng:44.8103,icon:'🏰'},
      {name:'Rustaveli Avenue',city:'Tbilisi',lat:41.6941,lng:44.8001,icon:'🛍️'},
      {name:'Old Town (Kala)',city:'Tbilisi',lat:41.6888,lng:44.8094,icon:'🕌'},
      {name:'Fabrika, Tbilisi',city:'Tbilisi',lat:41.7026,lng:44.7906,icon:'☕'},
      {name:'Kazbegi (Stepantsminda)',city:'Kazbegi',lat:42.6590,lng:44.6355,icon:'🏔️'},
      {name:'Gergeti Trinity Church',city:'Kazbegi',lat:42.6573,lng:44.6355,icon:'⛪'},
      {name:'Batumi',city:'Batumi',lat:41.6168,lng:41.6367,icon:'🌊'},
      {name:'Kutaisi',city:'Kutaisi',lat:42.2679,lng:42.6972,icon:'🏛️'},
      {name:'Mtskheta',city:'Mtskheta',lat:41.8454,lng:44.7202,icon:'🙏'},
      {name:'Sighnaghi',city:'Kakheti',lat:41.6169,lng:45.9211,icon:'🍷'},
      {name:'Vardzia Cave Monastery',city:'Samtskhe',lat:41.3782,lng:43.2797,icon:'⛏️'},
      {name:'Svaneti, Mestia',city:'Svaneti',lat:43.0485,lng:42.7220,icon:'🗻'},
      {name:'Borjomi',city:'Samtskhe-Javakheti',lat:41.8361,lng:43.3823,icon:'💧'},
      {name:'Anaklia',city:'Samegrelo',lat:42.3756,lng:41.5611,icon:'🏖️'}
    ];
    var gpsBtn=document.getElementById('ghLocGpsBtn');
    var searchInp=document.getElementById('ghLocSearch');
    var results=document.getElementById('ghLocResults');
    function _renderPlaces(places){
      if(!results) return;
      results.innerHTML=places.map(function(p){
        return '<div class="gh-loc-item" data-loc-name="'+esc(p.name)+'" data-loc-city="'+esc(p.city||'')+'" data-loc-lat="'+p.lat+'" data-loc-lng="'+p.lng+'">'+
          '<span class="gh-loc-icon">'+p.icon+'</span>'+
          '<div><strong>'+esc(p.name)+'</strong><div class="gh-muted" style="font-size:.78rem">'+esc(p.city||'')+'</div></div>'+
        '</div>';
      }).join('')||'<div class="gh-muted" style="font-size:.82rem;padding:8px">No places found</div>';
      results.querySelectorAll('.gh-loc-item').forEach(function(item){
        item.addEventListener('click',function(){
          if(m) m.remove();
          if(onSelect) onSelect({name:item.dataset.locName,city:item.dataset.locCity,lat:parseFloat(item.dataset.locLat)||0,lng:parseFloat(item.dataset.locLng)||0});
        });
      });
    }
    _renderPlaces(_GEO_PLACES.slice(0,8));
    if(searchInp) searchInp.oninput=function(){
      var q=this.value.trim().toLowerCase();
      if(!q){ _renderPlaces(_GEO_PLACES.slice(0,8)); return; }
      _renderPlaces(_GEO_PLACES.filter(function(p){ return p.name.toLowerCase().indexOf(q)>-1||p.city.toLowerCase().indexOf(q)>-1; }));
    };
    if(gpsBtn) gpsBtn.onclick=function(){
      gpsBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Detecting…'; gpsBtn.disabled=true;
      navigator.geolocation.getCurrentPosition(function(pos){
        var lat=pos.coords.latitude, lng=pos.coords.longitude;
        if(m) m.remove();
        if(onSelect) onSelect({name:'My Location',city:'',lat:lat,lng:lng});
      },function(){ gpsBtn.innerHTML='<i class="fas fa-location-crosshairs"></i> Use my location'; gpsBtn.disabled=false; toast('Location access denied','error'); });
    };
  };

  // Inject location tag button into post composer
  (function _injectLocTagButton(){
    var _mobs2=new MutationObserver(function(){
      var toolbar=document.querySelector('#ghPostModal .gh-cmp-toolbar');
      if(!toolbar||toolbar.querySelector('#ghLocTagBtn')) return;
      var btn=document.createElement('button');
      btn.type='button'; btn.id='ghLocTagBtn'; btn.className='gh-cmp-tool';
      btn.innerHTML='<i class="fas fa-location-dot"></i><span> Location</span>';
      toolbar.appendChild(btn);
      var indicator=document.createElement('div');
      indicator.id='ghLocIndicator'; indicator.className='gh-loc-indicator'; indicator.style.display='none';
      toolbar.parentNode.insertBefore(indicator,toolbar.nextSibling);
      btn.onclick=function(){
        window.ghOpenLocationPicker(function(loc){
          window._composerLocation=loc;
          btn.classList.add('active');
          indicator.style.display='flex';
          indicator.innerHTML='<i class="fas fa-location-dot"></i> '+esc(loc.name)+
            ' <button type="button" id="ghRemoveLoc" style="background:none;border:none;color:var(--gh-muted);cursor:pointer;margin-left:4px;font-size:1rem">×</button>';
          document.getElementById('ghRemoveLoc').onclick=function(){ window._composerLocation=null; btn.classList.remove('active'); indicator.style.display='none'; };
        });
      };
    });
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ _mobs2.observe(document.body,{childList:true,subtree:false}); });
    else _mobs2.observe(document.body,{childList:true,subtree:false});
  })();

  /* ══════════════════════════════════════════════════════════════
     PHASE 89 — Fundraiser / Donation Posts
  ══════════════════════════════════════════════════════════════ */
  window.ghOpenFundraiserModal = function(){
    if(!requireLogin()) return;
    var u=authUser(); if(!u) return;
    var body=
      '<input class="gh-input" id="ghFrTitle" placeholder="Fundraiser title *" maxlength="100" style="margin-bottom:8px">'+
      '<textarea class="gh-textarea" id="ghFrStory" placeholder="Tell your story — why are you raising funds?" rows="4" style="margin-bottom:8px"></textarea>'+
      '<div style="display:flex;gap:8px;margin-bottom:8px">'+
        '<input class="gh-input" id="ghFrGoal" type="number" min="1" placeholder="Goal amount (₾) *" style="flex:1">'+
        '<select class="gh-select" id="ghFrCategory" style="flex:1">'+
          '<option value="personal">Personal emergency</option>'+
          '<option value="medical">Medical</option>'+
          '<option value="education">Education</option>'+
          '<option value="community">Community project</option>'+
          '<option value="animal">Animal rescue</option>'+
          '<option value="environment">Environment</option>'+
          '<option value="business">Small business</option>'+
        '</select>'+
      '</div>'+
      '<input class="gh-input" id="ghFrCoverUrl" placeholder="Cover image URL (optional)">';
    modal('💝 Create Fundraiser',body,
      '<button class="gh-btn ghost" data-close-modal>Cancel</button>'+
      '<button class="gh-btn" id="ghFrSubmit" style="background:linear-gradient(135deg,#ec4899,#8b5cf6)"><i class="fas fa-hand-holding-heart"></i> Start Fundraiser</button>',
      'ghFundraiserModal');
    var sbtn=document.getElementById('ghFrSubmit'); if(!sbtn) return;
    sbtn.onclick=function(){
      var title=(document.getElementById('ghFrTitle').value||'').trim(); if(!title) return toast('Enter a title','error');
      var goal=parseFloat(document.getElementById('ghFrGoal').value)||0; if(!goal) return toast('Enter a goal amount','error');
      var story=(document.getElementById('ghFrStory').value||'').trim();
      sbtn.disabled=true; sbtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>';
      fs().addDoc(fs().collection(db(),'posts'),{
        text:'💝 '+title+(story?'\n\n'+story:''),
        postFormat:{type:'fundraiser',title:title,goal:goal,raised:0,category:(document.getElementById('ghFrCategory').value)||'personal',coverUrl:(document.getElementById('ghFrCoverUrl').value||'').trim()},
        authorId:u.uid, authorName:u.displayName||'',
        status:'published', type:'fundraiser',
        reactionCount:0, commentCount:0, viewCount:0,
        createdAt:fs().serverTimestamp()
      }).then(function(){
        toast('💝 Fundraiser is live!');
        var m=document.getElementById('ghFundraiserModal'); if(m) m.remove();
      }).catch(function(err){ toast('Failed: '+(err.message||err.code),'error'); sbtn.disabled=false; sbtn.innerHTML='Start Fundraiser'; });
    };
  };

  window.ghRenderFundraiser = function(pf, postId){
    if(!pf||pf.type!=='fundraiser') return '';
    var goal=pf.goal||0; var raised=pf.raised||0;
    var pct=goal>0?Math.min(100,Math.round(raised/goal*100)):0;
    return '<div class="gh-fundraiser">'+
      '<div class="gh-fr-header"><i class="fas fa-hand-holding-heart" style="color:#ec4899"></i> <strong>Fundraiser</strong><span class="gh-chip" style="font-size:.7rem;margin-left:6px">'+esc(pf.category||'')+'</span></div>'+
      (pf.coverUrl?'<img src="'+esc(pf.coverUrl)+'" alt="" style="width:100%;max-height:180px;object-fit:cover;border-radius:10px;margin:8px 0">':'')+
      '<div class="gh-fr-amounts">'+
        '<span class="gh-fr-raised">'+Number(raised).toLocaleString()+' ₾ raised</span>'+
        '<span class="gh-fr-goal"> of '+Number(goal).toLocaleString()+' ₾ goal</span>'+
      '</div>'+
      '<div class="gh-fr-bar"><div class="gh-fr-fill" style="width:'+pct+'%"></div></div>'+
      '<div class="gh-fr-meta">'+pct+'% funded</div>'+
      '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">'+
        '<button class="gh-btn" style="background:linear-gradient(135deg,#ec4899,#8b5cf6);flex:1" data-donate-post="'+esc(postId||'')+'"><i class="fas fa-heart"></i> Donate</button>'+
        '<button class="gh-btn ghost sm" onclick="if(navigator.share)navigator.share({url:location.href});else{try{navigator.clipboard.writeText(location.href);}catch(e){} window.toast&&toast(\'Copied!\');}"><i class="fas fa-share"></i></button>'+
      '</div>'+
    '</div>';
  };

  // Donate to fundraiser
  document.addEventListener('click',function(e){
    var btn=e.target.closest('[data-donate-post]'); if(!btn) return;
    if(!requireLogin()) return;
    var postId=btn.dataset.donatePost; if(!postId) return;
    var amt=window.prompt('Donate amount (₾):'); if(!amt) return;
    var amount=parseInt(amt)||0; if(amount<1) return toast('Enter valid amount','error');
    var u=authUser(); if(!u) return;
    fs().getDoc(fs().doc(db(),'userCoins',u.uid)).then(function(snap){
      var coins=(snap.exists()?snap.data().coins:0)||0;
      if(coins<amount) throw new Error('Not enough coins ('+coins+' available)');
      var batch=fs().writeBatch(db());
      batch.set(fs().doc(db(),'userCoins',u.uid),{coins:fs().increment(-amount)},{merge:true});
      batch.update(fs().doc(db(),'posts',postId),{
        'postFormat.raised':fs().increment(amount),
        donationCount:fs().increment(1)
      });
      batch.set(fs().doc(db(),'donations',postId+'_'+u.uid+'_'+Date.now()),{
        postId:postId, donorUid:u.uid, amount:amount, createdAt:fs().serverTimestamp()
      });
      return batch.commit();
    }).then(function(){ toast('💝 Thank you for donating '+amount+' GEL!'); })
    .catch(function(err){ toast((err&&err.message)||'Donation failed','error'); });
  });

  /* ══════════════════════════════════════════════════════════════
     PHASE 90 — Admin Dashboard Enhancement
  ══════════════════════════════════════════════════════════════ */
  function renderAdmin(){
    var u=authUser();
    // Auth gate — must be logged in
    if(!u){ requireLogin(); return; }
    // Render shell immediately, then verify admin role via Firestore
    shell({ active:'admin',
      center:
        '<div class="gh-admin-page" id="ghAdminPage">'+
          '<div class="gh-card" style="padding:16px">'+
            '<h2 style="margin:0 0 4px;font-size:1.05rem"><i class="fas fa-user-shield"></i> Admin Dashboard</h2>'+
            '<p class="gh-muted" style="font-size:.82rem;margin:0">Platform management & moderation</p>'+
          '</div>'+
          '<div class="gh-admin-tabs gh-pill-row" id="ghAdminTabs" hidden>'+
            '<button class="gh-pill active" data-atab="overview">Overview</button>'+
            '<button class="gh-pill" data-atab="users">Users</button>'+
            '<button class="gh-pill" data-atab="reports">Reports</button>'+
            '<button class="gh-pill" data-atab="verifications">Verifications</button>'+
            '<button class="gh-pill" data-atab="posts">Posts</button>'+
          '</div>'+
          '<div id="ghAdminContent"><div class="gh-card gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div></div>'+
        '</div>'
    });
    ready(function(){
      // Verify admin role in Firestore before showing anything
      if(!fs()||!db()){ document.getElementById('ghAdminContent').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-lock"></i><p>Firebase not available.</p></div>'; return; }
      fs().getDoc(fs().doc(db(),'users',u.uid)).then(function(snap){
        var role=(snap.exists()&&snap.data().role)||'user';
        if(role!=='admin'&&role!=='moderator'){
          document.getElementById('ghAdminContent').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-ban" style="color:#ef4444;font-size:2rem"></i><p style="margin-top:8px;font-weight:600">Access Denied</p><p class="gh-muted" style="font-size:.85rem">You do not have permission to view this page.</p></div>';
          return;
        }
        var tabsEl=document.getElementById('ghAdminTabs');
        if(tabsEl) tabsEl.removeAttribute('hidden');
        _startAdmin();
      }).catch(function(){
        document.getElementById('ghAdminContent').innerHTML='<div class="gh-card gh-empty"><i class="fas fa-exclamation-triangle" style="color:#f59e0b"></i><p>Could not verify admin role.</p></div>';
      });
      function _startAdmin(){
      var tabs=document.getElementById('ghAdminTabs');
      var content=document.getElementById('ghAdminContent');
      if(!tabs||!content) return;
      var _tab='overview';
      function _loadTab(t){
        _tab=t; content.innerHTML='<div class="gh-card gh-empty" style="min-height:80px"><i class="fas fa-circle-notch fa-spin"></i></div>';
        if(t==='overview') _renderOverview();
        else if(t==='users') _renderUsers();
        else if(t==='reports') _renderReports();
        else if(t==='verifications') _renderVerifications();
        else if(t==='posts') _renderAdminPosts();
      }
      tabs.addEventListener('click',function(e){
        var b=e.target.closest('[data-atab]'); if(!b) return;
        tabs.querySelectorAll('.gh-pill').forEach(function(p){ p.classList.toggle('active',p===b); });
        _loadTab(b.dataset.atab);
      });
      function _renderOverview(){
        Promise.all([
          fs().getDoc(fs().doc(db(),'platformStats','main')).catch(function(){ return null; }),
          fs().getDocs(fs().query(fs().collection(db(),'posts'),fs().where('status','!=','deleted'),fs().orderBy('status'),fs().orderBy('createdAt','desc'),fs().limit(1))).catch(function(){ return {docs:[]}; }),
          fs().getDocs(fs().query(fs().collection(db(),'verificationRequests'),fs().where('status','==','pending'),fs().limit(1))).catch(function(){ return {docs:[]}; }),
          fs().getDocs(fs().query(fs().collection(db(),'reportedContent'),fs().where('status','==','open'),fs().limit(1))).catch(function(){ return {docs:[]}; })
        ]).then(function(res){
          var stats=(res[0]&&res[0].exists()?res[0].data():{})||{};
          var pendingVr=res[2].docs.length; var openReports=res[3].docs.length;
          content.innerHTML=
            '<div class="gh-admin-stats">'+
              '<div class="gh-admin-stat"><div class="gh-analytics-val">'+_fmtCount(stats.totalUsers||0)+'</div><div class="gh-analytics-lbl"><i class="fas fa-users"></i> Total Users</div></div>'+
              '<div class="gh-admin-stat"><div class="gh-analytics-val">'+_fmtCount(stats.totalPosts||0)+'</div><div class="gh-analytics-lbl"><i class="fas fa-newspaper"></i> Posts</div></div>'+
              '<div class="gh-admin-stat"><div class="gh-analytics-val">'+_fmtCount(stats.totalBusinesses||0)+'</div><div class="gh-analytics-lbl"><i class="fas fa-store"></i> Businesses</div></div>'+
              '<div class="gh-admin-stat"><div class="gh-analytics-val">'+_fmtCount(stats.totalGroups||0)+'</div><div class="gh-analytics-lbl"><i class="fas fa-users-rectangle"></i> Groups</div></div>'+
              '<div class="gh-admin-stat'+(pendingVr?' urgent':'')+'"><div class="gh-analytics-val" style="color:'+(pendingVr?'#f59e0b':'var(--gh-green)')+'">'+pendingVr+'</div><div class="gh-analytics-lbl"><i class="fas fa-circle-check"></i> Pending Verifications</div></div>'+
              '<div class="gh-admin-stat'+(openReports?' urgent':'')+'"><div class="gh-analytics-val" style="color:'+(openReports?'#ef4444':'var(--gh-green)')+'">'+openReports+'</div><div class="gh-analytics-lbl"><i class="fas fa-flag"></i> Open Reports</div></div>'+
            '</div>'+
            '<div class="gh-card" style="margin-top:10px">'+
              '<h3 style="font-size:.9rem;margin:0 0 10px"><i class="fas fa-bolt-lightning" style="color:#f59e0b"></i> Quick Actions</h3>'+
              '<div style="display:flex;flex-wrap:wrap;gap:8px">'+
                '<button class="gh-btn ghost sm" onclick="document.querySelector(\'[data-atab=reports]\').click()"><i class="fas fa-flag"></i> Review Reports</button>'+
                '<button class="gh-btn ghost sm" onclick="document.querySelector(\'[data-atab=verifications]\').click()"><i class="fas fa-circle-check"></i> Verifications</button>'+
                '<button class="gh-btn ghost sm" onclick="document.querySelector(\'[data-atab=users]\').click()"><i class="fas fa-users"></i> Manage Users</button>'+
                '<button class="gh-btn ghost sm" onclick="document.querySelector(\'[data-atab=posts]\').click()"><i class="fas fa-newspaper"></i> Moderate Posts</button>'+
              '</div>'+
            '</div>';
        }).catch(function(err){ content.innerHTML='<div class="gh-card gh-empty"><h3>Failed</h3><p>'+esc(err.message||'Check admin permissions')+'</p></div>'; });
      }
      function _renderUsers(){
        fs().getDocs(fs().query(fs().collection(db(),'users'),fs().orderBy('createdAt','desc'),fs().limit(20))).then(function(snap){
          var users=[]; snap.forEach(function(d){ users.push(Object.assign({id:d.id},d.data())); });
          content.innerHTML=
            '<div class="gh-card"><h3 style="font-size:.9rem;margin:0 0 10px">Recent Users</h3>'+
            '<div class="gh-admin-user-list">'+
            users.map(function(u2){
              var name=u2.fullName||u2.displayName||'User'; var av=u2.avatar||u2.photoURL||'';
              var banned=u2.banned||u2.disabled||false;
              return '<div class="gh-admin-user-row">'+
                '<span class="gh-avatar sm">'+(av?'<img src="'+esc(av)+'" alt="">':esc((name[0]||'U').toUpperCase()))+'</span>'+
                '<div class="gh-admin-user-info"><strong>'+esc(name)+'</strong><span class="gh-muted" style="font-size:.75rem">'+esc(u2.email||u2.id)+'</span></div>'+
                '<div style="display:flex;gap:6px;flex-shrink:0">'+
                  (u2.verified?'<span class="gh-chip" style="font-size:.72rem;color:var(--gh-green)"><i class="fas fa-circle-check"></i></span>':'')+
                  '<button class="gh-btn sm '+(banned?'':'ghost')+'" data-admin-ban="'+esc(u2.id)+'" data-ban-state="'+banned+'" style="'+(banned?'color:#ef4444':'')+'">'+
                    (banned?'Unban':'Ban')+
                  '</button>'+
                  '<button class="gh-btn sm ghost" data-admin-verify-user="'+esc(u2.id)+'" title="Toggle verified">'+
                    '<i class="fas fa-'+(u2.verified?'check-circle':'circle')+'"></i>'+
                  '</button>'+
                '</div>'+
              '</div>';
            }).join('')+
            '</div></div>';
          content.querySelectorAll('[data-admin-ban]').forEach(function(btn){
            btn.onclick=function(){
              var uid2=btn.dataset.adminBan; var currentBanned=btn.dataset.banState==='true';
              if(!confirm((currentBanned?'Unban':'Ban')+' this user?')) return;
              btn.disabled=true;
              fs().updateDoc(fs().doc(db(),'users',uid2),{banned:!currentBanned}).then(function(){
                toast((currentBanned?'User unbanned':'User banned'));
                _renderUsers();
              }).catch(function(err){ toast('Failed: '+(err.message||err.code),'error'); btn.disabled=false; });
            };
          });
          content.querySelectorAll('[data-admin-verify-user]').forEach(function(btn){
            btn.onclick=function(){
              var uid2=btn.dataset.adminVerifyUser;
              fs().getDoc(fs().doc(db(),'users',uid2)).then(function(snap){
                var current=(snap.exists()&&snap.data().verified)||false;
                return fs().updateDoc(fs().doc(db(),'users',uid2),{verified:!current,verifiedAt:!current?fs().serverTimestamp():null});
              }).then(function(){ toast('Verification status updated'); _renderUsers(); }).catch(function(err){ toast('Failed','error'); });
            };
          });
        }).catch(function(err){ content.innerHTML='<div class="gh-card gh-empty"><h3>'+(typeof GHt==='function'?GHt('users_fail'):'Failed to load users')+'</h3><p>'+esc(err.message||'Check permissions')+'</p></div>'; });
      }
      function _renderReports(){
        fs().getDocs(fs().query(fs().collection(db(),'reportedContent'),fs().where('status','==','open'),fs().orderBy('status'),fs().orderBy('createdAt','desc'),fs().limit(15))).then(function(snap){
          var reports=[]; snap.forEach(function(d){ reports.push(Object.assign({id:d.id},d.data())); });
          if(!reports.length){ content.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-flag"></i><h3>No open reports</h3><p>All clear!</p></div>'; return; }
          content.innerHTML='<div class="gh-card"><h3 style="font-size:.9rem;margin:0 0 10px">Open Reports ('+reports.length+')</h3>'+
            '<div class="gh-admin-report-list">'+
            reports.map(function(r){
              return '<div class="gh-admin-report-row" data-report-id="'+esc(r.id)+'">'+
                '<div class="gh-admin-report-info">'+
                  '<strong>'+esc(r.reason||'No reason')+'</strong>'+
                  '<div class="gh-muted" style="font-size:.75rem">Type: '+esc(r.contentType||'post')+' · '+esc(r.contentId||'')+'</div>'+
                  (r.reporterNote?'<div style="font-size:.8rem;margin-top:2px">'+esc(r.reporterNote.slice(0,80))+'</div>':'')+
                '</div>'+
                '<div style="display:flex;gap:6px;flex-shrink:0">'+
                  '<a class="gh-btn sm ghost" href="feed.html#post-'+esc(r.contentId||'')+'" target="_blank">View</a>'+
                  '<button class="gh-btn sm" data-resolve-report="'+esc(r.id)+'" style="background:#10b981">Resolve</button>'+
                  '<button class="gh-btn sm ghost" data-delete-content="'+esc(r.contentId||'')+'" data-content-type="'+esc(r.contentType||'post')+'" style="color:#ef4444">Delete</button>'+
                '</div>'+
              '</div>';
            }).join('')+
            '</div></div>';
          content.querySelectorAll('[data-resolve-report]').forEach(function(btn){
            btn.onclick=function(){
              fs().updateDoc(fs().doc(db(),'reportedContent',btn.dataset.resolveReport),{status:'resolved',resolvedAt:fs().serverTimestamp()}).then(function(){ _renderReports(); }).catch(function(){});
            };
          });
          content.querySelectorAll('[data-delete-content]').forEach(function(btn){
            btn.onclick=function(){
              window.ghConfirm('Delete this content? This is irreversible.', function(){
                var type=btn.dataset.contentType||'post'; var id=btn.dataset.deleteContent;
                var col=type==='post'?'posts':type==='comment'?'comments':type;
                fs().updateDoc(fs().doc(db(),col,id),{status:'deleted'}).then(function(){ toast('Content deleted'); _renderReports(); }).catch(function(err){ toast('Failed: '+(err.message||''),'error'); });
              });
            };
          });
        }).catch(function(err){ content.innerHTML='<div class="gh-card gh-empty"><h3>Failed</h3><p>'+esc(err.message||'Check admin permissions')+'</p></div>'; });
      }
      function _renderVerifications(){
        fs().getDocs(fs().query(fs().collection(db(),'verificationRequests'),fs().where('status','==','pending'),fs().orderBy('status'),fs().orderBy('createdAt','desc'),fs().limit(15))).then(function(snap){
          var reqs=[]; snap.forEach(function(d){ reqs.push(Object.assign({id:d.id},d.data())); });
          if(!reqs.length){ content.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-circle-check"></i><h3>No pending verifications</h3></div>'; return; }
          content.innerHTML='<div class="gh-card"><h3 style="font-size:.9rem;margin:0 0 10px">Pending Verifications ('+reqs.length+')</h3>'+
            '<div class="gh-admin-report-list">'+
            reqs.map(function(r){
              return '<div class="gh-admin-report-row">'+
                '<div class="gh-admin-report-info">'+
                  '<strong>'+esc(r.fullName||r.displayName||'User')+'</strong>'+
                  '<div class="gh-muted" style="font-size:.75rem">'+esc(r.category||'')+' · ID: '+esc(r.idType||'')+'</div>'+
                  (r.reason?'<div style="font-size:.8rem;margin-top:2px">'+esc(r.reason.slice(0,100))+'</div>':'')+
                  (r.links?'<div style="font-size:.78rem"><a href="'+esc(r.links)+'" target="_blank" rel="noopener" style="color:var(--gh-green)">'+esc(r.links.slice(0,40))+'</a></div>':'')+
                '</div>'+
                '<div style="display:flex;gap:6px;flex-shrink:0">'+
                  '<button class="gh-btn sm" data-approve-vr="'+esc(r.id)+'" data-vr-uid="'+esc(r.uid||'')+'" style="background:#10b981"><i class="fas fa-check"></i> Approve</button>'+
                  '<button class="gh-btn sm ghost" data-reject-vr="'+esc(r.id)+'" style="color:#ef4444">Reject</button>'+
                '</div>'+
              '</div>';
            }).join('')+
            '</div></div>';
          content.querySelectorAll('[data-approve-vr]').forEach(function(btn){
            btn.onclick=function(){
              var reqId=btn.dataset.approveVr; var uid2=btn.dataset.vrUid;
              btn.disabled=true;
              var batch=fs().writeBatch(db());
              batch.update(fs().doc(db(),'verificationRequests',reqId),{status:'approved',reviewedAt:fs().serverTimestamp()});
              if(uid2) batch.update(fs().doc(db(),'users',uid2),{verified:true,verifiedAt:fs().serverTimestamp()});
              batch.commit().then(function(){ toast('✅ User verified!'); _renderVerifications(); }).catch(function(err){ toast('Failed','error'); btn.disabled=false; });
            };
          });
          content.querySelectorAll('[data-reject-vr]').forEach(function(btn){
            btn.onclick=function(){
              var reqId=btn.dataset.rejectVr;
              fs().updateDoc(fs().doc(db(),'verificationRequests',reqId),{status:'rejected',reviewedAt:fs().serverTimestamp()}).then(function(){ _renderVerifications(); }).catch(function(){});
            };
          });
        }).catch(function(err){ content.innerHTML='<div class="gh-card gh-empty"><h3>Failed</h3><p>'+esc(err.message||'Check permissions')+'</p></div>'; });
      }
      function _renderAdminPosts(){
        fs().getDocs(fs().query(fs().collection(db(),'posts'),fs().where('status','==','published'),fs().orderBy('createdAt','desc'),fs().limit(15))).then(function(snap){
          var posts=[]; snap.forEach(function(d){ posts.push(Object.assign({id:d.id},d.data())); });
          content.innerHTML='<div class="gh-card"><h3 style="font-size:.9rem;margin:0 0 10px">Recent Posts</h3>'+
            '<div class="gh-admin-post-list">'+
            posts.map(function(p){
              var txt=(p.text||'').slice(0,80); var author=p.authorName||'User';
              return '<div class="gh-admin-report-row">'+
                '<div class="gh-admin-report-info">'+
                  '<strong>'+esc(author)+'</strong>'+
                  '<div style="font-size:.82rem;margin-top:2px;color:var(--gh-muted)">'+esc(txt||'[media post]')+'</div>'+
                '</div>'+
                '<div style="display:flex;gap:6px;flex-shrink:0">'+
                  '<a class="gh-btn sm ghost" href="feed.html#post-'+esc(p.id)+'" target="_blank">View</a>'+
                  '<button class="gh-btn sm ghost" data-admin-del-post="'+esc(p.id)+'" style="color:#ef4444">Delete</button>'+
                '</div>'+
              '</div>';
            }).join('')+
            '</div></div>';
          content.querySelectorAll('[data-admin-del-post]').forEach(function(btn){
            btn.onclick=function(){
              var pid2=btn.dataset.adminDelPost;
              window.ghConfirm('Delete post? Irreversible.', function(){
                fs().updateDoc(fs().doc(db(),'posts',pid2),{status:'deleted'}).then(function(){ toast('Post deleted'); _renderAdminPosts(); }).catch(function(err){ toast('Failed','error'); });
              });
            };
          });
        }).catch(function(err){ content.innerHTML='<div class="gh-card gh-empty"><h3>Failed</h3><p>'+esc(err.message||'Check permissions')+'</p></div>'; });
      }
      _loadTab('overview');
      } // end _startAdmin
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 91 — Event Ticketing (QR Code)
  ══════════════════════════════════════════════════════════════ */
  window.ghGetEventTicket = function(evId, evName){
    if(!requireLogin()) return;
    var u=authUser(); if(!u) return;
    var ticketRef=fs().doc(db(),'events',evId,'tickets',u.uid);
    fs().getDoc(ticketRef).then(function(snap){
      var ticket=snap.exists()?snap.data():null;
      if(!ticket){
        return fs().setDoc(ticketRef,{
          uid:u.uid, name:u.displayName||'', email:u.email||'',
          eventId:evId, eventName:evName,
          ticketCode:'GH-'+evId.slice(0,6).toUpperCase()+'-'+u.uid.slice(0,4).toUpperCase()+'-'+Date.now().toString(36).toUpperCase(),
          purchasedAt:fs().serverTimestamp(), status:'active'
        }).then(function(){ return fs().getDoc(ticketRef); }).then(function(s){ return s.data(); });
      }
      return ticket;
    }).then(function(t){
      // Load QRCode.js dynamically
      function _showQR(code){
        var body='<div class="gh-ticket-modal">'+
          '<div class="gh-ticket-header"><i class="fas fa-ticket"></i> <strong>Your Ticket</strong></div>'+
          '<div class="gh-ticket-event">'+esc(evName||'Event')+'</div>'+
          '<div id="ghQrCanvas" class="gh-ticket-qr"></div>'+
          '<div class="gh-ticket-code">'+esc(code)+'</div>'+
          '<div class="gh-muted" style="font-size:.75rem;margin-top:8px;text-align:center">Show this QR code at the venue entrance</div>'+
        '</div>';
        modal('🎟️ Event Ticket',body,'<button class="gh-btn ghost" data-close-modal>Close</button><button class="gh-btn" onclick="if(navigator.share)navigator.share({title:\''+esc(evName)+' Ticket\',text:\'Ticket code: '+esc(code)+'\'}).catch(function(){});else{try{navigator.clipboard.writeText(\''+esc(code)+'\');}catch(e){} window.toast&&toast(\'Code copied!\');}"><i class="fas fa-share"></i> Share</button>','ghTicketModal');
        // QR generation using canvas
        setTimeout(function(){
          var canvas=document.getElementById('ghQrCanvas');
          if(!canvas) return;
          // Simple QR-like pattern using canvas (placeholder without external library)
          var c=document.createElement('canvas'); c.width=140; c.height=140;
          var ctx=c.getContext('2d');
          ctx.fillStyle='#fff'; ctx.fillRect(0,0,140,140);
          ctx.fillStyle='#04050d';
          // Encode as a simple grid pattern based on code hash
          var hash=0; for(var i=0;i<code.length;i++) hash=(hash*31+code.charCodeAt(i))&0xffffffff;
          var cellSize=10; var cells=12;
          for(var row=0;row<cells;row++){
            for(var col=0;col<cells;col++){
              if(((hash>>(row%32))^(hash>>(col%32)))&1){
                ctx.fillRect(col*cellSize+10,row*cellSize+10,cellSize-1,cellSize-1);
              }
            }
          }
          // Corner markers
          [[0,0],[0,9],[9,0]].forEach(function(pos){
            ctx.strokeStyle='#04050d'; ctx.lineWidth=2;
            ctx.strokeRect(pos[1]*cellSize+10,pos[0]*cellSize+10,cellSize*3,cellSize*3);
            ctx.fillRect(pos[1]*cellSize+14,pos[0]*cellSize+14,cellSize*2-4,cellSize*2-4);
          });
          canvas.innerHTML=''; canvas.appendChild(c);
        },100);
      }
      _showQR(t.ticketCode||'GH-TICKET');
    }).catch(function(err){ toast('Ticket error: '+(err&&err.message||''),'error'); });
  };

  /* ══════════════════════════════════════════════════════════════
     PHASE 92 — Content Calendar (Scheduled Posts View)
  ══════════════════════════════════════════════════════════════ */
  window.ghRenderContentCalendar = function(container){
    if(!container) return;
    var u=authUser();
    if(!u){ container.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-lock"></i><h3>Sign in to view your calendar</h3></div>'; return; }
    container.innerHTML='<div class="gh-cal-header"><i class="fas fa-calendar-days"></i> Content Calendar <span class="gh-chip" style="font-size:.72rem">Scheduled</span></div><div id="ghCalList"><i class="fas fa-circle-notch fa-spin"></i></div>';
    if(!fs()||!db()){ container.innerHTML='<div class="gh-card gh-empty"><h3>Unavailable</h3></div>'; return; }
    fs().getDocs(fs().query(
      fs().collection(db(),'posts'),
      fs().where('authorId','==',u.uid),
      fs().where('status','==','scheduled'),
      fs().orderBy('scheduledAt','asc'),
      fs().limit(20)
    )).then(function(snap){
      var posts=[]; snap.forEach(function(d){ posts.push(Object.assign({id:d.id},d.data())); });
      var box=container.querySelector('#ghCalList');
      if(!box) return;
      if(!posts.length){ box.innerHTML='<div class="gh-muted" style="font-size:.85rem;padding:8px">No scheduled posts. Use the post composer → Schedule button to plan ahead.</div>'; return; }
      box.innerHTML=posts.map(function(p){
        var d=p.scheduledAt?new Date(ts(p.scheduledAt)):null;
        var dateStr=d?d.toLocaleDateString('ka-GE',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'Unknown';
        var isNear=d&&(d-Date.now())<3600000;
        return '<div class="gh-cal-item'+(isNear?' near':'')+'">'+
          '<div class="gh-cal-dot"></div>'+
          '<div class="gh-cal-info">'+
            '<div class="gh-cal-date"><i class="fas fa-clock"></i> '+esc(dateStr)+'</div>'+
            '<div class="gh-cal-text">'+esc((p.text||'[media post]').slice(0,60))+'</div>'+
          '</div>'+
          '<button class="gh-btn sm ghost" data-del-scheduled="'+esc(p.id)+'" title="Cancel"><i class="fas fa-times"></i></button>'+
        '</div>';
      }).join('');
      box.querySelectorAll('[data-del-scheduled]').forEach(function(btn){
        btn.onclick=function(){
          var sid=btn.dataset.delScheduled;
          window.ghConfirm(typeof GHt==='function'?GHt('scheduled_cancel_cfm'):'Cancel this scheduled post?', function(){
            fs().updateDoc(fs().doc(db(),'posts',sid),{status:'draft'}).then(function(){ window.ghRenderContentCalendar(container); }).catch(function(){});
          });
        };
      });
    }).catch(function(err){ var b=container.querySelector('#ghCalList'); if(b) b.innerHTML='<div class="gh-muted">Failed: '+esc(err.message||'')+'</div>'; });
  };

  /* ══════════════════════════════════════════════════════════════
     PHASE 93 — GeoHub Premium
  ══════════════════════════════════════════════════════════════ */
  var _PREMIUM_FEATURES=[
    {icon:'🚀',title:'Boost any post',desc:'Promote your posts to 10x more people'},
    {icon:'📊',title:'Advanced Analytics',desc:'Deep insights: reach, demographics, best time to post'},
    {icon:'🎨',title:'Profile Themes',desc:'Exclusive colour schemes & profile customisation'},
    {icon:'✅',title:'Priority Verification',desc:'Fast-track your verified badge application'},
    {icon:'💬',title:'Unlimited Group Chats',desc:'Create unlimited group rooms (free: 3 max)'},
    {icon:'🏪',title:'Marketplace Pro',desc:'Unlimited listings + featured placement'},
    {icon:'🤖',title:'GeoAI Pro',desc:'Unlimited AI assistant queries per day'},
    {icon:'🔕',title:'Ad-free experience',desc:'No sponsored content in your feed'}
  ];
  function renderPremium(){
    var _pt=typeof GHt==='function'?GHt:function(k){return k;};
    shell({ active:'premium',
      center:
        '<div class="gh-premium-page">'+
          '<div class="gh-premium-hero">'+
            '<div class="gh-premium-crown">👑</div>'+
            '<h1>GeoHub <span style="background:linear-gradient(135deg,#f59e0b,#ec4899);-webkit-background-clip:text;color:transparent">Premium</span></h1>'+
            '<p class="gh-muted">Unlock the full power of GeoHub. Support local creators and get exclusive features.</p>'+
          '</div>'+
          '<div class="gh-premium-plans">'+
            '<div class="gh-premium-plan">'+
              '<div class="gh-premium-plan-name">'+_pt('prem_monthly')+'</div>'+
              '<div class="gh-premium-price">9.99 <span>'+_pt('prem_per_month')+'</span></div>'+
              '<button class="gh-btn" id="ghPremMonthly" style="width:100%;background:linear-gradient(135deg,#f59e0b,#ec4899)">'+_pt('prem_start_monthly')+'</button>'+
            '</div>'+
            '<div class="gh-premium-plan featured">'+
              '<div class="gh-premium-badge">'+_pt('prem_best_value')+'</div>'+
              '<div class="gh-premium-plan-name">'+_pt('prem_yearly')+'</div>'+
              '<div class="gh-premium-price">79 <span>'+_pt('prem_per_year')+'</span></div>'+
              '<div class="gh-muted" style="font-size:.75rem;margin-bottom:10px">'+_pt('prem_save')+'</div>'+
              '<button class="gh-btn" id="ghPremYearly" style="width:100%;background:linear-gradient(135deg,#f59e0b,#ec4899)">'+_pt('prem_start_yearly')+'</button>'+
            '</div>'+
          '</div>'+
          '<div class="gh-premium-features">'+
            '<h3 style="margin:0 0 14px;font-size:.95rem">'+_pt('prem_included')+'</h3>'+
            '<div class="gh-premium-feature-grid">'+
              _PREMIUM_FEATURES.map(function(f){
                return '<div class="gh-premium-feature">'+
                  '<span class="gh-premium-f-icon">'+f.icon+'</span>'+
                  '<div><strong>'+esc(f.title)+'</strong><div class="gh-muted" style="font-size:.78rem">'+esc(f.desc)+'</div></div>'+
                '</div>';
              }).join('')+
            '</div>'+
          '</div>'+
          '<p class="gh-muted" style="font-size:.78rem;text-align:center;margin-top:16px">'+_pt('prem_cancel')+' Payment via GeoCoins or card integration (coming soon).</p>'+
        '</div>'
    });
    ready(function(){
      function _startPremium(plan, price){
        if(!requireLogin()) return;
        var u=authUser(); if(!u) return;
        fs().getDoc(fs().doc(db(),'userCoins',u.uid)).then(function(snap){
          var coins=(snap.exists()?snap.data().coins:0)||0;
          if(coins<price){ toast('Not enough GeoCoins ('+coins+' available, need '+price+')','error'); return; }
          return fs().writeBatch(db()).then ? (function(){
            var batch=fs().writeBatch(db());
            batch.set(fs().doc(db(),'userCoins',u.uid),{coins:fs().increment(-price)},{merge:true});
            batch.set(fs().doc(db(),'premiumUsers',u.uid),{
              plan:plan, price:price, uid:u.uid,
              startedAt:fs().serverTimestamp(),
              expiresAt:fs().Timestamp.fromDate(new Date(Date.now()+(plan==='yearly'?365:30)*86400000)),
              active:true
            },{merge:true});
            return batch.commit();
          })() : Promise.reject(new Error('Batch unavailable'));
        }).then(function(){ toast('👑 Welcome to GeoHub Premium!'); }).catch(function(err){ toast((err&&err.message)||'Failed','error'); });
      }
      var mb=document.getElementById('ghPremMonthly'); if(mb) mb.onclick=function(){ _startPremium('monthly',99); };
      var yb=document.getElementById('ghPremYearly');  if(yb) yb.onclick=function(){ _startPremium('yearly',790); };
    });
  }
  window.ghCheckPremium=function(cb){
    var u=authUser(); if(!u||!fs()||!db()){ if(cb) cb(false); return; }
    fs().getDoc(fs().doc(db(),'premiumUsers',u.uid)).then(function(snap){
      var active=snap.exists()&&snap.data().active&&ts(snap.data().expiresAt)>Date.now();
      if(cb) cb(active);
    }).catch(function(){ if(cb) cb(false); });
  };

  /* ══════════════════════════════════════════════════════════════
     PHASE 94 — Post Translation (ka / en / ru)
  ══════════════════════════════════════════════════════════════ */
  var _TRANSLATE_PAIRS={
    'გამარჯობა':'Hello / Привет',
    'მადლობა':'Thank you / Спасибо',
    'სიყვარული':'Love / Любовь',
    'ლამაზი':'Beautiful / Красивый',
    'საქართველო':'Georgia / Грузия',
    'თბილისი':'Tbilisi / Тбилиси',
    'კვება':'Food / Еда',
    'სოფელი':'Village / Деревня',
    'მთა':'Mountain / Гора',
    'ზღვა':'Sea / Море'
  };
  window.ghTranslatePost=function(pid, textEl, btn){
    if(!textEl||!pid) return;
    var original=textEl.dataset.originalText||textEl.textContent;
    if(!textEl.dataset.originalText) textEl.dataset.originalText=original;
    var lang=btn.dataset.translateTo||'en';
    if(btn.dataset.showing===lang){ // toggle back
      textEl.textContent=original; delete btn.dataset.showing;
      btn.textContent='Translate'; return;
    }
    btn.textContent='…'; btn.disabled=true;
    // Use Google Translate API via free endpoint
    var q=encodeURIComponent(original);
    var targetLang=lang==='ru'?'ru':'en';
    fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='+targetLang+'&dt=t&q='+q)
      .then(function(r){ return r.json(); })
      .then(function(data){
        var translated=''; ((data&&data[0])||[]).forEach(function(chunk){ if(chunk&&chunk[0]) translated+=chunk[0]; });
        if(translated){ textEl.textContent=translated; btn.dataset.showing=lang; btn.textContent='Original'; }
        else { btn.textContent='Translate'; }
      })
      .catch(function(){
        // Fallback: simple word substitution
        var result=original;
        Object.keys(_TRANSLATE_PAIRS).forEach(function(k){ result=result.replace(new RegExp(k,'g'),_TRANSLATE_PAIRS[k].split(' / ')[lang==='ru'?1:0]||k); });
        textEl.textContent=result; btn.dataset.showing=lang; btn.textContent='Original';
      })
      .finally(function(){ btn.disabled=false; });
  };

  /* Inject translate button into each post card via delegation */
  document.addEventListener('click',function(e){
    var tb=e.target.closest('[data-translate-btn]'); if(!tb) return;
    var pid=tb.dataset.translateBtn;
    var card=tb.closest('[data-post-id="'+pid+'"]')||tb.closest('.gh-post');
    var textEl=card&&card.querySelector('.gh-post-text');
    window.ghTranslatePost(pid,textEl,tb);
  });

  /* ══════════════════════════════════════════════════════════════
     PHASE 95 — Trending Hashtags Widget
  ══════════════════════════════════════════════════════════════ */
  window.ghLoadTrendingHashtags=function(container){
    if(!container) return;
    container.innerHTML='<div class="gh-muted" style="font-size:.82rem"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>';
    if(!fs()||!db()){ container.innerHTML=''; return; }
    fs().getDocs(fs().query(
      fs().collection(db(),'posts'),
      fs().where('status','!=','deleted'),
      fs().orderBy('status'),
      fs().orderBy('createdAt','desc'),
      fs().limit(60)
    )).then(function(snap){
      var counts={};
      snap.forEach(function(d){
        var text=d.data().text||'';
        var tags=text.match(/#[\wა-ჿ]+/g)||[];
        tags.forEach(function(t){ var k=t.toLowerCase(); counts[k]=(counts[k]||0)+1; });
      });
      var sorted=Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; }).slice(0,8);
      if(!sorted.length){ container.innerHTML='<div class="gh-muted" style="font-size:.82rem">No hashtags yet</div>'; return; }
      container.innerHTML=sorted.map(function(tag,i){
        return '<a class="gh-trend-tag" href="search.html?q='+encodeURIComponent(tag)+'" style="--rank:'+(i+1)+'">'+
          '<span class="gh-trend-rank">'+(i+1)+'</span>'+
          '<div class="gh-trend-info"><strong>'+esc(tag)+'</strong><span class="gh-muted">'+counts[tag]+' posts</span></div>'+
          '<i class="fas fa-arrow-trend-up" style="color:var(--gh-green);font-size:.75rem;flex-shrink:0"></i>'+
        '</a>';
      }).join('');
    }).catch(function(){ container.innerHTML=''; });
  };

  /* ══════════════════════════════════════════════════════════════
     PHASE 96 — Social Commerce (Shop Now CTA)
  ══════════════════════════════════════════════════════════════ */
  window.ghRenderShopNow=function(post){
    if(!post||!post.id) return '';
    var mktId=post.marketplaceId||post.listingId||'';
    var price=post.price||(post.postFormat&&post.postFormat.salePrice)||0;
    if(!mktId&&!price) return '';
    return '<div class="gh-shop-now-bar">'+
      (price?'<span class="gh-shop-price">'+Number(price).toLocaleString()+' ₾</span>':'')+
      '<a class="gh-btn sm" href="'+(mktId?'marketplace.html#listing-'+esc(mktId):'marketplace.html')+'" style="background:linear-gradient(135deg,#10b981,#3b82f6)"><i class="fas fa-bag-shopping"></i> Shop Now</a>'+
      '<button class="gh-btn sm ghost" data-wishlist="'+esc(post.id)+'" title="Save to wishlist"><i class="fas fa-bookmark"></i></button>'+
    '</div>';
  };
  // Wishlist toggle
  document.addEventListener('click',function(e){
    var wb=e.target.closest('[data-wishlist]'); if(!wb) return;
    if(!requireLogin()) return;
    var u=authUser(); if(!u) return;
    var pid=wb.dataset.wishlist;
    fs().setDoc(fs().doc(db(),'wishlists',u.uid+'_'+pid),{
      uid:u.uid, postId:pid, savedAt:fs().serverTimestamp()
    },{merge:true}).then(function(){ toast('💾 Saved to wishlist'); wb.querySelector('i').className='fas fa-bookmark'; wb.style.color='var(--gh-green)'; }).catch(function(){});
  });

  /* ══════════════════════════════════════════════════════════════
     PHASE 97 — Story Archive (own expired stories)
  ══════════════════════════════════════════════════════════════ */
  window.ghLoadStoryArchive=function(uid, container){
    if(!container) return;
    container.innerHTML='<div class="gh-card gh-empty" style="min-height:60px"><i class="fas fa-circle-notch fa-spin"></i></div>';
    if(!fs()||!db()){ container.innerHTML='<div class="gh-card gh-empty"><h3>Unavailable</h3></div>'; return; }
    var now=fs().Timestamp.fromDate(new Date());
    fs().getDocs(fs().query(
      fs().collection(db(),'stories'),
      fs().where('authorId','==',uid),
      fs().orderBy('createdAt','desc'),
      fs().limit(30)
    )).then(function(snap){
      var archived=[]; snap.forEach(function(d){
        var st=Object.assign({id:d.id},d.data());
        var exp=st.expiresAt?ts(st.expiresAt):0;
        if(exp&&exp<Date.now()) archived.push(st);
      });
      if(!archived.length){ container.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-clock-rotate-left"></i><h3>No archived stories</h3><p>Stories stay here after they expire (24h)</p></div>'; return; }
      container.innerHTML=
        '<div class="gh-archive-grid">'+
        archived.map(function(st){
          var img=st.mediaUrl||''; var text=st.text||'';
          var dateStr=st.createdAt?new Date(ts(st.createdAt)).toLocaleDateString('ka-GE',{month:'short',day:'numeric'}):'';
          return '<div class="gh-archive-item" data-arch-story="'+esc(st.id)+'">'+
            (img?'<img src="'+esc(img)+'" alt="" loading="lazy">':'<div class="gh-archive-text-thumb">'+esc(text.slice(0,30))+'</div>')+
            '<div class="gh-archive-date">'+esc(dateStr)+'</div>'+
          '</div>';
        }).join('')+
        '</div>';
      container.querySelectorAll('[data-arch-story]').forEach(function(card){
        card.onclick=function(){ if(typeof openStoryModal==='function') openStoryModal(card.dataset.archStory); };
      });
    }).catch(function(err){ container.innerHTML='<div class="gh-card gh-empty"><h3>Failed</h3><p>'+esc(err.message||'')+'</p></div>'; });
  };

  /* ══════════════════════════════════════════════════════════════
     PHASE 98 — Accessibility Settings
  ══════════════════════════════════════════════════════════════ */
  (function _initAccessibility(){
    var _prefs={}; try{ _prefs=JSON.parse(localStorage.getItem('gh_a11y')||'{}'); }catch(e){}
    function _applyPrefs(p){
      var root=document.documentElement;
      root.style.setProperty('--gh-font-scale',p.fontSize||1);
      if(p.highContrast) root.setAttribute('data-gh-contrast','high'); else root.removeAttribute('data-gh-contrast');
      if(p.reducedMotion) root.setAttribute('data-gh-motion','reduced'); else root.removeAttribute('data-gh-motion');
    }
    _applyPrefs(_prefs);
    window.ghOpenAccessibility=function(){
      var body=
        '<div class="gh-a11y-panel">'+
          '<div class="gh-a11y-row">'+
            '<label class="gh-a11y-lbl"><i class="fas fa-text-height"></i> Font Size</label>'+
            '<div class="gh-a11y-size-row">'+
              '<button class="gh-btn sm ghost gh-a11y-size-btn" data-size="0.9">A-</button>'+
              '<button class="gh-btn sm ghost gh-a11y-size-btn active" data-size="1">A</button>'+
              '<button class="gh-btn sm ghost gh-a11y-size-btn" data-size="1.15">A+</button>'+
              '<button class="gh-btn sm ghost gh-a11y-size-btn" data-size="1.3">A++</button>'+
            '</div>'+
          '</div>'+
          '<div class="gh-a11y-row">'+
            '<label class="gh-a11y-lbl"><i class="fas fa-circle-half-stroke"></i> High Contrast</label>'+
            '<label class="gh-toggle"><input type="checkbox" id="ghA11yContrast"'+((_prefs.highContrast)?' checked':'')+'><span class="gh-toggle-slider"></span></label>'+
          '</div>'+
          '<div class="gh-a11y-row">'+
            '<label class="gh-a11y-lbl"><i class="fas fa-wind"></i> Reduced Motion</label>'+
            '<label class="gh-toggle"><input type="checkbox" id="ghA11yMotion"'+((_prefs.reducedMotion)?' checked':'')+'><span class="gh-toggle-slider"></span></label>'+
          '</div>'+
          '<div class="gh-a11y-row">'+
            '<label class="gh-a11y-lbl"><i class="fas fa-moon"></i> Dark Mode</label>'+
            '<label class="gh-toggle"><input type="checkbox" id="ghA11yDark"'+(document.documentElement.getAttribute('data-gh-theme')!=='light'?' checked':'')+'><span class="gh-toggle-slider"></span></label>'+
          '</div>'+
        '</div>';
      modal('♿ Accessibility',body,'<button class="gh-btn ghost" data-close-modal>Done</button>','ghA11yModal');
      var m=document.getElementById('ghA11yModal'); if(!m) return;
      m.querySelectorAll('.gh-a11y-size-btn').forEach(function(btn){
        if(parseFloat(btn.dataset.size)===(_prefs.fontSize||1)) btn.classList.add('active');
        btn.onclick=function(){
          m.querySelectorAll('.gh-a11y-size-btn').forEach(function(b){ b.classList.remove('active'); });
          btn.classList.add('active');
          _prefs.fontSize=parseFloat(btn.dataset.size); _applyPrefs(_prefs);
          try{ localStorage.setItem('gh_a11y',JSON.stringify(_prefs)); }catch(e){}
        };
      });
      var contrastChk=document.getElementById('ghA11yContrast');
      if(contrastChk) contrastChk.onchange=function(){ _prefs.highContrast=this.checked; _applyPrefs(_prefs); try{ localStorage.setItem('gh_a11y',JSON.stringify(_prefs)); }catch(e){} };
      var motionChk=document.getElementById('ghA11yMotion');
      if(motionChk) motionChk.onchange=function(){ _prefs.reducedMotion=this.checked; _applyPrefs(_prefs); try{ localStorage.setItem('gh_a11y',JSON.stringify(_prefs)); }catch(e){} };
      var darkChk=document.getElementById('ghA11yDark');
      if(darkChk) darkChk.onchange=function(){
        var theme=this.checked?'dark':'light';
        document.documentElement.setAttribute('data-gh-theme',theme);
        try{ localStorage.setItem('gh_theme',theme); }catch(e){}
      };
    };
  })();

  /* ══════════════════════════════════════════════════════════════
     PHASE 99 — Invite Friends System
  ══════════════════════════════════════════════════════════════ */
  window.ghOpenInviteModal=function(){
    var u=authUser();
    var inviteCode=u?'GH'+u.uid.slice(0,8).toUpperCase():'GEOHUB';
    var inviteUrl=location.origin+'/auth.html?ref='+inviteCode;
    var body=
      '<div class="gh-invite-panel">'+
        '<div class="gh-invite-hero">🎁</div>'+
        '<h3 style="text-align:center;margin-bottom:6px">Invite your friends to GeoHub</h3>'+
        '<p class="gh-muted" style="text-align:center;font-size:.85rem;margin-bottom:16px">You earn <strong style="color:var(--gh-green)">+100 XP</strong> for each friend who joins!</p>'+
        '<div class="gh-invite-link-row">'+
          '<input class="gh-input" id="ghInviteLinkInp" value="'+esc(inviteUrl)+'" readonly>'+
          '<button class="gh-btn" id="ghCopyInvite"><i class="fas fa-copy"></i></button>'+
        '</div>'+
        '<div class="gh-invite-share-row">'+
          '<button class="gh-btn ghost" id="ghShareWhatsapp"><img src="https://cdn.simpleicons.org/whatsapp/25D366" style="width:18px;height:18px;vertical-align:middle;margin-right:6px">WhatsApp</button>'+
          '<button class="gh-btn ghost" id="ghShareTelegram"><img src="https://cdn.simpleicons.org/telegram/26A5E4" style="width:18px;height:18px;vertical-align:middle;margin-right:6px">Telegram</button>'+
          '<button class="gh-btn ghost" id="ghShareNative"><i class="fas fa-share"></i> More</button>'+
        '</div>'+
        (u?
          '<div class="gh-invite-stats" id="ghInviteStats"><i class="fas fa-circle-notch fa-spin"></i> Loading stats…</div>':
          '<div class="gh-muted" style="font-size:.82rem;text-align:center">Sign in to track your referrals and earn XP</div>')+
      '</div>';
    modal('🎁 Invite Friends',body,'<button class="gh-btn ghost" data-close-modal>Close</button>','ghInviteModal');
    var m=document.getElementById('ghInviteModal'); if(!m) return;
    var copyBtn=document.getElementById('ghCopyInvite');
    if(copyBtn) copyBtn.onclick=function(){ try{ navigator.clipboard.writeText(inviteUrl); }catch(e){} toast('🔗 Invite link copied!'); };
    var wa=document.getElementById('ghShareWhatsapp');
    if(wa) wa.onclick=function(){ window.open('https://wa.me/?text='+encodeURIComponent('Join me on GeoHub — Discover Georgia! 🇬🇪 '+inviteUrl),'_blank'); };
    var tg=document.getElementById('ghShareTelegram');
    if(tg) tg.onclick=function(){ window.open('https://t.me/share/url?url='+encodeURIComponent(inviteUrl)+'&text='+encodeURIComponent('Join me on GeoHub!'),'_blank'); };
    var nat=document.getElementById('ghShareNative');
    if(nat) nat.onclick=function(){
      if(navigator.share) navigator.share({title:'Join GeoHub',text:'Discover Georgia with me!',url:inviteUrl}).catch(function(){});
      else{ try{ navigator.clipboard.writeText(inviteUrl); }catch(e){} toast('Link copied!'); }
    };
    // Load invite stats
    if(u){
      var statsBox=document.getElementById('ghInviteStats');
      if(statsBox&&fs()&&db()){
        fs().getDocs(fs().query(fs().collection(db(),'referrals'),fs().where('referrerCode','==',inviteCode),fs().limit(20))).then(function(snap){
          statsBox.innerHTML=
            '<div class="gh-invite-stat-row">'+
              '<span><i class="fas fa-users"></i> Friends joined</span>'+
              '<strong>'+snap.size+'</strong>'+
            '</div>'+
            '<div class="gh-invite-stat-row">'+
              '<span><i class="fas fa-star"></i> XP earned from invites</span>'+
              '<strong style="color:var(--gh-green)">'+(snap.size*100)+' XP</strong>'+
            '</div>';
        }).catch(function(){ statsBox.innerHTML=''; });
      }
    }
  };
  // Track referral on auth page load
  (function _trackReferral(){
    var ref=new URLSearchParams(location.search).get('ref');
    if(!ref||!ref.startsWith('GH')) return;
    try{ localStorage.setItem('gh_ref_code',ref); }catch(e){}
  })();

  /* ══════════════════════════════════════════════════════════════
     PHASE 100 — Onboarding Tour (New User Walkthrough)
  ══════════════════════════════════════════════════════════════ */
  var _TOUR_STEPS=[
    {target:'[data-nav-item="feed"],[href="feed.html"]',title:'🏠 Your Feed',body:'This is your home feed. See posts from people you follow and trending content from Georgia.'},
    {target:'[data-create-post],.gh-composer-trigger',title:'✍️ Create Posts',body:'Tap here to share photos, videos, polls, and more with your followers.'},
    {target:'[data-nav-item="explore"],[href="explore.html"]',title:'🔍 Discover',body:'Find new people, businesses, places and events across Georgia.'},
    {target:'[data-nav-item="events"],[href="events.html"]',title:'🎉 Events',body:'Discover what\'s happening near you and RSVP to events.'},
    {target:'[data-nav-item="marketplace"],[href="marketplace.html"]',title:'🛍️ Marketplace',body:'Buy and sell items locally. Georgia\'s trusted classifieds platform.'},
    {target:'#ghNotifBadge,[data-nav-item="notifications"]',title:'🔔 Notifications',body:'Stay updated on likes, comments, follows, and messages in real-time.'},
    {target:'[data-nav-item="assistant"],[href="assistant.html"]',title:'🤖 GeoAI',body:'Your AI travel and lifestyle assistant. Ask anything about Georgia!'},
  ];
  window.ghStartOnboardingTour=function(){
    try{ if(localStorage.getItem('gh_tour_done')) return; }catch(e){}
    var _step=0;
    var overlay=document.createElement('div'); overlay.id='ghTourOverlay'; overlay.className='gh-tour-overlay';
    var tooltip=document.createElement('div'); tooltip.id='ghTourTooltip'; tooltip.className='gh-tour-tooltip';
    document.body.appendChild(overlay); document.body.appendChild(tooltip);
    function _showStep(i){
      var step=_TOUR_STEPS[i]; if(!step){ _endTour(); return; }
      var target=document.querySelector(step.target);
      tooltip.innerHTML=
        '<div class="gh-tour-step-count">'+(i+1)+' / '+_TOUR_STEPS.length+'</div>'+
        '<div class="gh-tour-title">'+step.title+'</div>'+
        '<div class="gh-tour-body">'+esc(step.body)+'</div>'+
        '<div class="gh-tour-btns">'+
          '<button class="gh-btn ghost sm" id="ghTourSkip">Skip tour</button>'+
          (i>0?'<button class="gh-btn sm ghost" id="ghTourPrev">Back</button>':'')+
          '<button class="gh-btn sm" id="ghTourNext">'+(i===_TOUR_STEPS.length-1?'Finish 🎉':'Next →')+'</button>'+
        '</div>';
      if(target){
        var rect=target.getBoundingClientRect();
        var scrollTop=window.pageYOffset||document.documentElement.scrollTop;
        var top=rect.bottom+scrollTop+12;
        var left=Math.max(12,Math.min(rect.left,window.innerWidth-280));
        tooltip.style.top=top+'px'; tooltip.style.left=left+'px';
        target.style.position='relative'; target.style.zIndex='10001';
      } else {
        tooltip.style.top='50%'; tooltip.style.left='50%'; tooltip.style.transform='translate(-50%,-50%)';
      }
      document.getElementById('ghTourNext').onclick=function(){ if(target){target.style.zIndex='';target.style.position='';} _step++; _showStep(_step); };
      var pb=document.getElementById('ghTourPrev'); if(pb) pb.onclick=function(){ if(target){target.style.zIndex='';target.style.position='';} _step--; _showStep(_step); };
      document.getElementById('ghTourSkip').onclick=_endTour;
    }
    function _endTour(){
      overlay.remove(); tooltip.remove();
      try{ localStorage.setItem('gh_tour_done','1'); }catch(e){}
      toast('🎉 You\'re all set! Welcome to GeoHub!');
      // Award XP for completing tour
      var u=authUser();
      if(u&&fs()&&db()) fs().setDoc(fs().doc(db(),'userXP',u.uid),{xp:fs().increment(50),tourCompleted:true},{merge:true}).catch(function(){});
    }
    overlay.onclick=_endTour;
    setTimeout(function(){ _showStep(0); },500);
  };
  // Auto-start tour for new users
  (function _autoTour(){
    function _tryTour(){
      try{ if(localStorage.getItem('gh_tour_done')) return; }catch(e){}
      if(PATH==='feed.html'||PATH==='index.html'||PAGE==='feed'){
        setTimeout(function(){
          var u=authUser();
          if(u) window.ghStartOnboardingTour();
        },3000);
      }
    }
    window.addEventListener('GeoAuthReady',_tryTour,{once:true});
  })();

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
