// Firebase Configuration - Zamanlı
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCCaSmLE9Ww3GTUqdeAINua3vNrmqNV-TQ",
    authDomain: "zamanli.firebaseapp.com",
    projectId: "zamanli",
    storageBucket: "zamanli.firebasestorage.app",
    messagingSenderId: "889448554414",
    appId: "1:889448554414:web:3e97049c75c713c13e723f",
    measurementId: "G-JT74B65PPS"
};

// Google Places API Configuration
const GOOGLE_PLACES_CONFIG = {
    apiKey: "AIzaSyCu91sRwR1Zp8_xFoBT2vZr6Sb9fBQkX9s",
    country: "tr"
};

// App Configuration
const APP_CONFIG = {
    // Randevu Ayarları
    appointment: {
        cleaningBreakMinutes: 5,        // Randevular arası temizlik molası (dakika)
        slotInterval: 15,               // Randevu slot aralığı (dakika)
        cancelDeadlineMinutes: 90,      // İptal son tarihi - randevudan kaç dakika önce
        reminderBeforeMinutes: 120,     // Hatırlatma zamanı - randevudan kaç dakika önce
        maxGalleryImages: 5,            // Maksimum galeri görseli
        defaultRating: 5.0              // Varsayılan puan
    },
    
    // QR Kod Ayarları
    qrCode: {
        size: 300,                  // QR kod boyutu (piksel)
        errorCorrectionLevel: 'M',  // Hata düzeltme seviyesi (L, M, Q, H)
        margin: 2                   // Kenar boşluğu
    },
    
    // Yorum Sistemi Ayarları
    review: {
        minRating: 1,
        maxRating: 5,
        requireVerifiedAppointment: true,  // Sadece randevusu olan yorum yapabilir
        reviewWindowDays: 7                // Randevudan sonra kaç gün içinde yorum yapılabilir
    },
    
    // Medya Ayarları
    media: {
        maxGalleryImages: 5,
        maxLogoSize: 2 * 1024 * 1024,      // 2MB
        maxImageSize: 5 * 1024 * 1024,     // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
    },
    
    categories: {
        berber: {
            name: 'Berber',
            icon: '💈',
            color: '#6366f1',
            description: 'Erkek berber salonları',
            services: [
                { id: 'sac-kesimi', name: 'Saç Kesimi', icon: '✂️', duration: 30, price: 150 },
                { id: 'sakal-trasi', name: 'Sakal Tıraşı', icon: '🪒', duration: 20, price: 100 },
                { id: 'sac-sakal', name: 'Saç + Sakal', icon: '💈', duration: 45, price: 200 },
                { id: 'sac-yikama', name: 'Saç Yıkama', icon: '💧', duration: 15, price: 50 },
                { id: 'cilt-bakimi', name: 'Cilt Bakımı', icon: '🧴', duration: 30, price: 150 },
                { id: 'cocuk-tiras', name: 'Çocuk Tıraşı', icon: '👦', duration: 20, price: 100 }
            ]
        },
        kuafor: {
            name: 'Kuaför',
            icon: '💇‍♀️',
            color: '#ec4899',
            description: 'Kadın kuaför salonları',
            services: [
                { id: 'sac-kesimi', name: 'Saç Kesimi', icon: '✂️', duration: 45, price: 200 },
                { id: 'fon', name: 'Fön', icon: '💨', duration: 30, price: 150 },
                { id: 'boya', name: 'Saç Boyama', icon: '🎨', duration: 120, price: 500 },
                { id: 'balyaj', name: 'Balyaj', icon: '✨', duration: 180, price: 800 },
                { id: 'manikur', name: 'Manikür', icon: '💅', duration: 45, price: 200 },
                { id: 'pedikur', name: 'Pedikür', icon: '🦶', duration: 60, price: 250 }
            ]
        },
        beauty: {
            name: 'Güzellik',
            icon: '💆',
            color: '#14b8a6',
            description: 'Güzellik ve spa merkezleri',
            services: [
                { id: 'cilt-bakimi', name: 'Cilt Bakımı', icon: '🧴', duration: 60, price: 300 },
                { id: 'masaj', name: 'Masaj', icon: '💆', duration: 60, price: 400 },
                { id: 'epilasyon', name: 'Epilasyon', icon: '✨', duration: 45, price: 250 },
                { id: 'kirpik', name: 'Kirpik Lifting', icon: '👁️', duration: 60, price: 350 },
                { id: 'kas-dizayn', name: 'Kaş Dizayn', icon: '✏️', duration: 30, price: 150 },
                { id: 'kalici-makyaj', name: 'Kalıcı Makyaj', icon: '💄', duration: 120, price: 1500 }
            ]
        }
    },
    packages: {
        starter: { 
            name: 'Starter', 
            price: 0, 
            limits: { monthlyAppointments: 50, staff: 1 },
            features: ['Temel randevu yönetimi', '1 personel']
        },
        pro: { 
            name: 'Pro', 
            price: 349, 
            limits: { monthlyAppointments: 500, staff: 5 },
            features: ['Sınırsız randevu', '5 personel', 'WhatsApp bildirimleri', 'Raporlar']
        },
        business: { 
            name: 'Business', 
            price: 699, 
            limits: { monthlyAppointments: -1, staff: -1 },
            features: ['Her şey sınırsız', 'Öncelikli destek', 'Öne çıkan listeleme']
        }
    },
    workingHours: {
        default: {
            mon: { open: '09:00', close: '20:00', active: true },
            tue: { open: '09:00', close: '20:00', active: true },
            wed: { open: '09:00', close: '20:00', active: true },
            thu: { open: '09:00', close: '20:00', active: true },
            fri: { open: '09:00', close: '20:00', active: true },
            sat: { open: '09:00', close: '18:00', active: true },
            sun: { open: '10:00', close: '16:00', active: false }
        }
    }
};

