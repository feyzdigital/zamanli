const AdminState = {
    isLoggedIn: false, currentView: 'dashboard', currentTab: 'active', currentCategory: 'all',
    salons: [], stats: { totalSalons: 0, activeSalons: 0, pendingSalons: 0 },
    loading: false, searchQuery: '', selectedSalon: null, salonStaff: [], salonServices: [], salonAppointments: [], detailTab: 'info'
};
let db = null;

// QR Kod URL Oluşturma (Harici API kullanır)
function generateQRCodeUrl(text, size = 256) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&data=${encodeURIComponent(text)}`;
}

// QR Kod ile birlikte salon profil kartı URL'si
function generateSalonQRCardUrl(salon) {
    const salonUrl = 'https://zamanli.com/' + (salon.category || 'berber') + '/' + salon.slug + '/';
    return generateQRCodeUrl(salonUrl, 200);
}
function initAdmin() {
    if (typeof firebase !== 'undefined' && firebase.firestore && typeof emailjs !== 'undefined') {
        firebase.initializeApp(ADMIN_CONFIG.firebase);
        db = firebase.firestore();
        emailjs.init(ADMIN_CONFIG.emailjs.publicKey);
        checkAuth();
    } else setTimeout(initAdmin, 100);
}

function checkAuth() {
    const session = localStorage.getItem('zamanli_admin');
    if (session) {
        const { pin, expiry } = JSON.parse(session);
        if (pin === ADMIN_CONFIG.superAdminPin && new Date(expiry) > new Date()) { AdminState.isLoggedIn = true; loadAllData(); }
        else { localStorage.removeItem('zamanli_admin'); renderLogin(); }
    } else renderLogin();
}

function login() {
    const pin = document.getElementById('pinInput').value;
    if (pin === ADMIN_CONFIG.superAdminPin) {
        const expiry = new Date(); expiry.setHours(expiry.getHours() + 24);
        localStorage.setItem('zamanli_admin', JSON.stringify({ pin, expiry: expiry.toISOString() }));
        AdminState.isLoggedIn = true; loadAllData();
    } else { showToast('Gecersiz PIN!', 'error'); document.getElementById('pinInput').value = ''; }
}

function logout() { localStorage.removeItem('zamanli_admin'); AdminState.isLoggedIn = false; renderLogin(); }

async function loadAllData() {
    AdminState.loading = true; renderApp();
    try {
        const snap = await db.collection('salons').get();
        AdminState.salons = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        AdminState.stats.totalSalons = AdminState.salons.length;
        AdminState.stats.activeSalons = AdminState.salons.filter(s => s.active && s.status !== 'pending').length;
        AdminState.stats.pendingSalons = AdminState.salons.filter(s => s.status === 'pending').length;
    } catch (e) { console.error(e); showToast('Veri yuklenirken hata', 'error'); }
    AdminState.loading = false; renderApp();
}

async function loadSalonDetails(id) {
    AdminState.loading = true; renderApp();
    try {
        // Güncel veriyi Firestore'dan çek (cache'den değil)
        const salonDoc = await db.collection('salons').doc(id).get();
        if (!salonDoc.exists) {
            showToast('Salon bulunamadi', 'error');
            AdminState.currentView = 'dashboard';
            AdminState.loading = false; renderApp();
            return;
        }
        
        AdminState.selectedSalon = { id: salonDoc.id, ...salonDoc.data() };
        
        // AdminState.salons'u da güncelle
        const salonIndex = AdminState.salons.findIndex(s => s.id === id);
        if (salonIndex >= 0) {
            AdminState.salons[salonIndex] = AdminState.selectedSalon;
        }
        
        // ÖNCELİK: Ana dokümandaki array'leri kullan (yönetim paneli buraya kaydediyor)
        // Subcollection sadece fallback olarak kullanılır
        
        // Personel - önce ana dokümandan
        if (AdminState.selectedSalon.staff && AdminState.selectedSalon.staff.length > 0) {
            AdminState.salonStaff = AdminState.selectedSalon.staff.map((s, i) => ({ id: s.id || 'staff-' + i, ...s }));
        } else {
            const staffSnap = await db.collection('salons').doc(id).collection('staff').get();
            AdminState.salonStaff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        
        // Hizmetler - önce ana dokümandan
        if (AdminState.selectedSalon.services && AdminState.selectedSalon.services.length > 0) {
            AdminState.salonServices = AdminState.selectedSalon.services.map((s, i) => ({ id: s.id || 'svc-' + i, ...s }));
        } else {
            const svcSnap = await db.collection('salons').doc(id).collection('services').get();
            AdminState.salonServices = svcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        
        // Randevular - appointments collection'dan
        const aptSnap = await db.collection('appointments').where('salonId', '==', id).orderBy('date', 'desc').limit(50).get();
        AdminState.salonAppointments = aptSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        AdminState.currentView = 'salon-detail'; AdminState.detailTab = 'info';
    } catch (e) { console.error(e); showToast('Detaylar yuklenirken hata', 'error'); }
    AdminState.loading = false; renderApp();
}

function renderApp() {
    if (!AdminState.isLoggedIn) { renderLogin(); return; }
    document.getElementById('app').innerHTML = '<div class="admin-layout">' + renderSidebar() + '<main class="admin-main">' + (AdminState.loading ? '<div class="loading-container"><div class="spinner"></div></div>' : renderView()) + '</main></div>';
}

function renderLogin() {
    document.getElementById('app').innerHTML = '<div class="login-container"><div class="login-card"><div class="login-icon">&#128274;</div><h1>Admin Girisi</h1><p>PIN kodunuzu girin</p><input type="password" id="pinInput" class="pin-input" maxlength="4" placeholder="****" onkeypress="if(event.key===\'Enter\')login()"><button onclick="login()" class="btn btn-primary btn-block">Giris Yap</button></div></div>';
    document.getElementById('pinInput')?.focus();
}

function renderSidebar() {
    const p = AdminState.stats.pendingSalons;
    return '<aside class="admin-sidebar"><div class="sidebar-header"><span class="sidebar-icon">&#128197;</span><span class="sidebar-title">Zamanli</span></div><nav class="sidebar-nav"><a href="#" onclick="nav(\'dashboard\')" class="nav-item ' + (AdminState.currentView === 'dashboard' ? 'active' : '') + '"><span>&#128202;</span> Dashboard</a><a href="#" onclick="nav(\'salons\')" class="nav-item ' + (AdminState.currentView.includes('salon') ? 'active' : '') + '"><span>&#128136;</span> Salonlar' + (p > 0 ? '<span class="nav-badge">' + p + '</span>' : '') + '</a></nav><div class="sidebar-footer"><a href="#" onclick="logout()" class="nav-item logout"><span>&#128682;</span> Cikis</a></div></aside>';
}

function renderView() {
    if (AdminState.currentView === 'dashboard') return renderDashboard();
    if (AdminState.currentView === 'salons') return renderSalons();
    if (AdminState.currentView === 'salon-detail') return renderDetail();
    return renderDashboard();
}

function renderDashboard() {
    const { totalSalons, activeSalons, pendingSalons } = AdminState.stats;
    let h = '<div class="view-header"><h1>Dashboard</h1></div>';
    h += '<div class="stats-grid"><div class="stat-card"><div class="stat-icon blue">&#128136;</div><div class="stat-value">' + totalSalons + '</div><div class="stat-label">Toplam Salon</div></div>';
    h += '<div class="stat-card"><div class="stat-icon green">&#10004;</div><div class="stat-value">' + activeSalons + '</div><div class="stat-label">Aktif Salon</div></div>';
    h += '<div class="stat-card" onclick="nav(\'salons\');AdminState.currentTab=\'pending\';renderApp()" style="cursor:pointer"><div class="stat-icon orange">&#9203;</div><div class="stat-value">' + pendingSalons + '</div><div class="stat-label">Onay Bekleyen</div></div></div>';
    if (pendingSalons > 0) h += '<div class="pending-alert" onclick="nav(\'salons\');AdminState.currentTab=\'pending\';renderApp()"><span>&#9888;</span> <strong>' + pendingSalons + '</strong> adet onay bekleyen basvuru var! <span class="alert-link">Incele &rarr;</span></div>';
    const recent = [...AdminState.salons].filter(s => s.status !== 'pending').sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5);
    h += '<div class="card"><div class="card-header"><h2>Son Salonlar</h2><button onclick="nav(\'salons\')" class="btn btn-outline btn-sm">Tumu</button></div><table class="data-table"><thead><tr><th>Salon</th><th>Kategori</th><th>Durum</th></tr></thead><tbody>';
    recent.forEach(s => { const c = ADMIN_CONFIG.categories[s.category] || ADMIN_CONFIG.categories.berber; h += '<tr onclick="loadSalonDetails(\'' + s.id + '\')" style="cursor:pointer"><td><div class="salon-info"><span class="salon-icon">' + c.icon + '</span><div><div class="salon-name">' + esc(s.name) + '</div><div class="salon-slug">/' + s.slug + '</div></div></div></td><td>' + c.name + '</td><td><span class="status-badge ' + (s.active ? 'active' : 'inactive') + '">' + (s.active ? 'Aktif' : 'Pasif') + '</span></td></tr>'; });
    h += '</tbody></table></div>';
    return h;
}

function renderSalons() {
    const p = AdminState.salons.filter(s => s.status === 'pending').length;
    let list = AdminState.currentTab === 'pending' ? AdminState.salons.filter(s => s.status === 'pending') : AdminState.currentTab === 'active' ? AdminState.salons.filter(s => s.active && s.status !== 'pending') : AdminState.salons;
    if (AdminState.currentCategory !== 'all') list = list.filter(s => (s.category || 'berber') === AdminState.currentCategory);
    if (AdminState.searchQuery) { const q = AdminState.searchQuery.toLowerCase(); list = list.filter(s => s.name?.toLowerCase().includes(q) || s.phone?.includes(q)); }
    
    let h = '<div class="view-header"><h1>Salonlar</h1><button onclick="showCreateModal()" class="btn btn-primary">+ Yeni Salon</button></div>';
    h += '<div class="salon-tabs"><button onclick="switchTab(\'active\')" class="tab-btn ' + (AdminState.currentTab === 'active' ? 'active' : '') + '">Aktif</button><button onclick="switchTab(\'pending\')" class="tab-btn ' + (AdminState.currentTab === 'pending' ? 'active' : '') + '">Bekleyen' + (p > 0 ? '<span class="tab-badge">' + p + '</span>' : '') + '</button><button onclick="switchTab(\'all\')" class="tab-btn ' + (AdminState.currentTab === 'all' ? 'active' : '') + '">Tumu</button></div>';
    if (AdminState.currentTab !== 'pending') h += '<div class="filters-bar"><input type="text" class="search-input" placeholder="Ara..." value="' + AdminState.searchQuery + '" oninput="AdminState.searchQuery=this.value;renderApp()"><select class="filter-select" onchange="AdminState.currentCategory=this.value;renderApp()"><option value="all">Tum Kategoriler</option><option value="berber"' + (AdminState.currentCategory === 'berber' ? ' selected' : '') + '>Berber</option><option value="kuafor"' + (AdminState.currentCategory === 'kuafor' ? ' selected' : '') + '>Kuafor</option><option value="beauty"' + (AdminState.currentCategory === 'beauty' ? ' selected' : '') + '>Guzellik</option></select></div>';
    
    if (AdminState.currentTab === 'pending') {
        if (list.length === 0) return h + '<div class="empty-state"><div class="empty-icon">&#10004;</div><h3>Onay bekleyen yok</h3></div>';
        h += '<div class="pending-list">';
        list.forEach(s => { const c = ADMIN_CONFIG.categories[s.category] || ADMIN_CONFIG.categories.berber; const d = s.createdAt ? new Date(s.createdAt).toLocaleDateString('tr-TR') : '-';
            h += '<div class="pending-card"><div class="pending-header"><div><h3>' + c.icon + ' ' + esc(s.name) + '</h3><p class="slug">/' + s.slug + '</p></div><span class="badge badge-warning">Bekliyor</span></div>';
            h += '<div class="pending-details"><div class="detail-item"><span class="detail-label">Yetkili</span><span class="detail-value">' + esc(s.ownerName || '-') + '</span></div><div class="detail-item"><span class="detail-label">Telefon</span><span class="detail-value">' + (s.phone || '-') + '</span></div><div class="detail-item"><span class="detail-label">E-posta</span><span class="detail-value">' + esc(s.email || '-') + '</span></div><div class="detail-item"><span class="detail-label">Sehir</span><span class="detail-value">' + esc(s.city || '-') + '/' + esc(s.district || '-') + '</span></div></div>';
            if (s.staff?.length > 0) h += '<div class="pending-staff"><b>Personel:</b> ' + s.staff.map(x => esc(x.name)).join(', ') + '</div>';
            if (s.note) h += '<div class="pending-note"><b>Not:</b> ' + esc(s.note) + '</div>';
            h += '<div class="pending-footer"><span class="pending-date">Basvuru: ' + d + '</span><div class="pending-actions"><button onclick="rejectSalon(\'' + s.id + '\')" class="btn btn-outline-danger btn-sm">Reddet</button><button onclick="approveSalon(\'' + s.id + '\')" class="btn btn-success btn-sm">Onayla</button></div></div></div>';
        });
        h += '</div>';
    } else {
        if (list.length === 0) return h + '<div class="empty-state"><div class="empty-icon">&#128269;</div><h3>Salon bulunamadi</h3></div>';
        h += '<div class="card"><table class="data-table"><thead><tr><th>Salon</th><th>Telefon</th><th>Kategori</th><th>Durum</th><th>Islem</th></tr></thead><tbody>';
        list.forEach(s => { const c = ADMIN_CONFIG.categories[s.category] || ADMIN_CONFIG.categories.berber;
            h += '<tr><td onclick="loadSalonDetails(\'' + s.id + '\')" style="cursor:pointer"><div class="salon-info"><span class="salon-icon">' + c.icon + '</span><div><div class="salon-name">' + esc(s.name) + '</div><div class="salon-slug">/' + s.slug + '</div></div></div></td><td>' + (s.phone || '-') + '</td><td>' + c.name + '</td><td><span class="status-badge ' + (s.active ? 'active' : 'inactive') + '">' + (s.active ? 'Aktif' : 'Pasif') + '</span></td><td><div class="action-buttons"><button onclick="loadSalonDetails(\'' + s.id + '\')" class="btn btn-icon">&#128065;</button><button onclick="showEditModal(\'' + s.id + '\')" class="btn btn-icon">&#9998;</button><button onclick="deleteSalon(\'' + s.id + '\')" class="btn btn-icon danger">&#128465;</button></div></td></tr>';
        });
        h += '</tbody></table></div>';
    }
    return h;
}

function renderDetail() {
    const s = AdminState.selectedSalon; if (!s) return '<p>Salon bulunamadi</p>';
    const c = ADMIN_CONFIG.categories[s.category] || ADMIN_CONFIG.categories.berber;
    let h = '<div class="view-header"><div><button onclick="nav(\'salons\')" class="btn btn-outline btn-sm">&larr; Geri</button><h1>' + c.icon + ' ' + esc(s.name) + '</h1><p>/' + s.slug + ' &middot; <span class="status-badge ' + (s.active ? 'active' : 'inactive') + '">' + (s.active ? 'Aktif' : 'Pasif') + '</span></p></div><div class="header-actions"><a href="/berber/salon/?slug=' + s.slug + '" target="_blank" class="btn btn-outline">Sayfayi Ac</a><a href="/berber/salon/yonetim/?slug=' + s.slug + '&admin=true" target="_blank" class="btn btn-outline">Yonetim Paneli</a><button onclick="showEditModal(\'' + s.id + '\')" class="btn btn-primary">Duzenle</button></div></div>';
    h += '<div class="detail-tabs"><button onclick="switchDetailTab(\'info\')" class="tab-btn ' + (AdminState.detailTab === 'info' ? 'active' : '') + '">Bilgiler</button><button onclick="switchDetailTab(\'staff\')" class="tab-btn ' + (AdminState.detailTab === 'staff' ? 'active' : '') + '">Personel (' + AdminState.salonStaff.length + ')</button><button onclick="switchDetailTab(\'services\')" class="tab-btn ' + (AdminState.detailTab === 'services' ? 'active' : '') + '">Hizmetler (' + AdminState.salonServices.length + ')</button><button onclick="switchDetailTab(\'hours\')" class="tab-btn ' + (AdminState.detailTab === 'hours' ? 'active' : '') + '">Calisma Saatleri</button><button onclick="switchDetailTab(\'appointments\')" class="tab-btn ' + (AdminState.detailTab === 'appointments' ? 'active' : '') + '">Randevular (' + AdminState.salonAppointments.length + ')</button><button onclick="switchDetailTab(\'admin\')" class="tab-btn ' + (AdminState.detailTab === 'admin' ? 'active' : '') + '">&#128274; Admin</button></div>';
    
    if (AdminState.detailTab === 'info') {
        h += '<div class="detail-grid"><div class="card"><h3>Temel Bilgiler</h3><div class="info-list"><div class="info-row"><span class="info-label">Salon Adi</span><span class="info-value">' + esc(s.name) + '</span></div><div class="info-row"><span class="info-label">Kategori</span><span class="info-value">' + c.name + '</span></div><div class="info-row"><span class="info-label">Paket</span><span class="info-value">' + (s.package || 'starter') + '</span></div><div class="info-row"><span class="info-label">Kayit Tarihi</span><span class="info-value">' + (s.createdAt ? new Date(s.createdAt).toLocaleDateString('tr-TR') : '-') + '</span></div></div></div><div class="card"><h3>Iletisim</h3><div class="info-list"><div class="info-row"><span class="info-label">Yetkili</span><span class="info-value">' + esc(s.ownerName || '-') + '</span></div><div class="info-row"><span class="info-label">Telefon</span><span class="info-value">' + (s.phone || '-') + '</span></div><div class="info-row"><span class="info-label">E-posta</span><span class="info-value">' + esc(s.email || '-') + '</span></div><div class="info-row"><span class="info-label">Konum</span><span class="info-value">' + esc(s.city || '-') + '/' + esc(s.district || '-') + '</span></div></div></div></div>';
        
        // QR Kod Bölümü
        h += '<div class="card" style="margin-top:1rem"><h3>&#128274; QR Kod</h3><div style="display:flex;gap:2rem;align-items:flex-start;margin-top:1rem;flex-wrap:wrap">';
        if (s.qrCodeUrl) {
            h += '<div style="text-align:center"><img src="' + s.qrCodeUrl + '" alt="QR Kod" style="width:150px;height:150px;border:1px solid var(--slate-200);border-radius:8px"><p style="margin-top:0.5rem;font-size:0.85rem;color:var(--slate-500)">Randevu Sayfası</p></div>';
        }
        if (s.qrCardUrl) {
            h += '<div style="text-align:center"><img src="' + s.qrCardUrl + '" alt="QR Kart" style="width:120px;height:150px;border:1px solid var(--slate-200);border-radius:8px;object-fit:cover"><p style="margin-top:0.5rem;font-size:0.85rem;color:var(--slate-500)">Yazdirilabilir Kart</p></div>';
        }
        h += '<div style="display:flex;flex-direction:column;gap:0.5rem">';
        h += '<button onclick="regenerateQRCode(\'' + s.id + '\')" class="btn btn-outline btn-sm">🔄 QR Yeniden Olustur</button>';
        if (s.qrCardUrl) {
            h += '<button onclick="downloadQRCard(\'' + s.id + '\')" class="btn btn-primary btn-sm">📥 QR Kart Indir</button>';
        }
        h += '</div></div></div>';
        
        if (s.note) h += '<div class="card"><h3>Not</h3><p style="padding:0.5rem 0;color:var(--slate-600)">' + esc(s.note) + '</p></div>';
    } else if (AdminState.detailTab === 'staff') {
        h += '<div class="card"><div class="card-header"><h3>Personel</h3><button onclick="showAddStaffModal()" class="btn btn-primary btn-sm">+ Ekle</button></div>';
        if (AdminState.salonStaff.length === 0) h += '<p style="padding:1rem;color:var(--slate-500)">Personel yok</p>';
        else { h += '<table class="data-table"><thead><tr><th>Ad</th><th>Uzmanlik</th><th>PIN</th><th>Durum</th><th>Islem</th></tr></thead><tbody>';
            AdminState.salonStaff.forEach(st => { h += '<tr><td>' + esc(st.name) + '</td><td>' + esc(st.role || st.title || '-') + '</td><td><code>' + (st.pin || '-') + '</code></td><td><span class="status-badge ' + (st.active !== false ? 'active' : 'inactive') + '">' + (st.active !== false ? 'Aktif' : 'Pasif') + '</span></td><td><button onclick="showEditStaffModal(\'' + st.id + '\')" class="btn btn-icon">&#9998;</button><button onclick="deleteStaff(\'' + st.id + '\')" class="btn btn-icon danger">&#128465;</button></td></tr>'; });
            h += '</tbody></table>'; }
        h += '</div>';
    } else if (AdminState.detailTab === 'services') {
        h += '<div class="card"><div class="card-header"><h3>Hizmetler</h3><button onclick="showAddServiceModal()" class="btn btn-primary btn-sm">+ Ekle</button></div>';
        if (AdminState.salonServices.length === 0) h += '<p style="padding:1rem;color:var(--slate-500)">Hizmet yok</p>';
        else { h += '<table class="data-table"><thead><tr><th>Hizmet</th><th>Fiyat</th><th>Sure</th><th>Durum</th><th>Islem</th></tr></thead><tbody>';
            AdminState.salonServices.forEach(sv => { h += '<tr><td>' + esc(sv.name) + '</td><td>' + (sv.price || 0) + ' TL</td><td>' + (sv.duration || 30) + ' dk</td><td><span class="status-badge ' + (sv.active !== false ? 'active' : 'inactive') + '">' + (sv.active !== false ? 'Aktif' : 'Pasif') + '</span></td><td><button onclick="showEditServiceModal(\'' + sv.id + '\')" class="btn btn-icon">&#9998;</button><button onclick="deleteService(\'' + sv.id + '\')" class="btn btn-icon danger">&#128465;</button></td></tr>'; });
            h += '</tbody></table>'; }
        h += '</div>';
    } else if (AdminState.detailTab === 'appointments') {
        h += '<div class="card"><div class="card-header"><h3>Randevular</h3></div>';
        if (AdminState.salonAppointments.length === 0) h += '<p style="padding:1rem;color:var(--slate-500)">Randevu yok</p>';
        else { h += '<table class="data-table"><thead><tr><th>Tarih</th><th>Saat</th><th>Musteri</th><th>Hizmet</th><th>Durum</th><th>Islem</th></tr></thead><tbody>';
            AdminState.salonAppointments.forEach(a => { h += '<tr><td>' + (a.date || '-') + '</td><td>' + (a.time || '-') + '</td><td>' + esc(a.customerName || '-') + '<br><small style="color:var(--slate-500)">' + (a.customerPhone || '') + '</small></td><td>' + esc(a.service || a.serviceName || '-') + '</td><td><span class="status-badge ' + (a.status === 'confirmed' ? 'active' : a.status === 'cancelled' ? 'inactive' : a.status === 'completed' ? 'active' : '') + '">' + (a.status || 'pending') + '</span></td><td><button onclick="showEditAppointmentModal(\'' + a.id + '\')" class="btn btn-icon" title="Duzenle">&#9998;</button><button onclick="deleteAppointment(\'' + a.id + '\')" class="btn btn-icon danger" title="Sil">&#128465;</button></td></tr>'; });
            h += '</tbody></table>'; }
        h += '</div>';
    } else if (AdminState.detailTab === 'hours') {
        const days = { mon: 'Pazartesi', tue: 'Sali', wed: 'Carsamba', thu: 'Persembe', fri: 'Cuma', sat: 'Cumartesi', sun: 'Pazar' };
        const hours = s.workingHours || { mon: { open: '09:00', close: '19:00', closed: false }, tue: { open: '09:00', close: '19:00', closed: false }, wed: { open: '09:00', close: '19:00', closed: false }, thu: { open: '09:00', close: '19:00', closed: false }, fri: { open: '09:00', close: '19:00', closed: false }, sat: { open: '09:00', close: '18:00', closed: false }, sun: { open: '10:00', close: '16:00', closed: true } };
        h += '<div class="card"><div class="card-header"><h3>&#128344; Calisma Saatleri</h3><button onclick="saveWorkingHours()" class="btn btn-primary btn-sm">Kaydet</button></div>';
        h += '<div class="hours-grid" style="display:grid;gap:0.75rem;margin-top:1rem">';
        Object.keys(days).forEach(day => {
            const d = hours[day] || { open: '09:00', close: '19:00', closed: false };
            h += '<div class="hour-row" style="display:grid;grid-template-columns:120px 1fr 1fr auto;gap:1rem;align-items:center;padding:0.75rem;background:var(--slate-50);border-radius:8px">';
            h += '<div style="font-weight:600">' + days[day] + '</div>';
            h += '<div style="display:flex;align-items:center;gap:0.5rem"><label style="font-size:0.85rem;color:var(--slate-500)">Acilis:</label><input type="time" id="hour-' + day + '-open" class="form-input" style="padding:0.4rem;width:auto" value="' + (d.open || '09:00') + '" ' + (d.closed ? 'disabled' : '') + '></div>';
            h += '<div style="display:flex;align-items:center;gap:0.5rem"><label style="font-size:0.85rem;color:var(--slate-500)">Kapanis:</label><input type="time" id="hour-' + day + '-close" class="form-input" style="padding:0.4rem;width:auto" value="' + (d.close || '19:00') + '" ' + (d.closed ? 'disabled' : '') + '></div>';
            h += '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="checkbox" id="hour-' + day + '-closed" ' + (d.closed ? 'checked' : '') + ' onchange="toggleDayClosed(\'' + day + '\')"> <span style="color:' + (d.closed ? 'var(--danger)' : 'var(--slate-500)') + ';font-size:0.85rem">' + (d.closed ? 'Kapali' : 'Kapali?') + '</span></label>';
            h += '</div>';
        });
        h += '</div></div>';
    } else if (AdminState.detailTab === 'admin') {
        h += '<div class="detail-grid"><div class="card"><h3>&#128274; Giris Bilgileri</h3><div class="info-list"><div class="info-row"><span class="info-label">Telefon</span><span class="info-value"><strong>' + (s.mobilePhone || s.phone || '-') + '</strong></span></div><div class="info-row"><span class="info-label">PIN Kodu</span><span class="info-value"><code style="font-size:1.2rem;background:var(--slate-100);padding:0.25rem 0.75rem;border-radius:4px">' + (s.pin || 'Belirlenmemis') + '</code></span></div><div class="info-row"><span class="info-label">Yonetim Paneli</span><span class="info-value" style="word-break:break-all;font-size:0.85rem">' + location.origin + '/berber/salon/yonetim/?slug=' + s.slug + '&admin=true</span></div></div><div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:1rem"><a href="/berber/salon/yonetim/?slug=' + s.slug + '&admin=true" target="_blank" class="btn btn-primary">🚀 Yonetim Paneline Git (Admin)</a><button onclick="showChangePinModal(\'' + s.id + '\')" class="btn btn-outline">PIN Degistir</button></div></div>';
        h += '<div class="card"><h3 style="color:var(--danger)">&#9888; Tehlikeli Islemler</h3><div style="display:flex;flex-direction:column;gap:0.75rem;margin-top:1rem">';
        if (s.active) h += '<button onclick="toggleSalonStatus(\'' + s.id + '\', false)" class="btn btn-outline" style="border-color:var(--warning);color:var(--warning)">Salonu Pasife Al</button>';
        else h += '<button onclick="toggleSalonStatus(\'' + s.id + '\', true)" class="btn btn-outline" style="border-color:var(--success);color:var(--success)">Salonu Aktif Et</button>';
        h += '<button onclick="permanentDeleteSalon(\'' + s.id + '\')" class="btn btn-outline" style="border-color:var(--danger);color:var(--danger)">Kalici Olarak Sil</button>';
        h += '</div></div></div>';
    }
    return h;
}

function nav(v) { AdminState.currentView = v; AdminState.currentTab = 'active'; AdminState.selectedSalon = null; renderApp(); return false; }
function switchTab(t) { AdminState.currentTab = t; renderApp(); }
function switchDetailTab(t) { AdminState.detailTab = t; renderApp(); }

async function approveSalon(id) {
    if (!confirm('Onaylamak istediginize emin misiniz?')) return;
    showToast('Onaylaniyor...', 'info');
    
    try {
        const ref = db.collection('salons').doc(id);
        const doc = await ref.get();
        
        if (!doc.exists) {
            showToast('Hata: Salon bulunamadi!', 'error');
            return;
        }
        
        const data = doc.data();
        const pin = data.pin || Math.floor(1000 + Math.random() * 9000).toString();
        
        console.log('[Admin] Onaylanan salon:', data.name, 'ID:', id);
        
        // Salon URL'leri - Yeni format
        const panelUrl = 'https://zamanli.com/berber/salon/yonetim/?slug=' + data.slug;
        const salonUrl = 'https://zamanli.com/berber/salon/?slug=' + data.slug;
        
        // QR Kod URL'leri (harici API)
        const qrCodeUrl = generateQRCodeUrl(salonUrl, 256);
        const qrCardUrl = generateQRCodeUrl(salonUrl, 200);
        
        // 1. ADIM: Veritabanını güncelle (boolean değerler!)
        console.log('[Admin] Adim 1: Salon durumu guncelleniyor...');
        await ref.update({ 
            active: true,  // Boolean olarak true
            status: 'approved', 
            approvedAt: new Date().toISOString(),
            qrCodeUrl: qrCodeUrl,
            qrCardUrl: qrCardUrl,
            pin: pin
        });
        console.log('[Admin] Adim 1: Tamamlandi');
        
        // 2. ADIM: Personel ekle
        if (data.staff?.length > 0) {
            console.log('[Admin] Adim 2: Personel ekleniyor...', data.staff.length, 'kisi');
            try {
                const batch = db.batch();
                data.staff.forEach((s, i) => {
                    const staffId = s.id || 'staff-' + (i + 1);
                    const staffRef = ref.collection('staff').doc(staffId);
                    batch.set(staffRef, { 
                        ...s, 
                        id: staffId,
                        createdAt: new Date().toISOString() 
                    });
                });
                await batch.commit();
                console.log('[Admin] Adim 2: Tamamlandi');
            } catch (staffError) {
                console.error('[Admin] Personel ekleme hatasi:', staffError);
                // Devam et, kritik değil
            }
        }
        
        // 3. ADIM: Hizmetleri ekle
        const svc = data.services || DEFAULT_SERVICES[data.category || 'berber'] || DEFAULT_SERVICES.berber;
        console.log('[Admin] Adim 3: Hizmetler kontrol ediliyor...', svc?.length || 0, 'hizmet');
        
        try {
            const svcSnap = await ref.collection('services').get();
            if (svcSnap.empty && svc && svc.length > 0) {
                console.log('[Admin] Hizmetler ekleniyor...');
                const batch = db.batch();
                svc.forEach((s, index) => {
                    const serviceId = s.id || 'service-' + (index + 1);
                    const serviceRef = ref.collection('services').doc(serviceId);
                    batch.set(serviceRef, { 
                        ...s, 
                        id: serviceId,
                        active: true,
                        createdAt: new Date().toISOString() 
                    });
                });
                await batch.commit();
                console.log('[Admin] Adim 3: Tamamlandi');
            } else {
                console.log('[Admin] Adim 3: Hizmetler zaten mevcut, atlanıyor');
            }
        } catch (serviceError) {
            console.error('[Admin] Hizmet ekleme hatasi:', serviceError);
            // Devam et, kritik değil
        }
        
        // 4. ADIM: E-posta gönder (QR kod dahil)
        if (data.email) { 
            try { 
                console.log('[Admin] Adim 4: E-posta gonderiliyor...', data.email);
                await emailjs.send(ADMIN_CONFIG.emailjs.serviceId, ADMIN_CONFIG.emailjs.templateApproval, { 
                    to_email: data.email, 
                    salon_name: data.name, 
                    owner_name: data.ownerName || 'Degerli Isletme Sahibi', 
                    salon_url: salonUrl, 
                    panel_url: panelUrl, 
                    phone: data.phone || '', 
                    admin_pin: pin,
                    qr_code_url: qrCodeUrl,
                    qr_card_url: qrCardUrl
                }); 
                console.log('[Admin] Adim 4: E-posta gonderildi');
                showToast('Onaylandi, QR kod oluşturuldu ve mail gonderildi!', 'success'); 
            } catch (emailError) { 
                console.error('[Admin] Email hatasi:', emailError); 
                showToast('Onaylandi! Mail gonderilemedi. PIN: ' + pin, 'warning'); 
            } 
        } else {
            showToast('Onaylandi ve QR kod oluşturuldu! PIN: ' + pin, 'success');
        }
        
        await loadAllData();
        
    } catch (e) { 
        console.error('[Admin] Onaylama hatasi:', e);
        showToast('Hata: ' + e.message, 'error'); 
    }
}

async function rejectSalon(id) {
    const reason = prompt('Red sebebi:'); if (reason === null) return;
    try { await db.collection('salons').doc(id).update({ active: false, status: 'rejected', rejectionReason: reason, rejectedAt: new Date().toISOString() }); showToast('Reddedildi', 'warning'); await loadAllData(); } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function deleteSalon(id) {
    if (!confirm('Silmek istediginize emin misiniz?')) return;
    try { await db.collection('salons').doc(id).update({ active: false, deletedAt: new Date().toISOString() }); showToast('Silindi', 'success'); await loadAllData(); } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

function showCreateModal() {
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Yeni Salon</h2><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Salon Adi</label><input type="text" id="newName" class="form-input"></div><div class="form-group"><label class="form-label">Kategori</label><select id="newCategory" class="form-select"><option value="berber">Berber</option><option value="kuafor">Kuafor</option><option value="beauty">Guzellik</option></select></div><div class="form-group"><label class="form-label">Telefon</label><input type="tel" id="newPhone" class="form-input"></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">Iptal</button><button onclick="createSalon()" class="btn btn-primary">Olustur</button></div></div></div>';
}

async function createSalon() {
    const name = document.getElementById('newName').value.trim();
    const category = document.getElementById('newCategory').value;
    const phone = document.getElementById('newPhone').value.trim();
    if (!name) { showToast('Salon adi gerekli', 'error'); return; }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    try {
        const exists = await db.collection('salons').where('slug', '==', slug).get();
        if (!exists.empty) { showToast('Bu isimde salon var', 'error'); return; }
        const ref = await db.collection('salons').add({ name, slug, category, phone: phone.replace(/\D/g, '').slice(-10), package: 'starter', active: true, status: 'approved', createdAt: new Date().toISOString() });
        const svc = DEFAULT_SERVICES[category] || DEFAULT_SERVICES.berber;
        const b = db.batch(); svc.forEach(s => b.set(ref.collection('services').doc(s.id), { ...s, createdAt: new Date().toISOString() })); await b.commit();
        showToast('Olusturuldu!', 'success'); closeModal(); await loadAllData();
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

function showEditModal(id) {
    const s = AdminState.salons.find(x => x.id === id); if (!s) return;
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal modal-large" onclick="event.stopPropagation()"><div class="modal-header"><h2>Salon Duzenle</h2><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-grid"><div class="form-group"><label class="form-label">Salon Adi</label><input type="text" id="editName" class="form-input" value="' + esc(s.name) + '"></div><div class="form-group"><label class="form-label">Yetkili</label><input type="text" id="editOwner" class="form-input" value="' + esc(s.ownerName || '') + '"></div><div class="form-group"><label class="form-label">Telefon</label><input type="tel" id="editPhone" class="form-input" value="' + (s.phone || '') + '"></div><div class="form-group"><label class="form-label">E-posta</label><input type="email" id="editEmail" class="form-input" value="' + esc(s.email || '') + '"></div><div class="form-group"><label class="form-label">Kategori</label><select id="editCategory" class="form-select"><option value="berber"' + (s.category === 'berber' ? ' selected' : '') + '>Berber</option><option value="kuafor"' + (s.category === 'kuafor' ? ' selected' : '') + '>Kuafor</option><option value="beauty"' + (s.category === 'beauty' ? ' selected' : '') + '>Guzellik</option></select></div><div class="form-group"><label class="form-label">Paket</label><select id="editPackage" class="form-select"><option value="starter"' + (s.package === 'starter' ? ' selected' : '') + '>Starter</option><option value="pro"' + (s.package === 'pro' ? ' selected' : '') + '>Pro</option><option value="business"' + (s.package === 'business' ? ' selected' : '') + '>Business</option></select></div><div class="form-group"><label class="form-label">Sehir</label><input type="text" id="editCity" class="form-input" value="' + esc(s.city || '') + '"></div><div class="form-group"><label class="form-label">Ilce</label><input type="text" id="editDistrict" class="form-input" value="' + esc(s.district || '') + '"></div><div class="form-group"><label class="form-label"><input type="checkbox" id="editActive"' + (s.active ? ' checked' : '') + '> Aktif</label></div></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">Iptal</button><button onclick="saveEdit(\'' + id + '\')" class="btn btn-primary">Kaydet</button></div></div></div>';
}

async function saveEdit(id) {
    const data = { name: document.getElementById('editName').value.trim(), ownerName: document.getElementById('editOwner').value.trim(), phone: document.getElementById('editPhone').value.replace(/\D/g, '').slice(-10), email: document.getElementById('editEmail').value.trim(), category: document.getElementById('editCategory').value, package: document.getElementById('editPackage').value, city: document.getElementById('editCity').value.trim(), district: document.getElementById('editDistrict').value.trim(), active: document.getElementById('editActive').checked, updatedAt: new Date().toISOString() };
    if (!data.name) { showToast('Salon adi gerekli', 'error'); return; }
    try { await db.collection('salons').doc(id).update(data); showToast('Kaydedildi!', 'success'); closeModal(); await loadAllData(); if (AdminState.currentView === 'salon-detail') await loadSalonDetails(id); } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

function showAddStaffModal() {
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Yeni Personel</h2><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Ad Soyad</label><input type="text" id="staffName" class="form-input"></div><div class="form-group"><label class="form-label">Uzmanlik</label><input type="text" id="staffRole" class="form-input"></div><div class="form-group"><label class="form-label">PIN</label><input type="text" id="staffPin" class="form-input" maxlength="4"></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">Iptal</button><button onclick="addStaff()" class="btn btn-primary">Ekle</button></div></div></div>';
}

async function addStaff() {
    const name = document.getElementById('staffName').value.trim();
    const role = document.getElementById('staffRole').value.trim();
    const pin = document.getElementById('staffPin').value.trim();
    if (!name) { showToast('Ad gerekli', 'error'); return; }
    const sid = AdminState.selectedSalon.id;
    try { 
        // Ana dokümandaki staff array'ine ekle
        const newStaff = { id: 'staff-' + Date.now(), name, role: role || 'Berber', title: role || 'Berber', pin: pin || '000000', phone: '', active: true, createdAt: new Date().toISOString() };
        const currentStaff = AdminState.selectedSalon.staff || [];
        currentStaff.push(newStaff);
        await db.collection('salons').doc(sid).update({ staff: currentStaff }); 
        AdminState.selectedSalon.staff = currentStaff;
        showToast('Eklendi!', 'success'); closeModal(); await loadSalonDetails(sid); 
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

function showEditStaffModal(staffId) {
    const st = AdminState.salonStaff.find(s => s.id === staffId); if (!st) return;
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Personel Duzenle</h2><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Ad Soyad</label><input type="text" id="staffName" class="form-input" value="' + esc(st.name) + '"></div><div class="form-group"><label class="form-label">Uzmanlik</label><input type="text" id="staffRole" class="form-input" value="' + esc(st.role || '') + '"></div><div class="form-group"><label class="form-label">PIN</label><input type="text" id="staffPin" class="form-input" value="' + (st.pin || '') + '" maxlength="4"></div><div class="form-group"><label class="form-label"><input type="checkbox" id="staffActive"' + (st.active !== false ? ' checked' : '') + '> Aktif</label></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">Iptal</button><button onclick="updateStaff(\'' + staffId + '\')" class="btn btn-primary">Kaydet</button></div></div></div>';
}

async function updateStaff(staffId) {
    const sid = AdminState.selectedSalon.id;
    try { 
        // Ana dokümandaki staff array'ini güncelle
        const currentStaff = AdminState.selectedSalon.staff || [];
        const staffIndex = currentStaff.findIndex(s => s.id === staffId);
        if (staffIndex >= 0) {
            currentStaff[staffIndex] = { 
                ...currentStaff[staffIndex],
                name: document.getElementById('staffName').value.trim(), 
                role: document.getElementById('staffRole').value.trim(), 
                title: document.getElementById('staffRole').value.trim(), 
                pin: document.getElementById('staffPin').value.trim(), 
                active: document.getElementById('staffActive').checked, 
                updatedAt: new Date().toISOString() 
            };
            await db.collection('salons').doc(sid).update({ staff: currentStaff });
            AdminState.selectedSalon.staff = currentStaff;
        }
        showToast('Kaydedildi!', 'success'); closeModal(); await loadSalonDetails(sid); 
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function deleteStaff(staffId) {
    if (!confirm('Silmek istediginize emin misiniz?')) return;
    const sid = AdminState.selectedSalon.id;
    try { 
        // Ana dokümandaki staff array'inden sil
        const currentStaff = AdminState.selectedSalon.staff || [];
        const newStaff = currentStaff.filter(s => s.id !== staffId);
        await db.collection('salons').doc(sid).update({ staff: newStaff });
        AdminState.selectedSalon.staff = newStaff;
        showToast('Silindi', 'success'); await loadSalonDetails(sid); 
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

function showAddServiceModal() {
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Yeni Hizmet</h2><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Hizmet Adi</label><input type="text" id="svcName" class="form-input"></div><div class="form-group"><label class="form-label">Fiyat (TL)</label><input type="number" id="svcPrice" class="form-input" min="0"></div><div class="form-group"><label class="form-label">Sure (dk)</label><input type="number" id="svcDuration" class="form-input" value="30" min="5"></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">Iptal</button><button onclick="addService()" class="btn btn-primary">Ekle</button></div></div></div>';
}

async function addService() {
    const name = document.getElementById('svcName').value.trim();
    const price = parseInt(document.getElementById('svcPrice').value) || 0;
    const duration = parseInt(document.getElementById('svcDuration').value) || 30;
    if (!name || price <= 0) { showToast('Ad ve fiyat gerekli', 'error'); return; }
    const sid = AdminState.selectedSalon.id;
    try { 
        // Ana dokümandaki services array'ine ekle
        const newService = { id: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(), name, price, duration, icon: '✂️', active: true, createdAt: new Date().toISOString() };
        const currentServices = AdminState.selectedSalon.services || [];
        currentServices.push(newService);
        await db.collection('salons').doc(sid).update({ services: currentServices }); 
        AdminState.selectedSalon.services = currentServices;
        showToast('Eklendi!', 'success'); closeModal(); await loadSalonDetails(sid); 
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

function showEditServiceModal(svcId) {
    const sv = AdminState.salonServices.find(s => s.id === svcId); if (!sv) return;
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Hizmet Duzenle</h2><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Hizmet Adi</label><input type="text" id="svcName" class="form-input" value="' + esc(sv.name) + '"></div><div class="form-group"><label class="form-label">Fiyat (TL)</label><input type="number" id="svcPrice" class="form-input" value="' + (sv.price || 0) + '" min="0"></div><div class="form-group"><label class="form-label">Sure (dk)</label><input type="number" id="svcDuration" class="form-input" value="' + (sv.duration || 30) + '" min="5"></div><div class="form-group"><label class="form-label"><input type="checkbox" id="svcActive"' + (sv.active !== false ? ' checked' : '') + '> Aktif</label></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">Iptal</button><button onclick="updateService(\'' + svcId + '\')" class="btn btn-primary">Kaydet</button></div></div></div>';
}

async function updateService(svcId) {
    const sid = AdminState.selectedSalon.id;
    try { 
        // Ana dokümandaki services array'ini güncelle
        const currentServices = AdminState.selectedSalon.services || [];
        const svcIndex = currentServices.findIndex(s => s.id === svcId);
        if (svcIndex >= 0) {
            currentServices[svcIndex] = { 
                ...currentServices[svcIndex],
                name: document.getElementById('svcName').value.trim(), 
                price: parseInt(document.getElementById('svcPrice').value) || 0, 
                duration: parseInt(document.getElementById('svcDuration').value) || 30, 
                active: document.getElementById('svcActive').checked, 
                updatedAt: new Date().toISOString() 
            };
            await db.collection('salons').doc(sid).update({ services: currentServices });
            AdminState.selectedSalon.services = currentServices;
        }
        showToast('Kaydedildi!', 'success'); closeModal(); await loadSalonDetails(sid); 
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function deleteService(svcId) {
    if (!confirm('Silmek istediginize emin misiniz?')) return;
    const sid = AdminState.selectedSalon.id;
    try { 
        // Ana dokümandaki services array'inden sil
        const currentServices = AdminState.selectedSalon.services || [];
        const newServices = currentServices.filter(s => s.id !== svcId);
        await db.collection('salons').doc(sid).update({ services: newServices });
        AdminState.selectedSalon.services = newServices;
        showToast('Silindi', 'success'); await loadSalonDetails(sid); 
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

// PIN Degistirme
function showChangePinModal(id) {
    const s = AdminState.salons.find(x => x.id === id); if (!s) return;
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>PIN Degistir</h2><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><p style="margin-bottom:1rem;color:var(--slate-600)">Salon: <strong>' + esc(s.name) + '</strong></p><div class="form-group"><label class="form-label">Mevcut PIN</label><input type="text" class="form-input" value="' + (s.pin || '-') + '" disabled></div><div class="form-group"><label class="form-label">Yeni PIN</label><input type="text" id="newPin" class="form-input" maxlength="6" placeholder="4-6 haneli yeni PIN"></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">Iptal</button><button onclick="changePin(\'' + id + '\')" class="btn btn-primary">Degistir</button></div></div></div>';
}

async function changePin(id) {
    const newPin = document.getElementById('newPin').value.trim();
    if (!newPin || newPin.length < 4) { showToast('En az 4 haneli PIN girin', 'error'); return; }
    try {
        await db.collection('salons').doc(id).update({ pin: newPin, pinUpdatedAt: new Date().toISOString() });
        showToast('PIN degistirildi: ' + newPin, 'success');
        closeModal();
        await loadAllData();
        if (AdminState.selectedSalon?.id === id) await loadSalonDetails(id);
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

// Durum Degistirme
async function toggleSalonStatus(id, active) {
    const action = active ? 'aktif' : 'pasif';
    if (!confirm('Salonu ' + action + ' yapmak istediginize emin misiniz?')) return;
    try {
        await db.collection('salons').doc(id).update({ active, statusUpdatedAt: new Date().toISOString() });
        showToast('Salon ' + action + ' yapildi', 'success');
        await loadAllData();
        if (AdminState.selectedSalon?.id === id) await loadSalonDetails(id);
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

// Kalici Silme
async function permanentDeleteSalon(id) {
    const s = AdminState.salons.find(x => x.id === id);
    if (!confirm('DIKKAT! "' + (s?.name || 'Bu salon') + '" kalici olarak silinecek!\n\nTum veriler (randevular, personel, hizmetler) kaybolacak.\n\nDevam etmek istiyor musunuz?')) return;
    if (!confirm('EMIN MISINIZ? Bu islem geri alinamaz!')) return;
    
    try {
        showToast('Siliniyor...', 'info');
        // Alt koleksiyonlari sil
        const staffSnap = await db.collection('salons').doc(id).collection('staff').get();
        const svcSnap = await db.collection('salons').doc(id).collection('services').get();
        const aptSnap = await db.collection('salons').doc(id).collection('appointments').get();
        
        const batch = db.batch();
        staffSnap.forEach(doc => batch.delete(doc.ref));
        svcSnap.forEach(doc => batch.delete(doc.ref));
        aptSnap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        // Ana dokumani sil
        await db.collection('salons').doc(id).delete();
        
        showToast('Salon kalici olarak silindi', 'success');
        nav('salons');
        await loadAllData();
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

function closeModal(e) { if (!e || e.target.classList.contains('modal-overlay')) document.getElementById('modal').innerHTML = ''; }
function showToast(msg, type) { const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast show ' + (type || 'info'); setTimeout(() => t.className = 'toast', 3000); }
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// Randevu Düzenleme
function showEditAppointmentModal(aptId) {
    const apt = AdminState.salonAppointments.find(a => a.id === aptId); if (!apt) return;
    document.getElementById('modal').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h2>Randevu Duzenle</h2><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Musteri Adi</label><input type="text" id="aptCustomerName" class="form-input" value="' + esc(apt.customerName || '') + '"></div><div class="form-group"><label class="form-label">Telefon</label><input type="tel" id="aptCustomerPhone" class="form-input" value="' + (apt.customerPhone || '') + '"></div><div class="form-group"><label class="form-label">Tarih</label><input type="date" id="aptDate" class="form-input" value="' + (apt.date || '') + '"></div><div class="form-group"><label class="form-label">Saat</label><input type="time" id="aptTime" class="form-input" value="' + (apt.time || '') + '"></div><div class="form-group"><label class="form-label">Durum</label><select id="aptStatus" class="form-select"><option value="pending"' + (apt.status === 'pending' ? ' selected' : '') + '>Bekliyor</option><option value="confirmed"' + (apt.status === 'confirmed' ? ' selected' : '') + '>Onaylandi</option><option value="completed"' + (apt.status === 'completed' ? ' selected' : '') + '>Tamamlandi</option><option value="cancelled"' + (apt.status === 'cancelled' ? ' selected' : '') + '>Iptal</option></select></div><div class="form-group"><label class="form-label">Not</label><textarea id="aptNote" class="form-input" rows="2">' + esc(apt.note || apt.customerNote || '') + '</textarea></div></div><div class="modal-footer"><button onclick="closeModal()" class="btn btn-outline">Iptal</button><button onclick="updateAppointment(\'' + aptId + '\')" class="btn btn-primary">Kaydet</button></div></div></div>';
}

async function updateAppointment(aptId) {
    const sid = AdminState.selectedSalon.id;
    const data = {
        customerName: document.getElementById('aptCustomerName').value.trim(),
        customerPhone: document.getElementById('aptCustomerPhone').value.replace(/\D/g, ''),
        date: document.getElementById('aptDate').value,
        time: document.getElementById('aptTime').value,
        status: document.getElementById('aptStatus').value,
        note: document.getElementById('aptNote').value.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin'
    };
    try {
        await db.collection('salons').doc(sid).collection('appointments').doc(aptId).update(data);
        showToast('Randevu guncellendi!', 'success');
        closeModal();
        await loadSalonDetails(sid);
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

async function deleteAppointment(aptId) {
    if (!confirm('Bu randevuyu silmek istediginize emin misiniz?')) return;
    const sid = AdminState.selectedSalon.id;
    try {
        await db.collection('salons').doc(sid).collection('appointments').doc(aptId).delete();
        showToast('Randevu silindi', 'success');
        await loadSalonDetails(sid);
    } catch (e) { showToast('Hata: ' + e.message, 'error'); }
}

// QR Kod Yeniden Oluşturma
async function regenerateQRCode(id) {
    showToast('QR kod oluşturuluyor...', 'info');
    try {
        const salon = AdminState.salons.find(s => s.id === id);
        if (!salon) throw new Error('Salon bulunamadı');
        
        const salonUrl = 'https://zamanli.com/' + (salon.category || 'berber') + '/' + salon.slug + '/';
        const qrCodeUrl = await generateQRCode(salonUrl, 256);
        const qrCardUrl = await generateSalonQRCard(salon);
        
        await db.collection('salons').doc(id).update({
            qrCodeUrl: qrCodeUrl,
            qrCardUrl: qrCardUrl,
            qrUpdatedAt: new Date().toISOString()
        });
        
        showToast('QR kod güncellendi!', 'success');
        await loadAllData();
        if (AdminState.selectedSalon?.id === id) await loadSalonDetails(id);
    } catch (e) {
        showToast('Hata: ' + e.message, 'error');
    }
}

// QR Kart İndirme
function downloadQRCard(id) {
    const salon = AdminState.salons.find(s => s.id === id);
    if (!salon || !salon.qrCardUrl) {
        showToast('QR kart bulunamadı', 'error');
        return;
    }
    
    const link = document.createElement('a');
    link.href = salon.qrCardUrl;
    link.download = salon.slug + '-qr-kart.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('QR kart indiriliyor...', 'success');
}

// Calisma Saatleri
function toggleDayClosed(day) {
    const closed = document.getElementById('hour-' + day + '-closed').checked;
    document.getElementById('hour-' + day + '-open').disabled = closed;
    document.getElementById('hour-' + day + '-close').disabled = closed;
    const label = document.querySelector('#hour-' + day + '-closed').parentElement.querySelector('span');
    label.textContent = closed ? 'Kapali' : 'Kapali?';
    label.style.color = closed ? 'var(--danger)' : 'var(--slate-500)';
}

async function saveWorkingHours() {
    const sid = AdminState.selectedSalon.id;
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const workingHours = {};
    
    days.forEach(day => {
        workingHours[day] = {
            open: document.getElementById('hour-' + day + '-open').value || '09:00',
            close: document.getElementById('hour-' + day + '-close').value || '19:00',
            closed: document.getElementById('hour-' + day + '-closed').checked
        };
    });
    
    try {
        await db.collection('salons').doc(sid).update({ 
            workingHours,
            hoursUpdatedAt: new Date().toISOString()
        });
        AdminState.selectedSalon.workingHours = workingHours;
        showToast('Calisma saatleri kaydedildi!', 'success');
    } catch (e) {
        showToast('Hata: ' + e.message, 'error');
    }
}

// ==================== QR KOD SİSTEMİ ====================

// QR Kod oluştur (basit URL için)
async function generateQRCode(url, size = 256) {
    // QR Server API kullanarak QR kod oluştur
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=png&margin=10`;
    return qrUrl;
}

