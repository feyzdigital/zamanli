// Zamanlı Service Worker v3.2
// Cache stratejisi: HTML/JS = Network Only, Diğer = Network First
const CACHE_VERSION = 'v3.2';
const CACHE_NAME = `zamanli-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Cache edilecek statik dosyalar (sadece assets)
const STATIC_ASSETS = [
    '/offline.html',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

// ASLA cache'lenMEyecek dosyalar (her zaman network)
const NEVER_CACHE = [
    '.html',
    '.js',
    'index.html',
    'ux-enhancements',
    'config.js',
    'sw.js'
];

// Firebase ve API URL'leri - cache etme
const EXCLUDE_FROM_CACHE = [
    'firestore.googleapis.com',
    'firebase',
    'emailjs',
    'twilio',
    'fcm',
    'googleapis.com/identitytoolkit'
];

// ==================== INSTALL ====================
self.addEventListener('install', (event) => {
    console.log('[SW] Installing v' + CACHE_VERSION);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                // Her dosyayı ayrı ayrı ekle, hata olursa devam et
                return Promise.allSettled(
                    STATIC_ASSETS.map(url => 
                        cache.add(url).catch(err => {
                            console.warn('[SW] Failed to cache:', url, err);
                        })
                    )
                );
            })
            .then(() => {
                console.log('[SW] Install complete');
                return self.skipWaiting();
            })
    );
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating v' + CACHE_VERSION);
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('zamanli-') && name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Claiming clients');
                return self.clients.claim();
            })
    );
});

// ==================== FETCH ====================
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // POST ve diğer mutasyon requestleri için cache kullanma
    if (request.method !== 'GET') return;
    
    // Firebase ve external API'ler için cache kullanma
    if (EXCLUDE_FROM_CACHE.some(domain => request.url.includes(domain))) {
        return;
    }
    
    // Chrome extension requestleri için
    if (url.protocol === 'chrome-extension:') return;
    
    // HTML ve JS dosyaları için NETWORK ONLY (cache bypass)
    const shouldBypassCache = NEVER_CACHE.some(ext => request.url.includes(ext));
    
    if (shouldBypassCache) {
        event.respondWith(
            fetch(request)
                .catch(async () => {
                    // Offline ise ve HTML isteği ise offline sayfası göster
                    if (request.headers.get('accept')?.includes('text/html')) {
                        const offlinePage = await caches.match(OFFLINE_URL);
                        if (offlinePage) return offlinePage;
                    }
                    return new Response('Offline', { status: 503 });
                })
        );
        return;
    }
    
    // Diğer dosyalar için: Network First, Fallback to Cache
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Başarılı response'ları cache'e kaydet
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(async () => {
                // Network başarısız - cache'e bak
                const cachedResponse = await caches.match(request);
                
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // Diğer istekler için boş response
                return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
            })
    );
});

// ==================== PUSH NOTIFICATIONS ====================
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');
    
    let data = {
        title: 'Zamanlı',
        body: 'Yeni bir bildiriminiz var',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        url: '/',
        tag: 'general'
    };
    
    // Push verisi varsa parse et
    if (event.data) {
        try {
            const pushData = event.data.json();
            data = { ...data, ...pushData };
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body,
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/icon-72x72.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: data.tag || 'zamanli-notification',
        renotify: true,
        requireInteraction: data.requireInteraction || false,
        data: {
            url: data.url || '/',
            timestamp: Date.now()
        },
        actions: data.actions || []
    };
    
    // Bildirim tipine göre özel aksiyonlar
    if (data.type === 'new-appointment') {
        options.actions = [
            { action: 'view', title: '👁️ Görüntüle' },
            { action: 'confirm', title: '✅ Onayla' }
        ];
        options.tag = 'appointment-' + (data.appointmentId || Date.now());
    } else if (data.type === 'reminder') {
        options.actions = [
            { action: 'coming', title: '✅ Geliyorum' },
            { action: 'cancel', title: '❌ İptal' }
        ];
        options.tag = 'reminder-' + (data.appointmentId || Date.now());
        options.requireInteraction = true;
    } else if (data.type === 'appointment-confirmed') {
        options.actions = [
            { action: 'view', title: '📅 Detaylar' },
            { action: 'calendar', title: '📆 Takvime Ekle' }
        ];
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action);
    
    const notification = event.notification;
    const action = event.action;
    const data = notification.data || {};
    
    notification.close();
    
    let urlToOpen = data.url || '/';
    
    // Aksiyona göre farklı işlemler
    switch (action) {
        case 'view':
            urlToOpen = data.url || '/';
            break;
        case 'confirm':
            // Randevuyu onaylama sayfasına yönlendir
            urlToOpen = data.confirmUrl || data.url || '/';
            break;
        case 'coming':
            // "Geliyorum" aksiyonu - API çağrısı yapılabilir
            urlToOpen = data.comingUrl || data.url || '/';
            break;
        case 'cancel':
            urlToOpen = data.cancelUrl || data.url || '/';
            break;
        case 'calendar':
            // Google Calendar linki varsa aç
            if (data.calendarUrl) {
                urlToOpen = data.calendarUrl;
            }
            break;
        default:
            urlToOpen = data.url || '/';
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Zaten açık bir pencere varsa onu kullan
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                // Yoksa yeni pencere aç
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ==================== NOTIFICATION CLOSE ====================
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed');
    // Analytics veya tracking için kullanılabilir
});

// ==================== BACKGROUND SYNC ====================
self.addEventListener('sync', (event) => {
    console.log('[SW] Sync event:', event.tag);
    
    if (event.tag === 'sync-appointments') {
        event.waitUntil(syncAppointments());
    } else if (event.tag === 'sync-reviews') {
        event.waitUntil(syncReviews());
    }
});

// Offline'da yapılan randevuları senkronize et
async function syncAppointments() {
    try {
        const db = await openDB();
        const pendingAppointments = await db.getAll('pending-appointments');
        
        for (const appointment of pendingAppointments) {
            // API'ye gönder
            const response = await fetch('/api/appointments', {
                method: 'POST',
                body: JSON.stringify(appointment),
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                await db.delete('pending-appointments', appointment.id);
            }
        }
    } catch (error) {
        console.error('[SW] Sync failed:', error);
    }
}

async function syncReviews() {
    // Benzer mantık yorumlar için
    console.log('[SW] Syncing reviews...');
}

// ==================== PERIODIC SYNC (Background fetch) ====================
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-appointments') {
        event.waitUntil(checkUpcomingAppointments());
    }
});

async function checkUpcomingAppointments() {
    // Yaklaşan randevuları kontrol et
    console.log('[SW] Checking upcoming appointments...');
}

// ==================== MESSAGE HANDLING ====================
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            event.ports[0].postMessage({ success: true });
        });
    }
});

console.log('[SW] Service Worker loaded - v' + CACHE_VERSION);
