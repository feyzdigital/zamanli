// Firebase Messaging Service Worker
// Bu dosya FCM'in push notification alması için gerekli

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Firebase config
firebase.initializeApp({
    apiKey: "AIzaSyCCaSmLE9Ww3GTUqdeAINua3vNrmqNV-TQ",
    authDomain: "zamanli.firebaseapp.com",
    projectId: "zamanli",
    storageBucket: "zamanli.firebasestorage.app",
    messagingSenderId: "889448554414",
    appId: "1:889448554414:web:3e97049c75c713c13e723f"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background message received:', payload);
    
    const notificationTitle = payload.notification?.title || payload.data?.title || 'Zamanli';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'Yeni bir bildiriminiz var',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        tag: payload.data?.tag || 'zamanli-notification',
        renotify: true,
        data: {
            url: payload.data?.link || payload.fcmOptions?.link || '/',
            ...payload.data
        }
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked:', event);
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                for (const client of windowClients) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
