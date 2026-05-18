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
  var relTime = function (v) {
    var ms = toMs(v);
    if (!ms) return '';
    var diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(ms).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  };

  var state = {
    fbUser: null,
    wallet: { balance: 0, earned: 0, received: 0, sent: 0, spent: 0, redeemed: 0 },
    balance: 0,
    rewards: [],
    userRewards: {},
    filter: 'all',
    dailyTransferred: 0
  };

  var _unsubRewards    = null;
  var _unsubBalance    = null;
  var _unsubGifts      = null;
  var _unsubCoupons    = null;
  var _unsubBizCoupons = null;

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
    var GS = window.GeoSocial;
    if (GS && GS.listenWallet) {
      _unsubBalance = GS.listenWallet(uid, function (w) {
        state.wallet = w || state.wallet;
        state.balance = state.wallet.balance || 0;
        renderBalanceUI();
        loadDailyTransferred(GF);
      });
    } else {
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
      var w = state.wallet;
      var remaining = Math.max(0, 2000 - state.dailyTransferred);
      var parts = [];
      if ((w.earned || 0) > 0) parts.push('Earned: <strong>' + compact(w.earned) + '</strong>');
      if ((w.received || 0) > 0) parts.push('Received: <strong>' + compact(w.received) + '</strong>');
      if ((w.redeemed || 0) > 0) parts.push('Redeemed: <strong>' + compact(w.redeemed) + '</strong>');
      parts.push('Transfer limit: <strong>' + compact(remaining) + ' pts</strong> today');
      sub.innerHTML = parts.join(' &nbsp;·&nbsp; ');
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
    var stockRaw = r.stock != null ? Number(r.stock) : (r.quantityRemaining != null ? Number(r.quantityRemaining) : null);
    var unlimited = stockRaw === null;
    var cost = Number(r.cost || r.pointsCost || 0);
    var icon = CAT_ICONS[r.category] || 'fa-gift';
    var canAfford = state.balance >= cost;
    var outOfStock = !unlimited && stockRaw === 0;
    var expMs = toMs(r.expiresAt);
    var isExpired = expMs > 0 && expMs < Date.now();
    var isInactive = r.active === false;
    var unavailable = isExpired || isInactive;
    var claimed = (state.userRewards[r.id] || 0) > 0;
    var businessName = r.businessName || r.business || '';

    var stockHtml = outOfStock
      ? '<span class="rw-oos">Out of stock</span>'
      : !unlimited && stockRaw < 10
        ? '<span class="rw-low-stock">' + stockRaw + ' left</span>'
        : unlimited ? '' : '<span>' + stockRaw + ' available</span>';

    var imgHtml = r.imageUrl
      ? '<div class="rw-card-img"><img src="' + esc(r.imageUrl) + '" alt="' + esc(r.title || 'Reward') + '" loading="lazy" onerror="this.style.display=\'none\'"></div>'
      : '<div class="rw-card-img rw-card-img-placeholder"><i class="fas ' + icon + '"></i></div>';

    var btnDisabled = !canAfford || outOfStock || unavailable;
    var btnText = unavailable
      ? (isExpired ? 'Expired' : 'Unavailable')
      : outOfStock
        ? 'Out of Stock'
        : !canAfford
          ? 'Need ' + compact(cost - state.balance) + ' more pts'
          : 'Redeem';

    return '<div class="rw-card' + (outOfStock || unavailable ? ' rw-card-oos' : '') + '" data-reward-id="' + esc(r.id) + '">' +
      imgHtml +
      '<div class="rw-card-body">' +
        '<div class="rw-card-cat"><i class="fas ' + icon + '"></i> ' + esc(r.category || 'reward') + '</div>' +
        '<h3 class="rw-card-title">' + esc(r.title || 'Reward') + '</h3>' +
        (businessName ? '<div class="rw-card-biz"><i class="fas fa-store"></i> ' + (r.businessId ? '<a href="business.html?id=' + esc(r.businessId) + '" class="rw-biz-link">' + esc(businessName) + '</a>' : esc(businessName)) + '</div>' : '') +
        '<p class="rw-card-desc">' + esc(r.description || '') + '</p>' +
        (isExpired ? '<div class="rw-card-expired-badge"><i class="fas fa-clock"></i> Expired</div>' : '') +
        (isInactive && !isExpired ? '<div class="rw-card-expired-badge"><i class="fas fa-ban"></i> Unavailable</div>' : '') +
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
    var GS = window.GeoSocial;
    if (!GS || !GS.redeemReward) {
      toast('Redemption service unavailable. Please reload the page.', 'error');
      return;
    }
    if (!state.fbUser) return;

    var btn = document.getElementById('redeemConfirm');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…'; }

    GS.redeemReward(rewardId, function (ok, data) {
      if (ok) {
        if (modalEl) modalEl.remove();
        var code = (data && data.code) ? ' Code: ' + data.code : '';
        toast('Reward redeemed!' + code + ' Check My Coupons below.');
        loadUserRewards(window.GeoFirebase);
      } else {
        var errCode = data && data.message;
        if (errCode === 'not-active' || errCode === 'expired' || errCode === 'sold-out') {
          if (modalEl) modalEl.remove();
        } else {
          if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirm Redeem'; }
        }
      }
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
    var GS = window.GeoSocial;
    if (!GS || !GS.sendPoints) {
      toast('Transfer service unavailable. Please reload the page.', 'error');
      return;
    }
    if (!state.fbUser) return;

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

    GS.sendPoints(toInput, amtRaw, message || null, function (ok) {
      if (ok) {
        state.dailyTransferred += amtRaw;
        if (modalEl) modalEl.remove();
        toast('Sent ' + amtRaw + ' pts! Recipient must claim the gift.');
      } else {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Points'; }
      }
    });
  }

  /* ── Pending Gifts ───────────────────────────────────────────── */
  function loadPendingGifts() {
    var GS = window.GeoSocial;
    if (!GS || !GS.listenIncomingGifts || !state.fbUser) return;
    _unsubGifts = GS.listenIncomingGifts(state.fbUser.uid, function (gifts) {
      renderPendingGifts(gifts);
    });
  }

  function renderPendingGifts(gifts) {
    var panel = $('rwGiftsPanel');
    var list  = $('rwGiftsList');
    if (!panel || !list) return;
    if (!gifts || !gifts.length) {
      panel.style.display = 'none';
      list.innerHTML = '';
      return;
    }
    panel.style.display = '';
    list.innerHTML = gifts.map(function (g) {
      var from = esc(g.fromName || 'Someone');
      var amt  = compact(g.amount || 0);
      var msg  = g.message ? esc(g.message) : '';
      var ago  = relTime(g.createdAt);
      return '<div class="rw-gift-item">' +
        '<div class="rw-gift-icon"><i class="fas fa-coins"></i></div>' +
        '<div class="rw-gift-body">' +
          '<div class="rw-gift-from"><strong>' + from + '</strong> sent you <strong>' + amt + ' pts</strong></div>' +
          (msg ? '<div class="rw-gift-msg">' + msg + '</div>' : '') +
          (ago ? '<div class="rw-gift-meta">' + ago + '</div>' : '') +
        '</div>' +
        '<button class="rw-btn-claim" data-claim-gift="' + esc(g.id) + '"><i class="fas fa-hand-holding-heart"></i> Claim</button>' +
      '</div>';
    }).join('');
  }

  function claimGift(giftId, btn) {
    var GS = window.GeoSocial;
    if (!GS || !GS.claimPointGift) return;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    GS.claimPointGift(giftId, function (ok, err) {
      if (ok) {
        toast('GeoPoints claimed!');
      } else {
        var msg = (err && err.message) ? err.message : 'Could not claim gift';
        toast(msg, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-hand-holding-heart"></i> Claim'; }
      }
    });
  }

  /* ── My Coupons ──────────────────────────────────────────────── */
  function loadMyCoupons() {
    var GS = window.GeoSocial;
    if (!GS || !GS.listenMyCoupons || !state.fbUser) return;
    _unsubCoupons = GS.listenMyCoupons(state.fbUser.uid, function (coupons) {
      renderMyCoupons(coupons);
    });
  }

  function renderMyCoupons(coupons) {
    var panel = $('rwCouponsPanel');
    var list  = $('rwCouponsList');
    if (!panel || !list) return;
    if (!coupons || !coupons.length) {
      panel.style.display = 'none';
      list.innerHTML = '';
      return;
    }
    panel.style.display = '';
    list.innerHTML = coupons.map(function (c) {
      var title  = esc(c.rewardTitle || c.title || 'Reward');
      var code   = esc(c.code || '');
      var status = c.status || 'active';
      var ago    = relTime(c.createdAt);
      var expMs  = toMs(c.expiresAt);
      var expiry = expMs ? new Date(expMs).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      var statusBadge = status === 'used'
        ? '<span class="rw-coupon-status rw-coupon-used">Used</span>'
        : status === 'expired'
          ? '<span class="rw-coupon-status rw-coupon-expired">Expired</span>'
          : '<span class="rw-coupon-status rw-coupon-active">Active</span>';
      return '<div class="rw-coupon-item">' +
        '<div class="rw-coupon-left"><i class="fas fa-ticket-alt rw-coupon-icon"></i></div>' +
        '<div class="rw-coupon-body">' +
          '<div class="rw-coupon-title">' + title + '</div>' +
          '<div class="rw-coupon-code-row">' +
            '<span class="rw-coupon-code">' + code + '</span>' +
            (c.code ? '<button class="rw-btn-copy-code" data-copy-code="' + esc(c.code) + '" title="Copy code"><i class="fas fa-copy"></i></button>' : '') +
          '</div>' +
          (expiry ? '<div class="rw-coupon-meta">Expires ' + esc(expiry) + '</div>' : (ago ? '<div class="rw-coupon-meta">' + ago + '</div>' : '')) +
        '</div>' +
        statusBadge +
      '</div>';
    }).join('');
  }

  /* ── Business Coupons ───────────────────────────────────────── */
  function loadBusinessCoupons(GF) {
    if (!state.fbUser) return;
    var uid = state.fbUser.uid;
    var q = GF.fs.query(
      GF.fs.collection(GF.db, 'rewardCoupons'),
      GF.fs.where('businessOwnerId', '==', uid),
      GF.fs.limit(200)
    );
    _unsubBizCoupons = GF.fs.onSnapshot(q, function (snap) {
      var rows = [];
      snap.forEach(function (d) { rows.push(Object.assign({ id: d.id }, d.data())); });
      rows.sort(function (a, b) { return toMs(b.createdAt) - toMs(a.createdAt); });
      renderBusinessCoupons(rows);
    }, function (err) {
      console.warn('[Rewards] bizCoupons', err.message);
    });
  }

  function renderBusinessCoupons(coupons) {
    var panel = $('rwBizCouponsPanel');
    var list  = $('rwBizCouponsList');
    if (!panel || !list) return;
    if (!coupons || !coupons.length) {
      panel.style.display = 'none';
      list.innerHTML = '';
      return;
    }
    panel.style.display = '';
    list.innerHTML = coupons.map(function (c) {
      var title   = esc(c.rewardTitle || c.title || 'Reward');
      var code    = esc(c.code || '');
      var status  = c.status || 'active';
      var ago     = relTime(c.createdAt);
      var expMs   = toMs(c.expiresAt);
      var expiry  = expMs ? new Date(expMs).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      var usedMs  = toMs(c.usedAt);
      var usedAgo = usedMs ? relTime(c.usedAt) : '';
      var custId  = c.userId ? String(c.userId).slice(0, 10) + '…' : '';
      var statusBadge = status === 'used'
        ? '<span class="rw-coupon-status rw-coupon-used">Used</span>'
        : status === 'expired'
          ? '<span class="rw-coupon-status rw-coupon-expired">Expired</span>'
          : '<span class="rw-coupon-status rw-coupon-active">Active</span>';
      return '<div class="rw-biz-coupon-item">' +
        '<div class="rw-coupon-body">' +
          '<div class="rw-coupon-title">' + title + '</div>' +
          '<div class="rw-coupon-code-row">' +
            '<span class="rw-coupon-code">' + code + '</span>' +
            (c.code ? '<button class="rw-btn-copy-code" data-copy-code="' + esc(c.code) + '" title="Copy code"><i class="fas fa-copy"></i></button>' : '') +
          '</div>' +
          (custId ? '<div class="rw-coupon-meta"><i class="fas fa-user" style="font-size:.65rem;margin-right:4px"></i>Customer: ' + esc(custId) + '</div>' : '') +
          (usedAgo ? '<div class="rw-coupon-meta"><i class="fas fa-check-double" style="font-size:.65rem;margin-right:4px"></i>Used ' + usedAgo + '</div>' : '') +
          (expiry && status !== 'used' ? '<div class="rw-coupon-meta"><i class="fas fa-calendar" style="font-size:.65rem;margin-right:4px"></i>Exp ' + esc(expiry) + '</div>' : '') +
          (ago && !usedAgo ? '<div class="rw-coupon-meta">' + ago + '</div>' : '') +
        '</div>' +
        statusBadge +
        (status === 'active'
          ? '<button class="rw-btn-mark-used" data-coupon-id="' + esc(c.id) + '"><i class="fas fa-check-double"></i> Mark Used</button>'
          : '') +
      '</div>';
    }).join('');
  }

  function markCouponUsed(couponId, btn) {
    var GF = window.GeoFirebase;
    if (!GF || !GF.fs || !state.fbUser) return;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    GF.fs.updateDoc(GF.fs.doc(GF.db, 'rewardCoupons', couponId), {
      status: 'used',
      usedAt: GF.fs.serverTimestamp(),
      usedBy: state.fbUser.uid,
      updatedAt: GF.fs.serverTimestamp()
    }).then(function () {
      toast('Coupon marked as used.');
    }).catch(function (err) {
      console.warn('[Rewards] markCouponUsed', err.message);
      toast('Could not update coupon.', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-double"></i> Mark Used'; }
    });
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

      var claimBtn = e.target.closest('[data-claim-gift]');
      if (claimBtn) {
        claimGift(claimBtn.dataset.claimGift, claimBtn);
        return;
      }

      var copyBtn = e.target.closest('[data-copy-code]');
      if (copyBtn) {
        var copyCode = copyBtn.dataset.copyCode;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(copyCode).then(function () { toast('Code copied!'); }).catch(function () { toast('Code: ' + copyCode); });
        } else {
          toast('Code: ' + copyCode);
        }
        return;
      }

      var markUsedBtn = e.target.closest('.rw-btn-mark-used[data-coupon-id]');
      if (markUsedBtn) {
        markCouponUsed(markUsedBtn.dataset.couponId, markUsedBtn);
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
        loadPendingGifts();
        loadMyCoupons();
        loadBusinessCoupons(GF);
      });
    });
  }

  window.addEventListener('pagehide', function () {
    if (_unsubRewards)    { try { _unsubRewards();    } catch (e) {} _unsubRewards    = null; }
    if (_unsubBalance)    { try { _unsubBalance();    } catch (e) {} _unsubBalance    = null; }
    if (_unsubGifts)      { try { _unsubGifts();      } catch (e) {} _unsubGifts      = null; }
    if (_unsubCoupons)    { try { _unsubCoupons();    } catch (e) {} _unsubCoupons    = null; }
    if (_unsubBizCoupons) { try { _unsubBizCoupons(); } catch (e) {} _unsubBizCoupons = null; }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
