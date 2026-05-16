/* ================================================================
   GeoHub — Business Page (Premium Social Business Page)
   business.html?id=BUSINESS_ID
   ================================================================ */
(function () {
  'use strict';

  var BIZ_ID = new URLSearchParams(window.location.search).get('id');
  if (!BIZ_ID) return;

  var _db, _fs, _auth;
  var _biz         = null;
  var _currentUser = null;
  var _isOwner     = false;
  var _isSaved     = false;
  var _isFollowing = false;
  var _reviewRating = 0;

  // ── HELPERS ───────────────────────────────────────────────────

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
  function starsHtml(rating, cls) {
    var full=Math.floor(rating||0), half=((rating||0)-full)>=0.5, empty=5-full-(half?1:0);
    var out='<span class="'+(cls||'biz-stars')+'">';
    for(var i=0;i<full;i++) out+='★';
    if(half) out+='½';
    for(var j=0;j<empty;j++) out+='☆';
    return out+'</span>';
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
    if (_isOwner)    badges+='<span class="biz-badge biz-badge-owner"><i class="fas fa-crown"></i> Your Business</span>';
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
    if (_isOwner) {
      actions =
        '<a href="add-business.html?edit='+esc(BIZ_ID)+'" class="biz-action-btn owner-edit"><i class="fas fa-pen"></i> Edit Page</a>'+
        '<button class="biz-action-btn" onclick="window._bizActions.openCompose()"><i class="fas fa-plus"></i> Create Post</button>'+
        '<button class="biz-action-btn" onclick="window._bizActions.ownerAddPhoto()"><i class="fas fa-camera"></i> Add Photo</button>'+
        '<button class="biz-action-btn" onclick="window._bizActions.goToQuotes()"><i class="fas fa-inbox"></i> Quotes</button>'+
        '<input type="file" id="biz-owner-photo-input" accept="image/*" style="display:none" onchange="window._bizActions.handleOwnerPhoto(this)">';
    } else {
      var followCls  = _isFollowing ? 'following' : 'primary';
      var followIcon = _isFollowing ? 'fa-check' : 'fa-plus';
      var followLbl  = _isFollowing ? 'Following' : 'Follow';
      actions =
        '<button class="biz-action-btn '+followCls+'" id="biz-follow-btn" onclick="window._bizActions.toggleFollow()"><i class="fas '+followIcon+'"></i> '+followLbl+'</button>'+
        '<button class="biz-action-btn primary" onclick="window._bizActions.openQuote()"><i class="fas fa-paper-plane"></i> Quote</button>'+
        '<button class="biz-action-btn '+ (_isSaved?'saved':'')+'" id="biz-save-btn" onclick="window._bizActions.toggleSave()"><i class="'+(_isSaved?'fas':'far')+' fa-bookmark"></i> '+(_isSaved?'Saved':'Save')+'</button>'+
        '<button class="biz-action-btn" onclick="window._bizActions.share()"><i class="fas fa-share-nodes"></i> Share</button>';
      if (biz.phone) actions+='<a href="tel:'+esc(biz.phone)+'" class="biz-action-btn"><i class="fas fa-phone"></i> Call</a>';
      if (biz.website) {
        var ws=biz.website.startsWith('http')?biz.website:'https://'+biz.website;
        actions+='<a href="'+esc(ws)+'" target="_blank" rel="noopener noreferrer" class="biz-action-btn"><i class="fas fa-globe"></i> Website</a>';
      }
    }

    return '<div class="biz-cover" style="'+coverStyle+'">' +
        (!biz.coverUrl?'<i class="fas fa-store biz-cover-placeholder-icon"></i>':'')+
      '</div>'+
      '<div class="biz-header-body">'+
        '<div class="biz-logo-row">'+
          '<div class="biz-logo">'+logoInner+'</div>'+
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
    if (biz.mapsLink) btns.push('<a href="'+esc(biz.mapsLink)+'" target="_blank" rel="noopener noreferrer" class="biz-contact-btn amber"><i class="fas fa-map-location-dot"></i><span>Map</span></a>');
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
      {id:'services', label:'Services'},
      {id:'products', label:'Products'},
      {id:'photos',   label:'Photos'},
      {id:'reviews',  label:'Reviews'},
      {id:'about',    label:'About'},
    ];
    if (_isOwner) tabs.push({id:'dashboard', label:'Dashboard'});
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

    // Services preview
    if (services && services.length) {
      html += '<div class="biz-preview-card">'+
        '<div class="biz-preview-header"><span><i class="fas fa-briefcase"></i> Services</span><button onclick="window._bizActions.switchTab(\'services\')">See all</button></div>'+
        services.slice(0,4).map(function(s){
          return '<div class="biz-preview-service">'+
            '<div class="biz-preview-svc-dot"></div>'+
            '<div style="flex:1;min-width:0"><div class="biz-preview-svc-name">'+esc(s.title||s.name||'')+'</div></div>'+
            (s.price?'<span class="biz-preview-svc-price">'+fmtPrice(s.price)+'</span>':'')+
          '</div>';
        }).join('')+
        '<button class="biz-preview-cta" onclick="window._bizActions.openQuote()">Request a Service</button>'+
      '</div>';
    }

    // Products preview
    if (products && products.length) {
      html += '<div class="biz-preview-card">'+
        '<div class="biz-preview-header"><span><i class="fas fa-box"></i> Products</span><button onclick="window._bizActions.switchTab(\'products\')">See all</button></div>'+
        '<div class="biz-preview-products">'+
          products.slice(0,4).map(function(p){
            var thumb = p.imageUrl
              ? '<img src="'+esc(p.imageUrl)+'" alt="" loading="lazy">'
              : '<div class="biz-preview-product-ph"><i class="fas fa-box"></i></div>';
            return '<div class="biz-preview-product" onclick="window._bizActions.switchTab(\'products\')">'+thumb+'<div class="biz-preview-product-name">'+esc(p.name||p.title||'')+'</div></div>';
          }).join('')+
        '</div>'+
      '</div>';
    }

    // Reviews widget
    if ((biz.ratingCount||0) > 0) {
      html += '<div class="biz-preview-card">'+
        '<div class="biz-preview-header"><span><i class="fas fa-star"></i> Reviews</span><button onclick="window._bizActions.switchTab(\'reviews\')">See all</button></div>'+
        '<div class="biz-preview-rating-widget">'+
          '<div class="biz-preview-big-num">'+(biz.ratingAverage||0).toFixed(1)+'</div>'+
          '<div>'+starsHtml(biz.ratingAverage,'biz-preview-stars')+'<div style="color:#64748b;font-size:.74rem;margin-top:3px">'+biz.ratingCount+' reviews</div></div>'+
        '</div>'+
        '<button class="biz-preview-cta" onclick="window._bizActions.switchTab(\'reviews\')">Write a Review</button>'+
      '</div>';
    }

    // Gallery preview
    if (gallery && gallery.length) {
      html += '<div class="biz-preview-card">'+
        '<div class="biz-preview-header"><span><i class="fas fa-images"></i> Photos</span><button onclick="window._bizActions.switchTab(\'photos\')">See all</button></div>'+
        '<div class="biz-preview-gallery">'+
          gallery.slice(0,6).map(function(p){
            return '<div class="biz-preview-photo" onclick="window._bizActions.openPhoto(\''+esc(p.url)+'\')"><img src="'+esc(p.url)+'" loading="lazy" alt=""></div>';
          }).join('')+
        '</div>'+
      '</div>';
    }

    return html || '';
  }

  // ── RENDER: 3-COLUMN OVERVIEW ────────────────────────────────

  function renderOverview3Col(biz, services, products, gallery, reviews) {
    return '<div class="biz-overview-3col">'+
      '<div class="biz-left-sidebar">'+renderLeftSidebar(biz)+'</div>'+
      '<div class="biz-center-col">'+
        (_isOwner ? renderComposer(biz) : '')+
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

  // ── RENDER: POST CARD ────────────────────────────────────────

  function postCardHtml(post, biz) {
    var logo = biz.logoUrl
      ? '<img src="'+esc(biz.logoUrl)+'" alt="">'
      : esc((biz.title||'B')[0]);

    // Media: single or multi-image
    var mediaHtml = '';
    var urls = post.mediaUrls && post.mediaUrls.length ? post.mediaUrls : (post.mediaUrl ? [post.mediaUrl] : []);
    if (urls.length === 1) {
      mediaHtml = '<img class="biz-post-media" src="'+esc(urls[0])+'" loading="lazy" alt="" onclick="window._bizActions.openPhoto(\''+esc(urls[0])+'\')">';
    } else if (urls.length > 1) {
      var gridN = Math.min(urls.length, 4);
      mediaHtml = '<div class="biz-post-grid biz-post-grid-'+gridN+'">'+
        urls.slice(0,4).map(function(u,i){
          var extra = (i===3 && urls.length>4) ? '<div class="biz-post-grid-more">+'+( urls.length-4)+'</div>' : '';
          return '<div class="biz-post-grid-item" onclick="window._bizActions.openPhoto(\''+esc(u)+'\')">' +
            '<img src="'+esc(u)+'" loading="lazy" alt="">'+extra+'</div>';
        }).join('')+
      '</div>';
    }

    var likeCount    = post.likeCount    || 0;
    var commentCount = post.commentCount || 0;
    var countsHtml   = (likeCount > 0 || commentCount > 0)
      ? '<div class="biz-post-count-row">'+
          (likeCount    > 0 ? '<span>👍 '+likeCount+'</span>' : '')+
          (commentCount > 0 ? '<span style="margin-left:auto">'+commentCount+' comments</span>' : '')+
        '</div>'
      : '';

    return '<div class="biz-post-card">'+
      '<div class="biz-post-header">'+
        '<div class="biz-post-logo">'+logo+'</div>'+
        '<div class="biz-post-meta">'+
          '<div class="biz-post-name">'+esc(biz.title||'Business')+
            ((biz.verified||biz.status==='verified')?' <i class="fas fa-check-circle" style="color:#34d399;font-size:.72rem"></i>':'')+
          '</div>'+
          '<div class="biz-post-time">'+timeAgo(post.createdAt)+' · <i class="fas fa-earth-americas" style="font-size:.7rem;opacity:.6"></i></div>'+
        '</div>'+
      '</div>'+
      (post.text?'<div class="biz-post-text">'+esc(post.text)+'</div>':'')+
      mediaHtml+
      countsHtml+
      '<div class="biz-post-reactions">'+
        '<button class="biz-react-btn" data-post="'+esc(post.id)+'" onclick="window._bizActions.likePost(\''+esc(post.id)+'\',this)"><i class="far fa-thumbs-up"></i> Like</button>'+
        '<button class="biz-react-btn"><i class="far fa-comment"></i> Comment</button>'+
        '<button class="biz-react-btn" onclick="window._bizActions.share()"><i class="fas fa-share-nodes"></i> Share</button>'+
      '</div>'+
    '</div>';
  }

  // ── RENDER: SERVICE CARDS ────────────────────────────────────

  var SVC_ICONS = ['fa-star','fa-bolt','fa-palette','fa-code','fa-camera','fa-chart-bar','fa-music','fa-heart','fa-wrench','fa-car','fa-briefcase','fa-scissors','fa-laptop','fa-utensils','fa-dumbbell'];

  function renderServiceCards(services) {
    if (!services || !services.length) {
      return '<div class="biz-section"><div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-briefcase"></i> Services</div></div>'+
        '<div class="biz-empty-state"><i class="fas fa-list-check"></i><p>No services listed yet.</p></div></div>';
    }
    var cards = services.map(function(s, i) {
      var icon = s.icon ? s.icon : SVC_ICONS[i % SVC_ICONS.length];
      return '<div class="biz-service-card">'+
        '<div class="biz-service-card-top">'+
          '<div class="biz-service-card-icon"><i class="fas '+esc(icon)+'"></i></div>'+
          (s.price?'<div class="biz-service-card-price">'+fmtPrice(s.price)+'</div>':'')+
        '</div>'+
        '<div class="biz-service-card-name">'+esc(s.title||s.name||'')+'</div>'+
        (s.description?'<div class="biz-service-card-desc">'+esc(s.description)+'</div>':'')+
        (s.duration?'<div class="biz-service-card-meta"><i class="fas fa-clock"></i> '+esc(s.duration)+'</div>':'')+
        '<button class="biz-service-cta" onclick="window._bizActions.openQuote()">Request</button>'+
      '</div>';
    }).join('');
    return '<div class="biz-service-cards-grid">'+cards+'</div>';
  }

  // ── RENDER: PRODUCT CARDS ────────────────────────────────────

  function renderProductCards(products) {
    if (!products || !products.length) {
      return '<div class="biz-section"><div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-box"></i> Products</div></div>'+
        '<div class="biz-empty-state"><i class="fas fa-box-open"></i><p>No products listed yet.</p></div></div>';
    }
    var cards = products.map(function(p) {
      var thumbHtml = p.imageUrl
        ? '<img src="'+esc(p.imageUrl)+'" alt="'+esc(p.name||'')+'" loading="lazy">'
        : '<div class="biz-product-ph"><i class="fas fa-box"></i></div>';
      return '<div class="biz-product-card">'+
        '<div class="biz-product-thumb">'+thumbHtml+'</div>'+
        '<div class="biz-product-body">'+
          '<div class="biz-product-name">'+esc(p.name||p.title||'')+'</div>'+
          (p.description?'<div class="biz-product-desc">'+esc(p.description.slice(0,90))+'</div>':'')+
          '<div class="biz-product-footer">'+
            (p.price?'<span class="biz-product-price">'+fmtPrice(p.price)+'</span>':'')+
            '<button class="biz-product-cta" onclick="window._bizActions.openQuote()">Inquire</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    }).join('');
    return '<div class="biz-product-cards-grid">'+cards+'</div>';
  }

  // ── RENDER: PRICE LIST ───────────────────────────────────────

  function renderPriceList(items) {
    if (!items || !items.length) return '';
    var rows = items.map(function(item){
      return '<div class="biz-price-item">'+
        '<span class="biz-price-label">'+esc(item.label||item.name||item.title||'')+'</span>'+
        '<span class="biz-price-dots"></span>'+
        '<span class="biz-price-val">'+fmtPrice(item.price)+'</span>'+
      '</div>';
    }).join('');
    return '<div class="biz-section" style="margin-top:14px">'+
      '<div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-tag"></i> Price List</div><span class="biz-section-badge">'+items.length+' items</span></div>'+
      '<div class="biz-section-body">'+rows+'</div></div>';
  }

  // ── RENDER: GALLERY ──────────────────────────────────────────

  function renderGallery(photos) {
    if (!photos || !photos.length) {
      return '<div class="biz-section"><div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-images"></i> Photos</div></div>'+
        '<div class="biz-empty-state"><i class="fas fa-images"></i><p>No photos yet.</p></div></div>';
    }
    var sorted = photos.slice().sort(function(a,b){return (a.order||0)-(b.order||0);});
    var items  = sorted.map(function(p,i){
      return '<div class="biz-gallery-item" onclick="window._bizActions.openPhoto(\''+esc(p.url)+'\')">'+
        '<img src="'+esc(p.url)+'" alt="'+esc(p.caption||'')+'" loading="lazy">'+
        (p.caption?'<div class="biz-gallery-caption">'+esc(p.caption)+'</div>':'')+
      '</div>';
    }).join('');
    return '<div class="biz-section">'+
      '<div class="biz-section-header"><div class="biz-section-title"><i class="fas fa-images"></i> Photos</div>'+
      '<span class="biz-section-badge">'+sorted.length+'</span></div>'+
      '<div class="biz-gallery-masonry">'+items+'</div></div>';
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
          return '<div class="biz-review-card">'+
            '<div class="biz-review-header"><span class="biz-review-author">'+esc(r.authorName||'User')+'</span><span class="biz-review-date">'+timeAgo(r.createdAt)+'</span></div>'+
            '<div class="biz-review-stars">'+'★'.repeat(r.rating||0)+'☆'.repeat(5-(r.rating||0))+'</div>'+
            (r.text?'<div class="biz-review-text">'+esc(r.text)+'</div>':'')+
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
        '<a href="add-business.html?edit='+esc(BIZ_ID)+'" class="biz-owner-action-btn edit"><i class="fas fa-pen"></i> Edit Business Info</a>'+
        '<button class="biz-owner-action-btn photo" onclick="window._bizActions.ownerAddPhoto()"><i class="fas fa-camera"></i> Add Photo</button>'+
        '<button class="biz-owner-action-btn quotes" onclick="window._bizActions.loadOwnerQuotes()"><i class="fas fa-inbox"></i> View Quote Requests</button>'+
      '</div>'+
      '<div id="biz-owner-quotes-panel" style="display:none;padding:0 16px 14px"></div>'+
    '</div>';
  }

  // ── RENDER: MODALS ───────────────────────────────────────────

  function renderQuoteModal(biz) {
    return '<div class="biz-modal-overlay" id="biz-quote-modal" onclick="if(event.target===this)window._bizActions.closeQuote()">'+
      '<div class="biz-modal-sheet">'+
        '<div class="biz-modal-handle"></div>'+
        '<button class="biz-modal-close" onclick="window._bizActions.closeQuote()"><i class="fas fa-times"></i></button>'+
        '<div class="biz-modal-title">Request a Quote</div>'+
        '<div class="biz-modal-sub">Send a message to <strong>'+esc(biz.title||'this business')+'</strong></div>'+
        '<div class="biz-form-group"><label class="biz-form-label">Your Name *</label><input class="biz-form-input" id="q-name" placeholder="Full name" value="'+esc(_currentUser&&_currentUser.displayName||'')+'"></div>'+
        '<div class="biz-form-group"><label class="biz-form-label">Email *</label><input class="biz-form-input" id="q-email" type="email" placeholder="your@email.com" value="'+esc(_currentUser&&_currentUser.email||'')+'"></div>'+
        '<div class="biz-form-group"><label class="biz-form-label">Phone (optional)</label><input class="biz-form-input" id="q-phone" type="tel" placeholder="+995…"></div>'+
        '<div class="biz-form-group"><label class="biz-form-label">Message *</label><textarea class="biz-form-textarea" id="q-message" placeholder="Describe what you need…"></textarea></div>'+
        '<button class="biz-submit-btn" id="q-submit-btn" onclick="window._bizActions.submitQuote()"><i class="fas fa-paper-plane"></i> Send Request</button>'+
      '</div>'+
    '</div>';
  }

  function renderComposeModal(biz) {
    return '<div class="biz-modal-overlay" id="biz-compose-modal" onclick="if(event.target===this)window._bizActions.closeCompose()">'+
      '<div class="biz-modal-sheet">'+
        '<div class="biz-modal-handle"></div>'+
        '<button class="biz-modal-close" onclick="window._bizActions.closeCompose()"><i class="fas fa-times"></i></button>'+
        '<div class="biz-modal-title">Create Post</div>'+
        '<div class="biz-modal-sub">Posting as <strong>'+esc(biz.title||'your business')+'</strong></div>'+
        '<textarea class="biz-compose-textarea" id="biz-compose-text" placeholder="What\'s happening?"></textarea>'+
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

  function renderPage(biz, services, priceList, gallery, reviews, products) {
    document.title = esc(biz.title||'Business')+' — GeoHub';
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = biz.description ? biz.description.slice(0,155) : 'View '+(biz.title||'Business')+' on GeoHub';

    var root = document.getElementById('biz-detail-root');
    root.innerHTML =
      '<div class="biz-page-wrap">'+
        renderHeader(biz)+
        renderContact(biz)+
        renderTabBar()+
        '<div class="biz-tab-panels">'+

          '<div class="biz-tab-panel active" data-panel="overview">'+
            renderOverview3Col(biz, services, products, gallery, reviews)+
          '</div>'+

          '<div class="biz-tab-panel" data-panel="posts">'+
            (_isOwner?'<div style="margin-bottom:14px">'+renderComposer(biz)+'</div>':'')+
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

          '<div class="biz-tab-panel" data-panel="about">'+
            renderAboutTab(biz)+
          '</div>'+

          (_isOwner?'<div class="biz-tab-panel" data-panel="dashboard">'+renderOwnerDashboard(biz)+'</div>':'')+

        '</div>'+
      '</div>'+
      renderQuoteModal(biz)+
      (_isOwner?renderComposeModal(biz):'')+
      renderLightbox();

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

    loadBizPosts();
  }

  // ── LOAD POSTS ────────────────────────────────────────────────

  function loadBizPosts() {
    var overviewEl = document.getElementById('biz-posts-overview');
    var allEl      = document.getElementById('biz-posts-all');

    safeSnap(
      _fs.getDocs(_fs.query(
        _fs.collection(_db,'posts'),
        _fs.where('businessId','==',BIZ_ID),
        _fs.orderBy('createdAt','desc'),
        _fs.limit(20)
      ))
    ).then(function(posts) {
      var empty = '<div class="biz-empty-state"><i class="fas fa-seedling"></i>'+
        (_isOwner?'<p>No posts yet. Use the composer above to create your first post.</p>':'<p>No posts yet.</p>')+'</div>';
      if (!posts.length) {
        if (overviewEl) overviewEl.innerHTML = empty;
        if (allEl)      allEl.innerHTML      = empty;
        return;
      }
      var all = '<div class="biz-post-list">'+posts.map(function(p){ return postCardHtml(p,_biz); }).join('')+'</div>';
      var pre = '<div class="biz-post-list">'+posts.slice(0,3).map(function(p){ return postCardHtml(p,_biz); }).join('')+'</div>';
      if (overviewEl) overviewEl.innerHTML = pre;
      if (allEl)      allEl.innerHTML      = all;
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
      _isOwner = !!(_currentUser && _biz.ownerId === _currentUser.uid);

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
        ? _fs.getDoc(_fs.doc(_db,'businessFollowers',_currentUser.uid+'_'+BIZ_ID))
            .then(function(s){ return s.exists(); })
            .catch(function(){ return false; })
        : Promise.resolve(false);

      return Promise.all([loadServices, loadPriceList, loadGallery, loadReviews, loadSaved, loadFollow, loadProducts])
        .then(function(r) {
          _isSaved     = r[4];
          _isFollowing = r[5];
          renderPage(_biz, r[0], r[1], r[2], r[3], r[6]);

          if (!_isOwner) {
            _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID),{viewCount:_fs.increment(1)}).catch(function(){});
          }
        });

    }).catch(function(err) {
      console.error('[BizPage] Core load failed:',err.code,err.message,err);
      var r = document.getElementById('biz-detail-root');
      if (r) r.innerHTML = '<div class="biz-error-state"><i class="fas fa-exclamation-circle"></i><h3>Could not load</h3><p>Check your connection and try again.</p></div>';
    });
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
      var followId=_currentUser.uid+'_'+BIZ_ID;
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
        _fs.setDoc(followRef,{userId:_currentUser.uid,businessId:BIZ_ID,followedAt:_fs.serverTimestamp()}).then(function(){
          _isFollowing=true;
          _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID),{followerCount:_fs.increment(1)}).catch(function(){});
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

    openQuote: function() {
      if(!_currentUser){ showToast('Sign in to request a quote',false); window.location.href='auth.html'; return; }
      var m=document.getElementById('biz-quote-modal'); if(m) m.classList.add('open');
    },
    closeQuote: function() { var m=document.getElementById('biz-quote-modal'); if(m) m.classList.remove('open'); },

    submitQuote: function() {
      var name=(document.getElementById('q-name')||{}).value||'';
      var email=(document.getElementById('q-email')||{}).value||'';
      var phone=(document.getElementById('q-phone')||{}).value||'';
      var msg=(document.getElementById('q-message')||{}).value||'';
      var btn=document.getElementById('q-submit-btn');
      if(!name.trim()||!email.trim()||!msg.trim()){ showToast('Please fill in name, email, and message',false); return; }
      if(!_currentUser){ showToast('Please sign in',false); return; }
      if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Sending…'; }
      _fs.addDoc(_fs.collection(_db,'businesses',BIZ_ID,'quoteRequests'),{
        name:name.trim(),email:email.trim(),phone:phone.trim(),message:msg.trim(),
        submittedBy:_currentUser.uid,businessId:BIZ_ID,status:'new',createdAt:_fs.serverTimestamp(),
      }).then(function(){
        _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID),{quoteCount:_fs.increment(1)}).catch(function(){});
        window._bizActions.closeQuote();
        showToast('Quote request sent!');
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Send Request'; }
      }).catch(function(err){
        console.error('[BizPage] Quote submit failed',err);
        showToast('Could not send. Try again.',false);
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Send Request'; }
      });
    },

    openCompose:  function(){ var m=document.getElementById('biz-compose-modal'); if(m) m.classList.add('open'); },
    closeCompose: function(){
      var m=document.getElementById('biz-compose-modal');
      if(m){ m.classList.remove('open'); var ta=document.getElementById('biz-compose-text'); if(ta) ta.value=''; }
    },

    submitBizPost: function() {
      if(!_currentUser||!_isOwner) return;
      var text=(document.getElementById('biz-compose-text')||{}).value||'';
      if(!text.trim()){ showToast('Write something first',false); return; }
      var btn=document.getElementById('biz-compose-btn');
      if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Posting…'; }
      _fs.addDoc(_fs.collection(_db,'posts'),{
        text:text.trim(),businessId:BIZ_ID,authorId:_currentUser.uid,
        authorName:_biz.title||'Business',authorAvatar:_biz.logoUrl||'',
        type:'business',likeCount:0,commentCount:0,shareCount:0,createdAt:_fs.serverTimestamp(),
      }).then(function(){
        window._bizActions.closeCompose();
        showToast('Posted!');
        loadBizPosts();
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Post'; }
      }).catch(function(err){
        console.error('[BizPage] Post failed',err);
        showToast('Could not post. Try again.',false);
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
        return _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID),{
          ratingTotal:nt,ratingCount:nc,ratingAverage:Math.round(nt/nc*10)/10,
          reviewCount:_fs.increment(1),updatedAt:_fs.serverTimestamp(),
        });
      }).then(function(){ showToast('Review posted!'); load(); })
        .catch(function(err){ console.error('[BizPage] Review failed',err); showToast('Could not post review',false); if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Submit Review'; } });
    },

    ownerAddPhoto: function(){ var inp=document.getElementById('biz-owner-photo-input'); if(inp) inp.click(); },

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

    goToQuotes: function(){ window._bizActions.switchTab('dashboard'); setTimeout(function(){ window._bizActions.loadOwnerQuotes(); },100); },

    loadOwnerQuotes: function() {
      var panel=document.getElementById('biz-owner-quotes-panel');
      if(!panel) return;
      if(panel.style.display!=='none'){ panel.style.display='none'; return; }
      panel.style.display='block';
      panel.innerHTML='<div style="color:#94a3b8;font-size:.83rem;padding:8px 0"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
      _fs.getDocs(_fs.query(_fs.collection(_db,'businesses',BIZ_ID,'quoteRequests'),_fs.orderBy('createdAt','desc'),_fs.limit(20)))
        .then(function(snap){
          if(!snap.size){ panel.innerHTML='<p style="color:#64748b;font-size:.83rem;padding:8px 0 0">No quote requests yet.</p>'; return; }
          var html='<div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:8px">'+snap.size+' request'+(snap.size===1?'':'s')+'</div>';
          snap.forEach(function(d){
            var q=d.data(),isNew=q.status==='new';
            html+='<div class="biz-quote-item">'+
              '<div class="biz-quote-header"><span class="biz-quote-name">'+esc(q.name||'Anonymous')+(isNew?'<span class="biz-quote-new-badge">New</span>':'')+'</span>'+
              '<span class="biz-quote-date">'+timeAgo(q.createdAt)+'</span></div>'+
              '<div class="biz-quote-contact">'+(q.email?esc(q.email):'')+(q.phone?' · '+esc(q.phone):'')+'</div>'+
              '<div class="biz-quote-msg">'+esc(q.message||'')+'</div></div>';
            if(isNew) _fs.updateDoc(_fs.doc(_db,'businesses',BIZ_ID,'quoteRequests',d.id),{status:'read'}).catch(function(){});
          });
          panel.innerHTML=html;
        }).catch(function(){ panel.innerHTML='<p style="color:#ef4444;font-size:.83rem;padding:8px 0 0">Could not load quote requests.</p>'; });
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

  if(window.GeoFirebase&&window.GeoFirebase.db) init(window.GeoFirebase);
  else window.addEventListener('GeoFirebaseReady',function(){ init(window.GeoFirebase); },{once:true});
})();
