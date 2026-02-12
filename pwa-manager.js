// ============================================
// ZAMANLI PWA MANAGER v1.0
// ============================================
// Modern PWA deneyimi: Install, Offline, iOS desteği
// ============================================

const ZamanliPWA = {
    
    // Durum değişkenleri
    deferredPrompt: null,
    isStandalone: false,
    isIOS: false,
    isAndroid: false,
    installBannerShown: false,
    
    // Ayarlar
    config: {
        installBannerDelay: 3000,        // İlk banner gecikmesi (ms)
        installBannerDismissLimit: 3,    // Max kapatma sayısı
        updateCheckInterval: 60000,       // SW güncelleme kontrolü (ms)
        offlineToastDuration: 4000       // Offline bildirimi süresi
    },
    
    // ==================== BAŞLATMA ====================
    init() {
        console.log('[PWA] Manager başlatılıyor...');
        
        // Platform tespiti
        this.detectPlatform();
        
        // CSS enjekte et
        this.injectStyles();
        
        // Standalone kontrolü
        this.checkStandaloneMode();
        
        // Install prompt yakalama
        this.setupInstallPrompt();
        
        // Service Worker yönetimi
        this.setupServiceWorker();
        
        // Online/Offline durumu
        this.setupNetworkListeners();
        
        // iOS için özel kontroller
        if (this.isIOS) {
            this.setupIOSSupport();
        }
        
        // Install banner göster (koşullar uygunsa)
        this.maybeShowInstallBanner();
        
        // Update banner dinleyicisi
        this.setupUpdateListener();
        
        console.log('[PWA] Manager hazır ✓', {
            isStandalone: this.isStandalone,
            isIOS: this.isIOS,
            isAndroid: this.isAndroid
        });
    },
    
    // ==================== PLATFORM TESPİTİ ====================
    detectPlatform() {
        const ua = navigator.userAgent;
        
        this.isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
        this.isAndroid = /Android/.test(ua);
        this.isSafari = /^((?!chrome|android).)*safari/i.test(ua);
        this.isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
        this.isFirefox = /Firefox/.test(ua);
        this.isSamsung = /SamsungBrowser/.test(ua);
        
        // iOS versiyonu (PWA desteği için önemli)
        if (this.isIOS) {
            const match = ua.match(/OS (\d+)_/);
            this.iosVersion = match ? parseInt(match[1]) : 0;
            
            // iOS'ta install butonlarını gizlemek için class ekle
            document.documentElement.classList.add('pwa-ios');
            document.body.classList.add('pwa-ios');
        }
    },
    
    // ==================== STANDALONE KONTROLÜ ====================
    checkStandaloneMode() {
        // PWA olarak mı çalışıyor?
        this.isStandalone = 
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.navigator.standalone === true ||
            document.referrer.includes('android-app://');
        
        // Body'ye class ekle
        if (this.isStandalone) {
            document.documentElement.classList.add('pwa-standalone');
            document.body.classList.add('pwa-standalone');
            
            // PWA standalone modda otomatik yönetim paneline yönlendir
            this.autoRedirectToPanel();
        }
        
        // Display mode değişikliğini dinle
        window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
            this.isStandalone = e.matches;
            document.documentElement.classList.toggle('pwa-standalone', e.matches);
        });
    },
    
    // PWA'da otomatik yönetim paneline yönlendirme
    autoRedirectToPanel() {
        // Zaten yönetim panelindeyse veya randevu sayfasındaysa yönlendirme yapma
        const currentPath = window.location.pathname;
        if (currentPath.includes('/yonetim') || currentPath.includes('/admin')) {
            return;
        }
        
        // "view=public" parametresi varsa yönlendirme yapma (Salonu Görüntüle butonu)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('view') === 'public') {
            console.log('[PWA] view=public parametresi tespit edildi, yönlendirme atlanıyor');
            return;
        }
        
        // Salon sahibi session'ı kontrol et
        try {
            const salonSession = localStorage.getItem('salonSession');
            if (salonSession) {
                const session = JSON.parse(salonSession);
                if (session.expires > Date.now() && session.slug) {
                    console.log('[PWA] Salon sahibi session bulundu, yönetim paneline yönlendiriliyor:', session.slug);
                    window.location.href = '/berber/salon/yonetim/?slug=' + session.slug;
                    return;
                }
            }
            
            // Personel session'ı kontrol et
            const staffSession = localStorage.getItem('staffSession');
            if (staffSession) {
                const session = JSON.parse(staffSession);
                if (session.expires > Date.now() && session.salonSlug) {
                    console.log('[PWA] Personel session bulundu, yönetim paneline yönlendiriliyor:', session.salonSlug);
                    window.location.href = '/berber/salon/yonetim/?slug=' + session.salonSlug;
                    return;
                }
            }
        } catch (e) {
            console.log('[PWA] Session kontrol hatası:', e);
        }
    },
    
    // ==================== INSTALL PROMPT ====================
    setupInstallPrompt() {
        // Global'de yakalanmış prompt var mı?
        if (window.__pwaPrompt) {
            this.deferredPrompt = window.__pwaPrompt;
            console.log('[PWA] Önceden yakalanmış prompt alındı');
        }
        
        // beforeinstallprompt event'ini dinle
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            window.__pwaPrompt = e;
            console.log('[PWA] Install prompt yakalandı');
            
            // Install banner'ı gösterebiliriz
            this.maybeShowInstallBanner();
        });
        
        // Uygulama yüklendiğinde
        window.addEventListener('appinstalled', () => {
            console.log('[PWA] Uygulama yüklendi! 🎉');
            this.deferredPrompt = null;
            window.__pwaPrompt = null;
            
            // Banner'ları kapat
            this.hideInstallBanner();
            this.hideInstallModal();
            
            // Başarı bildirimi
            this.showToast('Zamanli yüklendi! 🎉', 'success');
            
            // LocalStorage'ı güncelle
            localStorage.setItem('pwa-installed', 'true');
            localStorage.setItem('pwa-install-date', new Date().toISOString());
            
            // Analytics (varsa)
            if (typeof gtag !== 'undefined') {
                gtag('event', 'pwa_install', { method: this.isIOS ? 'ios' : 'prompt' });
            }
        });
    },
    
    // ==================== INSTALL BANNER ====================
    maybeShowInstallBanner() {
        // Zaten standalone ise gösterme
        if (this.isStandalone) return;
        
        // Zaten gösterilmişse
        if (this.installBannerShown) return;
        
        // Dismiss limiti kontrolü
        const dismissCount = parseInt(localStorage.getItem('pwa-banner-dismiss') || '0');
        if (dismissCount >= this.config.installBannerDismissLimit) return;
        
        // Son gösterimden bu yana geçen süre
        const lastDismiss = localStorage.getItem('pwa-banner-dismiss-time');
        if (lastDismiss) {
            const hoursSince = (Date.now() - parseInt(lastDismiss)) / (1000 * 60 * 60);
            // İlk kapatmadan sonra 24 saat, sonraki her kapatmadan sonra 48 saat bekle
            const waitHours = dismissCount === 1 ? 24 : 48;
            if (hoursSince < waitHours) return;
        }
        
        // iOS veya Android/Chrome prompt varsa göster
        if (this.isIOS || this.deferredPrompt) {
            const delay = dismissCount === 0 ? this.config.installBannerDelay : this.config.installBannerDelay * 2;
            setTimeout(() => this.showInstallBanner(), delay);
        }
    },
    
    showInstallBanner() {
        if (document.getElementById('pwa-install-banner')) return;
        if (this.isStandalone) return;
        
        this.installBannerShown = true;
        
        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.className = 'pwa-install-banner';
        
        const isIOS = this.isIOS;
        
        banner.innerHTML = `
            <div class="pwa-banner-content">
                <div class="pwa-banner-icon">
                    <img src="/icons/icon-72x72.png" alt="Zamanli" onerror="this.innerHTML='📲'">
                </div>
                <div class="pwa-banner-text">
                    <strong>Zamanli'yı Yükle</strong>
                    <span>${isIOS ? 'Ana ekrana ekle, uygulama gibi kullan' : 'Hızlı erişim, bildirimler al'}</span>
                </div>
            </div>
            <div class="pwa-banner-actions">
                <button class="pwa-banner-install" onclick="ZamanliPWA.handleInstallClick()">
                    ${isIOS ? 'Nasıl?' : 'Yükle'}
                </button>
                <button class="pwa-banner-close" onclick="ZamanliPWA.dismissInstallBanner()" aria-label="Kapat">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(banner);
        
        // Animasyonlu göster
        requestAnimationFrame(() => {
            banner.classList.add('show');
        });
    },
    
    hideInstallBanner() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 300);
        }
        this.installBannerShown = false;
    },
    
    dismissInstallBanner() {
        const count = parseInt(localStorage.getItem('pwa-banner-dismiss') || '0') + 1;
        localStorage.setItem('pwa-banner-dismiss', count.toString());
        localStorage.setItem('pwa-banner-dismiss-time', Date.now().toString());
        
        this.hideInstallBanner();
    },
    
    // ==================== INSTALL İŞLEMİ ====================
    handleInstallClick() {
        this.hideInstallBanner();
        
        if (this.isIOS) {
            this.showIOSInstallGuide();
        } else if (this.deferredPrompt) {
            this.triggerInstallPrompt();
        } else {
            // Prompt yok - muhtemelen zaten yüklü
            this.showAlreadyInstalledModal();
        }
    },
    
    async triggerInstallPrompt() {
        if (!this.deferredPrompt) {
            console.warn('[PWA] Install prompt mevcut değil');
            return false;
        }
        
        try {
            this.deferredPrompt.prompt();
            const result = await this.deferredPrompt.userChoice;
            
            console.log('[PWA] Kullanıcı seçimi:', result.outcome);
            
            if (result.outcome === 'accepted') {
                // Yükleme kabul edildi
                this.deferredPrompt = null;
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('[PWA] Install prompt hatası:', error);
            return false;
        }
    },
    
    // Programatik install tetikleme (butonlar için)
    async promptInstall() {
        if (this.isStandalone) {
            this.showToast('Uygulamayı zaten kullanıyorsunuz! 🎉', 'success');
            return;
        }
        
        if (this.isIOS) {
            this.showIOSInstallGuide();
        } else if (this.deferredPrompt) {
            await this.triggerInstallPrompt();
        } else {
            this.showAlreadyInstalledModal();
        }
    },
    
    // ==================== iOS INSTALL GUIDE ====================
    showIOSInstallGuide() {
        const modal = document.createElement('div');
        modal.id = 'pwa-ios-modal';
        modal.className = 'pwa-modal-overlay';
        modal.onclick = (e) => { if (e.target === modal) this.hideInstallModal(); };
        
        const isSafari = this.isSafari;
        
        modal.innerHTML = `
            <div class="pwa-modal pwa-ios-modal">
                <div class="pwa-modal-header">
                    <div class="pwa-modal-title">
                        <span class="pwa-modal-icon">📲</span>
                        <h3>iPhone'a Yükle</h3>
                    </div>
                    <button class="pwa-modal-close" onclick="ZamanliPWA.hideInstallModal()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="pwa-modal-body">
                    ${!isSafari ? `
                        <div class="pwa-ios-warning">
                            <span>⚠️</span>
                            <p>PWA yüklemek için <strong>Safari</strong> tarayıcısını kullanın</p>
                        </div>
                    ` : ''}
                    
                    <div class="pwa-ios-steps">
                        <div class="pwa-ios-step">
                            <div class="pwa-step-number">1</div>
                            <div class="pwa-step-content">
                                <p>Ekranın altındaki <strong>Paylaş</strong> butonuna dokunun</p>
                                <div class="pwa-step-visual">
                                    <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
                                        <rect x="1" y="8" width="20" height="18" rx="2" stroke="#10B981" stroke-width="2"/>
                                        <path d="M11 2v14M6 7l5-5 5 5" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                        
                        <div class="pwa-ios-step">
                            <div class="pwa-step-number">2</div>
                            <div class="pwa-step-content">
                                <p>Listede <strong>"Ana Ekrana Ekle"</strong> seçeneğini bulun</p>
                                <div class="pwa-step-visual pwa-step-visual-text">
                                    <span class="pwa-plus-icon">➕</span>
                                    <span>Ana Ekrana Ekle</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="pwa-ios-step">
                            <div class="pwa-step-number">3</div>
                            <div class="pwa-step-content">
                                <p>Sağ üstteki <strong>"Ekle"</strong> butonuna dokunun</p>
                                <div class="pwa-step-visual pwa-step-visual-text">
                                    <span class="pwa-add-text">Ekle</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="pwa-ios-note">
                        <span>✨</span>
                        <p>Kurulum sonrası Zamanli ana ekranınızda bir uygulama gibi görünecek!</p>
                    </div>
                </div>
                <div class="pwa-modal-footer">
                    <button class="pwa-btn pwa-btn-primary" onclick="ZamanliPWA.hideInstallModal()">Anladım</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('show'));
    },
    
    showAlreadyInstalledModal() {
        const modal = document.createElement('div');
        modal.id = 'pwa-installed-modal';
        modal.className = 'pwa-modal-overlay';
        modal.onclick = (e) => { if (e.target === modal) this.hideInstallModal(); };
        
        modal.innerHTML = `
            <div class="pwa-modal pwa-installed-modal">
                <div class="pwa-modal-body" style="text-align: center; padding: 32px 24px;">
                    <div class="pwa-installed-icon">✅</div>
                    <h3>Uygulama Hazır!</h3>
                    <p>Zamanli muhtemelen zaten yüklü. Ana ekranınızda veya uygulama çekmecenizde arayın.</p>
                    <div class="pwa-installed-hint">
                        <img src="/icons/icon-72x72.png" alt="Zamanli" onerror="this.style.display='none'">
                        <span>Zamanli</span>
                    </div>
                </div>
                <div class="pwa-modal-footer">
                    <button class="pwa-btn pwa-btn-primary" onclick="ZamanliPWA.hideInstallModal()">Tamam</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('show'));
    },
    
    hideInstallModal() {
        const modals = document.querySelectorAll('.pwa-modal-overlay');
        modals.forEach(modal => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        });
    },
    
    // ==================== iOS ÖZEL DESTEK ====================
    setupIOSSupport() {
        // iOS status bar ayarı
        this.setupIOSStatusBar();
        
        // iOS safe area desteği
        this.setupSafeArea();
        
        // iOS pull-to-refresh engelleme (standalone modda)
        if (this.isStandalone) {
            this.preventIOSOverscroll();
        }
    },
    
    setupIOSStatusBar() {
        // Status bar rengini ayarla
        let statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        if (!statusBarMeta) {
            statusBarMeta = document.createElement('meta');
            statusBarMeta.name = 'apple-mobile-web-app-status-bar-style';
            document.head.appendChild(statusBarMeta);
        }
        statusBarMeta.content = 'black-translucent';
    },
    
    setupSafeArea() {
        // CSS custom property olarak safe area değerlerini ekle
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --safe-area-top: env(safe-area-inset-top, 0px);
                --safe-area-bottom: env(safe-area-inset-bottom, 0px);
                --safe-area-left: env(safe-area-inset-left, 0px);
                --safe-area-right: env(safe-area-inset-right, 0px);
            }
        `;
        document.head.appendChild(style);
    },
    
    preventIOSOverscroll() {
        // Standalone modda üst kısımda overscroll'u engelle
        document.body.style.overscrollBehavior = 'none';
    },
    
    // ==================== SERVICE WORKER ====================
    setupServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('[PWA] Service Worker desteklenmiyor');
            return;
        }
        
        window.addEventListener('load', async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('[PWA] SW kayıtlı:', registration.scope);
                
                // Güncelleme kontrolü
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Yeni versiyon hazır
                            console.log('[PWA] Yeni SW versiyonu mevcut');
                            this.showUpdateBanner(newWorker);
                        }
                    });
                });
                
                // Periyodik güncelleme kontrolü
                setInterval(() => {
                    registration.update();
                }, this.config.updateCheckInterval);
                
            } catch (error) {
                console.error('[PWA] SW kayıt hatası:', error);
            }
        });
        
        // Controller değişikliğini dinle
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    },
    
    // ==================== UPDATE BANNER ====================
    setupUpdateListener() {
        // SW'dan mesaj dinle
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'SW_UPDATED') {
                    console.log('[PWA] SW güncellendi:', event.data.version);
                    // Otomatik yenileme yerine banner göster
                    this.showUpdateBanner();
                }
            });
        }
    },
    
    showUpdateBanner(worker = null) {
        if (document.getElementById('pwa-update-banner')) return;
        
        const banner = document.createElement('div');
        banner.id = 'pwa-update-banner';
        banner.className = 'pwa-update-banner';
        
        banner.innerHTML = `
            <div class="pwa-update-content">
                <span class="pwa-update-icon">🔄</span>
                <div class="pwa-update-text">
                    <strong>Güncelleme Mevcut</strong>
                    <span>Yeni özellikler için yenileyin</span>
                </div>
            </div>
            <button class="pwa-update-btn" onclick="ZamanliPWA.applyUpdate()">Güncelle</button>
        `;
        
        document.body.appendChild(banner);
        this.pendingWorker = worker;
        
        requestAnimationFrame(() => banner.classList.add('show'));
    },
    
    applyUpdate() {
        if (this.pendingWorker) {
            this.pendingWorker.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
    },
    
    // ==================== NETWORK STATUS ====================
    setupNetworkListeners() {
        // Online/Offline durumunu dinle
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Başlangıç durumu
        if (!navigator.onLine) {
            this.handleOffline();
        }
    },
    
    handleOnline() {
        console.log('[PWA] Online');
        document.body.classList.remove('pwa-offline');
        
        // Offline banner'ı kaldır
        const offlineBanner = document.getElementById('pwa-offline-banner');
        if (offlineBanner) {
            offlineBanner.classList.remove('show');
            setTimeout(() => offlineBanner.remove(), 300);
        }
        
        this.showToast('İnternet bağlantısı sağlandı ✓', 'success', 2000);
    },
    
    handleOffline() {
        console.log('[PWA] Offline');
        document.body.classList.add('pwa-offline');
        
        // Offline banner göster
        if (!document.getElementById('pwa-offline-banner')) {
            const banner = document.createElement('div');
            banner.id = 'pwa-offline-banner';
            banner.className = 'pwa-offline-banner';
            banner.innerHTML = `
                <span class="pwa-offline-icon">📡</span>
                <span class="pwa-offline-text">Çevrimdışı mod</span>
            `;
            document.body.appendChild(banner);
            requestAnimationFrame(() => banner.classList.add('show'));
        }
    },
    
    // ==================== TOAST ====================
    showToast(message, type = 'info', duration = 3000) {
        // Toast container
        let container = document.getElementById('pwa-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pwa-toast-container';
            container.className = 'pwa-toast-container';
            document.body.appendChild(container);
        }
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        const toast = document.createElement('div');
        toast.className = `pwa-toast pwa-toast-${type}`;
        toast.innerHTML = `
            <span class="pwa-toast-icon">${icons[type] || icons.info}</span>
            <span class="pwa-toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.add('show'));
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },
    
    // ==================== CSS STİLLERİ ====================
    injectStyles() {
        if (document.getElementById('pwa-manager-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'pwa-manager-styles';
        styles.textContent = `
            /* ===== PWA INSTALL BANNER ===== */
            .pwa-install-banner {
                position: fixed;
                bottom: 70px;
                left: 12px;
                right: 12px;
                background: linear-gradient(135deg, #0B2B26 0%, #10B981 100%);
                color: white;
                border-radius: 16px;
                padding: 14px 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                z-index: 9990;
                box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3), 0 0 0 1px rgba(255,255,255,0.1) inset;
                transform: translateY(calc(100% + 100px));
                opacity: 0;
                transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                max-width: 100%;
                box-sizing: border-box;
            }
            
            /* Mobil - bottom nav üzerinde */
            @media (max-width: 599px) {
                .pwa-install-banner {
                    bottom: 64px;
                    left: 8px;
                    right: 8px;
                    padding: 12px 14px;
                    gap: 8px;
                    border-radius: 14px;
                }
            }
            
            @media (min-width: 600px) {
                .pwa-install-banner {
                    bottom: 24px;
                    left: auto;
                    right: 24px;
                    max-width: 380px;
                }
            }
            
            .pwa-install-banner.show {
                transform: translateY(0);
                opacity: 1;
            }
            
            .pwa-banner-content {
                display: flex;
                align-items: center;
                gap: 10px;
                flex: 1;
                min-width: 0;
                overflow: hidden;
            }
            
            .pwa-banner-icon {
                width: 40px;
                height: 40px;
                background: rgba(255,255,255,0.15);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                overflow: hidden;
            }
            
            @media (max-width: 599px) {
                .pwa-banner-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                }
            }
            
            .pwa-banner-icon img {
                width: 28px;
                height: 28px;
                border-radius: 6px;
            }
            
            .pwa-banner-text {
                display: flex;
                flex-direction: column;
                gap: 1px;
                min-width: 0;
                overflow: hidden;
            }
            
            .pwa-banner-text strong {
                font-size: 14px;
                font-weight: 600;
                letter-spacing: -0.01em;
                white-space: nowrap;
            }
            
            @media (max-width: 599px) {
                .pwa-banner-text strong {
                    font-size: 13px;
                }
            }
            
            .pwa-banner-text span {
                font-size: 11px;
                opacity: 0.85;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .pwa-banner-actions {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }
            
            .pwa-banner-install {
                background: white;
                color: #0B2B26;
                border: none;
                padding: 10px 16px;
                border-radius: 10px;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                font-family: inherit;
                transition: transform 0.15s, box-shadow 0.15s;
                white-space: nowrap;
            }
            
            @media (max-width: 599px) {
                .pwa-banner-install {
                    padding: 8px 14px;
                    font-size: 12px;
                    border-radius: 8px;
                }
            }
            
            .pwa-banner-install:active {
                transform: scale(0.95);
            }
            
            .pwa-banner-close {
                background: rgba(255,255,255,0.1);
                border: none;
                width: 32px;
                height: 32px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                color: rgba(255,255,255,0.8);
                transition: background 0.2s;
            }
            
            .pwa-banner-close:hover {
                background: rgba(255,255,255,0.2);
            }
            
            /* ===== PWA MODAL ===== */
            .pwa-modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: flex-end;
                justify-content: center;
                z-index: 99999;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            @media (min-width: 481px) {
                .pwa-modal-overlay {
                    align-items: center;
                    padding: 24px;
                }
            }
            
            .pwa-modal-overlay.show {
                opacity: 1;
                visibility: visible;
            }
            
            .pwa-modal {
                background: white;
                width: 100%;
                max-width: 400px;
                max-height: 85vh;
                border-radius: 24px 24px 0 0;
                overflow: hidden;
                transform: translateY(100%);
                transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            @media (min-width: 481px) {
                .pwa-modal {
                    border-radius: 20px;
                    transform: translateY(30px) scale(0.95);
                }
            }
            
            .pwa-modal-overlay.show .pwa-modal {
                transform: translateY(0) scale(1);
            }
            
            .pwa-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px 20px 16px;
                border-bottom: 1px solid #f1f5f9;
            }
            
            .pwa-modal-title {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .pwa-modal-icon {
                font-size: 24px;
            }
            
            .pwa-modal-title h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 700;
                color: #0f172a;
            }
            
            .pwa-modal-close {
                background: #f8fafc;
                border: none;
                width: 36px;
                height: 36px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                color: #64748b;
                transition: all 0.2s;
            }
            
            .pwa-modal-close:hover {
                background: #f1f5f9;
                color: #334155;
            }
            
            .pwa-modal-body {
                padding: 20px;
                overflow-y: auto;
                max-height: calc(85vh - 140px);
            }
            
            .pwa-modal-footer {
                padding: 16px 20px 20px;
                border-top: 1px solid #f1f5f9;
            }
            
            /* ===== iOS INSTALL STEPS ===== */
            .pwa-ios-warning {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 14px;
                background: #fef3c7;
                border-radius: 12px;
                margin-bottom: 20px;
                font-size: 14px;
                color: #92400e;
            }
            
            .pwa-ios-steps {
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            
            .pwa-ios-step {
                display: flex;
                gap: 14px;
            }
            
            .pwa-step-number {
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, #10B981, #0EA371);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 14px;
                flex-shrink: 0;
            }
            
            .pwa-step-content {
                flex: 1;
            }
            
            .pwa-step-content p {
                margin: 0 0 10px;
                font-size: 14px;
                color: #334155;
                line-height: 1.5;
            }
            
            .pwa-step-visual {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                background: #f1f5f9;
                padding: 10px 16px;
                border-radius: 10px;
            }
            
            .pwa-step-visual-text {
                gap: 8px;
                font-size: 14px;
                font-weight: 500;
                color: #334155;
            }
            
            .pwa-plus-icon {
                font-size: 18px;
            }
            
            .pwa-add-text {
                color: #10B981;
                font-weight: 600;
            }
            
            .pwa-ios-note {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                margin-top: 24px;
                padding: 14px;
                background: #ecfdf5;
                border-radius: 12px;
                font-size: 13px;
                color: #065f46;
                line-height: 1.5;
            }
            
            .pwa-ios-note span {
                font-size: 18px;
                flex-shrink: 0;
            }
            
            .pwa-ios-note p {
                margin: 0;
            }
            
            /* ===== ALREADY INSTALLED MODAL ===== */
            .pwa-installed-modal .pwa-installed-icon {
                font-size: 56px;
                margin-bottom: 16px;
            }
            
            .pwa-installed-modal h3 {
                font-size: 20px;
                font-weight: 700;
                color: #0f172a;
                margin: 0 0 8px;
            }
            
            .pwa-installed-modal p {
                font-size: 14px;
                color: #64748b;
                margin: 0 0 20px;
                line-height: 1.6;
            }
            
            .pwa-installed-hint {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                padding: 12px 20px;
                background: #f8fafc;
                border-radius: 12px;
                font-weight: 500;
                color: #334155;
            }
            
            .pwa-installed-hint img {
                width: 32px;
                height: 32px;
                border-radius: 8px;
            }
            
            /* ===== BUTTONS ===== */
            .pwa-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 14px 24px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 15px;
                cursor: pointer;
                border: none;
                font-family: inherit;
                transition: all 0.2s;
                width: 100%;
            }
            
            .pwa-btn-primary {
                background: linear-gradient(135deg, #10B981, #0EA371);
                color: white;
                box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
            }
            
            .pwa-btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
            }
            
            .pwa-btn-primary:active {
                transform: translateY(0);
            }
            
            /* ===== UPDATE BANNER ===== */
            .pwa-update-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #0B2B26, #10B981);
                color: white;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                z-index: 99999;
                transform: translateY(-100%);
                transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                padding-top: calc(12px + env(safe-area-inset-top, 0px));
            }
            
            .pwa-update-banner.show {
                transform: translateY(0);
            }
            
            .pwa-update-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .pwa-update-icon {
                font-size: 20px;
            }
            
            .pwa-update-text {
                display: flex;
                flex-direction: column;
                gap: 1px;
            }
            
            .pwa-update-text strong {
                font-size: 14px;
            }
            
            .pwa-update-text span {
                font-size: 12px;
                opacity: 0.85;
            }
            
            .pwa-update-btn {
                background: white;
                color: #0B2B26;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                font-family: inherit;
            }
            
            /* ===== OFFLINE BANNER ===== */
            .pwa-offline-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #fef3c7;
                color: #92400e;
                padding: 10px 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 500;
                z-index: 9999;
                transform: translateY(-100%);
                transition: transform 0.3s ease;
                padding-top: calc(10px + env(safe-area-inset-top, 0px));
            }
            
            .pwa-offline-banner.show {
                transform: translateY(0);
            }
            
            /* ===== TOAST ===== */
            .pwa-toast-container {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999999;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                pointer-events: none;
                padding-top: env(safe-area-inset-top, 0px);
            }
            
            .pwa-toast {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 20px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.12);
                transform: translateY(-20px);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                pointer-events: auto;
            }
            
            .pwa-toast.show {
                transform: translateY(0);
                opacity: 1;
            }
            
            .pwa-toast-icon {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
            }
            
            .pwa-toast-success .pwa-toast-icon { background: #d1fae5; color: #059669; }
            .pwa-toast-error .pwa-toast-icon { background: #fee2e2; color: #dc2626; }
            .pwa-toast-warning .pwa-toast-icon { background: #fef3c7; color: #d97706; }
            .pwa-toast-info .pwa-toast-icon { background: #dbeafe; color: #2563eb; }
            
            .pwa-toast-message {
                font-size: 14px;
                font-weight: 500;
                color: #1e293b;
            }
            
            /* ===== iOS'ta INSTALL BUTONUNU GİZLE ===== */
            .pwa-ios .pwa-hide-on-ios,
            .pwa-ios #mobileInstallBtn,
            .pwa-ios #bottomNavInstall,
            .pwa-ios .pwa-install-banner {
                display: none !important;
            }
            
            /* ===== STANDALONE MODE ADJUSTMENTS ===== */
            .pwa-standalone .pwa-install-banner,
            .pwa-standalone .pwa-hide-when-installed,
            .pwa-standalone #mobileInstallBtn,
            .pwa-standalone #bottomNavInstall {
                display: none !important;
            }
            
            .pwa-standalone .header {
                padding-top: env(safe-area-inset-top, 0px);
            }
            
            .pwa-standalone .bottom-nav {
                padding-bottom: env(safe-area-inset-bottom, 0px);
            }
            
            /* ===== DARK MODE SUPPORT (optional) ===== */
            @media (prefers-color-scheme: dark) {
                .pwa-modal {
                    background: #1e293b;
                }
                
                .pwa-modal-title h3,
                .pwa-step-content p {
                    color: #f1f5f9;
                }
                
                .pwa-modal-header,
                .pwa-modal-footer {
                    border-color: #334155;
                }
                
                .pwa-modal-close {
                    background: #334155;
                    color: #94a3b8;
                }
                
                .pwa-step-visual {
                    background: #334155;
                }
                
                .pwa-step-visual-text {
                    color: #f1f5f9;
                }
                
                .pwa-ios-note {
                    background: #064e3b;
                    color: #a7f3d0;
                }
                
                .pwa-installed-hint {
                    background: #334155;
                    color: #f1f5f9;
                }
                
                .pwa-toast {
                    background: #1e293b;
                }
                
                .pwa-toast-message {
                    color: #f1f5f9;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
};

// Global erişim
window.ZamanliPWA = ZamanliPWA;

// Otomatik başlatma
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ZamanliPWA.init());
} else {
    ZamanliPWA.init();
}

console.log('[PWA] Manager modülü yüklendi');
