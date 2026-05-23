/* GeoHub Auth page — Firebase Auth + Firestore only. */
(function () {
  'use strict';

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
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/email-not-verified': 'Please verify your email before logging in. Check your inbox.'
    };
    return (err && (map[err.code] || err.message)) || 'Authentication failed. Please try again.';
  }

  function goAfterAuth() { window.location.href = 'feed.html'; }

  function initTabs() {
    var tabs = document.querySelectorAll('.auth-tab');
    function activateTab(name) {
      tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
      document.querySelectorAll('.auth-form').forEach(function (f) { f.classList.toggle('hidden', f.id !== name + 'Form'); });
    }
    tabs.forEach(function (tab) { tab.addEventListener('click', function () { activateTab(tab.dataset.tab); }); });
    var s2s = document.getElementById('switchToSignup'); if (s2s) s2s.addEventListener('click', function () { activateTab('signup'); });
    var s2l = document.getElementById('switchToLogin'); if (s2l) s2l.addEventListener('click', function () { activateTab('login'); });
    if (new URLSearchParams(window.location.search).get('tab') === 'signup') activateTab('signup');
  }

  function renderDemoPicks() {
    var el = document.getElementById('demoPicks');
    if (el) el.innerHTML = '<div style="color:#94a3b8;font-size:.85rem;line-height:1.5">Demo accounts are disabled on the production Firebase flow. Use a real email/password or Google sign-in.</div>';
  }

  function renderSignupInterests() {
    var el = document.getElementById('signupInterests');
    if (!el) return;
    var list = ['cafes','hiking','events','photography','restaurants','nightlife','museums','fitness','music','travel','coworking','wine'];
    el.innerHTML = list.map(function (i) { return '<button type="button" class="ob-interest-chip" data-interest="' + i + '">' + i + '</button>'; }).join('');
    el.querySelectorAll('.ob-interest-chip').forEach(function (c) { c.addEventListener('click', function () { c.classList.toggle('selected'); }); });
  }

  function initEyeToggles() {
    [['loginPassword', 'loginEye'], ['signupPassword', 'signupEye']].forEach(function (pair) {
      var input = document.getElementById(pair[0]); var btn = document.getElementById(pair[1]);
      if (!input || !btn) return;
      btn.addEventListener('click', function () { var show = input.type === 'password'; input.type = show ? 'text' : 'password'; btn.querySelector('i').className = show ? 'fas fa-eye-slash' : 'fas fa-eye'; });
    });
  }

  function initLoginForm() {
    var form = document.getElementById('loginForm'); if (!form) return;
    var errEl = document.getElementById('loginError'); var btn = document.getElementById('loginBtn');
    form.addEventListener('submit', function (e) {
      e.preventDefault(); errEl.textContent = ''; errEl.innerHTML = '';
      var email = document.getElementById('loginIdentifier').value.trim().toLowerCase();
      var pwd = document.getElementById('loginPassword').value;
      if (!email || !pwd) { errEl.textContent = 'Please fill in both fields.'; return; }
      if (email.indexOf('@') === -1) { errEl.textContent = 'Use your email address to log in.'; return; }
      if (!window.GeoFirebaseAuth) { errEl.textContent = 'Firebase Auth is not ready. Refresh and try again.'; return; }
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in…';
      window.GeoFirebaseAuth.signIn(email, pwd).then(function () {
        btn.innerHTML = '<i class="fas fa-check"></i> Welcome back!'; btn.style.background = '#10b981'; setTimeout(goAfterAuth, 500);
      }).catch(function (err) {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        if (err && err.code === 'auth/email-not-verified') {
          errEl.innerHTML = fbErrMsg(err) + ' <button type="button" id="resendVerBtn" style="background:none;border:none;color:#10b981;cursor:pointer;text-decoration:underline;font-size:inherit">Resend email</button>';
          var resendBtn = document.getElementById('resendVerBtn');
          if (resendBtn) resendBtn.addEventListener('click', function () {
            resendBtn.disabled = true; resendBtn.textContent = 'Sending…';
            window.GeoFirebaseAuth.resendVerification(email, pwd)
              .then(function (r) { errEl.innerHTML = r && r.alreadyVerified ? '<span style="color:#10b981">Email already verified — try logging in!</span>' : '<span style="color:#10b981">Verification email sent! Check your inbox.</span>'; })
              .catch(function () { resendBtn.disabled = false; resendBtn.textContent = 'Resend email'; });
          });
        } else {
          errEl.textContent = fbErrMsg(err);
        }
      });
    });
  }

  function showVerificationSent(email) {
    var form = document.getElementById('signupForm');
    if (form) form.style.display = 'none';
    var container = form ? form.parentElement : document.querySelector('.auth-card');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:2rem 1rem">'
      + '<div style="font-size:3rem;margin-bottom:1rem">📧</div>'
      + '<h2 style="color:#10b981;margin-bottom:.75rem">Verify your email</h2>'
      + '<p style="color:#94a3b8;margin-bottom:1.5rem">We sent a verification link to <strong style="color:#e2e8f0">' + email + '</strong>.<br>Click the link in the email, then come back to log in.</p>'
      + '<a href="auth.html" class="auth-submit" style="display:inline-block;text-decoration:none;padding:.75rem 2rem"><i class="fas fa-sign-in-alt"></i> Go to Login</a>'
      + '</div>';
  }

  var _unCheckTimer = null;
  var _unStatus = ''; // 'ok' | 'taken' | 'checking' | ''

  function initUsernameCheck() {
    var input = document.getElementById('signupUsername'); if (!input) return;
    var hint = document.getElementById('signupUsernameHint');
    function setHint(msg, color) { if (hint) { hint.textContent = msg; hint.style.color = color || '#94a3b8'; } }
    input.addEventListener('input', function() {
      _unStatus = '';
      clearTimeout(_unCheckTimer);
      var val = input.value.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
      if (input.value !== val) input.value = val;
      if (val.length < 3)  { setHint(val.length ? 'Minimum 3 characters' : '', '#f87171'); return; }
      if (val.length > 20) { setHint('Maximum 20 characters', '#f87171'); _unStatus = 'invalid'; return; }
      setHint('Checking…', '#94a3b8'); _unStatus = 'checking';
      _unCheckTimer = setTimeout(function() {
        if (!window.GeoFirebaseAuth || !window.GeoFirebaseAuth.isUsernameAvailable) {
          setHint('', ''); _unStatus = 'ok'; return;
        }
        window.GeoFirebaseAuth.isUsernameAvailable(val).then(function(avail) {
          if (avail) { setHint('✓ @' + val + ' is available', '#10b981'); _unStatus = 'ok'; }
          else       { setHint('✗ @' + val + ' is taken', '#f87171'); _unStatus = 'taken'; }
        }).catch(function() { setHint('', ''); _unStatus = 'ok'; });
      }, 500);
    });
  }

  function initSignupForm() {
    var form = document.getElementById('signupForm'); if (!form) return;
    var errEl = document.getElementById('signupError'); var btn = document.getElementById('signupBtn');
    initUsernameCheck();
    form.addEventListener('submit', function (e) {
      e.preventDefault(); errEl.textContent = '';
      var fullName = document.getElementById('signupFullName').value.trim();
      var rawUsername = (document.getElementById('signupUsername').value || '').trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
      var email = document.getElementById('signupEmail').value.trim().toLowerCase();
      var password = document.getElementById('signupPassword').value;
      var acctType = (document.getElementById('signupType') || {}).value || 'Explorer';
      var city = (document.getElementById('signupCity') || {}).value || 'all_georgia';
      var terms = document.getElementById('termsCheck').checked;
      var interests = []; document.querySelectorAll('#signupInterests .ob-interest-chip.selected').forEach(function (c) { interests.push(c.dataset.interest); });
      if (!fullName || !rawUsername || !email || !password) { errEl.textContent = 'Please fill in all required fields.'; return; }
      if (rawUsername.length < 3) { errEl.textContent = 'Username must be at least 3 characters.'; return; }
      if (rawUsername.length > 20) { errEl.textContent = 'Username must be at most 20 characters.'; return; }
      if (_unStatus === 'taken') { errEl.textContent = 'That username is already taken. Please choose another.'; return; }
      if (!terms) { errEl.textContent = 'Please accept the terms.'; return; }
      if (!window.GeoFirebaseAuth) { errEl.textContent = 'Firebase Auth is not ready. Refresh and try again.'; return; }
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…';
      window.GeoFirebaseAuth.signUp(email, password, fullName, {
        username: rawUsername, city: city, accountType: acctType, interests: interests
      }).then(function (result) {
        if (result && result.emailVerificationSent) { showVerificationSent(email); }
      }).catch(function (err) {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
        if (err && err.code === 'username-taken') { errEl.textContent = err.message; }
        else { errEl.textContent = fbErrMsg(err); }
      });
    });
  }

  var GSVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>';

  function initGoogleButtons() {
    ['googleLoginBtn', 'googleSignupBtn'].forEach(function (id) {
      var btn = document.getElementById(id); if (!btn) return;
      var label = (id === 'googleLoginBtn') ? 'Continue with Google' : 'Sign up with Google';
      if (!window.GeoFirebaseAuth) { btn.style.display = 'none'; return; }
      btn.addEventListener('click', function () {
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting…';
        window.GeoFirebaseAuth.googleLogin().then(function () { btn.innerHTML = '<i class="fas fa-check"></i> Signed in!'; setTimeout(goAfterAuth, 500); })
          .catch(function (err) { btn.disabled = false; btn.innerHTML = GSVG + ' ' + label; var errEl = document.getElementById(id === 'googleLoginBtn' ? 'loginError' : 'signupError'); if (errEl) errEl.textContent = fbErrMsg(err); });
      });
    });
  }

  function initForgotModal() {
    var link = document.getElementById('forgotLink'); var modal = document.getElementById('forgotModal'); var closeBtn = document.getElementById('closeForgotModal'); var sendBtn = document.getElementById('forgotSendBtn'); var success = document.getElementById('forgotSuccess');
    if (!link || !modal) return;
    link.addEventListener('click', function (e) { e.preventDefault(); modal.classList.add('open'); });
    if (closeBtn) closeBtn.addEventListener('click', function(){ modal.classList.remove('open'); });
    modal.addEventListener('click', function(e){ if(e.target === modal) modal.classList.remove('open'); });
    sendBtn.addEventListener('click', function () {
      var email = document.getElementById('forgotEmail').value.trim(); if (!email) return;
      sendBtn.disabled = true; sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
      (window.GeoFirebaseAuth && window.GeoFirebaseAuth.resetPassword ? window.GeoFirebaseAuth.resetPassword(email) : Promise.reject(new Error('Firebase Auth not ready')))
        .then(function () { sendBtn.style.display = 'none'; success.style.display = 'block'; })
        .catch(function (err) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link'; alert(err && err.message ? err.message : 'Could not send password reset email.'); });
    });
  }

  function startForms() { initTabs(); renderDemoPicks(); renderSignupInterests(); initEyeToggles(); initLoginForm(); initSignupForm(); initForgotModal(); initGoogleButtons(); }

  document.addEventListener('DOMContentLoaded', function () {
    function begin() {
      if (window.GeoFirebaseAuth) {
        var settled = false;
        window.GeoFirebaseAuth.onAuthChange(function (user) { if (settled) return; settled = true; if (user) goAfterAuth(); else startForms(); });
        setTimeout(function () { if (!settled) { settled = true; startForms(); } }, 900);
      } else startForms();
    }
    if (window.GeoFirebaseAuth) begin(); else window.addEventListener('GeoFirebaseReady', begin, { once: true });
    setTimeout(function(){ if(!window.GeoFirebaseAuth) startForms(); }, 1000);
  });
})();
