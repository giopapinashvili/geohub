/* GeoHub Social Redesign v2
   Self-contained app shell for feed/discover/groups/business pages.
   Uses Firebase Auth + Firestore through window.GeoFirebase and window.GeoSocial.
*/
(function(){
  'use strict';

  var PATH = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var PAGE = document.body && document.body.dataset ? document.body.dataset.ghPage : '';
  var state = { page: PAGE, filter: 'all', postsUnsubs: {}, currentBusinessTab: 'posts', currentGroupTab: 'discussion', starRating: 5, theme: 'light' };

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
  function timeAgo(v){ var t=ts(v); if(!t) return 'ახლახან'; var s=Math.max(1, Math.floor((Date.now()-t)/1000)); if(s<60)return s+'s'; var m=Math.floor(s/60); if(m<60)return m+'m'; var h=Math.floor(m/60); if(h<24)return h+'h'; var d=Math.floor(h/24); if(d<30)return d+'d'; var mo=Math.floor(d/30); if(mo<12)return mo+'mo'; return Math.floor(mo/12)+'y'; }
  function initials(name){ name=text(name,'GeoHub'); return name.split(/\s+/).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase(); }
  function img(url, alt){ return url ? '<img src="'+esc(url)+'" alt="'+esc(alt||'')+'" loading="lazy" onerror="this.remove()">' : ''; }
  function readFileAsDataUrl(file){ return new Promise(function(resolve,reject){ if(!file) return resolve(''); var r=new FileReader(); r.onload=function(){ resolve(r.result||''); }; r.onerror=reject; r.readAsDataURL(file); }); }
  function triggerImagePick(cb){ var input=document.createElement('input'); input.type='file'; input.accept='image/*'; input.style.display='none'; document.body.appendChild(input); input.onchange=function(){ var f=input.files && input.files[0]; readFileAsDataUrl(f).then(function(url){ cb(url); }).finally(function(){ input.remove(); }); }; input.click(); }
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
  function docLink(type, id){ if(type==='business') return 'business.html?id='+encodeURIComponent(id); if(type==='group') return 'groups.html?id='+encodeURIComponent(id); if(type==='place') return 'places.html?id='+encodeURIComponent(id); if(type==='event') return 'events.html?id='+encodeURIComponent(id); return 'feed.html#post-'+encodeURIComponent(id); }

  function shell(opts){
    opts = opts || {};
    document.body.classList.add('gh-social-body');
    initTheme();
    document.body.innerHTML = '<div class="gh-shell">'+topbar()+
      '<div class="gh-layout">'+leftNav(opts.active||'')+'<main class="gh-center" id="ghCenter"></main>'+rightRail(opts.right||'')+'</div>'+createMenu()+'</div>';
    $('#ghCenter').innerHTML = opts.center || '';
    bindShell();
    updateTopUser();
    listenBadges();
  }

  function topbar(){
    return '<header class="gh-topbar">'+
      '<a class="gh-brand" href="feed.html"><div class="gh-brand-mark">GH</div><span>Geo<span>Hub</span></span></a>'+
      '<div class="gh-top-search"><i class="fas fa-search"></i><input id="ghGlobalSearch" placeholder="Search GeoHub…"></div>'+
      '<div class="gh-top-actions">'+
        '<a class="gh-icon-btn" href="feed.html" title="Home"><i class="fas fa-house"></i></a>'+
        '<a class="gh-icon-btn" href="explore.html" title="Discover"><i class="fas fa-compass"></i></a>'+
        '<button class="gh-create-btn" id="ghCreateBtn"><i class="fas fa-plus"></i><span>Create</span></button>'+
        '<button class="gh-icon-btn gh-theme-toggle" id="ghThemeToggle" title="Toggle light/dark mode"><i class="fas fa-moon"></i></button>'+
        '<a class="gh-icon-btn" href="messages.html" title="Messages"><i class="fas fa-comment-dots"></i><b class="gh-badge-count" id="ghMsgBadge"></b></a>'+
        '<button class="gh-icon-btn" id="ghNotifBtn" title="Notifications"><i class="fas fa-bell"></i><b class="gh-badge-count" id="ghNotifBadge"></b></button>'+
        '<a class="gh-user-btn" href="profile.html"><span class="gh-avatar" id="ghTopAvatar">GH</span><span id="ghTopName">Profile</span></a>'+
      '</div></header>';
  }

  function leftNav(active){
    var items=[
      ['feed','feed.html','fa-house','Home'],['discover','explore.html','fa-compass','Discover'],['groups','groups.html','fa-users','Groups'],['business','business.html','fa-store','Businesses'],['places','places.html','fa-map-marker-alt','Places'],['events','events.html','fa-calendar','Events'],['services','services.html','fa-briefcase','Services'],['learning','learning.html','fa-graduation-cap','Learning'],['rewards','rewards.html','fa-gift','Rewards'],['challenges','challenges.html','fa-trophy','Challenges'],['messages','messages.html','fa-comment-dots','Messages'],['profile','profile.html','fa-user','Profile'],['saved','profile.html?tab=saved','fa-bookmark','Saved']
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
    document.addEventListener('click', function(e){
      if(e.target.closest('[data-create-post]')) openPostModal({});
      if(e.target.closest('[data-create-story]')) openStoryModal();
      if(e.target.closest('#ghNotifBtn')) openNotifications();
    });
    var gs=$('#ghGlobalSearch'); if(gs){ gs.addEventListener('keydown', function(e){ if(e.key==='Enter' && gs.value.trim()) location.href='search.html?q='+encodeURIComponent(gs.value.trim()); }); }
    loadRightRail();
  }

  function updateTopUser(){
    var u=currentUserInfo(); var av=$('#ghTopAvatar'), nm=$('#ghTopName');
    if(av) av.innerHTML = u.avatar ? img(u.avatar,u.name) : esc(initials(u.name));
    if(nm) nm.textContent = authUser() ? u.name.split(' ')[0] : 'Sign in';
  }

  function listenBadges(){
    ready(function(){
      var u=authUser(); if(!u) return;
      try{
        GS().listenUserNotifications(u.uid, function(items){ var n=items.filter(function(x){return !x.read;}).length; var b=$('#ghNotifBadge'); if(b) b.textContent=n?String(n):''; });
        var q=fs().query(fs().collection(db(),'conversations'), fs().where('participants','array-contains',u.uid));
        fs().onSnapshot(q,function(snap){ var n=0; snap.forEach(function(d){ var x=d.data()||{}; if(x.lastSenderId && x.lastSenderId!==u.uid && !(x.readBy||[]).includes(u.uid)) n++; }); var b=$('#ghMsgBadge'); if(b) b.textContent=n?String(n):''; },function(){ });
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
      GS().listenUserNotifications(uid, function(items){
        var box=$('#ghNotifList'); if(!box) return;
        if(!items.length){ box.innerHTML='<div class="gh-empty"><i class="fas fa-bell"></i><h3>No notifications</h3><p>Likes, comments, messages and requests will appear here.</p></div>'; return; }
        box.innerHTML='<div class="gh-mini-list">'+items.slice(0,30).map(function(n){return '<a class="gh-mini-item '+(!n.read?'unread':'')+'" href="'+esc(n.href||'feed.html')+'" data-notif="'+esc(n.id)+'"><span class="gh-mini-thumb"><i class="fas fa-bell"></i></span><div><strong>'+esc(n.title||'GeoHub')+'</strong><span>'+esc(n.body||n.message||'')+' · '+timeAgo(n.createdAt)+'</span></div></a>';}).join('')+'</div>';
        setTimeout(markVisibleNotificationsRead, 900);
      });
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
    wrap.addEventListener('click', function(e){ if(e.target===wrap || e.target.closest('[data-close-modal]')) wrap.remove(); });
    return wrap;
  }

  function openPostModal(extra){
    if(!requireLogin()) return;
    var body='<textarea class="gh-textarea" id="ghPostText" placeholder="რას აზიარებ დღეს?"></textarea><div style="height:10px"></div><input class="gh-input" id="ghPostImg" placeholder="Image URL optional"><div style="height:10px"></div><button class="gh-btn ghost full" id="ghPickPostImage" type="button"><i class="fas fa-image"></i> Choose image from device</button><div id="ghPostPreview" style="margin-top:10px"></div><div style="height:10px"></div><select class="gh-select" id="ghPostVisibility"><option value="public">Public</option><option value="followers">Followers</option><option value="onlyme">Only me</option></select>';
    modal('Create post', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitPost"><i class="fas fa-paper-plane"></i> Post</button>', 'ghPostModal');
    var picked='';
    $('#ghPickPostImage').onclick=function(){ triggerImagePick(function(url){ picked=url; $('#ghPostImg').value=''; $('#ghPostPreview').innerHTML=url?'<img src="'+esc(url)+'" style="width:100%;max-height:260px;object-fit:cover;border-radius:16px;border:1px solid var(--gh-border)">':''; }); };
    $('#ghSubmitPost').onclick=function(){
      var txt=$('#ghPostText').value, url=picked || $('#ghPostImg').value.trim();
      var payload=Object.assign({ visibility: $('#ghPostVisibility').value }, extra||{});
      GS().createPost(txt, url, function(){ var m=$('#ghPostModal'); if(m)m.remove(); }, payload);
    };
  }

  function openStoryModal(){
    if(!requireLogin()) return;
    var body='<textarea class="gh-textarea" id="ghStoryText" placeholder="Story text…"></textarea><div style="height:10px"></div><input class="gh-input" id="ghStoryImg" placeholder="Image URL optional"><div style="height:10px"></div><button class="gh-btn ghost full" id="ghPickStoryImage" type="button"><i class="fas fa-image"></i> Choose image</button><div id="ghStoryPreview" style="margin-top:10px"></div>';
    modal('Add story', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitStory">Share story</button>', 'ghStoryModal');
    var picked=''; $('#ghPickStoryImage').onclick=function(){ triggerImagePick(function(url){ picked=url; $('#ghStoryImg').value=''; $('#ghStoryPreview').innerHTML=url?'<img src="'+esc(url)+'" style="width:100%;max-height:260px;object-fit:cover;border-radius:16px;border:1px solid var(--gh-border)">':''; }); };
    $('#ghSubmitStory').onclick=function(){ var t=$('#ghStoryText').value, url=picked||$('#ghStoryImg').value.trim(); if(!t.trim()&&!url)return toast('Story needs text or image','error'); if(GS().createStory) GS().createStory(t,url,function(){ var m=$('#ghStoryModal'); if(m)m.remove(); }); else toast('Stories unavailable','error'); };
  }

  function loadStories(selector, mini){
    ready(function(){
      var box=$(selector); if(!box) return;
      GS().listenStories(function(items){
        var add='<div class="gh-story-card gh-story-add" data-create-story><div><i class="fas fa-plus-circle"></i><br><strong>Create</strong></div></div>';
        if(!items.length){ box.innerHTML=add; return; }
        box.innerHTML=add+items.slice(0,12).map(function(s){ var name=s.authorName||s.userName||'Story'; var photo=s.mediaUrl||s.imageUrl; return '<div class="gh-story-card" data-story-id="'+esc(s.id)+'" data-story-author="'+esc(name)+'" data-story-text="'+esc(s.text||'')+'" data-story-media="'+esc(photo||'')+'">'+(photo?img(photo,name):'')+'<strong>'+esc(name)+'</strong></div>'; }).join('');
        box.onclick=function(e){ var st=e.target.closest('[data-story-id]'); if(st) openStoryViewer(st); if(e.target.closest('[data-create-story]')) openStoryModal(); };
      });
    });
  }

  function openStoryViewer(el){
    var media=el.dataset.storyMedia||'', author=el.dataset.storyAuthor||'Story', storyText=el.dataset.storyText||'';
    var body='<div class="gh-story-viewer">'+(media?'<img src="'+esc(media)+'" alt="story">':'')+'<div class="gh-story-viewer-text"><strong>'+esc(author)+'</strong><p>'+esc(storyText||'')+'</p></div></div>';
    modal(author, body, '<button class="gh-btn ghost" data-close-modal>Close</button>', 'ghStoryViewerModal');
  }

  function postCard(p, options){
    options=options||{}; var name=p.authorName||p.userName||p.businessName||'GeoHub User'; var av=p.authorAvatar||p.userPhotoURL||p.logoUrl||''; var imgUrl=p.imageUrl||p.mediaUrl||p.photoUrl||''; var pid=p.id; var target='';
    if(p.targetType && p.targetId) target='<div class="gh-post-target"><i class="fas '+iconFor(p.targetType)+'"></i>'+esc(labelFor(p.targetType))+'</div>';
    return '<article class="gh-card gh-post" id="post-'+esc(pid)+'" data-post-id="'+esc(pid)+'">'+
      '<div class="gh-post-head"><span class="gh-avatar">'+(av?img(av,name):esc(initials(name)))+'</span><div class="gh-post-meta"><div class="gh-post-name">'+esc(name)+'</div><div class="gh-post-time">'+timeAgo(p.createdAt)+' · <i class="fas fa-earth-europe"></i>'+target+'</div></div><button class="gh-post-more" data-post-menu><i class="fas fa-ellipsis"></i></button></div>'+
      (p.text?'<div class="gh-post-text">'+esc(p.text)+'</div>':'')+
      (imgUrl?'<img class="gh-post-img" src="'+esc(imgUrl)+'" alt="post image" loading="lazy">':'')+
      (p.sharedPostId?'<div class="gh-card" style="box-shadow:none;background:rgba(255,255,255,.035)"><span class="gh-muted">Shared post: '+esc(p.sharedPostId)+'</span></div>':'')+
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
    });
    root.addEventListener('submit', function(e){
      var form=e.target.closest('[data-comment-form]'); if(!form) return; e.preventDefault(); var card=form.closest('[data-post-id]'), pid=card.dataset.postId; var input=form.querySelector('input'); var val=input.value.trim(); if(!val) return; if(!requireLogin()) return; GS().addComment(pid,val,function(){ input.value=''; });
    });
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

  function toggleComments(card,pid){
    var box=card.querySelector('[data-comments]'); if(!box) return; box.hidden=!box.hidden; if(box.hidden) return;
    if(state.postsUnsubs[pid]) return;
    var list=card.querySelector('[data-comments-list]');
    state.postsUnsubs[pid]=GS().listenComments(pid,function(items){
      if(!items.length){ list.innerHTML='<div class="gh-small" style="padding:10px 6px">No comments yet.</div>'; return; }
      list.innerHTML=items.map(function(c){ var name=c.authorName||c.userName||'User'; return '<div class="gh-comment-row"><span class="gh-avatar" style="width:32px;height:32px">'+(c.authorAvatar?img(c.authorAvatar,name):esc(initials(name)))+'</span><div><div class="gh-comment-bubble"><strong>'+esc(name)+'</strong><span>'+esc(c.text||'')+'</span></div><div class="gh-small" style="padding-left:8px;margin-top:3px">'+timeAgo(c.createdAt)+' · Like · Reply</div></div></div>'; }).join('');
    });
  }

  function sharePost(pid){
    if(!requireLogin()) return;
    var body='<textarea class="gh-textarea" id="ghShareText" placeholder="Say something about this…"></textarea><div class="gh-card" style="box-shadow:none;margin-top:10px"><b>Shared post</b><div class="gh-small">'+esc(pid)+'</div></div>';
    modal('Share post', body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitShare">Share to feed</button>', 'ghShareModal');
    $('#ghSubmitShare').onclick=function(){ GS().createPost($('#ghShareText').value, '', function(){ if($('#ghShareModal')) $('#ghShareModal').remove(); if(GS().trackShare) GS().trackShare(pid); }, { sharedPostId: pid }); };
  }

  function postMenu(pid, card){
    if(!requireLogin()) return;
    var body='<div class="gh-mini-list"><button class="gh-mini-item" data-menu-save><span class="gh-mini-thumb"><i class="fas fa-bookmark"></i></span><div><strong>Save post</strong><span>Keep it for later</span></div></button><button class="gh-mini-item" data-menu-report><span class="gh-mini-thumb"><i class="fas fa-flag"></i></span><div><strong>Report post</strong><span>Send to moderation</span></div></button></div>';
    modal('Post options', body, '<button class="gh-btn ghost" data-close-modal>Close</button>', 'ghPostMenuModal');
    var m=$('#ghPostMenuModal');
    m.addEventListener('click', function(e){ if(e.target.closest('[data-menu-save]')){ GS().toggleSavePost(pid); m.remove(); } if(e.target.closest('[data-menu-report]')){ createReport('post',pid,'Reported from post menu'); m.remove(); } });
  }

  function createReport(type,id,reason){
    if(!requireLogin()) return;
    var u=authUser(); fs().addDoc(fs().collection(db(),'reports'), { reporterId:u.uid, targetType:type, targetId:id, reason:reason||'report', status:'pending', createdAt:fs().serverTimestamp() }).then(function(){toast('Report sent');}).catch(function(){toast('Report failed','error');});
  }

  function renderFeed(){
    shell({ active:'feed', center:
      '<section class="gh-card gh-live-map"><div class="gh-live-map-bg"><div class="gh-map-dot gh-map-dot-a"><b>24</b><span>Kazbegi</span></div><div class="gh-map-dot gh-map-dot-b"><b>32</b><span>Batumi</span></div><div class="gh-map-dot gh-map-dot-c"><b>18</b><span>Tbilisi</span></div><div class="gh-map-dot gh-map-dot-d"><b>9</b><span>Gudauri</span></div></div><div class="gh-live-map-head"><div><h1>Live Around Georgia</h1><p>See what’s happening right now</p></div><a href="map.html" class="gh-btn ghost"><i class="fas fa-location-dot"></i> Open Full Map</a></div><div class="gh-live-stats"><div><i class="fas fa-wave-square"></i><strong>Live</strong><span>Active now</span></div><div><i class="fas fa-calendar"></i><strong>Events</strong><span>Nearby</span></div><div><i class="fas fa-location-dot"></i><strong>Check-ins</strong><span>Places</span></div><div><i class="fas fa-comment-dots"></i><strong>Posts</strong><span>New updates</span></div></div></section>'+
      '<section class="gh-card"><div class="gh-section-title"><h2>Stories from Places</h2><a class="gh-small" href="explore.html">See all</a></div><div class="gh-stories" id="ghStories"></div></section>'+
      '<section class="gh-card gh-composer"><div class="gh-composer-top"><span class="gh-avatar" id="ghComposerAvatar">GH</span><button class="gh-composer-fake" data-create-post>რას აზიარებ დღეს?</button></div><div class="gh-composer-actions"><button class="gh-composer-action" data-create-post><i class="fas fa-image" style="color:#22c55e"></i> Photo</button><button class="gh-composer-action" onclick="location.href=\'places.html\'"><i class="fas fa-map-marker-alt" style="color:#ef4444"></i> Place</button><button class="gh-composer-action" onclick="location.href=\'add-business.html\'"><i class="fas fa-store" style="color:#38bdf8"></i> Business</button><button class="gh-composer-action" onclick="location.href=\'events.html\'"><i class="fas fa-calendar" style="color:#f59e0b"></i> Event</button></div></section>'+
      '<div id="ghFeedList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i><h3>Loading feed…</h3></div></div>'
    });
    var u=currentUserInfo(); var ca=$('#ghComposerAvatar'); if(ca) ca.innerHTML = u.avatar ? img(u.avatar,u.name) : esc(initials(u.name));
    loadStories('#ghStories');
    ready(function(){
      var list=$('#ghFeedList'); bindPostInteractions(list);
      GS().listenFeed(function(posts){
        if(!posts.length){ list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-seedling"></i><h3>Feed is empty</h3><p>Create the first real post. Fake demo posts are removed.</p><button class="gh-btn" data-create-post><i class="fas fa-plus"></i>Create post</button></div>'; return; }
        list.innerHTML=posts.map(function(p){ return postCard(p); }).join('');
        posts.forEach(function(p){ try{ GS().checkLiked(p.id,function(liked){ var b=$('[data-post-id="'+CSS.escape(p.id)+'"] [data-like]'); if(b)b.classList.toggle('active',liked); }); }catch(e){} });
      }, 50);
    });
  }

  function discoverItem(x){
    var type=x._type; var title=x.title||x.name||x.text||'Untitled'; var desc=x.description||x.desc||x.text||x.category||''; var photo=x.imageUrl||x.photoUrl||x.mediaUrl||x.coverImageUrl||x.coverUrl||x.logoUrl||'';
    if(type==='post') title=x.authorName ? x.authorName+' posted' : 'Post';
    return '<article class="gh-card gh-item-card" data-discover-card data-type="'+esc(type)+'"><div class="gh-item-media">'+(photo?img(photo,title):'')+'<span class="gh-type-badge"><i class="fas '+iconFor(type)+'"></i> '+labelFor(type)+'</span></div><div class="gh-item-body"><h3>'+esc(title)+'</h3><p>'+esc(desc||'Real GeoHub item')+'</p><div class="gh-item-meta">'+(x.city?'<span class="gh-chip"><i class="fas fa-location-dot"></i> '+esc(x.city)+'</span>':'')+(x.category?'<span class="gh-chip">'+esc(x.category)+'</span>':'')+'<span class="gh-chip">'+timeAgo(x.createdAt)+'</span></div><div class="gh-card-actions"><a class="gh-btn sm" href="'+docLink(type,x.id)+'">View</a><button class="gh-btn sm ghost" data-save-item data-type="'+esc(type)+'" data-id="'+esc(x.id)+'"><i class="fas fa-bookmark"></i></button><button class="gh-btn sm ghost" data-share-item data-url="'+docLink(type,x.id)+'"><i class="fas fa-share"></i></button></div></div></article>';
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
      Promise.all(collections.map(function(c){ return getLatest(c[0],80).then(function(arr){ return arr.map(function(x){ x._type=c[1]; return x; }); }); })).then(function(all){ items=[].concat.apply([],all).sort(function(a,b){return ts(b.createdAt)-ts(a.createdAt);}); paint(); }).catch(function(err){ var list=$('#ghDiscoverList'); if(list) list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-triangle-exclamation"></i><h3>Discover failed</h3><p>'+esc(err.message||err)+'</p></div>'; });
    });
  }

  function businessListCard(b){
    var title=b.name||'Untitled business'; var photo=b.coverImageUrl||b.imageUrl||b.photoUrl||b.logoUrl||'';
    return '<article class="gh-card gh-item-card"><div class="gh-item-media">'+(photo?img(photo,title):'')+'<span class="gh-type-badge"><i class="fas fa-store"></i> Business Page</span></div><div class="gh-item-body"><h3>'+esc(title)+'</h3><p>'+esc(b.description||b.desc||'Business page on GeoHub')+'</p><div class="gh-item-meta"><span class="gh-chip">'+esc(b.category||'Business')+'</span>'+(b.city?'<span class="gh-chip">'+esc(b.city)+'</span>':'')+'<span class="gh-chip">'+Number(b.followerCount||0)+' followers</span></div><div class="gh-card-actions"><a class="gh-btn sm" href="business.html?id='+encodeURIComponent(b.id)+'">View Page</a><button class="gh-btn sm ghost" data-follow-business="'+esc(b.id)+'"><i class="fas fa-plus"></i> Follow</button><button class="gh-btn sm ghost" data-save-item data-type="business" data-id="'+esc(b.id)+'"><i class="fas fa-bookmark"></i></button></div></div></article>';
  }

  function renderBusinesses(){
    var id=new URLSearchParams(location.search).get('id');
    if(id) return renderBusinessDetail(id);
    shell({ active:'business', center:'<div class="gh-card"><div class="gh-section-title"><div><h1>Businesses / Pages</h1><p class="gh-muted" style="margin:.25rem 0 0">Every business becomes a Page where owners can post updates.</p></div><a href="add-business.html" class="gh-btn"><i class="fas fa-plus"></i>Add Business</a></div><input class="gh-input" id="ghBusinessSearch" placeholder="Search businesses…"><div style="height:12px"></div><div class="gh-pill-row"><button class="gh-pill active" data-biz-filter="all">All</button><button class="gh-pill" data-biz-filter="food">Food</button><button class="gh-pill" data-biz-filter="tourism">Tourism</button><button class="gh-pill" data-biz-filter="services">Services</button><button class="gh-pill" data-biz-filter="shop">Shops</button><button class="gh-pill" data-biz-filter="education">Education</button></div></div><div id="ghBusinessList"><div class="gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>' });
    var all=[]; state.bizFilter='all';
    function paint(){ var q=($('#ghBusinessSearch').value||'').toLowerCase(); var arr=all.filter(function(b){ var cat=(b.category||'').toLowerCase(); var ok=state.bizFilter==='all'||cat.includes(state.bizFilter); if(!ok)return false; return !q || JSON.stringify(b).toLowerCase().includes(q); }); var list=$('#ghBusinessList'); if(!arr.length){list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-store"></i><h3>No businesses yet</h3><p>Add a business and GeoHub will create a page for it.</p><a href="add-business.html" class="gh-btn">Add Business</a></div>';return;} list.innerHTML='<div class="gh-grid">'+arr.map(businessListCard).join('')+'</div>'; }
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
    $('#ghBusinessDetail').innerHTML='<section class="gh-card" style="padding:0;overflow:hidden"><div class="gh-page-cover">'+(cover?img(cover,title):'')+'</div><div class="gh-page-info"><div class="gh-page-logo">'+(logo?img(logo,title):esc(initials(title)))+'</div><div class="gh-page-title"><h1>'+esc(title)+'</h1><p><i class="fas fa-store"></i> '+esc(b.category||'Business')+(b.city?' · '+esc(b.city):'')+' · '+Number(b.followerCount||0)+' followers</p></div><div class="gh-page-actions"><button class="gh-btn" data-follow-business="'+esc(b.id)+'"><i class="fas fa-plus"></i> Follow</button><button class="gh-btn ghost" data-message-business="'+esc(b.ownerId||b.createdBy||'')+'"><i class="fas fa-comment"></i> Message</button><button class="gh-btn ghost" data-save-item data-type="business" data-id="'+esc(b.id)+'"><i class="fas fa-bookmark"></i></button>'+(isOwner?'<button class="gh-btn ghost" data-edit-business><i class="fas fa-gear"></i> Manage</button>':'')+'</div></div><div class="gh-tabbar"><button class="gh-tab active" data-business-tab="posts">Posts</button><button class="gh-tab" data-business-tab="about">About</button><button class="gh-tab" data-business-tab="reviews">Reviews</button><button class="gh-tab" data-business-tab="photos">Photos</button></div></section><div id="ghBusinessTabContent"></div>';
    $('#ghBusinessDetail').onclick=function(e){ var tab=e.target.closest('[data-business-tab]'); if(tab){ state.currentBusinessTab=tab.dataset.businessTab; $all('[data-business-tab]').forEach(function(x){x.classList.toggle('active',x===tab);}); renderBusinessTab(b); } var fl=e.target.closest('[data-follow-business]'); if(fl) followBusiness(b.id); var sv=e.target.closest('[data-save-item]'); if(sv){ if(!requireLogin())return; GS().toggleSaveItem(sv.dataset.type,sv.dataset.id); } var msg=e.target.closest('[data-message-business]'); if(msg){ var owner=msg.dataset.messageBusiness; if(!owner) return toast('Business owner not available','error'); if(!requireLogin()) return; GS().startConversation(owner,function(){ location.href='messages.html?with='+encodeURIComponent(owner); }); } var edit=e.target.closest('[data-edit-business]'); if(edit) location.href='add-business.html?edit='+encodeURIComponent(b.id); };
    renderBusinessTab(b);
  }

  function renderBusinessTab(b){
    var box=$('#ghBusinessTabContent'); if(!box)return; var tab=state.currentBusinessTab||'posts';
    if(tab==='about'){
      box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>About</h2></div><div class="gh-about-list">'+
        aboutRow('fa-align-left',b.description||b.desc||'No description yet')+aboutRow('fa-location-dot',b.address||b.city||'No address')+aboutRow('fa-phone',b.phone||'No phone')+aboutRow('fa-envelope',b.email||'No email')+aboutRow('fa-globe',b.website||'No website')+aboutRow('fa-clock',b.workingHours||'Working hours not added')+'</div></div>'; return;
    }
    if(tab==='reviews') return renderBusinessReviews(b);
    if(tab==='photos'){ box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-images"></i><h3>Photos</h3><p>Photos from business posts will appear here.</p></div>'; return; }
    var isOwner=authUser() && (b.ownerId===authUser().uid || b.createdBy===authUser().uid || b.userId===authUser().uid);
    box.innerHTML=(isOwner?'<section class="gh-card gh-composer"><div class="gh-composer-top"><span class="gh-avatar">'+esc(initials(b.name))+'</span><button class="gh-composer-fake" data-post-as-business>Post as '+esc(b.name||'business')+'</button></div></section>':'')+'<div id="ghBusinessPosts"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>';
    box.onclick=function(e){ if(e.target.closest('[data-post-as-business]')) openPostModal({ targetType:'business', targetId:b.id, authorType:'business', businessId:b.id, authorId:b.id, authorName:b.name, authorAvatar:b.logoUrl||b.coverImageUrl||'', createdByUserId:authUser() && authUser().uid }); };
    bindPostInteractions(box);
    listenTargetPosts('business', b.id, function(posts){ var list=$('#ghBusinessPosts'); if(!list) return; if(!posts.length){ list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-newspaper"></i><h3>No posts yet</h3><p>Business page updates will appear here.</p></div>'; return; } list.innerHTML=posts.map(postCard).join(''); bindPostInteractions(list); });
  }

  function aboutRow(ic, txt){ return '<div class="gh-about-row"><i class="fas '+ic+'"></i><span>'+esc(txt)+'</span></div>'; }

  function renderBusinessReviews(b){
    var box=$('#ghBusinessTabContent');
    box.innerHTML='<div class="gh-card"><div class="gh-section-title"><h2>Reviews</h2><span class="gh-small">'+Number(b.reviewCount||0)+' reviews</span></div><div class="gh-review-form"><div class="gh-stars" id="ghReviewStars">'+[1,2,3,4,5].map(function(i){return '<button class="gh-star active" data-star="'+i+'">★</button>';}).join('')+'</div><textarea class="gh-textarea" id="ghReviewText" placeholder="Write a review…"></textarea><button class="gh-btn" id="ghSubmitReview">Submit review</button></div></div><div id="ghBusinessReviewsList"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>';
    $('#ghReviewStars').onclick=function(e){ var s=e.target.closest('[data-star]'); if(!s)return; state.starRating=Number(s.dataset.star); $all('[data-star]').forEach(function(x){x.classList.toggle('active', Number(x.dataset.star)<=state.starRating);}); };
    $('#ghSubmitReview').onclick=function(){ createBusinessReview(b.id, state.starRating||5, $('#ghReviewText').value); };
    listenBusinessReviews(b.id, function(items){ var list=$('#ghBusinessReviewsList'); if(!items.length){list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-star"></i><h3>No reviews yet</h3><p>Be first to review this business.</p></div>';return;} list.innerHTML=items.map(function(r){return '<div class="gh-card"><div class="gh-post-head"><span class="gh-avatar">'+(r.userPhoto?img(r.userPhoto,r.userName):esc(initials(r.userName||'User')))+'</span><div><div class="gh-post-name">'+esc(r.userName||'User')+'</div><div class="gh-post-time">'+('★'.repeat(Number(r.rating||5)))+' · '+timeAgo(r.createdAt)+'</div></div></div><div class="gh-post-text">'+esc(r.text||r.comment||'')+'</div></div>';}).join(''); });
  }

  function createBusinessReview(businessId, rating, textVal){
    if(!requireLogin()) return; var u=currentUserInfo(); var textClean=(textVal||'').trim(); if(!textClean) return toast('Write review first','error');
    fs().addDoc(fs().collection(db(),'businessReviews'), { businessId:businessId, userId:u.uid, userName:u.name, userPhoto:u.avatar, rating:rating, text:textClean, status:'active', createdAt:fs().serverTimestamp() }).then(function(){ return fs().updateDoc(fs().doc(db(),'businesses',businessId), { reviewCount: fs().increment(1) }).catch(function(){}); }).then(function(){ toast('Review submitted'); $('#ghReviewText').value=''; }).catch(function(err){ toast('Review failed: '+(err.code||err.message),'error'); });
  }
  function listenBusinessReviews(businessId, cb){ var q=fs().query(fs().collection(db(),'businessReviews'), fs().where('businessId','==',businessId), fs().limit(50)); fs().onSnapshot(q,function(snap){ var arr=[]; snap.forEach(function(d){arr.push(Object.assign({id:d.id},d.data()));}); arr.sort(function(a,b){return ts(b.createdAt)-ts(a.createdAt);}); cb(arr); },function(){cb([]);}); }

  function followBusiness(businessId){
    if(!requireLogin()) return; var uid=authUser().uid; var id=businessId+'_'+uid; var ref=fs().doc(db(),'businessFollowers',id); var biz=fs().doc(db(),'businesses',businessId);
    fs().getDoc(ref).then(function(d){ if(d.exists()){ return fs().deleteDoc(ref).then(function(){ return fs().updateDoc(biz,{followerCount:fs().increment(-1)}).catch(function(){}); }).then(function(){toast('Unfollowed');}); } return fs().setDoc(ref,{businessId:businessId,userId:uid,createdAt:fs().serverTimestamp()}).then(function(){return fs().updateDoc(biz,{followerCount:fs().increment(1)}).catch(function(){});}).then(function(){toast('Following business');}); }).catch(function(err){toast('Follow failed: '+(err.code||err.message),'error');});
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
    if(tab==='members'){ box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-users"></i><h3>Members</h3><p>Member list will show real groupMembers records.</p></div>'; return; }
    if(tab==='media'){ box.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-images"></i><h3>Media</h3><p>Photos from group posts will appear here.</p></div>'; return; }
    box.innerHTML='<section class="gh-card gh-composer"><div class="gh-composer-top"><span class="gh-avatar"><i class="fas fa-users"></i></span><button class="gh-composer-fake" data-create-group-post>Post in '+esc(g.name||'group')+'</button></div></section><div id="ghGroupPosts"><div class="gh-card gh-empty"><i class="fas fa-circle-notch fa-spin"></i></div></div>';
    box.onclick=function(e){ if(e.target.closest('[data-create-group-post]')) openGroupPostModal(g); };
    listenTargetPosts('group', g.id, function(items){ var list=$('#ghGroupPosts'); if(!list)return; if(!items.length){ list.innerHTML='<div class="gh-card gh-empty"><i class="fas fa-newspaper"></i><h3>No group posts yet</h3><p>Start the discussion.</p></div>'; return; } list.innerHTML=items.map(function(p){ p.targetType='group'; p.targetId=g.id; return postCard(p); }).join(''); bindPostInteractions(list); });
  }

  function openGroupPostModal(g){ if(!requireLogin())return; var body='<textarea class="gh-textarea" id="ghGroupPostText" placeholder="Write something to the group…"></textarea><div style="height:10px"></div><input class="gh-input" id="ghGroupPostImg" placeholder="Image URL optional">'; modal('Post in '+(g.name||'group'), body, '<button class="gh-btn ghost" data-close-modal>Cancel</button><button class="gh-btn" id="ghSubmitGroupPost">Post</button>', 'ghGroupPostModal'); $('#ghSubmitGroupPost').onclick=function(){ GS().createPost($('#ghGroupPostText').value,$('#ghGroupPostImg').value.trim(),function(){ var m=$('#ghGroupPostModal'); if(m)m.remove(); }, { targetType:'group', targetId:g.id, groupId:g.id }); }; }

  function patchAddBusinessPage(){
    // Keep the existing wizard UI. add-business.js owns the full Firestore submit logic.
    // Only install this fallback if add-business.js failed to define submitForm.
    if (typeof window.submitForm === 'function') return;
    window.submitForm = function(){
      ready(function(){
        if(!requireLogin()) return;
        var user=authUser(), f=fs();
        var name=text($('#bizNameInput') && $('#bizNameInput').value,'');
        var city=text($('#citySelect') && $('#citySelect').value,'');
        var category=(document.querySelector('.cat-option.selected')||{}).dataset ? (document.querySelector('.cat-option.selected')||{}).dataset.cat : '';
        if(!name){ toast('Business name is required','error'); return; }
        if(!city){ toast('City is required','error'); return; }
        var data={
          name:name,
          description:text($('#descInput') && $('#descInput').value,''),
          desc:text($('#descInput') && $('#descInput').value,''),
          city:city,
          category:category||'business',
          phone:text($('#phoneInput') && $('#phoneInput').value,''),
          email:text($('#emailInput') && $('#emailInput').value,''),
          website:text($('#websiteInput') && $('#websiteInput').value,''),
          address:text($('#addressInput') && $('#addressInput').value,''),
          logoUrl:'', coverImageUrl:'',
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
    // ensure existing final submit buttons call new submitForm after page code loads
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
        toast('Post published'); if(extra.targetType==='business' && extra.targetId) GF.fs.updateDoc(GF.fs.doc(GF.db,'businesses',extra.targetId), {postCount:GF.fs.increment(1)}).catch(function(){}); if(extra.targetType==='group' && extra.targetId) GF.fs.updateDoc(GF.fs.doc(GF.db,'groups',extra.targetId), {postCount:GF.fs.increment(1)}).catch(function(){}); if(callback) callback(ref.id);
      }).catch(function(err){ console.error('createPost enhanced',err); toast('Post failed: '+(err.code||err.message),'error'); if(callback) callback(null,err); });
    };
  }

  function init(){
    ready(function(){ enhanceGeoSocial(); });
    if(PAGE==='feed' || PATH==='feed.html' || PATH==='index.html') return renderFeed();
    if(PAGE==='discover' || PATH==='explore.html') return renderDiscover();
    if(PAGE==='business' || PATH==='business.html') return renderBusinesses();
    if(PAGE==='groups' || PATH==='groups.html') return renderGroups();
    if(PAGE==='add-business' || PATH==='add-business.html') return patchAddBusinessPage();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
