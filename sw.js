const CACHE_NAME = 'pms-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// Cài đặt Service Worker và lưu Cache các file tĩnh
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Chặn các request để kiểm tra xem có trong cache chưa
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Trả về file từ cache nếu có (giúp load nhanh hơn và chạy được một phần khi offline)
        if (response) {
          return response;
        }
        // Nếu không có trong cache thì tải bình thường từ internet
        return fetch(event.request);
      })
  );
});

// Cập nhật Service Worker khi có phiên bản mới
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});