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
    // p.xpReward is written by the engine; falls back to challenge doc field
    var xpDisplay = Number(p.xpReward || c.xpReward || 0);
    return '<article class="challenge-card' + (completed ? ' is-complete' : '') + '"' +
      ' data-chal-id="' + esc(c.id || '') + '"' +
      ' tabindex="0"' +
      ' aria-label="' + esc(title) + '">' +
      '<div class="challenge-card-top">' +
        '<span class="challenge-type"><i class="fas ' + (completed ? 'fa-check' : 'fa-bolt') + '"></i>' + esc(typeLabel(c.type)) + '</span>' +
        '<span class="challenge-xp">+' + compact(xpDisplay) + ' XP</span>' +
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
      (c.badge ? '<div class="ch-badge-pill' + (completed ? ' is-earned' : '') + '"><i class="fas fa-medal"></i> ' + (completed ? 'Badge earned' : 'Badge reward') + '</div>' : '') +
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

  /* ── Challenge detail modal ────────────────────────────────────────── */
  var MODAL_ID = 'chalDetailOverlay';

  function ensureModal() {
    if (document.getElementById(MODAL_ID)) return;
    var el = document.createElement('div');
    el.id = MODAL_ID;
    el.className = 'chalm-overlay';
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('role', 'dialog');
    el.innerHTML =
      '<div class="chalm-sheet" id="chalDetailSheet" tabindex="-1">' +
        '<div class="chalm-handle" aria-hidden="true"></div>' +
        '<div class="chalm-head">' +
          '<div class="chalm-badges" id="chalDetailBadges"></div>' +
          '<button class="chalm-close" id="chalDetailClose" aria-label="Close">' +
            '<i class="fas fa-times"></i>' +
          '</button>' +
        '</div>' +
        '<h2 class="chalm-title" id="chalDetailTitle"></h2>' +
        '<p class="chalm-desc" id="chalDetailDesc"></p>' +
        '<div class="chalm-xp-row" id="chalDetailXp"></div>' +
        '<div class="chalm-prog-wrap" id="chalDetailProg"></div>' +
        '<div class="chalm-completed-msg" id="chalDetailComplete">' +
          '<i class="fas fa-check-circle"></i> Challenge completed' +
        '</div>' +
        '<div class="chalm-badge-unlock" id="chalDetailBadgeUnlock"></div>' +
        '<div class="chalm-ts" id="chalDetailTs"></div>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target === el) closeModal();
    });
    document.getElementById('chalDetailClose').addEventListener('click', closeModal);
  }

  function openModal(c) {
    ensureModal();
    var p = state.progress[c.id] || {};
    var target = Math.max(1, Number(c.targetCount || p.targetCount || 1));
    var prog = Math.min(target, Math.max(0, Number(p.progress || 0)));
    var completed = p.completed === true;
    var pct = completed ? 100 : Math.round((prog / target) * 100);
    var remaining = Math.max(0, target - prog);

    document.getElementById('chalDetailBadges').innerHTML =
      '<span class="chalm-type-badge chalm-type-' + esc(c.type || 'default') + '">' +
        esc(typeLabel(c.type)) +
      '</span>' +
      (completed ? '<span class="chalm-done-badge"><i class="fas fa-check"></i> Completed</span>' : '');

    document.getElementById('chalDetailTitle').textContent = c.title || c.name || 'Challenge';
    document.getElementById('chalDetailDesc').textContent = c.description || 'Complete real activity to make progress on this challenge.';

    var xpModal = Number(p.xpReward || c.xpReward || 0);
    document.getElementById('chalDetailXp').innerHTML =
      '<i class="fas fa-bolt"></i> +' + compact(xpModal) + ' XP reward';

    document.getElementById('chalDetailProg').innerHTML =
      '<div class="chalm-prog-labels">' +
        '<span>' + prog + ' / ' + target + '</span>' +
        '<span>' + pct + '%</span>' +
      '</div>' +
      '<div class="chalm-prog-bar"><span style="width:' + pct + '%"></span></div>' +
      (!completed ? '<div class="chalm-prog-note">' + remaining + ' more to go</div>' : '');

    var completeEl = document.getElementById('chalDetailComplete');
    completeEl.style.display = completed ? 'flex' : 'none';

    var tsEl = document.getElementById('chalDetailTs');
    if (completed && p.completedAt) {
      tsEl.innerHTML = '<i class="fas fa-calendar-check"></i> Completed ' + dateLabel(p.completedAt);
      tsEl.style.display = 'flex';
    } else if (c.endAt) {
      tsEl.innerHTML = '<i class="fas fa-calendar"></i> Ends ' + dateLabel(c.endAt);
      tsEl.style.display = 'flex';
    } else {
      tsEl.style.display = 'none';
    }

    var badgeEl = document.getElementById('chalDetailBadgeUnlock');
    if (badgeEl) {
      if (c.badge) {
        badgeEl.innerHTML = completed
          ? '<i class="fas fa-medal"></i> Badge unlocked!'
          : '<i class="fas fa-medal"></i> Earns a badge on completion';
        badgeEl.className = 'chalm-badge-unlock' + (completed ? ' is-earned' : '');
        badgeEl.style.display = 'flex';
      } else {
        badgeEl.style.display = 'none';
      }
    }

    document.getElementById(MODAL_ID).classList.add('open');
    var sheet = document.getElementById('chalDetailSheet');
    if (sheet) sheet.focus();
  }

  function closeModal() {
    var overlay = document.getElementById(MODAL_ID);
    if (overlay) overlay.classList.remove('open');
  }

  /* ── Event bindings ────────────────────────────────────────────────── */
  function bind() {
    var search = $('challengeSearch');
    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value || '';
        paint();
      });
    }

    // Single delegated click listener on document — survives innerHTML repaints, no duplicates
    document.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-challenge-tab]');
      if (tab) { state.tab = tab.dataset.challengeTab || 'active'; paint(); return; }

      var card = e.target.closest('.challenge-card[data-chal-id]');
      if (card) {
        var id = card.dataset.chalId;
        var all = state.active.concat(state.completed);
        for (var i = 0; i < all.length; i++) {
          if (all[i].id === id) { openModal(all[i]); return; }
        }
      }
    });

    // Keyboard: ESC closes, Enter/Space activates focused card
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeModal(); return; }
      if (e.key === 'Enter' || e.key === ' ') {
        var focused = document.activeElement;
        var card = focused && focused.closest('.challenge-card[data-chal-id]');
        if (!card) return;
        e.preventDefault();
        var id = card.dataset.chalId;
        var all = state.active.concat(state.completed);
        for (var i = 0; i < all.length; i++) {
          if (all[i].id === id) { openModal(all[i]); return; }
        }
      }
    });
  }

  function init() {
    bind();

    // Ensure GeoChallenges is ready before starting
    function tryStart() {
      if (!window.GeoChallenges) {
        window.addEventListener('GeoChallengesReady', tryStart, { once: true });
        return;
      }
      start();
    }

    // Wait for Firebase Auth to restore the session before calling start().
    // firebase-config.js is a type="module" script; auth.currentUser is null
    // until onAuthStateChanged fires even when the user is signed in.
    // Without this wait, listenUserChallenges sees uid()===null, skips the
    // challengeProgress onSnapshot, and progress never reaches the UI.
    function hookAuth(gf) {
      if (!gf || !gf.authFns || !gf.authFns.onAuthStateChanged) { tryStart(); return; }
      var unsub = gf.authFns.onAuthStateChanged(gf.auth, function () {
        unsub(); // one-shot: only need the initial auth state
        tryStart();
      });
    }

    if (window.GeoFirebase) {
      hookAuth(window.GeoFirebase);
    } else {
      window.addEventListener('GeoFirebaseReady', function () { hookAuth(window.GeoFirebase); }, { once: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
