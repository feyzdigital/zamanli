/**
 * Zamanli Theme Toggle v1.0
 * Premium animated sun/moon toggle with localStorage persistence
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'zamanli-theme';
    
    // SVG Icons
    const sunIcon = `<svg class="theme-icon sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>`;

    const moonIcon = `<svg class="theme-icon moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>`;

    // Inject styles
    function injectStyles() {
        if (document.getElementById('theme-toggle-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'theme-toggle-styles';
        styles.textContent = `
            .theme-toggle {
                position: relative;
                width: 44px;
                height: 44px;
                border: none;
                background: transparent;
                cursor: pointer;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                overflow: hidden;
            }
            
            .theme-toggle:hover {
                background: var(--action-ghost-hover, #F1F5F9);
            }
            
            .theme-toggle:focus-visible {
                outline: 2px solid var(--focus-ring, #C5A065);
                outline-offset: 2px;
            }
            
            .theme-toggle .theme-icon {
                width: 22px;
                height: 22px;
                position: absolute;
                transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            /* Sun icon - Light mode aktif */
            .theme-toggle .sun-icon {
                color: #C5A065;
                opacity: 1;
                transform: rotate(0deg) scale(1);
            }
            
            .theme-toggle .moon-icon {
                color: #BFD3CD;
                opacity: 0;
                transform: rotate(-90deg) scale(0.5);
            }
            
            /* Dark mode aktif */
            .dark-mode .theme-toggle .sun-icon {
                opacity: 0;
                transform: rotate(90deg) scale(0.5);
            }
            
            .dark-mode .theme-toggle .moon-icon {
                opacity: 1;
                transform: rotate(0deg) scale(1);
            }
            
            /* Hover efekti */
            .theme-toggle:hover .sun-icon {
                transform: rotate(15deg) scale(1.1);
            }
            
            .dark-mode .theme-toggle:hover .moon-icon {
                transform: rotate(-15deg) scale(1.1);
            }
            
            /* Dark mode'da toggle hover rengi */
            .dark-mode .theme-toggle:hover {
                background: var(--action-ghost-hover, #11453D);
            }
            
            /* Tooltip */
            .theme-toggle::after {
                content: 'Koyu tema';
                position: absolute;
                bottom: -32px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--bg-surface, #fff);
                color: var(--text-secondary, #334155);
                font-size: 12px;
                font-weight: 500;
                padding: 4px 10px;
                border-radius: 6px;
                white-space: nowrap;
                opacity: 0;
                visibility: hidden;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(11, 43, 38, 0.15);
                pointer-events: none;
                z-index: 1000;
            }
            
            .dark-mode .theme-toggle::after {
                content: 'Açık tema';
                background: var(--bg-surface, #0F3A33);
                color: var(--text-secondary, #BFD3CD);
            }
            
            .theme-toggle:hover::after {
                opacity: 1;
                visibility: visible;
                bottom: -36px;
            }
            
            /* Geçiş animasyonu için body */
            body {
                transition: background-color 0.3s ease, color 0.3s ease;
            }
            
            body * {
                transition: background-color 0.3s ease, border-color 0.3s ease, color 0.2s ease;
            }
        `;
        document.head.appendChild(styles);
    }

    // Get saved theme or system preference
    function getSavedTheme() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return saved;
        
        // Sistem tercihini kontrol et
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    // Apply theme
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark-mode');
            document.body.classList.add('dark-mode');
        } else {
            document.documentElement.classList.remove('dark-mode');
            document.body.classList.remove('dark-mode');
        }
        localStorage.setItem(STORAGE_KEY, theme);
    }

    // Toggle theme
    function toggleTheme() {
        const isDark = document.body.classList.contains('dark-mode');
        applyTheme(isDark ? 'light' : 'dark');
    }

    // Create toggle button
    function createToggleButton() {
        const btn = document.createElement('button');
        btn.className = 'theme-toggle';
        btn.setAttribute('aria-label', 'Tema değiştir');
        btn.innerHTML = sunIcon + moonIcon;
        btn.addEventListener('click', toggleTheme);
        return btn;
    }

    // Insert toggle into header
    function insertToggle() {
        // Farklı header yapıları için selector'lar
        const selectors = [
            '.header .nav',           // Ana sayfa
            '.header-actions',        // Bazı sayfalar
            '.header .container',     // Alternatif
            '.header-container',      // Admin
            '.header-right',          // Diğer
            '.header'                 // Fallback
        ];

        let container = null;
        for (const selector of selectors) {
            container = document.querySelector(selector);
            if (container) break;
        }

        if (!container) {
            console.warn('[Theme Toggle] Header bulunamadı');
            return;
        }

        const toggle = createToggleButton();
        
        // Nav içindeyse, login butonundan önce ekle
        const loginBtn = container.querySelector('.nav-link.highlight, .btn-primary, .login-btn');
        if (loginBtn) {
            loginBtn.parentNode.insertBefore(toggle, loginBtn);
        } else {
            // Değilse sona ekle
            container.appendChild(toggle);
        }
    }

    // Initialize
    function init() {
        injectStyles();
        applyTheme(getSavedTheme());
        
        // DOM hazır olduğunda toggle'ı ekle
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', insertToggle);
        } else {
            insertToggle();
        }

        // Sistem teması değişirse güncelle (sadece kullanıcı manuel seçim yapmadıysa)
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem(STORAGE_KEY)) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    // Public API
    window.ZamanliTheme = {
        toggle: toggleTheme,
        setTheme: applyTheme,
        getTheme: () => document.body.classList.contains('dark-mode') ? 'dark' : 'light'
    };

    // Auto init
    init();

})();
