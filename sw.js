const CACHE_NAME = 'suivi-heures-v1';
const ASSETS = [
  'index.html',
  'styles.css',
  'main.min.css',
  'main.min.js',
  'script.js',
  'manifest.json',
  // ajoutez ici d'autres pages ou ressources (images, icônes…)
];

// Installation : on met en cache tous les assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activation : purge les anciens caches s'il y en a
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Interception des requêtes : on sert d'abord depuis le cache
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