// Salon QR Kartı oluştur (indirilebilir tasarımlı kart)
async function generateSalonQRCard(salon) {
    const salonUrl = `https://zamanli.com/${salon.category || 'berber'}/${salon.slug}/`;
    const qrCodeUrl = await generateQRCode(salonUrl, 200);
    
    // Canvas ile tasarımlı kart oluştur
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    
    // Arka plan
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 500);
    
    // Üst mor bant
    const gradient = ctx.createLinearGradient(0, 0, 400, 0);
    gradient.addColorStop(0, '#10B981');
    gradient.addColorStop(1, '#0EA371');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 80);
    
    // Logo/Başlık
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💈 Zamanli', 200, 50);
    
    // Salon adı
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 22px Inter, Arial, sans-serif';
    ctx.fillText(salon.name || 'Salon', 200, 120);
    
    // Alt başlık
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Inter, Arial, sans-serif';
    ctx.fillText('Online Randevu Al', 200, 145);
    
    // QR kod placeholder - gerçek uygulamada QR image yüklenir
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, 170, 200, 200);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, Arial, sans-serif';
    ctx.fillText('QR Kodu Tara', 200, 280);
    
    // Alt bilgi
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px Inter, Arial, sans-serif';
    ctx.fillText('Kameranızla QR kodu tarayın', 200, 400);
    
    ctx.fillStyle = '#10B981';
    ctx.font = '12px Inter, Arial, sans-serif';
    ctx.fillText(salonUrl, 200, 425);
    
    // Alt bant
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 460, 400, 40);
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter, Arial, sans-serif';
    ctx.fillText('zamanli.com', 200, 485);
    
    // Data URL olarak döndür
    return canvas.toDataURL('image/png');
}

