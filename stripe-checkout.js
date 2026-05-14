/* GeoHub Stripe Checkout — frontend module */
(function () {
  'use strict';

  function workerUrl() {
    return (window.GeoConfig && window.GeoConfig.PAYMENTS && window.GeoConfig.PAYMENTS.WORKER_URL) ||
           'https://geohub-payments.YOUR-SUBDOMAIN.workers.dev';
  }

  function getAuth()  { return window.GeoFirebase && window.GeoFirebase.auth; }
  function getUser()  { var a = getAuth(); return a && a.currentUser || null; }

  function getIdToken() {
    var user = getUser();
    if (!user) return Promise.resolve(null);
    return user.getIdToken(false); // false = don't force refresh
  }

  function showToast(msg, type) {
    if (window.GeoSocial && window.GeoSocial.toast) { window.GeoSocial.toast(msg, type); return; }
    alert(msg);
  }

  function setBtn(btn, html, disabled) {
    if (!btn) return;
    btn.disabled = !!disabled;
    if (html !== undefined) btn.innerHTML = html;
  }

  // ── Core request ──────────────────────────────────────────────────────────

  async function createSession(type, payload, btn, originalLabel) {
    if (!getUser()) { window.location.href = 'auth.html'; return; }

    setBtn(btn, '<i class="fas fa-spinner fa-spin"></i> Processing…', true);

    try {
      var idToken = await getIdToken();
      if (!idToken) throw new Error('Could not get auth token. Please log in again.');

      var res = await fetch(workerUrl() + '/create-checkout-session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(Object.assign({ type, userId: getUser().uid, idToken }, payload)),
      });

      var data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Payment service error');

      // Redirect to Stripe Checkout
      window.location.href = data.url;

    } catch (err) {
      setBtn(btn, originalLabel, false);
      showToast(err.message || 'Payment failed. Please try again.', 'error');
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * buyEventTicket(eventId, quantity, button)
   * Called from event card "Buy Ticket" button.
   */
  function buyEventTicket(eventId, quantity, btn) {
    var label = btn ? btn.innerHTML : '<i class="fas fa-ticket"></i> Buy Ticket';
    return createSession('event_ticket', { eventId: eventId, quantity: quantity || 1 }, btn, label);
  }

  /**
   * upgradeBusinessPremium(businessId, plan, button)
   * Called from business dashboard "Upgrade" button.
   * plan: 'premium_monthly' | 'premium_yearly'
   */
  function upgradeBusinessPremium(businessId, plan, btn) {
    var label = btn ? btn.innerHTML : '<i class="fas fa-crown"></i> Upgrade to Premium';
    return createSession('business_subscription', { businessId: businessId, plan: plan || 'premium_monthly' }, btn, label);
  }

  // ── Poll payment status ────────────────────────────────────────────────────

  /**
   * pollPaymentStatus(sessionId, onResult, maxAttempts)
   * Polls the worker until status != 'pending' or maxAttempts is reached.
   * onResult(result) is called with the final status object.
   */
  function pollPaymentStatus(sessionId, onResult, maxAttempts) {
    var attempts = 0;
    var max      = maxAttempts || 20; // 20 × 3s = 60s max
    var delay    = 3000;

    function poll() {
      attempts++;
      fetch(workerUrl() + '/payment-status/' + encodeURIComponent(sessionId))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.status === 'pending' && attempts < max) {
            setTimeout(poll, delay);
          } else {
            if (typeof onResult === 'function') onResult(data);
          }
        })
        .catch(function () {
          if (attempts < max) setTimeout(poll, delay);
          else if (typeof onResult === 'function') onResult({ status: 'error' });
        });
    }

    poll();
  }

  window.GeoCheckout = {
    buyEventTicket:         buyEventTicket,
    upgradeBusinessPremium: upgradeBusinessPremium,
    pollPaymentStatus:      pollPaymentStatus,
  };
})();
