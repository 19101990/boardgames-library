const SHELL_CACHE = 'boardgames-library-shell-v2';
const IMAGE_CACHE = 'boardgames-library-images-v1';
const APP_SHELL = [
  '/',
  '/offline.html',
  '/offline-game.html',
  '/offline-game.js',
  '/favicon.svg',
  '/favicon-16.png',
  '/favicon-32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
];
const MAX_CACHED_IMAGES = 100;
const MAX_CACHED_ASSETS = 150;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith('boardgames-library-') &&
                cacheName !== SHELL_CACHE &&
                cacheName !== IMAGE_CACHE
            )
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function putInBoundedCache(cache, request, response, maxEntries) {
  if (!response.ok && response.type !== 'opaque') return;

  try {
    await cache.put(request, response.clone());
    const requests = await cache.keys();
    if (requests.length > maxEntries) {
      const protectedEntries = new Set(APP_SHELL.map((path) => new URL(path, self.location.origin).href));
      const removable = requests.filter((item) => !protectedEntries.has(item.url));
      const excess = requests.length - maxEntries;
      await Promise.all(removable.slice(0, excess).map((item) => cache.delete(item)));
    }
  } catch (error) {
    console.error('Could not cache a resource for offline use:', error);
  }
}

async function networkFirst(request, fallbackRequest) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await putInBoundedCache(cache, request, response, MAX_CACHED_ASSETS);
    }
    return response;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    if (request.mode === 'navigate' && /^\/games\/[^/]+\/?$/.test(new URL(request.url).pathname)) {
      const offlineGamePage = await caches.match('/offline-game.html');
      if (offlineGamePage) return offlineGamePage;
    }

    if (fallbackRequest) {
      const fallbackResponse = await caches.match(fallbackRequest);
      if (fallbackResponse) return fallbackResponse;
    }

    return new Response('Offline content is not available on this device yet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function findCachedOptimizedImage(sourceUrl) {
  const cache = await caches.open(SHELL_CACHE);
  const requests = await cache.keys();

  for (const request of requests) {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname !== '/_next/image' || requestUrl.searchParams.get('url') !== sourceUrl) {
      continue;
    }

    const response = await cache.match(request);
    if (response) return response;
  }

  return null;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);

  if (request.mode === 'navigate' && requestUrl.origin === self.location.origin) {
    event.respondWith(networkFirst(request, '/offline.html'));
    return;
  }

  if (requestUrl.origin === self.location.origin && request.headers.get('RSC') === '1') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    requestUrl.origin === self.location.origin &&
    (requestUrl.pathname.startsWith('/_next/static/') ||
      requestUrl.pathname === '/offline-game.js' ||
      request.destination === 'image')
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;

        const response = await fetch(request);
        await putInBoundedCache(cache, request, response, MAX_CACHED_ASSETS);
        return response;
      })()
    );
    return;
  }

  if (
    requestUrl.origin === 'https://cf.geekdo-images.com' &&
    request.destination === 'image'
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE);
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;

        try {
          const response = await fetch(request);
          await putInBoundedCache(cache, request, response, MAX_CACHED_IMAGES);
          return response;
        } catch {
          const optimizedImage = await findCachedOptimizedImage(request.url);
          return (
            optimizedImage ??
            new Response('', {
              status: 504,
              statusText: 'Image unavailable offline',
            })
          );
        }
      })()
    );
  }
});
