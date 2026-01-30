/**
 * ZAMANLI - Süper Admin Paneli v3.0
 * Tam Yetkili Admin Sistemi
 */

const AdminState = {
    isLoggedIn: false, currentView: 'dashboard', currentTab: 'active', currentCategory: 'all',
    salons: [], allAppointments: [], allCustomers: [], pushTokens: [],
    stats: { totalSalons: 0, activeSalons: 0, pendingSalons: 0, totalAppointments: 0, todayAppointments: 0, totalCustomers: 0 },
    loading: false, searchQuery: '', selectedSalon: null, salonStaff: [], salonServices: [], salonAppointments: [], salonCustomers: [], detailTab: 'info', listeners: []
};
let db = null;

function generateQRCodeUrl(text, size = 256) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&data=${encodeURIComponent(text)}`;
}

function initAdmin() {
    console.log('[Admin] v3.0 başlatılıyor...');
    if (typeof firebase !== 'undefined' && firebase.firestore && typeof emailjs !== 'undefined') {
        try {
            if (!firebase.apps.length) firebase.initializeApp(ADMIN_CONFIG.firebase);
            db = firebase.firestore();
            emailjs.init(ADMIN_CONFIG.emailjs.publicKey);
            checkAuth();
        } catch (e) {
            console.error('[Admin] Başlatma hatası:', e);
            if (firebase.apps.length) { db = firebase.firestore(); checkAuth(); }
        }
    } else { setTimeout(initAdmin, 100); }
}

function checkAuth() {
    const session = localStorage.getItem('zamanli_admin');
    if (session) {
        try {
            const { verified, expiry } = JSON.parse(session);
            if (verified === true && new Date(expiry) > new Date()) {
                AdminState.isLoggedIn = true; loadAllData(); return;
            }
        } catch (e) {}
        localStorage.removeItem('zamanli_admin');
    }
    renderLogin();
}

function login() {
    const pin = document.getElementById('pinInput').value;
    if (ADMIN_CONFIG.verifySuperAdmin(pin)) {
        const expiry = new Date(); expiry.setHours(expiry.getHours() + 24);
        localStorage.setItem('zamanli_admin', JSON.stringify({ verified: true, expiry: expiry.toISOString() }));
        AdminState.isLoggedIn = true; loadAllData();
    } else { showToast('Geçersiz şifre!', 'error'); document.getElementById('pinInput').value = ''; }
}

function logout() {
    AdminState.listeners.forEach(u => { try { u(); } catch(e) {} }); AdminState.listeners = [];
    localStorage.removeItem('zamanli_admin'); AdminState.isLoggedIn = false; renderLogin();
}

async function loadAllData() {
    console.log('[Admin] Veriler yükleniyor...'); AdminState.loading = true; renderApp();
    try {
        const salonsSnap = await db.collection('salons').get();
        AdminState.salons = salonsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('[Admin] Salonlar:', AdminState.salons.length);
        
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const aptSnap = await db.collection('appointments').where('date', '>=', thirtyDaysAgo.toISOString().split('T')[0]).orderBy('date', 'desc').limit(1000).get();
        AdminState.allAppointments = aptSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('[Admin] Randevular:', AdminState.allAppointments.length);
        
        // Müşterileri randevulardan ve salon customer koleksiyonlarından topla
        await loadAllCustomers();
        
        calculateStats(); setupRealtimeListeners();
    } catch (e) { console.error('[Admin] Veri yükleme hatası:', e); showToast('Hata: ' + e.message, 'error'); }
    AdminState.loading = false; renderApp();
}

async function loadAllCustomers() {
    const customerMap = new Map();
    
    // 1. Tüm randevulardan müşterileri topla
    AdminState.allAppointments.forEach(apt => {
        if (apt.customerPhone && apt.customerName) {
            const phone = apt.customerPhone.replace(/\D/g, '').slice(-10);
            if (phone && phone.length === 10) {
                const existing = customerMap.get(phone);
                if (!existing) {
                    customerMap.set(phone, {
                        name: apt.customerName,
                        phone: phone,
                        salonId: apt.salonId,
                        salonName: apt.salonName || AdminState.salons.find(s => s.id === apt.salonId)?.name || '-',
                        appointmentCount: 1,
                        lastAppointment: apt.date,
                        createdAt: apt.createdAt || apt.date
                    });
                } else {
                    existing.appointmentCount++;
                    if (apt.date > (existing.lastAppointment || '')) {
                        existing.lastAppointment = apt.date;
                    }
                    // En eski createdAt'i koru
                    if (apt.createdAt && (!existing.createdAt || apt.createdAt < existing.createdAt)) {
                        existing.createdAt = apt.createdAt;
                    }
                }
            }
        }
    });
    
    // 2. Salon customer koleksiyonlarından da ekle
    for (const salon of AdminState.salons.slice(0, 50)) { // İlk 50 salon için
        try {
            const custSnap = await db.collection('salons').doc(salon.id).collection('customers').get();
            custSnap.docs.forEach(doc => {
                const cust = doc.data();
                const phone = (cust.phone || '').replace(/\D/g, '').slice(-10);
                if (phone && phone.length === 10 && !customerMap.has(phone)) {
                    customerMap.set(phone, {
                        id: doc.id,
                        name: cust.name || 'İsimsiz',
                        phone: phone,
                        email: cust.email || '',
                        salonId: salon.id,
                        salonName: salon.name,
                        appointmentCount: 0,
                        isManual: true,
                        createdAt: cust.createdAt || ''
                    });
                }
            });
        } catch (e) {
            // Koleksiyon olmayabilir
        }
    }
    
    // En son kayıt en üstte olacak şekilde sırala (createdAt DESC)
    AdminState.allCustomers = Array.from(customerMap.values()).sort((a, b) => {
        let dateA = a.createdAt || a.lastAppointment || '';
        let dateB = b.createdAt || b.lastAppointment || '';
        
        // Timestamp objesi ise string'e çevir
        try {
            if (dateA && typeof dateA === 'object') {
                if (dateA.toDate) dateA = dateA.toDate().toISOString();
                else if (dateA.seconds) dateA = new Date(dateA.seconds * 1000).toISOString();
            }
            if (dateB && typeof dateB === 'object') {
                if (dateB.toDate) dateB = dateB.toDate().toISOString();
                else if (dateB.seconds) dateB = new Date(dateB.seconds * 1000).toISOString();
            }
        } catch (e) {
            console.log('Date conversion error:', e);
        }
        
        // String değilse dönüştür
        dateA = String(dateA || '0000-00-00');
        dateB = String(dateB || '0000-00-00');
        
        // En yeni en üstte (DESC)
        if (dateB > dateA) return 1;
        if (dateB < dateA) return -1;
        return 0;
    });
    
    console.log('[Admin] Müşteriler:', AdminState.allCustomers.length);
}

function calculateStats() {
    const today = new Date().toISOString().split('T')[0];
    AdminState.stats = {
        totalSalons: AdminState.salons.length,
        activeSalons: AdminState.salons.filter(s => s.active && s.status !== 'pending').length,
        pendingSalons: AdminState.salons.filter(s => s.status === 'pending').length,
        totalAppointments: AdminState.allAppointments.length,
        todayAppointments: AdminState.allAppointments.filter(a => a.date === today).length,
        totalCustomers: AdminState.allCustomers.length
    };
}

function setupRealtimeListeners() {
    AdminState.listeners.forEach(u => { try { u(); } catch(e) {} }); AdminState.listeners = [];
    const unsubSalons = db.collection('salons').onSnapshot(snap => {
        AdminState.salons = snap.docs.map(d => ({ id: d.id, ...d.data() })); calculateStats();
        if (AdminState.selectedSalon) {
            const updated = AdminState.salons.find(s => s.id === AdminState.selectedSalon.id);
            if (updated) { AdminState.selectedSalon = updated; AdminState.salonStaff = updated.staff || []; AdminState.salonServices = updated.services || []; }
        }
        renderApp();
    }); AdminState.listeners.push(unsubSalons);
}

async function loadSalonDetails(id) {
    AdminState.loading = true; renderApp();
    try {
        const salonDoc = await db.collection('salons').doc(id).get();
        if (!salonDoc.exists) { showToast('Salon bulunamadı', 'error'); AdminState.currentView = 'salons'; AdminState.loading = false; renderApp(); return; }
        AdminState.selectedSalon = { id: salonDoc.id, ...salonDoc.data() };
        AdminState.salonStaff = (AdminState.selectedSalon.staff || []).map((s, i) => ({ id: s.id || 'staff-' + i, ...s }));
        AdminState.salonServices = (AdminState.selectedSalon.services || []).map((s, i) => ({ id: s.id || 'svc-' + i, ...s }));
        
        // Randevuları yükle
        const aptSnap = await db.collection('appointments').where('salonId', '==', id).orderBy('date', 'desc').limit(100).get();
        AdminState.salonAppointments = aptSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Müşterileri yükle
        await loadSalonCustomers(id);
        
        AdminState.currentView = 'salon-detail'; AdminState.detailTab = 'info';
    } catch (e) { console.error('[Admin] Salon detay hatası:', e); showToast('Hata: ' + e.message, 'error'); }
    AdminState.loading = false; renderApp();
}

async function loadSalonCustomers(salonId) {
    const customerMap = new Map();
    
    // 0. Önce silinen müşterileri al (blacklist)
    const deletedSet = new Set();
    try {
        const deletedSnap = await db.collection('salons').doc(salonId).collection('deletedCustomers').get();
        deletedSnap.docs.forEach(doc => deletedSet.add(doc.id));
    } catch (e) {}
    
    // 1. Randevulardan müşterileri topla (silinmemişleri)
    AdminState.salonAppointments.forEach(apt => {
        if (apt.customerPhone && apt.customerName) {
            const phone = apt.customerPhone.replace(/\D/g, '').slice(-10);
            if (phone && phone.length === 10 && !deletedSet.has(phone)) {
                const existing = customerMap.get(phone);
                if (!existing) {
                    customerMap.set(phone, {
                        name: apt.customerName,
                        phone: phone,
                        appointmentCount: 1,
                        lastAppointment: apt.date,
                        totalSpent: apt.status === 'completed' ? (apt.servicePrice || 0) : 0,
                        createdAt: apt.createdAt || apt.date
                    });
                } else {
                    existing.appointmentCount++;
                    if (apt.date > (existing.lastAppointment || '')) {
                        existing.lastAppointment = apt.date;
                    }
                    if (apt.status === 'completed') {
                        existing.totalSpent = (existing.totalSpent || 0) + (apt.servicePrice || 0);
                    }
                    // En eski createdAt'i koru (ilk kayıt tarihi)
                    if (apt.createdAt && (!existing.createdAt || apt.createdAt < existing.createdAt)) {
                        existing.createdAt = apt.createdAt;
                    }
                }
            }
        }
    });
    
    // 2. Manuel eklenen müşterileri de ekle (silinmemişleri)
    try {
        const custSnap = await db.collection('salons').doc(salonId).collection('customers').get();
        custSnap.docs.forEach(doc => {
            const cust = doc.data();
            const phone = (cust.phone || '').replace(/\D/g, '').slice(-10);
            if (phone && phone.length === 10 && !deletedSet.has(phone)) {
                if (!customerMap.has(phone)) {
                    customerMap.set(phone, {
                        id: doc.id,
                        name: cust.name || 'İsimsiz',
                        phone: phone,
                        email: cust.email || '',
                        appointmentCount: 0,
                        totalSpent: 0,
                        isManual: true,
                        createdAt: cust.createdAt || ''
                    });
                }
            }
        });
    } catch (e) {
        console.log('No customers collection');
    }
    
    // En son kayıt en üstte olacak şekilde sırala (createdAt DESC)
    AdminState.salonCustomers = Array.from(customerMap.values()).sort((a, b) => {
        let dateA = a.createdAt || a.lastAppointment || '';
        let dateB = b.createdAt || b.lastAppointment || '';
        
        // Timestamp objesi ise string'e çevir
        try {
            if (dateA && typeof dateA === 'object') {
                if (dateA.toDate) dateA = dateA.toDate().toISOString();
                else if (dateA.seconds) dateA = new Date(dateA.seconds * 1000).toISOString();
            }
            if (dateB && typeof dateB === 'object') {
                if (dateB.toDate) dateB = dateB.toDate().toISOString();
                else if (dateB.seconds) dateB = new Date(dateB.seconds * 1000).toISOString();
            }
        } catch (e) {}
        
        dateA = String(dateA || '0000-00-00');
        dateB = String(dateB || '0000-00-00');
        
        // En yeni en üstte (DESC)
        if (dateB > dateA) return 1;
        if (dateB < dateA) return -1;
        return 0;
    });
}
        } catch (e) {}
        
        dateA = String(dateA || '0000-00-00');
        dateB = String(dateB || '0000-00-00');
        
        if (dateB > dateA) return 1;
        if (dateB < dateA) return -1;
        return 0;
    });
    
    console.log('[Admin] Salon müşterileri:', AdminState.salonCustomers.length);
}

function renderApp() {
    if (!AdminState.isLoggedIn) { renderLogin(); return; }
    document.getElementById('app').innerHTML = '<div class="admin-layout">' + renderSidebar() + '<main class="admin-main">' + (AdminState.loading ? '<div class="loading-container"><div class="spinner"></div><p>Yükleniyor...</p></div>' : renderView()) + '</main></div>';
}

function renderLogin() {
    document.getElementById('app').innerHTML = '<div class="login-container"><div class="login-card"><div class="login-icon">🔐</div><h1>Süper Admin</h1><p>Şifrenizi girin</p><input type="password" id="pinInput" class="pin-input" placeholder="Şifre" style="letter-spacing:0;text-align:left;padding-left:1rem;" onkeypress="if(event.key===\'Enter\')login()"><button onclick="login()" class="btn btn-primary btn-block">Giriş Yap</button><p class="login-footer">Zamanli Admin v3.0</p></div></div>';
    document.getElementById('pinInput')?.focus();
}

function renderSidebar() {
    const p = AdminState.stats.pendingSalons, t = AdminState.stats.todayAppointments;
    return '<aside class="admin-sidebar"><div class="sidebar-header"><span class="sidebar-icon">💈</span><span class="sidebar-title">Zamanli</span><span class="sidebar-badge">Admin</span></div><nav class="sidebar-nav"><a href="#" onclick="nav(\'dashboard\')" class="nav-item ' + (AdminState.currentView === 'dashboard' ? 'active' : '') + '"><span>📊</span> Dashboard</a><a href="#" onclick="nav(\'salons\')" class="nav-item ' + (AdminState.currentView.includes('salon') ? 'active' : '') + '"><span>💈</span> Salonlar' + (p > 0 ? '<span class="nav-badge">' + p + '</span>' : '') + '</a><a href="#" onclick="nav(\'appointments\')" class="nav-item ' + (AdminState.currentView === 'appointments' ? 'active' : '') + '"><span>📅</span> Randevular' + (t > 0 ? '<span class="nav-badge success">' + t + '</span>' : '') + '</a><a href="#" onclick="nav(\'customers\')" class="nav-item ' + (AdminState.currentView === 'customers' ? 'active' : '') + '"><span>👥</span> Müşteriler</a><a href="#" onclick="nav(\'settings\')" class="nav-item ' + (AdminState.currentView === 'settings' ? 'active' : '') + '"><span>⚙️</span> Ayarlar</a></nav><div class="sidebar-footer"><a href="#" onclick="refreshData()" class="nav-item"><span>🔄</span> Yenile</a><a href="#" onclick="logout()" class="nav-item logout"><span>🚪</span> Çıkış</a></div></aside>';
}

function renderView() {
    switch (AdminState.currentView) {
        case 'dashboard': return renderDashboard();
        case 'salons': return renderSalons();
        case 'salon-detail': return renderSalonDetail();
        case 'appointments': return renderAllAppointments();
        case 'customers': return renderCustomers();
        case 'settings': return renderSettings();
        default: return renderDashboard();
    }
}

function nav(view) { AdminState.currentView = view; AdminState.selectedSalon = null; renderApp(); }
async function refreshData() { showToast('Yenileniyor...', 'info'); await loadAllData(); showToast('Güncellendi!', 'success'); }
function switchTab(tab) { AdminState.currentTab = tab; renderApp(); }
function switchDetailTab(tab) { AdminState.detailTab = tab; renderApp(); }

function renderDashboard() {
    const { totalSalons, activeSalons, pendingSalons, totalAppointments, todayAppointments, totalCustomers } = AdminState.stats;
    const recentSalons = [...AdminState.salons].filter(s => s.status !== 'pending').sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5);
    const today = new Date().toISOString().split('T')[0];
    const todaysApts = AdminState.allAppointments.filter(a => a.date === today).sort((a, b) => (a.time || '').localeCompare(b.time || '')).slice(0, 10);
    
    let h = '<div class="view-header"><h1>Dashboard</h1><button onclick="refreshData()" class="btn btn-outline btn-sm">🔄 Yenile</button></div>';
    h += '<div class="stats-grid"><div class="stat-card"><div class="stat-icon blue">💈</div><div class="stat-value">' + totalSalons + '</div><div class="stat-label">Toplam Salon</div></div>';
    h += '<div class="stat-card"><div class="stat-icon green">✓</div><div class="stat-value">' + activeSalons + '</div><div class="stat-label">Aktif Salon</div></div>';
    h += '<div class="stat-card clickable" onclick="nav(\'salons\');AdminState.currentTab=\'pending\';renderApp()"><div class="stat-icon orange">⏳</div><div class="stat-value">' + pendingSalons + '</div><div class="stat-label">Onay Bekleyen</div></div>';
    h += '<div class="stat-card"><div class="stat-icon purple">📅</div><div class="stat-value">' + todayAppointments + '</div><div class="stat-label">Bugünkü Randevu</div></div>';
    h += '<div class="stat-card"><div class="stat-icon teal">📊</div><div class="stat-value">' + totalAppointments + '</div><div class="stat-label">Toplam Randevu</div></div>';
    h += '<div class="stat-card"><div class="stat-icon pink">👥</div><div class="stat-value">' + totalCustomers + '</div><div class="stat-label">Toplam Müşteri</div></div></div>';
    
    if (pendingSalons > 0) h += '<div class="pending-alert" onclick="nav(\'salons\');AdminState.currentTab=\'pending\';renderApp()"><span>⚠️</span> <strong>' + pendingSalons + '</strong> adet onay bekleyen başvuru var! <span class="alert-link">İncele →</span></div>';
    
    h += '<div class="dashboard-grid"><div class="card"><div class="card-header"><h2>Son Salonlar</h2><button onclick="nav(\'salons\')" class="btn btn-outline btn-sm">Tümü</button></div><table class="data-table"><thead><tr><th>Salon</th><th>Kategori</th><th>Durum</th></tr></thead><tbody>';
    recentSalons.forEach(s => {
        const c = ADMIN_CONFIG.categories[s.category] || ADMIN_CONFIG.categories.berber;
        h += '<tr onclick="loadSalonDetails(\'' + s.id + '\')" style="cursor:pointer"><td><div class="salon-info"><span class="salon-icon">' + c.icon + '</span><div><div class="salon-name">' + esc(s.name) + '</div><div class="salon-slug">/' + s.slug + '</div></div></div></td><td>' + c.name + '</td><td><span class="status-badge ' + (s.active ? 'active' : 'inactive') + '">' + (s.active ? 'Aktif' : 'Pasif') + '</span></td></tr>';
    });
    h += '</tbody></table></div>';
    
    h += '<div class="card"><div class="card-header"><h2>Bugünkü Randevular</h2><button onclick="nav(\'appointments\')" class="btn btn-outline btn-sm">Tümü</button></div>';
    if (todaysApts.length === 0) { h += '<div class="empty-state small"><p>Bugün randevu yok</p></div>'; }
    else {
        h += '<table class="data-table"><thead><tr><th>Saat</th><th>Müşteri</th><th>Salon</th><th>Durum</th></tr></thead><tbody>';
        todaysApts.forEach(a => {
            const salon = AdminState.salons.find(s => s.id === a.salonId);
            h += '<tr><td><strong>' + (a.time || '-') + '</strong></td><td>' + esc(a.customerName || '-') + '</td><td>' + esc(salon?.name || a.salonName || '-') + '</td><td><span class="status-badge ' + (a.status || 'pending') + '">' + getStatusText(a.status) + '</span></td></tr>';
        });
        h += '</tbody></table>';
    }
    h += '</div></div>';
    return h;
}

function renderSalons() {
    const pending = AdminState.salons.filter(s => s.status === 'pending').length;
    let list = AdminState.salons;
    if (AdminState.currentTab === 'pending') list = list.filter(s => s.status === 'pending');
    else if (AdminState.currentTab === 'active') list = list.filter(s => s.active && s.status !== 'pending');
    else if (AdminState.currentTab === 'inactive') list = list.filter(s => !s.active && s.status !== 'pending');
    if (AdminState.currentCategory !== 'all') list = list.filter(s => (s.category || 'berber') === AdminState.currentCategory);
    if (AdminState.searchQuery) { const q = AdminState.searchQuery.toLowerCase(); list = list.filter(s => s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.slug?.toLowerCase().includes(q)); }
    
    let h = '<div class="view-header"><h1>Salonlar</h1><button onclick="showCreateSalonModal()" class="btn btn-primary">+ Yeni Salon</button></div>';
    h += '<div class="salon-tabs"><button onclick="switchTab(\'active\')" class="tab-btn ' + (AdminState.currentTab === 'active' ? 'active' : '') + '">Aktif (' + AdminState.salons.filter(s => s.active && s.status !== 'pending').length + ')</button><button onclick="switchTab(\'pending\')" class="tab-btn ' + (AdminState.currentTab === 'pending' ? 'active' : '') + '">Bekleyen' + (pending > 0 ? '<span class="tab-badge">' + pending + '</span>' : '') + '</button><button onclick="switchTab(\'inactive\')" class="tab-btn ' + (AdminState.currentTab === 'inactive' ? 'active' : '') + '">Pasif</button><button onclick="switchTab(\'all\')" class="tab-btn ' + (AdminState.currentTab === 'all' ? 'active' : '') + '">Tümü (' + AdminState.salons.length + ')</button></div>';
    h += '<div class="filters-bar"><input type="text" class="search-input" placeholder="Salon ara..." value="' + AdminState.searchQuery + '" oninput="AdminState.searchQuery=this.value;renderApp()"><select class="filter-select" onchange="AdminState.currentCategory=this.value;renderApp()"><option value="all">Tüm Kategoriler</option><option value="berber"' + (AdminState.currentCategory === 'berber' ? ' selected' : '') + '>💈 Berber</option><option value="kuafor"' + (AdminState.currentCategory === 'kuafor' ? ' selected' : '') + '>💇‍♀️ Kuaför</option><option value="beauty"' + (AdminState.currentCategory === 'beauty' ? ' selected' : '') + '>💆 Güzellik</option></select></div>';
    
    if (AdminState.currentTab === 'pending') { h += renderPendingSalons(list); }
    else { h += renderSalonTable(list); }
    return h;
}

function renderPendingSalons(list) {
    if (list.length === 0) return '<div class="empty-state"><div class="empty-icon">✓</div><h3>Onay bekleyen yok</h3></div>';
    let h = '<div class="pending-list">';
    list.forEach(s => {
        const c = ADMIN_CONFIG.categories[s.category] || ADMIN_CONFIG.categories.berber;
        const d = s.createdAt ? new Date(s.createdAt).toLocaleDateString('tr-TR') : '-';
        h += '<div class="pending-card"><div class="pending-header"><div><h3>' + c.icon + ' ' + esc(s.name) + '</h3><p class="slug">/' + s.slug + '</p></div><span class="badge badge-warning">Bekliyor</span></div>';
        h += '<div class="pending-details"><div class="detail-item"><span class="detail-label">Yetkili</span><span class="detail-value">' + esc(s.ownerName || '-') + '</span></div><div class="detail-item"><span class="detail-label">Telefon</span><span class="detail-value">' + (s.phone || '-') + '</span></div><div class="detail-item"><span class="detail-label">E-posta</span><span class="detail-value">' + esc(s.email || '-') + '</span></div><div class="detail-item"><span class="detail-label">Şehir</span><span class="detail-value">' + esc(s.city || '-') + ' / ' + esc(s.district || '-') + '</span></div></div>';
        if (s.staff?.length > 0) h += '<div class="pending-staff"><b>Personel:</b> ' + s.staff.map(x => esc(x.name)).join(', ') + '</div>';
        h += '<div class="pending-footer"><span class="pending-date">Başvuru: ' + d + '</span><div class="pending-actions"><button onclick="loadSalonDetails(\'' + s.id + '\')" class="btn btn-outline btn-sm">👁️ İncele</button><button onclick="rejectSalon(\'' + s.id + '\')" class="btn btn-outline-danger btn-sm">❌ Reddet</button><button onclick="approveSalon(\'' + s.id + '\')" class="btn btn-success btn-sm">✓ Onayla</button></div></div></div>';
    });
    return h + '</div>';
}

function renderSalonTable(list) {
    if (list.length === 0) return '<div class="empty-state"><div class="empty-icon">🔍</div><h3>Salon bulunamadı</h3></div>';
    let h = '<div class="card"><table class="data-table"><thead><tr><th>Salon</th><th>Telefon</th><th>Paket</th><th>Randevu</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>';
    list.forEach(s => {
        const c = ADMIN_CONFIG.categories[s.category] || ADMIN_CONFIG.categories.berber;
        const pkg = ADMIN_CONFIG.packages[s.package] || ADMIN_CONFIG.packages.free;
        const aptCount = AdminState.allAppointments.filter(a => a.salonId === s.id).length;
        h += '<tr><td onclick="loadSalonDetails(\'' + s.id + '\')" style="cursor:pointer"><div class="salon-info"><span class="salon-icon">' + c.icon + '</span><div><div class="salon-name">' + esc(s.name) + '</div><div class="salon-slug">/' + s.slug + '</div></div></div></td><td>' + (s.phone || '-') + '</td><td><span class="badge badge-' + pkg.color + '">' + pkg.name + '</span></td><td>' + aptCount + '</td><td><span class="status-badge ' + (s.active ? 'active' : 'inactive') + '">' + (s.active ? 'Aktif' : 'Pasif') + '</span></td><td><div class="action-buttons"><button onclick="loadSalonDetails(\'' + s.id + '\')" class="btn btn-icon" title="Görüntüle">👁️</button><button onclick="showEditSalonModal(\'' + s.id + '\')" class="btn btn-icon" title="Düzenle">✏️</button><button onclick="toggleSalonStatus(\'' + s.id + '\', ' + (!s.active) + ')" class="btn btn-icon" title="' + (s.active ? 'Pasif' : 'Aktif') + '">' + (s.active ? '🔴' : '🟢') + '</button><button onclick="showQRCodeModal(\'' + s.id + '\')" class="btn btn-icon" title="QR">📱</button></div></td></tr>';
    });
    return h + '</tbody></table></div>';
}

function renderSalonDetail() {
    const s = AdminState.selectedSalon; if (!s) return '<p>Salon bulunamadı</p>';
    const c = ADMIN_CONFIG.categories[s.category] || ADMIN_CONFIG.categories.berber;
    const pkg = ADMIN_CONFIG.packages[s.package] || ADMIN_CONFIG.packages.free;
    const salonCustomerCount = AdminState.salonCustomers ? AdminState.salonCustomers.length : 0;
    
    let h = '<div class="view-header"><div><button onclick="nav(\'salons\')" class="btn btn-outline btn-sm">← Geri</button><h1>' + c.icon + ' ' + esc(s.name) + '</h1><p>/' + s.slug + ' · <span class="status-badge ' + (s.active ? 'active' : 'inactive') + '">' + (s.active ? 'Aktif' : 'Pasif') + '</span> · <span class="badge badge-' + pkg.color + '">' + pkg.name + '</span></p></div><div class="header-actions"><a href="https://zamanli.com/berber/salon/?slug=' + s.slug + '" target="_blank" class="btn btn-outline">🌐 Sayfa</a><a href="https://zamanli.com/berber/salon/yonetim/?slug=' + s.slug + '&admin=true" target="_blank" class="btn btn-outline">⚙️ Panel</a><button onclick="showEditSalonModal(\'' + s.id + '\')" class="btn btn-primary">✏️ Düzenle</button></div></div>';
    h += '<div class="detail-tabs"><button onclick="switchDetailTab(\'info\')" class="tab-btn ' + (AdminState.detailTab === 'info' ? 'active' : '') + '">ℹ️ Bilgiler</button><button onclick="switchDetailTab(\'staff\')" class="tab-btn ' + (AdminState.detailTab === 'staff' ? 'active' : '') + '">👥 Personel (' + AdminState.salonStaff.length + ')</button><button onclick="switchDetailTab(\'services\')" class="tab-btn ' + (AdminState.detailTab === 'services' ? 'active' : '') + '">✂️ Hizmetler (' + AdminState.salonServices.length + ')</button><button onclick="switchDetailTab(\'customers\')" class="tab-btn ' + (AdminState.detailTab === 'customers' ? 'active' : '') + '">👤 Müşteriler (' + salonCustomerCount + ')</button><button onclick="switchDetailTab(\'appointments\')" class="tab-btn ' + (AdminState.detailTab === 'appointments' ? 'active' : '') + '">📅 Randevular (' + AdminState.salonAppointments.length + ')</button><button onclick="switchDetailTab(\'hours\')" class="tab-btn ' + (AdminState.detailTab === 'hours' ? 'active' : '') + '">🕐 Saatler</button><button onclick="switchDetailTab(\'admin\')" class="tab-btn ' + (AdminState.detailTab === 'admin' ? 'active' : '') + '">🔐 Admin</button></div>';
    h += renderDetailContent();
    return h;
}

function renderDetailContent() {
    const s = AdminState.selectedSalon;
    switch (AdminState.detailTab) {
        case 'info': return renderSalonInfo(s);
        case 'staff': return renderSalonStaff();
        case 'services': return renderSalonServices();
        case 'customers': return renderSalonCustomers();
        case 'appointments': return renderSalonAppointments();
        case 'hours': return renderWorkingHours(s);
        case 'admin': return renderAdminControls(s);
        default: return renderSalonInfo(s);
    }
}

function renderSalonInfo(s) {
    const c = ADMIN_CONFIG.categories[s.category] || ADMIN_CONFIG.categories.berber;
    let h = '<div class="detail-grid"><div class="card"><h3>Temel Bilgiler</h3><div class="info-list"><div class="info-row"><span class="info-label">Salon Adı</span><span class="info-value">' + esc(s.name) + '</span></div><div class="info-row"><span class="info-label">Slug</span><span class="info-value">/' + s.slug + '</span></div><div class="info-row"><span class="info-label">Kategori</span><span class="info-value">' + c.icon + ' ' + c.name + '</span></div><div class="info-row"><span class="info-label">Paket</span><span class="info-value">' + (s.package || 'free') + '</span></div><div class="info-row"><span class="info-label">Kayıt</span><span class="info-value">' + (s.createdAt ? new Date(s.createdAt).toLocaleDateString('tr-TR') : '-') + '</span></div></div></div>';
    h += '<div class="card"><h3>İletişim</h3><div class="info-list"><div class="info-row"><span class="info-label">Yetkili</span><span class="info-value">' + esc(s.ownerName || '-') + '</span></div><div class="info-row"><span class="info-label">Telefon</span><span class="info-value">' + (s.phone || '-') + '</span></div><div class="info-row"><span class="info-label">E-posta</span><span class="info-value">' + esc(s.email || '-') + '</span></div><div class="info-row"><span class="info-label">Şehir</span><span class="info-value">' + esc(s.city || '-') + ' / ' + esc(s.district || '-') + '</span></div></div></div>';
    h += '<div class="card"><h3>📱 QR Kod</h3><div style="display:flex;gap:1rem;align-items:center;margin-top:1rem">' + (s.qrCodeUrl ? '<img src="' + s.qrCodeUrl + '" alt="QR" style="width:120px;height:120px;border-radius:8px">' : '<p>QR kod yok</p>') + '<div><button onclick="regenerateQRCode(\'' + s.id + '\')" class="btn btn-outline btn-sm">🔄 Oluştur</button>' + (s.qrCodeUrl ? '<button onclick="downloadQRCode(\'' + s.id + '\')" class="btn btn-outline btn-sm" style="margin-top:0.5rem">📥 İndir</button>' : '') + '</div></div></div>';
    h += '<div class="card"><h3>📊 İstatistik</h3><div class="info-list"><div class="info-row"><span class="info-label">Randevu</span><span class="info-value">' + AdminState.salonAppointments.length + '</span></div><div class="info-row"><span class="info-label">Personel</span><span class="info-value">' + AdminState.salonStaff.length + '</span></div><div class="info-row"><span class="info-label">Hizmet</span><span class="info-value">' + AdminState.salonServices.length + '</span></div></div></div></div>';
    return h;
}

function renderSalonStaff() {
    let h = '<div class="card"><div class="card-header"><h3>Personel</h3><button onclick="showAddStaffModal()" class="btn btn-primary btn-sm">+ Ekle</button></div>';
    if (AdminState.salonStaff.length === 0) h += '<div class="empty-state small"><p>Personel yok</p></div>';
    else {
        h += '<table class="data-table"><thead><tr><th>Ad Soyad</th><th>Rol</th><th>Telefon</th><th>PIN</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>';
        AdminState.salonStaff.forEach(st => {
            h += '<tr><td><strong>' + esc(st.name) + '</strong></td><td>' + esc(st.role || st.title || '-') + '</td><td>' + (st.phone || '-') + '</td><td><code>' + (st.pin || '-') + '</code></td><td><span class="status-badge ' + (st.active !== false ? 'active' : 'inactive') + '">' + (st.active !== false ? 'Aktif' : 'Pasif') + '</span></td><td><button onclick="showEditStaffModal(\'' + st.id + '\')" class="btn btn-icon">✏️</button><button onclick="deleteStaff(\'' + st.id + '\')" class="btn btn-icon danger">🗑️</button></td></tr>';
        });
        h += '</tbody></table>';
    }
    return h + '</div>';
}

function renderSalonServices() {
    let h = '<div class="card"><div class="card-header"><h3>Hizmetler</h3><button onclick="showAddServiceModal()" class="btn btn-primary btn-sm">+ Ekle</button></div>';
    if (AdminState.salonServices.length === 0) h += '<div class="empty-state small"><p>Hizmet yok</p></div>';
    else {
        h += '<table class="data-table"><thead><tr><th>Hizmet</th><th>Fiyat</th><th>Süre</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>';
        AdminState.salonServices.forEach(sv => {
            h += '<tr><td>' + (sv.icon || '✂️') + ' <strong>' + esc(sv.name) + '</strong></td><td>' + (sv.price || 0) + ' ₺</td><td>' + (sv.duration || 30) + ' dk</td><td><span class="status-badge ' + (sv.active !== false ? 'active' : 'inactive') + '">' + (sv.active !== false ? 'Aktif' : 'Pasif') + '</span></td><td><button onclick="showEditServiceModal(\'' + sv.id + '\')" class="btn btn-icon">✏️</button><button onclick="deleteService(\'' + sv.id + '\')" class="btn btn-icon danger">🗑️</button></td></tr>';
        });
        h += '</tbody></table>';
    }
    return h + '</div>';
}

function renderSalonCustomers() {
    // Müşterileri createdAt'e göre sırala (en yeni en üstte)
    const sortedCustomers = [...(AdminState.salonCustomers || [])].sort((a, b) => {
        let dateA = a.createdAt || a.lastAppointment || '0000-00-00';
        let dateB = b.createdAt || b.lastAppointment || '0000-00-00';
        
        try {
            if (dateA && typeof dateA === 'object') {
                if (dateA.toDate) dateA = dateA.toDate().toISOString();
                else if (dateA.seconds) dateA = new Date(dateA.seconds * 1000).toISOString();
            }
            if (dateB && typeof dateB === 'object') {
                if (dateB.toDate) dateB = dateB.toDate().toISOString();
                else if (dateB.seconds) dateB = new Date(dateB.seconds * 1000).toISOString();
            }
        } catch (e) {}
        
        dateA = String(dateA || '0000-00-00');
        dateB = String(dateB || '0000-00-00');
        
        if (dateB > dateA) return 1;
        if (dateB < dateA) return -1;
        return 0;
    });
    
    let h = '<div class="card"><div class="card-header"><h3>Müşteriler</h3><div style="display:flex;gap:0.5rem;align-items:center"><span class="badge badge-info">' + sortedCustomers.length + ' müşteri</span><button onclick="syncCustomersFromAppointments()" class="btn btn-outline btn-sm" title="Randevulardaki müşterileri kaydet">🔄 Senkronize Et</button></div></div>';
    if (sortedCustomers.length === 0) h += '<div class="empty-state small"><p>Henüz müşteri yok</p><p style="font-size:0.8rem;color:var(--slate-400)">Senkronize Et butonuna tıklayarak randevulardaki müşterileri ekleyebilirsiniz</p></div>';
    else {
        h += '<table class="data-table"><thead><tr><th>Ad Soyad</th><th>Telefon</th><th>Randevu</th><th>Toplam</th><th>Son Randevu</th><th>İşlem</th></tr></thead><tbody>';
        sortedCustomers.slice(0, 50).forEach(c => {
            h += '<tr><td><strong>' + esc(c.name || 'İsimsiz') + '</strong>' + (c.isManual ? ' <span class="badge badge-info" style="font-size:0.6rem">Manuel</span>' : '') + '</td><td>0' + (c.phone || '-') + '</td><td>' + (c.appointmentCount || 0) + '</td><td>' + (c.totalSpent || 0) + ' ₺</td><td>' + (c.lastAppointment || '-') + '</td><td><button onclick="deleteCustomerFromSalon(\'' + c.phone + '\')" class="btn btn-icon danger" title="Sil">🗑️</button></td></tr>';
        });
        h += '</tbody></table>';
        if (sortedCustomers.length > 50) {
            h += '<p style="text-align:center;padding:0.5rem;color:var(--slate-500);font-size:0.85rem">İlk 50 müşteri gösteriliyor</p>';
        }
    }
    return h + '</div>';
}

async function deleteCustomerFromSalon(phone) {
    if (!confirm('Bu müşteriyi silmek istediğinize emin misiniz?\n\nMüşteri kaydı silinecek. Randevular korunacak.')) return;
    
    try {
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        const salonId = AdminState.selectedSalon.id;
        
        // 1. Müşteriyi sil
        try {
            await db.collection('salons').doc(salonId).collection('customers').doc(cleanPhone).delete();
            console.log('[Delete] Müşteri silindi:', cleanPhone);
        } catch (e) {
            console.log('[Delete] Doc silme hatası:', e.message);
        }
        
        // 2. Silinen müşterileri blacklist'e ekle (tekrar senkronize edilmemesi için)
        try {
            await db.collection('salons').doc(salonId).collection('deletedCustomers').doc(cleanPhone).set({
                phone: cleanPhone,
                deletedAt: new Date().toISOString(),
                deletedBy: 'admin'
            });
            console.log('[Delete] Blacklist\'e eklendi:', cleanPhone);
        } catch (e) {
            console.log('[Delete] Blacklist hatası:', e.message);
        }
        
        showToast('Müşteri silindi ✅', 'success');
        
        // Lokal listeden kaldır
        AdminState.salonCustomers = AdminState.salonCustomers.filter(c => c.phone !== phone && c.phone !== cleanPhone);
        renderApp();
        
    } catch (e) {
        console.error('[Delete] Hata:', e);
        showToast('Hata: ' + e.message, 'error');
    }
}

// Randevulardaki müşterileri customers koleksiyonuna kaydet
async function syncCustomersFromAppointments() {
    if (!AdminState.selectedSalon) return;
    
    showToast('Müşteriler senkronize ediliyor...', 'info');
    
    try {
        const salonId = AdminState.selectedSalon.id;
        const customerMap = new Map();
        
        // Önce silinen müşterileri al (blacklist)
        const deletedSet = new Set();
        try {
            const deletedSnap = await db.collection('salons').doc(salonId).collection('deletedCustomers').get();
            deletedSnap.docs.forEach(doc => deletedSet.add(doc.id));
            console.log('[Sync] Blacklist:', deletedSet.size, 'müşteri');
        } catch (e) {}
        
        // Randevulardan müşterileri topla
        AdminState.salonAppointments.forEach(apt => {
            if (apt.customerPhone && apt.customerName) {
                const phone = apt.customerPhone.replace(/\D/g, '').slice(-10);
                if (phone && phone.length === 10 && !deletedSet.has(phone)) {
                    const existing = customerMap.get(phone);
                    if (!existing) {
                        customerMap.set(phone, {
                            name: apt.customerName,
                            phone: phone,
                            lastAppointmentAt: apt.date || apt.createdAt,
                            appointmentCount: 1
                        });
                    } else {
                        existing.appointmentCount++;
                        if (apt.date > (existing.lastAppointmentAt || '')) {
                            existing.lastAppointmentAt = apt.date;
                        }
                    }
                }
            }
        });
        
        // Her müşteriyi customers koleksiyonuna kaydet
        let savedCount = 0;
        const batch = db.batch();
        
        for (const [phone, cust] of customerMap) {
            const docRef = db.collection('salons').doc(salonId).collection('customers').doc(phone);
            batch.set(docRef, {
                name: cust.name,
                phone: phone,
                salonId: salonId,
                lastAppointmentAt: cust.lastAppointmentAt || new Date().toISOString(),
                source: 'sync',
                syncedAt: new Date().toISOString()
            }, { merge: true });
            savedCount++;
        }
        
        await batch.commit();
        
        showToast(`${savedCount} müşteri senkronize edildi ✅`, 'success');
        
        // Listeyi yenile
        await loadSalonCustomers(salonId);
        renderApp();
        
    } catch (e) {
        console.error('[Sync] Hata:', e);
        showToast('Senkronizasyon hatası: ' + e.message, 'error');
    }
}

function renderSalonAppointments() {
    let h = '<div class="card"><div class="card-header"><h3>Randevular</h3></div>';
    if (AdminState.salonAppointments.length === 0) h += '<div class="empty-state small"><p>Randevu yok</p></div>';
    else {
        h += '<table class="data-table"><thead><tr><th>Tarih</th><th>Saat</th><th>Müşteri</th><th>Hizmet</th><th>Personel</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>';
        AdminState.salonAppointments.slice(0, 50).forEach(apt => {
            h += '<tr><td>' + (apt.date || '-') + '</td><td><strong>' + (apt.time || '-') + '</strong></td><td><div>' + esc(apt.customerName || '-') + '</div><small>' + (apt.customerPhone || '') + '</small></td><td>' + esc(apt.service || apt.serviceName || '-') + '</td><td>' + esc(apt.staffName || '-') + '</td><td><span class="status-badge ' + (apt.status || 'pending') + '">' + getStatusText(apt.status) + '</span></td><td><button onclick="showEditAppointmentModal(\'' + apt.id + '\')" class="btn btn-icon">✏️</button><button onclick="deleteAppointment(\'' + apt.id + '\')" class="btn btn-icon danger">🗑️</button></td></tr>';
        });
        h += '</tbody></table>';
    }
    return h + '</div>';
}

function renderWorkingHours(s) {
    const days = [{key:'mon',name:'Pazartesi'},{key:'tue',name:'Salı'},{key:'wed',name:'Çarşamba'},{key:'thu',name:'Perşembe'},{key:'fri',name:'Cuma'},{key:'sat',name:'Cumartesi'},{key:'sun',name:'Pazar'}];
    const hours = s.workingHours || {};
    let h = '<div class="card"><div class="card-header"><h3>Çalışma Saatleri</h3><button onclick="saveWorkingHours()" class="btn btn-primary btn-sm">💾 Kaydet</button></div><div class="hours-grid">';
    days.forEach(d => {
        const hr = hours[d.key] || { open: '09:00', close: '19:00', closed: false };
        h += '<div class="hour-row"><span class="day-name">' + d.name + '</span><input type="time" id="hour-' + d.key + '-open" class="form-input" value="' + (hr.open || '09:00') + '"' + (hr.closed ? ' disabled' : '') + '><span>-</span><input type="time" id="hour-' + d.key + '-close" class="form-input" value="' + (hr.close || '19:00') + '"' + (hr.closed ? ' disabled' : '') + '><label class="checkbox-label"><input type="checkbox" id="hour-' + d.key + '-closed"' + (hr.closed ? ' checked' : '') + ' onchange="toggleDayClosed(\'' + d.key + '\')"><span>Kapalı</span></label></div>';
    });
    return h + '</div></div>';
}

function renderAdminControls(s) {
    let h = '<div class="card danger-zone"><h3>🔐 Admin Kontrolleri</h3>';
    h += '<div class="admin-section"><h4>Giriş Bilgileri</h4><div class="info-list"><div class="info-row"><span class="info-label">PIN</span><span class="info-value"><code style="font-size:1.2em">' + (s.pin || 'Yok') + '</code></span></div></div><button onclick="showChangePinModal(\'' + s.id + '\')" class="btn btn-outline btn-sm" style="margin-top:1rem">🔑 PIN Değiştir</button></div>';
    h += '<div class="admin-section"><h4>Durum</h4>' + (s.active ? '<button onclick="toggleSalonStatus(\'' + s.id + '\', false)" class="btn btn-warning">🔴 Pasif Yap</button>' : '<button onclick="toggleSalonStatus(\'' + s.id + '\', true)" class="btn btn-success">🟢 Aktif Yap</button>') + '</div>';
    h += '<div class="admin-section"><h4>Paket</h4><select id="packageSelect" class="form-select" style="max-width:200px">';
    Object.entries(ADMIN_CONFIG.packages).forEach(([k, p]) => { h += '<option value="' + k + '"' + (s.package === k ? ' selected' : '') + '>' + p.name + ' (' + p.price + '₺)</option>'; });
    h += '</select><button onclick="changePackage(\'' + s.id + '\')" class="btn btn-primary btn-sm" style="margin-left:1rem">Değiştir</button></div>';
    h += '<div class="admin-section danger"><h4>⚠️ Tehlikeli</h4><button onclick="permanentDeleteSalon(\'' + s.id + '\')" class="btn btn-danger">🗑️ Kalıcı Sil</button></div></div>';
    return h;
}

function renderAllAppointments() {
    const today = new Date().toISOString().split('T')[0];
    let list = [...AdminState.allAppointments].sort((a, b) => { 
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) {
            if (dateB > dateA) return 1;
            if (dateB < dateA) return -1;
            return 0;
        }
        return (a.time || '').localeCompare(b.time || ''); 
    });
    let h = '<div class="view-header"><h1>Tüm Randevular</h1><span class="badge badge-info">' + list.length + ' randevu</span></div>';
    h += '<div class="card"><table class="data-table"><thead><tr><th>Tarih</th><th>Saat</th><th>Salon</th><th>Müşteri</th><th>Hizmet</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>';
    list.slice(0, 100).forEach(apt => {
        const salon = AdminState.salons.find(s => s.id === apt.salonId);
        const isToday = apt.date === today;
        h += '<tr class="' + (isToday ? 'highlight-row' : '') + '"><td>' + (apt.date || '-') + (isToday ? ' <span class="badge badge-success">Bugün</span>' : '') + '</td><td><strong>' + (apt.time || '-') + '</strong></td><td><a href="#" onclick="loadSalonDetails(\'' + apt.salonId + '\');return false">' + esc(salon?.name || '-') + '</a></td><td><div>' + esc(apt.customerName || '-') + '</div><small>' + (apt.customerPhone || '') + '</small></td><td>' + esc(apt.service || apt.serviceName || '-') + '</td><td><span class="status-badge ' + (apt.status || 'pending') + '">' + getStatusText(apt.status) + '</span></td><td><div class="action-buttons"><button onclick="showGlobalEditAppointmentModal(\'' + apt.id + '\')" class="btn btn-icon" title="Düzenle">✏️</button><button onclick="deleteGlobalAppointment(\'' + apt.id + '\')" class="btn btn-icon danger" title="Sil">🗑️</button></div></td></tr>';
    });
    return h + '</tbody></table></div>';
}

function renderCustomers() {
    // Müşterileri createdAt'e göre sırala (en yeni en üstte)
    const sortedCustomers = [...AdminState.allCustomers].sort((a, b) => {
        let dateA = a.createdAt || a.lastAppointment || '0000-00-00';
        let dateB = b.createdAt || b.lastAppointment || '0000-00-00';
        
        // Timestamp objesi ise string'e çevir
        try {
            if (dateA && typeof dateA === 'object') {
                if (dateA.toDate) dateA = dateA.toDate().toISOString();
                else if (dateA.seconds) dateA = new Date(dateA.seconds * 1000).toISOString();
            }
            if (dateB && typeof dateB === 'object') {
                if (dateB.toDate) dateB = dateB.toDate().toISOString();
                else if (dateB.seconds) dateB = new Date(dateB.seconds * 1000).toISOString();
            }
        } catch (e) {}
        
        dateA = String(dateA || '0000-00-00');
        dateB = String(dateB || '0000-00-00');
        
        // En yeni en üstte (DESC)
        if (dateB > dateA) return 1;
        if (dateB < dateA) return -1;
        return 0;
    });
    
    let h = '<div class="view-header"><h1>Müşteriler</h1><span class="badge badge-info">' + sortedCustomers.length + ' müşteri</span><button onclick="loadAllCustomers().then(()=>renderApp())" class="btn btn-outline btn-sm" style="margin-left:1rem">🔄 Yenile</button></div>';
    h += '<div class="filters-bar"><input type="text" id="customerSearchInput" class="search-input" placeholder="İsim veya telefon ara..." oninput="filterCustomers(this.value)"></div>';
    h += '<div class="card">';
    if (sortedCustomers.length === 0) h += '<div class="empty-state"><p>Müşteri bulunamadı. Randevulardan ve salon kayıtlarından otomatik toplanır.</p></div>';
    else {
        h += '<table class="data-table"><thead><tr><th>Ad Soyad</th><th>Telefon</th><th>Salon</th><th>Randevu</th><th>Son Tarih</th><th>Kayıt</th><th>İşlem</th></tr></thead><tbody id="customerTableBody">';
        sortedCustomers.slice(0, 100).forEach(c => { 
            const createdDate = c.createdAt ? (typeof c.createdAt === 'string' ? c.createdAt.split('T')[0] : new Date(c.createdAt).toLocaleDateString('tr-TR')) : '-';
            const lastDate = c.lastAppointment || '-';
            h += '<tr><td><strong>' + esc(c.name || 'İsimsiz') + '</strong>' + (c.isManual ? ' <span class="badge badge-info" style="font-size:0.6rem">Manuel</span>' : '') + '</td><td>0' + (c.phone || '-') + '</td><td>' + esc(c.salonName || '-') + '</td><td>' + (c.appointmentCount || 0) + '</td><td>' + lastDate + '</td><td>' + createdDate + '</td><td><button onclick="deleteGlobalCustomer(\'' + c.phone + '\', \'' + (c.salonId || '') + '\')" class="btn btn-icon danger" title="Sil">🗑️</button></td></tr>'; 
        });
        h += '</tbody></table>';
        if (sortedCustomers.length > 100) {
            h += '<p style="text-align:center;padding:1rem;color:var(--slate-500)">İlk 100 müşteri gösteriliyor (toplam: ' + sortedCustomers.length + ')</p>';
        }
    }
    return h + '</div>';
}

function filterCustomers(query) {
    const tbody = document.getElementById('customerTableBody');
    if (!tbody) return;
    
    query = query.toLowerCase().trim();
    const filtered = query.length < 2 ? AdminState.allCustomers.slice(0, 100) : AdminState.allCustomers.filter(c => 
        (c.name || '').toLowerCase().includes(query) || 
        (c.phone || '').includes(query.replace(/\D/g, ''))
    ).slice(0, 100);
    
    tbody.innerHTML = filtered.map(c => {
        const createdDate = c.createdAt ? (typeof c.createdAt === 'string' ? c.createdAt.split('T')[0] : new Date(c.createdAt).toLocaleDateString('tr-TR')) : '-';
        const lastDate = c.lastAppointment || '-';
        return '<tr><td><strong>' + esc(c.name || 'İsimsiz') + '</strong>' + (c.isManual ? ' <span class="badge badge-info" style="font-size:0.6rem">Manuel</span>' : '') + '</td><td>0' + (c.phone || '-') + '</td><td>' + esc(c.salonName || '-') + '</td><td>' + (c.appointmentCount || 0) + '</td><td>' + lastDate + '</td><td>' + createdDate + '</td></tr>';
    }).join('');
}

function renderSettings() {
    return '<div class="view-header"><h1>Ayarlar</h1></div><div class="detail-grid"><div class="card"><h3>🔐 Güvenlik</h3><p style="color:var(--slate-500);font-size:0.9rem;margin-bottom:1rem;">Süper admin şifresi güvenlik nedeniyle gizlidir.</p><button onclick="showChangePasswordModal()" class="btn btn-outline">🔑 Şifre Değiştir</button></div><div class="card"><h3>🔧 Sistem</h3><div class="info-list"><div class="info-row"><span class="info-label">Firebase Project</span><span class="info-value">' + ADMIN_CONFIG.firebase.projectId + '</span></div><div class="info-row"><span class="info-label">Oturum Süresi</span><span class="info-value">24 saat</span></div></div></div><div class="card"><h3>📊 Veri</h3><button onclick="exportAllData()" class="btn btn-outline">📥 Verileri İndir</button><button onclick="clearLocalCache()" class="btn btn-outline" style="margin-left:1rem">🗑️ Cache Temizle</button></div></div>';
}

function showChangePasswordModal() {
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>🔐 Şifre Değiştir</h2><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body"><p style="color:var(--slate-500);font-size:0.9rem;margin-bottom:1rem;">Süper admin şifresini değiştirmek için mevcut şifreyi doğrulamanız gerekiyor.</p><div class="form-group"><label class="form-label">Mevcut Şifre</label><input type="password" id="currentPassword" class="form-input"></div><div class="form-group"><label class="form-label">Yeni Şifre</label><input type="password" id="newPassword" class="form-input" placeholder="En az 8 karakter"></div><div class="form-group"><label class="form-label">Yeni Şifre (Tekrar)</label><input type="password" id="confirmPassword" class="form-input"></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">İptal</button><button onclick="changeAdminPassword()" class="btn btn-primary">Değiştir</button></div></div></div>';
}

function changeAdminPassword() {
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    
    if (!ADMIN_CONFIG.verifySuperAdmin(current)) {
        showToast('Mevcut şifre yanlış!', 'error');
        return;
    }
    
    if (newPass.length < 6) {
        showToast('Yeni şifre en az 6 karakter olmalı!', 'error');
        return;
    }
    
    if (newPass !== confirm) {
        showToast('Şifreler eşleşmiyor!', 'error');
        return;
    }
    
    // Yeni base64 encoded şifreyi oluştur
    const newEncoded = btoa(newPass);
    
    // Kullanıcıya bilgi ver
    alert('Yeni şifre kodu: ' + newEncoded + '\n\nBu kodu admin-config.js dosyasindaki _sp degerine yapistirin.\n\nDosyayi guncelledikten sonra yeni sifrenizi kullanabilirsiniz.');
    
    closeModal();
    showToast('Kod olusturuldu! admin-config.js dosyasini guncelleyin.', 'success');
}

// ==================== ACTIONS ====================
async function approveSalon(id) {
    if (!confirm('Onaylamak istediğinize emin misiniz?')) return;
    showToast('Onaylanıyor...', 'info');
    try {
        const ref = db.collection('salons').doc(id);
        const doc = await ref.get();
        if (!doc.exists) { showToast('Salon bulunamadı', 'error'); return; }
        const data = doc.data();
        const pin = data.pin || Math.floor(1000 + Math.random() * 9000).toString();
        const salonUrl = 'https://zamanli.com/berber/salon/?slug=' + data.slug;
        const qrCodeUrl = generateQRCodeUrl(salonUrl, 256);
        await ref.update({ active: true, status: 'approved', approvedAt: new Date().toISOString(), qrCodeUrl: qrCodeUrl, pin: pin });
        if (data.email) {
            try {
                await emailjs.send(ADMIN_CONFIG.emailjs.serviceId, ADMIN_CONFIG.emailjs.templateApproval, { to_email: data.email, salon_name: data.name, owner_name: data.ownerName || 'Değerli İşletme Sahibi', salon_url: salonUrl, panel_url: 'https://zamanli.com/berber/salon/yonetim/?slug=' + data.slug, admin_pin: pin, qr_code_url: qrCodeUrl });
                showToast('Onaylandı ve mail gönderildi! PIN: ' + pin, 'success');
            } catch (e) { showToast('Onaylandı! Mail gönderilemedi. PIN: ' + pin, 'warning'); }
        } else { showToast('Onaylandı! PIN: ' + pin, 'success'); }
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function rejectSalon(id) {
    const reason = prompt('Red sebebi:'); if (reason === null) return;
    try { await db.collection('salons').doc(id).update({ active: false, status: 'rejected', rejectionReason: reason, rejectedAt: new Date().toISOString() }); showToast('Reddedildi', 'warning'); } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function toggleSalonStatus(id, active) {
    if (!confirm('Salonu ' + (active ? 'aktif' : 'pasif') + ' yapmak istediğinize emin misiniz?')) return;
    try { await db.collection('salons').doc(id).update({ active, statusUpdatedAt: new Date().toISOString() }); showToast('Salon ' + (active ? 'aktif' : 'pasif') + ' yapıldı', 'success'); if (AdminState.selectedSalon?.id === id) await loadSalonDetails(id); } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function changePackage(id) {
    const pkg = document.getElementById('packageSelect').value;
    try { await db.collection('salons').doc(id).update({ package: pkg, packageUpdatedAt: new Date().toISOString() }); showToast('Paket değiştirildi: ' + pkg, 'success'); if (AdminState.selectedSalon?.id === id) await loadSalonDetails(id); } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function permanentDeleteSalon(id) {
    const s = AdminState.salons.find(x => x.id === id);
    if (!confirm('"' + (s?.name || 'Bu salon') + '" kalıcı olarak silinecek!\n\nTüm randevular, müşteriler ve yorumlar da silinecek.\n\nDevam?')) return;
    if (!confirm('EMİN MİSİNİZ? Bu işlem geri alınamaz!')) return;
    
    try {
        showToast('Siliniyor...', 'info');
        
        // 1. Salon'un alt koleksiyonlarını sil
        const subCollections = ['customers', 'reviews', 'customerNotes'];
        for (const subCol of subCollections) {
            try {
                const snapshot = await db.collection('salons').doc(id).collection(subCol).get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                if (snapshot.size > 0) await batch.commit();
                console.log(`[Delete] ${subCol}: ${snapshot.size} doküman silindi`);
            } catch (e) {
                console.log(`[Delete] ${subCol} silinemedi:`, e.message);
            }
        }
        
        // 2. Bu salona ait randevuları sil
        try {
            const appointmentsSnap = await db.collection('appointments').where('salonId', '==', id).get();
            const batch = db.batch();
            appointmentsSnap.docs.forEach(doc => batch.delete(doc.ref));
            if (appointmentsSnap.size > 0) await batch.commit();
            console.log(`[Delete] appointments: ${appointmentsSnap.size} randevu silindi`);
        } catch (e) {
            console.log('[Delete] Randevular silinemedi:', e.message);
        }
        
        // 3. Ana salon dokümanını sil
        await db.collection('salons').doc(id).delete();
        
        showToast('Salon ve tüm verileri silindi', 'success');
        nav('salons');
        
    } catch (e) {
        console.error('[Delete] Hata:', e);
        showToast('Hata: ' + e.message, 'error');
    }
}

async function regenerateQRCode(id) {
    showToast('QR oluşturuluyor...', 'info');
    try {
        const salon = AdminState.salons.find(s => s.id === id); if (!salon) throw new Error('Salon bulunamadı');
        const salonUrl = 'https://zamanli.com/berber/salon/?slug=' + salon.slug;
        const qrCodeUrl = generateQRCodeUrl(salonUrl, 256);
        await db.collection('salons').doc(id).update({ qrCodeUrl, qrUpdatedAt: new Date().toISOString() });
        showToast('QR oluşturuldu!', 'success'); if (AdminState.selectedSalon?.id === id) await loadSalonDetails(id);
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

function downloadQRCode(id) {
    const salon = AdminState.salons.find(s => s.id === id) || AdminState.selectedSalon;
    if (!salon?.qrCodeUrl) { showToast('QR kod yok', 'error'); return; }
    const link = document.createElement('a'); link.href = salon.qrCodeUrl; link.download = salon.slug + '-qr.png'; link.click();
}

async function saveWorkingHours() {
    const sid = AdminState.selectedSalon.id;
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const workingHours = {};
    days.forEach(day => { workingHours[day] = { open: document.getElementById('hour-' + day + '-open').value || '09:00', close: document.getElementById('hour-' + day + '-close').value || '19:00', closed: document.getElementById('hour-' + day + '-closed').checked }; });
    try { await db.collection('salons').doc(sid).update({ workingHours, hoursUpdatedAt: new Date().toISOString() }); showToast('Saatler kaydedildi!', 'success'); } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

function toggleDayClosed(day) {
    const closed = document.getElementById('hour-' + day + '-closed').checked;
    document.getElementById('hour-' + day + '-open').disabled = closed;
    document.getElementById('hour-' + day + '-close').disabled = closed;
}

async function deleteAppointment(id) {
    if (!confirm('Randevuyu silmek istediğinize emin misiniz?')) return;
    try { await db.collection('appointments').doc(id).delete(); showToast('Silindi', 'success'); if (AdminState.selectedSalon) await loadSalonDetails(AdminState.selectedSalon.id); } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

function exportAllData() {
    const data = { salons: AdminState.salons, appointments: AdminState.allAppointments, customers: AdminState.allCustomers, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'zamanli-export-' + new Date().toISOString().split('T')[0] + '.json'; a.click();
    showToast('Veriler indirildi', 'success');
}

function clearLocalCache() {
    localStorage.clear(); showToast('Cache temizlendi, sayfa yenileniyor...', 'success');
    setTimeout(function() { location.reload(); }, 1000);
}

async function addStaff() {
    const name = document.getElementById('staffName').value.trim(); if (!name) { showToast('Ad gerekli', 'error'); return; }
    const sid = AdminState.selectedSalon.id;
    const newStaff = { id: 'staff-' + Date.now(), name, role: document.getElementById('staffRole').value.trim() || 'Personel', title: document.getElementById('staffRole').value.trim() || 'Personel', phone: document.getElementById('staffPhone').value.replace(/\D/g, '').slice(-10), pin: document.getElementById('staffPin').value.trim() || '000000', active: true, createdAt: new Date().toISOString() };
    try { const currentStaff = AdminState.selectedSalon.staff || []; currentStaff.push(newStaff); await db.collection('salons').doc(sid).update({ staff: currentStaff }); showToast('Eklendi!', 'success'); closeModal(); await loadSalonDetails(sid); } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function updateStaff(staffId) {
    const sid = AdminState.selectedSalon.id;
    try {
        let currentStaff = AdminState.selectedSalon.staff ? [...AdminState.selectedSalon.staff] : [];
        const idx = currentStaff.findIndex(s => s.id === staffId);
        if (idx >= 0) {
            currentStaff[idx] = { ...currentStaff[idx], name: document.getElementById('staffName').value.trim(), role: document.getElementById('staffRole').value.trim(), title: document.getElementById('staffRole').value.trim(), phone: document.getElementById('staffPhone').value.replace(/\D/g, '').slice(-10), pin: document.getElementById('staffPin').value.trim(), active: document.getElementById('staffActive').checked, updatedAt: new Date().toISOString() };
            await db.collection('salons').doc(sid).update({ staff: currentStaff }); showToast('Kaydedildi!', 'success'); closeModal(); await loadSalonDetails(sid);
        } else { showToast('Personel bulunamadı', 'error'); }
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function deleteStaff(staffId) {
    if (!confirm('Personeli silmek istediğinize emin misiniz?')) return;
    const sid = AdminState.selectedSalon.id;
    try {
        let currentStaff = AdminState.selectedSalon.staff ? [...AdminState.selectedSalon.staff] : [];
        currentStaff = currentStaff.filter(s => s.id !== staffId);
        await db.collection('salons').doc(sid).update({ staff: currentStaff }); showToast('Silindi', 'success'); await loadSalonDetails(sid);
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function addService() {
    const name = document.getElementById('svcName').value.trim();
    const price = parseInt(document.getElementById('svcPrice').value) || 0;
    if (!name || price <= 0) { showToast('Ad ve fiyat gerekli', 'error'); return; }
    const sid = AdminState.selectedSalon.id;
    const newSvc = { id: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(), name, price, duration: parseInt(document.getElementById('svcDuration').value) || 30, icon: '✂️', active: true, createdAt: new Date().toISOString() };
    try { const currentSvcs = AdminState.selectedSalon.services || []; currentSvcs.push(newSvc); await db.collection('salons').doc(sid).update({ services: currentSvcs }); showToast('Eklendi!', 'success'); closeModal(); await loadSalonDetails(sid); } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function updateService(svcId) {
    const sid = AdminState.selectedSalon.id;
    try {
        let currentSvcs = AdminState.selectedSalon.services ? [...AdminState.selectedSalon.services] : [];
        const idx = currentSvcs.findIndex(s => s.id === svcId);
        if (idx >= 0) {
            currentSvcs[idx] = { ...currentSvcs[idx], name: document.getElementById('svcName').value.trim(), price: parseInt(document.getElementById('svcPrice').value) || 0, duration: parseInt(document.getElementById('svcDuration').value) || 30, active: document.getElementById('svcActive').checked, updatedAt: new Date().toISOString() };
            await db.collection('salons').doc(sid).update({ services: currentSvcs }); showToast('Kaydedildi!', 'success'); closeModal(); await loadSalonDetails(sid);
        } else { showToast('Hizmet bulunamadı', 'error'); }
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function deleteService(svcId) {
    if (!confirm('Hizmeti silmek istediğinize emin misiniz?')) return;
    const sid = AdminState.selectedSalon.id;
    try {
        let currentSvcs = AdminState.selectedSalon.services ? [...AdminState.selectedSalon.services] : [];
        currentSvcs = currentSvcs.filter(s => s.id !== svcId);
        await db.collection('salons').doc(sid).update({ services: currentSvcs }); showToast('Silindi', 'success'); await loadSalonDetails(sid);
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function updateAppointment(aptId) {
    try {
        await db.collection('appointments').doc(aptId).update({ customerName: document.getElementById('aptCustomerName').value.trim(), customerPhone: document.getElementById('aptCustomerPhone').value.replace(/\D/g, ''), date: document.getElementById('aptDate').value, time: document.getElementById('aptTime').value, status: document.getElementById('aptStatus').value, updatedAt: new Date().toISOString(), updatedBy: 'admin' });
        showToast('Güncellendi!', 'success'); closeModal(); if (AdminState.selectedSalon) await loadSalonDetails(AdminState.selectedSalon.id);
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function updateGlobalAppointment(aptId) {
    try {
        await db.collection('appointments').doc(aptId).update({ customerName: document.getElementById('aptCustomerName').value.trim(), customerPhone: document.getElementById('aptCustomerPhone').value.replace(/\D/g, ''), date: document.getElementById('aptDate').value, time: document.getElementById('aptTime').value, status: document.getElementById('aptStatus').value, updatedAt: new Date().toISOString(), updatedBy: 'admin' });
        showToast('Güncellendi!', 'success'); closeModal();
        // Lokal listeyi güncelle
        const idx = AdminState.allAppointments.findIndex(a => a.id === aptId);
        if (idx >= 0) {
            AdminState.allAppointments[idx] = {
                ...AdminState.allAppointments[idx],
                customerName: document.getElementById('aptCustomerName').value.trim(),
                customerPhone: document.getElementById('aptCustomerPhone').value.replace(/\D/g, ''),
                date: document.getElementById('aptDate').value,
                time: document.getElementById('aptTime').value,
                status: document.getElementById('aptStatus').value
            };
        }
        renderApp();
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

// Randevu silme fonksiyonu
async function deleteAppointment(aptId) {
    if (!confirm('Bu randevuyu silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!')) return;
    
    try {
        showToast('Siliniyor...', 'info');
        await db.collection('appointments').doc(aptId).delete();
        
        // Lokal listelerden kaldır
        AdminState.salonAppointments = AdminState.salonAppointments.filter(a => a.id !== aptId);
        AdminState.allAppointments = AdminState.allAppointments.filter(a => a.id !== aptId);
        
        // Admin log kaydet
        try {
            await db.collection('admin_logs').add({
                action: 'delete_appointment',
                appointmentId: aptId,
                deletedAt: new Date().toISOString(),
                deletedBy: 'super_admin'
            });
        } catch (e) {}
        
        showToast('Randevu silindi ✅', 'success');
        calculateStats();
        renderApp();
    } catch (e) {
        console.error('[Delete] Randevu silme hatası:', e);
        showToast('Hata: ' + e.message, 'error');
    }
}

// Global randevu silme
async function deleteGlobalAppointment(aptId) {
    if (!confirm('Bu randevuyu silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!')) return;
    
    try {
        showToast('Siliniyor...', 'info');
        await db.collection('appointments').doc(aptId).delete();
        
        AdminState.allAppointments = AdminState.allAppointments.filter(a => a.id !== aptId);
        
        try {
            await db.collection('admin_logs').add({
                action: 'delete_appointment',
                appointmentId: aptId,
                deletedAt: new Date().toISOString(),
                deletedBy: 'super_admin'
            });
        } catch (e) {}
        
        showToast('Randevu silindi ✅', 'success');
        calculateStats();
        renderApp();
    } catch (e) {
        showToast('Hata: ' + e.message, 'error');
    }
}

// Müşteri silme fonksiyonu (global)
async function deleteGlobalCustomer(phone, salonId) {
    if (!confirm('Bu müşteriyi silmek istediğinize emin misiniz?\n\nMüşteri kaydı silinecek. Randevular korunacak.')) return;
    
    try {
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        
        // Salon customers koleksiyonundan sil
        if (salonId) {
            try {
                await db.collection('salons').doc(salonId).collection('customers').doc(cleanPhone).delete();
            } catch (e) {}
            
            // Blacklist'e ekle
            try {
                await db.collection('salons').doc(salonId).collection('deletedCustomers').doc(cleanPhone).set({
                    phone: cleanPhone,
                    deletedAt: new Date().toISOString(),
                    deletedBy: 'super_admin'
                });
            } catch (e) {}
        }
        
        // Admin log
        try {
            await db.collection('admin_logs').add({
                action: 'delete_customer',
                phone: cleanPhone,
                salonId: salonId,
                deletedAt: new Date().toISOString(),
                deletedBy: 'super_admin'
            });
        } catch (e) {}
        
        // Lokal listeden kaldır
        AdminState.allCustomers = AdminState.allCustomers.filter(c => c.phone !== cleanPhone);
        if (AdminState.salonCustomers) {
            AdminState.salonCustomers = AdminState.salonCustomers.filter(c => c.phone !== cleanPhone);
        }
        
        showToast('Müşteri silindi ✅', 'success');
        renderApp();
    } catch (e) {
        showToast('Hata: ' + e.message, 'error');
    }
}

async function createSalon() {
    const name = document.getElementById('newName').value.trim(); if (!name) { showToast('Salon adı gerekli', 'error'); return; }
    const category = document.getElementById('newCategory').value;
    const ownerName = document.getElementById('newOwner').value.trim();
    const phone = document.getElementById('newPhone').value.replace(/\D/g, '').slice(-10);
    const email = document.getElementById('newEmail').value.trim();
    const slug = name.toLowerCase().replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    try {
        const exists = await db.collection('salons').where('slug', '==', slug).get();
        if (!exists.empty) { showToast('Bu isimde salon var', 'error'); return; }
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        const salonUrl = 'https://zamanli.com/berber/salon/?slug=' + slug;
        await db.collection('salons').add({ name, slug, category, ownerName, phone, email, package: 'free', pin, active: true, status: 'approved', qrCodeUrl: generateQRCodeUrl(salonUrl, 256), services: DEFAULT_SERVICES[category] || DEFAULT_SERVICES.berber, staff: [], createdAt: new Date().toISOString(), createdBy: 'admin' });
        showToast('Oluşturuldu! PIN: ' + pin, 'success'); closeModal();
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function saveSalonEdit(id) {
    const data = { name: document.getElementById('editName').value.trim(), ownerName: document.getElementById('editOwner').value.trim(), phone: document.getElementById('editPhone').value.replace(/\D/g, '').slice(-10), email: document.getElementById('editEmail').value.trim(), category: document.getElementById('editCategory').value, package: document.getElementById('editPackage').value, city: document.getElementById('editCity').value.trim(), district: document.getElementById('editDistrict').value.trim(), active: document.getElementById('editActive').checked, updatedAt: new Date().toISOString() };
    if (!data.name) { showToast('Salon adı gerekli', 'error'); return; }
    try { await db.collection('salons').doc(id).update(data); showToast('Kaydedildi!', 'success'); closeModal(); if (AdminState.selectedSalon?.id === id) await loadSalonDetails(id); } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function changePin(id) {
    const newPin = document.getElementById('newPin').value.trim();
    if (!newPin || newPin.length < 4) { showToast('En az 4 haneli PIN girin', 'error'); return; }
    try { await db.collection('salons').doc(id).update({ pin: newPin, pinUpdatedAt: new Date().toISOString() }); showToast('PIN değiştirildi: ' + newPin, 'success'); closeModal(); if (AdminState.selectedSalon?.id === id) await loadSalonDetails(id); } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

// ==================== MODALS ====================
function showCreateSalonModal() {
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Yeni Salon</h2><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Salon Adı *</label><input type="text" id="newName" class="form-input"></div><div class="form-group"><label class="form-label">Kategori</label><select id="newCategory" class="form-select"><option value="berber">💈 Berber</option><option value="kuafor">💇‍♀️ Kuaför</option><option value="beauty">💆 Güzellik</option></select></div><div class="form-group"><label class="form-label">Yetkili</label><input type="text" id="newOwner" class="form-input"></div><div class="form-group"><label class="form-label">Telefon</label><input type="tel" id="newPhone" class="form-input"></div><div class="form-group"><label class="form-label">E-posta</label><input type="email" id="newEmail" class="form-input"></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">İptal</button><button onclick="createSalon()" class="btn btn-primary">Oluştur</button></div></div></div>';
}

function showEditSalonModal(id) {
    const s = AdminState.salons.find(x => x.id === id); if (!s) return;
    let pkgOpts = ''; Object.entries(ADMIN_CONFIG.packages).forEach(function(e) { pkgOpts += '<option value="' + e[0] + '"' + (s.package === e[0] ? ' selected' : '') + '>' + e[1].name + '</option>'; });
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal modal-large" onclick="event.stopPropagation()"><div class="modal-header"><h2>Salon Düzenle</h2><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body"><div class="form-grid"><div class="form-group"><label class="form-label">Salon Adı</label><input type="text" id="editName" class="form-input" value="' + esc(s.name) + '"></div><div class="form-group"><label class="form-label">Yetkili</label><input type="text" id="editOwner" class="form-input" value="' + esc(s.ownerName || '') + '"></div><div class="form-group"><label class="form-label">Telefon</label><input type="tel" id="editPhone" class="form-input" value="' + (s.phone || '') + '"></div><div class="form-group"><label class="form-label">E-posta</label><input type="email" id="editEmail" class="form-input" value="' + esc(s.email || '') + '"></div><div class="form-group"><label class="form-label">Kategori</label><select id="editCategory" class="form-select"><option value="berber"' + (s.category === 'berber' ? ' selected' : '') + '>Berber</option><option value="kuafor"' + (s.category === 'kuafor' ? ' selected' : '') + '>Kuaför</option><option value="beauty"' + (s.category === 'beauty' ? ' selected' : '') + '>Güzellik</option></select></div><div class="form-group"><label class="form-label">Paket</label><select id="editPackage" class="form-select">' + pkgOpts + '</select></div><div class="form-group"><label class="form-label">Şehir</label><input type="text" id="editCity" class="form-input" value="' + esc(s.city || '') + '"></div><div class="form-group"><label class="form-label">İlçe</label><input type="text" id="editDistrict" class="form-input" value="' + esc(s.district || '') + '"></div><div class="form-group"><label class="form-label"><input type="checkbox" id="editActive"' + (s.active ? ' checked' : '') + '> Aktif</label></div></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">İptal</button><button onclick="saveSalonEdit(\'' + id + '\')" class="btn btn-primary">Kaydet</button></div></div></div>';
}

function showChangePinModal(id) {
    const s = AdminState.salons.find(x => x.id === id); if (!s) return;
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>PIN Değiştir</h2><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body"><p>Salon: <strong>' + esc(s.name) + '</strong></p><p>Mevcut PIN: <code>' + (s.pin || '-') + '</code></p><div class="form-group" style="margin-top:1rem"><label class="form-label">Yeni PIN</label><input type="text" id="newPin" class="form-input" maxlength="6" placeholder="4-6 haneli"></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">İptal</button><button onclick="changePin(\'' + id + '\')" class="btn btn-primary">Değiştir</button></div></div></div>';
}

function showQRCodeModal(id) {
    const salon = AdminState.salons.find(s => s.id === id); if (!salon) return;
    const salonUrl = 'https://zamanli.com/berber/salon/?slug=' + salon.slug;
    const qrUrl = salon.qrCodeUrl || generateQRCodeUrl(salonUrl, 256);
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()" style="max-width:400px"><div class="modal-header"><h2>QR Kod</h2><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body" style="text-align:center"><img src="' + qrUrl + '" alt="QR" style="max-width:200px;border-radius:8px;margin-bottom:1rem"><p style="font-size:0.85rem;color:var(--slate-500)">' + salonUrl + '</p></div><div class="modal-footer"><button onclick="regenerateQRCode(\'' + id + '\')" class="btn btn-outline btn-sm">🔄 Yenile</button><button onclick="downloadQRCode(\'' + id + '\')" class="btn btn-primary btn-sm">📥 İndir</button></div></div></div>';
}

function showAddStaffModal() {
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Yeni Personel</h2><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Ad Soyad *</label><input type="text" id="staffName" class="form-input"></div><div class="form-group"><label class="form-label">Rol</label><input type="text" id="staffRole" class="form-input" placeholder="Berber"></div><div class="form-group"><label class="form-label">Telefon</label><input type="tel" id="staffPhone" class="form-input"></div><div class="form-group"><label class="form-label">PIN</label><input type="text" id="staffPin" class="form-input" maxlength="6" placeholder="000000"></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">İptal</button><button onclick="addStaff()" class="btn btn-primary">Ekle</button></div></div></div>';
}

function showEditStaffModal(staffId) {
    const st = AdminState.salonStaff.find(s => s.id === staffId); if (!st) return;
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Personel Düzenle</h2><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Ad Soyad</label><input type="text" id="staffName" class="form-input" value="' + esc(st.name) + '"></div><div class="form-group"><label class="form-label">Rol</label><input type="text" id="staffRole" class="form-input" value="' + esc(st.role || st.title || '') + '"></div><div class="form-group"><label class="form-label">Telefon</label><input type="tel" id="staffPhone" class="form-input" value="' + (st.phone || '') + '"></div><div class="form-group"><label class="form-label">PIN</label><input type="text" id="staffPin" class="form-input" value="' + (st.pin || '') + '" maxlength="6"></div><div class="form-group"><label class="form-label"><input type="checkbox" id="staffActive"' + (st.active !== false ? ' checked' : '') + '> Aktif</label></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">İptal</button><button onclick="updateStaff(\'' + staffId + '\')" class="btn btn-primary">Kaydet</button></div></div></div>';
}

function showAddServiceModal() {
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Yeni Hizmet</h2><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Hizmet Adı *</label><input type="text" id="svcName" class="form-input"></div><div class="form-group"><label class="form-label">Fiyat (₺) *</label><input type="number" id="svcPrice" class="form-input" min="0"></div><div class="form-group"><label class="form-label">Süre (dk)</label><input type="number" id="svcDuration" class="form-input" value="30" min="5"></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">İptal</button><button onclick="addService()" class="btn btn-primary">Ekle</button></div></div></div>';
}

function showEditServiceModal(svcId) {
    const sv = AdminState.salonServices.find(s => s.id === svcId); if (!sv) return;
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Hizmet Düzenle</h2><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Hizmet Adı</label><input type="text" id="svcName" class="form-input" value="' + esc(sv.name) + '"></div><div class="form-group"><label class="form-label">Fiyat (₺)</label><input type="number" id="svcPrice" class="form-input" value="' + (sv.price || 0) + '" min="0"></div><div class="form-group"><label class="form-label">Süre (dk)</label><input type="number" id="svcDuration" class="form-input" value="' + (sv.duration || 30) + '" min="5"></div><div class="form-group"><label class="form-label"><input type="checkbox" id="svcActive"' + (sv.active !== false ? ' checked' : '') + '> Aktif</label></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">İptal</button><button onclick="updateService(\'' + svcId + '\')" class="btn btn-primary">Kaydet</button></div></div></div>';
}

function showEditAppointmentModal(aptId) {
    const apt = AdminState.salonAppointments.find(a => a.id === aptId); if (!apt) return;
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Randevu Düzenle</h2><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Müşteri</label><input type="text" id="aptCustomerName" class="form-input" value="' + esc(apt.customerName || '') + '"></div><div class="form-group"><label class="form-label">Telefon</label><input type="tel" id="aptCustomerPhone" class="form-input" value="' + (apt.customerPhone || '') + '"></div><div class="form-group"><label class="form-label">Tarih</label><input type="date" id="aptDate" class="form-input" value="' + (apt.date || '') + '"></div><div class="form-group"><label class="form-label">Saat</label><input type="time" id="aptTime" class="form-input" value="' + (apt.time || '') + '"></div><div class="form-group"><label class="form-label">Durum</label><select id="aptStatus" class="form-select"><option value="pending"' + (apt.status === 'pending' ? ' selected' : '') + '>Bekliyor</option><option value="confirmed"' + (apt.status === 'confirmed' ? ' selected' : '') + '>Onaylandı</option><option value="completed"' + (apt.status === 'completed' ? ' selected' : '') + '>Tamamlandı</option><option value="cancelled"' + (apt.status === 'cancelled' ? ' selected' : '') + '>İptal</option></select></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">İptal</button><button onclick="updateAppointment(\'' + aptId + '\')" class="btn btn-primary">Kaydet</button></div></div></div>';
}

function showGlobalEditAppointmentModal(aptId) {
    const apt = AdminState.allAppointments.find(a => a.id === aptId); if (!apt) return;
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Randevu Düzenle</h2><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Müşteri</label><input type="text" id="aptCustomerName" class="form-input" value="' + esc(apt.customerName || '') + '"></div><div class="form-group"><label class="form-label">Telefon</label><input type="tel" id="aptCustomerPhone" class="form-input" value="' + (apt.customerPhone || '') + '"></div><div class="form-group"><label class="form-label">Tarih</label><input type="date" id="aptDate" class="form-input" value="' + (apt.date || '') + '"></div><div class="form-group"><label class="form-label">Saat</label><input type="time" id="aptTime" class="form-input" value="' + (apt.time || '') + '"></div><div class="form-group"><label class="form-label">Durum</label><select id="aptStatus" class="form-select"><option value="pending"' + (apt.status === 'pending' ? ' selected' : '') + '>Bekliyor</option><option value="confirmed"' + (apt.status === 'confirmed' ? ' selected' : '') + '>Onaylandı</option><option value="completed"' + (apt.status === 'completed' ? ' selected' : '') + '>Tamamlandı</option><option value="cancelled"' + (apt.status === 'cancelled' ? ' selected' : '') + '>İptal</option></select></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">İptal</button><button onclick="updateGlobalAppointment(\'' + aptId + '\')" class="btn btn-primary">Kaydet</button></div></div></div>';
}

// ==================== UTILITIES ====================
function closeModal(e) { if (!e || e.target.classList.contains('modal-overlay')) document.getElementById('modal').innerHTML = ''; }
function showToast(msg, type) { const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast show ' + (type || 'info'); setTimeout(function() { t.className = 'toast'; }, 3000); }
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function getStatusText(status) { const map = { pending: 'Bekliyor', confirmed: 'Onaylandı', completed: 'Tamamlandı', cancelled: 'İptal', noshow: 'Gelmedi' }; return map[status] || status || 'Bekliyor'; }

console.log('[Zamanli Admin] v3.0 - Tam Yetkili Süper Admin Paneli');
