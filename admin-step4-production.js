/* GeoHub Admin Step 4 — production Content Studio + placeholder cleanup */
(function(){
  'use strict';

  var COLLECTIONS = {
    places: { label:'Places', titleKey:'name', defaults:{ type:'place', status:'active', visibility:'public' } },
    businesses: { label:'Businesses', titleKey:'name', defaults:{ type:'business', status:'active', verified:false, visibility:'public' } },
    groups: { label:'Groups', titleKey:'name', defaults:{ type:'group', status:'active', privacy:'public', memberCount:0, postCount:0 } },
    events: { label:'Events', titleKey:'title', defaults:{ type:'event', status:'active', visibility:'public', goingCount:0, interestedCount:0 } },
    rewards: { label:'Rewards / Coupons', titleKey:'title', defaults:{ type:'reward', status:'active', stock:0, claimedCount:0, visibility:'public' } },
    challenges: { label:'Challenges', titleKey:'title', defaults:{ type:'challenge', status:'active', participantCount:0, visibility:'public' } },
    services: { label:'Services', titleKey:'title', defaults:{ type:'service', status:'active', visibility:'public' } },
    realEstateListings: { label:'Real Estate Listings', titleKey:'title', defaults:{ type:'real_estate', status:'active', visibility:'public' } },
    learningItems: { label:'Learning / Courses', titleKey:'title', defaults:{ type:'learning', status:'active', visibility:'public' } },
    creators: { label:'Creators', titleKey:'name', defaults:{ type:'creator', status:'active', verified:false, visibility:'public' } }
  };

  var countIds = {
    users:['stat-users','sb-users'],
    businesses:['stat-biz','sb-biz-side'],
    events:['stat-events'],
    checkins:['stat-checkins'],
    reviews:['stat-reviews'],
    rewardClaims:['stat-rewards'],
    reports:['stat-reports','sb-mod'],
    creators:['sb-creators'],
    liveActivity:['sb-live']
  };

  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>'"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]; }); }
  function toast(msg, bad){
    if (typeof window.toast === 'function') return window.toast(msg, bad ? 'rgba(239,68,68,.95)' : undefined);
    var el = $('adminToast'), text = $('adminToastMsg');
    if (!el || !text) return console.log('[Admin]', msg);
    text.textContent = msg;
    el.style.background = bad ? 'rgba(239,68,68,.95)' : 'rgba(16,185,129,.95)';
    el.style.color = bad ? '#fff' : '#000';
    el.style.transform = 'translateX(-50%) translateY(0)';
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(function(){ el.style.transform='translateX(-50%) translateY(60px)'; el.style.opacity='0'; }, 2600);
  }
  function gfReady(cb){
    if (window.GeoFirebase && window.GeoFirebase.db && window.GeoFirebase.fs) return cb(window.GeoFirebase);
    window.addEventListener('GeoFirebaseReady', function(){ cb(window.GeoFirebase); }, { once:true });
  }

  function cleanupText(){
    document.querySelectorAll('.sc-delta,.rev-delta,.clean-admin').forEach(function(el){
      if (/coming\s+soon/i.test(el.textContent || '')) {
        el.textContent = 'Admin-controlled · live Firestore data';
      }
    });
    document.querySelectorAll('button,a,span,div').forEach(function(el){
      if ((el.textContent || '').trim() === 'Coming soon') {
        el.textContent = 'Admin-controlled';
      }
    });
  }

  function ensureContentStudioUi(){
    var form = $('adminContentForm');
    if (!form || form.dataset.step4Ui === '1') return;
    form.dataset.step4Ui = '1';
    var city = $('adminContentCity');
    var category = $('adminContentCategory');
    var wrap = document.createElement('div');
    wrap.className = 'admin-step4-extra';
    wrap.innerHTML = ''+
      '<div class="admin-step4-grid">'+
        '<input id="adminContentImage" placeholder="Image URL optional" autocomplete="off">'+
        '<input id="adminContentUrl" placeholder="Website / link optional" autocomplete="off">'+
      '</div>'+
      '<div class="admin-step4-grid">'+
        '<input id="adminContentPrice" type="number" min="0" step="1" placeholder="Price / points optional">'+
        '<input id="adminContentDate" type="datetime-local" placeholder="Event date optional">'+
      '</div>'+
      '<div class="admin-step4-grid">'+
        '<select id="adminContentStatus"><option value="active">Active</option><option value="draft">Draft</option><option value="pending">Pending review</option></select>'+
        '<select id="adminContentVisibility"><option value="public">Public</option><option value="private">Private</option><option value="unlisted">Unlisted</option></select>'+
      '</div>'+
      '<div id="adminContentHint" class="admin-step4-hint">Choose a collection, fill the real fields, then save. No fake/demo content is generated.</div>';
    if (category && category.parentElement) category.parentElement.insertAdjacentElement('afterend', wrap);
    else form.insertBefore(wrap, form.querySelector('button[type="submit"]'));

    if (city) city.setAttribute('autocomplete','off');
    if (category) category.setAttribute('autocomplete','off');

    var panel = document.createElement('div');
    panel.className = 'panel admin-step4-list-panel';
    panel.innerHTML = '<div class="panel-hdr"><div><div class="panel-title">Recent Content</div><div class="panel-sub" id="adminContentListSub">Select a collection to preview latest real items</div></div><button class="btn btn-ghost btn-sm" type="button" id="adminContentReload"><i class="fas fa-sync-alt"></i> Reload</button></div><div id="adminContentList" class="admin-step4-list"><div class="admin-step4-empty">No collection loaded yet.</div></div>';
    var parentPanel = form.closest('.panel');
    if (parentPanel && parentPanel.parentNode) parentPanel.insertAdjacentElement('afterend', panel);

    var select = $('adminContentCollection');
    if (select) select.addEventListener('change', loadContentList);
    var reload = $('adminContentReload');
    if (reload) reload.addEventListener('click', loadContentList);
    setTimeout(loadContentList, 400);
  }

  function makePayload(fb){
    var col = ($('adminContentCollection') || {}).value || 'places';
    var cfg = COLLECTIONS[col] || COLLECTIONS.places;
    var title = (($('adminContentTitle') || {}).value || '').trim();
    var desc = (($('adminContentDesc') || {}).value || '').trim();
    var city = (($('adminContentCity') || {}).value || '').trim();
    var category = (($('adminContentCategory') || {}).value || '').trim();
    var imageUrl = (($('adminContentImage') || {}).value || '').trim();
    var url = (($('adminContentUrl') || {}).value || '').trim();
    var priceRaw = (($('adminContentPrice') || {}).value || '').trim();
    var dateRaw = (($('adminContentDate') || {}).value || '').trim();
    var status = (($('adminContentStatus') || {}).value || 'active').trim();
    var visibility = (($('adminContentVisibility') || {}).value || 'public').trim();
    var user = fb.auth && fb.auth.currentUser;
    if (!title) throw new Error('Title / name is required');
    if (!user || !user.uid) throw new Error('Admin login required');
    var payload = Object.assign({}, cfg.defaults, {
      name: title,
      title: title,
      description: desc,
      city: city,
      location: city,
      category: category,
      imageUrl: imageUrl,
      coverUrl: imageUrl,
      photoUrl: imageUrl,
      url: url,
      website: url,
      status: status,
      visibility: visibility,
      createdBy: user.uid,
      ownerId: user.uid,
      userId: user.uid,
      createdAt: fb.fs.serverTimestamp(),
      updatedAt: fb.fs.serverTimestamp()
    });
    if (priceRaw !== '') {
      var n = Number(priceRaw);
      if (!Number.isNaN(n)) { payload.price = n; payload.pointsCost = n; }
    }
    if (dateRaw) {
      var date = new Date(dateRaw);
      if (!Number.isNaN(date.getTime())) { payload.eventDate = date.toISOString(); payload.startsAt = date.toISOString(); }
    }
    if (col === 'businesses') payload.verified = status === 'active';
    if (col === 'events') payload.date = payload.eventDate || '';
    if (col === 'rewards') payload.available = status === 'active';
    return { col: col, cfg: cfg, payload: payload };
  }

  function bindContentStudioSubmit(){
    var form = $('adminContentForm');
    if (!form || form.dataset.step4Submit === '1') return;
    form.dataset.step4Submit = '1';
    form.addEventListener('submit', function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      gfReady(function(fb){
        var btn = form.querySelector('button[type="submit"]');
        try {
          var made = makePayload(fb);
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…'; }
          fb.fs.addDoc(fb.fs.collection(fb.db, made.col), made.payload).then(function(){
            form.reset();
            toast(made.cfg.label + ' item created');
            loadContentList();
            loadAdminCounts();
          }).catch(function(err){ console.error('[Admin Step4 create]', err); toast('Create failed: ' + err.message, true); })
          .finally(function(){ if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Create real item'; } });
        } catch(err){ toast(err.message, true); }
      });
    }, true);
  }

  function loadAdminCounts(){
    gfReady(function(fb){
      var fs = fb.fs, db = fb.db;
      var cols = ['users','businesses','events','checkins','reviews','rewardClaims','reports','creators','liveActivity','places','groups','rewards','challenges','services','realEstateListings','learningItems'];
      Promise.all(cols.map(function(col){
        return fs.getDocs(fs.query(fs.collection(db, col), fs.limit(250))).then(function(s){ return [col, s.size]; }).catch(function(){ return [col, 0]; });
      })).then(function(rows){
        var counts = {};
        rows.forEach(function(r){ counts[r[0]]=r[1]; });
        Object.keys(countIds).forEach(function(col){ (countIds[col] || []).forEach(function(id){ var el=$(id); if(el) el.textContent = counts[col] || 0; }); });
        var eventDelta = document.querySelector('#stat-events + .sc-lbl + .sc-delta');
        if (eventDelta) eventDelta.textContent = 'Firestore · live count';
        var creatorsEl = $('sb-creators'); if (creatorsEl) creatorsEl.textContent = counts.creators || 0;
        var bizSub = $('bizSubtitle'); if (bizSub) bizSub.textContent = (counts.businesses || 0) + ' registered · Verify, feature, approve';
        var liveLabel = $('liveCountLabel'); if (liveLabel) liveLabel.textContent = counts.liveActivity || 0;
      });
    });
  }

  function loadContentList(){
    var list = $('adminContentList');
    var sub = $('adminContentListSub');
    var select = $('adminContentCollection');
    if (!list || !select) return;
    var col = select.value || 'places';
    var cfg = COLLECTIONS[col] || COLLECTIONS.places;
    if (sub) sub.textContent = 'Latest ' + cfg.label + ' from Firestore';
    list.innerHTML = '<div class="admin-step4-empty"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>';
    gfReady(function(fb){
      var fs = fb.fs, db = fb.db;
      var q;
      try { q = fs.query(fs.collection(db, col), fs.orderBy('createdAt','desc'), fs.limit(12)); }
      catch(e) { q = fs.query(fs.collection(db, col), fs.limit(12)); }
      fs.getDocs(q).then(function(snap){
        if (snap.empty) { list.innerHTML = '<div class="admin-step4-empty">No real items yet in '+esc(cfg.label)+'.</div>'; return; }
        var html = '';
        snap.forEach(function(doc){
          var d = doc.data() || {};
          var title = d.title || d.name || d.displayName || doc.id;
          var meta = [d.city || d.location, d.category, d.status].filter(Boolean).join(' · ');
          html += '<div class="admin-step4-row" data-col="'+esc(col)+'" data-id="'+esc(doc.id)+'">'+
            '<div class="admin-step4-thumb">'+(d.imageUrl || d.coverUrl ? '<img src="'+esc(d.imageUrl || d.coverUrl)+'" alt="" loading="lazy" decoding="async">' : '<i class="fas fa-database"></i>')+'</div>'+
            '<div class="admin-step4-main"><strong>'+esc(title)+'</strong><span>'+esc(meta || 'Firestore item')+'</span><p>'+esc((d.description || '').slice(0,120))+'</p></div>'+
            '<button class="btn btn-red btn-sm" type="button" data-admin-delete="'+esc(doc.id)+'"><i class="fas fa-trash"></i></button>'+
          '</div>';
        });
        list.innerHTML = html;
      }).catch(function(err){
        console.error('[Admin Step4 list]', err);
        list.innerHTML = '<div class="admin-step4-empty">Could not load '+esc(cfg.label)+': '+esc(err.message)+'</div>';
      });
    });
  }

  function bindDelete(){
    document.addEventListener('click', function(e){
      var btn = e.target.closest('[data-admin-delete]');
      if (!btn) return;
      var row = btn.closest('.admin-step4-row');
      if (!row) return;
      var col = row.dataset.col, id = btn.getAttribute('data-admin-delete');
      if (!col || !id) return;
      if (!confirm('Delete this Firestore item?')) return;
      gfReady(function(fb){
        btn.disabled = true;
        fb.fs.deleteDoc(fb.fs.doc(fb.db, col, id)).then(function(){
          row.remove(); toast('Item deleted'); loadAdminCounts();
        }).catch(function(err){ console.error('[Admin Step4 delete]', err); toast('Delete failed: '+err.message, true); btn.disabled=false; });
      });
    });
  }

  function init(){
    cleanupText();
    ensureContentStudioUi();
    bindContentStudioSubmit();
    bindDelete();
    loadAdminCounts();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('GeoFirebaseReady', function(){ loadAdminCounts(); loadContentList(); });
})();
