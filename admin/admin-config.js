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
        berber: { name: 'Berber', icon: '💈', color: '#6366f1' },
        kuafor: { name: 'Kuaför', icon: '💇‍♀️', color: '#ec4899' },
        beauty: { name: 'Güzellik', icon: '💆', color: '#14b8a6' }
    },
    packages: {
        starter: { name: 'Starter', color: 'slate', limits: { monthlyAppointments: 50, staff: 1 } },
        pro: { name: 'Pro', color: 'primary', limits: { monthlyAppointments: 500, staff: 5 } },
        business: { name: 'Business', color: 'success', limits: { monthlyAppointments: -1, staff: -1 } }
    }
};

const DEFAULT_SERVICES = {
    berber: [
        { id: 'sac-kesimi', name: 'Saç Kesimi', icon: '✂️', duration: 30, price: 150, active: true },
        { id: 'sakal-trasi', name: 'Sakal Tıraşı', icon: '🪒', duration: 20, price: 100, active: true },
        { id: 'sac-sakal', name: 'Saç + Sakal', icon: '💈', duration: 45, price: 200, active: true },
        { id: 'sac-yikama', name: 'Saç Yıkama', icon: '💧', duration: 15, price: 50, active: true }
    ]
};
