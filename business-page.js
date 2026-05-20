/* ================================================================
   GeoHub — Business Page (Premium Social Business Page)
   business.html?id=BUSINESS_ID
   ================================================================ */
(function () {
  'use strict';

  function ensureBusinessNavbarCss() {
    if (document.querySelector('link[href*="navbar.css"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'navbar.css';
    document.head.appendChild(link);
  }
  ensureBusinessNavbarCss();

  var BIZ_ID = new URLSearchParams(window.location.search).get('id');
  if (!BIZ_ID) return;

  var _db, _fs, _auth;
  var _biz         = null;
  var _currentUser = null;
  var _isOwner       = false;
  var _isPageAdmin   = false;
  var _isActingAsPage = false;
  var _pageAdminRole = null;
  var _isSaved     = false;
  var _isFollowing = false;
  var _notificationsOn = true;
  var _reviewRating  = 0;
  var _previewMode   = false;
  var _postReactions = {}; // legacy, kept for compat
  var _currentPosts  = []; // posts loaded in current render cycle
  var _sharePostId   = null;
  var _editPostId    = null;
  var _rxLongTimer   = null;

  var _qAll    = [];
  var _qFilter = 'all';
  var _qSearch = '';
  var BIZ_QUOTE_STATUS_COLORS = {
    new:      { text: '#10b981', bg: 'rgba(16,185,129,.12)',  border: 'rgba(16,185,129,.25)' },
    read:     { text: '#94a3b8', bg: 'rgba(148,163,184,.1)', border: 'rgba(148,163,184,.2)' },
    replied:  { text: '#3b82f6', bg: 'rgba(59,130,246,.12)',  border: 'rgba(59,130,246,.25)' },
    closed:   { text: '#f59e0b', bg: 'rgba(245,158,11,.12)',  border: 'rgba(245,158,11,.25)' },
    archived: { text: '#6b7280', bg: 'rgba(107,114,128,.1)', border: 'rgba(107,114,128,.2)' }
  };

  var _svcMap  = {};
  var _prodMap = {};

  var REACTIONS = [
    { key:'like',  emoji:'👍', label:'Like'  },
    { key:'love',  emoji:'❤️', label:'Love'  },
    { key:'haha',  emoji:'😂', label:'Haha'  },
    { key:'wow',   emoji:'😮', label:'Wow'   },
    { key:'sad',   emoji:'😢', label:'Sad'   },
    { key:'angry', emoji:'😡', label:'Angry' },
  ];

  // ── HELPERS ───────────────────────────────────────────────────

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function getActiveActor(){
    try{ return JSON.parse(localStorage.getItem('gh_active_actor')||'null'); }catch(e){ return null; }
  }
  function isActingAsBusiness(bizId){
    var a = getActiveActor();
    return !!(a && a.type === 'business' && a.businessId === bizId);
  }
  function notifyBusinessPage(type, title, body, href, extra) {
    if (!window.GeoSocial || !window.GeoSocial.createActorNotification || !_currentUser || !BIZ_ID) return;
    window.GeoSocial.createActorNotification('business', BIZ_ID, type, title, body, href || ('business.html?id=' + BIZ_ID), Object.assign({
      businessId: BIZ_ID,
      ownerUid: (_biz && _biz.ownerId) || ''
    }, extra || {})).catch(function(){});
  }
  function fmtPrice(p) {
    if (!p && p !== 0) return '';
    return String(p).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ₾';
  }
  function compact(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n/1000000).toFixed(1).replace(/\.0$/,'') + 'M';
    if (n >= 1000)    return (n/1000).toFixed(1).replace(/\.0$/,'') + 'K';
    return String(n);
  }
  function timeAgo(ts) {
    if (!ts) return '';
    var ms = ts.toMillis ? ts.toMillis() : (ts.seconds ? ts.seconds*1000 : Number(ts));
    var d  = Math.floor((Date.now()-ms)/1000);
    if (d < 60)    return 'just now';
    if (d < 3600)  return Math.floor(d/60)+'m ago';
    if (d < 86400) return Math.floor(d/3600)+'h ago';
    return Math.floor(d/86400)+'d ago';
  }
  function toMsBiz(v) {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v && v.seconds) return v.seconds * 1000;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    return Date.parse(v) || 0;
  }
  function starsHtml(rating, cls) {
    var full=Math.floor(rating||0), half=((rating||0)-full)>=0.5, empty=5-full-(half?1:0);
    var out='<span class="'+(cls||'biz-stars')+'">';
    for(var i=0;i<full;i++) out+='★';
    if(half) out+='½';
    for(var j=0;j<empty;j++) out+='☆';
    return out+'</span>';
  }
  function canManagePost(post) {
    if (!_currentUser) return false;
    return _isOwner || _isPageAdmin || (post && post.authorId === _currentUser.uid);
  }

  function isAdminOrOwner() {
    return _isActingAsPage;
  }

  function isOpenNow(wh) {
    if (!wh) return null;
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var h    = wh[days[new Date().getDay()]];
    if (!h || h.closed) return false;
    var now  = new Date(), cur = now.getHours()*60+now.getMinutes();
    var parse = function(t){ var p=(t||'0:0').split(':'); return parseInt(p[0],10)*60+parseInt(p[1],10); };
    return cur >= parse(h.open) && cur < parse(h.close);
  }
  function showToast(msg, ok) {
    if (window.pushNotif) { window.pushNotif({emoji:ok!==false?'✅':'⚠️',title:ok!==false?'Done':'Note',text:msg,link:null}); return; }
    var t = document.getElementById('biz-toast');
    if (!t) { t=document.createElement('div'); t.id='biz-toast'; t.style.cssText='position:fixed;bottom:84px;left:50%;transform:translateX(-50%) translateY(16px);background:#1e293b;color:#f1f5f9;border:1px solid rgba(255,255,255,.1);padding:9px 20px;border-radius:24px;font-size:.85rem;font-weight:600;z-index:99999;transition:all .25s;opacity:0;pointer-events:none;white-space:nowrap'; document.body.appendChild(t); }
    t.textContent=msg; t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)';
    clearTimeout(t._t); t._t=setTimeout(function(){ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(16px)'; },2500);
  }

  // ── SKELETON ─────────────────────────────────────────────────

  function skelBox(w, h, r) {
    return '<div class="biz-skel" style="width:'+w+';height:'+h+'px;border-radius:'+(r||8)+'px"></div>';
  }
  function skeletonPostCard() {
    return '<div class="biz-post-card" style="padding:16px 16px 0">' +
      '<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">' +
        skelBox('44px',44,12) +
        '<div style="flex:1">' + skelBox('55%',13) + '<div style="height:6px"></div>' + skelBox('35%',10) + '</div>' +
      '</div>' +
      skelBox('100%',13) + '<div style="height:7px"></div>' +
      skelBox('80%',13) + '<div style="height:7px"></div>' +
      skelBox('60%',13) +
      '<div style="height:44px"></div>' +
    '</div>';
  }
  function renderPostsSkeleton(n) {
    var out=''; for(var i=0;i<(n||2);i++) out+=skeletonPostCard(); return out;
  }

  // ── RENDER: HEADER ────────────────────────────────────────────

  function renderHeader(biz) {
    var coverStyle = biz.coverUrl
      ? 'background-image:url('+esc(biz.coverUrl)+');background-size:cover;background-position:center'
      : '';
    var logoInner = biz.logoUrl
      ? '<img src="'+esc(biz.logoUrl)+'" alt="'+esc(biz.title)+'">'
      : esc((biz.title||'B')[0]);

    var badges = '';
    if (biz.verified||biz.status==='verified') badges+='<span class="biz-badge biz-badge-verified"><i class="fas fa-check-circle"></i> Verified</span>';
    if (_isOwner)    badges+='<span class="biz-badge biz-badge-owner"><i class="fas fa-crown"></i> Your Page</span>';
    if (biz.featured) badges+='<span class="biz-badge biz-badge-featured"><i class="fas fa-star"></i> Featured</span>';
    if (biz.isOnline) badges+='<span class="biz-badge biz-badge-online"><i class="fas fa-globe"></i> Online</span>';

    var openStatus = isOpenNow(biz.workingHours);
    var openHtml   = openStatus===null ? '' :
      '<span class="biz-hours-status '+(openStatus?'open':'closed')+'">' +
        '<i class="fas fa-circle" style="font-size:.38rem"></i> '+(openStatus?'Open Now':'Closed Now')+
      '</span>';

    var ratingLine = '';
    if ((biz.ratingCount||0)>0) {
      ratingLine = starsHtml(biz.ratingAverage)+
        ' <span class="biz-rating-num">'+(biz.ratingAverage||0).toFixed(1)+'</span>'+
        ' <span class="biz-rating-count">('+biz.ratingCount+' reviews)</span>';
    }
    if ((biz.followerCount||0)>0) ratingLine+=(ratingLine?' <span class="biz-stats-sep">·</span> ':'')+
      '<span class="biz-follower-stat"><strong>'+compact(biz.followerCount)+'</strong> followers</span>';
    if ((biz.saveCount||0)>0) ratingLine+=' <span class="biz-stats-sep">·</span> <span class="biz-follower-stat"><strong>'+compact(biz.saveCount)+'</strong> saves</span>';

    var city = biz.isOnline ? (biz.serviceAreaText||'Online · All Georgia') : esc(biz.city||'Georgia');

    var actions = '';
    if (_isActingAsPage) {
      // ── Page identity mode: show admin controls ───────────────────
      actions =
        '<a href="add-business.html?edit='+esc(BIZ_ID)+'" class="biz-action-btn owner-edit"><i class="fas fa-pen"></i> Edit Page</a>'+
        '<button class="biz-action-btn" onclick="window._bizActions.openCompose()"><i class="fas fa-plus"></i> Create Post</button>'+
        '<button class="biz-action-btn" onclick="window._bizActions.ownerAddPhoto()"><i class="fas fa-camera"></i> Add to Gallery</button>'+
        '<button class="biz-action-btn" onclick="window._bizActions.goToQuotes()"><i class="fas fa-inbox"></i> Quotes</button>'+
        '<input type="file" id="biz-owner-photo-input" accept="image/*" style="display:none" onchange="window._bizActions.handleOwnerPhoto(this)">'+
        '<button class="biz-action-btn" onclick="window._bizActions.switchToPersonal()"><i class="fas fa-user"></i> Switch to Personal</button>';
    } else {
      // ── Personal/visitor mode: show visitor controls ──────────────
      // Owners and admins get a "Switch to Page" button
      var switchPageBtn = (_isOwner || _isPageAdmin)
        ? '<button class="biz-action-btn" onclick="window._bizActions.switchToPage()"><i class="fas fa-store"></i> Switch to Page</button>'
        : '';
      var followCls  = _isFollowing ? 'following' : 'primary';
      var followIcon = _isFollowing ? 'fa-check' : 'fa-plus';
      var followLbl  = _isFollowing ? 'Following' : 'Follow';
      var notifIcon  = _notificationsOn ? 'fas fa-bell' : 'far fa-bell';
      var notifTitle = _notificationsOn ? 'Notifications on' : 'Notifications off';
      actions =
        switchPageBtn +
        '<button class="biz-action-btn '+followCls+'" id="biz-follow-btn" onclick="window._bizActions.toggleFollow()"><i class="fas '+followIcon+'"></i> '+followLbl+'</button>'+
        (_isFollowing ? '<button class="biz-action-btn biz-notif-btn" id="biz-notif-btn" title="'+notifTitle+'" onclick="window._bizActions.toggleNotifications()"><i class="'+notifIcon+'"></i></button>' : '')+
        '<button class="biz-action-btn primary" onclick="window._bizActions.openQuote()"><i class="fas fa-paper-plane"></i> Request Quote</button>'+
        '<button class="biz-action-btn" onclick="window._bizActions.openMessage()"><i class="fas fa-comment-dots"></i> Message</button>'+
        '<button class="biz-action-btn '+ (_isSaved?'saved':'')+'" id="biz-save-btn" onclick="window._bizActions.toggleSave()"><i class="'+(_isSaved?'fas':'far')+' fa-bookmark"></i> '+(_isSaved?'Saved':'Save')+'</button>'+
        '<button class="biz-action-btn" onclick="window._bizActions.share()"><i class="fas fa-share-nodes"></i> Share</button>';
      if (biz.phone) actions+='<a href="tel:'+esc(biz.phone)+'" class="biz-action-btn"><i class="fas fa-phone"></i> Call</a>';
      if (biz.website) {
        var ws=biz.website.startsWith('http')?biz.website:'https://'+biz.website;
        actions+='<a href="'+esc(ws)+'" target="_blank" rel="noopener noreferrer" class="biz-action-btn"><i class="fas fa-globe"></i> Website</a>';
      }
      if (!biz.isOnline && biz.mapsLink) {
        actions+='<a href="'+esc(biz.mapsLink)+'" target="_blank" rel="noopener noreferrer" class="biz-action-btn"><i class="fas fa-map-location-dot"></i> Directions</a>';
      } else if (!biz.isOnline && (biz.address || (biz.lat && biz.lng))) {
        var dq=biz.address||(biz.lat+','+biz.lng);
        actions+='<a href="https://maps.google.com/?q='+encodeURIComponent(dq)+'" target="_blank" rel="noopener noreferrer" class="biz-action-btn"><i class="fas fa-map-location-dot"></i> Directions</a>';
      }
    }

    return '<div class="biz-cover" style="'+coverStyle+'">' +
        (!biz.coverUrl?'<i class="fas fa-store biz-cover-placeholder-icon"></i>':'')+
        (_isActingAsPage ? '<button class="biz-cover-edit-btn" onclick="window._bizActions.editCover()" title="Change cover photo"><i class="fas fa-camera"></i> Edit Cover</button>' : '') +
      '</div>'+
      '<div class="biz-header-body">'+
        '<div class="biz-logo-row">'+
          (_isActingAsPage
            ? '<div class="biz-logo biz-logo-editable" onclick="window._bizActions.editLogo()" title="Change logo">'+logoInner+'<div class="biz-logo-edit-overlay"><i class="fas fa-camera"></i></div></div>'
            : '<div class="biz-logo">'+logoInner+'</div>'
          )+
          (badges?'<div class="biz-logo-badges">'+badges+'</div>':'')+
        '</div>'+
        '<div class="biz-header-info">'+
          '<div class="biz-name-row">'+
            '<h1 class="biz-page-name">'+esc(biz.title||'Business')+'</h1>'+
            ((biz.verified||biz.status==='verified')?'<i class="fas fa-check-circle biz-verified-icon"></i>':'')+
          '</div>'+
          (biz.tagline?'<div class="biz-tagline">'+esc(biz.tagline)+'</div>':'')+
          '<div class="biz-meta-tags">'+
            (biz.category?'<span class="biz-category-tag">'+esc(biz.category)+'</span>':'')+
            '<span class="biz-city-tag"><i class="fas fa-location-dot"></i>'+city+'</span>'+
            openHtml+
          '</div>'+
          (ratingLine?'<div class="biz-rating-line">'+ratingLine+'</div>':'')+
        '</div>'+
        '<div class="biz-header-actions">'+actions+'</div>'+
      '</div>';
  }

  // ── RENDER: CONTACT STRIP ────────────────────────────────────

  function renderContact(biz) {
    var sl = biz.socialLinks || {};
    var btns = [];
    if (biz.phone)    btns.push('<a href="tel:'+esc(biz.phone)+'" class="biz-contact-btn green"><i class="fas fa-phone"></i><span>Call</span></a>');
    if (biz.email)    btns.push('<a href="mailto:'+esc(biz.email)+'" class="biz-contact-btn blue"><i class="fas fa-envelope"></i><span>Email</span></a>');
    if (biz.website) { var ws=biz.website.startsWith('http')?biz.website:'https://'+biz.website; btns.push('<a href="'+esc(ws)+'" target="_blank" rel="noopener noreferrer" class="biz-contact-btn sky"><i class="fas fa-globe"></i><span>Website</span></a>'); }
    if (biz.whatsapp||sl.whatsapp) { var wa=(biz.whatsapp||sl.whatsapp).replace(/\D/g,''); btns.push('<a href="https://wa.me/'+esc(wa)+'" target="_blank" rel="noopener noreferrer" class="biz-contact-btn teal"><i class="fab fa-whatsapp"></i><span>WhatsApp</span></a>'); }
    if (biz.mapsLink) {
      btns.push('<a href="'+esc(biz.mapsLink)+'" target="_blank" rel="noopener noreferrer" class="biz-contact-btn amber"><i class="fas fa-map-location-dot"></i><span>Map</span></a>');
    } else if (biz.address || (biz.lat && biz.lng)) {
      var dq = biz.address || (biz.lat+','+biz.lng);
      btns.push('<a href="https://maps.google.com/?q='+encodeURIComponent(dq)+'" target="_blank" rel="noopener noreferrer" class="biz-contact-btn amber"><i class="fas fa-map-location-dot"></i><span>Directions</span></a>');
    }
    if (biz.instagram||sl.instagram) { var ig=biz.instagram||sl.instagram; var igUrl=ig.startsWith('http')?ig:'https://instagram.com/'+ig.replace('@',''); btns.push('<a href="'+esc(igUrl)+'" target="_blank" rel="noopener noreferrer" class="biz-contact-btn pink"><i class="fab fa-instagram"></i><span>Instagram</span></a>'); }
    if (biz.facebook||sl.facebook) { var fb=biz.facebook||sl.facebook; var fbUrl=fb.startsWith('http')?fb:'https://facebook.com/'+fb.replace('@',''); btns.push('<a href="'+esc(fbUrl)+'" target="_blank" rel="noopener noreferrer" class="biz-contact-btn blue"><i class="fab fa-facebook"></i><span>Facebook</span></a>'); }
    if (!btns.length) return '';
    return '<div class="biz-contact-strip">'+btns.join('')+'</div>';
  }

  // ── RENDER: TAB BAR ──────────────────────────────────────────

  function renderTabBar() {
    var tabs = [
      {id:'overview', label:'Overview'},
      {id:'posts',    label:'Posts'},
      {id:'events',   label:'Events'},
      {id:'services', label:'Services'},
      {id:'products', label:'Products'},
      {id:'photos',   label:'Photos'},
      {id:'reviews',  label:'Reviews'},
      {id:'rewards',  label:'Rewards'},
      {id:'faq',      label:'FAQ'},
      {id:'about',    label:'About'},
    ];
    if (_isActingAsPage) tabs.push({id:'insights',  label:'Insights'});
    if (_isActingAsPage) tabs.push({id:'dashboard', label:'Dashboard'});
    return '<div class="biz-tabs">'+
      tabs.map(function(t,i){
        return '<button class="biz-tab'+(i===0?' active':'')+'" data-tab="'+t.id+'">'+t.label+'</button>';
      }).join('')+
    '</div>';
  }

  // ── RENDER: LEFT SIDEBAR ──────────────────────────────────────

  function renderLeftSidebar(biz) {
    var html = '';
    var sl   = biz.socialLinks || {};

    // About/contact card
    var items = [];
    if (biz.description) items.push('<div class="biz-sidebar-desc">'+esc(biz.description.slice(0,200))+(biz.description.length>200?'…':'')+'</div>');
    if (biz.category)    items.push('<div class="biz-info-item"><i class="fas fa-tag"></i><span>'+esc(biz.category)+'</span></div>');
    if (biz.address)     items.push('<div class="biz-info-item"><i class="fas fa-location-dot"></i><span>'+esc(biz.address)+(biz.city?', '+esc(biz.city):'')+'</span></div>');
    if (biz.phone)       items.push('<div class="biz-info-item"><i class="fas fa-phone"></i><a href="tel:'+esc(biz.phone)+'">'+esc(biz.phone)+'</a></div>');
    if (biz.email)       items.push('<div class="biz-info-item"><i class="fas fa-envelope"></i><a href="mailto:'+esc(biz.email)+'">'+esc(biz.email)+'</a></div>');
    if (biz.website) { var ws=biz.website.startsWith('http')?biz.website:'https://'+biz.website; items.push('<div class="biz-info-item"><i class="fas fa-globe"></i><a href="'+esc(ws)+'" target="_blank" rel="noopener noreferrer">'+esc(biz.website.replace(/^https?:\/\//,'').split('/')[0])+'</a></div>'); }
    if (biz.startingPrice) items.push('<div class="biz-info-item"><i class="fas fa-circle-dollar-to-slot"></i><span>From <strong style="color:#10b981">'+esc(String(biz.startingPrice))+' ₾</strong></span></div>');
    if (items.length) html+='<div class="biz-info-card"><div class="biz-info-card-title"><i class="fas fa-building"></i> About</div>'+items.join('')+'</div>';

    // Hours card
    if (biz.workingHours) {
      var dayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      var todayName=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
      var openStatus=isOpenNow(biz.workingHours);
      var rows=dayNames.map(function(day){
        var h=biz.workingHours[day]; if(!h) return '';
        var isToday=day===todayName;
        var timeStr=h.closed?'<span class="biz-hours-closed-tag">Closed</span>':'<span class="biz-hours-time">'+esc(h.open||'')+' – '+esc(h.close||'')+'</span>';
        return '<div class="biz-hours-row'+(isToday?' today':'')+'"><div class="biz-hours-day">'+day.slice(0,3)+(isToday?' ·':'')+'</div>'+timeStr+'</div>';
      }).filter(Boolean).join('');
      if (rows) {
        var statusBadge=openStatus===null?'':'<span class="biz-hours-status '+(openStatus?'open':'closed')+'" style="margin-left:auto;font-size:.68rem">'+esc(openStatus?'Open':'Closed')+'</span>';
        html+='<div class="biz-info-card"><div class="biz-info-card-title" style="display:flex;align-items:center"><i class="fas fa-clock"></i> Hours'+statusBadge+'</div>'+rows+'<div style="height:8px"></div></div>';
      }
    }

    // Socials card
    var socialLinks = [];
    if (biz.instagram||sl.instagram) { var ig2=biz.instagram||sl.instagram; var iu=ig2.startsWith('http')?ig2:'https://instagram.com/'+ig2.replace('@',''); socialLinks.push('<a href="'+esc(iu)+'" target="_blank" rel="noopener noreferrer" class="biz-social-chip"><i class="fab fa-instagram" style="color:#e1306c"></i> Instagram</a>'); }
    if (biz.facebook||sl.facebook)   { var fb2=biz.facebook||sl.facebook; var fu=fb2.startsWith('http')?fb2:'https://facebook.com/'+fb2.replace('@',''); socialLinks.push('<a href="'+esc(fu)+'" target="_blank" rel="noopener noreferrer" class="biz-social-chip"><i class="fab fa-facebook" style="color:#4267B2"></i> Facebook</a>'); }
    if (biz.whatsapp||sl.whatsapp)   { var wa2=(biz.whatsapp||sl.whatsapp).replace(/\D/g,''); socialLinks.push('<a href="https://wa.me/'+esc(wa2)+'" target="_blank" rel="noopener noreferrer" class="biz-social-chip"><i class="fab fa-whatsapp" style="color:#25D366"></i> WhatsApp</a>'); }
    if (biz.mapsLink) socialLinks.push('<a href="'+esc(biz.mapsLink)+'" target="_blank" rel="noopener noreferrer" class="biz-social-chip"><i class="fas fa-map-location-dot" style="color:#fbbf24"></i> Maps</a>');
    if (socialLinks.length) html+='<div class="biz-info-card"><div class="biz-info-card-title"><i class="fas fa-share-nodes"></i> Connect</div><div class="biz-social-chips">'+socialLinks.join('')+'</div></div>';

    return html || '';
  }

  // ── RENDER: RIGHT SIDEBAR ────────────────────────────────────

  function renderRightSidebar(biz, services, products, reviews, gallery) {
    var html = '';
    var owner = isAdminOrOwner();

    // Services preview
    if (services && services.length) {
      html += '<div class="biz-preview-card">'+
        '<div class="biz-preview-header"><span><i class="fas fa-briefcase"></i> Services</span>'+
          '<button onclick="window._bizActions.switchTab(\'services\')">See all</button>'+
        '</div>'+
        services.slice(0,4).map(function(s){
          var canDetail = !owner && s.id;
          var rowCls = 'biz-preview-service'+(canDetail?' biz-pv-svc-link':'');
          var rowClick = canDetail ? ' onclick="window._bizActions.openSvcDetail(\''+esc(s.id)+'\')"' : '';
          return '<div class="'+rowCls+'"'+rowClick+'>'+
            '<div class="biz-preview-svc-dot"></div>'+
            '<div style="flex:1;min-width:0"><div class="biz-preview-svc-name">'+esc(s.title||s.name||'')+'</div></div>'+
            (s.price?'<span class="biz-preview-svc-price">'+fmtPrice(s.price)+'</span>':'')+
          '</div>';
        }).join('')+
        '<button class="biz-preview-cta" onclick="window._bizActions.openQuote()">Request a Quote</button>'+
      '</div>';
    }

    // Products preview
    if (products && products.length) {
      html += '<div class="biz-preview-card">'+
        '<div class="biz-preview-header"><span><i class="fas fa-box"></i> Products</span>'+
          '<button onclick="window._bizActions.switchTab(\'products\')">See all</button>'+
        '</div>'+
        '<div class="biz-preview-products">'+
          products.slice(0,4).map(function(p){
            var thumb = p.imageUrl
              ? '<img src="'+esc(p.imageUrl)+'" alt="" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\'">'
              : '<div class="biz-preview-product-ph"><i class="fas fa-box"></i></div>';
            var clickFn = !owner && p.id
              ? 'window._bizActions.openProdDetail(\''+esc(p.id)+'\')'
              : 'window._bizActions.switchTab(\'products\')';
            return '<div class="biz-preview-product" onclick="'+clickFn+'">'+
              thumb+
              '<div class="biz-preview-product-name">'+esc(p.name||p.title||'')+'</div>'+
            '</div>';
          }).join('')+
        '</div>'+
      '</div>';
    }

    // Reviews widget — real data only (ratingCount guard already ensures this)
    if ((biz.ratingCount||0) > 0) {
      var reviewLabel = (_currentUser && !_isOwner) ? 'Write a Review' : 'See Reviews';
      html += '<div class="biz-preview-card">'+
        '<div class="biz-preview-header"><span><i class="fas fa-star"></i> Reviews</span>'+
          '<button onclick="window._bizActions.switchTab(\'reviews\')">See all</button>'+
        '</div>'+
        '<div class="biz-preview-rating-widget">'+
          '<div class="biz-preview-big-num">'+(biz.ratingAverage||0).toFixed(1)+'</div>'+
          '<div>'+
            starsHtml(biz.ratingAverage,'biz-preview-stars')+
            '<div style="color:#64748b;font-size:.74rem;margin-top:3px">'+
              biz.ratingCount+' review'+(biz.ratingCount===1?'':'s')+
            '</div>'+
          '</div>'+
        '</div>'+
        '<button class="biz-preview-cta'+((!_currentUser||_isOwner)?' biz-preview-cta-neutral':'')+'" '+
          'onclick="window._bizActions.switchTab(\'reviews\')">'+reviewLabel+'</button>'+
      '</div>';
    }

    // Gallery preview
    if (gallery && gallery.length) {
      html += '<div class="biz-preview-card">'+
        '<div class="biz-preview-header"><span><i class="fas fa-images"></i> Photos</span>'+
          '<button onclick="window._bizActions.switchTab(\'photos\')">See all</button>'+
        '</div>'+
        '<div class="biz-preview-gallery">'+
          gallery.slice(0,6).map(function(p){
            return '<div class="biz-preview-photo" onclick="window._bizActions.openPhoto(\''+esc(p.url)+'\')">'+
              '<img src="'+esc(p.url)+'" loading="lazy" alt="" onerror="this.onerror=null;this.style.display=\'none\'">'+
            '</div>';
          }).join('')+
        '</div>'+
      '</div>';
    }

    // Rewards widget — placeholder, populated async by loadBizRewards()
    html += '<div id="biz-rewards-sidebar" style="display:none"></div>';

    return html || '';
  }

  // ── RENDER: ADMIN TOOLBAR ─────────────────────────────────────

  function renderAdminToolbar(biz) {
    if (!_isActingAsPage) return '';
    return '<div class="biz-admin-toolbar" id="biz-admin-toolbar">'+
      '<div class="biz-admin-toolbar-inner">'+
        '<span class="biz-admin-badge"><i class="fas fa-crown"></i> Admin Mode</span>'+
        '<div class="biz-admin-toolbar-btns">'+
          '<a href="add-business.html?edit='+esc(BIZ_ID)+'" class="biz-admin-btn"><i class="fas fa-pen"></i> Edit Page</a>'+
          '<button class="biz-admin-btn" onclick="window._bizActions.openBlockManager()"><i class="fas fa-plus-circle"></i> Add Block</button>'+
          '<button class="biz-admin-btn" onclick="window._bizActions.openCompose()"><i class="fas fa-pen-to-square"></i> New Post</button>'+
          '<button class="biz-admin-btn" onclick="window._bizActions.goToQuotes()"><i class="fas fa-inbox"></i> Quotes</button>'+
          '<a href="rewards.html" class="biz-admin-btn"><i class="fas fa-gift"></i> My Coupons</a>'+
          '<button class="biz-admin-btn" style="color:#f87171;border-color:rgba(248,113,113,.3)" onclick="window._bizActions.deletePage()"><i class="fas fa-trash"></i> Delete Page</button>'+
        '</div>'+
        '<button class="biz-admin-btn biz-preview-toggle" onclick="window._bizActions.togglePreview()">'+
          '<i class="fas fa-eye"></i> Preview as Visitor'+
        '</button>'+
      '</div>'+
    '</div>';
  }

  // ── RENDER: PAGE BLOCK CARD ────────────────────────────────────

  function renderPageBlockCard(block, idx, total) {
    var controls = _isActingAsPage
      ? '<div class="biz-block-controls">'+
          '<button class="biz-block-btn" title="Edit" onclick="window._bizActions.editBlock(\''+esc(block.id)+'\')"><i class="fas fa-pencil"></i></button>'+
          (idx > 0 ? '<button class="biz-block-btn" title="Move Up" onclick="window._bizActions.moveBlock(\''+esc(block.id)+'\',\'up\')"><i class="fas fa-arrow-up"></i></button>' : '')+
          (idx < total-1 ? '<button class="biz-block-btn" title="Move Down" onclick="window._bizActions.moveBlock(\''+esc(block.id)+'\',\'down\')"><i class="fas fa-arrow-down"></i></button>' : '')+
          '<button class="biz-block-btn delete" title="Delete" onclick="window._bizActions.deleteBlock(\''+esc(block.id)+'\')"><i class="fas fa-trash"></i></button>'+
        '</div>'
      : '';

    var inner = '';
    if (block.type === 'announcement') {
      inner = '<div class="biz-block-type-announcement">'+
        '<div class="biz-block-announce-icon"><i class="fas fa-bullhorn"></i></div>'+
        '<div style="flex:1;min-width:0">'+
          (block.title ? '<div class="biz-block-title">'+esc(block.title)+'</div>' : '')+
          (block.content ? '<div class="biz-block-body">'+esc(block.content)+'</div>' : '')+
        '</div>'+
      '</div>';
    } else if (block.type === 'cta') {
      inner = '<div class="biz-block-type-cta">'+
        (block.title ? '<div class="biz-block-cta-title">'+esc(block.title)+'</div>' : '')+
        (block.content ? '<div class="biz-block-cta-sub">'+esc(block.content)+'</div>' : '')+
        '<div class="biz-block-cta-btns">'+
          '<button class="biz-cta-primary" onclick="window._bizActions.openQuote()"><i class="fas fa-paper-plane"></i> Request a Quote</button>'+
          '<button class="biz-cta-secondary" onclick="window._bizActions.share()"><i class="fas fa-share-nodes"></i> Share</button>'+
        '</div>'+
      '</div>';
    } else {
      inner = '<div class="biz-block-type-text">'+
        (block.title ? '<div class="biz-block-title">'+esc(block.title)+'</div>' : '')+
        (block.content ? '<div class="biz-block-body">'+esc(block.content)+'</div>' : '')+
      '</div>';
    }

    return '<div class="biz-page-block" data-block-id="'+esc(block.id)+'">'+controls+inner+'</div>';
  }

  // ── LOAD PAGE BLOCKS ──────────────────────────────────────────

  function loadPageBlocks() {
    var el = document.getElementById('biz-page-blocks');
    if (!el) return;
    safeSnap(
      _fs.getDocs(_fs.query(
        _fs.collection(_db,'businesses',BIZ_ID,'pageBlocks'),
        _fs.orderBy('order','asc')
      ))
    ).then(function(blocks) {
      var visible = blocks.filter(function(b){ return _isActingAsPage || b.enabled !== false; });
      if (!visible.length) {
        el.innerHTML = _isActingAsPage
          ? '<div class="biz-block-add-prompt" onclick="window._bizActions.openBlockManager()">'+
              '<i class="fas fa-plus-circle"></i>'+
              '<span>Add page blocks — announcements, text, CTAs</span>'+
            '</div>'
          : '';
        return;
      }
      el.innerHTML = visible.map(function(b,i){ return renderPageBlockCard(b, i, visible.length); }).join('');
    });
  }

  // ── RENDER: BLOCK MANAGER MODAL ───────────────────────────────

  function renderBlockManagerModal() {
    return '<div class="biz-modal-overlay" id="biz-block-manager" onclick="if(event.target===this)window._bizActions.closeBlockManager()">'+
      '<div class="biz-modal-sheet" style="max-height:85vh;overflow-y:auto">'+
        '<div class="biz-modal-handle"></div>'+
        '<button class="biz-modal-close" onclick="window._bizActions.closeBlockManager()"><i class="fas fa-times"></i></button>'+
        '<div class="biz-modal-title"><i class="fas fa-layer-group"></i> Page Blocks</div>'+
        '<div class="biz-modal-sub">Add custom sections that appear on your page</div>'+
        '<div class="biz-add-block-form">'+
          '<div class="biz-form-group">'+
            '<label class="biz-form-label">Block Type</label>'+
            '<div class="biz-block-type-row">'+
              '<button class="biz-block-type-chip active" data-btype="text" onclick="window._bizActions.selectBlockType(this,\'text\')"><i class="fas fa-align-left"></i> Text</button>'+
              '<button class="biz-block-type-chip" data-btype="announcement" onclick="window._bizActions.selectBlockType(this,\'announcement\')"><i class="fas fa-bullhorn"></i> Announcement</button>'+
              '<button class="biz-block-type-chip" data-btype="cta" onclick="window._bizActions.selectBlockType(this,\'cta\')"><i class="fas fa-hand-pointer"></i> CTA Buttons</button>'+
            '</div>'+
            '<input type="hidden" id="biz-block-type-val" value="text">'+
          '</div>'+
          '<div class="biz-form-group">'+
            '<label class="biz-form-label">Title <span style="color:#64748b;font-weight:400">(optional)</span></label>'+
            '<input class="biz-form-input" id="biz-block-title-inp" placeholder="Block heading…">'+
          '</div>'+
          '<div class="biz-form-group">'+
            '<label class="biz-form-label">Content</label>'+
            '<textarea class="biz-form-textarea" id="biz-block-content-inp" placeholder="Write something…" style="min-height:80px"></textarea>'+
          '</div>'+
          '<button class="biz-submit-btn" id="biz-add-block-btn" onclick="window._bizActions.saveNewBlock()"><i class="fas fa-plus"></i> Add Block</button>'+
        '</div>'+
        '<div class="biz-block-manager-list-header">Existing Blocks</div>'+
        '<div id="biz-block-manager-list"><div style="color:#64748b;font-size:.82rem;padding:8px 0"><i class="fas fa-spinner fa-spin"></i> Loading…</div></div>'+
      '</div>'+
    '</div>';
  }

  // ── RENDER: 3-COLUMN OVERVIEW ────────────────────────────────

  function renderOverview3Col(biz, services, products, gallery, reviews) {
    return '<div class="biz-overview-3col">'+
      '<div class="biz-left-sidebar">'+renderLeftSidebar(biz)+'</div>'+
      '<div class="biz-center-col">'+
        '<div id="biz-page-blocks"></div>'+
        (_currentUser ? renderComposer(biz) : '')+
        '<div id="biz-posts-overview">'+renderPostsSkeleton(3)+'</div>'+
      '</div>'+
      '<div class="biz-right-sidebar">'+renderRightSidebar(biz, services, products, reviews, gallery)+'</div>'+
    '</div>';
  }

  // ── RENDER: POST COMPOSER ────────────────────────────────────

  function renderComposer(biz) {
    var logo = biz.logoUrl
      ? '<img src="'+esc(biz.logoUrl)+'" alt="">'
      : esc((biz.title||'B')[0]);
    return '<div class="biz-composer" onclick="window._bizActions.openCompose()">'+
      '<div class="biz-composer-logo">'+logo+'</div>'+
      '<div class="biz-composer-placeholder">What\'s happening at '+esc(biz.title||'your business')+'?</div>'+
      '<div class="biz-composer-actions">'+
        '<span class="biz-composer-action"><i class="fas fa-image"></i></span>'+
      '</div>'+
    '</div>';
  }

  // ── RENDER: COMMENT BUBBLE ───────────────────────────────────

  function canManageComment(c) {
    if (!_currentUser) return false;
    return _isOwner || (c && (c.authorId === _currentUser.uid || c.userId === _currentUser.uid));
  }

  // ── LOCAL POST RENDERERS ─────────────────────────────────────

  function replyBubbleHtml(r, postId, commentId) {
    var name = r.authorName || r.userName || 'User';
    var authorId = r.authorId || r.userId || '';
    var profileLink = 'profile.html?id=' + encodeURIComponent(authorId);
    var avInner = r.authorAvatar
      ? '<img src="'+esc(r.authorAvatar)+'" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover" onerror="this.style.display=\'none\'">'
      : '<span class="biz-cmt-av" style="width:26px;height:26px;font-size:.65rem">'+esc((name[0]||'U').toUpperCase())+'</span>';
    var avHtml = authorId
      ? '<a href="'+esc(profileLink)+'" class="biz-cmt-av-link" style="flex-shrink:0">'+avInner+'</a>'
      : '<span style="flex-shrink:0">'+avInner+'</span>';
    var pid = esc(postId);
    var cid = esc(commentId);
    var rid = esc(r.id);
    var canEdit = _currentUser && (_isOwner || r.authorId === _currentUser.uid || r.userId === _currentUser.uid);
    var isAuthor = _currentUser && (r.authorId === _currentUser.uid || r.userId === _currentUser.uid);
    var actionsHtml = canEdit
      ? '<span class="biz-cmt-actions">'+
          (isAuthor ? '<button class="biz-cmt-act-btn" onclick="window._bizActions.editReply(\''+pid+'\',\''+cid+'\',\''+rid+'\',this)">Edit</button>' : '')+
          '<button class="biz-cmt-act-btn" onclick="window._bizActions.deleteReply(\''+pid+'\',\''+cid+'\',\''+rid+'\',this)">Delete</button>'+
        '</span>'
      : '';
    return '<div class="biz-cmt-bubble-wrap" data-rid="'+rid+'" style="margin-top:6px">'+
      avHtml+
      '<div class="biz-cmt-right">'+
        '<div class="biz-cmt-bubble" style="background:rgba(255,255,255,.04)">'+
          '<a href="'+esc(profileLink)+'" class="biz-cmt-bubble-name">'+esc(name)+'</a>'+
          '<div id="biz-reply-text-'+pid+'-'+cid+'-'+rid+'">'+esc(r.text||'')+'</div>'+
        '</div>'+
        '<div class="biz-cmt-bubble-meta">'+
          '<span class="biz-cmt-bubble-time">'+timeAgo(r.createdAt)+'</span>'+
          actionsHtml+
        '</div>'+
      '</div>'+
    '</div>';
  }

  function commentBubbleHtml(c, postId) {
    var name = c.authorName || c.userName || 'User';
    var authorId = c.authorId || c.userId || '';
    var profileLink = 'profile.html?id=' + encodeURIComponent(authorId);
    var avInner = c.authorAvatar
      ? '<img src="'+esc(c.authorAvatar)+'" class="biz-cmt-av-img" alt="" onerror="this.style.display=\'none\'">'
      : '<span class="biz-cmt-av">'+esc((name[0]||'U').toUpperCase())+'</span>';
    var avHtml = authorId
      ? '<a href="'+esc(profileLink)+'" class="biz-cmt-av-link" style="flex-shrink:0">'+avInner+'</a>'
      : '<span style="flex-shrink:0">'+avInner+'</span>';
    var pid = esc(postId);
    var cid = esc(c.id);
    var canEdit  = canManageComment(c);
    var isAuthor = _currentUser && (c.authorId === _currentUser.uid || c.userId === _currentUser.uid);
    var actionsHtml = canEdit
      ? '<span class="biz-cmt-actions">'+
          (isAuthor ? '<button class="biz-cmt-act-btn" onclick="window._bizActions.editComment(\''+pid+'\',\''+cid+'\',this)">Edit</button>' : '')+
          '<button class="biz-cmt-act-btn" onclick="window._bizActions.deleteComment(\''+pid+'\',\''+cid+'\',this)">Delete</button>'+
        '</span>'
      : '';
    var likesHtml = (c.likes > 0)
      ? '<span class="biz-cmt-like-count"><i class="fas fa-thumbs-up"></i> '+c.likes+'</span>'
      : '';
    var replyCount = c.replyCount || 0;

    // Reply composer avatar
    var user = _currentUser;
    var replyAvHtml = user && user.photoURL
      ? '<img src="'+esc(user.photoURL)+'" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display=\'none\'">'
      : user
        ? '<span class="biz-cmt-av" style="width:26px;height:26px;font-size:.65rem;flex-shrink:0">'+esc(((user.displayName||user.email||'U')[0]).toUpperCase())+'</span>'
        : '<span class="biz-cmt-av biz-cmt-av-guest" style="width:26px;height:26px;flex-shrink:0"><i class="fas fa-user" style="font-size:.65rem"></i></span>';

    return '<div class="biz-cmt-bubble-wrap" data-cid="'+cid+'">'+
      avHtml+
      '<div class="biz-cmt-right">'+
        '<div class="biz-cmt-bubble">'+
          '<a href="'+esc(profileLink)+'" class="biz-cmt-bubble-name">'+esc(name)+'</a>'+
          '<div class="biz-cmt-bubble-text" id="biz-cmt-text-'+pid+'-'+cid+'">'+esc(c.text||'')+'</div>'+
        '</div>'+
        '<div class="biz-cmt-bubble-meta">'+
          '<span class="biz-cmt-bubble-time">'+timeAgo(c.createdAt)+'</span>'+
          likesHtml+
          '<button class="biz-cmt-act-btn" onclick="window._bizActions.replyToComment(\''+pid+'\',\''+cid+'\',\''+esc(name)+'\')">Reply</button>'+
          actionsHtml+
        '</div>'+
        '<div class="biz-comment-replies-wrap" style="margin-top:4px">'+
          (replyCount > 0
            ? '<button class="biz-cmt-act-btn biz-view-replies-btn" id="biz-vrb-'+pid+'-'+cid+'" data-count="'+replyCount+'" '+
                'onclick="window._bizActions.toggleReplies(\''+pid+'\',\''+cid+'\',this)">'+
                '<i class="fas fa-chevron-down" style="font-size:.6rem"></i> '+replyCount+' repl'+(replyCount===1?'y':'ies')+
              '</button>'
            : '<span id="biz-vrb-'+pid+'-'+cid+'" data-count="0" style="display:none"></span>')+
          '<div class="biz-replies-section" id="biz-replies-'+pid+'-'+cid+'" style="display:none;padding-left:4px;margin-top:4px"></div>'+
        '</div>'+
        '<div class="biz-reply-composer" id="biz-rpl-'+pid+'-'+cid+'" style="display:none;margin-top:6px">'+
          '<div style="display:flex;gap:7px;align-items:flex-start">'+
            replyAvHtml+
            '<div class="biz-cmt-input-wrap" style="flex:1">'+
              '<textarea class="biz-cmt-textarea" placeholder="Write a reply…" rows="1" '+
                'oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,100)+\'px\'" '+
                'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();window._bizActions.submitBizReply(\''+pid+'\',\''+cid+'\',this);}">'+
              '</textarea>'+
              '<button class="biz-cmt-send-btn" type="button" '+
                'onclick="window._bizActions.submitBizReply(\''+pid+'\',\''+cid+'\',this.parentNode.querySelector(\'textarea\'))">'+
                '<i class="fas fa-paper-plane"></i>'+
              '</button>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }

  // ── RENDER: POST CARD ────────────────────────────────────────
  function postCardHtml(post, biz) {
    var pid = esc(post.id);
    var logo = biz.logoUrl
      ? '<img src="'+esc(biz.logoUrl)+'" alt="">'
      : esc((biz.title||'B')[0]);

    // Media
    var mediaHtml = '';
    var urls = post.mediaUrls && post.mediaUrls.length ? post.mediaUrls : (post.mediaUrl ? [post.mediaUrl] : []);
    if (urls.length === 1) {
      mediaHtml = '<img class="biz-post-media" src="'+esc(urls[0])+'" loading="lazy" alt="" onclick="window._bizActions.openPhoto(\''+esc(urls[0])+'\')">';
    } else if (urls.length > 1) {
      var gridN = Math.min(urls.length, 4);
      mediaHtml = '<div class="biz-post-grid biz-post-grid-'+gridN+'">'+
        urls.slice(0,4).map(function(u,i){
          var extra = (i===3 && urls.length>4) ? '<div class="biz-post-grid-more">+'+(urls.length-4)+'</div>' : '';
          return '<div class="biz-post-grid-item" onclick="window._bizActions.openPhoto(\''+esc(u)+'\')">'+
            '<img src="'+esc(u)+'" loading="lazy" alt="">'+extra+'</div>';
        }).join('')+'</div>';
    }

    // Counts row
    var likeCount    = post.likeCount    || 0;
    var commentCount = post.commentCount || 0;
    var countsHtml = (likeCount > 0 || commentCount > 0)
      ? '<div class="biz-post-count-row">'+
          (likeCount > 0 ? '<span id="biz-lk-cnt-'+pid+'">👍 '+compact(likeCount)+'</span>' : '')+
          (commentCount > 0 ? '<button class="biz-count-btn" onclick="window._bizActions.toggleBizComment(\''+pid+'\')">'+commentCount+' comment'+(commentCount===1?'':'s')+'</button>' : '')+
        '</div>'
      : '';

    // Reaction picker
    var rxPickerHtml = REACTIONS.map(function(r){
      return '<button class="biz-rx-item" title="'+esc(r.label)+'" onclick="window._bizActions.setReaction(\''+pid+'\',\''+r.key+'\')">'+r.emoji+'</button>';
    }).join('');

    // Commenter avatar for composer
    var user = _currentUser;
    var cmtAvHtml;
    if (user && user.photoURL) {
      cmtAvHtml = '<img src="'+esc(user.photoURL)+'" class="biz-cmt-av-img" alt="" onerror="this.style.display=\'none\'">';
    } else if (user) {
      cmtAvHtml = '<span class="biz-cmt-av">'+esc(((user.displayName||user.email||'U')[0]).toUpperCase())+'</span>';
    } else {
      cmtAvHtml = '<span class="biz-cmt-av biz-cmt-av-guest"><i class="fas fa-user"></i></span>';
    }

    // Visibility icon
    var visIcon = { 'followers':'<i class="fas fa-user-group"></i>', 'private':'<i class="fas fa-lock"></i>' }[post.visibility] || '';
    var visBadge = visIcon ? '<span class="biz-vis-badge">'+visIcon+'</span>' : '';

    // Owner menu
    var menuHtml = '';
    if (canManagePost(post)) {
      var isPinned = !!post.pinned;
      var cmtOff   = !!post.commentsDisabled;
      var vis      = post.visibility || 'public';
      menuHtml =
        '<div class="biz-post-menu-wrap">'+
          '<button class="biz-post-menu-btn" title="Post options" '+
            'onclick="event.stopPropagation();window._bizActions.openPostMenu(\''+pid+'\',this)">'+
            '<i class="fas fa-ellipsis"></i>'+
          '</button>'+
          '<div class="biz-post-menu-dropdown" id="biz-pmenu-'+pid+'">'+
            '<button class="biz-pmenu-item" onclick="window._bizActions.editPost(\''+pid+'\')"><i class="fas fa-pen"></i> Edit post</button>'+
            '<button class="biz-pmenu-item" onclick="window._bizActions.pinPost(\''+pid+'\')">'+
              '<i class="fas fa-thumbtack"></i> '+(isPinned?'Unpin post':'Pin post')+
            '</button>'+
            '<div class="biz-pmenu-sep"></div>'+
            '<button class="biz-pmenu-item" onclick="window._bizActions.togglePostComments(\''+pid+'\')">'+
              '<i class="fas fa-comment-slash"></i> '+(cmtOff?'Enable comments':'Disable comments')+
            '</button>'+
            '<div class="biz-pmenu-sep"></div>'+
            '<button class="biz-pmenu-item" onclick="window._bizActions.setPostVisibility(\''+pid+'\',\'public\')">'+
              '<i class="fas fa-globe"></i> Public'+(vis==='public'?' <span class="biz-pmenu-check"><i class="fas fa-check"></i></span>':'')+
            '</button>'+
            '<button class="biz-pmenu-item" onclick="window._bizActions.setPostVisibility(\''+pid+'\',\'followers\')">'+
              '<i class="fas fa-user-group"></i> Followers only'+(vis==='followers'?' <span class="biz-pmenu-check"><i class="fas fa-check"></i></span>':'')+
            '</button>'+
            '<button class="biz-pmenu-item" onclick="window._bizActions.setPostVisibility(\''+pid+'\',\'private\')">'+
              '<i class="fas fa-lock"></i> Private'+(vis==='private'?' <span class="biz-pmenu-check"><i class="fas fa-check"></i></span>':'')+
            '</button>'+
            '<div class="biz-pmenu-sep"></div>'+
            '<button class="biz-pmenu-item danger" onclick="window._bizActions.deletePost(\''+pid+'\')"><i class="fas fa-trash"></i> Delete post</button>'+
          '</div>'+
        '</div>';
    }

    // Comment section inner
    var cmtInner;
    if (post.commentsDisabled) {
      cmtInner =
        '<div class="biz-cmt-thread" id="biz-cmt-list-'+pid+'"></div>'+
        '<div class="biz-cmt-off"><i class="fas fa-comment-slash"></i> Comments are turned off.</div>';
    } else {
      cmtInner =
        '<div class="biz-cmt-thread" id="biz-cmt-list-'+pid+'">'+
          '<div class="biz-cmt-empty">No comments yet.</div>'+
        '</div>'+
        '<div class="biz-cmt-composer">'+
          cmtAvHtml+
          '<div class="biz-cmt-input-wrap">'+
            '<textarea class="biz-cmt-textarea" placeholder="Write a comment…" rows="1" '+
              'oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,120)+\'px\'" '+
              'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();window._bizActions.submitBizComment(\''+pid+'\',this);}">'+
            '</textarea>'+
            '<button class="biz-cmt-send-btn" type="button" '+
              'onclick="window._bizActions.submitBizComment(\''+pid+'\',this.parentNode.querySelector(\'textarea\'))">'+
              '<i class="fas fa-paper-plane"></i>'+
            '</button>'+
          '</div>'+
        '</div>';
    }

    var viewsHtml = isAdminOrOwner()
      ? '<div class="biz-post-views" id="biz-views-'+pid+'">'+
          '<i class="fas fa-eye"></i> '+(post.viewCount||0)+' views'+
        '</div>'
      : '';

    var bizLink = 'business.html?id='+esc(BIZ_ID);

    // Visitor posts show the user's identity; business posts show the page logo
    var isUserPost = post.authorType === 'user';
    var postHeaderHtml;
    if (isUserPost) {
      var uName = post.authorName || 'Visitor';
      var uAv   = post.authorAvatar || '';
      var uLink = 'profile.html?id=' + encodeURIComponent(post.authorId || '');
      var uAvInner = uAv
        ? '<img src="'+esc(uAv)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display=\'none\'">'
        : esc((uName[0]||'U').toUpperCase());
      postHeaderHtml =
        '<a href="'+esc(uLink)+'" class="biz-post-logo-link"><div class="biz-post-logo" style="border-radius:50%">'+uAvInner+'</div></a>'+
        '<div class="biz-post-meta">'+
          '<a href="'+esc(uLink)+'" class="biz-post-name-link">'+esc(uName)+'</a>'+
          '<div class="biz-post-time">'+timeAgo(post.createdAt)+
            (biz.title ? ' · <a href="'+bizLink+'" style="color:#10b981;text-decoration:none;font-size:.75rem">on '+esc(biz.title)+'</a>' : '')+
            ' · <i class="fas fa-earth-americas" style="font-size:.7rem;opacity:.6"></i>'+
          '</div>'+
        '</div>';
    } else {
      postHeaderHtml =
        '<a href="'+bizLink+'" class="biz-post-logo-link"><div class="biz-post-logo">'+logo+'</div></a>'+
        '<div class="biz-post-meta">'+
          '<a href="'+bizLink+'" class="biz-post-name-link">'+esc(biz.title||'Business')+
            ((biz.verified||biz.status==='verified')?' <i class="fas fa-check-circle" style="color:#34d399;font-size:.72rem"></i>':'')+
            visBadge+
          '</a>'+
          '<div class="biz-post-time">'+timeAgo(post.createdAt)+' · <i class="fas fa-earth-americas" style="font-size:.7rem;opacity:.6"></i></div>'+
        '</div>';
    }

    return '<div class="biz-post-card" data-post-id="'+pid+'"'+
        (post.pinned ? ' data-pinned="1"' : '')+
        ' data-vis="'+esc(post.visibility||'public')+'"'+'>'+
      (post.pinned ? '<div class="biz-post-pinned"><i class="fas fa-thumbtack"></i> Pinned post</div>' : '')+
      '<div class="biz-post-header">'+
        postHeaderHtml+
        menuHtml+
      '</div>'+
      (post.text ? '<div class="biz-post-text">'+esc(post.text)+'</div>' : '')+
      mediaHtml+
      viewsHtml+
      countsHtml+
      '<div class="biz-post-reactions">'+
        '<div class="biz-rx-wrap" data-pid="'+pid+'">'+
          '<div class="biz-rx-picker" id="biz-rxp-'+pid+'">'+rxPickerHtml+'</div>'+
          '<button class="biz-react-btn" '+
            'onclick="window._bizActions.toggleReaction(\''+pid+'\')" '+
            'oncontextmenu="event.preventDefault();window._bizActions.openReactionPicker(\''+pid+'\')" '+
            'ontouchstart="window._bizActions._rxLongPress(\''+pid+'\',event)" '+
            'ontouchend="window._bizActions._rxCancelPress()" '+
            'ontouchmove="window._bizActions._rxCancelPress()">'+
            '<i class="far fa-thumbs-up"></i> Like'+
          '</button>'+
        '</div>'+
        '<button class="biz-react-btn" onclick="window._bizActions.toggleBizComment(\''+pid+'\')"><i class="far fa-comment"></i> Comment</button>'+
        '<button class="biz-react-btn" onclick="window._bizActions.openShareModal(\''+pid+'\')"><i class="fas fa-share-nodes"></i> Share</button>'+
      '</div>'+
      '<div class="biz-cmt-section" id="biz-cmt-'+pid+'" style="display:none">'+
        cmtInner+
      '</div>'+
    '</div>';
  }

  // ── END LOCAL POST RENDERERS ────────────────────────────────

  // ── RENDER: SERVICE CARDS ────────────────────────────────────

  var SVC_ICONS = ['fa-star','fa-bolt','fa-palette','fa-code','fa-camera','fa-chart-bar','fa-music','fa-heart','fa-wrench','fa-car','fa-briefcase','fa-scissors','fa-laptop','fa-utensils','fa-dumbbell'];

  function renderServiceCards(services) {
    var owner = isAdminOrOwner();
    _svcMap = {};
    if (services) services.forEach(function(s){ if (s.id) _svcMap[s.id] = s; });
    var header = '<div class="biz-section-header">'+
      '<div class="biz-section-title"><i class="fas fa-briefcase"></i> Services</div>'+
      (owner ? '<button class="biz-section-add-btn" onclick="window._bizActions.openAddService()"><i class="fas fa-plus"></i> Add Service</button>' : '')+
    '</div>';
    if (!services || !services.length) {
      return '<div class="biz-section">'+header+
        '<div class="biz-empty-state"><i class="fas fa-list-check"></i>'+
        (owner
          ? '<p>Add your first service so visitors know what you offer.</p>'+
            '<button class="biz-section-add-btn" style="margin-top:8px" onclick="window._bizActions.openAddService()"><i class="fas fa-plus"></i> Add Service</button>'
          : '<p>No services listed yet.</p>')+
        '</div></div>';
    }
    var cards = services.map(function(s, i) {
      var icon = s.icon ? s.icon : SVC_ICONS[i % SVC_ICONS.length];
      var cardAttr = !owner ? ' onclick="window._bizActions.openSvcDetail(\''+esc(s.id||'')+'\')" style="cursor:pointer"' : '';
      return '<div class="biz-service-card"'+cardAttr+'>'+
        (owner ? '<div class="biz-owner-card-actions">'+
          '<button class="biz-cmt-act-btn" title="Edit" onclick="window._bizActions.editService(\''+esc(s.id||'')+'\')"><i class="fas fa-pencil"></i></button>'+
          '<button class="biz-cmt-act-btn" title="Delete" style="color:#f87171" onclick="window._bizActions.deleteService(\''+esc(s.id||'')+'\')"><i class="fas fa-trash"></i></button>'+
        '</div>' : '')+
        '<div class="biz-service-card-top">'+
          '<div class="biz-service-card-icon"><i class="fas '+esc(icon)+'"></i></div>'+
          (s.price?'<div class="biz-service-card-price">'+fmtPrice(s.price)+'</div>':'')+
        '</div>'+
        '<div class="biz-service-card-name">'+esc(s.title||s.name||'')+'</div>'+
        (s.description?'<div class="biz-service-card-desc">'+esc(s.description)+'</div>':'')+
        (s.duration?'<div class="biz-service-card-meta"><i class="fas fa-clock"></i> '+esc(s.duration)+'</div>':'')+
        (!owner ? '<button class="biz-service-cta" onclick="event.stopPropagation();window._bizActions.openQuote(\''+esc(s.title||s.name||'')+'\',\''+esc(s.id||'')+'\',\'service\')"><i class="fas fa-paper-plane"></i> Request Service</button>' : '')+
      '</div>';
    }).join('');
    return '<div class="biz-section">'+header+'<div class="biz-service-cards-grid">'+cards+'</div></div>';
  }

  // ── RENDER: PRODUCT CARDS ────────────────────────────────────

  function renderProductCards(products) {
    var owner = isAdminOrOwner();
    _prodMap = {};
    if (products) products.forEach(function(p){ if (p.id) _prodMap[p.id] = p; });
    var header = '<div class="biz-section-header">'+
      '<div class="biz-section-title"><i class="fas fa-box"></i> Products</div>'+
      (owner ? '<button class="biz-section-add-btn" onclick="window._bizActions.openAddProduct()"><i class="fas fa-plus"></i> Add Product</button>' : '')+
    '</div>';
    if (!products || !products.length) {
      return '<div class="biz-section">'+header+
        '<div class="biz-empty-state"><i class="fas fa-box-open"></i>'+
        (owner
          ? '<p>Add your first product to showcase what you sell.</p>'+
            '<button class="biz-section-add-btn" style="margin-top:8px" onclick="window._bizActions.openAddProduct()"><i class="fas fa-plus"></i> Add Product</button>'
          : '<p>No products listed yet.</p>')+
        '</div></div>';
    }
    var cards = products.map(function(p) {
      var thumbHtml = p.imageUrl
        ? '<img src="'+esc(p.imageUrl)+'" alt="'+esc(p.name||'')+'" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\';var ph=this.parentNode.querySelector(\'.biz-product-ph\');if(ph)ph.style.display=\'flex\'">'
          + '<div class="biz-product-ph" style="display:none"><i class="fas fa-box"></i></div>'
        : '<div class="biz-product-ph"><i class="fas fa-box"></i></div>';
      var cardAttr = !owner ? ' onclick="window._bizActions.openProdDetail(\''+esc(p.id||'')+'\')" style="cursor:pointer"' : '';
      return '<div class="biz-product-card"'+cardAttr+'>'+
        '<div class="biz-product-thumb">'+thumbHtml+
          (owner ? '<div class="biz-gallery-del-wrap" onclick="event.stopPropagation()"><button class="biz-gallery-del-btn" title="Delete product" onclick="window._bizActions.deleteProduct(\''+esc(p.id||'')+'\')"><i class="fas fa-trash"></i></button></div>' : '')+
        '</div>'+
        '<div class="biz-product-body">'+
          '<div class="biz-product-name">'+esc(p.name||p.title||'')+'</div>'+
          (p.description?'<div class="biz-product-desc">'+esc(p.description.slice(0,90))+'</div>':'')+
          '<div class="biz-product-footer">'+
            (p.price?'<span class="biz-product-price">'+fmtPrice(p.price)+'</span>':'')+
            (!owner ? '<button class="biz-product-cta" onclick="event.stopPropagation();window._bizActions.openQuote(\''+esc(p.name||p.title||'')+'\',\''+esc(p.id||'')+'\',\'product\')">Ask about Product</button>' : '')+
          '</div>'+
        '</div>'+
      '</div>';
    }).join('');
    return '<div class="biz-section">'+header+'<div class="biz-product-cards-grid">'+cards+'</div></div>';
  }

  // ── RENDER: PRICE LIST ───────────────────────────────────────

  function renderPriceList(items) {
    var owner = isAdminOrOwner();
    if (!items || !items.length) {
      if (!owner) return '';
      return '<div class="biz-section" style="margin-top:14px">'+
        '<div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-tag"></i> Price List</div>'+
        '<button class="biz-section-add-btn" onclick="window._bizActions.openAddPriceItem()"><i class="fas fa-plus"></i> Add Item</button></div>'+
        '<div class="biz-empty-state"><i class="fas fa-tag"></i><p>Add price items to show your rates.</p></div></div>';
    }
    var rows = items.map(function(item){
      return '<div class="biz-price-item">'+
        '<span class="biz-price-label">'+esc(item.label||item.name||item.title||'')+'</span>'+
        '<span class="biz-price-dots"></span>'+
        '<span class="biz-price-val">'+esc(item.price||'')+'</span>'+
        (owner ? '<button class="biz-cmt-act-btn" title="Delete" style="color:#f87171;margin-left:8px;flex-shrink:0" onclick="window._bizActions.deletePriceItem(\''+esc(item.id||'')+'\')"><i class="fas fa-trash"></i></button>' : '')+
      '</div>';
    }).join('');
    return '<div class="biz-section" style="margin-top:14px">'+
      '<div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-tag"></i> Price List</div>'+
      (owner
        ? '<button class="biz-section-add-btn" onclick="window._bizActions.openAddPriceItem()"><i class="fas fa-plus"></i> Add Item</button>'
        : '<span class="biz-section-badge">'+items.length+' items</span>')+
      '</div>'+
      '<div class="biz-section-body">'+rows+'</div></div>';
  }

  // ── RENDER: GALLERY ──────────────────────────────────────────

  function renderGallery(photos) {
    var owner = isAdminOrOwner();
    var addBtn = owner
      ? '<button class="biz-section-add-btn" onclick="window._bizActions.openOwnerPhotoInGallery()"><i class="fas fa-plus"></i> Add Photo</button>'
      : '';
    var fileInput = owner
      ? '<input type="file" id="biz-gallery-file-input" accept="image/*" style="display:none" onchange="window._bizActions.handleGalleryPhoto(this)">'
      : '';
    if (!photos || !photos.length) {
      return '<div class="biz-section">'+
        '<div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-images"></i> Photos</div>'+addBtn+'</div>'+
        '<div class="biz-empty-state"><i class="fas fa-images"></i>'+
        (owner ? '<p>Upload photos to show off your business.</p>' : '<p>No photos yet.</p>')+
        '</div>'+fileInput+'</div>';
    }
    var sorted = photos.slice().sort(function(a,b){return (a.order||0)-(b.order||0);});
    var items  = sorted.map(function(p){
      return '<div class="biz-gallery-item" onclick="window._bizActions.openPhoto(\''+esc(p.url)+'\')">'+
        '<img src="'+esc(p.url)+'" alt="'+esc(p.caption||'')+'" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\'">'+
        (p.caption?'<div class="biz-gallery-caption">'+esc(p.caption)+'</div>':'')+
        (owner ? '<div class="biz-gallery-del-wrap" onclick="event.stopPropagation()"><button class="biz-gallery-del-btn" title="Delete photo" onclick="window._bizActions.deleteGalleryPhoto(\''+esc(p.id||'')+'\')"><i class="fas fa-trash"></i></button></div>' : '')+
      '</div>';
    }).join('');
    return '<div class="biz-section">'+
      '<div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-images"></i> Photos</div>'+
      (owner ? addBtn : '<span class="biz-section-badge">'+sorted.length+'</span>')+
      '</div>'+
      '<div class="biz-gallery-masonry">'+items+'</div>'+
      fileInput+'</div>';
  }

  // ── RENDER: REVIEWS ──────────────────────────────────────────

  function renderReviews(reviews, biz) {
    var form = '';
    if (_currentUser && !_isOwner) {
      form = '<div class="biz-review-form">'+
        '<div class="biz-review-form-title">Write a Review</div>'+
        '<div class="biz-star-select">'+[1,2,3,4,5].map(function(n){return '<button type="button" class="biz-star-btn" onclick="window._bizActions.setReviewStar('+n+')">☆</button>';}).join('')+'</div>'+
        '<textarea class="biz-review-input" id="biz-review-text" placeholder="Share your experience…"></textarea>'+
        '<button class="biz-submit-btn" id="biz-review-submit-btn" onclick="window._bizActions.submitReview()"><i class="fas fa-paper-plane"></i> Submit Review</button>'+
      '</div>';
    } else if (!_currentUser) {
      form = '<div style="background:rgba(255,255,255,.04);border-radius:12px;padding:14px;margin-bottom:14px;text-align:center;font-size:.84rem;color:#94a3b8"><a href="auth.html" style="color:#10b981;font-weight:700">Sign in</a> to leave a review.</div>';
    }
    var summary = '';
    if ((biz.ratingCount||0)>0) {
      summary='<div class="biz-rating-summary"><div>'+
        '<div class="biz-rating-big">'+(biz.ratingAverage||0).toFixed(1)+'</div>'+
        starsHtml(biz.ratingAverage,'biz-rating-stars-big')+
        '<div class="biz-rating-count-label">'+biz.ratingCount+' reviews</div>'+
      '</div></div>';
    }
    var cards = (!reviews||!reviews.length)
      ? '<div class="biz-empty-state" style="padding:16px 0"><i class="fas fa-star"></i><p>No reviews yet — be the first!</p></div>'
      : reviews.map(function(r){
          var replyHtml = '';
          if (r.ownerReply) {
            replyHtml = '<div class="biz-owner-reply"><i class="fas fa-reply"></i> <strong>Owner replied:</strong> <span>'+esc(r.ownerReply)+'</span></div>';
          } else if (_isOwner) {
            replyHtml = '<div id="biz-reply-wrap-'+esc(r.id||'')+'">'+
              '<button class="biz-cmt-act-btn biz-reply-toggle-btn" onclick="window._bizActions.replyToReview(\''+esc(r.id||'')+'\')"><i class="fas fa-reply"></i> Reply</button>'+
            '</div>';
          }
          return '<div class="biz-review-card">'+
            '<div class="biz-review-header"><span class="biz-review-author">'+esc(r.authorName||'User')+'</span><span class="biz-review-date">'+timeAgo(r.createdAt)+'</span></div>'+
            '<div class="biz-review-stars">'+'★'.repeat(r.rating||0)+'☆'.repeat(5-(r.rating||0))+'</div>'+
            (r.text?'<div class="biz-review-text">'+esc(r.text)+'</div>':'')+
            replyHtml+
          '</div>';
        }).join('');
    return '<div class="biz-section">'+
      '<div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-star"></i> Reviews</div>'+
      ((biz.ratingCount||0)>0?'<span class="biz-section-badge">★ '+(biz.ratingAverage||0).toFixed(1)+'</span>':'')+
      '</div><div class="biz-section-body">'+summary+form+cards+'</div></div>';
  }

  // ── RENDER: ABOUT TAB ────────────────────────────────────────

  function renderAboutTab(biz) {
    var sl = biz.socialLinks || {};
    var sections = [];

    if (biz.description) sections.push('<div class="biz-section"><div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-info-circle"></i> About</div></div>'+
      '<div class="biz-section-body"><p class="biz-about-text">'+esc(biz.description)+'</p>'+
      (biz.tagline?'<p style="font-style:italic;color:#64748b;margin-top:8px;font-size:.84rem">\''+esc(biz.tagline)+'\'</p>':'')+
      (biz.startingPrice?'<p style="margin-top:10px;font-size:.82rem;color:#94a3b8">From <strong style="color:#10b981">'+esc(String(biz.startingPrice))+' ₾</strong></p>':'')+
      '</div></div>');

    var ci = [];
    if (biz.phone)    ci.push('<div class="biz-info-item"><i class="fas fa-phone"></i><a href="tel:'+esc(biz.phone)+'">'+esc(biz.phone)+'</a></div>');
    if (biz.email)    ci.push('<div class="biz-info-item"><i class="fas fa-envelope"></i><a href="mailto:'+esc(biz.email)+'">'+esc(biz.email)+'</a></div>');
    if (biz.website) { var ws=biz.website.startsWith('http')?biz.website:'https://'+biz.website; ci.push('<div class="biz-info-item"><i class="fas fa-globe"></i><a href="'+esc(ws)+'" target="_blank" rel="noopener noreferrer">'+esc(biz.website)+'</a></div>'); }
    if (biz.address)  ci.push('<div class="biz-info-item"><i class="fas fa-location-dot"></i><span>'+esc(biz.address)+(biz.city?', '+esc(biz.city):'')+'</span></div>');
    if (biz.mapsLink) ci.push('<div class="biz-info-item"><i class="fas fa-map-location-dot"></i><a href="'+esc(biz.mapsLink)+'" target="_blank" rel="noopener noreferrer">View on Maps</a></div>');
    if (ci.length) sections.push('<div class="biz-section"><div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-address-card"></i> Contact</div></div><div class="biz-section-body">'+ci.join('')+'</div></div>');

    var socs = [];
    if (biz.instagram||sl.instagram) { var ig2=biz.instagram||sl.instagram; var iu=ig2.startsWith('http')?ig2:'https://instagram.com/'+ig2.replace('@',''); socs.push('<div class="biz-info-item"><i class="fab fa-instagram" style="color:#e1306c"></i><a href="'+esc(iu)+'" target="_blank" rel="noopener noreferrer">Instagram</a></div>'); }
    if (biz.facebook||sl.facebook)   { var fb2=biz.facebook||sl.facebook; var fu=fb2.startsWith('http')?fb2:'https://facebook.com/'+fb2.replace('@',''); socs.push('<div class="biz-info-item"><i class="fab fa-facebook" style="color:#4267B2"></i><a href="'+esc(fu)+'" target="_blank" rel="noopener noreferrer">Facebook</a></div>'); }
    if (biz.whatsapp||sl.whatsapp)   { var wa2=(biz.whatsapp||sl.whatsapp).replace(/\D/g,''); socs.push('<div class="biz-info-item"><i class="fab fa-whatsapp" style="color:#25D366"></i><a href="https://wa.me/'+esc(wa2)+'" target="_blank" rel="noopener noreferrer">WhatsApp</a></div>'); }
    if (socs.length) sections.push('<div class="biz-section"><div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-share-nodes"></i> Social</div></div><div class="biz-section-body">'+socs.join('')+'</div></div>');

    if (biz.workingHours) {
      var dn=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      var tn=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
      var rs=dn.map(function(day){
        var h=biz.workingHours[day]; if(!h) return '';
        var it=day===tn;
        var ts=h.closed?'<span class="biz-hours-closed-tag">Closed</span>':'<span class="biz-hours-time">'+esc(h.open||'')+' – '+esc(h.close||'')+'</span>';
        return '<div class="biz-hours-row'+(it?' today':'')+'"><div class="biz-hours-day">'+day+(it?' ·':'')+'</div>'+ts+'</div>';
      }).filter(Boolean).join('');
      if (rs) sections.push('<div class="biz-section"><div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-clock"></i> Hours</div></div>'+rs+'<div style="height:8px"></div></div>');
    }

    return sections.join('') || '<div class="biz-empty-state"><i class="fas fa-info-circle"></i><p>No additional info yet.</p></div>';
  }

  // ── RENDER: OWNER DASHBOARD ──────────────────────────────────

  function renderOwnerDashboard(biz) {
    var stats = [
      {val: biz.viewCount||0,      label: 'Page Views',    icon: 'fa-eye',        color: '#3b82f6'},
      {val: biz.followerCount||0,  label: 'Followers',     icon: 'fa-users',       color: '#10b981'},
      {val: biz.saveCount||0,      label: 'Saves',         icon: 'fa-bookmark',    color: '#f59e0b'},
      {val: biz.quoteCount||0,     label: 'Quote Requests',icon: 'fa-paper-plane', color: '#8b5cf6'},
      {val: biz.reviewCount||biz.ratingCount||0, label: 'Reviews', icon: 'fa-star', color: '#f43f5e'},
      {val: (biz.ratingAverage||0).toFixed(1), label: 'Avg Rating', icon: 'fa-star-half-stroke', color: '#f59e0b'},
    ];
    return '<div class="biz-dashboard">'+
      '<div class="biz-dash-header"><i class="fas fa-crown"></i> Owner Dashboard</div>'+
      '<div class="biz-dash-stats">'+
        stats.map(function(s){
          return '<div class="biz-dash-stat">'+
            '<div class="biz-dash-stat-icon" style="color:'+s.color+';background:'+s.color+'1a"><i class="fas '+s.icon+'"></i></div>'+
            '<div class="biz-dash-stat-val">'+s.val+'</div>'+
            '<div class="biz-dash-stat-label">'+s.label+'</div>'+
          '</div>';
        }).join('')+
      '</div>'+
      '<div class="biz-dash-actions">'+
        '<a href="add-business.html?edit='+esc(BIZ_ID)+'" class="biz-owner-action-btn edit"><i class="fas fa-pen"></i> Edit Page Info</a>'+
        '<button class="biz-owner-action-btn photo" onclick="window._bizActions.ownerAddPhoto()"><i class="fas fa-camera"></i> Add to Gallery</button>'+
        '<button class="biz-owner-action-btn quotes" onclick="window._bizActions.loadOwnerQuotes()"><i class="fas fa-inbox"></i> View Quote Requests</button>'+
        '<button class="biz-owner-action-btn" onclick="window._bizActions.switchTab(\'insights\')" style="background:rgba(59,130,246,.12);border-color:rgba(59,130,246,.3);color:#60a5fa"><i class="fas fa-chart-line"></i> View Insights</button>'+
      '</div>'+
      '<div id="biz-owner-quotes-panel" style="display:none;padding:0 16px 14px"></div>'+
      '<div class="biz-dash-section" style="padding:0 16px 14px">'+
        '<div class="biz-dash-section-title"><i class="fas fa-user-shield"></i> Page Admins</div>'+
        '<div class="biz-admin-add-form" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'+
          '<input class="biz-form-input" id="biz-new-admin-uid" placeholder="User ID" style="flex:1;min-width:160px">'+
          '<select class="biz-form-input" id="biz-new-admin-role" style="width:130px">'+
            '<option value="moderator">Moderator</option>'+
            '<option value="editor">Editor</option>'+
            '<option value="admin">Admin</option>'+
          '</select>'+
          '<button class="biz-submit-btn" style="padding:9px 16px" onclick="window._bizActions.addPageAdmin(document.getElementById(\'biz-new-admin-uid\').value.trim(),document.getElementById(\'biz-new-admin-role\').value)"><i class="fas fa-plus"></i> Add</button>'+
        '</div>'+
        '<div id="biz-admin-list"><div style="color:#64748b;font-size:.82rem"><i class="fas fa-spinner fa-spin"></i> Loading…</div></div>'+
      '</div>'+
    '</div>';
  }

  // ── RENDER: DETAIL MODALS ────────────────────────────────────

  function renderServiceDetailModal() {
    return '<div class="biz-modal-overlay" id="biz-svc-detail" onclick="if(event.target===this)window._bizActions.closeSvcDetail()">'+
      '<div class="biz-modal-sheet">'+
        '<div class="biz-modal-handle"></div>'+
        '<button class="biz-modal-close" onclick="window._bizActions.closeSvcDetail()"><i class="fas fa-times"></i></button>'+
        '<div class="biz-detail-icon-row">'+
          '<div class="biz-detail-svc-icon" id="biz-svc-d-icon"><i class="fas fa-briefcase"></i></div>'+
          '<span class="biz-detail-price-chip" id="biz-svc-d-price"></span>'+
        '</div>'+
        '<div class="biz-modal-title" id="biz-svc-d-name" style="margin-top:12px"></div>'+
        '<div class="biz-detail-biz-name" id="biz-svc-d-biz"></div>'+
        '<div class="biz-detail-meta" id="biz-svc-d-meta"></div>'+
        '<div class="biz-detail-desc" id="biz-svc-d-desc"></div>'+
        '<button class="biz-submit-btn" id="biz-svc-d-cta"><i class="fas fa-paper-plane"></i> Request Service</button>'+
      '</div>'+
    '</div>';
  }

  function renderProductDetailModal() {
    return '<div class="biz-modal-overlay" id="biz-prod-detail" onclick="if(event.target===this)window._bizActions.closeProdDetail()">'+
      '<div class="biz-modal-sheet">'+
        '<div class="biz-modal-handle"></div>'+
        '<button class="biz-modal-close" onclick="window._bizActions.closeProdDetail()"><i class="fas fa-times"></i></button>'+
        '<div class="biz-detail-product-img-wrap" id="biz-prod-d-img-wrap" style="display:none">'+
          '<img id="biz-prod-d-img" src="" alt="" loading="lazy" onerror="this.parentNode.style.display=\'none\'">'+
        '</div>'+
        '<div class="biz-modal-title" id="biz-prod-d-name" style="margin-top:12px"></div>'+
        '<div class="biz-detail-biz-name" id="biz-prod-d-biz"></div>'+
        '<div class="biz-detail-meta" id="biz-prod-d-meta"></div>'+
        '<div class="biz-detail-desc" id="biz-prod-d-desc"></div>'+
        '<button class="biz-submit-btn biz-prod-detail-cta" id="biz-prod-d-cta"><i class="fas fa-comment-dots"></i> Ask about Product</button>'+
      '</div>'+
    '</div>';
  }

  // ── RENDER: MODALS ───────────────────────────────────────────

  function renderQuoteModal(biz) {
    return '<div class="biz-modal-overlay" id="biz-quote-modal" onclick="if(event.target===this)window._bizActions.closeQuote()">'+
      '<div class="biz-modal-sheet">'+
        '<div class="biz-modal-handle"></div>'+
        '<button class="biz-modal-close" onclick="window._bizActions.closeQuote()"><i class="fas fa-times"></i></button>'+
        '<div class="biz-modal-title" id="biz-q-modal-title">Request a Quote</div>'+
        '<div class="biz-modal-sub" id="biz-q-modal-sub">Send a message to <strong>'+esc(biz.title||'this business')+'</strong></div>'+
        '<div class="biz-form-group"><label class="biz-form-label">Your Name *</label><input class="biz-form-input" id="q-name" placeholder="Full name" value="'+esc(_currentUser&&_currentUser.displayName||'')+'"></div>'+
        '<div class="biz-form-group"><label class="biz-form-label">Email *</label><input class="biz-form-input" id="q-email" type="email" placeholder="your@email.com" value="'+esc(_currentUser&&_currentUser.email||'')+'"></div>'+
        '<div class="biz-form-group"><label class="biz-form-label">Phone (optional)</label><input class="biz-form-input" id="q-phone" type="tel" placeholder="+995…"></div>'+
        '<div class="biz-form-group"><label class="biz-form-label">Service / What you need</label><input class="biz-form-input" id="q-service" placeholder="Which service are you interested in?"></div>'+
        '<div class="biz-form-group"><label class="biz-form-label">Message *</label><textarea class="biz-form-textarea" id="q-message" placeholder="Describe what you need…"></textarea></div>'+
        '<button class="biz-submit-btn" id="q-submit-btn" onclick="window._bizActions.submitQuote()"><i class="fas fa-paper-plane"></i> Send Request</button>'+
      '</div>'+
    '</div>';
  }

  function renderComposeModal(biz) {
    var identityHtml;
    if (_isActingAsPage) {
      // Page identity: can choose to post as the business or as themselves
      identityHtml =
        '<div class="biz-compose-identity-row">'+
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.84rem;color:#94a3b8">'+
            '<input type="checkbox" id="biz-identity-as-biz" checked onchange="window._bizActions._updateIdentityLabel()">'+
            '<span id="biz-identity-label">Posting as <strong>'+esc(biz.title||'your business')+'</strong></span>'+
          '</label>'+
        '</div>';
    } else {
      var visName = _currentUser ? (_currentUser.displayName || _currentUser.email || 'you') : 'you';
      identityHtml = '<div class="biz-modal-sub">Posting as <strong>'+esc(visName)+'</strong></div>';
    }
    return '<div class="biz-modal-overlay" id="biz-compose-modal" onclick="if(event.target===this)window._bizActions.closeCompose()">'+
      '<div class="biz-modal-sheet">'+
        '<div class="biz-modal-handle"></div>'+
        '<button class="biz-modal-close" onclick="window._bizActions.closeCompose()"><i class="fas fa-times"></i></button>'+
        '<div class="biz-modal-title">Create Post</div>'+
        identityHtml+
        '<textarea class="biz-compose-textarea" id="biz-compose-text" placeholder="What\'s happening?"></textarea>'+
        '<div id="biz-compose-photos" class="biz-compose-photos"></div>'+
        '<div class="biz-compose-media-bar">'+
          '<button type="button" class="biz-compose-media-btn" onclick="window._bizActions.openPhotoInCompose()"><i class="fas fa-image"></i> Add Photo</button>'+
          '<input type="file" id="biz-compose-photo-input" accept="image/*" multiple style="display:none" onchange="window._bizActions.handleComposePhoto(this)">'+
        '</div>'+
        '<div class="biz-compose-footer">'+
          '<button class="biz-action-btn" onclick="window._bizActions.closeCompose()">Cancel</button>'+
          '<button class="biz-action-btn primary" id="biz-compose-btn" onclick="window._bizActions.submitBizPost()"><i class="fas fa-paper-plane"></i> Post</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }

  function renderLightbox() {
    return '<div class="biz-lightbox" id="biz-lightbox" onclick="window._bizActions.closePhoto()">'+
      '<button class="biz-lightbox-close" onclick="window._bizActions.closePhoto()"><i class="fas fa-times"></i></button>'+
      '<img id="biz-lightbox-img" src="" alt="">'+
    '</div>';
  }

  // ── MAIN RENDER ───────────────────────────────────────────────

  // ── EDIT POST MODAL ───────────────────────────────────────────

  function renderEditModal() {
    return '<div class="biz-modal-overlay" id="biz-edit-modal">'+
      '<div class="biz-modal-sheet" id="biz-edit-sheet">'+
        '<div class="biz-modal-handle"></div>'+
        '<button class="biz-modal-close" onclick="window._bizActions.closeEditModal()"><i class="fas fa-times"></i></button>'+
        '<div class="biz-modal-title">Edit Post</div>'+
        '<div class="biz-modal-sub" style="margin-bottom:16px">Changes are visible immediately</div>'+
        '<textarea class="biz-edit-textarea" id="biz-edit-textarea" placeholder="What\'s on your mind?" rows="4"></textarea>'+
        '<div class="biz-edit-vis-row">'+
          '<i class="fas fa-globe" style="color:#64748b"></i>'+
          '<span>Visibility:</span>'+
          '<select id="biz-edit-vis">'+
            '<option value="public">Public</option>'+
            '<option value="followers">Followers only</option>'+
            '<option value="private">Private</option>'+
          '</select>'+
        '</div>'+
        '<div class="biz-edit-footer">'+
          '<button class="biz-cancel-btn" onclick="window._bizActions.closeEditModal()">Cancel</button>'+
          '<button class="biz-submit-btn" id="biz-edit-save-btn" onclick="window._bizActions.savePostEdit()">'+
            '<i class="fas fa-check"></i> Save'+
          '</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }

  // ── SHARE MODAL ───────────────────────────────────────────────

  function renderShareModal() {
    return '<div class="biz-share-overlay" id="biz-share-overlay" onclick="if(event.target===this)window._bizActions.closeShareModal()">'+
      '<div class="biz-share-sheet">'+
        '<div class="biz-share-drag"></div>'+
        '<div class="biz-share-title">Share post</div>'+
        '<textarea class="biz-share-caption" id="biz-share-caption" placeholder="Say something about this post… (optional)" rows="2"></textarea>'+
        '<div class="biz-share-options">'+
          '<button class="biz-share-opt" onclick="window._bizActions.submitShare(\'feed\')">'+
            '<span class="biz-share-opt-icon"><i class="fas fa-globe"></i></span>'+
            '<span class="biz-share-opt-text"><strong>Share to feed</strong><small>Visible to everyone on GeoHub</small></span>'+
          '</button>'+
          '<button class="biz-share-opt" onclick="window._bizActions.submitShare(\'profile\')">'+
            '<span class="biz-share-opt-icon"><i class="fas fa-user"></i></span>'+
            '<span class="biz-share-opt-text"><strong>Share to my profile</strong><small>Appears on your profile page</small></span>'+
          '</button>'+
          '<button class="biz-share-opt" onclick="window._bizActions.copyShareLink()">'+
            '<span class="biz-share-opt-icon"><i class="fas fa-link"></i></span>'+
            '<span class="biz-share-opt-text"><strong>Copy link</strong><small>Copy post URL to clipboard</small></span>'+
          '</button>'+
          '<button class="biz-share-opt" onclick="window._bizActions.nativeShare()">'+
            '<span class="biz-share-opt-icon"><i class="fas fa-arrow-up-from-bracket"></i></span>'+
            '<span class="biz-share-opt-text"><strong>Share via…</strong><small>Use your device\'s share sheet</small></span>'+
          '</button>'+
        '</div>'+
        '<button class="biz-share-cancel" onclick="window._bizActions.closeShareModal()">Cancel</button>'+
      '</div>'+
    '</div>';
  }

  // ── NAVBAR RECOVERY ───────────────────────────────────────────
  // geohub-social-redesign.js calls shell() which replaces document.body.innerHTML,
  // wiping any static <nav> from business.html. We re-inject a minimal navbar
  // as a direct child of <body> so the CSS exclusion rule keeps it visible.

  function ensureNavbar() {
    if (document.getElementById('navbar')) return;
    var user = _currentUser;
    // Use #authNavUser placeholder so account-switcher.js can mount its dropdown
    var authNavHtml = user
      ? '<div id="authNavUser" style="display:flex;align-items:center;gap:6px">' +
          (user.photoURL
            ? '<img src="' + esc(user.photoURL) + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid rgba(16,185,129,.4)" alt="" onerror="this.style.display=\'none\'">'
            : '<span style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#10b981,#3b82f6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.8rem;flex-shrink:0">' + esc(((user.displayName||user.email||'U')[0]).toUpperCase()) + '</span>') +
        '</div>'
      : '<a href="auth.html" style="background:#10b981;color:#fff;padding:6px 14px;border-radius:20px;text-decoration:none;font-size:.82rem;font-weight:600">Sign In</a>';

    var nav = document.createElement('nav');
    nav.className = 'navbar';
    nav.id = 'navbar';
    nav.innerHTML =
      '<a href="index.html" class="navbar-brand">' +
        '<div class="logo-icon">🌍</div>' +
        '<span class="logo-text">Geo<span class="logo-geo">Hub</span></span>' +
      '</a>' +
      '<ul class="navbar-links">' +
        '<li><a href="feed.html">Feed</a></li>' +
        '<li><a href="business.html">Pages</a></li>' +
        '<li><a href="map.html">Map</a></li>' +
      '</ul>' +
      '<div class="navbar-actions" style="display:flex;align-items:center;gap:8px">' + authNavHtml + '</div>' +
      '<button class="hamburger" id="geoHamburger" onclick="geoToggleMenu()" aria-label="Menu" aria-expanded="false">' +
        '<span></span><span></span><span></span>' +
      '</button>';

    var root = document.getElementById('biz-detail-root');
    document.body.insertBefore(nav, root || document.body.firstChild);

    if (!document.querySelector('.mobile-menu')) {
      var mm = document.createElement('div');
      mm.className = 'mobile-menu';
      if (nav.after) nav.after(mm); else nav.parentNode.insertBefore(mm, nav.nextSibling);
    }

    // Re-fire GeoAuthReady so account-switcher replaces #authNavUser with its full dropdown.
    // shell() from geohub-social-redesign wipes the body (killing the original navbar),
    // so account-switcher's MutationObserver is watching a detached node. Re-dispatching
    // the event is the reliable way to remount it into the new navbar.
    if (user) {
      var profile = window.GeoCurrentUser || {
        uid: user.uid,
        email: user.email || '',
        fullName: user.displayName || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        avatar: user.photoURL || ''
      };
      setTimeout(function() {
        window.dispatchEvent(new CustomEvent('GeoAuthReady', { detail: profile }));
      }, 0);
    }
  }

  function renderPage(biz, services, priceList, gallery, reviews, products) {
    // Re-read actor synchronously before each render — prevents stale state from async race conditions
    _isActingAsPage = isActingAsBusiness(BIZ_ID);
    ensureNavbar();
    document.title = esc(biz.title||'Business')+' — GeoHub';
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = biz.description ? biz.description.slice(0,155) : 'View '+(biz.title||'Business')+' on GeoHub';

    var root = document.getElementById('biz-detail-root');
    root.innerHTML =
      '<div class="biz-page-wrap">'+
        renderHeader(biz)+
        renderContact(biz)+
        (_isActingAsPage ? renderAdminToolbar(biz) : '')+
        renderTabBar()+
        '<div class="biz-tab-panels">'+

          '<div class="biz-tab-panel active" data-panel="overview">'+
            renderOverview3Col(biz, services, products, gallery, reviews)+
          '</div>'+

          '<div class="biz-tab-panel" data-panel="posts">'+
            (_isActingAsPage?'<div style="margin-bottom:14px">'+renderComposer(biz)+'</div>':'')+
            '<div id="biz-posts-all">'+renderPostsSkeleton(3)+'</div>'+
          '</div>'+

          '<div class="biz-tab-panel" data-panel="services">'+
            renderServiceCards(services)+
            renderPriceList(priceList)+
          '</div>'+

          '<div class="biz-tab-panel" data-panel="products">'+
            renderProductCards(products)+
          '</div>'+

          '<div class="biz-tab-panel" data-panel="photos">'+
            renderGallery(gallery)+
          '</div>'+

          '<div class="biz-tab-panel" data-panel="reviews">'+
            renderReviews(reviews, biz)+
          '</div>'+

          '<div class="biz-tab-panel" data-panel="events">'+
            '<div id="biz-events-panel"><div class="biz-loading-inline"><i class="fas fa-spinner fa-spin"></i> Loading events…</div></div>'+
          '</div>'+

          '<div class="biz-tab-panel" data-panel="faq">'+
            '<div id="biz-faq-panel"><div class="biz-loading-inline"><i class="fas fa-spinner fa-spin"></i> Loading FAQ…</div></div>'+
          '</div>'+

          '<div class="biz-tab-panel" data-panel="rewards">'+
            '<div id="biz-rewards-panel"><div class="biz-loading-inline"><i class="fas fa-spinner fa-spin"></i> Loading rewards…</div></div>'+
          '</div>'+

          '<div class="biz-tab-panel" data-panel="about">'+
            renderAboutTab(biz)+
            '<div id="biz-milestones-section"></div>'+
          '</div>'+

          (_isActingAsPage?'<div class="biz-tab-panel" data-panel="insights"><div id="biz-insights-panel"><div class="biz-loading-inline"><i class="fas fa-spinner fa-spin"></i> Loading insights…</div></div></div>':'')+

          (_isActingAsPage?'<div class="biz-tab-panel" data-panel="dashboard">'+renderOwnerDashboard(biz)+'</div>':'')+

        '</div>'+
      '</div>'+
      renderQuoteModal(biz)+
      renderServiceDetailModal()+
      renderProductDetailModal()+
      (_isActingAsPage?renderComposeModal(biz):'')+
      (_isActingAsPage?renderBlockManagerModal():'')+
      renderShareModal()+
      renderEditModal()+
      renderLightbox()+
      (_isActingAsPage?'<div class="biz-preview-fab" id="biz-preview-fab" style="display:none">'+
        '<button onclick="window._bizActions.togglePreview()" title="Exit Preview Mode">'+
          '<i class="fas fa-eye-slash"></i> Exit Preview</button></div>':'');

    _reviewRating = 0;

    // Wire tab clicks
    document.querySelectorAll('.biz-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.dataset.tab;
        document.querySelectorAll('.biz-tab').forEach(function(b){ b.classList.remove('active'); });
        document.querySelectorAll('.biz-tab-panel').forEach(function(p){ p.classList.remove('active'); });
        btn.classList.add('active');
        var panel = document.querySelector('.biz-tab-panel[data-panel="'+id+'"]');
        if (panel) panel.classList.add('active');
      });
    });

    _previewMode = false;
    loadBizPosts();
    loadPageBlocks();
    loadEvents(BIZ_ID);
    loadFaq(BIZ_ID);
    loadMilestones(BIZ_ID);
    loadBizRewards(BIZ_ID);
    if (_isActingAsPage) {
      loadInsights(BIZ_ID);
      window._bizActions.refreshAdminList();
    }
  }

  // ── LOAD POSTS ────────────────────────────────────────────────

  function loadBizPosts() {
    var overviewEl = document.getElementById('biz-posts-overview');
    var allEl      = document.getElementById('biz-posts-all');

    // Query without orderBy to avoid requiring a composite index.
    // Client-side sort by createdAt descending is applied after fetch.
    var q = _fs.query(
      _fs.collection(_db,'posts'),
      _fs.where('businessId','==',BIZ_ID),
      _fs.limit(30)
    );
    _fs.getDocs(q).then(function(snap) {
      var posts = [];
      snap.forEach(function(d){ posts.push(Object.assign({id:d.id}, d.data())); });

      // Filter deleted and visibility-restricted posts
      posts = posts.filter(function(p) {
        if (p.status === 'deleted') return false;
        if (p.visibility === 'private'   && !_isOwner) return false;
        if (p.visibility === 'followers' && !_isOwner && !_isFollowing) return false;
        return true;
      });

      // Sort: pinned first, then newest-first
      posts.sort(function(a,b){
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return  1;
        var ta = a.createdAt ? (a.createdAt.seconds || (a.createdAt.toMillis ? a.createdAt.toMillis()/1000 : 0)) : 0;
        var tb = b.createdAt ? (b.createdAt.seconds || (b.createdAt.toMillis ? b.createdAt.toMillis()/1000 : 0)) : 0;
        return tb - ta;
      });
      posts = posts.slice(0, 20);
      var empty = '<div class="biz-empty-state"><i class="fas fa-seedling"></i>'+
        (_isOwner?'<p>No posts yet. Use the composer above to create your first post.</p>':'<p>No posts yet.</p>')+'</div>';
      if (!posts.length) {
        if (overviewEl) overviewEl.innerHTML = empty;
        if (allEl)      allEl.innerHTML      = empty;
        return;
      }
      _currentPosts = posts;
      var all = '<div class="biz-post-list">'+posts.map(function(p){ return postCardHtml(p,_biz); }).join('')+'</div>';
      var pre = '<div class="biz-post-list">'+posts.slice(0,3).map(function(p){ return postCardHtml(p,_biz); }).join('')+'</div>';
      if (overviewEl) overviewEl.innerHTML = pre;
      if (allEl)      allEl.innerHTML      = all;

      // Set up IntersectionObserver to track post views
      if (_currentUser && 'IntersectionObserver' in window) {
        var seenKey = 'biz_seen_' + BIZ_ID;
        var seen = JSON.parse(sessionStorage.getItem(seenKey) || '{}');
        var obs = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (!entry.isIntersecting) return;
            var card = entry.target;
            var pid = card.dataset.postId;
            if (!pid || seen[pid]) return;
            seen[pid] = 1;
            sessionStorage.setItem(seenKey, JSON.stringify(seen));
            obs.unobserve(card);
            _fs.setDoc(
              _fs.doc(_db,'posts',pid,'views',_currentUser.uid),
              {userId:_currentUser.uid, seenAt:_fs.serverTimestamp()},
              {merge:true}
            ).then(function(){
              return _fs.updateDoc(_fs.doc(_db,'posts',pid),{viewCount:_fs.increment(1)});
            }).then(function(){
              var vEl = document.getElementById('biz-views-'+CSS.escape(pid));
              if (vEl && isAdminOrOwner()) {
                var cur = parseInt(vEl.textContent.replace(/[^\d]/g,''),10)||0;
                vEl.innerHTML = '<i class="fas fa-eye"></i> '+(cur+1)+' views';
              }
            }).catch(function(){});
          });
        }, {threshold: 0.5});
        document.querySelectorAll('.biz-post-card').forEach(function(card) { obs.observe(card); });
      }

      // Pre-load current user's reaction state for all visible posts
      if (_currentUser) {
        posts.forEach(function(p) {
          if (_postReactions[p.id] && _postReactions[p.id].loaded) return;
          _fs.getDoc(_fs.doc(_db,'posts',p.id,'reactions',_currentUser.uid))
            .then(function(snap) {
              if (!snap.exists()) { _postReactions[p.id] = {loaded:true}; return; }
              var d = snap.data();
              _postReactions[p.id] = {loaded:true, key:d.key, emoji:d.emoji};
              var rx = REACTIONS.find(function(r){ return r.key === d.key; });
              if (!rx) return;
              document.querySelectorAll('.biz-rx-wrap[data-pid="'+CSS.escape(p.id)+'"] .biz-react-btn').forEach(function(btnEl) {
                btnEl.setAttribute('data-reaction', d.key);
                btnEl.innerHTML = d.emoji + ' ' + rx.label;
              });
            }).catch(function(){});
        });
      }
    }).catch(function(err){
      console.error('[BizPage] loadBizPosts failed:', err.code||err.message);
      var msg = '<div class="biz-empty-state"><i class="fas fa-triangle-exclamation"></i><p>Could not load posts ('+esc(err.code||'error')+').</p></div>';
      if (overviewEl) overviewEl.innerHTML = msg;
      if (allEl)      allEl.innerHTML      = msg;
    });
  }

  // ── SAFE SNAP ─────────────────────────────────────────────────

  function safeSnap(promise) {
    return promise.then(function(snap){
      var arr=[]; snap.forEach(function(d){ arr.push(Object.assign({id:d.id},d.data())); }); return arr;
    }).catch(function(err){ console.warn('[BizPage] Optional query failed:',err.code||err.message); return []; });
  }

  // ── DATA LOADING ──────────────────────────────────────────────

  function load() {
    var root = document.getElementById('biz-detail-root');
    if (!root) return;
    root.innerHTML = '<div class="biz-loading"><i class="fas fa-spinner fa-spin"></i><span>Loading…</span></div>';
    document.body.classList.add('biz-detail-active');

    _fs.getDoc(_fs.doc(_db,'businesses',BIZ_ID)).then(function(bizSnap) {
      if (!bizSnap.exists()) {
        root.innerHTML = '<div class="biz-error-state"><i class="fas fa-store-slash"></i><h3>Business not found</h3><p>This page doesn\'t exist or was removed.</p><a href="index.html" style="color:#10b981;text-decoration:none">← Back to GeoHub</a></div>';
        return;
      }

      _biz     = Object.assign({id:BIZ_ID}, bizSnap.data());
      if (_biz.status === 'deleted' || _biz.deleted === true) {
        root.innerHTML = '<div class="biz-error-state"><i class="fas fa-store-slash"></i><h3>Page not found</h3><p>This business page has been deleted or is no longer available.</p><a href="business.html" style="color:#10b981;text-decoration:none">← Back to Businesses</a></div>';
        return;
      }
      _isOwner = !!(_currentUser && _biz.ownerId === _currentUser.uid);
      var _storedActor = getActiveActor();
      _isActingAsPage = !!(_storedActor && _storedActor.type === 'business' && _storedActor.businessId === BIZ_ID);

      var loadServices  = safeSnap(_fs.getDocs(_fs.query(_fs.collection(_db,'businesses',BIZ_ID,'services'),  _fs.orderBy('order','asc'))));
      var loadPriceList = safeSnap(_fs.getDocs(_fs.query(_fs.collection(_db,'businesses',BIZ_ID,'priceList'), _fs.orderBy('order','asc'))));
      var loadGallery   = safeSnap(_fs.getDocs(_fs.query(_fs.collection(_db,'businesses',BIZ_ID,'gallery'),   _fs.orderBy('order','asc'))));
      var loadProducts  = safeSnap(_fs.getDocs(_fs.query(_fs.collection(_db,'businesses',BIZ_ID,'products'),  _fs.orderBy('order','asc'))));
      var loadReviews   = safeSnap(_fs.getDocs(_fs.query(
        _fs.collection(_db,'businessReviews'),
        _fs.where('businessId','==',BIZ_ID),
        _fs.orderBy('createdAt','desc'),
        _fs.limit(20)
      )));

      var loadSaved = _currentUser
        ? _fs.getDoc(_fs.doc(_db,'savedBusinesses',_currentUser.uid+'_'+BIZ_ID))
            .then(function(s){ return s.exists(); })
            .catch(function(){ return false; })
        : Promise.resolve(false);

      var loadFollow = _currentUser
        ? _fs.getDoc(_fs.doc(_db,'businessFollowers',BIZ_ID+'_'+_currentUser.uid))
            .then(function(s){ if(!s.exists()) return {exists:false}; return {exists:true,data:s.data()}; })
            .catch(function(){ return {exists:false}; })
        : Promise.resolve({exists:false});

      var loadAdminRole = _currentUser && !_isOwner
        ? _fs.getDoc(_fs.doc(_db,'businesses',BIZ_ID,'admins',_currentUser.uid))
            .then(function(s){ return s.exists() ? s.data() : null; })
            .catch(function(){ return null; })
        : Promise.resolve(null);

      return Promise.all([loadServices, loadPriceList, loadGallery, loadReviews, loadSaved, loadFollow, loadProducts, loadAdminRole])
        .then(function(r) {
          _isSaved     = r[4];
          var followResult = r[5];
          _isFollowing = followResult.exists;
          _notificationsOn = followResult.exists ? (followResult.data && followResult.data.notifications !== false) : true;
          var adminData = r[7];
          _isPageAdmin = !!adminData;
          _pageAdminRole = adminData ? (adminData.role || null) : null;
          renderPage(_biz, r[0], r[1], r[2], r[3], r[6]);

          // Deep-link: ?#quotes opens the owner quotes panel directly (from notification click)
          if(location.hash === '#quotes' && _isActingAsPage) {
            setTimeout(function(){ if(window._bizActions) window._bizActions.goToQuotes(); }, 400);
          }

          if (!_isOwner) {
            var pvKey = 'biz_pv_' + BIZ_ID;
            if (!sessionStorage.getItem(pvKey)) {
              sessionStorage.setItem(pvKey, '1');
              _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID),{viewCount:_fs.increment(1)}).catch(function(){});
            }
          }
        });

    }).catch(function(err) {
      console.error('[BizPage] Core load failed:',err.code,err.message,err);
      var r = document.getElementById('biz-detail-root');
      if (r) r.innerHTML = '<div class="biz-error-state"><i class="fas fa-exclamation-circle"></i><h3>Could not load</h3><p>Check your connection and try again.</p></div>';
    });
  }

  // ── EVENTS ────────────────────────────────────────────────────

  function loadEvents(bizId) {
    var el = document.getElementById('biz-events-panel');
    if (!el) return;
    var createBtn = isAdminOrOwner()
      ? '<button class="biz-submit-btn" style="margin-bottom:18px" onclick="window._bizActions.openCreateEvent()"><i class="fas fa-plus"></i> Create Event</button>'
      : '';
    safeSnap(
      _fs.getDocs(_fs.query(
        _fs.collection(_db,'businesses',bizId,'events'),
        _fs.orderBy('date','asc')
      ))
    ).then(function(events) {
      if (!events.length) {
        el.innerHTML = createBtn +
          '<div class="biz-empty-state"><i class="fas fa-calendar-days"></i><p>No events yet.</p></div>';
        return;
      }
      var cards = events.map(function(ev) {
        var dateStr = '';
        if (ev.date) {
          var ms = ev.date.toMillis ? ev.date.toMillis() : (ev.date.seconds ? ev.date.seconds*1000 : Number(ev.date));
          dateStr = new Date(ms).toLocaleString();
        }
        var coverHtml = ev.coverUrl
          ? '<img class="biz-event-cover" src="'+esc(ev.coverUrl)+'" alt="" loading="lazy">'
          : '<div class="biz-event-cover-ph"><i class="fas fa-calendar-days"></i></div>';
        var rsvpHtml = _currentUser && !isAdminOrOwner()
          ? '<div class="biz-event-rsvp" id="biz-ersvp-'+esc(ev.id)+'">'+
              '<button class="biz-rsvp-btn" data-status="going" onclick="window._bizActions.rsvpEvent(\''+esc(ev.id)+'\',\'going\')">Going</button>'+
              '<button class="biz-rsvp-btn" data-status="interested" onclick="window._bizActions.rsvpEvent(\''+esc(ev.id)+'\',\'interested\')">Interested</button>'+
              '<button class="biz-rsvp-btn" data-status="cant_go" onclick="window._bizActions.rsvpEvent(\''+esc(ev.id)+'\',\'cant_go\')">Can\'t Go</button>'+
            '</div>'
          : '';
        return '<div class="biz-event-card">'+
          coverHtml+
          '<div class="biz-event-body">'+
            '<div class="biz-event-name">'+esc(ev.name||'Event')+'</div>'+
            (dateStr?'<div class="biz-event-date"><i class="fas fa-clock"></i> '+dateStr+'</div>':'')+
            (ev.location?'<div class="biz-event-loc"><i class="fas fa-location-dot"></i> '+esc(ev.location)+'</div>':'')+
            (ev.description?'<div class="biz-event-desc">'+esc(ev.description)+'</div>':'')+
            (ev.maxAttendees?'<div class="biz-event-cap"><i class="fas fa-users"></i> Max '+ev.maxAttendees+' attendees</div>':'')+
            rsvpHtml+
          '</div>'+
        '</div>';
      }).join('');
      el.innerHTML = createBtn + '<div class="biz-events-list">'+cards+'</div>';
      if (_currentUser) {
        events.forEach(function(ev) {
          _fs.getDoc(_fs.doc(_db,'businesses',bizId,'events',ev.id,'rsvps',_currentUser.uid))
            .then(function(s) {
              if (!s.exists()) return;
              var status = s.data().status;
              var wrap = document.getElementById('biz-ersvp-'+CSS.escape(ev.id));
              if (wrap) wrap.querySelectorAll('.biz-rsvp-btn').forEach(function(b){
                b.classList.toggle('active', b.dataset.status === status);
              });
            }).catch(function(){});
        });
      }
    });
  }

  // ── FAQ ───────────────────────────────────────────────────────

  function loadFaq(bizId) {
    var el = document.getElementById('biz-faq-panel');
    if (!el) return;
    var addBtn = isAdminOrOwner()
      ? '<button class="biz-submit-btn" style="margin-bottom:18px" onclick="window._bizActions.openAddFaq()"><i class="fas fa-plus"></i> Add FAQ Item</button>'
      : '';
    var askBtn = (_currentUser && !isAdminOrOwner())
      ? '<div class="biz-faq-ask-form" id="biz-faq-ask-form" style="margin-bottom:18px">'+
          '<input class="biz-form-input" id="biz-faq-question-inp" placeholder="Ask a question…">'+
          '<button class="biz-submit-btn" style="margin-top:8px" onclick="window._bizActions.submitQuestion()"><i class="fas fa-paper-plane"></i> Submit Question</button>'+
        '</div>'
      : '';
    var questionsList = isAdminOrOwner()
      ? '<div id="biz-faq-questions-section"><div style="color:#64748b;font-size:.82rem;margin-bottom:6px">Visitor Questions:</div>'+
          '<div id="biz-faq-questions-list"><i class="fas fa-spinner fa-spin"></i></div></div>'
      : '';
    safeSnap(_fs.getDocs(_fs.collection(_db,'businesses',bizId,'faq'))).then(function(items) {
      var faqHtml = items.length
        ? items.map(function(item) {
            var ansBtn = isAdminOrOwner() && !item.answer
              ? '<button class="biz-cmt-act-btn" onclick="window._bizActions.openAnswerFaq(\''+esc(item.id)+'\')">Answer</button>'
              : '';
            var delBtn = isAdminOrOwner()
              ? '<button class="biz-cmt-act-btn" style="color:#f87171" onclick="window._bizActions.deleteFaqItem(\''+esc(item.id)+'\')">Delete</button>'
              : '';
            return '<div class="biz-faq-item" id="biz-faq-'+esc(item.id)+'">'+
              '<div class="biz-faq-q"><i class="fas fa-circle-question"></i> '+esc(item.question||'')+'</div>'+
              (item.answer?'<div class="biz-faq-a"><i class="fas fa-circle-check"></i> '+esc(item.answer)+'</div>':'')+
              '<div class="biz-faq-actions">'+ansBtn+delBtn+'</div>'+
            '</div>';
          }).join('')
        : '<div class="biz-empty-state"><i class="fas fa-circle-question"></i><p>No FAQ items yet.</p></div>';
      el.innerHTML = addBtn + askBtn + '<div id="biz-faq-list">'+faqHtml+'</div>' + questionsList;
      if (isAdminOrOwner()) loadVisitorQuestions(bizId);
    });
  }

  function loadVisitorQuestions(bizId) {
    var el = document.getElementById('biz-faq-questions-list');
    if (!el) return;
    safeSnap(_fs.getDocs(_fs.query(
      _fs.collection(_db,'businesses',bizId,'faqQuestions'),
      _fs.orderBy('createdAt','desc'),
      _fs.limit(20)
    ))).then(function(questions) {
      if (!questions.length) { el.innerHTML = '<div style="color:#64748b;font-size:.82rem">No visitor questions yet.</div>'; return; }
      el.innerHTML = questions.map(function(q) {
        return '<div class="biz-faq-question-item">'+
          '<div class="biz-faq-q">'+esc(q.question||'')+'</div>'+
          '<div class="biz-faq-meta">'+esc(q.authorName||'Anonymous')+' · '+timeAgo(q.createdAt)+'</div>'+
          (q.answered ? '' : '<button class="biz-cmt-act-btn" onclick="window._bizActions.promoteQuestion(\''+esc(q.id)+'\',\''+esc(q.question||'')+'\')">Add to FAQ</button>')+
        '</div>';
      }).join('');
    });
  }

  // ── BUSINESS REWARDS ─────────────────────────────────────────

  function loadBizRewards(bizId) {
    var panelEl  = document.getElementById('biz-rewards-panel');
    var sideEl   = document.getElementById('biz-rewards-sidebar');
    if (!panelEl) return;

    // Single where clause — no composite index required; filter active client-side.
    var q = _fs.query(
      _fs.collection(_db, 'rewards'),
      _fs.where('businessId', '==', bizId),
      _fs.limit(50)
    );
    _fs.getDocs(q).then(function(snap) {
      var rows = [];
      snap.forEach(function(d) { rows.push(Object.assign({ id: d.id }, d.data())); });

      // Keep only active, non-expired rewards; out-of-stock kept but visually disabled.
      var now = Date.now();
      rows = rows.filter(function(r) {
        if (r.active === false) return false;
        var expMs = toMsBiz(r.expiresAt);
        if (expMs && expMs < now) return false;
        return true;
      });
      rows.sort(function(a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); });

      // Right sidebar widget
      if (sideEl) {
        if (rows.length) {
          sideEl.style.display = '';
          sideEl.innerHTML = renderRewardsSidebarContent(rows.slice(0, 3));
        } else {
          sideEl.style.display = 'none';
        }
      }

      // Tab panel
      if (!rows.length) {
        panelEl.innerHTML =
          '<div class="biz-empty-state"><i class="fas fa-gift"></i>' +
          (_isActingAsPage
            ? '<p>No active rewards linked to this business. Create one in the <a href="admin.html" style="color:#10b981">admin panel</a> and set the Business ID to <code>' + esc(bizId) + '</code>.</p>'
            : '<p>No active rewards available right now. Check back soon!</p>') +
          '</div>';
        return;
      }

      var manageBar = isAdminOrOwner()
        ? '<div class="biz-rewards-manage-bar"><i class="fas fa-info-circle"></i> Redeem coupons in your ' +
          '<a href="rewards.html" class="biz-rewards-manage-link">Rewards &amp; Coupons</a> page.</div>'
        : '';

      panelEl.innerHTML =
        manageBar +
        '<div class="biz-rewards-grid">' +
          rows.map(renderBizRewardCard).join('') +
        '</div>';
    }).catch(function(err) {
      console.warn('[BizPage] rewards', err.message);
      if (panelEl) panelEl.innerHTML = '<div class="biz-empty-state"><i class="fas fa-gift"></i><p>Could not load rewards.</p></div>';
    });
  }

  function renderBizRewardCard(r) {
    var cost     = Number(r.cost || r.pointsCost || 0);
    var stockRaw = r.stock != null ? Number(r.stock) : (r.quantityRemaining != null ? Number(r.quantityRemaining) : null);
    var unlimited  = stockRaw === null;
    var outOfStock = !unlimited && stockRaw === 0;
    var expMs  = toMsBiz(r.expiresAt);
    var expiry = expMs ? new Date(expMs).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    var catIcons = { food_drink: 'fa-utensils', food: 'fa-utensils', drink: 'fa-coffee',
                     experience: 'fa-star', shopping: 'fa-shopping-bag',
                     entertainment: 'fa-film', travel: 'fa-plane', other: 'fa-gift' };
    var icon = catIcons[r.category] || 'fa-gift';

    var stockBadge = outOfStock
      ? '<span class="biz-rw-badge biz-rw-oos">Out of stock</span>'
      : (!unlimited && stockRaw < 10)
        ? '<span class="biz-rw-badge biz-rw-low">' + stockRaw + ' left</span>'
        : '';

    return '<div class="biz-reward-card' + (outOfStock ? ' biz-reward-oos' : '') + '">' +
      '<div class="biz-reward-icon-wrap"><i class="fas ' + icon + '"></i></div>' +
      '<div class="biz-reward-body">' +
        '<div class="biz-reward-title">' + esc(r.title || 'Reward') + '</div>' +
        (r.description ? '<div class="biz-reward-desc">' + esc(r.description) + '</div>' : '') +
        '<div class="biz-reward-meta">' +
          '<span class="biz-reward-cost"><i class="fas fa-coins"></i> ' + compact(cost) + ' pts</span>' +
          (stockBadge) +
          (expiry ? '<span class="biz-rw-badge biz-rw-exp"><i class="fas fa-calendar"></i> Exp ' + esc(expiry) + '</span>' : '') +
        '</div>' +
        (r.termsNote ? '<div class="biz-reward-terms">' + esc(r.termsNote) + '</div>' : '') +
      '</div>' +
      '<a href="rewards.html?focus=' + esc(r.id) + '" class="biz-reward-cta' + (outOfStock ? ' biz-reward-cta-oos' : '') + '">' +
        (outOfStock ? '<i class="fas fa-times-circle"></i> Out of Stock' : '<i class="fas fa-coins"></i> Redeem') +
      '</a>' +
    '</div>';
  }

  function renderRewardsSidebarContent(rewards) {
    return '<div class="biz-preview-card">' +
      '<div class="biz-preview-header">' +
        '<span><i class="fas fa-gift"></i> Rewards</span>' +
        '<button onclick="window._bizActions.switchTab(\'rewards\')">See all</button>' +
      '</div>' +
      rewards.map(function(r) {
        var cost = Number(r.cost || r.pointsCost || 0);
        return '<div class="biz-preview-reward-row">' +
          '<div class="biz-preview-reward-name">' + esc(r.title || 'Reward') + '</div>' +
          '<span class="biz-preview-reward-cost"><i class="fas fa-coins"></i> ' + compact(cost) + '</span>' +
        '</div>';
      }).join('') +
      '<a href="rewards.html" class="biz-preview-cta">Redeem at Rewards Store</a>' +
    '</div>';
  }

  // ── MILESTONES ────────────────────────────────────────────────

  function loadMilestones(bizId) {
    var el = document.getElementById('biz-milestones-section');
    if (!el) return;
    safeSnap(_fs.getDocs(_fs.query(
      _fs.collection(_db,'businesses',bizId,'milestones'),
      _fs.orderBy('date','asc')
    ))).then(function(items) {
      if (!items.length && !isAdminOrOwner()) return;
      var addBtn = isAdminOrOwner()
        ? '<button class="biz-submit-btn" style="margin-bottom:14px" onclick="window._bizActions.openAddMilestone()"><i class="fas fa-plus"></i> Add Milestone</button>'
        : '';
      if (!items.length) {
        el.innerHTML = '<div class="biz-section" style="margin-top:14px"><div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-flag"></i> Milestones</div></div>'+addBtn+'</div>';
        return;
      }
      var timeline = items.map(function(m) {
        var yr = '';
        if (m.date) {
          var ms = m.date.toMillis ? m.date.toMillis() : (m.date.seconds ? m.date.seconds*1000 : Number(m.date));
          yr = new Date(ms).getFullYear();
        }
        var delBtn = isAdminOrOwner()
          ? '<button class="biz-cmt-act-btn" style="color:#f87171;margin-top:4px" onclick="window._bizActions.deleteMilestone(\''+esc(m.id)+'\')">Delete</button>'
          : '';
        return '<div class="biz-milestone-item">'+
          (yr?'<div class="biz-milestone-year">'+yr+'</div>':'')+
          '<div class="biz-milestone-content">'+
            '<div class="biz-milestone-title">'+esc(m.title||'')+'</div>'+
            (m.description?'<div class="biz-milestone-desc">'+esc(m.description)+'</div>':'')+
            delBtn+
          '</div>'+
        '</div>';
      }).join('');
      el.innerHTML = '<div class="biz-section" style="margin-top:14px">'+
        '<div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-flag"></i> Milestones</div></div>'+
        addBtn+
        '<div class="biz-milestone-timeline">'+timeline+'</div>'+
      '</div>';
    });
  }

  // ── INSIGHTS ──────────────────────────────────────────────────

  function loadInsights(bizId) {
    var el = document.getElementById('biz-insights-panel');
    if (!el || !_isOwner) return;
    Promise.all([
      _fs.getDoc(_fs.doc(_db,'businesses',bizId)),
      safeSnap(_fs.getDocs(_fs.query(
        _fs.collection(_db,'posts'),
        _fs.where('businessId','==',bizId),
        _fs.limit(50)
      ))),
      _fs.getDocs(_fs.query(
        _fs.collection(_db,'businessFollowers'),
        _fs.where('businessId','==',bizId),
        _fs.limit(500)
      )).catch(function(){ return {docs:[]}; })
    ]).then(function(results) {
      var bizData = results[0].exists() ? results[0].data() : {};
      var posts = results[1].filter(function(p){ return p.status !== 'deleted'; });
      var totalReactions = 0, totalComments = 0;
      posts.forEach(function(p){ totalReactions += (p.likeCount||0); totalComments += (p.commentCount||0); });
      var topPosts = posts.slice().sort(function(a,b){
        return ((b.likeCount||0)+(b.commentCount||0)) - ((a.likeCount||0)+(a.commentCount||0));
      }).slice(0,3);
      var maxScore = topPosts.length ? ((topPosts[0].likeCount||0)+(topPosts[0].commentCount||0)) : 1;

      var statsHtml =
        '<div class="biz-insights-stats">'+
          insightStat('fa-eye','Page Views', bizData.viewCount||0, '#3b82f6')+
          insightStat('fa-users','Followers', bizData.followerCount||0, '#10b981')+
          insightStat('fa-newspaper','Posts', posts.length, '#8b5cf6')+
          insightStat('fa-thumbs-up','Total Reactions', totalReactions, '#f59e0b')+
          insightStat('fa-comment','Total Comments', totalComments, '#06b6d4')+
          insightStat('fa-bookmark','Saves', bizData.saveCount||0, '#f43f5e')+
        '</div>';

      var topPostsHtml = topPosts.length
        ? '<div class="biz-insights-section"><div class="biz-insights-title"><i class="fas fa-trophy"></i> Top Performing Posts</div>'+
            topPosts.map(function(p) {
              var score = (p.likeCount||0)+(p.commentCount||0);
              var pct = maxScore > 0 ? Math.round(score/maxScore*100) : 0;
              return '<div class="biz-insights-post-row">'+
                '<div class="biz-insights-post-text">'+esc((p.text||'(no text)').slice(0,60))+'</div>'+
                '<div class="biz-insights-bar-wrap"><div class="biz-insights-bar" style="width:'+pct+'%"></div></div>'+
                '<div class="biz-insights-post-score">👍 '+(p.likeCount||0)+' · 💬 '+(p.commentCount||0)+'</div>'+
              '</div>';
            }).join('')+
          '</div>'
        : '';

      el.innerHTML = '<div class="biz-insights-wrap">'+
        '<div class="biz-dash-header"><i class="fas fa-chart-line"></i> Page Insights</div>'+
        statsHtml + topPostsHtml +
      '</div>';
    }).catch(function(err) {
      if (el) el.innerHTML = '<div class="biz-empty-state"><i class="fas fa-triangle-exclamation"></i><p>Could not load insights.</p></div>';
    });
  }

  function insightStat(icon, label, val, color) {
    return '<div class="biz-insights-stat">'+
      '<div class="biz-insights-stat-icon" style="color:'+color+';background:'+color+'1a"><i class="fas '+icon+'"></i></div>'+
      '<div class="biz-insights-stat-val">'+compact(val)+'</div>'+
      '<div class="biz-insights-stat-label">'+label+'</div>'+
    '</div>';
  }

  // ── TAB RELOAD HELPERS ────────────────────────────────────────

  function reloadServicesTab() {
    var panel = document.querySelector('.biz-tab-panel[data-panel="services"]');
    if (!panel) return;
    safeSnap(_fs.getDocs(_fs.collection(_db,'businesses',BIZ_ID,'services'))).then(function(services) {
      safeSnap(_fs.getDocs(_fs.collection(_db,'businesses',BIZ_ID,'priceList'))).then(function(priceList) {
        panel.innerHTML = renderServiceCards(services) + renderPriceList(priceList);
      });
    });
  }

  function reloadProductsTab() {
    var panel = document.querySelector('.biz-tab-panel[data-panel="products"]');
    if (!panel) return;
    safeSnap(_fs.getDocs(_fs.collection(_db,'businesses',BIZ_ID,'products'))).then(function(products) {
      panel.innerHTML = renderProductCards(products);
    });
  }

  function reloadGalleryTab() {
    var panel = document.querySelector('.biz-tab-panel[data-panel="photos"]');
    if (!panel) return;
    safeSnap(_fs.getDocs(_fs.collection(_db,'businesses',BIZ_ID,'gallery'))).then(function(photos) {
      panel.innerHTML = renderGallery(photos);
    });
  }

  function reloadReviewsTab() {
    var panel = document.querySelector('.biz-tab-panel[data-panel="reviews"]');
    if (!panel || !_biz) return;
    safeSnap(_fs.getDocs(_fs.query(
      _fs.collection(_db,'businessReviews'),
      _fs.where('businessId','==',BIZ_ID),
      _fs.orderBy('createdAt','desc'),
      _fs.limit(30)
    ))).then(function(reviews) {
      panel.innerHTML = renderReviews(reviews, _biz);
    });
  }

  // ── QUOTE CRM HELPERS ─────────────────────────────────────────

  function _bizQuoteCardHtml(q) {
    var id    = q._id || '';
    var st    = q.status || 'new';
    var stClr = BIZ_QUOTE_STATUS_COLORS[st] || BIZ_QUOTE_STATUS_COLORS.read;
    var isHigh  = q.priority === 'high';
    var hasNote = !!(q.ownerNote && q.ownerNote.trim());
    var notePreview = hasNote
      ? ': ' + esc((q.ownerNote||'').slice(0,38)) + (q.ownerNote.length > 38 ? '…' : '')
      : '';

    var statusChip   = '<span class="biz-qi-status-chip" style="color:'+stClr.text+';background:'+stClr.bg+';border-color:'+stClr.border+'">'+esc(st)+'</span>';
    var sourceChip   = q.service
      ? '<span class="biz-qi-source-chip src-service"><i class="fas fa-briefcase"></i> '+esc(q.service)+'</span>'
      : '<span class="biz-qi-source-chip src-general">General</span>';
    var priorityChip = isHigh ? '<span class="biz-qi-priority-chip">&#x26A1; High</span>' : '';

    var contactHtml = '';
    if (q.email || q.phone) {
      contactHtml = '<div class="biz-qi-contact">';
      if (q.email) contactHtml += '<a class="biz-qi-contact-link" href="mailto:'+esc(q.email)+'"><i class="fas fa-envelope"></i> '+esc(q.email)+'</a>';
      if (q.phone) contactHtml += '<a class="biz-qi-contact-link" href="tel:'+esc(q.phone)+'"><i class="fas fa-phone"></i> '+esc(q.phone)+'</a>';
      contactHtml += '</div>';
    }

    var actionsHtml = '<div class="biz-qi-actions">';
    actionsHtml += '<button class="biz-qi-action-btn priority'+(isHigh?' is-high':'')+'" onclick="window._bizActions.qTogglePriority(\''+esc(id)+'\',\''+esc(q.priority||'normal')+'\')">'+(isHigh ? 'Normal' : '&#x26A1; High')+'</button>';
    if (st !== 'replied' && st !== 'closed' && st !== 'archived') {
      actionsHtml += '<button class="biz-qi-action-btn replied" onclick="window._bizActions.updateQuoteStatus(\''+esc(id)+'\',\'replied\')"><i class="fas fa-reply"></i> Mark Replied</button>';
    }
    if (st !== 'closed' && st !== 'archived') {
      actionsHtml += '<button class="biz-qi-action-btn close" onclick="window._bizActions.updateQuoteStatus(\''+esc(id)+'\',\'closed\')"><i class="fas fa-check"></i> Close</button>';
    }
    if (st !== 'archived') {
      actionsHtml += '<button class="biz-qi-action-btn archive" onclick="window._bizActions.updateQuoteStatus(\''+esc(id)+'\',\'archived\')"><i class="fas fa-archive"></i> Archive</button>';
    }
    if (st === 'archived' || st === 'closed') {
      actionsHtml += '<button class="biz-qi-action-btn reopen" onclick="window._bizActions.updateQuoteStatus(\''+esc(id)+'\',\'read\')"><i class="fas fa-redo"></i> Reopen</button>';
    }
    actionsHtml += '</div>';

    return '<div class="biz-qi-card" data-quote-id="'+esc(id)+'">' +
      '<div class="biz-qi-card-head">' +
        '<span class="biz-qi-card-name">'+esc(q.name||'Anonymous')+'</span>' +
        '<span class="biz-qi-card-badges">'+statusChip+sourceChip+priorityChip+'</span>' +
      '</div>' +
      contactHtml +
      '<div class="biz-qi-message">'+esc(q.message||'')+'</div>' +
      '<div class="biz-qi-meta">'+timeAgo(q.createdAt)+'</div>' +
      '<div class="biz-qi-note-wrap" id="biz-qi-note-'+esc(id)+'">' +
        '<button class="biz-qi-note-toggle" onclick="window._bizActions.qToggleNote(\''+esc(id)+'\')"><i class="fas fa-sticky-note"></i> Note'+notePreview+'</button>' +
        '<div class="biz-qi-note-area" id="biz-qi-note-area-'+esc(id)+'" style="display:none">' +
          '<textarea class="biz-qi-note-input" id="biz-qi-note-ta-'+esc(id)+'" rows="2" placeholder="Private note visible only to you…">'+esc(q.ownerNote||'')+'</textarea>' +
          '<button class="biz-qi-note-save" onclick="window._bizActions.qSaveNote(\''+esc(id)+'\')"><i class="fas fa-save"></i> Save</button>' +
        '</div>' +
      '</div>' +
      actionsHtml +
    '</div>';
  }

  function _qRender() {
    var Q_FILTERS = [
      { key: 'all',      label: 'All'      },
      { key: 'new',      label: 'New'      },
      { key: 'read',     label: 'Read'     },
      { key: 'replied',  label: 'Replied'  },
      { key: 'closed',   label: 'Closed'   },
      { key: 'archived', label: 'Archived' },
      { key: 'high',     label: '&#x26A1; Priority' }
    ];

    var s = (_qSearch || '').toLowerCase();
    var filtered = _qAll.filter(function(q) {
      if (_qFilter === 'high') {
        if (q.priority !== 'high') return false;
      } else if (_qFilter !== 'all') {
        if ((q.status || 'new') !== _qFilter) return false;
      }
      if (s) {
        return (q.name||'').toLowerCase().indexOf(s) !== -1 ||
               (q.email||'').toLowerCase().indexOf(s) !== -1 ||
               (q.message||'').toLowerCase().indexOf(s) !== -1 ||
               (q.service||'').toLowerCase().indexOf(s) !== -1;
      }
      return true;
    });

    var filterHtml = Q_FILTERS.map(function(f) {
      var cnt;
      if (f.key === 'all')       cnt = _qAll.length;
      else if (f.key === 'high') cnt = _qAll.filter(function(q){ return q.priority === 'high'; }).length;
      else                       cnt = _qAll.filter(function(q){ return (q.status||'new') === f.key; }).length;
      if (f.key !== 'all' && cnt === 0) return '';
      return '<button class="biz-qi-filter-btn'+((_qFilter===f.key)?' active':'')+'" onclick="window._bizActions.qFilter(\''+f.key+'\')">'+
        f.label+' <span class="biz-qi-filter-cnt">'+cnt+'</span>'+
      '</button>';
    }).join('');

    var listHtml = filtered.length === 0
      ? '<div class="biz-qi-empty"><i class="fas fa-inbox"></i><p>No requests match this filter.</p></div>'
      : filtered.map(function(q){ return _bizQuoteCardHtml(q); }).join('');

    var filterZone = document.getElementById('biz-qi-filter-zone');
    if (filterZone) filterZone.innerHTML = '<div class="biz-qi-filters">'+filterHtml+'</div>';
    var listEl = document.getElementById('biz-qi-list');
    if (listEl) listEl.innerHTML = listHtml;
    var countEl = document.getElementById('biz-qi-count');
    if (countEl) countEl.textContent = _qAll.length;
  }

  // ── ACTIONS ───────────────────────────────────────────────────

  window._bizActions = {

    switchTab: function(id) {
      document.querySelectorAll('.biz-tab').forEach(function(b){ b.classList.remove('active'); });
      document.querySelectorAll('.biz-tab-panel').forEach(function(p){ p.classList.remove('active'); });
      var btn=document.querySelector('.biz-tab[data-tab="'+id+'"]'), panel=document.querySelector('.biz-tab-panel[data-panel="'+id+'"]');
      if(btn) btn.classList.add('active');
      if(panel) panel.classList.add('active');
    },

    toggleFollow: function() {
      if (!_currentUser) { showToast('Sign in to follow','false'); window.location.href='auth.html'; return; }
      var followId=BIZ_ID+'_'+_currentUser.uid;
      var followRef=_fs.doc(_db,'businessFollowers',followId);
      var btn=document.getElementById('biz-follow-btn');
      if (_isFollowing) {
        _fs.deleteDoc(followRef).then(function(){
          _isFollowing=false;
          _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID),{followerCount:_fs.increment(-1)}).catch(function(){});
          if(btn){ btn.className='biz-action-btn primary'; btn.innerHTML='<i class="fas fa-plus"></i> Follow'; }
          showToast('Unfollowed');
        }).catch(function(){ showToast('Could not unfollow',false); });
      } else {
        _fs.setDoc(followRef,{userId:_currentUser.uid,businessId:BIZ_ID,followedAt:_fs.serverTimestamp(),userName:_currentUser.displayName||'',userAvatar:_currentUser.photoURL||''}).then(function(){
          _isFollowing=true;
          _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID),{followerCount:_fs.increment(1)}).catch(function(){});
          notifyBusinessPage('page_follow', (_currentUser.displayName || 'Someone') + ' followed your page', 'Your page has a new follower.', 'business.html?id=' + BIZ_ID, { followerId: _currentUser.uid, followerName: _currentUser.displayName||'', followerAvatar: _currentUser.photoURL||'' });
          if(btn){ btn.className='biz-action-btn following'; btn.innerHTML='<i class="fas fa-check"></i> Following'; }
          showToast('Following!');
        }).catch(function(){ showToast('Could not follow',false); });
      }
    },

    toggleSave: function() {
      if (!_currentUser) { showToast('Sign in to save',false); window.location.href='auth.html'; return; }
      var saveId=_currentUser.uid+'_'+BIZ_ID;
      var saveRef=_fs.doc(_db,'savedBusinesses',saveId);
      var btn=document.getElementById('biz-save-btn');
      if (_isSaved) {
        _fs.deleteDoc(saveRef).then(function(){
          _isSaved=false;
          _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID),{saveCount:_fs.increment(-1)}).catch(function(){});
          if(btn){ btn.className='biz-action-btn'; btn.innerHTML='<i class="far fa-bookmark"></i> Save'; }
          showToast('Removed from saved');
        }).catch(function(){ showToast('Could not remove',false); });
      } else {
        _fs.setDoc(saveRef,{userId:_currentUser.uid,businessId:BIZ_ID,savedAt:_fs.serverTimestamp()}).then(function(){
          _isSaved=true;
          _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID),{saveCount:_fs.increment(1)}).catch(function(){});
          if(btn){ btn.className='biz-action-btn saved'; btn.innerHTML='<i class="fas fa-bookmark"></i> Saved'; }
          showToast('Saved!');
        }).catch(function(){ showToast('Could not save',false); });
      }
    },

    share: function() {
      var url=window.location.href;
      if(window.GeoShare){ window.GeoShare.sharePlace(BIZ_ID,_biz&&_biz.title,_biz&&_biz.city); return; }
      if(navigator.share){ navigator.share({title:(_biz&&_biz.title)||'GeoHub Business',url:url}).catch(function(){}); return; }
      if(navigator.clipboard){ navigator.clipboard.writeText(url).then(function(){ showToast('Link copied!'); }).catch(function(){}); }
    },

    openMessage: function() {
      if (!_currentUser) { showToast('Sign in to message this page', false); window.location.href='auth.html'; return; }
      window.location.href = _isActingAsPage
        ? 'messages.html?business=' + encodeURIComponent(BIZ_ID)
        : 'messages.html?withBusiness=' + encodeURIComponent(BIZ_ID);
    },

    switchToPage: function() {
      if (!_currentUser || (!_isOwner && !_isPageAdmin) || !_biz) return;
      var newActor = {
        type: 'business', businessId: BIZ_ID, ownerUid: _currentUser.uid,
        title: _biz.title || _biz.name || 'Business',
        logoUrl: _biz.logoUrl || '',
        coverUrl: _biz.coverUrl || _biz.coverImage || ''
      };
      try{ localStorage.setItem('gh_active_actor', JSON.stringify(newActor)); }catch(e){}
      window.dispatchEvent(new CustomEvent('GeoActorChanged', {detail: newActor}));
      location.reload();
    },

    switchToPersonal: function() {
      if (!_currentUser) return;
      var personalActor = { type: 'user', uid: _currentUser.uid };
      try{ localStorage.setItem('gh_active_actor', JSON.stringify(personalActor)); }catch(e){}
      window.dispatchEvent(new CustomEvent('GeoActorChanged', {detail: personalActor}));
      location.reload();
    },

    // ── Comment toggle ────────────────────────────────────────────
    toggleBizComment: function(postId) {
      var box = document.getElementById('biz-cmt-' + postId);
      if (!box) return;
      var opening = box.style.display === 'none' || box.style.display === '';
      box.style.display = opening ? 'block' : 'none';
      if (opening) {
        var ta = box.querySelector('textarea');
        if (ta) setTimeout(function(){ ta.focus(); }, 60);
      }
      if (!opening || box.dataset.loaded) return;
      box.dataset.loaded = '1';
      var listEl = document.getElementById('biz-cmt-list-' + postId);
      if (!listEl) return;
      var GeoSocial = window.GeoSocial;
      if (!GeoSocial || !GeoSocial.listenComments) {
        listEl.innerHTML = '<div class="biz-cmt-empty">Comments unavailable.</div>';
        return;
      }
      GeoSocial.listenComments(postId, function(comments) {
        if (!listEl.isConnected) return;
        var active = (comments || []).filter(function(c){ return c.status !== 'deleted'; });
        if (!active.length) {
          listEl.innerHTML = '<div class="biz-cmt-empty">No comments yet.</div>';
        } else {
          listEl.innerHTML = active.map(function(c) {
            return commentBubbleHtml(c, postId);
          }).join('');
        }
        // Update comment count badge
        var card = document.querySelector('[data-post-id="'+CSS.escape(postId)+'"]');
        if (card) {
          var cntBtn = card.querySelector('.biz-count-btn');
          if (cntBtn) cntBtn.textContent = active.length + ' comment' + (active.length===1?'':'s');
        }
      });
    },

    submitBizComment: function(postId, elOrForm) {
      var ta;
      if (elOrForm && elOrForm.tagName === 'TEXTAREA') {
        ta = elOrForm;
      } else if (elOrForm && elOrForm.querySelector) {
        ta = elOrForm.querySelector('textarea') || elOrForm.querySelector('input');
      }
      if (!ta) return;
      var val = ta.value.trim();
      if (!val) return;
      if (!_currentUser) { showToast('Sign in to comment', false); return; }
      var GeoSocial = window.GeoSocial;
      if (!GeoSocial || !GeoSocial.addComment) { showToast('Comments not available', false); return; }
      ta.disabled = true;
      var sendBtn = ta.parentNode && ta.parentNode.querySelector('.biz-cmt-send-btn');
      if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
      GeoSocial.addComment(postId, val, function(err) {
        ta.disabled = false;
        if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
        if (err) { showToast('Could not post comment', false); return; }
        ta.value = '';
        ta.style.height = 'auto';
      });
    },

    // ── Comment edit/delete/reply ─────────────────────────────────
    editComment: function(postId, commentId, btnEl) {
      if (!_currentUser) return;
      var textEl = document.getElementById('biz-cmt-text-'+postId+'-'+commentId);
      if (!textEl) return;
      if (textEl.querySelector('textarea')) return; // already editing
      var current = textEl.textContent || '';
      var ta = document.createElement('textarea');
      ta.className = 'biz-cmt-edit-ta';
      ta.value = current;
      ta.rows = 2;
      ta.style.cssText = 'width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#f1f5f9;padding:6px 10px;resize:none;font-size:.87rem;font-family:inherit;outline:none';
      var saveBtn = document.createElement('button');
      saveBtn.className = 'biz-cmt-send-btn';
      saveBtn.style.cssText = 'margin-top:4px;font-size:.78rem;padding:4px 12px;border-radius:12px';
      saveBtn.innerHTML = 'Save';
      var cancel = document.createElement('button');
      cancel.style.cssText = 'margin-top:4px;margin-left:6px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:.78rem;padding:4px 8px';
      cancel.textContent = 'Cancel';
      textEl.innerHTML = '';
      textEl.appendChild(ta);
      textEl.appendChild(document.createElement('br'));
      textEl.appendChild(saveBtn);
      textEl.appendChild(cancel);
      ta.focus();
      cancel.onclick = function() { textEl.innerHTML = esc(current); };
      saveBtn.onclick = function() {
        var newText = ta.value.trim();
        if (!newText || newText === current) { textEl.innerHTML = esc(current); return; }
        saveBtn.disabled = true; saveBtn.textContent = '…';
        _fs.updateDoc(_fs.doc(_db,'posts',postId,'comments',commentId), {
          text: newText, updatedAt: _fs.serverTimestamp()
        }).then(function() {
          textEl.innerHTML = esc(newText);
          showToast('Comment updated');
        }).catch(function(err) {
          textEl.innerHTML = esc(current);
          showToast('Could not edit: '+(err.code||err.message), false);
        });
      };
    },

    deleteComment: function(postId, commentId, btnEl) {
      if (!_currentUser) return;
      if (!confirm('Delete this comment?')) return;
      _fs.updateDoc(_fs.doc(_db,'posts',postId,'comments',commentId), {
        status: 'deleted', updatedAt: _fs.serverTimestamp()
      }).then(function() {
        var wrap = document.querySelector('[data-cid="'+CSS.escape(commentId)+'"]');
        if (wrap) { wrap.style.transition='opacity .2s'; wrap.style.opacity='0'; setTimeout(function(){ wrap.remove(); },220); }
        _fs.updateDoc(_fs.doc(_db,'posts',postId),{commentCount:_fs.increment(-1)}).catch(function(){});
        showToast('Comment deleted');
      }).catch(function(err) { showToast('Could not delete: '+(err.code||err.message), false); });
    },

    replyToComment: function(postId, commentId, authorName) {
      var composerId = 'biz-rpl-' + postId + '-' + commentId;
      var composer = document.getElementById(composerId);
      if (!composer) return;
      var isHidden = composer.style.display === 'none' || !composer.style.display;
      if (isHidden) {
        composer.style.display = 'block';
        var ta = composer.querySelector('textarea');
        if (ta) {
          var prefix = '@' + authorName + ' ';
          if (!ta.value.startsWith(prefix)) ta.value = prefix;
          setTimeout(function(){ ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }, 50);
        }
      } else {
        composer.style.display = 'none';
      }
    },

    submitBizReply: function(postId, commentId, ta) {
      if (!ta) return;
      var val = ta.value.trim();
      if (!val) return;
      if (!_currentUser) { showToast('Sign in to reply', false); return; }
      ta.disabled = true;
      var sendBtn = ta.parentNode && ta.parentNode.querySelector('.biz-cmt-send-btn');
      if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
      var done = function(err) {
        ta.disabled = false;
        if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
        if (err) { showToast('Could not post reply', false); return; }
        ta.value = ''; ta.style.height = 'auto';
        var composer = document.getElementById('biz-rpl-'+postId+'-'+commentId);
        if (composer) composer.style.display = 'none';
        _fs.updateDoc(_fs.doc(_db,'posts',postId,'comments',commentId), {replyCount: _fs.increment(1)}).catch(function(){});
        showToast('Reply posted!');
        window._bizActions.toggleReplies(postId, commentId, null, true);
      };
      var GeoSocial = window.GeoSocial;
      if (GeoSocial && GeoSocial.addCommentReply) {
        GeoSocial.addCommentReply(postId, commentId, val, done);
      } else {
        _fs.addDoc(_fs.collection(_db,'posts',postId,'comments',commentId,'replies'), {
          text: val,
          authorId: _currentUser.uid,
          userId: _currentUser.uid,
          authorName: _currentUser.displayName || (_currentUser.email||'').split('@')[0] || 'User',
          authorAvatar: _currentUser.photoURL || '',
          createdAt: _fs.serverTimestamp(),
          status: 'active'
        }).then(function(){ done(null); }).catch(done);
      }
    },

    toggleReplies: function(postId, commentId, btnEl, forceOpen) {
      var section = document.getElementById('biz-replies-'+postId+'-'+commentId);
      if (!section) return;
      var isVisible = section.style.display !== 'none' && section.style.display !== '';
      // Toggle closed (unless forceOpen)
      if (!forceOpen && isVisible) {
        section.style.display = 'none';
        if (btnEl) {
          var cnt = parseInt(btnEl.dataset.count || '0', 10);
          btnEl.innerHTML = '<i class="fas fa-chevron-down" style="font-size:.6rem"></i> '+cnt+' repl'+(cnt===1?'y':'ies');
        }
        return;
      }
      // Open section
      section.style.display = 'block';
      if (btnEl) { btnEl.innerHTML = '<i class="fas fa-chevron-up" style="font-size:.6rem"></i> Hide replies'; btnEl.style.display = ''; }
      var vrb = document.getElementById('biz-vrb-'+postId+'-'+commentId);
      if (vrb) vrb.style.display = '';
      // If real-time listener is active, it updates automatically
      if (section.dataset.listening) return;
      // If getDocs already loaded and not forcing refresh, done
      if (section.dataset.loaded && !forceOpen) return;
      section.dataset.loaded = '1';
      if (!isVisible) section.innerHTML = '<div style="color:#64748b;font-size:.78rem;padding:4px 0"><i class="fas fa-spinner fa-spin"></i></div>';
      var render = function(replies) {
        if (!section.isConnected) return;
        var active = (replies||[]).filter(function(r){ return r.status !== 'deleted'; });
        section.innerHTML = active.length
          ? active.map(function(r){ return replyBubbleHtml(r, postId, commentId); }).join('')
          : '';
        var vrbEl = document.getElementById('biz-vrb-'+postId+'-'+commentId);
        if (vrbEl) { vrbEl.dataset.count = String(active.length); vrbEl.style.display = active.length ? '' : 'none'; }
      };
      var GeoSocial = window.GeoSocial;
      if (GeoSocial && GeoSocial.listenCommentReplies) {
        section.dataset.listening = '1';
        GeoSocial.listenCommentReplies(postId, commentId, render);
      } else {
        _fs.getDocs(_fs.collection(_db,'posts',postId,'comments',commentId,'replies'))
          .then(function(snap) {
            var replies = [];
            snap.forEach(function(d){ replies.push(Object.assign({id:d.id},d.data())); });
            replies.sort(function(a,b){
              var ta=(a.createdAt&&a.createdAt.seconds)||0, tb=(b.createdAt&&b.createdAt.seconds)||0;
              return ta-tb;
            });
            render(replies);
          }).catch(function(){ render([]); });
      }
    },

    editReply: function(postId, commentId, replyId, btnEl) {
      if (!_currentUser) return;
      var textEl = document.getElementById('biz-reply-text-'+postId+'-'+commentId+'-'+replyId);
      if (!textEl || textEl.querySelector('textarea')) return;
      var current = textEl.textContent || '';
      var ta = document.createElement('textarea');
      ta.value = current; ta.rows = 2;
      ta.style.cssText = 'width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#f1f5f9;padding:6px 10px;resize:none;font-size:.87rem;font-family:inherit;outline:none';
      var saveBtn = document.createElement('button');
      saveBtn.style.cssText = 'margin-top:4px;font-size:.78rem;padding:4px 12px;border-radius:12px;background:#10b981;color:#fff;border:none;cursor:pointer;font-family:inherit';
      saveBtn.textContent = 'Save';
      var cancel = document.createElement('button');
      cancel.style.cssText = 'margin-top:4px;margin-left:6px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:.78rem;padding:4px 8px;font-family:inherit';
      cancel.textContent = 'Cancel';
      textEl.innerHTML = '';
      textEl.appendChild(ta); textEl.appendChild(document.createElement('br'));
      textEl.appendChild(saveBtn); textEl.appendChild(cancel);
      ta.focus();
      cancel.onclick = function() { textEl.innerHTML = esc(current); };
      saveBtn.onclick = function() {
        var newText = ta.value.trim();
        if (!newText || newText === current) { textEl.innerHTML = esc(current); return; }
        saveBtn.disabled = true; saveBtn.textContent = '…';
        _fs.updateDoc(_fs.doc(_db,'posts',postId,'comments',commentId,'replies',replyId), {
          text: newText, updatedAt: _fs.serverTimestamp()
        }).then(function() {
          textEl.innerHTML = esc(newText);
          showToast('Reply updated');
        }).catch(function() { textEl.innerHTML = esc(current); showToast('Could not edit reply', false); });
      };
    },

    deleteReply: function(postId, commentId, replyId, btnEl) {
      if (!_currentUser) return;
      if (!confirm('Delete this reply?')) return;
      _fs.updateDoc(_fs.doc(_db,'posts',postId,'comments',commentId,'replies',replyId), {
        status: 'deleted', updatedAt: _fs.serverTimestamp()
      }).then(function() {
        var wrap = document.querySelector('[data-rid="'+CSS.escape(replyId)+'"]');
        if (wrap) { wrap.style.transition='opacity .2s'; wrap.style.opacity='0'; setTimeout(function(){ wrap.remove(); },220); }
        _fs.updateDoc(_fs.doc(_db,'posts',postId,'comments',commentId), {replyCount: _fs.increment(-1)}).catch(function(){});
        showToast('Reply deleted');
      }).catch(function() { showToast('Could not delete reply', false); });
    },

    // ── Reactions ─────────────────────────────────────────────────
    setReaction: function(postId, key) {
      if (!_currentUser) { showToast('Sign in to react', false); return; }
      window._bizActions.closeAllPickers();
      var pr = _postReactions[postId] || {};
      var prevKey = pr.key || null;
      var rx = REACTIONS.find(function(r){ return r.key === key; }) || REACTIONS[0];
      var btnEl = document.querySelector('.biz-rx-wrap[data-pid="'+CSS.escape(postId)+'"] .biz-react-btn');
      var rxRef = _fs.doc(_db,'posts',postId,'reactions',_currentUser.uid);

      if (prevKey === key) {
        // Toggle off — remove reaction
        _postReactions[postId] = { loaded: true };
        _fs.deleteDoc(rxRef).catch(function(){});
        if (key === 'like') _fs.deleteDoc(_fs.doc(_db,'posts',postId,'likes',_currentUser.uid)).catch(function(){});
        if (btnEl) { btnEl.removeAttribute('data-reaction'); btnEl.innerHTML = '<i class="far fa-thumbs-up"></i> Like'; }
        _fs.updateDoc(_fs.doc(_db,'posts',postId),{likeCount:_fs.increment(-1)}).catch(function(){});
        var lcEl = document.getElementById('biz-lk-cnt-'+postId);
        if (lcEl) { var c = parseInt(lcEl.textContent.replace(/[^\d]/g,''),10)||0; lcEl.textContent = '👍 '+compact(Math.max(0,c-1)); }
      } else {
        // Set / change reaction
        _postReactions[postId] = { loaded: true, key: key, emoji: rx.emoji };
        _fs.setDoc(rxRef,{key:key,emoji:rx.emoji,userId:_currentUser.uid,createdAt:_fs.serverTimestamp()},{merge:true}).catch(function(){});
        if (key === 'like') _fs.setDoc(_fs.doc(_db,'posts',postId,'likes',_currentUser.uid),{userId:_currentUser.uid,createdAt:_fs.serverTimestamp()},{merge:true}).catch(function(){});
        if (btnEl) { btnEl.setAttribute('data-reaction', key); btnEl.innerHTML = rx.emoji + ' ' + rx.label; }
        if (!prevKey) {
          _fs.updateDoc(_fs.doc(_db,'posts',postId),{likeCount:_fs.increment(1)}).catch(function(){});
          var lkEl = document.getElementById('biz-lk-cnt-'+postId);
          if (lkEl) { lkEl.textContent = '👍 '+compact((parseInt(lkEl.textContent.replace(/[^\d]/g,''),10)||0)+1); }
        }
      }
    },

    toggleReaction: function(postId) {
      if (!_currentUser) { showToast('Sign in to react', false); return; }
      var pr = _postReactions[postId];
      if (pr && pr.loaded) {
        window._bizActions.setReaction(postId, pr.key || 'like');
      } else {
        _postReactions[postId] = { loading: true };
        _fs.getDoc(_fs.doc(_db,'posts',postId,'reactions',_currentUser.uid))
          .then(function(snap) {
            if (!snap.exists()) {
              _postReactions[postId] = { loaded: true };
              window._bizActions.setReaction(postId, 'like');
            } else {
              var d = snap.data();
              _postReactions[postId] = { loaded: true, key: d.key, emoji: d.emoji };
              var rx = REACTIONS.find(function(r){ return r.key === d.key; }) || REACTIONS[0];
              var btnEl = document.querySelector('.biz-rx-wrap[data-pid="'+CSS.escape(postId)+'"] .biz-react-btn');
              if (btnEl) { btnEl.setAttribute('data-reaction', d.key); btnEl.innerHTML = d.emoji + ' ' + rx.label; }
              // User clicked again → toggle off
              window._bizActions.setReaction(postId, d.key);
            }
          })
          .catch(function(){ _postReactions[postId]={loaded:true}; window._bizActions.setReaction(postId,'like'); });
      }
    },

    openReactionPicker: function(postId) {
      window._bizActions.closeAllPickers();
      var picker = document.getElementById('biz-rxp-'+postId);
      if (picker) picker.classList.add('open');
      setTimeout(function(){
        document.addEventListener('click', function _h(e){
          if (!e.target.closest || !e.target.closest('.biz-rx-wrap')) window._bizActions.closeAllPickers();
          document.removeEventListener('click', _h);
        });
      }, 0);
    },

    closeAllPickers: function() {
      document.querySelectorAll('.biz-rx-picker.open').forEach(function(p){ p.classList.remove('open'); });
    },

    _rxLongPress: function(postId, e) {
      _rxLongTimer = setTimeout(function(){
        _rxLongTimer = null;
        e.preventDefault();
        window._bizActions.openReactionPicker(postId);
      }, 600);
    },

    _rxCancelPress: function() {
      if (_rxLongTimer) { clearTimeout(_rxLongTimer); _rxLongTimer = null; }
    },

    // ── Share modal ───────────────────────────────────────────────
    openShareModal: function(postId) {
      if (!_currentUser) { showToast('Sign in to share', false); return; }
      _sharePostId = postId;
      var overlay = document.getElementById('biz-share-overlay');
      if (!overlay) return;
      var cap = document.getElementById('biz-share-caption');
      if (cap) cap.value = '';
      overlay.classList.add('open');
    },

    closeShareModal: function() {
      _sharePostId = null;
      var overlay = document.getElementById('biz-share-overlay');
      if (overlay) overlay.classList.remove('open');
    },

    submitShare: function(type) {
      if (!_currentUser || !_sharePostId) return;
      var postId = _sharePostId;
      var caption = ((document.getElementById('biz-share-caption')||{}).value||'').trim();
      window._bizActions.closeShareModal();
      var extra = { type:'share', sharedPostId:postId, sharedBusinessId:BIZ_ID, visibility:'public', targetType: type==='profile'?'user':'public' };
      var GeoSocial = window.GeoSocial;
      if (GeoSocial && GeoSocial.createPost) {
        GeoSocial.createPost(caption, '', function(newId) {
          if (newId) {
            showToast('Shared!');
            _fs.updateDoc(_fs.doc(_db,'posts',postId),{shareCount:_fs.increment(1)}).catch(function(){});
          } else { showToast('Could not share', false); }
        }, extra);
      } else {
        var authorName = _currentUser.displayName || (_currentUser.email||'').split('@')[0] || 'User';
        _fs.addDoc(_fs.collection(_db,'posts'), Object.assign({
          text:caption, authorId:_currentUser.uid, authorName:authorName,
          authorAvatar:_currentUser.photoURL||'', status:'active',
          likeCount:0, commentCount:0, shareCount:0, reactionCount:0, saveCount:0,
          createdAt:_fs.serverTimestamp(), updatedAt:_fs.serverTimestamp(),
        }, extra))
        .then(function(){
          showToast('Shared!');
          _fs.updateDoc(_fs.doc(_db,'posts',postId),{shareCount:_fs.increment(1)}).catch(function(){});
        }).catch(function(){ showToast('Could not share', false); });
      }
    },

    copyShareLink: function() {
      var postId = _sharePostId;
      window._bizActions.closeShareModal();
      var url = window.location.origin + window.location.pathname + '?id=' + encodeURIComponent(BIZ_ID) + '#post-' + (postId||'');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function(){ showToast('Link copied!'); }).catch(function(){ showToast('Could not copy', false); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = url; ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); showToast('Link copied!'); } catch(e){ showToast('Could not copy', false); }
        document.body.removeChild(ta);
      }
    },

    nativeShare: function() {
      var postId = _sharePostId;
      window._bizActions.closeShareModal();
      var url = window.location.origin + window.location.pathname + '?id=' + encodeURIComponent(BIZ_ID) + '#post-' + (postId||'');
      if (navigator.share) {
        navigator.share({ title: (_biz&&_biz.title)||'GeoHub Post', url: url }).catch(function(){});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function(){ showToast('Link copied!'); }).catch(function(){});
      }
    },

    // kept for backward compat with any cached cards
    likePost: function(postId) { window._bizActions.toggleReaction(postId); },

    // ── Post owner menu ───────────────────────────────────────────
    openPostMenu: function(postId, btnEl) {
      var oldFloating = document.getElementById('ghBizPostMenuDrop');
      var isOpen = oldFloating && oldFloating.getAttribute('data-post-id') === String(postId || '');
      if (oldFloating) oldFloating.remove();
      document.querySelectorAll('.biz-post-menu-dropdown.open').forEach(function(d){ d.classList.remove('open'); });
      if (isOpen || !btnEl) return;

      var card = btnEl.closest && btnEl.closest('[data-post-id]');
      if (!card) return;
      var sourceMenu = card.querySelector('.biz-post-menu-dropdown');
      if (!sourceMenu) return;

      var menu = sourceMenu.cloneNode(true);
      menu.id = 'ghBizPostMenuDrop';
      menu.setAttribute('data-post-id', String(postId || ''));
      menu.style.position = 'fixed';
      menu.style.left = '0px';
      menu.style.right = 'auto';
      menu.style.top = '0px';
      menu.style.display = 'block';
      menu.style.visibility = 'hidden';
      menu.style.opacity = '1';
      menu.style.pointerEvents = 'auto';
      menu.style.zIndex = '10080';
      menu.classList.add('open');
      document.body.appendChild(menu);

      var rect = btnEl.getBoundingClientRect();
      var menuRect = menu.getBoundingClientRect();
      var gap = 8;
      var vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      var vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      var menuWidth = menuRect.width || menu.offsetWidth || 218;
      var menuHeight = menuRect.height || menu.offsetHeight || 260;
      var left = rect.right - menuWidth;
      if (left < gap) left = rect.left;
      if (left + menuWidth > vw - gap) left = vw - menuWidth - gap;
      left = Math.max(gap, left);
      var top = rect.bottom + gap;
      if (top + menuHeight > vh - gap) top = rect.top - menuHeight - gap;
      top = Math.max(gap, top);
      menu.style.left = Math.round(left) + 'px';
      menu.style.top = Math.round(top) + 'px';
      menu.style.visibility = 'visible';

      var closeMenu = function() {
        document.removeEventListener('click', outsideClick, true);
        document.removeEventListener('keydown', escapeClose, true);
        window.removeEventListener('scroll', closeMenu, true);
        window.removeEventListener('resize', closeMenu, true);
        var current = document.getElementById('ghBizPostMenuDrop');
        if (current) current.remove();
      };
      var outsideClick = function(e) {
        var current = document.getElementById('ghBizPostMenuDrop');
        if (current && !current.contains(e.target)) closeMenu();
      };
      var escapeClose = function(e) {
        if (e.key === 'Escape') closeMenu();
      };
      menu.addEventListener('click', function() {
        setTimeout(closeMenu, 0);
      });
      setTimeout(function(){
        document.addEventListener('click', outsideClick, true);
        document.addEventListener('keydown', escapeClose, true);
        window.addEventListener('scroll', closeMenu, true);
        window.addEventListener('resize', closeMenu, true);
      }, 0);
    },

    // ── Edit post ─────────────────────────────────────────────────
    editPost: function(postId) {
      document.querySelectorAll('.biz-post-menu-dropdown.open').forEach(function(d){ d.classList.remove('open'); });
      var card = document.querySelector('[data-post-id="'+CSS.escape(postId)+'"]');
      if (!card) return;
      var textEl = card.querySelector('.gh-post-text, .biz-post-text');
      var currentText = textEl ? textEl.textContent : '';
      var currentVis = card.dataset.vis || 'public';
      _editPostId = postId;
      var modal = document.getElementById('biz-edit-modal');
      var ta    = document.getElementById('biz-edit-textarea');
      var sel   = document.getElementById('biz-edit-vis');
      if (!modal || !ta) return;
      ta.value = currentText;
      if (sel) sel.value = currentVis;
      modal.classList.add('open');
      setTimeout(function(){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 80);
    },

    closeEditModal: function() {
      _editPostId = null;
      var modal = document.getElementById('biz-edit-modal');
      if (modal) modal.classList.remove('open');
    },

    savePostEdit: function() {
      if (!_editPostId) return;
      var ta  = document.getElementById('biz-edit-textarea');
      var sel = document.getElementById('biz-edit-vis');
      var btn = document.getElementById('biz-edit-save-btn');
      if (!ta) return;
      var newText = ta.value.trim();
      var newVis  = sel ? sel.value : 'public';
      if (!newText) { showToast('Post text cannot be empty', false); return; }
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
      var postId = _editPostId;
      _fs.updateDoc(_fs.doc(_db,'posts',postId), {
        text: newText, visibility: newVis, updatedAt: _fs.serverTimestamp()
      }).then(function(){
        window._bizActions.closeEditModal();
        showToast('Post updated');
        // Update card in place
        var card = document.querySelector('[data-post-id="'+CSS.escape(postId)+'"]');
        if (card) {
          var textEl = card.querySelector('.gh-post-text, .biz-post-text');
          if (textEl) textEl.textContent = newText;
          card.dataset.vis = newVis;
        }
      }).catch(function(err){
        showToast('Could not save: '+(err.code||err.message), false);
      }).finally(function(){
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Save'; }
      });
    },

    // ── Delete post ───────────────────────────────────────────────
    deletePost: function(postId) {
      document.querySelectorAll('.biz-post-menu-dropdown.open').forEach(function(d){ d.classList.remove('open'); });
      if (!_currentUser) return;
      if (!confirm('Delete this post? This cannot be undone.')) return;
      _fs.updateDoc(_fs.doc(_db,'posts',postId), {
        status: 'deleted', updatedAt: _fs.serverTimestamp()
      }).then(function(){
        showToast('Post deleted');
        // Remove card from all lists
        document.querySelectorAll('[data-post-id="'+CSS.escape(postId)+'"]').forEach(function(el){
          el.style.transition = 'opacity .25s';
          el.style.opacity = '0';
          setTimeout(function(){ el.remove(); }, 260);
        });
      }).catch(function(err){ showToast('Could not delete: '+(err.code||err.message), false); });
    },

    deletePage: function() {
      if (!_currentUser || !_isOwner) return;
      var pageName = _biz && _biz.title ? _biz.title : 'this page';
      var confirmed = window.prompt('To delete this page permanently, type the page name:\n\n"' + pageName + '"');
      if (confirmed === null) return;
      if (confirmed.trim() !== pageName) { showToast('Name did not match. Page not deleted.', false); return; }
      var btn = document.querySelector('.biz-admin-btn[onclick*="deletePage"]');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting…'; }
      _fs.updateDoc(_fs.doc(_db, 'businesses', BIZ_ID), {
        status: 'deleted',
        deletedAt: _fs.serverTimestamp(),
        deletedBy: _currentUser.uid
      }).then(function() {
        showToast('Page deleted');
        setTimeout(function() { window.location.href = 'business.html'; }, 1200);
      }).catch(function(err) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> Delete Page'; }
        showToast('Could not delete page: ' + (err.code || err.message), false);
      });
    },

    // ── Toggle comments ───────────────────────────────────────────
    togglePostComments: function(postId) {
      document.querySelectorAll('.biz-post-menu-dropdown.open').forEach(function(d){ d.classList.remove('open'); });
      if (!_currentUser) return;
      // Read current disabled state from _currentPosts (cards may use shared structure now)
      var post0 = _currentPosts && _currentPosts.find(function(p){ return p.id === postId; });
      var isOff = post0 ? !!post0.commentsDisabled : false;
      var newVal = !isOff;
      _fs.updateDoc(_fs.doc(_db,'posts',postId), {
        commentsDisabled: newVal, updatedAt: _fs.serverTimestamp()
      }).then(function(){
        showToast(newVal ? 'Comments disabled' : 'Comments enabled');
        // Reload posts to reflect new state
        loadBizPosts();
      }).catch(function(err){ showToast('Could not update: '+(err.code||err.message), false); });
    },

    // ── Pin / unpin ───────────────────────────────────────────────
    pinPost: function(postId) {
      document.querySelectorAll('.biz-post-menu-dropdown.open').forEach(function(d){ d.classList.remove('open'); });
      if (!_currentUser) return;
      var card = document.querySelector('[data-post-id="'+CSS.escape(postId)+'"]');
      var isPinned = card && card.dataset.pinned === '1';
      _fs.updateDoc(_fs.doc(_db,'posts',postId), {
        pinned: !isPinned, updatedAt: _fs.serverTimestamp()
      }).then(function(){
        showToast(isPinned ? 'Post unpinned' : 'Post pinned');
        loadBizPosts();
      }).catch(function(err){ showToast('Could not update: '+(err.code||err.message), false); });
    },

    // ── Set visibility ────────────────────────────────────────────
    setPostVisibility: function(postId, vis) {
      document.querySelectorAll('.biz-post-menu-dropdown.open').forEach(function(d){ d.classList.remove('open'); });
      if (!_currentUser) return;
      _fs.updateDoc(_fs.doc(_db,'posts',postId), {
        visibility: vis, updatedAt: _fs.serverTimestamp()
      }).then(function(){
        var labels = { public:'Public', followers:'Followers only', private:'Private' };
        showToast('Visibility: '+(labels[vis]||vis));
        loadBizPosts();
      }).catch(function(err){ showToast('Could not update: '+(err.code||err.message), false); });
    },

    openQuote: function(serviceTitle, serviceId, mode) {
      if (!_currentUser) { showToast('Sign in to request a quote', false); window.location.href='auth.html'; return; }
      var m = document.getElementById('biz-quote-modal'); if (!m) return;
      var sf = document.getElementById('q-service');
      if (sf) sf.value = serviceTitle ? String(serviceTitle) : '';
      var titleEl = document.getElementById('biz-q-modal-title');
      var subEl   = document.getElementById('biz-q-modal-sub');
      var bizName = (_biz && _biz.title) || 'this business';
      if (mode === 'service') {
        if (titleEl) titleEl.textContent = 'Request this Service';
        if (subEl)   subEl.innerHTML = '<i class="fas fa-briefcase" style="color:#10b981;margin-right:4px"></i>'+
          esc(serviceTitle||'service')+' &middot; '+esc(bizName);
      } else if (mode === 'product') {
        if (titleEl) titleEl.textContent = 'Ask about this Product';
        if (subEl)   subEl.innerHTML = '<i class="fas fa-box" style="color:#60a5fa;margin-right:4px"></i>'+
          esc(serviceTitle||'product')+' &middot; '+esc(bizName);
      } else {
        if (titleEl) titleEl.textContent = 'Request a Quote';
        if (subEl)   subEl.innerHTML = 'Send a message to <strong>'+esc(bizName)+'</strong>';
      }
      window._quoteMode = mode || 'general';
      m.classList.add('open');
      var nameEl = document.getElementById('q-name');
      if (nameEl && !nameEl.value) setTimeout(function(){ nameEl.focus(); }, 100);
    },
    closeQuote: function() { var m=document.getElementById('biz-quote-modal'); if(m) m.classList.remove('open'); },

    submitQuote: function() {
      var name    = ((document.getElementById('q-name')||{}).value||'').trim();
      var email   = ((document.getElementById('q-email')||{}).value||'').trim();
      var phone   = ((document.getElementById('q-phone')||{}).value||'').trim();
      var service = ((document.getElementById('q-service')||{}).value||'').trim();
      var msg     = ((document.getElementById('q-message')||{}).value||'').trim();
      var btn     = document.getElementById('q-submit-btn');
      if(!name||!email||!msg){ showToast('Please fill in name, email, and message',false); return; }
      if(!_currentUser){ showToast('Please sign in',false); return; }
      if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Sending…'; }
      var payload = {
        name: name, email: email, phone: phone, message: msg,
        submittedBy: _currentUser.uid, businessId: BIZ_ID,
        status: 'new', createdAt: _fs.serverTimestamp(),
        source: window._quoteMode || 'general'
      };
      if(service) payload.service = service;
      _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'quoteRequests'), payload).then(function(){
        _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID),{quoteCount:_fs.increment(1)}).catch(function(){});
        var notifBody = (service ? 'Service: ' + service + ' - ' : '') + msg.slice(0,120);
        notifyBusinessPage('quote_request', name + ' sent your page a quote request', notifBody, 'business.html?id=' + BIZ_ID + '#quotes', { submittedBy: _currentUser.uid });
        // Notify business owner
        var ownerId = _biz && _biz.ownerId;
        if(false && ownerId && ownerId !== _currentUser.uid && window.GeoSocial) {
          var notifFn = window.GeoSocial.createNotification || window.GeoSocial.createSystemNotification;
          if(notifFn) {
            var notifBody = (service ? 'Service: ' + service + ' — ' : '') + msg.slice(0,120);
            notifFn(
              ownerId, 'quote_request',
              name + ' sent you a quote request',
              notifBody,
              'business.html?id=' + BIZ_ID + '#quotes',
              { businessId: BIZ_ID, submittedBy: _currentUser.uid }
            );
          }
        }
        window._bizActions.closeQuote();
        // Clear form for next use
        ['q-name','q-email','q-phone','q-service','q-message'].forEach(function(id){
          var el=document.getElementById(id); if(el) el.value='';
        });
        showToast('Quote request sent!');
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Send Request'; }
      }).catch(function(err){
        console.error('[BizPage] Quote submit failed',err);
        showToast('Could not send. Try again.',false);
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Send Request'; }
      });
    },

    _updateIdentityLabel: function() {
      var chk = document.getElementById('biz-identity-as-biz');
      var lbl = document.getElementById('biz-identity-label');
      if (!lbl) return;
      if (chk && chk.checked) {
        lbl.innerHTML = 'Posting as <strong>'+esc(_biz && _biz.title ? _biz.title : 'your business')+'</strong>';
      } else {
        var myName = _currentUser ? (_currentUser.displayName || _currentUser.email || 'you') : 'you';
        lbl.innerHTML = 'Posting as <strong>'+esc(myName)+'</strong>';
      }
    },

    openCompose: function(){
      var m=document.getElementById('biz-compose-modal'); if(!m) return;
      m.classList.add('open');
      // Auto-focus and disable Post until valid
      var ta=document.getElementById('biz-compose-text');
      if(ta){ setTimeout(function(){ ta.focus(); },80); }
      function _updateBizSubmit(){
        var btn=document.getElementById('biz-compose-btn'); if(!btn) return;
        var hasText=!!(ta&&ta.value.trim());
        var hasFiles=!!(window._composePendingFiles&&window._composePendingFiles.length);
        btn.disabled=!(hasText||hasFiles);
      }
      if(ta){ ta.addEventListener('input',_updateBizSubmit); _updateBizSubmit(); }
      // Store validator so photo changes can trigger it too
      window._bizComposeValidate=_updateBizSubmit;
    },
    closeCompose: function(){
      var m=document.getElementById('biz-compose-modal'); if(!m) return;
      var ta=document.getElementById('biz-compose-text');
      var hasText=!!(ta&&ta.value.trim());
      var hasFiles=!!(window._composePendingFiles&&window._composePendingFiles.length);
      if((hasText||hasFiles) && !confirm('Discard your post?')) return;
      m.classList.remove('open');
      if(ta) ta.value='';
      window._composePendingFiles=[];
      var pr=document.getElementById('biz-compose-photos'); if(pr) pr.innerHTML='';
      var btn=document.getElementById('biz-compose-btn'); if(btn) btn.disabled=true;
      window._bizComposeValidate=null;
    },

    openPhotoInCompose: function(){
      var inp=document.getElementById('biz-compose-photo-input'); if(inp) inp.click();
    },

    handleComposePhoto: function(input){
      if(!input.files||!input.files.length) return;
      var files=Array.from(input.files).slice(0,4);
      window._composePendingFiles=(window._composePendingFiles||[]).concat(files).slice(0,4);
      input.value='';
      window._bizActions._renderComposePreview();
      if(window._bizComposeValidate) window._bizComposeValidate();
    },

    removeComposePhoto: function(idx){
      if(!window._composePendingFiles) return;
      window._composePendingFiles.splice(idx,1);
      window._bizActions._renderComposePreview();
      if(window._bizComposeValidate) window._bizComposeValidate();
    },

    _renderComposePreview: function(){
      var pr=document.getElementById('biz-compose-photos'); if(!pr) return;
      var files=window._composePendingFiles||[];
      pr.innerHTML='';
      files.forEach(function(file,i){
        var reader=new FileReader();
        reader.onload=function(e){
          var d=document.createElement('div'); d.className='biz-compose-photo-thumb';
          d.innerHTML='<img src="'+e.target.result+'" alt=""><button type="button" onclick="window._bizActions.removeComposePhoto('+i+')"><i class="fas fa-times"></i></button>';
          pr.appendChild(d);
        };
        reader.readAsDataURL(file);
      });
    },

    submitBizPost: function() {
      if(!_currentUser){ showToast('Sign in to post',false); window.location.href='auth.html'; return; }
      var textVal=(document.getElementById('biz-compose-text')||{}).value||'';
      var files=window._composePendingFiles||[];
      if(!textVal.trim()&&!files.length){ showToast('Write something or add a photo',false); return; }
      var btn=document.getElementById('biz-compose-btn');
      if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Posting…'; }

      // Determine post identity: owner/admin can toggle between business and self
      var chk = document.getElementById('biz-identity-as-biz');
      var postAsBiz = _isActingAsPage && (!chk || chk.checked);
      var authorId     = _currentUser.uid;
      var authorName   = postAsBiz ? (_biz.title||'Business') : (_currentUser.displayName || _currentUser.email || 'User');
      var authorAvatar = postAsBiz ? (_biz.logoUrl||'') : (_currentUser.photoURL||'');
      var authorType   = postAsBiz ? 'business' : 'user';

      var capturedUrls=[];

      var uploadAll = files.length
        ? Promise.all(files.map(function(f){
            return new Promise(function(res){ directCloudinaryUpload(f,res,null); });
          }))
        : Promise.resolve([]);

      uploadAll.then(function(urls){
        capturedUrls=urls.filter(Boolean);
        return _fs.addDoc(_fs.collection(_db,'posts'),{
          text:textVal.trim(),
          businessId:BIZ_ID,
          authorId:authorId,
          authorName:authorName,
          authorAvatar:authorAvatar,
          authorType:authorType,
          targetType:'business',
          targetId:BIZ_ID,
          type:'business',
          visibility:'public',
          status:'active',
          likeCount:0,commentCount:0,shareCount:0,reactionCount:0,saveCount:0,
          mediaUrls:capturedUrls,
          createdAt:_fs.serverTimestamp(),
          updatedAt:_fs.serverTimestamp(),
        });
      }).then(function(docRef){
        window._bizActions.closeCompose();
        showToast('Posted!');
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Post'; }
        // Optimistic UI: prepend post immediately without waiting for re-fetch
        var nowTs = { toMillis: function(){ return Date.now(); } };
        var newPost = {
          id: docRef.id, text: textVal.trim(), businessId: BIZ_ID,
          authorId: authorId, authorName: authorName,
          authorAvatar: authorAvatar,
          authorType: authorType, targetType:'business', targetId:BIZ_ID,
          type:'business', visibility:'public', status:'active',
          mediaUrls: capturedUrls, createdAt: nowTs,
          likeCount: 0, commentCount: 0, shareCount: 0
        };
        var card = postCardHtml(newPost, _biz);
        ['biz-posts-overview','biz-posts-all'].forEach(function(elId){
          var el = document.getElementById(elId);
          if (!el) return;
          var list = el.querySelector('.biz-post-list');
          if (list) {
            list.insertAdjacentHTML('afterbegin', card);
          } else {
            el.innerHTML = '<div class="biz-post-list">'+card+'</div>';
          }
        });
      }).catch(function(err){
        console.error('[BizPage] Post failed',err);
        showToast('Post failed: '+(err.code||err.message||'check console'),false);
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Post'; }
      });
    },

    likePost: function(postId, btn) {
      if(!_currentUser){ showToast('Sign in to like posts',false); return; }
      if(btn && btn.classList.contains('liked')) return; // already liked this session
      _fs.setDoc(_fs.doc(_db,'posts',postId,'likes',_currentUser.uid),{userId:_currentUser.uid,createdAt:_fs.serverTimestamp()},{merge:true})
        .then(function(){
          if(btn){ btn.classList.add('liked'); btn.innerHTML='<i class="fas fa-thumbs-up"></i> Liked'; }
          _fs.updateDoc(_fs.doc(_db,'posts',postId),{likeCount:_fs.increment(1)}).catch(function(){});
        }).catch(function(){ showToast('Could not like',false); });
    },

    openPhoto:  function(url){ var lb=document.getElementById('biz-lightbox'),img=document.getElementById('biz-lightbox-img'); if(lb&&img){ img.src=url; lb.classList.add('open'); } },
    closePhoto: function()   { var lb=document.getElementById('biz-lightbox'); if(lb) lb.classList.remove('open'); },

    setReviewStar: function(n) {
      _reviewRating=n;
      document.querySelectorAll('.biz-star-btn').forEach(function(b,i){ b.textContent=i<n?'★':'☆'; b.classList.toggle('active',i<n); });
    },

    submitReview: function() {
      if(!_currentUser){ showToast('Sign in to review',false); return; }
      if(!_reviewRating){ showToast('Please select a star rating',false); return; }
      var text=(document.getElementById('biz-review-text')||{}).value||'';
      if(!text.trim()){ showToast('Please write a review',false); return; }
      var btn=document.getElementById('biz-review-submit-btn');
      if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Posting…'; }
      var name=_currentUser.displayName||(_currentUser.email||'').split('@')[0]||'User';
      _fs.addDoc(_fs.collection(_db,'businessReviews'),{
        businessId:BIZ_ID,userId:_currentUser.uid,authorName:name,
        rating:_reviewRating,text:text.trim(),createdAt:_fs.serverTimestamp(),
      }).then(function(){
        var ot=_biz.ratingTotal||0,oc=_biz.ratingCount||0,nc=oc+1,nt=ot+_reviewRating;
        notifyBusinessPage('business_review', name + ' reviewed your page', text.trim().slice(0,120), 'business.html?id=' + BIZ_ID + '#reviews', { reviewerId: _currentUser.uid, rating: _reviewRating });
        return _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID),{
          ratingTotal:nt,ratingCount:nc,ratingAverage:Math.round(nt/nc*10)/10,
          reviewCount:_fs.increment(1),updatedAt:_fs.serverTimestamp(),
        });
      }).then(function(){ showToast('Review posted!'); load(); })
        .catch(function(err){ console.error('[BizPage] Review failed',err); showToast('Could not post review',false); if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Submit Review'; } });
    },

    ownerAddPhoto: function(){ var inp=document.getElementById('biz-owner-photo-input'); if(inp) inp.click(); },

    editCover: function() {
      var input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = function() {
        var file = input.files && input.files[0]; if (!file) return;
        var btn = document.querySelector('.biz-cover-edit-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>'; }
        showToast('Uploading cover…');
        function onDone(url) {
          if (!url) { showToast('Upload failed', false); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-camera"></i> Edit Cover'; } return; }
          _fs.updateDoc(_fs.doc(_db, 'businesses', BIZ_ID), { coverUrl: url }).then(function() {
            var cover = document.querySelector('.biz-cover');
            if (cover) { cover.style.backgroundImage = 'url('+url+')'; cover.style.backgroundSize = 'cover'; cover.style.backgroundPosition = 'center'; }
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-camera"></i> Edit Cover'; }
            showToast('Cover photo updated!');
          }).catch(function() { showToast('Could not save', false); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-camera"></i> Edit Cover'; } });
        }
        if (window.GeoSocial && window.GeoSocial.uploadFile) {
          window.GeoSocial.uploadFile(file, 'business-covers', function(pct) { if (pct < 100) showToast('Uploading… '+pct+'%'); }).then(onDone).catch(function() { onDone(null); });
        } else {
          directCloudinaryUpload(file, onDone, function(pct) { if (pct < 100) showToast('Uploading… '+pct+'%'); });
        }
      };
      input.click();
    },

    editLogo: function() {
      var input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = function() {
        var file = input.files && input.files[0]; if (!file) return;
        var logoEl = document.querySelector('.biz-logo'); if (logoEl) logoEl.style.opacity = '0.5';
        showToast('Uploading logo…');
        function onDone(url) {
          if (!url) { showToast('Upload failed', false); if (logoEl) logoEl.style.opacity = ''; return; }
          _fs.updateDoc(_fs.doc(_db, 'businesses', BIZ_ID), { logoUrl: url }).then(function() {
            if (logoEl) { logoEl.style.opacity = ''; logoEl.innerHTML = '<img src="'+url+'" alt="logo"><div class="biz-logo-edit-overlay"><i class="fas fa-camera"></i></div>'; }
            showToast('Logo updated!');
          }).catch(function() { showToast('Could not save', false); if (logoEl) logoEl.style.opacity = ''; });
        }
        if (window.GeoSocial && window.GeoSocial.uploadFile) {
          window.GeoSocial.uploadFile(file, 'business-logos', function(pct) { if (pct < 100) showToast('Uploading… '+pct+'%'); }).then(onDone).catch(function() { onDone(null); });
        } else {
          directCloudinaryUpload(file, onDone, function(pct) { if (pct < 100) showToast('Uploading… '+pct+'%'); });
        }
      };
      input.click();
    },

    handleOwnerPhoto: function(input) {
      if(!input.files||!input.files[0]) return;
      var file=input.files[0];
      var up=(window.GeoSocial&&window.GeoSocial.uploadFile)
        ? function(f,cb,op){ return window.GeoSocial.uploadFile(f,'business-gallery',op).then(cb); }
        : directCloudinaryUpload;
      showToast('Uploading…');
      up(file,function(url){
        if(!url){ showToast('Upload failed',false); return; }
        _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'gallery'),{
          url:url,caption:'',order:Date.now(),
          uploadedBy:_currentUser&&_currentUser.uid,createdAt:_fs.serverTimestamp(),
        }).then(function(){ showToast('Photo added!'); load(); }).catch(function(){ showToast('Could not save',false); });
      },function(pct){ if(pct<100) showToast('Uploading… '+pct+'%'); });
      input.value='';
    },

    togglePreview: function() {
      _previewMode = !_previewMode;
      var wrap = document.querySelector('.biz-page-wrap');
      var toolbar = document.getElementById('biz-admin-toolbar');
      var fab = document.getElementById('biz-preview-fab');
      if (_previewMode) {
        if (wrap) wrap.classList.add('biz-preview-active');
        if (toolbar) toolbar.style.display = 'none';
        if (fab) fab.style.display = '';
      } else {
        if (wrap) wrap.classList.remove('biz-preview-active');
        if (toolbar) toolbar.style.display = '';
        if (fab) fab.style.display = 'none';
      }
    },

    openBlockManager: function() {
      var m = document.getElementById('biz-block-manager');
      if (m) { m.classList.add('open'); window._bizActions.refreshBlockManagerList(); }
    },
    closeBlockManager: function() {
      var m = document.getElementById('biz-block-manager'); if (m) m.classList.remove('open');
    },

    selectBlockType: function(btn, type) {
      document.querySelectorAll('.biz-block-type-chip').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var inp = document.getElementById('biz-block-type-val'); if (inp) inp.value = type;
    },

    saveNewBlock: function() {
      if (!_currentUser || !_isOwner) return;
      var type    = ((document.getElementById('biz-block-type-val')||{}).value || 'text').trim();
      var title   = ((document.getElementById('biz-block-title-inp')||{}).value || '').trim();
      var content = ((document.getElementById('biz-block-content-inp')||{}).value || '').trim();
      if (!content && !title) { showToast('Add a title or content', false); return; }
      var btn = document.getElementById('biz-add-block-btn');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding…'; }
      _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'pageBlocks'), {
        type: type, title: title, content: content,
        enabled: true, order: Date.now(),
        createdBy: _currentUser.uid, createdAt: _fs.serverTimestamp(),
      }).then(function() {
        showToast('Block added!');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Add Block'; }
        var ti = document.getElementById('biz-block-title-inp');
        var ci = document.getElementById('biz-block-content-inp');
        if (ti) ti.value = '';
        if (ci) ci.value = '';
        window._bizActions.refreshBlockManagerList();
        loadPageBlocks();
      }).catch(function(err) {
        console.error('[BizPage] addBlock failed', err);
        showToast('Could not add block', false);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Add Block'; }
      });
    },

    deleteBlock: function(blockId) {
      if (!_currentUser || !_isOwner) return;
      if (!confirm('Delete this block?')) return;
      _fs.deleteDoc(_fs.doc(_db,'businesses',BIZ_ID,'pageBlocks',blockId))
        .then(function() {
          showToast('Block deleted');
          loadPageBlocks();
          window._bizActions.refreshBlockManagerList();
        }).catch(function() { showToast('Could not delete', false); });
    },

    editBlock: function(blockId) {
      window._bizActions.openBlockManager();
      setTimeout(function() {
        var item = document.querySelector('[data-bid="'+blockId+'"]');
        if (item) {
          item.scrollIntoView({behavior:'smooth', block:'center'});
          var editBtn = item.querySelector('.biz-mgr-edit-btn');
          if (editBtn) editBtn.click();
        }
      }, 250);
    },

    moveBlock: function(blockId, dir) {
      if (!_currentUser || !_isOwner) return;
      safeSnap(
        _fs.getDocs(_fs.query(
          _fs.collection(_db,'businesses',BIZ_ID,'pageBlocks'),
          _fs.orderBy('order','asc')
        ))
      ).then(function(blocks) {
        var idx = -1;
        for (var i = 0; i < blocks.length; i++) { if (blocks[i].id === blockId) { idx = i; break; } }
        if (idx < 0) return;
        var swapIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= blocks.length) return;
        var a = blocks[idx], b2 = blocks[swapIdx];
        var aOrder = typeof a.order === 'number' ? a.order : idx * 1000;
        var bOrder = typeof b2.order === 'number' ? b2.order : swapIdx * 1000;
        return Promise.all([
          _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID,'pageBlocks',a.id), {order: bOrder}),
          _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID,'pageBlocks',b2.id), {order: aOrder}),
        ]);
      }).then(function() { loadPageBlocks(); }).catch(function() { showToast('Could not reorder', false); });
    },

    refreshBlockManagerList: function() {
      var list = document.getElementById('biz-block-manager-list');
      if (!list) return;
      list.innerHTML = '<div style="color:#64748b;font-size:.82rem;padding:8px 0"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
      safeSnap(
        _fs.getDocs(_fs.query(
          _fs.collection(_db,'businesses',BIZ_ID,'pageBlocks'),
          _fs.orderBy('order','asc')
        ))
      ).then(function(blocks) {
        if (!blocks.length) {
          list.innerHTML = '<div style="color:#64748b;font-size:.82rem;padding:8px 0">No blocks yet. Add one above!</div>';
          return;
        }
        list.innerHTML = blocks.map(function(b) {
          var typeIcon = b.type==='announcement' ? 'fa-bullhorn' : b.type==='cta' ? 'fa-hand-pointer' : 'fa-align-left';
          return '<div class="biz-mgr-block-item" data-bid="'+esc(b.id)+'">'+
            '<div class="biz-mgr-block-type-icon"><i class="fas '+typeIcon+'"></i></div>'+
            '<div class="biz-mgr-block-info">'+
              '<div class="biz-mgr-block-name">'+esc(b.title||'(no title)')+'</div>'+
              '<div class="biz-mgr-block-meta">'+esc(b.type||'text')+(b.enabled===false?' · hidden':'')+'</div>'+
            '</div>'+
            '<div class="biz-mgr-block-actions">'+
              '<button class="biz-mgr-edit-btn" onclick="window._bizActions.openEditBlockInline(\''+esc(b.id)+'\',this)"><i class="fas fa-pencil"></i></button>'+
              '<button class="biz-mgr-del-btn" onclick="window._bizActions.deleteBlock(\''+esc(b.id)+'\')"><i class="fas fa-trash"></i></button>'+
            '</div>'+
          '</div>';
        }).join('');
      });
    },

    openEditBlockInline: function(blockId, editBtnEl) {
      var item = editBtnEl.closest('[data-bid]');
      if (!item) return;
      var existing = item.querySelector('.biz-mgr-inline-edit');
      if (existing) { existing.remove(); return; }
      _fs.getDoc(_fs.doc(_db,'businesses',BIZ_ID,'pageBlocks',blockId)).then(function(d) {
        if (!d.exists()) return;
        var b = d.data();
        var form = document.createElement('div');
        form.className = 'biz-mgr-inline-edit';
        form.innerHTML =
          '<input class="biz-form-input" id="biz-ei-t-'+esc(blockId)+'" value="'+esc(b.title||'')+'" placeholder="Title">'+
          '<textarea class="biz-form-textarea" id="biz-ei-c-'+esc(blockId)+'" style="min-height:70px;margin-top:6px">'+esc(b.content||'')+'</textarea>'+
          '<div style="display:flex;gap:8px;margin-top:8px">'+
            '<button class="biz-submit-btn" style="flex:1;padding:9px" onclick="window._bizActions.saveBlockEdit(\''+esc(blockId)+'\')"><i class="fas fa-check"></i> Save</button>'+
            '<button class="biz-action-btn" style="padding:9px 14px" onclick="this.closest(\'.biz-mgr-inline-edit\').remove()">Cancel</button>'+
          '</div>';
        item.appendChild(form);
      }).catch(function() {});
    },

    saveBlockEdit: function(blockId) {
      var ti = document.getElementById('biz-ei-t-'+blockId);
      var ci = document.getElementById('biz-ei-c-'+blockId);
      if (!ti || !ci) return;
      _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID,'pageBlocks',blockId), {
        title: ti.value.trim(), content: ci.value.trim(), updatedAt: _fs.serverTimestamp(),
      }).then(function() {
        showToast('Block updated!');
        loadPageBlocks();
        window._bizActions.refreshBlockManagerList();
      }).catch(function() { showToast('Could not save', false); });
    },

    // ── Notification toggle ───────────────────────────────────────
    toggleNotifications: function() {
      if (!_currentUser) return;
      _notificationsOn = !_notificationsOn;
      var followRef = _fs.doc(_db,'businessFollowers',BIZ_ID+'_'+_currentUser.uid);
      _fs.updateDoc(followRef, {notifications: _notificationsOn}).catch(function(){});
      var btn = document.getElementById('biz-notif-btn');
      if (btn) {
        btn.innerHTML = '<i class="'+(_notificationsOn?'fas':'far')+' fa-bell"></i>';
        btn.title = _notificationsOn ? 'Notifications on' : 'Notifications off';
      }
      showToast(_notificationsOn ? 'Notifications enabled' : 'Notifications disabled');
    },

    // ── Events ────────────────────────────────────────────────────
    openCreateEvent: function() {
      if (!isAdminOrOwner()) return;
      var html = '<div class="biz-modal-overlay" id="biz-create-event-modal" onclick="if(event.target===this)window._bizActions.closeCreateEvent()">'+
        '<div class="biz-modal-sheet">'+
          '<div class="biz-modal-handle"></div>'+
          '<button class="biz-modal-close" onclick="window._bizActions.closeCreateEvent()"><i class="fas fa-times"></i></button>'+
          '<div class="biz-modal-title">Create Event</div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Event Name *</label><input class="biz-form-input" id="ev-name" placeholder="Event name"></div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Description</label><textarea class="biz-form-textarea" id="ev-desc" placeholder="Describe the event…"></textarea></div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Date & Time *</label><input class="biz-form-input" id="ev-date" type="datetime-local"></div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Location</label><input class="biz-form-input" id="ev-loc" placeholder="Address or online link"></div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Cover Image URL</label><input class="biz-form-input" id="ev-cover" placeholder="https://…" type="url"></div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Max Attendees</label><input class="biz-form-input" id="ev-max" type="number" placeholder="Leave empty for unlimited"></div>'+
          '<button class="biz-submit-btn" id="ev-submit-btn" onclick="window._bizActions.saveEvent()"><i class="fas fa-calendar-plus"></i> Create Event</button>'+
        '</div>'+
      '</div>';
      var existing = document.getElementById('biz-create-event-modal');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', html);
      document.getElementById('biz-create-event-modal').classList.add('open');
    },

    closeCreateEvent: function() {
      var m = document.getElementById('biz-create-event-modal');
      if (m) m.remove();
    },

    saveEvent: function() {
      if (!isAdminOrOwner()) return;
      var name  = ((document.getElementById('ev-name')||{}).value||'').trim();
      var desc  = ((document.getElementById('ev-desc')||{}).value||'').trim();
      var date  = (document.getElementById('ev-date')||{}).value;
      var loc   = ((document.getElementById('ev-loc')||{}).value||'').trim();
      var cover = ((document.getElementById('ev-cover')||{}).value||'').trim();
      var maxA  = parseInt(((document.getElementById('ev-max')||{}).value||''),10)||0;
      if (!name || !date) { showToast('Event name and date are required', false); return; }
      var btn = document.getElementById('ev-submit-btn');
      if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; }
      _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'events'), {
        name: name, description: desc,
        date: new Date(date),
        location: loc, coverUrl: cover,
        maxAttendees: maxA||null, createdBy: _currentUser.uid,
        createdAt: _fs.serverTimestamp(), attendeeCount: 0
      }).then(function() {
        showToast('Event created!');
        window._bizActions.closeCreateEvent();
        loadEvents(BIZ_ID);
      }).catch(function(err) {
        showToast('Could not create event: '+(err.code||err.message), false);
        if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-calendar-plus"></i> Create Event'; }
      });
    },

    rsvpEvent: function(eventId, status) {
      if (!_currentUser) { showToast('Sign in to RSVP', false); return; }
      _fs.setDoc(
        _fs.doc(_db,'businesses',BIZ_ID,'events',eventId,'rsvps',_currentUser.uid),
        {userId:_currentUser.uid, status:status, updatedAt:_fs.serverTimestamp()},
        {merge:true}
      ).then(function() {
        showToast('RSVP saved: '+status.replace('_',' '));
        var wrap = document.getElementById('biz-ersvp-'+CSS.escape(eventId));
        if (wrap) wrap.querySelectorAll('.biz-rsvp-btn').forEach(function(b){
          b.classList.toggle('active', b.dataset.status === status);
        });
      }).catch(function(){ showToast('Could not save RSVP', false); });
    },

    // ── FAQ ───────────────────────────────────────────────────────
    openAddFaq: function() {
      if (!isAdminOrOwner()) return;
      var html = '<div class="biz-modal-overlay" id="biz-add-faq-modal" onclick="if(event.target===this)window._bizActions.closeAddFaq()">'+
        '<div class="biz-modal-sheet">'+
          '<div class="biz-modal-handle"></div>'+
          '<button class="biz-modal-close" onclick="window._bizActions.closeAddFaq()"><i class="fas fa-times"></i></button>'+
          '<div class="biz-modal-title">Add FAQ Item</div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Question *</label><input class="biz-form-input" id="faq-q-inp" placeholder="Frequently asked question…"></div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Answer *</label><textarea class="biz-form-textarea" id="faq-a-inp" placeholder="Your answer…"></textarea></div>'+
          '<button class="biz-submit-btn" id="faq-submit-btn" onclick="window._bizActions.saveFaqItem()"><i class="fas fa-plus"></i> Add FAQ</button>'+
        '</div>'+
      '</div>';
      var existing = document.getElementById('biz-add-faq-modal');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', html);
      document.getElementById('biz-add-faq-modal').classList.add('open');
    },

    closeAddFaq: function() {
      var m = document.getElementById('biz-add-faq-modal'); if (m) m.remove();
    },

    saveFaqItem: function() {
      if (!isAdminOrOwner()) return;
      var q = ((document.getElementById('faq-q-inp')||{}).value||'').trim();
      var a = ((document.getElementById('faq-a-inp')||{}).value||'').trim();
      if (!q || !a) { showToast('Question and answer are required', false); return; }
      var btn = document.getElementById('faq-submit-btn');
      if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; }
      _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'faq'), {
        question: q, answer: a, createdBy: _currentUser.uid, createdAt: _fs.serverTimestamp()
      }).then(function() {
        showToast('FAQ item added!');
        window._bizActions.closeAddFaq();
        loadFaq(BIZ_ID);
      }).catch(function(err) {
        showToast('Could not add FAQ: '+(err.code||err.message), false);
        if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-plus"></i> Add FAQ'; }
      });
    },

    deleteFaqItem: function(faqId) {
      if (!isAdminOrOwner() || !confirm('Delete this FAQ item?')) return;
      _fs.deleteDoc(_fs.doc(_db,'businesses',BIZ_ID,'faq',faqId)).then(function() {
        showToast('FAQ item deleted');
        loadFaq(BIZ_ID);
      }).catch(function(){ showToast('Could not delete', false); });
    },

    openAnswerFaq: function(faqId) {
      var item = document.getElementById('biz-faq-'+faqId);
      if (!item || item.querySelector('textarea')) return;
      var ta = document.createElement('textarea');
      ta.className = 'biz-cmt-edit-ta';
      ta.placeholder = 'Write your answer…';
      ta.rows = 3;
      ta.style.cssText = 'width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#f1f5f9;padding:8px 12px;resize:none;font-size:.87rem;font-family:inherit;outline:none;margin-top:8px;box-sizing:border-box';
      var saveBtn = document.createElement('button');
      saveBtn.className = 'biz-submit-btn';
      saveBtn.style.cssText = 'margin-top:6px;font-size:.8rem;padding:6px 14px';
      saveBtn.textContent = 'Save Answer';
      item.appendChild(ta);
      item.appendChild(saveBtn);
      ta.focus();
      saveBtn.onclick = function() {
        var ans = ta.value.trim();
        if (!ans) return;
        saveBtn.disabled = true; saveBtn.textContent = '…';
        _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID,'faq',faqId), {
          answer: ans, updatedAt: _fs.serverTimestamp()
        }).then(function() {
          showToast('Answer saved');
          loadFaq(BIZ_ID);
        }).catch(function(){ showToast('Could not save', false); });
      };
    },

    submitQuestion: function() {
      if (!_currentUser) { showToast('Sign in to ask a question', false); return; }
      var inp = document.getElementById('biz-faq-question-inp');
      var q = inp ? inp.value.trim() : '';
      if (!q) { showToast('Please enter a question', false); return; }
      _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'faqQuestions'), {
        question: q,
        authorId: _currentUser.uid,
        authorName: _currentUser.displayName || (_currentUser.email||'').split('@')[0] || 'User',
        createdAt: _fs.serverTimestamp(), answered: false
      }).then(function() {
        showToast('Question submitted!');
        if (inp) inp.value = '';
      }).catch(function(){ showToast('Could not submit question', false); });
    },

    promoteQuestion: function(questionId, questionText) {
      if (!isAdminOrOwner()) return;
      var ans = window.prompt('Answer for: "'+questionText+'"');
      if (!ans || !ans.trim()) return;
      _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'faq'), {
        question: questionText, answer: ans.trim(),
        createdBy: _currentUser.uid, createdAt: _fs.serverTimestamp()
      }).then(function() {
        return _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID,'faqQuestions',questionId), {answered:true});
      }).then(function() {
        showToast('Added to FAQ!');
        loadFaq(BIZ_ID);
      }).catch(function(){ showToast('Could not add to FAQ', false); });
    },

    // ── Milestones ────────────────────────────────────────────────
    openAddMilestone: function() {
      if (!isAdminOrOwner()) return;
      var html = '<div class="biz-modal-overlay" id="biz-add-milestone-modal" onclick="if(event.target===this)window._bizActions.closeAddMilestone()">'+
        '<div class="biz-modal-sheet">'+
          '<div class="biz-modal-handle"></div>'+
          '<button class="biz-modal-close" onclick="window._bizActions.closeAddMilestone()"><i class="fas fa-times"></i></button>'+
          '<div class="biz-modal-title">Add Milestone</div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Title *</label><input class="biz-form-input" id="ms-title" placeholder="e.g. Opened first location"></div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Date *</label><input class="biz-form-input" id="ms-date" type="date"></div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Description</label><textarea class="biz-form-textarea" id="ms-desc" placeholder="More details…"></textarea></div>'+
          '<button class="biz-submit-btn" id="ms-submit-btn" onclick="window._bizActions.saveMilestone()"><i class="fas fa-flag"></i> Add Milestone</button>'+
        '</div>'+
      '</div>';
      var existing = document.getElementById('biz-add-milestone-modal');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', html);
      document.getElementById('biz-add-milestone-modal').classList.add('open');
    },

    closeAddMilestone: function() {
      var m = document.getElementById('biz-add-milestone-modal'); if (m) m.remove();
    },

    saveMilestone: function() {
      if (!isAdminOrOwner()) return;
      var title = ((document.getElementById('ms-title')||{}).value||'').trim();
      var date  = (document.getElementById('ms-date')||{}).value;
      var desc  = ((document.getElementById('ms-desc')||{}).value||'').trim();
      if (!title || !date) { showToast('Title and date are required', false); return; }
      var btn = document.getElementById('ms-submit-btn');
      if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; }
      _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'milestones'), {
        title: title, description: desc,
        date: new Date(date),
        createdBy: _currentUser.uid, createdAt: _fs.serverTimestamp()
      }).then(function() {
        showToast('Milestone added!');
        window._bizActions.closeAddMilestone();
        loadMilestones(BIZ_ID);
      }).catch(function(err) {
        showToast('Could not add milestone: '+(err.code||err.message), false);
        if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-flag"></i> Add Milestone'; }
      });
    },

    deleteMilestone: function(milestoneId) {
      if (!isAdminOrOwner() || !confirm('Delete this milestone?')) return;
      _fs.deleteDoc(_fs.doc(_db,'businesses',BIZ_ID,'milestones',milestoneId)).then(function() {
        showToast('Milestone deleted');
        loadMilestones(BIZ_ID);
      }).catch(function(){ showToast('Could not delete', false); });
    },

    // ── Page Admin Roles ──────────────────────────────────────────
    addPageAdmin: function(userId, role) {
      if (!_isOwner) return;
      if (!userId || !role) { showToast('User ID and role are required', false); return; }
      _fs.setDoc(_fs.doc(_db,'businesses',BIZ_ID,'admins',userId), {
        role: role, addedBy: _currentUser.uid, addedAt: _fs.serverTimestamp()
      }).then(function() {
        showToast('Admin added!');
        window._bizActions.refreshAdminList();
      }).catch(function(err){ showToast('Could not add admin: '+(err.code||err.message), false); });
    },

    removePageAdmin: function(userId) {
      if (!_isOwner || !confirm('Remove this admin?')) return;
      _fs.deleteDoc(_fs.doc(_db,'businesses',BIZ_ID,'admins',userId)).then(function() {
        showToast('Admin removed');
        window._bizActions.refreshAdminList();
      }).catch(function(){ showToast('Could not remove admin', false); });
    },

    refreshAdminList: function() {
      var el = document.getElementById('biz-admin-list');
      if (!el) return;
      safeSnap(_fs.getDocs(_fs.collection(_db,'businesses',BIZ_ID,'admins'))).then(function(admins) {
        if (!admins.length) { el.innerHTML = '<div style="color:#64748b;font-size:.82rem">No additional admins.</div>'; return; }
        el.innerHTML = admins.map(function(a) {
          return '<div class="biz-admin-role-item">'+
            '<span class="biz-admin-role-badge">'+esc(a.role||'admin')+'</span>'+
            '<span class="biz-admin-role-uid">'+esc(a.id||a.userId||'')+'</span>'+
            '<button class="biz-cmt-act-btn" style="color:#f87171" onclick="window._bizActions.removePageAdmin(\''+esc(a.id||'')+'\')">Remove</button>'+
          '</div>';
        }).join('');
      });
    },

    // ── Service CRUD ──────────────────────────────────────────────
    openAddService: function() {
      if (!isAdminOrOwner()) return;
      var existing = document.getElementById('biz-add-service-modal');
      if (existing) existing.remove();
      var html = '<div class="biz-modal-overlay" id="biz-add-service-modal" onclick="if(event.target===this)this.remove()">'+
        '<div class="biz-modal-sheet">'+
          '<div class="biz-modal-handle"></div>'+
          '<button class="biz-modal-close" onclick="document.getElementById(\'biz-add-service-modal\').remove()"><i class="fas fa-times"></i></button>'+
          '<div class="biz-modal-title" id="svc-modal-title"><i class="fas fa-briefcase"></i> Add Service</div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Service Name *</label><input class="biz-form-input" id="svc-title" placeholder="e.g. Website Design"></div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Description</label><textarea class="biz-form-textarea" id="svc-desc" placeholder="What\'s included…"></textarea></div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
            '<div class="biz-form-group"><label class="biz-form-label">Price</label><input class="biz-form-input" id="svc-price" placeholder="e.g. ₾250"></div>'+
            '<div class="biz-form-group"><label class="biz-form-label">Duration</label><input class="biz-form-input" id="svc-duration" placeholder="e.g. 2 hours"></div>'+
          '</div>'+
          '<button class="biz-submit-btn" id="svc-save-btn" onclick="window._bizActions.saveService()"><i class="fas fa-check"></i> Save Service</button>'+
        '</div>'+
      '</div>';
      document.body.insertAdjacentHTML('beforeend', html);
      document.getElementById('biz-add-service-modal').classList.add('open');
    },

    saveService: function() {
      if (!isAdminOrOwner()) return;
      var title = ((document.getElementById('svc-title')||{}).value||'').trim();
      var desc  = ((document.getElementById('svc-desc')||{}).value||'').trim();
      var price = ((document.getElementById('svc-price')||{}).value||'').trim();
      var dur   = ((document.getElementById('svc-duration')||{}).value||'').trim();
      var btn   = document.getElementById('svc-save-btn');
      var editId = btn && btn.dataset.editId;
      if (!title) { showToast('Service name is required', false); return; }
      if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…'; }
      var data = { title:title, description:desc, price:price, duration:dur, updatedAt:_fs.serverTimestamp() };
      var op = editId
        ? _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID,'services',editId), data)
        : _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'services'), Object.assign({createdAt:_fs.serverTimestamp()}, data));
      op.then(function(){
        var m = document.getElementById('biz-add-service-modal'); if(m) m.remove();
        showToast(editId ? 'Service updated!' : 'Service added!');
        reloadServicesTab();
      }).catch(function(err){
        showToast('Could not save: '+(err.code||err.message), false);
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-check"></i> Save Service'; }
      });
    },

    editService: function(id) {
      if (!isAdminOrOwner() || !id) return;
      _fs.getDoc(_fs.doc(_db,'businesses',BIZ_ID,'services',id)).then(function(snap){
        if (!snap.exists()) { showToast('Service not found', false); return; }
        var s = snap.data();
        window._bizActions.openAddService();
        setTimeout(function(){
          var t=document.getElementById('svc-title'); if(t) t.value=s.title||s.name||'';
          var d=document.getElementById('svc-desc');  if(d) d.value=s.description||'';
          var p=document.getElementById('svc-price'); if(p) p.value=s.price||'';
          var u=document.getElementById('svc-duration'); if(u) u.value=s.duration||'';
          var btn=document.getElementById('svc-save-btn');
          if(btn){ btn.dataset.editId=id; btn.innerHTML='<i class="fas fa-check"></i> Update Service'; }
          var lbl=document.getElementById('svc-modal-title');
          if(lbl) lbl.innerHTML='<i class="fas fa-pencil"></i> Edit Service';
        }, 80);
      }).catch(function(){ showToast('Could not load service', false); });
    },

    deleteService: function(id) {
      if (!isAdminOrOwner() || !id) return;
      if (!confirm('Delete this service?')) return;
      _fs.deleteDoc(_fs.doc(_db,'businesses',BIZ_ID,'services',id)).then(function(){
        showToast('Service deleted');
        reloadServicesTab();
      }).catch(function(err){ showToast('Could not delete: '+(err.code||err.message), false); });
    },

    // ── Product CRUD ──────────────────────────────────────────────
    openAddProduct: function() {
      if (!isAdminOrOwner()) return;
      var existing = document.getElementById('biz-add-product-modal');
      if (existing) existing.remove();
      var html = '<div class="biz-modal-overlay" id="biz-add-product-modal" onclick="if(event.target===this)this.remove()">'+
        '<div class="biz-modal-sheet">'+
          '<div class="biz-modal-handle"></div>'+
          '<button class="biz-modal-close" onclick="document.getElementById(\'biz-add-product-modal\').remove()"><i class="fas fa-times"></i></button>'+
          '<div class="biz-modal-title"><i class="fas fa-box"></i> Add Product</div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Product Name *</label><input class="biz-form-input" id="prd-name" placeholder="e.g. Handmade Pottery"></div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Description</label><textarea class="biz-form-textarea" id="prd-desc" placeholder="Brief description…" style="min-height:70px"></textarea></div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Price</label><input class="biz-form-input" id="prd-price" placeholder="e.g. ₾45"></div>'+
          '<button class="biz-submit-btn" id="prd-save-btn" onclick="window._bizActions.saveProduct()"><i class="fas fa-check"></i> Save Product</button>'+
        '</div>'+
      '</div>';
      document.body.insertAdjacentHTML('beforeend', html);
      document.getElementById('biz-add-product-modal').classList.add('open');
    },

    saveProduct: function() {
      if (!isAdminOrOwner()) return;
      var name  = ((document.getElementById('prd-name')||{}).value||'').trim();
      var desc  = ((document.getElementById('prd-desc')||{}).value||'').trim();
      var price = ((document.getElementById('prd-price')||{}).value||'').trim();
      var btn   = document.getElementById('prd-save-btn');
      if (!name) { showToast('Product name is required', false); return; }
      if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…'; }
      _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'products'), {
        name:name, description:desc, price:price, createdAt:_fs.serverTimestamp(), updatedAt:_fs.serverTimestamp()
      }).then(function(){
        var m = document.getElementById('biz-add-product-modal'); if(m) m.remove();
        showToast('Product added!');
        reloadProductsTab();
      }).catch(function(err){
        showToast('Could not save: '+(err.code||err.message), false);
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-check"></i> Save Product'; }
      });
    },

    deleteProduct: function(id) {
      if (!isAdminOrOwner() || !id) return;
      if (!confirm('Delete this product?')) return;
      _fs.deleteDoc(_fs.doc(_db,'businesses',BIZ_ID,'products',id)).then(function(){
        showToast('Product deleted');
        reloadProductsTab();
      }).catch(function(err){ showToast('Could not delete: '+(err.code||err.message), false); });
    },

    // ── Price List CRUD ───────────────────────────────────────────
    openAddPriceItem: function() {
      if (!isAdminOrOwner()) return;
      var existing = document.getElementById('biz-add-price-modal');
      if (existing) existing.remove();
      var html = '<div class="biz-modal-overlay" id="biz-add-price-modal" onclick="if(event.target===this)this.remove()">'+
        '<div class="biz-modal-sheet">'+
          '<div class="biz-modal-handle"></div>'+
          '<button class="biz-modal-close" onclick="document.getElementById(\'biz-add-price-modal\').remove()"><i class="fas fa-times"></i></button>'+
          '<div class="biz-modal-title"><i class="fas fa-tag"></i> Add Price Item</div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Item Name *</label><input class="biz-form-input" id="pri-label" placeholder="e.g. Haircut"></div>'+
          '<div class="biz-form-group"><label class="biz-form-label">Price *</label><input class="biz-form-input" id="pri-price" placeholder="e.g. ₾30 or From ₾20"></div>'+
          '<button class="biz-submit-btn" id="pri-save-btn" onclick="window._bizActions.savePriceItem()"><i class="fas fa-check"></i> Add to Price List</button>'+
        '</div>'+
      '</div>';
      document.body.insertAdjacentHTML('beforeend', html);
      document.getElementById('biz-add-price-modal').classList.add('open');
    },

    savePriceItem: function() {
      if (!isAdminOrOwner()) return;
      var label = ((document.getElementById('pri-label')||{}).value||'').trim();
      var price = ((document.getElementById('pri-price')||{}).value||'').trim();
      var btn   = document.getElementById('pri-save-btn');
      if (!label || !price) { showToast('Name and price are required', false); return; }
      if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…'; }
      _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'priceList'), {
        label:label, price:price, createdAt:_fs.serverTimestamp()
      }).then(function(){
        var m = document.getElementById('biz-add-price-modal'); if(m) m.remove();
        showToast('Price item added!');
        reloadServicesTab();
      }).catch(function(err){
        showToast('Could not save: '+(err.code||err.message), false);
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-check"></i> Add to Price List'; }
      });
    },

    deletePriceItem: function(id) {
      if (!isAdminOrOwner() || !id) return;
      if (!confirm('Remove this price item?')) return;
      _fs.deleteDoc(_fs.doc(_db,'businesses',BIZ_ID,'priceList',id)).then(function(){
        showToast('Price item removed');
        reloadServicesTab();
      }).catch(function(err){ showToast('Could not delete: '+(err.code||err.message), false); });
    },

    // ── Gallery owner actions ─────────────────────────────────────
    openOwnerPhotoInGallery: function() {
      if (!isAdminOrOwner()) return;
      var inp = document.getElementById('biz-gallery-file-input');
      if (inp) inp.click();
    },

    handleGalleryPhoto: function(input) {
      if (!isAdminOrOwner() || !input.files || !input.files.length) return;
      var file = input.files[0];
      input.value = '';
      showToast('Uploading photo…');
      directCloudinaryUpload(file, function(url) {
        if (!url) { showToast('Upload failed', false); return; }
        _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'gallery'), {
          url:url, caption:'', order:Date.now(),
          uploadedBy:_currentUser ? _currentUser.uid : '',
          createdAt:_fs.serverTimestamp()
        }).then(function(){
          showToast('Photo added!');
          reloadGalleryTab();
        }).catch(function(err){ showToast('Could not save: '+(err.code||err.message), false); });
      });
    },

    deleteGalleryPhoto: function(id) {
      if (!isAdminOrOwner() || !id) return;
      if (!confirm('Delete this photo?')) return;
      _fs.deleteDoc(_fs.doc(_db,'businesses',BIZ_ID,'gallery',id)).then(function(){
        showToast('Photo deleted');
        reloadGalleryTab();
      }).catch(function(err){ showToast('Could not delete: '+(err.code||err.message), false); });
    },

    // ── Review owner reply ────────────────────────────────────────
    replyToReview: function(reviewId) {
      if (!_isOwner || !reviewId) return;
      var wrap = document.getElementById('biz-reply-wrap-'+reviewId);
      if (!wrap) return;
      wrap.innerHTML =
        '<div class="biz-review-reply-form">'+
          '<textarea class="biz-form-textarea" id="biz-reply-ta-'+reviewId+'" rows="2" placeholder="Write a reply…" style="min-height:60px;margin-bottom:8px"></textarea>'+
          '<div style="display:flex;gap:8px">'+
            '<button class="biz-submit-btn" style="flex:1;padding:8px 14px;font-size:.82rem" '+
              'onclick="window._bizActions.saveReviewReply(\''+reviewId+'\',document.getElementById(\'biz-reply-ta-'+reviewId+'\'))">'+
              '<i class="fas fa-paper-plane"></i> Post Reply</button>'+
            '<button class="biz-cmt-act-btn" style="white-space:nowrap" '+
              'onclick="window._bizActions.cancelReviewReply(\''+reviewId+'\')">Cancel</button>'+
          '</div>'+
        '</div>';
      var ta = document.getElementById('biz-reply-ta-'+reviewId);
      if (ta) setTimeout(function(){ ta.focus(); }, 60);
    },

    cancelReviewReply: function(reviewId) {
      var wrap = document.getElementById('biz-reply-wrap-'+reviewId);
      if (!wrap) return;
      wrap.innerHTML = '<button class="biz-cmt-act-btn biz-reply-toggle-btn" onclick="window._bizActions.replyToReview(\''+reviewId+'\')"><i class="fas fa-reply"></i> Reply</button>';
    },

    saveReviewReply: function(reviewId, ta) {
      if (!_isOwner || !reviewId) return;
      var text = ta ? ta.value.trim() : '';
      if (!text) { showToast('Reply cannot be empty', false); return; }
      if (ta) ta.disabled = true;
      _fs.updateDoc(_fs.doc(_db,'businessReviews',reviewId), {
        ownerReply: text, updatedAt: _fs.serverTimestamp()
      }).then(function(){
        showToast('Reply posted!');
        reloadReviewsTab();
      }).catch(function(err){
        showToast('Could not post reply: '+(err.code||err.message), false);
        if (ta) ta.disabled = false;
      });
    },

    goToQuotes: function(){ window._bizActions.switchTab('dashboard'); setTimeout(function(){ window._bizActions.loadOwnerQuotes(); },100); },

    loadOwnerQuotes: function() {
      if (!isAdminOrOwner()) return;
      var panel = document.getElementById('biz-owner-quotes-panel');
      if (!panel) return;
      if (panel.style.display !== 'none' && panel.style.display !== '') {
        panel.style.display = 'none';
        return;
      }
      panel.style.display = 'block';
      _qAll = []; _qFilter = 'all'; _qSearch = '';
      panel.innerHTML =
        '<div class="biz-qi-wrap">' +
          '<div class="biz-qi-head">' +
            '<span class="biz-qi-title"><i class="fas fa-inbox"></i> Quote Requests <span class="biz-qi-count" id="biz-qi-count">…</span></span>' +
            '<button class="biz-qi-close-btn" onclick="var p=document.getElementById(\'biz-owner-quotes-panel\');if(p)p.style.display=\'none\'"><i class="fas fa-times"></i></button>' +
          '</div>' +
          '<div class="biz-qi-search-row"><input class="biz-qi-search" id="biz-qi-search-inp" placeholder="Search name, email, message…" oninput="window._bizActions.qSearch(this.value)"></div>' +
          '<div id="biz-qi-filter-zone"></div>' +
          '<div class="biz-qi-loading" id="biz-qi-list"><i class="fas fa-spinner fa-spin"></i> Loading…</div>' +
        '</div>';
      _fs.getDocs(_fs.query(
        _fs.collection(_db, 'businesses', BIZ_ID, 'quoteRequests'),
        _fs.orderBy('createdAt', 'desc'),
        _fs.limit(50)
      )).then(function(snap) {
        snap.forEach(function(d) {
          var q = Object.assign({ _id: d.id }, d.data());
          _qAll.push(q);
          if ((q.status || 'new') === 'new') {
            _fs.updateDoc(_fs.doc(_db, 'businesses', BIZ_ID, 'quoteRequests', d.id), {
              status: 'read', updatedAt: _fs.serverTimestamp()
            }).catch(function(){});
          }
        });
        _qRender();
      }).catch(function() {
        var listEl = document.getElementById('biz-qi-list');
        if (listEl) listEl.innerHTML = '<div class="biz-qi-error"><i class="fas fa-exclamation-triangle"></i> Could not load quote requests.</div>';
      });
    },

    updateQuoteStatus: function(reqId, newStatus) {
      if (!isAdminOrOwner()) return;
      _fs.updateDoc(_fs.doc(_db, 'businesses', BIZ_ID, 'quoteRequests', reqId), {
        status: newStatus, updatedAt: _fs.serverTimestamp()
      }).then(function() {
        var q = _qAll.find(function(q){ return q._id === reqId; });
        if (q) q.status = newStatus;
        _qRender();
        showToast('Status: ' + newStatus);
      }).catch(function(){ showToast('Could not update status', false); });
    },

    // ── Service / Product detail modals ──────────────────────────
    openSvcDetail: function(svcId) {
      var s = _svcMap[svcId]; if (!s) return;
      var m = document.getElementById('biz-svc-detail'); if (!m) return;
      var iconEl  = document.getElementById('biz-svc-d-icon');
      var priceEl = document.getElementById('biz-svc-d-price');
      var nameEl  = document.getElementById('biz-svc-d-name');
      var bizEl   = document.getElementById('biz-svc-d-biz');
      var metaEl  = document.getElementById('biz-svc-d-meta');
      var descEl  = document.getElementById('biz-svc-d-desc');
      var ctaEl   = document.getElementById('biz-svc-d-cta');
      if (iconEl)  iconEl.innerHTML = '<i class="fas '+(s.icon||'fa-briefcase')+'"></i>';
      if (priceEl) { priceEl.textContent = s.price ? fmtPrice(s.price) : ''; priceEl.style.display = s.price ? '' : 'none'; }
      if (nameEl)  nameEl.textContent = s.title || s.name || '';
      if (bizEl)   bizEl.textContent  = (_biz && _biz.title) || '';
      if (metaEl)  { metaEl.innerHTML = s.duration ? '<i class="fas fa-clock"></i> '+esc(s.duration) : ''; metaEl.style.display = s.duration ? '' : 'none'; }
      if (descEl)  { descEl.textContent = s.description || ''; descEl.style.display = s.description ? '' : 'none'; }
      if (ctaEl)   ctaEl.onclick = function() { window._bizActions.closeSvcDetail(); window._bizActions.openQuote(s.title||s.name||'', s.id||'', 'service'); };
      m.classList.add('open');
    },

    closeSvcDetail: function() {
      var m = document.getElementById('biz-svc-detail'); if (m) m.classList.remove('open');
    },

    openProdDetail: function(prodId) {
      var p = _prodMap[prodId]; if (!p) return;
      var m = document.getElementById('biz-prod-detail'); if (!m) return;
      var imgWrap = document.getElementById('biz-prod-d-img-wrap');
      var imgEl   = document.getElementById('biz-prod-d-img');
      var nameEl  = document.getElementById('biz-prod-d-name');
      var bizEl   = document.getElementById('biz-prod-d-biz');
      var metaEl  = document.getElementById('biz-prod-d-meta');
      var descEl  = document.getElementById('biz-prod-d-desc');
      var ctaEl   = document.getElementById('biz-prod-d-cta');
      if (imgWrap && imgEl) {
        if (p.imageUrl) { imgEl.src = p.imageUrl; imgEl.alt = p.name||p.title||''; imgWrap.style.display = ''; }
        else { imgWrap.style.display = 'none'; }
      }
      if (nameEl) nameEl.textContent = p.name || p.title || '';
      if (bizEl)  bizEl.textContent  = (_biz && _biz.title) || '';
      if (metaEl) {
        var parts = [];
        if (p.price)       parts.push('<span class="biz-detail-price-chip">'+fmtPrice(p.price)+'</span>');
        if (p.stockStatus) parts.push('<span class="biz-detail-stock-chip">'+esc(p.stockStatus)+'</span>');
        metaEl.innerHTML = parts.join('');
        metaEl.style.display = parts.length ? '' : 'none';
      }
      if (descEl) { descEl.textContent = p.description || ''; descEl.style.display = p.description ? '' : 'none'; }
      if (ctaEl)  ctaEl.onclick = function() { window._bizActions.closeProdDetail(); window._bizActions.openQuote(p.name||p.title||'', p.id||'', 'product'); };
      m.classList.add('open');
    },

    closeProdDetail: function() {
      var m = document.getElementById('biz-prod-detail'); if (m) m.classList.remove('open');
    },

    qFilter: function(f) {
      _qFilter = f;
      _qRender();
    },

    qSearch: function(q) {
      _qSearch = q;
      _qRender();
    },

    qToggleNote: function(reqId) {
      var area = document.getElementById('biz-qi-note-area-'+reqId);
      if (!area) return;
      var isHidden = area.style.display === 'none';
      area.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        var ta = document.getElementById('biz-qi-note-ta-'+reqId);
        if (ta) setTimeout(function(){ ta.focus(); }, 60);
      }
    },

    qSaveNote: function(reqId) {
      if (!isAdminOrOwner()) return;
      var ta   = document.getElementById('biz-qi-note-ta-'+reqId);
      var note = ta ? ta.value.trim() : '';
      _fs.updateDoc(_fs.doc(_db, 'businesses', BIZ_ID, 'quoteRequests', reqId), {
        ownerNote: note, updatedAt: _fs.serverTimestamp()
      }).then(function() {
        var q = _qAll.find(function(q){ return q._id === reqId; });
        if (q) q.ownerNote = note;
        _qRender();
        showToast('Note saved');
      }).catch(function(){ showToast('Could not save note', false); });
    },

    qTogglePriority: function(reqId, current) {
      if (!isAdminOrOwner()) return;
      var newPrio = current === 'high' ? 'normal' : 'high';
      _fs.updateDoc(_fs.doc(_db, 'businesses', BIZ_ID, 'quoteRequests', reqId), {
        priority: newPrio, updatedAt: _fs.serverTimestamp()
      }).then(function() {
        var q = _qAll.find(function(q){ return q._id === reqId; });
        if (q) q.priority = newPrio;
        _qRender();
      }).catch(function(){ showToast('Could not update priority', false); });
    },
  };

  // ── CLOUDINARY FALLBACK ───────────────────────────────────────

  function directCloudinaryUpload(file, onSuccess, onProgress) {
    var cfg=window.GEOHUB_CLOUDINARY||{cloudName:'dw5dqk2w7',uploadPreset:'geohub_unsigned',rootFolder:'geohub'};
    var fd=new FormData(); fd.append('file',file); fd.append('upload_preset',cfg.uploadPreset); fd.append('folder',cfg.rootFolder+'/business-gallery');
    var xhr=new XMLHttpRequest();
    xhr.open('POST','https://api.cloudinary.com/v1_1/'+cfg.cloudName+'/image/upload');
    xhr.upload.addEventListener('progress',function(e){ if(e.lengthComputable&&onProgress) onProgress(Math.round(e.loaded/e.total*100)); });
    xhr.onload=function(){ try{ var r=JSON.parse(xhr.responseText); onSuccess(r.secure_url||null); }catch(e){ onSuccess(null); } };
    xhr.onerror=function(){ onSuccess(null); };
    xhr.send(fd);
  }

  // ── INIT ──────────────────────────────────────────────────────

  function init(fb) {
    _db=fb.db; _fs=fb.fs; _auth=fb.auth;
    _currentUser=_auth&&_auth.currentUser;
    var root=document.getElementById('biz-detail-root');
    if(!root){ root=document.createElement('div'); root.id='biz-detail-root'; document.body.insertBefore(root,document.body.firstChild); }
    load();
    fb.authFns.onAuthStateChanged(_auth,function(user){ if(user&&user!==_currentUser){ _currentUser=user; load(); } });
  }

  // Close reaction pickers on outside click
  document.addEventListener('click', function(e) {
    if (!e.target.closest || !e.target.closest('.biz-rx-wrap')) {
      document.querySelectorAll('.biz-rx-picker.open').forEach(function(p){ p.classList.remove('open'); });
    }
  }, true);

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    window._bizActions.closeSvcDetail();
    window._bizActions.closeProdDetail();
  });

  // Re-render when actor changes (e.g. user switches identity via account switcher)
  window.addEventListener('GeoActorChanged', function(e) {
    var actor = e.detail || {};
    var newActingAsPage = !!(actor.type === 'business' && actor.businessId === BIZ_ID);
    var changed = newActingAsPage !== _isActingAsPage;
    _isActingAsPage = newActingAsPage; // always update — renderPage() re-reads on entry too
    if (changed && _biz) {
      location.reload(); // page already rendered; reload for consistent UI
    }
    // if _biz not loaded yet, renderPage() will call isActingAsBusiness() defensively on entry
  });

  if(window.GeoFirebase&&window.GeoFirebase.db) init(window.GeoFirebase);
  else window.addEventListener('GeoFirebaseReady',function(){ init(window.GeoFirebase); },{once:true});
})();