// QR Kodu yeniden oluştur
async function regenerateQRCode(salonId) {
    const salon = AdminState.salons.find(s => s.id === salonId);
    if (!salon) { showToast('Salon bulunamadi', 'error'); return; }
    
    showToast('QR kod olusturuluyor...', 'info');
    
    try {
        const salonUrl = `https://zamanli.com/${salon.category || 'berber'}/${salon.slug}/`;
        const qrCodeUrl = await generateQRCode(salonUrl, 256);
        const qrCardUrl = await generateSalonQRCard(salon);
        
        await db.collection('salons').doc(salonId).update({
            qrCodeUrl: qrCodeUrl,
            qrCardUrl: qrCardUrl,
            qrUpdatedAt: new Date().toISOString()
        });
        
        // State güncelle
        salon.qrCodeUrl = qrCodeUrl;
        salon.qrCardUrl = qrCardUrl;
        
        showToast('QR kod olusturuldu!', 'success');
        
        // Detay sayfasındaysa yenile
        if (AdminState.selectedSalon?.id === salonId) {
            AdminState.selectedSalon.qrCodeUrl = qrCodeUrl;
            AdminState.selectedSalon.qrCardUrl = qrCardUrl;
            renderApp();
        }
    } catch (e) {
        showToast('Hata: ' + e.message, 'error');
    }
}

