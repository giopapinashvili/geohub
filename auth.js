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

  /* ── Firebase error → friendly message ──────────────── */
  function fbErrMsg(err) {
    var map = {
      'auth/email-already-in-use': 'Email already registered. Try logging in.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/popup-closed-by-user': 'Google sign-in cancelled.',
      'auth/network-request-failed': 'Network error. Check your connection.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.'
    };
    return map[err.code] || err.message || 'Authentication failed. Please try again.';
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
      var id  = document.getElementById('loginIdentifier').value.trim();
      var pwd = document.getElementById('loginPassword').value;
      if (!id || !pwd) { errEl.textContent = 'Please fill in both fields.'; return; }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in…';

      function onSuccess() {
        btn.innerHTML = '<i class="fas fa-check"></i> Welcome back!';
        btn.style.background = '#10b981';
        setTimeout(function () { window.location.href = 'feed.html'; }, 700);
      }
      function onFail(msg) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        errEl.textContent = msg;
      }

      var isEmail = id.indexOf('@') !== -1;
      if (isEmail && window.GeoFirebaseAuth) {
        window.GeoFirebaseAuth.signIn(id, pwd).then(function () {
          onSuccess();
        }).catch(function (err) {
          var result = doLogin(id, pwd);
          if (result.ok) { onSuccess(); } else { onFail(fbErrMsg(err)); }
        });
      } else {
        setTimeout(function () {
          var result = doLogin(id, pwd);
          if (result.ok) { onSuccess(); } else { onFail(result.error); }
        }, 800);
      }
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

      function onSignupSuccess() {
        btn.innerHTML = '<i class="fas fa-check"></i> Account created!';
        btn.style.background = '#10b981';
        var hasOB = localStorage.getItem('geohub_onboarding');
        setTimeout(function () {
          window.location.href = hasOB ? 'feed.html' : 'onboarding.html';
        }, 700);
      }
      function onSignupFail(msg) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        errEl.textContent = msg;
      }

      if (window.GeoFirebaseAuth) {
        window.GeoFirebaseAuth.signUp(email, password, fullName).then(function () {
          onSignupSuccess();
        }).catch(function (err) {
          if (err.code === 'auth/email-already-in-use') {
            onSignupFail(fbErrMsg(err)); return;
          }
          var result = doSignup({ fullName: fullName, username: username, email: email,
                                   password: password, accountType: acctType, city: city,
                                   interests: interests });
          if (result.ok) { onSignupSuccess(); } else { onSignupFail(fbErrMsg(err)); }
        });
      } else {
        setTimeout(function () {
          var result = doSignup({ fullName: fullName, username: username, email: email,
                                   password: password, accountType: acctType, city: city,
                                   interests: interests });
          if (result.ok) { onSignupSuccess(); } else { onSignupFail(result.error); }
        }, 900);
      }
    });
  }

  var GSVG = '<svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>';

  /* ── Google login buttons ───────────────────────────── */
  function initGoogleButtons() {
    ['googleLoginBtn', 'googleSignupBtn'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      if (!window.GeoFirebaseAuth) { btn.style.display = 'none'; return; }
      var label = (id === 'googleLoginBtn') ? 'Continue with Google' : 'Sign up with Google';
      btn.addEventListener('click', function () {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting…';
        window.GeoFirebaseAuth.googleLogin().then(function () {
          btn.innerHTML = '<i class="fas fa-check"></i> Signed in!';
          var hasOB = localStorage.getItem('geohub_onboarding');
          setTimeout(function () { window.location.href = hasOB ? 'feed.html' : 'onboarding.html'; }, 700);
        }).catch(function (err) {
          btn.disabled = false;
          btn.innerHTML = GSVG + ' ' + label;
          var errId = (id === 'googleLoginBtn') ? 'loginError' : 'signupError';
          var errEl = document.getElementById(errId);
          if (errEl) errEl.textContent = fbErrMsg(err);
        });
      });
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
      (window.GeoFirebaseAuth && window.GeoFirebaseAuth.resetPassword ? window.GeoFirebaseAuth.resetPassword(email) : Promise.reject(new Error('Firebase Auth not ready')))
        .then(function () {
          sendBtn.style.display = 'none';
          success.style.display = 'block';
        })
        .catch(function (err) {
          sendBtn.disabled = false;
          sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link';
          alert(err && err.message ? err.message : 'Could not send password reset email.');
        });
    });
  }

  /* ── Init ────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    // Already logged in via localStorage → redirect immediately
    try {
      var cur = localStorage.getItem(AUTH_KEY);
      if (cur && JSON.parse(cur)) { window.location.href = 'feed.html'; return; }
    } catch (e) {}

    function startForms() {
      getUsers();
      initTabs();
      renderDemoPicks();
      renderSignupInterests();
      initEyeToggles();
      initLoginForm();
      initSignupForm();
      initForgotModal();
      initGoogleButtons();
    }

    // If Firebase is loaded, check for existing Firebase session
    // (covers case where localStorage was cleared but Firebase session persists)
    if (window.GeoFirebaseAuth) {
      var settled = false;
      window.GeoFirebaseAuth.onAuthChange(function (user) {
        if (settled) return;
        settled = true;
        if (user) {
          var explicitLogout = localStorage.getItem('geohub_signed_out');
          if (explicitLogout) {
            localStorage.removeItem('geohub_signed_out');
            window.GeoFirebaseAuth.logout().then(startForms).catch(startForms);
          } else {
            window.location.href = 'feed.html';
          }
        } else {
          localStorage.removeItem('geohub_signed_out');
          startForms();
        }
      });
      // Safety fallback: if Firebase doesn't respond within 800ms, show forms
      setTimeout(function () { if (!settled) { settled = true; startForms(); } }, 800);
    } else {
      try { localStorage.removeItem('geohub_signed_out'); } catch (e) {}
      startForms();
    }
  });

})();
