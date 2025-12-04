const CACHE_NAME = 'lego-catalog-cache-v97';
const VERSION_INFO = {
    version: 'v97',
    buildDate: '04.12.2025',
    buildTimestamp: new Date('2025-12-04').getTime()
};

// Keep precache minimal to avoid install failures due to missing files
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './site.webmanifest',
    './apple-touch-icon.png',
    './favicon-32x32.png',
    './favicon-16x16.png',
    './favicon.ico',
    './android-chrome-192x192.png',
    './android-chrome-512x512.png',
    './ogimage.png'
];

// CSV-файлы не добавляем в precache: кэшируем по первому запросу (SWR)
const CSV_ASSETS = [
    './Data/colors.csv',
    './Data/parts.csv',
    './Data/sets.csv',
    './Data/minifigs.csv',
    './Data/elements.csv',
    './Data/inventories.csv',
    './Data/inventory_minifigs.csv',
    // inventory_parts.csv split files will be discovered dynamically in install step
    './Data/inventory_sets.csv',
    './Data/part_categories.csv',
    './Data/part_relationships.csv',
    './Data/themes.csv'
];

// Изображения минифигов кэшируем по запросу, не в precache
const MINIFIG_IMAGES = [];
for (let i = 1; i <= 28; i++) {
    MINIFIG_IMAGES.push(`./Minifig_png/fig-${i}.png`);
}

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE_NAME);
            const assets = [...PRECACHE_ASSETS];
            await Promise.allSettled(assets.map(url => cache.add(url).catch(() => null)));
        } finally {
            await self.skipWaiting();
        }
    })());
});

// Включаем Navigation Preload для быстрой навигации
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            // Очистка старых кэшей
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Полностью отключаем Navigation Preload для лучшей оффлайн работы
            self.registration.navigationPreload.disable().catch(() => {
                // Игнорируем ошибки отключения preload
            })
        ]).then(() => self.clients.claim())
    );
});


// Максимальный размер кэша для изображений (примерно 50MB)
const MAX_IMAGE_CACHE_SIZE = 50 * 1024 * 1024;
// Максимальное количество изображений в кэше
const MAX_IMAGE_CACHE_COUNT = 500;

// Функция для проверки и очистки кэша изображений
async function maintainImageCache() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        
        // Фильтруем только изображения
        const imageKeys = keys.filter(key => {
            const url = key.url;
            return url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i) || 
                   url.includes('/media/parts/') ||
                   url.includes('/elements/');
        });
        
        // Если превышен лимит, удаляем старые изображения
        if (imageKeys.length > MAX_IMAGE_CACHE_COUNT) {
            const toDelete = imageKeys.slice(0, imageKeys.length - MAX_IMAGE_CACHE_COUNT);
            await Promise.all(toDelete.map(key => cache.delete(key)));
        }
    } catch (error) {
        // Игнорируем ошибки очистки кэша
    }
}

// Cache-first strategy for static assets
function cacheFirst(request) {
    return caches.match(request).then(response => {
        if (response) {
            return response;
        }
        return fetch(request).then(networkResponse => {
            // Кэшируем только успешные ответы, не кэшируем opaque responses для экономии места
            if (networkResponse.ok && networkResponse.type !== 'opaque') {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseToCache).catch(() => {});
                    // Периодически очищаем кэш изображений
                    if (Math.random() < 0.1) { // 10% вероятность очистки при каждом запросе
                        maintainImageCache();
                    }
                });
            }
            return networkResponse;
        });
    });
}

// Network-first strategy for API requests with better error handling
function networkFirst(request) {
    return fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseToCache).catch(() => {});
            });
        }
        return networkResponse;
    }).catch(() => {
        return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            // Return a custom error response if nothing in cache
            return new Response(JSON.stringify({
                error: 'Network request failed and no cached response available',
                url: request.url
            }), {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            });
        });
    });
}

