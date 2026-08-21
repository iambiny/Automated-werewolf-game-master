const CACHE_VERSION = 'werewolf-shell-v2';
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
  const url = new URL(event.request.url);
  const isStaticAsset = url.pathname.startsWith('/_next/static/');

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (isStaticAsset && cached) return cached;

      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return (
            (await caches.match('/')) ?? (await caches.match('/offline.html'))
          );
        }
        return Response.error();
      }
    })(),
  );
});
