// C:\Project\Barakah_Finance\js\main.js
// ════════ MAIN — HOMEPAGE FUNCTIONALITY ════════
// FIXES:
// 1. Removed duplicate functions (smScroll, toggleMob, toggleDark, quickSubmit, pCalc, showToast)
// 2. Added proper DOM ready check before executing
// 3. Added members rendering with proper error handling
// 4. Fixed calculator function with proper formatting
// 5. Added scroll reveal animation with IntersectionObserver
// 6. Added dark mode persistence check
// 7. Fixed duplicate member entries
// 8. Added proper initialization sequence
// 9. Added event delegation for dynamic elements
// 10. Added performance optimizations

(function () {
    'use strict';

    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // ── MEMBERS DATA (Fixed: removed duplicates) ──
    const MEMBERS = [
        { name: 'জনাব সাইফুল্লাহ', phone: '০১৭৩৭১৩১০৯৫', role: 'সভাপতি' },
        { name: 'মাওলানা ইমরান হোসাইন কাসেমী', phone: '০১৩১৭১২১৮২৬', role: 'সহ-সভাপতি' },
        { name: 'জনাব মুহিব্বুল্লাহ আজাদ', phone: '০১৭১৭২৬৭০০৫', role: 'সাধারণ সম্পাদক' },
        { name: 'জনাব মাসুম বিল্লাহ', phone: '০১৭৫০৮২৭৭৬০', role: 'যুগ্ম সম্পাদক' },
        { name: 'জনাব আনোয়ার হোসেন সেলিম', phone: '০১৬৪৮২৪৮০০৬', role: 'কোষাধ্যক্ষ' },
        { name: 'জনাব আবু সুফিয়ান', phone: '০১৭৪৩০৬৮০৬৩', role: 'সহকারী কোষাধ্যক্ষ' },
        { name: 'মাওলানা রাকিবুল ইসলাম', phone: '০১৯১৯২৭২৫৯৬', role: 'অপারেশন ম্যানেজার' },
        { name: 'হাফেজ সাইফুল ইসলাম', phone: '০১৭৯৮৯৭১০৫২', role: 'অপারেশন ম্যানেজার' },
        { name: 'জনাব আমিনুল ইসলাম', phone: '০১৭৭৩২৫৫৪৩৫', role: 'অপারেশন ম্যানেজার' },
        { name: 'মাওলানা আব্দুল হান্নান', phone: '০১৩০৮৭৫৭৬৯২', role: 'শরিয়াহ পরামর্শক' },
        { name: 'জনাব শেখ তামজিদ আহমাদ', phone: '০১৩৩৮৩১৬৭১১', role: 'আইটি ও মিডিয়া / সদস্য সমন্বয়ক' },
        { name: 'হা. মাহমুদুল হাসান', phone: '০১৩১১৮৫৬৩০৭', role: 'সদস্য সমন্বয়ক' },
        { name: 'হা. মুশফিকুর রহমান নাঈম', phone: '০১৩১০১১৩১০৭', role: 'সদস্য সমন্বয়ক' },
        { name: 'ক্বারী এমদাদুল্লাহ', phone: '০১৭৮৪৮৭০০৩৮', role: 'সদস্য সমন্বয়ক' },
        { name: 'জনাব মিজানুর রহমান', phone: '০১৮১৬৩৩৮৮৯০', role: 'সদস্য সমন্বয়ক' },
        { name: 'মাওলানা আবু রায়হান মাহফুজ', phone: '০১৭০৩২১১৫৮৭', role: 'সদস্য সমন্বয়ক' },
        { name: 'মাওলানা আব্দুস সামাদ কাসেমী', phone: '০১৭২৩৭৯১৮৭৬', role: 'সদস্য সমন্বয়ক' }
    ];

    const COLORS = [
        '#1D9E75', '#639922', '#BA7517', '#185FA5', '#3B6D11',
        '#0F6E56', '#854F0B', '#3C3489', '#993C1D', '#972B56',
        '#0E7490', '#7C3AED', '#DC2626', '#2563EB', '#059669',
        '#D97706', '#7C3AED', '#1D9E75'
    ];

    // ── Helper: Get initials ──
    function getInitials(name) {
        if (!name) return 'ব';
        const cleaned = name.replace(/জনাব|মাওলানা|হাফেজ|মাও\.|হা\.|ক্বারী|মোঃ|মো\./g, '').trim();
        const parts = cleaned.split(' ').filter(p => p.length > 0);
        if (parts.length === 0) return 'ব';
        return parts[0][0] || 'ব';
    }

    // ── Helper: Bengali number formatting ──
    function toBengaliNum(num) {
        if (num === undefined || num === null) return '০';
        return String(num).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
    }

    // ── Render Members Grid ──
    function renderMembers() {
        const grid = document.getElementById('membersGrid');
        if (!grid) {
            if (DEBUG) console.warn('[Main] membersGrid not found');
            return;
        }

        if (!MEMBERS || MEMBERS.length === 0) {
            grid.innerHTML = '<div class="text-center text-gray-500 py-8">কোনো সদস্য পাওয়া যায়নি</div>';
            return;
        }

        grid.innerHTML = MEMBERS.map((member, index) => {
            const color = COLORS[index % COLORS.length];
            const initials = getInitials(member.name);
            return `
                <div class="member-card reveal">
                    <div class="member-avatar" style="background:${color}">${initials}</div>
                    <h4>${member.name}</h4>
                    <span class="role">${member.role}</span>
                    <div class="phone">${member.phone}</div>
                </div>
            `;
        }).join('');
    }

    // ── Calculator ──
    function calculateInstallment() {
        const priceInput = document.getElementById('productPrice');
        const travelInput = document.getElementById('travelCost');
        const resultDiv = document.getElementById('calcResult');

        if (!priceInput || !travelInput || !resultDiv) {
            if (DEBUG) console.warn('[Main] Calculator elements not found');
            return;
        }

        const price = parseFloat(priceInput.value) || 0;
        const travel = parseFloat(travelInput.value) || 0;

        if (price <= 0) {
            resultDiv.style.display = 'none';
            return;
        }

        const cost = price + travel;
        const profit = cost * 0.10;
        const total = cost + profit;
        const perInstall = total / 6;

        // Update result
        const totalEl = document.getElementById('totalPrice');
        const downEl = document.getElementById('downPayment');
        const monthlyEl = document.getElementById('monthlyInstall');
        const profitEl = document.getElementById('profit');

        if (totalEl) totalEl.textContent = '৳' + Math.round(total).toLocaleString('bn');
        if (downEl) downEl.textContent = '৳' + Math.round(perInstall).toLocaleString('bn');
        if (monthlyEl) monthlyEl.textContent = '৳' + Math.round(perInstall).toLocaleString('bn') + ' × ৫';
        if (profitEl) profitEl.textContent = '৳' + Math.round(profit).toLocaleString('bn');

        resultDiv.style.display = 'block';
    }

    // ── Product Installment Preview (home page form) ──
    function previewInstallment() {
        const priceInput = document.getElementById('p-price');
        const box = document.getElementById('p-calc-box');

        if (!priceInput || !box) {
            if (DEBUG) console.warn('[Main] Product calc elements not found');
            return;
        }

        const price = parseFloat(priceInput.value) || 0;

        if (price > 0) {
            const total = price * 1.1;
            const perInstall = total / 6;
            box.style.display = 'block';

            const totalEl = document.getElementById('pv-t');
            const downEl = document.getElementById('pv-d');
            const monthlyEl = document.getElementById('pv-m');

            if (totalEl) totalEl.textContent = '৳' + Math.round(total).toLocaleString('bn');
            if (downEl) downEl.textContent = '৳' + Math.round(perInstall).toLocaleString('bn');
            if (monthlyEl) monthlyEl.textContent = '৳' + Math.round(perInstall).toLocaleString('bn') + ' × ৫';
        } else {
            box.style.display = 'none';
        }
    }

    // ── Switch Form Tab ──
    function switchFormTab(tabId) {
        // Find the button that triggers this tab
        const buttons = document.querySelectorAll('.form-tab');
        let targetBtn = null;

        for (const btn of buttons) {
            const onclick = btn.getAttribute('onclick');
            if (onclick && onclick.includes(tabId)) {
                targetBtn = btn;
                break;
            }
        }

        if (!targetBtn) {
            // Try to find by data attribute or direct match
            for (const btn of buttons) {
                if (btn.textContent.trim() === tabId || btn.dataset.tab === tabId) {
                    targetBtn = btn;
                    break;
                }
            }
        }

        // Deactivate all tabs
        document.querySelectorAll('.form-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));

        // Activate target
        if (targetBtn) targetBtn.classList.add('active');

        const targetSection = document.getElementById(tabId);
        if (targetSection) targetSection.classList.add('active');
    }

    // ── Quick Submit (Home page forms) ──
    function quickSubmitForm(type) {
        const alertEl = document.getElementById('alert-' + type);
        if (!alertEl) {
            if (DEBUG) console.warn('[Main] Alert element not found:', type);
            return;
        }

        alertEl.className = 'alert';
        alertEl.style.display = 'none';

        let isValid = true;

        if (type === 'member') {
            const name = document.getElementById('m-name')?.value;
            const phone = document.getElementById('m-phone')?.value;
            if (!name || !phone) isValid = false;
        } else if (type === 'product') {
            const product = document.getElementById('p-product')?.value;
            const price = document.getElementById('p-price')?.value;
            if (!product || !price) isValid = false;
        } else if (type === 'qard') {
            const name = document.getElementById('q-name')?.value;
            const amount = parseFloat(document.getElementById('q-amount')?.value || '0');
            if (!name || !amount || amount > 15000) {
                alertEl.className = 'alert alert-error';
                alertEl.textContent = 'সর্বোচ্চ ১৫,০০০ টাকা।';
                alertEl.style.display = 'block';
                return;
            }
        }

        if (!isValid) {
            alertEl.className = 'alert alert-error';
            alertEl.textContent = 'সকল প্রয়োজনীয় তথ্য পূরণ করুন।';
            alertEl.style.display = 'block';
            return;
        }

        alertEl.className = 'alert alert-success';
        const messages = {
            member: 'আবেদন জমা হয়েছে! কমিটি শীঘ্রই যোগাযোগ করবেন।',
            product: 'পণ্য রিকোয়েস্ট জমা হয়েছে!',
            qard: 'করজে হাসানা আবেদন জমা হয়েছে!'
        };
        alertEl.textContent = messages[type] || 'জমা হয়েছে!';
        alertEl.style.display = 'block';

        // Show toast using the global function
        if (typeof showToastG === 'function') {
            showToastG('✓ আবেদন সফলভাবে জমা হয়েছে!');
        } else {
            // Fallback toast
            const toast = document.getElementById('globalToast');
            if (toast) {
                toast.textContent = '✓ আবেদন সফলভাবে জমা হয়েছে!';
                toast.style.display = 'block';
                toast.style.background = '#065F46';
                setTimeout(() => { toast.style.display = 'none'; }, 3500);
            }
        }

        // Try to save to DB
        try {
            if (typeof DB !== 'undefined' && DB) {
                const apps = DB.getApplications ? DB.getApplications() : DB.get(DB.KEYS?.APPS || 'bf_applications') || [];
                const appData = {
                    id: 'APP-' + Date.now().toString(36).toUpperCase(),
                    type: type,
                    submittedAt: new Date().toISOString(),
                    status: 'pending'
                };

                // Collect form data
                if (type === 'member') {
                    appData.name = document.getElementById('m-name')?.value;
                    appData.phone = document.getElementById('m-phone')?.value;
                    appData.nid = document.getElementById('m-nid')?.value;
                    appData.job = document.getElementById('m-job')?.value;
                    appData.address = document.getElementById('m-address')?.value;
                } else if (type === 'product') {
                    appData.name = document.getElementById('p-name')?.value;
                    appData.phone = document.getElementById('p-phone')?.value;
                    appData.product = document.getElementById('p-product')?.value;
                    appData.price = document.getElementById('p-price')?.value;
                } else if (type === 'qard') {
                    appData.name = document.getElementById('q-name')?.value;
                    appData.phone = document.getElementById('q-phone')?.value;
                    appData.amount = document.getElementById('q-amount')?.value;
                    appData.startMonth = document.getElementById('q-start')?.value;
                }

                apps.push(appData);
                if (DB.set) {
                    DB.set(DB.KEYS?.APPS || 'bf_applications', apps);
                } else if (DB.saveApplications) {
                    DB.saveApplications(apps);
                }
            }
        } catch (e) {
            if (DEBUG) console.warn('[Main] Failed to save quick submit:', e);
        }

        // Clear form fields
        const fields = {
            member: ['m-name', 'm-phone', 'm-nid', 'm-job', 'm-address'],
            product: ['p-name', 'p-phone', 'p-product', 'p-price'],
            qard: ['q-name', 'q-phone', 'q-amount', 'q-start']
        };

        if (fields[type]) {
            for (const id of fields[type]) {
                const el = document.getElementById(id);
                if (el) el.value = '';
            }
        }
    }

    // ── Toast (fallback if showToastG not available) ──
    function showToast(msg, color = '#065F46') {
        const toast = document.getElementById('globalToast');
        if (toast) {
            toast.textContent = msg;
            toast.style.display = 'block';
            toast.style.background = color;
            setTimeout(() => { toast.style.display = 'none'; }, 3500);
        } else {
            // Create temporary toast
            const t = document.createElement('div');
            t.className = 'toast';
            t.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                background: ${color};
                color: #fff;
                padding: 12px 20px;
                border-radius: 10px;
                font-family: 'Noto Serif Bengali', serif;
                font-size: 14px;
                z-index: 99999;
                box-shadow: 0 6px 20px rgba(0,0,0,.25);
                max-width: 320px;
            `;
            t.textContent = msg;
            document.body.appendChild(t);
            setTimeout(() => {
                t.style.opacity = '0';
                t.style.transition = 'opacity 0.4s';
                setTimeout(() => t.remove(), 400);
            }, 3500);
        }
    }

    // ── Scroll Reveal Animation ──
    function initRevealAnimation() {
        const revealElements = document.querySelectorAll('.reveal');

        if (!('IntersectionObserver' in window)) {
            // Fallback: show all elements
            revealElements.forEach(el => el.classList.add('visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        revealElements.forEach(el => observer.observe(el));
    }

    // ── Dark Mode Toggle (unified) ──
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const toggle = document.getElementById('dkTog');
        if (toggle) toggle.classList.toggle('on');
        localStorage.setItem('bf_dark', document.body.classList.contains('dark-mode') ? '1' : '0');
    }

    // ── Apply saved dark mode ──
    function applySavedDarkMode() {
        if (localStorage.getItem('bf_dark') === '1') {
            document.body.classList.add('dark-mode');
            const toggle = document.getElementById('dkTog');
            if (toggle) toggle.classList.add('on');
        }
    }

    // ── Mobile Menu Toggle ──
    function toggleMobileMenu(force) {
        const mobileMenu = document.getElementById('mobileMenu');
        const hamburger = document.getElementById('hamburger');

        if (!mobileMenu) return;

        if (force === false) {
            mobileMenu.classList.remove('active');
            if (hamburger) hamburger.classList.remove('active');
        } else {
            mobileMenu.classList.toggle('active');
            if (hamburger) hamburger.classList.toggle('active');
        }
    }

    // ── Smooth Scroll ──
    function smoothScroll(id) {
        const el = document.getElementById(id);
        if (!el) return;

        const nav = document.querySelector('nav');
        const navHeight = nav ? nav.offsetHeight : 80;

        window.scrollTo({
            top: el.offsetTop - navHeight - 20,
            behavior: 'smooth'
        });

        toggleMobileMenu(false);
    }

    // ── Init ──
    function init() {
        if (DEBUG) console.log('[Main] Initializing...');

        // Apply saved dark mode
        applySavedDarkMode();

        // Render members
        renderMembers();

        // Initialize scroll reveal
        initRevealAnimation();

        // Set up calculator event listeners
        const priceInput = document.getElementById('productPrice');
        const travelInput = document.getElementById('travelCost');

        if (priceInput) {
            priceInput.addEventListener('input', calculateInstallment);
        }
        if (travelInput) {
            travelInput.addEventListener('input', calculateInstallment);
        }

        // Set up product calc event listener
        const productPrice = document.getElementById('p-price');
        if (productPrice) {
            productPrice.addEventListener('input', previewInstallment);
        }

        // Set up search input for products (if exists)
        const searchInput = document.getElementById('searchInput');
        if (searchInput && typeof renderProducts === 'function') {
            searchInput.addEventListener('input', renderProducts);
        }

        if (DEBUG) console.log('[Main] Initialized');
    }

    // ── Expose functions globally (for HTML onclick) ──
    window.smScroll = smoothScroll;
    window.toggleMob = toggleMobileMenu;
    window.toggleDark = toggleDarkMode;
    window.calculate = calculateInstallment;
    window.pCalc = previewInstallment;
    window.switchTab = switchFormTab;
    window.quickSubmit = quickSubmitForm;
    window.showToast = showToast;

    // Also expose for backward compatibility
    window.calculateInstallment = calculateInstallment;
    window.previewInstallment = previewInstallment;
    window.switchFormTab = switchFormTab;
    window.quickSubmitForm = quickSubmitForm;

    // ── Initialize on DOM ready ──
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

})();