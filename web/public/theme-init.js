/* Runs before first paint so the page never flashes the wrong theme.
   Kept external (not inline) so the CSP can forbid inline scripts. */
(function () {
  var d = document.documentElement;
  try {
    var pref = localStorage.getItem('gh_theme') || 'system';
    var dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    d.setAttribute('data-theme', dark ? 'dark' : 'light');
    var lang = localStorage.getItem('gh_lang');
    if (lang === 'en' || lang === 'ru' || lang === 'ka') d.setAttribute('lang', lang);
  } catch (e) {
    d.setAttribute('data-theme', 'light');
  }
})();
