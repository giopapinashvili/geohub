(function(){
  'use strict';

  var app = document.getElementById('businessSuiteApp');
  var GF = null;
  var state = {
    user: null,
    businesses: [],
    selectedId: new URLSearchParams(location.search).get('businessId') || new URLSearchParams(location.search).get('id') || '',
    selected: null,
    tab: (location.hash || '#overview').replace('#','') || 'overview',
    data: {},
    unsubs: []
  };

  var tabs = [
    ['overview','fa-chart-line','Overview'],
    ['content','fa-newspaper','Content'],
    ['inbox','fa-inbox','Inbox'],
    ['quotes','fa-file-signature','Quotes'],
    ['reviews','fa-star','Reviews'],
    ['audience','fa-users','Audience'],
    ['analytics','fa-chart-simple','Analytics'],
    ['ads','fa-bullhorn','Ads Center'],
    ['services','fa-briefcase','Services / Products'],
    ['rewards','fa-gift','Rewards'],
    ['settings','fa-gear','Page Settings']
  ];

  var KA = {
    'Overview':'მიმოხილვა','Content':'კონტენტი','Inbox':'ინბოქსი','Quotes':'შეთავაზებები','Reviews':'შეფასებები',
    'Audience':'აუდიტორია','Analytics':'ანალიტიკა','Ads Center':'რეკლამის ცენტრი','Services / Products':'სერვისები / პროდუქტები',
    'Rewards':'ჯილდოები','Page Settings':'გვერდის პარამეტრები','GeoHub page management':'GeoHub გვერდის მართვა',
    'Business':'ბიზნესი','Business page':'ბიზნეს გვერდი','View public page':'საჯარო გვერდის ნახვა','Public page':'საჯარო გვერდი',
    'Loading':'იტვირთება','Loading your business pages...':'ბიზნეს გვერდები იტვირთება...',
    'Sign in to manage a business page.':'ბიზნეს გვერდის სამართავად შედით სისტემაში.',
    'You do not have access':'წვდომა არ გაქვთ','You do not have access to a Business Suite yet.':'Business Suite-ზე წვდომა ჯერ არ გაქვთ.',
    'Only business owners, admins, and page managers can use this page.':'ამ გვერდის გამოყენება შეუძლიათ მხოლოდ ბიზნესის მფლობელებს, ადმინებს და გვერდის მენეჯერებს.',
    'Business Suite could not load your managed pages.':'Business Suite-მა თქვენი მართვადი გვერდები ვერ ჩატვირთა.',
    'Only business owners, admins, and page managers can use this page.':'ამ გვერდის გამოყენება შეუძლიათ მხოლოდ ბიზნესის მფლობელებს, ადმინებს და გვერდის მენეჯერებს.',
    'Firebase is unavailable.':'Firebase მიუწვდომელია.','View public businesses':'საჯარო ბიზნესების ნახვა','Add business':'ბიზნესის დამატება',
    'Live page management summary from GeoHub data.':'GeoHub-ის რეალური მონაცემებით გვერდის მართვის მოკლე შეჯამება.',
    'Followers':'გამომწერები','Reviews':'შეფასებები','Unread page messages':'წაუკითხავი გვერდის მესიჯები',
    'New quote requests':'ახალი მოთხოვნები','Recent post engagement':'ბოლო პოსტების ჩართულობა','Recent activity':'ბოლო აქტივობა',
    'Recent posts':'ბოლო პოსტები','Post':'პოსტი','No posts yet':'პოსტები ჯერ არ არის','Posts for this business page will appear here.':'ამ ბიზნეს გვერდის პოსტები აქ გამოჩნდება.',
    'reactions':'რეაქცია','comments':'კომენტარი','shares':'გაზიარება','View':'ნახვა','Boost':'დაბუსტვა',
    'Quote request':'შეთავაზების მოთხოვნა','New request':'ახალი მოთხოვნა','Review':'შეფასება','Message':'მესიჯი','Conversation':'საუბარი',
    'No recent activity':'ბოლო აქტივობა არ არის','Activity appears after customers interact with this page.':'აქტივობა გამოჩნდება, როცა მომხმარებლები გვერდთან იურთიერთებენ.',
    'Manage page posts through the existing public page flow.':'პოსტების მართვა არსებული საჯარო გვერდის პროცესით.',
    'Create post':'პოსტის შექმნა','Business page posts':'ბიზნეს გვერდის პოსტები',
    'Open the existing page inbox and continue customer conversations.':'გახსენით არსებული გვერდის ინბოქსი და გააგრძელეთ მომხმარებლებთან საუბარი.',
    'Open inbox':'ინბოქსის გახსნა','Unread':'წაუკითხავი','Read':'წაკითხული','Recent conversations':'ბოლო საუბრები','Latest updates':'ბოლო განახლებები',
    'No page conversations':'გვერდის საუბრები ჯერ არ არის','Conversations appear here when users message this business.':'საუბრები აქ გამოჩნდება, როცა მომხმარებლები ბიზნესს მისწერენ.','No messages yet':'მესიჯები ჯერ არ არის',
    'Quote requests are loaded from this business page only.':'მოთხოვნები იტვირთება მხოლოდ ამ ბიზნეს გვერდიდან.','Open page quotes':'მოთხოვნების გახსნა',
    'New':'ახალი','Replied':'პასუხგაცემული','Closed':'დახურული','Recent quote requests':'ბოლო მოთხოვნები','No quote requests':'მოთხოვნები ჯერ არ არის',
    'Customer quote requests will appear here.':'მომხმარებლის მოთხოვნები აქ გამოჩნდება.','Customer':'მომხმარებელი',
    'Review totals and latest feedback from real reviews.':'შეფასებების ჯამი და ბოლო უკუკავშირი რეალური შეფასებებიდან.','Open Reviews tab':'შეფასებების გახსნა',
    'Average rating':'საშუალო რეიტინგი','Review count':'შეფასებების რაოდენობა','Owner replies needed':'საჭიროა მფლობელის პასუხი','Latest reviews':'ბოლო შეფასებები',
    'No reviews yet':'შეფასებები ჯერ არ არის','Customer reviews will appear here.':'მომხმარებლის შეფასებები აქ გამოჩნდება.','GeoHub User':'GeoHub მომხმარებელი','stars':'ვარსკვლავი',
    'Follower list is limited to recent followers to avoid mass reads.':'მასობრივი წაკითხვის თავიდან ასარიდებლად სია ბოლო გამომწერებით არის შეზღუდული.',
    'Latest followers':'ბოლო გამომწერები','No followers yet':'გამომწერები ჯერ არ არის','Followers appear here after users follow the page.':'გამომწერები აქ გამოჩნდება, როცა მომხმარებლები გვერდს გამოიწერენ.','Follower':'გამომწერი',
    'Simple summary from existing page analytics and engagement data.':'მარტივი შეჯამება არსებული ანალიტიკიდან და ჩართულობის მონაცემებიდან.',
    'Views':'ნახვები','Phone clicks':'ტელეფონზე დაჭერები','Post engagement':'პოსტების ჩართულობა',
    'Create campaign drafts. Ad delivery will be enabled after billing/review is added.':'შექმენით კამპანიის მონახაზები. რეკლამის გაშვება ჩაირთვება გადახდისა და განხილვის დამატების შემდეგ.',
    'Campaign drafts':'კამპანიის მონახაზები','Boost a post':'პოსტის დაბუსტვა','Objective':'მიზანი','More profile visits':'მეტი პროფილის ნახვა',
    'More messages':'მეტი მესიჯი','More quote requests':'მეტი მოთხოვნა','More followers':'მეტი გამომწერი','City':'ქალაქი','Category / interest':'კატეგორია / ინტერესი',
    'Interest':'ინტერესი','Budget in GEL':'ბიუჯეტი GEL-ში','Duration days':'დღეების რაოდენობა','Preview':'პრევიუ','Save as Draft':'მონახაზად შენახვა',
    'Submit for Review':'განსახილველად გაგზავნა','No payment, delivery, impressions, or clicks are enabled in this MVP.':'ამ MVP-ში გადახდა, მიწოდება, ჩვენებები და კლიკები ჩართული არ არის.',
    'No posts available':'პოსტები ხელმისაწვდომი არ არის','Create a page post before boosting.':'დაბუსტვამდე შექმენით გვერდის პოსტი.',
    'Ad delivery will be enabled after billing/review is added.':'რეკლამის მიწოდება ჩაირთვება გადახდისა და განხილვის დამატების შემდეგ.',
    'Choose a post first.':'ჯერ აირჩიეთ პოსტი.','Budget and duration are required.':'ბიუჯეტი და ხანგრძლივობა აუცილებელია.','Draft saved.':'მონახაზი შენახულია.',
    'Campaign submitted for review.':'კამპანია განსახილველად გაიგზავნა.','Campaign save failed: ':'კამპანიის შენახვა ვერ მოხერხდა: ',
    'No campaign drafts':'კამპანიის მონახაზები ჯერ არ არის','Saved campaign drafts will appear here.':'შენახული კამპანიის მონახაზები აქ გამოჩნდება.',
    'Campaign':'კამპანია','days':'დღე','No city':'ქალაქი არ არის','draft':'მონახაზი','pending_review':'განხილვაში','paused':'დაპაუზებული','rejected':'უარყოფილი','active_mock':'აქტიური',
    'Counts and shortcuts use the existing business page management.':'რაოდენობები და მალსახმობები იყენებს არსებულ ბიზნეს გვერდის მართვას.',
    'Add service':'სერვისის დამატება','Add product':'პროდუქტის დამატება','Services':'სერვისები','Products':'პროდუქტები','Total listings':'სულ ჩანაწერები',
    'No services yet':'სერვისები ჯერ არ არის','No products yet':'პროდუქტები ჯერ არ არის','Untitled':'უსათაურო',
    'Rewards and coupons connected to this business.':'ამ ბიზნესთან დაკავშირებული ჯილდოები და კუპონები.','Open rewards':'ჯილდოების გახსნა',
    'Active rewards':'აქტიური ჯილდოები','Coupons / offers':'კუპონები / შეთავაზებები','Total':'სულ','Current rewards':'მიმდინარე ჯილდოები','No rewards or coupons yet':'ჯილდოები ან კუპონები ჯერ არ არის',
    'Quick links to existing safe page management screens.':'სწრაფი ბმულები არსებული უსაფრთხო გვერდის მართვის ეკრანებზე.',
    'Edit business info':'ბიზნეს ინფორმაციის რედაქტირება','Name, description, category, contact info.':'სახელი, აღწერა, კატეგორია და საკონტაქტო ინფორმაცია.','Edit info':'ინფორმაციის რედაქტირება',
    'Edit logo / cover':'ლოგოს / ქავერის რედაქტირება','Branding is managed in the existing edit page.':'ბრენდინგი იმართება არსებულ რედაქტირების გვერდზე.','Edit branding':'ბრენდინგის რედაქტირება',
    'Manage admins':'ადმინების მართვა','Use the public page dashboard team tools where available.':'გამოიყენეთ საჯარო გვერდის გუნდის ინსტრუმენტები, სადაც ხელმისაწვდომია.','Open dashboard':'დაფის გახსნა',
    'See exactly what visitors see.':'ნახეთ ზუსტად ის, რასაც სტუმრები ხედავენ.','Switch to page mode':'გვერდის რეჟიმზე გადასვლა','Use existing page mode and posting tools.':'გამოიყენეთ არსებული გვერდის რეჟიმი და პოსტის ინსტრუმენტები.','Switch mode':'რეჟიმის შეცვლა'
  };

  function fs(){ return GF && GF.fs; }
  function db(){ return GF && GF.db; }
  function auth(){ return GF && GF.auth; }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function n(v){ var x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
  function ts(v){ if(!v) return 0; if(typeof v.toMillis === 'function') return v.toMillis(); if(v.seconds) return v.seconds * 1000; if(v instanceof Date) return v.getTime(); if(typeof v === 'number') return v; return Date.parse(v) || 0; }
  function date(v){ var t = ts(v); return t ? new Date(t).toLocaleDateString() : ''; }
  function title(b){ return (b && (b.title || b.name || b.businessName)) || tr('Business'); }
  function initials(v){ return String(v || 'B').trim().split(/\s+/).slice(0,2).map(function(x){return x[0] || '';}).join('').toUpperCase() || 'B'; }
  function lang(){ try{ return localStorage.getItem('gh_lang') === 'ka' ? 'ka' : 'en'; }catch(e){ return 'en'; } }
  function tr(v){ return lang() === 'ka' && KA[v] ? KA[v] : v; }
  function iconEmpty(icon, head, body){ return '<div class="bs-empty"><i class="fas '+icon+'"></i><h3>'+esc(tr(head))+'</h3><p>'+esc(tr(body||''))+'</p></div>'; }
  function button(href, label, icon, ghost){ return '<a class="gh-btn '+(ghost?'ghost ':'')+'sm" href="'+esc(href)+'"><i class="fas '+icon+'"></i> '+esc(tr(label))+'</a>'; }
  function toast(msg, type){
    var el = document.getElementById('bsToast');
    if(!el){ el = document.createElement('div'); el.id='bsToast'; el.className='gh-toast'; document.body.appendChild(el); }
    el.textContent = msg; el.className = 'gh-toast show' + (type ? ' '+type : '');
    setTimeout(function(){ el.className = 'gh-toast'; }, 2600);
  }

  function cleanup(){
    state.unsubs.forEach(function(u){ try{ u(); }catch(e){} });
    state.unsubs = [];
  }

  function ready(cb){
    if(window.GeoFirebase){ GF = window.GeoFirebase; cb(); return; }
    window.addEventListener('GeoFirebaseReady', function(){ GF = window.GeoFirebase; cb(); }, { once:true });
  }

  function isManager(b){
    var uid = state.user && state.user.uid;
    if(!uid || !b) return false;
    if(b.status === 'deleted' || b.deleted === true || b.deletedAt) return false;
    if(b.ownerId === uid || b.createdBy === uid || b.userId === uid || b.ownerUid === uid) return true;
    var ids = [].concat(b.adminIds || [], b.managerIds || [], b.staffIds || [], b.ownerIds || []);
    return ids.indexOf(uid) > -1 || b._adminDoc === true || b._pageAdminDoc === true;
  }

  function markPageAdminIfAllowed(businessId){
    var uid = state.user && state.user.uid;
    if(!businessId || !uid) return Promise.resolve();
    return fs().getDoc(fs().doc(db(),'businesses',businessId,'admins',uid)).then(function(adminSnap){
      if(adminSnap.exists() && state.businesses.length){
        state.businesses.forEach(function(b){
          if(b.id === businessId) b._pageAdminDoc = true;
        });
      }
    }).catch(function(){});
  }

  function loadBusinesses(){
    if(!state.user){ renderAccess('Sign in to manage a business page.'); return; }
    app.innerHTML = '<div class="bs-loading"><i class="fas fa-circle-notch fa-spin"></i><span>'+esc(tr('Loading your business pages...'))+'</span></div>';
    var uid = state.user.uid;
    var byId = {};
    function addDocSnap(d, adminDoc){
      if(!d || !d.exists()) return;
      var b = Object.assign({ id: d.id }, d.data() || {});
      if(adminDoc) b._adminDoc = true;
      byId[b.id] = Object.assign(byId[b.id] || {}, b);
    }
    var ownQueries = ['ownerId','createdBy','userId','ownerUid'].map(function(field){
      return fs().getDocs(fs().query(fs().collection(db(),'businesses'), fs().where(field,'==',uid), fs().limit(30))).catch(function(){ return null; });
    });
    var adminQuery = fs().getDocs(fs().query(fs().collection(db(),'businessAdmins'), fs().where('userId','==',uid), fs().limit(50))).catch(function(){ return null; });
    Promise.all(ownQueries.concat([adminQuery])).then(function(res){
      res.slice(0,4).forEach(function(snap){ if(snap) snap.forEach(function(d){ addDocSnap(d, false); }); });
      var adminSnap = res[4], ids = [];
      if(adminSnap) adminSnap.forEach(function(d){ var x = d.data() || {}; if(x.businessId) ids.push(x.businessId); });
      return Promise.all(ids.slice(0,40).map(function(id){
        return fs().getDoc(fs().doc(db(),'businesses',id)).then(function(d){ addDocSnap(d, true); }).catch(function(){});
      }));
    }).then(function(){
      if(!state.selectedId || byId[state.selectedId]) return;
      return fs().getDoc(fs().doc(db(),'businesses',state.selectedId)).then(function(d){
        if(d.exists()) addDocSnap(d, false);
      }).catch(function(){});
    }).then(function(){
      state.businesses = Object.keys(byId).map(function(id){ return byId[id]; });
      return markPageAdminIfAllowed(state.selectedId);
    }).then(function(){
      state.businesses = state.businesses.filter(isManager);
      state.businesses.sort(function(a,b){ return title(a).localeCompare(title(b)); });
      if(!state.businesses.length){ renderAccess('You do not have access to a Business Suite yet.'); return; }
      if(!state.selectedId || !state.businesses.some(function(b){ return b.id === state.selectedId; })) state.selectedId = state.businesses[0].id;
      state.selected = state.businesses.find(function(b){ return b.id === state.selectedId; });
      renderShell();
      loadTabData();
    }).catch(function(err){
      console.error('[BusinessSuite] load businesses', err);
      renderAccess('Business Suite could not load your managed pages.');
    });
  }

  function renderAccess(message){
    cleanup();
    app.innerHTML = '<div class="bs-access"><div class="bs-card bs-access-card">'+
      '<div class="bs-empty" style="border:none;min-height:230px"><i class="fas fa-lock"></i><h2>'+esc(tr('You do not have access'))+'</h2><p>'+esc(tr(message || 'Only business owners, admins, and page managers can use this page.'))+'</p>'+
      '<div class="bs-action-row" style="justify-content:center">'+button('business.html','View public businesses','fa-store',true)+button('add-business.html','Add business','fa-plus',false)+'</div></div>'+
    '</div></div>';
  }

  function navHtml(mobile){
    return tabs.map(function(t){
      return mobile ? '<option value="'+t[0]+'"'+(state.tab===t[0]?' selected':'')+'>'+esc(tr(t[2]))+'</option>'
        : '<button type="button" class="'+(state.tab===t[0]?'active':'')+'" data-tab="'+t[0]+'"><i class="fas '+t[1]+'"></i><span>'+esc(tr(t[2]))+'</span></button>';
    }).join('');
  }

  function renderShell(){
    var b = state.selected;
    app.innerHTML = '<div class="bs-shell">'+
      '<aside class="bs-sidebar"><div class="bs-brand"><div class="bs-brand-mark"><i class="fas fa-briefcase"></i></div><div><strong>Business Suite</strong><span>'+esc(tr('GeoHub page management'))+'</span></div></div><nav class="bs-nav">'+navHtml(false)+'</nav></aside>'+
      '<main class="bs-main">'+
        '<header class="bs-header">'+
          '<div class="bs-selected"><div class="bs-page-logo">'+(b.logoUrl?'<img src="'+esc(b.logoUrl)+'" alt="">':esc(initials(title(b))))+'</div><div><div class="bs-selected-title">'+esc(title(b))+'</div><div class="bs-selected-meta">'+esc(b.category || tr('Business page'))+'</div></div></div>'+
          '<div class="bs-header-actions">'+businessSwitcher()+button('business.html?id='+encodeURIComponent(b.id),'View public page','fa-up-right-from-square',true)+'</div>'+
        '</header>'+
        '<div class="bs-mobile-tabs"><select class="gh-select" id="bsMobileTabs">'+navHtml(true)+'</select></div>'+
        '<section class="bs-content" id="bsContent">'+iconEmpty('fa-circle-notch fa-spin','Loading','')+'</section>'+
      '</main>'+
    '</div>';
    bindShell();
  }

  function businessSwitcher(){
    if(state.businesses.length < 2) return '';
    return '<select class="gh-select bs-switcher" id="bsBusinessSwitcher">'+state.businesses.map(function(b){
      return '<option value="'+esc(b.id)+'"'+(b.id===state.selectedId?' selected':'')+'>'+esc(title(b))+'</option>';
    }).join('')+'</select>';
  }

  function bindShell(){
    document.querySelectorAll('[data-tab]').forEach(function(btn){
      btn.onclick = function(){ setTab(btn.dataset.tab); };
    });
    var mobile = document.getElementById('bsMobileTabs');
    if(mobile) mobile.onchange = function(){ setTab(mobile.value); };
    var sw = document.getElementById('bsBusinessSwitcher');
    if(sw) sw.onchange = function(){
      state.selectedId = sw.value;
      state.selected = state.businesses.find(function(b){ return b.id === state.selectedId; });
      history.replaceState(null,'','business-suite.html?businessId='+encodeURIComponent(state.selectedId)+'#'+state.tab);
      renderShell();
      loadTabData();
    };
  }

  function setTab(tab){
    state.tab = tab || 'overview';
    history.replaceState(null,'','business-suite.html?businessId='+encodeURIComponent(state.selectedId)+'#'+state.tab);
    renderShell();
    loadTabData();
  }

  function loadTabData(){
    cleanup();
    var b = state.selected;
    if(!b || !isManager(b)){ renderAccess('Only business owners, admins, and page managers can use this page.'); return; }
    renderCurrent();
    loadCommon(b).then(function(){
      if(state.tab === 'ads') return loadAds(b);
      renderCurrent();
    });
  }

  function getQuery(col, field, value, lim){
    return fs().getDocs(fs().query(fs().collection(db(), col), fs().where(field,'==',value), fs().limit(lim || 50))).catch(function(){ return null; });
  }

  function subQuery(path, lim){
    return fs().getDocs(fs().query(fs().collection.apply(null,[db()].concat(path)), fs().limit(lim || 50))).catch(function(){ return null; });
  }

  function rows(snap){
    var out = [];
    if(snap) snap.forEach(function(d){ out.push(Object.assign({ id:d.id }, d.data() || {})); });
    out.sort(function(a,b){ return ts(b.createdAt || b.updatedAt) - ts(a.createdAt || a.updatedAt); });
    return out;
  }

  function loadCommon(b){
    return Promise.all([
      getQuery('businessFollowers','businessId',b.id,80),
      getQuery('businessReviews','businessId',b.id,80),
      subQuery(['businesses',b.id,'reviews'],80),
      subQuery(['businesses',b.id,'quoteRequests'],60),
      getQuery('posts','targetId',b.id,80),
      getQuery('conversations','businessId',b.id,25),
      subQuery(['businesses',b.id,'services'],80),
      subQuery(['businesses',b.id,'products'],80),
      getQuery('rewards','businessId',b.id,40),
      getQuery('businessOffers','businessId',b.id,40),
      subQuery(['businesses',b.id,'analytics'],30)
    ]).then(function(res){
      var reviewRows = rows(res[1]).concat(rows(res[2]));
      var seenReviews = {};
      reviewRows = reviewRows.filter(function(r){ var id = r.id || [r.userId,r.createdAt].join('_'); if(seenReviews[id]) return false; seenReviews[id]=true; return true; });
      var postRows = rows(res[4]).filter(function(p){ return (p.targetType === 'business' || p.businessId === b.id || p.targetId === b.id) && (!p.status || p.status === 'active'); });
      state.data = {
        followers: rows(res[0]),
        reviews: reviewRows,
        quotes: rows(res[3]),
        posts: postRows,
        conversations: rows(res[5]),
        services: rows(res[6]),
        products: rows(res[7]),
        rewards: rows(res[8]),
        offers: rows(res[9]),
        analytics: rows(res[10])
      };
      renderCurrent();
    });
  }

  function loadAds(b){
    return getQuery('businessAdCampaigns','businessId',b.id,50).then(function(snap){
      state.data.ads = rows(snap);
      renderCurrent();
    });
  }

  function renderCurrent(){
    var map = {
      overview: renderOverview,
      content: renderContent,
      inbox: renderInbox,
      quotes: renderQuotes,
      reviews: renderReviews,
      audience: renderAudience,
      analytics: renderAnalytics,
      ads: renderAds,
      services: renderServices,
      rewards: renderRewards,
      settings: renderSettings
    };
    (map[state.tab] || renderOverview)();
  }

  function stat(icon, label, value, sub){
    return '<div class="bs-card bs-stat"><i class="fas '+icon+'"></i><div><strong>'+esc(value)+'</strong><span>'+esc(tr(label))+'</span>'+(sub?'<div class="bs-small">'+esc(tr(sub))+'</div>':'')+'</div></div>';
  }

  function rating(){
    var reviews = state.data.reviews || [];
    var rated = reviews.filter(function(r){ return n(r.rating) > 0; });
    if(!rated.length) return { avg:'-', count:reviews.length };
    var avg = rated.reduce(function(sum,r){ return sum + n(r.rating); },0) / rated.length;
    return { avg: avg.toFixed(1), count: reviews.length };
  }

  function unreadConvs(){
    var uid = state.user && state.user.uid;
    return (state.data.conversations || []).filter(function(c){ return Array.isArray(c.unreadFor) && c.unreadFor.indexOf(uid) > -1; });
  }

  function newQuotes(){
    return (state.data.quotes || []).filter(function(q){ return !q.status || q.status === 'new' || q.status === 'unread'; });
  }

  function postEngagement(posts){
    return (posts || []).reduce(function(sum,p){ return sum + n(p.reactionCount || p.likeCount) + n(p.commentCount) + n(p.shareCount); },0);
  }

  function renderOverview(){
    var r = rating(), posts = state.data.posts || [], recent = posts.slice(0,5);
    document.getElementById('bsContent').innerHTML = '<div class="bs-section">'+
      '<div class="bs-section-head"><div><h1>'+esc(tr('Overview'))+'</h1><p>'+esc(tr('Live page management summary from GeoHub data.'))+'</p></div><div class="bs-action-row">'+button('business.html?id='+encodeURIComponent(state.selectedId),'Public page','fa-up-right-from-square',true)+'</div></div>'+
      '<div class="bs-stats-grid">'+
        stat('fa-users','Followers',(state.data.followers || []).length)+
        stat('fa-star','Reviews',r.avg, r.count+' '+tr('Total'))+
        stat('fa-comment-dots','Unread page messages',unreadConvs().length)+
        stat('fa-file-signature','New quote requests',newQuotes().length)+
        stat('fa-heart','Recent post engagement',postEngagement(recent))+
        stat('fa-clock','Recent activity',recent.length + newQuotes().length + unreadConvs().length)+
      '</div>'+
      '<div class="bs-two-grid"><div class="bs-card"><h3>'+esc(tr('Recent posts'))+'</h3><div class="bs-list">'+postList(recent, true)+'</div></div><div class="bs-card"><h3>'+esc(tr('Recent activity'))+'</h3><div class="bs-list">'+activityList()+'</div></div></div>'+
    '</div>';
  }

  function postList(posts, compact){
    if(!posts || !posts.length) return iconEmpty('fa-newspaper','No posts yet','Posts for this business page will appear here.');
    return posts.map(function(p){
      var text = p.text || p.content || p.caption || p.body || tr('Post');
      var counts = n(p.reactionCount || p.likeCount)+' '+tr('reactions')+' · '+n(p.commentCount)+' '+tr('comments')+' · '+n(p.shareCount)+' '+tr('shares');
      return '<div class="bs-list-item '+(compact?'compact':'')+'"><div><strong>'+esc(text).slice(0,130)+'</strong><p>'+esc(counts)+' · '+esc(date(p.createdAt || p.updatedAt))+'</p></div><div class="bs-card-actions">'+button('business.html?id='+encodeURIComponent(state.selectedId)+'#post-'+encodeURIComponent(p.id),'View','fa-eye',true)+button('business-suite.html?businessId='+encodeURIComponent(state.selectedId)+'#ads','Boost','fa-bullhorn',false)+'</div></div>';
    }).join('');
  }

  function activityList(){
    var items = [];
    (state.data.quotes || []).slice(0,3).forEach(function(q){ items.push(['fa-file-signature','Quote request', q.message || q.userName || q.status || 'New request', q.createdAt]); });
    (state.data.reviews || []).slice(0,3).forEach(function(r){ items.push(['fa-star','Review', (r.rating ? r.rating+' stars' : 'Review') + (r.text ? ': '+r.text : ''), r.createdAt]); });
    (state.data.conversations || []).slice(0,3).forEach(function(c){ items.push(['fa-comment-dots','Message', c.lastMessage || 'Conversation', c.updatedAt || c.createdAt]); });
    items.sort(function(a,b){ return ts(b[3])-ts(a[3]); });
    if(!items.length) return iconEmpty('fa-clock','No recent activity','Activity appears after customers interact with this page.');
    return items.slice(0,6).map(function(x){ return '<div class="bs-list-item compact"><div><strong><i class="fas '+x[0]+'"></i> '+esc(tr(x[1]))+'</strong><p>'+esc(String(x[2]).slice(0,140))+'</p></div><span class="bs-small">'+esc(date(x[3]))+'</span></div>'; }).join('');
  }

  function renderContent(){
    document.getElementById('bsContent').innerHTML = '<div class="bs-section"><div class="bs-section-head"><div><h1>'+esc(tr('Content'))+'</h1><p>'+esc(tr('Manage page posts through the existing public page flow.'))+'</p></div><div class="bs-action-row">'+button('business.html?id='+encodeURIComponent(state.selectedId)+'#posts','Create post','fa-plus',false)+button('business.html?id='+encodeURIComponent(state.selectedId),'Business page posts','fa-newspaper',true)+'</div></div><div class="bs-card"><div class="bs-list">'+postList(state.data.posts || [], false)+'</div></div></div>';
  }

  function renderInbox(){
    document.getElementById('bsContent').innerHTML = '<div class="bs-section"><div class="bs-section-head"><div><h1>'+esc(tr('Inbox'))+'</h1><p>'+esc(tr('Open the existing page inbox and continue customer conversations.'))+'</p></div>'+button('messages.html?business='+encodeURIComponent(state.selectedId),'Open inbox','fa-inbox',false)+'</div><div class="bs-stats-grid">'+stat('fa-envelope-open','Unread',unreadConvs().length)+stat('fa-comments','Recent conversations',(state.data.conversations||[]).length)+stat('fa-clock','Latest updates',(state.data.conversations||[]).slice(0,5).length)+'</div><div class="bs-card"><h3>'+esc(tr('Recent conversations'))+'</h3><div class="bs-list">'+conversationList()+'</div></div></div>';
  }

  function conversationList(){
    var convs = state.data.conversations || [];
    if(!convs.length) return iconEmpty('fa-inbox','No page conversations','Conversations appear here when users message this business.');
    return convs.slice(0,8).map(function(c){ return '<div class="bs-list-item compact"><div><strong>'+esc(c.title || c.userName || tr('Conversation'))+'</strong><p>'+esc(c.lastMessage || tr('No messages yet'))+'</p></div><span class="bs-badge '+(Array.isArray(c.unreadFor)&&c.unreadFor.indexOf(state.user.uid)>-1?'pending':'')+'">'+esc(tr(Array.isArray(c.unreadFor)&&c.unreadFor.indexOf(state.user.uid)>-1?'Unread':'Read'))+'</span></div>'; }).join('');
  }

  function renderQuotes(){
    var byStatus = {};
    (state.data.quotes || []).forEach(function(q){ var s = q.status || 'new'; byStatus[s] = (byStatus[s] || 0) + 1; });
    document.getElementById('bsContent').innerHTML = '<div class="bs-section"><div class="bs-section-head"><div><h1>'+esc(tr('Quotes'))+'</h1><p>'+esc(tr('Quote requests are loaded from this business page only.'))+'</p></div>'+button('business.html?id='+encodeURIComponent(state.selectedId)+'#quotes','Open page quotes','fa-up-right-from-square',true)+'</div><div class="bs-stats-grid">'+stat('fa-bell','New',byStatus.new || byStatus.unread || 0)+stat('fa-eye','Read',byStatus.read || 0)+stat('fa-reply','Replied',byStatus.replied || 0)+stat('fa-circle-check','Closed',byStatus.closed || 0)+'</div><div class="bs-card"><h3>'+esc(tr('Recent quote requests'))+'</h3><div class="bs-list">'+quoteList()+'</div></div></div>';
  }

  function quoteList(){
    var quotes = state.data.quotes || [];
    if(!quotes.length) return iconEmpty('fa-file-signature','No quote requests','Customer quote requests will appear here.');
    return quotes.slice(0,10).map(function(q){ return '<div class="bs-list-item compact"><div><strong>'+esc(q.userName || q.name || q.email || tr('Customer'))+'</strong><p>'+esc(q.message || q.serviceName || tr('Quote request'))+'</p></div><span class="bs-badge '+esc(q.status || 'new')+'">'+esc(tr(q.status || 'new'))+'</span></div>'; }).join('');
  }

  function renderReviews(){
    var r = rating();
    var repliesNeeded = (state.data.reviews || []).filter(function(x){ return !x.ownerReply && !x.reply && !x.response; }).length;
    document.getElementById('bsContent').innerHTML = '<div class="bs-section"><div class="bs-section-head"><div><h1>'+esc(tr('Reviews'))+'</h1><p>'+esc(tr('Review totals and latest feedback from real reviews.'))+'</p></div>'+button('business.html?id='+encodeURIComponent(state.selectedId)+'#reviews','Open Reviews tab','fa-star',true)+'</div><div class="bs-stats-grid">'+stat('fa-star','Average rating',r.avg)+stat('fa-comments','Review count',r.count)+stat('fa-reply','Owner replies needed',repliesNeeded)+'</div><div class="bs-card"><h3>'+esc(tr('Latest reviews'))+'</h3><div class="bs-list">'+reviewList()+'</div></div></div>';
  }

  function reviewList(){
    var reviews = state.data.reviews || [];
    if(!reviews.length) return iconEmpty('fa-star','No reviews yet','Customer reviews will appear here.');
    return reviews.slice(0,10).map(function(r){ return '<div class="bs-list-item"><div class="bs-avatar">'+esc(initials(r.userName || r.name || 'U'))+'</div><div><strong>'+esc(r.userName || r.name || 'GeoHub User')+' · '+esc(n(r.rating).toFixed(1))+' stars</strong><p>'+esc(r.text || r.comment || '')+'</p></div><span class="bs-small">'+esc(date(r.createdAt))+'</span></div>'; }).join('');
  }

  function renderAudience(){
    var followers = state.data.followers || [];
    document.getElementById('bsContent').innerHTML = '<div class="bs-section"><div class="bs-section-head"><div><h1>'+esc(tr('Audience'))+'</h1><p>'+esc(tr('Follower list is limited to recent followers to avoid mass reads.'))+'</p></div>'+button('business.html?id='+encodeURIComponent(state.selectedId)+'#audience','View public page','fa-users',true)+'</div><div class="bs-stats-grid">'+stat('fa-users','Followers',followers.length)+stat('fa-user-plus','Latest followers',followers.slice(0,10).length)+stat('fa-clock','Recent activity',followers.filter(function(f){ return Date.now()-ts(f.createdAt) < 7*86400000; }).length)+'</div><div class="bs-card"><h3>'+esc(tr('Latest followers'))+'</h3><div class="bs-list">'+followerList()+'</div></div></div>';
  }

  function followerList(){
    var followers = state.data.followers || [];
    if(!followers.length) return iconEmpty('fa-users','No followers yet','Followers appear here after users follow the page.');
    return followers.slice(0,12).map(function(f){ return '<div class="bs-list-item compact"><div><strong>'+esc(f.userName || f.displayName || f.userId || tr('Follower'))+'</strong><p>'+esc(date(f.createdAt))+'</p></div></div>'; }).join('');
  }

  function renderAnalytics(){
    var days = state.data.analytics || [];
    var sum = { views:0, phones:0, messages:unreadConvs().length, quotes:(state.data.quotes||[]).length, engagement:postEngagement(state.data.posts || []) };
    days.forEach(function(d){ sum.views += n(d.views); sum.phones += n(d.phoneClicks); });
    document.getElementById('bsContent').innerHTML = '<div class="bs-section"><div class="bs-section-head"><div><h1>'+esc(tr('Analytics'))+'</h1><p>'+esc(tr('Simple summary from existing page analytics and engagement data.'))+'</p></div></div><div class="bs-stats-grid">'+stat('fa-eye','Views',sum.views || '-')+stat('fa-phone','Phone clicks',sum.phones || '-')+stat('fa-heart','Post engagement',sum.engagement)+stat('fa-users','Followers',(state.data.followers||[]).length)+stat('fa-star','Reviews',(state.data.reviews||[]).length)+stat('fa-file-signature','Quotes',sum.quotes)+'</div><div class="bs-card"><h3>'+esc(tr('Recent activity'))+'</h3><div class="bs-list">'+activityList()+'</div></div></div>';
  }

  function renderAds(){
    document.getElementById('bsContent').innerHTML = '<div class="bs-section"><div class="bs-section-head"><div><h1>'+esc(tr('Ads Center'))+'</h1><p>'+esc(tr('Create campaign drafts. Ad delivery will be enabled after billing/review is added.'))+'</p></div></div><div class="bs-two-grid"><div class="bs-card">'+adsForm()+'</div><div class="bs-card"><h3>'+esc(tr('Campaign drafts'))+'</h3><div class="bs-list" id="bsAdsList">'+adsList()+'</div></div></div></div>';
    bindAdsForm();
  }

  function adsForm(){
    var posts = state.data.posts || [];
    return '<h3>'+esc(tr('Boost a post'))+'</h3><div class="bs-form">'+
      '<label>'+esc(tr('Post'))+'<select class="gh-select" id="adPostId">'+posts.map(function(p){ return '<option value="'+esc(p.id)+'">'+esc((p.text || p.content || p.caption || tr('Post')).slice(0,90))+'</option>'; }).join('')+'</select></label>'+
      '<label>'+esc(tr('Objective'))+'<select class="gh-select" id="adObjective"><option value="profile_visits">'+esc(tr('More profile visits'))+'</option><option value="messages">'+esc(tr('More messages'))+'</option><option value="quote_requests">'+esc(tr('More quote requests'))+'</option><option value="followers">'+esc(tr('More followers'))+'</option></select></label>'+
      '<div class="bs-form-grid"><label>'+esc(tr('City'))+'<input class="gh-input" id="adCity" value="'+esc(state.selected.city || '')+'" placeholder="'+esc(tr('City'))+'"></label><label>'+esc(tr('Category / interest'))+'<input class="gh-input" id="adInterest" value="'+esc(state.selected.category || '')+'" placeholder="'+esc(tr('Interest'))+'"></label></div>'+
      '<div class="bs-form-grid"><label>'+esc(tr('Budget in GEL'))+'<input class="gh-input" id="adBudget" type="number" min="1" step="1" placeholder="50"></label><label>'+esc(tr('Duration days'))+'<input class="gh-input" id="adDuration" type="number" min="1" step="1" placeholder="7"></label></div>'+
      '<div class="bs-preview-post" id="adPreview">'+adPreview(posts[0])+'</div>'+
      '<div class="bs-action-row"><button class="gh-btn ghost" type="button" id="saveAdDraft"><i class="fas fa-floppy-disk"></i> '+esc(tr('Save as Draft'))+'</button><button class="gh-btn" type="button" id="submitAdReview"><i class="fas fa-paper-plane"></i> '+esc(tr('Submit for Review'))+'</button></div>'+
      '<p class="bs-muted">'+esc(tr('No payment, delivery, impressions, or clicks are enabled in this MVP.'))+'</p>'+
    '</div>';
  }

  function adPreview(p){
    if(!p) return iconEmpty('fa-newspaper','No posts available','Create a page post before boosting.');
    return '<strong>'+esc(tr('Preview'))+'</strong><p>'+esc(p.text || p.content || p.caption || tr('Post'))+'</p>'+(p.imageUrl || p.mediaUrl || p.photoUrl ? '<img src="'+esc(p.imageUrl || p.mediaUrl || p.photoUrl)+'" alt="">' : '')+'<p class="bs-small">'+esc(tr('Ad delivery will be enabled after billing/review is added.'))+'</p>';
  }

  function bindAdsForm(){
    var postSelect = document.getElementById('adPostId');
    if(postSelect) postSelect.onchange = function(){ var p = (state.data.posts || []).find(function(x){ return x.id === postSelect.value; }); document.getElementById('adPreview').innerHTML = adPreview(p); };
    var save = document.getElementById('saveAdDraft'), submit = document.getElementById('submitAdReview');
    if(save) save.onclick = function(){ saveCampaign('draft'); };
    if(submit) submit.onclick = function(){ saveCampaign('pending_review'); };
  }

  function saveCampaign(status){
    var postId = (document.getElementById('adPostId') || {}).value || '';
    if(!postId) return toast(tr('Choose a post first.'), 'error');
    var budget = n((document.getElementById('adBudget') || {}).value);
    var duration = n((document.getElementById('adDuration') || {}).value);
    if(budget <= 0 || duration <= 0) return toast(tr('Budget and duration are required.'), 'error');
    var now = fs().serverTimestamp();
    fs().addDoc(fs().collection(db(),'businessAdCampaigns'), {
      businessId: state.selectedId,
      ownerUid: state.user.uid,
      postId: postId,
      objective: (document.getElementById('adObjective') || {}).value || 'profile_visits',
      city: (document.getElementById('adCity') || {}).value || '',
      interest: (document.getElementById('adInterest') || {}).value || '',
      budgetGel: budget,
      durationDays: duration,
      status: status,
      createdAt: now,
      updatedAt: now
    }).then(function(){ toast(status === 'draft' ? tr('Draft saved.') : tr('Campaign submitted for review.')); return loadAds(state.selected); }).catch(function(err){ toast(tr('Campaign save failed: ')+(err.code || err.message), 'error'); });
  }

  function adsList(){
    var ads = state.data.ads || [];
    if(!ads.length) return iconEmpty('fa-bullhorn','No campaign drafts','Saved campaign drafts will appear here.');
    return ads.map(function(ad){ return '<div class="bs-list-item compact"><div><strong>'+esc(ad.objective || tr('Campaign'))+'</strong><p>'+esc(n(ad.budgetGel)+' GEL · '+n(ad.durationDays)+' '+tr('days')+' · '+(ad.city || tr('No city')))+'</p><p>'+esc(tr('Ad delivery will be enabled after billing/review is added.'))+'</p></div><span class="bs-badge '+esc(ad.status || 'draft')+'">'+esc(tr(ad.status || 'draft'))+'</span></div>'; }).join('');
  }

  function renderServices(){
    document.getElementById('bsContent').innerHTML = '<div class="bs-section"><div class="bs-section-head"><div><h1>'+esc(tr('Services / Products'))+'</h1><p>'+esc(tr('Counts and shortcuts use the existing business page management.'))+'</p></div><div class="bs-action-row">'+button('business.html?id='+encodeURIComponent(state.selectedId)+'#services','Add service','fa-plus',false)+button('business.html?id='+encodeURIComponent(state.selectedId)+'#products','Add product','fa-box',true)+'</div></div><div class="bs-stats-grid">'+stat('fa-briefcase','Services',(state.data.services||[]).length)+stat('fa-box','Products',(state.data.products||[]).length)+stat('fa-store','Total listings',(state.data.services||[]).length+(state.data.products||[]).length)+'</div><div class="bs-two-grid"><div class="bs-card"><h3>'+esc(tr('Services'))+'</h3><div class="bs-list">'+simpleList(state.data.services,'fa-briefcase','No services yet')+'</div></div><div class="bs-card"><h3>'+esc(tr('Products'))+'</h3><div class="bs-list">'+simpleList(state.data.products,'fa-box','No products yet')+'</div></div></div></div>';
  }

  function simpleList(items, icon, empty){
    if(!items || !items.length) return iconEmpty(icon, empty, '');
    return items.slice(0,8).map(function(x){ return '<div class="bs-list-item compact"><div><strong>'+esc(x.title || x.name || tr('Untitled'))+'</strong><p>'+esc(x.description || x.category || '')+'</p></div></div>'; }).join('');
  }

  function renderRewards(){
    var all = (state.data.rewards || []).concat(state.data.offers || []);
    document.getElementById('bsContent').innerHTML = '<div class="bs-section"><div class="bs-section-head"><div><h1>'+esc(tr('Rewards'))+'</h1><p>'+esc(tr('Rewards and coupons connected to this business.'))+'</p></div>'+button('rewards.html','Open rewards','fa-gift',false)+'</div><div class="bs-stats-grid">'+stat('fa-gift','Active rewards',(state.data.rewards||[]).length)+stat('fa-ticket','Coupons / offers',(state.data.offers||[]).length)+stat('fa-circle-check','Total',all.length)+'</div><div class="bs-card"><h3>'+esc(tr('Current rewards'))+'</h3><div class="bs-list">'+simpleList(all,'fa-gift','No rewards or coupons yet')+'</div></div></div>';
  }

  function renderSettings(){
    var id = encodeURIComponent(state.selectedId);
    document.getElementById('bsContent').innerHTML = '<div class="bs-section"><div class="bs-section-head"><div><h1>'+esc(tr('Page Settings'))+'</h1><p>'+esc(tr('Quick links to existing safe page management screens.'))+'</p></div></div><div class="bs-three-grid">'+
      '<div class="bs-card"><h3>'+esc(tr('Edit business info'))+'</h3><p class="bs-muted">'+esc(tr('Name, description, category, contact info.'))+'</p><div class="bs-card-actions">'+button('add-business.html?edit='+id,'Edit info','fa-pen',false)+'</div></div>'+
      '<div class="bs-card"><h3>'+esc(tr('Edit logo / cover'))+'</h3><p class="bs-muted">'+esc(tr('Branding is managed in the existing edit page.'))+'</p><div class="bs-card-actions">'+button('add-business.html?edit='+id,'Edit branding','fa-image',false)+'</div></div>'+
      '<div class="bs-card"><h3>'+esc(tr('Manage admins'))+'</h3><p class="bs-muted">'+esc(tr('Use the public page dashboard team tools where available.'))+'</p><div class="bs-card-actions">'+button('business.html?id='+id+'#manage','Open dashboard','fa-user-gear',true)+'</div></div>'+
      '<div class="bs-card"><h3>'+esc(tr('View public page'))+'</h3><p class="bs-muted">'+esc(tr('See exactly what visitors see.'))+'</p><div class="bs-card-actions">'+button('business.html?id='+id,'View public page','fa-up-right-from-square',false)+'</div></div>'+
      '<div class="bs-card"><h3>'+esc(tr('Switch to page mode'))+'</h3><p class="bs-muted">'+esc(tr('Use existing page mode and posting tools.'))+'</p><div class="bs-card-actions">'+button('business.html?id='+id+'#manage','Switch mode','fa-repeat',true)+'</div></div>'+
    '</div></div>';
  }

  ready(function(){
    if(!GF || !auth() || !fs() || !db()){ renderAccess('Firebase is unavailable.'); return; }
    GF.authFns.onAuthStateChanged(auth(), function(user){
      state.user = user || null;
      loadBusinesses();
    });
  });
})();
