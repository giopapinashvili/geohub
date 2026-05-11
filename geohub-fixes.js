(function(){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
  function initials(name,email){
    name=String(name||'').trim(); email=String(email||'').toLowerCase();
    if(!name && email==='gio.papinashvili20@gmail.com') name='Giorgi Papinashvili';
    if(!name && email) name=email.split('@')[0].replace(/[._-]+/g,' ');
    var parts=name.split(/\s+/).filter(Boolean);
    if(parts.length>=2) return (parts[0][0]+parts[1][0]).toUpperCase();
    if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
    return 'GH';
  }
  function svg(initial){
    var t=esc(initial||'GH');
    return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="120" fill="#6d3fd9"/><circle cx="120" cy="120" r="114" fill="none" stroke="#10b981" stroke-width="8"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="86" fill="white" font-weight="700">'+t+'</text></svg>');
  }
  function nameFromUser(user){
    if(!user) return 'GeoHub User';
    if(user.displayName) return user.displayName;
    if(user.email==='gio.papinashvili20@gmail.com') return 'Giorgi Papinashvili';
    return user.email ? user.email.split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,function(m){return m.toUpperCase();}) : 'GeoHub User';
  }
  function waitFirebase(cb){
    if(window.GeoFirebase) return cb(window.GeoFirebase);
    window.addEventListener('GeoFirebaseReady',function(){cb(window.GeoFirebase);},{once:true});
  }
  function authWatch(cb){
    waitFirebase(function(GF){
      if(!GF||!GF.auth) return cb(null);
      if(typeof GF.auth.onAuthStateChanged==='function') GF.auth.onAuthStateChanged(cb);
      else setTimeout(function(){cb(GF.auth.currentUser||null);},800);
    });
  }
  function updateFeedUser(user){
    if(!document.body.classList.contains('page-feed')) return;
    var name=nameFromUser(user), init=initials(name,user&&user.email), av=(user&&user.photoURL)||svg(init);
    [['ftbAvatar','src'],['composerAvatar','src'],['feedSidebarAvatar','src']].forEach(function(pair){var el=document.getElementById(pair[0]); if(el) el.src=av;});
    var n=document.getElementById('feedSidebarName'); if(n) n.textContent=name;
    var inp=document.getElementById('composerInput');
    if(inp) inp.placeholder=user ? "What's on your mind?" : 'Sign in to post on GeoHub…';
    document.querySelectorAll('.ftb-profile-link,.fls-profile-row').forEach(function(a){a.setAttribute('href', user ? 'profile.html' : 'auth.html');});
  }
  function timeAgo(v){
    try{var d=v&&typeof v.toDate==='function'?v.toDate():new Date(v&&v.seconds?v.seconds*1000:v||Date.now()); var diff=Math.max(1,Math.floor((Date.now()-d.getTime())/60000)); if(diff<60)return diff+'m ago'; if(diff<1440)return Math.floor(diff/60)+'h ago'; return Math.floor(diff/1440)+'d ago';}catch(e){return '';}
  }
  var groupedStories=[];
  function groupStories(stories){
    var map={}, groups=[];
    (stories||[]).forEach(function(s){
      var key=s.authorId||s.uid||s.userId||s.authorName||'unknown';
      if(!map[key]){map[key]={key:key,authorName:s.authorName||'User',authorAvatar:s.authorAvatar||'',items:[]};groups.push(map[key]);}
      map[key].items.push(s);
    });
    return groups;
  }
  function renderGroupedStories(stories){
    if(!document.body.classList.contains('page-feed')) return;
    var c=document.getElementById('fd-real-stories'); if(!c) return;
    groupedStories=groupStories(stories);
    c.innerHTML=groupedStories.map(function(g,i){
      var first=g.items[0]||{};
      var av=g.authorAvatar?'<img src="'+esc(g.authorAvatar)+'" alt="" class="fd-story-avatar">':'<div class="fd-story-avatar fd-story-avatar--init">'+esc(initials(g.authorName,''))+'</div>';
      return '<button type="button" class="fd-story-card fd-real-story-card" data-group-index="'+i+'"><div class="fd-story-visual"><div class="fd-story-bg" style="background:linear-gradient(135deg,#10b981,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:1.8rem">'+(first.mediaUrl?'<img src="'+esc(first.mediaUrl)+'" style="width:100%;height:100%;object-fit:cover">':'📖')+'</div>'+av+(g.items.length>1?'<span class="fd-story-count">'+g.items.length+'</span>':'')+'</div><span class="fd-story-label">'+esc(g.authorName)+'</span><span class="fd-story-time">'+timeAgo(first.createdAt)+'</span></button>';
    }).join('');
  }
  function openGroupedStory(gi,si){
    gi=Number(gi)||0; si=Number(si)||0; if(!groupedStories[gi]) return;
    var old=document.getElementById('ghStoryViewer'); if(old) old.remove();
    var ov=document.createElement('div'); ov.id='ghStoryViewer'; ov.className='gh-story-viewer'; document.body.appendChild(ov);
    function draw(gidx,sidx){
      if(gidx<0) gidx=groupedStories.length-1; if(gidx>=groupedStories.length) gidx=0;
      var g=groupedStories[gidx]; if(sidx<0){gidx=gidx-1<0?groupedStories.length-1:gidx-1;g=groupedStories[gidx];sidx=g.items.length-1;} if(sidx>=g.items.length){gidx=gidx+1>=groupedStories.length?0:gidx+1;g=groupedStories[gidx];sidx=0;}
      var s=g.items[sidx]||{}; ov.dataset.g=gidx; ov.dataset.s=sidx;
      ov.innerHTML='<div class="gh-story-box"><div class="gh-story-top"><div class="gh-story-author">'+(g.authorAvatar?'<img src="'+esc(g.authorAvatar)+'" alt="">':'<span>'+esc(initials(g.authorName,''))+'</span>')+'<div><strong>'+esc(g.authorName)+'</strong><small>'+(sidx+1)+' / '+g.items.length+' · '+timeAgo(s.createdAt)+'</small></div></div><button class="gh-story-close" type="button">✕</button></div><div class="gh-story-content">'+(s.mediaUrl?'<img src="'+esc(s.mediaUrl)+'" alt="Story">':'<p>'+esc(s.text||'Story')+'</p>')+'</div><button class="gh-story-nav gh-story-prev" type="button">‹</button><button class="gh-story-nav gh-story-next" type="button">›</button></div>';
      ov.querySelector('.gh-story-close').onclick=function(){ov.remove();};
      ov.querySelector('.gh-story-prev').onclick=function(e){e.stopPropagation();draw(Number(ov.dataset.g),Number(ov.dataset.s)-1);};
      ov.querySelector('.gh-story-next').onclick=function(e){e.stopPropagation();draw(Number(ov.dataset.g),Number(ov.dataset.s)+1);};
    }
    ov.onclick=function(e){if(e.target===ov)ov.remove();}; draw(gi,si);
  }
  document.addEventListener('click',function(e){var b=e.target.closest('[data-group-index]'); if(b){e.preventDefault();openGroupedStory(b.dataset.groupIndex,0);}});
  authWatch(updateFeedUser);
  window.addEventListener('GeoSocialReady',function(){ if(window.GeoSocial&&window.GeoSocial.listenStories) window.GeoSocial.listenStories(renderGroupedStories); });
})();
