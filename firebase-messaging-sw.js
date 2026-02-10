// Firebase Messaging Service Worker
// Bu dosya FCM uyumluluğu için korunuyor, tüm işlem sw.js tarafından yapılır.
// FCM, firebase-messaging-sw.js dosyasını otomatik arar, bu yüzden silmiyoruz.

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

// Background message handler - sw.js ile çakışmayı önlemek için
// sadece sw.js aktif değilse çalışır
messaging.onBackgroundMessage((payload) => {
    // sw.js zaten aktifse, o halledecek - duplikat önleme
    const tag = payload.data?.appointmentId 
        ? 'appointment-' + payload.data.appointmentId 
        : payload.data?.tag || 'zamanli-' + Date.now();
    
    const notificationTitle = payload.notification?.title || payload.data?.title || 'Zamanli';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'Yeni bir bildiriminiz var',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [300, 100, 300, 100, 300],
        tag: tag,
        renotify: true,
        requireInteraction: true,
        silent: false,
        data: {
            url: payload.data?.link || payload.fcmOptions?.link || '/',
            ...payload.data
        }
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
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
