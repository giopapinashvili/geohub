/* GeoHub Push Notifications — Firebase Cloud Messaging (modular SDK) */
(function () {
  'use strict';

  var VAPID_KEY = 'BEOHtXTao7lj08Lkq6WMRzelk7GrGBCeYSO304UKw6bCd-NB1Y_kLe2U1MR2ArckX9IHI94wAULDZREoGBnudkQ';
  // sw.js handles both PWA cache and FCM background messages (single scope)
  var SW_PATH   = '/sw.js';

  var _messaging          = null;
  var _initialized        = false;
  var _foregroundUnsub    = null;

  var DEFAULT_PREFS = {
    messages:        true,
    likes:           true,
    comments:        true,
    follows:         true,
    event_reminders: true
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  function supported() {
    return 'Notification' in window &&
           'serviceWorker' in navigator &&
           'PushManager' in window;
  }

  function currentUser() {
    return window.GeoFirebase &&
           window.GeoFirebase.auth &&
           window.GeoFirebase.auth.currentUser || null;
  }

  function db()    { return window.GeoFirebase && window.GeoFirebase.db; }
  function fsApi() { return window.GeoFirebase && window.GeoFirebase.fs; }

  function storageGet(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : v; } catch(e) { return fallback; }
  }
  function storageSet(key, val) { try { localStorage.setItem(key, val); } catch(e) {} }
  function storageDel(key)      { try { localStorage.removeItem(key);   } catch(e) {} }

  // ── Firestore token operations ─────────────────────────────────────────────
  // Firestore path: users/{uid}/fcmTokens/{token} — 4 segments (even = document ref)
  function tokenRef(token) {
    var u = currentUser(); var d = db(); var fs = fsApi();
    if (!u || !d || !fs || !token) return null;
    return fs.doc(d, 'users', u.uid, 'fcmTokens', token);
  }

  function saveFCMToken(token) {
    var ref = tokenRef(token); var fs = fsApi();
    if (!ref || !fs) return Promise.resolve();
    return fs.setDoc(ref, {
      token:       token,
      platform:    'web',
      userAgent:   (navigator.userAgent || '').slice(0, 200),
      createdAt:   fs.serverTimestamp(),
      lastUsedAt:  fs.serverTimestamp()
    }, { merge: true }).catch(function () {});
  }

  function removeFCMToken(token) {
    var ref = tokenRef(token); var fs = fsApi();
    if (!ref || !fs) return Promise.resolve();
    return fs.deleteDoc(ref).catch(function () {});
  }

  function refreshTokenTimestamp(token) {
    var ref = tokenRef(token); var fs = fsApi();
    if (!ref || !fs) return;
    fs.updateDoc(ref, { lastUsedAt: fs.serverTimestamp() }).catch(function () {});
  }

  // ── Firebase Messaging (lazy import) ───────────────────────────────────────
  function loadFCMModule() {
    return import('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js');
  }

  function getMessagingInstance() {
    if (_messaging) return Promise.resolve(_messaging);
    var fb = window.GeoFirebase;
    if (!fb || !fb.app) return Promise.resolve(null);
    // Reuse instance already created in firebase-config.js
    if (fb.messaging) { _messaging = fb.messaging; return Promise.resolve(_messaging); }
    return loadFCMModule().then(function (m) {
      return m.isSupported();
    }).then(function (ok) {
      if (!ok) return null;
      return loadFCMModule().then(function (m) {
        _messaging = m.getMessaging(window.GeoFirebase.app);
        return _messaging;
      });
    }).catch(function () { return null; });
  }

  // ── Foreground message listener ────────────────────────────────────────────
  function startForegroundListener(messaging) {
    if (_foregroundUnsub) { _foregroundUnsub(); _foregroundUnsub = null; }
    loadFCMModule().then(function (m) {
      _foregroundUnsub = m.onMessage(messaging, function (payload) {
        var n    = payload.notification || {};
        var data = payload.data        || {};
        var type = data.type           || 'general';
        var prefs = getNotificationPrefs();

        if (type === 'message'        && !prefs.messages)        return;
        if (type === 'like'           && !prefs.likes)           return;
        if (type === 'comment'        && !prefs.comments)        return;
        if (type === 'follow'         && !prefs.follows)         return;
        if (type === 'event_reminder' && !prefs.event_reminders) return;

        sendLocalNotification(n.title || 'GeoHub', n.body || '', {
          tag:  type + '-' + (data.targetId || String(Date.now())),
          data: Object.assign({ url: data.url || '/feed.html', type: type }, data)
        });
      });
    }).catch(function () {});
  }

  // ── Init (reuse existing SW from mobile-nav.js + start foreground listener) ─
  function init() {
    if (_initialized || !supported()) return Promise.resolve();
    _initialized = true;

    // mobile-nav.js already registers sw.js (which handles both cache + FCM).
    // We only wait for it to be ready — no duplicate registration.
    return navigator.serviceWorker.ready
      .then(function () { return getMessagingInstance(); })
      .then(function (messaging) {
        if (!messaging) return;
        startForegroundListener(messaging);

        // Refresh lastUsedAt for existing token
        var stored = storageGet('gh_push_token', '');
        if (stored && isPushEnabled()) refreshTokenTimestamp(stored);
      })
      .catch(function () {});
  }

  // ── Subscribe ──────────────────────────────────────────────────────────────
  function subscribeToPushNotifications() {
    if (!supported()) return Promise.resolve({ error: 'not-supported' });

    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') return { error: 'permission-denied' };

      return navigator.serviceWorker.ready
        .then(function (reg) {
          return getMessagingInstance().then(function (messaging) {
            if (!messaging) return { error: 'messaging-unavailable' };
            return loadFCMModule().then(function (m) {
              return m.getToken(messaging, {
                vapidKey:                  VAPID_KEY,
                serviceWorkerRegistration: reg
              });
            }).then(function (token) {
              if (!token) return { error: 'no-token' };
              storageSet('gh_push_enabled', '1');
              storageSet('gh_push_token',   token);
              return saveFCMToken(token).then(function () {
                startForegroundListener(messaging);
                return { token: token, success: true };
              });
            });
          });
        })
        .catch(function (err) {
          if (err && err.code === 'messaging/token-subscribe-failed') {
            var old = storageGet('gh_push_token', '');
            if (old) removeFCMToken(old);
          }
          return { error: (err && err.message) || 'subscribe-failed' };
        });
    });
  }

  // ── Unsubscribe ────────────────────────────────────────────────────────────
  function unsubscribeFromPushNotifications() {
    var token = storageGet('gh_push_token', '');
    var cleanup = token ? removeFCMToken(token) : Promise.resolve();

    return cleanup.then(function () {
      return getMessagingInstance();
    }).then(function (messaging) {
      if (!messaging) return;
      return loadFCMModule().then(function (m) {
        return m.deleteToken(messaging).catch(function () {});
      });
    }).then(function () {
      storageDel('gh_push_enabled');
      storageDel('gh_push_token');
    }).catch(function () {
      storageDel('gh_push_enabled');
      storageDel('gh_push_token');
    });
  }

  // ── Local notification (foreground) ───────────────────────────────────────
  function sendLocalNotification(title, body, options) {
    if (!supported() || Notification.permission !== 'granted') return;
    navigator.serviceWorker.ready.then(function (reg) {
      reg.showNotification(title || 'GeoHub', Object.assign({
        body:    body  || '',
        icon:    '/icons/icon-192.png',
        badge:   '/icons/icon-72.png',
        vibrate: [200, 100, 200]
      }, options || {}));
    }).catch(function () {});
  }

  // ── Preferences ───────────────────────────────────────────────────────────
  function getNotificationPrefs() {
    try {
      return Object.assign({}, DEFAULT_PREFS,
        JSON.parse(storageGet('gh_notif_prefs', '{}') || '{}'));
    } catch (e) { return Object.assign({}, DEFAULT_PREFS); }
  }

  function saveNotificationPrefs(prefs) {
    storageSet('gh_notif_prefs', JSON.stringify(
      Object.assign({}, DEFAULT_PREFS, prefs || {})));
  }

  function isPushEnabled() {
    return supported() &&
           Notification.permission === 'granted' &&
           !!storageGet('gh_push_enabled', '');
  }

  // ── Permission prompt modal (shown after user interaction) ─────────────────
  function showPermissionPrompt() {
    if (!supported())                           return;
    if (Notification.permission === 'denied')   return;
    if (isPushEnabled())                        return;
    if (!currentUser())                         return;
    if (document.getElementById('ghPushPrompt')) return;

    var m = document.createElement('div');
    m.id = 'ghPushPrompt';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-label', 'Enable notifications');
    m.style.cssText = [
      'position:fixed', 'bottom:80px', 'left:50%',
      'transform:translateX(-50%) translateY(120px)',
      'z-index:10000',
      'background:var(--bg-card,#1a2234)',
      'border:1px solid var(--border,rgba(255,255,255,.1))',
      'border-radius:16px', 'padding:18px 20px',
      'max-width:370px', 'width:calc(100vw - 40px)',
      'box-shadow:0 24px 64px rgba(0,0,0,.55)',
      'transition:transform .38s cubic-bezier(.34,1.56,.64,1),opacity .3s',
      'opacity:0'
    ].join(';');

    m.innerHTML = [
      '<div style="display:flex;align-items:flex-start;gap:12px">',
        '<div style="background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;',
             'padding:9px 10px;flex-shrink:0;margin-top:2px">',
          '<i class="fas fa-bell" style="color:#fff;font-size:1rem"></i>',
        '</div>',
        '<div style="flex:1;min-width:0">',
          '<strong style="color:var(--text-primary,#e2e8f0);display:block;margin-bottom:4px;font-size:.95rem">',
            'Stay in the loop',
          '</strong>',
          '<p style="color:var(--text-muted,#94a3b8);font-size:.82rem;margin:0 0 12px;line-height:1.5">',
            'Get notified about new messages, likes, comments and events.',
          '</p>',
          '<div style="display:flex;gap:8px">',
            '<button id="ghPushAllow" style="flex:1;padding:7px 12px;background:linear-gradient(135deg,#10b981,#059669);',
                'color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:.82rem">',
              'Enable',
            '</button>',
            '<button id="ghPushLater" style="padding:7px 12px;background:transparent;',
                'color:var(--text-muted,#94a3b8);border:1px solid var(--border,rgba(255,255,255,.12));',
                'border-radius:8px;cursor:pointer;font-size:.82rem">',
              'Not now',
            '</button>',
          '</div>',
        '</div>',
        '<button id="ghPushClose" style="background:none;border:none;',
            'color:var(--text-muted,#94a3b8);cursor:pointer;padding:0;font-size:.9rem;flex-shrink:0;line-height:1">',
          '<i class="fas fa-times"></i>',
        '</button>',
      '</div>'
    ].join('');

    document.body.appendChild(m);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        m.style.transform = 'translateX(-50%) translateY(0)';
        m.style.opacity   = '1';
      });
    });

    function dismiss(snooze) {
      m.style.transform = 'translateX(-50%) translateY(120px)';
      m.style.opacity   = '0';
      setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 380);
      if (snooze === 'dismiss') storageSet('gh_push_prompt_dismissed', String(Date.now()));
      if (snooze === 'later')   storageSet('gh_push_prompt_snoozed',   String(Date.now()));
    }

    document.getElementById('ghPushClose').onclick  = function () { dismiss('dismiss'); };
    document.getElementById('ghPushLater').onclick  = function () { dismiss('later'); };
    document.getElementById('ghPushAllow').onclick  = function () {
      dismiss();
      var btn = document.getElementById('ghPushAllow');
      if (btn) { btn.disabled = true; btn.textContent = '…'; }
      subscribeToPushNotifications().then(function (result) {
        if (result && result.success) {
          sendLocalNotification(
            '🔔 Notifications enabled!',
            "You'll now receive updates from GeoHub.",
            { tag: 'gh-welcome' }
          );
        }
      });
    };
  }

  // ── Auto-prompt logic (after interaction, not on load) ─────────────────────
  function maybePromptLater() {
    if (!supported() || isPushEnabled() || !currentUser()) return;
    if (Notification.permission === 'denied') return;

    var dismissed = Number(storageGet('gh_push_prompt_dismissed', '0') || '0');
    if (dismissed && Date.now() - dismissed < 7 * 24 * 60 * 60 * 1000) return;

    var snoozed = Number(storageGet('gh_push_prompt_snoozed', '0') || '0');
    if (snoozed && Date.now() - snoozed < 24 * 60 * 60 * 1000) return;

    var shown = false;
    function onInteraction() {
      if (shown) return;
      shown = true;
      document.removeEventListener('click',  onInteraction);
      document.removeEventListener('scroll', onInteraction);
      setTimeout(showPermissionPrompt, 30000);
    }

    document.addEventListener('click',  onInteraction, { passive: true, once: true });
    document.addEventListener('scroll', onInteraction, { passive: true, once: true });
  }

  // ── Notification settings HTML (injected into settings modal) ─────────────
  function buildSettingsHTML() {
    var enabled = isPushEnabled();
    var prefs   = getNotificationPrefs();
    var cats = [
      { key: 'messages',        icon: 'fa-comment-dots',  label: 'Messages'       },
      { key: 'likes',           icon: 'fa-heart',         label: 'Likes'          },
      { key: 'comments',        icon: 'fa-comments',      label: 'Comments'       },
      { key: 'follows',         icon: 'fa-user-plus',     label: 'New followers'  },
      { key: 'event_reminders', icon: 'fa-calendar-check',label: 'Event reminders'}
    ];

    var denied = supported() && Notification.permission === 'denied';

    return [
      '<div id="ghNotifSettings" style="margin-top:16px">',
        '<div style="display:flex;align-items:center;justify-content:space-between;',
             'padding:10px 0;border-top:1px solid var(--border,rgba(255,255,255,.08))">',
          '<div style="display:flex;align-items:center;gap:8px">',
            '<i class="fas fa-bell" style="color:#10b981;font-size:.9rem"></i>',
            '<strong style="font-size:.9rem">Push Notifications</strong>',
          '</div>',
          denied
            ? '<span style="color:#ef4444;font-size:.78rem">Blocked in browser settings</span>'
            : '<label style="position:relative;display:inline-block;width:42px;height:22px;cursor:pointer">',
                '<input type="checkbox" id="ghNotifToggle" style="opacity:0;width:0;height:0" ' + (enabled ? 'checked' : '') + '>',
                '<span id="ghNotifSlider" style="position:absolute;inset:0;background:' + (enabled ? '#10b981' : 'rgba(255,255,255,.15)') + ';',
                     'border-radius:22px;transition:background .25s">',
                  '<span style="position:absolute;top:3px;left:' + (enabled ? '22px' : '3px') + ';',
                       'width:16px;height:16px;background:#fff;border-radius:50%;',
                       'transition:left .25s;box-shadow:0 1px 4px rgba(0,0,0,.3)" id="ghNotifThumb"></span>',
                '</span>',
              '</label>',
        '</div>',
        supported() && !denied
          ? '<div id="ghNotifCats" style="' + (enabled ? '' : 'display:none;') + 'padding-bottom:8px">' +
              cats.map(function (c) {
                var on = !!prefs[c.key];
                return [
                  '<label style="display:flex;align-items:center;justify-content:space-between;',
                         'padding:6px 0;cursor:pointer">',
                    '<span style="display:flex;align-items:center;gap:8px;color:var(--text-muted,#94a3b8);font-size:.85rem">',
                      '<i class="fas ' + c.icon + '" style="width:14px;text-align:center"></i>',
                      c.label,
                    '</span>',
                    '<input type="checkbox" data-notif-cat="' + c.key + '"',
                           ' style="width:15px;height:15px;accent-color:#10b981;cursor:pointer"',
                           (on ? ' checked' : '') + '>',
                  '</label>'
                ].join('');
              }).join('') +
            '</div>'
          : '',
      '</div>'
    ].join('');
  }

  function bindSettingsEvents() {
    var toggle = document.getElementById('ghNotifToggle');
    if (!toggle) return;

    toggle.addEventListener('change', function () {
      var slider = document.getElementById('ghNotifSlider');
      var thumb  = document.getElementById('ghNotifThumb');
      var cats   = document.getElementById('ghNotifCats');

      if (toggle.checked) {
        if (slider) slider.style.background = '#10b981';
        if (thumb)  thumb.style.left        = '22px';
        subscribeToPushNotifications().then(function (result) {
          if (!result || result.error) {
            toggle.checked = false;
            if (slider) slider.style.background = 'rgba(255,255,255,.15)';
            if (thumb)  thumb.style.left        = '3px';
            if (cats)   cats.style.display      = 'none';
          } else {
            if (cats) cats.style.display = '';
          }
        });
      } else {
        if (slider) slider.style.background = 'rgba(255,255,255,.15)';
        if (thumb)  thumb.style.left        = '3px';
        if (cats)   cats.style.display      = 'none';
        unsubscribeFromPushNotifications();
      }
    });

    document.querySelectorAll('[data-notif-cat]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var prefs = getNotificationPrefs();
        prefs[cb.dataset.notifCat] = cb.checked;
        saveNotificationPrefs(prefs);
      });
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.GeoPush = {
    init:                             init,
    subscribeToPushNotifications:     subscribeToPushNotifications,
    unsubscribeFromPushNotifications: unsubscribeFromPushNotifications,
    saveFCMToken:                     saveFCMToken,
    sendLocalNotification:            sendLocalNotification,
    showPermissionPrompt:             showPermissionPrompt,
    getNotificationPrefs:             getNotificationPrefs,
    saveNotificationPrefs:            saveNotificationPrefs,
    isPushEnabled:                    isPushEnabled,
    isSupported:                      supported,
    buildSettingsHTML:                buildSettingsHTML,
    bindSettingsEvents:               bindSettingsEvents
  };

  // ── Boot ───────────────────────────────────────────────────────────────────
  function boot() {
    init().catch(function () {});
    // Prompt shown only after user auth + interaction
    window.addEventListener('GeoAuthReady', function (e) {
      if (e.detail) maybePromptLater();
    });
  }

  if (window.GeoFirebase) boot();
  else window.addEventListener('GeoFirebaseReady', boot, { once: true });
})();