// Stale-while-revalidate strategy for frequently changing data
function staleWhileRevalidate(request) {
    return caches.match(request).then(cachedResponse => {
        const fetchPromise = fetch(request).then(networkResponse => {
            if (networkResponse.ok) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseToCache).catch(() => {});
                });
            }
            return networkResponse;
        }).catch(() => {
            // If fetch fails, we still have the cached response
            return cachedResponse;
        });

        return cachedResponse || fetchPromise;
    });
}

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const urlString = event.request.url;
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Обработка навигационных запросов с приоритетом кэша для оффлайн работы
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // Сначала проверяем кэш
                    const cachedResponse = await caches.match(event.request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    // Если в кэше нет, пробуем сеть
                    try {
                        const networkResponse = await fetch(event.request);
                        if (networkResponse.ok) {
                            // Кэшируем успешный ответ
                            const responseToCache = networkResponse.clone();
                            const cache = await caches.open(CACHE_NAME);
                            await cache.put(event.request, responseToCache);
                        }
                        return networkResponse;
                    } catch (networkError) {
                        // Если сеть недоступна, возвращаем index.html как fallback
                        const fallbackResponse = await caches.match('./index.html');
                        if (fallbackResponse) {
                            return fallbackResponse;
                        }
                        
                        // Если даже fallback нет, возвращаем базовый HTML
                        return new Response(`
                            <!DOCTYPE html>
                            <html>
                            <head><title>LEGO Catalog - Оффлайн</title></head>
                            <body>
                                <h1>LEGO Catalog</h1>
                                <p>Приложение работает в оффлайн режиме. Пожалуйста, подключитесь к интернету для полной функциональности.</p>
                            </body>
                            </html>
                        `, {
                            headers: { 'Content-Type': 'text/html' }
                        });
                    }
                } catch (error) {
                    console.error('Service Worker navigation error:', error);
                    // Возвращаем базовый HTML в случае любой ошибки
                    return new Response(`
                        <!DOCTYPE html>
                        <html>
                        <head><title>LEGO Catalog - Ошибка</title></head>
                        <body>
                            <h1>LEGO Catalog</h1>
                            <p>Произошла ошибка при загрузке приложения.</p>
                        </body>
                        </html>
                    `, {
                        headers: { 'Content-Type': 'text/html' }
                    });
                }
            })()
        );
        return;
    }
    
    // Helpers to detect Rebrickable API calls even when proxied
    const isRebrickableApi = url.hostname === 'rebrickable.com' || urlString.includes('rebrickable.com/api/');
    const isColorsEndpoint = isRebrickableApi && urlString.includes('/api/v3/lego/colors');
    const isInventoryEndpoint = isRebrickableApi && (
        (urlString.includes('/api/v3/lego/sets/') && urlString.includes('/parts')) ||
        (urlString.includes('/api/v3/lego/minifigs/') && urlString.includes('/parts'))
    );

    // Prefer SWR for relatively static API endpoints (colors, inventories)
    if (isColorsEndpoint || isInventoryEndpoint) {
        event.respondWith(staleWhileRevalidate(event.request));
        return;
    }

    // Handle different types of requests
    if (url.pathname.includes('/api/') || 
        url.pathname.includes('/sets/') || 
        url.pathname.includes('/parts/') || 
        url.pathname.includes('/minifigs/') ||
        url.hostname === 'rebrickable.com' ||
        isRebrickableApi) {
        // API requests: network first with fallback to cache
        event.respondWith(networkFirst(event.request));
    } else if ((url.pathname.includes('/Data/') || url.pathname.includes('/dist/Downloads/') || url.pathname.includes('/Downloads/')) && url.pathname.endsWith('.csv')) {
        // CSV data files: stale-while-revalidate for better performance
        event.respondWith(staleWhileRevalidate(event.request));
    } else if (url.pathname.includes('/Minifig_png/')) {
        // Minifig images: cache first with aggressive caching and high priority
        event.respondWith(cacheFirst(event.request));
    } else if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
        // Other images: cache first with aggressive caching
        event.respondWith(cacheFirst(event.request));
    } else if (url.pathname.match(/\.(css|js|html)$/)) {
        // Static assets: cache first
        event.respondWith(cacheFirst(event.request));
    } else if (url.hostname === 'cdn.rebrickable.com') {
        // External images: cache first with network fallback, но не кэшируем photos (слишком много)
        if (url.pathname.includes('/photos/')) {
            // Для photos используем network-first, чтобы не забивать кэш
            event.respondWith(networkFirst(event.request));
        } else {
            event.respondWith(cacheFirst(event.request));
        }
    } else {
        // Default: network first
        event.respondWith(networkFirst(event.request));
    }
});


