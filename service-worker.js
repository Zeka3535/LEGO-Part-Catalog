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

    if (url.hostname === API_HOST) {
        event.respondWith(staleWhileRevalidate(event.request));
    } else if (IMG_HOSTS.includes(url.hostname)) {
        event.respondWith(cacheFirst(event.request));
    } else {
        // Для оболочки приложения и других ресурсов используйте стратегию "сначала кэш".
        // Это более надежно, чем проверка путей, и работает с развертыванием в подкаталогах.
        event.respondWith(
            caches.match(event.request)
            .then(cachedResponse => {
                return cachedResponse || fetch(event.request);
            })
        );
    }
});

function cacheFirst(request) {
    return caches.match(request)
        .then(response => {
            if (response) {
                return response;
            }
            return fetch(request)
                .then(networkResponse => {
                    if (networkResponse.ok) {
                        return caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, networkResponse.clone());
                            return networkResponse;
                        });
                    }
                    return networkResponse;
                });
        })
        .catch(error => {
            console.error('Cache first fetch failed:', error);
            // Could return a fallback image here if needed
        });
}

function staleWhileRevalidate(request) {
    return caches.match(request)
        .then(cachedResponse => {
            const fetchPromise = fetch(request)
                .then(networkResponse => {
                    if (networkResponse.ok) {
                        return caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, networkResponse.clone());
                            return networkResponse;
                        });
                    }
                    return networkResponse;
                })
                .catch(error => {
                    console.error('Stale-while-revalidate fetch failed:', error);
                    // This error is caught, so we don't reject the promise.
                    // If there's a cached response, it will be used.
                    // If not, the original `caches.match` promise will resolve to `undefined`.
                });

            return cachedResponse || fetchPromise;
        });
}
