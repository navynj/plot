/* Deliberately dumb service worker: its only job is meeting install criteria.
 * NO caching — not of API responses, not of auth, not of pages. Every fetch
 * without a respondWith falls through to the network untouched. Offline
 * support is an explicit non-goal until real use demands it. */
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', () => {
  // pass-through: no respondWith → default network handling
});
