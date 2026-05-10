/* GeoHub — Auth page logic (auth.html only) */
(function () {
  'use strict';

  var AUTH_KEY   = 'geohub_auth_user';
  var USERS_KEY  = 'geohub_registered_users';

  /* ── Storage helpers ─────────────────────────────────── */
  function read(key, fb) {
    try { var v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fb; }
    catch (e) { return fb; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ── Registered users pool ───────────────────────────── */
  function getUsers() {
    var users = read(USERS_KEY, null);
    if (!users) {
      // Seed from MOCK_USERS on first visit
      users = (window.MOCK_USERS || []).map(function (u) {
        return Object.assign({}, u, {
          email: u.username.replace(/\./g, '') + '@geohub.ge',
          password: 'demo123'
        });
      });
      write(USERS_KEY, users);
    }
    return users;
  }

  /* ── Login ───────────────────────────────────────────── */
  function doLogin(identifier, password) {
    var id  = identifier.trim().toLowerCase();
    var pwd = password.trim();
    var users = getUsers();

    var user = users.find(function (u) {
      return u.email === id ||
             u.username.toLowerCase() === id ||
             u.username === identifier.trim();
    });

    if (user && (pwd === user.password || pwd === 'demo123')) {
      write(AUTH_KEY, user);
      return { ok: true, user: user };
    }
    return { ok: false, error: 'No account found. Pick a demo user below, or use password: demo123' };
  }

  /* ── Sign Up ─────────────────────────────────────────── */
  function doSignup(data) {
    var users = getUsers();

    if (users.find(function (u) { return u.username.toLowerCase() === data.username.toLowerCase(); })) {
      return { ok: false, error: 'Username already taken.' };
    }
    if (users.find(function (u) { return u.email.toLowerCase() === data.email.toLowerCase(); })) {
      return { ok: false, error: 'Email already registered.' };
    }

    var seed = data.username.replace(/\W/g, '') || ('u' + Date.now());
    var newUser = {
      id: 'u_' + Date.now(),
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      password: data.password,
      avatar: 'https://picsum.photos/seed/' + seed + '_gh/200/200',
      coverImage: 'https://picsum.photos/seed/' + seed + '_ghcv/1200/500',
      bio: '',
      city: data.city || 'Tbilisi',
      explorerLevel: 'Bronze Explorer',
      xp: 0,
      rank: 9999,
      badges: [],
      interests: data.interests || [],
      followers: 0,
      following: 0,
      postsCount: 0,
      visitedPlaces: 0,
      trustScore: 70,
      accountType: data.accountType || 'Explorer',
      isNew: true,
      createdAt: Date.now()
    };

    users.push(newUser);
    write(USERS_KEY, users);
    write(AUTH_KEY, newUser);
    return { ok: true, user: newUser };
  }

  /* ── Tab switching ───────────────────────────────────── */
  function initTabs() {
    var tabs = document.querySelectorAll('.auth-tab');
    function activateTab(name) {
      tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
      document.querySelectorAll('.auth-form').forEach(function (f) {
        f.classList.toggle('hidden', f.id !== name + 'Form');
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { activateTab(tab.dataset.tab); });
    });

    // Switch buttons inside forms
    var s2s = document.getElementById('switchToSignup');
    var s2l = document.getElementById('switchToLogin');
    if (s2s) s2s.addEventListener('click', function () { activateTab('signup'); });
    if (s2l) s2l.addEventListener('click', function () { activateTab('login'); });

    // ?tab=signup in URL
    var urlTab = new URLSearchParams(window.location.search).get('tab');
    if (urlTab === 'signup') activateTab('signup');
  }

  /* ── Demo picks ──────────────────────────────────────── */
  function renderDemoPicks() {
    var el = document.getElementById('demoPicks');
    if (!el) return;
    var picks = (window.MOCK_USERS || []).slice(0, 6);
    el.innerHTML = picks.map(function (u) {
      return '<button type="button" class="demo-pick" data-username="' + u.username +
             '" title="' + u.fullName + ' — ' + u.accountType + '">' +
             '<img src="' + u.avatar + '" alt="' + u.fullName + '">' +
             '<span>' + u.fullName.split(' ')[0] + '</span></button>';
    }).join('');

    el.querySelectorAll('.demo-pick').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.getElementById('loginIdentifier').value = btn.dataset.username;
        document.getElementById('loginPassword').value = 'demo123';
        el.querySelectorAll('.demo-pick').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });
  }

  /* ── Signup interests ────────────────────────────────── */
  function renderSignupInterests() {
    var el = document.getElementById('signupInterests');
    if (!el) return;
    var list = ['cafes', 'hiking', 'events', 'photography', 'restaurants', 'nightlife',
                'museums', 'fitness', 'music', 'travel', 'coworking', 'wine'];
    el.innerHTML = list.map(function (i) {
      return '<button type="button" class="ob-interest-chip" data-interest="' + i + '">' + i + '</button>';
    }).join('');
    el.querySelectorAll('.ob-interest-chip').forEach(function (c) {
      c.addEventListener('click', function () { c.classList.toggle('selected'); });
    });
  }

  /* ── Eye toggles ─────────────────────────────────────── */
  function initEyeToggles() {
    [['loginPassword', 'loginEye'], ['signupPassword', 'signupEye']].forEach(function (pair) {
      var input = document.getElementById(pair[0]);
      var btn   = document.getElementById(pair[1]);
      if (!input || !btn) return;
      btn.addEventListener('click', function () {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.querySelector('i').className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
      });
    });
  }

  /* ── Login form ──────────────────────────────────────── */
  function initLoginForm() {
    var form = document.getElementById('loginForm');
    if (!form) return;
    var errEl = document.getElementById('loginError');
    var btn   = document.getElementById('loginBtn');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errEl.textContent = '';
      var id  = document.getElementById('loginIdentifier').value;
      var pwd = document.getElementById('loginPassword').value;
      if (!id || !pwd) { errEl.textContent = 'Please fill in both fields.'; return; }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in…';

      setTimeout(function () {
        var result = doLogin(id, pwd);
        btn.disabled = false;
        if (result.ok) {
          btn.innerHTML = '<i class="fas fa-check"></i> Welcome back!';
          btn.style.background = '#10b981';
          setTimeout(function () { window.location.href = 'feed.html'; }, 700);
        } else {
          btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
          errEl.textContent = result.error;
        }
      }, 800);
    });
  }

  /* ── Sign up form ────────────────────────────────────── */
  function initSignupForm() {
    var form = document.getElementById('signupForm');
    if (!form) return;
    var errEl = document.getElementById('signupError');
    var btn   = document.getElementById('signupBtn');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errEl.textContent = '';

      var fullName  = document.getElementById('signupFullName').value.trim();
      var username  = document.getElementById('signupUsername').value.trim().toLowerCase();
      var email     = document.getElementById('signupEmail').value.trim().toLowerCase();
      var password  = document.getElementById('signupPassword').value;
      var acctType  = document.getElementById('signupType').value;
      var city      = document.getElementById('signupCity').value;
      var terms     = document.getElementById('termsCheck').checked;

      var interests = [];
      document.querySelectorAll('#signupInterests .ob-interest-chip.selected').forEach(function (c) {
        interests.push(c.dataset.interest);
      });

      if (!fullName || !username || !email || !password) {
        errEl.textContent = 'Please fill in all required fields.'; return;
      }
      if (username.length < 3) { errEl.textContent = 'Username must be at least 3 characters.'; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Please enter a valid email.'; return; }
      if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
      if (!terms) { errEl.textContent = 'Please accept the terms to continue.'; return; }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account…';

      setTimeout(function () {
        var result = doSignup({ fullName: fullName, username: username, email: email,
                                 password: password, accountType: acctType, city: city,
                                 interests: interests });
        btn.disabled = false;
        if (result.ok) {
          btn.innerHTML = '<i class="fas fa-check"></i> Account created!';
          btn.style.background = '#10b981';
          var hasOB = localStorage.getItem('geohub_onboarding');
          setTimeout(function () {
            window.location.href = hasOB ? 'feed.html' : 'onboarding.html';
          }, 700);
        } else {
          btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
          errEl.textContent = result.error;
        }
      }, 900);
    });
  }

  /* ── Forgot password modal ───────────────────────────── */
  function initForgotModal() {
    var link     = document.getElementById('forgotLink');
    var modal    = document.getElementById('forgotModal');
    var closeBtn = document.getElementById('closeForgotModal');
    var sendBtn  = document.getElementById('forgotSendBtn');
    var success  = document.getElementById('forgotSuccess');
    if (!link || !modal) return;

    function openModal() { modal.classList.add('open'); }
    function closeModal() { modal.classList.remove('open'); }

    link.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

    sendBtn.addEventListener('click', function () {
      var email = document.getElementById('forgotEmail').value.trim();
      if (!email) return;
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
      setTimeout(function () {
        sendBtn.style.display = 'none';
        success.style.display = 'block';
      }, 1000);
    });
  }

  /* ── Init ────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    // Already logged in → go to feed
    try {
      var cur = localStorage.getItem(AUTH_KEY);
      if (cur && JSON.parse(cur)) { window.location.href = 'feed.html'; return; }
    } catch (e) {}

    getUsers(); // seed mock users if first visit
    initTabs();
    renderDemoPicks();
    renderSignupInterests();
    initEyeToggles();
    initLoginForm();
    initSignupForm();
    initForgotModal();
  });

})();
