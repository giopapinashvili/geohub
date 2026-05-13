// GeoHub Step 6 — responsive / overlay runtime guard
(function(){
  'use strict';
  const doc = document.documentElement;
  const body = document.body;
  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const page = path.replace('.html','') || 'index';
  doc.dataset.page = page;
  body.dataset.page = page;
  if(page === 'messages') body.classList.add('messages-page');

  function markOverlayState(){
    const selectors = [
      '.modal-overlay.open','.auth-modal-overlay.open','.cm-overlay.open','.gh-modal-overlay.open',
      '.app-action-overlay.open','.story-viewer-overlay.open','.stories-viewer-overlay.open',
      '.gh-story-viewer.open','.stories-viewer.open','.story-viewer.open'
    ];
    body.classList.toggle('gh-overlay-open', !!document.querySelector(selectors.join(',')));
  }

  function closeTopOverlay(){
    const candidates = Array.from(document.querySelectorAll('.modal-overlay.open,.auth-modal-overlay.open,.cm-overlay.open,.gh-modal-overlay.open,.app-action-overlay.open,.story-viewer-overlay.open,.stories-viewer-overlay.open,.gh-story-viewer.open,.stories-viewer.open,.story-viewer.open'));
    const top = candidates.pop();
    if(!top) return false;
    const closeBtn = top.querySelector('[data-close],.modal-close,.auth-modal-close,.cm-close,.gh-modal-close,.story-close,.stories-close,.modal-close-btn');
    if(closeBtn){ closeBtn.click(); }
    else { top.classList.remove('open','show','active'); top.hidden = true; }
    markOverlayState();
    return true;
  }

  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape') closeTopOverlay();
  });

  document.addEventListener('click', (e)=>{
    const target = e.target;
    if(!(target instanceof Element)) return;
    if(target.matches('.modal-overlay,.auth-modal-overlay,.cm-overlay,.gh-modal-overlay,.app-action-overlay')){
      const card = target.querySelector('.modal-card,.auth-modal-card,.cm-modal,.gh-modal,.chal-modal,.create-event-modal,.ev-detail-modal,.app-action-sheet');
      if(!card || !card.contains(e.target)) closeTopOverlay();
    }
    setTimeout(markOverlayState, 0);
  }, true);

  const mo = new MutationObserver(()=>markOverlayState());
  mo.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
  markOverlayState();

  // Prevent mobile horizontal scroll caused by old absolute/fixed elements.
  function clampFixedPanels(){
    const vw = window.innerWidth;
    document.querySelectorAll('.notification-panel,.notif-panel,.dropdown-menu,.user-menu,.lang-menu').forEach(el=>{
      const r = el.getBoundingClientRect();
      if(r.width && (r.right > vw || r.left < 0)){
        el.style.maxWidth = 'calc(100vw - 24px)';
        if(r.right > vw) el.style.right = '12px';
        if(r.left < 0) el.style.left = '12px';
      }
    });
  }
  window.addEventListener('resize', clampFixedPanels, {passive:true});
  window.addEventListener('orientationchange', ()=>setTimeout(clampFixedPanels, 250), {passive:true});
  setTimeout(clampFixedPanels, 250);
})();
