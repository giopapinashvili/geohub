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
      'auth/too-many-requests': 'Too many attempts. Please try again later.'
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
      e.preventDefault(); errEl.textContent = '';
      var email = document.getElementById('loginIdentifier').value.trim().toLowerCase();
      var pwd = document.getElementById('loginPassword').value;
      if (!email || !pwd) { errEl.textContent = 'Please fill in both fields.'; return; }
      if (email.indexOf('@') === -1) { errEl.textContent = 'Use your email address to log in.'; return; }
      if (!window.GeoFirebaseAuth) { errEl.textContent = 'Firebase Auth is not ready. Refresh and try again.'; return; }
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in…';
      window.GeoFirebaseAuth.signIn(email, pwd).then(function () { btn.innerHTML = '<i class="fas fa-check"></i> Welcome back!'; btn.style.background = '#10b981'; setTimeout(goAfterAuth, 500); })
        .catch(function (err) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login'; errEl.textContent = fbErrMsg(err); });
    });
  }

  function initSignupForm() {
    var form = document.getElementById('signupForm'); if (!form) return;
    var errEl = document.getElementById('signupError'); var btn = document.getElementById('signupBtn');
    form.addEventListener('submit', function (e) {
      e.preventDefault(); errEl.textContent = '';
      var fullName = document.getElementById('signupFullName').value.trim();
      var username = document.getElementById('signupUsername').value.trim().toLowerCase();
      var email = document.getElementById('signupEmail').value.trim().toLowerCase();
      var password = document.getElementById('signupPassword').value;
      var acctType = document.getElementById('signupType').value;
      var city = document.getElementById('signupCity').value;
      var terms = document.getElementById('termsCheck').checked;
      var interests = []; document.querySelectorAll('#signupInterests .ob-interest-chip.selected').forEach(function (c) { interests.push(c.dataset.interest); });
      if (!fullName || !username || !email || !password) { errEl.textContent = 'Please fill in all required fields.'; return; }
      if (!terms) { errEl.textContent = 'Please accept the terms.'; return; }
      if (!window.GeoFirebaseAuth) { errEl.textContent = 'Firebase Auth is not ready. Refresh and try again.'; return; }
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…';
      window.GeoFirebaseAuth.signUp(email, password, fullName).then(function (user) {
        var fb = window.GeoFirebase, f = fb && fb.fs;
        var updates = { username: username, city: city || 'Tbilisi', accountType: acctType || 'Explorer', interests: interests, fullName: fullName, updatedAt: Date.now() };
        if (fb && f && user && user.uid) return f.setDoc(f.doc(fb.db, 'users', user.uid), updates, { merge: true });
      }).then(function () { btn.innerHTML = '<i class="fas fa-check"></i> Account created!'; btn.style.background = '#10b981'; setTimeout(goAfterAuth, 600); })
        .catch(function (err) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up'; errEl.textContent = fbErrMsg(err); });
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
