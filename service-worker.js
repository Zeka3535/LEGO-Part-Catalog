const CACHE_NAME = 'lego-catalog-cache-v90';
const VERSION_INFO = {
    version: 'v90',
    buildDate: '16.10.2025',
    buildTimestamp: new Date('2025-10-16').getTime()
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
    './ogimage.png',
    './widgets/stats-widget.html',
    './widgets/samsung-widget.html',
    './widgets/stats-widget-data.json',
    './widgets/widget-handler.js',
    './widgets/update-stats.html'
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


// Cache-first strategy for static assets
function cacheFirst(request) {
    return caches.match(request).then(response => {
        if (response) {
            return response;
        }
        return fetch(request).then(networkResponse => {
            // Cache all responses including opaque (cross-origin images)
            if (networkResponse.ok || networkResponse.type === 'opaque') {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseToCache).catch(() => {});
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

// Handle widget requests
async function handleWidgetRequest(request) {
    const url = new URL(request.url);
    
    // Handle widget data updates - перенаправляем на HTML файлы
    if (url.pathname === '/widgets/update-stats' && request.method === 'POST') {
        return fetch('./widgets/update-stats.html');
    }
    
    if (url.pathname === '/widgets/update-collection' && request.method === 'POST') {
        return fetch('./widgets/update-collection.html');
    }
    
    // Handle widget data files
    if (url.pathname.endsWith('.json')) {
        return cacheFirst(request);
    }
    
    // Handle widget HTML files
    if (url.pathname.endsWith('.html')) {
        return cacheFirst(request);
    }
    
    // Default to network first for other widget files
    return networkFirst(request);
}

// Handle stats widget update
async function handleStatsUpdate() {
    try {
        // Здесь можно добавить логику обновления статистики
        // Пока возвращаем успешный ответ
        return new Response(JSON.stringify({
            success: true,
            message: 'Статистика обновлена'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle collection widget update
async function handleCollectionUpdate() {
    try {
        // Здесь можно добавить логику обновления коллекции
        // Пока возвращаем успешный ответ
        return new Response(JSON.stringify({
            success: true,
            message: 'Коллекция обновлена'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
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
        // External images: cache first with network fallback
        event.respondWith(cacheFirst(event.request));
    } else if (url.pathname.startsWith('/widgets/')) {
        // Widget files: handle specially
        event.respondWith(handleWidgetRequest(event.request));
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