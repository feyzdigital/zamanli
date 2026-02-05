/**
 * ZAMANLI - Konfigürasyon Dosyası v2.0
 * Roller, Yetkiler, Paketler ve Kategori Ayarları
 */

// ==================== ROL VE YETKİ SİSTEMİ ====================
const ROLES = {
    superAdmin: {
        name: 'Süper Admin',
        level: 100,
        icon: '👑',
        permissions: ['*'], // Tüm yetkiler
        description: 'Platform yöneticisi - Tüm salonlara tam erişim'
    },
    salonOwner: {
        name: 'Salon Sahibi',
        level: 50,
        icon: '👔',
        permissions: [
            'view_dashboard', 'view_appointments', 'manage_appointments',
            'view_customers', 'manage_customers', 'add_customer_notes',
            'view_services', 'manage_services',
            'view_staff', 'manage_staff',
            'view_hours', 'manage_hours',
            'view_reports', 'export_reports',
            'view_settings', 'manage_settings',
            'manage_salon_info', 'change_category', 'change_pin',
            'upload_logo', 'manage_gallery',
            'view_qr', 'generate_qr'
        ],
        description: 'Salon sahibi - Kendi salonuna tam erişim'
    },
    staff: {
        name: 'Personel',
        level: 20,
        icon: '✂️',
        permissions: [
            'view_dashboard', 'view_appointments', 
            'confirm_appointment', 'complete_appointment', 'cancel_appointment',
            'view_own_schedule', 'manage_own_blocks',
            'view_customers', 'view_customer_history',
            'view_services',
            'view_own_profile', 'edit_own_profile', 'change_own_pin'
        ],
        description: 'Salon personeli - Sınırlı erişim'
    },
    customer: {
        name: 'Müşteri',
        level: 1,
        icon: '👤',
        permissions: [
            'view_salon_public', 'book_appointment',
            'view_own_appointments', 'cancel_own_appointment',
            'leave_review'
        ],
        description: 'Müşteri - Sadece randevu alma ve görüntüleme'
    }
};

// Yetki kontrol fonksiyonu
function hasPermission(role, permission) {
    const roleData = ROLES[role];
    if (!roleData) return false;
    if (roleData.permissions.includes('*')) return true;
    return roleData.permissions.includes(permission);
}

