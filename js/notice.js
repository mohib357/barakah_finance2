// C:\Project\Barakah_Finance\js\notice.js
// ════════ NOTICE BAR & BADGE SECTION — FIXED & IMPROVED VERSION ════════
// FIXES:
// 1. Added proper DB availability check
// 2. Fixed animation with duplicate content for seamless scrolling
// 3. Added dynamic notice item rendering with proper styles
// 4. Fixed badge detail modal with member profile view
// 5. Added proper error handling for missing elements
// 6. Added viewMemberProfile function
// 7. Added Bengali number formatting
// 8. Added auto-refresh on data change
// 9. Added proper toast notification system
// 10. Added performance optimizations with requestAnimationFrame

(function () {
    'use strict';

    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // ── Check if DB is available ──
    function isDBAvailable() {
        return typeof DB !== 'undefined' && DB !== null;
    }

    // ── Toast notification ──
    function showToastGlobal(msg, color = '#065F46') {
        const existing = document.querySelector('.g-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'g-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: ${color};
            color: #fff;
            padding: 14px 22px;
            border-radius: 10px;
            font-family: 'Noto Serif Bengali', serif;
            font-size: 0.9rem;
            z-index: 99999;
            box-shadow: 0 6px 20px rgba(0,0,0,0.25);
            animation: slideUp 0.3s ease;
            max-width: 320px;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.4s';
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    // ── Ensure animation exists ──
    (function ensureToastAnimation() {
        if (!document.querySelector('style[data-notice-toast]')) {
            const style = document.createElement('style');
            style.dataset.noticeToast = '1';
            style.textContent = `
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
    })();

    // ── Bengali number formatting ──
    function toBengaliNum(num) {
        if (num === undefined || num === null) return '০';
        return String(num).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
    }

    // ── Format date ──
    function formatDate(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString('bn-BD', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return '—';
        }
    }

    // ── Get user name by ID ──
    function getUserName(id) {
        if (!isDBAvailable()) return '—';
        try {
            const user = DB.getUsers().find(u => u.id === id);
            return user ? user.name : '—';
        } catch {
            return '—';
        }
    }

    // ════════ NOTICE BAR ════════

    function initNoticeBar() {
        renderNoticeBar();
        // Auto-refresh every 60 seconds
        setInterval(renderNoticeBar, 60000);
    }

    function renderNoticeBar() {
        const track = document.getElementById('notice-track');
        if (!track) {
            if (DEBUG) console.warn('[Notice] notice-track element not found');
            return;
        }

        if (!isDBAvailable()) {
            track.textContent = '⚠️ ডাটাবেস লোড হয়নি';
            if (DEBUG) console.warn('[Notice] DB not available');
            return;
        }

        try {
            const notices = DB.getNotices().filter(n => n.active);
            const settings = DB.getSettings();

            if (!notices || notices.length === 0) {
                track.innerHTML = '<span class="notice-item" style="color:#fff;">📢 কোনো নোটিশ নেই</span>';
                return;
            }

            const speed = settings.noticeSpeed || 30;

            // Build notice items with proper styling
            const items = notices.map(n => {
                const styles = {
                    bold: 'font-weight:700;',
                    italic: 'font-style:italic;',
                    'bold-italic': 'font-weight:700;font-style:italic;',
                    normal: ''
                };
                return `<span class="notice-item" style="color:${n.color || '#fff'};${styles[n.style || 'normal']}">${n.text}</span>`;
            }).join('');

            // Duplicate content for seamless scrolling
            track.innerHTML = items + items;

            // Calculate animation duration based on content width
            // Use requestAnimationFrame to ensure DOM is rendered
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const totalWidth = track.scrollWidth / 2;
                    if (totalWidth > 0) {
                        const duration = Math.max(totalWidth / speed, 5); // minimum 5 seconds
                        track.style.setProperty('--notice-duration', duration + 's');
                        track.style.animation = `noticeScroll ${duration}s linear infinite`;

                        if (DEBUG) {
                            console.log(`[Notice] Animation: ${duration}s, speed: ${speed}px/s, width: ${totalWidth}px`);
                        }
                    } else {
                        track.style.animation = 'none';
                    }
                });
            });

        } catch (error) {
            console.error('[Notice] Failed to render notice bar:', error);
            track.textContent = '⚠️ নোটিশ লোড করতে সমস্যা';
        }
    }

    // ════════ BADGE SECTION ════════

    function updateBadgeSection() {
        const container = document.getElementById('badges-container');
        if (!container) {
            if (DEBUG) console.warn('[Notice] badges-container not found');
            return;
        }

        if (!isDBAvailable()) {
            container.innerHTML = '<div class="badge-card"><div class="badge-label">⚠️ ডাটাবেস লোড হয়নি</div></div>';
            return;
        }

        try {
            const badges = DB.getBadges().filter(b => b.show);
            const users = DB.getUsers();
            const savings = DB.getSavings();
            const loans = DB.getLoans();

            const stats = {
                members: users.filter(u => u.verified && u.role !== 'admin').length,
                savingsTotal: savings.reduce((sum, s) => sum + (s.amount || 0), 0),
                loansTotal: loans.filter(l => l.status === 'active').reduce((sum, l) => sum + (l.amount || 0), 0),
                loansCount: loans.filter(l => l.status === 'active').length
            };

            if (!badges || badges.length === 0) {
                container.innerHTML = '<div class="badge-card"><div class="badge-label">কোনো ব্যাজ নেই</div></div>';
                return;
            }

            container.innerHTML = badges.map(b => {
                let value = '';
                let sub = '';

                switch (b.key) {
                    case 'members':
                        value = toBengaliNum(stats.members);
                        sub = 'সক্রিয় সদস্য';
                        break;
                    case 'savings':
                        value = '৳' + toBengaliNum(stats.savingsTotal.toLocaleString());
                        sub = 'মোট সঞ্চয়';
                        break;
                    case 'loans':
                        value = '৳' + toBengaliNum(stats.loansTotal.toLocaleString());
                        sub = toBengaliNum(stats.loansCount) + ' টি চলমান করজ';
                        break;
                    case 'services':
                        value = toBengaliNum(4);
                        sub = 'ধরনের হালাল সেবা';
                        break;
                    default:
                        value = '—';
                        sub = b.label || '';
                }

                const clickableAttr = b.clickable ? `onclick="openBadgeDetail('${b.key}')"` : '';
                const clickableClass = b.clickable ? 'clickable' : '';

                return `
                    <div class="badge-card ${clickableClass}" ${clickableAttr}>
                        <div class="badge-icon">${b.icon || '🏅'}</div>
                        <div class="badge-info">
                            <div class="badge-value">${value}</div>
                            <div class="badge-label">${b.label || ''}</div>
                            <div class="badge-sub">${sub}</div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('[Notice] Failed to render badges:', error);
            container.innerHTML = '<div class="badge-card"><div class="badge-label">⚠️ ব্যাজ লোড করতে সমস্যা</div></div>';
        }
    }

    // ════════ BADGE DETAIL MODAL ════════

    function openBadgeDetail(key) {
        const modal = document.getElementById('badgeDetailModal');
        const content = document.getElementById('badgeDetailContent');

        if (!modal || !content) {
            if (DEBUG) console.warn('[Notice] Badge detail modal elements not found');
            showToastGlobal('ব্যাজ ডিটেইল লোড করতে সমস্যা', '#e53e3e');
            return;
        }

        if (!isDBAvailable()) {
            content.innerHTML = '<p class="text-center text-gray-500">ডাটাবেস লোড হয়নি</p>';
            modal.classList.remove('hidden');
            return;
        }

        try {
            const users = DB.getUsers().filter(u => u.verified && u.role !== 'admin');
            const savings = DB.getSavings();
            const loans = DB.getLoans().filter(l => l.status === 'active');

            let html = '';

            switch (key) {
                case 'members':
                    html = `
                        <h3 class="bd-title">👥 সদস্যবৃন্দ</h3>
                        <div style="overflow-x:auto;">
                            <table class="bd-table">
                                <thead>
                                    <tr>
                                        <th>নাম</th>
                                        <th>আইডি</th>
                                        <th>মোবাইল</th>
                                        <th>ভূমিকা</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${users.map(u => `
                                        <tr>
                                            <td><a href="javascript:void(0)" onclick="viewMemberProfile('${u.id}')" style="color:#C9A227;text-decoration:underline;cursor:pointer;">${u.name}</a></td>
                                            <td>${u.memberID || '—'}</td>
                                            <td>${u.phone}</td>
                                            <td>${u.role}</td>
                                        </tr>
                                    `).join('') || '<tr><td colspan="4" class="bd-empty">কোনো সদস্য নেই</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    `;
                    break;

                case 'savings':
                    html = `
                        <h3 class="bd-title">💰 সঞ্চয় বিবরণ</h3>
                        <div style="overflow-x:auto;">
                            <table class="bd-table">
                                <thead>
                                    <tr>
                                        <th>সদস্য</th>
                                        <th>মাস</th>
                                        <th>পরিমাণ</th>
                                        <th>তারিখ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${savings.map(s => `
                                        <tr>
                                            <td>${getUserName(s.userId)}</td>
                                            <td>${s.month || '—'}</td>
                                            <td>৳${(s.amount || 0).toLocaleString('bn')}</td>
                                            <td>${formatDate(s.date)}</td>
                                        </tr>
                                    `).join('') || '<tr><td colspan="4" class="bd-empty">কোনো সঞ্চয় নেই</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    `;
                    break;

                case 'loans':
                    html = `
                        <h3 class="bd-title">🤝 করজে হাসানা বিবরণ</h3>
                        <div style="overflow-x:auto;">
                            <table class="bd-table">
                                <thead>
                                    <tr>
                                        <th>সদস্য</th>
                                        <th>পরিমাণ</th>
                                        <th>বাকি</th>
                                        <th>মাস</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${loans.map(l => `
                                        <tr>
                                            <td>${getUserName(l.userId)}</td>
                                            <td>৳${(l.amount || 0).toLocaleString('bn')}</td>
                                            <td>৳${(l.remaining || l.amount || 0).toLocaleString('bn')}</td>
                                            <td>${l.months || 3} মাস</td>
                                        </tr>
                                    `).join('') || '<tr><td colspan="4" class="bd-empty">কোনো সক্রিয় করজ নেই</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    `;
                    break;

                case 'services':
                    const totalSavings = DB.getSavings().reduce((sum, s) => sum + (s.amount || 0), 0);
                    html = `
                        <h3 class="bd-title">🌟 আমাদের সেবাসমূহ</h3>
                        <div class="services-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                            ${[
                            { icon: '🤝', name: 'করজে হাসানা', desc: 'বিনা সুদে সর্বোচ্চ ১৫,০০০ টাকা আপদকালীন ঋণ', link: '#apply' },
                            { icon: '💰', name: 'সঞ্চয় ও বিনিয়োগ', desc: 'মাসিক ২,০০০ টাকা সঞ্চয়, হালাল বিনিয়োগে মুনাফা', link: '#calculator' },
                            { icon: '🕌', name: 'সুদমুক্ত অর্থনীতি', desc: 'শরিয়াহসম্মত সকল লেনদেন ও আর্থিক সেবা', link: '#about' },
                            { icon: '📊', name: 'মোট সম্পদ', desc: `মোট সঞ্চয়: ৳${totalSavings.toLocaleString('bn')}`, link: '#' },
                        ].map(s => `
                                <div class="svc-card" onclick="window.location.href='${s.link}'; closeBadgeDetail();">
                                    <div style="font-size:1.5rem;">${s.icon}</div>
                                    <div class="svc-name">${s.name}</div>
                                    <div class="svc-desc">${s.desc}</div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                    break;

                default:
                    html = `<p class="text-center text-gray-500">কোনো তথ্য পাওয়া যায়নি</p>`;
            }

            content.innerHTML = html;
            modal.classList.remove('hidden');

        } catch (error) {
            console.error('[Notice] Failed to open badge detail:', error);
            content.innerHTML = '<p class="text-center text-red-500">তথ্য লোড করতে সমস্যা হয়েছে</p>';
            modal.classList.remove('hidden');
        }
    }

    function closeBadgeDetail() {
        const modal = document.getElementById('badgeDetailModal');
        if (modal) modal.classList.add('hidden');
    }

    // ════════ VIEW MEMBER PROFILE ════════

    function viewMemberProfile(userId) {
        if (!isDBAvailable()) {
            showToastGlobal('ডাটাবেস লোড হয়নি', '#e53e3e');
            return;
        }

        try {
            const user = DB.getUser(userId);
            if (!user) {
                showToastGlobal('ব্যবহারকারী পাওয়া যায়নি', '#e53e3e');
                return;
            }

            // Close the badge detail modal
            closeBadgeDetail();

            // Show member info in a modal or redirect
            const content = document.getElementById('badgeDetailContent');
            if (content) {
                const html = `
                    <h3 class="bd-title">👤 ${user.name}</h3>
                    <div style="font-size:13px;line-height:2;">
                        <p><strong>আইডি:</strong> ${user.id}</p>
                        <p><strong>সদস্য আইডি:</strong> ${user.memberID || '—'}</p>
                        <p><strong>মোবাইল:</strong> ${user.phone}</p>
                        <p><strong>ইমেইল:</strong> ${user.email || '—'}</p>
                        <p><strong>ভূমিকা:</strong> ${user.role}</p>
                        <p><strong>যাচাইকৃত:</strong> ${user.verified ? '✅ হ্যাঁ' : '❌ না'}</p>
                        ${user.dob ? `<p><strong>জন্ম তারিখ:</strong> ${user.dob}</p>` : ''}
                        ${user.address ? `<p><strong>ঠিকানা:</strong> ${user.address}</p>` : ''}
                        <p><strong>প্রোফাইল সম্পন্নতা:</strong> ${user.profileComplete || 0}%</p>
                        <p><strong>যোগদানের তারিখ:</strong> ${formatDate(user.createdAt)}</p>
                    </div>
                    <button onclick="closeBadgeDetail()" class="auth-btn" style="margin-top:14px;">বন্ধ করুন</button>
                `;
                content.innerHTML = html;
                const modal = document.getElementById('badgeDetailModal');
                if (modal) modal.classList.remove('hidden');
            } else {
                showToastGlobal(`${user.name} - ${user.phone}`, '#065F46');
            }

        } catch (error) {
            console.error('[Notice] Failed to view member profile:', error);
            showToastGlobal('প্রোফাইল লোড করতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ TOAST NOTIFICATION (Fallback) ════════

    function showToast(msg, color = '#065F46') {
        showToastGlobal(msg, color);
    }

    // ════════ AUTO-REFRESH ON DATA CHANGE ════════

    // Listen for settings updates from admin
    document.addEventListener('settingsUpdated', function () {
        renderNoticeBar();
        updateBadgeSection();
        if (DEBUG) console.log('[Notice] Refreshed on settings update');
    });

    // Listen for storage changes from other tabs
    window.addEventListener('storage', function (e) {
        if (e.key === 'bf_notices' || e.key === 'bf_badges' || e.key === 'bf_site_settings') {
            renderNoticeBar();
            updateBadgeSection();
            if (DEBUG) console.log('[Notice] Refreshed on storage change');
        }
    });

    // ════════ INIT ════════

    document.addEventListener('DOMContentLoaded', function () {
        if (!isDBAvailable()) {
            if (DEBUG) console.warn('[Notice] DB not available, some features may not work');
        }

        initNoticeBar();
        updateBadgeSection();

        if (DEBUG) console.log('[Notice] Initialized');
    });

    // ════════ EXPOSE GLOBALLY ════════

    window.initNoticeBar = initNoticeBar;
    window.renderNoticeBar = renderNoticeBar;
    window.updateBadgeSection = updateBadgeSection;
    window.openBadgeDetail = openBadgeDetail;
    window.closeBadgeDetail = closeBadgeDetail;
    window.viewMemberProfile = viewMemberProfile;
    window.showToastGlobal = showToastGlobal;
    window.showToast = showToast;

})();