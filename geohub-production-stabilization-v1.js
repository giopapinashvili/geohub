/* GeoHub Production Stabilization V1
   Scope: stability only. No placeholder features.
   - fixes mobile overlay/z-index conflicts
   - keeps Messenger bubble usable without covering page content
   - stabilizes notification unread badges
   - adds safe real-count helpers for real-data pages
*/
(function(){
  'use strict';
  if (window.__GeoHubProductionStabilizationV1) return;
  window.__GeoHubProductionStabilizationV1 = true;

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function ready(cb){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb, { once:true });
    else cb();
  }
  function waitFirebase(cb){
    if (window.GeoFirebase && window.GeoFirebase.fs) return cb(window.GeoFirebase);
    window.addEventListener('GeoFirebaseReady', () => window.GeoFirebase && cb(window.GeoFirebase), { once:true });
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (window.GeoFirebase && window.GeoFirebase.fs) { clearInterval(t); cb(window.GeoFirebase); }
      if (tries > 50) clearInterval(t);
    }, 120);
  }
  function waitSocial(cb){
    if (window.GeoSocial) return cb(window.GeoSocial);
    window.addEventListener('GeoSocialReady', () => window.GeoSocial && cb(window.GeoSocial), { once:true });
  }

  function injectCss(){
    if ($('#gh-prod-stabilization-css')) return;
    const style = document.createElement('style');
    style.id = 'gh-prod-stabilization-css';
    style.textContent = `
      .gh-badge-count:empty,.ftb-badge:empty,.fls-badge:empty{display:none!important}
      .gh-badge-count:not(:empty),.ftb-badge:not(:empty),.fls-badge:not(:empty){display:inline-flex!important;align-items:center;justify-content:center}
      .gh-chat-pop-root{position:fixed!important;right:18px!important;bottom:18px!important;z-index:2147483000!important;pointer-events:none!important}
      .gh-chat-pop-root .gh-chat-pop-btn,.gh-chat-pop-root .gh-chat-pop{pointer-events:auto!important}
      body.page-messages .gh-chat-pop-root{display:none!important}
      .gh-chat-emoji-panel.open{display:grid!important;grid-template-columns:repeat(6,34px)!important;gap:6px!important;max-height:220px!important;overflow:auto!important;padding:10px!important}
      .gh-chat-emoji{width:34px!important;height:34px!important;border-radius:9px!important;border:1px solid rgba(255,255,255,.1)!important;background:rgba(255,255,255,.08)!important;color:inherit!important;font-size:19px!important;cursor:pointer!important}
      .msg-reactions,.gh-chat-like{touch-action:manipulation!important}
      .gh-modal-backdrop,#ghStoryViewer{z-index:2147482500!important}
      @media(max-width:720px){
        .gh-chat-pop-root{right:12px!important;bottom:calc(76px + env(safe-area-inset-bottom,0px))!important}
        .gh-chat-pop{width:min(94vw,380px)!important;max-height:72vh!important}
        .gh-layout,.gh-center{min-width:0!important}
        img{max-width:100%;height:auto}
      }
    `;
    document.head.appendChild(style);
  }

  function lazyImages(){
    $$('img:not([loading])').forEach(img => { img.loading = 'lazy'; img.decoding = 'async'; });
  }

  function stabilizeNotificationBadges(){
    waitFirebase(GF => {
      const user = GF.auth && GF.auth.currentUser;
      if (!user) return;
      const nb = $('#ghNotifBadge') || $('#feedNotifBadge') || $('#notifBadge');
      const mb = $('#ghMsgBadge') || $('#feedMsgBadge') || $('#msgBadge');
      try{
        const qn = GF.fs.query(GF.fs.collection(GF.db,'userNotifications'), GF.fs.where('userId','==',user.uid), GF.fs.limit(50));
        GF.fs.onSnapshot(qn, snap => {
          let n = 0;
          snap.forEach(d => { const x = d.data() || {}; if (!x.read && !x.seen) n++; });
          if (nb) nb.textContent = n ? String(n) : '';
        }, () => {});
      }catch(e){}
      try{
        const qm = GF.fs.query(GF.fs.collection(GF.db,'conversations'), GF.fs.where('participants','array-contains',user.uid), GF.fs.limit(60));
        GF.fs.onSnapshot(qm, snap => {
          let n = 0;
          snap.forEach(d => {
            const x = d.data() || {};
            if (x.lastSenderId && x.lastSenderId !== user.uid) {
              if (Array.isArray(x.unreadFor)) { if (x.unreadFor.includes(user.uid)) n++; }
              else if (!(x.readBy && x.readBy[user.uid])) n++;
            }
          });
          if (mb) mb.textContent = n ? String(n) : '';
        }, () => {});
      }catch(e){}
    });
  }

  function realCountPage(){
    const map = {
      'live.html':'liveActivity', 'services.html':'services', 'learning.html':'learningItems',
      'real-estate.html':'realEstateListings', 'creators.html':'creators', 'rewards.html':'rewards',
      'groups.html':'groups', 'places.html':'places', 'events.html':'events', 'business.html':'businesses'
    };
    const collection = map[page];
    const total = $('#stat-total') || $('[data-real-count="total"]');
    if (!collection || !total) return;
    waitFirebase(async GF => {
      try{
        const snap = await GF.fs.getDocs(GF.fs.query(GF.fs.collection(GF.db, collection), GF.fs.limit(100)));
        total.textContent = String(snap.size);
        const list = $('#cleanList');
        if (list && snap.size) {
          const rows=[];
          snap.forEach(d => { const x = d.data() || {}; rows.push({id:d.id, ...x}); });
          list.innerHTML = '<div style="width:100%">' + rows.slice(0,30).map(x => {
            const title = x.name || x.title || x.text || x.displayName || 'Untitled';
            const sub = x.category || x.city || x.status || 'Real Firestore item';
            return '<div class="clean-card" style="margin-bottom:12px"><strong>'+esc(title)+'</strong><p style="color:#94a3b8;margin:.5rem 0 0">'+esc(sub)+'</p></div>';
          }).join('') + '</div>';
        }
      }catch(e){ console.warn('[GeoHub Stable] real count failed', collection, e.message); }
    });
  }

  function installDeepLinkRead(){
    if (page !== 'messages.html') return;
    waitSocial(GS => {
      document.addEventListener('click', e => {
        const row = e.target.closest('[data-conv-id]');
        if (row && GS.markConversationRead) setTimeout(() => GS.markConversationRead(row.dataset.convId), 50);
      });
    });
  }

  ready(() => {
    injectCss();
    lazyImages();
    stabilizeNotificationBadges();
    realCountPage();
    installDeepLinkRead();
    setTimeout(lazyImages, 1200);
  });
})();
