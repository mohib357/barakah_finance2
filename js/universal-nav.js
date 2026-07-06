// C:\Project\barakah_finance2\js\universal-nav.js

class NavigationManager {
    constructor() {
        this.basePath = this.getBasePath();
        this.init();
    }

    getBasePath() {
        const path = window.location.pathname;

        // Check if in subdirectory
        if (path.includes('/pages/')) {
            return '../';
        } else if (path.includes('/admin/')) {
            return '../';
        } else {
            return './';
        }
    }

    init() {
        this.renderNavbar();
        this.renderNoticeBar();
        this.attachEventListeners();
    }

    renderNavbar() {
        const navContainer = document.getElementById('mainNav');
        if (!navContainer) return;

        const html = `
            <a href="${this.basePath}index.html" class="logo">
                <div class="logo-icon">
                    <img src="${this.basePath}image/logo.png" alt="Barakah Finance Logo"
                        onerror="this.parentElement.innerHTML='<span style=font-size:22px;font-weight:700;color:#C9A227>ب</span>'" />
                </div>
                <div class="logo-text">
                    <strong data-i18n="navLogo">বারাকাহ ফাইন্যান্স</strong>
                    <span>BARAKAH FINANCE</span>
                </div>
            </a>

            <ul class="nav-links" id="navLinks">
                <li><a href="${this.basePath}pages/about.html" class="neu-btn" data-i18n="navAbout">আমাদের সম্পর্কে</a></li>
                <li><a href="${this.basePath}pages/timeline.html" class="neu-btn" data-i18n="navTimeline">টাইম লাইন</a></li>
                <li><a href="${this.basePath}pages/gallery.html" class="neu-btn" data-i18n="navGallery">গ্যালারি</a></li>
                
                <!-- Logged in user menu -->
                <li class="nav-user-wrap" id="nav-user-menu" style="display:none;">
                    <button class="neu-btn nav-user-btn">👤 <span id="nav-user-name">আমি</span> ▾</button>
                    <div class="nav-dropdown">
                        <a href="${this.basePath}pages/profile.html">📋 প্রোফাইল</a>
                        <a href="${this.basePath}pages/dashboard.html">📊 ড্যাশবোর্ড</a>
                        <hr />
                        <button onclick="doLogout()">🚪 লগআউট</button>
                    </div>
                </li>
                
                <!-- Login button -->
                <li id="nav-login-btn">
                    <a onclick="openAuthModal('login')" class="neu-btn neu-btn-primary nav-cta" data-i18n="navLogin">লগইন করুন</a>
                </li>
                
                <!-- Dark Mode Toggle -->
                <li style="display:flex;align-items:center;">
                    <button class="neu-icon-btn" id="dkTog" onclick="toggleDarkMode()" title="ডার্ক/লাইট মোড" aria-label="Toggle Dark Mode">
                        <i class="fas fa-moon"></i>
                    </button>
                </li>

                <!-- Live Traffic Counter - Right side of dark mode -->
                <li style="display:flex;align-items:center;margin-left:8px;">
                    <div class="live-counter-inline" id="liveCounter">
                        <span class="pulse-dot"></span>
                        <span class="counter-text">লাইভ: <strong id="visitorCount">0</strong></span>
                    </div>
                </li>
            </ul>

            <button class="hamburger" id="hamburger" onclick="toggleMob()" aria-label="মেনু">
                <span></span><span></span><span></span>
            </button>
        `;

        navContainer.innerHTML = html;
    }

    renderNoticeBar() {
        // Check if notice bar exists
        let noticeBar = document.querySelector('.notice-bar');
        if (!noticeBar) {
            // Create notice bar if doesn't exist
            const nav = document.getElementById('mainNav');
            if (nav) {
                noticeBar = document.createElement('div');
                noticeBar.className = 'notice-bar';
                noticeBar.style.cssText = 'position:sticky;top:80px;z-index:997;';
                noticeBar.innerHTML = `
                    <div class="notice-label">📢 নোটিশ</div>
                    <div class="notice-scroll-wrap">
                        <div id="notice-track">লোড হচ্ছে...</div>
                    </div>
                `;
                nav.parentElement.insertBefore(noticeBar, nav.nextSibling);
            }
        }
    }

    attachEventListeners() {
        // Mobile menu toggle
        const hamburger = document.getElementById('hamburger');
        if (hamburger) {
            hamburger.addEventListener('click', () => this.toggleMobileMenu());
        }
    }

    toggleMobileMenu() {
        const navLinks = document.getElementById('navLinks');
        if (navLinks) {
            navLinks.classList.toggle('active');
        }
    }
}

// Initialize navigation on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.NavManager = new NavigationManager();

        // Initialize Auth UI
        if (window.Auth) {
            window.Auth.updateUI();
        }

        // Initialize Live Counter
        if (window.LiveCounter) {
            window.LiveCounter.updateDisplay();
        }
    });
} else {
    window.NavManager = new NavigationManager();

    if (window.Auth) {
        window.Auth.updateUI();
    }

    if (window.LiveCounter) {
        window.LiveCounter.updateDisplay();
    }
}

// Global functions
function toggleMob() {
    const navLinks = document.getElementById('navLinks');
    const hamburger = document.getElementById('hamburger');
    if (navLinks) navLinks.classList.toggle('active');
    if (hamburger) hamburger.classList.toggle('active');
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const toggle = document.getElementById('dkTog');
    const icon = toggle ? toggle.querySelector('i') : null;

    if (document.body.classList.contains('dark-mode')) {
        if (icon) icon.className = 'fas fa-sun';
        localStorage.setItem('bf_dark', '1');
    } else {
        if (icon) icon.className = 'fas fa-moon';
        localStorage.setItem('bf_dark', '0');
    }
}

// Apply saved dark mode on load
if (localStorage.getItem('bf_dark') === '1') {
    document.body.classList.add('dark-mode');
    setTimeout(() => {
        const toggle = document.getElementById('dkTog');
        const icon = toggle ? toggle.querySelector('i') : null;
        if (icon) icon.className = 'fas fa-sun';
    }, 100);
}
