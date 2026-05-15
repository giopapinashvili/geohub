(function () {
  'use strict';

  var state = { tab: 'active', active: [], completed: [], progress: {}, query: '' };
  var unsubscribe = function () {};

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return window.GeoChallenges && window.GeoChallenges.escapeHtml
      ? window.GeoChallenges.escapeHtml(v)
      : String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; });
  }
  function typeLabel(type) {
    var labels = window.GeoChallenges ? window.GeoChallenges.TYPE_LABELS : {};
    return labels[type] || 'Challenge';
  }
  function compact(n) {
    n = Number(n || 0);
    return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n);
  }
  function toMs(v) {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    return Date.parse(v) || 0;
  }
  function dateLabel(v) {
    var ms = toMs(v);
    return ms ? new Date(ms).toLocaleDateString('ka-GE', { month: 'short', day: 'numeric' }) : '';
  }
  function currentList() {
    var rows = state.tab === 'completed' ? state.completed : state.active;
    var q = state.query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(function (c) {
      return String(c.title || c.name || '').toLowerCase().indexOf(q) !== -1 ||
        String(c.description || '').toLowerCase().indexOf(q) !== -1 ||
        String(c.city || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  function emptyHtml() {
    if (state.tab === 'completed') {
      return '<div class="challenge-empty"><i class="fas fa-lock"></i><h2>No completed challenges yet</h2><p>Completed missions will appear here after real activity reaches its target.</p></div>';
    }
    return '<div class="challenge-empty"><i class="fas fa-route"></i><h2>No active challenges</h2><p>Admins can create active challenge documents in Firestore. This page does not show demo missions.</p></div>';
  }
  function cardHtml(c) {
    var p = state.progress[c.id] || {};
    var target = Math.max(1, Number(c.targetCount || p.targetCount || 1));
    var progress = Math.min(target, Math.max(0, Number(p.progress || 0)));
    var completed = p.completed === true;
    var pct = completed ? 100 : Math.round((progress / target) * 100);
    var remaining = Math.max(0, target - progress);
    var title = c.title || c.name || 'Untitled challenge';
    var end = dateLabel(c.endAt);
    return '<article class="challenge-card' + (completed ? ' is-complete' : '') + '">' +
      '<div class="challenge-card-top">' +
        '<span class="challenge-type"><i class="fas ' + (completed ? 'fa-check' : 'fa-bolt') + '"></i>' + esc(typeLabel(c.type)) + '</span>' +
        '<span class="challenge-xp">+' + compact(c.xpReward || 0) + ' XP</span>' +
      '</div>' +
      '<h2>' + esc(title) + '</h2>' +
      '<p>' + esc(c.description || 'Complete real activity to make progress.') + '</p>' +
      '<div class="challenge-meta">' +
        (c.city ? '<span><i class="fas fa-location-dot"></i>' + esc(c.city) + '</span>' : '') +
        (end ? '<span><i class="fas fa-calendar"></i>Ends ' + esc(end) + '</span>' : '') +
        (completed ? '<span><i class="fas fa-lock"></i>Completed</span>' : '<span>' + remaining + ' remaining</span>') +
      '</div>' +
      '<div class="challenge-progress-row"><span>' + progress + ' / ' + target + '</span><span>' + pct + '%</span></div>' +
      '<div class="challenge-progress" aria-label="Challenge progress"><span style="width:' + pct + '%"></span></div>' +
    '</article>';
  }
  function paint() {
    var activeCount = $('challengeActiveCount');
    var completedCount = $('challengeCompletedCount');
    var totalCount = $('challengeTotalCount');
    var grid = $('challengeGrid');
    if (activeCount) activeCount.textContent = state.active.length;
    if (completedCount) completedCount.textContent = state.completed.length;
    if (totalCount) totalCount.textContent = state.active.length + state.completed.length;
    document.querySelectorAll('[data-challenge-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.challengeTab === state.tab);
    });
    if (!grid) return;
    var rows = currentList();
    grid.innerHTML = rows.length ? rows.map(cardHtml).join('') : emptyHtml();
  }
  function start() {
    if (!window.GeoChallenges) return;
    unsubscribe();
    unsubscribe = window.GeoChallenges.listenUserChallenges(function (next) {
      state.active = next.active || [];
      state.completed = next.completed || [];
      state.progress = next.progress || {};
      paint();
    });
  }
  function bind() {
    var search = $('challengeSearch');
    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value || '';
        paint();
      });
    }
    document.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-challenge-tab]');
      if (tab) {
        state.tab = tab.dataset.challengeTab || 'active';
        paint();
      }
    });
  }
  function init() {
    bind();
    if (window.GeoChallenges) start();
    else window.addEventListener('GeoChallengesReady', start, { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