// Handle messages from main thread
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Handle service worker updates
self.addEventListener('controllerchange', () => {
    // Notify all clients to reload
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({ type: 'RELOAD_PAGE' });
        });
    });
});

// Function to force refresh minifig images cache
async function refreshMinifigCache() {
    try {
        const cache = await caches.open(CACHE_NAME);
        // Remove old minifig images from cache
        const oldMinifigKeys = await cache.keys();
        const minifigKeys = oldMinifigKeys.filter(key => key.url.includes('/Minifig_png/'));
        await Promise.all(minifigKeys.map(key => cache.delete(key)));
        
        // Add new minifig images to cache
        const minifigPromises = MINIFIG_IMAGES.map(url => 
            fetch(url).then(response => {
                if (response.ok) {
                    return cache.put(url, response);
                }
            }).catch(() => null)
        );
        await Promise.allSettled(minifigPromises);
    } catch (error) {
        // игнорируем ошибки обновления кэша минифигурок
    }
}

// Handle messages from main thread
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data && event.data.type === 'REFRESH_MINIFIG_CACHE') {
        // Force refresh minifig images cache
        refreshMinifigCache();
    } else if (event.data && event.data.type === 'REFRESH_CSV_CACHE') {
        // Принудительное обновление CSV в кэше
        refreshCsvCache();
    } else if (event.data && event.data.type === 'REFRESH_API_CACHE') {
        // Принудительное обновление кэша API (цвета и инвентари)
        refreshApiCache();
    } else if (event.data && event.data.type === 'GET_VERSION_INFO') {
        // Отправляем информацию о версии обратно в основной поток
        event.ports[0].postMessage({
            type: 'VERSION_INFO_RESPONSE',
            data: VERSION_INFO
        });
    }
});

// Принудительное обновление CSV-файлов в кэше
async function refreshCsvCache() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        const csvKeys = keys.filter(k => /\.csv($|\?)/i.test(new URL(k.url).pathname));
        await Promise.allSettled(csvKeys.map(async (request) => {
            try {
                const res = await fetch(request, { cache: 'no-store' });
                if (res && res.ok) {
                    await cache.put(request, res.clone());
                }
            } catch (e) {
                // игнорируем ошибки отдельных файлов
            }
        }));
    } catch (e) {
        // игнорируем любые ошибки обновления CSV
    }
}

// Принудительное обновление кэша API (цвета и инвентари)
async function refreshApiCache() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        const apiKeys = keys.filter(k => {
            const u = k.url;
            // Обновляем только Rebrickable API, включая проксированные запросы
            const isRebrickableApi = u.includes('rebrickable.com/api/');
            const isColors = isRebrickableApi && u.includes('/api/v3/lego/colors');
            const isInventory = isRebrickableApi && (
                (u.includes('/api/v3/lego/sets/') && u.includes('/parts')) ||
                (u.includes('/api/v3/lego/minifigs/') && u.includes('/parts'))
            );
            return isColors || isInventory;
        });
        await Promise.allSettled(apiKeys.map(async (request) => {
            try {
                const res = await fetch(request, { cache: 'no-store' });
                if (res && res.ok) {
                    await cache.put(request, res.clone());
                }
            } catch (_) {
                // игнорируем ошибки отдельных запросов API
            }
        }));
    } catch (_) {
        // игнорируем любые ошибки обновления API-кэша
    }
}