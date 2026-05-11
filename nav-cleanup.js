(function GeoHubNavCleanup() {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TRANSLATIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var KA = {
    // ── nav groups
    'Main':'მთავარი','Explore':'გამოიკვლიე','Growth':'ზრდა','Personal':'პირადი',
    // ── nav items
    'Home':'მთავარი','Discover':'აღმოაჩინე','Map':'რუქა','Live':'პირდაპირი',
    'Places':'ადგილები','Events':'ღონისძიებები','Groups':'ჯგუფები',
    'Real Estate':'უძრავი ქონება','Learning':'სწავლება','Marketplace':'მარკეტი',
    'Dashboard':'დაფა','Add Business':'ბიზნესის დამატება','Creators':'შემქმნელები',
    'Profile':'პროფილი','Messages':'შეტყობინებები','Rewards':'ჯილდოები',
    'Challenges':'გამოწვევები','Trust':'ნდობა','Assistant':'ასისტენტი',
    // ── common UI (text-node walker)
    'Sign Up':'რეგისტრაცია','Sign In':'შესვლა','Login':'შესვლა','Log in':'შესვლა',
    'Register':'რეგისტრაცია','Log Out':'გამოსვლა','Sign Out':'გამოსვლა',
    'Check In':'ჩაწერა','Get Started':'დაიწყე','Get Started Free':'დაიწყე უფასოდ',
    'Add Your Business':'ბიზნესის დამატება','View Live City':'Live ქალაქი',
    'Create Business Page':'ბიზნეს გვერდის შექმნა','Explore Now':'გამოიკვლიე',
    'Open Creator Hub':'შემქმნელის ჰაბი','See all':'ყველა','View all':'ყველა',
    'Load More':'მეტი','Follow':'გამოწერა','Unfollow':'გამოწერის გაუქმება',
    'Join':'შეერთება','Share':'გაზიარება','Save':'შენახვა',
    'Save Changes':'ცვლილებების შენახვა','Cancel':'გაუქმება','Delete':'წაშლა',
    'Edit':'რედაქტირება','Edit Profile':'პროფილის რედაქტირება',
    'Submit':'გაგზავნა','Send':'გაგზავნა','Search':'ძებნა','Filter':'ფილტრი',
    'Back':'უკან','Next':'შემდეგი','Close':'დახურვა',
    'Copy Link':'ბმულის კოპირება','Browse Challenges':'გამოწვევების ნახვა',
    'Find Places':'ადგილების ძებნა','Explore Map':'რუქის გახსნა',
    'For You':'შენთვის','Following':'გამოწერილი','Nearby':'ახლომახლო',
    'Trending':'ტრენდული','Trending Explorers':'ტრენდული მკვლევრები',
    'Suggested to Follow':'სამოწერო წინადადებები',
    'No suggestions yet':'წინადადებები არ არის',
    'No reviews yet':'მიმოხილვები არ არის',
    'No posts yet':'პოსტები არ არის',
    'Nearby Events':'ახლომდებარე ღონისძიებები',
    'Top Challenges':'საუკეთესო გამოწვევები',
    'Active Rewards':'აქტიური ჯილდოები','My wallet':'ჩემი საფულე',
    'Your Story':'ჩემი სტორი',
    // ── index hero chips
    'XP for check-ins':'XP ჩაწერებისთვის','Rewards wallet':'ჯილდოების საფულე',
    'Trust score':'ნდობის ქულა','Business campaigns':'ბიზნეს კამპანიები',
    // ── index section kickers
    "Georgia's real-world discovery platform":'საქართველოს რეალური სამყაროს პლატფორმა',
    'Why GeoHub':'რატომ GeoHub','The Loop':'ციკლი',
    'Platform Preview':'პლატფორმის მიმოხილვა',"Who It's For":'ვისთვისაა',
    // ── index pillar h3s & loop step h3s
    'Discover places and events':'ადგილებისა და ღონისძიებების აღმოჩენა',
    'Earn XP and rewards':'XP-ისა და ჯილდოების მიღება',
    'Connect with people':'ადამიანებთან დაკავშირება',
    'Grow your business':'ბიზნესის განვითარება',
    'Check-in':'ჩაწერა','Earn XP':'მიიღე XP',
    'Get Rewards':'მიიღე ჯილდოები',
    // ── index audience
    'For Users':'მომხმარებლებისთვის','For Businesses':'ბიზნესებისთვის',
    'For Creators':'შემქმნელებისთვის',
    'Discover better places and daily plans':'იპოვე უკეთესი ადგილები და ყოველდღიური გეგმები',
    'Earn XP, badges, and real rewards':'მიიღე XP, ბეჯები და რეალური ჯილდოები',
    'Join groups, events, and challenges':'შეუერთდი ჯგუფებს, ღონისძიებებსა და გამოწვევებს',
    'AI-powered route and budget planning':'AI-ის მარშრუტი და ბიუჯეტის დაგეგმვა',
    'Create a public business page':'შექმენი საჯარო ბიზნეს გვერდი',
    'Launch QR rewards and targeted offers':'გაუშვი QR ჯილდოები და მიზნობრივი შეთავაზებები',
    'Track customers, visits, and campaigns':'თვალი ადევნე კლიენტებს, ვიზიტებს და კამპანიებს',
    'Collaborate with local creators':'ითანამშრომლე ლოკალ შემქმნელებთან',
    'Build influence from real-world activity':'ააგე გავლენა რეალური სამყაროს აქტივობიდან',
    'Partner with local businesses and brands':'ითანამშრომლე ლოკალ ბიზნესებთან და ბრენდებთან',
    'Promote places, events, and hidden spots':'გაავრცელე ადგილები, ღონისძიებები და ფარული ადგილები',
    'Earn rewards for verified creator content':'მიიღე ჯილდოები ვერიფიცირებული კონტენტისთვის',
    // ── index stats
    'check-ins':'ჩაწერა','places listed':'რეგისტრირებული ადგილი',
    'rewards claimed':'მიღებული ჯილდო','active creators':'აქტიური შემქმნელი',
    'business campaigns':'ბიზნეს კამპანია',
    // ── footer
    'Discover Feed':'აღმოჩენის ფიდი','Patriot Missions':'პატრიოტული მისიები',
    'Reviews 2.0':'მიმოხილვები 2.0','Built for Georgia.':'შექმნილია საქართველოსთვის.',
    'Georgian':'ქართული','English':'ინგლისური','Privacy':'კონფიდენციალობა',
    // ── data-i18n keyed strings (set on elements by index.html)
    'hero-subtitle':'GeoHub რეალურ ცხოვრებას პროგრესად გარდაქმნის — იპოვე ადგილები და ღონისძიებები, გააკეთე ჩაწერა, მიიღე ჯილდოები, გაიცანი ახალი ადამიანები, გამოიწერე შემქმნელები და დაეხმარე ბიზნესებს ქალაქის ვერიფიცირებული აქტივობით.',
    'hero-title':'გამოიკვლიე საქართველო.<br><span class="hl">მიიღე XP.</span> დაუკავშირდი.<br><span class="hl2">გაიზარდე</span> ლოკალურად.',
    'hero-kicker':'<span class="kicker-dot"></span>საქართველოს რეალური სამყაროს პლატფორმა',
    'why-h2':'ერთი პლატფორმა ქალაქური ცხოვრებისთვის, ჯილდოებისა და ადგილობრივი ზრდისთვის.',
    'why-p':'GeoHub აკავშირებს ყველაფერს, რასაც ადამიანები უკვე აკეთებენ ოფლაინ, ციფრულ პროგრეს სისტემასთან, სოციალურ ფენასა და ბიზნეს ზრდის ძრავასთან.',
    'pillar1-p':'იპოვე კაფეები, რესტორნები, ფარული ადგილები, ღონისძიებები, მარშრუტები, ქალაქის Live აქტივობა და AI-ის გეგმები საქართველოში.',
    'pillar2-p':'ჩაწერები, მიმოხილვები, გამოწვევები, QR სქანები და ვერიფიცირებული აქტივობა ხსნის ქულებს, ბეჯებს, ფასდაკლებებს და სტატუსს.',
    'pillar3-p':'გამოიწერე მკვლევრები, შეუერთდი ჯგუფებს, დაესწარი ღონისძიებებს და ააგე ცხოვრების სტილის პორტფოლიო, რომელიც ასახავს ქალაქში შენს რეალურ ყოფნას.',
    'pillar4-p':'გაუშვი შეთავაზებები, QR ჯილდოების კამპანიები, შემქმნელებთან თანამშრომლობა, ღონისძიებები და ლოიალობის ანალიტიკა ერთი დაფიდან.',
    'loop-h2':'მარტივი დიზაინით. ძლიერი პრაქტიკაში.',
    'loop-p':'რეალური ქმედება გარდაიქმნება გაზომვად პროგრესად, სოციალურ დასტურად და განმეორებით აღმოჩენად.',
    'step1-p':'გახსენი GeoHub და იპოვე, რა ხდება შენს გარშემო ახლა.',
    'step2-p':'დაადასტურე ვიზიტი ადგილის თეგებით, ფოტოებით, GPS-ით ან QR კოდით.',
    'step3-p':'გაიზარდე დონეში, რანგში, ნდობის ქულაში, ბეჯებსა და პასპორტის პროგრესში.',
    'step4-p':'გახსენი ფასდაკლებები, კოფე, ბილეთები, პრემიუმ წვდომა და პარტნიორთა შეთავაზებები.',
    'step5-h3':'გაუზიარე','step5-p':'შენი აქტივობა გარდაიქმნება ფიდის კონტენტად, გავლენად და საზოგადოებრივ ღირებულებად.',
    'preview-h2':'GeoHub ეკოსისტემის პირდაპირი ხედი.',
    'preview-p':'ყველა პროდუქტი ერთად მუშაობს: აღმოჩენა, ქალაქის სიგნალები, ჯილდოები, AI დაგეგმვა და ბიზნეს ინსტრუმენტები.',
    'audience-h2':'შექმნილია ყველასთვის, ვინც ქალაქში ცხოვრობს.',
    'audience-p':'მკვლევარი, ბიზნეს მფლობელი თუ შემქმნელი — GeoHub გაძლევს პლატფორმას, რომელიც შენთან ერთად იზრდება.',
    'users-p':'ააგე ცხოვრების სტილის პროფილი რეალური აქტივობით, ცარიელი სქროლინგის ნაცვლად.',
    'biz-h2':'ბიზნესებისთვის','biz-p':'გადაქციე ფეხით მოსვლა ლოიალობად, კამპანიებად, განმეორებით ვიზიტებად და გაზომვად ზრდად.',
    'creators-p':'გამოიყენე რეალური მოგზაურობა, ნდობის ქულა და ჩართულობა ბრენდ თანამშრომლობის გასახსნელად.',
    'cta-h2':'გარდაქმენი შენი <span class="hl">რეალური ცხოვრება</span> პროგრესად.',
    'cta-p':'დაიწყე ერთი ჩაწერით, ჯილდოთი, ღონისძიებით ან ბიზნეს კამპანიით. GeoHub ქალაქს ცოცხალ ეკოსისტემად გარდაქმნის.',
    'footer-desc':'საქართველოს რეალური სამყაროს აღმოჩენის, ჯილდოების, საზოგადოებისა და ბიზნეს ზრდის პლატფორმა.',
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LANG ENGINE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var _lang = localStorage.getItem('geohub_lang') || 'en';

  function t(key) {
    return (_lang === 'ka' && KA[key]) ? KA[key] : key;
  }

  function applyTranslations() {
    if (_lang === 'en') return; // HTML is already English
    var dict = KA;

    // 1. data-i18n → textContent
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });

    // 2. data-i18n-html → innerHTML
    document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-html');
      if (dict[key]) el.innerHTML = dict[key];
    });

    // 3. Text-node walker for short UI strings
    var skip = new Set(['SCRIPT','STYLE','INPUT','TEXTAREA','SELECT','NOSCRIPT','CODE','PRE']);
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var replacements = [];
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentElement;
      if (!parent || skip.has(parent.tagName)) continue;
      if (parent.hasAttribute('data-i18n') || parent.hasAttribute('data-i18n-html')) continue;
      var trimmed = node.textContent.trim();
      if (trimmed.length < 2) continue;
      var translated = dict[trimmed];
      if (translated && translated !== trimmed) {
        replacements.push([node, node.textContent.replace(trimmed, translated)]);
      }
    }
    replacements.forEach(function(r) { r[0].textContent = r[1]; });

    document.documentElement.lang = 'ka';
  }

  window.GeoLang = {
    get current() { return _lang; },
    t: t,
    apply: applyTranslations,
    toggle: function() {
      localStorage.setItem('geohub_lang', _lang === 'en' ? 'ka' : 'en');
      window.location.reload();
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NAV GROUPS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var groups = [
    {
      label: 'Main',
      kind: 'primary',
      items: [
        { label: 'Home',     href: 'index.html', icon: 'fa-house' },
        { label: 'Discover', href: 'feed.html',  icon: 'fa-compass' },
        { label: 'Map',      href: 'map.html',   icon: 'fa-map' },
        { label: 'Live',     href: 'live.html',  icon: 'fa-signal' }
      ]
    },
    {
      label: 'Explore',
      items: [
        { label: 'Places',      href: 'places.html',      icon: 'fa-location-dot' },
        { label: 'Events',      href: 'events.html',      icon: 'fa-ticket' },
        { label: 'Groups',      href: 'groups.html',      icon: 'fa-users' },
        { label: 'Real Estate', href: 'real-estate.html', icon: 'fa-building' },
        { label: 'Learning',    href: 'learning.html',    icon: 'fa-graduation-cap' },
        { label: 'Marketplace', href: 'services.html',    icon: 'fa-briefcase' }
      ]
    },
    {
      label: 'Growth',
      items: [
        { label: 'Dashboard',     href: 'dashboard.html',    icon: 'fa-chart-line' },
        { label: 'Add Business',  href: 'add-business.html', icon: 'fa-store' },
        { label: 'Creators',      href: 'creators.html',     icon: 'fa-wand-magic-sparkles' }
      ]
    },
    {
      label: 'Personal',
      items: [
        { label: 'Profile',    href: 'profile.html',    icon: 'fa-user' },
        { label: 'Messages',   href: 'messages.html',   icon: 'fa-message' },
        { label: 'Rewards',    href: 'rewards.html',    icon: 'fa-gift' },
        { label: 'Challenges', href: 'challenges.html', icon: 'fa-trophy' },
        { label: 'Trust',      href: 'trust.html',      icon: 'fa-shield-halved' },
        { label: 'Assistant',  href: 'assistant.html',  icon: 'fa-sparkles' }
      ]
    }
  ];

  function currentFile() {
    return (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  function isActive(item) {
    return currentFile() === item.href.toLowerCase();
  }

  function itemLink(item) {
    return '<a href="' + item.href + '" class="' + (isActive(item) ? 'active' : '') + '">' +
      '<i class="fas ' + item.icon + '"></i><span>' + t(item.label) + '</span>' +
      '</a>';
  }

  function renderDesktopNav() {
    return groups.map(function(group) {
      if (group.kind === 'primary') {
        return group.items.map(function(item) {
          return '<li class="nav-leaf">' + itemLink(item) + '</li>';
        }).join('');
      }
      var active = group.items.some(isActive);
      return '<li class="nav-dropdown ' + (active ? 'active' : '') + '">' +
        '<button class="nav-menu-trigger" type="button" aria-expanded="false">' +
        '<span>' + t(group.label) + '</span><i class="fas fa-chevron-down"></i>' +
        '</button>' +
        '<div class="nav-dropdown-panel">' +
        '<div class="nav-dropdown-title">' + t(group.label) + '</div>' +
        group.items.map(itemLink).join('') +
        '</div></li>';
    }).join('');
  }

  function renderMobileNav() {
    return groups.map(function(group) {
      return '<div class="mobile-menu-group">' +
        '<div class="mobile-menu-title">' + t(group.label) + '</div>' +
        group.items.map(itemLink).join('') +
        '</div>';
    }).join('');
  }

  function wireDropdowns() {
    document.querySelectorAll('.nav-menu-trigger').forEach(function(button) {
      button.addEventListener('click', function(event) {
        event.stopPropagation();
        var parent = button.closest('.nav-dropdown');
        var isOpen = parent.classList.toggle('open');
        button.setAttribute('aria-expanded', String(isOpen));
        document.querySelectorAll('.nav-dropdown.open').forEach(function(drop) {
          if (drop !== parent) {
            drop.classList.remove('open');
            var trigger = drop.querySelector('.nav-menu-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
          }
        });
      });
    });
    document.addEventListener('click', function() {
      document.querySelectorAll('.nav-dropdown.open').forEach(function(drop) {
        drop.classList.remove('open');
        var trigger = drop.querySelector('.nav-menu-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LANG TOGGLE BUTTON
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function injectLangStyles() {
    if (document.getElementById('geoLangStyle')) return;
    var s = document.createElement('style');
    s.id = 'geoLangStyle';
    s.textContent = [
      '#geoLangToggle{',
        'background:transparent;',
        'border:1px solid rgba(255,255,255,0.18);',
        'color:var(--text-secondary,#aaa);',
        'border-radius:6px;',
        'padding:3px 9px;',
        'font-size:0.75rem;',
        'font-weight:700;',
        'letter-spacing:0.5px;',
        'cursor:pointer;',
        'transition:border-color .2s,color .2s;',
        'white-space:nowrap;',
        'flex-shrink:0;',
        'font-family:inherit;',
      '}',
      '#geoLangToggle:hover{border-color:var(--green,#10b981);color:var(--green,#10b981);}',
    ].join('');
    document.head.appendChild(s);
  }

  function addLangToggle() {
    if (document.getElementById('geoLangToggle')) return;
    injectLangStyles();
    var btn = document.createElement('button');
    btn.id = 'geoLangToggle';
    btn.setAttribute('aria-label', 'Switch language');
    btn.textContent = _lang === 'ka' ? 'EN' : 'ქარ';
    btn.onclick = function() { window.GeoLang.toggle(); };
    var actions = document.querySelector('.navbar-actions');
    if (actions) actions.insertBefore(btn, actions.firstChild);
  }

  // Backup: observe .navbar (not just .navbar-actions) to catch any rewrite
  function watchNavActions() {
    var nav = document.querySelector('.navbar');
    if (!nav) return;
    var observer = new MutationObserver(function() {
      if (!document.getElementById('geoLangToggle')) {
        addLangToggle();
      }
    });
    observer.observe(nav, { childList: true, subtree: true });
  }

  function cleanupActions() {
    var actions = document.querySelector('.navbar-actions');
    if (!actions) return;
    if (actions.querySelector('.auth-nav-user')) { addLangToggle(); return; }
    actions.querySelectorAll('a').forEach(function(link) {
      var href = (link.getAttribute('href') || '').toLowerCase();
      if (href === '#' && /sign up|register|sign in/i.test(link.textContent)) link.remove();
    });
    var profile = Array.from(actions.querySelectorAll('a')).find(function(link) {
      return (link.getAttribute('href') || '').includes('profile.html');
    });
    if (profile) {
      profile.innerHTML = '<i class="fas fa-user-circle"></i>';
      profile.setAttribute('title', 'Profile');
      profile.setAttribute('aria-label', 'Profile');
      profile.classList.add('nav-profile-icon');
    }
    addLangToggle();
  }

  function wireHamburger() {
    var hamburger  = document.querySelector('.hamburger');
    var mobileMenu = document.querySelector('.mobile-menu');
    if (!hamburger || !mobileMenu) return;

    hamburger.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', function() {
      mobileMenu.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });

    mobileMenu.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    mobileMenu.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
      });
    });
  }

  function init() {
    var navbarLinks = document.querySelector('.navbar-links');
    var mobileMenu  = document.querySelector('.mobile-menu');
    if (navbarLinks) navbarLinks.innerHTML = renderDesktopNav();
    if (mobileMenu)  mobileMenu.innerHTML  = renderMobileNav();
    cleanupActions();
    wireDropdowns();
    wireHamburger();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(); applyTranslations(); watchNavActions(); });
  } else {
    init();
    applyTranslations();
    watchNavActions();
  }

})();
