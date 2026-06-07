(function(){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
  function initials(name,email){
    name=String(name||'').trim(); email=String(email||'').toLowerCase();
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

  authWatch(updateFeedUser);
})();