// QR Kodu indir
function downloadQRCode(salonId, type = 'code') {
    const salon = AdminState.salons.find(s => s.id === salonId) || AdminState.selectedSalon;
    if (!salon) return;
    
    const url = type === 'card' ? salon.qrCardUrl : salon.qrCodeUrl;
    if (!url) {
        showToast('Önce QR kod oluşturun', 'warning');
        return;
    }
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${salon.slug}-qr-${type}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// QR Kod modal göster
function showQRCodeModal(salonId) {
    const salon = AdminState.salons.find(s => s.id === salonId) || AdminState.selectedSalon;
    if (!salon) return;
    
    const salonUrl = `https://zamanli.com/${salon.category || 'berber'}/${salon.slug}/`;
    const qrCodeUrl = salon.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(salonUrl)}`;
    
    document.getElementById('modal').innerHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 450px;">
                <div class="modal-header">
                    <h2>QR Kod - ${esc(salon.name)}</h2>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <div style="background: #f8fafc; padding: 1.5rem; border-radius: 12px; margin-bottom: 1rem;">
                        <img src="${qrCodeUrl}" alt="QR Kod" style="max-width: 200px; border-radius: 8px;">
                    </div>
                    <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 1rem;">
                        Bu QR kodu müşterilerinizin görebileceği bir yere asın.<br>
                        Tarandığında randevu sayfanıza yönlendirir.
                    </p>
                    <div style="background: #f1f5f9; padding: 0.75rem; border-radius: 8px; font-size: 0.8rem; color: #475569; word-break: break-all;">
                        ${salonUrl}
                    </div>
                </div>
                <div class="modal-footer" style="flex-wrap: wrap; gap: 0.5rem;">
                    <button onclick="regenerateQRCode('${salonId}')" class="btn btn-outline btn-sm">🔄 Yenile</button>
                    <button onclick="downloadQRCode('${salonId}', 'code')" class="btn btn-primary btn-sm">📥 QR İndir</button>
                    <button onclick="downloadQRCode('${salonId}', 'card')" class="btn btn-success btn-sm">🖼️ Kart İndir</button>
                </div>
            </div>
        </div>
    `;
}
