/* GeoHub service worker (v2).
 *
 * Replaces the old caching worker, which served stale pages and scripts.
 * This one caches nothing: on activation it deletes every cache the old
 * worker created and takes control of open tabs. It keeps web-push working
 * for existing subscriptions (FCM delivers to this same registration).
 */
'use strict';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
    // Tabs still running the old multi-page site listen for this message
    // and reload — which brings them into the new app.
    const tabs = await self.clients.matchAll({ type: 'window' });
    tabs.forEach((tab) => tab.postMessage({ type: 'SW_UPDATED' }));
  })());
});

const ICON = '/icons/icon-192.png';
const BADGE = '/icons/icon-96.png';

function targetUrl(data) {
  if (data && data.url) return data.url;
  if (data && data.link) return data.link;
  if (data && data.type === 'message') return '/messages';
  if (data && data.type === 'call') return '/messages';
  return '/notifications';
}

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = { notification: { body: event.data && event.data.text() } }; }
  const n = payload.notification || {};
  const data = payload.data || {};
  const title = n.title || data.title || 'GeoHub';
  event.waitUntil(self.registration.showNotification(title, {
    body: n.body || data.body || '',
    icon: n.icon || ICON,
    badge: BADGE,
    tag: data.tag || data.type || undefined,
    renotify: !!data.tag,
    data: { url: targetUrl(data) },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const tab of tabs) {
      if (new URL(tab.url).origin === self.location.origin) {
        await tab.focus();
        return tab.navigate(url);
      }
    }
    return self.clients.openWindow(url);
  })());
});
