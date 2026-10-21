/* Retire earlier offline editions; online.js never registers this worker. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    await self.clients.claim();
    var names = await caches.keys();
    await Promise.all(names.filter(function (name) { return /^rockvm(?:-|$)/.test(name); }).map(function (name) { return caches.delete(name); }));
    await self.registration.unregister();
  })());
});
