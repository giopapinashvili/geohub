/* GeoHub — Real Mode vs Demo Mode helper
   window.GeoMode.isRealUser()    → true only for Firebase-authenticated users
   window.GeoMode.isDemoMode()    → true for demo/admin pages or ?demo=true
   window.GeoMode.getCurrentUser()→ parsed geohub_auth_user or null */
(function () {
  'use strict';

  var AUTH_KEY = 'geohub_auth_user';

  function getCurrentUser() {
    try {
      var v = localStorage.getItem(AUTH_KEY);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }

  function isDemoMode() {
    try {
      if (window.location.search.indexOf('demo=true') !== -1) return true;
      var page = (window.location.pathname.split('/').pop() || '').toLowerCase();
      if (page === 'demo.html' || page === 'admin.html') return true;
    } catch (e) {}
    return false;
  }

  // Real user = Firebase-authenticated (isFirebaseUser flag set by firebase-auth.js)
  // Mock-logged-in users (nino.explorer / demo123) remain in demo mode
  function isRealUser() {
    if (isDemoMode()) return false;
    var user = getCurrentUser();
    return !!(user && user.isFirebaseUser === true);
  }

  window.GeoMode = {
    getCurrentUser: getCurrentUser,
    isDemoMode: isDemoMode,
    isRealUser: isRealUser
  };
})();
