/* GeoHub Service Worker — v8
   Cache strategy matrix:
   ┌─────────────────────────────────────────────┬────────────────────────────┐
   │ Request type                                │ Strategy                   │
   ├─────────────────────────────────────────────┼────────────────────────────┤
   │ Firebase Auth / Firestore / FCM APIs        │ Network only (pass through)│
   │ CDN scripts (Font Awesome, Firebase SDK)    │ Cache first, 7-day max-age │
   │ Cloudinary images (avatars, uploads)        │ Cache first, 30-day max-age│
   │ Local images / icons / SVG                  │ Cache first, 30-day max-age│
   │ Local CSS / JS                              │ Stale-while-revalidate     │
   │ HTML pages (same origin)                    │ Network first → offline.html│
   │ manifest.json                               │ Stale-while-revalidate     │
   └─────────────────────────────────────────────┴────────────────────────────┘
*/

'use strict';

/* ── Firebase Cloud Messaging (must stay at top) ────────────────────────── */
try {
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey:            'AIzaSyBFjplTgrv7SGLagXzppoUXmSp60PMO_HI',
    authDomain:        'geohub-main.firebaseapp.com',
    projectId:         'geohub-main',
    messagingSenderId: '18115935679',
    appId:             '1:18115935679:web:b17b3f3814256cd97e750a'
  });
  var messaging = firebase.messaging();

  var NOTIF_TYPE_URLS = {
    message:        '/messages.html',
    like:           '/feed.html',
    comment:        '/feed.html',
    follow:         '/profile.html',
    friend_request: '/profile.html',
    event_reminder: '/events.html'
  };
  var NOTIF_TYPE_ICONS = { message:'💬', like:'❤️', comment:'💭', follow:'👤', friend_request:'🤝', event_reminder:'🎉' };

  messaging.onBackgroundMessage(function(payload) {
    var n    = payload.notification || {};
    var data = payload.data         || {};
    var type = data.type            || 'general';
    var url  = data.url || NOTIF_TYPE_URLS[type] || '/feed.html';
    var icon = NOTIF_TYPE_ICONS[type] || '';
    return self.registration.showNotification(
      (icon ? icon + ' ' : '') + (n.title || 'GeoHub'),
      {
        body:     n.body || '',
        icon:     '/icons/icon-192.png',
        badge:    '/icons/icon-96.png',
        tag:      type + '-' + (data.targetId || String(Date.now())),
        renotify: true,
        vibrate:  [200, 100, 200],
        data:     Object.assign({ url: url, type: type }, data),
        actions:  type === 'message'
          ? [{ action: 'open', title: 'Open chat' }, { action: 'dismiss', title: 'Dismiss' }]
          : [{ action: 'open', title: 'View' }]
      }
    );
  });
} catch (e) {
  console.warn('[SW] Firebase messaging unavailable:', e.message);
}

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  var url = (event.notification.data && event.notification.data.url) || '/feed.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && c.url.includes(url.split('?')[0]) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('pushsubscriptionchange', function(event) {
  event.waitUntil(
    self.registration.pushManager.subscribe(
      event.oldSubscription
        ? { userVisibleOnly: true, applicationServerKey: event.oldSubscription.options.applicationServerKey }
        : { userVisibleOnly: true }
    ).catch(function() {})
  );
});

/* ── Cache names ────────────────────────────────────────────────────────── */
var VER   = 'v8';
var SHELL = 'gh-shell-' + VER;
var IMG   = 'gh-img-'   + VER;
var CDN   = 'gh-cdn-'   + VER;
var ALL   = [SHELL, IMG, CDN];

/* ── App shell to precache on install ──────────────────────────────────── */
var SHELL_URLS = [
  '/offline.html',
  '/manifest.json',
  '/styles.css',
  '/navbar.css',
  '/geohub-social-redesign.css',
  '/responsive-polish.css',
  '/mobile-nav.css',
  '/safety.css',
  '/feed.html',
  '/marketplace.html',
  '/events.html',
  '/notifications.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-96.png',
];

/* ── Offline image placeholder ──────────────────────────────────────────── */
var IMG_PLACEHOLDER = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
  '<rect width="200" height="200" fill="#1a1f35"/>' +
  '<text x="100" y="115" text-anchor="middle" fill="#374151" font-size="52">📷</text></svg>';

/* ── INSTALL ─────────────────────────────────────────────────────────────── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(SHELL).then(function(cache) {
      return Promise.all(SHELL_URLS.map(function(url) {
        return cache.add(url).catch(function(err) {
          console.warn('[SW] Precache miss:', url, err && err.message);
        });
      }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── ACTIVATE: purge old caches, claim all clients ──────────────────────── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return ALL.indexOf(k) === -1; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return clients.claim();
    }).then(function() {
      return clients.matchAll({ type: 'window' }).then(function(tabs) {
        tabs.forEach(function(tab) {
          tab.postMessage({ type: 'SW_UPDATED', version: VER });
        });
      });
    })
  );
});

/* ── FETCH ───────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }

  if (!url.protocol.startsWith('http')) return;

  /* 1. Never intercept Firebase/Google API calls (auth, Firestore, etc.)
        These MUST reach the network — never serve stale auth or query results */
  if (isFirebaseAPI(url)) return;

  /* 2. CDN: Font Awesome, Firebase SDK, Google Fonts → Cache first */
  if (isCDN(url)) {
    event.respondWith(cacheFirst(req, CDN, 7 * 24 * 3600 * 1000));
    return;
  }

  /* 3. Cloudinary images (user avatars, post images) → Cache first */
  if (url.hostname.indexOf('res.cloudinary.com') !== -1) {
    event.respondWith(imageFirst(req));
    return;
  }

  /* 4. Local images & icons → Cache first */
  if (/\.(png|jpe?g|webp|gif|svg|ico)(\?|$)/i.test(url.pathname)) {
    event.respondWith(imageFirst(req));
    return;
  }

  /* 5. Local CSS & JS → Stale-while-revalidate */
  if (/\.(css|js)(\?|$)/i.test(url.pathname) && url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, SHELL));
    return;
  }

  /* 6. HTML pages (same origin) → Network first, offline fallback */
  var accept = req.headers.get('Accept') || '';
  if (url.origin === self.location.origin &&
      (accept.indexOf('text/html') !== -1 || url.pathname.endsWith('.html') || url.pathname === '/')) {
    event.respondWith(networkFirstHTML(req));
    return;
  }

  /* 7. Everything else → Network first, cache as backup */
  event.respondWith(networkFirst(req, SHELL));
});

