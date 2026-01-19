const ADMIN_CONFIG = {
    firebase: {
        apiKey: "AIzaSyCa8jPQbymhS1XYUDCsw7B2gqlrygw1JDo",
        authDomain: "berber-zamanli.firebaseapp.com",
        projectId: "berber-zamanli",
        storageBucket: "berber-zamanli.firebasestorage.app",
        messagingSenderId: "17054574072",
        appId: "1:17054574072:web:5a0af6b40a66171c64220d"
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
