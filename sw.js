const CACHE_NAME = 'anitox-cache';

// Install event
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

// Fetch event
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});