/* ── URL CLASSIFIERS ─────────────────────────────────────────────────────── */
function isFirebaseAPI(url) {
  var h = url.hostname;
  return h === 'firestore.googleapis.com'       ||
         h === 'identitytoolkit.googleapis.com' ||
         h === 'securetoken.googleapis.com'     ||
         h === 'fcm.googleapis.com'             ||
         h === 'cloudmessaging.googleapis.com'  ||
         h.indexOf('.firebaseio.com')     !== -1 ||
         h.indexOf('.cloudfunctions.net') !== -1 ||
         h.indexOf('.firebaseapp.com')    !== -1 ||
         (h === 'firebase.googleapis.com');
}

function isCDN(url) {
  var h = url.hostname;
  return h === 'cdnjs.cloudflare.com'  ||
         h === 'fonts.googleapis.com'  ||
         h === 'fonts.gstatic.com'     ||
         h === 'www.gstatic.com'       ||
         h === 'unpkg.com';
}

/* ── STRATEGIES ──────────────────────────────────────────────────────────── */

/* Cache first: serve cached if fresh, else fetch + update, else cached stale */
function cacheFirst(req, cacheName, maxAgeMs) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(req).then(function(cached) {
      if (cached && maxAgeMs) {
        var date = cached.headers.get('date');
        if (!date || (Date.now() - new Date(date).getTime()) < maxAgeMs) {
          return cached;
        }
      } else if (cached) {
        return cached;
      }
      return fetchAndCache(req, cache, cached);
    });
  });
}

/* Image: cache forever, serve placeholder on total failure */
function imageFirst(req) {
  return caches.open(IMG).then(function(cache) {
    return cache.match(req).then(function(cached) {
      if (cached) return cached;
      return fetch(req).then(function(res) {
        if (res && res.status === 200) {
          cache.put(req, res.clone()).catch(function() {});
        }
        return res;
      }).catch(function() {
        return new Response(IMG_PLACEHOLDER, {
          headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' }
        });
      });
    });
  });
}

/* Stale-while-revalidate: return cache immediately, fetch in background */
function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(req).then(function(cached) {
      var networkFetch = fetch(req).then(function(res) {
        if (res && res.status === 200 && res.type === 'basic') {
          cache.put(req, res.clone()).catch(function() {});
        }
        return res;
      }).catch(function() { return null; });
      return cached || networkFetch;
    });
  });
}

/* Network first with cache fallback */
function networkFirst(req, cacheName) {
  return fetch(req).then(function(res) {
    if (res && res.status === 200) {
      caches.open(cacheName).then(function(c) { c.put(req, res.clone()).catch(function() {}); });
    }
    return res;
  }).catch(function() {
    return caches.match(req).then(function(cached) {
      return cached || new Response('Service unavailable', { status: 503 });
    });
  });
}

/* Network first for HTML — fall back to cached HTML, then /offline.html */
function networkFirstHTML(req) {
  return fetch(req).then(function(res) {
    if (res && res.status === 200) {
      caches.open(SHELL).then(function(c) { c.put(req, res.clone()).catch(function() {}); });
    }
    return res;
  }).catch(function() {
    return caches.match(req).then(function(cached) {
      if (cached) return cached;
      return caches.match('/offline.html').then(function(offlinePage) {
        return offlinePage || new Response(
          '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GeoHub — Offline</title></head>' +
          '<body style="background:#04050d;color:#94a3b8;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px">' +
          '<div><div style="font-size:3rem;margin-bottom:16px">📡</div>' +
          '<h2 style="color:#f0f4ff;margin:0 0 8px">You\'re offline</h2>' +
          '<p style="margin:0 0 24px">Check your connection and try again.</p>' +
          '<button onclick="location.reload()" style="background:#10b981;color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer">Try again</button>' +
          '</div></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      });
    });
  });
}

function fetchAndCache(req, cache, stale) {
  return fetch(req).then(function(res) {
    if (res && res.status === 200) {
      cache.put(req, res.clone()).catch(function() {});
    }
    return res;
  }).catch(function() {
    return stale || new Response('', { status: 503 });
  });
}

/* ── BACKGROUND SYNC groundwork ─────────────────────────────────────────── */
self.addEventListener('sync', function(event) {
  if (event.tag === 'gh-pending-sync') {
    event.waitUntil(processPendingSync());
  }
});

function processPendingSync() {
  /* Phase 70: drain localStorage pending-drafts queue when back online.
     Sends a message to active tab(s) so the app can re-attempt the post. */
  return clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(tabs) {
    tabs.forEach(function(tab) {
      tab.postMessage({ type: 'GH_SYNC_DRAFTS' });
    });
  });
}

/* ── PUSH fallback (Firebase handles it first via messaging.onBackgroundMessage) */
self.addEventListener('push', function(event) {
  if (typeof messaging !== 'undefined') return;
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'GeoHub', {
      body:  data.body || '',
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
    })
  );
});