// EmailJS Configuration
const EMAILJS_CONFIG = {
    serviceId: 'service_nltn6di',
    templateApproval: 'template_k0an00y',
    templateNewSalon: 'template_qv6wzhj',
    templateNewAppointment: 'template_appointment',
    templateReminder: 'template_reminder',           // Randevu hatırlatma
    templateReschedule: 'template_reschedule',       // Randevu değişikliği
    publicKey: 'DFMgbrmsjlK0hxlc5'
};

// Firebase Cloud Messaging (Push Notifications) Configuration
// VAPID Key'i Firebase Console'dan alın:
// Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const FCM_CONFIG = {
    vapidKey: 'BBOpQdU-eCIYjiQHiVPY8x2tBlhDYhZlYgARXayyRs4XR1q9zOghL_zuu3gaTSvgOGY6Q9fAtEK5zQXu-VMaHZM', // Firebase Console'dan alınacak
    
    // Bildirim ayarları
    notifications: {
        // Müşteri bildirimleri
        customer: {
            appointmentConfirmed: true,    // Randevu onaylandı
            appointmentCancelled: true,    // Randevu iptal edildi
            appointmentReminder: true,     // Randevu hatırlatma (2 saat önce)
            appointmentChanged: true       // Randevu saati değişti
        },
        // Salon bildirimleri
        salon: {
            newAppointment: true,          // Yeni randevu
            appointmentCancelled: true,    // Müşteri iptal etti
            customerArriving: true,        // Müşteri "geliyorum" dedi
            dailySummary: true,            // Günlük özet (sabah 08:00)
            newReview: true                // Yeni yorum
        }
    },
    
    // Hatırlatma zamanları (dakika cinsinden, randevudan önce)
    reminderTimes: [120, 60, 30], // 2 saat, 1 saat, 30 dakika önce
    
    // Günlük özet saati
    dailySummaryTime: '08:00'
};

// Push Notification şablonları
const NOTIFICATION_TEMPLATES = {
    // Müşteri bildirimleri
    appointmentConfirmed: {
        title: '✅ Randevunuz Onaylandı!',
        body: '{salonName} - {date} saat {time}',
        icon: '/icons/icon-192x192.png'
    },
    appointmentCancelled: {
        title: '❌ Randevunuz İptal Edildi',
        body: '{salonName} tarafından randevunuz iptal edildi',
        icon: '/icons/icon-192x192.png'
    },
    appointmentReminder: {
        title: '⏰ Randevu Hatırlatması',
        body: '{salonName} randevunuza {remaining} kaldı',
        icon: '/icons/icon-192x192.png',
        requireInteraction: true
    },
    appointmentChanged: {
        title: '📅 Randevu Saati Değişti',
        body: 'Yeni saat: {date} {time} - {salonName}',
        icon: '/icons/icon-192x192.png'
    },
    
    // Salon bildirimleri
    newAppointment: {
        title: '🆕 Yeni Randevu!',
        body: '{customerName} - {date} saat {time} - {serviceName}',
        icon: '/icons/icon-192x192.png'
    },
    customerCancelled: {
        title: '❌ Randevu İptal Edildi',
        body: '{customerName} randevusunu iptal etti - {date} {time}',
        icon: '/icons/icon-192x192.png'
    },
    customerArriving: {
        title: '🚶 Müşteri Yolda!',
        body: '{customerName} "Geliyorum" dedi - {time} randevusu',
        icon: '/icons/icon-192x192.png'
    },
    dailySummary: {
        title: '📊 Bugünkü Randevular',
        body: 'Bugün {count} randevunuz var. İlk randevu: {firstTime}',
        icon: '/icons/icon-192x192.png'
    },
    newReview: {
        title: '⭐ Yeni Yorum!',
        body: '{customerName}: "{comment}" - {rating} yıldız',
        icon: '/icons/icon-192x192.png'
    }
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(FIREBASE_CONFIG);
}
