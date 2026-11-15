/* KDSP application shell — JSON data are versioned in IndexedDB, not here. */
const CACHE_NAME = 'jp-learning-shell-v13-stage5-account-progress';
const CACHE_PREFIX = 'jp-learning-shell-';
const ESSENTIAL = [
  './', './index.html', './courses.html', './admin.html', './course-admin.html',
  './styles.css', './course-learning.css', './course-admin.css',
  './config.js', './manifest.webmanifest',
  './js/store.js', './js/db.js', './js/app.js', './js/admin.js',
  './js/course-admin.js', './js/course-content.js', './js/course-progress.js', './js/course-player.js'
];
const OPTIONAL = ['./icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const SCOPE = new URL(self.registration.scope);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Every core asset is required; only optional icons may fail without blocking install.
    await Promise.all(ESSENTIAL.map(async (file) => {
      const response = await fetch(new URL(file, SCOPE), { cache: 'reload' });
      if (!response.ok) throw new Error('Shell asset unavailable: ' + file);
      await cache.put(new URL(file, SCOPE).toString(), response);
    }));
    await Promise.allSettled(OPTIONAL.map(async (file) => {
      const response = await fetch(new URL(file, SCOPE), { cache: 'reload' });
      if (response.ok) await cache.put(new URL(file, SCOPE).toString(), response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const relative = url.pathname.slice(SCOPE.pathname.length);
  // Do not return shell HTML for JSON, and do not duplicate bank data in CacheStorage.
  if (relative.startsWith('content/') || relative.endsWith('.json')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (_) {
        const cached = await caches.match(request, { ignoreSearch: true });
        return cached || new Response('Trang này chưa được lưu để sử dụng ngoại tuyến.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      return new Response('Tài nguyên chưa được lưu trên thiết bị.', { status: 503 });
    }
  })());
});
