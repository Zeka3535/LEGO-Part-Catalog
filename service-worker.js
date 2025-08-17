
const CACHE_NAME = 'lego-catalog-cache-v1';
const API_HOST = 'rebrickable.com';
const IMG_HOSTS = ['cdn.rebrickable.com', 'm.rebrickable.com'];

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './site.webmanifest',
    './apple-touch-icon.png',
    './favicon-32x32.png',
    './favicon-16x16.png',
    './favicon.ico',
    './android-chrome-192x192.png',
    './android-chrome-512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Opened cache');
            return cache.addAll(PRECACHE_ASSETS);
        })
        .then(() => {
            console.log('All precache assets added to cache');
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Игнорировать запросы браузера при принудительном обновлении, чтобы избежать ошибок
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
        return;
    }

    if (url.hostname === API_HOST) {
        event.respondWith(networkFallingBackToCache(event.request));
    } else if (IMG_HOSTS.includes(url.hostname)) {
        event.respondWith(cacheFirst(event.request));
    } else {
        event.respondWith(
            caches.match(event.request)
            .then(cachedResponse => {
                return cachedResponse || fetch(event.request);
            })
        );
    }
});

function cacheFirst(request) {
    return caches.match(request).then(response => {
        // Если ответ есть в кэше, возвращаем его
        if (response) {
            return response;
        }
        // Иначе, делаем запрос к сети
        return fetch(request).then(networkResponse => {
            // Если ответ успешный, кэшируем его
            if (networkResponse.ok) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseToCache);
                });
            }
            return networkResponse;
        });
    });
}

function networkFallingBackToCache(request) {
    // Сначала пытаемся получить данные из сети
    return fetch(request)
        .then(networkResponse => {
            // Если запрос успешен, обновляем кэш и возвращаем ответ
            if (networkResponse.ok) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseToCache);
                });
            }
            return networkResponse;
        })
        .catch(() => {
            // Если запрос к сети не удался (офлайн, ошибка CORS и т.д.),
            // пытаемся найти ответ в кэше.
            return caches.match(request);
        });
}
