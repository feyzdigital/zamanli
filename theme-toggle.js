/**
 * Zamanli Theme Toggle v1.0
 * Premium animated sun/moon toggle with localStorage persistence
 */

(function() {
    'use strict';

    var STORAGE_KEY = 'zamanli-theme';
    
    // SVG Icons
    var sunIcon = '<svg class="theme-icon sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

    var moonIcon = '<svg class="theme-icon moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

    // Inject styles
    function injectStyles() {
        if (document.getElementById('theme-toggle-styles')) return;
        
        var styles = document.createElement('style');
        styles.id = 'theme-toggle-styles';
        styles.textContent = '.theme-toggle{position:relative;width:44px;height:44px;border:none;background:transparent;cursor:pointer;border-radius:12px;display:flex;align-items:center;justify-content:center;transition:all 0.3s ease;overflow:hidden}.theme-toggle:hover{background:rgba(241,245,249,0.8)}.theme-toggle:focus-visible{outline:2px solid #C5A065;outline-offset:2px}.theme-toggle .theme-icon{width:22px;height:22px;position:absolute;transition:all 0.5s cubic-bezier(0.4,0,0.2,1)}.theme-toggle .sun-icon{color:#C5A065;opacity:1;transform:rotate(0deg) scale(1)}.theme-toggle .moon-icon{color:#BFD3CD;opacity:0;transform:rotate(-90deg) scale(0.5)}.dark-mode .theme-toggle .sun-icon{opacity:0;transform:rotate(90deg) scale(0.5)}.dark-mode .theme-toggle .moon-icon{opacity:1;transform:rotate(0deg) scale(1)}.theme-toggle:hover .sun-icon{transform:rotate(15deg) scale(1.1)}.dark-mode .theme-toggle:hover .moon-icon{transform:rotate(-15deg) scale(1.1)}.dark-mode .theme-toggle:hover{background:rgba(17,69,61,0.5)}';
        document.head.appendChild(styles);
    }

    // Get saved theme or system preference
    function getSavedTheme() {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return saved;
        
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
        var isDark = document.body.classList.contains('dark-mode');
        applyTheme(isDark ? 'light' : 'dark');
    }

    // Create toggle button
    function createToggleButton() {
        var btn = document.createElement('button');
        btn.className = 'theme-toggle';
        btn.setAttribute('aria-label', 'Tema degistir');
        btn.innerHTML = sunIcon + moonIcon;
        btn.addEventListener('click', toggleTheme);
        return btn;
    }

    // Insert toggle into header
    function insertToggle() {
        // Different selectors for different page structures
        var selectors = [
            '.nav.desktop-nav',
            '.header-actions',
            '.header .container',
            '.header-container',
            '.header-right',
            '.header nav',
            '.header'
        ];

        var container = null;
        for (var i = 0; i < selectors.length; i++) {
            container = document.querySelector(selectors[i]);
            if (container) break;
        }

        if (!container) {
            console.warn('[Theme Toggle] Header not found');
            return;
        }

        var toggle = createToggleButton();
        
        // Insert before login button if exists
        var loginBtn = container.querySelector('.nav-link.highlight, .btn-primary, .login-btn, a[href*="kayit"]');
        if (loginBtn && loginBtn.parentNode === container) {
            container.insertBefore(toggle, loginBtn);
        } else {
            container.appendChild(toggle);
        }
        
        console.log('[Theme Toggle] Initialized');
    }

    // Initialize
    function init() {
        injectStyles();
        applyTheme(getSavedTheme());
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', insertToggle);
        } else {
            insertToggle();
        }

        // Update if system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
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
        getTheme: function() { return document.body.classList.contains('dark-mode') ? 'dark' : 'light'; }
    };

    // Auto init
    init();

})();