// ==================== FIREBASE CONFIG ====================
// Firebase Configuration - Zamanli
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
    
    // Kategori Metinleri - Dinamik UI için
    categoryText: {
        berber: {
            singular: 'Berber',
            plural: 'Berberler',
            accusative: 'Berberi',          // -i hali
            locative: 'Berberde',           // -de hali
            owner: 'Berber Sahibi',
            description: 'Erkek saç kesimi ve sakal bakımı',
            searchPlaceholder: 'Berber adı veya konum ara...',
            heroTitle: 'En İyi Berberi Bul',
            heroSubtitle: 'Yakınındaki berberleri keşfet, anında randevu al',
            emptyState: 'Henüz kayıtlı berber yok',
            resultText: 'berber bulundu',
            icon: '💈',
            color: '#10B981',
            gradient: 'linear-gradient(135deg, #10B981, #059669)'
        },
        kuafor: {
            singular: 'Kuaför',
            plural: 'Kuaförler',
            accusative: 'Kuaförü',
            locative: 'Kuaförde',
            owner: 'Kuaför Sahibi',
            description: 'Kadın saç bakımı, kesim ve şekillendirme',
            searchPlaceholder: 'Kuaför adı veya konum ara...',
            heroTitle: 'Kuaförünü Bul',
            heroSubtitle: 'Profesyonel kuaförler, kolay randevu',
            emptyState: 'Henüz kayıtlı kuaför yok',
            resultText: 'kuaför bulundu',
            icon: '💇‍♀️',
            color: '#ec4899',
            gradient: 'linear-gradient(135deg, #ec4899, #db2777)'
        },
        beauty: {
            singular: 'Güzellik Merkezi',
            plural: 'Güzellik Merkezleri',
            accusative: 'Güzellik Merkezini',
            locative: 'Güzellik Merkezinde',
            owner: 'İşletme Sahibi',
            description: 'Cilt bakımı, makyaj, spa ve wellness',
            searchPlaceholder: 'Güzellik merkezi ara...',
            heroTitle: 'Güzellik Merkezini Bul',
            heroSubtitle: 'Profesyonel bakım ve spa hizmetleri',
            emptyState: 'Henüz kayıtlı güzellik merkezi yok',
            resultText: 'güzellik merkezi bulundu',
            icon: '💆',
            color: '#14b8a6',
            gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)'
        },
        all: {
            singular: 'Salon',
            plural: 'Salonlar',
            accusative: 'Salonu',
            locative: 'Salonda',
            owner: 'Salon Sahibi',
            description: 'Tüm güzellik ve bakım hizmetleri',
            searchPlaceholder: 'Salon adı veya konum ara...',
            heroTitle: 'Randevu Al',
            heroSubtitle: 'Berber, kuaför ve güzellik salonları tek yerde',
            emptyState: 'Henüz kayıtlı salon yok',
            resultText: 'salon bulundu',
            icon: '✨',
            color: '#6366f1',
            gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)'
        }
    },
    
    // Kategori yardımcı fonksiyonları
    getCategoryText: function(category, key) {
        const cat = this.categoryText[category] || this.categoryText.all;
        return cat[key] || this.categoryText.all[key];
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
            color: '#10B981',
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
        free: { 
            name: 'Ücretsiz', 
            price: 0, 
            yearlyPrice: 0,
            color: 'slate',
            badge: '',
            limits: { 
                monthlyAppointments: 30, 
                staff: 1, 
                smsNotifications: false, 
                whatsappNotifications: true,
                emailNotifications: false,
                customerManagement: false,
                customerNotes: false,
                reports: false,
                reportsBasic: true,
                reportsAdvanced: false,
                reportsExport: false,
                customBranding: false,
                onlinePayment: false,
                multiLocation: false,
                prioritySupport: false,
                apiAccess: false
            },
            features: [
                'Aylık 30 randevu',
                '1 personel',
                'WhatsApp bildirimleri',
                'Online rezervasyon sayfası',
                'Günlük istatistikler',
                'QR kod'
            ]
        },
        pro: { 
            name: 'Pro', 
            price: 899, 
            yearlyPrice: 719,  // %20 indirimli (899 * 0.8)
            color: 'primary',
            badge: 'Popüler',
            limits: { 
                monthlyAppointments: -1,  // Sınırsız
                staff: 5, 
                smsNotifications: false, 
                whatsappNotifications: true, 
                emailNotifications: true, 
                customerManagement: true,
                customerNotes: true,
                reports: true,
                reportsBasic: true,
                reportsAdvanced: true,
                reportsExport: false,
                customBranding: true,
                onlinePayment: false,
                multiLocation: false,
                prioritySupport: false,
                apiAccess: false
            },
            features: [
                'Sınırsız randevu',
                '5 personele kadar',
                'WhatsApp + E-posta bildirimleri',
                'Müşteri yönetimi ve notlar',
                'Detaylı raporlar ve grafikler',
                'Personel performans takibi',
                'Özel logo ve marka',
                'Google Business entegrasyonu'
            ]
        },
        business: { 
            name: 'Business', 
            price: 1599, 
            yearlyPrice: 1279,  // %20 indirimli (1599 * 0.8)
            color: 'gold',
            badge: 'En Kapsamlı',
            limits: { 
                monthlyAppointments: -1, 
                staff: -1,  // Sınırsız
                smsNotifications: false, 
                whatsappNotifications: true, 
                emailNotifications: true, 
                customerManagement: true,
                customerNotes: true,
                reports: true,
                reportsBasic: true,
                reportsAdvanced: true,
                reportsExport: true,
                customBranding: true,
                onlinePayment: true,
                multiLocation: true, 
                prioritySupport: true,
                apiAccess: true
            },
            features: [
                'Sınırsız randevu',
                'Sınırsız personel',
                'Tüm Pro özellikleri',
                'Çoklu şube yönetimi',
                'Rapor dışa aktarma (Excel/PDF)',
                'Online ödeme entegrasyonu',
                'API erişimi',
                'Öncelikli destek',
                '7/24 teknik destek'
            ]
        }
    },
    
    // Paket süreleri ve indirimler
    packageDurations: {
        monthly: { name: 'Aylık', multiplier: 1, discount: 0 },
        yearly: { name: 'Yıllık', multiplier: 12, discount: 20 }  // %20 indirim
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
    vapidKey: 'BBPC1mKHLS8_d1_e0ZvwLLTZOF1RUK56H5r_0fD6TXvZM6sJyFl3ss5DTU5JP6GYWM8wJU079YGqEpCxw3Sv3z0',
    
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
