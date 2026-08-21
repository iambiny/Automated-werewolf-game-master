const CACHE_VERSION = 'werewolf-shell-v1';
const SHELL = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/werewolf.svg',
  '/icons/werewolf-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      await cache.addAll(SHELL.filter((url) => url !== '/'));
      const response = await fetch('/');
      await cache.put('/', response.clone());
      const html = await response.text();
      const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
        .map((match) => match[1])
        .filter((url) => url?.startsWith('/_next/static/'));
      await Promise.allSettled(assets.map((url) => cache.add(url)));
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (
    event.request.method !== 'GET' ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(
          () =>
            cached ??
            (event.request.mode === 'navigate'
              ? caches.match('/offline.html')
              : Response.error()),
        );
      return cached ?? network;
    }),
  );
});
