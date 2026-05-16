/* GeoHub — Firebase Cloud Messaging Service Worker */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBFjplTgrv7SGLagXzppoUXmSp60PMO_HI',
  authDomain: 'geohub-main.firebaseapp.com',
  projectId: 'geohub-main',
  messagingSenderId: '18115935679',
  appId: '1:18115935679:web:b17b3f3814256cd97e750a'
});

const messaging = firebase.messaging();

const TYPE_URLS = {
  message:        '/messages.html',
  like:           '/feed.html',
  comment:        '/feed.html',
  follow:         '/profile.html',
  event_reminder: '/events.html'
};

const TYPE_ICONS = {
  message:        '💬',
  like:           '❤️',
  comment:        '💭',
  follow:         '👤',
  event_reminder: '🎉'
};

messaging.onBackgroundMessage(function (payload) {
  var n    = payload.notification || {};
  var data = payload.data        || {};
  var type = data.type           || 'general';
  var url  = data.url            || TYPE_URLS[type] || '/feed.html';
  var icon = TYPE_ICONS[type]    || '';

  return self.registration.showNotification(
    (icon ? icon + ' ' : '') + (n.title || 'GeoHub'),
    {
      body:      n.body || '',
      icon:      '/icons/icon-192.png',
      badge:     '/icons/icon-72.png',
      tag:       type + '-' + (data.targetId || String(Date.now())),
      renotify:  true,
      vibrate:   [200, 100, 200],
      data:      Object.assign({ url: url, type: type }, data),
      actions:   type === 'message'
        ? [{ action: 'open', title: 'Open chat' }, { action: 'dismiss', title: 'Dismiss' }]
        : [{ action: 'open', title: 'View' }]
    }
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.action === 'dismiss') return;

  var url = (event.notification.data && event.notification.data.url) || '/feed.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && c.url.includes(url.split('?')[0]) && 'focus' in c) {
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('pushsubscriptionchange', function (event) {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription
      ? { userVisibleOnly: true, applicationServerKey: event.oldSubscription.options.applicationServerKey }
      : { userVisibleOnly: true }
    ).catch(function () {})
  );
});
