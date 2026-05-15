/* GeoHub Rewards Store */
(function () {
  'use strict';

  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var compact = function (v) {
    v = Number(v || 0);
    return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : String(v);
  };
  var toMs = function (v) {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    return Date.parse(v) || 0;
  };

  var state = {
    fbUser: null,
    balance: 0,
    rewards: [],
    userRewards: {},
    filter: 'all',
    dailyTransferred: 0
  };

  var _unsubRewards = null;
  var _unsubBalance = null;

  function $ (id) { return document.getElementById(id); }

  /* ── Toast ───────────────────────────────────────────────────── */
  function toast(msg, type) {
    var el = $('rwToast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'rw-toast' + (type === 'error' ? ' rw-toast-error' : '');
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(60px)';
    }, 2800);
  }

  /* ── Firebase helpers ────────────────────────────────────────── */
  function whenFirebase(cb) {
    if (window.GeoFirebase) return cb(window.GeoFirebase);
    window.addEventListener('GeoFirebaseReady', function () { cb(window.GeoFirebase); }, { once: true });
  }

  function onAuthReady(GF, cb) {
    if (!GF || !GF.auth) return cb(null);
    if (GF.authFns && GF.authFns.onAuthStateChanged) {
      var unsub = GF.authFns.onAuthStateChanged(GF.auth, function (u) {
        unsub();
        cb(u);
      });
      return;
    }
    cb(GF.auth.currentUser || null);
  }

  /* ── Balance ─────────────────────────────────────────────────── */
  function loadUserBalance(GF) {
    var uid = state.fbUser.uid;
    _unsubBalance = GF.fs.onSnapshot(
      GF.fs.doc(GF.db, 'users', uid),
      function (snap) {
        var d = snap.data() || {};
        state.balance = Number(d.pointsBalance || d.geoPointsBalance || 0);
        renderBalanceUI();
        loadDailyTransferred(GF);
      },
      function (err) { console.warn('[Rewards] balance', err.message); }
    );
  }

  function loadDailyTransferred(GF) {
    var uid = state.fbUser.uid;
    var todayStr = new Date().toISOString().slice(0, 10);
    GF.fs.getDoc(GF.fs.doc(GF.db, 'dailyTransferTotals', uid + '_' + todayStr))
      .then(function (snap) {
        state.dailyTransferred = snap.exists() ? Number((snap.data() || {}).total || 0) : 0;
        renderBalanceUI();
      }).catch(function () { state.dailyTransferred = 0; });
  }

  function renderBalanceUI() {
    var el = $('rwBalance');
    if (el) el.textContent = compact(state.balance) + ' pts';
    var sub = $('rwBalanceSub');
    if (sub) {
      var remaining = Math.max(0, 2000 - state.dailyTransferred);
      sub.innerHTML = 'Loyalty balance &nbsp;·&nbsp; <strong>' + compact(remaining) + ' pts</strong> transfer limit remaining today';
    }
  }

  /* ── Rewards ─────────────────────────────────────────────────── */
  function loadRewards(GF) {
    var q = GF.fs.query(
      GF.fs.collection(GF.db, 'rewards'),
      GF.fs.where('active', '==', true),
      GF.fs.limit(100)
    );
    function onSnap(snap) {
      state.rewards = [];
      snap.forEach(function (d) { state.rewards.push(Object.assign({ id: d.id }, d.data())); });
      state.rewards.sort(function (a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); });
      renderRewards();
    }
    _unsubRewards = GF.fs.onSnapshot(q, onSnap, function (err) {
      console.warn('[Rewards] load', err.message);
      GF.fs.getDocs(q).then(onSnap).catch(function () { renderRewards(); });
    });
  }

  function loadUserRewards(GF) {
    if (!state.fbUser) return;
    var uid = state.fbUser.uid;
    GF.fs.getDocs(
      GF.fs.query(GF.fs.collection(GF.db, 'userRewards'), GF.fs.where('userId', '==', uid), GF.fs.limit(500))
    ).then(function (snap) {
      var map = {};
      snap.forEach(function (d) {
        var rid = d.data().rewardId;
        if (rid) map[rid] = (map[rid] || 0) + 1;
      });
      state.userRewards = map;
      renderRewards();
    }).catch(function (err) { console.warn('[Rewards] userRewards', err.message); });
  }

  /* ── Render ──────────────────────────────────────────────────── */
  var CAT_ICONS = {
    food_drink: 'fa-utensils', food: 'fa-utensils', drink: 'fa-coffee',
    experience: 'fa-star', shopping: 'fa-shopping-bag',
    entertainment: 'fa-film', travel: 'fa-plane', other: 'fa-gift'
  };

  function filteredRewards() {
    if (state.filter === 'all') return state.rewards;
    return state.rewards.filter(function (r) { return (r.category || 'other') === state.filter; });
  }

  function cardHtml(r) {
    var stock = r.stock != null ? Number(r.stock) : null;
    var unlimited = stock === null;
    var cost = Number(r.cost || r.pointsCost || 0);
    var icon = CAT_ICONS[r.category] || 'fa-gift';
    var canAfford = state.balance >= cost;
    var outOfStock = !unlimited && stock === 0;
    var claimed = (state.userRewards[r.id] || 0) > 0;

    var stockHtml = outOfStock
      ? '<span class="rw-oos">Out of stock</span>'
      : !unlimited && stock < 10
        ? '<span class="rw-low-stock">' + stock + ' left</span>'
        : unlimited ? '' : '<span>' + stock + ' available</span>';

    var imgHtml = r.imageUrl
      ? '<div class="rw-card-img"><img src="' + esc(r.imageUrl) + '" alt="' + esc(r.title || 'Reward') + '" loading="lazy"></div>'
      : '<div class="rw-card-img rw-card-img-placeholder"><i class="fas ' + icon + '"></i></div>';

    var btnDisabled = !canAfford || outOfStock;
    var btnText = outOfStock
      ? 'Out of Stock'
      : !canAfford
        ? 'Need ' + compact(cost - state.balance) + ' more pts'
        : 'Redeem';

    return '<div class="rw-card' + (outOfStock ? ' rw-card-oos' : '') + '" data-reward-id="' + esc(r.id) + '">' +
      imgHtml +
      '<div class="rw-card-body">' +
        '<div class="rw-card-cat"><i class="fas ' + icon + '"></i> ' + esc(r.category || 'reward') + '</div>' +
        '<h3 class="rw-card-title">' + esc(r.title || 'Reward') + '</h3>' +
        '<p class="rw-card-desc">' + esc(r.description || '') + '</p>' +
        '<div class="rw-card-footer">' +
          '<div class="rw-card-cost"><i class="fas fa-coins"></i>' + compact(cost) + ' pts</div>' +
          '<div class="rw-card-stock">' + stockHtml + '</div>' +
        '</div>' +
        (claimed ? '<div class="rw-claimed-badge"><i class="fas fa-check"></i> Claimed before</div>' : '') +
        '<button class="rw-btn-redeem' + (btnDisabled ? ' disabled' : '') + '" data-redeem="' + esc(r.id) + '"' + (btnDisabled ? ' disabled' : '') + '>' + btnText + '</button>' +
      '</div>' +
    '</div>';
  }

  function renderRewards() {
    var grid = $('rwGrid');
    if (!grid) return;
    var rows = filteredRewards();
    if (!rows.length) {
      grid.innerHTML = '<div class="rw-empty"><i class="fas fa-gift"></i><h3>No rewards in this category</h3><p>New rewards are added regularly. Check back soon.</p></div>';
      return;
    }
    grid.innerHTML = rows.map(cardHtml).join('');
  }

  /* ── Redeem modal ────────────────────────────────────────────── */
  function openRedeemModal(rewardId) {
    var r = null;
    for (var i = 0; i < state.rewards.length; i++) {
      if (state.rewards[i].id === rewardId) { r = state.rewards[i]; break; }
    }
    if (!r) return;

    var cost = Number(r.cost || r.pointsCost || 0);
    var stock = r.stock != null ? Number(r.stock) : null;
    var unlimited = stock === null;
    var outOfStock = !unlimited && stock === 0;
    var canAfford = state.balance >= cost;

    var existing = document.getElementById('redeemModal');
    if (existing) existing.remove();

    var el = document.createElement('div');
    el.id = 'redeemModal';
    el.className = 'rw-modal-overlay';
    el.innerHTML =
      '<div class="rw-modal" role="dialog" aria-modal="true">' +
        '<div class="rw-modal-head">' +
          '<h3>Confirm Redemption</h3>' +
          '<button class="rw-modal-close" id="redeemClose"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="rw-modal-body">' +
          '<div class="rw-modal-reward-name">' + esc(r.title || 'Reward') + '</div>' +
          '<p class="rw-modal-desc">' + esc(r.description || '') + '</p>' +
          '<div class="rw-modal-cost-row"><span>Cost</span><strong><i class="fas fa-coins"></i>' + compact(cost) + ' pts</strong></div>' +
          '<div class="rw-modal-balance-row"><span>Your balance</span><strong>' + compact(state.balance) + ' → ' + compact(state.balance - cost) + ' pts</strong></div>' +
          (r.termsNote ? '<p class="rw-modal-terms">' + esc(r.termsNote) + '</p>' : '') +
        '</div>' +
        '<div class="rw-modal-actions">' +
          '<button class="rw-btn-ghost" id="redeemCancel">Cancel</button>' +
          '<button class="rw-btn-primary' + ((!canAfford || outOfStock) ? ' disabled' : '') + '" id="redeemConfirm"' + ((!canAfford || outOfStock) ? ' disabled' : '') + '><i class="fas fa-check"></i> Confirm Redeem</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    el.addEventListener('click', function (e) { if (e.target === el) el.remove(); });
    document.getElementById('redeemClose').onclick = function () { el.remove(); };
    document.getElementById('redeemCancel').onclick = function () { el.remove(); };
    document.getElementById('redeemConfirm').onclick = function () { executeRedeem(rewardId, el); };
  }

  function executeRedeem(rewardId, modalEl) {
    var GF = window.GeoFirebase;
    if (!GF || !state.fbUser) return;

    var btn = document.getElementById('redeemConfirm');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…'; }

    var requestId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    GF.httpsCallable(GF.functions, 'redeemReward')({ rewardId: rewardId, requestId: requestId })
      .then(function () {
        if (modalEl) modalEl.remove();
        toast('Reward redeemed! Check your profile wallet for details.');
        loadUserRewards(GF);
      }).catch(function (err) {
        console.error('[Rewards] redeem', err);
        var msg = (err.message || '').replace(/^Firebase:\s*/i, '').replace(/\s*\(functions\/[^)]+\)\.?$/, '');
        toast(msg || 'Redemption failed. Please try again.', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirm Redeem'; }
      });
  }

  /* ── Transfer modal ──────────────────────────────────────────── */
  function openTransferModal() {
    var existing = document.getElementById('transferModal');
    if (existing) existing.remove();

    var remaining = Math.max(0, 2000 - state.dailyTransferred);

    var el = document.createElement('div');
    el.id = 'transferModal';
    el.className = 'rw-modal-overlay';
    el.innerHTML =
      '<div class="rw-modal" role="dialog" aria-modal="true">' +
        '<div class="rw-modal-head">' +
          '<h3><i class="fas fa-paper-plane"></i> Send GeoPoints</h3>' +
          '<button class="rw-modal-close" id="transferClose"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="rw-modal-body">' +
          '<p class="rw-modal-note"><i class="fas fa-info-circle"></i> GeoPoints are not money and cannot be withdrawn or exchanged for cash.</p>' +
          '<label class="rw-label">Recipient (username or user ID)' +
            '<input class="rw-input" id="transferTo" placeholder="@username or user ID" autocomplete="off">' +
          '</label>' +
          '<label class="rw-label">Amount (10 – 500 pts per transfer)' +
            '<input class="rw-input" id="transferAmt" type="number" min="10" max="500" placeholder="e.g. 100">' +
          '</label>' +
          '<label class="rw-label">Message (optional)' +
            '<input class="rw-input" id="transferMsg" placeholder="A short note…" maxlength="100">' +
          '</label>' +
          '<div class="rw-modal-balance-row"><span>Your balance</span><strong>' + compact(state.balance) + ' pts</strong></div>' +
          '<div class="rw-modal-balance-row"><span>Daily limit remaining</span><strong>' + compact(remaining) + ' pts</strong></div>' +
        '</div>' +
        '<div class="rw-modal-actions">' +
          '<button class="rw-btn-ghost" id="transferCancel">Cancel</button>' +
          '<button class="rw-btn-primary" id="transferConfirm"><i class="fas fa-paper-plane"></i> Send Points</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    el.addEventListener('click', function (e) { if (e.target === el) el.remove(); });
    document.getElementById('transferClose').onclick = function () { el.remove(); };
    document.getElementById('transferCancel').onclick = function () { el.remove(); };
    document.getElementById('transferConfirm').onclick = function () { executeTransfer(el); };
  }

  function executeTransfer(modalEl) {
    var GF = window.GeoFirebase;
    if (!GF || !state.fbUser) return;

    var toInput = ((document.getElementById('transferTo') || {}).value || '').trim();
    var amtRaw = parseInt(((document.getElementById('transferAmt') || {}).value || '0'), 10);
    var message = ((document.getElementById('transferMsg') || {}).value || '').trim();

    if (!toInput) { toast('Please enter a recipient', 'error'); return; }
    if (isNaN(amtRaw) || amtRaw < 10 || amtRaw > 500) { toast('Amount must be between 10 and 500', 'error'); return; }
    if (state.balance < amtRaw) { toast('Insufficient balance (' + state.balance + ' pts)', 'error'); return; }
    if (state.dailyTransferred + amtRaw > 2000) {
      toast('Daily transfer limit (2000 pts) reached. Try again tomorrow.', 'error'); return;
    }

    var btn = document.getElementById('transferConfirm');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…'; }

    var f = GF.fs, db = GF.db;
    var uid = state.fbUser.uid;

    function doTransfer(recipientUid) {
      if (recipientUid === uid) {
        toast('You cannot send points to yourself', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Points'; }
        return;
      }

      var requestId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      GF.httpsCallable(GF.functions, 'transferPoints')({
        toUserId: recipientUid,
        amount: amtRaw,
        message: message || null,
        requestId: requestId
      }).then(function () {
        state.dailyTransferred += amtRaw;
        if (modalEl) modalEl.remove();
        toast('Sent ' + amtRaw + ' pts successfully!');
      }).catch(function (err) {
        console.error('[Rewards] transfer', err);
        var msg = (err.message || '').replace(/^Firebase:\s*/i, '').replace(/\s*\(functions\/[^)]+\)\.?$/, '');
        toast(msg || 'Transfer failed. Please try again.', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Points'; }
      });
    }

    // Resolve username → UID if needed
    var looksLikeUid = /^[a-zA-Z0-9]{20,}$/.test(toInput);
    if (looksLikeUid) {
      doTransfer(toInput);
    } else {
      var username = toInput.replace(/^@/, '');
      f.getDocs(f.query(f.collection(db, 'users'), f.where('username', '==', username), f.limit(1)))
        .then(function (snap) {
          if (snap.empty) {
            toast('User not found: @' + username, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Points'; }
            return;
          }
          doTransfer(snap.docs[0].id);
        }).catch(function (err) {
          toast('Could not find user: ' + (err.message || 'unknown error'), 'error');
          if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Points'; }
        });
    }
  }

  /* ── Event bindings ──────────────────────────────────────────── */
  function bind() {
    document.addEventListener('click', function (e) {
      var filterBtn = e.target.closest('[data-rw-filter]');
      if (filterBtn) {
        state.filter = filterBtn.dataset.rwFilter;
        document.querySelectorAll('[data-rw-filter]').forEach(function (b) {
          b.classList.toggle('active', b.dataset.rwFilter === state.filter);
        });
        renderRewards();
        return;
      }

      var redeemBtn = e.target.closest('[data-redeem]');
      if (redeemBtn && !redeemBtn.disabled) {
        openRedeemModal(redeemBtn.dataset.redeem);
        return;
      }

      var sendBtn = e.target.closest('[data-send-points]');
      if (sendBtn) {
        openTransferModal();
        return;
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var m = document.getElementById('redeemModal') || document.getElementById('transferModal');
        if (m) m.remove();
      }
    });

    // Pre-fill recipient from URL param ?to=uid
    var params = new URLSearchParams(location.search);
    var toParam = params.get('to');
    if (toParam) {
      // Delay until balance loaded, then auto-open transfer modal
      setTimeout(function () {
        openTransferModal();
        setTimeout(function () {
          var inp = document.getElementById('transferTo');
          if (inp) inp.value = toParam;
        }, 50);
      }, 600);
    }
  }

  /* ── Init ────────────────────────────────────────────────────── */
  function init() {
    bind();
    whenFirebase(function (GF) {
      if (!GF || !GF.auth || !GF.db || !GF.fs) {
        location.replace('auth.html?next=rewards.html');
        return;
      }
      onAuthReady(GF, function (fbUser) {
        if (!fbUser) {
          location.replace('auth.html?next=rewards.html');
          return;
        }
        state.fbUser = fbUser;
        loadUserBalance(GF);
        loadRewards(GF);
        loadUserRewards(GF);
      });
    });
  }

  window.addEventListener('pagehide', function () {
    if (_unsubRewards) { try { _unsubRewards(); } catch (e) {} _unsubRewards = null; }
    if (_unsubBalance) { try { _unsubBalance(); } catch (e) {} _unsubBalance = null; }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
