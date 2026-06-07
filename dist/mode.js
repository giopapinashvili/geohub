/* GeoHub real/demo mode helper — Firebase Auth is the source of truth. */
(function () {
  'use strict';
  function getCurrentUser() { return (window.GeoAuth && window.GeoAuth.getCurrentUser && window.GeoAuth.getCurrentUser()) || window.GeoCurrentUser || null; }
  function isDemoMode() {
    var page = (window.location.pathname.split('/').pop() || '').toLowerCase();
    return page === 'demo.html' || window.location.search.indexOf('demo=true') !== -1;
  }
  function isRealUser() { var user = getCurrentUser(); return !!(user && user.uid && !isDemoMode()); }
  window.GeoMode = { getCurrentUser: getCurrentUser, isDemoMode: isDemoMode, isRealUser: isRealUser };
})();
