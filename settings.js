(function(){
  'use strict';

  var app = document.getElementById('settingsApp');
  var GF = null;
  var user = null;
  var managedBusinesses = [];
  var _writeTimer = null;
  var _ppPrivacy = { showFullName: 'everyone', showBio: 'everyone', showStories: 'everyone', showHighlights: 'everyone' };
  var _ppTimer = null;

  var dict = {
    en: {
      settings: 'Settings',
      subtitle: 'Control language, theme, notifications, privacy, and page shortcuts.',
      language: 'Language',
      english: 'English',
      georgian: 'Georgian',
      translationNote: 'Full translation coverage is being expanded.',
      appearance: 'Appearance',
      system: 'System',
      systemSub: 'Follow this device when supported',
      dark: 'Dark',
      darkSub: 'Keep GeoHub in dark mode',
      light: 'Light',
      lightSub: 'Use the lighter GeoHub theme',
      notifications: 'Notifications',
      messages: 'Message notifications',
      pageActivity: 'Page activity notifications',
      email: 'Email notifications',
      emailSub: 'Email delivery is a placeholder in this phase',
      privacy: 'Privacy shortcuts',
      account: 'Account shortcuts',
      business: 'Business / Page shortcuts',
      signIn: 'Sign in to unlock account-specific settings.',
      noPages: 'No business pages found for this account.',
      languageUpdated: 'Language updated',
      themeUpdated: 'Theme updated',
      saved: 'Settings saved',
      feed: 'Feed',
      signInBtn: 'Sign in',
      privacySafety: 'Privacy & Safety',
      privacySafetySub: 'Profile, messages, friends, and post privacy',
      blockedUsers: 'Blocked users',
      mutedUsers: 'Muted users',
      comingSoon: 'Coming soon',
      editProfile: 'Edit profile',
      editProfileSub: 'Profile, bio, city, avatar',
      accountSecurity: 'Change password / account security',
      accountSecuritySub: 'Use the existing auth account flow',
      rewardsWallet: 'Rewards & wallet',
      rewardsWalletSub: 'GeoPoints and coupons',
      addPage: 'Add Page',
      businessPage: 'Business page',
      businessSuite: 'Business Suite',
      pageSettings: 'Page settings',
      switchPage: 'Switch page/account',
      profilePrivacy: 'Profile Visibility',
      profilePrivacySub: 'Who can see your name, bio, stories and highlights',
      ppShowName: 'Full name visible to',
      ppShowBio: 'Bio visible to',
      ppShowStories: 'Stories visible to',
      ppShowHighlights: 'Highlights visible to',
      ppEveryone: 'Everyone',
      ppFriends: 'Friends',
      ppFollowers: 'Followers',
      ppNobody: 'Only me',
      ppSaved: 'Privacy settings saved'
    },
    ka: {
      settings: 'პარამეტრები',
      subtitle: 'მართე ენა, თემა, შეტყობინებები, კონფიდენციალობა და გვერდები.',
      language: 'ენა',
      english: 'ინგლისური',
      georgian: 'ქართული',
      translationNote: 'სრული თარგმანის დაფარვა ეტაპობრივად ფართოვდება.',
      appearance: 'გამოსახულება / თემა',
      system: 'სისტემური',
      systemSub: 'მიჰყვება მოწყობილობის თემას, სადაც შესაძლებელია',
      dark: 'მუქი',
      darkSub: 'GeoHub დარჩება მუქ რეჟიმში',
      light: 'ღია',
      lightSub: 'გამოიყენე GeoHub-ის ღია თემა',
      notifications: 'შეტყობინებები',
      messages: 'შეტყობინებები მესიჯებზე',
      pageActivity: 'გვერდის აქტივობის შეტყობინებები',
      email: 'ელფოსტის შეტყობინებები',
      emailSub: 'ელფოსტა ამ ეტაპზე placeholder-ია',
      privacy: 'კონფიდენციალობა',
      account: 'ანგარიში',
      business: 'ბიზნესი / გვერდები',
      signIn: 'ანგარიშის პარამეტრებისთვის შედი სისტემაში.',
      noPages: 'ამ ანგარიშზე ბიზნეს გვერდები არ მოიძებნა.',
      languageUpdated: 'ენა განახლდა',
      themeUpdated: 'თემა განახლდა',
      saved: 'პარამეტრები შენახულია',
      feed: 'ფიდი',
      signInBtn: 'შესვლა',
      privacySafety: 'კონფიდენციალობა და უსაფრთხოება',
      privacySafetySub: 'პროფილი, მესიჯები, მეგობრები და პოსტების კონფიდენციალობა',
      blockedUsers: 'დაბლოკილი მომხმარებლები',
      mutedUsers: 'დადუმებული მომხმარებლები',
      comingSoon: 'მალე დაემატება',
      editProfile: 'პროფილის რედაქტირება',
      editProfileSub: 'პროფილი, ბიო, ქალაქი, ავატარი',
      accountSecurity: 'პაროლის შეცვლა / ანგარიშის უსაფრთხოება',
      accountSecuritySub: 'გამოიყენე არსებული ავტორიზაციის გვერდი',
      rewardsWallet: 'ჯილდოები და საფულე',
      rewardsWalletSub: 'GeoPoints და კუპონები',
      addPage: 'გვერდის დამატება',
      businessPage: 'ბიზნეს გვერდი',
      businessSuite: 'Business Suite',
      pageSettings: 'გვერდის პარამეტრები',
      switchPage: 'გვერდზე / ანგარიშზე გადართვა',
      profilePrivacy: 'პროფილის ხილვადობა',
      profilePrivacySub: 'ვინ ნახავს შენს სახელს, ბიოს, სთორებს და ჰაილაითებს',
      ppShowName: 'სახელი/გვარი ჩანს',
      ppShowBio: 'ბიო ჩანს',
      ppShowStories: 'სთორები ჩანს',
      ppShowHighlights: 'ჰაილაითები ჩანს',
      ppEveryone: 'ყველასთვის',
      ppFriends: 'მეგობრები',
      ppFollowers: 'ფოლოვერები',
      ppNobody: 'მხოლოდ მე',
      ppSaved: 'კონფიდენციალობის პარამეტრები შენახულია'
    }
  };

  function fs(){ return GF && GF.fs; }
  function db(){ return GF && GF.db; }
  function auth(){ return GF && GF.auth; }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function getLang(){ var v = localStorage.getItem('gh_lang'); return v === 'ka' ? 'ka' : 'en'; }
  function tr(k){ return (dict[getLang()] && dict[getLang()][k]) || dict.en[k] || k; }
  function getThemePref(){ var v = localStorage.getItem('gh_theme'); return v === 'system' || v === 'light' || v === 'dark' ? v : 'dark'; }
  function effectiveTheme(pref){
    if(pref === 'system'){
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return pref === 'light' ? 'light' : 'dark';
  }
  function title(b){ return (b && (b.title || b.name || b.businessName)) || 'Business'; }
  function initials(v){ return String(v || 'B').trim().split(/\s+/).slice(0,2).map(function(x){ return x[0] || ''; }).join('').toUpperCase() || 'B'; }

  function toast(msg){
    var el = document.getElementById('settingsToast');
    if(!el){
      el = document.createElement('div');
      el.id = 'settingsToast';
      el.className = 'settings-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(function(){ el.classList.remove('show'); }, 2300);
  }

  function applyTheme(pref){
    var effective = effectiveTheme(pref);
    document.documentElement.setAttribute('data-gh-theme', effective);
    document.body.setAttribute('data-gh-theme', effective);
    document.documentElement.classList.toggle('gh-theme-light', effective === 'light');
    document.documentElement.classList.toggle('gh-theme-dark', effective === 'dark');
    document.body.classList.toggle('gh-theme-light', effective === 'light');
    document.body.classList.toggle('gh-theme-dark', effective === 'dark');
  }

  // ── Firestore sync ───────────────────────────────────────────

  function currentPrefs() {
    return {
      language:           getLang(),
      theme:              getThemePref(),
      notifyMessages:     localStorage.getItem('gh_notify_messages')     !== 'false',
      notifyPageActivity: localStorage.getItem('gh_notify_page_activity') !== 'false',
      notifyEmail:        localStorage.getItem('gh_notify_email')        !== 'false'
    };
  }

  function applyPrefs(data) {
    var lang  = data.language === 'ka' ? 'ka' : (data.language === 'en' ? 'en' : null);
    var theme = data.theme === 'system' || data.theme === 'light' || data.theme === 'dark' ? data.theme : null;
    if (lang)  localStorage.setItem('gh_lang', lang);
    if (theme) { localStorage.setItem('gh_theme', theme); applyTheme(theme); }
    if (typeof data.notifyMessages     === 'boolean') localStorage.setItem('gh_notify_messages',      data.notifyMessages     ? 'true' : 'false');
    if (typeof data.notifyPageActivity === 'boolean') localStorage.setItem('gh_notify_page_activity', data.notifyPageActivity ? 'true' : 'false');
    if (typeof data.notifyEmail        === 'boolean') localStorage.setItem('gh_notify_email',         data.notifyEmail        ? 'true' : 'false');
  }

  function saveToFirestore(prefs) {
    if (!user || !fs() || !db()) return;
    var uid = user.uid;
    clearTimeout(_writeTimer);
    _writeTimer = setTimeout(function() {
      fs().setDoc(
        fs().doc(db(), 'users', uid, 'preferences', 'settings'),
        Object.assign({}, prefs, { updatedAt: fs().serverTimestamp() }),
        { merge: true }
      ).catch(function(err) {
        console.warn('[Settings] Firestore write failed:', err.code || err.message);
      });
    }, 600);
  }

  function loadFromFirestore(uid) {
    if (!fs() || !db()) return;
    fs().getDoc(fs().doc(db(), 'users', uid, 'preferences', 'settings'))
      .then(function(snap) {
        if (!snap.exists()) return;
        var data = snap.data() || {};
        applyPrefs(data);
        render();
      })
      .catch(function(err) {
        console.warn('[Settings] Firestore read failed:', err.code || err.message);
      });
  }

  function loadPrivacyFromFirestore(uid) {
    if (!fs() || !db()) return;
    fs().getDoc(fs().doc(db(), 'users', uid))
      .then(function(snap) {
        if (!snap.exists()) return;
        var d = snap.data() || {};
        if (d.privacy) {
          _ppPrivacy = Object.assign({}, _ppPrivacy, d.privacy);
          render();
        }
      })
      .catch(function() {});
  }

  function savePrivacyToFirestore() {
    if (!user || !fs() || !db()) return;
    clearTimeout(_ppTimer);
    _ppTimer = setTimeout(function() {
      fs().setDoc(
        fs().doc(db(), 'users', user.uid),
        { privacy: _ppPrivacy },
        { merge: true }
      ).catch(function() {});
    }, 600);
  }

  // ── Render helpers ───────────────────────────────────────────

  function optionButton(group, value, label, sub, active){
    return '<button type="button" class="settings-option'+(active?' active':'')+'" data-setting-group="'+group+'" data-setting-value="'+value+'">'+
      '<span><strong>'+esc(label)+'</strong><span>'+esc(sub || '')+'</span></span><span class="settings-check">'+(active?'<i class="fas fa-check"></i>':'')+'</span></button>';
  }

  function toggleRow(key, label, sub){
    var checked = localStorage.getItem(key);
    if(checked == null) checked = 'true';
    return '<label class="settings-row"><span><strong>'+esc(label)+'</strong><span>'+esc(sub || '')+'</span></span><span class="settings-switch"><input type="checkbox" data-pref-toggle="'+esc(key)+'"'+(checked === 'true' ? ' checked' : '')+'><span class="settings-slider"></span></span></label>';
  }

  function linkRow(href, icon, label, sub){
    return '<a class="settings-row" href="'+esc(href)+'"><span><strong>'+esc(label)+'</strong><span>'+esc(sub || '')+'</span></span><i class="fas '+esc(icon)+'"></i></a>';
  }

  function comingRow(icon, label, sub){
    return '<div class="settings-row"><span><strong>'+esc(label)+'</strong><span>'+esc(sub || 'Coming soon')+'</span></span><i class="fas '+esc(icon)+'"></i></div>';
  }

  function render(){
    var lang = getLang();
    var theme = getThemePref();
    document.documentElement.lang = lang;
    app.innerHTML =
      '<div class="settings-head"><div><h1>'+esc(tr('settings'))+'</h1><p>'+esc(tr('subtitle'))+'</p></div><a class="gh-btn ghost" href="feed.html"><i class="fas fa-house"></i> '+esc(tr('feed'))+'</a></div>'+
      '<div class="settings-grid">'+
        '<section class="settings-stack">'+
          languageCard(lang)+
          appearanceCard(theme)+
          notificationCard()+
          privacyCard()+
          profilePrivacyCard()+
        '</section>'+
        '<aside class="settings-stack">'+
          accountCard()+
          businessCard()+
        '</aside>'+
      '</div>';
    bind();
  }

  function languageCard(lang){
    return '<section class="settings-card"><div class="settings-card-head"><h2><i class="fas fa-language"></i> '+esc(tr('language'))+'</h2></div><div class="settings-options">'+
      optionButton('lang','en',tr('english'),tr('english'),lang === 'en')+
      optionButton('lang','ka',tr('georgian'),tr('georgian'),lang === 'ka')+
      '</div><p class="settings-muted">'+esc(tr('translationNote'))+'</p></section>';
  }

  function appearanceCard(theme){
    return '<section class="settings-card"><div class="settings-card-head"><h2><i class="fas fa-circle-half-stroke"></i> '+esc(tr('appearance'))+'</h2></div><div class="settings-options">'+
      optionButton('theme','system',tr('system'),tr('systemSub'),theme === 'system')+
      optionButton('theme','dark',tr('dark'),tr('darkSub'),theme === 'dark')+
      optionButton('theme','light',tr('light'),tr('lightSub'),theme === 'light')+
      '</div></section>';
  }

  function notificationCard(){
    return '<section class="settings-card"><div class="settings-card-head"><h2><i class="fas fa-bell"></i> '+esc(tr('notifications'))+'</h2></div><div class="settings-list">'+
      toggleRow('gh_notify_messages',tr('messages'),'')+
      toggleRow('gh_notify_page_activity',tr('pageActivity'),'')+
      toggleRow('gh_notify_email',tr('email'),tr('emailSub'))+
      '</div></section>';
  }

  function privacyCard(){
    return '<section class="settings-card"><div class="settings-card-head"><h2><i class="fas fa-shield-halved"></i> '+esc(tr('privacy'))+'</h2></div><div class="settings-list">'+
      linkRow('safety.html','fa-chevron-right',tr('privacySafety'),tr('privacySafetySub'))+
      comingRow('fa-ban',tr('blockedUsers'),tr('comingSoon'))+
      comingRow('fa-volume-xmark',tr('mutedUsers'),tr('comingSoon'))+
      '</div></section>';
  }

  var PP_OPTS = ['everyone','friends','followers','nobody'];
  function ppSelect(field, value) {
    var opts = PP_OPTS.map(function(v) {
      return '<option value="'+v+'"'+(v===value?' selected':'')+'>'+esc(tr('pp'+v.charAt(0).toUpperCase()+v.slice(1)))+'</option>';
    }).join('');
    return '<select class="settings-pp-select" data-pp-field="'+esc(field)+'">'+opts+'</select>';
  }
  function ppRow(field, labelKey) {
    return '<div class="settings-row settings-pp-row"><span><strong>'+esc(tr(labelKey))+'</strong></span>'+ppSelect(field, _ppPrivacy[field] || 'everyone')+'</div>';
  }
  function profilePrivacyCard() {
    if (!user) return '';
    return '<section class="settings-card"><div class="settings-card-head"><h2><i class="fas fa-eye"></i> '+esc(tr('profilePrivacy'))+'</h2><p class="settings-card-sub">'+esc(tr('profilePrivacySub'))+'</p></div><div class="settings-list">'+
      ppRow('showFullName','ppShowName')+
      ppRow('showBio','ppShowBio')+
      ppRow('showStories','ppShowStories')+
      ppRow('showHighlights','ppShowHighlights')+
      '</div></section>';
  }

  function accountCard(){
    if(!user){
      return '<section class="settings-card"><div class="settings-card-head"><h2><i class="fas fa-user"></i> '+esc(tr('account'))+'</h2></div><div class="settings-empty"><div><i class="fas fa-lock"></i><p>'+esc(tr('signIn'))+'</p><a class="gh-btn" href="auth.html"><i class="fas fa-sign-in-alt"></i> '+esc(tr('signInBtn'))+'</a></div></div></section>';
    }
    var profileHref = user.uid ? 'profile.html?id='+encodeURIComponent(user.uid) : 'profile.html';
    return '<section class="settings-card"><div class="settings-card-head"><h2><i class="fas fa-user"></i> '+esc(tr('account'))+'</h2></div><div class="settings-list">'+
      linkRow(profileHref,'fa-chevron-right',tr('editProfile'),tr('editProfileSub'))+
      linkRow('auth.html','fa-chevron-right',tr('accountSecurity'),tr('accountSecuritySub'))+
      linkRow('rewards.html','fa-chevron-right',tr('rewardsWallet'),tr('rewardsWalletSub'))+
      '</div></section>';
  }

  function businessCard(){
    if(!user){
      return '<section class="settings-card"><div class="settings-card-head"><h2><i class="fas fa-store"></i> '+esc(tr('business'))+'</h2></div><div class="settings-empty">'+esc(tr('signIn'))+'</div></section>';
    }
    if(!managedBusinesses.length){
      return '<section class="settings-card"><div class="settings-card-head"><h2><i class="fas fa-store"></i> '+esc(tr('business'))+'</h2></div><div class="settings-empty">'+esc(tr('noPages'))+'</div><div class="settings-actions"><a class="gh-btn ghost sm" href="add-business.html"><i class="fas fa-plus"></i> '+esc(tr('addPage'))+'</a></div></section>';
    }
    return '<section class="settings-card"><div class="settings-card-head"><h2><i class="fas fa-store"></i> '+esc(tr('business'))+'</h2></div><div class="settings-list">'+managedBusinesses.slice(0,6).map(function(b){
      var logo = b.logoUrl ? '<img src="'+esc(b.logoUrl)+'" alt="" loading="lazy" decoding="async">' : esc(initials(title(b)));
      return '<div class="settings-row"><div class="settings-business"><div class="settings-business-logo">'+logo+'</div><div><strong>'+esc(title(b))+'</strong><span>'+esc(b.category || tr('businessPage'))+'</span><div class="settings-actions"><a class="gh-btn sm" href="business-suite.html?businessId='+encodeURIComponent(b.id)+'"><i class="fas fa-briefcase"></i> '+esc(tr('businessSuite'))+'</a><a class="gh-btn ghost sm" href="business.html?id='+encodeURIComponent(b.id)+'#manage"><i class="fas fa-gear"></i> '+esc(tr('pageSettings'))+'</a><a class="gh-btn ghost sm" href="business.html?id='+encodeURIComponent(b.id)+'"><i class="fas fa-repeat"></i> '+esc(tr('switchPage'))+'</a></div></div></div></div>';
    }).join('')+'</div></section>';
  }

  function bind(){
    document.querySelectorAll('[data-setting-group]').forEach(function(btn){
      btn.onclick = function(){
        var group = btn.getAttribute('data-setting-group');
        var value = btn.getAttribute('data-setting-value');
        if(group === 'lang'){
          localStorage.setItem('gh_lang', value === 'ka' ? 'ka' : 'en');
          if(window.GeoLang && window.GeoLang.set) window.GeoLang.set(value);
          saveToFirestore(currentPrefs());
          toast(tr('languageUpdated'));
          render();
          return;
        }
        if(group === 'theme'){
          localStorage.setItem('gh_theme', value);
          applyTheme(value);
          saveToFirestore(currentPrefs());
          toast(tr('themeUpdated'));
          render();
        }
      };
    });
    document.querySelectorAll('[data-pref-toggle]').forEach(function(input){
      input.onchange = function(){
        localStorage.setItem(input.getAttribute('data-pref-toggle'), input.checked ? 'true' : 'false');
        saveToFirestore(currentPrefs());
        toast(tr('saved'));
      };
    });
    document.querySelectorAll('[data-pp-field]').forEach(function(sel){
      sel.onchange = function(){
        var field = sel.getAttribute('data-pp-field');
        var val = sel.value;
        if(PP_OPTS.indexOf(val) === -1) return;
        _ppPrivacy[field] = val;
        savePrivacyToFirestore();
        toast(tr('ppSaved'));
      };
    });
  }

  function ready(cb){
    var called = false;
    function done(){
      if(called) return;
      called = true;
      GF = window.GeoFirebase || null;
      cb();
    }
    if(Object.prototype.hasOwnProperty.call(window, 'GeoFirebase')){ done(); return; }
    window.addEventListener('GeoFirebaseReady', done, { once:true });
    setTimeout(done, 1200);
  }

  function addBusiness(map, d, adminDoc){
    if(!d || !d.exists()) return;
    var b = Object.assign({ id:d.id }, d.data() || {});
    if(b.status === 'deleted' || b.deleted === true || b.deletedAt) return;
    if(adminDoc) b._adminDoc = true;
    map[b.id] = Object.assign(map[b.id] || {}, b);
  }

  function loadBusinesses(){
    managedBusinesses = [];
    if(!user || !GF || !fs() || !db()){ render(); return; }
    var uid = user.uid;
    var map = {};
    var own = ['ownerId','createdBy','userId','ownerUid'].map(function(field){
      return fs().getDocs(fs().query(fs().collection(db(),'businesses'), fs().where(field,'==',uid), fs().limit(25))).catch(function(){ return null; });
    });
    var admins = fs().getDocs(fs().query(fs().collection(db(),'businessAdmins'), fs().where('userId','==',uid), fs().limit(50))).catch(function(){ return null; });
    Promise.all(own.concat([admins])).then(function(res){
      res.slice(0,4).forEach(function(snap){ if(snap) snap.forEach(function(d){ addBusiness(map,d,false); }); });
      var ids = [];
      if(res[4]) res[4].forEach(function(d){ var x = d.data() || {}; if(x.businessId) ids.push(x.businessId); });
      return Promise.all(ids.slice(0,40).map(function(id){
        return fs().getDoc(fs().doc(db(),'businesses',id)).then(function(d){ addBusiness(map,d,true); }).catch(function(){});
      }));
    }).then(function(){
      managedBusinesses = Object.keys(map).map(function(id){ return map[id]; }).sort(function(a,b){ return title(a).localeCompare(title(b)); });
      render();
      loadFromFirestore(uid);
    }).catch(function(){ render(); });
  }

  applyTheme(getThemePref());
  ready(function(){
    if(!GF || !auth() || !GF.authFns || !GF.authFns.onAuthStateChanged){
      render();
      return;
    }
    GF.authFns.onAuthStateChanged(auth(), function(u){
      user = u || null;
      if(user){
        render();
        loadFromFirestore(user.uid);
        loadPrivacyFromFirestore(user.uid);
        loadBusinesses();
      } else {
        render();
      }
    });
  });
})();
