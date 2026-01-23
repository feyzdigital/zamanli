// Zamanli Push Notification Manager
// Firebase Cloud Messaging entegrasyonu

const ZamanliPush = {
    // FCM VAPID Key (config.js'den alınır, fallback olarak burada da var)
    VAPID_KEY: (typeof FCM_CONFIG !== 'undefined' && FCM_CONFIG.vapidKey) 
        ? FCM_CONFIG.vapidKey 
        : 'BBPC1mKHLS8_d1_e0ZvwLLTZOF1RUK56H5r_0fD6TXvZM6sJyFl3ss5DTU5JP6GYWM8wJU079YGqEpCxw3Sv3z0',
    
    // Durum
    isSupported: false,
    permission: 'default',
    subscription: null,
    fcmToken: null,
    
    // ==================== BAŞLATMA ====================
    async init() {
        console.log('[Push] Initializing...');
        
        // Tarayıcı desteği kontrolü
        this.isSupported = this.checkSupport();
        if (!this.isSupported) {
            console.warn('[Push] Push notifications not supported');
            return false;
        }
        
        // Mevcut izin durumunu al
        this.permission = Notification.permission;
        console.log('[Push] Current permission:', this.permission);
        
        // Eğer zaten izin verilmişse token al
        if (this.permission === 'granted') {
            await this.getToken();
        }
        
        return true;
    },
    
    // ==================== DESTEK KONTROLÜ ====================
    checkSupport() {
        const checks = {
            serviceWorker: 'serviceWorker' in navigator,
            pushManager: 'PushManager' in window,
            notification: 'Notification' in window
        };
        
        // iOS PWA kontrolü
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
        
        if (isIOS) {
            checks.isIOSPWA = isStandalone;
            // iOS 16.4+ gerekli
            const iOSVersion = parseFloat((navigator.userAgent.match(/OS (\d+)_(\d+)/) || [])[1] + '.' + ((navigator.userAgent.match(/OS (\d+)_(\d+)/) || [])[2] || '0'));
            checks.iOSVersionOK = iOSVersion >= 16.4;
            
            console.log('[Push] iOS detected. Standalone:', isStandalone, 'iOS Version:', iOSVersion);
            
            if (!isStandalone) {
                console.log('[Push] iOS: PWA ana ekrana eklenmeli');
            }
        }
        
        console.log('[Push] Support checks:', checks);
        
        return checks.serviceWorker && checks.pushManager && checks.notification;
    },
    
    // iOS için PWA kurulum kontrolü
    isIOSAndNeedsPWA() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
        return isIOS && !isStandalone;
    },
    
    // ==================== İZİN İSTEME ====================
    async requestPermission() {
        if (!this.isSupported) {
            return { success: false, error: 'not_supported' };
        }
        
        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            
            console.log('[Push] Permission result:', permission);
            
            if (permission === 'granted') {
                // İzin verildi, token al
                const token = await this.getToken();
                return { success: true, permission, token };
            } else if (permission === 'denied') {
                return { success: false, error: 'denied', permission };
            } else {
                return { success: false, error: 'dismissed', permission };
            }
        } catch (error) {
            console.error('[Push] Permission error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ==================== FCM TOKEN ALMA ====================
    async getToken() {
        try {
            // Service Worker'ın hazır olmasını bekle
            const registration = await navigator.serviceWorker.ready;
            
            // Firebase Messaging kullanılıyorsa
            if (typeof firebase !== 'undefined' && firebase.messaging) {
                const messaging = firebase.messaging();
                
                const token = await messaging.getToken({
                    vapidKey: this.VAPID_KEY,
                    serviceWorkerRegistration: registration
                });
                
                if (token) {
                    this.fcmToken = token;
                    console.log('[Push] FCM Token:', token);
                    
                    // NOT: Token burada otomatik kaydedilmiyor
                    // registerSalonForPush veya registerCustomerForPush çağrılmalı
                    
                    return token;
                }
            } else {
                // Fallback: Web Push API kullan
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(this.VAPID_KEY)
                });
                
                this.subscription = subscription;
                console.log('[Push] Subscription:', subscription);
                
                // Subscription'ı sunucuya kaydet
                await this.saveSubscriptionToServer(subscription);
                
                return subscription;
            }
        } catch (error) {
            console.error('[Push] Token error:', error);
            return null;
        }
    },
    
    // ==================== TOKEN SUNUCUYA KAYDETME ====================
    async saveTokenToServer(token, userType = 'customer', id = null) {
        try {
            // Firestore'a kaydet
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                const db = firebase.firestore();
                
                const tokenData = {
                    token: token,
                    userType: userType, // 'customer' veya 'salon'
                    platform: this.detectPlatform(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Kullanıcı tipine göre ID alanını ayarla
                if (userType === 'salon') {
                    tokenData.salonId = id;
                } else {
                    tokenData.customerId = id;
                }
                
                // Token ID olarak hash kullan
                const tokenId = await this.hashToken(token);
                
                await db.collection('push_tokens').doc(tokenId).set(tokenData, { merge: true });
                
                console.log('[Push] Token saved to Firestore:', { userType, id });
                return true;
            }
        } catch (error) {
            console.error('[Push] Save token error:', error);
            return false;
        }
    },
    
    // Subscription için (Firebase kullanılmıyorsa)
    async saveSubscriptionToServer(subscription) {
        // Aynı mantık, farklı veri yapısı
        return this.saveTokenToServer(JSON.stringify(subscription));
    },
    
    // ==================== SALON İÇİN TOKEN KAYDETME ====================
    async registerSalonForPush(salonId) {
        if (!this.fcmToken && !this.subscription) {
            const result = await this.requestPermission();
            if (!result.success) return result;
        }
        
        const token = this.fcmToken || JSON.stringify(this.subscription);
        return this.saveTokenToServer(token, 'salon', salonId);
    },
    
    // ==================== SALONA BİLDİRİM GÖNDERME ====================
    async sendNotificationToSalon(salonId, title, body, data = {}) {
        try {
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                const db = firebase.firestore();
                
                // Salon'un push token'larını bul
                const tokensSnapshot = await db.collection('push_tokens')
                    .where('userType', '==', 'salon')
                    .where('salonId', '==', salonId)
                    .get();
                
                if (tokensSnapshot.empty) {
                    console.log('[Push] No tokens found for salon:', salonId);
                    return { success: false, error: 'no_tokens' };
                }
                
                // Bildirimi notifications koleksiyonuna kaydet
                // Cloud Function bu koleksiyonu dinleyip FCM gönderecek
                const notificationDoc = await db.collection('notifications').add({
                    targetType: 'salon',
                    targetId: salonId,
                    title: title,
                    body: body,
                    data: data,
                    tokens: tokensSnapshot.docs.map(doc => doc.data().token),
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('[Push] Notification queued:', notificationDoc.id);
                return { success: true, notificationId: notificationDoc.id };
            }
        } catch (error) {
            console.error('[Push] Send to salon error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ==================== MÜŞTERİ İÇİN TOKEN KAYDETME ====================
    async registerCustomerForPush(customerId = null, phone = null) {
        if (!this.fcmToken && !this.subscription) {
            const result = await this.requestPermission();
            if (!result.success) return result;
        }
        
        try {
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                const db = firebase.firestore();
                const token = this.fcmToken || JSON.stringify(this.subscription);
                const tokenId = await this.hashToken(token);
                
                const tokenData = {
                    token: token,
                    userType: 'customer',
                    customerId: customerId,
                    phone: phone,
                    platform: this.detectPlatform(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('push_tokens').doc(tokenId).set(tokenData, { merge: true });
                
                // Telefon numarası varsa, randevularla ilişkilendir
                if (phone) {
                    localStorage.setItem('zamanli_push_phone', phone);
                }
                
                return { success: true };
            }
        } catch (error) {
            console.error('[Push] Register customer error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ==================== LOCAL NOTIFICATION ====================
    async showLocalNotification(title, options = {}) {
        if (this.permission !== 'granted') {
            console.warn('[Push] No permission for notifications');
            return false;
        }
        
        try {
            const registration = await navigator.serviceWorker.ready;
            
            const defaultOptions = {
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                vibrate: [200, 100, 200],
                tag: 'zamanli-' + Date.now(),
                ...options
            };
            
            await registration.showNotification(title, defaultOptions);
            return true;
        } catch (error) {
            console.error('[Push] Show notification error:', error);
            return false;
        }
    },
    
    // ==================== YARDIMCI FONKSİYONLAR ====================
    
    // Platform tespiti
    detectPlatform() {
        const ua = navigator.userAgent;
        if (/android/i.test(ua)) return 'android';
        if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
        if (/Windows/.test(ua)) return 'windows';
        if (/Mac/.test(ua)) return 'mac';
        return 'other';
    },
    
    // Token hash'leme (ID olarak kullanmak için)
    async hashToken(token) {
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    // VAPID key dönüşümü
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },
    
    // ==================== İZİN DURUMU UI ====================
    getPermissionStatus() {
        if (!this.isSupported) {
            return {
                status: 'unsupported',
                message: 'Tarayıcınız bildirimleri desteklemiyor',
                canRequest: false
            };
        }
        
        switch (this.permission) {
            case 'granted':
                return {
                    status: 'granted',
                    message: 'Bildirimler aktif',
                    canRequest: false
                };
            case 'denied':
                return {
                    status: 'denied',
                    message: 'Bildirimler engellenmiş. Tarayıcı ayarlarından izin verin.',
                    canRequest: false
                };
            default:
                return {
                    status: 'default',
                    message: 'Bildirimlere izin verin',
                    canRequest: true
                };
        }
    }
};

// ==================== BİLDİRİM İZNİ UI ====================
function createNotificationPromptUI() {
    // Zaten varsa ekleme
    if (document.getElementById('notificationPrompt')) return;
    
    // iOS ve PWA değilse, önce PWA kurulum prompt'u göster
    if (ZamanliPush.isIOSAndNeedsPWA()) {
        createIOSInstallPrompt();
        return;
    }
    
    const status = ZamanliPush.getPermissionStatus();
    if (!status.canRequest) return;
    
    const promptHTML = `
        <div id="notificationPrompt" class="notification-prompt">
            <div class="notification-prompt-content">
                <div class="notification-prompt-icon">🔔</div>
                <div class="notification-prompt-text">
                    <h4>Bildirimleri Aç</h4>
                    <p>Randevu hatırlatmaları ve güncellemeler için bildirimlere izin ver</p>
                </div>
                <div class="notification-prompt-actions">
                    <button class="btn-allow" onclick="handleNotificationAllow()">İzin Ver</button>
                    <button class="btn-later" onclick="handleNotificationLater()">Sonra</button>
                </div>
            </div>
        </div>
    `;
    
    // CSS ekle
    if (!document.getElementById('notificationPromptStyles')) {
        const style = document.createElement('style');
        style.id = 'notificationPromptStyles';
        style.textContent = `
            .notification-prompt {
                position: fixed;
                bottom: 20px;
                left: 20px;
                right: 20px;
                max-width: 400px;
                margin: 0 auto;
                background: white;
                border-radius: 16px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                padding: 20px;
                z-index: 10000;
                animation: slideUp 0.3s ease;
                display: none;
            }
            
            .notification-prompt.show {
                display: block;
            }
            
            @keyframes slideUp {
                from { transform: translateY(100px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .notification-prompt-content {
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
            }
            
            .notification-prompt-icon {
                font-size: 40px;
            }
            
            .notification-prompt-text {
                flex: 1;
                min-width: 200px;
            }
            
            .notification-prompt-text h4 {
                margin: 0 0 4px 0;
                font-size: 16px;
                color: #1f2937;
            }
            
            .notification-prompt-text p {
                margin: 0;
                font-size: 14px;
                color: #6b7280;
            }
            
            .notification-prompt-actions {
                display: flex;
                gap: 8px;
                width: 100%;
                margin-top: 12px;
            }
            
            .notification-prompt-actions button {
                flex: 1;
                padding: 12px 20px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                border: none;
                transition: all 0.2s;
            }
            
            .btn-allow {
                background: linear-gradient(135deg, #10B981, #0EA371);
                color: white;
            }
            
            .btn-allow:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
            }
            
            .btn-later {
                background: #f3f4f6;
                color: #6b7280;
            }
            
            .btn-later:hover {
                background: #e5e7eb;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.insertAdjacentHTML('beforeend', promptHTML);
}

async function handleNotificationAllow() {
    const prompt = document.getElementById('notificationPrompt');
    const result = await ZamanliPush.requestPermission();
    
    if (result.success) {
        prompt.innerHTML = `
            <div class="notification-prompt-content" style="justify-content: center; text-align: center;">
                <div style="font-size: 48px;">✅</div>
                <div>
                    <h4 style="margin: 0;">Bildirimler Açıldı!</h4>
                    <p style="margin: 8px 0 0 0; color: #6b7280;">Artık randevu güncellemelerini alacaksınız</p>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            prompt.classList.remove('show');
            setTimeout(() => prompt.remove(), 300);
        }, 2000);
    } else {
        prompt.classList.remove('show');
    }
    
    localStorage.setItem('notification-prompt-shown', 'true');
}

function handleNotificationLater() {
    const prompt = document.getElementById('notificationPrompt');
    prompt.classList.remove('show');
    
    // 1 gün sonra tekrar göster
    const nextShow = Date.now() + (24 * 60 * 60 * 1000);
    localStorage.setItem('notification-prompt-next', nextShow.toString());
}

function showNotificationPrompt() {
    const prompt = document.getElementById('notificationPrompt');
    if (prompt) {
        prompt.classList.add('show');
    }
}

// ==================== iOS PWA KURULUM PROMPT ====================
function createIOSInstallPrompt() {
    if (document.getElementById('iosInstallPrompt')) return;
    
    const promptHTML = `
        <div id="iosInstallPrompt" class="notification-prompt">
            <div class="notification-prompt-content">
                <div class="notification-prompt-icon">📲</div>
                <div class="notification-prompt-text">
                    <h4>Ana Ekrana Ekle</h4>
                    <p>Bildirim alabilmek için uygulamayı ana ekrana eklemeniz gerekiyor</p>
                    <div class="ios-install-steps">
                        <p>1. Safari'de <strong>Paylaş</strong> butonuna tıklayın <span style="font-size:1.2em">⬆️</span></p>
                        <p>2. <strong>"Ana Ekrana Ekle"</strong> seçeneğini seçin</p>
                        <p>3. Eklenen uygulamayı açın</p>
                    </div>
                </div>
                <div class="notification-prompt-actions">
                    <button class="btn-allow" onclick="closeIOSInstallPrompt()">Anladım</button>
                </div>
            </div>
        </div>
    `;
    
    // iOS özel stiller
    if (!document.getElementById('iosInstallStyles')) {
        const style = document.createElement('style');
        style.id = 'iosInstallStyles';
        style.textContent = `
            .ios-install-steps {
                margin-top: 12px;
                padding: 12px;
                background: #f3f4f6;
                border-radius: 8px;
                font-size: 13px;
            }
            .ios-install-steps p {
                margin: 6px 0;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.insertAdjacentHTML('beforeend', promptHTML);
    
    // Otomatik göster
    setTimeout(() => {
        const prompt = document.getElementById('iosInstallPrompt');
        if (prompt) prompt.classList.add('show');
    }, 2000);
}

function closeIOSInstallPrompt() {
    const prompt = document.getElementById('iosInstallPrompt');
    if (prompt) {
        prompt.classList.remove('show');
        setTimeout(() => prompt.remove(), 300);
    }
    localStorage.setItem('ios-install-prompt-shown', 'true');
}

// ==================== AUTO INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Push Manager'ı başlat
    await ZamanliPush.init();
    
    // iOS PWA kontrolü
    if (ZamanliPush.isIOSAndNeedsPWA()) {
        const alreadyShown = localStorage.getItem('ios-install-prompt-shown');
        if (!alreadyShown) {
            createIOSInstallPrompt();
        }
        return; // iOS'ta PWA olmadan bildirim çalışmaz
    }
    
    // UI oluştur
    createNotificationPromptUI();
    
    // Gösterilecek mi kontrol et
    const status = ZamanliPush.getPermissionStatus();
    if (status.canRequest) {
        const nextShow = localStorage.getItem('notification-prompt-next');
        const alreadyShown = localStorage.getItem('notification-prompt-shown');
        
        if (!alreadyShown || (nextShow && Date.now() > parseInt(nextShow))) {
            // 3 saniye sonra göster
            setTimeout(showNotificationPrompt, 3000);
        }
    }
});

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZamanliPush;
}
