// Minimal service worker — its presence (with a fetch handler) is what makes
// the app installable on Android Chrome. Network pass-through, no offline cache,
// so there's no risk of serving stale content.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
