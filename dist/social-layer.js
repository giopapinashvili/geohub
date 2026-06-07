/* GeoHub social-layer compatibility wrapper.
   Persistent social actions are delegated to window.GeoSocial, which uses Firebase Auth + Firestore.
*/
(function(){
  'use strict';
  function ready(cb){
    if (window.GeoSocial) return cb(window.GeoSocial);
    window.addEventListener('GeoSocialReady', function(){ if(window.GeoSocial) cb(window.GeoSocial); }, { once:true });
  }
  function toast(msg,type){
    if(window.GeoSocial && window.GeoSocial.toast) return window.GeoSocial.toast(msg,type);
    var el=document.querySelector('.gh-toast'); if(el) el.remove();
    el=document.createElement('div'); el.className='gh-toast'+(type==='error'?' error':''); el.textContent=msg;
    document.body.appendChild(el); requestAnimationFrame(function(){el.classList.add('show');});
    setTimeout(function(){el.classList.remove('show'); setTimeout(function(){el.remove();},250);},1800);
  }
  function requireAuth(){
    if(window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser) return true;
    if(window.GeoSocial && window.GeoSocial.requireAuth) window.GeoSocial.requireAuth(); else location.href='auth.html';
    return false;
  }
  function bindGenericSocialActions(){
    document.addEventListener('click', function(e){
      var like=e.target.closest('[data-post-like],[data-like-post]');
      if(like){ e.preventDefault(); if(!requireAuth()) return; var host=like.closest('[data-post-id]'); var id=like.dataset.postLike||like.dataset.likePost||(host&&host.dataset.postId); if(id) ready(function(gs){ gs.toggleLike(id,false,function(active){ like.classList.toggle('active',!!active); }); }); }
      var save=e.target.closest('[data-save-post],[data-save-item]');
      if(save){ e.preventDefault(); if(!requireAuth()) return; var host=save.closest('[data-post-id],[data-item-id]'); var id=save.dataset.savePost||save.dataset.saveItem||(host&&(host.dataset.postId||host.dataset.itemId)); if(id) ready(function(gs){ if(save.dataset.savePost && gs.toggleSavePost) gs.toggleSavePost(id); else if(gs.toggleSaveItem) gs.toggleSaveItem(save.dataset.itemType||'item', id); }); }
      var comment=e.target.closest('[data-comment-post]');
      if(comment){ e.preventDefault(); if(!requireAuth()) return; var host=comment.closest('[data-post-id]'); var id=comment.dataset.commentPost||(host&&host.dataset.postId); var input=id?document.querySelector('[data-comment-input="'+CSS.escape(id)+'"]'):null; if(input) input.focus(); }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bindGenericSocialActions); else bindGenericSocialActions();
  window.GeoHubSocialLayer = { ready: ready, toast: toast, requireAuth: requireAuth };
})();
