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
    superAdminPin: '5856',
    categories: {
        berber: { name: 'Berber', icon: '💈', color: '#10B981' },
        kuafor: { name: 'Kuaför', icon: '💇‍♀️', color: '#ec4899' },
        beauty: { name: 'Güzellik', icon: '💆', color: '#14b8a6' }
    },
    // Genişletilmiş paket sistemi - anlık güncelleme desteği
    packages: {
        free: { 
            name: 'Ücretsiz', 
            color: 'slate', 
            price: 0,
            limits: { 
                monthlyAppointments: 30, 
                staff: 1,
                smsNotifications: false,
                whatsappNotifications: true,
                emailNotifications: false,
                customerManagement: false,
                reports: false,
                multiLocation: false,
                customBranding: false,
                prioritySupport: false
            },
            features: ['Temel randevu yönetimi', 'WhatsApp bildirimleri', 'Online rezervasyon']
        },
        starter: { 
            name: 'Starter', 
            color: 'blue', 
            price: 99,
            limits: { 
                monthlyAppointments: 100, 
                staff: 2,
                smsNotifications: false,
                whatsappNotifications: true,
                emailNotifications: true,
                customerManagement: true,
                reports: false,
                multiLocation: false,
                customBranding: false,
                prioritySupport: false
            },
            features: ['100 aylık randevu', '2 personel', 'Müşteri yönetimi', 'E-posta bildirimleri']
        },
        pro: { 
            name: 'Pro', 
            color: 'primary', 
            price: 249,
            limits: { 
                monthlyAppointments: 500, 
                staff: 5,
                smsNotifications: true,
                whatsappNotifications: true,
                emailNotifications: true,
                customerManagement: true,
                reports: true,
                multiLocation: false,
                customBranding: true,
                prioritySupport: false
            },
            features: ['500 aylık randevu', '5 personel', 'SMS bildirimleri', 'Raporlar', 'Özel marka']
        },
        business: { 
            name: 'Business', 
            color: 'success', 
            price: 499,
            limits: { 
                monthlyAppointments: -1, // Sınırsız
                staff: -1, // Sınırsız
                smsNotifications: true,
                whatsappNotifications: true,
                emailNotifications: true,
                customerManagement: true,
                reports: true,
                multiLocation: true,
                customBranding: true,
                prioritySupport: true
            },
            features: ['Sınırsız randevu', 'Sınırsız personel', 'Çoklu şube', 'Öncelikli destek', 'Tüm özellikler']
        },
        enterprise: { 
            name: 'Enterprise', 
            color: 'purple', 
            price: 999,
            limits: { 
                monthlyAppointments: -1,
                staff: -1,
                smsNotifications: true,
                whatsappNotifications: true,
                emailNotifications: true,
                customerManagement: true,
                reports: true,
                multiLocation: true,
                customBranding: true,
                prioritySupport: true,
                apiAccess: true,
                whiteLabel: true
            },
            features: ['Tüm Business özellikleri', 'API erişimi', 'White-label', 'Özel entegrasyonlar']
        }
    },
    // Paket süreleri
    packageDurations: {
        monthly: { name: 'Aylık', multiplier: 1, discount: 0 },
        quarterly: { name: '3 Aylık', multiplier: 3, discount: 10 },
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
