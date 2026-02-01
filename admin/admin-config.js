const ADMIN_CONFIG = {
    firebase: {
        apiKey: "AIzaSyCCaSmLE9Ww3GTUqdeAINua3vNrmqNV-TQ",
        authDomain: "zamanli.firebaseapp.com",
        projectId: "zamanli",
        storageBucket: "zamanli.firebasestorage.app",
        messagingSenderId: "889448554414",
        appId: "1:889448554414:web:3e97049c75c713c13e723f"
    },
    emailjs: {
        serviceId: 'service_nltn6di',
        templateApproval: 'template_k0an00y',
        publicKey: 'DFMgbrmsjlK0hxlc5'
    },
    // Süper Admin şifresi (base64 encoded)
    // Varsayılan: "admin2026"
    // Değiştirmek için: btoa('yeni_sifre') ile encode edip buraya yazın
    _sp: 'YWRtaW4yMDI2',
    // Şifre doğrulama
    verifySuperAdmin: function(input) {
        try {
            return input === atob(this._sp);
        } catch(e) {
            return false;
        }
    },
    // Mevcut şifreyi al (sadece değiştirme için)
    getSuperAdminPin: function() {
        try {
            return atob(this._sp);
        } catch(e) {
            return '';
        }
    },
    categories: {
        berber: { name: 'Berber', icon: '💈', color: '#10B981' },
        kuafor: { name: 'Kuaför', icon: '💇‍♀️', color: '#ec4899' },
        beauty: { name: 'Güzellik', icon: '💆', color: '#14b8a6' }
    },
    // 3 Paket Sistemi - Basitleştirilmiş
    packages: {
        free: { 
            name: 'Ücretsiz', 
            color: 'slate', 
            price: 0,
            yearlyPrice: 0,
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
                multiLocation: false,
                customBranding: false,
                prioritySupport: false,
                apiAccess: false
            },
            features: ['30 aylık randevu', '1 personel', 'WhatsApp bildirimleri', 'Online rezervasyon']
        },
        pro: { 
            name: 'Pro', 
            color: 'primary', 
            price: 499,
            yearlyPrice: 399,
            badge: 'Popüler',
            limits: { 
                monthlyAppointments: -1,
                staff: 5,
                smsNotifications: true,
                whatsappNotifications: true,
                emailNotifications: true,
                customerManagement: true,
                customerNotes: true,
                reports: true,
                reportsBasic: true,
                reportsAdvanced: true,
                multiLocation: false,
                customBranding: true,
                prioritySupport: false,
                apiAccess: false
            },
            features: ['Sınırsız randevu', '5 personel', 'SMS + E-posta', 'Müşteri yönetimi', 'Detaylı raporlar', 'Özel marka']
        },
        business: { 
            name: 'Business', 
            color: 'gold', 
            price: 999,
            yearlyPrice: 799,
            badge: 'En Kapsamlı',
            limits: { 
                monthlyAppointments: -1,
                staff: -1,
                smsNotifications: true,
                whatsappNotifications: true,
                emailNotifications: true,
                customerManagement: true,
                customerNotes: true,
                reports: true,
                reportsBasic: true,
                reportsAdvanced: true,
                reportsExport: true,
                multiLocation: true,
                customBranding: true,
                prioritySupport: true,
                onlinePayment: true,
                apiAccess: true
            },
            features: ['Sınırsız randevu', 'Sınırsız personel', 'Çoklu şube', 'Rapor export', 'Online ödeme', 'API erişimi', '7/24 destek']
        }
    },
    // Paket süreleri
    packageDurations: {
        monthly: { name: 'Aylık', multiplier: 1, discount: 0 },
        yearly: { name: 'Yıllık', multiplier: 12, discount: 20 }
    }
};

const DEFAULT_SERVICES = {
    berber: [
        { id: 'sac-kesimi', name: 'Saç Kesimi', icon: '✂️', duration: 30, price: 150, active: true },
        { id: 'sakal-trasi', name: 'Sakal Tıraşı', icon: '🪒', duration: 20, price: 100, active: true },
        { id: 'sac-sakal', name: 'Saç + Sakal', icon: '💈', duration: 45, price: 200, active: true },
        { id: 'sac-yikama', name: 'Saç Yıkama', icon: '💧', duration: 15, price: 50, active: true },
        { id: 'cilt-bakimi', name: 'Cilt Bakımı', icon: '🧴', duration: 30, price: 150, active: true },
        { id: 'cocuk-tiras', name: 'Çocuk Tıraşı', icon: '👦', duration: 20, price: 100, active: true }
    ],
    kuafor: [
        { id: 'sac-kesimi', name: 'Saç Kesimi', icon: '✂️', duration: 45, price: 200, active: true },
        { id: 'fon', name: 'Fön', icon: '💨', duration: 30, price: 150, active: true },
        { id: 'boya', name: 'Saç Boyama', icon: '🎨', duration: 120, price: 500, active: true },
        { id: 'balyaj', name: 'Balyaj', icon: '✨', duration: 180, price: 800, active: true },
        { id: 'manikur', name: 'Manikür', icon: '💅', duration: 45, price: 200, active: true },
        { id: 'pedikur', name: 'Pedikür', icon: '🦶', duration: 60, price: 250, active: true }
    ],
    beauty: [
        { id: 'cilt-bakimi', name: 'Cilt Bakımı', icon: '🧴', duration: 60, price: 300, active: true },
        { id: 'masaj', name: 'Masaj', icon: '💆', duration: 60, price: 400, active: true },
        { id: 'epilasyon', name: 'Epilasyon', icon: '✨', duration: 45, price: 250, active: true },
        { id: 'kirpik', name: 'Kirpik Lifting', icon: '👁️', duration: 60, price: 350, active: true },
        { id: 'kas-dizayn', name: 'Kaş Dizayn', icon: '✏️', duration: 30, price: 150, active: true },
        { id: 'kalici-makyaj', name: 'Kalıcı Makyaj', icon: '💄', duration: 120, price: 1500, active: true }
    ]
};
