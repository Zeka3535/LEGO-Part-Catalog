const CACHE_NAME = 'lego-catalog-cache-v5';

// Keep precache minimal to avoid install failures due to missing files
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './index.css',
    './site.webmanifest',
    './apple-touch-icon.png',
    './favicon-32x32.png',
    './favicon-16x16.png',
    './favicon.ico',
    './android-chrome-192x192.png',
    './android-chrome-512x512.png',
    './ogimage.png'
];

// Add CSV data files to precache for offline functionality
const CSV_ASSETS = [
    './Data/colors.csv',
    './Data/parts.csv',
    './Data/sets.csv',
    './Data/minifigs.csv',
    './Data/elements.csv',
    './Data/inventories.csv',
    './Data/inventory_minifigs.csv',
    // inventory_parts.csv is now split into multiple files
    './Data/inventory_parts_split/inventory_parts_part_001.csv',
    './Data/inventory_parts_split/inventory_parts_part_002.csv',
    './Data/inventory_parts_split/inventory_parts_part_003.csv',
    './Data/inventory_parts_split/inventory_parts_part_004.csv',
    './Data/inventory_parts_split/inventory_parts_part_005.csv',
    './Data/inventory_parts_split/inventory_parts_part_006.csv',
    './Data/inventory_parts_split/inventory_parts_part_007.csv',
    './Data/inventory_sets.csv',
    './Data/part_categories.csv',
    './Data/part_relationships.csv',
    './Data/themes.csv'
];

self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Cache opened');
            // Add only existing files to avoid install failures
            const allAssets = [...PRECACHE_ASSETS, ...CSV_ASSETS];
            return Promise.allSettled(
                allAssets.map(url => 
                    cache.add(url).catch(err => {
                        console.warn(`Failed to cache ${url}:`, err);
                        return null;
                    })
                )
            );
        })
        .then(() => {
            console.log('Precache completed');
            return self.skipWaiting();
        })
        .catch(error => {
            console.error('Install failed:', error);
            // Continue anyway to avoid blocking
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker activated');
            return self.clients.claim();
        })
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
                    cache.put(request, responseToCache);
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
                cache.put(request, responseToCache);
            });
        }
        return networkResponse;
    }).catch(error => {
        console.warn('Network request failed, trying cache:', request.url, error);
        return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                console.log('Serving from cache:', request.url);
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
                    cache.put(request, responseToCache);
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
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Handle different types of requests
    if (url.pathname.includes('/api/') || 
        url.pathname.includes('/sets/') || 
        url.pathname.includes('/parts/') || 
        url.pathname.includes('/minifigs/') ||
        url.hostname === 'rebrickable.com') {
        // API requests: network first with fallback to cache
        event.respondWith(networkFirst(event.request));
    } else if (url.pathname.includes('/Data/') && url.pathname.endsWith('.csv')) {
        // CSV data files: stale-while-revalidate for better performance
        event.respondWith(staleWhileRevalidate(event.request));
    } else if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
        // Images: cache first with aggressive caching
        event.respondWith(cacheFirst(event.request));
    } else if (url.pathname.match(/\.(css|js|html)$/)) {
        // Static assets: cache first
        event.respondWith(cacheFirst(event.request));
    } else if (url.hostname === 'cdn.rebrickable.com') {
        // External images: cache first with network fallback
        event.respondWith(cacheFirst(event.request));
    } else {
        // Default: network first
        event.respondWith(networkFirst(event.request));
    }
});

// Handle background sync for offline actions
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        console.log('Background sync triggered');
        event.waitUntil(
            // Handle any pending offline actions
            Promise.resolve()
        );
    }
});

// Handle push notifications (if needed in the future)
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'New update available',
            icon: './android-chrome-192x192.png',
            badge: './favicon-32x32.png',
            data: data
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'LEGO Catalog', options)
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow(event.notification.data.url || './')
        );
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
    console.log('Service Worker controller changed');
    // Notify all clients to reload
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({ type: 'RELOAD_PAGE' });
        });
    });
});
