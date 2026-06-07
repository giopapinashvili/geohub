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
  event_reminder: '/events.html',
  incoming_call:  '/messages.html',
};

const TYPE_ICONS = {
  message:        '💬',
  like:           '❤️',
  comment:        '💭',
  follow:         '👤',
  event_reminder: '🎉',
  incoming_call:  '📞',
};

messaging.onBackgroundMessage(function (payload) {
  var n    = payload.notification || {};
  var data = payload.data        || {};
  var type = data.type           || 'general';

  if (type === 'incoming_call') {
    var callId  = data.callId || '';
    var callUrl = data.url || ('/messages.html?call=' + callId);
    return self.registration.showNotification(
      n.title || ('📞 ' + (data.callerName || 'GeoHub') + ' გირეკავს'),
      {
        body:               n.body || (data.callType === 'video' ? '🎥 ვიდეო ზარი' : '📞 ხმოვანი ზარი'),
        icon:               data.callerAvatar || '/icons/icon-192.png',
        badge:              '/icons/icon-72.png',
        tag:                'incoming-call-' + callId,
        requireInteraction: true,
        renotify:           true,
        vibrate:            [300, 200, 300, 200, 300],
        data:               { url: callUrl, callId: callId, type: 'incoming_call' },
        actions: [
          { action: 'answer',  title: '📞 პასუხი' },
          { action: 'decline', title: '❌ უარი' },
        ],
      }
    );
  }

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
  var notifData = event.notification.data || {};

  // Decline action: just dismiss notification, call will timeout on caller side
  if (event.action === 'dismiss' || event.action === 'decline') return;

  // For incoming call answer action, always open the call URL
  var url = notifData.url || '/feed.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      var base = url.split('?')[0];
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && c.url.includes(base) && 'focus' in c) {
          c.focus();
          // For incoming calls, navigate existing tab to the call URL
          if (notifData.type === 'incoming_call' && c.navigate) {
            c.navigate(url);
          }
          return;
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
